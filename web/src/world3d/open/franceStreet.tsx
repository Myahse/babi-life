import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { NoShadows } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { clearObstacles, setObstacles } from '../obstacles'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'
import { Blocks } from './ruePrincesse'
import { blocksMat, put, type Part } from './kit3d'
import type { At } from './shoreline'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// The street of France (the update « pays-france »; Abidjan's sellers, its stalls, its SOTRA stay home, and New
// York's hydrants and hot-dog carts stay there: OpenWorld). At the corners, the métro's entrances (the green
// railings, the two lamp-posts and their orange globes, the yellow « M »); the green kiosques à journaux with
// their little dome; the colonnes Morris and their posters; the docks of the city's bikes (« Seinevélo », the
// game's own); the cafés' terraces, their round tables and wicker chairs under the awning, people sitting at the
// nearest ones; and on the busy sides a crêpe stand (roast chestnuts in winter), or at Château-Rouge the
// sellers of grilled corn on their shopping trolley, like over there. All in blocks, one draw call a kind.

type Spot = { id: string; at: XZ; rot: number }
const NEAR = 110
const MAX_SELLERS = 3
const MAX_SITTERS = 2

const GREEN = '#2f5a3f'
const GREEN_D = '#244833'

// The métro's entrance, its opening toward +z: the railings on three sides, the two lamp-posts, the sign.
const METRO: Part[] = [
  [-1.4, 0.5, 0, 0.08, 1, 3.2, GREEN],
  [1.4, 0.5, 0, 0.08, 1, 3.2, GREEN],
  [0, 0.5, -1.6, 2.9, 1, 0.08, GREEN],
  [-1.4, 1, 0, 0.12, 0.06, 3.2, GREEN_D],
  [1.4, 1, 0, 0.12, 0.06, 3.2, GREEN_D],
  [0, 1, -1.6, 2.9, 0.06, 0.12, GREEN_D],
  // The stairs going down (dark steps inside the railings).
  [0, 0.04, 0.2, 2.6, 0.08, 2.6, '#3a3a3a'],
  [0, 0.06, 0.6, 2.4, 0.04, 0.4, '#5a5a5a'],
  [0, 0.06, -0.2, 2.4, 0.04, 0.4, '#5a5a5a'],
  // The two Guimard lamp-posts, their orange globes, the arch and the sign between them.
  [-1.4, 1.6, 1.6, 0.12, 3.2, 0.12, GREEN],
  [1.4, 1.6, 1.6, 0.12, 3.2, 0.12, GREEN],
  [-1.4, 3.3, 1.6, 0.34, 0.42, 0.34, '#ff922b'],
  [1.4, 3.3, 1.6, 0.34, 0.42, 0.34, '#ff922b'],
  [0, 2.9, 1.6, 2.7, 0.1, 0.1, GREEN],
  [0, 2.55, 1.6, 1.8, 0.5, 0.08, '#f5f0e1'],
  [0, 2.55, 1.65, 1.6, 0.36, 0.02, '#2f5a3f'],
]
// The « M » on its yellow disc on a mast, beside the entrance.
const M_SIGN: Part[] = [
  [0, 1.6, 0, 0.1, 3.2, 0.1, '#7d8590'],
  [0, 3.4, 0, 0.9, 0.9, 0.08, '#f2c230'],
  [-0.25, 3.4, 0.05, 0.1, 0.56, 0.02, '#1a1a1a'],
  [0.25, 3.4, 0.05, 0.1, 0.56, 0.02, '#1a1a1a'],
  // (The M's V in steps.)
  [-0.17, 3.58, 0.05, 0.1, 0.12, 0.02, '#1a1a1a'],
  [-0.08, 3.46, 0.05, 0.1, 0.12, 0.02, '#1a1a1a'],
  [0, 3.36, 0.05, 0.1, 0.12, 0.02, '#1a1a1a'],
  [0.08, 3.46, 0.05, 0.1, 0.12, 0.02, '#1a1a1a'],
  [0.17, 3.58, 0.05, 0.1, 0.12, 0.02, '#1a1a1a'],
]
// The kiosque à journaux: its green body, the papers hung on its front, the little dome and its finial.
const KIOSQUE: Part[] = [
  [0, 1.2, 0, 2.2, 2.4, 1.8, GREEN],
  [0, 1.1, 0.91, 1.6, 1.4, 0.04, '#f8f9fa'],
  [-0.4, 1.3, 0.94, 0.3, 0.4, 0.02, '#e03131'],
  [0.1, 1.0, 0.94, 0.3, 0.4, 0.02, '#1c7ed6'],
  [0.5, 1.4, 0.94, 0.3, 0.4, 0.02, '#f2c230'],
  [0, 2.5, 0, 2.6, 0.2, 2.2, GREEN_D],
  [0, 2.75, 0, 1.8, 0.3, 1.6, GREEN],
  [0, 3.0, 0, 1.0, 0.2, 0.9, GREEN_D],
  [0, 3.25, 0, 0.14, 0.3, 0.14, '#c9a24a'],
]
// The colonne Morris: the green drum, its posters, the cap.
const MORRIS: Part[] = [
  [0, 1.4, 0, 1.1, 2.8, 1.1, '#e9e2cf'],
  [0, 1.4, 0, 1.12, 2.4, 1.12, '#d9480f', Math.PI / 4],
  [0, 1.5, 0, 1.14, 0.9, 1.14, '#1c7ed6'],
  [0, 0.1, 0, 1.3, 0.2, 1.3, GREEN],
  [0, 2.95, 0, 1.35, 0.3, 1.35, GREEN],
  [0, 3.2, 0, 0.8, 0.3, 0.8, GREEN_D],
]
// A dock of the city's bikes (Seinevélo): the totem, the posts, three bikes in mint and grey.
function bikes(): Part[] {
  const out: Part[] = [
    [-2.4, 0.9, 0, 0.35, 1.8, 0.3, '#5c636a'],
    [-2.4, 1.5, 0.16, 0.26, 0.4, 0.02, '#63e6be'],
  ]
  for (let i = 0; i < 3; i++) {
    const x = -1.2 + i * 1.1
    out.push([x, 0.35, -0.5, 0.14, 0.7, 0.14, '#5c636a'])
    out.push([x, 0.38, 0, 0.06, 0.74, 0.74, '#343a40'], [x, 0.38, 0, 0.08, 0.1, 1.5, '#63e6be'], [x, 0.85, -0.45, 0.4, 0.06, 0.12, '#343a40'], [x, 0.72, 0.35, 0.1, 0.14, 0.32, '#63e6be'])
  }
  return out
}
const BIKES = bikes()
// A café's terrace on the pavement: the awning (red, with its fringe), three round tables, the wicker chairs.
function terrace(awning: string): Part[] {
  const out: Part[] = [
    [0, 2.7, -0.6, 6, 0.12, 2.6, awning],
    [0, 2.5, 0.68, 6, 0.32, 0.04, '#f8f9fa'],
    [-2.9, 1.3, 0.6, 0.08, 2.6, 0.08, '#2b2b2b'],
    [2.9, 1.3, 0.6, 0.08, 2.6, 0.08, '#2b2b2b'],
  ]
  for (const x of [-2, 0, 2]) {
    out.push([x, 0.72, 0, 0.62, 0.05, 0.62, '#d9d9d9'], [x, 0.36, 0, 0.06, 0.72, 0.06, '#2b2b2b'])
    for (const dx of [-0.55, 0.55]) out.push([x + dx, 0.45, 0, 0.42, 0.06, 0.42, '#b08850'], [x + dx * 1.35, 0.75, 0, 0.06, 0.55, 0.42, '#b08850'])
  }
  return out
}
const AWNINGS = ['#9b2226', '#1d3557', '#2f5a3f', '#7b2d26']

/** Whether a thing `hw` × `hd` (half its sides) turned `rot` stands clear at `at`: on no building, in no water, off the carriageway. */
function fits(nav: Nav, [x, z]: XZ, rot: number, hw: number, hd: number) {
  // (Its depth kept to the narrow pavements of Paris: the back may touch a façade.)
  hd = Math.min(hd, 0.6)
  const [c, s] = [Math.cos(rot), Math.sin(rot)]
  for (const [dx, dz] of [
    [0, 0],
    [hw, hd],
    [-hw, hd],
    [hw, -hd],
    [-hw, -hd],
  ]) {
    const p: XZ = [x + dx * c + dz * s, z - dx * s + dz * c]
    if (!nav.walkable(p[0], p[1]) || nav.onStreet(p)) return false
  }
  return true
}

/** Where each thing stands: from the street's crossings and sides, back on the pavement (seeded by place: always the same). */
function layout(nav: Nav) {
  const metros: Spot[] = []
  const kiosques: Spot[] = []
  const morris: Spot[] = []
  const docks: Spot[] = []
  const terraces: (Spot & { awning: string })[] = []
  const sellers: Spot[] = []
  for (const e of nav.edges) {
    if (e.len < 22 || nav.ys[e.a] || nav.ys[e.b]) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
    const off = e.width / 2 + 1.8
    const rot = Math.atan2(ux, uz)
    const h = hash(Math.round(a[0]), Math.round(a[1]), 47)
    const id = `${Math.round(a[0])}:${Math.round(a[1])}`
    const along = (d: number, side: number, extra = 0): XZ => [a[0] + ux * d - uz * (off + extra) * side, a[1] + uz * d + ux * (off + extra) * side]
    const add = (list: Spot[], at: XZ, r: number, hw = 1, hd = 1) => fits(nav, at, r, hw, hd) && list.push({ id, at, rot: r })
    // The métro at the big streets' corners, about one in four; a kiosque, a column, a dock on others.
    if (e.width >= 8 && h < 0.3) add(metros, along(8, 1, 0.6), rot + Math.PI / 2, 1.6, 1.8)
    else if (h > 0.3 && h < 0.36) add(kiosques, along(10, -1, 0.4), rot - Math.PI / 2, 1.3, 1.1)
    else if (h > 0.4 && h < 0.46) add(morris, along(6, 1), 0, 0.7, 0.7)
    else if (h > 0.5 && h < 0.56 && e.len > 30) add(docks, along(14, -1, 0.2), rot, 2.8, 0.9)
    // A café's terrace along the side of a street, about one long one in three (where the pavement has room).
    const k = hash(Math.round(b[0]), Math.round(b[1]), 61)
    if (e.len > 30 && e.width < 16 && k < 0.3) {
      const r = rot + (k < 0.15 ? -Math.PI / 2 : Math.PI / 2)
      const at = along(e.len / 2, k < 0.15 ? 1 : -1, 0.6)
      if (fits(nav, at, r, 3.1, 1.6)) terraces.push({ id: `${id}:t`, at, rot: r, awning: AWNINGS[Math.floor(k * 40) % AWNINGS.length] })
    }
    if (e.len > 40 && e.width < 14 && k > 0.92) add(sellers, along(e.len / 2, -1, -0.6), rot, 1.1, 1.4)
  }
  return { metros, kiosques, morris, docks, terraces, sellers }
}

function Street({ nav, list }: { nav: Nav; list: { spot: Spot; parts: Part[] }[] }) {
  const mat = useMemo(() => blocksMat(), [])
  const at = useMemo(() => {
    const out: At[] = []
    for (const { spot, parts } of list) put(out, [spot.at[0], spot.at[1], spot.rot], parts, nav.heightAt(spot.at[0], spot.at[1]))
    return out
  }, [nav, list])
  if (!at.length) return null
  return <Blocks at={at} material={mat} color />
}

/** A seller on the pavement: crêpes (chestnuts in winter), or at Château-Rouge the grilled corn on its trolley. */
function Seller({ spot, corn, y }: { spot: Spot; corn: boolean; y: number }) {
  const who = useMemo(() => {
    const r = rng(`vendeur-fr:${spot.id}`)
    const gender: 'femme' | 'homme' = corn ? 'homme' : r() < 0.5 ? 'femme' : 'homme'
    return { gender, look: randomLook(gender, r), seed: r() * 100 }
  }, [spot.id, corn])
  const winter = [11, 12, 1, 2].includes(new Date().getMonth() + 1)
  const [cry, setCry] = useState(false)
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1) return
    tick.current = 0
    const k = (worldTime() + hash(spot.at[0], spot.at[1], 9) * 30) % 30
    setCry(k < 4)
  })
  const mat = useMemo(() => blocksMat(), [])
  const at = useMemo(() => {
    const out: At[] = []
    if (corn)
      put(out, [0, 0, 0], [
        // The trolley, the grill on it, the cobs, the embers.
        [0, 0.5, 0, 0.6, 0.8, 0.45, '#8a8f98'],
        [0, 0.15, 0.3, 0.5, 0.06, 0.06, '#333'],
        [0, 0.95, 0, 0.7, 0.08, 0.5, '#333'],
        [0, 0.92, 0, 0.6, 0.04, 0.4, '#e8590c'],
        [-0.15, 1.02, 0, 0.12, 0.1, 0.4, '#f2c230'],
        [0.1, 1.02, 0, 0.12, 0.1, 0.4, '#e9b72f'],
      ])
    else
      put(out, [0, 0, 0], [
        // The crêpe stand: its counter, the two hot plates, the sign, its little roof.
        [0, 0.55, 0, 1.8, 1.1, 0.9, '#f1e3c8'],
        [0, 0.55, 0.46, 1.8, 0.3, 0.02, '#1d3557'],
        [-0.4, 1.12, 0, 0.5, 0.04, 0.5, '#333'],
        [0.4, 1.12, 0, 0.5, 0.04, 0.5, '#333'],
        [0, 2.2, 0, 2.1, 0.12, 1.2, '#9b2226'],
        [-0.95, 1.65, -0.4, 0.06, 1.1, 0.06, '#555'],
        [0.95, 1.65, -0.4, 0.06, 1.1, 0.06, '#555'],
      ])
    return out
  }, [corn])
  const said = corn ? tr('Maïs chaud, maïs !') : winter ? tr('Chauds les marrons, chauds !') : tr('Crêpes, gaufres, tout chaud !')
  return (
    <group position={[spot.at[0], y, spot.at[1]]} rotation={[0, spot.rot, 0]}>
      <NoShadows>
        <Blocks at={at} material={mat} color />
      </NoShadows>
      <group position={[0, 0, corn ? -0.6 : -0.9]}>
        <TalkHuman id={`vendeur-fr:${spot.id}`} look={who.look} gender={who.gender} pose={corn ? 'cook' : 'idle'} seed={who.seed} />
      </group>
      {cry && (
        <Html position={[0, 2.9, -0.8]} center distanceFactor={14} zIndexRange={[20, 0]}>
          <div className="pointer-events-none rounded-full bg-white px-3 py-1 text-sm font-extrabold whitespace-nowrap text-black shadow">{said}</div>
        </Html>
      )}
    </group>
  )
}

/** People sitting at a terrace's tables (the two nearest the Sim): a coffee, a chat. */
function Sitters({ spot, y }: { spot: Spot; y: number }) {
  const who = useMemo(() => {
    const r = rng(`terrasse:${spot.id}`)
    return [0, 1].map((i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100, x: i ? 1.45 : -0.55, pose: (i ? 'drink' : 'sit') as 'drink' | 'sit', ry: i ? -Math.PI / 2 : Math.PI / 2 }
    })
  }, [spot.id])
  return (
    <group position={[spot.at[0], y, spot.at[1]]} rotation={[0, spot.rot, 0]}>
      {who.map((p, i) => (
        <group key={i} position={[p.x, 0, 0]} rotation={[0, p.ry, 0]}>
          <TalkHuman id={`terrasse:${spot.id}:${i}`} look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
        </group>
      ))}
    </group>
  )
}

export function FranceStreet({ nav, chateauRouge }: { nav: Nav; /** The diaspora's Paris: the corn sellers. */ chateauRouge: boolean }) {
  const l = useMemo(() => layout(nav), [nav])
  const list = useMemo(
    () => [
      ...l.metros.flatMap((s) => [
        { spot: s, parts: METRO },
        { spot: { ...s, at: [s.at[0] + Math.cos(s.rot) * 2.4, s.at[1] - Math.sin(s.rot) * 2.4] as XZ }, parts: M_SIGN },
      ]),
      ...l.kiosques.map((s) => ({ spot: s, parts: KIOSQUE })),
      ...l.morris.map((s) => ({ spot: s, parts: MORRIS })),
      ...l.docks.map((s) => ({ spot: s, parts: BIKES })),
      ...l.terraces.map((s) => ({ spot: s, parts: terrace(s.awning) })),
    ],
    [l],
  )
  useEffect(() => {
    setObstacles('france-street', [
      ...l.metros.map((s) => ({ x: s.at[0], z: s.at[1], r: 1.8 })),
      ...l.kiosques.map((s) => ({ x: s.at[0], z: s.at[1], r: 1.4 })),
      ...l.morris.map((s) => ({ x: s.at[0], z: s.at[1], r: 0.8 })),
      ...l.sellers.map((s) => ({ x: s.at[0], z: s.at[1], r: 1.1 })),
    ])
    return () => clearObstacles('france-street')
  }, [l])
  const [near, setNear] = useState<{ sellers: Spot[]; sitters: Spot[] }>({ sellers: [], sitters: [] })
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const closest = (all: Spot[], n: number) =>
      all
        .map((c) => ({ c, d: Math.hypot(c.at[0] - sx, c.at[1] - sz) }))
        .filter((x) => x.d < NEAR)
        .sort((a, b) => a.d - b.d)
        .slice(0, n)
        .map((x) => x.c)
    const next = { sellers: closest(l.sellers, MAX_SELLERS), sitters: closest(l.terraces, MAX_SITTERS) }
    if ([...next.sellers, ...next.sitters].map((c) => c.id).join() !== [...near.sellers, ...near.sitters].map((c) => c.id).join()) setNear(next)
    // In development, for tests in the browser: what stands in the street.
    if (import.meta.env.DEV) Object.assign(globalThis, { __france: { metros: l.metros.length, kiosques: l.kiosques.length, morris: l.morris.length, docks: l.docks.length, terraces: l.terraces.length, sellers: l.sellers.length, all: { metros: l.metros.map((m) => m.at), terraces: l.terraces.map((m) => m.at), sellers: l.sellers.map((m) => m.at), kiosques: l.kiosques.map((m) => m.at) }, sim: [sx, sz] } })
  })
  return (
    <>
      <Street nav={nav} list={list} />
      {near.sellers.map((s) => (
        <Seller key={s.id} spot={s} corn={chateauRouge} y={nav.heightAt(s.at[0], s.at[1])} />
      ))}
      {near.sitters.map((s) => (
        <Sitters key={s.id} spot={s} y={nav.heightAt(s.at[0], s.at[1])} />
      ))}
    </>
  )
}
