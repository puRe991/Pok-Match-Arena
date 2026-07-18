import type { ElementType } from '../types'

/**
 * Ein Orden einer Arena (Gym). Jede Region hat 8 Arenen; jede Arena verleiht
 * bei Aufstieg ihren Orden.
 */
export interface Badge {
  /** Global eindeutige ID, z. B. 'kanto-boulder'. */
  id: string
  /** Anzeigename, z. B. 'Felsorden'. */
  name: string
  /** Arena-Leiter, z. B. 'Rocko'. */
  leader: string
  /** Kanonisches Typ-Thema der Arena (nur Anzeige), z. B. 'Gestein'. */
  gymType: string
  /** Auf die 7 Spiel-Typen gemapptes Deck-/Farb-Thema. */
  themeType: ElementType
}

/**
 * Eine Region = eine Division im Liga-System (Divisionen = Regionen).
 * `arenas` sind die 8 Sub-Ränge innerhalb der Division.
 */
export interface Region {
  id: string
  /** 0-basierter Index, zugleich Division 1..9 (index + 1). */
  index: number
  name: string
  /** Spiele der Herkunft (nur Anzeige). */
  games: string
  badges: Badge[]
}

/** Ein erspielter Orden im Spielerprofil (dauerhaft). */
export interface EarnedBadge {
  badgeId: string
  seasonId: number
  finalRank: number
  earnedAt: number
}

/**
 * Spielerprofil des Liga-Systems. Wird lokal persistiert und – falls Supabase
 * konfiguriert ist – zusätzlich zentral gespiegelt.
 */
export interface RankedProfile {
  handle: string
  /** Aktuelle Region (0-basiert). */
  regionIndex: number
  /** Aktuelle Arena innerhalb der Region (0..7). */
  arenaIndex: number
  /** Lebenslanges Elo für die globale Bestenliste / Meister-Liga. */
  careerElo: number
  /** Season-Punkte der aktuellen Arena (Ladder-Metrik, wird pro Season resettet). */
  seasonPoints: number
  wins: number
  losses: number
  earnedBadges: EarnedBadge[]
  seasonId: number
  updatedAt: number
}

/** Ein Eintrag in der Arena-Rangliste (Spieler oder Ghost-Trainer). */
export interface LadderEntry {
  id: string
  handle: string
  seasonPoints: number
  careerElo: number
  isPlayer: boolean
}

/** Ergebnis einer Season-Wertung. */
export interface SeasonResult {
  promoted: boolean
  relegated: boolean
  /** Falls durch Aufstieg ein Orden verliehen wurde. */
  badgeAwarded: Badge | null
  /** Erreichte Region ist komplett (alle 8 Orden) → Champion. */
  regionCompleted: boolean
  finalRank: number
  previousRegionIndex: number
  previousArenaIndex: number
}
