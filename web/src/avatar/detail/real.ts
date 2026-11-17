import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// « Persos réalistes » (the update « persos-realistes », avatar/RealHuman.tsx): the detailed Sim's
// segments (detail/build.ts) merged into ONE skinned geometry, each segment rigidly on its bone. The
// bones are the very joints the poses move (Human.tsx usePoseRig: chest, head, hips, knees,
// shoulders, elbows) plus the loose hair's and the earrings' (secondary motion). A Sim is then one
// draw call for its body and one for its face, whatever it wears.
//
// Each segment's boxes are built in its joint's own frame, so a bone's inverse bind matrix is the
// identity and the mesh's bind matrix too: the skinned vertex is bone.matrixWorld × v, exactly where
// the separate meshes of DetailHuman put it.

/** The bones, in the skin's order (a segment's index is its bone's). */
export const BONES = ['chest', 'head', 'hang', 'ear', 'thigh0', 'shin0', 'thigh1', 'shin1', 'upper0', 'fore0', 'upper1', 'fore1'] as const
export type BoneName = (typeof BONES)[number]

const H = 0.32
/** The loose hair's pivot in the head (where DetailHuman swings it). */
export const HANG_Y = H * 0.62
/** The earrings' pivot in the head: just under the ear, where the hoop hangs from. */
export const EAR_AT: [number, number, number] = [0, H * 0.33 + 0.01, -0.01]
/** Where each segment's boxes sit in its bone's frame, when the bone is not at the segment's origin. */
const SHIFT: Partial<Record<BoneName, [number, number, number]>> = { hang: [0, -HANG_Y, 0], ear: [-EAR_AT[0], -EAR_AT[1], -EAR_AT[2]] }

/** The segments of one look as one geometry, with each vertex on its segment's bone (weight 1). */
export function skinnedOf(geos: Record<string, THREE.BufferGeometry>) {
  const parts: THREE.BufferGeometry[] = []
  for (const [seg, g0] of Object.entries(geos)) {
    const bone = BONES.indexOf(seg as BoneName)
    if (bone < 0) continue
    const g = g0.clone()
    // Only what the skin needs (the bevelled boxes carry extra data).
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
    g.clearGroups()
    const sh = SHIFT[seg as BoneName]
    if (sh) g.translate(...sh)
    const n = g.attributes.position.count
    const idx = new Uint16Array(n * 4)
    const wt = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      idx[i * 4] = bone
      wt[i * 4] = 1
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4))
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4))
    parts.push(g.index ? g : g)
  }
  // Indexed and not indexed boxes can't be merged together: all go one way.
  const indexed = parts.every((g) => g.index)
  const list = indexed ? parts : parts.map((g) => (g.index ? g.toNonIndexed() : g))
  const merged = mergeGeometries(list, false)!
  for (const g of parts) g.dispose()
  // The whole Sim, whatever its pose (set once: computing it from the bones would cost every frame).
  merged.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.25)
  merged.boundingBox = new THREE.Box3(new THREE.Vector3(-0.9, -0.2, -0.9), new THREE.Vector3(0.9, 2.1, 0.9))
  return merged
}

/* ---------- Building them ---------- */

// A realistic look takes about twice a detailed one to paint (four texels for one, then its face's
// atlas): some 15-40 ms on a phone. So one at most every REAL_GAP ms (today's Sim is drawn meanwhile,
// no gap on screen): a street filling with new faces costs a short hitch now and then, never a stall.
const REAL_GAP = 150
let lastBuild = -Infinity
/** Whether a realistic look may be built now (and if so, the time is taken). */
export function mayBuildReal() {
  const now = performance.now()
  if (now - lastBuild < REAL_GAP) return false
  lastBuild = now
  return true
}

/* ---------- The looks in use ---------- */

// A look's atlas (512 px wide) is freed a while after the last Sim wearing it is gone (the street's
// passers-by come and go): only the looks on screen take memory.

const users = new Map<string, number>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const KEEP_MS = 20000
let drop: ((key: string) => void) | null = null
/** Set by build.ts (no import cycle): how a look is forgotten. */
export const onDrop = (f: (key: string) => void) => (drop = f)

export function useLook(key: string) {
  users.set(key, (users.get(key) ?? 0) + 1)
  const t = timers.get(key)
  if (t) (clearTimeout(t), timers.delete(key))
}
export function leaveLook(key: string) {
  const n = (users.get(key) ?? 1) - 1
  if (n > 0) return void users.set(key, n)
  users.delete(key)
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      if (!users.has(key)) drop?.(key)
    }, KEEP_MS),
  )
}
/** How many looks are in use now (the lab's counter). */
export const looksInUse = () => users.size
