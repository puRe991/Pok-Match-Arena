import { avatarById, rankForRating } from '../profile/profile'

/** Kompaktes Profil-Badge (Avatar + Rang + Elo) für Spielfeldrand und Lobby. */
export function ProfileTag({ avatarId, rating }: { avatarId: string; rating: number }) {
  const rank = rankForRating(rating)
  return (
    <span className="flex items-center gap-1.5" title={`${rank.label} · ${rating} Elo`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-sm">
        {avatarById(avatarId).emoji}
      </span>
      <span className={`text-[11px] font-bold ${rank.colorClass}`}>
        {rank.icon} {rating}
      </span>
    </span>
  )
}
