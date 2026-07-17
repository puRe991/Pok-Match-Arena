import clsx from 'clsx'
import { attackIsUsable } from '../game/engine'
import type { InPlayPokemon } from '../game/types'
import { TypeBadge } from './CardView'

interface AttackPanelProps {
  mon: InPlayPokemon
  turnNumber: number
  disabled?: boolean
  onAttack: (index: number) => void
}

export function AttackPanel({ mon, turnNumber, disabled, onAttack }: AttackPanelProps) {
  const top = mon.stages[mon.stages.length - 1]
  if (top.attacks.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {top.attacks.map((attack, idx) => {
        const usable = !disabled && attackIsUsable(mon, idx, turnNumber)
        return (
          <button
            key={attack.name + idx}
            type="button"
            disabled={!usable}
            onClick={() => onAttack(idx)}
            className={clsx(
              'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
              usable
                ? 'cursor-pointer border-sky-500 bg-sky-500/10 hover:bg-sky-500/20'
                : 'cursor-not-allowed border-slate-700 bg-slate-800/50 opacity-60',
            )}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {attack.cost.map((c, i) => (
                  <TypeBadge key={i} type={c} />
                ))}
              </div>
              <span className="text-sm font-semibold text-white">{attack.name}</span>
            </div>
            <span className="font-mono text-sm font-bold text-yellow-300">{attack.damage}</span>
          </button>
        )
      })}
    </div>
  )
}
