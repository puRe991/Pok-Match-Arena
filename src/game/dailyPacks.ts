/**
 * Tägliche Gratis-Boosterpacks im Stil von Pokémon TCG Pocket:
 * Jeder Spieler kann pro Kalendertag (lokale Zeit) zwei kostenlose
 * Boosterpacks öffnen. Um Mitternacht wird das Kontingent zurückgesetzt.
 */

export const DAILY_FREE_PACKS = 2

export interface DailyFreeState {
  /** Kalendertag (lokale Zeit) im Format YYYY-MM-DD, für den `opened` gilt. */
  day: string
  /** Anzahl der an diesem Tag bereits geöffneten Gratis-Packs. */
  opened: number
}

export function dayKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function remainingFreePacks(state: DailyFreeState | null | undefined, now: Date = new Date()): number {
  if (!state || state.day !== dayKey(now)) return DAILY_FREE_PACKS
  return Math.max(0, DAILY_FREE_PACKS - state.opened)
}

/** Verbraucht ein Gratis-Pack und liefert den neuen Zählerstand für heute. */
export function consumeFreePack(state: DailyFreeState | null | undefined, now: Date = new Date()): DailyFreeState {
  const key = dayKey(now)
  if (!state || state.day !== key) return { day: key, opened: 1 }
  return { day: key, opened: state.opened + 1 }
}

/** Nächster Reset-Zeitpunkt: Mitternacht (lokale Zeit) des Folgetags. */
export function nextResetAt(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
}

export function msUntilReset(now: Date = new Date()): number {
  return Math.max(0, nextResetAt(now).getTime() - now.getTime())
}

/** Formatiert die Restzeit bis zum Reset als "HH:MM:SS". */
export function formatTimeUntilReset(now: Date = new Date()): string {
  const totalSeconds = Math.ceil(msUntilReset(now) / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
