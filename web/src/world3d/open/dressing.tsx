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
const HUT = new THREE.CylinderGeometry(1, 1, 1, 10)
const ROOF = new THREE.ConeGeometry(1, 1, 10)
const POLE = new THREE.CylinderGeometry(0.04, 0.05, 1, 6)
const B = ({ p, s, c, glow = 0, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; glow?: number; r?: number }) => <mesh geometry={BOX} material={mat(c, glow)} position={p} scale={s} rotation={[0, r, 0]} />
const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

// These stay open after dark. Everything else pulls a shutter down over the door.
const OPEN_AT_NIGHT = new Set(['pharmacie', 'maquis', 'restaurant', 'club', 'hotel', 'health', 'transport', 'home', 'beach', 'lagune', 'nature', 'village', 'sport'])

export function Dressing({ kind, name = '', seed, night }: { kind: string; name?: string; seed: number; night: boolean }) {
  const front = (() => {
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
      case 'barbier':
        return <Barbier />
      case 'salon':
        return <Salon />
      case 'worship':
        return <Worship name={name} />
      case 'school':
      case 'universite':
        return <School />
      case 'mall':
        return <Mall night={night} />
      case 'office':
      case 'culture':
        return <Office />
      case 'sport':
        return <Pitch name={name} night={night} />
      case 'home':
        return <Home night={night} />
      case 'village':
        return <Compound />
      case 'pharmacie':
        return <Pharmacie night={night} />
      case 'boutique':
        return <Boutique seed={seed} />
      case 'couture':
        return <Couture seed={seed} />
      default:
        return null
    }
  })()
  if (!front && !(night && !OPEN_AT_NIGHT.has(kind))) return null
  return (
    <group>
      {front}
      {night && !OPEN_AT_NIGHT.has(kind) && <Shutter />}
    </group>
  )
}

/** A rolled-down shop shutter: the place is closed. */
function Shutter() {
  return (
    <group>
      {[...Array(9)].map((_, i) => (
        <B key={i} p={[0, 0.18 + i * 0.24, 0.2]} s={[1.45, 0.2, 0.05]} c={i % 2 ? '#d5d8de' : '#aeb4be'} />
      ))}
    </group>
  )
}

/** The barber's pole and a chair waiting outside. */
function Barbier() {
  return (
    <group>
      <mesh geometry={POLE} material={mat('#f4f4f4')} position={[-1.35, 1.55, 0.55]} scale={[1.6, 2.6, 1.6]} />
      {['#d62828', '#f4f4f4', '#1f6fb5', '#d62828'].map((c, i) => (
        <B key={i} p={[-1.35, 0.7 + i * 0.48, 0.72]} s={[0.34, 0.42, 0.06]} c={c} />
      ))}
      <B p={[1.15, 0.42, 1.15]} s={[0.48, 0.06, 0.48]} c="#6b3a1f" />
      <B p={[1.15, 0.78, 0.95]} s={[0.48, 0.66, 0.06]} c="#c0392b" />
    </group>
  )
}

/** A salon: a pink awning, two chairs, a plant by the door. */
function Salon() {
  return (
    <group>
      <B p={[0, 2.55, 0.7]} s={[2.6, 0.08, 1.2]} c="#e84393" r={0.15} />
      {[-0.9, 0.9].map((x) => (
        <group key={x} position={[x, 0, 1.5]}>
          <B p={[0, 0.42, 0]} s={[0.42, 0.06, 0.42]} c="#f4c2d7" />
          <B p={[0, 0.7, -0.18]} s={[0.42, 0.5, 0.06]} c="#f4c2d7" />
        </group>
      ))}
      <B p={[1.7, 0.35, 0.4]} s={[0.35, 0.7, 0.35]} c="#2e8b57" />
    </group>
  )
}

/** A church gets a cross, a mosque a crescent. Benches either way. */
function Worship({ name }: { name: string }) {
  const mosque = /mosqu[eé]e/i.test(name)
  return (
    <group>
      {mosque ? (
        <group position={[0, 3.6, 0.25]}>
          <mesh geometry={POLE} material={mat('#f4f1ea')} position={[0, 0, 0]} scale={[1.2, 1.4, 1.2]} />
          <B p={[0.22, 0.85, 0]} s={[0.55, 0.08, 0.08]} c="#d4a017" />
          <B p={[0.42, 0.7, 0]} s={[0.08, 0.38, 0.08]} c="#d4a017" />
        </group>
      ) : (
        <group position={[0, 3.5, 0.25]}>
          <B p={[0, 0.35, 0]} s={[0.16, 1.1, 0.1]} c="#f4f1ea" />
          <B p={[0, 0.7, 0]} s={[0.7, 0.16, 0.1]} c="#f4f1ea" />
        </group>
      )}
      {[-1.6, 1.6].map((x) => (
        <B key={x} p={[x, 0.4, 2.2]} s={[1.3, 0.12, 0.4]} c="#8a5a32" />
      ))}
    </group>
  )
}

/** A school: a blackboard by the door and a bench. */
function School() {
  return (
    <group>
      <B p={[-1.6, 1.5, 0.2]} s={[1.1, 0.8, 0.06]} c="#1d4e3a" />
      <B p={[-1.6, 1.5, 0.24]} s={[0.7, 0.08, 0.02]} c="#f4f4f4" />
      <B p={[1.4, 0.42, 1.8]} s={[1.4, 0.1, 0.4]} c="#c9a227" />
    </group>
  )
}

/** A mall: a glass canopy and three lit shop bands. */
function Mall({ night }: { night: boolean }) {
  return (
    <group>
      <B p={[0, 3.1, 1.1]} s={[6.5, 0.1, 2.2]} c="#d7e3ee" />
      {[-2, 0, 2].map((x, i) => (
        <B key={x} p={[x, 2.4, 0.2]} s={[1.5, 0.35, 0.08]} c={['#e8432f', '#1f6fb5', '#f2a81d'][i]} glow={night ? 1.2 : 0.15} />
      ))}
    </group>
  )
}

/** An office or a cultural hall: a plaque beside the door. */
function Office() {
  return (
    <group>
      <B p={[1.15, 1.55, 0.16]} s={[0.7, 0.45, 0.06]} c="#f4f1ea" />
      <B p={[1.15, 1.55, 0.2]} s={[0.45, 0.06, 0.02]} c="#3d4350" />
    </group>
  )
}

/** A yard beside the door: a basket court at a hall, a small pitch everywhere else. Lit after dark. */
function Pitch({ name, night }: { name: string; night: boolean }) {
  const basket = /basket|palais|salle/i.test(name)
  return (
    <group position={[4.4, 0, 2.6]}>
      <B p={[0, 0.04, 0]} s={basket ? [8, 0.08, 5] : [9, 0.08, 6]} c={basket ? '#d5d0c6' : '#2f9e4a'} />
      <B p={[0, 0.09, 0]} s={basket ? [0.08, 0.02, 5] : [0.08, 0.02, 6]} c="#ffffff" />
      {basket ? (
        <>
          <B p={[3.7, 1.6, 0]} s={[0.08, 3.2, 0.08]} c="#f4f4f4" />
          <B p={[3.35, 3.15, 0]} s={[0.7, 0.06, 1.3]} c="#e25b2a" />
          <mesh position={[2.2, 2.4, 0]} material={mat('#e25b2a')}>
            <sphereGeometry args={[0.22, 10, 8]} />
          </mesh>
        </>
      ) : (
        [-4.2, 4.2].map((x) => (
          <group key={x}>
            {[-0.7, 0.7].map((z) => (
              <mesh key={z} geometry={POLE} material={mat('#f4f4f4')} position={[x, 0.7, z]} scale={[1.1, 1.4, 1.1]} />
            ))}
            <B p={[x, 1.35, 0]} s={[0.08, 0.06, 1.5]} c="#f4f4f4" />
          </group>
        ))
      )}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 3.2, 0, s * 2.2]}>
          <mesh geometry={POLE} material={mat('#c5c8ce')} position={[0, 2.2, 0]} scale={[1.4, 4.4, 1.4]} />
          <B p={[0, 4.3, 0]} s={[0.7, 0.1, 0.28]} c={night ? '#fff2cc' : '#d9dde2'} glow={night ? 1.8 : 0} />
        </group>
      ))}
    </group>
  )
}

/** Home: a low courtyard wall, and a window that stays lit at night. */
function Home({ night }: { night: boolean }) {
  return (
    <group>
      <B p={[-1.15, 0.32, 0.85]} s={[0.7, 0.64, 0.12]} c="#e9ddc7" />
      <B p={[1.15, 0.32, 0.85]} s={[0.7, 0.64, 0.12]} c="#e9ddc7" />
      <B p={[-0.95, 1.55, 0.12]} s={[0.42, 0.32, 0.04]} c={night ? '#ffd36b' : '#9fd3f2'} glow={night ? 0.8 : 0} />
    </group>
  )
}

/** A village compound: a round hut and a mortar in the yard. */
function Compound() {
  return (
    <group>
      <mesh geometry={HUT} material={mat('#c4a574')} position={[-2.2, 0.7, 1.8]} scale={[1.15, 1.4, 1.15]} />
      <mesh geometry={ROOF} material={mat('#8a5a32')} position={[-2.2, 1.7, 1.8]} scale={[1.5, 0.9, 1.5]} />
      <B p={[1.6, 0.2, 1.5]} s={[0.45, 0.4, 0.45]} c="#6b4426" />
    </group>
  )
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

/** The pharmacy's green cross on its pole, lit at night (on duty). */
function Pharmacie({ night }: { night: boolean }) {
  const green = night ? '#69ff7a' : '#2f9e44'
  return (
    <group position={[3.6, 0, 2.2]}>
      <mesh geometry={POLE} material={mat('#d9d9d9')} position={[0, 2, 0]} scale={[1, 4, 1]} />
      <group position={[0, 4.3, 0]}>
        <B p={[0, 0, 0]} s={[1.5, 0.5, 0.25]} c={green} glow={night ? 1 : 0} />
        <B p={[0, 0, 0]} s={[0.5, 1.5, 0.25]} c={green} glow={night ? 1 : 0} />
      </group>
    </group>
  )
}

/** The boutique on the corner: crates of drinks out front, the CRÉDIT board. */
function Boutique({ seed }: { seed: number }) {
  const crates = ['#c92a2a', '#1971c2', '#f08c00', '#2b8a3e']
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <B key={i} p={[-2.2 + (i % 2) * 0.6, 0.25 + Math.floor(i / 2) * 0.5, 1.2]} s={[0.6, 0.5, 0.45]} c={crates[(seed + i) % crates.length]} />
      ))}
      <B p={[2.4, 0.8, 1.1]} s={[0.9, 1.6, 0.06]} c="#ffd43b" />
      <B p={[2.4, 1.15, 1.14]} s={[0.7, 0.18, 0.02]} c="#1c1c1e" />
      <B p={[2.4, 0.75, 1.14]} s={[0.55, 0.12, 0.02]} c="#e03131" />
    </group>
  )
}

/** The couturier works out front: the table, the sewing machine, a pagne on the mannequin. */
function Couture({ seed }: { seed: number }) {
  const pagnes = ['#f08c00', '#7048e8', '#2b8a3e', '#e03131', '#1971c2']
  return (
    <group position={[0, 0, 1.4]}>
      <B p={[-1.8, 0.75, 0]} s={[1.5, 0.08, 0.8]} c="#8a5a32" />
      {[-2.45, -1.15].map((x) => (
        <B key={x} p={[x, 0.37, 0]} s={[0.08, 0.75, 0.7]} c="#5c3d22" />
      ))}
      <B p={[-1.8, 0.95, 0]} s={[0.55, 0.3, 0.25]} c="#1c1c1e" />
      <B p={[2.2, 0.6, 0]} s={[0.12, 1.2, 0.12]} c="#5c3d22" />
      <B p={[2.2, 1.5, 0]} s={[0.6, 0.8, 0.35]} c={pagnes[seed % pagnes.length]} />
      <B p={[2.2, 1.95, 0]} s={[0.25, 0.15, 0.25]} c="#d9c3a5" />
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
