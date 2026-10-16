import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { worldTime } from '../../lib/worldClock'
import { whereabouts } from '../whereabouts'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { ClubFront, useClubFill } from '../clubNight'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'

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
        return <Club night={night} seed={seed} />
      case 'health':
        return <Hospital seed={seed} />
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
        return <Mall night={night} seed={seed} />
      case 'office':
      case 'culture':
        return <Office bank={BANK.test(name)} seed={seed} />
      case 'sport':
        return <Pitch name={name} night={night} />
      case 'home':
        return <Home night={night} />
      case 'village':
        return <Compound />
      case 'pharmacie':
        return <Pharmacie night={night} seed={seed} />
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
/** Banks, by their name on the map (Abidjan's banks, or the word itself). */
const BANK = /banque|bank|bicici|sgbci|soci[eé]t[eé] g[eé]n[eé]rale|ecobank|coris|nsia|uba|bni|bdu|orabank|versus|afriland|atlantique|bhci|baci/i

/**
 * Someone at work in their uniform, in front of the place: the cook at the
 * maquis grill, the nurse at the hospital, the vigile at the bank's door.
 */
function Worker({ p, r = 0, outfit, pose = 'idle', seed }: { p: [number, number, number]; r?: number; outfit: string; pose?: Pose; seed: number }) {
  const person = useMemo(() => {
    const rand = rnd(Math.floor(seed * 1000) + outfit.length * 97 + 3)
    const gender: 'femme' | 'homme' = outfit === 'vigile' ? (rand() < 0.85 ? 'homme' : 'femme') : rand() < 0.5 ? 'femme' : 'homme'
    return { gender, look: { ...randomLook(gender, rand), outfit, accessory: 'none' }, seed: rand() * 100 }
  }, [seed, outfit])
  return (
    <NoShadows>
      <group position={p} rotation={[0, r, 0]}>
        <Human look={person.look} gender={person.gender} pose={pose} seed={person.seed} />
      </group>
    </NoShadows>
  )
}

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
      {mosque && <Prayers name={name} />}
    </group>
  )
}

/* ---------- The prayers in front of the mosque ---------- */

/** The five prayers in Abidjan, minutes after midnight (approximate, through the year). */
const SALAT = [
  { name: 'fajr', at: 5 * 60 + 10 },
  { name: 'dhuhr', at: 12 * 60 + 35 },
  { name: 'asr', at: 15 * 60 + 50 },
  { name: 'maghrib', at: 18 * 60 + 30 },
  { name: 'isha', at: 19 * 60 + 45 },
]
const NEAR_MOSQUE = 120 // metres: the crowd is drawn when the Sim is this close

/**
 * Where the mosque is in its day: before a prayer people arrive and sit
 * (the call from the minaret first), during it they pray in rows behind
 * the imam, after it they talk a moment and go. Friday's midday prayer
 * (jumu'a, at 13:30) fills the street. From the shared clock (the game's
 * epoch is a Monday; Abidjan is on UTC).
 */
function mosqueMoment() {
  const t = worldTime()
  const day = Math.floor(t / 86400) % 7 // 0 Monday … 4 Friday
  const min = (t / 60) % 1440
  for (const p of SALAT) {
    const at = p.name === 'dhuhr' && day === 4 ? 13 * 60 + 30 : p.at
    const d = min - at
    const big = p.name === 'dhuhr' && day === 4
    if (d >= -10 && d < -6) return { phase: 'call' as const, big, fajr: p.name === 'fajr' }
    if (d >= -6 && d < 0) return { phase: 'gather' as const, big, fajr: p.name === 'fajr' }
    if (d >= 0 && d < 12) return { phase: 'pray' as const, big, fajr: p.name === 'fajr' }
    if (d >= 12 && d < 18) return { phase: 'leave' as const, big, fajr: p.name === 'fajr' }
  }
  return { phase: 'none' as const, big: false, fajr: false }
}

function Prayers({ name }: { name: string }) {
  const anchor = useRef<THREE.Group>(null)
  const [state, setState] = useState<{ near: boolean; m: ReturnType<typeof mosqueMoment> }>({ near: false, m: mosqueMoment() })
  const tick = useRef(10)
  const at = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1) return
    tick.current = 0
    if (!anchor.current) return
    anchor.current.getWorldPosition(at)
    const near = Math.hypot(at.x - whereabouts.sim[0], at.z - whereabouts.sim[1]) < NEAR_MOSQUE
    const m = mosqueMoment()
    if (near !== state.near || m.phase !== state.m.phase || m.big !== state.m.big) setState({ near, m })
  })
  // The faithful: men in boubou or kufi, women in abaya; the imam in white.
  const people = useMemo(() => {
    const r = rnd(name.length * 977 + 13)
    return [...Array(64)].map((_, i) => {
      const femme = i % 7 === 6
      const look = randomLook(femme ? 'femme' : 'homme', r)
      return {
        gender: (femme ? 'femme' : 'homme') as 'femme' | 'homme',
        look: femme ? { ...look, outfit: 'abaya', outfitColor: ['#14213d', '#5b2a86', '#1f6f5c', '#6b2c2c'][i % 4] } : { ...look, outfit: r() < 0.6 ? 'boubou' : 'imam', outfitColor: ['#f8f9fa', '#e9e2cf', '#9ac1e8', '#cfe8d0'][i % 4], accessory: r() < 0.7 ? 'kufi' : look.accessory },
        seed: r() * 100,
      }
    })
  }, [name])
  const { near, m } = state
  // How many: a few at dawn, more at the others, the street full on Friday.
  const [rows, perRow] = m.big ? [6, 10] : m.fajr ? [1, 6] : [2, 8]
  const men = people.filter((p) => p.gender === 'homme')
  const women = people.filter((p) => p.gender === 'femme')
  const praying = m.phase === 'pray'
  return (
    <group ref={anchor}>
      {near && m.phase !== 'none' && m.phase !== 'call' && (
        <NoShadows>
          {/* The mats, row after row toward the street */}
          {[...Array(rows)].map((_, row) => (
            <B key={`mat${row}`} p={[0, 0.03, 3 + row * 1.5]} s={[perRow * 0.9, 0.04, 1.2]} c={row % 2 ? '#2e7d4f' : '#a8323a'} />
          ))}
          {/* The imam in front, facing the same way as everyone */}
          {praying && (
            <group position={[0, 0, 2]} rotation={[0, Math.PI, 0]}>
              <Human look={{ ...people[0].look, outfit: 'imam', outfitColor: '#f8f9fa', accessory: 'kufi' }} gender="homme" pose="salat" seed={1} />
            </group>
          )}
          {[...Array(rows)].flatMap((_, row) =>
            [...Array(perRow)].map((_, k) => {
              const p = men[(row * perRow + k + 1) % men.length]
              const pose: Pose = praying ? 'salat' : m.phase === 'gather' ? (k % 3 ? 'pray' : 'idle') : k % 2 ? 'talk' : 'idle'
              return (
                <group key={`${row}-${k}`} position={[(k - (perRow - 1) / 2) * 0.85, 0, 3.3 + row * 1.5]} rotation={[0, Math.PI, 0]}>
                  <Human look={p.look} gender="homme" pose={pose} seed={p.seed} />
                </group>
              )
            }),
          )}
          {/* The women's row, at the back on one side */}
          {[...Array(Math.min(women.length, m.big ? 8 : 3))].map((_, k) => (
            <group key={`w${k}`} position={[(k - 1) * 0.85 + perRow * 0.2, 0, 3.6 + rows * 1.5]} rotation={[0, Math.PI, 0]}>
              <Human look={women[k].look} gender="femme" pose={praying ? 'salat' : 'idle'} seed={women[k].seed} />
            </group>
          ))}
        </NoShadows>
      )}
      {/* Out of prayer time, one or two sitting by the door */}
      {near && m.phase === 'none' && (
        <NoShadows>
          {[-1.6, 1.6].map((x, i) => (
            <group key={x} position={[x, 0, 2.15]} rotation={[0, Math.PI, 0]}>
              <Human look={men[i].look} gender="homme" pose={i ? 'sit' : 'phone'} seed={men[i].seed} />
            </group>
          ))}
        </NoShadows>
      )}
      {/* The call to prayer, from the minaret */}
      {near && m.phase === 'call' && (
        <Html position={[0, 5.6, 0.3]} center zIndexRange={[20, 0]}>
          <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">Allahou akbar, Allahou akbar… 🕌</div>
        </Html>
      )}
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
function Mall({ night, seed }: { night: boolean; seed: number }) {
  return (
    <group>
      <Worker p={[-1.5, 0, 0.9]} outfit="vigile" seed={seed} />
      <B p={[0, 3.1, 1.1]} s={[6.5, 0.1, 2.2]} c="#d7e3ee" />
      {[-2, 0, 2].map((x, i) => (
        <B key={x} p={[x, 2.4, 0.2]} s={[1.5, 0.35, 0.08]} c={['#e8432f', '#1f6fb5', '#f2a81d'][i]} glow={night ? 1.2 : 0.15} />
      ))}
    </group>
  )
}

/** An office or a cultural hall: a plaque beside the door. */
function Office({ bank, seed }: { bank: boolean; seed: number }) {
  return (
    <group>
      {bank && <Worker p={[-1.1, 0, 0.8]} outfit="vigile" seed={seed} />}
      <B p={[1.15, 1.55, 0.16]} s={[0.7, 0.45, 0.06]} c="#f4f1ea" />
      <B p={[1.15, 1.55, 0.2]} s={[0.45, 0.06, 0.02]} c="#3d4350" />
    </group>
  )
}

/** A yard beside the door: a basket court at a hall, a small pitch everywhere else. Lit after dark. */
function Pitch({ name, night }: { name: string; night: boolean }) {
  // Basketball at an agora, a gymnase, a palais des sports, a basket court.
  const basket = /basket|palais|salle|agora|gymnase/i.test(name)
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
      {/* The grill by the door, and the cook at it */}
      <group position={[0.4, 0, 1.9]}>
        <B p={[0, 0.45, 0]} s={[1.1, 0.9, 0.45]} c="#2a2a2a" />
        <B p={[0, 0.92, 0]} s={[1.0, 0.05, 0.4]} c="#ff5a1a" glow={0.9} />
        {[-0.3, 0, 0.3].map((x) => <B key={x} p={[x, 0.97, 0]} s={[0.16, 0.05, 0.1]} c="#8a4b2a" />)}
      </group>
      <Worker p={[0.4, 0, 1.3]} outfit="cuisinier" pose="cook" seed={seed} />
      {/* The string of bulbs, lit at night */}
      {[...Array(9)].map((_, k) => <B key={k} p={[2.5 + k * 0.85, 2.6 - Math.sin((k / 8) * Math.PI) * 0.35, 2.8]} s={[0.12, 0.12, 0.12]} c={['#ffd36b', '#ff6b6b', '#6bd3ff'][k % 3]} glow={night ? 2 : 0.2} />)}
      {[2.4, 10].map((x) => <mesh key={x} geometry={POLE} material={mat('#555')} position={[x, 1.3, 2.8]} scale={[1, 2.6, 1]} />)}
      <MaquisCrowd tables={tables} seed={seed} />
    </group>
  )
}

/** How full the maquis is at an hour: packed at night, busy in the evening, people eating at lunch, a few regulars otherwise. */
const maquisFill = (h: number) => (h >= 19 || h < 2 ? 1 : h >= 17 ? 0.55 : h >= 12 && h < 15 ? 0.4 : h >= 2 && h < 9 ? 0 : 0.15)
const NEAR_MAQUIS = 90

/**
 * The maquis's customers: round the tables on the plastic chairs, a bottle
 * or a plate in front of them; at night more tables put out on the street,
 * people dancing in front of the speakers, the waitress with her tray.
 * Drawn when the Sim is near.
 */
function MaquisCrowd({ tables, seed }: { tables: { x: number; z: number; chair: string }[]; seed: number }) {
  const anchor = useRef<THREE.Group>(null)
  const at = useMemo(() => new THREE.Vector3(), [])
  const hourNow = () => Math.floor((worldTime() / 3600) % 24)
  const [state, setState] = useState({ near: false, h: hourNow() })
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1) return
    tick.current = 0
    if (!anchor.current) return
    anchor.current.getWorldPosition(at)
    const near = Math.hypot(at.x - whereabouts.sim[0], at.z - whereabouts.sim[1]) < NEAR_MAQUIS
    const h = hourNow()
    if (near !== state.near || h !== state.h) setState({ near, h })
  })
  const fill = maquisFill(state.h)
  const night = fill >= 1
  // The tables put out at night, on the street side.
  const all = useMemo(() => [...tables, ...[0, 1, 2].map((i) => ({ x: 3 + i * 2.6, z: 6.4, chair: i % 2 ? '#e8432f' : '#f4f4f4' }))], [tables])
  const people = useMemo(() => {
    const r = rnd(Math.floor(seed * 1000) + 41)
    return [...Array(36)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.4 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100, eats: r() < 0.35 }
    })
  }, [seed])
  if (!state.near || fill <= 0) return <group ref={anchor} />
  const shown = night ? all : tables
  // The seats taken: all of them at night, fewer at other hours.
  const SEATS: [number, number, number][] = [[-0.7, 0, Math.PI / 2], [0.7, 0, -Math.PI / 2], [0, 0.7, Math.PI]]
  let who = 0
  return (
    <group ref={anchor}>
      <NoShadows>
        {shown.map((t, i) => (
          <group key={i} position={[t.x, 0, t.z]}>
            {/* The extra tables and chairs brought out at night */}
            {i >= tables.length && (
              <>
                <B p={[0, 0.72, 0]} s={[0.9, 0.05, 0.9]} c="#f4f4f4" />
                <mesh geometry={POLE} material={mat('#dcdcdc')} position={[0, 0.36, 0]} scale={[1.5, 0.72, 1.5]} />
                {SEATS.map(([x, z], k) => (
                  <B key={k} p={[x, 0.42, z]} s={[0.42, 0.05, 0.42]} c={t.chair} />
                ))}
              </>
            )}
            {/* On the table: bottles, a plate */}
            {[0, 1].map((k) => (
              <B key={k} p={[-0.2 + k * 0.3, 0.86, -0.15 + k * 0.1]} s={[0.07, 0.22, 0.07]} c={k ? '#2f6b2a' : '#6b3a12'} />
            ))}
            <B p={[0.15, 0.76, 0.2]} s={[0.3, 0.03, 0.3]} c="#f4f1ea" />
            {SEATS.map(([x, z, ry], k) => {
              if ((i * 3 + k) % 10 >= Math.round(fill * 10)) return null
              const p = people[who++ % people.length]
              return (
                <group key={k} position={[x, 0, z]} rotation={[0, ry, 0]}>
                  <Human look={p.look} gender={p.gender} pose={p.eats ? 'eat' : 'drink'} seed={p.seed} />
                </group>
              )
            })}
          </group>
        ))}
        {/* At night: the speakers and the dancers in front of them, the waitress with her tray */}
        {night && (
          <>
            <B p={[10.4, 0.7, 4.4]} s={[0.7, 1.4, 0.6]} c="#141416" />
            <B p={[10.4, 1.0, 4.72]} s={[0.4, 0.4, 0.02]} c="#3a3a3a" />
            {[0, 1, 2, 3].map((k) => {
              const p = people[(30 + k) % people.length]
              return (
                <group key={k} position={[8.2 + (k % 2) * 1.2, 0, 4.2 + Math.floor(k / 2) * 1.1]} rotation={[0, -1.2 + k, 0]}>
                  <Human look={p.look} gender={p.gender} pose="dance" seed={p.seed} />
                </group>
              )
            })}
            <group position={[6.2, 0, 3.3]} rotation={[0, 2.4, 0]}>
              <Human look={{ ...people[35].look, outfit: 'pagne' }} gender="femme" pose="busy" seed={people[35].seed} />
              <B p={[0, 1.15, 0.35]} s={[0.45, 0.03, 0.45]} c="#c0c7cf" />
            </group>
          </>
        )}
      </NoShadows>
    </group>
  )
}

/** A club: its neon, and on the big nights the queue, the vigiles and the cars in front (drawn near the Sim). */
function Club({ night, seed }: { night: boolean; seed: number }) {
  const anchor = useRef<THREE.Group>(null)
  const at = useMemo(() => new THREE.Vector3(), [])
  const [near, setNear] = useState(false)
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1) return
    tick.current = 0
    if (!anchor.current) return
    anchor.current.getWorldPosition(at)
    const n = Math.hypot(at.x - whereabouts.sim[0], at.z - whereabouts.sim[1]) < NEAR_MAQUIS
    if (n !== near) setNear(n)
  })
  const fill = useClubFill()
  return (
    <group ref={anchor}>
      <Neon night={night} />
      <ClubFront seed={seed} fill={fill} near={near} />
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
function Hospital({ seed }: { seed: number }) {
  return (
    <group>
      {/* A nurse by the ambulance, talking with the driver's mate */}
      <Worker p={[1.6, 0, 2.9]} r={Math.PI / 2} outfit="infirmier" pose="talk" seed={seed} />
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
function Pharmacie({ night, seed }: { night: boolean; seed: number }) {
  const green = night ? '#69ff7a' : '#2f9e44'
  return (
    <group position={[3.6, 0, 2.2]}>
      <Worker p={[-5, 0, -1.3]} outfit="vigile" seed={seed} />
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
