export type ElementType =
  | 'Fire'
  | 'Water'
  | 'Grass'
  | 'Lightning'
  | 'Fighting'
  | 'Psychic'
  | 'Colorless'

export type Stage = 'basic' | 'stage1' | 'stage2'

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Holo Rare'

export interface AttackDef {
  name: string
  cost: ElementType[]
  damage: number
  text: string
}

interface CardMeta {
  id: string
  uid: string
  name: string
  setId: string
  setName: string
  number: string
  rarity: Rarity
  imageSmall: string
  imageLarge: string
}

export interface PokemonCardDef extends CardMeta {
  kind: 'pokemon'
  pokemonType: ElementType
  stage: Stage
  evolvesFrom?: string
  hp: number
  attacks: AttackDef[]
  retreatCost: number
  weakness?: ElementType
}

export interface EnergyCardDef extends CardMeta {
  kind: 'energy'
  energyType: ElementType
  isBasicEnergy: boolean
}

export interface TrainerCardDef extends CardMeta {
  kind: 'trainer'
  text: string
}

export type CardDef = PokemonCardDef | EnergyCardDef | TrainerCardDef

export type StatusEffect = 'poisoned' | 'burned' | 'asleep' | 'paralyzed' | 'confused'

export interface InPlayPokemon {
  instanceId: string
  stages: PokemonCardDef[]
  damage: number
  attachedEnergy: EnergyCardDef[]
  enteredPlayTurn: number
  evolvedOnTurn: number | null
  statuses: StatusEffect[]
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
  prizes: CardDef[]
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
  | { type: 'status'; side: Side; status: StatusEffect }
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
