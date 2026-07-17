import { describe, expect, it } from 'vitest'
import { isMyTurn } from './gameStore'
import type { GameState } from '../game/types'

function stateWith(overrides: Partial<GameState>): GameState {
  return {
    players: {} as GameState['players'],
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

describe('isMyTurn', () => {
  it('is true only during the main phase when it is my active side', () => {
    expect(isMyTurn(stateWith({ activeSide: 'p1', mySide: 'p1', phase: 'main' }))).toBe(true)
  })

  it('is false when it is the opponent\'s active side', () => {
    expect(isMyTurn(stateWith({ activeSide: 'p2', mySide: 'p1', phase: 'main' }))).toBe(false)
  })

  it('is false outside the main phase even if the side matches', () => {
    expect(isMyTurn(stateWith({ activeSide: 'p1', mySide: 'p1', phase: 'setup' }))).toBe(false)
    expect(isMyTurn(stateWith({ activeSide: 'p1', mySide: 'p1', phase: 'gameover' }))).toBe(false)
  })
})
