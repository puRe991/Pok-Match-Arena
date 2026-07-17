import type { CardPool, EvolutionLine } from '../api/pokemonTcg'
import { DECK_SIZE, ENERGY_TYPES, MAX_COPIES_PER_CARD } from './constants'
import type { CardDef, ElementType } from './types'

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

function keyFor(card: CardDef): string {
  return `${card.kind}:${card.name}`
}

// Adds up to `count` copies of `card`, respecting the official "max 4 copies
// of any card by name" rule (basic Energy cards are exempt) and never
// pushing the deck past DECK_SIZE.
function pushCopies(cards: CardDef[], card: CardDef, count: number, copyCounts: Map<string, number>): void {
  const isEnergy = card.kind === 'energy'
  const key = keyFor(card)
  const already = copyCounts.get(key) ?? 0
  const capRemaining = isEnergy ? Infinity : MAX_COPIES_PER_CARD - already
  const n = Math.max(0, Math.min(count, capRemaining, DECK_SIZE - cards.length))
  for (let i = 0; i < n; i++) cards.push(withUid(card))
  copyCounts.set(key, already + n)
}

const POKEMON_CARD_TARGET = 22
const TRAINER_CARD_TARGET = 12
const MAX_LINES = 6

/**
 * Builds an official 60-card constructed deck (max 4 copies per card name,
 * basic Energy unlimited) by drawing a random sample of evolution lines,
 * Trainer cards, and basic Energy from the live card pool.
 */
export function buildDeck(pool: CardPool): CardDef[] {
  const cards: CardDef[] = []
  const copyCounts = new Map<string, number>()
  const usableLines = shuffle(pool.lines.filter((l) => !!l.basic))

  const chosenLines: EvolutionLine[] = []
  for (const line of usableLines) {
    if (cards.length >= POKEMON_CARD_TARGET || chosenLines.length >= MAX_LINES) break
    const before = cards.length
    pushCopies(cards, line.basic, 4, copyCounts)
    if (line.stage1) pushCopies(cards, line.stage1, 3, copyCounts)
    if (line.stage2) pushCopies(cards, line.stage2, 2, copyCounts)
    if (cards.length > before) chosenLines.push(line)
  }
  if (chosenLines.length === 0 && usableLines.length > 0) {
    pushCopies(cards, usableLines[0].basic, 4, copyCounts)
    chosenLines.push(usableLines[0])
  }

  const trainers = shuffle(pool.trainers)
  let trainerCount = 0
  for (const trainer of trainers) {
    if (trainerCount >= TRAINER_CARD_TARGET || cards.length >= DECK_SIZE) break
    const before = cards.length
    pushCopies(cards, trainer, Math.min(3, TRAINER_CARD_TARGET - trainerCount), copyCounts)
    trainerCount += cards.length - before
  }

  const lineTypes = Array.from(new Set(chosenLines.map((l) => l.basic.pokemonType))).filter(
    (t): t is ElementType => !!pool.energy[t],
  )
  const fallbackTypes = ENERGY_TYPES.filter((t) => !!pool.energy[t])
  const energyTypes = lineTypes.length > 0 ? lineTypes : fallbackTypes

  let i = 0
  while (cards.length < DECK_SIZE && energyTypes.length > 0) {
    const card = pool.energy[energyTypes[i % energyTypes.length]]
    if (card) cards.push(withUid(card))
    i += 1
  }

  // Safety net for a sparse (e.g. offline fallback) pool: pad with more
  // Pokemon copies up to the 4-copy cap rather than shipping an undersized deck.
  let guard = 0
  while (cards.length < DECK_SIZE && chosenLines.length > 0 && guard < 500) {
    const line = chosenLines[guard % chosenLines.length]
    const before = cards.length
    pushCopies(cards, line.basic, 1, copyCounts)
    if (line.stage1) pushCopies(cards, line.stage1, 1, copyCounts)
    if (line.stage2) pushCopies(cards, line.stage2, 1, copyCounts)
    guard += 1
    if (cards.length === before && guard > chosenLines.length * (MAX_COPIES_PER_CARD + 1)) break
  }

  return shuffle(cards.slice(0, DECK_SIZE))
}
