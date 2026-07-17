import type { CardDef, EnergyCardDef, PokemonCardDef, TrainerCardDef } from '../game/types'

let uidCounter = 0
function uid(): string {
  uidCounter += 1
  return `test-uid-${uidCounter}`
}

export function resetUidCounter(): void {
  uidCounter = 0
}

export function makePokemon(overrides: Partial<PokemonCardDef> = {}): PokemonCardDef {
  return {
    kind: 'pokemon',
    id: overrides.id ?? 'test-mon',
    uid: uid(),
    name: 'Testmon',
    setId: 'test',
    setName: 'Test Set',
    number: '1',
    rarity: 'Common',
    pokemonType: 'Fire',
    stage: 'basic',
    hp: 60,
    attacks: [{ name: 'Tackle', cost: ['Colorless'], damage: 20, text: '' }],
    retreatCost: 1,
    imageSmall: 'https://example.com/small.png',
    imageLarge: 'https://example.com/large.png',
    ...overrides,
  }
}

export function makeEnergy(overrides: Partial<EnergyCardDef> = {}): EnergyCardDef {
  return {
    kind: 'energy',
    id: overrides.id ?? 'test-energy',
    uid: uid(),
    name: 'Fire Energy',
    setId: 'test',
    setName: 'Test Set',
    number: '2',
    rarity: 'Common',
    energyType: 'Fire',
    isBasicEnergy: true,
    imageSmall: 'https://example.com/small.png',
    imageLarge: 'https://example.com/large.png',
    ...overrides,
  }
}

export function makeTrainer(overrides: Partial<TrainerCardDef> = {}): TrainerCardDef {
  return {
    kind: 'trainer',
    id: overrides.id ?? 'test-trainer',
    uid: uid(),
    name: 'Test Trainer',
    setId: 'test',
    setName: 'Test Set',
    number: '3',
    rarity: 'Common',
    text: '',
    imageSmall: 'https://example.com/small.png',
    imageLarge: 'https://example.com/large.png',
    ...overrides,
  }
}

/** A minimal legal 60-card deck: 20x basic mon + 40x matching basic energy. */
export function makeLegalDeck(): CardDef[] {
  const cards: CardDef[] = []
  for (let i = 0; i < 20; i++) cards.push(makePokemon({ id: 'basic-mon', name: 'Basicmon' }))
  for (let i = 0; i < 40; i++) cards.push(makeEnergy())
  return cards
}
