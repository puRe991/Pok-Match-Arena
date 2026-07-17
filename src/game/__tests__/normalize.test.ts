import { describe, expect, it } from 'vitest'
import { classifyRarity, isDeckLegal, normalizeCard, normalizeEnergyCard, normalizePokemonCard, normalizeTrainerCard } from '../normalize'
import { makeEnergy, makePokemon, makeTrainer } from '../../test/fixtures'
import type { RawSetCard } from '../../api/sets'

function rawCard(overrides: Partial<RawSetCard> = {}): RawSetCard {
  return {
    id: 'base1-1',
    name: 'Testmon',
    supertype: 'Pokémon',
    number: '1',
    images: { small: 'small.png', large: 'large.png' },
    ...overrides,
  }
}

describe('classifyRarity', () => {
  it('maps well-known rarities directly', () => {
    expect(classifyRarity('Common')).toBe('Common')
    expect(classifyRarity('Uncommon')).toBe('Uncommon')
    expect(classifyRarity('Rare')).toBe('Rare')
  })

  it('collapses holo/special variants into Holo Rare', () => {
    expect(classifyRarity('Rare Holo')).toBe('Holo Rare')
    expect(classifyRarity('Rare Ultra')).toBe('Holo Rare')
    expect(classifyRarity('Rare Secret')).toBe('Holo Rare')
    expect(classifyRarity('Rainbow Rare')).toBe('Holo Rare')
    expect(classifyRarity('Amazing Rare')).toBe('Rare')
  })

  it('defaults unknown/undefined rarity strings sensibly', () => {
    expect(classifyRarity(undefined)).toBe('Common')
    expect(classifyRarity('Something Weird')).toBe('Rare')
  })
})

describe('normalizePokemonCard', () => {
  it('parses a well-formed Pokémon card', () => {
    const raw = rawCard({
      hp: '120',
      types: ['Fire'],
      subtypes: ['Basic'],
      attacks: [{ name: 'Ember', cost: ['Fire', 'Colorless'], damage: '30', text: 'Deal 30.' }],
      retreatCost: ['Colorless'],
      weaknesses: [{ type: 'Water', value: '×2' }],
      rarity: 'Rare Holo',
    })
    const card = normalizePokemonCard(raw, 'base1', 'Base Set')
    expect(card).not.toBeNull()
    expect(card?.hp).toBe(120)
    expect(card?.pokemonType).toBe('Fire')
    expect(card?.stage).toBe('basic')
    expect(card?.attacks[0].damage).toBe(30)
    expect(card?.retreatCost).toBe(1)
    expect(card?.weakness).toBe('Water')
    expect(card?.rarity).toBe('Holo Rare')
  })

  it('rejects cards with no HP', () => {
    const raw = rawCard({ hp: undefined, attacks: [{ name: 'A', damage: '10' }] })
    expect(normalizePokemonCard(raw, 'base1', 'Base Set')).toBeNull()
  })

  it('rejects cards with no attacks', () => {
    const raw = rawCard({ hp: '60', attacks: [] })
    expect(normalizePokemonCard(raw, 'base1', 'Base Set')).toBeNull()
  })

  it('clamps HP to a maximum of 150 and damage to a maximum of 120', () => {
    const raw = rawCard({
      hp: '340',
      attacks: [{ name: 'Big', damage: '400' }],
    })
    const card = normalizePokemonCard(raw, 'base1', 'Base Set')
    expect(card?.hp).toBe(150)
    expect(card?.attacks[0].damage).toBe(120)
  })

  it('clamps retreat cost between 0 and 4', () => {
    const huge = rawCard({ hp: '60', attacks: [{ name: 'A', damage: '10' }], retreatCost: Array(10).fill('Colorless') })
    expect(normalizePokemonCard(huge, 'base1', 'Base Set')?.retreatCost).toBe(4)
  })

  it('falls back to Colorless for unrecognized types', () => {
    const raw = rawCard({ hp: '60', types: ['Fairy'], attacks: [{ name: 'A', damage: '10' }] })
    expect(normalizePokemonCard(raw, 'base1', 'Base Set')?.pokemonType).toBe('Colorless')
  })

  it('detects Stage 1 / Stage 2 subtypes', () => {
    const s1 = rawCard({ hp: '90', subtypes: ['Stage 1'], attacks: [{ name: 'A', damage: '10' }] })
    const s2 = rawCard({ hp: '120', subtypes: ['Stage 2'], attacks: [{ name: 'A', damage: '10' }] })
    expect(normalizePokemonCard(s1, 'base1', 'Base Set')?.stage).toBe('stage1')
    expect(normalizePokemonCard(s2, 'base1', 'Base Set')?.stage).toBe('stage2')
  })
})

describe('normalizeEnergyCard', () => {
  it('detects basic energy from subtypes and guesses type from the name', () => {
    const raw = rawCard({ name: 'Fire Energy', supertype: 'Energy', subtypes: ['Basic'] })
    const card = normalizeEnergyCard(raw, 'base1', 'Base Set')
    expect(card.isBasicEnergy).toBe(true)
    expect(card.energyType).toBe('Fire')
  })

  it('falls back to Colorless when the name does not start with a known type', () => {
    const raw = rawCard({ name: 'Double Colorless Energy', supertype: 'Energy', subtypes: ['Special'] })
    const card = normalizeEnergyCard(raw, 'base1', 'Base Set')
    expect(card.isBasicEnergy).toBe(false)
    expect(card.energyType).toBe('Colorless')
  })
})

describe('normalizeTrainerCard', () => {
  it('carries over the first attack text field as the trainer text', () => {
    const raw = rawCard({ name: 'Potion', supertype: 'Trainer', attacks: [{ name: '', text: 'Heal 20 damage.' }] })
    const card = normalizeTrainerCard(raw, 'base1', 'Base Set')
    expect(card.text).toBe('Heal 20 damage.')
  })

  it('defaults to empty text when absent', () => {
    const raw = rawCard({ name: 'Potion', supertype: 'Trainer' })
    expect(normalizeTrainerCard(raw, 'base1', 'Base Set').text).toBe('')
  })
})

describe('normalizeCard dispatch', () => {
  it('routes by supertype and returns null for an unparsable Pokémon card', () => {
    expect(normalizeCard(rawCard({ supertype: 'Pokémon', hp: undefined }), 'base1', 'Base Set')).toBeNull()
    expect(normalizeCard(rawCard({ supertype: 'Energy', name: 'Water Energy' }), 'base1', 'Base Set')?.kind).toBe('energy')
    expect(normalizeCard(rawCard({ supertype: 'Trainer', name: 'Potion' }), 'base1', 'Base Set')?.kind).toBe('trainer')
  })
})

describe('isDeckLegal', () => {
  it('allows Pokémon and basic energy, rejects trainers and special energy', () => {
    expect(isDeckLegal(makePokemon())).toBe(true)
    expect(isDeckLegal(makeEnergy({ isBasicEnergy: true }))).toBe(true)
    expect(isDeckLegal(makeEnergy({ isBasicEnergy: false }))).toBe(false)
    expect(isDeckLegal(makeTrainer())).toBe(false)
  })
})
