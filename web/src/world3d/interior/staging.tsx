import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, SEATED, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'
import { Dish, dishFor, type DishKind } from './ActionProps'
import { Fridge } from './Decor'
import { InHand, type Hold } from '../inHand'
import type { Room, Spot } from '../Interior'

// Actions done for real, where they belong in a place (NEXT_AGENT « point 4 »):
// the Sim takes a free chair at a free table (never one someone already sits
// on), eats with its hand or its fork from the plate of what it ordered,
// drinks from the bottle, wipes its mouth, and goes to pay at the counter
// when the meal is nearly over; it picks things off the boutique's shelves
// and queues at the till behind the other customers; takes a ticket at the
// mairie and waits seated for its turn; waits on the barber's bench before
// the chair; raises its hand in class; types at the office. Each place's
// people do the same around it: plates and bottles in front of the diners,
// the line at the till moving on, one customer after the other.
// Rooms are the interiors' 12 × 9 m (Shell): -z the back wall, -x the left one, +z the door.

type V3 = [number, number, number]
type XZ = [number, number]

/* ---------- Shared boxes (one geometry, one material per colour) ---------- */

const UNIT = new THREE.BoxGeometry(1, 1, 1)
const MATS = new Map<string, THREE.MeshLambertMaterial>()
function mat(c: string, glow = 0) {
  const key = `${c}${glow}`
  let m = MATS.get(key)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: glow ? c : '#000000', emissiveIntensity: glow })
    MATS.set(key, m)
  }
  return m
}

function B({ p, s, c, r = 0, glow }: { p: V3; s: V3; c: string; r?: number; glow?: number }) {
  return <mesh geometry={UNIT} material={mat(c, glow)} position={p} scale={s} rotation={[0, r, 0]} castShadow receiveShadow />
}

/** Many boxes of one colour in one draw (the seats of a cinema, the goods on the shelves). */
function BoxSet({ c, items, glow }: { c: string; items: [V3, V3][]; glow?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const inst = ref.current
    if (!inst) return
    items.forEach(([p, s], i) => inst.setMatrixAt(i, m.makeScale(s[0], s[1], s[2]).setPosition(p[0], p[1], p[2])))
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[UNIT, mat(c, glow), items.length]} castShadow receiveShadow />
}

/** Boxes grouped by colour into BoxSets. */
function Boxes({ items }: { items: [V3, V3, string][] }) {
  const byColour = useMemo(() => {
    const m = new Map<string, [V3, V3][]>()
    for (const [p, s, c] of items) m.set(c, [...(m.get(c) ?? []), [p, s]])
    return [...m]
  }, [items])
  return (
    <>
      {byColour.map(([c, list]) => (
        <BoxSet key={c} c={c} items={list} />
      ))}
    </>
  )
}

const seeded = (n: number) => () => (n = (n * 16807) % 2147483647) / 2147483647
const hash = (s: string) => {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647
  return h || 1
}

/** A word on a little sign (the guichets' numbers, the ticket number on the screen), drawn once per text. */
const LABELS = new Map<string, THREE.MeshBasicMaterial>()
function labelMat(text: string, bg: string, fg: string) {
  const key = `${text}|${bg}|${fg}`
  let m = LABELS.get(key)
  if (!m) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const x = c.getContext('2d')!
    x.fillStyle = bg
    x.fillRect(0, 0, 256, 128)
    x.fillStyle = fg
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.font = '800 64px sans-serif'
    const k = Math.min(1, 230 / x.measureText(text).width)
    x.font = `800 ${Math.floor(64 * k)}px sans-serif`
    x.fillText(text, 128, 66)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    m = new THREE.MeshBasicMaterial({ map: tex })
    LABELS.set(key, m)
  }
  return m
}
const PLANE = new THREE.PlaneGeometry(1, 1)

/* ---------- Seats ---------- */

/** The chairs of tables (x, z of each table, as Interior's Table draws them: a chair either side, ±0.85 m on z). */
export function tableSeats(tables: XZ[], pose: Pose = 'eat'): Spot[] {
  return tables.flatMap(([x, z]) => [
    { p: [x, 0, z + 0.85] as V3, r: Math.PI, pose },
    { p: [x, 0, z - 0.85] as V3, r: 0, pose },
  ])
}

export const MAQUIS_TABLES: XZ[] = [
  [-3.5, -2.5],
  [0.5, -2.5],
  [-3.5, 1.5],
  [4, 2.2],
]
export const RESTO_TABLES: XZ[] = [
  [-3.5, 0.5],
  [0.5, 0.5],
  [4, -1.5],
  [4, 2],
]

const near = (a: V3 | XZ, b: V3) => Math.hypot(a[0] - b[0], (a.length === 3 ? a[2] : a[1]) - b[2]) < 0.4

/**
 * Free places among `seats` for each of `who` (in order), none where someone
 * already is (`busy`): the same choice every time for the same one (its seed).
 * `pair`: only a table whose other chair is free too (to sit with a friend).
 */
export function book(seats: Spot[], busy: (V3 | XZ)[], who: string[], pair = false): (Spot | undefined)[] {
  const taken = [...busy]
  return who.map((w) => {
    const free = seats.filter((s, i) => !taken.some((b) => near(b, s.p)) && (!pair || !taken.some((b) => near(b, seats[i ^ 1].p))))
    if (!free.length) return undefined
    const s = free[hash(w) % free.length]
    taken.push(s.p)
    return s
  })
}

/* ---------- Things in hand (in the forearm's frame: -y runs out of the fist) ---------- */

// (Shared with the street, where things are bought and handed over: world3d/inHand.tsx.)
export { InHand, type Hold } from '../inHand'

/** The red plastic basket on the arm, filling up (the Sim's frame). */
export function Basket() {
  return (
    <group position={[-0.27, 0.78, 0.18]}>
      <B p={[0, 0, 0]} s={[0.26, 0.15, 0.2]} c="#d62828" />
      <B p={[0, 0.08, 0]} s={[0.04, 0.02, 0.18]} c="#c92a2a" />
      <B p={[-0.05, 0.08, 0.02]} s={[0.07, 0.06, 0.06]} c="#ffd43b" />
      <B p={[0.06, 0.09, -0.03]} s={[0.06, 0.09, 0.06]} c="#1c7ed6" />
    </group>
  )
}

/** On a table in front of someone seated (their frame): the bottle (up in the hand while drinking). */
export function TableBottle({ hidden }: { hidden?: boolean }) {
  return (
    <group position={[0.3, 0.77, 0.42]} visible={!hidden}>
      <B p={[0, 0.1, 0]} s={[0.07, 0.2, 0.07]} c="#2b7a3d" />
      <B p={[0, 0.23, 0]} s={[0.03, 0.06, 0.03]} c="#2b7a3d" />
      <B p={[0, 0.1, 0.036]} s={[0.05, 0.06, 0.004]} c="#f4f1ea" />
    </group>
  )
}

/** What's in front of a customer seated at a table (their frame): their plate or their bottle. */
export function Served({ what, drinking }: { what: 'drink' | DishKind; /** The bottle is in the hand, not on the table. */ drinking?: boolean }) {
  if (what === 'drink')
    return (
      <>
        <TableBottle hidden={drinking} />
        <group position={[-0.1, 0.77, 0.5]}>
          <B p={[0, 0.06, 0]} s={[0.07, 0.12, 0.07]} c="#f4f1ea" />
          <B p={[0, 0.08, 0]} s={[0.06, 0.06, 0.06]} c="#e8a33c" />
        </group>
      </>
    )
  return (
    <>
      <Dish kind={what} />
      <TableBottle hidden={drinking} />
    </>
  )
}

/** Popcorn on the lap of someone in a cinema seat (their frame). */
export function LapPopcorn() {
  return (
    <group position={[0, 0.6, 0.28]}>
      <B p={[0, 0, 0]} s={[0.16, 0.2, 0.12]} c="#e03131" />
      <B p={[0, 0.12, 0]} s={[0.13, 0.05, 0.1]} c="#fff3bf" />
    </group>
  )
}

/* ---------- The line at a till ---------- */

/** A till: where one pays (facing the counter), the way the line goes back from it, the way out. */
export type Till = { at: Spot; back: XZ; door: XZ; side: XZ }

const GAP = 0.8

/**
 * The line at a till, on the shared clock (the same on every screen): a
 * customer is served every P seconds, the others step up, the one served
 * walks off and a new one comes in at the back. When the Sim queues, it
 * takes a turn in it (the customers after it come in behind it); while it's
 * kept at the counter (the pharmacist explaining), the line waits.
 */
export class Line {
  P = 7
  L = 2
  sims: number[] = []
  off = 0
  frozen: number | null = null
  now() {
    return (this.frozen ?? worldTime()) - this.off
  }
  hold(on: boolean) {
    const t = worldTime()
    if (on && this.frozen === null) this.frozen = t
    else if (!on && this.frozen !== null) {
      this.off += t - this.frozen
      this.frozen = null
    }
  }
  /** The Sim's turn: behind everyone in line and the one coming in. */
  join() {
    const s = Math.floor(this.now() / this.P + this.L + 1) + 1
    this.sims.push(s)
    this.sims.sort((a, b) => a - b)
    return s
  }
  isSim(i: number) {
    return this.sims.includes(i)
  }
}

function slotOf(till: Till, j: number): XZ {
  return [till.at.p[0] + till.back[0] * GAP * j, till.at.p[2] + till.back[1] * GAP * j]
}
/** Facing the front of the line (or the counter, first in line). */
function lineFacing(till: Till, j: number) {
  return j === 0 ? (till.at.r ?? 0) : Math.atan2(-till.back[0], -till.back[1])
}
/** Where one stands in line (j places back), as a spot. */
export function lineSpot(till: Till, j: number, pose: Pose): Spot {
  const [x, z] = slotOf(till, j)
  return { p: [x, 0, z], r: lineFacing(till, j), pose }
}

/** A way made once: its points, and the length of each leg. */
type Way = { pts: XZ[]; lens: number[]; total: number }
function way(pts: XZ[]): Way {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  return { pts, lens, total: lens.reduce((a, b) => a + b, 0) }
}
/** Where one is, k (0 to 1) along a way, and facing which way (into out: nothing made per frame). */
function along(w: Way, k: number, out: { x: number; z: number; r: number }) {
  let d = Math.max(0, Math.min(1, k)) * w.total
  for (let i = 0; i < w.lens.length; i++) {
    if (d <= w.lens[i] || i === w.lens.length - 1) {
      const f = w.lens[i] ? Math.min(1, d / w.lens[i]) : 1
      const a = w.pts[i]
      const b = w.pts[i + 1]
      out.x = a[0] + (b[0] - a[0]) * f
      out.z = a[1] + (b[1] - a[1]) * f
      out.r = Math.atan2(b[0] - a[0], b[1] - a[1])
      return
    }
    d -= w.lens[i]
  }
}

const POOL = 6

/** The customers in line, a few people reused one after the other. */
export function TillQueue({ till, line, seed }: { till: Till; line: Line; seed: number }) {
  const looks = useMemo(() => {
    const r = seeded(seed * 97 + 13)
    return [...Array(POOL)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [seed])
  return (
    <NoShadows>
      {looks.map((l, n) => (
        <QueueGuy key={n} n={n} till={till} line={line} {...l} />
      ))}
    </NoShadows>
  )
}

function QueueGuy({ n, till, line, gender, look, seed }: { n: number; till: Till; line: Line; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number }) {
  const g = useRef<THREE.Group>(null)
  const [pose, setPose] = useState<Pose>('idle')
  const at = useRef({ x: 0, z: 0, r: 0 })
  // The places in line, the way in from the door, the way out, a step up from each place: made once.
  const ways = useMemo(() => {
    const slots = [...Array(line.L + 3)].map((_, j) => slotOf(till, j))
    const [sx, sz] = till.side
    const last = slots[line.L]
    return {
      slots,
      in: way([till.door, [last[0] + sx, last[1] + sz], last]),
      out: way([slots[0], [slots[0][0] + sx, slots[0][1] + sz], till.door]),
      up: slots.slice(0, -1).map((s, j) => way([slots[j + 1], s])),
    }
  }, [till, line])
  useFrame(() => {
    const o = g.current
    if (!o) return
    const te = line.now()
    const base = Math.floor(te / line.P) - 1
    // The one turn of the window this guy plays (one in POOL).
    const i = base + ((((n - base) % POOL) + POOL) % POOL)
    const u = i - te / line.P
    const { L } = line
    const shown = !line.isSim(i) && u > -0.6 && u <= L + 1
    let now: Pose = 'idle'
    const a = at.current
    if (shown) {
      if (u > L + 0.5) {
        // Coming in from the door to the back of the line.
        along(ways.in, (L + 1 - u) / 0.5, a)
        now = 'walk'
      } else if (u > 0) {
        const j = Math.ceil(u) - 1
        const f = j + 1 - u
        if (f < 0.15 && j < L) {
          along(ways.up[j], f / 0.15, a)
          now = 'walk'
        } else {
          a.x = ways.slots[j][0]
          a.z = ways.slots[j][1]
          a.r = lineFacing(till, j)
          now = j === 0 && f > 0.15 && f < 0.9 ? 'pay' : j > 0 && (i + n) % 2 ? 'phone' : 'idle'
        }
      } else {
        // Served: off to the door with the shopping.
        along(ways.out, -u / 0.6, a)
        now = 'walk'
      }
    }
    o.visible = shown
    o.position.set(a.x, 0, a.z)
    o.rotation.y = a.r
    if (!shown) now = 'idle'
    if (now !== pose) setPose(now)
  })
  return (
    <group ref={g} visible={false}>
      <Human look={look} gender={gender} pose={pose} seed={seed} speed={1.3} hold={pose === 'pay' ? <InHand what="notes" /> : pose === 'phone' ? <InHand what="phone" /> : undefined} />
    </group>
  )
}

/* ---------- Scripts: what the Sim does there, step after step ---------- */

/** Where a step is done: the action's own place ('base'), a spot of the room, a booked seat ('seat:<group>'), the line at the till ('queue'). */
export type Step = { at: string; pose: Pose; s: number; hold?: Hold; props?: boolean; basket?: boolean; /** Kept at the counter after the line: the line waits. */ keep?: boolean }
export type Script = {
  steps: Step[]
  loop: number
  /** Near the end of the action (the meal finished): this, once. */ pay?: Step
  /** What's on the table at its seat, drawn there (the plate stays when it gets up to pay). */ table?: 'drink' | DishKind
  /** Friends at its table (none came with it): two of the quartier. */ mates?: boolean
}

/** How one eats each dish: with the fingers (garba, fish, chicken), the fork, the spoon, the burger in hand. */
function eatHold(d: DishKind): Hold {
  if (d === 'burger') return 'burger'
  if (d === 'glace' || d === 'bouillie') return 'spoon'
  if (d === 'alloco' || d === 'plat' || d === 'gateau') return 'fork'
  return 'hand'
}

const MEAL_KINDS = new Set(['maquis', 'restaurant', 'market', 'mall', 'universite', 'hotel', 'boutique'])
const PAY_KINDS = new Set(['maquis', 'restaurant', 'market'])
const HAIR = /^(degrade|boule-a-zero|taille-barbe|tresses|tissage|chignon|coupe-courte|iroquoise|nattes|vanilles|macarons|carre|manucure)$/
const COUNTER_ERRANDS = /^(etat-civil|legalisation|declaration-perte|renseignement)$/

/** The script of an action at a place (null: done in one pose where it's done, as before). */
export function scriptFor(kind: string, id: string | undefined, act: { spot: string; pose: Pose }, room: Room, alone: boolean): Script | null {
  if (!id || id === 'work' || id.startsWith('anniversaire')) {
    // At work at a desk: typing, a note by hand now and then.
    if (id === 'work' && act.spot === 'desk' && (kind === 'office' || kind === 'mairie'))
      return {
        steps: [
          { at: 'base', pose: 'type', s: 9, props: true },
          { at: 'base', pose: 'write', s: 4, props: true },
        ],
        loop: 0,
      }
    return null
  }
  const payAt = room.spots.pay ? 'pay' : 'counter'
  const pay: Step | undefined = PAY_KINDS.has(kind) && room.spots[payAt] ? { at: payAt, pose: 'pay', s: Infinity, hold: 'notes' } : undefined
  // A meal at a table: the plate in front, eaten bite after bite, a drink, the mouth wiped; paid at the counter at the end.
  const dish = dishFor(id)
  if (act.spot === 'table' && act.pose === 'eat' && dish && MEAL_KINDS.has(kind)) {
    const h = eatHold(dish)
    return {
      steps: [
        { at: 'base', pose: 'eat', s: 5, hold: h },
        { at: 'base', pose: 'drink', s: 3, hold: 'bottle' },
        { at: 'base', pose: 'eat', s: 4.5, hold: h },
        { at: 'base', pose: 'wipe', s: 1.8, hold: 'napkin' },
      ],
      loop: 0,
      pay,
      table: dish,
    }
  }
  // Drinks at a table: the bottle up, put down, talk; with friends from the quartier at a maquis if none came along.
  if (act.spot === 'table' && act.pose === 'drink' && room.seats?.table) {
    const h: Hold = id === 'milkshake' ? 'glass' : 'bottle'
    const drinks: Step[] = [
      { at: 'base', pose: 'drink', s: 3, hold: h },
      { at: 'base', pose: 'sit', s: 4 },
      { at: 'base', pose: 'drink', s: 2.5, hold: h },
      { at: 'base', pose: 'wipe', s: 1.2, hold: 'napkin' },
      { at: 'base', pose: 'sit', s: 3 },
    ]
    // The cold one bought at the boutique: taken from the fridge, paid at the till, then drunk at its little table.
    if (kind === 'boutique' && room.till) return { steps: [{ at: 'fridge', pose: 'pick', s: 3 }, { at: 'queue', pose: 'pay', s: 0, hold: 'notes' }, ...drinks], loop: 2, table: 'drink' }
    return { steps: drinks, loop: 0, pay, table: 'drink', mates: alone && id === 'drink-with-friends' }
  }
  // At the bar's counter: elbows on it, a wave to the barman, the bottle up, a word to the next one.
  if (act.spot === 'counter' && act.pose === 'drink')
    return {
      steps: [
        { at: 'base', pose: 'wave', s: 2 },
        { at: 'base', pose: 'elbows', s: 3 },
        { at: 'base', pose: 'snack', s: 2.5, hold: 'bottle' },
        { at: 'base', pose: 'elbows', s: 3, hold: 'bottle' },
        { at: 'base', pose: 'talk', s: 3.5, hold: 'bottle' },
      ],
      loop: 1,
    }
  // The boutique: round the shelves with the basket, then the line at the till, and round again.
  if (kind === 'boutique' && room.till) {
    if (id === 'courses')
      return {
        steps: [
          { at: 'shelfA', pose: 'pick', s: 5, basket: true },
          { at: 'shelfB', pose: 'pick', s: 5, basket: true },
          { at: 'fridge', pose: 'pick', s: 3, basket: true },
          { at: 'queue', pose: 'pay', s: 0, hold: 'notes', basket: true },
        ],
        loop: 0,
      }
    // The credit: in line, paid, then the card scratched and keyed in, standing by.
    if (id === 'credit')
      return {
        steps: [
          { at: 'queue', pose: 'pay', s: 0, hold: 'notes' },
          { at: 'aside', pose: 'phone', s: Infinity, hold: 'phone' },
        ],
        loop: 1,
      }
  }
  // The pharmacy: in line, then at the counter with the pharmacist (the line waits behind).
  if (kind === 'pharmacie' && room.till && act.spot === 'counter')
    return {
      steps: [
        { at: 'queue', pose: 'pay', s: 0, hold: 'notes' },
        { at: 'base', pose: act.pose, s: Infinity, props: true, keep: true },
      ],
      loop: 1,
    }
  // The mairie: a ticket from the machine, seated till the number comes up, then the guichet.
  if (kind === 'mairie' && room.seats?.wait && COUNTER_ERRANDS.test(id))
    return {
      steps: [
        { at: 'ticket', pose: 'pick', s: 3, hold: 'ticket' },
        { at: 'seat:wait', pose: 'sit', s: 16, hold: 'ticket' },
        { at: 'base', pose: act.pose, s: Infinity, props: true },
      ],
      loop: 2,
    }
  // The doctor's: the waiting chairs first, then the bed.
  if (kind === 'health' && id === 'consultation' && room.seats?.wait)
    return {
      steps: [
        { at: 'seat:wait', pose: 'sit', s: 14, hold: 'phone' },
        { at: 'base', pose: act.pose, s: Infinity, props: true },
      ],
      loop: 1,
    }
  // The barber's, the salon: on the bench till the chair is free.
  if ((kind === 'barbier' || kind === 'salon') && HAIR.test(id) && room.seats?.bench)
    return {
      steps: [
        { at: 'seat:bench', pose: 'sit', s: 10 },
        { at: 'base', pose: act.pose, s: Infinity, props: true },
      ],
      loop: 1,
    }
  // In class: writing, the hand up now and then.
  if ((kind === 'school' || kind === 'universite') && act.spot === 'desk' && /cours|conference/.test(id))
    return {
      steps: [
        { at: 'base', pose: 'write', s: 7, props: true },
        { at: 'base', pose: 'raise', s: 2.5, props: true },
      ],
      loop: 0,
    }
  // The cinema with popcorn: watching, a handful now and then.
  if (kind === 'cinema' && id === 'film-popcorn')
    return {
      steps: [
        { at: 'base', pose: 'sit', s: 5, props: true },
        { at: 'base', pose: 'eat', s: 2.2, props: true },
      ],
      loop: 0,
    }
  return null
}

/** Near its end (the share of the action's time gone), the meal is paid. */
const PAY_AT = 0.93

export type Staged = { spot: Spot; pose: Pose; hold?: Hold; props: boolean; basket: boolean; /** Where it is, to bring the camera (the spot's name: the same while the line moves). */ place: string }

/**
 * Plays a script: the step now, where (the booked seat, the slot in the
 * line…), how. A step's time runs only once the Sim is there (`there`).
 */
export function useScript(o: { script: Script | null; base: Spot; act: { spot: string; pose: Pose }; room: Room; line: Line | null; seats: Record<string, Spot | undefined>; progress: () => number; there: React.RefObject<boolean> }): Staged {
  const { script, base, room, line } = o
  // (The labs start at a step: city.html's &step.)
  const first = import.meta.env.DEV ? Math.min((globalThis as { __labStep?: number }).__labStep ?? 0, (script?.steps.length ?? 1) - 1) : 0
  const [st, setSt] = useState({ i: first, slot: 0, paying: false })
  const run = useRef({ i: first, clock: 0, turn: null as number | null, paying: false, slot: 0, script })
  if (run.current.script !== script) {
    // Another action: its script from the start.
    run.current = { i: first, clock: 0, turn: null, paying: false, slot: 0, script }
    setSt({ i: first, slot: 0, paying: false })
  }
  useFrame((_, dtRaw) => {
    const r = run.current
    if (!script) return void line?.hold(false)
    // (A slow phone's frames still count whole: the steps keep their seconds.)
    const dt = Math.min(dtRaw, 0.5)
    if (script.pay && !r.paying && o.progress() >= PAY_AT) {
      r.paying = true
      setSt({ i: r.i, slot: r.slot, paying: true })
    }
    if (r.paying) return
    const step = script.steps[r.i]
    if (!step) return
    line?.hold(!!step.keep && !!o.there.current)
    let done = false
    if (step.at === 'queue' && line) {
      if (r.turn === null) r.turn = line.join()
      const u = r.turn - line.now() / line.P
      const j = Math.max(0, Math.min(line.L + 2, Math.ceil(u) - 1))
      done = u <= 0
      if (!done && j !== r.slot) {
        r.slot = j
        setSt({ i: r.i, slot: j, paying: false })
      }
    } else if (o.there.current && isFinite(step.s)) {
      r.clock += dt
      done = r.clock >= step.s
    }
    if (!done) return
    // On to the next step (back to the loop's start after the last).
    r.i = r.i + 1 >= script.steps.length ? script.loop : r.i + 1
    r.clock = 0
    r.turn = null
    r.slot = 0
    setSt({ i: r.i, slot: 0, paying: false })
  })
  if (!script) return { spot: base, pose: o.act.pose, props: true, basket: false, place: 'base' }
  const step = st.paying && script.pay ? script.pay : (script.steps[st.i] ?? script.steps[0])
  let spot: Spot = base
  if (step.at === 'queue' && room.till) spot = lineSpot(room.till, st.slot, st.slot === 0 ? 'pay' : 'phone')
  else if (step.at.startsWith('seat:')) spot = o.seats[step.at.slice(5)] ?? base
  else if (step.at !== 'base') spot = room.spots[step.at] ?? base
  const pose: Pose = step.at === 'queue' ? (st.slot === 0 ? 'pay' : 'phone') : step.pose
  const hold: Hold | undefined = step.at === 'queue' ? (st.slot === 0 ? 'notes' : 'phone') : step.hold
  return { spot, pose, hold, props: !!step.props, basket: !!step.basket, place: step.at === 'queue' ? 'queue' : step.at }
}

/** Two of the quartier at the Sim's table for the drinks (its frame): across it, and on a stool at the end. */
export function TableMates({ seed }: { seed: number }) {
  const mates = useMemo(() => {
    const r = seeded(seed * 31 + 5)
    return [0, 1].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [seed])
  return (
    <NoShadows>
      <group position={[0, 0, 1.7]} rotation={[0, Math.PI, 0]}>
        <Cycled poses={['drink', 'sit', 'sit', 'drink', 'wipe']} seed={mates[0].seed}>
          {(pose) => <Human look={mates[0].look} gender={mates[0].gender} pose={pose} seed={mates[0].seed} hold={pose === 'drink' ? <InHand what="bottle" /> : undefined} />}
        </Cycled>
        <TableBottle />
      </group>
      <group position={[0.95, 0, 0.85]} rotation={[0, -Math.PI / 2, 0]}>
        <B p={[0, 0.22, -0.12]} s={[0.46, 0.44, 0.46]} c="#b5651d" />
        <Cycled poses={['sit', 'drink', 'sit', 'sit']} seed={mates[1].seed + 2}>
          {(pose) => <Human look={mates[1].look} gender={mates[1].gender} pose={pose} seed={mates[1].seed} hold={pose === 'drink' ? <InHand what="bottle" /> : undefined} />}
        </Cycled>
      </group>
    </NoShadows>
  )
}

/** A pose that changes every few seconds (a diner: a bite, a bite, a drink; a pupil's hand up now and then). */
export function Cycled({ poses, seed, every = 3.2, children }: { poses: Pose[]; seed: number; every?: number; children: (pose: Pose) => React.ReactNode }) {
  const [k, setK] = useState(0)
  useFrame(() => {
    const now = Math.floor((worldTime() + seed * 7.7) / every) % poses.length
    if (now !== k) setK(now)
  })
  return <>{children(poses[k] ?? poses[0])}</>
}

/** Poses done on a chair, so things in front stay on the table. */
export const isSeated = (p: Pose) => SEATED.includes(p)

/* ---------- Rooms of their own ---------- */

/** Goods on shelves: rows of small boxes and bottles in the colours of the brands. */
function goods(x0: number, x1: number, ys: number[], z: number, seed: number, face = 1): [V3, V3, string][] {
  const r = seeded(seed)
  const COL = ['#e03131', '#f08c00', '#ffd43b', '#2f9e44', '#1c7ed6', '#f8f9fa', '#7048e8', '#e64980']
  const out: [V3, V3, string][] = []
  for (const y of ys)
    for (let x = x0 + 0.12; x < x1 - 0.1; x += 0.2 + r() * 0.06) {
      const h = 0.14 + r() * 0.16
      out.push([[x, y + h / 2, z + face * r() * 0.04], [0.15, h, 0.16], COL[Math.floor(r() * COL.length)]])
    }
  return out
}

/** A shelf unit against a wall (front +z), its three boards, the goods on them. */
function Shelf({ p, w, h = 2.0, seed }: { p: V3; w: number; h?: number; seed: number }) {
  const items = useMemo(
    () =>
      goods(
        -w / 2,
        w / 2,
        [0.35, 0.95, 1.55].filter((y) => y < h - 0.2),
        0.05,
        seed,
      ),
    [w, h, seed],
  )
  return (
    <group position={p}>
      <B p={[0, h / 2, -0.17]} s={[w, h, 0.06]} c="#cfd4dc" />
      {[0.33, 0.93, 1.53]
        .filter((y) => y < h - 0.2)
        .map((y) => (
          <B key={y} p={[0, y, 0]} s={[w, 0.04, 0.42]} c="#e9ecef" />
        ))}
      {[-1, 1].map((s) => (
        <B key={s} p={[(s * w) / 2, h / 2, 0]} s={[0.05, h, 0.42]} c="#adb5bd" />
      ))}
      <Boxes items={items} />
    </group>
  )
}

/** A gondola in the middle of the shop: goods on both sides. */
function Gondola({ p, w, seed }: { p: V3; w: number; seed: number }) {
  const items = useMemo(() => [...goods(-w / 2, w / 2, [0.3, 0.85], 0.22, seed), ...goods(-w / 2, w / 2, [0.3, 0.85], -0.22, seed + 9, -1)], [w, seed])
  return (
    <group position={p}>
      <B p={[0, 0.65, 0]} s={[w, 1.3, 0.12]} c="#cfd4dc" />
      {[0.28, 0.83].flatMap((y) => [-0.22, 0.22].map((z) => <B key={`${y}${z}`} p={[0, y, z]} s={[w, 0.04, 0.34]} c="#e9ecef" />))}
      <B p={[0, 0.06, 0]} s={[w, 0.12, 0.8]} c="#adb5bd" />
      <Boxes items={items} />
    </group>
  )
}

/** A plastic table and its two chairs (as the maquis's: a chair either side on z). */
function PlasticTable({ p, c = '#f4f1ea', chairs = '#d62828' }: { p: V3; c?: string; chairs?: string }) {
  return (
    <group position={p}>
      <B p={[0, 0.74, 0]} s={[1.3, 0.06, 0.9]} c={c} />
      {[-0.55, 0.55].flatMap((x) => [-0.35, 0.35].map((z) => <B key={`${x}${z}`} p={[x, 0.37, z]} s={[0.06, 0.74, 0.06]} c={c} />))}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * 0.85]}>
          <B p={[0, 0.44, 0]} s={[0.5, 0.05, 0.5]} c={chairs} />
          <B p={[0, 0.75, s * 0.24]} s={[0.5, 0.6, 0.05]} c={chairs} />
          {[-0.2, 0.2].flatMap((x) => [-0.2, 0.2].map((z) => <B key={`${x}${z}`} p={[x, 0.22, z]} s={[0.04, 0.44, 0.04]} c={chairs} />))}
        </group>
      ))}
    </group>
  )
}

/** The till: the drawer, the little screen, the card machine. */
function Register({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <B p={[0, 0.06, 0]} s={[0.42, 0.12, 0.36]} c="#343a40" />
      <B p={[0, 0.2, -0.1]} s={[0.3, 0.18, 0.04]} c="#1c1c1e" />
      <B p={[0, 0.2, -0.078]} s={[0.25, 0.13, 0.005]} c="#69db7c" glow={0.6} />
      <B p={[0.3, 0.04, 0.08]} s={[0.1, 0.06, 0.16]} c="#495057" />
    </group>
  )
}

const BOUTIQUE_TABLE: XZ = [-4.4, 2.7]

/**
 * The boutique of the quartier: shelves of goods along the back wall, a
 * gondola in the middle, the drinks fridge, the counter with its till and
 * the boutiquier behind it, the credit cards and the cigarettes on the wall
 * behind him, a little table to drink a sucrerie. The line for the till runs
 * from the counter toward the door.
 */
export function boutiqueRoom(): Room {
  const till: Till = { at: { p: [2.3, 0, -0.45], r: Math.PI, pose: 'pay' }, back: [0, 1], door: [1.2, 4.3], side: [-0.9, 0] }
  return {
    floor: '#d8d2c4',
    wall: '#f3e9d2',
    furniture: (
      <>
        <Shelf p={[-4.1, 0, -4.15]} w={2.6} seed={3} />
        <Shelf p={[-1.4, 0, -4.15]} w={2.4} seed={7} />
        <Shelf p={[2.6, 0, -4.15]} w={2.6} h={1.7} seed={11} />
        <Gondola p={[-2.7, 0, 0.1]} w={3.0} seed={17} />
        <Fridge p={[5.0, 0, -3.9]} night={false} />
        {/* The counter, its top, the till; the sweets in jars */}
        <B p={[2.6, 0.5, -1.2]} s={[2.6, 1.0, 0.7]} c="#8a5a2b" />
        <B p={[2.6, 1.02, -1.2]} s={[2.7, 0.04, 0.8]} c="#5c3d22" />
        <Register p={[2.3, 1.04, -1.25]} />
        {[1.6, 1.85].map((x) => (
          <B key={x} p={[x, 1.16, -1.15]} s={[0.18, 0.24, 0.18]} c="#bfe6ff" />
        ))}
        <B p={[3.4, 1.12, -1.2]} s={[0.4, 0.16, 0.3]} c="#ffd43b" />
        <PlasticTable p={[BOUTIQUE_TABLE[0], 0, BOUTIQUE_TABLE[1]]} />
      </>
    ),
    seats: { table: tableSeats([BOUTIQUE_TABLE], 'drink') },
    till,
    spots: {
      // Credit and the like: at the till (or in line for it).
      stall: { ...till.at, pose: 'idle' },
      counter: { ...till.at, pose: 'idle' },
      buy: { p: [-1.4, 0, -3.3], r: Math.PI, pose: 'pick' },
      shelfA: { p: [-4.1, 0, -3.3], r: Math.PI, pose: 'pick' },
      shelfB: { p: [-2.7, 0, 0.95], r: Math.PI, pose: 'pick' },
      fridge: { p: [5.0, 0, -2.85], r: Math.PI, pose: 'pick' },
      aside: { p: [1.0, 0, -0.5], r: Math.PI * 0.8, pose: 'phone' },
      table: { p: [BOUTIQUE_TABLE[0], 0, BOUTIQUE_TABLE[1] + 0.85], r: Math.PI, pose: 'drink' },
      sell: { p: [2.6, 0, -1.95], pose: 'busy' },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
    },
    crowd: [
      // The boutiquier behind his counter, a customer at the shelves.
      { p: [2.4, 0, -1.95], pose: 'busy', g: 'homme', outfit: 'boubou' },
      { p: [-1.4, 0, -3.3], r: Math.PI, pose: 'pick', cycle: ['pick', 'pick', 'idle'] },
    ],
  }
}

/** The ticket number called at the guichet, changing as people are seen. */
function Called() {
  const mesh = useRef<THREE.Mesh>(null)
  const was = useRef(-1)
  useFrame(() => {
    const n = 40 + (Math.floor(worldTime() / 9) % 60)
    if (n === was.current || !mesh.current) return
    was.current = n
    mesh.current.material = labelMat(tr('N° {0} → guichet {1}', { 0: n, 1: 1 + (n % 3) }), '#111418', '#ff6b6b')
  })
  return <mesh ref={mesh} geometry={PLANE} position={[0, 2.55, -4.36]} scale={[1.8, 0.45, 1]} />
}

const WAIT_CHAIRS: V3[] = [-3.4, -2.6, -1.8, -1.0, -0.2].flatMap((x) => [0.6, 1.9].map((z) => [x, 0.04, z] as V3))

/**
 * The mairie's hall (and the like): the long counter with its three
 * guichets behind glass, the clerks, the screen calling the numbers, the
 * ticket machine by the door, the rows of waiting chairs, a desk on the side.
 */
export function mairieRoom(): Room {
  const chairs = WAIT_CHAIRS.flatMap(([x, , z]): [V3, V3, string][] => [
    [[x, 0.44, z], [0.5, 0.06, 0.5], '#2a6f97'],
    [[x, 0.72, z + 0.23], [0.5, 0.5, 0.05], '#2a6f97'],
    [[x, 0.22, z], [0.06, 0.44, 0.06], '#495057'],
  ])
  return {
    floor: '#d5d9e0',
    wall: '#eef1f6',
    furniture: (
      <>
        {/* The counter, its top, the glass between the guichets, their numbers */}
        <B p={[0, 0.55, -3.4]} s={[8.5, 1.1, 0.7]} c="#7a8099" />
        <B p={[0, 1.12, -3.4]} s={[8.6, 0.04, 0.8]} c="#495057" />
        {[-1.5, 1.5].map((x) => (
          <B key={x} p={[x, 1.6, -3.4]} s={[0.05, 0.95, 0.7]} c="#cfe8ff" />
        ))}
        {[-3, 0, 3].map((x, k) => (
          <mesh key={x} geometry={PLANE} material={labelMat(tr('Guichet {0}', { 0: k + 1 }), '#2a6f97', '#ffffff')} position={[x, 2.25, -3.06]} scale={[1.0, 0.3, 1]} />
        ))}
        <Called />
        {/* The ticket machine by the door */}
        <group position={[4.8, 0, 2.7]}>
          <B p={[0, 0.6, 0]} s={[0.45, 1.2, 0.4]} c="#d62828" />
          <B p={[0, 1.05, -0.205]} s={[0.3, 0.18, 0.01]} c="#69db7c" glow={0.5} />
          <B p={[0, 0.85, -0.205]} s={[0.12, 0.02, 0.01]} c="#f8f9fa" />
        </group>
        <Boxes items={chairs} />
        {/* A desk on the side, for the councillors and the work */}
        <group position={[3.6, 0, 0.2]}>
          <B p={[0, 0.72, 0]} s={[1.4, 0.06, 0.7]} c="#b08d57" />
          <B p={[0, 0.36, 0]} s={[1.3, 0.72, 0.06]} c="#8a6a3d" />
          <B p={[0, 0.44, 0.7]} s={[0.5, 0.05, 0.5]} c="#3a3f4b" />
          <Computer />
        </group>
      </>
    ),
    seats: { wait: WAIT_CHAIRS.map((p) => ({ p, r: Math.PI, pose: 'sit' as Pose })) },
    spots: {
      counter: { p: [0, 0, -2.6], r: Math.PI, pose: 'talk' },
      desk: { p: [3.6, 0, 0.9], r: Math.PI, pose: 'write' },
      ticket: { p: [4.8, 0, 2.1], r: 0, pose: 'pick' },
      seat: { p: WAIT_CHAIRS[4], r: Math.PI, pose: 'sit' },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
    },
    crowd: [
      { p: [-3, 0.0, -4.0], pose: 'type', g: 'femme' },
      { p: [0, 0.0, -4.0], pose: 'write', g: 'homme' },
      { p: [3, 0.0, -4.0], pose: 'type', g: 'femme' },
      { p: [-3, 0, -2.6], r: Math.PI, pose: 'talk' },
      { p: [3, 0, -2.6], r: Math.PI, pose: 'rant', cycle: ['talk', 'rant', 'talk'] },
      { p: WAIT_CHAIRS[0], r: Math.PI, pose: 'call' },
      { p: WAIT_CHAIRS[3], r: Math.PI, pose: 'sit' },
      { p: WAIT_CHAIRS[6], r: Math.PI, pose: 'sit' },
      { p: WAIT_CHAIRS[9], r: Math.PI, pose: 'call' },
    ],
  }
}

/** A screen and a keyboard on a desk (its middle at the origin, the chair on +z). */
export function Computer() {
  return (
    <group>
      <B p={[0, 1.0, -0.2]} s={[0.55, 0.34, 0.04]} c="#1c1c1e" />
      <B p={[0, 1.0, -0.178]} s={[0.5, 0.29, 0.005]} c="#74c0fc" glow={0.5} />
      <B p={[0, 0.82, -0.22]} s={[0.06, 0.12, 0.06]} c="#1c1c1e" />
      <B p={[0, 0.765, 0.1]} s={[0.45, 0.02, 0.15]} c="#343a40" />
      <B p={[0.33, 0.762, 0.12]} s={[0.06, 0.02, 0.1]} c="#343a40" />
    </group>
  )
}

/** The film on the big screen: its sky changing scene after scene, the ground, two figures crossing it; its light on the rows. */
function Film() {
  const sky = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4dabf7' }), [])
  const ground = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2b8a3e' }), [])
  const light = useRef<THREE.PointLight>(null)
  const who = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    const k = Math.floor(t / 6)
    const hue = (((k * 0.29) % 1) + 1) % 1
    sky.color.setHSL(hue, 0.55, 0.42 + Math.sin(t * 5) * 0.02)
    ground.color.setHSL((hue + 0.35) % 1, 0.45, 0.25)
    if (light.current) {
      light.current.color.copy(sky.color)
      light.current.intensity = 5 + Math.sin(t * 7.3) * 0.8
    }
    // The two of them walking across, turning back at the edges, one after the other.
    const kids = who.current?.children ?? []
    for (let i = 0; i < kids.length; i++) {
      const u = ((t * 0.12 + i * 0.37 + k * 0.21) % 1) * 2
      kids[i].position.x = (u < 1 ? u : 2 - u) * 5.6 - 2.8
      kids[i].position.y = 1.35 + Math.abs(Math.sin(t * 6 + i)) * 0.05 + i * 0.1
    }
  })
  return (
    <>
      <mesh geometry={PLANE} material={sky} position={[0, 2.5, -4.3]} scale={[7, 2.2, 1]} />
      <mesh geometry={PLANE} material={ground} position={[0, 1.2, -4.3]} scale={[7, 0.6, 1]} />
      <group ref={who} position={[0, 0, -4.29]}>
        {[0, 1].map((i) => (
          <group key={i}>
            <mesh geometry={PLANE} material={mat('#141414')} position={[0, 0.45, 0]} scale={[0.32, 0.9, 1]} />
            <mesh geometry={PLANE} material={mat('#141414')} position={[0, 1.05, 0]} scale={[0.28, 0.28, 1]} />
          </group>
        ))}
      </group>
      <pointLight ref={light} position={[0, 2, -2.5]} distance={11} decay={1.4} />
    </>
  )
}

const CINE_ROWS = [-1.3, 0.2, 1.7]
const CINE_X = [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6]
const CINE_SEATS: V3[] = CINE_ROWS.flatMap((z) => CINE_X.map((x) => [x, 0.04, z] as V3))

/**
 * The cinema hall: in the dark, the film lit on the big screen, rows of red
 * seats with their backs and armrests (aisles either side), people in some
 * of them with their popcorn.
 */
export function cinemaRoom(): Room {
  const parts = CINE_ROWS.flatMap((z): [V3, V3, string][] => [
    ...CINE_X.flatMap((x): [V3, V3, string][] => [
      [[x, 0.42, z], [0.56, 0.12, 0.5], '#b3122e'],
      [[x, 0.78, z + 0.26], [0.56, 0.62, 0.1], '#c92a3e'],
    ]),
    ...[...CINE_X.map((x) => x - 0.6), CINE_X[CINE_X.length - 1] + 0.6].map((x): [V3, V3, string] => [[x, 0.55, z + 0.02], [0.07, 0.3, 0.5], '#1c1c1e']),
    [[0, 0.18, z], [CINE_X.length * 1.2, 0.36, 0.4], '#3a1a22'],
  ])
  const r = seeded(29)
  const crowd: Spot[] = []
  CINE_SEATS.forEach((p, i) => {
    if (i % 3 === 1 || r() < 0.55) return
    const pop = r() < 0.5
    crowd.push({ p, r: Math.PI, pose: pop ? 'eat' : 'sit', cycle: pop ? ['sit', 'sit', 'eat'] : ['sit', 'sit', 'sit', 'drink'], serve: pop ? 'popcorn' : undefined })
  })
  return {
    floor: '#3a2430',
    wall: '#1b1424',
    dark: true,
    furniture: (
      <>
        <B p={[0, 2.2, -4.36]} s={[7.4, 3.0, 0.06]} c="#111111" />
        <Film />
        <B p={[0, 0.25, -3.7]} s={[8, 0.5, 0.8]} c="#2b1a22" />
        <Boxes items={parts} />
      </>
    ),
    seats: { seat: CINE_SEATS.map((p) => ({ p, r: Math.PI, pose: 'sit' as Pose })) },
    spots: {
      seat: { p: CINE_SEATS[10], r: Math.PI, pose: 'sit' },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
      counter: { p: [4.8, 0, 2.6], r: Math.PI, pose: 'idle' },
    },
    crowd,
  }
}
