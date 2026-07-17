import type { CardPool } from '../api/pokemonTcg'
import { BENCH_SIZE, MAX_MULLIGAN_BONUS, PRIZE_COUNT, STARTING_HAND_SIZE } from './constants'
import { buildDeck, shuffle } from './deckBuilder'
import type { EffectSpec } from './effects'
import {
  emptyStatus,
  type CardDef,
  type ElementType,
  type EnergyCardDef,
  type GameAction,
  type GameState,
  type InPlayPokemon,
  type PlayerState,
  type PokemonCardDef,
  type Side,
  type SpecialCondition,
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

function otherSide(side: Side): Side {
  return side === 'p1' ? 'p2' : 'p1'
}

function flipCoin(): 'heads' | 'tails' {
  return Math.random() < 0.5 ? 'heads' : 'tails'
}

function statusLabel(status: SpecialCondition): string {
  switch (status) {
    case 'asleep':
      return 'eingeschlafen'
    case 'paralyzed':
      return 'paralysiert'
    case 'confused':
      return 'verwirrt'
  }
}

function createPlayer(side: Side, name: string, isAI: boolean, pool: CardPool): PlayerState {
  return {
    side,
    name,
    isAI,
    deck: buildDeck(pool),
    hand: [],
    prizes: [],
    active: null,
    bench: [],
    discard: [],
    hasAttachedEnergyThisTurn: false,
    hasRetreatedThisTurn: false,
    supporterPlayedThisTurn: false,
    attackedThisTurn: false,
    mulligans: 0,
  }
}

function dealOpeningHand(player: PlayerState): void {
  for (let attempt = 0; attempt < 50; attempt++) {
    const hand = player.deck.slice(0, STARTING_HAND_SIZE)
    const hasBasic = hand.some((c) => c.kind === 'pokemon' && c.stage === 'basic')
    if (hasBasic) {
      player.hand = hand
      player.deck = player.deck.slice(STARTING_HAND_SIZE)
      return
    }
    player.mulligans += 1
    player.deck = shuffle(player.deck)
  }
  player.hand = player.deck.slice(0, STARTING_HAND_SIZE)
  player.deck = player.deck.slice(STARTING_HAND_SIZE)
}

export function createInitialState(
  mode: GameState['mode'],
  mySide: Side,
  pool: CardPool,
  opts?: { p2IsAI?: boolean; p1Name?: string; p2Name?: string },
): GameState {
  const p1 = createPlayer('p1', opts?.p1Name ?? 'Du', false, pool)
  const p2 = createPlayer('p2', opts?.p2Name ?? 'CPU', opts?.p2IsAI ?? true, pool)
  dealOpeningHand(p1)
  dealOpeningHand(p2)

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
  if (state.log.length > 200) state.log.shift()
}

function makeInstance(card: PokemonCardDef, turn: number): InPlayPokemon {
  return {
    instanceId: nextInstanceId(),
    stages: [card],
    damage: 0,
    attachedEnergy: [],
    enteredPlayTurn: turn,
    evolvedOnTurn: null,
    status: emptyStatus(),
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

function canPayCost(attached: EnergyCardDef[], cost: ElementType[]): boolean {
  const specific = cost.filter((c) => c !== 'Colorless')
  const colorlessCount = cost.length - specific.length
  const pool = [...attached]
  for (const type of specific) {
    const idx = pool.findIndex((e) => e.energyType === type)
    if (idx === -1) return false
    pool.splice(idx, 1)
  }
  return pool.length >= colorlessCount
}

export function attackIsUsable(mon: InPlayPokemon, attackIndex: number, turnNumber: number): boolean {
  if (mon.evolvedOnTurn === turnNumber) return false
  if (mon.status.special === 'asleep' || mon.status.special === 'paralyzed') return false
  const attack = topStage(mon).attacks[attackIndex]
  if (!attack) return false
  return canPayCost(mon.attachedEnergy, attack.cost)
}

function knockOut(state: GameState, side: Side): void {
  const player = state.players[side]
  const mon = player.active
  if (!mon) return
  for (const stageCard of mon.stages) player.discard.push(stageCard)
  for (const energyCard of mon.attachedEnergy) player.discard.push(energyCard)
  player.active = null
  log(state, 'system', `${player.name}s ${topStage(mon).name} wurde kampfunfähig.`)
  state.lastEvent = { type: 'knockout', side }

  const winnerSide = otherSide(side)
  const winner = state.players[winnerSide]
  if (winner.prizes.length > 0) {
    const [prizeCard] = winner.prizes.splice(0, 1)
    winner.hand.push(prizeCard)
    log(state, 'system', `${winner.name} zieht eine Preiskarte (${winner.prizes.length} übrig).`)
  }

  if (winner.prizes.length === 0) {
    state.winner = winnerSide
    state.winnerReason = `${winner.name} hat alle Preiskarten aufgenommen.`
    state.phase = 'gameover'
    log(state, 'system', `${winner.name} gewinnt!`)
    return
  }

  if (player.bench.length === 0) {
    state.winner = winnerSide
    state.winnerReason = `${player.name} hat keine Pokémon mehr übrig.`
    state.phase = 'gameover'
    log(state, 'system', `${winner.name} gewinnt!`)
  }
}

function runBetweenTurnsCheckup(state: GameState): void {
  for (const side of ['p1', 'p2'] as Side[]) {
    const player = state.players[side]
    const mon = player.active
    if (!mon) continue
    if (mon.status.poisoned) {
      mon.damage += 10
      log(state, 'system', `${player.name}s ${topStage(mon).name} erleidet 10 Schaden durch Gift.`)
    }
    if (mon.status.burned) {
      if (flipCoin() === 'tails') {
        mon.damage += 20
        log(state, 'system', `${player.name}s ${topStage(mon).name} erleidet 20 Schaden durch Verbrennung.`)
      }
      mon.status.burned = false
    }
  }
  for (const side of ['p1', 'p2'] as Side[]) {
    const player = state.players[side]
    if (player.active && currentHp(player.active) <= 0 && state.winner === null) {
      knockOut(state, side)
    }
  }
}

function startTurn(state: GameState, side: Side): void {
  const player = state.players[side]
  state.activeSide = side
  state.turnNumber += 1
  player.hasAttachedEnergyThisTurn = false
  player.hasRetreatedThisTurn = false
  player.supporterPlayedThisTurn = false
  player.attackedThisTurn = false

  if (player.active) {
    if (player.active.status.special === 'paralyzed') {
      player.active.status.special = null
      log(state, 'system', `${player.name}s ${topStage(player.active).name} ist nicht mehr paralysiert.`)
    } else if (player.active.status.special === 'asleep') {
      if (flipCoin() === 'heads') {
        player.active.status.special = null
        log(state, 'system', `${player.name}s ${topStage(player.active).name} wacht auf.`)
      } else {
        log(state, 'system', `${player.name}s ${topStage(player.active).name} bleibt eingeschlafen.`)
      }
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
  runBetweenTurnsCheckup(state)
  if (state.winner !== null) return
  const next = otherSide(state.activeSide)
  startTurn(state, next)
}

function checkPromoteNeeded(state: GameState, side: Side): boolean {
  return state.players[side].active === null && state.phase !== 'gameover'
}

function applyAttackEffects(
  state: GameState,
  attackerSide: Side,
  defenderSide: Side,
  effects: EffectSpec[],
  baseDamage: number,
): number {
  const attacker = state.players[attackerSide]
  const defender = state.players[defenderSide]
  let damage = baseDamage
  let nullified = false

  for (const effect of effects) {
    switch (effect.kind) {
      case 'noDamageOnTails': {
        if (flipCoin() === 'tails') {
          damage = 0
          nullified = true
          log(state, 'system', 'Münzwurf: Zahl – die Attacke verfehlt.')
        }
        break
      }
      case 'coinFlipDamageBonus': {
        if (!nullified && flipCoin() === 'heads') {
          damage += effect.amount
          log(state, 'system', `Münzwurf: Kopf – ${effect.amount} zusätzlicher Schaden.`)
        }
        break
      }
      case 'selfDamage': {
        if (attacker.active) {
          attacker.active.damage += effect.amount
          log(state, 'system', `${topStage(attacker.active).name} erleidet ${effect.amount} Selbstschaden.`)
        }
        break
      }
      case 'inflictStatus': {
        if (nullified || !defender.active) break
        const apply = effect.coinflip ? flipCoin() === 'heads' : true
        if (apply) {
          defender.active.status.special = effect.status
          log(state, 'system', `${topStage(defender.active).name} ist jetzt ${statusLabel(effect.status)}.`)
        }
        break
      }
      case 'poison': {
        if (nullified || !defender.active) break
        defender.active.status.poisoned = true
        log(state, 'system', `${topStage(defender.active).name} ist jetzt vergiftet.`)
        break
      }
      case 'burn': {
        if (nullified || !defender.active) break
        defender.active.status.burned = true
        log(state, 'system', `${topStage(defender.active).name} ist jetzt verbrannt.`)
        break
      }
      case 'heal': {
        if (attacker.active) {
          attacker.active.damage = Math.max(0, attacker.active.damage - effect.amount)
        }
        break
      }
      case 'drawCards': {
        for (let i = 0; i < effect.amount && attacker.deck.length > 0; i++) {
          const [drawn] = attacker.deck.splice(0, 1)
          attacker.hand.push(drawn)
        }
        break
      }
      case 'discardOwnEnergy': {
        if (attacker.active) {
          const amount = effect.amount === 'all' ? attacker.active.attachedEnergy.length : effect.amount
          const removed = attacker.active.attachedEnergy.splice(0, amount)
          attacker.discard.push(...removed)
        }
        break
      }
      default:
        break
    }
  }

  return Math.max(0, damage)
}

function applyTrainerEffects(
  state: GameState,
  side: Side,
  effects: EffectSpec[],
  targetInstanceId?: string,
): boolean {
  const player = state.players[side]
  for (const effect of effects) {
    switch (effect.kind) {
      case 'heal': {
        if (!player.active) return false
        player.active.damage = Math.max(0, player.active.damage - effect.amount)
        break
      }
      case 'switchSelfActive': {
        if (!player.active) return false
        const idx = player.bench.findIndex((m) => m.instanceId === targetInstanceId)
        if (idx === -1) return false
        const incoming = player.bench[idx]
        player.bench.splice(idx, 1)
        player.bench.push(player.active)
        player.active = incoming
        break
      }
      case 'drawCards': {
        for (let i = 0; i < effect.amount && player.deck.length > 0; i++) {
          const [drawn] = player.deck.splice(0, 1)
          player.hand.push(drawn)
        }
        break
      }
      case 'handRefresh': {
        const oldHand = player.hand
        player.hand = []
        if (effect.shuffleBack) {
          player.deck = shuffle([...player.deck, ...oldHand])
        } else {
          player.discard.push(...oldHand)
        }
        for (let i = 0; i < effect.amount && player.deck.length > 0; i++) {
          const [drawn] = player.deck.splice(0, 1)
          player.hand.push(drawn)
        }
        break
      }
      case 'searchDeckForEnergy': {
        const idx = player.deck.findIndex((c) => c.kind === 'energy')
        if (idx !== -1) {
          const [found] = player.deck.splice(idx, 1)
          player.hand.push(found)
        }
        player.deck = shuffle(player.deck)
        break
      }
      default:
        break
    }
  }
  return true
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
      if (player.bench.length >= BENCH_SIZE) break
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
        for (const side of ['p1', 'p2'] as Side[]) {
          const p = state.players[side]
          p.prizes = p.deck.splice(0, PRIZE_COUNT)
        }
        for (const side of ['p1', 'p2'] as Side[]) {
          const p = state.players[side]
          const opponent = state.players[otherSide(side)]
          const bonus = Math.min(p.mulligans, MAX_MULLIGAN_BONUS)
          for (let i = 0; i < bonus && opponent.deck.length > 0; i++) {
            const [drawn] = opponent.deck.splice(0, 1)
            opponent.hand.push(drawn)
          }
          if (bonus > 0) {
            log(
              state,
              'system',
              `${p.name} musste ${p.mulligans}x neu mischen (kein Basis-Pokémon). ${opponent.name} zieht ${bonus} Bonuskarte(n).`,
            )
          }
        }
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
      if (player.bench.length >= BENCH_SIZE) break
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
      if (state.turnNumber === 1) break
      const card = player.hand.find((c) => c.uid === action.handUid)
      if (!card || card.kind !== 'pokemon' || card.stage === 'basic') break
      const target =
        player.active?.instanceId === action.targetInstanceId
          ? player.active
          : player.bench.find((m) => m.instanceId === action.targetInstanceId)
      if (!target) break
      const requiredStage = card.stage === 'stage1' ? 'basic' : 'stage1'
      if (topStage(target).stage !== requiredStage) break
      if (topStage(target).name !== card.evolvesFrom) break
      if (target.enteredPlayTurn === state.turnNumber) break
      const fromName = topStage(target).name
      removeFromHand(player, action.handUid)
      target.stages.push(card)
      target.evolvedOnTurn = state.turnNumber
      target.status = emptyStatus()
      log(state, action.side, `${fromName} entwickelt sich zu ${card.name}!`)
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
      if (card.trainerType === 'supporter' && player.supporterPlayedThisTurn) break
      if (card.effects.some((e) => e.kind === 'switchSelfActive')) {
        if (!player.active || !player.bench.some((m) => m.instanceId === action.targetInstanceId)) break
      }
      removeFromHand(player, action.handUid)
      const applied = applyTrainerEffects(state, action.side, card.effects, action.targetInstanceId)
      if (!applied) {
        player.hand.push(card)
        break
      }
      player.discard.push(card)
      if (card.trainerType === 'supporter') player.supporterPlayedThisTurn = true
      log(state, action.side, `${player.name} spielt ${card.name}.`)
      break
    }
    case 'RETREAT': {
      const player = state.players[action.side]
      if (state.phase !== 'main' || state.activeSide !== action.side) break
      if (player.hasRetreatedThisTurn || !player.active) break
      if (player.active.status.special === 'asleep' || player.active.status.special === 'paralyzed') break
      const benchIdx = player.bench.findIndex((m) => m.instanceId === action.benchInstanceId)
      if (benchIdx === -1) break
      const cost = topStage(player.active).retreatCost
      if (player.active.attachedEnergy.length < cost) break
      const paid = player.active.attachedEnergy.splice(0, cost)
      player.discard.push(...paid)
      player.active.status = emptyStatus()
      const incoming = player.bench[benchIdx]
      player.bench.splice(benchIdx, 1)
      player.bench.push(player.active)
      player.active = incoming
      player.hasRetreatedThisTurn = true
      log(state, action.side, `${player.name} wechselt zurück zu ${topStage(incoming).name}.`)
      break
    }
    case 'ATTACK': {
      const attackerSide = action.side
      const defenderSide = otherSide(attackerSide)
      const attacker = state.players[attackerSide]
      const defender = state.players[defenderSide]
      if (state.phase !== 'main' || state.activeSide !== attackerSide) break
      if (!attacker.active || !defender.active) break
      if (!attackIsUsable(attacker.active, action.attackIndex, state.turnNumber)) break

      const attack = topStage(attacker.active).attacks[action.attackIndex]
      const attackerType = topStage(attacker.active).pokemonType
      const defenderTop = topStage(defender.active)

      let confusedSelfHit = false
      if (attacker.active.status.special === 'confused') {
        if (flipCoin() === 'tails') {
          attacker.active.damage += 30
          confusedSelfHit = true
          log(
            state,
            'system',
            `${topStage(attacker.active).name} ist verwirrt, trifft sich selbst (30 Schaden) und die Attacke schlägt fehl.`,
          )
        }
      }

      attacker.attackedThisTurn = true

      if (!confusedSelfHit) {
        const superEffective = !!defenderTop.weakness && defenderTop.weakness === attackerType
        const resisted = !!defenderTop.resistance && defenderTop.resistance === attackerType
        let damage = superEffective ? attack.damage * 2 : attack.damage
        if (resisted) damage = Math.max(0, damage - 30)
        damage = applyAttackEffects(state, attackerSide, defenderSide, attack.effects, damage)

        defender.active.damage += damage
        state.lastEvent = { type: 'attack', side: attackerSide, damage, superEffective }
        log(
          state,
          attackerSide,
          `${topStage(attacker.active).name} setzt ${attack.name} ein und verursacht ${damage} Schaden${superEffective ? ' (super effektiv!)' : ''}${resisted ? ' (Resistenz!)' : ''}.`,
        )
      }

      if (attacker.active && currentHp(attacker.active) <= 0 && state.winner === null) {
        knockOut(state, attackerSide)
      }
      if (state.winner === null && defender.active && currentHp(defender.active) <= 0) {
        knockOut(state, defenderSide)
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
