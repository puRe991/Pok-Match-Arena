import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardBack, CardView, TypeBadge } from './CardView'
import { FALLBACK_POOL } from '../api/fallbackCards'

const charmander = FALLBACK_POOL.find((c) => c.id === 'offline-46')!

describe('TypeBadge', () => {
  it('renders the type label', () => {
    render(<TypeBadge type="Fire" />)
    expect(screen.getByText('Fire')).toBeInTheDocument()
  })
})

describe('CardView', () => {
  it('renders the card name and image', () => {
    render(<CardView card={charmander} />)
    expect(screen.getAllByText(charmander.name).length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: charmander.name })).toHaveAttribute('src', charmander.imageSmall)
  })

  it('is disabled and unclickable when no onClick handler is given', () => {
    render(<CardView card={charmander} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<CardView card={charmander} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows no zoom button without an onZoom handler', () => {
    render(<CardView card={charmander} />)
    expect(screen.queryByRole('button', { name: `${charmander.name} vergrößern` })).not.toBeInTheDocument()
  })

  it('calls onZoom without triggering onClick when the zoom button is clicked', async () => {
    const onClick = vi.fn()
    const onZoom = vi.fn()
    render(<CardView card={charmander} onClick={onClick} onZoom={onZoom} />)
    await userEvent.click(screen.getByRole('button', { name: `${charmander.name} vergrößern` }))
    expect(onZoom).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('CardBack', () => {
  it('renders without crashing', () => {
    const { container } = render(<CardBack />)
    expect(container.firstChild).toBeTruthy()
  })
})
