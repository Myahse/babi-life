import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'

// While the server can't be reached (it's waking up, a maintenance, the connection page with the server
// down): a little game so nobody just waits. « Woro-woro » : you drive the green shared taxi up an
// Abidjan boulevard, three lanes, the gbakas and the cars, the potholes; the clients waving at the
// roadside pay their fare (+50), the coins on the tarmac (+10), a close shave past a car (« Ouf ! » +5).
// Tap left or right (or swipe, or the arrows) to change lane. Faster and faster; three hits and the
// woro-woro is done. The best score stays on the phone; nothing here needs the server.

const LANES = 3
const LIVES = 3
const BEST_KEY = 'babi.waitBest'

type Kind = 'gbaka' | 'car' | 'moto' | 'coin' | 'client' | 'trou'
type Thing = { lane: number; y: number; kind: Kind; color: string; got?: boolean; passed?: boolean; wobble: number }
type Fx = { x: number; y: number; text?: string; color: string; life: number; vx?: number; vy?: number }

const CARS = ['#e03131', '#1c7ed6', '#f08c00', '#868e96', '#f8f9fa', '#7048e8', '#0b7285']
const GBAKA_SIGNS = ['ADJAMÉ', 'YOP', 'ABOBO', 'KOUMASSI', 'COCODY', 'MARCORY']
const SHIRTS = ['#e8590c', '#2b8a3e', '#c2255c', '#1864ab', '#fab005']
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function best() {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

// —— The sounds, made in the browser (nothing to download).
let ac: AudioContext | null = null
function tone(freq: number, len = 0.1, vol = 0.12, type: OscillatorType = 'sine', to?: number) {
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ac.state === 'suspended') void ac.resume()
    const at = ac.currentTime
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + len)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(g).connect(ac.destination)
    o.start(at)
    o.stop(at + len + 0.05)
  } catch {
    /* no sound here */
  }
}
const buzz = (ms: number | number[]) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* not allowed */
  }
}

export function WaitGame2D({ className = '' }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const st = useRef({ lane: 1, x: 1, tilt: 0, things: [] as Thing[], fx: [] as Fx[], speed: 240, dist: 0, score: 0, lives: LIVES, hurt: 0, shake: 0, next: 0, over: false, started: false, road: 0, side: 0, clients: 0 })
  const [view, setView] = useState({ score: 0, best: best(), over: false, started: false, lives: LIVES, clients: 0 })

  const reset = () => {
    Object.assign(st.current, { lane: 1, x: 1, tilt: 0, things: [], fx: [], speed: 240, dist: 0, score: 0, lives: LIVES, hurt: 0, shake: 0, next: 0, over: false, started: true, road: 0, side: 0, clients: 0 })
    setView((v) => ({ ...v, score: 0, over: false, started: true, lives: LIVES, clients: 0 }))
    tone(520, 0.08)
    tone(780, 0.12)
  }
  const move = (d: number) => {
    const s = st.current
    if (s.over || !s.started) return reset()
    const was = s.lane
    s.lane = Math.max(0, Math.min(LANES - 1, s.lane + d))
    if (s.lane !== was) tone(300, 0.04, 0.05, 'triangle')
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1)
      else if (e.key === 'ArrowRight') move(1)
      else if (e.key === ' ' || e.key === 'Enter') if (st.current.over || !st.current.started) reset()
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
      const W = c.clientWidth
      const H = c.clientHeight
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) ((c.width = Math.round(W * dpr)), (c.height = Math.round(H * dpr)))
      // The road between two pavements; the lanes on it.
      const walk = Math.max(26, W * 0.11)
      const rx = walk
      const rw = W - walk * 2
      const lw = rw / LANES
      const carW = lw * 0.52
      const carH = carW * 1.55
      const meY = H - carH - 22
      const laneX = (l: number) => rx + l * lw + lw / 2
      const pop = (x: number, y: number, text: string, color: string) => s.fx.push({ x, y, text, color, life: 1 })
      const burst = (x: number, y: number, color: string, n = 10) => {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2
          s.fx.push({ x, y, color, life: 0.6 + Math.random() * 0.4, vx: Math.cos(a) * (60 + Math.random() * 120), vy: Math.sin(a) * (60 + Math.random() * 120) })
        }
      }

      if (s.started && !s.over) {
        s.speed += dt * 8
        s.dist += s.speed * dt
        s.road = (s.road + s.speed * dt) % 48
        s.side = (s.side + s.speed * dt) % 140
        const before = s.x
        s.x += (s.lane - s.x) * Math.min(1, dt * 13)
        s.tilt = ((s.x - before) / Math.max(dt, 0.001)) * 0.05
        s.hurt = Math.max(0, s.hurt - dt)
        s.shake = Math.max(0, s.shake - dt * 30)
        s.score += s.speed * dt * 0.02
        // What comes: the traffic, the potholes, the coins, the clients waving.
        s.next -= s.speed * dt
        if (s.next <= 0) {
          const lane = Math.floor(Math.random() * LANES)
          const r = Math.random()
          const wob = Math.random() * 6
          const kind: Kind = r < 0.22 ? 'gbaka' : r < 0.5 ? 'car' : r < 0.6 ? 'moto' : r < 0.72 ? 'trou' : r < 0.86 ? 'coin' : 'client'
          s.things.push({ lane, y: -carH * 2, kind, color: kind === 'gbaka' ? '#fab005' : pick(CARS), wobble: wob })
          // A coin trail now and then behind it, in a free lane.
          if (kind !== 'coin' && Math.random() < 0.35) {
            const free = (lane + 1 + Math.floor(Math.random() * 2)) % LANES
            for (let k = 0; k < 3; k++) s.things.push({ lane: free, y: -carH * 2 - k * 46, kind: 'coin', color: '#ffd43b', wobble: k })
          }
          // Later, two at once side by side (never all three lanes shut).
          if (Math.random() < Math.min(0.45, s.dist / 9000)) {
            const other = (lane + 1 + Math.floor(Math.random() * 2)) % LANES
            s.things.push({ lane: other, y: -carH * 2.2, kind: Math.random() < 0.5 ? 'car' : 'gbaka', color: pick(CARS), wobble: 0 })
          }
          s.next = Math.max(carH * 1.35, 320 - s.dist / 55)
        }
        // Everything comes down the screen: the traffic slower than us, the still things at our speed.
        for (const it of s.things) it.y += s.speed * dt * (it.kind === 'car' ? 0.62 : it.kind === 'gbaka' ? 0.72 : it.kind === 'moto' ? 0.45 : 1)
        s.things = s.things.filter((it) => it.y < H + 80)
        // What we meet.
        const mx = laneX(s.x)
        for (const it of s.things) {
          if (it.got) continue
          const ix = laneX(it.lane)
          const ih = it.kind === 'gbaka' ? carH * 1.6 : it.kind === 'car' ? carH : it.kind === 'moto' ? carH * 0.7 : 30
          const overlapY = it.y + ih > meY + 8 && it.y < meY + carH - 8
          const close = Math.abs(ix - mx) < carW * 0.75
          if (overlapY && close) {
            it.got = true
            if (it.kind === 'coin') {
              s.score += 10
              tone(1320, 0.07, 0.08)
              tone(1760, 0.09, 0.06)
              pop(ix, it.y, '+10', '#ffd43b')
            } else if (it.kind === 'client') {
              s.score += 50
              s.clients++
              tone(660, 0.1, 0.1)
              tone(990, 0.16, 0.1)
              pop(ix, it.y, t('Client ! +50'), '#69db7c')
              burst(ix, it.y + 10, '#69db7c', 8)
            } else if (it.kind === 'trou') {
              s.speed = Math.max(200, s.speed * 0.8)
              s.shake = 6
              tone(120, 0.15, 0.12, 'square')
              pop(ix, it.y, t('Nid-de-poule !'), '#ffa8a8')
              buzz(30)
            } else if (s.hurt <= 0) {
              // A hit: a life gone, a moment to get away.
              s.lives--
              s.hurt = 1.4
              s.shake = 14
              tone(90, 0.35, 0.18, 'sawtooth', 40)
              burst(mx, meY + 10, '#adb5bd', 16)
              buzz([60, 40, 60])
              if (s.lives <= 0) s.over = true
            }
          } else if (!it.passed && (it.kind === 'car' || it.kind === 'gbaka') && it.y > meY + carH && Math.abs(ix - mx) < lw * 1.2 && Math.abs(it.lane - s.lane) === 1) {
            // A close shave: passed right beside it.
            it.passed = true
            s.score += 5
            pop(mx, meY - 10, t('Ouf ! +5'), '#74c0fc')
            tone(440, 0.06, 0.05, 'triangle')
          }
        }
        const score = Math.floor(s.score)
        if (s.over) {
          const b = Math.max(best(), score)
          try {
            localStorage.setItem(BEST_KEY, String(b))
          } catch {
            /* private mode */
          }
          setView({ score, best: b, over: true, started: true, lives: 0, clients: s.clients })
        } else if (now - shown > 120) {
          shown = now
          setView((v) => ({ ...v, score, lives: s.lives, clients: s.clients }))
        }
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.save()
      if (s.shake > 0) g.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake)
      // The pavements, the kerbs, the trees and the street lamps going by, the shops behind.
      g.fillStyle = '#c9b48a'
      g.fillRect(-10, -10, rx + 10, H + 20)
      g.fillRect(rx + rw, -10, walk + 10, H + 20)
      for (let y = -140 + s.side; y < H + 140; y += 140) {
        for (const [x, flip] of [
          [walk * 0.45, 1],
          [W - walk * 0.45, -1],
        ] as const) {
          // A palm, then a lamp post further down.
          g.fillStyle = 'rgba(0,0,0,0.18)'
          g.beginPath()
          g.ellipse(x + 6, y + 8, 16, 10, 0, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#2f9e44'
          for (let k = 0; k < 6; k++) {
            g.save()
            g.translate(x, y)
            g.rotate((k / 6) * Math.PI * 2 + flip * 0.3)
            g.beginPath()
            g.ellipse(0, -9, 4, 12, 0, 0, Math.PI * 2)
            g.fill()
            g.restore()
          }
          g.fillStyle = '#8a6a45'
          g.beginPath()
          g.arc(x, y, 3.5, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#495057'
          g.fillRect(x - 2, y + 66, 4, 4)
          g.fillStyle = 'rgba(255,236,170,0.9)'
          g.fillRect(x + flip * 4 - 3, y + 64, 6, 3)
        }
      }
      g.fillStyle = '#868e96'
      g.fillRect(rx - 4, -10, 4, H + 20)
      g.fillRect(rx + rw, -10, 4, H + 20)
      // The tarmac, worn in the middle of each lane, the dashes going by.
      g.fillStyle = '#3d4248'
      g.fillRect(rx, -10, rw, H + 20)
      g.fillStyle = 'rgba(255,255,255,0.03)'
      for (let l = 0; l < LANES; l++) g.fillRect(laneX(l) - carW * 0.25, -10, carW * 0.5, H + 20)
      g.fillStyle = 'rgba(255,255,255,0.75)'
      for (let l = 1; l < LANES; l++) for (let y = -48 + s.road; y < H; y += 48) g.fillRect(rx + l * lw - 2, y, 4, 26)
      // Speed lines, faster as it goes.
      if (s.started && !s.over && s.speed > 330) {
        g.strokeStyle = `rgba(255,255,255,${Math.min(0.25, (s.speed - 330) / 900)})`
        g.lineWidth = 2
        for (let i = 0; i < 6; i++) {
          const x = rx + ((i * 97 + s.road * 3) % rw)
          const y = (i * 131 + s.road * 6) % H
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x, y + 30)
          g.stroke()
        }
      }
      // What's on the road.
      for (const it of s.things) {
        if (it.got && it.kind !== 'trou') continue
        const ix = laneX(it.lane)
        switch (it.kind) {
          case 'coin': {
            const sq = Math.abs(Math.sin(now / 160 + it.wobble))
            g.fillStyle = '#b8860b'
            g.beginPath()
            g.ellipse(ix, it.y + 12, 12 * sq + 2, 12, 0, 0, Math.PI * 2)
            g.fill()
            g.fillStyle = '#ffd43b'
            g.beginPath()
            g.ellipse(ix, it.y + 12, 9 * sq + 1.5, 9, 0, 0, Math.PI * 2)
            g.fill()
            break
          }
          case 'trou':
            g.fillStyle = '#26292d'
            g.beginPath()
            g.ellipse(ix, it.y + 14, carW * 0.42, 11, 0, 0, Math.PI * 2)
            g.fill()
            g.fillStyle = 'rgba(116,192,252,0.35)'
            g.beginPath()
            g.ellipse(ix - 3, it.y + 12, carW * 0.25, 5, 0, 0, Math.PI * 2)
            g.fill()
            break
          case 'client': {
            // Someone at the roadside waving the woro-woro down, on the lane's edge.
            const wave = Math.sin(now / 120 + it.wobble) * 0.5
            g.fillStyle = 'rgba(0,0,0,0.25)'
            g.beginPath()
            g.ellipse(ix + 3, it.y + 30, 11, 5, 0, 0, Math.PI * 2)
            g.fill()
            g.fillStyle = SHIRTS[Math.floor(it.wobble) % SHIRTS.length]
            g.beginPath()
            g.roundRect(ix - 9, it.y + 6, 18, 22, 6)
            g.fill()
            g.fillStyle = '#6b4430'
            g.beginPath()
            g.arc(ix, it.y + 2, 7, 0, Math.PI * 2)
            g.fill()
            g.strokeStyle = '#6b4430'
            g.lineWidth = 4
            g.lineCap = 'round'
            g.beginPath()
            g.moveTo(ix + 8, it.y + 10)
            g.lineTo(ix + 14 + wave * 6, it.y - 8)
            g.stroke()
            g.fillStyle = '#fff'
            g.font = 'bold 10px sans-serif'
            g.textAlign = 'center'
            g.fillText('🙋', ix, it.y - 14)
            break
          }
          default:
            vehicle(g, ix, it.y, it.kind === 'gbaka' ? carW * 1.08 : it.kind === 'moto' ? carW * 0.42 : carW, it.kind === 'gbaka' ? carH * 1.6 : it.kind === 'moto' ? carH * 0.7 : carH, it.color, it.kind, now, it.wobble)
        }
      }
      // Our woro-woro, blinking while it's just been hit.
      if (!(s.hurt > 0 && Math.floor(now / 90) % 2)) {
        g.save()
        g.translate(laneX(s.x), meY + carH / 2)
        g.rotate(Math.max(-0.25, Math.min(0.25, s.tilt)))
        vehicle(g, 0, -carH / 2, carW, carH, '#2b8a3e', 'me', now, 0)
        g.restore()
      }
      // The pops and the bits.
      s.fx = s.fx.filter((f) => (f.life -= dt * (f.text ? 1.2 : 1.8)) > 0)
      g.textAlign = 'center'
      for (const f of s.fx) {
        g.globalAlpha = Math.max(0, Math.min(1, f.life))
        if (f.text) {
          g.font = '900 16px sans-serif'
          g.lineWidth = 3
          g.strokeStyle = 'rgba(0,0,0,0.6)'
          const y = f.y - (1 - f.life) * 40
          g.strokeText(f.text, f.x, y)
          g.fillStyle = f.color
          g.fillText(f.text, f.x, y)
        } else {
          f.x += (f.vx ?? 0) * dt
          f.y += (f.vy ?? 0) * dt
          g.fillStyle = f.color
          g.fillRect(f.x - 2, f.y - 2, 4, 4)
        }
      }
      g.globalAlpha = 1
      g.restore()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // A tap on the left or the right half; a swipe; starting and starting again by a tap.
  const down = useRef<number | null>(null)
  const newBest = view.over && view.score > 0 && view.score >= view.best
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-[#3d4248] shadow-[0_6px_0_rgba(0,0,0,0.18)] select-none ${className}`}>
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
      {view.started && !view.over && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex items-center justify-between px-3 text-[12px] font-black text-white">
          <span className="rounded-full bg-black/45 px-2.5 py-1 tabular-nums">{view.score}</span>
          <span className="rounded-full bg-black/45 px-2.5 py-1">{'❤️'.repeat(view.lives) + '🖤'.repeat(LIVES - view.lives)}</span>
          <span className="rounded-full bg-black/45 px-2.5 py-1">🙋 {view.clients}</span>
        </div>
      )}
      {!view.started && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/30 via-black/55 to-black/70 p-5 text-center text-white">
          <div className="font-display text-3xl font-black tracking-tight drop-shadow">{t('Woro-woro')}</div>
          <div className="mt-0.5 text-[12px] font-extrabold text-[#ffd43b]">{t('La course d’Abidjan en attendant')}</div>
          <ul className="mt-3 space-y-1 text-left text-[13px] font-bold text-white/90">
            <li>👆 {t('Touche à gauche ou à droite pour changer de voie')}</li>
            <li>🙋 {t('Prends les clients au bord : +50')}</li>
            <li>🪙 {t('Ramasse les pièces, frôle les voitures')}</li>
            <li>🚌 {t('Évite les gbakas et les nids-de-poule')}</li>
          </ul>
          <div className="mt-4 animate-pulse rounded-full bg-[var(--color-orange)] px-5 py-2 text-sm font-black shadow-[0_3px_0_rgba(0,0,0,0.3)]">{t('Touche pour démarrer')}</div>
          {view.best > 0 && <div className="mt-2 text-[12px] font-extrabold text-white/80">{t('Ton record : {n}', { n: view.best })}</div>}
        </div>
      )}
      {view.over && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-5 text-center text-white">
          <div className="text-4xl">{newBest ? '🏆' : '💥'}</div>
          <div className="mt-1 font-display text-2xl font-black">{newBest ? t('Nouveau record !') : t('Le woro-woro est cassé !')}</div>
          <div className="mt-2 flex gap-2 text-[13px] font-extrabold">
            <span className="rounded-full bg-white/15 px-3 py-1">{t('Score {n}', { n: view.score })}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">🙋 {view.clients}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">{t('Record {n}', { n: view.best })}</span>
          </div>
          <div className="mt-4 rounded-full bg-[var(--color-orange)] px-5 py-2 text-sm font-black shadow-[0_3px_0_rgba(0,0,0,0.3)]">{t('Touche pour rejouer')}</div>
        </div>
      )}
    </div>
  )
}

/** A vehicle seen from above: its shadow, its body, the windscreen ahead, the wheels; the gbaka and the woro-woro their own. */
function vehicle(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, kind: Kind | 'me', now: number, seed: number) {
  const me = kind === 'me'
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.beginPath()
  g.roundRect(x - w / 2 + 4, y + 5, w, h, 8)
  g.fill()
  // Wheels.
  g.fillStyle = '#111'
  for (const [dx, dy] of [
    [-1, 0.18],
    [1, 0.18],
    [-1, 0.78],
    [1, 0.78],
  ])
    g.fillRect(x + dx * (w / 2) - (dx < 0 ? 2 : 3), y + h * dy, 5, h * 0.12)
  g.fillStyle = color
  g.beginPath()
  g.roundRect(x - w / 2, y, w, h, kind === 'moto' ? w / 2 : 8)
  g.fill()
  if (kind === 'moto') {
    // The rider's helmet.
    g.fillStyle = '#212529'
    g.beginPath()
    g.arc(x, y + h * 0.45, w * 0.45, 0, Math.PI * 2)
    g.fill()
    return
  }
  // The roof, a shade lighter, and the windscreens (ahead: up for us, down for the others coming).
  g.fillStyle = 'rgba(255,255,255,0.12)'
  g.fillRect(x - w * 0.36, y + h * 0.28, w * 0.72, h * 0.44)
  g.fillStyle = '#a5d8ff'
  const front = me ? y + h * 0.1 : y + h * 0.76
  g.fillRect(x - w * 0.36, front, w * 0.72, h * 0.13)
  g.fillStyle = 'rgba(165,216,255,0.7)'
  g.fillRect(x - w * 0.32, me ? y + h * 0.8 : y + h * 0.1, w * 0.64, h * 0.08)
  // The lights: ours headlights up, the others' tail lights to us.
  g.fillStyle = me ? '#fff3bf' : '#ff6b6b'
  g.fillRect(x - w * 0.42, me ? y + 1 : y + h - 4, w * 0.18, 3)
  g.fillRect(x + w * 0.24, me ? y + 1 : y + h - 4, w * 0.18, 3)
  if (kind === 'gbaka') {
    // The gbaka: its side windows, the roof rack piled with bags, its route on the back.
    g.fillStyle = '#a5d8ff'
    for (let i = 0; i < 4; i++) {
      g.fillRect(x - w / 2 + 2, y + h * 0.14 + i * h * 0.15, 3, h * 0.1)
      g.fillRect(x + w / 2 - 5, y + h * 0.14 + i * h * 0.15, 3, h * 0.1)
    }
    g.fillStyle = '#7a5230'
    g.fillRect(x - w * 0.3, y + h * 0.3, w * 0.6, h * 0.16)
    g.fillStyle = '#e03131'
    g.fillRect(x - w * 0.22, y + h * 0.5, w * 0.44, h * 0.08)
    g.fillStyle = '#212529'
    g.font = `bold ${Math.max(7, Math.round(w * 0.16))}px sans-serif`
    g.textAlign = 'center'
    g.fillText(GBAKA_SIGNS[Math.floor(seed * 3) % GBAKA_SIGNS.length], x, y + h * 0.69)
  }
  if (me) {
    // The woro-woro: its yellow roof sign, the stripe down its side, the driver's elbow out.
    g.fillStyle = '#ffd43b'
    g.beginPath()
    g.roundRect(x - w * 0.2, y + h * 0.42, w * 0.4, h * 0.12, 3)
    g.fill()
    g.fillStyle = '#212529'
    g.font = `bold ${Math.max(6, Math.round(w * 0.13))}px sans-serif`
    g.textAlign = 'center'
    g.fillText('TAXI', x, y + h * 0.51)
    g.fillStyle = '#ffd43b'
    g.fillRect(x - w / 2 + 1, y + h * 0.3, 2, h * 0.5)
    g.fillRect(x + w / 2 - 3, y + h * 0.3, 2, h * 0.5)
    g.fillStyle = '#6b4430'
    g.fillRect(x - w / 2 - 3, y + h * 0.36 + Math.sin(now / 300) * 1.5, 4, 7)
  }
}

// The 3D one (WaitGame3D.tsx: the game's own vehicles and people) where the phone draws WebGL; the flat
// one above where it can't, and while the 3D one loads.
const WaitGame3D = lazy(() => import('./WaitGame3D'))
const webgl = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
})()

/** The waiting game: in 3D if the phone can, else flat. */
export function WaitGame({ className = '' }: { className?: string }) {
  if (!webgl) return <WaitGame2D className={className} />
  return (
    <Suspense fallback={<div className={`grid place-items-center rounded-[22px] bg-[#9fd3ff] text-sm font-black text-white ${className}`}>{t('Le woro-woro arrive…')}</div>}>
      <WaitGame3D className={className} />
    </Suspense>
  )
}
