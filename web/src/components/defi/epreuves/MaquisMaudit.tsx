import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, fx, rnd, useHud, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « Le maquis maudit », chapter 4 (game/epreuves.go): Tantie Bintou's fresh fish, « garanti sans sort »,
// on the grill over the charcoal. Each fish goes from raw to golden to burnt: tap it when it's golden
// underneath to turn it over, tap it again when the other side's golden to serve it. Burnt, it goes in
// the bin (and the rumour of the curse comes back). Serve as many as you can.

const TIME = 50
const SLOTS = 4
type Fish = { side: 0 | 1; cook: number; speed: number; burnt: boolean; served: number } | null

const GOLD = [0.62, 0.86] // the golden window of a side

export default function MaquisMaudit({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ fish: Array<Fish>(SLOTS).fill(null), next: 0.3, served: 0, burnt: 0, over: false, w: 0, h: 0, now: 0, smoke: [] as { x: number; y: number; a: number; v: number }[] })
  const [hud, setHud] = useHud({ left: TIME, served: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const slotXY = (i: number) => {
    const { w, h } = s.current
    const cols = 2
    return { x: w * (0.28 + (i % cols) * 0.44), y: h * (0.4 + Math.floor(i / cols) * 0.22) }
  }

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    st.now = now
    const left = TIME - now
    if (!st.over && left <= 0) {
      st.over = true
      const score = Math.round(Math.max(0, Math.min(100, st.served * 9 - st.burnt * 6)))
      if (score >= 80) fx.win(w)
      setFlash({ text: score >= 80 ? t('Le maquis est plein !') : t('Les clients attendent encore…'), at: now })
      setTimeout(() => onEnd(score), 900)
    }
    // A new fresh fish on a free spot of the grill.
    if (!st.over && now >= st.next) {
      const free = st.fish.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0)
      if (free.length) st.fish[free[Math.floor(Math.random() * free.length)]] = { side: 0, cook: 0, speed: rnd(0.11, 0.16) + now * 0.0015, burnt: false, served: 0 }
      st.next = now + rnd(1.5, 2.6)
    }
    for (const [i, f] of st.fish.entries()) {
      if (!f || f.served) continue
      f.cook += f.speed * dt
      if (f.cook > 1.1 && !f.burnt) {
        f.burnt = true
        st.burnt++
        const p = slotXY(i)
        fx.bad(p.x, p.y, t('Brûlé !'))
        beep(150, 0.35, 0.1, { type: 'sawtooth' })
      }
      if (f.burnt && f.cook > 1.5) st.fish[i] = null
      if (Math.random() < 0.15) {
        const p = slotXY(i)
        st.smoke.push({ x: p.x + rnd(-20, 20), y: p.y, a: f.burnt ? 0.6 : 0.3, v: rnd(20, 40) })
      }
    }
    setHud({ left: Math.max(0, left), served: st.served })
    // The maquis at night, the grill, the glowing charcoal.
    g.fillStyle = '#2b1a12'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#4a2e20'
    g.fillRect(0, h * 0.22, w, h * 0.68)
    g.fillStyle = '#1a1a1a'
    g.fillRect(w * 0.06, h * 0.26, w * 0.88, h * 0.56)
    for (let i = 0; i < 60; i++) {
      const x = w * 0.08 + ((i * 53) % (w * 0.84))
      const y = h * 0.28 + ((i * 97) % (h * 0.52))
      const glow = 0.5 + 0.5 * Math.sin(now * 3 + i)
      g.fillStyle = `rgba(255,${Math.round(90 + glow * 80)},40,${0.35 + glow * 0.4})`
      g.beginPath()
      g.arc(x, y, 5 + (i % 3), 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = '#adb5bd'
    g.lineWidth = 3
    for (let x = w * 0.08; x < w * 0.92; x += 14) {
      g.beginPath()
      g.moveTo(x, h * 0.27)
      g.lineTo(x, h * 0.81)
      g.stroke()
    }
    // The fish.
    for (const [i, f] of st.fish.entries()) {
      if (!f) continue
      const p = slotXY(i)
      const c = Math.min(1.2, f.cook)
      // Raw grey, to golden brown, to black.
      const col = f.burnt ? '#1a1a1a' : c < GOLD[0] ? mix('#b8c4cc', '#d9a35c', c / GOLD[0]) : c < GOLD[1] ? '#d9902f' : mix('#d9902f', '#3b2416', (c - GOLD[1]) / 0.3)
      g.save()
      g.translate(p.x, p.y - (f.served ? (now - f.served) * 200 : 0))
      g.globalAlpha = f.served ? Math.max(0, 1 - (now - f.served) * 3) : 1
      g.fillStyle = col
      g.beginPath()
      g.ellipse(0, 0, 46, 20, 0, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(40, 0)
      g.lineTo(66, -18)
      g.lineTo(66, 18)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.35)'
      g.lineWidth = 3
      for (const x of [-20, -4, 12]) {
        g.beginPath()
        g.moveTo(x, -16)
        g.lineTo(x + 6, 16)
        g.stroke()
      }
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(-30, -4, 5, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#111'
      g.beginPath()
      g.arc(-30, -4, 2.5, 0, Math.PI * 2)
      g.fill()
      // Golden: the ring says « now ».
      if (!f.burnt && !f.served && c >= GOLD[0] && c < GOLD[1]) {
        g.strokeStyle = '#ffd43b'
        g.lineWidth = 4
        g.beginPath()
        g.ellipse(6, 0, 66, 32, 0, 0, Math.PI * 2)
        g.stroke()
      }
      g.fillStyle = '#fff'
      g.font = 'bold 11px sans-serif'
      g.textAlign = 'center'
      if (!f.burnt && !f.served) g.fillText(f.side === 0 ? t('face 1') : t('face 2'), 6, 36)
      g.textAlign = 'left'
      g.restore()
    }
    st.smoke = st.smoke.filter((m) => (m.a -= dt * 0.4) > 0)
    for (const m of st.smoke) {
      m.y -= m.v * dt
      g.fillStyle = `rgba(200,200,200,${m.a})`
      g.beginPath()
      g.arc(m.x, m.y, 8, 0, Math.PI * 2)
      g.fill()
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    for (const [i, f] of st.fish.entries()) {
      if (!f || f.burnt || f.served) continue
      const p = slotXY(i)
      if (Math.abs(e.x - p.x) > 70 || Math.abs(e.y - p.y) > 40) continue
      const golden = f.cook >= GOLD[0] && f.cook < GOLD[1]
      if (!golden) {
        // Too soon: raw still. A little nudge, nothing else.
        fx.float(f.cook < GOLD[0] ? t('Pas encore…') : t('Trop tard !'), p.x, p.y - 30, '#ffa8a8')
        beep(220, 0.08, 0.06, { type: 'square' })
        return
      }
      if (f.side === 0) {
        f.side = 1
        f.cook = 0.15
        beep(400, 0.1, 0.1, { type: 'triangle' })
        fx.burst(p.x, p.y, ['#ffa94d', '#ffd43b'], 8, 120)
      } else {
        f.served = st.now
        st.served++
        beep(700, 0.1, 0.12)
        beep(940, 0.15, 0.12)
        fx.good(p.x, p.y, t('Servi !'))
        setTimeout(() => {
          if (st.fish[i] === f) st.fish[i] = null
        }, 400)
      }
      return
    }
  }

  return (
    <div className="absolute inset-0 bg-[#2b1a12]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Le braisé de Tantie')} left={hud.left} done={t('{n} servis', { n: hud.served })} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Quand le poisson est doré (cercle jaune) : touche pour retourner, puis pour servir.')}</p>
    </div>
  )
}

function mix(a: string, b: string, k: number) {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  const kk = Math.max(0, Math.min(1, k))
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * kk)).join(',')})`
}
