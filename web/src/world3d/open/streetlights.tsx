import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { clearObstacles, setObstacles } from '../obstacles'
import * as THREE from 'three'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// Street lights (lampadaires) along the real streets: on its concrete foot
// at the edge of the pavement, a tapered grey pole, its neck bending out
// over the road and the long « cobra » head with its lens underneath, every
// 30-odd metres, one side then the other. At night the lamps glow and each throws
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
const GLASS = new THREE.Color('#9aa4ad')

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
        // Not inside a building (the map's, the game's own, a landmark's), on a pitch, in another road or in the water (unless on a bridge).
        if (!y && (!nav.free(x, z, 0.6) || nav.onRoadway([x, z], 0.3))) continue
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

  const feet = useRef<THREE.InstancedMesh>(null)
  const poles = useRef<THREE.InstancedMesh>(null)
  const necks = useRef<THREE.InstancedMesh>(null)
  const arms = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const lenses = useRef<THREE.InstancedMesh>(null)
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
    const xAxis = new THREE.Vector3(1, 0, 0)
    const one = new THREE.Vector3(1, 1, 1)
    // The neck leans out and up from the top of the pole; the arm and the head tilt up a little, as they do.
    const neckTilt = new THREE.Quaternion().setFromAxisAngle(xAxis, -0.75)
    const armTilt = new THREE.Quaternion().setFromAxisAngle(xAxis, -0.08)
    const at = (l: Lamp, fwd: THREE.Vector3, out: number, up: number) => new THREE.Vector3(l.x + fwd.x * out, l.y + up, l.z + fwd.z * out)
    shown.forEach((l, i) => {
      q.setFromAxisAngle(yAxis, l.rot)
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
      feet.current?.setMatrixAt(i, m.compose(at(l, fwd, 0, 0.3), q, one))
      poles.current?.setMatrixAt(i, m.compose(at(l, fwd, 0, 3.6), q, one))
      necks.current?.setMatrixAt(i, m.compose(at(l, fwd, 0.28, 7.42), q.clone().multiply(neckTilt), one))
      arms.current?.setMatrixAt(i, m.compose(at(l, fwd, 1.15, 7.72), q.clone().multiply(armTilt), one))
      heads.current?.setMatrixAt(i, m.compose(at(l, fwd, 2.05, 7.8), q.clone().multiply(armTilt), one))
      lenses.current?.setMatrixAt(i, m.compose(at(l, fwd, 2.08, 7.71), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI / 2 - 0.08)), one))
      pools.current?.setMatrixAt(i, m.compose(at(l, fwd, 2.4, 0.08), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, l.rot)), one))
      // A lamp in a cut zone: its lens, pool, halo and cone black (added light: nothing shows).
      const c = dark?.(l.x, l.z) ? OUT : l.led ? LED : SODIUM
      pools.current?.setColorAt(i, c)
      lenses.current?.setColorAt(i, night ? (dark?.(l.x, l.z) ? GLASS : c) : GLASS)
      // The halo, round the lens.
      const [hx, hy, hz] = [l.x + fwd.x * 2.08, l.y + 7.6, l.z + fwd.z * 2.08]
      halos.attributes.position.setXYZ(i, hx, hy, hz)
      halos.attributes.color.setXYZ(i, c.r, c.g, c.b)
      if (i < CONES) {
        cones.current?.setMatrixAt(i, m.compose(new THREE.Vector3(hx, l.y + 3.8, hz), new THREE.Quaternion(), one))
        cones.current?.setColorAt(i, c)
      }
    })
    for (const r of [feet, poles, necks, arms, heads, lenses, pools, cones]) {
      if (!r.current) continue
      r.current.count = r === cones ? Math.min(CONES, shown.length) : shown.length
      r.current.instanceMatrix.needsUpdate = true
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true
    }
    halos.attributes.position.needsUpdate = true
    halos.attributes.color.needsUpdate = true
    halos.setDrawRange(0, shown.length)
    halos.computeBoundingSphere()
  }, [shown, halos, dark, night])

  const mats = useMemo(
    () => ({
      foot: new THREE.MeshLambertMaterial({ color: '#a7a297' }),
      pole: new THREE.MeshLambertMaterial({ color: '#7b8088' }),
      head: new THREE.MeshLambertMaterial({ color: '#c9ced4' }),
      // The lens: lit by its own colour at night (sodium, LED), glass by day; never shaded.
      lens: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, side: THREE.DoubleSide }),
      pool: new THREE.MeshBasicMaterial({ map: poolTexture(), color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
      halo: new THREE.PointsMaterial({ map: poolTexture(), size: 4.2, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      cone: new THREE.MeshBasicMaterial({ map: coneTexture(), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    }),
    [],
  )

  return (
    <>
      <instancedMesh ref={feet} args={[undefined, mats.foot, MAX]} frustumCulled={false}>
        <boxGeometry args={[0.44, 0.6, 0.44]} />
      </instancedMesh>
      <instancedMesh ref={poles} args={[undefined, mats.pole, MAX]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.075, 0.15, 7.2, 8]} />
      </instancedMesh>
      <instancedMesh ref={necks} args={[undefined, mats.pole, MAX]} frustumCulled={false}>
        <boxGeometry args={[0.09, 0.09, 0.75]} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, mats.pole, MAX]} frustumCulled={false}>
        <boxGeometry args={[0.09, 0.09, 1.3]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, mats.head, MAX]} castShadow frustumCulled={false}>
        <boxGeometry args={[0.44, 0.17, 0.92]} />
      </instancedMesh>
      <instancedMesh ref={lenses} args={[undefined, mats.lens, MAX]} frustumCulled={false}>
        <planeGeometry args={[0.4, 0.78]} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[undefined, mats.pool, MAX]} visible={night} frustumCulled={false}>
        <circleGeometry args={[6, 24]} />
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
