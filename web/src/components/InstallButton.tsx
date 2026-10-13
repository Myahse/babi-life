import { useState } from 'react'
import { Download, Share, SquarePlus, WifiOff, X } from 'lucide-react'
import { useInstall, useOnline } from '../lib/pwa'

/** "Installer l'app": the browser's install dialog, or the steps on iPhone. */
export function InstallButton({ className = '' }: { className?: string }) {
  const { mode, install } = useInstall()
  const [steps, setSteps] = useState(false)
  if (!mode) return null
  return (
    <>
      <button className={`btn btn-white w-full ${className}`} onClick={() => (mode === 'prompt' ? install() : setSteps(true))}>
        <Download size={18} strokeWidth={2.6} /> Installer l'app
      </button>
      {steps && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-[#0f1230]/60 p-3 backdrop-blur-[3px] sm:place-items-center" onClick={() => setSteps(false)}>
          <div className="card motion-pop w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Installer sur iPhone">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="label">Sur iPhone et iPad</div>
                <h2 className="font-display text-2xl leading-tight font-extrabold">Ajoute Ivoire Life à l'écran d'accueil</h2>
              </div>
              <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={() => setSteps(false)} aria-label="Fermer">
                <X size={20} strokeWidth={2.6} />
              </button>
            </div>
            <ol className="space-y-2.5 text-sm font-bold">
              <li className="flex items-center gap-3 rounded-xl bg-[var(--color-canvas)] p-3">
                <Share size={20} className="shrink-0 text-[var(--color-sky)]" /> Touche le bouton Partager de Safari
              </li>
              <li className="flex items-center gap-3 rounded-xl bg-[var(--color-canvas)] p-3">
                <SquarePlus size={20} className="shrink-0 text-[var(--color-ink)]" /> Choisis « Sur l'écran d'accueil »
              </li>
              <li className="flex items-center gap-3 rounded-xl bg-[var(--color-canvas)] p-3">
                <Download size={20} className="shrink-0 text-[var(--color-emerald)]" /> Touche « Ajouter » : l'app s'ouvre en plein écran
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}

/** A thin banner while the phone has no network: the game needs it to live. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="motion-pop fixed inset-x-0 top-0 z-[60] flex justify-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))]" role="status">
      <div className="flex items-center gap-2 rounded-xl bg-[var(--color-ink)] px-3 py-2 text-sm font-bold text-white shadow-lg">
        <WifiOff size={16} /> Hors connexion : ta vie reprend dès que le réseau revient.
      </div>
    </div>
  )
}
