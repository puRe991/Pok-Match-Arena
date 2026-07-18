import type { RankedProfile } from '../game/ranked/types'

/** Eine Zeile der globalen Bestenliste (Meister-Liga). */
export interface LeaderboardRow {
  handle: string
  careerElo: number
  regionIndex: number
  badges: number
  isPlayer: boolean
}

/**
 * Abstraktion über den Liga-Zustand. Zwei Implementierungen:
 * - `LocalLeagueBackend`: offline, Bestenliste aus Ghost-Trainern (Default).
 * - `SupabaseLeagueBackend`: zentral, sobald `VITE_SUPABASE_*` gesetzt ist.
 */
export interface LeagueBackend {
  readonly kind: 'local' | 'supabase'
  /** Spielt das Profil zurück ins Backend (Upsert). Lokal ein No-op. */
  syncProfile(profile: RankedProfile): Promise<void>
  /** Globale Bestenliste, absteigend nach Elo. Der Spieler ist markiert. */
  fetchLeaderboard(player: RankedProfile, limit?: number): Promise<LeaderboardRow[]>
}
