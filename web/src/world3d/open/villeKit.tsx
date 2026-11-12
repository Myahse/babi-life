import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, Blocks, lettering, signMaterial } from './ruePrincesse'
import type { At } from './shoreline'
import { put, blocksMat, seeded, type Part } from './kit3d'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { worldTime } from '../../lib/worldClock'
import { whereabouts } from '../whereabouts'
import { ambience } from '../../audio/ambience'

// The towns' night places and their people, shared by Yamoussoukro's, Bouaké's, San-Pédro's and Korhogo's
// models (yakroVille.tsx, bouakeVille.tsx, sanPedro.tsx, korhogo.tsx): the maquis (plastic chairs round
// their tables, the grill and its smoke, the strings of bulbs, the crates and the freezer), the clubs (the
// dark front, the neon name and strips beating with the music, the beams turning over the roof, the queue
// and the bouncer, the bass heard through the walls when the Sim is near). Each drawn mostly at once: one
// list of coloured blocks (kit3d.ts), one of bulbs, the sign, the fire; the people only close by.

/* ---------- Small shared pieces ---------- */

/** A lettered sign, lit at night. */
export function useSign(text: string, bg: string, ink: string, night: boolean, glow = 0.8, border = ink) {
  const s = useMemo(() => {
    const l = lettering(text, bg, ink, border)
    return { m: signMaterial(l.t), aspect: l.aspect }
  }, [text, bg, ink, border])
  s.m.emissiveIntensity = night ? glow : 0
  return s
}

/** The sign's plane, `w` wide, at p turned ry. */
export function Sign({ s, w, p, ry = 0 }: { s: { m: THREE.Material; aspect: number }; w: number; p: [number, number, number]; ry?: number }) {
  return (
    <mesh position={p} rotation={[0, ry, 0]} material={s.m}>
      <planeGeometry args={[w, w / s.aspect]} />
    </mesh>
  )
}

/** Shown only with the camera within this many metres (the people, the small things: from afar nobody sees them). */
export function Near({ within, children }: { within: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    if (!g.current) return
    g.current.getWorldPosition(v)
    g.current.visible = camera.position.distanceTo(v) < within
  })
  return <group ref={g}>{children}</group>
}

export type Who = { p: [number, number, number]; ry: number; pose: Pose; dress?: { outfit: string; outfitColor: string }; gender?: 'femme' | 'homme' }
/** People of the place, their looks drawn once from the seed. */
export function usePeople(seed: string, spots: Who[]) {
  return useMemo(() => {
    const r = rng(seed)
    return spots.map((s) => {
      const gender = s.gender ?? (s.dress?.outfit === 'pagne' || r() < 0.45 ? 'femme' : 'homme')
      const look = randomLook(gender, r)
      return { ...s, gender, look: s.dress ? { ...look, ...s.dress } : look, seed: r() * 100 }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
export function People({ list, within = 110 }: { list: ReturnType<typeof usePeople>; within?: number }) {
  return (
    <Near within={within}>
      <NoShadows>
        {list.map((p, i) => (
          <group key={i} position={p.p} rotation={[0, p.ry, 0]}>
            <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </Near>
  )
}

const BULB_DAY = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const BULB_NIGHT = new THREE.MeshBasicMaterial({ color: '#ffffff' })
/** Coloured bulbs: plain by day, glowing in their colours at night (one draw). */
export function Bulbs({ at, night }: { at: At[]; night: boolean }) {
  return <Blocks key={night ? 'n' : 'd'} at={at} material={night ? BULB_NIGHT : BULB_DAY} color />
}
export const BULB_COLOURS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac', '#ff922b', '#ffffff']

/** A string of bulbs from a to b (x, y, z), sagging; its cable pushed onto `cables`, its bulbs onto `bulbs`. */
export function stringLights(bulbs: At[], cables: At[], a: [number, number, number], b: [number, number, number], n: number, k = 0) {
  const [dx, dz] = [b[0] - a[0], b[2] - a[2]]
  const len = Math.hypot(dx, dz)
  const ry = -Math.atan2(dz, dx)
  cables.push({ p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.3, (a[2] + b[2]) / 2], s: [len, 0.04, 0.04], ry, c: '#222222' })
  for (let i = 1; i < n; i++) {
    const u = i / n
    const y = a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * 0.5
    bulbs.push({ p: [a[0] + dx * u, y - 0.15, a[2] + dz * u], s: [0.26, 0.26, 0.26], c: BULB_COLOURS[(i + k) % BULB_COLOURS.length] })
  }
}

/** A plastic table and its four chairs, in one colour (the brewery's white, red or blue), facing in. */
export function plasticSet(c: string): Part[] {
  const out: Part[] = [[0, 0.72, 0, 0.9, 0.06, 0.9, c], [0, 0.36, 0, 0.12, 0.72, 0.12, c]]
  for (const [ox, oz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]] as const) {
    out.push([ox, 0.23, oz, 0.45, 0.46, 0.45, c])
    out.push([ox * 1.25, 0.6, oz * 1.25, oz ? 0.45 : 0.08, 0.55, oz ? 0.08 : 0.45, c])
  }
  // Bottles and a plate on the table.
  out.push([0.15, 0.88, 0.1, 0.08, 0.26, 0.08, '#2b5a2a'], [-0.12, 0.88, -0.1, 0.08, 0.26, 0.08, '#6b3a1a'], [-0.1, 0.77, 0.22, 0.3, 0.03, 0.3, '#f4f1e6'])
  return out
}
/** The seats round a plasticSet at (x, z): where the eaters sit, facing the table. */
export const seatsAround = (x: number, z: number): [number, number, number][] => [[x + 0.8, z, -Math.PI / 2], [x - 0.8, z, Math.PI / 2], [x, z + 0.8, Math.PI], [x, z - 0.8, 0]]

/** A grill of half an oil drum on its legs, the grid on top, the meat or the fish on it; the fire's place under it. */
export function grillParts(food: 'fish' | 'meat' | 'alloco'): Part[] {
  const out: Part[] = [[0, 0.72, 0, 1.6, 0.4, 0.7, '#3a3a3a'], [-0.7, 0.36, -0.28, 0.08, 0.72, 0.08, '#2a2a2a'], [0.7, 0.36, -0.28, 0.08, 0.72, 0.08, '#2a2a2a'], [-0.7, 0.36, 0.28, 0.08, 0.72, 0.08, '#2a2a2a'], [0.7, 0.36, 0.28, 0.08, 0.72, 0.08, '#2a2a2a'], [0, 0.94, 0, 1.6, 0.03, 0.7, '#8a8a8a']]
  if (food === 'alloco') out.push([0, 0.98, 0, 1.0, 0.12, 0.6, '#5a5a5a'], [0, 1.05, 0, 0.9, 0.04, 0.5, '#e0a020'])
  else for (let i = 0; i < 5; i++) out.push(food === 'fish' ? [-0.56 + i * 0.28, 0.99, 0, 0.18, 0.06, 0.5, i % 2 ? '#a8805a' : '#8a6040'] : [-0.56 + i * 0.28, 0.99, 0, 0.18, 0.08, 0.18, '#7a3a1a'])
  return out
}
/** Crates of beer stacked, a chest freezer, a speaker or two: the corner of the bar. */
export function barCorner(): Part[] {
  const out: Part[] = [[0, 0.45, 0, 1.4, 0.9, 0.7, '#f4f4f2'], [0, 0.92, 0, 1.36, 0.06, 0.66, '#d0d6dc'], [1.4, 0.6, 0, 0.7, 1.2, 0.6, '#1c1c1e'], [1.4, 0.6, 0.31, 0.4, 0.4, 0.02, '#4a4a4f'], [1.4, 1.5, 0, 0.5, 0.6, 0.45, '#1c1c1e']]
  for (let i = 0; i < 4; i++) out.push([-1.3, 0.15 + i * 0.3, (i % 2) * 0.1 - 0.1, 0.5, 0.28, 0.4, i % 2 ? '#c92a2a' : '#f0b429'])
  return out
}

/* ---------- The fire and the beat ---------- */

/** The grill's embers flickering (one shared material per place), its smoke rising. */
export function useFire() {
  return useMemo(
    () => ({
      ember: new THREE.MeshLambertMaterial({ color: '#ff6a1a', emissive: '#ff4a00', emissiveIntensity: 0.9 }),
      smoke: new THREE.MeshLambertMaterial({ color: '#d8d4cc', transparent: true, opacity: 0.35, depthWrite: false }),
    }),
    [],
  )
}
/** (`at` kept by the caller, not made anew each render: the blocks would be built again.) */
export function Fire({ fire, at, seed = 0 }: { fire: ReturnType<typeof useFire>; at: [number, number, number][]; seed?: number }) {
  const smoke = useRef<THREE.Group>(null)
  const embers = useMemo<At[]>(() => at.map(([x, z, ry]) => ({ p: [x, 0.93, z], s: [1.5, 0.08, 0.6], ry })), [at])
  const puffs = useMemo<At[]>(() => at.flatMap(([x, z]) => [0, 1, 2].map((k) => ({ p: [x + (k - 1) * 0.2, 1.6 + k * 0.9, z], s: [0.7 + k * 0.4, 0.7 + k * 0.4, 0.7 + k * 0.4] }))), [at])
  useFrame(() => {
    const t = worldTime() + seed
    fire.ember.emissiveIntensity = 0.8 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23) * 0.12
    if (smoke.current) {
      smoke.current.position.y = (t * 0.4) % 1
      smoke.current.rotation.y = Math.sin(t * 0.3) * 0.2
    }
  })
  return (
    <>
      <Blocks at={embers} material={fire.ember} />
      <group ref={smoke}>
        <Blocks at={puffs} material={fire.smoke} />
      </group>
    </>
  )
}

/**
 * The music of the place: its lights beat with it (each material's glow, `base` plus a pulse on the beat),
 * and at night, with the Sim near, its bass is heard through the walls (ambience.thump).
 */
export function Beat({ mats, night, bpm = 118, base = 0.6, amp = 0.9, reach = 90 }: { mats: THREE.MeshLambertMaterial[]; night: boolean; bpm?: number; base?: number; amp?: number; reach?: number }) {
  const g = useRef<THREE.Group>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  const last = useRef(-1)
  useFrame(() => {
    const beats = (worldTime() * bpm) / 60
    const pulse = night ? Math.exp(-(beats % 1) * 5) : 0
    for (const m of mats) m.emissiveIntensity = night ? base + pulse * amp : 0.15
    const b = Math.floor(beats)
    if (!night || b === last.current || !g.current) return
    last.current = b
    g.current.getWorldPosition(v)
    const d = Math.hypot(v.x - whereabouts.sim[0], v.z - whereabouts.sim[1])
    if (d < reach) ambience.thump((1 - d / reach) * 0.7, 45 + (b % 4 === 3 ? 12 : 0))
  })
  return <group ref={g} />
}

/** Beams of light turning over a club's roof at night (a group turned, one draw). */
export function Beams({ colour, at, night }: { colour: string; at: [number, number, number]; night: boolean }) {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }), [colour])
  const beams = useMemo<At[]>(() => [0, 1, 2, 3].map((i) => ({ p: [Math.cos((i * Math.PI) / 2) * 9, 14, Math.sin((i * Math.PI) / 2) * 9], s: [0.6, 30, 0.6], ry: 0 })), [])
  useFrame(() => {
    if (!g.current) return
    const t = worldTime()
    g.current.rotation.y = t * 0.6
    g.current.rotation.z = Math.sin(t * 0.8) * 0.35
  })
  if (!night) return null
  return (
    <group position={at}>
      <group ref={g}>
        {beams.map((b, i) => (
          <mesh key={i} geometry={BOX} material={mat} position={b.p} scale={b.s} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.5]} />
        ))}
      </group>
    </group>
  )
}

/* ---------- A maquis ---------- */

/** Where a maquis' grill stands (x, z, turn): its fire. */
const MAQUIS_GRILL: [number, number, number][] = [[-6.2, 5.6, 0]]
const MAQUIS_TUBES: At[] = [[-4, -1.3], [0, -1.3], [4, -1.3]].map(([x, z]): At => ({ p: [x, 2.7, z], s: [1.4, 0.08, 0.12] })).concat([{ p: [-6.2, 2.5, 5.6], s: [0.12, 0.08, 1.2] }])

export type MaquisSpec = {
  name: string
  sign: [string, string]
  /** The wall's colour, the roof: tin on posts, or straw (the north, the sea). */
  wall: string
  roof: 'tin' | 'straw'
  food: 'fish' | 'meat' | 'alloco'
  /** The plastic's colour of the chairs. */
  plastic: string[]
  seed: number
  /** Its own touches (the canaris, the balafon, the fish basins…), in the maquis' frame. */
  extra?: Part[]
  /** People of its own (the balafon player, the tô seller…). */
  more?: Who[]
}

/**
 * A maquis, in its frame (+z the street): the little building at the back (the bar, the kitchen, the
 * painted name), the terrace under its tin or straw roof, the tables out in the yard under the strings
 * of bulbs, the grill at the street's corner with its griller and its smoke, the crates and the freezer,
 * the speakers; people eating and drinking. Some 16 by 14 m.
 */
export function Maquis({ spec, night }: { spec: MaquisSpec; night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(spec.name, spec.sign[0], spec.sign[1], night, 0.9)
  const fire = useFire()
  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2b2118', emissive: '#ffb347', emissiveIntensity: 0 }), [])
  lamp.emissiveIntensity = night ? 0.7 : 0
  const tube = useMemo(() => new THREE.MeshLambertMaterial({ color: '#d8dde2', emissive: '#eef6ff', emissiveIntensity: 0 }), [])
  tube.emissiveIntensity = night ? 1.3 : 0
  const b = useMemo(() => {
    const r = seeded(spec.seed)
    const out: At[] = []
    const bulbs: At[] = []
    // The building at the back: its walls, a band of plaster, the tin roof, the open bar.
    put(out, [0, -5.5, 0], [[0, 2.5, 0, 12, 5, 3, spec.wall], [0, 0.35, 1.52, 12, 0.7, 0.04, '#f1ece2'], [0, 5.15, 0, 12.6, 0.3, 3.6, '#9c968c'], [-2, 1.1, 1.52, 3.6, 0.2, 0.3, '#6b4a2a'], [3.5, 1.1, 1.53, 1, 2.2, 0.04, '#3a2a1a']])
    // The terrace's roof on its posts.
    const roof: Part[] = spec.roof === 'tin' ? [[0, 2.9, 0, 12.4, 0.12, 5.4, '#a9b0b6']] : [[0, 2.8, 0, 12.4, 0.3, 5.6, '#c9a25a'], [0, 3.15, 0, 10.4, 0.3, 4, '#b88f48'], [0, 3.45, 0, 8, 0.3, 2.4, '#c9a25a']]
    put(out, [0, -1.3, 0], [...[-6, -2, 2, 6].flatMap((x): Part[] => [[x, 1.4, 2.6, 0.18, 2.8, 0.18, '#6b4a2a'], [x, 1.4, -2.6, 0.18, 2.8, 0.18, '#6b4a2a']]), ...roof])
    // The tables: under the roof and out in the yard.
    const tables: [number, number][] = [[-4, -1.6], [0, -1.6], [4, -1.6], [-5, 2.6], [-1.5, 3.2], [2.2, 2.6], [5.4, 3.6]]
    tables.forEach(([x, z], i) => put(out, [x, z, (r() - 0.5) * 0.4], plasticSet(spec.plastic[i % spec.plastic.length])))
    // The grill at the street's corner, the griller's table of meat or fish, the bar's corner.
    put(out, [-6.2, 5.6, 0], grillParts(spec.food))
    put(out, [-4.4, 5.6, 0], [[0, 0.4, 0, 1.2, 0.8, 0.7, '#8a6a3c'], [0, 0.84, 0, 1, 0.08, 0.5, spec.food === 'fish' ? '#c9d6e0' : '#a33a2a']])
    put(out, [5, -3.6, Math.PI], barCorner())
    // The poles of the yard's bulbs, the speakers on their stand.
    for (const [x, z] of [[-7, 5.8], [7, 5.8], [-7, 0.8], [7, 0.8]]) out.push({ p: [x, 1.6, z], s: [0.14, 3.2, 0.14], c: '#6b4a2a' })
    put(out, [6.6, 4.4, -0.6], [[0, 0.6, 0, 0.8, 1.2, 0.7, '#1c1c1e'], [0, 1.6, 0, 0.7, 0.8, 0.6, '#1c1c1e'], [0, 0.6, 0.36, 0.5, 0.5, 0.02, '#4a4a4f']])
    // The low wall round the yard, open to the street in the middle.
    for (const s of [-1, 1]) out.push({ p: [s * 5.2, 0.4, 6.8], s: [3.6, 0.8, 0.2], c: '#e9e2cf' })
    if (spec.extra) put(out, [0, 0, 0], spec.extra)
    const cables: At[] = []
    stringLights(bulbs, cables, [-7, 3.1, 5.8], [7, 3.1, 5.8], 12, spec.seed)
    stringLights(bulbs, cables, [-7, 3.1, 0.8], [7, 3.1, 0.8], 12, spec.seed + 3)
    stringLights(bulbs, cables, [-7, 3.1, 0.8], [-7, 3.1, 5.8], 5, spec.seed + 5)
    stringLights(bulbs, cables, [7, 3.1, 0.8], [7, 3.1, 5.8], 5, spec.seed + 1)
    out.push(...cables)
    // Who sits where: a seat or two at most tables.
    const seats = tables.flatMap(([x, z], i) => seatsAround(x, z).filter((_, k) => (i + k) % 3 !== 0).slice(0, 1))
    return { out, bulbs, seats }
  }, [spec])
  const people = usePeople(`maquis-${spec.name}`, [
    { p: [-6.2, 0, 4.7], ry: 0, pose: 'cook', gender: spec.food === 'meat' ? 'homme' : 'femme', dress: spec.food === 'meat' ? undefined : { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [2, 0, 0.6], ry: 2.4, pose: 'serve', gender: 'femme' },
    ...b.seats.slice(0, 6).map(([x, z, ry], i): Who => ({ p: [x, 0, z], ry, pose: (['eat', 'drink', 'sit', 'eat', 'sitlaugh'] as Pose[])[i % 5] })),
    ...(spec.more ?? []),
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Bulbs at={b.bulbs} night={night} />
      {/* The neon tubes under the terrace's roof, over the grill */}
      <Blocks at={MAQUIS_TUBES} material={tube} />
      {/* The bar inside, warm at night */}
      <mesh position={[0, 1.4, -3.98]} material={lamp}>
        <planeGeometry args={[10, 2.2]} />
      </mesh>
      <Sign s={sign} w={Math.min(10, 1.1 * sign.aspect)} p={[0, 4.25, -3.95]} />
      <Fire fire={fire} at={MAQUIS_GRILL} seed={spec.seed} />
      <People list={people} />
    </group>
  )
}

/* ---------- A club ---------- */

export type ClubSpec = {
  name: string
  neon: string
  neon2: string
  wall: string
  seed: number
  /** The front's own figure (a caiman, a totem, a balafon, containers…), in the club's frame (front at z 6). */
  motif?: Part[]
  bpm?: number
}

/**
 * A club, in its frame (+z the street): a dark box some 16 m by 12, its name in neon over the door, lines
 * of neon along the front and round the roof beating with the music, the double door under its canopy, the
 * red carpet and the rope, the bouncer; the queue at night, the motos and a car outside; beams turning
 * over the roof. By day it's shut, its shutters down.
 */
export function Club({ spec, night }: { spec: ClubSpec; night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(spec.name, '#0b0b14', spec.neon, night, 1.2)
  const glow = useMemo(() => [new THREE.MeshLambertMaterial({ color: spec.neon, emissive: spec.neon, emissiveIntensity: 0.15 }), new THREE.MeshLambertMaterial({ color: spec.neon2, emissive: spec.neon2, emissiveIntensity: 0.15 })], [spec.neon, spec.neon2])
  const at = useMemo(() => {
    const out: At[] = []
    // The box, its roof edge, the door, the canopy, the carpet and the rope.
    put(out, [0, -1, 0], [[0, 3.5, 0, 16, 7, 12, spec.wall], [0, 7.2, 0, 16.4, 0.4, 12.4, '#2a2a33'], [0, 1.4, 6.02, 2.8, 2.8, 0.06, '#121218'], [0, 2.95, 6.05, 3.2, 0.25, 0.14, '#d4a017'], [0, 3.2, 7.4, 4.4, 0.16, 2.8, '#121218']])
    put(out, [0, 0, 0], [[0, 0.06, 7.8, 1.8, 0.04, 4, '#b3122e'], [-1.4, 0.5, 6.6, 0.1, 1, 0.1, '#d4a017'], [-1.4, 0.5, 8.8, 0.1, 1, 0.1, '#d4a017'], [1.4, 0.5, 6.6, 0.1, 1, 0.1, '#d4a017'], [1.4, 0.5, 8.8, 0.1, 1, 0.1, '#d4a017'], [-1.4, 0.85, 7.7, 0.06, 0.06, 2.2, '#b3122e'], [1.4, 0.85, 7.7, 0.06, 0.06, 2.2, '#b3122e']])
    // The air conditioners on the side, the generator at the back: a club never lacks power.
    put(out, [0, 0, 0], [[8.1, 3, 1, 0.3, 0.8, 1, '#e9ecef'], [8.1, 3, -2, 0.3, 0.8, 1, '#e9ecef'], [5, 0.8, -8.5, 3, 1.6, 1.4, '#2f6db3']])
    // Motos parked in a row, a car.
    for (let i = 0; i < 4; i++) put(out, [-7 + i * 1.1, 9.5, 0.2], [[0, 0.5, 0, 0.25, 0.4, 1.7, ['#c92a2a', '#1c1c1e', '#1971c2', '#f4f1e6'][i]], [0, 0.3, 0.75, 0.1, 0.6, 0.1, '#1c1c1e'], [0, 0.3, -0.75, 0.1, 0.6, 0.1, '#1c1c1e'], [0, 0.85, 0.5, 0.6, 0.06, 0.06, '#8a8a8a']])
    put(out, [6, 10, Math.PI / 2], [[0, 0.75, 0, 4.4, 0.9, 1.8, '#f4f1e6'], [0, 1.45, -0.2, 2.4, 0.6, 1.6, '#2b3a4a'], [-1.4, 0.35, 0.9, 0.7, 0.7, 0.2, '#1c1c1e'], [1.4, 0.35, 0.9, 0.7, 0.7, 0.2, '#1c1c1e'], [-1.4, 0.35, -0.9, 0.7, 0.7, 0.2, '#1c1c1e'], [1.4, 0.35, -0.9, 0.7, 0.7, 0.2, '#1c1c1e']])
    if (spec.motif) put(out, [0, 0, 0], spec.motif)
    return out
  }, [spec])
  // The neon: two lines along the front, one round the roof; the pillars of light by the door.
  const neon = useMemo(() => {
    const a: At[] = [{ p: [0, 2.2, 5.07], s: [15.6, 0.14, 0.1] }, { p: [0, 5.9, 5.07], s: [15.6, 0.14, 0.1] }, { p: [-1.75, 1.4, 5.1], s: [0.14, 2.8, 0.1] }, { p: [1.75, 1.4, 5.1], s: [0.14, 2.8, 0.1] }]
    const b: At[] = [{ p: [0, 6.6, 5.24], s: [16.4, 0.14, 0.1] }, { p: [0, 6.6, -7.24], s: [16.4, 0.14, 0.1] }, { p: [8.24, 6.6, -1], s: [0.1, 0.14, 12.4] }, { p: [-8.24, 6.6, -1], s: [0.1, 0.14, 12.4] }, { p: [0, 0.03, 9.9], s: [1.8, 0.04, 0.12] }]
    return { a, b }
  }, [])
  const crowd = usePeople(`club-${spec.name}`, [
    { p: [2.4, 0, 6.8], ry: -0.6, pose: 'idle', gender: 'homme', dress: { outfit: 'suit', outfitColor: '#111111' } },
    { p: [-2.6, 0, 9.4], ry: 0.3, pose: 'phone' },
    { p: [-3.2, 0, 10.4], ry: 0.2, pose: 'talk', gender: 'femme' },
    { p: [-3.9, 0, 11.3], ry: 0.4, pose: 'dance', gender: 'femme' },
    { p: [-2.8, 0, 12], ry: 2.6, pose: 'laugh' },
    { p: [3.8, 0, 12.4], ry: -2.5, pose: 'dance' },
    { p: [4.6, 0, 11.6], ry: -2.2, pose: 'zouglou' },
  ])
  const day = usePeople(`club-jour-${spec.name}`, [{ p: [2.4, 0, 7.2], ry: -0.6, pose: 'phone', gender: 'homme' }])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={neon.a} material={glow[0]} />
      <Blocks at={neon.b} material={glow[1]} />
      <Beat mats={glow} night={night} bpm={spec.bpm} />
      <Sign s={sign} w={Math.min(13, 1.5 * sign.aspect)} p={[0, 4.1, 5.09]} />
      <Beams colour={spec.neon} at={[0, 6.4, -1]} night={night} />
      <People list={night ? crowd : day} />
    </group>
  )
}

/* ---------- A market ---------- */

export type MarketSpec = {
  /** The name over its gate. */
  gate: string
  sign: [string, string]
  seed: number
  /** Its half-width (x) and half-depth (z), metres. */
  w: number
  d: number
  /** The colours of what's sold on the tables (yams, tomatoes, onions, pagnes, cashews…). */
  goods: string[]
  /** What hangs on the lines to sell: woven pagnes, or painted toiles. */
  hangings: Part[][]
  /** Its covered hall in the middle: steel columns under two roofs, the higher one over the middle. */
  hall?: { w: number; d: number; h: number; roof: string }
  /** Its gate's colour (whitewashed, or the earth of the north), and cones on its pillars. */
  gateColour?: string
  cones?: boolean
  extra?: Part[]
}

/** One stall: its four posts, its sheet roof (rusty or new), its table and what's on it. */
function stall(r: () => number, goods: string[]): { frame: Part[]; wares: Part[] } {
  const roof = ['#8f979e', '#a0522d', '#9aa3aa', '#7a5a3a', '#2f6db3'][Math.floor(r() * 5)]
  const frame: Part[] = [[-1.4, 1.2, -1.2, 0.1, 2.4, 0.1, '#6b4a2a'], [1.4, 1.2, -1.2, 0.1, 2.4, 0.1, '#6b4a2a'], [-1.4, 1.1, 1.2, 0.1, 2.2, 0.1, '#6b4a2a'], [1.4, 1.1, 1.2, 0.1, 2.2, 0.1, '#6b4a2a'], [0, 2.35, 0, 3.2, 0.08, 2.9, roof, (r() - 0.5) * 0.1], [0, 0.8, 0.4, 2.6, 0.08, 1.2, '#8a6a3c'], [0, 0.4, 0.4, 2.4, 0.8, 0.06, '#7a5a32']]
  const wares: Part[] = []
  const c = goods[Math.floor(r() * goods.length)]
  const c2 = goods[Math.floor(r() * goods.length)]
  for (let k = 0; k < 5; k++) wares.push([-1 + k * 0.5, 0.95, 0.4 + (k % 2) * 0.2, 0.36, 0.22 + r() * 0.12, 0.36, k % 2 ? c : c2])
  if (r() < 0.5) wares.push([1.0, 0.25, -0.6, 0.7, 0.5, 0.7, '#e9ecef'], [1.0, 0.52, -0.6, 0.6, 0.08, 0.6, c])
  return { frame, wares }
}

/**
 * A market, in its frame (+z the street): its gate and its name on the street, its alleys of stalls under
 * their sheet roofs, the parasols, the lines of cloth hung to sell, its covered hall in the middle; the
 * sellers at their tables, the buyers, the porters, the women with their basins.
 */
export function Market({ spec, night }: { spec: MarketSpec; night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(spec.gate, spec.sign[0], spec.sign[1], night, 0.7)
  const ground = useMemo(() => new THREE.MeshLambertMaterial({ color: '#b48a5e', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [])
  const b = useMemo(() => {
    const r = seeded(spec.seed)
    const frame: At[] = []
    const wares: At[] = []
    const { w, d } = spec
    // The gate: two pillars, the lintel with the name.
    const gc = spec.gateColour ?? '#f1ece2'
    put(frame, [0, d - 1, 0], [[-6, 3, 0, 1.2, 6, 1.2, gc], [6, 3, 0, 1.2, 6, 1.2, gc], [0, 6.4, 0, 13.6, 1.6, 1.4, gc], ...(spec.cones ? [-6, 6].flatMap((x): Part[] => [[x, 7.7, 0, 0.9, 1, 0.9, gc], [x, 8.5, 0, 0.45, 0.7, 0.45, gc]]) : []), [-6, 0.4, 0.62, 1.2, 0.8, 0.04, '#f77f00'], [6, 0.4, 0.62, 1.2, 0.8, 0.04, '#009e60']])
    // The hall: its steel columns, the lower roof and the raised one over the middle (the light and the air come in between).
    const h = spec.hall
    if (h) {
      for (let x = -h.w / 2; x <= h.w / 2 + 0.1; x += 6) for (const z of [-h.d / 2, h.d / 2]) frame.push({ p: [x, h.h / 2, z], s: [0.4, h.h, 0.4], c: '#7b8794' })
      for (let x = -h.w / 2 + 6; x < h.w / 2; x += 6) frame.push({ p: [x, (h.h + 2.2) / 2, 0], s: [0.4, h.h + 2.2, 0.4], c: '#7b8794' })
      for (const s of [-1, 1]) frame.push({ p: [0, h.h + 0.4, (s * h.d) / 4], s: [h.w + 3, 0.25, h.d / 2 + 2], c: h.roof })
      frame.push({ p: [0, h.h + 2.6, 0], s: [h.w + 2, 0.25, h.d / 3], c: h.roof }, { p: [0, h.h + 1.6, -h.d / 6], s: [h.w, 1.8, 0.06], c: '#c9d6e0' }, { p: [0, h.h + 1.6, h.d / 6], s: [h.w, 1.8, 0.06], c: '#c9d6e0' })
      // The tables in rows under it.
      for (let x = -h.w / 2 + 3; x < h.w / 2 - 1; x += 4.5)
        for (const z of [-h.d / 4, h.d / 4]) {
          frame.push({ p: [x, 0.8, z], s: [3.4, 0.08, 1.6], c: '#8a6a3c' }, { p: [x, 0.4, z], s: [3.2, 0.8, 0.06], c: '#7a5a32' })
          for (let k = 0; k < 4; k++) wares.push({ p: [x - 1.2 + k * 0.8, 0.98, z + (k % 2 ? 0.3 : -0.3)], s: [0.5, 0.3, 0.5], c: spec.goods[Math.floor(r() * spec.goods.length)] })
        }
    }
    // The stalls in alleys round it, either side and behind; an alley from the gate to the hall.
    const hw = h ? h.w / 2 + 4 : 4
    const hd = h ? h.d / 2 + 4 : 4
    for (let x = -w + 2.5; x <= w - 2.5; x += 3.4)
      for (let z = -d + 2.5; z <= d - 6; z += 8) {
        if (Math.abs(x) < hw && Math.abs(z) < hd) continue
        if (Math.abs(x) < 3.2) continue
        // (Gaps here and there: the alleys breathe, and fewer blocks to draw.)
        if (r() < 0.3) continue
        const s = stall(r, spec.goods)
        put(frame, [x, z, z > 0 ? 0 : Math.PI], s.frame)
        put(wares, [x, z, z > 0 ? 0 : Math.PI], s.wares)
      }
    // Parasols over the sellers on the ground, the lines of cloth.
    for (let i = 0; i < 6; i++) {
      const [x, z] = [(r() - 0.5) * 2 * (w - 4), d - 4 - r() * 3]
      if (Math.abs(x) < 7) continue
      put(wares, [x, z, r()], [[0, 1.1, 0, 0.08, 2.2, 0.08, '#dddddd'], [0, 2.2, 0, 2.6, 0.08, 2.6, ['#e03131', '#1971c2', '#f08c00', '#2f9e44'][i % 4]], [0, 2.32, 0, 1.6, 0.1, 1.6, '#ffffff'], [0, 0.15, 0.6, 1.2, 0.3, 0.8, spec.goods[i % spec.goods.length]], [0.4, 0.3, -0.4, 0.5, 0.6, 0.5, '#e9ecef']])
    }
    for (const side of [-1, 1]) {
      const x0 = side * (w - 1.5)
      put(frame, [x0, 0, Math.PI / 2], [[-5, 1.2, 0, 0.1, 2.4, 0.1, '#6b4a2a'], [5, 1.2, 0, 0.1, 2.4, 0.1, '#6b4a2a'], [0, 2.3, 0, 10, 0.04, 0.04, '#3a2a1a']])
      spec.hangings.forEach((hang, i) => put(wares, [x0, -4 + i * 1.9, Math.PI / 2 + (side < 0 ? Math.PI : 0)], hang))
    }
    if (spec.extra) put(wares, [0, 0, 0], spec.extra)
    return { frame, wares }
  }, [spec])
  const people = usePeople(`marche-${spec.gate}`, [
    { p: [-4.6, 0, spec.d - 6], ry: 0.4, pose: 'carry', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [1.8, 0, spec.d - 4], ry: Math.PI, pose: 'walk', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#1c7ed6' } },
    { p: [2.4, 0, 2], ry: 2.6, pose: 'talk' },
    { p: [-1.6, 0, -3], ry: 0.2, pose: 'pay', gender: 'femme' },
    { p: [-2, 0, 6], ry: -0.4, pose: 'push', gender: 'homme' },
    { p: [spec.w * 0.5, 0, spec.d - 9], ry: 0, pose: 'busy', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#2f9e44' } },
    { p: [-spec.w * 0.5, 0, spec.d - 9], ry: 0, pose: 'sit', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#f0b429' } },
    { p: [spec.w * 0.3, 0, -6], ry: Math.PI, pose: 'busy', gender: 'homme' },
    { p: [-spec.w * 0.35, 0, -10], ry: 1.2, pose: 'phone' },
    { p: [6, 0, spec.d - 2], ry: 0.8, pose: 'carry', gender: 'homme' },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={ground} receiveShadow>
        <planeGeometry args={[spec.w * 2, spec.d * 2]} />
      </mesh>
      <Blocks at={b.frame} material={mat} color />
      <Near within={170}>
        <Blocks at={b.wares} material={mat} color />
      </Near>
      <Sign s={sign} w={12.6} p={[0, 6.4, spec.d - 0.28]} />
      <People list={people} within={130} />
    </group>
  )
}

/* ---------- A small hotel ---------- */

/**
 * A town's hotel of three floors, in its frame (+z the street): the long block, its balconies and their
 * rails, the lit windows at night, the porch and its name, the terrace in front with its tables under the
 * parasols, the pool at the side, the palms, a taxi at the door (no real brand). Some 30 by 24 m.
 */
export function SmallHotel({ name, sign: colours, wall, accent, seed, night }: { name: string; sign: [string, string]; wall: string; accent: string; seed: number; night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(name, colours[0], colours[1], night, 0.9)
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#3a5a7a', emissive: '#ffd27a', emissiveIntensity: 0 }), [])
  glass.emissiveIntensity = night ? 0.55 : 0
  const pool = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4dabf7', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [])
  const b = useMemo(() => {
    const r = seeded(seed)
    const out: At[] = []
    const win: At[] = []
    // The block, its floors' bands, its flat roof and parapet.
    put(out, [0, -6, 0], [[0, 5.4, 0, 24, 10.8, 8, wall], [0, 10.95, 0, 24.6, 0.3, 8.6, '#8a8f94'], [0, 0.3, 4.05, 24, 0.6, 0.06, accent]])
    for (let f = 0; f < 3; f++) {
      const y = 1.8 + f * 3.4
      // The balconies on the front, their rails, the windows behind (lit at night).
      if (f > 0) out.push({ p: [0, y - 1.3, -1.4], s: [23, 0.16, 1.4], c: '#d8d2c4' }, { p: [0, y - 0.8, -0.72], s: [23, 0.06, 0.06], c: accent })
      for (let k = 0; k < 7; k++) win.push({ p: [-9.6 + k * 3.2, y, -1.98], s: [1.6, 1.6, 0.06] })
    }
    // The porch and its canopy, the door.
    put(out, [0, -1.7, 0], [[0, 3, 0.6, 5, 0.25, 2.4, accent], [-2.3, 1.5, 1.6, 0.2, 3, 0.2, '#e9ecef'], [2.3, 1.5, 1.6, 0.2, 3, 0.2, '#e9ecef'], [0, 1.2, -0.25, 2.2, 2.4, 0.06, '#2b3a4a']])
    // The terrace: tables under parasols in the accent colour, potted plants.
    for (let i = 0; i < 4; i++) {
      const x = -9 + i * 6
      put(out, [x, 5, (r() - 0.5) * 0.4], [[0, 0.75, 0, 1.2, 0.06, 1.2, '#f4f1e6'], [0, 0.38, 0, 0.1, 0.76, 0.1, '#f4f1e6'], [0, 1.25, 0, 0.08, 2.5, 0.08, '#e9ecef'], [0, 2.5, 0, 2.6, 0.16, 2.6, i % 2 ? accent : '#f4f1e6'], [-0.9, 0.24, 0, 0.45, 0.48, 0.45, '#6b4a2a'], [0.9, 0.24, 0, 0.45, 0.48, 0.45, '#6b4a2a']])
    }
    for (const x of [-12, 12]) out.push({ p: [x, 0.4, 7.6], s: [0.8, 0.8, 0.8], c: '#a0522d' }, { p: [x, 1.1, 7.6], s: [1, 0.8, 1], c: '#3c7a36' })
    // The pool at the side, its tiled rim, the loungers; palms.
    out.push({ p: [17, 0.1, 0], s: [9, 0.2, 7], c: '#e9ecef' })
    for (let i = 0; i < 3; i++) out.push({ p: [14 + i * 3, 0.3, 4.6], s: [0.8, 0.2, 1.8], c: '#f4f1e6' })
    for (const [x, z] of [[-14, 8], [14, 8], [21, -4]]) put(out, [x, z, 0], [[0, 3.5, 0, 0.4, 7, 0.4, '#8a7a64'], ...[0, 1, 2, 3, 4].map((k): Part => [Math.cos(k * 1.26) * 1.4, 7, Math.sin(k * 1.26) * 1.4, 3, 0.14, 0.8, '#4e8a3a', -k * 1.26])])
    // A taxi at the door.
    put(out, [-5, 9.5, Math.PI / 2], [[0, 0.75, 0, 4.2, 0.9, 1.8, '#f08c00'], [0, 1.45, -0.2, 2.2, 0.6, 1.6, '#2b3a4a'], [-1.3, 0.35, 0.9, 0.7, 0.7, 0.2, '#1c1c1e'], [1.3, 0.35, 0.9, 0.7, 0.7, 0.2, '#1c1c1e'], [-1.3, 0.35, -0.9, 0.7, 0.7, 0.2, '#1c1c1e'], [1.3, 0.35, -0.9, 0.7, 0.7, 0.2, '#1c1c1e']])
    return { out, win }
  }, [wall, accent, seed])
  const people = usePeople(`hotel-${name}`, [
    { p: [-9.9, 0, 5], ry: Math.PI / 2, pose: 'eat' },
    { p: [-3, 0, 5], ry: 0, pose: 'drink', gender: 'femme' },
    { p: [3.9, 0, 5], ry: -Math.PI / 2, pose: 'sitlaugh' },
    { p: [1.4, 0, 0.2], ry: 0.4, pose: 'serve', gender: 'homme', dress: { outfit: 'suit', outfitColor: '#1c1c1e' } },
    { p: [16, 0.3, 4.6], ry: Math.PI, pose: 'sleep' },
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.win} material={glass} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[17, 0.22, 0]} material={pool}>
        <planeGeometry args={[7.6, 5.6]} />
      </mesh>
      {/* The name along the roof's edge, seen from the street */}
      <Sign s={sign} w={Math.min(14, 1.4 * sign.aspect)} p={[0, 11.9, -1.6]} />
      <People list={people} />
    </group>
  )
}
