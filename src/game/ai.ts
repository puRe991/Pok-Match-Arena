import { BENCH_SIZE } from './constants'
import { attackIsUsable } from './engine'
import type { GameAction, GameState, InPlayPokemon, Side, TrainerCardDef } from './types'

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

  if (player.bench.length < BENCH_SIZE) {
    const basic = player.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')
    if (basic) return { type: 'SETUP_PLACE_BENCH', side, handUid: basic.uid }
  }

  return { type: 'SETUP_READY', side }
}

function canRetreatNow(mon: InPlayPokemon): boolean {
  return mon.status.special !== 'asleep' && mon.status.special !== 'paralyzed'
}

function findEvolution(state: GameState, side: Side, mon: InPlayPokemon) {
  const player = state.players[side]
  if (mon.enteredPlayTurn === state.turnNumber) return null
  const currentStage = topStage(mon).stage
  const wantedStage = currentStage === 'basic' ? 'stage1' : currentStage === 'stage1' ? 'stage2' : null
  if (!wantedStage) return null
  return player.hand.find(
    (c) => c.kind === 'pokemon' && c.stage === wantedStage && c.evolvesFrom === topStage(mon).name,
  )
}

function decideTrainerPlay(state: GameState, side: Side): GameAction | null {
  const player = state.players[side]
  const trainers = player.hand.filter((c): c is TrainerCardDef => c.kind === 'trainer')

  const healCard = trainers.find(
    (c) => c.effects.some((e) => e.kind === 'heal') && player.active && player.active.damage > 0,
  )
  if (healCard) return { type: 'PLAY_TRAINER', side, handUid: healCard.uid }

  const energyCard = trainers.find((c) => c.effects.some((e) => e.kind === 'searchDeckForEnergy'))
  if (energyCard && player.active && !player.hand.some((c) => c.kind === 'energy')) {
    return { type: 'PLAY_TRAINER', side, handUid: energyCard.uid }
  }

  if (!player.supporterPlayedThisTurn) {
    const drawCard = trainers.find(
      (c) => c.trainerType === 'supporter' && c.effects.some((e) => e.kind === 'drawCards' || e.kind === 'handRefresh'),
    )
    if (drawCard && player.hand.length <= 4) return { type: 'PLAY_TRAINER', side, handUid: drawCard.uid }
  }

  return null
}

export function decideNextAiAction(state: GameState, side: Side): GameAction | null {
  if (state.phase !== 'main' || state.activeSide !== side) return null
  const player = state.players[side]

  if (!player.active) {
    if (player.bench.length === 0) return null
    const best = [...player.bench].sort(
      (a, b) => b.stages[b.stages.length - 1].hp - b.damage - (a.stages[a.stages.length - 1].hp - a.damage),
    )[0]
    return { type: 'PROMOTE', side, benchInstanceId: best.instanceId }
  }

  if (player.bench.length < BENCH_SIZE) {
    const basic = player.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')
    if (basic) return { type: 'PLAY_BENCH', side, handUid: basic.uid }
  }

  if (state.turnNumber > 1) {
    const monsInPlay = [player.active, ...player.bench]
    for (const mon of monsInPlay) {
      const evo = findEvolution(state, side, mon)
      if (evo) return { type: 'EVOLVE', side, handUid: evo.uid, targetInstanceId: mon.instanceId }
    }
  }

  const trainerAction = decideTrainerPlay(state, side)
  if (trainerAction) return trainerAction

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
  if (
    !player.hasRetreatedThisTurn &&
    canRetreatNow(player.active) &&
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
