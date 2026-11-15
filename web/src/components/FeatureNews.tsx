import { useEffect, useState } from 'react'
import { useSession } from '../store/session'
import { Check, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { useFeatures } from '../lib/features'
import { t } from '../lib/i18n'

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

// Older than this, an update isn't news any more: no card for it.
const FRESH_MS = 14 * 24 * 3600 * 1000

export function FeatureNews({ onShowing }: { /** Told whether a card is on screen (the other cards wait for it, screens/Play.tsx). */ onShowing?: (on: boolean) => void }) {
  const { news: all } = useFeatures()
  // An update opened before the account was made isn't news to it: a new player isn't greeted by the
  // last two weeks' cards (they're marked seen, below).
  const since = Date.parse(useSession((s) => s.user?.createdAt) ?? '') || 0
  const [seen, setSeen] = useState(readSeen)
  // What the account has seen, kept on the server: no card until it has answered (or 4 s went by).
  const [asked, setAsked] = useState(false)
  useEffect(() => {
    let live = true
    const late = setTimeout(() => live && setAsked(true), 4000)
    api
      .newsSeen()
      .then(({ seen: there }) => {
        if (!live) return
        const here = readSeen()
        // Seen on this phone before the server kept them: told to it now.
        const missing = here.filter((id) => !there.includes(id))
        if (missing.length) void api.markNewsSeen(missing.slice(0, 200))
        const merged = [...new Set([...here, ...there])]
        setSeen(merged)
        try {
          localStorage.setItem(SEEN, JSON.stringify(merged))
        } catch {
          // Private mode: the server's list is enough.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(late)
        if (live) setAsked(true)
      })
    return () => {
      live = false
      clearTimeout(late)
    }
  }, [])
  const fresh = all.filter((n) => !(Date.now() - Date.parse(n.at) > FRESH_MS))
  const news = fresh.filter((n) => !(Date.parse(n.at) < since))
  const next = [...news].sort((a, b) => b.at.localeCompare(a.at)).find((n) => !seen.includes(n.id))
  const showing = !!next && asked
  useEffect(() => {
    onShowing?.(showing)
  }, [showing]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onShowing?.(false), []) // eslint-disable-line react-hooks/exhaustive-deps
  // Older than the account: seen, once the server has said what it has (so it isn't asked again).
  const older = asked ? fresh.filter((n) => Date.parse(n.at) < since && !seen.includes(n.id)).map((n) => n.id) : []
  useEffect(() => {
    if (older.length) save(older)
  }, [older.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  function save(ids: string[]) {
    const now = [...new Set([...seen, ...ids])]
    setSeen(now)
    const fresh = ids.filter((id) => !seen.includes(id))
    if (fresh.length) void api.markNewsSeen(fresh.slice(0, 200))
    try {
      localStorage.setItem(SEEN, JSON.stringify(now))
    } catch {
      // Private mode: shown again next time.
    }
  }
  if (!showing) return null
  const done = () => save([next.id])
  // « Tout passer »: every card waiting, seen at once.
  const skipAll = () => save(news.map((n) => n.id))
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
              <Sparkles size={15} strokeWidth={2.8} /> {t('NOUVEAU')}
            </span>
            {left > 1 && <span className="rounded-full bg-black/15 px-2.5 py-1 text-[12px] font-extrabold">{t('encore')} {left - 1}</span>}
          </div>
          <div className="mt-3 font-display text-[27px] leading-[1.05] font-extrabold">{next.label}</div>
          <div className="mt-1 text-[13px] font-bold text-white/85">{t('dans Babi Life')}</div>
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
        <div className="px-5 pt-4 pb-[max(1.25rem,var(--sab,env(safe-area-inset-bottom)))]">
          <button className="btn w-full" onClick={done}>
            {left > 1 ? t('Super ! La suivante') : t('Je découvre !')}
          </button>
          {left > 1 && (
            <button className="mt-2 w-full py-2 text-[14px] font-extrabold text-[var(--color-ink-soft)] underline underline-offset-4" onClick={skipAll}>
              {t('Passer les {n} nouveautés', { n: left })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
