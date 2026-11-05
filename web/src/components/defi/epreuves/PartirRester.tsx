import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, fx, knock, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « Partir ou rester », chapter 4 (game/epreuves.go): Ange-Michel's first days at the port of San-Pédro,
// up in the crane's cabin with his colleagues watching. The container swings from side to side on the
// crane; tap to let it down on the stack. What sticks out over the one under falls into the water; the
// stack gets narrower if you're off. Ten containers on the ship, as square as you can.

const GOAL = 10
const COLORS = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0ca678', '#c2255c']

type Box = { x: number; w: number }

export default function PartirRester({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ stack: [] as Box[], swing: 0, dir: 1, falling: null as null | { x: number; w: number; y: number; v: number }, cut: [] as { x: number; w: number; y: number; v: number; c: string }[], perfect: 0, over: false, w: 0, h: 0, now: 0, cam: 0, started: false })
  const [hud, setHud] = useState({ n: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const BH = 28 // a container's height on screen

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    st.now = now
    if (!st.started) {
      st.started = true
      st.stack = [{ x: w / 2 - w * 0.22, w: w * 0.44 }]
    }
    const top = st.stack[st.stack.length - 1]
    const level = st.stack.length
    // The container on the crane swings, quicker as the stack grows.
    const speed = 120 + level * 22
    // A pendulum, not a shuttle: slow at each end, quickest in the middle (st.dir is its phase here).
    if (!st.falling && !st.over) {
      const span = (w - top.w - 12) / 2
      st.dir += (speed / Math.max(40, span)) * dt
      st.swing = 6 + span + Math.sin(st.dir) * span
    }
    const baseY = h * 0.82
    const yOf = (i: number) => baseY - (i + 1) * BH + st.cam
    st.cam += (Math.max(0, (level - 5) * BH) - st.cam) * Math.min(1, dt * 4)
    // Let down: it drops onto the stack.
    if (st.falling) {
      const f = st.falling
      f.v += 1600 * dt
      f.y += f.v * dt
      const land = yOf(level - 1)
      if (f.y >= land) {
        st.falling = null
        // The weight of it: a low knock on the steel.
        knock(0.5, 0, 260)
        const l = Math.max(f.x, top.x)
        const r = Math.min(f.x + f.w, top.x + top.w)
        const over = r - l
        if (over <= 4) {
          // Missed altogether: into the water.
          st.cut.push({ x: f.x, w: f.w, y: land, v: 0, c: COLORS[level % COLORS.length] })
          beep(120, 0.5, 0.15, { type: 'sawtooth', to: 50 })
          fx.bad(f.x + f.w / 2, land, t('Plouf !'))
          end()
        } else {
          const nearly = Math.abs(f.x - top.x) < 6
          const box = nearly ? { x: top.x, w: top.w } : { x: l, w: over }
          if (!nearly) {
            const cx = f.x < top.x ? f.x : r
            const cw = f.w - over
            st.cut.push({ x: cx, w: cw, y: land, v: 0, c: COLORS[level % COLORS.length] })
            fx.shake(4)
            beep(260, 0.15, 0.12, { type: 'square' })
          } else {
            st.perfect++
            fx.good(box.x + box.w / 2, land, t('Pile !'))
            beep(880, 0.12, 0.12)
          }
          st.stack.push(box)
          setHud({ n: st.stack.length - 1 })
          if (st.stack.length - 1 >= GOAL) {
            setFlash({ text: t('Le navire est chargé !'), at: now })
            fx.win(w)
            end()
          }
        }
      }
    }
    for (const c of st.cut) {
      c.v += 1400 * dt
      c.y += c.v * dt
    }
    st.cut = st.cut.filter((c) => c.y < h + 100)
    // The sky, the sea, the ship's hull, the crane's arm.
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#74c0fc')
    sky.addColorStop(1, '#e7f5ff')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#1864ab'
    g.fillRect(0, baseY + st.cam + 30, w, h)
    g.fillStyle = '#343a40'
    g.beginPath()
    g.moveTo(w * 0.08, baseY + st.cam)
    g.lineTo(w * 0.92, baseY + st.cam)
    g.lineTo(w * 0.84, baseY + st.cam + 46)
    g.lineTo(w * 0.16, baseY + st.cam + 46)
    g.closePath()
    g.fill()
    g.fillStyle = '#fff'
    g.font = 'bold 11px sans-serif'
    g.fillText('SAN-PÉDRO', w * 0.2, baseY + st.cam + 28)
    g.fillStyle = '#fab005'
    g.fillRect(0, 54, w, 10)
    // The stack.
    for (const [i, b] of st.stack.entries()) {
      if (i === 0) continue
      drawBox(g, b.x, yOf(i - 1), b.w, BH, COLORS[i % COLORS.length])
    }
    for (const c of st.cut) drawBox(g, c.x, c.y, c.w, BH, c.c)
    // The container on the crane, its cable.
    if (!st.over) {
      const x = st.falling ? st.falling.x : st.swing
      const y = st.falling ? st.falling.y : 90
      g.strokeStyle = '#212529'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(x + top.w / 2, 64)
      g.lineTo(x + top.w / 2, y)
      g.stroke()
      drawBox(g, x, y, st.falling ? st.falling.w : top.w, BH, COLORS[level % COLORS.length])
    }
  }

  const end = () => {
    const st = s.current
    if (st.over) return
    st.over = true
    const n = st.stack.length - 1
    setTimeout(() => onEnd(Math.round(Math.min(100, (n / GOAL) * 80 + st.perfect * 2))), 1100)
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.over || st.falling) return
    const top = st.stack[st.stack.length - 1]
    st.falling = { x: st.swing, w: top.w, y: 90, v: 0 }
    beep(400, 0.06, 0.06)
  }

  return (
    <div className="absolute inset-0 bg-[#74c0fc]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('La grue du port')} done={`${hud.n}/${GOAL}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white">{t('Touche pour lâcher le conteneur pile sur la pile.')}</p>
    </div>
  )
}

function drawBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
  g.strokeStyle = 'rgba(0,0,0,0.25)'
  g.lineWidth = 1
  for (let i = x + 6; i < x + w - 3; i += 7) {
    g.beginPath()
    g.moveTo(i, y + 3)
    g.lineTo(i, y + h - 3)
    g.stroke()
  }
  g.strokeStyle = 'rgba(0,0,0,0.45)'
  g.lineWidth = 2
  g.strokeRect(x, y, w, h)
}
