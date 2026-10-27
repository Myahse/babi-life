import { SpotActions } from '../SpotActions'
import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { NoShadows, type Pose } from '../../avatar/Human'
import { LowHuman } from '../../avatar/LowHuman'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Guest, mat, useBigWalk, type Spot, type XZ, spotWhere, RichAO } from './bigPlace'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { COURT, HALL } from '../open/mosqueM6'

// Inside the Mosquée Mohammed VI: the prayer hall for 7 000 under its
// arcades, a forest of columns and horseshoe arches in rows along the qibla
// wall, the carpet marked in rows, the mihrab in its frame of zellige and
// gold, the minbar's wooden stairs, the chandeliers down the middle, the
// women's section at the back behind its carved screen; outside the hall's
// arches, the courtyard and its fountain for the ablutions. On Friday at
// midday the hall is full and the rows pray as one (the shared clock: Human's
// salatStep); on other days a few people pray, read, sit. The frame is the
// outside's (open/mosqueM6.tsx): -z the qibla wall, +z the courtyard.

/** The columns: every 6 m across the hall, in rows along the qibla wall. */
const COL_X = [...Array(12)].map((_, i) => -33 + i * 6)
const COL_Z = [-28, -22, -16, -10, -4, 2, 8]
const MIHRAB: XZ = [0, HALL.back + 1]
/** The women's section, behind the screen at the hall's front. */
const SCREEN_Z = 9
const ENTRANCE: XZ = [0, HALL.front + 6]
/** The rows of the faithful, from the imam back. */
const ROW0 = HALL.back + 5
const ROW = 1.25

function free(x: number, z: number) {
  const inHall = Math.abs(x) < HALL.hw - 0.6 && z > HALL.back + 0.6 && z < HALL.front
  const inCourt = Math.abs(x) < COURT.hw - 0.6 && z >= HALL.front && z < HALL.front + 14
  if (!inHall && !inCourt) return false
  // The hall's front wall, but its arches.
  if (Math.abs(z - HALL.front) < 0.5 && ((Math.abs(x) + 3) % 6) > 2.2) return false
  for (const cx of COL_X) for (const cz of COL_Z) if (Math.abs(x - cx) < 0.9 && Math.abs(z - cz) < 0.9) return false
  if (Math.abs(x - 4.5) < 1.6 && z < HALL.back + 4) return false // the minbar
  if (Math.hypot(x, z - (HALL.front + 7)) < 4.6) return false // the fountain
  // The screen before the women's section, open at its two ends.
  if (Math.abs(z - SCREEN_Z) < 0.4 && Math.abs(x) < HALL.hw - 6) return false
  return true
}

const SPOTS: Record<string, Spot> = {
  pray: { at: [1.2, ROW0 + ROW * 3], rot: Math.PI, pose: 'salat', from: [1.2, ROW0 + ROW * 3 + 0.9] },
  'priere-vendredi': { at: [1.2, ROW0 + ROW * 3], rot: Math.PI, pose: 'salat', from: [1.2, ROW0 + ROW * 3 + 0.9] },
  visit: { at: [-2.6, HALL.back + 7], rot: Math.PI - 0.2, pose: 'film' },
  ablutions: { at: [4.9, HALL.front + 7], rot: -Math.PI / 2, pose: 'wash' },
}

export function MosqueM6Inside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; roam?: boolean; night: boolean; stage: string }) {
  // Friday from 12:30 to 14:30, or one's come for it: the hall full.
  const m = sim.gameMinutes ?? 0
  const hour = (m / 60) % 24
  const friday = interactionId === 'priere-vendredi' || (Math.floor(m / 1440) % 7 === 4 && hour >= 12.5 && hour < 14.5)
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const carpet = useMemo(() => {
    // Red with a green line each row, toward the qibla.
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 32
    const g = c.getContext('2d')!
    g.fillStyle = '#9b2335'
    g.fillRect(0, 0, 8, 32)
    g.fillStyle = '#1f6f4a'
    g.fillRect(0, 0, 8, 3)
    g.fillStyle = '#c9a14a'
    g.fillRect(0, 3, 8, 1)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(30, (HALL.front - HALL.back) / ROW)
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const columns = useMemo(() => COL_X.flatMap((x) => COL_Z.map((z) => ({ p: [x, 4, z] as [number, number, number], s: [1.1, 8, 1.1] as [number, number, number] }))), [])
  // The arches between the columns, in arcades running toward the mihrab: the camera looks down the aisles.
  const arch = useMemo(() => {
    const g = new THREE.TorusGeometry(2.6, 0.3, 5, 12, Math.PI * 1.15)
    g.rotateZ(-Math.PI * 0.075)
    return g
  }, [])
  const arches = useMemo(() => {
    const m = new THREE.InstancedMesh(arch, mat('#f4ead8'), COL_X.length * (COL_Z.length - 1))
    const o = new THREE.Object3D()
    o.rotation.y = Math.PI / 2
    let i = 0
    for (const x of COL_X)
      for (let k = 0; k < COL_Z.length - 1; k++) {
        o.position.set(x, 6.2, COL_Z[k] + 3)
        o.updateMatrix()
        m.setMatrixAt(i++, o.matrix)
      }
    return m
  }, [arch])
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 36, HALL.front + 16], fov: 45, near: 0.3, far: 900 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#7080c0' : '#ffffff', '#c9b48c', night ? 0.7 : 1.15]} />
          <directionalLight position={[25, 60, 30]} intensity={night ? 0.2 : 1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
          {/* The carpet, the courtyard's zellige; tapped to walk */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, (HALL.front + HALL.back) / 2]}
            receiveShadow
            onClick={(e) => {
              if (!roam || interactionId || e.delta > 6) return
              e.stopPropagation()
              tap([e.point.x, e.point.z])
            }}
          >
            <planeGeometry args={[HALL.hw * 2, HALL.front - HALL.back]} />
            <meshLambertMaterial map={carpet} />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, HALL.front + 15]}
            receiveShadow
            onClick={(e) => {
              if (!roam || interactionId || e.delta > 6) return
              e.stopPropagation()
              tap([e.point.x, e.point.z])
            }}
          >
            <planeGeometry args={[COURT.hw * 2 + 12, 30]} />
            <meshLambertMaterial color="#f1ece2" />
          </mesh>
          <Walls />
          <Blocks at={columns} material={mat('#f4ead8')} />
          <primitive object={arches} />
          <Mihrab night={night} />
          <Fountain />
          <People friday={friday} />
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} />
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 0, HALL.front - 14]} enablePan={false} minDistance={6} maxDistance={95} minPolarAngle={0.25} maxPolarAngle={1.3} enableDamping />
        </Suspense>
        <RichAO />
      </Canvas>
    </div>
  )
}

/** The hall's walls: full on three sides with their arched windows of coloured glass, low on the courtyard's side, its arches open; the carved screen of the women's section. */
function Walls() {
  const glass = mat('#3f8fd6', '#1a4f8a')
  return (
    <group>
      <mesh geometry={BOX} position={[0, HALL.h / 2, HALL.back]} scale={[HALL.hw * 2 + 1, HALL.h, 0.8]} material={mat('#efe4cf')} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={BOX} position={[s * HALL.hw, HALL.h / 2, (HALL.front + HALL.back) / 2]} scale={[0.8, HALL.h, HALL.front - HALL.back]} material={mat('#efe4cf')} receiveShadow />
          {COL_Z.map((z) => (
            <mesh key={z} geometry={BOX} position={[s * (HALL.hw - 0.45), 8.5, z + 3]} scale={[0.06, 3.4, 1.6]} material={glass} />
          ))}
        </group>
      ))}
      {/* The front, low, cut by its arches */}
      {COL_X.map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 0.8, HALL.front]} scale={[3.6, 1.6, 0.8]} material={mat('#efe4cf')} />
      ))}
      {/* The women's screen: carved wood, waist high */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} position={[s * (HALL.hw - 6) / 2, 1.1, SCREEN_Z]} scale={[HALL.hw - 6, 2.2, 0.15]} material={mat('#7a4b2a')} />
      ))}
    </group>
  )
}

/** The mihrab in the qibla wall (its niche, the zellige and the gold round it), the minbar beside it, the chandeliers down the middle. */
function Mihrab({ night }: { night: boolean }) {
  const [x, z] = MIHRAB
  return (
    <group>
      <mesh geometry={BOX} position={[x, 4, z - 0.3]} scale={[7, 8, 0.3]} material={mat('#1f7a4a')} />
      <mesh geometry={BOX} position={[x, 3.4, z - 0.12]} scale={[3.4, 6, 0.1]} material={mat('#0f3f2a')} />
      <mesh position={[x, 6.4, z]} material={mat('#d4a017', '#5a4000')}>
        <torusGeometry args={[1.8, 0.3, 6, 14, Math.PI]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} position={[x + s * 1.9, 3.2, z]} scale={[0.35, 6.4, 0.35]} material={mat('#d4a017')} />
      ))}
      {/* The minbar: a wooden stair up to the preacher's seat */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} geometry={BOX} position={[4.5, 0.25 * (i + 1), HALL.back + 3.4 - i * 0.5]} scale={[1.6, 0.5 * (i + 1), 0.5]} material={mat('#6b4426')} castShadow />
      ))}
      <mesh geometry={BOX} position={[4.5, 4.2, HALL.back + 0.9]} scale={[1.8, 1.4, 0.6]} material={mat('#6b4426')} />
      {/* The chandeliers */}
      {[-18, -6, 6].map((cz) => (
        <group key={cz} position={[0, 9.5, cz]}>
          <mesh geometry={BOX} position={[0, 1.4, 0]} scale={[0.05, 2.8, 0.05]} material={mat('#c9a14a')} />
          <mesh material={mat('#d4a017', night ? '#ffcf7a' : '#5a4000')}>
            <torusGeometry args={[1.6, 0.12, 6, 20]} />
          </mesh>
        </group>
      ))}
      {night && <pointLight position={[0, 8, -10]} intensity={60} distance={40} color="#ffd9a0" />}
    </group>
  )
}

/** The courtyard's fountain, where the ablutions are made, and its taps round it. */
function Fountain() {
  const z = HALL.front + 7
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.45, 0]} material={mat('#f4f1ea')}>
        <cylinderGeometry args={[4, 4.2, 0.9, 8]} />
      </mesh>
      <mesh position={[0, 0.92, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 8]} />
        <meshLambertMaterial color="#4fb3d6" />
      </mesh>
      <mesh position={[0, 1.5, 0]} material={mat('#1f7a4a')}>
        <cylinderGeometry args={[0.5, 0.8, 1.2, 8]} />
      </mesh>
    </group>
  )
}

/** The faithful: on Friday the rows from the imam back, men in front, women behind the screen; on other days a few here and there. */
function People({ friday }: { friday: boolean }) {
  const rows = useMemo(() => {
    const r = rng(friday ? 'm6-vendredi' : 'm6-semaine')
    const out: { p: [number, number, number]; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number; pose: Pose }[] = []
    const man = () => {
      const look = randomLook('homme', r)
      return { ...look, outfit: r() < 0.6 ? 'boubou' : 'imam', outfitColor: ['#f8f9fa', '#e9e2cf', '#9ac1e8', '#cfe8d0'][Math.floor(r() * 4)], accessory: r() < 0.7 ? 'kufi' : look.accessory }
    }
    const woman = () => ({ ...randomLook('femme', r), outfit: 'abaya', outfitColor: ['#14213d', '#5b2a86', '#1f6f5c', '#6b2c2c', '#f4f1ea'][Math.floor(r() * 5)] })
    if (friday) {
      // Shoulder to shoulder, the rows filling from the front; the Sim's place left in the fourth.
      for (let row = 0; row < 12; row++)
        for (let k = 0; k < 22; k++) {
          const x = (k - 10.5) * 0.95
          const z = ROW0 + row * ROW
          if (Math.hypot(x - 1.2, z - SPOTS.pray.at[1]) < 0.6 || COL_X.some((cx) => Math.abs(x - cx) < 0.7) && COL_Z.some((cz) => Math.abs(z - cz) < 0.8)) continue
          out.push({ p: [x, 0, z], gender: 'homme', look: man(), seed: r() * 100, pose: 'salat' })
        }
      for (let row = 0; row < 2; row++) for (let k = 0; k < 16; k++) out.push({ p: [(k - 7.5) * 0.95, 0, SCREEN_Z + 1.3 + row * ROW], gender: 'femme', look: woman(), seed: r() * 100, pose: 'salat' })
    } else {
      for (let i = 0; i < 14; i++) {
        const femme = i % 5 === 4
        const [x, z] = [(r() - 0.5) * 50, femme ? SCREEN_Z + 1.5 + r() * 3 : ROW0 + r() * 30]
        if (!free(x, z)) continue
        out.push({ p: [x, 0, z], gender: femme ? 'femme' : 'homme', look: femme ? woman() : man(), seed: r() * 100, pose: (['salat', 'pray', 'salat', 'idle'] as Pose[])[i % 4] })
      }
    }
    return out
  }, [friday])
  const imam = useMemo(() => ({ ...randomLook('homme', rng('m6-imam')), outfit: 'imam', outfitColor: '#f8f9fa', accessory: 'kufi' }), [])
  return (
    <NoShadows>
      {rows.map((p, i) => (
        <group key={i} position={p.p} rotation={[0, Math.PI, 0]}>
          <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
        </group>
      ))}
      {/* The imam before the mihrab, leading; out of prayer, the guardian by the door */}
      <group position={friday ? [0, 0, HALL.back + 2.8] : [-3, 0, HALL.front + 2]} rotation={[0, Math.PI, 0]}>
        <TalkHuman id={friday ? 'm6-imam' : 'm6-gardien'} look={imam} gender="homme" pose={friday ? 'salat' : 'idle'} seed={4} />
      </group>
    </NoShadows>
  )
}
