import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'

// What stands in front of a place and tells what it is, before you read its
// sign: the market's stalls and parasols, the maquis's terrace (plastic
// chairs, tables, a string of bulbs at night), the club's neon, the town
// hall's flag, the hospital's cross and its ambulance, the gare's gbakas, a
// hotel's flags. Local frame: the door at the origin, +z towards the street,
// x along the façade.

const mats = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string, glow = 0) => {
  const k = `${c}|${glow}`
  let m = mats.get(k)
  if (!m) mats.set(k, (m = new THREE.MeshLambertMaterial({ color: c, emissive: glow ? c : '#000000', emissiveIntensity: glow })))
  return m
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CONE = new THREE.ConeGeometry(1, 0.5, 8, 1, true)
const POLE = new THREE.CylinderGeometry(0.04, 0.05, 1, 6)
const B = ({ p, s, c, glow = 0, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; glow?: number; r?: number }) => <mesh geometry={BOX} material={mat(c, glow)} position={p} scale={s} rotation={[0, r, 0]} />
const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

export function Dressing({ kind, seed, night }: { kind: string; seed: number; night: boolean }) {
  switch (kind) {
    case 'market':
      return <Market seed={seed} />
    case 'maquis':
    case 'restaurant':
      return <Terrace seed={seed} night={night} />
    case 'club':
      return <Neon night={night} />
    case 'health':
      return <Hospital />
    case 'mairie':
      return <Flags n={1} />
    case 'hotel':
      return <Flags n={3} />
    case 'transport':
      return <Gare />
    default:
      return null
  }
}

/** Stalls along the front: a table of goods under a parasol, a basin, a stool. */
function Market({ seed }: { seed: number }) {
  const stalls = useMemo(() => {
    const r = rnd(Math.floor(seed * 1000) + 11)
    const colors = ['#e8432f', '#1f6fb5', '#f2a81d', '#2e8b57', '#ffffff', '#8e44ad']
    const goods = ['#e74c3c', '#f1c40f', '#27ae60', '#e67e22', '#8d5524', '#ecf0f1']
    return [...Array(8)].map((_, i) => ({ x: -11 + i * 3.1 + (r() - 0.5) * 0.6, z: 2 + r() * 1.5, top: colors[Math.floor(r() * colors.length)], g: [0, 1, 2].map(() => goods[Math.floor(r() * goods.length)]) }))
  }, [seed])
  return (
    <group>
      {stalls.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <B p={[0, 0.8, 0]} s={[1.6, 0.08, 0.9]} c="#8a5a32" />
          {[-0.7, 0.7].map((x) => <B key={x} p={[x, 0.4, 0]} s={[0.06, 0.8, 0.06]} c="#5c3b1f" />)}
          {s.g.map((c, k) => <B key={k} p={[-0.5 + k * 0.5, 0.92, 0]} s={[0.4, 0.16, 0.5]} c={c} />)}
          <mesh geometry={POLE} material={mat('#6b6b6b')} position={[0.3, 1.3, -0.1]} scale={[1, 2.6, 1]} />
          <mesh geometry={CONE} material={mat(s.top)} position={[0.3, 2.65, -0.1]} scale={[1.4, 1, 1.4]} />
          <B p={[0.9, 0.12, 0.6]} s={[0.5, 0.24, 0.5]} c="#2f7fd0" />
        </group>
      ))}
    </group>
  )
}

/** A maquis's terrace: plastic tables and chairs, two parasols, bulbs strung over it. */
function Terrace({ seed, night }: { seed: number; night: boolean }) {
  const r = useMemo(() => rnd(Math.floor(seed * 1000) + 7), [seed])
  const tables = useMemo(() => [...Array(5)].map((_, i) => ({ x: 3 + (i % 3) * 2.6 + (r() - 0.5) * 0.4, z: 1.6 + Math.floor(i / 3) * 2.4, chair: r() < 0.5 ? '#e8432f' : '#f4f4f4' })), [r])
  return (
    <group>
      {tables.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <B p={[0, 0.72, 0]} s={[0.9, 0.05, 0.9]} c="#f4f4f4" />
          <mesh geometry={POLE} material={mat('#dcdcdc')} position={[0, 0.36, 0]} scale={[1.5, 0.72, 1.5]} />
          {[[-0.7, 0], [0.7, 0], [0, 0.7]].map(([x, z], k) => (
            <group key={k} position={[x, 0, z]}>
              <B p={[0, 0.42, 0]} s={[0.42, 0.05, 0.42]} c={t.chair} />
              <B p={[0, 0.65, x ? 0 : 0.2]} s={x ? [0.05, 0.45, 0.42] : [0.42, 0.45, 0.05]} c={t.chair} r={0} />
            </group>
          ))}
          {i < 2 && (
            <>
              <mesh geometry={POLE} material={mat('#6b6b6b')} position={[0, 1.4, 0]} scale={[1, 2.8, 1]} />
              <mesh geometry={CONE} material={mat(i ? '#2e8b57' : '#e8432f')} position={[0, 2.8, 0]} scale={[1.6, 1, 1.6]} />
            </>
          )}
        </group>
      ))}
      {/* The string of bulbs, lit at night */}
      {[...Array(9)].map((_, k) => <B key={k} p={[2.5 + k * 0.85, 2.6 - Math.sin((k / 8) * Math.PI) * 0.35, 2.8]} s={[0.12, 0.12, 0.12]} c={['#ffd36b', '#ff6b6b', '#6bd3ff'][k % 3]} glow={night ? 2 : 0.2} />)}
      {[2.4, 10].map((x) => <mesh key={x} geometry={POLE} material={mat('#555')} position={[x, 1.3, 2.8]} scale={[1, 2.6, 1]} />)}
    </group>
  )
}

/** A club's neon: bars of colour framing the front, bright at night. */
function Neon({ night }: { night: boolean }) {
  const g = night ? 2.4 : 0.5
  return (
    <group>
      <B p={[0, 4.05, 0.2]} s={[5, 0.1, 0.1]} c="#ff2d95" glow={g} />
      <B p={[0, 2.45, 0.2]} s={[5, 0.1, 0.1]} c="#2de2ff" glow={g} />
      {[-2.5, 2.5].map((x) => <B key={x} p={[x, 3.25, 0.2]} s={[0.1, 1.7, 0.1]} c="#a35bff" glow={g} />)}
    </group>
  )
}

/** A hospital: the red cross on a white panel, an ambulance waiting. */
function Hospital() {
  return (
    <group>
      <group position={[-3.2, 3.4, 0.2]}>
        <B p={[0, 0, 0]} s={[1.3, 1.3, 0.1]} c="#ffffff" />
        <B p={[0, 0, 0.06]} s={[0.9, 0.28, 0.04]} c="#d62828" />
        <B p={[0, 0, 0.06]} s={[0.28, 0.9, 0.04]} c="#d62828" />
      </group>
      <group position={[5, 0, 3.4]} rotation={[0, Math.PI, 0]}>
        <Vehicle p={[0, 0, 0]} kind="gbaka" color="#f4f4f4" trim="#d62828" />
      </group>
    </group>
  )
}

/** Flags on poles in front: the Ivorian flag (orange, white, green). */
function Flags({ n }: { n: number }) {
  return (
    <group>
      {[...Array(n)].map((_, i) => {
        const x = (i - (n - 1) / 2) * 2.2 + (n === 1 ? 3.2 : 0)
        return (
          <group key={i} position={[x, 0, 2.6]}>
            <mesh geometry={POLE} material={mat('#d9d9d9')} position={[0, 3.5, 0]} scale={[1, 7, 1]} />
            {['#f77f00', '#ffffff', '#009e60'].map((c, k) => <B key={c} p={[0.25 + k * 0.4, 6.4, 0]} s={[0.4, 0.8, 0.03]} c={c} />)}
          </group>
        )
      })}
    </group>
  )
}

/** A gare: gbakas lined up in front, waiting to fill. */
function Gare() {
  return (
    <group>
      {[-6, 0, 6].map((x, i) => (
        <group key={x} position={[x, 0, 4]} rotation={[0, Math.PI / 2, 0]}>
          <Vehicle p={[0, 0, 0]} kind="gbaka" color={i === 1 ? '#f4c430' : '#e9e2c8'} trim="#00a862" />
        </group>
      ))}
    </group>
  )
}
