import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LobbyScreen } from '../LobbyScreen'
import { useGameStore } from '../../store/gameStore'

beforeEach(() => {
  useGameStore.setState({
    sessionCode: null,
    mpStatus: 'idle',
    mpError: null,
  })
})

describe('LobbyScreen', () => {
  it('shows a "creating session" message while hosting with no code yet', () => {
    useGameStore.setState({ mpStatus: 'hosting', sessionCode: null })
    render(<LobbyScreen />)
    expect(screen.getByText('Erstelle Session…')).toBeInTheDocument()
  })

  it('displays the session code once available', () => {
    useGameStore.setState({ mpStatus: 'hosting', sessionCode: 'ABCDE' })
    render(<LobbyScreen />)
    expect(screen.getByText('ABCDE')).toBeInTheDocument()
  })

  it('shows a connecting message while joining', () => {
    useGameStore.setState({ mpStatus: 'joining' })
    render(<LobbyScreen />)
    expect(screen.getByText('Verbinde mit Session…')).toBeInTheDocument()
  })

  it('shows a success message once connected', () => {
    useGameStore.setState({ mpStatus: 'connected' })
    render(<LobbyScreen />)
    expect(screen.getByText('Verbunden! Spiel wird vorbereitet…')).toBeInTheDocument()
  })

  it('shows the error message and a back button on error', async () => {
    const backToMenu = vi.fn()
    useGameStore.setState({ mpStatus: 'error', mpError: 'Verbindung fehlgeschlagen.', backToMenu })
    const user = userEvent.setup()
    render(<LobbyScreen />)
    expect(screen.getByText('Verbindung fehlgeschlagen.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zurück zum Menü' }))
    expect(backToMenu).toHaveBeenCalledTimes(1)
  })

  it('offers a cancel button for any non-error status', async () => {
    const backToMenu = vi.fn()
    useGameStore.setState({ mpStatus: 'hosting', backToMenu })
    const user = userEvent.setup()
    render(<LobbyScreen />)
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(backToMenu).toHaveBeenCalledTimes(1)
  })
})
