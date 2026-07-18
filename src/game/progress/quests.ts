/** Lebenslange Fortschritts-Kennzahlen des Spielers. */
export interface ProgressStats {
  matchesPlayed: number
  matchesWon: number
  packsOpened: number
  cardsCollected: number
}

export const EMPTY_STATS: ProgressStats = {
  matchesPlayed: 0,
  matchesWon: 0,
  packsOpened: 0,
  cardsCollected: 0,
}

/** Kennzahlen, auf die sich Tagesquests beziehen (tageweise zurückgesetzt). */
export type QuestMetric = 'matchesPlayed' | 'matchesWon' | 'packsOpened'

export interface QuestDef {
  id: string
  metric: QuestMetric
  target: number
  reward: number
  label: string
}

/** Pool möglicher Tagesquests; jeden Tag wird deterministisch eine Auswahl gezogen. */
export const DAILY_QUEST_POOL: QuestDef[] = [
  { id: 'play1', metric: 'matchesPlayed', target: 1, reward: 20, label: 'Spiele 1 Duell' },
  { id: 'play3', metric: 'matchesPlayed', target: 3, reward: 50, label: 'Spiele 3 Duelle' },
  { id: 'win1', metric: 'matchesWon', target: 1, reward: 40, label: 'Gewinne 1 Duell' },
  { id: 'win2', metric: 'matchesWon', target: 2, reward: 80, label: 'Gewinne 2 Duelle' },
  { id: 'pack1', metric: 'packsOpened', target: 1, reward: 20, label: 'Öffne 1 Booster-Pack' },
  { id: 'pack2', metric: 'packsOpened', target: 2, reward: 40, label: 'Öffne 2 Booster-Packs' },
]

/** Kleiner deterministischer String-Hash (FNV-1a-Variante) für die Tages-Auswahl. */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Wählt für einen Tag (z. B. `'2026-07-18'`) deterministisch `count` verschiedene
 * Quests aus dem Pool – gleicher Tag ⇒ gleiche Quests (auch nach Reload).
 */
export function dailyQuestsFor(dateKey: string, count = 3): QuestDef[] {
  const pool = [...DAILY_QUEST_POOL]
  const chosen: QuestDef[] = []
  let seed = hashString(dateKey)
  while (chosen.length < count && pool.length > 0) {
    seed = (seed * 1103515245 + 12345) >>> 0
    const idx = seed % pool.length
    chosen.push(pool.splice(idx, 1)[0])
  }
  return chosen
}

export interface AchievementDef {
  id: string
  metric: keyof ProgressStats
  target: number
  reward: number
  label: string
  description: string
}

/** Dauerhafte Erfolge; werden bei Erreichen der Schwelle einmalig freigeschaltet. */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstWin', metric: 'matchesWon', target: 1, reward: 50, label: 'Erster Sieg', description: 'Gewinne dein erstes Duell.' },
  { id: 'win10', metric: 'matchesWon', target: 10, reward: 150, label: 'Arena-Kämpfer', description: 'Gewinne 10 Duelle.' },
  { id: 'win50', metric: 'matchesWon', target: 50, reward: 400, label: 'Champion', description: 'Gewinne 50 Duelle.' },
  { id: 'play25', metric: 'matchesPlayed', target: 25, reward: 100, label: 'Stammgast', description: 'Spiele 25 Duelle.' },
  { id: 'packs10', metric: 'packsOpened', target: 10, reward: 100, label: 'Sammler', description: 'Öffne 10 Booster-Packs.' },
  { id: 'packs50', metric: 'packsOpened', target: 50, reward: 300, label: 'Pack-Junkie', description: 'Öffne 50 Booster-Packs.' },
  { id: 'cards100', metric: 'cardsCollected', target: 100, reward: 200, label: 'Volle Mappe', description: 'Sammle 100 Karten.' },
]

export function achievementReached(def: AchievementDef, stats: ProgressStats): boolean {
  return stats[def.metric] >= def.target
}

export function questProgress(def: QuestDef, progress: Partial<Record<QuestMetric, number>>): number {
  return Math.min(def.target, progress[def.metric] ?? 0)
}

export function questComplete(def: QuestDef, progress: Partial<Record<QuestMetric, number>>): boolean {
  return questProgress(def, progress) >= def.target
}
