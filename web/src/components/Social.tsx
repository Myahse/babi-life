import { useEffect, useState } from 'react'
import { photoURL } from '../lib/api'
import { t } from '../lib/i18n'

// Pieces shared by the stories (Gbairai) and Tikitoko: a photo behind the
// login, and the « what's wrong » sheet of a report.

export const REASONS = [
  ['insultes', t('Insultes')],
  [t('harcèlement'), t('Harcèlement')],
  [t('contenu choquant'), t('Contenu choquant')],
  ['arnaque', t('Arnaque')],
  ['autre', t('Autre chose')],
] as const

/** A story's or a post's photo, fetched with the token. */
export function Photo({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let gone = false
    let made: string | null = null
    setUrl(null)
    setFailed(false)
    photoURL(path)
      .then((u) => (gone ? URL.revokeObjectURL(u) : ((made = u), setUrl(u))))
      .catch(() => !gone && setFailed(true))
    return () => {
      gone = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [path])
  if (failed) return <div className={`grid place-items-center bg-[#1d1d24] text-xs font-bold text-white/60 ${className ?? ''}`}>{t('Photo indisponible')}</div>
  if (!url) return <div className={`animate-pulse bg-[#2a2a33] ${className ?? ''}`} />
  return <img src={url} alt={alt} className={`object-cover ${className ?? ''}`} />
}

/** The reasons to report, on a dark sheet. */
export function ReportSheet({ title, onPick, onCancel, note }: { title: string; onPick: (reason: string) => void; onCancel: () => void; note: string }) {
  return (
    <div className="rounded-2xl bg-[#1d1d24] p-3 text-white">
      <p className="text-sm font-extrabold">{title} {t(": qu'est-ce qui ne va pas ?")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REASONS.map(([id, label]) => (
          <button key={id} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold" onClick={() => onPick(id)}>
            {label}
          </button>
        ))}
        <button className="rounded-full px-3 py-1.5 text-xs font-extrabold text-white/70" onClick={onCancel}>
          {t('Annuler')}
        </button>
      </div>
      <p className="mt-2 text-[11px] font-bold text-white/60">{note}</p>
    </div>
  )
}
