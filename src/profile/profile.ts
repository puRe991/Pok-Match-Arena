export const MIN_NAME_LENGTH = 3
export const MAX_NAME_LENGTH = 16
export const START_RATING = 1000
export const ELO_K = 32

/** Profildaten, die über die Multiplayer-Verbindung ausgetauscht werden. */
export interface PeerProfile {
  playerId: string
  name: string
  avatarId: string
  rating: number
}

export interface AvatarDef {
  id: string
  emoji: string
  label: string
}

export const AVATARS: AvatarDef[] = [
  { id: 'pikachu', emoji: '⚡', label: 'Blitz' },
  { id: 'charizard', emoji: '🔥', label: 'Flamme' },
  { id: 'blastoise', emoji: '💧', label: 'Welle' },
  { id: 'venusaur', emoji: '🌿', label: 'Blatt' },
  { id: 'mewtwo', emoji: '🔮', label: 'Psycho' },
  { id: 'machamp', emoji: '🥊', label: 'Faust' },
  { id: 'snorlax', emoji: '😴', label: 'Relaxo' },
  { id: 'gengar', emoji: '👻', label: 'Geist' },
  { id: 'dragonite', emoji: '🐉', label: 'Drache' },
  { id: 'eevee', emoji: '⭐', label: 'Stern' },
  { id: 'articuno', emoji: '❄️', label: 'Frost' },
  { id: 'masterball', emoji: '🏆', label: 'Champion' },
]

export const DEFAULT_AVATAR_ID = AVATARS[0].id

export function avatarById(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

/** Entfernt Rand-Whitespace und fasst inneres Whitespace zu einzelnen Leerzeichen zusammen. */
export function sanitizeUsername(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u

/** Prüft einen (bereits sanitisierten) Nutzernamen. Leeres Array = gültig. */
export function validateUsername(name: string): string[] {
  const errors: string[] = []
  if (name.length < MIN_NAME_LENGTH) errors.push(`Mindestens ${MIN_NAME_LENGTH} Zeichen.`)
  if (name.length > MAX_NAME_LENGTH) errors.push(`Maximal ${MAX_NAME_LENGTH} Zeichen.`)
  if (name.length > 0 && !NAME_PATTERN.test(name))
    errors.push('Nur Buchstaben, Zahlen, Leerzeichen sowie _ . - erlaubt (muss mit Buchstabe oder Zahl beginnen).')
  return errors
}

export function isValidUsername(name: string): boolean {
  return validateUsername(name).length === 0
}

export function generateDefaultName(): string {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `Trainer-${num}`
}

export function generatePlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Erwarteter Score (0..1) von Spieler A gegen Spieler B nach Elo. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

/**
 * Elo-Änderung für einen Spieler. `score` ist 1 (Sieg), 0 (Niederlage) oder 0.5 (Remis).
 * Das Ergebnis ist gerundet und kann negativ sein.
 */
export function eloDelta(rating: number, opponentRating: number, score: 0 | 0.5 | 1, k: number = ELO_K): number {
  return Math.round(k * (score - expectedScore(rating, opponentRating)))
}

export interface RankTier {
  id: string
  label: string
  minRating: number
  icon: string
  colorClass: string
}

export const RANK_TIERS: RankTier[] = [
  { id: 'bronze', label: 'Bronze', minRating: 0, icon: '🥉', colorClass: 'text-amber-600' },
  { id: 'silver', label: 'Silber', minRating: 1000, icon: '🥈', colorClass: 'text-slate-300' },
  { id: 'gold', label: 'Gold', minRating: 1150, icon: '🥇', colorClass: 'text-yellow-400' },
  { id: 'platinum', label: 'Platin', minRating: 1300, icon: '💎', colorClass: 'text-cyan-300' },
  { id: 'master', label: 'Meister', minRating: 1500, icon: '👑', colorClass: 'text-purple-300' },
]

export function rankForRating(rating: number): RankTier {
  let current = RANK_TIERS[0]
  for (const tier of RANK_TIERS) {
    if (rating >= tier.minRating) current = tier
  }
  return current
}

/** Nächster Rang oberhalb des aktuellen Ratings, oder null wenn bereits Höchstrang. */
export function nextRank(rating: number): RankTier | null {
  return RANK_TIERS.find((t) => t.minRating > rating) ?? null
}

export function winRate(wins: number, losses: number): number | null {
  const total = wins + losses
  if (total === 0) return null
  return Math.round((wins / total) * 100)
}
