import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BoardPokemon } from '../BoardPokemon'
import { makeEnergy, makePokemon, resetUidCounter } from '../../test/fixtures'
import { makeInPlay } from '../../test/gameState'

describe('BoardPokemon', () => {
  it('shows current/max HP based on damage taken', () => {
    resetUidCounter()
    const card = makePokemon({ hp: 100 })
    const mon = makeInPlay(card, { damage: 30 })
    render(<BoardPokemon mon={mon} />)
    expect(screen.getByText('70/100 HP')).toBeInTheDocument()
  })

  it('never shows negative remaining HP', () => {
    resetUidCounter()
    const card = makePokemon({ hp: 50 })
    const mon = makeInPlay(card, { damage: 999 })
    render(<BoardPokemon mon={mon} />)
    expect(screen.getByText('0/50 HP')).toBeInTheDocument()
  })

  it('renders a status icon for each active status', () => {
    resetUidCounter()
    const card = makePokemon()
    const mon = makeInPlay(card, { statuses: ['poisoned', 'confused'] })
    render(<BoardPokemon mon={mon} />)
    expect(screen.getByTitle('poisoned')).toBeInTheDocument()
    expect(screen.getByTitle('confused')).toBeInTheDocument()
  })

  it('shows an EVO badge only once the Pokémon has evolved', () => {
    resetUidCounter()
    const basic = makePokemon({ name: 'Basic' })
    const evo = makePokemon({ name: 'Evo' })
    const unevolved = makeInPlay(basic)
    const evolved = makeInPlay(basic, { stages: [basic, evo] })
    const { rerender } = render(<BoardPokemon mon={unevolved} />)
    expect(screen.queryByText('EVO')).not.toBeInTheDocument()
    rerender(<BoardPokemon mon={evolved} />)
    expect(screen.getByText('EVO')).toBeInTheDocument()
  })

  it('renders one dot per attached energy', () => {
    resetUidCounter()
    const card = makePokemon()
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy(), makeEnergy(), makeEnergy()] })
    const { container } = render(<BoardPokemon mon={mon} />)
    expect(container.querySelectorAll('[title$="Energy"]')).toHaveLength(3)
  })

  it('is clickable only when onClick is provided, and invokes it', async () => {
    resetUidCounter()
    const user = userEvent.setup()
    const onClick = vi.fn()
    const card = makePokemon()
    const { rerender } = render(<BoardPokemon mon={makeInPlay(card)} />)
    expect(screen.getByRole('button')).toBeDisabled()

    rerender(<BoardPokemon mon={makeInPlay(card)} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
