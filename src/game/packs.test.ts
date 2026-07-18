import { afterEach, describe, expect, it, vi } from 'vitest'
import { openPack, loadSetPool, type SetCardPool } from './packs'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { CardDef, EnergyCardDef } from './types'

function poolFrom(cards: CardDef[]): SetCardPool {
  return {
    setId: 'base1',
    setName: 'Base Set',
    common: cards.filter((c) => c.rarity === 'Common' && c.kind !== 'energy'),
    uncommon: cards.filter((c) => c.rarity === 'Uncommon'),
    rare: cards.filter((c) => c.rarity === 'Rare'),
    holo: cards.filter((c) => c.rarity === 'Holo Rare'),
    basicEnergy: cards.filter((c) => c.kind === 'energy' && c.isBasicEnergy) as EnergyCardDef[],
    all: cards,
  }
}

describe('openPack', () => {
  it('opens 11 cards: 6 common, 3 uncommon, 1 rare/holo, 1 basic energy when all rarities exist', () => {
    const pokemon = FALLBACK_POOL.filter((c) => c.kind === 'pokemon')
    const cards: CardDef[] = [
      ...pokemon.map((c) => ({ ...c, rarity: 'Common' as const })),
      { ...pokemon[0], id: 'unc-1', rarity: 'Uncommon' as const },
      { ...pokemon[0], id: 'rare-1', rarity: 'Rare' as const },
      { ...pokemon[0], id: 'holo-1', rarity: 'Holo Rare' as const },
      // Nur Basis-Energie: der garantierte Energie-Slot zieht ausschließlich
      // Basis-Energie (Spezial-Energie wie DCE kommt über den Uncommon-Slot).
      ...FALLBACK_POOL.filter((c) => c.kind === 'energy' && c.isBasicEnergy),
    ]
    const pool = poolFrom(cards)
    const pack = openPack(pool)
    expect(pack).toHaveLength(11)
    const energyCount = pack.filter((c) => c.kind === 'energy').length
    expect(energyCount).toBe(1)
  })

  it('gives every card a fresh uid', () => {
    const pool = poolFrom(FALLBACK_POOL)
    const pack = openPack(pool)
    const uids = pack.map((c) => c.uid)
    expect(uids.every((u) => u !== '')).toBe(true)
    expect(new Set(uids).size).toBe(uids.length)
  })

  it('falls back to the common/all pool when uncommon or rare/holo are empty', () => {
    const pool: SetCardPool = {
      setId: 'x',
      setName: 'X',
      common: [FALLBACK_POOL[0]],
      uncommon: [],
      rare: [],
      holo: [],
      basicEnergy: [],
      all: [FALLBACK_POOL[0]],
    }
    const pack = openPack(pool)
    // 6 common + 3 uncommon(fallback to common) + 1 rare-slot(fallback to common/all) = 10, no energy available
    expect(pack).toHaveLength(10)
    expect(pack.every((c) => c.id === FALLBACK_POOL[0].id)).toBe(true)
  })

  it('returns an empty pack when the pool has no cards at all', () => {
    const pool: SetCardPool = {
      setId: 'x',
      setName: 'X',
      common: [],
      uncommon: [],
      rare: [],
      holo: [],
      basicEnergy: [],
      all: [],
    }
    expect(openPack(pool)).toEqual([])
  })
})

describe('loadSetPool', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes and buckets cards fetched for the set, caching by set id', async () => {
    const rawCard = {
      id: 'base1-1',
      name: 'Bulbasaur',
      supertype: 'Pokémon',
      subtypes: ['Basic'],
      hp: '60',
      types: ['Grass'],
      attacks: [{ name: 'Vine Whip', cost: ['Grass'], damage: '20', text: '' }],
      retreatCost: ['Colorless'],
      rarity: 'Common',
      number: '1',
      images: { small: 's.png', large: 'l.png' },
    }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: Array(25).fill(rawCard) }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const pool = await loadSetPool({ id: 'test-set-1', name: 'Test Set', series: 'Test', total: 25, releaseDate: '', logo: '', symbol: '' })
    expect(pool.setId).toBe('test-set-1')
    expect(pool.common).toHaveLength(25)
    expect(pool.all).toHaveLength(25)

    // Second call for the same set id should be served from cache, not refetch.
    await loadSetPool({ id: 'test-set-1', name: 'Test Set', series: 'Test', total: 25, releaseDate: '', logo: '', symbol: '' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the offline pool when the API returns too few normalizable cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
    )
    const pool = await loadSetPool({ id: 'test-set-2', name: 'Empty Set', series: 'Test', total: 0, releaseDate: '', logo: '', symbol: '' })
    expect(pool.setId).toBe('offline')
    expect(pool.all.length).toBe(FALLBACK_POOL.length)
  })
})
