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

let sessionPromise: Promise<string | null> | null = null

/**
 * Stellt (einmalig, gecacht) eine anonyme Session her, damit der Client für
 * RLS-geschützte Schreibzugriffe eine `auth.uid()` hat. Ist anonymes Login im
 * Projekt (noch) deaktiviert, wird der Fehler geschluckt und `null` geliefert –
 * die App läuft dann read-only weiter (Bestenliste) bzw. fällt lokal zurück.
 */
export function ensureAnonSession(): Promise<string | null> {
  if (!client) return Promise.resolve(null)
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await client.auth.getSession()
      if (data.session?.user) return data.session.user.id
      const { data: signed, error } = await client.auth.signInAnonymously()
      if (error) {
        // Anonyme Logins deaktiviert o. Ä. – nicht fatal.
        return null
      }
      return signed.user?.id ?? null
    })()
  }
  return sessionPromise
}
