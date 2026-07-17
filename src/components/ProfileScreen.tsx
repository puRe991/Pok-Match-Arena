import { useState } from 'react'
import {
  AVATARS,
  MAX_NAME_LENGTH,
  avatarById,
  nextRank,
  rankForRating,
  sanitizeUsername,
  validateUsername,
  winRate,
} from '../profile/profile'
import { useProfileStore } from '../store/profileStore'
import type { MatchRecord } from '../store/profileStore'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function HistoryRow({ match }: { match: MatchRecord }) {
  const won = match.result === 'win'
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-left">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
          won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}
      >
        {won ? 'S' : 'N'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-white">
          {match.opponentAvatarId && <span className="mr-1">{avatarById(match.opponentAvatarId).emoji}</span>}
          {match.opponentName}
        </div>
        <div className="text-xs text-slate-500">
          {match.mode === 'multiplayer' ? 'Multiplayer' : 'Gegen CPU'} · {match.turns} Züge · {formatDate(match.endedAt)}
        </div>
      </div>
      {match.mode === 'multiplayer' && (
        <span className={`text-sm font-bold ${match.ratingDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {match.ratingDelta >= 0 ? '+' : ''}
          {match.ratingDelta}
        </span>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-3">
      <div className={`text-xl font-black ${accent ?? 'text-white'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const name = useProfileStore((s) => s.name)
  const avatarId = useProfileStore((s) => s.avatarId)
  const stats = useProfileStore((s) => s.stats)
  const matchHistory = useProfileStore((s) => s.matchHistory)
  const setName = useProfileStore((s) => s.setName)
  const setAvatar = useProfileStore((s) => s.setAvatar)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const draftErrors = validateUsername(sanitizeUsername(draft))

  const rank = rankForRating(stats.rating)
  const upcoming = nextRank(stats.rating)
  const mpRate = winRate(stats.mpWins, stats.mpLosses)

  function saveName() {
    if (setName(draft)) setEditing(false)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Trainer-Profil</h1>
        <button type="button" onClick={onBack} className="text-sm font-bold text-slate-400 hover:text-white">
          ← Zurück
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-yellow-400/60 bg-slate-900 text-4xl">
          {avatarById(avatarId).emoji}
        </div>

        {!editing ? (
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white">{name}</span>
            <button
              type="button"
              onClick={() => {
                setDraft(name)
                setEditing(true)
              }}
              className="rounded-full border border-slate-600 px-2.5 py-0.5 text-xs font-bold text-slate-300 hover:border-slate-400"
              title="Nutzernamen ändern"
            >
              ✏️ Ändern
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-2">
            <div className="flex w-full max-w-xs gap-2">
              <input
                value={draft}
                autoFocus
                maxLength={MAX_NAME_LENGTH + 4}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draftErrors.length === 0) saveName()
                  if (e.key === 'Escape') setEditing(false)
                }}
                placeholder="Nutzername"
                className="w-0 flex-1 rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-center font-bold text-white outline-none focus:border-yellow-400"
              />
              <button
                type="button"
                disabled={draftErrors.length > 0}
                onClick={saveName}
                className="rounded-full bg-yellow-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                OK
              </button>
            </div>
            {draftErrors.map((err) => (
              <p key={err} className="text-xs text-amber-400">
                {err}
              </p>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-2 text-sm font-bold ${rank.colorClass}`}>
          <span>{rank.icon}</span>
          <span>{rank.label}</span>
          <span className="text-slate-400">·</span>
          <span className="text-white">{stats.rating}</span>
          <span className="text-xs font-normal text-slate-500">Elo</span>
        </div>
        {upcoming ? (
          <p className="text-xs text-slate-500">
            Noch {upcoming.minRating - stats.rating} Punkte bis {upcoming.icon} {upcoming.label}
          </p>
        ) : (
          <p className="text-xs text-slate-500">Höchster Rang erreicht!</p>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Avatar</h2>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.label}
              onClick={() => setAvatar(a.id)}
              className={`flex aspect-square items-center justify-center rounded-xl border text-2xl transition-colors ${
                a.id === avatarId
                  ? 'border-yellow-400 bg-yellow-400/10'
                  : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
              }`}
            >
              {a.emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Statistiken</h2>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="MP-Siege" value={String(stats.mpWins)} accent="text-green-400" />
          <Stat label="MP-Niederlagen" value={String(stats.mpLosses)} accent="text-red-400" />
          <Stat label="MP-Siegquote" value={mpRate === null ? '–' : `${mpRate}%`} />
          <Stat label="Serie" value={String(stats.winStreak)} accent="text-yellow-400" />
          <Stat label="Beste Serie" value={String(stats.bestStreak)} />
          <Stat label="Bestes Rating" value={String(stats.peakRating)} accent="text-cyan-300" />
          <Stat label="CPU-Siege" value={String(stats.cpuWins)} />
          <Stat label="CPU-Niederlagen" value={String(stats.cpuLosses)} />
          <Stat
            label="Spiele gesamt"
            value={String(stats.mpWins + stats.mpLosses + stats.cpuWins + stats.cpuLosses)}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Letzte Partien</h2>
        {matchHistory.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
            Noch keine Partien gespielt.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {matchHistory.slice(0, 15).map((m) => (
              <HistoryRow key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
