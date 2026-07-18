import { applyElo, BASE_ELO } from './elo'
import { buildLadder, LADDER_SIZE, playerRank, PROMOTION_SLOTS, RELEGATION_SLOTS } from './ghosts'
import { ARENAS_PER_REGION, badgeAt, isFinalArena, REGIONS } from './regions'
import type { RankedProfile, SeasonResult } from './types'

export const WIN_POINTS = 32
export const LOSS_POINTS = 12
export const SEASON_START_POINTS = 20

export function createProfile(handle: string): RankedProfile {
  return {
    handle,
    regionIndex: 0,
    arenaIndex: 0,
    careerElo: BASE_ELO,
    seasonPoints: SEASON_START_POINTS,
    wins: 0,
    losses: 0,
    earnedBadges: [],
    seasonId: 1,
    updatedAt: Date.now(),
  }
}

/**
 * Verrechnet ein gewertetes Match. Aktualisiert lebenslanges Elo (globale
 * Bestenliste) und die Season-Punkte der aktuellen Arena (Ladder-Metrik).
 * Rein – kein Seiteneffekt.
 */
export function applyMatch(
  profile: RankedProfile,
  opponentElo: number,
  won: boolean,
  now = Date.now(),
): { profile: RankedProfile; eloDelta: number } {
  const { elo, delta } = applyElo(profile.careerElo, opponentElo, won, profile.regionIndex)
  const seasonPoints = won
    ? profile.seasonPoints + WIN_POINTS
    : Math.max(0, profile.seasonPoints - LOSS_POINTS)
  return {
    profile: {
      ...profile,
      careerElo: elo,
      seasonPoints,
      wins: profile.wins + (won ? 1 : 0),
      losses: profile.losses + (won ? 0 : 1),
      updatedAt: now,
    },
    eloDelta: delta,
  }
}

/**
 * Wertet die laufende Season aus: Top-3 der Arena-Rangliste steigen auf und
 * erhalten den Orden; die untersten Plätze steigen ab. Danach Season-Punkte-
 * Soft-Reset und neue Season-ID. Rein.
 */
export function resolveSeason(profile: RankedProfile, now = Date.now()): { profile: RankedProfile; result: SeasonResult } {
  const rank = playerRank(profile)
  const promoted = rank <= PROMOTION_SLOTS
  const relegated = !promoted && rank > LADDER_SIZE - RELEGATION_SLOTS

  const previousRegionIndex = profile.regionIndex
  const previousArenaIndex = profile.arenaIndex

  let regionIndex = profile.regionIndex
  let arenaIndex = profile.arenaIndex
  const earnedBadges = [...profile.earnedBadges]
  let badgeAwarded = null as SeasonResult['badgeAwarded']
  let regionCompleted = false

  if (promoted) {
    const badge = badgeAt(regionIndex, arenaIndex)
    if (badge && !earnedBadges.some((b) => b.badgeId === badge.id)) {
      earnedBadges.push({ badgeId: badge.id, seasonId: profile.seasonId, finalRank: rank, earnedAt: now })
      badgeAwarded = badge
    }
    if (!isFinalArena(regionIndex, arenaIndex)) {
      if (arenaIndex >= ARENAS_PER_REGION - 1) {
        regionCompleted = true
        regionIndex = Math.min(REGIONS.length - 1, regionIndex + 1)
        arenaIndex = 0
      } else {
        arenaIndex += 1
      }
    }
  } else if (relegated) {
    if (arenaIndex > 0) {
      arenaIndex -= 1
    } else if (regionIndex > 0) {
      regionIndex -= 1
      arenaIndex = ARENAS_PER_REGION - 1
    }
    // Region 0 / Arena 0: kein Abstieg.
  }

  const nextProfile: RankedProfile = {
    ...profile,
    regionIndex,
    arenaIndex,
    earnedBadges,
    seasonPoints: SEASON_START_POINTS,
    seasonId: profile.seasonId + 1,
    updatedAt: now,
  }

  return {
    profile: nextProfile,
    result: {
      promoted,
      relegated,
      badgeAwarded,
      regionCompleted,
      finalRank: rank,
      previousRegionIndex,
      previousArenaIndex,
    },
  }
}

/** Gesamtzahl erspielter Orden. */
export function totalEarned(profile: RankedProfile): number {
  return profile.earnedBadges.length
}

export { buildLadder, playerRank }
