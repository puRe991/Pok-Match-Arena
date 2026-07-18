import { useEffect, useState } from 'react'
import { rankForRating } from '../profile/profile'
import { useGameStore, isMyTurn } from '../store/gameStore'
import { useProfileStore } from '../store/profileStore'
import type { CardDef, Side } from '../game/types'
import { PlayerSide } from './PlayerSide'
import { HandView } from './HandView'
import { AttackPanel } from './AttackPanel'
import { GameLog } from './GameLog'
import { BoardPokemon } from './BoardPokemon'
import { CardZoomModal } from './CardZoomModal'
import { CardView } from './CardView'

function other(side: Side): Side {
  return side === 'p1' ? 'p2' : 'p1'
}

export function GameBoard() {
  const gameState = useGameStore((s) => s.gameState)
  const dispatch = useGameStore((s) => s.dispatch)
  const backToMenu = useGameStore((s) => s.backToMenu)
  const opponentProfile = useGameStore((s) => s.opponentProfile)
  const myAvatarId = useProfileStore((s) => s.avatarId)
  const myRating = useProfileStore((s) => s.stats.rating)
  const lastMatch = useProfileStore((s) => s.matchHistory[0])
  const prizeCard = useGameStore((s) => s.prizeCard)
  const prizeLoading = useGameStore((s) => s.prizeLoading)
  const [pendingCard, setPendingCard] = useState<CardDef | null>(null)
  const [zoomCard, setZoomCard] = useState<CardDef | null>(null)
  const [shakeId, setShakeId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!gameState?.lastEvent) return
    const ev = gameState.lastEvent
    if (ev.type === 'attack') {
      const targetSide = other(ev.side)
      const targetId = gameState.players[targetSide].active?.instanceId ?? null
      setShakeId(targetId)
      setToast(`${ev.damage} Schaden${ev.superEffective ? ' — Super effektiv!' : ''}`)
      const t1 = setTimeout(() => setShakeId(null), 500)
      const t2 = setTimeout(() => setToast(null), 1400)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    if (ev.type === 'status') {
      const labels: Record<string, string> = {
        poisoned: 'Vergiftet ☠️',
        burned: 'Verbrannt 🔥',
        asleep: 'Eingeschlafen 💤',
        paralyzed: 'Paralysiert ⚡',
        confused: 'Verwirrt ❓',
      }
      setToast(labels[ev.status] ?? ev.status)
      const t = setTimeout(() => setToast(null), 1400)
      return () => clearTimeout(t)
    }
  }, [gameState?.lastEvent, gameState?.players])

  if (!gameState) return null

  const mySide = gameState.mySide
  const oppSide = other(mySide)
  const me = gameState.players[mySide]
  const opp = gameState.players[oppSide]
  const myTurn = isMyTurn(gameState)
  const iNeedPromote = me.active === null && gameState.phase === 'main'
  const turnNumber = gameState.turnNumber

  function clearPending() {
    setPendingCard(null)
  }

  function notify(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2400)
  }

  function evoTargets(card: CardDef): Set<string> {
    if (card.kind !== 'pokemon' || card.stage !== 'stage1') return new Set()
    const ids: string[] = []
    const all = [me.active, ...me.bench].filter((m): m is NonNullable<typeof m> => !!m)
    for (const mon of all) {
      const top = mon.stages[mon.stages.length - 1]
      if (top.name === card.evolvesFrom && mon.enteredPlayTurn !== turnNumber) {
        ids.push(mon.instanceId)
      }
    }
    return new Set(ids)
  }

  function energyTargets(): Set<string> {
    const all = [me.active, ...me.bench].filter((m): m is NonNullable<typeof m> => !!m)
    return new Set(all.map((m) => m.instanceId))
  }

  function retreatTargets(): Set<string> {
    if (!myTurn || !me.active || me.hasRetreatedThisTurn) return new Set()
    const top = me.active.stages[me.active.stages.length - 1]
    if (me.active.attachedEnergy.length < top.retreatCost) return new Set()
    return new Set(me.bench.map((m) => m.instanceId))
  }

  const selectableIds = pendingCard
    ? pendingCard.kind === 'energy'
      ? energyTargets()
      : evoTargets(pendingCard)
    : retreatTargets()

  function handleHandCardClick(card: CardDef) {
    if (pendingCard?.uid === card.uid) {
      clearPending()
      return
    }
    const reason = playableReason(card)
    if (reason) {
      notify(reason)
      return
    }
    if (card.kind === 'pokemon' && card.stage === 'basic') {
      dispatch({ type: 'PLAY_BENCH', side: mySide, handUid: card.uid })
      return
    }
    setPendingCard(card)
  }

  function handleBoardSelect(instanceId: string) {
    if (!myTurn || iNeedPromote) return
    if (pendingCard) {
      if (pendingCard.kind === 'energy') {
        dispatch({ type: 'ATTACH_ENERGY', side: mySide, handUid: pendingCard.uid, targetInstanceId: instanceId })
      } else {
        dispatch({ type: 'EVOLVE', side: mySide, handUid: pendingCard.uid, targetInstanceId: instanceId })
      }
      clearPending()
      return
    }
    dispatch({ type: 'RETREAT', side: mySide, benchInstanceId: instanceId })
  }

  // Returns null when the card can be played right now, otherwise a German
  // explanation of why it is currently blocked.
  function playableReason(card: CardDef): string | null {
    if (!myTurn) return 'Du bist gerade nicht am Zug.'
    if (iNeedPromote) return 'Wähle zuerst ein neues aktives Pokémon von deiner Bank.'
    if (card.kind === 'pokemon' && card.stage === 'basic') {
      if (me.bench.length >= 5) return 'Deine Bank ist voll (max. 5 Pokémon).'
      return null
    }
    if (card.kind === 'pokemon' && card.stage === 'stage1') {
      if (evoTargets(card).size === 0)
        return `Kein ${card.evolvesFrom ?? 'passendes Pokémon'} im Spiel, das sich jetzt entwickeln kann (nicht im selben Zug gelegt).`
      return null
    }
    if (card.kind === 'pokemon' && card.stage === 'stage2')
      return 'Stufe-2-Entwicklungen sind noch nicht spielbar.'
    if (card.kind === 'energy') {
      if (me.hasAttachedEnergyThisTurn) return 'Du hast in diesem Zug schon eine Energie angelegt (nur 1 pro Zug).'
      return null
    }
    if (card.kind === 'trainer') return 'Trainer-Karten sind noch nicht spielbar.'
    return 'Diese Karte kann gerade nicht gespielt werden.'
  }

  const playableUids = new Set(me.hand.filter((c) => playableReason(c) === null).map((c) => c.uid))

  if (gameState.phase === 'gameover') {
    const won = gameState.winner === mySide
    const eloResult =
      gameState.mode !== 'local' && lastMatch?.mode === 'multiplayer' && lastMatch.ratingAfter !== null
        ? lastMatch
        : null
    const newRank = eloResult ? rankForRating(eloResult.ratingAfter!) : null
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className={`text-4xl font-black ${won ? 'text-yellow-300' : 'text-slate-400'}`}>
          {won ? 'Sieg!' : 'Niederlage'}
        </h1>
        <p className="max-w-md text-slate-300">{gameState.winnerReason}</p>
        {won && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 px-6 py-4">
            <span className="text-sm font-bold uppercase tracking-wide text-yellow-300">🎁 Preis erhalten!</span>
            {prizeCard ? (
              <>
                <CardView card={prizeCard} size="lg" onZoom={() => setZoomCard(prizeCard)} />
                <span className="text-sm font-semibold text-white">{prizeCard.name}</span>
                <span className="text-xs text-slate-400">Wurde deiner Sammlung hinzugefügt.</span>
              </>
            ) : (
              <div className="flex h-40 w-28 items-center justify-center rounded-lg border-2 border-dashed border-yellow-500/40 text-xs text-slate-400 sm:w-40">
                {prizeLoading ? 'Karte wird gezogen…' : 'Keine Karte verfügbar'}
              </div>
            )}
          </div>
        )}
        {eloResult && newRank && (
          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-5 py-2 text-sm font-bold">
            <span className={eloResult.ratingDelta >= 0 ? 'text-green-400' : 'text-red-400'}>
              {eloResult.ratingDelta >= 0 ? '+' : ''}
              {eloResult.ratingDelta} Elo
            </span>
            <span className="text-slate-500">→</span>
            <span className="text-white">{eloResult.ratingAfter}</span>
            <span className={newRank.colorClass}>
              {newRank.icon} {newRank.label}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={backToMenu}
          className="rounded-full bg-sky-500 px-6 py-2 font-bold text-white hover:bg-sky-400"
        >
          Zurück zum Menü
        </button>
        <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-2 p-2 sm:p-4">
      <div className="flex items-center justify-between">
        <button onClick={backToMenu} className="text-xs text-slate-400 hover:text-white">
          ← Menü
        </button>
        <span className="text-xs text-slate-500">Zug {gameState.turnNumber}</span>
      </div>

      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 animate-float-up rounded-full bg-black/80 px-4 py-1.5 text-sm font-bold text-yellow-300 shadow-lg">
          {toast}
        </div>
      )}

      <PlayerSide
        player={opp}
        isTurn={gameState.activeSide === oppSide}
        selectableIds={new Set()}
        onSelectMon={() => {}}
        shakeInstanceId={shakeId}
        showHandCount
        profileBadge={
          gameState.mode !== 'local' && opponentProfile
            ? { avatarId: opponentProfile.avatarId, rating: opponentProfile.rating }
            : null
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
        <div className="order-2 sm:order-1">
          <PlayerSide
            player={me}
            reversed
            isTurn={gameState.activeSide === mySide}
            selectableIds={selectableIds}
            selectedId={null}
            onSelectMon={handleBoardSelect}
            shakeInstanceId={shakeId}
            showHandCount={false}
            profileBadge={{ avatarId: myAvatarId, rating: myRating }}
          />
        </div>
        <div className="order-1 flex flex-col gap-2 sm:order-2">
          <GameLog entries={gameState.log} />
          {me.active && (
            <AttackPanel
              mon={me.active}
              turnNumber={gameState.turnNumber}
              disabled={!myTurn || !!pendingCard || iNeedPromote}
              onAttack={(idx) => dispatch({ type: 'ATTACK', side: mySide, attackIndex: idx })}
            />
          )}
          <button
            type="button"
            disabled={!myTurn || iNeedPromote || !me.active}
            onClick={() => dispatch({ type: 'END_TURN', side: mySide })}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-bold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Zug beenden
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-black/20 pb-1">
        {pendingCard && (
          <div className="flex items-center justify-between px-3 py-1 text-xs text-sky-300">
            <span>
              {pendingCard.kind === 'pokemon'
                ? `Wähle ein ${pendingCard.evolvesFrom} zum Entwickeln.`
                : 'Wähle ein Pokémon für die Energie.'}
            </span>
            <button onClick={clearPending} className="text-slate-400 hover:text-white">
              Abbrechen
            </button>
          </div>
        )}
        <HandView cards={me.hand} playableUids={playableUids} onCardClick={handleHandCardClick} selectedUid={pendingCard?.uid} onZoom={setZoomCard} />
      </div>

      {iNeedPromote && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-slate-900 p-6">
            <h2 className="text-lg font-bold text-white">Dein Pokémon wurde kampfunfähig!</h2>
            <p className="text-sm text-slate-400">Wähle ein neues aktives Pokémon von deiner Bank.</p>
            <div className="flex flex-wrap justify-center gap-3">
              {me.bench.map((mon) => (
                <BoardPokemon
                  key={mon.instanceId}
                  mon={mon}
                  selectable
                  onClick={() => dispatch({ type: 'PROMOTE', side: mySide, benchInstanceId: mon.instanceId })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <CardZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />
    </div>
  )
}
