import { useEffect, useRef } from 'react'
import type { LogEntry } from '../game/types'

export function GameLog({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [entries.length])

  return (
    <div ref={ref} className="h-28 w-full overflow-y-auto rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed sm:h-full">
      {entries.map((entry) => (
        <div key={entry.id} className="text-slate-300">
          <span className="text-slate-500">[{entry.turn}]</span> {entry.text}
        </div>
      ))}
    </div>
  )
}
