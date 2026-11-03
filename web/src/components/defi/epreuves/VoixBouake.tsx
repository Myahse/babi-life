import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, rnd, useHud, type Frame, type Touch, fx, drawPerson } from './kit'
import { t } from '../../../lib/i18n'

// « La voix de Bouaké », chapter 3 (game/epreuves.go): the concert in the rue d'ambiance, the crowd at
// night under the garlands, and somewhere in it the singer the whole of Bouaké talks about, humming. The
// finger is the ear: the closer to her, the louder her song (and from her side: left or right), and the
// ear's gauge fills. Tap the one who sings. Three times (she slips off elsewhere in the crowd); a wrong
// one costs a few seconds.

const TIME = 50
const ROUNDS = 3
const PENALTY = 4
const PEOPLE = 34
// Her song, the notes of a pentatonic tune (Hz), one every BEAT.
const TUNE = [392, 440, 523, 587, 523, 440, 392, 330, 392, 440, 392, 330, 294, 330, 392, 0]
const BEAT = 0.26

type Body = { x: number; y: number; c: string; head: string; sway: number; size: number }

const CLOTH = ['#e8590c', '#1c7ed6', '#2f9e44', '#f08c00', '#ae3ec9', '#e03131', '#fab005', '#0ca678', '#fff']

export default function VoixBouake({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ crowd: [] as Body[], who: 0, round: 0, found: 0, lost: 0, ear: { x: -1, y: -1 }, next: 0, note: 0, over: false, misses: [] as { x: number; y: number; at: number }[], seen: -1, w: 0, h: 0 })
  const [hud, setHud] = useHud({ left: TIME, found: 0, near: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const place = (w: number, h: number) => {
    const st = s.current
    st.crowd = []
    for (let i = 0; i < PEOPLE; i++) {
      // Rows going back: smaller, higher.
      const depth = Math.random()
      st.crowd.push({ x: rnd(0.06, 0.94) * w, y: h * (0.42 + depth * 0.45), c: CLOTH[i % CLOTH.length], head: Math.random() < 0.4 ? CLOTH[(i * 3) % CLOTH.length] : '', sway: rnd(0, 6), size: 0.6 + depth * 0.6 })
    }
    st.crowd.sort((a, b) => a.y - b.y)
    st.who = Math.floor(Math.random() * PEOPLE)
  }

  const frame = ({ g, w, h, t: now }: Frame) => {
    const st = s.current
    if (st.w !== w || st.h !== h) {
      st.w = w
      st.h = h
      place(w, h)
    }
    const left = TIME - now - st.lost
    if (!st.over && (left <= 0 || st.found >= ROUNDS)) {
      st.over = true
      setTimeout(() => onEnd(Math.round((st.found / ROUNDS) * 80 + (st.found >= ROUNDS ? Math.max(0, left / TIME) * 20 : 0))), 1000)
    }
    const her = st.crowd[st.who]
    const ear = st.ear.x < 0 ? { x: w / 2, y: h * 0.3 } : st.ear
    const d = Math.hypot(ear.x - her.x, ear.y - her.y)
    const near = Math.max(0, 1 - d / (Math.max(w, h) * 0.6))
    // Her song, louder the nearer, from her side.
    if (!st.over && now >= st.next) {
      const f = TUNE[st.note % TUNE.length]
      if (f) beep(f, BEAT * 0.9, 0.01 + 0.22 * near * near, { type: 'triangle', pan: ((her.x - ear.x) / w) * 2 })
      // The crowd's noise under it, the drum on every other beat.
      if (st.note % 2 === 0) beep(90, 0.08, 0.05, { type: 'square' })
      st.note++
      st.next = now + BEAT
    }
    setHud({ left: Math.max(0, left), found: st.found, near })
    // The street at night: the garlands, the speakers, the crowd.
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#141033')
    sky.addColorStop(1, '#3a1f4d')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#20183a'
    g.fillRect(0, h * 0.18, w * 0.25, h * 0.3)
    g.fillRect(w * 0.75, h * 0.14, w * 0.25, h * 0.34)
    for (let i = 0; i < 24; i++) {
      const x = (i / 23) * w
      const y = h * 0.3 + Math.sin((i / 23) * Math.PI) * 30
      g.fillStyle = ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc'][i % 4]
      g.globalAlpha = 0.6 + 0.4 * Math.sin(now * 3 + i)
      g.beginPath()
      g.arc(x, y, 4, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    g.fillStyle = '#2b2b2b'
    g.fillRect(8, h * 0.38, 26, 46)
    g.fillRect(w - 34, h * 0.38, 26, 46)
    for (const [i, b] of st.crowd.entries()) {
      const bob = Math.sin(now * 4 + b.sway) * 3 * b.size
      const z = 16 * b.size
      // The crowd dances: arms up on the drum now and then.
      drawPerson(g, b.x, b.y - z * 0.2, { shirt: b.c, cap: b.head || undefined, skin: ['#6b4430', '#8d5a3b', '#4a2e20', '#a06a45'][i % 4], bob, size: b.size * 1.12, dir: i % 2 ? 1 : -1, arms: Math.sin(now * 3 + b.sway) > 0.55 ? 'up' : 'down' })
      // Found: her, singing in the light a moment.
      if (i === st.seen) {
        g.fillStyle = 'rgba(255,230,120,0.35)'
        g.beginPath()
        g.arc(b.x, b.y - z, z * 2.4, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#fff'
        g.font = `bold ${Math.round(z)}px sans-serif`
        g.fillText('♪', b.x + z, b.y - z * 2.4 - Math.sin(now * 5) * 4)
      }
    }
    // The ear.
    g.strokeStyle = `rgba(255,212,59,${0.4 + near * 0.6})`
    g.lineWidth = 3
    g.beginPath()
    g.arc(ear.x, ear.y, 26 + near * 10, 0, Math.PI * 2)
    g.stroke()
    st.misses = st.misses.filter((m) => now - m.at < 0.8)
    for (const m of st.misses) {
      g.strokeStyle = '#e03131'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(m.x - 10, m.y - 10)
      g.lineTo(m.x + 10, m.y + 10)
      g.moveTo(m.x + 10, m.y - 10)
      g.lineTo(m.x - 10, m.y + 10)
      g.stroke()
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    st.ear = { x: e.x, y: e.y }
    if (e.kind !== 'up' || st.over) return
    // Lifted on someone: that's the pick. The nearest body under the finger.
    let pick = -1
    let bd = Infinity
    st.crowd.forEach((b, i) => {
      const z = 16 * b.size
      const dd = Math.hypot(e.x - b.x, e.y - (b.y - z))
      if (dd < z * 1.6 && dd < bd) ((bd = dd), (pick = i))
    })
    if (pick < 0) return
    const now = performance.now() / 1000
    if (pick === st.who) {
      st.found++
      st.seen = pick
      beep(523, 0.15, 0.15)
      beep(659, 0.15, 0.15)
      beep(784, 0.3, 0.15)
      setFlash({ text: t('C’est elle !'), at: performance.now() })
      fx.good(e.x, e.y, '♪ ♪')
      if (st.found >= ROUNDS) fx.win()
      setTimeout(() => {
        st.seen = -1
        if (st.found < ROUNDS) {
          let n = st.who
          while (n === st.who) n = Math.floor(Math.random() * PEOPLE)
          st.who = n
        }
      }, 1100)
    } else {
      st.lost += PENALTY
      st.misses.push({ x: e.x, y: e.y, at: now })
      beep(160, 0.2, 0.12, { type: 'square' })
      fx.bad(e.x, e.y, `−${PENALTY} s`)
    }
  }

  return (
    <div className="absolute inset-0 bg-[#141033]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('La voix de Bouaké')} left={hud.left} done={`${hud.found}/${ROUNDS}`}>
        <div className="h-3 w-16 overflow-hidden rounded-full bg-black/45">
          <div className="h-full bg-[#ffd43b]" style={{ width: `${Math.round(hud.near * 100)}%` }} />
        </div>
      </Hud>
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Monte le son. Promène le doigt : plus tu es près, plus elle chante fort. Lâche sur elle.')}</p>
    </div>
  )
}
