import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { leagueBackend, type LeaderboardRow } from '../backend'
import { supabase } from '../backend/supabaseClient'
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
  /** Serverautoritatives PvP-Elo des angemeldeten Accounts (aus profiles). */
  serverElo: number | null

  ensureProfile: () => RankedProfile
  setHandle: (handle: string) => void
  ladder: () => LadderEntry[]
  rank: () => number
  reportMatchResult: (won: boolean) => void
  endSeason: () => SeasonResult | null
  clearResult: () => void
  refreshLeaderboard: () => Promise<void>
  /** Verbindet den echten Account mit dem Liga-Profil (Upsert + Server-Elo laden). */
  bindAccount: (userId: string, handle?: string) => Promise<void>
  /** Lädt das serverseitige PvP-Elo neu (z. B. nach einem gewerteten Match). */
  refreshServerProfile: () => Promise<void>
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
      serverElo: null,

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

      bindAccount: async (userId: string, handle?: string) => {
        const profile = get().ensureProfile()
        if (handle && handle.trim()) get().setHandle(handle)
        if (!supabase) return
        const finalHandle = get().profile?.handle ?? profile.handle
        // Profilzeile anlegen/aktualisieren (nur Handle; Elo ist serverseitig geschützt).
        await supabase.from('profiles').upsert({ id: userId, handle: finalHandle }, { onConflict: 'id' })
        await get().refreshServerProfile()
      },

      refreshServerProfile: async () => {
        if (!supabase) return
        const { data } = await supabase.auth.getSession()
        const id = data.session?.user?.id
        if (!id) {
          set({ serverElo: null })
          return
        }
        const { data: row } = await supabase.from('profiles').select('elo, handle').eq('id', id).maybeSingle()
        if (row) {
          set({ serverElo: (row as { elo: number }).elo })
          const serverHandle = (row as { handle?: string }).handle
          const current = get().profile
          if (serverHandle && current && current.handle !== serverHandle) {
            set({ profile: { ...current, handle: serverHandle } })
          }
        }
      },
    }),
    {
      name: 'pma-league-v1',
      partialize: (s) => ({ profile: s.profile }),
    },
  ),
)
