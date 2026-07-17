import type { GameState, InPlayPokemon, PlayerState, PokemonCardDef, Side } from '../game/types'

export function makePlayer(side: Side, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    side,
    name: side === 'p1' ? 'Du' : 'CPU',
    isAI: side === 'p2',
    deck: [],
    hand: [],
    active: null,
    bench: [],
    discard: [],
    prizes: [],
    hasAttachedEnergyThisTurn: false,
    hasRetreatedThisTurn: false,
    attackedThisTurn: false,
    ...overrides,
  }
}

export function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    players: { p1: makePlayer('p1'), p2: makePlayer('p2') },
    activeSide: 'p1',
    turnNumber: 1,
    phase: 'main',
    log: [],
    winner: null,
    winnerReason: null,
    mode: 'local',
    mySide: 'p1',
    lastEvent: null,
    setupReady: { p1: true, p2: true },
    ...overrides,
  }
}

export function makeInPlay(card: PokemonCardDef, overrides: Partial<InPlayPokemon> = {}): InPlayPokemon {
  return {
    instanceId: card.uid || `instance-${card.id}-${Math.random()}`,
    stages: [card],
    damage: 0,
    attachedEnergy: [],
    enteredPlayTurn: 0,
    evolvedOnTurn: null,
    statuses: [],
    ...overrides,
  }
}
