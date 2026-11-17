import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import type { Pose } from '../../avatar/Human'
import { Character } from '../../world3d/Character'
import { sceneDpr } from '../../lib/device'
import { t as tr } from '../../lib/i18n'
import { MiniScene } from '../../world3d/minijeux'
import { Lampe, MondeMesh, Surface, useMondes, type Monde, type MondeTier } from '../../world3d/mondes'

// What the perso is doing at each step of a played action (components/defi/Gestes.tsx), seen: the
// perso itself, the game's own 3D model in its clothes, making the gesture by the bed, at the
// mirror, under the shower. The scene moves on with the combination, `k` from 0 (the first arrow)
// to 1 (done): the blanket pulled up the bed, the foam growing, the light going out, the perso
// lying down.

export type SceneId = 'lit' | 'dents' | 'lumiere' | 'coucher' | 'eau' | 'savon' | 'dos' | 'shampooing' | 'rincer' | 'secher'

type Props = { id: SceneId; k: number; look?: Look; gender?: 'femme' | 'homme'; stage?: string }

export const DEFAULT_LOOK = { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: tr('moyen'), height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', marks: 'none', wear: 'neuf' } as unknown as Look

/** The pose the perso holds at each step. */
const POSE: Record<SceneId, Pose> = { lit: 'busy', dents: 'brush', lumiere: 'busy', coucher: 'sleep', eau: 'wash', savon: 'wash', dos: 'wash', shampooing: 'wash', rincer: 'wash', secher: 'busy' }
const BED: SceneId[] = ['lit', 'coucher']
const SHOWER: SceneId[] = ['eau', 'savon', 'dos', 'shampooing', 'rincer', 'secher']

export function StepScene({ id, k, look, gender = 'homme', stage = 'adulte' }: Props) {
  const kk = Math.max(0, Math.min(1, k))
  const dark = id === 'lumiere' && kk >= 1
  return (
    <Canvas dpr={sceneDpr} camera={{ position: [2.2, 1.55, 2.7], fov: 34 }} onCreated={({ camera }) => camera.lookAt(0.2, 0.85, 0)} style={{ background: dark ? '#1d2147' : SHOWER.includes(id) ? '#dff1f8' : '#f6ead6' }}>
      <MiniScene kind={dark ? 'keep' : 'table'} near={6} far={20} />
      <ambientLight intensity={dark ? 0.35 : 0.9} />
      <directionalLight position={[3, 5, 4]} intensity={dark ? 0.15 : 1.1} />
      <Suspense fallback={null}>
        <Room id={id} k={kk} />
        <Dressed id={id} dark={dark} />
        <Perso id={id} k={kk} look={look ?? DEFAULT_LOOK} gender={gender} stage={stage} />
      </Suspense>
    </Canvas>
  )
}

/** The perso, its pose, and for lying down, laid on the bed little by little. */
function Perso({ id, k, look, gender, stage }: { id: SceneId; k: number; look: Look; gender: 'femme' | 'homme'; stage: string }) {
  const g = useRef<THREE.Group>(null)
  useFrame((st) => {
    const o = g.current
    if (!o) return
    if (id === 'coucher') {
      // From standing by the bed to lying on it.
      o.position.set(-0.2 + 0.75 * k, 0.55 * k, 0)
      o.rotation.set(0, Math.PI / 2, 0)
      o.rotation.z = 0
      o.rotation.x = 0
      o.children[0]?.rotation.set(-Math.PI / 2 * k, 0, 0)
    } else if (id === 'lit') {
      // Bent over the bed, pulling the blanket up, a little to and fro.
      o.position.set(-0.35, 0, 0.55 + Math.sin(st.clock.elapsedTime * 3) * 0.04)
      o.rotation.set(0, Math.PI * 0.75, 0)
    } else if (id === 'dents') o.position.set(-0.1, 0, 0.3), o.rotation.set(0, Math.PI * 0.62, 0)
    else if (id === 'lumiere') o.position.set(-0.05, 0, 0.35), o.rotation.set(0, Math.PI * 0.62, 0)
    else o.position.set(0, 0, 0), o.rotation.set(0, Math.PI / 6, 0)
  })
  const pose: Pose = id === 'coucher' ? (k > 0.5 ? 'sleep' : 'idle') : POSE[id]
  const worn = SHOWER.includes(id) && id !== 'secher' ? ({ ...look, outfit: 'serviette', accessory: 'none' } as Look) : look
  return (
    <group ref={g}>
      <group>
        <Character look={worn} gender={gender} stage={stage} pose={pose} marker={false} />
      </group>
    </group>
  )
}

/** The room round the step: the bed and its blanket, the mirror and the basin, the switch, the shower. */
function Room({ id, k }: { id: SceneId; k: number }) {
  const t = useRef(0)
  // « Mini-jeux réalistes »: the static furniture is drawn by <Dressed>; the moving things stay here.
  const dressed = useMondes() !== 'off'
  useFrame((_, dt) => void (t.current += dt))
  if (BED.includes(id)) {
    const cover = id === 'lit' ? 0.15 + 0.85 * k : k >= 1 ? 0.7 : 0
    return (
      <group position={[0.75, 0, -0.1]}>
        {!dressed && (
          <>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[1.0, 0.3, 2.0]} />
          <meshLambertMaterial color="#8a5a32" />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.95, 0.12, 1.95]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.55, -0.98]}>
          <boxGeometry args={[1.04, 0.6, 0.08]} />
          <meshLambertMaterial color="#6b4426" />
        </mesh>
          </>
        )}
        <mesh position={[0, 0.52, -0.75]} scale={[1, id === 'lit' && k > 0.8 ? 1.3 : 1, 1]}>
          <boxGeometry args={[0.6, 0.1, 0.3]} />
          <meshLambertMaterial color="#f4f1ea" />
        </mesh>
        {cover > 0 && (
          <mesh position={[0, 0.5, 0.95 - (1.6 * cover) / 2]}>
            <boxGeometry args={[0.98, 0.06, 1.6 * cover]} />
            <meshLambertMaterial color={dressed ? '#2f6fb0' : '#4dabf7'} />
          </mesh>
        )}
      </group>
    )
  }
  if (id === 'dents')
    return (
      <group position={[0.5, 0, 0.12]} rotation={[0, Math.PI, 0]}>
        {!dressed && (
          <>
            <mesh position={[0, 0.8, 0]}>
              <boxGeometry args={[0.1, 0.12, 0.6]} />
              <meshLambertMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.05, 1.45, 0]}>
              <boxGeometry args={[0.04, 0.7, 0.55]} />
              <meshLambertMaterial color="#cfe8f2" />
            </mesh>
          </>
        )}
        {/* The foam growing round the mouth */}
        {[...Array(Math.round(k * 7))].map((_, i) => (
          <mesh key={i} position={[0.42, 1.38 + (i % 2) * 0.03, -0.06 + i * 0.02]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
    )
  if (id === 'lumiere') {
    const off = k >= 1
    return (
      <group>
        {!dressed && (
          <mesh position={[0.5, 1.2, -0.6]}>
            <boxGeometry args={[0.04, 2.4, 1.2]} />
            <meshLambertMaterial color="#efe3cf" />
          </mesh>
        )}
        <mesh position={[0.47, 1.25, 0.12]}>
          <boxGeometry args={[0.03, 0.16, 0.1]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.45, off ? 1.21 : 1.29, 0.12]}>
          <boxGeometry args={[0.03, 0.05, 0.05]} />
          <meshLambertMaterial color="#2b2b2b" />
        </mesh>
        {dressed && (
          <mesh position={[0.3, 2.45, 0]}>
            <boxGeometry args={[0.012, 0.4, 0.012]} />
            <meshLambertMaterial color="#1a1a1a" />
          </mesh>
        )}
        <mesh position={[0.3, 2.2, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color={off ? '#3a3f6a' : '#ffe066'} />
        </mesh>
        {!off && <pointLight position={[0.3, 2.0, 0]} intensity={1.2} distance={4} color="#fff3bf" />}
      </group>
    )
  }
  // The shower: its head, the water falling, the bubbles (soap, shampoo) as far as they've got.
  const water = id === 'eau' ? k : id === 'secher' ? 0 : 1
  const foam = id === 'savon' ? k : id === 'dos' ? 0.6 : id === 'shampooing' ? 0.4 : id === 'rincer' ? 1 - k : 0
  return (
    <group>
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.04, 16]} />
        <meshLambertMaterial color="#9aa1a8" />
      </mesh>
      {[...Array(Math.round(water * 14))].map((_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.4) * 0.12, 1.45, Math.sin(i * 2.4) * 0.12]}>
          <cylinderGeometry args={[0.006, 0.006, 1.6, 4]} />
          <meshBasicMaterial color="#74c0fc" transparent opacity={0.7} />
        </mesh>
      ))}
      {[...Array(Math.round(foam * 12))].map((_, i) => (
        <mesh key={`f${i}`} position={[Math.cos(i * 1.7) * 0.2, 0.9 + (i % 4) * 0.15, Math.sin(i * 1.7) * 0.2]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
      ))}
      {id === 'shampooing' &&
        [...Array(Math.round(k * 9))].map((_, i) => (
          <mesh key={`h${i}`} position={[Math.cos(i * 0.7) * 0.11, 1.78 + (i % 3) * 0.04, Math.sin(i * 0.7) * 0.11]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}
      {id === 'secher' && (
        <mesh position={[0.05 + Math.sin(t.current * 6) * 0.1, 1.55, 0.18]} rotation={[0, 0, Math.sin(t.current * 6) * 0.3]}>
          <boxGeometry args={[0.5, 0.12, 0.04]} />
          <meshLambertMaterial color="#ff8fb1" />
        </mesh>
      )}
      {!dressed && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.6, 24]} />
          <meshLambertMaterial color="#c5dfe9" />
        </mesh>
      )}
    </group>
  )
}

/**
 * « Mini-jeux réalistes »: the room round the step, dressed. The bedroom (tiled floor, plastered walls,
 * the window with its glass louvres and curtain, the wooden bed and its headboard, the bedside table and
 * its lamp, the mat), the bathroom by the basin (wall tiles, pedestal basin, mirror, cup of brushes), the
 * switch on its wall, the shower corner (tiled walls and floor, the tray, the pipe, the bucket and its
 * cup, the soap). Shut: nothing (the old boxes stay).
 */
function Dressed({ id, dark }: { id: SceneId; dark: boolean }) {
  const tier = useMondes()
  if (tier === 'off') return null
  const shower = SHOWER.includes(id)
  const tile = shower ? '#d8eef5' : '#efe6d6'
  const wallC = shower ? '#cfe6ee' : id === 'dents' ? '#e6eef0' : '#f0dcc0'
  return (
    <group>
      <Surface kind="carrelage" color={tile} tier={tier} p={[0.3, -0.05, 0.2]} s={[4.4, 0.1, 4]} />
      <Surface kind={shower || id === 'dents' ? 'carrelage' : 'enduit'} color={wallC} tier={tier} p={[0.3, 1.3, shower ? -0.75 : -1.45]} s={[4.4, 2.6, 0.1]} face="front" />
      <Surface kind={shower ? 'carrelage' : 'enduit'} color={wallC} tier={tier} p={[shower ? -0.75 : -1.6, 1.3, 0.2]} s={[0.1, 2.6, 4]} face="side" />
      <MondeMesh tier={tier} seed={`scene-${id}`} make={(m, t) => roomSet(m, t, id)} />
      {BED.includes(id) && <Lampe p={[-0.05, 0.86, -1.1]} i={0.5} d={3} light={tier !== 'simple' && !dark} color="#ffd9a0" />}
    </group>
  )
}

function roomSet(m: Monde, tier: MondeTier, id: SceneId) {
  const rich = tier !== 'simple'
  // Skirting along the walls (not in the shower).
  if (!SHOWER.includes(id)) {
    m.box([0.3, 0.05, -1.39], [4.4, 0.1, 0.02], '#8a6a4a', 'bois', undefined, 0)
    m.box([-1.54, 0.05, 0.2], [0.02, 0.1, 4], '#8a6a4a', 'bois', undefined, 0)
  }
  if (BED.includes(id)) {
    // The bed (its middle at 0.75, -0.1, as the old boxes): frame, legs, the headboard in panels, the mattress, the sheet.
    const x = 0.75
    const z = -0.1
    m.box([x, 0.25, z], [1.04, 0.16, 2.02], '#7a4a26', 'bois')
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box([x + sx * 0.47, 0.09, z + sz * 0.95], [0.08, 0.18, 0.08], '#5a3418', 'bois', undefined, 0)
    m.box([x, 0.4, z], [0.96, 0.16, 1.94], '#f4f1ea', 'tissage', undefined, 0.02)
    m.box([x, 0.485, z + 0.1], [0.98, 0.02, 1.7], '#ffffff', 'plastique', undefined, 0)
    m.box([x, 0.62, z - 0.99], [1.1, 0.84, 0.07], '#6b3a1c', 'bois')
    m.box([x, 1.06, z - 0.99], [1.16, 0.06, 0.1], '#5a2f14', 'bois', undefined, 0)
    if (rich) for (const dx of [-0.26, 0.26]) m.box([x + dx, 0.66, z - 0.95], [0.42, 0.5, 0.02], '#7d4826', 'bois', undefined, 0)
    m.box([x, 0.33, z + 1.0], [1.06, 0.3, 0.06], '#6b3a1c', 'bois')
    // The bedside table and its drawer, the lamp's foot and shade.
    m.box([-0.05, 0.32, -1.1], [0.42, 0.64, 0.36], '#7a4a26', 'bois')
    m.box([-0.05, 0.48, -0.91], [0.34, 0.14, 0.02], '#5a3418', 'bois', undefined, 0)
    m.box([-0.05, 0.48, -0.895], [0.08, 0.02, 0.02], '#c9a227', 'tole', undefined, 0)
    m.box([-0.05, 0.67, -1.1], [0.12, 0.06, 0.12], '#3a3a3a', 'plastique', undefined, 0)
    m.box([-0.05, 0.74, -1.1], [0.02, 0.12, 0.02], '#3a3a3a', 'plastique', undefined, 0)
    m.box([-0.05, 0.9, -1.1], [0.22, 0.14, 0.22], '#f5e6c8', 'tissage', undefined, 0)
    // The mat by the bed.
    m.box([-0.2, 0.005, 0.25], [0.8, 0.01, 1.2], '#c8a060', 'tissage', undefined, 0.02)
    // The window and its glass louvres (naco), the curtain on its rod.
    m.box([0.75, 1.75, -1.39], [1.2, 0.9, 0.03], '#f8f9fa', 'plastique', undefined, 0)
    for (let k = 0; k < (rich ? 6 : 3); k++) m.box([0.75, 1.38 + k * (rich ? 0.14 : 0.28), -1.37], [1.1, rich ? 0.1 : 0.2, 0.012], '#9fc8d8', 'plastique', [0.4, 0, 0], 0)
    m.box([0.75, 2.24, -1.33], [1.6, 0.04, 0.04], '#8a8a8a', 'tole', undefined, 0)
    for (const dx of [-0.68, 0.68]) m.box([0.75 + dx, 1.7, -1.32], [0.3, 1.1, 0.03], '#c2410c', 'rayure', undefined, 0.02)
    // A wax print framed on the side wall.
    m.box([-1.53, 1.5, -0.4], [0.03, 0.55, 0.75], '#5a3418', 'bois', undefined, 0)
    m.box([-1.51, 1.5, -0.4], [0.02, 0.45, 0.65], '#e8a317', 'rayure', undefined, 0)
  } else if (id === 'dents') {
    // The pedestal basin and the mirror (where the old boxes stood: x 0.5, z 0.12), the cup of brushes, the soap.
    m.box([0.5, 0.4, 0.12], [0.16, 0.8, 0.2], '#f8f9fa', 'plastique', undefined, 0)
    m.box([0.48, 0.82, 0.12], [0.34, 0.12, 0.6], '#ffffff', 'plastique', undefined, 0)
    m.box([0.45, 0.885, 0.12], [0.22, 0.01, 0.42], '#c8d4da', 'plastique', undefined, 0)
    m.box([0.58, 0.95, 0.12], [0.04, 0.14, 0.04], '#c0c6cc', 'tole', undefined, 0)
    m.box([0.52, 1.02, 0.12], [0.12, 0.03, 0.03], '#c0c6cc', 'tole', undefined, 0)
    m.box([0.6, 1.45, 0.12], [0.03, 0.78, 0.62], '#5a6470', 'tole', undefined, 0)
    m.box([0.58, 1.45, 0.12], [0.02, 0.7, 0.55], '#cfe8f2', 'plastique', undefined, 0)
    m.box([0.52, 0.93, 0.36], [0.06, 0.09, 0.06], '#4dabf7', 'plastique', undefined, 0)
    for (let k = 0; k < 2; k++) m.box([0.52 + k * 0.015, 1.0, 0.36], [0.012, 0.12, 0.012], k ? '#e03131' : '#2f9e44', 'plastique', [0.15 - k * 0.3, 0, 0], 0)
    m.box([0.5, 0.9, -0.12], [0.08, 0.03, 0.05], '#ffd8e8', 'plastique', undefined, 0)
    // A towel on its rail on the side wall.
    m.box([-1.53, 1.3, -0.3], [0.04, 0.03, 0.6], '#c0c6cc', 'tole', undefined, 0)
    m.box([-1.52, 1.05, -0.3], [0.03, 0.5, 0.48], '#f783ac', 'tissage', undefined, 0.02)
  } else if (id === 'lumiere') {
    // The wall the switch is on (x 0.5), plastered; the switch's plate is the old mesh; its wire up the wall.
    m.box([0.52, 1.2, -0.6], [0.06, 2.4, 1.6], '#efe3cf', 'banco', undefined, 0.02)
    m.box([0.48, 0.05, -0.6], [0.02, 0.1, 1.6], '#8a6a4a', 'bois', undefined, 0)
    m.box([0.48, 1.76, 0.12], [0.012, 0.85, 0.012], '#f8f9fa', 'plastique', undefined, 0)
    // A shirt on its hook, a calendar.
    m.box([0.47, 1.65, -0.75], [0.05, 0.05, 0.05], '#5a5a5a', 'tole', undefined, 0)
    m.box([0.45, 1.35, -0.75], [0.04, 0.6, 0.36], '#3b5bdb', 'tissage', undefined, 0.02)
    m.box([0.48, 1.6, -1.2], [0.01, 0.42, 0.3], '#f8f9fa', 'plastique', undefined, 0)
    m.box([0.475, 1.74, -1.2], [0.01, 0.12, 0.3], '#e03131', 'plastique', undefined, 0)
  } else {
    // The shower: the tray, the drain, the pipe up the wall to the head, the tap, the bucket and its cup, the soap dish.
    m.box([0, 0.03, 0], [1.3, 0.06, 1.3], '#f1f3f5', 'plastique', undefined, 0)
    m.box([0, 0.065, 0], [0.12, 0.01, 0.12], '#868e96', 'tole', undefined, 0)
    m.box([0, 1.5, -0.68], [0.04, 1.5, 0.04], '#adb5bd', 'tole', undefined, 0)
    m.box([0, 2.25, -0.34], [0.04, 0.04, 0.68], '#adb5bd', 'tole', undefined, 0)
    m.box([0, 1.1, -0.66], [0.14, 0.08, 0.06], '#adb5bd', 'tole', undefined, 0)
    m.box([-0.45, 0.17, 0.45], [0.34, 0.28, 0.34], '#1c7ed6', 'plastique', undefined, 0)
    m.box([-0.45, 0.31, 0.45], [0.3, 0.01, 0.3], '#9fd0e8', 'plastique', undefined, 0)
    m.box([-0.42, 0.34, 0.45], [0.1, 0.06, 0.1], '#fab005', 'plastique', undefined, 0)
    m.box([-0.66, 1.15, 0.2], [0.14, 0.03, 0.2], '#dee2e6', 'plastique', undefined, 0)
    m.box([-0.64, 1.19, 0.2], [0.07, 0.04, 0.12], '#ffe066', 'plastique', undefined, 0)
    if (rich) m.box([-0.66, 1.28, -0.2], [0.08, 0.2, 0.08], '#ae3ec9', 'plastique', undefined, 0)
  }
}
