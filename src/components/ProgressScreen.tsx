import { useEffect } from 'react'
import { dayKey } from '../game/dailyPacks'
import {
  ACHIEVEMENTS,
  achievementReached,
  dailyQuestsFor,
  questComplete,
  questProgress,
} from '../game/progress/quests'
import { useProgressStore } from '../store/progressStore'

export function ProgressScreen({ onBack }: { onBack: () => void }) {
  const coins = useProgressStore((s) => s.coins)
  const stats = useProgressStore((s) => s.stats)
  const daily = useProgressStore((s) => s.daily)
  const claimedAchievements = useProgressStore((s) => s.claimedAchievements)
  const ensureDaily = useProgressStore((s) => s.ensureDaily)
  const claimQuest = useProgressStore((s) => s.claimQuest)

  useEffect(() => {
    ensureDaily()
  }, [ensureDaily])

  const today = dayKey()
  const quests = dailyQuestsFor(today)
  const progress = daily && daily.day === today ? daily.progress : {}
  const claimedQuests = daily && daily.day === today ? daily.claimed : []

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-white">
          ← Menü
        </button>
        <h1 className="text-xl font-bold text-white">Quests &amp; Erfolge</h1>
        <div className="rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-bold text-yellow-300">🪙 {coins}</div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-300">Tagesquests</h2>
        <div className="flex flex-col gap-2">
          {quests.map((q) => {
            const done = questComplete(q, progress)
            const claimed = claimedQuests.includes(q.id)
            const cur = questProgress(q, progress)
            return (
              <div key={q.id} className="flex items-center gap-3 rounded-xl bg-black/20 p-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-200">{q.label}</div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${(cur / q.target) * 100}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {cur}/{q.target} · Belohnung 🪙 {q.reward}
                  </div>
                </div>
                <button
                  disabled={!done || claimed}
                  onClick={() => claimQuest(q.id)}
                  className="rounded-full bg-yellow-500 px-4 py-1.5 text-xs font-bold text-slate-900 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {claimed ? 'Erhalten' : 'Einlösen'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-300">Erfolge</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = claimedAchievements.includes(a.id) || achievementReached(a, stats)
            const cur = Math.min(a.target, stats[a.metric])
            return (
              <div
                key={a.id}
                className={`rounded-xl border p-3 ${
                  unlocked ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-slate-700 bg-black/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${unlocked ? 'text-yellow-200' : 'text-slate-300'}`}>
                    {unlocked ? '🏅' : '🔒'} {a.label}
                  </span>
                  <span className="text-[11px] text-slate-400">🪙 {a.reward}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{a.description}</p>
                {!unlocked && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    Fortschritt {cur}/{a.target}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
