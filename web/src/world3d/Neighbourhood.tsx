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
import { HOME_ID, layoutCommune, route, type Lot } from './layout'
import { Box, Lamp, Palm, Vehicle } from './props'

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
}

const SPEED = 9 // world units per second

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
      camera={{ position: [30, 32, 30], zoom: 20, near: -200, far: 400 }}
      style={{ background: sky, transition: 'background 1s' }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <Suspense fallback={null}>
        <World3D {...props} night={night} dusk={dusk} />
      </Suspense>
    </Canvas>
  )
}

function World3D({ world, commune, sim, moodColor, goTo, onArrive, onPick, busy, night, dusk }: Props & { night: boolean; dusk: boolean }) {
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id
  const lots = useMemo(() => layoutCommune(commune, home), [commune, home])
  const water = /lagune|plage|mer|port/i.test(commune.blurb + commune.places.map((p) => p.kind).join(' '))
  const { size, camera } = useThree()

  // Fit the zoom to the screen: phones see a bit less of the street.
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.zoom = THREE.MathUtils.clamp(Math.min(size.width, size.height * 1.3) / 34, 11, 26)
    cam.updateProjectionMatrix()
  }, [size, camera])

  return (
    <>
      <hemisphereLight args={[night ? '#3a4a8a' : '#ffffff', night ? '#1a1a2e' : '#c9a46b', night ? 0.55 : 1.1]} />
      <directionalLight
        position={night ? [-20, 30, 10] : [25, 40, 15]}
        intensity={night ? 0.35 : dusk ? 1.1 : 1.6}
        color={night ? '#8fa8ff' : dusk ? '#ffb38a' : '#fff4e0'}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <fog attach="fog" args={[night ? '#141a3d' : dusk ? '#f7a072' : '#9fd8f5', 90, 180]} />

      <Ground water={water} night={night} />
      <Street night={night} />
      <Traffic />

      {lots.map((lot) => (
        <LotView key={lot.id} lot={lot} world={world} night={night} onPick={onPick} />
      ))}

      <Walker sim={sim} lots={lots} moodColor={moodColor} goTo={goTo} onArrive={onArrive} busy={busy} />
    </>
  )
}

function Ground({ water, night }: { water: boolean; night: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshLambertMaterial color={night ? '#5b4a3a' : '#d9b27c'} />
      </mesh>
      {/* Grass patches between lots */}
      {[-21, 21, -41, 41].flatMap((x) =>
        [-12, 12].map((z) => (
          <mesh key={`${x}${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]} receiveShadow>
            <planeGeometry args={[5, 12]} />
            <meshLambertMaterial color={night ? '#2f5d3a' : '#7cc566'} />
          </mesh>
        )),
      )}
      {water && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -45]}>
          <planeGeometry args={[400, 40]} />
          <meshLambertMaterial color={night ? '#1c4e80' : '#36b3e0'} />
        </mesh>
      )}
    </group>
  )
}

function Street({ night }: { night: boolean }) {
  const dashes = [...Array(26)].map((_, i) => -65 + i * 5.2)
  return (
    <group>
      {/* Main street (X) and cross street (Z) */}
      <Box p={[0, 0.02, 0]} s={[140, 0.04, 7]} c="#3b3f4a" />
      <Box p={[0, 0.03, 0]} s={[7, 0.04, 60]} c="#3b3f4a" />
      {/* Sidewalks */}
      {[-4.4, 4.4].map((z) => (
        <Box key={z} p={[0, 0.1, z]} s={[140, 0.2, 1.8]} c="#cfc6b6" />
      ))}
      {dashes.map((x) => (
        <Box key={x} p={[x, 0.06, 0]} s={[2.4, 0.02, 0.22]} c="#f1f3f5" />
      ))}
      {/* Zebra crossing */}
      {[-2.4, -1.2, 0, 1.2, 2.4].map((x) => (
        <Box key={x} p={[x, 0.06, 4.8]} s={[0.7, 0.02, 2]} c="#f1f3f5" />
      ))}
      {[-55, -42, -24, 24, 42, 55].map((x, i) => (
        <Palm key={x} p={[x, 0, i % 2 ? 4.6 : -4.6]} h={6 + (i % 3)} />
      ))}
      {[-16, 16, -36, 36].map((x, i) => (
        <Lamp key={x} p={[x, 0, i % 2 ? -4.6 : 4.6]} night={night} />
      ))}
      <Vehicle p={[-20, 0, 2]} r={0} kind="taxi" />
      <Vehicle p={[26, 0, -2]} r={Math.PI} kind="taxi" />
    </group>
  )
}

/** A gbaka and a taxi driving up and down the main street. */
function Traffic() {
  const gbaka = useRef<THREE.Group>(null)
  const taxi = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    gbaka.current!.position.x = ((t * 7) % 160) - 80
    taxi.current!.position.x = 80 - ((t * 10 + 60) % 160)
  })
  return (
    <>
      <group ref={gbaka} position={[0, 0, 1.6]}>
        <Vehicle p={[0, 0, 0]} kind="gbaka" />
      </group>
      <group ref={taxi} position={[0, 0, -1.6]}>
        <Vehicle p={[0, 0, 0]} r={Math.PI} kind="taxi" />
      </group>
    </>
  )
}

function LotView({ lot, world, night, onPick }: { lot: Lot; world: World; night: boolean; onPick: (id: string) => void }) {
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
      <Html position={[0, tall, 0]} center zIndexRange={[20, 0]}>
        <button
          onClick={() => onPick(lot.id)}
          className={`flex items-center gap-1.5 rounded-full bg-white/95 py-1 pr-3 pl-1 font-display text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] transition hover:scale-110 ${hover ? 'scale-110' : ''}`}
        >
          <IconTile icon={iconFor(lot.kind === 'home' ? 'house' : kind?.icon ?? '')} colors={kindColors(lot.kind)} size={24} radius={12} />
          {lot.name}
        </button>
      </Html>
    </group>
  )
}

function Walker({ sim, lots, moodColor, goTo, onArrive, busy }: { sim: Sim; lots: Lot[]; moodColor: string; goTo: Props['goTo']; onArrive: Props['onArrive']; busy: Props['busy'] }) {
  const group = useRef<THREE.Group>(null)
  const path = useRef<[number, number][]>([])
  const target = useRef<string | null>(null)
  const [walking, setWalking] = useState(false)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)

  // Start at home if there is one, else at the crossroads.
  useEffect(() => {
    const homeLot = lots.find((l) => l.id === HOME_ID)
    const [x, z] = homeLot ? homeLot.door : [0, 3]
    group.current!.position.set(x, 0, z)
  }, [lots])

  useEffect(() => {
    if (!goTo) return
    const lot = lots.find((l) => l.id === goTo.placeId)
    if (!lot) return
    const p = group.current!.position
    path.current = route([p.x, p.z], lot.door).slice(1)
    target.current = lot.id
    setWalking(true)
  }, [goTo, lots])

  useFrame((_, dt) => {
    const g = group.current!
    if (path.current.length) {
      const [tx, tz] = path.current[0]
      const dx = tx - g.position.x
      const dz = tz - g.position.z
      const dist = Math.hypot(dx, dz)
      const step = Math.min(dist, SPEED * Math.min(dt, 0.05))
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
        minZoom={9}
        maxZoom={40}
        minPolarAngle={0.5}
        maxPolarAngle={1.05}
      />
      <group ref={group}>
        <Character look={sim.look} gender={sim.gender} walking={walking} busy={!!busy} moodColor={moodColor} />
        {busy && (
          <Html position={[0, 4.4, 0]} center zIndexRange={[30, 20]}>
            <div className="animate-pop rounded-full bg-white p-1.5 shadow-lg">
              <IconTile icon={iconFor(busy.icon)} colors={kindColors(busy.kind)} size={34} radius={17} />
            </div>
          </Html>
        )}
      </group>
    </>
  )
}
