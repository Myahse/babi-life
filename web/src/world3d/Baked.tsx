import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** The layer the parts go to while their baked copy is drawn: no camera looks at it. */
const AWAY = 31

type Part = { mesh: THREE.Mesh; layers: number }

/**
 * A model of many small parts (a monument, a fuel station, a house: fifty to a hundred and fifty
 * boxes) costs a draw for each part. Seen from far, it's drawn instead as one mesh per material,
 * its parts merged once ("baked"): a few draws. Near (within), the parts themselves again, moving
 * as they do. The bake is made again each time it goes far (the model may have changed meanwhile:
 * a light on at night, a door). Instanced, skinned and morphed meshes, and anything not a mesh,
 * stay drawn as they are.
 */
export function Baked({ within = 0, children }: { /** Nearer than this (m), the live parts; 0: always baked. */ within?: number; children: React.ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const baked = useRef<THREE.Group>(null)
  const parts = useRef<Part[]>([])
  const state = useRef<'live' | 'baked'>('live')
  const next = useRef(0)
  const at = useMemo(() => new THREE.Vector3(), [])

  const clear = () => {
    const b = baked.current
    if (!b) return
    for (const m of [...b.children] as THREE.Mesh[]) {
      m.geometry.dispose()
      b.remove(m)
    }
  }
  const live = () => {
    for (const p of parts.current) p.mesh.layers.mask = p.layers
    parts.current = []
    clear()
    state.current = 'live'
  }
  const bake = () => {
    const r = root.current
    const b = baked.current
    if (!r || !b) return
    live()
    r.updateWorldMatrix(true, true)
    const inverse = new THREE.Matrix4().copy(r.matrixWorld).invert()
    const byMaterial = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; shadow: boolean; receive: boolean }>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(m.material)) return
      if (Object.keys(m.geometry.morphAttributes).length || !m.geometry.attributes.position) return
      // Hidden (here or up the tree): not in the bake.
      for (let x: THREE.Object3D | null = m; x && x !== r; x = x.parent) if (!x.visible) return
      const mat = m.material as THREE.Material
      let g = byMaterial.get(mat)
      if (!g) byMaterial.set(mat, (g = { geos: [], meshes: [], shadow: false, receive: false }))
      g.meshes.push(m)
      g.shadow ||= m.castShadow
      g.receive ||= m.receiveShadow
    })
    for (const [mat, g] of byMaterial) {
      // A material with a single part gains nothing: that part stays drawn as it is.
      if (g.meshes.length < 2) continue
      const colors = (mat as THREE.MeshStandardMaterial).vertexColors
      const geos: THREE.BufferGeometry[] = []
      for (const m of g.meshes) {
        const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
        const out = new THREE.BufferGeometry()
        const n = src.attributes.position.count
        out.setAttribute('position', src.attributes.position)
        if (!src.attributes.normal) src.computeVertexNormals()
        out.setAttribute('normal', src.attributes.normal)
        out.setAttribute('uv', src.attributes.uv ?? new THREE.BufferAttribute(new Float32Array(n * 2), 2))
        if (colors) out.setAttribute('color', src.attributes.color ?? new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3))
        out.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld))
        geos.push(out)
        src.dispose()
      }
      const merged = mergeGeometries(geos)
      geos.forEach((x) => x.dispose())
      if (!merged) continue
      const one = new THREE.Mesh(merged, mat)
      one.castShadow = g.shadow
      one.receiveShadow = g.receive
      one.matrixAutoUpdate = false
      b.add(one)
      for (const m of g.meshes) {
        parts.current.push({ mesh: m, layers: m.layers.mask })
        m.layers.set(AWAY)
      }
    }
    state.current = 'baked'
  }

  useFrame(({ camera, clock }) => {
    if (!root.current || clock.elapsedTime < next.current) return
    // (A moment after it's first drawn, so the parts that load (textures, fonts) are in.)
    if (next.current === 0) {
      next.current = clock.elapsedTime + 1.5
      return
    }
    next.current = clock.elapsedTime + 0.5
    root.current.getWorldPosition(at)
    // (window.__noBake: the parts always, to measure what the bake saves.)
    const near = (import.meta.env.DEV && !!(globalThis as { __noBake?: boolean }).__noBake) || (within > 0 && at.distanceTo(camera.position) < within)
    if (near && state.current === 'baked') live()
    else if (!near && state.current === 'live') bake()
  })
  useEffect(() => () => live(), []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group>
      <group ref={root}>{children}</group>
      <group ref={baked} />
    </group>
  )
}
