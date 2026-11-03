import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, clamp, knock, rnd, useHud, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « La cour hantée », chapter 3 (game/epreuves.go): the night watch in the cour. The tin roof over the
// rooms, all dark; something walks on it: the steps knock on the tin (heard left or right, where it is),
// a little dust falls where it treads. The finger moves the torch's beam: held on it a moment, it's seen
// (the « ghost » is double: a cat that cries like a baby, and a child who sleeps up there) and it runs off
// elsewhere. Six seen before the battery's out (45 s).

const TIME = 45
const GOAL = 6
const HOLD = 0.55 // seconds in the beam to be seen
const BEAM = 62 // the beam's radius (px)

type Who = 'chat' | 'enfant'
type Thing = { who: Who; x: number; to: number; wait: number; step: number; held: number; seen: number }

export default function CourHantee({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ beam: { x: 0, y: 0, on: false }, thing: null as Thing | null, found: 0, over: false, dust: [] as { x: number; y: number; v: number; a: number }[], end: 0 })
  const [hud, setHud] = useHud({ left: TIME, found: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const fresh = (w: number, who: Who): Thing => ({ who, x: rnd(0.15, 0.85) * w, to: rnd(0.1, 0.9) * w, wait: rnd(0.3, 1), step: 0, held: 0, seen: 0 })

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    const roofY = h * 0.3
    const roofH = h * 0.2
    st.thing ??= fresh(w, 'chat')
    const th = st.thing
    const left = TIME - now
    if (!st.over && (left <= 0 || st.found >= GOAL)) {
      st.over = true
      const score = Math.round(clamp(st.found / GOAL, 0, 1) * 80 + (st.found >= GOAL ? clamp(left / TIME, 0, 1) * 20 : 0))
      setTimeout(() => onEnd(score), 900)
    }
    // It walks the roof: a few steps, a wait, the cat quick and light, the child slower, heavier.
    if (!st.over && th.seen === 0) {
      const speed = th.who === 'chat' ? 150 : 80
      if (th.wait > 0) th.wait -= dt
      else {
        const d = th.to - th.x
        th.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt)
        th.step -= dt
        if (th.step <= 0) {
          th.step = th.who === 'chat' ? 0.16 : 0.34
          knock(th.who === 'chat' ? 0.18 : 0.4, (th.x / w) * 2 - 1, th.who === 'chat' ? 1600 : 700)
          if (Math.random() < 0.6) st.dust.push({ x: th.x + rnd(-8, 8), y: roofY + roofH, v: rnd(20, 50), a: 1 })
        }
        if (Math.abs(d) < 2) {
          th.to = rnd(0.08, 0.92) * w
          th.wait = rnd(0.2, th.who === 'chat' ? 0.9 : 1.6)
        }
      }
      // In the beam a while: seen.
      const ty = roofY + roofH * 0.35
      const inBeam = st.beam.on && Math.hypot(st.beam.x - th.x, st.beam.y - ty) < BEAM
      th.held = inBeam ? th.held + dt : Math.max(0, th.held - dt * 2)
      if (th.held >= HOLD) {
        th.seen = now
        st.found++
        if (th.who === 'chat') {
          beep(900, 0.25, 0.12, { type: 'triangle', to: 600 })
          beep(1100, 0.35, 0.08, { type: 'triangle', to: 700 })
        } else beep(330, 0.2, 0.12, { type: 'square', to: 220 })
        setFlash({ text: th.who === 'chat' ? t('Un chat !') : t('Un enfant !'), at: now })
      }
    }
    if (th.seen && now - th.seen > 0.9 && !st.over) st.thing = fresh(w, th.who === 'chat' ? 'enfant' : 'chat')
    setHud({ left: Math.max(0, left), found: st.found })

    // The night sky, the roof, the rooms' doors below, the mango tree.
    g.fillStyle = '#0b0d1c'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#d9e2ff'
    for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, (i * 53) % (roofY - 10), 1.5, 1.5)
    const lit = (draw: () => void) => {
      g.save()
      draw()
      g.restore()
    }
    lit(() => {
      g.fillStyle = '#1b1e2a'
      g.fillRect(0, roofY, w, roofH)
      g.strokeStyle = '#262a3a'
      g.lineWidth = 2
      for (let x = 0; x < w; x += 14) {
        g.beginPath()
        g.moveTo(x, roofY)
        g.lineTo(x, roofY + roofH)
        g.stroke()
      }
      g.fillStyle = '#12141d'
      g.fillRect(0, roofY + roofH, w, h - roofY - roofH)
      for (let i = 0; i < 5; i++) {
        g.fillStyle = '#0d0f17'
        g.fillRect(((i + 0.5) / 5) * w - 18, roofY + roofH + 30, 36, 70)
      }
    })
    // The dust falling.
    st.dust = st.dust.filter((d) => d.a > 0)
    for (const d of st.dust) {
      d.y += d.v * dt
      d.a -= dt * 0.8
      g.fillStyle = `rgba(200,190,170,${d.a * 0.5})`
      g.fillRect(d.x, d.y, 2, 2)
    }
    // The beam: the light where it points, the roof and what's on it seen there only.
    if (st.beam.on) {
      g.save()
      g.beginPath()
      g.arc(st.beam.x, st.beam.y, BEAM, 0, Math.PI * 2)
      g.clip()
      g.fillStyle = '#8c8577'
      g.fillRect(0, roofY, w, roofH)
      g.strokeStyle = '#6f695e'
      for (let x = 0; x < w; x += 14) {
        g.beginPath()
        g.moveTo(x, roofY)
        g.lineTo(x, roofY + roofH)
        g.stroke()
      }
      g.fillStyle = '#5a4a3a'
      g.fillRect(0, roofY + roofH, w, h)
      // What's on the roof, in the light.
      drawThing(g, th, roofY + roofH * 0.35, now)
      g.restore()
      const grad = g.createRadialGradient(st.beam.x, st.beam.y, 0, st.beam.x, st.beam.y, BEAM * 1.3)
      grad.addColorStop(0, 'rgba(255,240,190,0.25)')
      grad.addColorStop(1, 'rgba(255,240,190,0)')
      g.fillStyle = grad
      g.fillRect(st.beam.x - BEAM * 1.3, st.beam.y - BEAM * 1.3, BEAM * 2.6, BEAM * 2.6)
    }
    // Seen: it stays lit a moment, the eyes shining.
    if (th.seen) drawThing(g, th, roofY + roofH * 0.35, now)
    // The torch, held from below.
    g.fillStyle = '#2b2b2b'
    const bx = st.beam.on ? st.beam.x : w / 2
    g.fillRect(bx * 0.6 + w * 0.2 - 8, h - 70, 16, 70)
    // The ring of « almost »: held in the beam.
    if (th.held > 0 && !th.seen) {
      g.strokeStyle = '#ffd43b'
      g.lineWidth = 4
      g.beginPath()
      g.arc(st.beam.x, st.beam.y, BEAM + 6, -Math.PI / 2, -Math.PI / 2 + (th.held / HOLD) * Math.PI * 2)
      g.stroke()
    }
  }

  const touch = (e: Touch) => {
    const b = s.current.beam
    b.x = e.x
    b.y = e.y
    b.on = e.kind !== 'up'
  }

  return (
    <div className="absolute inset-0 bg-[#0b0d1c]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('La lampe torche')} left={hud.left} done={`${hud.found}/${GOAL}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs font-bold text-white/70">{t('Écoute les pas, suis la poussière, garde la lumière dessus')}</p>
    </div>
  )
}

function drawThing(g: CanvasRenderingContext2D, th: Thing, y: number, now: number) {
  g.save()
  g.translate(th.x, y)
  if (th.who === 'chat') {
    g.fillStyle = '#1a1a1a'
    g.beginPath()
    g.ellipse(0, 6, 16, 9, 0, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.arc(14, -2, 7, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(10, -8)
    g.lineTo(12, -15)
    g.lineTo(15, -8)
    g.moveTo(15, -8)
    g.lineTo(18, -15)
    g.lineTo(20, -6)
    g.fill()
    g.strokeStyle = '#1a1a1a'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(-15, 4)
    g.quadraticCurveTo(-26, -6 + Math.sin(now * 6) * 4, -22, -14)
    g.stroke()
    g.fillStyle = '#c0eb75'
    g.fillRect(12, -4, 3, 3)
    g.fillRect(17, -4, 3, 3)
  } else {
    // A child curled up, a pagne over him.
    g.fillStyle = '#3b2a20'
    g.beginPath()
    g.arc(-14, -4, 8, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#c2410c'
    g.beginPath()
    g.ellipse(4, 2, 20, 10, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff'
    g.fillRect(-17, -6, 2, 2)
    g.fillRect(-12, -6, 2, 2)
  }
  g.restore()
}
