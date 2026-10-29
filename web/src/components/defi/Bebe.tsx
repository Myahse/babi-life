import { useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/native'
import { baby } from '../../audio/baby'

// The baby's little games (the update « bebe-jeux », as défis: components/Defi.tsx):
// coucou-caché with maman (laugh the moment her hands open), the cubes piled
// up (drop each one on the one under it), the first steps to papa (keep the
// balance) and the hochet shaken in rhythm. Each gives a score out of 100.

type End = { onEnd: (score: number) => void }

/** The top line: the game's name, how far, the points so far. */
function Top({ title, step, of, note }: { title: string; step: number; of: number; note?: string }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 text-white">
      <div className="leading-tight">
        <div className="font-display text-[13px] font-extrabold tracking-wider text-white/70">
          {Math.min(step + 1, of)} / {of}
        </div>
        <div className="font-display text-[17px] font-extrabold">{title}</div>
      </div>
      {note && <div className="rounded-full bg-white/20 px-3 py-1 text-[13px] font-extrabold">{note}</div>}
    </div>
  )
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

// ——— Coucou-caché ———

const ROUNDS = 6

export function CoucouDefi({ onEnd }: End) {
  const [round, setRound] = useState(0)
  const [open, setOpen] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const scores = useRef<number[]>([])
  const opened = useRef(0)
  const done = useRef(false)
  // Her hands over her face a moment (never the same), then « Coucou ! », a short while.
  useEffect(() => {
    if (round >= ROUNDS) return
    done.current = false
    setOpen(false)
    const wait = setTimeout(() => ((opened.current = performance.now()), setOpen(true)), 900 + Math.random() * 2200)
    const shut = setTimeout(() => !done.current && result(0, 'Trop tard : maman a déjà refermé !'), 900 + 2200 + 1300)
    return () => (clearTimeout(wait), clearTimeout(shut))
  }, [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const result = (s: number, line: string) => {
    done.current = true
    scores.current.push(s)
    setSaid(line)
    haptic(s >= 50 ? 'success' : 'error')
    setTimeout(() => {
      setSaid(null)
      if (round + 1 >= ROUNDS) onEnd(avg(scores.current))
      else setRound(round + 1)
    }, 1000)
  }
  const laugh = () => {
    if (done.current) return
    if (!open) return result(0, 'Trop tôt ! Ses mains sont encore fermées.')
    const rt = performance.now() - opened.current
    baby.giggle()
    result(Math.max(10, Math.round(100 - rt / 9)), rt < 350 ? 'Éclat de rire ! Maman fond.' : 'Hihihi ! Maman sourit.')
  }
  return (
    <div className="flex h-full flex-col">
      <Top title="Coucou-caché avec maman" step={round} of={ROUNDS} />
      <div className="relative mx-3 mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-[#ffe3c2]">
        {/* Maman's face, her two hands over it, opening */}
        <div className="relative h-56 w-48">
          <div className="absolute inset-x-6 top-0 h-12 rounded-t-[22px] bg-[#1b1410]" />
          <div className="absolute inset-x-6 top-8 h-40 rounded-[18px] bg-[#8a5532]">
            <div className="absolute top-12 left-6 h-4 w-4 rounded-full bg-white" />
            <div className="absolute top-12 right-6 h-4 w-4 rounded-full bg-white" />
            <div className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-[#7a1f2b] transition-all ${open ? 'top-24 h-8 w-14' : 'top-26 h-2 w-10'}`} />
          </div>
          {[-1, 1].map((s) => (
            <div key={s} className="absolute top-14 h-24 w-20 rounded-[16px] bg-[#a46c42] shadow-lg transition-transform duration-150" style={{ left: s < 0 ? 18 : 94, transform: open ? `translateX(${s * 70}px) rotate(${s * 25}deg)` : 'none' }} />
          ))}
        </div>
        {open && !said && <div className="animate-pop absolute top-6 font-display text-[34px] font-extrabold text-[#e05a00]">Coucou !</div>}
        {said && <div className="animate-pop absolute inset-x-6 bottom-6 rounded-[18px] bg-white/95 p-3 text-center text-[15px] font-extrabold text-[var(--color-ink)]">{said}</div>}
      </div>
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn w-full !py-4 !text-base" onPointerDown={laugh}>
          Rire !
        </button>
      </div>
    </div>
  )
}

// ——— Les cubes ———

const CUBES = 8
const COLORS = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc', '#ff922b', '#f783ac', '#38d9a9']

export function CubesDefi({ onEnd }: End) {
  // Each cube's place across (0–100) and width; the one on top slides back and forth.
  const [stack, setStack] = useState<{ x: number; w: number }[]>([{ x: 25, w: 50 }])
  const [x, setX] = useState(0)
  const dir = useRef(1)
  const over = useRef(false)
  const top = stack[stack.length - 1]
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const speed = 38 + stack.length * 9
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setX((v) => {
        let n = v + dir.current * speed * dt
        if (n > 100 - top.w) (n = 100 - top.w), (dir.current = -1)
        if (n < 0) (n = 0), (dir.current = 1)
        return n
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [stack.length, top.w])
  const drop = () => {
    if (over.current) return
    // What overlaps the cube under it stays; the rest falls off.
    const l = Math.max(x, top.x)
    const r = Math.min(x + top.w, top.x + top.w)
    const w = r - l
    const placed = stack.length - 1
    if (w <= 2) {
      over.current = true
      haptic('error')
      return setTimeout(() => onEnd(Math.round((100 * placed) / CUBES)), 700)
    }
    haptic(w > top.w - 3 ? 'success' : 'medium')
    const next = [...stack, { x: l, w }]
    setStack(next)
    if (next.length - 1 >= CUBES) {
      over.current = true
      // All piled: the higher and the wider the tower stays, the better.
      setTimeout(() => onEnd(Math.round(60 + 40 * (w / 50))), 700)
    }
  }
  const H = 34
  return (
    <div className="flex h-full flex-col" onPointerDown={drop}>
      <Top title="La tour de cubes" step={stack.length - 1} of={CUBES} note="Touche pour lâcher" />
      <div className="relative mx-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-[#fff4e8]">
        <div className="absolute inset-x-0 bottom-0 h-6 bg-[#e8c99a]" />
        {stack.map((c, i) => (
          <div key={i} className="absolute rounded-[6px] border-2 border-black/15" style={{ left: `${c.x}%`, width: `${c.w}%`, bottom: 24 + i * H, height: H, background: COLORS[i % COLORS.length] }} />
        ))}
        {!over.current && <div className="absolute rounded-[6px] border-2 border-black/15" style={{ left: `${x}%`, width: `${top.w}%`, bottom: 24 + stack.length * H + 18, height: H, background: COLORS[stack.length % COLORS.length] }} />}
      </div>
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn w-full !py-4 !text-base">Lâcher le cube</button>
      </div>
    </div>
  )
}

// ——— Les premiers pas ———

export function PasDefi({ onEnd }: End) {
  // How far to papa (0–100), how the baby leans (-1 … 1: past that, it sits down hard).
  const st = useRef({ d: 0, lean: 0, push: 0, hold: 0, falls: 0, down: 0, t: 0, over: false })
  const [, redraw] = useState(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = st.current
      if (!s.over) {
        s.t += dt
        if (s.down > 0) s.down -= dt
        else {
          // The wobble: it leans more the more it leans, a push now and then; the player's hand puts it back.
          if (Math.random() < dt * 1.4) s.push = (Math.random() - 0.5) * 2.2
          s.lean += (s.lean * 1.1 + s.push + s.hold * -2.6) * dt
          s.push *= 1 - dt * 2
          s.d = Math.min(100, s.d + dt * 7 * (1 - Math.abs(s.lean) * 0.6))
          if (Math.abs(s.lean) >= 1) {
            s.falls++
            s.down = 1.2
            s.lean = 0
            haptic('error')
            baby.whimper()
          }
          if (s.d >= 100) {
            s.over = true
            haptic('success')
            baby.giggle()
            const score = Math.round(Math.max(10, Math.min(100, 110 - s.falls * 15 - Math.max(0, s.t - 16) * 3)))
            setTimeout(() => onEnd(score), 800)
          }
        }
      }
      redraw((n) => n + 1)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [onEnd])
  const s = st.current
  const hold = (v: number) => ({
    onPointerDown: () => (st.current.hold = -v),
    onPointerUp: () => (st.current.hold = 0),
    onPointerCancel: () => (st.current.hold = 0),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  return (
    <div className="flex h-full flex-col">
      <Top title="Les premiers pas vers papa" step={0} of={1} note={s.falls ? `${s.falls} chute${s.falls > 1 ? 's' : ''}` : undefined} />
      <div className="relative mx-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-[#fff4e8]">
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[#d9b38c]" />
        {/* Papa, arms open, at the end */}
        <div className="absolute right-[6%] bottom-[30%] flex flex-col items-center">
          <div className="h-8 w-8 rounded-[8px] bg-[#6e4024]" />
          <div className="h-14 w-16 rounded-[8px] bg-[#2a6cf0]" />
          <div className="text-[12px] font-extrabold text-[var(--color-ink-soft)]">Papa</div>
        </div>
        {/* The baby, leaning, or sat down */}
        <div className="absolute bottom-[30%] flex flex-col items-center transition-[left] duration-75" style={{ left: `${6 + s.d * 0.7}%`, transform: s.down > 0 ? 'translateY(10px) scaleY(0.7)' : `rotate(${s.lean * 35}deg)`, transformOrigin: '50% 100%' }}>
          <div className="h-7 w-7 rounded-[7px] bg-[#8a5532]" />
          <div className="h-9 w-9 rounded-[7px] bg-[#ffc9de]" />
        </div>
        {s.down > 0 && <div className="animate-pop absolute top-6 inset-x-0 text-center font-display text-[24px] font-extrabold text-[#e05a00]">Boum ! On se relève…</div>}
        {/* How it leans: keep the needle in the green */}
        <div className="absolute inset-x-8 top-4 h-3 rounded-full" style={{ background: 'linear-gradient(90deg, #e03131, #ffd43b 25%, #69db7c 40% 60%, #ffd43b 75%, #e03131)' }}>
          <span className="absolute -top-1 h-5 w-1.5 rounded-full bg-[var(--color-ink)]" style={{ left: `calc(${50 + s.lean * 50}% - 3px)` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn touch-none !py-4 !text-base select-none" {...hold(-1)}>
          ◀ Pencher
        </button>
        <button className="btn touch-none !py-4 !text-base select-none" {...hold(1)}>
          Pencher ▶
        </button>
      </div>
    </div>
  )
}

// ——— Le hochet en rythme ———

const BEATS = 12
const BEAT = 0.8

export function HochetDefi({ onEnd }: End) {
  const start = useRef(performance.now() + 1200)
  const hits = useRef<number[]>([])
  const [, redraw] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const over = useRef(false)
  useEffect(() => {
    let raf = 0
    const step = () => {
      const t = (performance.now() - start.current) / 1000
      // A beat let go by, not shaken: missed.
      while (hits.current.length < BEATS && t > hits.current.length * BEAT + 0.3) hits.current.push(0)
      if (hits.current.length >= BEATS && !over.current) {
        over.current = true
        setTimeout(() => onEnd(avg(hits.current)), 600)
      }
      redraw((n) => n + 1)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [onEnd])
  const shake = () => {
    if (over.current) return
    const t = (performance.now() - start.current) / 1000
    const i = Math.round(t / BEAT)
    if (i < hits.current.length || i >= BEATS || i < 0) return
    const off = Math.abs(t - i * BEAT)
    const s = off < 0.08 ? 100 : off < 0.16 ? 60 : off < 0.26 ? 30 : 0
    while (hits.current.length < i) hits.current.push(0)
    hits.current.push(s)
    setSaid(s === 100 ? 'Parfait !' : s >= 60 ? 'Bien !' : s ? 'Presque…' : 'Raté')
    haptic(s >= 60 ? 'light' : 'error')
  }
  const t = (performance.now() - start.current) / 1000
  const k = Math.max(0, Math.min(1, 1 - (((t % BEAT) + BEAT) % BEAT) / BEAT))
  return (
    <div className="flex h-full flex-col" onPointerDown={shake}>
      <Top title="Le hochet en rythme" step={hits.current.length} of={BEATS} note={said ?? undefined} />
      <div className="relative mx-3 mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-[#2b1d4a]">
        {/* The ring to hit, the circle closing in on it, each beat */}
        <div className="absolute h-28 w-28 rounded-full border-[6px] border-[#ffd43b]" />
        {t > -0.8 && <div className="absolute rounded-full border-[4px] border-white/80" style={{ width: 112 + k * 160, height: 112 + k * 160 }} />}
        <div className="font-display text-[40px] font-extrabold text-white" style={{ transform: `rotate(${Math.sin(performance.now() / 60) * (said ? 18 : 4)}deg)` }}>
          ♪
        </div>
        {t < 0 && <div className="absolute bottom-6 text-[15px] font-extrabold text-white/80">Prêt… secoue quand le cercle touche l'anneau !</div>}
      </div>
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn w-full !py-4 !text-base">Secouer le hochet</button>
      </div>
    </div>
  )
}
