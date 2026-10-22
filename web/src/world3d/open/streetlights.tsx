import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { clearObstacles, setObstacles } from '../obstacles'
import * as THREE from 'three'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// Street lights (lampadaires) along the real streets: a grey pole at the
// edge of the pavement, an arm over the road and its lamp, every 30-odd
// metres, one side then the other. At night the lamps glow and each throws
// a pool of light on the street (most the old sodium orange, some the new
// white LEDs), a halo round the lamp that shows from far down the street,
// and up close a faint cone of light in the night air. No real lights: all
// of it is glowing, additive shapes, a few draws for the whole street. Only
// the ones around the Sim are drawn.

const SPACING = 32 // metres between two lamps along a street
const NEAR = 450 // metres: lamps drawn around the Sim
const MAX = 420
/** The nearest lamps also get their cone of light. */
const CONES = 70
const SODIUM = new THREE.Color('#ffb54d')
const OUT = new THREE.Color('#000000')
const LED = new THREE.Color('#e8f0ff')

type Lamp = { x: number; y: number; z: number; rot: number; led: boolean }

export function StreetLights({ nav, night, dark }: { nav: Nav; night: boolean; /** Where the power is cut (world3d/power.ts): those lamps stay out. */ dark?: (x: number, z: number) => boolean }) {
  // Every lamp of the loaded streets (not on paths and tracks).
  const all = useMemo(() => {
    const out: Lamp[] = []
    nav.edges.forEach((e) => {
      if (e.width < 6 || e.len < 14) return
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const [ya, yb] = [nav.ys[e.a] ?? 0, nav.ys[e.b] ?? 0]
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const phase = hash(Math.round(a[0] + b[0]), Math.round(a[1] + b[1])) * SPACING
      let k = 0
      for (let d = 7 + (phase % (SPACING - 7)); d < e.len - 7; d += SPACING, k++) {
        const side = (k + Math.round(phase)) % 2 ? 1 : -1
        const off = e.width / 2 + 1.1
        const [nx, nz] = [-uz * side, ux * side]
        const [x, z] = [a[0] + ux * d + nx * off, a[1] + uz * d + nz * off]
        const y = ya + (yb - ya) * (d / e.len)
        // Not inside a building, nor in the water (unless on a bridge).
        if (!y && !nav.walkable(x, z)) continue
        // The arm reaches over the road: it points back toward the middle.
        out.push({ x, y, z, rot: Math.atan2(-nx, -nz), led: hash(Math.round(x), Math.round(z), 77) < 0.3 })
      }
    })
    return out
  }, [nav])
  // A Sim walks round the posts.
  useEffect(() => {
    setObstacles('lamps', all.map((l) => ({ x: l.x, z: l.z, r: 0.25 })))
    return () => clearObstacles('lamps')
  }, [all])

  // The nearest to the Sim, refreshed as it walks.
  const [shown, setShown] = useState<Lamp[]>([])
  const last = useRef<XZ>([Infinity, Infinity])
  const tick = useRef(10)
  useEffect(() => {
    last.current = [Infinity, Infinity]
    tick.current = 10
  }, [all])
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 2) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    if (Math.hypot(sx - last.current[0], sz - last.current[1]) < 80) return
    last.current = [sx, sz]
    setShown(
      all
        .map((l) => ({ l, d: Math.hypot(l.x - sx, l.z - sz) }))
        .filter((x) => x.d < NEAR)
        .sort((a, b) => a.d - b.d)
        .slice(0, MAX)
        .map((x) => x.l),
    )
  })

  const poles = useRef<THREE.InstancedMesh>(null)
  const arms = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const pools = useRef<THREE.InstancedMesh>(null)
  const cones = useRef<THREE.InstancedMesh>(null)
  const halos = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX * 3), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(MAX * 3), 3))
    g.setDrawRange(0, 0)
    return g
  }, [])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const yAxis = new THREE.Vector3(0, 1, 0)
    shown.forEach((l, i) => {
      q.setFromAxisAngle(yAxis, l.rot)
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
      poles.current?.setMatrixAt(i, m.compose(new THREE.Vector3(l.x, l.y + 3.6, l.z), q, new THREE.Vector3(1, 1, 1)))
      arms.current?.setMatrixAt(i, m.compose(new THREE.Vector3(l.x + fwd.x * 0.9, l.y + 7.1, l.z + fwd.z * 0.9), q, new THREE.Vector3(1, 1, 1)))
      heads.current?.setMatrixAt(i, m.compose(new THREE.Vector3(l.x + fwd.x * 1.75, l.y + 6.95, l.z + fwd.z * 1.75), q, new THREE.Vector3(1, 1, 1)))
      pools.current?.setMatrixAt(i, m.compose(new THREE.Vector3(l.x + fwd.x * 2.4, l.y + 0.08, l.z + fwd.z * 2.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)))
      // A lamp in a cut zone: its pool, halo and cone black (added light: nothing shows).
      const c = dark?.(l.x, l.z) ? OUT : l.led ? LED : SODIUM
      pools.current?.setColorAt(i, c)
      // The halo, just under the lamp head.
      const [hx, hy, hz] = [l.x + fwd.x * 1.75, l.y + 6.8, l.z + fwd.z * 1.75]
      halos.attributes.position.setXYZ(i, hx, hy, hz)
      halos.attributes.color.setXYZ(i, c.r, c.g, c.b)
      if (i < CONES) {
        cones.current?.setMatrixAt(i, m.compose(new THREE.Vector3(hx, l.y + 3.45, hz), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)))
        cones.current?.setColorAt(i, c)
      }
    })
    for (const r of [poles, arms, heads, pools, cones]) {
      if (!r.current) continue
      r.current.count = r === cones ? Math.min(CONES, shown.length) : shown.length
      r.current.instanceMatrix.needsUpdate = true
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true
    }
    halos.attributes.position.needsUpdate = true
    halos.attributes.color.needsUpdate = true
    halos.setDrawRange(0, shown.length)
    halos.computeBoundingSphere()
  }, [shown, halos, dark])

  const mats = useMemo(
    () => ({
      pole: new THREE.MeshLambertMaterial({ color: '#7b8088' }),
      head: new THREE.MeshLambertMaterial({ color: '#d9dde2', emissive: '#ffd27a', emissiveIntensity: 0 }),
      pool: new THREE.MeshBasicMaterial({ map: poolTexture(), color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
      halo: new THREE.PointsMaterial({ map: poolTexture(), size: 4.2, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      cone: new THREE.MeshBasicMaterial({ map: coneTexture(), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    }),
    [],
  )
  useEffect(() => {
    mats.head.emissiveIntensity = night ? 1.6 : 0
    mats.head.color.set(night ? '#fff2cc' : '#d9dde2')
  }, [night, mats])

  return (
    <>
      <instancedMesh ref={poles} args={[undefined, mats.pole, MAX]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.09, 0.14, 7.2, 6]} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, mats.pole, MAX]} frustumCulled={false}>
        <boxGeometry args={[0.1, 0.1, 1.9]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, mats.head, MAX]} frustumCulled={false}>
        <boxGeometry args={[0.38, 0.16, 0.75]} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[undefined, mats.pool, MAX]} visible={night} frustumCulled={false}>
        <circleGeometry args={[5.5, 20]} />
      </instancedMesh>
      <points geometry={halos} material={mats.halo} visible={night} frustumCulled={false} />
      <instancedMesh ref={cones} args={[undefined, mats.cone, CONES]} visible={night} frustumCulled={false}>
        <cylinderGeometry args={[0.15, 3.4, 6.9, 14, 1, true]} />
      </instancedMesh>
    </>
  )
}

/** A soft round glow, bright in the middle, fading out. */
function poolTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** The cone of light under a lamp: faint at the top, a little brighter where it reaches the ground. */
function coneTexture() {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.15)')
  grad.addColorStop(1, 'rgba(255,255,255,0.7)')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 64)
  return new THREE.CanvasTexture(c)
}
