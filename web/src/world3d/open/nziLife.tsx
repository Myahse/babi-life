import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { worldTime } from '../../lib/worldClock'
import type { HerdPlan } from './wildlife'

// What makes the Réserve de la N'Zi live (nziReserve.tsx): the tall grass and the reeds swaying in the
// wind (one instanced mesh each, bent in the vertex shader: no work on the phone's side), the fireflies
// over the grass at night, and the herds' day (where each herd goes at what hour, on the shared clock:
// out grazing at dawn, down to the river to drink, lying in the shade at noon, back out in the evening,
// resting at night), so that two players see the same herd at the river at the same hour.

const WIND = { value: 0 }
/** The grass's and the reeds' material: lit like the rest, its tops bent by the wind (the higher, the more). */
const SWAY_MAT = (() => {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff' })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
  float k = max(0.0, position.y);
  float gust = 0.6 + 0.4 * sin(uWind * 0.23 + instanceMatrix[3].x * 0.02);
  transformed.x += sin(uWind * 1.7 + ph) * 0.22 * k * gust;
  transformed.z += cos(uWind * 1.2 + ph * 1.3) * 0.12 * k * gust;
#endif`,
    )
  }
  m.customProgramCacheKey = () => 'nzi-sway'
  return m
})()

/** A clump of blades: two thin crossed slabs, from the ground (y 0) up to 1. */
const CLUMP = (() => {
  const a = new THREE.BoxGeometry(1, 1, 0.12).translate(0, 0.5, 0)
  const b = new THREE.BoxGeometry(0.12, 0.8, 1).translate(0, 0.4, 0)
  const g = mergeGeometries([a, b], false)!
  g.deleteAttribute('uv')
  return g
})()
/** A reed: one tall thin stem and its seed head. */
const REED = (() => {
  const a = new THREE.BoxGeometry(0.08, 1, 0.08).translate(0, 0.5, 0)
  const b = new THREE.BoxGeometry(0.16, 0.18, 0.16).translate(0, 0.95, 0)
  const g = mergeGeometries([a, b], false)!
  g.deleteAttribute('uv')
  return g
})()

export type Tuft = { x: number; z: number; w: number; h: number; ry: number; c: string }

/** Swaying grass (or reeds): one instanced mesh, coloured per clump, bent by the wind in the shader. */
export function SwayGrass({ tufts, reeds = false }: { tufts: Tuft[]; reeds?: boolean }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(reeds ? REED : CLUMP, SWAY_MAT, tufts.length)
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    tufts.forEach((t, i) => {
      o.position.set(t.x, 0, t.z)
      o.rotation.set(0, t.ry, 0)
      o.scale.set(t.w, t.h, t.w)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, col.set(t.c))
    })
    m.receiveShadow = true
    return m
  }, [tufts, reeds])
  useEffect(() => () => mesh.dispose(), [mesh])
  useFrame(({ clock }) => void (WIND.value = clock.elapsedTime))
  return <primitive object={mesh} />
}

const FLY = new THREE.BoxGeometry(0.09, 0.09, 0.09)
const FLY_MAT = new THREE.MeshBasicMaterial({ color: '#dcff6e', toneMapped: false })
const FM = new THREE.Matrix4()
const FV = new THREE.Vector3()
const FQ = new THREE.Quaternion()
const FS = new THREE.Vector3()
/** Fireflies at night over the grass and the river's edge (`spots`): drifting, each blinking its own slow beat. */
export function Fireflies({ spots, night }: { spots: [number, number][]; night: boolean }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(FLY, FLY_MAT, spots.length)
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return m
  }, [spots.length])
  useEffect(() => () => mesh.dispose(), [mesh])
  mesh.visible = night
  useFrame(({ clock }) => {
    if (!night) return
    const t = clock.elapsedTime
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i]
      const blink = Math.max(0, Math.sin(t * (1.3 + (i % 5) * 0.21) + i * 1.7))
      FV.set(x + Math.sin(t * 0.3 + i) * 2.5, 0.8 + Math.sin(t * 0.5 + i * 0.7) * 0.5 + (i % 3) * 0.4, z + Math.cos(t * 0.27 + i * 1.3) * 2.5)
      FM.compose(FV, FQ, FS.setScalar(blink * blink * blink * 1.6))
      mesh.setMatrixAt(i, FM)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

/** Where a herd lives at the reserve: its grazing ground, its drinking place at the river, its shade for noon. */
export type Grounds = { graze: [number, number]; drink: [number, number]; shade: [number, number]; /** Its drinking hours shifted (minutes): the herds don't all go down at once. */ shift: number }
type Phase = 'graze' | 'drink' | 'shade' | 'night'
/** The herd's day, by the minute of the day: active at dawn and dusk, drinking morning and late afternoon, in the shade at noon, at rest by night. */
function phaseAt(m: number, shift: number): Phase {
  const s = ((m - shift) % 1440 + 1440) % 1440
  if (s < 5 * 60 + 30 || s >= 20 * 60) return 'night'
  if ((s >= 7 * 60 && s < 8 * 60 + 30) || (s >= 17 * 60 && s < 18 * 60 + 30)) return 'drink'
  if (s >= 11 * 60 + 30 && s < 15 * 60) return 'shade'
  return 'graze'
}

/** Sets a plan for a phase of the day: where, how close together, resting or drinking. */
function setPlan(p: HerdPlan, g: Grounds, phase: Phase) {
  const at = phase === 'drink' ? g.drink : phase === 'shade' ? g.shade : g.graze
  p.centre.x = at[0]
  p.centre.z = at[1]
  p.spread = phase === 'drink' ? 0.6 : phase === 'shade' ? 0.5 : 1
  p.rest = phase === 'shade' || phase === 'night'
  p.drink = phase === 'drink'
}

/** A plan for each herd (the object its brains read), kept up with the shared clock: one check a second, nothing made per frame. */
export function useHerdDays(grounds: Grounds[]): HerdPlan[] {
  const plans = useMemo(
    () =>
      grounds.map((g) => {
        const phase = phaseAt(worldTime() / 60, g.shift)
        const p: HerdPlan & { phase: Phase } = { id: 1, rest: false, drink: false, face: -Math.PI / 2, centre: { x: 0, z: 0 }, spread: 1, phase }
        setPlan(p, g, phase)
        return p
      }),
    [grounds],
  )
  const last = useRef(-1)
  useFrame(({ clock }) => {
    // (Once a second is plenty for an hour's plan.)
    const sec = Math.floor(clock.elapsedTime)
    if (sec === last.current) return
    last.current = sec
    const m = worldTime() / 60
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i]
      const phase = phaseAt(m, grounds[i].shift)
      if (phase === p.phase) continue
      p.phase = phase
      setPlan(p, grounds[i], phase)
      p.id++
    }
  })
  return plans
}
