import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerSide } from '../PlayerSide'
import { makePokemon, resetUidCounter } from '../../test/fixtures'
import { makeInPlay, makePlayer } from '../../test/gameState'

describe('PlayerSide', () => {
  it('shows a placeholder when there is no active Pokémon', () => {
    resetUidCounter()
    const player = makePlayer('p1')
    render(
      <PlayerSide
        player={player}
        isTurn={false}
        selectableIds={new Set()}
        onSelectMon={vi.fn()}
      />,
    )
    expect(screen.getByText('Kein aktives Pokémon')).toBeInTheDocument()
  })

  it('renders pile counts for prizes, deck, and discard', () => {
    resetUidCounter()
    const player = makePlayer('p1', {
      prizes: [makePokemon(), makePokemon()],
      deck: [makePokemon()],
      discard: [makePokemon(), makePokemon(), makePokemon()],
    })
    render(<PlayerSide player={player} isTurn={false} selectableIds={new Set()} onSelectMon={vi.fn()} />)
    expect(screen.getByText('Prizes (2)')).toBeInTheDocument()
    expect(screen.getByText('Deck (1)')).toBeInTheDocument()
    expect(screen.getByText('Ablage (3)')).toBeInTheDocument()
  })

  it('shows the hand count only when showHandCount is set', () => {
    resetUidCounter()
    const player = makePlayer('p1', { hand: [makePokemon(), makePokemon()] })
    const { rerender } = render(
      <PlayerSide player={player} isTurn={false} selectableIds={new Set()} onSelectMon={vi.fn()} />,
    )
    expect(screen.queryByText(/Hand \(/)).not.toBeInTheDocument()
    rerender(
      <PlayerSide player={player} isTurn={false} selectableIds={new Set()} onSelectMon={vi.fn()} showHandCount />,
    )
    expect(screen.getByText('Hand (2)')).toBeInTheDocument()
  })

  it('marks the active Pokémon selectable and fires onSelectMon when clicked', async () => {
    resetUidCounter()
    const user = userEvent.setup()
    const onSelectMon = vi.fn()
    const active = makeInPlay(makePokemon({ name: 'Active' }))
    const player = makePlayer('p1', { active })
    render(
      <PlayerSide
        player={player}
        isTurn
        selectableIds={new Set([active.instanceId])}
        onSelectMon={onSelectMon}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Active/ }))
    expect(onSelectMon).toHaveBeenCalledWith(active.instanceId)
  })

  it('does not make a non-selectable active Pokémon clickable', () => {
    resetUidCounter()
    const active = makeInPlay(makePokemon({ name: 'Active' }))
    const player = makePlayer('p1', { active })
    render(<PlayerSide player={player} isTurn selectableIds={new Set()} onSelectMon={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Active/ })).toBeDisabled()
  })

  it('pads the bench display up to 5 slots with empty placeholders', () => {
    resetUidCounter()
    const bench = [makeInPlay(makePokemon({ name: 'Bench1' })), makeInPlay(makePokemon({ name: 'Bench2' }))]
    const player = makePlayer('p1', { bench })
    const { container } = render(
      <PlayerSide player={player} isTurn={false} selectableIds={new Set()} onSelectMon={vi.fn()} />,
    )
    expect(container.querySelectorAll('[class*="border-dashed border-slate-700"]')).toHaveLength(3)
  })

  it('shows the "Am Zug" badge only while it is that player turn', () => {
    resetUidCounter()
    const player = makePlayer('p1')
    const { rerender } = render(
      <PlayerSide player={player} isTurn={false} selectableIds={new Set()} onSelectMon={vi.fn()} />,
    )
    expect(screen.queryByText('Am Zug')).not.toBeInTheDocument()
    rerender(<PlayerSide player={player} isTurn selectableIds={new Set()} onSelectMon={vi.fn()} />)
    expect(screen.getByText('Am Zug')).toBeInTheDocument()
  })
})
