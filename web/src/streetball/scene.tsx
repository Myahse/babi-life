import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { LowHuman } from '../avatar/LowHuman'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { rng } from '../world3d/themes'
import { StaticMerge } from '../world3d/staticMerge'
import { PostedBubble, likesFor } from '../world3d/fans'
import { ARC, BAR, BOARD_Z, COUNTDOWN, COURT, HOOP, MOUTH, PITCH, RIM_Y, holder, type Game } from './game'
import { Arc, Line } from './marks'
import { Stadium } from './stadium'
import { asphalt, Blob, grassMaterial, Net, paint, turf } from './looks'

// What the street match looks like: the court chalked and painted on the
// concrete under its basket on a stand (or the maracana's green carpet and
// its two little goals), the grillage all round, the houses of the quarter
// behind, the people watching along the fence (phones up, filming, posting),
// the players and the ball. Everything moves from the game (game.ts), read
// every frame; React only hears of a pose when it changes.

const BOX = new THREE.BoxGeometry(1, 1, 1)
const flat = (color: string) => new THREE.MeshLambertMaterial({ color })
const steel = flat('#4b5563')
const white = flat('#f8f9fa')
const orange = flat('#e85d04')
const dark = flat('#1f2933')
const pad = flat('#1d4ed8')
// The street court's chain net: grey steel links, not a white string one.
const netMat = new THREE.MeshLambertMaterial({ color: '#c3c9d1', wireframe: true })

/** The quarter's walls: the paint and its grime, two windows with their grille, a door; now and then a sign painted on. */
const SIGNS = ['CABINE', 'COIFFURE', 'MAQUIS', 'QUINCAILLERIE', 'TRANSFERT', 'BOUTIQUE', 'ATTIÉKÉ', 'PRESSING']
function facade(color: string, k: number) {
  return paint(`facade${color}${k}`, 256, 192, (g) => {
    const r = rng(`facade${color}${k}`)
    g.fillStyle = color
    g.fillRect(0, 0, 256, 192)
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
      g.fillRect(r() * 256, r() * 192, 2, 2)
    }
    // The red earth splashed up the foot of the wall by the rains.
    const foot = g.createLinearGradient(0, 150, 0, 192)
    foot.addColorStop(0, 'rgba(120,60,30,0)')
    foot.addColorStop(1, 'rgba(120,60,30,0.45)')
    g.fillStyle = foot
    g.fillRect(0, 150, 256, 42)
    // The door, the windows and their grilles.
    g.fillStyle = ['#3d5a80', '#6b3e26', '#2f6b3a', '#8d2f2f'][k % 4]
    g.fillRect(108, 96, 40, 96)
    for (const x of [30, 186]) {
      g.fillStyle = '#26323e'
      g.fillRect(x, 82, 40, 44)
      g.strokeStyle = '#d9dee3'
      g.lineWidth = 2
      for (let gx = x + 8; gx < x + 40; gx += 8) {
        g.beginPath()
        g.moveTo(gx, 82)
        g.lineTo(gx, 126)
        g.stroke()
      }
    }
    if (k % 3 === 0) {
      g.fillStyle = 'rgba(255,255,255,0.85)'
      g.fillRect(20, 20, 216, 40)
      g.fillStyle = ['#c2410c', '#1d4ed8', '#15803d'][k % 3 === 0 ? Math.floor(r() * 3) : 0]
      g.font = "900 30px 'Baloo 2', Impact, sans-serif"
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(SIGNS[Math.floor(r() * SIGNS.length)], 128, 42, 200)
    }
  })
}

/** Corrugated tin: light and dark stripes, a bit of rust. */
function tinTexture() {
  return paint(
    'tin',
    64,
    64,
    (g) => {
      for (let x = 0; x < 64; x += 8) {
        g.fillStyle = '#a7b0ba'
        g.fillRect(x, 0, 4, 64)
        g.fillStyle = '#7f8893'
        g.fillRect(x + 4, 0, 4, 64)
      }
      g.fillStyle = 'rgba(150,70,30,0.35)'
      g.fillRect(10, 40, 30, 18)
    },
    [4, 4],
  )
}


/* ---------- The fence and the quarter ---------- */

let wireMat: THREE.MeshLambertMaterial | null = null
function wire() {
  if (!wireMat) {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const g = c.getContext('2d')!
    g.fillStyle = '#c9d1c9'
    for (let i = 0; i < 16; i++) {
      g.fillRect(i, i, 1, 1)
      g.fillRect(15 - i, i, 1, 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    t.repeat.set(12, 6)
    wireMat = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, depthWrite: false })
  }
  return wireMat
}
const fencePost = flat('#2f6b3a')
const bark = flat('#6b4a2e')
const leaves = flat('#2f7d32')
const lampMat = new THREE.MeshBasicMaterial({ color: '#fff6d5' })

/** The grillage round the ground: green posts, a top rail, the chain-link between. Half-sizes hx × hz, centred on z0; the side towards the camera is left out (it would be in the way). */
function Fence({ hx, hz, z0 = 0 }: { hx: number; hz: number; z0?: number }) {
  const H = 2.6
  const sides: { at: [number, number]; len: number; rot: number }[] = [
    { at: [0, z0 - hz], len: hx * 2, rot: 0 },
    { at: [-hx, z0], len: hz * 2, rot: Math.PI / 2 },
    { at: [hx, z0], len: hz * 2, rot: Math.PI / 2 },
  ]
  return (
    <group>
      {sides.map((s, i) => (
        <group key={i} position={[s.at[0], 0, s.at[1]]} rotation={[0, s.rot, 0]}>
          <mesh position={[0, H / 2, 0]} material={wire()} scale={[s.len, H, 1]}>
            <planeGeometry />
          </mesh>
          <mesh geometry={BOX} material={fencePost} position={[0, H, 0]} scale={[s.len, 0.06, 0.06]} />
          {[...Array(Math.round(s.len / 2.5) + 1)].map((_, k) => (
            <mesh key={k} geometry={BOX} material={fencePost} position={[-s.len / 2 + (k * s.len) / Math.round(s.len / 2.5), H / 2, 0]} scale={[0.08, H, 0.08]} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** The houses of the quarter round the ground: low walls of colour, tin roofs, a tree or two; `gap`: how far back from the fence they start. */
export function Quarter({ hx, hz, seed, gap = 9 }: { hx: number; hz: number; seed: string; gap?: number }) {
  const houses = useMemo(() => {
    const r = rng(`quarter${seed}`)
    const COLORS = ['#e9c46a', '#f4a261', '#c8d5b9', '#8ecae6', '#f1faee', '#e07a5f', '#d4a373']
    const out: { p: [number, number, number]; s: [number, number, number]; c: string; roof: boolean }[] = []
    for (const side of [0, 1, 2, 3]) {
      const along = side < 2 ? hx : hz
      for (let u = -along - 6; u < along + 6; u += 6 + r() * 4) {
        const w = 5 + r() * 3
        const d = 5 + r() * 2
        const h = 3 + (r() < 0.25 ? 3 : 0)
        const off = (side < 2 ? hz : hx) + gap + r() * 3
        const [x, z] = side === 0 ? [u, -off] : side === 1 ? [u, off] : side === 2 ? [-off, u] : [off, u]
        // The side towards the camera stays open, past the people.
        if (side === 1 && Math.abs(u) < along) continue
        out.push({ p: [x, h / 2, z], s: side < 2 ? [w, h, d] : [d, h, w], c: COLORS[Math.floor(r() * COLORS.length)], roof: r() < 0.6 })
      }
    }
    return out
  }, [hx, hz, seed, gap])
  // Each wall painted (a few variants of each colour), the roofs in corrugated tin.
  const mats = useMemo(() => {
    const m = new Map<string, THREE.Material>()
    houses.forEach((h, i) => {
      const key = `${h.c}${i % 3}`
      if (!m.has(key)) m.set(key, new THREE.MeshLambertMaterial({ map: facade(h.c, i % 3) }))
    })
    return m
  }, [houses])
  const tin = useMemo(() => new THREE.MeshLambertMaterial({ map: tinTexture() }), [])
  // Mango trees and a wooden electric pole or two between the houses and the fence.
  const trees = useMemo(() => {
    const r = rng(`trees${seed}`)
    return [...Array(6)].map((_, i) => {
      const side = i % 3
      const u = (r() - 0.5) * (side === 0 ? hx * 1.6 : hz * 1.4)
      const off = (side === 0 ? hz : hx) + Math.min(5, gap - 2) + r() * 2
      return { p: (side === 0 ? [u, -off] : side === 1 ? [-off, u] : [off, u]) as [number, number], s: 0.8 + r() * 0.5 }
    })
  }, [hx, hz, seed, gap])
  return (
    <group>
      {houses.map((h, i) => (
        <group key={i}>
          <mesh geometry={BOX} material={mats.get(`${h.c}${i % 3}`)} position={h.p} scale={h.s} />
          {h.roof && <mesh geometry={BOX} material={tin} position={[h.p[0], h.s[1] + 0.06, h.p[2]]} scale={[h.s[0] + 0.4, 0.12, h.s[2] + 0.4]} />}
        </group>
      ))}
      {trees.map((t, i) => (
        <group key={i} position={[t.p[0], 0, t.p[1]]} scale={t.s}>
          <mesh geometry={BOX} material={bark} position={[0, 1.4, 0]} scale={[0.35, 2.8, 0.35]} castShadow />
          <mesh material={leaves} position={[0, 3.6, 0]} scale={[2.3, 1.7, 2.3]} castShadow>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          <mesh material={leaves} position={[0.9, 3.1, 0.4]} scale={[1.3, 1.1, 1.3]} castShadow>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---------- The grounds ---------- */

function Court() {
  const { x, z0, z1 } = COURT
  const ground = useMemo(() => new THREE.MeshLambertMaterial({ map: asphalt() }), [])
  const court = useMemo(() => flat('#2c6aa0'), [])
  const keyPaint = useMemo(() => flat('#d9480f'), [])
  const sand = useMemo(() => flat('#c9a77a'), [])
  const logo = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        transparent: true,
        map: paint('courtlogo', 256, 128, (g) => {
          g.clearRect(0, 0, 256, 128)
          g.font = "900 64px 'Baloo 2', Impact, sans-serif"
          g.textAlign = 'center'
          g.textBaseline = 'middle'
          g.lineWidth = 8
          g.strokeStyle = 'rgba(255,255,255,0.9)'
          g.strokeText('BABI', 128, 46)
          g.fillStyle = '#ff8200'
          g.fillText('BABI', 128, 46)
          g.font = "800 26px 'Baloo 2', Impact, sans-serif"
          g.fillStyle = 'rgba(255,255,255,0.92)'
          g.fillText('STREET BALL', 128, 98)
        }),
      }),
    [],
  )
  return (
    <group>
      <mesh geometry={BOX} material={sand} position={[0, -0.05, 0]} scale={[90, 0.1, 90]} receiveShadow />
      <mesh geometry={BOX} material={ground} position={[0, 0.01, (z0 + z1) / 2]} scale={[x * 2 + 2.4, 0.04, z1 - z0 + 2.4]} receiveShadow />
      {/* The court painted blue inside its lines, the key orange, the quarter's logo at half-court */}
      <mesh geometry={BOX} material={court} position={[0, 0.028, (z0 + z1) / 2]} scale={[x * 2, 0.01, z1 - z0]} receiveShadow />
      <mesh geometry={BOX} material={keyPaint} position={[0, 0.032, z0 + 2.9]} scale={[4.9, 0.01, 5.8]} receiveShadow />
      <mesh material={logo} position={[0, 0.036, z1 - 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.4, 2.2]} />
      </mesh>
      {/* The floodlights at the corners, for the night games */}
      {[-1, 1].map((sx) =>
        [z0 - 1.2, z1 + 1.2].map((zz) => (
          <group key={`${sx}${zz}`} position={[sx * (x + 1.4), 0, zz]}>
            <mesh geometry={BOX} material={steel} position={[0, 3.5, 0]} scale={[0.14, 7, 0.14]} castShadow />
            <mesh geometry={BOX} material={steel} position={[-sx * 0.3, 7, 0]} scale={[0.9, 0.12, 0.3]} />
            <mesh geometry={BOX} material={lampMat} position={[-sx * 0.5, 6.85, 0]} scale={[0.5, 0.14, 0.26]} />
          </group>
        )),
      )}
      <Line a={[-2.45, z0]} b={[-2.45, z0 + 5.8]} />
      <Line a={[2.45, z0]} b={[2.45, z0 + 5.8]} />
      <Line a={[-2.45, z0 + 5.8]} b={[2.45, z0 + 5.8]} />
      <Arc at={[0, z0 + 5.8]} r={1.8} from={Math.PI} to={Math.PI * 2} />
      {/* The lines round the half-court, and the arc: past it a basket counts 2 */}
      <Line a={[-x, z0]} b={[x, z0]} />
      <Line a={[-x, z1]} b={[x, z1]} />
      <Line a={[-x, z0]} b={[-x, z1]} />
      <Line a={[x, z0]} b={[x, z1]} />
      <Line a={[-ARC, z0]} b={[-ARC, HOOP[1]]} />
      <Line a={[ARC, z0]} b={[ARC, HOOP[1]]} />
      <Arc at={HOOP} r={ARC} from={Math.PI} to={Math.PI * 2} />
      {/* The stand behind the baseline: the pole, the arm, the board with its square */}
      <mesh geometry={BOX} material={steel} position={[0, 1.75, z0 - 0.8]} scale={[0.2, 3.5, 0.2]} castShadow />
      <mesh geometry={BOX} material={steel} position={[0, 3.35, (z0 - 0.8 + BOARD_Z) / 2]} scale={[0.12, 0.12, BOARD_Z - z0 + 0.8]} />
      <mesh geometry={BOX} material={pad} position={[0, 1, z0 - 0.8]} scale={[0.32, 2, 0.32]} />
      <mesh geometry={BOX} material={dark} position={[0, 3.42, BOARD_Z - 0.05]} scale={[1.9, 1.15, 0.05]} castShadow />
      <mesh geometry={BOX} material={white} position={[0, 3.42, BOARD_Z - 0.02]} scale={[1.78, 1.03, 0.04]} />
      <mesh geometry={BOX} material={orange} position={[0, 3.3, BOARD_Z]} scale={[0.59, 0.04, 0.01]} />
      <mesh geometry={BOX} material={orange} position={[-0.29, 3.18, BOARD_Z]} scale={[0.04, 0.45, 0.01]} />
      <mesh geometry={BOX} material={orange} position={[0.29, 3.18, BOARD_Z]} scale={[0.04, 0.45, 0.01]} />
    </group>
  )
}

/** The ring and the net, hinged on the board: pulled down by a dunker hanging on it, shaking back; the net flies as the ball goes through. */
function Rim({ g }: { g: Game }) {
  const hinge = useRef<THREE.Group>(null)
  const net = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const h = hinge.current
    if (!h) return
    const hanging = g.ps.some((p) => p.act === 'dunk' && p.at > 0.5 && p.at < 1.15)
    const since = g.time - g.rim.t
    const shake = since >= 0 && since < 1.6 ? Math.sin(since * 34) * g.rim.amp * Math.exp(-since * 3.5) : 0
    h.rotation.x = hanging ? 0.13 + Math.sin(g.time * 30) * 0.02 : shake
    const s = g.time - g.swish
    if (net.current) net.current.scale.y = s >= 0 && s < 0.5 ? 1 + Math.sin((s / 0.5) * Math.PI) * 0.45 : 1
  })
  const back = HOOP[1] - BOARD_Z
  return (
    <group ref={hinge} position={[HOOP[0], RIM_Y, BOARD_Z]}>
      <mesh position={[0, 0, back]} rotation={[Math.PI / 2, 0, 0]} material={orange}>
        <torusGeometry args={[0.23, 0.02, 6, 20]} />
      </mesh>
      <mesh geometry={BOX} material={orange} position={[0, 0, back / 2]} scale={[0.06, 0.03, back - 0.2]} />
      <mesh ref={net} position={[0, -0.2, back]} material={netMat}>
        <cylinderGeometry args={[0.22, 0.14, 0.4, 10, 3, true]} />
      </mesh>
    </group>
  )
}

function Pitch() {
  const { x, z } = PITCH
  // The grass's blades (looks.tsx), the mown stripes lighter.
  const grass = grassMaterial('#4aa956')
  const stripe = grassMaterial('#58b964')
  const sand = useMemo(() => flat('#c9a77a'), [])
  const turfs = useMemo(() => ({ all: turf(x * 2 + 3, z * 2 + 2, 0, 0), stripes: [...Array(6)].map((_, i) => turf(3, z * 2, -x + 3 + i * 6, 0)) }), [x, z])
  return (
    <group>
      <mesh geometry={BOX} material={sand} position={[0, -0.05, 0]} scale={[110, 0.1, 90]} receiveShadow />
      <mesh geometry={turfs.all} material={grass} position={[0, 0.03, 0]} receiveShadow />
      {/* Mown stripes */}
      {turfs.stripes.map((t, i) => (
        <mesh key={i} geometry={t} material={stripe} position={[-x + 3 + i * 6, 0.033, 0]} receiveShadow />
      ))}
      <Line a={[-x, -z]} b={[x, -z]} />
      <Line a={[-x, z]} b={[x, z]} />
      <Line a={[-x, -z]} b={[-x, z]} />
      <Line a={[x, -z]} b={[x, z]} />
      <Line a={[0, -z]} b={[0, z]} />
      <Arc at={[0, 0]} r={3} from={0} to={Math.PI * 2} />
      <Arc at={[-x, 0]} r={6} from={-Math.PI / 2} to={Math.PI / 2} />
      <Arc at={[x, 0]} r={6} from={Math.PI / 2} to={(Math.PI * 3) / 2} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * x, 0, 0]}>
          {[-MOUTH, MOUTH].map((zz) => (
            <mesh key={zz} geometry={BOX} material={white} position={[0, BAR / 2, zz]} scale={[0.12, BAR, 0.12]} castShadow />
          ))}
          <mesh geometry={BOX} material={white} position={[0, BAR, 0]} scale={[0.12, 0.12, MOUTH * 2 + 0.12]} castShadow />
        </group>
      ))}
    </group>
  )
}

/** The goals' nets, apart: they give where the ball hits them (looks.tsx Net). */
function Nets({ g }: { g: Game }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * PITCH.x, 0, 0]}>
          <Net mouth={MOUTH} bar={BAR} depth={1} dir={s as 1 | -1} ball={() => g.ball} at={s * PITCH.x} />
        </group>
      ))}
    </>
  )
}

/** The ground, its markings, the fence, the quarter round it (all baked into a few meshes). */
export function Ground({ g, seed, teams }: { g: Game; seed: string; /** The sides' names, for the stadium's screens. */ teams?: [string, string] }) {
  const basket = g.sport === 'basket'
  // The console's eleven: the stadium.
  if (!basket && g.size === 11) return <Stadium g={g} teams={teams} />
  return (
    <>
      <StaticMerge>
        {basket ? <Court /> : <Pitch />}
        {basket ? <Fence hx={8.6} hz={8.15} z0={-0.15} /> : <Fence hx={19.6} hz={11.5} />}
        {basket ? <Quarter hx={8.6} hz={8.15} seed={seed} /> : <Quarter hx={19.6} hz={11.5} seed={seed} />}
      </StaticMerge>
      {basket ? <Rim g={g} /> : <Nets g={g} />}
    </>
  )
}

/* ---------- The players and the ball ---------- */

/** One player: placed every frame; the pose handed to React when it changes. The player's own one has a ring under the feet. */
/** The street's moves and the men they beat: timed on the move itself (the ball goes with the feet, on every phone). */
const MOVE_POSES = new Set<Pose>(['stepover', 'roulette', 'poke', 'rainbow', 'feint', 'flick', 'backheel', 'juggle', 'nutmegged', 'lookup', 'flinch'])
/** Past this from the camera, the stadium's team disc grows with the distance, so it stays as big on the screen. */
const DISC_FROM = 22

export function PlayerView({ g, i, look, gender, kit }: { g: Game; i: number; look: Look; gender: 'femme' | 'homme'; /** The team's colour: at the stadium, a disc under each player says whose side they're on from the far end. */ kit?: string }) {
  const root = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const mark = useRef<THREE.Group>(null)
  const disc = useRef<THREE.Group>(null)
  const [view, setView] = useState<{ pose: Pose; speed: number; take: number }>({ pose: 'idle', speed: 0, take: 0 })
  useFrame(({ camera }) => {
    const p = g.ps[i]
    const r = root.current
    if (!r) return
    // The ring goes with the local hands (the console moves them from one team-mate to another).
    if (mark.current) mark.current.visible = i === g.me
    r.position.set(p.x, 0, p.z)
    r.rotation.y = p.face
    inner.current?.scale.set(p.flip ? -1 : 1, 1, 1)
    if (disc.current) {
      // The phone's own player has the marker instead.
      disc.current.visible = i !== g.me
      const s = Math.max(1, Math.min(3, r.position.distanceTo(camera.position) / DISC_FROM))
      disc.current.scale.set(s, s, s)
    }
    const speed = Math.round(Math.hypot(p.vx, p.vz))
    // (A street move done twice in a row starts over: its count.)
    if (p.pose !== view.pose || speed !== view.speed || p.take !== view.take) setView({ pose: p.pose, speed, take: p.take })
  })
  // Only the phone's own player: at a court the other humans are players too, and a ring on each hid which one was yours. Bigger on the stadium's pitch, seen from further.
  const k = g.size === 11 ? 1.8 : 1
  return (
    <group ref={root}>
      <Blob />
      {kit && g.size === 11 && (
        // A white edge round the colour, so a green side still shows on the grass.
        <group ref={disc} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh renderOrder={2}>
            <ringGeometry args={[0.3, 0.46, 24]} />
            <meshBasicMaterial color={kit} transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <mesh renderOrder={2}>
            <ringGeometry args={[0.46, 0.52, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.75} depthWrite={false} />
          </mesh>
        </group>
      )}
      <group ref={inner}>
        <Human look={look} gender={gender} pose={view.pose} seed={i * 7.3} speed={view.speed || undefined} take={view.take} clock={MOVE_POSES.has(view.pose) ? () => g.ps[i].at : undefined} />
      </group>
      <group ref={mark} visible={i === g.me}>
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[k, k, k]}>
          <ringGeometry args={[0.45, 0.58, 28]} />
          <meshBasicMaterial color="#ff8200" transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 2.35 + (k - 1) * 0.5, 0]} rotation={[Math.PI, 0, 0]} scale={[k, k, k]}>
          <coneGeometry args={[0.13, 0.26, 4]} />
          <meshBasicMaterial color="#ff8200" />
        </mesh>
      </group>
    </group>
  )
}

function useBallTexture(basket: boolean) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const x = c.getContext('2d')
    if (x) {
      x.fillStyle = basket ? '#d8641f' : '#f6f6f6'
      x.fillRect(0, 0, 128, 64)
      x.fillStyle = x.strokeStyle = basket ? '#2a1a10' : '#222222'
      if (basket) {
        // The seams.
        x.lineWidth = 3
        for (const sx of [32, 96]) x.fillRect(sx - 1.5, 0, 3, 64)
        x.fillRect(0, 30.5, 128, 3)
        x.beginPath()
        x.ellipse(64, 32, 22, 40, 0, 0, Math.PI * 2)
        x.stroke()
      } else
        for (const [px, py] of [
          [16, 32],
          [48, 14],
          [48, 50],
          [80, 32],
          [112, 14],
          [112, 50],
        ]) {
          x.beginPath()
          x.arc(px, py, 8, 0, Math.PI * 2)
          x.fill()
        }
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [basket])
}

/** The ball, spinning as it goes, and its shadow on the ground (smaller and fainter as it goes up). */
export function BallView({ g }: { g: Game }) {
  const basket = g.sport === 'basket'
  const tex = useBallTexture(basket)
  const ball = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }), [])
  useFrame((_, dt) => {
    const b = g.ball
    const m = ball.current
    if (!m) return
    m.position.set(b.x, b.y, b.z)
    const r = basket ? 0.12 : 0.11
    m.rotation.x += (b.vz / r) * Math.min(dt, 0.05)
    m.rotation.z -= (b.vx / r) * Math.min(dt, 0.05)
    const s = shadow.current
    if (s) {
      s.position.set(b.x, 0.04, b.z)
      const k = Math.max(0.3, 1 - b.y / 5)
      s.scale.set(k, k, k)
      shadowMat.opacity = 0.35 * k
    }
  })
  return (
    <>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[basket ? 0.12 : 0.11, 16, 12]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} material={shadowMat}>
        <circleGeometry args={[basket ? 0.14 : 0.13, 16]} />
      </mesh>
    </>
  )
}

/* ---------- The people watching ---------- */

type Fan = { look: Look; gender: 'femme' | 'homme'; seed: number; at: [number, number]; face: number; filmer: boolean; posts: boolean; delay: number; likes: string; kid: boolean }

/** The big moments that get filmed and posted. */
const POSTED = new Set(['dunk', 'goal', 'ankle', 'three', 'block', 'gbe'])

/**
 * The people along the fence: chatting, calling, up on their feet for a
 * dunk or a goal. A good few film with their phones up whenever it gets hot
 * near the basket or a goal; after a big moment some post the clip (the
 * bubble over their head). Drawn as the light, far-away figure: a crowd
 * costs little, even on a phone.
 */
export function Crowd({ g, seed }: { g: Game; seed: string }) {
  const fans = useMemo<Fan[]>(() => {
    const r = rng(`fans${seed}`)
    const spots: { at: [number, number]; face: number }[] = []
    if (g.sport === 'basket') {
      for (let z = -6; z <= 6; z += 1.6) {
        spots.push({ at: [-9.3 - r() * 0.6, z + r() * 0.4], face: Math.PI / 2 })
        spots.push({ at: [9.3 + r() * 0.6, z + r() * 0.4], face: -Math.PI / 2 })
      }
      // (Not along the near side: the camera looks over it, they'd stand in front of the game.)
      // Behind the basket too, along the back fence: they're the ones the camera sees.
      for (let x = -7.4; x <= 7.4; x += 1.25) if (Math.abs(x) > 0.7) spots.push({ at: [x + r() * 0.3, -9 - r() * 0.7], face: 0 })
    } else if (g.street) {
      // The street: along the far wall (it's low: they lean on it), behind the walls at the ends, kids at the near corners.
      const F = g.field
      for (let x = -F.x + 0.6; x <= F.x - 0.6; x += 1.35) spots.push({ at: [x + r() * 0.4, -F.z - 1.45 - r() * 0.7], face: 0 })
      for (const s of [-1, 1]) for (let z = -F.z + 0.8; z <= F.z - 0.8; z += 1.5) if (Math.abs(z) > F.mouth + 0.8) spots.push({ at: [s * (F.x + 0.85 + r() * 0.6), z + r() * 0.3], face: -s * (Math.PI / 2) })
      for (const s of [-1, 1]) for (const k of [0, 1, 2]) spots.push({ at: [s * (F.x - 0.6 - k * 0.8), F.z + 1.35 + r() * 0.3], face: Math.PI })
    } else if (g.size === 11) {
      // At the stadium, the ones standing at the front, behind the boards (the stands are full behind them).
      const F = g.field
      for (let x = -F.x + 4; x <= F.x - 4; x += 4.5) spots.push({ at: [x + r() * 1.2, -F.z - 6.5 - r()], face: 0 })
      for (const s of [-1, 1]) for (let z = -F.z + 6; z <= F.z - 6; z += 6) spots.push({ at: [s * (F.x + 7.5 + r()), z + r()], face: -s * (Math.PI / 2) })
    } else {
      for (let x = -16; x <= 16; x += 2.1) {
        spots.push({ at: [x + r() * 0.6, -12.3 - r() * 0.6], face: 0 })
        if (r() < 0.7) spots.push({ at: [x + r() * 0.6, 12.3 + r() * 0.6], face: Math.PI })
      }
      for (const s of [-1, 1]) for (let z = -6; z <= 6; z += 3) spots.push({ at: [s * (20.4 + r() * 0.5), z], face: -s * (Math.PI / 2) })
    }
    return spots.map((s) => {
      const gender: 'femme' | 'homme' = r() < 0.42 ? 'femme' : 'homme'
      const sd = r() * 100
      return { look: randomLook(gender, r), gender, seed: sd, at: s.at, face: s.face, filmer: r() < 0.38, posts: r() < 0.65, delay: 0.6 + r() * 1.8, likes: likesFor(sd), kid: r() < (g.street ? 0.45 : 0.18) }
    })
  }, [g.sport, g.size, g.field, g.street, seed])
  const [poses, setPoses] = useState<Pose[]>(() => fans.map(() => 'idle'))
  const tick = useRef(0)
  /** The last moment worth posting, and since when. */
  const posted = () => {
    for (let k = g.moments.length - 1; k >= 0; k--) if (POSTED.has(g.moments[k].kind)) return g.time - g.moments[k].t
    return null
  }
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 0.25) return
    tick.current = 0
    const last = g.moments[g.moments.length - 1]
    const recent = last && g.time - last.t < 2.8 ? last : null
    const b = g.ball
    const h = holder(g)
    // Hot: someone driving at the basket, the ball near a goal, a big moment.
    const hot = g.sport === 'basket' ? (!!h && Math.hypot(h.x - HOOP[0], h.z - HOOP[1]) < 6.5) || !!b.flight : Math.abs(b.x) > g.field.x - (g.size === 11 ? 18 : g.street ? 6 : 9)
    const next = fans.map((f, i): Pose => {
      const n = Math.sin(Math.floor((g.time + f.seed * 3) / 4) * 12.9898 + f.seed * 78.233) * 43758.5453
      const mood = n - Math.floor(n)
      if (f.filmer && (hot || (recent && POSTED.has(recent.kind)) || mood < 0.3)) return 'film'
      if (recent && (recent.kind === 'dunk' || recent.kind === 'goal' || recent.kind === 'ankle' || recent.kind === 'three' || recent.kind === 'block' || recent.kind === 'gbe')) return (i + Math.floor(g.time * 2)) % 5 === 0 ? 'wave' : 'cheer'
      if (recent && (recent.kind === 'basket' || recent.kind === 'save' || recent.kind === 'steal' || recent.kind === 'tackle' || recent.kind === 'geste')) return mood < 0.5 ? 'cheer' : 'wave'
      if (recent && recent.kind === 'post') return 'wave'
      if (g.phase === 'over') return mood < 0.6 ? 'cheer' : 'wave'
      return mood < 0.5 ? 'idle' : mood < 0.75 ? 'talk' : 'wave'
    })
    if (next.some((p, i) => p !== poses[i])) setPoses(next)
  })
  return (
    <group>
      {fans.map((f, i) => (
        <group key={i} position={[f.at[0], 0, f.at[1]]} rotation={[0, f.face, 0]} scale={f.kid ? 0.75 : 1}>
          <LowHuman look={f.look} gender={f.gender} pose={poses[i]} seed={f.seed} />
          {f.filmer && f.posts && (
            <PostedBubble
              likes={f.likes}
              height={f.kid ? 2.6 : 2.25}
              since={() => {
                const s = posted()
                return s === null ? null : s - f.delay
              }}
            />
          )}
        </group>
      ))}
    </group>
  )
}

/* ---------- The camera ---------- */

/** A screen taller than wide (a phone held upright). */
export const upright = (size: { width: number; height: number }) => size.height > size.width * 1.2

/**
 * The camera: basketball, behind the play looking at the basket; football,
 * from the side like on TV, following the ball along the pitch (on a phone
 * held upright, from behind, the attack going up the screen: see
 * `upright`). Both lean towards the player's own Sim so it never leaves the
 * screen.
 */
export function Follow({ g }: { g: Game }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const at = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const first = useRef(true)
  // How far the camera has slid back towards the player's own Sim, to keep it above the stick and the buttons.
  const lift = useRef(0)
  const feet = useRef(new THREE.Vector3())
  // How far it has pulled back, when the Sim kept above the buttons would leave the ball off the top.
  const back = useRef(0)
  const ballAt = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const me = g.ps[g.me]
    // Football, upright: from behind the player's own goal, whichever team the court gave it (team 1 attacks -x).
    const dir = me.team === 0 ? 1 : -1
    const b = g.ball
    // On a phone held upright, further back so the width fits.
    const tall = upright(size)
    const fx = me.x * 0.55 + b.x * 0.45
    const fz = me.z * 0.55 + b.z * 0.45
    let want: THREE.Vector3
    let target: THREE.Vector3
    if (g.sport === 'basket') {
      const zz = Math.max(-2, Math.min(6, fz))
      want = new THREE.Vector3(fx * 0.5, tall ? 9.5 : 7, zz + (tall ? 13 : 10.5))
      target = new THREE.Vector3(fx * 0.6, 1.2, Math.min(zz - 3, -1.5))
    } else if (g.size === 11) {
      // The stadium, like on TV: high on the side, following the ball along the pitch (the controlled player's pull a little less: the play is wide); upright, from behind the player's own half.
      const F = g.field
      const bx = b.x * 0.8 + me.x * 0.2
      const bz = b.z * 0.8 + me.z * 0.2
      if (tall) {
        const xx = dir * Math.max(-F.x + 6, Math.min(F.x - 10, dir * bx))
        const zz = Math.max(-F.z + 6, Math.min(F.z - 6, bz))
        want = new THREE.Vector3(xx - 18 * dir, 17, zz)
        target = new THREE.Vector3(xx + 9 * dir, 0, zz)
      } else {
        const xx = Math.max(-F.x + 14, Math.min(F.x - 14, bx))
        const zz = Math.max(-F.z + 8, Math.min(F.z - 8, bz * 0.7))
        want = new THREE.Vector3(xx, 18, zz + 23)
        target = new THREE.Vector3(xx, 0, zz - 1)
      }
    } else if (g.street) {
      // The street: closer and lower, in the play (upright, from behind the player's own goal too).
      const F = g.field
      if (tall) {
        const xx = dir * Math.max(-F.x + 3, Math.min(F.x - 4.5, dir * fx))
        const zz = Math.max(-4, Math.min(4, me.z * 0.75 + b.z * 0.25))
        want = new THREE.Vector3(xx - 8.5 * dir, 7.6, zz)
        target = new THREE.Vector3(xx + 3.5 * dir, 0, zz)
      } else {
        const xx = Math.max(-F.x + 6, Math.min(F.x - 6, fx))
        const zz = Math.max(-2.5, Math.min(2.5, fz * 0.5))
        want = new THREE.Vector3(xx, 5.6, zz + 8.4)
        target = new THREE.Vector3(xx, 0.3, zz - 1)
      }
    } else if (tall) {
      // A phone held upright: from behind the player's own goal, the attack going up the screen.
      const xx = dir * Math.max(-PITCH.x + 4, Math.min(PITCH.x - 6, dir * fx))
      const zz = Math.max(-7, Math.min(7, me.z * 0.75 + b.z * 0.25))
      want = new THREE.Vector3(xx - 13 * dir, 12, zz)
      target = new THREE.Vector3(xx + 5 * dir, 0, zz)
    } else {
      const xx = Math.max(-PITCH.x + 9, Math.min(PITCH.x - 9, fx))
      const zz = Math.max(-4, Math.min(4, fz * 0.5))
      want = new THREE.Vector3(xx, 10.5, zz + 12.5)
      target = new THREE.Vector3(xx, 0, zz - 0.5)
    }
    // The shoot-out, like on TV: from behind the spot, looking at the goal the kick is for (the player's keeper, face on, at the other side's).
    const so = g.sport === 'foot' && g.phase !== 'over' ? g.shootout : null
    if (so) {
      const d = so.turn === 0 ? 1 : -1
      const F = g.field
      const big = g.size === 11
      want = new THREE.Vector3(d * (F.x - F.spot - (big ? 9 : 6.5)), big ? 6 : 4.6, 0)
      target = new THREE.Vector3(d * F.x, 0.8, 0)
      lift.current = 0
      back.current = 0
    }
    // The kick-off at the stadium, like on TV: a slow turn round the ground from high up during the countdown, then down to the play.
    const intro = g.sport === 'foot' && g.size === 11 && g.phase === 'count'
    if (intro) {
      const k = Math.min(1, Math.max(0, (g.time + COUNTDOWN) / COUNTDOWN))
      const a = -0.95 + k * 1.15
      want = new THREE.Vector3(Math.sin(a) * 92, 44 - k * 14, Math.cos(a) * 92)
      target = new THREE.Vector3(0, 2, 0)
      lift.current = 0
      back.current = 0
    }
    // Down the screen: towards the camera along the pitch.
    const down = g.sport === 'foot' && tall ? new THREE.Vector3(-dir, 0, 0) : new THREE.Vector3(0, 0, 1)
    want.addScaledVector(down, lift.current)
    target.addScaledVector(down, lift.current)
    want.sub(target).multiplyScalar(1 + back.current).add(target)
    const k = first.current ? 1 : 1 - Math.exp(-dt * 4)
    first.current = false
    at.current.lerp(want, k)
    look.current.lerp(target, k)
    camera.position.copy(at.current)
    camera.lookAt(look.current)
    // The stick and the buttons cover about the bottom 190 px of any phone
    // (StreetMatch's Pad): a Sim standing back from the play, or a small
    // screen, put it under them. Its feet stay above that line.
    camera.updateMatrixWorld()
    if (so || intro) return
    const y = feet.current.set(me.x, 0, me.z).project(camera).y
    const floor = -1 + (2 * 190) / Math.max(size.height, 300)
    // (Not far back on the street's little ground: past its near wall there's only the road.)
    if (y < floor) lift.current = Math.min(g.street ? 4 : 14, lift.current + dt * 10)
    else if (y > floor + 0.2) lift.current = Math.max(0, lift.current - dt * 4)
    // The ball high up the screen while the Sim is held low: further back, to see both.
    const by = ballAt.current.set(b.x, 0.3, b.z).project(camera).y
    if (by > 0.88 && y < floor + 0.25) back.current = Math.min(0.7, back.current + dt * 0.8)
    else if (by < 0.7 || y > floor + 0.4) back.current = Math.max(0, back.current - dt * 0.4)
  })
  return null
}
