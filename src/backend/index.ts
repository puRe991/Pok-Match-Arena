import type { LeagueBackend } from './leagueBackend'
import { LocalLeagueBackend } from './localLeagueBackend'
import { supabase } from './supabaseClient'
import { SupabaseLeagueBackend } from './supabaseLeagueBackend'

/**
 * Wählt das Backend: Supabase, sobald `VITE_SUPABASE_*` konfiguriert ist,
 * sonst das lokale Offline-Backend.
 */
export const leagueBackend: LeagueBackend = supabase
  ? new SupabaseLeagueBackend(supabase)
  : new LocalLeagueBackend()

export type { LeagueBackend, LeaderboardRow } from './leagueBackend'
