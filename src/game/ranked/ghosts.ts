import { BASE_ELO } from './elo'
import type { LadderEntry, RankedProfile } from './types'

/**
 * "Ghost"-Trainer füllen die Arena-Rangliste, solange (noch) kein echtes
 * Backend mit echten Gegnern angebunden ist. Ihre Season-Punkte werden
 * deterministisch aus (Region, Arena, Season) erzeugt, damit die Tabelle
 * innerhalb einer Season stabil ist, sich aber jede Season neu mischt und mit
 * steigender Region/Arena schwerer wird.
 */

export const LADDER_SIZE = 10
export const PROMOTION_SLOTS = 3
export const RELEGATION_SLOTS = 2

const GHOST_NAMES = [
  'Rot', 'Blau', 'Gary', 'Ash', 'Silber', 'Lyra', 'Brendan', 'Maike',
  'Lucas', 'Cynthia', 'Hilbert', 'Rosa', 'Calem', 'Serena', 'Elio',
  'Selene', 'Victor', 'Gloria', 'Nemo', 'Karim', 'Juliana', 'Trace',
  'Nora', 'Ben', 'Mia', 'Leon', 'Kai', 'Sonia', 'Bea', 'Marnie',
]

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Erzeugt die Ghost-Einträge für eine Arena-Season (ohne den Spieler).
 * Deterministisch für gleiche (regionIndex, arenaIndex, seasonId).
 */
export function generateGhosts(
  regionIndex: number,
  arenaIndex: number,
  seasonId: number,
  count = LADDER_SIZE - 1,
): LadderEntry[] {
  const rand = mulberry32(hashSeed(`${regionIndex}:${arenaIndex}:${seasonId}`))
  // Höhere Region/Arena → stärkeres Feld (mehr Grund-Punkte).
  const difficultyFloor = regionIndex * 6 + arenaIndex * 4
  const names = [...GHOST_NAMES]
  const ghosts: LadderEntry[] = []
  for (let i = 0; i < count; i++) {
    const nameIdx = Math.floor(rand() * names.length)
    const handle = names.splice(nameIdx, 1)[0] ?? `Trainer ${i + 1}`
    const seasonPoints = Math.round(difficultyFloor + rand() * 170)
    const careerElo = Math.round(BASE_ELO + regionIndex * 90 + (rand() - 0.5) * 160)
    ghosts.push({ id: `ghost-${i}`, handle, seasonPoints, careerElo, isPlayer: false })
  }
  return ghosts
}

/** Baut die vollständige Arena-Rangliste (Spieler + Ghosts), nach Punkten sortiert. */
export function buildLadder(profile: RankedProfile): LadderEntry[] {
  const ghosts = generateGhosts(profile.regionIndex, profile.arenaIndex, profile.seasonId)
  const player: LadderEntry = {
    id: 'player',
    handle: profile.handle,
    seasonPoints: profile.seasonPoints,
    careerElo: profile.careerElo,
    isPlayer: true,
  }
  return [...ghosts, player].sort((a, b) => b.seasonPoints - a.seasonPoints || b.careerElo - a.careerElo)
}

/** 1-basierter Tabellenplatz des Spielers in seiner Arena-Rangliste. */
export function playerRank(profile: RankedProfile): number {
  const ladder = buildLadder(profile)
  return ladder.findIndex((e) => e.isPlayer) + 1
}
