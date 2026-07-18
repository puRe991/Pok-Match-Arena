import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PACK_SET_IDS, loadPackSets, type TcgSet } from '../api/sets'
import { buildRandomLegalDeck, expandDeck } from '../game/deckBuilder'
import { isDeckLegal } from '../game/normalize'
import { consumeFreePack, remainingFreePacks, type DailyFreeState } from '../game/dailyPacks'
import { loadSetPool, openPack as drawPack } from '../game/packs'
import { useProgressStore } from './progressStore'
import type { CardDef } from '../game/types'

/** Preis eines im Shop gekauften Extra-Packs (über die Gratis-Packs hinaus). */
export const PACK_PRICE = 60

export function collectionById(collection: Record<string, { card: CardDef; count: number }>): Record<string, CardDef> {
  const out: Record<string, CardDef> = {}
  for (const [id, entry] of Object.entries(collection)) out[id] = entry.card
  return out
}

export function expandDeckFromCollection(
  deck: Pick<Deck, 'cardCounts'>,
  collection: Record<string, { card: CardDef; count: number }>,
): CardDef[] {
  return expandDeck(deck.cardCounts, collectionById(collection))
}

export interface Deck {
  id: string
  name: string
  cardCounts: Record<string, number>
  createdAt: number
}

export interface PackHistoryEntry {
  id: string
  setId: string
  setName: string
  openedAt: number
  cardIds: string[]
}

function deckCountsFromCards(cards: CardDef[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of cards) counts[c.id] = (counts[c.id] ?? 0) + 1
  return counts
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Module-level singleton so React StrictMode's double-invoked effect (or any
// other concurrent caller) can't race and create two starter decks.
let starterDeckPromise: Promise<void> | null = null

interface CollectionState {
  collection: Record<string, { card: CardDef; count: number }>
  packHistory: PackHistoryEntry[]
  decks: Deck[]
  activeDeckId: string | null
  starterReady: boolean
  dailyFree: DailyFreeState | null

  addCards: (cards: CardDef[]) => void
  freePacksRemaining: () => number
  openSetPack: (set: TcgSet) => Promise<CardDef[]>
  buyPack: (set: TcgSet) => Promise<CardDef[]>
  createDeck: (name: string) => string
  updateDeck: (id: string, cardCounts: Record<string, number>) => void
  renameDeck: (id: string, name: string) => void
  deleteDeck: (id: string) => void
  setActiveDeck: (id: string | null) => void
  ensureStarterDeck: () => Promise<void>
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      collection: {},
      packHistory: [],
      decks: [],
      activeDeckId: null,
      starterReady: false,
      dailyFree: null,

      freePacksRemaining: () => remainingFreePacks(get().dailyFree),

      addCards: (cards: CardDef[]) => {
        set((state) => {
          const collection = { ...state.collection }
          for (const card of cards) {
            const existing = collection[card.id]
            collection[card.id] = existing ? { card: existing.card, count: existing.count + 1 } : { card, count: 1 }
          }
          return { collection }
        })
      },

      openSetPack: async (tcgSet: TcgSet) => {
        if (remainingFreePacks(get().dailyFree) <= 0) {
          throw new Error('Keine kostenlosen Packs mehr für heute – neue Gratis-Packs gibt es um Mitternacht!')
        }
        const pool = await loadSetPool(tcgSet)
        const cards = drawPack(pool)
        get().addCards(cards)
        set((state) => ({
          dailyFree: consumeFreePack(state.dailyFree),
          packHistory: [
            {
              id: newId(),
              setId: pool.setId,
              setName: pool.setName,
              openedAt: Date.now(),
              cardIds: cards.map((c) => c.id),
            },
            ...state.packHistory,
          ].slice(0, 50),
        }))
        useProgressStore.getState().recordPackOpened(cards.length)
        return cards
      },

      buyPack: async (tcgSet: TcgSet) => {
        // Extra-Pack gegen Münzen: verbraucht kein Gratis-Kontingent.
        if (!useProgressStore.getState().spendCoins(PACK_PRICE)) {
          throw new Error(`Nicht genug Münzen – ein Pack kostet ${PACK_PRICE} Münzen.`)
        }
        const pool = await loadSetPool(tcgSet)
        const cards = drawPack(pool)
        get().addCards(cards)
        set((state) => ({
          packHistory: [
            {
              id: newId(),
              setId: pool.setId,
              setName: pool.setName,
              openedAt: Date.now(),
              cardIds: cards.map((c) => c.id),
            },
            ...state.packHistory,
          ].slice(0, 50),
        }))
        useProgressStore.getState().recordPackOpened(cards.length)
        return cards
      },

      createDeck: (name: string) => {
        const id = newId()
        set((state) => ({
          decks: [...state.decks, { id, name, cardCounts: {}, createdAt: Date.now() }],
        }))
        return id
      },

      updateDeck: (id: string, cardCounts: Record<string, number>) => {
        set((state) => ({
          decks: state.decks.map((d) => (d.id === id ? { ...d, cardCounts } : d)),
        }))
      },

      renameDeck: (id: string, name: string) => {
        set((state) => ({ decks: state.decks.map((d) => (d.id === id ? { ...d, name } : d)) }))
      },

      deleteDeck: (id: string) => {
        set((state) => ({
          decks: state.decks.filter((d) => d.id !== id),
          activeDeckId: state.activeDeckId === id ? null : state.activeDeckId,
        }))
      },

      setActiveDeck: (id: string | null) => set({ activeDeckId: id }),

      ensureStarterDeck: () => {
        if (!starterDeckPromise) {
          starterDeckPromise = (async () => {
            if (get().starterReady || get().decks.length > 0) {
              set({ starterReady: true })
              return
            }
            const sets = await loadPackSets()
            const starterSet = sets.find((s) => s.id === PACK_SET_IDS[0]) ?? sets[0]
            if (!starterSet) {
              set({ starterReady: true })
              return
            }
            const pool = await loadSetPool(starterSet)
            const deckCards = buildRandomLegalDeck(pool.all.filter(isDeckLegal), 60)
            get().addCards(deckCards)
            const id = newId()
            set((state) => ({
              decks: [
                ...state.decks,
                { id, name: 'Starter-Deck', cardCounts: deckCountsFromCards(deckCards), createdAt: Date.now() },
              ],
              activeDeckId: id,
              starterReady: true,
            }))
          })()
        }
        return starterDeckPromise
      },
    }),
    { name: 'pma-collection-v1' },
  ),
)
