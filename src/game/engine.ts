import { shuffle } from './deckBuilder'
import {
  getTrainerEffect,
  trainerIsPlayable,
  trainerValidTargets,
  type TrainerEffect,
} from './trainers'
import { getPokemonPower, powerIsUsable, rainDanceTargets } from './powers'
import type {
  CardDef,
  ElementType,
  EnergyCardDef,
  GameAction,
  GameState,
  InPlayPokemon,
  PlayerState,
  PokemonCardDef,
  Side,
  StatusEffect,
} from './types'

let instanceCounter = 0
function nextInstanceId(): string {
  instanceCounter += 1
  return `i${instanceCounter}-${Math.random().toString(36).slice(2, 8)}`
}

let logCounter = 0
function nextLogId(): string {
  logCounter += 1
  return `l${logCounter}`
}

const HAND_SIZE = 7
const PRIZE_COUNT = 6

function otherSide(side: Side): Side {
  return side === 'p1' ? 'p2' : 'p1'
}

function possessive(name: string): string {
  return name === 'Du' ? 'Dein' : `${name}s`
}

function createPlayer(side: Side, name: string, isAI: boolean, cards: CardDef[]): PlayerState {
  return {
    side,
    name,
    isAI,
    deck: shuffle(cards),
    hand: [],
    active: null,
    bench: [],
    discard: [],
    prizes: [],
    hasAttachedEnergyThisTurn: false,
    hasRetreatedThisTurn: false,
    attackedThisTurn: false,
    attackBonus: 0,
  }
}

function setupPlayerDeckHandPrizes(player: PlayerState): void {
  for (let attempt = 0; attempt < 15; attempt++) {
    const hand = player.deck.slice(0, HAND_SIZE)
    const hasBasic = hand.some((c) => c.kind === 'pokemon' && c.stage === 'basic')
    if (hasBasic || attempt === 14) {
      player.hand = hand
      const remaining = player.deck.slice(HAND_SIZE)
      player.prizes = remaining.slice(0, PRIZE_COUNT)
      player.deck = remaining.slice(PRIZE_COUNT)
      return
    }
    player.deck = shuffle(player.deck)
  }
}

export function createInitialState(
  mode: GameState['mode'],
  mySide: Side,
  p1Cards: CardDef[],
  p2Cards: CardDef[],
  opts?: { p2IsAI?: boolean; p1Name?: string; p2Name?: string },
): GameState {
  const p1 = createPlayer('p1', opts?.p1Name ?? 'Du', false, p1Cards)
  const p2 = createPlayer('p2', opts?.p2Name ?? 'CPU', opts?.p2IsAI ?? true, p2Cards)
  setupPlayerDeckHandPrizes(p1)
  setupPlayerDeckHandPrizes(p2)

  return {
    players: { p1, p2 },
    activeSide: 'p1',
    turnNumber: 0,
    phase: 'setup',
    log: [
      {
        id: nextLogId(),
        turn: 0,
        side: 'system',
        text: 'Spiel gestartet. Wähle dein aktives Pokémon und lege optional Bank-Pokémon aus.',
      },
    ],
    winner: null,
    winnerReason: null,
    mode,
    mySide,
    lastEvent: null,
    setupReady: { p1: false, p2: false },
  }
}

function log(state: GameState, side: Side | 'system', text: string): void {
  state.log.push({ id: nextLogId(), turn: state.turnNumber, side, text })
  if (state.log.length > 300) state.log.shift()
}

function makeInstance(card: PokemonCardDef, turn: number): InPlayPokemon {
  return {
    instanceId: nextInstanceId(),
    stages: [card],
    damage: 0,
    attachedEnergy: [],
    enteredPlayTurn: turn,
    evolvedOnTurn: null,
    statuses: [],
  }
}

export function topStage(mon: InPlayPokemon): PokemonCardDef {
  return mon.stages[mon.stages.length - 1]
}

export function currentHp(mon: InPlayPokemon): number {
  return Math.max(0, topStage(mon).hp - mon.damage)
}

function removeFromHand(player: PlayerState, uid: string): CardDef | null {
  const idx = player.hand.findIndex((c) => c.uid === uid)
  if (idx === -1) return null
  const [card] = player.hand.splice(idx, 1)
  return card
}

/** Welche Energie-Symbole eine Karte liefert (Spezial-Energie ⇒ mehrere). */
function energyProvides(e: EnergyCardDef): ElementType[] {
  return e.provides ?? [e.energyType]
}

/** Gesamtzahl der Energie-Symbole an einem Pokémon (für Rückzugskosten). */
function totalEnergySymbols(attached: EnergyCardDef[]): number {
  return attached.reduce((sum, e) => sum + energyProvides(e).length, 0)
}

function canPayCost(attached: EnergyCardDef[], cost: ElementType[]): boolean {
  const specific = cost.filter((c) => c !== 'Colorless')
  const colorlessCount = cost.length - specific.length
  // Alle bereitgestellten Symbole in einen Pool auflösen (Spezial-Energie
  // liefert mehrere), dann erst die typgebundenen, dann die Farblos-Kosten decken.
  const pool = attached.flatMap(energyProvides)
  for (const type of specific) {
    const idx = pool.findIndex((sym) => sym === type)
    if (idx === -1) return false
    pool.splice(idx, 1)
  }
  return pool.length >= colorlessCount
}

export function attackIsUsable(mon: InPlayPokemon, attackIndex: number, turnNumber: number): boolean {
  if (mon.evolvedOnTurn === turnNumber) return false
  if (mon.statuses.includes('asleep') || mon.statuses.includes('paralyzed')) return false
  const attack = topStage(mon).attacks[attackIndex]
  if (!attack) return false
  return canPayCost(mon.attachedEnergy, attack.cost)
}

const STATUS_LABEL_DE: Record<StatusEffect, string> = {
  poisoned: 'vergiftet',
  burned: 'verbrannt',
  asleep: 'eingeschlafen',
  paralyzed: 'paralysiert',
  confused: 'verwirrt',
}

const EXCLUSIVE_STATUSES: StatusEffect[] = ['asleep', 'paralyzed', 'confused']

function applyStatusFromAttackText(state: GameState, side: Side, mon: InPlayPokemon, text: string): void {
  const lower = text.toLowerCase()
  let status: StatusEffect | null = null
  if (lower.includes('paraly')) status = 'paralyzed'
  else if (lower.includes('asleep') || lower.includes('sleep')) status = 'asleep'
  else if (lower.includes('poison')) status = 'poisoned'
  else if (lower.includes('burn')) status = 'burned'
  else if (lower.includes('confus')) status = 'confused'
  if (!status) return
  if (lower.includes('flip a coin') && Math.random() < 0.5) return
  if (EXCLUSIVE_STATUSES.includes(status)) {
    mon.statuses = mon.statuses.filter((s) => !EXCLUSIVE_STATUSES.includes(s))
  }
  if (!mon.statuses.includes(status)) {
    mon.statuses.push(status)
    log(state, 'system', `${topStage(mon).name} ist jetzt ${STATUS_LABEL_DE[status]}.`)
    state.lastEvent = { type: 'status', side, status }
  }
}

function tickStatusDamage(state: GameState): void {
  for (const side of ['p1', 'p2'] as Side[]) {
    const mon = state.players[side].active
    if (!mon) continue
    let changed = false
    if (mon.statuses.includes('poisoned')) {
      mon.damage += 10
      log(state, 'system', `${topStage(mon).name} erleidet 10 Schaden durch Gift.`)
      changed = true
    }
    if (mon.statuses.includes('burned')) {
      mon.damage += 20
      log(state, 'system', `${topStage(mon).name} erleidet 20 Schaden durch Verbrennung.`)
      if (Math.random() < 0.5) {
        mon.statuses = mon.statuses.filter((s) => s !== 'burned')
        log(state, 'system', `${topStage(mon).name} ist nicht mehr verbrannt.`)
      }
      changed = true
    }
    if (changed && currentHp(mon) <= 0) {
      knockOut(state, side)
    }
  }
}

function knockOut(state: GameState, side: Side): void {
  if (state.winner !== null) return
  const player = state.players[side]
  const mon = player.active
  if (!mon) return
  for (const stageCard of mon.stages) player.discard.push(stageCard)
  for (const energyCard of mon.attachedEnergy) player.discard.push(energyCard)
  player.active = null
  log(state, 'system', `${possessive(player.name)} ${topStage(mon).name} wurde kampfunfähig.`)
  state.lastEvent = { type: 'knockout', side }

  const opponent = state.players[otherSide(side)]
  if (opponent.prizes.length > 0) {
    const [prize] = opponent.prizes.splice(0, 1)
    opponent.hand.push(prize)
    log(state, 'system', `${opponent.name} nimmt eine Prize Card (${opponent.prizes.length} übrig).`)
  }

  if (opponent.prizes.length === 0) {
    state.winner = otherSide(side)
    state.winnerReason = `${opponent.name} hat alle Prize Cards genommen.`
    state.phase = 'gameover'
    log(state, 'system', `${opponent.name} gewinnt!`)
    return
  }

  if (player.bench.length === 0) {
    state.winner = otherSide(side)
    state.winnerReason = `${player.name} hat keine Pokémon mehr übrig.`
    state.phase = 'gameover'
    log(state, 'system', `${state.players[state.winner].name} gewinnt!`)
  }
}

function startTurn(state: GameState, side: Side): void {
  const player = state.players[side]
  state.activeSide = side
  state.turnNumber += 1
  player.hasAttachedEnergyThisTurn = false
  player.hasRetreatedThisTurn = false
  player.attackedThisTurn = false
  player.attackBonus = 0

  if (player.active?.statuses.includes('asleep')) {
    const wokeUp = Math.random() < 0.5
    if (wokeUp) {
      player.active.statuses = player.active.statuses.filter((s) => s !== 'asleep')
      log(state, 'system', `${topStage(player.active).name} wacht auf.`)
    } else {
      log(state, 'system', `${topStage(player.active).name} schläft weiter.`)
    }
  }

  if (player.active === null && player.bench.length === 0) {
    return
  }

  if (player.deck.length === 0) {
    state.winner = otherSide(side)
    state.winnerReason = `${player.name} konnte nicht mehr ziehen (Deck leer).`
    state.phase = 'gameover'
    log(state, 'system', `${state.players[state.winner].name} gewinnt!`)
    return
  }

  const [drawn] = player.deck.splice(0, 1)
  player.hand.push(drawn)
  state.lastEvent = { type: 'draw', side }
  log(state, side, `${player.name} zieht eine Karte (${player.hand.length} auf der Hand).`)
}

function endTurn(state: GameState): void {
  if (state.phase === 'gameover') return
  tickStatusDamage(state)
  if (state.winner !== null) {
    state.phase = 'gameover'
    return
  }
  const endingSide = state.activeSide
  const endingMon = state.players[endingSide].active
  if (endingMon) endingMon.statuses = endingMon.statuses.filter((s) => s !== 'paralyzed')
  const next = otherSide(endingSide)
  startTurn(state, next)
}

function checkPromoteNeeded(state: GameState, side: Side): boolean {
  return state.players[side].active === null && state.phase !== 'gameover'
}

function findMon(player: PlayerState, instanceId: string): InPlayPokemon | null {
  if (player.active?.instanceId === instanceId) return player.active
  return player.bench.find((m) => m.instanceId === instanceId) ?? null
}

/** Wendet den Effekt einer bereits abgelegten Trainer-Karte an. */
function applyTrainerEffect(
  state: GameState,
  side: Side,
  effect: TrainerEffect,
  targetInstanceId?: string,
): void {
  const player = state.players[side]
  const opponent = state.players[otherSide(side)]

  switch (effect.id) {
    case 'bill': {
      const drawn = player.deck.splice(0, Math.min(2, player.deck.length))
      player.hand.push(...drawn)
      log(state, side, `${player.name} spielt Bill und zieht ${drawn.length} Karte${drawn.length === 1 ? '' : 'n'}.`)
      break
    }
    case 'oak': {
      const discarded = player.hand.length
      player.discard.push(...player.hand)
      player.hand = []
      const drawn = player.deck.splice(0, Math.min(7, player.deck.length))
      player.hand.push(...drawn)
      log(
        state,
        side,
        `${player.name} spielt Professor Oak: ${discarded} Handkarte${discarded === 1 ? '' : 'n'} abgeworfen, ${drawn.length} neue gezogen.`,
      )
      break
    }
    case 'potion': {
      const mon = targetInstanceId ? findMon(player, targetInstanceId) : null
      if (!mon) break
      const healed = Math.min(20, mon.damage)
      mon.damage -= healed
      log(state, side, `Trank heilt ${healed} Schaden bei ${topStage(mon).name}.`)
      break
    }
    case 'superPotion': {
      const mon = targetInstanceId ? findMon(player, targetInstanceId) : null
      if (!mon || mon.attachedEnergy.length === 0) break
      const [removed] = mon.attachedEnergy.splice(0, 1)
      player.discard.push(removed)
      const healed = Math.min(40, mon.damage)
      mon.damage -= healed
      log(state, side, `Supertrank wirft ${removed.name} ab und heilt ${healed} Schaden bei ${topStage(mon).name}.`)
      break
    }
    case 'fullHeal': {
      const mon = targetInstanceId ? findMon(player, targetInstanceId) : null
      if (!mon) break
      mon.statuses = []
      log(state, side, `Vollheilung entfernt alle Zustände von ${topStage(mon).name}.`)
      break
    }
    case 'switch': {
      if (!player.active || !targetInstanceId) break
      const idx = player.bench.findIndex((m) => m.instanceId === targetInstanceId)
      if (idx === -1) break
      const incoming = player.bench[idx]
      const outgoing = player.active
      outgoing.statuses = [] // Zustände verschwinden beim Verlassen der aktiven Position
      player.bench.splice(idx, 1)
      player.bench.push(outgoing)
      player.active = incoming
      log(state, side, `Wechsel: ${topStage(incoming).name} wird das neue aktive Pokémon.`)
      break
    }
    case 'pokemonCenter': {
      const mons = player.active ? [player.active, ...player.bench] : [...player.bench]
      let discardedEnergy = 0
      for (const mon of mons) {
        mon.damage = 0
        discardedEnergy += mon.attachedEnergy.length
        player.discard.push(...mon.attachedEnergy)
        mon.attachedEnergy = []
      }
      log(
        state,
        side,
        `Pokémon-Center heilt alle Pokémon von ${player.name} und wirft ${discardedEnergy} Energie ab.`,
      )
      break
    }
    case 'energyRemoval': {
      const mon = targetInstanceId ? findMon(opponent, targetInstanceId) : null
      if (!mon || mon.attachedEnergy.length === 0) break
      const [removed] = mon.attachedEnergy.splice(0, 1)
      opponent.discard.push(removed)
      log(state, side, `Energie-Entzug wirft ${removed.name} von ${topStage(mon).name} (${opponent.name}) ab.`)
      break
    }
    case 'gustOfWind': {
      if (!targetInstanceId) break
      const idx = opponent.bench.findIndex((m) => m.instanceId === targetInstanceId)
      if (idx === -1) break
      const incoming = opponent.bench[idx]
      opponent.bench.splice(idx, 1)
      if (opponent.active) {
        opponent.active.statuses = []
        opponent.bench.push(opponent.active)
      }
      opponent.active = incoming
      log(state, side, `Windstoß zieht ${topStage(incoming).name} von ${opponent.name} nach vorne.`)
      break
    }
    case 'energyRetrieval': {
      const recovered: CardDef[] = []
      for (let i = player.discard.length - 1; i >= 0 && recovered.length < 2; i--) {
        const c = player.discard[i]
        if (c.kind === 'energy' && c.isBasicEnergy) {
          player.discard.splice(i, 1)
          recovered.push(c)
        }
      }
      player.hand.push(...recovered)
      log(state, side, `Energie-Rückgewinnung holt ${recovered.length} Basis-Energie zurück auf die Hand.`)
      break
    }
    case 'plusPower': {
      player.attackBonus += 10
      log(state, side, `PlusPower: Die nächste Attacke verursacht ${player.attackBonus} Schaden mehr.`)
      break
    }
    case 'energySearch': {
      const idx = player.deck.findIndex((c) => c.kind === 'energy' && c.isBasicEnergy)
      if (idx === -1) break
      const [card] = player.deck.splice(idx, 1)
      player.hand.push(card)
      player.deck = shuffle(player.deck)
      log(state, side, `Energiesuche holt ${card.name} aus dem Deck und mischt das Deck.`)
      break
    }
    case 'gambler': {
      const shuffledBack = player.hand.length
      player.deck.push(...player.hand)
      player.hand = []
      player.deck = shuffle(player.deck)
      const heads = Math.random() < 0.5
      const drawCount = Math.min(heads ? 8 : 1, player.deck.length)
      player.hand.push(...player.deck.splice(0, drawCount))
      log(
        state,
        side,
        `Zocker mischt ${shuffledBack} Handkarte${shuffledBack === 1 ? '' : 'n'} ins Deck – ${heads ? 'Kopf' : 'Zahl'}: ${drawCount} gezogen.`,
      )
      break
    }
    case 'revive': {
      if (player.bench.length >= 5) break
      const idx = player.discard.findIndex((c) => c.kind === 'pokemon' && c.stage === 'basic')
      if (idx === -1) break
      const [card] = player.discard.splice(idx, 1) as [PokemonCardDef]
      const mon = makeInstance(card, state.turnNumber)
      // Wiederbelebung: das Pokémon kommt mit halbem Schaden (auf 10 abgerundet).
      mon.damage = Math.floor(card.hp / 2 / 10) * 10
      player.bench.push(mon)
      log(state, side, `Wiederbelebung legt ${card.name} mit ${mon.damage} Schaden auf die Bank.`)
      break
    }
  }
}

export function applyAction(prev: GameState, action: GameAction): GameState {
  const state: GameState = structuredClone(prev)
  state.lastEvent = null

  switch (action.type) {
    case 'SETUP_PLACE_ACTIVE': {
      const player = state.players[action.side]
      if (player.active) break
      const card = player.hand.find((c) => c.uid === action.handUid)
      if (!card || card.kind !== 'pokemon' || card.stage !== 'basic') break
      removeFromHand(player, action.handUid)
      player.active = makeInstance(card, 0)
      log(state, action.side, `${player.name} setzt ${card.name} als aktives Pokémon ein.`)
      break
    }
    case 'SETUP_PLACE_BENCH': {
      const player = state.players[action.side]
      if (player.bench.length >= 5) break
      const card = player.hand.find((c) => c.uid === action.handUid)
      if (!card || card.kind !== 'pokemon' || card.stage !== 'basic') break
      removeFromHand(player, action.handUid)
      player.bench.push(makeInstance(card, 0))
      log(state, action.side, `${player.name} legt ${card.name} auf die Bank.`)
      break
    }
    case 'SETUP_READY': {
      const player = state.players[action.side]
      if (!player.active) break
      state.setupReady[action.side] = true
      if (state.setupReady.p1 && state.setupReady.p2) {
        state.phase = 'main'
        state.activeSide = 'p1'
        state.turnNumber = 1
        log(state, 'system', `${state.players.p1.name} beginnt.`)
      }
      break
    }
    case 'PLAY_BENCH': {
      const player = state.players[action.side]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      if (player.bench.length >= 5) break
      const card = player.hand.find((c) => c.uid === action.handUid)
      if (!card || card.kind !== 'pokemon' || card.stage !== 'basic') break
      removeFromHand(player, action.handUid)
      player.bench.push(makeInstance(card, state.turnNumber))
      log(state, action.side, `${player.name} legt ${card.name} auf die Bank.`)
      break
    }
    case 'EVOLVE': {
      const player = state.players[action.side]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      const card = player.hand.find((c) => c.uid === action.handUid)
      if (!card || card.kind !== 'pokemon' || card.stage === 'basic') break
      const target =
        player.active?.instanceId === action.targetInstanceId
          ? player.active
          : player.bench.find((m) => m.instanceId === action.targetInstanceId)
      if (!target) break
      if (topStage(target).name !== card.evolvesFrom) break
      if (target.enteredPlayTurn === state.turnNumber) break
      removeFromHand(player, action.handUid)
      target.stages.push(card)
      target.evolvedOnTurn = state.turnNumber
      log(state, action.side, `${topStage(target).name} entwickelt sich zu ${card.name}!`)
      break
    }
    case 'ATTACH_ENERGY': {
      const player = state.players[action.side]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      if (player.hasAttachedEnergyThisTurn) break
      const card = player.hand.find((c) => c.uid === action.handUid)
      if (!card || card.kind !== 'energy') break
      const target =
        player.active?.instanceId === action.targetInstanceId
          ? player.active
          : player.bench.find((m) => m.instanceId === action.targetInstanceId)
      if (!target) break
      removeFromHand(player, action.handUid)
      target.attachedEnergy.push(card)
      player.hasAttachedEnergyThisTurn = true
      log(state, action.side, `${player.name} hängt ${card.name} an ${topStage(target).name} an.`)
      break
    }
    case 'PLAY_TRAINER': {
      const player = state.players[action.side]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      const card = player.hand.find((c) => c.uid === action.handUid)
      if (!card || card.kind !== 'trainer') break
      const effect = getTrainerEffect(card)
      if (!effect) break
      if (!trainerIsPlayable(state, action.side, card)) break
      if (effect.targeting !== 'none') {
        const valid = trainerValidTargets(state, action.side, effect)
        if (!action.targetInstanceId || !valid.some((t) => t.instanceId === action.targetInstanceId)) break
      }
      // Trainer wird beim Ausspielen abgelegt, danach greift sein Effekt
      // (wichtig z. B. für Professor Oak, der die restliche Hand abwirft).
      removeFromHand(player, action.handUid)
      player.discard.push(card)
      applyTrainerEffect(state, action.side, effect, action.targetInstanceId)
      state.lastEvent = { type: 'trainer', side: action.side, name: card.name }
      break
    }
    case 'USE_POWER': {
      const player = state.players[action.side]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      const source = findMon(player, action.sourceInstanceId)
      if (!source) break
      const def = getPokemonPower(topStage(source))
      if (!def) break
      if (!powerIsUsable(state, action.side, action.sourceInstanceId)) break

      switch (def.id) {
        case 'rainDance': {
          // Ziel muss ein Wasser-Pokémon in Spiel sein.
          const targets = rainDanceTargets(state, action.side)
          const target = targets.find((m) => m.instanceId === action.targetInstanceId)
          if (!target) break
          // Zu bewegende Basis-Wasser-Energie aus der Hand wählen.
          const energyIdx = action.energyUid
            ? player.hand.findIndex((c) => c.uid === action.energyUid)
            : player.hand.findIndex((c) => c.kind === 'energy' && c.isBasicEnergy && c.energyType === 'Water')
          if (energyIdx === -1) break
          const card = player.hand[energyIdx]
          if (card.kind !== 'energy' || !card.isBasicEnergy || card.energyType !== 'Water') break
          player.hand.splice(energyIdx, 1)
          target.attachedEnergy.push(card)
          // Regentanz ist unabhängig von der normalen 1-Energie-pro-Zug-Regel.
          log(state, action.side, `Regentanz: ${card.name} wird an ${topStage(target).name} angehängt.`)
          break
        }
      }
      break
    }
    case 'RETREAT': {
      const player = state.players[action.side]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      if (player.hasRetreatedThisTurn || !player.active) break
      if (player.active.statuses.includes('asleep') || player.active.statuses.includes('paralyzed')) break
      const benchIdx = player.bench.findIndex((m) => m.instanceId === action.benchInstanceId)
      if (benchIdx === -1) break
      const cost = topStage(player.active).retreatCost
      if (totalEnergySymbols(player.active.attachedEnergy) < cost) break
      // Rückzugskosten mit Energie bezahlen: Karten von vorne abwerfen, bis
      // genug Symbole gedeckt sind (Spezial-Energie zählt mehrfach).
      let toPay = cost
      while (toPay > 0 && player.active.attachedEnergy.length > 0) {
        const [removed] = player.active.attachedEnergy.splice(0, 1)
        player.discard.push(removed)
        toPay -= energyProvides(removed).length
      }
      player.active.statuses = []
      const incoming = player.bench[benchIdx]
      player.bench.splice(benchIdx, 1)
      player.bench.push(player.active)
      player.active = incoming
      player.hasRetreatedThisTurn = true
      log(state, action.side, `${player.name} wechselt zurück zu ${topStage(incoming).name}.`)
      break
    }
    case 'ATTACK': {
      const attacker = state.players[action.side]
      const defender = state.players[otherSide(action.side)]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      if (!attacker.active || !defender.active) break
      if (!attackIsUsable(attacker.active, action.attackIndex, state.turnNumber)) break
      const attack = topStage(attacker.active).attacks[action.attackIndex]

      if (attacker.active.statuses.includes('confused')) {
        const heads = Math.random() < 0.5
        if (!heads) {
          attacker.active.damage += 30
          log(state, 'system', `${topStage(attacker.active).name} ist verwirrt und trifft sich selbst (30 Schaden).`)
          state.lastEvent = { type: 'attack', side: action.side, damage: 30, superEffective: false }
          if (currentHp(attacker.active) <= 0) knockOut(state, action.side)
          if (state.winner === null) endTurn(state)
          break
        }
      }

      const attackerType = topStage(attacker.active).pokemonType
      const defenderWeakness = topStage(defender.active).weakness
      const superEffective = !!defenderWeakness && defenderWeakness === attackerType
      // PlusPower & Co. erhöhen nur Attacken, die überhaupt Schaden verursachen.
      const boosted = attack.damage > 0 ? attack.damage + attacker.attackBonus : attack.damage
      const damage = superEffective ? boosted * 2 : boosted
      attacker.attackBonus = 0
      defender.active.damage += damage
      attacker.attackedThisTurn = true
      state.lastEvent = { type: 'attack', side: action.side, damage, superEffective }
      log(
        state,
        action.side,
        `${topStage(attacker.active).name} setzt ${attack.name} ein und verursacht ${damage} Schaden${superEffective ? ' (super effektiv!)' : ''}.`,
      )
      if (currentHp(defender.active) > 0 && attack.text) {
        applyStatusFromAttackText(state, defender.side, defender.active, attack.text)
      }
      if (defender.active && currentHp(defender.active) <= 0) {
        knockOut(state, defender.side)
      }
      if (state.winner === null) {
        endTurn(state)
      }
      break
    }
    case 'PROMOTE': {
      const player = state.players[action.side]
      if (player.active) break
      const idx = player.bench.findIndex((m) => m.instanceId === action.benchInstanceId)
      if (idx === -1) break
      const [mon] = player.bench.splice(idx, 1)
      player.active = mon
      log(state, action.side, `${player.name} setzt ${topStage(mon).name} als neues aktives Pokémon ein.`)
      break
    }
    case 'END_TURN': {
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      if (!state.players[action.side].active) break
      log(state, action.side, `${state.players[action.side].name} beendet den Zug.`)
      endTurn(state)
      break
    }
  }

  return state
}

export function needsPromote(state: GameState, side: Side): boolean {
  return checkPromoteNeeded(state, side)
}

export function isGameOver(state: GameState): boolean {
  return state.phase === 'gameover'
}
