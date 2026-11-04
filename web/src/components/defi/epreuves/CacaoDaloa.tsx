import { useRef, useState } from 'react'
import { Canvas, Hud, beep, fx, rnd, type Frame } from './kit'
import { t } from '../../../lib/i18n'

// « Le cacao de Daloa », chapter 2 (game/epreuves.go): at the maquis, the planters show what the pisteur
// weighed. The sack on the scale, the needle swinging, settling; and what the pisteur wrote in his book.
// Read the needle yourself: « Juste » if he wrote what it says, « Truqué ! » if he wrote less. Ten sacks,
// a few seconds each.

const ROUNDS = 10
const MAX = 100 // kg on the dial

export default function CacaoDaloa({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ k: 0, real: 0, said: 0, rigged: false, start: 0, needle: 0, v: 0, good: 0, over: false, now: 0, w: 0, h: 0, locked: false })
  const [view, setView] = useState({ k: 0, said: 0, good: 0, show: false })

  const newSack = (now: number) => {
    const st = s.current
    st.real = Math.round(rnd(52, 92))
    st.rigged = Math.random() < 0.5
    st.said = st.rigged ? st.real - Math.round(rnd(4, 12)) : st.real
    st.start = now
    st.needle = 0
    st.v = 0
    st.locked = false
    setView({ k: st.k, said: st.said, good: st.good, show: false })
  }

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.now = now
    st.w = w
    st.h = h
    if (st.start === 0 && st.k === 0) newSack(now + 0.001)
    // The needle: a spring towards the weight, swinging then settling.
    const target = now - st.start > 0.3 ? st.real : 0
    st.v += (target - st.needle) * 30 * dt
    st.v *= Math.pow(0.04, dt)
    st.needle += st.v * dt
    if (!view.show && now - st.start > 1.2) setView((v) => ({ ...v, show: true }))
    // The maquis table, the hanging scale.
    g.fillStyle = '#3b2a1a'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#5c3a21'
    g.fillRect(0, h * 0.7, w, h * 0.3)
    const cx = w / 2
    const cy = h * 0.3
    const r = Math.min(w * 0.34, h * 0.19)
    g.fillStyle = '#e9ecef'
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#495057'
    g.lineWidth = 6
    g.stroke()
    // The dial: a mark every kilo, a long one every five, the number every ten.
    for (let kg = 0; kg <= MAX; kg++) {
      const a = Math.PI * 0.75 + (kg / MAX) * Math.PI * 1.5
      const long = kg % 10 === 0 ? 0.16 : kg % 5 === 0 ? 0.11 : 0.06
      g.strokeStyle = '#212529'
      g.lineWidth = kg % 5 === 0 ? 2 : 1
      g.beginPath()
      g.moveTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92)
      g.lineTo(cx + Math.cos(a) * r * (0.92 - long), cy + Math.sin(a) * r * (0.92 - long))
      g.stroke()
      if (kg % 10 === 0) {
        g.fillStyle = '#212529'
        g.font = `bold ${Math.round(r * 0.12)}px sans-serif`
        g.textAlign = 'center'
        g.fillText(String(kg), cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62 + r * 0.04)
      }
    }
    g.textAlign = 'left'
    const a = Math.PI * 0.75 + (Math.max(0, Math.min(MAX, st.needle)) / MAX) * Math.PI * 1.5
    g.strokeStyle = '#e03131'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86)
    g.stroke()
    g.fillStyle = '#212529'
    g.beginPath()
    g.arc(cx, cy, 7, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#495057'
    g.font = `bold ${Math.round(r * 0.11)}px sans-serif`
    g.textAlign = 'center'
    g.fillText('kg', cx, cy + r * 0.4)
    g.textAlign = 'left'
    // The hook, the cacao sack.
    g.strokeStyle = '#868e96'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(cx, cy + r)
    g.lineTo(cx, cy + r + 24)
    g.stroke()
    g.fillStyle = '#a47148'
    g.beginPath()
    g.ellipse(cx, cy + r + 24 + 46 + Math.sin(now * 3) * 2, 44, 50, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#5c3a21'
    g.font = 'bold 12px sans-serif'
    g.textAlign = 'center'
    g.fillText('CACAO', cx, cy + r + 76)
    g.textAlign = 'left'
  }

  const answer = (rigged: boolean, e: React.MouseEvent) => {
    const st = s.current
    if (st.locked || st.over || !view.show) return
    st.locked = true
    const spot = fx.local(e)
    const ok = rigged === st.rigged
    if (ok) {
      st.good++
      // Quick and right: a little more.
      beep(700, 0.1, 0.12)
      fx.good(spot.x, spot.y - 40, st.rigged ? t('Démasqué !') : t('Juste'))
    } else {
      beep(170, 0.25, 0.12, { type: 'square' })
      fx.bad(spot.x, spot.y - 40, t('C’était {n} kg', { n: st.real }))
    }
    st.k++
    setView((v) => ({ ...v, good: st.good }))
    setTimeout(() => {
      if (st.k >= ROUNDS) {
        st.over = true
        const score = Math.round((st.good / ROUNDS) * 100)
        if (score >= 80) fx.win(st.w)
        onEnd(score)
      } else newSack(st.now)
    }, 900)
  }

  return (
    <div className="absolute inset-0 bg-[#3b2a1a] select-none">
      <Canvas frame={frame} />
      <Hud title={t('Juste ou truqué')} done={`${Math.min(view.k + 1, ROUNDS)}/${ROUNDS} · ${view.good} ✓`} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className={`rounded-2xl bg-[#fff8e6] px-4 py-2 text-center text-sm font-extrabold text-[#3d2b1f] shadow transition ${view.show ? 'opacity-100' : 'opacity-0'}`}>{t('Le carnet du pisteur : « {n} kg »', { n: view.said })}</div>
        <div className="flex w-full max-w-[380px] gap-3">
          <button onClick={(e) => answer(false, e)} className="h-16 flex-1 rounded-[22px] bg-[#2f9e44] font-display text-lg font-extrabold text-white shadow-[0_5px_0_#1b5e2b] active:translate-y-1">
            {t('Juste')}
          </button>
          <button onClick={(e) => answer(true, e)} className="h-16 flex-1 rounded-[22px] bg-[#e03131] font-display text-lg font-extrabold text-white shadow-[0_5px_0_#8f1d1d] active:translate-y-1">
            {t('Truqué !')}
          </button>
        </div>
      </div>
    </div>
  )
}
