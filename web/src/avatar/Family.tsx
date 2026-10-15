import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { Character } from '../world3d/Character'
import { Vehicle } from '../world3d/vehicles'
import { worldTime } from '../lib/worldClock'
import { fullLook } from './options'
import { tint } from './textures'
import type { Pose } from './Human'

// The family a Sim is born into, as you see it at the birth: the baby (the
// player's Sim) between papa and maman, in front of their home. How they
// dress says what the family has, from gnambro (torn, dirty clothes,
// barefoot, the flies buzzing round them, a tin shack) to debout (gold,
// bazin and suits, the villa, the pool and the 4x4, all sparkling).
// The looks are the game's caricatures of each class, not a portrait of anyone.

type Parent = { gender: Sim['gender']; look: Required<Look>; pose: Pose }
type Cast = { papa: Parent; maman: Parent; baby: Look; aura: 'flies' | 'sparkles' | null }

const GOLD = '#d4a017'

/** Papa, maman and the baby, dressed as the family can afford; skin and hair from the baby. */
export function familyCast(familyId: string, child: Look): Cast {
  const c = fullLook(child)
  const base = (gender: Sim['gender'], shift: number): Required<Look> => ({ ...c, skin: tint(c.skin, shift), hairColor: c.hairColor, height: 1, body: 'moyen', marks: 'none', beard: 'none', accessory: 'none', accessoryColor: '', bottomColor: '', shoeColor: '', wear: 'neuf', hair: gender === 'homme' ? 'short' : 'headwrap', eyes: c.eyes })
  const p = (look: Partial<Look>, pose: Pose = 'idle'): Parent => ({ gender: 'homme', look: { ...base('homme', -0.06), ...look } as Required<Look>, pose })
  const m = (look: Partial<Look>, pose: Pose = 'idle'): Parent => ({ gender: 'femme', look: { ...base('femme', 0.04), ...look } as Required<Look>, pose })
  switch (familyId) {
    case 'gnambro':
      return {
        papa: p({ outfit: 'souscorps', outfitColor: '#e6dcc4', bottomColor: '#5b5040', shoeColor: c.skin, wear: 'dechire', beard: 'full', hair: 'afro' }),
        maman: m({ outfit: 'pagne', outfitColor: '#9a6b3c', pattern: 'points', bottomColor: '#7a5a3a', shoeColor: c.skin, wear: 'dechire', hair: 'headwrap' }, 'busy'),
        baby: { ...child, wear: 'dechire' },
        aura: 'flies',
      }
    case 'coule':
      return {
        papa: p({ outfit: 'debardeur', outfitColor: '#ece6d8', bottomColor: '#4a5566', shoeColor: '#2b2b2b', wear: 'use', beard: 'bouc' }),
        maman: m({ outfit: 'pagne', outfitColor: '#c2551f', pattern: 'losanges', shoeColor: '#2b2b2b', wear: 'use', hair: 'headwrap' }),
        baby: { ...child, wear: 'use' },
        aura: null,
      }
    case 'poignon':
      return {
        papa: p({ outfit: 'chemise', outfitColor: '#7fa7d6', bottomColor: '#2b2f45', shoeColor: '#141416', accessory: 'watch', accessoryColor: '#c7ccd2', beard: 'moustache' }),
        maman: m({ outfit: 'kaba', outfitColor: '#00a862', pattern: 'feuilles', shoeColor: '#6b4423', hair: 'braids', accessory: 'earrings', accessoryColor: '#c7ccd2' }, 'wave'),
        baby: child,
        aura: null,
      }
    case 'lagnon':
      return {
        papa: p({ outfit: 'chemise-pagne', outfitColor: '#1d4ed8', pattern: 'kente', bottomColor: '#141416', shoeColor: '#6b4423', accessory: 'glasses', accessoryColor: '#141416', beard: 'collier' }, 'phone'),
        maman: m({ outfit: 'robe', outfitColor: '#d6336c', pattern: 'cercles', shoeColor: '#141416', hair: 'weave', accessory: 'earrings', accessoryColor: GOLD }, 'wave'),
        baby: child,
        aura: null,
      }
    case 'late':
      return {
        papa: p({ outfit: 'bazin', outfitColor: '#f2e3b3', bottomColor: '#f2e3b3', shoeColor: '#6b4423', accessory: 'chain', accessoryColor: GOLD, beard: 'bouc', hair: 'degrade' }, 'phone'),
        maman: m({ outfit: 'bazin', outfitColor: '#7a1f3d', shoeColor: GOLD, hair: 'weave', accessory: 'sunglasses', accessoryColor: GOLD }, 'wave'),
        baby: child,
        aura: 'sparkles',
      }
    default: // debout
      return {
        papa: p({ outfit: 'suit', outfitColor: '#1b2340', bottomColor: '#1b2340', shoeColor: '#141416', accessory: 'sunglasses', accessoryColor: '#141416', beard: 'collier', hair: 'degrade' }, 'phone'),
        maman: m({ outfit: 'bazin', outfitColor: '#f8f9fa', shoeColor: GOLD, hair: 'bun', accessory: 'chain', accessoryColor: GOLD }, 'wave'),
        baby: child,
        aura: 'sparkles',
      }
  }
}

/** Flies buzzing round someone's head: quick, never quite the same loop. */
function Flies({ at, n = 7, seed = 0 }: { at: [number, number, number]; n?: number; seed?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const paths = useMemo(() => [...Array(n)].map((_, i) => ({ a: 5 + ((i * 37 + seed * 11) % 7) * 0.6, b: 7 + ((i * 53 + seed) % 5), ph: i * 1.9 + seed, r: 0.22 + (i % 3) * 0.08 })), [n, seed])
  useFrame(() => {
    const t = worldTime()
    paths.forEach((f, i) => {
      const m = refs.current[i]
      if (!m) return
      const jitter = Math.sin(t * 31 + f.ph) * 0.02
      m.position.set(at[0] + Math.sin(t * f.a + f.ph) * f.r + jitter, at[1] + Math.sin(t * f.b + f.ph * 2) * 0.12, at[2] + Math.cos(t * f.a * 0.8 + f.ph) * f.r)
    })
  })
  return (
    <>
      {paths.map((_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} scale={0.045}>
          <boxGeometry />
          <meshBasicMaterial color="#111111" />
        </mesh>
      ))}
    </>
  )
}

/** Gold sparkles that wink on and off round the rich. */
function Sparkles({ at, n = 7, seed = 0 }: { at: [number, number, number]; n?: number; seed?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const spots = useMemo(() => [...Array(n)].map((_, i) => ({ x: Math.sin(i * 2.4 + seed) * 0.45, y: 0.3 + ((i * 0.37 + seed * 0.1) % 1) * 1.6, z: Math.cos(i * 2.4 + seed) * 0.3, ph: i * 0.9 + seed })), [n, seed])
  useFrame(() => {
    const t = worldTime()
    spots.forEach((s, i) => {
      const m = refs.current[i]
      if (!m) return
      const k = Math.max(0, Math.sin(t * 3 + s.ph))
      m.scale.setScalar(0.06 * k)
      m.rotation.set(t, t * 1.3, 0)
    })
  })
  return (
    <>
      {spots.map((s, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} position={[at[0] + s.x, at[1] + s.y, at[2] + s.z]}>
          <octahedronGeometry />
          <meshBasicMaterial color={i % 3 ? '#ffd54f' : '#ffffff'} />
        </mesh>
      ))}
    </>
  )
}

type B = { p: [number, number, number]; s: [number, number, number]; c: string }
function Blocks({ list }: { list: B[] }) {
  return (
    <>
      {list.map((b, i) => (
        <mesh key={i} position={b.p} scale={b.s} castShadow receiveShadow>
          <boxGeometry />
          <meshLambertMaterial color={b.c} />
        </mesh>
      ))}
    </>
  )
}

/** The home behind the family, in blocks: the ground and what stands at the back. */
function Home({ familyId }: { familyId: string }) {
  const set = useMemo((): { ground: string; blocks: B[]; pool?: boolean; car?: string } => {
    switch (familyId) {
      case 'gnambro': {
        // A shack of mismatched rusty tin, a plank door, a bucket, a puddle.
        const tins = ['#8a4b2a', '#7d8288', '#a0522d', '#6b6f73', '#94582e']
        const blocks: B[] = tins.map((c, i) => ({ p: [-2.4 + i * 1.2, 1, -1.6 + (i % 2) * 0.05], s: [1.22, 2 + (i % 2) * 0.2, 0.06], c }))
        blocks.push({ p: [0, 2.15, -1.3], s: [6.4, 0.06, 1], c: '#7d8288' }, { p: [0.2, 0.85, -1.55], s: [0.8, 1.7, 0.05], c: '#6b4a2a' }, { p: [1.6, 0.2, -0.9], s: [0.4, 0.4, 0.4], c: '#2a6cf0' }, { p: [-1.9, 0.12, -0.6], s: [0.9, 0.24, 0.6], c: '#6b4a2a' })
        return { ground: '#8a6a48', blocks }
      }
      case 'coule':
        // The cour commune: a painted wall gone pale, the washing line, the charcoal stove.
        return {
          ground: '#9c9182',
          blocks: [
            { p: [0, 1.25, -1.6], s: [6.4, 2.5, 0.25], c: '#d9c7a0' },
            { p: [0, 0.25, -1.47], s: [6.4, 0.5, 0.02], c: '#a8957a' },
            { p: [-1.2, 0.95, -1.47], s: [0.9, 1.9, 0.05], c: '#2f6f9f' },
            { p: [0, 1.95, -0.9], s: [5, 0.02, 0.02], c: '#333333' },
            { p: [-1.4, 1.6, -0.9], s: [0.6, 0.7, 0.02], c: '#e8590c' },
            { p: [0.4, 1.65, -0.9], s: [0.5, 0.6, 0.02], c: '#2b8a3e' },
            { p: [1.6, 0.25, -0.7], s: [0.35, 0.5, 0.35], c: '#3a3d42' },
          ],
        }
      case 'poignon':
        return {
          ground: '#cfc6b8',
          blocks: [
            { p: [0, 1.4, -1.6], s: [6.4, 2.8, 0.25], c: '#f1e3c6' },
            { p: [1.6, 1.5, -1.46], s: [1.2, 1, 0.05], c: '#5a7ea6' },
            { p: [-1.6, 1.05, -1.46], s: [0.9, 2.1, 0.05], c: '#8a5a2b' },
            { p: [2.3, 0.3, -1.1], s: [0.5, 0.6, 0.5], c: '#c8b07a' },
            { p: [2.3, 0.85, -1.1], s: [0.7, 0.6, 0.7], c: '#2f7d32' },
          ],
        }
      case 'lagnon':
        return {
          ground: '#e9e4da',
          blocks: [
            { p: [0, 1.5, -1.6], s: [6.4, 3, 0.25], c: '#fdf6ec' },
            { p: [-2.2, 1.9, -1.4], s: [1.6, 1.4, 0.3], c: '#d6336c' },
            { p: [-2.2, 1.2, -1.4], s: [0.2, 1.6, 0.2], c: '#5a3a22' },
            { p: [1.4, 1.6, -1.46], s: [1.8, 1.2, 0.05], c: '#8fb8de' },
          ],
          car: '#9aa0a6',
        }
      case 'late':
        return {
          ground: '#efe9df',
          blocks: [
            { p: [0, 1.75, -1.7], s: [6.6, 3.5, 0.3], c: '#ffffff' },
            ...[-2.6, -0.9, 0.9, 2.6].map((x): B => ({ p: [x, 1.75, -1.45], s: [0.3, 3.5, 0.3], c: '#f1ece2' })),
            { p: [0, 3.6, -1.3], s: [6.8, 0.3, 1], c: '#c9a227' },
            { p: [0, 1.2, -1.53], s: [1.4, 2.4, 0.05], c: '#4a3426' },
          ],
          car: '#141416',
        }
      default:
        return {
          ground: '#f3efe8',
          blocks: [
            { p: [0, 2, -2.2], s: [7, 4, 0.3], c: '#ffffff' },
            ...[-3, -1.5, 0, 1.5, 3].map((x): B => ({ p: [x, 2, -1.95], s: [0.3, 4, 0.3], c: '#f6f1e6' })),
            { p: [0, 4.1, -1.8], s: [7.2, 0.35, 1.2], c: '#c9a227' },
            { p: [-3.2, 1.6, -1.2], s: [0.35, 3.2, 0.35], c: '#7a5233' },
            { p: [-3.2, 3.3, -1.2], s: [1.8, 0.3, 1.8], c: '#2f7d32' },
          ],
          pool: true,
          car: '#ffffff',
        }
    }
  }, [familyId])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshLambertMaterial color={set.ground} />
      </mesh>
      {familyId === 'gnambro' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.1, 0.005, 0.9]}>
          <circleGeometry args={[0.45, 12]} />
          <meshLambertMaterial color="#5c4a36" />
        </mesh>
      )}
      {set.pool && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.6, 0.01, -0.8]}>
          <planeGeometry args={[2.2, 1.4]} />
          <meshLambertMaterial color="#38b6e8" emissive="#1c7fb0" emissiveIntensity={0.25} />
        </mesh>
      )}
      <Blocks list={set.blocks} />
      {set.car && <Vehicle p={[3.1, 0, -0.9]} r={-0.7} kind="car" color={set.car} />}
    </group>
  )
}

/** The family in front of their home, the baby in the middle with its losange (no camera: for any scene). */
export function FamilyGroup({ familyId, look, gender }: { familyId: string; look: Look; gender: Sim['gender'] }) {
  const cast = useMemo(() => familyCast(familyId, look), [familyId, look])
  const people: { at: [number, number, number]; who: Parent }[] = [
    { at: [-0.75, 0, 0.1], who: cast.papa },
    { at: [0.75, 0, 0.1], who: cast.maman },
  ]
  return (
    <>
      <Home familyId={familyId} />
      {people.map(({ at, who }, i) => (
        <group key={i} position={at} rotation={[0, i ? -0.25 : 0.25, 0]}>
          <Character look={who.look} gender={who.gender} pose={who.pose} plumbob={false} seed={i * 3.3} />
        </group>
      ))}
      <group position={[0, 0, 0.75]}>
        <Character look={cast.baby} gender={gender} stage="bebe" pose="idle" />
      </group>
      {cast.aura === 'flies' && (
        <>
          <Flies at={[-0.75, 1.75, 0.1]} seed={1} />
          <Flies at={[0.75, 1.7, 0.1]} seed={2} />
          <Flies at={[0, 0.55, 0.75]} n={3} seed={3} />
        </>
      )}
      {cast.aura === 'sparkles' && (
        <>
          <Sparkles at={[-0.75, 0, 0.1]} seed={1} />
          <Sparkles at={[0.75, 0, 0.1]} seed={2} />
        </>
      )}
    </>
  )
}

/** The birth: the family at home, seen from the front; drag to look round a little. */
export function FamilyScene({ familyId, look, gender, className = '' }: { familyId: string; look: Look; gender: Sim['gender']; className?: string }) {
  return (
    <Canvas className={className} shadows dpr={[1, 2]} camera={{ position: [0, 1.35, 4.4], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <hemisphereLight args={['#fff4e6', '#8a6a48', 1.1]} />
      <directionalLight position={[2.5, 5, 4]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={0.4} />
      <FamilyGroup familyId={familyId} look={look} gender={gender} />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.3} scale={6} blur={2.4} far={2} />
      <OrbitControls target={[0, 0.85, 0]} enablePan={false} enableZoom={false} minPolarAngle={1.1} maxPolarAngle={1.5} minAzimuthAngle={-0.6} maxAzimuthAngle={0.6} rotateSpeed={0.6} />
    </Canvas>
  )
}
