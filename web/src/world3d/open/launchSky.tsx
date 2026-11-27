import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { keyOpenNow } from '../../lib/features'
import { ESPACE_KEY, LAUNCH_DEFAULTS, launchesBetween, type Launch } from '../../lib/espace'
import { toLocal, type Origin } from './geo'
import { rumble } from '../espace/rumble'
import { flameMaterial, mergeBoxes } from '../espace/calao'

// The launches seen from the street (the update « espace », lib/espace.ts's timetable, crewed and cargo alike):
// within 300 km of a spaceport, the Calao climbs over the horizon in the pad's direction and bends away downrange
// (south over the Gulf of Guinea from Sassandra, east over the Atlantic from Kourou and Canaveral, north-east
// over the steppe from Baïkonour). By day a white plume in blocks that lingers and drifts; by night an orange
// glow at its head and a pale trail. The rumble comes later with the distance (sound at 343 m/s: about three
// minutes after from San-Pédro, ten from Abidjan), fainter the farther.
//
// The sky's things are drawn on a sphere round the camera (SKY_AT m away, no fog), each at the angle the real
// rocket would be at: its height (km), its distance downrange, the Earth's curve hiding the low part far away.

const WITHIN_M = 300_000
/** Minutes a launch shows: the ascent (8) and the plume fading after. */
const SHOWN_MIN = 12
const ASCENT_MIN = 8
const SKY_AT = 2400
const EARTH_R_KM = 6371
/** Each trail's puffs (one every few seconds of the climb). */
const PUFFS = 96

// The pads (backend world/espaceTerre.go) and where their rockets head (azimuth, degrees from north).
export const LAUNCH_PADS: Record<string, { at: [number, number]; azimuth: number }> = {
  sassandra: { at: [4.988, -6.047], azimuth: 180 },
  kourou: { at: [5.255, -52.785], azimuth: 80 },
  'cap-canaveral': { at: [28.49, -80.575], azimuth: 60 },
  baikonour: { at: [45.95, 63.42], azimuth: 50 },
}

/** The rocket's height and distance downrange (km), t minutes after ignition. */
export function trajectory(t: number): { h: number; down: number } {
  const k = Math.max(0, Math.min(1, t / ASCENT_MIN))
  return { h: 200 * Math.pow(k, 1.3), down: 1200 * k * k }
}

/** Where (unit vector, scene axes: x east, y up, z south) the rocket is seen from here, and how far (km). */
function seen(pad: { x: number; z: number }, az: number, t: number, out: THREE.Vector3): number {
  const { h, down } = trajectory(t)
  const a = (az * Math.PI) / 180
  // East is +x, north is −z.
  const x = pad.x / 1000 + Math.sin(a) * down
  const z = pad.z / 1000 - Math.cos(a) * down
  const ground = Math.hypot(x, z)
  // The Earth's curve: far off, the horizon hides the bottom.
  const y = h - (ground * ground) / (2 * EARTH_R_KM)
  out.set(x, y, z)
  const d = out.length()
  out.divideScalar(Math.max(1e-6, d))
  return d
}

const puffGeo = new THREE.BoxGeometry(1, 1, 1)
/** The engines' light seen from afar: a white-hot core, a yellow glow, a wide dim orange halo (added light, one draw). */
let headGeo: THREE.BufferGeometry | null = null
const headGeometry = () =>
  (headGeo ??= mergeBoxes(
    [
      [0, 0, 0, 3.2, 3.2, 3.2, '#3a1800'],
      [0, 0, 0, 2.2, 2.6, 2.2, '#7a3a00'],
      [0, -0.4, 0, 1.2, 2.2, 1.2, '#b8860b'],
      [0, 0, 0, 0.7, 0.9, 0.7, '#fff4d6'],
    ],
    0,
  ))
/** Two puffs per point of the trail, each a little off the line and its own size: the smoke billows. */
const JIT = Array.from({ length: PUFFS * 2 }, (_, i) => {
  const h = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return { x: h(1) - 0.5, y: h(2) - 0.5, z: h(3) - 0.5, k: 0.75 + h(4) * 0.5, g: h(5) * 0.08 }
})

function Plume({ origin, l, night }: { origin: Origin; l: Launch; night: boolean }) {
  const pad = LAUNCH_PADS[l.spaceport]
  const p = useMemo(() => {
    const [x, z] = toLocal(origin, pad.at[0], pad.at[1])
    return { x, z }
  }, [origin, pad])
  const group = useRef<THREE.Group>(null)
  const puffs = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.Mesh>(null)
  // By day white smoke; by night a glow (added light), hot by the head, the trail fading behind.
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: night ? 0.9 : 0.85, fog: false, depthWrite: false, blending: night ? THREE.AdditiveBlending : THREE.NormalBlending }), [night])
  useEffect(() => () => mat.dispose(), [mat])
  const tmp = useMemo(() => ({ p2: new THREE.Vector3(), v: new THREE.Vector3(), prev: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), c: new THREE.Color(), hot: new THREE.Color('#ffb347'), cold: new THREE.Color('#5c3d22'), smoke: new THREE.Color('#f8f9fa'), grey: new THREE.Color('#d0d5db') }), [])
  useFrame(({ camera }) => {
    const g = group.current
    if (!g || !puffs.current || !head.current) return
    const { v, prev, m, q, s, c, p2 } = tmp
    const min = worldTime() / 60 - l.at
    g.visible = min >= 0 && min < SHOWN_MIN
    if (!g.visible) return
    // On the sphere round the camera.
    g.position.copy(camera.position)
    const climb = Math.min(min, ASCENT_MIN)
    const fade = min > ASCENT_MIN ? 1 - (min - ASCENT_MIN) / (SHOWN_MIN - ASCENT_MIN) : 1
    let shown = 0
    prev.set(0, 0, 0)
    for (let i = 0; i < PUFFS; i++) {
      const t = (i / (PUFFS - 1)) * climb
      const d = seen(p, pad.azimuth, t, v)
      if (v.y < -0.005) continue
      // The smoke spreads as it ages and drifts a little with the wind (westward); thinner high up.
      const age = min - t
      const km = (0.6 + age * 0.5) * (t < 2 ? 1 : 0.6)
      v.multiplyScalar(SKY_AT)
      v.x -= age * 6
      // Never gaps between the puffs: at least as big as the step from the last one.
      const step = shown ? v.distanceTo(prev) * 1.3 : 0
      prev.copy(v)
      const size = Math.max(3, (km / d) * SKY_AT, step)
      // Its colour: by night hot near the head, dim behind; by day white, greyer as it ages, a little sun on it.
      const k = climb > 0 ? t / climb : 1
      for (let j = 0; j < 2; j++) {
        const J = JIT[i * 2 + j]
        const z = size * J.k * (j ? 0.8 : 1.05)
        p2.set(v.x + J.x * size * 0.45, v.y + J.y * size * 0.35, v.z + J.z * size * 0.45)
        s.set(z, z * 0.9, z)
        m.compose(p2, q, s)
        if (night) c.copy(tmp.cold).lerp(tmp.hot, Math.pow(k, 3) * (min < ASCENT_MIN ? 1 : 0.3)).multiplyScalar(0.55 + J.g * 2)
        else c.copy(tmp.grey).lerp(tmp.smoke, k * 0.8 + J.g * 2)
        puffs.current.setColorAt(shown, c)
        puffs.current.setMatrixAt(shown++, m)
      }
    }
    if (puffs.current.instanceColor) puffs.current.instanceColor.needsUpdate = true
    puffs.current.count = shown
    puffs.current.instanceMatrix.needsUpdate = true
    mat.opacity = (night ? 0.9 : 0.8) * fade
    // The head: the engines' light, while they burn.
    const d = seen(p, pad.azimuth, climb, v)
    head.current.visible = min < ASCENT_MIN && v.y > -0.005
    head.current.position.copy(v).multiplyScalar(SKY_AT)
    head.current.scale.setScalar(Math.max(night ? 9 : 6, (1.4 / d) * SKY_AT) * (1 + 0.12 * Math.sin(min * 300)))
    head.current.lookAt(camera.position)
  })
  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={puffs} args={[puffGeo, mat, PUFFS * 2]} frustumCulled={false} renderOrder={-1} />
      <mesh ref={head} geometry={headGeometry()} material={flameMaterial()} frustumCulled={false} />
    </group>
  )
}

/** The rumble, once per launch, when the sound gets here (espace/rumble.ts). */
function useRumble(near: { id: string; km: number }[], shown: Launch[]) {
  const done = useRef(new Set<string>())
  useEffect(() => {
    const timers = shown.flatMap((l) => {
      const n = near.find((x) => x.id === l.spaceport)
      const key = `${l.spaceport}:${l.at}:${l.crewed}`
      if (!n || done.current.has(key)) return []
      const wait = (l.at * 60 + (n.km * 1000) / 343 - worldTime()) * 1000
      // Already long past (the street opened late): no sound.
      if (wait < -20_000) return []
      return [
        setTimeout(() => {
          done.current.add(key)
          rumble(Math.max(0.05, Math.pow(1 - n.km / 300, 2)), n.km < 30 ? 14 : 9)
        }, Math.max(0, wait)),
      ]
    })
    return () => timers.forEach(clearTimeout)
  }, [near, shown])
}

/** The launches in sight from here now (the list asked again every half-minute, not every frame). */
export function LaunchSky({ origin, night, force }: { origin: Origin; night: boolean; /** Shown whatever the update says (the labs). */ force?: boolean }) {
  const near = useMemo(
    () =>
      LAUNCH_DEFAULTS.spaceports
        .map((s) => ({ id: s.id, km: Math.hypot(...toLocal(origin, LAUNCH_PADS[s.id].at[0], LAUNCH_PADS[s.id].at[1])) / 1000 }))
        .filter((s) => s.km * 1000 < WITHIN_M),
    [origin],
  )
  const [tick, setTick] = useState(() => Math.floor(worldTime() / 30))
  useEffect(() => {
    if (!near.length) return
    const id = setInterval(() => setTick(Math.floor(worldTime() / 30)), 5000)
    return () => clearInterval(id)
  }, [near.length])
  const shown = useMemo(() => {
    if (!near.length || (!force && !keyOpenNow(ESPACE_KEY))) return []
    const minute = Math.floor((tick * 30) / 60)
    // (Back as far as the sound's own delay: from 300 km it comes ~15 min after.)
    return launchesBetween(minute - SHOWN_MIN - 16, minute + 2).filter((l) => !l.scrub && near.some((n) => n.id === l.spaceport))
  }, [near, tick, force])
  useRumble(near, shown)
  return (
    <>
      {shown.map((l) => (
        <Plume key={`${l.spaceport}:${l.at}:${l.crewed}`} origin={origin} l={l} night={night} />
      ))}
    </>
  )
}
