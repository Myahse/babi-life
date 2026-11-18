import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { weakDevice } from '../../lib/device'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { Vehicle } from '../vehicles'
import { Grin } from '../open/streetlife'
import type { Lot } from '../layout'
import type { XZ } from '../open/geo'
import { useQuartierWorld } from './store'

// « Mon quartier »'s places lived in (update « mon-quartier »): the world's market, its maquis, its shops and the
// player's own buildings have their people, as many as the hour brings. The market's stalls in rows with their
// sellers behind them and the customers going from one to the next; the boutique's shopkeeper at the door and
// people coming for rice, oil, credit; the salon's client in the chair under the awning, the next one waiting;
// the pharmacy's queue; the schoolchildren in the yard at recess; the salle des fêtes full on the weekend; the grin's
// old men at their tea; the gbaka at its stop and the people waiting for it; the street lamps lit at night. (The
// maquis's terrace and its customers, the pitch and its players are the street's own: dressing.tsx, field.tsx.)
//
// Each place's things are one instanced mesh (a draw); its people are drawn only within NEAR of the Sim, fewer
// on a weak phone. Local frames as the street's: the place's door at the origin, +z to the street (PlaceSign's,
// dressing.tsx), or for an open-air one (the market) its middle, +z to the street.

/** Within this of the Sim (m), a place's people are drawn; its stalls and benches always. */
const NEAR = 110
/** The share of people kept on a weak phone. */
const WEAK = 0.5

type Who = { gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number }
function cast(seed: string, n: number, women = 0.5, kids = false): Who[] {
  const r = rng(seed)
  return [...Array(n)].map(() => {
    const gender: 'femme' | 'homme' = r() < women ? 'femme' : 'homme'
    const look = randomLook(gender, r)
    return { gender, look: kids ? { ...look, outfit: r() < 0.6 ? 'uniforme' : look.outfit } : look, seed: r() * 100 }
  })
}

/** How busy a kind of place is at an hour (0 shut, 1 packed), the week's day (0 Monday) for the school and the feasts. */
export function busyAt(kind: string, h: number, day = 0): number {
  const weekend = day >= 5
  switch (kind) {
    case 'market':
      return h < 5.5 || h >= 20 ? 0 : h < 7 ? 0.5 : h < 12 ? 1 : h < 15 ? 0.7 : h < 18 ? 0.85 : 0.4
    case 'boutique':
      return h < 6.5 || h >= 22.5 ? 0 : h < 9 ? 0.7 : h < 12 ? 0.5 : h < 16 ? 0.45 : h < 20 ? 0.9 : 0.5
    case 'salon':
    case 'barbier':
      return h < 8 || h >= 21 ? 0 : h < 11 ? 0.5 : h < 17 ? 0.8 : 1
    case 'pharmacie':
      return h < 7.5 ? 0.15 : h < 21 ? 0.6 : 0.25
    case 'school':
    case 'creche':
      return weekend ? 0 : (h >= 7 && h < 12) || (h >= 14.5 && h < 17) ? 1 : (h >= 12 && h < 14.5) || (h >= 17 && h < 18) ? 0.4 : 0
    case 'club':
      return weekend ? (h >= 14 && h < 24 ? 1 : h < 2 ? 0.6 : 0) : h >= 20 || h < 1 ? 0.35 : 0
    case 'grin':
      return h < 7 ? 0.15 : h < 12 ? 0.55 : h < 16 ? 0.7 : h < 23 ? 1 : 0.4
    case 'gbaka':
      return h < 5 || h >= 22 ? 0 : (h >= 6 && h < 9) || (h >= 17 && h < 20) ? 1 : 0.5
    default:
      return 0
  }
}

/** Boxes of one material as one instanced mesh, each its own colour. */
type Part = { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }
const BOX = new THREE.BoxGeometry(1, 1, 1)
const LAMBERT = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const GLOW = new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false })
function Parts({ parts, glow = false }: { parts: Part[]; glow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    parts.forEach((x, i) => {
      o.position.set(...x.p)
      o.rotation.set(0, x.r ?? 0, 0)
      o.scale.set(...x.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, col.set(x.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [parts])
  if (!parts.length) return null
  return <instancedMesh ref={ref} args={[BOX, glow ? GLOW : LAMBERT, parts.length]} castShadow={!glow} receiveShadow={!glow} />
}

/** Whether the Sim is within reach of a point of the world (looked at once a second). */
function useNear(at: XZ, r = NEAR) {
  const [near, setNear] = useState(false)
  const t = useRef(10)
  useFrame((_, dt) => {
    t.current += dt
    if (t.current < 1) return
    t.current = 0
    const n = Math.hypot(at[0] - whereabouts.sim[0], at[1] - whereabouts.sim[1]) < r
    if (n !== near) setNear(n)
  })
  return near
}

/** Someone walking to and fro between two points (local metres), on their own pace; the pose switches at the ends. */
function Stroller({ who, a, b, speed = 0.9, stop = 3, phase = 0, pose = 'idle' }: { who: Who; a: XZ; b: XZ; speed?: number; stop?: number; phase?: number; pose?: Pose }) {
  const g = useRef<THREE.Group>(null)
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const walkT = len / speed
  const loop = (walkT + stop) * 2
  const [walking, setWalking] = useState(true)
  const t = useRef(phase * loop)
  useFrame((_, dt) => {
    t.current = (t.current + Math.min(dt, 0.1)) % loop
    const k = t.current
    // There, a stop, back, a stop.
    const leg = k < walkT ? k / walkT : k < walkT + stop ? 1 : k < walkT * 2 + stop ? 1 - (k - walkT - stop) / walkT : 0
    const back = k >= walkT + stop && k < loop - stop
    const moving = k < walkT || (k >= walkT + stop && k < walkT * 2 + stop)
    const m = g.current
    if (m) {
      m.position.set(a[0] + (b[0] - a[0]) * leg, 0, a[1] + (b[1] - a[1]) * leg)
      m.rotation.y = moving ? Math.atan2((b[0] - a[0]) * (back ? -1 : 1), (b[1] - a[1]) * (back ? -1 : 1)) : m.rotation.y
    }
    if (moving !== walking) setWalking(moving)
  })
  return (
    <group ref={g}>
      <Human look={who.look} gender={who.gender} pose={walking ? 'walk' : pose} speed={speed} seed={who.seed} />
    </group>
  )
}

function Seated({ who, p, r = 0, pose = 'sit' }: { who: Who; p: [number, number, number]; r?: number; pose?: Pose }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Human look={who.look} gender={who.gender} pose={pose} seed={who.seed} />
    </group>
  )
}

const CLOTH = ['#e8432f', '#1f6fb5', '#f2a81d', '#2e8b57', '#f4f4f4', '#8e44ad', '#ff7a00']
const GOODS = ['#e74c3c', '#f1c40f', '#27ae60', '#e67e22', '#8d5524', '#ecf0f1', '#c0392b', '#7fb800']

/** The market: rows of stalls under their parasols, a seller at each, customers in the aisles. `big`: the world's market square, else a lot's. */
function Market({ id, big, h, day, weak }: { id: string; big: boolean; h: number; day: number; weak: boolean }) {
  const [rows, cols] = big ? [3, 5] : [2, 3]
  const stalls = useMemo(() => {
    const r = rng(`marche${id}`)
    const out: { x: number; z: number; top: string; goods: string[]; face: number }[] = []
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) out.push({ x: (j - (cols - 1) / 2) * (big ? 7 : 5), z: (i - (rows - 1) / 2) * (big ? 8.5 : 6.5), top: CLOTH[Math.floor(r() * CLOTH.length)], goods: [0, 1, 2, 3].map(() => GOODS[Math.floor(r() * GOODS.length)]), face: i % 2 ? Math.PI : 0 })
    return out
  }, [id, rows, cols, big])
  const parts = useMemo(() => {
    const out: Part[] = []
    for (const s of stalls) {
      const [c, sn] = [Math.cos(s.face), Math.sin(s.face)]
      const at = (x: number, y: number, z: number): [number, number, number] => [s.x + x * c + z * sn, y, s.z - x * sn + z * c]
      // The table, its legs, the goods in heaps and basins, the parasol's pole and its sheet, the seller's stool.
      out.push({ p: at(0, 0.8, 0), s: [2.2, 0.08, 1.1], c: '#8a5a32', r: s.face })
      for (const x of [-1, 1]) out.push({ p: at(x, 0.4, 0), s: [0.08, 0.8, 0.9], c: '#5c3b1f', r: s.face })
      s.goods.forEach((g, k) => out.push({ p: at(-0.75 + k * 0.5, 0.94, (k % 2) * 0.2 - 0.1), s: [0.42, 0.2, 0.42], c: g, r: s.face }))
      out.push({ p: at(0, 1.45, -0.7), s: [0.07, 2.9, 0.07], c: '#6b6b6b' })
      out.push({ p: at(0, 2.85, 0), s: [2.8, 0.06, 2], c: s.top, r: s.face })
      out.push({ p: at(0, 0.22, -1.05), s: [0.4, 0.44, 0.4], c: '#3b6fb5' })
      out.push({ p: at(0.9, 0.15, 0.85), s: [0.6, 0.3, 0.6], c: '#d9d2c5' })
    }
    return out
  }, [stalls])
  const fill = busyAt('market', h, day) * (weak ? WEAK : 1)
  const sellers = useMemo(() => cast(`vendeuses${id}`, stalls.length, 0.85), [id, stalls.length])
  const buyers = useMemo(() => cast(`clients${id}`, big ? 14 : 6, 0.65), [id, big])
  const shown = Math.round(buyers.length * fill)
  const aisle = big ? 4.25 : 3.25
  return (
    <group>
      <Parts parts={parts} />
      {fill > 0 && (
        <NoShadows>
          {stalls.map((s, i) => {
            if (i / stalls.length >= Math.max(fill, 0.5)) return null
            const [c, sn] = [Math.cos(s.face), Math.sin(s.face)]
            return <Seated key={i} who={sellers[i]} p={[s.x - 1.0 * sn, 0, s.z - 1.0 * c]} r={s.face} pose={i % 3 === 0 ? 'busy' : 'sit'} />
          })}
          {buyers.slice(0, shown).map((w, i) => {
            const row = i % Math.max(1, rows - 1)
            const z = (row - (rows - 2) / 2) * (big ? 8.5 : 6.5) * (rows > 1 ? 1 : 0) + (rows > 1 ? 0 : aisle)
            const span = ((cols - 1) / 2) * (big ? 7 : 5) + 1
            return i % 3 === 2 ? (
              <Seated key={i} who={w} p={[(((i * 7) % (cols * 2)) / (cols * 2) - 0.5) * span * 2, 0, z + 0.9]} r={Math.PI} pose={i % 2 ? 'talk' : 'idle'} />
            ) : (
              <Stroller key={i} who={w} a={[-span, z + (i % 2 ? 0.5 : -0.5)]} b={[span, z + (i % 2 ? 0.5 : -0.5)]} speed={0.7 + (i % 4) * 0.08} stop={2.5 + (i % 3)} phase={i / shown} pose="talk" />
            )
          })}
        </NoShadows>
      )}
    </group>
  )
}

/** The boutique: the shopkeeper at the door, people coming and going with their shopping. */
function Boutique({ id, h, weak }: { id: string; h: number; weak: boolean }) {
  const fill = busyAt('boutique', h) * (weak ? WEAK : 1)
  const people = useMemo(() => cast(`boutique${id}`, 4, 0.6), [id])
  if (fill <= 0) return null
  const n = Math.max(1, Math.round(3 * fill))
  return (
    <NoShadows>
      <Seated who={people[0]} p={[-1.6, 0, 0.9]} r={0.4} pose="idle" />
      {people.slice(1, 1 + n).map((w, i) => (i === 0 ? <Seated key={i} who={w} p={[0.2, 0, 1.4]} r={Math.PI} pose="talk" /> : <Stroller key={i} who={w} a={[0.6 * i, 1.2]} b={[6 + i * 2, 3.2 + i * 0.6]} speed={1} stop={4} phase={i * 0.37} pose="phone" />))}
    </NoShadows>
  )
}

/** The salon (or the barber): a client in the chair outside, the hairdresser at work behind, the next one waiting. */
function Salon({ id, h, weak, barber }: { id: string; h: number; weak: boolean; barber: boolean }) {
  const fill = busyAt('salon', h) * (weak ? WEAK : 1)
  const people = useMemo(() => cast(`salon${id}`, 3, barber ? 0.1 : 0.9), [id, barber])
  if (fill <= 0) return null
  return (
    <NoShadows>
      <Seated who={people[0]} p={[-0.9, 0, 1.4]} r={Math.PI} pose="sit" />
      <Seated who={{ ...people[1], gender: barber ? 'homme' : 'femme' }} p={[-0.9, 0, 0.75]} r={Math.PI} pose="busy" />
      {fill > 0.6 && <Seated who={people[2]} p={[0.9, 0, 1.45]} r={Math.PI} pose="phone" />}
    </NoShadows>
  )
}

/** The pharmacy: a few people waiting their turn at the door. */
function Queue({ id, h, kind, weak }: { id: string; h: number; kind: string; weak: boolean }) {
  const fill = busyAt(kind, h) * (weak ? WEAK : 1)
  const people = useMemo(() => cast(`file${id}`, 3, 0.6), [id])
  const n = Math.round(3 * fill)
  if (!n) return null
  return (
    <NoShadows>
      {people.slice(0, n).map((w, i) => (
        <Seated key={i} who={w} p={[1.2 + i * 0.1, 0, 1.0 + i * 0.85]} r={Math.PI + (i % 2 ? 0.3 : -0.2)} pose={i ? 'phone' : 'idle'} />
      ))}
    </NoShadows>
  )
}

/** The schoolyard: the children running and playing at recess, the teacher watching. */
function School({ id, h, day, weak, big }: { id: string; h: number; day: number; weak: boolean; big: boolean }) {
  const fill = busyAt('school', h, day) * (weak ? WEAK : 1)
  const kids = useMemo(() => cast(`ecole${id}`, big ? 10 : 6, 0.5, true), [id, big])
  if (fill <= 0) return null
  const n = Math.round(kids.length * fill)
  const w = big ? 14 : 5
  return (
    <NoShadows>
      <group scale={0.62}>
        {kids.slice(0, n).map((k, i) => (
          <Stroller key={i} who={k} a={[-w + ((i * 5) % (w * 2)), 4 + (i % 3) * 2.2]} b={[w - ((i * 3) % (w * 2)), 6 + ((i + 1) % 3) * 2.2]} speed={2.2 + (i % 3) * 0.4} stop={1 + (i % 2)} phase={i / n} pose={i % 2 ? 'cheer' : 'talk'} />
        ))}
      </group>
      <Seated who={{ ...kids[0], gender: 'femme', look: { ...kids[0].look, outfit: 'pagne' } }} p={[-2, 0, 2]} r={Math.PI * 0.8} pose="talk" />
    </NoShadows>
  )
}

/** The salle des fêtes on a feast: the guests on their chairs, the dancers in front, the DJ's speakers. */
function Fete({ id, h, day, weak }: { id: string; h: number; day: number; weak: boolean }) {
  const fill = busyAt('club', h, day) * (weak ? WEAK : 1)
  const people = useMemo(() => cast(`fete${id}`, 12, 0.6), [id])
  const parts = useMemo<Part[]>(() => {
    const out: Part[] = []
    for (let i = 0; i < 8; i++) out.push({ p: [-5 + (i % 4) * 1.1, 0.45, 2.2 + Math.floor(i / 4) * 1.3], s: [0.45, 0.06, 0.45], c: i % 2 ? '#f4f4f4' : '#e8432f' })
    out.push({ p: [5.6, 0.7, 2.6], s: [0.7, 1.4, 0.6], c: '#141416' }, { p: [5.6, 0.7, 4.6], s: [0.7, 1.4, 0.6], c: '#141416' }, { p: [0, 2.9, 3.2], s: [13, 0.08, 4.6], c: '#f7d26b' })
    return out
  }, [])
  if (fill <= 0) return null
  const n = Math.round(people.length * fill)
  return (
    <group>
      <Parts parts={parts} />
      <NoShadows>
        {people.slice(0, n).map((w, i) => (i < 8 ? <Seated key={i} who={w} p={[-5 + (i % 4) * 1.1, 0, 2.2 + Math.floor(i / 4) * 1.3]} r={Math.PI / 2} pose={i % 3 ? 'sit' : 'drink'} /> : <Seated key={i} who={w} p={[1 + (i - 8) * 1.2, 0, 3 + (i % 2) * 1.2]} r={(i * 1.7) % 6} pose="dance" />))}
      </NoShadows>
    </group>
  )
}

/** The gbaka stop: its shelter, the bench, a gbaka waiting with its apprenti, people waiting at the busy hours. */
function GbakaStop({ id, h, weak }: { id: string; h: number; weak: boolean }) {
  const fill = busyAt('gbaka', h) * (weak ? WEAK : 1)
  const people = useMemo(() => cast(`gbaka${id}`, 5, 0.55), [id])
  const parts = useMemo<Part[]>(
    () => [
      { p: [0, 2.6, 0], s: [6, 0.12, 2.4], c: '#2f7d4f' },
      ...[-2.8, 2.8].flatMap((x): Part[] => [
        { p: [x, 1.3, -0.9], s: [0.12, 2.6, 0.12], c: '#d9d9d9' },
        { p: [x, 1.3, 0.9], s: [0.12, 2.6, 0.12], c: '#d9d9d9' },
      ]),
      { p: [0, 0.45, -0.7], s: [4.6, 0.08, 0.5], c: '#8a5a32' },
      { p: [0, 1.4, -1.1], s: [5.6, 1.6, 0.06], c: '#f2a81d' },
    ],
    [],
  )
  const n = Math.round(people.length * fill)
  return (
    <group>
      <Parts parts={parts} />
      {fill > 0 && <Vehicle p={[0, 0, 4.2]} r={Math.PI / 2} kind="gbaka" seed={id.length} />}
      <NoShadows>{people.slice(0, n).map((w, i) => (i < 3 ? <Seated key={i} who={w} p={[-1.6 + i * 1.5, 0, -0.65]} pose={i % 2 ? 'phone' : 'sit'} /> : <Seated key={i} who={w} p={[-1 + i * 0.7, 0, 1.3]} r={Math.PI * 0.1 * i} pose="idle" />))}</NoShadows>
    </group>
  )
}

/** The street lamps the player put up along its street: lit at night. */
function Lamps({ night }: { night: boolean }) {
  const poles = useMemo<Part[]>(
    () =>
      [-6, 0, 6].flatMap((x): Part[] => [
        { p: [x, 2.6, 0], s: [0.14, 5.2, 0.14], c: '#5a5f66' },
        { p: [x, 5.15, 0.45], s: [0.12, 0.12, 0.9], c: '#5a5f66' },
      ]),
    [],
  )
  const heads = useMemo<Part[]>(() => [-6, 0, 6].map((x): Part => ({ p: [x, 5.02, 0.85], s: [0.45, 0.14, 0.3], c: night ? '#fff3c4' : '#e8e4d8' })), [night])
  return (
    <group>
      <Parts parts={poles} />
      <Parts parts={heads} glow={night} />
    </group>
  )
}

/** A place in the street's frame: its door at the origin (a building's), or its middle (in the open), +z to the street. */
function frameOf(l: Lot, open: boolean): { p: [number, number, number]; r: number } {
  if (open) return { p: [l.x, 0, l.z], r: l.rot }
  const [dx, dz] = [Math.sin(l.rot), Math.cos(l.rot)]
  return { p: [l.door[0] - dx * 1.15, 0, l.door[1] - dz * 1.15], r: l.rot }
}

function PlaceLife({ lot, h, day, night, weak }: { lot: Lot; h: number; day: number; night: boolean; weak: boolean }) {
  const open = !lot.height
  const near = useNear([lot.x, lot.z])
  const big = Math.hypot(lot.door[0] - lot.x, lot.door[1] - lot.z) > 12
  const f = frameOf(lot, open)
  let body: React.ReactNode = null
  if (lot.kind === 'market' && open)
    return (
      <group position={f.p} rotation={[0, f.r, 0]}>
        {<MarketLife id={lot.id} big={big} h={h} day={day} weak={weak} near={near} />}
      </group>
    )
  if (lot.kind === 'grin' && open)
    return (
      <group position={f.p} rotation={[0, f.r, 0]}>
        <GrinSpot id={lot.id} h={h} near={near} />
      </group>
    )
  if (!near) return null
  if (lot.kind === 'boutique' || lot.kind === 'couture') body = <Boutique id={lot.id} h={h} weak={weak} />
  else if (lot.kind === 'salon' || lot.kind === 'barbier') body = <Salon id={lot.id} h={h} weak={weak} barber={lot.kind === 'barbier'} />
  else if (lot.kind === 'pharmacie' || lot.kind === 'health') body = <Queue id={lot.id} h={h} kind="pharmacie" weak={weak} />
  else if (lot.kind === 'school' || lot.kind === 'creche') body = <School id={lot.id} h={h} day={day} weak={weak} big={big} />
  else if (lot.kind === 'club') body = <Fete id={lot.id} h={h} day={day} weak={weak} />
  void night
  return body ? (
    <group position={f.p} rotation={[0, f.r, 0]}>
      {body}
    </group>
  ) : null
}

/** The market's stalls always (they're the place), its people near the Sim only. */
function MarketLife({ id, big, h, day, weak, near }: { id: string; big: boolean; h: number; day: number; weak: boolean; near: boolean }) {
  return <Market id={id} big={big} h={near ? h : 3} day={day} weak={weak} />
}

/** What the player built that isn't a place of the street's (the grin, the gbaka stop, the lamps), on its lot. */
function OpenAir({ kind, at, street, id, h, night, weak }: { kind: string; at: XZ; street: XZ; id: string; h: number; night: boolean; weak: boolean }) {
  const near = useNear(at)
  const r = Math.atan2(street[0] - at[0], street[1] - at[1])
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, r, 0]}>
      {kind === 'grin' && <GrinSpot id={id} h={h} near={near} />}
      {kind === 'gbaka' && <group position={[0, 0, 3.5]}>{near ? <GbakaStop id={id} h={h} weak={weak} /> : <GbakaStop id={id} h={3} weak={weak} />}</group>}
      {kind === 'eclairage' && (
        <group position={[0, 0, 8.4]}>
          <Lamps night={night} />
        </group>
      )}
    </group>
  )
}
/** The grin: its tree always, its old men at their tea when the Sim is near and the hour brings them. */
function GrinSpot({ id, h, near }: { id: string; h: number; near: boolean }) {
  return (
    <group>
      <Parts parts={GRIN_TREE} />
      {near && busyAt('grin', h) > 0.3 && (
        <group position={[0, 0, 2]}>
          <Grin seed={`grin${id}`} />
        </group>
      )}
    </group>
  )
}
/** The grin's tree, its shade over the benches. */
const GRIN_TREE: Part[] = [
  { p: [-2.2, 1.6, -1.5], s: [0.45, 3.2, 0.45], c: '#6b4a2b' },
  { p: [-2.2, 3.6, -1.5], s: [4.2, 1.4, 4.2], c: '#2f7d32' },
  { p: [-2.2, 4.5, -1.5], s: [2.8, 0.9, 2.8], c: '#3c8d3f' },
]

/** Every place of the quartier's world lived in, and the player's open-air buildings. */
export function QuartierLife({ lots, hour, day, night, light }: { lots: Lot[]; hour: number; day: number; night: boolean; light: boolean }) {
  const univ = useQuartierWorld((q) => (q.active && q.scene === 'lot' ? q.univ : null))
  const built = useQuartierWorld((q) => q.built)
  const weak = light || weakDevice
  const places = useMemo(() => lots.filter((l) => !l.field && !l.child && !l.station && l.kind !== 'home' && l.kind !== 'soiree'), [lots])
  const open = useMemo(() => (univ ? built.filter((b) => b.lot >= 0 && (b.kind === 'grin' || b.kind === 'gbaka' || b.kind === 'eclairage') && univ.lots[b.lot]) : []), [built, univ])
  if (!univ) return null
  return (
    <>
      {places.map((l) => (
        <PlaceLife key={l.id} lot={l} h={hour} day={day} night={night} weak={weak} />
      ))}
      {open.map((b) => (
        <OpenAir key={`${b.lot}${b.kind}`} kind={b.kind} at={univ.lots[b.lot].at} street={univ.lots[b.lot].street} id={`${b.lot}`} h={hour} night={night} weak={weak} />
      ))}
    </>
  )
}
