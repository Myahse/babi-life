import { useRef, useState } from 'react'
import { Canvas, Flash, Hud, beep, knock, type Frame, type Touch, fx } from './kit'
import { t } from '../../../lib/i18n'

// « L'évasion de Zézé », chapter 2 (game/epreuves.go): Zézé the chimpanzee is in the quartier's boutique,
// among the sweets. The floor seen from above, in cells; a tap puts a carton down on one; then Zézé jumps
// to a cell next to his, the shortest way out (he's malin). Shut him in with the cartons: on the shop's
// edge, his next jump takes him out into the street. The fewer cartons, the better.

const N = 11 // cells a side
const START = 10 // cartons already about

type Cell = [r: number, c: number]

// The cells around one (rows offset every other one, as a honeycomb).
const around = ([r, c]: Cell): Cell[] => {
  const odd = r & 1
  return (
    [
      [r, c - 1],
      [r, c + 1],
      [r - 1, c - 1 + odd],
      [r - 1, c + odd],
      [r + 1, c - 1 + odd],
      [r + 1, c + odd],
    ] as Cell[]
  ).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N)
}
const edge = ([r, c]: Cell) => r === 0 || c === 0 || r === N - 1 || c === N - 1

/** Zézé's next cell: the first step of the shortest way to the edge (null: no way, he's shut in). */
function nextStep(block: boolean[][], from: Cell): Cell | null | 'out' {
  if (edge(from)) return 'out'
  const seen = new Map<string, Cell | null>([[from.join(), null]])
  const q: Cell[] = [from]
  while (q.length) {
    const cur = q.shift()!
    // Shuffled, so he doesn't always go the same way.
    for (const n of around(cur).sort(() => Math.random() - 0.5)) {
      const k = n.join()
      if (seen.has(k) || block[n[0]][n[1]]) continue
      seen.set(k, cur)
      if (edge(n)) {
        let step = n
        while (seen.get(step.join())!.join() !== from.join()) step = seen.get(step.join())!
        return step
      }
      q.push(n)
    }
  }
  // Shut in: a cell next to him still free, to fidget on, or none.
  const free = around(from).filter(([a, b]) => !block[a][b])
  return free.length ? null : null
}

export default function Chimpanze({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef(
    (() => {
      const block = Array.from({ length: N }, () => Array<boolean>(N).fill(false))
      const mid = Math.floor(N / 2)
      for (let i = 0; i < START; ) {
        const r = Math.floor(Math.random() * N)
        const c = Math.floor(Math.random() * N)
        if (block[r][c] || (Math.abs(r - mid) < 2 && Math.abs(c - mid) < 2)) continue
        block[r][c] = true
        i++
      }
      return { block, zeze: [mid, mid] as Cell, from: [mid, mid] as Cell, jump: 1, used: 0, over: '' as '' | 'pris' | 'parti', geo: { size: 0, ox: 0, oy: 0 } }
    })(),
  )
  const [hud, setHud] = useState({ used: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const pos = ([r, c]: Cell) => {
    const { size, ox, oy } = s.current.geo
    return [ox + (c + (r & 1 ? 0.5 : 0)) * size, oy + r * size * 0.87] as const
  }

  const frame = ({ g, w, h, dt, t: now }: Frame) => {
    const st = s.current
    const size = Math.min((w - 24) / (N + 0.5), (h - 150) / (N * 0.87))
    st.geo = { size, ox: (w - size * (N + 0.5)) / 2 + size / 2, oy: (h - size * N * 0.87) / 2 + size / 2 + 20 }
    st.jump = Math.min(1, st.jump + dt * 5)
    // The boutique's floor, the shelves round it.
    g.fillStyle = '#5c3a21'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#e8d5b0'
    g.fillRect(st.geo.ox - size, st.geo.oy - size, size * (N + 1.5), size * N * 0.87 + size)
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const [x, y] = pos([r, c])
        g.fillStyle = edge([r, c]) ? '#d9c39a' : '#f1e3c6'
        g.beginPath()
        g.arc(x, y, size * 0.44, 0, Math.PI * 2)
        g.fill()
        if (st.block[r][c]) {
          g.fillStyle = '#a47148'
          g.fillRect(x - size * 0.38, y - size * 0.38, size * 0.76, size * 0.76)
          g.strokeStyle = '#7a5230'
          g.lineWidth = 2
          g.strokeRect(x - size * 0.38, y - size * 0.38, size * 0.76, size * 0.76)
          g.beginPath()
          g.moveTo(x - size * 0.38, y)
          g.lineTo(x + size * 0.38, y)
          g.stroke()
        }
      }
    // Zézé, mid-jump between his cells.
    const [ax, ay] = pos(st.from)
    const [bx, by] = st.over === 'parti' ? [pos(st.zeze)[0] + (st.zeze[1] === 0 ? -size * 2 : st.zeze[1] === N - 1 ? size * 2 : 0), pos(st.zeze)[1] + (st.zeze[0] === 0 ? -size * 2 : st.zeze[0] === N - 1 ? size * 2 : 0)] : pos(st.zeze)
    const k = st.jump
    const x = ax + (bx - ax) * k
    const y = ay + (by - ay) * k - Math.sin(k * Math.PI) * size * 0.6
    const z = size * 0.5
    g.fillStyle = '#3b2416'
    g.beginPath()
    g.arc(x, y, z, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.arc(x - z * 0.9, y - z * 0.1, z * 0.32, 0, Math.PI * 2)
    g.arc(x + z * 0.9, y - z * 0.1, z * 0.32, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#d9a77a'
    g.beginPath()
    g.ellipse(x, y + z * 0.2, z * 0.62, z * 0.55, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#111'
    g.fillRect(x - z * 0.32, y - z * 0.12, z * 0.16, z * 0.16)
    g.fillRect(x + z * 0.16, y - z * 0.12, z * 0.16, z * 0.16)
    g.strokeStyle = '#111'
    g.lineWidth = 2
    g.beginPath()
    if (st.over === 'pris') g.arc(x, y + z * 0.55, z * 0.2, Math.PI, 0)
    else g.arc(x, y + z * 0.3, z * 0.22, 0.2, Math.PI - 0.2)
    g.stroke()
    // A sweet in his hand, a little bounce while he waits.
    if (!st.over) {
      g.fillStyle = '#ff6b6b'
      g.fillRect(x + z * 0.8, y + z * 0.4 + Math.sin(now * 8) * 2, z * 0.35, z * 0.2)
    }
  }

  const touch = (e: Touch) => {
    const st = s.current
    if (e.kind !== 'down' || st.over || st.jump < 1) return
    // The cell tapped: the nearest.
    let best: Cell | null = null
    let bd = Infinity
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const [x, y] = pos([r, c])
        const d = Math.hypot(x - e.x, y - e.y)
        if (d < bd) ((bd = d), (best = [r, c]))
      }
    if (!best || bd > st.geo.size * 0.6 || st.block[best[0]][best[1]] || best.join() === st.zeze.join()) return
    st.block[best[0]][best[1]] = true
    st.used++
    setHud({ used: st.used })
    knock(0.35, 0, 500)
    {
      const [px, py] = pos(best)
      fx.burst(px, py, ['#c08a4a', '#8a5a2b', '#e8d5b0'], 8, 120)
    }
    const step = nextStep(st.block, st.zeze)
    if (step === 'out') {
      st.over = 'parti'
      st.from = st.zeze
      st.jump = 0
      beep(500, 0.3, 0.12, { type: 'triangle', to: 900 })
      setFlash({ text: t('Il file !'), at: performance.now() })
      fx.bad(...pos(st.zeze))
      setTimeout(() => onEnd(Math.max(10, 40 - st.used)), 1200)
    } else if (step === null) {
      st.over = 'pris'
      beep(660, 0.15, 0.12)
      beep(880, 0.25, 0.12)
      setFlash({ text: t('Coincé !'), at: performance.now() })
      fx.good(...pos(st.zeze), t('Coincé !'))
      fx.win()
      setTimeout(() => onEnd(Math.round(Math.max(60, 100 - Math.max(0, st.used - 8) * 3))), 1200)
    } else {
      st.from = st.zeze
      st.zeze = step
      st.jump = 0
      beep(300 + Math.random() * 200, 0.08, 0.06, { type: 'square' })
    }
  }

  return (
    <div className="absolute inset-0 bg-[#5c3a21]">
      <Canvas frame={frame} touch={touch} />
      <Hud title={t('Coincer Zézé')} done={t('{n} cartons', { n: hud.used })} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Touche une case pour y poser un carton. Ne le laisse pas atteindre le bord !')}</p>
    </div>
  )
}
