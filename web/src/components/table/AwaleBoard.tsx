import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { play, type Awale } from '../../game/awale'
import { tableSfx } from '../../lib/tableSfx'
import { haptic } from '../../lib/native'

// The awalé's board, as on the bench under the tree (AwaleApp against the computer, components/pvp/play.tsx
// against a player): the seeds lie loose in their holes, each where it fell. A move is played out as a hand
// would: the hole's seeds scooped up, then dropped one by one into the next holes, each with its click on
// the wood (duller as the hole fills), the seeds taken poured into the store of whoever took them. The
// board animates itself from the game before the move to the game after; the caller only says which move.

/** A move to play out: the game before it, the hole sown, and a key that changes with each move. */
export type AwaleMove = { before: Awale; from: number; key: number }

/** Where seed k lies in its hole (0..1 of the hole, from its middle): loose, a spiral, a little shaken by the hole's own number. */
function lie(k: number, hole: number): [number, number] {
  const a = k * 2.39996 + hole * 1.3
  const r = 0.1 * Math.sqrt(k + 0.3)
  return [Math.cos(a) * Math.min(r, 0.3), Math.sin(a) * Math.min(r, 0.3)]
}
/** The seeds' colours: the dried nuts, never two the same (by their place). */
const SEED = ['#b9ab8c', '#a39477', '#c7bb9f', '#8f8166', '#b3a07c']
const seedStyle = (k: number, size: number) => ({ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #f4ead2, ${SEED[k % SEED.length]} 55%, #5a4c34)`, boxShadow: '0 1.5px 1.5px rgba(0,0,0,0.55)' })

/** One hole's seeds, loose (up to 22 drawn; the number below says them all). */
function HoleSeeds({ n, hole, size }: { n: number; hole: number; size: number }) {
  const shown = Math.min(n, 22)
  return (
    <>
      {Array.from({ length: shown }, (_, k) => {
        const [x, y] = lie(k, hole)
        return <span key={k} className="absolute rounded-full" style={{ ...seedStyle(k + hole, size), left: `calc(${50 + x * 100}% - ${size / 2}px)`, top: `calc(${50 + y * 100}% - ${size / 2}px)` }} />
      })}
    </>
  )
}

/** The seeds in a store: a heap, wider as it grows. */
function Store({ n, side, size }: { n: number; side: number; size: number }) {
  const shown = Math.min(n, 48)
  return (
    <>
      {Array.from({ length: shown }, (_, k) => {
        const a = k * 2.39996 + side
        const r = Math.sqrt(k) * 0.06
        return <span key={k} className="absolute rounded-full" style={{ ...seedStyle(k + side * 3, size), left: `calc(${50 + Math.cos(a) * r * 100 * 2.4}% - ${size / 2}px)`, top: `calc(${50 + Math.sin(a) * r * 100 * 0.7}% - ${size / 2}px)` }} />
      })}
    </>
  )
}

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

export function AwaleBoard({
  game,
  move,
  bottom,
  can,
  hint,
  topName,
  bottomName,
  onTap,
  onSown,
}: {
  game: Awale
  /** The last move, played out when its key changes (none: the board as it is). */
  move?: AwaleMove | null
  /** Whose row is at the bottom: 0 (holes 0–5) or 1 (6–11). */
  bottom: 0 | 1
  /** The holes the player may sow now. */
  can: number[]
  /** A hole the other's hand hovers over while it thinks. */
  hint?: number | null
  topName: string
  bottomName: string
  onTap: (i: number) => void
  /** A move played out to its end (the seeds counted, the store poured). */
  onSown?: (key: number, taken: number) => void
}) {
  const [holes, setHoles] = useState<number[]>(() => (move ? move.before.holes : game.holes))
  const [store, setStore] = useState<[number, number]>(() => (move ? move.before.store : game.store))
  const [busy, setBusy] = useState(false)
  // The hole the hand is over, and the seeds still in it.
  const [hand, setHand] = useState<{ i: number; n: number } | null>(null)
  const at = hand?.i ?? null
  const [pressed, setPressed] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const holeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const storeRefs = useRef<(HTMLDivElement | null)[]>([])
  const played = useRef<number | null>(move?.key ?? null)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  // No move to play out (a new game, a jump in the moves): the board as the game has it.
  const sowing = useRef(false)
  useEffect(() => {
    if (busy || sowing.current) return
    if (!move || played.current === move.key) {
      setHoles(game.holes)
      setStore(game.store)
    }
  }, [game, move, busy])

  /** The middle of an element in the board's own pixels. */
  const centre = (el: Element | null | undefined) => {
    const b = boxRef.current?.getBoundingClientRect()
    const r = el?.getBoundingClientRect()
    if (!b || !r) return { x: 0, y: 0, w: 0, h: 0 }
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, w: r.width, h: r.height }
  }
  /** A seed flying from one point to another over the board, arcing up; resolved as it lands. */
  const fly = (from: { x: number; y: number }, to: { x: number; y: number }, ms: number, size: number, k: number, lift = 26) => {
    const el = document.createElement('span')
    el.className = 'absolute top-0 left-0 rounded-full'
    Object.assign(el.style, seedStyle(k, size), { width: `${size}px`, height: `${size}px`, zIndex: '30' })
    layer.current?.appendChild(el)
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift }
    const tf = (p: { x: number; y: number }, s = 1) => `translate(${p.x - size / 2}px, ${p.y - size / 2}px) scale(${s})`
    const a = el.animate([{ transform: tf(from) }, { transform: tf(mid, 1.35), offset: 0.5 }, { transform: tf(to) }], { duration: ms, easing: 'cubic-bezier(.3,.6,.4,1)' })
    return a.finished.then(() => el.remove()).catch(() => el.remove())
  }

  // A new move: played out seed by seed.
  useLayoutEffect(() => {
    if (!move || played.current === move.key) return
    played.current = move.key
    const { before, from } = move
    const r = play(before, from)
    const mover = before.turn
    const h = before.holes.slice()
    const st: [number, number] = [...before.store]
    setHoles(h.slice())
    setStore([...st])
    setBusy(true)
    sowing.current = true
    const seed = 11
    void (async () => {
      let n = h[from]
      // The hand takes them all.
      tableSfx.scoop(n)
      haptic('light')
      h[from] = 0
      setHoles(h.slice())
      setHand({ i: from, n })
      // A beat to see the hand full, then the seeds one by one; quicker with many.
      await wait(260)
      const each = Math.max(95, 210 - n * 7)
      let i = from
      let prev = from
      let k = 0
      while (n > 0) {
        i = (i + 1) % 12
        if (i === from) continue
        const src = centre(holeRefs.current[prev])
        const dst = centre(holeRefs.current[i])
        const [lx, ly] = lie(h[i], i)
        setHand({ i, n: n - 1 })
        await fly(src, { x: dst.x + lx * dst.w, y: dst.y + ly * dst.h }, each, seed, k++ + i, 18)
        if (!alive.current) return
        prev = i
        h[i]++
        n--
        tableSfx.seed(Math.min(1, h[i] / 12))
        setHoles(h.slice())
      }
      setHand(null)
      // The seeds taken: from each hole, poured into the mover's store.
      if (r.taken) {
        await wait(280)
        tableSfx.pour(r.taken)
        haptic('medium')
        const s = centre(storeRefs.current[mover])
        const all: Promise<void>[] = []
        for (const t of r.from) {
          const c = centre(holeRefs.current[t])
          for (let j = 0; j < h[t]; j++) {
            const [lx, ly] = lie(j, t)
            all.push(wait(j * 60).then(() => fly({ x: c.x + lx * c.w, y: c.y + ly * c.h }, { x: s.x + (Math.random() - 0.5) * s.w * 0.4, y: s.y + (Math.random() - 0.5) * s.h * 0.3 }, 420, seed, j + t, 40)))
          }
          h[t] = 0
          setHoles(h.slice())
          await wait(110)
        }
        await Promise.all(all)
        st[mover] += r.taken
        setStore([...st])
      }
      await wait(160)
      if (!alive.current) return
      sowing.current = false
      setBusy(false)
      onSown?.(move.key, r.taken)
    })()
  }, [move?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const seedSize = 11
  const rows = bottom === 0 ? { top: [11, 10, 9, 8, 7, 6], low: [0, 1, 2, 3, 4, 5] } : { top: [5, 4, 3, 2, 1, 0], low: [6, 7, 8, 9, 10, 11] }
  const topSide = (1 - bottom) as 0 | 1
  const hole = (i: number) => {
    const open = !busy && can.includes(i)
    return (
      <button
        key={i}
        ref={(el) => void (holeRefs.current[i] = el)}
        data-hole={i}
        onPointerDown={() => open && setPressed(i)}
        onPointerUp={() => setPressed(null)}
        onPointerLeave={() => setPressed(null)}
        onClick={() => open && onTap(i)}
        disabled={!open}
        aria-label={`${i}: ${holes[i]}`}
        className="relative aspect-square rounded-full transition-[transform,box-shadow] duration-150"
        style={{
          background: 'radial-gradient(circle at 50% 38%, #2e1a0c, #4d2f16 62%, #6e4823)',
          boxShadow: `inset 0 4px 8px rgba(0,0,0,0.7), 0 1px 0 rgba(255,230,190,0.25)${at === i || hint === i ? ', 0 0 0 3px #ffd166' : open ? ', 0 0 0 2px rgba(255,255,255,0.55)' : ''}`,
          transform: pressed === i ? 'scale(0.94)' : hint === i ? 'scale(1.04)' : undefined,
        }}
      >
        <HoleSeeds n={holes[i]} hole={i} size={seedSize} />
        {hand?.i === i && hand.n > 0 && <span className="absolute -top-2 -right-1 z-10 rounded-full bg-[#ffd166] px-1.5 text-[11px] leading-[16px] font-extrabold text-[#3a2312] tabular-nums shadow">{hand.n}</span>}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-1.5 text-[10px] leading-[15px] font-extrabold text-white tabular-nums">{holes[i]}</span>
      </button>
    )
  }
  const storeBox = (side: 0 | 1, name: string) => (
    <div className="flex items-center gap-2 text-[12px] font-extrabold text-white/90">
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <div ref={(el) => void (storeRefs.current[side] = el)} className="relative h-[30px] w-[46%] rounded-full" style={{ background: 'radial-gradient(ellipse at 50% 40%, #2e1a0c, #4d2f16 70%, #6e4823)', boxShadow: 'inset 0 3px 7px rgba(0,0,0,0.7)' }}>
        <Store n={store[side]} side={side} size={8} />
      </div>
      <span key={store[side]} className="animate-pop w-[64px] rounded-full bg-black/35 px-2 text-center tabular-nums">{store[side]}</span>
    </div>
  )
  return (
    <div ref={boxRef} className="relative rounded-[22px] p-3 shadow-[0_12px_26px_-12px_rgba(0,0,0,0.7)]" style={{ background: 'repeating-linear-gradient(92deg, rgba(0,0,0,0.05) 0 3px, transparent 3px 11px), linear-gradient(180deg,#b9824a,#8a5a2b)' }}>
      {storeBox(topSide, topName)}
      <div className="mt-2 grid grid-cols-6 gap-1.5">{rows.top.map(hole)}</div>
      <div className="my-2 h-[3px] rounded-full bg-black/20" />
      <div className="grid grid-cols-6 gap-1.5">{rows.low.map(hole)}</div>
      <div className="mt-2">{storeBox(bottom, bottomName)}</div>
      <div ref={layer} className="pointer-events-none absolute inset-0" />
    </div>
  )
}
