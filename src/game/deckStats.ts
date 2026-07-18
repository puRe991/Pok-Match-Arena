import type { CardDef, ElementType } from './types'

export interface DeckStats {
  total: number
  pokemon: number
  energy: number
  trainer: number
  basic: number
  stage1: number
  stage2: number
  /** Anzahl Pokémon je Element-Typ (für die Typ-Verteilung). */
  byType: Partial<Record<ElementType, number>>
  /** Durchschnittliche Rückzugskosten über alle Pokémon-Karten (0 wenn keine). */
  avgRetreat: number
}

type CollectionLike = Record<string, { card: CardDef }>

/** Berechnet Kennzahlen zu einem Deck (Kartenverteilung, Typen, Rückzug). */
export function computeDeckStats(cardCounts: Record<string, number>, collection: CollectionLike): DeckStats {
  const stats: DeckStats = {
    total: 0,
    pokemon: 0,
    energy: 0,
    trainer: 0,
    basic: 0,
    stage1: 0,
    stage2: 0,
    byType: {},
    avgRetreat: 0,
  }

  let retreatSum = 0
  for (const [id, count] of Object.entries(cardCounts)) {
    if (count <= 0) continue
    const card = collection[id]?.card
    if (!card) continue
    stats.total += count
    if (card.kind === 'pokemon') {
      stats.pokemon += count
      stats.byType[card.pokemonType] = (stats.byType[card.pokemonType] ?? 0) + count
      retreatSum += card.retreatCost * count
      if (card.stage === 'basic') stats.basic += count
      else if (card.stage === 'stage1') stats.stage1 += count
      else stats.stage2 += count
    } else if (card.kind === 'energy') {
      stats.energy += count
    } else {
      stats.trainer += count
    }
  }

  stats.avgRetreat = stats.pokemon > 0 ? Math.round((retreatSum / stats.pokemon) * 10) / 10 : 0
  return stats
}

const DECK_HEADER = '# Pok-Match-Arena Deck'

/**
 * Serialisiert ein Deck als kompakten, teilbaren Text (eine `Anzahl id`-Zeile
 * pro Karte). Der Name steht als Kommentar in der ersten Zeile.
 */
export function serializeDeck(name: string, cardCounts: Record<string, number>): string {
  const lines = [DECK_HEADER, `# Deck: ${name}`]
  for (const [id, count] of Object.entries(cardCounts)) {
    if (count > 0) lines.push(`${count} ${id}`)
  }
  return lines.join('\n')
}

export interface ParsedDeck {
  name: string | null
  cardCounts: Record<string, number>
}

/**
 * Liest ein per `serializeDeck` erzeugtes (oder manuell getipptes) Deck ein.
 * Unbekannte/kaputte Zeilen werden robust ignoriert; doppelte IDs summiert.
 */
export function parseDeck(text: string): ParsedDeck {
  const cardCounts: Record<string, number> = {}
  let name: string | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const nameMatch = line.match(/^#\s*Deck:\s*(.+)$/i)
    if (nameMatch) {
      name = nameMatch[1].trim()
      continue
    }
    if (line.startsWith('#')) continue
    const match = line.match(/^(\d+)\s+(\S+)$/)
    if (!match) continue
    const count = parseInt(match[1], 10)
    const id = match[2]
    if (!Number.isFinite(count) || count <= 0) continue
    cardCounts[id] = (cardCounts[id] ?? 0) + count
  }
  return { name, cardCounts }
}
