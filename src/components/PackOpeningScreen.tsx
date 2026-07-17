import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { loadPackSets, type TcgSet } from '../api/sets'
import { DAILY_FREE_PACKS, formatTimeUntilReset, remainingFreePacks } from '../game/dailyPacks'
import { useCollectionStore } from '../store/collectionStore'
import type { CardDef } from '../game/types'

function RevealedCard({ card, index }: { card: CardDef; index: number }) {
  const isHolo = card.rarity === 'Holo Rare'
  const isRare = card.rarity === 'Rare' || isHolo
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0, scale: 0.7 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.18, duration: 0.5, ease: 'easeOut' }}
      style={{ transformStyle: 'preserve-3d' }}
      className="relative"
    >
      {isHolo && (
        <motion.div
          className="pointer-events-none absolute -inset-1 rounded-xl bg-gradient-to-br from-yellow-300 via-fuchsia-400 to-sky-400 opacity-70 blur-md"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ delay: index * 0.18 + 0.4, duration: 1.8, repeat: Infinity }}
        />
      )}
      <div
        className={`relative aspect-[5/7] w-full overflow-hidden rounded-lg border-2 bg-slate-800 shadow-xl ${
          isHolo ? 'border-yellow-300' : isRare ? 'border-sky-400' : 'border-slate-700'
        }`}
      >
        <img
          src={card.imageSmall}
          alt={card.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 truncate bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
          {card.name}
        </div>
        <div
          className={`absolute right-1 top-1 rounded px-1 text-[8px] font-bold text-white ${
            isHolo ? 'bg-yellow-500 text-slate-900' : isRare ? 'bg-sky-500' : 'bg-slate-600'
          }`}
        >
          {card.rarity}
        </div>
      </div>
    </motion.div>
  )
}

export function PackOpeningScreen({ onBack }: { onBack: () => void }) {
  const [sets, setSets] = useState<TcgSet[]>([])
  const [selected, setSelected] = useState<TcgSet | null>(null)
  const [opening, setOpening] = useState(false)
  const [revealed, setRevealed] = useState<CardDef[] | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const openSetPack = useCollectionStore((s) => s.openSetPack)
  const packHistory = useCollectionStore((s) => s.packHistory)
  const dailyFree = useCollectionStore((s) => s.dailyFree)

  const freeLeft = remainingFreePacks(dailyFree, now)

  useEffect(() => {
    loadPackSets().then((s) => {
      setSets(s)
      setSelected((cur) => cur ?? s[0] ?? null)
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function handleOpen() {
    if (!selected || opening || freeLeft <= 0) return
    setOpening(true)
    setRevealed(null)
    setOpenError(null)
    try {
      const cards = await openSetPack(selected)
      setRevealed(cards)
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : 'Pack konnte nicht geöffnet werden.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-white">
          ← Menü
        </button>
        <h1 className="text-xl font-bold text-white">Pack-Opening</h1>
        <div />
      </div>

      <div className="flex flex-col items-center gap-1 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-center">
        <div className="text-sm font-bold text-yellow-300">
          Tägliche Gratis-Packs: {freeLeft} / {DAILY_FREE_PACKS}
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: DAILY_FREE_PACKS }, (_, i) => (
            <span key={i} className={`text-lg ${i < freeLeft ? '' : 'opacity-25 grayscale'}`}>
              🎴
            </span>
          ))}
        </div>
        {freeLeft > 0 ? (
          <p className="text-xs text-slate-400">Öffne jeden Tag zwei kostenlose Boosterpacks!</p>
        ) : (
          <p className="text-xs text-slate-400">
            Neue Gratis-Packs in <span className="font-mono text-slate-200">{formatTimeUntilReset(now)}</span>
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-slate-300">Set wählen</h2>
        <div className="flex flex-wrap gap-3">
          {sets.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelected(s)
                setRevealed(null)
              }}
              className={`rounded-xl border-2 p-2 transition-colors ${
                selected?.id === s.id ? 'border-yellow-400 bg-yellow-400/10' : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <img src={s.logo} alt={s.name} className="h-10 w-auto object-contain" />
              <div className="mt-1 text-[10px] text-slate-400">{s.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 py-6">
        <AnimatePresence mode="wait">
          {!revealed && (
            <motion.button
              key="pack"
              type="button"
              disabled={!selected || opening || freeLeft <= 0}
              onClick={handleOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={opening ? { rotate: [0, -3, 3, -3, 3, 0] } : {}}
              transition={opening ? { duration: 0.4, repeat: Infinity } : {}}
              className="flex h-56 w-40 flex-col items-center justify-center gap-2 rounded-2xl border-4 border-yellow-400 bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 font-black text-white shadow-2xl disabled:opacity-50 disabled:grayscale"
            >
              <span className="text-3xl">🎴</span>
              <span>{opening ? 'Öffne…' : freeLeft > 0 ? 'Gratis-Pack öffnen' : 'Ausverkauft für heute'}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {openError && <p className="text-sm text-amber-400">{openError}</p>}

        {revealed && (
          <div className="w-full">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6" style={{ perspective: 800 }}>
              {revealed.map((card, i) => (
                <RevealedCard key={`${card.uid}-${i}`} card={card} index={i} />
              ))}
            </div>
            <div className="mt-6 flex justify-center gap-3">
              {freeLeft > 0 ? (
                <button
                  onClick={handleOpen}
                  className="rounded-full bg-yellow-500 px-6 py-2 font-bold text-slate-900 hover:bg-yellow-400"
                >
                  Noch ein Gratis-Pack öffnen ({freeLeft} übrig)
                </button>
              ) : (
                <p className="text-sm text-slate-400">
                  Alle Gratis-Packs für heute geöffnet – neue in{' '}
                  <span className="font-mono text-slate-200">{formatTimeUntilReset(now)}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {packHistory.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-slate-300">Verlauf</h2>
          <div className="flex flex-col gap-1 text-xs text-slate-400">
            {packHistory.slice(0, 8).map((h) => (
              <div key={h.id} className="flex justify-between rounded bg-black/20 px-2 py-1">
                <span>{h.setName}</span>
                <span>{h.cardIds.length} Karten</span>
                <span>{new Date(h.openedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
