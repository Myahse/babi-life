import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, clamp, rnd, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « La finale des moins de 13 ans », chapter 1 (game/epreuves.go): spying on the other team at their
// match. Their players pass the ball round fast (and their « petit » of two metres is in it): follow it
// with your eyes. When it stops, the ball's hidden under the players' feet: tap the one who has it. Five
// moves, each longer and quicker, the players running about more.

const ROUNDS = 5
const PLAYERS = 6

type P = { x: number; y: number; tx: number; ty: number; big: boolean; n: number }

export default function GrandMatch({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ ps: [] as P[], round: 0, passes: [] as number[], k: 0, at: 0, holder: 0, phase: 'wait' as 'wait' | 'pass' | 'guess' | 'show', good: 0, w: 0, h: 0, now: 0, nextAt: 1, pick: -1 })
  const [hud, setHud] = useState({ round: 1, good: 0, phase: 'wait' as string })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const newRound = (now: number) => {
    const st = s.current
    const n = 3 + st.round
    st.passes = []
    let from = st.holder
    for (let i = 0; i < n; i++) {
      let to = from
      while (to === from) to = Math.floor(Math.random() * PLAYERS)
      st.passes.push(to)
      from = to
    }
    st.k = 0
    st.at = now
    st.phase = 'pass'
    st.pick = -1
    setHud({ round: st.round + 1, good: st.good, phase: 'pass' })
  }

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.now = now
    if (st.w !== w) {
      st.w = w
      st.h = h
      st.ps = Array.from({ length: PLAYERS }, (_, i) => {
        const x = rnd(0.15, 0.85) * w
        const y = rnd(0.25, 0.85) * h
        return { x, y, tx: x, ty: y, big: i === 2, n: [7, 10, 9, 4, 11, 8][i] }
      })
    }
    const passTime = Math.max(0.32, 0.75 - st.round * 0.1)
    if (st.phase === 'wait' && now >= st.nextAt) newRound(now)
    // The players run about (more each round), towards a spot then another.
    for (const p of st.ps) {
      const sp = 30 + st.round * 22
      const d = Math.hypot(p.tx - p.x, p.ty - p.y)
      if (d < 4) {
        p.tx = clamp(p.x + rnd(-80, 80), w * 0.1, w * 0.9)
        p.ty = clamp(p.y + rnd(-80, 80), h * 0.22, h * 0.88)
      } else if (st.phase !== 'show') {
        p.x += ((p.tx - p.x) / d) * sp * dt
        p.y += ((p.ty - p.y) / d) * sp * dt
      }
    }
    // The ball: from one to the next along its pass; done, it's hidden at the last one's feet.
    let bx = st.ps[st.holder]?.x ?? 0
    let by = st.ps[st.holder]?.y ?? 0
    if (st.phase === 'pass') {
      const k = Math.floor((now - st.at) / passTime)
      if (k >= st.passes.length) {
        st.holder = st.passes[st.passes.length - 1]
        st.phase = 'guess'
        setHud({ round: st.round + 1, good: st.good, phase: 'guess' })
      } else {
        if (k !== st.k) {
          st.k = k
          beep(500 + Math.random() * 200, 0.04, 0.06, { type: 'square' })
        }
        const a = st.ps[k === 0 ? st.holder : st.passes[k - 1]]
        const b = st.ps[st.passes[k]]
        const f = (now - st.at - k * passTime) / passTime
        bx = a.x + (b.x - a.x) * f
        by = a.y + (b.y - a.y) * f - Math.sin(f * Math.PI) * 18
      }
    }
    // The pitch from above.
    g.fillStyle = '#2b8a3e'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#2f9e44' : '#2b8a3e'
      g.fillRect(0, h * 0.15 + (i * h * 0.85) / 8, w, (h * 0.85) / 8)
    }
    g.strokeStyle = 'rgba(255,255,255,0.7)'
    g.lineWidth = 3
    g.strokeRect(w * 0.05, h * 0.17, w * 0.9, h * 0.78)
    g.beginPath()
    g.arc(w / 2, h * 0.56, 40, 0, Math.PI * 2)
    g.stroke()
    for (const [i, p] of st.ps.entries()) {
      const r = p.big ? 20 : 13
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.beginPath()
      g.ellipse(p.x, p.y + r * 0.8, r, r * 0.4, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = st.phase === 'show' && i === st.holder ? '#ffd43b' : st.phase === 'show' && i === st.pick ? '#868e96' : '#e03131'
      g.beginPath()
      g.arc(p.x, p.y, r, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#fff'
      g.font = `bold ${p.big ? 15 : 11}px sans-serif`
      g.textAlign = 'center'
      g.fillText(String(p.n), p.x, p.y + 4)
      g.textAlign = 'left'
    }
    if (st.phase === 'pass' || st.phase === 'show') {
      const [x, y] = st.phase === 'show' ? [st.ps[st.holder].x, st.ps[st.holder].y + 16] : [bx, by]
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(x, y, 6, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#111'
      g.lineWidth = 1.5
      g.stroke()
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.phase !== 'guess') return
    let pick = -1
    let bd = Infinity
    st.ps.forEach((p, i) => {
      const d = Math.hypot(e.x - p.x, e.y - p.y)
      if (d < (p.big ? 34 : 28) && d < bd) ((bd = d), (pick = i))
    })
    if (pick < 0) return
    st.pick = pick
    st.phase = 'show'
    const ok = pick === st.holder
    if (ok) {
      st.good++
      beep(660, 0.12, 0.12)
      beep(990, 0.2, 0.12)
    } else beep(170, 0.3, 0.12, { type: 'square' })
    setFlash({ text: ok ? t('Bien vu !') : t('Raté, c’est le numéro {n}', { n: st.ps[st.holder].n }), at: st.now })
    st.round++
    setHud({ round: Math.min(ROUNDS, st.round + 1), good: st.good, phase: 'show' })
    if (st.round >= ROUNDS) setTimeout(() => onEnd(Math.round((st.good / ROUNDS) * 100)), 1300)
    else {
      st.phase = 'show'
      st.nextAt = st.now + 1.4
      setTimeout(() => (st.phase = 'wait'), 1300)
    }
  }

  return (
    <div className="absolute inset-0 bg-[#2b8a3e]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Espionner l’équipe')} done={`${hud.good}/${ROUNDS}`} />
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 text-center font-display text-lg font-extrabold text-white drop-shadow">{hud.phase === 'guess' ? t('Qui a le ballon ?') : hud.phase === 'pass' ? t('Suis le ballon… ({n}/{all})', { n: hud.round, all: ROUNDS }) : ''}</div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}
