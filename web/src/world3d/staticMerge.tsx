import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Fewer draw calls: a thing made of many little blocks (a stall, a fence, a
// field's goals and lamps, a house front) is drawn as one mesh per look
// rather than one per block. Once its children are in place, the meshes that
// don't move are baked together, by material (same kind, colour, texture),
// and hidden; what moves or changes is marked `userData.live` and left alone.
// `version`: bake again when it changes (night lamps, a new look).

type Lit = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | THREE.MeshPhongMaterial

function signature(m: THREE.Material) {
  const l = m as Lit
  return [
    m.type,
    (l.color as THREE.Color | undefined)?.getHexString(),
    (l as THREE.MeshLambertMaterial).map?.uuid,
    m.transparent,
    m.opacity,
    m.side,
    m.vertexColors,
    (l as THREE.MeshLambertMaterial).emissive?.getHexString(),
    m.depthWrite,
    m.alphaTest,
    m.polygonOffset,
    (l as THREE.MeshBasicMaterial).wireframe,
    (l as THREE.MeshLambertMaterial).fog,
  ].join('|')
}

const MERGEABLE = new Set(['MeshLambertMaterial', 'MeshBasicMaterial', 'MeshStandardMaterial', 'MeshPhongMaterial'])

/** The geometry, in the root's frame, with only position, normal and uv (all non-indexed). */
function baked(mesh: THREE.Mesh, toRoot: THREE.Matrix4) {
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  g.morphAttributes = {}
  g.clearGroups()
  g = g.applyMatrix4(toRoot)
  return g
}

export function StaticMerge({ children, version = 0 }: { children: ReactNode; version?: string | number }) {
  const root = useRef<THREE.Group>(null)
  const made = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const r = root.current
    const out = made.current
    if (!r || !out) return
    r.updateWorldMatrix(true, true)
    const toRoot = new THREE.Matrix4().copy(r.matrixWorld).invert()
    const groups = new Map<
      string,
      {
        mat: THREE.Material
        geos: THREE.BufferGeometry[]
        shadow: boolean
        receive: boolean
        meshes: THREE.Mesh[]
      }
    >()
    r.traverse((o) => {
      if (o === out) return
      const m = o as THREE.Mesh
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return
      // Something alive below (a moving part, a person) stays as it is.
      for (let p: THREE.Object3D | null = m; p && p !== r; p = p.parent) if (p.userData.live || p.name === 'human') return
      if (!m.visible || Array.isArray(m.material) || !MERGEABLE.has(m.material.type) || m.material.onBeforeCompile.toString().length > 30) return
      const key = signature(m.material)
      const grp = groups.get(key) ?? {
        mat: m.material,
        geos: [],
        shadow: false,
        receive: false,
        meshes: [],
      }
      grp.geos.push(baked(m, new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld)))
      grp.shadow ||= m.castShadow
      grp.receive ||= m.receiveShadow
      grp.meshes.push(m)
      groups.set(key, grp)
    })
    const added: THREE.Mesh[] = []
    const hidden: THREE.Mesh[] = []
    for (const grp of groups.values()) {
      if (grp.meshes.length < 2) continue
      const geo = mergeGeometries(grp.geos, false)
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, grp.mat)
      mesh.castShadow = grp.shadow
      mesh.receiveShadow = grp.receive
      // Taps still land: the hidden blocks stay in place for the raycaster.
      mesh.raycast = () => {}
      out.add(mesh)
      added.push(mesh)
      for (const m of grp.meshes) {
        m.visible = false
        hidden.push(m)
      }
    }
    for (const grp of groups.values()) if (grp.meshes.length < 2) for (const g of grp.geos) g.dispose()
    return () => {
      for (const m of added) {
        out.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.visible = true
    }
  }, [version])
  return (
    <group ref={root}>
      {children}
      <group ref={made} />
    </group>
  )
}
