import { useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function MainMenu() {
  const pool = useGameStore((s) => s.pool)
  const poolError = useGameStore((s) => s.poolError)
  const startLocalGame = useGameStore((s) => s.startLocalGame)
  const hostMultiplayerGame = useGameStore((s) => s.hostMultiplayerGame)
  const joinMultiplayerGame = useGameStore((s) => s.joinMultiplayerGame)
  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)

  const ready = !!pool

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
          Pokémon <span className="text-yellow-400">Duell-Arena</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">Ein vereinfachtes TCG-Duell mit echten Pokémon-Karten</p>
      </div>

      {!ready && !poolError && <p className="text-sm text-slate-400">Lade Kartendaten…</p>}
      {poolError && <p className="text-sm text-amber-400">{poolError}</p>}

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
      </div>
    </div>
  )
}
