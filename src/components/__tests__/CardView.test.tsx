import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardBack, CardView, TypeBadge } from '../CardView'
import { makePokemon, resetUidCounter } from '../../test/fixtures'

describe('TypeBadge', () => {
  it('renders the type label', () => {
    render(<TypeBadge type="Fire" />)
    expect(screen.getByText('Fire')).toBeInTheDocument()
  })

  it('falls back to a neutral style for an unknown type', () => {
    render(<TypeBadge type="Mystery" />)
    expect(screen.getByText('Mystery')).toBeInTheDocument()
  })
})

describe('CardView', () => {
  it('renders the card name and image', () => {
    resetUidCounter()
    const card = makePokemon({ name: 'Pikachu' })
    render(<CardView card={card} />)
    expect(screen.getAllByText('Pikachu').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: 'Pikachu' })).toHaveAttribute('src', card.imageSmall)
  })

  it('is disabled and not clickable when no onClick is given', () => {
    resetUidCounter()
    const card = makePokemon()
    render(<CardView card={card} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when clicked', async () => {
    resetUidCounter()
    const user = userEvent.setup()
    const onClick = vi.fn()
    const card = makePokemon()
    render(<CardView card={card} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('CardBack', () => {
  it('renders without crashing', () => {
    const { container } = render(<CardBack />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
