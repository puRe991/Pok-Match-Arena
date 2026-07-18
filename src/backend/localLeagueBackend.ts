import { REGIONS } from '../game/ranked/regions'
import type { RankedProfile } from '../game/ranked/types'
import type { LeaderboardRow, LeagueBackend } from './leagueBackend'

/**
 * Offline-Backend: die globale Bestenliste wird aus deterministischen
 * Ghost-Trainern erzeugt, damit die Meister-Liga auch ohne echtes Backend
 * gefüllt ist. `syncProfile` ist ein No-op – die Persistenz übernimmt der
 * Store via `localStorage`.
 */

const GLOBAL_GHOSTS = [
  'Delia', 'Blau', 'Cynthia', 'Trovato', 'Diantha', 'Delion', 'Lylia',
  'Guzman', 'Peorth', 'Nemo', 'Kukui', 'Rot', 'Silber', 'Marnie', 'Papilio',
]

function ghostRows(): LeaderboardRow[] {
  return GLOBAL_GHOSTS.map((handle, i) => {
    // Absteigende, plausible Elo-Werte über die Divisionen verteilt.
    const careerElo = 2600 - i * 95
    const regionIndex = Math.max(0, Math.min(REGIONS.length - 1, Math.floor((careerElo - 1000) / 190)))
    const badges = Math.max(0, Math.min(72, regionIndex * 8 + ((i * 3) % 8)))
    return { handle, careerElo, regionIndex, badges, isPlayer: false }
  })
}

export class LocalLeagueBackend implements LeagueBackend {
  readonly kind = 'local' as const

  async syncProfile(): Promise<void> {
    // No-op: der Store persistiert lokal.
  }

  async fetchLeaderboard(player: RankedProfile, limit = 20): Promise<LeaderboardRow[]> {
    const rows: LeaderboardRow[] = [
      ...ghostRows(),
      {
        handle: player.handle,
        careerElo: player.careerElo,
        regionIndex: player.regionIndex,
        badges: player.earnedBadges.length,
        isPlayer: true,
      },
    ]
    return rows.sort((a, b) => b.careerElo - a.careerElo).slice(0, limit)
  }
}
