import { useEffect, useState } from 'react'
import { Hand, Keyboard, Navigation } from 'lucide-react'
import { moveInput } from '../world3d/input'

const KEY = 'babi.firstSteps'
/** A computer (a mouse, a keyboard) rather than a phone's touch screen. */
const mouse = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches

function done() {
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    return false
  }
}

/**
 * The first time in the street: how to walk (the pad on a phone, the keys
 * on a computer), then how to go
 * somewhere without walking (a place, « Où aller ? »). Walking a few steps
 * moves on by itself; never shown again once seen.
 */
export function FirstSteps({ hidden }: { hidden: boolean }) {
  const [step, setStep] = useState<0 | 1 | 2>(() => (done() ? 2 : 0))

  const desk = useState(mouse)[0]
  // A few steps (the pad or the keys): next tip.
  useEffect(() => {
    if (step !== 0) return
    let moved = 0
    const t = setInterval(() => {
      const m = moveInput()
      if (Math.hypot(m.x, m.y) > 0.2) moved++
      if (moved > 6) setStep(1)
    }, 150)
    return () => clearInterval(t)
  }, [step])

  useEffect(() => {
    if (step !== 2) return
    try {
      localStorage.setItem(KEY, 'done')
    } catch {
      /* private window */
    }
  }, [step])

  if (step === 2 || hidden) return null
  return step === 0 ? (
    <div className="hud motion-pop pointer-events-auto absolute right-3 bottom-[14.75rem] left-[8.25rem] z-30 flex max-w-[17rem] items-start gap-2 rounded-[18px] p-2.5 lg:bottom-[16.25rem] lg:left-[9rem]">
      {desk ? <Keyboard size={20} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[var(--color-orange)]" /> : <Hand size={20} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[var(--color-orange)]" />}
      <div className="text-sm leading-snug font-bold">
        <p className="font-display text-[15px] font-extrabold">{desk ? 'Marche avec les flèches (ou ZQSD)' : 'Glisse le rond pour marcher'}</p>
        <p className="text-[13px] text-[var(--color-ink-soft)]">{desk ? 'Glisse avec la souris pour tourner la vue, Maj pour courir.' : "Glisse l'écran pour tourner la vue."}</p>
        <button className="mt-1 text-sm font-extrabold text-[var(--color-orange)]" onClick={() => setStep(1)}>
          Compris
        </button>
      </div>
    </div>
  ) : (
    <div className="hud motion-pop pointer-events-auto absolute right-3 bottom-[14.75rem] left-[8.25rem] z-30 flex max-w-[17rem] items-start gap-2 rounded-[18px] p-2.5 lg:bottom-[16.25rem] lg:left-[9rem]">
      <Navigation size={20} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[var(--color-orange)]" />
      <div className="text-sm leading-snug font-bold">
        <p className="font-display text-[15px] font-extrabold">Ou laisse ton Sim y aller</p>
        <p className="text-[13px] text-[var(--color-ink-soft)]">{desk ? 'Clique un lieu' : 'Touche un lieu'}, ou « Où aller ? » en haut.</p>
        <button className="mt-1 text-sm font-extrabold text-[var(--color-orange)]" onClick={() => setStep(2)}>
          C'est parti
        </button>
      </div>
    </div>
  )
}
