import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyAction,
  attackIsUsable,
  createInitialState,
  currentHp,
  isGameOver,
  needsPromote,
  topStage,
} from '../engine'
import { makeEnergy, makeLegalDeck, makePokemon, resetUidCounter } from '../../test/fixtures'
import { baseState, makeInPlay, makePlayer } from '../../test/gameState'

beforeEach(() => {
  resetUidCounter()
  vi.restoreAllMocks()
})

describe('createInitialState', () => {
  it('deals a 7-card hand, 6 prizes, and puts the remainder in the deck', () => {
    const p1Cards = makeLegalDeck()
    const p2Cards = makeLegalDeck()
    const state = createInitialState('local', 'p1', p1Cards, p2Cards)

    expect(state.players.p1.hand).toHaveLength(7)
    expect(state.players.p1.prizes).toHaveLength(6)
    expect(state.players.p1.deck).toHaveLength(60 - 7 - 6)
    expect(state.phase).toBe('setup')
    expect(state.turnNumber).toBe(0)
    expect(state.winner).toBeNull()
  })

  it('retries the shuffle until the opening hand contains a basic Pokémon', () => {
    // A deck that is *only* legal once reshuffled: energy first, basics after.
    const energies = Array.from({ length: 10 }, () => makeEnergy())
    const basics = Array.from({ length: 50 }, () => makePokemon())
    const deck = [...energies, ...basics]
    const state = createInitialState('local', 'p1', deck, makeLegalDeck())
    const hasBasic = state.players.p1.hand.some((c) => c.kind === 'pokemon' && c.stage === 'basic')
    expect(hasBasic).toBe(true)
  })

  it('does not mutate the input card arrays', () => {
    const p1Cards = makeLegalDeck()
    const originalLength = p1Cards.length
    createInitialState('local', 'p1', p1Cards, makeLegalDeck())
    expect(p1Cards).toHaveLength(originalLength)
  })
})

describe('attackIsUsable', () => {
  it('is true when attached energy covers the cost', () => {
    const card = makePokemon({ attacks: [{ name: 'A', cost: ['Fire', 'Colorless'], damage: 10, text: '' }] })
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy({ energyType: 'Fire' }), makeEnergy({ energyType: 'Water' })] })
    expect(attackIsUsable(mon, 0, 1)).toBe(true)
  })

  it('is false when a specific energy type is missing', () => {
    const card = makePokemon({ attacks: [{ name: 'A', cost: ['Water'], damage: 10, text: '' }] })
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy({ energyType: 'Fire' })] })
    expect(attackIsUsable(mon, 0, 1)).toBe(false)
  })

  it('is false when there is not enough colorless energy', () => {
    const card = makePokemon({ attacks: [{ name: 'A', cost: ['Colorless', 'Colorless'], damage: 10, text: '' }] })
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy({ energyType: 'Fire' })] })
    expect(attackIsUsable(mon, 0, 1)).toBe(false)
  })

  it('is false for a Pokémon that evolved this very turn', () => {
    const card = makePokemon({ attacks: [{ name: 'A', cost: ['Colorless'], damage: 10, text: '' }] })
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy()], evolvedOnTurn: 3 })
    expect(attackIsUsable(mon, 0, 3)).toBe(false)
    expect(attackIsUsable(mon, 0, 4)).toBe(true)
  })

  it('is false when asleep or paralyzed', () => {
    const card = makePokemon({ attacks: [{ name: 'A', cost: ['Colorless'], damage: 10, text: '' }] })
    const asleep = makeInPlay(card, { attachedEnergy: [makeEnergy()], statuses: ['asleep'] })
    const paralyzed = makeInPlay(card, { attachedEnergy: [makeEnergy()], statuses: ['paralyzed'] })
    expect(attackIsUsable(asleep, 0, 1)).toBe(false)
    expect(attackIsUsable(paralyzed, 0, 1)).toBe(false)
  })

  it('is false for a non-existent attack index', () => {
    const card = makePokemon({ attacks: [{ name: 'A', cost: ['Colorless'], damage: 10, text: '' }] })
    const mon = makeInPlay(card, { attachedEnergy: [makeEnergy()] })
    expect(attackIsUsable(mon, 5, 1)).toBe(false)
  })
})

describe('currentHp / topStage', () => {
  it('subtracts damage from HP and floors at 0', () => {
    const card = makePokemon({ hp: 60 })
    const mon = makeInPlay(card, { damage: 90 })
    expect(currentHp(mon)).toBe(0)
    mon.damage = 20
    expect(currentHp(mon)).toBe(40)
  })

  it('returns the most recently evolved stage', () => {
    const basic = makePokemon({ name: 'Basic' })
    const evo = makePokemon({ name: 'Evo' })
    const mon = makeInPlay(basic, { stages: [basic, evo] })
    expect(topStage(mon).name).toBe('Evo')
  })
})

describe('applyAction: setup phase', () => {
  it('SETUP_PLACE_ACTIVE moves a basic Pokémon from hand to active', () => {
    const basic = makePokemon({ stage: 'basic' })
    const state = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: {
        p1: makePlayer('p1', { hand: [basic] }),
        p2: makePlayer('p2'),
      },
    })
    const next = applyAction(state, { type: 'SETUP_PLACE_ACTIVE', side: 'p1', handUid: basic.uid })
    expect(next.players.p1.active?.stages[0].name).toBe(basic.name)
    expect(next.players.p1.hand).toHaveLength(0)
  })

  it('SETUP_PLACE_ACTIVE rejects non-basic Pokémon', () => {
    const evo = makePokemon({ stage: 'stage1' })
    const state = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: { p1: makePlayer('p1', { hand: [evo] }), p2: makePlayer('p2') },
    })
    const next = applyAction(state, { type: 'SETUP_PLACE_ACTIVE', side: 'p1', handUid: evo.uid })
    expect(next.players.p1.active).toBeNull()
    expect(next.players.p1.hand).toHaveLength(1)
  })

  it('SETUP_PLACE_ACTIVE is a no-op once an active Pokémon exists', () => {
    const first = makePokemon({ stage: 'basic', name: 'First' })
    const second = makePokemon({ stage: 'basic', name: 'Second' })
    const state = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: {
        p1: makePlayer('p1', { active: makeInPlay(first), hand: [second] }),
        p2: makePlayer('p2'),
      },
    })
    const next = applyAction(state, { type: 'SETUP_PLACE_ACTIVE', side: 'p1', handUid: second.uid })
    expect(next.players.p1.active?.stages[0].name).toBe('First')
    expect(next.players.p1.hand).toHaveLength(1)
  })

  it('SETUP_PLACE_BENCH enforces the 5-slot bench limit', () => {
    const active = makePokemon({ stage: 'basic' })
    const benched = Array.from({ length: 5 }, () => makeInPlay(makePokemon({ stage: 'basic' })))
    const extra = makePokemon({ stage: 'basic', name: 'Overflow' })
    const state = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: {
        p1: makePlayer('p1', { active: makeInPlay(active), bench: benched, hand: [extra] }),
        p2: makePlayer('p2'),
      },
    })
    const next = applyAction(state, { type: 'SETUP_PLACE_BENCH', side: 'p1', handUid: extra.uid })
    expect(next.players.p1.bench).toHaveLength(5)
    expect(next.players.p1.hand).toHaveLength(1)
  })

  it('SETUP_READY requires an active Pokémon and starts the game once both players are ready', () => {
    const basic = makePokemon({ stage: 'basic' })
    const stateNoActive = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: false },
      players: { p1: makePlayer('p1'), p2: makePlayer('p2') },
    })
    const rejected = applyAction(stateNoActive, { type: 'SETUP_READY', side: 'p1' })
    expect(rejected.setupReady.p1).toBe(false)

    const stateReady = baseState({
      phase: 'setup',
      setupReady: { p1: false, p2: true },
      players: {
        p1: makePlayer('p1', { active: makeInPlay(basic) }),
        p2: makePlayer('p2', { active: makeInPlay(basic) }),
      },
    })
    const started = applyAction(stateReady, { type: 'SETUP_READY', side: 'p1' })
    expect(started.phase).toBe('main')
    expect(started.turnNumber).toBe(1)
    expect(started.activeSide).toBe('p1')
  })
})

describe('applyAction: main phase mechanics', () => {
  it('PLAY_BENCH rejects actions outside the acting side turn', () => {
    const basic = makePokemon({ stage: 'basic' })
    const state = baseState({
      activeSide: 'p1',
      players: { p1: makePlayer('p1'), p2: makePlayer('p2', { hand: [basic] }) },
    })
    const next = applyAction(state, { type: 'PLAY_BENCH', side: 'p2', handUid: basic.uid })
    expect(next.players.p2.bench).toHaveLength(0)
  })

  it('EVOLVE fails when the evolution does not match the target species', () => {
    const basicMon = makePokemon({ name: 'Basicmon', stage: 'basic' })
    const wrongEvo = makePokemon({ name: 'WrongEvo', stage: 'stage1', evolvesFrom: 'SomeoneElse' })
    const state = baseState({
      turnNumber: 3,
      players: {
        p1: makePlayer('p1', { active: makeInPlay(basicMon, { enteredPlayTurn: 1 }), hand: [wrongEvo] }),
        p2: makePlayer('p2'),
      },
    })
    const next = applyAction(state, {
      type: 'EVOLVE',
      side: 'p1',
      handUid: wrongEvo.uid,
      targetInstanceId: state.players.p1.active!.instanceId,
    })
    expect(next.players.p1.active?.stages).toHaveLength(1)
  })

  it('EVOLVE fails when the target entered play this same turn', () => {
    const basicMon = makePokemon({ name: 'Basicmon', stage: 'basic' })
    const evo = makePokemon({ name: 'Evo', stage: 'stage1', evolvesFrom: 'Basicmon' })
    const state = baseState({
      turnNumber: 3,
      players: {
        p1: makePlayer('p1', { active: makeInPlay(basicMon, { enteredPlayTurn: 3 }), hand: [evo] }),
        p2: makePlayer('p2'),
      },
    })
    const next = applyAction(state, {
      type: 'EVOLVE',
      side: 'p1',
      handUid: evo.uid,
      targetInstanceId: state.players.p1.active!.instanceId,
    })
    expect(next.players.p1.active?.stages).toHaveLength(1)
  })

  it('EVOLVE succeeds and marks evolvedOnTurn', () => {
    const basicMon = makePokemon({ name: 'Basicmon', stage: 'basic' })
    const evo = makePokemon({ name: 'Evo', stage: 'stage1', evolvesFrom: 'Basicmon' })
    const state = baseState({
      turnNumber: 3,
      players: {
        p1: makePlayer('p1', { active: makeInPlay(basicMon, { enteredPlayTurn: 1 }), hand: [evo] }),
        p2: makePlayer('p2'),
      },
    })
    const next = applyAction(state, {
      type: 'EVOLVE',
      side: 'p1',
      handUid: evo.uid,
      targetInstanceId: state.players.p1.active!.instanceId,
    })
    expect(topStage(next.players.p1.active!).name).toBe('Evo')
    expect(next.players.p1.active?.evolvedOnTurn).toBe(3)
    expect(next.players.p1.hand).toHaveLength(0)
  })

  it('ATTACH_ENERGY only allows one attachment per turn', () => {
    const basicMon = makePokemon({ stage: 'basic' })
    const energyA = makeEnergy({ name: 'A' })
    const energyB = makeEnergy({ name: 'B' })
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(basicMon), hand: [energyA, energyB] }),
        p2: makePlayer('p2'),
      },
    })
    const once = applyAction(state, {
      type: 'ATTACH_ENERGY',
      side: 'p1',
      handUid: energyA.uid,
      targetInstanceId: state.players.p1.active!.instanceId,
    })
    expect(once.players.p1.active?.attachedEnergy).toHaveLength(1)
    expect(once.players.p1.hasAttachedEnergyThisTurn).toBe(true)

    const twice = applyAction(once, {
      type: 'ATTACH_ENERGY',
      side: 'p1',
      handUid: energyB.uid,
      targetInstanceId: once.players.p1.active!.instanceId,
    })
    expect(twice.players.p1.active?.attachedEnergy).toHaveLength(1)
    expect(twice.players.p1.hand).toHaveLength(1)
  })

  it('RETREAT pays the retreat cost, swaps active/bench, and clears statuses', () => {
    const activeMon = makePokemon({ retreatCost: 2 })
    const benchMon = makePokemon({ name: 'Bench' })
    const active = makeInPlay(activeMon, {
      attachedEnergy: [makeEnergy(), makeEnergy(), makeEnergy()],
      statuses: ['confused'],
    })
    const bench = makeInPlay(benchMon)
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active, bench: [bench] }),
        p2: makePlayer('p2'),
      },
    })
    const next = applyAction(state, { type: 'RETREAT', side: 'p1', benchInstanceId: bench.instanceId })
    expect(next.players.p1.active?.instanceId).toBe(bench.instanceId)
    expect(next.players.p1.bench).toHaveLength(1)
    expect(next.players.p1.bench[0].instanceId).toBe(active.instanceId)
    expect(next.players.p1.bench[0].attachedEnergy).toHaveLength(1)
    expect(next.players.p1.bench[0].statuses).toEqual([])
    expect(next.players.p1.hasRetreatedThisTurn).toBe(true)
  })

  it('RETREAT fails without enough energy to pay the cost', () => {
    const activeMon = makePokemon({ retreatCost: 3 })
    const active = makeInPlay(activeMon, { attachedEnergy: [makeEnergy()] })
    const bench = makeInPlay(makePokemon({ name: 'Bench' }))
    const state = baseState({
      players: { p1: makePlayer('p1', { active, bench: [bench] }), p2: makePlayer('p2') },
    })
    const next = applyAction(state, { type: 'RETREAT', side: 'p1', benchInstanceId: bench.instanceId })
    expect(next.players.p1.active?.instanceId).toBe(active.instanceId)
  })

  it('RETREAT is blocked while asleep or paralyzed', () => {
    const active = makeInPlay(makePokemon({ retreatCost: 0 }), { statuses: ['asleep'] })
    const bench = makeInPlay(makePokemon({ name: 'Bench' }))
    const state = baseState({
      players: { p1: makePlayer('p1', { active, bench: [bench] }), p2: makePlayer('p2') },
    })
    const next = applyAction(state, { type: 'RETREAT', side: 'p1', benchInstanceId: bench.instanceId })
    expect(next.players.p1.active?.instanceId).toBe(active.instanceId)
  })
})

describe('applyAction: ATTACK', () => {
  it('deals damage, doubles it on a weakness hit, and appends a log entry', () => {
    const attackerCard = makePokemon({
      pokemonType: 'Fire',
      attacks: [{ name: 'Ember', cost: ['Fire'], damage: 20, text: '' }],
    })
    const defenderCard = makePokemon({ hp: 100, weakness: 'Fire' })
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(attackerCard, { attachedEnergy: [makeEnergy()] }) }),
        p2: makePlayer('p2', { active: makeInPlay(defenderCard) }),
      },
    })
    const next = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next.players.p2.active?.damage).toBe(40)
    expect(next.lastEvent).toEqual({ type: 'attack', side: 'p1', damage: 40, superEffective: true })
  })

  it('does not resolve when the attack cannot be paid for', () => {
    const attackerCard = makePokemon({ attacks: [{ name: 'Big', cost: ['Fire', 'Fire'], damage: 50, text: '' }] })
    const defenderCard = makePokemon({ hp: 100 })
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(attackerCard) }),
        p2: makePlayer('p2', { active: makeInPlay(defenderCard) }),
      },
    })
    const next = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next.players.p2.active?.damage).toBe(0)
    expect(next.activeSide).toBe('p1')
  })

  it('knocks out the defender, awards a prize, and ends the turn', () => {
    const attackerCard = makePokemon({ attacks: [{ name: 'Ember', cost: [], damage: 50, text: '' }] })
    const defenderCard = makePokemon({ hp: 30 })
    const prizeCard = makePokemon({ name: 'Prize' })
    const extraPrize = makePokemon({ name: 'ExtraPrize' })
    const nextDeckCard = makePokemon({ name: 'DeckTop' })
    const state = baseState({
      turnNumber: 1,
      players: {
        p1: makePlayer('p1', { active: makeInPlay(attackerCard), prizes: [prizeCard, extraPrize] }),
        p2: makePlayer('p2', {
          active: makeInPlay(defenderCard),
          bench: [makeInPlay(makePokemon({ name: 'Backup' }))],
          deck: [nextDeckCard],
        }),
      },
    })
    const next = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next.players.p2.active).toBeNull()
    expect(next.players.p2.discard).toHaveLength(1)
    expect(next.players.p1.prizes).toHaveLength(1)
    expect(next.players.p1.hand).toContainEqual(prizeCard)
    // Turn ended -> it's now p2's turn (draw phase already resolved for them).
    expect(next.activeSide).toBe('p2')
  })

  it('declares a winner when the last prize is taken', () => {
    const attackerCard = makePokemon({ attacks: [{ name: 'Ember', cost: [], damage: 999, text: '' }] })
    const defenderCard = makePokemon({ hp: 30 })
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(attackerCard), prizes: [] }),
        p2: makePlayer('p2', { active: makeInPlay(defenderCard) }),
      },
    })
    const next = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next.winner).toBe('p1')
    expect(next.phase).toBe('gameover')
  })

  it('declares a winner when the defender has no bench Pokémon left to promote', () => {
    const attackerCard = makePokemon({ attacks: [{ name: 'Ember', cost: [], damage: 999, text: '' }] })
    const defenderCard = makePokemon({ hp: 30 })
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(attackerCard), prizes: [makePokemon(), makePokemon()] }),
        p2: makePlayer('p2', { active: makeInPlay(defenderCard), prizes: [makePokemon()], bench: [] }),
      },
    })
    const next = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next.winner).toBe('p1')
    expect(next.winnerReason).toContain('keine Pokémon mehr')
  })

  it('applies a status effect described in the attack text (paralysis)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // avoid the "flip a coin" miss branch
    const attackerCard = makePokemon({
      attacks: [{ name: 'Shock', cost: [], damage: 10, text: 'The Defending Pokémon is now Paralyzed.' }],
    })
    const defenderCard = makePokemon({ hp: 100 })
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(attackerCard) }),
        p2: makePlayer('p2', { active: makeInPlay(defenderCard) }),
      },
    })
    const next = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next.players.p2.active?.statuses).toContain('paralyzed')
  })

  it('a confused attacker can hit itself for 30 instead of attacking', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // "tails" -> hits self (heads = false)
    const attackerCard = makePokemon({ hp: 100, attacks: [{ name: 'Ember', cost: [], damage: 20, text: '' }] })
    const defenderCard = makePokemon({ hp: 100 })
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(attackerCard, { statuses: ['confused'] }) }),
        p2: makePlayer('p2', { active: makeInPlay(defenderCard) }),
      },
    })
    const next = applyAction(state, { type: 'ATTACK', side: 'p1', attackIndex: 0 })
    expect(next.players.p1.active?.damage).toBe(30)
    expect(next.players.p2.active?.damage).toBe(0)
  })
})

describe('applyAction: PROMOTE and END_TURN', () => {
  it('PROMOTE moves a benched Pokémon into the active slot', () => {
    const bench = makeInPlay(makePokemon({ name: 'Bench' }))
    const state = baseState({
      players: { p1: makePlayer('p1', { active: null, bench: [bench] }), p2: makePlayer('p2') },
    })
    const next = applyAction(state, { type: 'PROMOTE', side: 'p1', benchInstanceId: bench.instanceId })
    expect(next.players.p1.active?.instanceId).toBe(bench.instanceId)
    expect(next.players.p1.bench).toHaveLength(0)
  })

  it('needsPromote is true only when active is null and the game is not over', () => {
    const state = baseState({ players: { p1: makePlayer('p1', { active: null }), p2: makePlayer('p2') } })
    expect(needsPromote(state, 'p1')).toBe(true)
    state.phase = 'gameover'
    expect(needsPromote(state, 'p1')).toBe(false)
  })

  it('END_TURN draws a card for the next player and clears per-turn flags', () => {
    const drawCard = makePokemon({ name: 'Drawn' })
    const state = baseState({
      turnNumber: 1,
      activeSide: 'p1',
      players: {
        p1: makePlayer('p1', {
          active: makeInPlay(makePokemon()),
          hasAttachedEnergyThisTurn: true,
        }),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon()), deck: [drawCard] }),
      },
    })
    const next = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(next.activeSide).toBe('p2')
    expect(next.turnNumber).toBe(2)
    expect(next.players.p2.hand).toContainEqual(drawCard)
    expect(next.players.p2.hasAttachedEnergyThisTurn).toBe(false)
  })

  it('a player who cannot draw from an empty deck loses', () => {
    const state = baseState({
      turnNumber: 1,
      activeSide: 'p1',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon()), deck: [] }),
      },
    })
    const next = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(next.winner).toBe('p1')
    expect(next.phase).toBe('gameover')
  })

  it('END_TURN removes paralysis from the ending side only', () => {
    const state = baseState({
      turnNumber: 1,
      activeSide: 'p1',
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon(), { statuses: ['paralyzed'] }) }),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon(), { statuses: ['paralyzed'] }), deck: [makePokemon()] }),
      },
    })
    const next = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(next.players.p1.active?.statuses).not.toContain('paralyzed')
    expect(next.players.p2.active?.statuses).toContain('paralyzed')
  })
})

describe('status damage ticking (poison/burn) via END_TURN', () => {
  it('applies 10 poison damage and can knock out an active Pokémon', () => {
    const mon = makeInPlay(makePokemon({ hp: 60 }), { damage: 55, statuses: ['poisoned'] })
    const state = baseState({
      turnNumber: 1,
      activeSide: 'p1',
      players: {
        p1: makePlayer('p1', { active: mon }),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon()), deck: [makePokemon()] }),
      },
    })
    const next = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(next.players.p1.active).toBeNull()
    expect(next.players.p1.discard.length).toBeGreaterThan(0)
  })

  it('applies 20 burn damage and has a 50% chance to cure itself', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // cures burn
    const mon = makeInPlay(makePokemon({ hp: 100 }), { damage: 0, statuses: ['burned'] })
    const state = baseState({
      turnNumber: 1,
      activeSide: 'p1',
      players: {
        p1: makePlayer('p1', { active: mon }),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon()), deck: [makePokemon()] }),
      },
    })
    const next = applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(next.players.p1.active?.damage).toBe(20)
    expect(next.players.p1.active?.statuses).not.toContain('burned')
  })
})

describe('isGameOver', () => {
  it('reflects the gameover phase', () => {
    const state = baseState({ phase: 'main' })
    expect(isGameOver(state)).toBe(false)
    state.phase = 'gameover'
    expect(isGameOver(state)).toBe(true)
  })
})

describe('applyAction is pure with respect to its input', () => {
  it('does not mutate the previous state object', () => {
    const state = baseState({
      players: {
        p1: makePlayer('p1', { active: makeInPlay(makePokemon()) }),
        p2: makePlayer('p2', { active: makeInPlay(makePokemon()), deck: [makePokemon()] }),
      },
    })
    const snapshot = JSON.parse(JSON.stringify(state))
    applyAction(state, { type: 'END_TURN', side: 'p1' })
    expect(state).toEqual(snapshot)
  })
})
