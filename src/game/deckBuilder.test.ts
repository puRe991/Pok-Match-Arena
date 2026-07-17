import { describe, expect, it } from 'vitest'
import { buildRandomLegalDeck, cloneWithUid, expandDeck, shuffle } from './deckBuilder'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { CardDef } from './types'

describe('cloneWithUid', () => {
  it('assigns a unique, non-empty uid without mutating the source card', () => {
    const source = FALLBACK_POOL[0]
    const a = cloneWithUid(source)
    const b = cloneWithUid(source)
    expect(a.uid).not.toBe('')
    expect(a.uid).not.toBe(b.uid)
    expect(source.uid).toBe('')
    expect(a.id).toBe(source.id)
  })
})

describe('shuffle', () => {
  it('returns an array with the same elements without mutating the input', () => {
    const original = [1, 2, 3, 4, 5]
    const copy = [...original]
    const result = shuffle(original)
    expect(original).toEqual(copy)
    expect(result).toHaveLength(original.length)
    expect([...result].sort()).toEqual([...original].sort())
  })

  it('handles empty and single-element arrays', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([1])).toEqual([1])
  })
})

describe('expandDeck', () => {
  it('expands a {id: count} map into that many concrete card instances', () => {
    const byId: Record<string, CardDef> = Object.fromEntries(FALLBACK_POOL.map((c) => [c.id, c]))
    const first = FALLBACK_POOL[0]
    const second = FALLBACK_POOL[1]
    const cards = expandDeck({ [first.id]: 3, [second.id]: 2 }, byId)
    expect(cards).toHaveLength(5)
    expect(cards.filter((c) => c.id === first.id)).toHaveLength(3)
    expect(cards.filter((c) => c.id === second.id)).toHaveLength(2)
    const uids = new Set(cards.map((c) => c.uid))
    expect(uids.size).toBe(cards.length)
  })

  it('ignores ids that are missing from the lookup table', () => {
    const cards = expandDeck({ 'does-not-exist': 4 }, {})
    expect(cards).toEqual([])
  })
})

describe('buildRandomLegalDeck', () => {
  it('builds a deck of the requested size using only deck-legal cards', () => {
    const deck = buildRandomLegalDeck(FALLBACK_POOL, 60)
    expect(deck).toHaveLength(60)
    for (const card of deck) {
      expect(card.kind === 'trainer').toBe(false)
      if (card.kind === 'energy') expect(card.isBasicEnergy).toBe(true)
    }
  })

  it('gives every card in the deck a unique uid', () => {
    const deck = buildRandomLegalDeck(FALLBACK_POOL, 60)
    const uids = new Set(deck.map((c) => c.uid))
    expect(uids.size).toBe(deck.length)
  })

  it('never includes more Pokémon than the deck size when the pool is small', () => {
    const smallPool = FALLBACK_POOL.slice(0, 3)
    const deck = buildRandomLegalDeck(smallPool, 10)
    expect(deck.length).toBeLessThanOrEqual(10)
  })

  it('returns an empty deck when the pool has no legal cards', () => {
    const trainerOnly: CardDef[] = [
      { kind: 'trainer', id: 't1', uid: '', name: 'Trainer', setId: 's', setName: 'S', number: '1', rarity: 'Common', imageSmall: '', imageLarge: '', text: '' },
    ]
    expect(buildRandomLegalDeck(trainerOnly, 60)).toEqual([])
  })
})
