import { setSceneActions } from '../world3d/sceneActions'
import { useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { XZ } from '../world3d/open/geo'
import type { ChunkData } from '../world3d/open/tiles'
import { buildChunk } from '../world3d/open/meshes'
import { makeTextures } from '../world3d/open/textures'
import { blockRing } from '../world3d/open/voxel'
import { Vehicle, carModel, type CarModel, type VehicleKind } from '../world3d/vehicles'
import { Landmark, NO_FILL, STADIUM_SOLID } from '../world3d/open/landmarks'
import { CATHEDRAL_SOLID } from '../world3d/open/cathedral'
import { MOSQUE_M6_SOLID } from '../world3d/open/mosqueM6'
import { CameraView } from '../screens/CameraView'
import { IvoireInside } from '../world3d/interior/IvoireInside'
import { MallInside } from '../world3d/interior/MallInside'
import { CathedralInside } from '../world3d/interior/CathedralInside'
import { MosqueM6Inside } from '../world3d/interior/MosqueM6Inside'
import { PyramideInside } from '../world3d/interior/PyramideInside'
import { PalaisCultureInside } from '../world3d/interior/PalaisCultureInside'
import { MuseeInside } from '../world3d/interior/MuseeInside'
import { AssembleeInside } from '../world3d/interior/AssembleeInside'
import { MarcheTreichInside } from '../world3d/interior/MarcheTreichInside'
import { BoulayScene } from '../world3d/interior/BoulayScene'
import { DefiSheet } from '../components/Defi'
import { KineoInside } from '../world3d/interior/KineoInside'
import { AirportInside } from '../world3d/interior/AirportInside'
import { BeachScene } from '../world3d/interior/BeachScene'
import { HotelInside } from '../world3d/interior/HotelInside'
import { Upstairs } from '../world3d/interior/HotelFloors'
import { PLAIN as HOTEL_PLAIN } from '../world3d/interior/hotelStyles'
import { Snapper } from '../world3d/snapshot'
import { usePhotoMode } from '../world3d/photoCam'
import { whereabouts } from '../world3d/whereabouts'
import { ZOO_SOLID } from '../world3d/open/zoo'
import { IVOIRE_SOLID } from '../world3d/open/hotelIvoire'
import { POULMAN_SOLID } from '../world3d/open/poulman'
import { NOUM_SOLID } from '../world3d/open/noum'
import { AZALE_SOLID } from '../world3d/open/azale'
import { RABISSON_SOLID } from '../world3d/open/rabisson'
import { SportField } from '../world3d/open/field'
import { FuelStation } from '../world3d/open/station'
import { StreetStall, type StallKind } from '../world3d/open/stalls'
import { JoinIn, placeIn } from '../world3d/open/joinIn'
import { BusStop } from '../world3d/open/sotra'
import { CableStayed, TollPlaza } from '../world3d/open/bridges'
import { StreetGame } from '../world3d/open/streetFoot'
import { moveObstacle } from '../world3d/obstacles'
import { freezeWorldTime } from '../lib/worldClock'
import { StreetSpot, type StreetPeopleSpot } from '../world3d/open/streetPeople'
import { Grin } from '../world3d/open/streetlife'
import { HAPPENING_ROLES, HappeningScene } from '../world3d/Happenings'
import { homeSpotsOf } from '../world3d/homeSpots'
import KartRace from '../kart/KartRace'
import StreetMatch from '../streetball/StreetMatch'
import { House } from '../world3d/build/House'
import { Chantier } from '../world3d/open/chantier'
import { HomeInside } from '../world3d/HomeInside'
import { FurnitureSet, downstairs } from '../world3d/build/Furniture'
import { Zones } from '../world3d/build/Zones'
import { FamilyScene } from '../avatar/Family'
import { Arena } from '../world3d/interior/Arena'
import { fetchChunk } from '../world3d/open/tiles'
import { CHUNK_ZOOM, tileOf, toLocal, type Origin } from '../world3d/open/geo'
import { LANDMARKS } from '../world3d/open/landmarks'
import { inTheWay, resolvePlaces, type PlaceSpot, type Resolved } from '../world3d/open/places'
import { Apprenti, Forest, Palms, Trees, legProfile, makeWorldMaterials, type GbakaLeg } from '../world3d/open/OpenWorld'
import { Nav } from '../world3d/open/nav'
import { StreetNouchis } from '../world3d/open/nouchis'
import { useFrame } from '@react-three/fiber'
import { worldTime } from '../lib/worldClock'
import { useEffect, useRef, useState } from 'react'
import { Interior } from '../world3d/Interior'
import { Character } from '../world3d/Character'
import { Human } from '../avatar/Human'
import { ChatSheet } from '../components/ChatSheet'
import { npcReact, useNpcReaction } from '../world3d/open/npcReact'
import { OutdoorAction, outdoorLook, outdoorPose } from '../world3d/OutdoorAction'
import { Dressing } from '../world3d/open/dressing'
import { PartyFront } from '../world3d/open/soiree'
import { SOIREE_THEMES } from '../game/soirees'
import { PolicePost } from '../world3d/open/streetlife'
import { BridgeSights } from '../world3d/open/bridges'
import { BridgeLife } from '../world3d/open/bridgeLife'
import { Billboard } from '../world3d/open/billboards'
import { randomLook } from '../avatar/options'
import { NightCityLab, NightStreetLab, PartyLab } from './night'
import { RainSky } from '../world3d/open/rainSky'
import { SkyDome } from '../world3d/open/sky'
import { throwBillets } from '../world3d/clubBillets'
import type { ActionResult, Block, Furniture, HousePlan, Material, Piece, Plot, Sim, World } from '../lib/types'
import { FlightView } from '../world3d/FlightView'

const seededLab = (n: number) => () => ((n = (n * 16807) % 2147483647) / 2147483647)

// Dev-only lab (/city.html): made-up map buildings (turned, L-shaped, round,
// tiny) put through the real chunk builder, as the open world draws them, and
// the street's vehicles; ?view=cars for the vehicles up close;
// ?view=landmark&id=yop-rue-princesse (&night) for one landmark;
// ?view=map&lat=5.345&lng=-4.082&n=1 for the real map's chunks there
// (OpenFreeMap, no key), n chunks each way, seen from &cam; &lm=plateau-stade@5.3283,-4.0185;…
// draws those landmarks where the game would put them, their ground cleared;
// ?view=mosquee (&act=pray|priere-vendredi|visit, &m=6510 a Friday at 12:30) the Mosquée Mohammed VI inside;
// ?view=cathedrale (&act=pray|messe|visit|monter-tour, &m= a game minute: 9240 is a Sunday at 10) the cathedral inside;
// ?view=grin the tea at the grin (&t= seconds, frozen);
// ?view=gbaka&t=… the apprenti's chase down a straight street (t: seconds
// into the cycle, frozen; without t it plays);
// ?view=field&sport=foot|basket (&len=40&wid=20 &night &t= &cam= &target=) a pitch or a court and its match;
// ?view=hoops the playable 3 against 3 under one basket, ?view=foot5 the 5 against 5 (&seed=);
// ?view=family&f=gnambro (&g=homme &seed=3) a family at the birth, in front of its home;
// ?view=interior&kind=home&id=sleep (&housing=villa &g=homme &stage=bebe
// &seed=3 &night) the inside of a place, the Sim doing that activity;
// (&kind=arena: the Palais des Sports, id=play-basket|watch-match);
// ?view=outdoor&id=play-football an outdoor activity's scene around the Sim;
// ?view=dressing&kind=maquis (&name=…) the front of a place, its workers;
// ?view=police the checkpoint on a big road's shoulder;
// ?view=bridge&kind=fhb|cdg|hkb|yop|ado one of the big bridges over a lagoon
// (&cam, &look, &night);
// ?view=party|nightstreet|nightcity: the nights (see night.tsx).
// The interior takes &career=sante&level=1 for a Sim at work (&id=work).

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

/** &private: one of each of the people's own cars (vehicles.tsx carModel), side by side. */
const MODELS: CarModel[] = ['saloon', 'berline', 'suv', '4x4', 'limo']
const modelSeed = (m: CarModel) => [...Array(400).keys()].find((n) => carModel(n) === m) ?? 0

function Cars({ z = 0, spread = 6.5 }: { z?: number; spread?: number }) {
  if (q.has('private'))
    return (
      <>
        {MODELS.map((m, i) => (
          <Vehicle key={m} p={[(i - 2) * spread - 2, 0, z]} kind="car" color={['#f8f9fa', '#1b2a4a', '#212529', '#c9b48a', undefined][i]} seed={modelSeed(m)} />
        ))}
      </>
    )
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
      <Landmark id={q.get('id') ?? 'yop-rue-princesse'} night={night} open={!q.has('closed')} />
      {/* &solid: what a walker can't go through, in red */}
      {q.has('solid') &&
        ({ 'cocody-zoo': ZOO_SOLID, 'cocody-hotel-ivoire': IVOIRE_SOLID, 'plateau-poulman': POULMAN_SOLID, 'plateau-noum': NOUM_SOLID, 'marcory-azale': AZALE_SOLID, 'pb-rabisson': RABISSON_SOLID, 'plateau-cathedrale': CATHEDRAL_SOLID, 'plateau-stade': STADIUM_SOLID, 'treich-mosquee-m6': MOSQUE_M6_SOLID }[q.get('id') ?? ''] ?? []).map((o, i) =>
          'r' in o ? (
            <mesh key={i} position={[o.x, 1.5, o.z]}>
              <cylinderGeometry args={[o.r, o.r, 3, 24]} />
              <meshBasicMaterial color="red" transparent opacity={0.45} />
            </mesh>
          ) : (
            <mesh key={i} position={[o.x, 1.5, o.z]} rotation={[0, o.rot, 0]}>
              <boxGeometry args={[o.hw * 2, 3, o.hd * 2]} />
              <meshBasicMaterial color="red" transparent opacity={0.45} />
            </mesh>
          ),
        )}
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
  // The landmarks asked for (&lm=id@lat,lng;…), placed as the game places them.
  const spots = useMemo<PlaceSpot[]>(
    () =>
      (q.get('lm') ?? '')
        .split(';')
        .filter(Boolean)
        .map((x) => {
          const [id, ll] = x.split('@')
          const [la, ln] = ll.split(',').map(Number)
          return { id, at: toLocal(origin, la, ln), kind: 'landmark', landmark: LANDMARKS[id] ?? 40, name: id }
        }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [marks, setMarks] = useState<Resolved[]>([])
  useEffect(() => {
    const [tx, ty] = tileOf(lat, lng, CHUNK_ZOOM)
    for (let dx = -n; dx <= n; dx++)
      for (let dy = -n; dy <= n; dy++)
        fetchChunk(origin, tx + dx, ty + dy, '').then((data) => {
          const t0 = performance.now()
          const found = resolvePlaces(data, spots)
          if (found.length) setMarks((m) => [...m, ...found])
          const cleared = spots.map((s) => ({ at: s.at, r: s.landmark! }))
          // A fairground's ground: none of the game's own houses (as worker.ts).
          const fairs = spots.flatMap((s) => (NO_FILL[s.id] ? [{ at: s.at, r: NO_FILL[s.id] }] : []))
          if (fairs.length) data.buildings = data.buildings.filter((b) => !b.fill || !fairs.some((f) => Math.hypot(b.c[0] - f.at[0], b.c[1] - f.at[1]) < f.r))
          const meshes = buildChunk(data, (c, ring) => inTheWay([], c, cleared, ring) || ring.some((p) => inTheWay([], p, cleared)))
          ;(data as unknown as { ms: number }).ms = Math.round(performance.now() - t0)
          ;(window as unknown as { stats: unknown[] }).stats = [...((window as unknown as { stats?: unknown[] }).stats ?? []), { key: data.key, buildings: data.buildings.length, roads: data.roads.length, trees: data.trees.length, forest: data.forest?.length ?? 0, areas: data.areas.length, meshMs: (data as unknown as { ms: number }).ms }]
          ;(window as unknown as { chunks: ChunkData[] }).chunks = [...((window as unknown as { chunks?: ChunkData[] }).chunks ?? []), data]
          setChunks((c) => [...c, { key: data.key, meshes, data }])
        })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const cam = (q.get('cam') ?? '600,700,900').split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? '0,0,0').split(',').map(Number) as [number, number, number]
  // &nouchis: the couloirs' nouchis, once every chunk is in (window.__nouchis lists them; whereabouts.sim says round where).
  const all = (2 * n + 1) ** 2
  const nav = useMemo(() => (q.has('nouchis') && chunks.length === all ? new Nav(chunks.map((c) => c.data)) : null), [chunks, all])
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: cam, fov: 45, far: 8000 }} style={{ width: '100vw', height: '100vh' }}>
      {nav && <StreetNouchis nav={nav} seed="lab" />}
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
          {c.data.stations?.map((st, i) => <FuelStation key={i} s={st} night={night} />)}
          <Forest pts={c.data.forest ?? []} bark={mats.bark} />
          <Palms pts={c.data.palms} bark={mats.bark} leaves={mats.leaves} />
        </group>
      ))}
      <BridgeSights chunks={chunks.map((c) => c.data)} night={false} />
      {marks.map((m) => (
        <group key={m.id} position={[m.center[0], 0, m.center[1]]} rotation={[0, m.rot, 0]}>
          <Landmark id={m.id} night={false} />
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

function InteriorLab() {
  if (q.get('t') !== null) freezeWorldTime(Number(q.get('t')))
  const gender = (q.get('g') ?? 'femme') as Sim['gender']
  const sim = useMemo(() => {
    let n = Number(q.get('seed') ?? 3)
    const r = () => ((n = (n * 16807) % 2147483647) / 2147483647)
    return { id: 'lab', firstName: 'Awa', lastName: 'Koné', gender, look: randomLook(gender, r), career: q.get('career') ?? '', careerLevel: Number(q.get('level') ?? 0) } as unknown as Sim
  }, [gender])
  // &billets: a handful thrown over the club's dancers every few seconds (the « Lancer des billets » button).
  useEffect(() => {
    if (!q.has('billets')) return
    const t = setInterval(() => throwBillets(5000), 2500)
    return () => clearInterval(t)
  }, [])
  // &after=<action>: the room first, then the action picked a moment later (the Sim walks over).
  const [id, setId] = useState<string | undefined>(q.get('id') ?? undefined)
  useEffect(() => {
    const later = q.get('after')
    if (!later) return
    const t = setTimeout(() => setId(later), 1500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {q.get('kind') === 'arena' ? (
        <Arena sim={sim} placeId="treich-palais" interactionId={q.get('id') ?? undefined} stage="adulte" />
      ) : (
        <Interior sim={sim} kind={q.get('kind') ?? 'home'} party={q.get('party') ?? undefined} faith={q.get('faith') ?? undefined} placeId={q.get('place') ?? 'lab-place'} interactionId={id} roam={q.has('roam') && !id} housing={q.get('housing') ?? 'cour'} night={night} stage={q.get('stage') ?? 'adulte'} />
      )}
    </div>
  )
}

/**
 * ?view=happening&id=ouverture-boutique: a street happening staged on a plain street (world3d/Happenings.tsx)
 * with the player's Sim at its place in it (HAPPENING_ROLES), as when joining in; &night, &cam=x,y,z.
 */
function HappeningLab() {
  const id = q.get('id') ?? 'ouverture-boutique'
  const look = useMemo(() => randomLook('femme', seededLab(5)), [])
  const r = HAPPENING_ROLES[id]
  const night = q.has('night')
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: (q.get('cam') ?? '6,7,16').split(',').map(Number) as [number, number, number], fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[night ? '#0b1026' : '#cfe9f8']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', night ? 0.35 : 1.2]} />
      <directionalLight position={[10, 20, 8]} intensity={night ? 0.2 : 1.8} castShadow />
      {/* The street: the road, its sidewalks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshLambertMaterial color="#c9b48f" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, 0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 10]} />
        <meshLambertMaterial color="#5c5f66" />
      </mesh>
      <HappeningScene id={id} seed="lab" night={night} />
      {r && (
        <LabRole r={r}>
          <Character look={look} gender="femme" busy pose={r.pose} stage="adulte" />
        </LabRole>
      )}
      <OrbitControls target={(q.get('look') ?? '15,1,3').split(',').map(Number) as [number, number, number]} />
    </Canvas>
  )
}

/** The Sim at its place in the happening; with the cortège, going along with it. */
function LabRole({ r, children }: { r: (typeof HAPPENING_ROLES)[string]; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const m = r.moving?.(worldTime())
    if (!m || !g.current) return
    g.current.position.set(m.x, 0, m.z)
    g.current.rotation.y = m.h
  })
  return (
    <group ref={g} position={[r.at[0], 0, r.at[1]]} rotation={[0, Math.atan2(r.face[0] - r.at[0], r.face[1] - r.at[1]), 0]}>
      {children}
    </group>
  )
}

function OutdoorLab() {
  const id = q.get('id') ?? 'play-football'
  const look = useMemo(() => {
    let n = Number(q.get('seed') ?? 3)
    return randomLook('femme', () => ((n = (n * 16807) % 2147483647) / 2147483647))
  }, [])
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: (q.get('cam') ?? '5,3.2,-4.5').split(',').map(Number) as [number, number, number], fov: 45, far: 9000 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[q.has('rain') ? '#8a96a3' : '#cfe9f8']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 8]} intensity={1.8} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color={/swim|sand|fish/.test(id) ? '#e8d5a3' : /foot|basket|match/.test(id) ? '#4e9a4e' : '#b8b2a3'} />
      </mesh>
      <Character look={outdoorLook(look, id)} gender={(q.get('g') ?? 'femme') as 'femme' | 'homme'} busy pose={outdoorPose(id)} />
      <OutdoorAction id={id} />
      {/* &rain: the downpour and its clouds (world3d/open/rainSky.tsx); &night */}
      {q.has('rain') && <RainSky focus={{ current: [0, 0] }} night={q.has('night')} />}
      {/* &sky: the sky's dome and its clouds too (grey when it rains: one ceiling) */}
      {q.has('sky') && <SkyDome night={q.has('night')} dusk={false} rain={q.has('rain')} />}
      <OrbitControls target={[0, 0.9, 1.2]} />
    </Canvas>
  )
}

function FrontLab() {
  const police = view === 'police'
  // &t=seconds since the game's epoch (a Monday, UTC): the hour of the scene (prayers, the maquis at night).
  const fixed = q.get('t')
  useEffect(() => {
    if (fixed !== null) freezeWorldTime(Number(fixed))
  }, [fixed])
  const cam = (q.get('cam') ?? (police ? '-9,5,9' : '2,4,13')).split(',').map(Number) as [number, number, number]
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#cfe9f8']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 8]} intensity={1.8} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshLambertMaterial color="#b8b2a3" />
      </mesh>
      {police ? (
        <PolicePost spot={{ id: 'lab', at: [0, 0], rot: 0, seed: 0.3 }} />
      ) : (
        <>
          <mesh position={[0, 2, -2.5]}>
            <boxGeometry args={[12, 4, 5]} />
            <meshLambertMaterial color="#e3c9a3" />
          </mesh>
          {q.get('kind') === 'soiree' ? (
            // A player's soirée at the gate (&theme=zouglou, &guests=3).
            <PartyFront party={{ id: 'lab', host: 'h', hostName: q.get('host') ?? 'Awa', theme: q.get('theme') ?? 'coupe-decale', title: SOIREE_THEMES.find((t) => t.id === (q.get('theme') ?? 'coupe-decale'))?.label ?? 'Soirée', city: 'abidjan', commune: 'cocody', ends: '', guests: Number(q.get('guests') ?? 3) }} night={night} />
          ) : (
            <Dressing kind={q.get('kind') ?? 'maquis'} name={q.get('name') ?? ''} faith={q.get('faith') ?? undefined} seed={Number(q.get('seed') ?? 0.37)} night={night} />
          )}
        </>
      )}
      <OrbitControls target={police ? [0, 0.8, 0] : [1.5, 1, 1.5]} />
    </Canvas>
  )
}

const BRIDGE_NAMES: Record<string, string> = {
  fhb: 'Pont Félix Houphouët-Boigny',
  cdg: 'Pont Charles de Gaulle',
  hkb: 'Pont Henri Konan Bédié',
  yop: '4e pont',
  ado: 'Pont Alassane Ouattara',
  plain: 'Pont',
}

function BridgeLab() {
  const kind = q.get('kind') ?? 'fhb'
  const mats = useMemo(() => makeWorldMaterials(), [])
  const chunk = useMemo<ChunkData>(
    () => ({
      key: 'bridge',
      tx: 0,
      ty: 0,
      box: { x0: -420, z0: -120, x1: 420, z1: 120 },
      roads: [
        { cls: 'trunk', pts: [[-420, 0], [-330, 0]], width: 14, paved: true, bridge: false },
        { cls: 'trunk', pts: [[330, 0], [420, 0]], width: 14, paved: true, bridge: false },
        // A point every 10 m, as the map loader does (tiles.ts), so the deck can climb.
        { cls: 'trunk', pts: [...Array(67)].map((_, i) => [-330 + i * 10, 0] as XZ), width: 14, paved: true, bridge: true, name: BRIDGE_NAMES[kind] },
      ],
      buildings: [],
      areas: [{ kind: 'water', rings: [[[-260, -120], [260, -120], [260, 120], [-260, 120]]] }],
      trees: [],
      palms: [],
      aeroways: [],
      pois: [],
    }),
    [kind],
  )
  const meshes = useMemo(() => buildChunk(chunk, () => false), [chunk])
  const cam = (q.get('cam') ?? '120,60,160').split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? '0,6,0').split(',').map(Number) as [number, number, number]
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: cam, fov: 45, far: 8000 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[night ? '#0b1030' : '#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', night ? 0.3 : 1.3]} />
      <directionalLight position={[300, 600, 200]} intensity={night ? 0.2 : 1.7} />
      {Object.entries(meshes).map(([name, g]) => {
        const m = (mats as Record<string, THREE.Material>)[name]
        return g && m ? <mesh key={name} geometry={g} material={m} /> : null
      })}
      <BridgeSights chunks={[chunk]} night={night} />
      <BridgeLife chunks={[chunk]} night={night} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[8000, 8000]} />
        <meshLambertMaterial color="#cbb38c" />
      </mesh>
      <OrbitControls target={look} />
    </Canvas>
  )
}

function Lab() {
  if (view === 'party') return <PartyLab />
  if (view === 'nightstreet') return <NightStreetLab />
  if (view === 'nightcity') return <NightCityLab />
  if (view === 'bridge') return <BridgeLab />
  if (view === 'billboard') return <BillboardLab />
  if (view === 'camera') return <CameraLab />
  if (view === 'dressing' || view === 'police') return <FrontLab />
  if (view === 'outdoor') return <OutdoorLab />
  if (view === 'happening') return <HappeningLab />
  if (view === 'field') return <FieldLab />
  if (view === 'stalls') return <StallsLab />
  if (view === 'tolls') return <TollsLab />
  if (view === 'streetfoot') return <StreetFootLab />
  if (view === 'people') return <PeopleLab />
  if (view === 'grin') {
    if (q.get('t') !== null) freezeWorldTime(Number(q.get('t')))
    return (
      <Canvas dpr={[1, 2]} camera={{ position: [2.6, 2.2, 3.2], fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
        <color attach="background" args={['#cfe9f8']} />
        <hemisphereLight args={['#ffffff', '#b8a27c', 1.3]} />
        <directionalLight position={[5, 8, 4]} intensity={1.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshLambertMaterial color="#c9a77a" />
        </mesh>
        <Grin seed={q.get('seed') ?? 'lab'} />
        {/* &rotate: the camera going slowly round (the films) */}
        <OrbitControls target={[0, 0.6, 0]} autoRotate={q.has('rotate')} autoRotateSpeed={1.4} />
      </Canvas>
    )
  }
  if (view === 'ride') return <RideLab />
  // ?view=flight: on a plane (world3d/FlightView), halfway from Abidjan to Yamoussoukro.
  if (view === 'flight') return <FlightView sim={{ id: 'lab', firstName: 'Awa', gameMinutes: 600, activity: { start: 580, end: 625, interaction: { label: 'Vol Abidjan → Yamoussoukro (Air Lagune)' } } } as unknown as Sim} night={night} onMap={() => undefined} />
  if (view === 'phonecam') return <PhoneCamLab />
  if (view === 'emotes') return <EmotesLab />
  if (view === 'talk') return <TalkLab />
  // &sococe: the Sococé's own supermarket and shops, its Kinéo in the gallery.
  if (view === 'mall') return <MallInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)) } as unknown as Sim} name={q.has('sococe') ? 'Sococé' : q.get('style') === 'palmeraie' ? 'PlaYce Palmeraie' : 'PlaYce Marcory'} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" layout={q.has('sococe') ? { market: 'SOCOCÉ', back: ['PRESSING DES 2 PLATEAUX', 'BOULANGERIE', 'PHONE 225', 'PHARMACIE', 'MODE WAX'], front: ['LIBRAIRIE', 'BEAUTÉ & CO', '', 'CAFÉ DES PLATEAUX'], kineo: true } : q.get('style') ? { style: q.get('style') as 'marcory' | 'palmeraie' } : undefined} view={q.get('cam') ? { cam: q.get('cam')!.split(',').map(Number) as [number, number, number], look: (q.get('look') ?? '0,0,0').split(',').map(Number) as [number, number, number] } : undefined} />
  if (view === 'hotel') return <HotelInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)) } as unknown as Sim} placeId={q.get('id') ?? 'plateau-poulman'} name={q.get('name') ?? 'Hôtel Poulman'} interactionId={q.get('act') ?? undefined} night={night} stage="adulte" />
  // ?view=hotelroom&type=suite&act=rs-poisson: a hotel room (standard, superieure, suite), the Sim doing what's done in it.
  if (view === 'hotelroom') return <Upstairs sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)) } as unknown as Sim} stage="adulte" look={HOTEL_PLAIN} view="room" floor={1} room="101" rooms={undefined} roomType={q.get('type') ?? 'standard'} interactionId={q.get('act') ?? undefined} night={night} onDoor={() => undefined} />
  if (view === 'ivoire') return <IvoireInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  if (view === 'cathedrale') return <CathedralInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 0) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  if (view === 'mosquee') return <MosqueM6Inside sim={{ id: 'lab', firstName: 'Awa', gender: 'homme', look: randomLook('homme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 0) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  if (view === 'palaisculture') return <PalaisCultureInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 600) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  if (view === 'musee') return <MuseeInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 600) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  if (view === 'assemblee') return <AssembleeInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 600) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  if (view === 'grandmarche') return <MarcheTreichInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 600) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  if (view === 'pyramide') return <PyramideInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 600) } as unknown as Sim} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  // ?view=aeroport&act=voir-avions: the FHB's terminal, the Sim doing that (else walking about).
  // &pins: the things to do over their spots (SpotActions), as Play sends them; &pins=clear takes them away after 5 s.
  if (view === 'aeroport' && q.has('pins')) {
    const colors: [string, string] = ['#74c0fc', '#1d4ed8']
    setSceneActions(['voir-avions', 'cafe-aeroport', 'resto-aeroport', 'boutique-aeroport', 'accueillir-arrivees', 'salle-attente'].map((id) => ({ id, label: id, icon: 'plane', colors, note: '3 min' })), (id) => console.log('pick', id))
    if (q.get('pins') === 'clear') setTimeout(() => setSceneActions([], () => undefined), 5000)
  }
  if (view === 'aeroport') return <AirportInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: Number(q.get('m') ?? 610) } as unknown as Sim} name="Aéroport Félix-Houphouët-Boigny" flights={['Yamoussoukro', 'Bouaké', 'San-Pédro', 'Korhogo', 'Man', 'Daloa'].map((toName) => ({ toName }))} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  // ?view=plage&id=bassam-plage&act=swim: on the beach, the Sim doing that (else walking about).
  if (view === 'plage') return <BeachScene sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: 610 } as unknown as Sim} placeId={q.get('id') ?? 'pb-plage'} interactionId={q.get('act') ?? undefined} roam={!q.get('act')} night={night} stage="adulte" />
  // &seance=film:salle:seat (the room), else the lobby.
  if (view === 'kineo') {
    const [film, salle, seat] = (q.get('seance') ?? '').split(':')
    const activity = film ? { kind: 'do', placeId: q.get('id') ?? 'marcory-kineo', seance: { film, salle: Number(salle), seats: [seat] } } : undefined
    return <KineoInside sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: 1200, activity } as unknown as Sim} placeId={q.get('id') ?? 'marcory-kineo'} interactionId={film ? 'seance' : undefined} roam={!film} night={night} stage="adulte" />
  }
  // &act=ski-boulay&defi: the water-ski défi over it (its score not sent anywhere).
  if (view === 'boulay')
    return (
      <div className="relative h-screen w-screen">
        <BoulayScene sim={{ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', seededLab(5)), gameMinutes: 600 } as unknown as Sim} interactionId={q.get('act') ?? 'traversee-boulay'} night={night} stage="adulte" />
        {q.has('defi') && <DefiSheet kind="ski" simId="lab" send={async (score) => ({ outcome: { text: `Défi ${score}/100. Belle sortie.`, money: 0 } }) as unknown as ActionResult} onClose={() => location.reload()} />}
      </div>
    )
  if (view === 'home') return <HomeLab />
  if (view === 'chantier') return <ChantierLab />
  if (view === 'plan') return <PlanLab />
  if (view === 'inside') return <InsideLab />
  if (view === 'hoops' || view === 'foot5') return <StreetMatch sport={view === 'hoops' ? 'basket' : 'foot'} name="Awa" look={randomLook('femme', seededLab(5))} gender="femme" seed={Number(q.get('seed') ?? 7)} onExit={() => location.reload()} />
  if (view === 'kart') return <KartRace name="Awa" look={randomLook('femme', seededLab(5))} gender="femme" onExit={() => location.reload()} />
  if (view === 'stadium') return <StadiumLab />
  if (view === 'family') return <FamilyScene familyId={q.get('f') ?? 'gnambro'} look={randomLook((q.get('g') ?? 'femme') as 'femme', seededLab(Number(q.get('seed') ?? 3)))} gender={(q.get('g') ?? 'femme') as 'femme'} className="!h-screen !w-screen" />
  if (view === 'interior') return <InteriorLab />
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

/** A pitch or a court on its own, and the match on it; ?t= holds the clock. */
function FieldLab() {
  const sport = (q.get('sport') ?? 'foot') as 'foot' | 'basket'
  const [len, wid] = [Number(q.get('len') ?? (sport === 'foot' ? 40 : 28)), Number(q.get('wid') ?? (sport === 'foot' ? 20 : 15))]
  const field = useMemo(() => ({ at: [0, 0] as [number, number], angle: 0, len, wid, sport, map: false }), [len, wid, sport])
  const fixed = q.get('t')
  useEffect(() => {
    if (fixed !== null) freezeWorldTime(Number(fixed))
  }, [fixed])
  const cam = (q.get('cam') ?? `${len * 0.1},${len * 0.55},${len * 0.75}`).split(',').map(Number) as [number, number, number]
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[night ? '#0d1030' : '#a9d3f0']} />
      <hemisphereLight args={[night ? '#3a4a8a' : '#ffffff', '#b8a27c', night ? 0.5 : 1.2]} />
      <directionalLight position={[20, 40, 15]} intensity={night ? 0.2 : 1.8} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshLambertMaterial color="#cbb38c" />
      </mesh>
      <SportField field={field} seed={q.get('seed') ?? 'lab-field'} night={night} withSim={false} />
      <OrbitControls target={(q.get('target') ?? '0,0,0').split(',').map(Number) as [number, number, number]} />
    </Canvas>
  )
}

/** The street sellers side by side, with their customers at an hour (?hour=19). */
function StallsLab() {
  const hour = Number(q.get('hour') ?? 19)
  // ?only=brochette: just that one, in the middle.
  const only = q.get('only') as StallKind | null
  const kinds: StallKind[] = only ? [only] : ['alloco', 'porc', 'cafe', 'the', 'garba', 'brochette', 'loto']
  const cam = (q.get('cam') ?? '0,7,16').split(',').map(Number) as [number, number, number]
  const serve = useMemo(() => {
    if (!q.has('serve') || (only !== 'the' && only !== 'cafe')) return null
    const id = `${only}:lab:0`
    const spot = placeIn({ at: [0, -2], rot: 0 }, 0.95, 2.5, Math.PI, 'drink', 0.05)
    whereabouts.joined = { id, activity: `street-${only}`, spot }
    return spot
  }, [only])
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={1.6} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      {/* ?only=the&serve: the seller serving the Sim on its stool (as when it buys there) */}
      <JoinIn.Provider value={{ doing: serve ? `street-${only}` : undefined }}>
        {kinds.map((kind, i) => (
          <StreetStall key={kind} stall={{ id: `${kind}:lab:${i}`, kind, at: [only ? 0 : (i - 1.5) * 7, -2], rot: 0, seed: (0.3 + i * 0.17) % 1 }} hour={hour} crowd onBuy={only ? async (_v, c) => `Choix : ${c ?? '—'}` : undefined} />
        ))}
      </JoinIn.Provider>
      {serve && (
        <group position={[serve.at[0], serve.y, serve.at[1]]} rotation={[0, serve.rot, 0]}>
          <mesh position={[0, 0.2 - serve.y, -0.05]}>
            <boxGeometry args={[0.38, 0.4, 0.38]} />
            <meshLambertMaterial color="#7a5233" />
          </mesh>
          <Human look={randomLook('homme', () => 0.37)} gender="homme" pose={serve.pose} seed={3} />
        </group>
      )}
      {/* A SITRA stop, and a bus pulled in */}
      <BusStop stop={{ id: 'sotra:lab', at: [0, 7], rot: 0, seed: 0.42, lines: ['11', '19', '44'] }} hour={hour} night={false} />
      <Vehicle p={[-11, 0, 10]} kind="sotra" />
      <OrbitControls target={[0, 1, 0]} />
    </Canvas>
  )
}

/** The two toll plazas side by side, and the 5e pont's pylon (?view=tolls&night). */
function TollsLab() {
  const cam = (q.get('cam') ?? '0,30,90').split(',').map(Number) as [number, number, number]
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 45, far: 3000 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[night ? '#0d1030' : '#a9d3f0']} />
      <hemisphereLight args={[night ? '#3a4a8a' : '#ffffff', '#b8a27c', night ? 0.5 : 1.2]} />
      <directionalLight position={[40, 80, 30]} intensity={night ? 0.2 : 1.6} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshLambertMaterial color="#c9b38c" />
      </mesh>
      <TollPlaza at={[-60, 0]} rot={0} lanes={21} label="Péage du 3e pont · 500 F" night={night} look="hkb" />
      <TollPlaza at={[45, 0]} rot={0} lanes={10} label="Péage du 4e pont" night={night} look="yop" />
      <group position={[0, 0, -260]}>
        <mesh position={[0, 7.4, 0]}>
          <boxGeometry args={[600, 1.2, 24]} />
          <meshLambertMaterial color="#d8d3c8" />
        </mesh>
        <CableStayed way={{ pts: [{ x: -300, y: 8, z: 0 }, { x: 300, y: 8, z: 0 }], cum: [0, 600], len: 600 }} />
      </group>
      <OrbitControls target={(q.get('target') ?? '0,5,0').split(',').map(Number) as [number, number, number]} />
    </Canvas>
  )
}

/** The little maracana in a street, and a car coming through now and then (?view=streetfoot&cam=). */
function StreetFootLab() {
  const cam = (q.get('cam') ?? '0,9,16').split(',').map(Number) as [number, number, number]
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 50 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={1.6} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 8]} />
        <meshLambertMaterial color="#4a4d55" />
      </mesh>
      <StreetGame game={{ id: 'foot:lab:1', at: [0, 0], rot: 0, w: 8, seed: 0.37 }} />
      <LabCar />
      <OrbitControls target={[0, 1, 0]} />
    </Canvas>
  )
}
/**
 * The three street views on a test street (?view=camera&mode=pres|epaule|haut):
 * the camera where Walker.tsx puts it, behind the perso walking down the
 * pavement, the garbadrome and the alloco ahead.
 */
function CameraLab() {
  const mode = q.get('mode') ?? 'epaule'
  // Walker.tsx: [back, up] and the height looked at, per view.
  const [back, up, look] = mode === 'pres' ? [9, 4.2, 1.4] : mode === 'haut' ? [62, 56, 0] : [4.4, 2.5, 1.75]
  const me = useMemo(() => randomLook('femme', ((n) => () => ((n = (n * 16807) % 2147483647) / 2147483647))(11)), [])
  const houses = ['#e9d8b8', '#f2b880', '#c9e4d6', '#f0e3a2', '#d8c6e8', '#f5c9b9', '#b9d7ef', '#efe9df']
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, up, back], fov: 50, far: 2000 }} onCreated={({ camera }) => camera.lookAt(0, look, -6)} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      {/* The street going away from the camera, its pavement, the houses either side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.02, -60]}>
        <planeGeometry args={[7, 200]} />
        <meshLambertMaterial color="#4a4d55" />
      </mesh>
      {Array.from({ length: 24 }, (_, k) => (
        <group key={k}>
          {[-11, 6].map((x, side) => (
            <mesh key={x} position={[x, 2.5 + ((k * 7 + side * 3) % 4), -k * 9 + 10]}>
              <boxGeometry args={[4, 5 + ((k * 7 + side * 3) % 4) * 2, 8.4]} />
              <meshLambertMaterial color={houses[(k + side * 3) % houses.length]} />
            </mesh>
          ))}
        </group>
      ))}
      <StreetStall stall={{ id: 'garba:lab:1', kind: 'garba', at: [3.2, -14], rot: -Math.PI / 2, seed: 0.4 }} hour={12} crowd />
      <StreetStall stall={{ id: 'alloco:lab:2', kind: 'alloco', at: [3.2, -30], rot: -Math.PI / 2, seed: 0.6 }} hour={13} crowd />
      <Vehicle p={[-5, 0, -40]} r={Math.PI / 2} kind="woro" seed={4} />
      {/* The perso, walking away from the camera */}
      <group rotation={[0, Math.PI, 0]}>
        <Character look={me} gender="femme" walking />
      </group>
    </Canvas>
  )
}

/** The ad boards in each format: empty (« TA PUB ICI »), or with an ad (a poster from public/apercu) (?view=billboard&night). */
function BillboardLab() {
  const cam = (q.get('cam') ?? '0,8,42').split(',').map(Number) as [number, number, number]
  const ad = [{ id: 'lab', advertiser: 'Babi Life', title: 'Labo', type: 'image' as const, url: '/apercu/fete.jpg' }]
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: cam, fov: 50 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[night ? '#141836' : '#a9d3f0']} />
      <hemisphereLight args={[night ? '#3a4a8a' : '#ffffff', '#b8a27c', night ? 0.6 : 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={night ? 0.3 : 1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      {/* Every format, empty (« TA PUB ICI »), and the 4×3 with an ad */}
      <Billboard board={{ id: 'a', at: [-22, -6], rot: 0, seed: 0.1, format: '4x3' }} ads={ad} night={night} onSeen={() => undefined} />
      <Billboard board={{ id: 'b', at: [-8, -6], rot: 0, seed: 0.5, format: '4x3' }} ads={[]} night={night} onSeen={() => undefined} />
      <Billboard board={{ id: 'c', at: [14, -14], rot: 0, seed: 0.3, format: 'geant' }} ads={[]} night={night} onSeen={() => undefined} />
      <Billboard board={{ id: 'd', at: [-4, 8], rot: 0, seed: 0.2, format: 'sucette' }} ads={[]} night={night} onSeen={() => undefined} />
      <Billboard board={{ id: 'e', at: [3, 8], rot: 0, seed: 0.6, format: 'sucette' }} ads={ad} night={night} onSeen={() => undefined} />
      <Billboard board={{ id: 'f', at: [0, 2], rot: 0, seed: 0.7, format: 'banderole', span: 11 }} ads={[]} night={night} onSeen={() => undefined} />
      <Billboard board={{ id: 'g', at: [24, 2], rot: -0.5, seed: 0.9, format: 'led' }} ads={[]} night={night} onSeen={() => undefined} />
      <OrbitControls target={[0, 6, 0]} />
    </Canvas>
  )
}

/** Le fou, the pastor and the pupils on a street (?view=people&kind=fou|pasteur|ecole&t=&cam=). */
function PeopleLab() {
  const cam = (q.get('cam') ?? '0,7,14').split(',').map(Number) as [number, number, number]
  const fixed = q.get('t')
  if (fixed !== null) freezeWorldTime(Number(fixed))
  const kind = (q.get('kind') ?? 'pasteur') as StreetPeopleSpot['kind']
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 50 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={1.6} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 8]} />
        <meshLambertMaterial color="#4a4d55" />
      </mesh>
      <StreetSpot spot={{ id: `${kind}:lab:${q.get('id') ?? 1}`, kind, at: [0, 0], rot: 0, w: 8, len: 40, seed: 0.7 }} />
      <OrbitControls target={[0, 1, 0]} />
    </Canvas>
  )
}
/** The Sim on the back of a moto-taxi, as the Walker draws it (?view=ride&cam=). */
/** Every emote at once, each figure with its name (?view=emotes&t=…). */
const LAB_EMOTES = ['wave', 'clap', 'thumbsup', 'shrug', 'laugh', 'cheer', 'dance', 'film', 'dab', 'heart', 'salute', 'facepalm', 'cry', 'kiss', 'bow', 'flex', 'airplane', 'zouglou', 'gweta', 'robot', 'shout', 'moonwalk', 'meditate', 'kneeslide'] as const
function EmotesLab() {
  const fixed = q.get('t')
  if (fixed !== null) freezeWorldTime(Number(fixed))
  const looks = useMemo(() => LAB_EMOTES.map((_, i) => randomLook(i % 2 ? 'homme' : 'femme', seededLab(i + 3))), [])
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 9, 17], fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
        <color attach="background" args={['#a9d3f0']} />
        <hemisphereLight args={['#ffffff', '#b8a27c', 1.3]} />
        <directionalLight position={[10, 20, 12]} intensity={1.4} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[60, 40]} />
          <meshLambertMaterial color="#cbb38c" />
        </mesh>
        {LAB_EMOTES.map((p, i) => (
          <group key={p} position={[(i % 8) * 2.6 - 9.1, 0, Math.floor(i / 8) * 4 - 4]}>
            <Character look={looks[i]} gender={i % 2 ? 'homme' : 'femme'} pose={p} stage="adulte" marker={false} seed={i} />
            <Html position={[0, -0.2, 0.9]} center style={{ font: '700 11px sans-serif', background: '#fff', padding: '1px 5px', borderRadius: 6, whiteSpace: 'nowrap' }}>{p}</Html>
          </group>
        ))}
        <OrbitControls target={[0, 1, 0]} />
      </Canvas>
    </div>
  )
}

/** The phone's camera in the street (?view=phonecam): the Sim on the Rue Princesse, the viewfinder over it. */
/** Talking to a passer-by: the chat sheet (answers made up here) and how they react. */
function TalkLab() {
  const look = useMemo(() => randomLook('homme', seededLab(9)), [])
  const npc = useMemo(() => ({ id: 'lab-npc', name: 'Koffi', gender: 'homme' as const, seed: 7, look }), [look])
  const reaction = useNpcReaction()
  const turn = useRef(0)
  const onSay = async () => {
    await new Promise((r) => setTimeout(r, 500))
    const k = turn.current++
    const mood = (['good', 'bad', 'good', 'bye'] as const)[k % 4]
    npcReact(npc.id, mood)
    return { text: mood === 'bye' ? 'Koffi : « Bon, je te laisse, le travail m\'attend. À plus ! »' : mood === 'good' ? 'Koffi explose de rire : « Ah toi, tu vas me tuer ! »' : 'Koffi : « Toi tu ne connais rien au foot, va jouer aux billes ! »', mood }
  }
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 0.6, 5.5], fov: 40 }} style={{ width: '100vw', height: '100vh' }}>
        <color attach="background" args={['#a9d3f0']} />
        <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
        <directionalLight position={[10, 20, 10]} intensity={1.6} />
        <Human look={look} gender="homme" pose={reaction?.pose ?? 'talk'} seed={7} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshLambertMaterial color="#cbb38c" />
        </mesh>
        <OrbitControls target={[0, -0.4, 0]} />
      </Canvas>
      <ChatSheet npc={npc} simGender="femme" onSay={onSay} onClose={() => location.reload()} grownUp={q.has('grown')} adultAccount={q.has('grown')} />
    </div>
  )
}

function PhoneCamLab() {
  const look = useMemo(() => randomLook('femme', seededLab(5)), [])
  const sim = useMemo(() => ({ id: 'lab', firstName: 'Awa', gender: 'femme', look }) as unknown as Sim, [look])
  const mode = usePhotoMode()
  whereabouts.sim = [0, 20]
  whereabouts.simY = 0
  whereabouts.simHeading = Math.PI
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [8, 6, 30], fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
        <Snapper street />
        <color attach="background" args={['#a9d3f0']} />
        <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
        <directionalLight position={[40, 80, 30]} intensity={1.8} castShadow />
        <Landmark id="yop-rue-princesse" night={false} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[140, 140]} />
          <meshLambertMaterial color="#cbb38c" />
        </mesh>
        <group position={[0, 0, 20]} rotation={[0, Math.PI, 0]}>
          <Character look={look} gender="femme" walking={false} running={false} busy={false} pose={mode ? 'phone' : 'idle'} marker={!mode} stage="adulte" />
        </group>
        <OrbitControls target={[0, 1, 20]} />
      </Canvas>
      <CameraView sim={sim} street onClose={() => location.reload()} onGallery={() => undefined} />
    </div>
  )
}

function RideLab() {
  const cam = (q.get('cam') ?? '3,2,3').split(',').map(Number) as [number, number, number]
  const look = useMemo(() => randomLook('femme', seededLab(5)), [])
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={1.6} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#4a4d55" />
      </mesh>
      <group position={[0, 0, 0.45]} rotation={[0, -Math.PI / 2, 0]}>
        <Vehicle p={[0, 0, 0]} kind="moto" color="#c92a2a" />
      </group>
      <group position={[0, 0.42, -0.15]}>
        <Character look={look} gender="femme" walking={false} running={false} busy={false} pose="sit" stage="adulte" />
      </group>
      <OrbitControls target={[0, 0.8, 0]} />
    </Canvas>
  )
}
/** A built house and its furniture, the Sim on each piece as the open world settles it (?view=home&rot=&cam=). */
const LAB_MATERIALS: Material[] = [
  { id: 'parpaing', label: 'Parpaing', color: '#9a9a94', price: 150, unlock: 0 },
  { id: 'tole', label: 'Tôle', color: '#a9b4bd', price: 120, unlock: 0 },
]
const LAB_FURNITURE: Furniture[] = [
  { id: 'lit', label: 'Lit', icon: 'bed-double', w: 2, d: 2, h: 1, price: 0, comfort: 0, color: '#5a7fbf' },
  { id: 'canape', label: 'Canapé', icon: 'sofa', w: 2, d: 1, h: 1, price: 0, comfort: 0, color: '#7a4a8a' },
  { id: 'gaziniere', label: 'Gazinière', icon: 'cooking-pot', w: 1, d: 1, h: 1, price: 0, comfort: 0, color: '#cfd3d6' },
  { id: 'douche', label: 'Douche', icon: 'shower-head', w: 1, d: 1, h: 2, price: 0, comfort: 0, color: '#9fd3e8' },
  { id: 'table', label: 'Table', icon: 'utensils', w: 1, d: 2, h: 1, price: 0, comfort: 0, color: '#8a5a32' },
]
/** A house from a plan going up on its lot (?view=chantier&k=0.5: the share done): the masons, the scaffolding, the sign. */
function ChantierLab() {
  const cam = (q.get('cam') ?? '7,9,22').split(',').map(Number) as [number, number, number]
  const k = Number(q.get('k') ?? 0.5)
  const plot = useMemo(() => {
    const blocks: Block[] = []
    // The walls three high round an 8 × 8 room, a door at the front, the tin roof on top.
    for (let x = 2; x < 10; x++)
      for (let z = 2; z < 10; z++) {
        const edge = x === 2 || x === 9 || z === 2 || z === 9
        if (edge && !(z === 9 && (x === 5 || x === 6))) for (const y of [0, 1, 2]) blocks.push([x, y, z, 'parpaing'])
        if (edge && z === 9 && (x === 5 || x === 6)) blocks.push([x, 2, z, 'parpaing'])
        blocks.push([x, 3, z, 'tole'])
      }
    const span = 18 * 60000
    const from = Date.now() - k * span
    return { id: 1, simId: 'lab', key: 'lab', blocks, built: 0, furniture: [], lot: { w: 12, d: 12 }, buildFrom: new Date(from).toISOString(), buildUntil: new Date(from + span).toISOString() } as unknown as Plot
  }, [k])
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={1.6} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <group position={[-6, 0, -6]}>
        <Chantier plot={plot} materials={LAB_MATERIALS} w={12} d={12} />
      </group>
      <OrbitControls target={[0, 2, 2]} />
    </Canvas>
  )
}
function HomeLab() {
  const cam = (q.get('cam') ?? '9,14,13').split(',').map(Number) as [number, number, number]
  const rot = Number(q.get('rot') ?? 0.5)
  const plot = useMemo(() => {
    const blocks: Block[] = []
    // Walls round an 8 × 8 room (a door gap at the front), two high.
    for (let x = 2; x < 10; x++)
      for (let z = 2; z < 10; z++) {
        const edge = x === 2 || x === 9 || z === 2 || z === 9
        if (edge && !(z === 9 && (x === 5 || x === 6))) for (const y of [0, 1]) blocks.push([x, y, z, 'parpaing'])
      }
    const furniture: Piece[] = [
      [3, 0, 3, 0, 'lit'],
      [6, 0, 3, 0, 'canape'],
      [8, 0, 3, 1, 'douche'],
      [3, 0, 7, 1, 'gaziniere'],
      [6, 0, 6, 0, 'table'],
    ]
    return { simId: 'lab', blocks, built: 0, furniture, lot: { w: 12, d: 12 }, livable: true } as unknown as Plot
  }, [])
  const spots = useMemo(() => homeSpotsOf(plot, [12, 12], [0, 0], rot, LAB_FURNITURE), [plot, rot])
  const look = useMemo(() => randomLook('femme', seededLab(5)), [])
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[10, 20, 12]} intensity={1.6} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <group rotation={[0, rot, 0]}>
        <group position={[-6, 0, -6]}>
          <House blocks={plot.blocks} materials={LAB_MATERIALS} />
          <FurnitureSet pieces={plot.furniture} catalog={LAB_FURNITURE} />
        </group>
      </group>
      {Object.entries(spots)
        .filter(([id]) => id !== 'nap' && id !== 'call-family' && id !== 'golvo')
        .map(([id, s]) => (
          <group key={id}>
            <group position={[s.at[0], s.y, s.at[1]]} rotation={[0, s.rot, 0]}>
              <group rotation={s.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
                {s.stool && (
                  <mesh position={[0, 0.2 - s.y, -0.05]}>
                    <boxGeometry args={[0.38, 0.4, 0.38]} />
                    <meshLambertMaterial color="#7a5233" />
                  </mesh>
                )}
                <Character look={id === 'shower' ? { ...look, outfit: 'serviette' } : look} gender="femme" walking={false} running={false} busy={false} pose={s.pose} stage="adulte" />
              </group>
            </group>
            <mesh position={[s.from[0], 0.05, s.from[1]]}>
              <boxGeometry args={[0.2, 0.1, 0.2]} />
              <meshBasicMaterial color="#e8432f" />
            </mesh>
          </group>
        ))}
      <OrbitControls target={[0, 0.5, 0]} />
    </Canvas>
  )
}
/** A car down the street every 20 s, registered as moving (as the traffic's are). */
function LabCar() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime() % 20
    const x = -90 + t * 9
    if (ref.current) ref.current.position.set(x, 0, 2)
    moveObstacle('labcar', { x, z: 2, hw: 2.2, hd: 0.9, rot: 0 })
  })
  return (
    <group ref={ref}>
      <Vehicle p={[0, 0, 0]} kind="taxi" seed={3} />
    </group>
  )
}

/**
 * The stadium with a match or a concert on (?view=stadium&kind=match|concert&night&m=40):
 * the agenda is made up here (the API isn't asked), m minutes after the start.
 */
function StadiumLab() {
  const kind = q.get('kind') === 'concert' ? 'concert' : 'match'
  const night = q.has('night')
  const now = worldTime() / 60
  // &m= minutes into the event, or &start= its exact start (game minutes).
  const start = q.has('start') ? Number(q.get('start')) : now - Number(q.get('m') ?? 40)
  // &k= freezes the clock at that minute of the match: the same instant on every reload, for screenshots.
  if (q.has('start') && q.has('k')) freezeWorldTime((start + Number(q.get('k'))) * 60)
  const e = kind === 'match'
    ? { kind, title: 'Babi Sporting – Yop City FC', detail: '', start, end: start + 120, home: 'Babi Sporting', away: 'Yop City FC', homeGoals: [12, 38], awayGoals: [q.has('start') ? 70 : Number(q.get('m') ?? 40) - 0.5] }
    : { kind, title: 'DJ Garba Chaud en concert', detail: '', start, end: start + 210, artist: 'DJ Garba Chaud', genre: 'coupé-décalé' }
  const real = window.fetch
  window.fetch = ((url: RequestInfo, init?: RequestInit) => (String(url).includes('/stadium?') ? Promise.resolve(new Response(JSON.stringify({ now, on: e, agenda: [e] }))) : real(url, init))) as typeof fetch
  const cam = (q.get('cam') ?? '120,70,120').split(',').map(Number) as [number, number, number]
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: cam, fov: 45, far: 2000 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={[night ? '#121530' : '#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', night ? 0.5 : 1.2]} />
      <directionalLight position={[60, 120, 40]} intensity={night ? 0.2 : 1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <Landmark id="plateau-stade" night={night} />
      <OrbitControls target={(q.get('look') ?? '0,5,0').split(',').map(Number) as [number, number, number]} />
    </Canvas>
  )
}

/**
 * A whole house from a plan (game/plans.go), with its floors, garden and
 * pool: ?view=plan&id=villa-grande (a home) or &id=lot:villa-basse (a lot
 * plan), &cut to see inside (the roof and the top of the walls off),
 * &cam=x,y,z. The plans come from the API (VITE_API_URL's /world).
 */
function PlanLab() {
  const id = q.get('id') ?? 'villa'
  const cut = q.has('cut')
  const [world, setWorld] = useState<World | null>(null)
  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8099/api/v1'}/world`).then((r) => r.json()).then(setWorld)
  }, [])
  const plan: HousePlan | undefined = world ? (id.startsWith('lot:') ? world.lotPlans?.find((p) => p.id === id.slice(4)) : world.homePlans?.[id]) : undefined
  if (!world || !plan) return <p style={{ padding: 20 }}>{world ? `Plan inconnu : ${id}` : 'Chargement…'}</p>
  const span = Math.max(plan.w, plan.d)
  const cam = (q.get('cam') ?? `${span * 0.55},${span * 0.95},${span * 1.05}`).split(',').map(Number) as [number, number, number]
  const blocks = cut ? plan.blocks.filter((b) => b[1] < 2) : plan.blocks
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: cam, fov: 45 }} style={{ width: '100vw', height: '100vh' }}>
      <color attach="background" args={['#a9d3f0']} />
      <hemisphereLight args={['#ffffff', '#b8a27c', 1.2]} />
      <directionalLight position={[20, 40, 25]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <group position={[-plan.w / 2, 0, -plan.d / 2]}>
        <House blocks={blocks} materials={world.materials ?? []} />
        {world.furniture && <FurnitureSet pieces={cut ? downstairs(plan.furniture) : plan.furniture} catalog={world.furniture} />}
        <Zones zones={plan.zones} blocks={plan.blocks} furniture={plan.furniture} w={plan.w} d={plan.d} />
      </group>
      <OrbitControls target={[0, 0, 0]} />
    </Canvas>
  )
}

/**
 * Inside a house, on its own screen (world3d/HomeInside): ?view=inside&id=villa-grande
 * (a home plan) or &id=lot:duplex, &act=sleep|shower|cook-attieke|watch-tv|devoirs to
 * see the Sim walk there and do it, &night.
 */
function InsideLab() {
  const id = q.get('id') ?? 'maison'
  const [world, setWorld] = useState<World | null>(null)
  useEffect(() => {
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8099/api/v1'}/world`).then((r) => r.json()).then(setWorld)
  }, [])
  const sim = useMemo(() => ({ id: 'lab', firstName: 'Awa', gender: 'femme', look: randomLook('femme', () => 0.37) }) as unknown as Sim, [])
  const plan: HousePlan | undefined = world ? (id.startsWith('lot:') ? world.lotPlans?.find((p) => p.id === id.slice(4)) : world.homePlans?.[id]) : undefined
  const plot = useMemo<Plot | undefined>(() => (plan ? { id: 0, key: 'lab', simId: 'lab', blocks: plan.blocks, furniture: plan.furniture, zones: plan.zones, built: 0, lot: { w: plan.w, d: plan.d, area: plan.w * plan.d, city: '', commune: '', paid: 0 }, livable: true } : undefined), [plan])
  if (!world || !plot) return <p style={{ padding: 20 }}>{world ? `Plan inconnu : ${id}` : 'Chargement…'}</p>
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <HomeInside sim={sim} world={world} plot={plot} interactionId={q.get('act') ?? undefined} roam night={q.has('night')} stage={q.get('stage') ?? 'adulte'} partner={q.has('partner') ? { id: 'p-lab', name: 'Koffi', gender: 'homme', seed: 3, commune: '', friendship: 90, met: 0, seen: 0, adult: true, partner: true, home: true } : undefined} />
    </div>
  )
}
