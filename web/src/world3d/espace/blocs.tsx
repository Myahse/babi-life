import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import type { Pose } from '../../avatar/Human'
import { Character } from '../Character'
import { Combinaison } from './Combinaison'
import { buildPirogue, setFlame } from './calao'

// The little kit of the scenes up there (Station.tsx, Lune.tsx, Mars.tsx): a block, the zero-g pad's thrust,
// the Sim floating (the station) or bounding in a suit (the Moon's sixth of a g, Mars's third).

type V3 = [number, number, number]

/** One block. */
export function B({ p, s, c, r, glow, o }: { p: V3; s: V3; c: string; r?: V3; glow?: boolean; o?: number }) {
  return (
    <mesh position={p} rotation={r}>
      <boxGeometry args={s} />
      {glow ? <meshBasicMaterial color={c} toneMapped={false} transparent={o !== undefined} opacity={o ?? 1} /> : <meshLambertMaterial color={c} transparent={o !== undefined} opacity={o ?? 1} />}
    </mesh>
  )
}

/** The zero-g pad (SpaceWorld's buttons): the thrust held now, each axis -1..1; jump: a big leap asked (Moon, Mars). */
export const pad = { x: 0, y: 0, z: 0, jump: 0 }

/** Where the Sim floats now (the camera follows it). */
export const floater = { pos: new THREE.Vector3(0, 1.2, 0), vel: new THREE.Vector3() }

/**
 * The Sim floating in a module: the pad pushes it, nothing slows it much (a little air), the walls send it back
 * gently; it tumbles slowly. bounds: the half-sizes of the room it floats in, round `home`.
 */
export function Flotteur({ look, gender, moodColor, bounds, home, pose = 'swim', still }: { look: Look; gender: 'femme' | 'homme'; moodColor?: string; bounds: V3; home: V3; pose?: Pose; /** Held where it is (sleeping, on the treadmill): no float. */ still?: boolean }) {
  const me = useRef<THREE.Group>(null)
  const spin = useRef(0)
  useFrame(({ clock }, dt) => {
    const g = me.current
    if (!g) return
    const d = Math.min(0.05, dt)
    const t = clock.elapsedTime
    if (still) {
      floater.pos.set(...home)
      floater.vel.set(0, 0, 0)
      g.position.set(home[0], home[1] + Math.sin(t * 0.7) * 0.04, home[2])
      return
    }
    floater.vel.x += pad.x * 3.2 * d
    floater.vel.y += pad.y * 3.2 * d
    floater.vel.z += pad.z * 3.2 * d
    floater.vel.multiplyScalar(1 - 0.35 * d)
    floater.pos.addScaledVector(floater.vel, d)
    for (let k = 0; k < 3; k++) {
      const lo = home[k] - bounds[k]
      const hi = home[k] + bounds[k]
      const v = floater.pos.getComponent(k)
      if (v < lo || v > hi) {
        floater.pos.setComponent(k, Math.max(lo, Math.min(hi, v)))
        floater.vel.setComponent(k, -floater.vel.getComponent(k) * 0.4)
      }
    }
    // A slow drift even with nobody pushing: zero g.
    g.position.set(floater.pos.x, floater.pos.y + Math.sin(t * 0.8) * 0.12, floater.pos.z)
    spin.current += d * (0.15 + floater.vel.length() * 0.2)
    g.rotation.set(Math.sin(t * 0.3) * 0.25 + floater.vel.z * 0.15, spin.current, Math.sin(t * 0.4) * 0.15 - floater.vel.x * 0.15)
  })
  return (
    <group ref={me} position={home}>
      <group position={[0, -1, 0]}>
        <Character look={look} gender={gender} moodColor={moodColor} marker={false} pose={pose} />
      </group>
    </group>
  )
}

/**
 * Out on the Moon or Mars, in the suit: slow big bounds (gravity: 1.62 m/s² the Moon, 3.71 Mars), a big leap
 * when the pad's « sauter » is pressed, walking round a little circle.
 */
export function Bondisseur({ look, gravity, at = [0, 0, 0], radius = 3 }: { look?: Look; gravity: number; at?: V3; radius?: number }) {
  const me = useRef<THREE.Group>(null)
  const st = useRef({ y: 0, vy: 0, a: 0, walk: 0 })
  useFrame((_, dt) => {
    const g = me.current
    if (!g) return
    const d = Math.min(0.05, dt)
    const s = st.current
    if (s.y <= 0) {
      s.y = 0
      s.vy = pad.jump ? 5.5 : 2.2
      pad.jump = 0
    }
    s.vy -= gravity * d
    s.y = Math.max(0, s.y + s.vy * d)
    s.a += d * (0.25 + pad.x * 0.4)
    s.walk += d * 3
    const x = at[0] + Math.cos(s.a) * radius
    const z = at[2] + Math.sin(s.a) * radius
    g.position.set(x, at[1] + s.y, z)
    g.rotation.y = -s.a
    floater.pos.set(x, at[1] + s.y + 1, z)
  })
  return (
    <group ref={me}>
      <Combinaison look={look} walk={Math.sin(st.current.walk)} />
    </group>
  )
}

/** C's Pirogue (calao.ts) as a scene's block: docked at the station, landed on Mars (its shield down at y 0, ~3.3 wide). */
export function Pirogue({ scale = 1 }: { scale?: number }) {
  const p = useMemo(() => {
    const parts = buildPirogue()
    setFlame(parts.retro, 0)
    return parts
  }, [])
  return (
    <group scale={scale}>
      <primitive object={p.root} />
    </group>
  )
}
