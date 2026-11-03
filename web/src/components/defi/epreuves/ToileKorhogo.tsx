import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, rnd, useHud, type Frame, type Touch, fx } from './kit'
import { t } from '../../../lib/i18n'

// « La fausse toile de Korhogo », chapter 1 (game/epreuves.go): at the market, the toile sold as a real
// one from Korhogo, next to a real one: the same animals painted in the same places, the fish, the calao,
// the turtle, the crocodile, the masked dancer… The copyist went too fast. Find his five mistakes (a
// tap on either toile): a figure missing, one the wrong way round, the wrong ink, a spot too many, the
// border broken. A wrong tap costs a few seconds.

const TIME = 60
const PENALTY = 3
const COLS = 3
const ROWS = 3
const FIGS = ['poisson', 'calao', 'tortue', 'masque', 'crocodile', 'lezard', 'soleil', 'serpent', 'poisson'] as const
type Fig = (typeof FIGS)[number]
type Panel = { fig: Fig; flip: boolean }
type Diff = { kind: 'gone' | 'flip' | 'ink' | 'spots' | 'border'; cell: number; x: number; y: number; found: boolean }

const INK = '#2a1a10'
const FAKE = '#7a3a12'

function makeDiffs(): Diff[] {
  const cells = [...Array(COLS * ROWS).keys()].sort(() => Math.random() - 0.5)
  // Turned the wrong way, the mask and the sun look the same: the second mistake (« flip ») not on them.
  const k = cells.findIndex((c) => FIGS[c] !== 'masque' && FIGS[c] !== 'soleil')
  ;[cells[1], cells[k]] = [cells[k], cells[1]]
  const kinds: Diff['kind'][] = ['gone', 'flip', 'ink', 'spots']
  const out: Diff[] = kinds.map((kind, i) => {
    const c = cells[i]
    const cx = ((c % COLS) + 0.5) / COLS
    const cy = (Math.floor(c / COLS) + 0.5) / ROWS
    return kind === 'spots' ? { kind, cell: c, x: cx + rnd(-0.08, 0.08), y: cy + 0.11, found: false } : { kind, cell: c, x: cx, y: cy, found: false }
  })
  // The border broken somewhere along the bottom or a side.
  const side = Math.random() < 0.5
  out.push({ kind: 'border', cell: -1, x: side ? 0.03 : rnd(0.2, 0.8), y: side ? rnd(0.2, 0.8) : 0.97, found: false })
  return out
}

export default function ToileKorhogo({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ panels: FIGS.map((fig) => ({ fig, flip: Math.random() < 0.5 })) as Panel[], diffs: makeDiffs(), lost: 0, over: false, rects: [] as { x: number; y: number; w: number; h: number }[], misses: [] as { x: number; y: number; at: number }[] })
  const [hud, setHud] = useHud({ left: TIME, found: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const frame = ({ g, w, h, t: now }: Frame) => {
    const st = s.current
    const left = TIME - now - st.lost
    const found = st.diffs.filter((d) => d.found).length
    if (!st.over && (left <= 0 || found === st.diffs.length)) {
      st.over = true
      setTimeout(() => onEnd(Math.round(found * 16 + (found === st.diffs.length ? Math.max(0, left / TIME) * 20 : 0))), 900)
    }
    setHud({ left: Math.max(0, left), found })
    g.fillStyle = '#6b4423'
    g.fillRect(0, 0, w, h)
    // Two toiles: side by side on a wide screen, one above the other on a phone held up.
    const wide = w > h
    const pad = 14
    const tw = wide ? (w - pad * 3) / 2 : Math.min(w - pad * 2, (h - 140 - pad) / 2 / 0.78)
    const th = tw * 0.78
    const x0 = wide ? pad : (w - tw) / 2
    const y0 = wide ? (h - th) / 2 + 10 : 70
    st.rects = [{ x: x0, y: y0, w: tw, h: th }, wide ? { x: x0 + tw + pad, y: y0, w: tw, h: th } : { x: x0, y: y0 + th + pad, w: tw, h: th }]
    st.rects.forEach((r, i) => drawToile(g, r, st.panels, i === 1 ? st.diffs : []))
    g.fillStyle = '#fbf5e6'
    g.font = 'bold 12px sans-serif'
    g.fillText(t('La vraie'), st.rects[0].x + 4, st.rects[0].y - 4)
    g.fillText(t('La copie'), st.rects[1].x + 4, st.rects[1].y - 4)
    // The mistakes found, ringed on both; the wrong taps, a red cross a moment.
    for (const d of st.diffs)
      if (d.found)
        for (const r of st.rects) {
          g.strokeStyle = '#2f9e44'
          g.lineWidth = 3
          g.beginPath()
          g.arc(r.x + d.x * r.w, r.y + d.y * r.h, r.w * 0.09, 0, Math.PI * 2)
          g.stroke()
        }
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
    if (e.kind !== 'down' || st.over) return
    const r = st.rects.find((r) => e.x >= r.x && e.x <= r.x + r.w && e.y >= r.y && e.y <= r.y + r.h)
    if (!r) return
    const u = (e.x - r.x) / r.w
    const v = (e.y - r.y) / r.h
    const hit = st.diffs.find((d) => !d.found && Math.hypot((d.x - u) * r.w, (d.y - v) * r.h) < r.w * 0.1)
    if (hit) {
      hit.found = true
      beep(740, 0.12, 0.12)
      beep(990, 0.18, 0.1)
      setFlash({ text: t('Trouvé !'), at: performance.now() })
      fx.good(e.x, e.y, t('Trouvé !'))
      if (st.diffs.every((d) => d.found)) fx.win()
    } else if (!st.diffs.some((d) => d.found && Math.hypot((d.x - u) * r.w, (d.y - v) * r.h) < r.w * 0.1)) {
      st.lost += PENALTY
      st.misses.push({ x: e.x, y: e.y, at: performance.now() / 1000 })
      beep(180, 0.2, 0.12, { type: 'square' })
      fx.bad(e.x, e.y, `−${PENALTY} s`)
    }
  }

  return (
    <div className="absolute inset-0 bg-[#6b4423]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('La fausse toile')} left={hud.left} done={`${hud.found}/5`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Touche les 5 erreurs du copieur. Une erreur de ta part coûte {n} secondes.', { n: PENALTY })}</p>
    </div>
  )
}

function drawToile(g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, panels: Panel[], diffs: Diff[]) {
  const has = (k: Diff['kind'], cell?: number) => diffs.find((d) => d.kind === k && (cell === undefined || d.cell === cell))
  g.fillStyle = '#efe2c4'
  g.fillRect(r.x, r.y, r.w, r.h)
  // The coarse weave.
  g.strokeStyle = 'rgba(120,90,50,0.12)'
  g.lineWidth = 1
  for (let x = r.x; x < r.x + r.w; x += 4) {
    g.beginPath()
    g.moveTo(x, r.y)
    g.lineTo(x, r.y + r.h)
    g.stroke()
  }
  // The border: little triangles all round, one gap if the copy broke it.
  const br = has('border')
  g.fillStyle = INK
  const tri = r.w / 30
  for (let i = 0; i < 30; i++) {
    const x = r.x + i * tri
    for (const [y, dir] of [
      [r.y, 1],
      [r.y + r.h, -1],
    ] as const) {
      if (br && Math.abs((x + tri / 2 - r.x) / r.w - br.x) < 0.05 && Math.abs((y - r.y) / r.h - br.y) < 0.05) continue
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + tri, y)
      g.lineTo(x + tri / 2, y + dir * tri * 0.9)
      g.fill()
    }
  }
  const n = Math.round(r.h / tri)
  for (let i = 0; i < n; i++) {
    const y = r.y + i * (r.h / n)
    for (const [x, dir] of [
      [r.x, 1],
      [r.x + r.w, -1],
    ] as const) {
      if (br && Math.abs((x - r.x) / r.w - br.x) < 0.06 && Math.abs((y + r.h / n / 2 - r.y) / r.h - br.y) < 0.06) continue
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x, y + r.h / n)
      g.lineTo(x + dir * tri * 0.9, y + r.h / n / 2)
      g.fill()
    }
  }
  // The figures, one a panel.
  panels.forEach((p, i) => {
    if (has('gone', i)) return
    const cw = (r.w * 0.9) / COLS
    const ch = (r.h * 0.88) / ROWS
    const cx = r.x + r.w * 0.05 + ((i % COLS) + 0.5) * cw
    const cy = r.y + r.h * 0.06 + (Math.floor(i / COLS) + 0.5) * ch
    const flip = p.flip !== !!has('flip', i)
    g.save()
    g.translate(cx, cy)
    g.scale((flip ? -1 : 1) * cw * 0.4, ch * 0.4)
    g.fillStyle = has('ink', i) ? FAKE : INK
    g.strokeStyle = g.fillStyle
    g.lineWidth = 0.08
    figure(g, p.fig)
    g.restore()
  })
  // A cluster of spots too many.
  const sp = has('spots')
  if (sp) {
    g.fillStyle = INK
    for (const [dx, dy] of [
      [0, 0],
      [0.02, 0.01],
      [-0.015, 0.02],
    ])
      g.fillRect(r.x + (sp.x + dx) * r.w, r.y + (sp.y + dy) * r.h, 3, 3)
  }
}

/** A figure in a box from -1 to 1, in the Senoufo painters' way: flat, dark, a few dots and lines inside. */
function figure(g: CanvasRenderingContext2D, f: Fig) {
  const dot = (x: number, y: number, s = 0.09) => {
    g.save()
    g.fillStyle = '#efe2c4'
    g.beginPath()
    g.arc(x, y, s, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  g.beginPath()
  switch (f) {
    case 'poisson':
      g.ellipse(-0.1, 0, 0.7, 0.35, 0, 0, Math.PI * 2)
      g.moveTo(0.55, 0)
      g.lineTo(0.95, -0.35)
      g.lineTo(0.95, 0.35)
      g.fill()
      dot(-0.5, -0.08)
      dot(0, 0, 0.06)
      dot(0.2, 0, 0.06)
      break
    case 'calao':
      g.ellipse(0.1, 0.15, 0.45, 0.35, 0, 0, Math.PI * 2)
      g.moveTo(-0.25, -0.15)
      g.arc(-0.35, -0.3, 0.2, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(-0.5, -0.35)
      g.quadraticCurveTo(-1, -0.2, -0.95, 0.15)
      g.lineTo(-0.5, -0.2)
      g.fill()
      g.fillRect(0, 0.45, 0.06, 0.4)
      g.fillRect(0.2, 0.45, 0.06, 0.4)
      dot(-0.38, -0.33, 0.06)
      break
    case 'tortue':
      g.ellipse(0, 0, 0.6, 0.45, 0, 0, Math.PI * 2)
      g.moveTo(0.6, 0)
      g.arc(0.72, 0, 0.16, 0, Math.PI * 2)
      g.fill()
      for (const [x, y] of [
        [-0.45, -0.45],
        [0.35, -0.45],
        [-0.45, 0.45],
        [0.35, 0.45],
      ])
        g.fillRect(x, y - 0.08, 0.14, 0.16)
      dot(-0.2, -0.15)
      dot(0.15, -0.15)
      dot(-0.2, 0.15)
      dot(0.15, 0.15)
      break
    case 'masque':
      g.ellipse(0, -0.2, 0.32, 0.45, 0, 0, Math.PI * 2)
      g.fill()
      g.fillRect(-0.28, 0.2, 0.56, 0.5)
      g.fillRect(-0.7, 0.25, 0.42, 0.1)
      g.fillRect(0.28, 0.25, 0.42, 0.1)
      g.fillRect(-0.25, 0.7, 0.1, 0.3)
      g.fillRect(0.15, 0.7, 0.1, 0.3)
      g.beginPath()
      g.moveTo(-0.3, -0.55)
      g.lineTo(-0.5, -0.95)
      g.lineTo(-0.15, -0.6)
      g.moveTo(0.3, -0.55)
      g.lineTo(0.5, -0.95)
      g.lineTo(0.15, -0.6)
      g.fill()
      dot(-0.12, -0.25, 0.07)
      dot(0.12, -0.25, 0.07)
      break
    case 'crocodile':
      g.ellipse(0, 0, 0.55, 0.18, 0, 0, Math.PI * 2)
      g.moveTo(0.5, -0.08)
      g.lineTo(0.98, -0.02)
      g.lineTo(0.5, 0.1)
      g.moveTo(-0.5, -0.06)
      g.lineTo(-0.98, 0)
      g.lineTo(-0.5, 0.08)
      g.fill()
      for (const x of [-0.35, 0.25]) {
        g.fillRect(x, 0.12, 0.08, 0.28)
        g.fillRect(x, -0.4, 0.08, 0.28)
      }
      dot(0.6, -0.03, 0.04)
      break
    case 'lezard':
      g.ellipse(0, 0, 0.18, 0.5, 0, 0, Math.PI * 2)
      g.moveTo(0, -0.5)
      g.arc(0, -0.58, 0.14, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.moveTo(-0.04, 0.45)
      g.quadraticCurveTo(0.3, 0.8, 0.1, 0.98)
      g.lineTo(0.04, 0.45)
      g.fill()
      g.fillRect(-0.5, -0.3, 0.35, 0.08)
      g.fillRect(0.15, -0.3, 0.35, 0.08)
      g.fillRect(-0.5, 0.2, 0.35, 0.08)
      g.fillRect(0.15, 0.2, 0.35, 0.08)
      break
    case 'soleil':
      g.arc(0, 0, 0.35, 0, Math.PI * 2)
      g.fill()
      for (let a = 0; a < 12; a++) {
        g.save()
        g.rotate((a / 12) * Math.PI * 2)
        g.fillRect(0.45, -0.05, 0.4, 0.1)
        g.restore()
      }
      dot(0, 0, 0.15)
      break
    case 'serpent':
      g.lineWidth = 0.18
      g.lineCap = 'round'
      g.moveTo(-0.85, 0.2)
      g.bezierCurveTo(-0.5, -0.6, -0.1, 0.8, 0.3, 0)
      g.quadraticCurveTo(0.55, -0.4, 0.8, -0.2)
      g.stroke()
      g.beginPath()
      g.arc(0.82, -0.2, 0.13, 0, Math.PI * 2)
      g.fill()
      break
  }
}
