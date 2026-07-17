import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MainMenu } from '../MainMenu'
import { useGameStore } from '../../store/gameStore'
import { useCollectionStore } from '../../store/collectionStore'

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

const COLLECTION_STORE_DEFAULTS = {
  collection: {},
  packHistory: [],
  decks: [],
  activeDeckId: null,
  starterReady: false,
}

beforeEach(() => {
  useGameStore.setState(GAME_STORE_DEFAULTS)
  useCollectionStore.setState(COLLECTION_STORE_DEFAULTS)
})

function withActiveDeck() {
  useCollectionStore.setState({
    decks: [{ id: 'd1', name: 'Mein Deck', cardCounts: {}, createdAt: 0 }],
    activeDeckId: 'd1',
  })
}

describe('MainMenu', () => {
  it('shows a loading message and disables actions while no active deck exists', () => {
    render(<MainMenu onNavigate={vi.fn()} />)
    expect(screen.getByText('Lade Starter-Deck…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gegen CPU spielen' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Multiplayer-Session erstellen' })).toBeDisabled()
  })

  it('shows the active deck name and enables actions once a deck is selected', () => {
    withActiveDeck()
    render(<MainMenu onNavigate={vi.fn()} />)
    expect(screen.getByText('Mein Deck')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gegen CPU spielen' })).toBeEnabled()
  })

  it('shows the starting message while a match is being prepared', () => {
    withActiveDeck()
    useGameStore.setState({ starting: true })
    render(<MainMenu onNavigate={vi.fn()} />)
    expect(screen.getByText('Gegner-Deck wird gemischt…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gegen CPU spielen' })).toBeDisabled()
  })

  it('surfaces a startError message', () => {
    withActiveDeck()
    useGameStore.setState({ startError: 'Etwas ist schiefgelaufen.' })
    render(<MainMenu onNavigate={vi.fn()} />)
    expect(screen.getByText('Etwas ist schiefgelaufen.')).toBeInTheDocument()
  })

  it('invokes startLocalGame when "Gegen CPU spielen" is clicked', async () => {
    withActiveDeck()
    const startLocalGame = vi.fn()
    useGameStore.setState({ startLocalGame })
    const user = userEvent.setup()
    render(<MainMenu onNavigate={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Gegen CPU spielen' }))
    expect(startLocalGame).toHaveBeenCalledTimes(1)
  })

  it('invokes hostMultiplayerGame when "Multiplayer-Session erstellen" is clicked', async () => {
    withActiveDeck()
    const hostMultiplayerGame = vi.fn()
    useGameStore.setState({ hostMultiplayerGame })
    const user = userEvent.setup()
    render(<MainMenu onNavigate={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Multiplayer-Session erstellen' }))
    expect(hostMultiplayerGame).toHaveBeenCalledTimes(1)
  })

  it('reveals a join-code field and only enables "Los" once 5 characters are entered', async () => {
    withActiveDeck()
    const joinMultiplayerGame = vi.fn()
    useGameStore.setState({ joinMultiplayerGame })
    const user = userEvent.setup()
    render(<MainMenu onNavigate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Session beitreten' }))
    const input = screen.getByPlaceholderText('Session-Code')
    const losButton = screen.getByRole('button', { name: 'Los' })
    expect(losButton).toBeDisabled()

    await user.type(input, 'abcd')
    expect(losButton).toBeDisabled()

    await user.type(input, 'e')
    expect(losButton).toBeEnabled()
    await user.click(losButton)
    expect(joinMultiplayerGame).toHaveBeenCalledWith('ABCDE')
  })

  it('uppercases the join code as it is typed', async () => {
    withActiveDeck()
    const user = userEvent.setup()
    render(<MainMenu onNavigate={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Session beitreten' }))
    const input = screen.getByPlaceholderText('Session-Code') as HTMLInputElement
    await user.type(input, 'abc')
    expect(input.value).toBe('ABC')
  })

  it('calls onNavigate with the right view for the pack and deck-builder buttons', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<MainMenu onNavigate={onNavigate} />)
    await user.click(screen.getByRole('button', { name: /Packs öffnen/ }))
    await user.click(screen.getByRole('button', { name: /Deck-Builder/ }))
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'packs')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'deckbuilder')
  })
})
