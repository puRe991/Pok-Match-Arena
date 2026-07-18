import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { leagueBackend, type LeaderboardRow } from '../backend'
import { buildLadder, playerRank } from '../game/ranked/ghosts'
import { applyMatch, createProfile, resolveSeason } from '../game/ranked/season'
import type { LadderEntry, RankedProfile, SeasonResult } from '../game/ranked/types'

function randomHandle(): string {
  return `Trainer-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

/** Gegner-Elo für ein gewertetes CPU-Match: leicht über Spielerstärke, mit der Region skalierend. */
export function opponentEloFor(profile: RankedProfile): number {
  return profile.careerElo + profile.regionIndex * 12 + profile.arenaIndex * 4
}

interface LeagueState {
  profile: RankedProfile | null
  leaderboard: LeaderboardRow[]
  loadingLeaderboard: boolean
  lastResult: SeasonResult | null
  lastEloDelta: number | null
  backendKind: 'local' | 'supabase'

  ensureProfile: () => RankedProfile
  setHandle: (handle: string) => void
  ladder: () => LadderEntry[]
  rank: () => number
  reportMatchResult: (won: boolean) => void
  endSeason: () => SeasonResult | null
  clearResult: () => void
  refreshLeaderboard: () => Promise<void>
}

export const useLeagueStore = create<LeagueState>()(
  persist(
    (set, get) => ({
      profile: null,
      leaderboard: [],
      loadingLeaderboard: false,
      lastResult: null,
      lastEloDelta: null,
      backendKind: leagueBackend.kind,

      ensureProfile: () => {
        const existing = get().profile
        if (existing) return existing
        const profile = createProfile(randomHandle())
        set({ profile })
        void leagueBackend.syncProfile(profile)
        return profile
      },

      setHandle: (handle: string) => {
        const trimmed = handle.trim().slice(0, 20)
        if (!trimmed) return
        const profile = get().profile ?? createProfile(trimmed)
        const next = { ...profile, handle: trimmed, updatedAt: Date.now() }
        set({ profile: next })
        void leagueBackend.syncProfile(next)
      },

      ladder: () => {
        const profile = get().profile
        return profile ? buildLadder(profile) : []
      },

      rank: () => {
        const profile = get().profile
        return profile ? playerRank(profile) : 0
      },

      reportMatchResult: (won: boolean) => {
        const profile = get().ensureProfile()
        const { profile: next, eloDelta } = applyMatch(profile, opponentEloFor(profile), won)
        set({ profile: next, lastEloDelta: eloDelta })
        void leagueBackend.syncProfile(next)
      },

      endSeason: () => {
        const profile = get().profile
        if (!profile) return null
        const { profile: next, result } = resolveSeason(profile)
        set({ profile: next, lastResult: result })
        void leagueBackend.syncProfile(next)
        return result
      },

      clearResult: () => set({ lastResult: null, lastEloDelta: null }),

      refreshLeaderboard: async () => {
        const profile = get().ensureProfile()
        set({ loadingLeaderboard: true })
        try {
          const rows = await leagueBackend.fetchLeaderboard(profile)
          set({ leaderboard: rows })
        } finally {
          set({ loadingLeaderboard: false })
        }
      },
    }),
    {
      name: 'pma-league-v1',
      partialize: (s) => ({ profile: s.profile }),
    },
  ),
)
