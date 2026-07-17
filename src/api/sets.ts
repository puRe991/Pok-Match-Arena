const API_BASE = 'https://api.pokemontcg.io/v2'

export interface TcgSet {
  id: string
  name: string
  series: string
  total: number
  releaseDate: string
  logo: string
  symbol: string
}

// Curated to classic "Base" era sets: simple 4-tier rarity (Common/Uncommon/
// Rare/Rare Holo), no special mechanics like EX/GX/V extra-prize rules,
// which the simplified engine here does not model.
export const PACK_SET_IDS = ['base1', 'base2', 'base3', 'base4', 'base5', 'base6'] as const

export type Supertype = 'Pokémon' | 'Trainer' | 'Energy'

export interface RawSetCard {
  id: string
  name: string
  supertype: Supertype
  subtypes?: string[]
  hp?: string
  types?: string[]
  evolvesFrom?: string
  attacks?: { name: string; cost?: string[]; damage?: string; text?: string }[]
  retreatCost?: string[]
  weaknesses?: { type: string; value: string }[]
  rarity?: string
  number: string
  images: { small: string; large: string }
}

let setsCache: Promise<TcgSet[]> | null = null

export function loadPackSets(): Promise<TcgSet[]> {
  if (!setsCache) {
    setsCache = (async () => {
      try {
        const ids = PACK_SET_IDS.map((id) => `id:${id}`).join(' OR ')
        const url = `${API_BASE}/sets?q=${encodeURIComponent(ids)}&orderBy=releaseDate&select=id,name,series,total,releaseDate,images`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) throw new Error('bad response')
        const json = (await res.json()) as {
          data: { id: string; name: string; series: string; total: number; releaseDate: string; images: { logo: string; symbol: string } }[]
        }
        return json.data.map((s) => ({
          id: s.id,
          name: s.name,
          series: s.series,
          total: s.total,
          releaseDate: s.releaseDate,
          logo: s.images.logo,
          symbol: s.images.symbol,
        }))
      } catch {
        return FALLBACK_SETS
      }
    })()
  }
  return setsCache
}

const FALLBACK_SETS: TcgSet[] = [
  {
    id: 'base1',
    name: 'Base Set',
    series: 'Base',
    total: 102,
    releaseDate: '1999/01/09',
    logo: 'https://images.pokemontcg.io/base1/logo.png',
    symbol: 'https://images.pokemontcg.io/base1/symbol.png',
  },
  {
    id: 'base2',
    name: 'Jungle',
    series: 'Base',
    total: 64,
    releaseDate: '1999/06/16',
    logo: 'https://images.pokemontcg.io/base2/logo.png',
    symbol: 'https://images.pokemontcg.io/base2/symbol.png',
  },
  {
    id: 'base3',
    name: 'Fossil',
    series: 'Base',
    total: 62,
    releaseDate: '1999/10/10',
    logo: 'https://images.pokemontcg.io/base3/logo.png',
    symbol: 'https://images.pokemontcg.io/base3/symbol.png',
  },
]

const cardsCache = new Map<string, Promise<RawSetCard[]>>()

export function loadSetCards(setId: string): Promise<RawSetCard[]> {
  let cached = cardsCache.get(setId)
  if (!cached) {
    cached = (async () => {
      try {
        const url = `${API_BASE}/cards?q=${encodeURIComponent(`set.id:${setId}`)}&pageSize=250&select=id,name,supertype,subtypes,hp,types,evolvesFrom,attacks,retreatCost,weaknesses,rarity,number,images`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) throw new Error('bad response')
        const json = (await res.json()) as { data: RawSetCard[] }
        return json.data
      } catch {
        return []
      }
    })()
    cardsCache.set(setId, cached)
  }
  return cached
}
