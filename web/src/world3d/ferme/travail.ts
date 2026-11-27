import type { Pose } from '../../avatar/Human'
import { fermeNow } from '../../lib/ferme'
import type { LandmarkRoute } from '../open/landmarkSpots'
import { FERME_LANDMARKS } from './fermeLandmarks'

// Le travail aux champs, joué en 3D (the update « agriculture »; backend sims/fermeTravail.go): each act of the
// hands at the plot is the Sim's timed action « ferme-<act> ». Here: the pose it's done in (avatar/ferme.ts, the
// crop deciding the harvest's: the pods picked, the régimes cut, the yams dug up), and where in the village plot
// (FermeLandmark.tsx's layout) it's done: along the rows of the Sim's own field, at the pen of the beasts, at the
// claie; the herd led round the fields. The Walker walks it (open/landmarkSpots.ts's ways).

type XZ = [number, number]

/** The Sim's field in the plot's frame (FermeLandmark.tsx): its middle, its size, its rows (along z). */
export const FIELD = { x: -7, z: -3, w: 9, d: 7, rows: 7 }
/** The two pens (in front, each side of the path in) and their size; the claies; the well. */
export const PENS: XZ[] = [
  [-14.5, 6],
  [14.5, 6],
]
export const PEN = { w: 5, d: 4.4 }
export const CLAIE: XZ = [-16, -12]

/** How long each act takes on screen (seconds: the server's minutes made real, game.Length). */
const SECS: Record<string, number> = { defricher: 180, labourer: 180, semer: 120, arroser: 60, desherber: 120, traiter: 60, recolter: 180, transformer: 60, nourrir: 60, abreuver: 60, oeufs: 60, traire: 60, paturage: 240 }

/** The row i's x in the plot's frame. */
export const rowX = (i: number) => FIELD.x - FIELD.w / 2 + (FIELD.w / FIELD.rows) * (i + 0.5)

/** The pose of a farm action: the act's, the crop's for the harvest, the motoculteur pushed. */
export function fermePose(id: string | undefined): Pose | undefined {
  if (!id?.startsWith('ferme-')) return undefined
  const w = fermeNow().work
  switch (id.slice(6)) {
    case 'defricher':
      return 'machette'
    case 'labourer':
      return w?.hire ? 'push' : 'daba'
    case 'semer':
      return 'semer'
    case 'arroser':
      return 'arroser'
    case 'desherber':
      return 'desherber'
    case 'traiter':
      return 'traiter'
    case 'recolter':
      switch (w?.crop) {
        case 'banane':
        case 'palmier':
          return 'couper'
        case 'igname':
          return 'daba'
        case 'manioc':
        case 'riz':
          return 'arracher'
        case 'tomate':
        case 'piment':
        case 'aubergine':
        case 'gombo':
        case 'anacarde':
        case 'karite':
          return 'desherber'
      }
      return 'cueillir'
    case 'transformer':
      return 'etaler'
    case 'nourrir':
      return 'nourrir'
    case 'abreuver':
      return 'abreuver'
    case 'oeufs':
      return 'oeufs'
    case 'traire':
      return 'traire'
    case 'paturage':
      return 'mener'
    case 'arrivee':
      return 'idle'
  }
  return undefined
}

/** Along the rows of the field: in at the front of the first, down it and up the next…, `stops` along each, the whole in `secs`. */
function rows(secs: number, per: number, rot?: number): LandmarkRoute {
  const way: XZ[] = []
  // (A stretch of each row near its front: the Sim at work more than walking; every row done in turn.)
  const front = FIELD.z + FIELD.d / 2 - 0.6
  const back = front - Math.min(FIELD.d - 1, per * 1.4)
  // From the row by the path (the field's right, +x) to the far one: the rows done show from that side.
  for (let n = 0; n < FIELD.rows; n++) {
    const i = FIELD.rows - 1 - n
    for (let j = 0; j < per; j++) {
      const k = per === 1 ? 0 : j / (per - 1)
      const z = n % 2 ? back + (front - back) * k : front - (front - back) * k
      // (Between two rows, a little to the side of the one worked.)
      way.push([rowX(i) - 0.45, z])
    }
  }
  const speed = 0.9
  let len = 0
  for (let i = 1; i < way.length; i++) len += Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1])
  const each = Math.max(2, (secs - len / speed) / way.length)
  const stops: LandmarkRoute['stops'] = {}
  way.forEach((_, i) => {
    // Facing along the row (the way it goes), or the given way.
    const down = Math.floor(i / per) % 2 === 0
    stops[i] = { rot: rot ?? (down ? Math.PI : 0), pose: 'busy', secs: each }
  })
  return { entry: [FIELD.x + FIELD.w / 2 + 0.6, FIELD.z + FIELD.d / 2 + 0.8], way, speed, stops, loop: true }
}

/** Over the bush, here and there with the machette, from the path's side. */
function bush(secs: number): LandmarkRoute {
  const way: XZ[] = [
    [-10.5, 0],
    [-8.2, -0.6],
    [-5.4, 0],
    [-3.6, -2.2],
    [-6.2, -2.8],
    [-9.4, -3.2],
    [-10.6, -5.6],
    [-7.4, -5.8],
    [-4.2, -5.4],
  ].reverse() as XZ[]
  const stops: LandmarkRoute['stops'] = {}
  way.forEach((_, i) => (stops[i] = { rot: Math.PI + (i % 3) * 0.5 - 0.5, pose: 'busy', secs: secs / way.length - 2.5 }))
  return { entry: [-2, 1.5], way, speed: 1, stops, loop: true }
}

/** Round the fields with the herd, a stop now and then to let it graze. */
function herd(pen: XZ): LandmarkRoute {
  const side = pen[0] < 0 ? -1 : 1
  const way: XZ[] = [
    [pen[0], pen[1] + PEN.d / 2 + 1],
    [side * 19, 2],
    [side * 19, -17],
    [0, -20],
    [-side * 10, -19],
    [0, -17.5],
    [side * 18.5, -9],
  ]
  const stops: LandmarkRoute['stops'] = { 2: { rot: Math.PI, pose: 'busy', secs: 30 }, 3: { rot: 0, pose: 'busy', secs: 40 }, 4: { rot: 0, pose: 'busy', secs: 30 }, 6: { rot: side * -Math.PI / 2, pose: 'busy', secs: 20 } }
  return { way, speed: 0.8, stops, loop: true }
}

/** The pen of a kind at the plot (which of the two, as FermeLandmark draws them). */
export function penIndex(offre: string, kind?: string) {
  const plot = fermeNow().ferme?.plots.find((p) => p.offre === offre)
  const i = plot?.pens?.findIndex((e) => e.kind === kind) ?? -1
  return Math.max(0, Math.min(1, i))
}

const routes = new Map<string, LandmarkRoute | null>()

/** The way through the plot a farm action takes (null: done at one spot). */
export function fermeRouteFor(place: string, act: string): LandmarkRoute | undefined {
  if (!(place in FERME_LANDMARKS) || !act.startsWith('ferme-')) return undefined
  const w = fermeNow().work
  const pen = PENS[penIndex(place.slice(6), w?.kind)]
  const key = `${place}:${act}:${w?.hire ? 1 : 0}:${pen[0]}:${w?.kind}`
  if (!routes.has(key)) {
    const a = act.slice(6)
    const secs = (w?.hire && (a === 'defricher' || a === 'labourer') ? 0.5 : 1) * (SECS[a] ?? 60)
    routes.set(
      key,
      a === 'nourrir' || a === 'abreuver' || a === 'oeufs' || a === 'traire' || a === 'transformer' ? spotRoute(place, a, w?.kind) : a === 'defricher' ? bush(secs) : a === 'labourer' || a === 'desherber' || a === 'recolter' ? rows(secs, 2) : a === 'semer' ? rows(secs, 2) : a === 'arroser' || a === 'traiter' ? rows(secs, 1) : a === 'paturage' ? herd(pen) : null,
    )
  }
  return routes.get(key) ?? undefined
}

/**
 * The place a farm action done at one spot is done at (the pen, the coop, the claie): a way of one point, in by
 * the pen's gate (the streets' paths don't reach inside the plot's ground: a spot walked to by them stopped short).
 */
function oneSpot(at: XZ, rot: number, entry: XZ): LandmarkRoute {
  return { entry, way: [at], speed: 1, stops: { 0: { rot, pose: 'busy', secs: 600 } } }
}
function spotRoute(place: string, a: string, kind?: string): LandmarkRoute | null {
  const [px, pz] = PENS[penIndex(place.slice(6), kind)]
  const gate: XZ = [px, pz + PEN.d / 2 + 0.8]
  switch (a) {
    case 'nourrir':
      return oneSpot([px, pz + 0.9], Math.PI, gate)
    case 'abreuver':
      return oneSpot([px + 1.6, pz + 0.9], 0, gate)
    case 'oeufs':
      return oneSpot([px - PEN.w / 2 + 0.8, pz - PEN.d / 2 + 2.1], Math.PI, gate)
    case 'traire':
      return oneSpot([px + 0.6, pz + 0.2], -Math.PI / 2, gate)
    case 'transformer':
      return oneSpot([CLAIE[0] + 1.5, CLAIE[1]], -Math.PI / 2, [-12.5, -8])
  }
  return null
}

