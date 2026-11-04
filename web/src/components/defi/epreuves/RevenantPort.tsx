import { useRef } from 'react'
import { Canvas, Hud, beep, fx, rnd, useHud, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « Le bateau fantôme de San-Pédro », chapter 1 (game/epreuves.go): at the place of worship, the candles
// lit for Daniel, gone fishing a month ago and silent since. The sea wind comes in by the open doors:
// a candle trembles (the swirl shows which), then the gust. Keep your hand over it (the finger on it)
// as the gust comes and it holds; blown out, tap it to light it again with a match. Keep them lit.

const TIME = 45
const N = 5
type Candle = { lit: boolean; warn: number; relight: number; h: number }

export default function RevenantPort({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ c: Array.from({ length: N }, () => ({ lit: true, warn: 0, relight: 0, h: rnd(0.7, 1) }) as Candle), hand: { x: -999, y: -999, on: false }, next: 2, litTime: 0, total: 0, over: false, w: 0, h: 0, now: 0 })
  const [hud, setHud] = useHud({ left: TIME, lit: N })

  const at = (i: number) => {
    const { w, h } = s.current
    return { x: w * (0.14 + (i / (N - 1)) * 0.72), y: h * 0.56 }
  }

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    st.now = now
    const left = TIME - now
    if (!st.over) {
      st.total += dt * N
      st.litTime += dt * st.c.filter((c) => c.lit).length
    }
    if (!st.over && left <= 0) {
      st.over = true
      const score = Math.round((st.litTime / Math.max(1, st.total)) * 100)
      if (score >= 80) fx.win(w)
      setTimeout(() => onEnd(score), 900)
    }
    // The wind picks a candle (two, later on), shows it, then blows.
    if (!st.over && now >= st.next) {
      const lit = st.c.map((c, i) => (c.lit && !c.warn ? i : -1)).filter((i) => i >= 0)
      const n = now > TIME * 0.5 && Math.random() < 0.4 ? 2 : 1
      for (let k = 0; k < n && lit.length; k++) st.c[lit.splice(Math.floor(Math.random() * lit.length), 1)[0]].warn = now + Math.max(0.75, 1.2 - now * 0.01)
      st.next = now + Math.max(1.1, 2.6 - now * 0.035)
    }
    for (const [i, c] of st.c.entries()) {
      if (c.warn && now >= c.warn) {
        c.warn = 0
        const p = at(i)
        const covered = st.hand.on && Math.hypot(st.hand.x - p.x, st.hand.y - (p.y - 40)) < 60
        beep(220, 0.5, 0.05, { type: 'sawtooth', to: 120 })
        if (covered) fx.good(p.x, p.y - 60, t('Tenu !'))
        else {
          c.lit = false
          fx.bad(p.x, p.y - 60)
        }
      }
      if (!c.lit && c.relight && now >= c.relight) {
        c.lit = true
        c.relight = 0
        beep(660, 0.12, 0.08, { type: 'triangle' })
        fx.burst(at(i).x, at(i).y - 50, ['#ffd43b', '#ff922b'], 8, 90)
      }
    }
    setHud({ left: Math.max(0, left), lit: st.c.filter((c) => c.lit).length })
    // The church at night, the open doors on the sea, the altar.
    g.fillStyle = '#15131f'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#1f2a44'
    g.fillRect(w * 0.08, h * 0.08, w * 0.18, h * 0.32)
    g.fillRect(w * 0.74, h * 0.08, w * 0.18, h * 0.32)
    g.fillStyle = '#2f4a6b'
    g.fillRect(w * 0.08, h * 0.3, w * 0.18, h * 0.1)
    g.fillRect(w * 0.74, h * 0.3, w * 0.18, h * 0.1)
    g.fillStyle = '#e9dfc9'
    g.fillRect(w / 2 - 3, h * 0.1, 6, h * 0.22)
    g.fillRect(w / 2 - 28, h * 0.16, 56, 6)
    g.fillStyle = '#4a3a2a'
    g.fillRect(w * 0.06, h * 0.6, w * 0.88, h * 0.08)
    g.fillStyle = '#f1e9d2'
    g.fillRect(w * 0.06, h * 0.6, w * 0.88, 6)
    // The light of the candles still lit on the wall.
    const lit = st.c.filter((c) => c.lit).length
    const glow = g.createRadialGradient(w / 2, h * 0.5, 10, w / 2, h * 0.5, w * 0.8)
    glow.addColorStop(0, `rgba(255,190,100,${0.08 + lit * 0.05})`)
    glow.addColorStop(1, 'rgba(255,190,100,0)')
    g.fillStyle = glow
    g.fillRect(0, 0, w, h)
    for (const [i, c] of st.c.entries()) {
      const p = at(i)
      const ch = 60 * c.h
      g.fillStyle = '#fbf5e6'
      g.fillRect(p.x - 9, p.y - ch, 18, ch)
      g.fillStyle = '#333'
      g.fillRect(p.x - 1, p.y - ch - 8, 2, 8)
      const wob = c.warn ? Math.sin(now * 40) * 4 : Math.sin(now * 6 + i) * 1.2
      if (c.lit) {
        const fl = g.createRadialGradient(p.x, p.y - ch - 16, 2, p.x, p.y - ch - 16, 40)
        fl.addColorStop(0, 'rgba(255,220,140,0.6)')
        fl.addColorStop(1, 'rgba(255,220,140,0)')
        g.fillStyle = fl
        g.fillRect(p.x - 40, p.y - ch - 56, 80, 80)
        g.fillStyle = '#ffd43b'
        g.beginPath()
        g.ellipse(p.x + wob, p.y - ch - 16, 6, 12, wob * 0.05, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#fff4d6'
        g.beginPath()
        g.ellipse(p.x + wob * 0.6, p.y - ch - 13, 3, 6, 0, 0, Math.PI * 2)
        g.fill()
      } else {
        // Smoke curling up, and the match coming if asked for.
        g.strokeStyle = 'rgba(200,200,200,0.4)'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(p.x, p.y - ch - 8)
        g.quadraticCurveTo(p.x + 10 * Math.sin(now * 2 + i), p.y - ch - 30, p.x - 4, p.y - ch - 50)
        g.stroke()
        if (c.relight) {
          g.fillStyle = '#ff922b'
          g.beginPath()
          g.arc(p.x + 14, p.y - ch - 14, 4, 0, Math.PI * 2)
          g.fill()
        } else {
          g.fillStyle = 'rgba(255,255,255,0.8)'
          g.font = 'bold 11px sans-serif'
          g.textAlign = 'center'
          g.fillText(t('touche'), p.x, p.y + 22)
          g.textAlign = 'left'
        }
      }
      // The wind's swirl over the one it's going for.
      if (c.warn) {
        g.strokeStyle = 'rgba(180,220,255,0.85)'
        g.lineWidth = 3
        g.beginPath()
        g.arc(p.x, p.y - ch - 16, 26 + Math.sin(now * 20) * 3, now * 8, now * 8 + Math.PI * 1.4)
        g.stroke()
      }
    }
    // The hand over the flame.
    if (st.hand.on) {
      g.fillStyle = 'rgba(141,90,59,0.85)'
      g.beginPath()
      g.ellipse(st.hand.x, st.hand.y, 30, 20, 0, 0, Math.PI * 2)
      g.fill()
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    st.hand = { x: e.x, y: e.y, on: e.kind !== 'up' }
    if (e.kind !== 'down' || st.over) return
    // Tapped on a candle that's out: the match.
    st.c.forEach((c, i) => {
      const p = at(i)
      if (!c.lit && !c.relight && Math.abs(e.x - p.x) < 34 && e.y > p.y - 110 && e.y < p.y + 40) {
        c.relight = st.now + 0.7
        beep(1200, 0.06, 0.06, { type: 'square' })
      }
    })
  }

  return (
    <div className="absolute inset-0 bg-[#15131f]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Les bougies pour Daniel')} left={hud.left} done={`${hud.lit}/${N}`} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Garde le doigt sur la bougie que le vent vise. Éteinte : touche-la pour la rallumer.')}</p>
    </div>
  )
}
