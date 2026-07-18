import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

/**
 * Account-Verwaltung: Registrierung / Login per E-Mail + Passwort. Bei
 * angemeldetem Nutzer wird der Account samt Abmelden-Button gezeigt. Ist keine
 * Online-Liga konfiguriert, erscheint ein dezenter Hinweis.
 */
export function AuthPanel() {
  const available = useAuthStore((s) => s.available)
  const user = useAuthStore((s) => s.user)
  const busy = useAuthStore((s) => s.busy)
  const error = useAuthStore((s) => s.error)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const signOut = useAuthStore((s) => s.signOut)
  const clearError = useAuthStore((s) => s.clearError)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [handle, setHandle] = useState('')

  if (!available) {
    return (
      <p className="rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs text-slate-400">
        ○ Offline-Modus – ohne Supabase-Konfiguration keine Accounts/PvP. Solo-Kampagne ist voll spielbar.
      </p>
    )
  }

  if (user) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-700/50 bg-emerald-500/10 px-3 py-2">
        <span className="truncate text-sm text-emerald-200">● Angemeldet: {user.email}</span>
        <button type="button" onClick={() => void signOut()} className="ml-3 text-xs text-slate-300 hover:text-white">
          Abmelden
        </button>
      </div>
    )
  }

  const submit = async () => {
    if (mode === 'login') await signIn(email, password)
    else await signUp(email, password, handle)
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('login')
            clearError()
          }}
          className={`flex-1 rounded-full px-3 py-1 text-xs font-bold ${mode === 'login' ? 'bg-yellow-500 text-slate-900' : 'text-slate-300'}`}
        >
          Anmelden
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register')
            clearError()
          }}
          className={`flex-1 rounded-full px-3 py-1 text-xs font-bold ${mode === 'register' ? 'bg-yellow-500 text-slate-900' : 'text-slate-300'}`}
        >
          Registrieren
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {mode === 'register' && (
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="Trainername"
            maxLength={20}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          type="email"
          autoComplete="email"
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort (min. 6 Zeichen)"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
        />
        {error && <p className="text-xs text-amber-400">{error}</p>}
        <button
          type="button"
          disabled={busy || !email || password.length < 6 || (mode === 'register' && !handle.trim())}
          onClick={() => void submit()}
          className="rounded-full bg-yellow-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-yellow-400 disabled:opacity-40"
        >
          {busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Account erstellen'}
        </button>
      </div>
    </div>
  )
}
