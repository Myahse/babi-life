import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { Box, Mat } from '../../world3d/props'
import { sceneDpr, weakDevice } from '../../lib/device'

// Le godé's table in the game's 3D blocks (screens/GodeApp.tsx against the man of the maquis, components/pvp
// against a player): the wooden table seen from one's seat, the other's godet across it, one's own near.
// Each godet is the leather cup, upside down over its die: while it's shaken it rattles in the air over
// the table, then it's slammed down (a knock, a puff of dust blocks, the cup squashed a blink); lifted, it
// rises and tips back, and the die is there, face up, settling with a wobble. The dice of the throws before
// (a tie) lie small beside it. One's own godet can be tapped (the throw, `onTap`).

/** How long the shake lasts before the slam (the godé's own timing, GodeApp's SHAKE). */
export const GODE_SHAKE = 900

export type GodeSeat = { /** The die out (shown once the cup is lifted), or none yet. */ value: number | null; /** The cup in the air, shaking (it's slammed at the end). */ shaking: boolean; /** The dice before, the ties (small beside). */ past?: number[]; /** No round going on: the cup put aside a little, faded. */ idle?: boolean }

/** The pips of a face on a 3 × 3 grid (0..8, left to right, top to bottom). */
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
/** Where each face sits ([normal axis, sign]); 1 up, 6 down, 2 front, 5 back, 3 right, 4 left (opposites make 7). */
const FACE_AT: Record<number, [number, number]> = { 1: [1, 1], 6: [1, -1], 2: [2, 1], 5: [2, -1], 3: [0, 1], 4: [0, -1] }
/** The turn that brings each face up. */
const UP: Record<number, [number, number, number]> = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] }

const DIE = 0.34
/** A die of the game's blocks: the ivory cube, its pips little dark blocks set in each face (the 1 red). */
export function Die3D({ value, size = DIE }: { value: number; size?: number }) {
  const pips = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; red: boolean }[] = []
    const h = size / 2 + 0.002
    const step = size * 0.27
    const pip = size * 0.17
    for (let f = 1; f <= 6; f++) {
      const [axis, sign] = FACE_AT[f]
      for (const k of PIPS[f]) {
        const a = ((k % 3) - 1) * step
        const b = (Math.floor(k / 3) - 1) * step
        const p: [number, number, number] = [0, 0, 0]
        const s: [number, number, number] = [pip, pip, pip]
        p[axis] = h * sign
        s[axis] = 0.012
        // The two other axes hold the grid.
        const [u, v] = axis === 0 ? [2, 1] : axis === 1 ? [0, 2] : [0, 1]
        p[u] = a
        p[v] = b
        out.push({ p, s, red: f === 1 })
      }
    }
    return out
  }, [size])
  const r = UP[value] ?? UP[1]
  return (
    <group rotation={r}>
      <Box p={[0, 0, 0]} s={[size, size, size]} c="#fffaf0" />
      {/* The edges a little darker, the cube read as one */}
      <Box p={[0, 0, 0]} s={[size * 0.9, size * 1.012, size * 0.9]} c="#ece3cf" />
      {pips.map((x, i) => (
        <Box key={i} p={x.p} s={x.s} c={x.red ? '#d81b3f' : '#16161c'} />
      ))}
    </group>
  )
}

/** The godet: the leather cup, upside down (wide at the table), its two gold bands. */
function Cup() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.27, 0.34, 0.6, 8]} />
        <Mat color="#5a2e12" />
      </mesh>
      <mesh position={[0, 0.61, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 8]} />
        <Mat color="#7a4220" />
      </mesh>
      {[0.12, 0.42].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.34 - y * 0.115 + 0.012, 0.34 - y * 0.115 + 0.012, 0.045, 8]} />
          <Mat color="#ffcc33" />
        </mesh>
      ))}
    </group>
  )
}

const DUST = 7
/** One side's godet and die, living its throw. */
function Seat({ seat, z, near, onTap }: { seat: GodeSeat; z: number; near: boolean; onTap?: () => void }) {
  const cup = useRef<THREE.Group>(null)
  const die = useRef<THREE.Group>(null)
  const dust = useRef<THREE.Group>(null)
  const st = useRef({ shakeT: -1, upT: -1, wasShaking: false, value: seat.value, slammed: false, dust: Array.from({ length: DUST }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1 })) })
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    const s = st.current
    const c = cup.current
    const d = die.current
    if (!c || !d) return
    if (seat.shaking && !s.wasShaking) ((s.shakeT = 0), (s.slammed = false))
    if (!seat.shaking && s.wasShaking) s.upT = 0
    if (seat.value !== s.value && !seat.shaking) ((s.value = seat.value), (s.upT = 0))
    s.wasShaking = seat.shaking
    let y = 0
    let tilt = 0
    let x = 0
    let sq = 1
    if (seat.shaking) {
      s.shakeT += dt
      const ms = s.shakeT * 1000
      const slamAt = GODE_SHAKE - 170
      if (ms < slamAt) {
        // Up off the table, rattled round in little circles, faster and faster.
        const k = Math.min(1, ms / 140)
        const w = 26 + ms * 0.02
        y = 0.32 * k + Math.sin(s.shakeT * w * 1.3) * 0.05
        x = Math.sin(s.shakeT * w) * 0.07 * k
        tilt = Math.cos(s.shakeT * w) * 0.16 * k
      } else {
        // Slammed down: a blink to the table, squashed as it hits, the dust out from under.
        const k = Math.min(1, (ms - slamAt) / 70)
        y = 0.32 * (1 - k * k)
        if (k >= 1 && !s.slammed) {
          s.slammed = true
          for (const p of s.dust) {
            const a = Math.random() * Math.PI * 2
            const v = 0.9 + Math.random() * 0.8
            Object.assign(p, { x: Math.cos(a) * 0.32, y: 0.03, z: Math.sin(a) * 0.32, vx: Math.cos(a) * v, vy: 0.6 + Math.random() * 0.7, vz: Math.sin(a) * v, life: 0 })
          }
        }
        const after = (ms - slamAt - 70) / 1000
        sq = after > 0 ? 1 - 0.16 * Math.exp(-after * 18) * Math.cos(after * 40) : 1
      }
      d.visible = false
    } else if (seat.value) {
      // Lifted: up and tipped back toward its owner, the die there, settling.
      s.upT += dt
      const k = 1 - Math.exp(-s.upT * 9)
      y = 0.6 * k
      tilt = -0.55 * k
      x = 0.42 * k
      d.visible = true
      const wob = Math.exp(-s.upT * 7)
      d.rotation.set(Math.sin(s.upT * 30) * 0.2 * wob, 0.3 + Math.sin(s.upT * 21) * 0.25 * wob, 0)
      d.position.y = DIE / 2 + Math.abs(Math.sin(s.upT * 16)) * 0.08 * wob
    } else {
      d.visible = false
      // Waiting over the table, breathing a little; aside and down when no round is on.
      y = seat.idle ? 0 : Math.max(0, Math.sin(performance.now() / 380) * 0.012)
    }
    c.position.set(x, y, 0)
    c.rotation.set(near ? tilt : -tilt, 0, near ? 0 : tilt * 0.2)
    c.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6)
    // The dust: little blocks, out and down, fading.
    const g = dust.current
    if (g)
      s.dust.forEach((p, i) => {
        const m = g.children[i]
        if (!m) return
        if (p.life >= 1) return void (m.visible = false)
        p.life += dt * 1.8
        p.vy -= 4 * dt
        p.x += p.vx * dt
        p.y = Math.max(0.02, p.y + p.vy * dt)
        p.z += p.vz * dt
        m.visible = true
        m.position.set(p.x, p.y, p.z)
        m.scale.setScalar(1 - p.life)
      })
  })
  const past = seat.past ?? []
  return (
    <group position={[0, 0, z]}>
      <group ref={die} position={[0, DIE / 2, 0]} visible={false}>
        {seat.value && <Die3D value={seat.value} />}
      </group>
      <group ref={cup} onPointerDown={onTap ? (e) => (e.stopPropagation(), onTap()) : undefined}>
        <group scale={0.8}>
          <Cup />
        </group>
      </group>
      <group ref={dust}>
        {Array.from({ length: DUST }, (_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <Mat color="#d9b98a" />
          </mesh>
        ))}
      </group>
      {/* The dice of the throws before, small in a row on the side */}
      {past.map((v, i) => (
        <group key={i} position={[-0.75 - i * 0.24, 0.09, near ? 0.1 : -0.1]} rotation={[0, 0.4 * i - 0.3, 0]}>
          <Die3D value={v} size={0.18} />
        </group>
      ))}
    </group>
  )
}

/** The table: its wooden top, the planks, the other's side far, one's own near. */
export function GodeTable({ them, me, onTap, height = 230, className = '' }: { them: GodeSeat; me: GodeSeat; /** One's own godet tapped. */ onTap?: () => void; height?: number; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <Canvas dpr={weakDevice ? 1 : sceneDpr} gl={{ alpha: true, antialias: !weakDevice, powerPreference: 'low-power' }} camera={{ position: [0, 3.1, 2.3], fov: 36 }} onCreated={({ camera }) => camera.lookAt(0, 0, 0.05)} style={{ touchAction: 'manipulation' }}>
        <hemisphereLight args={['#fff2d6', '#5a3418', 1.5]} />
        <directionalLight position={[1.5, 4, 2.5]} intensity={1.9} />
        <ambientLight intensity={0.35} />
        <group>
          <Box p={[0, -0.08, 0]} s={[3.4, 0.16, 3]} c="#9a6a3c" />
          {[-1.1, -0.35, 0.4, 1.15].map((x) => (
            <Box key={x} p={[x, 0.002, 0]} s={[0.025, 0.006, 3]} c="#7a5230" />
          ))}
          <Box p={[0, -0.1, 1.52]} s={[3.44, 0.2, 0.06]} c="#6b4423" />
          <Box p={[0, -0.1, -1.52]} s={[3.44, 0.2, 0.06]} c="#6b4423" />
        </group>
        <Seat seat={them} z={-0.85} near={false} />
        <Seat seat={me} z={0.72} near onTap={onTap} />
      </Canvas>
    </div>
  )
}
