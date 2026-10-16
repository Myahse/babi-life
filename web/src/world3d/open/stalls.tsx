import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { clearObstacles, setObstacles } from '../obstacles'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import { lettering } from './ruePrincesse'
import type { Nav } from './nav'

// The sellers of the street, at the edge of the real streets around the Sim,
// always at the same corners:
// - the alloco tantie: a table, the pot of oil on the charcoal stove, the
//   basin of plantain, a parasol;
// - the porc au four women, three side by side (many in Yopougon): the drum
//   oven smoking, the cutting table, a tarp over a table and benches;
// - the café and thé sellers with their pousse-pousse: thermoses and cups on
//   a wooden cart with two big wheels;
// - the garbadrome: a shed under a tin roof, the big pan of oil crackling on
//   the gas, the glass box of fried thon, the attiéké and the piment, and the
//   crowd pressing at the front, everyone pointing at their fish: « Donne-moi
//   une grosse queue là-bas ! », « Donne-moi milieu là ! ». Tap the seller to
//   choose: the piece, and from the hot oil or from the box.
// Around each, the customers: on the bench eating, waiting, chatting; more at
// the busy hours (lunch and evening for the food, morning for coffee), none in
// the dead of night. Tap the seller to buy (backend sims/street.go: the id's
// prefix says what); often it's sold out: « Ya pas banane oh ! ».

export type StallKind = 'alloco' | 'porc' | 'cafe' | 'the' | 'garba'
export type Stall = { id: string; kind: StallKind; at: XZ; rot: number; seed: number }

const NEAR = 320 // metres: stalls drawn around the Sim
const MAX = 9
const CROWD_NEAR = 110 // metres: customers drawn round the nearest stalls
const REACH = 25 // metres: close enough to buy

/** What each calls out, what the bubble says, and the busy hours (crowd 0..1 by hour). */
const SELLER: Record<StallKind, { shout: string; ask: string; out: string; busy: (h: number) => number; r: number }> = {
  alloco: { shout: 'Alloco chaud, 300 F !', ask: 'Alloco ? Viens prendre !', out: 'Ya pas banane oh !', busy: (h) => (h < 8 || h >= 23 ? 0 : h >= 16 && h < 21 ? 1 : 0.45), r: 1.1 },
  porc: { shout: 'Porc au four, viens goûter !', ask: 'Porc au four, 1500 F !', out: 'Le porc est fini, reviens demain !', busy: (h) => (h < 11 ? 0 : h >= 18 ? 1 : h >= 12 && h < 14 ? 0.8 : 0.4), r: 2.6 },
  cafe: { shout: 'Café ! Café chaud !', ask: 'Café, 150 F !', out: 'Le thermos est vide, attends un peu !', busy: (h) => (h < 5 || h >= 23 ? 0 : h < 9 ? 1 : h >= 17 && h < 20 ? 0.6 : 0.3), r: 1 },
  garba: { shout: 'Garba chaud ! Garba !', ask: 'Garba ? Viens choisir ton poisson !', out: 'Y a plus poisson oh !', busy: (h) => (h >= 2 && h < 9 ? 0 : (h >= 12 && h < 14) || (h >= 19 && h < 23) ? 1 : 0.6), r: 2.4 },
  the: { shout: 'Thé bien mousseux !', ask: 'Thé, 100 F, assieds-toi !', out: "Le thé n'est pas encore prêt !", busy: (h) => (h < 6 ? 0 : h >= 17 ? 1 : 0.4), r: 1 },
}

export type Buy = (vendor: string, choice?: string) => Promise<string | null>

export function StreetStalls({ nav, seed, hour, onBuy }: { nav: Nav; seed: string; hour: number; onBuy?: Buy }) {
  const yop = seed.includes('yopougon')
  // Every possible stall of the loaded streets: a few street sides, chosen by
  // where they are, so a stall is found again at the same place.
  const all = useMemo(() => {
    const out: Stall[] = []
    for (const e of nav.edges) {
      if (e.width > 10 || e.len < 30 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const h = hash(Math.round(m[0]), Math.round(m[1]), 77)
      const kind: StallKind | null = h < 0.07 ? 'alloco' : h < 0.115 ? 'garba' : h < (yop ? 0.235 : 0.14) ? 'porc' : h > 0.955 ? (hash(Math.round(m[1]), Math.round(m[0]), 5) < 0.55 ? 'cafe' : 'the') : null
      if (!kind) continue
      const side = hash(Math.round(m[1]), 3) < 0.5 ? 1 : -1
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const off = e.width / 2 + 3.2
      // The porc au four women work side by side, three along the street.
      const along = kind === 'porc' ? [-6.5, 0, 6.5] : [0]
      for (const s of along) {
        const at: XZ = [m[0] - uz * off * side + ux * s, m[1] + ux * off * side + uz * s]
        if (!nav.walkable(at[0], at[1])) continue
        // Facing the street (square to it, wherever along it).
        const rot = Math.atan2(uz * side, -ux * side)
        out.push({ id: `${kind}:${seed}:${Math.round(at[0])}:${Math.round(at[1])}`, kind, at, rot, seed: hash(at[0], at[1]) })
      }
    }
    return out
  }, [nav, seed, yop])
  // The stalls (tables, ovens, carts) are in the way.
  useEffect(() => {
    setObstacles('stalls', all.map((s) => ({ x: s.at[0], z: s.at[1], r: SELLER[s.kind].r })))
    return () => clearObstacles('stalls')
  }, [all])

  // The few nearest the Sim, rechecked as it walks; customers round the nearest.
  const [shown, setShown] = useState<{ s: Stall; crowd: boolean }[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => ({ s: x.s, crowd: x.d < CROWD_NEAR }))
    const key = (l: typeof near) => l.map((x) => x.s.id + x.crowd).join()
    if (key(near) !== key(shown)) setShown(near)
  })
  return (
    <>
      {shown.map(({ s, crowd }) => (
        <StreetStall key={s.id} stall={s} hour={hour} crowd={crowd} onBuy={onBuy} />
      ))}
    </>
  )
}

/* ---------- Materials ---------- */

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra })
const M = {
  wood: lambert('#8a5a32'),
  darkWood: lambert('#5e3b1f'),
  cloth: lambert('#e8d6a8'),
  iron: lambert('#2a2a2a'),
  rust: lambert('#6b3a22'),
  oil: lambert('#c98a1c', { emissive: '#5a3200', emissiveIntensity: 0.4 }),
  coal: lambert('#ff5a1a', { emissive: '#ff3a00', emissiveIntensity: 0.8 }),
  plantain: lambert('#e7c23a'),
  fried: lambert('#d9822b'),
  basin: lambert('#2f7fd0'),
  pork: lambert('#9c4a25'),
  porkFat: lambert('#d9a066'),
  attieke: lambert('#f3ead2'),
  tarp: lambert('#2f6fbf', { side: THREE.DoubleSide }),
  plastic: lambert('#e8432f'),
  smoke: new THREE.MeshBasicMaterial({ color: '#d8d8d8', transparent: true, opacity: 0.35, depthWrite: false }),
  wheel: lambert('#1c1c1c'),
  thermos: ['#d62828', '#1f9a4a', '#2f7fd0', '#f2a81d'].map((c) => lambert(c)),
  cup: lambert('#f4f1ea'),
  red: lambert('#d6202a'),
  redFrame: lambert('#e0282f'),
  board: lambert('#f4f1ea'),
  tarp2: lambert('#1c1d22'),
  net: new THREE.MeshLambertMaterial({ color: '#2a2a2a', transparent: true, opacity: 0.55 }),
  bag: lambert('#141416'),
  slate: lambert('#3d4a45'),
  sachet: Object.fromEntries(['#f4f1ea', '#d9a53a', '#2f7fd0'].map((c) => [c, lambert(c)])) as Record<string, THREE.MeshLambertMaterial>,
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
const Box = ({ s, p, r, m }: { s: [number, number, number]; p: [number, number, number]; r?: [number, number, number]; m: THREE.Material }) => <mesh geometry={BOX} material={m} scale={s} position={p} rotation={r} castShadow receiveShadow />

/** A low wooden bench (seat at 0.42 m, the height a seated Sim sits at). */
function Bench({ p, r = 0, w = 1.6 }: { p: [number, number, number]; r?: number; w?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box s={[w, 0.06, 0.3]} p={[0, 0.42, 0]} m={M.wood} />
      {[-1, 1].map((k) => (
        <Box key={k} s={[0.06, 0.4, 0.26]} p={[(k * (w - 0.2)) / 2, 0.2, 0]} m={M.darkWood} />
      ))}
    </group>
  )
}

/** Smoke rising from an oven or a stove, puff after puff. */
function Smoke({ p, n = 6 }: { p: [number, number, number]; n?: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const k = (t * 0.35 + i / n) % 1
      m.position.set(Math.sin(i * 2.1 + t * 0.6) * 0.15 * k + k * 0.25, k * 2.2, Math.cos(i * 1.7) * 0.1 * k)
      m.scale.setScalar(0.18 + k * 0.45)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - k)
    })
  })
  const mats = useMemo(() => [...Array(n)].map(() => M.smoke.clone()), [n])
  return (
    <group position={p}>
      {mats.map((m, i) => (
        <mesh key={i} ref={(x) => void (refs.current[i] = x)} geometry={BOX} material={m} />
      ))}
    </group>
  )
}

/* ---------- The stalls ---------- */

function AllocoStand({ parasol }: { parasol: string }) {
  return (
    <group>
      {/* The table, its cloth, the basin of plantain and the fried pieces */}
      <Box s={[1.6, 0.08, 0.8]} p={[0, 0.85, 0.9]} m={M.cloth} />
      {[
        [-0.7, 0.55],
        [0.7, 0.55],
        [-0.7, 1.25],
        [0.7, 1.25],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} s={[0.07, 0.84, 0.07]} p={[x, 0.42, z]} m={M.wood} />
      ))}
      <mesh position={[-0.4, 0.98, 0.9]} material={M.basin}>
        <cylinderGeometry args={[0.32, 0.24, 0.18, 12]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} s={[0.36, 0.07, 0.08]} p={[-0.52 + (i % 2) * 0.22, 1.1, 0.82 + Math.floor(i / 2) * 0.16]} r={[0, i * 0.7, 0.3]} m={M.plantain} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={`f${i}`} s={[0.1, 0.06, 0.1]} p={[0.25 + (i % 3) * 0.13, 0.93, 0.8 + Math.floor(i / 3) * 0.17]} r={[0, i, 0]} m={M.fried} />
      ))}
      {/* The charcoal stove and the pot of oil, beside her */}
      <group position={[1.15, 0, 0.2]}>
        <mesh position={[0, 0.25, 0]} material={M.iron}>
          <cylinderGeometry args={[0.3, 0.22, 0.5, 10]} />
        </mesh>
        <mesh position={[0, 0.51, 0]} material={M.coal}>
          <cylinderGeometry args={[0.24, 0.24, 0.03, 10]} />
        </mesh>
        <mesh position={[0, 0.66, 0]} material={M.iron}>
          <cylinderGeometry args={[0.38, 0.26, 0.26, 14, 1, true]} />
        </mesh>
        <mesh position={[0, 0.76, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.oil}>
          <circleGeometry args={[0.36, 14]} />
        </mesh>
        <Smoke p={[0, 0.85, 0]} n={4} />
      </group>
      {/* The parasol */}
      <mesh position={[-0.95, 1.3, 0.35]} material={M.wood}>
        <cylinderGeometry args={[0.03, 0.03, 2.6, 6]} />
      </mesh>
      <mesh position={[-0.95, 2.65, 0.35]} castShadow>
        <coneGeometry args={[1.6, 0.6, 8, 1, true]} />
        <meshLambertMaterial color={parasol} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** The porc au four: the drum oven on its legs, smoking; the table where she cuts; the tarp over the eating table. */
function PorcStand() {
  return (
    <group>
      {/* The oven: a drum cut open, lying on iron legs, the lid propped up */}
      <group position={[-1.3, 0, 0.6]}>
        <mesh position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 2]} material={M.rust} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 1.1, 12]} />
        </mesh>
        {[-0.45, 0.45].map((x) => (
          <Box key={x} s={[0.05, 0.55, 0.6]} p={[x, 0.27, 0]} m={M.iron} />
        ))}
        <Box s={[1.0, 0.04, 0.5]} p={[0, 1.27, -0.18]} r={[-0.9, 0, 0]} m={M.iron} />
        <Box s={[0.9, 0.03, 0.5]} p={[0, 1.08, 0.04]} m={M.coal} />
        {[-0.28, 0, 0.28].map((x) => (
          <Box key={x} s={[0.22, 0.07, 0.16]} p={[x, 1.13, 0.04]} m={M.pork} />
        ))}
        <mesh position={[0.62, 1.05, 0]} rotation={[0, 0, Math.PI / 2]} material={M.iron}>
          <cylinderGeometry args={[0.07, 0.07, 0.25, 8]} />
        </mesh>
        <Smoke p={[0, 1.2, 0]} n={7} />
      </group>
      {/* The cutting table: the board, pieces of pork, the attiéké in a basin */}
      <group position={[0.7, 0, 0.9]}>
        <Box s={[1.5, 0.07, 0.75]} p={[0, 0.85, 0]} m={M.wood} />
        {[
          [-0.65, -0.3],
          [0.65, -0.3],
          [-0.65, 0.3],
          [0.65, 0.3],
        ].map(([x, z]) => (
          <Box key={`${x}${z}`} s={[0.07, 0.84, 0.07]} p={[x, 0.42, z]} m={M.darkWood} />
        ))}
        <Box s={[0.5, 0.04, 0.35]} p={[-0.3, 0.9, 0]} m={M.porkFat} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Box key={i} s={[0.12, 0.08, 0.1]} p={[-0.45 + (i % 3) * 0.14, 0.96, -0.08 + Math.floor(i / 3) * 0.15]} r={[0, i * 0.6, 0]} m={i % 2 ? M.pork : M.porkFat} />
        ))}
        <mesh position={[0.4, 0.95, 0]} material={M.basin}>
          <cylinderGeometry args={[0.26, 0.2, 0.15, 12]} />
        </mesh>
        <mesh position={[0.4, 1.03, 0]} material={M.attieke}>
          <cylinderGeometry args={[0.22, 0.22, 0.02, 12]} />
        </mesh>
      </group>
      {/* Where people eat, behind: a table under a blue tarp on poles, benches either side */}
      <group position={[0, 0, -2.7]}>
        {[
          [-1.5, -1],
          [1.5, -1],
          [-1.5, 1],
          [1.5, 1],
        ].map(([x, z]) => (
          <Box key={`${x}${z}`} s={[0.06, 2.3, 0.06]} p={[x, 1.15, z]} m={M.wood} />
        ))}
        <Box s={[3.3, 0.03, 2.3]} p={[0, 2.3, 0]} r={[0.05, 0, 0]} m={M.tarp} />
        <Box s={[2.2, 0.06, 0.7]} p={[0, 0.74, 0]} m={M.plastic} />
        {[-0.9, 0.9].map((x) => (
          <Box key={x} s={[0.06, 0.72, 0.6]} p={[x, 0.36, 0]} m={M.darkWood} />
        ))}
        <Bench p={[0, 0, -0.62]} w={2.2} />
        <Bench p={[0, 0, 0.62]} w={2.2} />
      </group>
    </group>
  )
}

/**
 * The pousse-pousse of the café and thé sellers, as on Abidjan's streets: a
 * red metal frame on two spoked wheels, long handles behind, a tall red box
 * with white stars and the price painted on, the board of sachets hung in rows
 * above it, a black tarp tied over the top, a net bag and a plastic bag
 * hanging; the red parasol; beside it the seller's low stool and the
 * chalkboard where the regulars' credit is kept.
 */
function Cart({ tea, price }: { tea: boolean; price: number }) {
  const sign = useMemo(() => lettering('THÉ · CAFÉ', '#d6202a', '#ffffff', '#ffffff'), [])
  const tag = useMemo(() => lettering(`${price}F`, '#d6202a', '#ffffff', '#d6202a'), [price])
  const mats = useMemo(() => ({ sign: new THREE.MeshLambertMaterial({ map: sign.t }), tag: new THREE.MeshLambertMaterial({ map: tag.t }) }), [sign, tag])
  // The sachets, in rows on their board: blue and gold packets, a few white.
  const sachets = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; c: string }[] = []
    for (let row = 0; row < 9; row++)
      for (let col = 0; col < 6; col++) out.push({ p: [-0.25 + col * 0.1, 1.48 + row * 0.085, 0.31], s: [0.085, 0.075, 0.02], c: (row + col) % 4 === 0 ? '#f4f1ea' : row % 3 === 1 ? '#d9a53a' : '#2f7fd0' })
    return out
  }, [])
  return (
    <group position={[0, 0, 0.9]}>
      {/* The frame: the bed over the axle, the handles going back, the leg in front */}
      <Box s={[0.9, 0.05, 0.6]} p={[0, 0.5, 0]} m={M.redFrame} />
      {[-0.27, 0.27].map((z) => (
        <Box key={z} s={[1.15, 0.045, 0.045]} p={[-0.95, 0.72, z]} r={[0, 0, 0.32]} m={M.redFrame} />
      ))}
      <Box s={[0.05, 0.48, 0.05]} p={[0.4, 0.24, 0]} m={M.redFrame} />
      {/* Two spoked wheels, upright on the axle (along z): the black tyre, the red rim, the spokes, the hub */}
      {[-0.36, 0.36].map((z) => (
        <group key={z} position={[0, 0.36, z]}>
          <mesh material={M.wheel} castShadow>
            <torusGeometry args={[0.32, 0.04, 8, 24]} />
          </mesh>
          <mesh material={M.redFrame}>
            <torusGeometry args={[0.275, 0.018, 6, 24]} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
            <Box key={k} s={[0.55, 0.012, 0.012]} p={[0, 0, 0]} r={[0, 0, (k * Math.PI) / 8]} m={M.iron} />
          ))}
          <mesh rotation={[Math.PI / 2, 0, 0]} material={M.redFrame}>
            <cylinderGeometry args={[0.045, 0.045, 0.1, 8]} />
          </mesh>
        </group>
      ))}
      {/* The axle under the box */}
      <mesh position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.iron}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
      </mesh>
      {/* The tall red box: stars, the price, the name of what's sold */}
      <Box s={[0.7, 0.85, 0.55]} p={[0, 0.95, 0]} m={M.red} />
      <mesh position={[0, 1.18, 0.281]} scale={[0.55, 0.55 / sign.aspect, 1]} material={mats.sign}>
        <planeGeometry />
      </mesh>
      <mesh position={[-0.15, 0.82, 0.281]} scale={[0.28, 0.28 / tag.aspect, 1]} material={mats.tag}>
        <planeGeometry />
      </mesh>
      {[
        [0.14, 0.86],
        [0.24, 0.72],
        [0.12, 0.62],
      ].map(([x, y]) => (
        <group key={`${x}${y}`} position={[x, y, 0.282]}>
          <Box s={[0.07, 0.02, 0.005]} p={[0, 0, 0]} m={M.cup} />
          <Box s={[0.02, 0.07, 0.005]} p={[0, 0, 0]} m={M.cup} />
        </group>
      ))}
      {/* The rack above: the board of sachets, the black tarp over the stock, the net, the bags */}
      <Box s={[0.04, 1.0, 0.04]} p={[-0.32, 1.85, 0.25]} m={M.redFrame} />
      <Box s={[0.04, 1.0, 0.04]} p={[0.32, 1.85, 0.25]} m={M.redFrame} />
      <Box s={[0.62, 0.82, 0.02]} p={[0, 1.8, 0.29]} m={M.board} />
      {sachets.map((b, i) => (
        <Box key={i} s={b.s} p={b.p} m={M.sachet[b.c]} />
      ))}
      <Box s={[0.95, 0.42, 0.65]} p={[0, 2.42, -0.02]} r={[0, 0, 0.04]} m={M.tarp2} />
      <Box s={[1.05, 0.06, 0.08]} p={[0, 2.66, 0.3]} m={M.red} />
      <Box s={[0.18, 0.55, 0.3]} p={[-0.45, 1.9, -0.15]} m={M.net} />
      <Box s={[0.2, 0.3, 0.06]} p={[0.25, 1.1, 0.33]} m={M.bag} />
      {/* For coffee, the big thermos on the box; for tea, the kettle on its little stove by the stool */}
      {tea ? (
        <group position={[1.15, 0, -0.1]}>
          <mesh position={[0, 0.12, 0]} material={M.iron}>
            <cylinderGeometry args={[0.14, 0.11, 0.24, 8]} />
          </mesh>
          <mesh position={[0, 0.25, 0]} material={M.coal}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 8]} />
          </mesh>
          <mesh position={[0, 0.36, 0]} material={M.thermos[1]}>
            <cylinderGeometry args={[0.07, 0.1, 0.18, 8]} />
          </mesh>
          <Smoke p={[0, 0.48, 0]} n={3} />
        </group>
      ) : (
        <mesh position={[0.22, 1.5, -0.1]} material={M.thermos[0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.42, 10]} />
        </mesh>
      )}
      {/* The red parasol, behind */}
      <mesh position={[0.6, 1.4, -0.7]} material={M.iron}>
        <cylinderGeometry args={[0.025, 0.025, 2.8, 5]} />
      </mesh>
      <mesh position={[0.6, 2.8, -0.7]} castShadow>
        <coneGeometry args={[1.5, 0.45, 8, 1, true]} />
        <meshLambertMaterial color="#e8432f" side={THREE.DoubleSide} />
      </mesh>
      {/* The stool, and the chalkboard of credit leaning on its stand */}
      <Box s={[0.32, 0.05, 0.32]} p={[0.95, 0.42, 0.25]} m={M.wood} />
      {[
        [-0.12, -0.12],
        [0.12, -0.12],
        [-0.12, 0.12],
        [0.12, 0.12],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} s={[0.04, 0.42, 0.04]} p={[0.95 + x, 0.21, 0.25 + z]} m={M.darkWood} />
      ))}
      <group position={[1.6, 0, -0.5]} rotation={[-0.15, -0.5, 0]}>
        <Box s={[0.8, 1.0, 0.03]} p={[0, 0.85, 0]} m={M.slate} />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <Box key={k} s={[0.5 + ((k * 37) % 5) * 0.04, 0.02, 0.005]} p={[-0.05, 1.2 - k * 0.12, 0.02]} m={M.cup} />
        ))}
        <Box s={[0.04, 0.9, 0.04]} p={[0, 0.45, -0.25]} r={[0.5, 0, 0]} m={M.darkWood} />
      </group>
    </group>
  )
}

/* ---------- The customers ---------- */

type Customer = { at: [number, number, number]; rot: number; pose: Pose; gender: 'femme' | 'homme'; seed: number }

/** Where the customers stand or sit, for a stall: the first ones are there whenever it's open, the last only at the busy hours. */
function customerSpots(kind: StallKind, seed: number): Customer[] {
  const r = rng(`crowd${seed}`)
  const g = (): 'femme' | 'homme' => (r() < 0.45 ? 'femme' : 'homme')
  const facing = Math.PI // towards the stall (it faces +z)
  const stand = (x: number, z: number, pose: Pose = r() < 0.5 ? 'talk' : 'idle'): Customer => ({ at: [x, 0, z], rot: facing + (r() - 0.5) * 0.8, pose, gender: g(), seed: r() * 100 })
  const sit = (x: number, z: number, rot: number, pose: Pose = 'eat'): Customer => ({ at: [x, 0, z], rot, pose, gender: g(), seed: r() * 100 })
  switch (kind) {
    case 'alloco':
      return [stand(0.2, 2.0, 'idle'), sit(-0.5, 2.8, facing), stand(-1.2, 2.2), sit(0.4, 2.8, facing), stand(1.3, 2.4, 'phone'), stand(0.6, 3.6)]
    case 'porc':
      // Round the eating table, both sides, and some waiting at the cutting table.
      return [
        sit(-0.6, -3.32, 0),
        sit(0.6, -2.08, Math.PI),
        stand(0.7, 1.9, 'idle'),
        sit(0.5, -3.32, 0),
        sit(-0.7, -2.08, Math.PI),
        stand(1.5, 2.1),
        sit(-0.05, -2.08, Math.PI, 'drink'),
        stand(-2.3, 2.4, 'phone'),
        sit(0.05, -3.32, 0, 'drink'),
      ]
    case 'garba':
      // Pressed at the front, pointing at their fish; two eating on the bench at the side.
      return [
        stand(-0.55, 1.75, 'wave'),
        stand(0.2, 1.7, 'talk'),
        sit(2.75, 0.9, -Math.PI / 2),
        stand(0.85, 1.8, 'wave'),
        stand(-0.15, 2.35, 'talk'),
        sit(2.75, 1.6, -Math.PI / 2, 'eat'),
        stand(0.55, 2.45, 'phone'),
        stand(-0.95, 2.4, 'idle'),
        stand(0.15, 3.0, 'talk'),
      ]
    case 'cafe':
    case 'the':
      return [stand(0.3, 2.2, 'idle'), stand(-0.6, 2.4), sit(-1.6, 2.4, Math.PI * 0.75, 'drink'), stand(-1.5, 1.7), stand(1.2, 2.9, 'phone')]
  }
}

function Crowd({ stall, hour }: { stall: Stall; hour: number }) {
  const spots = useMemo(() => customerSpots(stall.kind, stall.seed), [stall.kind, stall.seed])
  const looks = useMemo(() => spots.map((c, i) => randomLook(c.gender, rng(`${stall.id}c${i}`))), [spots, stall.id])
  const busy = SELLER[stall.kind].busy(hour)
  // At least two whenever open, all of them at the busiest hour.
  const n = busy <= 0 ? 0 : Math.max(2, Math.round(spots.length * busy * (0.75 + stall.seed * 0.25)))
  return (
    <NoShadows>
      {spots.slice(0, n).map((c, i) =>
        // At the garbadrome the ones standing push and sway: everyone wants to be served first.
        stall.kind === 'garba' && c.pose !== 'eat' && c.pose !== 'sit' ? (
          <Jostle key={i} at={c.at} rot={c.rot} phase={c.seed}>
            <Human look={looks[i]} gender={c.gender} pose={c.pose} seed={c.seed} />
          </Jostle>
        ) : (
          <group key={i} position={c.at} rotation={[0, c.rot, 0]}>
            <Human look={looks[i]} gender={c.gender} pose={c.pose} seed={c.seed} />
          </group>
        ),
      )}
      {stall.kind === 'garba' && n > 0 && <GarbaVoices n={n} />}
      {/* The seats some of them sit on (the porc au four has its own) */}
      {stall.kind === 'alloco' && <Bench p={[-0.05, 0, 2.8]} />}
      {stall.kind === 'garba' && <Bench p={[2.75, 0, 1.25]} r={Math.PI / 2} w={1.5} />}
      {(stall.kind === 'cafe' || stall.kind === 'the') && <Bench p={[-1.6, 0, 2.4]} r={Math.PI * 0.75 - Math.PI / 2} w={0.8} />}
    </NoShadows>
  )
}

/* ---------- One stall, its seller, the customers ---------- */

/** One stall and its seller. Local +z faces the street. */
export function StreetStall({ stall, hour, crowd, onBuy }: { stall: Stall; hour: number; crowd: boolean; onBuy?: Buy }) {
  const sl = SELLER[stall.kind]
  const man = ((stall.kind === 'cafe' || stall.kind === 'the') && stall.seed < 0.85) || stall.kind === 'garba'
  const look = useMemo(() => randomLook(man ? 'homme' : 'femme', rng(stall.id)), [stall.id, man])
  const helper = useMemo(() => (stall.kind === 'porc' ? randomLook('femme', rng(`${stall.id}h`)) : stall.kind === 'garba' ? randomLook('homme', rng(`${stall.id}h`)) : null), [stall.id, stall.kind])
  const parasol = useMemo(() => ['#e8432f', '#1f9a4a', '#f2a81d', '#2f7fd0'][Math.floor(stall.seed * 4)], [stall.seed])
  const [said, setSaid] = useState<string | null>(null)
  const [near, setNear] = useState(false)
  // At the garbadrome: choosing one's fish.
  const [choosing, setChoosing] = useState(false)
  const choose = async (choice: string) => {
    setChoosing(false)
    say('…', 20000)
    const text = await onBuy?.(stall.id, choice)
    if (text) say(text)
    else setSaid(null)
  }
  const shout = useRef(0)
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(clear.current), [])
  const say = (text: string, ms = 6000) => {
    setSaid(text)
    clearTimeout(clear.current)
    clear.current = setTimeout(() => setSaid(null), ms)
  }
  useFrame((_, dt) => {
    const d = Math.hypot(stall.at[0] - whereabouts.sim[0], stall.at[1] - whereabouts.sim[1])
    if (d < 30 !== near) setNear(d < 30)
    // The seller calls out to the passers-by now and then.
    shout.current -= dt
    if (d < 45 && shout.current <= 0) {
      shout.current = 14 + stall.seed * 10
      if (!said) say(sl.shout, 3500)
    }
  })
  const tap = async () => {
    const d = Math.hypot(stall.at[0] - whereabouts.sim[0], stall.at[1] - whereabouts.sim[1])
    if (d > REACH) return say('Approche, mon enfant !', 3000)
    if (!onBuy) return
    if (stall.kind === 'garba') return setChoosing(true)
    say('…', 20000)
    const text = await onBuy(stall.id)
    if (text) say(text)
    else setSaid(null)
  }
  // Where the seller stands, and doing what.
  // The café/thé seller sits on his stool beside the cart (as in the street), turned to the passers-by.
  const [sellerAt, sellerPose]: [[number, number, number], Pose] = stall.kind === 'porc' ? [[-1.3, 0, -0.1], 'cook'] : stall.kind === 'garba' ? [[0.75, 0, 0.1], 'cook'] : stall.kind === 'alloco' ? [[0, 0, 0], 'idle'] : [[0.95, 0, 1.08], 'sit']
  return (
    <group position={[stall.at[0], 0, stall.at[1]]} rotation={[0, stall.rot, 0]} onClick={(e) => (e.stopPropagation(), void tap())}>
      {stall.kind === 'alloco' && <AllocoStand parasol={parasol} />}
      {stall.kind === 'porc' && <PorcStand />}
      {stall.kind === 'garba' && <GarbaStand />}
      {(stall.kind === 'cafe' || stall.kind === 'the') && <Cart tea={stall.kind === 'the'} price={stall.kind === 'the' ? 100 : 150} />}
      <group position={sellerAt}>
        <Human look={look} gender={man ? 'homme' : 'femme'} pose={sellerPose} seed={stall.seed * 100} />
      </group>
      {/* At the porc au four, a second woman cuts and serves */}
      {helper && (
        <group position={stall.kind === 'garba' ? [-0.55, 0, 0.15] : [0.7, 0, 0.25]}>
          <Human look={helper} gender={stall.kind === 'garba' ? 'homme' : 'femme'} pose="busy" seed={stall.seed * 100 + 7} />
        </group>
      )}
      {crowd && <Crowd stall={stall} hour={hour} />}
      {/* What the seller says */}
      {(said || near) && (
        <Html position={[0, stall.kind === 'garba' ? 3.2 : 2.4, 0]} center zIndexRange={[25, 0]}>
          <button
            onClick={() => void tap()}
            className={`rounded-2xl rounded-bl-sm border border-black/5 px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] transition active:scale-95 ${said === sl.out ? 'bg-[#ffe08a] text-[#5a3a00]' : 'bg-white text-[var(--color-ink)]'}`}
          >
            {said ?? sl.ask}
          </button>
        </Html>
      )}
      {choosing && (
        <Html position={[0, 2.2, 1.2]} center zIndexRange={[30, 0]}>
          <GarbaMenu onChoose={(c) => void choose(c)} onClose={() => setChoosing(false)} />
        </Html>
      )}
    </group>
  )
}

/* ---------- The garbadrome ---------- */

const G = {
  roof: lambert('#8d9299'),
  wall: lambert('#e8590c'),
  thon: lambert('#7a4520'),
  thonCut: lambert('#b07a4a'),
  glass: new THREE.MeshLambertMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.35, depthWrite: false }),
  frame: lambert('#c9ced4'),
  piment: lambert('#d6202a'),
  onion: lambert('#9b5fa8'),
  tomato: lambert('#e8432f'),
  gas: lambert('#2f7fd0'),
}

/** The shed under its tin roof, the sign, the counter with the glass box and the attiéké, the big pan of oil on the gas. Local +z faces the street. */
function GarbaStand() {
  const sign = useMemo(() => lettering('GARBADROME', '#e8590c', '#ffffff', '#ffd43b'), [])
  const signMat = useMemo(() => new THREE.MeshLambertMaterial({ map: sign.t }), [sign])
  // The pieces in the oil, bobbing as it crackles.
  const fish = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    fish.current.forEach((m, i) => {
      if (m) m.position.y = 0.99 + Math.abs(Math.sin(t * 6 + i * 1.7)) * 0.025
    })
  })
  return (
    <group>
      {/* The shed: four poles, the tin roof sloping back, the back wall and its sign */}
      {[
        [-1.8, -1.1],
        [1.8, -1.1],
        [-1.8, 1.25],
        [1.8, 1.25],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} s={[0.08, 2.6, 0.08]} p={[x, 1.3, z]} m={M.wood} />
      ))}
      <Box s={[4.0, 0.05, 2.9]} p={[0, 2.66, 0.08]} r={[0.07, 0, 0]} m={G.roof} />
      <Box s={[3.6, 2.4, 0.1]} p={[0, 1.2, -1.15]} m={G.wall} />
      <mesh position={[0, 2.25, 1.32]} scale={[2.2, 2.2 / sign.aspect, 1]} material={signMat}>
        <planeGeometry />
      </mesh>
      {/* The counter */}
      <Box s={[2.6, 0.08, 0.7]} p={[-0.35, 0.9, 0.85]} m={M.wood} />
      <Box s={[2.6, 0.86, 0.06]} p={[-0.35, 0.45, 1.18]} m={M.darkWood} />
      {/* The glass box of fried thon */}
      <group position={[-0.95, 0.94, 0.85]}>
        <Box s={[1.0, 0.04, 0.5]} p={[0, 0.02, 0]} m={G.frame} />
        <mesh geometry={BOX} material={G.glass} scale={[1.0, 0.42, 0.5]} position={[0, 0.25, 0]} />
        {[...Array(9)].map((_, i) => (
          <Box key={i} s={[0.2, 0.08, 0.12]} p={[-0.34 + (i % 3) * 0.34, 0.09 + Math.floor(i / 3) * 0.08, -0.12 + (i % 2) * 0.16]} r={[0, i * 0.5, 0]} m={i % 4 ? G.thon : G.thonCut} />
        ))}
      </group>
      {/* The attiéké in its basin, the piment, onions and tomatoes */}
      <mesh position={[0.05, 1.02, 0.85]} material={M.basin}>
        <cylinderGeometry args={[0.28, 0.22, 0.16, 12]} />
      </mesh>
      <mesh position={[0.05, 1.12, 0.85]} material={M.attieke}>
        <sphereGeometry args={[0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0.5, 0.98, 0.7]} material={G.piment}>
        <cylinderGeometry args={[0.1, 0.08, 0.08, 10]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <Box key={i} s={[0.07, 0.07, 0.07]} p={[0.45 + i * 0.1, 0.98, 1.0]} m={i === 1 ? G.tomato : G.onion} />
      ))}
      {/* The big pan of oil on the gas, the fish crackling, the bottle beside */}
      <group position={[1.35, 0, 0.6]}>
        <mesh position={[0, 0.3, 0]} material={M.iron}>
          <cylinderGeometry args={[0.32, 0.36, 0.6, 10, 1, true]} />
        </mesh>
        <mesh position={[0.55, 0.3, 0.1]} material={G.gas}>
          <cylinderGeometry args={[0.16, 0.16, 0.6, 10]} />
        </mesh>
        <mesh position={[0, 0.82, 0]} material={M.iron}>
          <cylinderGeometry args={[0.58, 0.3, 0.32, 16, 1, true]} />
        </mesh>
        <mesh position={[0, 0.95, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.oil}>
          <circleGeometry args={[0.55, 16]} />
        </mesh>
        {[...Array(5)].map((_, i) => (
          <mesh key={i} ref={(m) => void (fish.current[i] = m)} geometry={BOX} material={G.thon} scale={[0.2, 0.07, 0.11]} position={[Math.cos(i * 1.3) * 0.3, 0.99, Math.sin(i * 1.3) * 0.3]} rotation={[0, i, 0]} />
        ))}
        <Smoke p={[0, 1.0, 0]} n={6} />
      </group>
    </group>
  )
}

/** Someone pushing at the front: leaning in, stepping back, swaying side to side. */
function Jostle({ at, rot, phase, children }: { at: [number, number, number]; rot: number; phase: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.6 + phase
    const g = ref.current
    if (!g) return
    g.position.set(at[0] + Math.sin(t * 1.3) * 0.13, 0, at[2] + Math.sin(t * 0.9 + 1) * 0.16)
    g.rotation.set(Math.sin(t * 1.1) * 0.06, rot + Math.sin(t * 0.7) * 0.25, 0)
  })
  return <group ref={ref}>{children}</group>
}

/** What's shouted at the front, one after the other, and the seller's answers. */
const GARBA_VOICES: [string, [number, number, number]][] = [
  ['Donne-moi une grosse queue là-bas !', [-0.55, 2.3, 1.75]],
  ['Donne-moi milieu là !', [0.85, 2.3, 1.8]],
  ['Doucement, chacun son tour !', [0.75, 2.4, 0.1]],
  ["Pas celui-là, l'autre dans l'huile !", [0.2, 2.3, 1.7]],
  ["Moi j'étais là avant hein !", [-0.15, 2.3, 2.35]],
  ['Mets piment beaucoup !', [-0.55, 2.3, 1.75]],
  ['Grosse queue est finie, prends milieu !', [0.75, 2.4, 0.1]],
]

function GarbaVoices({ n }: { n: number }) {
  const [k, setK] = useState(0)
  useFrame(({ clock }) => {
    const i = Math.floor(clock.elapsedTime / 2.8) % GARBA_VOICES.length
    if (i !== k) setK(i)
  })
  // Only the ones there to say it (the front fills first).
  const [text, p] = GARBA_VOICES[k]
  if (n < 4 && p[2] > 2) return null
  return (
    <Html position={p} center zIndexRange={[22, 0]}>
      <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">{text}</div>
    </Html>
  )
}

const PIECES: [string, string, number][] = [
  ['queue', 'Grosse queue', 1000],
  ['milieu', 'Milieu', 1000],
  ['petit', 'Petit morceau', 500],
]

/** Choosing one's fish: the piece, and from the hot oil or from the box. */
function GarbaMenu({ onChoose, onClose }: { onChoose: (choice: string) => void; onClose: () => void }) {
  const [hot, setHot] = useState(false)
  return (
    <div className="w-[230px] rounded-[22px] bg-white p-3 text-[var(--color-ink)] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="font-display text-[16px] font-extrabold">Ton poisson ?</span>
        <button className="text-lg font-extrabold text-[var(--color-ink-soft)]" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-[var(--color-canvas)] p-1 text-[12px] font-extrabold">
        <button className={`rounded-full py-1.5 ${!hot ? 'bg-white shadow' : ''}`} onClick={() => setHot(false)}>
          📦 Dans la boîte
        </button>
        <button className={`rounded-full py-1.5 ${hot ? 'bg-white shadow' : ''}`} onClick={() => setHot(true)}>
          🔥 Dans l'huile
        </button>
      </div>
      <p className="mt-1.5 text-[11px] font-bold text-[var(--color-ink-soft)]">{hot ? "Il sort de l'huile : attends un peu, c'est bien chaud." : 'Déjà frit : servi tout de suite.'}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {PIECES.map(([id, label, price]) => (
          <button key={id} className="flex items-center justify-between rounded-xl bg-[var(--color-orange)] px-3 py-2 text-[13px] font-extrabold text-white active:scale-95" onClick={() => onChoose(`${id}-${hot ? 'huile' : 'boite'}`)}>
            <span>{label}</span>
            <span>{price.toLocaleString('fr-FR')} F</span>
          </button>
        ))}
      </div>
    </div>
  )
}

