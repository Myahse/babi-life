import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng, type Theme } from './themes'
import { BACK_STREET_Z, CROSS_X, EXTENT_X, SIDEWALK, STRETCH, STREET_HALF } from './layout'
import { Vehicle, type VehicleKind } from './vehicles'
import { CHECK_SECONDS, boulevardLight, crossLight, drive, type Light, type Mover, type Track } from './traffic'

// What makes a street feel alive: people walking the sidewalks or chatting in
// small groups, and the traffic of taxis, woro-woros, gbakas and motos.

type Walker = { x: number; z: number; dir: number; speed: number; still: boolean; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number }

export function Pedestrians({ theme, seed }: { theme: Theme; seed: string }) {
  const people = useMemo<Walker[]>(() => {
    const r = rng(`people${seed}`)
    return [...Array(Math.round(theme.pedestrians * STRETCH))].map(() => {
      const gender: Walker['gender'] = r() < 0.5 ? 'femme' : 'homme'
      return {
        x: (r() * 2 - 1) * (EXTENT_X - 30),
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
      if (Math.abs(p.x) > EXTENT_X - 25) p.dir *= -1
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

/* ---------- Traffic and traffic lights ---------- */

const lengthOf = (k: VehicleKind) => (k === 'gbaka' ? 5.6 : k === 'moto' ? 1.6 : 4.3)
// Stop lines, before the zebra crossings: on the boulevard, from the cross
// street's centre line; on a cross street, from the boulevard's.
const STOP_X = 5.5
// Where the police set up, on the eastbound side of the boulevard.
const CHECK_X = 88
const COP = (seed: number) => ({ ...randomLook('homme', () => seed), outfit: 'suit', outfitColor: '#2f4a3a', bottomColor: '#2f4a3a', accessory: 'cap', accessoryColor: '#2f4a3a' })

function Checkpoint({ pose, copRef, noteRef }: { pose: Pose; copRef: React.RefObject<THREE.Group | null>; noteRef: React.RefObject<THREE.Mesh | null> }) {
  return (
    <group>
      {/* Cones across half the lane, and the sergeant who stays put */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[CHECK_X + 3 + k * 1.6, 0.35, 3.9 - k * 0.5]}>
          <coneGeometry args={[0.22, 0.7, 10]} />
          <meshLambertMaterial color={k % 2 ? '#ffffff' : '#ff6a00'} />
        </mesh>
      ))}
      <NoShadows>
        <group position={[CHECK_X + 4, 0, STREET_HALF + 1.4]} rotation={[0, Math.PI, 0]}>
          <Human look={COP(0.21)} gender="homme" pose="idle" seed={5} />
        </group>
        <group ref={copRef} position={[CHECK_X + 1.5, 0, STREET_HALF + 1]}>
          <Human look={COP(0.63)} gender="homme" pose={pose} seed={9} />
        </group>
      </NoShadows>
      <mesh ref={noteRef} visible={false}>
        <boxGeometry args={[0.16, 0.02, 0.08]} />
        <meshBasicMaterial color="#7cc576" />
      </mesh>
    </group>
  )
}
const STOP_GAP = STREET_HALF + 3.2

export function Traffic({ theme, seed }: { theme: Theme; seed: string }) {
  const tracks = useMemo<Track[]>(() => {
    const r = rng(`cars${seed}`)
    const kinds: VehicleKind[] = ['taxi', 'woro', 'woro', 'gbaka', 'car', 'car', 'moto']
    const vehicle = (): Omit<Mover, 's' | 'v'> => {
      const drawn = kinds[Math.floor(r() * kinds.length)]
      // No woro-woro here (the Plateau): an orange taxi compteur instead.
      const kind = drawn === 'woro' && !theme.woro ? 'taxi' : drawn
      return {
        kind,
        len: lengthOf(kind),
        trim: kind === 'woro' ? theme.woroTrim : undefined,
        color: kind === 'woro' ? theme.woro : kind === 'car' ? ['#f8f9fa', '#212529', '#adb5bd', '#c92a2a', '#1c7ed6'][Math.floor(r() * 5)] : undefined,
        speed: (kind === 'gbaka' ? 7 : kind === 'moto' ? 11 : 9) + r() * 3,
      }
    }
    const spread = (n: number, length: number) => [...Array(n)].map((_, i) => ({ ...vehicle(), v: 0, s: ((i + r() * 0.5) / n) * length }))
    const L = EXTENT_X * 2
    const crossings = [-CROSS_X, CROSS_X]
    const police = r() < 0.7
    const vehicles = Math.round(theme.vehicles * STRETCH)
    const half = Math.ceil(vehicles / 2)
    const boulevard: Track[] = [
      // Eastbound (+x) on the far lane, westbound on the near one.
      { length: L, movers: spread(half, L), stops: crossings.map((x) => x - STOP_X + EXTENT_X), light: boulevardLight, place: (s) => [s - EXTENT_X, 2.2], rot: 0, checkpoint: police ? CHECK_X + EXTENT_X : undefined },
      { length: L, movers: spread(vehicles - half, L), stops: crossings.map((x) => EXTENT_X - (x + STOP_X)), light: boulevardLight, place: (s) => [EXTENT_X - s, -2.2], rot: Math.PI },
    ]
    // A little traffic on the cross streets, waiting for its green.
    const CL = (BACK_STREET_Z + 3) * 2
    const cross: Track[] = crossings.flatMap((x) => [
      { length: CL, movers: spread(2, CL), stops: [BACK_STREET_Z + 3 - STOP_GAP], light: crossLight, place: (s: number): [number, number] => [x - 1.8, s - BACK_STREET_Z - 3], rot: -Math.PI / 2 },
      { length: CL, movers: spread(2, CL), stops: [BACK_STREET_Z + 3 - STOP_GAP], light: crossLight, place: (s: number): [number, number] => [x + 1.8, BACK_STREET_Z + 3 - s], rot: Math.PI / 2 },
    ])
    return [...boulevard, ...cross]
  }, [theme, seed])
  const refs = useRef<(THREE.Group | null)[][]>(tracks.map(() => []))

  // Beggars at the lights: they wait on the median before each crossing and,
  // when the cars stop at the red, walk to a driver's window with a hand out.
  const beggars = useMemo(() => {
    const r = rng(`beggars${seed}`)
    return [-CROSS_X, CROSS_X].flatMap((X) =>
      [0, 1].map((track) => {
        const side = track === 0 ? 1 : -1 // eastbound lane is z > 0
        const home: [number, number] = [X - side * (STOP_X + 7), side * 0.5]
        const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
        return { track, side, home, x: home[0], z: home[1], gender, look: { ...randomLook(gender, r), outfit: r() < 0.5 ? 'boubou' : 'pagne', outfitColor: '#9c8f7a' }, seed: r() * 100 }
      }),
    )
  }, [seed])
  const beggarRefs = useRef<(THREE.Group | null)[]>([])
  // The police at the checkpoint: one stays by the cones, the other walks to
  // the gbaka pulled over, takes the papers… and the note slipped with them.
  const hasPolice = tracks[0].checkpoint !== undefined
  const cop = useRef({ x: CHECK_X + 1.5, z: STREET_HALF + 1 })
  const copRef = useRef<THREE.Group>(null)
  const noteRef = useRef<THREE.Mesh>(null)
  const [copPose, setCopPose] = useState<Pose>('idle')
  const [poses, setPoses] = useState<Pose[]>(() => beggars.map(() => 'idle'))

  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    tracks.forEach((track, ti) => {
      drive(track, t, step)
      track.movers.forEach((m, i) => {
        const g = refs.current[ti]?.[i]
        if (!g) return
        const [x, z] = track.place(m.s)
        g.position.set(x, 0, z)
      })
    })
    const next = beggars.map((b, i) => {
      const track = tracks[b.track]
      // A car stopped at this light, close to the beggar: go to its window.
      let target = b.home
      if (track.light(t) === 'red') {
        const stop = track.stops.find((st) => Math.abs(track.place(st)[0] - (b.home[0] + b.side * 7)) < 1)!
        const car = track.movers.filter((m) => m.v < 0.4 && m.s + m.len / 2 > stop - 16 && m.s + m.len / 2 < stop + 0.5).sort((a, c) => c.s - a.s)[0]
        if (car) target = [track.place(car.s)[0] - b.side * 0.4, b.side * 1.05]
      }
      const dx = target[0] - b.x
      const dz = target[1] - b.z
      const d = Math.hypot(dx, dz)
      const v = Math.min(d, 1.4 * step)
      if (d > 0.05) {
        b.x += (dx / d) * v
        b.z += (dz / d) * v
      }
      const g = beggarRefs.current[i]
      if (g) {
        g.position.set(b.x, 0, b.z)
        // Face where they walk; at a window, face the car.
        g.rotation.y = d > 0.05 ? Math.atan2(dx, dz) : target === b.home ? (b.side > 0 ? Math.PI / 2 : -Math.PI / 2) : b.side > 0 ? 0 : Math.PI
      }
      return (d > 0.05 ? 'walk' : target === b.home ? 'idle' : 'beg') as Pose
    })
    if (next.some((p, i) => p !== poses[i])) setPoses(next)
    if (hasPolice) {
      const held = tracks[0].movers.find((m) => m.check === 'held' && (m.pause ?? 0) > 0)
      const target: [number, number] = held ? [tracks[0].place(held.s)[0] + 1, 3.5] : [CHECK_X + 1.5, STREET_HALF + 1]
      const c = cop.current
      const dx = target[0] - c.x
      const dz = target[1] - c.z
      const d = Math.hypot(dx, dz)
      if (d > 0.05) {
        const v = Math.min(d, 1.6 * step)
        c.x += (dx / d) * v
        c.z += (dz / d) * v
      }
      copRef.current?.position.set(c.x, 0, c.z)
      if (copRef.current) copRef.current.rotation.y = d > 0.05 ? Math.atan2(dx, dz) : Math.PI
      // The note changes hands near the end of the stop.
      if (noteRef.current) {
        noteRef.current.visible = !!held && d < 0.1 && (held.pause ?? 0) < CHECK_SECONDS - 3
        noteRef.current.position.set(c.x, 1.25, c.z - 0.45)
      }
      const p: Pose = d > 0.05 ? 'walk' : held ? 'beg' : 'idle'
      if (p !== copPose) setCopPose(p)
    }
  })
  return (
    <>
      {hasPolice && <Checkpoint pose={copPose} copRef={copRef} noteRef={noteRef} />}
      <NoShadows>
        {beggars.map((b, i) => (
          <group key={`b${i}`} ref={(g) => void (beggarRefs.current[i] = g)} position={[b.x, 0, b.z]}>
            <Human look={b.look} gender={b.gender} pose={poses[i]} seed={b.seed} />
          </group>
        ))}
      </NoShadows>
      {tracks.map((track, ti) =>
        track.movers.map((m, i) => {
          const [x, z] = track.place(m.s)
          return (
            <group key={`${ti}-${i}`} ref={(g) => void ((refs.current[ti] ??= [])[i] = g)} position={[x, 0, z]}>
              <Vehicle p={[0, 0, 0]} r={track.rot} kind={m.kind} color={m.color} trim={m.trim} seed={i} />
            </group>
          )
        }),
      )}
    </>
  )
}

/** The traffic lights at the cross streets, changing with the traffic. */
export function TrafficLights() {
  const heads = useRef<{ light: (t: number) => Light; lamps: (THREE.Mesh | null)[] }[]>([])
  useFrame(({ clock }) => {
    for (const h of heads.current) {
      const now = h.light(clock.elapsedTime)
      h.lamps.forEach((lamp, i) => {
        if (!lamp) return
        const on = (['red', 'amber', 'green'] as Light[])[i] === now
        const mat = lamp.material as THREE.MeshLambertMaterial
        mat.emissiveIntensity = on ? 1.6 : 0
        mat.color.set(on ? LAMP[i] : '#2b2f3a')
      })
    }
  })
  const poles: { x: number; z: number; light: (t: number) => Light; face: number }[] = [-CROSS_X, CROSS_X].flatMap((X) => [
    { x: X - 4.6, z: STREET_HALF + 1.6, light: boulevardLight, face: -Math.PI / 2 },
    { x: X + 4.6, z: -(STREET_HALF + 1.6), light: boulevardLight, face: Math.PI / 2 },
    { x: X + 4.6, z: STREET_HALF + 1.6, light: crossLight, face: Math.PI },
    { x: X - 4.6, z: -(STREET_HALF + 1.6), light: crossLight, face: 0 },
  ])
  return (
    <>
      {poles.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.face, 0]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 3.2, 8]} />
            <meshLambertMaterial color="#3a3f4b" />
          </mesh>
          <mesh position={[0, 3.55, 0]}>
            <boxGeometry args={[0.45, 1.3, 0.4]} />
            <meshLambertMaterial color="#1d2028" />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh
              key={k}
              position={[0, 3.95 - k * 0.4, 0.21]}
              ref={(m) => {
                heads.current[i] ??= { light: p.light, lamps: [] }
                heads.current[i].lamps[k] = m
              }}
            >
              <sphereGeometry args={[0.13, 10, 8]} />
              <meshLambertMaterial color="#2b2f3a" emissive={LAMP[k]} emissiveIntensity={0} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}
const LAMP = ['#ff3b30', '#ffb300', '#2ee66b']
