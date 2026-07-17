import { describe, expect, it } from 'vitest'
import { decideAiSetupAction, decideNextAiAction } from './ai'
import { createInitialState } from './engine'
import { FALLBACK_POOL } from '../api/fallbackCards'
import { cloneWithUid } from './deckBuilder'
import type { CardDef, GameState, PokemonCardDef } from './types'

const charmander = FALLBACK_POOL.find((c) => c.id === 'offline-46')! as PokemonCardDef
const charmeleon = FALLBACK_POOL.find((c) => c.id === 'offline-24')! as PokemonCardDef
const squirtle = FALLBACK_POOL.find((c) => c.id === 'offline-63')! as PokemonCardDef
const fireEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-98')!

function deckOf(cards: CardDef[], size = 20): CardDef[] {
  const out = cards.map((c) => cloneWithUid(c))
  while (out.length < size) out.push(cloneWithUid(fireEnergy))
  return out
}

function freshState(): GameState {
  return createInitialState('local', 'p1', deckOf([charmander, charmeleon, fireEnergy, fireEnergy]), deckOf([squirtle, fireEnergy]))
}

describe('decideAiSetupAction', () => {
  it('places a basic Pokémon as active when none is set', () => {
    const state = freshState()
    const action = decideAiSetupAction(state, 'p2')
    expect(action?.type).toBe('SETUP_PLACE_ACTIVE')
  })

  it('returns null once the side is already marked ready', () => {
    const state = freshState()
    state.setupReady.p2 = true
    expect(decideAiSetupAction(state, 'p2')).toBeNull()
  })

  it('declares setup ready once active is set and no more basics are in hand', () => {
    const state = freshState()
    state.players.p2.active = { instanceId: 'i1', stages: [squirtle], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] }
    state.players.p2.hand = state.players.p2.hand.filter((c) => c.kind !== 'pokemon' || c.stage !== 'basic')
    const action = decideAiSetupAction(state, 'p2')
    expect(action?.type).toBe('SETUP_READY')
  })
})

describe('decideNextAiAction', () => {
  it('returns null outside the main phase', () => {
    const state = freshState()
    expect(decideNextAiAction(state, 'p2')).toBeNull()
  })

  it('promotes from bench when active is empty, even off-turn, picking the healthiest bench mon', () => {
    const state = freshState()
    state.phase = 'main'
    state.activeSide = 'p1'
    state.players.p2.active = null
    state.players.p2.bench = [
      { instanceId: 'low', stages: [squirtle], damage: 40, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] },
      { instanceId: 'high', stages: [squirtle], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] },
    ]
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'PROMOTE', side: 'p2', benchInstanceId: 'high' })
  })

  it('returns null when it is not this side\'s turn and it already has an active', () => {
    const state = freshState()
    state.phase = 'main'
    state.activeSide = 'p1'
    state.players.p2.active = { instanceId: 'i1', stages: [squirtle], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] }
    expect(decideNextAiAction(state, 'p2')).toBeNull()
  })

  it('plays a basic from hand onto the bench when there is room', () => {
    const state = freshState()
    state.phase = 'main'
    state.activeSide = 'p2'
    state.turnNumber = 1
    state.players.p2.active = { instanceId: 'i1', stages: [squirtle], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] }
    state.players.p2.hand = [cloneWithUid(charmander)]
    const action = decideNextAiAction(state, 'p2')
    expect(action?.type).toBe('PLAY_BENCH')
  })

  it('attaches energy that matches the active Pokémon\'s attack cost', () => {
    const state = freshState()
    state.phase = 'main'
    state.activeSide = 'p2'
    state.turnNumber = 1
    state.players.p2.active = { instanceId: 'i1', stages: [squirtle], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] }
    state.players.p2.hand = [cloneWithUid(fireEnergy)]
    const action = decideNextAiAction(state, 'p2')
    expect(action).toMatchObject({ type: 'ATTACH_ENERGY', side: 'p2', targetInstanceId: 'i1' })
  })

  it('attacks with the strongest usable attack when able', () => {
    const state = freshState()
    state.phase = 'main'
    state.activeSide = 'p2'
    state.turnNumber = 1
    state.players.p2.active = {
      instanceId: 'i1',
      stages: [squirtle],
      damage: 0,
      attachedEnergy: [cloneWithUid(fireEnergy) as never],
      enteredPlayTurn: 0,
      evolvedOnTurn: null,
      statuses: [],
    }
    // Give it Water energy so its Water Gun attack (cost: Water) is payable.
    const waterEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-102')!
    state.players.p2.active!.attachedEnergy = [cloneWithUid(waterEnergy) as never]
    state.players.p2.hand = []
    state.players.p1.active = { instanceId: 'opp', stages: [charmander], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] }
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'ATTACK', side: 'p2', attackIndex: 0 })
  })

  it('ends the turn when there is nothing productive left to do', () => {
    const state = freshState()
    state.phase = 'main'
    state.activeSide = 'p2'
    state.turnNumber = 1
    state.players.p2.active = { instanceId: 'i1', stages: [squirtle], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] }
    state.players.p2.bench = Array(5).fill(null).map((_, i) => ({
      instanceId: `b${i}`,
      stages: [squirtle],
      damage: 0,
      attachedEnergy: [],
      enteredPlayTurn: 0,
      evolvedOnTurn: null,
      statuses: [],
    }))
    state.players.p2.hand = []
    state.players.p1.active = { instanceId: 'opp', stages: [charmander], damage: 0, attachedEnergy: [], enteredPlayTurn: 0, evolvedOnTurn: null, statuses: [] }
    const action = decideNextAiAction(state, 'p2')
    expect(action).toEqual({ type: 'END_TURN', side: 'p2' })
  })
})
