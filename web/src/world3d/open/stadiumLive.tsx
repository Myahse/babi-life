import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { DOORS_OPEN, eventAt, useStadium, type StadiumEvent } from '../../lib/stadium'
import { whereabouts } from '../whereabouts'
import { lettering } from './ruePrincesse'
import { AR1, AR2, CAPTAIN, COACH, FOURTH, KID, BEARER, MEDIC, NF, NUMBERS, REF, SUB, SUB_NUMBERS, announce, clockText, ease, hash, hypeAt, matchFrame, playerName, scorerName, type Target } from './stadiumMatch'

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
      // The goals, with the scorer's name; otherwise what the announcer says (the walk-out, the cards, the breaks…).
      const k = now - e.start
      const hs = (e.homeGoals ?? []).filter((x) => x <= k).length
      const as = (e.awayGoals ?? []).filter((x) => x <= k).length
      const goal = [...(e.homeGoals ?? []), ...(e.awayGoals ?? [])].find((x) => k - x >= 0 && k - x < 1.5)
      const say = goal !== undefined ? `BUUUT ! ${scorerName(e, goal) ?? ''} ! ${e.home} ${hs} – ${as} ${e.away}` : announce(e, k)
      if (say !== shout) setShout(say)
      if (lastGoals.current !== hs + as) lastGoals.current = hs + as
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
    // After a goal only the scorers' fans erupt; the others go quiet.
    const k = now - e.start
    const homeUp = match && (e.homeGoals ?? []).some((x) => k - x >= 0 && k - x < 1.5)
    const awayUp = match && (e.awayGoals ?? []).some((x) => k - x >= 0 && k - x < 1.5)
    const hype = match ? hypeAt(now - e.start) : -1
    const base = hype >= 0 ? hype : match ? 0.25 : now >= e.start ? 0.8 : 0.2
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
        // Home fans fill the +x side (their shirts, above).
        const mine = Math.cos(f.a) > 0 ? homeUp : awayUp
        const hot = mine ? 1 : homeUp || awayUp ? 0.05 : base
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
      {match && <Flares e={e} />}
      {night && <Flashes fans={fans} />}
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

// ——— The match: the people on the pitch ———
//
// stadiumMatch.ts says where everyone wants to be and what they're doing;
// here they walk or run there at their own pace (never faster than a
// sprint, so no one jumps), turn, and move their limbs: hips and knees,
// shoulders and elbows, the body leaning and rolling.

/** The figure's pose this frame, in radians: forward swings, out to the side, bends; the body's lean, roll and height. */
type Act = {
  hipL: number; kneeL: number; hipR: number; kneeR: number
  shL: number; outL: number; elL: number; shR: number; outR: number; elR: number
  lean: number; roll: number; lift: number
}
const still = (a: Act) => {
  a.hipL = a.kneeL = a.hipR = a.kneeR = a.shL = a.outL = a.elL = a.shR = a.outR = a.elR = a.lean = a.roll = a.lift = 0
  return a
}

/** From what someone is doing (and how fast they're going) to their limbs. */
function pose(a: Act, g: Target, t: number, speed: number, stride: number, i: number) {
  still(a)
  // Running or walking: the legs swing with the knees bending on the way back, the arms bent and swinging opposite.
  const str = Math.min(1, speed / 7)
  const swing = Math.sin(stride)
  a.hipL = swing * (0.35 + 0.45 * str)
  a.hipR = -a.hipL
  a.kneeL = (0.15 + Math.max(0, Math.sin(stride + 1.6)) * (0.5 + 0.7 * str)) * Math.min(1, speed / 1.2)
  a.kneeR = (0.15 + Math.max(0, Math.sin(stride + 1.6 + Math.PI)) * (0.5 + 0.7 * str)) * Math.min(1, speed / 1.2)
  a.shL = -swing * (0.25 + 0.4 * str)
  a.shR = swing * (0.25 + 0.4 * str)
  a.elL = a.elR = 0.25 + 0.9 * str
  a.outL = a.outR = 0.08
  a.lean = 0.16 * str
  a.lift = Math.abs(Math.sin(stride)) * 0.07 * str + (speed < 0.3 ? Math.sin(t * 2 + i) * 0.008 : 0)
  const p = g.p
  const beat = Math.sin(t * 7 + i)
  const both = (sh: number, out: number, el: number) => {
    a.shL = a.shR = sh
    a.outL = a.outR = out
    a.elL = a.elR = el
  }
  switch (g.pose) {
    case 'kick': {
      // The kicking leg back, knee bent, then through the ball and up; the other arm out for balance.
      const u = Math.max(0, Math.min(1, p))
      a.hipR = u < 0.4 ? -0.9 * (u / 0.4) : -0.9 + 2.3 * ((u - 0.4) / 0.6)
      a.kneeR = u < 0.4 ? 1.4 * (u / 0.4) : 1.4 * (1 - (u - 0.4) / 0.6) + 0.1
      a.hipL = 0.1
      a.kneeL = 0.25
      a.shL = 0.4
      a.outL = 0.9
      a.lean = -0.12
      break
    }
    case 'header': {
      const u = Math.max(0, Math.min(1, p))
      a.lift = Math.sin(u * Math.PI) * 0.75
      a.kneeL = a.kneeR = 0.9 * Math.sin(u * Math.PI)
      both(0.5, 0.8, 0.6)
      a.lean = -0.35 + u * 0.7
      break
    }
    case 'throwin':
      // The ball held behind the head, then thrown: elbows straighten, the body comes through.
      if (p < 0) both(Math.PI * 0.92, 0.15, 1.7)
      else both(Math.PI * 0.92 - p * 1.2, 0.15, 1.7 * (1 - p))
      a.lean = p < 0 ? -0.25 : -0.25 + p * 0.5
      a.hipL = 0.25
      a.hipR = -0.2
      break
    case 'gkReady':
      a.hipL = a.hipR = 0.45
      a.kneeL = a.kneeR = 0.8
      a.lift = -0.16
      both(0.7, 0.55, 0.5)
      a.lean = 0.25
      break
    case 'gkDive': {
      const dir = p >= 0 ? 1 : -1
      const u = Math.abs(p)
      a.roll = dir * 1.45 * ease(u * 1.3)
      a.lift = Math.sin(Math.min(1, u * 1.3) * Math.PI) * 0.9 - 0.8 * ease(u * 1.3)
      both(Math.PI * 0.9, 0.1, 0.1)
      a.hipL = 0.3
      a.kneeR = 0.4
      break
    }
    case 'gkHold':
      both(1.3, -0.25, 1.3)
      a.lean = -0.05
      break
    case 'gkThrow':
      a.shR = Math.PI * 0.95 - Math.max(0, p) * 2.0
      a.elR = 0.3
      a.shL = 0.9
      a.outL = 0.4
      a.lean = -0.2 + p * 0.45
      a.hipL = 0.4
      break
    case 'party':
      if (p % 4 === 0) {
        both(Math.PI * 0.95, 0.15, 0)
        a.lift = Math.max(0, Math.sin(t * 9 + i)) * 0.6
      } else if (p % 4 === 1) {
        // Coupé-décalé: shoulders rolling, one arm up then the other, knees going.
        a.roll = beat * 0.25
        a.shL = beat > 0 ? Math.PI * 0.85 : 0.6
        a.shR = beat > 0 ? 0.6 : Math.PI * 0.85
        a.elL = a.elR = 0.6
        a.hipL = Math.max(0, beat) * 0.7
        a.kneeL = Math.max(0, beat) * 1.1
        a.hipR = Math.max(0, -beat) * 0.7
        a.kneeR = Math.max(0, -beat) * 1.1
      } else if (p % 4 === 2) {
        // The aeroplane, banking.
        both(0, Math.PI / 2, 0)
        a.roll = Math.sin(t * 2 + i) * 0.35
      } else {
        // Both fingers to the sky.
        both(Math.PI * 0.97, 0.05, 0.05)
        a.lean = -0.15
      }
      break
    case 'slide':
      // On his knees across the grass, arms wide, head back.
      a.lift = -0.5
      a.hipL = a.hipR = 0.1
      a.kneeL = a.kneeR = 1.55
      both(0.2, 2.2, 0.1)
      a.lean = -0.4
      break
    case 'knees':
      a.lift = -0.5
      a.kneeL = a.kneeR = 1.55
      both(Math.PI * 0.75, -0.55, 1.6)
      a.lean = 0.15
      break
    case 'down': {
      // On the grass, rolling, holding his leg.
      const dir = p >= 0 ? 1 : -1
      a.roll = dir * (1.45 + Math.sin(t * 6) * 0.15)
      a.lift = -0.82
      a.hipL = 1.0
      a.kneeL = 1.6
      both(1.1, -0.2, 1.0)
      break
    }
    case 'protest':
      both(0.5, 0.95 + Math.sin(t * 5) * 0.15, 0.4)
      a.lean = -0.1
      break
    case 'heart':
      a.shR = 0.9
      a.outR = -0.35
      a.elR = 1.9
      a.shL = 0
      break
    case 'wave':
      a.shR = Math.PI * 0.85
      a.outR = 0.25 + Math.sin(t * 8 + i) * 0.35
      a.elR = 0.3
      break
    case 'shake':
      a.shR = 1.2
      a.elR = 0.35 + Math.sin(t * 9 + i) * 0.1
      a.outR = -0.1
      break
    case 'photoBack':
      both(0.55, -0.45, 2.1)
      break
    case 'photoFront':
      a.lift = -0.62
      a.hipL = a.hipR = 1.5
      a.kneeL = a.kneeR = 2.4
      both(1.0, 0.1, 0.4)
      a.lean = 0.25
      break
    case 'huddle':
      both(1.6, 1.25, 0.3)
      a.lean = 0.45
      a.lift = Math.max(0, Math.sin(t * 6)) * 0.12
      break
    case 'toss':
      a.shR = 1.4 + Math.max(0, Math.sin(t * 8)) * 0.6
      a.elR = 0.6
      break
    case 'drink':
      a.shR = 2.5
      a.elR = 2.2
      a.outR = -0.2
      a.lean = -0.18
      break
    case 'clap':
      both(1.25, -0.3 + Math.max(0, Math.sin(t * 12 + i)) * 0.3, 0.5)
      break
    case 'sit':
      a.lift = -0.62
      a.hipL = a.hipR = 1.5
      a.kneeL = a.kneeR = 0.4
      both(-0.5, 0.2, 0)
      a.lean = -0.3
      break
    case 'point':
      a.shR = Math.PI / 2
      a.elR = 0
      break
    case 'card':
      a.shR = Math.PI * 0.95
      a.elR = 0.05
      a.outR = 0.1
      break
    case 'whistle':
      a.shR = 2.3
      a.elR = 2.3
      a.outR = -0.3
      a.shL = Math.PI * 0.6
      break
    case 'flag':
      a.shR = Math.PI * 0.95
      a.elR = 0
      break
    case 'board':
      both(Math.PI * 0.9, 0.12, 0.2)
      break
    case 'shout':
      a.shR = Math.PI / 2 + Math.sin(t * 2.3) * 0.5
      a.outR = 0.3
      a.shL = 0.6
      a.elL = 1.2
      break
    case 'despair':
      both(Math.PI * 0.78, -0.5, 1.7)
      a.lean = 0.1
      break
    case 'jump':
      both(Math.PI * 0.95, 0.2, 0)
      a.lift = Math.max(0, Math.sin(t * 8 + i)) * 0.5
      break
    case 'carry':
      both(2.6, 0.25, 0.35)
      break
    case 'camera':
      both(2.1, -0.35, 2.4)
      break
    case 'kid':
      // Holding the player's hand, up beside him.
      a.shR = 0.5
      a.outR = 0.55
      a.elR = 0.1
      break
    case 'tactics':
      both(1.15, -0.2, 0.9)
      a.lean = 0.05
      break
    case 'hips':
      both(-0.2, 0.55, 1.2)
      break
    case 'stretch':
      if (p % 3 === 0) {
        // Holding a foot behind: the quad.
        a.hipR = -0.25
        a.kneeR = 2.5
        a.shR = -0.4
        a.elR = 0.4
      } else if (p % 3 === 1) {
        // Arms up, leaning to the side.
        both(Math.PI * 0.95, 0.1, 0.1)
        a.roll = Math.sin(t * 0.8 + i) * 0.35
      } else {
        // A lunge.
        a.hipL = 0.9
        a.kneeL = 0.9
        a.hipR = -0.6
        a.lift = -0.3
        both(-0.1, 0.4, 0.1)
      }
      break
    case 'kneesUp':
      a.hipL = Math.max(0, Math.sin(t * 9 + i)) * 1.4
      a.kneeL = a.hipL * 1.3
      a.hipR = Math.max(0, -Math.sin(t * 9 + i)) * 1.4
      a.kneeR = a.hipR * 1.3
      a.shL = a.hipR * 0.6
      a.shR = a.hipL * 0.6
      a.elL = a.elR = 1.2
      a.lift = 0.08
      break
    case 'bench':
      a.lift = -0.48
      a.hipL = a.hipR = 1.55
      a.kneeL = a.kneeR = 1.5
      both(0.7, 0.15, 0.8)
      a.hipL += Math.max(0, Math.sin(t * 6 + i)) * 0.06
      break
    case 'wall':
      both(0.35, -0.45, 0.25)
      break
    case 'treat':
      a.lift = -0.5
      a.kneeL = a.kneeR = 1.55
      both(1.3, -0.1, 0.4)
      a.lean = 0.45
      break
  }
}

const SKIN_TONES = ['#3b2414', '#4a2c1a', '#5c3820', '#6e4428', '#7f5233', '#8f6240']
const BOOTS = ['#141416', '#ff7a00', '#f4f1ea', '#ffd43b', '#3dd5ff', '#e8432f', '#7c3dff']

/** One part of the body: what it hangs from (a joint chain), its size and offset, and its colour per person. */
type Part = { chain: ('hipL' | 'kneeL' | 'hipR' | 'kneeR' | 'shL' | 'elL' | 'shR' | 'elR')[]; at: [number, number, number]; size: [number, number, number]; color: (i: number) => string; show?: (i: number) => [number, number, number] | null }

function Teams({ e }: { e: StadiumEvent }) {
  const frame = useMemo(() => matchFrame(e, minuteNow() - e.start), [e])
  // Who wears what: the kits, the officials in yellow, the coaches in suits, the medics in orange, the kids and the flag bearers.
  const looks = useMemo(() => {
    const [h1, h2] = colorsOf(e.home)
    const [a1, a2] = colorsOf(e.away)
    return [...Array(NF)].map((_, i) => {
      const r = (n: number) => hash(i * 13.7 + e.start * 0.01 + n)
      const skin = SKIN_TONES[Math.floor(r(1) * SKIN_TONES.length)]
      const hair = Math.floor(r(2) * 5)
      const blond = r(3) > 0.82
      const player = i < 22 || i === SUB[0] || i === SUB[1]
      const team = i < 11 || i === SUB[0] ? -1 : i < 22 || i === SUB[1] ? 1 : 0
      let shirt = '#ffffff'
      let shorts = '#141416'
      let socks = '#141416'
      let legs = skin // thighs
      let sleeves = shirt
      let arms = skin
      let hands = skin
      let boots = BOOTS[Math.floor(r(4) * BOOTS.length)]
      if (player) {
        const keeper = i % 11 === 0 && i < 22
        shirt = keeper ? (team === -1 ? '#7c3dff' : '#0ca678') : team === -1 ? h1 : a1
        shorts = team === -1 ? h2 : a2
        socks = shirt
        sleeves = shirt
        if (keeper) hands = '#e9f5c8'
        if (keeper) arms = shirt
      } else if (i === REF || i === AR1 || i === AR2 || i === FOURTH) {
        shirt = sleeves = '#ffd43b'
        shorts = socks = '#141416'
        boots = '#141416'
      } else if (i === COACH[0] || i === COACH[1]) {
        shirt = sleeves = arms = i === COACH[0] ? '#2b2d42' : '#3b3f4a'
        shorts = socks = legs = '#22242e'
        boots = '#141416'
      } else if (i === MEDIC[0] || i === MEDIC[1]) {
        shirt = sleeves = '#ff6b00'
        shorts = socks = legs = '#f4f1ea'
      } else if (i >= KID && i < KID + 22) {
        shirt = sleeves = '#ffffff'
        shorts = (i - KID) < 11 ? h1 : a1
        socks = '#ffffff'
      } else if (i >= BEARER) {
        shirt = sleeves = arms = '#f4f1ea'
        shorts = socks = legs = '#2f9a4a'
      }
      return { skin, hair, hairColor: blond ? '#e8c46a' : '#141416', shirt, shorts, socks, legs, sleeves, arms, hands, boots, scale: i >= KID && i < KID + 22 ? 0.62 : 1, captain: i % 11 === CAPTAIN && i < 22 }
    })
  }, [e])

  const PARTS = useMemo<Part[]>(() => {
    const L = looks
    const hairSize = (i: number): [number, number, number] | null =>
      L[i].hair === 3 ? null : L[i].hair === 1 ? [0.36, 0.3, 0.36] : L[i].hair === 4 ? [0.4, 0.18, 0.4] : [0.39, 0.11, 0.39]
    return [
      { chain: [], at: [0, 1.47, 0], size: [0.6, 0.64, 0.34], color: (i) => L[i].shirt },
      { chain: [], at: [0, 1.03, 0], size: [0.6, 0.3, 0.36], color: (i) => L[i].shorts },
      { chain: ['hipL'], at: [0, -0.24, 0], size: [0.21, 0.5, 0.23], color: (i) => L[i].legs },
      { chain: ['hipL', 'kneeL'], at: [0, -0.24, 0], size: [0.19, 0.5, 0.21], color: (i) => L[i].socks },
      { chain: ['hipL', 'kneeL'], at: [0, -0.53, 0.06], size: [0.22, 0.12, 0.34], color: (i) => L[i].boots },
      { chain: ['hipR'], at: [0, -0.24, 0], size: [0.21, 0.5, 0.23], color: (i) => L[i].legs },
      { chain: ['hipR', 'kneeR'], at: [0, -0.24, 0], size: [0.19, 0.5, 0.21], color: (i) => L[i].socks },
      { chain: ['hipR', 'kneeR'], at: [0, -0.53, 0.06], size: [0.22, 0.12, 0.34], color: (i) => L[i].boots },
      { chain: ['shL'], at: [0, -0.17, 0], size: [0.18, 0.36, 0.18], color: (i) => L[i].sleeves },
      { chain: ['shL', 'elL'], at: [0, -0.16, 0], size: [0.15, 0.33, 0.15], color: (i) => L[i].arms },
      { chain: ['shL', 'elL'], at: [0, -0.38, 0], size: [0.15, 0.14, 0.15], color: (i) => L[i].hands },
      { chain: ['shR'], at: [0, -0.17, 0], size: [0.18, 0.36, 0.18], color: (i) => L[i].sleeves },
      { chain: ['shR', 'elR'], at: [0, -0.16, 0], size: [0.15, 0.33, 0.15], color: (i) => L[i].arms },
      { chain: ['shR', 'elR'], at: [0, -0.38, 0], size: [0.15, 0.14, 0.15], color: (i) => L[i].hands },
      { chain: [], at: [0, 1.83, 0], size: [0.17, 0.1, 0.17], color: (i) => L[i].skin },
      { chain: [], at: [0, 2.06, 0], size: [0.36, 0.4, 0.36], color: (i) => L[i].skin },
      { chain: [], at: [0, 2.28, 0], size: [0.39, 0.11, 0.39], color: (i) => L[i].hairColor, show: hairSize },
      { chain: [], at: [0, 1.98, -0.17], size: [0.38, 0.42, 0.12], color: (i) => L[i].hairColor, show: (i) => (L[i].hair === 2 ? [0.38, 0.42, 0.12] : null) },
      { chain: [], at: [-0.08, 2.1, 0.181], size: [0.06, 0.06, 0.02], color: () => '#141416' },
      { chain: [], at: [0.08, 2.1, 0.181], size: [0.06, 0.06, 0.02], color: () => '#141416' },
      { chain: ['shL'], at: [0, -0.1, 0], size: [0.2, 0.08, 0.2], color: () => '#ffd43b', show: (i) => (L[i].captain ? [0.2, 0.08, 0.2] : null) },
    ]
  }, [looks])
  // Where each joint sits on the body.
  const JOINTS: Record<string, [number, number, number]> = { hipL: [-0.15, 0.99, 0], hipR: [0.15, 0.99, 0], kneeL: [0, -0.49, 0], kneeR: [0, -0.49, 0], shL: [-0.39, 1.74, 0], shR: [0.39, 1.74, 0], elL: [0, -0.35, 0], elR: [0, -0.35, 0] }

  const parts = useRef<(THREE.InstancedMesh | null)[]>([])
  const backs = useRef<(THREE.Mesh | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  const warm = useRef<THREE.InstancedMesh>(null)
  const props = useRef<Record<string, THREE.Object3D | null>>({})
  const flagGeo = useMemo(() => new THREE.PlaneGeometry(12, 8, 24, 16), [])
  const state = useMemo(
    () => ({
      x: new Float32Array(NF), z: new Float32Array(NF), face: new Float32Array(NF), stride: new Float32Array(NF), speed: new Float32Array(NF), seen: new Uint8Array(NF),
      init: false, last: 0, ballPrev: new THREE.Vector3(),
      handL: [...Array(NF)].map(() => new THREE.Vector3()), handR: [...Array(NF)].map(() => new THREE.Vector3()), torso: [...Array(NF)].map(() => new THREE.Matrix4()),
    }),
    [],
  )
  const tmp = useMemo(
    () => ({ base: new THREE.Matrix4(), body: new THREE.Matrix4(), m: new THREE.Matrix4(), j: new THREE.Matrix4(), q: new THREE.Quaternion(), qz: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0), ax: new THREE.Vector3(1, 0, 0), az: new THREE.Vector3(0, 0, 1), zero: new THREE.Vector3(0, 0, 0) }),
    [],
  )
  const act = useMemo(() => still({} as Act), [])

  useFrame((_, delta) => {
    const t = worldTime()
    const k = t / 60 - e.start
    const f = matchFrame(e, k, frame)
    const dt = Math.min(0.1, delta)
    const st = state
    // Walk everyone towards where they want to be.
    for (let i = 0; i < NF; i++) {
      const g = f.figs[i]
      if (g.hidden) {
        st.seen[i] = 0
        continue
      }
      if (!st.init || !st.seen[i]) {
        // Joining mid-match everyone is in place; someone appearing comes out of the tunnel.
        const fromTunnel = st.init
        st.x[i] = fromTunnel ? 0 : g.x
        st.z[i] = fromTunnel ? -41.5 : g.z
        st.face[i] = g.face ?? 0
        st.seen[i] = 1
      }
      const dx = g.x - st.x[i]
      const dz = g.z - st.z[i]
      const d = Math.hypot(dx, dz)
      const step = Math.min(d, g.run * dt)
      if (d > 1e-4) {
        st.x[i] += (dx / d) * step
        st.z[i] += (dz / d) * step
      }
      st.speed[i] += (step / Math.max(dt, 1e-3) - st.speed[i]) * Math.min(1, dt * 8)
      st.stride[i] += st.speed[i] * dt * 1.9
      const want = st.speed[i] > 0.8 && d > 0.3 ? Math.atan2(dx, dz) : g.face
      if (want !== null) {
        let df = want - st.face[i]
        df = Math.atan2(Math.sin(df), Math.cos(df))
        st.face[i] += df * Math.min(1, dt * 7)
      }
    }
    st.init = true

    // The bodies.
    const { base, body, m, j, q, qz, v, s: sc, one, up, ax, az, zero } = tmp
    for (let i = 0; i < NF; i++) {
      const g = f.figs[i]
      const hidden = g.hidden
      const L = looks[i]
      pose(act, g, t, hidden ? 0 : st.speed[i], st.stride[i], i)
      base.compose(v.set(st.x[i], 0.7 + act.lift * L.scale, st.z[i]), q.setFromAxisAngle(up, st.face[i]), sc.setScalar(hidden ? 0.0001 : L.scale))
      tmp.e.set(act.lean, 0, act.roll)
      body.compose(v.set(0, 1.0, 0), q.setFromEuler(tmp.e), one)
      base.multiply(body)
      body.makeTranslation(0, -1.0, 0)
      base.multiply(body)
      PARTS.forEach((part, n) => {
        const mesh = parts.current[n]
        if (!mesh) return
        m.copy(base)
        for (const jn of part.chain) {
          const p = JOINTS[jn]
          let fwd = 0
          let out = 0
          if (jn === 'hipL') fwd = act.hipL
          else if (jn === 'hipR') fwd = act.hipR
          else if (jn === 'kneeL') fwd = -act.kneeL
          else if (jn === 'kneeR') fwd = -act.kneeR
          else if (jn === 'shL') [fwd, out] = [act.shL, -act.outL]
          else if (jn === 'shR') [fwd, out] = [act.shR, act.outR]
          else if (jn === 'elL') fwd = act.elL
          else if (jn === 'elR') fwd = act.elR
          qz.setFromAxisAngle(az, out)
          q.setFromAxisAngle(ax, -fwd)
          j.compose(v.set(p[0], p[1], p[2]), qz.multiply(q), one)
          m.multiply(j)
        }
        if (n === 13) st.handR[i].copy(zero).applyMatrix4(j.compose(v.set(0, -0.4, 0), q.identity(), one).premultiply(m))
        if (n === 10) st.handL[i].copy(zero).applyMatrix4(j.compose(v.set(0, -0.4, 0), q.identity(), one).premultiply(m))
        if (n === 0) st.torso[i].copy(m)
        const size = part.show ? part.show(i) : part.size
        j.compose(v.set(part.at[0], part.at[1], part.at[2]), q.identity(), size ? sc.set(size[0], size[1], size[2]) : sc.setScalar(0.0001))
        m.multiply(j)
        mesh.setMatrixAt(i, m)
      })
      const back = backs.current[i]
      if (back) {
        back.visible = !hidden
        back.matrix.copy(st.torso[i]).multiply(j.compose(v.set(0, 1.47, -0.176), q.setFromAxisAngle(up, Math.PI), sc.set(0.46, 0.5, 1)))
      }
    }
    for (const mesh of parts.current) if (mesh) mesh.instanceMatrix.needsUpdate = true

    // The ball, spinning as it rolls; in a hand when it's held.
    const b = ball.current
    if (b) {
      b.visible = !f.ball.hidden
      const held = f.figs[REF] && f.ball.y > 1.3 && f.ball.y < 3.2
      const [x, y, z] = [f.ball.x, f.ball.y + 0.7, f.ball.z]
      const dx = x - st.ballPrev.x
      const dz = z - st.ballPrev.z
      if (Math.abs(dx) + Math.abs(dz) < 8 && !held) {
        b.rotation.x += dz / 0.35
        b.rotation.z -= dx / 0.35
      }
      st.ballPrev.set(x, y, z)
      b.position.set(x, y, z)
    }
    // The warm-up balls.
    const w = warm.current
    if (w) {
      for (let n = 0; n < 12; n++) {
        const p = f.warm[n]
        m.compose(v.set(p?.x ?? 0, (p?.y ?? 0) + 0.7, p?.z ?? 0), q.identity(), sc.setScalar(p ? 1 : 0.0001))
        w.setMatrixAt(n, m)
      }
      w.instanceMatrix.needsUpdate = true
    }

    // What people hold: the referee's card, the fourth official's board, the assistants' flags, bottles, the coaches' boards, cameras, the coin.
    const P = props.current
    const showAt = (o: THREE.Object3D | null, on: boolean, at?: THREE.Vector3, face = 0) => {
      if (!o) return
      o.visible = on
      if (on && at) {
        o.position.copy(at)
        o.rotation.set(0, face, 0)
      }
    }
    showAt(P.card, !!f.card, st.handR[REF], st.face[REF])
    if (P.card && f.card) ((P.card as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(f.card === 'red' ? '#e03131' : '#ffd43b')
    const mid = v.copy(st.handL[FOURTH]).add(st.handR[FOURTH]).multiplyScalar(0.5)
    showAt(P.board, !!f.board && !f.figs[FOURTH].hidden, mid.clone().add(new THREE.Vector3(0, 0.35, 0)), st.face[FOURTH])
    if (f.board && P.board) boardText(P.board as THREE.Group, f.board)
    showAt(P.flag1, !f.figs[AR1].hidden, st.handR[AR1], st.face[AR1])
    showAt(P.flag2, !f.figs[AR2].hidden, st.handR[AR2], st.face[AR2])
    showAt(P.coin, !!f.coin, f.coin ? new THREE.Vector3(f.coin.x, f.coin.y + 0.7, f.coin.z) : undefined)
    if (P.coin) P.coin.rotation.x = t * 20
    // Bottles in the drinkers' hands, boards in the coaches', cameras in the photographers' (with a flash now and then).
    const bottles = P.bottles as THREE.InstancedMesh | null
    const cams = P.cams as THREE.InstancedMesh | null
    const flashes = P.flashes as THREE.InstancedMesh | null
    let nb = 0
    let nc = 0
    for (let i = 0; i < NF; i++) {
      const g = f.figs[i]
      if (g.hidden) continue
      if (g.pose === 'drink' && bottles && nb < 40) {
        m.compose(st.handR[i], q.setFromAxisAngle(up, st.face[i]), one)
        bottles.setMatrixAt(nb++, m)
      }
      if ((g.pose === 'camera' || g.pose === 'tactics') && cams && nc < 12) {
        const at = v.copy(st.handL[i]).add(st.handR[i]).multiplyScalar(0.5)
        m.compose(at, q.setFromAxisAngle(up, st.face[i]), g.pose === 'tactics' ? sc.set(2.2, 3, 0.3) : one)
        cams.setMatrixAt(nc, m)
        if (flashes) {
          const on = g.pose === 'camera' && hash(Math.floor(t * 3) + i) > 0.7
          m.compose(at.add(v.set(Math.sin(st.face[i]) * 0.2, 0.15, Math.cos(st.face[i]) * 0.2)), q.identity(), sc.setScalar(on ? 1 : 0.0001))
          flashes.setMatrixAt(nc, m)
        }
        nc++
      }
    }
    if (bottles) {
      bottles.count = nb
      bottles.instanceMatrix.needsUpdate = true
    }
    if (cams) {
      cams.count = nc
      cams.instanceMatrix.needsUpdate = true
    }
    if (flashes) {
      flashes.count = nc
      flashes.instanceMatrix.needsUpdate = true
    }
    // The big flag, rippling.
    const fl = P.bigFlag as THREE.Mesh | null
    if (fl) {
      fl.visible = !!f.flag
      if (f.flag) {
        fl.position.set(f.flag.x, f.flag.y + 0.7, f.flag.z)
        const pos = flagGeo.attributes.position as THREE.BufferAttribute
        for (let n = 0; n < pos.count; n++) {
          const x = pos.getX(n)
          const y = pos.getY(n)
          pos.setZ(n, Math.sin(x * 0.7 + t * 4) * 0.25 + Math.cos(y * 0.9 + t * 3) * 0.18)
        }
        pos.needsUpdate = true
        flagGeo.computeVertexNormals()
      }
    }
    showAt(P.tunnel, f.tunnel)
    // Fireworks at the tunnel, confetti over the pitch.
    const pyro = P.pyro as THREE.Group | null
    if (pyro) {
      pyro.visible = f.pyro > 0
      pyro.children.forEach((c, n) => c.scale.set(1, 0.5 + Math.abs(Math.sin(t * 13 + n * 2.1)) * 0.9, 1))
    }
    const conf = P.confetti as THREE.InstancedMesh | null
    if (conf) {
      for (let n = 0; n < CONFETTI; n++) {
        const fall = (t * (1.6 + hash(n) * 1.2) + hash(n * 3) * 26) % 26
        const x = (hash(n * 7) - 0.5) * 70 + Math.sin(t + n) * 1.5
        const z = (hash(n * 11) - 0.5) * 50 - 8
        q.setFromEuler(tmp.e.set(t * 3 + n, t * 2 + n * 0.5, 0))
        m.compose(v.set(x, 26 - fall, z), q, sc.setScalar(f.confetti > hash(n * 5) ? 1 : 0.0001))
        conf.setMatrixAt(n, m)
      }
      conf.instanceMatrix.needsUpdate = true
    }
  })

  const ballTex = useMemo(() => {
    // White with black patches, so the spin shows.
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 32
    const g = c.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 64, 32)
    g.fillStyle = '#141416'
    for (const [x, y] of [[8, 8], [24, 20], [40, 8], [56, 20], [16, 28], [48, 28], [32, 2]]) g.fillRect(x - 3, y - 3, 6, 6)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  // The number and the name on each player's back.
  const backTex = useMemo(
    () =>
      [...Array(NF)].map((_, i) => {
        const player = i < 22 || i === SUB[0] || i === SUB[1]
        if (!player) return null
        const team = i < 11 || i === SUB[0] ? -1 : 1
        const num = i === SUB[0] ? SUB_NUMBERS[0] : i === SUB[1] ? SUB_NUMBERS[1] : NUMBERS[i % 11]
        const club = team === -1 ? e.home ?? '' : e.away ?? ''
        const c = document.createElement('canvas')
        c.width = 64
        c.height = 70
        const g = c.getContext('2d')!
        g.clearRect(0, 0, 64, 70)
        g.fillStyle = looks[i].shorts
        g.textAlign = 'center'
        g.font = 'bold 13px sans-serif'
        g.fillText(playerName(club, num), 32, 13, 62)
        g.font = 'bold 46px sans-serif'
        g.fillText(String(num), 32, 58)
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        return t
      }),
    [e, looks],
  )
  const flagTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 192
    c.height = 128
    const g = c.getContext('2d')!
    ;['#f08a24', '#ffffff', '#2f9a4a'].forEach((col, n) => {
      g.fillStyle = col
      g.fillRect(n * 64, 0, 64, 128)
    })
    g.fillStyle = '#141416'
    g.font = 'bold 26px sans-serif'
    g.textAlign = 'center'
    g.fillText('BABI LEAGUE', 96, 72)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const tunnelTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = '#f08a24'
    g.fillRect(0, 0, 256, 64)
    g.fillStyle = '#2f9a4a'
    g.fillRect(0, 50, 256, 14)
    g.fillStyle = '#ffffff'
    g.font = 'bold 28px sans-serif'
    g.textAlign = 'center'
    g.fillText('BABI LEAGUE', 128, 38)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const reg = (name: string) => (o: THREE.Object3D | null) => {
    props.current[name] = o
  }

  return (
    <>
      {PARTS.map((part, n) => (
        <instancedMesh
          key={n}
          ref={(m) => {
            parts.current[n] = m
            if (m && !m.userData.painted) {
              const c = new THREE.Color()
              for (let i = 0; i < NF; i++) m.setColorAt(i, c.set(part.color(i)))
              if (m.instanceColor) m.instanceColor.needsUpdate = true
              ;(m.material as THREE.Material).needsUpdate = true
              m.userData.painted = true
            }
          }}
          args={[undefined, undefined, NF]}
          frustumCulled={false}
        >
          <boxGeometry />
          <meshLambertMaterial />
        </instancedMesh>
      ))}
      {backTex.map((tex, i) =>
        tex ? (
          <mesh key={i} ref={(m) => { backs.current[i] = m; if (m) m.matrixAutoUpdate = false }} frustumCulled={false}>
            <planeGeometry />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        ) : null,
      )}
      <mesh ref={ball}>
        <sphereGeometry args={[0.35, 12, 8]} />
        <meshLambertMaterial map={ballTex} emissive="#ffffff" emissiveIntensity={0.15} />
      </mesh>
      <instancedMesh ref={warm} args={[undefined, undefined, 12]} frustumCulled={false}>
        <sphereGeometry args={[0.35, 10, 8]} />
        <meshLambertMaterial color="#ffffff" />
      </instancedMesh>
      <mesh ref={reg('card')} visible={false}>
        <boxGeometry args={[0.3, 0.42, 0.04]} />
        <meshBasicMaterial color="#ffd43b" />
      </mesh>
      <group ref={reg('board')} visible={false}>
        <mesh>
          <boxGeometry args={[1.3, 0.75, 0.06]} />
          <meshBasicMaterial color="#141416" />
        </mesh>
        <mesh position={[0, 0, 0.04]} name="face">
          <planeGeometry args={[1.2, 0.66]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.04]} rotation={[0, Math.PI, 0]} name="face2">
          <planeGeometry args={[1.2, 0.66]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      </group>
      {['flag1', 'flag2'].map((n) => (
        <group key={n} ref={reg(n)}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.04, 0.75, 0.04]} />
            <meshLambertMaterial color="#222" />
          </mesh>
          <mesh position={[0, 0.5, 0.2]}>
            <boxGeometry args={[0.02, 0.3, 0.38]} />
            <meshLambertMaterial color="#ff3b1f" />
          </mesh>
        </group>
      ))}
      <mesh ref={reg('coin')} visible={false}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 12]} />
        <meshLambertMaterial color="#e3b341" emissive="#e3b341" emissiveIntensity={0.3} />
      </mesh>
      <instancedMesh ref={reg('bottles')} args={[undefined, undefined, 40]} frustumCulled={false}>
        <boxGeometry args={[0.09, 0.26, 0.09]} />
        <meshLambertMaterial color="#9fd8ff" />
      </instancedMesh>
      <instancedMesh ref={reg('cams')} args={[undefined, undefined, 12]} frustumCulled={false}>
        <boxGeometry args={[0.24, 0.16, 0.16]} />
        <meshLambertMaterial color="#202226" />
      </instancedMesh>
      <instancedMesh ref={reg('flashes')} args={[undefined, undefined, 12]} frustumCulled={false}>
        <boxGeometry args={[0.18, 0.12, 0.05]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <mesh ref={reg('bigFlag')} geometry={flagGeo} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <meshLambertMaterial map={flagTex} side={THREE.DoubleSide} />
      </mesh>
      {/* The inflatable tunnel the teams walk out through */}
      <group ref={reg('tunnel')} position={[0, 0.7, -39.8]} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.6, 2.6, 6.4, 20, 1, true, Math.PI / 2, Math.PI]} />
          <meshLambertMaterial map={tunnelTex} side={THREE.DoubleSide} />
        </mesh>
        {[-3.2, 3.2].map((z) => (
          <mesh key={z} position={[0, 0, z]} rotation={[0, 0, 0]}>
            <torusGeometry args={[2.6, 0.28, 8, 20, Math.PI]} />
            <meshLambertMaterial color="#2f9a4a" />
          </mesh>
        ))}
      </group>
      <group ref={reg('pyro')} visible={false}>
        {[-4.5, 4.5].flatMap((x) => [-37.5, -33.5].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.7, z]}>
            {/* The flame jet on its black box: orange outside, yellow at the heart */}
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[0.7, 0.6, 0.7]} />
              <meshLambertMaterial color="#202226" />
            </mesh>
            <mesh position={[0, 2.6, 0]}>
              <coneGeometry args={[0.32, 4.2, 7]} />
              <meshBasicMaterial color="#ff6a00" toneMapped={false} transparent opacity={0.8} depthWrite={false} />
            </mesh>
            <mesh position={[0, 2.0, 0]}>
              <coneGeometry args={[0.16, 2.8, 6]} />
              <meshBasicMaterial color="#ffe066" toneMapped={false} />
            </mesh>
          </group>
        )))}
      </group>
      <instancedMesh
        ref={(m) => {
          props.current.confetti = m
          if (m && !m.userData.painted) {
            const c = new THREE.Color()
            const cols = ['#f08a24', '#ffffff', '#2f9a4a', '#ffd43b']
            for (let n = 0; n < CONFETTI; n++) m.setColorAt(n, c.set(cols[n % 4]))
            m.userData.painted = true
          }
        }}
        args={[undefined, undefined, CONFETTI]}
        frustumCulled={false}
      >
        <planeGeometry args={[0.25, 0.18]} />
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
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
      <Dugouts home={e.home ?? ''} away={e.away ?? ''} />
    </>
  )
}

const CONFETTI = 360

/** The fourth official's board: the text in red and green lights. */
function boardText(g: THREE.Group, text: string) {
  if (g.userData.text === text) return
  g.userData.text = text
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 70
  const x = c.getContext('2d')!
  x.fillStyle = '#0b0d14'
  x.fillRect(0, 0, 128, 70)
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.font = 'bold 34px monospace'
  x.fillStyle = text.startsWith('+') ? '#3dff8a' : '#ff5a3d'
  x.fillText(text, 64, 36, 120)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  for (const n of ['face', 'face2']) {
    const m = g.getObjectByName(n) as THREE.Mesh | undefined
    if (m) {
      const mat = m.material as THREE.MeshBasicMaterial
      mat.map?.dispose()
      mat.map = t
      mat.needsUpdate = true
    }
  }
}

/** The two dugouts on the touchline, the substitutes sitting in their tracksuits, legs jiggling. */
function Dugouts({ home, away }: { home: string; away: string }) {
  const subs = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    subs.current?.children.forEach((g, i) => (g.position.y = Math.max(0, Math.sin(t * 5 + i * 1.7)) * 0.06))
  })
  return (
    <>
      {([[-1, home], [1, away]] as const).map(([s, club]) => {
        const [c1, c2] = colorsOf(club)
        return (
          <group key={s} position={[s * 11, 0.7, -39.5]}>
            {/* The shelter: the back, the sides, the clear roof */}
            <mesh position={[0, 1.2, -0.9]}>
              <boxGeometry args={[7, 2.4, 0.15]} />
              <meshLambertMaterial color="#d8dde3" />
            </mesh>
            {[-3.5, 3.5].map((x) => (
              <mesh key={x} position={[x, 1.2, 0]}>
                <boxGeometry args={[0.12, 2.4, 1.9]} />
                <meshLambertMaterial color="#d8dde3" />
              </mesh>
            ))}
            <mesh position={[0, 2.45, 0]}>
              <boxGeometry args={[7.1, 0.08, 2.0]} />
              <meshLambertMaterial color="#bfe3ff" transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, 0.45, -0.4]}>
              <boxGeometry args={[6.6, 0.15, 0.7]} />
              <meshLambertMaterial color={c1} />
            </mesh>
            <group ref={s === -1 ? subs : undefined}>
              {[-2.4, -1.2, 0, 1.2, 2.4].map((x, i) => (
                <group key={x} position={[x, 0, -0.4]}>
                  <mesh position={[0, 0.95, -0.05]}>
                    <boxGeometry args={[0.55, 0.7, 0.32]} />
                    <meshLambertMaterial color={i % 2 ? c2 : c1} />
                  </mesh>
                  <mesh position={[0, 1.5, -0.05]}>
                    <boxGeometry args={[0.34, 0.36, 0.34]} />
                    <meshLambertMaterial color={SKIN[(i * 3) % SKIN.length]} />
                  </mesh>
                  <mesh position={[0, 0.6, 0.3]}>
                    <boxGeometry args={[0.5, 0.2, 0.6]} />
                    <meshLambertMaterial color={c2} />
                  </mesh>
                  <mesh position={[0, 0.3, 0.55]}>
                    <boxGeometry args={[0.5, 0.6, 0.2]} />
                    <meshLambertMaterial color={c2} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        )
      })}
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
    const clock = clockText(k)
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

/** After a goal, the scorers' ultras light flares: red cores and smoke in the club's colours rising off the stand. */
function Flares({ e }: { e: StadiumEvent }) {
  const smoke = useRef<THREE.InstancedMesh>(null)
  const cores = useRef<THREE.InstancedMesh>(null)
  const FL = 7
  const PUFFS = 9
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const team = useRef(0)
  useFrame(() => {
    const t = worldTime()
    const k = minuteNow() - e.start
    const recent = (gs?: number[]) => (gs ?? []).some((x) => k - x >= 0.05 && k - x < 2)
    const side = recent(e.homeGoals) ? -1 : recent(e.awayGoals) ? 1 : 0
    // Smoke takes the club's colour; repaint when the side changes.
    if (side !== team.current && side !== 0 && smoke.current) {
      const c = new THREE.Color()
      const [a, b] = colorsOf(side === -1 ? e.home : e.away)
      for (let i = 0; i < FL * PUFFS; i++) smoke.current.setColorAt(i, c.set(i % 3 === 0 ? b : a))
      if (smoke.current.instanceColor) smoke.current.instanceColor.needsUpdate = true
      ;(smoke.current.material as THREE.Material).needsUpdate = true
    }
    team.current = side
    const centre = side === -1 ? 0 : Math.PI // home fans on +x
    for (let f = 0; f < FL; f++) {
      const a = centre + (f - (FL - 1) / 2) * 0.12
      const r = 57 + (f % 3) * 2
      const x = Math.cos(a) * r * SX
      const z = Math.sin(a) * r
      const y = 2.9 + ((r - 54) / 22) * 19.2 + 1.3
      m.compose(v.set(x, y, z), q.identity(), sc.setScalar(side ? 1 : 0.001))
      cores.current?.setMatrixAt(f, m)
      for (let j = 0; j < PUFFS; j++) {
        const age = (t * 0.35 + j / PUFFS + f * 0.13) % 1
        const fade = age < 0.8 ? 1 : (1 - age) / 0.2
        const size = side ? (0.6 + age * 3) * fade : 0.001
        m.compose(v.set(x - Math.cos(a) * age * 3, y + age * 11, z - Math.sin(a) * age * 3 + Math.sin(t + j) * 0.5), q.identity(), sc.setScalar(size))
        smoke.current?.setMatrixAt(f * PUFFS + j, m)
      }
    }
    if (cores.current) cores.current.instanceMatrix.needsUpdate = true
    if (smoke.current) smoke.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={cores} args={[undefined, undefined, FL]} frustumCulled={false}>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
        <meshBasicMaterial color="#ff3b1f" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smoke} args={[undefined, undefined, FL * PUFFS]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshLambertMaterial transparent opacity={0.42} depthWrite={false} flatShading />
      </instancedMesh>
    </>
  )
}

/** At night, phones flashing here and there in the stands. */
function Flashes({ fans }: { fans: { x: number; y: number; z: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const COUNT = 40
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const t = worldTime()
    for (let i = 0; i < COUNT; i++) {
      const tick = Math.floor(t * 4 + i * 0.37)
      const f = fans[Math.floor(hash(tick * 13 + i) * fans.length)]
      const on = hash(tick + i * 7) > 0.8
      m.compose(v.set(f.x, f.y + 1.1, f.z), q, sc.setScalar(on ? 1 : 0.001))
      ref.current?.setMatrixAt(i, m)
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <boxGeometry args={[0.35, 0.35, 0.35]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  )
}
