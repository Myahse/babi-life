import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Plane, Map as MapIcon } from 'lucide-react'
import { Airliner } from './open/airport'
import { rng } from './themes'
import type { Sim } from '../lib/types'
import { t as tr } from '../lib/i18n'

// On a flight (a trip by plane, backend game/flights.go): instead of the
// map, the plane itself, high over a sea of clouds, the land showing through
// now and then, the sun (or the moon) to the side; what's left of the flight.

const CLOUDS = 220

function Sky({ night }: { night: boolean }) {
  const clouds = useRef<THREE.InstancedMesh>(null)
  const puffs = useMemo(() => {
    const r = rng('vol')
    return [...Array(CLOUDS)].map(() => ({ x: (r() - 0.5) * 900, z: (r() - 0.5) * 900, y: -40 - r() * 14, w: 30 + r() * 60, h: 6 + r() * 10, d: 20 + r() * 50 }))
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const camera = useThree((st) => st.camera)
  const plane = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    // The clouds stream back under the wings (the plane's +z is its nose).
    if (clouds.current) {
      puffs.forEach((c, i) => {
        c.z -= 60 * Math.min(dt, 0.05)
        if (c.z < -450) c.z += 900
        p.set(c.x, c.y, c.z)
        s.set(c.w, c.h, c.d)
        m.compose(p, q, s)
        clouds.current!.setMatrixAt(i, m)
      })
      clouds.current.instanceMatrix.needsUpdate = true
    }
    // A gentle bank and bob; the camera off the wing, swinging slowly round.
    if (plane.current) {
      plane.current.rotation.z = Math.sin(t * 0.3) * 0.06
      plane.current.position.y = Math.sin(t * 0.7) * 0.6
    }
    const a = -0.6 + Math.sin(t * 0.08) * 0.5
    camera.position.set(Math.sin(a) * 70, 14 + Math.sin(t * 0.11) * 4, Math.cos(a) * -70 + 10)
    camera.lookAt(0, 0, 8)
  })
  return (
    <>
      <color attach="background" args={[night ? '#0b1430' : '#7fb8ec']} />
      <fog attach="fog" args={[night ? '#0b1430' : '#a9d0f2', 220, 520]} />
      <hemisphereLight args={[night ? '#5a6aa8' : '#ffffff', night ? '#1a1f33' : '#c8d6e6', night ? 0.9 : 1.3]} />
      <directionalLight position={[80, 60, 30]} intensity={night ? 0.5 : 1.6} color={night ? '#c9d4ff' : '#fff2dc'} />
      {/* The sun (or the moon), far off to the side */}
      <mesh position={[-260, 70, 180]}>
        <sphereGeometry args={[16, 16, 16]} />
        <meshBasicMaterial color={night ? '#f2f4ff' : '#fff3c4'} />
      </mesh>
      {/* The land, far below, through the gaps */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -120, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshLambertMaterial color={night ? '#0f1a12' : '#3f7a3a'} />
      </mesh>
      <instancedMesh ref={clouds} args={[undefined, undefined, CLOUDS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color={night ? '#59617a' : '#ffffff'} />
      </instancedMesh>
      <group ref={plane}>
        <Airliner gear={false} />
      </group>
    </>
  )
}

export function FlightView({ sim, night, onMap }: { sim: Sim; night: boolean; onMap: () => void }) {
  const a = sim.activity!
  const left = Math.max(0, Math.ceil(a.end - sim.gameMinutes))
  const share = Math.min(1, Math.max(0, (sim.gameMinutes - a.start) / Math.max(1, a.end - a.start)))
  return (
    <div className="absolute inset-0 z-20">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 45, near: 1, far: 1200, position: [40, 14, -60] }}>
        <Sky night={night} />
      </Canvas>
      <div className="hud pointer-events-auto absolute top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))] left-1/2 w-[min(380px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] p-3">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <Plane size={18} className="text-[#1d4ed8]" />
          <span className="min-w-0 flex-1 truncate">{a.interaction.label}</span>
          <button className="icon-btn bg-[var(--color-canvas)] !h-9 !w-9" onClick={onMap} aria-label={tr('Voir la carte')}>
            <MapIcon size={16} />
          </button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
          <div className="h-full rounded-full bg-[#1d4ed8] transition-[width] duration-1000" style={{ width: `${share * 100}%` }} />
        </div>
        <div className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">{left > 0 ? tr('Atterrissage dans {left} min', { left }) : tr('Atterrissage…')}</div>
      </div>
    </div>
  )
}
