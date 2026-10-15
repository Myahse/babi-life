import { useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { XZ } from '../world3d/open/geo'
import type { ChunkData } from '../world3d/open/tiles'
import { buildChunk } from '../world3d/open/meshes'
import { makeTextures } from '../world3d/open/textures'
import { blockRing } from '../world3d/open/voxel'
import { Vehicle, type VehicleKind } from '../world3d/vehicles'
import { Landmark } from '../world3d/open/landmarks'
import { fetchChunk } from '../world3d/open/tiles'
import { CHUNK_ZOOM, tileOf, type Origin } from '../world3d/open/geo'
import { Apprenti, Forest, Palms, Trees, legProfile, makeWorldMaterials, type GbakaLeg } from '../world3d/open/OpenWorld'
import { useFrame } from '@react-three/fiber'
import { worldTime } from '../lib/worldClock'
import { useEffect, useRef, useState } from 'react'

// Dev-only lab (/city.html): made-up map buildings (turned, L-shaped, round,
// tiny) put through the real chunk builder, as the open world draws them, and
// the street's vehicles; ?view=cars for the vehicles up close;
// ?view=landmark&id=yop-rue-princesse (&night) for one landmark;
// ?view=map&lat=5.345&lng=-4.082&n=1 for the real map's chunks there
// (OpenFreeMap, no key), n chunks each way, seen from &cam;
// ?view=gbaka&t=… the apprenti's chase down a straight street (t: seconds
// into the cycle, frozen; without t it plays).

const q = new URLSearchParams(location.search)
const view = q.get('view') ?? 'city'
const night = q.has('night')

const rect = (x: number, z: number, w: number, d: number, a = 0): XZ[] =>
  [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), z + u * Math.sin(a) + v * Math.cos(a)] as XZ)
const disc = (x: number, z: number, r: number): XZ[] => [...Array(24)].map((_, i) => [x + Math.cos((i / 24) * Math.PI * 2) * r, z + Math.sin((i / 24) * Math.PI * 2) * r] as XZ)
const ell: XZ[] = [[30, -20], [44, -20], [44, -12], [36, -12], [36, 2], [30, 2]]

// What the map gives, before it's put in blocks (as tiles.ts does).
const FOOTPRINTS: { ring: XZ[]; height: number }[] = [
  { ring: rect(-30, -15, 12, 9, 0.35), height: 3 },
  { ring: rect(-12, -18, 9, 7, -0.6), height: 3 },
  { ring: rect(6, -18, 14, 10, 0.12), height: 12 },
  { ring: ell, height: 6 },
  { ring: disc(-24, 14, 8), height: 9 },
  { ring: rect(0, 14, 18, 9, 0.78), height: 21 },
  { ring: rect(22, 16, 7, 6, 0.2), height: 3 },
  { ring: rect(36, 18, 10, 8, -0.3), height: 6 },
  { ring: rect(-40, 2, 2, 2, 0.5), height: 3 },
  // Small houses: some get a tin roof in steps.
  { ring: rect(-44, -26, 9, 6), height: 3 },
  { ring: rect(-30, -30, 7.5, 6), height: 3 },
  { ring: rect(28, -30, 9, 7.5), height: 3 },
  { ring: rect(46, 30, 7.5, 6), height: 6 },
]

function City() {
  const { meshes, mats } = useMemo(() => {
    const chunk: ChunkData = {
      key: 'lab',
      tx: 0,
      ty: 0,
      box: { x0: -60, z0: -40, x1: 60, z1: 40 },
      roads: [
        { cls: 'primary', pts: [[-60, -2], [60, -4]], width: 10, paved: true, bridge: false },
        { cls: 'residential', pts: [[16, -40], [18, 40]], width: 6, paved: true, bridge: false },
      ],
      buildings: FOOTPRINTS.map((f, i) => {
        const c = f.ring.reduce((s, p) => [s[0] + p[0] / f.ring.length, s[1] + p[1] / f.ring.length] as XZ, [0, 0] as XZ)
        return { ring: blockRing(f.ring, [], c), holes: [], height: f.height, c, tint: (i * 0.37) % 1 }
      }),
      areas: [],
      trees: [],
      palms: [],
      aeroways: [],
      pois: [],
    }
    const t = makeTextures()
    const lambert = (map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ map, ...extra })
    const mats: Record<string, THREE.Material> = {
      walls: lambert(t.wall, { vertexColors: true }),
      inst: lambert(t.inst, { vertexColors: true }),
      entrance: lambert(t.entrance, { vertexColors: true }),
      shop: lambert(t.shop, { vertexColors: true }),
      house: lambert(t.house, { vertexColors: true }),
      trim: lambert(t.plaster, { vertexColors: true, side: THREE.DoubleSide }),
      kerb: lambert(t.plaster, { vertexColors: true }),
      roofs: lambert(t.roof),
      tin: lambert(t.tin, { side: THREE.DoubleSide }),
      contact: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
      asphalt: lambert(t.asphalt, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      laterite: lambert(t.laterite),
      pavement: lambert(t.pavement, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      paint: new THREE.MeshLambertMaterial({ color: '#f4f4f0', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    }
    return { meshes: buildChunk(chunk, () => false), mats }
  }, [])
  return (
    <>
      {Object.entries(meshes).map(([name, g]) => (g && mats[name] ? <mesh key={name} geometry={g} material={mats[name]} castShadow receiveShadow /> : null))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[160, 120]} />
        <meshLambertMaterial color="#cbb38c" />
      </mesh>
    </>
  )
}

const CARS: [VehicleKind, string | undefined, string | undefined][] = [
  ['taxi', undefined, undefined],
  ['woro', '#ffd60a', '#1c7ed6'],
  ['gbaka', '#f4c430', '#00a862'],
  ['car', '#212529', undefined],
  ['car', '#c92a2a', undefined],
  ['moto', '#c92a2a', undefined],
]

function Cars({ z = 0, spread = 6.5 }: { z?: number; spread?: number }) {
  return (
    <>
      {CARS.map(([kind, color, trim], i) => (
        <Vehicle key={i} p={[(i - 2.5) * spread, 0, z]} kind={kind} color={color} trim={trim} seed={i === 4 ? 3 : i} />
      ))}
    </>
  )
}

function LandmarkLab() {
  const cam = (q.get('cam') ?? '45,30,60').split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? '0,2,0').split(',').map(Number) as [number, number, number]
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[night ? '#0d1030' : '#a9d3f0']} />
      <hemisphereLight args={[night ? '#3a4a8a' : '#ffffff', '#b8a27c', night ? 0.35 : 1.2]} />
      <directionalLight position={[40, 80, 30]} intensity={night ? 0.15 : 1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
      <Landmark id={q.get('id') ?? 'yop-rue-princesse'} night={night} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshLambertMaterial color="#cbb38c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 32]} receiveShadow>
        <planeGeometry args={[140, 10]} />
        <meshLambertMaterial color="#55585e" />
      </mesh>
      <OrbitControls target={look} />
    </Canvas>
  )
}

function MapLab() {
  const lat = Number(q.get('lat') ?? 5.345)
  const lng = Number(q.get('lng') ?? -4.082)
  const n = Number(q.get('n') ?? 1)
  const origin: Origin = { lat, lng }
  const mats = useMemo(makeWorldMaterials, [])
  const [chunks, setChunks] = useState<{ key: string; meshes: ReturnType<typeof buildChunk>; data: ChunkData }[]>([])
  useEffect(() => {
    const [tx, ty] = tileOf(lat, lng, CHUNK_ZOOM)
    for (let dx = -n; dx <= n; dx++)
      for (let dy = -n; dy <= n; dy++)
        fetchChunk(origin, tx + dx, ty + dy, '').then((data) => {
          const t0 = performance.now()
          const meshes = buildChunk(data, () => false)
          ;(data as unknown as { ms: number }).ms = Math.round(performance.now() - t0)
          ;(window as unknown as { stats: unknown[] }).stats = [...((window as unknown as { stats?: unknown[] }).stats ?? []), { key: data.key, buildings: data.buildings.length, roads: data.roads.length, trees: data.trees.length, forest: data.forest?.length ?? 0, areas: data.areas.length, meshMs: (data as unknown as { ms: number }).ms }]
          setChunks((c) => [...c, { key: data.key, meshes, data }])
        })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const cam = (q.get('cam') ?? '600,700,900').split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? '0,0,0').split(',').map(Number) as [number, number, number]
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: cam, fov: 45, far: 8000 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.3]} />
      <directionalLight position={[300, 600, 200]} intensity={1.7} />
      {chunks.map((c) => (
        <group key={c.key}>
          {Object.entries(c.meshes).map(([name, g]) => {
            const m = (mats as Record<string, THREE.Material>)[name]
            return g && m ? <mesh key={name} geometry={g} material={m} /> : null
          })}
          <Trees pts={c.data.trees} bark={mats.bark} leaves={mats.leaves} />
          <Forest pts={c.data.forest ?? []} bark={mats.bark} />
          <Palms pts={c.data.palms} bark={mats.bark} leaves={mats.leaves} />
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[8000, 8000]} />
        <meshLambertMaterial color="#cbb38c" />
      </mesh>
      <OrbitControls target={look} />
    </Canvas>
  )
}

/** One gbaka down a straight street: 5 s at the stop, 14 s to go 110 m, and again. */
function GbakaRun() {
  const car = useRef<THREE.Group>(null)
  const leg = useRef<GbakaLeg>({ moving: false, since: 0, go: 14 })
  const [STOP, GO, L] = [5, 14, 110]
  const dist = useMemo(() => legProfile(GO, L), [])
  useFrame(() => {
    const fixed = q.get('t')
    const k = (fixed !== null ? Number(fixed) : worldTime()) % (STOP + GO)
    const l = leg.current
    l.go = GO
    l.d = dist
    l.moving = k >= STOP
    l.since = l.moving ? k - STOP : k
    if (car.current) car.current.position.x = l.moving ? dist(k - STOP) - 40 : -40
  })
  return (
    <group ref={car}>
      <Vehicle p={[0, 0, 0]} kind="gbaka" crew={false} />
      <Apprenti leg={leg} seed={0.3} />
    </group>
  )
}

function GbakaLab() {
  const cam = (q.get('cam') ?? '-30,6,14').split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? '-34,1,0').split(',').map(Number) as [number, number, number]
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[20, 40, 20]} intensity={1.8} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 60]} />
        <meshLambertMaterial color="#cbb38c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[300, 9]} />
        <meshLambertMaterial color="#55585e" />
      </mesh>
      <GbakaRun />
      <OrbitControls target={look} />
    </Canvas>
  )
}

function Lab() {
  if (view === 'gbaka') return <GbakaLab />
  if (view === 'landmark') return <LandmarkLab />
  if (view === 'map') return <MapLab />
  const cars = view === 'cars'
  return (
    <Canvas shadows dpr={[1, 2]} camera={cars ? { position: [4, 6, 30], fov: 40 } : view === 'street' ? { position: [-18, 9, 26], fov: 50 } : { position: [55, 60, 70], fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[40, 80, 30]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} />
      {cars ? (
        <>
          <Cars />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[80, 40]} />
            <meshLambertMaterial color="#8a8f99" />
          </mesh>
        </>
      ) : (
        <>
          <City />
          <Cars z={-1} spread={7} />
        </>
      )}
      <OrbitControls target={cars ? [0, 1, 0] : view === 'street' ? [-10, 3, -6] : [0, 0, 0]} />
    </Canvas>
  )
}

createRoot(document.getElementById('root')!).render(<Lab />)
