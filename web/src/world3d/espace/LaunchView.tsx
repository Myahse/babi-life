import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Rocket, Map as MapIcon } from 'lucide-react'
import type { Sim } from '../../lib/types'
import { t as tr } from '../../lib/i18n'
import { isSpaceCity } from '../../lib/espace'
import { BlockCapsule, BlockEarth, BlockRocket, Stars } from './placeholders'

// A trip by rocket (trip.mode 'fusee', backend sims/espace.go): workstream A's placeholder. Before the launch, the
// Calao on its pad and the countdown; then the ascent, the sky going black; coming back, the capsule under its
// parachutes over the sea (or the steppe). C's LaunchView (the T-10, the staging, the orbit) and Retour replace it.

type Phase = 'pad' | 'ascent' | 'return'

function Scene({ phase, since, steppe }: { phase: Phase; since: number; steppe: boolean }) {
  const rocket = useRef<THREE.Group>(null)
  const capsule = useRef<THREE.Group>(null)
  const sky = useRef<THREE.Color>(new THREE.Color())
  useFrame(({ camera, scene }, dt) => {
    const t = since + (rocket.current?.userData.t ?? 0)
    if (rocket.current) rocket.current.userData.t = (rocket.current.userData.t ?? 0) + dt / 60
    if (phase === 'ascent' && rocket.current) {
      // Up and up, faster and faster; the camera follows from below.
      const y = Math.min(400, 3 * (t * 60) ** 1.6)
      rocket.current.position.y = y
      rocket.current.rotation.z = -Math.min(0.5, y / 800)
      camera.position.set(30, Math.max(8, y * 0.7), 40)
      camera.lookAt(0, y + 6, 0)
      sky.current.set('#7fb8ec').lerp(new THREE.Color('#02030a'), Math.min(1, y / 300))
      scene.background = sky.current
    }
    if (phase === 'return' && capsule.current) {
      const y = Math.max(1, 120 - (t * 60) * 0.5)
      capsule.current.position.y = y
      camera.position.set(14, y + 3, 18)
      camera.lookAt(0, y, 0)
    }
    if (phase === 'pad') {
      camera.position.set(26, 12, 40)
      camera.lookAt(0, 8, 0)
    }
  })
  const ground = steppe ? '#c9b48a' : '#1d6fb8'
  return (
    <>
      <color attach="background" args={[phase === 'return' ? '#8ec9f0' : '#7fb8ec']} />
      <hemisphereLight args={['#ffffff', '#c8d6e6', 1.2]} />
      <directionalLight position={[40, 60, 20]} intensity={1.5} />
      {phase !== 'return' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[2000, 2000]} />
            <meshLambertMaterial color="#5a8f3e" />
          </mesh>
          {/* The pad's concrete and its tower */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[10, 0.4, 10]} />
            <meshLambertMaterial color="#9aa0a6" />
          </mesh>
          <mesh position={[-3.2, 7, 0]}>
            <boxGeometry args={[1.2, 14, 1.2]} />
            <meshLambertMaterial color="#c92a2a" />
          </mesh>
          <group ref={rocket} position={[0, 0.4, 0]}>
            <BlockRocket flame={phase === 'ascent' ? 2.5 : 0} />
          </group>
          {phase === 'ascent' && <Stars />}
        </>
      )}
      {phase === 'return' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2000, 2000]} />
            <meshLambertMaterial color={ground} />
          </mesh>
          <group ref={capsule} position={[0, 120, 0]}>
            <BlockCapsule chutes />
          </group>
        </>
      )}
      {phase === 'ascent' && (
        <group position={[0, -260, -200]}>
          <BlockEarth radius={20} />
        </group>
      )}
    </>
  )
}

export function LaunchView({ sim, onMap }: { sim: Sim; night?: boolean; onMap?: () => void }) {
  const a = sim.activity!
  const t = a.trip!
  const now = sim.gameMinutes
  const back = isSpaceCity(t.fromCity)
  const phase: Phase = back ? 'return' : t.departs && now < t.departs ? 'pad' : 'ascent'
  const left = Math.max(0, Math.ceil(a.end - now))
  const toLaunch = t.departs ? Math.max(0, Math.ceil(t.departs - now)) : 0
  const share = Math.min(1, Math.max(0, (now - a.start) / Math.max(1, a.end - a.start)))
  const since = phase === 'ascent' && t.departs ? Math.max(0, now - t.departs) : phase === 'return' ? Math.max(0, now - a.start) : 0
  return (
    <div className="absolute inset-0 z-20">
      <Canvas key={phase} dpr={[1, 1.5]} camera={{ fov: 50, near: 0.5, far: 3000, position: [22, 9, 26] }}>
        <Scene phase={phase} since={since} steppe={t.city === 'baikonour'} />
      </Canvas>
      <div className="hud pointer-events-auto absolute top-[max(5.5rem,calc(var(--sat,env(safe-area-inset-top))+5rem))] left-1/2 w-[min(380px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] p-3">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <Rocket size={18} className="text-[#ff7a00]" />
          <span className="min-w-0 flex-1 truncate">{a.interaction.label}</span>
          {onMap && (
            <button className="icon-btn bg-[var(--color-canvas)] !h-9 !w-9" onClick={onMap} aria-label={tr('Voir la carte')}>
              <MapIcon size={16} />
            </button>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
          <div className="h-full rounded-full bg-[#ff7a00] transition-[width] duration-1000" style={{ width: `${share * 100}%` }} />
        </div>
        <div className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">
          {phase === 'pad' ? tr('Combinaison, visite médicale, marche vers la fusée : décollage dans {n} min', { n: toLaunch }) : phase === 'return' ? (left > 0 ? tr('Retour sur Terre dans {n} min', { n: left }) : tr('Amerrissage…')) : left > 0 ? tr('Arrivée dans {n} min', { n: left }) : tr('Amarrage…')}
        </div>
      </div>
    </div>
  )
}
