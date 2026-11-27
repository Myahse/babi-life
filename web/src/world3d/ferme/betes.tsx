import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Hens, Sheep } from '../pets'

// Les bêtes de la ferme en blocs (the update « agriculture »; FermeScene.tsx, FermeLandmark.tsx): the hens and
// the sheep of the « animaux » yard (world3d/pets.tsx) reused, and the others in the same blocks: the goat, the
// pig, the zebu ox with its hump, the rabbit, the guinea fowl, the tilapias jumping in the pond. Alive: they
// graze, they wander a little round their spot. Tired (forgotten a day) they stand still, the head low; never
// worse. No slaughter is ever shown: they are sold alive at the market.

type V3 = [number, number, number]

function B({ p, s, c }: { p: V3; s: V3; c: string }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

type Spec = { body: V3; leg: number; head: V3; c: string; c2?: string; horns?: boolean; hump?: boolean; ears?: 'up' | 'long' | 'flop'; snout?: string; tail?: number }
const SPECS: Record<string, Spec> = {
  chevres: { body: [0.26, 0.26, 0.55], leg: 0.32, head: [0.16, 0.18, 0.24], c: '#f1e3c6', c2: '#5c3a21', horns: true, ears: 'flop', tail: 0.1 },
  porcs: { body: [0.42, 0.36, 0.75], leg: 0.18, head: [0.3, 0.26, 0.24], c: '#f4c2c2', snout: '#e599a6', ears: 'flop', tail: 0.06 },
  boeufs: { body: [0.6, 0.6, 1.3], leg: 0.6, head: [0.3, 0.32, 0.42], c: '#e9ddc8', c2: '#8a6a4a', horns: true, hump: true, ears: 'flop', tail: 0.4 },
  lapins: { body: [0.18, 0.16, 0.28], leg: 0.05, head: [0.13, 0.13, 0.13], c: '#dee2e6', ears: 'long', tail: 0.05 },
}

/** A four-legged beast of the farm, grazing at its spot (its head down and up), slower tired. */
function Beast({ kind, p, r, tired, seed }: { kind: string; p: V3; r: number; tired?: boolean; seed: number }) {
  const s = SPECS[kind]
  const head = useRef<THREE.Group>(null)
  const me = useRef<THREE.Group>(null)
  const col = useMemo(() => (s.c2 && seed % 3 === 1 ? s.c2 : s.c), [s, seed])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (tired ? 0.3 : 1) + seed * 2.3
    if (head.current) head.current.rotation.x = tired ? 0.5 : 0.25 + Math.max(0, Math.sin(t * 0.6)) * 0.6
    if (me.current) {
      // A little wander round its spot (not tired), the rabbit's hop.
      const a = tired ? 0 : Math.sin(t * 0.15) * 0.4
      me.current.position.set(p[0] + Math.sin(a) * 0.3, p[1] + (kind === 'lapins' && !tired ? Math.max(0, Math.sin(t * 4)) * 0.06 : 0), p[2] + Math.cos(a) * 0.3 - 0.3)
      me.current.rotation.y = r + a
    }
  })
  const [bw, bh, bd] = s.body
  const y = s.leg + bh / 2
  return (
    <group ref={me} position={p} rotation={[0, r, 0]}>
      {[
        [-bw / 2 + 0.05, -bd / 2 + 0.08],
        [bw / 2 - 0.05, -bd / 2 + 0.08],
        [-bw / 2 + 0.05, bd / 2 - 0.08],
        [bw / 2 - 0.05, bd / 2 - 0.08],
      ].map(([x, z], i) => (
        <B key={i} p={[x, s.leg / 2, z]} s={[0.07 * (bw / 0.26 > 1.5 ? 1.6 : 1), s.leg, 0.07 * (bw / 0.26 > 1.5 ? 1.6 : 1)]} c={kind === 'boeufs' ? '#6b4a2a' : col} />
      ))}
      <B p={[0, y, 0]} s={s.body} c={col} />
      {s.hump && <B p={[0, y + bh / 2 + 0.08, bd / 2 - 0.3]} s={[bw * 0.5, 0.22, 0.3]} c={col} />}
      {s.tail && <B p={[0, y + bh * 0.2, -bd / 2 - s.tail / 2]} s={[0.05, 0.05, s.tail]} c={col} />}
      <group ref={head} position={[0, y + bh * 0.2, bd / 2]}>
        <B p={[0, 0, s.head[2] / 2]} s={s.head} c={col} />
        {s.snout && <B p={[0, -0.03, s.head[2] + 0.02]} s={[s.head[0] * 0.55, s.head[1] * 0.45, 0.05]} c={s.snout} />}
        <B p={[-s.head[0] / 3, s.head[1] * 0.15, s.head[2] + 0.005]} s={[0.03, 0.03, 0.01]} c="#111" />
        <B p={[s.head[0] / 3, s.head[1] * 0.15, s.head[2] + 0.005]} s={[0.03, 0.03, 0.01]} c="#111" />
        {s.ears === 'long' &&
          [-1, 1].map((k) => <B key={k} p={[k * 0.035, s.head[1] / 2 + 0.09, s.head[2] * 0.3]} s={[0.03, tired ? 0.08 : 0.16, 0.05]} c={col} />)}
        {s.ears === 'flop' &&
          [-1, 1].map((k) => <B key={k} p={[k * (s.head[0] / 2 + 0.03), s.head[1] * 0.15, s.head[2] * 0.3]} s={[0.06, 0.04, 0.1]} c={col} />)}
        {s.horns &&
          [-1, 1].map((k) => <B key={k} p={[k * s.head[0] * 0.3, s.head[1] / 2 + 0.06, s.head[2] * 0.2]} s={[0.04, kind === 'boeufs' ? 0.22 : 0.14, 0.04]} c="#d8c8a8" />)}
      </group>
    </group>
  )
}

/** The guinea fowls: grey, spotted white, the blue-white head; pecking. */
function Pintades({ p }: { p: V3 }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      const k = (clock.elapsedTime + i * 0.8) % 2
      c.rotation.x = k < 0.25 ? Math.sin((k / 0.25) * Math.PI) * 0.6 : 0
    })
  })
  return (
    <group ref={g} position={p}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[i * 0.3 - 0.3, 0, (i % 2) * 0.25]} rotation={[0, i * 1.3, 0]}>
          <B p={[0, 0.06, 0]} s={[0.02, 0.12, 0.02]} c="#495057" />
          <B p={[0, 0.18, 0]} s={[0.16, 0.13, 0.22]} c="#495057" />
          <B p={[0.05, 0.22, 0.03]} s={[0.03, 0.03, 0.03]} c="#f8f9fa" />
          <B p={[-0.05, 0.2, -0.04]} s={[0.03, 0.03, 0.03]} c="#f8f9fa" />
          <B p={[0, 0.28, 0.12]} s={[0.07, 0.08, 0.07]} c="#d0ebff" />
          <B p={[0, 0.33, 0.12]} s={[0.03, 0.04, 0.04]} c="#e8590c" />
        </group>
      ))}
    </group>
  )
}

/** The pond's water, the tilapias jumping now and then (more, fed). */
function Pond({ w, d, n }: { w: number; d: number; n: number }) {
  const fish = useRef<(THREE.Group | null)[]>([])
  const k = Math.min(5, Math.max(1, Math.round(n / 40)))
  useFrame(({ clock }) => {
    fish.current.forEach((f, i) => {
      if (!f) return
      const t = (clock.elapsedTime * 0.8 + i * 1.37) % 3
      const up = t < 0.6 ? Math.sin((t / 0.6) * Math.PI) : 0
      f.position.y = 0.05 + up * 0.35
      f.rotation.z = t < 0.6 ? (t / 0.6 - 0.5) * 1.5 : 0
      f.visible = t < 0.6
    })
  })
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[w - 0.6, 0.04, d - 0.6]} />
        <meshLambertMaterial color="#3b8fc4" transparent opacity={0.85} />
      </mesh>
      {Array.from({ length: n > 0 ? k : 0 }, (_, i) => (
        <group key={i} ref={(r) => void (fish.current[i] = r)} position={[((i * 0.9) % (w - 1.2)) - (w - 1.2) / 2, 0.1, ((i * 1.3) % (d - 1.2)) - (d - 1.2) / 2]}>
          <B p={[0, 0, 0]} s={[0.22, 0.1, 0.05]} c="#868e96" />
          <B p={[-0.13, 0, 0]} s={[0.06, 0.1, 0.03]} c="#adb5bd" />
        </group>
      ))}
    </group>
  )
}

/** A pen's animals (up to six drawn) in its w × d, at the pen's middle. */
export function Herd({ kind, n, young = 0, tired, w = 3.4, d = 3, seed = 0 }: { kind: string; n: number; young?: number; tired?: boolean; w?: number; d?: number; seed?: number }) {
  const spots = useMemo(() => {
    const out: { p: V3; r: number; small: boolean }[] = []
    const all = Math.min(6, n + Math.min(young, 2))
    for (let i = 0; i < all; i++) {
      const a = (i * 2.4 + seed) % (Math.PI * 2)
      out.push({ p: [Math.cos(a) * w * 0.25 + 0.3, 0.06, Math.sin(a) * d * 0.22 + 0.3], r: a + 1.6, small: i >= Math.min(6, n) })
    }
    return out
  }, [n, young, w, d, seed])
  if (kind === 'tilapia') return <Pond w={w} d={d} n={n} />
  if (kind === 'poules') return <>{spots.slice(0, Math.max(1, Math.ceil(spots.length / 3))).map((s, i) => <Hens key={i} p={[s.p[0] * 0.8, 0.06, s.p[2] * 0.8]} r={s.r} />)}</>
  if (kind === 'pintades') return <>{spots.slice(0, Math.max(1, Math.ceil(spots.length / 3))).map((s, i) => <Pintades key={i} p={[s.p[0] * 0.8, 0.06, s.p[2] * 0.8]} />)}</>
  if (kind === 'moutons')
    return (
      <>
        {spots.map((s, i) => (
          <group key={i} scale={s.small ? 0.6 : 1}>
            <Sheep p={s.p} r={s.r} seed={i} mood={tired ? 'triste' : 'ok'} />
          </group>
        ))}
      </>
    )
  if (!SPECS[kind]) return null
  return (
    <>
      {spots.map((s, i) => (
        <group key={i} position={s.small ? [s.p[0] * 0.05, 0, s.p[2] * 0.05] : undefined} scale={s.small ? 0.6 : 1}>
          <Beast kind={kind} p={s.p} r={s.r} tired={tired} seed={i + seed} />
        </group>
      ))}
    </>
  )
}
