import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, clamp, useHud, type Frame, type Touch, fx } from './kit'
import { t } from '../../../lib/i18n'
import { useJeuMe } from '../jeux/me'

// « Le marathon de Pépé Yao », chapter 1 (game/epreuves.go): round the stadium's track with Pépé Yao,
// 72 years old and steady as a clock. Run in his rhythm: left foot, right foot (the two halves of the
// screen), each stride on his beat (the drum, the flash). On the beat, you keep up or gain; off it, you
// lose ground; the same foot twice, you stumble. And mind the breath: tapping faster than the beat burns
// it. Two laps: finish level with him, or ahead.

const TIME = 40
const LAPS = 2
// His beat: seconds between strides, a little quicker on the second lap.
const beatAt = (lap: number) => (lap < 1 ? 0.5 : 0.44)
const PEPE = 1 / TIME // laps a second… times LAPS below
const WINDOW = 0.13 // seconds either side of the beat that count

export default function MarathonYao({ onEnd }: { onEnd: (score: number) => void }) {
  // Your runner wears your colours.
  const me = useJeuMe()
  const s = useRef({ me: 0, pepe: 0, speed: 0.9, last: '' as '' | 'g' | 'd', lastAt: -1, nextBeat: 0.8, breath: 100, over: false, now: 0, w: 0, hits: 0, misses: 0, glow: 0 })
  const [hud, setHud] = useHud({ left: TIME, gap: 0, breath: 100 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.now = now
    st.w = w
    const left = TIME - now
    // Pépé: the whole race in TIME, steady.
    if (!st.over) {
      st.pepe = Math.min(LAPS, st.pepe + PEPE * LAPS * dt)
      st.me = Math.min(LAPS, st.me + PEPE * LAPS * st.speed * dt)
      // Without strides the legs slow down; the breath comes back slowly.
      st.speed = Math.max(0.55, st.speed - dt * 0.12)
      st.breath = Math.min(100, st.breath + dt * 6)
    }
    if (now >= st.nextBeat) {
      st.glow = 1
      if (!st.over) beep(140, 0.06, 0.08, { type: 'square' })
      st.nextBeat += beatAt(Math.floor(st.pepe))
    }
    st.glow = Math.max(0, st.glow - dt * 5)
    if (!st.over && (left <= 0 || st.me >= LAPS || st.pepe >= LAPS)) {
      st.over = true
      const gap = st.me - st.pepe
      const won = gap >= -0.02
      setFlash({ text: won ? t('Coude à coude avec Pépé !') : t('Pépé t’a laissé sur place !'), at: now })
      if (won) fx.win(w)
      setTimeout(() => onEnd(Math.round(clamp(70 + gap * 300 + (st.hits / Math.max(1, st.hits + st.misses)) * 20, 5, 100))), 1100)
    }
    setHud({ left: Math.max(0, left), gap: st.me - st.pepe, breath: st.breath })
    // The track from above: the oval, the lanes, the two runners.
    g.fillStyle = '#2f9e44'
    g.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h * 0.47
    const rx = w * 0.4
    const ry = h * 0.3
    g.strokeStyle = '#c2410c'
    g.lineWidth = 46
    g.beginPath()
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.7)'
    g.lineWidth = 2
    for (const d of [-22, 0, 22]) {
      g.beginPath()
      g.ellipse(cx, cy, rx + d, ry + d, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // The finish line.
    g.fillStyle = '#fff'
    g.fillRect(cx - 3, cy + ry - 24, 6, 48)
    const at = (lap: number, lane: number) => {
      const a = Math.PI / 2 + (lap % 1) * Math.PI * 2
      return [cx + Math.cos(a) * (rx + lane), cy + Math.sin(a) * (ry + lane)] as const
    }
    const runner = (lap: number, lane: number, shirt: string, head: string) => {
      const [x, y] = at(lap, lane)
      g.fillStyle = shirt
      g.beginPath()
      g.arc(x, y, 9, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = head
      g.beginPath()
      g.arc(x, y, 5, 0, Math.PI * 2)
      g.fill()
    }
    runner(st.pepe, 11, '#f8f9fa', '#d9d9d9')
    runner(st.me, -11, me?.look.outfitColor ?? '#1c7ed6', me?.look.skin ?? '#5b3a29')
    // The beat: the drum in the middle lights up.
    g.fillStyle = `rgba(255,212,59,${0.3 + st.glow * 0.7})`
    g.beginPath()
    g.arc(cx, cy, 22 + st.glow * 10, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff'
    g.font = 'bold 13px sans-serif'
    g.textAlign = 'center'
    g.fillText(t('Tour {n}/{all}', { n: Math.min(LAPS, Math.floor(st.me) + 1), all: LAPS }), cx, cy + 5)
    g.textAlign = 'left'
    // The two feet: halves of the screen.
    for (const [side, x] of [
      ['g', 0],
      ['d', w / 2],
    ] as const) {
      g.fillStyle = st.last === side && now - st.lastAt < 0.15 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'
      g.fillRect(x + 8, h - 96, w / 2 - 16, 80)
      g.fillStyle = '#fff'
      g.font = 'bold 15px sans-serif'
      g.textAlign = 'center'
      g.fillText(side === 'g' ? t('Pied gauche') : t('Pied droit'), x + w / 4, h - 50)
      g.textAlign = 'left'
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    const c = st.now
    const foot = e.x < st.w / 2 ? 'g' : 'd'
    // How far from his beat: the last one or the next.
    const beat = beatAt(Math.floor(st.pepe))
    const off = Math.min(Math.abs(c - (st.nextBeat - beat)), Math.abs(st.nextBeat - c))
    if (foot === st.last) {
      st.speed = Math.max(0.5, st.speed - 0.25)
      st.misses++
      beep(120, 0.2, 0.1, { type: 'sawtooth' })
      setFlash({ text: t('Même pied : tu trébuches !'), at: c })
      fx.bad(e.x, e.y)
    } else if (off <= WINDOW && st.breath > 8) {
      st.speed = Math.min(1.35, st.speed + 0.09)
      st.hits++
      st.breath -= 2
      beep(foot === 'g' ? 520 : 620, 0.05, 0.08)
      fx.burst(e.x, e.y, ['#ffd43b', '#ffffff'], 6, 110)
    } else {
      st.speed = Math.max(0.5, st.speed - 0.08)
      st.misses++
      st.breath -= 7
      fx.shake(3)
      if (st.breath < 20) setFlash({ text: t('Doucement, garde ton souffle'), at: c })
    }
    st.last = foot
    st.lastAt = c
  }

  return (
    <div className="absolute inset-0 bg-[#2f9e44]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Pépé Yao')} left={hud.left} done={hud.gap >= 0 ? t('Devant !') : t('−{m} m', { m: Math.round(-hud.gap * 400) })}>
        <div className="h-3 w-14 overflow-hidden rounded-full bg-black/45">
          <div className={`h-full ${hud.breath < 30 ? 'bg-[#e03131]' : 'bg-[#69db7c]'}`} style={{ width: `${Math.round(hud.breath)}%` }} />
        </div>
      </Hud>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}
