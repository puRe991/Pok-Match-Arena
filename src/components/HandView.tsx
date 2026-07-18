import type { CardDef } from '../game/types'
import { CardView } from './CardView'

interface HandViewProps {
  cards: CardDef[]
  selectedUid?: string | null
  playableUids: Set<string>
  onCardClick: (card: CardDef) => void
  onZoom?: (card: CardDef) => void
}

export function HandView({ cards, selectedUid, playableUids, onCardClick, onZoom }: HandViewProps) {
  if (cards.length === 0) {
    return <div className="py-4 text-center text-xs text-slate-500">Keine Karten auf der Hand.</div>
  }
  return (
    <div className="flex justify-center gap-2 overflow-x-auto px-2 py-3">
      {cards.map((card) => (
        <CardView
          key={card.uid}
          card={card}
          size="lg"
          selected={selectedUid === card.uid}
          dimmed={!playableUids.has(card.uid)}
          onClick={playableUids.has(card.uid) ? () => onCardClick(card) : undefined}
          onZoom={onZoom ? () => onZoom(card) : undefined}
        />
      ))}
    </div>
  )
}
