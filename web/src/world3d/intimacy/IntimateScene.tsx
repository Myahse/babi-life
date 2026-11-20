import { Suspense, useMemo, useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Human } from '../../avatar/Human'
import { intimacyActOf, intimacyPulse, intimacyRoles, type IntimacyAct } from '../../avatar/intimacy'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { worldTime } from '../../lib/worldClock'
import type { Friend, Look, Sim } from '../../lib/types'
import { t as tr } from '../../lib/i18n'
import { sceneDpr } from '../../lib/device'

// Real 3D intimacy scene (no fade to black): two naked blocky Sims on a bed /
// against a wall, pose + rhythmic thrust. Gate: adult_at + feature gonow.

const LABELS: Record<IntimacyAct, string> = {
  bj: 'Fellation',
  hj: 'Branlette',
  cowgirl: 'À califourchon',
  'rev-cowgirl': 'Califourchon inversé',
  doggy: 'En levrette',
  missionary: 'Missionnaire',
  spoon: 'Cuillère',
  stand: 'Debout',
  lotus: 'Lotus',
  sixty: '69',
}

type Partner = { name: string; gender: 'femme' | 'homme'; look: Look; seed: number }

/** Strip to bare skin for the scene. */
function nudeLook(look: Look): Look {
  return { ...look, outfit: 'nu', outfitColor: look.skin, bottomColor: look.skin, shoeColor: look.skin, accessory: 'none', wear: 'neuf' }
}

export function IntimateScene({
  sim,
  actId,
  partner,
  other,
  onClose,
}: {
  sim: Sim
  actId: string
  /** Partner living at home (passer-nuit / intimite at home). */
  partner?: Friend | null
  /** Booked GoNow / street / pole companion. */
  other?: Partner | null
  onClose?: () => void
}) {
  const act = intimacyActOf(actId)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 350)
    return () => clearTimeout(t)
  }, [actId])
  if (!act) return null
  const femme = sim.gender === 'femme'
  const roles = intimacyRoles(act, femme)
  const them: Partner = other ?? (partner
    ? { name: partner.name, gender: partner.gender, look: partner.look ?? randomLook(partner.gender, rng(`int${partner.id}`)), seed: partner.seed ?? 7 }
    : { name: tr('Une go'), gender: 'femme', look: randomLook('femme', rng(`int${sim.id}`)), seed: 9 })
  const meLook = useMemo(() => nudeLook(sim.look), [sim.look])
  const themLook = useMemo(() => nudeLook(them.look), [them.look])
  const standing = act === 'stand' || act === 'bj' || act === 'hj'
  return (
    <div className="absolute inset-0 z-40 bg-[#0a0612]">
      <Canvas shadows dpr={sceneDpr} camera={{ position: standing ? [2.4, 1.5, 2.6] : [1.6, 1.15, 2.4], fov: 38 }} style={{ background: 'radial-gradient(ellipse at 50% 25%, #3a2058, #0a0612 65%)' }}>
        <Suspense fallback={null}>
          <hemisphereLight args={['#c9a0d8', '#1a1020', 0.85]} />
          <directionalLight position={[2.5, 4.5, 2]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[0, 2.4, 0.4]} intensity={18} distance={9} color="#ffc0d8" />
          <pointLight position={[-1.2, 1.6, 1.2]} intensity={8} distance={5} color="#a080ff" />
          {/* Floor / bed */}
          {!standing && (
            <group position={[0, 0.28, 0]}>
              {/* Frame: top at 0.44 */}
              <mesh position={[0, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.4, 0.32, 1.7]} />
                <meshLambertMaterial color="#2a1838" />
              </mesh>
              {/* Thin sheet on top — top surface at 0.44 + 0.04 = 0.48 */}
              <mesh position={[0, 0.18, 0]} receiveShadow>
                <boxGeometry args={[2.15, 0.08, 1.45]} />
                <meshLambertMaterial color="#d46a8a" />
              </mesh>
              {/* Low pillow — top at ~0.58, under the head once lying */}
              <mesh position={[0, 0.26, -0.62]}>
                <boxGeometry args={[2.15, 0.16, 0.32]} />
                <meshLambertMaterial color="#f4e8f0" />
              </mesh>
            </group>
          )}
          {standing && (
            <>
              <mesh position={[0, 1.45, -1.05]} receiveShadow>
                <boxGeometry args={[3.2, 2.9, 0.14]} />
                <meshLambertMaterial color="#1c1430" />
              </mesh>
              <mesh position={[0, 0.02, -0.55]} receiveShadow>
                <boxGeometry args={[1.6, 0.04, 0.9]} />
                <meshLambertMaterial color="#2a2040" />
              </mesh>
            </>
          )}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[14, 14]} />
            <meshLambertMaterial color="#100818" />
          </mesh>
          {ready && (
            <Couple act={act} simPose={roles.sim} otherPose={roles.other} meLook={meLook} themLook={themLook} meGender={sim.gender} themGender={them.gender} meSeed={1} themSeed={them.seed} standing={standing} />
          )}
          <OrbitControls makeDefault enablePan={false} minDistance={1.4} maxDistance={4.2} minPolarAngle={0.35} maxPolarAngle={1.4} target={[0, standing ? 0.95 : 0.95, 0]} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] flex flex-col items-center gap-1 text-center text-white">
        <p className="font-display text-xl font-extrabold drop-shadow">{tr(LABELS[act])}</p>
        <p className="text-sm font-bold text-white/70">
          {sim.firstName} · {them.name}
        </p>
      </div>
      {onClose && (
        <button type="button" className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-extrabold text-white backdrop-blur" onClick={onClose}>
          {tr('Fermer')}
        </button>
      )}
    </div>
  )
}

function Couple({
  act, simPose, otherPose, meLook, themLook, meGender, themGender, meSeed, themSeed, standing,
}: {
  act: IntimacyAct
  simPose: PoseName
  otherPose: PoseName
  meLook: Look
  themLook: Look
  meGender: Sim['gender']
  themGender: 'femme' | 'homme'
  meSeed: number
  themSeed: number
  standing: boolean
}) {
  const layout = layoutOf(act, standing)
  const meG = useRef<THREE.Group>(null)
  const themG = useRef<THREE.Group>(null)
  const meTilt = useRef<THREE.Group>(null)
  const themTilt = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = intimacyPulse(act, worldTime())
    const me = meG.current
    const th = themG.current
    if (!me || !th) return
    // Pin base placement + lie tilt every frame (R3F can skip prop updates on reused groups).
    me.position.set(layout.me.at[0], layout.me.at[1], layout.me.at[2])
    th.position.set(layout.them.at[0], layout.them.at[1], layout.them.at[2])
    meTilt.current?.rotation.set(layout.me.rot[0], layout.me.rot[1], layout.me.rot[2])
    themTilt.current?.rotation.set(layout.them.rot[0], layout.them.rot[1], layout.them.rot[2])
    // Rock the pair so bodies meet: who moves depends on the act.
    // Tiny pulse — never opens a gap.
    switch (act) {
      case 'bj':
        th.position.z = layout.them.at[2] + p * 0.012
        break
      case 'hj':
        th.position.z = layout.them.at[2] + p * 0.01
        break
      case 'cowgirl':
      case 'rev-cowgirl':
        th.position.y = layout.them.at[1] + p * 0.025
        break
      case 'doggy':
        me.position.z = layout.me.at[2] + p * 0.02
        break
      case 'missionary':
        me.position.y = layout.me.at[1] + Math.abs(p) * 0.01
        break
      case 'spoon':
        me.position.z = layout.me.at[2] + p * 0.015
        break
      case 'stand':
        me.position.z = layout.me.at[2] + p * 0.02
        th.position.y = layout.them.at[1] + Math.abs(p) * 0.012
        break
      case 'lotus':
        me.position.z = layout.me.at[2] + p * 0.01
        th.position.z = layout.them.at[2] - p * 0.01
        break
      case 'sixty':
        me.position.y = layout.me.at[1] + Math.abs(p) * 0.01
        th.position.y = layout.them.at[1] + Math.abs(p) * 0.01
        break
    }
  })
  // Outer group = world placement (Y on the sheet); inner = lying tilt.
  // Same split as Interior WalkTo — rotation must not fight the bed height.
  return (
    <group>
      <group ref={meG} position={layout.me.at}>
        <group ref={meTilt} rotation={layout.me.rot}>
          <Human look={meLook} gender={meGender} pose={simPose} seed={meSeed} full />
        </group>
      </group>
      <group ref={themG} position={layout.them.at}>
        <group ref={themTilt} rotation={layout.them.rot}>
          <Human look={themLook} gender={themGender} pose={otherPose} seed={themSeed} full />
        </group>
      </group>
    </group>
  )
}

type PoseName = ReturnType<typeof intimacyRoles>['sim']
type Place = { at: [number, number, number]; rot: [number, number, number] }

/**
 * On-back: outer group at LIE_Y, inner group Rx(−π/2). Body intimacyBody.z
 * adds a little more world +Y. Tuned so the back sits on the sheet (lab-checked).
 */
const HIP = 0.82
const ON_BACK: [number, number, number] = [-Math.PI / 2, 0, 0]
/** Mattress/sheet top (frame group 0.28 + sheet center 0.18 + half 0.04). */
const MATTRESS_TOP = 0.5
/** Feet origin for on-back — enough clearance that the back is on the sheet. */
const LIE_Y = MATTRESS_TOP + 0.48
/** Kneeling / sitting feet on the mattress. */
const STAND_Y = MATTRESS_TOP

function layoutOf(act: IntimacyAct, standing: boolean): { me: Place; them: Place } {
  const feetForHips = (hipZ: number) => hipZ + HIP
  switch (act) {
    case 'bj':
      return {
        me: { at: [0, standing ? 0 : STAND_Y, 0], rot: [0, 0, 0] },
        them: { at: [0, standing ? 0 : 0.02, 0.08], rot: [0, Math.PI, 0] },
      }
    case 'hj':
      return {
        me: { at: [0, standing ? 0 : STAND_Y, 0], rot: [0, 0, 0] },
        them: { at: [0.06, standing ? 0 : 0.02, 0.06], rot: [0, Math.PI * 0.92, 0] },
      }
    case 'cowgirl':
      return {
        me: { at: [0, LIE_Y, feetForHips(0)], rot: ON_BACK },
        them: { at: [0, LIE_Y + 0.02, 0], rot: [0, 0, 0] },
      }
    case 'rev-cowgirl':
      return {
        me: { at: [0, LIE_Y, feetForHips(0)], rot: ON_BACK },
        them: { at: [0, LIE_Y + 0.02, 0], rot: [0, Math.PI, 0] },
      }
    case 'doggy':
      return {
        me: { at: [0, STAND_Y + 0.04, 0.48], rot: [0, 0, 0] },
        them: { at: [0, STAND_Y, 0], rot: [0, 0, 0] },
      }
    case 'missionary':
      return {
        me: { at: [0, LIE_Y + 0.08, 0.05], rot: [0.05, 0, 0] },
        them: { at: [0, LIE_Y, feetForHips(0)], rot: ON_BACK },
      }
    case 'spoon':
      return {
        me: { at: [0.06, LIE_Y, feetForHips(0)], rot: [-Math.PI / 2, 0, 0.15] },
        them: { at: [-0.06, LIE_Y, feetForHips(0)], rot: [-Math.PI / 2, 0, 0.15] },
      }
    case 'stand':
      return {
        me: { at: [0, 0, -0.7], rot: [0, 0, 0] },
        them: { at: [0, 0.03, -0.74], rot: [0, Math.PI, 0] },
      }
    case 'lotus':
      return {
        me: { at: [0, STAND_Y, 0.04], rot: [0, 0, 0] },
        them: { at: [0, STAND_Y, -0.04], rot: [0, Math.PI, 0] },
      }
    case 'sixty':
      return {
        me: { at: [0, LIE_Y, feetForHips(0.04)], rot: ON_BACK },
        them: { at: [0, LIE_Y, -0.04 - HIP], rot: [-Math.PI / 2, Math.PI, 0] },
      }
  }
}

void THREE
