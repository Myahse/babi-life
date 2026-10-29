import { useEffect, useId, useRef, useState } from 'react'
import { GlassWater, Hand } from 'lucide-react'
import { haptic } from '../../lib/native'
import { gesture } from '../../world3d/gesture'

// Le garba, played (the update « gestes-maison »). First at the garbadrome's
// bassine: the pieces of fried fish sizzle in the oil, the tantie calls one
// (« La darne de thon ! ») and you fish it out before the other customers' hands
// do. Then the plate: tap the attiéké with the fork, « pommer » a ball in the hand
// (held: it packs, let go in the green), but every mouthful fills the throat: the
// attiéké doesn't go down easily. Too full and you choke (time lost): drink some
// water. Plate empty, the garba is eaten.

const PIECES = [
  { id: 'thon', name: 'La darne de thon', w: 74 },
  { id: 'chinchard', name: 'Le chinchard', w: 86 },
  { id: 'carpe', name: 'Le morceau de carpe', w: 70 },
  { id: 'tete', name: 'La tête de carpe', w: 64 },
] as const
type PieceId = (typeof PIECES)[number]['id']
type Piece = { key: number; kind: PieceId; x: number; y: number; vx: number; vy: number; rot: number }

/**
 * A piece of fried fish, as it comes out of the oil: the crust browned at the
 * edges and golden on top, the flesh paler where it was cut, the skin (silver on
 * the chinchard, scaled on the carpe), the backbone in the darne.
 */
export function FishPiece({ kind, size = 1 }: { kind: PieceId; size?: number }) {
  const id = useId().replace(/:/g, '')
  const w = PIECES.find((p) => p.id === kind)!.w * size
  const crust = (
    <radialGradient id={`c${id}`} cx="45%" cy="38%" r="70%">
      <stop offset="0" stopColor="#e6a24a" />
      <stop offset="0.55" stopColor="#b8681f" />
      <stop offset="1" stopColor="#5e2f0c" />
    </radialGradient>
  )
  const flesh = (
    <radialGradient id={`f${id}`} cx="50%" cy="45%" r="60%">
      <stop offset="0" stopColor="#f3d2ad" />
      <stop offset="0.7" stopColor="#d9a173" />
      <stop offset="1" stopColor="#a8622a" />
    </radialGradient>
  )
  const shine = <ellipse cx="38" cy="18" rx="16" ry="5" fill="#fff6d8" opacity="0.35" />
  return (
    <svg width={w} height={w * 0.7} viewBox="0 0 100 70" aria-hidden style={{ filter: 'drop-shadow(0 3px 2px rgba(60,25,0,0.55))' }}>
      <defs>
        {crust}
        {flesh}
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d1d8" />
          <stop offset="0.5" stopColor="#7d8893" />
          <stop offset="1" stopColor="#4a3524" />
        </linearGradient>
      </defs>
      {kind === 'thon' && (
        <g>
          {/* The darne: a thick slice, the crust all round, the cut face, the backbone */}
          <path d="M14 30 Q12 10 40 8 Q72 4 86 20 Q96 34 84 50 Q66 66 38 62 Q12 58 14 30 Z" fill={`url(#c${id})`} stroke="#4a2408" strokeWidth="2" />
          <path d="M24 31 Q24 17 44 16 Q68 14 77 25 Q84 36 76 46 Q62 56 42 53 Q24 50 24 31 Z" fill={`url(#f${id})`} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${34 + i * 9} 20 Q${30 + i * 9} 35 ${34 + i * 9} 50`} stroke="#b97a45" strokeWidth="1.6" fill="none" opacity="0.7" />
          ))}
          <circle cx="52" cy="34" r="5" fill="#efe3cf" stroke="#8a5a32" strokeWidth="1.5" />
          <circle cx="52" cy="34" r="1.8" fill="#8a5a32" />
          <path d="M20 26 Q17 40 26 52" stroke="#3a1a04" strokeWidth="3" fill="none" opacity="0.5" />
          {shine}
        </g>
      )}
      {kind === 'chinchard' && (
        <g>
          {/* A length of chinchard cut across: the silver skin crisped brown, the tail, the pale cut end */}
          <path d="M6 36 Q20 14 58 14 Q74 14 80 24 L96 12 L92 36 L97 58 L80 46 Q72 58 56 58 Q20 58 6 36 Z" fill={`url(#s${id})`} stroke="#3a2a1c" strokeWidth="2" />
          <path d="M14 36 Q24 20 52 20 Q66 22 74 30 Q66 50 52 52 Q24 52 14 36 Z" fill={`url(#c${id})`} opacity="0.75" />
          <ellipse cx="9" cy="36" rx="6" ry="15" fill={`url(#f${id})`} stroke="#6b3a12" strokeWidth="1.5" />
          <circle cx="9" cy="36" r="2" fill="#efe3cf" />
          <path d="M22 34 Q46 30 72 34" stroke="#e8e2d0" strokeWidth="2" fill="none" opacity="0.8" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${82 + i * 2} ${24 + i * 2} L${92 + i} ${16 + i * 9}`} stroke="#2f2216" strokeWidth="1" opacity="0.6" />
          ))}
          {shine}
        </g>
      )}
      {kind === 'carpe' && (
        <g>
          {/* A chunk of carpe: the scaled skin on top, crisped, the cut sides */}
          <path d="M10 40 Q8 14 34 10 Q66 6 88 18 Q98 38 86 56 Q58 66 30 62 Q10 58 10 40 Z" fill={`url(#c${id})`} stroke="#4a2408" strokeWidth="2" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3, 4].map((c) => <path key={`${r}${c}`} d={`M${20 + c * 13 + (r % 2) * 6} ${20 + r * 9} q5 6 10 0`} stroke="#7a3d10" strokeWidth="1.6" fill="none" opacity="0.75" />),
          )}
          <path d="M86 20 Q96 38 86 54 Q80 38 86 20 Z" fill={`url(#f${id})`} />
          {shine}
        </g>
      )}
      {kind === 'tete' && (
        <g>
          {/* The head of a carpe: the gill plate, the eye, the open mouth, browned all over */}
          <path d="M8 34 Q10 12 40 10 Q64 8 80 16 Q90 36 80 56 Q60 64 38 60 Q12 56 8 34 Z" fill={`url(#c${id})`} stroke="#4a2408" strokeWidth="2" />
          <path d="M58 14 Q48 36 58 58" stroke="#5e2f0c" strokeWidth="3" fill="none" />
          <path d="M80 16 Q90 36 80 56 Q74 36 80 16 Z" fill={`url(#f${id})`} />
          <circle cx="30" cy="28" r="7" fill="#f2efe6" stroke="#3a1a04" strokeWidth="2" />
          <circle cx="31" cy="28" r="3" fill="#1a0e06" />
          <path d="M8 36 L18 40 L8 44" fill="#3a1a04" />
          {shine}
        </g>
      )}
    </svg>
  )
}

const ROUNDS = 3

export function GarbaDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<'pan' | 'plate'>('pan')
  const pts = useRef({ pan: 0 })
  return phase === 'pan' ? <Pan onDone={(s) => ((pts.current.pan = s), setPhase('plate'))} /> : <Plate onDone={(s) => onEnd(Math.round(pts.current.pan * 0.4 + s * 0.6))} />
}

/** The bassine: the called piece, fished out before the other hands. */
function Pan({ onDone }: { onDone: (score: number) => void }) {
  const [pieces, setPieces] = useState<Piece[]>([])
  const piecesRef = useRef<Piece[]>([])
  piecesRef.current = pieces
  const [want, setWant] = useState<PieceId>('thon')
  const [round, setRound] = useState(0)
  const [hand, setHand] = useState<{ x: number; y: number } | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const st = useRef({ got: 0, wrong: 0, key: 0, busy: false })
  // A fresh batch out of the oil each round: two of each, drifting in the sizzle.
  const fill = () => {
    const ps: Piece[] = []
    for (const p of PIECES)
      for (let i = 0; i < 2; i++) ps.push({ key: st.current.key++, kind: p.id, x: 0.2 + Math.random() * 0.6, y: 0.22 + Math.random() * 0.56, vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08, rot: Math.random() * 360 })
    setPieces(ps)
    setWant(PIECES[Math.floor(Math.random() * PIECES.length)].id)
    st.current.busy = false
  }
  useEffect(fill, [])
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      setPieces((ps) =>
        ps.map((p) => {
          let { x, y, vx, vy } = p
          x += vx * dt
          y += vy * dt
          // Kept in the round of the bassine.
          const dx = x - 0.5
          const dy = y - 0.5
          if (Math.hypot(dx, dy) > 0.33) {
            vx = -vx
            vy = -vy
            x = 0.5 + dx * 0.97
            y = 0.5 + dy * 0.97
          }
          return { ...p, x, y, vx, vy, rot: p.rot + vx * 40 * dt }
        }),
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  // Another customer's hand comes for the piece you want: be quicker.
  useEffect(() => {
    const t = setTimeout(() => {
      const p = piecesRef.current.find((q) => q.kind === want)
      if (!p || st.current.busy) return
      setHand({ x: p.x, y: p.y })
      setTimeout(() => setHand(null), 600)
      setPieces((ps) => ps.filter((q) => q.key !== p.key))
    }, 2600 - round * 400)
    return () => clearTimeout(t)
  }, [want, round, pieces.length])
  const next = () => {
    if (st.current.busy) return
    st.current.busy = true
    if (round + 1 >= ROUNDS) {
      const s = st.current
      return setTimeout(() => onDone(Math.max(0, Math.round((s.got / ROUNDS) * 100 - s.wrong * 10))), 700)
    }
    setRound(round + 1)
    setTimeout(fill, 500)
  }
  const pick = (p: Piece) => {
    if (st.current.busy) return
    if (p.kind === want) {
      st.current.got++
      haptic('success')
      gesture('busy', 1200)
      setSaid(`${PIECES.find((f) => f.id === want)!.name}, dans le plat !`)
      setPieces((ps) => ps.filter((q) => q.key !== p.key))
      next()
    } else {
      st.current.wrong++
      haptic('error')
      setSaid('Pas celui-là !')
    }
    setTimeout(() => setSaid(null), 900)
  }
  useEffect(() => {
    if (pieces.length && !pieces.some((p) => p.kind === want) && !st.current.busy) {
      setSaid('Un autre client l’a pris…')
      setTimeout(() => setSaid(null), 900)
      next()
    }
  }, [pieces, want]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = PIECES.find((x) => x.id === want)!
  return (
    // The game in the bottom of the screen, the Sim seen above (the picture lifted: world3d/chatFraming.tsx).
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(rgba(27,18,12,0) 0%, rgba(27,18,12,0) 34%, rgba(27,18,12,0.88) 50%)' }}>
      <style>{'@keyframes garba-sizzle { 0% { transform: scale(0.4); opacity: 0.9 } 100% { transform: scale(1.6) translateY(-6px); opacity: 0 } } @keyframes garba-smoke { 0% { transform: translateY(0) scale(1); opacity: 0.35 } 100% { transform: translateY(-60px) scale(2); opacity: 0 } }'}</style>
      <div className="card flex items-center gap-3 px-4 py-2">
        <span className="label whitespace-nowrap">La tantie</span>
        <span className="font-display text-[17px] leading-tight font-extrabold">« {f.name} ! »</span>
        <FishPiece kind={want} size={0.62} />
      </div>
      <div className="text-[13px] font-extrabold text-white/80">
        Morceau {round + 1}/{ROUNDS} · pioche-le avant les autres clients
      </div>
      {/* The bassine on the fire: its black rim and handles, the oil and its bubbles */}
      <div className="relative aspect-square w-[min(82vw,42vh,380px)]">
        <div className="absolute top-1/2 -left-[4%] h-[14%] w-[10%] -translate-y-1/2 rounded-l-full border-[6px] border-r-0 border-[#26262a]" />
        <div className="absolute top-1/2 -right-[4%] h-[14%] w-[10%] -translate-y-1/2 rounded-r-full border-[6px] border-l-0 border-[#26262a]" />
        <div className="absolute inset-0 rounded-full p-[4.5%]" style={{ background: 'radial-gradient(circle at 35% 30%, #5b5b62, #2a2a2e 45%, #111114 75%)', boxShadow: '0 0 60px 10px rgba(255,120,30,0.35), inset 0 2px 0 rgba(255,255,255,0.25)' }}>
          <div className="relative h-full w-full overflow-hidden rounded-full" style={{ background: 'radial-gradient(circle at 42% 36%, #f6c45a, #d88f1f 40%, #9a560c 75%, #5a2e05)', boxShadow: 'inset 0 0 40px rgba(60,20,0,0.85)' }}>
            {/* The oil's sheen */}
            <div className="absolute top-[14%] left-[22%] h-[18%] w-[38%] rotate-[-18deg] rounded-full bg-[#fff2c0]/25 blur-md" />
            {[...Array(16)].map((_, i) => (
              <span key={i} className="absolute h-[2.2%] w-[2.2%] rounded-full border border-[#fff1b8]/70" style={{ left: `${12 + ((i * 37) % 76)}%`, top: `${12 + ((i * 53) % 76)}%`, animation: `garba-sizzle ${0.9 + (i % 5) * 0.25}s ease-out ${i * 0.17}s infinite` }} />
            ))}
            {pieces.map((p) => (
              <button key={p.key} className="absolute p-1" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `translate(-50%,-50%) rotate(${p.rot}deg)` }} onPointerDown={(e) => (e.preventDefault(), pick(p))} aria-label={PIECES.find((x) => x.id === p.kind)!.name}>
                {/* The sizzle round each piece */}
                <span className="absolute inset-[-6px] rounded-[40%] border-2 border-[#fff1b8]/40" style={{ animation: `garba-sizzle 1.1s ease-out ${(p.key % 7) * 0.13}s infinite` }} />
                <FishPiece kind={p.kind} size={1.3} />
              </button>
            ))}
          </div>
        </div>
        {/* The smoke going up */}
        {[0, 1, 2].map((i) => (
          <span key={i} className="pointer-events-none absolute h-16 w-16 rounded-full bg-white/20 blur-xl" style={{ left: `${25 + i * 22}%`, top: '8%', animation: `garba-smoke 3s ease-out ${i}s infinite` }} />
        ))}
        {hand && (
          <span className="pointer-events-none absolute animate-pop text-[#8a5a3a]" style={{ left: `${hand.x * 100}%`, top: `${hand.y * 100}%`, transform: 'translate(-50%,-50%)' }}>
            <Hand size={58} strokeWidth={2.2} fill="#9b6338" />
          </span>
        )}
      </div>
      <div className="h-6 text-[15px] font-extrabold text-[#ffd76a]">{said}</div>
    </div>
  )
}

/** One spoonful's worth of attiéké: a heap of little grains, each its own shade. */
function Clump({ seed }: { seed: number }) {
  const grains = [...Array(14)].map((_, i) => {
    const a = (seed * 7 + i * 2.39) % (Math.PI * 2)
    const r = ((seed * 13 + i * 5) % 9) * 1.2
    return { x: 13 + Math.cos(a) * r, y: 12 + Math.sin(a) * r * 0.75, c: ['#fff8dc', '#f7eccb', '#efe0b4', '#fffdf0'][(seed + i) % 4] }
  })
  return (
    <svg width="28" height="24" viewBox="0 0 26 24" aria-hidden>
      {grains.map((g, i) => (
        <circle key={i} cx={g.x} cy={g.y} r="2" fill={g.c} stroke="#d6c38f" strokeWidth="0.5" />
      ))}
    </svg>
  )
}

/** The plate: the attiéké with the fork, the balls « pommées », water for the throat. */
function Plate({ onDone }: { onDone: (score: number) => void }) {
  const [clumps, setClumps] = useState(() =>
    [...Array(24)].map((_, i) => {
      const a = (i / 24) * Math.PI * 2 * 2.6
      const r = 0.06 + ((i * 7) % 11) / 11 * 0.2
      return { i, x: 0.42 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 0.85 }
    }),
  )
  const [throat, setThroat] = useState(0)
  const [choke, setChoke] = useState(false)
  const [water, setWater] = useState(3)
  const [press, setPress] = useState<number | null>(null)
  const st = useRef({ t0: performance.now(), chokes: 0, done: false })
  useEffect(() => {
    const t = setInterval(() => setThroat((v) => Math.max(0, v - 1.2)), 200)
    return () => clearInterval(t)
  }, [])
  const swallow = (n: number, fill: number) => {
    if (choke || st.current.done) return
    const left = clumps.length - n
    setClumps((c) => c.slice(n))
    gesture('snack', 1000)
    const now = throat + fill
    if (now >= 100) {
      st.current.chokes++
      haptic('error')
      setChoke(true)
      setThroat(70)
      setTimeout(() => setChoke(false), 1600)
    } else setThroat(now)
    if (left <= 0) {
      st.current.done = true
      const secs = (performance.now() - st.current.t0) / 1000
      setTimeout(() => onDone(Math.max(0, Math.round(100 - Math.max(0, secs - 18) * 2.5 - st.current.chokes * 18))), 500)
    }
  }
  useEffect(() => {
    if (press === null) return
    const t = setInterval(() => setPress((p) => (p === null ? null : Math.min(1.1, p + 0.035))), 30)
    return () => clearInterval(t)
  }, [press !== null]) // eslint-disable-line react-hooks/exhaustive-deps
  const letGo = () => {
    if (press === null) return
    const good = press >= 0.55 && press <= 0.85
    setPress(null)
    if (good) {
      haptic('light')
      swallow(Math.min(clumps.length, 5), 26)
    } else swallow(Math.min(clumps.length, 1), 14)
  }
  const drink = () => {
    if (!water || choke) return
    setWater(water - 1)
    gesture('drink', 1200)
    setThroat((v) => Math.max(0, v - 45))
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(rgba(27,18,12,0) 0%, rgba(27,18,12,0) 34%, rgba(27,18,12,0.88) 50%)' }}>
      <div className="card px-4 py-2 text-center">
        <div className="font-display text-[17px] font-extrabold">Mange ton garba !</div>
        <div className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">Pique l’attiéké, pomme une boule… et bois avant de t’étouffer.</div>
      </div>
      <div className="flex w-full max-w-[min(470px,60vh)] items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-44 w-5 overflow-hidden rounded-full bg-white/20">
            <div className={`absolute inset-x-0 bottom-0 rounded-full ${throat > 75 ? 'bg-[#ff3d57]' : 'bg-[#ffc233]'}`} style={{ height: `${Math.min(100, throat)}%` }} />
          </div>
          <span className="text-[10px] font-extrabold text-white/80">Gorge</span>
        </div>
        {/* The plate: the attiéké heaped, the onion and tomato, the piment, the piece of thon */}
        <div className={`relative aspect-square flex-1 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.55)] ${choke ? 'motion-shake' : ''}`} style={{ background: 'radial-gradient(circle at 40% 35%, #ffffff, #e9edf1 70%, #c9d1d8)' }}>
          <div className="absolute inset-[7%] rounded-full" style={{ background: 'radial-gradient(circle at 45% 40%, #fbfcfd, #eef1f4)', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.12)' }} />
          {/* The heap's bed, under the clumps still there */}
          {clumps.length > 0 && <div className="absolute top-[24%] left-[14%] h-[52%] w-[56%] rounded-[50%] opacity-90" style={{ background: 'radial-gradient(circle at 45% 40%, #fffbe8, #f1e4bb 70%, transparent 72%)', transform: `scale(${0.4 + (clumps.length / 24) * 0.6})` }} />}
          {clumps.map((c) => (
            <button key={c.i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }} onPointerDown={(e) => (e.preventDefault(), swallow(1, 9))} aria-label="Piquer">
              <Clump seed={c.i} />
            </button>
          ))}
          {/* Onion rings, tomato, the piment */}
          {[[0.72, 0.3], [0.78, 0.42]].map(([x, y], i) => (
            <span key={i} className="pointer-events-none absolute h-[11%] w-[11%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#b0478a] bg-[#f6e6f0]/60" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} />
          ))}
          <span className="pointer-events-none absolute top-[20%] left-[56%] h-[12%] w-[12%] rounded-full border-2 border-[#c92a2a] bg-[radial-gradient(circle,#ff8787_30%,#e03131_32%,#e03131_45%,#ff8787_47%)]" />
          <svg className="pointer-events-none absolute top-[64%] left-[18%] rotate-[-20deg]" width="38" height="16" viewBox="0 0 38 16" aria-hidden>
            <path d="M2 8 Q14 1 34 6 Q36 8 34 10 Q14 15 2 8 Z" fill="#e03131" stroke="#8a1414" strokeWidth="1" />
            <path d="M34 7 L38 4" stroke="#2b8a3e" strokeWidth="2.4" />
          </svg>
          <span className="pointer-events-none absolute right-[10%] bottom-[14%] rotate-12">
            <FishPiece kind="thon" size={1.05} />
          </span>
          {choke && <div className="absolute inset-0 grid place-items-center font-display text-[28px] font-extrabold text-[#d81b3f] [text-shadow:0_2px_0_#fff]">Kof kof !</div>}
        </div>
      </div>
      <div className="flex w-full max-w-[470px] gap-2">
        <button
          className="btn flex-1 !py-3"
          onPointerDown={(e) => (e.preventDefault(), setPress(0))}
          onPointerUp={letGo}
          onPointerLeave={letGo}
          style={press !== null ? { background: press >= 0.55 && press <= 0.85 ? '#00a862' : press > 0.85 ? '#ff3d57' : undefined } : undefined}
        >
          {press === null ? 'Pommer (tiens)' : press > 0.85 ? 'Trop serré !' : press >= 0.55 ? 'Lâche !' : 'Pomme…'}
        </button>
        <button className="btn btn-soft !py-3" onClick={drink} disabled={!water}>
          <GlassWater size={18} /> Eau ({water})
        </button>
      </div>
      <div className="text-[13px] font-extrabold text-white/80">Encore {clumps.length} bouchées</div>
    </div>
  )
}
