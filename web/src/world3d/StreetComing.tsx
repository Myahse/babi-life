import { useEffect, useState } from 'react'
import { t as tr } from '../lib/i18n'
import { useStreetProgress } from './streetProgress'

// The update « demarrage-rapide »: the game's screen comes first and the street's 3D builds behind
// it. Meanwhile, the sky of the hour (as the street paints it, world3d/open/OpenWorld Street) and a
// small card over it saying how far the street has come; the screen's buttons all work under it.

/** The street's sky at that hour, where the street will stand. */
export function StreetSky({ hour }: { hour: number }) {
  const night = hour < 6 || hour >= 19
  const dusk = hour >= 17 && hour < 19
  return <div className="absolute inset-0" style={{ background: night ? '#141a3d' : dusk ? '#f7a072' : '#8ec9f0' }} />
}

/** How far the street around the Sim is drawn; gone for good once most of it stands. */
export function StreetComing() {
  const { have, want } = useStreetProgress()
  const [done, setDone] = useState(false)
  // Most of the pieces around the Sim are drawn: the street is there, the rest comes as it walks.
  const enough = want > 0 && have >= Math.max(1, Math.ceil(want * 0.6))
  useEffect(() => {
    if (!enough) return
    const t = setTimeout(() => setDone(true), 600)
    return () => clearTimeout(t)
  }, [enough])
  if (done) return null
  const share = want ? Math.min(1, have / Math.max(1, Math.ceil(want * 0.6))) : 0
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-[38%] z-10 flex justify-center px-6 transition-opacity duration-500 ${enough ? 'opacity-0' : 'opacity-100'}`} role="status" aria-live="polite">
      <div className="hud w-full max-w-[260px] rounded-2xl px-4 py-2.5 text-center">
        {/* Before its first piece stands, a light running along the bar (as on the loading screen), not « 0 % » */}
        <p className="text-sm font-extrabold">{have ? tr('Ta rue se construit… {n} %', { n: Math.round(share * 100) }) : tr('La ville arrive…')}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">{have ? <div className="h-full rounded-full bg-[var(--color-orange)] transition-[width] duration-500" style={{ width: `${Math.max(6, share * 100)}%` }} /> : <div className="splash-bar h-full w-full" />}</div>
        <p className="mt-1.5 text-[11px] leading-tight font-bold opacity-75">{tr('Tu peux déjà jouer : ton téléphone et tes applis sont là.')}</p>
      </div>
    </div>
  )
}
