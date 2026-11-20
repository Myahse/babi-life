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
  elephant: ['....####.', '..#######', '.##.#####', '##..#####', '#...#####', '#..######', '#..##..##', '...##..##', '.........'],
  baobab: ['#.##.##.#', '#########', '.#######.', '..#.#.#..', '...###...', '...###...', '...###...', '..#####..', '.........'],
  pirogue: ['....#....', '...###...', '....#..#.', '...#.##..', '.....#...', '#.......#', '##.....##', '.#######.', '..#####..'],
  tamtam: ['.#######.', '.#.#.#.#.', '..#####..', '...###...', '...###...', '..#####..', '.##.#.##.', '.#######.', '.........'],
  etoile: ['....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.', '.........'],
  lion: ['..#####..', '.#######.', '###.#.###', '#########', '###...###', '.##.#.##.', '..#####..', '...###...', '.........'],
  masque: ['...###...', '..#####..', '.##.#.##.', '.#######.', '..#####..', '..##.##..', '..#####..', '...###...', '....#....'],
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
  // Each cube with a dark one behind it, a little down and to the right: the emblem stands out of the field.
  for (let r = 0; r < em.length; r++)
    for (let k = 0; k < em[r].length; k++)
      if (em[r][k] === '#') {
        const x = (k - 4) * CELL
        const y = 0.5 - (top + r + 0.5) * CELL
        box(parts, x + CELL * 0.2, y - CELL * 0.2, 0.04, CELL, CELL, 0.04, '#3b2412')
        box(parts, x, y, 0.055, CELL * 0.98, CELL * 0.98, 0.05, ec)
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
