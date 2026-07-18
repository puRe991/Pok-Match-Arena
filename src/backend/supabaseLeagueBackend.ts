import type { SupabaseClient } from '@supabase/supabase-js'
import type { RankedProfile } from '../game/ranked/types'
import type { LeaderboardRow, LeagueBackend } from './leagueBackend'

/**
 * Zentrales Backend über Supabase. Das Elo/die Division werden serverseitig
 * per Edge Function autoritativ gesetzt (siehe supabase/migrations); dieser
 * Client liest die Bestenliste und meldet Profil-Metadaten (Handle) sowie
 * Match-Ergebnisse. Für den Offline-Betrieb existiert `LocalLeagueBackend`.
 */
interface ProfileRow {
  handle: string
  elo: number
  division: number
  badges: number
}

export class SupabaseLeagueBackend implements LeagueBackend {
  readonly kind = 'supabase' as const
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async syncProfile(profile: RankedProfile): Promise<void> {
    const { data: auth } = await this.client.auth.getUser()
    const id = auth.user?.id
    if (!id) return
    // Nur nicht-gewertete Metadaten werden vom Client geschrieben. Elo/Division
    // sind serverseitig geschützt (RLS) und werden hier nicht überschrieben.
    await this.client.from('profiles').upsert({ id, handle: profile.handle }, { onConflict: 'id' })
  }

  async fetchLeaderboard(player: RankedProfile, limit = 20): Promise<LeaderboardRow[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('handle, elo, division, badges')
      .order('elo', { ascending: false })
      .limit(limit)
    if (error || !data) {
      return [
        {
          handle: player.handle,
          careerElo: player.careerElo,
          regionIndex: player.regionIndex,
          badges: player.earnedBadges.length,
          isPlayer: true,
        },
      ]
    }
    return (data as ProfileRow[]).map((row) => ({
      handle: row.handle,
      careerElo: row.elo,
      regionIndex: Math.max(0, row.division - 1),
      badges: row.badges ?? 0,
      isPlayer: row.handle === player.handle,
    }))
  }
}
