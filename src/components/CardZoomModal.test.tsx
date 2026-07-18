import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardZoomModal } from './CardZoomModal'
import { FALLBACK_POKEMON } from '../api/fallbackCards'

const charmander = FALLBACK_POKEMON.find((c) => c.id === 'offline-46')!

describe('CardZoomModal', () => {
  it('renders nothing when no card is given', () => {
    render(<CardZoomModal card={null} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the large image and details for a Pokémon card', () => {
    render(<CardZoomModal card={charmander} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: charmander.name })).toHaveAttribute('src', charmander.imageLarge)
    expect(screen.getAllByText(charmander.name).length).toBeGreaterThan(0)
    expect(screen.getByText(`${charmander.hp} KP`)).toBeInTheDocument()
    expect(screen.getByText(charmander.attacks[0].name)).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<CardZoomModal card={charmander} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    render(<CardZoomModal card={charmander} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
