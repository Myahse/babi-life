// Mon quartier in 3D (screens/Quartier.tsx): the owner's land as it stands (backend game/quartier.go), cell
// by cell: the grass, the roads (their middle line where they run straight), the lagoon and the water dug,
// the bridges over it, the trees; the house and its yard; Babi Pub's boards by the road in (they stay: the
// game lives on them); the residents walking about on their own; the owner's Sim (a tap on the ground
// takes it there); the friends who are there, live. In « Construire », a finger drawn over the ground marks
// the cells the tool will change (shown at once, paid on « Valider »).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import { Human } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { sampleLive } from '../../lib/live'
import { seen, useAds } from '../../lib/ads'
import { whereabouts } from '../whereabouts'
import { Billboard } from '../open/billboards'
import { Land, T, seeded, type XZ } from './grid'

export type Person = { id: string; name: string; gender: 'femme' | 'homme'; look: Look }

type Props = {
  land: Land
  /** The owner's Sim (or the visitor's): drawn and walked. */
  me: Person
  /** Who else may be here (drawn when they are, live). */
  people: Person[]
  ownerId: string
  commune: string
  boards: { x: number; y: number; format: '4x3' | 'geant' | 'sucette' }[]
  night: boolean
  /** « Construire »: a finger over the ground marks cells (their indexes); no walking, no turning the camera with one finger. */
  painting: boolean
  onPaint: (cells: number[]) => void
  /** The cells marked, not yet paid (drawn with a light over them). */
  marked: Set<number>
}

const GRASS = new THREE.Color('#7cb342')
const GRASS2 = new THREE.Color('#76ad3f')
const ROAD = new THREE.Color('#4a4d55')
const WATER = new THREE.Color('#2a8fc4')
const SAND = new THREE.Color('#e8d39a')
const BOX = new THREE.BoxGeometry(1, 1, 1)
const PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
const dummy = new THREE.Object3D()

/** One instanced mesh a kind of thing: its instances set from a list of matrices (and colours). */
function Instances({ items, geometry, material, colors }: { items: { p: [number, number, number]; s: [number, number, number]; r?: number }[]; geometry: THREE.BufferGeometry; material: THREE.Material; colors?: THREE.Color[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = Math.max(1, items.length)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => {
      dummy.position.set(...it.p)
      dummy.scale.set(...it.s)
      dummy.rotation.set(0, it.r ?? 0, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      if (colors) m.setColorAt(i, colors[i])
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, colors])
  return <instancedMesh key={count} ref={ref} args={[geometry, material, count]} receiveShadow castShadow={false} frustumCulled={false} />
}

const mats = {
  ground: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  road: new THREE.MeshLambertMaterial({ color: ROAD }),
  line: new THREE.MeshBasicMaterial({ color: '#f2f2f2' }),
  water: new THREE.MeshLambertMaterial({ color: WATER, transparent: true, opacity: 0.92 }),
  deck: new THREE.MeshLambertMaterial({ color: '#8d6e63' }),
  rail: new THREE.MeshLambertMaterial({ color: '#d7ccc8' }),
  trunk: new THREE.MeshLambertMaterial({ color: '#6d4c41' }),
  crown: new THREE.MeshLambertMaterial({ color: '#2e7d32' }),
  mark: new THREE.MeshBasicMaterial({ color: '#ffd54f', transparent: true, opacity: 0.3, depthWrite: false }),
  wall: new THREE.MeshLambertMaterial({ color: '#f3e5c8' }),
  roof: new THREE.MeshLambertMaterial({ color: '#9aa3ad' }),
  fence: new THREE.MeshLambertMaterial({ color: '#e0c9a6' }),
  door: new THREE.MeshLambertMaterial({ color: '#795548' }),
  window: new THREE.MeshLambertMaterial({ color: '#4fc3f7' }),
}
const CROWN = new THREE.ConeGeometry(1, 1, 7)
const TRUNK = new THREE.CylinderGeometry(0.2, 0.28, 1, 6)

/** The land itself: grass, roads, water, bridges, trees; the cells marked in « Construire ». */
function Ground({ land, marked }: { land: Land; marked: Set<number> }) {
  const c = land.cell
  const built = useMemo(() => {
    const ground: { p: [number, number, number]; s: [number, number, number] }[] = []
    const groundColors: THREE.Color[] = []
    const roads: typeof ground = []
    const lines: (typeof ground[number] & { r: number })[] = []
    const water: typeof ground = []
    const decks: typeof ground = []
    const rails: (typeof ground[number] & { r: number })[] = []
    const trunks: typeof ground = []
    const crowns: typeof ground = []
    const rng = seeded(land.size * 7919)
    const isRoad = (x: number, y: number) => [T.road, T.bridge, T.gate].includes(land.at(x, y) as 'r')
    for (let y = 0; y < land.size; y++)
      for (let x = 0; x < land.size; x++) {
        const t = land.at(x, y)
        const [px, pz] = land.center(x, y)
        const r = rng()
        if (t === T.water || t === T.bridge) {
          water.push({ p: [px, -0.3, pz], s: [c, 1, c] })
          // A sandy bank under the water's edge.
          ground.push({ p: [px, -1.1, pz], s: [c, 1, c] })
          groundColors.push(SAND)
        } else {
          ground.push({ p: [px, -0.5, pz], s: [c, 1, c] })
          groundColors.push(r < 0.5 ? GRASS : GRASS2)
        }
        if (t === T.road || t === T.gate) {
          roads.push({ p: [px, 0.02, pz], s: [c, 1, c] })
          // The middle line, where the road runs straight on (north–south or east–west).
          const ns = isRoad(x, y - 1) && isRoad(x, y + 1) && !isRoad(x - 1, y) && !isRoad(x + 1, y)
          const ew = isRoad(x - 1, y) && isRoad(x + 1, y) && !isRoad(x, y - 1) && !isRoad(x, y + 1)
          if (ns || ew) lines.push({ p: [px, 0.03, pz], s: [0.25, 1, c * 0.45], r: ew ? Math.PI / 2 : 0 })
        }
        if (t === T.bridge) {
          // The deck over the water, and its rails along the way it goes.
          const ew = (isRoad(x - 1, y) || isRoad(x + 1, y)) && !(isRoad(x, y - 1) || isRoad(x, y + 1))
          decks.push({ p: [px, 0.15, pz], s: [c, 0.3, c] })
          const rot = ew ? Math.PI / 2 : 0
          for (const side of [-1, 1]) {
            const off = side * (c / 2 - 0.2)
            rails.push({ p: ew ? [px, 0.75, pz + off] : [px + off, 0.75, pz], s: [0.2, 0.9, c], r: rot })
          }
        }
        if (t === T.tree) {
          const h = 5 + r * 4
          for (const [ox, oz] of r < 0.4 ? [[0, 0]] : [
            [-1.6, -1.2],
            [1.7, 1.4],
          ]) {
            trunks.push({ p: [px + ox, h * 0.25, pz + oz], s: [1, h * 0.5, 1] })
            crowns.push({ p: [px + ox, h * 0.62, pz + oz], s: [2.2 + r, h * 0.7, 2.2 + r] })
          }
        }
      }
    return { ground, groundColors, roads, lines, water, decks, rails, trunks, crowns }
  }, [land, c])
  const marks = useMemo(() => [...marked].map((i) => ({ p: [...((): [number, number, number] => { const [px, pz] = land.center(i % land.size, Math.floor(i / land.size)); return [px, 0.08, pz] })()] as [number, number, number], s: [c * 0.96, 1, c * 0.96] as [number, number, number] })), [marked, land, c])
  return (
    <group>
      <Instances items={built.ground} colors={built.groundColors} geometry={BOX} material={mats.ground} />
      <Instances items={built.roads} geometry={PLANE} material={mats.road} />
      <Instances items={built.lines} geometry={PLANE} material={mats.line} />
      <Instances items={built.water} geometry={PLANE} material={mats.water} />
      <Instances items={built.decks} geometry={BOX} material={mats.deck} />
      <Instances items={built.rails} geometry={BOX} material={mats.rail} />
      <Instances items={built.trunks} geometry={TRUNK} material={mats.trunk} />
      <Instances items={built.crowns} geometry={CROWN} material={mats.crown} />
      {marks.length > 0 && <Instances items={marks} geometry={PLANE} material={mats.mark} />}
    </group>
  )
}

/** The house in its yard (the cells « M »): a walled yard, a house under tin, its door to the road below. */
function House({ land }: { land: Land }) {
  const cells = useMemo(() => land.all(T.house), [land])
  if (!cells.length) return null
  const xs = cells.map((c) => c[0])
  const ys = cells.map((c) => c[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const [ax, az] = land.center(x0, y0)
  const [bx, bz] = land.center(x1, y1)
  const [cx, cz] = [(ax + bx) / 2, (az + bz) / 2]
  const w = (x1 - x0 + 1) * land.cell
  const d = (y1 - y0 + 1) * land.cell
  const hw = 13
  const hd = 10
  return (
    <group position={[cx, 0, cz]}>
      {/* The yard: beaten earth, its wall round it, the gate open to the road (south). */}
      <mesh geometry={PLANE} position={[0, 0.03, 0]} scale={[w - 1, 1, d - 1]}>
        <meshLambertMaterial color="#d7b98a" />
      </mesh>
      {[
        [0, -d / 2 + 0.5, w - 1, 0],
        [-w / 2 + 0.5, 0, d - 1, Math.PI / 2],
        [w / 2 - 0.5, 0, d - 1, Math.PI / 2],
        [-w / 4 - 2, d / 2 - 0.5, w / 2 - 4, 0],
        [w / 4 + 2, d / 2 - 0.5, w / 2 - 4, 0],
      ].map(([x, z, l, r], i) => (
        <mesh key={i} geometry={BOX} material={mats.fence} position={[x, 0.9, z]} scale={[l, 1.8, 0.3]} rotation={[0, r, 0]} castShadow />
      ))}
      {/* The house: its walls, its tin roof in two slopes, its veranda, door and windows on the yard. */}
      <group position={[0, 0, -3]}>
        <mesh geometry={BOX} material={mats.wall} position={[0, 1.7, 0]} scale={[hw, 3.4, hd]} castShadow receiveShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={BOX} material={mats.roof} position={[0, 4.2, (s * hd) / 4]} scale={[hw + 1.2, 0.15, hd / 2 + 1.4]} rotation={[s * 0.32, 0, 0]} castShadow />
        ))}
        <mesh geometry={BOX} material={mats.roof} position={[0, 3.3, hd / 2 + 1.4]} scale={[hw * 0.7, 0.1, 2.8]} />
        {[-hw * 0.32, hw * 0.32].map((x) => (
          <mesh key={x} geometry={BOX} material={mats.fence} position={[x, 1.6, hd / 2 + 2.6]} scale={[0.25, 3.2, 0.25]} />
        ))}
        <mesh geometry={BOX} material={mats.door} position={[0, 1.1, hd / 2 + 0.02]} scale={[1.2, 2.2, 0.1]} />
        {[-hw * 0.3, hw * 0.3].map((x) => (
          <mesh key={x} geometry={BOX} material={mats.window} position={[x, 1.8, hd / 2 + 0.02]} scale={[1.6, 1.1, 0.1]} />
        ))}
      </group>
    </group>
  )
}

/** The way out to Babi: the road carries on past the land's edge, a sign over it. */
function Gate({ land }: { land: Land }) {
  const cell = land.all(T.gate)[0]
  if (!cell) return null
  const [px, pz] = land.center(cell[0], cell[1])
  return (
    <group position={[px, 0, pz]}>
      <mesh geometry={PLANE} material={mats.road} position={[0, 0.02, 40]} scale={[land.cell, 1, 80]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={mats.trunk} position={[(s * land.cell) / 2, 2.5, 2]} scale={[0.35, 5, 0.35]} />
      ))}
      <mesh geometry={BOX} position={[0, 5, 2]} scale={[land.cell + 1, 1.2, 0.2]}>
        <meshLambertMaterial color="#ff7a00" />
      </mesh>
      <Html position={[0, 5, 2.2]} center transform scale={1.4} pointerEvents="none">
        <div className="pointer-events-none font-display text-[13px] font-extrabold whitespace-nowrap text-white">BABI →</div>
      </Html>
    </group>
  )
}

/** Babi Pub's boards by the road in: the commune's ads, in turn (world3d/open/billboards.tsx), views counted. */
function Boards({ land, boards, commune, night }: { land: Land; boards: Props['boards']; commune: string; night: boolean }) {
  const ads = useAds(commune, 'panneaux')
  return (
    <>
      {boards.map((b, i) => {
        const at = land.center(b.x, b.y)
        // Facing the road: the road in runs north–south; a board east of it looks west, one west of it east.
        const roadWest = land.at(b.x - 1, b.y) === T.road || land.at(b.x - 2, b.y) === T.road
        return <Billboard key={i} board={{ id: `quartier-${i}`, at, rot: roadWest ? -Math.PI / 2 : Math.PI / 2, seed: (i + 1) * 0.29, format: b.format }} ads={ads} night={night} onSeen={(id) => seen(commune, id)} />
      })}
    </>
  )
}

const WALK = 2.6 // m/s

/** Walks a figure along a list of points: where it is, which way it faces, whether it moves. */
function useWalk(start: XZ) {
  const pos = useRef<XZ>([...start])
  const way = useRef<XZ[]>([])
  const heading = useRef(0)
  const step = (dt: number, speed = WALK) => {
    const next = way.current[0]
    if (!next) return false
    const dx = next[0] - pos.current[0]
    const dz = next[1] - pos.current[1]
    const d = Math.hypot(dx, dz)
    const move = speed * Math.min(dt, 0.1)
    if (d <= move) {
      pos.current = [next[0], next[1]]
      way.current.shift()
    } else {
      pos.current = [pos.current[0] + (dx / d) * move, pos.current[1] + (dz / d) * move]
    }
    if (d > 0.01) heading.current = Math.atan2(dx, dz)
    return true
  }
  return { pos, way, heading, step }
}

/** The Sim: a tap on the ground (not in « Construire ») takes it there by the shortest way; the camera follows; the others see it live. */
function Me({ land, me, goal, follow, visiting }: { land: Land; me: Person; goal: XZ | null; follow: React.RefObject<XZ>; visiting: boolean }) {
  const house = land.all(T.house)
  const gate = land.all(T.gate)[0]
  // At home: out of the yard's gate, on the road below it. Visiting: come in from Babi, by the road in.
  const startCell: [number, number] = visiting && gate ? [gate[0], gate[1] - 1] : house.length ? [house[0][0] + 1, house[house.length - 1][1] + 1] : [0, 0]
  const w = useWalk(land.center(...startCell))
  const g = useRef<THREE.Group>(null)
  const [walking, setWalking] = useState(false)
  useEffect(() => {
    if (!goal) return
    const from = land.cellOf(...w.pos.current)
    const to = land.cellOf(...goal)
    if (!from || !to) return
    const cells = land.path(from, to)
    if (!cells) return
    w.way.current = [...cells.slice(0, -1).map(([x, y]) => land.center(x, y)), goal]
  }, [goal, land]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const moving = w.step(dt)
    if (moving !== walking) setWalking(moving)
    const [x, z] = w.pos.current
    g.current?.position.set(x, 0, z)
    if (g.current) g.current.rotation.y = w.heading.current
    whereabouts.sim = [x, z]
    whereabouts.simY = 0
    whereabouts.simHeading = w.heading.current
    whereabouts.simPose = moving ? 'walk' : 'idle'
    follow.current = [x, z]
  })
  return (
    <group ref={g}>
      <Human look={me.look} gender={me.gender} pose={walking ? 'walk' : 'idle'} speed={walking ? WALK : 0} faceId="me" />
    </group>
  )
}

/** A resident: walks about on its own (to a road, a yard, the water's edge), stops a while, goes on. */
function Resident({ land, seed }: { land: Land; seed: number }) {
  const rng = useMemo(() => seeded(seed), [seed])
  const gender = rng() < 0.5 ? 'femme' : 'homme'
  const look = useMemo(() => randomLook(gender, rng), [gender, rng])
  const spots = useMemo(() => {
    const roads = [...land.all(T.road), ...land.all(T.bridge)]
    return roads.length > 3 ? roads : [...roads, ...land.all(T.grass)]
  }, [land])
  const first = spots[Math.floor(rng() * spots.length)] ?? [0, 0]
  const w = useWalk(land.center(first[0], first[1]))
  const g = useRef<THREE.Group>(null)
  const wait = useRef(rng() * 4)
  const [walking, setWalking] = useState(false)
  useFrame((_, dt) => {
    if (!w.way.current.length) {
      wait.current -= dt
      if (wait.current <= 0 && spots.length) {
        const from = land.cellOf(...w.pos.current)
        const to = spots[Math.floor(rng() * spots.length)]
        const cells = from && land.path(from, to)
        if (cells?.length) w.way.current = cells.map(([x, y]) => {
          const [cx, cz] = land.center(x, y)
          return [cx + (rng() - 0.5) * 3, cz + (rng() - 0.5) * 3] as XZ
        })
        wait.current = 3 + rng() * 8
      }
    }
    const moving = w.step(dt, 1.4)
    if (moving !== walking) setWalking(moving)
    g.current?.position.set(w.pos.current[0], 0, w.pos.current[1])
    if (g.current) g.current.rotation.y = w.heading.current
  })
  return (
    <group ref={g}>
      <Human look={look} gender={gender} pose={walking ? 'walk' : 'idle'} speed={walking ? 1.4 : 0} seed={seed} />
    </group>
  )
}

/** A player who may be here: drawn when it is (live), its name over it. */
function Visitor({ person }: { person: Person }) {
  const g = useRef<THREE.Group>(null)
  const [here, setHere] = useState(false)
  const [walking, setWalking] = useState(false)
  useFrame(() => {
    const s = sampleLive(person.id)
    if (!!s !== here) setHere(!!s)
    if (!s || !g.current) return
    g.current.position.set(s.x, s.y, s.z)
    g.current.rotation.y = s.h
    if ((s.p === 'walk') !== walking) setWalking(s.p === 'walk')
  })
  return (
    <group ref={g} visible={here}>
      {here && (
        <>
          <Human look={person.look} gender={person.gender} pose={walking ? 'walk' : 'idle'} speed={walking ? WALK : 0} />
          <Html position={[0, 2.3, 0]} center pointerEvents="none">
            <div className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white">{person.name}</div>
          </Html>
        </>
      )}
    </group>
  )
}

/** The camera: round the Sim (it follows it), or free over the land in « Construire » (two fingers to move and zoom). */
function Camera({ follow, painting }: { follow: React.RefObject<XZ>; painting: boolean }) {
  const controls = useRef<OrbitImpl>(null)
  const { camera } = useThree()
  const last = useRef<XZ>([0, 0])
  useFrame(() => {
    const c = controls.current
    if (!c || painting) return
    // The camera carried along with the Sim, as far as it went.
    const [x, z] = follow.current
    const dx = x - last.current[0]
    const dz = z - last.current[1]
    last.current = [x, z]
    c.target.x += dx
    c.target.z += dz
    camera.position.x += dx
    camera.position.z += dz
    c.update()
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      maxPolarAngle={1.25}
      minDistance={12}
      maxDistance={260}
      enableRotate={!painting}
      enablePan={painting}
      screenSpacePanning={false}
      touches={painting ? { ONE: undefined as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      mouseButtons={painting ? { LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN } : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
    />
  )
}

function Scene(props: Props) {
  const { land, painting, onPaint } = props
  const follow = useRef<XZ>([0, 0])
  const [goal, setGoal] = useState<XZ | null>(null)
  const drawing = useRef(false)
  const down = useRef<{ x: number; y: number } | null>(null)
  const residents = useMemo(() => Math.min(12, 4 + Math.floor(land.all(T.road).length / 30)), [land])
  const cellAt = (e: ThreeEvent<PointerEvent>) => {
    const c = land.cellOf(e.point.x, e.point.z)
    return c ? c[1] * land.size + c[0] : null
  }
  return (
    <>
      <hemisphereLight args={[props.night ? '#3b4a7a' : '#dff3ff', '#556b2f', props.night ? 0.5 : 1.1]} />
      <directionalLight position={[80, 140, 60]} intensity={props.night ? 0.25 : 1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-180} shadow-camera-right={180} shadow-camera-top={180} shadow-camera-bottom={-180} />
      <fog attach="fog" args={[props.night ? '#0d1530' : '#cfe8f5', 220, 620]} />
      {/* Beyond the land: the bush, far. */}
      <mesh geometry={PLANE} position={[0, -0.7, 0]} scale={[2400, 1, 2400]} receiveShadow>
        <meshLambertMaterial color="#4f7f2f" />
      </mesh>
      <Ground land={land} marked={props.marked} />
      <House land={land} />
      <Gate land={land} />
      <Boards land={land} boards={props.boards} commune={props.commune} night={props.night} />
      <Me land={land} me={props.me} goal={goal} follow={follow} visiting={props.me.id !== props.ownerId} />
      {Array.from({ length: residents }, (_, i) => (
        <Resident key={i} land={land} seed={(props.ownerId.charCodeAt(0) || 7) * 101 + i * 7919} />
      ))}
      {props.people
        .filter((p) => p.id !== props.me.id)
        .map((p) => (
          <Visitor key={p.id} person={p} />
        ))}
      {/* The ground taken by a tap or a finger: walking there, or marking cells in « Construire ». */}
      <mesh
        geometry={PLANE}
        position={[0, 0.05, 0]}
        scale={[land.size * land.cell, 1, land.size * land.cell]}
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY }
          if (!painting || e.nativeEvent.isPrimary === false) return
          e.stopPropagation()
          drawing.current = true
          const i = cellAt(e)
          if (i !== null) onPaint([i])
        }}
        onPointerMove={(e) => {
          if (!painting || !drawing.current) return
          const i = cellAt(e)
          if (i !== null) onPaint([i])
        }}
        onPointerUp={(e) => {
          drawing.current = false
          const d = down.current
          down.current = null
          // A tap (not a drag that turned the camera): walk there.
          if (!painting && d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) setGoal([e.point.x, e.point.z])
        }}
        onPointerLeave={() => (drawing.current = false)}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Camera follow={follow} painting={painting} />
    </>
  )
}

export function QuartierScene(props: Props) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 24, 36], fov: 45, near: 0.5, far: 3000 }} style={{ background: props.night ? '#0d1530' : '#cfe8f5', touchAction: 'none' }}>
      <Scene {...props} />
    </Canvas>
  )
}
