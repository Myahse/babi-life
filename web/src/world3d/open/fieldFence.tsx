import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clearObstacles, setObstacles, setZone, type Obstacle } from '../obstacles'

// The grillage round a pitch or a court, as round every terrain in Abidjan:
// green posts, a top rail, the wire mesh between, and a gate in the middle of
// each long side. Drawn in the field's own frame (x along it, z across), round
// a ground of half-sizes hl × hw. Once in place it says where it stands: its
// sides are walls for whoever walks (in by the gates), and its ground is kept
// clear of the street's stalls, vendors and people chatting.

const GATE = 2.4
const HEIGHT = 2.6
const STEP = 2.5

const post = new THREE.MeshLambertMaterial({ color: '#2f6b3a' })
let meshMat: THREE.MeshLambertMaterial | null = null
function wire() {
  if (meshMat) return meshMat
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const g = c.getContext('2d')!
  g.fillStyle = '#c9d1c9'
  // The diamonds of a chain-link fence.
  for (let i = 0; i < 16; i++) {
    g.fillRect(i, i, 1, 1)
    g.fillRect(15 - i, i, 1, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  meshMat = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, depthWrite: false })
  return meshMat
}

type Run = { cx: number; cz: number; len: number; along: 'x' | 'z' }

/** The straight runs, the gates left open in the middle of the long sides. */
function runsOf(hl: number, hw: number): Run[] {
  const half = hl - GATE / 2
  return [
    ...[-1, 1].flatMap((s) => [
      { cx: -(GATE / 2 + half / 2), cz: s * hw, len: half, along: 'x' as const },
      { cx: GATE / 2 + half / 2, cz: s * hw, len: half, along: 'x' as const },
    ]),
    { cx: -hl, cz: 0, len: hw * 2, along: 'z' as const },
    { cx: hl, cz: 0, len: hw * 2, along: 'z' as const },
  ].filter((r) => r.len > 0.2)
}

export function FieldFence({ hl, hw, id }: { hl: number; hw: number; id: string }) {
  const g = useRef<THREE.Group>(null)
  const runs = useMemo(() => runsOf(hl, hw), [hl, hw])
  const posts = useMemo(() => {
    const out: [number, number][] = []
    for (const r of runs) {
      const n = Math.max(1, Math.round(r.len / STEP))
      for (let k = 0; k <= n; k++) {
        const t = -r.len / 2 + (r.len * k) / n
        out.push(r.along === 'x' ? [r.cx + t, r.cz] : [r.cx, r.cz + t])
      }
    }
    return out
  }, [runs])
  // One mesh for all the wire (its diamonds repeat every half-metre), one for the posts and rails.
  const { wireGeo, frameGeo } = useMemo(() => {
    const panels = runs.map((r) => {
      const g = new THREE.PlaneGeometry(r.len, HEIGHT)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (r.len / 0.5), uv.getY(i) * (HEIGHT / 0.5))
      if (r.along === 'z') g.rotateY(Math.PI / 2)
      return g.translate(r.cx, HEIGHT / 2, r.cz).toNonIndexed()
    })
    const bars = [
      ...runs.map((r) => new THREE.BoxGeometry(r.along === 'x' ? r.len : 0.07, 0.07, r.along === 'x' ? 0.07 : r.len).translate(r.cx, HEIGHT, r.cz)),
      ...posts.map(([x, z]) => new THREE.BoxGeometry(0.1, HEIGHT + 0.1, 0.1).translate(x, HEIGHT / 2 + 0.05, z)),
    ].map((g) => g.toNonIndexed())
    const wireGeo = mergeGeometries(panels, false)
    const frameGeo = mergeGeometries(bars, false)
    for (const g of [...panels, ...bars]) g.dispose()
    return { wireGeo, frameGeo }
  }, [runs, posts])
  useEffect(() => () => void (wireGeo?.dispose(), frameGeo?.dispose()), [wireGeo, frameGeo])
  useEffect(() => {
    const o = g.current
    if (!o) return
    o.updateWorldMatrix(true, false)
    const m = o.matrixWorld
    const e = m.elements
    const rot = Math.atan2(e[8], e[0])
    const at = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(m)
    const walls: Obstacle[] = runs.map((r) => {
      const p = at(r.cx, r.cz)
      return { x: p.x, z: p.z, hw: r.along === 'x' ? r.len / 2 : 0.08, hd: r.along === 'x' ? 0.08 : r.len / 2, rot }
    })
    const key = `fence:${id}`
    setObstacles(key, walls)
    const c = at(0, 0)
    setZone(key, { x: c.x, z: c.z, hw: hl, hd: hw, rot })
    return () => {
      clearObstacles(key)
      setZone(key, null)
    }
  }, [runs, hl, hw, id])
  return (
    <group ref={g}>
      {wireGeo && <mesh geometry={wireGeo} material={wire()} />}
      {frameGeo && <mesh geometry={frameGeo} material={post} castShadow />}
    </group>
  )
}
