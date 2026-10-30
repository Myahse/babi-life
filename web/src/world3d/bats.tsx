import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from './props'

// The Plateau's fruit bats (the update « plateau-vivant »), in the game's blocks: a brown body, a
// lighter ruff, the head with its two ears and its little dark eyes, the two wings of thin dark
// boxes. Hanging upside down from a branch by day, wrapped in their wings; scared, they open them,
// drop and fly off, the wings beating. Never hurt: they go elsewhere.

const BODY = '#4a3326'
const RUFF = '#a0703d'
const WING = '#2b1d17'

/**
 * One bat, its body along z (the head at +z, the way it flies), the wings out along x: hanging (head
 * down, wrapped in its wings, swaying), alarmed (head down, the wings thrown open, trembling) or flying
 * (the wings beating). `beat`: its wingbeat's phase, given by whoever moves it.
 */
export function Bat({ state, beat = 0, scale = 1 }: { state: 'hang' | 'alarm' | 'fly'; beat?: number; scale?: number }) {
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + beat
    // About the body's own axis: wrapped round the belly, thrown out and trembling, or beating.
    const a = state === 'hang' ? -1.35 : state === 'alarm' ? 0.2 + Math.sin(t * 40) * 0.15 : Math.sin(t * 17) * 0.9
    if (left.current) left.current.rotation.z = -a
    if (right.current) right.current.rotation.z = a
    // Hanging: head down from the feet; flying: level.
    if (body.current) body.current.rotation.set(state === 'fly' ? 0.15 : Math.PI / 2, 0, state === 'hang' ? Math.sin(t * 1.3) * 0.08 : 0)
  })
  return (
    <group scale={scale}>
      <group ref={body}>
        <Box p={[0, 0, 0]} s={[0.16, 0.14, 0.28]} c={BODY} />
        <Box p={[0, 0.01, 0.12]} s={[0.18, 0.15, 0.08]} c={RUFF} />
        {/* The head, the snout, the ears, the eyes */}
        <Box p={[0, 0.02, 0.21]} s={[0.13, 0.12, 0.11]} c={RUFF} />
        <Box p={[0, 0, 0.29]} s={[0.06, 0.06, 0.06]} c={BODY} />
        <Box p={[-0.045, 0.1, 0.2]} s={[0.035, 0.07, 0.03]} c={WING} />
        <Box p={[0.045, 0.1, 0.2]} s={[0.035, 0.07, 0.03]} c={WING} />
        <Box p={[-0.032, 0.04, 0.267]} s={[0.025, 0.025, 0.01]} c="#111111" />
        <Box p={[0.032, 0.04, 0.267]} s={[0.025, 0.025, 0.01]} c="#111111" />
        {/* The feet, at the back, holding on */}
        <Box p={[-0.04, 0, -0.17]} s={[0.025, 0.025, 0.07]} c={WING} />
        <Box p={[0.04, 0, -0.17]} s={[0.025, 0.025, 0.07]} c={WING} />
        {/* The wings: from the shoulder out, two panels each */}
        <group ref={left} position={[-0.07, 0.02, 0.04]}>
          <Box p={[-0.17, 0, -0.04]} s={[0.34, 0.015, 0.22]} c={WING} />
          <Box p={[-0.38, 0, -0.1]} s={[0.12, 0.015, 0.14]} c={WING} />
        </group>
        <group ref={right} position={[0.07, 0.02, 0.04]}>
          <Box p={[0.17, 0, -0.04]} s={[0.34, 0.015, 0.22]} c={WING} />
          <Box p={[0.38, 0, -0.1]} s={[0.12, 0.015, 0.14]} c={WING} />
        </group>
      </group>
    </group>
  )
}

/** Where a roosting bat hangs: its feet (x, y, z) and the way it faces. */
export type Roost = { x: number; y: number; z: number; r: number }

const unit = new THREE.BoxGeometry(1, 1, 1)
/**
 * A colony hanging in the trees of the street, drawn cheaply: two instanced meshes (the bodies wrapped
 * in their wings, the ruffs and heads), each bat a little swaying, a few times a second.
 */
export function RoostingBats({ roosts }: { roosts: Roost[] }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const mats = useMemo(() => [new THREE.MeshLambertMaterial({ color: WING }), new THREE.MeshLambertMaterial({ color: RUFF })], [])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() }), [])
  const tick = useRef(1)
  useFrame(({ clock }, dt) => {
    tick.current += dt
    if (tick.current < 0.12) return
    tick.current = 0
    const t = clock.elapsedTime
    const { m, q, e, v, s } = tmp
    roosts.forEach((b, i) => {
      const sway = Math.sin(t * 1.3 + i * 1.7) * 0.1
      q.setFromEuler(e.set(0, b.r, sway))
      // Hanging from its feet: the body under them, wrapped, the head at the bottom.
      v.set(b.x - Math.sin(sway) * 0.24, b.y - 0.24, b.z)
      bodies.current?.setMatrixAt(i, m.compose(v, q, s.set(0.26, 0.42, 0.2)))
      v.set(b.x - Math.sin(sway) * 0.5, b.y - 0.52, b.z)
      heads.current?.setMatrixAt(i, m.compose(v, q, s.set(0.16, 0.14, 0.15)))
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
  })
  if (!roosts.length) return null
  return (
    <>
      <instancedMesh key={`b${roosts.length}`} ref={bodies} args={[unit, mats[0], roosts.length]} frustumCulled={false} />
      <instancedMesh key={`h${roosts.length}`} ref={heads} args={[unit, mats[1], roosts.length]} frustumCulled={false} />
    </>
  )
}
