import { avatarById, rankForRating } from '../profile/profile'
import { useGameStore } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'

export function LobbyScreen() {
  const sessionCode = useGameStore((s) => s.sessionCode)
  const mpStatus = useGameStore((s) => s.mpStatus)
  const mpError = useGameStore((s) => s.mpError)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const name = useProfileStore((s) => s.name)
  const avatarId = useProfileStore((s) => s.avatarId)
  const rating = useProfileStore((s) => s.stats.rating)
  const rank = rankForRating(rating)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-bold text-white">Multiplayer-Lobby</h1>

      <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-4 py-1.5 text-sm">
        <span>{avatarById(avatarId).emoji}</span>
        <span className="font-bold text-white">{name}</span>
        <span className={`font-bold ${rank.colorClass}`}>
          {rank.icon} {rating}
        </span>
      </div>

      {mpStatus === 'hosting' && !sessionCode && <p className="text-slate-400">Erstelle Session…</p>}

      {sessionCode && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-slate-400">Teile diesen Code mit deinem Gegner:</p>
          <div className="rounded-xl border border-slate-600 bg-slate-800 px-8 py-4 font-mono text-4xl font-black tracking-[0.3em] text-yellow-300">
            {sessionCode}
          </div>
          <p className="text-xs text-slate-500">Warte auf Mitspieler…</p>
        </div>
      )}

      {mpStatus === 'joining' && <p className="text-slate-400">Verbinde mit Session…</p>}
      {mpStatus === 'connected' && <p className="text-green-400">Verbunden! Spiel wird vorbereitet…</p>}
      {mpStatus === 'error' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-red-400">{mpError}</p>
          <button
            type="button"
            onClick={backToMenu}
            className="rounded-full bg-slate-700 px-6 py-2 font-bold text-white hover:bg-slate-600"
          >
            Zurück zum Menü
          </button>
        </div>
      )}

      {mpStatus !== 'error' && (
        <button type="button" onClick={backToMenu} className="text-xs text-slate-500 hover:text-white">
          Abbrechen
        </button>
      )}
    </div>
  )
}
