import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRandomLegalDeck, cloneWithUid, expandDeck, shuffle } from '../deckBuilder'
import { makeEnergy, makePokemon, makeTrainer, resetUidCounter } from '../../test/fixtures'
import type { CardDef } from '../types'

beforeEach(() => {
  resetUidCounter()
  vi.restoreAllMocks()
})

describe('cloneWithUid', () => {
  it('gives each clone a unique uid while preserving the rest of the card', () => {
    const original = makePokemon({ name: 'Pika' })
    const a = cloneWithUid(original)
    const b = cloneWithUid(original)
    expect(a.uid).not.toBe(b.uid)
    expect(a.name).toBe('Pika')
    expect(a.id).toBe(original.id)
  })
})

describe('shuffle', () => {
  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    shuffle(input)
    expect(input).toEqual(copy)
  })

  it('keeps the same elements (a permutation)', () => {
    const input = Array.from({ length: 20 }, (_, i) => i)
    const result = shuffle(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort((a, b) => a - b)).toEqual(input)
  })
})

describe('expandDeck', () => {
  it('expands a {id: count} map into that many concrete card instances', () => {
    const card = makePokemon({ id: 'pika' })
    const byId: Record<string, CardDef> = { pika: card }
    const cards = expandDeck({ pika: 3 }, byId)
    expect(cards).toHaveLength(3)
    expect(cards.every((c) => c.id === 'pika')).toBe(true)
    // Every expanded copy must have a distinct uid.
    expect(new Set(cards.map((c) => c.uid)).size).toBe(3)
  })

  it('silently skips ids that are missing from the card pool', () => {
    const cards = expandDeck({ ghost: 2 }, {})
    expect(cards).toHaveLength(0)
  })
})

describe('buildRandomLegalDeck', () => {
  it('excludes trainers and non-basic energy from the deck', () => {
    const pool: CardDef[] = [
      makePokemon({ id: 'basic1', name: 'Basic1', stage: 'basic', pokemonType: 'Fire' }),
      makeEnergy({ id: 'fire-energy', isBasicEnergy: true, energyType: 'Fire' }),
      makeEnergy({ id: 'special-energy', isBasicEnergy: false, energyType: 'Water' }),
      makeTrainer({ id: 'trainer1' }),
    ]
    const deck = buildRandomLegalDeck(pool, 60)
    expect(deck.some((c) => c.kind === 'trainer')).toBe(false)
    expect(deck.some((c) => c.kind === 'energy' && !c.isBasicEnergy)).toBe(false)
  })

  it('builds a deck of the requested size when enough legal cards exist', () => {
    const pool: CardDef[] = [
      makePokemon({ id: 'basic1', name: 'Basic1', stage: 'basic', pokemonType: 'Fire' }),
      makePokemon({ id: 'basic2', name: 'Basic2', stage: 'basic', pokemonType: 'Water' }),
      makeEnergy({ id: 'fire-energy', isBasicEnergy: true, energyType: 'Fire' }),
      makeEnergy({ id: 'water-energy', isBasicEnergy: true, energyType: 'Water' }),
    ]
    const deck = buildRandomLegalDeck(pool, 60)
    expect(deck).toHaveLength(60)
  })

  it('includes evolution lines that follow a chosen basic Pokémon', () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basic1', stage: 'basic', pokemonType: 'Fire' })
    const stage1 = makePokemon({
      id: 'stage1',
      name: 'Stage1Mon',
      stage: 'stage1',
      evolvesFrom: 'Basic1',
      pokemonType: 'Fire',
    })
    const stage2 = makePokemon({
      id: 'stage2',
      name: 'Stage2Mon',
      stage: 'stage2',
      evolvesFrom: 'Stage1Mon',
      pokemonType: 'Fire',
    })
    const energyCard = makeEnergy({ id: 'fire-energy', isBasicEnergy: true, energyType: 'Fire' })
    const deck = buildRandomLegalDeck([basic, stage1, stage2, energyCard], 60)
    expect(deck.some((c) => c.id === 'stage1')).toBe(true)
    expect(deck.some((c) => c.id === 'stage2')).toBe(true)
  })

  it('returns fewer than the requested size when the pool cannot fill it', () => {
    const pool: CardDef[] = [makePokemon({ id: 'basic1', stage: 'basic' })]
    const deck = buildRandomLegalDeck(pool, 60)
    expect(deck.length).toBeLessThan(60)
    expect(deck.length).toBeGreaterThan(0)
  })

  it('returns an empty deck for an empty pool', () => {
    expect(buildRandomLegalDeck([], 60)).toEqual([])
  })
})
