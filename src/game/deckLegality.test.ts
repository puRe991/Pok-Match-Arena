import { describe, expect, it } from 'vitest'
import { cardLimit, validateDeck } from './deckLegality'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { CardDef } from './types'

const charmander = FALLBACK_POOL.find((c) => c.id === 'offline-46')!
const fireEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-98')!

function collectionOf(entries: [CardDef, number][]) {
  const out: Record<string, { card: CardDef; count: number }> = {}
  for (const [card, count] of entries) out[card.id] = { card, count }
  return out
}

describe('cardLimit', () => {
  it('is unlimited for basic energy and 4 for everything else', () => {
    expect(cardLimit(fireEnergy)).toBe(Infinity)
    expect(cardLimit(charmander)).toBe(4)
  })
})

describe('validateDeck', () => {
  it('is invalid when under 60 cards', () => {
    const collection = collectionOf([[charmander, 4]])
    const result = validateDeck({ cardCounts: { [charmander.id]: 4 } }, collection)
    expect(result.valid).toBe(false)
    expect(result.total).toBe(4)
    expect(result.errors.some((e) => e.includes('60 Karten'))).toBe(true)
  })

  it('is invalid without a basic Pokémon even at 60 cards', () => {
    const collection = collectionOf([[fireEnergy, 60]])
    const result = validateDeck({ cardCounts: { [fireEnergy.id]: 60 } }, collection)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Basis-Pokémon'))).toBe(true)
  })

  it('flags exceeding the 4-copy limit on non-basic-energy cards', () => {
    const collection = collectionOf([
      [charmander, 10],
      [fireEnergy, 56],
    ])
    const result = validateDeck({ cardCounts: { [charmander.id]: 5, [fireEnergy.id]: 55 } }, collection)
    expect(result.errors.some((e) => e.includes('maximal 4x'))).toBe(true)
  })

  it('flags counts that exceed what is owned in the collection', () => {
    const collection = collectionOf([
      [charmander, 2],
      [fireEnergy, 58],
    ])
    const result = validateDeck({ cardCounts: { [charmander.id]: 3, [fireEnergy.id]: 57 } }, collection)
    expect(result.errors.some((e) => e.includes('nur 2x'))).toBe(true)
  })

  it('flags card ids that are not owned at all', () => {
    const result = validateDeck({ cardCounts: { 'unowned-card': 60 } }, {})
    expect(result.errors.some((e) => e.includes('nicht in Sammlung'))).toBe(true)
  })

  it('is valid for a well-formed 60-card deck', () => {
    const collection = collectionOf([
      [charmander, 4],
      [fireEnergy, 56],
    ])
    const result = validateDeck({ cardCounts: { [charmander.id]: 4, [fireEnergy.id]: 56 } }, collection)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.total).toBe(60)
  })

  it('ignores zero/negative counts', () => {
    const collection = collectionOf([[charmander, 4]])
    const result = validateDeck({ cardCounts: { [charmander.id]: 0 } }, collection)
    expect(result.total).toBe(0)
  })
})
