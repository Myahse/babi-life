import { useMemo } from 'react'
import * as THREE from 'three'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'
import { t } from '../../lib/i18n'

// Les maquis de Blockhauss, Cocody: the Ébrié village's maquis on the
// lagoon, where one comes for the braised fish and, on the weekend nights,
// stays to dance. Paillotes (round thatched roofs on their posts) over the
// tables, a wooden deck out over the water's edge where the DJ sets up, the
// fish grills smoking by the kitchen shack, strings of bulbs from one roof to
// the next. The names are the game's; the layout is made up for the game.
//
// The landmark's frame: +z toward the street (the way in), the lagoon behind (−z).

/** The tables (x, z): under the paillotes and out in the open. The party nights seat people at them. */
export const BLOCKHAUSS_TABLES: [number, number][] = [[-11, -8], [11, -8], [-11, 4], [11, 4], [-6, 9], [6, 9], [-15.5, -1.5], [15.5, -1.5]]
/** The paillotes: the first four tables are under one. */
const HUTS = BLOCKHAUSS_TABLES.slice(0, 4)
const DECK = { z0: -26, z1: -15.5, w: 34 }

const M = {
  sand: new THREE.MeshLambertMaterial({ color: '#cdb48a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  floor: new THREE.MeshLambertMaterial({ color: '#9a9288', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  plank: new THREE.MeshLambertMaterial({ color: '#8a6440' }),
  post: new THREE.MeshLambertMaterial({ color: '#5c4630' }),
  thatch: new THREE.MeshLambertMaterial({ color: '#c79a52' }),
  thatchDark: new THREE.MeshLambertMaterial({ color: '#9c7436' }),
  wall: new THREE.MeshLambertMaterial({ color: '#e9dcc4' }),
  tin: new THREE.MeshLambertMaterial({ color: '#a9b0b6' }),
  black: new THREE.MeshLambertMaterial({ color: '#1c1c1e' }),
  plastic: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  coal: new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 0.9 }),
  fish: new THREE.MeshLambertMaterial({ color: '#7a5a3a' }),
  bulbDay: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  bulbNight: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  cable: new THREE.MeshLambertMaterial({ color: '#222222' }),
  trunk: new THREE.MeshLambertMaterial({ color: '#7d6145' }),
  palm: new THREE.MeshLambertMaterial({ color: '#3f8a3a' }),
}
const HUT = new THREE.CylinderGeometry(1, 1, 1, 10)
const ROOF = new THREE.ConeGeometry(1, 1, 12)
const BULBS = ['#ffd36b', '#ff6b6b', '#6bd3ff', '#69db7c', '#f783ac']

type At = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

export function BlockhaussMaquis({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const name = lettering(t('MAQUIS BLOCKHAUSS'), '#0b4f6c', '#ffe066', '#ffe066')
    const fish = lettering(t('POISSON BRAISÉ · ATTIÉKÉ'), '#f4efe6', '#b42318', '#b42318')
    const gate = lettering('BLOCKHAUSS', '#1a1a2e', '#7cf0ff', '#ff9f1c')
    return { name: signMaterial(name.t), nameAspect: name.aspect, fish: signMaterial(fish.t), fishAspect: fish.aspect, gate: signMaterial(gate.t), gateAspect: gate.aspect }
  }, [])
  mats.name.emissiveIntensity = night ? 0.9 : 0
  mats.fish.emissiveIntensity = night ? 0.6 : 0
  mats.gate.emissiveIntensity = night ? 1 : 0

  // Tables and chairs, white plastic, four chairs to a table.
  const furniture = useMemo(() => {
    const out: At[] = []
    for (const [x, z] of BLOCKHAUSS_TABLES) {
      out.push({ p: [x, 0.72, z], s: [0.9, 0.06, 0.9] }, { p: [x, 0.36, z], s: [0.12, 0.72, 0.12] })
      for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]] as const) {
        out.push({ p: [x + ox, 0.23, z + oz], s: [0.45, 0.46, 0.45] })
        out.push({ p: [x + ox * 1.25, 0.6, z + oz * 1.25], s: oz ? [0.45, 0.55, 0.08] : [0.08, 0.55, 0.45] })
      }
    }
    return out
  }, [])

  // The deck: planks across, on posts, and its railing on the water side.
  const deck = useMemo(() => {
    const planks: At[] = []
    const posts: At[] = []
    for (let z = DECK.z0 + 0.4; z < DECK.z1; z += 0.9) planks.push({ p: [0, 0.32, z], s: [DECK.w, 0.12, 0.8] })
    for (let x = -DECK.w / 2 + 0.5; x <= DECK.w / 2; x += 3) {
      posts.push({ p: [x, 0.15, DECK.z0 + 0.2], s: [0.25, 0.6, 0.25] }, { p: [x, 0.15, DECK.z1 - 0.3], s: [0.25, 0.6, 0.25] })
      posts.push({ p: [x, 0.95, DECK.z0 + 0.2], s: [0.12, 1.1, 0.12] })
    }
    posts.push({ p: [0, 1.45, DECK.z0 + 0.2], s: [DECK.w, 0.1, 0.1] }, { p: [0, 0.95, DECK.z0 + 0.2], s: [DECK.w, 0.06, 0.06] })
    for (const s of [-1, 1]) posts.push({ p: [s * (DECK.w / 2 - 0.1), 1.45, (DECK.z0 + DECK.z1) / 2], s: [0.1, 0.1, DECK.z1 - DECK.z0] })
    return { planks, posts }
  }, [])

  // Strings of bulbs from roof to roof, and over the way in.
  const { bulbs, cables } = useMemo(() => {
    const bulbs: At[] = []
    const cables: At[] = []
    let n = 0
    const string = (a: [number, number, number], b: [number, number, number]) => {
      const len = Math.hypot(b[0] - a[0], b[2] - a[2])
      const steps = Math.max(4, Math.round(len / 1.2))
      for (let i = 1; i < steps; i++) {
        const u = i / steps
        const sag = Math.sin(u * Math.PI) * 0.6
        bulbs.push({ p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag - 0.15, a[2] + (b[2] - a[2]) * u], s: [0.18, 0.18, 0.18], c: BULBS[n++ % BULBS.length] })
      }
      cables.push({ p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.3, (a[2] + b[2]) / 2], s: [len, 0.04, 0.04], ry: -Math.atan2(b[2] - a[2], b[0] - a[0]) })
    }
    const top = 3.1
    string([-11, top, -8], [11, top, -8])
    string([-11, top, 4], [11, top, 4])
    string([-11, top, -8], [-11, top, 4])
    string([11, top, -8], [11, top, 4])
    string([-11, top, 4], [-4, 3.4, 21])
    string([11, top, 4], [4, 3.4, 21])
    string([-DECK.w / 2 + 0.4, 2.4, DECK.z0 + 0.2], [DECK.w / 2 - 0.4, 2.4, DECK.z0 + 0.2])
    return { bulbs, cables }
  }, [])

  return (
    <group>
      {/* The ground: sand, the concrete dance floor, the deck over the water's edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -2]} scale={[42, 46, 1]} geometry={PLANE} material={M.sand} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -6]} scale={[11, 9, 1]} geometry={PLANE} material={M.floor} receiveShadow />
      <Blocks at={deck.planks} material={M.plank} />
      <Blocks at={deck.posts} material={M.post} />
      {/* Rail posts along the deck's back for the bulbs */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DECK.w / 2 - 0.4), 1.4, DECK.z0 + 0.2]} scale={[0.14, 2.6, 0.14]} geometry={BOX} material={M.post} />
      ))}

      {/* The paillotes: four posts, the round thatched roof in two layers */}
      {HUTS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {[[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].map(([px, pz], k) => (
            <mesh key={k} position={[px, 1.3, pz]} scale={[0.16, 2.6, 0.16]} geometry={BOX} material={M.post} castShadow />
          ))}
          <mesh position={[0, 3.25, 0]} scale={[3.1, 1.3, 3.1]} geometry={ROOF} material={M.thatch} castShadow />
          <mesh position={[0, 2.7, 0]} scale={[3.15, 0.18, 3.15]} geometry={HUT} material={M.thatchDark} castShadow />
        </group>
      ))}
      <Blocks at={furniture} material={M.plastic} />

      {/* The kitchen shack, its name, the fish on the grills in front */}
      <group position={[-14, 0, 15]}>
        <mesh position={[0, 1.5, 0]} scale={[6, 3, 4]} geometry={BOX} material={M.wall} castShadow receiveShadow />
        <mesh position={[0, 3.15, 0.3]} scale={[6.8, 0.15, 5]} geometry={BOX} material={M.tin} castShadow />
        <mesh position={[0, 3.7, 2.04]} scale={[Math.min(6, 0.9 * mats.nameAspect), 0.9, 1]} geometry={PLANE} material={mats.name} />
        <mesh position={[0, 2.3, 2.04]} scale={[Math.min(5.6, 0.55 * mats.fishAspect), 0.55, 1]} geometry={PLANE} material={mats.fish} />
        <mesh position={[0, 0.55, 2.3]} scale={[4, 1.1, 0.5]} geometry={BOX} material={M.plank} castShadow />
      </group>
      {[-11.5, -9.5].map((x) => (
        <group key={x} position={[x, 0, 18.4]}>
          {/* A half drum on legs, the coals, three fish on the grid */}
          <mesh position={[0, 0.5, 0]} scale={[1.3, 0.5, 0.6]} geometry={BOX} material={M.black} castShadow />
          <mesh position={[0, 0.77, 0]} scale={[1.2, 0.04, 0.5]} geometry={BOX} material={M.coal} />
          {[-0.35, 0, 0.35].map((fx) => (
            <mesh key={fx} position={[fx, 0.82, 0]} scale={[0.18, 0.06, 0.42]} geometry={BOX} material={M.fish} />
          ))}
        </group>
      ))}

      {/* The way in: two posts and the name across, lit at night */}
      <group position={[0, 0, 21.5]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 4, 1.9, 0]} scale={[0.4, 3.8, 0.4]} geometry={BOX} material={M.post} castShadow />
        ))}
        <mesh position={[0, 3.9, 0]} scale={[8.8, 1.1, 0.3]} geometry={BOX} material={M.black} castShadow />
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 3.9, s * 0.16]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[Math.min(8.4, 0.95 * mats.gateAspect), 0.95, 1]} geometry={PLANE} material={mats.gate} />
        ))}
      </group>

      {/* Coconut palms by the water */}
      {[[-17, -12], [17, -11], [-18, 10]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 1.7, 0.08]}>
          <mesh position={[0, 3.5, 0]} scale={[0.35, 7, 0.35]} geometry={BOX} material={M.trunk} castShadow />
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.26) * 1.3, 7, Math.sin(k * 1.26) * 1.3]} rotation={[0, -k * 1.26, -0.35]} scale={[2.8, 0.12, 0.7]} geometry={BOX} material={M.palm} castShadow />
          ))}
        </group>
      ))}

      <Blocks at={cables} material={M.cable} />
      <Blocks key={night ? 'n' : 'd'} at={bulbs} material={night ? M.bulbNight : M.bulbDay} color />
    </group>
  )
}
