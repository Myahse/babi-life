import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { StaticMerge } from '../world3d/staticMerge'
import { rng } from '../world3d/themes'
import { BOARD, PRO, RIM_Y, RING_R, type Game } from './game'
import { paint } from './looks'
import { Arc, Line } from './marks'
import { t as tr } from '../lib/i18n'

// The Palais des Sports de Treichville's court (game.ts Rules.full), at the real size: the maple
// parquet with its planks, the keys and the centre circle painted in the country's orange, the lines
// at their real places (the three-point line at 7,24 m, 6,71 m in the corners, the free-throw line, the
// restricted arc, half-way), the two stanchions with their padded bases and glass boards, the shot
// clocks over them, the scorers' table and the benches across the floor, the stands rising all round
// (the near side low, the camera looks over it), the lights hanging from the roof. Everything still is
// baked into a few meshes; the rings, their nets and the shot clocks move.

const BOX = new THREE.BoxGeometry(1, 1, 1)
const flat = (color: string) => new THREE.MeshLambertMaterial({ color })
const orange = flat('#f77f00')
const pad = flat('#1f3a8a')
const steel = flat('#2b2f36')
const frame = flat('#f4f4f0')
const seat = flat('#c2410c')
const seat2 = flat('#15803d')
const concrete = flat('#8f8a82')
const wood = flat('#7a4a2a')
const table = flat('#101828')
const light = new THREE.MeshBasicMaterial({ color: '#fffbe8' })
const glass = new THREE.MeshLambertMaterial({ color: '#dff3ff', transparent: true, opacity: 0.32, depthWrite: false })
const netMat = new THREE.MeshLambertMaterial({ color: '#f8f9fa', wireframe: true })

/** The parquet: light maple planks (a little darker and lighter each), the joints, the varnish's sheen. */
function parquet() {
  return paint(
    'palais-parquet',
    256,
    256,
    (g) => {
      const r = rng('parquet')
      for (let y = 0; y < 256; y += 8) {
        let x = -Math.floor(r() * 64)
        while (x < 256) {
          const len = 48 + Math.floor(r() * 64)
          const l = 196 + Math.floor(r() * 26)
          g.fillStyle = `rgb(${l},${Math.floor(l * 0.78)},${Math.floor(l * 0.52)})`
          g.fillRect(x, y, len, 8)
          g.fillStyle = 'rgba(90,55,25,0.35)'
          g.fillRect(x, y, 1, 8)
          for (let k = 0; k < 6; k++) {
            g.fillStyle = 'rgba(120,75,35,0.12)'
            g.fillRect(x + r() * len, y + 1 + r() * 6, 6 + r() * 14, 1)
          }
          x += len
        }
        g.fillStyle = 'rgba(90,55,25,0.3)'
        g.fillRect(0, y, 256, 1)
      }
    },
    [12, 6],
  )
}

/** The centre: « PALAIS DES SPORTS » round the circle, « TREICHVILLE » under it. */
function centreLogo() {
  return paint('palais-logo', 512, 512, (g) => {
    g.clearRect(0, 0, 512, 512)
    g.fillStyle = 'rgba(247,127,0,0.85)'
    g.beginPath()
    g.arc(256, 256, 120, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ffffff'
    g.font = "900 64px 'Baloo 2', Impact, sans-serif"
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('BABI', 256, 236)
    g.font = "800 30px 'Baloo 2', Impact, sans-serif"
    g.fillText(tr('BASKET'), 256, 292)
    g.fillStyle = 'rgba(16,24,40,0.75)'
    g.font = "800 34px 'Baloo 2', Impact, sans-serif"
    g.fillText(tr('PALAIS DES SPORTS'), 256, 64)
    g.fillText(tr('TREICHVILLE'), 256, 452)
  })
}

/** A banner along the stands or the table: white words on a colour. */
function banner(key: string, text: string, bg: string) {
  return paint(`palais-banner-${key}`, 512, 64, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, 512, 64)
    g.fillStyle = '#ffffff'
    g.font = "900 40px 'Baloo 2', Impact, sans-serif"
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 256, 34, 490)
  })
}

/** The lines of one end (s: 1 the ring at +x), the three-point line, the key, the free-throw circle, the restricted arc. */
function End({ s }: { s: 1 | -1 }) {
  const x0 = s * PRO.x
  const ring = s * PRO.ring
  const ftx = s * (PRO.board - PRO.ft)
  const meet = Math.sqrt(PRO.arc * PRO.arc - PRO.corner * PRO.corner)
  const a = Math.asin(PRO.corner / PRO.arc)
  // (The Arc's angles: θ in the ground's plane, its z = -sin θ.)
  const [from, to] = s > 0 ? [Math.PI - a, Math.PI + a] : [-a, a]
  return (
    <>
      <Line a={[x0, -PRO.corner]} b={[ring - s * meet, -PRO.corner]} />
      <Line a={[x0, PRO.corner]} b={[ring - s * meet, PRO.corner]} />
      <Arc at={[ring, 0]} r={PRO.arc} from={from} to={to} />
      <Line a={[x0, -PRO.key]} b={[ftx, -PRO.key]} />
      <Line a={[x0, PRO.key]} b={[ftx, PRO.key]} />
      <Line a={[ftx, -PRO.key]} b={[ftx, PRO.key]} />
      <Arc at={[ftx, 0]} r={1.8} from={s > 0 ? Math.PI / 2 : -Math.PI / 2} to={s > 0 ? (Math.PI * 3) / 2 : Math.PI / 2} />
      <Arc at={[ring, 0]} r={PRO.ra} from={s > 0 ? Math.PI / 2 : -Math.PI / 2} to={s > 0 ? (Math.PI * 3) / 2 : Math.PI / 2} />
      {/* The lane's little marks */}
      {[1.75, 2.6, 3.45].map((u) => [-1, 1].map((k) => <Line key={`${u}${k}`} a={[s * (PRO.x - u), k * PRO.key]} b={[s * (PRO.x - u), k * (PRO.key + 0.2)]} w={0.08} />))}
    </>
  )
}

/** One stanchion: the padded base out past the baseline, the arm, the board's frame and glass, the square. */
function Stanchion({ s }: { s: 1 | -1 }) {
  const bx = s * (PRO.board + 0.03)
  const base = s * (PRO.x + 1.4)
  const by = BOARD.y + BOARD.h / 2
  return (
    <>
      <mesh geometry={BOX} material={pad} position={[base, 0.6, 0]} scale={[1.3, 1.2, 1.1]} castShadow />
      <mesh geometry={BOX} material={steel} position={[base - s * 0.1, 2.3, 0]} scale={[0.22, 2.2, 0.22]} castShadow />
      <mesh geometry={BOX} material={steel} position={[(base + bx) / 2, by + 0.1, 0]} scale={[Math.abs(base - bx), 0.16, 0.16]} castShadow />
      <mesh geometry={BOX} material={steel} position={[(base + bx) / 2 + s * 0.3, 2.9, 0]} scale={[Math.abs(base - bx) * 0.85, 0.12, 0.12]} rotation={[0, 0, s * 0.42]} />
      <mesh geometry={BOX} material={pad} position={[bx, BOARD.y - 0.04, 0]} scale={[0.08, 0.08, BOARD.w]} />
      {/* The frame round the glass, and the square over the ring */}
      <mesh geometry={BOX} material={frame} position={[bx, by + BOARD.h / 2, 0]} scale={[0.05, 0.05, BOARD.w]} />
      <mesh geometry={BOX} material={frame} position={[bx, by, -BOARD.w / 2]} scale={[0.05, BOARD.h, 0.05]} />
      <mesh geometry={BOX} material={frame} position={[bx, by, BOARD.w / 2]} scale={[0.05, BOARD.h, 0.05]} />
      <mesh geometry={BOX} material={frame} position={[bx - s * 0.02, RIM_Y + 0.15, 0]} scale={[0.01, 0.04, 0.59]} />
      <mesh geometry={BOX} material={frame} position={[bx - s * 0.02, RIM_Y + 0.15 + 0.43, 0]} scale={[0.01, 0.04, 0.59]} />
      <mesh geometry={BOX} material={frame} position={[bx - s * 0.02, RIM_Y + 0.37, -0.29]} scale={[0.01, 0.45, 0.04]} />
      <mesh geometry={BOX} material={frame} position={[bx - s * 0.02, RIM_Y + 0.37, 0.29]} scale={[0.01, 0.45, 0.04]} />
    </>
  )
}

/** The stands: rows of seats rising away from the floor on three sides, low on the near one; `n` rows. */
function Stands() {
  const rows = 7
  const out: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material }[] = []
  for (let r = 0; r < rows; r++) {
    const h = 0.5 + r * 0.45
    const m = r % 2 ? seat : seat2
    // Far side (behind the benches), and the two ends.
    out.push({ p: [0, h / 2, -(PRO.z + 3.4 + r * 0.9)], s: [PRO.x * 2 + 6, h, 0.9], m })
    // (The ends stop short of the near side: they'd come between the camera and the floor.)
    for (const s of [-1, 1]) out.push({ p: [s * (PRO.x + 3.6 + r * 0.9), h / 2, (-(PRO.z + 7) + 2) / 2], s: [0.9, h, PRO.z + 9], m })
    // The near side: two low rows only (the camera's over them).
    if (r < 2) out.push({ p: [0, h / 2, PRO.z + 4.2 + r * 0.9], s: [PRO.x * 2 + 6, h, 0.9], m: concrete })
  }
  return (
    <>
      {out.map((b, i) => (
        <mesh key={i} geometry={BOX} material={b.m} position={b.p} scale={b.s} receiveShadow />
      ))}
    </>
  )
}

/** A ring and its net on one stanchion (the one at +x: s 1): the iron shakes when hit (g.ringHit), the net flies when the ball goes through. */
function ProRim({ g, s }: { g: Game; s: 1 | -1 }) {
  const hinge = useRef<THREE.Group>(null)
  const net = useRef<THREE.Mesh>(null)
  const ring: 0 | 1 = s > 0 ? 0 : 1
  useFrame(() => {
    const h = hinge.current
    if (!h) return
    const mine = g.ringHit === ring
    const hanging = g.ps.some((p) => p.act === 'dunk' && p.team === ring && (p.gbe ? p.at > 0.95 && p.at < 1.5 : p.at > 0.5 && p.at < 1.15))
    const since = g.time - g.rim.t
    const shake = mine && since >= 0 && since < 1.6 ? Math.sin(since * 34) * g.rim.amp * Math.exp(-since * 3.5) : 0
    h.rotation.z = -s * (hanging ? 0.11 + Math.sin(g.time * 30) * 0.015 : shake)
    const w = g.time - g.swish
    if (net.current) net.current.scale.y = mine && w >= 0 && w < 0.5 ? 1 + Math.sin((w / 0.5) * Math.PI) * 0.45 : 1
  })
  const back = PRO.board - PRO.ring
  return (
    <group ref={hinge} position={[s * PRO.board, RIM_Y, 0]}>
      <mesh position={[-s * back, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={orange}>
        <torusGeometry args={[RING_R + 0.01, 0.018, 6, 22]} />
      </mesh>
      <mesh geometry={BOX} material={orange} position={[-s * back * 0.5, -0.02, 0]} scale={[back - 0.15, 0.03, 0.12]} />
      <mesh ref={net} position={[-s * back, -0.22, 0]} material={netMat}>
        <cylinderGeometry args={[RING_R, RING_R * 0.62, 0.44, 12, 3, true]} />
      </mesh>
    </group>
  )
}

/** The shot clock over a board: its seconds, red under five. Its canvas is drawn again only when the number changes. */
function ShotClock({ g, s }: { g: Game; s: 1 | -1 }) {
  const shown = useRef(-1)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 32
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useFrame(() => {
    const v = g.clock < 0 ? 0 : Math.ceil(g.clock)
    if (v === shown.current) return
    shown.current = v
    const c = tex.image as HTMLCanvasElement
    const x = c.getContext('2d')!
    x.fillStyle = '#0b0f19'
    x.fillRect(0, 0, 64, 32)
    x.fillStyle = v <= 5 ? '#ff3b30' : '#ffd43b'
    x.font = "900 28px 'Baloo 2', Impact, sans-serif"
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText(String(v), 32, 17)
    tex.needsUpdate = true
  })
  const y = BOARD.y + BOARD.h + 0.28
  return (
    <group position={[s * (PRO.board + 0.05), y, 0]} rotation={[0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh geometry={BOX} material={steel} scale={[0.66, 0.36, 0.1]} />
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial map={tex} />
      </mesh>
      {/* Seen from the other side too */}
      <mesh position={[0, 0, -0.06]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

/** The whole arena. */
export function PalaisCourt({ g }: { g: Game }) {
  const mats = useMemo(
    () => ({
      floor: new THREE.MeshLambertMaterial({ map: parquet() }),
      apron: flat('#9c5b2c'),
      key: new THREE.MeshLambertMaterial({ color: '#f77f00', transparent: true, opacity: 0.8 }),
      logo: new THREE.MeshLambertMaterial({ map: centreLogo(), transparent: true }),
      table: new THREE.MeshLambertMaterial({ map: banner('table', tr('BABI LIFE · PALAIS DES SPORTS'), '#101828') }),
      board1: new THREE.MeshLambertMaterial({ map: banner('b1', tr('ALLEZ LES ÉLÉPHANTS'), '#f77f00') }),
      board2: new THREE.MeshLambertMaterial({ map: banner('b2', tr('ABIDJAN BASKET'), '#15803d') }),
    }),
    [],
  )
  return (
    <>
      <StaticMerge>
        {/* The floor: the apron round the court in darker stain, the court in light maple */}
        <mesh geometry={BOX} material={mats.apron} position={[0, -0.06, 0]} scale={[PRO.x * 2 + 6, 0.1, PRO.z * 2 + 6]} receiveShadow />
        <mesh geometry={BOX} material={mats.floor} position={[0, -0.01, 0]} scale={[PRO.x * 2, 0.02, PRO.z * 2]} receiveShadow />
        {/* The keys in the country's orange, the centre circle with the logo */}
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={BOX} material={mats.key} position={[s * (PRO.x - (PRO.x - (PRO.board - PRO.ft)) / 2), 0.012, 0]} scale={[PRO.x - (PRO.board - PRO.ft), 0.005, PRO.key * 2]} />
        ))}
        <mesh material={mats.logo} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.2, 4.2]} />
        </mesh>
        {/* The lines */}
        <Line a={[-PRO.x, -PRO.z]} b={[PRO.x, -PRO.z]} />
        <Line a={[-PRO.x, PRO.z]} b={[PRO.x, PRO.z]} />
        <Line a={[-PRO.x, -PRO.z]} b={[-PRO.x, PRO.z]} />
        <Line a={[PRO.x, -PRO.z]} b={[PRO.x, PRO.z]} />
        <Line a={[0, -PRO.z]} b={[0, PRO.z]} />
        <Arc at={[0, 0]} r={1.8} from={0} to={Math.PI * 2} />
        <End s={1} />
        <End s={-1} />
        <Stanchion s={1} />
        <Stanchion s={-1} />
        {/* The scorers' table and the benches across the floor, the banners along the stands */}
        <mesh geometry={BOX} material={mats.table} position={[0, 0.45, -(PRO.z + 1.6)]} scale={[6, 0.9, 0.7]} castShadow />
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={BOX} material={wood} position={[s * 7.5, 0.25, -(PRO.z + 1.9)]} scale={[6, 0.5, 0.5]} castShadow />
            <mesh geometry={BOX} material={s > 0 ? mats.board1 : mats.board2} position={[s * 8.5, 0.5, -(PRO.z + 2.9)]} scale={[12, 1, 0.12]} />
          </group>
        ))}
        <Stands />
        {/* The roof's lights in rows */}
        {[-9, -3, 3, 9].map((x) => [-5, 5].map((z) => <mesh key={`${x}${z}`} geometry={BOX} material={light} position={[x, 14, z]} scale={[2.4, 0.2, 1.2]} />))}
        {[-12, 0, 12].map((x) => (
          <mesh key={x} geometry={BOX} material={table} position={[x, 14.4, 0]} scale={[0.3, 0.3, 26]} />
        ))}
      </StaticMerge>
      {/* The glass (not merged: see-through) */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={glass} position={[s * (PRO.board + 0.03), BOARD.y + BOARD.h / 2, 0]} scale={[0.03, BOARD.h, BOARD.w]} />
      ))}
      <ProRim g={g} s={1} />
      <ProRim g={g} s={-1} />
      <ShotClock g={g} s={1} />
      <ShotClock g={g} s={-1} />
    </>
  )
}

/** The arena's inside colour round it (the walls and the dark roof beyond the lights). */
export const PALAIS_HAZE = '#1d2230'
