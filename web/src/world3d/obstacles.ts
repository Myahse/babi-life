// What a Sim walking freely can't go through, besides the map's buildings
// and the water (open/nav.ts): the game's own buildings and landmarks, the
// trees, lamp posts and street stalls, and the cars, taxis, gbakas and motos
// on the move. Things register themselves when they're drawn and leave when
// they go; the moving ones update their place every frame.
//
// A thing is a circle (a trunk, a post) or a box turned about the vertical
// (a building, a car): half-sizes hw along its own x, hd along its own z.
// A building also says how high it goes (top), for the close camera.

export type Obstacle = { x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number }

const CELL = 8
const fixed = new Map<string, Obstacle[]>()
const moving = new Map<string, Obstacle>()
let grid: Map<string, Obstacle[]> | null = null

/** Something that doesn't move: put down (or replaced) under a key. */
export function setObstacles(key: string, list: Obstacle[]) {
  if (list.length) fixed.set(key, list)
  else fixed.delete(key)
  grid = null
}
export function clearObstacles(key: string) {
  if (fixed.delete(key)) grid = null
}
/** Something on the move, where it is now (null: gone, or not on screen). */
export function moveObstacle(key: string, o: Obstacle | null) {
  if (o) moving.set(key, o)
  else moving.delete(key)
}

const reach = (o: Obstacle) => ('r' in o ? o.r : Math.hypot(o.hw, o.hd))

function index() {
  if (grid) return grid
  grid = new Map()
  for (const list of fixed.values())
    for (const o of list) {
      const e = reach(o) + 0.5 // and a body touching it from the next cell
      for (let i = Math.floor((o.x - e) / CELL); i <= Math.floor((o.x + e) / CELL); i++)
        for (let j = Math.floor((o.z - e) / CELL); j <= Math.floor((o.z + e) / CELL); j++) {
          const k = `${i},${j}`
          const cell = grid.get(k)
          if (cell) cell.push(o)
          else grid.set(k, [o])
        }
    }
  return grid
}

function hits(o: Obstacle, x: number, z: number, r: number) {
  if ('r' in o) return Math.hypot(x - o.x, z - o.z) < o.r + r
  // Into the box's own frame (a Three.js turn about y: x' = x cos + z sin).
  const [dx, dz] = [x - o.x, z - o.z]
  const [c, s] = [Math.cos(o.rot), Math.sin(o.rot)]
  const u = dx * c - dz * s
  const v = dx * s + dz * c
  return Math.abs(u) < o.hw + r && Math.abs(v) < o.hd + r
}

/** Is a body of radius r at (x, z) inside something that doesn't move (a wall, a trunk, a stall)? */
export function blockedFixed(x: number, z: number, r = 0.35) {
  for (const o of index().get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) if (hits(o, x, z, r)) return true
  return false
}

/** Is a car, a gbaka or a moto right there (r: the body's radius)? */
export function vehicleAt(x: number, z: number, r = 0.35) {
  for (const o of moving.values()) if (Math.abs(o.x - x) < 6 && Math.abs(o.z - z) < 6 && hits(o, x, z, r)) return true
  return false
}

/** Is a body of radius r at (x, z) inside something? */
export function blocked(x: number, z: number, r = 0.35) {
  for (const o of index().get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) if (hits(o, x, z, r)) return true
  for (const o of moving.values()) if (Math.abs(o.x - x) < 6 && Math.abs(o.z - z) < 6 && hits(o, x, z, r)) return true
  return false
}

/** How high the game's building standing here goes (0 if none): the close camera stays out of it. */
export function topAt(x: number, z: number) {
  let h = 0
  for (const o of index().get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) if ('top' in o && o.top && hits(o, x, z, 0)) h = Math.max(h, o.top)
  return h
}

/** Is a vehicle on the move within r metres of (x, z)? (The kids playing in the street look out for cars.) */
export function vehicleNear(x: number, z: number, r: number) {
  for (const o of moving.values()) if (Math.hypot(o.x - x, o.z - z) < r) return true
  return false
}

// The fenced grounds (pitches, courts): nothing is set down on them (a stall,
// people chatting, a vendor). A box turned about the vertical, like an obstacle.
const zones = new Map<string, { x: number; z: number; hw: number; hd: number; rot: number }>()
export function setZone(key: string, z: { x: number; z: number; hw: number; hd: number; rot: number } | null) {
  if (z) zones.set(key, z)
  else zones.delete(key)
}
/** Is (x, z) on a fenced ground, or within `margin` metres of it? (`except`: not that one, its own.) */
export function inZone(x: number, z: number, margin = 2, except?: string) {
  for (const [k, o] of zones) if (k !== except && Math.abs(o.x - x) < o.hw + o.hd + margin + 1 && Math.abs(o.z - z) < o.hw + o.hd + margin + 1 && hits({ ...o }, x, z, margin)) return true
  return false
}

// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __obstacles: { fixed, moving } })
