import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { Vehicle, setVehicleNight } from '../world3d/vehicles'
import { holdScenes } from '../world3d/hold'
import { weakDevice } from '../lib/device'
import type { Look } from '../lib/types'
import { ARENAS, poseOf, turn, type ArenaId, type Fight, type FightEvent } from './engine'
import { t as tr } from '../lib/i18n'

// Adjamé Storm 4's places, drawn in the game's blocks: the arena (its ground,
// its walls, the props the engine knows at the same places), the crowd round
// it, the two fighters free on the ground, the sparks, the dust, the shock of
// a special. The camera stands behind the player's fighter and keeps the
// other in the frame (the phone is upright: the fight goes into the screen),
// swings round for the intro, closes in for a K.O., circles the winner.

export type FighterLook = { look: Look; gender: 'femme' | 'homme'; seed: number }
/** The camera's facing on the ground, for the stick (Game.tsx turns the thumb's push into the arena's directions). */
export type CamDir = { fx: number; fz: number }

type Props = {
  F: React.RefObject<Fight>
  looks: [FighterLook, FighterLook]
  arena: ArenaId
  cam: React.RefObject<CamDir>
  /** Steps the fight (the pads, the engine) and returns what happened this frame. */
  onFrame: (dt: number) => FightEvent[]
}

export function StormCanvas(props: Props) {
  // The world underneath holds still while the fight is on.
  const release = useRef<(() => void) | null>(null)
  useEffect(() => () => release.current?.(), [])
  const sky = SKY[props.arena]
  return (
    <Canvas shadows={!weakDevice} dpr={weakDevice ? [1, 1.25] : [1, 1.5]} camera={{ fov: 55, near: 0.2, far: 140, position: [0, 3, 9] }} gl={{ antialias: !weakDevice }} onCreated={({ gl }) => void (release.current = holdScenes(gl.domElement))}>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 24, 70]} />
      <World {...props} />
    </Canvas>
  )
}

const SKY: Record<ArenaId, string> = { terrain: '#141029', treichville: '#0f0b22', cour: '#9fd3f0', plage: '#f0a46a' }
const NIGHT: Record<ArenaId, boolean> = { terrain: true, treichville: true, cour: false, plage: false }

function World({ F, looks, arena, cam, onFrame }: Props) {
  const fx = useRef<FightEvent[]>([])
  const dust = useRef<FightEvent[]>([])
  const rings = useRef<FightEvent[]>([])
  const shake = useRef(0)
  const punch = useRef(0)
  const cheer = useRef(0)
  // The fight is stepped first each frame; what happened goes to the sparks, the camera and the crowd.
  useFrame((_, dt) => {
    const evs = onFrame(dt)
    for (const e of evs) {
      const hit = e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw' || e.kind === 'wall'
      if (hit || e.kind === 'block') fx.current.push(e)
      if (hit) shake.current = Math.max(shake.current, e.heavy ? 0.22 : 0.07)
      if (hit && e.heavy) punch.current = 1
      if (e.kind === 'land' || e.kind === 'dash' || e.kind === 'roll' || e.kind === 'escape') dust.current.push(e)
      if (e.kind === 'slam' || e.kind === 'super' || e.kind === 'wall' || e.kind === 'escape') rings.current.push(e)
      if (e.kind === 'slam') shake.current = Math.max(shake.current, 0.35)
      if ((hit && e.heavy) || e.kind === 'ko' || e.kind === 'super') cheer.current = 1.6
      if (e.kind === 'land' && e.heavy) shake.current = Math.max(shake.current, 0.1)
    }
    cheer.current = Math.max(0, cheer.current - dt)
  }, -1)
  useEffect(() => {
    setVehicleNight(NIGHT[arena])
    return () => setVehicleNight(false)
  }, [arena])
  return (
    <>
      <CameraRig F={F} cam={cam} shake={shake} punch={punch} />
      <Place arena={arena} />
      <Glow F={F} />
      <Crowd arena={arena} cheer={cheer} />
      <FighterView F={F} i={0} who={looks[0]} />
      <FighterView F={F} i={1} who={looks[1]} />
      <Sparks fx={fx} />
      <Dust fx={dust} />
      <Rings fx={rings} />
    </>
  )
}

/* ---------- The camera ---------- */

const V = new THREE.Vector3()
function CameraRig({ F, cam, shake, punch }: { F: React.RefObject<Fight>; cam: React.RefObject<CamDir>; shake: React.RefObject<number>; punch: React.MutableRefObject<number> }) {
  const { camera } = useThree()
  const at = useRef(new THREE.Vector3(0, 1, 0))
  const yaw = useRef<number | null>(null)
  const dist = useRef(7)
  const pos = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const fight = F.current
    if (!fight) return
    const [me, them] = fight.f
    const dx = me.x - them.x
    const dz = me.z - them.z
    const gap = Math.hypot(dx, dz)
    // Behind the player, on the line from the other: turning there at a set pace (one flying over doesn't spin it).
    const want = Math.atan2(dx, dz)
    if (yaw.current === null) yaw.current = want
    if (gap > 1.4) yaw.current += Math.max(-2.6 * dt, Math.min(2.6 * dt, turn(yaw.current, want) * Math.min(1, dt * 3.2)))
    let y = yaw.current
    let d = Math.min(12, 4.6 + gap * 0.62)
    let hgt = 2.3 + gap * 0.16
    let look = V.set(me.x + (them.x - me.x) * 0.5, 1.0 + Math.max(me.y, them.y) * 0.3, me.z + (them.z - me.z) * 0.42)
    let k = Math.min(1, dt * 5)
    const p = fight.phase
    if (p === 'intro') {
      // The intro: swinging round from the side to behind the player, both fighters seen.
      const u = Math.min(1, fight.phaseT / 1.7)
      const e = u * u * (3 - 2 * u)
      y = yaw.current + (1 - e) * 2.1
      d = 6.5 - e * 1.2
      hgt = 1.4 + e * 1.2
      look = V.set((me.x + them.x) / 2, 1.1, (me.z + them.z) / 2)
      k = fight.round === 1 && fight.phaseT < 0.05 ? 1 : Math.min(1, dt * 6)
    } else if ((p === 'ko' || p === 'timeup') && fight.roundWinner !== -1) {
      // The K.O.: in close and low on the one going down, then round on the winner.
      const loser = fight.f[1 - fight.roundWinner]
      const win = fight.f[fight.roundWinner]
      const who = fight.phaseT < 1.6 ? loser : win
      y = yaw.current + 0.9 + fight.phaseT * 0.35
      d = fight.phaseT < 1.6 ? 3.6 : 3.2
      hgt = fight.phaseT < 1.6 ? 1.1 : 1.5
      look = V.set(who.x, fight.phaseT < 1.6 ? 0.6 + who.y : 1.2, who.z)
      k = Math.min(1, dt * 3)
    } else if (p === 'over') {
      // The end: slowly round the winner (or the two of them).
      const w = fight.wins[0] > fight.wins[1] ? me : fight.wins[1] > fight.wins[0] ? them : null
      y = yaw.current + fight.phaseT * 0.5
      d = w ? 3.4 : 6
      hgt = 1.5
      look = w ? V.set(w.x, 1.2, w.z) : V.set((me.x + them.x) / 2, 1, (me.z + them.z) / 2)
      k = Math.min(1, dt * 2.5)
    } else if (fight.flash > 0) {
      // A special: in close and low, looking up at the one throwing it.
      const who = fight.f.find((f) => f.act === 'attack' && f.move && f.t < 0.5) ?? me
      look = V.set(who.x, 1.3 + who.y, who.z)
      d = 4.2
      hgt = 1.0
      k = Math.min(1, dt * 4)
    }
    // A big blow: the camera lunges in a little, then eases back.
    punch.current = Math.max(0, punch.current - dt * 3)
    d *= 1 - 0.1 * punch.current
    dist.current += (d - dist.current) * Math.min(1, dt * 4)
    // Over the shoulder: a little to the right, so the player's back doesn't hide the other.
    const rx = Math.cos(y) * 0.85
    const rz = -Math.sin(y) * 0.85
    const base = p === 'fight' ? me : null
    const cx = (base ? me.x : look.x) + Math.sin(y) * dist.current + (base ? rx : 0)
    const cz = (base ? me.z : look.z) + Math.cos(y) * dist.current + (base ? rz : 0)
    // Not through the buildings round the arena.
    const ar = fight.ar
    pos.current.set(Math.max(-ar.w - 3, Math.min(ar.w + 3, cx)), hgt + (base ? me.y * 0.5 : 0), Math.max(-ar.d - 3, Math.min(ar.d + 3, cz)))
    camera.position.lerp(pos.current, k)
    at.current.lerp(look, Math.min(1, k * 1.4))
    const s = shake.current ?? 0
    if (s > 0) {
      camera.position.x += (Math.random() - 0.5) * s
      camera.position.y += (Math.random() - 0.5) * s
      shake.current = Math.max(0, s - dt * 1.1)
    }
    camera.lookAt(at.current)
    // Where the camera faces on the ground: the stick's « up ».
    const c = cam.current
    if (c) {
      const fx = at.current.x - camera.position.x
      const fz = at.current.z - camera.position.z
      const n = Math.hypot(fx, fz) || 1
      c.fx = fx / n
      c.fz = fz / n
    }
  })
  return null
}

/* ---------- The light of a special ---------- */

function Glow({ F }: { F: React.RefObject<Fight> }) {
  const glow = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const fight = F.current
    if (!fight || !glow.current) return
    const who = fight.f.find((f) => f.act === 'attack' && f.move && f.move.length > 5 && ['coupe', 'tourbillon', 'envol', 'marteau'].includes(f.move))
    const fl = Math.min(1, fight.flash / 0.4)
    glow.current.intensity = who ? 10 + fl * 30 : 0
    if (who) glow.current.position.set(who.x, 1.3 + who.y, who.z)
  })
  return <pointLight ref={glow} intensity={0} distance={8} decay={1.4} color="#ff3d7f" />
}

/* ---------- The places ---------- */

const box = new THREE.BoxGeometry(1, 1, 1)
const cyl = new THREE.CylinderGeometry(1, 1, 1, 12)
const mats = new Map<string, THREE.MeshLambertMaterial>()
const lam = (c: string) => {
  let m = mats.get(c)
  if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
/** A block: its centre, its size, its colour. */
function B({ p, s, c, r = 0, cast = true }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; cast?: boolean }) {
  return <mesh geometry={box} material={lam(c)} position={p} scale={s} rotation={[0, r, 0]} castShadow={cast && !weakDevice} receiveShadow={!weakDevice} />
}
function C({ p, r, h, c }: { p: [number, number, number]; r: number; h: number; c: string }) {
  return <mesh geometry={cyl} material={lam(c)} position={p} scale={[r, h, r]} castShadow={!weakDevice} receiveShadow={!weakDevice} />
}

/** A sign's words lit on a coloured board. */
function signTex(text: string, bg: string, fg: string) {
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
function Sign({ p, w, text, bg, fg, r = 0 }: { p: [number, number, number]; w: number; text: string; bg: string; fg: string; r?: number }) {
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: signTex(text, bg, fg) }), [text, bg, fg])
  return (
    <mesh position={p} rotation={[0, r, 0]} material={m}>
      <planeGeometry args={[w, w / 4]} />
    </mesh>
  )
}

/** The walls round the arena: four runs of blocks, the posts every few metres. */
function Walls({ w, d, h, c, post }: { w: number; d: number; h: number; c: string; post: string }) {
  const posts = useMemo(() => {
    const out: [number, number][] = []
    for (let x = -w; x <= w + 0.01; x += 3) out.push([x, -d - 0.15], [x, d + 0.15])
    for (let z = -d + 3; z < d; z += 3) out.push([-w - 0.15, z], [w + 0.15, z])
    return out
  }, [w, d])
  return (
    <group>
      <B p={[0, h / 2, -d - 0.15]} s={[2 * w + 0.6, h, 0.3]} c={c} />
      <B p={[0, h / 2, d + 0.15]} s={[2 * w + 0.6, h * 0.55, 0.3]} c={c} />
      <B p={[-w - 0.15, h / 2, 0]} s={[0.3, h, 2 * d]} c={c} />
      <B p={[w + 0.15, h / 2, 0]} s={[0.3, h, 2 * d]} c={c} />
      {posts.map(([x, z], k) => (
        <B key={k} p={[x, h / 2 + 0.08, z]} s={[0.42, h + 0.16, 0.42]} c={post} cast={false} />
      ))}
    </group>
  )
}

/** Houses in a row beyond a wall (their windows lit at night). */
function Row({ z, from, to, night, rot = 0 }: { z: number; from: number; to: number; night: boolean; rot?: number }) {
  const blocks = useMemo(() => {
    const r = rng(`row${z}${from}`)
    const out: { x: number; w: number; h: number; c: string; lit: boolean[] }[] = []
    const cols = ['#c9a27a', '#8fa9b8', '#d8c3a0', '#b5838d', '#9c8d7a', '#e0b973']
    for (let x = from; x < to; ) {
      const w = 3 + r() * 2.5
      out.push({ x: x + w / 2, w, h: 3.5 + Math.floor(r() * 3) * 2.6, c: cols[Math.floor(r() * cols.length)], lit: [r() < 0.5, r() < 0.5, r() < 0.5, r() < 0.5] })
      x += w + 0.2
    }
    return out
  }, [z, from, to])
  return (
    <group rotation={[0, rot, 0]}>
      {blocks.map((b, k) => (
        <group key={k} position={[b.x, 0, z]}>
          <B p={[0, b.h / 2, 0]} s={[b.w, b.h, 3]} c={b.c} cast={false} />
          {b.lit.map((on, j) => (
            <B key={j} p={[(j % 2 ? 0.6 : -0.6) * (b.w / 3), 1.6 + Math.floor(j / 2) * 2.4, 1.52]} s={[0.7, 0.9, 0.04]} c={night && on ? '#ffcf70' : '#2b3340'} cast={false} />
          ))}
        </group>
      ))}
    </group>
  )
}

function Lamp({ p, color = '#ffcf8a', on }: { p: [number, number, number]; color?: string; on: boolean }) {
  return (
    <group position={p}>
      <B p={[0, 2.8, 0]} s={[0.14, 5.6, 0.14]} c="#40444b" cast={false} />
      <B p={[0, 5.6, 0.3]} s={[0.4, 0.14, 0.7]} c={on ? '#fff1c9' : '#c9ccd1'} cast={false} />
      {on && <pointLight position={[0, 5.3, 0.4]} intensity={30} distance={16} decay={1.5} color={color} />}
    </group>
  )
}

function Place({ arena }: { arena: ArenaId }) {
  const ar = ARENAS[arena]
  const night = NIGHT[arena]
  const sun = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    const s = sun.current
    if (!s) return
    s.target.position.set(0, 0, 0)
    s.target.updateMatrixWorld()
    const c = s.shadow.camera as THREE.OrthographicCamera
    Object.assign(c, { left: -ar.w - 2, right: ar.w + 2, top: ar.d + 2, bottom: -ar.d - 2 })
    c.updateProjectionMatrix()
  }, [ar])
  const light =
    arena === 'cour'
      ? { hemi: ['#fff6e0', '#8a6a4a', 1.1], sun: ['#fff1d0', 1.8, [6, 12, 5]] }
      : arena === 'plage'
        ? { hemi: ['#ffd2a8', '#8a6a6a', 1.35], sun: ['#ffb070', 1.6, [-10, 6, -8]] }
        : { hemi: ['#a9a2ff', '#5a3a26', 1.35], sun: ['#c9d2ff', 1.1, [-6, 10, 6]] }
  return (
    <group>
      <hemisphereLight args={light.hemi as [string, string, number]} />
      {/* A soft light from all round, so the backs the camera sees aren't black. */}
      <ambientLight intensity={night ? 0.45 : 0.25} />
      <directionalLight ref={sun} color={light.sun[0] as string} intensity={light.sun[1] as number} position={light.sun[2] as [number, number, number]} castShadow={!weakDevice} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      {arena === 'terrain' && <Terrain night={night} />}
      {arena === 'treichville' && <Treichville />}
      {arena === 'cour' && <Cour />}
      {arena === 'plage' && <Plage />}
    </group>
  )
}

/** Adjamé, the vacant lot behind the gare: red earth, the cinder-block walls, a dead woro-woro, oil drums, tyres, the mango tree, two lamps. */
function Terrain({ night }: { night: boolean }) {
  const { w, d } = ARENAS.terrain
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshLambertMaterial color="#7a4126" />
      </mesh>
      {[
        [-3, 2, 2.4],
        [4, -1, 1.8],
        [0, -4, 2.2],
        [7, 1, 1.4],
      ].map(([x, z, r], k) => (
        <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]} scale={[r, r * 0.7, 1]}>
          <circleGeometry args={[1, 10]} />
          <meshLambertMaterial color="#8d5333" />
        </mesh>
      ))}
      <Walls w={w} d={d} h={2} c="#9a958c" post="#7f7a72" />
      <Sign p={[-3, 1.25, -d + 0.02]} w={4.4} text={tr('INTERDIT D’URINER ICI')} bg="#f1ebdc" fg="#c92a2a" />
      <Sign p={[5, 1.3, -d + 0.02]} w={4} text={tr('ADJAMÉ STORM 4')} bg="#1f1a3a" fg="#ffd43b" />
      <Vehicle p={[-5.6, 0, -4.4]} r={0.06} kind="woro" seed={5} />
      <C p={[6.6, 0.45, 4.4]} r={0.4} h={0.9} c="#1c7ed6" />
      <C p={[7.4, 0.45, 3.6]} r={0.4} h={0.9} c="#c92a2a" />
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[5.5 + (k === 3 ? 0.1 : 0), 0.13 + k * 0.24, -4.6]} rotation={[Math.PI / 2, 0, k * 0.4]} castShadow={!weakDevice}>
          <torusGeometry args={[0.55, 0.2, 6, 12]} />
          <meshLambertMaterial color="#1d1d24" />
        </mesh>
      ))}
      {/* An old freezer left there, low (the camera sees over it); the mango tree outside the wall, over it. */}
      <B p={[-7.2, 0.5, 4.6]} s={[0.9, 1.0, 0.7]} c="#dee2e6" />
      <B p={[-7.2, 1.02, 4.6]} s={[0.94, 0.06, 0.74]} c="#adb5bd" />
      <Mango p={[-13.5, 0, 6]} />
      <Lamp p={[-w + 0.6, 0, -d + 0.6]} on={night} />
      <Lamp p={[w - 0.6, 0, d - 0.6]} on={night} />
      <Row z={-d - 4} from={-26} to={26} night={night} />
      <Row z={d + 4.5} from={-26} to={26} night={night} />
      <Row z={-w - 4} from={-20} to={20} night={night} rot={Math.PI / 2} />
      <Row z={-w - 4} from={-20} to={20} night={night} rot={-Math.PI / 2} />
    </group>
  )
}

function Mango({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <B p={[0, 1.4, 0]} s={[0.5, 2.8, 0.5]} c="#5b3a22" />
      <B p={[0, 3.4, 0]} s={[3.4, 1.6, 3.2]} c="#2f7a3a" />
      <B p={[0.4, 4.3, -0.2]} s={[2.4, 1, 2.2]} c="#3a8f45" />
      <B p={[-0.9, 3.1, 0.9]} s={[1.4, 1, 1.4]} c="#276b33" />
    </group>
  )
}

/** Treichville, a road at night closed off for the fight: the maquis, the cabine, the gbaka parked, the bulbs strung across. */
function Treichville() {
  const { w, d } = ARENAS.treichville
  const bulbs = useMemo(() => {
    const out: { p: [number, number, number]; c: string }[] = []
    const cols = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#ff922b']
    for (const z of [-2.5, 2.5])
      for (let k = 0; k <= 18; k++) {
        const u = k / 18
        out.push({ p: [-w + u * 2 * w, 5 - Math.sin(u * Math.PI) * 0.9, z], c: cols[k % cols.length] })
      }
    return out
  }, [w])
  const bulbMats = useMemo(() => new Map(['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#ff922b'].map((c) => [c, new THREE.MeshBasicMaterial({ color: c })])), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#34333a" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* The pavements, the façades along them. */}
      <B p={[0, 0.09, -d - 0.8]} s={[2 * w + 8, 0.18, 1.6]} c="#77736c" cast={false} />
      <B p={[0, 0.09, d + 0.8]} s={[2 * w + 8, 0.18, 1.6]} c="#77736c" cast={false} />
      <Row z={-d - 3.2} from={-w - 6} to={w + 6} night />
      <Row z={d + 3.2} from={-w - 6} to={w + 6} night rot={Math.PI} />
      <Sign p={[-2, 3.4, -d - 1.65]} w={4} text={tr('MAQUIS CHEZ TANTIE')} bg="#ff2d87" fg="#fff6c2" />
      <Sign p={[4.5, 3.3, -d - 1.65]} w={3.6} text={tr('CABINE · TRANSFERT')} bg="#ff7a00" fg="#ffffff" />
      {/* The ends barred: sheets of tin and a rope of tyres. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <B p={[s * (w + 0.2), 0.9, 0]} s={[0.2, 1.8, 2 * d]} c="#8d969e" />
          {[-4, -2, 0, 2, 4].map((z) => (
            <B key={z} p={[s * (w + 0.1), 1.0, z]} s={[0.3, 2.0, 0.12]} c="#5c636a" cast={false} />
          ))}
        </group>
      ))}
      <B p={[0, 0.9, -d - 0.05]} s={[2 * w, 0.06, 0.06]} c="#ffd43b" cast={false} />
      <B p={[0, 0.9, d + 0.05]} s={[2 * w, 0.06, 0.06]} c="#ffd43b" cast={false} />
      <Vehicle p={[-7.6, 0, -3.6]} kind="gbaka" seed={8} crew={false} />
      {/* The maquis's table out on the road, its chairs. */}
      <group position={[7.4, 0, 3.8]}>
        <B p={[0, 0.72, 0]} s={[1.1, 0.06, 1.1]} c="#f1f3f5" />
        <B p={[0, 0.36, 0]} s={[0.1, 0.72, 0.1]} c="#adb5bd" />
        <C p={[0.2, 0.86, 0.1]} r={0.06} h={0.28} c="#2b8a3e" />
      </group>
      <Lamp p={[3.2, 0, -4.9]} on />
      <Lamp p={[-3.2, 0, -4.9]} on />
      <pointLight position={[-2, 3, -4]} intensity={8} distance={12} decay={1.5} color="#ff4f9a" />
      {bulbs.map((b, i) => (
        <mesh key={i} position={b.p} material={bulbMats.get(b.c)}>
          <sphereGeometry args={[0.07, 6, 4]} />
        </mesh>
      ))}
    </group>
  )
}

/** Yopougon, the family courtyard by day: the walls painted, the doors, the well, the bench, the mortar, the washing on the lines. */
function Cour() {
  const { w, d } = ARENAS.cour
  const cloth = ['#e03131', '#1c7ed6', '#fab005', '#2f9e44', '#ae3ec9', '#f76707']
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 50]} />
        <meshLambertMaterial color="#cdb894" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[2 * w - 1, 2 * d - 1]} />
        <meshLambertMaterial color="#b9b2a4" />
      </mesh>
      <Walls w={w} d={d} h={2.6} c="#e8b86d" post="#c98f45" />
      {/* The rooms' doors along the back, their curtains. */}
      {[-6, -2, 2, 6].map((x, k) => (
        <group key={x}>
          <B p={[x, 1.05, -d + 0.02]} s={[1.1, 2.1, 0.08]} c="#5b3a22" cast={false} />
          <B p={[x, 1.3, -d + 0.08]} s={[1.0, 1.4, 0.04]} c={cloth[k]} cast={false} />
        </group>
      ))}
      <B p={[0, 3.2, -d - 2]} s={[2 * w + 2, 1.4, 4]} c="#9c8d7a" cast={false} />
      <B p={[0, 3.95, -d - 2]} s={[2 * w + 2.4, 0.1, 4.6]} c="#a3a9af" cast={false} />
      {/* The well. */}
      <group position={[5.6, 0, -4.2]}>
        <C p={[0, 0.45, 0]} r={0.8} h={0.9} c="#8d8a83" />
        <C p={[0, 0.91, 0]} r={0.6} h={0.04} c="#1d2a33" />
        <B p={[-0.7, 1.3, 0]} s={[0.1, 1.6, 0.1]} c="#5b3a22" />
        <B p={[0.7, 1.3, 0]} s={[0.1, 1.6, 0.1]} c="#5b3a22" />
        <B p={[0, 2.1, 0]} s={[1.6, 0.1, 0.1]} c="#5b3a22" />
      </group>
      <B p={[-6, 0.45, 4.6]} s={[1.8, 0.1, 0.5]} c="#7a5230" />
      <B p={[-6.7, 0.22, 4.6]} s={[0.1, 0.44, 0.4]} c="#7a5230" />
      <B p={[-5.3, 0.22, 4.6]} s={[0.1, 0.44, 0.4]} c="#7a5230" />
      {/* The mortar and its pestle (the foutou). */}
      <group position={[-6.5, 0, -4.6]}>
        <C p={[0, 0.35, 0]} r={0.45} h={0.7} c="#7a4a2a" />
        <B p={[0.1, 1.2, 0]} s={[0.12, 1.8, 0.12]} c="#a0703f" />
      </group>
      {/* The washing on its lines along the back wall (out of the camera's way). */}
      {[-d + 0.9].map((z) => (
        <group key={z}>
          <B p={[0, 2.7, z]} s={[2 * w, 0.03, 0.03]} c="#555" cast={false} />
          {[-6, -3.5, -1, 1.5, 4, 6.5].map((x, k) => (
            <B key={x} p={[x, 2.25, z]} s={[1.1, 0.9, 0.04]} c={cloth[(k + (z > 0 ? 3 : 0)) % cloth.length]} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Grand-Bassam, the beach at sunset: the sand, the sea rolling in, the pirogues pulled up, a parasol, the palms; a rope and stakes for the ring. */
function Plage() {
  const { w, d } = ARENAS.plage
  const sea = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (sea.current) sea.current.position.z = -d - 6 + Math.sin(clock.elapsedTime * 0.8) * 0.4
  })
  const stakes = useMemo(() => {
    const out: [number, number][] = []
    for (let x = -w; x <= w + 0.01; x += 3) out.push([x, -d], [x, d])
    for (let z = -d + 3; z < d; z += 3) out.push([-w, z], [w, z])
    return out
  }, [w, d])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 70]} />
        <meshLambertMaterial color="#e8cf9a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -d - 3.5]}>
        <planeGeometry args={[90, 2]} />
        <meshLambertMaterial color="#c9b07f" />
      </mesh>
      <mesh ref={sea} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -d - 6]}>
        <planeGeometry args={[90, 6]} />
        <meshLambertMaterial color="#f4f1e8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -d - 30]}>
        <planeGeometry args={[120, 44]} />
        <meshStandardMaterial color="#2f7fa0" roughness={0.25} metalness={0.3} />
      </mesh>
      {/* The sun going down over the sea. */}
      <mesh position={[-14, 4, -60]}>
        <circleGeometry args={[4, 20]} />
        <meshBasicMaterial color="#ffd8a0" />
      </mesh>
      {stakes.map(([x, z], k) => (
        <B key={k} p={[x, 0.55, z]} s={[0.14, 1.1, 0.14]} c="#7a5230" cast={false} />
      ))}
      <B p={[0, 0.95, -d]} s={[2 * w, 0.04, 0.04]} c="#e9e1c8" cast={false} />
      <B p={[0, 0.95, d]} s={[2 * w, 0.04, 0.04]} c="#e9e1c8" cast={false} />
      <B p={[-w, 0.95, 0]} s={[0.04, 0.04, 2 * d]} c="#e9e1c8" cast={false} />
      <B p={[w, 0.95, 0]} s={[0.04, 0.04, 2 * d]} c="#e9e1c8" cast={false} />
      <Pirogue p={[-6.55, 0, -4.7]} c="#1c7ed6" />
      <Pirogue p={[8.2, 0, -4.4]} c="#e03131" short />
      <group position={[6.5, 0, 4.2]}>
        <B p={[0, 1.2, 0]} s={[0.08, 2.4, 0.08]} c="#ddd" />
        <C p={[0, 2.4, 0]} r={1.4} h={0.12} c="#ff6b6b" />
      </group>
      {[-18, -15, 15, 18].map((x, k) => (
        <Palm key={x} p={[x, 0, (k % 2 ? 1 : -1) * 3 + 4]} />
      ))}
    </group>
  )
}

function Pirogue({ p, c, short }: { p: [number, number, number]; c: string; short?: boolean }) {
  const l = short ? 1.8 : 3.8
  return (
    <group position={p}>
      <B p={[0, 0.3, 0]} s={[l, 0.5, 0.9]} c={c} />
      <B p={[0, 0.58, 0]} s={[l * 0.96, 0.08, 0.95]} c="#fab005" cast={false} />
      <B p={[l / 2 + 0.25, 0.4, 0]} s={[0.5, 0.35, 0.5]} c={c} />
      <B p={[-l / 2 - 0.25, 0.4, 0]} s={[0.5, 0.35, 0.5]} c={c} />
    </group>
  )
}

function Palm({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {[0, 1, 2, 3, 4].map((k) => (
        <B key={k} p={[k * 0.12, 0.6 + k * 1.1, 0]} s={[0.4, 1.15, 0.4]} c="#8a6a45" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <B key={k} p={[0.5 + Math.cos((k / 6) * Math.PI * 2) * 1.2, 5.6, Math.sin((k / 6) * Math.PI * 2) * 1.2]} s={[2.2, 0.12, 0.6]} r={-(k / 6) * Math.PI * 2} c="#2f9e44" />
      ))}
    </group>
  )
}

/* ---------- The crowd ---------- */

function Crowd({ arena, cheer }: { arena: ArenaId; cheer: React.RefObject<number> }) {
  const { w, d } = ARENAS[arena]
  const people = useMemo(() => {
    const n = weakDevice ? 6 : 10
    const r = rng(`crowd-${arena}`)
    return Array.from({ length: n }, (_, i) => {
      // Along the walls, outside them: the back, the sides, a few at the front.
      const side = i % 5
      const x = side < 3 ? -w + 1 + r() * (2 * w - 2) : (side === 3 ? -1 : 1) * (w + 0.9)
      const z = side < 3 ? (side === 2 ? d + 0.9 : -d - 0.9) : -d + 1 + r() * (2 * d - 2)
      const gender = i % 3 === 1 ? 'femme' : 'homme'
      return { p: [x, z] as [number, number], face: Math.atan2(-x, -z), gender: gender as 'femme' | 'homme', look: randomLook(gender, rng(`storm-crowd${arena}${i}`)), seed: i * 13 }
    })
  }, [arena, w, d])
  const [loud, setLoud] = useState(false)
  useFrame(() => {
    const on = (cheer.current ?? 0) > 0
    if (on !== loud) setLoud(on)
  })
  return (
    <>
      {people.map((x, i) => (
        <group key={i} position={[x.p[0], 0, x.p[1]]} rotation={[0, x.face, 0]}>
          <Human look={x.look} gender={x.gender} pose={loud ? 'cheer' : i % 4 === 0 ? 'dance' : i % 4 === 2 ? 'clap' : 'idle'} seed={x.seed} />
        </group>
      ))}
    </>
  )
}

/* ---------- The fighters ---------- */

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function FighterView({ F, i, who }: { F: React.RefObject<Fight>; i: 0 | 1; who: FighterLook }) {
  const g = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const [pose, setPose] = useState<{ pose: Pose; take: number }>({ pose: 'fstance', take: 0 })
  // The move's own time: it holds in the hit-stop, slows in the K.O.
  const clock = useCallback(() => F.current?.f[i].t ?? 0, [F, i])
  useFrame((_, dt) => {
    const f = F.current?.f[i]
    if (!f || !g.current || !spin.current) return
    g.current.position.set(f.x, f.y, f.z)
    // Turning to where it faces, quickly (the short way round).
    const r = g.current.rotation
    r.y = wrap(r.y + turn(r.y, f.h) * Math.min(1, dt * 20))
    // Sent flying: tumbling over backwards; a roll: a somersault forwards. Else upright again, smoothly.
    const s = spin.current.rotation
    if (f.act === 'air' && (f.fly || f.juggle > 1)) s.x = -f.t * 11
    else if (f.act === 'roll') s.x = Math.min(1, f.t / 0.36) * Math.PI * 2
    else {
      s.x = wrap(s.x)
      s.x += (0 - s.x) * Math.min(1, dt * 14)
    }
    if (shadow.current) {
      shadow.current.position.set(f.x, 0.02, f.z)
      const k = Math.max(0.4, 1 - f.y * 0.2)
      shadow.current.scale.set(k, k, k)
    }
    const p = poseOf(f)
    if (p.pose !== pose.pose || p.take !== pose.take) setPose(p)
  })
  return (
    <>
      <group ref={g}>
        <group ref={spin} position={[0, 0.55, 0]}>
          <group position={[0, -0.55, 0]}>
            <Human look={who.look} gender={who.gender} pose={pose.pose} take={pose.take} clock={clock} seed={who.seed} full faceId={i === 0 ? 'me' : undefined} />
          </group>
        </group>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </>
  )
}

/* ---------- The sparks: a flash, a shock ring, the damage flying off, blocks bursting out ---------- */

const STAR = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,240,180,0.95)')
  grad.addColorStop(1, 'rgba(255,160,40,0)')
  g.fillStyle = grad
  g.beginPath()
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    const r = k % 2 ? 11 : 32
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
  }
  g.fill()
  return new THREE.CanvasTexture(c)
})()

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

type Burst = { t: number; x: number; y: number; z: number; kind: FightEvent['kind']; heavy: boolean; dmg: number; dirs: THREE.Vector3[] }
const POOL = 6
const SHARDS = 10
const shardGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07)

function Sparks({ fx }: { fx: React.RefObject<FightEvent[]> }) {
  const bursts = useRef<(Burst | null)[]>(Array(POOL).fill(null))
  const groups = useRef<(THREE.Group | null)[]>([])
  const stars = useRef<(THREE.Mesh | null)[]>([])
  const shards = useRef<(THREE.Mesh | null)[][]>(Array.from({ length: POOL }, () => []))
  const nums = useRef<(THREE.Mesh | null)[]>([])
  const shardMats = useMemo(() => Array.from({ length: POOL }, () => [new THREE.MeshBasicMaterial({ color: '#ffd43b' }), new THREE.MeshBasicMaterial({ color: '#ff922b' })]), [])
  const dirs = useMemo(() => Array.from({ length: POOL }, () => Array.from({ length: SHARDS }, () => new THREE.Vector3())), [])
  const next = useRef(0)
  const { camera } = useThree()
  useFrame((_, dt) => {
    for (const e of fx.current?.splice(0) ?? []) {
      const k = next.current++ % POOL
      for (const v of dirs[k]) v.set(Math.random() - 0.5, Math.random() * 0.9 - 0.1, Math.random() - 0.5).normalize()
      bursts.current[k] = { t: 0, x: e.x, y: e.y, z: e.z, kind: e.kind, heavy: !!e.heavy, dmg: Math.round(e.dmg ?? 0), dirs: dirs[k] }
      const block = e.kind === 'block'
      shardMats[k][0].color.set(block ? '#bfe6ff' : e.kind === 'counter' ? '#ff6b3d' : '#ffd43b')
      shardMats[k][1].color.set(block ? '#e7f5ff' : '#ff922b')
    }
    bursts.current.forEach((b, k) => {
      const grp = groups.current[k]
      if (!grp) return
      if (!b || b.t > 0.8) return void (grp.visible = false)
      b.t += dt
      grp.visible = true
      grp.position.set(b.x, b.y, b.z)
      const block = b.kind === 'block'
      const life = Math.min(1, b.t / 0.4)
      const num = nums.current[k]
      if (num) {
        num.visible = !block && b.dmg > 0
        if (num.visible) {
          const m = num.material as THREE.MeshBasicMaterial
          const tex = numberTexture(b.kind === 'counter' ? `${b.dmg}!` : String(b.dmg), b.kind === 'counter' ? '#ff8a3d' : b.heavy ? '#ffd43b' : '#ffffff')
          if (m.map !== tex) ((m.map = tex), (m.needsUpdate = true))
          m.opacity = Math.max(0, 1 - Math.max(0, b.t - 0.45) / 0.35)
          num.quaternion.copy(camera.quaternion)
          num.position.set(0, 0.4 + b.t * 1.1, 0)
          const pop = b.t < 0.12 ? 0.6 + (b.t / 0.12) * 0.6 : 1.2 - Math.min(0.2, (b.t - 0.12) * 0.5)
          num.scale.set(0.7 * pop * (b.heavy ? 1.25 : 1), 0.35 * pop * (b.heavy ? 1.25 : 1), 1)
        }
      }
      const star = stars.current[k]
      if (star) {
        star.quaternion.copy(camera.quaternion)
        star.scale.setScalar((block ? 0.6 : b.heavy ? 1.3 : 0.8) * (0.4 + Math.min(1, b.t / 0.08) * 0.8))
        const m = star.material as THREE.MeshBasicMaterial
        m.opacity = Math.max(0, 1 - life * 1.6)
      }
      shards.current[k].forEach((s, j) => {
        if (!s) return
        const d = b.dirs[j]
        const v = (block ? 2.2 : b.heavy ? 4.5 : 3) * b.t
        s.position.set(d.x * v, d.y * v - 4 * b.t * b.t, d.z * v)
        s.scale.setScalar(Math.max(0.01, 1 - life))
        s.rotation.set(b.t * 9 + j, b.t * 7, 0)
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
          <mesh ref={(el) => void (nums.current[k] = el)} renderOrder={5}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent depthWrite={false} depthTest={false} />
          </mesh>
          {Array.from({ length: SHARDS }, (_, j) => (
            <mesh key={j} geometry={shardGeo} material={shardMats[k][j % 2]} ref={(el) => void (shards.current[k][j] = el)} />
          ))}
        </group>
      ))}
    </>
  )
}

/* ---------- The dust of a fall, a dash, a roll ---------- */

const DUST = 5
const PUFFS = 7
const puffGeo = new THREE.BoxGeometry(1, 1, 1)

function Dust({ fx }: { fx: React.RefObject<FightEvent[]> }) {
  const falls = useRef<({ t: number; x: number; z: number; big: boolean } | null)[]>(Array(DUST).fill(null))
  const groups = useRef<(THREE.Group | null)[]>([])
  const mats = useMemo(() => Array.from({ length: DUST }, () => new THREE.MeshBasicMaterial({ color: '#b9ada0', transparent: true, depthWrite: false })), [])
  const next = useRef(0)
  useFrame((_, dt) => {
    for (const e of fx.current?.splice(0) ?? []) falls.current[next.current++ % DUST] = { t: 0, x: e.x, z: e.z, big: !!e.heavy }
    falls.current.forEach((f, k) => {
      const g = groups.current[k]
      if (!g) return
      if (!f || f.t > 0.6) return void (g.visible = false)
      f.t += dt
      g.visible = true
      g.position.set(f.x, 0.08, f.z)
      const u = f.t / 0.6
      mats[k].opacity = (f.big ? 0.6 : 0.35) * (1 - u)
      g.children.forEach((c, j) => {
        const a = (j / PUFFS) * Math.PI * 2
        const r = (f.big ? 1.2 : 0.6) * (1 - Math.pow(1 - u, 2))
        c.position.set(Math.cos(a) * r, u * 0.3, Math.sin(a) * r)
        c.scale.setScalar((f.big ? 0.32 : 0.2) * (0.5 + u))
        c.rotation.y = a + u
      })
    })
  })
  return (
    <>
      {Array.from({ length: DUST }, (_, k) => (
        <group key={k} ref={(el) => void (groups.current[k] = el)} visible={false}>
          {Array.from({ length: PUFFS }, (_, j) => (
            <mesh key={j} geometry={puffGeo} material={mats[k]} />
          ))}
        </group>
      ))}
    </>
  )
}

/* ---------- The shock of a special, a slam, a wall ---------- */

function Rings({ fx }: { fx: React.RefObject<FightEvent[]> }) {
  const rings = useRef<({ t: number; x: number; y: number; z: number; big: boolean; color: string } | null)[]>([null, null, null])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const mats = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })), [])
  const next = useRef(0)
  useFrame((_, dt) => {
    for (const e of fx.current?.splice(0) ?? []) {
      const k = next.current++ % 3
      rings.current[k] = { t: 0, x: e.x, y: e.kind === 'slam' ? 0.1 : e.kind === 'super' ? 0.1 : e.y, z: e.z, big: e.kind === 'slam' || e.kind === 'super', color: e.kind === 'super' ? '#ff3d7f' : e.kind === 'escape' ? '#9ad8ff' : '#fff3c4' }
      mats[k].color.set(rings.current[k]!.color)
    }
    rings.current.forEach((r, k) => {
      const m = meshes.current[k]
      if (!m) return
      if (!r || r.t > 0.45) return void (m.visible = false)
      r.t += dt
      m.visible = true
      m.position.set(r.x, r.y, r.z)
      m.scale.setScalar((r.big ? 3.2 : 1.4) * (0.15 + r.t / 0.45))
      mats[k].opacity = 0.85 * (1 - r.t / 0.45)
    })
  })
  return (
    <>
      {[0, 1, 2].map((k) => (
        <mesh key={k} ref={(el) => void (meshes.current[k] = el)} material={mats[k]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.8, 1, 32]} />
        </mesh>
      ))}
    </>
  )
}

/* ---------- The menus' 3D: the logo in blocks, a fighter on its stand ---------- */

/** Words built in the game's blocks: the letters drawn in a font on a small grid, each lit cell a cube (instanced). */
export function BlockWords({ text, sub, color = '#ffd43b', side = '#c2410c' }: { text: string; sub?: string; color?: string; side?: string }) {
  const cells = useMemo(() => {
    const W = 96
    const H = sub ? 38 : 21
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#fff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = "900 19px 'Baloo 2', Impact, sans-serif"
    g.fillText(text, W / 2, 10, W - 4)
    if (sub) {
      g.font = "900 18px 'Baloo 2', Impact, sans-serif"
      g.fillText(sub, W / 2, 28, W - 4)
    }
    const d = g.getImageData(0, 0, W, H).data
    const out: [number, number][] = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] > 110) out.push([x - W / 2, H / 2 - y])
    return out
  }, [text, sub])
  const front = useRef<THREE.InstancedMesh>(null)
  const back = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    cells.forEach(([x, y], k) => {
      // Each lit cell a block 0.1 across, a darker one behind it for the depth.
      m.makeScale(0.1, 0.1, 0.12).setPosition(x * 0.1, y * 0.1, 0)
      front.current?.setMatrixAt(k, m)
      m.makeScale(0.1, 0.1, 0.12).setPosition(x * 0.1 + 0.035, y * 0.1 - 0.045, -0.1)
      back.current?.setMatrixAt(k, m)
    })
    if (front.current) front.current.instanceMatrix.needsUpdate = true
    if (back.current) back.current.instanceMatrix.needsUpdate = true
  }, [cells])
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.7) * 0.22
  })
  return (
    <group ref={g}>
      <instancedMesh key={`f${cells.length}`} ref={front} args={[box, undefined, cells.length]}>
        <meshLambertMaterial color={color} />
      </instancedMesh>
      <instancedMesh key={`b${cells.length}`} ref={back} args={[box, undefined, cells.length]}>
        <meshLambertMaterial color={side} />
      </instancedMesh>
    </group>
  )
}

/** The title: the logo in blocks over a fighter in its guard. */
export function TitleCanvas({ who, text, sub }: { who: FighterLook; text: string; sub: string }) {
  return (
    <Canvas dpr={weakDevice ? [1, 1.25] : [1, 1.75]} camera={{ fov: 40, position: [0, 1.6, 13] }} gl={{ alpha: true, antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 1.6, 0)}>
      <hemisphereLight args={['#fff1e0', '#3a2a4a', 1.2]} />
      <directionalLight position={[4, 6, 8]} intensity={1.6} />
      <group position={[0, 4.0, 0]} scale={0.5}>
        <BlockWords text={text} sub={sub} />
      </group>
      <group position={[0, -1.6, 4]}>
        <Stand who={who} pose="fstance" />
      </group>
    </Canvas>
  )
}

function Stand({ who, pose }: { who: FighterLook; pose: Pose }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = 0.5 + Math.sin(clock.elapsedTime * 0.6) * 0.35
  })
  return (
    <group>
      <group ref={g}>
        <Human look={who.look} gender={who.gender} pose={pose} seed={who.seed} full />
      </group>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.8, 0.9, 0.16, 8]} />
        <meshLambertMaterial color="#2b2350" />
      </mesh>
    </group>
  )
}

/** The select screen's stage: the two fighters face to face on their stands. */
export function VersusCanvas({ a, b }: { a: FighterLook; b: FighterLook | null }) {
  return (
    <Canvas dpr={weakDevice ? [1, 1.25] : [1, 1.75]} camera={{ fov: 34, position: [0, 1.4, 6.4] }} gl={{ alpha: true, antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}>
      <hemisphereLight args={['#fff1e0', '#3a2a4a', 1.2]} />
      <directionalLight position={[3, 6, 6]} intensity={1.5} />
      <pointLight position={[0, 2, 2]} intensity={6} color="#ff3d7f" distance={6} />
      <group position={[b ? -0.85 : 0, 0, 0]} rotation={[0, b ? 0.5 : 0, 0]}>
        <Human key={`a${a.seed}${a.look.outfitColor}`} look={a.look} gender={a.gender} pose="fstance" seed={a.seed} full />
      </group>
      {b && (
        <group position={[0.85, 0, 0]} rotation={[0, -0.5, 0]}>
          <Human key={`b${b.seed}`} look={b.look} gender={b.gender} pose="fstance" seed={b.seed} full />
        </group>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[2.4, 24]} />
        <meshLambertMaterial color="#2b2350" />
      </mesh>
    </Canvas>
  )
}
