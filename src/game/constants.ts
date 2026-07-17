import type { ElementType } from './types'

// All Pokemon types the game understands. Every one of these can appear as a
// Pokemon's type or weakness/resistance; energy-bearing types are a subset
// (see ENERGY_TYPES) since the real TCG has no Colorless or Dragon basic
// energy card — Colorless costs are paid with any attached energy, and
// Dragon-type attacks always list concrete elemental costs instead.
export const ALL_ELEMENT_TYPES: ElementType[] = [
  'Fire',
  'Water',
  'Grass',
  'Lightning',
  'Fighting',
  'Psychic',
  'Darkness',
  'Metal',
  'Fairy',
  'Dragon',
  'Colorless',
]

export const ENERGY_TYPES: ElementType[] = [
  'Fire',
  'Water',
  'Grass',
  'Lightning',
  'Fighting',
  'Psychic',
  'Darkness',
  'Metal',
  'Fairy',
]

export const DECK_SIZE = 60
export const PRIZE_COUNT = 6
export const MAX_COPIES_PER_CARD = 4
export const STARTING_HAND_SIZE = 7
export const BENCH_SIZE = 5
export const MAX_MULLIGAN_BONUS = 3
