import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { LAUNCH_DEFAULTS, launchTimetable } from '../../lib/espace'
import { buildCalao, calaoMaterial, mergeBoxes, setCalaoFlames, CALAO_COLORS } from './calao'

// A spaceport in the street (the update « espace », open/landmarks.tsx through padLandmarks.ts): the four pads
// (Sassandra, Kourou, Cap Canaveral, Baïkonour) drawn the same, the agency's: the concrete deck and its flame
// trench, the red-and-white service tower and its arms, the lightning masts, the water tower, the assembly hall
// with its open door and the crawler's rails to the pad, the control room and its dishes. And the Calao on it,
// live with the shared timetable (lib/espace.ts): the arms swing back five minutes before, the engines light at
// the minute, it lifts off in its smoke; the pad stays empty half an hour, then the next one is rolled out.
// The visitor centres (Baïkonour's museum too) have theirs: the building, its glass front, a full-size Calao
// mock-up on its plinth, the agency's pennants (never a country's flag).

type B = [number, number, number, number, number, number, string]

const GREY = '#a5a9ad'
const CONCRETE = '#b8b5ad'
const DARK = '#3a3d42'
const RED = '#c92a2a'
const GLASS = '#5c7d99'

/** The spaceport whose pad (or visitor centre) this place is. */
const PAD_OF: Record<string, string> = Object.fromEntries(LAUNCH_DEFAULTS.spaceports.map((s) => [s.pad, s.id]))

/** The pad's ground: the deck, the trench, the rails, the masts, the water tower (one geometry). */
function padBoxes(): B[] {
  const b: B[] = []
  // The deck, raised, and its ramp; the flame trench running out to +z, the flame bucket at its end.
  b.push([0, 0.75, 0, 40, 1.5, 40, CONCRETE])
  b.push([0, 0.4, 28, 16, 0.8, 16, CONCRETE])
  b.push([0, 1.52, 6, 7, 0.06, 14, DARK])
  b.push([0, 0.2, 38, 10, 0.4, 6, DARK])
  // The crawler's two rails, from the hall (−x, −z) to the deck.
  for (const off of [-3, 3]) b.push([-34, 0.08, -20 + off, 52, 0.16, 1.6, '#55585c'])
  // The four lightning masts at the deck's corners, their caps.
  for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
    b.push([x, 30, z, 0.9, 60, 0.9, GREY])
    b.push([x, 60.5, z, 1.4, 1, 1.4, RED])
  }
  // The water tower (for the sound suppression), on its legs.
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.push([34 + x, 9, -30 + z, 0.6, 18, 0.6, GREY])
  b.push([34, 21, -30, 9, 6, 9, '#e9ecef'])
  b.push([34, 21, -30 + 4.52, 9, 1.2, 0.05, CALAO_COLORS.orange])
  return b
}

/** The service tower (beside the rocket, at −x): red and white sections, its platforms. */
function towerBoxes(): B[] {
  const b: B[] = []
  for (let i = 0; i < 13; i++) {
    const y = 1.5 + i * 4
    b.push([-10, y + 2, 0, 5, 4, 5, i % 2 ? '#f1f3f5' : RED])
    b.push([-10, y + 4, 0, 6, 0.3, 6, GREY])
  }
  b.push([-10, 55.5 + 1, 0, 2, 2, 2, RED])
  // The elevator's shaft on its side.
  b.push([-13.2, 28, 0, 1.4, 53, 1.4, DARK])
  return b
}

/** An arm from the tower to the rocket (its pivot at the tower's side, reaching +x). */
function armBoxes(len: number): B[] {
  return [
    [len / 2, 0, 0, len, 1.2, 1.8, GREY],
    [len - 0.5, 0.9, 0, 1, 0.6, 1.8, DARK],
    [len / 2, 0.9, 0.85, len, 0.6, 0.1, '#ffd43b'],
  ]
}

/** The assembly hall: tall, its orange stripe, its door open on a dark inside and a Calao Lourd's base in it. */
function hallBoxes(): B[] {
  const b: B[] = []
  b.push([0, 30, 0, 30, 60, 26, '#e9ecef'])
  b.push([-15.05, 30, 0, 0.1, 60, 6, CALAO_COLORS.orange])
  b.push([0, 59, 0, 30.4, 2, 26.4, GREY])
  // The door on +x side (towards the pad), open: dark inside, the door's frame.
  b.push([15.05, 24, 0, 0.1, 46, 14, '#20242a'])
  b.push([15.2, 47.5, 0, 0.3, 1.2, 15, GREY])
  // The agency's sign: its hornbill orange square and a navy band.
  b.push([0, 52, 13.05, 18, 3, 0.1, CALAO_COLORS.navy])
  b.push([-6.5, 52, 13.12, 2.4, 2.4, 0.1, CALAO_COLORS.orange])
  // Small office wing.
  b.push([0, 4, -16, 22, 8, 6, '#dee2e6'])
  for (let i = 0; i < 5; i++) b.push([-8 + i * 4, 5, -19.05, 2.4, 1.4, 0.1, GLASS])
  return b
}

/** The control room: low, a band of glass, two dishes on the roof. */
function controlBoxes(): B[] {
  const b: B[] = []
  b.push([0, 4, 0, 26, 8, 16, '#dee2e6'])
  b.push([0, 5, 8.05, 24, 2.6, 0.1, GLASS])
  b.push([0, 8.3, 0, 26.4, 0.6, 16.4, CALAO_COLORS.navy])
  for (const [x, s] of [[-7, 1], [6, 1.4]]) {
    b.push([x, 9.6 * 1, 0, 1, 2, 1, GREY])
    b.push([x, 11 + s, 0.6, 4.6 * s, 0.4, 4.6 * s, '#f8f9fa'])
    b.push([x, 11.2 + s, 0.6, 1.8 * s, 0.4, 1.8 * s, '#ced4da'])
    b.push([x, 12 + s, 0.6, 0.3, 1.6, 0.3, GREY])
  }
  // A pennant pole by the door: the agency's orange pennant.
  b.push([14, 5, 9, 0.3, 10, 0.3, GREY])
  b.push([15.3, 9, 9, 2.4, 1.4, 0.1, CALAO_COLORS.orange])
  return b
}

/** The night's lights: the floodlights on the masts, the tower's beacon, the hall's door, the control room. */
function lightBoxes(): B[] {
  const warm = '#fff1c1'
  const b: B[] = []
  for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) b.push([x - Math.sign(x) * 0.8, 44, z - Math.sign(z) * 0.8, 1.6, 1.2, 1.6, warm])
  b.push([-10, 57, 0, 2.1, 0.8, 2.1, '#ff6b6b'])
  return b
}

const geos = new Map<string, THREE.BufferGeometry>()
const geo = (key: string, f: () => B[]) => geos.get(key) ?? (geos.set(key, mergeBoxes(f())), geos.get(key)!)
let lamp: THREE.MeshBasicMaterial | null = null
const lampMat = () => (lamp ??= new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))
const smokeGeo = new THREE.BoxGeometry(1, 1, 1)

/** Where the Calao is on its pad now (minutes since the last launch, to the next). */
function padState(spaceport: string): { since: number; until: number } {
  const now = worldTime() / 60
  const all = launchTimetable(spaceport, Math.floor(now) - 240, Math.floor(now) + 240).filter((l) => !l.scrub)
  const last = [...all].reverse().find((l) => l.at <= now)
  const next = all.find((l) => l.at > now)
  return { since: last ? now - last.at : 999, until: next ? next.at - now : 999 }
}

const SMOKE = 36

/** A spaceport's pad, live. */
export function PadLandmark({ id, night }: { id: string; night: boolean }) {
  if (VISITORS.has(id)) return <VisitorCentre night={night} />
  return <Pad id={id} night={night} />
}

/** A pad, live with the timetable (or with `clock`: the launch being lived, LaunchView.tsx). */
export function Pad({ id, night, clock }: { id: string; night: boolean; /** Minutes since the launch and to it (the trip's own clock). */ clock?: () => { since: number; until: number } }) {
  const sp = PAD_OF[id] ?? 'sassandra'
  const calao = useMemo(() => buildCalao('calao-1'), [])
  const rocket = useRef<THREE.Group>(null)
  const arms = useRef<THREE.Group>(null)
  const smoke = useRef<THREE.InstancedMesh>(null)
  const smokeMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#eef0f2', transparent: true, opacity: 0.85, depthWrite: false }), [])
  useEffect(() => () => smokeMat.dispose(), [smokeMat])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), [])
  useFrame(({ clock: c }) => {
    const { since, until } = clock ? clock() : padState(sp)
    const r = rocket.current
    if (!r) return
    const sec = since * 60
    // Gone (lifted off more than 3 minutes ago, not yet the next one rolled out): the pad stands empty.
    const flying = sec >= 0 && sec < 180
    const away = since >= 3 && since < 33 && until > 25
    r.visible = !away
    r.position.y = flying ? 1.5 + 1.6 * Math.pow(Math.max(0, sec - 3), 2.1) : 1.5
    setCalaoFlames(calao, flying ? 1 : 0, flying ? 1 : 0, 0, c.elapsedTime, 10 + Math.min(30, sec))
    // The arms swing back 5 minutes before, and stay back until the next rocket is there.
    const back = until < 5 || flying || away ? 1 : 0
    if (arms.current) arms.current.rotation.y += ((back * -Math.PI) / 2.2 - arms.current.rotation.y) * 0.05
    // The smoke: from the trench and round the deck, while it lifts and for a few minutes after.
    const s = smoke.current
    if (!s) return
    const k = Math.max(0, sec)
    s.visible = sec >= 0 && sec < 420
    if (!s.visible) return
    const { m, q, p, s: sc } = tmp
    for (let i = 0; i < SMOKE; i++) {
      const a = (i / SMOKE) * Math.PI * 2 + i * 0.7
      const grow = Math.min(1, k / 20)
      const out = (8 + (i % 6) * 6) * grow + k * 0.03 * (i % 3)
      // Most of it out of the trench (+z), the rest all round.
      const dirZ = i % 3 === 0 ? Math.sin(a) : 1
      p.set(Math.cos(a) * out * (i % 3 === 0 ? 1 : 0.6), 3 + (i % 4) * 3 * grow + k * 0.02, 20 * grow * (i % 3 === 0 ? 0 : 1) + dirZ * out * 0.8)
      const size = (5 + (i % 5) * 2) * (0.3 + grow) * (1 + k / 200)
      sc.set(size, size * 0.8, size)
      m.compose(p, q, sc)
      s.setMatrixAt(i, m)
    }
    s.instanceMatrix.needsUpdate = true
    smokeMat.opacity = 0.85 * Math.max(0, 1 - Math.max(0, k - 120) / 300)
  })
  return (
    <group>
      <mesh geometry={geo('pad', padBoxes)} material={calaoMaterial()} receiveShadow castShadow />
      <mesh geometry={geo('tower', towerBoxes)} material={calaoMaterial()} castShadow />
      <group ref={arms} position={[-7.5, 38.5, 0]}>
        <mesh geometry={geo('arm', () => armBoxes(6.4))} material={calaoMaterial()} />
      </group>
      <group position={[-7.5, 20, 0]}>
        <mesh geometry={geo('arm-low', () => armBoxes(5.2))} material={calaoMaterial()} />
      </group>
      <group ref={rocket} position={[0, 1.5, 0]}>
        <primitive object={calao.root} />
      </group>
      <instancedMesh ref={smoke} args={[smokeGeo, smokeMat, SMOKE]} frustumCulled={false} visible={false} />
      <group position={[-70, 0, -24]}>
        <mesh geometry={geo('hall', hallBoxes)} material={calaoMaterial()} castShadow receiveShadow />
      </group>
      <group position={[58, 0, -50]} rotation={[0, -0.6, 0]}>
        <mesh geometry={geo('control', controlBoxes)} material={calaoMaterial()} castShadow receiveShadow />
      </group>
      {night && (
        <>
          <mesh geometry={geo('lights', lightBoxes)} material={lampMat()} />
          <pointLight position={[0, 34, 18]} intensity={5000} distance={180} color="#ffe8b0" />
        </>
      )}
    </group>
  )
}

/* ---------- The visitor centres ---------- */

const VISITORS = new Set(['sassandra-visiteurs', 'kourou-visiteurs', 'canaveral-visiteurs'])

/** The visitor centre: a long low hall with a glass front and a blue roof, its entrance canopy, the pennants. */
function visitorBoxes(): B[] {
  const b: B[] = []
  b.push([0, 0.15, 6, 50, 0.3, 30, '#d9d4c7'])
  b.push([0, 5, -4, 34, 10, 16, '#f1f3f5'])
  b.push([0, 4.6, 4.05, 32, 7, 0.12, GLASS])
  for (let i = 0; i < 9; i++) b.push([-16 + i * 4, 4.6, 4.15, 0.3, 7, 0.1, '#dee2e6'])
  b.push([0, 10.4, -4, 35, 0.8, 17, CALAO_COLORS.navy])
  // The entrance canopy, orange.
  b.push([0, 7.6, 7, 10, 0.4, 6, CALAO_COLORS.orange])
  for (const x of [-4.6, 4.6]) b.push([x, 3.8, 9.6, 0.4, 7.6, 0.4, GREY])
  // The sign over the glass: navy band, the hornbill's orange square.
  b.push([0, 9, 4.2, 14, 1.6, 0.12, CALAO_COLORS.navy])
  b.push([-5.8, 9, 4.3, 1.3, 1.3, 0.1, CALAO_COLORS.orange])
  // The agency's pennants along the walk.
  for (let i = 0; i < 4; i++) {
    const x = -20 + i * 5
    b.push([x, 4, 16, 0.25, 8, 0.25, GREY])
    b.push([x + 1, 7.2, 16, 1.8, 1.1, 0.08, i % 2 ? CALAO_COLORS.orange : CALAO_COLORS.navy])
  }
  // Benches, the mock-up's plinth.
  for (const x of [-12, -6]) b.push([x, 0.5, 12, 3, 0.4, 0.8, '#8a5a32'])
  b.push([18, 0.6, 12, 9, 1.2, 9, CONCRETE])
  return b
}

function VisitorCentre({ night }: { night: boolean }) {
  // The full-size mock-up (the real one in the street is the pad's): a Calao-1 standing outside.
  const mock = useMemo(() => buildCalao('calao-1'), [])
  return (
    <group>
      <mesh geometry={geo('visitors', visitorBoxes)} material={calaoMaterial()} castShadow receiveShadow />
      <group position={[18, 1.2, 12]}>
        <primitive object={mock.root} />
      </group>
      {night && <pointLight position={[0, 8, 14]} intensity={900} distance={60} color="#ffe8b0" />}
    </group>
  )
}
