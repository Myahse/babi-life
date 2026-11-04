import { useRef } from 'react'
import { Canvas, Hud, beep, fx, useHud, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « Le mariage attaché », chapter 4 (game/epreuves.go): the party at the maquis, the pagne brought back
// from Man, tante Akoua in tears, and the DJ putting on the coupé-décalé. The dance steps come up the
// four lanes (left, down, up, right): tap the lane's pad as the step reaches the line. « Parfait », « Bien »,
// or missed; the combo keeps the crowd going.

const TIME = 42
const BPM = 112
const LANES = 4
const RISE = 1.6 // seconds a step takes to come up
const ARROWS = ['◀', '▼', '▲', '▶']
const COLORS = ['#e03131', '#1c7ed6', '#2f9e44', '#fab005']

type Step = { lane: number; at: number; hit: '' | 'parfait' | 'bien' | 'rate' }

// The steps: on the beat, sometimes on the half-beat, now and then two at once.
function chart(): Step[] {
  const beat = 60 / BPM
  const out: Step[] = []
  for (let b = 4; b * beat < TIME - 2; b++) {
    const at = b * beat
    const dense = at > TIME * 0.5
    if (Math.random() < (dense ? 0.85 : 0.65)) out.push({ lane: Math.floor(Math.random() * LANES), at, hit: '' })
    if (dense && Math.random() < 0.3) out.push({ lane: Math.floor(Math.random() * LANES), at: at + beat / 2, hit: '' })
  }
  return out
}

export default function MariageAttache({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ steps: chart(), now: 0, beat: -1, combo: 0, best: 0, points: 0, over: false, w: 0, h: 0, judge: { text: '', at: -9, color: '#fff' }, pads: [0, 0, 0, 0] })
  const [hud, setHud] = useHud({ left: TIME, combo: 0 })

  const lineY = (h: number) => h * 0.2
  const padY = (h: number) => h - 90

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    st.now = now
    const left = TIME - now
    // The music: the kick on each beat, the bell on the off-beat.
    const b = Math.floor(now / (60 / BPM))
    if (b !== st.beat && !st.over) {
      st.beat = b
      beep(b % 2 ? 110 : 80, 0.1, 0.12, { type: 'sine', to: 40 })
      if (b % 4 === 2) beep(880, 0.05, 0.04, { type: 'square' })
    }
    // Missed: past the line.
    for (const sp of st.steps)
      if (!sp.hit && now - sp.at > 0.2) {
        sp.hit = 'rate'
        st.combo = 0
        st.judge = { text: t('Raté'), at: now, color: '#ff8787' }
      }
    if (!st.over && left <= 0) {
      st.over = true
      const max = st.steps.length * 2
      const score = Math.round(Math.min(100, (st.points / Math.max(1, max)) * 100 + Math.min(10, st.best / 3)))
      if (score >= 80) fx.win(w)
      setTimeout(() => onEnd(score), 900)
    }
    setHud({ left: Math.max(0, left), combo: st.combo })
    // The maquis at night, the garlands, the crowd's heads bobbing on the beat.
    g.fillStyle = '#1b1035'
    g.fillRect(0, 0, w, h)
    const pulse = 1 - (((now * BPM) / 60) % 1)
    for (let i = 0; i < 20; i++) {
      g.fillStyle = COLORS[i % 4]
      g.globalAlpha = 0.4 + pulse * 0.5
      g.beginPath()
      g.arc((i / 19) * w, 30 + Math.sin(i) * 10, 4, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    g.fillStyle = '#2b1a4d'
    for (let i = 0; i < 12; i++) {
      g.beginPath()
      g.arc((i / 11) * w, h - 20 - pulse * 4 * ((i % 2) + 1), 22, 0, Math.PI * 2)
      g.fill()
    }
    // The lanes, the line, the steps coming up.
    const lw = Math.min(80, (w - 40) / LANES)
    const x0 = (w - lw * LANES) / 2
    for (let l = 0; l < LANES; l++) {
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(x0 + l * lw + 4, 0, lw - 8, h)
      // The target at the line.
      g.strokeStyle = COLORS[l]
      g.lineWidth = 3
      g.globalAlpha = 0.5 + pulse * 0.3
      g.beginPath()
      g.arc(x0 + l * lw + lw / 2, lineY(h), lw * 0.36, 0, Math.PI * 2)
      g.stroke()
      g.globalAlpha = 1
    }
    for (const sp of st.steps) {
      if (sp.hit === 'parfait' || sp.hit === 'bien') continue
      const k = (sp.at - now) / RISE
      if (k > 1 || k < -0.15) continue
      const y = lineY(h) + k * (padY(h) - lineY(h))
      const x = x0 + sp.lane * lw + lw / 2
      g.globalAlpha = sp.hit === 'rate' ? 0.3 : 1
      g.fillStyle = COLORS[sp.lane]
      g.beginPath()
      g.arc(x, y, lw * 0.33, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#fff'
      g.font = `bold ${Math.round(lw * 0.36)}px sans-serif`
      g.textAlign = 'center'
      g.fillText(ARROWS[sp.lane], x, y + lw * 0.13)
      g.textAlign = 'left'
      g.globalAlpha = 1
    }
    // The pads at the bottom.
    for (let l = 0; l < LANES; l++) {
      st.pads[l] = Math.max(0, st.pads[l] - dt * 6)
      const x = x0 + l * lw + 4
      g.fillStyle = COLORS[l]
      g.globalAlpha = 0.55 + st.pads[l] * 0.45
      g.fillRect(x, padY(h) - 30, lw - 8, 70)
      g.globalAlpha = 1
      g.fillStyle = '#fff'
      g.font = `bold ${Math.round(lw * 0.4)}px sans-serif`
      g.textAlign = 'center'
      g.fillText(ARROWS[l], x + (lw - 8) / 2, padY(h) + 14)
      g.textAlign = 'left'
    }
    // The judgment.
    const j = st.judge
    if (now - j.at < 0.5) {
      g.globalAlpha = 1 - (now - j.at) / 0.5
      g.fillStyle = j.color
      g.font = '900 30px sans-serif'
      g.textAlign = 'center'
      g.fillText(j.text, w / 2, lineY(h) + 70)
      if (st.combo >= 5) {
        g.font = '900 18px sans-serif'
        g.fillText(t('Combo {n} !', { n: st.combo }), w / 2, lineY(h) + 96)
      }
      g.textAlign = 'left'
      g.globalAlpha = 1
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    const lw = Math.min(80, (st.w - 40) / LANES)
    const x0 = (st.w - lw * LANES) / 2
    const l = Math.floor((e.x - x0) / lw)
    if (l < 0 || l >= LANES) return
    st.pads[l] = 1
    // The nearest step of the lane, still to hit.
    let best: Step | null = null
    for (const sp of st.steps) if (!sp.hit && sp.lane === l && (!best || Math.abs(sp.at - st.now) < Math.abs(best.at - st.now))) best = sp
    const off = best ? Math.abs(best.at - st.now) : 9
    const x = x0 + l * lw + lw / 2
    if (best && off < 0.07) {
      best.hit = 'parfait'
      st.points += 2
      st.combo++
      st.judge = { text: t('Parfait !'), at: st.now, color: '#ffe066' }
      fx.burst(x, lineY(st.h), [COLORS[l], '#fff'], 12, 180)
    } else if (best && off < 0.16) {
      best.hit = 'bien'
      st.points += 1
      st.combo++
      st.judge = { text: t('Bien'), at: st.now, color: '#69db7c' }
      fx.burst(x, lineY(st.h), [COLORS[l]], 6, 120)
    } else {
      st.combo = 0
      fx.shake(3)
    }
    st.best = Math.max(st.best, st.combo)
    if (st.combo > 0 && st.combo % 10 === 0) fx.float(t('Combo {n} !', { n: st.combo }), st.w / 2, st.h * 0.4, '#ffe066')
  }

  return (
    <div className="absolute inset-0 bg-[#1b1035]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('La danse de la fête')} left={hud.left} done={hud.combo >= 2 ? t('Combo {n}', { n: hud.combo }) : undefined} />
    </div>
  )
}
