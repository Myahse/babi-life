import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'

// Adjamé's market, the commune's merchant heart: the big concrete market
// building (the Forum) with its shops behind metal shutters on the ground
// floor and open galleries above; in front, down to the road, the market
// itself: rows of stalls under parasols and tin, cloth by the bolt, piles of
// tomatoes, onions, plantain, shoes, basins, second-hand clothes; the
// sellers behind their tables, the crowd in the alleys, the pousseurs with
// their carts, the women with a basin on the head. The layout is the game's
// (the place's position is approximate: backend world/world.go).
// Frame: +z toward the main road.

const concrete = new THREE.MeshLambertMaterial({ color: '#d8d2c4' })
const concreteDark = new THREE.MeshLambertMaterial({ color: '#b8b0a0' })
const ground = new THREE.MeshLambertMaterial({ color: '#9c8b74', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const tin = new THREE.MeshLambertMaterial({ color: '#a9b0b6', side: THREE.DoubleSide })
const rust = new THREE.MeshLambertMaterial({ color: '#8a5a3a', side: THREE.DoubleSide })
const wood = new THREE.MeshLambertMaterial({ color: '#7a5233' })
const iron = new THREE.MeshLambertMaterial({ color: '#3a3d42' })
const goods = new THREE.MeshLambertMaterial({ color: '#ffffff' })

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** What a stall sells: colours of its piles (and how they're piled). */
const WARES: { colors: string[]; kind: 'pile' | 'bolts' | 'pairs' | 'basins' | 'heap' }[] = [
  { colors: ['#d62828', '#e85d04', '#c1121f'], kind: 'pile' }, // tomatoes, piments
  { colors: ['#7b2d5b', '#9d4edd', '#c8a2c8'], kind: 'pile' }, // onions
  { colors: ['#e7c23a', '#a3b18a', '#f2cc8f'], kind: 'pile' }, // plantain, bananas
  { colors: ['#ff7a00', '#00a862', '#1d4ed8', '#d6336c', '#f2c94c', '#7b5cff'], kind: 'bolts' }, // pagne
  { colors: ['#141416', '#f4f4f4', '#6b4423', '#c92a2a'], kind: 'pairs' }, // shoes
  { colors: ['#2f7fd0', '#e8432f', '#1f9a4a', '#f2a81d'], kind: 'basins' }, // plastic basins
  { colors: ['#4361ee', '#e9ecef', '#495057', '#e5989b', '#588157'], kind: 'heap' }, // second-hand clothes
  { colors: ['#6b705c', '#a98467', '#ddb892'], kind: 'pile' }, // yams, cassava
]
const PARASOLS = ['#e8432f', '#1f9a4a', '#f2a81d', '#2f7fd0', '#ffffff', '#ff7a00']

/** The stalls in rows, with what's on them; the alleys between them run along x. */
function layout() {
  const r = rng('adjame-marche')
  const tables: Block[] = []
  const legs: Block[] = []
  const wares: Block[] = []
  const posts: Block[] = []
  const roofs: { p: [number, number, number]; s: [number, number, number]; rust: boolean }[] = []
  const parasols: { p: [number, number, number]; c: string }[] = []
  const sellers: { p: [number, number, number]; ry: number }[] = []
  const ROWS = [8, 15, 22, 29] // z of each row of stalls (the Forum is behind, at negative z)
  for (const z of ROWS)
    for (let x = -36; x <= 36; x += 4.5) {
      if (Math.abs(x) < 3) continue // the way through, up to the Forum's door
      if (r() < 0.08) continue
      const w = WARES[Math.floor(r() * WARES.length)]
      tables.push({ p: [x, 0.8, z], s: [3.4, 0.08, 1.6], c: r() < 0.5 ? '#8a5a32' : '#a97c50' })
      for (const [dx, dz] of [[-1.55, -0.7], [1.55, -0.7], [-1.55, 0.7], [1.55, 0.7]]) legs.push({ p: [x + dx, 0.4, z + dz], s: [0.08, 0.8, 0.08] })
      // The goods on the table.
      for (let k = 0; k < 6; k++) {
        const c = w.colors[Math.floor(r() * w.colors.length)]
        const [gx, gz] = [x - 1.2 + (k % 3) * 1.2, z - 0.35 + Math.floor(k / 3) * 0.7]
        if (w.kind === 'pile') wares.push({ p: [gx, 0.95, gz], s: [0.7, 0.22, 0.5], c }, { p: [gx, 1.12, gz], s: [0.4, 0.14, 0.3], c })
        else if (w.kind === 'bolts') wares.push({ p: [gx, 0.94 + (k % 2) * 0.1, gz], s: [0.9, 0.18, 0.45], c }, { p: [gx, 1.12 + (k % 2) * 0.1, gz], s: [0.9, 0.16, 0.45], c: w.colors[(k + 2) % w.colors.length] })
        else if (w.kind === 'pairs') wares.push({ p: [gx - 0.15, 0.9, gz], s: [0.14, 0.1, 0.32], c }, { p: [gx + 0.15, 0.9, gz], s: [0.14, 0.1, 0.32], c })
        else if (w.kind === 'basins') wares.push({ p: [gx, 0.98, gz], s: [0.75, 0.28, 0.55], c }, { p: [gx, 1.18, gz], s: [0.68, 0.12, 0.5], c })
        else wares.push({ p: [gx, 0.98, gz], s: [1.0, 0.3, 0.6], c }, { p: [gx + 0.1, 1.2, gz], s: [0.7, 0.2, 0.45], c: w.colors[(k + 1) % w.colors.length] })
      }
      // Shade: a parasol, or tin on four posts.
      if (r() < 0.5) parasols.push({ p: [x, 0, z - 0.3], c: PARASOLS[Math.floor(r() * PARASOLS.length)] })
      else {
        for (const [dx, dz] of [[-1.9, -1.2], [1.9, -1.2], [-1.9, 1.0], [1.9, 1.0]]) posts.push({ p: [x + dx, 1.35, z + dz], s: [0.1, 2.7 + (dz < 0 ? 0.3 : 0), 0.1] })
        roofs.push({ p: [x, 2.85, z - 0.1], s: [4.3, 0.05, 2.8], rust: r() < 0.4 })
      }
      // The seller stands behind (on the Forum's side), facing the alley in front.
      if (r() < 0.5) sellers.push({ p: [x + (r() - 0.5) * 1.2, 0, z - 1.3], ry: 0 })
    }
  return { tables, legs, wares, posts, roofs, parasols, sellers, rows: ROWS }
}

/** Someone going along an alley and back: a loop over the market (same for everyone: the shared clock). */
function Goer({ look, gender, seed, z, from, to, speed, load }: { look: ReturnType<typeof randomLook>; gender: 'femme' | 'homme'; seed: number; z: number; from: number; to: number; speed: number; load: 'none' | 'basin' | 'cart' }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const L = to - from
    const s = ((worldTime() * speed + seed * 13) % (2 * L) + 2 * L) % (2 * L)
    const back = s > L
    g.position.set(back ? to - (s - L) : from + s, 0, z + (back ? 0.9 : -0.9))
    g.rotation.y = back ? -Math.PI / 2 : Math.PI / 2
  })
  return (
    <group ref={ref}>
      <Human look={look} gender={gender} pose="walk" seed={seed} speed={speed} />
      {/* A basin on the head (the arms stay free in Abidjan: it's balanced) */}
      {load === 'basin' && (
        <group position={[0, 1.83 * (look.height ?? 1), 0]}>
          <mesh geometry={BOX} scale={[0.62, 0.05, 0.62]} position={[0, -0.02, 0]}>
            <meshLambertMaterial color="#e8d6a8" />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.36, 0.26, 0.22, 10]} />
            <meshLambertMaterial color={seed % 2 > 1 ? '#2f7fd0' : '#c0c7cf'} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
            <meshLambertMaterial color={seed % 3 > 1.5 ? '#e7c23a' : '#d62828'} />
          </mesh>
        </group>
      )}
      {/* The pousseur's cart in front of him: a wooden bed on two wheels, sacks on it */}
      {load === 'cart' && (
        <group position={[0, 0, 1.15]}>
          <mesh geometry={BOX} material={wood} scale={[1.0, 0.1, 1.7]} position={[0, 0.62, 0]} castShadow />
          {[-0.52, 0.52].map((x) => (
            <mesh key={x} position={[x, 0.36, 0.2]} rotation={[0, 0, Math.PI / 2]} material={iron}>
              <cylinderGeometry args={[0.36, 0.36, 0.06, 10]} />
            </mesh>
          ))}
          {[0, 1, 2].map((k) => (
            <mesh key={k} geometry={BOX} scale={[0.75, 0.35, 0.5]} position={[0, 0.85 + (k === 2 ? 0.33 : 0), -0.45 + k * 0.5 - (k === 2 ? 0.5 : 0)]} castShadow>
              <meshLambertMaterial color={k === 1 ? '#f1ece2' : '#c9b48a'} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

export function MarcheAdjame({ night }: { night: boolean }) {
  const L = useMemo(layout, [])
  const sign = useMemo(() => lettering('FORUM DES MARCHÉS', '#1971c2', '#ffffff', '#ffd43b'), [])
  const signMat = useMemo(() => signMaterial(sign.t), [sign])
  signMat.emissiveIntensity = night ? 0.9 : 0
  const shutters = useMemo(() => {
    // The ground floor's shops: metal shutters, some up on their goods, painted.
    const r = rng('adjame-forum')
    const out: Block[] = []
    for (let x = -27; x <= 27; x += 3) {
      const open = r() < 0.6
      out.push({ p: [x, 1.4, 3.02], s: [2.6, 2.8, 0.05], c: open ? ['#ff7a00', '#00a862', '#d6336c', '#1d4ed8', '#f2c94c'][Math.floor(r() * 5)] : '#8d949b' })
      if (open) out.push({ p: [x, 0.5, 3.5], s: [2.2, 1.0, 0.8], c: WARES[Math.floor(r() * WARES.length)].colors[0] })
    }
    return out
  }, [])
  // The Forum: three floors above the shops, open galleries with railings, pillars.
  const forum = useMemo(() => {
    const out: Block[] = []
    for (let f = 1; f <= 3; f++) {
      out.push({ p: [0, f * 4 + 0.2, 3.1], s: [60, 0.4, 0.6] }) // the gallery's slab edge
      out.push({ p: [0, f * 4 + 1.2, 3.3], s: [60, 0.12, 0.1] }) // railing
    }
    for (let x = -30; x <= 30; x += 6) out.push({ p: [x, 8, 3.2], s: [0.7, 16, 0.7] }) // pillars
    return out
  }, [])
  const cast = useMemo(() => {
    const r = rng('adjame-gens')
    return [...Array(14)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [])
  // The crowd: sellers at their tables, browsers stopped at stalls, people going along the alleys.
  const browsers = useMemo(() => {
    const r = rng('adjame-chalands')
    return [...Array(14)].map(() => {
      const row = L.rows[Math.floor(r() * L.rows.length)]
      const pose: Pose = (['talk', 'idle', 'talk', 'phone', 'idle'] as Pose[])[Math.floor(r() * 5)]
      return { p: [(r() - 0.5) * 70, 0, row + 1.6 + r() * 1.2] as [number, number, number], ry: Math.PI + (r() - 0.5) * 0.8, pose }
    })
  }, [L.rows])
  const goers = useMemo(() => {
    const r = rng('adjame-passants')
    return [...Array(12)].map((_, i) => ({
      z: L.rows[i % L.rows.length] + 3.5,
      from: -38,
      to: 38,
      speed: 1 + r() * 0.5,
      load: (i % 4 === 1 ? 'basin' : i % 6 === 3 ? 'cart' : 'none') as 'none' | 'basin' | 'cart',
    }))
  }, [L.rows])
  // Sellers are mostly women; the basins are carried by women, the carts pushed by men.
  const sellerLooks = useMemo(() => L.sellers.map((_, i) => {
    const gender: 'femme' | 'homme' = i % 3 ? 'femme' : 'homme'
    return { gender, look: randomLook(gender, rng(`adjame-v${i}`)), seed: i * 7.3 }
  }), [L.sellers])
  const goerLooks = useMemo(() => goers.map((g, i) => {
    const gender: 'femme' | 'homme' = g.load === 'basin' ? 'femme' : g.load === 'cart' ? 'homme' : i % 2 ? 'femme' : 'homme'
    return { gender, look: randomLook(gender, rng(`adjame-p${i}`)), seed: i * 11.1 + 3 }
  }), [goers])
  return (
    <group>
      {/* The ground: beaten, worn concrete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 8]} scale={[86, 56, 1]} geometry={PLANE} material={ground} receiveShadow />

      {/* The Forum: the concrete block, the galleries, the sign, the shops below */}
      <mesh position={[0, 8, -8]} geometry={BOX} scale={[60, 16, 22]} material={concrete} castShadow receiveShadow />
      <mesh position={[0, 16.4, -8]} geometry={BOX} scale={[62, 0.8, 24]} material={concreteDark} castShadow />
      {[1, 2, 3].map((f) => (
        <mesh key={f} position={[0, f * 4 + 2, 2.9]} geometry={BOX} scale={[58, 3.2, 0.1]} material={concreteDark} />
      ))}
      <Blocks at={forum} material={concrete} />
      <Blocks at={shutters} material={goods} color />
      <mesh position={[0, 14.6, 3.75]} scale={[1.6 * sign.aspect, 1.6, 1]} geometry={PLANE} material={signMat} />

      {/* The market in front: tables, goods, shade */}
      <Blocks at={L.tables} material={goods} color />
      <Blocks at={L.legs} material={wood} />
      <Blocks at={L.wares} material={goods} color />
      <Blocks at={L.posts} material={wood} />
      {L.roofs.map((t, i) => (
        <mesh key={i} position={t.p} rotation={[0.08, 0, 0]} geometry={BOX} scale={t.s} material={t.rust ? rust : tin} castShadow />
      ))}
      {L.parasols.map((u, i) => (
        <group key={i} position={u.p}>
          <mesh position={[0, 1.3, 0]} material={wood}>
            <cylinderGeometry args={[0.03, 0.03, 2.6, 5]} />
          </mesh>
          <mesh position={[0, 2.6, 0]} castShadow>
            <coneGeometry args={[1.7, 0.55, 8, 1, true]} />
            <meshLambertMaterial color={u.c} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      <NoShadows>
        {L.sellers.map((s, i) => {
          const c = sellerLooks[i]
          return (
            <group key={`s${i}`} position={s.p} rotation={[0, s.ry, 0]}>
              <Human look={c.look} gender={c.gender} pose={i % 4 === 0 ? 'talk' : 'idle'} seed={c.seed} />
            </group>
          )
        })}
        {browsers.map((b, i) => {
          const c = cast[i]
          return (
            <group key={`b${i}`} position={b.p} rotation={[0, b.ry, 0]}>
              <Human look={c.look} gender={c.gender} pose={b.pose} seed={c.seed} />
            </group>
          )
        })}
        {goers.map((g, i) => {
          const c = goerLooks[i]
          return <Goer key={`g${i}`} look={c.look} gender={c.gender} seed={c.seed} z={g.z} from={g.from} to={g.to} speed={g.speed} load={g.load} />
        })}
      </NoShadows>
    </group>
  )
}
