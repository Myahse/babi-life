import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, knock, fx } from './kit'
import { Stage3D, groundAt, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { Prop } from '../jeux/props'
import { t } from '../../../lib/i18n'

// « L'évasion de Zézé », chapter 2 (game/epreuves.go): Zézé the chimpanzee is in the quartier's boutique,
// among the sweets. The floor seen from above, in cells; a tap puts a carton down on one; then Zézé jumps
// to a cell next to his, the shortest way out (he's malin). Shut him in with the cartons: on the shop's
// edge, his next jump takes him out into the street. The fewer cartons, the better. In the boutique in the
// game's 3D blocks: the tiled floor, the shelves of sweets on both sides, the cartons dropping where you
// tap, and Zézé (the game's block chimpanzee) hopping from tile to tile. The same rule and score.

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

/** A cell's middle on the boutique's floor (a honeycomb: every other row shifted half a cell). */
const S = 0.5
const cellAt = ([r, c]: Cell): [number, number] => [(c + (r & 1 ? 0.5 : 0) - (N - 0.5) / 2) * S, (r - (N - 1) / 2) * S * 0.87]

type St = { block: boolean[][]; zeze: Cell; from: Cell; jump: number; used: number; over: '' | 'pris' | 'parti'; drops: Map<string, number> }

export default function Chimpanze({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef<St>(
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
      return { block, zeze: [mid, mid] as Cell, from: [mid, mid] as Cell, jump: 1, used: 0, over: '' as const, drops: new Map() }
    })(),
  )
  const [hud, setHud] = useState({ used: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const v = useMemo(() => new THREE.Vector3(), [])
  const spot = (cell: Cell) => {
    const [x, z] = cellAt(cell)
    return screenOf(x, 0.3, z)
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over || st.jump < 1 || !groundAt(e.x, e.y, 0.15, v)) return
    let best: Cell | null = null
    let bd = Infinity
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const [x, z] = cellAt([r, c])
        const d = Math.hypot(x - v.x, z - v.z)
        if (d < bd) ((bd = d), (best = [r, c]))
      }
    if (!best || bd > S * 0.6 || st.block[best[0]][best[1]] || best.join() === st.zeze.join()) return
    st.block[best[0]][best[1]] = true
    st.drops.set(best.join(), performance.now())
    st.used++
    setHud({ used: st.used })
    knock(0.35, 0, 500)
    {
      const p = spot(best)
      fx.burst(p.x, p.y, ['#c08a4a', '#8a5a2b', '#e8d5b0'], 8, 120)
    }
    const step = nextStep(st.block, st.zeze)
    if (step === 'out') {
      st.over = 'parti'
      st.from = st.zeze
      st.jump = 0
      beep(500, 0.3, 0.12, { type: 'triangle', to: 900 })
      setFlash({ text: t('Il file !'), at: Date.now() })
      const p = spot(st.zeze)
      fx.bad(p.x, p.y)
      setTimeout(() => onEnd(Math.max(10, 40 - st.used)), 1200)
    } else if (step === null) {
      st.over = 'pris'
      beep(660, 0.15, 0.12)
      beep(880, 0.25, 0.12)
      setFlash({ text: t('Coincé !'), at: Date.now() })
      const p = spot(st.zeze)
      fx.good(p.x, p.y, t('Coincé !'))
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
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 9, 3.6]} look={[0, 0, 0.2]} fov={40} fit={[N * S + 0.8, N * S * 0.87 + 0.8]} bg="#5c3a21" touch={touch}>
        <Shop />
        <Board s={s} />
      </Stage3D>
      <Hud title={t('Coincer Zézé')} done={t('{n} cartons', { n: hud.used })} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Touche une case pour y poser un carton. Ne le laisse pas atteindre le bord !')}</p>
    </div>
  )
}

/** The boutique round the floor: its shelves of sweets and drinks, the door to the street. */
function Shop() {
  const w = N * S + 0.6
  const d = N * S * 0.87 + 0.6
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[w + 4, 0.2, d + 4]} c="#3d2414" />
      {[-1, 1].map((k) => (
        <group key={k}>
          <Box p={[k * (w / 2 + 0.35), 0.5, 0]} s={[0.5, 1, d]} c="#8a5a32" />
          {Array.from({ length: 6 }, (_, i) => (
            <Box key={i} p={[k * (w / 2 + 0.35), 1.08, -d / 2 + 0.4 + i * (d / 6)]} s={[0.3, 0.16, 0.3]} c={['#e03131', '#fab005', '#2f9e44', '#1c7ed6', '#ae3ec9', '#f08c00'][i]} />
          ))}
        </group>
      ))}
      <Box p={[0, 0.6, -d / 2 - 0.35]} s={[w + 1.2, 1.2, 0.4]} c="#6b4423" />
    </group>
  )
}

/** The floor's tiles, the cartons dropped on them, Zézé hopping from tile to tile. */
function Board({ s }: { s: React.RefObject<St> }) {
  const st = s.current
  const zeze = useRef<THREE.Group>(null)
  const cartons = useRef<THREE.Group>(null)
  const [, redraw] = useState(0)
  const count = useRef(0)
  const tiles = useMemo(() => {
    const out: { p: [number, number, number]; c: string }[] = []
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const [x, z] = cellAt([r, c])
        const edge = r === 0 || c === 0 || r === N - 1 || c === N - 1
        out.push({ p: [x, 0.02, z], c: edge ? '#d9c7a8' : (r + c) % 2 ? '#efe4cf' : '#e6d8bd' })
      }
    return out
  }, [])
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    st.jump = Math.min(1, st.jump + dt * 5)
    const [ax, az] = cellAt(st.from)
    let [bx, bz] = cellAt(st.zeze)
    // Off: out of the door and away.
    if (st.over === 'parti') ((bx += st.zeze[1] === 0 ? -1 : st.zeze[1] === N - 1 ? 1 : 0), (bz += st.zeze[0] === 0 ? -1 : st.zeze[0] === N - 1 ? 1 : 0))
    const k = st.jump
    const g = zeze.current
    if (g) {
      g.position.set(ax + (bx - ax) * k, Math.sin(k * Math.PI) * 0.35, az + (bz - az) * k)
      g.rotation.y = Math.atan2(bx - ax, bz - az) || g.rotation.y
      // Caught: he sits and sulks; else he bounces on his feet.
      g.scale.setScalar(st.over === 'pris' ? 0.62 : 0.7 + Math.abs(Math.sin(performance.now() / 160)) * 0.03)
    }
    // A new carton: drawn, dropping in.
    if (st.drops.size !== count.current) ((count.current = st.drops.size), redraw((n) => n + 1))
    const c = cartons.current
    if (c)
      c.children.forEach((m) => {
        const at = st.drops.get(m.userData.key as string)
        const t = at ? Math.min(1, (performance.now() - at) / 220) : 1
        m.position.y = 1.2 * (1 - t * t)
      })
  })
  const blocked: Cell[] = []
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (st.block[r][c]) blocked.push([r, c])
  return (
    <group>
      {tiles.map((t, i) => (
        <Box key={i} p={t.p} s={[S * 0.94, 0.04, S * 0.82]} c={t.c} />
      ))}
      <group ref={cartons}>
        {blocked.map((cell) => {
          const [x, z] = cellAt(cell)
          return (
            <group key={cell.join()} userData={{ key: cell.join() }} position={[x, 0, z]}>
              <group position={[0, 0.04, 0]} scale={0.42}>
                <Prop id="carton" />
              </group>
            </group>
          )
        })}
      </group>
      <group ref={zeze} scale={0.45}>
        <Prop id="singe" />
      </group>
    </group>
  )
}
