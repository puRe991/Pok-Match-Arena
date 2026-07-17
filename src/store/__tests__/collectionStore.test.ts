import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEnergy, makePokemon, resetUidCounter } from '../../test/fixtures'
import type { CardDef } from '../../game/types'

vi.mock('../../api/sets', () => ({
  loadPackSets: vi.fn(),
  PACK_SET_IDS: ['base1', 'base2'],
}))
vi.mock('../../game/packs', () => ({
  loadSetPool: vi.fn(),
  openPack: vi.fn(),
}))
vi.mock('../../game/deckBuilder', async () => {
  const actual = await vi.importActual<typeof import('../../game/deckBuilder')>('../../game/deckBuilder')
  return { ...actual, buildRandomLegalDeck: vi.fn() }
})

async function freshStore() {
  vi.resetModules()
  const collectionStoreModule = await import('../collectionStore')
  return collectionStoreModule
}

beforeEach(() => {
  resetUidCounter()
  localStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('collectionById / expandDeckFromCollection', () => {
  it('extracts the card map from a collection', async () => {
    const { collectionById } = await freshStore()
    const card = makePokemon({ id: 'a' })
    expect(collectionById({ a: { card, count: 3 } })).toEqual({ a: card })
  })

  it('expands a deck using cards found in the collection', async () => {
    const { expandDeckFromCollection } = await freshStore()
    const card = makePokemon({ id: 'a' })
    const cards = expandDeckFromCollection({ cardCounts: { a: 2 } }, { a: { card, count: 4 } })
    expect(cards).toHaveLength(2)
    expect(cards.every((c) => c.id === 'a')).toBe(true)
  })
})

describe('useCollectionStore: collection & pack history', () => {
  it('addCards accumulates counts per card id', async () => {
    const { useCollectionStore } = await freshStore()
    const card = makePokemon({ id: 'a' })
    useCollectionStore.getState().addCards([card])
    useCollectionStore.getState().addCards([card, card])
    expect(useCollectionStore.getState().collection.a.count).toBe(3)
  })

  it('addCards keeps distinct ids separate', async () => {
    const { useCollectionStore } = await freshStore()
    const a = makePokemon({ id: 'a' })
    const b = makeEnergy({ id: 'b' })
    useCollectionStore.getState().addCards([a, b])
    const collection = useCollectionStore.getState().collection
    expect(Object.keys(collection).sort()).toEqual(['a', 'b'])
  })

  it('openSetPack adds the drawn cards to the collection and records pack history', async () => {
    const { useCollectionStore } = await freshStore()
    const { loadSetPool, openPack } = await import('../../game/packs')
    const drawnCards: CardDef[] = [makePokemon({ id: 'p1' }), makeEnergy({ id: 'p2' })]
    vi.mocked(loadSetPool).mockResolvedValue({
      setId: 'base1',
      setName: 'Base Set',
      common: [],
      uncommon: [],
      rare: [],
      holo: [],
      basicEnergy: [],
      all: [],
    })
    vi.mocked(openPack).mockReturnValue(drawnCards)

    const result = await useCollectionStore
      .getState()
      .openSetPack({ id: 'base1', name: 'Base Set', series: 'Base', total: 1, releaseDate: '', logo: '', symbol: '' })

    expect(result).toEqual(drawnCards)
    expect(useCollectionStore.getState().collection.p1).toBeDefined()
    expect(useCollectionStore.getState().packHistory).toHaveLength(1)
    expect(useCollectionStore.getState().packHistory[0].cardIds).toEqual(['p1', 'p2'])
  })
})

describe('useCollectionStore: deck management', () => {
  it('createDeck adds an empty deck and returns its id', async () => {
    const { useCollectionStore } = await freshStore()
    const id = useCollectionStore.getState().createDeck('My Deck')
    const deck = useCollectionStore.getState().decks.find((d) => d.id === id)
    expect(deck).toBeDefined()
    expect(deck?.name).toBe('My Deck')
    expect(deck?.cardCounts).toEqual({})
  })

  it('updateDeck replaces the card counts for that deck only', async () => {
    const { useCollectionStore } = await freshStore()
    const id1 = useCollectionStore.getState().createDeck('Deck 1')
    const id2 = useCollectionStore.getState().createDeck('Deck 2')
    useCollectionStore.getState().updateDeck(id1, { a: 4 })
    const decks = useCollectionStore.getState().decks
    expect(decks.find((d) => d.id === id1)?.cardCounts).toEqual({ a: 4 })
    expect(decks.find((d) => d.id === id2)?.cardCounts).toEqual({})
  })

  it('renameDeck only changes the targeted deck name', async () => {
    const { useCollectionStore } = await freshStore()
    const id = useCollectionStore.getState().createDeck('Old Name')
    useCollectionStore.getState().renameDeck(id, 'New Name')
    expect(useCollectionStore.getState().decks.find((d) => d.id === id)?.name).toBe('New Name')
  })

  it('deleteDeck removes the deck and clears activeDeckId if it pointed there', async () => {
    const { useCollectionStore } = await freshStore()
    const id = useCollectionStore.getState().createDeck('Deck')
    useCollectionStore.getState().setActiveDeck(id)
    useCollectionStore.getState().deleteDeck(id)
    expect(useCollectionStore.getState().decks).toHaveLength(0)
    expect(useCollectionStore.getState().activeDeckId).toBeNull()
  })

  it('deleteDeck leaves activeDeckId untouched when a different deck is removed', async () => {
    const { useCollectionStore } = await freshStore()
    const keep = useCollectionStore.getState().createDeck('Keep')
    const remove = useCollectionStore.getState().createDeck('Remove')
    useCollectionStore.getState().setActiveDeck(keep)
    useCollectionStore.getState().deleteDeck(remove)
    expect(useCollectionStore.getState().activeDeckId).toBe(keep)
  })
})

describe('useCollectionStore: ensureStarterDeck', () => {
  it('builds and activates a starter deck when none exists yet', async () => {
    const { useCollectionStore } = await freshStore()
    const { loadPackSets } = await import('../../api/sets')
    const { loadSetPool } = await import('../../game/packs')
    const { buildRandomLegalDeck } = await import('../../game/deckBuilder')

    vi.mocked(loadPackSets).mockResolvedValue([
      { id: 'base1', name: 'Base Set', series: 'Base', total: 1, releaseDate: '', logo: '', symbol: '' },
    ])
    vi.mocked(loadSetPool).mockResolvedValue({
      setId: 'base1',
      setName: 'Base Set',
      common: [],
      uncommon: [],
      rare: [],
      holo: [],
      basicEnergy: [],
      all: [],
    })
    const starterCards = [makePokemon({ id: 'starter1' }), makeEnergy({ id: 'starter2' })]
    vi.mocked(buildRandomLegalDeck).mockReturnValue(starterCards)

    await useCollectionStore.getState().ensureStarterDeck()

    const state = useCollectionStore.getState()
    expect(state.starterReady).toBe(true)
    expect(state.decks).toHaveLength(1)
    expect(state.decks[0].name).toBe('Starter-Deck')
    expect(state.activeDeckId).toBe(state.decks[0].id)
    expect(state.collection.starter1).toBeDefined()
  })

  it('is a no-op when a deck already exists', async () => {
    const { useCollectionStore } = await freshStore()
    const { loadPackSets } = await import('../../api/sets')
    useCollectionStore.getState().createDeck('Existing')

    await useCollectionStore.getState().ensureStarterDeck()

    expect(useCollectionStore.getState().starterReady).toBe(true)
    expect(useCollectionStore.getState().decks).toHaveLength(1)
    expect(loadPackSets).not.toHaveBeenCalled()
  })

  it('concurrent calls only build the starter deck once', async () => {
    const { useCollectionStore } = await freshStore()
    const { loadPackSets } = await import('../../api/sets')
    const { loadSetPool } = await import('../../game/packs')
    const { buildRandomLegalDeck } = await import('../../game/deckBuilder')

    vi.mocked(loadPackSets).mockResolvedValue([
      { id: 'base1', name: 'Base Set', series: 'Base', total: 1, releaseDate: '', logo: '', symbol: '' },
    ])
    vi.mocked(loadSetPool).mockResolvedValue({
      setId: 'base1',
      setName: 'Base Set',
      common: [],
      uncommon: [],
      rare: [],
      holo: [],
      basicEnergy: [],
      all: [],
    })
    vi.mocked(buildRandomLegalDeck).mockReturnValue([makePokemon({ id: 'starter1' })])

    await Promise.all([
      useCollectionStore.getState().ensureStarterDeck(),
      useCollectionStore.getState().ensureStarterDeck(),
      useCollectionStore.getState().ensureStarterDeck(),
    ])

    expect(useCollectionStore.getState().decks).toHaveLength(1)
    expect(loadPackSets).toHaveBeenCalledTimes(1)
  })
})
