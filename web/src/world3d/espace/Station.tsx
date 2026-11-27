import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import type { Pose } from '../../avatar/Human'
import { B, Flotteur, floater, Pirogue } from './blocs'
import { Combinaison } from './Combinaison'
import { Terre, type LightCity } from './Terre'

// The Station Akwaba from inside (the update « espace-station »): each of its modules a padded tube in blocks,
// white panels, yellow hand-holds, the cables, the screens, the agency's orange patches. The node (the airlock,
// the spacesuits on their rack, the Pirogue docked behind its porthole) and the living module (the sleeping bags
// on the wall, the galley's sachets of attiéké-poisson and kédjénou on their velcro, the treadmill and its
// bungees); the cupola, its seven windows over the Earth; the laboratory (the beans, the crystals, the attiéké
// floating in its glovebox). The Sim floats (the zero-g pad, blocs.ts), or is where its action puts it.

type V3 = [number, number, number]
const R = 2.8
const PANEL = '#eef1f4'
const PANEL2 = '#dde3ea'
const RAIL = '#ffb703'
const ORANGE = '#ff7a00'

/** A module: an octagonal tube along z, its panels, rails, a light strip; length L, centred on z0. */
function Module({ L, z0 = 0, windows = [], floorOpen = false }: { L: number; z0?: number; windows?: number[]; /** The cupola: no floor, the windows instead. */ floorOpen?: boolean }) {
  const sides = useMemo(() => Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4 + Math.PI / 8), [])
  const w = 2 * R * Math.tan(Math.PI / 8) + 0.02
  return (
    <group position={[0, 0, z0]}>
      {sides.map((a, i) => (floorOpen && i >= 3 && i <= 4) ? null : (
        <group key={i} rotation={[0, 0, a]}>
          <B p={[0, R, 0]} s={[w, 0.2, L]} c={i % 2 ? PANEL : PANEL2} />
          {/* The panels' seams and their lockers */}
          {Array.from({ length: Math.floor(L / 2.2) }, (_, k) => (
            <B key={k} p={[0, R - 0.12, -L / 2 + 1.1 + k * 2.2]} s={[w * 0.82, 0.06, 1.8]} c={(k + i) % 3 ? '#f8f9fa' : '#d0d7e1'} />
          ))}
        </group>
      ))}
      {/* Hand-holds along four sides, a light strip on top, cables */}
      {[0.8, 2.4, 3.9, 5.5].map((a, i) => (
        <group key={i} rotation={[0, 0, a]}>
          {Array.from({ length: Math.floor(L / 3) }, (_, k) => (
            <B key={k} p={[0, R - 0.3, -L / 2 + 1.5 + k * 3]} s={[0.12, 0.12, 1.1]} c={RAIL} />
          ))}
        </group>
      ))}
      <B p={[0, R - 0.18, 0]} s={[0.5, 0.06, L * 0.9]} c="#fffbe6" glow />
      <B p={[R * 0.62, -R * 0.62, 0]} s={[0.08, 0.08, L * 0.95]} c="#4263eb" r={[0, 0, Math.PI / 4]} />
      <B p={[R * 0.58, -R * 0.66, 0]} s={[0.06, 0.06, L * 0.95]} c="#e03131" r={[0, 0, Math.PI / 4]} />
      {/* Portholes (on +x), each showing the stars */}
      {windows.map((z) => (
        <group key={z} position={[R - 0.05, 0.4, z]}>
          <pointLight position={[-0.6, 0, 0]} intensity={4} distance={5} color="#7cc4ff" />
          <B p={[0, 0, 0]} s={[0.12, 1.1, 1.1]} c="#02030a" />
          <B p={[-0.05, 0.6, 0]} s={[0.14, 0.12, 1.3]} c="#adb5bd" />
          <B p={[-0.05, -0.6, 0]} s={[0.14, 0.12, 1.3]} c="#adb5bd" />
        </group>
      ))}
      {/* Stowage: the beige cargo bags strapped to the walls, blue racks' faces, the red emergency handles */}
      {Array.from({ length: Math.floor(L / 4) }, (_, k) => (
        <group key={k} position={[0, 0, -L / 2 + 2 + k * 4]}>
          <B p={[-R + 0.45, -1.2, 0]} s={[0.5, 0.7, 1.1]} c={k % 2 ? '#d9c7a1' : '#cbb68c'} />
          <B p={[-R + 0.45, -0.75, 0]} s={[0.52, 0.05, 1.12]} c="#8a7a5c" />
          <B p={[R - 0.4, 1.3, 0.6]} s={[0.4, 0.6, 0.9]} c={k % 3 ? '#d9c7a1' : '#9bb0c8'} />
          <B p={[-R + 0.3, 1.4, 1.4]} s={[0.06, 0.5, 0.5]} c="#1c3d6e" />
          {k % 2 === 0 && <B p={[R - 0.3, -0.8, -1.2]} s={[0.08, 0.16, 0.5]} c="#e03131" />}
        </group>
      ))}
      {/* Laptops clipped to the walls, their screens on; blue velcro strips; foot loops on the « floor » */}
      {Array.from({ length: Math.floor(L / 6) }, (_, k) => (
        <group key={`l${k}`} position={[0, 0, -L / 2 + 3 + k * 6]}>
          <group position={[R * 0.58, R * 0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
            <B p={[0, 0, 0]} s={[0.06, 0.55, 0.8]} c="#343a40" />
            <B p={[-0.04, 0, 0]} s={[0.02, 0.45, 0.7]} c={k % 2 ? '#74c0fc' : '#ffa94d'} glow />
          </group>
          <B p={[-R * 0.62, R * 0.62, 1.2]} s={[0.04, 0.12, 1.6]} c="#364fc7" r={[0, 0, -Math.PI / 4]} />
          {!floorOpen &&
            [-0.4, 0.4].map((x) => <B key={x} p={[x, -R + 0.32, 1]} s={[0.25, 0.08, 0.35]} c="#495057" />)}
        </group>
      ))}
      {/* The agency's round patch: orange, its white « A » */}
      <group position={[0, R - 0.12, L / 2 - 2.6]} rotation={[Math.PI / 2, 0, 0]}>
        <B p={[0, 0, 0]} s={[0.9, 0.9, 0.04]} c="#ff7a00" r={[0, 0, Math.PI / 4]} />
        <B p={[-0.1, 0, -0.03]} s={[0.1, 0.5, 0.02]} c="#ffffff" r={[0, 0, 0.35]} />
        <B p={[0.1, 0, -0.03]} s={[0.1, 0.5, 0.02]} c="#ffffff" r={[0, 0, -0.35]} />
        <B p={[0, -0.05, -0.03]} s={[0.2, 0.07, 0.02]} c="#ffffff" />
      </group>
      {/* The agency's patch, a screen */}
      <B p={[-R + 0.2, 0.9, L / 2 - 1.5]} s={[0.04, 0.5, 0.8]} c={ORANGE} />
      <B p={[-R + 0.25, 0.1, -L / 2 + 2]} s={[0.06, 0.6, 0.9]} c="#1e3a5f" />
      <B p={[-R + 0.22, 0.1, -L / 2 + 2]} s={[0.04, 0.48, 0.78]} c="#4dabf7" glow />
    </group>
  )
}

/** A hatch (the far end of a module): its ring, its round door, its wheel. */
function Hatch({ z, open = false }: { z: number; open?: boolean }) {
  return (
    <group position={[0, 0, z]}>
      <B p={[0, 0, 0]} s={[R * 2, R * 2, 0.15]} c={PANEL2} />
      <B p={[0, -0.2, 0.1]} s={[2, 2.2, 0.12]} c={open ? '#02030a' : '#adb5bd'} />
      {!open && <B p={[0, -0.2, 0.2]} s={[0.7, 0.7, 0.1]} c="#495057" r={[0, 0, Math.PI / 4]} />}
      <B p={[0, 1.05, 0.12]} s={[2.2, 0.16, 0.16]} c={RAIL} />
    </group>
  )
}

/** A sachet of food, velcroed or floating: its colour, its label. */
function Sachet({ p, c, label, float = 0 }: { p: V3; c: string; label: string; float?: number }) {
  const me = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!me.current || !float) return
    const t = clock.elapsedTime + float * 7
    me.current.position.set(p[0] + Math.sin(t * 0.5) * 0.3, p[1] + Math.sin(t * 0.7) * 0.25, p[2] + Math.cos(t * 0.4) * 0.3)
    me.current.rotation.set(t * 0.3, t * 0.5, t * 0.2)
  })
  return (
    <group ref={me} position={p}>
      <B p={[0, 0, 0]} s={[0.36, 0.5, 0.06]} c="#e9ecef" />
      <B p={[0, 0.06, 0.04]} s={[0.3, 0.22, 0.02]} c={c} />
      <B p={[0, -0.16, 0.04]} s={[0.3, 0.06, 0.02]} c={label} />
    </group>
  )
}

/** The node: the airlock's hatch, the suits on their rack, the Pirogue behind the porthole; then the living module. */
function Noeud({ doing }: { doing?: string }) {
  return (
    <group>
      <Module L={20} windows={[-6, 3]} />
      <Hatch z={-10} open={doing === 'station-sortie'} />
      <Hatch z={10} />
      {/* The suits on their rack, by the airlock */}
      {[-6.5, -8].map((z) => (
        <group key={z} position={[-1.7, -1.4, z]} rotation={[0, Math.PI / 2, 0]} scale={0.8}>
          <Combinaison empty />
        </group>
      ))}
      {/* Outside the porthole: the Pirogue docked, and the Earth far below it */}
      <group position={[6.5, -1.6, -6]} rotation={[0, 0, Math.PI / 2]} scale={0.8}>
        <Pirogue />
      </group>
      {/* The living module's sleeping bags on the wall (+x) */}
      {[4.5, 6.5].map((z, i) => (
        <group key={z} position={[R - 0.5, 0, z]}>
          <B p={[0, 0, 0]} s={[0.5, 2.2, 0.9]} c={i ? '#3b5bdb' : '#1971c2'} />
          <B p={[-0.26, 0.7, 0]} s={[0.04, 0.5, 0.5]} c="#0b1f3a" />
          <B p={[-0.26, -0.2, 0.3]} s={[0.04, 1.2, 0.06]} c="#ced4da" />
        </group>
      ))}
      {/* The galley (-x): its velcro board of sachets, a few floating */}
      <group position={[-R + 0.35, 0, 2]}>
        <B p={[0, 0, 0]} s={[0.12, 1.6, 2.4]} c="#868e96" />
        {[-0.7, 0, 0.7].flatMap((z, i) =>
          [0.4, -0.3].map((y, k) => (
            <group key={`${i}${k}`} position={[0.1, y, z]} rotation={[0, Math.PI / 2, 0]}>
              <Sachet p={[0, 0, 0]} c={(i + k) % 2 ? '#e9c46a' : '#b5651d'} label={(i + k) % 2 ? ORANGE : '#c92a2a'} />
            </group>
          )),
        )}
      </group>
      <Sachet p={[-0.8, 0.8, 1.5]} c="#e9c46a" label={ORANGE} float={1} />
      <Sachet p={[0.6, 1.2, 3]} c="#b5651d" label="#c92a2a" float={2} />
      {/* The treadmill on the « floor », its bungees */}
      <group position={[0, -R + 0.35, 7.5]}>
        <B p={[0, 0, 0]} s={[1, 0.3, 2.4]} c="#343a40" />
        <B p={[0, 0.17, 0]} s={[0.8, 0.04, 2.2]} c="#212529" />
        {[-0.45, 0.45].map((x) => (
          <B key={x} p={[x, 1.1, 0.2]} s={[0.03, 1.9, 0.03]} c="#ff922b" r={[0, 0, x > 0 ? -0.15 : 0.15]} />
        ))}
      </group>
    </group>
  )
}

/** The cupola: a short node, its seven windows facing down, the Earth below. */
function Coupole({ cities }: { cities: LightCity[] }) {
  return (
    <group>
      <Module L={8} floorOpen />
      <Hatch z={-4} />
      <Hatch z={4} />
      {/* The frame: a hexagon of six windows round the round one, cut in the floor */}
      <group position={[0, -R + 0.05, 0]}>
        <B p={[0, 0, 0]} s={[2.4, 0.08, 2.4]} c="#02030a" o={0.1} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3
          return <B key={i} p={[Math.cos(a) * 1.9, 0.04, Math.sin(a) * 1.9]} s={[0.05, 0.08, 2.2]} c="#868e96" r={[0, -a, 0]} />
        })}

      </group>
      {/* Far below: the Earth turning (one orbit in 92 minutes) */}
      <group position={[0, -92, -58]} rotation={[-Math.PI / 2.4, 0, 0]}>
        <Terre radius={30} cities={cities} view="orbite" />
      </group>
    </group>
  )
}

/** The laboratory: the racks, the beans growing under their pink lamps, the crystals, the attiéké in its glovebox. */
function Labo({ doing }: { doing?: string }) {
  const beans = useRef<THREE.Group>(null)
  const cryst = useRef<THREE.Group>(null)
  const grains = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (beans.current) beans.current.scale.y = 0.6 + ((t * 0.05) % 1) * 0.8
    if (cryst.current) cryst.current.rotation.set(t * 0.2, t * 0.3, 0)
    grains.current?.children.forEach((g, i) => g.position.set(Math.sin(t * 0.6 + i) * 0.25, Math.cos(t * 0.5 + i * 1.7) * 0.2, Math.sin(t * 0.4 + i * 2.3) * 0.2))
  })
  return (
    <group>
      <Module L={14} windows={[-4]} />
      <Hatch z={-7} />
      <Hatch z={7} />
      {/* Racks on both walls */}
      {[-1, 1].map((s) =>
        [-3.5, 0, 3.5].map((z) => (
          <group key={`${s}${z}`} position={[s * (R - 0.55), 0, z]}>
            <B p={[0, 0, 0]} s={[0.8, 3.4, 3]} c="#ced4da" />
            {[1, 0, -1].map((y) => (
              <B key={y} p={[-s * 0.42, y, 0]} s={[0.04, 0.6, 2.6]} c="#adb5bd" />
            ))}
          </group>
        )),
      )}
      {/* The beans' chamber */}
      <group position={[-R + 1.1, 0.2, -3.5]}>
        <B p={[0, 0, 0]} s={[0.6, 1.4, 1.6]} c="#c5f6fa" o={0.35} />
        <B p={[0, 0.65, 0]} s={[0.5, 0.06, 1.4]} c="#f783ac" glow />
        <group ref={beans} position={[0, -0.6, 0]}>
          {[-0.5, -0.15, 0.2, 0.55].map((z, i) => (
            <group key={z} position={[0, 0, z]}>
              <B p={[0, 0.35, 0]} s={[0.06, 0.7, 0.06]} c="#2f9e44" />
              <B p={[0.08, 0.6 + (i % 2) * 0.1, 0]} s={[0.2, 0.08, 0.14]} c="#51cf66" />
            </group>
          ))}
        </group>
      </group>
      {/* The crystals' furnace */}
      <group position={[R - 1.1, 0.4, 0]}>
        <B p={[0, 0, 0]} s={[0.6, 1, 1.2]} c="#212529" o={0.6} />
        <group ref={cryst}>
          {[0, 1, 2, 3].map((i) => (
            <B key={i} p={[0, 0, 0]} s={[0.12, 0.5, 0.12]} c="#66d9e8" glow r={[i, i * 0.7, i * 1.3]} />
          ))}
        </group>
      </group>
      {/* The glovebox: a ball of attiéké floating, its grains drifting apart */}
      <group position={[-R + 1.1, 0.2, 3.5]}>
        <B p={[0, 0, 0]} s={[0.6, 1.2, 1.8]} c="#e7f5ff" o={0.3} />
        {[-0.35, 0.35].map((z) => (
          <B key={z} p={[0.32, -0.2, z]} s={[0.06, 0.3, 0.3]} c="#343a40" />
        ))}
        <group ref={grains}>
          {Array.from({ length: doing === 'labo-attieke' ? 14 : 8 }, (_, i) => (
            <B key={i} p={[0, 0, 0]} s={[0.07, 0.07, 0.07]} c="#fff9db" />
          ))}
        </group>
        <B p={[0, 0, 0]} s={[0.22, 0.12, 0.08]} c="#868e96" />
      </group>
    </group>
  )
}

/** Where the camera sits for what's being done (the place's inside, EspaceInside), or null: it follows the Sim. */
export function stationShot(commune: string, kind?: string, doing?: string): { eye: V3; at: V3 } | null {
  if (commune === 'akwaba-coupole') return { eye: [0.5, 0.6, 2.6], at: [0, -5, -3.6] }
  if (!kind) return null
  if (kind === 'espace-sas') return { eye: [1.2, 0.6, -3], at: [0, -0.2, -10] }
  if (kind === 'espace-labo') return doing === 'labo-cristaux' ? { eye: [-0.5, 0.6, 2.5], at: [R - 1.1, 0.4, 0] } : doing === 'labo-attieke' ? { eye: [0.8, 0.8, 6.5], at: [-R + 1.1, 0.2, 3.5] } : { eye: [0.8, 0.8, -0.5], at: [-R + 1.1, 0.2, -3.5] }
  if (doing === 'station-sac') return { eye: [-1, 0.4, 5.5], at: [R - 0.5, 0, 5.5] }
  if (doing === 'station-tapis') return { eye: [-1.6, 0.8, 4.4], at: [0, -1.4, 7.5] }
  if (doing === 'station-sachet' || doing === 'station-kedjenou') return { eye: [1.6, 0.9, 6.8], at: [-R + 0.6, 0, 2] }
  return { eye: [1.4, 0.8, 9], at: [0, 0, 3] }
}

/** Where the Sim floats from, and the room it may float in (half-sizes). */
function home(commune: string, doing?: string): { at: V3; room: V3; pose: Pose; still: boolean } {
  if (doing === 'station-sac') return { at: [R - 0.9, 0.2, 5.5], room: [0, 0, 0], pose: 'sleep', still: true }
  if (doing === 'station-tapis') return { at: [0, -R + 1.55, 7.5], room: [0, 0, 0], pose: 'run', still: true }
  if (doing === 'station-sachet' || doing === 'station-kedjenou') return { at: [-0.9, 0.3, 2.4], room: [0.3, 0.3, 0.3], pose: 'eat', still: false }
  if (doing === 'station-appel') return { at: [0, 0.4, 0], room: [0.4, 0.4, 0.4], pose: 'call', still: false }
  if (doing === 'station-eponge') return { at: [0, 0.3, 1], room: [0.3, 0.3, 0.3], pose: 'wash', still: false }
  if (commune === 'akwaba-coupole') return { at: [-1.5, -0.6, -1.2], room: [0.2, 0.2, 0.3], pose: doing === 'station-photo' ? 'film' : 'lookup', still: false }
  if (commune === 'akwaba-labo') return { at: [0, 0.3, 0], room: [1.4, 1.4, 5], pose: doing?.startsWith('labo-') ? 'busy' : 'swim', still: false }
  return { at: [0, 0.3, 0], room: [1.5, 1.5, 8], pose: 'swim', still: false }
}

export function Station({ commune, look, gender, moodColor, kind, doing, cities }: { commune: string; look: Look; gender: 'femme' | 'homme'; moodColor?: string; kind?: string; doing?: string; cities: LightCity[] }) {
  const h = home(commune, doing)
  const shot = stationShot(commune, kind, doing)
  const eye = useRef(new THREE.Vector3(2, 1.5, 8))
  const look_ = useRef(new THREE.Vector3())
  useFrame(({ camera }, dt) => {
    // The camera: set for the action, or behind the Sim floating, smoothly.
    const want = shot ? new THREE.Vector3(...shot.eye) : new THREE.Vector3(floater.pos.x + 1.2, floater.pos.y + 0.8, floater.pos.z + 6.5)
    const at = shot ? new THREE.Vector3(...shot.at) : floater.pos
    const k = 1 - Math.exp(-dt * 3)
    eye.current.lerp(want, k)
    look_.current.lerp(at, k)
    // Never through a wall.
    const r = Math.hypot(eye.current.x, eye.current.y)
    if (r > R - 0.5) eye.current.multiplyScalar(1).setX((eye.current.x * (R - 0.5)) / r).setY((eye.current.y * (R - 0.5)) / r)
    camera.position.copy(eye.current)
    camera.lookAt(look_.current)
  })
  return (
    <group>
      <hemisphereLight args={['#fff6e8', '#7d8ea3', 0.75]} />
      <pointLight position={[0, 2, -4]} intensity={14} distance={14} color="#fff1d6" />
      <pointLight position={[0, 2, 5]} intensity={14} distance={14} color="#e7f1ff" />
      <directionalLight position={[10, 20, 10]} intensity={0.6} />
      {commune === 'akwaba-coupole' ? <Coupole cities={cities} /> : commune === 'akwaba-labo' ? <Labo doing={doing} /> : <Noeud doing={doing} />}
      <Flotteur key={`${commune}${doing ?? ''}`} look={look} gender={gender} moodColor={moodColor} bounds={h.room} home={h.at} pose={h.pose} still={h.still} />
    </group>
  )
}
