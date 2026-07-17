import type { Deck } from '../store/collectionStore'
import type { CardDef } from './types'

export interface DeckValidation {
  total: number
  valid: boolean
  errors: string[]
}

export function cardLimit(card: CardDef): number {
  if (card.kind === 'energy' && card.isBasicEnergy) return Infinity
  return 4
}

export function validateDeck(
  deck: Pick<Deck, 'cardCounts'>,
  collection: Record<string, { card: CardDef; count: number }>,
): DeckValidation {
  const errors: string[] = []
  let total = 0
  let hasBasic = false

  for (const [id, count] of Object.entries(deck.cardCounts)) {
    if (count <= 0) continue
    total += count
    const entry = collection[id]
    if (!entry) {
      errors.push(`Karte nicht in Sammlung gefunden.`)
      continue
    }
    const card = entry.card
    if (card.kind === 'pokemon' && card.stage === 'basic') hasBasic = true
    const limit = cardLimit(card)
    if (count > limit) errors.push(`${card.name}: maximal ${limit}x erlaubt.`)
    if (count > entry.count) errors.push(`${card.name}: nur ${entry.count}x in der Sammlung vorhanden.`)
  }

  if (total < 60) errors.push(`Mindestens 60 Karten benötigt (aktuell ${total}).`)
  if (!hasBasic) errors.push('Das Deck braucht mindestens ein Basis-Pokémon.')

  return { total, valid: errors.length === 0, errors }
}
