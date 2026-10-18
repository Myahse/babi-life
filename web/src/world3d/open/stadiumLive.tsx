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
    // After a goal only the scorers' fans erupt; the others go quiet.
    const k = now - e.start
    const homeUp = match && (e.homeGoals ?? []).some((x) => k - x >= 0 && k - x < 1.5)
    const awayUp = match && (e.awayGoals ?? []).some((x) => k - x >= 0 && k - x < 1.5)
    const base = match ? 0.25 : now >= e.start ? 0.8 : 0.2
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

const PASS = 2.2 // seconds between passes
const BUILD = 0.35 // minutes of build-up before a goal
const SHOT = 0.06 // the shot itself (≈ 4 s)
const PARTY = 1.2 // minutes of celebrating after it
const FOUL = 0.3 // minutes a foul stops the play
const FULL = 105 // the final whistle (game.FullTime); half-time from 45 to 60
const WALK = 0.5 // minutes to walk on or off the pitch
const REF = 22
const COACH = [23, 24] // the home coach, the away coach
const N = 25 // two teams of eleven, the referee, the two coaches

// team -1 is home, 1 away; each keeps its goal at x = -team·half·52.5 and attacks the other one.
type Goal = { at: number; team: -1 | 1 }
type Spot = { x: number; z: number; party: boolean }
type Foul = { at: number; red: boolean }

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

/** Where everyone is at clock time t (seconds), k minutes into the match. */
function layout(t: number, k: number, goals: Goal[], out: Spot[]) {
  // Ends change during the break, so they walk back out to their new side.
  const half = k >= 52 ? -1 : 1
  const playing = k >= 0 && k < FULL && !(k >= 45 && k < 60)
  // The play's centre, wandering; at the kick-off, the centre spot.
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
  // After a goal the play drifts from the goalmouth back to the centre spot for the
  // kick-off, then picks up again: no one jumps from one place to another.
  const scored = [...goals].reverse().find((g) => k >= g.at && k - g.at < PARTY + WALK)
  if (scored) {
    const since = k - scored.at
    const goalX = scored.team * (scored.at >= 60 ? -1 : 1) * 52.5
    if (since < PARTY) {
      const v = ease(since / PARTY)
      fx = goalX * 0.62 * (1 - v)
      fz *= 0.3 * (1 - v)
    } else {
      const w = ease((since - PARTY) / WALK)
      fx *= w
      fz *= w
    }
  }
  // The walk on and off: from the line-up (or the tunnel) into the 4-4-2, and back.
  const into = k < 0 ? 0 : k < WALK ? ease(k / WALK) : k >= 45 && k < 45 + WALK ? 1 - ease((k - 45) / WALK) : k >= 45 && k < 60 ? (k >= 60 - WALK ? ease((k - 60 + WALK) / WALK) : 0) : 1
  // How free the play is: none around the kick-offs, fading at the whistles, so the play opens and closes smoothly.
  const free =
    k < 45 ? ease((k - WALK) / WALK) : k < 60 ? 1 - ease((k - 45) / WALK) : k < FULL ? ease((k - 60) / WALK) : 1 - ease((k - FULL) / WALK)
  fx *= free
  fz *= free
  for (let i = 0; i < N; i++) {
    const p = (out[i] ??= { x: 0, z: 0, party: false })
    p.party = false
    if (i === REF) {
      // The referee follows the play from a little way off.
      p.x = playing ? fx - 8 : 0
      p.z = playing ? fz + 10 : k >= 45 && k < 60 ? -40 : -31
      continue
    }
    if (i === COACH[0] || i === COACH[1]) {
      // The coaches pace their box on the touchline.
      const s = i === COACH[0] ? -1 : 1
      p.x = s * 11 + Math.sin(t * 0.23 + i) * 3.5
      p.z = -36.5
      continue
    }
    const side = i < 11 ? -1 : 1
    const j = i % 11
    // Off the play: warming up in their half, then the line-up facing the main stand; the tunnel at half-time.
    let lx = side * (3 + j * 2.2)
    let lz = k >= 45 && k < 60 ? -40 : -31
    if (k < -4) {
      // Warming up, then jogging over to the line-up.
      const w = ease((k + 4 + WALK) / WALK)
      lx += (side * (12 + (j % 4) * 9) + Math.sin(t * 0.7 + i) * 3 - lx) * (1 - w)
      lz += (-18 + Math.floor(j / 4) * 14 + Math.cos(t * 0.7 + i) * 3 - lz) * (1 - w)
    }
    // In the play: the 4-4-2, pulled towards the ball.
    const [ox, oz] = j === 0 ? [-48, 0] : j < 5 ? [-30, -24 + (j - 1) * 16] : j < 9 ? [-8, -24 + (j - 5) * 16] : [12, j === 9 ? -8 : 8]
    const hx = ox * side * half
    let px: number
    let pz: number
    if (j === 0) {
      // The keeper on his line, following the ball across.
      px = hx + (fx - hx) * 0.04
      pz = Math.max(-5, Math.min(5, fz * 0.25))
    } else {
      px = hx + (fx - hx) * 0.35 + Math.sin(t * 1.3 + i) * 1.5 * free
      pz = oz + (fz - oz) * 0.35 + Math.cos(t * 1.1 + i) * 1.5 * free
    }
    p.x = lx + (px - lx) * into
    p.z = lz + (pz - lz) * into
    if (last && playing) {
      const goalX = last.team * half * 52.5
      // Out to the corner, and back for the kick-off at the end.
      const u = Math.max(0, Math.min(1, (k - last.at) / 0.25, (PARTY - (k - last.at)) / 0.25))
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
    // After the final whistle the winners gather in the middle to dance.
    if (k >= FULL) {
      const hs = goals.filter((g) => g.team === -1).length
      const as = goals.length - hs
      const won = hs === as ? 0 : hs > as ? -1 : 1
      if (side === won) {
        const u = ease((k - FULL) / 0.4)
        p.x += (Math.sin(i * 2.4) * 5 - p.x) * u
        p.z += (Math.cos(i * 2.4) * 5 - p.z) * u
        p.party = true
      }
    }
  }
  return { fx, fz, playing, next, last, half }
}

/** Who has the ball in pass number s: one of the three players nearest the play (not the keepers; of one side, if given). */
function holder(s: number, spots: Spot[], fx: number, fz: number, team = 0) {
  const near = spots
    .slice(0, 22)
    .map((p, i) => ({ i, d: Math.hypot(p.x - fx, p.z - fz) }))
    .filter((p) => p.i % 11 !== 0 && (team === 0 || (p.i < 11 ? -1 : 1) === team))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
  return near[Math.floor(hash(s) * near.length)].i
}

/** How a figure stands this frame: the limbs' swings (radians), the body's tilt, how high it is. */
type Act = { legL: number; legR: number; armL: number; armR: number; outL: number; outR: number; lean: number; roll: number; lift: number }
const still = (a: Act) => {
  a.legL = a.legR = a.armL = a.armR = a.outL = a.outR = a.lean = a.roll = a.lift = 0
  return a
}

function Teams({ e }: { e: StadiumEvent }) {
  const goals = useMemo<Goal[]>(
    () =>
      [...(e.homeGoals ?? []).map((at) => ({ at, team: -1 as const })), ...(e.awayGoals ?? []).map((at) => ({ at, team: 1 as const }))].sort((a, b) => a.at - b.at),
    [e],
  )
  // The fouls: one every five minutes or so, never too near a goal or out of play; now and then a red card.
  const fouls = useMemo<Foul[]>(() => {
    const out: Foul[] = []
    for (let f = 0; f < 24; f++) {
      const at = f * 5 + 1 + hash(f + e.start) * 3.5
      const live = (at > 1 && at + FOUL < 45) || (at > 61 && at + FOUL < FULL)
      if (live && !goals.some((g) => Math.abs(g.at - at) < 0.7)) out.push({ at, red: hash(f * 3 + e.start) > 0.93 })
    }
    return out
  }, [e.start, goals])
  const parts = useRef<(THREE.InstancedMesh | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  const card = useRef<THREE.Mesh>(null)
  const now = useMemo(() => [] as Spot[], [])
  const before = useMemo(() => [] as Spot[], [])
  const scratch = useMemo(() => [] as Spot[], [])
  const facing = useMemo(() => new Float32Array(N), [])
  const lastBall = useMemo(() => new THREE.Vector3(), [])
  const act = useMemo<Act>(() => still({} as Act), [])
  const tmp = useMemo(
    () => ({
      base: new THREE.Matrix4(), tilt: new THREE.Matrix4(), local: new THREE.Matrix4(), out: new THREE.Matrix4(), hand: new THREE.Vector3(),
      q: new THREE.Quaternion(), r: new THREE.Quaternion(), rz: new THREE.Quaternion(), e: new THREE.Euler(),
      v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, 1), one: new THREE.Vector3(1, 1, 1),
    }),
    [],
  )

  // The kit: shirts in the club's first colour (the keeper and the referee apart), shorts and socks in the second; the coaches in suits.
  const kit = useMemo(() => {
    const [h1, h2] = colorsOf(e.home)
    const [a1, a2] = colorsOf(e.away)
    const shirt: string[] = []
    const shorts: string[] = []
    for (let i = 0; i < N; i++) {
      if (i === REF) {
        shirt.push('#ffd43b')
        shorts.push('#141416')
      } else if (i === COACH[0] || i === COACH[1]) {
        shirt.push(i === COACH[0] ? '#2b2d42' : '#f4f1ea')
        shorts.push('#2b2d42')
      } else {
        const home = i < 11
        shirt.push(i % 11 === 0 ? (home ? '#7c3dff' : '#0ca678') : home ? h1 : a1)
        shorts.push(home ? h2 : a2)
      }
    }
    const skin = [...Array(N)].map((_, i) => SKIN[Math.floor(hash(i + e.start) * SKIN.length)])
    return { shirt, shorts, skin }
  }, [e])

  // The figure's parts: colours, size, pivot, offset from the pivot, and which limb it is (1/-1 legs, 2/-2 arms).
  const PARTS = useMemo(
    () =>
      [
        { c: kit.shirt, s: [0.6, 0.72, 0.34], p: [0, 1.5, 0], o: [0, 0, 0], limb: 0 },
        { c: kit.shorts, s: [0.58, 0.34, 0.34], p: [0, 1.0, 0], o: [0, 0, 0], limb: 0 },
        { c: kit.shorts, s: [0.22, 0.95, 0.24], p: [-0.15, 1.05, 0], o: [0, -0.5, 0], limb: 1 },
        { c: kit.shorts, s: [0.22, 0.95, 0.24], p: [0.15, 1.05, 0], o: [0, -0.5, 0], limb: -1 },
        { c: kit.skin, s: [0.16, 0.7, 0.16], p: [-0.39, 1.82, 0], o: [0, -0.34, 0], limb: 2 },
        { c: kit.skin, s: [0.16, 0.7, 0.16], p: [0.39, 1.82, 0], o: [0, -0.34, 0], limb: -2 },
        { c: kit.skin, s: [0.38, 0.4, 0.38], p: [0, 2.08, 0], o: [0, 0, 0], limb: 0 },
        { c: kit.skin.map(() => '#141416'), s: [0.4, 0.12, 0.4], p: [0, 2.32, 0], o: [0, 0, 0], limb: 0 },
        { c: kit.skin.map(() => '#141416'), s: [0.24, 0.1, 0.34], p: [-0.15, 1.05, 0], o: [0, -1.0, 0.05], limb: 1 },
        { c: kit.skin.map(() => '#141416'), s: [0.24, 0.1, 0.34], p: [0.15, 1.05, 0], o: [0, -1.0, 0.05], limb: -1 },
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
    // The scorer: one of his side's players nearest the play when the shot goes.
    const shooterOf = (g: Goal) => {
      const s = Math.floor(((g.at - SHOT + e.start) * 60) / PASS)
      const at = layout(s * PASS, (s * PASS) / 60 - e.start, goals, scratch)
      return holder(s, scratch, at.fx, at.fz, g.team)
    }
    const keeperFacing = (team: number) => (team === -1 ? 11 : 0) // the keeper of the goal that team attacks
    const foul = fouls.find((f) => k >= f.at && k < f.at + FOUL)

    // The ball: passed from player to player; shot into the net before a goal and left there; still while a foul is dealt with.
    let bx = 0
    let by = 0.25
    let bz = 0
    let owner = -1
    let passer = -1
    let kick = 0 // 0→1 through the passer's kick
    let header = -1
    let jump = 0
    let shooter = -1
    let shotU = 0
    let victim = -1
    let fouler = -1
    if (!playing) {
      bx = 0
      bz = 0
    } else if (last && k - last.at < PARTY) {
      bx = last.team * half * 54
      bz = 1.5
    } else if (next && next.at - k < SHOT) {
      // The shot: the ball flies in past the keeper.
      const goalX = next.team * half * 52.5
      shooter = shooterOf(next)
      shotU = Math.min(1, 1 - (next.at - k) / SHOT)
      const a = now[shooter]
      bx = a.x + (goalX + Math.sign(goalX) * 1.2 - a.x) * shotU
      bz = a.z + (1.2 - a.z) * shotU
      by = 0.25 + Math.sin(shotU * Math.PI) * 2.2
    } else if (foul) {
      const fs = Math.floor(((foul.at + e.start) * 60) / PASS)
      victim = holderAt(fs)
      // The one who brought him down: the nearest player of the other side.
      let best = Infinity
      for (let i = 0; i < 22; i++) {
        if (i % 11 === 0 || i < 11 === victim < 11) continue
        const d = Math.hypot(now[i].x - now[victim].x, now[i].z - now[victim].z)
        if (d < best) [best, fouler] = [d, i]
      }
      bx = now[victim].x + 1
      bz = now[victim].z + 0.6
    } else {
      const s = Math.floor(t / PASS)
      const u = (t - s * PASS) / 0.7
      owner = holderAt(s)
      const o = now[owner]
      // Where the ball sits at his feet, a step ahead of him.
      const ahead = (p: Spot, f: number) => [p.x + Math.sin(f) * 0.7, p.z + Math.cos(f) * 0.7]
      const [tx, tz] = ahead(o, facing[owner])
      if (u < 1) {
        passer = holderAt(s - 1)
        kick = Math.min(1, u / 0.35)
        const [sx, sz] = ahead(now[passer], facing[passer])
        const lofted = hash(s) > 0.7
        bx = sx + (tx - sx) * u
        bz = sz + (tz - sz) * u
        by = 0.25 + Math.sin(u * Math.PI) * (lofted ? 3 : 0.4)
        if (lofted && u > 0.6) {
          // A long ball: the receiver goes up to head it down.
          header = owner
          jump = Math.sin(((u - 0.6) / 0.4) * Math.PI)
          by = Math.max(by, 2.0 * jump)
        }
      } else {
        bx = tx
        bz = tz
      }
    }
    if (ball.current) {
      // The ball spins as it rolls.
      const dx = bx - lastBall.x
      const dz = bz - lastBall.z
      if (Math.abs(dx) + Math.abs(dz) < 10) {
        ball.current.rotation.x += dz / 0.35
        ball.current.rotation.z -= dx / 0.35
      }
      lastBall.set(bx, by, bz)
      ball.current.position.set(bx, by + 0.7, bz)
    }

    const { base, tilt, local, out, hand, q, r, rz, v, s: sc, up, x: ax, z: az, one } = tmp
    const hs = goals.filter((g) => g.team === -1 && g.at <= k).length
    const as = goals.filter((g) => g.team === 1 && g.at <= k).length
    let cardAt: THREE.Vector3 | null = null
    const scorer = last && playing && k - last.at < 0.12 ? shooterOf(last) : -1
    for (let i = 0; i < N; i++) {
      const p = now[i]
      const b = before[i]
      const side = i < 11 ? -1 : i < 22 ? 1 : i === COACH[0] ? -1 : i === COACH[1] ? 1 : 0
      const speed = Math.hypot(p.x - b.x, p.z - b.z) / 0.15
      // Face where they're going when running; otherwise the ball, the main stand before the match, the pitch for the coaches.
      const want = speed > 0.8 ? Math.atan2(p.x - b.x, p.z - b.z) : !playing || side === 0 || i >= 23 ? 0 : Math.atan2(bx - p.x, bz - p.z)
      let d = want - facing[i]
      d = Math.atan2(Math.sin(d), Math.cos(d))
      facing[i] += d * 0.15
      const stride = Math.min(1, speed / 6)
      const phase = t * (6 + speed * 1.2) + i
      const leg = Math.sin(phase) * 0.9 * stride
      const a = still(act)
      a.legL = leg
      a.legR = -leg
      a.armL = -leg * 0.8
      a.armR = leg * 0.8
      a.lean = 0.14 * stride
      a.lift = Math.abs(Math.sin(phase)) * 0.08 * stride
      const style = Math.floor(hash(i * 7 + e.start) * 3)
      const beat = Math.sin(t * 7 + i)

      if (k < 0 && i < 22) {
        if (k >= -4) {
          if (k >= -2.5 && k < -1) {
            // The anthem: a hand on the heart.
            a.armR = 1.3
            a.outR = -0.6
          } else if (hash(i) > 0.45) {
            // Waving up at the stands.
            a.armR = Math.PI * 0.85
            a.outR = 0.3 + Math.sin(t * 8 + i) * 0.35
          }
        } else if (speed < 0.8) {
          // The warm-up: knees up on the spot.
          a.legL = Math.max(0, Math.sin(t * 9 + i)) * 1.3
          a.legR = Math.max(0, -Math.sin(t * 9 + i)) * 1.3
          a.lift = 0.1
        }
      }
      if (i === passer && kick < 1) {
        // The pass: the kicking leg back, then through the ball; the other arm out for balance.
        a.legR = -0.9 + 2.0 * Math.sin(kick * Math.PI * 0.5)
        a.legL = 0.15
        a.armL = 0.5
        a.outL = 0.7
        a.lean = -0.08
      }
      if (i === header) {
        a.lift = jump * 0.9
        a.legL = a.legR = -0.5 * jump
        a.outL = a.outR = 1.1 * jump
        a.lean = -0.2 * jump
      }
      if (i === shooter && shotU < 0.3) {
        // The shot: the full swing of the leg.
        const u = shotU / 0.3
        a.legR = -1.3 + 2.8 * Math.sin(u * Math.PI * 0.5)
        a.legL = 0.2
        a.outL = a.outR = 0.9
        a.lean = -0.25
      }
      if (next && i === keeperFacing(next.team) && shooter >= 0 && shotU > 0.35) {
        // The keeper flies across his goal… too late.
        const u = Math.min(1, (shotU - 0.35) / 0.5)
        a.roll = (hash(next.at) > 0.5 ? 1 : -1) * 1.45 * ease(u)
        a.lift = Math.sin(u * Math.PI) * 1.0 - 0.8 * ease(u)
        a.armL = a.armR = Math.PI * 0.9
        a.legL = a.legR = 0
      }
      if (last && playing && k - last.at < PARTY) {
        const since = k - last.at
        if (i === keeperFacing(last.team)) {
          if (since < 0.25) {
            // Beaten: flat on the grass…
            a.roll = (hash(last.at) > 0.5 ? 1 : -1) * 1.45
            a.lift = -0.8
            a.armL = a.armR = Math.PI * 0.9
            a.legL = a.legR = 0
          } else {
            // …then on his knees, hands on his head.
            a.lift = -0.5
            a.legL = a.legR = -1.5
            a.armL = a.armR = Math.PI * 0.8
            a.outL = a.outR = -0.5
            a.lean = 0.1
          }
        } else if (i === scorer) {
          // The scorer slides on his knees towards the corner, arms wide.
          a.lift = -0.5
          a.legL = a.legR = -1.5
          a.outL = a.outR = 2.3
          a.armL = a.armR = 0
          a.lean = -0.35
        } else if (p.party) {
          if (style === 0) {
            a.armL = a.armR = Math.PI * 0.95
            a.lift = Math.max(0, Math.sin(t * 9 + i)) * 0.6
          } else if (style === 1) {
            // Coupé-décalé: shoulders rolling, one arm up then the other.
            a.roll = beat * 0.25
            a.armL = beat > 0 ? Math.PI * 0.9 : 0.4
            a.armR = beat > 0 ? 0.4 : Math.PI * 0.9
            a.legL = Math.max(0, beat) * 0.6
            a.legR = Math.max(0, -beat) * 0.6
          } else {
            // The aeroplane, banking.
            a.outL = a.outR = Math.PI / 2
            a.armL = a.armR = 0
            a.roll = Math.sin(t * 2 + i) * 0.35
          }
        } else if (side === -last.team && i % 11 !== 0) {
          // The other side: heads down, hands on hips.
          a.lean = 0.3
          a.outL = a.outR = 0.5
          a.armL = a.armR = -0.3
        }
      }
      if (k >= FULL && i < 22) {
        const won = hs === as ? 0 : hs > as ? -1 : 1
        if (p.party) {
          // The final whistle: the winners dance in the middle.
          a.roll = beat * 0.25
          a.armL = beat > 0 ? Math.PI * 0.9 : 0.4
          a.armR = beat > 0 ? 0.4 : Math.PI * 0.9
          a.lift = Math.max(0, Math.sin(t * 9 + i)) * 0.4
        } else if (won !== 0 && side === -won) {
          // The losers sit down on the grass.
          a.lift = -0.62
          a.legL = a.legR = 1.45
          a.armL = a.armR = -0.5
          a.lean = -0.25
        } else if (won === 0) {
          // A draw: everyone claps the crowd.
          a.armL = a.armR = 1.3
          a.outL = a.outR = -0.35 + Math.max(0, Math.sin(t * 12 + i)) * 0.3
        }
      }
      if (foul && i === victim) {
        // Down, rolling and holding his leg; then up again.
        const u = (k - foul.at) / FOUL
        const down = u < 0.6 ? 1 : 1 - ease((u - 0.6) / 0.3)
        a.roll = (1.45 + Math.sin(t * 6) * 0.15) * down
        a.lift = -0.8 * down
        a.legL = 1.2 * down
        a.armL = a.armR = 1.2 * down
      }
      if (foul && i === fouler) {
        // « Il a plongé ! »: arms out, palms up.
        a.outL = a.outR = 0.9 + Math.sin(t * 5) * 0.15
        a.armL = a.armR = 0.5
        a.lean = -0.1
      }
      if (i === REF) {
        if (foul) {
          const u = (k - foul.at) / FOUL
          const spot = now[victim]
          if (spot) {
            // He runs over, then holds up the card.
            const w = ease(u * 3)
            p.x += (spot.x + 2 - p.x) * w
            p.z += (spot.z + 2 - p.z) * w
          }
          if (u > 0.3 && u < 0.85) {
            a.armR = Math.PI
            a.outR = 0.1
          }
        } else if (last && playing && k - last.at < 0.5) {
          // The goal stands: he points to the centre spot.
          a.armR = Math.PI / 2
        } else if ((k >= 0 && k < 0.05) || (k >= 60 && k < 60.05) || (k >= 45 && k < 45.05) || (k >= FULL && k < FULL + 0.08)) {
          // The whistle: an arm up.
          a.armR = Math.PI
        }
      }
      if (i === COACH[0] || i === COACH[1]) {
        const recent = last && playing && k - last.at < PARTY
        if (recent && side === last.team) {
          a.armL = a.armR = Math.PI * 0.95
          a.lift = Math.max(0, Math.sin(t * 8)) * 0.5
        } else if (recent) {
          a.armL = a.armR = Math.PI * 0.8
          a.outL = a.outR = -0.5
        } else if (hash(Math.floor(t / 4) + i) > 0.5) {
          // Shouting at his players, pointing the way.
          a.armR = Math.PI / 2 + Math.sin(t * 2.3) * 0.5
          a.outR = 0.3
        }
      }

      // The body: where he stands, which way, then the tilt about the hips.
      base.compose(v.set(p.x, 0.7 + a.lift, p.z), q.setFromAxisAngle(up, facing[i]), one)
      tmp.e.set(a.lean, 0, a.roll)
      tilt.compose(v.set(0, 1, 0), r.setFromEuler(tmp.e), one)
      base.multiply(tilt)
      local.makeTranslation(0, -1, 0)
      base.multiply(local)
      PARTS.forEach((part, n) => {
        const mesh = parts.current[n]
        if (!mesh) return
        let swing = 0
        let outw = 0
        if (part.limb === 1) swing = a.legL
        if (part.limb === -1) swing = a.legR
        if (part.limb === 2) [swing, outw] = [a.armL, -a.outL]
        if (part.limb === -2) [swing, outw] = [a.armR, a.outR]
        // The pivot, the swing (out to the side, then forward), then the part hanging from it.
        rz.setFromAxisAngle(az, outw)
        r.setFromAxisAngle(ax, -swing)
        local.compose(v.set(part.p[0], part.p[1], part.p[2]), rz.multiply(r), one)
        out.multiplyMatrices(base, local)
        if (i === REF && part.limb === -2 && foul) {
          hand.set(0, -0.75, 0).applyMatrix4(out)
          cardAt = hand
        }
        local.compose(v.set(part.o[0], part.o[1], part.o[2]), r.identity(), sc.set(part.s[0], part.s[1], part.s[2]))
        out.multiply(local)
        mesh.setMatrixAt(i, out)
      })
    }
    for (const mesh of parts.current) if (mesh) mesh.instanceMatrix.needsUpdate = true
    // The card in the referee's hand: yellow, or red.
    if (card.current) {
      const shown = !!foul && (k - foul.at) / FOUL > 0.3 && (k - foul.at) / FOUL < 0.85 && cardAt
      card.current.visible = !!shown
      if (shown && cardAt) {
        card.current.position.copy(cardAt)
        ;(card.current.material as THREE.MeshBasicMaterial).color.set(foul.red ? '#e03131' : '#ffd43b')
      }
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
        <sphereGeometry args={[0.35, 12, 8]} />
        <meshLambertMaterial map={ballTex} emissive="#ffffff" emissiveIntensity={0.15} />
      </mesh>
      <mesh ref={card} visible={false}>
        <boxGeometry args={[0.32, 0.45, 0.04]} />
        <meshBasicMaterial color="#ffd43b" />
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
      <Dugouts home={e.home ?? ''} away={e.away ?? ''} />
    </>
  )
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
    const clock = k < 0 ? 'Bientôt' : k >= FULL ? 'Terminé' : k >= 45 && k < 60 ? 'Mi-temps' : `${Math.floor(k < 45 ? k : k - 15) + 1}'`
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
