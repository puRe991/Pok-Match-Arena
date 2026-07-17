import type {
  AttackDef,
  CardDef,
  ElementType,
  EnergyCardDef,
  PokemonCardDef,
  Stage,
  TrainerCardDef,
  TrainerType,
} from '../game/types'
import { ENERGY_TYPES } from '../game/constants'
import { isRecognizedTrainerText, parseAttackEffects, parseTrainerEffects } from '../game/effects'
import { FALLBACK_POOL } from './fallbackCards'

const API_BASE = 'https://api.pokemontcg.io/v2/cards'
const KNOWN_TYPES: ElementType[] = [
  'Fire',
  'Water',
  'Grass',
  'Lightning',
  'Fighting',
  'Psychic',
  'Darkness',
  'Metal',
  'Fairy',
  'Dragon',
  'Colorless',
]

interface RawAttack {
  name: string
  cost?: string[]
  damage?: string
  text?: string
}

interface RawCard {
  id: string
  name: string
  supertype: string
  subtypes?: string[]
  hp?: string
  types?: string[]
  evolvesFrom?: string
  attacks?: RawAttack[]
  retreatCost?: string[]
  weaknesses?: { type: string; value: string }[]
  resistances?: { type: string; value: string }[]
  rules?: string[]
  images: { small: string; large: string }
}

function toElementType(raw: string | undefined): ElementType {
  if (raw && (KNOWN_TYPES as string[]).includes(raw)) return raw as ElementType
  return 'Colorless'
}

function parseDamage(raw: string | undefined): number {
  if (!raw) return 0
  const match = raw.match(/\d+/)
  if (!match) return 0
  return Math.max(0, Math.min(150, parseInt(match[0], 10)))
}

function normalizeAttacks(raw: RawAttack[] | undefined): AttackDef[] {
  if (!raw || raw.length === 0) return []
  return raw.slice(0, 4).map((a) => ({
    name: a.name,
    cost: (a.cost ?? ['Colorless']).slice(0, 5).map(toElementType),
    damage: parseDamage(a.damage),
    text: a.text ?? '',
    effects: parseAttackEffects(a.text),
  }))
}

function deriveStage(subtypes: string[] | undefined): Stage {
  const s = subtypes ?? []
  if (s.includes('Basic')) return 'basic'
  if (s.some((x) => x.replace(/\s+/g, '').toLowerCase() === 'stage2')) return 'stage2'
  return 'stage1'
}

function normalizePokemon(raw: RawCard): PokemonCardDef | null {
  const hp = raw.hp ? parseInt(raw.hp, 10) : NaN
  if (!hp || Number.isNaN(hp)) return null
  const attacks = normalizeAttacks(raw.attacks)
  if (attacks.length === 0) return null
  const stage = deriveStage(raw.subtypes)
  if (stage !== 'basic' && !raw.evolvesFrom) return null
  const retreatCost = raw.retreatCost?.length ?? 1
  const weaknessRaw = raw.weaknesses?.[0]?.type
  const resistanceRaw = raw.resistances?.[0]?.type
  return {
    kind: 'pokemon',
    id: raw.id,
    uid: '',
    name: raw.name,
    pokemonType: toElementType(raw.types?.[0]),
    stage,
    evolvesFrom: raw.evolvesFrom,
    hp: Math.min(340, hp),
    attacks,
    retreatCost: Math.min(4, Math.max(0, retreatCost)),
    weakness: weaknessRaw ? toElementType(weaknessRaw) : undefined,
    resistance: resistanceRaw ? toElementType(resistanceRaw) : undefined,
    imageSmall: raw.images.small,
    imageLarge: raw.images.large,
  }
}

function normalizeTrainer(raw: RawCard): TrainerCardDef | null {
  const subtypes = raw.subtypes ?? []
  const trainerType: TrainerType | null = subtypes.includes('Supporter')
    ? 'supporter'
    : subtypes.includes('Item')
      ? 'item'
      : null
  if (!trainerType) return null
  const text = (raw.rules ?? []).join(' ')
  if (!isRecognizedTrainerText(text)) return null
  return {
    kind: 'trainer',
    id: raw.id,
    uid: '',
    name: raw.name,
    trainerType,
    text,
    effects: parseTrainerEffects(text),
    imageSmall: raw.images.small,
    imageLarge: raw.images.large,
  }
}

async function fetchJson(url: string): Promise<{ data: RawCard[] } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    return (await res.json()) as { data: RawCard[] }
  } catch {
    return null
  }
}

export interface EvolutionLine {
  basic: PokemonCardDef
  stage1?: PokemonCardDef
  stage2?: PokemonCardDef
}

function buildLines(cards: RawCard[]): EvolutionLine[] {
  const byName = new Map<string, PokemonCardDef>()
  for (const raw of cards) {
    if (byName.has(raw.name)) continue
    const normalized = normalizePokemon(raw)
    if (normalized) byName.set(raw.name, normalized)
  }

  const lines: EvolutionLine[] = []
  for (const basic of byName.values()) {
    if (basic.stage !== 'basic') continue
    const stage1 = [...byName.values()].find((c) => c.stage === 'stage1' && c.evolvesFrom === basic.name)
    const stage2 = stage1
      ? [...byName.values()].find((c) => c.stage === 'stage2' && c.evolvesFrom === stage1.name)
      : undefined
    lines.push({ basic, stage1, stage2 })
  }
  return lines
}

async function fetchPokemonLines(): Promise<EvolutionLine[]> {
  const select = encodeURIComponent(
    'id,name,supertype,subtypes,hp,types,evolvesFrom,attacks,retreatCost,weaknesses,resistances,images',
  )
  const q = encodeURIComponent('supertype:pokemon')
  const url = `${API_BASE}?q=${q}&pageSize=250&select=${select}`
  const json = await fetchJson(url)
  if (!json || json.data.length === 0) return FALLBACK_POOL.lines
  const lines = buildLines(json.data)
  return lines.length > 0 ? lines : FALLBACK_POOL.lines
}

async function fetchTrainers(): Promise<TrainerCardDef[]> {
  const select = encodeURIComponent('id,name,supertype,subtypes,rules,images')
  const q = encodeURIComponent('supertype:trainer (subtypes:item OR subtypes:supporter)')
  const url = `${API_BASE}?q=${q}&pageSize=250&select=${select}`
  const json = await fetchJson(url)
  if (!json) return FALLBACK_POOL.trainers
  const byName = new Map<string, TrainerCardDef>()
  for (const raw of json.data) {
    if (byName.has(raw.name)) continue
    const normalized = normalizeTrainer(raw)
    if (normalized) byName.set(raw.name, normalized)
  }
  const trainers = [...byName.values()]
  return trainers.length > 0 ? trainers : FALLBACK_POOL.trainers
}

async function fetchEnergy(): Promise<Partial<Record<ElementType, EnergyCardDef>>> {
  const nameQuery = ENERGY_TYPES.map((t) => `name:"${t} Energy"`).join(' OR ')
  const q = encodeURIComponent(`supertype:energy subtypes:basic (${nameQuery})`)
  const url = `${API_BASE}?q=${q}&pageSize=100&select=id,name,supertype,subtypes,images`
  const json = await fetchJson(url)
  const pool: Partial<Record<ElementType, EnergyCardDef>> = {}

  for (const type of ENERGY_TYPES) {
    const found = json?.data.find((c) => c.name === `${type} Energy`)
    pool[type] = found
      ? {
          kind: 'energy',
          id: found.id,
          uid: '',
          name: found.name,
          energyType: type,
          imageSmall: found.images.small,
          imageLarge: found.images.large,
        }
      : FALLBACK_POOL.energy[type]
  }
  return pool
}

export interface CardPool {
  lines: EvolutionLine[]
  trainers: TrainerCardDef[]
  energy: Partial<Record<ElementType, EnergyCardDef>>
}

let cachedPool: Promise<CardPool> | null = null

export function loadCardPool(): Promise<CardPool> {
  if (!cachedPool) {
    cachedPool = Promise.all([fetchPokemonLines(), fetchTrainers(), fetchEnergy()]).then(
      ([lines, trainers, energy]) => ({ lines, trainers, energy }),
    )
  }
  return cachedPool
}

export type { CardDef }
