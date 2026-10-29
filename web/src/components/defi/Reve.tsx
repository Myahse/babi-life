import { useEffect, useRef, useState } from 'react'
import { Bug, Cloud, Receipt, Ruler, Star, type LucideIcon } from 'lucide-react'
import { haptic } from '../../lib/native'
import { GestesDefi } from './Gestes'

// Le rêve (the update « gestes-maison »): once in bed, the night is a dream. The
// Sim floats in a purple sky; drag it (or the arrows) up and down to gather the
// stars and the sheep up to the dream's target, and keep clear of the nightmares:
// the giant mosquito, the CIE bill, the maître and his chicotte (each costs
// stars; three, and you wake up). A good dream, a good night (the score is the
// night's: backend sims/defi.go, the « dodo »).

/** The stars to gather (a sheep is two); the nightmares that wake you up. */
const TARGET = 25
const WAKE = 3
type Thing = { key: number; kind: 'etoile' | 'mouton' | 'moustique' | 'facture' | 'maitre'; x: number; y: number; v: number; hit?: boolean }
const GOOD = new Set(['etoile', 'mouton'])
// (Drawn, not emoji: the same on every phone.)
const FACE: Record<Exclude<Thing['kind'], 'mouton'>, [LucideIcon, string]> = { etoile: [Star, '#ffd43b'], moustique: [Bug, '#ff6b6b'], facture: [Receipt, '#ff922b'], maitre: [Ruler, '#e64980'] }

/** A sheep to count: a woolly cloud, a black face, four legs. */
function Sheep() {
  return (
    <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden>
      {[8, 16, 24, 32].map((x) => (
        <rect key={x} x={x} y="24" width="3" height="9" fill="#2b2b2b" />
      ))}
      {[[10, 14], [18, 10], [26, 10], [33, 14], [14, 20], [24, 20], [31, 20]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="8" fill="#fbfbfb" />
      ))}
      <ellipse cx="6" cy="14" rx="5" ry="6" fill="#2b2b2b" />
    </svg>
  )
}
const NAME: Record<string, string> = { moustique: 'Le moustique géant !', facture: 'La facture de la CIE !', maitre: 'Le maître et sa chicotte !' }

export function ReveDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const st = useRef({ y: 0.5, key: 0, good: 0, bad: 0, next: 0.4, t: 0, done: false, things: [] as Thing[] })
  const [, redraw] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const finish = useRef(onEnd)
  finish.current = onEnd
  const steer = (clientY: number) => {
    const r = box.current!.getBoundingClientRect()
    st.current.y = Math.min(0.9, Math.max(0.1, (clientY - r.top) / r.height))
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d = e.key === 'ArrowUp' ? -0.08 : e.key === 'ArrowDown' ? 0.08 : 0
      if (d) st.current.y = Math.min(0.9, Math.max(0.1, st.current.y + d))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = st.current
      if (!s.done) {
        s.t += dt
        s.next -= dt
        // The dream brings things from the right, a nightmare now and then (more as the night goes on).
        if (s.next <= 0) {
          s.next = 0.55 + Math.random() * 0.35
          const bad = Math.random() < 0.3 + s.t / 120
          const kind: Thing['kind'] = bad ? (['moustique', 'facture', 'maitre'] as const)[Math.floor(Math.random() * 3)] : Math.random() < 0.7 ? 'etoile' : 'mouton'
          s.things.push({ key: s.key++, kind, x: 1.08, y: 0.1 + Math.random() * 0.8, v: 0.28 + Math.random() * 0.12 + s.t / 200 })
        }
        for (const th of s.things) {
          th.x -= th.v * dt
          // Met by the dreaming Sim (on the left, at its height).
          if (!th.hit && Math.abs(th.x - 0.18) < 0.07 && Math.abs(th.y - s.y) < 0.09) {
            th.hit = true
            if (GOOD.has(th.kind)) {
              s.good += th.kind === 'mouton' ? 2 : 1
              haptic('light')
            } else {
              s.bad++
              s.good = Math.max(0, s.good - 3)
              haptic('error')
              setSaid(NAME[th.kind])
              setTimeout(() => setSaid(null), 1100)
            }
          }
        }
        s.things = s.things.filter((th) => th.x > -0.1 && !(th.hit && GOOD.has(th.kind)))
        // The target reached: a good dream (quicker and calmer, better); woken up by the nightmares: a bad night.
        if (s.good >= TARGET || s.bad >= WAKE) {
          s.done = true
          const score = s.good >= TARGET ? 100 - s.bad * 15 - Math.max(0, s.t - 25) * 1.5 : (s.good / TARGET) * 50
          if (s.bad >= WAKE) setSaid('Réveillé·e en sursaut !')
          setTimeout(() => finish.current(Math.max(0, Math.min(100, Math.round(score)))), 800)
        }
        redraw((n) => n + 1)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const s = st.current
  return (
    <div ref={box} className="absolute inset-0 touch-none overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 30% 20%, #6b3fa0, #2b1a5a 55%, #0d0a26)' }} onPointerDown={(e) => steer(e.clientY)} onPointerMove={(e) => (e.buttons || e.pointerType === 'touch') && steer(e.clientY)}>
      {/* The dream's sky: faint stars far away */}
      {[...Array(24)].map((_, i) => (
        <span key={i} className="absolute h-1 w-1 rounded-full bg-white/50" style={{ left: `${(i * 41) % 100}%`, top: `${(i * 67) % 100}%` }} />
      ))}
      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/35 px-4 py-1.5 text-[13px] font-extrabold text-white">
        <span>Le rêve</span>
        <span className="flex items-center gap-1">
          <Star size={14} fill="#ffd43b" color="#ffd43b" /> {Math.min(s.good, TARGET)}/{TARGET}
        </span>
        <span className="flex items-center gap-1">
          <Bug size={14} color="#ff6b6b" /> {s.bad}/{WAKE}
        </span>
      </div>
      {s.things.map((th) => (
        <span key={th.key} className={`absolute -translate-x-1/2 -translate-y-1/2 ${th.hit ? 'opacity-40' : ''}`} style={{ left: `${th.x * 100}%`, top: `${th.y * 100}%` }}>
          {th.kind === 'mouton' ? (
            <Sheep />
          ) : (
            (() => {
              const [Icon, color] = FACE[th.kind]
              return <Icon size={36} strokeWidth={2.4} color={color} fill={th.kind === 'etoile' ? color : 'none'} />
            })()
          )}
        </span>
      ))}
      {/* The dreamer, asleep on a cloud */}
      <span className="absolute -translate-x-1/2 -translate-y-1/2 transition-[top] duration-100" style={{ left: '18%', top: `${s.y * 100}%` }}>
        <Cloud size={58} strokeWidth={2} color="#ffffff" fill="#e9e4ff" />
        <span className="absolute -top-3 right-0 font-display text-[15px] font-extrabold text-white">Zzz</span>
      </span>
      {said && <div className="absolute top-16 left-1/2 -translate-x-1/2 animate-pop rounded-2xl bg-[#ff3d57] px-4 py-2 font-display text-[16px] font-extrabold text-white">{said}</div>}
      <div className="absolute inset-x-0 bottom-5 text-center text-[13px] font-extrabold text-white/75">Glisse le doigt vers le haut ou le bas : {TARGET} étoiles pour un beau rêve (un mouton en vaut deux). Trois cauchemars, et tu te réveilles.</div>
    </div>
  )
}

/** Going to bed (the gestures), then the night dreamt: the dream counts most. */
export function DodoDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const [bed, setBed] = useState<number | null>(null)
  return bed === null ? <GestesDefi kind="dodo" onEnd={setBed} /> : <ReveDefi onEnd={(dream) => onEnd(Math.round(bed * 0.25 + dream * 0.75))} />
}
