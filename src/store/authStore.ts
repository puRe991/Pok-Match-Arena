import { create } from 'zustand'
import { supabase } from '../backend/supabaseClient'
import { useLeagueStore } from './leagueStore'

/**
 * Echte Account-Verwaltung über Supabase-Auth (E-Mail + Passwort). Die
 * Anmeldung ist die Identitätsgrundlage für spätere Anti-Cheat-Maßnahmen und
 * für gewertetes PvP. Ist Supabase nicht konfiguriert, ist `available` false
 * und die App läuft rein offline (Solo-Kampagne) weiter.
 */
interface AuthUser {
  id: string
  email: string | null
}

interface AuthState {
  available: boolean
  user: AuthUser | null
  status: 'loading' | 'signedOut' | 'signedIn'
  busy: boolean
  error: string | null

  init: () => void
  signUp: (email: string, password: string, handle: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  clearError: () => void
}

let initialized = false

export const useAuthStore = create<AuthState>((set) => ({
  available: supabase !== null,
  user: null,
  status: supabase ? 'loading' : 'signedOut',
  busy: false,
  error: null,

  init: () => {
    if (!supabase || initialized) return
    initialized = true
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      const user = u ? { id: u.id, email: u.email ?? null } : null
      set({ user, status: user ? 'signedIn' : 'signedOut' })
      if (user) void useLeagueStore.getState().bindAccount(user.id)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      const user = u ? { id: u.id, email: u.email ?? null } : null
      set({ user, status: user ? 'signedIn' : 'signedOut' })
      if (user) void useLeagueStore.getState().bindAccount(user.id)
    })
  },

  signUp: async (email, password, handle) => {
    if (!supabase) return false
    set({ busy: true, error: null })
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) {
      set({ busy: false, error: error.message })
      return false
    }
    if (data.user) await useLeagueStore.getState().bindAccount(data.user.id, handle)
    set({ busy: false })
    return true
  },

  signIn: async (email, password) => {
    if (!supabase) return false
    set({ busy: true, error: null })
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      set({ busy: false, error: error.message })
      return false
    }
    set({ busy: false })
    return true
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    set({ user: null, status: 'signedOut' })
  },

  clearError: () => set({ error: null }),
}))
