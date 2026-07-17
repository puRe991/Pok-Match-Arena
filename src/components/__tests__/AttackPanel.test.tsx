import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttackPanel } from '../AttackPanel'
import { makeEnergy, makePokemon, resetUidCounter } from '../../test/fixtures'
import { makeInPlay } from '../../test/gameState'

describe('AttackPanel', () => {
  it('renders nothing when the top stage has no attacks', () => {
    resetUidCounter()
    const card = makePokemon({ attacks: [] })
    const { container } = render(<AttackPanel mon={makeInPlay(card)} turnNumber={1} onAttack={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('disables an attack the Pokémon cannot currently pay for', () => {
    resetUidCounter()
    const card = makePokemon({ attacks: [{ name: 'Big', cost: ['Fire', 'Fire'], damage: 50, text: '' }] })
    render(<AttackPanel mon={makeInPlay(card)} turnNumber={1} onAttack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Big/ })).toBeDisabled()
  })

  it('enables a usable attack and fires onAttack with its index', async () => {
    resetUidCounter()
    const user = userEvent.setup()
    const onAttack = vi.fn()
    const card = makePokemon({
      attacks: [
        { name: 'Weak', cost: ['Colorless', 'Colorless'], damage: 10, text: '' },
        { name: 'Strong', cost: ['Fire'], damage: 40, text: '' },
      ],
    })
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy({ energyType: 'Fire' })] })
    render(<AttackPanel mon={mon} turnNumber={1} onAttack={onAttack} />)

    expect(screen.getByRole('button', { name: /Weak/ })).toBeDisabled()
    const strongBtn = screen.getByRole('button', { name: /Strong/ })
    expect(strongBtn).toBeEnabled()
    await user.click(strongBtn)
    expect(onAttack).toHaveBeenCalledWith(1)
  })

  it('disables all attacks when the panel itself is disabled', () => {
    resetUidCounter()
    const card = makePokemon({ attacks: [{ name: 'Tackle', cost: ['Colorless'], damage: 20, text: '' }] })
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy()] })
    render(<AttackPanel mon={mon} turnNumber={1} disabled onAttack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Tackle/ })).toBeDisabled()
  })
})
