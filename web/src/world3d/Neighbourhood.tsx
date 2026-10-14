import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Commune, Player, Sim, World } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { IconTile } from '../components/ui'
import { Building } from './Buildings'
import { BACK_STREET_Z, CROSS_X, EXTENT_X, FAR_CROSS_X, LOT_XS, SIDEWALK, STREET_HALF, layoutCommune, route, type Lot } from './layout'
import { Box, Lamp, Mat, Palm, Tree } from './props'
import { FillerBuilding } from './Fillers'
import { Pedestrians, Traffic, TrafficLights } from './Life'
import { setVehicleNight } from './vehicles'
import { Bande, Fou, Lovers } from './Nightlife'
import { OtherPlayers } from './Players'
import { Walker, type WalkNav } from './Walker'
import { whereabouts } from './whereabouts'
import { SHORE_Z, rng, themeFor, type Theme } from './themes'
import { lifeOf } from '../game/rules'
import { HAPPENING_DOOR, HappeningMarker, HappeningScene, STOPS_TRAFFIC } from './Happenings'

export type Props = {
  world: World
  commune: Commune
  sim: Sim
  moodColor: string
  hour: number
  /** The Sim walks to this place when it changes (nonce lets the same place be picked twice). */
  goTo: { placeId: string; nonce: number } | null
  onArrive: (placeId: string) => void
  onPick: (placeId: string) => void
  busy: { icon: string; kind: string } | null
  /** What is going on in the street right now. */
  happening: { id: string; icon: string; label: string } | null
  /** The place the Sim is busy at when the scene opens (it starts there). */
  stationAt?: string | null
  /** Shown above the player's Sim (their username). */
  nameTag?: string
  /** The place whose door the Sim is standing at after walking with the pad (null when none). */
  onNear?: (placeId: string | null) => void
  /** The pad can't move the Sim (busy doing something). */
  frozen?: boolean
  /** Other players in the commune right now. */
  players?: Player[]
  /** Bumped to bring the camera back on the Sim. */
  recenter?: number
  /** The player moved the camera away from the Sim (true) or it follows again (false). */
  onFreeCamera?: (free: boolean) => void
  onPickPlayer?: (id: string) => void
  /** The open world's close, third-person camera. */
  closeView?: boolean
  /** Talk to someone in the street (the open world's passers-by). */
  onTalk?: (npc: import('./open/OpenWorld').Npc) => void
  /** Someone in the street calls out to the Sim. */
  onCall?: (npc: import('./open/OpenWorld').Npc, text: string) => void
  /** Who the Sim is talking to (they stay put, facing it). */
  talkingTo?: string | null
  /** Buy from a street vendor; resolves to what she says (null if it failed). */
  onStreetBuy?: (vendor: string) => Promise<string | null>
}


/**
 * The commune as a little 3D neighbourhood, seen from an isometric camera that
 * follows the Sim. Click a building (or its label) and the Sim walks there.
 */
export function Neighbourhood(props: Props) {
  const night = props.hour < 6 || props.hour >= 19
  const dusk = props.hour >= 17 && props.hour < 19
  const sky = night ? '#141a3d' : dusk ? '#f7a072' : '#9fd8f5'
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 2]}
      camera={{ position: [30, 32, 30], zoom: 30, near: -300, far: 600 }}
      style={{ background: sky, transition: 'background 1s' }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Suspense fallback={null}>
        <World3D {...props} night={night} dusk={dusk} />
        <NightLights night={night} />
      </Suspense>
    </Canvas>
  )
}

function NightLights({ night }: { night: boolean }) {
  useEffect(() => setVehicleNight(night), [night])
  return null
}

function World3D({ world, commune, sim, moodColor, goTo, onArrive, onPick, busy, night, dusk, happening, stationAt, nameTag, onNear, frozen, hour, players, onPickPlayer, recenter, onFreeCamera }: Props & { night: boolean; dusk: boolean }) {
  const rain = happening?.id === 'pluie'
  const blackout = night && happening?.id === 'delestage'
  const lit = night && !blackout // street lamps and windows
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id
  const lots = useMemo(() => layoutCommune(commune, home), [commune, home])
  const places = useMemo(() => {
    const visit = lots.filter((l) => l.kind !== 'filler')
    // The happening is somewhere the Sim can walk to, like a place.
    return happening ? [...visit, { id: 'happening', kind: 'happening', name: happening.label, x: HAPPENING_DOOR[0], z: HAPPENING_DOOR[1], rot: 0, door: HAPPENING_DOOR, seed: 0 } as Lot] : visit
  }, [lots, happening])
  // Woro-woro in the commune's real colour (none at all on the Plateau).
  const theme = useMemo(() => {
    const t = themeFor(commune.id)
    const w = commune.woro
    return w ? { ...t, woro: w.none ? '' : (w.color ?? t.woro), woroTrim: w.trim } : t
  }, [commune.id, commune.woro])
  // drei's <Html> loses whichever label mounts with the canvas, so labels
  // mount one frame later, once the canvas is in place.
  const [labels, setLabels] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLabels(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const { size, camera } = useThree()
  // For the mini-map and the « Où aller ? » list: the places and the streets.
  useEffect(() => {
    whereabouts.places = places.map((l) => ({ id: l.id, kind: l.kind, name: l.name, door: l.door }))
    const X = EXTENT_X
    whereabouts.roads = [
      [[-X, 0], [X, 0], 10],
      [[-X, -BACK_STREET_Z], [X, -BACK_STREET_Z], 6],
      [[-X, BACK_STREET_Z], [X, BACK_STREET_Z], 6],
      ...[-FAR_CROSS_X, -CROSS_X, CROSS_X, FAR_CROSS_X].map((x) => [[x, -BACK_STREET_Z], [x, BACK_STREET_Z], 8] as [[number, number], [number, number], number]),
    ]
    whereabouts.water = []
  }, [places])
  // The street's ways: the sidewalks to a place's door, the street grid elsewhere.
  const nav = useMemo<WalkNav>(() => {
    const shore = !!theme.waterfront
    return {
      walkable: (x, z) => walkable(x, z, lots, shore),
      route: (a, b, door) => (door ? route(a, b) : streetPath(a, b, (p, q) => clear(p, q, lots, shore))),
      bounds: { x0: -EXTENT_X, x1: EXTENT_X, z0: -BACK_STREET_Z - 30, z1: BACK_STREET_Z + 10 },
    }
  }, [lots, theme.waterfront])

  useEffect(() => {
    // The whole block around you: about 70 m across a computer screen,
    // 52 m along a phone so the Sims stay readable. Pinch to zoom.
    const cam = camera as THREE.OrthographicCamera
    cam.zoom = THREE.MathUtils.clamp(Math.max(size.width, size.height) / (size.width >= 1024 ? 70 : 52), 9, 30)
    cam.updateProjectionMatrix()
  }, [size, camera])

  return (
    <>
      <hemisphereLight args={[night ? '#3a4a8a' : '#ffffff', night ? '#1a1a2e' : '#c9a46b', (night ? 0.6 : 1.15) * (rain ? 0.65 : 1) * (blackout ? 0.6 : 1)]} />
      <directionalLight
        position={night ? [-20, 30, 10] : [25, 40, 15]}
        intensity={(night ? 0.35 : dusk ? 1.1 : 1.6) * (rain ? 0.3 : 1)}
        color={night ? '#8fa8ff' : dusk ? '#ffb38a' : '#fff4e0'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
      <fog attach="fog" args={[rain ? '#8a96a3' : night ? '#141a3d' : dusk ? '#f7a072' : '#9fd8f5', rain ? 50 : 110, rain ? 170 : 260]} />

      {/* Soft shade in corners and at the foot of walls, for depth (not on small phones). */}
      {(typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 4) > 4) && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <N8AO halfRes aoRadius={3} distanceFalloff={1} intensity={night ? 1.5 : 2.4} quality="performance" color="#1a1410" />
        </EffectComposer>
      )}
      <Ground theme={theme} night={night} />
      <Streets theme={theme} night={lit} seed={commune.id} />
      <Backdrop theme={theme} night={night} />
      {!(happening && STOPS_TRAFFIC.has(happening.id)) && <Traffic theme={theme} seed={commune.id} />}
      <TrafficLights />
      {happening && <HappeningScene id={happening.id} seed={commune.id} night={night} />}
      {labels && <HappeningMarker happening={happening} onPick={() => onPick('happening')} />}
      <Pedestrians theme={theme} seed={commune.id} />
      <Lovers seed={commune.id} hour={hour} />
      <Fou seed={commune.id} />
      {sim.gang === 'member' && sim.city === sim.homeCity && sim.commune === sim.homeCommune && <Bande seed={commune.id} />}

      {lots.map((lot) =>
        lot.kind === 'filler' ? (
          <group key={lot.id} position={[lot.x, 0, lot.z]} rotation={[0, lot.rot, 0]}>
            <FillerBuilding type={lot.filler!} seed={lot.seed} night={lit} height={lot.z > 0 ? 0.6 : theme.height} />
          </group>
        ) : (
          <LotView key={lot.id} lot={lot} world={world} night={lit} label={labels} onPick={onPick} />
        ),
      )}

      {players && players.length > 0 && <OtherPlayers players={players} lots={places} labels={labels} onPick={(id) => onPickPlayer?.(id)} />}
      <Walker stage={lifeOf(world, sim).stage?.id ?? 'adulte'} nameTag={nameTag} labels={labels} stationAt={stationAt ?? null} sim={sim} lots={places} nav={nav} moodColor={moodColor} goTo={goTo} onArrive={onArrive} busy={busy} onNear={onNear} frozen={!!frozen} recenter={recenter ?? 0} onFreeCamera={onFreeCamera} />
    </>
  )
}

// Grass strips between neighbouring lots.
const VERGES = LOT_XS.slice(1).filter((x, i) => x - LOT_XS[i] === 16).map((x) => x - 8)

function Ground({ theme, night }: { theme: Theme; night: boolean }) {
  const dim = (c: string) => (night ? new THREE.Color(c).multiplyScalar(0.55).getStyle() : c)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshLambertMaterial color={dim(theme.ground)} />
      </mesh>
      {/* Verges between the lots */}
      {VERGES.flatMap((x) =>
        [-1, 1].map((s) => (
          <mesh key={`${x}${s}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, s * 22]} receiveShadow>
            <planeGeometry args={[2, 30]} />
            <meshLambertMaterial color={dim(theme.grass)} />
          </mesh>
        )),
      )}
    </group>
  )
}

function Streets({ theme, night, seed }: { theme: Theme; night: boolean; seed: string }) {
  const r = rng(`street${seed}`)
  const asphalt = '#3b3f4a'
  const back = theme.side === 'laterite' ? '#b8693c' : asphalt
  const dashes = [...Array(Math.floor((EXTENT_X * 2) / 6))].map((_, i) => -EXTENT_X + i * 6)
  const posts = [...Array(Math.floor(EXTENT_X / 8))].map((_, i) => -EXTENT_X + 8 + i * 16).filter((x) => x < EXTENT_X)
  return (
    <group>
      {/* Boulevard, two lanes each way, kerbs and sidewalks */}
      <Box p={[0, 0.02, 0]} s={[EXTENT_X * 2 + 20, 0.04, STREET_HALF * 2]} c={asphalt} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[0, 0.12, s * (STREET_HALF + 1.3)]} s={[EXTENT_X * 2 + 20, 0.24, 2.6]} c="#d6cdbd" />
          <Box p={[0, 0.13, s * (STREET_HALF + 0.05)]} s={[EXTENT_X * 2 + 20, 0.26, 0.15]} c="#f1f3f5" />
          {/* Back street behind the second row of lots */}
          <Box p={[0, 0.015, s * BACK_STREET_Z]} s={[EXTENT_X * 2 + 20, 0.03, 6]} c={back} />
        </group>
      ))}
      {dashes.map((x) => (
        <Box key={x} p={[x, 0.05, 0]} s={[2.6, 0.02, 0.18]} c="#f1f3f5" />
      ))}
      {/* Cross streets with zebra crossings */}
      {[-FAR_CROSS_X, -CROSS_X, CROSS_X, FAR_CROSS_X].map((x) => (
        <group key={x}>
          <Box p={[x, 0.03, 0]} s={[8, 0.04, BACK_STREET_Z * 2 + 6]} c={asphalt} />
          {[-1, 1].flatMap((s) =>
            [-2.4, -1.2, 0, 1.2, 2.4].map((dx) => <Box key={`${s}${dx}`} p={[x + dx, 0.06, s * (STREET_HALF + 1.3)]} s={[0.7, 0.02, 2.4]} c="#f1f3f5" />),
          )}
        </group>
      ))}
      {/* Street lamps and trees along the sidewalks */}
      {posts.map((x, i) => (
        <group key={x}>
          <Lamp p={[x, 0, (i % 2 ? 1 : -1) * (SIDEWALK + 1.1)]} night={night} />
          <StreetTree kind={theme.trees} p={[x + 8, 0, (i % 2 ? -1 : 1) * (SIDEWALK + 1.1)]} s={0.8 + r() * 0.5} />
        </group>
      ))}
    </group>
  )
}

function StreetTree({ kind, p, s }: { kind: Theme['trees']; p: [number, number, number]; s: number }) {
  if (kind === 'palm' || (kind === 'mixed' && Math.abs(p[0]) % 32 < 16)) return <Palm p={p} h={5 + s * 2} />
  if (kind === 'baobab')
    return (
      <group position={p} scale={s}>
        <mesh position={[0, 2, 0]} castShadow>
          <cylinderGeometry args={[0.9, 1.3, 4, 8]} />
          <Mat color="#8a7461" />
        </mesh>
        <mesh position={[0, 4.6, 0]} castShadow>
          <icosahedronGeometry args={[2.2, 0]} />
          <Mat color="#7a9a3a" />
        </mesh>
      </group>
    )
  return <Tree p={p} s={s} />
}

/** What lies beyond the district: lagoon, sea, mountains, a skyline. */
function Backdrop({ theme, night }: { theme: Theme; night: boolean }) {
  const sea = theme.water === 'sea'
  const water = sea ? (night ? '#16406b' : '#2a9fd6') : night ? '#1c4e80' : '#36b3e0'
  const shore = theme.waterfront ? SHORE_Z : -BACK_STREET_Z - 22
  return (
    <group>
      {theme.water && (
        <group position={[0, 0, shore]}>
          {/* A beach of sand, or a lagoon quay */}
          {sea ? <Box p={[0, 0.02, -4]} s={[600, 0.04, 9]} c="#f2dca6" /> : <Box p={[0, 0.35, -0.5]} s={[600, 0.7, 1.4]} c="#a8a29a" />}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, sea ? -108 : -101]}>
            <planeGeometry args={[600, 200]} />
            <meshLambertMaterial color={water} />
          </mesh>
          <Waves sea={sea} night={night} from={sea ? -8.5 : -1.5} />
          {sea && [-200, -160, -90, -50, -12, 30, 66, 104, 150, 196].map((x, i) => <Palm key={x} p={[x, 0, -3 + (i % 2) * 2]} h={6 + (i % 3)} lean={0.2} />)}
          {[-170, -70, -20, 45, 95, 180].map((x, i) => (
            <Pirogue key={x} p={[x, 0.1, (sea ? -16 : -8) - (i % 2) * 10]} r={i * 0.7} color={['#ff7a00', '#2a6cf0', '#00a862', '#d6336c'][i % 4]} />
          ))}
        </group>
      )}
      {theme.backdrop === 'mountains' &&
        [-260, -160, -90, -20, 50, 130, 230].map((x, i) => (
          <mesh key={x} position={[x, 22 + (i % 2) * 10, -190]}>
            <coneGeometry args={[60 + (i % 3) * 15, 50 + (i % 2) * 22, 6]} />
            <meshLambertMaterial color={night ? '#1e3324' : '#4f7d4a'} flatShading />
          </mesh>
        ))}
      {theme.backdrop === 'forest' &&
        [...Array(42)].map((_, i) => (
          <mesh key={i} position={[-250 + i * 12, 7, -BACK_STREET_Z - 30 - (i % 3) * 8]}>
            <coneGeometry args={[6, 14 + (i % 4) * 3, 6]} />
            <meshLambertMaterial color={night ? '#163020' : i % 2 ? '#2f7a3a' : '#3b8f45'} flatShading />
          </mesh>
        ))}
      {theme.backdrop === 'skyline' &&
        [...Array(24)].map((_, i) => (
          <mesh key={i} position={[-230 + i * 20, 15 + (i % 4) * 7, -160]}>
            <boxGeometry args={[12, 30 + (i % 4) * 14, 12]} />
            <meshLambertMaterial color={night ? '#22304a' : '#9cb4c9'} />
          </mesh>
        ))}
    </group>
  )
}

/** White foam lines rolling onto the beach (or ripples on the lagoon). */
function Waves({ sea, night, from }: { sea: boolean; night: boolean; from: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return
      const t = (clock.elapsedTime * (sea ? 0.25 : 0.12) + i / 4) % 1
      m.position.z = from - (1 - t) * (sea ? 14 : 10)
      ;(m.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * (sea ? 0.8 : 0.35)
    })
  })
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, from]}>
          <planeGeometry args={[600, sea ? 0.7 : 0.25]} />
          <meshBasicMaterial color={night ? '#9fb7d6' : '#ffffff'} transparent opacity={0.6} />
        </mesh>
      ))}
    </>
  )
}

/** A painted fishing pirogue. */
function Pirogue({ p, r, color }: { p: [number, number, number]; r: number; color: string }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <mesh scale={[4.5, 0.6, 0.9]} castShadow>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <Mat color={color} />
      </mesh>
      <Box p={[0, 0.02, 0]} s={[7, 0.08, 1.2]} c="#f8f9fa" />
    </group>
  )
}

export function LotView({ lot, world, night, label, onPick }: { lot: Lot; world: World; night: boolean; label: boolean; onPick: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  const kind = world.kinds[lot.kind]
  const tall = lot.kind === 'office' ? 17 : lot.kind === 'worship' ? 13 : lot.kind === 'nature' ? 11 : 7.5
  return (
    <group position={[lot.x, 0, lot.z]}>
      <group
        rotation={[0, lot.rot, 0]}
        onClick={(e) => (e.stopPropagation(), onPick(lot.id))}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true), (document.body.style.cursor = 'pointer'))}
        onPointerOut={() => (setHover(false), (document.body.style.cursor = ''))}
        scale={hover ? 1.03 : 1}
      >
        <Building kind={lot.kind} name={lot.name} night={night} />
      </group>
      {label && (
        <Html position={[0, tall, 0]} center zIndexRange={[20, 0]}>
          <button
            onClick={() => onPick(lot.id)}
            className={`flex items-center gap-1.5 rounded-xl border border-black/5 bg-white py-1 pr-2.5 pl-1 text-[12.5px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)] transition duration-200 ease-[var(--ease-spring)] hover:scale-110 active:scale-95 ${hover ? 'scale-110' : ''}`}
          >
            <IconTile icon={iconFor(lot.kind === 'home' ? 'house' : kind?.icon ?? '')} colors={kindColors(lot.kind)} size={24} radius={8} />
            {lot.name}
          </button>
        </Html>
      )}
    </group>
  )
}

/** Can the Sim stand here? Not inside a building's lot, not in the water, not off the map. */
function walkable(x: number, z: number, blocks: Lot[], shore: boolean) {
  if (Math.abs(x) > EXTENT_X + 8 || Math.abs(z) > BACK_STREET_Z + 4) return false
  if (shore && z < SHORE_Z + 1.5) return false
  return !blocks.some((b) => Math.abs(x - b.x) < LOT_HALF && Math.abs(z - b.z) < LOT_HALF)
}
const LOT_HALF = 6.6 // a lot is 14 m square; leave a strip to walk between them

/** A straight walk from a to b doesn't go through a building or the water. */
function clear(a: [number, number], b: [number, number], blocks: Lot[], shore: boolean) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5)
  for (let i = 1; i <= n; i++) {
    const t = i / n
    if (!walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, blocks, shore)) return false
  }
  return true
}

// The ways through: the sidewalks and back streets (rows), the cross streets
// and the strips between lots (columns).
const ROWS = [-BACK_STREET_Z, -SIDEWALK, SIDEWALK, BACK_STREET_Z]
const COLS = [-FAR_CROSS_X, -CROSS_X, CROSS_X, FAR_CROSS_X, ...LOT_XS.slice(1).filter((x, i) => x - LOT_XS[i] === 16).map((x) => x - 8)]

/** The shortest walk from a to b along the streets, turning at most a few times. */
function streetPath(a: [number, number], b: [number, number], ok: (p: [number, number], q: [number, number]) => boolean): [number, number][] | null {
  const ways: [number, number][][] = [[a, b], [a, [a[0], b[1]], b], [a, [b[0], a[1]], b]]
  for (const r of ROWS) {
    ways.push([a, [a[0], r], [b[0], r], b])
    for (const c of COLS) ways.push([a, [a[0], r], [c, r], [c, b[1]], b], [a, [c, a[1]], [c, r], [b[0], r], b])
  }
  for (const c of COLS) ways.push([a, [c, a[1]], [c, b[1]], b])
  const length = (w: [number, number][]) => w.slice(1).reduce((t, p, i) => t + Math.abs(p[0] - w[i][0]) + Math.abs(p[1] - w[i][1]), 0)
  let best: [number, number][] | null = null
  for (const w of ways.sort((x, y) => length(x) - length(y))) {
    if (w.slice(1).every((p, i) => ok(w[i], p))) {
      best = w
      break
    }
  }
  return best
}
