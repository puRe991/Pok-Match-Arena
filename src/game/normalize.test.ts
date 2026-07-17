import { describe, expect, it } from 'vitest'
import {
  classifyRarity,
  isDeckLegal,
  normalizeCard,
  normalizeEnergyCard,
  normalizePokemonCard,
  normalizeTrainerCard,
} from './normalize'
import type { RawSetCard } from '../api/sets'

function rawPokemon(overrides: Partial<RawSetCard> = {}): RawSetCard {
  return {
    id: 'base1-1',
    name: 'Charizard',
    supertype: 'Pokémon',
    subtypes: ['Stage 2'],
    hp: '120',
    types: ['Fire'],
    evolvesFrom: 'Charmeleon',
    attacks: [{ name: 'Fire Spin', cost: ['Fire', 'Fire', 'Colorless', 'Colorless'], damage: '100', text: '' }],
    retreatCost: ['Colorless', 'Colorless', 'Colorless'],
    weaknesses: [{ type: 'Water', value: '×2' }],
    rarity: 'Rare Holo',
    number: '4',
    images: { small: 'small.png', large: 'large.png' },
    ...overrides,
  }
}

describe('classifyRarity', () => {
  it('maps known base rarities directly', () => {
    expect(classifyRarity('Common')).toBe('Common')
    expect(classifyRarity('Uncommon')).toBe('Uncommon')
    expect(classifyRarity('Rare')).toBe('Rare')
  })

  it('collapses holo/special variants into Holo Rare', () => {
    expect(classifyRarity('Rare Holo')).toBe('Holo Rare')
    expect(classifyRarity('Rare Ultra')).toBe('Holo Rare')
    expect(classifyRarity('Rare Secret')).toBe('Holo Rare')
    expect(classifyRarity('Rare Rainbow')).toBe('Holo Rare')
    expect(classifyRarity('Rare Shiny')).toBe('Holo Rare')
  })

  it('defaults unknown or missing rarity strings to Common/Rare respectively', () => {
    expect(classifyRarity(undefined)).toBe('Common')
    expect(classifyRarity('Something Unknown')).toBe('Rare')
  })
})

describe('normalizePokemonCard', () => {
  it('converts a raw card into a PokemonCardDef, clamping hp/retreat', () => {
    const card = normalizePokemonCard(rawPokemon({ hp: '999', retreatCost: Array(10).fill('Colorless') }), 'base1', 'Base Set')
    expect(card).not.toBeNull()
    expect(card?.kind).toBe('pokemon')
    expect(card?.hp).toBe(150)
    expect(card?.retreatCost).toBe(4)
    expect(card?.stage).toBe('stage2')
    expect(card?.weakness).toBe('Water')
  })

  it('returns null when hp is missing or not a number', () => {
    expect(normalizePokemonCard(rawPokemon({ hp: undefined }), 'base1', 'Base Set')).toBeNull()
    expect(normalizePokemonCard(rawPokemon({ hp: 'n/a' }), 'base1', 'Base Set')).toBeNull()
  })

  it('returns null when there are no attacks', () => {
    expect(normalizePokemonCard(rawPokemon({ attacks: [] }), 'base1', 'Base Set')).toBeNull()
    expect(normalizePokemonCard(rawPokemon({ attacks: undefined }), 'base1', 'Base Set')).toBeNull()
  })

  it('falls back to Colorless for unknown types and a retreat cost of 1 when absent', () => {
    const card = normalizePokemonCard(rawPokemon({ types: ['Darkness'], retreatCost: undefined }), 'base1', 'Base Set')
    expect(card?.pokemonType).toBe('Colorless')
    expect(card?.retreatCost).toBe(1)
  })

  it('caps attack damage between 0 and 120 and drops extra attacks/costs', () => {
    const card = normalizePokemonCard(
      rawPokemon({
        attacks: [
          { name: 'Huge', damage: '9999', text: '' },
          { name: 'a2', damage: '10' },
          { name: 'a3', damage: '10' },
          { name: 'a4', damage: '10' },
          { name: 'a5 (dropped)', damage: '10' },
        ],
      }),
      'base1',
      'Base Set',
    )
    expect(card?.attacks).toHaveLength(4)
    expect(card?.attacks[0].damage).toBe(120)
    expect(card?.attacks[0].cost).toEqual(['Colorless'])
  })
})

describe('normalizeEnergyCard', () => {
  it('marks Basic-subtype energy as basic and infers type from the name prefix', () => {
    const card = normalizeEnergyCard(
      { id: 'e1', name: 'Fire Energy', supertype: 'Energy', subtypes: ['Basic'], number: '99', images: { small: '', large: '' } },
      'base1',
      'Base Set',
    )
    expect(card.isBasicEnergy).toBe(true)
    expect(card.energyType).toBe('Fire')
  })

  it('treats special energy as non-basic and Colorless when the name has no known prefix', () => {
    const card = normalizeEnergyCard(
      { id: 'e2', name: 'Double Colorless Energy', supertype: 'Energy', subtypes: ['Special'], number: '100', images: { small: '', large: '' } },
      'base1',
      'Base Set',
    )
    expect(card.isBasicEnergy).toBe(false)
    expect(card.energyType).toBe('Colorless')
  })
})

describe('normalizeTrainerCard', () => {
  it('builds a trainer card using the first attack-like block as its text', () => {
    const card = normalizeTrainerCard(
      {
        id: 't1',
        name: 'Professor Oak',
        supertype: 'Trainer',
        number: '88',
        images: { small: '', large: '' },
        attacks: [{ name: 'x', text: 'Discard your hand, then draw 7 cards.' }],
      },
      'base1',
      'Base Set',
    )
    expect(card.kind).toBe('trainer')
    expect(card.text).toBe('Discard your hand, then draw 7 cards.')
  })
})

describe('normalizeCard', () => {
  it('dispatches by supertype', () => {
    expect(normalizeCard(rawPokemon(), 'base1', 'Base Set')?.kind).toBe('pokemon')
    expect(
      normalizeCard(
        { id: 'e1', name: 'Water Energy', supertype: 'Energy', number: '1', images: { small: '', large: '' } },
        'base1',
        'Base Set',
      )?.kind,
    ).toBe('energy')
    expect(
      normalizeCard(
        { id: 'tr1', name: 'Bill', supertype: 'Trainer', number: '1', images: { small: '', large: '' } },
        'base1',
        'Base Set',
      )?.kind,
    ).toBe('trainer')
  })
})

describe('isDeckLegal', () => {
  it('excludes trainers and special energy, includes pokemon and basic energy', () => {
    expect(
      isDeckLegal({ kind: 'trainer', id: '1', uid: '', name: 'x', setId: 's', setName: 'S', number: '1', rarity: 'Common', imageSmall: '', imageLarge: '', text: '' }),
    ).toBe(false)
    expect(
      isDeckLegal({
        kind: 'energy',
        id: '2',
        uid: '',
        name: 'x',
        setId: 's',
        setName: 'S',
        number: '1',
        rarity: 'Common',
        imageSmall: '',
        imageLarge: '',
        energyType: 'Fire',
        isBasicEnergy: false,
      }),
    ).toBe(false)
    expect(
      isDeckLegal({
        kind: 'energy',
        id: '3',
        uid: '',
        name: 'x',
        setId: 's',
        setName: 'S',
        number: '1',
        rarity: 'Common',
        imageSmall: '',
        imageLarge: '',
        energyType: 'Fire',
        isBasicEnergy: true,
      }),
    ).toBe(true)
    const pokemon = normalizePokemonCard(rawPokemon(), 'base1', 'Base Set')!
    expect(isDeckLegal(pokemon)).toBe(true)
  })
})
