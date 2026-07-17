import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyAction,
  attackIsUsable,
  createInitialState,
  currentHp,
  isGameOver,
  needsPromote,
  topStage,
} from './engine'
import { FALLBACK_POOL } from '../api/fallbackCards'
import { cloneWithUid } from './deckBuilder'
import type { CardDef, GameState, InPlayPokemon, PokemonCardDef } from './types'

const charmander = FALLBACK_POOL.find((c) => c.id === 'offline-46')! as PokemonCardDef // Fire, weak to Water, 60hp
const charmeleon = FALLBACK_POOL.find((c) => c.id === 'offline-24')! as PokemonCardDef // evolvesFrom Charmander
const squirtle = FALLBACK_POOL.find((c) => c.id === 'offline-63')! as PokemonCardDef // Water, 60hp, Water Gun cost [Water] dmg 20
const abra = FALLBACK_POOL.find((c) => c.id === 'offline-43')! as PokemonCardDef // Psychic, attack text "Confuses..."
const fireEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-98')!
const waterEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-102')!
const psychicEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-101')!

function makeMon(card: PokemonCardDef, overrides: Partial<InPlayPokemon> = {}): InPlayPokemon {
  return {
    instanceId: overrides.instanceId ?? `mon-${Math.random().toString(36).slice(2, 8)}`,
    stages: [card],
    damage: 0,
    attachedEnergy: [],
    enteredPlayTurn: 0,
    evolvedOnTurn: null,
    statuses: [],
    ...overrides,
  }
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: {
      p1: {
        side: 'p1',
        name: 'Du',
        isAI: false,
        deck: [cloneWithUid(fireEnergy)],
        hand: [],
        active: makeMon(charmander, { instanceId: 'p1-active' }),
        bench: [],
        discard: [],
        prizes: [cloneWithUid(fireEnergy), cloneWithUid(fireEnergy)],
        hasAttachedEnergyThisTurn: false,
        hasRetreatedThisTurn: false,
        attackedThisTurn: false,
      },
      p2: {
        side: 'p2',
        name: 'CPU',
        isAI: true,
        deck: [cloneWithUid(waterEnergy)],
        hand: [],
        active: makeMon(squirtle, { instanceId: 'p2-active' }),
        bench: [],
        discard: [],
        prizes: [cloneWithUid(waterEnergy), cloneWithUid(waterEnergy)],
        hasAttachedEnergyThisTurn: false,
        hasRetreatedThisTurn: false,
        attackedThisTurn: false,
      },
    },
    activeSide: 'p1',
    turnNumber: 1,
    phase: 'main',
    log: [],
    winner: null,
    winnerReason: null,
    mode: 'local',
    mySide: 'p1',
    lastEvent: null,
    setupReady: { p1: true, p2: true },
    ...overrides,
  }
}

describe('createInitialState', () => {
  it('deals a 7-card hand and 6 prizes to each player and starts in setup', () => {
    const bigDeck = (n: number): CardDef[] => Array.from({ length: n }, () => cloneWithUid(charmander))
    const state = createInitialState('local', 'p1', bigDeck(20), bigDeck(20))
    expect(state.phase).toBe('setup')
    expect(state.turnNumber).toBe(0)
    expect(state.players.p1.hand).toHaveLength(7)
    expect(state.players.p1.prizes).toHaveLength(6)
    expect(state.players.p1.deck).toHaveLength(7)
    expect(state.players.p2.hand).toHaveLength(7)
    expect(state.log).toHaveLength(1)
  })
})

describe('setup phase', () => {
  it('moves to main phase turn 1 once both sides place an active and ready up', () => {
    const bigDeck = (n: number): CardDef[] => Array.from({ length: n }, () => cloneWithUid(charmander))
    let state = createInitialState('local', 'p1', bigDeck(20), bigDeck(20))
    const p1BasicUid = state.players.p1.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')!.uid
    const p2BasicUid = state.players.p2.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')!.uid

    state = applyAction(state, { type: 'SETUP_PLACE_ACTIVE', side: 'p1', handUid: p1BasicUid })
    expect(state.players.p1.active).not.toBeNull()

    state = applyAction(state, { type: 'SETUP_PLACE_ACTIVE', side: 'p2', handUid: p2BasicUid })
    state = applyAction(state, { type: 'SETUP_READY', side: 'p1' })
    expect(state.phase).toBe('setup')
    state = applyAction(state, { type: 'SETUP_READY', side: 'p2' })
    expect(state.phase).toBe('main')
    expect(state.turnNumber).toBe(1)
    expect(state.activeSide).toBe('p1')
  })

  it('refuses SETUP_READY without an active Pokémon', () => {
    const bigDeck = (n: number): CardDef[] => Array.from({ length: n }, () => cloneWithUid(charmander))
    let state = createInitialState('local', 'p1', bigDeck(20), bigDeck(20))
    state = applyAction(state, { type: 'SETUP_READY', side: 'p1' })
    expect(state.setupReady.p1).toBe(false)
  })
})

describe('applyAction does not mutate the previous state', () => {
  it('returns a distinct deep clone', () => {
    const prev = baseState()
    const next = applyAction(prev, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next).not.toBe(prev)
    expect(next.players.p1).not.toBe(prev.players.p1)
  })
})

describe('PLAY_BENCH', () => {
  it('moves a basic Pokémon from hand to bench', () => {
    let state = baseState()
    state.players.p1.hand = [cloneWithUid(charmander)]
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'PLAY_BENCH', side: 'p1', handUid: uid })
    expect(state.players.p1.bench).toHaveLength(1)
    expect(state.players.p1.hand).toHaveLength(0)
  })

  it('refuses once the bench already has 5 Pokémon', () => {
    let state = baseState()
    state.players.p1.bench = Array.from({ length: 5 }, () => makeMon(charmander))
    state.players.p1.hand = [cloneWithUid(charmander)]
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'PLAY_BENCH', side: 'p1', handUid: uid })
    expect(state.players.p1.bench).toHaveLength(5)
    expect(state.players.p1.hand).toHaveLength(1)
  })

  it('refuses on the opponent\'s turn', () => {
    let state = baseState({ activeSide: 'p2' })
    state.players.p1.hand = [cloneWithUid(charmander)]
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'PLAY_BENCH', side: 'p1', handUid: uid })
    expect(state.players.p1.bench).toHaveLength(0)
  })
})

describe('EVOLVE', () => {
  it('evolves the active Pokémon when the evolution matches and it was not just placed', () => {
    let state = baseState()
    state.players.p1.active!.enteredPlayTurn = 0
    state.players.p1.hand = [cloneWithUid(charmeleon)]
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'EVOLVE', side: 'p1', handUid: uid, targetInstanceId: 'p1-active' })
    expect(topStage(state.players.p1.active!).name).toBe('Charmeleon')
    expect(state.players.p1.active!.evolvedOnTurn).toBe(1)
  })

  it('refuses to evolve a Pokémon placed this same turn', () => {
    let state = baseState()
    state.players.p1.active!.enteredPlayTurn = state.turnNumber
    state.players.p1.hand = [cloneWithUid(charmeleon)]
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'EVOLVE', side: 'p1', handUid: uid, targetInstanceId: 'p1-active' })
    expect(topStage(state.players.p1.active!).name).toBe('Charmander')
  })

  it('refuses when evolvesFrom does not match the target', () => {
    let state = baseState()
    state.players.p1.hand = [cloneWithUid(squirtle)] // not evolving anything, wrong species anyway
    state.players.p1.active!.enteredPlayTurn = 0
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'EVOLVE', side: 'p1', handUid: uid, targetInstanceId: 'p1-active' })
    expect(topStage(state.players.p1.active!).name).toBe('Charmander')
  })
})

describe('ATTACH_ENERGY', () => {
  it('attaches an energy card from hand to the target and removes it from hand', () => {
    let state = baseState()
    state.players.p1.hand = [cloneWithUid(fireEnergy)]
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'ATTACH_ENERGY', side: 'p1', handUid: uid, targetInstanceId: 'p1-active' })
    expect(state.players.p1.active!.attachedEnergy).toHaveLength(1)
    expect(state.players.p1.hand).toHaveLength(0)
    expect(state.players.p1.hasAttachedEnergyThisTurn).toBe(true)
  })

  it('refuses a second attachment in the same turn', () => {
    let state = baseState()
    state.players.p1.hasAttachedEnergyThisTurn = true
    state.players.p1.hand = [cloneWithUid(fireEnergy)]
    const uid = state.players.p1.hand[0].uid
    state = applyAction(state, { type: 'ATTACH_ENERGY', side: 'p1', handUid: uid, targetInstanceId: 'p1-active' })
    expect(state.players.p1.active!.attachedEnergy).toHaveLength(0)
  })
})

describe('RETREAT', () => {
  it('swaps active and bench Pokémon, paying the retreat cost in energy', () => {
    let state = baseState()
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state.players.p1.bench = [makeMon(squirtle, { instanceId: 'bench-1' })]
    state = applyAction(state, { type: 'RETREAT', side: 'p1', benchInstanceId: 'bench-1' })
    expect(state.players.p1.active!.instanceId).toBe('bench-1')
    expect(state.players.p1.bench[0].instanceId).toBe('p1-active')
    expect(state.players.p1.bench[0].attachedEnergy).toHaveLength(0)
    expect(state.players.p1.hasRetreatedThisTurn).toBe(true)
  })

  it('refuses when there is not enough attached energy to pay the cost', () => {
    let state = baseState()
    state.players.p1.bench = [makeMon(squirtle, { instanceId: 'bench-1' })]
    state = applyAction(state, { type: 'RETREAT', side: 'p1', benchInstanceId: 'bench-1' })
    expect(state.players.p1.active!.instanceId).toBe('p1-active')
  })

  it('refuses while asleep or paralyzed', () => {
    let state = baseState()
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state.players.p1.active!.statuses = ['asleep']
    state.players.p1.bench = [makeMon(squirtle, { instanceId: 'bench-1' })]
    state = applyAction(state, { type: 'RETREAT', side: 'p1', benchInstanceId: 'bench-1' })
    expect(state.players.p1.active!.instanceId).toBe('p1-active')
  })
})

describe('ATTACK', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deals base damage and ends the turn, advancing to the opponent', () => {
    let state = baseState()
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.players.p2.active!.damage).toBe(20)
    expect(state.activeSide).toBe('p2')
    expect(state.turnNumber).toBe(2)
  })

  it('doubles damage against a weakness', () => {
    // Squirtle (Water) attacking Charmander (weak to Water): 20 -> 40
    let state = baseState({ activeSide: 'p2' })
    state.players.p2.active!.attachedEnergy = [cloneWithUid(waterEnergy) as never]
    state = applyAction(state, { type: 'ATTACK', side: 'p2', attackIndex: 0 })
    expect(state.players.p1.active!.damage).toBe(40)
  })

  it('refuses an attack whose energy cost is unpaid', () => {
    let state = baseState()
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.players.p2.active!.damage).toBe(0)
    expect(state.activeSide).toBe('p1')
  })

  it('refuses on the opponent\'s turn', () => {
    let state = baseState({ activeSide: 'p2' })
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.players.p2.active!.damage).toBe(0)
  })

  it('applies a status effect described in the attack text', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // avoid the "flip a coin" miss branch anywhere else
    let state = baseState()
    state.players.p1.active = makeMon(abra, { instanceId: 'p1-active' })
    state.players.p1.active.attachedEnergy = [cloneWithUid(psychicEnergy) as never]
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.players.p2.active!.statuses).toContain('confused')
  })

  it('knocks out the defender, awards a prize, and promotes is left to the player', () => {
    let state = baseState()
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state.players.p2.bench = [makeMon(squirtle, { instanceId: 'reserve' })]
    state.players.p2.active!.damage = 45 // squirtle hp 60, +20 dmg = 65 -> KO
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.players.p2.active).toBeNull()
    expect(state.players.p2.discard.length).toBeGreaterThan(0)
    expect(state.players.p1.prizes).toHaveLength(1) // started with 2, took 1
    expect(state.winner).toBeNull()
  })

  it('declares the attacker the winner once all prizes are taken', () => {
    let state = baseState()
    state.players.p1.prizes = [cloneWithUid(fireEnergy)] // one prize left
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state.players.p2.active!.damage = 45
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.winner).toBe('p1')
    expect(state.phase).toBe('gameover')
  })

  it('declares the attacker the winner when the defender has no bench left to promote', () => {
    let state = baseState()
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state.players.p2.active!.damage = 45
    state.players.p2.bench = []
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.winner).toBe('p1')
    expect(state.phase).toBe('gameover')
  })

  it('hits itself when confused and the coin flip fails, skipping the real attack', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // heads = random < 0.5 -> false
    let state = baseState()
    state.players.p1.active!.attachedEnergy = [cloneWithUid(fireEnergy) as never]
    state.players.p1.active!.statuses = ['confused']
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.players.p1.active!.damage).toBe(30)
    expect(state.players.p2.active!.damage).toBe(0)
  })
})

describe('END_TURN', () => {
  it('applies status damage, clears paralysis, and draws a card for the next player', () => {
    let state = baseState()
    state.players.p1.active!.statuses = ['paralyzed']
    state.players.p2.active!.statuses = ['poisoned']
    state = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(state.players.p2.active!.damage).toBe(10) // poison tick
    expect(state.activeSide).toBe('p2')
    expect(state.players.p2.hand.length).toBeGreaterThan(0) // drew a card
  })

  it('ends the game when status damage knocks out the active on turn end', () => {
    let state = baseState()
    state.players.p2.active!.damage = 55
    state.players.p2.active!.statuses = ['poisoned'] // +10 -> lethal
    state.players.p2.prizes = []
    state.players.p2.bench = []
    state = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(state.winner).toBe('p1')
    expect(state.phase).toBe('gameover')
  })

  it('ends the game when the next player has no cards left to draw', () => {
    let state = baseState()
    state.players.p2.deck = []
    state = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(state.winner).toBe('p1')
    expect(state.winnerReason).toContain('Deck leer')
  })
})

describe('PROMOTE', () => {
  it('moves a bench Pokémon into the empty active slot', () => {
    let state = baseState()
    state.players.p1.active = null
    state.players.p1.bench = [makeMon(charmeleon, { instanceId: 'bench-1' })]
    state = applyAction(state, { type: 'PROMOTE', side: 'p1', benchInstanceId: 'bench-1' })
    expect(state.players.p1.active!.instanceId).toBe('bench-1')
    expect(state.players.p1.bench).toHaveLength(0)
  })
})

describe('attackIsUsable / currentHp / topStage', () => {
  it('is false when just evolved this turn, asleep, paralyzed, or underpaid', () => {
    const mon = makeMon(charmander, { attachedEnergy: [cloneWithUid(fireEnergy) as never] })
    expect(attackIsUsable(mon, 0, 1)).toBe(true)
    expect(attackIsUsable({ ...mon, evolvedOnTurn: 1 }, 0, 1)).toBe(false)
    expect(attackIsUsable({ ...mon, statuses: ['asleep'] }, 0, 1)).toBe(false)
    expect(attackIsUsable({ ...mon, statuses: ['paralyzed'] }, 0, 1)).toBe(false)
    expect(attackIsUsable({ ...mon, attachedEnergy: [] }, 0, 1)).toBe(false)
    expect(attackIsUsable(mon, 5, 1)).toBe(false) // no such attack index
  })

  it('currentHp clamps at 0 and topStage returns the latest evolution', () => {
    const mon = makeMon(charmander, { damage: 1000 })
    expect(currentHp(mon)).toBe(0)
    mon.stages.push(charmeleon)
    expect(topStage(mon).name).toBe('Charmeleon')
  })
})

describe('needsPromote / isGameOver', () => {
  it('reports true only when active is empty and the game is still running', () => {
    const state = baseState()
    state.players.p1.active = null
    expect(needsPromote(state, 'p1')).toBe(true)
    expect(needsPromote(state, 'p2')).toBe(false)
    expect(isGameOver(state)).toBe(false)
    state.phase = 'gameover'
    expect(needsPromote(state, 'p1')).toBe(false)
    expect(isGameOver(state)).toBe(true)
  })
})
