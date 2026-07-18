import { describe, expect, it } from 'vitest'
import { buildLadder, generateGhosts, LADDER_SIZE, playerRank } from './ghosts'
import { applyMatch, createProfile, resolveSeason, SEASON_START_POINTS, WIN_POINTS } from './season'
import type { RankedProfile } from './types'

function winStreak(p: RankedProfile, n: number): RankedProfile {
  let cur = p
  for (let i = 0; i < n; i++) cur = applyMatch(cur, 1000, true).profile
  return cur
}

describe('createProfile', () => {
  it('starts in Kanto arena 0 at base rating', () => {
    const p = createProfile('Ash')
    expect(p.regionIndex).toBe(0)
    expect(p.arenaIndex).toBe(0)
    expect(p.earnedBadges).toHaveLength(0)
    expect(p.seasonId).toBe(1)
  })
})

describe('applyMatch', () => {
  it('adds points and a win on victory, career elo goes up', () => {
    const p = createProfile('Ash')
    const { profile, eloDelta } = applyMatch(p, 1000, true)
    expect(profile.wins).toBe(1)
    expect(profile.seasonPoints).toBe(SEASON_START_POINTS + WIN_POINTS)
    expect(eloDelta).toBeGreaterThan(0)
  })

  it('never lets season points fall below zero', () => {
    let p = createProfile('Ash')
    for (let i = 0; i < 10; i++) p = applyMatch(p, 1000, false).profile
    expect(p.seasonPoints).toBe(0)
    expect(p.losses).toBe(10)
  })
})

describe('ghosts / ladder', () => {
  it('generates a deterministic ghost field', () => {
    const a = generateGhosts(0, 0, 1)
    const b = generateGhosts(0, 0, 1)
    expect(a).toEqual(b)
    expect(a).toHaveLength(LADDER_SIZE - 1)
  })

  it('reshuffles across seasons', () => {
    const s1 = generateGhosts(0, 0, 1)
    const s2 = generateGhosts(0, 0, 2)
    expect(s1).not.toEqual(s2)
  })

  it('places the player and fills the ladder to LADDER_SIZE', () => {
    const p = createProfile('Ash')
    const ladder = buildLadder(p)
    expect(ladder).toHaveLength(LADDER_SIZE)
    expect(ladder.some((e) => e.isPlayer)).toBe(true)
  })

  it('a strong win streak climbs the player toward the top', () => {
    const rested = playerRank(createProfile('Ash'))
    const strong = playerRank(winStreak(createProfile('Ash'), 8))
    expect(strong).toBeLessThan(rested)
  })
})

describe('resolveSeason', () => {
  it('promotes a top-3 finish, awards the arena badge, advances the arena', () => {
    const strong = winStreak(createProfile('Ash'), 8)
    expect(playerRank(strong)).toBeLessThanOrEqual(3)
    const { profile, result } = resolveSeason(strong)
    expect(result.promoted).toBe(true)
    expect(result.badgeAwarded?.id).toBe('kanto-fels')
    expect(profile.earnedBadges).toHaveLength(1)
    expect(profile.arenaIndex).toBe(1)
    expect(profile.seasonId).toBe(2)
    expect(profile.seasonPoints).toBe(SEASON_START_POINTS)
  })

  it('does not award the same badge twice', () => {
    const strong = winStreak(createProfile('Ash'), 8)
    const once = resolveSeason(strong).profile
    // Force back to the same arena and resolve again from a top finish.
    const again = winStreak({ ...once, arenaIndex: 0, seasonPoints: SEASON_START_POINTS }, 8)
    const twice = resolveSeason(again).profile
    const kantoFels = twice.earnedBadges.filter((b) => b.badgeId === 'kanto-fels')
    expect(kantoFels).toHaveLength(1)
  })

  it('rolls over region on the 8th badge', () => {
    let p = createProfile('Ash')
    p = { ...p, arenaIndex: 7 }
    const strong = winStreak(p, 8)
    const { profile, result } = resolveSeason(strong)
    expect(result.regionCompleted).toBe(true)
    expect(profile.regionIndex).toBe(1)
    expect(profile.arenaIndex).toBe(0)
  })

  it('relegates a bottom finish but never below Kanto arena 0', () => {
    const weak = createProfile('Ash') // 0 wins → near bottom
    const { profile } = resolveSeason({ ...weak, seasonPoints: 0 })
    expect(profile.regionIndex).toBe(0)
    expect(profile.arenaIndex).toBe(0)
  })
})
