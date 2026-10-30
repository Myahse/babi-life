import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { ambience } from '../../audio/ambience'
import { Character } from '../Character'
import { Box } from '../props'
import { rng } from '../themes'
import { Vehicle, type CarModel, type VehicleKind } from '../vehicles'
import { moveObstacle } from '../obstacles'
import { whereabouts } from '../whereabouts'
import type { XZ } from './geo'
import { FOOT, type Nav } from './nav'
import { along, anchorNode, routeLength, turnTo, useCellsAround } from './shared'
import { blockedAhead, lightFor, lightsOf, redAhead, report, type Light } from './trafficFlow'
import { pavementLine, roadwayAt, routeFor, useRoutes } from './ways'
import type { Taken } from './streetlife'
import { t as tr } from '../../lib/i18n'

// The living city (the update « ville-vivante »): little scenes the street plays by itself near the
// Sim, now and then, to watch in passing (nothing to do). Joggers at dawn and dusk, the police after a
// speeding car (siren, the lights flashing) or after a thief on foot, the tantie and her basin, the
// pousse-pousse, children chasing their ball, schoolchildren in line, the Sunday choir, a wedding
// cortège honking, a moto on its back wheel, the family of four on one moto, the car broken down and
// pushed, the old men at the draughts board under the tree, the alloco fried at the roadside, the
// cireur, the tailor, the barber under his parasol… Picked by the street's rng on the shared clock
// (the same scene at the same time on every screen in a commune: placed round each Sim), by the hour,
// the rain, the power cut. A few at a time (SLOTS), each placed 20 to 100 m off (never on the Sim),
// gone once played or once the Sim is far. The vehicles keep to their lane and stop at the red lights
// and behind the traffic (but a chase, an escort); the people keep to the pavements, across on the zebras.

/** How many scenes at once round the Sim, and how often each slot plays a new one (real seconds). */
const SLOTS = 3
const WINDOW = 40
/** The share of windows with a scene in them. */
const CHANCE = 0.9
/** Past this from the Sim, a scene is dropped. */
const DROP = 180
/** The lights' cells (as RoadTraffic: the same lights). */
const CAR_CELL = 300

type Ctx = { hour: number; night: boolean; rain: boolean; cut: boolean; sunday: boolean; weekend: boolean }
type Place = 'walk' | 'road' | 'spot' | 'light'
type Def = { place: Place; dur: number; weight: (c: Ctx) => number; speed?: number }
const at = (c: Ctx, a: number, b: number) => c.hour >= a && c.hour < b
const dry = (c: Ctx) => !c.rain

/** Every scene: where it plays, how long, how likely at this time (0: not now). */
const DEFS = {
  // On foot, along the pavement
  joggeurs: { place: 'walk', dur: 34, speed: 2.9, weight: (c) => (!dry(c) ? 0 : at(c, 5, 9) || at(c, 17, 20) ? 6 : at(c, 9, 17) ? 1 : 0) },
  'poursuite-pied': { place: 'walk', dur: 26, speed: 5.6, weight: (c) => (at(c, 7, 23) ? 3 : 1) },
  bassine: { place: 'walk', dur: 38, speed: 1, weight: (c) => (dry(c) && at(c, 6, 18) ? 3 : 0) },
  'pousse-pousse': { place: 'walk', dur: 38, speed: 1, weight: (c) => (dry(c) && at(c, 7, 19) ? 3 : 0) },
  ballon: { place: 'walk', dur: 30, speed: 2.4, weight: (c) => (dry(c) && at(c, 9, 19) ? 3 : 0) },
  ecoliers: { place: 'walk', dur: 38, speed: 1.1, weight: (c) => (!c.weekend && (at(c, 6, 8) || at(c, 12, 13) || at(c, 16, 18)) ? 6 : 0) },
  chorale: { place: 'walk', dur: 38, speed: 0.9, weight: (c) => (c.sunday && dry(c) && at(c, 7, 12) ? 8 : 0) },
  procession: { place: 'walk', dur: 38, speed: 0.8, weight: (c) => (dry(c) && at(c, 15, 22) ? (c.weekend ? 3 : 1) : 0) },
  supporters: { place: 'walk', dur: 32, speed: 1.4, weight: (c) => (at(c, 16, 24) ? 2 : 0) },
  cabris: { place: 'walk', dur: 28, speed: 1.7, weight: (c) => (dry(c) && at(c, 7, 18) ? 2 : 0) },
  pickpocket: { place: 'walk', dur: 30, speed: 5, weight: (c) => (at(c, 8, 22) ? 2 : 0) },
  'pluie-course': { place: 'walk', dur: 24, speed: 3.6, weight: (c) => (c.rain ? 8 : 0) },
  // On the road
  'course-poursuite': { place: 'road', dur: 26, speed: 15, weight: () => 4 },
  mariage: { place: 'road', dur: 38, speed: 5, weight: (c) => (dry(c) && at(c, 10, 19) ? (c.weekend ? 5 : 1) : 0) },
  cabre: { place: 'road', dur: 26, speed: 9, weight: (c) => (dry(c) && at(c, 10, 23) ? 2 : 0) },
  livraison: { place: 'road', dur: 30, speed: 7, weight: (c) => (at(c, 8, 20) ? 2 : 0) },
  'famille-moto': { place: 'road', dur: 30, speed: 7, weight: (c) => (dry(c) && at(c, 7, 20) ? 2 : 0) },
  escorte: { place: 'road', dur: 26, speed: 10, weight: (c) => (!c.weekend && at(c, 8, 19) ? 2 : 0) },
  gbaka: { place: 'road', dur: 34, speed: 5, weight: (c) => (at(c, 6, 21) ? 3 : 0) },
  panne: { place: 'road', dur: 38, speed: 1.1, weight: (c) => (at(c, 7, 21) ? 2 : 0) },
  // At a spot on the pavement
  alloco: { place: 'spot', dur: 38, weight: (c) => (at(c, 11, 14) || at(c, 16, 22) ? 3 : 0) },
  cireur: { place: 'spot', dur: 34, weight: (c) => (dry(c) && at(c, 7, 18) ? 2 : 0) },
  tailleur: { place: 'spot', dur: 38, weight: (c) => (at(c, 8, 19) ? 2 : 0) },
  mecano: { place: 'spot', dur: 38, weight: (c) => (dry(c) && at(c, 8, 18) ? 2 : 0) },
  balayeuse: { place: 'spot', dur: 30, weight: (c) => (dry(c) && at(c, 6, 9) ? 5 : 0) },
  coiffeur: { place: 'spot', dur: 38, weight: (c) => (at(c, 9, 19) ? 2 : 0) },
  dames: { place: 'spot', dur: 38, weight: (c) => (dry(c) && at(c, 9, 19) ? 3 : 0) },
  salut: { place: 'spot', dur: 20, weight: (c) => (at(c, 7, 22) ? 2 : 0) },
  dispute: { place: 'spot', dur: 28, weight: (c) => (at(c, 10, 23) ? 2 : 0) },
  telephone: { place: 'spot', dur: 24, weight: (c) => (at(c, 7, 23) ? 2 : 0) },
  danse: { place: 'spot', dur: 32, weight: (c) => (dry(c) && at(c, 10, 19) ? 2 : 0) },
  mamie: { place: 'spot', dur: 38, weight: (c) => (dry(c) && at(c, 9, 18) ? 2 : 0) },
  bougies: { place: 'spot', dur: 38, weight: (c) => (c.cut && c.night ? 10 : 0) },
  'taxi-prix': { place: 'spot', dur: 26, weight: (c) => (at(c, 6, 23) ? 2 : 0) },
  controle: { place: 'spot', dur: 32, weight: (c) => (at(c, 7, 22) ? 2 : 0) },
  // At a red light
  'eau-feu': { place: 'light', dur: 38, weight: (c) => (dry(c) && at(c, 8, 19) ? 4 : 0) },
} satisfies Record<string, Def>
export type SceneKind = keyof typeof DEFS
const KINDS = Object.keys(DEFS) as SceneKind[]

/** Where a scene plays: a way (on foot or on the road), a spot on the pavement facing the road, or a light. */
type Scene = { key: string; kind: SceneKind; start: number; seed: string; way?: XZ[]; spot?: Spot; light?: Light }
/** A spot on the pavement: where, which way it faces the road (local +z), and the kerb beside it (a car pulled over). */
type Spot = { p: XZ; face: number; kerb: XZ; /** The way a car pulled over there faces (along the street, the pavement on its right). */ along: number }

// (Development: the scenes on now, and a kind to force for the next one; for tests in the browser.)
const dev = import.meta.env.DEV ? (globalThis as unknown as { __vv?: Scene[]; __vvForce?: SceneKind | null; __vvWatch?: boolean }) : null
/** (Development: where each scene's front is now, for the camera that watches the scene asked for.) */
const fronts = new Map<string, XZ>()

/** A scene's place: picked by its rng near the Sim, never on top of it. */
function placeOf(nav: Nav, kind: SceneKind, r: () => number, sim: XZ, routes: Map<string, XZ[]>, key: string, lights: Light[], taken: Taken[], close = false): Pick<Scene, 'way' | 'spot' | 'light'> | null {
  const def: Def = DEFS[kind]
  if (def.place === 'light') {
    const near = lights.filter((l) => Math.hypot(l.x - sim[0], l.z - sim[1]) > 18 && Math.hypot(l.x - sim[0], l.z - sim[1]) < 110)
    return near.length ? { light: near[Math.floor(r() * near.length)] } : null
  }
  // (Forced in development: close by, to be seen at once.)
  const [lo, hi] = def.place === 'spot' ? (close ? [10, 45] : [16, 60]) : def.place === 'road' ? (close ? [15, 70] : [40, 110]) : close ? [8, 34] : [22, 80]
  const minW = def.place === 'walk' ? 4.5 : def.place === 'road' ? 7 : 6
  // A point along each street (not at its ends: off the crossroads), within reach of the Sim.
  const found: { e: number; at: XZ }[] = []
  for (let i = 0; i < nav.edges.length; i++) {
    const e = nav.edges[i]
    if (e.walled || e.width < minW || (def.place !== 'road' && e.fast) || (def.place === 'spot' && e.len < 22)) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const k = 0.25 + ((i * 0.618) % 1) * 0.5
    const q: XZ = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
    const d = Math.hypot(q[0] - sim[0], q[1] - sim[1])
    if (d >= lo && d <= hi) found.push({ e: i, at: q })
  }
  for (let tries = 0; tries < 6 && found.length; tries++) {
    const pick = found[Math.floor(r() * found.length)]
    const e = nav.edges[pick.e]
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const mid = pick.at
    if (def.place === 'spot') {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const u: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
      const side = r() < 0.5 ? 1 : -1
      const off = e.width >= 6 ? Math.min(7.3, Math.max(4.9, e.width / 2 + 1.5)) : e.width / 2 + 1.5
      const n: XZ = [u[1] * side, -u[0] * side]
      const p: XZ = [mid[0] + n[0] * off, mid[1] + n[1] * off]
      // Not on another street, not on a place's ground, not by the Sim.
      if (roadwayAt(nav, p[0], p[1]) !== null || taken.some((t) => Math.hypot(t.at[0] - p[0], t.at[1] - p[1]) < t.r + 4) || Math.hypot(p[0] - sim[0], p[1] - sim[1]) < (close ? 6 : 12)) continue
      const kerb: XZ = [mid[0] + n[0] * (e.width / 2 - 1.2), mid[1] + n[1] * (e.width / 2 - 1.2)]
      return { spot: { p, face: Math.atan2(-n[0], -n[1]), kerb, along: Math.atan2(u[0], u[1]) + (side > 0 ? Math.PI : 0) } }
    }
    const reach = (def.speed ?? 1) * def.dur + 30
    const anchor = anchorNode(nav, mid, def.place === 'road' ? 7 : FOOT)
    const route = routeFor(routes, nav, `vv${key}`, anchor, 8, def.place === 'road' ? 7 : FOOT, reach)
    const way = def.place === 'walk' ? pavementLine(nav, route, r() < 0.5 ? 1 : -1) : route
    if (routeLength(way) > 30) return { way }
  }
  return null
}

export function LivingCity({ nav, focus, seed, hour, night, rain, cut, sunday, weekend, taken = [] }: { nav: Nav; focus: React.RefObject<XZ>; seed: string; hour: number; night: boolean; rain: boolean; /** A power cut on (the « Délestage »). */ cut: boolean; sunday?: boolean; weekend?: boolean; taken?: Taken[] }) {
  const routes = useRoutes(nav)
  const cells = useCellsAround(focus, CAR_CELL)
  const lights = useMemo(() => lightsOf(nav, cells, CAR_CELL), [nav, cells])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [watch, setWatch] = useState(false)
  const kept = useRef(new Map<string, Scene | null>())
  const ctx = useRef<Ctx>({ hour, night, rain, cut, sunday: !!sunday, weekend: !!weekend })
  ctx.current = { hour, night, rain, cut, sunday: !!sunday, weekend: !!weekend }
  const last = useRef(-1)
  const forced = useRef<Scene | null>(null)
  if (dev) Object.assign(dev, { __vvTry: (kind: SceneKind, close = true) => placeOf(nav, kind, Math.random, whereabouts.sim, routes, `try${Math.random()}`, lights, taken, close) })
  useFrame(() => {
    const t = worldTime()
    if (t - last.current < 1) return
    last.current = t
    const sim = whereabouts.sim
    const now: Scene[] = []
    const keys = new Set<string>()
    // (Development: a scene asked for, played at once close by.)
    if (dev?.__vvForce) {
      const kind = dev.__vvForce
      dev.__vvForce = null
      const key = `${seed}|f|${Math.floor(t)}`
      const place = placeOf(nav, kind, rng(key), sim, routes, key, lights, taken, true)
      forced.current = place ? { key, kind, start: t, seed: key, ...place } : null
    }
    if (forced.current && t < forced.current.start + DEFS[forced.current.kind].dur) now.push(forced.current)
    for (let k = 0; k < SLOTS; k++) {
      const shift = (k * WINDOW) / SLOTS
      const w = Math.floor((t + shift) / WINDOW)
      const key = `${seed}|${k}|${w}`
      keys.add(key)
      let s = kept.current.get(key)
      if (s === undefined) {
        s = null
        const r = rng(`vv|${key}`)
        if (r() < CHANCE) {
          const c = ctx.current
          // Not two of the same at once; one with nowhere to play here (no light near, no wide road), another.
          const on = new Set([...kept.current.values()].map((x) => x?.kind))
          const open = KINDS.map((kind) => [kind, on.has(kind) ? 0 : (DEFS[kind] as Def).weight(c)] as const).filter(([, wgt]) => wgt > 0)
          for (let tries = 0; tries < 3 && !s && open.length; tries++) {
            let n = r() * open.reduce((a, [, wgt]) => a + wgt, 0)
            const i = open.findIndex(([, wgt]) => (n -= wgt) < 0)
            const kind = open[Math.max(0, i)][0]
            open.splice(Math.max(0, i), 1)
            const place = placeOf(nav, kind, r, sim, routes, key, lights, taken)
            // (Placed a little late, the scene starts where the clock has it: joined halfway, as the others see it.)
            if (place) s = { key, kind, start: w * WINDOW - shift, seed: key, ...place }
          }
        }
        kept.current.set(key, s)
      }
      if (!s) continue
      const where = s.spot?.p ?? (s.light ? ([s.light.x, s.light.z] as XZ) : s.way![0])
      if (t < s.start + DEFS[s.kind].dur && Math.hypot(where[0] - sim[0], where[1] - sim[1]) < DROP) now.push(s)
    }
    for (const k of kept.current.keys()) if (!keys.has(k)) kept.current.delete(k)
    if (dev) dev.__vv = now
    if (dev && !!dev.__vvWatch !== watch) setWatch(!!dev.__vvWatch)
    if (now.length !== scenes.length || now.some((s, i) => s !== scenes[i])) setScenes(now)
  })
  return (
    <NoShadows>
      {scenes.map((s) => (
        <SceneView key={s.key} s={s} nav={nav} lights={lights} />
      ))}
      {watch && forced.current && <WatchCam s={forced.current} />}
    </NoShadows>
  )
}

/** Development only (captures): the camera over the scene asked for, following its front. */
function WatchCam({ s }: { s: Scene }) {
  const { camera } = useThree()
  const at = useRef<XZ | null>(null)
  useFrame(({ gl, scene }) => {
    // (A convoy: between its front and the one behind, to see both.)
    const [a, b] = [fronts.get(s.key), fronts.get(`${s.key}|2`)]
    const p = a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) < 40 ? ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as XZ) : (a ?? s.spot?.p ?? (s.light ? ([s.light.x, s.light.z] as XZ) : null))
    if (p) at.current = at.current ? [at.current[0] + (p[0] - at.current[0]) * 0.5, at.current[1] + (p[1] - at.current[1]) * 0.5] : p
    if (at.current) {
      camera.position.set(at.current[0] + 13, 15, at.current[1] + 13)
      camera.lookAt(at.current[0], 0.8, at.current[1])
    }
    gl.render(scene, camera)
  }, 1)
  return null
}

/* ---------- The cast ---------- */

type Who = { look: Look; gender: 'femme' | 'homme'; kid?: boolean }
function cast(seed: string, n: number, kit: (i: number, r: () => number) => Partial<Look> & { gender?: 'femme' | 'homme'; kid?: boolean } = () => ({})): Who[] {
  return [...Array(n)].map((_, i) => {
    const r = rng(`${seed}|${i}`)
    const k = kit(i, r)
    const gender = k.gender ?? (r() < 0.5 ? 'femme' : 'homme')
    const { gender: _g, kid, ...look } = k
    return { look: { ...randomLook(gender, r), ...look } as Look, gender, kid }
  })
}

/** Someone of the scene where it stands (or a pose that changes with the scene's time). */
function Person({ who, pose, p = [0, 0, 0], r = 0, children }: { who: Who; pose: Pose; p?: [number, number, number]; r?: number; children?: ReactNode }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Character look={who.look} gender={who.gender} stage={who.kid ? 'enfant' : 'adulte'} pose={pose} marker={false} seed={who.look.skin.length} />
      {children}
    </group>
  )
}

/** The scene's own clock (seconds since it started), looked at a few times a second: for poses that change. */
function useSince(start: number) {
  const [s, setS] = useState(() => worldTime() - start)
  useFrame(() => {
    const now = worldTime() - start
    if (Math.floor(now * 4) !== Math.floor(s * 4)) setS(now)
  })
  return s
}

/* ---------- On foot ---------- */

type Walker = { who?: Who; pose: Pose | ((since: number) => Pose); back: number; side?: number; speed?: number; stop?: number; from?: number; body?: ReactNode; carry?: ReactNode }

/** One along the scene's way: `back` metres behind the front, `side` to its right; from `from` seconds; stopping at `stop` metres. */
function Along({ way, start, speed, w, nav, front }: { way: XZ[]; start: number; speed: number; w: Walker; nav: Nav; /** The front one: its scene's key (development: the watching camera). */ front?: string }) {
  const g = useRef<THREE.Group>(null)
  const len = useMemo(() => routeLength(way), [way])
  const [pose, setPose] = useState<Pose>(typeof w.pose === 'function' ? w.pose(0) : w.pose)
  useFrame(() => {
    if (!g.current) return
    const since = worldTime() - start - (w.from ?? 0)
    const d = Math.min(w.stop ?? Infinity, since * (w.speed ?? speed) - w.back)
    g.current.visible = since > 0 && d >= 0 && d <= len
    if (!g.current.visible) return
    const p = along(way, d)
    const o = w.side ?? 0
    const [x, z] = [p.x - Math.cos(p.r) * o, p.z + Math.sin(p.r) * o]
    g.current.position.set(x, nav.heightAt(x, z), z)
    if (dev && front) fronts.set(front, [x, z])
    g.current.rotation.y = turnTo(g.current.rotation.y, p.r, 0.25)
    if (typeof w.pose === 'function') {
      const next = w.pose(since)
      if (next !== pose) setPose(next)
    }
  })
  return (
    <group ref={g} visible={false}>
      {w.who ? <Person who={w.who} pose={pose}>{w.carry}</Person> : w.body}
    </group>
  )
}

function WalkScene({ s, nav, speed, walkers, children }: { s: Scene; nav: Nav; speed: number; walkers: Walker[]; children?: ReactNode }) {
  return (
    <group>
      {walkers.map((w, i) => (
        <Along key={i} way={s.way!} start={s.start} speed={speed} w={w} nav={nav} front={i === 0 ? s.key : i === walkers.length - 1 ? `${s.key}|2` : undefined} />
      ))}
      {children}
    </group>
  )
}

/** A metal basin on the head (oranges, sachets of water, bananas). */
const Basin = ({ goods = '#f08c00', kid }: { goods?: string; kid?: boolean }) => (
  <group position={[0, kid ? 1.32 : 1.86, 0]}>
    <Box p={[0, 0, 0]} s={[0.72, 0.16, 0.72]} c="#c3c9cf" />
    {[-0.18, 0.12].map((x) => [-0.16, 0.16].map((z) => <Box key={`${x}${z}`} p={[x, 0.13, z]} s={[0.2, 0.16, 0.2]} c={goods} />))}
  </group>
)
/** The Ivorian flag on a pole (orange, white, green). */
const Flag = () => (
  <group position={[0.35, 1.2, 0]}>
    <Box p={[0, 0.6, 0]} s={[0.05, 1.6, 0.05]} c="#5c3d24" />
    <Box p={[0, 1.15, -0.22]} s={[0.03, 0.42, 0.2]} c="#f77f00" />
    <Box p={[0, 1.15, -0.42]} s={[0.03, 0.42, 0.2]} c="#f8f9fa" />
    <Box p={[0, 1.15, -0.62]} s={[0.03, 0.42, 0.2]} c="#009e60" />
  </group>
)
/** The pousse-pousse pushed before him: its bed, its two wheels, its load. */
const Cart = () => (
  <group position={[0, 0, 1.25]}>
    <Box p={[0, 0.72, 0.3]} s={[1.1, 0.1, 1.5]} c="#8a5a32" />
    {[-0.6, 0.6].map((x) => <Box key={x} p={[x, 0.35, 0.55]} s={[0.12, 0.7, 0.7]} c="#2b2b2b" />)}
    <Box p={[0, 0.72, -0.55]} s={[1.1, 0.08, 0.08]} c="#5c3d24" />
    {[0, 1, 2, 3, 4, 5].map((i) => <Box key={i} p={[-0.35 + (i % 3) * 0.35, 0.95 + Math.floor(i / 3) * 0.3, 0.1 + (i % 2) * 0.4]} s={[0.3, 0.28, 0.32]} c={['#1c7ed6', '#74c0fc', '#f8f9fa'][i % 3]} />)}
  </group>
)
/** A goat, its legs going (or a hen, small). */
function Beast({ hen, start }: { hen?: boolean; start: number }) {
  const legs = useRef<THREE.Group>(null)
  useFrame(() => {
    if (legs.current) legs.current.position.y = Math.abs(Math.sin((worldTime() - start) * 10)) * 0.06
  })
  if (hen)
    return (
      <group ref={legs}>
        <Box p={[0, 0.22, 0]} s={[0.24, 0.22, 0.34]} c="#f1e3c8" />
        <Box p={[0, 0.38, 0.16]} s={[0.12, 0.14, 0.12]} c="#f1e3c8" />
        <Box p={[0, 0.47, 0.17]} s={[0.04, 0.06, 0.08]} c="#e03131" />
        <Box p={[0, 0.06, 0]} s={[0.04, 0.12, 0.04]} c="#f59f00" />
      </group>
    )
  return (
    <group ref={legs}>
      <Box p={[0, 0.55, 0]} s={[0.34, 0.32, 0.8]} c="#e9e2d0" />
      <Box p={[0, 0.78, 0.45]} s={[0.2, 0.24, 0.26]} c="#d6ccb3" />
      <Box p={[0, 0.94, 0.4]} s={[0.18, 0.08, 0.06]} c="#3a2a1a" />
      {[-0.12, 0.12].flatMap((x) => [-0.3, 0.3].map((z) => <Box key={`${x}${z}`} p={[x, 0.2, z]} s={[0.07, 0.4, 0.07]} c="#6b5a43" />))}
    </group>
  )
}
/** The ball the children run after, bouncing ahead of them. */
function Ball({ start }: { start: number }) {
  const g = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (g.current) g.current.position.y = 0.12 + Math.abs(Math.sin((worldTime() - start) * 5)) * 0.55
  })
  return (
    <mesh ref={g}>
      <icosahedronGeometry args={[0.12, 1]} />
      <meshLambertMaterial color="#f8f9fa" />
    </mesh>
  )
}

/** A beat now and then while the Sim is near (the procession's drum, the cortège's horns, the sirens). */
function useBeat(every: number, near: () => XZ | null, play: (vol: number) => void) {
  const next = useRef(0)
  useFrame(() => {
    const t = worldTime()
    if (t < next.current) return
    next.current = t + every * (0.7 + Math.random() * 0.6)
    const p = near()
    if (p) play(Math.max(0, 1 - Math.hypot(p[0] - whereabouts.sim[0], p[1] - whereabouts.sim[1]) / 110))
  })
}

/* ---------- On the road ---------- */

type Rider = { kind: VehicleKind; color?: string; model?: CarModel; back: number; side?: number; police?: boolean; hazard?: boolean; wheelie?: boolean; crew?: boolean; extra?: ReactNode }

/** Where a convoy's front is: how far along, how fast, which lane (2: its own; -2: overtaking on the other). */
type Drive = { d: number; v: number; side: number; last: number }

/** The roof lights of a police car (or a moto's), flashing red and blue. */
function Gyro({ y = 1.62, moto }: { y?: number; moto?: boolean }) {
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const on = Math.floor(worldTime() * 6) % 2 === 0
    if (a.current) a.current.visible = on
    if (b.current) b.current.visible = !on
  })
  return (
    <group position={[moto ? -0.5 : -0.1, y, 0]}>
      <Box p={[0, 0, 0]} s={[0.3, 0.1, moto ? 0.2 : 1.1]} c="#2b2b2b" />
      <mesh ref={a} position={[0, 0.09, moto ? 0 : 0.3]}>
        <boxGeometry args={[0.28, 0.12, moto ? 0.12 : 0.4]} />
        <meshBasicMaterial color="#ff2a2a" />
      </mesh>
      <mesh ref={b} position={[0, 0.09, moto ? 0 : -0.3]}>
        <boxGeometry args={[0.28, 0.12, moto ? 0.12 : 0.4]} />
        <meshBasicMaterial color="#2a6cff" />
      </mesh>
    </group>
  )
}
/** The hazard lights (the car broken down), blinking orange. */
function Hazard({ len }: { len: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.visible = Math.floor(worldTime() * 2.5) % 2 === 0
  })
  return (
    <group ref={g}>
      {[-1, 1].flatMap((sx) => [-0.7, 0.7].map((z) => <Box key={`${sx}${z}`} p={[(sx * len) / 2, 0.7, z]} s={[0.06, 0.12, 0.2]} c="#ff922b" glow={2} />))}
    </group>
  )
}
const LEN: Record<VehicleKind, number> = { taxi: 4.4, woro: 4.4, car: 4.5, gbaka: 5.3, moto: 1.9, sotra: 11 }

/** One of the convoy: `back` metres behind its front, in its lane; says where it is (the traffic waits behind it, nobody walks through). */
function Ride({ id, way, drive, r, nav }: { id: string; way: XZ[]; drive: React.RefObject<Drive>; r: Rider; nav: Nav }) {
  const g = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const len = useMemo(() => routeLength(way), [way])
  const side = useRef(2)
  useFrame((_, dt) => {
    const D = drive.current
    if (!g.current || !D) return
    const d = D.d - r.back
    g.current.visible = d >= 0 && d <= len
    if (!g.current.visible) return void (report(id, null), moveObstacle(id, null))
    const p0 = along(way, d)
    const [pa, pb] = [along(way, Math.max(0, d - 3)), along(way, Math.min(len, d + 3))]
    const h = Math.hypot(pb.x - pa.x, pb.z - pa.z) > 0.5 ? Math.atan2(pb.x - pa.x, pb.z - pa.z) : p0.r
    side.current += ((r.side ?? D.side) - side.current) * Math.min(1, dt * 2.5)
    const [x, z] = [p0.x - Math.cos(h) * side.current, p0.z + Math.sin(h) * side.current]
    g.current.position.set(x, nav.heightAt(x, z), z)
    if (dev && (r.back === 0 || id.endsWith('1'))) fronts.set(`${id.slice(2, -1)}${r.back === 0 ? '' : '|2'}`, [x, z])
    g.current.rotation.y = turnTo(g.current.rotation.y, h - Math.PI / 2, Math.min(1, dt * 6))
    // The wheelie: up on the back wheel for a few seconds, down, up again.
    if (tilt.current) tilt.current.rotation.z = r.wheelie ? Math.max(0, Math.sin(worldTime() * 0.9)) * 0.42 : 0
    report(id, { x, z, h, half: LEN[r.kind] / 2 })
    moveObstacle(id, { x, z, hw: LEN[r.kind] / 2, hd: r.kind === 'moto' ? 0.35 : 0.9, rot: g.current.rotation.y })
  })
  useEffect(() => () => void (report(id, null), moveObstacle(id, null)), [id])
  const l = LEN[r.kind]
  return (
    <group ref={g} visible={false}>
      <group ref={tilt} position={[-l * 0.35, 0, 0]}>
        <group position={[l * 0.35, 0, 0]}>
          <Vehicle p={[0, 0, 0]} kind={r.kind} color={r.color} model={r.model} seed={id.length} crew={r.crew ?? true} />
          {r.police && <Gyro y={r.kind === 'moto' ? 1.15 : 1.62} moto={r.kind === 'moto'} />}
          {r.police && r.kind !== 'moto' && <Box p={[0, 0.72, 0]} s={[l * 0.98, 0.14, 1.82]} c="#f8f9fa" />}
          {r.hazard && <Hazard len={l} />}
          {r.extra}
        </group>
      </group>
    </group>
  )
}

/** The convoy's front, frame by frame: on its own lane at its pace, stopping at the red lights and behind the traffic; a chase and an escort go through, round the cars on the other lane. */
function RoadScene({ s, nav, lights, speed, riders, rules, siren, horns, children }: { s: Scene; nav: Nav; lights: Light[]; speed: number; riders: Rider[]; rules: boolean; siren?: boolean; horns?: boolean; children?: ReactNode }) {
  const way = s.way!
  const drive = useRef<Drive>({ d: Math.max(0, (worldTime() - s.start) * speed * 0.8), v: speed, side: 2, last: worldTime() })
  const len = useMemo(() => routeLength(way), [way])
  const front = `vv${s.key}0`
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const D = drive.current
    const t = worldTime()
    const p0 = along(way, D.d)
    const p1 = along(way, Math.min(len, D.d + 3))
    const h = Math.atan2(p1.x - p0.x, p1.z - p0.z) || p0.r
    const [x, z] = [p0.x - Math.cos(h) * D.side, p0.z + Math.sin(h) * D.side]
    const half = LEN[riders[0].kind] / 2
    let want = speed
    if (rules) {
      if (redAhead(lights, x, z, h, half, t) || blockedAhead(front, x, z, h, half, 3 + D.v * dt)) want = 0
    } else {
      // Through the traffic: someone in the way, round it on the other lane.
      D.side = blockedAhead(front, x, z, h, half, 10) ? -2 : D.side < 0 && !blockedAhead(front, p0.x - Math.cos(h) * 2, p0.z + Math.sin(h) * 2, h, half, 6) ? 2 : D.side
    }
    D.v += Math.max(-8 * dt, Math.min(2.5 * dt, want - D.v))
    D.v = Math.max(0, D.v)
    D.d += D.v * dt
  })
  const near = () => {
    const d = drive.current.d
    if (d > len + 20) return null
    const p = along(way, Math.min(len, d))
    return [p.x, p.z] as XZ
  }
  useBeat(1, siren ? near : () => null, (v) => ambience.siren(v))
  useBeat(1.4, horns ? near : () => null, (v) => ambience.horn(v))
  return (
    <group>
      {riders.map((r, i) => (
        <Ride key={i} id={`vv${s.key}${i}`} way={way} drive={drive} r={r} nav={nav} />
      ))}
      {children}
    </group>
  )
}

/* ---------- At a spot ---------- */

/** A stool, a bench, a little table (the game's blocks). */
const Stool = ({ p }: { p: [number, number, number] }) => <Box p={[p[0], 0.22, p[2]]} s={[0.42, 0.44, 0.42]} c="#1c7ed6" />
const Bench = ({ p, w = 1.8 }: { p: [number, number, number]; w?: number }) => (
  <group position={p}>
    <Box p={[0, 0.42, 0]} s={[w, 0.08, 0.42]} c="#8a5a32" />
    {[-w / 2 + 0.1, w / 2 - 0.1].map((x) => <Box key={x} p={[x, 0.2, 0]} s={[0.08, 0.4, 0.38]} c="#5c3d24" />)}
  </group>
)
const Table = ({ p, w = 1, c = '#8a5a32' }: { p: [number, number, number]; w?: number; c?: string }) => (
  <group position={p}>
    <Box p={[0, 0.72, 0]} s={[w, 0.06, 0.7]} c={c} />
    {[-w / 2 + 0.06, w / 2 - 0.06].map((x) => <Box key={x} p={[x, 0.36, 0]} s={[0.06, 0.72, 0.6]} c="#5c3d24" />)}
  </group>
)
/** A parasol (a beach umbrella, the barber's, the alloco's). */
const Parasol = ({ p, c = '#f08c00' }: { p: [number, number, number]; c?: string }) => (
  <group position={p}>
    <Box p={[0, 1.15, 0]} s={[0.06, 2.3, 0.06]} c="#dee2e6" />
    <mesh position={[0, 2.35, 0]}>
      <coneGeometry args={[1.5, 0.5, 8]} />
      <meshLambertMaterial color={c} />
    </mesh>
  </group>
)
/** A tree to sit under: its trunk, its crown of leaves. */
const Tree = ({ p }: { p: [number, number, number] }) => (
  <group position={p}>
    <Box p={[0, 2, 0]} s={[0.4, 4, 0.4]} c="#6b4a2a" />
    <Box p={[0, 4.5, -0.3]} s={[3, 1.2, 2.6]} c="#3f8a3a" />
    <Box p={[0.4, 5.2, -0.4]} s={[2, 0.7, 1.8]} c="#4f9e45" />
  </group>
)
/** A flame on a wick: the candles of the power cut. */
function Candle({ p }: { p: [number, number, number] }) {
  const f = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (f.current) f.current.scale.y = 0.8 + Math.sin(worldTime() * 17 + p[0] * 5) * 0.25
  })
  return (
    <group position={p}>
      <Box p={[0, 0.08, 0]} s={[0.06, 0.16, 0.06]} c="#f8f9fa" />
      <mesh ref={f} position={[0, 0.2, 0]}>
        <boxGeometry args={[0.05, 0.09, 0.05]} />
        <meshBasicMaterial color="#ffd43b" />
      </mesh>
      <pointLight position={[0, 0.3, 0]} color="#ffb347" intensity={1.6} distance={4} />
    </group>
  )
}
/** A speech bubble over someone (what's shouted, what's said). */
const Said = ({ text, y = 2.3 }: { text: string; y?: number }) => (
  <Html position={[0, y, 0]} center zIndexRange={[12, 0]}>
    <div className="rounded-2xl rounded-bl-sm border border-black/5 bg-white/95 px-2.5 py-1 text-[12px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)]">{text}</div>
  </Html>
)
/** A small thing waving in a hand (the fan, the rag, the broom): swung back and forth. */
function Swing({ p, s, c, speed = 6, axis = 'x' }: { p: [number, number, number]; s: [number, number, number]; c: string; speed?: number; axis?: 'x' | 'y' | 'z' }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.rotation[axis] = Math.sin(worldTime() * speed) * 0.5
  })
  return (
    <group ref={g} position={p}>
      <Box p={[0, s[1] / 2, 0]} s={s} c={c} />
    </group>
  )
}

/** A car pulled over at the kerb by the spot (the taxi, the car at the mechanic's, the one waved over): parked for the traffic. */
function KerbCar({ id, spot, kind, color, children }: { id: string; spot: Spot; kind: VehicleKind; color?: string; children?: ReactNode }) {
  const [x, z] = spot.kerb
  const rot = spot.along - Math.PI / 2
  useEffect(() => {
    report(id, { x, z, h: spot.along, half: LEN[kind] / 2, wait: 'parked' })
    moveObstacle(id, { x, z, hw: LEN[kind] / 2, hd: 0.9, rot })
    return () => void (report(id, null), moveObstacle(id, null))
  }, [id, x, z, rot, kind, spot.along])
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Vehicle p={[0, 0, 0]} kind={kind} color={color} seed={id.length} crew={false} />
      {children}
    </group>
  )
}

function SpotScene({ s, nav, children, car }: { s: Scene; nav: Nav; children: ReactNode; car?: ReactNode }) {
  const { p, face } = s.spot!
  return (
    <>
      <group position={[p[0], nav.heightAt(p[0], p[1]), p[1]]} rotation={[0, face, 0]}>
        {children}
      </group>
      {car}
    </>
  )
}

/* ---------- The water seller at the red light ---------- */

/** Between the cars stopped at the light, the basin of sachets on the head; back on the kerb before it turns green. */
function WaterAtLight({ s, nav }: { s: Scene; nav: Nav }) {
  const l = s.light!
  const who = useMemo(() => cast(s.seed, 1, () => ({ gender: 'homme', outfit: 'casual', outfitColor: '#2f9e44' }))[0], [s.seed])
  const g = useRef<THREE.Group>(null)
  const pos = useRef({ along: 8, side: l.width / 2 + 1.6 })
  const [pose, setPose] = useState<Pose>('idle')
  const id = `vv${s.key}`
  useFrame((_, dt) => {
    if (!g.current) return
    const t = worldTime()
    // Out on the road only while the light stays red a while; on the kerb otherwise.
    const out = lightFor(l, 0, t) === 'red' && lightFor(l, 0, t + 7) === 'red'
    const goal = out ? { along: 9 + Math.sin(t * 0.25) * 5, side: 0 } : { along: pos.current.along, side: l.width / 2 + 1.6 }
    const [da, ds] = [goal.along - pos.current.along, goal.side - pos.current.side]
    const d = Math.hypot(da, ds)
    const step = Math.min(d, 1.3 * dt)
    if (d > 0.01) ((pos.current.along += (da / d) * step), (pos.current.side += (ds / d) * step))
    const [fx, fz] = [Math.sin(l.axis), Math.cos(l.axis)]
    const a = l.width / 2 + 2 + pos.current.along
    const [x, z] = [l.x - fx * a - fz * pos.current.side, l.z - fz * a + fx * pos.current.side]
    g.current.position.set(x, nav.heightAt(x, z), z)
    if (dev) fronts.set(s.key, [x, z])
    g.current.rotation.y = d > 0.05 ? Math.atan2(da * -fx - ds * fz, da * -fz + ds * fx) : l.axis + Math.PI / 2
    const want: Pose = d > 0.05 ? 'walk' : 'wave'
    if (want !== pose) setPose(want)
    // On the road: the traffic stops for him as for a car.
    report(id, pos.current.side < l.width / 2 ? { x, z, h: l.axis, half: 0.4 } : null)
  })
  useEffect(() => () => void report(id, null), [id])
  return (
    <group ref={g}>
      <Person who={who} pose={pose}>
        <Basin goods="#74c0fc" />
      </Person>
      {pose === 'wave' && <Said text={tr('Eau glacée ! Eau glacée !')} />}
    </group>
  )
}

/* ---------- Each scene ---------- */

const POLICE = { outfit: 'policier', accessory: 'none', hair: 'short', beard: 'none' } as Partial<Look>
const between = (a: Pose, b: Pose, every: number) => (since: number) => (Math.floor(since / every) % 2 ? b : a)

function SceneView({ s, nav, lights }: { s: Scene; nav: Nav; lights: Light[] }) {
  const def: Def = DEFS[s.kind]
  const sp = def.speed ?? 1
  const since = useSince(s.start)
  const c = useMemo(() => {
    switch (s.kind) {
      case 'joggeurs':
        return cast(s.seed, 1 + (s.seed.length % 3), (i) => ({ outfit: i % 2 ? 'survet' : 'jersey', outfitColor: ['#e8590c', '#1c7ed6', '#2f9e44'][i % 3] }))
      case 'poursuite-pied':
        return cast(s.seed, 3, (i) => (i === 0 ? { gender: 'homme', outfit: 'casual', outfitColor: '#2b2b2b', accessory: 'cap' } : { gender: 'homme', ...POLICE }))
      case 'bassine':
        return cast(s.seed, 1, () => ({ gender: 'femme', outfit: 'pagne' }))
      case 'pousse-pousse':
        return cast(s.seed, 1, () => ({ gender: 'homme', outfit: 'casual' }))
      case 'ballon':
        return cast(s.seed, 3, () => ({ kid: true, outfit: 'casual' }))
      case 'ecoliers':
        return cast(s.seed, 6, (i) => (i === 5 ? { gender: 'femme', outfit: 'robe' } : { kid: true, outfit: 'uniforme' }))
      case 'chorale':
        return cast(s.seed, 7, (i) => ({ outfit: i % 2 ? 'boubou' : 'robe', outfitColor: '#f8f9fa', gender: i % 2 ? 'homme' : 'femme' }))
      case 'procession':
        return cast(s.seed, 8, (i) => ({ outfit: i % 3 ? 'pagne' : 'boubou', outfitColor: ['#7a1f2b', '#141416', '#f8f9fa'][i % 3] }))
      case 'supporters':
        return cast(s.seed, 5, () => ({ gender: 'homme', outfit: 'jersey' }))
      case 'cabris':
        return cast(s.seed, 1, () => ({ kid: true, outfit: 'casual' }))
      case 'pickpocket':
        return cast(s.seed, 4, (i) => (i === 0 ? { gender: 'homme', outfit: 'casual', outfitColor: '#343a40', accessory: 'cap' } : {}))
      case 'pluie-course':
        return cast(s.seed, 4)
      case 'famille-moto':
        return cast(s.seed, 3, (i) => (i === 0 ? { gender: 'femme', outfit: 'pagne' } : { kid: true }))
      case 'panne':
        return cast(s.seed, 3, () => ({ gender: 'homme' }))
      case 'alloco':
        return cast(s.seed, 4, (i) => (i === 0 ? { gender: 'femme', outfit: 'pagne' } : {}))
      case 'cireur':
        return cast(s.seed, 2, (i) => (i === 0 ? { gender: 'homme', outfit: 'chemise' } : { gender: 'homme', outfit: 'casual' }))
      case 'tailleur':
        return cast(s.seed, 2, (i) => (i === 0 ? { gender: 'homme', outfit: 'chemise-pagne' } : { gender: 'femme', outfit: 'pagne' }))
      case 'mecano':
        return cast(s.seed, 2, () => ({ gender: 'homme', outfit: 'bleu' }))
      case 'balayeuse':
        return cast(s.seed, 1, () => ({ gender: 'femme', outfit: 'pagne' }))
      case 'coiffeur':
        return cast(s.seed, 3, () => ({ gender: 'homme' }))
      case 'dames':
        return cast(s.seed, 4, (i) => ({ gender: 'homme', outfit: i < 2 ? 'boubou' : 'chemise', ...(i < 2 ? { hairColor: '#d9d9d9' } : {}) }))
      case 'salut':
        return cast(s.seed, 2, () => ({ gender: 'homme' }))
      case 'dispute':
        return cast(s.seed, 2, (i) => ({ gender: i ? 'femme' : 'homme' }))
      case 'telephone':
        return cast(s.seed, 1, () => ({ gender: 'homme', outfit: 'chemise' }))
      case 'danse':
        return cast(s.seed, 3, () => ({ kid: true }))
      case 'mamie':
        return cast(s.seed, 1, () => ({ gender: 'femme', outfit: 'kaba', hairColor: '#d9d9d9' }))
      case 'bougies':
        return cast(s.seed, 4)
      case 'taxi-prix':
        return cast(s.seed, 1, () => ({ gender: 'femme', outfit: 'pagne' }))
      case 'controle':
        return cast(s.seed, 2, (i) => (i === 0 ? { gender: 'homme', ...POLICE } : { gender: 'homme', outfit: 'chemise' }))
      default:
        return []
    }
  }, [s.kind, s.seed])
  const ride = (rs: Rider[], o: { rules?: boolean; siren?: boolean; horns?: boolean } = {}) => <RoadScene s={s} nav={nav} lights={lights} speed={sp} riders={rs} rules={o.rules ?? true} siren={o.siren} horns={o.horns} />
  const walk = (ws: Walker[], children?: ReactNode) => <WalkScene s={s} nav={nav} speed={sp} walkers={ws} children={children} />
  const id = `vv${s.key}`
  switch (s.kind) {
    case 'joggeurs':
      return walk(c.map((who, i) => ({ who, pose: 'run', back: i * 1.6, side: (i % 2) * 0.7 - 0.35 })))
    case 'poursuite-pied':
      // The thief ahead, the two officers after him, losing ground; whistled at.
      return walk([
        { who: c[0], pose: 'run', back: 0 },
        { who: c[1], pose: 'run', back: 7, speed: sp * 0.94, carry: since > 2 && since < 9 ? <Said text="Arrête-toi ! Police !" /> : undefined },
        { who: c[2], pose: 'run', back: 10, speed: sp * 0.9, side: 0.6 },
      ])
    case 'bassine':
      return walk([{ who: c[0], pose: 'walk', back: 0, carry: <Basin /> }])
    case 'pousse-pousse':
      return walk([{ who: c[0], pose: 'push', back: 0, carry: <Cart /> }])
    case 'ballon':
      return walk([{ pose: 'idle', back: -1.8, body: <Ball start={s.start} /> }, ...c.map((who, i): Walker => ({ who, pose: 'run', back: i * 1.1, side: (i - 1) * 0.6 }))])
    case 'ecoliers':
      return walk(c.map((who, i) => ({ who, pose: 'walk', back: i * 1.15, carry: i < 5 ? <Box p={[0, 0.8, -0.18]} s={[0.32, 0.36, 0.14]} c={['#1c7ed6', '#e03131', '#f59f00'][i % 3]} /> : undefined })))
    case 'chorale':
      return walk(c.map((who, i) => ({ who, pose: i === 0 ? 'walk' : between('walk', 'cheer', 3 + (i % 3)), back: Math.floor(i / 2) * 1.3, side: (i % 2) * 0.8 - 0.4, carry: i === 0 ? <Box p={[0.3, 1.5, 0.2]} s={[0.06, 1.2, 0.06]} c="#c9a227" /> : undefined })))
    case 'procession':
      return <Procession s={s} c={c} nav={nav} sp={sp} />
    case 'supporters':
      return walk(c.map((who, i) => ({ who, pose: between('cheer', 'walk', 2 + (i % 2)), back: Math.floor(i / 2) * 1.2, side: (i % 2) * 0.8 - 0.4, carry: i % 2 ? <Flag /> : i === 0 && since < 12 ? <Said text="On a gagné ! Allez les Éléphants !" /> : undefined })))
    case 'cabris':
      return walk([
        { pose: 'idle', back: 0, body: <Beast start={s.start} /> },
        { pose: 'idle', back: 1.2, side: 0.5, body: <Beast start={s.start + 0.3} /> },
        { pose: 'idle', back: 2, side: -0.4, body: <Beast hen start={s.start} /> },
        { pose: 'idle', back: 2.4, side: 0.2, body: <Beast hen start={s.start + 0.2} /> },
        { who: c[0], pose: 'run', back: 4.5, carry: since < 10 ? <Said text="Reviens ici, cabri !" y={1.8} /> : undefined },
      ])
    case 'pickpocket': {
      // He runs with the bag; caught by two passers-by a little further, he begs; the lady catches up, shouting.
      const stop = sp * 9
      return walk([
        { who: c[0], pose: (t) => (t < 9 ? 'run' : 'beg'), back: 0, stop, carry: since > 9 ? <Said text="Pardon, pardon ! C'est pas moi !" /> : undefined },
        { who: c[1], pose: (t) => (t < 9.6 ? 'run' : 'rant'), back: 6, speed: sp * 1.05, stop: stop - 1, side: 0.9 },
        { who: c[2], pose: (t) => (t < 9.6 ? 'run' : 'rant'), back: 8, speed: sp * 1.08, stop: stop + 1.1, side: -0.8 },
        { who: c[3], pose: (t) => (t < 14 ? 'run' : 'rant'), back: 14, speed: sp * 0.7, stop: stop - 1.8, carry: since > 14 ? <Said text="Mon sac ! Voleur !" /> : undefined },
      ])
    }
    case 'pluie-course':
      return walk(c.map((who, i) => ({ who, pose: 'run', back: i * 2.2, side: (i % 2) * 0.7, carry: <Box p={[0, 1.95, 0]} s={[0.6, 0.06, 0.5]} c={['#1c7ed6', '#e03131', '#f8f9fa', '#2f9e44'][i]} /> })))
    case 'course-poursuite':
      // The speeding car, the police car on its heels: through the traffic, round it on the other lane.
      return ride([{ kind: 'car', color: '#c92a2a', model: 'berline', back: 0 }, { kind: 'car', color: '#1f2a44', model: 'saloon', back: 15, police: true }], { rules: false, siren: true })
    case 'mariage':
      return ride(
        [
          { kind: 'car', color: '#f8f9fa', model: 'berline', back: 0, extra: <><Box p={[1.4, 0.95, 0]} s={[1.1, 0.06, 0.3]} c="#ff8fb1" /><Box p={[1.6, 1.05, 0]} s={[0.3, 0.2, 0.3]} c="#f8f9fa" /></> },
          { kind: 'car', color: '#212529', model: 'suv', back: 8, extra: <Box p={[1.8, 1.0, 0.5]} s={[0.02, 0.6, 0.15]} c="#ff8fb1" /> },
          { kind: 'car', color: '#adb5bd', back: 16, extra: <Box p={[1.8, 1.0, 0.5]} s={[0.02, 0.6, 0.15]} c="#f8f9fa" /> },
          { kind: 'gbaka', back: 25 },
        ],
        { horns: true },
      )
    case 'cabre':
      return ride([{ kind: 'moto', back: 0, wheelie: true }])
    case 'livraison':
      return ride([{ kind: 'moto', back: 0, extra: <group position={[-0.75, 0.9, 0]}>{[0, 1, 2, 3, 4].map((k) => <Box key={k} p={[0, k * 0.34, 0]} s={[0.7 - (k % 2) * 0.08, 0.32, 0.9 - (k % 2) * 0.1]} c={['#c9a26b', '#a07a48', '#f8f9fa'][k % 3]} />)}<Box p={[0, 0.8, 0]} s={[0.72, 1.7, 0.04]} c="#2b2b2b" /></group> }])
    case 'famille-moto':
      return ride([
        {
          kind: 'moto',
          back: 0,
          extra: (
            <>
              <group position={[0.35, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
                <Character look={c[1].look} gender={c[1].gender} stage="enfant" pose="sit" marker={false} />
              </group>
              <group position={[-0.5, 0.32, 0]} rotation={[0, Math.PI / 2, 0]}>
                <Character look={c[0].look} gender={c[0].gender} pose="sit" marker={false} />
              </group>
              <group position={[-0.85, 0.34, 0]} rotation={[0, Math.PI / 2, 0]}>
                <Character look={c[2].look} gender={c[2].gender} stage="enfant" pose="sit" marker={false} />
              </group>
            </>
          ),
        },
      ])
    case 'escorte':
      return ride(
        [
          { kind: 'moto', back: 0, side: 1.2, police: true },
          { kind: 'moto', back: 0.5, side: 2.8, police: true },
          { kind: 'car', color: '#0f1115', model: 'suv', back: 9 },
          { kind: 'car', color: '#0f1115', model: 'limo', back: 17 },
          { kind: 'car', color: '#0f1115', model: 'suv', back: 26 },
          { kind: 'car', color: '#1f2a44', back: 34, police: true },
        ],
        { rules: false, siren: true },
      )
    case 'gbaka':
      return ride([{ kind: 'gbaka', back: 0, extra: <group position={[1.0, 1.4, 1.3]}>{Math.floor(since / 5) % 2 === 0 && <Said text={[tr('Adjamé ! Adjamé !'), tr('Yop ! Yop ! Y a place !'), tr('Plateau, deux places !')][s.seed.length % 3]} />}</group> }])
    case 'panne': {
      // The car broken down, its hazards on, pushed along the kerb by three men.
      const pushers = (
        <>
          {[-0.5, 0.4, 0].map((z, i) => (
            <group key={i} position={[-2.75 - (i === 2 ? 0.1 : 0), 0, z * (i === 2 ? 0 : 1) + (i === 2 ? 0.95 : 0)]} rotation={[0, Math.PI / 2, 0]}>
              <Character look={c[i].look} gender={c[i].gender} pose="push" marker={false} />
            </group>
          ))}
        </>
      )
      return ride([{ kind: 'car', color: '#c9b48a', model: 'saloon', back: 0, side: 3.2, hazard: true, crew: false, extra: pushers }])
    }
    case 'alloco':
      return (
        <SpotScene s={s} nav={nav}>
          <Parasol p={[-0.6, 0, -0.9]} c="#e03131" />
          <Table p={[0, 0, -0.2]} w={1.4} />
          <Box p={[-0.3, 0.82, -0.2]} s={[0.6, 0.12, 0.6]} c="#2b2b2b" />
          <Box p={[-0.3, 0.9, -0.2]} s={[0.5, 0.04, 0.5]} c="#f59f00" glow={0.4} />
          <Box p={[0.35, 0.8, -0.2]} s={[0.4, 0.1, 0.35]} c="#ffd43b" />
          <Person who={c[0]} pose="cook" p={[0, 0, -0.9]} />
          {[1, 2, 3].map((i) => <Person key={i} who={c[i]} pose={i === 3 ? 'phone' : 'idle'} p={[0.2 + (i - 1) * 0.9, 0, 0.75]} r={Math.PI + (i === 1 ? 0 : -0.5)} />)}
        </SpotScene>
      )
    case 'cireur':
      return (
        <SpotScene s={s} nav={nav}>
          <Stool p={[0, 0, -0.5]} />
          <Person who={c[0]} pose="sit" p={[0, 0, -0.5]} r={0}>
            {since % 12 < 1.5 && <Said text={tr('Ça brille, hein !')} y={1.9} />}
          </Person>
          <Box p={[0, 0.12, 0.3]} s={[0.5, 0.24, 0.3]} c="#6b4a2a" />
          <group position={[0, 0, 0.7]} rotation={[0, Math.PI, 0]} scale={0.8}>
            <Person who={c[1]} pose="cook" />
          </group>
        </SpotScene>
      )
    case 'tailleur':
      return (
        <SpotScene s={s} nav={nav}>
          <Table p={[0, 0, -0.3]} w={1.2} c="#5c3d24" />
          <Box p={[0, 0.88, -0.35]} s={[0.55, 0.28, 0.24]} c="#212529" />
          <Box p={[0.12, 1.02, -0.35]} s={[0.1, 0.12, 0.22]} c="#c92a2a" />
          <Swing p={[-0.35, 0.78, -0.2]} s={[0.4, 0.02, 0.3]} c="#f08c00" speed={4} axis="z" />
          <Stool p={[0, 0, -1]} />
          <Person who={c[0]} pose="write" p={[0, 0, -1]} />
          <Person who={c[1]} pose={between('talk', 'idle', 4)(since)} p={[0.9, 0, 0.5]} r={Math.PI + 0.5} />
        </SpotScene>
      )
    case 'mecano':
      return (
        <SpotScene
          s={s}
          nav={nav}
          car={
            <KerbCar id={id} spot={s.spot!} kind="car" color="#6c757d">
              {/* The legs out from under it, on the pavement's side */}
              <group position={[0, 0.12, 1.3]} rotation={[-Math.PI / 2, 0, 0]}>
                <Person who={c[0]} pose={between('busy', 'idle', 2)(since)} />
              </group>
            </KerbCar>
          }
        >
          <Box p={[0.5, 0.15, 0.8]} s={[0.5, 0.3, 0.3]} c="#c92a2a" />
          <Person who={c[1]} pose="idle" p={[-0.8, 0, 0.6]} r={Math.PI}>
            {since % 14 < 2 && <Said text={tr('Passe-moi la clé de 12 !')} />}
          </Person>
        </SpotScene>
      )
    case 'balayeuse':
      return (
        <SpotScene s={s} nav={nav}>
          <Person who={c[0]} pose="busy" p={[Math.sin(since * 0.4) * 1.5, 0, 0]} r={Math.PI / 2 + (Math.cos(since * 0.4) > 0 ? 0 : Math.PI)}>
            <Swing p={[0, 0.05, 0.45]} s={[0.5, 0.06, 0.12]} c="#c9a227" speed={7} axis="y" />
          </Person>
        </SpotScene>
      )
    case 'coiffeur':
      return (
        <SpotScene s={s} nav={nav}>
          <Parasol p={[0, 0, -0.6]} c="#1c7ed6" />
          <Box p={[-1.2, 1.1, -1]} s={[0.6, 0.8, 0.05]} c="#dee2e6" />
          <Stool p={[0, 0, -0.4]} />
          <Person who={c[0]} pose="sit" p={[0, 0, -0.4]} />
          <Person who={c[1]} pose="cut" p={[0, 0, -1.05]} />
          <Person who={c[2]} pose="phone" p={[1.4, 0, -0.2]} r={-Math.PI / 2} />
        </SpotScene>
      )
    case 'dames':
      return (
        <SpotScene s={s} nav={nav}>
          <Tree p={[0, 0, -1.6]} />
          <Table p={[0, 0, -0.4]} w={0.8} />
          {[...Array(16)].map((_, k) => <Box key={k} p={[-0.3 + (k % 4) * 0.2, 0.76, -0.7 + Math.floor(k / 4) * 0.2]} s={[0.2, 0.01, 0.2]} c={(k + Math.floor(k / 4)) % 2 ? '#f8f9fa' : '#212529'} />)}
          <Stool p={[-0.85, 0, -0.4]} />
          <Stool p={[0.85, 0, -0.4]} />
          <Person who={c[0]} pose="sit" p={[-0.85, 0, -0.4]} r={Math.PI / 2} />
          <Person who={c[1]} pose={between('sit', 'sit', 9)(since)} p={[0.85, 0, -0.4]} r={-Math.PI / 2} />
          <Person who={c[2]} pose={between('talk', 'rant', 3)(since)} p={[-0.3, 0, 0.6]} r={Math.PI}>
            {since % 10 < 2 && <Said text={tr('Mange-le ! Mange son pion !')} />}
          </Person>
          <Person who={c[3]} pose={between('idle', 'cheer', 5)(since)} p={[0.5, 0, 0.7]} r={Math.PI - 0.4} />
        </SpotScene>
      )
    case 'salut': {
      // The long handshake (the hands clapped, the fingers snapped), then the laughing, the talk.
      const pose: Pose = since < 4 ? 'hug' : since < 12 ? 'talk' : 'idle'
      return (
        <SpotScene s={s} nav={nav}>
          <Person who={c[0]} pose={pose} p={[-0.5, 0, 0]} r={Math.PI / 2}>
            {since > 1 && since < 4 && <Said text={tr('Mon vieux père ! Ça dit quoi ?')} />}
          </Person>
          <Person who={c[1]} pose={since < 4 ? 'hug' : between('talk', 'cheer', 2)(since)} p={[0.5, 0, 0]} r={-Math.PI / 2} />
        </SpotScene>
      )
    }
    case 'dispute': {
      // The couple arguing, then making up.
      const up = since > 18
      return (
        <SpotScene s={s} nav={nav}>
          <Person who={c[0]} pose={up ? 'hug' : between('rant', 'talk', 2.5)(since)} p={[-0.45, 0, 0]} r={Math.PI / 2}>
            {!up && since % 6 < 2 && <Said text={tr('Tu étais où hier soir ?')} />}
          </Person>
          <Person who={c[1]} pose={up ? 'hug' : between('talk', 'rant', 2.5)(since)} p={[0.45, 0, 0]} r={-Math.PI / 2}>
            {up && since < 22 && <Said text={tr('Bon… on oublie, mon chéri.')} />}
          </Person>
        </SpotScene>
      )
    }
    case 'telephone':
      return (
        <SpotScene s={s} nav={nav}>
          <Person who={c[0]} pose={between('phone', 'rant', 2)(since)} p={[Math.sin(since * 0.5) * 1.2, 0, 0]} r={Math.PI / 2 + Math.sin(since * 0.5)}>
            {since % 8 < 2.5 && <Said text={tr("Allô ? Allô ? Tu m'entends ? Je suis à côté !")} />}
          </Person>
        </SpotScene>
      )
    case 'danse':
      return <Dance s={s} c={c} nav={nav} />
    case 'mamie':
      return (
        <SpotScene s={s} nav={nav}>
          <Bench p={[0, 0, -0.5]} />
          <Person who={c[0]} pose="sit" p={[0.3, 0, -0.5]}>
            <Swing p={[0.3, 1.0, 0.28]} s={[0.04, 0.3, 0.22]} c="#e8590c" speed={8} axis="y" />
            {since % 15 < 2.5 && <Said text={tr('Ééé, la chaleur là…')} y={1.8} />}
          </Person>
        </SpotScene>
      )
    case 'bougies':
      return (
        <SpotScene s={s} nav={nav}>
          <Box p={[0, 0.2, 0]} s={[0.5, 0.4, 0.5]} c="#5c3d24" />
          <Candle p={[0, 0.4, 0]} />
          <Candle p={[1.2, 0, -0.9]} />
          {c.map((who, i) => {
            const a = (i / c.length) * Math.PI * 2
            return (
              <group key={i}>
                <Stool p={[Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1]} />
                <Person who={who} pose={i % 2 ? 'sit' : 'call'} p={[Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1]} r={a + Math.PI} />
              </group>
            )
          })}
        </SpotScene>
      )
    case 'taxi-prix':
      return (
        <SpotScene
          s={s}
          nav={nav}
          car={
            <KerbCar id={id} spot={s.spot!} kind="taxi">
              <group position={[0.2, 0, 1.4]} rotation={[0, Math.PI, 0]}>
                <Person who={c[0]} pose={between('rant', 'talk', 2)(since)}>
                  <Said text={since < 9 ? tr('1 500 jusqu’à Treichville ? Non, 1 000 !') : since < 18 ? tr('Tonton, fais un effort, on se connaît !') : tr('Bon, 1 200, on y va.')} />
                </Person>
              </group>
            </KerbCar>
          }
        >
          {null}
        </SpotScene>
      )
    case 'controle':
      return (
        <SpotScene
          s={s}
          nav={nav}
          car={
            <KerbCar id={id} spot={s.spot!} kind="car" color="#f8f9fa">
              <group position={[0.4, 0, 1.4]} rotation={[0, Math.PI, 0]}>
                <Person who={c[1]} pose={since < 12 ? 'hand' : 'idle'} />
              </group>
            </KerbCar>
          }
        >
          <Person who={c[0]} pose={since < 6 ? 'direct' : since < 20 ? 'stamp' : 'wave'} p={[0, 0, 0.6]} r={Math.PI}>
            <Said text={since < 6 ? tr('Toi là, gare-toi !') : since < 20 ? tr('Permis, carte grise…') : tr('C’est bon, bonne route !')} />
          </Person>
        </SpotScene>
      )
    case 'eau-feu':
      return <WaterAtLight s={s} nav={nav} />
  }
}

/** The funeral's or the celebration's procession: the drummer in front, the family behind, some dancing. */
function Procession({ s, c, nav, sp }: { s: Scene; c: Who[]; nav: Nav; sp: number }) {
  const near = () => {
    const d = (worldTime() - s.start) * sp
    if (!s.way || d > routeLength(s.way)) return null
    const p = along(s.way, d)
    return [p.x, p.z] as XZ
  }
  useBeat(0.9, near, (v) => ambience.drum(v))
  return (
    <WalkScene
      s={s}
      nav={nav}
      speed={sp}
      walkers={c.map((who, i) => ({
        who,
        pose: i === 0 ? 'walk' : i % 3 === 1 ? between('dance', 'walk', 4) : 'walk',
        back: Math.floor(i / 2) * 1.3,
        side: (i % 2) * 0.9 - 0.45,
        carry: i === 0 ? <Box p={[0, 0.85, 0.32]} s={[0.36, 0.5, 0.36]} c="#8a5a32" /> : undefined,
      }))}
    />
  )
}

/** The children dancing round the radio. */
function Dance({ s, c, nav }: { s: Scene; c: Who[]; nav: Nav }) {
  const p = s.spot!.p
  useBeat(0.55, () => p, (v) => ambience.drum(v * 0.5))
  return (
    <SpotScene s={s} nav={nav}>
      <Box p={[0, 0.2, -0.6]} s={[0.6, 0.4, 0.25]} c="#212529" />
      <Box p={[-0.15, 0.22, -0.47]} s={[0.18, 0.18, 0.02]} c="#868e96" />
      <Box p={[0.15, 0.22, -0.47]} s={[0.18, 0.18, 0.02]} c="#868e96" />
      {c.map((who, i) => (
        <Person key={i} who={who} pose={i === 1 ? 'zouglou' : 'dance'} p={[(i - 1) * 0.9, 0, 0.4]} r={Math.PI + (i - 1) * 0.3} />
      ))}
    </SpotScene>
  )
}
