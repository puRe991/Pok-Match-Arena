import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeLegalDeck, resetUidCounter } from '../../test/fixtures'
import { isMyTurn } from '../gameStore'
import type { GameState } from '../../game/types'

vi.mock('../../api/sets', () => ({ loadPackSets: vi.fn() }))
vi.mock('../../game/packs', () => ({ loadSetPool: vi.fn() }))
vi.mock('../../game/deckBuilder', async () => {
  const actual = await vi.importActual<typeof import('../../game/deckBuilder')>('../../game/deckBuilder')
  return { ...actual, buildRandomLegalDeck: vi.fn() }
})

const { MockLink } = vi.hoisted(() => {
  class MockLink {
    static instances: MockLink[] = []
    static hostSessionImpl: () => Promise<string> = () => Promise.resolve('ABCDE')
    onData: ((msg: unknown) => void) | null = null
    onPeerConnected: (() => void) | null = null
    onPeerDisconnected: (() => void) | null = null
    onErrorMsg: ((msg: string) => void) | null = null
    send = vi.fn()
    destroy = vi.fn()
    hostSession = vi.fn(() => MockLink.hostSessionImpl())
    joinSession = vi.fn(() => Promise.resolve())
    constructor() {
      MockLink.instances.push(this)
    }
  }
  return { MockLink }
})
vi.mock('../../multiplayer/peer', () => ({ MultiplayerLink: MockLink }))

async function freshStores() {
  vi.resetModules()
  MockLink.instances = []
  const collectionStoreModule = await import('../collectionStore')
  const gameStoreModule = await import('../gameStore')
  return { ...collectionStoreModule, ...gameStoreModule }
}

async function withActiveDeck(collectionStoreModule: Awaited<ReturnType<typeof freshStores>>) {
  const { useCollectionStore } = collectionStoreModule
  const cards = makeLegalDeck()
  useCollectionStore.getState().addCards(cards)
  const id = useCollectionStore.getState().createDeck('Test Deck')
  const counts: Record<string, number> = {}
  for (const c of cards) counts[c.id] = (counts[c.id] ?? 0) + 1
  useCollectionStore.getState().updateDeck(id, counts)
  useCollectionStore.getState().setActiveDeck(id)
}

beforeEach(() => {
  resetUidCounter()
  localStorage.clear()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  MockLink.hostSessionImpl = () => Promise.resolve('ABCDE')
})

describe('isMyTurn', () => {
  it('is true only in the main phase on the player own side', () => {
    const base: GameState = {
      players: {} as GameState['players'],
      activeSide: 'p1',
      turnNumber: 1,
      phase: 'main',
      log: [],
      winner: null,
      winnerReason: null,
      mode: 'local',
      mySide: 'p1',
      lastEvent: null,
      setupReady: { p1: true, p2: true },
    }
    expect(isMyTurn(base)).toBe(true)
    expect(isMyTurn({ ...base, mySide: 'p2' })).toBe(false)
    expect(isMyTurn({ ...base, phase: 'setup' })).toBe(false)
  })
})

describe('startLocalGame', () => {
  it('sets a startError when no active deck is selected', async () => {
    const stores = await freshStores()
    await stores.useGameStore.getState().startLocalGame()
    expect(stores.useGameStore.getState().startError).toMatch(/Deck/)
    expect(stores.useGameStore.getState().gameState).toBeNull()
  })

  it('creates a game and moves to the setup screen when a deck is active', async () => {
    const stores = await freshStores()
    await withActiveDeck(stores)
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
    vi.mocked(buildRandomLegalDeck).mockReturnValue(makeLegalDeck())

    await stores.useGameStore.getState().startLocalGame()

    const state = stores.useGameStore.getState()
    expect(state.screen).toBe('setup')
    expect(state.gameState).not.toBeNull()
    expect(state.gameState?.mode).toBe('local')
    expect(state.starting).toBe(false)
    expect(state.startError).toBeNull()
  })

  it('sets a startError if the opponent deck cannot be built', async () => {
    const stores = await freshStores()
    await withActiveDeck(stores)
    const { loadPackSets } = await import('../../api/sets')
    vi.mocked(loadPackSets).mockRejectedValue(new Error('network down'))

    await stores.useGameStore.getState().startLocalGame()

    const state = stores.useGameStore.getState()
    expect(state.gameState).toBeNull()
    expect(state.startError).toMatch(/Gegner-Deck/)
    expect(state.starting).toBe(false)
  })
})

describe('dispatch', () => {
  it('applies actions locally in local/host mode', async () => {
    const stores = await freshStores()
    const p1Cards = makeLegalDeck()
    const p2Cards = makeLegalDeck()
    const { createInitialState } = await import('../../game/engine')
    const initial = createInitialState('local', 'p1', p1Cards, p2Cards, { p2IsAI: false })
    stores.useGameStore.setState({ gameState: initial, screen: 'setup' })

    const basic = initial.players.p1.hand.find((c) => c.kind === 'pokemon' && c.stage === 'basic')
    expect(basic).toBeDefined()
    stores.useGameStore.getState().dispatch({ type: 'SETUP_PLACE_ACTIVE', side: 'p1', handUid: basic!.uid })

    expect(stores.useGameStore.getState().gameState?.players.p1.active).not.toBeNull()
  })

  it('sends the action over the link instead of applying it locally in guest mode', async () => {
    const stores = await freshStores()
    const p1Cards = makeLegalDeck()
    const p2Cards = makeLegalDeck()
    const { createInitialState } = await import('../../game/engine')
    const initial = createInitialState('guest', 'p2', p1Cards, p2Cards)
    const link = new MockLink()
    stores.useGameStore.setState({ gameState: initial, link: link as unknown as never })

    stores.useGameStore.getState().dispatch({ type: 'SETUP_READY', side: 'p2' })

    expect(link.send).toHaveBeenCalledWith({ type: 'action', action: { type: 'SETUP_READY', side: 'p2' } })
    // Guest state must not mutate until the host echoes back the authoritative state.
    expect(stores.useGameStore.getState().gameState?.setupReady.p2).toBe(false)
  })

  it('is a no-op when there is no active game', async () => {
    const stores = await freshStores()
    expect(() => stores.useGameStore.getState().dispatch({ type: 'SETUP_READY', side: 'p1' })).not.toThrow()
    expect(stores.useGameStore.getState().gameState).toBeNull()
  })
})

describe('AI auto-play scheduling', () => {
  it('schedules and applies an AI setup action ~550ms after the game starts', async () => {
    vi.useFakeTimers()
    const stores = await freshStores()
    await withActiveDeck(stores)
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
    vi.mocked(buildRandomLegalDeck).mockReturnValue(makeLegalDeck())

    await stores.useGameStore.getState().startLocalGame()
    expect(stores.useGameStore.getState().gameState?.players.p2.active).toBeNull()

    await vi.advanceTimersByTimeAsync(600)

    expect(stores.useGameStore.getState().gameState?.players.p2.active).not.toBeNull()
  })
})

describe('backToMenu', () => {
  it('destroys the link and resets to the menu screen', async () => {
    const stores = await freshStores()
    const link = new MockLink()
    stores.useGameStore.setState({
      gameState: {} as GameState,
      link: link as unknown as never,
      screen: 'game',
      sessionCode: 'ABCDE',
      mpStatus: 'connected',
    })

    stores.useGameStore.getState().backToMenu()

    const state = stores.useGameStore.getState()
    expect(link.destroy).toHaveBeenCalled()
    expect(state.screen).toBe('menu')
    expect(state.gameState).toBeNull()
    expect(state.link).toBeNull()
    expect(state.sessionCode).toBeNull()
    expect(state.mpStatus).toBe('idle')
  })
})

describe('hostMultiplayerGame / joinMultiplayerGame', () => {
  it('hostMultiplayerGame requires an active deck', async () => {
    const stores = await freshStores()
    await stores.useGameStore.getState().hostMultiplayerGame()
    expect(stores.useGameStore.getState().startError).toMatch(/Deck/)
    expect(MockLink.instances).toHaveLength(0)
  })

  it('hostMultiplayerGame opens a session and stores the code', async () => {
    const stores = await freshStores()
    await withActiveDeck(stores)
    await stores.useGameStore.getState().hostMultiplayerGame()
    expect(stores.useGameStore.getState().sessionCode).toBe('ABCDE')
    expect(stores.useGameStore.getState().mpStatus).toBe('hosting')
    expect(stores.useGameStore.getState().screen).toBe('lobby')
  })

  it('hostMultiplayerGame sets an error state if the session cannot be created', async () => {
    const stores = await freshStores()
    await withActiveDeck(stores)
    MockLink.hostSessionImpl = () => Promise.reject(new Error('offline'))

    await stores.useGameStore.getState().hostMultiplayerGame()

    expect(stores.useGameStore.getState().mpStatus).toBe('error')
    expect(stores.useGameStore.getState().mpError).toMatch(/Session/)
  })

  it('joinMultiplayerGame requires an active deck', async () => {
    const stores = await freshStores()
    await stores.useGameStore.getState().joinMultiplayerGame('ABCDE')
    expect(stores.useGameStore.getState().startError).toMatch(/Deck/)
    expect(MockLink.instances).toHaveLength(0)
  })

  it('joinMultiplayerGame connects and sends a hello message', async () => {
    const stores = await freshStores()
    await withActiveDeck(stores)
    await stores.useGameStore.getState().joinMultiplayerGame('abcde')
    expect(stores.useGameStore.getState().mpStatus).toBe('connected')
    expect(MockLink.instances[0].send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hello', name: 'Gast' }),
    )
  })
})
