import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, knock, useHud, type Frame, type Touch } from './kit'
import { t } from '../../../lib/i18n'

// « Le défi de la Dent de Man », chapter 3 (game/epreuves.go): Boris's bet, the last bit of the climb,
// the rock face up to the top. Tap the next hold (one row up, two at most, not too far to the side):
// the grey ones hold, the cracked brown ones crumble (a slip down, breath lost). The breath runs down as
// one climbs; the ledges give it back. And the wind: when it blows, keep the finger on the rock until it
// drops, or it pulls you off a few holds. The top before the time's out.

const TIME = 70
const TOP = 32 // rows to the summit
const COLS = 5
const LEDGE = 8 // a ledge every LEDGE rows
const REACH = COLS // columns to the side (all of them: a row always has a good hold in reach)

type Hold = { col: number; bad: boolean }

// The face's holds, row by row: two or three, a crumbly one now and then; a ledge all across every LEDGE.
function face(): Hold[][] {
  const rows: Hold[][] = [[{ col: 2, bad: false }]]
  for (let r = 1; r <= TOP; r++) {
    if (r % LEDGE === 0 || r === TOP) {
      rows.push([...Array(COLS).keys()].map((col) => ({ col, bad: false })))
      continue
    }
    const cols = [...Array(COLS).keys()].sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.45 ? 1 : 0))
    // At least one good one within reach of the row below's.
    rows.push(cols.map((col, i) => ({ col, bad: i > 0 && Math.random() < 0.4 })))
  }
  return rows
}

export default function DentDeMan({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ rows: face(), row: 0, col: 2, shown: 0, breath: 100, wind: { from: 9, until: 0 }, pressed: false, over: false, fall: 0, w: 0, h: 0 })
  const [hud, setHud] = useHud({ left: TIME, row: 0, breath: 100, wind: false })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const slip = (rows: number, why: string) => {
    const st = s.current
    // Back down, to the last good hold below (a ledge stops the fall).
    let r = st.row
    for (let i = 0; i < rows && r > 0 && r % LEDGE !== 0; i++) r--
    while (r > 0 && !st.rows[r].some((h) => !h.bad)) r--
    st.row = r
    const good = st.rows[r].filter((h) => !h.bad)
    st.col = good.reduce((a, h) => (Math.abs(h.col - st.col) < Math.abs(a - st.col) ? h.col : a), good[0].col)
    st.fall = 1
    knock(0.5, 0, 400)
    beep(300, 0.4, 0.1, { type: 'sawtooth', to: 120 })
    setFlash({ text: why, at: performance.now() })
  }

  const geom = (w: number, h: number) => ({ gap: h / 7, cw: w / COLS })

  const frame = ({ g, w, h, t: now, dt }: Frame) => {
    const st = s.current
    st.w = w
    st.h = h
    const left = TIME - now
    if (!st.over && (left <= 0 || st.row >= TOP)) {
      st.over = true
      if (st.row >= TOP) {
        beep(523, 0.2, 0.15)
        beep(659, 0.2, 0.15)
        beep(1047, 0.4, 0.15)
        setFlash({ text: t('Au sommet !'), at: performance.now() })
      }
      setTimeout(() => onEnd(Math.round((st.row / TOP) * 80 + (st.row >= TOP ? Math.max(0, left / TIME) * 20 : 0))), 1100)
    }
    if (!st.over) {
      // The breath: running down while hanging, back on a ledge.
      st.breath = st.row % LEDGE === 0 ? Math.min(100, st.breath + dt * 30) : st.breath - dt * 2.2
      if (st.breath <= 0) {
        st.breath = 40
        slip(LEDGE, t('À bout de souffle…'))
      }
      // The wind: a gust now and then; let go of the rock while it blows and it pulls you off.
      if (now >= st.wind.from && st.wind.until < st.wind.from) {
        st.wind.until = now + 1.8
        beep(200, 1.6, 0.05, { type: 'sawtooth', to: 140 })
      }
      const blowing = now >= st.wind.from && now < st.wind.until
      if (blowing && !st.pressed && now > st.wind.from + 0.6) {
        st.wind = { from: now + 7 + Math.random() * 5, until: 0 }
        slip(3, t('Le vent t’a décroché !'))
      } else if (st.wind.until && now >= st.wind.until) st.wind = { from: now + 7 + Math.random() * 5, until: 0 }
      setHud({ left: Math.max(0, left), row: st.row, breath: st.breath, wind: blowing })
    }
    // The view follows the climber up.
    st.shown += (st.row - st.shown) * Math.min(1, dt * 6)
    st.fall = Math.max(0, st.fall - dt * 2)
    const { gap, cw } = geom(w, h)
    const yOf = (r: number) => h * 0.72 - (r - st.shown) * gap
    // The sky, the valley far below, the rock.
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#9fd3ff')
    sky.addColorStop(1, '#e6f4ff')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#6f7d6a'
    g.beginPath()
    g.moveTo(w * 0.04, h)
    for (let y = h; y > -10; y -= 20) g.lineTo(w * 0.04 + Math.sin((y + st.shown * gap) * 0.03) * 10, y)
    g.lineTo(w * 0.96 + Math.sin(st.shown) * 4, -10)
    for (let y = -10; y < h; y += 20) g.lineTo(w * 0.96 + Math.sin((y + st.shown * gap) * 0.02) * 12, y)
    g.closePath()
    g.fill()
    // The green on the rock, in patches.
    g.fillStyle = 'rgba(80,140,60,0.35)'
    for (let i = 0; i < 14; i++) {
      const yy = ((((i * 137 + st.shown * gap) % (h + 80)) + h + 80) % (h + 80)) - 40
      g.beginPath()
      g.ellipse(((i * 61) % (w * 0.8)) + w * 0.1, yy, 30, 12, 0, 0, Math.PI * 2)
      g.fill()
    }
    // The holds.
    for (let r = Math.max(0, Math.floor(st.shown) - 3); r <= Math.min(TOP, Math.ceil(st.shown) + 6); r++) {
      const y = yOf(r)
      if (r % LEDGE === 0 || r === TOP) {
        g.fillStyle = r === TOP ? '#c9b48a' : '#8d8a7c'
        g.fillRect(w * 0.06, y - 6, w * 0.88, 12)
        if (r === TOP) {
          g.fillStyle = '#e03131'
          g.fillRect(w / 2 - 2, y - 46, 4, 40)
          g.fillRect(w / 2 + 2, y - 46, 22, 14)
        }
        continue
      }
      for (const hd of st.rows[r]) {
        const x = (hd.col + 0.5) * cw
        g.fillStyle = hd.bad ? '#9c6b3e' : '#a9aeb5'
        g.beginPath()
        g.ellipse(x, y, 16, 10, 0, 0, Math.PI * 2)
        g.fill()
        if (hd.bad) {
          g.strokeStyle = '#4a2f1a'
          g.lineWidth = 2
          g.beginPath()
          g.moveTo(x - 8, y - 6)
          g.lineTo(x, y + 2)
          g.lineTo(x + 6, y - 4)
          g.stroke()
        }
        // Within reach: a ring.
        if (!st.over && r > st.row && r <= st.row + 2) {
          g.strokeStyle = 'rgba(255,255,255,0.8)'
          g.lineWidth = 2
          g.beginPath()
          g.ellipse(x, y, 21, 14, 0, 0, Math.PI * 2)
          g.stroke()
        }
      }
    }
    // Boris, hanging on, a shake when he slips.
    const bx = (st.col + 0.5) * cw + Math.sin(now * 40) * 6 * st.fall
    const by = yOf(st.shown) + 22
    g.fillStyle = '#1c7ed6'
    g.fillRect(bx - 10, by - 10, 20, 28)
    g.fillStyle = '#5b3a29'
    g.beginPath()
    g.arc(bx, by - 18, 9, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#5b3a29'
    g.lineWidth = 5
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(bx - 9, by - 6)
    g.lineTo(bx - 14, by - 26)
    g.moveTo(bx + 9, by - 6)
    g.lineTo(bx + 14, by - 26)
    g.moveTo(bx - 5, by + 18)
    g.lineTo(bx - 8, by + 34)
    g.moveTo(bx + 5, by + 18)
    g.lineTo(bx + 8, by + 34)
    g.stroke()
    // The wind: lines across.
    if (now >= st.wind.from && now < st.wind.until) {
      g.strokeStyle = 'rgba(255,255,255,0.7)'
      g.lineWidth = 2
      for (let i = 0; i < 8; i++) {
        const y = (i / 8) * h + Math.sin(now * 3 + i) * 10
        const x = ((now * 600 + i * 170) % (w + 200)) - 100
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + 80, y)
        g.stroke()
      }
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    st.pressed = e.kind !== 'up'
    if (e.kind !== 'down' || st.over) return
    const { w, h } = st
    const { gap, cw } = geom(w, h)
    // The hold tapped: within reach only.
    for (let r = st.row + 1; r <= Math.min(TOP, st.row + 2); r++) {
      const y = h * 0.72 - (r - st.shown) * gap
      const holds = r % LEDGE === 0 || r === TOP ? [...Array(COLS).keys()].map((col) => ({ col, bad: false })) : st.rows[r]
      for (const hd of holds) {
        const x = (hd.col + 0.5) * cw
        if (Math.abs(e.x - x) < cw * 0.45 && Math.abs(e.y - y) < gap * 0.45 && Math.abs(hd.col - st.col) <= REACH) {
          if (hd.bad) {
            hd.bad = false
            st.rows[r] = st.rows[r].filter((x) => x !== hd)
            st.breath -= 12
            slip(2, t('Ça s’effrite !'))
            return
          }
          st.row = r
          st.col = hd.col
          st.breath -= 2
          knock(0.25, (hd.col / (COLS - 1)) * 2 - 1, 1200)
          if (r % LEDGE === 0 && r < TOP) setFlash({ text: t('Une corniche : souffle !'), at: performance.now() })
          return
        }
      }
    }
  }

  return (
    <div className="absolute inset-0 bg-[#9fd3ff]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('La Dent de Man')} left={hud.left} done={`${Math.round((hud.row / TOP) * 100)} %`}>
        <div className="h-3 w-16 overflow-hidden rounded-full bg-black/45" aria-label={t('Souffle')}>
          <div className={`h-full ${hud.breath < 30 ? 'bg-[#e03131]' : 'bg-[#69db7c]'}`} style={{ width: `${Math.max(0, Math.round(hud.breath))}%` }} />
        </div>
      </Hud>
      {hud.wind && <div className="animate-pop pointer-events-none absolute inset-x-0 top-[22%] z-10 text-center font-display text-3xl font-extrabold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">{t('Le vent ! Garde le doigt sur la roche')}</div>}
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-[#1f3b57]">{t('Touche la prise suivante. Les brunes fissurées s’effritent !')}</p>
    </div>
  )
}
