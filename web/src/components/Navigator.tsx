import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Navigation, X } from 'lucide-react'
import type { World } from '../lib/types'
import { bearingTo, distanceTo, whereabouts } from '../world3d/whereabouts'
import { iconFor, kindColors } from './icons'
import { IconTile } from './ui'

// Finding your way: a mini-map of the streets around the Sim (it turns with
// the camera, so up is where you look), and « Où aller ? », every place of
// the quarter with how far it is and which way. Tap one to go.

const RANGE = 260 // metres from the centre to the edge of the mini-map

function metres(d: number) {
  return d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`
}

export function MiniMap({ onWalk }: { onWalk: (id: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const SIZE = 132
  useEffect(() => {
    let raf = 0
    let last = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (t - last < 150) return
      last = t
      const c = canvas.current
      const g = c?.getContext('2d')
      if (!c || !g) return
      const dpr = window.devicePixelRatio || 1
      if (c.width !== SIZE * dpr) {
        c.width = c.height = SIZE * dpr
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, SIZE, SIZE)
      g.save()
      g.beginPath()
      g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2)
      g.clip()
      g.fillStyle = '#b9a47c'
      g.fillRect(0, 0, SIZE, SIZE)
      // World to the map: centred on the Sim, turned so the camera looks up.
      const k = SIZE / 2 / RANGE
      const [sx, sz] = whereabouts.sim
      g.translate(SIZE / 2, SIZE / 2)
      g.rotate(-whereabouts.heading)
      g.scale(k, k)
      g.translate(-sx, -sz)
      g.fillStyle = '#5fb3e6'
      for (const ring of whereabouts.water) {
        g.beginPath()
        ring.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)))
        g.fill()
      }
      g.strokeStyle = '#fbf8f2'
      g.lineCap = 'round'
      for (const [[ax, az], [bx, bz], w] of whereabouts.roads) {
        if (Math.abs(ax - sx) > RANGE * 1.5 && Math.abs(bx - sx) > RANGE * 1.5) continue
        if (Math.abs(az - sz) > RANGE * 1.5 && Math.abs(bz - sz) > RANGE * 1.5) continue
        g.lineWidth = Math.max(w * 1.4, 4 / k)
        g.beginPath()
        g.moveTo(ax, az)
        g.lineTo(bx, bz)
        g.stroke()
      }
      for (const p of whereabouts.places) {
        g.fillStyle = kindColors(p.kind)[1]
        g.beginPath()
        g.arc(p.door[0], p.door[1], 6 / k, 0, Math.PI * 2)
        g.fill()
        g.lineWidth = 1.5 / k
        g.strokeStyle = '#ffffff'
        g.stroke()
      }
      g.restore()
      // North stays marked on the rim as the map turns with the camera.
      g.save()
      g.translate(SIZE / 2, SIZE / 2)
      g.rotate(-whereabouts.heading)
      g.fillStyle = '#fff'
      g.font = '800 11px sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('N', 0, -(SIZE / 2 - 14))
      g.restore()
      // The Sim, in the middle, looking up.
      g.save()
      g.translate(SIZE / 2, SIZE / 2)
      g.fillStyle = '#ff7a00'
      g.strokeStyle = '#ffffff'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(0, -8)
      g.lineTo(6, 6)
      g.lineTo(0, 3)
      g.lineTo(-6, 6)
      g.closePath()
      g.fill()
      g.stroke()
      g.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Tap a place's dot to go there.
  const tap = (e: React.PointerEvent) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const [px, py] = [e.clientX - r.left - SIZE / 2, e.clientY - r.top - SIZE / 2]
    const k = SIZE / 2 / RANGE
    const h = whereabouts.heading
    // Back from the map to the world.
    const [rx, rz] = [(px * Math.cos(h) - py * Math.sin(h)) / k, (px * Math.sin(h) + py * Math.cos(h)) / k]
    const [wx, wz] = [whereabouts.sim[0] + rx, whereabouts.sim[1] + rz]
    let best: string | null = null
    let bd = 14 / k
    for (const p of whereabouts.places) {
      const d = Math.hypot(p.door[0] - wx, p.door[1] - wz)
      if (d < bd) [best, bd] = [p.id, d]
    }
    if (best) onWalk(best)
  }

  return <canvas ref={canvas} onPointerUp={tap} className="pointer-events-auto rounded-full border-[3px] border-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)]" style={{ width: SIZE, height: SIZE }} aria-label="Mini-carte" />
}

const LIST_MAX = 60
/** Lower case, without accents: « Pharmacie Sainte-Thérèse » → « pharmacie sainte-therese ». */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** The places of the quarter, the nearest first, with the way to each. */
export function WhereTo({ world, onWalk, onClose }: { world: World; onWalk: (id: string) => void; onClose: () => void }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  // Thousands of places around in a quarter like Yopougon: the nearest
  // first, a few dozen of them, and a search over all (name, kind, quarter).
  const [q, setQ] = useState('')
  const words = fold(q).split(/\s+/).filter(Boolean)
  const all = [...whereabouts.places].filter((p) => p.name)
  const hits = words.length ? all.filter((p) => words.every((w) => fold(`${p.name} ${world.kinds[p.kind]?.label ?? ''}`).includes(w))) : all
  const list = hits.sort((a, b) => distanceTo(a.door) - distanceTo(b.door)).slice(0, LIST_MAX)
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex max-h-[78vh] w-full flex-col overflow-hidden rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 pb-2">
          <IconTile icon={Navigation} colors={['#ffa040', '#ff6a00']} size={46} />
          <div className="min-w-0 flex-1">
            <div className="label">Dans le quartier</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">Où aller ?</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {all.length > 12 && (
          <div className="px-4 pb-2">
            <input
              className="w-full rounded-2xl border-2 border-[var(--color-line)] bg-[var(--color-canvas)] px-4 py-2.5 text-[15px] font-bold outline-none focus:border-[var(--color-orange)]"
              placeholder={`Chercher parmi ${all.length} lieux : maquis, pharmacie…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Chercher un lieu"
            />
          </div>
        )}
        <ul className="motion-stagger space-y-1.5 overflow-y-auto px-4 pb-2">
          {!list.length && <li className="p-3 text-center text-sm font-bold text-[var(--color-ink-soft)]">Rien de ce nom par ici.</li>}
          {list.map((p) => {
            const kind = world.kinds[p.kind]
            return (
              <li key={p.id}>
                <button className="tile flex w-full items-center gap-3 p-2.5 text-left" onClick={() => onWalk(p.id)}>
                  <IconTile icon={iconFor(p.kind === 'home' ? 'house' : p.kind === 'plot' ? 'land-plot' : p.kind === 'happening' ? 'sparkles' : (kind?.icon ?? ''))} colors={kindColors(p.kind)} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] leading-tight font-extrabold">{p.name}</span>
                    <span className="text-xs font-bold text-[var(--color-ink-soft)]">{p.kind === 'home' ? 'Ta maison' : p.kind === 'plot' ? 'Ton terrain, clôturé' : (kind?.label ?? '')}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-[var(--color-ink-soft)]">
                    <ArrowUp size={16} strokeWidth={3} style={{ transform: `rotate(${bearingTo(p.door)}rad)` }} className="text-[var(--color-orange)]" />
                    {metres(distanceTo(p.door))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
