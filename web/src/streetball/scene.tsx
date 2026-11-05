import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Gait, type Pose } from '../avatar/Human'
import { LowHuman } from '../avatar/LowHuman'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { rng } from '../world3d/themes'
import { StaticMerge } from '../world3d/staticMerge'
import { PostedBubble, likesFor } from '../world3d/fans'
import { ARC, BAR, BOARD, BOARD_Z, CORNER, COUNTDOWN, COURT, HOOP, MOUTH, PITCH, PRO, RIM_Y, attackOf, gaitStep, holder, type Game } from './game'

/** Where the street's arc meets its straight corner lines, out from the ring. */
const MEET = Math.sqrt(ARC * ARC - CORNER * CORNER)
import { Arc, Line } from './marks'
import { Stadium } from './stadium'
import { asphalt, Blob, grassMaterial, Net, paint, turf } from './looks'
import { t as tr } from '../lib/i18n'
import { dropGazeTarget, gazeTarget } from '../avatar/expressions'
import { PalaisCourt } from './palais'
import { replayView } from './replay'

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
const SIGNS = ['CABINE', 'COIFFURE', 'MAQUIS', 'QUINCAILLERIE', 'TRANSFERT', 'BOUTIQUE', tr('ATTIÉKÉ'), 'PRESSING']
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
export function Quarter({ hx, hz, seed, gap = 9, ends = true }: { hx: number; hz: number; seed: string; gap?: number; /** Trees behind the goals too (football's upright camera stands there: off, its crowns filled the screen). */ ends?: boolean }) {
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
      const side = ends ? i % 3 : 0
      const u = (r() - 0.5) * (side === 0 ? hx * 1.6 : hz * 1.4)
      const off = (side === 0 ? hz : hx) + Math.min(5, gap - 2) + r() * 2
      return { p: (side === 0 ? [u, -off] : side === 1 ? [-off, u] : [off, u]) as [number, number], s: 0.8 + r() * 0.5 }
    })
  }, [hx, hz, seed, gap, ends])
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
          g.fillText(tr('STREET BALL'), 128, 98)
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
      {/* (At the real distance, 6,75 m, straight down to the baseline 6,6 m out in the corners.) */}
      <Line a={[-CORNER, z0]} b={[-CORNER, HOOP[1] + MEET]} />
      <Line a={[CORNER, z0]} b={[CORNER, HOOP[1] + MEET]} />
      <Arc at={HOOP} r={ARC} from={Math.PI + Math.asin(MEET / ARC)} to={Math.PI * 2 - Math.asin(MEET / ARC)} />
      {/* The stand behind the baseline: the pole, the arm, the board with its square */}
      <mesh geometry={BOX} material={steel} position={[0, 1.75, z0 - 0.8]} scale={[0.2, 3.5, 0.2]} castShadow />
      <mesh geometry={BOX} material={steel} position={[0, 3.35, (z0 - 0.8 + BOARD_Z) / 2]} scale={[0.12, 0.12, BOARD_Z - z0 + 0.8]} />
      <mesh geometry={BOX} material={pad} position={[0, 1, z0 - 0.8]} scale={[0.32, 2, 0.32]} />
      <mesh geometry={BOX} material={dark} position={[0, BOARD.y + BOARD.h / 2, BOARD_Z - 0.05]} scale={[BOARD.w + 0.06, BOARD.h + 0.06, 0.05]} castShadow />
      <mesh geometry={BOX} material={white} position={[0, BOARD.y + BOARD.h / 2, BOARD_Z - 0.02]} scale={[BOARD.w - 0.06, BOARD.h - 0.06, 0.04]} />
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
  // The console's eleven: the stadium; the Palais des Sports' full court.
  if (!basket && g.size === 11) return <Stadium g={g} teams={teams} />
  if (g.full) return <PalaisCourt g={g} />
  return (
    <>
      <StaticMerge>
        {basket ? <Court /> : <Pitch />}
        {basket ? <Fence hx={8.6} hz={8.15} z0={-0.15} /> : <Fence hx={19.6} hz={11.5} />}
        {basket ? <Quarter hx={8.6} hz={8.15} seed={seed} /> : <Quarter hx={19.6} hz={11.5} seed={seed} ends={false} />}
      </StaticMerge>
      {basket ? <Rim g={g} /> : <Nets g={g} />}
    </>
  )
}

/* ---------- The players and the ball ---------- */

/** One player: placed every frame; the pose handed to React when it changes. The player's own one has a ring under the feet. */
/** The street's moves and the men they beat: timed on the move itself (the ball goes with the feet, on every phone); le basket de rue's too. */
const MOVE_POSES = new Set<Pose>(['stepover', 'roulette', 'poke', 'rainbow', 'feint', 'flick', 'backheel', 'juggle', 'nutmegged', 'lookup', 'flinch', 'between', 'backdribble', 'spinmove', 'hesi', 'dribbleshow', 'pumpfake', 'stepback', 'ankles', 'turned', 'frozen', 'windmill', 'trap', 'sole', 'instep', 'thigh', 'chest', 'header'])
/** Past this from the camera, the stadium's team disc grows with the distance, so it stays as big on the screen. */
const DISC_FROM = 22

export function PlayerView({ g, i, look, gender, kit }: { g: Game; i: number; look: Look; gender: 'femme' | 'homme'; /** The team's colour: at the stadium, a disc under each player says whose side they're on from the far end. */ kit?: string }) {
  const root = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const mark = useRef<THREE.Group>(null)
  const disc = useRef<THREE.Group>(null)
  const [view, setView] = useState<{ pose: Pose; speed: number; take: number; slow: boolean }>({ pose: 'idle', speed: 0, take: 0, slow: false })
  // The steps as the game keeps them (game.ts advanceGait), the stride to match the speed; the body's lean (into a turn, forward getting going, back stopping), eased; the marker's pop when the hands come to this one.
  const gait = useMemo<Gait>(() => ({ phase: 0, stride: 1 }), [])
  const lean = useRef({ vx: 0, vz: 0, side: 0, fwd: 0, mine: false, pop: 9 })
  useFrame(({ camera }, dtRaw) => {
    const p = g.ps[i]
    const r = root.current
    if (!r) return
    const dt = Math.min(Math.max(dtRaw, 1e-3), 0.05)
    const L = lean.current
    // The ring goes with the local hands (the console moves them from one team-mate to another): it pops as they come.
    const mine = i === g.me
    if (mine && !L.mine) L.pop = 0
    L.mine = mine
    L.pop += dt
    if (mark.current) {
      mark.current.visible = mine
      const k = 1 + 0.9 * Math.exp(-L.pop * 7) * (L.pop < 0.6 ? 1 : 0)
      mark.current.scale.set(k, 1, k)
    }
    r.position.set(p.x, 0, p.z)
    r.rotation.y = p.face
    const sp = Math.hypot(p.vx, p.vz)
    gait.phase = p.gait
    // The rig's own swing for the pose (Human.tsx usePoseRig), and the swing that makes a step as long as the game's at this speed.
    const run = p.pose === 'run' || p.pose === 'touch'
    const own = run ? (p.pose === 'touch' ? 0.7 : 0.95) : Math.min(0.62, 0.3 + Math.round(sp) * 0.09)
    const want = run ? Math.min(1.05, Math.max(0.55, 0.45 + 0.09 * sp)) : Math.asin(Math.min(0.9, gaitStep(sp) / 1.68))
    gait.stride = Math.min(1.6, Math.max(0.5, want / own))
    // Leaning: how hard he speeds up along his facing and across it (m/s²), eased; only running about, not in a move.
    const ax = (p.vx - L.vx) / dt
    const az = (p.vz - L.vz) / dt
    L.vx = p.vx
    L.vz = p.vz
    const free = p.act === 'none' || p.act === 'juggle' || p.act === 'cross'
    const fs = Math.sin(p.face)
    const fc = Math.cos(p.face)
    const e = 1 - Math.exp(-7 * dt)
    L.side += ((free && sp > 1 ? Math.max(-0.24, Math.min(0.24, -(ax * fc - az * fs) * 0.016)) : 0) - L.side) * e
    L.fwd += ((free ? Math.max(-0.12, Math.min(0.14, (ax * fs + az * fc) * 0.012)) : 0) - L.fwd) * e
    if (inner.current) {
      inner.current.scale.set(p.flip ? -1 : 1, 1, 1)
      inner.current.rotation.set(L.fwd, 0, L.side)
    }
    if (disc.current) {
      // The phone's own player has the marker instead.
      disc.current.visible = i !== g.me
      const s = Math.max(1, Math.min(3, r.position.distanceTo(camera.position) / DISC_FROM))
      disc.current.scale.set(s, s, s)
    }
    const speed = Math.round(Math.hypot(p.vx, p.vz))
    // (A street move done twice in a row starts over: its count.)
    // (A replay: every pose on the kept clock, so it goes slow with it.)
    if (p.pose !== view.pose || speed !== view.speed || p.take !== view.take || replayView.on !== view.slow) setView({ pose: p.pose, speed, take: p.take, slow: replayView.on })
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
        <Human look={look} gender={gender} faceId={`${g.sport}-${i}`} pose={view.pose} seed={i * 7.3} speed={view.speed || undefined} take={view.take} clock={MOVE_POSES.has(view.pose) || view.slow ? () => g.ps[i].at : undefined} gait={view.slow ? undefined : gait} />
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

const spinAxis = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/** The ball, spinning as it goes, and its shadow on the ground (smaller and fainter as it goes up). */
export function BallView({ g }: { g: Game }) {
  const basket = g.sport === 'basket'
  const tex = useBallTexture(basket)
  const ball = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }), [])
  // Every face on and round the pitch follows the ball with its eyes (avatar/expressions.ts).
  const seen = useMemo(() => gazeTarget('ball', 30, 2), [])
  useEffect(() => () => dropGazeTarget('ball'), [])
  useFrame((_, dt) => {
    const b = g.ball
    const m = ball.current
    if (!m) return
    m.position.set(b.x, b.y, b.z)
    m.getWorldPosition(seen)
    const r = basket ? 0.12 : 0.11
    const step = Math.min(dt, 0.05)
    const v = Math.hypot(b.vx, b.vz)
    // The spin: rolling along the ground (or with the feet) it turns with the ground; a jump shot goes up
    // with backspin (about two turns a second); a lofted football with a little backspin; a curled one
    // turns on itself, the way it bends.
    if (v > 0.05) {
      const f = b.flight
      const air = b.owner < 0 && b.y > r + 0.25
      const spin = f?.kind === 'shot' && basket ? -13 : air && !basket ? (b.lofted ? -6 : v / r * 0.25) : v / r
      spinAxis.set(b.vz / v, 0, -b.vx / v)
      m.rotateOnWorldAxis(spinAxis, spin * step)
    }
    if (b.curl && b.owner < 0) m.rotateOnWorldAxis(UP, b.curl * 1.5 * step)
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

type Fan = { look: Look; gender: 'femme' | 'homme'; seed: number; at: [number, number]; face: number; filmer: boolean; posts: boolean; delay: number; likes: string; kid: boolean; /** Up in the stands. */ y: number }

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
    const spots: { at: [number, number]; face: number; y?: number }[] = []
    if (g.full) {
      // The Palais des Sports: in the stands on the far side and the ends (palais.tsx Stands), standing at their seats; a row on the near side.
      for (let row = 0; row < 3; row++) {
        const y = 0.5 + row * 2 * 0.45
        for (let x = -PRO.x - 1; x <= PRO.x + 1; x += 1.25) if (r() < 0.8) spots.push({ at: [x + r() * 0.4, -(PRO.z + 3.4 + row * 2 * 0.9)], face: 0, y })
        for (const s of [-1, 1]) for (let z = -PRO.z + 0.5; z <= 1.5; z += 1.5) if (r() < 0.7) spots.push({ at: [s * (PRO.x + 3.6 + row * 2 * 0.9), z + r() * 0.4], face: -s * (Math.PI / 2), y })
      }
    } else if (g.sport === 'basket') {
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
      return { look: randomLook(gender, r), gender, seed: sd, at: s.at, face: s.face, filmer: r() < (g.full ? 0.2 : 0.38), posts: r() < 0.65, delay: 0.6 + r() * 1.8, likes: likesFor(sd), kid: r() < (g.street ? 0.45 : 0.18), y: s.y ?? 0 }
    })
  }, [g.sport, g.size, g.field, g.street, g.full, seed])
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
    const ring = g.hoops[g.poss]
    const hot = g.sport === 'basket' ? (!!h && Math.hypot(h.x - ring[0], h.z - ring[1]) < 6.5) || !!b.flight : Math.abs(b.x) > g.field.x - (g.size === 11 ? 18 : g.street ? 6 : 9)
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
        <group key={i} position={[f.at[0], f.y, f.at[1]]} rotation={[0, f.face, 0]} scale={f.kid ? 0.75 : 1}>
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

/** The camera's places, reused (nothing made new each frame). */
const W = new THREE.Vector3()
const T = new THREE.Vector3()
const D = new THREE.Vector3()

/** A critically damped spring from x towards to (its speed v), at w (rad/s): no overshoot, no jerk. */
function spring(x: THREE.Vector3, v: THREE.Vector3, to: THREE.Vector3, w: number, dt: number) {
  v.x += (w * w * (to.x - x.x) - 2 * w * v.x) * dt
  v.y += (w * w * (to.y - x.y) - 2 * w * v.y) * dt
  v.z += (w * w * (to.z - x.z) - 2 * w * v.z) * dt
  x.x += v.x * dt
  x.y += v.y * dt
  x.z += v.z * dt
}

/** A screen taller than wide (a phone held upright). */
export const upright = (size: { width: number; height: number }) => size.height > size.width * 1.2

/** The Palais des Sports' camera: « TV » (the broadcast's, high on the side) or « Près » (closer on the player's own), kept on the phone. */
export const basketCam: { mode: 'tv' | 'near' } = { mode: 'tv' }
try {
  if (localStorage.getItem('babi.cam.basket') === 'near') basketCam.mode = 'near'
} catch {
  // (No storage: the TV's.)
}

/**
 * The camera: basketball, behind the play looking at the basket; football,
 * from the side like on TV, following the ball along the pitch (on a phone
 * held upright, from behind, the attack going up the screen: see
 * `upright`). Both lean towards the player's own Sim so it never leaves the
 * screen.
 */
/** The stadium's camera, the player's choice (kept on this phone): the broadcast one, or close behind the play. */
export const camPref = { close: (() => { try { return localStorage.getItem('babi.footCam') === 'proche' } catch { return false } })() }
export function toggleCam() {
  camPref.close = !camPref.close
  try {
    localStorage.setItem('babi.footCam', camPref.close ? 'proche' : 'tele')
  } catch {
    // (No storage: the choice lasts the match.)
  }
  return camPref.close
}

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
  const wasReplay = useRef(false)
  // The springs' speeds; the player's own glided; the ball's way, eased; the last knock (camera shake).
  const atV = useRef(new THREE.Vector3())
  const lookV = useRef(new THREE.Vector3())
  const meAt = useRef(new THREE.Vector3())
  const ballV = useRef(new THREE.Vector3())
  const shook = useRef({ seen: g.moments.length ? g.moments[g.moments.length - 1].t : -99, t: 9, amp: 0 })
  useFrame((_, dtRaw) => {
    const dt = Math.min(Math.max(dtRaw, 0), 0.05)
    const me = g.ps[g.me]
    // Football, upright: from behind the player's own goal, whichever team the court gave it and whichever half (the sides change at half-time).
    const dir = attackOf(g, me.team)
    const b = g.ball
    // On a phone held upright, further back so the width fits.
    const tall = upright(size)
    // The player's own, glided (the console handing the hands to another team-mate doesn't jerk the picture),
    // and the ball a little ahead of where it is, the way it goes (the picture looks where the play goes).
    const ms = meAt.current
    if (first.current) ms.set(me.x, 0, me.z)
    else ms.lerp(feet.current.set(me.x, 0, me.z), 1 - Math.exp(-dt * 5))
    const ahead = g.sport === 'basket' ? 0.18 : g.size === 11 ? 0.45 : 0.3
    const bv = ballV.current
    const bh = b.owner >= 0 ? g.ps[b.owner] : null
    bv.lerp(feet.current.set(bh ? bh.vx : b.vx, 0, bh ? bh.vz : b.vz), 1 - Math.exp(-dt * 3))
    const reach = g.size === 11 ? 7 : 3
    const mx = ms.x
    const mz = ms.z
    const lx = b.x + Math.max(-reach, Math.min(reach, bv.x * ahead))
    const lz = b.z + Math.max(-reach, Math.min(reach, bv.z * ahead)) * 0.5
    const fx = mx * 0.55 + lx * 0.45
    const fz = mz * 0.55 + lz * 0.45
    let want: THREE.Vector3
    let target: THREE.Vector3
    if (g.full) {
      // The Palais des Sports, like on TV: the broadcast's camera high on the side, following the play
      // along the floor; « Près », lower and closer on the player's own; on a phone held upright, from
      // behind the player's side, its attack going up the screen.
      const bx = lx * 0.75 + mx * 0.25
      if (tall) {
        const xx = Math.max(-PRO.x + 4, Math.min(PRO.x - 4, bx))
        want = W.set(xx - 10 * dir, 8.6, fz * 0.45)
        target = T.set(xx + 4 * dir, 0.8, fz * 0.4)
      } else if (basketCam.mode === 'near') {
        const xx = Math.max(-PRO.x + 5, Math.min(PRO.x - 5, mx * 0.6 + lx * 0.4))
        want = W.set(xx, 5.4, PRO.z + 6.8)
        target = T.set(xx, 1.1, mz * 0.5 - 0.6)
      } else {
        const xx = Math.max(-PRO.x + 7, Math.min(PRO.x - 7, bx))
        want = W.set(xx * 0.92, 9.4, PRO.z + 11.8)
        target = T.set(xx, 0.6, -0.9)
      }
    } else if (g.sport === 'basket' && g.street) {
      // Le basket de rue: closer and lower, in the play, the hoop and the wall behind it.
      // (A phone held upright sees barely five metres across at the play: there it follows the play right across, or a player out on the wing was off the screen.)
      const zz = Math.max(-2.5, Math.min(5.5, fz))
      const ax = tall ? (mx * 0.7 + lx * 0.3) * 0.8 : fx * 0.55
      want = W.set(ax, tall ? 7.2 : 4.6, zz + (tall ? 10 : 7.6))
      target = T.set(tall ? ax : fx * 0.65, 1.5, Math.min(zz - 2.6, -1.6))
    } else if (g.sport === 'basket') {
      const zz = Math.max(-2, Math.min(6, fz))
      const ax = tall ? (mx * 0.7 + lx * 0.3) * 0.8 : fx * 0.5
      want = W.set(ax, tall ? 9.5 : 7, zz + (tall ? 13 : 10.5))
      target = T.set(tall ? ax : fx * 0.6, 1.2, Math.min(zz - 3, -1.5))
    } else if (g.size === 11) {
      // The stadium, like on TV: high on the side, following the ball along the pitch (the controlled player's pull a little less: the play is wide); upright, from behind the player's own half.
      const F = g.field
      const bx = lx * 0.8 + mx * 0.2
      const bz = lz * 0.8 + mz * 0.2
      if (tall) {
        const xx = dir * Math.max(-F.x + 6, Math.min(F.x - 10, dir * bx))
        const zz = Math.max(-F.z + 6, Math.min(F.z - 6, bz))
        const near = camPref.close ? 0.6 : 1
        want = W.set(xx - 19 * near * dir, 18 * near, zz)
        target = T.set(xx + 10 * near * dir, 0, zz)
      } else if (camPref.close) {
        // Close: lower and nearer, on the player and the ball, as on the maracana.
        const xx = Math.max(-F.x + 8, Math.min(F.x - 8, fx))
        const zz = Math.max(-F.z + 5, Math.min(F.z - 5, fz * 0.8))
        want = W.set(xx, 10, zz + 13)
        target = T.set(xx, 0, zz - 0.5)
      } else {
        // The broadcast camera on the real-size pitch: high in the main stand, panning along with the play, tilting less across.
        const xx = Math.max(-F.x + 16, Math.min(F.x - 16, bx))
        const zz = Math.max(-F.z + 10, Math.min(F.z - 10, bz * 0.6))
        want = W.set(xx, 21, zz * 0.6 + 27)
        target = T.set(xx, 0, zz - 1)
      }
    } else if (g.street) {
      // The street: closer and lower, in the play (upright, from behind the player's own goal too).
      const F = g.field
      if (tall) {
        const xx = dir * Math.max(-F.x + 3, Math.min(F.x - 4.5, dir * fx))
        const zz = Math.max(-4, Math.min(4, mz * 0.75 + lz * 0.25))
        want = W.set(xx - 8.5 * dir, 7.6, zz)
        target = T.set(xx + 3.5 * dir, 0, zz)
      } else {
        const xx = Math.max(-F.x + 6, Math.min(F.x - 6, fx))
        const zz = Math.max(-2.5, Math.min(2.5, fz * 0.5))
        want = W.set(xx, 5.6, zz + 8.4)
        target = T.set(xx, 0.3, zz - 1)
      }
    } else if (tall) {
      // A phone held upright: from behind the player's own goal, the attack going up the screen.
      const xx = dir * Math.max(-PITCH.x + 4, Math.min(PITCH.x - 6, dir * fx))
      const zz = Math.max(-7, Math.min(7, mz * 0.75 + lz * 0.25))
      want = W.set(xx - 13 * dir, 12, zz)
      target = T.set(xx + 5 * dir, 0, zz)
    } else {
      const xx = Math.max(-PITCH.x + 9, Math.min(PITCH.x - 9, fx))
      const zz = Math.max(-4, Math.min(4, fz * 0.5))
      want = W.set(xx, 10.5, zz + 12.5)
      target = T.set(xx, 0, zz - 0.5)
    }
    // The shoot-out, like on TV: from behind the spot, looking at the goal the kick is for (the player's keeper, face on, at the other side's).
    const so = g.sport === 'foot' && g.phase !== 'over' ? g.shootout : null
    if (so) {
      const d = attackOf(g, so.turn)
      const F = g.field
      const big = g.size === 11
      want = W.set(d * (F.x - F.spot - (big ? 9 : 6.5)), big ? 6 : 4.6, 0)
      target = T.set(d * F.x, 0.8, 0)
      lift.current = 0
      back.current = 0
    }
    // A goal's replay (replay.ts): low by the post, the play coming at the goal, cut straight to it.
    const replay = g.sport === 'foot' && replayView.on
    if (replay) {
      const gx = replayView.goalX
      const s = Math.sign(gx) || 1
      const wide = g.size === 11 ? 13 : g.street ? 5.5 : 8
      want = W.set(gx - s * (g.size === 11 ? 9 : 5), g.size === 11 ? 3.2 : 2.3, replayView.side * wide)
      target = T.set(b.x * 0.65 + gx * 0.35, 0.8, b.z * 0.65)
      lift.current = 0
      back.current = 0
    }
    if (replay !== wasReplay.current) {
      wasReplay.current = replay
      first.current = true
    }
    // The kick-off at the stadium, like on TV: a slow turn round the ground from high up during the countdown, then down to the play.
    const intro = g.sport === 'foot' && g.size === 11 && g.phase === 'count'
    if (intro) {
      const k = Math.min(1, Math.max(0, (g.time + COUNTDOWN) / COUNTDOWN))
      const a = -0.95 + k * 1.15
      want = W.set(Math.sin(a) * 108, 50 - k * 16, Math.cos(a) * 108)
      target = T.set(0, 2, 0)
      lift.current = 0
      back.current = 0
    }
    // A dunk's replay: low by the ring, turning slowly round it from the court's side.
    if (replayView.on && replayView.ring) {
      const [rx, rz] = replayView.ring
      const s = g.full ? -Math.sign(rx) : 0
      const a = -0.9 + replayView.k * 1.2
      const R = 6.4
      const [ox, oz] = g.full ? [s * R * Math.cos(a * 0.6), R * Math.sin(a * 0.6 + 0.9)] : [R * Math.sin(a), R * Math.cos(a)]
      want = W.set(rx + ox, 2.1, rz + oz)
      target = T.set(rx, 1.9, rz)
      lift.current = 0
      back.current = 0
      at.current.lerp(want, first.current ? 1 : 1 - Math.exp(-dt * 6))
      atV.current.set(0, 0, 0)
      lookV.current.set(0, 0, 0)
      look.current.lerp(target, 1 - Math.exp(-dt * 8))
      camera.position.copy(at.current)
      camera.lookAt(look.current)
      return
    }
    // Down the screen: towards the camera along the pitch.
    const down = (g.sport === 'foot' || g.full) && tall ? D.set(-dir, 0, 0) : D.set(0, 0, 1)
    want.addScaledVector(down, lift.current)
    target.addScaledVector(down, lift.current)
    want.sub(target).multiplyScalar(1 + back.current).add(target)
    // A spring, critically damped, to where it should be (it starts and stops gently, never in a jerk), snapped
    // at the first frame and on a cut (a replay starting or ending). The aim a little quicker than the place.
    if (first.current) {
      at.current.copy(want)
      look.current.copy(target)
      atV.current.set(0, 0, 0)
      lookV.current.set(0, 0, 0)
    } else {
      spring(at.current, atV.current, want, 3.6, dt)
      spring(look.current, lookV.current, target, 4.6, dt)
    }
    first.current = false
    camera.position.copy(at.current)
    // A knock on contact (a tackle, a block, a goal, a dunk): a short shake, dying fast.
    const m = g.moments[g.moments.length - 1]
    if (m && m.t > shook.current.seen) {
      shook.current.seen = m.t
      const hard = m.kind === 'goal' || m.kind === 'dunk' || m.kind === 'gbe' || m.kind === 'alley' ? 0.14 : m.kind === 'tackle' || m.kind === 'block' || m.kind === 'post' || m.kind === 'save' || m.kind === 'steal' ? 0.07 : 0
      if (hard) shook.current = { seen: m.t, t: 0, amp: hard * (g.size === 11 ? 1.6 : 1) }
    }
    const sk = shook.current
    sk.t += dt
    if (sk.amp > 0 && sk.t < 0.5) {
      const a = sk.amp * Math.exp(-sk.t * 9)
      camera.position.x += Math.sin(sk.t * 47) * a
      camera.position.y += Math.sin(sk.t * 61 + 1) * a * 0.7
    }
    camera.lookAt(look.current)
    // The stick and the buttons cover about the bottom 190 px of any phone
    // (StreetMatch's Pad): a Sim standing back from the play, or a small
    // screen, put it under them. Its feet stay above that line.
    camera.updateMatrixWorld()
    if (so || intro || replay) return
    const fp = feet.current.set(me.x, 0, me.z).project(camera)
    const y = fp.y
    // (The stick and the buttons are in the bottom corners: a Sim between them, in the middle, is seen; on a
    // phone on its side that's most of the width, and backing off for nothing left the players tiny.)
    const wide = size.width > size.height * 1.3
    const px = ((fp.x + 1) / 2) * size.width
    const corner = px < 190 || px > size.width - 230
    const floor = -1 + (2 * (wide && !corner ? 46 : 190)) / Math.max(size.height, 300)
    // (Not far back on the street's little ground: past its near wall there's only the road; nor on a court seen from close.)
    if (y < floor) lift.current = Math.min(g.street && g.sport === 'foot' ? 4 : g.sport === 'basket' && wide ? 5 : 14, lift.current + dt * 10)
    else if (y > floor + 0.2) lift.current = Math.max(0, lift.current - dt * 4)
    // The ball high up the screen while the Sim is held low: further back, to see both.
    const by = ballAt.current.set(b.x, 0.3, b.z).project(camera).y
    if (by > 0.88 && y < floor + 0.25) back.current = Math.min(0.7, back.current + dt * 0.8)
    else if (by < 0.7 || y > floor + 0.4) back.current = Math.max(0, back.current - dt * 0.4)
  })
  return null
}
