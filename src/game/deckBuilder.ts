import type { CardPool } from '../api/pokemonTcg'
import { ENERGY_TYPES, ROSTER } from './roster'
import type { CardDef } from './types'

let uidCounter = 0
function nextUid(): string {
  uidCounter += 1
  return `c${uidCounter}-${Math.random().toString(36).slice(2, 8)}`
}

function withUid(card: CardDef): CardDef {
  return { ...card, uid: nextUid() }
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Builds a simplified 20-card deck: one copy of every roster basic + its
 * evolution (12 Pokemon), plus 8 basic energy cards spread across the
 * elemental types actually used by the roster.
 */
export function buildDeck(pool: CardPool): CardDef[] {
  const cards: CardDef[] = []

  for (const line of ROSTER) {
    cards.push(withUid(pool.pokemon[line.basic]))
    if (line.stage1) {
      cards.push(withUid(pool.pokemon[line.stage1]))
    }
  }

  const energyCount = 8
  for (let i = 0; i < energyCount; i++) {
    const type = ENERGY_TYPES[i % ENERGY_TYPES.length]
    cards.push(withUid(pool.energy[type]))
  }

  return shuffle(cards)
}
