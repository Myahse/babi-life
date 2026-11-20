import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Crest } from '../../lib/types'
import { t as tr } from '../../lib/i18n'

// The family's crest (update « heritage », phase 3, backend game/heritage3.go), built of blocks like the rest of
// the game: the field row by row (a shield's outline or a round one, stepped), its two colours side by side, a
// gold rim behind, and the emblem in raised cubes on top. One merged geometry with vertex colours per crest
// (one draw, cached by the crest): the same crest on the house's plaque, in the ranking, on the profile.

/** The shapes, the emblems and the colours the server accepts (game.CrestShapes, CrestEmblems, CrestColors). */
export const CREST_SHAPES: Crest['shape'][] = ['bouclier', 'rond']
export const CREST_EMBLEMS = ['elephant', 'baobab', 'pirogue', 'tamtam', 'etoile', 'lion', 'masque', 'cauri'] as const
export const CREST_COLORS = ['#f77f00', '#009e60', '#ffffff', '#c92a2a', '#1c5d99', '#ffd36e', '#5f3dc4', '#2b2b2b', '#8a5a32', '#e64980']
export const DEVISE_MAX = 40

/** A first crest to start from (the colours of the flag, the elephant). */
export const DEFAULT_CREST: Crest = { shape: 'bouclier', colors: ['#f77f00', '#009e60'], emblem: 'elephant', devise: '' }

export function emblemLabel(id: string): string {
  const m: Record<string, string> = { elephant: tr('Éléphant'), baobab: tr('Baobab'), pirogue: tr('Pirogue'), tamtam: tr('Tam-tam'), etoile: tr('Étoile'), lion: tr('Lion'), masque: tr('Masque'), cauri: tr('Cauri') }
  return m[id] ?? id
}

/** The emblems in blocks, 9 × 9, top row first (« # »: a cube). */
const EMBLEMS: Record<string, string[]> = {
  // The elephant's head, front on (as on the country's arms): the big ears apart from the head, the trunk, the tusks.
  elephant: ['##.###.##', '##.###.##', '##.#.#.##', '##.###.##', '.#.###.#.', '...###...', '..#.#.#..', '....#....', '....##...'],
  // The baobab: its wide crown over the branches, the trunk widening to the ground.
  baobab: ['..#####..', '.#######.', '#########', '.#.#.#.#.', '...###...', '...###...', '..#####..', '.#######.', '.........'],
  // The pirogue: its hull with raised ends, the paddle across it.
  pirogue: ['.......#.', '......#..', '.....#...', '....#....', '#..#....#', '##.#...##', '#########', '.#######.', '..#####..'],
  tamtam: ['.#######.', '.#.#.#.#.', '..#####..', '...###...', '...###...', '..#####..', '.##.#.##.', '.#######.', '.........'],
  etoile: ['....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.', '.........'],
  // The lion's face in its mane: the eyes, the nose, the muzzle.
  lion: ['.#.###.#.', '###...###', '##.#.#.##', '##.....##', '##..#..##', '###.#.###', '.##...##.', '..#####..', '....#....'],
  // The mask: long, its eye slits, the ridge of its nose.
  masque: ['...###...', '..#####..', '.#######.', '.#..#..#.', '.#######.', '..##.##..', '..#####..', '...#.#...', '....#....'],
  cauri: ['...###...', '..#####..', '.###.###.', '.##...##.', '.###.###.', '.##...##.', '.###.###.', '..#####..', '...###...'],
}

/** The field's rows, top first: how many cells wide (out of 11). */
const SHIELD = [11, 11, 11, 11, 11, 11, 11, 11, 10, 9, 7, 5, 3]
const ROUND = [5, 7, 9, 11, 11, 11, 11, 11, 11, 11, 9, 7, 5]
const ROWS = 13
const CELL = 1 / ROWS
const GOLD = '#d9a520'

/** The emblem's colour: gold, unless the field already is (then white, or dark on white and gold). */
export function emblemColor(c: Crest): string {
  const has = (x: string) => c.colors.includes(x)
  if (has('#ffd36e')) return has('#ffffff') ? '#2b2b2b' : '#ffffff'
  return '#ffe08a'
}

function box(parts: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const cols = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  g.deleteAttribute('uv')
  parts.push(g)
}

const cache = new Map<string, THREE.BufferGeometry>()

/** The crest as one geometry (1 unit tall, centred, its face towards +z), cached. */
export function crestGeometry(c: Crest): THREE.BufferGeometry {
  const key = `${c.shape}|${c.colors.join()}|${c.emblem}`
  const had = cache.get(key)
  if (had) return had
  const parts: THREE.BufferGeometry[] = []
  const rows = c.shape === 'rond' ? ROUND : SHIELD
  for (let r = 0; r < ROWS; r++) {
    const w = rows[r] * CELL
    const y = 0.5 - (r + 0.5) * CELL
    // The rim: a gold row behind, a little wider and taller.
    box(parts, 0, y, -0.035, w + CELL * 0.9, CELL * 1.02 + (r === 0 || r === ROWS - 1 ? CELL * 0.45 : 0), 0.05, GOLD)
    // The field: its two colours side by side.
    box(parts, -w / 4, y, 0, w / 2, CELL, 0.06, c.colors[0])
    box(parts, w / 4, y, 0, w / 2, CELL, 0.06, c.colors[1])
  }
  const em = EMBLEMS[c.emblem] ?? EMBLEMS.etoile
  const ec = emblemColor(c)
  const top = c.shape === 'rond' ? 2 : 1.4
  // Each cube raised on the field, and a dark rim round the whole emblem (every empty cell that touches it): its
  // outline reads on any colour, even small (the profile's chip, the ranking).
  const on = (r: number, k: number) => r >= 0 && r < em.length && k >= 0 && k < em[r].length && em[r][k] === '#'
  // (Its cells a little smaller than the field's: the field's colours and outline show round it.)
  const E = CELL * 0.78
  const cy = 0.5 - (top + 4.5) * CELL
  for (let r = -1; r <= em.length; r++)
    for (let k = -1; k <= 9; k++) {
      const x = (k - 4) * E
      const y = cy - (r - 4) * E
      if (on(r, k)) box(parts, x, y, 0.055, E * 0.98, E * 0.98, 0.05, ec)
      else if ([-1, 0, 1].some((dr) => [-1, 0, 1].some((dk) => on(r + dr, k + dk)))) box(parts, x, y, 0.04, E, E, 0.035, '#3b2412')
    }
  const g = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  g.computeVertexNormals()
  cache.set(key, g)
  return g
}

/** The crests' one material: their vertex colours, lit like the rest. */
let mat: THREE.MeshLambertMaterial | null = null
export const crestMaterial = () => (mat ??= new THREE.MeshLambertMaterial({ vertexColors: true }))
