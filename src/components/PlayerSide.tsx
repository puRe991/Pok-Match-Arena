import clsx from 'clsx'
import type { PlayerState } from '../game/types'
import { BoardPokemon } from './BoardPokemon'
import { CardBack } from './CardView'

interface PileBadgeProps {
  label: string
  count: number
}

function PileBadge({ label, count }: PileBadgeProps) {
  return (
    <div className="flex flex-col items-center">
      <CardBack size="sm" />
      <span className="mt-0.5 text-[10px] text-slate-400">
        {label} ({count})
      </span>
    </div>
  )
}

interface PlayerSideProps {
  player: PlayerState
  reversed?: boolean
  isTurn: boolean
  selectableIds: Set<string>
  selectedId?: string | null
  onSelectMon: (instanceId: string) => void
  flashInstanceId?: string | null
  shakeInstanceId?: string | null
  showHandCount?: boolean
}

export function PlayerSide({
  player,
  reversed,
  isTurn,
  selectableIds,
  selectedId,
  onSelectMon,
  flashInstanceId,
  shakeInstanceId,
  showHandCount,
}: PlayerSideProps) {
  const activeBlock = player.active ? (
    <BoardPokemon
      mon={player.active}
      active
      selectable={selectableIds.has(player.active.instanceId)}
      selected={selectedId === player.active.instanceId}
      onClick={
        selectableIds.has(player.active.instanceId) ? () => onSelectMon(player.active!.instanceId) : undefined
      }
      flash={flashInstanceId === player.active.instanceId}
      shake={shakeInstanceId === player.active.instanceId}
    />
  ) : (
    <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-[10px] text-slate-500 sm:h-28 sm:w-28">
      Kein aktives Pokémon
    </div>
  )

  const benchBlock = (
    <div className="flex flex-wrap justify-center gap-1.5">
      {player.bench.map((mon) => (
        <BoardPokemon
          key={mon.instanceId}
          mon={mon}
          selectable={selectableIds.has(mon.instanceId)}
          selected={selectedId === mon.instanceId}
          onClick={selectableIds.has(mon.instanceId) ? () => onSelectMon(mon.instanceId) : undefined}
          flash={flashInstanceId === mon.instanceId}
          shake={shakeInstanceId === mon.instanceId}
        />
      ))}
      {Array.from({ length: Math.max(0, 5 - player.bench.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="h-16 w-16 rounded-lg border border-dashed border-slate-700 sm:h-20 sm:w-20"
        />
      ))}
    </div>
  )

  return (
    <div className={clsx('flex w-full flex-col items-center gap-2 rounded-2xl p-2 sm:p-3', isTurn && 'bg-white/5')}>
      <div className="flex w-full items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={clsx('font-bold', isTurn && 'text-yellow-300')}>{player.name}</span>
          {isTurn && (
            <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
              Am Zug
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showHandCount && (
            <div className="flex items-center gap-1">
              <CardBack size="sm" />
              <span className="text-[10px] text-slate-400">Hand ({player.hand.length})</span>
            </div>
          )}
          <PileBadge label="Deck" count={player.deck.length} />
          <PileBadge label="Ablage" count={player.discard.length} />
        </div>
      </div>
      <div className={clsx('flex w-full flex-col items-center gap-2', reversed && 'flex-col-reverse')}>
        {benchBlock}
        {activeBlock}
      </div>
    </div>
  )
}
