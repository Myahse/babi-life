import type { XZ } from '../../open/geo'
import type { Area, Building, Road } from '../../open/tiles'

// Mon quartier's ground as its owner shaped it (update « mon-quartier », backend game/terrain.go): cells of CELL
// metres counted from the world's middle (cell x covers x·8 to x·8+8 m east, y the same south), each a road, water
// dug, a bridge over water, a tree, or the ground cleared. Laid over the generated world (gen.ts) before it's cut
// into chunks, so the view from high up, the street, its traffic and its passers-by all have it: the roads are town
// streets (asphalt, pavements, kerbs) joined to the world's own where they meet, a road over water is a bridge, the
// water has its ripples and its foam; where the owner built, cleared or dug, the world's houses and trees go. Never
// on the lots, the home or the places, never across the world's own streets (water, a tree, clearing), never past
// where one may walk.

export const CELL = 8
export const HALF = 80
export type Tile = 'r' | 'e' | 'p' | 'a' | '.'
const TILES = new Set<string>(['r', 'e', 'p', 'a', '.'])

/** The ground read from its text (« x,y,t;… »): cell key « x,y » → tile. */
export function parseTerrain(s: string | undefined): Map<string, Tile> {
  const out = new Map<string, Tile>()
  for (const part of (s ?? '').split(';')) {
    const [x, y, t] = part.split(',')
    if (t && TILES.has(t) && Number.isInteger(+x) && Number.isInteger(+y)) out.set(`${+x},${+y}`, t as Tile)
  }
  return out
}

/** A short sign of the ground, for the keys the built chunks and views are kept under. */
export function terrainKey(s: string | undefined) {
  if (!s) return ''
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

export const cellCenter = (x: number, y: number): XZ => [(x + 0.5) * CELL, (y + 0.5) * CELL]
export const cellOf = (p: XZ): [number, number] => [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL)]

/** What the world needs looked at to know where the owner may build (gen.ts's own world). */
export type TerrainWorld = { roads: Road[]; clear: { at: XZ; r: number }[] }

const segDist = (p: XZ, a: XZ, b: XZ) => {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t))
}

/**
 * Why a cell can't take a tile ('' when it can): off the ground one may walk (`inside`), on a lot, the home or a
 * place, or (water, a tree, clearing) across one of the world's own streets (a road meets them, it doesn't cut them).
 */
export function terrainBlocked(w: TerrainWorld, inside: (p: XZ) => boolean, x: number, y: number, tile: Tile): '' | 'edge' | 'lot' | 'street' {
  if (x < -HALF || y < -HALF || x >= HALF || y >= HALF) return 'edge'
  const c = cellCenter(x, y)
  if (!inside(c)) return 'edge'
  if (w.clear.some((k) => Math.hypot(k.at[0] - c[0], k.at[1] - c[1]) < k.r + CELL * 0.6)) return 'lot'
  if (tile !== 'r' && tile !== 'p')
    for (const rd of w.roads) {
      for (let i = 1; i < rd.pts.length; i++) if (segDist(c, rd.pts[i - 1], rd.pts[i]) < rd.width / 2 + CELL * 0.45) return 'street'
    }
  return ''
}

type World = { roads: Road[]; buildings: Building[]; areas: Area[]; trees: XZ[]; palms: XZ[] }

/** The ground laid over the world (in place): its streets, its water, its trees; the world's houses and trees gone from it. */
export function applyTerrain(u: World, keep: TerrainWorld, terrain: string | undefined, inside: (p: XZ) => boolean, inWater: (p: XZ) => boolean, knot: (roads: Road[]) => void) {
  const all = parseTerrain(terrain)
  if (!all.size) return
  // Only what may stand where it is (the world may have changed under an old ground: a lot moved). (Looked at
  // against the world's own streets, before any of the ground's is laid.)
  const cells = new Map<string, Tile>()
  for (const [k, t] of all) {
    const [x, y] = k.split(',').map(Number)
    if (!terrainBlocked(keep, inside, x, y, t)) cells.set(k, t)
  }
  if (!cells.size) return
  const at = (x: number, y: number) => cells.get(`${x},${y}`)
  const isRoad = (t?: Tile) => t === 'r' || t === 'p'
  const wet = (x: number, y: number) => at(x, y) === 'e' || at(x, y) === 'p' || (isRoad(at(x, y)) && inWater(cellCenter(x, y)))

  // What stood there goes: the world's houses and trees on every cell shaped.
  const shaped = (p: XZ) => cells.has(`${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`)
  u.buildings = u.buildings.filter((b) => !shaped(b.c) && !b.ring.some(shaped))
  u.trees = u.trees.filter((p) => !shaped(p))
  u.palms = u.palms.filter((p) => !shaped(p))

  // The streets: each straight run of road cells, across and down, cut where it goes over water (a bridge). Each
  // piece reaches past its end cells' edges a little, into the street it meets, and is joined to it (knot).
  const keys = [...cells.keys()].map((k) => k.split(',').map(Number) as [number, number])
  const xs = keys.map((k) => k[0])
  const ys = keys.map((k) => k[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const added: Road[] = []
  const lay = (run: [number, number][], dx: number, dy: number) => {
    let piece: [number, number][] = []
    const out = (p: [number, number][]) => {
      if (!p.length) return
      const bridge = wet(...p[0])
      const pts = p.map(([x, y]) => cellCenter(x, y))
      const ext = CELL / 2 + (bridge ? 0 : 3)
      const [f, l] = [pts[0], pts[pts.length - 1]]
      pts.unshift([f[0] - dx * ext, f[1] - dy * ext])
      pts.push([l[0] + dx * ext, l[1] + dy * ext])
      added.push({ cls: 'street', pts, width: 6, paved: true, bridge })
    }
    for (const c of run) {
      if (piece.length && wet(...piece[piece.length - 1]) !== wet(...c)) (out(piece), (piece = []))
      piece.push(c)
    }
    out(piece)
  }
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ]) {
    const [aFrom, aTo, bFrom, bTo] = dx ? [y0, y1, x0, x1] : [x0, x1, y0, y1]
    for (let a = aFrom; a <= aTo; a++) {
      let run: [number, number][] = []
      for (let b = bFrom; b <= bTo + 1; b++) {
        const [x, y] = dx ? [b, a] : [a, b]
        if (b <= bTo && isRoad(at(x, y))) run.push([x, y])
        else {
          // A lone cell: drawn by its run the other way, or across when it has none.
          const lone = run.length === 1
          const other = lone && (dx ? isRoad(at(run[0][0], run[0][1] - 1)) || isRoad(at(run[0][0], run[0][1] + 1)) : true)
          if (run.length > 1 || (lone && !other)) lay(run, dx, dy)
          run = []
        }
      }
    }
  }
  if (added.length) {
    u.roads.push(...added)
    knot(u.roads)
  }

  // The water dug: the cells of a row side by side as one stretch, a sandy bank round it.
  const rect = (y: number, a: number, b: number): XZ[] => [
    [a * CELL, y * CELL],
    [(b + 1) * CELL, y * CELL],
    [(b + 1) * CELL, (y + 1) * CELL],
    [a * CELL, (y + 1) * CELL],
  ]
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    let start: number | null = null
    let kind: 'water' | 'sand' | null = null
    for (let x = x0 - 1; x <= x1 + 2; x++) {
      const t = at(x, y)
      const k: 'water' | 'sand' | null =
        x > x1 + 1 ? null : t === 'e' || t === 'p' ? 'water' : !isRoad(t) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(x + a, y + b) === 'e' || at(x + a, y + b) === 'p') ? 'sand' : null
      if (k !== kind) {
        if (kind && start !== null) u.areas.push({ kind, rings: [rect(y, start, x - 1)] })
        start = x
        kind = k
      }
    }
  }

  // The trees planted: one or two a cell, palms by the water.
  for (const k of keys) {
    if (at(...k) !== 'a') continue
    const [cx, cz] = cellCenter(...k)
    const h = Math.abs(Math.imul(k[0] * 73856093, 1) ^ Math.imul(k[1] * 19349663, 1))
    const byWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(k[0] + a, k[1] + b) === 'e') || inWater([cx, cz])
    const n = 1 + (h % 2)
    for (let i = 0; i < n; i++) {
      const p: XZ = [cx + (((h >> (3 + i * 4)) % 9) - 4) * 0.6, cz + (((h >> (5 + i * 4)) % 9) - 4) * 0.6]
      ;(byWater || (h >> 9) % 3 === 0 ? u.palms : u.trees).push(p)
    }
  }
}
