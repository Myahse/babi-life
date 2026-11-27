import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Les bêtes qui vont et viennent (the update « agriculture »: the village plots in the street, FermeLandmark.tsx):
// a pen's animals in blocks, all of them in one instanced mesh (one draw call a pen, whatever the herd), each
// wandering in its pen: a few steps to a spot, a while grazing (the head down and up), on to another. Tired (a
// day forgotten) they stand, the head low. Led to the pasture (« mener le troupeau »), they go out round the
// fields and come back after. The pond's tilapias stay betes.tsx's.

type Part = [number, number, number, number, number, number, string, 0 | 1]
type Spec = { parts: Part[]; speed: number; hop?: boolean }

/** A beast's blocks, its feet at y 0, facing +z; the last field 1 for the head's (they bob as it grazes). */
function quad(o: { bw: number; bh: number; bd: number; leg: number; head: [number, number, number]; c: string; legC?: string; horns?: number; hump?: boolean; ears?: 'long' | 'flop'; snout?: string; tail?: number; wool?: boolean }): Part[] {
  const { bw, bh, bd, leg, head, c } = o
  const y = leg + bh / 2
  const lc = o.legC ?? c
  const out: Part[] = [[0, y, 0, bw, bh, bd, c, 0]]
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    out.push([x * (bw / 2 - 0.05), leg / 2, z * (bd / 2 - 0.08), Math.max(0.06, bw * 0.22), leg, Math.max(0.06, bw * 0.22), lc, 0])
  if (o.hump) out.push([0, y + bh / 2 + 0.08, bd / 2 - 0.3, bw * 0.5, 0.22, 0.3, c, 0])
  if (o.tail) out.push([0, y + bh * 0.2, -bd / 2 - o.tail / 2, 0.05, 0.05, o.tail, c, 0])
  if (o.wool) out.push([0, y + 0.03, 0, bw + 0.08, bh + 0.06, bd * 0.85, '#f8f1e4', 0])
  const hy = y + bh * 0.25
  const hz = bd / 2 + head[2] / 2
  out.push([0, hy, hz, head[0], head[1], head[2], o.wool ? '#5c4033' : c, 1])
  if (o.snout) out.push([0, hy - 0.03, hz + head[2] / 2 + 0.02, head[0] * 0.55, head[1] * 0.45, 0.05, o.snout, 1])
  out.push([-head[0] / 3, hy + head[1] * 0.15, hz + head[2] / 2 + 0.005, 0.03, 0.03, 0.01, '#111111', 1], [head[0] / 3, hy + head[1] * 0.15, hz + head[2] / 2 + 0.005, 0.03, 0.03, 0.01, '#111111', 1])
  if (o.ears === 'long') for (const k of [-1, 1]) out.push([k * 0.035, hy + head[1] / 2 + 0.09, hz - head[2] * 0.2, 0.03, 0.16, 0.05, c, 1])
  if (o.ears === 'flop') for (const k of [-1, 1]) out.push([k * (head[0] / 2 + 0.03), hy + head[1] * 0.15, hz - head[2] * 0.2, 0.06, 0.04, 0.1, c, 1])
  if (o.horns) for (const k of [-1, 1]) out.push([k * head[0] * 0.3, hy + head[1] / 2 + o.horns / 2, hz - head[2] * 0.3, 0.04, o.horns, 0.04, '#d8c8a8', 1])
  return out
}
function bird(body: string, head: string, crest: string, spots?: string): Part[] {
  const out: Part[] = [
    [0, 0.06, 0, 0.02, 0.12, 0.02, '#e8a33c', 0],
    [0.05, 0.06, 0, 0.02, 0.12, 0.02, '#e8a33c', 0],
    [0, 0.2, 0, 0.18, 0.15, 0.24, body, 0],
    [0, 0.26, -0.14, 0.1, 0.12, 0.06, body, 0],
    [0, 0.3, 0.13, 0.08, 0.09, 0.08, head, 1],
    [0, 0.36, 0.13, 0.03, 0.05, 0.06, crest, 1],
    [0, 0.29, 0.19, 0.03, 0.02, 0.04, '#e8a33c', 1],
  ]
  if (spots) out.push([0.06, 0.24, 0.03, 0.03, 0.03, 0.03, spots, 0], [-0.06, 0.22, -0.05, 0.03, 0.03, 0.03, spots, 0])
  return out
}
const SPECS: Record<string, Spec> = {
  poules: { parts: bird('#f1e3c6', '#f1e3c6', '#e03131'), speed: 0.5 },
  pintades: { parts: bird('#495057', '#d0ebff', '#e8590c', '#f8f9fa'), speed: 0.55 },
  lapins: { parts: quad({ bw: 0.18, bh: 0.16, bd: 0.28, leg: 0.05, head: [0.13, 0.13, 0.13], c: '#dee2e6', ears: 'long', tail: 0.05 }), speed: 0.6, hop: true },
  chevres: { parts: quad({ bw: 0.26, bh: 0.26, bd: 0.55, leg: 0.32, head: [0.16, 0.18, 0.24], c: '#f1e3c6', horns: 0.14, ears: 'flop', tail: 0.1 }), speed: 0.45 },
  moutons: { parts: quad({ bw: 0.32, bh: 0.3, bd: 0.6, leg: 0.3, head: [0.16, 0.18, 0.22], c: '#e9ddc8', legC: '#5c4033', ears: 'flop', wool: true, tail: 0.08 }), speed: 0.4 },
  porcs: { parts: quad({ bw: 0.42, bh: 0.36, bd: 0.75, leg: 0.18, head: [0.3, 0.26, 0.24], c: '#f4c2c2', snout: '#e599a6', ears: 'flop', tail: 0.06 }), speed: 0.35 },
  boeufs: { parts: quad({ bw: 0.6, bh: 0.6, bd: 1.3, leg: 0.6, head: [0.3, 0.32, 0.42], c: '#e9ddc8', legC: '#6b4a2a', horns: 0.22, hump: true, ears: 'flop', tail: 0.4 }), speed: 0.35 },
}

export const INSTANCED = new Set(Object.keys(SPECS))

type Beast = { x: number; z: number; r: number; tx: number; tz: number; wait: number; small: boolean; seed: number }
const GEO = new THREE.BoxGeometry(1, 1, 1)
const MAT = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true })

/**
 * A pen's herd, its middle at the origin, the pen w × d (front +z). `out`: led out to the pasture, the points
 * they go round to (the pen's frame), else in the pen.
 */
export function Troupeau({ kind, n, young = 0, tired, w, d, seed = 0, out }: { kind: string; n: number; young?: number; tired?: boolean; w: number; d: number; seed?: number; out?: [number, number][] }) {
  const spec = SPECS[kind]
  const count = Math.min(kind === 'poules' || kind === 'pintades' || kind === 'lapins' ? 10 : 6, n + Math.min(young, 3))
  const big = Math.min(count, n)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const beasts = useMemo(() => {
    let s = seed * 7919 + 17
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: count }, (_, i): Beast => {
      const x = (r() - 0.5) * (w - 1.2)
      const z = (r() - 0.5) * (d - 1.2)
      return { x, z, r: r() * 6.3, tx: x, tz: z, wait: r() * 4, small: i >= big, seed: r() * 10 }
    })
  }, [count, big, w, d, seed])
  const parts = spec?.parts ?? []
  const total = count * parts.length
  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const c = new THREE.Color()
    beasts.forEach((_, b) => parts.forEach((p, j) => m.setColorAt(b * parts.length + j, c.set(p[6]))))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [beasts, parts])
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), q: new THREE.Quaternion(), v: new THREE.Vector3() }), [])
  useFrame(({ clock }, dt0) => {
    const m = mesh.current
    if (!m || !spec) return
    const dt = Math.min(dt0, 0.1)
    const t = clock.elapsedTime
    beasts.forEach((a, b) => {
      // On to the next spot: in the pen, or round the pasture (each its own place in the line behind the herder).
      const dx = a.tx - a.x
      const dz = a.tz - a.z
      const far = Math.hypot(dx, dz)
      const going = far > 0.08 && a.wait <= 0 && !tired
      if (going) {
        const v = spec.speed * (out ? 1.6 : 1) * (a.small ? 1.2 : 1)
        const k = Math.min(1, (v * dt) / far)
        a.x += dx * k
        a.z += dz * k
        const want = Math.atan2(dx, dz)
        let dr = want - a.r
        dr = Math.atan2(Math.sin(dr), Math.cos(dr))
        a.r += dr * Math.min(1, dt * 4)
      } else if (a.wait > 0) a.wait -= dt
      else if (!tired) {
        // Arrived: a while grazing, then somewhere else.
        a.wait = 2 + ((a.seed * 13.7 + t) % 6)
        if (out?.length) {
          const p = out[Math.floor((t / 9 + b * 0.37) % out.length)]
          a.tx = p[0] + Math.sin(b * 2.1) * 1.4
          a.tz = p[1] + Math.cos(b * 1.7) * 1.4
        } else {
          a.tx = Math.sin(t * 0.37 + a.seed * 3.1) * (w / 2 - 0.6)
          a.tz = Math.cos(t * 0.29 + a.seed * 2.3) * (d / 2 - 0.6)
        }
      }
      const graze = tired ? 1 : going ? 0 : Math.max(0, Math.sin(t * 0.8 + a.seed * 4))
      const hop = spec.hop && going ? Math.abs(Math.sin(t * 9 + a.seed)) * 0.08 : 0
      const sc = a.small ? 0.6 : 1
      const cos = Math.cos(a.r)
      const sin = Math.sin(a.r)
      parts.forEach((p, j) => {
        let [px, py, pz] = [p[0], p[1], p[2]]
        if (p[7]) {
          // The head down to the grass (and a bird's pecking), forward a little.
          py -= graze * (kind === 'poules' || kind === 'pintades' ? 0.1 : 0.16)
          pz += graze * 0.05
        }
        px *= sc
        py = py * sc + hop
        pz *= sc
        tmp.o.position.set(a.x + px * cos + pz * sin, py, a.z - px * sin + pz * cos)
        tmp.o.rotation.set(0, a.r, 0)
        tmp.o.scale.set(p[3] * sc, p[4] * sc, p[5] * sc)
        tmp.o.updateMatrix()
        m.setMatrixAt(b * parts.length + j, tmp.o.matrix)
      })
    })
    m.instanceMatrix.needsUpdate = true
  })
  // Led out: off they go (and back in after), from where they stand.
  useEffect(() => {
    beasts.forEach((a, b) => {
      a.wait = b * 0.4
      if (!out?.length) {
        a.tx = Math.sin(b * 2.4) * (w / 2 - 0.8)
        a.tz = Math.cos(b * 1.9) * (d / 2 - 0.8)
      }
    })
  }, [out, beasts, w, d])
  if (!spec || total === 0) return null
  return <instancedMesh key={total} ref={mesh} args={[GEO, MAT, total]} frustumCulled={false} />
}
