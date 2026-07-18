import { create } from 'zustand'
import { loadPackSets } from '../api/sets'
import { decideAiSetupAction, decideNextAiAction } from '../game/ai'
import { buildRandomLegalDeck } from '../game/deckBuilder'
import { applyAction, createInitialState } from '../game/engine'
import { loadSetPool } from '../game/packs'
import { badgeAt } from '../game/ranked/regions'
import type { CardDef, ElementType, GameAction, GameState, Side } from '../game/types'
import { MultiplayerLink, type WireMessage } from '../multiplayer/peer'
import { expandDeckFromCollection, useCollectionStore } from './collectionStore'
import { useLeagueStore } from './leagueStore'

export type Screen = 'menu' | 'setup' | 'game' | 'lobby'

interface GameStore {
  screen: Screen
  gameState: GameState | null
  link: MultiplayerLink | null
  sessionCode: string | null
  mpStatus: 'idle' | 'hosting' | 'joining' | 'connected' | 'error'
  mpError: string | null
  starting: boolean
  startError: string | null
  /** Läuft gerade ein gewertetes Liga-Match (gegen den Arena-Leiter)? */
  ranked: boolean

  startLocalGame: () => Promise<void>
  startRankedGame: () => Promise<void>
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

async function buildRandomOpponentDeck(preferType?: ElementType): Promise<CardDef[]> {
  const sets = await loadPackSets()
  const chosen = sets[Math.floor(Math.random() * sets.length)]
  if (!chosen) return []
  const pool = await loadSetPool(chosen)
  return buildRandomLegalDeck(pool.all, 60, preferType)
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

  function applyLocal(action: GameAction) {
    const state = get().gameState
    if (!state) return
    const next = applyAction(state, action)
    set({ gameState: next })
    const link = get().link
    if (state.mode === 'host' && link) {
      link.send({ type: 'state', state: { ...next, mode: 'guest', mySide: 'p2' } })
    }
    // Gewertetes Liga-Match: Ergebnis genau einmal an die Liga melden.
    if (get().ranked && state.phase !== 'gameover' && next.phase === 'gameover' && next.winner) {
      set({ ranked: false })
      useLeagueStore.getState().reportMatchResult(next.winner === next.mySide)
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
        const state = createInitialState('host', 'p1', p1Cards, msg.deckCards, {
          p2IsAI: false,
          p1Name: 'Host',
          p2Name: msg.name || 'Gast',
        })
        set({ gameState: state, screen: 'setup', mpStatus: 'connected' })
        link.send({ type: 'state', state: { ...state, mode: 'guest', mySide: 'p2' } })
      }
      if (role === 'host' && msg.type === 'action') {
        applyLocal(msg.action)
      }
      if (role === 'guest' && msg.type === 'state') {
        set({ gameState: msg.state })
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
    starting: false,
    startError: null,
    ranked: false,

    startLocalGame: async () => {
      const p1Cards = myActiveDeckCards()
      if (!p1Cards) {
        set({ startError: 'Bitte zuerst ein aktives Deck im Deck-Builder auswählen.' })
        return
      }
      set({ starting: true, startError: null, ranked: false })
      try {
        const p2Cards = await buildRandomOpponentDeck()
        const state = createInitialState('local', 'p1', p1Cards, p2Cards, { p2IsAI: true })
        set({ gameState: state, screen: 'setup', starting: false })
        scheduleAiIfNeeded()
      } catch {
        set({ starting: false, startError: 'Gegner-Deck konnte nicht erstellt werden.' })
      }
    },

    startRankedGame: async () => {
      const p1Cards = myActiveDeckCards()
      if (!p1Cards) {
        set({ startError: 'Bitte zuerst ein aktives Deck im Deck-Builder auswählen.' })
        return
      }
      const profile = useLeagueStore.getState().ensureProfile()
      const badge = badgeAt(profile.regionIndex, profile.arenaIndex)
      const leaderName = badge ? `${badge.leader} (${badge.name})` : 'Arena-Leiter'
      set({ starting: true, startError: null, ranked: false })
      try {
        const p2Cards = await buildRandomOpponentDeck(badge?.themeType)
        const state = createInitialState('local', 'p1', p1Cards, p2Cards, {
          p2IsAI: true,
          p1Name: profile.handle,
          p2Name: leaderName,
        })
        set({ gameState: state, screen: 'setup', starting: false, ranked: true })
        scheduleAiIfNeeded()
      } catch {
        set({ starting: false, ranked: false, startError: 'Arena-Leiter-Deck konnte nicht erstellt werden.' })
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
        link.send({ type: 'hello', name: 'Gast', deckCards: p2Cards })
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
        startError: null,
        ranked: false,
      })
    },
  }
})

export function isMyTurn(state: GameState): boolean {
  return state.activeSide === state.mySide && state.phase === 'main'
}
