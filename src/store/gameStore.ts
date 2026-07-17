import { create } from 'zustand'
import { loadPackSets } from '../api/sets'
import { decideAiSetupAction, decideNextAiAction } from '../game/ai'
import { buildRandomLegalDeck } from '../game/deckBuilder'
import { applyAction, createInitialState } from '../game/engine'
import { loadSetPool } from '../game/packs'
import type { CardDef, GameAction, GameState, Side } from '../game/types'
import { MultiplayerLink, type WireMessage } from '../multiplayer/peer'
import type { PeerProfile } from '../profile/profile'
import { expandDeckFromCollection, useCollectionStore } from './collectionStore'
import { useProfileStore } from './profileStore'

export type Screen = 'menu' | 'setup' | 'game' | 'lobby'

interface GameStore {
  screen: Screen
  gameState: GameState | null
  link: MultiplayerLink | null
  sessionCode: string | null
  mpStatus: 'idle' | 'hosting' | 'joining' | 'connected' | 'error'
  mpError: string | null
  opponentProfile: PeerProfile | null
  starting: boolean
  startError: string | null

  startLocalGame: () => Promise<void>
  hostMultiplayerGame: () => Promise<void>
  joinMultiplayerGame: (code: string) => Promise<void>
  dispatch: (action: GameAction) => void
  backToMenu: () => void
}

function aiIsUp(state: GameState): Side | null {
  if (state.phase === 'gameover') return null
  for (const side of ['p1', 'p2'] as Side[]) {
    if (!state.players[side].isAI) continue
    if (state.phase === 'setup' && !state.setupReady[side]) return side
    if (state.phase === 'main' && state.players[side].active === null) return side
    if (state.phase === 'main' && state.activeSide === side) return side
  }
  return null
}

async function buildRandomOpponentDeck(): Promise<CardDef[]> {
  const sets = await loadPackSets()
  const chosen = sets[Math.floor(Math.random() * sets.length)]
  if (!chosen) return []
  const pool = await loadSetPool(chosen)
  return buildRandomLegalDeck(pool.all, 60)
}

function myActiveDeckCards(): CardDef[] | null {
  const cs = useCollectionStore.getState()
  const deck = cs.decks.find((d) => d.id === cs.activeDeckId)
  if (!deck) return null
  return expandDeckFromCollection(deck, cs.collection)
}

export const useGameStore = create<GameStore>((set, get) => {
  function scheduleAiIfNeeded() {
    const state = get().gameState
    if (!state) return
    if (state.mode === 'guest') return
    const side = aiIsUp(state)
    if (!side) return
    window.setTimeout(() => {
      const current = get().gameState
      if (!current) return
      const again = aiIsUp(current)
      if (again !== side) return
      const action =
        current.phase === 'setup'
          ? decideAiSetupAction(current, side)
          : decideNextAiAction(current, side)
      if (action) applyLocal(action)
    }, 550)
  }

  function recordResultIfGameEnded(prev: GameState | null, next: GameState) {
    if (next.phase !== 'gameover' || !next.winner) return
    if (prev && prev.phase === 'gameover') return
    const isMp = next.mode !== 'local'
    const oppSide: Side = next.mySide === 'p1' ? 'p2' : 'p1'
    const opp = get().opponentProfile
    useProfileStore.getState().recordMatch({
      mode: isMp ? 'multiplayer' : 'cpu',
      result: next.winner === next.mySide ? 'win' : 'loss',
      opponentName: next.players[oppSide].name,
      opponentAvatarId: isMp ? (opp?.avatarId ?? null) : null,
      opponentRating: isMp ? (opp?.rating ?? null) : null,
      turns: next.turnNumber,
    })
  }

  function applyLocal(action: GameAction) {
    const state = get().gameState
    if (!state) return
    const next = applyAction(state, action)
    set({ gameState: next })
    recordResultIfGameEnded(state, next)
    const link = get().link
    if (state.mode === 'host' && link) {
      link.send({ type: 'state', state: { ...next, mode: 'guest', mySide: 'p2' } })
    }
    scheduleAiIfNeeded()
  }

  function attachLinkHandlers(link: MultiplayerLink, role: 'host' | 'guest') {
    link.onData = (msg: WireMessage) => {
      if (role === 'host' && msg.type === 'hello') {
        const p1Cards = myActiveDeckCards()
        if (!p1Cards) {
          set({ mpStatus: 'error', mpError: 'Kein aktives Deck ausgewählt.' })
          return
        }
        const myProfile = useProfileStore.getState()
        const state = createInitialState('host', 'p1', p1Cards, msg.deckCards, {
          p2IsAI: false,
          p1Name: myProfile.name,
          p2Name: msg.profile.name || 'Gast',
        })
        set({ gameState: state, screen: 'setup', mpStatus: 'connected', opponentProfile: msg.profile })
        link.send({ type: 'welcome', profile: myProfile.asPeerProfile() })
        link.send({ type: 'state', state: { ...state, mode: 'guest', mySide: 'p2' } })
      }
      if (role === 'host' && msg.type === 'action') {
        applyLocal(msg.action)
      }
      if (role === 'guest' && msg.type === 'welcome') {
        set({ opponentProfile: msg.profile })
      }
      if (role === 'guest' && msg.type === 'state') {
        const prev = get().gameState
        set({ gameState: msg.state })
        recordResultIfGameEnded(prev, msg.state)
      }
    }
    link.onPeerDisconnected = () => {
      set({ mpError: 'Verbindung zum Gegner wurde getrennt.' })
    }
  }

  return {
    screen: 'menu',
    gameState: null,
    link: null,
    sessionCode: null,
    mpStatus: 'idle',
    mpError: null,
    opponentProfile: null,
    starting: false,
    startError: null,

    startLocalGame: async () => {
      const p1Cards = myActiveDeckCards()
      if (!p1Cards) {
        set({ startError: 'Bitte zuerst ein aktives Deck im Deck-Builder auswählen.' })
        return
      }
      set({ starting: true, startError: null })
      try {
        const p2Cards = await buildRandomOpponentDeck()
        const state = createInitialState('local', 'p1', p1Cards, p2Cards, {
          p2IsAI: true,
          p1Name: useProfileStore.getState().name,
        })
        set({ gameState: state, screen: 'setup', starting: false })
        scheduleAiIfNeeded()
      } catch {
        set({ starting: false, startError: 'Gegner-Deck konnte nicht erstellt werden.' })
      }
    },

    hostMultiplayerGame: async () => {
      const p1Cards = myActiveDeckCards()
      if (!p1Cards) {
        set({ startError: 'Bitte zuerst ein aktives Deck im Deck-Builder auswählen.' })
        return
      }
      set({ mpStatus: 'hosting', mpError: null, screen: 'lobby' })
      const link = new MultiplayerLink()
      set({ link })
      attachLinkHandlers(link, 'host')
      try {
        const code = await link.hostSession()
        set({ sessionCode: code })
      } catch {
        set({ mpStatus: 'error', mpError: 'Konnte keine Session erstellen.' })
      }
    },

    joinMultiplayerGame: async (code: string) => {
      const p2Cards = myActiveDeckCards()
      if (!p2Cards) {
        set({ startError: 'Bitte zuerst ein aktives Deck im Deck-Builder auswählen.' })
        return
      }
      set({ mpStatus: 'joining', mpError: null, screen: 'lobby' })
      const link = new MultiplayerLink()
      set({ link })
      attachLinkHandlers(link, 'guest')
      try {
        await link.joinSession(code)
        link.send({ type: 'hello', profile: useProfileStore.getState().asPeerProfile(), deckCards: p2Cards })
        set({ mpStatus: 'connected' })
      } catch {
        set({ mpStatus: 'error', mpError: 'Session nicht gefunden oder Verbindung fehlgeschlagen.' })
      }
    },

    dispatch: (action: GameAction) => {
      const state = get().gameState
      if (!state) return
      if (state.mode === 'guest') {
        get().link?.send({ type: 'action', action })
        return
      }
      applyLocal(action)
    },

    backToMenu: () => {
      get().link?.destroy()
      set({
        screen: 'menu',
        gameState: null,
        link: null,
        sessionCode: null,
        mpStatus: 'idle',
        mpError: null,
        opponentProfile: null,
        startError: null,
      })
    },
  }
})

export function isMyTurn(state: GameState): boolean {
  return state.activeSide === state.mySide && state.phase === 'main'
}
