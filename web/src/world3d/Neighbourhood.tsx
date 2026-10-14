import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Commune, Sim, World } from '../lib/types'
import { iconFor, kindColors } from '../components/icons'
import { IconTile } from '../components/ui'
import { Building } from './Buildings'
import { Character } from './Character'
import { BACK_STREET_Z, CROSS_X, EXTENT_X, HOME_ID, SIDEWALK, STREET_HALF, layoutCommune, route, type Lot } from './layout'
import { moveInput } from './input'
import { Box, Lamp, Mat, Palm, Tree } from './props'
import { FillerBuilding } from './Fillers'
import { Pedestrians, Traffic, TrafficLights } from './Life'
import { Fou, Lovers } from './Nightlife'
import { SHORE_Z, rng, themeFor, type Theme } from './themes'
import { lifeOf } from '../game/rules'
import { HAPPENING_DOOR, HappeningMarker, HappeningScene, STOPS_TRAFFIC } from './Happenings'

type Props = {
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
}

const SPEED = 4.2 // metres per second: a brisk walk, so errands don't drag

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
      </Suspense>
    </Canvas>
  )
}

function World3D({ world, commune, sim, moodColor, goTo, onArrive, onPick, busy, night, dusk, happening, stationAt, nameTag, onNear, frozen, hour }: Props & { night: boolean; dusk: boolean }) {
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

      {lots.map((lot) =>
        lot.kind === 'filler' ? (
          <group key={lot.id} position={[lot.x, 0, lot.z]} rotation={[0, lot.rot, 0]}>
            <FillerBuilding type={lot.filler!} seed={lot.seed} night={lit} height={lot.z > 0 ? 0.6 : theme.height} />
          </group>
        ) : (
          <LotView key={lot.id} lot={lot} world={world} night={lit} label={labels} onPick={onPick} />
        ),
      )}

      <Walker scale={lifeOf(world, sim).stage?.scale ?? 1} nameTag={nameTag} labels={labels} stationAt={stationAt ?? null} sim={sim} lots={places} blocks={lots} shore={!!theme.waterfront} moodColor={moodColor} goTo={goTo} onArrive={onArrive} busy={busy} onNear={onNear} frozen={!!frozen} />
    </>
  )
}

function Ground({ theme, night }: { theme: Theme; night: boolean }) {
  const dim = (c: string) => (night ? new THREE.Color(c).multiplyScalar(0.55).getStyle() : c)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshLambertMaterial color={dim(theme.ground)} />
      </mesh>
      {/* Verges between the lots */}
      {[-48, -32, -16, 0, 16, 32, 48, -80, -96, 80, 96].flatMap((x) =>
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
  const posts = [...Array(15)].map((_, i) => -112 + i * 16)
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
      {[-CROSS_X, CROSS_X].map((x) => (
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
          {sea && [-90, -50, -12, 30, 66, 104].map((x, i) => <Palm key={x} p={[x, 0, -3 + (i % 2) * 2]} h={6 + (i % 3)} lean={0.2} />)}
          {[-70, -20, 45, 95].map((x, i) => (
            <Pirogue key={x} p={[x, 0.1, (sea ? -16 : -8) - (i % 2) * 10]} r={i * 0.7} color={['#ff7a00', '#2a6cf0', '#00a862', '#d6336c'][i]} />
          ))}
        </group>
      )}
      {theme.backdrop === 'mountains' &&
        [-160, -90, -20, 50, 130].map((x, i) => (
          <mesh key={x} position={[x, 22 + (i % 2) * 10, -190]}>
            <coneGeometry args={[60 + (i % 3) * 15, 50 + (i % 2) * 22, 6]} />
            <meshLambertMaterial color={night ? '#1e3324' : '#4f7d4a'} flatShading />
          </mesh>
        ))}
      {theme.backdrop === 'forest' &&
        [...Array(26)].map((_, i) => (
          <mesh key={i} position={[-150 + i * 12, 7, -BACK_STREET_Z - 30 - (i % 3) * 8]}>
            <coneGeometry args={[6, 14 + (i % 4) * 3, 6]} />
            <meshLambertMaterial color={night ? '#163020' : i % 2 ? '#2f7a3a' : '#3b8f45'} flatShading />
          </mesh>
        ))}
      {theme.backdrop === 'skyline' &&
        [...Array(14)].map((_, i) => (
          <mesh key={i} position={[-130 + i * 20, 15 + (i % 4) * 7, -160]}>
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

function LotView({ lot, world, night, label, onPick }: { lot: Lot; world: World; night: boolean; label: boolean; onPick: (id: string) => void }) {
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
const NEAR_DOOR = 2.6 // metres from a door to be "at" a place

function Walker({ sim, scale, lots, blocks, shore, moodColor, goTo, onArrive, busy, stationAt, nameTag, labels, onNear, frozen }: { sim: Sim; scale: number; lots: Lot[]; blocks: Lot[]; shore: boolean; moodColor: string; goTo: Props['goTo']; onArrive: Props['onArrive']; busy: Props['busy']; stationAt: string | null; nameTag?: string; labels: boolean; onNear?: Props['onNear']; frozen: boolean }) {
  const group = useRef<THREE.Group>(null)
  const path = useRef<[number, number][]>([])
  const target = useRef<string | null>(null)
  const [walking, setWalking] = useState(false)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)

  // Start where the Sim is busy, else at home, else on the sidewalk. Only
  // once: the place list changes later (a happening starts, an activity
  // ends) and the Sim must never teleport.
  const placed = useRef(false)
  useEffect(() => {
    if (placed.current) return
    const at = lots.find((l) => l.id === stationAt) ?? lots.find((l) => l.id === HOME_ID)
    const [x, z] = at?.door ?? [0, SIDEWALK]
    group.current!.position.set(x, 0, z)
    if (at) group.current!.rotation.y = at.z < 0 ? Math.PI : 0
    placed.current = true
  }, [lots, stationAt])

  useEffect(() => {
    if (!goTo) return
    const lot = lots.find((l) => l.id === goTo.placeId)
    if (!lot) return
    const p = group.current!.position
    path.current = route([p.x, p.z], lot.door).slice(1)
    target.current = lot.id
    setWalking(true)
  }, [goTo, lots])

  const near = useRef<string | null>(null)
  const padWalking = useRef(false)
  useFrame((_, dt) => {
    const g = group.current!
    // The pad (or the keyboard) walks the Sim freely, relative to the camera.
    const input = moveInput()
    const strength = Math.min(1, Math.hypot(input.x, input.y))
    if (!frozen && strength > 0.05) {
      path.current = []
      target.current = null
      const fwd = new THREE.Vector3(controls ? controls.target.x - camera.position.x : -1, 0, controls ? controls.target.z - camera.position.z : -1).normalize()
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
      const dir = right.multiplyScalar(input.x).add(fwd.multiplyScalar(input.y)).normalize()
      const step = SPEED * strength * Math.min(dt, 0.25)
      const [x, z] = [g.position.x + dir.x * step, g.position.z + dir.z * step]
      // Slide along walls: try the full step, then each axis on its own.
      if (walkable(x, z, blocks, shore)) g.position.set(x, 0, z)
      else if (walkable(x, g.position.z, blocks, shore)) g.position.x = x
      else if (walkable(g.position.x, z, blocks, shore)) g.position.z = z
      g.rotation.y = Math.atan2(dir.x, dir.z)
      if (!padWalking.current) {
        padWalking.current = true
        setWalking(true)
      }
    } else if (padWalking.current) {
      padWalking.current = false
      setWalking(false)
    }
    // Standing at a door: offer to go in.
    if (onNear) {
      let best: Lot | null = null
      let bestD = NEAR_DOOR
      for (const l of lots) {
        const d = Math.hypot(l.door[0] - g.position.x, l.door[1] - g.position.z)
        if (d < bestD) [best, bestD] = [l, d]
      }
      const id = path.current.length ? null : (best?.id ?? null)
      if (id !== near.current) {
        near.current = id
        onNear(id)
      }
    }
    if (path.current.length) {
      const [tx, tz] = path.current[0]
      const dx = tx - g.position.x
      const dz = tz - g.position.z
      const dist = Math.hypot(dx, dz)
      // Real speed even at a low frame rate (cheap phones): only cap huge gaps, like a tab switch.
      const step = Math.min(dist, SPEED * Math.min(dt, 0.25))
      if (dist < 0.05) {
        path.current.shift()
        if (!path.current.length) {
          setWalking(false)
          // Face the building and hand over to the action menu.
          const lot = lots.find((l) => l.id === target.current)
          if (lot) g.rotation.y = lot.z < 0 ? Math.PI : 0
          if (target.current) onArrive(target.current)
        }
      } else {
        g.position.x += (dx / dist) * step
        g.position.z += (dz / dist) * step
        g.rotation.y = Math.atan2(dx, dz)
      }
    }
    // Camera follows the Sim, keeping whatever angle the player chose.
    if (controls) {
      const want = new THREE.Vector3(g.position.x, 0, g.position.z)
      const delta = want.sub(controls.target).multiplyScalar(0.08)
      controls.target.add(delta)
      camera.position.add(delta)
      controls.update()
    }
  })

  return (
    <>
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        minZoom={8}
        maxZoom={70}
        minPolarAngle={0.5}
        maxPolarAngle={1.05}
      />
      <group ref={group}>
        <Character look={sim.look} gender={sim.gender} walking={walking} busy={!!busy} moodColor={moodColor} scale={scale} />
        {labels && nameTag && (
          <Html position={[0, 2.45, 0]} center zIndexRange={[28, 20]}>
            <span className="pointer-events-none rounded-md bg-[#0f1230]/80 px-1.5 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white">{nameTag}</span>
          </Html>
        )}
        {labels && (
          // Always mounted, content toggled: drei's <Html> breaks when unmounted mid-scene.
          <Html position={[0, 2.95, 0]} center zIndexRange={[30, 20]}>
            {busy ? (
              <div className="motion-pop">
                <div className="motion-breathe rounded-2xl border border-black/5 bg-white p-1 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]">
                  <IconTile icon={iconFor(busy.icon)} colors={kindColors(busy.kind)} size={32} radius={11} />
                </div>
              </div>
            ) : (
              <span />
            )}
          </Html>
        )}
      </group>
    </>
  )
}
