import { attackIsUsable } from './engine'
import { getTrainerEffect, trainerIsPlayable } from './trainers'
import { getPokemonPower, rainDanceTargets, usablePowerSources } from './powers'
import type { GameAction, GameState, InPlayPokemon, Side } from './types'

function topStage(mon: InPlayPokemon) {
  return mon.stages[mon.stages.length - 1]
}

function currentHp(mon: InPlayPokemon): number {
  return Math.max(0, topStage(mon).hp - mon.damage)
}

/**
 * Wählt einen sinnvollen Trainer-Zug oder `null`. Es werden ausschließlich
 * Aktionen zurückgegeben, die die Engine garantiert akzeptiert (spielbar +
 * gültiges Ziel), damit die KI-Schleife nie an einer No-Op hängen bleibt.
 */
function decideAiTrainer(state: GameState, side: Side): GameAction | null {
  const player = state.players[side]
  const opp = state.players[side === 'p1' ? 'p2' : 'p1']
  const active = player.active
  if (!active) return null

  const trainers = player.hand.filter((c) => c.kind === 'trainer' && getTrainerEffect(c))
  const find = (id: string) =>
    trainers.find((c) => getTrainerEffect(c)?.id === id && trainerIsPlayable(state, side, c))

  const disablingStatus = active.statuses.some((s) => s === 'asleep' || s === 'paralyzed' || s === 'confused')

  // Aktiven Zustand heilen: erst Vollheilung (behält das Pokémon), sonst Wechsel.
  if (disablingStatus) {
    const fullHeal = find('fullHeal')
    if (fullHeal) return { type: 'PLAY_TRAINER', side, handUid: fullHeal.uid, targetInstanceId: active.instanceId }
    const sw = find('switch')
    if (sw && player.bench.length > 0) {
      const target = [...player.bench].sort((a, b) => currentHp(b) - currentHp(a))[0]
      return { type: 'PLAY_TRAINER', side, handUid: sw.uid, targetInstanceId: target.instanceId }
    }
  }

  // Aktives Pokémon heilen, wenn es genug Schaden hat.
  if (active.damage >= 30 && active.attachedEnergy.length > 0) {
    const superPotion = find('superPotion')
    if (superPotion) return { type: 'PLAY_TRAINER', side, handUid: superPotion.uid, targetInstanceId: active.instanceId }
  }
  if (active.damage >= 20) {
    const potion = find('potion')
    if (potion) return { type: 'PLAY_TRAINER', side, handUid: potion.uid, targetInstanceId: active.instanceId }
  }

  // Gegnerische Energie stören, wenn das aktive Pokémon des Gegners geladen ist.
  if (opp.active && opp.active.attachedEnergy.length >= 2) {
    const removal = find('energyRemoval')
    if (removal) return { type: 'PLAY_TRAINER', side, handUid: removal.uid, targetInstanceId: opp.active.instanceId }
  }

  // PlusPower vor einem Angriff, falls das aktive Pokämon zuschlagen kann.
  const hasUsableDamageAttack = topStage(active).attacks.some(
    (atk, idx) => atk.damage > 0 && attackIsUsable(active, idx, state.turnNumber),
  )
  if (hasUsableDamageAttack) {
    const plusPower = find('plusPower')
    if (plusPower) return { type: 'PLAY_TRAINER', side, handUid: plusPower.uid }
  }

  // Karten nachziehen.
  const nonTrainerHand = player.hand.filter((c) => c.kind !== 'trainer').length
  if (nonTrainerHand <= 3 && player.deck.length >= 7) {
    const oak = find('oak')
    if (oak) return { type: 'PLAY_TRAINER', side, handUid: oak.uid }
  }
  if (player.deck.length >= 3) {
    const bill = find('bill')
    if (bill) return { type: 'PLAY_TRAINER', side, handUid: bill.uid }
  }

  // Energie nachlegen, wenn keine Energie auf der Hand ist.
  const hasEnergyInHand = player.hand.some((c) => c.kind === 'energy')
  if (!hasEnergyInHand) {
    const energySearch = find('energySearch')
    if (energySearch) return { type: 'PLAY_TRAINER', side, handUid: energySearch.uid }
  }

  // Bank wieder auffüllen, wenn sie dünn ist.
  if (player.bench.length < 2) {
    const revive = find('revive')
    if (revive) return { type: 'PLAY_TRAINER', side, handUid: revive.uid }
  }

  return null
}

export function decideAiSetupAction(state: GameState, side: Side): GameAction | null {
  const player = state.players[side]
  if (state.setupReady[side]) return null

  if (!player.active) {
    const basic = player.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')
    if (basic) return { type: 'SETUP_PLACE_ACTIVE', side, handUid: basic.uid }
    return { type: 'SETUP_READY', side }
  }

  if (player.bench.length < 5) {
    const basic = player.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')
    if (basic) return { type: 'SETUP_PLACE_BENCH', side, handUid: basic.uid }
  }

  return { type: 'SETUP_READY', side }
}

/**
 * Nutzt eine Poké-Power, wenn sinnvoll (aktuell Regentanz: extra Wasser-Energie
 * an ein Wasser-Pokémon). Gibt nur garantiert gültige Aktionen zurück.
 */
function decideAiPower(state: GameState, side: Side): GameAction | null {
  const player = state.players[side]
  for (const source of usablePowerSources(state, side)) {
    const def = getPokemonPower(topStage(source))
    if (def?.id !== 'rainDance') continue
    const waterEnergy = player.hand.find(
      (c) => c.kind === 'energy' && c.isBasicEnergy && c.energyType === 'Water',
    )
    if (!waterEnergy) continue
    const targets = rainDanceTargets(state, side)
    // Bevorzuge das aktive Pokémon, sonst das Wasser-Pokémon mit der wenigsten Energie.
    const target =
      targets.find((m) => m.instanceId === player.active?.instanceId) ??
      [...targets].sort((a, b) => a.attachedEnergy.length - b.attachedEnergy.length)[0]
    if (target) {
      return {
        type: 'USE_POWER',
        side,
        sourceInstanceId: source.instanceId,
        targetInstanceId: target.instanceId,
        energyUid: waterEnergy.uid,
      }
    }
  }
  return null
}

export function decideNextAiAction(state: GameState, side: Side): GameAction | null {
  if (state.phase !== 'main') return null
  const player = state.players[side]

  // Promoting a new active is not restricted to your own turn (e.g. after a
  // between-turns status knockout), so this check runs before the turn gate.
  if (!player.active) {
    if (player.bench.length === 0) return null
    const best = [...player.bench].sort(
      (a, b) => b.stages[b.stages.length - 1].hp - b.damage - (a.stages[a.stages.length - 1].hp - a.damage),
    )[0]
    return { type: 'PROMOTE', side, benchInstanceId: best.instanceId }
  }

  if (state.activeSide !== side) return null

  if (player.bench.length < 5) {
    const basic = player.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')
    if (basic) return { type: 'PLAY_BENCH', side, handUid: basic.uid }
  }

  const monsInPlay = [player.active, ...player.bench]
  for (const mon of monsInPlay) {
    if (mon.enteredPlayTurn === state.turnNumber) continue
    const evo = player.hand.find(
      (c) => c.kind === 'pokemon' && c.stage === 'stage1' && c.evolvesFrom === topStage(mon).name,
    )
    if (evo) return { type: 'EVOLVE', side, handUid: evo.uid, targetInstanceId: mon.instanceId }
  }

  const trainerAction = decideAiTrainer(state, side)
  if (trainerAction) return trainerAction

  const powerAction = decideAiPower(state, side)
  if (powerAction) return powerAction

  if (!player.hasAttachedEnergyThisTurn) {
    const energyCards = player.hand.filter((c) => c.kind === 'energy')
    if (energyCards.length > 0) {
      const activeCanAlreadyAttack = topStage(player.active).attacks.some((_, idx) =>
        attackIsUsable(player.active!, idx, state.turnNumber),
      )
      const target = activeCanAlreadyAttack
        ? (player.bench.find((m) => m.attachedEnergy.length === 0) ?? player.active)
        : player.active
      const neededTypes = new Set(topStage(target).attacks.flatMap((a) => a.cost))
      const bestFit = energyCards.find((c) => c.kind === 'energy' && neededTypes.has(c.energyType))
      const energyCard = bestFit ?? energyCards[0]
      return { type: 'ATTACH_ENERGY', side, handUid: energyCard.uid, targetInstanceId: target.instanceId }
    }
  }

  const usableAttacks = topStage(player.active).attacks
    .map((attack, idx) => ({ attack, idx }))
    .filter(({ idx }) => attackIsUsable(player.active!, idx, state.turnNumber))

  if (usableAttacks.length > 0) {
    const best = usableAttacks.sort((a, b) => b.attack.damage - a.attack.damage)[0]
    return { type: 'ATTACK', side, attackIndex: best.idx }
  }

  const activeHp = topStage(player.active).hp - player.active.damage
  const activeMaxHp = topStage(player.active).hp
  const retreatCost = topStage(player.active).retreatCost
  const canRetreat = !player.active.statuses.includes('asleep') && !player.active.statuses.includes('paralyzed')
  if (
    canRetreat &&
    !player.hasRetreatedThisTurn &&
    activeHp / activeMaxHp <= 0.35 &&
    player.active.attachedEnergy.length >= retreatCost &&
    player.bench.length > 0
  ) {
    const healthier = [...player.bench].sort((a, b) => {
      const hpA = topStage(a).hp - a.damage
      const hpB = topStage(b).hp - b.damage
      return hpB - hpA
    })[0]
    if (topStage(healthier).hp - healthier.damage > activeHp) {
      return { type: 'RETREAT', side, benchInstanceId: healthier.instanceId }
    }
  }

  return { type: 'END_TURN', side }
}
