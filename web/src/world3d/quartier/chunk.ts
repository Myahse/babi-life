// Mon quartier drawn like the streets of Babi (world3d/open): its grid (grid.ts) made into a piece of map,
// the shape the open world builds its streets from (tiles.ts ChunkData). The roads are town streets
// (« tertiary »: asphalt, pavements and kerbs, the dashed middle line, zebra crossings at the junctions,
// the wooden poles and their wires); a road over water is a bridge (its deck rises over the lagoon); the
// lagoon and the water dug have their ripples and their foam, a sandy bank round them; the grass is the
// game's grass; the trees are its trees and palms. The way out carries on south, off the land, to Babi.

import type { ChunkData, Road } from '../open/tiles'
import { bridgeHeights } from '../open/geo'
import { deckTop } from '../open/bridgeNames'
import { joinedEnds } from '../open/bridgeLine'
import { Land, T, seeded, type XZ } from './grid'

/** How wide a street's asphalt is (its pavements add 3.2 m: a cell of 8 m, nearly kerb to kerb). */
const ROAD_W = 5
/** How far the way out goes on, past the land's edge. */
const OUT = 120

const isRoad = (t: string) => t === T.road || t === T.bridge || t === T.gate

export type QuartierMap = {
  chunk: ChunkData
  /** The deck's height over each bridge cell (index → metres): the Sim walks up on it. */
  decks: Map<number, number>
}

/** Rectangles of a row's cells that pass `keep` (from x0 to x1, inclusive), for the areas. */
function rowRuns(land: Land, keep: (t: string) => boolean) {
  const out: { y: number; x0: number; x1: number }[] = []
  for (let y = 0; y < land.size; y++) {
    let start = -1
    for (let x = 0; x <= land.size; x++) {
      const ok = x < land.size && keep(land.at(x, y))
      if (ok && start < 0) start = x
      if (!ok && start >= 0) {
        out.push({ y, x0: start, x1: x - 1 })
        start = -1
      }
    }
  }
  return out
}

export function quartierMap(land: Land): QuartierMap {
  const c = land.cell
  const half = (land.size * c) / 2
  const box = { x0: -half - OUT, z0: -half - OUT, x1: half + OUT, z1: half + OUT }
  const roads: Road[] = []
  const road = (pts: XZ[], bridge: boolean) => roads.push({ cls: 'tertiary', pts, width: ROAD_W, paved: true, bridge })

  // The streets: each straight run of road cells, across and down, cut where it goes over water (a bridge).
  // Each piece reaches the edges of its end cells (a dead end stops at the kerb, a junction meets the cross street,
  // a bridge lands on the road it carries on).
  const runs = (dx: number, dy: number) => {
    for (let a = 0; a < land.size; a++) {
      let cells: [number, number][] = []
      const flush = () => {
        // A lone cell is drawn by its run the other way (or across, if it has none).
        const alone = cells.length === 1 && (dx === 1 ? isRoad(land.at(cells[0][0], cells[0][1] - 1)) || isRoad(land.at(cells[0][0], cells[0][1] + 1)) : true)
        if (cells.length > 1 || (cells.length === 1 && !alone)) {
          // Pieces: on land, over water (the bridge), split where it changes.
          let piece: [number, number][] = [cells[0]]
          const out = (p: [number, number][], last: boolean, first: boolean) => {
            const pts = p.map(([x, y]) => land.center(x, y))
            const bridge = land.at(...p[0]) === T.bridge
            // Out to the cell's edge at the run's two ends (and a bridge's ends onto the land, half a cell).
            const [fx, fz] = pts[0]
            const [lx, lz] = pts[pts.length - 1]
            const ext = c / 2
            void first
            pts.unshift([fx - dx * ext, fz - dy * ext])
            pts.push([lx + dx * ext, lz + dy * ext])
            // The way out: on south, off the land.
            if (last && land.at(...p[p.length - 1]) === T.gate) pts.push([lx + dx * (ext + OUT), lz + dy * (ext + OUT)])
            road(pts, bridge)
          }
          for (let i = 1; i < cells.length; i++) {
            const wasBridge = land.at(...cells[i - 1]) === T.bridge
            const isBridge = land.at(...cells[i]) === T.bridge
            if (wasBridge !== isBridge) {
              out(piece, false, piece[0] === cells[0])
              piece = []
            }
            piece.push(cells[i])
          }
          out(piece, true, piece[0] === cells[0])
        }
        cells = []
      }
      for (let b = 0; b <= land.size; b++) {
        const [x, y] = dx === 1 ? [b, a] : [a, b]
        if (b < land.size && isRoad(land.at(x, y))) cells.push([x, y])
        else flush()
      }
    }
  }
  runs(1, 0)
  runs(0, 1)

  // The ground: the game's grass, a sandy bank along the water, the water itself; the yard stays earth.
  const nearWater = (t: string, x: number, y: number) => t !== T.water && t !== T.bridge && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => land.at(x + a, y + b) === T.water || land.at(x + a, y + b) === T.bridge)
  const rect = (y: number, x0: number, x1: number): XZ[] => {
    const [ax, az] = land.center(x0, y)
    const [bx] = land.center(x1, y)
    return [
      [ax - c / 2, az - c / 2],
      [bx + c / 2, az - c / 2],
      [bx + c / 2, az + c / 2],
      [ax - c / 2, az + c / 2],
    ]
  }
  const areas: ChunkData['areas'] = []
  for (const r of rowRuns(land, (t) => t === T.water || t === T.bridge)) areas.push({ kind: 'water', rings: [rect(r.y, r.x0, r.x1)] })
  // (Sand and grass cell by cell along a row: a bank cell is sand.)
  for (let y = 0; y < land.size; y++) {
    let start = -1
    let kind: 'green' | 'sand' | null = null
    for (let x = 0; x <= land.size; x++) {
      const t = x < land.size ? land.at(x, y) : ''
      const k: 'green' | 'sand' | null = x >= land.size || t === T.water || t === T.bridge || t === T.house ? null : nearWater(t, x, y) ? 'sand' : 'green'
      if (k !== kind) {
        if (kind && start >= 0) areas.push({ kind, rings: [rect(y, start, x - 1)] })
        start = x
        kind = k
      }
    }
  }

  // The trees: a tall tree or two a cell, palms by the water and here and there.
  const rng = seeded(land.size * 31 + land.grid.length)
  const trees: XZ[] = []
  const palms: XZ[] = []
  for (const [x, y] of land.all(T.tree)) {
    const [px, pz] = land.center(x, y)
    const byWater = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]].some(([a, b]) => land.at(x + a, y + b) === T.water)
    const n = 1 + Math.floor(rng() * 2)
    for (let i = 0; i < n; i++) {
      const p: XZ = [px + (rng() - 0.5) * c * 0.6, pz + (rng() - 0.5) * c * 0.6]
      ;(byWater || rng() < 0.3 ? palms : trees).push(p)
    }
  }

  const chunk: ChunkData = { key: 'quartier', tx: 0, ty: 0, box, roads, buildings: [], areas, trees, palms, aeroways: [], pois: [] }

  // The decks' heights over the bridge cells, as the open world raises them.
  const decks = new Map<number, number>()
  const joined = joinedEnds(roads)
  for (const r of roads) {
    if (!r.bridge) continue
    const ys = bridgeHeights(r.pts, box, deckTop(r.cls, r.name), joined)
    r.pts.forEach(([x, z], i) => {
      const cell = land.cellOf(x, z)
      if (cell && land.at(...cell) === T.bridge) decks.set(cell[1] * land.size + cell[0], Math.max(decks.get(cell[1] * land.size + cell[0]) ?? 0, ys[i]))
    })
  }
  return { chunk, decks }
}
