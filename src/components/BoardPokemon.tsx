import clsx from 'clsx'
import { currentHp, topStage } from '../game/engine'
import type { InPlayPokemon } from '../game/types'
import { TypeBadge } from './CardView'

interface BoardPokemonProps {
  mon: InPlayPokemon
  active?: boolean
  selectable?: boolean
  selected?: boolean
  onClick?: () => void
  flash?: boolean
  shake?: boolean
}

export function BoardPokemon({ mon, active, selectable, selected, onClick, flash, shake }: BoardPokemonProps) {
  const top = topStage(mon)
  const hp = currentHp(mon)
  const hpPct = Math.max(0, Math.min(100, (hp / top.hp) * 100))
  const barColor = hpPct > 50 ? 'bg-green-500' : hpPct > 20 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={clsx(
        'group relative flex flex-col items-center gap-1 rounded-xl p-1 outline-none transition-all',
        active ? 'w-24 sm:w-28' : 'w-16 sm:w-20',
        selectable && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900 animate-pulse',
        selected && 'ring-2 ring-yellow-400',
        onClick && 'cursor-pointer',
        flash && 'animate-flash-ring',
        shake && 'animate-shake',
      )}
    >
      <div className="relative w-full overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-800 shadow animate-pop-in aspect-[5/7]">
        <img
          src={top.imageSmall}
          alt={top.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        {mon.stages.length > 1 && (
          <span className="absolute left-1 top-1 rounded bg-indigo-600 px-1 text-[8px] font-bold text-white">
            EVO
          </span>
        )}
      </div>
      <div className="flex w-full items-center gap-1">
        <TypeBadge type={top.pokemonType} />
        <span className="truncate text-[10px] text-slate-300">{top.name}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div className={clsx('h-full transition-all', barColor)} style={{ width: `${hpPct}%` }} />
      </div>
      <div className="text-[9px] font-mono text-slate-400">
        {hp}/{top.hp} HP
      </div>
      {mon.attachedEnergy.length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5">
          {mon.attachedEnergy.map((e, i) => (
            <span
              key={`${e.uid}-${i}`}
              className="h-3 w-3 rounded-full border border-white/30 shadow"
              style={{ background: energyColor(e.energyType) }}
              title={e.name}
            />
          ))}
        </div>
      )}
    </button>
  )
}

function energyColor(type: string): string {
  const map: Record<string, string> = {
    Fire: '#ea580c',
    Water: '#2563eb',
    Grass: '#16a34a',
    Lightning: '#eab308',
    Fighting: '#92400e',
    Psychic: '#9333ea',
    Colorless: '#94a3b8',
  }
  return map[type] ?? '#94a3b8'
}
