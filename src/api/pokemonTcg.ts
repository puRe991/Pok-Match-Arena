import type { AttackDef, CardDef, ElementType, EnergyCardDef, PokemonCardDef } from '../game/types'
import { ALL_POKEMON_NAMES, ENERGY_TYPES, ROSTER } from '../game/roster'
import { FALLBACK_POKEMON, FALLBACK_ENERGY } from './fallbackCards'

const API_BASE = 'https://api.pokemontcg.io/v2/cards'
const KNOWN_TYPES: ElementType[] = [
  'Fire',
  'Water',
  'Grass',
  'Lightning',
  'Fighting',
  'Psychic',
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
  return Math.max(0, Math.min(90, parseInt(match[0], 10)))
}

function normalizeAttacks(raw: RawAttack[] | undefined): AttackDef[] {
  if (!raw || raw.length === 0) return []
  return raw.slice(0, 2).map((a) => ({
    name: a.name,
    cost: (a.cost ?? ['Colorless']).slice(0, 4).map(toElementType),
    damage: parseDamage(a.damage),
    text: a.text ?? '',
  }))
}

function normalizePokemon(raw: RawCard, expectedType: ElementType): PokemonCardDef | null {
  const hp = raw.hp ? parseInt(raw.hp, 10) : NaN
  if (!hp || Number.isNaN(hp)) return null
  const attacks = normalizeAttacks(raw.attacks)
  if (attacks.length === 0) return null
  const isBasic = (raw.subtypes ?? []).some((s) => s === 'Basic')
  const stage = isBasic ? 'basic' : 'stage1'
  const retreatCost = raw.retreatCost?.length ?? 1
  const weaknessRaw = raw.weaknesses?.[0]?.type
  return {
    kind: 'pokemon',
    id: raw.id,
    uid: '',
    name: raw.name,
    pokemonType: expectedType,
    stage,
    evolvesFrom: raw.evolvesFrom,
    hp: Math.min(120, hp),
    attacks,
    retreatCost: Math.min(3, Math.max(1, retreatCost)),
    weakness: weaknessRaw ? toElementType(weaknessRaw) : undefined,
    imageSmall: raw.images.small,
    imageLarge: raw.images.large,
  }
}

async function fetchJson(url: string): Promise<{ data: RawCard[] } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    return (await res.json()) as { data: RawCard[] }
  } catch {
    return null
  }
}

async function fetchPokemonPool(): Promise<Record<string, PokemonCardDef>> {
  const nameQuery = ALL_POKEMON_NAMES.map((n) => `name:"${n}"`).join(' OR ')
  const q = encodeURIComponent(`supertype:Pokémon (${nameQuery})`)
  const select = encodeURIComponent(
    'id,name,supertype,subtypes,hp,types,evolvesFrom,attacks,retreatCost,weaknesses,images',
  )
  const url = `${API_BASE}?q=${q}&pageSize=250&select=${select}`
  const json = await fetchJson(url)
  const pool: Record<string, PokemonCardDef> = {}

  if (json) {
    for (const line of ROSTER) {
      const candidates = json.data.filter(
        (c) => c.name === line.basic && (c.subtypes ?? []).includes('Basic'),
      )
      const best = candidates.find((c) => (c.attacks?.length ?? 0) > 0) ?? candidates[0]
      const normalized = best ? normalizePokemon(best, line.type) : null
      pool[line.basic] = normalized ?? FALLBACK_POKEMON[line.basic]

      if (line.stage1) {
        const evoCandidates = json.data.filter(
          (c) => c.name === line.stage1 && c.evolvesFrom === line.basic,
        )
        const bestEvo = evoCandidates.find((c) => (c.attacks?.length ?? 0) > 0) ?? evoCandidates[0]
        const normalizedEvo = bestEvo ? normalizePokemon(bestEvo, line.type) : null
        pool[line.stage1] = normalizedEvo ?? FALLBACK_POKEMON[line.stage1]
      }
    }
  } else {
    for (const name of ALL_POKEMON_NAMES) {
      pool[name] = FALLBACK_POKEMON[name]
    }
  }

  return pool
}

async function fetchEnergyPool(): Promise<Record<ElementType, EnergyCardDef>> {
  const nameQuery = ENERGY_TYPES.map((t) => `name:"${t} Energy"`).join(' OR ')
  const q = encodeURIComponent(`supertype:Energy subtypes:Basic (${nameQuery})`)
  const url = `${API_BASE}?q=${q}&pageSize=100&select=id,name,supertype,subtypes,images`
  const json = await fetchJson(url)
  const pool = {} as Record<ElementType, EnergyCardDef>

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
      : FALLBACK_ENERGY[type]
  }
  return pool
}

export interface CardPool {
  pokemon: Record<string, PokemonCardDef>
  energy: Record<ElementType, EnergyCardDef>
}

let cachedPool: Promise<CardPool> | null = null

export function loadCardPool(): Promise<CardPool> {
  if (!cachedPool) {
    cachedPool = Promise.all([fetchPokemonPool(), fetchEnergyPool()]).then(
      ([pokemon, energy]) => ({ pokemon, energy }),
    )
  }
  return cachedPool
}

export type { CardDef }
