import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandView } from '../HandView'
import { makePokemon, resetUidCounter } from '../../test/fixtures'

describe('HandView', () => {
  it('shows a placeholder message when the hand is empty', () => {
    render(<HandView cards={[]} playableUids={new Set()} onCardClick={vi.fn()} />)
    expect(screen.getByText('Keine Karten auf der Hand.')).toBeInTheDocument()
  })

  it('renders one CardView per card in hand', () => {
    resetUidCounter()
    const cards = [makePokemon({ name: 'A' }), makePokemon({ name: 'B' })]
    render(<HandView cards={cards} playableUids={new Set()} onCardClick={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('only invokes onCardClick for playable cards', async () => {
    resetUidCounter()
    const user = userEvent.setup()
    const onCardClick = vi.fn()
    const playable = makePokemon({ name: 'Playable' })
    const unplayable = makePokemon({ name: 'Unplayable' })
    render(
      <HandView
        cards={[playable, unplayable]}
        playableUids={new Set([playable.uid])}
        onCardClick={onCardClick}
      />,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeEnabled()
    expect(buttons[1]).toBeDisabled()

    await user.click(buttons[0])
    expect(onCardClick).toHaveBeenCalledWith(playable)
  })
})
