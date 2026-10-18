import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { DOORS_OPEN, eventAt, useStadium, type StadiumEvent } from '../../lib/stadium'
import { whereabouts } from '../whereabouts'
import { lettering } from './ruePrincesse'

// The stadium when something's on (lib/stadium.ts, backend game/stadium.go):
// the stands filling from the doors opening, the fans in their club's
// colours jumping, the ola going round; for a match the two teams after the
// ball, the goals cheered (« BUUUT ! ») as they come; for a concert the stage
// at the end of the pitch, the screen with the artist's name, the lights
// sweeping, the crowd on the pitch with their hands up. At night the
// floodlights. The same moment on every screen (the shared clock).

const SX = 1.25 // the bowl's stretch along the pitch (landmarks.tsx)
const FANS = 2600
const PIT = 700 // the crowd on the pitch, at a concert
const COLORS: Record<string, [string, string]> = {}
const PALETTE: [string, string][] = [
  ['#f08a24', '#ffffff'],
  ['#2f9a4a', '#ffffff'],
  ['#d6202a', '#ffd43b'],
  ['#1f4fa0', '#ffffff'],
  ['#ffd43b', '#141416'],
  ['#7a1f2b', '#f4f1ea'],
  ['#141416', '#f08a24'],
  ['#0ca678', '#141416'],
]
const colorsOf = (club = '') => (COLORS[club] ??= PALETTE[[...club].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length])

const minuteNow = () => worldTime() / 60
const SKIN = ['#3b2414', '#4a2c1a', '#5c3820', '#6e4428', '#7f5233', '#8f6240', '#a5754d']
const FLAGS = 64

export function StadiumLive({ place, night, demo }: { place: string; night: boolean; demo?: StadiumEvent }) {
  const agenda = useStadium(demo ? null : place)
  const [on, setOn] = useState<StadiumEvent | null>(null)
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 2) return
    tick.current = 0
    const e = demo ?? eventAt(agenda, minuteNow())
    if (e?.start !== on?.start) setOn(e)
  })
  if (!on) return null
  return <Live key={on.start} e={on} night={night} />
}

function Live({ e, night }: { e: StadiumEvent; night: boolean }) {
  const match = e.kind === 'match'
  const g = useRef<THREE.Group>(null)
  const [near, setNear] = useState(false)
  const [shout, setShout] = useState<string | null>(null)

  // Where each fan sits on the bowl (from the track at r 53, 2.5 m up, to r 77, 22 m up).
  const fans = useMemo(() => {
    const out: { x: number; y: number; z: number; a: number; phase: number; fill: number }[] = []
    let seed = e.start % 9973
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < FANS; i++) {
      const a = rnd() * Math.PI * 2
      const t = rnd()
      const r = 54 + t * 22
      out.push({ x: Math.cos(a) * r * SX, y: 2.9 + t * 19.2, z: Math.sin(a) * r, a, phase: rnd() * 6.28, fill: rnd() })
    }
    return out
  }, [e.start])
  const crowd = useRef<THREE.InstancedMesh>(null)
  const pit = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const arms = useRef<THREE.InstancedMesh>(null)
  const flags = useRef<THREE.InstancedMesh>(null)
  const beams = useRef<THREE.Group>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const here = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const paintSkin = (mesh: THREE.InstancedMesh) => {
    if (mesh.userData.painted) return
    const c = new THREE.Color()
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, c.set(SKIN[Math.floor(fans[i % fans.length].phase * 7) % SKIN.length]))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.Material).needsUpdate = true
    mesh.userData.painted = true
  }
  const paintFlags = (mesh: THREE.InstancedMesh) => {
    if (mesh.userData.painted) return
    const c = new THREE.Color()
    for (let i = 0; i < FLAGS; i++) {
      const f = fans[i * 37]
      mesh.setColorAt(i, c.set((Math.cos(f.a) > 0 ? colorsOf(e.home) : colorsOf(e.away))[i % 3 === 0 ? 1 : 0]))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.Material).needsUpdate = true
    mesh.userData.painted = true
  }

  // The fans' shirts: half in each club's colours for a match, everything for a concert.
  const paint = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh || mesh.userData.painted) return
    const c = new THREE.Color()
    const [h, a] = [colorsOf(e.home), colorsOf(e.away)]
    const mixed = ['#ff7a00', '#ffffff', '#2f9a4a', '#ffd43b', '#e8432f', '#1f6fd0', '#d0bfff', '#141416']
    for (let i = 0; i < mesh.count; i++) {
      const f = fans[i % fans.length]
      const pick = match ? (Math.cos(f.a) > 0 ? h : a)[f.fill < 0.7 ? 0 : 1] : mixed[Math.floor(f.fill * mixed.length)]
      mesh.setColorAt(i, c.set(pick))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // The material was built before the colours: rebuild it with them.
    ;(mesh.material as THREE.Material).needsUpdate = true
    mesh.userData.painted = true
  }

  const step = useRef(1)
  const lastGoals = useRef(-1)
  useFrame((_, dt) => {
    const now = minuteNow()
    const t = worldTime()
    // Seen from close enough: the bubbles, the shouts.
    if (g.current) {
      g.current.getWorldPosition(here)
      const d = Math.hypot(here.x - whereabouts.sim[0], here.z - whereabouts.sim[1])
      if (d < 260 !== near) setNear(d < 260)
    }
    // The goals as they come; at a concert, the artist calls out now and then.
    if (match) {
      const k = Math.max(0, now - e.start)
      const hs = (e.homeGoals ?? []).filter((x) => x <= k).length
      const as = (e.awayGoals ?? []).filter((x) => x <= k).length
      if (lastGoals.current >= 0 && hs + as > lastGoals.current) setShout(`BUUUT ! ${e.home} ${hs} – ${as} ${e.away}`)
      if (lastGoals.current !== hs + as) lastGoals.current = hs + as
      const recent = [...(e.homeGoals ?? []), ...(e.awayGoals ?? [])].some((x) => k - x >= 0 && k - x < 1.5)
      if (!recent && shout?.startsWith('BUUUT')) setShout(null)
    } else if (now >= e.start) {
      const lines = ['Les mains en l’air !!', 'Babi, vous êtes là ?!', 'Tout le monde chante avec moi !', 'On fait du bruit pour Babi !']
      const k = Math.floor(t / 9)
      const say = k % 3 === 0 ? lines[k % lines.length] : null
      if (say !== shout) setShout(say)
    }

    // The stands: fuller as the start comes near; jumping, faster when it's hot; the ola going round.
    step.current += dt
    if (step.current < 1 / 15) return
    step.current = 0
    const filled = Math.min(1, Math.max(0.15, (now - (e.start - DOORS_OPEN)) / DOORS_OPEN))
    const hot = match ? (shout ? 1 : 0.25) : now >= e.start ? 0.8 : 0.2
    const ola = (t * 0.6) % (Math.PI * 2)
    const cm = crowd.current
    const hm = heads.current
    const am = arms.current
    if (cm && hm && am) {
      paint(cm)
      paintSkin(hm)
      paintSkin(am)
      let n = 0
      for (const f of fans) {
        if (f.fill > filled) continue
        const wave = Math.max(0, Math.cos(f.a - ola)) ** 12
        const jump = Math.max(0, Math.sin(t * (4 + hot * 6) + f.phase)) * 0.35 * hot + wave * 0.9
        // Arms up in the ola, on a goal, and for the keenest all the time.
        const raised = wave > 0.3 || (hot > 0.5 && f.phase > 2) || f.fill < 0.05 ? 1 : 0
        q.setFromAxisAngle(up, -f.a + Math.PI / 2)
        m.compose(v.set(f.x, f.y + jump, f.z), q, one)
        cm.setMatrixAt(n, m)
        m.compose(v.set(f.x, f.y + jump + 0.72, f.z), q, one)
        hm.setMatrixAt(n, m)
        m.compose(v.set(f.x, f.y + jump + 0.75 + raised * 0.25, f.z), q, sc.set(1, raised ? 1 : 0.001, 1))
        am.setMatrixAt(n, m)
        n++
      }
      cm.count = hm.count = am.count = n
      cm.instanceMatrix.needsUpdate = hm.instanceMatrix.needsUpdate = am.instanceMatrix.needsUpdate = true
    }
    // The flags waving over the stands, in each club's colours.
    const fl = flags.current
    if (fl && match) {
      paintFlags(fl)
      for (let i = 0; i < FLAGS; i++) {
        const f = fans[i * 37]
        const show = f.fill <= filled ? 1 : 0.001
        q.setFromAxisAngle(up, -f.a + Math.PI / 2 + Math.sin(t * 3 + f.phase) * 0.6)
        m.compose(v.set(f.x, f.y + 2.2, f.z), q, sc.set(show, show, show))
        fl.setMatrixAt(i, m)
      }
      fl.instanceMatrix.needsUpdate = true
    }
    // The concert crowd on the pitch, packed towards the stage.
    const pm = pit.current
    if (pm) {
      paint(pm)
      for (let i = 0; i < PIT; i++) {
        const f = fans[i]
        const x = -34 + f.fill * f.fill * 70
        const z = (fans[i + 1].fill - 0.5) * 56
        const jump = now >= e.start ? Math.max(0, Math.sin(t * 7 + f.phase)) * 0.4 : 0
        m.compose(v.set(x, 0.7 + jump, z), q.setFromAxisAngle(up, Math.PI / 2), one)
        pm.setMatrixAt(i, m)
      }
      pm.instanceMatrix.needsUpdate = true
    }
    // The concert lights sweeping.
    if (beams.current) beams.current.children.forEach((b, i) => (b.rotation.z = Math.sin(t * 1.2 + i * 1.7) * 0.6))
  })

  const screen = useMemo(() => (match ? null : lettering((e.artist ?? '').toUpperCase(), '#141416', '#ffd43b', '#ff7a00')), [match, e.artist])
  return (
    <group ref={g}>
      <instancedMesh ref={crowd} args={[undefined, undefined, FANS]} frustumCulled={false}>
        <boxGeometry args={[0.55, 1.0, 0.4]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, FANS]} frustumCulled={false}>
        <boxGeometry args={[0.36, 0.36, 0.36]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, FANS]} frustumCulled={false}>
        <boxGeometry args={[0.72, 0.5, 0.14]} />
        <meshLambertMaterial />
      </instancedMesh>
      {match && (
        <instancedMesh ref={flags} args={[undefined, undefined, FLAGS]} frustumCulled={false}>
          <boxGeometry args={[1.6, 1.0, 0.04]} />
          <meshLambertMaterial side={THREE.DoubleSide} />
        </instancedMesh>
      )}
      {match && <Banners home={e.home ?? ''} away={e.away ?? ''} />}
      {match && <Scoreboard e={e} />}
      {match ? (
        <>
          <Teams e={e} />
          {/* The goals */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 52.5, 0.7, 0]}>
              {[-3.66, 3.66].map((z) => (
                <mesh key={z} position={[0, 1.22, z]}>
                  <boxGeometry args={[0.15, 2.44, 0.15]} />
                  <meshLambertMaterial color="#ffffff" />
                </mesh>
              ))}
              <mesh position={[0, 2.44, 0]}>
                <boxGeometry args={[0.15, 0.15, 7.5]} />
                <meshLambertMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </>
      ) : (
        <>
          <instancedMesh ref={pit} args={[undefined, undefined, PIT]} frustumCulled={false}>
            <boxGeometry args={[0.5, 1.7, 0.4]} />
            <meshLambertMaterial />
          </instancedMesh>
          {/* The stage at the end of the pitch: the deck, the truss, the screen, the speakers, the lights */}
          <group position={[-46, 0.7, 0]}>
            <mesh position={[0, 1, 0]}>
              <boxGeometry args={[12, 2, 26]} />
              <meshLambertMaterial color="#202226" />
            </mesh>
            {[-12, 12].map((z) => (
              <mesh key={z} position={[-2, 7, z]}>
                <boxGeometry args={[0.6, 14, 0.6]} />
                <meshLambertMaterial color="#9aa0a8" />
              </mesh>
            ))}
            <mesh position={[-2, 14, 0]}>
              <boxGeometry args={[0.6, 0.6, 25]} />
              <meshLambertMaterial color="#9aa0a8" />
            </mesh>
            {screen && (
              <mesh position={[-3, 8.5, 0]} rotation={[0, Math.PI / 2, 0]} scale={[20, 20 / screen.aspect, 1]}>
                <planeGeometry />
                <meshBasicMaterial map={screen.t} toneMapped={false} />
              </mesh>
            )}
            {[-10, 10].map((z) => (
              <mesh key={z} position={[1, 4, z]}>
                <boxGeometry args={[2, 4.5, 2]} />
                <meshLambertMaterial color="#141416" />
              </mesh>
            ))}
            <group ref={beams} position={[-2, 13.5, 0]}>
              {['#ff3d7f', '#3dd5ff', '#ffd43b', '#7c3dff', '#3dff8a'].map((c, i) => (
                <mesh key={c} position={[0, 0, -10 + i * 5]} rotation={[0, 0, 0]}>
                  <coneGeometry args={[2.2, 16, 10, 1, true]} />
                  <meshBasicMaterial color={c} transparent opacity={night ? 0.22 : 0.08} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              ))}
            </group>
          </group>
        </>
      )}
      {/* The floodlights under the roof, at night */}
      {night && (
        <>
          <mesh position={[0, 27, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[SX, 1, 1]}>
            <ringGeometry args={[63, 66, 64]} />
            <meshBasicMaterial color="#fffbe6" side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 40, 0]} intensity={2.2} distance={180} decay={0} color="#fff6dc" />
        </>
      )}
      {near && shout && (
        <Html position={[0, 34, 0]} center zIndexRange={[25, 0]}>
          <div className={`animate-pop rounded-2xl px-4 py-2 font-display text-[16px] font-extrabold whitespace-nowrap shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] ${shout.startsWith('BUUUT') ? 'bg-[#ffd43b] text-[#141416]' : 'bg-white text-[var(--color-ink)]'}`}>{shout}</div>
        </Html>
      )}
    </group>
  )
}

// ——— The match ———
//
// Everything follows from the shared clock, so the same pass is played on
// every screen. The play moves round a point that wanders the pitch; each
// player keeps his place in the 4-4-2 and is pulled towards it. Every 2.2 s
// the ball goes to another player near the play: a pass along the ground,
// then he runs with it. Before each goal (the minutes come from the server)
// the play pushes up to the goal and the shot goes in; then the scorers run
// to the corner flag, arms up, and the others walk back for the kick-off.

const PASS = 2.2 // seconds between passes
const BUILD = 0.35 // minutes of build-up before a goal
const SHOT = 0.06 // the shot itself (≈ 4 s)
const PARTY = 1.2 // minutes of celebrating after it
const N = 23 // two teams of eleven and the referee

// team -1 is home, 1 away; each keeps its goal at x = -team·half·52.5 and attacks the other one.
type Goal = { at: number; team: -1 | 1 }
type Pose = { x: number; z: number; party: boolean }

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Where everyone is at clock time t (seconds), k minutes into the match. */
function layout(t: number, k: number, goals: Goal[], out: Pose[]) {
  const half = k >= 60 ? -1 : 1
  const playing = k >= 0 && k < 120 && !(k >= 45 && k < 60)
  // The play's centre, wandering.
  let fx = Math.sin(t * 0.21) * 34 + Math.sin(t * 0.53) * 9
  let fz = Math.sin(t * 0.17 + 1) * 20 + Math.cos(t * 0.41) * 6
  // Before a goal the scorers push up; after it they celebrate.
  const next = goals.find((g) => g.at >= k && g.at - k < BUILD)
  const last = [...goals].reverse().find((g) => k >= g.at && k - g.at < PARTY)
  if (next) {
    const goalX = next.team * half * 52.5
    const u = Math.min(1, 1 - (next.at - k) / BUILD)
    fx += (goalX * 0.62 - fx) * u
    fz *= 1 - u * 0.7
  }
  for (let i = 0; i < N; i++) {
    const p = (out[i] ??= { x: 0, z: 0, party: false })
    p.party = false
    if (i === 22) {
      // The referee follows the play from a little way off.
      p.x = playing ? fx - 8 : 0
      p.z = playing ? fz + 10 : -31
      continue
    }
    const side = i < 11 ? -1 : 1
    const j = i % 11
    if (!playing) {
      // Before, at half-time and after: the two lines facing the main stand.
      p.x = side * (3 + j * 2.2)
      p.z = k >= 45 && k < 60 ? -38 : -31
      continue
    }
    const [ox, oz] = j === 0 ? [-48, 0] : j < 5 ? [-30, -24 + (j - 1) * 16] : j < 9 ? [-8, -24 + (j - 5) * 16] : [12, j === 9 ? -8 : 8]
    const hx = ox * side * half
    if (j === 0) {
      // The keeper on his line, following the ball across.
      p.x = hx + (fx - hx) * 0.04
      p.z = Math.max(-5, Math.min(5, fz * 0.25))
    } else {
      p.x = hx + (fx - hx) * 0.35 + Math.sin(t * 1.3 + i) * 1.5
      p.z = oz + (fz - oz) * 0.35 + Math.cos(t * 1.1 + i) * 1.5
    }
    if (last) {
      const goalX = last.team * half * 52.5
      const u = Math.min(1, (k - last.at) / 0.25)
      if (side === last.team && j > 0) {
        // The scorers race to the corner flag and pile in.
        const cx = goalX * 0.96 + Math.sin(i * 2.1) * 2.5
        const cz = 31 + Math.cos(i * 1.7) * 2.5
        p.x += (cx - p.x) * u
        p.z += (cz - p.z) * u
        p.party = true
      } else if (j > 0) {
        // The others drift back to their half, heads down.
        p.x += (hx * 0.6 - p.x) * u * 0.6
      }
    }
  }
  return { fx, fz, playing, next, last, half }
}

/** Who has the ball in pass number s: one of the three players nearest the play (not the keepers). */
function holder(s: number, poses: Pose[], fx: number, fz: number) {
  const near = poses
    .slice(0, 22)
    .map((p, i) => ({ i, d: Math.hypot(p.x - fx, p.z - fz) }))
    .filter((p) => p.i % 11 !== 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
  return near[Math.floor(hash(s) * near.length)].i
}

function Teams({ e }: { e: StadiumEvent }) {
  const goals = useMemo<Goal[]>(
    () =>
      [...(e.homeGoals ?? []).map((at) => ({ at, team: -1 as const })), ...(e.awayGoals ?? []).map((at) => ({ at, team: 1 as const }))].sort((a, b) => a.at - b.at),
    [e],
  )
  const parts = useRef<(THREE.InstancedMesh | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  const now = useMemo(() => [] as Pose[], [])
  const before = useMemo(() => [] as Pose[], [])
  const scratch = useMemo(() => [] as Pose[], [])
  const facing = useMemo(() => new Float32Array(N), [])
  const tmp = useMemo(
    () => ({ base: new THREE.Matrix4(), local: new THREE.Matrix4(), out: new THREE.Matrix4(), q: new THREE.Quaternion(), r: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), x: new THREE.Vector3(1, 0, 0), one: new THREE.Vector3(1, 1, 1) }),
    [],
  )

  // The kit: shirts in the club's first colour (the keeper and the referee apart), shorts and socks in the second.
  const kit = useMemo(() => {
    const [h1, h2] = colorsOf(e.home)
    const [a1, a2] = colorsOf(e.away)
    const shirt: string[] = []
    const shorts: string[] = []
    for (let i = 0; i < N; i++) {
      if (i === 22) {
        shirt.push('#ffd43b')
        shorts.push('#141416')
        continue
      }
      const home = i < 11
      shirt.push(i % 11 === 0 ? (home ? '#7c3dff' : '#0ca678') : home ? h1 : a1)
      shorts.push(home ? h2 : a2)
    }
    const skin = [...Array(N)].map((_, i) => SKIN[Math.floor(hash(i + e.start) * SKIN.length)])
    return { shirt, shorts, skin }
  }, [e])

  // The figure's parts: [colours, size, pivot, offset from the pivot, which swings].
  const PARTS = useMemo(
    () =>
      [
        { c: kit.shirt, s: [0.6, 0.72, 0.34], p: [0, 1.5, 0], o: [0, 0, 0], swing: 0 },
        { c: kit.shorts, s: [0.58, 0.34, 0.34], p: [0, 1.0, 0], o: [0, 0, 0], swing: 0 },
        { c: kit.shorts, s: [0.22, 0.95, 0.24], p: [-0.15, 1.05, 0], o: [0, -0.5, 0], swing: 1 },
        { c: kit.shorts, s: [0.22, 0.95, 0.24], p: [0.15, 1.05, 0], o: [0, -0.5, 0], swing: -1 },
        { c: kit.skin, s: [0.16, 0.7, 0.16], p: [-0.39, 1.82, 0], o: [0, -0.34, 0], swing: -2 },
        { c: kit.skin, s: [0.16, 0.7, 0.16], p: [0.39, 1.82, 0], o: [0, -0.34, 0], swing: 2 },
        { c: kit.skin, s: [0.38, 0.4, 0.38], p: [0, 2.08, 0], o: [0, 0, 0], swing: 0 },
        { c: kit.skin.map(() => '#141416'), s: [0.4, 0.12, 0.4], p: [0, 2.32, 0], o: [0, 0, 0], swing: 0 },
        { c: kit.skin.map(() => '#141416'), s: [0.24, 0.1, 0.34], p: [-0.15, 0.05, 0.05], o: [0, 0, 0], swing: 0 },
        { c: kit.skin.map(() => '#141416'), s: [0.24, 0.1, 0.34], p: [0.15, 0.05, 0.05], o: [0, 0, 0], swing: 0 },
      ] as const,
    [kit],
  )

  useFrame(() => {
    const t = worldTime()
    const k = t / 60 - e.start
    const { playing, next, last, half } = layout(t, k, goals, now)
    layout(t - 0.15, k - 0.0025, goals, before)
    // Who gets pass s is settled when it's played, from where everyone was then.
    const holderAt = (s: number) => {
      const at = layout(s * PASS, (s * PASS) / 60 - e.start, goals, scratch)
      return holder(s, scratch, at.fx, at.fz)
    }

    // The ball: passed from player to player; before a goal, shot into the net; after it, in the net.
    let bx = 0
    let by = 0.25
    let bz = 0
    let owner = -1
    if (!playing) {
      bx = 0
      bz = 0
    } else if (last && k - last.at < PARTY) {
      bx = last.team * half * 54
      bz = 1.5
    } else if (next && next.at - k < SHOT) {
      // The striker nearest the goal shoots: the ball flies in.
      const goalX = next.team * half * 52.5
      const from = holderAt(Math.floor(t / PASS))
      const u = Math.min(1, 1 - (next.at - k) / SHOT)
      const a = now[from]
      bx = a.x + (goalX + Math.sign(goalX) * 1.2 - a.x) * u
      bz = a.z + (1.2 - a.z) * u
      by = 0.25 + Math.sin(u * Math.PI) * 2.2
      owner = u < 0.15 ? from : -1
    } else {
      const s = Math.floor(t / PASS)
      const u = (t - s * PASS) / 0.7
      owner = holderAt(s)
      const o = now[owner]
      // Where the ball sits at his feet, a step ahead of him.
      const ahead = (p: Pose, f: number) => [p.x + Math.sin(f) * 0.7, p.z + Math.cos(f) * 0.7]
      const [tx, tz] = ahead(o, facing[owner])
      if (u < 1) {
        const from = holderAt(s - 1)
        const [sx, sz] = ahead(now[from], facing[from])
        bx = sx + (tx - sx) * u
        bz = sz + (tz - sz) * u
        by = 0.25 + Math.sin(u * Math.PI) * (hash(s) > 0.7 ? 3 : 0.4)
      } else {
        bx = tx
        bz = tz
      }
    }
    ball.current?.position.set(bx, by + 0.7, bz)

    const { base, local, out, q, r, v, s: sc, up, x: ax, one } = tmp
    for (let i = 0; i < N; i++) {
      const p = now[i]
      const b = before[i]
      const speed = Math.hypot(p.x - b.x, p.z - b.z) / 0.15
      // Face where they're going when running, the ball otherwise.
      const want = speed > 0.8 ? Math.atan2(p.x - b.x, p.z - b.z) : !playing ? 0 : Math.atan2(bx - p.x, bz - p.z)
      let d = want - facing[i]
      d = Math.atan2(Math.sin(d), Math.cos(d))
      facing[i] += d * 0.15
      const stride = Math.min(1, speed / 6)
      const phase = t * (6 + speed * 1.2) + i
      const leg = Math.sin(phase) * 0.9 * stride
      const hop = p.party ? Math.max(0, Math.sin(t * 9 + i)) * 0.6 : Math.abs(Math.sin(phase)) * 0.08 * stride
      base.compose(v.set(p.x, 0.7 + hop, p.z), q.setFromAxisAngle(up, facing[i]), one)
      PARTS.forEach((part, n) => {
        const mesh = parts.current[n]
        if (!mesh) return
        let angle = 0
        if (part.swing === 1 || part.swing === -1) angle = leg * part.swing
        if (part.swing === 2 || part.swing === -2) angle = p.party ? Math.PI * 0.95 : -leg * Math.sign(part.swing)
        // The pivot, the swing, then the part hanging from it.
        local.compose(v.set(part.p[0], part.p[1], part.p[2]), r.setFromAxisAngle(ax, angle), one)
        out.multiplyMatrices(base, local)
        local.compose(v.set(part.o[0], part.o[1], part.o[2]), r.identity(), sc.set(part.s[0], part.s[1], part.s[2]))
        out.multiply(local)
        mesh.setMatrixAt(i, out)
      })
    }
    for (const mesh of parts.current) if (mesh) mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      {PARTS.map((part, n) => (
        <instancedMesh
          key={n}
          ref={(m) => {
            parts.current[n] = m
            if (m && !m.userData.painted) {
              const c = new THREE.Color()
              for (let i = 0; i < N; i++) m.setColorAt(i, c.set(part.c[i]))
              if (m.instanceColor) m.instanceColor.needsUpdate = true
              ;(m.material as THREE.Material).needsUpdate = true
              m.userData.painted = true
            }
          }}
          args={[undefined, undefined, N]}
          frustumCulled={false}
        >
          <boxGeometry />
          <meshLambertMaterial />
        </instancedMesh>
      ))}
      <mesh ref={ball}>
        <sphereGeometry args={[0.35, 10, 8]} />
        <meshLambertMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      {/* The nets behind the goal mouths */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 53.6, 1.92, 0]}>
          <boxGeometry args={[2.0, 2.44, 7.32]} />
          <meshLambertMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      ))}
      {/* The corner flags */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <group key={`${sx}${sz}`} position={[sx * 52.5, 0.7, sz * 34]}>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[0.06, 1.6, 0.06]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 1.4, 0.25]}>
            <boxGeometry args={[0.02, 0.4, 0.5]} />
            <meshLambertMaterial color="#f08a24" />
          </mesh>
        </group>
      )))}
    </>
  )
}

/** The supporters' banners along the front of the stands, each club on its side. */
function Banners({ home, away }: { home: string; away: string }) {
  const mats = useMemo(() => {
    const make = (club: string, words: string) => {
      const [a, b] = colorsOf(club)
      const l = lettering(words.toUpperCase(), a, b, b)
      return { m: new THREE.MeshBasicMaterial({ map: l.t, toneMapped: false, side: THREE.DoubleSide }), aspect: l.aspect }
    }
    return [make(home, home), make(home, 'On est ensemble !'), make(away, away), make(away, 'Jusqu’au bout !')]
  }, [home, away])
  // Home fans on the +x side, away on -x (the shirts in the stands, above).
  const spots: [number, number][] = [[0.22, 0], [-0.22, 1], [Math.PI - 0.22, 2], [Math.PI + 0.22, 3]]
  return (
    <>
      {spots.map(([a, n]) => {
        // Hung over the wall at the front of the stand, facing the pitch.
        const r = 51.8
        const h = 2.2
        return (
          <mesh key={n} position={[Math.cos(a) * r * SX, 1.9, Math.sin(a) * r]} rotation={[0, -a - Math.PI / 2, 0]} scale={[h * mats[n].aspect, h, 1]} material={mats[n].m}>
            <planeGeometry />
          </mesh>
        )
      })}
    </>
  )
}

/** The giant screen over the end stand: the score and the minute. */
function Scoreboard({ e }: { e: StadiumEvent }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 160
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return { c, t }
  }, [])
  const shown = useRef('')
  useFrame(() => {
    const k = minuteNow() - e.start
    const hs = (e.homeGoals ?? []).filter((x) => x <= k).length
    const as = (e.awayGoals ?? []).filter((x) => x <= k).length
    const clock = k < 0 ? 'Bientôt' : k >= 120 ? 'Terminé' : k >= 45 && k < 60 ? 'Mi-temps' : `${Math.floor(k < 45 ? k : k - 15) + 1}'`
    const text = `${hs}-${as}|${clock}`
    if (text === shown.current) return
    shown.current = text
    const g = tex.c.getContext('2d')!
    g.fillStyle = '#0b0d14'
    g.fillRect(0, 0, 512, 160)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const [h] = colorsOf(e.home)
    const [a] = colorsOf(e.away)
    g.fillStyle = h
    g.fillRect(14, 108, 10, 40)
    g.fillStyle = a
    g.fillRect(488, 108, 10, 40)
    // The score big in the middle; under it the two clubs either side of the minute.
    g.font = 'bold 72px sans-serif'
    g.fillStyle = '#ffd43b'
    g.fillText(`${hs} – ${as}`, 256, 56)
    g.font = 'bold 24px sans-serif'
    g.fillStyle = '#ffffff'
    g.textAlign = 'left'
    g.fillText((e.home ?? '').slice(0, 14), 34, 128)
    g.textAlign = 'right'
    g.fillText((e.away ?? '').slice(0, 14), 478, 128)
    g.textAlign = 'center'
    g.fillStyle = '#ff9a3c'
    g.font = 'bold 28px sans-serif'
    g.fillText(clock, 256, 128)
    tex.t.needsUpdate = true
  })
  return (
    // Hung under the roof over the top of the end stand, facing the pitch.
    <group position={[-84, 21.5, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.4]}>
        <boxGeometry args={[33, 11.5, 0.6]} />
        <meshLambertMaterial color="#202226" />
      </mesh>
      <mesh scale={[32, 10, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={tex.t} toneMapped={false} />
      </mesh>
    </group>
  )
}
