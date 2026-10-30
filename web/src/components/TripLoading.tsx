import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneDpr } from '../lib/device'
import { Vehicle, type VehicleKind } from '../world3d/vehicles'
import { Box, Palm } from '../world3d/props'
import { t as tr, tx } from '../lib/i18n'

// A ride in town, short (the update « trajet-court »): no waiting for the whole
// way. The Sim gets in at the kerb in the street (world3d/open/tripRide.tsx, or
// tripDrop.tsx in the commune), then this: the game's own taxi, woro-woro, gbaka
// or moto-taxi on its way, the street going by. Three seconds; then there, it
// pulls up and the Sim gets out (world3d/open/tripDrop.tsx).

export const TRIP_LOADING_MS = 3200

const kindOf = (mode: string): VehicleKind => (mode === 'woro' ? 'woro' : mode === 'gbaka' ? 'gbaka' : mode === 'moto' ? 'moto' : mode === 'compteur' || mode === 'taxi' ? 'taxi' : 'car')
const NAME: Record<VehicleKind, string> = { taxi: tr('le taxi compteur'), woro: tr('le woro-woro'), gbaka: tr('le gbaka'), moto: tr('la moto-taxi'), car: tr('la voiture'), sotra: tr('le bus') }

/** How fast the street goes by (m/s), and how long a stretch of it is before it comes round again (m). */
const SPEED = 14
const LOOP = 42

function Street({ kind, color, trim }: { kind: VehicleKind; color?: string; trim?: string }) {
  const by = useRef<THREE.Group>(null)
  const far = useRef<THREE.Group>(null)
  const car = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // The street going by (the near side faster than the buildings behind), the vehicle bobbing on the road.
    if (by.current) by.current.position.x = (t * SPEED) % LOOP
    if (far.current) far.current.position.x = (t * SPEED * 0.6) % LOOP
    if (car.current) car.current.position.y = Math.abs(Math.sin(t * 9)) * 0.04
  })
  const houses: [number, number, string][] = [[0, 7, '#e9c46a'], [7, 9, '#f4a261'], [14, 6, '#9fd3c7'], [21, 11, '#e76f51'], [28, 8, '#d9c8a9'], [35, 7, '#a8dadc']]
  // Two stretches side by side, so the street never runs out.
  const twice = (f: (dx: number) => React.ReactNode) => [-LOOP, 0, LOOP].map((dx) => <group key={dx}>{f(dx)}</group>)
  return (
    <>
      {/* The road, the pavements, the ground beyond: they stay */}
      <Box p={[0, -0.05, 0]} s={[200, 0.1, 6]} c="#55595f" />
      <Box p={[0, 0.06, 3.6]} s={[200, 0.12, 1.4]} c="#c9c2b3" />
      <Box p={[0, -0.02, 14]} s={[200, 0.04, 20]} c="#c9a97a" />
      <Box p={[0, 0.06, -3.6]} s={[200, 0.12, 1.4]} c="#c9c2b3" />
      {/* The white line and the palms going by */}
      <group ref={by}>
        {twice((dx) => (
          <>
            {[...Array(8)].map((_, i) => (
              <Box key={i} p={[dx - 18 + i * 5.25, 0.01, 0]} s={[2.2, 0.02, 0.15]} c="#f4f1ea" />
            ))}
            <Palm p={[dx - 8, 0, 4.4]} h={5} />
            <Palm p={[dx + 12, 0, 4.4]} h={6} />
          </>
        ))}
      </group>
      {/* The buildings behind and their windows */}
      <group ref={far}>
        {twice((dx) =>
          houses.map(([bx, h, c], i) => (
            <group key={i}>
              <Box p={[dx - 18 + bx, h / 2, -6]} s={[6, h, 4]} c={c} />
              {[...Array(Math.floor(h / 2.5))].map((_, r) => (
                <Box key={r} p={[dx - 18 + bx, 1.6 + r * 2.5, -3.98]} s={[4, 1.1, 0.05]} c="#2b3a55" />
              ))}
            </group>
          )),
        )}
      </group>
      <group ref={car} position={[0, 0, 1.2]}>
        <Vehicle p={[0, 0, 0]} r={Math.PI} kind={kind} color={kind === 'sotra' ? undefined : color} trim={trim} seed={3} crew />
      </group>
    </>
  )
}

export function TripLoading({ mode, to, color, trim, onDone }: { mode: string; /** Where to: the commune's or the place's name. */ to: string; /** The vehicle's colours (game/rides rideLook). */ color?: string; trim?: string; onDone: () => void }) {
  const kind = kindOf(mode)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), TRIP_LOADING_MS)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="absolute inset-0 z-[60] flex flex-col overflow-hidden bg-[#a9d3f0]">
      <style>{'@keyframes trip-bar { from { width: 0 } to { width: 100% } }'}</style>
      <div className="relative flex-1">
        <Canvas dpr={sceneDpr} shadows camera={{ position: [-0.5, 4.2, 17], fov: 38 }} onCreated={({ camera }) => camera.lookAt(-0.5, 1.2, 0)}>
          <color attach="background" args={['#a9d3f0']} />
          <hemisphereLight args={['#ffffff', '#c9b28f', 0.9]} />
          <directionalLight position={[6, 12, 8]} intensity={1.3} castShadow />
          <Street kind={kind} color={color} trim={trim} />
        </Canvas>
      </div>
      <div className="relative z-10 bg-[#0f1230]/85 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
        <div className="font-display text-[20px] font-extrabold text-white">{tr('En route pour')} {to}</div>
        <div className="text-[13px] font-extrabold text-white/80">{tx('Dans {0}…', { 0: NAME[kind] })}</div>
        <div className="mx-auto mt-3 h-2.5 max-w-[340px] overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[#ffc233]" style={{ animation: `trip-bar ${TRIP_LOADING_MS}ms linear forwards` }} />
        </div>
      </div>
    </div>
  )
}
