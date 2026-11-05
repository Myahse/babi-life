import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { rng } from '../world3d/themes'
import { Blob, paint } from '../streetball/looks'
import { dropGazeTarget, gazeTarget } from '../avatar/expressions'
import { BALL_R, pressLead, type Volley } from './volley'
import { DT } from './phys'
import { upright } from './kit'
import { AID, BOX, Banner, Crowd, Paillote, Palm, RING, Sea, Stand, Streak, flat, grain } from './scenery'
import { replayCam } from './tape'

// Volleyball's courts (volley.ts), at the real sizes: the Palais des Sports de Treichville's (18 × 9 m, the orange
// court in its blue free zone, the attack lines at 3 m with their dashes beyond the side lines, the net 1 m deep
// with its white tape, the antennas red and white on the side lines, the referee up on his stand, the benches,
// the stands full all round, the roof's lights); the beach's (16 × 8 m of sand marked with blue bands, the posts
// padded, the sea rolling in at the side, the palms, the paillotes, the people sitting on the sand) at Grand-
// Bassam, Port-Bouët or Assinie. The players (in the air on a jump), the ball and its shade. The camera behind
// the player's side, higher on a phone held upright.

export type VVenue = 'palais' | 'bassam' | 'portbouet' | 'assinie'

const white = flat('#f8f9fa')

function Line({ a, b, w = 0.05, mat = white, y = 0.012 }: { a: [number, number]; b: [number, number]; w?: number; mat?: THREE.Material; y?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return <mesh geometry={BOX} material={mat} position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]} scale={[len, 0.004, w]} />
}

/** The net: 1 m of black mesh under the white tape, the cable to the posts, the antennas on the side lines. */
function VNet({ g, posts }: { g: Volley; posts: number }) {
  const hw = g.hw
  const top = g.netY
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')!
    x.strokeStyle = 'rgba(15,15,18,0.95)'
    x.lineWidth = 4
    for (let k = 0; k <= 64; k += 32) {
      x.beginPath()
      x.moveTo(k, 0)
      x.lineTo(k, 64)
      x.moveTo(0, k)
      x.lineTo(64, k)
      x.stroke()
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set((hw * 2 + 1) * 10, 10)
    return t
  }, [hw])
  const stripes = useMemo(() => paint('antenna', 8, 64, (c) => [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => ((c.fillStyle = i % 2 ? '#ffffff' : '#e03131'), c.fillRect(0, i * 8, 8, 8)))), [])
  return (
    <group>
      <mesh position={[0, top - 0.5, 0]}>
        <planeGeometry args={[hw * 2 + 1, 1]} />
        <meshLambertMaterial map={tex} transparent alphaTest={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={BOX} material={white} position={[0, top - 0.035, 0]} scale={[hw * 2 + 1, 0.07, 0.015]} />
      <mesh geometry={BOX} material={white} position={[0, top - 1, 0]} scale={[hw * 2 + 1, 0.05, 0.015]} />
      {/* The cable on to the posts. */}
      <mesh geometry={BOX} material={flat('#2b2f36')} position={[0, top, 0]} scale={[posts * 2, 0.012, 0.012]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={BOX} material={flat(g.rules.beach ? '#1d4ed8' : '#d9dde2')} position={[s * posts, (top + 0.3) / 2, 0]} scale={[0.12, top + 0.3, 0.12]} castShadow />
          {g.rules.beach && <mesh geometry={BOX} material={flat('#ff8200')} position={[s * posts, 1, 0]} scale={[0.3, 2, 0.3]} />}
          {/* The antenna: 1,8 m, 0,8 m over the tape, red and white. */}
          <mesh position={[s * hw, top - 1 + 0.9, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 1.8, 4]} />
            <meshLambertMaterial map={stripes} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The referee up on his stand by the post. */
function RefStand({ g, posts }: { g: Volley; posts: number }) {
  const look = useMemo(() => ({ ...randomLook('homme', rng('vref')), outfit: 'chemise', outfitColor: '#f8f9fa' }) as Look, [])
  const h = g.netY - 1.1
  return (
    <group position={[-(posts + 0.8), 0, 0]}>
      <mesh geometry={BOX} material={flat('#5b616a')} position={[0, h / 2, 0]} scale={[0.6, h, 0.6]} />
      <mesh geometry={BOX} material={flat('#3b4048')} position={[0, h + 0.02, 0]} scale={[0.8, 0.05, 0.8]} />
      <group position={[0, h, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.95, 0.95, 0.95]}>
        <Human look={look} gender="homme" pose="mark" seed={4} />
      </group>
    </group>
  )
}

function PalaisHall({ g }: { g: Volley }) {
  const hl = g.hl
  const hw = g.hw
  const floor = useMemo(() => grain('volley-free', '#1d6b84', ['#1b6680', '#207390', '#196177'], 1800, 256, [12, 8]), [])
  const court = useMemo(() => grain('volley-court', '#e8833a', ['#e07d35', '#ee8a40', '#d97633'], 1800, 256, [9, 4]), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[hw * 2 + 10, hl * 2 + 13]} />
        <meshLambertMaterial map={floor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[hw * 2, hl * 2]} />
        <meshLambertMaterial map={court} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshLambertMaterial color="#2a2f3a" />
      </mesh>
      {/* The lines: the side and end lines, the centre line, the attack lines and their dashes outside. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Line a={[-hw, s * hl]} b={[hw, s * hl]} />
          <Line a={[s * hw, -hl]} b={[s * hw, hl]} />
          <Line a={[-hw, s * 3]} b={[hw, s * 3]} />
          {[0, 1, 2, 3, 4].map((k) => (
            <group key={k}>
              <Line a={[hw + 0.2 + k * 0.35, s * 3]} b={[hw + 0.35 + k * 0.35, s * 3]} />
              <Line a={[-(hw + 0.2 + k * 0.35), s * 3]} b={[-(hw + 0.35 + k * 0.35), s * 3]} />
            </group>
          ))}
        </group>
      ))}
      <Line a={[-hw, 0]} b={[hw, 0]} w={0.06} />
      {/* The stands on three sides, the near one low under the camera. */}
      <Stand at={[hw + 5.2, 0]} len={hl * 2 + 6} rot={Math.PI / 2} rows={9} seed="palais-v1" color="#c2410c" fill={0.85} />
      <Stand at={[-(hw + 5.2), 0]} len={hl * 2 + 6} rot={-Math.PI / 2} rows={9} seed="palais-v2" color="#15803d" fill={0.85} />
      <Stand at={[0, -(hl + 6.5)]} len={hw * 2 + 10} rot={Math.PI} rows={8} seed="palais-v3" color="#c2410c" fill={0.8} />
      {/* The walls, the roof and its lights. */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={flat('#3a3f4a')} position={[s * (hw + 16), 9, 0]} scale={[0.5, 18, hl * 2 + 34]} />
      ))}
      <mesh geometry={BOX} material={flat('#3a3f4a')} position={[0, 9, -(hl + 17)]} scale={[hw * 2 + 32, 18, 0.5]} />
      <mesh geometry={BOX} material={flat('#2a2f3a')} position={[0, 18, 0]} scale={[hw * 2 + 32, 0.5, hl * 2 + 34]} />
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} geometry={BOX} material={flat('#fffbe8')} position={[(i % 3) * 7 - 7, 16.5, Math.floor(i / 3) * 9 - 13.5]} scale={[2.2, 0.15, 1]} />
      ))}
      <Banner at={[0, -(hl + 5.6)]} w={16} h={1.1} y={1.2} text="PALAIS DES SPORTS DE TREICHVILLE" bg="#f77f00" />
      <Banner at={[hw + 3.4, 0]} w={12} h={0.9} y={0.55} text="VOLLEY-BALL · CÔTE D'IVOIRE" bg="#009e60" rot={-Math.PI / 2} />
      {/* The benches, the scorers' table. */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={flat('#101828')} position={[hw + 2.6, 0.25, s * 5]} scale={[0.6, 0.5, 4]} />
      ))}
      <mesh geometry={BOX} material={flat('#f77f00')} position={[hw + 2.6, 0.4, 0]} scale={[0.8, 0.8, 2.6]} />
    </group>
  )
}

function Beach({ g, venue }: { g: Volley; venue: VVenue }) {
  const sand = useMemo(() => grain('sand', '#e8d2a0', ['#dcc38e', '#f0dcae', '#d4b97f', '#c9ad73'], 6000, 256, [30, 30]), [])
  const band = flat('#1d4ed8')
  const hw = g.hw
  const hl = g.hl
  const people = useMemo(() => {
    const r = rng(`beach-${venue}`)
    const out: [number, number, number][] = []
    for (let i = 0; i < 70; i++) {
      const side = r() < 0.5 ? -1 : 1
      out.push([-hw - 3 - r() * 6, -0.45, (r() - 0.5) * (hl * 2 + 6)])
      if (r() < 0.5) out.push([(r() - 0.5) * 10, -0.45, side * (hl + 3.5 + r() * 4)])
    }
    return out
  }, [hw, hl, venue])
  const name = venue === 'bassam' ? 'GRAND-BASSAM' : venue === 'assinie' ? 'ASSINIE-MAFIA' : 'PORT-BOUËT'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshLambertMaterial map={sand} />
      </mesh>
      {/* The bands that mark the court, pegged in the sand. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Line a={[-hw, s * hl]} b={[hw, s * hl]} w={0.06} mat={band} y={0.02} />
          <Line a={[s * hw, -hl]} b={[s * hw, hl]} w={0.06} mat={band} y={0.02} />
        </group>
      ))}
      {/* The sea at the side, the waves rolling in. */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <Sea z={-(hw + 16)} />
      </group>
      {Array.from({ length: 9 }, (_, i) => (
        <Palm key={i} at={[-(hw + 11 + (i % 3) * 4), -hl - 12 + i * 5]} h={7 + (i % 3) * 1.5} seed={i + 20} />
      ))}
      <Paillote at={[-(hw + 9), hl + 6]} rot={0.4} />
      <Paillote at={[-(hw + 14), -2]} s={1.2} rot={-0.3} />
      <Paillote at={[6, -(hl + 10)]} rot={0.2} />
      <Crowd seats={people} seed={`beach-${venue}`} />
      <Banner at={[0, -(hl + 5)]} w={9} h={1} y={1.4} text={`BEACH-VOLLEY · ${name}`} bg="#ff8200" />
      {[-4.5, 4.5].map((x) => (
        <mesh key={x} geometry={BOX} material={flat('#8b6a45')} position={[x, 1.1, -(hl + 5)]} scale={[0.1, 2.2, 0.1]} />
      ))}
      {/* A parasol or two, the cooler. */}
      {[
        [-(hw + 4), 6],
        [-(hw + 5), -7],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={BOX} material={flat('#f8f9fa')} position={[0, 1.2, 0]} scale={[0.05, 2.4, 0.05]} />
          <mesh position={[0, 2.4, 0]} material={flat(i ? '#e03131' : '#fcc419')}>
            <coneGeometry args={[1.4, 0.5, 8]} />
          </mesh>
        </group>
      ))}
      {venue === 'bassam' && <Colonial at={[-(hw - 2), -(hl + 30)]} />}
      {venue === 'portbouet' && <Lighthouse at={[16, -(hl + 40)]} />}
    </group>
  )
}

/** Grand-Bassam's old colonial houses behind the beach: the verandas, the faded colours. */
function Colonial({ at }: { at: [number, number] }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      {['#e9c46a', '#e76f51', '#f4a261'].map((c, i) => (
        <group key={i} position={[i * 13, 0, 0]}>
          <mesh geometry={BOX} material={flat(c)} position={[0, 3.5, 0]} scale={[11, 7, 8]} />
          <mesh geometry={BOX} material={flat('#7a3e2a')} position={[0, 7.3, 0]} scale={[12, 0.6, 9]} />
          <mesh geometry={BOX} material={flat('#f1f3f5')} position={[0, 3.6, 4.2]} scale={[11, 0.2, 1.2]} />
        </group>
      ))}
    </group>
  )
}

/** Port-Bouët's lighthouse down the shore. */
function Lighthouse({ at }: { at: [number, number] }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 14, 0]} material={flat('#f8f9fa')}>
        <cylinderGeometry args={[1.4, 2.2, 28, 8]} />
      </mesh>
      <mesh position={[0, 29, 0]} material={flat('#e03131')}>
        <cylinderGeometry args={[1.6, 1.6, 2.2, 8]} />
      </mesh>
    </group>
  )
}

export function VolleyGround({ g, venue }: { g: Volley; venue: VVenue }) {
  const posts = g.hw + (g.rules.beach ? 0.8 : 1)
  return (
    <group>
      {g.rules.beach ? <Beach g={g} venue={venue} /> : <PalaisHall g={g} />}
      <VNet g={g} posts={posts} />
      <RefStand g={g} posts={posts} />
    </group>
  )
}

const CLOCKED = new Set<Pose>(['bump', 'setball', 'spike', 'serve', 'block', 'netblock', 'dive'])

export function VolleyPlayer({ g, i, look, gender }: { g: Volley; i: number; look: Look; gender: 'femme' | 'homme' }) {
  const root = useRef<THREE.Group>(null)
  const mark = useRef<THREE.Group>(null)
  const [view, setView] = useState<{ pose: Pose; speed: number; take: number }>({ pose: 'idle', speed: 0, take: 0 })
  useFrame(() => {
    const p = g.ps[i]
    const r = root.current
    if (!r) return
    r.position.set(p.x, p.y, p.z)
    r.rotation.y = p.face
    if (mark.current) {
      mark.current.visible = i === g.me && !replayCam.on
      mark.current.position.y = -p.y + 0.03
    }
    const speed = Math.round(Math.hypot(p.vx, p.vz))
    if (p.pose !== view.pose || speed !== view.speed || p.take !== view.take) setView({ pose: p.pose, speed, take: p.take })
  })
  return (
    <group ref={root}>
      <Blob size={1.1} />
      <Human look={look} gender={gender} faceId={`volley-${i}`} pose={view.pose} seed={i * 5.1} speed={view.speed || undefined} take={view.take} clock={CLOCKED.has(view.pose) ? () => g.ps[i].at : undefined} />
      <group ref={mark}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.58, 28]} />
          <meshBasicMaterial color="#ff8200" transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  )
}

/** The ball: yellow and blue panels (a beach ball whiter) turning with its flight, its streak on a hard hit, its shade (darker as it comes down). */
export function VolleyBall({ g }: { g: Volley }) {
  const ball = useRef<THREE.Mesh>(null)
  const shade = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const size = useRef(BALL_R)
  const tex = useMemo(
    () =>
      paint(`vball-${g.rules.beach ? 1 : 0}`, 128, 64, (c) => {
        const cols = g.rules.beach ? ['#ffffff', '#fcc419', '#ffffff', '#1d4ed8'] : ['#fcc419', '#1d4ed8', '#fcc419', '#ffffff']
        for (let i = 0; i < 12; i++) {
          c.fillStyle = cols[i % 4]
          c.fillRect(i * 11, 0, 11, 64)
        }
      }),
    [g.rules.beach],
  )
  const shadeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }), [])
  const seen = useMemo(() => gazeTarget('ball', 40, 2), [])
  useEffect(() => () => dropGazeTarget('ball'), [])
  const spin = useRef(0)
  useFrame((_, dt) => {
    const b = g.ball
    if (!ball.current || !shade.current) return
    const c = camera.position
    const s = Math.max(1.2, Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z) / 11)
    size.current = BALL_R * s
    ball.current.position.set(b.x, Math.max(BALL_R, b.y), b.z)
    ball.current.scale.setScalar(s)
    // (A float serve hardly turns: that's why it floats.)
    spin.current += Math.min(dt, 0.05) * (b.float ? 0.6 : Math.min(14, Math.hypot(b.vx, b.vz) * 1.4 + Math.abs(b.spin) * 0.03))
    ball.current.rotation.set(spin.current, 0.6, 0)
    shade.current.position.set(b.x, 0.02, b.z)
    const k = Math.max(0.3, 1 - b.y / 6)
    shade.current.scale.set(s * k, s * k, 1)
    shadeMat.opacity = 0.15 + 0.35 * k
    seen.set(b.x, b.y, b.z)
  })
  return (
    <group>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BALL_R, 14, 10]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      <Streak ball={g.ball} size={() => size.current} color="#fff4c2" from={15} hide={() => g.ball.held || replayCam.rate < 1} />
      <mesh ref={shade} rotation={[-Math.PI / 2, 0, 0]} material={shadeMat}>
        <circleGeometry args={[BALL_R * 1.3, 14]} />
      </mesh>
    </group>
  )
}

/** A perfect press: within this of its best moment (the « Parfait » the match judges: q above 0,8 of 0,32). */
const PERFECT = 0.064

/**
 * What helps read and time the ball, on the floor: where a ball coming over will land (a ring tightening as it comes
 * down), the player's touch spot with its timing ring closing in (it meets the inner one when to press: green then,
 * the spike's when to jump), and, with a spike or the serve to play, where the stick sends it on the other side.
 */
export function VolleyAids({ g }: { g: Volley }) {
  const land = useRef<THREE.Mesh>(null)
  const spot = useRef<THREE.Mesh>(null)
  const closing = useRef<THREE.Mesh>(null)
  const aimed = useRef<THREE.Mesh>(null)
  const mats = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })), [])
  useFrame(() => {
    if (!land.current || !spot.current || !closing.current || !aimed.current) return
    const b = g.ball
    const me = g.ps[g.me]
    const e = g.end[me.team]
    const live = g.phase === 'rally' && !replayCam.on
    const n = g.pathN - 1
    const lx = n >= 0 ? g.path[n * 4] : 0
    const lz = n >= 0 ? g.path[n * 4 + 2] : 0
    const toLand = g.pathT + (n + 1) * DT - g.time
    // The landing: a ball of theirs coming down on our side.
    land.current.visible = live && n > 0 && b.team !== me.team && Math.sign(lz) === e && toLand > 0
    if (land.current.visible) {
      land.current.position.set(lx, 0.03, lz)
      land.current.scale.setScalar(0.3 + Math.min(1.5, toLand) * 0.4)
      mats[0].opacity = 0.85 - Math.min(0.5, toLand * 0.35)
    }
    const pl = me.plan
    const until = pl ? pl.t - pressLead(pl.kind) - g.time : 9
    spot.current.visible = closing.current.visible = live && me.human && !!pl && pl.t - g.time < 1.6 && until > -0.2
    if (pl && spot.current.visible) {
      spot.current.position.set(pl.x, 0.035, pl.z)
      spot.current.scale.setScalar(0.5)
      closing.current.position.set(pl.x, 0.04, pl.z)
      closing.current.scale.setScalar(0.5 + Math.min(1.6, Math.max(0, until) * 2.4))
      const c = Math.abs(until) < PERFECT ? AID.perfect : pl.kind === 'spike' ? AID.spike : AID.plain
      mats[1].color.copy(c)
      mats[2].color.copy(c)
      mats[2].opacity = until < 0 ? 0.35 : 0.85
    }
    // The aim: the spike (the stick across, as the match reads it) or the serve.
    const serving = g.phase === 'toss' || (g.phase === 'serve' && g.rot[g.serving][0] === g.me)
    const spiking = live && !!pl && pl.kind === 'spike'
    aimed.current.visible = me.human && !replayCam.on && (spiking || (serving && g.rot[g.serving][0] === g.me))
    if (aimed.current.visible) {
      const mx = Math.max(-1, Math.min(1, me.mx))
      if (spiking) aimed.current.position.set(e * mx * (g.hw - 0.9), 0.04, -e * (2.6 + 0.6 * (g.hl - 4)))
      else aimed.current.position.set(e * mx * (g.hw - 0.75), 0.04, -e * (g.hl - 1.9))
      aimed.current.scale.setScalar(0.6)
    }
  })
  return (
    <group>
      <mesh ref={land} geometry={RING} material={mats[0]} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
      <mesh ref={spot} geometry={RING} material={mats[1]} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
      <mesh ref={closing} geometry={RING} material={mats[2]} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
      <mesh ref={aimed} rotation={[-Math.PI / 2, 0, Math.PI / 4]} visible={false}>
        <ringGeometry args={[0.55, 1, 4]} />
        <meshBasicMaterial color="#ff8200" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Where the camera stands behind the player's side, and where it looks; upright: a phone held up. */
export const VCAM = {
  wide: { high: 9.5, back: 8.5, look: -7.5, fov: 48, pan: 0.25 },
  up: { high: 16, back: 10, look: -5.5, fov: 58, pan: 0.3 },
}

/** The camera behind the player's side, panning after the ball eased, cut at the change of ends; the replay's low one. */
export function VolleyCam({ g }: { g: Volley }) {
  const { camera, size } = useThree()
  const at = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3() }), [])
  const was = useRef({ end: 0, replay: false, pan: 0 })
  useFrame((_, raw) => {
    // (The lab's film steps the match by a fixed amount per frame: the camera keeps the same pace.)
    const film = import.meta.env.DEV ? (globalThis as { sportsFilm?: { dt: number } }).sportsFilm : undefined
    const dt = Math.min(film ? film.dt : raw, 0.1)
    const cam = camera as THREE.PerspectiveCamera
    const e = g.end[g.ps[g.me].team]
    const c = upright(size) ? VCAM.up : VCAM.wide
    const w = was.current
    const { pos, tgt } = tmp
    const cut = w.end !== e || w.replay !== replayCam.on
    w.end = e
    w.replay = replayCam.on
    let fov = c.fov
    if (replayCam.on) {
      // Low at the side of the net, the attack and the floor it hit in the frame.
      pos.set(g.hw + 4.5, 2.2, replayCam.z * 0.3)
      tgt.set(g.ball.x * 0.5, 1.6, g.ball.z * 0.6)
      fov = 42
    } else {
      const want = g.ball.x * 0.7 + g.ps[g.me].x * 0.3
      w.pan = cut ? want : w.pan + (want - w.pan) * (1 - Math.exp(-2 * dt))
      pos.set(w.pan * c.pan, c.high, e * (g.hl + c.back))
      tgt.set(w.pan * c.pan * 0.8, 0, e * (g.hl + c.look))
    }
    const k = cut ? 1 : 1 - Math.exp(-(replayCam.on ? 6 : 4) * dt)
    at.current.lerp(pos, k)
    look.current.lerp(tgt, k)
    cam.position.copy(at.current)
    cam.lookAt(look.current)
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
  })
  return null
}
