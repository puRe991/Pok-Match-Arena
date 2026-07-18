import { describe, expect, it } from 'vitest'
import { applyAction } from './engine'
import { cloneWithUid } from './deckBuilder'
import { isDeckLegal } from './normalize'
import { getTrainerEffect, trainerIsPlayable, trainerValidTargets } from './trainers'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { CardDef, GameState, InPlayPokemon, PlayerState, PokemonCardDef, Side, TrainerCardDef } from './types'

const charmander = FALLBACK_POOL.find((c) => c.id === 'offline-46')! as PokemonCardDef // Fire, weak Water, 60hp, Ember cost [Fire] 20
const squirtle = FALLBACK_POOL.find((c) => c.id === 'offline-63')! as PokemonCardDef
const fireEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-98')!
const waterEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-102')!

const trainerCard = (name: string): CardDef => {
  const card: TrainerCardDef = {
    kind: 'trainer',
    id: `trainer-${name}`,
    uid: '',
    name,
    setId: 'test',
    setName: 'Test',
    number: '0',
    rarity: 'Common',
    imageSmall: '',
    imageLarge: '',
    text: '',
  }
  return cloneWithUid(card)
}

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

function makePlayer(side: Side, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    side,
    name: side === 'p1' ? 'Du' : 'CPU',
    isAI: side === 'p2',
    deck: [],
    hand: [],
    active: makeMon(side === 'p1' ? charmander : squirtle, { instanceId: `${side}-active` }),
    bench: [],
    discard: [],
    prizes: [],
    hasAttachedEnergyThisTurn: false,
    hasRetreatedThisTurn: false,
    attackedThisTurn: false,
    attackBonus: 0,
    ...overrides,
  }
}

function baseState(p1: Partial<PlayerState> = {}, p2: Partial<PlayerState> = {}): GameState {
  return {
    players: { p1: makePlayer('p1', p1), p2: makePlayer('p2', p2) },
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
  }
}

function playTrainer(state: GameState, name: string, targetInstanceId?: string): GameState {
  const card = trainerCard(name)
  state.players.p1.hand = [...state.players.p1.hand, card]
  return applyAction(state, { type: 'PLAY_TRAINER', side: 'p1', handUid: card.uid, targetInstanceId })
}

describe('getTrainerEffect', () => {
  it('recognises supported trainers by name and returns null otherwise', () => {
    expect(getTrainerEffect(trainerCard('Bill'))?.id).toBe('bill')
    expect(getTrainerEffect(trainerCard('Professor Oak'))?.id).toBe('oak')
    expect(getTrainerEffect(trainerCard('Gust of Wind'))?.id).toBe('gustOfWind')
    expect(getTrainerEffect({ ...trainerCard('Bill'), name: 'Unbekannter Trainer' })).toBeNull()
    expect(getTrainerEffect(cloneWithUid(charmander))).toBeNull()
  })
})

describe('isDeckLegal for trainers', () => {
  it('accepts supported trainers and rejects unsupported ones', () => {
    expect(isDeckLegal(trainerCard('Bill'))).toBe(true)
    expect(isDeckLegal({ ...trainerCard('Bill'), name: 'Mystery Card' })).toBe(false)
  })
})

describe('PLAY_TRAINER draw effects', () => {
  it('Bill draws 2 cards', () => {
    const state = baseState({ deck: [cloneWithUid(fireEnergy), cloneWithUid(waterEnergy), cloneWithUid(fireEnergy)] })
    const next = playTrainer(state, 'Bill')
    expect(next.players.p1.hand).toHaveLength(2)
    expect(next.players.p1.deck).toHaveLength(1)
    expect(next.players.p1.discard.some((c) => c.name === 'Bill')).toBe(true)
  })

  it('Professor Oak discards the hand and draws 7', () => {
    const deck = Array.from({ length: 10 }, () => cloneWithUid(fireEnergy))
    const state = baseState({ deck, hand: [cloneWithUid(waterEnergy), cloneWithUid(waterEnergy)] })
    const next = playTrainer(state, 'Professor Oak')
    expect(next.players.p1.hand).toHaveLength(7)
    // the 2 old water energies plus the Oak card land in the discard
    expect(next.players.p1.discard.filter((c) => c.name === 'Water Energy')).toHaveLength(2)
  })
})

describe('PLAY_TRAINER healing effects', () => {
  it('Potion heals 20 from a chosen own Pokémon', () => {
    const state = baseState({ active: makeMon(charmander, { instanceId: 'p1-active', damage: 50 }) })
    const next = playTrainer(state, 'Potion', 'p1-active')
    expect(next.players.p1.active!.damage).toBe(30)
  })

  it('Potion is not playable without a damaged Pokémon', () => {
    const state = baseState()
    expect(trainerIsPlayable(state, 'p1', trainerCard('Potion'))).toBe(false)
    const next = playTrainer(state, 'Potion', 'p1-active')
    expect(next.players.p1.hand.some((c) => c.name === 'Potion')).toBe(true) // rejected, still in hand
  })

  it('Super Potion discards 1 energy and heals 40', () => {
    const active = makeMon(charmander, {
      instanceId: 'p1-active',
      damage: 50,
      attachedEnergy: [cloneWithUid(fireEnergy) as never, cloneWithUid(fireEnergy) as never],
    })
    const state = baseState({ active })
    const next = playTrainer(state, 'Super Potion', 'p1-active')
    expect(next.players.p1.active!.damage).toBe(10)
    expect(next.players.p1.active!.attachedEnergy).toHaveLength(1)
    expect(next.players.p1.discard.some((c) => c.name === 'Fire Energy')).toBe(true)
  })

  it('Pokémon Center heals everything but discards all energy', () => {
    const active = makeMon(charmander, {
      instanceId: 'p1-active',
      damage: 40,
      attachedEnergy: [cloneWithUid(fireEnergy) as never],
    })
    const bench = makeMon(squirtle, {
      instanceId: 'p1-bench',
      damage: 20,
      attachedEnergy: [cloneWithUid(waterEnergy) as never],
    })
    const state = baseState({ active, bench: [bench] })
    const next = playTrainer(state, 'Pokémon Center')
    expect(next.players.p1.active!.damage).toBe(0)
    expect(next.players.p1.bench[0].damage).toBe(0)
    expect(next.players.p1.active!.attachedEnergy).toHaveLength(0)
    expect(next.players.p1.discard).toHaveLength(3) // 2 energy + the trainer
  })
})

describe('PLAY_TRAINER switching effects', () => {
  it('Switch swaps active with a bench Pokémon and clears the old active status', () => {
    const active = makeMon(charmander, { instanceId: 'p1-active', statuses: ['asleep'] })
    const bench = makeMon(squirtle, { instanceId: 'p1-bench' })
    const state = baseState({ active, bench: [bench] })
    const next = playTrainer(state, 'Switch', 'p1-bench')
    expect(next.players.p1.active!.instanceId).toBe('p1-bench')
    expect(next.players.p1.bench[0].instanceId).toBe('p1-active')
    expect(next.players.p1.bench[0].statuses).toHaveLength(0)
  })

  it('Gust of Wind pulls an opponent bench Pokémon into the active spot', () => {
    const oppBench = makeMon(charmander, { instanceId: 'p2-bench' })
    const state = baseState({}, { active: makeMon(squirtle, { instanceId: 'p2-active' }), bench: [oppBench] })
    const next = playTrainer(state, 'Gust of Wind', 'p2-bench')
    expect(next.players.p2.active!.instanceId).toBe('p2-bench')
    expect(next.players.p2.bench.some((m) => m.instanceId === 'p2-active')).toBe(true)
  })
})

describe('PLAY_TRAINER disruption effects', () => {
  it('Energy Removal discards one energy from a chosen opponent Pokémon', () => {
    const oppActive = makeMon(squirtle, {
      instanceId: 'p2-active',
      attachedEnergy: [cloneWithUid(waterEnergy) as never, cloneWithUid(waterEnergy) as never],
    })
    const state = baseState({}, { active: oppActive })
    const targets = trainerValidTargets(state, 'p1', getTrainerEffect(trainerCard('Energy Removal'))!)
    expect(targets).toEqual([{ instanceId: 'p2-active', side: 'p2' }])
    const next = playTrainer(state, 'Energy Removal', 'p2-active')
    expect(next.players.p2.active!.attachedEnergy).toHaveLength(1)
    expect(next.players.p2.discard.some((c) => c.name === 'Water Energy')).toBe(true)
  })
})

describe('PlusPower', () => {
  it('adds 10 damage to the next attack this turn', () => {
    const active = makeMon(charmander, {
      instanceId: 'p1-active',
      attachedEnergy: [cloneWithUid(fireEnergy) as never], // Ember costs [Fire], 20 dmg
    })
    let state = baseState({ active }, { active: makeMon(squirtle, { instanceId: 'p2-active' }) })
    state = playTrainer(state, 'PlusPower')
    expect(state.players.p1.attackBonus).toBe(10)
    state = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(state.players.p2.active!.damage).toBe(30) // 20 + 10
    expect(state.players.p1.attackBonus).toBe(0) // consumed
  })
})

describe('turn gating', () => {
  it('refuses trainers outside your own turn', () => {
    const state = baseState({ deck: [cloneWithUid(fireEnergy)] }, {})
    state.activeSide = 'p2'
    const next = playTrainer(state, 'Bill')
    expect(next.players.p1.hand.some((c) => c.name === 'Bill')).toBe(true) // untouched
  })
})
