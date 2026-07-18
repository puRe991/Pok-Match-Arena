import { beforeEach, describe, expect, it } from 'vitest'
import { useProgressStore } from './progressStore'
import { dailyQuestsFor } from '../game/progress/quests'
import { dayKey } from '../game/dailyPacks'

function reset() {
  useProgressStore.setState({
    coins: 100,
    stats: { matchesPlayed: 0, matchesWon: 0, packsOpened: 0, cardsCollected: 0 },
    claimedAchievements: [],
    daily: null,
  })
}

describe('progressStore', () => {
  beforeEach(reset)

  it('belohnt Siege und Niederlagen mit Münzen und zählt Statistiken', () => {
    useProgressStore.getState().recordMatch(true)
    expect(useProgressStore.getState().stats.matchesWon).toBe(1)
    // 100 Start + 25 Sieg + 50 Erfolg "Erster Sieg"
    expect(useProgressStore.getState().coins).toBe(175)
    useProgressStore.getState().recordMatch(false)
    expect(useProgressStore.getState().stats.matchesPlayed).toBe(2)
    expect(useProgressStore.getState().coins).toBe(185)
  })

  it('zahlt jeden Erfolg nur einmal aus', () => {
    const store = useProgressStore.getState()
    store.recordMatch(true) // schaltet firstWin frei
    const after = useProgressStore.getState().coins
    useProgressStore.getState().recordMatch(true)
    // zweiter Sieg: nur +25, keine erneute Erfolgs-Auszahlung
    expect(useProgressStore.getState().coins).toBe(after + 25)
    expect(useProgressStore.getState().claimedAchievements).toContain('firstWin')
  })

  it('spendCoins schlägt bei zu wenig Guthaben fehl', () => {
    expect(useProgressStore.getState().spendCoins(50)).toBe(true)
    expect(useProgressStore.getState().coins).toBe(50)
    expect(useProgressStore.getState().spendCoins(999)).toBe(false)
    expect(useProgressStore.getState().coins).toBe(50)
  })

  it('claimQuest zahlt eine abgeschlossene Tagesquest genau einmal aus', () => {
    const today = dayKey()
    const quests = dailyQuestsFor(today)
    const playQuest = quests.find((q) => q.metric === 'matchesPlayed')!
    // Genug Duelle spielen, um die Play-Quest zu erfüllen.
    for (let i = 0; i < playQuest.target; i++) useProgressStore.getState().recordMatch(false)
    const before = useProgressStore.getState().coins
    expect(useProgressStore.getState().claimQuest(playQuest.id)).toBe(true)
    expect(useProgressStore.getState().coins).toBe(before + playQuest.reward)
    // erneutes Einlösen schlägt fehl
    expect(useProgressStore.getState().claimQuest(playQuest.id)).toBe(false)
  })

  it('recordPackOpened zählt Packs und gesammelte Karten', () => {
    useProgressStore.getState().recordPackOpened(11)
    expect(useProgressStore.getState().stats.packsOpened).toBe(1)
    expect(useProgressStore.getState().stats.cardsCollected).toBe(11)
  })
})

describe('dailyQuestsFor', () => {
  it('ist für denselben Tag deterministisch und liefert verschiedene Quests', () => {
    const a = dailyQuestsFor('2026-07-18')
    const b = dailyQuestsFor('2026-07-18')
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
    expect(new Set(a.map((q) => q.id)).size).toBe(a.length)
  })
})
