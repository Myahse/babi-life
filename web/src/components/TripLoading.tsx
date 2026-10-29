import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../lib/types'
import { sceneDpr } from '../lib/device'
import { Character } from '../world3d/Character'
import { Vehicle, type VehicleKind } from '../world3d/vehicles'
import { Box, Palm } from '../world3d/props'

// A ride in town, short (the update « trajet-court »): no waiting for the whole
// way. A short scene in the game's own street, with its own vehicles: the taxi,
// the woro-woro, the gbaka or the moto-taxi pulls up at the kerb, the perso
// walks up and climbs in, and it's off; then there (the vehicle drops the Sim
// in the street and speeds off: world3d/open/tripDrop.tsx). Three seconds.

export const TRIP_LOADING_MS = 3200

const kindOf = (mode: string): VehicleKind => (mode === 'woro' ? 'woro' : mode === 'gbaka' ? 'gbaka' : mode === 'moto' ? 'moto' : mode === 'compteur' || mode === 'taxi' ? 'taxi' : 'car')
const NAME: Record<VehicleKind, string> = { taxi: 'le taxi compteur', woro: 'le woro-woro', gbaka: 'le gbaka', moto: 'la moto-taxi', car: 'la voiture', sotra: 'le bus' }

/** The timeline (s): the vehicle pulling up, the perso walking to it and in, the vehicle off. */
const STOP = 0.9
const BOARD = 1.9

function Street({ kind, color, trim, look, gender, stage }: { kind: VehicleKind; color?: string; trim?: string; look: Look; gender: 'femme' | 'homme'; stage: string }) {
  const car = useRef<THREE.Group>(null)
  const me = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime
    const t = clock.elapsedTime - t0.current
    // The vehicle: in from the right, slowing to the kerb; then off to the left, faster and faster.
    const x = t < STOP ? 18 * (1 - t / STOP) ** 2 : t < BOARD ? 0 : -0.5 * 26 * (t - BOARD) ** 2
    if (car.current) car.current.position.x = x
    // The perso: walking up the pavement to the back door, then in.
    if (me.current) {
      const k = Math.min(1, Math.max(0, (t - 0.4) / (BOARD - 0.5)))
      me.current.position.set(-4 + 3.4 * k, 0.12, 3.4 - 1.6 * Math.max(0, k - 0.7) / 0.3)
      me.current.rotation.y = k < 0.7 ? Math.PI / 2 : Math.PI
      me.current.visible = t < BOARD - 0.05
    }
  })
  const far: [number, number, string][] = [[-14, 7, '#e9c46a'], [-7, 9, '#f4a261'], [0, 6, '#9fd3c7'], [7, 11, '#e76f51'], [14, 8, '#d9c8a9'], [21, 7, '#a8dadc']]
  return (
    <>
      {/* The road, its white line, the pavement and its kerb */}
      <Box p={[0, -0.05, 0]} s={[80, 0.1, 6]} c="#55595f" />
      {[...Array(16)].map((_, i) => (
        <Box key={i} p={[-36 + i * 5, 0.01, 0]} s={[2.2, 0.02, 0.15]} c="#f4f1ea" />
      ))}
      <Box p={[0, 0.06, 3.6]} s={[80, 0.12, 1.4]} c="#c9c2b3" />
      {/* The ground beyond, the other pavement */}
      <Box p={[0, -0.02, 14]} s={[80, 0.04, 20]} c="#c9a97a" />
      <Box p={[0, 0.06, -3.6]} s={[80, 0.12, 1.4]} c="#c9c2b3" />
      <Box p={[0, 0.03, 2.9]} s={[80, 0.08, 0.12]} c="#e9e4da" />
      {/* The street's buildings behind, their windows, a palm or two */}
      {far.map(([bx, h, c], i) => (
        <group key={i}>
          <Box p={[bx, h / 2, -6]} s={[6, h, 4]} c={c} />
          {[...Array(Math.floor(h / 2.5))].map((_, r) => (
            <Box key={r} p={[bx, 1.6 + r * 2.5, -3.98]} s={[4, 1.1, 0.05]} c="#2b3a55" />
          ))}
        </group>
      ))}
      <Palm p={[-10, 0, 4.4]} h={5} />
      <Palm p={[9, 0, 4.4]} h={6} />
      <group ref={car} position={[18, 0, 1.2]}>
        <Vehicle p={[0, 0, 0]} r={Math.PI} kind={kind} color={kind === 'sotra' ? undefined : color} trim={trim} seed={3} crew />
      </group>
      <group ref={me}>
        <Character look={look} gender={gender} stage={stage} walking marker={false} />
      </group>
    </>
  )
}

export function TripLoading({ mode, to, look, gender = 'homme', stage = 'adulte', color, trim, onDone }: { mode: string; /** Where to: the commune's name. */ to: string; look: Look; gender?: 'femme' | 'homme'; stage?: string; /** The vehicle's colours (game/rides rideLook). */ color?: string; trim?: string; onDone: () => void }) {
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
          <Street kind={kind} color={color} trim={trim} look={look} gender={gender} stage={stage} />
        </Canvas>
      </div>
      <div className="relative z-10 bg-[#0f1230]/85 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
        <div className="font-display text-[20px] font-extrabold text-white">En route pour {to}</div>
        <div className="text-[13px] font-extrabold text-white/80">Tu montes dans {NAME[kind]}…</div>
        <div className="mx-auto mt-3 h-2.5 max-w-[340px] overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[#ffc233]" style={{ animation: `trip-bar ${TRIP_LOADING_MS}ms linear forwards` }} />
        </div>
      </div>
    </div>
  )
}
