import type { SupabaseClient } from '@supabase/supabase-js'
import type { RankedProfile } from '../game/ranked/types'
import type { LeaderboardRow, LeagueBackend } from './leagueBackend'
import { LocalLeagueBackend } from './localLeagueBackend'
import { ensureAnonSession } from './supabaseClient'

const NETWORK_TIMEOUT_MS = 6000

/** Bricht ein hängendes Netzwerk-Promise nach `ms` mit dem Fallback-Wert ab. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

/**
 * Zentrales Backend über Supabase. Das Elo/die Division werden serverseitig
 * per Edge Function autoritativ gesetzt (siehe supabase/migrations); dieser
 * Client liest die Bestenliste und meldet Profil-Metadaten (Handle).
 *
 * Solange die Tabellen noch nicht angelegt oder anonyme Logins deaktiviert
 * sind, fällt das Backend transparent auf die lokale Ghost-Simulation zurück,
 * damit die App zu jedem Einrichtungszeitpunkt funktioniert.
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
  private fallback = new LocalLeagueBackend()

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async syncProfile(profile: RankedProfile): Promise<void> {
    try {
      const id = await withTimeout(ensureAnonSession(), NETWORK_TIMEOUT_MS, null)
      if (!id) return
      // Nur nicht-gewertete Metadaten werden vom Client geschrieben. Elo/Division
      // sind serverseitig geschützt (RLS) und werden hier nicht überschrieben.
      await withTimeout(
        Promise.resolve(this.client.from('profiles').upsert({ id, handle: profile.handle }, { onConflict: 'id' })),
        NETWORK_TIMEOUT_MS,
        undefined,
      )
    } catch {
      // Netzwerk/Backend nicht bereit – Profil bleibt lokal erhalten.
    }
  }

  async fetchLeaderboard(player: RankedProfile, limit = 20): Promise<LeaderboardRow[]> {
    // Lesen der Bestenliste braucht keine Anmeldung (RLS: public read). Bei
    // Timeout/Fehler/leerer Tabelle wird die lokale Ghost-Liste gezeigt, damit
    // die UI nie hängt oder leer bleibt.
    const local = await this.fallback.fetchLeaderboard(player, limit)
    const query = this.client
      .from('profiles')
      .select('handle, elo, division, badges')
      .order('elo', { ascending: false })
      .limit(limit)
    const { data, error } = await withTimeout(
      Promise.resolve(query).then((r) => r).catch(() => ({ data: null, error: true as const })),
      NETWORK_TIMEOUT_MS,
      { data: null, error: true as const },
    )

    if (error || !data || data.length === 0) {
      return local
    }

    const rows = (data as ProfileRow[]).map((row) => ({
      handle: row.handle,
      careerElo: row.elo,
      regionIndex: Math.max(0, row.division - 1),
      badges: row.badges ?? 0,
      isPlayer: row.handle === player.handle,
    }))
    if (!rows.some((r) => r.isPlayer)) {
      rows.push({
        handle: player.handle,
        careerElo: player.careerElo,
        regionIndex: player.regionIndex,
        badges: player.earnedBadges.length,
        isPlayer: true,
      })
      rows.sort((a, b) => b.careerElo - a.careerElo)
    }
    return rows.slice(0, limit)
  }
}
