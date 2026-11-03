import { useEffect, useRef, useState } from 'react'
import { Flash, Hud, beep } from './kit'
import { t } from '../../../lib/i18n'

// « Le roi de la manette », chapter 2 (game/epreuves.go): at the salle de jeux, Seydou shows his secret
// combo on the pad, the four buttons lighting up one after the other. Do it again, the same. Each time
// right, he adds a button and plays it faster. One mistake and it's his turn to laugh. Up to 10 buttons.

const BUTTONS = [
  { k: 'Y', c: '#fab005', f: 523 },
  { k: 'X', c: '#228be6', f: 440 },
  { k: 'B', c: '#e03131', f: 349 },
  { k: 'A', c: '#2f9e44', f: 262 },
] as const
const FIRST = 3
const LAST = 10

export default function RoiManette({ onEnd }: { onEnd: (score: number) => void }) {
  const seq = useRef<number[]>(Array.from({ length: FIRST }, () => Math.floor(Math.random() * 4)))
  const [lit, setLit] = useState(-1)
  const [phase, setPhase] = useState<'show' | 'play' | 'over'>('show')
  const [at, setAt] = useState(0)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const len = seq.current.length

  // Seydou plays the combo: each button lit, its note, a little quicker every round.
  useEffect(() => {
    if (phase !== 'show') return
    const gap = Math.max(260, 620 - (len - FIRST) * 55)
    const timers: number[] = []
    seq.current.forEach((b, i) => {
      timers.push(window.setTimeout(() => (setLit(b), beep(BUTTONS[b].f, (gap / 1000) * 0.7, 0.15, { type: 'square' })), 700 + i * gap))
      timers.push(window.setTimeout(() => setLit(-1), 700 + i * gap + gap * 0.7))
    })
    timers.push(window.setTimeout(() => (setAt(0), setPhase('play')), 700 + len * gap))
    return () => timers.forEach(clearTimeout)
  }, [phase, len])

  const end = (reached: number) => {
    setPhase('over')
    setTimeout(() => onEnd(Math.round(Math.max(0, (reached - FIRST + 1) / (LAST - FIRST + 1)) * 100)), 1100)
  }

  const press = (b: number) => {
    if (phase !== 'play') return
    setLit(b)
    setTimeout(() => setLit(-1), 160)
    if (seq.current[at] !== b) {
      beep(110, 0.5, 0.15, { type: 'sawtooth' })
      setFlash({ text: t('Raté ! Seydou rigole'), at: Date.now() })
      return end(len - 1)
    }
    beep(BUTTONS[b].f, 0.15, 0.15, { type: 'square' })
    if (at + 1 < len) return setAt(at + 1)
    if (len >= LAST) {
      setFlash({ text: t('Combo parfaite !'), at: Date.now() })
      return end(LAST)
    }
    setFlash({ text: t('Bien ! Il en rajoute une…'), at: Date.now() })
    seq.current = [...seq.current, Math.floor(Math.random() * 4)]
    setPhase('show')
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#3b2b6b,#120c24)]">
      <Hud title={t('La combo de Seydou')} done={`${phase === 'play' ? at : 0}/${len}`} />
      <div className="mb-6 text-center font-display text-lg font-extrabold text-white">{phase === 'show' ? t('Regarde bien…') : phase === 'play' ? t('À toi !') : ''}</div>
      {/* The pad: the four buttons in a diamond, as on a console's */}
      <div className="relative h-[260px] w-[260px] rounded-full bg-[#1f1f28] shadow-[inset_0_4px_16px_rgba(0,0,0,0.6)]">
        {BUTTONS.map((b, i) => {
          const pos = ['left-1/2 top-3 -translate-x-1/2', 'left-3 top-1/2 -translate-y-1/2', 'right-3 top-1/2 -translate-y-1/2', 'left-1/2 bottom-3 -translate-x-1/2'][i]
          return (
            <button
              key={b.k}
              onClick={() => press(i)}
              className={`absolute grid h-[84px] w-[84px] place-items-center rounded-full font-display text-3xl font-extrabold text-white transition active:scale-90 ${pos}`}
              style={{ background: b.c, opacity: lit === i ? 1 : 0.55, boxShadow: lit === i ? `0 0 36px ${b.c}` : '0 5px 0 rgba(0,0,0,0.45)' }}
              aria-label={b.k}
            >
              {b.k}
            </button>
          )
        })}
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="mt-6 px-4 text-center text-xs font-bold text-white/75">{t('Refais la combo dans le même ordre. Jusqu’à {n} boutons.', { n: LAST })}</p>
    </div>
  )
}
