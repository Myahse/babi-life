import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, clamp, rnd, useHud, type Frame, type Touch, fx } from './kit'
import { t } from '../../../lib/i18n'

// « La lumière sur la lagune », chapter 3 (game/epreuves.go): the evening clean-up of the lagoon's edge,
// the sun going down. The plastics drift on the water (bottles, sachets, a flip-flop); the fish come up
// under them. Draw a loop round them with the finger, like a net: let go once it's closed and what's
// inside is fished out. The plastics into the sack; a fish caught is put back, and it costs. Twenty
// plastics before the dark.

const TIME = 50
const GOAL = 20
const KINDS = ['bouteille', 'sachet', 'sachet', 'tapette', 'bouteille'] as const
type Bit = { x: number; y: number; vx: number; vy: number; kind: (typeof KINDS)[number] | 'poisson'; a: number; gone: number }

const inside = (x: number, y: number, poly: { x: number; y: number }[]) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c
  }
  return c
}

export default function MamiWata({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ bits: [] as Bit[], loop: [] as { x: number; y: number }[], drawing: false, got: 0, fish: 0, over: false, next: 0, w: 0, h: 0, now: 0, nets: [] as { poly: { x: number; y: number }[]; at: number; ok: boolean }[] })
  const [hud, setHud] = useHud({ left: TIME, got: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const spawn = (w: number, h: number, fish = false): Bit => {
    const fromLeft = Math.random() < 0.5
    return { x: fromLeft ? -20 : w + 20, y: rnd(h * 0.38, h * 0.92), vx: (fromLeft ? 1 : -1) * rnd(fish ? 30 : 12, fish ? 55 : 28), vy: rnd(-4, 4), kind: fish ? 'poisson' : KINDS[Math.floor(Math.random() * KINDS.length)], a: rnd(0, 6), gone: 0 }
  }

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    st.now = now
    if (!st.bits.length) for (let i = 0; i < 12; i++) st.bits.push({ ...spawn(w, h, i % 4 === 0), x: rnd(0.1, 0.9) * w })
    const left = TIME - now
    if (!st.over && (left <= 0 || st.got >= GOAL)) {
      st.over = true
      setTimeout(() => onEnd(Math.round(clamp(clamp(st.got / GOAL, 0, 1) * 85 - st.fish * 5 + (st.got >= GOAL ? (left / TIME) * 15 : 0), 0, 100))), 900)
    }
    if (!st.over && now > st.next && st.bits.filter((b) => !b.gone).length < 16) {
      st.bits.push(spawn(w, h, Math.random() < 0.3))
      st.next = now + rnd(0.5, 1.1)
    }
    setHud({ left: Math.max(0, left), got: st.got })
    // The sunset over the lagoon, the far bank, the water darkening as the time runs.
    const dusk = clamp(now / TIME, 0, 1)
    const sky = g.createLinearGradient(0, 0, 0, h * 0.32)
    sky.addColorStop(0, dusk < 0.6 ? '#ff922b' : '#5f3dc4')
    sky.addColorStop(1, '#ffd8a8')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h * 0.32)
    g.fillStyle = '#ffd43b'
    g.beginPath()
    g.arc(w * 0.7, h * (0.22 + dusk * 0.12), 26, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2b3a2f'
    g.fillRect(0, h * 0.28, w, h * 0.05)
    for (let i = 0; i < 9; i++) g.fillRect((i / 9) * w + 10, h * 0.2, 6, h * 0.1)
    const water = g.createLinearGradient(0, h * 0.32, 0, h)
    water.addColorStop(0, `rgb(${Math.round(60 - dusk * 30)},${Math.round(110 - dusk * 50)},${Math.round(130 - dusk * 40)})`)
    water.addColorStop(1, '#14303a')
    g.fillStyle = water
    g.fillRect(0, h * 0.32, w, h * 0.68)
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 2
    for (let i = 0; i < 14; i++) {
      const y = h * 0.36 + (i / 14) * h * 0.62
      const x = ((now * 20 + i * 90) % (w + 120)) - 60
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + 40, y)
      g.stroke()
    }
    // What floats.
    for (const b of st.bits) {
      if (b.gone && now - b.gone > 0.5) continue
      b.x += b.vx * dt
      b.y += (b.vy + Math.sin(now * 2 + b.a) * 6) * dt
      b.y = clamp(b.y, h * 0.36, h * 0.95)
      if (b.x < -40 || b.x > w + 40) b.gone = b.gone || now - 1
      g.save()
      g.translate(b.x, b.y)
      g.globalAlpha = b.gone ? clamp(1 - (now - b.gone) * 2, 0, 1) : 1
      if (b.gone) g.translate(0, -(now - b.gone) * 60)
      drawBit(g, b, now)
      g.restore()
    }
    st.bits = st.bits.filter((b) => !b.gone || now - b.gone < 0.5)
    // The nets drawn: the loop being drawn, and the ones just pulled.
    const line = (p: { x: number; y: number }[], c: string, close = false) => {
      if (p.length < 2) return
      g.strokeStyle = c
      g.lineWidth = 3
      g.setLineDash([6, 5])
      g.beginPath()
      g.moveTo(p[0].x, p[0].y)
      for (const q of p) g.lineTo(q.x, q.y)
      if (close) g.closePath()
      g.stroke()
      g.setLineDash([])
    }
    if (st.drawing) {
      line(st.loop, '#fff4d6')
      const a = st.loop[0]
      if (a) {
        g.strokeStyle = 'rgba(255,244,214,0.6)'
        g.beginPath()
        g.arc(a.x, a.y, 22, 0, Math.PI * 2)
        g.stroke()
      }
    }
    st.nets = st.nets.filter((n) => now - n.at < 0.6)
    for (const n of st.nets) line(n.poly, n.ok ? '#69db7c' : '#ff8787', true)
  }

  const pull = () => {
    const st = s.current
    const p = st.loop
    st.drawing = false
    st.loop = []
    if (p.length < 8) return
    const a = p[0]
    const b = p[p.length - 1]
    const closed = Math.hypot(a.x - b.x, a.y - b.y) < 50
    const now = st.now
    if (!closed) {
      setFlash({ text: t('Ferme la boucle !'), at: now })
      return
    }
    let got = 0
    let fish = 0
    for (const bit of st.bits) {
      if (bit.gone || !inside(bit.x, bit.y, p)) continue
      bit.gone = now
      if (bit.kind === 'poisson') fish++
      else got++
    }
    st.got += got
    st.fish += fish
    st.nets.push({ poly: p, at: now, ok: fish === 0 && got > 0 })
    const cx = p.reduce((a, q) => a + q.x, 0) / p.length
    const cy = p.reduce((a, q) => a + q.y, 0) / p.length
    if (got) (beep(520 + got * 60, 0.15, 0.12), fx.good(cx, cy, `+${got}`))
    if (fish) fx.bad(cx, cy, t('Un poisson !'))
    if (st.got >= GOAL) fx.win(st.w)
    if (fish) {
      beep(200, 0.25, 0.12, { type: 'square' })
      setFlash({ text: t('Un poisson ! On le relâche…'), at: now })
    } else if (got >= 3) setFlash({ text: t('Beau coup de filet !'), at: now })
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (st.over) return
    if (e.kind === 'down') {
      st.drawing = true
      st.loop = [{ x: e.x, y: e.y }]
    } else if (e.kind === 'move' && st.drawing) {
      const l = st.loop[st.loop.length - 1]
      if (Math.hypot(e.x - l.x, e.y - l.y) > 6) st.loop.push({ x: e.x, y: e.y })
    } else if (e.kind === 'up' && st.drawing) pull()
  }

  return (
    <div className="absolute inset-0 bg-[#14303a]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Le filet')} left={hud.left} done={`${hud.got}/${GOAL}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Entoure les plastiques d’un trait et ferme la boucle. Laisse les poissons !')}</p>
    </div>
  )
}

function drawBit(g: CanvasRenderingContext2D, b: Bit, now: number) {
  switch (b.kind) {
    case 'bouteille':
      g.rotate(b.a)
      g.fillStyle = 'rgba(180,230,255,0.85)'
      g.fillRect(-12, -5, 20, 10)
      g.fillRect(8, -3, 6, 6)
      g.fillStyle = '#1c7ed6'
      g.fillRect(13, -3, 3, 6)
      g.fillStyle = '#e03131'
      g.fillRect(-6, -5, 7, 10)
      break
    case 'sachet':
      g.rotate(Math.sin(now + b.a) * 0.4)
      g.fillStyle = 'rgba(250,250,250,0.8)'
      g.beginPath()
      g.moveTo(-10, -8)
      g.lineTo(10, -9)
      g.lineTo(12, 8)
      g.lineTo(-11, 9)
      g.closePath()
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.25)'
      g.stroke()
      break
    case 'tapette':
      g.rotate(b.a)
      g.fillStyle = '#fab005'
      g.beginPath()
      g.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#1c7ed6'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(-2, -5)
      g.lineTo(4, 0)
      g.lineTo(-2, 5)
      g.stroke()
      break
    case 'poisson': {
      // A fish's back just under the surface, its tail flicking.
      const dir = Math.sign(b.vx) || 1
      g.scale(dir, 1)
      g.fillStyle = 'rgba(30,50,40,0.75)'
      g.beginPath()
      g.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(-14, 0)
      g.lineTo(-24, -6 + Math.sin(now * 12) * 3)
      g.lineTo(-24, 6 + Math.sin(now * 12) * 3)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.5)'
      g.fillRect(9, -2, 2, 2)
      break
    }
  }
}
