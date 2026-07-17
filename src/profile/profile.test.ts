import { describe, expect, it } from 'vitest'
import {
  AVATARS,
  DEFAULT_AVATAR_ID,
  RANK_TIERS,
  avatarById,
  eloDelta,
  expectedScore,
  generateDefaultName,
  generatePlayerId,
  isValidUsername,
  nextRank,
  rankForRating,
  sanitizeUsername,
  validateUsername,
  winRate,
} from './profile'

describe('sanitizeUsername', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeUsername('  Ash   Ketchum  ')).toBe('Ash Ketchum')
    expect(sanitizeUsername('\tMisty\n')).toBe('Misty')
  })
})

describe('validateUsername', () => {
  it('accepts normal names including umlauts, digits and separators', () => {
    for (const name of ['Ash', 'Trainer-1234', 'Müller_99', 'Prof. Eich', 'Ash Ketchum']) {
      expect(validateUsername(name)).toEqual([])
      expect(isValidUsername(name)).toBe(true)
    }
  })

  it('rejects too short and too long names', () => {
    expect(validateUsername('Ab').length).toBeGreaterThan(0)
    expect(validateUsername('A'.repeat(17)).length).toBeGreaterThan(0)
  })

  it('rejects forbidden characters and leading separators', () => {
    expect(isValidUsername('Ash<script>')).toBe(false)
    expect(isValidUsername('-Ash')).toBe(false)
    expect(isValidUsername('a@b.de')).toBe(false)
  })
})

describe('generateDefaultName / generatePlayerId', () => {
  it('generates a valid default trainer name', () => {
    const name = generateDefaultName()
    expect(name).toMatch(/^Trainer-\d{4}$/)
    expect(isValidUsername(name)).toBe(true)
  })

  it('generates unique player ids', () => {
    expect(generatePlayerId()).not.toBe(generatePlayerId())
  })
})

describe('avatars', () => {
  it('resolves known ids and falls back for unknown ids', () => {
    expect(avatarById(AVATARS[3].id)).toBe(AVATARS[3])
    expect(avatarById('does-not-exist')).toBe(AVATARS[0])
    expect(AVATARS.some((a) => a.id === DEFAULT_AVATAR_ID)).toBe(true)
  })

  it('has unique avatar ids', () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length)
  })
})

describe('elo', () => {
  it('expectedScore is 0.5 for equal ratings and symmetric', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5)
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1)
  })

  it('winning against an equal opponent yields +16, losing -16 (K=32)', () => {
    expect(eloDelta(1000, 1000, 1)).toBe(16)
    expect(eloDelta(1000, 1000, 0)).toBe(-16)
  })

  it('beating a stronger opponent yields more points than beating a weaker one', () => {
    const vsStronger = eloDelta(1000, 1300, 1)
    const vsWeaker = eloDelta(1000, 700, 1)
    expect(vsStronger).toBeGreaterThan(vsWeaker)
    expect(vsWeaker).toBeGreaterThanOrEqual(0)
  })

  it('losing to a much weaker opponent costs close to K points', () => {
    expect(eloDelta(1400, 800, 0)).toBeLessThan(-25)
  })
})

describe('ranks', () => {
  it('maps ratings to the correct tier', () => {
    expect(rankForRating(0).id).toBe('bronze')
    expect(rankForRating(999).id).toBe('bronze')
    expect(rankForRating(1000).id).toBe('silver')
    expect(rankForRating(1200).id).toBe('gold')
    expect(rankForRating(1350).id).toBe('platinum')
    expect(rankForRating(2000).id).toBe('master')
  })

  it('nextRank returns the following tier or null at the top', () => {
    expect(nextRank(1000)?.id).toBe('gold')
    expect(nextRank(9999)).toBeNull()
  })

  it('tiers are sorted ascending by minRating', () => {
    const mins = RANK_TIERS.map((t) => t.minRating)
    expect([...mins].sort((a, b) => a - b)).toEqual(mins)
  })
})

describe('winRate', () => {
  it('returns null with no games and a rounded percentage otherwise', () => {
    expect(winRate(0, 0)).toBeNull()
    expect(winRate(2, 1)).toBe(67)
    expect(winRate(5, 0)).toBe(100)
  })
})
