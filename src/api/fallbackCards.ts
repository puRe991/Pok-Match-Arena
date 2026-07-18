import type { AttackDef, ElementType, EnergyCardDef, PokemonCardDef, Rarity, Stage, TrainerCardDef } from '../game/types'

// Offline safety net used only if the live Pokemon TCG API can't be reached
// (network unavailable, rate limited, etc). Stats are hand-picked so packs,
// starter decks and the NPC deck still work without a network connection.
function mon(
  id: string,
  name: string,
  pokemonType: ElementType,
  stage: Stage,
  hp: number,
  attacks: AttackDef[],
  retreatCost: number,
  weakness: ElementType | undefined,
  evolvesFrom: string | undefined,
): PokemonCardDef {
  return {
    kind: 'pokemon',
    id: `offline-${id}`,
    uid: '',
    name,
    setId: 'offline',
    setName: 'Offline-Kartensatz',
    number: id,
    rarity: 'Common',
    pokemonType,
    stage,
    evolvesFrom,
    hp,
    attacks,
    retreatCost,
    weakness,
    imageSmall: `https://images.pokemontcg.io/base1/${id}.png`,
    imageLarge: `https://images.pokemontcg.io/base1/${id}_hires.png`,
  }
}

export const FALLBACK_POKEMON: PokemonCardDef[] = [
  mon('46', 'Charmander', 'Fire', 'basic', 60, [{ name: 'Ember', cost: ['Fire'], damage: 20, text: '' }], 1, 'Water', undefined),
  mon(
    '24',
    'Charmeleon',
    'Fire',
    'stage1',
    90,
    [{ name: 'Flamethrower', cost: ['Fire', 'Colorless'], damage: 50, text: '' }],
    2,
    'Water',
    'Charmander',
  ),
  mon('63', 'Squirtle', 'Water', 'basic', 60, [{ name: 'Water Gun', cost: ['Water'], damage: 20, text: '' }], 1, 'Lightning', undefined),
  mon(
    '42',
    'Wartortle',
    'Water',
    'stage1',
    90,
    [{ name: 'Hydro Pump', cost: ['Water', 'Colorless'], damage: 40, text: '' }],
    2,
    'Lightning',
    'Squirtle',
  ),
  mon('44', 'Bulbasaur', 'Grass', 'basic', 60, [{ name: 'Vine Whip', cost: ['Grass'], damage: 20, text: '' }], 1, 'Fire', undefined),
  mon(
    '30',
    'Ivysaur',
    'Grass',
    'stage1',
    90,
    [{ name: 'Razor Leaf', cost: ['Grass', 'Colorless'], damage: 40, text: '' }],
    2,
    'Fire',
    'Bulbasaur',
  ),
  mon('58', 'Pikachu', 'Lightning', 'basic', 60, [{ name: 'Thunder Shock', cost: ['Lightning'], damage: 20, text: '' }], 1, 'Fighting', undefined),
  mon(
    '14',
    'Raichu',
    'Lightning',
    'stage1',
    90,
    [{ name: 'Thunderbolt', cost: ['Lightning', 'Colorless'], damage: 50, text: '' }],
    2,
    'Fighting',
    'Pikachu',
  ),
  mon('52', 'Machop', 'Fighting', 'basic', 70, [{ name: 'Karate Chop', cost: ['Fighting'], damage: 20, text: '' }], 1, 'Psychic', undefined),
  mon(
    '34',
    'Machoke',
    'Fighting',
    'stage1',
    100,
    [{ name: 'Seismic Toss', cost: ['Fighting', 'Colorless'], damage: 50, text: '' }],
    3,
    'Psychic',
    'Machop',
  ),
  mon('43', 'Abra', 'Psychic', 'basic', 50, [{ name: 'Confuse Ray', cost: ['Psychic'], damage: 10, text: 'Confuses the Defending Pokémon.' }], 1, undefined, undefined),
  mon(
    '32',
    'Kadabra',
    'Psychic',
    'stage1',
    80,
    [{ name: 'Psybeam', cost: ['Psychic', 'Colorless'], damage: 40, text: '' }],
    2,
    undefined,
    'Abra',
  ),
  mon('51', 'Eevee', 'Colorless', 'basic', 60, [{ name: 'Tackle', cost: ['Colorless'], damage: 20, text: '' }], 1, undefined, undefined),
]

function energy(id: string, type: ElementType): EnergyCardDef {
  return {
    kind: 'energy',
    id: `offline-${id}`,
    uid: '',
    name: `${type} Energy`,
    setId: 'offline',
    setName: 'Offline-Kartensatz',
    number: id,
    rarity: 'Common',
    energyType: type,
    isBasicEnergy: true,
    imageSmall: `https://images.pokemontcg.io/base1/${id}.png`,
    imageLarge: `https://images.pokemontcg.io/base1/${id}_hires.png`,
  }
}

const doubleColorlessEnergy: EnergyCardDef = {
  kind: 'energy',
  id: 'offline-96',
  uid: '',
  name: 'Double Colorless Energy',
  setId: 'offline',
  setName: 'Offline-Kartensatz',
  number: '96',
  rarity: 'Uncommon',
  energyType: 'Colorless',
  isBasicEnergy: false,
  provides: ['Colorless', 'Colorless'],
  imageSmall: 'https://images.pokemontcg.io/base1/96.png',
  imageLarge: 'https://images.pokemontcg.io/base1/96_hires.png',
}

export const FALLBACK_ENERGY: EnergyCardDef[] = [
  energy('97', 'Fighting'),
  energy('98', 'Fire'),
  energy('99', 'Grass'),
  energy('100', 'Lightning'),
  energy('101', 'Psychic'),
  energy('102', 'Water'),
  doubleColorlessEnergy,
]

function trainer(id: string, name: string, text: string, rarity: Rarity = 'Common'): TrainerCardDef {
  return {
    kind: 'trainer',
    id: `offline-${id}`,
    uid: '',
    name,
    setId: 'offline',
    setName: 'Offline-Kartensatz',
    number: id,
    rarity,
    text,
    imageSmall: `https://images.pokemontcg.io/base1/${id}.png`,
    imageLarge: `https://images.pokemontcg.io/base1/${id}_hires.png`,
  }
}

export const FALLBACK_TRAINERS: TrainerCardDef[] = [
  trainer('91', 'Bill', 'Draw 2 cards.'),
  trainer('88', 'Professor Oak', 'Discard your hand, then draw 7 cards.', 'Uncommon'),
  trainer('94', 'Potion', 'Remove 2 damage counters from 1 of your Pokémon.'),
  trainer('90', 'Super Potion', 'Discard 1 Energy card, then remove 4 damage counters.', 'Uncommon'),
  trainer('95', 'Switch', 'Switch your Active Pokémon with 1 of your Benched Pokémon.'),
  trainer('93', 'Gust of Wind', 'Choose 1 of your opponent’s Benched Pokémon and switch it with the Active.', 'Uncommon'),
  trainer('92', 'Energy Removal', 'Discard 1 Energy card attached to 1 of your opponent’s Pokémon.'),
  trainer('84', 'PlusPower', 'Your attack does 10 more damage this turn.'),
  trainer('83', 'Full Heal', 'Remove all Special Conditions from 1 of your Pokémon.'),
  trainer('85', 'Pokémon Center', 'Remove all damage counters from your Pokémon, then discard their Energy.', 'Uncommon'),
  trainer('81', 'Energy Retrieval', 'Return up to 2 basic Energy cards from your discard pile to your hand.', 'Uncommon'),
  trainer('82', 'Energy Search', 'Search your deck for a basic Energy card and put it into your hand.'),
  trainer('60', 'Gambler', 'Shuffle your hand into your deck. Flip a coin. Heads: draw 8. Tails: draw 1.'),
  trainer('89', 'Revive', 'Put a Basic Pokémon from your discard pile onto your Bench with half its HP as damage.', 'Uncommon'),
]

export const FALLBACK_POOL = [...FALLBACK_POKEMON, ...FALLBACK_ENERGY, ...FALLBACK_TRAINERS]
