import { useEffect, useMemo, useRef, useState } from 'react'
import { fcfa } from '../../game/rules'
import { PRODUCTS, Pixels, TROLLEY } from './Pixels'

// Le défi des courses: the list in hand, the shelves going by as the trolley
// goes down the aisle (three of them, one way and the other). A tap on a thing
// that's on the list puts it in the trolley; a thing that isn't costs time.
// Everything found before the time's up, the quicker the better, nothing silly
// bought: that's good shopping. At the supermarket the list is longer than at
// the boutique.

const TILE = 76
const GAP = 8
const PER_ROW = 7
const SPEEDS = [34, -42, 38]

const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** The score: what was found, time left once all was, few mistakes. */
export function coursesScore(found: number, wanted: number, left: number, time: number, mistakes: number) {
  const all = found >= wanted
  return Math.round(Math.max(0, Math.min(100, (found / wanted) * 70 + (all ? (left / time) * 20 : 0) + Math.max(0, 10 - mistakes * 4))))
}

export function CoursesDefi({ big, onEnd }: { /** At the supermarket: a longer list, a little more time. */ big: boolean; onEnd: (score: number) => void }) {
  const time = big ? 34 : 24
  const ids = Object.keys(PRODUCTS)
  const want = useMemo(() => shuffle(ids).slice(0, big ? 6 : 4), []) // eslint-disable-line react-hooks/exhaustive-deps
  // The shelves: every thing on the list somewhere, among others.
  const rows = useMemo(() => {
    const others = ids.filter((id) => !want.includes(id))
    const pool = shuffle([...want, ...shuffle([...others, ...others]).slice(0, PER_ROW * 3 - want.length)])
    return [0, 1, 2].map((r) => pool.slice(r * PER_ROW, (r + 1) * PER_ROW))
  }, [want]) // eslint-disable-line react-hooks/exhaustive-deps
  const [found, setFound] = useState<string[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  const mistakes = useRef(0)
  const lost = useRef(0)
  const t0 = useRef(performance.now())
  const [now, setNow] = useState(performance.now())
  const over = useRef(false)
  const trolley = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [flying, setFlying] = useState<{ id: string; key: number; from: DOMRect }[]>([])

  const elapsed = (now - t0.current) / 1000 + lost.current
  const left = Math.max(0, time - elapsed)
  const finish = (n = found.length) => {
    if (over.current) return
    over.current = true
    setTimeout(() => onEnd(coursesScore(n, want.length, left, time, mistakes.current)), 900)
  }
  useEffect(() => {
    let raf = 0
    const step = () => {
      setNow(performance.now())
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    if (left <= 0) finish()
  }, [left <= 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const take = (id: string, el: HTMLElement) => {
    if (over.current) return
    if (want.includes(id) && !found.includes(id)) {
      const next = [...found, id]
      setFound(next)
      setFlying((f) => [...f, { id, key: performance.now(), from: el.getBoundingClientRect() }])
      if (next.length === want.length) finish(next.length)
    } else {
      // Not on the list (or already in the trolley): two seconds lost.
      mistakes.current++
      lost.current += 2
      setWrong(`${id}${performance.now()}`)
      setTimeout(() => setWrong(null), 700)
    }
  }
  const strip = PER_ROW * (TILE + GAP)
  const t = (now - t0.current) / 1000
  const total = found.reduce((s, id) => s + PRODUCTS[id].price, 0)
  return (
    <div ref={root} className="relative flex h-full flex-col">
      {/* The list, and the time */}
      <div className="px-3 pt-3">
        <div className="rounded-[18px] bg-[#fffaf0] p-2.5 text-[var(--color-ink)] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]" style={{ backgroundImage: 'repeating-linear-gradient(#fffaf0 0 21px, #e7e9f2 21px 22px)' }}>
          <div className="mb-1 font-display text-[13px] font-extrabold tracking-wider text-[#e05a00]">LA LISTE</div>
          <div className="flex flex-wrap gap-1.5">
            {want.map((id) => {
              const got = found.includes(id)
              return (
                <span key={id} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-extrabold transition-colors ${got ? 'bg-[#d3f9d8] text-[#2b8a3e] line-through' : 'bg-white'}`}>
                  <Pixels rows={PRODUCTS[id].rows} palette={PRODUCTS[id].palette} width={18} />
                  {PRODUCTS[id].name}
                  {got && ' ✓'}
                </span>
              )
            })}
          </div>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full" style={{ width: `${(left / time) * 100}%`, background: left < 6 ? '#e03131' : left < 12 ? '#ffc233' : '#00b86b' }} />
        </div>
        <div className="mt-1 flex justify-between text-[12px] font-extrabold text-white/80">
          <span>{Math.ceil(left)} s</span>
          <span>{wrong ? <span className="text-[#ff8787]">Pas sur la liste ! −2 s</span> : `${found.length} / ${want.length}`}</span>
        </div>
      </div>

      {/* The aisle: three shelves going by */}
      <div className="mx-3 my-2 flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-hidden rounded-[22px] py-2" style={{ background: 'linear-gradient(#f4efe4, #e6dccb)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.4)' }}>
        {rows.map((row, r) => {
          const off = (((t * SPEEDS[r]) % strip) + strip) % strip
          return (
            <div key={r} className="relative overflow-hidden" style={{ height: TILE + 16 }}>
              <div className="absolute inset-x-0 bottom-0 h-3 bg-[#8a5a32] shadow-[0_3px_0_#5a3418]" />
              <div className="absolute top-0 left-0 flex" style={{ gap: GAP, transform: `translateX(${-off}px)` }}>
                {[...row, ...row, ...row].map((id, k) => {
                  const got = found.includes(id) && want.includes(id)
                  const bad = wrong?.startsWith(id)
                  return (
                    <button
                      key={k}
                      className={`relative grid shrink-0 place-items-center rounded-[14px] bg-white shadow-[0_3px_0_rgba(0,0,0,0.18)] transition-transform active:scale-95 ${got ? 'opacity-35' : ''} ${bad ? 'animate-pulse ring-4 ring-[#e03131]' : ''}`}
                      style={{ width: TILE, height: TILE }}
                      disabled={got}
                      onClick={(e) => take(id, e.currentTarget)}
                      aria-label={PRODUCTS[id].name}
                    >
                      <Pixels rows={PRODUCTS[id].rows} palette={PRODUCTS[id].palette} width={44} />
                      <span className="absolute right-1 bottom-1 rounded-md bg-[#ffc233] px-1 text-[10px] leading-tight font-extrabold text-[#16161c]">{PRODUCTS[id].price}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* The trolley, what's in it and the bill so far */}
      <div className="flex items-end gap-3 px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
        <div ref={trolley} className="relative">
          <Pixels rows={TROLLEY.rows} palette={TROLLEY.palette} width={96} />
          <div className="absolute top-[14%] left-[14%] flex w-[76%] flex-wrap-reverse gap-0.5">
            {found.map((id) => (
              <Pixels key={id} rows={PRODUCTS[id].rows} palette={PRODUCTS[id].palette} width={18} />
            ))}
          </div>
        </div>
        <div className="flex-1 pb-2 text-right text-white">
          <div className="text-[12px] font-extrabold text-white/70">Au panier</div>
          <div className="font-display text-[20px] font-extrabold">{fcfa(total)}</div>
        </div>
      </div>

      {/* A thing on its way to the trolley */}
      {flying.map((f) => (
        <Flying key={f.key} f={f} to={trolley.current?.getBoundingClientRect()} root={root.current?.getBoundingClientRect()} done={() => setFlying((all) => all.filter((x) => x.key !== f.key))} />
      ))}
    </div>
  )
}

/** From the shelf into the trolley, in an arc. */
function Flying({ f, to, root, done }: { f: { id: string; from: DOMRect }; to?: DOMRect; root?: DOMRect; done: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!to || !root || !ref.current) return done()
    const [x0, y0] = [f.from.left - root.left + 16, f.from.top - root.top + 16]
    const [x1, y1] = [to.left - root.left + 30, to.top - root.top + 10]
    const a = ref.current.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(1)` },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(1.2)`, offset: 0.5 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.5)` },
      ],
      { duration: 520, easing: 'ease-in-out', fill: 'forwards' },
    )
    a.onfinish = done
    return () => a.cancel()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0 z-20">
      <Pixels rows={PRODUCTS[f.id].rows} palette={PRODUCTS[f.id].palette} width={44} />
    </div>
  )
}
