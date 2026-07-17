import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_AVATAR_ID,
  START_RATING,
  eloDelta,
  generateDefaultName,
  generatePlayerId,
  isValidUsername,
  sanitizeUsername,
  type PeerProfile,
} from '../profile/profile'

export type MatchMode = 'cpu' | 'multiplayer'
export type MatchResult = 'win' | 'loss'

export interface MatchRecord {
  id: string
  mode: MatchMode
  result: MatchResult
  opponentName: string
  opponentAvatarId: string | null
  /** Elo-Änderung; 0 bei CPU-Partien. */
  ratingDelta: number
  ratingAfter: number | null
  turns: number
  endedAt: number
}

export interface ProfileStats {
  rating: number
  peakRating: number
  mpWins: number
  mpLosses: number
  cpuWins: number
  cpuLosses: number
  winStreak: number
  bestStreak: number
}

const MAX_HISTORY = 50

function initialStats(): ProfileStats {
  return {
    rating: START_RATING,
    peakRating: START_RATING,
    mpWins: 0,
    mpLosses: 0,
    cpuWins: 0,
    cpuLosses: 0,
    winStreak: 0,
    bestStreak: 0,
  }
}

export interface RecordMatchInput {
  mode: MatchMode
  result: MatchResult
  opponentName: string
  opponentAvatarId?: string | null
  /** Gegner-Rating für die Elo-Berechnung; nur bei Multiplayer relevant. */
  opponentRating?: number | null
  turns: number
}

interface ProfileState {
  playerId: string
  name: string
  avatarId: string
  createdAt: number
  stats: ProfileStats
  matchHistory: MatchRecord[]

  setName: (raw: string) => boolean
  setAvatar: (avatarId: string) => void
  recordMatch: (input: RecordMatchInput) => void
  asPeerProfile: () => PeerProfile
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      playerId: generatePlayerId(),
      name: generateDefaultName(),
      avatarId: DEFAULT_AVATAR_ID,
      createdAt: Date.now(),
      stats: initialStats(),
      matchHistory: [],

      setName: (raw: string) => {
        const name = sanitizeUsername(raw)
        if (!isValidUsername(name)) return false
        set({ name })
        return true
      },

      setAvatar: (avatarId: string) => set({ avatarId }),

      recordMatch: (input: RecordMatchInput) => {
        set((state) => {
          const stats = { ...state.stats }
          const won = input.result === 'win'
          let ratingDelta = 0
          let ratingAfter: number | null = null

          if (input.mode === 'multiplayer') {
            const oppRating = input.opponentRating ?? START_RATING
            ratingDelta = eloDelta(stats.rating, oppRating, won ? 1 : 0)
            stats.rating = Math.max(0, stats.rating + ratingDelta)
            stats.peakRating = Math.max(stats.peakRating, stats.rating)
            ratingAfter = stats.rating
            if (won) stats.mpWins += 1
            else stats.mpLosses += 1
          } else {
            if (won) stats.cpuWins += 1
            else stats.cpuLosses += 1
          }

          stats.winStreak = won ? stats.winStreak + 1 : 0
          stats.bestStreak = Math.max(stats.bestStreak, stats.winStreak)

          const record: MatchRecord = {
            id: generatePlayerId(),
            mode: input.mode,
            result: input.result,
            opponentName: input.opponentName,
            opponentAvatarId: input.opponentAvatarId ?? null,
            ratingDelta,
            ratingAfter,
            turns: input.turns,
            endedAt: Date.now(),
          }

          return { stats, matchHistory: [record, ...state.matchHistory].slice(0, MAX_HISTORY) }
        })
      },

      asPeerProfile: () => {
        const { playerId, name, avatarId, stats } = get()
        return { playerId, name, avatarId, rating: stats.rating }
      },
    }),
    { name: 'pma-profile-v1' },
  ),
)
