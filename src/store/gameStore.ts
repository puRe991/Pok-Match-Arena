import { create } from 'zustand'
import { loadPackSets } from '../api/sets'
import { decideAiSetupAction, decideNextAiAction } from '../game/ai'
import { buildRandomLegalDeck } from '../game/deckBuilder'
import { applyAction, createInitialState } from '../game/engine'
import { loadSetPool } from '../game/packs'
import { badgeAt } from '../game/ranked/regions'
import type { CardDef, ElementType, GameAction, GameState, Side } from '../game/types'
import { MultiplayerLink, type WireMessage } from '../multiplayer/peer'
import { supabase } from '../backend/supabaseClient'
import type { PeerProfile } from '../profile/profile'
import { expandDeckFromCollection, useCollectionStore } from './collectionStore'
import { useAuthStore } from './authStore'
import { useLeagueStore } from './leagueStore'
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
  /** Läuft gerade ein gewertetes Liga-Match (gegen den Arena-Leiter)? */
  ranked: boolean
  /** Läuft gerade ein gewertetes PvP-Match (echter Gegner)? */
  pvp: boolean
  pvpMatchId: number | null
  pvpReported: boolean
  mmStatus: 'idle' | 'searching' | 'error'
  mmError: string | null

  startLocalGame: () => Promise<void>
  startRankedGame: () => Promise<void>
  hostMultiplayerGame: () => Promise<void>
  joinMultiplayerGame: (code: string) => Promise<void>
  findRankedMatch: () => Promise<void>
  cancelMatchmaking: () => Promise<void>
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
    // Gewertetes Liga-Match (CPU-Arena): Ergebnis einmal lokal an die Liga melden.
    if (get().ranked && state.phase !== 'gameover' && next.phase === 'gameover' && next.winner) {
      set({ ranked: false })
      useLeagueStore.getState().reportMatchResult(next.winner === next.mySide)
    }
    // Gewertetes PvP-Match: Ergebnis serverseitig melden (Host-Seite).
    if (get().pvp && !get().pvpReported && state.phase !== 'gameover' && next.phase === 'gameover' && next.winner) {
      reportPvpResult(next.winner === next.mySide)
    }
    scheduleAiIfNeeded()
  }

  function reportPvpResult(won: boolean) {
    if (get().pvpReported) return
    set({ pvpReported: true })
    if (!supabase) return
    void supabase
      .rpc('report_match_result', { p_i_won: won, p_match_id: get().pvpMatchId })
      .then(() => useLeagueStore.getState().refreshServerProfile())
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
        set({ gameState: state, screen: 'setup', mpStatus: 'connected', mmStatus: 'idle', opponentProfile: msg.profile })
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
        set({ gameState: msg.state, mmStatus: 'idle' })
        recordResultIfGameEnded(prev, msg.state)
        // Gast wertet PvP-Ergebnis serverseitig aus, sobald das Spiel endet.
        if (get().pvp && !get().pvpReported && msg.state.phase === 'gameover' && msg.state.winner) {
          reportPvpResult(msg.state.winner === msg.state.mySide)
        }
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
    ranked: false,
    pvp: false,
    pvpMatchId: null,
    pvpReported: false,
    mmStatus: 'idle',
    mmError: null,

    startLocalGame: async () => {
      const p1Cards = myActiveDeckCards()
      if (!p1Cards) {
        set({ startError: 'Bitte zuerst ein aktives Deck im Deck-Builder auswählen.' })
        return
      }
      set({ starting: true, startError: null, ranked: false, pvp: false })
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

    startRankedGame: async () => {
      const p1Cards = myActiveDeckCards()
      if (!p1Cards) {
        set({ startError: 'Bitte zuerst ein aktives Deck im Deck-Builder auswählen.' })
        return
      }
      const profile = useLeagueStore.getState().ensureProfile()
      const badge = badgeAt(profile.regionIndex, profile.arenaIndex)
      const leaderName = badge ? `${badge.leader} (${badge.name})` : 'Arena-Leiter'
      set({ starting: true, startError: null, ranked: false, pvp: false })
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
        link.send({ type: 'hello', profile: useProfileStore.getState().asPeerProfile(), deckCards: p2Cards })
        set({ mpStatus: 'connected' })
      } catch {
        set({ mpStatus: 'error', mpError: 'Session nicht gefunden oder Verbindung fehlgeschlagen.' })
      }
    },

    findRankedMatch: async () => {
      if (!supabase) {
        set({ mmStatus: 'error', mmError: 'Online-Liga nicht konfiguriert.' })
        return
      }
      if (!useAuthStore.getState().user) {
        set({ mmStatus: 'error', mmError: 'Bitte zuerst anmelden, um gewertet zu spielen.' })
        return
      }
      const myCards = myActiveDeckCards()
      if (!myCards) {
        set({ mmStatus: 'error', mmError: 'Bitte zuerst ein aktives Deck auswählen.' })
        return
      }
      set({ mmStatus: 'searching', mmError: null, pvp: true, pvpReported: false, pvpMatchId: null })
      try {
        const { data, error } = await supabase.rpc('matchmake', { p_range: 400 })
        if (error) throw new Error(error.message)
        const row = (data as { role: string; peer_code: string | null; match_id: number | null }[])?.[0]
        const link = new MultiplayerLink()
        set({ link })
        if (row?.role === 'guest' && row.peer_code) {
          // Gegner wartet bereits → als Gast beitreten.
          set({ pvpMatchId: row.match_id })
          attachLinkHandlers(link, 'guest')
          await link.joinSession(row.peer_code)
          link.send({ type: 'hello', profile: useProfileStore.getState().asPeerProfile(), deckCards: myCards })
        } else {
          // Kein Gegner → selbst hosten und warten, bis jemand beitritt.
          attachLinkHandlers(link, 'host')
          const code = await link.hostSession()
          await supabase.rpc('set_matchmaking_peer_code', { p_code: code })
        }
      } catch (e) {
        get().link?.destroy()
        set({
          mmStatus: 'error',
          mmError: e instanceof Error ? e.message : 'Matchmaking fehlgeschlagen.',
          pvp: false,
          link: null,
        })
      }
    },

    cancelMatchmaking: async () => {
      if (supabase) await supabase.rpc('cancel_matchmaking').then(undefined, () => {})
      get().link?.destroy()
      set({ link: null, mmStatus: 'idle', mmError: null, pvp: false, pvpMatchId: null })
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
      if (get().pvp && get().mmStatus === 'searching') void get().cancelMatchmaking()
      set({
        screen: 'menu',
        gameState: null,
        link: null,
        sessionCode: null,
        mpStatus: 'idle',
        mpError: null,
        opponentProfile: null,
        startError: null,
        ranked: false,
        pvp: false,
        pvpMatchId: null,
        pvpReported: false,
        mmStatus: 'idle',
        mmError: null,
      })
    },
  }
})

export function isMyTurn(state: GameState): boolean {
  return state.activeSide === state.mySide && state.phase === 'main'
}
