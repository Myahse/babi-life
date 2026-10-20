import * as THREE from 'three'

type XZ = [number, number]

/**
 * Where one can walk in a room: everything the room has (counters, tables,
 * chairs, shelves, beds…) laid on a grid of 25 cm from the meshes
 * themselves, with the Sim's width round them, and the people standing
 * about. What lies on the floor (a rug) or hangs above the head (a lamp, a
 * shelf on the wall) is not in the way. `w`, `d`: the room's floor, centred.
 */
export function roomGrid(root: THREE.Object3D, people: XZ[], w: number, d: number): (x: number, z: number) => boolean {
  const CELL = 0.25
  const R = 0.28
  const cols = Math.ceil(w / CELL)
  const rows = Math.ceil(d / CELL)
  const taken = new Uint8Array(cols * rows)
  const mark = (x0: number, z0: number, x1: number, z1: number) => {
    const i0 = Math.max(0, Math.floor((x0 + w / 2) / CELL))
    const i1 = Math.min(cols - 1, Math.floor((x1 + w / 2) / CELL))
    const j0 = Math.max(0, Math.floor((z0 + d / 2) / CELL))
    const j1 = Math.min(rows - 1, Math.floor((z1 + d / 2) / CELL))
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) taken[j * cols + i] = 1
  }
  root.updateWorldMatrix(true, true)
  const box = new THREE.Box3()
  const m = new THREE.Matrix4()
  const add = () => {
    // Flat on the floor, or over the head; or the size of the whole room (a floor, a ceiling): not in the way.
    if (box.max.y < 0.12 || box.min.y > 1.7) return
    if (box.max.x - box.min.x > w * 0.8 && box.max.z - box.min.z > d * 0.8) return
    mark(box.min.x - R, box.min.z - R, box.max.x + R, box.max.z + R)
  }
  root.traverse((o) => {
    if (!o.visible) return
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const inst = o as THREE.InstancedMesh
    if (inst.isInstancedMesh) {
      for (let k = 0; k < inst.count; k++) {
        inst.getMatrixAt(k, m)
        box.copy(mesh.geometry.boundingBox!).applyMatrix4(m.premultiply(inst.matrixWorld))
        add()
      }
    } else {
      box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld)
      add()
    }
  })
  for (const [x, z] of people) mark(x - 0.35, z - 0.35, x + 0.35, z + 0.35)
  return (x, z) => {
    const i = Math.floor((x + w / 2) / CELL)
    const j = Math.floor((z + d / 2) / CELL)
    if (i < 2 || j < 2 || i >= cols - 2 || j >= rows - 2) return false
    return !taken[j * cols + i]
  }
}
