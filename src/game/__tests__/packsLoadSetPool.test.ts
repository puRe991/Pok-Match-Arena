import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RawSetCard, TcgSet } from '../../api/sets'

vi.mock('../../api/sets', () => ({ loadSetCards: vi.fn() }))

async function freshPacks() {
  vi.resetModules()
  return import('../packs')
}

function testSet(id = 'test-set'): TcgSet {
  return { id, name: 'Test Set', series: 'Test', total: 1, releaseDate: '', logo: '', symbol: '' }
}

function rawPokemon(id: string, overrides: Partial<RawSetCard> = {}): RawSetCard {
  return {
    id,
    name: `Mon-${id}`,
    supertype: 'Pokémon',
    number: id,
    hp: '60',
    subtypes: ['Basic'],
    types: ['Fire'],
    attacks: [{ name: 'Tackle', cost: ['Colorless'], damage: '10' }],
    rarity: 'Common',
    images: { small: 's.png', large: 'l.png' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loadSetPool', () => {
  it('normalizes and buckets cards by rarity when enough are valid', async () => {
    const { loadSetPool } = await freshPacks()
    const { loadSetCards } = await import('../../api/sets')
    const cards = Array.from({ length: 25 }, (_, i) => rawPokemon(`c${i}`))
    vi.mocked(loadSetCards).mockResolvedValue(cards)

    const pool = await loadSetPool(testSet('base1'))
    expect(pool.setId).toBe('base1')
    expect(pool.all).toHaveLength(25)
    expect(pool.common).toHaveLength(25)
  })

  it('falls back to the offline pool when fewer than 20 cards normalize successfully', async () => {
    const { loadSetPool } = await freshPacks()
    const { loadSetCards } = await import('../../api/sets')
    // Only 5 cards, and all valid — still under the 20-card floor.
    const cards = Array.from({ length: 5 }, (_, i) => rawPokemon(`c${i}`))
    vi.mocked(loadSetCards).mockResolvedValue(cards)

    const pool = await loadSetPool(testSet('base1'))
    expect(pool.setId).toBe('offline')
    expect(pool.all.length).toBeGreaterThan(0)
  })

  it('caches the pool per set id and only fetches once', async () => {
    const { loadSetPool } = await freshPacks()
    const { loadSetCards } = await import('../../api/sets')
    const cards = Array.from({ length: 25 }, (_, i) => rawPokemon(`c${i}`))
    vi.mocked(loadSetCards).mockResolvedValue(cards)

    const set = testSet('base1')
    const [a, b] = await Promise.all([loadSetPool(set), loadSetPool(set)])
    expect(a).toBe(b)
    expect(loadSetCards).toHaveBeenCalledTimes(1)
  })

  it('fetches independently for different set ids', async () => {
    const { loadSetPool } = await freshPacks()
    const { loadSetCards } = await import('../../api/sets')
    const cards = Array.from({ length: 25 }, (_, i) => rawPokemon(`c${i}`))
    vi.mocked(loadSetCards).mockResolvedValue(cards)

    await loadSetPool(testSet('base1'))
    await loadSetPool(testSet('base2'))
    expect(loadSetCards).toHaveBeenCalledTimes(2)
  })
})
