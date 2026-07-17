import { useGameStore } from '../store/gameStore'
import { BENCH_SIZE } from '../game/constants'
import { BoardPokemon } from './BoardPokemon'
import { CardView } from './CardView'

export function SetupScreen() {
  const gameState = useGameStore((s) => s.gameState)
  const dispatch = useGameStore((s) => s.dispatch)
  if (!gameState) return null

  const me = gameState.players[gameState.mySide]
  const opponentSide = gameState.mySide === 'p1' ? 'p2' : 'p1'
  const opponent = gameState.players[opponentSide]
  const myReady = gameState.setupReady[gameState.mySide]

  const basicsInHand = me.hand.filter((c) => c.kind === 'pokemon' && c.stage === 'basic')

  function handleCardClick(uid: string) {
    if (myReady) return
    if (!me.active) {
      dispatch({ type: 'SETUP_PLACE_ACTIVE', side: gameState!.mySide, handUid: uid })
    } else if (me.bench.length < BENCH_SIZE) {
      dispatch({ type: 'SETUP_PLACE_BENCH', side: gameState!.mySide, handUid: uid })
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 p-4 sm:p-8">
      <h1 className="text-center text-2xl font-bold text-white">Vorbereitung</h1>
      <p className="max-w-lg text-center text-sm text-slate-400">
        Wähle dein aktives Pokémon (erster Klick) und lege optional weitere Basis-Pokémon auf die Bank. Wenn du
        fertig bist, klicke auf „Bereit“.
      </p>

      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
        <span className="text-xs uppercase tracking-wide text-slate-400">Aktiv</span>
        {me.active ? (
          <BoardPokemon mon={me.active} active />
        ) : (
          <div className="flex h-28 w-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-[10px] text-slate-500">
            Wähle unten eine Basis-Karte
          </div>
        )}
        <span className="text-xs uppercase tracking-wide text-slate-400">
          Bank ({me.bench.length}/{BENCH_SIZE})
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {me.bench.map((mon) => (
            <BoardPokemon key={mon.instanceId} mon={mon} />
          ))}
          {me.bench.length === 0 && <span className="text-[11px] text-slate-500">leer</span>}
        </div>
      </div>

      <div className="w-full">
        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Deine Hand</span>
        <div className="flex flex-wrap justify-center gap-2">
          {me.hand.map((card) => {
            const isBasic = card.kind === 'pokemon' && card.stage === 'basic'
            const canPlace = isBasic && !myReady && (!me.active || me.bench.length < BENCH_SIZE)
            return (
              <CardView
                key={card.uid}
                card={card}
                size="md"
                dimmed={!canPlace}
                onClick={canPlace ? () => handleCardClick(card.uid) : undefined}
              />
            )
          })}
        </div>
        {basicsInHand.length === 0 && !me.active && (
          <p className="mt-2 text-center text-xs text-red-400">
            Keine Basis-Pokémon auf der Hand — du kannst trotzdem auf „Bereit“ klicken (Sonderfall).
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!me.active || myReady}
        onClick={() => dispatch({ type: 'SETUP_READY', side: gameState.mySide })}
        className="rounded-full bg-yellow-500 px-8 py-2 font-bold text-slate-900 shadow transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {myReady ? 'Warte auf Gegner…' : 'Bereit'}
      </button>
      <p className="text-xs text-slate-500">
        Gegner: {opponent.isAI ? 'CPU' : opponent.name} — {gameState.setupReady[opponentSide] ? 'bereit ✅' : 'wählt noch…'}
      </p>
    </div>
  )
}
