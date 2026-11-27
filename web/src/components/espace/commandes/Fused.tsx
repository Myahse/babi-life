import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// The games' fixed scenery drawn in one go (the scenes kept light): the opaque blocks under it, written as usual
// with <B>, are merged once, as they mount, into one mesh (their colours in the vertices; the lit ones into a
// second, unlit), and the originals hidden. Only for what never moves: the moving parts stay outside.

function bake(meshes: THREE.Mesh[], root: THREE.Object3D): THREE.BufferGeometry | null {
  if (!meshes.length) return null
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const parts = meshes.map((m) => {
    const g = m.geometry.clone().toNonIndexed()
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    const c = (m.material as THREE.MeshLambertMaterial).color
    const n = g.attributes.position.count
    const cols = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    g.deleteAttribute('uv')
    return g
  })
  const out = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return out
}

export function Fused({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const g = root.current
    if (!g) return
    g.updateWorldMatrix(true, true)
    const lit: THREE.Mesh[] = []
    const glow: THREE.Mesh[] = []
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.visible) return
      const mat = m.material as THREE.Material
      if (mat.transparent) return
      if (mat instanceof THREE.MeshLambertMaterial) lit.push(m)
      else if (mat instanceof THREE.MeshBasicMaterial) glow.push(m)
    })
    const made: THREE.Mesh[] = []
    const a = bake(lit, g)
    if (a) made.push(new THREE.Mesh(a, new THREE.MeshLambertMaterial({ vertexColors: true })))
    const b = bake(glow, g)
    if (b) made.push(new THREE.Mesh(b, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })))
    ;[...lit, ...glow].forEach((m) => (m.visible = false))
    made.forEach((m) => g.add(m))
    return () => {
      made.forEach((m) => {
        g.remove(m)
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      })
      ;[...lit, ...glow].forEach((m) => (m.visible = true))
    }
  }, [])
  return <group ref={root}>{children}</group>
}
