import { describe, expect, it } from 'vitest'
import {
  DAILY_FREE_PACKS,
  consumeFreePack,
  dayKey,
  formatTimeUntilReset,
  msUntilReset,
  nextResetAt,
  remainingFreePacks,
} from './dailyPacks'

const noon = new Date(2026, 6, 17, 12, 0, 0)

describe('dailyPacks', () => {
  it('grants two free packs per day', () => {
    expect(DAILY_FREE_PACKS).toBe(2)
  })

  it('dayKey formats the local calendar day as YYYY-MM-DD', () => {
    expect(dayKey(noon)).toBe('2026-07-17')
    expect(dayKey(new Date(2026, 0, 3, 0, 0, 1))).toBe('2026-01-03')
  })

  it('remainingFreePacks returns the full allowance without prior state', () => {
    expect(remainingFreePacks(null, noon)).toBe(DAILY_FREE_PACKS)
    expect(remainingFreePacks(undefined, noon)).toBe(DAILY_FREE_PACKS)
  })

  it('remainingFreePacks subtracts packs opened today', () => {
    expect(remainingFreePacks({ day: '2026-07-17', opened: 1 }, noon)).toBe(1)
    expect(remainingFreePacks({ day: '2026-07-17', opened: 2 }, noon)).toBe(0)
    expect(remainingFreePacks({ day: '2026-07-17', opened: 99 }, noon)).toBe(0)
  })

  it('remainingFreePacks resets on a new calendar day', () => {
    expect(remainingFreePacks({ day: '2026-07-16', opened: 2 }, noon)).toBe(DAILY_FREE_PACKS)
  })

  it('consumeFreePack counts up within the same day and restarts on a new day', () => {
    const first = consumeFreePack(null, noon)
    expect(first).toEqual({ day: '2026-07-17', opened: 1 })
    const second = consumeFreePack(first, noon)
    expect(second).toEqual({ day: '2026-07-17', opened: 2 })

    const nextDay = new Date(2026, 6, 18, 0, 0, 1)
    expect(consumeFreePack(second, nextDay)).toEqual({ day: '2026-07-18', opened: 1 })
  })

  it('nextResetAt is local midnight of the following day', () => {
    expect(nextResetAt(noon).getTime()).toBe(new Date(2026, 6, 18, 0, 0, 0, 0).getTime())
    const lateNight = new Date(2026, 6, 17, 23, 59, 59)
    expect(nextResetAt(lateNight).getTime()).toBe(new Date(2026, 6, 18, 0, 0, 0, 0).getTime())
  })

  it('msUntilReset and formatTimeUntilReset count down to midnight', () => {
    expect(msUntilReset(noon)).toBe(12 * 60 * 60 * 1000)
    expect(formatTimeUntilReset(noon)).toBe('12:00:00')
    expect(formatTimeUntilReset(new Date(2026, 6, 17, 23, 58, 30))).toBe('00:01:30')
  })
})
