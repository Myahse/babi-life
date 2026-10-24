import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { haptic } from '../../lib/native'
import { clamp, Count, hold, PadButton, useCanvas, useCount, useKeys, useLoop } from './arcade'

// La course de voitures à deux, as on the console of the salle de jeux: the
// road seen from behind the car, coming at you round its bends (the old
// arcade way: the road drawn in slices, each a little further and smaller),
// the boulevard along the lagoon with its coconut palms, the boards of the
// game's brands and the towers of the Plateau in the distance. Two laps
// against the other player's car; the woro-woros and the gbakas of the
// traffic to get round (hit one, you lose your speed), the verge slows you
// down. ◀ ▶ steer (the car accelerates by itself), « Turbo » three times.

const W = 360
const H = 520
const SEG = 200
const RUMBLE = 3
const ROAD = 2000
const CAM_H = 1000
const DEPTH = 1 / Math.tan((50 * Math.PI) / 180)
const DRAW = 110
const MAX = 11000 // units a second at full speed
const LAPS = 2
const CAR_Z = CAM_H * DEPTH

type Side = { off: number; kind: 'palm' | 'board' | 'lamp' | 'house'; label?: string; color?: string }
type Seg = { i: number; curve: number; side?: Side }
type Car = { z: number; x: number; speed: number; kind: 'woro' | 'gbaka' | 'taxi' | 'rival'; color: string }
type Proj = { x: number; y: number; w: number; scale: number }

/** The track: sections of road, straight or bending (eased in and out), with what stands by it. */
function build(): Seg[] {
  const segs: Seg[] = []
  const add = (n: number, curve: number) => {
    for (let k = 0; k < n; k++) {
      const ease = k < n / 4 ? k / (n / 4) : k > (n * 3) / 4 ? (n - k) / (n / 4) : 1
      segs.push({ i: segs.length, curve: curve * ease })
    }
  }
  for (const [n, c] of [
    [60, 0], [120, 2.5], [80, 0], [140, -3.5], [60, 0], [100, 4], [80, -1.5], [120, 0], [140, -4], [70, 0], [110, 3], [90, -2], [130, 0], [100, 3.5], [80, 0],
  ] as const)
    add(n, c)
  const BOARDS = [
    ['GOLVO', '#ffb703'],
    ['WAYE', '#1aa6e6'],
    ['BET225', '#22c55e'],
    ['BABI LIFE', '#ff7a00'],
    ['TIKITOKO', '#ff3d7f'],
  ]
  for (const s of segs) {
    if (s.i % 12 === 0) s.side = { off: s.i % 24 ? -1.55 : 1.55, kind: 'palm' }
    else if (s.i % 50 === 25) {
      const [label, color] = BOARDS[(s.i / 50) % BOARDS.length | 0]
      s.side = { off: s.i % 100 < 50 ? 1.9 : -1.9, kind: 'board', label, color }
    } else if (s.i % 20 === 6) s.side = { off: s.i % 40 < 20 ? -1.25 : 1.25, kind: 'lamp' }
    else if (s.i % 34 === 17) s.side = { off: s.i % 68 < 34 ? 2.6 : -2.6, kind: 'house', color: ['#f2c14e', '#e76f51', '#a8dadc', '#f4a261'][s.i % 4] }
  }
  return segs
}

const TRAFFIC: Car['kind'][] = ['woro', 'gbaka', 'taxi', 'woro', 'gbaka', 'woro']
const COLOR: Record<Car['kind'], string> = { woro: '#f5d000', gbaka: '#f4c430', taxi: '#ff7a00', rival: '#1c7ed6' }

/** Where a time's seconds put the race's end: the score, 1st a win (60 and up by how far ahead), 2nd under 45. */
export function raceScore(first: boolean, gap: number) {
  return first ? Math.round(clamp(62 + gap * 6, 62, 100)) : Math.round(clamp(45 - gap * 4, 5, 45))
}

export function CourseDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const { ref, ctx } = useCanvas(W, H)
  const keys = useKeys()
  const steer = useRef(0)
  const turboAsk = useRef(false)
  const n = useCount(3)
  const g = useRef<{ segs: Seg[]; len: number; pos: number; x: number; speed: number; turbo: number; turbos: number; bump: number; cars: Car[]; rival: Car; t: number; done: number; rivalDone: number; over: boolean } | null>(null)
  if (!g.current) {
    const segs = build()
    const len = segs.length * SEG
    const cars: Car[] = Array.from({ length: 18 }, (_, k) => {
      const kind = TRAFFIC[k % TRAFFIC.length]
      return { z: ((k + 1) / 19) * len, x: [-0.6, 0, 0.6][k % 3], speed: MAX * (kind === 'gbaka' ? 0.34 : 0.42 + (k % 4) * 0.04), kind, color: COLOR[kind] }
    })
    g.current = { segs, len, pos: 0, x: -0.35, speed: 0, turbo: 0, turbos: 3, bump: 0, cars, rival: { z: CAR_Z, x: 0.35, speed: 0, kind: 'rival', color: COLOR.rival }, t: 0, done: 0, rivalDone: 0, over: false }
  }
  const [hud, setHud] = useState({ lap: 1, first: true, kmh: 0, turbos: 3, said: '' })

  const step = (dt: number) => {
    const s = g.current!
    if (n <= 0 && !s.over) {
      s.t += dt
      const k = keys.current
      const dir = steer.current + (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)
      if ((turboAsk.current || k.has('Space')) && s.turbos > 0 && s.turbo <= 0) {
        s.turbos--
        s.turbo = 2
        haptic('medium')
      }
      turboAsk.current = false
      k.delete('Space')
      s.turbo = Math.max(0, s.turbo - dt)
      s.bump = Math.max(0, s.bump - dt)
      // Speed: up by itself, more with the turbo; on the verge, down to a third.
      const off = Math.abs(s.x) > 1
      const top = MAX * (s.turbo > 0 ? 1.35 : 1) * (off ? 0.35 : 1)
      s.speed += (s.speed < top ? MAX * 0.42 : -MAX * 1.1) * dt
      s.speed = clamp(s.speed, 0, MAX * 1.35)
      const k1 = s.speed / MAX
      const here = s.segs[Math.floor((s.pos + CAR_Z) / SEG) % s.segs.length]
      // Steering, and the bend pushing the car out.
      s.x += clamp(dir, -1, 1) * dt * 2.2 * Math.min(1, k1 + 0.2)
      s.x -= here.curve * k1 * k1 * dt * 0.42
      s.x = clamp(s.x, -2.2, 2.2)
      s.pos += s.speed * dt
      // The traffic: on along its lane; hit from behind, the car loses its speed.
      for (const c of s.cars) {
        c.z = (c.z + c.speed * dt) % s.len
        const ahead = (((c.z - (s.pos + CAR_Z)) % s.len) + s.len) % s.len
        if (ahead < SEG * 0.9 && Math.abs(c.x - s.x) < 0.42 && s.bump <= 0) {
          s.speed = c.speed * 0.7
          s.bump = 0.6
          haptic('error')
          setHud((h) => ({ ...h, said: c.kind === 'gbaka' ? 'Le gbaka !' : 'Aïe, le woro !' }))
        }
      }
      // The other player's car: fast, round the traffic, a little quicker when far behind (a fair race).
      const r = s.rival
      const behind = s.pos + CAR_Z - r.z
      const want = MAX * (0.9 + clamp(behind / 30000, -0.06, 0.1))
      r.speed += (r.speed < want ? MAX * 0.4 : -MAX * 0.5) * dt
      for (const c of s.cars) {
        const a = (((c.z - r.z) % s.len) + s.len) % s.len
        if (a < SEG * 6 && Math.abs(c.x - r.x) < 0.45) r.x += (r.x > c.x ? 1 : -1) * dt * 1.6
      }
      r.x = clamp(r.x + (0 - r.x) * dt * 0.2, -0.85, 0.85)
      r.z += r.speed * dt
      // The finish: two laps each.
      const total = s.len * LAPS
      if (!s.rivalDone && r.z - CAR_Z >= total) s.rivalDone = s.t
      if (!s.done && s.pos >= total) {
        s.done = s.t
        s.over = true
        const first = !s.rivalDone
        // The gap: ahead, the rival's time to come; behind, how long ago it finished.
        const gap = first ? (total - (r.z - CAR_Z)) / Math.max(1, r.speed) : s.done - s.rivalDone
        setHud((h) => ({ ...h, said: first ? 'Victoire !' : '2e place' }))
        haptic(first ? 'success' : 'medium')
        setTimeout(() => onEnd(raceScore(first, gap)), 1400)
      }
      if (Math.round(s.t * 6) !== Math.round((s.t - dt) * 6)) {
        setHud((h) => ({ lap: Math.min(LAPS, Math.floor(s.pos / s.len) + 1), first: s.pos + CAR_Z >= r.z, kmh: Math.round(k1 * 180), turbos: s.turbos, said: s.bump > 0 ? h.said : s.over ? h.said : '' }))
      }
    }
    draw(s)
  }

  const draw = (s: NonNullable<typeof g.current>) => {
    const c = ctx()
    if (!c) return
    const base = s.segs[Math.floor(s.pos / SEG) % s.segs.length]
    // The sky, the lagoon, the Plateau's towers far off (they slide as the road bends).
    const sky = c.createLinearGradient(0, 0, 0, H / 2)
    sky.addColorStop(0, '#5aa9e6')
    sky.addColorStop(1, '#ffd8a8')
    c.fillStyle = sky
    c.fillRect(0, 0, W, H / 2 + 2)
    const pan = ((s.pos / s.len) * 900 + base.curve * 20) % W
    c.fillStyle = '#5c6b8a'
    for (let k = -1; k < 3; k++) {
      const ox = k * W - pan
      for (const [x, w, h] of [[30, 18, 60], [52, 14, 90], [70, 22, 70], [100, 12, 110], [118, 30, 50], [160, 16, 80], [200, 26, 64], [240, 14, 96], [270, 20, 58], [310, 18, 74]])
        c.fillRect(ox + x, H / 2 - h * 0.6, w, h * 0.6)
      // La Pyramide: its stepped point.
      c.beginPath()
      c.moveTo(ox + 140, H / 2)
      c.lineTo(ox + 152, H / 2 - 66)
      c.lineTo(ox + 164, H / 2)
      c.fill()
    }
    c.fillStyle = '#3a86c8'
    c.fillRect(0, H / 2 - 6, W, 8)

    // The road, slice by slice from the car on.
    const pct = (s.pos % SEG) / SEG
    let dx = -base.curve * pct
    let x = 0
    let maxy = H
    const proj: (Proj | null)[] = []
    const camX = s.x * ROAD
    const P = (wx: number, wz: number, cz: number): Proj => {
      const z = wz - cz
      const scale = DEPTH / z
      return { x: Math.round(W / 2 + scale * (wx - camX) * (W / 2)), y: Math.round(H / 2 + scale * CAM_H * (H / 2)), w: Math.round(scale * ROAD * (W / 2)), scale }
    }
    for (let k = 0; k < DRAW; k++) {
      const seg = s.segs[(base.i + k) % s.segs.length]
      const looped = seg.i < base.i
      const cz = s.pos - (looped ? s.len : 0)
      const p1 = P(x, seg.i * SEG, cz)
      const p2 = P(x + dx, (seg.i + 1) * SEG, cz)
      x += dx
      dx += seg.curve
      proj[k] = null
      if (seg.i * SEG - cz <= DEPTH || p2.y >= maxy) continue
      const light = Math.floor(seg.i / RUMBLE) % 2 === 0
      c.fillStyle = light ? '#43a047' : '#388e3c'
      c.fillRect(0, p2.y, W, p1.y - p2.y)
      const quad = (x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, color: string) => {
        c.fillStyle = color
        c.beginPath()
        c.moveTo(x1 - w1, y1)
        c.lineTo(x2 - w2, y2)
        c.lineTo(x2 + w2, y2)
        c.lineTo(x1 + w1, y1)
        c.fill()
      }
      quad(p1.x, p1.y, p1.w * 1.15, p2.x, p2.y, p2.w * 1.15, light ? '#e03131' : '#f8f9fa')
      quad(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, light ? '#6b6f78' : '#62666f')
      if (light) for (const l of [-1 / 3, 1 / 3]) quad(p1.x + p1.w * l, p1.y, p1.w * 0.02, p2.x + p2.w * l, p2.y, p2.w * 0.02, '#f1f3f5')
      maxy = p2.y
      proj[k] = p1
    }
    // What stands by the road and the cars on it, far ones first.
    const lap = (z: number) => ((z % s.len) + s.len) % s.len
    for (let k = DRAW - 1; k > 0; k--) {
      const p = proj[k]
      if (!p) continue
      const seg = s.segs[(base.i + k) % s.segs.length]
      if (seg.side) side(c, p, seg.side)
      for (const car of [...s.cars, s.rival]) {
        if (Math.floor(lap(car.z) / SEG) !== seg.i) continue
        vehicle(c, p.x + p.w * car.x, p.y, p.scale * 760 * (W / 2), car)
      }
    }
    // The player's car, from behind; it shakes when hit, rocks on the verge.
    const shake = s.bump > 0 ? Math.sin(s.t * 60) * 3 : Math.abs(s.x) > 1 ? Math.sin(s.t * 40) * 1.5 : 0
    vehicle(c, W / 2 + shake, H - 26, 92, { z: 0, x: 0, speed: 0, kind: 'rival', color: '#ff7a00' }, steer.current, s.turbo > 0)
  }
  useLoop(step)

  return (
    <div className="flex h-full flex-col bg-[#0d1b2a]">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 font-display font-extrabold text-white">
        <span className="rounded-lg bg-black/40 px-2 py-0.5 text-sm">
          Tour {hud.lap}/{LAPS}
        </span>
        <span className={`rounded-lg px-2.5 py-0.5 text-lg ${hud.first ? 'bg-[#ffc233] text-[#16161c]' : 'bg-[#1c7ed6]'}`}>{hud.first ? '1er' : '2e'}</span>
        <span className="rounded-lg bg-black/40 px-2 py-0.5 text-sm tabular-nums">{hud.kmh} km/h</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-2 grid place-items-center">
          <canvas ref={ref} className="rounded-xl" />
        </div>
        <Count n={n} go="Partez !" />
        {hud.said && <div key={hud.said} className="animate-pop pointer-events-none absolute inset-x-0 top-1/4 text-center font-display text-[36px] font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.45)]">{hud.said}</div>}
      </div>
      <div className="flex h-[120px] shrink-0 items-center justify-between gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          {([-1, 1] as const).map((d) => (
            <button key={d} className="grid h-[76px] w-[76px] touch-none place-items-center rounded-full bg-white/90 text-[#16161c] shadow-[0_5px_0_rgba(0,0,0,0.3)] select-none active:translate-y-1" {...hold(() => (steer.current = d), () => steer.current === d && (steer.current = 0))} aria-label={d < 0 ? 'À gauche' : 'À droite'}>
              {d < 0 ? <ChevronLeft size={40} strokeWidth={3} /> : <ChevronRight size={40} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <PadButton label={`Turbo ×${hud.turbos}`} color="#7048e8" size={80} dim={hud.turbos === 0} on={() => (turboAsk.current = true)} />
      </div>
    </div>
  )
}

/** A thing by the road: a coconut palm, a board of the game's brands, a street lamp, a house. */
function side(c: CanvasRenderingContext2D, p: Proj, s: Side) {
  const k = p.scale * (W / 2)
  const x = p.x + p.w * s.off
  const y = p.y
  if (s.kind === 'palm') {
    const h = 1500 * k
    c.fillStyle = '#8d6e4a'
    c.fillRect(x - 40 * k, y - h, 80 * k, h)
    c.fillStyle = '#2b8a3e'
    for (const a of [-2.4, -1.8, -1.2, -0.6, 0]) {
      c.beginPath()
      c.ellipse(x + Math.cos(a - 0.6) * 260 * k, y - h + Math.sin(a - 0.6) * 120 * k, 340 * k, 90 * k, a - 0.6, 0, Math.PI * 2)
      c.fill()
    }
  } else if (s.kind === 'board') {
    const [w, h] = [1500 * k, 700 * k]
    c.fillStyle = '#495057'
    c.fillRect(x - w * 0.35, y - h * 1.6, 50 * k, h * 1.6)
    c.fillRect(x + w * 0.3, y - h * 1.6, 50 * k, h * 1.6)
    c.fillStyle = s.color!
    c.fillRect(x - w / 2, y - h * 2.2, w, h)
    if (w > 30) {
      c.fillStyle = '#fff'
      c.font = `900 ${Math.round(h * 0.42)}px 'Baloo 2', system-ui, sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(s.label!, x, y - h * 1.7, w * 0.9)
    }
  } else if (s.kind === 'lamp') {
    c.fillStyle = '#868e96'
    c.fillRect(x - 25 * k, y - 1600 * k, 50 * k, 1600 * k)
    c.fillStyle = '#fff3bf'
    c.fillRect(x - 150 * k, y - 1650 * k, 300 * k, 60 * k)
  } else {
    const [w, h] = [1800 * k, 1100 * k]
    c.fillStyle = s.color!
    c.fillRect(x - w / 2, y - h, w, h)
    c.fillStyle = '#b5523b'
    c.beginPath()
    c.moveTo(x - w * 0.6, y - h)
    c.lineTo(x, y - h * 1.45)
    c.lineTo(x + w * 0.6, y - h)
    c.fill()
    c.fillStyle = '#3d2b1f'
    c.fillRect(x - w * 0.1, y - h * 0.55, w * 0.2, h * 0.55)
  }
}

/** A car from behind, w wide (px), its bottom at (x, y): the woro-woro, the gbaka, the taxi, the rival. */
function vehicle(c: CanvasRenderingContext2D, x: number, y: number, w: number, car: Car, lean = 0, turbo = false) {
  if (w < 2) return
  const gbaka = car.kind === 'gbaka'
  const h = w * (gbaka ? 0.78 : 0.56)
  const sk = lean * w * 0.04
  c.fillStyle = 'rgba(0,0,0,0.3)'
  c.fillRect(x - w * 0.52, y - h * 0.08, w * 1.04, h * 0.12)
  // Wheels, body, the back window, the lights.
  c.fillStyle = '#1f2125'
  c.fillRect(x - w * 0.48, y - h * 0.22, w * 0.18, h * 0.24)
  c.fillRect(x + w * 0.3, y - h * 0.22, w * 0.18, h * 0.24)
  c.fillStyle = car.color
  c.fillRect(x - w / 2 + sk, y - h * 0.86, w, h * 0.7)
  c.fillRect(x - w * 0.4 + sk * 1.5, y - h, w * 0.8, h * 0.2)
  if (gbaka) {
    c.fillStyle = '#00a862'
    c.fillRect(x - w / 2 + sk, y - h * 0.5, w, h * 0.1)
  }
  c.fillStyle = '#20324a'
  c.fillRect(x - w * 0.34 + sk * 1.5, y - h * 0.96, w * 0.68, h * 0.24)
  c.fillStyle = '#ff2b2b'
  c.fillRect(x - w * 0.46 + sk, y - h * 0.52, w * 0.14, h * 0.1)
  c.fillRect(x + w * 0.32 + sk, y - h * 0.52, w * 0.14, h * 0.1)
  if (car.kind === 'taxi' || car.kind === 'woro') {
    c.fillStyle = '#16161c'
    c.fillRect(x - w * 0.12 + sk * 1.5, y - h * 1.06, w * 0.24, h * 0.08)
  }
  if (turbo) {
    c.fillStyle = '#ffd43b'
    c.fillRect(x - w * 0.3 + sk, y - h * 0.18, w * 0.1, h * 0.12)
    c.fillStyle = '#ff922b'
    c.fillRect(x - w * 0.3 + sk, y - h * 0.06, w * 0.1, h * 0.14)
  }
}
