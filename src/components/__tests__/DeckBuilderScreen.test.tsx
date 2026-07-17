import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeckBuilderScreen } from '../DeckBuilderScreen'
import { useCollectionStore } from '../../store/collectionStore'
import { makeEnergy, makePokemon, makeTrainer, resetUidCounter } from '../../test/fixtures'

const COLLECTION_STORE_DEFAULTS = {
  collection: {},
  packHistory: [],
  decks: [],
  activeDeckId: null,
  starterReady: false,
}

beforeEach(() => {
  resetUidCounter()
  useCollectionStore.setState(COLLECTION_STORE_DEFAULTS)
})

describe('DeckBuilderScreen', () => {
  it('prompts to select/create a deck when none exists', () => {
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    expect(screen.getByText('Wähle oder erstelle ein Deck.')).toBeInTheDocument()
  })

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: /Menü/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('creating a deck starts an empty 0/60 draft that can be edited', async () => {
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    expect(screen.getByText('0/60')).toBeInTheDocument()
    expect(useCollectionStore.getState().decks).toHaveLength(1)
  })

  it('excludes trainers and special energy from the collection browser (deck-illegal cards)', async () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basicmon', stage: 'basic' })
    const trainer = makeTrainer({ id: 'trainer1', name: 'Potion' })
    const specialEnergy = makeEnergy({ id: 'special1', name: 'Double Colorless', isBasicEnergy: false })
    useCollectionStore.setState({
      collection: {
        basic1: { card: basic, count: 4 },
        trainer1: { card: trainer, count: 1 },
        special1: { card: specialEnergy, count: 1 },
      },
    })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    expect(screen.getByText('Basicmon')).toBeInTheDocument()
    expect(screen.queryByText('Potion')).not.toBeInTheDocument()
    expect(screen.queryByText('Double Colorless')).not.toBeInTheDocument()
  })

  it('adding a card from the collection increments the draft and moves it into the deck panel', async () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basicmon', stage: 'basic' })
    useCollectionStore.setState({ collection: { basic1: { card: basic, count: 4 } } })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))

    await user.click(screen.getByRole('button', { name: /Basicmon/ }))
    expect(screen.getByText('1/4 Fire')).toBeInTheDocument()
    expect(screen.getByText('1x')).toBeInTheDocument()
  })

  it('does not allow adding more copies than owned or than the 4x card limit', async () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basicmon', stage: 'basic' })
    useCollectionStore.setState({ collection: { basic1: { card: basic, count: 2 } } })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))

    const addButton = screen.getByRole('button', { name: /Basicmon/ })
    await user.click(addButton)
    await user.click(addButton)
    expect(screen.getByText('2/2 Fire')).toBeInTheDocument()
    expect(addButton).toBeDisabled()
  })

  it('removing a card from the deck panel decrements the draft count', async () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basicmon', stage: 'basic' })
    useCollectionStore.setState({ collection: { basic1: { card: basic, count: 4 } } })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    await user.click(screen.getByRole('button', { name: /Basicmon/ }))

    const deckPanel = screen.getByText('Dein Deck').closest('div')!
    const deckCardButton = within(deckPanel).getByRole('button', { name: /Basicmon/ })
    await user.click(deckCardButton)
    expect(screen.getByText('Noch keine Karten im Deck — klicke links auf Karten, um sie hinzuzufügen.')).toBeInTheDocument()
  })

  it('shows validation errors for an invalid deck and blocks activation', async () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basicmon', stage: 'basic' })
    useCollectionStore.setState({ collection: { basic1: { card: basic, count: 4 } } })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    await user.click(screen.getByRole('button', { name: /Basicmon/ }))

    expect(screen.getByText(/Mindestens 60 Karten/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Als aktiv setzen' })).toBeDisabled()
  })

  it('saves the draft to the store when "Speichern" is clicked', async () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basicmon', stage: 'basic' })
    const energy = makeEnergy({ id: 'energy1', name: 'Fire Energy', isBasicEnergy: true })
    useCollectionStore.setState({ collection: { basic1: { card: basic, count: 4 }, energy1: { card: energy, count: 60 } } })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    await user.click(screen.getByRole('button', { name: /Basicmon/ }))
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    const deckId = useCollectionStore.getState().decks[0].id
    expect(useCollectionStore.getState().decks.find((d) => d.id === deckId)?.cardCounts).toEqual({ basic1: 1 })
  })

  it('activating a valid deck sets it as the active deck', async () => {
    const basic = makePokemon({ id: 'basic1', name: 'Basicmon', stage: 'basic' })
    const energy = makeEnergy({ id: 'energy1', name: 'Fire Energy', isBasicEnergy: true })
    useCollectionStore.setState({ collection: { basic1: { card: basic, count: 4 }, energy1: { card: energy, count: 60 } } })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    await user.click(screen.getByRole('button', { name: /Basicmon/ }))
    const collectionPanel = screen.getByText('Sammlung').closest('div')!
    const energyAddButton = within(collectionPanel).getByRole('button', { name: /Fire Energy/ })
    for (let i = 0; i < 59; i++) {
      await user.click(energyAddButton)
    }
    expect(screen.getByText('60/60')).toBeInTheDocument()
    const activateButton = screen.getByRole('button', { name: 'Als aktiv setzen' })
    expect(activateButton).toBeEnabled()
    await user.click(activateButton)

    const deckId = useCollectionStore.getState().decks[0].id
    expect(useCollectionStore.getState().activeDeckId).toBe(deckId)
  })

  it('deleting a deck removes it and returns to the empty state', async () => {
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    await user.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(useCollectionStore.getState().decks).toHaveLength(0)
    expect(screen.getByText('Wähle oder erstelle ein Deck.')).toBeInTheDocument()
  })

  it('filters the collection by search text', async () => {
    const fire = makePokemon({ id: 'fire1', name: 'Flareon', stage: 'basic' })
    const water = makePokemon({ id: 'water1', name: 'Vaporeon', stage: 'basic' })
    useCollectionStore.setState({
      collection: { fire1: { card: fire, count: 1 }, water1: { card: water, count: 1 } },
    })
    const user = userEvent.setup()
    render(<DeckBuilderScreen onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '+ Neues Deck' }))
    expect(screen.getByText('Flareon')).toBeInTheDocument()
    expect(screen.getByText('Vaporeon')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Suche…'), 'Vapor')
    expect(screen.queryByText('Flareon')).not.toBeInTheDocument()
    expect(screen.getByText('Vaporeon')).toBeInTheDocument()
  })
})
