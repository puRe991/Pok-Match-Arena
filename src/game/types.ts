export type ElementType =
  | 'Fire'
  | 'Water'
  | 'Grass'
  | 'Lightning'
  | 'Fighting'
  | 'Psychic'
  | 'Colorless'

export type Stage = 'basic' | 'stage1'

export interface AttackDef {
  name: string
  cost: ElementType[]
  damage: number
  text: string
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

export type CardDef = PokemonCardDef | EnergyCardDef

export interface InPlayPokemon {
  instanceId: string
  stages: PokemonCardDef[]
  damage: number
  attachedEnergy: EnergyCardDef[]
  enteredPlayTurn: number
  evolvedOnTurn: number | null
}

export type Side = 'p1' | 'p2'

export interface PlayerState {
  side: Side
  name: string
  isAI: boolean
  deck: CardDef[]
  hand: CardDef[]
  active: InPlayPokemon | null
  bench: InPlayPokemon[]
  discard: CardDef[]
  hasAttachedEnergyThisTurn: boolean
  hasRetreatedThisTurn: boolean
  attackedThisTurn: boolean
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
  | { type: 'RETREAT'; side: Side; benchInstanceId: string }
  | { type: 'ATTACK'; side: Side; attackIndex: number }
  | { type: 'PROMOTE'; side: Side; benchInstanceId: string }
  | { type: 'END_TURN'; side: Side }
