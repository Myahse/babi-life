import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../lib/worldClock'

// The travaillement: banknotes flicked off a wad, a few at a time, over the
// dancers. The notes are 10 000 F CFA notes (15.5 × 7.5 cm, brown and
// orange), in pixels like everything else. Each flick sends a little fan of
// notes up and out; paper doesn't fall like a stone: after the throw a note
// slows, then flutters down, tumbling and drifting from side to side, and
// lies on the floor with the others until the pile is swept.
//
// Where every note is, is worked out from the shared clock and the seed
// alone (lib/worldClock.ts): every player sees the same notes fly.

const NOTE_W = 0.155
const NOTE_H = 0.075

/** A 10 000 F note in pixels: brown and orange, a portrait, the figures. */
const noteTexture = (() => {
  let t: THREE.CanvasTexture | null = null
  return () => {
    if (t) return t
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 16
    const g = c.getContext('2d')!
    const px = (x: number, y: number, w: number, h: number, col: string) => {
      g.fillStyle = col
      g.fillRect(x, y, w, h)
    }
    px(0, 0, 32, 16, '#c8823a')
    px(0, 0, 32, 1, '#8a4f1e')
    px(0, 15, 32, 1, '#8a4f1e')
    px(0, 0, 1, 16, '#8a4f1e')
    px(31, 0, 1, 16, '#8a4f1e')
    // Bands of colour, the watermark window, the portrait.
    px(2, 2, 9, 12, '#e3a85c')
    px(4, 4, 5, 7, '#7a4a22')
    px(5, 5, 3, 2, '#c8823a')
    px(13, 3, 16, 3, '#a8622a')
    px(13, 10, 6, 3, '#e7c27d')
    // « 10000 » in the corner, as pixels.
    for (const [x, on] of [[20, 1], [22, 1], [24, 1], [26, 1], [28, 1]] as const) if (on) px(x, 11, 1, 2, '#3e2410')
    px(19, 11, 1, 2, '#3e2410')
    for (let x = 0; x < 32; x += 3) px(x, 7, 1, 1, '#b06d2c')
    t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
})()

let noteMat: THREE.Material | null = null
const material = () => (noteMat ??= new THREE.MeshLambertMaterial({ map: noteTexture(), side: THREE.DoubleSide }))
const NOTE = new THREE.PlaneGeometry(NOTE_W, NOTE_H)

/** A stable 0..1 from a few numbers. */
function rnd(a: number, b: number, c: number) {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453
  return n - Math.floor(n)
}

/** The wad in the hand: a thick brown stack, the top note showing. */
export function Wad() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.16, 0.05, 0.08]} />
        <meshLambertMaterial color="#a8622a" />
      </mesh>
      <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material()} geometry={NOTE} />
    </group>
  )
}

type Props = {
  /** Where the notes leave the hand (in this group's frame). */
  from: [number, number, number]
  /** Which way they go (unit-ish, in this group's frame), and how far. */
  toward?: [number, number, number]
  /** Flicks a second. */
  rate?: number
  /** Notes in each flick. */
  fan?: number
  /** Seconds a note lies on the floor before the pile is swept (and the slot used again). */
  keep?: number
  seed?: number
}

/**
 * Notes flying from a hand. Flick k leaves at k / rate on the shared clock;
 * a note's path is a throw (a few tenths of a second, slowing), then a
 * flutter down at paper speed, then rest on the floor.
 */
export function NoteShower({ from, toward = [0, 0.4, -1], rate = 2.2, fan = 4, keep = 9, seed = 0 }: Props) {
  const flicks = Math.ceil((keep + 3) * rate)
  const count = flicks * fan
  const ref = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const dir = useMemo(() => new THREE.Vector3(...toward).normalize(), [toward])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = worldTime() + seed * 13.1
    const now = Math.floor(t * rate)
    for (let f = 0; f < flicks; f++) {
      const k = now - f // this flick's number
      const age = t - k / rate // seconds since it left the hand
      for (let n = 0; n < fan; n++) {
        const i = f * fan + n
        const r = (q: number) => rnd(k, n + seed, q)
        // The throw: up and out, spread in a fan.
        const spread = (r(1) - 0.5) * 1.3
        const speed = 2.2 + r(2) * 1.2
        const vx = (dir.x + spread * dir.z) * speed
        const vz = (dir.z - spread * dir.x) * speed
        const vy = 1.4 + dir.y * speed + r(3) * 0.8
        // Air stops a note quickly (drag), then it falls at ~0.9 m/s, swaying.
        const T = 0.45 // end of the throw
        const tt = Math.min(age, T)
        const drag = (1 - Math.exp(-3 * tt)) / 3
        let x = from[0] + vx * drag
        let z = from[2] + vz * drag
        let y = from[1] + vy * drag - 2.2 * tt * tt
        let tumble = age * (5 + r(4) * 6)
        if (age > T) {
          // It falls until it reaches the floor, and stops there.
          const fallSpeed = 0.75 + r(9) * 0.35
          const yT = from[1] + vy * ((1 - Math.exp(-3 * T)) / 3) - 2.2 * T * T
          const fall = Math.min(age - T, Math.max(0, yT / fallSpeed))
          const sway = Math.sin(fall * (3 + r(5) * 2) + r(6) * 6) * 0.18
          x += sway * Math.cos(r(7) * 6.28) + (r(8) - 0.5) * 0.3 * fall
          z += sway * Math.sin(r(7) * 6.28)
          y -= fall * fallSpeed
        }
        // On the floor: flat, still, where it landed.
        const landed = y <= 0.01
        if (landed) {
          y = 0.004 + (i % 7) * 0.0012
          tumble = 0
        }
        o.position.set(x, y, z)
        if (landed) o.rotation.set(-Math.PI / 2, 0, r(10) * 6.28)
        else o.rotation.set(tumble, tumble * 0.6 + r(11) * 3, Math.sin(tumble) * 0.5)
        // Not yet thrown, or swept: out of sight.
        o.scale.setScalar(age < 0 || age > keep + 2 ? 0 : 1)
        o.updateMatrix()
        mesh.setMatrixAt(i, o.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[NOTE, material(), count]} frustumCulled={false} />
}
