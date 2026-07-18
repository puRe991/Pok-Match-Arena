import { describe, expect, it, vi } from 'vitest'
import { applyAction, attackIsUsable, createInitialState } from './engine'
import { isDeckLegal, specialEnergyProvides } from './normalize'
import { cloneWithUid } from './deckBuilder'
import { FALLBACK_POOL } from '../api/fallbackCards'
import type { CardDef, EnergyCardDef, GameState, InPlayPokemon, PokemonCardDef } from './types'

const dce = FALLBACK_POOL.find((c) => c.id === 'offline-96')! as EnergyCardDef
const fireEnergy = FALLBACK_POOL.find((c) => c.id === 'offline-98')! as EnergyCardDef

function monWithAttack(cost: PokemonCardDef['attacks'][number]['cost'], energy: EnergyCardDef[]): InPlayPokemon {
  const card: PokemonCardDef = {
    kind: 'pokemon',
    id: 'test-mon',
    uid: 't1',
    name: 'Testmon',
    setId: 's',
    setName: 'S',
    number: '1',
    rarity: 'Common',
    imageSmall: '',
    imageLarge: '',
    pokemonType: 'Colorless',
    stage: 'basic',
    hp: 60,
    attacks: [{ name: 'Hit', cost, damage: 20, text: '' }],
    retreatCost: 0,
  }
  return {
    instanceId: 'm1',
    stages: [card],
    damage: 0,
    attachedEnergy: energy,
    enteredPlayTurn: 0,
    evolvedOnTurn: null,
    statuses: [],
  }
}

describe('Doppelte Farblos-Energie (Spezial-Energie)', () => {
  it('wird als Spezial-Energie erkannt und ist deck-legal', () => {
    expect(specialEnergyProvides(dce)).toEqual(['Colorless', 'Colorless'])
    expect(isDeckLegal(dce)).toBe(true)
    expect(specialEnergyProvides(fireEnergy)).toBeNull()
  })

  it('deckt zwei Farblos-Kosten mit einer Karte', () => {
    const mon = monWithAttack(['Colorless', 'Colorless'], [cloneWithUid(dce) as EnergyCardDef])
    expect(attackIsUsable(mon, 0, 1)).toBe(true)
  })

  it('kann keine typgebundenen Kosten bezahlen', () => {
    const mon = monWithAttack(['Fire'], [cloneWithUid(dce) as EnergyCardDef])
    expect(attackIsUsable(mon, 0, 1)).toBe(false)
  })

  it('deckt gemischte Kosten (1 Feuer + 1 Farblos) mit Feuer + DCE', () => {
    const mon = monWithAttack(['Fire', 'Colorless'], [
      cloneWithUid(fireEnergy) as EnergyCardDef,
      cloneWithUid(dce) as EnergyCardDef,
    ])
    expect(attackIsUsable(mon, 0, 1)).toBe(true)
  })
})

function stateFor(hand: CardDef[], overrides: Partial<GameState['players']['p1']> = {}): GameState {
  const basic = FALLBACK_POOL.find((c) => c.kind === 'pokemon' && (c as PokemonCardDef).stage === 'basic')! as PokemonCardDef
  const state = createInitialState('local', 'p1', [cloneWithUid(basic)], [cloneWithUid(basic)], { p2IsAI: true })
  state.phase = 'main'
  state.activeSide = 'p1'
  state.turnNumber = 2
  const p1 = state.players.p1
  p1.active = {
    instanceId: 'p1-active',
    stages: [basic],
    damage: 0,
    attachedEnergy: [],
    enteredPlayTurn: 0,
    evolvedOnTurn: null,
    statuses: [],
  }
  p1.hand = hand
  p1.deck = []
  p1.discard = []
  p1.bench = []
  Object.assign(p1, overrides)
  return state
}

const trainerCard = (name: string): CardDef =>
  cloneWithUid(FALLBACK_POOL.find((c) => c.kind === 'trainer' && c.name === name)!)

describe('neue Trainer-Karten', () => {
  it('Energiesuche holt eine Basis-Energie aus dem Deck auf die Hand', () => {
    const card = trainerCard('Energy Search')
    let state = stateFor([card])
    state.players.p1.deck = [cloneWithUid(fireEnergy)]
    state = applyAction(state, { type: 'PLAY_TRAINER', side: 'p1', handUid: card.uid })
    expect(state.players.p1.hand.some((c) => c.kind === 'energy')).toBe(true)
    expect(state.players.p1.deck.length).toBe(0)
  })

  it('Zocker mischt die Hand ins Deck und zieht bei Kopf 8 Karten', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // Kopf
    const card = trainerCard('Gambler')
    let state = stateFor([card])
    state.players.p1.deck = Array.from({ length: 10 }, () => cloneWithUid(fireEnergy))
    state = applyAction(state, { type: 'PLAY_TRAINER', side: 'p1', handUid: card.uid })
    expect(state.players.p1.hand.length).toBe(8)
    vi.restoreAllMocks()
  })

  it('Wiederbelebung legt ein Basis-Pokémon aus der Ablage mit halbem Schaden auf die Bank', () => {
    const card = trainerCard('Revive')
    const basic = FALLBACK_POOL.find((c) => c.kind === 'pokemon' && (c as PokemonCardDef).stage === 'basic')! as PokemonCardDef
    let state = stateFor([card])
    state.players.p1.discard = [cloneWithUid(basic)]
    state = applyAction(state, { type: 'PLAY_TRAINER', side: 'p1', handUid: card.uid })
    expect(state.players.p1.bench.length).toBe(1)
    const revived = state.players.p1.bench[0]
    expect(revived.damage).toBe(Math.floor(basic.hp / 2 / 10) * 10)
  })
})
