import { describe, expect, it } from 'vitest'
import { applyAction, createInitialState } from './engine'
import { getPokemonPower, powerIsUsable, rainDanceTargets, usablePowerSources } from './powers'
import { cloneWithUid } from './deckBuilder'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { EnergyCardDef, GameState, InPlayPokemon, PokemonCardDef } from './types'

const blastoise = FALLBACK_POOL.find((c) => c.id === 'offline-2')! as PokemonCardDef
const squirtle = FALLBACK_POOL.find((c) => c.id === 'offline-63')! as PokemonCardDef
const charmander = FALLBACK_POOL.find((c) => c.id === 'offline-46')! as PokemonCardDef
const waterEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-102')! as EnergyCardDef
const fireEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-98')! as EnergyCardDef

function inst(card: PokemonCardDef, instanceId: string): InPlayPokemon {
  return {
    instanceId,
    stages: [card],
    damage: 0,
    attachedEnergy: [],
    enteredPlayTurn: 0,
    evolvedOnTurn: null,
    statuses: [],
  }
}

function state(): GameState {
  const s = createInitialState('local', 'p1', [cloneWithUid(squirtle)], [cloneWithUid(squirtle)], { p2IsAI: true })
  s.phase = 'main'
  s.activeSide = 'p1'
  s.turnNumber = 2
  const p1 = s.players.p1
  p1.active = inst(blastoise, 'p1-active')
  p1.bench = [inst(squirtle, 'p1-bench')]
  p1.hand = []
  p1.deck = []
  p1.discard = []
  return s
}

describe('getPokemonPower', () => {
  it('erkennt Blastoise „Rain Dance" als Regentanz', () => {
    expect(getPokemonPower(blastoise)?.id).toBe('rainDance')
    expect(getPokemonPower(squirtle)).toBeNull()
  })
})

describe('powerIsUsable / rainDanceTargets', () => {
  it('ist nur nutzbar mit Basis-Wasser-Energie auf der Hand', () => {
    const s = state()
    expect(powerIsUsable(s, 'p1', 'p1-active')).toBe(false)
    s.players.p1.hand = [cloneWithUid(waterEnergy)]
    expect(powerIsUsable(s, 'p1', 'p1-active')).toBe(true)
    // Feuer-Energie zählt nicht.
    s.players.p1.hand = [cloneWithUid(fireEnergy)]
    expect(powerIsUsable(s, 'p1', 'p1-active')).toBe(false)
  })

  it('listet nur Wasser-Pokémon als Ziele', () => {
    const s = state()
    s.players.p1.bench = [inst(charmander, 'p1-fire')]
    const ids = rainDanceTargets(s, 'p1').map((m) => m.instanceId)
    expect(ids).toContain('p1-active')
    expect(ids).not.toContain('p1-fire')
  })

  it('ist bei Paralyse des Trägers blockiert', () => {
    const s = state()
    s.players.p1.hand = [cloneWithUid(waterEnergy)]
    s.players.p1.active!.statuses = ['paralyzed']
    expect(powerIsUsable(s, 'p1', 'p1-active')).toBe(false)
  })
})

describe('USE_POWER (Regentanz)', () => {
  it('hängt Wasser-Energie an und ist unabhängig von der 1-Energie-Regel', () => {
    let s = state()
    s.players.p1.hand = [cloneWithUid(waterEnergy), cloneWithUid(waterEnergy)]
    s.players.p1.hasAttachedEnergyThisTurn = true // normale Energie schon gelegt
    s = applyAction(s, { type: 'USE_POWER', side: 'p1', sourceInstanceId: 'p1-active', targetInstanceId: 'p1-active' })
    expect(s.players.p1.active!.attachedEnergy).toHaveLength(1)
    // wiederholbar: zweite Energie an das Bank-Squirtle
    s = applyAction(s, { type: 'USE_POWER', side: 'p1', sourceInstanceId: 'p1-active', targetInstanceId: 'p1-bench' })
    expect(s.players.p1.bench[0].attachedEnergy).toHaveLength(1)
    expect(s.players.p1.hand).toHaveLength(0)
  })

  it('verweigert Nicht-Wasser-Ziele', () => {
    let s = state()
    s.players.p1.bench = [inst(charmander, 'p1-fire')]
    s.players.p1.hand = [cloneWithUid(waterEnergy)]
    s = applyAction(s, { type: 'USE_POWER', side: 'p1', sourceInstanceId: 'p1-active', targetInstanceId: 'p1-fire' })
    expect(s.players.p1.bench[0].attachedEnergy).toHaveLength(0)
    expect(s.players.p1.hand).toHaveLength(1)
  })
})

describe('usablePowerSources', () => {
  it('liefert Blastoise, wenn nutzbar', () => {
    const s = state()
    s.players.p1.hand = [cloneWithUid(waterEnergy)]
    expect(usablePowerSources(s, 'p1').map((m) => m.instanceId)).toEqual(['p1-active'])
  })
})
