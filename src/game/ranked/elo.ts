/**
 * Standard-Elo mit divisionsabhängigem K-Faktor. Höhere Divisionen haben
 * einen kleineren K-Faktor → stabilere Ränge im oberen Bereich.
 */

export const BASE_ELO = 1000

/** Erwartungswert für Spieler A gegen B (0..1). */
export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400))
}

/** K-Faktor sinkt mit der Division (regionIndex 0..8). */
export function kFactor(regionIndex: number): number {
  return Math.max(16, 40 - regionIndex * 3)
}

/**
 * Neues Elo nach einem Match. `won` = true bei Sieg.
 * Rundet auf ganze Punkte und liefert das Delta separat.
 */
export function applyElo(
  elo: number,
  opponentElo: number,
  won: boolean,
  regionIndex = 0,
): { elo: number; delta: number } {
  const expected = expectedScore(elo, opponentElo)
  const actual = won ? 1 : 0
  const delta = Math.round(kFactor(regionIndex) * (actual - expected))
  return { elo: elo + delta, delta }
}
