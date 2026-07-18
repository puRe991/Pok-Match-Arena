import { useEffect, useMemo, useState } from 'react'
import { PROMOTION_SLOTS, RELEGATION_SLOTS, LADDER_SIZE } from '../game/ranked/ghosts'
import { REGIONS, TOTAL_BADGES } from '../game/ranked/regions'
import type { ElementType } from '../game/types'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import { useLeagueStore } from '../store/leagueStore'
import { AuthPanel } from './AuthPanel'
import type { View } from '../App'

const TYPE_COLOR: Record<ElementType, string> = {
  Fire: 'bg-red-500',
  Water: 'bg-sky-500',
  Grass: 'bg-emerald-500',
  Lightning: 'bg-yellow-400',
  Fighting: 'bg-orange-600',
  Psychic: 'bg-fuchsia-500',
  Colorless: 'bg-slate-400',
}

type Tab = 'ladder' | 'badges' | 'leaderboard'

export function LeagueScreen({ onNavigate }: { onNavigate: (view: View) => void }) {
  const ensureProfile = useLeagueStore((s) => s.ensureProfile)
  const profile = useLeagueStore((s) => s.profile)
  const [tab, setTab] = useState<Tab>('ladder')

  useEffect(() => {
    ensureProfile()
  }, [ensureProfile])

  if (!profile) return null

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 p-5">
      <Header onNavigate={onNavigate} />
      <div className="flex gap-2">
        <TabButton active={tab === 'ladder'} onClick={() => setTab('ladder')}>🪜 Arena-Rangliste</TabButton>
        <TabButton active={tab === 'badges'} onClick={() => setTab('badges')}>🎖 Orden-Vitrine</TabButton>
        <TabButton active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>🌍 Meister-Liga</TabButton>
      </div>
      {tab === 'ladder' && <LadderTab />}
      {tab === 'badges' && <BadgesTab />}
      {tab === 'leaderboard' && <LeaderboardTab />}
    </div>
  )
}

function Header({ onNavigate }: { onNavigate: (view: View) => void }) {
  const profile = useLeagueStore((s) => s.profile)!
  const setHandle = useLeagueStore((s) => s.setHandle)
  const backendKind = useLeagueStore((s) => s.backendKind)
  const serverElo = useLeagueStore((s) => s.serverElo)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile.handle)
  const region = REGIONS[profile.regionIndex]

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mb-2 text-xs text-slate-400 hover:text-slate-200"
          >
            ← Hauptmenü
          </button>
          {editing ? (
            <div className="flex gap-2">
              <input
                value={draft}
                autoFocus
                maxLength={20}
                onChange={(e) => setDraft(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-lg font-bold text-white outline-none focus:border-yellow-400"
              />
              <button
                type="button"
                onClick={() => {
                  setHandle(draft)
                  setEditing(false)
                }}
                className="rounded-lg bg-yellow-500 px-3 py-1 text-sm font-bold text-slate-900"
              >
                OK
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="group text-left">
              <h1 className="text-2xl font-black text-white">
                {profile.handle} <span className="text-sm font-normal text-slate-500 group-hover:text-slate-300">✎</span>
              </h1>
            </button>
          )}
          <p className="mt-1 text-sm text-slate-400">
            Division {profile.regionIndex + 1} · <span className="text-slate-200">{region.name}</span>
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
              backendKind === 'supabase' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600/40 text-slate-300'
            }`}
          >
            {backendKind === 'supabase' ? '● Online-Liga' : '○ Offline-Liga'}
          </span>
          <p className="mt-2 text-3xl font-black text-yellow-400">{serverElo ?? profile.careerElo}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{serverElo !== null ? 'PvP-Elo' : 'Elo'}</p>
        </div>
      </div>
      <div className="mt-3">
        <AuthPanel />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Orden" value={`${profile.earnedBadges.length}/${TOTAL_BADGES}`} />
        <Stat label="Siege" value={String(profile.wins)} />
        <Stat label="Niederlagen" value={String(profile.losses)} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900/50 py-2">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition-colors ${
        active ? 'bg-yellow-500 text-slate-900' : 'border border-slate-700 text-slate-300 hover:border-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function LadderTab() {
  const profile = useLeagueStore((s) => s.profile)!
  const ladder = useLeagueStore((s) => s.ladder)()
  const rank = useLeagueStore((s) => s.rank)()
  const endSeason = useLeagueStore((s) => s.endSeason)
  const lastResult = useLeagueStore((s) => s.lastResult)
  const lastEloDelta = useLeagueStore((s) => s.lastEloDelta)
  const clearResult = useLeagueStore((s) => s.clearResult)
  const startRankedGame = useGameStore((s) => s.startRankedGame)
  const starting = useGameStore((s) => s.starting)

  const region = REGIONS[profile.regionIndex]
  const badge = region.badges[profile.arenaIndex]

  return (
    <div className="flex flex-col gap-4">
      {lastResult && <SeasonBanner onClose={clearResult} />}

      <PvpSection />

      <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Aktuelle Arena</p>
            <p className="text-lg font-bold text-white">
              {badge.name} <span className="text-sm font-normal text-slate-400">· {badge.leader}</span>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${TYPE_COLOR[badge.themeType]}`}>
            {badge.gymType}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Platz <span className="font-bold text-white">{rank}</span> von {LADDER_SIZE} ·{' '}
          {rank <= PROMOTION_SLOTS ? (
            <span className="text-emerald-400">Aufstiegsplatz — Orden in Reichweite!</span>
          ) : rank > LADDER_SIZE - RELEGATION_SLOTS ? (
            <span className="text-red-400">Abstiegszone</span>
          ) : (
            <span className="text-slate-300">Mittelfeld</span>
          )}
        </p>
        {lastEloDelta !== null && (
          <p className="mt-1 text-sm">
            Letztes Match:{' '}
            <span className={lastEloDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {lastEloDelta >= 0 ? '+' : ''}
              {lastEloDelta} Elo
            </span>
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-1">
        {ladder.map((entry, i) => {
          const pos = i + 1
          const zone =
            pos <= PROMOTION_SLOTS ? 'border-l-emerald-500' : pos > LADDER_SIZE - RELEGATION_SLOTS ? 'border-l-red-500' : 'border-l-slate-700'
          return (
            <li
              key={entry.id}
              className={`flex items-center gap-3 rounded-lg border-l-4 ${zone} px-3 py-2 ${
                entry.isPlayer ? 'bg-yellow-500/15 ring-1 ring-yellow-500/40' : 'bg-slate-800/40'
              }`}
            >
              <span className="w-6 text-right font-mono text-sm text-slate-400">{pos}</span>
              <span className={`flex-1 font-semibold ${entry.isPlayer ? 'text-yellow-300' : 'text-slate-200'}`}>
                {entry.handle}
                {entry.isPlayer && ' (du)'}
              </span>
              <span className="font-mono text-sm text-slate-300">{entry.seasonPoints} P</span>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={starting}
          onClick={startRankedGame}
          className="flex-1 rounded-full bg-yellow-500 px-6 py-3 font-bold text-slate-900 shadow hover:bg-yellow-400 disabled:opacity-40"
        >
          ⚔️ Ranglisten-Match gegen {badge.leader}
        </button>
        <button
          type="button"
          onClick={endSeason}
          className="rounded-full border border-slate-600 px-6 py-3 font-bold text-slate-200 hover:border-slate-400"
        >
          🏁 Saison werten
        </button>
      </div>
      <p className="text-center text-xs text-slate-500">
        Gewinne Matches, um Season-Punkte zu sammeln. Beim Werten der Saison steigen die Top {PROMOTION_SLOTS} auf und
        erhalten den Orden.
      </p>
    </div>
  )
}

function PvpSection() {
  const available = useAuthStore((s) => s.available)
  const user = useAuthStore((s) => s.user)
  const findRankedMatch = useGameStore((s) => s.findRankedMatch)
  const cancelMatchmaking = useGameStore((s) => s.cancelMatchmaking)
  const mmStatus = useGameStore((s) => s.mmStatus)
  const mmError = useGameStore((s) => s.mmError)

  if (!available) return null

  return (
    <div className="rounded-2xl border border-sky-700/50 bg-sky-500/10 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-white">🌐 Gewertetes PvP</p>
          <p className="text-xs text-slate-300">Echte Gegner · serverautoritatives Elo · geteilte Bestenliste</p>
        </div>
        {mmStatus === 'searching' ? (
          <button
            type="button"
            onClick={() => void cancelMatchmaking()}
            className="rounded-full border border-slate-500 px-4 py-2 text-sm font-bold text-slate-200 hover:border-slate-300"
          >
            Suche abbrechen
          </button>
        ) : (
          <button
            type="button"
            disabled={!user}
            onClick={() => void findRankedMatch()}
            className="rounded-full bg-sky-500 px-5 py-2 font-bold text-white shadow hover:bg-sky-400 disabled:opacity-40"
          >
            Gegner suchen
          </button>
        )}
      </div>
      {mmStatus === 'searching' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-sky-200">
          <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" /> Suche nach einem Gegner … du kannst warten
          oder abbrechen.
        </p>
      )}
      {!user && <p className="mt-2 text-xs text-amber-300">Zum gewerteten Spielen bitte oben anmelden oder registrieren.</p>}
      {mmError && <p className="mt-2 text-xs text-amber-400">{mmError}</p>}
    </div>
  )
}

function SeasonBanner({ onClose }: { onClose: () => void }) {
  const result = useLeagueStore((s) => s.lastResult)!
  const tone = result.promoted ? 'border-emerald-500 bg-emerald-500/15' : result.relegated ? 'border-red-500 bg-red-500/15' : 'border-slate-600 bg-slate-800/60'
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-black text-white">
            {result.promoted ? '🎉 Aufstieg!' : result.relegated ? '⬇️ Abstieg' : 'Saison gewertet'}
          </p>
          <p className="mt-1 text-sm text-slate-200">
            Endplatz {result.finalRank}.
            {result.badgeAwarded && ` Du hast den ${result.badgeAwarded.name} erhalten!`}
            {result.regionCompleted && ' Region abgeschlossen – neue Division!'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
          ✕
        </button>
      </div>
    </div>
  )
}

function BadgesTab() {
  const profile = useLeagueStore((s) => s.profile)!
  const earned = useMemo(() => new Set(profile.earnedBadges.map((b) => b.badgeId)), [profile.earnedBadges])
  return (
    <div className="flex flex-col gap-4">
      {REGIONS.map((region) => {
        const count = region.badges.filter((b) => earned.has(b.id)).length
        const current = region.index === profile.regionIndex
        return (
          <div key={region.id} className="rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold text-white">
                Division {region.index + 1} · {region.name}
                {current && <span className="ml-2 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] text-yellow-300">aktuell</span>}
              </p>
              <span className="text-xs text-slate-400">
                {count}/{region.badges.length}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {region.badges.map((b) => {
                const has = earned.has(b.id)
                return (
                  <div
                    key={b.id}
                    title={`${b.name} · ${b.leader}`}
                    className={`flex aspect-square flex-col items-center justify-center rounded-lg text-center text-[9px] leading-tight ${
                      has ? `${TYPE_COLOR[b.themeType]} text-white shadow` : 'bg-slate-900/60 text-slate-600 grayscale'
                    }`}
                  >
                    <span className="text-base">{has ? '🎖' : '🔒'}</span>
                    <span className="px-0.5">{b.name.replace('orden', '').replace(' Z', '')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LeaderboardTab() {
  const rows = useLeagueStore((s) => s.leaderboard)
  const loading = useLeagueStore((s) => s.loadingLeaderboard)
  const refresh = useLeagueStore((s) => s.refreshLeaderboard)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-bold text-white">🌍 Globale Bestenliste</p>
        <button type="button" onClick={() => void refresh()} className="text-xs text-slate-400 hover:text-slate-200">
          ↻ Aktualisieren
        </button>
      </div>
      {loading && rows.length === 0 ? (
        <p className="text-sm text-slate-400">Lädt…</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {rows.map((row, i) => (
            <li
              key={`${row.handle}-${i}`}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                row.isPlayer ? 'bg-yellow-500/15 ring-1 ring-yellow-500/40' : 'bg-slate-900/40'
              }`}
            >
              <span className="w-6 text-right font-mono text-sm text-slate-400">{i + 1}</span>
              <span className={`flex-1 font-semibold ${row.isPlayer ? 'text-yellow-300' : 'text-slate-200'}`}>
                {row.handle}
                {row.isPlayer && ' (du)'}
              </span>
              <span className="text-xs text-slate-400">{REGIONS[row.regionIndex]?.name}</span>
              <span className="w-10 text-right text-xs text-slate-400">🎖{row.badges}</span>
              <span className="w-14 text-right font-mono text-sm text-yellow-400">{row.careerElo}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
