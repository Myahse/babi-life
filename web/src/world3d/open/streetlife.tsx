import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// Life at the street side, around the Sim: le grin (men on benches around
// the teapot on its little stove), children playing football with a ball
// going from one to the other, and people standing in a ring, talking. They
// stand on the real streets, always at the same corners.

type Kind = 'grin' | 'foot' | 'causerie'
type Scene = { id: string; kind: Kind; at: XZ; rot: number; seed: number }
const NEAR = 260
const MAX = 4

export function StreetLife({ nav, seed }: { nav: Nav; seed: string }) {
  const all = useMemo(() => {
    const out: Scene[] = []
    for (const e of nav.edges) {
      if (e.width > 12 || e.len < 24 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const h = hash(Math.round(m[0]), Math.round(m[1]), 191)
      if (h > 0.09) continue
      const side = hash(Math.round(m[1]), 7) < 0.5 ? 1 : -1
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const off = e.width / 2 + 4.5
      const at: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
      if (!nav.walkable(at[0], at[1])) continue
      const kind: Kind = h < 0.03 ? 'grin' : h < 0.06 ? 'foot' : 'causerie'
      out.push({ id: `${seed}:${Math.round(at[0])}:${Math.round(at[1])}`, kind, at, rot: Math.atan2(ux, uz), seed: h * 1000 })
    }
    return out
  }, [nav, seed])
  const [shown, setShown] = useState<Scene[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 2) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.s)
    if (near.map((s) => s.id).join() !== shown.map((s) => s.id).join()) setShown(near)
  })
  return (
    <NoShadows>
      {shown.map((s) => (
        <group key={s.id} position={[s.at[0], 0, s.at[1]]} rotation={[0, s.rot, 0]}>
          {s.kind === 'grin' ? <Grin seed={s.id} /> : s.kind === 'foot' ? <Foot seed={s.id} /> : <Causerie seed={s.id} />}
        </group>
      ))}
    </NoShadows>
  )
}

const wood = new THREE.MeshLambertMaterial({ color: '#7a5233' })
const iron = new THREE.MeshLambertMaterial({ color: '#2a2a2a' })
const coal = new THREE.MeshLambertMaterial({ color: '#ff5a1a', emissive: '#ff3a00', emissiveIntensity: 0.8 })
const teapot = new THREE.MeshLambertMaterial({ color: '#3f8fd6' })
const ballMat = new THREE.MeshLambertMaterial({ color: '#f4f4f4' })

/** People of the scene: their looks, drawn from the scene's id. */
function useCast(seed: string, n: number, men = false) {
  return useMemo(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => {
      const gender: 'femme' | 'homme' = men || r() < 0.5 ? 'homme' : 'femme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [seed, n, men])
}

/** Le grin: three men on benches around the little stove and its teapot. */
function Grin({ seed }: { seed: string }) {
  const cast = useCast(seed, 3, true)
  return (
    <group>
      {/* The stove and the blue teapot, the small glasses on a stool */}
      <mesh material={iron} position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.36, 8]} />
      </mesh>
      <mesh material={coal} position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 8]} />
      </mesh>
      <mesh material={teapot} position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.13, 8, 6]} />
      </mesh>
      {cast.map((p, i) => {
        const a = (i / cast.length) * Math.PI * 2
        const [x, z] = [Math.sin(a) * 1.4, Math.cos(a) * 1.4]
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, a + Math.PI, 0]}>
            <mesh material={wood} position={[0, 0.22, 0.05]}>
              <boxGeometry args={[1.1, 0.06, 0.32]} />
            </mesh>
            {[-0.45, 0.45].map((lx) => (
              <mesh key={lx} material={wood} position={[lx, 0.1, 0.05]}>
                <boxGeometry args={[0.06, 0.2, 0.3]} />
              </mesh>
            ))}
            <group position={[0, -0.22, 0]}>
              <Human look={p.look} gender={p.gender} pose={i === 1 ? 'drink' : 'sit'} seed={p.seed} />
            </group>
          </group>
        )
      })}
    </group>
  )
}

/** Children playing football: the ball goes from one to the other. */
function Foot({ seed }: { seed: string }) {
  const cast = useCast(seed, 4)
  const spots: XZ[] = [[-3, -2], [3, -2.5], [2.5, 3], [-2.5, 2.5]]
  const ball = useRef<THREE.Mesh>(null)
  const [pass, setPass] = useState({ from: 0, to: 1 })
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1) / 1.1
    if (t.current >= 1) {
      t.current = 0
      const next = (pass.to + 1 + Math.floor(Math.random() * 2)) % spots.length
      setPass({ from: pass.to, to: next === pass.to ? (next + 1) % spots.length : next })
    }
    const [a, b] = [spots[pass.from], spots[pass.to]]
    const k = t.current
    ball.current?.position.set(a[0] + (b[0] - a[0]) * k, 0.12 + Math.sin(k * Math.PI) * 0.6, a[1] + (b[1] - a[1]) * k)
  })
  return (
    <group>
      {cast.map((p, i) => (
        <group key={i} position={[spots[i][0], 0, spots[i][1]]} rotation={[0, Math.atan2(-spots[i][0], -spots[i][1]), 0]} scale={0.62}>
          <Human look={p.look} gender={p.gender} pose={(i === pass.to ? 'cheer' : 'idle') as Pose} seed={p.seed} headScale={1.2} />
        </group>
      ))}
      <mesh ref={ball} material={ballMat}>
        <sphereGeometry args={[0.12, 8, 6]} />
      </mesh>
    </group>
  )
}

/** A few people standing in a ring, talking: the gbairai at the corner. */
function Causerie({ seed }: { seed: string }) {
  const cast = useCast(seed, 3)
  return (
    <group>
      {cast.map((p, i) => {
        const a = (i / cast.length) * Math.PI * 2 + 0.3
        const [x, z] = [Math.sin(a) * 0.85, Math.cos(a) * 0.85]
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, a + Math.PI, 0]}>
            <Human look={p.look} gender={p.gender} pose={i === 0 ? 'talk' : i === 1 ? 'idle' : 'talk'} seed={p.seed + 7} />
          </group>
        )
      })}
    </group>
  )
}
