import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../../../avatar/Human'
import { randomLook } from '../../../avatar/options'
import { rng } from '../../../world3d/themes'
import { Vehicle, setVehicleNight } from '../../../world3d/vehicles'
import { holdScenes } from '../../../world3d/hold'
import type { Look } from '../../../lib/types'
import { poseOf, STAGE, type Fight, type FightEvent } from './engine'

// The street fight's street: a road of Treichville at night, the maquis and
// the cabine still open, the bulbs strung across, two street lamps on the
// fighters, the crowd round them, a woro-woro and a gbaka parked. The camera
// stands behind the player at an angle (the phone is upright: the fight goes
// into the screen), pulls back as the fighters part, shakes and lunges in on
// the big blows, drops low for a Super and closes in on a K.O. The road is wet:
// the neon and the lamps shine in it. Each blow lands with a flash, a shock
// ring and its damage flying off; the big swings leave a trail, a fall raises dust.

export type FighterLook = { look: Look; gender: 'femme' | 'homme'; seed: number }

type Props = {
  F: React.RefObject<Fight>
  looks: [FighterLook, FighterLook]
  /** Steps the fight (the pads, the engine) and returns what happened this frame. */
  onFrame: (dt: number) => FightEvent[]
  /** The baby fight (« bagarre-bebe »): the bedroom, the family round, the fighters with a baby's big head. */
  baby?: boolean
}

export function FightCanvas({ F, looks, onFrame, baby }: Props) {
  // The world underneath holds still while the fight is on.
  const release = useRef<(() => void) | null>(null)
  useEffect(() => () => release.current?.(), [])
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 42, near: 0.2, far: 120, position: [-4, 2, 4] }} gl={{ antialias: true }} onCreated={({ gl }) => void (release.current = holdScenes(gl.domElement))}>
      <color attach="background" args={[baby ? '#3a2a4a' : '#0f0b22']} />
      <fog attach="fog" args={[baby ? '#3a2a4a' : '#0f0b22', 16, 42]} />
      <World F={F} looks={looks} onFrame={onFrame} baby={baby} />
    </Canvas>
  )
}

function World({ F, looks, onFrame, baby }: Props) {
  const fx = useRef<FightEvent[]>([])
  const dust = useRef<FightEvent[]>([])
  const trails = useRef<FightEvent[]>([])
  const shake = useRef(0)
  const punch = useRef(0)
  const cheer = useRef(0)
  // The fight is stepped first each frame; what happened goes to the sparks, the camera and the crowd.
  useFrame((_, dt) => {
    const evs = onFrame(dt)
    for (const e of evs) {
      if (e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw' || e.kind === 'block') fx.current.push(e)
      if (e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw') shake.current = Math.max(shake.current, e.heavy ? 0.16 : 0.06)
      // The camera lunges in on a big one.
      if ((e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw') && e.heavy) punch.current = 1
      if (e.kind === 'land') dust.current.push(e)
      if (e.kind === 'swing' && e.heavy) trails.current.push(e)
      if ((e.kind === 'hit' && e.heavy) || e.kind === 'ko' || e.kind === 'throw' || e.kind === 'super') cheer.current = 1.6
      if (e.kind === 'land' && e.heavy) shake.current = Math.max(shake.current, 0.08)
    }
    cheer.current = Math.max(0, cheer.current - dt)
  }, -1)
  return (
    <>
      <CameraRig F={F} shake={shake} punch={punch} />
      <Lights F={F} />
      {baby ? <Bedroom /> : <Street />}
      <Crowd cheer={cheer} family={baby} />
      <FighterView F={F} i={0} who={looks[0]} baby={baby} />
      <FighterView F={F} i={1} who={looks[1]} baby={baby} />
      <Sparks fx={fx} />
      <Dust fx={dust} />
      <Trails F={F} fx={trails} />
    </>
  )
}

/* ---------- The camera ---------- */

function CameraRig({ F, shake, punch }: { F: React.RefObject<Fight>; shake: React.RefObject<number>; punch: React.MutableRefObject<number> }) {
  const { camera } = useThree()
  const at = useRef(new THREE.Vector3(0, 1, 0))
  const side = useRef(-1)
  useFrame((_, dt) => {
    const fight = F.current
    if (!fight) return
    const [me, them] = fight.f
    // Behind the player: on its side of the other one (swinging round if they change sides).
    const want = me.x <= them.x ? -1 : 1
    side.current += (want - side.current) * Math.min(1, dt * 3)
    const mid = (me.x + them.x) / 2
    const gap = Math.abs(me.x - them.x)
    // A K.O.: in close on the one going down.
    const ko = fight.phase === 'ko' && fight.slow > 0
    const loser = fight.roundWinner === 0 ? them : me
    const tx = ko ? loser.x : Math.max(-STAGE + 1.2, Math.min(STAGE - 1.2, mid))
    // Far enough for both, a body's width each side, across an upright screen.
    const a = (60 * Math.PI) / 180
    const cam = camera as THREE.PerspectiveCamera
    const across = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect
    // A Super: in close and low, looking up at the one throwing it.
    const sup = fight.flash > 0
    // A big blow: the camera lunges in a little, then eases back.
    punch.current = Math.max(0, punch.current - dt * 3)
    const dist = (ko ? 4.4 : sup ? 4.8 : Math.max(5.8, Math.min(15, ((gap * Math.sin(a)) / 2 + 0.9) / across))) * (1 - 0.12 * punch.current)
    const k = Math.min(1, dt * (ko ? 2.5 : sup ? 3 : 4))
    // Looking a little low, so the fighters stand between the bars and the pad.
    at.current.lerp(new THREE.Vector3(tx, ko ? 0.5 : sup ? 1.2 : 0.95 - dist * 0.07, 0), k)
    // A slow drift round the fight, so the street never stands quite still.
    const drift = Math.sin(fight.time * 0.35) * 0.08
    const aa = a + drift
    const pos = new THREE.Vector3(at.current.x + side.current * Math.cos(aa) * dist, sup ? 0.7 : 1.6 + dist * 0.13, Math.sin(aa) * dist)
    camera.position.lerp(pos, k)
    // The shake of a big blow, dying away.
    const s = shake.current ?? 0
    if (s > 0) {
      camera.position.x += (Math.random() - 0.5) * s
      camera.position.y += (Math.random() - 0.5) * s
      shake.current = Math.max(0, s - dt * 0.9)
    }
    camera.lookAt(at.current)
  })
  return null
}

/* ---------- The lights ---------- */

function Lights({ F }: { F: React.RefObject<Fight> }) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const glow = useRef<THREE.PointLight>(null)
  const lamp = useRef<THREE.SpotLight>(null)
  useEffect(() => {
    if (lamp.current) lamp.current.target.position.set(0, 0, 0.3)
    lamp.current?.target.updateMatrixWorld()
  }, [])
  useFrame(() => {
    const fight = F.current
    if (!fight) return
    // The Super's flash: the street goes dark, the fighter glows pink.
    const fl = Math.min(1, fight.flash / 0.4)
    if (hemi.current) hemi.current.intensity = 0.9 * (1 - fl * 0.8)
    if (glow.current) {
      const who = fight.f.find((f) => f.act === 'attack' && f.move === 'super')
      glow.current.intensity = who ? 14 + fl * 30 : 0
      if (who) glow.current.position.set(who.x, 1.3 + who.y, 0.6)
    }
  })
  return (
    <>
      <hemisphereLight ref={hemi} args={['#8f86ff', '#3a2416', 0.9]} />
      <ambientLight intensity={0.18} />
      {/* From the crowd's side: the fighters' faces lit. */}
      <directionalLight position={[0, 5, 9]} intensity={1.3} color="#ffe2c2" />
      {/* The two street lamps over the fight: warm, the near one casting the shadows. */}
      <spotLight ref={lamp} position={[-3.4, 6.2, -3.2]} angle={0.75} penumbra={0.6} intensity={95} decay={1.6} distance={26} color="#ffcf8a" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <spotLight position={[3.6, 6.2, -3.2]} angle={0.75} penumbra={0.6} intensity={70} decay={1.6} distance={26} color="#ffd9a0" />
      {/* The maquis's neon, pink on the street. */}
      <pointLight position={[-1.5, 3.2, -4.6]} intensity={9} distance={12} decay={1.5} color="#ff4f9a" />
      <pointLight position={[4.8, 3, -4.6]} intensity={6} distance={10} decay={1.5} color="#38d9a9" />
      <pointLight ref={glow} position={[0, 1.3, 0.6]} intensity={0} distance={7} decay={1.4} color="#ff3d7f" />
    </>
  )
}

/* ---------- The street ---------- */

/** A façade's windows: a grid, some lit (warm), some dark, some blue with a television. */
function windows(seed: string, cols: number, rows: number) {
  const r = rng(seed)
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 256, 256)
  const w = 256 / cols
  const h = 256 / rows
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const k = r()
      g.fillStyle = k < 0.45 ? '#ffcf70' : k < 0.55 ? '#7fb6ff' : '#0a0a12'
      g.fillRect(x * w + w * 0.22, y * h + h * 0.2, w * 0.56, h * 0.55)
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A sign over a door: its words lit on a coloured board. */
function sign(text: string, bg: string, fg: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = fg
  g.font = "900 64px 'Baloo 2', Impact, sans-serif"
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 68, 480)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The puddles on the road: where, how big. */
const PUDDLES: [number, number, number][] = [
  [-4.6, 1.2, 1.1],
  [3.9, 1.8, 0.8],
  [-1.2, -2.4, 0.9],
  [6.2, -1.2, 1.2],
]

const FACADES: { x: number; w: number; h: number; color: string; cols: number; rows: number }[] = [
  { x: -11, w: 4.6, h: 8, color: '#5b4a7a', cols: 4, rows: 4 },
  { x: -6.6, w: 4.2, h: 6, color: '#7a5240', cols: 3, rows: 3 },
  { x: -2.2, w: 4.6, h: 7.2, color: '#3f5d6e', cols: 4, rows: 4 },
  { x: 2.4, w: 4.4, h: 5.4, color: '#6e4a5c', cols: 3, rows: 2 },
  { x: 6.8, w: 4.4, h: 8.6, color: '#46506e', cols: 4, rows: 5 },
  { x: 11.2, w: 4.4, h: 6.4, color: '#6b5a3a', cols: 3, rows: 3 },
]

function Street() {
  const mats = useMemo(
    () =>
      FACADES.map((f, i) => {
        const tex = windows(`fac${i}`, f.cols, f.rows)
        return new THREE.MeshLambertMaterial({ color: f.color, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9 })
      }),
    [],
  )
  const signs = useMemo(
    () => ({
      maquis: new THREE.MeshBasicMaterial({ map: sign('MAQUIS CHEZ TANTIE', '#ff2d87', '#fff6c2') }),
      cabine: new THREE.MeshBasicMaterial({ map: sign('CABINE · TRANSFERT', '#ff7a00', '#ffffff') }),
      salle: new THREE.MeshBasicMaterial({ map: sign('SALLE DE JEUX', '#1b9e77', '#ffffff') }),
    }),
    [],
  )
  // The bulbs strung across the street, sagging between their poles.
  const bulbs = useMemo(() => {
    const out: { p: [number, number, number]; c: string }[] = []
    const cols = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#ff922b']
    for (const z of [-3.4, 2.6])
      for (let k = 0; k <= 22; k++) {
        const u = k / 22
        out.push({ p: [-9 + u * 18, 5.2 - Math.sin(u * Math.PI) * 0.9, z], c: cols[k % cols.length] })
      }
    return out
  }, [])
  useEffect(() => {
    setVehicleNight(true)
    return () => setVehicleNight(false)
  }, [])
  return (
    <group>
      {/* The road, the red earth by the gutters, the pavement. */}
      {/* Wet from the evening's rain: the lamps and the neon shine in it, more in the puddles. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#34333a" roughness={0.42} metalness={0.25} />
      </mesh>
      {PUDDLES.map(([x, z, r], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, z]} scale={[r, r * 0.6, 1]} receiveShadow>
          <circleGeometry args={[1, 24]} />
          <meshStandardMaterial color="#3a3a48" roughness={0.12} metalness={0.35} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -3.9]} receiveShadow>
        <planeGeometry args={[60, 1.4]} />
        <meshLambertMaterial color="#8a4b2a" />
      </mesh>
      <mesh position={[0, 0.09, -5.2]} receiveShadow>
        <boxGeometry args={[60, 0.18, 1.6]} />
        <meshLambertMaterial color="#77736c" />
      </mesh>
      {/* The chalk ring where the fight is, worn by the feet. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[STAGE + 0.15, STAGE + 0.3, 64, 1]} />
        <meshBasicMaterial color="#d8d2c4" transparent opacity={0.45} />
      </mesh>
      {/* The buildings, their windows lit. */}
      {FACADES.map((f, i) => (
        <mesh key={i} position={[f.x, f.h / 2, -7.6]} material={mats[i]} receiveShadow>
          <boxGeometry args={[f.w, f.h, 3]} />
        </mesh>
      ))}
      {/* Tin awnings over the shops. */}
      {[-6.6, -2.2, 2.4].map((x) => (
        <mesh key={x} position={[x, 2.9, -5.7]} rotation={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[4, 0.06, 1.4]} />
          <meshLambertMaterial color="#9aa1a8" />
        </mesh>
      ))}
      <mesh position={[-2.2, 3.55, -6.08]} material={signs.maquis}>
        <planeGeometry args={[4, 1]} />
      </mesh>
      <mesh position={[2.4, 3.4, -6.08]} material={signs.cabine}>
        <planeGeometry args={[3.8, 0.95]} />
      </mesh>
      <mesh position={[-6.6, 3.45, -6.08]} material={signs.salle}>
        <planeGeometry args={[3.6, 0.9]} />
      </mesh>
      {/* The street lamps. */}
      {[-3.4, 3.6].map((x) => (
        <group key={x} position={[x, 0, -4.4]}>
          <mesh position={[0, 3.1, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.09, 6.2, 8]} />
            <meshLambertMaterial color="#40444b" />
          </mesh>
          <mesh position={[0, 6.15, 0.55]}>
            <boxGeometry args={[0.45, 0.14, 0.7]} />
            <meshBasicMaterial color="#fff1c9" />
          </mesh>
        </group>
      ))}
      {bulbs.map((b, i) => (
        <mesh key={i} position={b.p}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial color={b.c} />
        </mesh>
      ))}
      <Vehicle p={[-10.5, 0, -2.6]} r={0.25} kind="woro" seed={3} />
      <Vehicle p={[10.8, 0, -3.1]} r={-0.3} kind="gbaka" seed={8} crew={false} />
    </group>
  )
}

/* ---------- The crowd ---------- */

/** The baby fight's room (also in the baby video, lab/bebeFilm.tsx): the tiled floor, the walls painted, the mats where they fight, the cot, the toys all about, the lamp. */
export function Bedroom() {
  return (
    <group>
      <ambientLight intensity={0.55} color="#ffe8cc" />
      <pointLight position={[0, 4.2, 1.5]} intensity={18} distance={14} color="#fff1d6" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 14]} />
        <meshLambertMaterial color="#e9dcc3" />
      </mesh>
      <mesh position={[0, 2.6, -4.2]}>
        <boxGeometry args={[24, 5.2, 0.1]} />
        <meshLambertMaterial color="#ffd8a8" />
      </mesh>
      <mesh position={[0, 0.6, -4.12]}>
        <boxGeometry args={[24, 1.2, 0.04]} />
        <meshLambertMaterial color="#74c0fc" />
      </mesh>
      {/* The mats, side by side across the floor: the ring */}
      {['#ff8fb1', '#8ce99a', '#ffd43b', '#74c0fc', '#b197fc'].map((c, k) => (
        <mesh key={c} position={[-6 + k * 3, 0.02, 0.3]} receiveShadow>
          <boxGeometry args={[3, 0.04, 3]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
      {/* The cot against the wall, its bars */}
      <group position={[-4.5, 0, -3.4]}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[1.8, 0.08, 0.9]} />
          <meshLambertMaterial color="#f8f9fa" />
        </mesh>
        {[...Array(10)].map((_, k) => (
          <mesh key={k} position={[-0.85 + k * 0.19, 0.95, 0.42]}>
            <boxGeometry args={[0.04, 0.6, 0.04]} />
            <meshLambertMaterial color="#f1f3f5" />
          </mesh>
        ))}
      </group>
      {/* The toy everyone wants, and the cubes knocked over */}
      <mesh position={[3.6, 0.35, -3.2]}>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshLambertMaterial color="#ff6b6b" />
      </mesh>
      {['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc'].map((c, k) => (
        <mesh key={c} position={[5 + (k % 3) * 0.4, 0.15 + Math.floor(k / 3) * 0.3, -2.8 + k * 0.1]} rotation={[0, k * 0.5, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
    </group>
  )
}

const SPOTS: [number, number, number][] = [
  [-6.4, -1.6, 0.9],
  [-6.6, 0.4, 1.4],
  [-5.4, -2.6, 0.5],
  [-3.6, -3.0, 0.1],
  [-1.6, -3.2, 0],
  [0.6, -3.1, 0],
  [2.6, -3.2, -0.1],
  [4.4, -2.8, -0.4],
  [6.0, -2.0, -0.8],
  [6.6, 0.2, -1.3],
]

function Crowd({ cheer, family }: { cheer: React.RefObject<number>; /** The baby fight: the family round, in pagne and boubou, more mamans than papas. */ family?: boolean }) {
  const people = useMemo(
    () =>
      SPOTS.map((p, i) => {
        const gender = (family ? i % 3 !== 1 : i % 3 === 1) ? 'femme' : 'homme'
        const look = randomLook(gender, rng(`crowd${i}`))
        return { p, gender: gender as 'femme' | 'homme', look: family ? { ...look, outfit: gender === 'femme' ? 'pagne' : 'boubou', accessory: 'none' } : look, seed: i * 13 }
      }),
    [family],
  )
  const [loud, setLoud] = useState(false)
  useFrame(() => {
    const on = (cheer.current ?? 0) > 0
    if (on !== loud) setLoud(on)
  })
  return (
    <>
      {people.map((x, i) => (
        <group key={i} position={[x.p[0], 0, x.p[1]]} rotation={[0, x.p[2], 0]}>
          <Human look={x.look} gender={x.gender} pose={loud ? 'cheer' : i % 4 === 0 ? 'dance' : i % 4 === 2 ? 'clap' : 'idle'} seed={x.seed} />
        </group>
      ))}
    </>
  )
}

/* ---------- The fighters ---------- */

function FighterView({ F, i, who, baby }: { F: React.RefObject<Fight>; i: 0 | 1; who: FighterLook; baby?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const [pose, setPose] = useState<{ pose: Pose; take: number }>({ pose: 'fstance', take: 0 })
  // The move's own time: it holds in the hit-stop, slows in the K.O.
  const clock = useCallback(() => F.current?.f[i].t ?? 0, [F, i])
  useFrame((_, dt) => {
    const f = F.current?.f[i]
    if (!f || !g.current) return
    g.current.position.set(f.x, f.y, 0)
    // Turning to face the other one, quickly.
    const want = f.face > 0 ? Math.PI / 2 : -Math.PI / 2
    const r = g.current.rotation
    r.y += (want - r.y) * Math.min(1, dt * 18)
    // Seen from the front of the street, each shows its kicking side (the rear one):
    // the one facing right is drawn mirrored, the swap going through as it turns.
    const sx = g.current.scale
    sx.x += ((f.face > 0 ? -1 : 1) - sx.x) * Math.min(1, dt * 18)
    if (shadow.current) {
      shadow.current.position.set(f.x, 0.02, 0)
      const s = Math.max(0.4, 1 - f.y * 0.25)
      shadow.current.scale.set(s, s, s)
    }
    const p = poseOf(f)
    if (p.pose !== pose.pose || p.take !== pose.take) setPose(p)
  })
  return (
    <>
      <group ref={g}>
        <Human look={who.look} gender={who.gender} pose={pose.pose} take={pose.take} clock={clock} seed={who.seed} full headScale={baby ? 1.5 : undefined} fitted={baby} />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </>
  )
}

/* ---------- The sparks ---------- */

const STAR = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,240,180,0.95)')
  grad.addColorStop(1, 'rgba(255,160,40,0)')
  g.fillStyle = grad
  g.beginPath()
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    const r = k % 2 ? 22 : 64
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r)
  }
  g.fill()
  return new THREE.CanvasTexture(c)
})()

type Burst = { t: number; x: number; y: number; kind: FightEvent['kind']; heavy: boolean; dmg: number; dirs: THREE.Vector3[] }

/** A blow's damage as it flies off: white, gold for a big one, orange for a counter. */
const numbers = new Map<string, THREE.CanvasTexture>()
function numberTexture(text: string, color: string) {
  const key = text + color
  const had = numbers.get(key)
  if (had) return had
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.font = "900 92px 'Baloo 2', Impact, sans-serif"
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 14
  g.lineJoin = 'round'
  g.strokeStyle = 'rgba(15,11,34,0.9)'
  g.strokeText(text, 128, 68)
  g.fillStyle = color
  g.fillText(text, 128, 68)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  numbers.set(key, t)
  return t
}

const ringMat = () => new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
const POOL = 6
const SHARDS = 9

function Sparks({ fx }: { fx: React.RefObject<FightEvent[]> }) {
  const bursts = useRef<(Burst | null)[]>(Array(POOL).fill(null))
  const groups = useRef<(THREE.Group | null)[]>([])
  const stars = useRef<(THREE.Mesh | null)[]>([])
  const shards = useRef<(THREE.Mesh | null)[][]>(Array.from({ length: POOL }, () => []))
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const nums = useRef<(THREE.Mesh | null)[]>([])
  const ringMats = useMemo(() => Array.from({ length: POOL }, ringMat), [])
  const next = useRef(0)
  const { camera } = useThree()
  useFrame((_, dt) => {
    for (const e of fx.current?.splice(0) ?? []) {
      const k = next.current++ % POOL
      bursts.current[k] = { t: 0, x: e.x, y: e.y, kind: e.kind, heavy: !!e.heavy, dmg: Math.round(e.dmg ?? 0), dirs: Array.from({ length: SHARDS }, () => new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.2, Math.random() - 0.5).normalize()) }
    }
    bursts.current.forEach((b, k) => {
      const grp = groups.current[k]
      if (!grp) return
      if (!b || b.t > 0.8) {
        grp.visible = false
        return
      }
      b.t += dt
      grp.visible = true
      grp.position.set(b.x, b.y, 0.15)
      const block = b.kind === 'block'
      const life = Math.min(1, b.t / 0.4)
      // The shock ring, opening out round the blow (not on a block).
      const ring = rings.current[k]
      if (ring) {
        ring.visible = !block && b.t < 0.3
        ring.quaternion.copy(camera.quaternion)
        ring.scale.setScalar((b.heavy ? 1.6 : 1) * (0.2 + (b.t / 0.3) * 1.1))
        ringMats[k].opacity = Math.max(0, 1 - b.t / 0.3) * 0.9
        ringMats[k].color.set(b.kind === 'counter' ? '#ff6b3d' : '#fff3c4')
      }
      // The damage, flying up off the blow and fading.
      const num = nums.current[k]
      if (num) {
        num.visible = !block && b.dmg > 0
        if (num.visible) {
          const m = num.material as THREE.MeshBasicMaterial
          const tex = numberTexture(b.kind === 'counter' ? `${b.dmg}!` : String(b.dmg), b.kind === 'counter' ? '#ff8a3d' : b.heavy ? '#ffd43b' : '#ffffff')
          if (m.map !== tex) ((m.map = tex), (m.needsUpdate = true))
          m.opacity = Math.max(0, 1 - Math.max(0, b.t - 0.45) / 0.35)
          num.quaternion.copy(camera.quaternion)
          num.position.set(0.15, 0.35 + b.t * 1.1, 0.1)
          const pop = b.t < 0.12 ? 0.6 + (b.t / 0.12) * 0.6 : 1.2 - Math.min(0.2, (b.t - 0.12) * 0.5)
          num.scale.set(0.7 * pop * (b.heavy ? 1.25 : 1), 0.35 * pop * (b.heavy ? 1.25 : 1), 1)
        }
      }
      const star = stars.current[k]
      if (star) {
        star.quaternion.copy(camera.quaternion)
        const s = (block ? 0.5 : b.heavy ? 1.1 : 0.7) * (0.4 + Math.min(1, b.t / 0.08) * 0.8)
        star.scale.setScalar(s)
        const m = star.material as THREE.MeshBasicMaterial
        m.opacity = Math.max(0, 1 - life * 1.6)
        m.color.set(block ? '#9ad8ff' : b.kind === 'counter' ? '#ff6b3d' : '#ffffff')
      }
      shards.current[k].forEach((s, j) => {
        if (!s) return
        const d = b.dirs[j]
        const v = (block ? 2.2 : b.heavy ? 4.2 : 3) * b.t
        s.position.set(d.x * v, d.y * v - 3 * b.t * b.t, d.z * v)
        s.scale.setScalar(Math.max(0.01, 1 - life))
        ;(s.material as THREE.MeshBasicMaterial).color.set(block ? '#bfe6ff' : j % 2 ? '#ffd43b' : '#ff922b')
      })
    })
  })
  return (
    <>
      {Array.from({ length: POOL }, (_, k) => (
        <group key={k} ref={(el) => void (groups.current[k] = el)} visible={false}>
          <mesh ref={(el) => void (stars.current[k] = el)}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={STAR} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh ref={(el) => void (rings.current[k] = el)} material={ringMats[k]}>
            <ringGeometry args={[0.42, 0.5, 32]} />
          </mesh>
          <mesh ref={(el) => void (nums.current[k] = el)} renderOrder={5}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent depthWrite={false} depthTest={false} />
          </mesh>
          {Array.from({ length: SHARDS }, (_, j) => (
            <mesh key={j} ref={(el) => void (shards.current[k][j] = el)}>
              <boxGeometry args={[0.05, 0.05, 0.05]} />
              <meshBasicMaterial />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

/* ---------- The dust of a fall, the trail of a big swing ---------- */

const DUST = 4
const PUFFS = 8
const dustMat = new THREE.MeshBasicMaterial({ color: '#b9ada0', transparent: true, depthWrite: false })

/** A fall (or a landing from a jump): a ring of dust puffing out along the road. */
function Dust({ fx }: { fx: React.RefObject<FightEvent[]> }) {
  const falls = useRef<({ t: number; x: number; big: boolean } | null)[]>(Array(DUST).fill(null))
  const groups = useRef<(THREE.Group | null)[]>([])
  const mats = useMemo(() => Array.from({ length: DUST }, () => dustMat.clone()), [])
  const next = useRef(0)
  useFrame((_, dt) => {
    for (const e of fx.current?.splice(0) ?? []) falls.current[next.current++ % DUST] = { t: 0, x: e.x, big: !!e.heavy }
    falls.current.forEach((f, k) => {
      const g = groups.current[k]
      if (!g) return
      if (!f || f.t > 0.7) return void (g.visible = false)
      f.t += dt
      g.visible = true
      g.position.set(f.x, 0.08, 0)
      const u = f.t / 0.7
      mats[k].opacity = (f.big ? 0.55 : 0.3) * (1 - u)
      g.children.forEach((c, j) => {
        const a = (j / PUFFS) * Math.PI * 2
        const r = (f.big ? 1.1 : 0.6) * (1 - Math.pow(1 - u, 2))
        c.position.set(Math.cos(a) * r, u * 0.25, Math.sin(a) * r * 0.6)
        c.scale.setScalar((f.big ? 0.32 : 0.2) * (0.5 + u))
      })
    })
  })
  return (
    <>
      {Array.from({ length: DUST }, (_, k) => (
        <group key={k} ref={(el) => void (groups.current[k] = el)} visible={false}>
          {Array.from({ length: PUFFS }, (_, j) => (
            <mesh key={j} material={mats[k]}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
/** A big swing: a white arc in front of the one throwing it, gone in a blink. */
function Trails({ F, fx }: { F: React.RefObject<Fight>; fx: React.RefObject<FightEvent[]> }) {
  const arcs = useRef<({ t: number; by: 0 | 1; y: number } | null)[]>([null, null])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const mats = useMemo(() => [trailMat.clone(), trailMat.clone()], [])
  useFrame((_, dt) => {
    for (const e of fx.current?.splice(0) ?? []) arcs.current[e.by] = { t: 0, by: e.by, y: e.y }
    arcs.current.forEach((a, k) => {
      const m = meshes.current[k]
      const f = F.current?.f[k]
      if (!m) return
      if (!a || !f || a.t > 0.22) return void (m.visible = false)
      a.t += dt
      m.visible = true
      // Round the front of the fighter, sweeping as it opens.
      m.position.set(f.x + f.face * 0.35, a.y, 0.05)
      m.rotation.set(0, 0, f.face > 0 ? -0.6 + a.t * 6 : Math.PI + 0.6 - a.t * 6)
      mats[k].opacity = 0.55 * (1 - a.t / 0.22)
    })
  })
  return (
    <>
      {[0, 1].map((k) => (
        <mesh key={k} ref={(el) => void (meshes.current[k] = el)} material={mats[k]} visible={false}>
          <ringGeometry args={[0.55, 0.75, 20, 1, 0, Math.PI * 0.7]} />
        </mesh>
      ))}
    </>
  )
}
