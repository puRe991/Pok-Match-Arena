import { describe, expect, it } from 'vitest'
import { SEALED_DECK_SIZE, buildSealedDeck, openSealedPool } from './sealed'
import { isDeckLegal } from './normalize'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { EnergyCardDef, Rarity } from './types'

function poolFrom() {
  const byRarity: Record<Rarity, typeof FALLBACK_POOL> = { Common: [], Uncommon: [], Rare: [], 'Holo Rare': [] }
  for (const c of FALLBACK_POOL) byRarity[c.rarity].push(c)
  return {
    setId: 'offline',
    setName: 'Offline',
    common: byRarity.Common,
    uncommon: byRarity.Uncommon,
    rare: byRarity.Rare,
    holo: byRarity['Holo Rare'],
    basicEnergy: FALLBACK_POOL.filter((c) => c.kind === 'energy' && c.isBasicEnergy) as EnergyCardDef[],
    all: FALLBACK_POOL,
  }
}

describe('openSealedPool', () => {
  it('öffnet die gewünschte Anzahl Packs und stellt freie Basis-Energie bereit', () => {
    const pool = poolFrom()
    const sealed = openSealedPool(pool, 6, 12)
    // 6 Packs × 11 Karten + freie Energie (mind. 1 Typ × 12)
    expect(sealed.length).toBeGreaterThanOrEqual(66 + 12)
    expect(sealed.some((c) => c.kind === 'energy' && c.isBasicEnergy)).toBe(true)
  })

  it('gibt jeder Karte eine eigene uid', () => {
    const sealed = openSealedPool(poolFrom(), 3, 6)
    const uids = sealed.map((c) => c.uid)
    expect(uids.every((u) => u !== '')).toBe(true)
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('buildSealedDeck', () => {
  it('baut ein legales Deck der Sealed-Größe aus dem Pool', () => {
    const sealed = openSealedPool(poolFrom(), 6, 12)
    const deck = buildSealedDeck(sealed)
    expect(deck.length).toBe(SEALED_DECK_SIZE)
    expect(deck.every(isDeckLegal)).toBe(true)
    expect(deck.some((c) => c.kind === 'pokemon' && c.stage === 'basic')).toBe(true)
  })
})
