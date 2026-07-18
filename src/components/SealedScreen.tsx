import { useEffect, useMemo, useState } from 'react'
import { loadPackSets, type TcgSet } from '../api/sets'
import { loadSetPool } from '../game/packs'
import { SEALED_DECK_SIZE, SEALED_PACK_COUNT, buildSealedDeck, openSealedPool } from '../game/sealed'
import { useGameStore } from '../store/gameStore'
import type { CardDef } from '../game/types'
import { CardView } from './CardView'
import { CardZoomModal } from './CardZoomModal'

interface GroupedCard {
  card: CardDef
  count: number
}

/** Fasst Kartenlisten für die Anzeige nach Karten-ID zusammen. */
function groupById(cards: CardDef[]): GroupedCard[] {
  const map = new Map<string, GroupedCard>()
  for (const c of cards) {
    const existing = map.get(c.id)
    if (existing) existing.count += 1
    else map.set(c.id, { card: c, count: 1 })
  }
  return [...map.values()].sort((a, b) => a.card.name.localeCompare(b.card.name))
}

export function SealedScreen({ onBack }: { onBack: () => void }) {
  const [sets, setSets] = useState<TcgSet[]>([])
  const [selected, setSelected] = useState<TcgSet | null>(null)
  const [pool, setPool] = useState<CardDef[] | null>(null)
  const [deck, setDeck] = useState<CardDef[] | null>(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoomCard, setZoomCard] = useState<CardDef | null>(null)

  const starting = useGameStore((s) => s.starting)
  const startError = useGameStore((s) => s.startError)
  const startSealedGame = useGameStore((s) => s.startSealedGame)

  useEffect(() => {
    loadPackSets().then((s) => {
      setSets(s)
      setSelected((cur) => cur ?? s[0] ?? null)
    })
  }, [])

  async function handleOpen() {
    if (!selected || opening) return
    setOpening(true)
    setError(null)
    try {
      const setCardPool = await loadSetPool(selected)
      const sealed = openSealedPool(setCardPool)
      setPool(sealed)
      setDeck(buildSealedDeck(sealed))
    } catch {
      setError('Sealed-Pool konnte nicht geöffnet werden.')
    } finally {
      setOpening(false)
    }
  }

  const poolGroups = useMemo(() => (pool ? groupById(pool.filter((c) => c.kind !== 'energy')) : []), [pool])
  const deckGroups = useMemo(() => (deck ? groupById(deck) : []), [deck])

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 p-3 sm:p-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-white">
          ← Menü
        </button>
        <h1 className="text-xl font-bold text-white">Sealed-Duell</h1>
        <div />
      </div>

      <p className="rounded-xl bg-black/20 p-3 text-xs text-slate-300">
        Öffne {SEALED_PACK_COUNT} Packs, aus denen automatisch ein legales {SEALED_DECK_SIZE}-Karten-Deck gebaut
        wird (Basis-Energie wird frei gestellt). Tritt damit gegen einen gleichwertigen Sealed-Gegner an – deine
        Sammlung bleibt unberührt.
      </p>

      {!pool && (
        <>
          <div>
            <h2 className="mb-2 text-sm font-bold text-slate-300">Set wählen</h2>
            <div className="flex flex-wrap gap-3">
              {sets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
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
          <button
            disabled={!selected || opening}
            onClick={handleOpen}
            className="self-center rounded-full bg-yellow-500 px-6 py-3 font-bold text-slate-900 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {opening ? 'Öffne Packs…' : `🎴 ${SEALED_PACK_COUNT} Packs öffnen`}
          </button>
          {error && <p className="text-center text-sm text-amber-400">{error}</p>}
        </>
      )}

      {pool && deck && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 p-3">
            <span className="text-sm font-bold text-slate-200">
              Auto-Deck: {deck.length}/{SEALED_DECK_SIZE}
            </span>
            <button
              onClick={() => setDeck(buildSealedDeck(pool))}
              className="rounded-full border border-slate-600 px-4 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              🎲 Deck neu würfeln
            </button>
            <button
              disabled={starting}
              onClick={() => startSealedGame(deck)}
              className="rounded-full bg-yellow-500 px-5 py-1.5 text-xs font-bold text-slate-900 hover:bg-yellow-400 disabled:opacity-40"
            >
              {starting ? 'Starte…' : 'Duell starten'}
            </button>
            <button
              onClick={() => {
                setPool(null)
                setDeck(null)
              }}
              className="ml-auto rounded-full border border-slate-600 px-4 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              Neu öffnen
            </button>
          </div>
          {startError && <p className="text-sm text-amber-400">{startError}</p>}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-300">Auto-Deck</h2>
              <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto rounded-lg bg-black/20 p-2 sm:grid-cols-4">
                {deckGroups.map((g) => (
                  <div key={g.card.id} className="flex flex-col items-center gap-1">
                    <CardView card={g.card} size="sm" onZoom={() => setZoomCard(g.card)} />
                    <span className="text-[9px] text-slate-400">{g.count}x</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-300">Geöffneter Pool (Pokémon &amp; Trainer)</h2>
              <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto rounded-lg bg-black/20 p-2 sm:grid-cols-4">
                {poolGroups.map((g) => (
                  <div key={g.card.id} className="flex flex-col items-center gap-1">
                    <CardView card={g.card} size="sm" onZoom={() => setZoomCard(g.card)} />
                    <span className="text-[9px] text-slate-400">{g.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
    </div>
  )
}
