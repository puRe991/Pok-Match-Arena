import { useState } from 'react'
import { remainingFreePacks } from '../game/dailyPacks'
import { useGameStore } from '../store/gameStore'
import { useCollectionStore } from '../store/collectionStore'
import type { View } from '../App'

export function MainMenu({ onNavigate }: { onNavigate: (view: View) => void }) {
  const starting = useGameStore((s) => s.starting)
  const startError = useGameStore((s) => s.startError)
  const startLocalGame = useGameStore((s) => s.startLocalGame)
  const hostMultiplayerGame = useGameStore((s) => s.hostMultiplayerGame)
  const joinMultiplayerGame = useGameStore((s) => s.joinMultiplayerGame)
  const decks = useCollectionStore((s) => s.decks)
  const activeDeckId = useCollectionStore((s) => s.activeDeckId)
  const dailyFree = useCollectionStore((s) => s.dailyFree)
  const freePacksLeft = remainingFreePacks(dailyFree)
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)

  const activeDeck = decks.find((d) => d.id === activeDeckId)
  const ready = !!activeDeck && !starting

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
          Pokémon <span className="text-yellow-400">Duell-Arena</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">Sammle Karten, baue dein Deck und tritt zum Duell an</p>
      </div>

      {!activeDeck && <p className="text-sm text-slate-400">Lade Starter-Deck…</p>}
      {activeDeck && (
        <p className="text-xs text-slate-500">
          Aktives Deck: <span className="text-slate-300">{activeDeck.name}</span>
        </p>
      )}
      {starting && <p className="text-sm text-slate-400">Gegner-Deck wird gemischt…</p>}
      {startError && <p className="text-sm text-amber-400">{startError}</p>}

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={startLocalGame}
          className="rounded-full bg-yellow-500 px-6 py-3 font-bold text-slate-900 shadow transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Gegen CPU spielen
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={hostMultiplayerGame}
          className="rounded-full bg-sky-600 px-6 py-3 font-bold text-white shadow transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Multiplayer-Session erstellen
        </button>

        {!showJoin ? (
          <button
            type="button"
            disabled={!ready}
            onClick={() => setShowJoin(true)}
            className="rounded-full border border-slate-600 px-6 py-3 font-bold text-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Session beitreten
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Session-Code"
              maxLength={5}
              className="w-0 flex-1 rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-center font-mono tracking-widest text-white outline-none focus:border-sky-400"
            />
            <button
              type="button"
              disabled={joinCode.length < 5}
              onClick={() => joinMultiplayerGame(joinCode)}
              className="rounded-full bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Los
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigate('league')}
          className="mt-2 rounded-full border border-yellow-500/50 bg-gradient-to-r from-yellow-500/20 to-amber-500/10 px-6 py-3 font-bold text-yellow-200 hover:from-yellow-500/30"
        >
          🏆 Esports-Liga &amp; Orden
        </button>

        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={() => onNavigate('packs')}
            className="relative flex-1 rounded-full border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-200 hover:bg-purple-500/20"
          >
            🎴 Packs öffnen
            {freePacksLeft > 0 && (
              <span
                title={`${freePacksLeft} kostenlose Boosterpacks heute verfügbar`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white shadow"
              >
                {freePacksLeft}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('deckbuilder')}
            className="flex-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20"
          >
            🛠 Deck-Builder
          </button>
        </div>
      </div>
    </div>
  )
}
