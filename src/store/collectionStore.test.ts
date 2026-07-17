import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { CardDef } from '../game/types'

const charmander = FALLBACK_POOL.find((c) => c.id === 'offline-46')!
const squirtle = FALLBACK_POOL.find((c) => c.id === 'offline-63')!

describe('collectionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('collectionById projects the collection map down to bare cards', async () => {
    const { collectionById } = await import('./collectionStore')
    const out = collectionById({ [charmander.id]: { card: charmander, count: 3 } })
    expect(out).toEqual({ [charmander.id]: charmander })
  })

  it('expandDeckFromCollection expands counts into concrete card instances', async () => {
    const { expandDeckFromCollection } = await import('./collectionStore')
    const collection = { [charmander.id]: { card: charmander, count: 4 } }
    const cards = expandDeckFromCollection({ cardCounts: { [charmander.id]: 2 } }, collection)
    expect(cards).toHaveLength(2)
    expect(cards.every((c: CardDef) => c.id === charmander.id)).toBe(true)
  })

  it('addCards accumulates counts per card id', async () => {
    const { useCollectionStore } = await import('./collectionStore')
    useCollectionStore.getState().addCards([charmander, charmander, squirtle])
    const { collection } = useCollectionStore.getState()
    expect(collection[charmander.id].count).toBe(2)
    expect(collection[squirtle.id].count).toBe(1)
    useCollectionStore.getState().addCards([charmander])
    expect(useCollectionStore.getState().collection[charmander.id].count).toBe(3)
  })

  it('createDeck/renameDeck/updateDeck/deleteDeck manage the deck list', async () => {
    const { useCollectionStore } = await import('./collectionStore')
    const id = useCollectionStore.getState().createDeck('My Deck')
    expect(useCollectionStore.getState().decks).toHaveLength(1)
    expect(useCollectionStore.getState().decks[0].name).toBe('My Deck')

    useCollectionStore.getState().renameDeck(id, 'Renamed')
    expect(useCollectionStore.getState().decks[0].name).toBe('Renamed')

    useCollectionStore.getState().updateDeck(id, { [charmander.id]: 4 })
    expect(useCollectionStore.getState().decks[0].cardCounts).toEqual({ [charmander.id]: 4 })

    useCollectionStore.getState().setActiveDeck(id)
    expect(useCollectionStore.getState().activeDeckId).toBe(id)

    useCollectionStore.getState().deleteDeck(id)
    expect(useCollectionStore.getState().decks).toHaveLength(0)
    expect(useCollectionStore.getState().activeDeckId).toBeNull()
  })

  it('deleteDeck leaves activeDeckId untouched when deleting a different deck', async () => {
    const { useCollectionStore } = await import('./collectionStore')
    const activeId = useCollectionStore.getState().createDeck('Active')
    const otherId = useCollectionStore.getState().createDeck('Other')
    useCollectionStore.getState().setActiveDeck(activeId)
    useCollectionStore.getState().deleteDeck(otherId)
    expect(useCollectionStore.getState().activeDeckId).toBe(activeId)
  })

  it('openSetPack draws cards, adds them to the collection, and records pack history', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [] }), // forces the offline fallback pool
      })),
    )
    const { useCollectionStore } = await import('./collectionStore')
    const set = { id: 'unique-test-set', name: 'Test Set', series: 'Test', total: 0, releaseDate: '', logo: '', symbol: '' }
    const cards = await useCollectionStore.getState().openSetPack(set)
    expect(cards.length).toBeGreaterThan(0)
    expect(useCollectionStore.getState().packHistory).toHaveLength(1)
    expect(useCollectionStore.getState().packHistory[0].cardIds).toEqual(cards.map((c) => c.id))
    const totalInCollection = Object.values(useCollectionStore.getState().collection).reduce((s, e) => s + e.count, 0)
    expect(totalInCollection).toBe(cards.length)
  })

  it('openSetPack allows two free packs per day and rejects the third', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
    )
    const { useCollectionStore } = await import('./collectionStore')
    const set = { id: 'daily-limit-set', name: 'Test Set', series: 'Test', total: 0, releaseDate: '', logo: '', symbol: '' }

    expect(useCollectionStore.getState().freePacksRemaining()).toBe(2)
    await useCollectionStore.getState().openSetPack(set)
    expect(useCollectionStore.getState().freePacksRemaining()).toBe(1)
    await useCollectionStore.getState().openSetPack(set)
    expect(useCollectionStore.getState().freePacksRemaining()).toBe(0)

    await expect(useCollectionStore.getState().openSetPack(set)).rejects.toThrow(/Keine kostenlosen Packs/)
    expect(useCollectionStore.getState().packHistory).toHaveLength(2)
  })

  it('openSetPack grants fresh free packs on the next calendar day', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
    )
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 6, 17, 12, 0, 0))
      const { useCollectionStore } = await import('./collectionStore')
      const set = { id: 'daily-reset-set', name: 'Test Set', series: 'Test', total: 0, releaseDate: '', logo: '', symbol: '' }

      await useCollectionStore.getState().openSetPack(set)
      await useCollectionStore.getState().openSetPack(set)
      expect(useCollectionStore.getState().freePacksRemaining()).toBe(0)

      vi.setSystemTime(new Date(2026, 6, 18, 0, 0, 1))
      expect(useCollectionStore.getState().freePacksRemaining()).toBe(2)
      await expect(useCollectionStore.getState().openSetPack(set)).resolves.toHaveLength(11)
      expect(useCollectionStore.getState().dailyFree).toEqual({ day: '2026-07-18', opened: 1 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('ensureStarterDeck is idempotent and only creates one starter deck', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes('/sets')
            ? { data: [{ id: 'base1', name: 'Base Set', series: 'Base', total: 102, releaseDate: '1999/01/09', images: { logo: '', symbol: '' } }] }
            : { data: [] }, // no cards -> falls back to the offline pool, which is deck-legal
      })),
    )
    const { useCollectionStore } = await import('./collectionStore')
    await Promise.all([
      useCollectionStore.getState().ensureStarterDeck(),
      useCollectionStore.getState().ensureStarterDeck(),
    ])
    expect(useCollectionStore.getState().starterReady).toBe(true)
    expect(useCollectionStore.getState().decks).toHaveLength(1)
    expect(useCollectionStore.getState().decks[0].name).toBe('Starter-Deck')
    expect(useCollectionStore.getState().activeDeckId).toBe(useCollectionStore.getState().decks[0].id)
  })

  it('ensureStarterDeck does nothing if a deck already exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
    )
    const { useCollectionStore } = await import('./collectionStore')
    useCollectionStore.getState().createDeck('Existing')
    await useCollectionStore.getState().ensureStarterDeck()
    expect(useCollectionStore.getState().decks).toHaveLength(1)
    expect(useCollectionStore.getState().decks[0].name).toBe('Existing')
  })
})
