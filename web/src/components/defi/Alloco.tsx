import { useEffect, useRef, useState } from 'react'
import { Egg } from 'lucide-react'
import { haptic } from '../../lib/native'
import { gesture } from '../../world3d/gesture'

// L'alloco, played (the update « gestes-maison »). First the choice: with an egg
// (100 Djai more) or not. Then the tantie's ladle drops the fried plantain from
// the hot oil: move the paper (drag, or the arrows) and catch every piece before
// it falls in the sand. With the egg: peel it, every bit of shell, before it
// gets cold. The score says how much was caught (and peeled) and how fast.

const PIECES = 16
type Drop = { key: number; x: number; y: number; v: number }

export function AllocoDefi({ onEnd }: { /** The score, and whether the egg was taken (100 Djai more, backend sims/defi.go). */ onEnd: (score: number, egg: boolean) => void }) {
  const [phase, setPhase] = useState<'ask' | 'catch' | 'peel'>('ask')
  const [egg, setEgg] = useState(false)
  const caught = useRef(0)
  if (phase === 'ask')
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#2a1a08]/70 p-5">
        <div className="card animate-pop w-full max-w-[340px] p-4 text-center">
          <div className="font-display text-[19px] font-extrabold">Avec un œuf ?</div>
          <p className="mt-1 text-[13.5px] font-bold text-[var(--color-ink-soft)]">La tantie a des œufs durs : 100 Djai de plus, à écailler toi-même.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2.5" onClick={() => setPhase('catch')}>
              Non merci
            </button>
            <button className="btn !py-2.5" onClick={() => (setEgg(true), setPhase('catch'))}>
              <Egg size={16} /> Oui (+100)
            </button>
          </div>
        </div>
      </div>
    )
  if (phase === 'catch') return <Catch onDone={(n) => ((caught.current = n), egg ? setPhase('peel') : onEnd(n, false))} />
  return <Peel onDone={(p) => onEnd(Math.round(caught.current * 0.7 + p * 0.3), true)} />
}

/** A slice of alloco: the ripe plantain cut on the slant, fried golden, caramel at the edges. */
function Slice() {
  return (
    <svg width="38" height="22" viewBox="0 0 38 22" aria-hidden style={{ filter: 'drop-shadow(0 2px 1px rgba(90,40,0,0.5))' }}>
      <defs>
        <radialGradient id="alloco-slice" cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.55" stopColor="#f2a62a" />
          <stop offset="1" stopColor="#a8510c" />
        </radialGradient>
      </defs>
      <path d="M3 12 Q4 3 19 2 Q34 2 35 10 Q35 19 19 20 Q4 21 3 12 Z" fill="url(#alloco-slice)" stroke="#7a3a08" strokeWidth="1.2" />
      <path d="M10 8 Q19 5 28 8" stroke="#fff3c4" strokeWidth="1.6" fill="none" opacity="0.6" />
      {[[13, 13], [22, 12], [17, 16]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1" fill="#8a4a0c" opacity="0.5" />
      ))}
    </svg>
  )
}

/** The paper under the ladle: every piece caught. */
function Catch({ onDone }: { onDone: (score: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [paper, setPaper] = useState(0.5)
  const [drops, setDrops] = useState<Drop[]>([])
  const [n, setN] = useState({ caught: 0, lost: 0, sent: 0 })
  const st = useRef({ paper: 0.5, key: 0, caught: 0, lost: 0, sent: 0, done: false })
  // Drag the paper, or the arrows.
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect()
    const x = Math.min(0.92, Math.max(0.08, (clientX - r.left) / r.width))
    st.current.paper = x
    setPaper(x)
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d = e.key === 'ArrowLeft' ? -0.08 : e.key === 'ArrowRight' ? 0.08 : 0
      if (!d) return
      const x = Math.min(0.92, Math.max(0.08, st.current.paper + d))
      st.current.paper = x
      setPaper(x)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  // The ladle drops a piece now and then, quicker as it goes; they fall. (Kept in a ref, drawn from it:
  // nothing counted twice.)
  const finish = useRef(onDone)
  finish.current = onDone
  const live = useRef<Drop[]>([])
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let next = 600
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const s = st.current
      next -= dt * 1000
      let out = live.current.map((d) => ({ ...d, y: d.y + d.v * dt }))
      if (next <= 0 && s.sent < PIECES) {
        next = 900 - s.sent * 30
        s.sent++
        out.push({ key: s.key++, x: 0.12 + Math.random() * 0.76, y: 0.08, v: 0.32 + s.sent * 0.012 })
      }
      // At the paper's height: in it, or in the sand.
      out = out.filter((d) => {
        if (d.y < 0.82) return true
        if (Math.abs(d.x - s.paper) < 0.12) {
          s.caught++
          haptic('light')
          gesture('busy', 600)
        } else s.lost++
        return false
      })
      live.current = out
      setDrops(out)
      setN({ caught: s.caught, lost: s.lost, sent: s.sent })
      if (!s.done && s.sent >= PIECES && s.caught + s.lost >= PIECES) {
        s.done = true
        setTimeout(() => finish.current(Math.round((s.caught / PIECES) * 100)), 500)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#2a1a08]/70 p-4">
      <div className="card px-4 py-2 text-center">
        <div className="font-display text-[17px] font-extrabold">Attrape ton alloco !</div>
        <div className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">Glisse le papier sous la louche. {n.caught}/{PIECES} attrapés</div>
      </div>
      <div ref={box} className="relative h-[min(60vh,440px)] w-[min(90vw,420px)] touch-none overflow-hidden rounded-3xl" style={{ background: 'linear-gradient(#3a2412 0 22%, #6b4426 22% 24%, #e6cf9c 24%)' }} onPointerDown={(e) => move(e.clientX)} onPointerMove={(e) => e.buttons && move(e.clientX)}>
        {/* The tantie's table: the black pan of oil on its stove, a few slices frying, her ladle */}
        <div className="absolute top-[2%] left-1/2 h-[17%] w-[70%] -translate-x-1/2 rounded-b-[50%] border-[5px] border-t-0 border-[#1d1d20]" style={{ background: 'radial-gradient(ellipse at 50% 0%, #f2b13a, #b8650f 70%)' }}>
          {[18, 34, 52, 70].map((x, i) => (
            <span key={i} className="absolute top-[18%]" style={{ left: `${x}%`, transform: `rotate(${i * 37}deg)` }}>
              <Slice />
            </span>
          ))}
        </div>
        <div className="absolute top-[14%] right-[10%] h-2 w-[30%] rotate-[-25deg] rounded-full bg-[#9aa1a8]" />
        {/* The sand's grain */}
        {[...Array(30)].map((_, i) => (
          <span key={i} className="absolute h-1 w-1 rounded-full bg-[#b89a60]/50" style={{ left: `${(i * 37) % 100}%`, top: `${30 + ((i * 53) % 68)}%` }} />
        ))}
        {drops.map((d) => (
          <span key={d.key} className="absolute" style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, transform: `translate(-50%,0) rotate(${(d.key * 47) % 360}deg)` }}>
            <Slice />
          </span>
        ))}
        {/* The paper cone */}
        <div className="absolute bottom-[4%] h-[14%] w-[24%] -translate-x-1/2" style={{ left: `${paper * 100}%` }}>
          {/* A sheet of old newspaper folded into a cone: the printed lines, a grease stain */}
          <div className="h-full w-full shadow-[0_6px_12px_rgba(0,0,0,0.3)]" style={{ clipPath: 'polygon(0 0, 100% 0, 78% 100%, 22% 100%)', background: 'repeating-linear-gradient(#efe9dc 0 5px, #c9c2b3 5px 6px)' }} />
          <div className="absolute top-[18%] left-[30%] h-[40%] w-[30%] rounded-full bg-[#d8b46a]/50 blur-[2px]" />
          <div className="absolute inset-x-0 top-0 h-[4px] bg-[#b9b1a0]" />
        </div>
      </div>
      <div className="text-[13px] font-extrabold text-white/80">Tombés dans le sable : {n.lost}</div>
    </div>
  )
}

/** The egg: every bit of shell off. */
function Peel({ onDone }: { onDone: (score: number) => void }) {
  const [bits, setBits] = useState(() => [...Array(14)].map((_, i) => ({ i, a: (i / 14) * Math.PI * 2 + Math.random() * 0.3, r: 0.25 + Math.random() * 0.17 })))
  const t0 = useRef(performance.now())
  const peel = (i: number) => {
    haptic('light')
    gesture('busy', 600)
    const left = bits.filter((b) => b.i !== i)
    setBits(left)
    if (!left.length) {
      const secs = (performance.now() - t0.current) / 1000
      setTimeout(() => onDone(Math.max(30, Math.round(100 - Math.max(0, secs - 6) * 6))), 400)
    }
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#2a1a08]/70 p-4">
      <div className="card px-4 py-2 text-center">
        <div className="font-display text-[17px] font-extrabold">Écaille l’œuf</div>
        <div className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">Touche chaque morceau de coquille. Reste {bits.length}</div>
      </div>
      <div className="relative aspect-[4/5] w-[min(62vw,40vh,260px)]">
        <div className="absolute inset-[12%] rounded-[50%_50%_46%_46%/58%_58%_42%_42%] bg-[radial-gradient(circle_at_40%_35%,#ffffff,#f1ece2)] shadow-[0_10px_24px_rgba(0,0,0,0.4)]" />
        {bits.map((b) => (
          <button key={b.i} className="absolute h-[22%] w-[24%] -translate-x-1/2 -translate-y-1/2 bg-[#efe3cf] shadow-[inset_0_0_0_2px_#d8c6a6]" style={{ left: `${50 + Math.cos(b.a) * b.r * 100}%`, top: `${50 + Math.sin(b.a) * b.r * 110}%`, clipPath: 'polygon(10% 20%, 70% 0, 100% 45%, 80% 100%, 20% 85%, 0 50%)' }} onPointerDown={(e) => (e.preventDefault(), peel(b.i))} aria-label="Coquille" />
        ))}
      </div>
    </div>
  )
}
