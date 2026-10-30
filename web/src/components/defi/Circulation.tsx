import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { ambience } from '../../audio/ambience'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import type { Pose } from '../../avatar/Human'
import { Box } from '../../world3d/props'
import { Character } from '../../world3d/Character'
import { Vehicle, type VehicleKind } from '../../world3d/vehicles'
import { rng } from '../../world3d/themes'
import { DriverArm, JAM_KINDS, jamColor } from '../../world3d/open/jamCars'
import { Prop } from './jeux/props'
import { JeuShell } from './jeux/Shell'
import { Table3d } from './Table3d'

// The street's jam regulated (the update « circulation », backend sims/jam.go): the player is the
// volunteer at the junction, the whistle and the white gloves, the jam's cars queued on its four
// branches. A tap (or a swipe) stops one way and lets the other go, like a real junction: let it go
// while a car of the other way is still crossing and they nearly hit (the brakes, the horns); keep one
// way waiting too long and its drivers lean on their horns. Scored by how fast the junction is cleared,
// without a near miss: from backend JamClearScore (60) the jam is over for the whole street.

/** The four branches: from the west, the east, the north, the south (each car goes straight across). */
const BRANCHES = [
  { axis: 'ew', d: [1, 0], n: [0, 1.8], rot: 0 },
  { axis: 'ew', d: [-1, 0], n: [0, -1.8], rot: Math.PI },
  { axis: 'ns', d: [0, 1], n: [-1.8, 0], rot: -Math.PI / 2 },
  { axis: 'ns', d: [0, -1], n: [1.8, 0], rot: Math.PI / 2 },
] as const
type Axis = 'ew' | 'ns'
/** From the middle to the stop line (the road is 8 m wide, the zebra just before). */
const STOP = 5.4
/** Cars queued on each branch, and the time given. */
const PER_BRANCH = 6
const LIMIT = 70
/** A way kept waiting this long, its drivers lean on their horns. */
const PATIENCE = 9
const LEN: Record<VehicleKind, number> = { taxi: 4.4, woro: 4.4, car: 4.5, gbaka: 5.3, moto: 1.9, sotra: 11 }

type Car = { id: number; b: number; kind: VehicleKind; color?: string; len: number; f: number; v: number; gone: boolean; flagged: boolean; honk: number; waited: number; seed: number }
type St = { t: number; open: Axis | null; cars: Car[]; wait: number[]; crashes: number; storms: number; gone: number; done: boolean; said: string; saidAt: number; nextHorn: number }

const centre = (c: Car): [number, number] => {
  const br = BRANCHES[c.b]
  const k = c.f - STOP - c.len / 2
  return [br.n[0] + br.d[0] * k, br.n[1] + br.d[1] * k]
}
/** Between the stop lines, the car's body over the junction. */
const inBox = (c: Car) => !c.gone && c.f > 0 && c.f < 2 * STOP + c.len

function startCars(): Car[] {
  const r = rng('circulation-carrefour')
  const cars: Car[] = []
  let id = 0
  for (let b = 0; b < 4; b++) {
    let f = -0.6
    for (let j = 0; j < PER_BRANCH; j++) {
      const kind = JAM_KINDS[Math.floor(r() * JAM_KINDS.length)]
      const len = LEN[kind]
      cars.push({ id: id++, b, kind, color: jamColor(kind, id), len, f, v: 0, gone: false, flagged: false, honk: 0, waited: 0, seed: r() * 100 })
      f -= len + 1.5 + r() * 0.6
    }
  }
  return cars
}

/** The score: the share of the jam got through, how fast, minus the near misses and the horn storms. */
export function circulationScore(gone: number, total: number, t: number, crashes: number, storms: number) {
  const bonus = gone >= total ? 30 * Math.max(0, Math.min(1, (LIMIT - t) / 40)) : 0
  return Math.max(10, Math.min(100, Math.round((gone / total) * 70 + bonus - crashes * 10 - storms * 5)))
}

function say(st: St, text: string) {
  st.said = text
  st.saidAt = st.t
}

/** The traffic, frame by frame: each car drives on its green (or once it's in), stops at the line on its red, keeps its distance; two crossing at once, the one less far in brakes hard. */
function step(st: St, dt: number) {
  st.t += dt
  const total = st.cars.length
  for (let b = 0; b < 4; b++) {
    const br = BRANCHES[b]
    const green = st.open === br.axis
    let ahead: Car | null = null
    let front: Car | null = null
    for (const c of st.cars) {
      if (c.b !== b || c.gone) continue
      let want = c.kind === 'moto' ? 8 : 7
      if (!green && c.f <= 0) want = Math.min(want, Math.max(0, (-0.4 - c.f) * 1.6))
      if (ahead) want = Math.min(want, Math.max(0, (ahead.f - ahead.len - c.f - 1.3) * 1.8))
      // Someone of the other way already crossing in front: brake (hard, if going: a near miss).
      if (c.f > -1.5) {
        const [x, z] = centre(c)
        for (const o of st.cars) {
          if (o.gone || BRANCHES[o.b].axis === br.axis || !inBox(o) || o.f < c.f) continue
          const [ox, oz] = centre(o)
          if (Math.hypot(ox - x, oz - z) < 3.4 + (c.len + o.len) / 4) {
            want = 0
            if (!c.flagged && c.v > 2.2) {
              c.flagged = o.flagged = true
              c.honk = o.honk = 2
              st.crashes++
              say(st, 'Ouf ! Ça a failli taper !')
              ambience.screech()
              ambience.horn(1, true)
              haptic('error')
            }
          }
        }
      }
      c.v += Math.max(-16 * dt, Math.min(3.6 * dt, want - c.v))
      if (c.v < 0.01 && want === 0) c.v = 0
      c.f += c.v * dt
      c.honk = Math.max(0, c.honk - dt)
      c.waited = c.v < 0.3 ? c.waited + dt : 0
      if (c.f > 2 * STOP + c.len + 30) {
        c.gone = true
        st.gone++
      }
      if (!front && c.f <= 0) front = c
      ahead = c
    }
    // The way kept waiting: its drivers get angry, then the horn storm.
    if (front && !green && front.v < 0.3) st.wait[b] += dt
    else st.wait[b] = Math.max(0, st.wait[b] - dt * 3)
    if (st.wait[b] > PATIENCE) {
      st.wait[b] = PATIENCE * 0.45
      st.storms++
      for (const c of st.cars) if (c.b === b && !c.gone) c.honk = 2.5
      say(st, 'Tout le monde klaxonne ! Laisse-les passer !')
      ambience.horn(1, true)
      haptic('medium')
    }
  }
  // Now and then a horn from a car stuck there (more of them the longer they wait).
  if (st.t > st.nextHorn) {
    const stuck = st.cars.filter((c) => !c.gone && c.waited > 2)
    if (stuck.length) {
      const c = stuck[Math.floor(Math.random() * stuck.length)]
      c.honk = 0.5
      ambience.horn(0.6)
    }
    st.nextHorn = st.t + 1.2 + Math.random() * 1.8
  }
  if (!st.done && (st.gone >= total || st.t >= LIMIT)) st.done = true
}

function Sim({ st }: { st: { current: St } }) {
  useFrame((_, dt) => step(st.current, Math.min(dt, 0.25)))
  return null
}

/** One of the jam's cars: where it is in its queue, its horn (the headlights flash), the driver's arm out when it has waited. */
function CarView({ car }: { car: Car }) {
  const g = useRef<THREE.Group>(null)
  const lights = useRef<THREE.Group>(null)
  const arm = useRef(0)
  const br = BRANCHES[car.b]
  useFrame(() => {
    if (!g.current) return
    g.current.visible = !car.gone
    const [x, z] = centre(car)
    g.current.position.set(x, 0, z)
    if (lights.current) lights.current.visible = car.honk > 0 && Math.floor(car.honk * 8) % 2 === 0
    arm.current = car.waited > 2.5 && car.kind !== 'moto' && car.kind !== 'gbaka' ? 1 : 0
  })
  return (
    <group ref={g} rotation={[0, br.rot, 0]}>
      <Vehicle p={[0, 0, 0]} kind={car.kind} color={car.color} seed={car.seed} />
      <group ref={lights}>
        <Box p={[car.len / 2 + 0.02, 0.62, 0.55]} s={[0.06, 0.18, 0.3]} c="#fff3b0" glow={2} />
        <Box p={[car.len / 2 + 0.02, 0.62, -0.55]} s={[0.06, 0.18, 0.3]} c="#fff3b0" glow={2} />
      </group>
      {car.kind !== 'moto' && <DriverArm out={arm} at={[0.15, 0.95, -0.92]} />}
    </group>
  )
}

/** The junction: the two roads, their zebras and stop lines, the pavements at the corners, palms. */
function Junction() {
  const stripes = [-3, -1.8, -0.6, 0.6, 1.8, 3]
  return (
    <group>
      <Box p={[0, -0.16, 0]} s={[90, 0.3, 90]} c="#c9b48a" />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * 26, 0.02, sz * 26]} s={[44, 0.18, 44]} c="#b7b2a6" />))}
      <Box p={[0, 0.01, 0]} s={[90, 0.02, 8]} c="#4a4e55" />
      <Box p={[0, 0.012, 0]} s={[8, 0.02, 90]} c="#4a4e55" />
      {/* The middle lines, broken */}
      {[...Array(10)].map((_, i) => (
        <group key={i}>
          <Box p={[-44 + i * 4 + (i >= 5 ? 9 : 0) - (i >= 5 ? 1 : 0), 0.025, 0]} s={[2, 0.01, 0.14]} c="#f4f1ea" />
          <Box p={[0, 0.025, -44 + i * 4 + (i >= 5 ? 8 : 0)]} s={[0.14, 0.01, 2]} c="#f4f1ea" />
        </group>
      ))}
      {/* The zebras and the stop lines on each branch */}
      {BRANCHES.map((br, b) => (
        <group key={b}>
          {stripes.map((s) => {
            const along = STOP + 1.3
            const [x, z] = br.d[0] !== 0 ? [-br.d[0] * along, s] : [s, -br.d[1] * along]
            return <Box key={s} p={[x, 0.03, z]} s={br.d[0] !== 0 ? [1.6, 0.01, 0.6] : [0.6, 0.01, 1.6]} c="#f8f9fa" />
          })}
          <Box p={br.d[0] !== 0 ? [-br.d[0] * (STOP + 0.1), 0.03, br.n[1]] : [br.n[0], 0.03, -br.d[1] * (STOP + 0.1)]} s={br.d[0] !== 0 ? [0.25, 0.01, 3.8] : [3.8, 0.01, 0.25]} c="#f8f9fa" />
        </group>
      ))}
      {[[-9, -9], [9, -9], [-9, 9], [9, 9], [-15, 8], [8, -16]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} scale={2.2}>
          <Prop id={i % 2 ? 'palmier' : 'cocotier'} />
        </group>
      ))}
    </group>
  )
}

/** The volunteer on the plot in the middle: the white gloves, the whistle; facing the way that's stopped. */
function Cop({ st, look }: { st: { current: St }; look: Look }) {
  const g = useRef<THREE.Group>(null)
  const [pose, setPose] = useState<Pose>('whistle')
  useFrame((_, dt) => {
    const open = st.current.open
    const want = open === 'ew' ? 0 : open === 'ns' ? Math.PI / 2 : 0
    if (g.current) g.current.rotation.y += Math.atan2(Math.sin(want - g.current.rotation.y), Math.cos(want - g.current.rotation.y)) * Math.min(1, dt * 8)
    const p: Pose = open ? 'direct' : 'whistle'
    if (p !== pose) setPose(p)
  })
  return (
    <group>
      <Box p={[0, 0.15, 0]} s={[1.4, 0.3, 1.4]} c="#f8f9fa" />
      <Box p={[0, 0.31, 0]} s={[1.42, 0.04, 0.3]} c="#e03131" />
      <group ref={g} position={[0, 0.3, 0]}>
        <Character look={look} gender="homme" pose={pose} marker={false} seed={3} />
      </group>
    </group>
  )
}

/** The people at the corners, watching (cheering when it flows). */
function Onlookers() {
  const people = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const gender = i === 1 ? 'femme' : 'homme'
        return { gender, look: randomLook(gender, rng(`badaud${i}`)) as Look, p: [[-6.6, 0, -7], [7, 0, 6.8], [6.8, 0, -7.4]][i] as [number, number, number], r: [Math.PI / 4, -Math.PI * 0.75, -Math.PI / 4][i] }
      }),
    [],
  )
  return (
    <>
      {people.map((m, i) => (
        <group key={i} position={m.p} rotation={[0, m.r, 0]}>
          <Character look={m.look} gender={m.gender as 'femme' | 'homme'} pose={i === 1 ? 'cheer' : 'idle'} marker={false} seed={i} />
        </group>
      ))}
    </>
  )
}

export function CirculationDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const [first] = useState<St>(() => ({ t: 0, open: null, cars: startCars(), wait: [0, 0, 0, 0], crashes: 0, storms: 0, gone: 0, done: false, said: 'Siffle, et choisis qui passe !', saidAt: 0, nextHorn: 1 }))
  const st = useRef<St>(first)
  // (Development, for tests in the browser: the junction as it is.)
  if (import.meta.env.DEV) Object.assign(globalThis, { __circ: st.current })
  const [hud, setHud] = useState({ gone: 0, t: 0, open: null as Axis | null, said: st.current.said })
  const look = useMemo<Look>(() => ({ ...randomLook('homme', rng('agent-circulation')), outfit: 'policier', accessory: 'gants', hair: 'short', beard: 'none' }) as Look, [])
  const ended = useRef(false)
  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current
      setHud({ gone: s.gone, t: s.t, open: s.open, said: s.t - s.saidAt < 2.5 ? s.said : '' })
      if (s.done && !ended.current) {
        ended.current = true
        const all = s.gone >= s.cars.length
        say(s, all ? 'Le carrefour est dégagé !' : 'Le temps est écoulé…')
        setTimeout(() => onEnd(circulationScore(s.gone, s.cars.length, s.t, s.crashes, s.storms)), 900)
      }
    }, 150)
    return () => clearInterval(t)
  }, [onEnd])
  const go = (axis: Axis) => {
    const s = st.current
    if (s.done || s.open === axis) return
    s.open = axis
    ambience.whistle(s.t < 0.5)
    haptic('light')
    say(s, axis === 'ew' ? 'Priiit ! À gauche et à droite, avancez !' : 'Priiit ! Devant et derrière, avancez !')
  }
  const toggle = () => go(st.current.open === 'ew' ? 'ns' : 'ew')
  const down = useRef<[number, number] | null>(null)
  const total = st.current.cars.length
  return (
    <JeuShell
      title="Régler la circulation"
      how="Touche pour changer de sens (ou glisse ◀ ▶, ▲ ▼). Attends que le carrefour soit vide avant de lâcher l’autre file, et ne fais pas trop attendre."
      status={`${hud.gone}/${total} passés · ${Math.max(0, Math.ceil(LIMIT - hud.t))} s`}
      said={hud.said}
      controls={
        <>
          <button className={`btn flex-1 !py-2.5 !text-sm ${hud.open === 'ew' ? '!bg-[#2f9e44] !text-white' : 'btn-soft'}`} onClick={() => go('ew')}>
            ◀ ▶ Passez
          </button>
          <button className={`btn flex-1 !py-2.5 !text-sm ${hud.open === 'ns' ? '!bg-[#2f9e44] !text-white' : 'btn-soft'}`} onClick={() => go('ns')}>
            ▲ ▼ Passez
          </button>
        </>
      }
    >
      <div
        className="absolute inset-0"
        onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
        onPointerUp={(e) => {
          const d = down.current
          down.current = null
          if (!d) return
          const [dx, dy] = [e.clientX - d[0], e.clientY - d[1]]
          if (Math.hypot(dx, dy) < 24) return toggle()
          go(Math.abs(dx) > Math.abs(dy) ? 'ew' : 'ns')
        }}
      >
        <Table3d className="!absolute inset-0" cam={[0, 30, 21]} look={[0, 0, 1.5]} fov={42}>
          <Sim st={st} />
          <Junction />
          <Cop st={st} look={look} />
          <Onlookers />
          {st.current.cars.map((c) => (
            <CarView key={c.id} car={c} />
          ))}
        </Table3d>
      </div>
    </JeuShell>
  )
}
