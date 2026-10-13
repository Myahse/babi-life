import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng, type Theme } from './themes'
import { EXTENT_X, SIDEWALK } from './layout'
import { Vehicle, type VehicleKind } from './props'

// What makes a street feel alive: people walking the sidewalks or chatting in
// small groups, and the traffic of taxis, woro-woros, gbakas and motos.

type Walker = { x: number; z: number; dir: number; speed: number; still: boolean; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number }

export function Pedestrians({ theme, seed }: { theme: Theme; seed: string }) {
  const people = useMemo<Walker[]>(() => {
    const r = rng(`people${seed}`)
    return [...Array(theme.pedestrians)].map(() => {
      const gender: Walker['gender'] = r() < 0.5 ? 'femme' : 'homme'
      return {
        x: (r() * 2 - 1) * 70,
        z: (r() < 0.5 ? -1 : 1) * (SIDEWALK + (r() - 0.5) * 0.8),
        dir: r() < 0.5 ? -1 : 1,
        speed: 1.1 + r() * 0.5,
        still: r() < 0.25,
        gender,
        look: randomLook(gender, r), // seeded: a commune keeps its regulars
        seed: r() * 100,
      }
    })
  }, [theme.pedestrians, seed])
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.25)
    people.forEach((p, i) => {
      const g = refs.current[i]
      if (!g || p.still) return
      p.x += p.dir * p.speed * step
      if (Math.abs(p.x) > 75) p.dir *= -1
      g.position.x = p.x
      g.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2
    })
  })

  return (
    <NoShadows>
      {people.map((p, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={[p.x, 0, p.z]} rotation={[0, p.still ? (p.z > 0 ? Math.PI : 0) + (p.seed % 1.5) - 0.75 : p.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.3, 12]} />
            <meshBasicMaterial color="#000" transparent opacity={0.15} />
          </mesh>
          <Human look={p.look} gender={p.gender} pose={p.still ? 'idle' : 'walk'} seed={p.seed} />
        </group>
      ))}
    </NoShadows>
  )
}

type Car = { kind: VehicleKind; color?: string; lane: number; speed: number; x: number }

export function Traffic({ theme, seed }: { theme: Theme; seed: string }) {
  const cars = useMemo<Car[]>(() => {
    const r = rng(`cars${seed}`)
    const kinds: VehicleKind[] = ['taxi', 'woro', 'woro', 'gbaka', 'car', 'car', 'moto']
    return [...Array(theme.vehicles)].map((_, i) => {
      const kind = kinds[Math.floor(r() * kinds.length)]
      return {
        kind,
        color: kind === 'woro' ? theme.woro : kind === 'car' ? ['#f8f9fa', '#212529', '#adb5bd', '#c92a2a', '#1c7ed6'][Math.floor(r() * 5)] : undefined,
        lane: i % 2 ? 2.2 : -2.2,
        speed: (kind === 'gbaka' ? 7 : kind === 'moto' ? 11 : 9) + r() * 3,
        x: (r() * 2 - 1) * EXTENT_X,
      }
    })
  }, [theme, seed])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.25)
    cars.forEach((c, i) => {
      const dir = c.lane > 0 ? 1 : -1
      c.x += dir * c.speed * step
      if (c.x > EXTENT_X) c.x = -EXTENT_X
      if (c.x < -EXTENT_X) c.x = EXTENT_X
      const g = refs.current[i]
      if (g) g.position.x = c.x
    })
  })
  return (
    <>
      {cars.map((c, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={[c.x, 0, c.lane]}>
          <Vehicle p={[0, 0, 0]} r={c.lane > 0 ? 0 : Math.PI} kind={c.kind} color={c.color} />
        </group>
      ))}
    </>
  )
}
