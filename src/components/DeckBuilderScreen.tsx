import { useMemo, useState } from 'react'
import { useCollectionStore } from '../store/collectionStore'
import { cardLimit, validateDeck } from '../game/deckLegality'
import { isDeckLegal } from '../game/normalize'
import type { CardDef } from '../game/types'
import { CardView } from './CardView'

function kindLabel(card: CardDef): string {
  if (card.kind === 'pokemon') return card.pokemonType
  if (card.kind === 'energy') return card.isBasicEnergy ? 'Energie' : 'Spezial-Energie'
  return 'Trainer'
}

export function DeckBuilderScreen({ onBack }: { onBack: () => void }) {
  const decks = useCollectionStore((s) => s.decks)
  const collection = useCollectionStore((s) => s.collection)
  const activeDeckId = useCollectionStore((s) => s.activeDeckId)
  const createDeck = useCollectionStore((s) => s.createDeck)
  const updateDeck = useCollectionStore((s) => s.updateDeck)
  const deleteDeck = useCollectionStore((s) => s.deleteDeck)
  const renameDeck = useCollectionStore((s) => s.renameDeck)
  const setActiveDeck = useCollectionStore((s) => s.setActiveDeck)

  const [editingId, setEditingId] = useState<string | null>(decks[0]?.id ?? null)
  const [draft, setDraft] = useState<Record<string, number>>(decks[0]?.cardCounts ?? {})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pokemon' | 'energy'>('all')

  const editingDeck = decks.find((d) => d.id === editingId)

  function selectDeck(id: string) {
    const deck = decks.find((d) => d.id === id)
    setEditingId(id)
    setDraft(deck?.cardCounts ?? {})
  }

  function handleCreate() {
    const id = createDeck(`Deck ${decks.length + 1}`)
    setEditingId(id)
    setDraft({})
  }

  function addCard(id: string) {
    setDraft((d) => ({ ...d, [id]: (d[id] ?? 0) + 1 }))
  }
  function removeCard(id: string) {
    setDraft((d) => {
      const next = { ...d }
      if (!next[id]) return next
      next[id] -= 1
      if (next[id] <= 0) delete next[id]
      return next
    })
  }

  function save() {
    if (!editingId) return
    updateDeck(editingId, draft)
  }

  const collectionList = useMemo(() => {
    return Object.values(collection)
      .filter((entry) => isDeckLegal(entry.card))
      .filter((entry) => (filter === 'all' ? true : entry.card.kind === filter))
      .filter((entry) => entry.card.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.card.name.localeCompare(b.card.name))
  }, [collection, filter, search])

  const validation = editingDeck ? validateDeck({ cardCounts: draft }, collection) : null
  const deckEntries = Object.entries(draft)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count, card: collection[id]?.card }))
    .filter((e): e is { id: string; count: number; card: CardDef } => !!e.card)
    .sort((a, b) => a.card.name.localeCompare(b.card.name))

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-3 sm:p-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-white">
          ← Menü
        </button>
        <h1 className="text-xl font-bold text-white">Deck-Builder</h1>
        <div />
      </div>

      <div className="flex flex-wrap gap-2">
        {decks.map((d) => (
          <button
            key={d.id}
            onClick={() => selectDeck(d.id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              editingId === d.id ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-700 text-slate-300'
            }`}
          >
            {d.name} {activeDeckId === d.id && '★'}
          </button>
        ))}
        <button onClick={handleCreate} className="rounded-full border border-dashed border-slate-600 px-3 py-1 text-xs text-slate-400 hover:text-white">
          + Neues Deck
        </button>
      </div>

      {!editingDeck ? (
        <p className="text-sm text-slate-500">Wähle oder erstelle ein Deck.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 p-3">
            <input
              defaultValue={editingDeck.name}
              onBlur={(e) => renameDeck(editingDeck.id, e.target.value || editingDeck.name)}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white outline-none focus:border-sky-400"
            />
            <span className={`text-sm font-bold ${validation?.valid ? 'text-green-400' : 'text-amber-400'}`}>
              {validation?.total ?? 0}/60
            </span>
            <button
              onClick={save}
              className="rounded-full bg-sky-600 px-4 py-1 text-xs font-bold text-white hover:bg-sky-500"
            >
              Speichern
            </button>
            <button
              disabled={!validation?.valid}
              onClick={() => {
                save()
                setActiveDeck(editingDeck.id)
              }}
              className="rounded-full bg-yellow-500 px-4 py-1 text-xs font-bold text-slate-900 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Als aktiv setzen
            </button>
            <button
              onClick={() => {
                deleteDeck(editingDeck.id)
                setEditingId(decks[0]?.id ?? null)
              }}
              className="ml-auto rounded-full border border-red-500/50 px-4 py-1 text-xs font-bold text-red-300 hover:bg-red-500/10"
            >
              Löschen
            </button>
          </div>

          {validation && !validation.valid && (
            <ul className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-300">
              {validation.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-300">Sammlung</h2>
              <div className="mb-2 flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suche…"
                  className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white outline-none focus:border-sky-400"
                />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white"
                >
                  <option value="all">Alle</option>
                  <option value="pokemon">Pokémon</option>
                  <option value="energy">Energie</option>
                </select>
              </div>
              <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto rounded-lg bg-black/20 p-2 sm:grid-cols-4">
                {collectionList.map((entry) => {
                  const used = draft[entry.card.id] ?? 0
                  const limit = cardLimit(entry.card)
                  const canAdd = used < entry.count && used < limit
                  return (
                    <div key={entry.card.id} className="flex flex-col items-center gap-1">
                      <CardView card={entry.card} size="sm" onClick={canAdd ? () => addCard(entry.card.id) : undefined} dimmed={!canAdd} />
                      <span className="text-[9px] text-slate-400">
                        {used}/{entry.count} {kindLabel(entry.card)}
                      </span>
                    </div>
                  )
                })}
                {collectionList.length === 0 && (
                  <p className="col-span-full py-6 text-center text-xs text-slate-500">
                    Keine Karten gefunden — öffne Packs, um Karten zu sammeln.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-bold text-slate-300">Dein Deck</h2>
              <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto rounded-lg bg-black/20 p-2 sm:grid-cols-4">
                {deckEntries.map((entry) => (
                  <div key={entry.id} className="flex flex-col items-center gap-1">
                    <CardView card={entry.card} size="sm" onClick={() => removeCard(entry.id)} />
                    <span className="text-[9px] text-slate-400">{entry.count}x</span>
                  </div>
                ))}
                {deckEntries.length === 0 && (
                  <p className="col-span-full py-6 text-center text-xs text-slate-500">
                    Noch keine Karten im Deck — klicke links auf Karten, um sie hinzuzufügen.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
