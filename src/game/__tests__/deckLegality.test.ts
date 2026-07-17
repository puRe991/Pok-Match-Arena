import { beforeEach, describe, expect, it } from 'vitest'
import { cardLimit, validateDeck } from '../deckLegality'
import { makeEnergy, makePokemon, resetUidCounter } from '../../test/fixtures'
import type { CardDef } from '../types'

beforeEach(() => resetUidCounter())

describe('cardLimit', () => {
  it('is unlimited for basic energy', () => {
    expect(cardLimit(makeEnergy({ isBasicEnergy: true }))).toBe(Infinity)
  })

  it('is 4 for non-basic-energy cards', () => {
    expect(cardLimit(makePokemon())).toBe(4)
    expect(cardLimit(makeEnergy({ isBasicEnergy: false }))).toBe(4)
  })
})

describe('validateDeck', () => {
  function collectionOf(cards: CardDef[], counts: number[]): Record<string, { card: CardDef; count: number }> {
    const out: Record<string, { card: CardDef; count: number }> = {}
    cards.forEach((c, i) => {
      out[c.id] = { card: c, count: counts[i] }
    })
    return out
  }

  it('requires at least 60 cards', () => {
    const basic = makePokemon({ id: 'basic1', stage: 'basic' })
    const result = validateDeck({ cardCounts: { basic1: 4 } }, collectionOf([basic], [4]))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('60'))).toBe(true)
  })

  it('requires at least one basic Pokémon', () => {
    const energy = makeEnergy({ id: 'e1', isBasicEnergy: true })
    const result = validateDeck({ cardCounts: { e1: 60 } }, collectionOf([energy], [60]))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Basis-Pokémon'))).toBe(true)
  })

  it('rejects more copies of a non-basic-energy card than the 4x limit', () => {
    const basic = makePokemon({ id: 'basic1', stage: 'basic' })
    const energy = makeEnergy({ id: 'e1', isBasicEnergy: true })
    const collection = collectionOf([basic, energy], [10, 56])
    const result = validateDeck({ cardCounts: { basic1: 5, e1: 55 } }, collection)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('maximal 4x'))).toBe(true)
  })

  it('rejects counts that exceed what is owned in the collection', () => {
    const basic = makePokemon({ id: 'basic1', stage: 'basic' })
    const energy = makeEnergy({ id: 'e1', isBasicEnergy: true })
    const collection = collectionOf([basic, energy], [2, 56])
    const result = validateDeck({ cardCounts: { basic1: 4, e1: 56 } }, collection)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('nur 2x'))).toBe(true)
  })

  it('flags cards missing from the collection entirely', () => {
    const result = validateDeck({ cardCounts: { ghost: 60 } }, {})
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('nicht in Sammlung'))).toBe(true)
  })

  it('is valid for a legal 60-card deck with a basic Pokémon and unlimited basic energy', () => {
    const basic = makePokemon({ id: 'basic1', stage: 'basic' })
    const energy = makeEnergy({ id: 'e1', isBasicEnergy: true })
    const collection = collectionOf([basic, energy], [4, 56])
    const result = validateDeck({ cardCounts: { basic1: 4, e1: 56 } }, collection)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.total).toBe(60)
  })

  it('ignores zero and negative counts', () => {
    const basic = makePokemon({ id: 'basic1', stage: 'basic' })
    const collection = collectionOf([basic], [4])
    const result = validateDeck({ cardCounts: { basic1: 4, phantom: 0, negative: -3 } }, collection)
    expect(result.total).toBe(4)
  })
})
