import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { CardDef } from '../game/types'
import { TypeBadge } from './CardView'

const RARITY_STYLES: Record<string, string> = {
  Common: 'bg-slate-600 text-white',
  Uncommon: 'bg-emerald-600 text-white',
  Rare: 'bg-sky-500 text-white',
  'Holo Rare': 'bg-yellow-500 text-slate-900',
}

function kindLabel(card: CardDef): string {
  if (card.kind === 'pokemon') return 'Pokémon'
  if (card.kind === 'energy') return card.isBasicEnergy ? 'Basis-Energie' : 'Spezial-Energie'
  return 'Trainer'
}

function stageLabel(stage: string): string {
  if (stage === 'basic') return 'Basis'
  if (stage === 'stage1') return 'Stufe 1'
  if (stage === 'stage2') return 'Stufe 2'
  return stage
}

function CardDetails({ card }: { card: CardDef }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-200">
      <div>
        <h2 className="text-lg font-bold text-white">{card.name}</h2>
        <p className="text-xs text-slate-400">
          {kindLabel(card)} · {card.setName} · Nr. {card.number}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${RARITY_STYLES[card.rarity] ?? 'bg-slate-600 text-white'}`}>
          {card.rarity}
        </span>
        {card.kind === 'pokemon' && (
          <>
            <TypeBadge type={card.pokemonType} />
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white">{stageLabel(card.stage)}</span>
            <span className="rounded-full bg-red-600/80 px-2 py-0.5 text-[10px] font-bold text-white">{card.hp} KP</span>
          </>
        )}
        {card.kind === 'energy' && <TypeBadge type={card.energyType} />}
      </div>

      {card.kind === 'pokemon' && (
        <div className="flex flex-col gap-2">
          {card.evolvesFrom && (
            <p className="text-xs text-slate-400">
              Entwickelt sich aus <span className="font-semibold text-slate-200">{card.evolvesFrom}</span>
            </p>
          )}
          {card.attacks.map((atk, i) => (
            <div key={i} className="rounded-lg bg-black/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {atk.cost.map((c, j) => (
                    <TypeBadge key={j} type={c} />
                  ))}
                  <span className="ml-1 font-semibold text-white">{atk.name}</span>
                </div>
                {atk.damage > 0 && <span className="font-bold text-amber-300">{atk.damage}</span>}
              </div>
              {atk.text && <p className="mt-1 text-xs text-slate-400">{atk.text}</p>}
            </div>
          ))}
          <div className="flex gap-4 text-xs text-slate-400">
            {card.weakness && (
              <span>
                Schwäche: <TypeBadge type={card.weakness} />
              </span>
            )}
            <span>Rückzug: {card.retreatCost}</span>
          </div>
        </div>
      )}

      {card.kind === 'trainer' && <p className="rounded-lg bg-black/30 p-2 text-xs text-slate-300">{card.text}</p>}
    </div>
  )
}

export function CardZoomModal({ card, onClose }: { card: CardDef | null; onClose: () => void }) {
  useEffect(() => {
    if (!card) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, onClose])

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${card.name} in Großansicht`}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:flex-row"
          >
            <div className="flex shrink-0 justify-center sm:w-1/2">
              <img
                src={card.imageLarge}
                alt={card.name}
                className="max-h-[70vh] w-auto rounded-xl shadow-lg"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).src = card.imageSmall
                }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>
              <CardDetails card={card} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
