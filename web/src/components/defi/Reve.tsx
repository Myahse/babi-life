import { useEffect, useRef, useState } from 'react'
import { Bug, Receipt, Ruler, Star, type LucideIcon } from 'lucide-react'
import { haptic } from '../../lib/native'
import type { Look } from '../../lib/types'
import { GestesDefi } from './Gestes'

// Le rêve (the update « gestes-maison »): once in bed, the night is a dream.
// The perso sleeps on a flying mattress over Abidjan by night (the Plateau's
// towers, the cathedral, the Pyramide, the lagoon and its bridge going by). A
// tap and it rises, let go and it sinks: gather the stars (a sheep jumping its
// fence is worth two) up to the dream's target, and keep clear of the
// nightmares, the giant mosquito, the CIE bill, the maître and his chicotte:
// each costs stars, and three wake you up. A good dream, a good night (the
// score is the night's: backend sims/defi.go, the « dodo »).

/** The nightmares that wake you up. */
const WAKE = 3
const GRAVITY = 1.1
const FLAP = -0.55
type Thing = { key: number; kind: 'etoile' | 'mouton' | 'moustique' | 'facture' | 'maitre'; x: number; y: number; v: number; hit?: boolean; wob: number }
const GOOD = new Set(['etoile', 'mouton'])
// (Drawn, not emoji: the same on every phone.)
const FACE: Record<Exclude<Thing['kind'], 'mouton'>, [LucideIcon, string]> = { etoile: [Star, '#ffd43b'], moustique: [Bug, '#ff6b6b'], facture: [Receipt, '#ff922b'], maitre: [Ruler, '#e64980'] }
const NAME: Record<string, string> = { moustique: 'Le moustique géant !', facture: 'La facture de la CIE !', maitre: 'Le maître et sa chicotte !' }

/** A sheep jumping its little fence, to count. */
function Sheep() {
  return (
    <svg width="46" height="40" viewBox="0 0 46 40" aria-hidden>
      <rect x="4" y="30" width="38" height="3" fill="#a07a4a" />
      <rect x="8" y="26" width="3" height="12" fill="#a07a4a" />
      <rect x="35" y="26" width="3" height="12" fill="#a07a4a" />
      {[12, 20, 28, 34].map((x) => (
        <rect key={x} x={x} y="18" width="3" height="8" fill="#2b2b2b" />
      ))}
      {[[14, 10], [22, 7], [30, 9], [35, 13], [18, 15], [27, 15]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill="#fbfbfb" />
      ))}
      <ellipse cx="8" cy="10" rx="5" ry="6" fill="#2b2b2b" />
    </svg>
  )
}

/** The sleeper on the flying mattress: pyjama, nightcap, the blanket, « Zzz ». */
function Sleeper({ look, tilt }: { look?: Look; tilt: number }) {
  const skin = look?.skin ?? '#6e4024'
  return (
    <svg width="134" height="76" viewBox="0 0 96 54" aria-hidden style={{ transform: `rotate(${tilt}deg)`, transition: 'transform 0.15s', filter: 'drop-shadow(0 6px 10px rgba(20,0,60,0.5))' }}>
      {/* The mattress, its stripes, the little tassels flapping */}
      <rect x="4" y="30" width="86" height="14" rx="6" fill="#e9e4ff" stroke="#6b5bb5" strokeWidth="2" />
      {[16, 30, 44, 58, 72].map((x) => (
        <rect key={x} x={x} y="31" width="4" height="12" fill="#c4bcf5" />
      ))}
      <path d="M4 40 l-4 4 M90 40 l5 4" stroke="#ffd43b" strokeWidth="3" />
      {/* The pillow and the head, the nightcap */}
      <ellipse cx="18" cy="26" rx="13" ry="7" fill="#fff" stroke="#c4bcf5" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="8" fill={skin} />
      <path d="M13 16 Q22 2 32 10 L36 4" fill="#ff6b9a" stroke="#c2255c" strokeWidth="1.5" />
      <circle cx="36" cy="4" r="3" fill="#fff" />
      <path d="M17 21 q2 1.5 4 0" stroke="#1a0e06" strokeWidth="1.2" fill="none" />
      {/* Under the blanket, the feet out at the end */}
      <path d="M26 30 Q50 16 84 26 L84 32 L26 32 Z" fill={look?.outfitColor ?? '#4dabf7'} stroke="#1c4f8a" strokeWidth="1.5" />
      <ellipse cx="86" cy="27" rx="4" ry="3" fill={skin} />
      <text x="40" y="12" fontSize="11" fontWeight="800" fill="#fff">
        Zzz
      </text>
    </svg>
  )
}

/** Abidjan by night far below, going by: the Plateau's towers, the cathedral, the Pyramide, the bridge on the lagoon. */
function City({ shift }: { shift: number }) {
  const skyline = (
    <svg width="800" height="160" viewBox="0 0 800 160" preserveAspectRatio="none" aria-hidden>
      {/* The lagoon and the bridge */}
      <rect x="0" y="128" width="800" height="32" fill="#1b1f4b" />
      <path d="M520 128 L520 112 L800 112 L800 128" fill="none" stroke="#3a3f7a" strokeWidth="4" />
      {[540, 580, 620, 660, 700, 740, 780].map((x) => (
        <rect key={x} x={x} y="112" width="4" height="16" fill="#3a3f7a" />
      ))}
      {/* Towers with their lit windows */}
      {[[20, 70, 30], [60, 100, 26], [94, 60, 34], [140, 120, 24], [170, 84, 30], [300, 64, 28], [336, 92, 22], [420, 54, 36]].map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={128 - h} width={w} height={h} fill="#141737" />
          {[...Array(Math.floor(h / 14))].map((_, r) =>
            [...Array(Math.floor(w / 9))].map((_, c) => ((r * 7 + c * 3 + i) % 4 ? <rect key={`${r}${c}`} x={x + 3 + c * 9} y={128 - h + 5 + r * 14} width="4" height="5" fill="#ffd76a" opacity="0.8" /> : null)),
          )}
        </g>
      ))}
      {/* The Pyramide, the cathedral's leaning tower */}
      <path d="M210 128 L240 60 L270 128 Z" fill="#191c45" />
      <path d="M370 128 L380 128 L410 30 L402 28 Z" fill="#191c45" />
      <path d="M352 128 Q380 96 420 128 Z" fill="#191c45" />
      {/* Palm trees */}
      {[480, 500].map((x) => (
        <g key={x}>
          <rect x={x} y="96" width="3" height="32" fill="#0f1230" />
          <path d={`M${x + 1} 96 q-12 -2 -16 6 M${x + 1} 96 q12 -2 16 6 M${x + 1} 96 q-4 -10 -12 -12 M${x + 1} 96 q4 -10 12 -12`} stroke="#0f1230" strokeWidth="3" fill="none" />
        </g>
      ))}
    </svg>
  )
  return (
    <div className="absolute inset-x-0 bottom-0 h-[26%] overflow-hidden opacity-90">
      <div className="absolute bottom-0 flex h-full" style={{ transform: `translateX(${-(shift % 800)}px)` }}>
        {skyline}
        {skyline}
        {skyline}
      </div>
    </div>
  )
}

export function ReveDefi({ onEnd, target = 25, look }: { onEnd: (score: number) => void; /** The stars to gather (a nap: fewer). */ target?: number; look?: Look }) {
  const st = useRef({ y: 0.45, vy: 0, key: 0, good: 0, bad: 0, next: 0.6, t: 0, done: false, shift: 0, started: false, things: [] as Thing[] })
  const [, redraw] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const finish = useRef(onEnd)
  finish.current = onEnd
  // A tap (or the space bar, the up arrow): the mattress rises.
  const flap = () => {
    const s = st.current
    s.started = true
    s.vy = FLAP
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
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
        s.shift += dt * 60
        // Floating gently until the first tap; then it sinks unless tapped.
        if (s.started) {
          s.vy = Math.min(0.9, s.vy + GRAVITY * dt)
          s.y += s.vy * dt
          if (s.y > 0.7) {
            s.y = 0.7
            s.vy = -0.2
          }
          if (s.y < 0.08) {
            s.y = 0.08
            s.vy = 0
          }
        } else s.y = 0.45 + Math.sin(now / 500) * 0.03
        s.t += dt
        s.next -= dt
        if (s.started && s.next <= 0) {
          s.next = 0.5 + Math.random() * 0.4
          const bad = Math.random() < 0.28 + s.t / 150
          const kind: Thing['kind'] = bad ? (['moustique', 'facture', 'maitre'] as const)[Math.floor(Math.random() * 3)] : Math.random() < 0.75 ? 'etoile' : 'mouton'
          s.things.push({ key: s.key++, kind, x: 1.08, y: 0.1 + Math.random() * 0.58, v: 0.26 + Math.random() * 0.1 + s.t / 260, wob: Math.random() * 6 })
        }
        for (const th of s.things) {
          th.x -= th.v * dt
          // The mosquito zigzags.
          const y = th.kind === 'moustique' ? th.y + Math.sin(now / 250 + th.wob) * 0.04 : th.y
          if (!th.hit && Math.abs(th.x - 0.24) < 0.08 && Math.abs(y - s.y) < 0.08) {
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
        if (s.good >= target || s.bad >= WAKE) {
          s.done = true
          const score = s.good >= target ? 100 - s.bad * 15 - Math.max(0, s.t - target) * 1.5 : (s.good / target) * 50
          setSaid(s.bad >= WAKE ? 'Réveillé·e en sursaut !' : 'Quel beau rêve…')
          setTimeout(() => finish.current(Math.max(0, Math.min(100, Math.round(score)))), 900)
        }
        redraw((n) => n + 1)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  const s = st.current
  const now = performance.now()
  return (
    <div className="absolute inset-0 touch-none overflow-hidden select-none" style={{ background: 'linear-gradient(#1a0f4a 0%, #4b2a8a 55%, #8a4fa8 80%, #2a1d5a 100%)' }} onPointerDown={(e) => (e.preventDefault(), flap())}>
      {/* The sky: the stars far away twinkling, the moon */}
      {[...Array(30)].map((_, i) => (
        <span key={i} className="absolute h-1 w-1 animate-pulse rounded-full bg-white/60" style={{ left: `${(i * 41) % 100}%`, top: `${(i * 67) % 70}%`, animationDelay: `${(i % 7) * 0.3}s` }} />
      ))}
      <div className="absolute top-[8%] right-[10%] h-16 w-16 rounded-full bg-[#fff6d0] shadow-[0_0_40px_10px_rgba(255,240,180,0.35)]" />
      <City shift={s.shift} />
      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/35 px-4 py-1.5 text-[13px] font-extrabold text-white">
        <span className="flex items-center gap-1">
          <Star size={14} fill="#ffd43b" color="#ffd43b" /> {Math.min(s.good, target)}/{target}
        </span>
        <span className="flex items-center gap-1">
          <Bug size={14} color="#ff6b6b" /> {s.bad}/{WAKE}
        </span>
      </div>
      {s.things.map((th) => {
        const y = th.kind === 'moustique' ? th.y + Math.sin(now / 250 + th.wob) * 0.04 : th.y
        return (
          <span key={th.key} className={`absolute -translate-x-1/2 -translate-y-1/2 ${th.hit ? 'opacity-40' : ''}`} style={{ left: `${th.x * 100}%`, top: `${y * 100}%` }}>
            {th.kind === 'mouton' ? (
              <Sheep />
            ) : (
              (() => {
                const [Icon, color] = FACE[th.kind]
                const big = th.kind !== 'etoile'
                return <Icon size={big ? 44 : 32} strokeWidth={2.4} color={color} fill={th.kind === 'etoile' ? color : big ? `${color}33` : 'none'} />
              })()
            )}
          </span>
        )
      })}
      {/* The dreamer on the flying mattress */}
      <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: '24%', top: `${s.y * 100}%` }}>
        <Sleeper look={look} tilt={Math.max(-14, Math.min(14, s.vy * 22))} />
      </span>
      {said && <div className="absolute top-16 left-1/2 -translate-x-1/2 animate-pop rounded-2xl bg-[#ff3d57] px-4 py-2 font-display text-[16px] font-extrabold whitespace-nowrap text-white">{said}</div>}
      {/* Before the first tap: how it's played (then the sky is all the dream's) */}
      {!s.started && (
        <div className="absolute inset-x-6 top-[58%] text-center">
          <div className="font-display text-[22px] font-extrabold text-white [text-shadow:0_2px_0_rgba(0,0,0,0.4)]">Touche l’écran pour t’envoler !</div>
          <div className="mt-1 text-[13px] font-extrabold text-white/85">Touche pour monter, lâche pour descendre : {target} étoiles (un mouton en vaut deux). Trois cauchemars, et tu te réveilles.</div>
        </div>
      )}
    </div>
  )
}

/** Going to bed (the gestures, each one seen), then the night dreamt: the dream counts most. A nap: a shorter dream. */
export function DodoDefi({ onEnd, nap, look }: { onEnd: (score: number) => void; nap?: boolean; look?: Look }) {
  const [bed, setBed] = useState<number | null>(null)
  return bed === null ? <GestesDefi kind="dodo" look={look} onEnd={setBed} /> : <ReveDefi target={nap ? 15 : 25} look={look} onEnd={(dream) => onEnd(Math.round(bed * 0.25 + dream * 0.75))} />
}
