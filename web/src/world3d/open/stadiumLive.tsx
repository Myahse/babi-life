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
  const players = useRef<THREE.InstancedMesh>(null)
  const ball = useRef<THREE.Mesh>(null)
  const beams = useRef<THREE.Group>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const here = useMemo(() => new THREE.Vector3(), [])

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
    if (cm) {
      paint(cm)
      let n = 0
      for (const f of fans) {
        if (f.fill > filled) continue
        const wave = Math.max(0, Math.cos(f.a - ola)) ** 12
        const jump = Math.max(0, Math.sin(t * (4 + hot * 6) + f.phase)) * 0.35 * hot + wave * 0.9
        q.setFromAxisAngle(up, -f.a + Math.PI / 2)
        m.compose(v.set(f.x, f.y + jump, f.z), q, one)
        cm.setMatrixAt(n++, m)
      }
      cm.count = n
      cm.instanceMatrix.needsUpdate = true
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
    // The match: the ball wanders the pitch; each player keeps his place, pulled towards it.
    const pl = players.current
    if (pl && match) {
      const k = now - e.start
      const playing = k >= 0 && k < 120 && !(k >= 45 && k < 60)
      const bx = playing ? Math.sin(t * 0.21) * 38 + Math.sin(t * 0.53) * 10 : 0
      const bz = playing ? Math.sin(t * 0.17 + 1) * 22 + Math.cos(t * 0.41) * 6 : 0
      ball.current?.position.set(bx, 1.0, bz)
      const half = k >= 60 ? -1 : 1
      for (let i = 0; i < 22; i++) {
        const side = i < 11 ? -1 : 1
        const j = i % 11
        // A 4-4-2: the keeper, the backs, the midfield, the strikers.
        const [fx, fz] = j === 0 ? [-48, 0] : j < 5 ? [-30, -24 + (j - 1) * 16] : j < 9 ? [-8, -24 + (j - 5) * 16] : [12, j === 9 ? -8 : 8]
        const pull = j === 0 ? 0.05 : 0.35
        const hx = fx * side * half
        const x = playing ? hx + (bx - hx) * pull + Math.sin(t * 1.3 + i) * 1.5 : (side * half * (6 + j * 2.5))
        const z = playing ? fz + (bz - fz) * pull + Math.cos(t * 1.1 + i) * 1.5 : -30
        m.compose(v.set(x, 1.5, z), q.setFromAxisAngle(up, Math.atan2(bx - x, bz - z)), one)
        pl.setMatrixAt(i, m)
      }
      pl.instanceMatrix.needsUpdate = true
    }
    // The concert lights sweeping.
    if (beams.current) beams.current.children.forEach((b, i) => (b.rotation.z = Math.sin(t * 1.2 + i * 1.7) * 0.6))
  })

  const teamMat = useMemo(() => new THREE.MeshLambertMaterial(), [])
  const screen = useMemo(() => (match ? null : lettering((e.artist ?? '').toUpperCase(), '#141416', '#ffd43b', '#ff7a00')), [match, e.artist])
  return (
    <group ref={g}>
      <instancedMesh ref={crowd} args={[undefined, undefined, FANS]} frustumCulled={false}>
        <boxGeometry args={[0.55, 1.0, 0.4]} />
        <meshLambertMaterial />
      </instancedMesh>
      {match ? (
        <>
          <instancedMesh
            ref={(x) => {
              players.current = x
              if (x && !x.userData.painted) {
                const c = new THREE.Color()
                for (let i = 0; i < 22; i++) x.setColorAt(i, c.set(colorsOf(i < 11 ? e.home : e.away)[i % 11 === 0 ? 1 : 0]))
                x.userData.painted = true
              }
            }}
            args={[undefined, teamMat, 22]}
            frustumCulled={false}
          >
            <boxGeometry args={[0.7, 1.8, 0.45]} />
          </instancedMesh>
          <mesh ref={ball}>
            <sphereGeometry args={[0.4, 10, 8]} />
            <meshLambertMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
          </mesh>
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
