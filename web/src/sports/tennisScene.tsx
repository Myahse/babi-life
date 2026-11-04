import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { rng } from '../world3d/themes'
import { Blob } from '../streetball/looks'
import { dropGazeTarget, gazeTarget } from '../avatar/expressions'
import { BALL_R, DW, HL, HW, POST_X, SERVICE, netH, type Tennis } from './tennis'
import { BOX, Banner, Floodlight, Palm, Stand, flat, grain } from './scenery'
import { replayCam } from './tape'

// The tennis court, at the real size (tennis.ts): the clay's red earth or the hard court's blue in its green
// surround, the lines (the baselines 10 cm, the others 5 cm), the net strung between its posts with the strap
// at the middle, the green windscreens round the back, the umpire on the high chair, the ball kids crouched
// at the net, the stands, the floodlights; at the Hôtel Ivoire its tower behind, at the club its palms and its
// club house. The players with their rackets, the ball and its shade, the mark the ball leaves on clay. The
// camera behind the player's end as on TV (higher and further back on a phone held upright).

const white = flat('#f8f9fa')
const LINE = 0.05

function Line({ a, b, w = LINE }: { a: [number, number]; b: [number, number]; w?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return <mesh geometry={BOX} material={white} position={[(a[0] + b[0]) / 2, 0.012, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]} scale={[len + (w > LINE ? 0 : w), 0.004, w]} />
}

/** The net: the mesh hanging from the cable (lower at the strap), the white tape, the posts, the strap. */
function NetMesh() {
  const geo = useMemo(() => {
    const n = 24
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= n; i++) {
      const x = -POST_X + (2 * POST_X * i) / n
      const top = netH(x) - 0.03
      pos.push(x, top, 0, x, 0.03, 0)
      uv.push(i / n, 1, i / n, 0)
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')!
    x.strokeStyle = 'rgba(20,20,24,0.9)'
    x.lineWidth = 3
    for (let k = 0; k <= 64; k += 16) {
      x.beginPath()
      x.moveTo(k, 0)
      x.lineTo(k, 64)
      x.moveTo(0, k)
      x.lineTo(64, k)
      x.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(2 * POST_X * 22, 22)
    return t
  }, [])
  const tape = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 24; i++) {
      const x = -POST_X + (2 * POST_X * i) / 24
      pts.push(new THREE.Vector3(x, netH(x) - 0.025, 0))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.03, 4)
  }, [])
  return (
    <group>
      <mesh geometry={geo}>
        <meshLambertMaterial map={tex} transparent alphaTest={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={tape} material={white} />
      {/* The strap at the centre, pulling it down to 0,914 m. */}
      <mesh geometry={BOX} material={white} position={[0, 0.46, 0]} scale={[0.05, 0.9, 0.02]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={flat('#2b5f3a')} position={[s * POST_X, 0.54, 0]} scale={[0.1, 1.08, 0.1]} castShadow />
      ))}
    </group>
  )
}

/** The umpire's high chair at the net post, the umpire on it. */
function Umpire({ g }: { g: Tennis }) {
  const look = useMemo(() => ({ ...randomLook('homme', rng('umpire')), outfit: 'chemise', outfitColor: '#f8f9fa' }) as Look, [])
  return (
    <group position={[-(POST_X + 1.4), 0, 0]}>
      {[-0.35, 0.35].map((z) => [-0.35, 0.35].map((x) => <mesh key={`${x}${z}`} geometry={BOX} material={flat('#2b5f3a')} position={[x, 0.9, z]} scale={[0.07, 1.8, 0.07]} />))}
      <mesh geometry={BOX} material={flat('#2b5f3a')} position={[0, 1.82, 0]} scale={[0.9, 0.06, 0.9]} />
      <mesh geometry={BOX} material={flat('#2b5f3a')} position={[-0.42, 2.25, 0]} scale={[0.06, 0.8, 0.9]} />
      <group position={[0, 1.42, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Human look={look} gender="homme" pose="sit" seed={3} faceId={`tennis-umpire-${g.rules.surface}`} />
      </group>
    </group>
  )
}

/** Two ball kids crouched at the net posts, one at each end later. */
function BallKids() {
  const kids = useMemo(() => [0, 1].map((i) => ({ ...randomLook(i ? 'femme' : 'homme', rng(`kid-${i}`)), outfit: 'jersey', outfitColor: '#1d4ed8' }) as Look), [])
  return (
    <>
      {[1, -1].map((s, i) => (
        <group key={s} position={[POST_X + 0.9, 0, s * 0.8]} rotation={[0, -Math.PI / 2, 0]} scale={[0.82, 0.82, 0.82]}>
          <Human look={kids[i]} gender={i ? 'femme' : 'homme'} pose="mark" seed={i * 5 + 2} />
        </group>
      ))}
    </>
  )
}

export type Venue = 'ivoire' | 'club' | 'plateau'

/** The court and all round it. */
export function TennisGround({ g, venue }: { g: Tennis; venue: Venue }) {
  const clay = g.rules.surface === 'clay'
  const surf = useMemo(() => (clay ? grain('clay', '#c1532c', ['#b34b26', '#cc6236', '#a8441f', '#d46c40'], 5000, 256, [10, 20]) : grain('hard', '#2c5aa0', ['#2a559a', '#3062a8', '#27508f'], 2500, 256, [10, 20])), [clay])
  const out = useMemo(() => (clay ? grain('clay-out', '#b84f2a', ['#a9461f', '#c35a31', '#9e4220'], 5000, 256, [16, 24]) : grain('hard-out', '#3f7d4f', ['#3b764b', '#448554', '#377047'], 2500, 256, [16, 24])), [clay])
  const fx = DW + 3.66
  const fz = HL + 6.4
  return (
    <group>
      {/* The surround, the court inside it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[fx * 2, fz * 2]} />
        <meshLambertMaterial map={out} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[DW * 2 + 0.2, HL * 2 + 0.2]} />
        <meshLambertMaterial map={surf} />
      </mesh>
      {/* The land beyond the fences. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshLambertMaterial color={venue === 'plateau' ? '#8f8a82' : '#5b8f3e'} />
      </mesh>
      {/* The lines: baselines, both side lines, the service lines, the centre service line and the centre marks. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Line a={[-DW, s * HL]} b={[DW, s * HL]} w={0.1} />
          <Line a={[-HW, s * SERVICE]} b={[HW, s * SERVICE]} />
          <Line a={[0, s * (HL - 0.05)]} b={[0, s * (HL - 0.15)]} />
          <Line a={[s * DW, -HL]} b={[s * DW, HL]} />
          <Line a={[s * HW, -HL]} b={[s * HW, HL]} />
        </group>
      ))}
      <Line a={[0, -SERVICE]} b={[0, SERVICE]} />
      <NetMesh />
      {/* The windscreens: green cloth on the fence, behind the baselines and down the sides. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={BOX} material={flat('#1e4d2b')} position={[0, 1.3, s * fz]} scale={[fx * 2, 2.6, 0.06]} />
          <mesh geometry={BOX} material={flat('#1e4d2b')} position={[s * fx, 1.3, 0]} scale={[0.06, 2.6, fz * 2]} />
          <Banner at={[0, s * (fz - 0.05)]} w={9} h={0.8} y={1.6} text={venue === 'ivoire' ? 'HÔTEL IVOIRE' : venue === 'club' ? 'TENNIS CLUB DE COCODY' : 'PLATEAU TENNIS'} bg="#1e4d2b" rot={s > 0 ? Math.PI : 0} />
          <Floodlight at={[s * (fx + 0.6), -HL * 0.6]} face={s > 0 ? -Math.PI / 2 : Math.PI / 2} />
          <Floodlight at={[s * (fx + 0.6), HL * 0.6]} face={s > 0 ? -Math.PI / 2 : Math.PI / 2} />
        </group>
      ))}
      {/* The stands down the far side (the camera looks over the near one). */}
      <Stand at={[fx + 0.6, 0]} len={HL * 1.6} rot={Math.PI / 2} rows={6} seed={`tennis-${venue}`} color={venue === 'ivoire' ? '#a3a9b1' : '#8f6b4a'} />
      <Stand at={[-(fx + 0.6), -4]} len={HL * 0.9} rot={-Math.PI / 2} rows={4} fill={0.6} seed={`tennis-${venue}-2`} />
      {/* Benches by the umpire, with towels. */}
      {[-1.6, 1.6].map((z) => (
        <group key={z} position={[-(POST_X + 1.5), 0, z]}>
          <mesh geometry={BOX} material={flat('#e9ecef')} position={[0, 0.45, 0]} scale={[0.5, 0.06, 1.2]} />
          <mesh geometry={BOX} material={flat('#ff8200')} position={[0, 0.5, 0.2]} scale={[0.45, 0.04, 0.35]} />
        </group>
      ))}
      <Umpire g={g} />
      <BallKids />
      {venue === 'ivoire' && <IvoireTower />}
      {venue !== 'plateau' && Array.from({ length: 10 }, (_, i) => <Palm key={i} at={[(i % 2 ? 1 : -1) * (fx + 6 + (i % 3) * 3), -HL - 10 + i * 5.5]} h={7 + (i % 4)} seed={i} />)}
      {venue === 'plateau' && <Towers />}
      {venue === 'club' && <ClubHouse at={[0, -(fz + 9)]} />}
    </group>
  )
}

/** The Hôtel Ivoire's tower behind the far end, its windows in rows. */
function IvoireTower() {
  const tex = useMemo(() => grain('ivoire-win', '#cfd6dc', ['#3d6a8a', '#5d88a6', '#2f5673'], 900, 128, [6, 24]), [])
  return (
    <group position={[-20, 0, -75]}>
      <mesh position={[0, 50, 0]}>
        <boxGeometry args={[34, 100, 14]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      <mesh geometry={BOX} material={flat('#e9ecef')} position={[0, 101, 0]} scale={[36, 2, 16]} />
    </group>
  )
}

/** The Plateau's towers beyond the trees. */
function Towers() {
  const r = rng('plateau-towers')
  return (
    <group>
      {Array.from({ length: 9 }, (_, i) => {
        const h = 30 + r() * 60
        return <mesh key={i} geometry={BOX} material={flat(['#a6b1bb', '#c8ced4', '#7f8c99'][i % 3])} position={[-60 + i * 15, h / 2, -70 - r() * 30]} scale={[10 + r() * 6, h, 10]} />
      })}
    </group>
  )
}

function ClubHouse({ at }: { at: [number, number] }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh geometry={BOX} material={flat('#f1e3c6')} position={[0, 2, 0]} scale={[18, 4, 7]} castShadow />
      <mesh geometry={BOX} material={flat('#9c3d1f')} position={[0, 4.3, 0]} scale={[19, 0.6, 8]} />
      <mesh geometry={BOX} material={flat('#3d2b1f')} position={[0, 1.2, 3.52]} scale={[2.2, 2.4, 0.05]} />
    </group>
  )
}

/** A racket: the grip, the throat, the head's frame, the strings. Held at the fist, pointing down the forearm. */
function Racket({ color }: { color: string }) {
  return (
    <group rotation={[0, 0, 0]}>
      <mesh geometry={BOX} material={flat('#1b1b1f')} position={[0, -0.1, 0]} scale={[0.035, 0.2, 0.035]} />
      <mesh geometry={BOX} material={flat(color)} position={[0, -0.24, 0]} scale={[0.03, 0.1, 0.02]} />
      <mesh position={[0, -0.44, 0]} scale={[0.85, 1.1, 1]} material={flat(color)}>
        <torusGeometry args={[0.13, 0.012, 4, 18]} />
      </mesh>
      <mesh position={[0, -0.44, 0]} scale={[0.85 * 0.25, 1.1 * 0.25, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshLambertMaterial color="#f1f3f5" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const CLOCKED = new Set<Pose>(['forehand', 'backhand', 'volleyhit', 'serve'])

/** A player: its look in tennis whites (or its colours), its racket, its pose on the match's clock. */
export function TennisPlayer({ g, i, look, gender, color }: { g: Tennis; i: 0 | 1; look: Look; gender: 'femme' | 'homme'; color: string }) {
  const root = useRef<THREE.Group>(null)
  const mark = useRef<THREE.Group>(null)
  const [view, setView] = useState<{ pose: Pose; speed: number; take: number }>({ pose: 'idle', speed: 0, take: 0 })
  useFrame(() => {
    const p = g.ps[i]
    const r = root.current
    if (!r) return
    r.position.set(p.x, 0, p.z)
    r.rotation.y = p.face
    if (mark.current) mark.current.visible = i === g.me && !replayCam.on
    const speed = Math.round(Math.hypot(p.vx, p.vz))
    if (p.pose !== view.pose || speed !== view.speed || p.take !== view.take) setView({ pose: p.pose, speed, take: p.take })
  })
  const racket = useMemo(() => <Racket color={color} />, [color])
  return (
    <group ref={root}>
      <Blob size={1.1} />
      <Human look={look} gender={gender} faceId={`tennis-${i}`} pose={view.pose} seed={i * 7.3} speed={view.speed || undefined} take={view.take} clock={CLOCKED.has(view.pose) ? () => g.ps[i].at : undefined} hold={racket} />
      <group ref={mark}>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.58, 28]} />
          <meshBasicMaterial color="#ff8200" transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  )
}

/** The ball (drawn a little bigger so it's seen on a phone), its shade on the court, the clay's mark. */
export function TennisBall({ g }: { g: Tennis }) {
  const ball = useRef<THREE.Mesh>(null)
  const shade = useRef<THREE.Mesh>(null)
  const mark = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const clay = g.rules.surface === 'clay'
  // Every face on the court follows the ball.
  const seen = useMemo(() => gazeTarget('ball', 40, 2), [])
  useEffect(() => () => dropGazeTarget('ball'), [])
  useFrame(() => {
    const b = g.ball
    if (!ball.current || !shade.current) return
    // Bigger with the distance (a 6,7 cm ball is a dot from the far end).
    const d = camera.position.distanceTo(ball.current.position)
    const s = Math.max(1.5, d / 10)
    ball.current.position.set(b.x, Math.max(BALL_R * s * 0.6, b.y), b.z)
    ball.current.scale.setScalar(s)
    shade.current.position.set(b.x, 0.015, b.z)
    const k = Math.max(0.25, 1 - b.y / 4)
    shade.current.scale.set(s * k, s * k, 1)
    if (mark.current) {
      const m = g.mark
      mark.current.visible = !!m && (clay || m.out) && g.time - m.t < (clay ? 6 : 1.5)
      if (m) mark.current.position.set(m.x, 0.014, m.z)
    }
    seen.set(b.x, b.y, b.z)
  })
  return (
    <group>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_R, 12, 10]} />
        <meshLambertMaterial color="#dcf542" emissive="#3a4a00" />
      </mesh>
      <mesh ref={shade} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BALL_R * 1.4, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh ref={mark} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.9, 1]}>
        <circleGeometry args={[0.05, 14]} />
        <meshBasicMaterial color={clay ? '#8e3a18' : '#ffffff'} transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** The broadcast camera behind the player's end; a replay's low one by the net post. */
export function TennisCam({ g }: { g: Tennis }) {
  const { camera, size } = useThree()
  const at = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const first = useRef(true)
  useFrame((_, raw) => {
    // (The lab's film steps the match by a fixed amount per frame: the camera keeps the same pace.)
    const film = import.meta.env.DEV ? (globalThis as { sportsFilm?: { dt: number } }).sportsFilm : undefined
    const dt = film ? film.dt : raw
    const cam = camera as THREE.PerspectiveCamera
    const e = g.end[g.me]
    const me = g.ps[g.me]
    const up = size.height > size.width * 1.1
    let pos: THREE.Vector3
    let tgt: THREE.Vector3
    if (replayCam.on) {
      // Low by the side, at the far post's height, the ball in the middle.
      pos = new THREE.Vector3(POST_X + 4, 1.6, replayCam.z * 0.4)
      tgt = new THREE.Vector3(g.ball.x * 0.5, 1, g.ball.z * 0.7)
      cam.fov = 38
    } else {
      // Behind and above the baseline (phone upright: higher, steeper, wider), drifting a little with the player.
      const back = up ? HL + 10 : HL + 9.5
      const high = up ? 15 : 7.2
      pos = new THREE.Vector3(me.x * 0.35, high, e * back)
      tgt = new THREE.Vector3(me.x * 0.2, 0, e * (up ? 4 : 1.5))
      cam.fov = up ? 62 : 46
    }
    const k = first.current ? 1 : 1 - Math.exp(-(replayCam.on ? 6 : 3) * dt)
    first.current = false
    at.current.lerp(pos, k)
    look.current.lerp(tgt, k)
    cam.position.copy(at.current)
    cam.lookAt(look.current)
    cam.updateProjectionMatrix()
  })
  return null
}
