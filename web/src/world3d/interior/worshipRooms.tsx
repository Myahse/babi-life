import { Box } from '../props'
import type { Pose } from '../../avatar/Human'
import type { Room, Spot } from '../Interior'

// Inside a place of worship, by its faith (backend game/faith.go): the
// mosque's prayer hall (the carpet in rows toward the mihrab, the minbar, the
// shoes left at the door), the temple of the evangelicals and the Methodists
// (the stage with its pulpit, the drums, the keyboard and the speakers, rows
// of plastic chairs), the parish church (pews either side of the aisle, the
// altar, the crucifix, the Virgin, the candles). Full during its service
// (the Friday prayer, the mass, the culte, the veillée), a few people otherwise.
// The room is the interiors' 12 × 9 m: -z the front (the mihrab, the stage, the altar), +z the door.

type V3 = [number, number, number]

/** A stop on the visit's way round: where, and what to turn to and look at (and take a photo of). */
export type TourStop = { at: [number, number]; face?: [number, number] }

/**
 * « Visiter »: the way round the room by its free aisles (not through the
 * pews, the chairs, the faithful), stopping before what's worth seeing: the
 * altar and the Virgin and the windows, the mihrab and the minbar and the
 * books, the stage and its drums and keyboard. Round and round while it lasts.
 */
export function worshipTour(faith: string): TourStop[] {
  if (faith === 'musulman')
    return [
      { at: [0, 3.3], face: [0, -4] },
      { at: [-2.6, 1.8] },
      { at: [-4.6, -0.4], face: [-5.6, -2] },
      { at: [-3.5, -2.7], face: [-3.5, -3.6] },
      { at: [-1.4, -2.6], face: [0, -4.35] },
      { at: [3.4, -2.2], face: [2.2, -3.6] },
      { at: [4.6, 0.6] },
      { at: [2.4, 2.6] },
    ]
  if (faith === 'catholique')
    return [
      { at: [0, 3.3], face: [0, -4] },
      { at: [0, -2.6], face: [0, -4.4] },
      { at: [-3.6, -2.7], face: [-5, -3.4] },
      { at: [-5.35, -1.2] },
      { at: [-5.35, 3.3] },
      { at: [5.35, 3.3] },
      { at: [5.35, -1.2] },
      { at: [3.8, -2.7], face: [4, -4.4] },
      { at: [0, -2.6] },
    ]
  return [
    { at: [0, 3.3], face: [0, -4] },
    { at: [0, -1.9], face: [0, -3.6] },
    { at: [-2.6, -2.0], face: [-3, -3.8] },
    { at: [-5.35, -1.6] },
    { at: [-5.35, 3.3] },
    { at: [5.35, 3.3] },
    { at: [5.35, -1.6] },
    { at: [2.8, -2.0], face: [2.8, -3.5] },
    { at: [0, -1.9] },
  ]
}

/** The activities that are a service: the room is full. */
export const SERVICES = new Set(['messe', 'messe-matin', 'culte', 'veillee', 'priere-vendredi'])

/** The visits that go round the room (the generic one, and the towns' own: their guide walks with the Sim). */
export const TOUR_VISITS = new Set(['visit', 'sp-cathedrale-visite', 'korhogo-mosquee-visite', 'mosquee-yakro-visite', 'daloa-cathedrale-visite', 'daloa-mosquee-visite'])

/** Who shows the Sim round on these visits: the imam, the priest. */
export const TOUR_GUIDE: Record<string, { outfit: string; g: 'homme' }> = {
  'korhogo-mosquee': { outfit: 'imam', g: 'homme' },
  'yakro-mosquee': { outfit: 'imam', g: 'homme' },
  'sp-cathedrale': { outfit: 'soutane', g: 'homme' },
  'daloa-cathedrale': { outfit: 'soutane', g: 'homme' },
  'daloa-mosquee': { outfit: 'imam', g: 'homme' },
}

export function worshipRoom(faith: string, full: boolean, placeId?: string, guided = false): Room {
  const base = faith === 'musulman' ? mosque(full) : faith === 'catholique' ? parish(full) : temple(full, faith)
  const own = placeId ? PLACE_ROOMS[placeId] : undefined
  if (!own) return base
  const r = own(base)
  // The one who guides the visit isn't at the front too.
  return guided ? { ...r, crowd: r.crowd.filter((c) => c.outfit !== TOUR_GUIDE[placeId!]?.outfit || Math.abs(c.p[0]) > 0.5) } : r
}

/**
 * The towns' own (the updates « yakro-vivant », « sanpedro-vivant », « korhogo-vivant »): the room of their
 * faith, dressed as theirs. Korhogo's great mosque: the earth walls and their torons, the forest of earthen
 * pillars, the woven mats on the sand-coloured floor, the small high windows. Yamoussoukro's: white, the
 * Moroccan zellige round the walls, the wrought doors, the chandelier. San-Pédro's cathedral: Saint Peter
 * with his keys, the window of the fisherman's boat over the altar, the pirogue and its net laid before it.
 */
const PLACE_ROOMS: Record<string, (r: Room) => Room> = {
  'korhogo-mosquee': (r) => ({
    ...r,
    floor: '#c9a87a',
    wall: '#d6b384',
    furniture: (
      <>
        {r.furniture}
        {/* The mats over the carpet's rows, woven in bands */}
        {[-2.8, -1.6, -0.4, 0.8, 2.0, 3.2].map((z, i) => (
          <Box key={z} p={[0, 0.035, z]} s={[11.2, 0.02, 1.0]} c={i % 2 ? '#b8925a' : '#d1ab6e'} />
        ))}
        {/* The earthen pillars, two rows of three */}
        {[-3, 0, 3].flatMap((x) => [-1.0, 1.4].map((z) => <Box key={`${x}${z}`} p={[x, 1.6, z]} s={[0.55, 3.2, 0.55]} c="#c9a273" />))}
        {/* The torons along the back wall, the small high windows */}
        {[-5, -3, -1, 1, 3, 5].map((x) => (
          <Box key={`t${x}`} p={[x, 2.6, -4.3]} s={[0.1, 0.1, 0.4]} c="#6b4a2a" />
        ))}
        {[-4.5, -2.5, 2.5, 4.5].map((x) => (
          <Box key={`w${x}`} p={[x, 2.9, -4.42]} s={[0.4, 0.4, 0.05]} c="#ffe9b0" glow={0.6} />
        ))}
      </>
    ),
  }),
  'yakro-mosquee': (r) => ({
    ...r,
    wall: '#f7f5ef',
    furniture: (
      <>
        {r.furniture}
        {/* The zellige round the walls, green and blue squares */}
        {[...Array(12)].map((_, i) => (
          <Box key={`z${i}`} p={[-5.5 + i, 0.5, -4.43]} s={[1, 1, 0.04]} c={i % 2 ? '#2f7f8a' : '#3a9a5a'} />
        ))}
        {[-5.95, 5.95].flatMap((x) => [...Array(8)].map((_, i) => <Box key={`s${x}${i}`} p={[x, 0.5, -3.5 + i]} s={[0.04, 1, 1]} c={i % 2 ? '#2f7f8a' : '#3a9a5a'} />))}
        {/* The chandelier, its lights */}
        <Box p={[0, 3.3, 0]} s={[0.05, 1.2, 0.05]} c="#c9a14a" />
        <Box p={[0, 2.7, 0]} s={[1.4, 0.12, 1.4]} c="#c9a14a" />
        {[-0.6, 0.6].flatMap((x) => [-0.6, 0.6].map((z) => <Box key={`l${x}${z}`} p={[x, 2.85, z]} s={[0.12, 0.18, 0.12]} c="#fff3c0" glow={0.9} />))}
      </>
    ),
  }),
  'sp-cathedrale': (r) => ({
    ...r,
    wall: '#f2f5f8',
    furniture: (
      <>
        {r.furniture}
        {/* Over the altar, the window of the boat on the sea */}
        <Box p={[0, 3.5, -4.39]} s={[2.4, 1.2, 0.04]} c="#2a6fd6" glow={0.35} />
        <Box p={[0, 3.25, -4.36]} s={[1.2, 0.2, 0.04]} c="#8a4a1a" />
        <Box p={[0.1, 3.6, -4.36]} s={[0.06, 0.6, 0.04]} c="#f4f1e6" />
        {/* Saint Peter on his plinth, his key raised */}
        <Box p={[5, 0.4, -3.4]} s={[0.7, 0.8, 0.7]} c="#d9d2c3" />
        <Box p={[5, 1.3, -3.4]} s={[0.4, 1, 0.3]} c="#e9e2cf" />
        <Box p={[5, 1.9, -3.4]} s={[0.2, 0.2, 0.2]} c="#f1d9b5" />
        <Box p={[5.25, 1.75, -3.25]} s={[0.08, 0.35, 0.05]} c="#d9b34a" />
        {/* The pirogue and its net laid before the altar's step (the fishermen's offering) */}
        <Box p={[-2.2, 0.15, -2.75]} s={[1.6, 0.3, 0.45]} c="#1c7ed6" />
        <Box p={[-2.2, 0.31, -2.75]} s={[1.5, 0.04, 0.4]} c="#f0b429" />
        <Box p={[-1.3, 0.05, -2.6]} s={[0.6, 0.06, 0.6]} c="#6b8f6a" />
      </>
    ),
  }),
}

function mosque(full: boolean): Room {
  // The rows of the faithful, shoulder to shoulder behind the imam.
  const rows: Spot[] = []
  const lines = full ? 4 : 1
  for (let row = 0; row < lines; row++)
    for (let k = 0; k < (full ? 9 : 3); k++) {
      const p: V3 = [(k - (full ? 4 : 1)) * 0.95, 0, -1.6 + row * 1.2]
      // The Sim's place in the second row is left for it.
      if (Math.hypot(p[0] - 1.9, p[2] + 0.4) > 0.5) rows.push({ p, r: Math.PI, pose: 'salat', g: 'homme', outfit: k % 2 ? 'boubou' : 'imam' })
    }
  return {
    floor: '#8a2430',
    wall: '#f4efe2',
    furniture: (
      <>
        {/* The carpet's prayer rows, green and red */}
        {[-2.8, -1.6, -0.4, 0.8, 2.0, 3.2].map((z, i) => (
          <Box key={z} p={[0, 0.015, z]} s={[11.4, 0.03, 1.1]} c={i % 2 ? '#1f6f4a' : '#a52a36'} />
        ))}
        {/* The mihrab in the middle of the wall toward Mecca, the minbar beside it */}
        <Box p={[-0.85, 1.5, -4.35]} s={[0.35, 3, 0.25]} c="#1f8a4c" />
        <Box p={[0.85, 1.5, -4.35]} s={[0.35, 3, 0.25]} c="#1f8a4c" />
        <Box p={[0, 3.05, -4.35]} s={[2.05, 0.4, 0.25]} c="#c9a14a" />
        <Box p={[0, 1.4, -4.42]} s={[1.35, 2.8, 0.06]} c="#145c37" />
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} p={[2.2, 0.2 * (i + 1), -3.4 - i * 0.25]} s={[0.9, 0.4 * (i + 1), 0.5]} c="#6b4426" />
        ))}
        <Box p={[2.65, 1.3, -3.9]} s={[0.06, 1.8, 1.5]} c="#6b4426" />
        {/* The Quran stands, the shelf of books, the shoes at the door */}
        {[-3.8, -3.2].map((x) => (
          <Box key={x} p={[x, 0.18, -3.6]} s={[0.4, 0.36, 0.3]} c="#7a4b2a" />
        ))}
        <Box p={[-5.6, 1, -2]} s={[0.4, 2, 2.4]} c="#7a4b2a" />
        <Box p={[4.5, 0.35, 3.9]} s={[2.2, 0.7, 0.4]} c="#5a3a20" />
        {[...Array(6)].map((_, i) => (
          <Box key={i} p={[3.6 + i * 0.35, 0.74, 3.9]} s={[0.22, 0.08, 0.32]} c={['#1b1b1f', '#8a5a32', '#e8e4dc'][i % 3]} />
        ))}
      </>
    ),
    spots: {
      seat: { p: [1.9, 0, -0.4], r: Math.PI, pose: 'salat' },
      floor: { p: [1.9, 0, -0.4], r: Math.PI, pose: 'salat' },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
      counter: { p: [-1.2, 0, 1.2], r: Math.PI, pose: 'idle' },
    },
    crowd: [
      // The imam at the mihrab.
      { p: [0, 0, -3.5], r: Math.PI, pose: 'salat', g: 'homme', outfit: 'imam' },
      ...rows,
      // Women pray at the back, apart.
      ...(full ? [-4.4, -3.5, -2.6].map((x): Spot => ({ p: [x, 0, 3.1], r: Math.PI, pose: 'salat', g: 'femme', outfit: 'abaya' })) : []),
    ],
  }
}

function temple(full: boolean, faith: string): Room {
  // The plastic chairs, in rows facing the stage, an aisle down the middle.
  const chairs: V3[] = []
  for (let row = 0; row < 4; row++) for (const x of [-4.4, -3.4, -2.4, -1.4, 1.4, 2.4, 3.4, 4.4]) chairs.push([x, 0, -1 + row * 1.25])
  const seated = full ? chairs : chairs.filter((_, i) => i % 5 === 1)
  const sing: Pose = 'cheer'
  return {
    floor: '#d8d2c4',
    wall: faith === 'protestant' ? '#f3efe6' : '#fbf7ef',
    furniture: (
      <>
        {/* The stage: its carpet, the pulpit, the drums, the keyboard, the speakers; the banner over it */}
        <Box p={[0, 0.25, -3.6]} s={[9, 0.5, 1.7]} c="#2d4f9e" />
        <Box p={[0, 0.95, -3.3]} s={[0.9, 0.9, 0.55]} c={faith === 'protestant' ? '#6b4426' : '#e8e4dc'} />
        <Box p={[-3, 0.85, -3.8]} s={[0.6, 0.6, 0.6]} c="#a52a36" />
        <Box p={[-2.5, 1.0, -3.6]} s={[0.4, 0.3, 0.4]} c="#a52a36" />
        <Box p={[-3.5, 1.2, -3.5]} s={[0.5, 0.05, 0.5]} c="#d4a017" />
        <Box p={[2.8, 1.3, -3.5]} s={[1.3, 0.1, 0.45]} c="#1b1b1f" />
        <Box p={[2.8, 0.9, -3.5]} s={[0.1, 0.8, 0.1]} c="#1b1b1f" />
        {[-4.3, 4.3].map((x) => (
          <Box key={x} p={[x, 1.2, -3.9]} s={[0.6, 1.4, 0.5]} c="#141416" />
        ))}
        <Box p={[0, 2.6, -4.38]} s={[5, 0.7, 0.05]} c="#d4a017" />
        <Box p={[0, 2.6, -4.35]} s={[4.4, 0.36, 0.05]} c="#2d4f9e" />
        {faith === 'protestant' && <Box p={[0, 2.0, -4.36]} s={[0.12, 1.2, 0.05]} c="#ffffff" />}
        {chairs.map((p, i) => (
          <group key={i} position={p}>
            <Box p={[0, 0.42, 0]} s={[0.46, 0.06, 0.46]} c="#f4f4f2" />
            <Box p={[0, 0.72, 0.21]} s={[0.46, 0.55, 0.05]} c="#f4f4f2" />
          </group>
        ))}
      </>
    ),
    spots: {
      seat: { p: [1.4, 0.05, 0.25], r: Math.PI, pose: 'sit' },
      floor: { p: [0, 0, 1.6], r: Math.PI, pose: sing },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
      counter: { p: [0, 0, 2.4], r: Math.PI, pose: 'idle' },
    },
    crowd: [
      // The pastor at the pulpit, facing everyone; the choir and the drummer when it's on.
      { p: [0, 0.5, -2.85], pose: full ? 'rant' : 'idle', g: 'homme', outfit: 'suit' },
      ...(full
        ? ([
            { p: [-3, 0.5, -3.1], pose: 'busy', g: 'homme' },
            { p: [1.6, 0.5, -3.3], pose: sing, g: 'femme' },
            { p: [2.2, 0.5, -3.0], pose: sing, g: 'femme' },
          ] satisfies Spot[])
        : []),
      ...seated.filter((p) => !(p[0] === 1.4 && p[2] === 0.25)).map((p, i): Spot => ({ p: [p[0], 0.05, p[2]], r: Math.PI, pose: full && i % 4 === 0 ? sing : 'sit' })),
    ],
  }
}

function parish(full: boolean): Room {
  // The pews either side of the aisle.
  const pews: V3[] = []
  for (let row = 0; row < 4; row++) for (const x of [-3, 3]) pews.push([x, 0, -1 + row * 1.3])
  const seated: Spot[] = pews.flatMap(([x, , z], i) => (full ? [-1.2, 0, 1.2] : i % 3 ? [] : [0.6]).map((dx): Spot => ({ p: [x + dx, 0.05, z - 0.15], r: Math.PI, pose: 'sit' })))
  return {
    floor: '#c9b08a',
    wall: '#f6f1e7',
    furniture: (
      <>
        {/* The sanctuary: the step, the altar and its cloth, the candles, the tabernacle; the crucifix; the stained glass */}
        <Box p={[0, 0.15, -3.7]} s={[7, 0.3, 1.5]} c="#e6dfd0" />
        <Box p={[0, 0.8, -3.6]} s={[2.2, 1, 0.9]} c="#fbfaf6" />
        <Box p={[0, 1.32, -3.6]} s={[2.3, 0.04, 0.95]} c="#f2e6b8" />
        {[-0.8, 0.8].map((x) => (
          <Box key={x} p={[x, 1.5, -3.6]} s={[0.07, 0.3, 0.07]} c="#ffd36b" glow={0.8} />
        ))}
        <Box p={[0, 1.1, -4.3]} s={[0.6, 0.6, 0.3]} c="#c9a14a" />
        <Box p={[0, 2.5, -4.38]} s={[0.22, 2.2, 0.08]} c="#6b4426" />
        <Box p={[0, 3.0, -4.38]} s={[1.3, 0.2, 0.08]} c="#6b4426" />
        <Box p={[0, 2.6, -4.33]} s={[0.2, 0.9, 0.05]} c="#e8cfa6" />
        {[-4, 4].map((x, i) => (
          <Box key={x} p={[x, 2.2, -4.4]} s={[1.1, 1.8, 0.04]} c={i ? '#2f6fb0' : '#b5532c'} glow={0.25} />
        ))}
        {/* The Virgin in her corner, the candles lit before her */}
        <Box p={[-5, 0.4, -3.4]} s={[0.7, 0.8, 0.7]} c="#d9d2c3" />
        <Box p={[-5, 1.3, -3.4]} s={[0.35, 1, 0.3]} c="#5b8fd6" />
        <Box p={[-5, 1.9, -3.4]} s={[0.2, 0.2, 0.2]} c="#f1d9b5" />
        {[...Array(5)].map((_, i) => (
          <Box key={i} p={[-4.6 + (i % 3) * 0.2, 0.86, -2.9 + Math.floor(i / 3) * 0.2]} s={[0.05, 0.12, 0.05]} c="#ffd36b" glow={0.9} />
        ))}
        {pews.map((p, i) => (
          <group key={i} position={p}>
            <Box p={[0, 0.42, 0]} s={[3.6, 0.08, 0.45]} c="#7a5230" />
            <Box p={[0, 0.75, 0.22]} s={[3.6, 0.6, 0.06]} c="#7a5230" />
          </group>
        ))}
      </>
    ),
    spots: {
      seat: { p: [2.4, 0.05, 0.15], r: Math.PI, pose: 'sit' },
      floor: { p: [0, 0, 1.4], r: Math.PI, pose: 'pray' },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
      counter: { p: [-4.2, 0, -2.4], r: Math.PI, pose: 'pray' },
    },
    crowd: [
      // The priest at the altar facing the people, a server beside him.
      { p: [0, 0.3, -4.1], pose: full ? 'pray' : 'idle', g: 'homme', outfit: 'soutane' },
      ...(full ? ([{ p: [1.6, 0.3, -3.9], pose: 'idle', g: 'homme', outfit: 'soutane' }] satisfies Spot[]) : []),
      ...seated.filter((s) => Math.hypot(s.p[0] - 2.4, s.p[2] - 0.15) > 0.7),
    ],
  }
}

/** Where the Sim goes for what it does there: its seat (or its place in the rows), standing for the veillée, by the Virgin or the shelf for a visit. */
export function worshipAction(r: Room, id?: string): { spot: string; pose: Pose } {
  const spot = !id ? 'entrance' : id === 'veillee' ? 'floor' : id === 'visit' ? 'counter' : 'seat'
  return { spot, pose: r.spots[spot].pose }
}
