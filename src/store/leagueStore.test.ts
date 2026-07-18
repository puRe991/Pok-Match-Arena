import { beforeEach, describe, expect, it } from 'vitest'
import { opponentEloFor, useLeagueStore } from './leagueStore'
import { createProfile } from '../game/ranked/season'

function reset() {
  useLeagueStore.setState({ profile: null, leaderboard: [], lastResult: null, lastEloDelta: null })
}

describe('leagueStore', () => {
  beforeEach(reset)

  it('creates a profile on demand and keeps it stable', () => {
    const first = useLeagueStore.getState().ensureProfile()
    const second = useLeagueStore.getState().ensureProfile()
    expect(first).toBe(second)
    expect(first.regionIndex).toBe(0)
  })

  it('records a ranked win: elo up, ladder rank improves', () => {
    useLeagueStore.getState().ensureProfile()
    const before = useLeagueStore.getState().rank()
    for (let i = 0; i < 8; i++) useLeagueStore.getState().reportMatchResult(true)
    const after = useLeagueStore.getState().rank()
    const profile = useLeagueStore.getState().profile!
    expect(profile.wins).toBe(8)
    expect(profile.careerElo).toBeGreaterThan(1000)
    expect(after).toBeLessThanOrEqual(before)
    expect(useLeagueStore.getState().lastEloDelta).not.toBeNull()
  })

  it('endSeason promotes a top finisher and stores the result', () => {
    useLeagueStore.getState().ensureProfile()
    for (let i = 0; i < 8; i++) useLeagueStore.getState().reportMatchResult(true)
    const result = useLeagueStore.getState().endSeason()
    expect(result?.promoted).toBe(true)
    expect(useLeagueStore.getState().profile!.arenaIndex).toBe(1)
    expect(useLeagueStore.getState().lastResult?.badgeAwarded?.id).toBe('kanto-fels')
  })

  it('scales opponent elo with region and arena', () => {
    const base = createProfile('X')
    const deep = { ...base, regionIndex: 3, arenaIndex: 5 }
    expect(opponentEloFor(deep)).toBeGreaterThan(opponentEloFor(base))
  })

  it('setHandle trims and caps length', () => {
    useLeagueStore.getState().ensureProfile()
    useLeagueStore.getState().setHandle('   Ash Ketchum der Allergrößte   ')
    expect(useLeagueStore.getState().profile!.handle).toBe('Ash Ketchum der Alle')
  })
})
