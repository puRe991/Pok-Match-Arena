import { describe, expect, it } from 'vitest'
import { ARENAS_PER_REGION, badgeAt, badgeById, isFinalArena, REGIONS, TOTAL_BADGES } from './regions'

describe('regions catalog', () => {
  it('has 9 regions each with 8 arenas', () => {
    expect(REGIONS).toHaveLength(9)
    for (const region of REGIONS) {
      expect(region.badges).toHaveLength(ARENAS_PER_REGION)
    }
  })

  it('exposes a matching total badge count', () => {
    expect(TOTAL_BADGES).toBe(9 * ARENAS_PER_REGION)
  })

  it('has globally unique badge ids', () => {
    const ids = REGIONS.flatMap((r) => r.badges.map((b) => b.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('maps every badge to one of the 7 game element types', () => {
    const valid = new Set(['Fire', 'Water', 'Grass', 'Lightning', 'Fighting', 'Psychic', 'Colorless'])
    for (const region of REGIONS) {
      for (const b of region.badges) expect(valid.has(b.themeType)).toBe(true)
    }
  })

  it('resolves badges by position and by id', () => {
    const first = badgeAt(0, 0)
    expect(first?.name).toBe('Felsorden')
    expect(badgeById('kanto-fels')).toEqual(first)
  })

  it('flags only the very last arena as final', () => {
    expect(isFinalArena(0, 0)).toBe(false)
    expect(isFinalArena(8, 7)).toBe(true)
    expect(isFinalArena(8, 6)).toBe(false)
  })
})
