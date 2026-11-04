import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, clamp, fx, useHud, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « Le petit-fils du vieux Koné », chapter 2 (game/epreuves.go): at the barbier, to look « tout propre »
// for the grandson. The head seen from the side, the barber's chalk line for the dégradé round it: run the
// clippers along the line with the finger, from the neck to the temple, not too far off it (or it's a hole
// in the hair, and the vieux will see it). Three passes: the neck, the side, the temple.

const TIME = 30
const PASSES = 3
const TOL = 16 // px off the line before it's a mistake

export default function KonePetitFils({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ pass: 0, prog: 0, err: 0, samples: 0, down: false, cut: [] as { x: number; y: number; bad: boolean }[], over: false, w: 0, h: 0, now: 0, scores: [] as number[], tool: { x: -100, y: -100 } })
  const [hud, setHud] = useHud({ left: TIME, pass: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  // The head and each pass's line: from the back of the neck up round the ear, higher each pass.
  const geo = (w: number, h: number) => ({ cx: w / 2, cy: h * 0.48, r: Math.min(w * 0.36, h * 0.26) })
  const line = (pass: number, u: number, w: number, h: number) => {
    const { cx, cy, r } = geo(w, h)
    const lift = pass * 0.16
    const a = Math.PI * (0.62 - u * 0.95)
    const rr = r * (0.98 - pass * 0.04)
    return { x: cx + Math.cos(a) * rr * 0.95, y: cy + Math.sin(a) * rr * (0.62 - lift) + r * (0.18 - lift * 0.9) }
  }

  const finishPass = () => {
    const st = s.current
    const acc = st.samples ? clamp(1 - st.err / st.samples, 0, 1) : 0
    const sc = Math.round(acc * 100)
    st.scores.push(sc)
    const { x, y } = line(st.pass, 1, st.w, st.h)
    if (sc >= 80) fx.good(x, y, t('Propre !'))
    else fx.bad(x, y, `${sc} %`)
    beep(sc >= 80 ? 880 : 300, 0.2, 0.12)
    st.pass++
    st.prog = 0
    st.err = 0
    st.samples = 0
    if (st.pass >= PASSES) {
      st.over = true
      const avg = st.scores.reduce((a, b) => a + b, 0) / st.scores.length
      if (avg >= 80) fx.win(st.w)
      setFlash({ text: avg >= 80 ? t('Tout propre !') : t('Il y a un trou…'), at: st.now })
      setTimeout(() => onEnd(Math.round(avg)), 1100)
    } else setFlash({ text: [t('La nuque'), t('Le côté'), t('La tempe')][st.pass], at: st.now })
  }

  const frame = ({ g, w, h, t: now }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    st.now = now
    const left = TIME - now
    if (!st.over && left <= 0) {
      st.over = true
      const done = st.scores.reduce((a, b) => a + b, 0)
      setTimeout(() => onEnd(Math.round(done / PASSES)), 900)
    }
    setHud({ left: Math.max(0, left), pass: st.pass })
    // The salon: the mirror's frame, the posters.
    g.fillStyle = '#f1e4d0'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#d9c7a8'
    g.fillRect(0, h * 0.82, w, h * 0.18)
    g.fillStyle = '#c92a2a'
    g.fillRect(w * 0.06, h * 0.12, w * 0.1, h * 0.18)
    g.fillStyle = '#1c7ed6'
    g.fillRect(w * 0.84, h * 0.12, w * 0.1, h * 0.18)
    const { cx, cy, r } = geo(w, h)
    // The head, the ear, the hair (cut where the clippers went).
    g.fillStyle = '#6b4430'
    g.beginPath()
    g.ellipse(cx, cy, r * 0.95, r, 0, 0, Math.PI * 2)
    g.fill()
    g.fillRect(cx - r * 0.35, cy + r * 0.7, r * 0.7, r * 0.6)
    g.fillStyle = '#1a1a1a'
    g.beginPath()
    g.ellipse(cx, cy - r * 0.12, r * 0.99, r * 0.92, 0, Math.PI * 0.95, Math.PI * 2.05)
    g.fill()
    for (let i = 0; i < 260; i++) {
      const a = Math.PI + (i / 260) * Math.PI
      g.fillStyle = 'rgba(60,60,60,0.5)'
      g.fillRect(cx + Math.cos(a) * r * 0.9, cy - r * 0.1 + Math.sin(a) * r * 0.85, 2, 2)
    }
    // The cut: lighter where the clippers passed, a gash where they went off.
    for (const c of st.cut) {
      g.fillStyle = c.bad ? '#8d5a3b' : 'rgba(120,100,90,0.9)'
      g.beginPath()
      g.arc(c.x, c.y, c.bad ? 7 : 6, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = '#5a3828'
    g.beginPath()
    g.ellipse(cx + r * 0.05, cy + r * 0.15, r * 0.14, r * 0.22, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#111'
    g.beginPath()
    g.arc(cx + r * 0.62, cy + r * 0.05, r * 0.06, 0, Math.PI * 2)
    g.fill()
    // The chalk line of this pass, the part done solid.
    if (!st.over) {
      g.setLineDash([7, 6])
      g.strokeStyle = '#fff'
      g.lineWidth = 3
      g.beginPath()
      for (let u = 0; u <= 1.001; u += 0.02) {
        const p = line(st.pass, u, w, h)
        if (u === 0) g.moveTo(p.x, p.y)
        else g.lineTo(p.x, p.y)
      }
      g.stroke()
      g.setLineDash([])
      const a = line(st.pass, 0, w, h)
      const b = line(st.pass, st.prog, w, h)
      g.fillStyle = '#69db7c'
      g.beginPath()
      g.arc(a.x, a.y, 8, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffd43b'
      g.beginPath()
      g.arc(b.x, b.y, 5, 0, Math.PI * 2)
      g.fill()
    }
    // The clippers under the finger.
    const tl = st.tool
    g.save()
    g.translate(tl.x, tl.y)
    g.rotate(-0.5)
    g.fillStyle = '#212529'
    g.fillRect(-8, -4, 16, 44)
    g.fillStyle = '#adb5bd'
    g.fillRect(-10, -10, 20, 8)
    if (st.down) {
      g.fillStyle = 'rgba(255,255,255,0.6)'
      g.fillRect(-10 + Math.random() * 2, -12, 20, 2)
    }
    g.restore()
  }

  const touch = (e: Touch) => {
    const st = s.current
    st.tool = { x: e.x, y: e.y }
    if (st.over) return
    if (e.kind === 'down') st.down = true
    if (e.kind === 'up') {
      st.down = false
      return
    }
    if (!st.down) return
    // Where on the line the clippers are: the nearest point a little ahead of what's done.
    let best = st.prog
    let bd = Infinity
    for (let u = Math.max(0, st.prog - 0.05); u <= Math.min(1, st.prog + 0.12); u += 0.005) {
      const p = line(st.pass, u, st.w, st.h)
      const d = Math.hypot(p.x - e.x, p.y - e.y)
      if (d < bd) ((bd = d), (best = u))
    }
    if (bd > TOL * 3) return
    st.samples++
    const bad = bd > TOL
    if (bad) {
      st.err++
      if (Math.random() < 0.3) fx.shake(3)
    }
    st.cut.push({ x: e.x, y: e.y, bad })
    if (Math.random() < 0.25) beep(140 + Math.random() * 30, 0.04, 0.03, { type: 'sawtooth' })
    st.prog = Math.max(st.prog, best)
    if (st.prog >= 0.98) {
      st.down = false
      finishPass()
    }
  }

  return (
    <div className="absolute inset-0 bg-[#f1e4d0]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Le dégradé')} left={hud.left} done={`${Math.min(hud.pass + 1, PASSES)}/${PASSES}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-[#5c3a21]">{t('Pars du rond vert et suis le trait blanc sans lever le doigt.')}</p>
    </div>
  )
}
