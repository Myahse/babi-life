import { useState } from 'react'
import { Check, LandPlot, Move, X } from 'lucide-react'
import { useLotPlace } from '../store/lotPlace'
import { amount } from '../game/rules'

// Over the 3D world while a lot is being set there (store/lotPlace.ts,
// world3d/open/lotGhost.tsx): where it is, what's in the way, and the button
// to buy it (or move one's lot) right there.

export function LotPlaceHud() {
  const placing = useLotPlace((s) => s.placing)
  const ghost = useLotPlace((s) => s.ghost)
  const stop = useLotPlace((s) => s.stop)
  const [busy, setBusy] = useState(false)
  if (!placing) return null
  const why = ghost ? ghost.why : 'Le quartier se charge ici…'
  const pick = async () => {
    if (!ghost || ghost.why) return
    setBusy(true)
    const ok = await placing.onPick({ lat: ghost.lat, lng: ghost.lng })
    setBusy(false)
    if (ok) stop()
  }
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col justify-between">
      <header className="animate-up flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="hud pointer-events-auto min-w-0 flex-1 rounded-2xl px-3 py-2">
          <div className="label">{placing.moving ? 'Déplacer ton terrain' : 'Où mettre ton terrain ?'}</div>
          <div key={ghost?.near ?? ''} className="motion-pop truncate font-display text-[16px] leading-tight font-extrabold">{ghost?.near ? nearOf(ghost.near) : 'Fais glisser la ville sous le terrain'}</div>
        </div>
        <button className="icon-btn hud pointer-events-auto shrink-0" onClick={stop} aria-label="Annuler">
          <X size={22} strokeWidth={2.6} />
        </button>
      </header>
      <footer className="sheet animate-up pointer-events-auto rounded-t-[24px] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-ink-soft)]">
          <LandPlot size={16} className="shrink-0 text-[#1a8a4a]" />
          <span className="min-w-0 flex-1">
            {placing.w} × {placing.d} m{placing.price ? ` · ${amount(placing.price)} Djai` : ''} · au bord de la rue, ta maison sera construite là
          </span>
        </div>
        {why ? (
          <p key={why} className="motion-shake mb-2 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">
            {why}
          </p>
        ) : (
          <p className="mb-2 flex items-center gap-1.5 rounded-xl bg-[#e8f6ee] px-3 py-2 text-sm font-bold text-[#1a8a4a]">
            <Move size={15} className="shrink-0" /> Bon coin ! Glisse encore pour changer, ou prends-le.
          </p>
        )}
        <div className="flex gap-2">
          <button className="btn btn-soft shrink-0 !px-4" onClick={stop}>
            Annuler
          </button>
          <button className="btn flex-1" disabled={busy || !ghost || !!why} onClick={() => void pick()}>
            <Check size={18} /> {busy ? '…' : placing.label}
          </button>
        </div>
      </footer>
    </div>
  )
}

/** « Près du marché », « Près de la gare », « Près de Cap Sud ». */
export const nearOf = (name: string) => (/^le /i.test(name) ? `Près du ${name.slice(3)}` : /^les /i.test(name) ? `Près des ${name.slice(4)}` : `Près de ${name}`)
