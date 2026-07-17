import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetupScreen } from '../SetupScreen'
import { useGameStore } from '../../store/gameStore'
import { makePokemon, resetUidCounter } from '../../test/fixtures'
import { baseState, makePlayer } from '../../test/gameState'
import type { GameState } from '../../game/types'

beforeEach(() => {
  resetUidCounter()
  useGameStore.setState({ gameState: null })
})

describe('SetupScreen', () => {
  it('renders nothing when there is no active game', () => {
    const { container } = render(<SetupScreen />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a placeholder until a basic Pokémon is placed as active', () => {
    const state: GameState = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: { p1: makePlayer('p1', { hand: [makePokemon({ stage: 'basic' })] }), p2: makePlayer('p2') },
    })
    useGameStore.setState({ gameState: state })
    render(<SetupScreen />)
    expect(screen.getByText('Wähle unten eine Basis-Karte')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bereit' })).toBeDisabled()
  })

  it('clicking a basic Pokémon card dispatches SETUP_PLACE_ACTIVE', async () => {
    const dispatch = vi.fn()
    const basic = makePokemon({ name: 'Basicmon', stage: 'basic' })
    const state: GameState = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: { p1: makePlayer('p1', { hand: [basic] }), p2: makePlayer('p2') },
    })
    useGameStore.setState({ gameState: state, dispatch })
    const user = userEvent.setup()
    render(<SetupScreen />)
    await user.click(screen.getByRole('button', { name: /Basicmon/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SETUP_PLACE_ACTIVE', side: 'p1', handUid: basic.uid })
  })

  it('clicking a basic once active is set dispatches SETUP_PLACE_BENCH', async () => {
    const dispatch = vi.fn()
    const basic = makePokemon({ name: 'BenchCandidate', stage: 'basic' })
    const activeMon = { ...makePokemon({ name: 'Active' }) }
    const state: GameState = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: {
        p1: makePlayer('p1', {
          hand: [basic],
          active: {
            instanceId: 'active-1',
            stages: [activeMon],
            damage: 0,
            attachedEnergy: [],
            enteredPlayTurn: 0,
            evolvedOnTurn: null,
            statuses: [],
          },
        }),
        p2: makePlayer('p2'),
      },
    })
    useGameStore.setState({ gameState: state, dispatch })
    const user = userEvent.setup()
    render(<SetupScreen />)
    await user.click(screen.getByRole('button', { name: /BenchCandidate/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SETUP_PLACE_BENCH', side: 'p1', handUid: basic.uid })
  })

  it('does not allow placing more cards once ready, and shows the waiting message', () => {
    const dispatch = vi.fn()
    const basic = makePokemon({ name: 'Basicmon', stage: 'basic' })
    const activeMon = makePokemon({ name: 'Active' })
    const state: GameState = baseState({
      phase: 'setup',
      setupReady: { p1: true, p2: false },
      players: {
        p1: makePlayer('p1', {
          hand: [basic],
          active: {
            instanceId: 'active-1',
            stages: [activeMon],
            damage: 0,
            attachedEnergy: [],
            enteredPlayTurn: 0,
            evolvedOnTurn: null,
            statuses: [],
          },
        }),
        p2: makePlayer('p2'),
      },
    })
    useGameStore.setState({ gameState: state, dispatch })
    render(<SetupScreen />)
    expect(screen.getByRole('button', { name: /Basicmon/ })).toBeDisabled()
    expect(screen.getByText('Warte auf Gegner…')).toBeInTheDocument()
  })

  it('dispatches SETUP_READY when clicking "Bereit"', async () => {
    const dispatch = vi.fn()
    const activeMon = makePokemon({ name: 'Active' })
    const state: GameState = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: {
        p1: makePlayer('p1', {
          active: {
            instanceId: 'active-1',
            stages: [activeMon],
            damage: 0,
            attachedEnergy: [],
            enteredPlayTurn: 0,
            evolvedOnTurn: null,
            statuses: [],
          },
        }),
        p2: makePlayer('p2'),
      },
    })
    useGameStore.setState({ gameState: state, dispatch })
    const user = userEvent.setup()
    render(<SetupScreen />)
    await user.click(screen.getByRole('button', { name: 'Bereit' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SETUP_READY', side: 'p1' })
  })
})
