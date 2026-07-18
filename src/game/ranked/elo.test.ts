import { describe, expect, it } from 'vitest'
import { applyElo, BASE_ELO, expectedScore, kFactor } from './elo'

describe('elo', () => {
  it('gives 0.5 expected score for equal ratings', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5)
  })

  it('favours the higher-rated player', () => {
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.5)
    expect(expectedScore(1000, 1400)).toBeLessThan(0.5)
  })

  it('k-factor shrinks in higher divisions and stays above the floor', () => {
    expect(kFactor(0)).toBe(40)
    expect(kFactor(8)).toBeGreaterThanOrEqual(16)
    expect(kFactor(0)).toBeGreaterThan(kFactor(8))
  })

  it('increases elo on a win and decreases on a loss', () => {
    const win = applyElo(BASE_ELO, BASE_ELO, true)
    const loss = applyElo(BASE_ELO, BASE_ELO, false)
    expect(win.delta).toBeGreaterThan(0)
    expect(loss.delta).toBeLessThan(0)
    expect(win.elo).toBe(BASE_ELO + win.delta)
  })

  it('rewards beating a stronger opponent more than an equal one', () => {
    const vsStronger = applyElo(1000, 1400, true)
    const vsEqual = applyElo(1000, 1000, true)
    expect(vsStronger.delta).toBeGreaterThan(vsEqual.delta)
  })
})
