import { loadSetCards, type TcgSet } from '../api/sets'
import { FALLBACK_POOL } from '../api/fallbackCards'
import { normalizeCard } from './normalize'
import { cloneWithUid } from './deckBuilder'
import type { CardDef, EnergyCardDef, Rarity } from './types'

export interface SetCardPool {
  setId: string
  setName: string
  common: CardDef[]
  uncommon: CardDef[]
  rare: CardDef[]
  holo: CardDef[]
  basicEnergy: EnergyCardDef[]
  all: CardDef[]
}

const poolCache = new Map<string, Promise<SetCardPool>>()

function bucketize(cards: CardDef[], setId: string, setName: string): SetCardPool {
  const byRarity: Record<Rarity, CardDef[]> = { Common: [], Uncommon: [], Rare: [], 'Holo Rare': [] }
  for (const c of cards) byRarity[c.rarity].push(c)
  const basicEnergy = cards.filter((c) => c.kind === 'energy' && c.isBasicEnergy) as EnergyCardDef[]
  return {
    setId,
    setName,
    common: byRarity.Common,
    uncommon: byRarity.Uncommon,
    rare: byRarity.Rare,
    holo: byRarity['Holo Rare'],
    basicEnergy,
    all: cards,
  }
}

export function loadSetPool(set: TcgSet): Promise<SetCardPool> {
  let cached = poolCache.get(set.id)
  if (!cached) {
    cached = (async () => {
      const raw = await loadSetCards(set.id)
      const normalized = raw
        .map((r) => normalizeCard(r, set.id, set.name))
        .filter((c): c is CardDef => c !== null)
      if (normalized.length < 20) {
        return bucketize(FALLBACK_POOL, 'offline', 'Offline-Kartensatz')
      }
      return bucketize(normalized, set.id, set.name)
    })()
    poolCache.set(set.id, cached)
  }
  return cached
}

function pick<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

const HOLO_CHANCE = 0.33

/** Opens one 11-card pack: 6 Common, 3 Uncommon, 1 Rare/Holo slot, 1 Basic Energy. */
export function openPack(pool: SetCardPool): CardDef[] {
  const cards: CardDef[] = []
  const commonPool = pool.common.length > 0 ? pool.common : pool.all
  const uncommonPool = pool.uncommon.length > 0 ? pool.uncommon : commonPool
  const rareSlotPool = pool.rare.length > 0 || pool.holo.length > 0 ? null : commonPool

  for (let i = 0; i < 6; i++) {
    const card = pick(commonPool)
    if (card) cards.push(cloneWithUid(card))
  }
  for (let i = 0; i < 3; i++) {
    const card = pick(uncommonPool)
    if (card) cards.push(cloneWithUid(card))
  }

  if (rareSlotPool) {
    const card = pick(rareSlotPool)
    if (card) cards.push(cloneWithUid(card))
  } else {
    const wantHolo = pool.holo.length > 0 && Math.random() < HOLO_CHANCE
    const card = wantHolo ? pick(pool.holo) : (pick(pool.rare) ?? pick(pool.holo))
    if (card) cards.push(cloneWithUid(card))
  }

  const energyCard = pick(pool.basicEnergy)
  if (energyCard) cards.push(cloneWithUid(energyCard))

  return cards
}
