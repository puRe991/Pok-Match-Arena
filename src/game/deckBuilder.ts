import { isDeckLegal } from './normalize'
import type { CardDef, ElementType, EnergyCardDef, PokemonCardDef } from './types'

let uidCounter = 0
function nextUid(): string {
  uidCounter += 1
  return `c${uidCounter}-${Math.random().toString(36).slice(2, 8)}`
}

export function cloneWithUid(card: CardDef): CardDef {
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

/** Expands a {cardId: count} deck list into concrete card instances. */
export function expandDeck(cardCounts: Record<string, number>, byId: Record<string, CardDef>): CardDef[] {
  const cards: CardDef[] = []
  for (const [id, count] of Object.entries(cardCounts)) {
    const card = byId[id]
    if (!card) continue
    for (let i = 0; i < count; i++) cards.push(cloneWithUid(card))
  }
  return cards
}

const POKEMON_BUDGET = 24

/**
 * Builds a random legal 60-card deck (Basic/Stage1/Stage2 Pokémon lines +
 * Basic Energy) from a card pool. Used for the auto-generated starter deck
 * and for the NPC opponent's "zufälliges Deck".
 */
export function buildRandomLegalDeck(pool: CardDef[], size = 60): CardDef[] {
  const legal = pool.filter(isDeckLegal)
  const basics = shuffle(legal.filter((c) => c.kind === 'pokemon' && c.stage === 'basic') as PokemonCardDef[])
  const evosByFrom = new Map<string, PokemonCardDef[]>()
  for (const c of legal) {
    if (c.kind === 'pokemon' && c.stage !== 'basic' && c.evolvesFrom) {
      const arr = evosByFrom.get(c.evolvesFrom) ?? []
      arr.push(c)
      evosByFrom.set(c.evolvesFrom, arr)
    }
  }
  const basicEnergies = legal.filter((c) => c.kind === 'energy' && c.isBasicEnergy) as EnergyCardDef[]

  const deck: CardDef[] = []
  const usedTypes = new Set<ElementType>()
  let added = 0

  for (const basic of basics) {
    if (added >= POKEMON_BUDGET) break
    usedTypes.add(basic.pokemonType)
    const basicCount = Math.min(3, POKEMON_BUDGET - added)
    for (let n = 0; n < basicCount; n++) {
      deck.push(cloneWithUid(basic))
      added++
    }
    const stage1 = (evosByFrom.get(basic.name) ?? []).find((c) => c.stage === 'stage1')
    if (stage1 && added < POKEMON_BUDGET) {
      const stage1Count = Math.min(2, POKEMON_BUDGET - added)
      for (let n = 0; n < stage1Count; n++) {
        deck.push(cloneWithUid(stage1))
        added++
      }
      const stage2 = (evosByFrom.get(stage1.name) ?? []).find((c) => c.stage === 'stage2')
      if (stage2 && added < POKEMON_BUDGET) {
        deck.push(cloneWithUid(stage2))
        added++
      }
    }
  }

  const typeList = usedTypes.size > 0 ? [...usedTypes] : (['Colorless'] as ElementType[])
  let i = 0
  while (deck.length < size && basicEnergies.length > 0) {
    const type = typeList[i % typeList.length]
    const card = basicEnergies.find((e) => e.energyType === type) ?? basicEnergies[0]
    deck.push(cloneWithUid(card))
    i++
  }

  return shuffle(deck)
}
