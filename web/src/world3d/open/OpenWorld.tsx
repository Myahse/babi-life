import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Human, NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { lifeOf } from '../../game/rules'
import { HAPPENING_DOOR, HAPPENING_X, HappeningMarker, HappeningScene, STOPS_TRAFFIC } from '../Happenings'
import { HOME_ID, type Lot } from '../layout'
import { LotView, type Props } from '../Neighbourhood'
import { useSignTexture } from '../props'
import type { World } from '../../lib/types'
import { iconFor, kindColors } from '../../components/icons'
import { IconTile } from '../../components/ui'
import { Html } from '@react-three/drei'
import { Bande } from '../Nightlife'
import { OtherPlayers } from '../Players'
import { rng } from '../themes'
import { Vehicle, type VehicleKind } from '../vehicles'
import { Walker, type WalkNav } from '../Walker'
import { CHUNK_ZOOM, tileBox, tileOf, toLatLng, toLocal, type Origin, type XZ } from './geo'
import { Nav } from './nav'
import { inTheWay, type PlaceSpot, type Resolved } from './places'
import { makeTextures } from './textures'
import type { ChunkData } from './tiles'
import type { Arrays, ChunkRequest } from './worker'

// The open world: the real Abidjan around the Sim, like Minecraft's — it
// loads chunk by chunk (one map tile, ~610 m) as the Sim walks, and fades
// into the haze at the edge. Streets and buildings come from OpenStreetMap
// (through Mapbox); the game's places stand on the real streets nearest to
// where they really are.

const LOAD_RADIUS = 700 // metres around the Sim (or where the camera looks)
const DROP_RADIUS = 1500
const PARALLEL = 3
const HAPPENING_KEY = 'happening'

type Loaded = { data: ChunkData; geos: Record<string, THREE.BufferGeometry> }

/** What casts a shadow: the buildings, not the roads. */
const SOLID = new Set(['walls', 'shop', 'house', 'trim', 'roofs', 'tin'])

/** Ambient occlusion where the device can afford it (not on small phones). */
const RICH = typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 4) > 4

/** The sun, and its shadows, over wherever the camera looks. */
function Sun({ night, dusk }: { night: boolean; dusk: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const l = light.current
    if (!l) return
    scene.add(l.target)
    return () => void scene.remove(l.target)
  }, [scene])
  useFrame(() => {
    const l = light.current
    if (!l || !controls) return
    const t = controls.target
    // Snap to whole metres so the shadows don't shimmer as the Sim walks.
    const [x, z] = [Math.round(t.x), Math.round(t.z)]
    l.position.set(x + 60, 110, z + 35)
    l.target.position.set(x, 0, z)
  })
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={night ? 0.3 : dusk ? 1.1 : 1.7}
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

export function OpenWorld(props: Props & { token: string; onFail: () => void }) {
  const night = props.hour < 6 || props.hour >= 19
  const dusk = props.hour >= 17 && props.hour < 19
  const sky = night ? '#141a3d' : dusk ? '#f7a072' : '#8ec9f0'
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [45, 48, 45], fov: 45, near: 0.5, far: 2500 }} style={{ background: sky, transition: 'background 1s' }} gl={{ antialias: true }}>
      <Suspense fallback={null}>
        <World {...props} night={night} dusk={dusk} sky={sky} />
      </Suspense>
    </Canvas>
  )
}

function useMaterials(night: boolean) {
  const mats = useMemo(() => {
    const t = makeTextures()
    const lambert = (map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ map, ...extra })
    return {
      walls: lambert(t.wall, { vertexColors: true, emissiveMap: t.lights, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0 }),
      shop: lambert(t.shop, { vertexColors: true }),
      house: lambert(t.house, { vertexColors: true }),
      trim: lambert(t.plaster, { vertexColors: true, side: THREE.DoubleSide }),
      roofs: lambert(t.roof),
      tin: lambert(t.tin, { side: THREE.DoubleSide }),
      contact: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      asphalt: lambert(t.asphalt, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      laterite: lambert(t.laterite, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      pavement: lambert(t.pavement, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      water: lambert(t.water, { transparent: true, opacity: 0.92 }),
      green: lambert(t.grass),
      sand: lambert(t.sand),
      pitch: lambert(t.pitch),
      ground: new THREE.MeshLambertMaterial({ color: '#cbb38c' }),
      bark: lambert(t.bark),
      leaves: lambert(t.leaves),
    }
  }, [])
  useEffect(() => {
    mats.walls.emissiveIntensity = night ? 0.85 : 0
  }, [night, mats])
  return mats
}

function World({ world, commune, sim, moodColor, goTo, onArrive, onPick, busy, night, dusk, sky, happening, stationAt, nameTag, onNear, frozen, players, onPickPlayer, recenter, onFreeCamera, closeView, token, onFail }: Props & { night: boolean; dusk: boolean; sky: string; token: string; onFail: () => void }) {
  const origin = useMemo<Origin>(() => ({ lat: commune.lat, lng: commune.lng }), [commune.lat, commune.lng])
  const mats = useMaterials(night)
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id

  // Where the game's places are on the map, the Sim's home (somewhere in the
  // quarter, the same each time) and the spot of what's happening.
  const spots = useMemo<(PlaceSpot & { kind: string; name: string })[]>(() => {
    const r = rng(`home${sim.id}`)
    const a = r() * Math.PI * 2
    const d = 120 + r() * 260
    const list = commune.places.map((p) => ({ id: p.id, kind: p.kind, name: p.name, at: toLocal(origin, p.lat, p.lng) }))
    if (home) list.unshift({ id: HOME_ID, kind: 'home', name: 'Chez toi', at: [Math.cos(a) * d, Math.sin(a) * d] })
    list.push({ id: HAPPENING_KEY, kind: 'happening', name: '', at: [35, -20] })
    return list
  }, [commune.places, origin, home, sim.id])

  // Chunk streaming, around the Sim (or wherever the camera is looking).
  const [chunks, setChunks] = useState<Map<string, Loaded>>(new Map())
  const [resolved, setResolved] = useState<Map<string, Resolved>>(new Map())
  const pending = useRef(new Map<number, string>())
  const failed = useRef(new Map<string, number>())
  const loadedOnce = useRef(false)
  const worker = useRef<Worker | null>(null)
  const nextId = useRef(1)
  const focus = useRef<XZ>(spots.find((s) => s.id === stationAt)?.at ?? spots.find((s) => s.id === HOME_ID)?.at ?? [0, 0])

  useEffect(() => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<{ id: number; data?: ChunkData; meshes?: Record<string, Arrays>; resolved?: Resolved[]; error?: string }>) => {
      const key = pending.current.get(e.data.id)
      pending.current.delete(e.data.id)
      if (!key) return
      if (e.data.error || !e.data.data) {
        failed.current.set(key, (failed.current.get(key) ?? 0) + 1)
        // Nothing at all loads (no network, a bad token): back to the classic street.
        if (!loadedOnce.current && failed.current.size >= 2) onFail()
        return
      }
      loadedOnce.current = true
      const geos: Record<string, THREE.BufferGeometry> = {}
      for (const [name, a] of Object.entries(e.data.meshes ?? {})) {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(a.position, 3))
        g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2))
        g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3))
        if (a.color) g.setAttribute('color', new THREE.BufferAttribute(a.color, a.colorSize ?? 3))
        g.setIndex(new THREE.BufferAttribute(a.index, 1))
        g.computeBoundingSphere()
        geos[name] = g
      }
      const data = e.data.data
      setChunks((m) => new Map(m).set(key, { data, geos }))
      if (e.data.resolved?.length) setResolved((m) => new Map([...m, ...e.data.resolved!.map((r) => [r.id, r] as const)]))
    }
    return () => w.terminate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const chunksRef = useRef(chunks)
  chunksRef.current = chunks
  const stream = () => {
    const w = worker.current
    if (!w) return
    const [fx, fz] = focus.current
    const ll = toLatLng(origin, focus.current)
    const [cx, cy] = tileOf(ll.lat, ll.lng, CHUNK_ZOOM)
    const wanted: { key: string; tx: number; ty: number; d: number }[] = []
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++) {
        const [tx, ty] = [cx + dx, cy + dy]
        const b = tileBox(origin, tx, ty)
        const d = Math.hypot(Math.max(b.x0 - fx, 0, fx - b.x1), Math.max(b.z0 - fz, 0, fz - b.z1))
        if (d <= LOAD_RADIUS) wanted.push({ key: `${tx}/${ty}`, tx, ty, d })
      }
    wanted.sort((a, b) => a.d - b.d)
    const busy = new Set(pending.current.values())
    for (const c of wanted) {
      if (pending.current.size >= PARALLEL) break
      if (chunksRef.current.has(c.key) || busy.has(c.key) || (failed.current.get(c.key) ?? 0) >= 3) continue
      const id = nextId.current++
      pending.current.set(id, c.key)
      const req: ChunkRequest = { id, origin, tx: c.tx, ty: c.ty, token, places: spots.map(({ id, at, kind }) => ({ id, at, kind })) }
      w.postMessage(req)
    }
    // Far chunks are let go, like Minecraft's render distance.
    const far = [...chunksRef.current.values()].filter(({ data: { box: b } }) => Math.hypot(Math.max(b.x0 - fx, 0, fx - b.x1), Math.max(b.z0 - fz, 0, fz - b.z1)) > DROP_RADIUS)
    if (far.length) {
      for (const c of far) for (const g of Object.values(c.geos)) g.dispose()
      setChunks((m) => {
        const n = new Map(m)
        for (const c of far) n.delete(c.data.key)
        return n
      })
    }
  }
  useEffect(stream, [spots]) // eslint-disable-line react-hooks/exhaustive-deps

  // Going to a place that isn't loaded yet: load the chunks there first.
  const [walkTo, setWalkTo] = useState<Props['goTo']>(null)
  const away = useRef<XZ | null>(null)
  useEffect(() => {
    if (!goTo) return
    if (goTo.placeId === 'happening' || resolvedRef.current.has(goTo.placeId)) {
      away.current = null
      setWalkTo(goTo)
      return
    }
    const s = spots.find((x) => x.id === goTo.placeId)
    if (!s) return
    away.current = s.at
    focus.current = s.at
    stream()
  }, [goTo]) // eslint-disable-line react-hooks/exhaustive-deps
  const resolvedRef = useRef(resolved)
  resolvedRef.current = resolved
  useEffect(() => {
    if (goTo && away.current && resolved.has(goTo.placeId)) {
      away.current = null
      setWalkTo({ ...goTo })
    }
  }, [resolved, goTo])

  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 0.6) return
    tick.current = 0
    if (away.current) focus.current = away.current
    else if (controls) focus.current = [controls.target.x, controls.target.z]
    stream()
  })

  // The few real buildings in the way of a game-made one don't block the way.
  const made = useMemo<XZ[]>(() => [...resolved.values()].filter((r) => !r.real).map((r) => r.center), [resolved])
  const nav = useMemo(() => new Nav([...chunks.values()].map((c) => c.data), (c) => inTheWay(made, c)), [chunks, made])

  // The places, once they stand on a loaded street.
  const lots = useMemo<Lot[]>(
    () =>
      spots
        .filter((s) => s.id !== HAPPENING_KEY && resolved.has(s.id))
        .map((s, i) => {
          const r = resolved.get(s.id)!
          return { id: s.id, kind: s.kind, name: s.name, x: r.center[0], z: r.center[1], rot: r.rot, door: r.door, seed: i, height: r.real?.height }
        }),
    [spots, resolved],
  )
  const spot = resolved.get(HAPPENING_KEY)
  const happeningLot = useMemo<Lot | null>(() => {
    if (!happening || !spot) return null
    // The scene is staged along a street: turn it to the real one.
    const [dx, dz] = [HAPPENING_DOOR[0] - HAPPENING_X, HAPPENING_DOOR[1]]
    const [c, s] = [Math.cos(spot.roadAngle), Math.sin(spot.roadAngle)]
    const door: XZ = [spot.door[0] + dx * c - dz * s, spot.door[1] + dx * s + dz * c]
    return { id: 'happening', kind: 'happening', name: happening.label, x: door[0], z: door[1], rot: 0, door, seed: 0 }
  }, [happening, spot])
  const walkLots = useMemo(() => (happeningLot ? [...lots, happeningLot] : lots), [lots, happeningLot])

  const homeLot = lots.find((l) => l.id === HOME_ID)
  const walkNav = useMemo<WalkNav>(
    () => ({
      walkable: (x, z) => nav.walkable(x, z),
      route: (a, b) => nav.path(a, b),
      start: homeLot?.door ?? (nav.nearest(focus.current)?.at as XZ | undefined),
    }),
    [nav, homeLot],
  )
  // The Sim appears once the street it starts on is there.
  const startId = stationAt && lots.some((l) => l.id === stationAt) ? stationAt : HOME_ID
  const ready = lots.some((l) => l.id === startId) || (!home && nav.nodes.length > 0) || (nav.nodes.length > 0 && !spots.some((s) => s.id === startId))

  const [labels, setLabels] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLabels(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const stopsTraffic = !!happening && STOPS_TRAFFIC.has(happening.id)
  return (
    <>
      <hemisphereLight args={[night ? '#3a4a8a' : '#ffffff', night ? '#1a1a2e' : '#b8a27c', night ? 0.7 : 1.2]} />
      <Sun night={night} dusk={dusk} />
      {RICH && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <N8AO halfRes aoRadius={4} distanceFalloff={1.2} intensity={night ? 1.6 : 2.6} quality="performance" color="#1a1410" />
        </EffectComposer>
      )}
      {/* The haze at the edge of the loaded world: Minecraft's render distance */}
      <fog attach="fog" args={[sky, 280, 760]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={mats.ground} receiveShadow>
        <planeGeometry args={[9000, 9000]} />
      </mesh>

      {[...chunks.values()].map((c) => (
        <group key={c.data.key}>
          {Object.entries(c.geos).map(([name, g]) => (
            <mesh key={name} geometry={g} material={mats[name as keyof typeof mats]} castShadow={SOLID.has(name)} receiveShadow={name !== 'contact'} />
          ))}
          <Trees pts={c.data.trees} bark={mats.bark} leaves={mats.leaves} />
        </group>
      ))}

      {lots.map((lot) =>
        lot.height ? (
          <PlaceSign key={lot.id} lot={lot} world={world} night={night} label={labels} onPick={onPick} />
        ) : (
          <LotView key={lot.id} lot={lot} world={world} night={night} label={labels} onPick={onPick} />
        ),
      )}
      {happening && spot && (
        <group position={[spot.door[0], 0, spot.door[1]]} rotation={[0, -spot.roadAngle, 0]}>
          <group position={[-HAPPENING_X, 0, 0]}>
            <HappeningScene id={happening.id} seed={commune.id} night={night} />
            {labels && <HappeningMarker happening={happening} onPick={() => onPick('happening')} />}
          </group>
        </group>
      )}
      {sim.gang === 'member' && home && homeLot && (
        <group position={[homeLot.door[0] - 42, 0, homeLot.door[1] + 7.4]}>
          <Bande seed={commune.id} />
        </group>
      )}

      {nav.nodes.length > 0 && !stopsTraffic && <RoadTraffic nav={nav} focus={focus} seed={commune.id} woro={commune.woro} />}
      {nav.nodes.length > 0 && <Passersby nav={nav} focus={focus} seed={commune.id} />}
      {players && players.length > 0 && <OtherPlayers players={players} lots={walkLots} labels={labels} onPick={(id) => onPickPlayer?.(id)} />}

      {ready && (
        <Walker
          perspective
          close={!!closeView}
          stage={lifeOf(world, sim).stage?.id ?? 'adulte'}
          nameTag={nameTag}
          labels={labels}
          stationAt={stationAt ?? null}
          sim={sim}
          lots={walkLots}
          nav={walkNav}
          moodColor={moodColor}
          goTo={walkTo}
          onArrive={onArrive}
          busy={busy}
          onNear={onNear}
          frozen={!!frozen}
          recenter={recenter ?? 0}
          onFreeCamera={onFreeCamera}
        />
      )}
    </>
  )
}

/**
 * A place in a real building: its sign over the door, in the colours of its
 * kind, a little awning, and its name on top. The building itself is the
 * real one, as the map has it.
 */
function PlaceSign({ lot, world, night, label, onPick }: { lot: Lot & { height?: number }; world: World; night: boolean; label: boolean; onPick: (id: string) => void }) {
  const [a, b] = kindColors(lot.kind)
  const kind = world.kinds[lot.kind]
  const tex = useSignTexture(lot.kind === 'home' ? 'CHEZ TOI' : lot.name.toUpperCase(), b)
  const [dx, dz] = [Math.sin(lot.rot), Math.cos(lot.rot)]
  return (
    <group position={[lot.door[0] - dx * 1.15, 0, lot.door[1] - dz * 1.15]} rotation={[0, lot.rot, 0]}>
      <group onClick={(e) => (e.stopPropagation(), onPick(lot.id))}>
        {lot.kind !== 'home' && (
          <>
            <mesh position={[0, 3.35, 0.12]}>
              <boxGeometry args={[4.2, 0.8, 0.16]} />
              <meshLambertMaterial map={tex} emissive={night ? '#ffffff' : '#000000'} emissiveMap={tex} emissiveIntensity={night ? 0.6 : 0} />
            </mesh>
            <mesh position={[0, 2.75, 0.75]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[3.6, 0.08, 1.4]} />
              <meshLambertMaterial color={a} />
            </mesh>
          </>
        )}
        {/* The door */}
        <mesh position={[0, 1.05, 0.06]}>
          <boxGeometry args={[1.2, 2.1, 0.08]} />
          <meshLambertMaterial color={lot.kind === 'home' ? '#6b4426' : '#3d4350'} />
        </mesh>
      </group>
      {label && (
        <Html position={[0, (lot.height ?? 6) + 2.2, -2]} center zIndexRange={[20, 0]}>
          <button
            onClick={() => onPick(lot.id)}
            className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-white py-1 pr-2.5 pl-1 text-[12.5px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)] transition duration-200 hover:scale-110 active:scale-95"
          >
            <IconTile icon={iconFor(lot.kind === 'home' ? 'house' : kind?.icon ?? '')} colors={kindColors(lot.kind)} size={24} radius={8} />
            {lot.name}
          </button>
        </Html>
      )}
    </group>
  )
}

/** Minecraft trees: a trunk of blocks and a cube of leaves, instanced. */
function Trees({ pts, bark, leaves }: { pts: XZ[]; bark: THREE.Material; leaves: THREE.Material }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const tops = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    pts.forEach(([x, z], i) => {
      const h = 3 + ((i * 7) % 3)
      trunks.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)))
      tops.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, h + 1.2, z), new THREE.Quaternion(), new THREE.Vector3(4, 3, 4)))
    })
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true
    if (tops.current) tops.current.instanceMatrix.needsUpdate = true
  }, [pts])
  if (!pts.length) return null
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, bark, pts.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={tops} args={[undefined, leaves, pts.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  )
}

type Mover = { path: XZ[]; i: number; t: number; speed: number; x: number; z: number; r: number }

/** Start a trip near the focus on the street network. */
function trip(nav: Nav, focus: XZ, r: () => number, steps: number, minWidth: number): XZ[] {
  for (let k = 0; k < 12; k++) {
    const n = nav.nearest([focus[0] + (r() - 0.5) * 500, focus[1] + (r() - 0.5) * 500], 300)
    if (!n) continue
    const e = nav.edges[n.edge]
    if (e.width < minWidth) continue
    const way = nav.wander(r() < 0.5 ? e.a : e.b, steps, r, minWidth)
    if (way.length > 1) return way
  }
  return []
}

function advance(m: Mover, dt: number) {
  while (m.i < m.path.length - 1) {
    const [ax, az] = m.path[m.i]
    const [bx, bz] = m.path[m.i + 1]
    const len = Math.hypot(bx - ax, bz - az) || 0.01
    m.t += (m.speed * dt) / len
    if (m.t < 1) {
      m.x = ax + (bx - ax) * m.t
      m.z = az + (bz - az) * m.t
      m.r = Math.atan2(bx - ax, bz - az)
      return true
    }
    dt = ((m.t - 1) * len) / m.speed
    m.t = 0
    m.i++
  }
  return false
}

/** Woro-woro, taxis, gbakas and motos on the big streets around the Sim. */
function RoadTraffic({ nav, focus, seed, woro }: { nav: Nav; focus: React.RefObject<XZ>; seed: string; woro?: { color?: string; trim?: string; none?: boolean } }) {
  const cars = useMemo(() => {
    const r = rng(`otraffic${seed}`)
    const kinds: VehicleKind[] = ['taxi', 'woro', 'woro', 'gbaka', 'car', 'car', 'moto']
    return [...Array(16)].map(() => {
      const drawn = kinds[Math.floor(r() * kinds.length)]
      const kind: VehicleKind = drawn === 'woro' && woro?.none ? 'taxi' : drawn
      return { kind, color: kind === 'woro' ? woro?.color : kind === 'car' ? ['#f8f9fa', '#212529', '#adb5bd', '#c92a2a', '#1c7ed6'][Math.floor(r() * 5)] : undefined, trim: kind === 'woro' ? woro?.trim : undefined, seed: r() * 100 }
    })
  }, [seed, woro])
  const r = useMemo(() => rng(`otrips${seed}`), [seed])
  const movers = useRef<Mover[]>([])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    cars.forEach((c, k) => {
      let m = movers.current[k]
      if (!m || !advance(m, step)) {
        const path = trip(nav, focus.current, r, 14, 7)
        m = movers.current[k] = { path, i: 0, t: r(), speed: c.kind === 'gbaka' ? 8 : c.kind === 'moto' ? 11 : 9.5, x: 0, z: 0, r: 0 }
        advance(m, 0)
      }
      const g = refs.current[k]
      if (!g) return
      g.visible = m.path.length > 1
      // Drive on the right: shift to the right of the way.
      const off = 2
      g.position.set(m.x + Math.cos(m.r) * -off, 0, m.z - Math.sin(m.r) * -off)
      g.rotation.y = m.r - Math.PI / 2
    })
  })
  return (
    <>
      {cars.map((c, k) => (
        <group key={k} ref={(g) => void (refs.current[k] = g)}>
          <Vehicle p={[0, 0, 0]} kind={c.kind} color={c.color} trim={c.trim} seed={c.seed} />
        </group>
      ))}
    </>
  )
}

/** People walking the streets around the Sim. */
function Passersby({ nav, focus, seed }: { nav: Nav; focus: React.RefObject<XZ>; seed: string }) {
  const people = useMemo(() => {
    const r = rng(`opeople${seed}`)
    return [...Array(18)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100, side: r() < 0.5 ? -1 : 1 }
    })
  }, [seed])
  const r = useMemo(() => rng(`owalks${seed}`), [seed])
  const movers = useRef<Mover[]>([])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    people.forEach((p, k) => {
      let m = movers.current[k]
      if (!m || !advance(m, step)) {
        const path = trip(nav, focus.current, r, 6, 0)
        m = movers.current[k] = { path, i: 0, t: r(), speed: 1.1 + r() * 0.5, x: 0, z: 0, r: 0 }
        advance(m, 0)
      }
      const g = refs.current[k]
      if (!g) return
      g.visible = m.path.length > 1
      // On the pavement, not in the middle of the road.
      const off = 4.5 * p.side
      g.position.set(m.x + Math.cos(m.r) * off, 0, m.z - Math.sin(m.r) * off)
      g.rotation.y = m.r
    })
  })
  return (
    <NoShadows>
      {people.map((p, k) => (
        <group key={k} ref={(g) => void (refs.current[k] = g)}>
          <Human look={p.look} gender={p.gender} pose="walk" seed={p.seed} />
        </group>
      ))}
    </NoShadows>
  )
}
