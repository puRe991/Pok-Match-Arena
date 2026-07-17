import clsx from 'clsx'
import type { CardDef } from '../game/types'

const TYPE_COLORS: Record<string, string> = {
  Fire: 'bg-orange-600',
  Water: 'bg-blue-600',
  Grass: 'bg-green-600',
  Lightning: 'bg-yellow-500',
  Fighting: 'bg-amber-800',
  Psychic: 'bg-purple-600',
  Darkness: 'bg-slate-800',
  Metal: 'bg-zinc-400',
  Fairy: 'bg-pink-400',
  Dragon: 'bg-indigo-600',
  Colorless: 'bg-slate-400',
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase text-white shadow',
        TYPE_COLORS[type] ?? 'bg-slate-500',
      )}
    >
      {type}
    </span>
  )
}

interface CardViewProps {
  card: CardDef
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
  className?: string
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-14',
  md: 'w-20 sm:w-24',
  lg: 'w-32 sm:w-40',
}

export function CardView({ card, size = 'md', selected, dimmed, onClick, className }: CardViewProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={clsx(
        SIZE_CLASSES[size],
        'relative aspect-[5/7] shrink-0 overflow-hidden rounded-lg border-2 bg-slate-800 shadow-md transition-transform outline-none',
        selected ? 'border-yellow-400 -translate-y-2 shadow-yellow-400/50 shadow-lg' : 'border-slate-700',
        onClick && 'cursor-pointer hover:-translate-y-1 hover:border-sky-400',
        dimmed && 'opacity-40 grayscale',
        className,
      )}
      title={card.name}
    >
      <img
        src={card.imageSmall}
        alt={card.name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
      {card.kind === 'trainer' && (
        <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1 text-[8px] font-bold text-white">
          {card.trainerType === 'supporter' ? 'SUPPORTER' : 'ITEM'}
        </span>
      )}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white">
        {card.name}
      </div>
    </button>
  )
}

export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={clsx(
        SIZE_CLASSES[size],
        'aspect-[5/7] shrink-0 rounded-lg border-2 border-slate-600 bg-gradient-to-br from-indigo-700 via-indigo-900 to-slate-900 shadow-md',
      )}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-2/3 w-2/3 rounded-full border-4 border-white/20" />
      </div>
    </div>
  )
}
