import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Erzeugt den Supabase-Client aus den Vite-Umgebungsvariablen. Sind sie nicht
 * gesetzt, liefert die Funktion `null` und die App fällt automatisch auf das
 * lokale Offline-Backend zurück.
 *
 * Benötigte Variablen (siehe `.env.example`):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null
if (url && anonKey) {
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
}

export const supabase = client
export const isSupabaseConfigured = client !== null
