import { describe, expect, it } from 'vitest'
import { computeDeckStats, parseDeck, serializeDeck } from './deckStats'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { CardDef, PokemonCardDef } from './types'

function collectionFrom(cards: CardDef[]): Record<string, { card: CardDef }> {
  const c: Record<string, { card: CardDef }> = {}
  for (const card of cards) c[card.id] = { card }
  return c
}

const basicMon = FALLBACK_POOL.find((c) => c.kind === 'pokemon' && (c as PokemonCardDef).stage === 'basic')! as PokemonCardDef
const energy = FALLBACK_POOL.find((c) => c.kind === 'energy')!
const trainer = FALLBACK_POOL.find((c) => c.kind === 'trainer')!

describe('computeDeckStats', () => {
  it('zählt Karten nach Art, Stufe und Typ', () => {
    const collection = collectionFrom([basicMon, energy, trainer])
    const stats = computeDeckStats({ [basicMon.id]: 4, [energy.id]: 10, [trainer.id]: 2 }, collection)
    expect(stats.total).toBe(16)
    expect(stats.pokemon).toBe(4)
    expect(stats.energy).toBe(10)
    expect(stats.trainer).toBe(2)
    expect(stats.basic).toBe(4)
    expect(stats.byType[basicMon.pokemonType]).toBe(4)
    expect(stats.avgRetreat).toBe(basicMon.retreatCost)
  })

  it('ignoriert unbekannte IDs und Null-Zählungen', () => {
    const stats = computeDeckStats({ 'ghost-id': 3, [basicMon.id]: 0 }, collectionFrom([basicMon]))
    expect(stats.total).toBe(0)
    expect(stats.avgRetreat).toBe(0)
  })
})

describe('serializeDeck / parseDeck', () => {
  it('macht einen Roundtrip von cardCounts', () => {
    const counts = { [basicMon.id]: 4, [energy.id]: 12 }
    const text = serializeDeck('Mein Deck', counts)
    const parsed = parseDeck(text)
    expect(parsed.name).toBe('Mein Deck')
    expect(parsed.cardCounts).toEqual(counts)
  })

  it('ignoriert kaputte Zeilen und summiert doppelte IDs', () => {
    const parsed = parseDeck('# Kommentar\n4 base1-4\nquatsch\n2 base1-4\n0 base1-2\n')
    expect(parsed.cardCounts['base1-4']).toBe(6)
    expect(parsed.cardCounts['base1-2']).toBeUndefined()
  })
})
