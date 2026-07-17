import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openPack, type SetCardPool } from '../packs'
import { makeEnergy, makePokemon, resetUidCounter } from '../../test/fixtures'
import type { CardDef } from '../types'

function makePool(overrides: Partial<SetCardPool> = {}): SetCardPool {
  const common = [makePokemon({ id: 'common1', rarity: 'Common' })]
  const uncommon = [makePokemon({ id: 'uncommon1', rarity: 'Uncommon' })]
  const rare = [makePokemon({ id: 'rare1', rarity: 'Rare' })]
  const holo = [makePokemon({ id: 'holo1', rarity: 'Holo Rare' })]
  const basicEnergy = [makeEnergy({ id: 'energy1', isBasicEnergy: true })]
  const all: CardDef[] = [...common, ...uncommon, ...rare, ...holo, ...basicEnergy]
  return {
    setId: 'test-set',
    setName: 'Test Set',
    common,
    uncommon,
    rare,
    holo,
    basicEnergy,
    all,
    ...overrides,
  }
}

beforeEach(() => {
  resetUidCounter()
  vi.restoreAllMocks()
})

describe('openPack', () => {
  it('opens 11 cards: 6 common, 3 uncommon, 1 rare/holo, 1 basic energy', () => {
    const pool = makePool()
    const cards = openPack(pool)
    expect(cards).toHaveLength(11)
    const commons = cards.filter((c) => c.id === 'common1')
    const uncommons = cards.filter((c) => c.id === 'uncommon1')
    const energies = cards.filter((c) => c.id === 'energy1')
    expect(commons).toHaveLength(6)
    expect(uncommons).toHaveLength(3)
    expect(energies).toHaveLength(1)
  })

  it('every card in the pack has a fresh uid', () => {
    const pool = makePool()
    const cards = openPack(pool)
    expect(new Set(cards.map((c) => c.uid)).size).toBe(cards.length)
  })

  it('picks a holo when the coin flip is under the holo chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // always "hits" and always picks index 0
    const pool = makePool()
    const cards = openPack(pool)
    expect(cards.some((c) => c.id === 'holo1')).toBe(true)
  })

  it('falls back to the rare pool when the holo roll misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // misses HOLO_CHANCE (0.33)
    const pool = makePool()
    const cards = openPack(pool)
    expect(cards.some((c) => c.id === 'rare1')).toBe(true)
  })

  it('falls back to holo when the rare pool is empty', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const pool = makePool({ rare: [] })
    const cards = openPack(pool)
    expect(cards.some((c) => c.id === 'holo1')).toBe(true)
  })

  it('uses the common pool for the rare slot when both rare and holo pools are empty', () => {
    const pool = makePool({ rare: [], holo: [] })
    const cards = openPack(pool)
    // 6 common (regular slots) + 1 more common (rare-slot fallback) = 7 commons.
    expect(cards.filter((c) => c.id === 'common1')).toHaveLength(7)
  })

  it('falls back to the common pool when uncommon is empty', () => {
    const pool = makePool({ uncommon: [] })
    const cards = openPack(pool)
    // 6 regular commons + 3 uncommon-slot fallbacks = 9 commons.
    expect(cards.filter((c) => c.id === 'common1')).toHaveLength(9)
  })

  it('falls back to the "all" pool when common is empty', () => {
    const pool = makePool({ common: [] })
    const cards = openPack(pool)
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((c) => pool.all.some((p) => p.id === c.id))).toBe(true)
  })

  it('omits the energy card when the basic energy pool is empty', () => {
    const pool = makePool({ basicEnergy: [] })
    const cards = openPack(pool)
    expect(cards.some((c) => c.kind === 'energy')).toBe(false)
    expect(cards).toHaveLength(10)
  })
})
