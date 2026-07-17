import { create } from 'zustand'
import { loadCardPool, type CardPool } from '../api/pokemonTcg'
import { decideAiSetupAction, decideNextAiAction } from '../game/ai'
import { applyAction, createInitialState } from '../game/engine'
import type { GameAction, GameState, Side } from '../game/types'
import { MultiplayerLink, type WireMessage } from '../multiplayer/peer'

export type Screen = 'menu' | 'setup' | 'game' | 'lobby'

interface GameStore {
  screen: Screen
  pool: CardPool | null
  poolError: string | null
  gameState: GameState | null
  link: MultiplayerLink | null
  sessionCode: string | null
  mpStatus: 'idle' | 'hosting' | 'joining' | 'connected' | 'error'
  mpError: string | null

  init: () => Promise<void>
  startLocalGame: () => void
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
    if (state.phase === 'main' && state.activeSide === side) return side
  }
  return null
}

export const useGameStore = create<GameStore>((set, get) => {
  function scheduleAiIfNeeded() {
    const state = get().gameState
    if (!state) return
    if (get().gameState?.mode === 'guest') return
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
    scheduleAiIfNeeded()
  }

  function attachLinkHandlers(link: MultiplayerLink, role: 'host' | 'guest') {
    link.onData = (msg: WireMessage) => {
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
    pool: null,
    poolError: null,
    gameState: null,
    link: null,
    sessionCode: null,
    mpStatus: 'idle',
    mpError: null,

    init: async () => {
      try {
        const pool = await loadCardPool()
        set({ pool })
      } catch {
        set({ poolError: 'Kartendaten konnten nicht geladen werden. Offline-Kartensatz wird genutzt.' })
      }
    },

    startLocalGame: () => {
      const pool = get().pool
      if (!pool) return
      const state = createInitialState('local', 'p1', pool, { p2IsAI: true })
      set({ gameState: state, screen: 'setup' })
      scheduleAiIfNeeded()
    },

    hostMultiplayerGame: async () => {
      const pool = get().pool
      if (!pool) return
      set({ mpStatus: 'hosting', mpError: null, screen: 'lobby' })
      const link = new MultiplayerLink()
      set({ link })
      attachLinkHandlers(link, 'host')
      link.onPeerConnected = () => {
        const p = get().pool
        if (!p) return
        const state = createInitialState('host', 'p1', p, {
          p2IsAI: false,
          p1Name: 'Host',
          p2Name: 'Gast',
        })
        set({ gameState: state, screen: 'setup', mpStatus: 'connected' })
        link.send({ type: 'state', state: { ...state, mode: 'guest', mySide: 'p2' } })
      }
      try {
        const code = await link.hostSession()
        set({ sessionCode: code })
      } catch {
        set({ mpStatus: 'error', mpError: 'Konnte keine Session erstellen.' })
      }
    },

    joinMultiplayerGame: async (code: string) => {
      set({ mpStatus: 'joining', mpError: null, screen: 'lobby' })
      const link = new MultiplayerLink()
      set({ link })
      attachLinkHandlers(link, 'guest')
      try {
        await link.joinSession(code)
        set({ mpStatus: 'connected', screen: 'setup' })
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
      })
    },
  }
})

export function isMyTurn(state: GameState): boolean {
  return state.activeSide === state.mySide && state.phase === 'main'
}
