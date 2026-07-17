import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { useGameStore } from '../store/gameStore'
import { useCollectionStore } from '../store/collectionStore'
import { baseState, makePlayer } from '../test/gameState'
import type { GameState } from '../game/types'

vi.mock('../components/MainMenu', () => ({ MainMenu: () => <div>MainMenuMarker</div> }))
vi.mock('../components/LobbyScreen', () => ({ LobbyScreen: () => <div>LobbyScreenMarker</div> }))
vi.mock('../components/SetupScreen', () => ({ SetupScreen: () => <div>SetupScreenMarker</div> }))
vi.mock('../components/GameBoard', () => ({ GameBoard: () => <div>GameBoardMarker</div> }))
vi.mock('../components/PackOpeningScreen', () => ({ PackOpeningScreen: () => <div>PackOpeningScreenMarker</div> }))
vi.mock('../components/DeckBuilderScreen', () => ({ DeckBuilderScreen: () => <div>DeckBuilderScreenMarker</div> }))

const GAME_STORE_DEFAULTS = {
  screen: 'menu' as const,
  gameState: null,
  link: null,
  sessionCode: null,
  mpStatus: 'idle' as const,
  mpError: null,
  starting: false,
  startError: null,
}

beforeEach(() => {
  useGameStore.setState(GAME_STORE_DEFAULTS)
  useCollectionStore.setState({
    collection: {},
    packHistory: [],
    decks: [],
    activeDeckId: null,
    starterReady: false,
    ensureStarterDeck: vi.fn(() => Promise.resolve()),
  })
})

describe('App routing', () => {
  it('shows the main menu by default when there is no active game', () => {
    render(<App />)
    expect(screen.getByText('MainMenuMarker')).toBeInTheDocument()
  })

  it('calls ensureStarterDeck once on mount', () => {
    const ensureStarterDeck = vi.fn(() => Promise.resolve())
    useCollectionStore.setState({ ensureStarterDeck })
    render(<App />)
    expect(ensureStarterDeck).toHaveBeenCalledTimes(1)
  })

  it('shows the lobby screen once mpStatus leaves "menu" (no game yet, not on the home screen)', () => {
    useGameStore.setState({ screen: 'lobby' })
    render(<App />)
    expect(screen.getByText('LobbyScreenMarker')).toBeInTheDocument()
  })

  it('shows the setup screen once a game exists in the setup phase', () => {
    const state: GameState = baseState({ phase: 'setup', players: { p1: makePlayer('p1'), p2: makePlayer('p2') } })
    useGameStore.setState({ gameState: state })
    render(<App />)
    expect(screen.getByText('SetupScreenMarker')).toBeInTheDocument()
  })

  it('shows the game board once a game exists past the setup phase', () => {
    const state: GameState = baseState({ phase: 'main', players: { p1: makePlayer('p1'), p2: makePlayer('p2') } })
    useGameStore.setState({ gameState: state })
    render(<App />)
    expect(screen.getByText('GameBoardMarker')).toBeInTheDocument()
  })

  it('a game in progress takes priority over the home/pack/deck-builder views', () => {
    const state: GameState = baseState({ phase: 'main', players: { p1: makePlayer('p1'), p2: makePlayer('p2') } })
    useGameStore.setState({ gameState: state })
    render(<App />)
    expect(screen.queryByText('MainMenuMarker')).not.toBeInTheDocument()
    expect(screen.getByText('GameBoardMarker')).toBeInTheDocument()
  })
})
