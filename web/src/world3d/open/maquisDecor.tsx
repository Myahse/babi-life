import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// « Façades réalistes » (facades.ts): a maquis's terrace as in the concept (the lab's « Akwaba Soir »):
// a pergola of wooden posts under a sheet of tin over the tables, strings of bulbs sagging along its
// beams (lit at night), a chest freezer, crates of bottles stacked by the wall, plastic chairs piled
// up. Every kind of thing is one instanced mesh (a draw each, whatever the count); the posts and the
// crates are measured as obstacles one by one (Solid.tsx reads instances), the roof and the bulbs are
// over the head. Local frame: dressing.tsx's (the door at the origin, +z to the street, x along the façade).

const BOX = new THREE.BoxGeometry(1, 1, 1)
const mats = new Map<string, THREE.Material>()
const lam = (c: string) => {
  let m = mats.get(c)
  if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
const BULB_DAY = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const BULB_NIGHT = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })

type Part = { p: [number, number, number]; s: [number, number, number]; r?: number; c?: string }

/** Boxes of one material as one instanced mesh (their own colours when given). */
function Boxes({ parts, material, shadow = true }: { parts: Part[]; material: THREE.Material; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    parts.forEach((x, i) => {
      o.position.set(...x.p)
      o.rotation.set(0, x.r ?? 0, 0)
      o.scale.set(...x.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (x.c) m.setColorAt(i, col.set(x.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [parts])
  return <instancedMesh ref={ref} args={[BOX, material, parts.length]} castShadow={shadow} receiveShadow />
}

const BULBS = ['#ffd36b', '#ff6b6b', '#6bd3ff', '#9cff8a', '#ffb347']

/** The terrace's pergola, lights and things, for tables laid from x0 to x1 and z0 to z1 (dressing.tsx Terrace). */
export function MaquisDecor({ x0, x1, z0, z1, night, seed }: { x0: number; x1: number; z0: number; z1: number; night: boolean; seed: number }) {
  const { wood, tin, bulbs, crates, white, chairs, wire } = useMemo(() => {
    const [w, d] = [x1 - x0, z1 - z0]
    const posts: Part[] = []
    for (const x of [x0, x0 + w / 2, x1]) for (const z of [z0, z1]) posts.push({ p: [x, 1.45, z], s: [0.16, 2.9, 0.16] })
    // Beams along and across, over the head.
    const beams: Part[] = [
      { p: [(x0 + x1) / 2, 2.95, z0], s: [w + 0.3, 0.14, 0.14] },
      { p: [(x0 + x1) / 2, 2.95, z1], s: [w + 0.3, 0.14, 0.14] },
      ...[x0, x0 + w / 2, x1].map((x): Part => ({ p: [x, 3.0, (z0 + z1) / 2], s: [0.12, 0.12, d + 0.3] })),
    ]
    // The tin sheet, sloping down to the street, in two runs (a step between them, blocky like the roofs).
    const tin: Part[] = [
      { p: [(x0 + x1) / 2, 3.18, z0 + d * 0.27], s: [w + 0.8, 0.06, d * 0.58], c: '#a3abb0' },
      { p: [(x0 + x1) / 2, 3.08, z0 + d * 0.77], s: [w + 0.8, 0.06, d * 0.5], c: '#9aa3a8' },
    ]
    // Two strings of bulbs sagging between the posts, along the street side and the middle.
    const bulbs: Part[] = []
    const wire: Part[] = []
    const n = Math.max(8, Math.round(w / 0.7))
    for (const [z, k0] of [[z1 - 0.05, 0], [(z0 + z1) / 2, 2]] as const)
      for (let k = 0; k <= n; k++) {
        const f = k / n
        // (Sagging in each of the two spans between the posts.)
        const y = 2.8 - Math.sin(((f * 2) % 1) * Math.PI) * 0.24
        bulbs.push({ p: [x0 + w * f, y - 0.1, z], s: [0.11, 0.13, 0.11], c: BULBS[(k + k0) % BULBS.length] })
        if (k) wire.push({ p: [x0 + w * (f - 0.5 / n), (y + bulbs[bulbs.length - 2].p[1] + 0.2) / 2, z], s: [w / n + 0.02, 0.015, 0.015], c: '#1e1f22' })
      }
    // Crates of bottles by the wall, the beer's and the sodas'.
    const crates: Part[] = []
    const r = (i: number) => (Math.sin(seed * 977 + i * 31.7) * 43758.5453) % 1
    for (let i = 0; i < 5; i++) {
      const [x, h] = [x1 + 0.9 + (i % 2) * 0.45, 0.17 + Math.floor(i / 2) * 0.34]
      crates.push({ p: [x, h, z0 + 0.3], s: [0.42, 0.32, 0.3], r: Math.abs(r(i)) * 0.2, c: i % 3 === 2 ? '#c92a2a' : '#7a4a22' })
    }
    // The chest freezer, its lid; the stack of plastic chairs.
    const white: Part[] = [
      { p: [x1 + 1.1, 0.45, z0 + 1.2], s: [0.75, 0.9, 1.2], c: '#f4f6f8' },
      { p: [x1 + 1.1, 0.92, z0 + 1.2], s: [0.78, 0.06, 1.24], c: '#cfd5da' },
    ]
    const chairs: Part[] = [...Array(6)].map((_, i) => ({ p: [x0 - 0.7, 0.42 + i * 0.09, z0 + 0.4], s: [0.44, 0.05, 0.44], c: i % 2 ? '#f4f4f4' : '#e8432f' }))
    chairs.push({ p: [x0 - 0.7, 0.6, z0 + 0.2], s: [0.44, 0.75, 0.05], c: '#e8432f' })
    return { wood: [...posts, ...beams], tin, bulbs, crates, white, chairs, wire }
  }, [x0, x1, z0, z1, seed])
  return (
    <group>
      <Boxes parts={wood} material={lam('#6b4a2e')} />
      <Boxes parts={tin} material={lam('#ffffff')} />
      <Boxes parts={bulbs} material={night ? BULB_NIGHT : BULB_DAY} shadow={false} />
      <Boxes parts={crates} material={lam('#ffffff')} />
      <Boxes parts={white} material={lam('#ffffff')} />
      <Boxes parts={chairs} material={lam('#ffffff')} />
      {/* The wire the bulbs hang on (over the head: no obstacle) */}
      <Boxes parts={wire} material={lam('#ffffff')} shadow={false} />
    </group>
  )
}
