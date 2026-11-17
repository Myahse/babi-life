// Mon quartier in 3D (screens/Quartier.tsx): the owner's land as it stands (backend game/quartier.go), cell
// by cell: the grass, the roads (their middle line where they run straight), the lagoon and the water dug,
// the bridges over it, the trees; the house and its yard; Babi Pub's boards by the road in (they stay: the
// game lives on them); the residents walking about on their own; the owner's Sim (a tap on the ground
// takes it there); the friends who are there, live. In « Construire », a finger drawn over the ground marks
// the cells the tool will change (shown at once, paid on « Valider »).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import { Human } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Block, Look, Material } from '../../lib/types'
import { sampleLive } from '../../lib/live'
import { seen, useAds } from '../../lib/ads'
import { worldTime } from '../../lib/worldClock'
import { whereabouts } from '../whereabouts'
import { Billboard } from '../open/billboards'
import { makeWorldMaterials, Palms, Trees } from '../open/OpenWorld'
import { buildChunk } from '../open/meshes'
import { Nav } from '../open/nav'
import { SkyDome } from '../open/sky'
import { StreetLights } from '../open/streetlights'
import { LivingCity } from '../open/livingCity'
import { useSign, Sign } from '../open/villeKit'
import { House as BuiltHouse } from '../build/House'
import { HouseDressing } from '../build/HouseDressing'
import { Baked } from '../Baked'
import { quartierMap } from './chunk'
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
  /** The house in the yard (backend sims/quartier.go quartierHouse): its blocks, its size (m). */
  house?: { blocks: Block[]; w: number; d: number; own?: boolean }
  /** The game's building materials (world.materials), for the house. */
  materials?: Material[]
  /** The hour (0–23): the street's life, the lamps. */
  hour: number
}

const PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
/** The bush round the land (and under it): the game's grass, its texture tiled every 2 m like the streets' (meshes.ts). */
const BUSH = (() => {
  const g = new THREE.PlaneGeometry(3000, 3000, 1, 1).rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2)
  return g
})()
const MARK = new THREE.MeshBasicMaterial({ color: '#ffd54f', transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 })
const dummy = new THREE.Object3D()

type Mats = ReturnType<typeof makeWorldMaterials>

/** The open world's materials (its textures, the weather on them), the water's ripples and foam moving. */
function useStreetMaterials(night: boolean) {
  const mats = useMemo(makeWorldMaterials, [])
  useEffect(() => {
    mats.foam.color.set(night ? '#8fa3c8' : '#ffffff')
    mats.water.specular.set(night ? '#8a9ccc' : '#d8ecff')
    mats.water.shininess = night ? 140 : 80
    mats.water.color.set(night ? '#5a6a90' : '#ffffff')
  }, [night, mats])
  useFrame(() => {
    const t = worldTime()
    mats.water.map!.offset.set((t * 0.012) % 1, Math.sin(t * 0.35) * 0.04)
    mats.water.normalMap!.offset.set((t * 0.03) % 1, (t * 0.017) % 1)
    mats.foam.map!.offset.set((t * 0.02) % 1, Math.sin(t * 0.9) * 0.22)
    mats.foam.opacity = 0.55 + Math.sin(t * 0.9) * 0.35
  })
  return mats
}

/** The land drawn like Babi's streets (chunk.ts → the open world's meshes): roads, pavements, kerbs, poles, water, sand, grass, trees, palms. */
function Streets({ geos, chunk, mats }: { geos: Record<string, THREE.BufferGeometry | null>; chunk: ReturnType<typeof quartierMap>['chunk']; mats: Mats }) {
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos])
  return (
    <group>
      {Object.entries(geos).map(([name, g]) => (g ? <mesh key={name} geometry={g} material={mats[(name === 'tinLow' ? 'tin' : name) as keyof Mats] as THREE.Material} receiveShadow={name !== 'contact'} castShadow={name === 'trim'} /> : null))}
      <Trees pts={chunk.trees} bark={mats.bark} leaves={mats.leaves} />
      <Palms pts={chunk.palms} bark={mats.bark} leaves={mats.leaves} />
    </group>
  )
}

/** The cells marked in « Construire », lit over the ground. */
function Marks({ land, marked }: { land: Land; marked: Set<number> }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => [...marked], [marked])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    list.forEach((i, k) => {
      const [x, z] = land.center(i % land.size, Math.floor(i / land.size))
      dummy.position.set(x, 0.25, z)
      dummy.scale.set(land.cell * 0.96, 1, land.cell * 0.96)
      dummy.updateMatrix()
      m.setMatrixAt(k, dummy.matrix)
    })
    m.count = list.length
    m.instanceMatrix.needsUpdate = true
  }, [list, land])
  if (!list.length) return null
  return <instancedMesh key={Math.ceil(list.length / 64)} ref={ref} args={[PLANE, MARK, Math.ceil(list.length / 64) * 64]} frustumCulled={false} renderOrder={5} />
}

/** The house in its yard (the cells « M »): the owner's own house as it built it (build/House), or the game's villa; its door to the road. */
function YardHouse({ land, house, materials, night }: { land: Land; house?: Props['house']; materials?: Material[]; night: boolean }) {
  const cells = useMemo(() => land.all(T.house), [land])
  if (!cells.length || !house?.blocks.length || !materials) return null
  const xs = cells.map((c) => c[0])
  const ys = cells.map((c) => c[1])
  const [ax, az] = land.center(Math.min(...xs), Math.min(...ys))
  const [bx, bz] = land.center(Math.max(...xs), Math.max(...ys))
  // Its front (the gate, +z) to the road below the yard, its back to the yard's far side.
  const yardD = (Math.max(...ys) - Math.min(...ys) + 1) * land.cell
  const cx = (ax + bx) / 2
  const front = (az + bz) / 2 + yardD / 2 - 0.5
  return (
    <group position={[cx - house.w / 2, 0, front - house.d]}>
      <Baked key={night ? 'night' : 'day'} within={120}>
        <BuiltHouse blocks={house.blocks} materials={materials} />
        <HouseDressing blocks={house.blocks} night={night} />
      </Baked>
    </group>
  )
}

/** The way out to Babi: the road carries on past the land's edge, under a sign. */
function Gate({ land, night }: { land: Land; night: boolean }) {
  const cell = land.all(T.gate)[0]
  const sign = useSign('BABI  →', '#ff7a00', '#ffffff', night)
  if (!cell) return null
  const [px, pz] = land.center(cell[0], cell[1])
  return (
    <group position={[px, 0, pz + land.cell / 2]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 5.2, 3, 0]} castShadow>
          <boxGeometry args={[0.4, 6, 0.4]} />
          <meshLambertMaterial color="#5b6068" />
        </mesh>
      ))}
      <Sign s={sign} w={9.6} p={[0, 6.4, 0.25]} />
      <Sign s={sign} w={9.6} p={[0, 6.4, -0.25]} ry={Math.PI} />
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
function Me({ land, me, goal, follow, visiting, decks }: { land: Land; me: Person; goal: XZ | null; follow: React.RefObject<XZ>; visiting: boolean; decks: Map<number, number> }) {
  const house = land.all(T.house)
  const gate = land.all(T.gate)[0]
  // At home: out of the yard's gate, on the road below it. Visiting: come in from Babi, by the road in.
  const startCell: [number, number] = visiting && gate ? [gate[0], gate[1] - 1] : house.length ? [house[0][0] + 1, house[house.length - 1][1] + 1] : [0, 0]
  const w = useWalk(land.center(...startCell))
  const g = useRef<THREE.Group>(null)
  const y = useRef(0)
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
    // Up on a bridge's deck, eased.
    const cell = land.cellOf(x, z)
    const want = cell ? (decks.get(cell[1] * land.size + cell[0]) ?? 0) : 0
    y.current += (want - y.current) * Math.min(1, dt * 6)
    g.current?.position.set(x, y.current, z)
    if (g.current) g.current.rotation.y = w.heading.current
    whereabouts.sim = [x, z]
    whereabouts.simY = y.current
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

/** The sun (or the moon), its shadows round the Sim wherever it walks. */
function Sun({ night, dusk, follow }: { night: boolean; dusk: boolean; follow: React.RefObject<XZ> }) {
  const light = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const [x, z] = follow.current
    l.position.set(x + 60, 110, z + 40)
    l.target.position.set(x, 0, z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={night ? 0.6 : dusk ? 1.1 : 1.7}
      color={night ? '#8fa8ff' : dusk ? '#ffb38a' : '#fff4e0'}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-90}
      shadow-camera-right={90}
      shadow-camera-top={90}
      shadow-camera-bottom={-90}
      shadow-camera-far={300}
      shadow-bias={-0.0006}
      shadow-normalBias={0.04}
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
  const mats = useStreetMaterials(props.night)
  const map = useMemo(() => quartierMap(land), [land])
  const geos = useMemo(() => buildChunk(map.chunk, () => false) as unknown as Record<string, THREE.BufferGeometry | null>, [map])
  const nav = useMemo(() => new Nav([map.chunk]), [map])
  const yard = useMemo(() => {
    const cells = land.all(T.house)
    if (!cells.length) return null
    const xs = cells.map((c) => c[0])
    const ys = cells.map((c) => c[1])
    const [ax, az] = land.center(Math.min(...xs), Math.min(...ys))
    const [bx, bz] = land.center(Math.max(...xs), Math.max(...ys))
    return { at: [(ax + bx) / 2, (az + bz) / 2] as XZ, w: bx - ax + land.cell, d: bz - az + land.cell }
  }, [land])
  const dusk = props.hour >= 17 && props.hour < 19
  return (
    <>
      <SkyDome night={props.night} dusk={dusk} />
      <hemisphereLight args={[props.night ? '#3b4a7a' : '#e8f4ff', props.night ? '#1a2238' : '#6b5a3a', props.night ? 0.45 : 0.9]} />
      <Sun night={props.night} dusk={dusk} follow={follow} />
      <fog attach="fog" args={[props.night ? '#0b1022' : dusk ? '#f2b98c' : '#cfe3ef', 260, 900]} />
      {/* Under it all, round the land: the bush (the land's own grass, sand and water lie on it). */}
      <mesh geometry={BUSH} material={mats.green} position={[0, -0.03, 0]} receiveShadow />
      {/* The yard: beaten earth. */}
      {yard && <mesh geometry={PLANE} material={mats.laterite} position={[yard.at[0], 0.005, yard.at[1]]} scale={[yard.w, 1, yard.d]} receiveShadow />}
      <Streets geos={geos} chunk={map.chunk} mats={mats} />
      <StreetLights nav={nav} night={props.night} />
      <LivingCity nav={nav} focus={follow} seed={`quartier:${props.ownerId}`} hour={props.hour} night={props.night} rain={false} cut={false} busy={0.6} />
      <Marks land={land} marked={props.marked} />
      <YardHouse land={land} house={props.house} materials={props.materials} night={props.night} />
      <Gate land={land} night={props.night} />
      <Boards land={land} boards={props.boards} commune={props.commune} night={props.night} />
      <Me land={land} me={props.me} goal={goal} follow={follow} visiting={props.me.id !== props.ownerId} decks={map.decks} />
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
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 32, 52], fov: 45, near: 0.5, far: 3000 }} style={{ background: props.night ? '#0d1530' : '#cfe8f5', touchAction: 'none' }}>
      <Scene {...props} />
    </Canvas>
  )
}
