import type { RawSetCard } from '../api/sets'
import { getTrainerEffect } from './trainers'
import type {
  AttackDef,
  CardDef,
  ElementType,
  EnergyCardDef,
  PokemonCardDef,
  Rarity,
  Stage,
  TrainerCardDef,
} from './types'

const KNOWN_TYPES: ElementType[] = [
  'Fire',
  'Water',
  'Grass',
  'Lightning',
  'Fighting',
  'Psychic',
  'Colorless',
]

function toElementType(raw: string | undefined): ElementType {
  if (raw && (KNOWN_TYPES as string[]).includes(raw)) return raw as ElementType
  return 'Colorless'
}

function parseDamage(raw: string | undefined): number {
  if (!raw) return 0
  const match = raw.match(/\d+/)
  if (!match) return 0
  return Math.max(0, Math.min(120, parseInt(match[0], 10)))
}

function normalizeAttacks(raw: RawSetCard['attacks']): AttackDef[] {
  if (!raw || raw.length === 0) return []
  return raw.slice(0, 4).map((a) => ({
    name: a.name,
    cost: (a.cost ?? ['Colorless']).slice(0, 5).map(toElementType),
    damage: parseDamage(a.damage),
    text: a.text ?? '',
  }))
}

function toStage(subtypes: string[] | undefined): Stage {
  if (subtypes?.includes('Stage 2')) return 'stage2'
  if (subtypes?.includes('Stage 1')) return 'stage1'
  return 'basic'
}

/** Collapses the API's many rarity strings into the four classic tiers. */
export function classifyRarity(raw: string | undefined): Rarity {
  if (!raw) return 'Common'
  if (raw === 'Common') return 'Common'
  if (raw === 'Uncommon') return 'Uncommon'
  if (/holo|ultra|secret|rainbow|shiny|star|prime|legend|vmax|vstar|\bgx\b|\bex\b/i.test(raw)) {
    return 'Holo Rare'
  }
  if (raw === 'Rare') return 'Rare'
  return 'Rare'
}

function meta(raw: RawSetCard, setId: string, setName: string) {
  return {
    id: raw.id,
    uid: '',
    name: raw.name,
    setId,
    setName,
    number: raw.number,
    rarity: classifyRarity(raw.rarity),
    imageSmall: raw.images.small,
    imageLarge: raw.images.large,
  }
}

export function normalizePokemonCard(raw: RawSetCard, setId: string, setName: string): PokemonCardDef | null {
  const hp = raw.hp ? parseInt(raw.hp, 10) : NaN
  if (!hp || Number.isNaN(hp)) return null
  const attacks = normalizeAttacks(raw.attacks)
  if (attacks.length === 0) return null
  const retreatCost = raw.retreatCost?.length ?? 1
  const weaknessRaw = raw.weaknesses?.[0]?.type
  return {
    kind: 'pokemon',
    ...meta(raw, setId, setName),
    pokemonType: toElementType(raw.types?.[0]),
    stage: toStage(raw.subtypes),
    evolvesFrom: raw.evolvesFrom,
    hp: Math.min(150, hp),
    attacks,
    retreatCost: Math.min(4, Math.max(0, retreatCost)),
    weakness: weaknessRaw ? toElementType(weaknessRaw) : undefined,
  }
}

export function normalizeEnergyCard(raw: RawSetCard, setId: string, setName: string): EnergyCardDef {
  const isBasicEnergy = (raw.subtypes ?? []).includes('Basic')
  const guessedType = KNOWN_TYPES.find((t) => raw.name.startsWith(t))
  return {
    kind: 'energy',
    ...meta(raw, setId, setName),
    energyType: guessedType ?? 'Colorless',
    isBasicEnergy,
  }
}

export function normalizeTrainerCard(raw: RawSetCard, setId: string, setName: string): TrainerCardDef {
  return {
    kind: 'trainer',
    ...meta(raw, setId, setName),
    text: raw.attacks?.[0]?.text ?? '',
  }
}

export function normalizeCard(raw: RawSetCard, setId: string, setName: string): CardDef | null {
  if (raw.supertype === 'Pokémon') return normalizePokemonCard(raw, setId, setName)
  if (raw.supertype === 'Energy') return normalizeEnergyCard(raw, setId, setName)
  return normalizeTrainerCard(raw, setId, setName)
}

export function isDeckLegal(card: CardDef): boolean {
  // Nur Trainer mit implementiertem Effekt sind deck-legal, damit Decks
  // garantiert spielbar bleiben.
  if (card.kind === 'trainer') return getTrainerEffect(card) !== null
  if (card.kind === 'energy') return card.isBasicEnergy
  return true
}
