import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useFeatures } from '../lib/features'

// « Nouveau dans Babi Life » : an update the team just opened from the admin
// (backend features/), shown once on this phone, the newest first.

const SEEN = 'babi.featuresSeen'
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function FeatureNews() {
  const { news } = useFeatures()
  const [seen, setSeen] = useState(readSeen)
  const next = [...news].sort((a, b) => b.at.localeCompare(a.at)).find((n) => !seen.includes(n.id))
  if (!next) return null
  const done = () => {
    const all = [...seen, next.id]
    setSeen(all)
    try {
      localStorage.setItem(SEEN, JSON.stringify(all))
    } catch {
      // Private mode: shown again next time.
    }
  }
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={done}>
      <div className="sheet animate-up w-full rounded-t-[28px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#ffd43b] text-[#16161c]">
            <Sparkles size={22} strokeWidth={2.6} />
          </span>
          <div className="label">Nouveau dans Babi Life</div>
        </div>
        <div className="mt-2 font-display text-[24px] leading-tight font-extrabold">{next.label}</div>
        <p className="mt-2 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">{next.about}</p>
        <button className="btn mt-4 w-full" onClick={done}>
          Super !
        </button>
      </div>
    </div>
  )
}
