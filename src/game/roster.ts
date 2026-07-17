import type { ElementType } from './types'

export interface RosterLine {
  type: ElementType
  basic: string
  stage1?: string
}

// Curated evolution lines used to build the shared card pool. Kept small and
// well-known so the attack costs/damage we normalize from the API stay sane.
export const ROSTER: RosterLine[] = [
  { type: 'Fire', basic: 'Charmander', stage1: 'Charmeleon' },
  { type: 'Water', basic: 'Squirtle', stage1: 'Wartortle' },
  { type: 'Grass', basic: 'Bulbasaur', stage1: 'Ivysaur' },
  { type: 'Lightning', basic: 'Pikachu', stage1: 'Raichu' },
  { type: 'Fighting', basic: 'Machop', stage1: 'Machoke' },
  { type: 'Psychic', basic: 'Abra', stage1: 'Kadabra' },
  { type: 'Colorless', basic: 'Eevee' },
]

export const ENERGY_TYPES: ElementType[] = [
  'Fire',
  'Water',
  'Grass',
  'Lightning',
  'Fighting',
  'Psychic',
]

export const ALL_POKEMON_NAMES = ROSTER.flatMap((line) =>
  line.stage1 ? [line.basic, line.stage1] : [line.basic],
)
