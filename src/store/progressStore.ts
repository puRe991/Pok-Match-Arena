import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { dayKey } from '../game/dailyPacks'
import {
  ACHIEVEMENTS,
  EMPTY_STATS,
  achievementReached,
  dailyQuestsFor,
  questComplete,
  type ProgressStats,
  type QuestMetric,
} from '../game/progress/quests'

/** Startguthaben für neue Spieler. */
const STARTING_COINS = 100

export interface DailyQuestState {
  day: string
  progress: Partial<Record<QuestMetric, number>>
  claimed: string[]
}

interface ProgressState {
  coins: number
  stats: ProgressStats
  /** IDs bereits ausgezahlter Erfolge (verhindert doppelte Belohnung). */
  claimedAchievements: string[]
  daily: DailyQuestState | null

  recordMatch: (won: boolean) => void
  recordPackOpened: (cardsAdded: number) => void
  addCoins: (n: number) => void
  spendCoins: (n: number) => boolean
  claimQuest: (id: string) => boolean
  ensureDaily: () => void
}

function freshDaily(): DailyQuestState {
  return { day: dayKey(), progress: {}, claimed: [] }
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => {
      /** Zählt Erfolge aus, zahlt neue einmalig aus und liefert die Coin-Summe. */
      function grantAchievements(stats: ProgressStats, claimed: string[]): { claimed: string[]; reward: number } {
        let reward = 0
        const nextClaimed = [...claimed]
        for (const def of ACHIEVEMENTS) {
          if (nextClaimed.includes(def.id)) continue
          if (achievementReached(def, stats)) {
            nextClaimed.push(def.id)
            reward += def.reward
          }
        }
        return { claimed: nextClaimed, reward }
      }

      function bumpDaily(metric: QuestMetric, amount: number, daily: DailyQuestState | null): DailyQuestState {
        const today = dayKey()
        const base = daily && daily.day === today ? daily : freshDaily()
        return {
          ...base,
          progress: { ...base.progress, [metric]: (base.progress[metric] ?? 0) + amount },
        }
      }

      return {
        coins: STARTING_COINS,
        stats: { ...EMPTY_STATS },
        claimedAchievements: [],
        daily: null,

        recordMatch: (won: boolean) => {
          set((state) => {
            const stats: ProgressStats = {
              ...state.stats,
              matchesPlayed: state.stats.matchesPlayed + 1,
              matchesWon: state.stats.matchesWon + (won ? 1 : 0),
            }
            let daily = bumpDaily('matchesPlayed', 1, state.daily)
            if (won) daily = bumpDaily('matchesWon', 1, daily)
            const { claimed, reward } = grantAchievements(stats, state.claimedAchievements)
            // Basis-Belohnung: Sieg 25, Niederlage 10 Münzen.
            const coins = state.coins + (won ? 25 : 10) + reward
            return { stats, daily, claimedAchievements: claimed, coins }
          })
        },

        recordPackOpened: (cardsAdded: number) => {
          set((state) => {
            const stats: ProgressStats = {
              ...state.stats,
              packsOpened: state.stats.packsOpened + 1,
              cardsCollected: state.stats.cardsCollected + Math.max(0, cardsAdded),
            }
            const daily = bumpDaily('packsOpened', 1, state.daily)
            const { claimed, reward } = grantAchievements(stats, state.claimedAchievements)
            return { stats, daily, claimedAchievements: claimed, coins: state.coins + reward }
          })
        },

        addCoins: (n: number) => set((state) => ({ coins: state.coins + Math.max(0, n) })),

        spendCoins: (n: number) => {
          if (n <= 0 || get().coins < n) return false
          set((state) => ({ coins: state.coins - n }))
          return true
        },

        claimQuest: (id: string) => {
          const state = get()
          const today = dayKey()
          const daily = state.daily && state.daily.day === today ? state.daily : freshDaily()
          if (daily.claimed.includes(id)) return false
          const quest = dailyQuestsFor(today).find((q) => q.id === id)
          if (!quest || !questComplete(quest, daily.progress)) return false
          set({
            daily: { ...daily, claimed: [...daily.claimed, id] },
            coins: state.coins + quest.reward,
          })
          return true
        },

        ensureDaily: () => {
          const state = get()
          const today = dayKey()
          if (!state.daily || state.daily.day !== today) {
            set({ daily: freshDaily() })
          }
        },
      }
    },
    { name: 'pma-progress' },
  ),
)
