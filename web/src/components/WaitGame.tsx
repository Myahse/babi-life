import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'

// While the server can't be reached (it's waking up, a maintenance, the connection page with the server
// down): a little game so nobody just waits. « Woro-woro » : the shared taxi in Abidjan's traffic, three
// lanes, the gbakas and the cars coming the other way; tap (or swipe, or the arrows) left or right to
// change lane, pick up the coins. Faster and faster; a crash, « Rejouer ». The best score stays on the
// phone. Nothing here needs the server: it plays offline.

const LANES = 3
const BEST_KEY = 'babi.waitBest'
type Thing = { lane: number; y: number; kind: 'gbaka' | 'car' | 'coin'; color: string; got?: boolean }

const CARS = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#868e96', '#ffffff']

function best() {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export function WaitGame({ className = '' }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const st = useRef({ lane: 1, x: 1, things: [] as Thing[], speed: 260, dist: 0, coins: 0, next: 0, over: false, started: false, road: 0 })
  const [view, setView] = useState({ score: 0, best: best(), over: false, started: false })

  const reset = () => {
    Object.assign(st.current, { lane: 1, x: 1, things: [], speed: 260, dist: 0, coins: 0, next: 0, over: false, started: true, road: 0 })
    setView((v) => ({ ...v, score: 0, over: false, started: true }))
  }
  const move = (d: number) => {
    const s = st.current
    if (s.over) return
    if (!s.started) return reset()
    s.lane = Math.max(0, Math.min(LANES - 1, s.lane + d))
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1)
      else if (e.key === 'ArrowRight') move(1)
      else if ((e.key === ' ' || e.key === 'Enter') && (st.current.over || !st.current.started)) reset()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = canvas.current!
    const g = c.getContext('2d')!
    let raf = 0
    let last = performance.now()
    let shown = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = st.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr)) ((c.width = Math.round(w * dpr)), (c.height = Math.round(h * dpr)))
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const lw = w / LANES
      const carW = lw * 0.5
      const carH = carW * 1.5
      const meY = h - carH - 14
      if (s.started && !s.over) {
        s.speed += dt * 9
        s.dist += s.speed * dt
        s.road = (s.road + s.speed * dt) % 40
        s.x += (s.lane - s.x) * Math.min(1, dt * 14)
        // Something coming: a gbaka (long), a car, or a coin in a free lane.
        s.next -= s.speed * dt
        if (s.next <= 0) {
          const lane = Math.floor(Math.random() * LANES)
          const r = Math.random()
          s.things.push(r < 0.3 ? { lane, y: -carH * 1.6, kind: 'gbaka', color: '#fab005' } : r < 0.75 ? { lane, y: -carH, kind: 'car', color: CARS[Math.floor(Math.random() * CARS.length)] } : { lane, y: -30, kind: 'coin', color: '#ffd43b' })
          // Now and then a second one beside it, never closing all three lanes.
          if (Math.random() < Math.min(0.5, s.dist / 8000)) {
            const other = (lane + 1 + Math.floor(Math.random() * 2)) % LANES
            s.things.push({ lane: other, y: -carH, kind: 'car', color: CARS[Math.floor(Math.random() * CARS.length)] })
          }
          s.next = Math.max(carH * 1.4, 300 - s.dist / 60)
        }
        for (const it of s.things) it.y += s.speed * dt * (it.kind === 'coin' ? 1 : 0.75)
        s.things = s.things.filter((it) => it.y < h + 60)
        // Hit: the coin picked up, a vehicle and it's over.
        const mx = s.x * lw + lw / 2
        for (const it of s.things) {
          if (it.got) continue
          const ix = it.lane * lw + lw / 2
          const ih = it.kind === 'gbaka' ? carH * 1.6 : it.kind === 'car' ? carH : 24
          if (Math.abs(ix - mx) < carW * 0.8 && it.y + ih > meY + 6 && it.y < meY + carH - 6) {
            if (it.kind === 'coin') {
              it.got = true
              s.coins++
            } else {
              s.over = true
              try {
                navigator.vibrate?.(60)
              } catch {
                /* not allowed */
              }
            }
          }
        }
        const score = Math.floor(s.dist / 50) + s.coins * 10
        if (s.over) {
          const b = Math.max(best(), score)
          try {
            localStorage.setItem(BEST_KEY, String(b))
          } catch {
            /* private mode */
          }
          setView({ score, best: b, over: true, started: true })
        } else if (now - shown > 150) {
          shown = now
          setView((v) => ({ ...v, score }))
        }
      }
      // The road: tarmac, the lanes' dashes going by, the kerbs.
      g.fillStyle = '#495057'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#e9c46a'
      g.fillRect(0, 0, 4, h)
      g.fillRect(w - 4, 0, 4, h)
      g.fillStyle = 'rgba(255,255,255,0.7)'
      for (let l = 1; l < LANES; l++) for (let y = -40 + s.road; y < h; y += 40) g.fillRect(l * lw - 2, y, 4, 22)
      // What comes.
      for (const it of s.things) {
        if (it.got) continue
        const ix = it.lane * lw + lw / 2
        if (it.kind === 'coin') {
          g.fillStyle = '#f08c00'
          g.beginPath()
          g.arc(ix, it.y + 12, 12, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#ffd43b'
          g.beginPath()
          g.arc(ix, it.y + 12, 9, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#a35c00'
          g.font = 'bold 11px sans-serif'
          g.textAlign = 'center'
          g.fillText('F', ix, it.y + 16)
          continue
        }
        vehicle(g, ix, it.y, carW * (it.kind === 'gbaka' ? 1.1 : 1), it.kind === 'gbaka' ? carH * 1.6 : carH, it.color, true, it.kind === 'gbaka')
      }
      // The woro-woro: green taxi of Abidjan's communes.
      vehicle(g, s.x * lw + lw / 2, meY, carW, carH, '#2b8a3e', false, false)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // A tap on the left or the right half; a swipe; starting and starting again by a tap.
  const down = useRef<number | null>(null)
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-[#343a40] shadow-[0_6px_0_rgba(0,0,0,0.18)] select-none ${className}`}>
      <canvas
        ref={canvas}
        className="block h-full w-full touch-none"
        onPointerDown={(e) => (down.current = e.clientX)}
        onPointerUp={(e) => {
          const s = st.current
          const from = down.current
          down.current = null
          if (s.over || !s.started) return reset()
          const r = (e.target as HTMLElement).getBoundingClientRect()
          const dx = from === null ? 0 : e.clientX - from
          if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1)
          else move(e.clientX - r.left < r.width / 2 ? -1 : 1)
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-between px-3 text-[12px] font-black text-white">
        <span className="rounded-full bg-black/40 px-2.5 py-1">{t('Score {n}', { n: view.score })}</span>
        <span className="rounded-full bg-black/40 px-2.5 py-1">{t('Record {n}', { n: view.best })}</span>
      </div>
      {(!view.started || view.over) && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/45 p-4 text-center text-white">
          <div>
            <div className="font-display text-xl font-black">{view.over ? t('Accident ! Score {n}', { n: view.score }) : t('Woro-woro')}</div>
            <p className="mt-1 text-[13px] font-bold text-white/85">{view.over ? (view.score >= view.best && view.score > 0 ? t('Nouveau record !') : t('Touche pour rejouer')) : t('En attendant : évite les gbakas, ramasse les pièces. Touche à gauche ou à droite pour changer de voie.')}</p>
            {!view.over && <div className="mt-2 inline-block rounded-full bg-[var(--color-orange)] px-4 py-1.5 text-sm font-black">{t('Touche pour jouer')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

/** A vehicle seen from above: its body, its windscreen (ahead: down for the others coming, up for ours). */
function vehicle(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, coming: boolean, gbaka: boolean) {
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(x - w / 2 + 3, y + 4, w, h)
  g.fillStyle = color
  g.beginPath()
  g.roundRect(x - w / 2, y, w, h, 7)
  g.fill()
  g.fillStyle = '#a5d8ff'
  const wy = coming ? y + h - h * 0.28 : y + h * 0.1
  g.fillRect(x - w * 0.36, wy, w * 0.72, h * 0.16)
  if (gbaka) {
    // The gbaka's windows down its sides, its roof rack.
    g.fillStyle = '#a5d8ff'
    for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + 3, y + h * 0.12 + i * h * 0.17, 4, h * 0.1)
    g.fillStyle = '#7a5230'
    g.fillRect(x - w * 0.3, y + h * 0.35, w * 0.6, h * 0.2)
  }
  if (!coming && !gbaka) {
    // The woro-woro's roof sign.
    g.fillStyle = '#ffd43b'
    g.fillRect(x - w * 0.18, y + h * 0.45, w * 0.36, h * 0.1)
  }
}
