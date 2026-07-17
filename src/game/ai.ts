import { attackIsUsable } from './engine'
import type { GameAction, GameState, InPlayPokemon, Side } from './types'

function topStage(mon: InPlayPokemon) {
  return mon.stages[mon.stages.length - 1]
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
