import { Suspense, useMemo, useState, useEffect, useRef, useCallback } from 'react'
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

// Real 3D intimacy: dressed room (hotel / home / street / club), stronger motion,
// and a short rhythm game (tap on the beat to heat up, then Continuer). Gate: adult_at + gonow.

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

export type IntimateVenue = 'home' | 'hotel' | 'street' | 'club'

type Partner = { name: string; gender: 'femme' | 'homme'; look: Look; seed: number }

/** Strip to bare skin for the scene. */
function nudeLook(look: Look): Look {
  return { ...look, outfit: 'nu', outfitColor: look.skin, bottomColor: look.skin, shoeColor: look.skin, accessory: 'none', wear: 'neuf' }
}

const VENUE_TINT: Record<IntimateVenue, { wall: string; accent: string; lamp: string; sheet: string }> = {
  home: { wall: '#3a2a28', accent: '#c4784a', lamp: '#ffd0a0', sheet: '#e8c4b0' },
  hotel: { wall: '#2a2438', accent: '#d4a85a', lamp: '#ffe0b0', sheet: '#d46a8a' },
  street: { wall: '#2a2018', accent: '#ff8a3d', lamp: '#ffb070', sheet: '#8a6070' },
  club: { wall: '#1a1028', accent: '#ff4d9a', lamp: '#ff80c0', sheet: '#6a3060' },
}

export function IntimateScene({
  sim,
  actId,
  partner,
  other,
  venue = 'hotel',
  onClose,
}: {
  sim: Sim
  actId: string
  /** Partner living at home (passer-nuit / intimite at home). */
  partner?: Friend | null
  /** Booked GoNow / street / pole companion. */
  other?: Partner | null
  venue?: IntimateVenue
  onClose?: () => void
}) {
  const act = intimacyActOf(actId)
  const [ready, setReady] = useState(false)
  const [heat, setHeat] = useState(0)
  const [flash, setFlash] = useState(false)
  const [miss, setMiss] = useState(false)
  const [beat, setBeat] = useState(0)
  const beatRef = useRef(0)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 280)
    return () => clearTimeout(t)
  }, [actId])
  // Drive the beat ring from the same pulse the couple uses (~20 fps UI).
  useEffect(() => {
    let id = 0
    let last = 0
    const tick = (now: number) => {
      const p = intimacyPulse(act ?? 'cowgirl', worldTime())
      beatRef.current = p
      if (now - last > 50) {
        last = now
        setBeat(p)
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [act])
  const tap = useCallback(() => {
    if (!act || heat >= 100) return
    const p = Math.abs(beatRef.current)
    if (p > 0.55) {
      setHeat((h) => Math.min(100, h + 10 + Math.round(p * 8)))
      setFlash(true)
      setTimeout(() => setFlash(false), 160)
    } else {
      setMiss(true)
      setTimeout(() => setMiss(false), 220)
    }
  }, [act, heat])
  if (!act) return null
  const femme = sim.gender === 'femme'
  const roles = intimacyRoles(act, femme)
  const them: Partner = other ?? (partner
    ? { name: partner.name, gender: partner.gender, look: partner.look ?? randomLook(partner.gender, rng(`int${partner.id}`)), seed: partner.seed ?? 7 }
    : { name: tr('Une go'), gender: 'femme', look: randomLook('femme', rng(`int${sim.id}`)), seed: 9 })
  const meLook = useMemo(() => nudeLook(sim.look), [sim.look])
  const themLook = useMemo(() => nudeLook(them.look), [them.look])
  const standing = act === 'stand' || act === 'bj' || act === 'hj'
  const tint = VENUE_TINT[venue]
  const done = heat >= 100
  return (
    <div className="absolute inset-0 z-[60]" style={{ background: venue === 'club' ? '#0a0612' : '#120a14' }}>
      <Canvas shadows dpr={sceneDpr} camera={{ position: standing ? [2.6, 1.55, 2.8] : [2.0, 1.35, 2.7], fov: 40 }} style={{ background: `radial-gradient(ellipse at 50% 20%, ${tint.accent}44, #0a0612 70%)` }}>
        <Suspense fallback={null}>
          <hemisphereLight args={[tint.lamp, '#1a1020', 0.7]} />
          <directionalLight position={[2.8, 4.2, 1.6]} intensity={1.05} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[0.6, 2.1, 0.2]} intensity={22} distance={10} color={tint.lamp} />
          <pointLight position={[-1.4, 1.5, 1.1]} intensity={10} distance={6} color={tint.accent} />
          <Room venue={venue} standing={standing} tint={tint} />
          {ready && (
            <Couple act={act} simPose={roles.sim} otherPose={roles.other} meLook={meLook} themLook={themLook} meGender={sim.gender} themGender={them.gender} meSeed={1} themSeed={them.seed} standing={standing} amp={1 + heat * 0.01} />
          )}
          <OrbitControls makeDefault enablePan={false} minDistance={1.5} maxDistance={4.5} minPolarAngle={0.4} maxPolarAngle={1.35} target={[0, standing ? 0.95 : 0.85, 0]} />
        </Suspense>
      </Canvas>

      {/* Title */}
      <div className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-center gap-0.5 text-center text-white">
        <p className="font-display text-xl font-extrabold drop-shadow">{tr(LABELS[act])}</p>
        <p className="text-sm font-bold text-white/70">
          {sim.firstName} · {them.name}
        </p>
      </div>

      {/* Rhythm game: tap on the beat to heat up */}
      <div className="absolute inset-x-0 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] flex flex-col items-center gap-3 px-4">
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-[11px] font-extrabold tracking-wide text-white/70">
            <span>{tr('Chauffe')}</span>
            <span>{heat}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${heat}%`, background: done ? '#3ee08f' : `linear-gradient(90deg, ${tint.accent}, #fff)` }} />
          </div>
        </div>
        {!done ? (
          <button
            type="button"
            aria-label={tr('Chauffe')}
            onClick={tap}
            className={`relative grid h-[72px] w-[72px] place-items-center rounded-full border-4 text-sm font-extrabold text-white transition active:scale-95 ${flash ? 'border-white bg-white/35' : miss ? 'border-rose-400 bg-rose-500/30' : 'border-white/40 bg-white/10 backdrop-blur'}`}
          >
            <span className="absolute inset-0 rounded-full border-2 border-white/50" style={{ transform: `scale(${1 + Math.abs(beat) * 0.4})`, opacity: 0.3 + Math.abs(beat) * 0.55 }} />
            {tr('Tape')}
          </button>
        ) : (
          <p className="text-sm font-extrabold text-[#3ee08f] drop-shadow">{tr('C’est chaud… tu peux continuer.')}</p>
        )}
      </div>

      {/* Exit / continue — always reachable (was missing in Play → stuck overlay) */}
      <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {onClose && (
          <button type="button" className={`rounded-full px-5 py-2.5 text-sm font-extrabold text-white backdrop-blur ${done ? 'bg-[var(--color-orange)]' : 'bg-white/15'}`} onClick={onClose}>
            {done ? tr('Continuer') : tr('Arrêter')}
          </button>
        )}
      </div>
    </div>
  )
}

function Room({ venue, standing, tint }: { venue: IntimateVenue; standing: boolean; tint: (typeof VENUE_TINT)[IntimateVenue] }) {
  const windowGlow = venue === 'club' ? '#ff4d9a' : venue === 'street' ? '#ff8a3d' : '#7ec8ff'
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshLambertMaterial color={venue === 'hotel' ? '#1a1524' : '#141018'} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 1.5, -2.1]} receiveShadow>
        <boxGeometry args={[7, 3.2, 0.12]} />
        <meshLambertMaterial color={tint.wall} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-3.2, 1.5, -0.3]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[4.2, 3.2, 0.1]} />
        <meshLambertMaterial color={tint.wall} />
      </mesh>
      <mesh position={[3.2, 1.5, -0.3]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[4.2, 3.2, 0.1]} />
        <meshLambertMaterial color={tint.wall} />
      </mesh>
      {/* Window + night city glow */}
      <mesh position={[0.9, 1.7, -2.02]}>
        <planeGeometry args={[1.6, 1.1]} />
        <meshBasicMaterial color={windowGlow} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0.9, 1.7, -2.04]}>
        <planeGeometry args={[1.75, 1.25]} />
        <meshLambertMaterial color="#0a1018" />
      </mesh>
      {/* Lamp */}
      <group position={[-1.55, 0, -1.55]}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.06, 0.1, 1.1, 8]} />
          <meshLambertMaterial color="#2a2030" />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.28, 0.22, 0.32, 10]} />
          <meshLambertMaterial color={tint.lamp} emissive={tint.lamp} emissiveIntensity={0.45} />
        </mesh>
      </group>
      {/* Bed or standing strip */}
      {!standing && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.5, 0.34, 1.85]} />
            <meshLambertMaterial color="#1a1020" />
          </mesh>
          <mesh position={[0, 0.2, 0]} receiveShadow>
            <boxGeometry args={[2.25, 0.1, 1.55]} />
            <meshLambertMaterial color={tint.sheet} />
          </mesh>
          <mesh position={[0, 0.28, -0.68]}>
            <boxGeometry args={[2.2, 0.18, 0.36]} />
            <meshLambertMaterial color="#f4e8f0" />
          </mesh>
          {/* Headboard */}
          <mesh position={[0, 0.55, -0.92]}>
            <boxGeometry args={[2.45, 0.9, 0.12]} />
            <meshLambertMaterial color={tint.accent} />
          </mesh>
        </group>
      )}
      {standing && (
        <>
          <mesh position={[0, 1.45, -1.15]} receiveShadow>
            <boxGeometry args={[3.4, 2.9, 0.14]} />
            <meshLambertMaterial color={tint.wall} />
          </mesh>
          <mesh position={[0, 0.03, -0.45]} receiveShadow>
            <boxGeometry args={[1.8, 0.06, 1.1]} />
            <meshLambertMaterial color="#2a2040" />
          </mesh>
        </>
      )}
      {/* Club LED strip */}
      {venue === 'club' && (
        <mesh position={[0, 2.85, -2.0]}>
          <boxGeometry args={[5.5, 0.08, 0.08]} />
          <meshBasicMaterial color="#ff4d9a" />
        </mesh>
      )}
    </group>
  )
}

function Couple({
  act, simPose, otherPose, meLook, themLook, meGender, themGender, meSeed, themSeed, standing, amp,
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
  /** Motion amplitude (grows with heat). */
  amp: number
}) {
  const layout = layoutOf(act, standing)
  const meG = useRef<THREE.Group>(null)
  const themG = useRef<THREE.Group>(null)
  const meTilt = useRef<THREE.Group>(null)
  const themTilt = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = intimacyPulse(act, worldTime()) * amp
    const me = meG.current
    const th = themG.current
    if (!me || !th) return
    me.position.set(layout.me.at[0], layout.me.at[1], layout.me.at[2])
    th.position.set(layout.them.at[0], layout.them.at[1], layout.them.at[2])
    meTilt.current?.rotation.set(layout.me.rot[0], layout.me.rot[1], layout.me.rot[2])
    themTilt.current?.rotation.set(layout.them.rot[0], layout.them.rot[1], layout.them.rot[2])
    switch (act) {
      case 'bj':
        th.position.z = layout.them.at[2] + p * 0.14
        th.position.y = layout.them.at[1] + Math.abs(p) * 0.05
        break
      case 'hj':
        th.position.z = layout.them.at[2] + p * 0.1
        break
      case 'cowgirl':
      case 'rev-cowgirl':
        th.position.y = layout.them.at[1] + p * 0.22
        break
      case 'doggy':
        me.position.z = layout.me.at[2] + p * 0.18
        break
      case 'missionary':
        me.position.y = layout.me.at[1] + Math.abs(p) * 0.12
        me.position.z = layout.me.at[2] + p * 0.1
        break
      case 'spoon':
        me.position.z = layout.me.at[2] + p * 0.12
        break
      case 'stand':
        me.position.z = layout.me.at[2] + p * 0.16
        th.position.y = layout.them.at[1] + Math.abs(p) * 0.1
        break
      case 'lotus':
        me.position.z = layout.me.at[2] + p * 0.1
        th.position.z = layout.them.at[2] - p * 0.1
        th.position.y = layout.them.at[1] + Math.abs(p) * 0.08
        break
      case 'sixty':
        me.position.y = layout.me.at[1] + Math.abs(p) * 0.1
        th.position.y = layout.them.at[1] + Math.abs(p) * 0.1
        break
    }
  })
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

const HIP = 0.82
const ON_BACK: [number, number, number] = [-Math.PI / 2, 0, 0]
const MATTRESS_TOP = 0.5
const LIE_Y = MATTRESS_TOP + 0.48
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
