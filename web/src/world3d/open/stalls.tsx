import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { NoShadows, type Pose } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { clearObstacles, inZone, setObstacles } from '../obstacles'
import { Solid } from '../Solid'
import { StaticMerge } from '../staticMerge'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import { lettering } from './ruePrincesse'
import { api } from '../../lib/api'
import type { Nav } from './nav'
import { placeIn, useJoined } from './joinIn'
import { useShare } from '../../lib/share'
import { GameHistory } from '../../components/GameHistory'
import { LOTO_ODDS, LotoTickets } from '../../components/LotoTickets'
import { keyOpen, useFeatures } from '../../lib/features'
import { t as tr, tx } from '../../lib/i18n'

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
//   choose: the piece, and from the hot oil or from the box;
// - the pain brochette man, from the late afternoon into the night: the long
//   charcoal grill on its legs, the skewers of beef smoking, the glass box of
//   baguettes, the onions, tomato and the bottle of mayonnaise, a bulb hung
//   over it all; the bread split, the meat slid off the skewers into it;
// - the loto kiosk (« Loto Chance », the game's own loto: game/loto.go): the
//   big square orange parasol, the seller at his table with the orange box,
//   the chalkboard of the last numbers on its stand, the long bench where the
//   regulars sit and talk about their numbers. Tap him to play a ticket.
// Around each, the customers: on the bench eating, waiting, chatting; more at
// the busy hours (lunch and evening for the food, morning for coffee), none in
// the dead of night. Tap the seller to buy (backend sims/street.go: the id's
// prefix says what); often it's sold out: « Ya pas banane oh ! ».

export type StallKind = 'alloco' | 'porc' | 'cafe' | 'the' | 'garba' | 'brochette' | 'loto'
export type Stall = { id: string; kind: StallKind; at: XZ; rot: number; seed: number }

const NEAR = 320 // metres: stalls drawn around the Sim
const MAX = 9
const CROWD_NEAR = 110 // metres: customers drawn round the nearest stalls
const REACH = 25 // metres: close enough to buy
/** A stall's middle and eight points round it (times its size), checked against the streets. */
const RING: [number, number][] = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as [number, number])]

/** What each calls out, what the bubble says, and the busy hours (crowd 0..1 by hour). */
const SELLER: Record<StallKind, { shout: string; ask: string; out: string; busy: (h: number) => number; r: number }> = {
  alloco: { shout: tr('Alloco chaud, 300 Djai !'), ask: tr('Alloco ? Viens prendre !'), out: tr('Ya pas banane oh !'), busy: (h) => (h < 8 || h >= 23 ? 0 : h >= 16 && h < 21 ? 1 : 0.45), r: 1.1 },
  porc: { shout: tr('Porc au four, viens goûter !'), ask: tr('Porc au four, 1500 Djai !'), out: tr('Le porc est fini, reviens demain !'), busy: (h) => (h < 11 ? 0 : h >= 18 ? 1 : h >= 12 && h < 14 ? 0.8 : 0.4), r: 2.6 },
  cafe: { shout: tr('Café ! Café chaud !'), ask: tr('Café, 150 Djai !'), out: tr('Le thermos est vide, attends un peu !'), busy: (h) => (h < 5 || h >= 23 ? 0 : h < 9 ? 1 : h >= 17 && h < 20 ? 0.6 : 0.3), r: 1 },
  garba: { shout: tr('Garba chaud ! Garba !'), ask: tr('Garba ? Viens choisir ton poisson !'), out: tr('Y a plus poisson oh !'), busy: (h) => (h >= 2 && h < 9 ? 0 : (h >= 12 && h < 14) || (h >= 19 && h < 23) ? 1 : 0.6), r: 2.4 },
  brochette: { shout: tr('Pain brochette ! Ça sort du feu !'), ask: tr('Pain brochette, 500 Djai !'), out: tr('Y a plus pain oh, attends le livreur !'), busy: (h) => (h >= 2 && h < 16 ? 0 : h >= 19 && h < 23 ? 1 : 0.55), r: 1.6 },
  loto: { shout: tr('Loto Chance ! Le prochain tirage arrive !'), ask: tr('Loto ? Viens jouer tes numéros !'), out: tr('Le tirage est en cours, attends un peu !'), busy: (h) => (h < 8 || h >= 22 ? 0 : h % 2 === 0 ? 1 : 0.6), r: 2.2 },
  the: { shout: tr('Thé bien mousseux !'), ask: tr('Thé, 100 Djai, assieds-toi !'), out: tr("Le thé n'est pas encore prêt !"), busy: (h) => (h < 6 ? 0 : h >= 17 ? 1 : 0.4), r: 1 },
}

export type Buy = (vendor: string, choice?: string) => Promise<string | null>

export function StreetStalls({ nav, seed, hour, onBuy }: { nav: Nav; seed: string; hour: number; onBuy?: Buy }) {
  const all = useMemo(() => stallsOf(nav, seed), [nav, seed])
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
      // Never on a fenced pitch or court.
      .filter((x) => x.d < NEAR && !inZone(x.s.at[0], x.s.at[1], 3))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => ({ s: x.s, crowd: x.d < CROWD_NEAR }))
    const key = (l: typeof near) => l.map((x) => x.s.id + x.crowd).join()
    if (key(near) !== key(shown)) setShown(near)
    // In development, for tests in the browser: the stalls drawn.
    if (import.meta.env.DEV) Object.assign(globalThis, { __stalls: near.map((x) => x.s), __allStalls: all })
  })
  return (
    <>
      {/* Near, each part too (a menu board, a bench out in front), beyond the circle round it */}
      {shown.map(({ s, crowd }) => (
        <Solid key={s.id} parts>
          <StreetStall stall={s} hour={hour} crowd={crowd} onBuy={onBuy} />
        </Solid>
      ))}
    </>
  )
}

/** Every possible stall of the loaded streets: a few street sides, chosen by where they are, so a stall is found again at the same place. */
export function stallsOf(nav: Nav, seed: string): Stall[] {
  const yop = seed.includes('yopougon')
  const out: Stall[] = []
  for (const e of nav.edges) {
    if (e.width > 10 || e.len < 30 || nav.ys[e.a] || nav.ys[e.b]) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const h = hash(Math.round(m[0]), Math.round(m[1]), 77)
    const kind: StallKind | null = h < 0.07 ? 'alloco' : h < 0.115 ? 'garba' : h < (yop ? 0.235 : 0.14) ? 'porc' : h > 0.93 && h <= 0.955 ? 'brochette' : h > 0.915 && h <= 0.93 ? 'loto' : h > 0.955 ? (hash(Math.round(m[1]), Math.round(m[0]), 5) < 0.55 ? 'cafe' : 'the') : null
    if (!kind) continue
    const side = hash(Math.round(m[1]), 3) < 0.5 ? 1 : -1
    const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
    // Back from the kerb by the stall's own size: the big ones (porc, garba) stood with their front on the road.
    const r = SELLER[kind].r
    const off = e.width / 2 + Math.max(3.2, 1.8 + r)
    // The porc au four women work side by side, three along the street.
    const along = kind === 'porc' ? [-6.5, 0, 6.5] : [0]
    for (const s of along) {
      const at: XZ = [m[0] - uz * off * side + ux * s, m[1] + ux * off * side + uz * s]
      if (!nav.walkable(at[0], at[1])) continue
      // Off every street all round, not just its own: the next one (a cross street, a parallel one) may pass there.
      if (RING.some(([dx, dz]) => nav.onRoad([at[0] + dx * r, at[1] + dz * r]))) continue
      // Facing the street (square to it, wherever along it).
      const rot = Math.atan2(uz * side, -ux * side)
      out.push({ id: `${kind}:${seed}:${Math.round(at[0])}:${Math.round(at[1])}`, kind, at, rot, seed: hash(at[0], at[1]) })
    }
  }
  return out
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
        <mesh key={i} ref={(x) => void (refs.current[i] = x)} geometry={BOX} material={m} userData={{ live: true }} />
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
 * The loto kiosk: a big square orange parasol on its pole, « LOTO CHANCE » on
 * its flaps; under it the seller's table with the orange box and the
 * tickets, his plastic chair, and the chalkboard of the last numbers on its
 * stand by the road.
 */
function LotoStand({ seed }: { seed: number }) {
  const sign = useMemo(() => lettering(tr('LOTO CHANCE'), '#f26b1d', '#ffffff', '#ffffff'), [])
  const mats = useMemo(() => ({ sign: new THREE.MeshLambertMaterial({ map: sign.t, side: THREE.DoubleSide }) }), [sign])
  // The board: five rows of numbers in chalk (as in the street, the last draws).
  const rows = useMemo(() => {
    const r = rng(`loto${seed}`)
    return [...Array(5)].map(() => [...Array(5)].map(() => 1 + Math.floor(r() * 90)))
  }, [seed])
  return (
    <group>
      {/* The parasol: a square canopy on a pole, the flaps all round */}
      <mesh position={[0, 1.3, -0.1]} material={M.iron}>
        <cylinderGeometry args={[0.04, 0.04, 2.6, 6]} />
      </mesh>
      <mesh position={[0, 2.75, -0.1]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.4, 0.5, 4, 1, true]} />
        <meshLambertMaterial color="#f26b1d" side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.sin((k * Math.PI) / 2) * 1.7, 2.38, -0.1 + Math.cos((k * Math.PI) / 2) * 1.7]} rotation={[0, (k * Math.PI) / 2, 0]} scale={[3.3, 3.3 / sign.aspect, 1]} material={mats.sign}>
          <planeGeometry />
        </mesh>
      ))}
      {/* The seller's table, the orange box, the tickets */}
      <Box s={[1.2, 0.06, 0.6]} p={[0, 0.74, 0.25]} m={M.wood} />
      {[
        [-0.55, 0],
        [0.55, 0],
        [-0.55, 0.5],
        [0.55, 0.5],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} s={[0.05, 0.72, 0.05]} p={[x, 0.36, z]} m={M.darkWood} />
      ))}
      <Box s={[0.5, 0.35, 0.35]} p={[0.25, 0.95, 0.2]} m={LT.box} />
      <Box s={[0.3, 0.01, 0.2]} p={[-0.3, 0.78, 0.3]} m={M.board} />
      <Box s={[0.25, 0.01, 0.16]} p={[-0.25, 0.79, 0.25]} r={[0, 0.3, 0]} m={LT.ticket} />
      {/* His plastic chair */}
      <Box s={[0.45, 0.05, 0.45]} p={[0, 0.42, -0.35]} m={LT.chair} />
      <Box s={[0.45, 0.45, 0.05]} p={[0, 0.66, -0.57]} m={LT.chair} />
      {/* The chalkboard on its stand, by the road */}
      <group position={[-1.7, 0, 0.7]} rotation={[-0.12, 0.35, 0]}>
        <Box s={[0.75, 0.95, 0.04]} p={[0, 0.75, 0]} m={M.slate} />
        {rows.map((row, i) => (
          <group key={i}>
            {row.map((n, j) => (
              <Box key={j} s={[0.08 + (n % 3) * 0.015, 0.05, 0.005]} p={[-0.26 + j * 0.13, 1.08 - i * 0.15, 0.025]} m={M.cup} />
            ))}
          </group>
        ))}
        <Box s={[0.04, 0.9, 0.04]} p={[0, 0.45, -0.28]} r={[0.55, 0, 0]} m={M.darkWood} />
      </group>
    </group>
  )
}

const LT = {
  box: lambert('#f26b1d'),
  ticket: lambert('#ffe08a'),
  chair: lambert('#f2c230'),
}

/** The loto ticket: which draw, 1 to 3 numbers out of 90, the stake (game/loto.go). */
function LotoMenu({ onChoose, onClose }: { onChoose: (choice: string) => void; onClose: () => void }) {
  const simId = useShare((x) => x.simId)
  // The loto comes with its update (lib/features.ts): till then, the kiosk says so.
  const feats = useFeatures()
  const [draws, setDraws] = useState<{ id: number; name: string; at: number; numbers?: number[] }[]>([])
  const [pays, setPays] = useState<Record<number, number>>({ 1: 15, 2: 250, 3: 2500 })
  const [draw, setDraw] = useState<number | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  // The stake: typed, or a usual one in a tap (backend game/loto.go: 100 to 10 000).
  const [typed, setTyped] = useState('200')
  const stake = Number(typed) || 0
  const badStake = stake < 100 ? tr('100 Djai au moins') : stake > 10000 ? tr('10 000 Djai au plus') : ''
  useEffect(() => {
    void api.lotoDraws().then((d) => {
      setPays(d.pays)
      setDraws(d.draws)
      setDraw(d.draws.find((x) => x.at > d.now)?.id ?? null)
    }, () => undefined)
  }, [])
  const now = Date.now() / 1000
  const next = draws.filter((d) => d.at > now).slice(0, 3)
  const last = [...draws].reverse().find((d) => d.numbers)
  const toggle = (n: number) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < 3 ? [...p, n] : p))
  const hour = (at: number) => new Date(at * 1000).toISOString().slice(11, 13) + ' h'
  if (!keyOpen(feats, 'loto'))
    return (
      <div className="w-[240px] rounded-2xl bg-white p-3 text-center text-[13px] font-extrabold text-[#141416] shadow-lg">
        {tr('Le Loto Chance arrive bientôt dans le jeu !')}
        <button className="mt-2 w-full rounded-xl bg-[#f26b1d] py-1.5 text-white" onClick={onClose}>
          {tr("D'accord")}
        </button>
      </div>
    )
  return (
    <div className="w-[300px] rounded-[22px] bg-white p-3 text-[var(--color-ink)] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="font-display text-[16px] font-extrabold text-[#f26b1d]">{tr('Loto Chance')}</span>
        <button className="text-lg font-extrabold text-[var(--color-ink-soft)]" onClick={onClose} aria-label={tr('Fermer')}>
          {tr('×')}
        </button>
      </div>
      {last && (
        <p className="mt-1 text-[11px] font-bold text-[var(--color-ink-soft)]">
          {tx('Dernier tirage « {name} » :', { name: last.name })} <b className="text-[var(--color-ink)]">{last.numbers!.join(' - ')}</b>
        </p>
      )}
      <div className="mt-2 flex gap-1">
        {next.map((d) => (
          <button key={d.id} onClick={() => setDraw(d.id)} className={`min-w-0 flex-1 truncate rounded-full px-2 py-1 text-[11px] font-extrabold ${draw === d.id ? 'bg-[#f26b1d] text-white' : 'bg-[var(--color-canvas)]'}`}>
            {hour(d.at)} · {d.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <p className="min-w-0 flex-1 text-[11px] font-bold text-[var(--color-ink-soft)]">{tr('Choisis 1 à 3 numéros : ils doivent tous sortir parmi les 5.')}</p>
        {/* « Flash »: the kiosk picks them (as many as already chosen, else one). */}
        <button className="shrink-0 rounded-full bg-[#141416] px-2.5 py-1 text-[11px] font-extrabold text-white" onClick={() => setPicked((p) => [...Array(90)].map((_, i) => i + 1).sort(() => Math.random() - 0.5).slice(0, Math.max(1, p.length)))}>
          {tr('Flash')}
        </button>
      </div>
      <div className="mt-1 grid grid-cols-10 gap-0.5">
        {[...Array(90)].map((_, i) => (
          <button key={i} onClick={() => toggle(i + 1)} className={`rounded py-0.5 text-[11px] font-extrabold tabular-nums ${picked.includes(i + 1) ? 'bg-[#f26b1d] text-white' : 'bg-[var(--color-canvas)]'}`}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <label className="flex min-w-0 flex-[1.4] items-center gap-1 rounded-full bg-[var(--color-canvas)] px-2.5 py-1">
          <span className="text-[10px] font-extrabold text-[var(--color-ink-soft)] uppercase">{tr('Mise')}</span>
          <input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-0 min-w-0 flex-1 bg-transparent text-right text-[13px] font-extrabold outline-none" aria-label={tr('Mise en Djai')} />
        </label>
        {[200, 500, 1000, 2000].map((v) => (
          <button key={v} onClick={() => setTyped(String(v))} className={`flex-1 rounded-full py-1 text-[11px] font-extrabold ${stake === v ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)]'}`}>
            {v}
          </button>
        ))}
      </div>
      {badStake && <p className="mt-1 text-[11px] font-bold text-[#d81b3f]">{badStake}</p>}
      {/* The real chances, told plainly. */}
      <p className="mt-1 text-[10.5px] font-bold text-[var(--color-ink-soft)]">
        {[1, 2, 3].map((k) => tr('{k} n° : 1 chance sur {0}, ×{1}', { k, 0: Math.round(LOTO_ODDS[k]).toLocaleString('fr-FR'), 1: pays[k] })).join(' · ')}
      </p>
      <button
        disabled={!draw || picked.length === 0 || !!badStake}
        onClick={() => onChoose(JSON.stringify({ draw, numbers: picked, stake }))}
        className="mt-2 w-full rounded-xl bg-[#f26b1d] py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
      >
        {picked.length ? tr('Jouer {0} · {stake} Djai → {1} Djai', { 0: picked.join('-'), stake, 1: (stake * (pays[picked.length] ?? 0)).toLocaleString('fr-FR') }) : tr('Choisis tes numéros')}
      </button>
      {simId && <LotoTickets simId={simId} />}
      {/* The tickets played before, what they came to (components/GameHistory.tsx). */}
      {simId && (
        <div className="mt-2 rounded-xl bg-[#0f1230] px-2 pt-0.5 pb-2">
          <GameHistory simId={simId} jeu="loto" />
        </div>
      )}
    </div>
  )
}

/**
 * The pain brochette: the long, narrow charcoal grill on its iron legs, the
 * skewers of beef in a row over the embers, smoking; beside it the table with
 * the glass box of baguettes, the basins of onion and tomato, the mayonnaise
 * and the piment; a bare bulb hung on a pole over it all for the night.
 */
function BrochetteStand({ night }: { night: boolean }) {
  return (
    <group>
      {/* The grill: a long trough on legs, the embers, the grid, the skewers */}
      <group position={[0.1, 0, 0.75]}>
        <Box s={[1.5, 0.18, 0.36]} p={[0, 0.82, 0]} m={M.rust} />
        {[-0.65, 0.65].map((x) => (
          <Box key={x} s={[0.05, 0.74, 0.3]} p={[x, 0.37, 0]} m={M.iron} />
        ))}
        <Box s={[1.4, 0.03, 0.28]} p={[0, 0.9, 0]} m={M.coal} />
        <Box s={[1.45, 0.015, 0.32]} p={[0, 0.95, 0]} m={M.net} />
        {[...Array(9)].map((_, i) => (
          <group key={i} position={[-0.6 + i * 0.15, 0.98, 0]}>
            <Box s={[0.012, 0.012, 0.46]} p={[0, 0, 0.04]} m={M.darkWood} />
            {[-0.09, 0, 0.09].map((z) => (
              <Box key={z} s={[0.06, 0.05, 0.07]} p={[0, 0.02, z]} r={[0, i + z * 9, 0]} m={i % 3 === 1 ? M.porkFat : M.pork} />
            ))}
          </group>
        ))}
        <Smoke p={[0, 1.0, 0]} n={7} />
      </group>
      {/* The table: the glass box of baguettes, onion and tomato, the mayonnaise and the piment */}
      <group position={[1.55, 0, 0.6]}>
        <Box s={[1.0, 0.07, 0.7]} p={[0, 0.85, 0]} m={M.wood} />
        {[
          [-0.42, -0.28],
          [0.42, -0.28],
          [-0.42, 0.28],
          [0.42, 0.28],
        ].map(([x, z]) => (
          <Box key={`${x}${z}`} s={[0.06, 0.84, 0.06]} p={[x, 0.42, z]} m={M.darkWood} />
        ))}
        <Box s={[0.85, 0.32, 0.3]} p={[0, 1.05, -0.15]} m={BR.glass} />
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} s={[0.75, 0.07, 0.07]} p={[0, 0.94 + Math.floor(i / 2) * 0.08, -0.22 + (i % 2) * 0.12]} r={[0, 0.04 * i, 0]} m={BR.bread} />
        ))}
        <mesh position={[-0.25, 0.94, 0.2]} material={M.basin}>
          <cylinderGeometry args={[0.13, 0.1, 0.1, 10]} />
        </mesh>
        <mesh position={[-0.25, 0.995, 0.2]} material={BR.onion}>
          <cylinderGeometry args={[0.11, 0.11, 0.01, 10]} />
        </mesh>
        <mesh position={[0.05, 0.94, 0.2]} material={M.basin}>
          <cylinderGeometry args={[0.12, 0.09, 0.1, 10]} />
        </mesh>
        <mesh position={[0.05, 0.995, 0.2]} material={M.red}>
          <cylinderGeometry args={[0.1, 0.1, 0.01, 10]} />
        </mesh>
        <mesh position={[0.3, 1.0, 0.2]} material={BR.mayo}>
          <cylinderGeometry args={[0.04, 0.045, 0.22, 8]} />
        </mesh>
        <mesh position={[0.4, 0.93, 0.25]} material={M.red}>
          <cylinderGeometry args={[0.05, 0.05, 0.08, 8]} />
        </mesh>
        {/* A bread open on its paper, the meat going in */}
        <Box s={[0.3, 0.01, 0.2]} p={[0.25, 0.89, -0.05 + 0.35]} m={M.board} />
        <Box s={[0.26, 0.06, 0.08]} p={[0.25, 0.92, 0.3]} m={BR.bread} />
        <Box s={[0.2, 0.03, 0.04]} p={[0.25, 0.96, 0.3]} m={M.pork} />
      </group>
      {/* The pole and the bulb */}
      <Box s={[0.05, 2.5, 0.05]} p={[-0.85, 1.25, 0.4]} m={M.iron} />
      <Box s={[1.0, 0.04, 0.04]} p={[-0.4, 2.48, 0.4]} m={M.iron} />
      <mesh position={[0.05, 2.3, 0.45]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshLambertMaterial color={night ? '#fff2c2' : '#d8d8d0'} emissive={night ? '#fff2c2' : '#000000'} emissiveIntensity={night ? 1.2 : 0} />
      </mesh>
      {night && <pointLight position={[0.05, 2.2, 0.6]} color="#ffd89a" intensity={6} distance={7} decay={2} />}
    </group>
  )
}

const BR = {
  bread: lambert('#d9a35a'),
  onion: lambert('#e9d3e6'),
  mayo: lambert('#f4ecc4'),
  glass: new THREE.MeshLambertMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.3, depthWrite: false }),
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
  const sign = useMemo(() => lettering(tr('THÉ · CAFÉ'), '#d6202a', '#ffffff', '#ffffff'), [])
  const tag = useMemo(() => lettering(tr('{price} Djai', { price }), '#d6202a', '#ffffff', '#d6202a'), [price])
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

/** Where one sits to eat what was bought, in the stall's frame: x, z, facing. */
const EAT_AT: Partial<Record<StallKind, [number, number, number]>> = { alloco: [-1.6, 3.1, Math.PI * 0.9], porc: [1.45, -2.7, -Math.PI / 2], brochette: [-2.0, 2.45, Math.PI / 2], garba: [2.75, 2.45, -Math.PI / 2] }

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
    case 'brochette':
      // Waiting round the grill for their bread; one eating on the bench at the side.
      return [stand(0.4, 1.9, 'idle'), stand(-0.4, 2.1, 'talk'), sit(-2.0, 1.6, Math.PI / 2), stand(1.2, 2.2, 'phone'), stand(-0.2, 2.9, 'talk'), sit(-2.0, 0.9, Math.PI / 2, 'drink')]
    case 'loto':
      // On the long bench, and standing round the table, looking at the board.
      return [sit(-1.6, 1.9, Math.PI, 'sit'), stand(0.2, 1.5, 'talk'), sit(-0.6, 1.9, Math.PI, 'sit'), stand(0.9, 1.6, 'idle'), sit(0.6, 1.9, Math.PI, 'phone'), stand(-0.5, 1.2, 'talk'), sit(1.6, 1.9, Math.PI, 'sit')]
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
            <TalkHuman id={`stalls:724:${Math.round((c.seed) * 1000)}`} look={looks[i]} gender={c.gender} pose={c.pose} seed={c.seed} />
          </Jostle>
        ) : (
          <group key={i} position={c.at} rotation={[0, c.rot, 0]}>
            <TalkHuman id={`stalls:728:${Math.round((c.seed) * 1000)}`} look={looks[i]} gender={c.gender} pose={c.pose} seed={c.seed} />
          </group>
        ),
      )}
      {stall.kind === 'garba' && n > 0 && <GarbaVoices n={n} seed={stall.seed} />}
      {/* The seats some of them sit on (the porc au four has its own) */}
      {stall.kind === 'alloco' && <Bench p={[-0.05, 0, 2.8]} />}
      {stall.kind === 'garba' && <Bench p={[2.75, 0, 1.25]} r={Math.PI / 2} w={1.5} />}
      {stall.kind === 'brochette' && <Bench p={[-2.0, 0, 1.25]} r={Math.PI / 2} w={1.5} />}
      {stall.kind === 'loto' && <Bench p={[0, 0, 1.9]} w={4.2} />}
      {(stall.kind === 'cafe' || stall.kind === 'the') && <Bench p={[-1.6, 0, 2.4]} r={Math.PI * 0.75 - Math.PI / 2} w={0.8} />}
    </NoShadows>
  )
}

/* ---------- The pousse-pousse serving ---------- */

/** Where the seller stands to serve, and where the Sim sits, in front of the cart (x across it, z out to the street). */
const SERVE = { x: 0.95, seller: 1.45, sim: 2.5 }
const tin = new THREE.MeshLambertMaterial({ color: '#c9ccd1' })
const teaMat = new THREE.MeshBasicMaterial({ color: '#9a4f12' })
const coffeeMat = new THREE.MeshBasicMaterial({ color: '#3b2412' })
const glassMat = new THREE.MeshLambertMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.85 })
const STREAM = new THREE.CylinderGeometry(0.012, 0.012, 1, 6)

/**
 * The seller serves the Sim, on and on while it's there (three teas, as one does): up from his
 * stool, the teapot lifted high and poured into the glass, glass to glass for the foam (the tea;
 * the coffee goes straight from the thermos), handed over to the Sim on its stool, and again.
 */
function Serve({ tea }: { tea: boolean }) {
  const pot = useRef<THREE.Group>(null)
  const stream = useRef<THREE.Mesh>(null)
  const low = useRef<THREE.Group>(null)
  const high = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  // In front of his hands, between him and the Sim.
  const z = SERVE.seller + 0.5
  useFrame(({ clock }) => {
    t0.current ??= clock.elapsedTime
    const u = ((clock.elapsedTime - t0.current) % 11) / 11
    const ease = (k: number) => k * k * (3 - 2 * k)
    // 0–0.1 the pot goes up, 0.1–0.42 pours, 0.42–0.64 glass to glass (the tea), 0.64–0.72 the pot down, 0.72–0.84 the glass handed over.
    const up = u < 0.1 ? ease(u / 0.1) : u < 0.64 ? 1 : u < 0.72 ? 1 - ease((u - 0.64) / 0.08) : 0
    const pouring = u >= 0.1 && u < (tea ? 0.42 : 0.64)
    const foaming = tea && u >= 0.42 && u < 0.64
    if (pot.current) {
      pot.current.position.set(SERVE.x - 0.1, 1.02 + 0.6 * up, z - 0.06)
      pot.current.rotation.x = pouring ? 0.85 : 0
    }
    // Glass to glass: the full one up high, poured back into the other, down, and again.
    const lift = foaming ? Math.abs(Math.sin(((u - 0.42) / 0.22) * Math.PI * 2)) : 0
    if (high.current) {
      const hand = u >= 0.72 && u < 0.84 ? ease((u - 0.72) / 0.12) : 0
      high.current.position.set(SERVE.x + 0.12, 1.0 + lift * 0.6 - hand * 0.2, z + hand * (SERVE.sim - z - 0.25))
      high.current.rotation.x = lift > 0.6 ? 1.2 : 0
      // Handed over: in the Sim's hand, drunk.
      high.current.visible = u < 0.84
    }
    if (low.current) low.current.visible = tea
    if (stream.current) {
      stream.current.visible = pouring || (foaming && lift > 0.6)
      const [top, x] = pouring ? [1.58 + 0.12, SERVE.x + 0.12] : [1.0 + lift * 0.6, SERVE.x + 0.02]
      stream.current.scale.set(1, Math.max(0.05, top - 1.06), 1)
      stream.current.position.set(x, (top + 1.06) / 2, z)
    }
  })
  return (
    <group>
      {/* The teapot (or the thermos), the glass poured into, the other one for the foam */}
      <group ref={pot}>
        {tea ? (
          <>
            <mesh material={tin} position={[0, 0.07, 0]}>
              <cylinderGeometry args={[0.07, 0.09, 0.14, 10]} />
            </mesh>
            <mesh material={tin} position={[0.11, 0.1, 0.05]} rotation={[0.5, 0, -0.9]}>
              <cylinderGeometry args={[0.012, 0.02, 0.16, 6]} />
            </mesh>
          </>
        ) : (
          <mesh material={M.thermos[0]} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.24, 10]} />
          </mesh>
        )}
      </group>
      <group ref={high}>
        <mesh material={glassMat} position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.035, 0.03, 0.1, 8]} />
        </mesh>
      </group>
      <group ref={low} position={[SERVE.x + 0.02, 1.0, z]}>
        <mesh material={glassMat} position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.035, 0.03, 0.1, 8]} />
        </mesh>
      </group>
      <mesh ref={stream} geometry={STREAM} material={tea ? teaMat : coffeeMat} visible={false} />
    </group>
  )
}

/* ---------- One stall, its seller, the customers ---------- */

/** One stall and its seller. Local +z faces the street. */
export function StreetStall({ stall, hour, crowd, onBuy }: { stall: Stall; hour: number; crowd: boolean; onBuy?: Buy }) {
  const sl = SELLER[stall.kind]
  const man = ((stall.kind === 'cafe' || stall.kind === 'the') && stall.seed < 0.85) || stall.kind === 'garba' || stall.kind === 'brochette'
  const look = useMemo(() => randomLook(man ? 'homme' : 'femme', rng(stall.id)), [stall.id, man])
  const helper = useMemo(() => (stall.kind === 'porc' ? randomLook('femme', rng(`${stall.id}h`)) : stall.kind === 'garba' ? randomLook('homme', rng(`${stall.id}h`)) : null), [stall.id, stall.kind])
  const parasol = useMemo(() => ['#e8432f', '#1f9a4a', '#f2a81d', '#2f7fd0'][Math.floor(stall.seed * 4)], [stall.seed])
  const [said, setSaid] = useState<string | null>(null)
  const [near, setNear] = useState(false)
  // At the garbadrome: choosing one's fish.
  const [choosing, setChoosing] = useState(false)
  // A Loto ticket just bought: « Partager mon ticket » for a while (to a friend, to the grin).
  const [bought, setBought] = useState(false)
  // Bought something to eat: a stool beside the stall (by the others on its bench, at the porc's table's end), the plate on the lap (OutdoorAction).
  const sitToEat = () => {
    const at = EAT_AT[stall.kind]
    if (at) whereabouts.joined = { id: stall.id, activity: `street-${stall.kind}`, spot: { ...placeIn(stall, at[0], at[1], at[2], 'eat', 0.05), stool: true } }
  }
  const choose = async (choice: string) => {
    setChoosing(false)
    if (stall.kind === 'garba') sitToEat()
    say('…', 20000)
    const text = await onBuy?.(stall.id, choice)
    if (text) say(text)
    else setSaid(null)
    if (stall.kind === 'loto' && text && text !== sl.out) {
      setBought(true)
      setTimeout(() => setBought(false), 30000)
    }
  }
  const shareLoto = async () => {
    const { simId, share } = useShare.getState()
    if (!simId) return
    const [last] = await api.myLoto(simId).catch(() => [])
    if (!last) return
    const { ref } = await api.shareTicket(simId, 'loto', last.id)
    setBought(false)
    share({ title: tr('Partager mon ticket Loto'), body: ref })
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
    if (d > REACH) return say(tr('Approche, mon enfant !'), 3000)
    if (!onBuy) return
    if (stall.kind === 'garba' || stall.kind === 'loto') return setChoosing(true)
    // At the pousse-pousse: a stool by the cart, facing the seller who serves (Serve); no défi, it's his tea.
    if (stall.kind === 'the' || stall.kind === 'cafe') whereabouts.joined = { id: stall.id, activity: `street-${stall.kind}`, spot: { ...placeIn(stall, SERVE.x, SERVE.sim, Math.PI, 'drink', 0.05), stool: true } }
    else sitToEat()
    say('…', 20000)
    const text = await onBuy(stall.id)
    if (text) say(text)
    else setSaid(null)
  }
  // Where the seller stands, and doing what.
  // The café/thé seller sits on his stool beside the cart (as in the street), turned to the passers-by.
  const serving = useJoined(stall.id) && (stall.kind === 'the' || stall.kind === 'cafe')
  const [sellerAt, sellerPose]: [[number, number, number], Pose] = serving ? [[SERVE.x, 0, SERVE.seller], 'cook'] : stall.kind === 'porc' ? [[-1.3, 0, -0.1], 'cook'] : stall.kind === 'garba' ? [[0.75, 0, 0.1], 'cook'] : stall.kind === 'brochette' ? [[0.1, 0, -0.1], 'cook'] : stall.kind === 'loto' ? [[0, 0, -0.35], 'sit'] : stall.kind === 'alloco' ? [[0, 0, 0], 'idle'] : [[0.95, 0, 1.08], 'sit']
  return (
    <group position={[stall.at[0], 0, stall.at[1]]} rotation={[0, stall.rot, 0]} onClick={(e) => (e.stopPropagation(), void tap())}>
      {/* The stand drawn in a few meshes (its smoke and frying fish left to move) */}
      <StaticMerge version={hour >= 18 || hour < 6 ? 1 : 0}>
        {stall.kind === 'alloco' && <AllocoStand parasol={parasol} />}
        {stall.kind === 'porc' && <PorcStand />}
        {stall.kind === 'garba' && <GarbaStand />}
        {stall.kind === 'brochette' && <BrochetteStand night={hour >= 18 || hour < 6} />}
        {stall.kind === 'loto' && <LotoStand seed={stall.seed} />}
        {(stall.kind === 'cafe' || stall.kind === 'the') && <Cart tea={stall.kind === 'the'} price={stall.kind === 'the' ? 100 : 150} />}
      </StaticMerge>
      <group position={sellerAt}>
        <TalkHuman id={`stalls:806:${Math.round((stall.seed * 100) * 1000)}`} look={look} gender={man ? 'homme' : 'femme'} pose={sellerPose} seed={stall.seed * 100} />
      </group>
      {/* At the porc au four, a second woman cuts and serves */}
      {helper && (
        <group position={stall.kind === 'garba' ? [-0.55, 0, 0.15] : [0.7, 0, 0.25]}>
          <TalkHuman id={`stalls:811:${Math.round((stall.seed * 100 + 7) * 1000)}`} look={helper} gender={stall.kind === 'garba' ? 'homme' : 'femme'} pose="busy" seed={stall.seed * 100 + 7} />
        </group>
      )}
      {crowd && <Crowd stall={stall} hour={hour} />}
      {serving && <Serve tea={stall.kind === 'the'} />}
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
      {bought && !choosing && (
        <Html position={[0, 1.5, 1.2]} center zIndexRange={[26, 0]}>
          <button onClick={() => void shareLoto()} className="flex items-center gap-1.5 rounded-full bg-[#f26b1d] px-3 py-1.5 text-[12px] font-extrabold whitespace-nowrap text-white shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] active:scale-95">
            {tr('Partager mon ticket')}
          </button>
        </Html>
      )}
      {choosing && (
        <Html position={[0, 2.2, 1.2]} center zIndexRange={[30, 0]}>
          {stall.kind === 'loto' ? <LotoMenu onChoose={(c) => void choose(c)} onClose={() => setChoosing(false)} /> : <GarbaMenu onChoose={(c) => void choose(c)} onClose={() => setChoosing(false)} />}
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
          <mesh key={i} ref={(m) => void (fish.current[i] = m)} userData={{ live: true }} geometry={BOX} material={G.thon} scale={[0.2, 0.07, 0.11]} position={[Math.cos(i * 1.3) * 0.3, 0.99, Math.sin(i * 1.3) * 0.3]} rotation={[0, i, 0]} />
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
  [tr('Donne-moi une grosse queue là-bas !'), [-0.55, 2.3, 1.75]],
  [tr('Donne-moi milieu là !'), [0.85, 2.3, 1.8]],
  [tr('Doucement, chacun son tour !'), [0.75, 2.4, 0.1]],
  [tr("Pas celui-là, l'autre dans l'huile !"), [0.2, 2.3, 1.7]],
  [tr("Moi j'étais là avant hein !"), [-0.15, 2.3, 2.35]],
  [tr('Mets piment beaucoup !'), [-0.55, 2.3, 1.75]],
  [tr('Grosse queue est finie, prends milieu !'), [0.75, 2.4, 0.1]],
]

function GarbaVoices({ n, seed }: { n: number; /** The stall's: two stalls side by side don't shout the same thing at once. */ seed: number }) {
  const [k, setK] = useState(0)
  const start = Math.floor(seed * GARBA_VOICES.length * 7)
  useFrame(({ clock }) => {
    const i = (Math.floor(clock.elapsedTime / (2.6 + seed * 0.6) + seed * 3) + start) % GARBA_VOICES.length
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
  ['queue', tr('Grosse queue'), 1000],
  ['milieu', tr('Milieu'), 1000],
  ['petit', tr('Petit morceau'), 500],
]

/** Choosing one's fish: the piece, and from the hot oil or from the box. */
function GarbaMenu({ onChoose, onClose }: { onChoose: (choice: string) => void; onClose: () => void }) {
  const [hot, setHot] = useState(false)
  return (
    <div className="w-[230px] rounded-[22px] bg-white p-3 text-[var(--color-ink)] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="font-display text-[16px] font-extrabold">{tr('Ton poisson ?')}</span>
        <button className="text-lg font-extrabold text-[var(--color-ink-soft)]" onClick={onClose} aria-label={tr('Fermer')}>
          {tr('×')}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-[var(--color-canvas)] p-1 text-[12px] font-extrabold">
        <button className={`rounded-full py-1.5 ${!hot ? 'bg-white shadow' : ''}`} onClick={() => setHot(false)}>
          {tr('📦 Dans la boîte')}
        </button>
        <button className={`rounded-full py-1.5 ${hot ? 'bg-white shadow' : ''}`} onClick={() => setHot(true)}>
          {tr("🔥 Dans l'huile")}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] font-bold text-[var(--color-ink-soft)]">{hot ? tr("Il sort de l'huile : attends un peu, c'est bien chaud.") : tr('Déjà frit : servi tout de suite.')}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {PIECES.map(([id, label, price]) => (
          <button key={id} className="flex items-center justify-between rounded-xl bg-[var(--color-orange)] px-3 py-2 text-[13px] font-extrabold text-white active:scale-95" onClick={() => onChoose(`${id}-${hot ? 'huile' : 'boite'}`)}>
            <span>{label}</span>
            <span>{price.toLocaleString('fr-FR')} {tr('Djai')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

