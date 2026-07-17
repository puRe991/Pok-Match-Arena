import type { EffectSpec } from './effects'

export type ElementType =
  | 'Fire'
  | 'Water'
  | 'Grass'
  | 'Lightning'
  | 'Fighting'
  | 'Psychic'
  | 'Darkness'
  | 'Metal'
  | 'Fairy'
  | 'Dragon'
  | 'Colorless'

export type Stage = 'basic' | 'stage1' | 'stage2'

export interface AttackDef {
  name: string
  cost: ElementType[]
  damage: number
  text: string
  effects: EffectSpec[]
}

export interface PokemonCardDef {
  kind: 'pokemon'
  id: string
  uid: string
  name: string
  pokemonType: ElementType
  stage: Stage
  evolvesFrom?: string
  hp: number
  attacks: AttackDef[]
  retreatCost: number
  weakness?: ElementType
  resistance?: ElementType
  imageSmall: string
  imageLarge: string
}

export interface EnergyCardDef {
  kind: 'energy'
  id: string
  uid: string
  name: string
  energyType: ElementType
  imageSmall: string
  imageLarge: string
}

export type TrainerType = 'item' | 'supporter'

export interface TrainerCardDef {
  kind: 'trainer'
  id: string
  uid: string
  name: string
  trainerType: TrainerType
  text: string
  effects: EffectSpec[]
  imageSmall: string
  imageLarge: string
}

export type CardDef = PokemonCardDef | EnergyCardDef | TrainerCardDef

export type SpecialCondition = 'asleep' | 'paralyzed' | 'confused'

export interface StatusConditions {
  poisoned: boolean
  burned: boolean
  special: SpecialCondition | null
}

export function emptyStatus(): StatusConditions {
  return { poisoned: false, burned: false, special: null }
}

export interface InPlayPokemon {
  instanceId: string
  stages: PokemonCardDef[]
  damage: number
  attachedEnergy: EnergyCardDef[]
  enteredPlayTurn: number
  evolvedOnTurn: number | null
  status: StatusConditions
}

export type Side = 'p1' | 'p2'

export interface PlayerState {
  side: Side
  name: string
  isAI: boolean
  deck: CardDef[]
  hand: CardDef[]
  prizes: CardDef[]
  active: InPlayPokemon | null
  bench: InPlayPokemon[]
  discard: CardDef[]
  hasAttachedEnergyThisTurn: boolean
  hasRetreatedThisTurn: boolean
  supporterPlayedThisTurn: boolean
  attackedThisTurn: boolean
  mulligans: number
}

export type Phase = 'setup' | 'main' | 'gameover'

export interface LogEntry {
  id: string
  turn: number
  side: Side | 'system'
  text: string
}

export interface GameState {
  players: Record<Side, PlayerState>
  activeSide: Side
  turnNumber: number
  phase: Phase
  log: LogEntry[]
  winner: Side | null
  winnerReason: string | null
  mode: 'local' | 'host' | 'guest'
  mySide: Side
  lastEvent: GameEvent | null
  setupReady: Record<Side, boolean>
}

export type GameEvent =
  | { type: 'attack'; side: Side; damage: number; superEffective: boolean }
  | { type: 'knockout'; side: Side }
  | { type: 'draw'; side: Side }
  | { type: 'none' }

export type GameAction =
  | { type: 'SETUP_PLACE_ACTIVE'; side: Side; handUid: string }
  | { type: 'SETUP_PLACE_BENCH'; side: Side; handUid: string }
  | { type: 'SETUP_READY'; side: Side }
  | { type: 'PLAY_BENCH'; side: Side; handUid: string }
  | { type: 'EVOLVE'; side: Side; handUid: string; targetInstanceId: string }
  | { type: 'ATTACH_ENERGY'; side: Side; handUid: string; targetInstanceId: string }
  | { type: 'PLAY_TRAINER'; side: Side; handUid: string; targetInstanceId?: string }
  | { type: 'RETREAT'; side: Side; benchInstanceId: string }
  | { type: 'ATTACK'; side: Side; attackIndex: number }
  | { type: 'PROMOTE'; side: Side; benchInstanceId: string }
  | { type: 'END_TURN'; side: Side }
