import { beforeEach, describe, expect, it } from 'vitest'
import { decideAiSetupAction, decideNextAiAction } from '../ai'
import { makeEnergy, makePokemon, resetUidCounter } from '../../test/fixtures'
import { baseState, makeInPlay, makePlayer } from '../../test/gameState'

beforeEach(() => resetUidCounter())

describe('decideAiSetupAction', () => {
  it('returns null once the side is already ready', () => {
    const state = baseState({ setupReady: { p1: true, p2: true } })
    expect(decideAiSetupAction(state, 'p2')).toBeNull()
  })

  it('places a basic Pokémon as active when none is set', () => {
    const basic = makePokemon({ stage: 'basic' })
    const state = baseState({
      setupReady: { p1: false, p2: false },
      players: { p1: makePlayer('p1'), p2: makePlayer('p2', { hand: [basic] }) },
    })
    const action = decideAiSetupAction(state, 'p2')
    expect(action).toEqual({ type: 'SETUP_PLACE_ACTIVE', side: 'p2', handUid: basic.uid })
  })

  it('benches basics once active is set and bench has room', () => {
    const active = makePokemon({ name: 'Active', stage: 'basic' })
    const benchable = makePokemon({ name: 'Benchable', stage: 'basic' })
    const state = baseState({
      setupReady: { p1: false, p2: false },
      players: {
        p1: makePlayer('p1'),
        p2: makePlayer('p2', { active: makeInPlay(active), hand: [benchable] }),
      },
    })
    const action = decideAiSetupAction(state, 'p2')
    expect(action).toEqual({ type: 'SETUP_PLACE_BENCH', side: 'p2', handUid: benchable.uid })
  })

  it('declares ready once active is set, bench is full, or hand has no more basics', () => {
    const active = makePokemon({ name: 'Active', stage: 'basic' })
    const state = baseState({
      setupReady: { p1: false, p2: false },
      players: { p1: makePlayer('p1'), p2: makePlayer('p2', { active: makeInPlay(active), hand: [] }) },
    })
    expect(decideAiSetupAction(state, 'p2')).toEqual({ type: 'SETUP_READY', side: 'p2' })
  })
})

describe('decideNextAiAction', () => {
  it('returns null outside the main phase', () => {
    const state = baseState({ phase: 'setup' })
    expect(decideNextAiAction(state, 'p2')).toBeNull()
  })

  it('promotes from bench when active fainted, even off-turn', () => {
    const weakBench = makeInPlay(makePokemon({ name: 'Weak', hp: 60 }), { damage: 40 })
    const strongBench = makeInPlay(makePokemon({ name: 'Strong', hp: 60 }), { damage: 0 })
    const state = baseState({
      activeSide: 'p1',
      players: {
        p1: makePlayer('p1'),
        p2: makePlayer('p2', { active: null, bench: [weakBench, strongBench] }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'PROMOTE', side: 'p2', benchInstanceId: strongBench.instanceId })
  })

  it('returns null when active is null and bench is empty', () => {
    const state = baseState({ players: { p1: makePlayer('p1'), p2: makePlayer('p2', { active: null, bench: [] }) } })
    expect(decideNextAiAction(state, 'p2')).toBeNull()
  })

  it('returns null when it is not this side turn', () => {
    const state = baseState({
      activeSide: 'p1',
      players: {
        p1: makePlayer('p1'),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon()) }),
      },
    })
    expect(decideNextAiAction(state, 'p2')).toBeNull()
  })

  it('plays a basic from hand to the bench when there is room', () => {
    const basic = makePokemon({ stage: 'basic' })
    const state = baseState({
      activeSide: 'p2',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon()), hand: [basic] }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'PLAY_BENCH', side: 'p2', handUid: basic.uid })
  })

  it('evolves a Pokémon in play when a matching evolution is in hand', () => {
    const activeBasic = makePokemon({ name: 'Basicmon', stage: 'basic' })
    const evo = makePokemon({ name: 'Evo', stage: 'stage1', evolvesFrom: 'Basicmon' })
    const activeMon = makeInPlay(activeBasic, { enteredPlayTurn: 0 })
    const state = baseState({
      turnNumber: 5,
      activeSide: 'p2',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: activeMon, hand: [evo] }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({
      type: 'EVOLVE',
      side: 'p2',
      handUid: evo.uid,
      targetInstanceId: activeMon.instanceId,
    })
  })

  it('does not evolve a Pokémon that entered play this same turn', () => {
    const activeBasic = makePokemon({ name: 'Basicmon', stage: 'basic' })
    const evo = makePokemon({ name: 'Evo', stage: 'stage1', evolvesFrom: 'Basicmon' })
    const activeMon = makeInPlay(activeBasic, { enteredPlayTurn: 5 })
    const state = baseState({
      turnNumber: 5,
      activeSide: 'p2',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: activeMon, hand: [evo] }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).not.toMatchObject({ type: 'EVOLVE' })
  })

  it('attaches energy that matches a needed attack cost over a mismatched one', () => {
    const activeCard = makePokemon({
      attacks: [{ name: 'Big', cost: ['Water'], damage: 50, text: '' }],
    })
    const fireEnergy = makeEnergy({ name: 'Fire Energy', energyType: 'Fire' })
    const waterEnergy = makeEnergy({ name: 'Water Energy', energyType: 'Water' })
    const state = baseState({
      activeSide: 'p2',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: makeInPlay(activeCard), hand: [fireEnergy, waterEnergy] }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({
      type: 'ATTACH_ENERGY',
      side: 'p2',
      handUid: waterEnergy.uid,
      targetInstanceId: state.players.p2.active!.instanceId,
    })
  })

  it('attacks with the strongest usable attack when able', () => {
    const activeCard = makePokemon({
      attacks: [
        { name: 'Weak', cost: [], damage: 10, text: '' },
        { name: 'Strong', cost: [], damage: 40, text: '' },
      ],
    })
    const state = baseState({
      activeSide: 'p2',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: makeInPlay(activeCard), hasAttachedEnergyThisTurn: true }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'ATTACK', side: 'p2', attackIndex: 1 })
  })

  it('retreats a low-HP active Pokémon for a healthier bench Pokémon', () => {
    const activeCard = makePokemon({ hp: 100, retreatCost: 0, attacks: [] })
    const activeMon = makeInPlay(activeCard, { damage: 90 })
    const healthyBench = makeInPlay(makePokemon({ name: 'Healthy', hp: 100 }), { damage: 0 })
    const state = baseState({
      activeSide: 'p2',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: activeMon, bench: [healthyBench], hasAttachedEnergyThisTurn: true }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'RETREAT', side: 'p2', benchInstanceId: healthyBench.instanceId })
  })

  it('ends the turn when there is nothing productive left to do', () => {
    const activeCard = makePokemon({ hp: 100, attacks: [] })
    const state = baseState({
      activeSide: 'p2',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: makeInPlay(activeCard), hasAttachedEnergyThisTurn: true }),
      },
    })
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'END_TURN', side: 'p2' })
  })
})
