import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { ambience } from '../../audio/ambience'
import { Box } from '../../world3d/props'
import { Vehicle } from '../../world3d/vehicles'
import { JeuShell, Stage, Who } from './jeux/Shell'
import { Prop } from './jeux/props'
import { MySim } from './jeux/me'
import type { Pose } from '../../avatar/Human'
import { t as tr, tx } from '../../lib/i18n'

// « La fuite » (the update « braquages », Braquage.tsx): the robbery's getaway, its own game (no other
// uses it). Night, the quartier's ruelles seen from above: the Sim runs cell by cell (the arrows, a
// swipe, the keyboard) to the moto waiting at the other end, picking up the notes dropped on the way;
// the police walk their rounds, torch in hand: caught in a beam, the whistle, and the third time it's
// over. The score: the moto reached, how fast, the notes, how often seen.

const COLS = 7
const ROWS = 9
const CELL = 0.8
const TIME = 45 // seconds
const SEEN_MAX = 3
const STEP = 0.17 // seconds a cell, running
const COP_SPEED = 1.5 // cells a second
const BEAM = 2 // cells the torch lights ahead

type Cell = [row: number, col: number]
type Layout = { map: string[]; rounds: [Cell, Cell][] }

// The ruelles: '#' a block of houses, '.' the street, 'S' where the Sim comes out, 'M' the moto, '$' a note.
const LAYOUTS: Layout[] = [
  {
    map: ['#..M..#', '.#.#.#.', '...$...', '.##.##.', '$..#...', '.#...#.', '...#.$.', '.#.#.#.', '...S...'],
    rounds: [
      [
        [2, 0],
        [2, 6],
      ],
      [
        [4, 6],
        [8, 6],
      ],
      [
        [5, 2],
        [5, 4],
      ],
    ],
  },
  {
    map: ['..#M#..', '.#...#.', '...#...', '#.#.#.$', '..$...#', '.#.#.#.', '$..#...', '.#...#.', '...S...'],
    rounds: [
      [
        [4, 0],
        [4, 5],
      ],
      [
        [2, 4],
        [2, 6],
      ],
      [
        [5, 0],
        [8, 0],
      ],
    ],
  },
]

/** A layout, or its mirror (the ruelles the other way round). */
const pick = (): Layout => {
  const l = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)]
  if (Math.random() < 0.5) return l
  const flip = ([r, c]: Cell): Cell => [r, COLS - 1 - c]
  return {
    map: l.map.map((row) => [...row].reverse().join('')),
    rounds: l.rounds.map(([a, b]) => [flip(a), flip(b)]),
  }
}

const X = (col: number) => (col - (COLS - 1) / 2) * CELL
const Z = (row: number) => (row - (ROWS - 1) / 2) * CELL
const DIRS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
} as const
type Dir = keyof typeof DIRS
/** The way a figure faces, walking towards (dr, dc). */
const facing = (dr: number, dc: number) => Math.atan2(dc, dr)

type Cop = { a: Cell; b: Cell; k: number; way: 1 | -1 }
type Live = {
  t: number
  /** The Sim: the cell it's on, where it goes, how far there. */
  at: Cell
  to: Cell | null
  k: number
  face: number
  held: Dir | null
  queued: Dir | null
  cops: Cop[]
  notes: boolean[]
  /** Seen until (s): the whistle, the Sim frozen, then a moment not seen again. */
  stunned: number
  safe: number
}

/** A cop's cell now, and the way it faces. */
const copAt = (c: Cop): { r: number; cc: number; dr: number; dc: number } => {
  const len = Math.abs(c.b[0] - c.a[0]) + Math.abs(c.b[1] - c.a[1])
  const dr = Math.sign(c.b[0] - c.a[0])
  const dc = Math.sign(c.b[1] - c.a[1])
  const k = c.k * len
  return {
    r: c.a[0] + dr * k,
    cc: c.a[1] + dc * k,
    dr: dr * c.way,
    dc: dc * c.way,
  }
}

export function FuiteDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const layout = useMemo(pick, [])
  const walk = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS && layout.map[r][c] !== '#'
  const find = (ch: string): Cell => {
    const r = layout.map.findIndex((row) => row.includes(ch))
    return [r, layout.map[r].indexOf(ch)]
  }
  const start = useMemo(() => find('S'), [layout]) // eslint-disable-line react-hooks/exhaustive-deps
  const moto = useMemo(() => find('M'), [layout]) // eslint-disable-line react-hooks/exhaustive-deps
  const notes = useMemo(() => layout.map.flatMap((row, r) => [...row].flatMap((ch, c) => (ch === '$' ? [[r, c] as Cell] : []))), [layout])
  const live = useRef<Live>({
    t: 0,
    at: start,
    to: null,
    k: 0,
    face: Math.PI,
    held: null,
    queued: null,
    cops: layout.rounds.map(([a, b], i) => ({
      a,
      b,
      k: (i * 0.37) % 1,
      way: 1,
    })),
    notes: notes.map(() => false),
    stunned: 0,
    safe: 1.5,
  })
  const [left, setLeft] = useState(TIME)
  const [seen, setSeen] = useState(0)
  const [got, setGot] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [pose, setPose] = useState<Pose>('idle')
  const done = useRef(false)
  const st = useRef({ clock: TIME, seen: 0, got: 0 })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1300)
  }
  const finish = (escaped: boolean, why: string) => {
    if (done.current) return
    done.current = true
    say(why)
    const { clock, seen: n, got: g } = st.current
    const bonus = (g / Math.max(1, notes.length)) * 20
    const score = escaped ? 50 + (clock / TIME) * 30 + bonus - n * 12 : 10 + bonus - n * 3
    setTimeout(() => onEnd(Math.max(10, Math.min(100, Math.round(score)))), 1400)
  }
  const tick = (dt: number) => {
    if (done.current) return
    const l = live.current
    l.t += dt
    st.current.clock -= dt
    const sec = Math.max(0, Math.ceil(st.current.clock))
    if (sec !== left) setLeft(sec)
    if (st.current.clock <= 0) return finish(false, tr('Trop tard : les sirènes partout !'))
    // The police on their rounds, back and forth.
    for (const c of l.cops) {
      const len = Math.abs(c.b[0] - c.a[0]) + Math.abs(c.b[1] - c.a[1])
      c.k += (c.way * COP_SPEED * dt) / Math.max(1, len)
      if (c.k >= 1) ((c.k = 1), (c.way = -1))
      if (c.k <= 0) ((c.k = 0), (c.way = 1))
    }
    // The Sim: going to the next cell, or setting off the way asked.
    if (l.t >= l.stunned) {
      if (l.to) {
        l.k += dt / STEP
        if (l.k >= 1) {
          l.at = l.to
          l.to = null
          l.k = 0
          const i = notes.findIndex(([r, c]) => r === l.at[0] && c === l.at[1])
          if (i >= 0 && !l.notes[i]) {
            l.notes[i] = true
            st.current.got++
            setGot(st.current.got)
            haptic('light')
            ambience.snap(0.6)
            say(tr('Un billet de récupéré !'))
          }
          if (l.at[0] === moto[0] && l.at[1] === moto[1]) {
            haptic('success')
            setPose('cheer')
            return finish(true, tr('Sur la moto, et vroum ! Envolé·e !'))
          }
        }
      }
      if (!l.to) {
        const d = l.queued ?? l.held
        l.queued = null
        if (d) {
          const [dr, dc] = DIRS[d]
          l.face = facing(dr, dc)
          if (walk(l.at[0] + dr, l.at[1] + dc)) l.to = [l.at[0] + dr, l.at[1] + dc]
        }
      }
    }
    const moving = !!l.to
    if (l.t >= l.stunned) setPose((p) => (p === 'cheer' ? p : moving ? 'run' : 'idle'))
    // Caught in a torch's beam (the cell the cop's on, and up to BEAM ahead while the street goes on).
    if (l.t < l.safe) return
    const r = l.at[0] + (l.to ? (l.to[0] - l.at[0]) * l.k : 0)
    const cc = l.at[1] + (l.to ? (l.to[1] - l.at[1]) * l.k : 0)
    for (const c of l.cops) {
      const p = copAt(c)
      let lit = Math.hypot(p.r - r, p.cc - cc) < 0.6
      for (let s = 1; s <= BEAM && !lit; s++) {
        const br = Math.round(p.r) + p.dr * s
        const bc = Math.round(p.cc) + p.dc * s
        if (!walk(br, bc)) break
        lit = Math.hypot(br - r, bc - cc) < 0.55
      }
      if (lit) {
        st.current.seen++
        setSeen(st.current.seen)
        haptic('error')
        ambience.snap(1)
        setPose('flinch')
        l.stunned = l.t + 0.7
        l.safe = l.t + 2
        if (st.current.seen >= SEEN_MAX) return finish(false, tr('Attrapé·e ! Les menottes, et le fourgon.'))
        say(tr('Coup de sifflet ! On t’a vu·e !'))
        break
      }
    }
  }
  const press = (d: Dir) => {
    live.current.queued = d
    live.current.held = d
  }
  const release = () => void (live.current.held = null)
  useEffect(() => {
    const keys: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
      z: 'up',
      q: 'left',
    }
    const down = (e: KeyboardEvent) => {
      const d = keys[e.key]
      if (d) (e.preventDefault(), press(d))
    }
    const up = (e: KeyboardEvent) => {
      if (keys[e.key] === live.current.held) release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  }, [])
  // A swipe on the square: the way it went.
  const swipe = useRef<{ x: number; y: number } | null>(null)
  if (import.meta.env.DEV) Object.assign(globalThis, { __fuite: { press, release, live } })
  const arrow = (d: Dir, label: string) => (
    <button key={d} className="btn flex-1 touch-none !px-0 !py-3.5 text-[20px] select-none" aria-label={label} onPointerDown={(e) => (e.preventDefault(), press(d))} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}>
      {{ up: '↑', down: '↓', left: '←', right: '→' }[d]}
    </button>
  )
  return (
    <JeuShell
      title={tr('La fuite dans les ruelles')}
      how={tr('Rejoins la moto au bout des ruelles : les flèches (ou glisse le doigt). Ramasse les billets tombés, et reste loin des lampes de la police.')}
      status={tx('{0} s · {1}/{2} billets · vu·e {3}/{4}', {
        0: left,
        1: got,
        2: notes.length,
        3: seen,
        4: SEEN_MAX,
      })}
      said={said}
      tall
      controls={
        <>
          {arrow('left', tr('Gauche'))}
          {arrow('up', tr('Haut'))}
          {arrow('down', tr('Bas'))}
          {arrow('right', tr('Droite'))}
        </>
      }
    >
      <div
        className="absolute inset-0 touch-none overflow-hidden rounded-3xl"
        onPointerDown={(e) => void (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
          live.current.queued = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
        }}
      >
        <Stage decor="ciel" cam={[0, 8.2, 3.9]} look={[0, 0, 0.15]} fov={47}>
          <Ruelles map={layout.map} />
          <Moto at={moto} />
          {notes.map((n, i) => (
            <Note key={i} at={n} i={i} live={live} />
          ))}
          {layout.rounds.map((_, i) => (
            <Cop key={i} i={i} live={live} walk={walk} />
          ))}
          <Runner live={live} pose={pose} />
          <Clock onTick={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** The quartier by night: the bitume, the gutters, the blocks of houses (painted walls, tin roofs, a lit window). */
function Ruelles({ map }: { map: string[] }) {
  const walls = ['#c9a37a', '#d98f5f', '#9fb8a5', '#c7b26a', '#b98fa8', '#a9a39a']
  const roofs = ['#6f7a80', '#8a5a3c', '#5f6b5a']
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[COLS * CELL + 1.2, 0.2, ROWS * CELL + 1.2]} c="#2c2f36" />
      {map.flatMap((row, r) =>
        [...row].map((ch, c) => {
          if (ch !== '#') return <Box key={`${r}-${c}`} p={[X(c), 0.005, Z(r)]} s={[CELL * 0.96, 0.01, CELL * 0.96]} c={(r + c) % 2 ? '#3a3d45' : '#363941'} />
          const h = 0.45 + ((r * 7 + c * 3) % 4) * 0.14
          const w = walls[(r * 5 + c) % walls.length]
          return (
            <group key={`${r}-${c}`} position={[X(c), 0, Z(r)]}>
              <Box p={[0, h / 2, 0]} s={[CELL * 0.92, h, CELL * 0.92]} c={w} />
              <Box p={[0, h + 0.03, 0]} s={[CELL * 0.98, 0.06, CELL * 0.98]} c={roofs[(r + c) % roofs.length]} />
              {(r + c) % 3 === 0 && <Box p={[0, h * 0.55, CELL * 0.465]} s={[0.16, 0.14, 0.01]} c="#ffd76a" glow={1.2} />}
            </group>
          )
        }),
      )}
    </group>
  )
}

/** The moto waiting, engine running, its green light flashing. */
function Moto({ at }: { at: Cell }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(clock.elapsedTime * 6) * 0.25
  })
  return (
    <group position={[X(at[1]), 0, Z(at[0])]}>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.4, 24]} />
        <meshBasicMaterial color="#51cf66" transparent opacity={0.5} />
      </mesh>
      <group scale={0.5}>
        <Vehicle p={[0, 0, 0]} kind="moto" color="#c92a2a" seed={3} crew={false} />
      </group>
    </group>
  )
}

/** A note dropped in the street, turning, gone once picked up. */
function Note({ at, i, live }: { at: Cell; i: number; live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current) return
    g.current.visible = !live.current.notes[i]
    g.current.rotation.y = live.current.t * 2 + i
    g.current.position.y = 0.18 + Math.sin(live.current.t * 3 + i) * 0.04
  })
  return (
    <group ref={g} position={[X(at[1]), 0.18, Z(at[0])]} scale={0.42}>
      <Prop id="billet" />
    </group>
  )
}

/** A policeman on his round, his torch's beam on the ground ahead (as far as the street goes). */
function Cop({ i, live, walk }: { i: number; live: { current: Live }; walk: (r: number, c: number) => boolean }) {
  const g = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const siren = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = copAt(live.current.cops[i])
    if (!g.current || !beam.current) return
    g.current.position.set(X(p.cc), 0, Z(p.r))
    g.current.rotation.y = facing(p.dr, p.dc)
    let n = 0
    while (n < BEAM && walk(Math.round(p.r) + p.dr * (n + 1), Math.round(p.cc) + p.dc * (n + 1))) n++
    beam.current.visible = n > 0
    beam.current.scale.set(1, Math.max(0.01, n), 1)
    beam.current.position.set(0, 0.03, (n * CELL) / 2 + 0.15)
    ;(beam.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(live.current.t * 9 + i) * 0.08
    if (siren.current) siren.current.children.forEach((m, k) => (m.visible = (Math.floor(live.current.t * 4) + k) % 2 === 0))
  })
  return (
    <group ref={g}>
      <mesh ref={beam} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CELL * 0.8, CELL]} />
        <meshBasicMaterial color="#ffe066" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group scale={0.55}>
        <Who host="policier" seed={i + 2} pose="walk" />
      </group>
      {/* Red and blue over the cop's head, seen from above */}
      <group ref={siren}>
        <Box p={[-0.07, 1.08, 0]} s={[0.1, 0.06, 0.1]} c="#ff3d57" glow={2} />
        <Box p={[0.07, 1.08, 0]} s={[0.1, 0.06, 0.1]} c="#3d8bff" glow={2} />
      </group>
      <Box p={[0.1, 0.4, 0.12]} s={[0.05, 0.05, 0.1]} c="#fff3a8" glow={1.5} />
    </group>
  )
}

/** The Sim running, cagoule on (its own look), from cell to cell. */
function Runner({ live, pose }: { live: { current: Live }; pose: Pose }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const l = live.current
    if (!g.current) return
    const r = l.at[0] + (l.to ? (l.to[0] - l.at[0]) * l.k : 0)
    const c = l.at[1] + (l.to ? (l.to[1] - l.at[1]) * l.k : 0)
    g.current.position.set(X(c), 0, Z(r))
    g.current.rotation.y = l.face
    // Seen: blinking, a moment.
    g.current.visible = l.t >= l.safe || Math.floor(l.t * 10) % 2 === 0
  })
  return (
    <group ref={g}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.28, 24]} />
        <meshBasicMaterial color="#ff9f1c" />
      </mesh>
      <MySim pose={pose} scale={0.55} />
    </group>
  )
}

function Clock({ onTick }: { onTick: (dt: number) => void }) {
  useFrame((_, dt) => onTick(Math.min(0.05, dt)))
  return null
}
