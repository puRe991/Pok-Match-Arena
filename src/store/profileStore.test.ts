import { beforeEach, describe, expect, it, vi } from 'vitest'
import { START_RATING } from '../profile/profile'

describe('profileStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('initializes with a valid default profile and start rating', async () => {
    const { useProfileStore } = await import('./profileStore')
    const s = useProfileStore.getState()
    expect(s.name).toMatch(/^Trainer-\d{4}$/)
    expect(s.playerId.length).toBeGreaterThan(0)
    expect(s.stats.rating).toBe(START_RATING)
    expect(s.matchHistory).toEqual([])
  })

  it('setName sanitizes input, rejects invalid names and keeps the old one', async () => {
    const { useProfileStore } = await import('./profileStore')
    expect(useProfileStore.getState().setName('  Ash   Ketchum ')).toBe(true)
    expect(useProfileStore.getState().name).toBe('Ash Ketchum')
    expect(useProfileStore.getState().setName('x')).toBe(false)
    expect(useProfileStore.getState().name).toBe('Ash Ketchum')
  })

  it('recordMatch for multiplayer updates elo, records history and streaks', async () => {
    const { useProfileStore } = await import('./profileStore')
    useProfileStore.getState().recordMatch({
      mode: 'multiplayer',
      result: 'win',
      opponentName: 'Gary',
      opponentRating: START_RATING,
      turns: 12,
    })
    let s = useProfileStore.getState()
    expect(s.stats.rating).toBe(START_RATING + 16)
    expect(s.stats.peakRating).toBe(START_RATING + 16)
    expect(s.stats.mpWins).toBe(1)
    expect(s.stats.winStreak).toBe(1)
    expect(s.matchHistory[0]).toMatchObject({
      mode: 'multiplayer',
      result: 'win',
      opponentName: 'Gary',
      ratingDelta: 16,
      ratingAfter: START_RATING + 16,
      turns: 12,
    })

    useProfileStore.getState().recordMatch({
      mode: 'multiplayer',
      result: 'loss',
      opponentName: 'Gary',
      opponentRating: START_RATING,
      turns: 8,
    })
    s = useProfileStore.getState()
    expect(s.stats.rating).toBeLessThan(START_RATING + 16)
    expect(s.stats.peakRating).toBe(START_RATING + 16)
    expect(s.stats.mpLosses).toBe(1)
    expect(s.stats.winStreak).toBe(0)
    expect(s.stats.bestStreak).toBe(1)
    expect(s.matchHistory).toHaveLength(2)
    expect(s.matchHistory[0].ratingDelta).toBeLessThan(0)
  })

  it('recordMatch for cpu games never touches the rating', async () => {
    const { useProfileStore } = await import('./profileStore')
    useProfileStore.getState().recordMatch({ mode: 'cpu', result: 'win', opponentName: 'CPU', turns: 5 })
    useProfileStore.getState().recordMatch({ mode: 'cpu', result: 'loss', opponentName: 'CPU', turns: 7 })
    const s = useProfileStore.getState()
    expect(s.stats.rating).toBe(START_RATING)
    expect(s.stats.cpuWins).toBe(1)
    expect(s.stats.cpuLosses).toBe(1)
    expect(s.matchHistory[0].ratingDelta).toBe(0)
    expect(s.matchHistory[0].ratingAfter).toBeNull()
  })

  it('uses START_RATING as fallback when the opponent rating is unknown', async () => {
    const { useProfileStore } = await import('./profileStore')
    useProfileStore.getState().recordMatch({ mode: 'multiplayer', result: 'win', opponentName: '???', turns: 3 })
    expect(useProfileStore.getState().stats.rating).toBe(START_RATING + 16)
  })

  it('caps the match history at 50 entries', async () => {
    const { useProfileStore } = await import('./profileStore')
    for (let i = 0; i < 55; i++) {
      useProfileStore.getState().recordMatch({ mode: 'cpu', result: 'win', opponentName: `CPU ${i}`, turns: 1 })
    }
    const s = useProfileStore.getState()
    expect(s.matchHistory).toHaveLength(50)
    expect(s.matchHistory[0].opponentName).toBe('CPU 54')
    expect(s.stats.cpuWins).toBe(55)
  })

  it('asPeerProfile exposes the wire-format profile', async () => {
    const { useProfileStore } = await import('./profileStore')
    useProfileStore.getState().setName('Ash')
    useProfileStore.getState().setAvatar('gengar')
    const peer = useProfileStore.getState().asPeerProfile()
    expect(peer).toEqual({
      playerId: useProfileStore.getState().playerId,
      name: 'Ash',
      avatarId: 'gengar',
      rating: START_RATING,
    })
  })

  it('persists profile data to localStorage', async () => {
    const { useProfileStore } = await import('./profileStore')
    useProfileStore.getState().setName('Ash')
    const raw = localStorage.getItem('pma-profile-v1')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).state.name).toBe('Ash')
  })
})
