import { cloneWithUid, buildRandomLegalDeck } from './deckBuilder'
import { openPack, type SetCardPool } from './packs'
import type { CardDef, EnergyCardDef } from './types'

/** Anzahl Packs, die im Sealed-Modus geöffnet werden. */
export const SEALED_PACK_COUNT = 6
/** Deckgröße im Sealed-/Limited-Format (kleiner als das 60-Karten-Standardformat). */
export const SEALED_DECK_SIZE = 40
/** Frei bereitgestellte Basis-Energie je Typ (im Sealed stellt das „Turnier“ Energie). */
export const SEALED_FREE_ENERGY_PER_TYPE = 12

/**
 * Öffnet `packCount` Packs aus einem Set und liefert den daraus entstehenden
 * Sealed-Kartenpool – ergänzt um einen freien Vorrat Basis-Energie, damit sich
 * daraus immer ein legales Deck bauen lässt.
 */
export function openSealedPool(
  pool: SetCardPool,
  packCount = SEALED_PACK_COUNT,
  freeEnergyPerType = SEALED_FREE_ENERGY_PER_TYPE,
): CardDef[] {
  const cards: CardDef[] = []
  for (let i = 0; i < packCount; i++) {
    cards.push(...openPack(pool))
  }

  // Pro vorkommendem Basis-Energie-Typ einen freien Stapel bereitstellen.
  const byType = new Map<string, EnergyCardDef>()
  for (const e of pool.basicEnergy) {
    if (!byType.has(e.energyType)) byType.set(e.energyType, e)
  }
  for (const template of byType.values()) {
    for (let i = 0; i < freeEnergyPerType; i++) cards.push(cloneWithUid(template))
  }

  return cards
}

/** Baut aus einem Sealed-Pool ein legales 40-Karten-Deck (Auto-Deck). */
export function buildSealedDeck(pool: CardDef[]): CardDef[] {
  return buildRandomLegalDeck(pool, SEALED_DECK_SIZE)
}
