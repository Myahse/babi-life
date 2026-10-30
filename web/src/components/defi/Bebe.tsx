import { useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/native'
import { baby } from '../../audio/baby'
import { CoucouScene, CubesScene, HochetScene, PasScene, type BabyMe, type Fall, type Steps } from './BebeScene'
import { t as tr } from '../../lib/i18n'

// The baby's little games (the update « bebe-jeux », as défis: components/Defi.tsx):
// coucou-caché with maman (laugh the moment her hands open), the cubes piled
// up (drop each one on the one under it), the first steps to papa (keep the
// balance) and the hochet shaken in rhythm. Each gives a score out of 100.

type End = { onEnd: (score: number) => void; /** The baby: the player's Sim (its look, its family's maman and papa). */ me?: BabyMe }

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

export function CoucouDefi({ onEnd, me }: End) {
  const [round, setRound] = useState(0)
  const [open, setOpen] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [laughing, setLaughing] = useState(false)
  const scores = useRef<number[]>([])
  const opened = useRef(0)
  const done = useRef(false)
  // Her hands over her face a moment (never the same), then « Coucou ! », a short while.
  useEffect(() => {
    if (round >= ROUNDS) return
    done.current = false
    setOpen(false)
    const wait = setTimeout(() => ((opened.current = performance.now()), setOpen(true)), 900 + Math.random() * 2200)
    const shut = setTimeout(() => !done.current && result(0, tr('Trop tard : maman a déjà refermé !')), 900 + 2200 + 1300)
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
    if (!open) return result(0, tr('Trop tôt ! Ses mains sont encore fermées.'))
    const rt = performance.now() - opened.current
    baby.giggle()
    setLaughing(true)
    setTimeout(() => setLaughing(false), 1300)
    result(Math.max(10, Math.round(100 - rt / 9)), rt < 350 ? tr('Éclat de rire ! Maman fond.') : tr('Hihihi ! Maman sourit.'))
  }
  return (
    <div className="flex h-full flex-col">
      <Top title={tr('Coucou-caché avec maman')} step={round} of={ROUNDS} />
      <div className="relative mx-3 mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-[#ffe3c2]">
        {/* Maman kneeling on the mat, hiding her face in her hands, then « Coucou ! »; the baby laughing */}
        <div className="absolute inset-0">
          <CoucouScene me={me} open={open} laughing={laughing} />
        </div>
        {open && !said && <div className="animate-pop absolute top-6 font-display text-[34px] font-extrabold text-[#e05a00]">{tr('Coucou !')}</div>}
        {said && <div className="animate-pop absolute inset-x-6 bottom-6 rounded-[18px] bg-white/95 p-3 text-center text-[15px] font-extrabold text-[var(--color-ink)]">{said}</div>}
      </div>
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn w-full !py-4 !text-base" onPointerDown={laugh}>
          {tr('Rire !')}
        </button>
      </div>
    </div>
  )
}

// ——— Les cubes ———

const CUBES = 8
const COLORS = ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc', '#ff922b', '#f783ac', '#38d9a9']

export function CubesDefi({ onEnd, me }: End) {
  // Each cube's place across (0–100) and width; the one on top slides back and forth.
  const [stack, setStack] = useState<{ x: number; w: number }[]>([{ x: 25, w: 50 }])
  const [x, setX] = useState(0)
  // What fell off (the overhang, or the whole block missed), and a cheer for a clean drop.
  const [falls, setFalls] = useState<Fall[]>([])
  const [cheer, setCheer] = useState(false)
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
    const fell = (fx: number, fw: number) => fw > 0.5 && setFalls((f) => [...f.slice(-5), { x: fx, w: fw, i: stack.length, at: performance.now() }])
    if (w <= 2) {
      over.current = true
      fell(x, top.w)
      haptic('error')
      return setTimeout(() => onEnd(Math.round((100 * placed) / CUBES)), 700)
    }
    haptic(w > top.w - 3 ? 'success' : 'medium')
    fell(x < top.x ? x : r, top.w - w)
    if (w > top.w - 3) (setCheer(true), setTimeout(() => setCheer(false), 900))
    const next = [...stack, { x: l, w }]
    setStack(next)
    if (next.length - 1 >= CUBES) {
      over.current = true
      // All piled: the higher and the wider the tower stays, the better.
      setTimeout(() => onEnd(Math.round(60 + 40 * (w / 50))), 700)
    }
  }
  return (
    <div className="flex h-full flex-col" onPointerDown={drop}>
      <Top title={tr('La tour de cubes')} step={stack.length - 1} of={CUBES} note={tr('Touche pour lâcher')} />
      <div className="relative mx-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-[#fff4e8]">
        <div className="absolute inset-0">
          <CubesScene me={me} stack={stack} x={x} w={top.w} over={over.current} falls={falls} colors={COLORS} cheer={cheer} />
        </div>
      </div>
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn w-full !py-4 !text-base">{tr('Lâcher le cube')}</button>
      </div>
    </div>
  )
}

// ——— Les premiers pas ———

export function PasDefi({ onEnd, me }: End) {
  // How far to papa (0–100), how the baby leans (-1 … 1: past that, it sits down hard).
  const st = useRef<Steps & { push: number; hold: number; falls: number; t: number }>({ d: 0, lean: 0, push: 0, hold: 0, falls: 0, down: 0, t: 0, over: false })
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
      <Top title={tr('Les premiers pas vers papa')} step={0} of={1} note={s.falls ? `${s.falls} chute${s.falls > 1 ? 's' : ''}` : undefined} />
      <div className="relative mx-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-[#fff4e8]">
        {/* The baby toddling over to papa, kneeling at the end with his arms open */}
        <div className="absolute inset-0">
          <PasScene me={me} st={st} />
        </div>
        {s.down > 0 && <div className="animate-pop absolute top-6 inset-x-0 text-center font-display text-[24px] font-extrabold text-[#e05a00]">{tr('Boum ! On se relève…')}</div>}
        {/* How it leans: keep the needle in the green */}
        <div className="absolute inset-x-8 top-4 h-3 rounded-full" style={{ background: 'linear-gradient(90deg, #e03131, #ffd43b 25%, #69db7c 40% 60%, #ffd43b 75%, #e03131)' }}>
          <span className="absolute -top-1 h-5 w-1.5 rounded-full bg-[var(--color-ink)]" style={{ left: `calc(${50 + s.lean * 50}% - 3px)` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn touch-none !py-4 !text-base select-none" {...hold(-1)}>
          {tr('◀ Pencher')}
        </button>
        <button className="btn touch-none !py-4 !text-base select-none" {...hold(1)}>
          {tr('Pencher ▶')}
        </button>
      </div>
    </div>
  )
}

// ——— Le hochet en rythme ———

const BEATS = 12
const BEAT = 0.8

export function HochetDefi({ onEnd, me }: End) {
  const start = useRef(performance.now() + 1200)
  const hits = useRef<number[]>([])
  const [, redraw] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const over = useRef(false)
  const shook = useRef(0)
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
    shook.current = performance.now()
    const i = Math.round(t / BEAT)
    if (i < hits.current.length || i >= BEATS || i < 0) return
    const off = Math.abs(t - i * BEAT)
    const s = off < 0.08 ? 100 : off < 0.16 ? 60 : off < 0.26 ? 30 : 0
    while (hits.current.length < i) hits.current.push(0)
    hits.current.push(s)
    setSaid(s === 100 ? 'Parfait !' : s >= 60 ? 'Bien !' : s ? tr('Presque…') : tr('Raté'))
    haptic(s >= 60 ? 'light' : 'error')
  }
  const t = (performance.now() - start.current) / 1000
  return (
    <div className="flex h-full flex-col" onPointerDown={shake}>
      <Top title={tr('Le hochet en rythme')} step={hits.current.length} of={BEATS} note={said ?? undefined} />
      <div className="relative mx-3 mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-[#2b1d4a]">
        {/* The baby, the rattle in front of it, the ring to hit and the circle closing in on it, each beat */}
        <div className="absolute inset-0">
          <HochetScene me={me} start={start} beat={BEAT} shook={shook} good={said === 'Parfait !' || said === 'Bien !'} />
        </div>
        {t < 0 && <div className="absolute inset-x-6 bottom-6 rounded-[18px] bg-black/55 px-3 py-2 text-center text-[15px] font-extrabold text-white">{tr("Prêt… secoue quand le cercle touche l'anneau !")}</div>}
      </div>
      <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="btn w-full !py-4 !text-base">{tr('Secouer le hochet')}</button>
      </div>
    </div>
  )
}
