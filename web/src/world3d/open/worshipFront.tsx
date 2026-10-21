import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { whereabouts } from '../whereabouts'
import { NoShadows, type Pose } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { LowHuman } from '../../avatar/LowHuman'
import { randomLook } from '../../avatar/options'

// A place of worship seen from the street, by its faith (backend
// game/faith.go): a mosque its minaret with the loudspeakers on its balcony,
// a parish its open belfry and the Virgin by the door, a temple (evangelical,
// Methodist, Baptist…) its great white cross. And their gatherings, on the
// game's clock: Sunday's masses, the people in their Sunday best on the
// forecourt before and after; the culte under the bâche in front, plastic
// chairs, the pastor at the microphone, the drum and the keyboard; Friday's
// veillée into the night. (The mosque's prayers are dressing.tsx's.)
// Local frame: the door at the origin, +z toward the street, x along the façade.

const mats = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string, glow = 0) => {
  const k = `${c}|${glow}`
  let m = mats.get(k)
  if (!m) mats.set(k, (m = new THREE.MeshLambertMaterial({ color: c, emissive: glow ? c : '#000000', emissiveIntensity: glow })))
  return m
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12)
const DOME = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)
const HORN = new THREE.ConeGeometry(0.16, 0.4, 8, 1, true)
const B = ({ p, s, c, glow = 0, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; glow?: number; r?: number }) => <mesh geometry={BOX} material={mat(c, glow)} position={p} scale={s} rotation={[0, r, 0]} />
const C = ({ p, r, h, c }: { p: [number, number, number]; r: number; h: number; c: string }) => <mesh geometry={CYL} material={mat(c)} position={p} scale={[r, h, r]} />
const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

/** The minaret's top, for the call to prayer's bubble. */
export const MINARET_TOP: [number, number, number] = [3.6, 15.6, -0.6]

/** A mosque's minaret beside its door: a white shaft with green bands, the balcony and its loudspeakers, the little dome and the crescent; the green arch over the door. */
export function Minaret() {
  const [x, , z] = MINARET_TOP
  return (
    <group>
      <group position={[x, 0, z]}>
        <B p={[0, 1.5, 0]} s={[1.7, 3, 1.7]} c="#efe6d2" />
        <C p={[0, 7.5, 0]} r={0.62} h={9} c="#f7f3ea" />
        {[5.2, 8.6].map((y) => (
          <C key={y} p={[0, y, 0]} r={0.66} h={0.35} c="#1f8a4c" />
        ))}
        <C p={[0, 12.15, 0]} r={1.05} h={0.3} c="#1f8a4c" />
        <C p={[0, 12.65, 0]} r={1.0} h={0.7} c="#f7f3ea" />
        <C p={[0, 13.6, 0]} r={0.45} h={1.6} c="#f7f3ea" />
        <mesh geometry={DOME} material={mat('#1f8a4c')} position={[0, 14.4, 0]} scale={0.55} />
        <B p={[0, 15.2, 0]} s={[0.07, 0.8, 0.07]} c="#d4a017" />
        <B p={[0.12, 15.55, 0]} s={[0.07, 0.3, 0.07]} c="#d4a017" />
        <B p={[-0.12, 15.55, 0]} s={[0.07, 0.3, 0.07]} c="#d4a017" />
        {/* The loudspeakers, one to each side */}
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
          <mesh key={a} geometry={HORN} material={mat('#c9ccd2')} position={[Math.sin(a) * 0.75, 13, Math.cos(a) * 0.75]} rotation={[Math.PI / 2, 0, -a]} />
        ))}
      </group>
      {/* The green arch round the door */}
      <B p={[-0.85, 1.4, 0.12]} s={[0.25, 2.8, 0.2]} c="#1f8a4c" />
      <B p={[0.85, 1.4, 0.12]} s={[0.25, 2.8, 0.2]} c="#1f8a4c" />
      <B p={[0, 2.9, 0.12]} s={[1.95, 0.35, 0.2]} c="#1f8a4c" />
    </group>
  )
}

/** A parish's open belfry beside the door (its bell, its cross), the cross over the door, the Virgin on her pedestal. */
export function Belfry() {
  return (
    <group>
      <group position={[-3.6, 0, -0.6]}>
        {[
          [-0.7, -0.7],
          [0.7, -0.7],
          [-0.7, 0.7],
          [0.7, 0.7],
        ].map(([dx, dz]) => (
          <B key={`${dx}${dz}`} p={[dx, 4.5, dz]} s={[0.3, 9, 0.3]} c="#f4f1ea" />
        ))}
        <B p={[0, 9.15, 0]} s={[1.9, 0.3, 1.9]} c="#b5532c" />
        <B p={[0, 5.4, 0]} s={[1.7, 0.2, 1.7]} c="#f4f1ea" />
        <mesh geometry={DOME} material={mat('#c9a14a')} position={[0, 7.1, 0]} scale={[0.5, -0.6, 0.5]} />
        <B p={[0, 10.2, 0]} s={[0.14, 1.8, 0.14]} c="#f4f1ea" />
        <B p={[0, 10.6, 0]} s={[0.8, 0.14, 0.14]} c="#f4f1ea" />
      </group>
      <B p={[0, 4.3, 0.1]} s={[0.14, 1.2, 0.08]} c="#f4f1ea" />
      <B p={[0, 4.5, 0.1]} s={[0.6, 0.14, 0.08]} c="#f4f1ea" />
      {/* The Virgin: white, her blue mantle */}
      <group position={[2.4, 0, 1.1]}>
        <B p={[0, 0.5, 0]} s={[0.7, 1, 0.7]} c="#d9d2c3" />
        <C p={[0, 1.55, 0]} r={0.2} h={1.1} c="#5b8fd6" />
        <C p={[0, 1.5, 0]} r={0.14} h={1.0} c="#f8f8f4" />
        <mesh geometry={DOME} material={mat('#f1d9b5')} position={[0, 2.1, 0]} scale={0.14} />
      </group>
    </group>
  )
}

/** A temple's great white cross, standing by the door. */
export function TempleCross() {
  return (
    <group position={[-3.2, 0, 0.5]}>
      <B p={[0, 0.25, 0]} s={[1, 0.5, 1]} c="#d9d2c3" />
      <B p={[0, 3.6, 0]} s={[0.32, 6.6, 0.32]} c="#fafafa" />
      <B p={[0, 5.2, 0]} s={[2.2, 0.32, 0.32]} c="#fafafa" />
    </group>
  )
}

type Moment = { phase: 'none' | 'gather' | 'inside' | 'leave' | 'culte' | 'veillee'; size: number }

/**
 * Where a church is in its week, from the shared clock (the game's epoch is a
 * Monday; Abidjan is on UTC). Masses on Sunday at 7 and 9:30, and at 6:30 on
 * weekdays; the culte on Sunday from 9 to 12:30; the veillée on Friday from 21
 * to 1.
 */
export function churchMoment(faith: string): Moment {
  const t = worldTime()
  const day = Math.floor(t / 86400) % 7
  const min = (t / 60) % 1440
  const none: Moment = { phase: 'none', size: 0 }
  if (faith === 'catholique') {
    const masses = day === 6 ? [[7 * 60, 90], [9 * 60 + 30, 90]] : [[6 * 60 + 30, 45]]
    for (const [at, len] of masses) {
      const size = day === 6 ? 1 : 0.25
      if (min >= at - 25 && min < at) return { phase: 'gather', size }
      if (min >= at && min < at + len) return { phase: 'inside', size }
      if (min >= at + len && min < at + len + 20) return { phase: 'leave', size }
    }
    return none
  }
  if (day === 6) {
    if (min >= 8 * 60 + 35 && min < 9 * 60) return { phase: 'gather', size: 0.8 }
    if (min >= 9 * 60 && min < 12 * 60 + 30) return { phase: 'culte', size: 1 }
    if (min >= 12 * 60 + 30 && min < 12 * 60 + 50) return { phase: 'leave', size: 0.8 }
  }
  // Friday night's veillée, and its last hour past midnight (Saturday).
  if (faith === 'evangelique' && ((day === 4 && min >= 21 * 60) || (day === 5 && min < 60))) return { phase: 'veillee', size: 0.7 }
  return none
}

const NEAR = 120 // metres: drawn when the Sim is this close

/** The gatherings in front of a church, while the Sim is near. */
export function Service({ name, faith, night }: { name: string; faith: string; night: boolean }) {
  const anchor = useRef<THREE.Group>(null)
  const [state, setState] = useState<{ near: boolean; m: Moment }>({ near: false, m: { phase: 'none', size: 0 } })
  const tick = useRef(10)
  const at = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1) return
    tick.current = 0
    if (!anchor.current) return
    anchor.current.getWorldPosition(at)
    const near = Math.hypot(at.x - whereabouts.sim[0], at.z - whereabouts.sim[1]) < NEAR
    const m = churchMoment(faith)
    if (near !== state.near || m.phase !== state.m.phase) setState({ near, m })
  })
  // The faithful in their Sunday best: white, the pagnes, suits and long dresses.
  const people = useMemo(() => {
    const r = rnd(name.length * 613 + 7)
    return [...Array(40)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.6 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      const dress = gender === 'femme' ? ['pagne', 'robe', 'kaba', 'pagne'][i % 4] : ['suit', 'chemise-pagne', 'boubou', 'chemise'][i % 4]
      return { gender, look: { ...look, outfit: dress, outfitColor: i % 3 ? look.outfitColor : '#f8f8f4' }, seed: r() * 100, dx: (r() - 0.5) * 9, dz: 1.5 + r() * 6, ry: r() * Math.PI * 2 }
    })
  }, [name])
  const { near, m } = state
  if (!near || m.phase === 'none') return <group ref={anchor} />
  const n = Math.round(people.length * m.size)
  return (
    <group ref={anchor}>
      <NoShadows>
        {/* Before and after: the forecourt full, people greeting and talking */}
        {(m.phase === 'gather' || m.phase === 'leave') &&
          people.slice(0, n).map((p, i) => (
            <group key={i} position={[p.dx, 0, p.dz]} rotation={[0, p.ry, 0]}>
              <LowHuman look={p.look} gender={p.gender} pose={(['talk', 'idle', 'wave', 'phone'] as Pose[])[i % 4]} seed={p.seed} />
            </group>
          ))}
        {/* During mass the church is full: the late ones stand at the door */}
        {m.phase === 'inside' &&
          people.slice(0, Math.max(2, Math.round(n / 6))).map((p, i) => (
            <group key={i} position={[(i - 2) * 0.7, 0, 0.8 + (i % 2) * 0.6]} rotation={[0, Math.PI, 0]}>
              <LowHuman look={p.look} gender={p.gender} pose="pray" seed={p.seed} />
            </group>
          ))}
        {(m.phase === 'culte' || m.phase === 'veillee') && <Culte people={people} veillee={m.phase === 'veillee'} night={night} />}
      </NoShadows>
    </group>
  )
}

/** The culte under the bâche: rows of plastic chairs facing the door, the pastor at the microphone, the band; at the veillée everyone stands and sings. */
function Culte({ people, veillee, night }: { people: { gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number }[]; veillee: boolean; night: boolean }) {
  const seats = useMemo(() => {
    const out: [number, number][] = []
    for (let row = 0; row < 4; row++) for (let k = 0; k < 7; k++) out.push([(k - 3) * 0.95, 3.2 + row * 1.15])
    return out
  }, [])
  return (
    <group>
      {/* The bâche: four poles and a striped roof */}
      {[
        [-4.2, 1.6],
        [4.2, 1.6],
        [-4.2, 7.6],
        [4.2, 7.6],
      ].map(([x, z]) => (
        <B key={`${x}${z}`} p={[x, 1.65, z]} s={[0.1, 3.3, 0.1]} c="#9aa0a8" />
      ))}
      {[...Array(6)].map((_, i) => (
        <B key={i} p={[-3.5 + i * 1.4, 3.4, 4.6]} s={[1.4, 0.06, 6.4]} c={i % 2 ? '#ffffff' : '#2d6cdf'} />
      ))}
      {/* The pastor and his microphone, the drum and the keyboard by the door */}
      <group position={[0, 0, 1.6]}>
        <TalkHuman id={`worshipFront:222:${Math.round((2) * 1000)}`} look={{ ...people[1].look, outfit: 'suit', outfitColor: '#1d2b44' }} gender="homme" pose={veillee ? 'cheer' : 'rant'} seed={2} />
      </group>
      <B p={[-2.6, 0.45, 1.4]} s={[0.6, 0.9, 0.6]} c="#7a3b1c" />
      <B p={[2.6, 0.8, 1.4]} s={[1.3, 0.1, 0.45]} c="#1b1b1f" />
      <B p={[2.6, 0.4, 1.4]} s={[0.1, 0.8, 0.1]} c="#1b1b1f" />
      {/* The chairs and the faithful: seated for the culte, standing and singing at the veillée */}
      {seats.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, Math.PI, 0]}>
          {!veillee && <B p={[0, 0.22, 0.05]} s={[0.45, 0.06, 0.45]} c="#e8e4dc" />}
          {i < people.length && <LowHuman look={people[i].look} gender={people[i].gender} pose={veillee ? (i % 3 ? 'cheer' : 'pray') : i % 5 ? 'sit' : 'cheer'} seed={people[i].seed} />}
        </group>
      ))}
      {night && <pointLight position={[0, 2.6, 4.5]} intensity={6} distance={12} color="#fff1d0" />}
    </group>
  )
}
