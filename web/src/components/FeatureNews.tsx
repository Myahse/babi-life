import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useFeatures } from '../lib/features'

// « Nouveau dans Babi Life » : an update the team just opened from the admin
// (backend features/), shown once on this phone, the newest first. A card
// with an orange top (the « NOUVEAU » sticker, the name in big), the flag's
// green under it, and what it brings as a short list (the text cut at « ; »).

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
  const left = news.filter((n) => !seen.includes(n.id)).length
  // What it brings, one thing a line: the « ; » of the text; one sentence stays a sentence.
  const parts = next.about
    .split(/\s*;\s*/)
    .map((p) => p.trim().replace(/\.$/, ''))
    .filter(Boolean)
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={done}>
      <div className="sheet animate-up w-full overflow-hidden rounded-t-[28px] !p-0 lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-[var(--color-orange)] px-5 pt-5 pb-6 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex -rotate-3 items-center gap-1.5 rounded-xl border-2 border-white bg-[#ffd43b] px-2.5 py-1 text-[13px] font-extrabold tracking-wide text-[#16161c] shadow-[0_4px_0_rgba(0,0,0,0.18)]">
              <Sparkles size={15} strokeWidth={2.8} /> NOUVEAU
            </span>
            {left > 1 && <span className="rounded-full bg-black/15 px-2.5 py-1 text-[12px] font-extrabold">encore {left - 1}</span>}
          </div>
          <div className="mt-3 font-display text-[27px] leading-[1.05] font-extrabold">{next.label}</div>
          <div className="mt-1 text-[13px] font-bold text-white/85">dans Babi Life</div>
        </div>
        <div className="h-1.5 bg-[var(--color-emerald)]" />
        <div className="max-h-[48vh] overflow-y-auto px-5 pt-4">
          {parts.length > 1 ? (
            <ul className="space-y-2.5">
              {parts.map((p) => (
                <li key={p} className="flex gap-2.5 text-[14px] leading-snug font-bold text-[var(--color-ink)]">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#d3f9d8] text-[var(--color-emerald-deep)]">
                    <Check size={13} strokeWidth={3.2} />
                  </span>
                  <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] leading-snug font-bold text-[var(--color-ink)]">{next.about}</p>
          )}
        </div>
        <div className="px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button className="btn w-full" onClick={done}>
            {left > 1 ? 'Super ! La suivante' : 'Je découvre !'}
          </button>
        </div>
      </div>
    </div>
  )
}
