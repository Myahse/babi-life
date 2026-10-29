import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from '../world3d/themes'
import { StaticMerge } from '../world3d/staticMerge'
import { Palm } from '../world3d/props'
import { ARC, BOARD_Z, COURT, HOOP, RIM_Y, type Game } from './game'
import { paint } from './looks'
import { Quarter } from './scene'

// Le basket de rue's court (game.ts Rules.street, basketball): an old slab of
// concrete laid on the red earth of the quarter, cracked, patched, grass in
// the cracks, the lines painted by hand (the key in faded red, the arc in
// yellow, « LE BRONX » at the top); one hoop of welded iron on a pipe set in
// a block of concrete, an old tyre round its foot, the board a sheet of
// painted metal, the ring a little bent and its chain net. Block walls round
// it painted with the quarter's brands (low at the sides: the neighbours and
// the kids lean on them), the sound system on its crate at the corner, a
// radio on the back wall, the bulb on its wire for the evenings; palms, the
// electric pole, the quarter close round it.

const BOX = new THREE.BoxGeometry(1, 1, 1)
const flat = (color: string) => new THREE.MeshLambertMaterial({ color })

/** The slab's extent: a little past the lines. */
const SLAB = { x: COURT.x + 0.7, z0: COURT.z0 - 0.7, z1: COURT.z1 + 0.7 }
/** The walls: behind the basket, the sides (low), where they stop for the way in. */
const WALL = { back: -8.45, side: 8.72, end: 6.2, backH: 1.45, sideH: 1.05 }

/** The slab: grey concrete, cracked and patched, red earth blown over its edges, the lines painted by hand. */
function concrete() {
  const W = 1024
  const [w, d] = [SLAB.x * 2, SLAB.z1 - SLAB.z0]
  const H = Math.round((W * d) / w)
  return paint(`panier-slab${w}x${d}`, W, H, (g) => {
    const r = rng('panier-slab')
    const k = W / w
    const at = (x: number, z: number): [number, number] => [(x + SLAB.x) * k, (z - SLAB.z0) * k]
    g.fillStyle = '#9a958d'
    g.fillRect(0, 0, W, H)
    for (let i = 0; i < 70000; i++) {
      const v = r()
      g.fillStyle = v < 0.45 ? 'rgba(60,55,50,0.10)' : v < 0.9 ? 'rgba(235,230,220,0.08)' : 'rgba(40,38,35,0.2)'
      g.fillRect(r() * W, r() * H, 2, 2)
    }
    const blot = (x: number, z: number, rad: number, color: string) => {
      const [cx, cy] = at(x, z)
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad * k)
      grad.addColorStop(0, color)
      grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
      g.fillStyle = grad
      g.fillRect(cx - rad * k, cy - rad * k, rad * k * 2, rad * k * 2)
    }
    // Worn darker under the basket and at the top, where everyone plays; old stains, a dried puddle.
    blot(0, HOOP[1] + 1.5, 3.2, 'rgba(70,65,60,0.28)')
    blot(0, 4.5, 2.6, 'rgba(70,65,60,0.2)')
    for (let i = 0; i < 10; i++) blot((r() - 0.5) * w, SLAB.z0 + r() * d, 0.8 + r() * 1.6, 'rgba(50,45,40,0.22)')
    blot(-4.6, 2.4, 1.1, 'rgba(60,70,80,0.3)')
    // Patches of newer cement, lighter, their edges square.
    for (const [x, z, pw, pd] of [
      [3.6, -1.2, 1.8, 1.2],
      [-5.4, -4.4, 1.3, 1.5],
      [1.2, 5.6, 2.2, 0.9],
    ]) {
      const [cx, cy] = at(x - pw / 2, z - pd / 2)
      g.fillStyle = '#b3aea5'
      g.fillRect(cx, cy, pw * k, pd * k)
      g.strokeStyle = 'rgba(40,38,35,0.45)'
      g.lineWidth = 2
      g.strokeRect(cx, cy, pw * k, pd * k)
    }
    // The red earth blown over the edges, thicker at the corners.
    const edge = g.createLinearGradient(0, 0, 0, H)
    edge.addColorStop(0, 'rgba(165,85,45,0.55)')
    edge.addColorStop(0.08, 'rgba(165,85,45,0)')
    edge.addColorStop(0.9, 'rgba(165,85,45,0)')
    edge.addColorStop(1, 'rgba(165,85,45,0.6)')
    g.fillStyle = edge
    g.fillRect(0, 0, W, H)
    for (const x of [0, W]) {
      const side = g.createLinearGradient(x, 0, x === 0 ? W * 0.08 : W * 0.92, 0)
      side.addColorStop(0, 'rgba(165,85,45,0.5)')
      side.addColorStop(1, 'rgba(165,85,45,0)')
      g.fillStyle = side
      g.fillRect(x === 0 ? 0 : W * 0.92, 0, W * 0.08, H)
    }
    // The cracks, branching; grass coming up in some.
    for (let i = 0; i < 16; i++) {
      let [x, y] = [r() * W, r() * H]
      g.strokeStyle = 'rgba(30,28,25,0.75)'
      g.lineWidth = 1.2 + r() * 1.6
      g.beginPath()
      g.moveTo(x, y)
      const pts: [number, number][] = []
      for (let s = 0; s < 10; s++) {
        x += (r() - 0.5) * 70
        y += (r() - 0.5) * 70
        g.lineTo(x, y)
        pts.push([x, y])
      }
      g.stroke()
      if (r() < 0.5)
        for (const [px, py] of pts.filter(() => r() < 0.4))
          for (let j = 0; j < 6; j++) {
            g.fillStyle = r() < 0.5 ? '#6f8f3a' : '#4f7a2e'
            g.fillRect(px + (r() - 0.5) * 10, py + (r() - 0.5) * 8, 2, 4)
          }
    }
    // The lines, by hand with a brush: a little crooked, thicker here, worn through there.
    g.lineCap = 'round'
    const brush = (pts: [number, number][], color: string, wd: number) => {
      for (let i = 1; i < pts.length; i++) {
        if (r() < 0.12) continue
        const [ax, ay] = at(...pts[i - 1])
        const [bx, by] = at(...pts[i])
        g.strokeStyle = color.replace('A', (0.55 + r() * 0.35).toFixed(2))
        g.lineWidth = wd * (0.8 + r() * 0.5)
        g.beginPath()
        g.moveTo(ax + (r() - 0.5) * 2, ay + (r() - 0.5) * 2)
        g.lineTo(bx + (r() - 0.5) * 2, by + (r() - 0.5) * 2)
        g.stroke()
      }
    }
    const line = (a: [number, number], b: [number, number], color: string, wd = 5) => {
      const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.35))
      brush([...Array(n + 1)].map((_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as [number, number]), color, wd)
    }
    const arc = (cx: number, cz: number, rad: number, a0: number, a1: number, color: string, wd = 5) => {
      const n = Math.max(6, Math.round((rad * Math.abs(a1 - a0)) / 0.3))
      brush([...Array(n + 1)].map((_, i) => [cx + Math.cos(a0 + ((a1 - a0) * i) / n) * rad, cz + Math.sin(a0 + ((a1 - a0) * i) / n) * rad] as [number, number]), color, wd)
    }
    const { x, z0, z1 } = COURT
    // The key in faded red paint, worn where the feet go.
    const [kx, ky] = at(-2.45, z0)
    g.fillStyle = 'rgba(176,52,40,0.55)'
    g.fillRect(kx, ky, 4.9 * k, 5.8 * k)
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = 'rgba(154,149,141,0.5)'
      g.fillRect(kx + r() * 4.9 * k, ky + r() * 5.8 * k, 3, 3)
    }
    const white = 'rgba(240,236,226,A)'
    line([-x, z0], [x, z0], white)
    line([-x, z0], [-x, z1], white)
    line([x, z0], [x, z1], white)
    line([-x, z1], [x, z1], white)
    line([-2.45, z0], [-2.45, z0 + 5.8], white)
    line([2.45, z0], [2.45, z0 + 5.8], white)
    line([-2.45, z0 + 5.8], [2.45, z0 + 5.8], white)
    arc(0, z0 + 5.8, 1.8, 0, Math.PI, white)
    // The arc in yellow: past it, 2 points.
    const yellow = 'rgba(255,205,60,A)'
    line([-ARC, z0], [-ARC, HOOP[1]], yellow, 6)
    line([ARC, z0], [ARC, HOOP[1]], yellow, 6)
    arc(HOOP[0], HOOP[1], ARC, 0, Math.PI, yellow, 6)
    // The quarter's name at the top, painted big by hand.
    const [tx, ty] = at(0, z1 - 1.7)
    g.save()
    g.translate(tx, ty)
    g.rotate(-0.03)
    g.font = `900 ${Math.round(1.25 * k)}px 'Baloo 2', Impact, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 6
    g.strokeStyle = 'rgba(20,20,20,0.5)'
    g.strokeText('LE BRONX', 0, 0)
    g.fillStyle = 'rgba(255,130,0,0.85)'
    g.fillText('LE BRONX', 0, 0)
    g.restore()
    // Worn through the paint, here and there.
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = 'rgba(154,149,141,0.55)'
      g.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 2)
    }
  })
}

/** The earth round the slab (the quarter's): red dust, pebbles; it repeats. */
function dust() {
  return paint(
    'panier-dust',
    256,
    256,
    (g) => {
      const r = rng('panier-dust')
      g.fillStyle = '#a65f39'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 9000; i++) {
        const v = r()
        g.fillStyle = v < 0.5 ? 'rgba(80,35,15,0.14)' : v < 0.9 ? 'rgba(230,165,115,0.12)' : 'rgba(110,105,100,0.5)'
        g.fillRect(r() * 256, r() * 256, 2, 2)
      }
    },
    [24, 20],
  )
}

/** A brand painted on the wall, in a panel. */
type Brand = { text: string; bg: string; fg: string; sub?: string }
/** The quarter's brands (made up: nobody pays for these walls). */
const BRANDS: Brand[] = [
  { text: 'GBAKA COLA', bg: '#d6336c', fg: '#ffffff', sub: 'Ça rafraîchit !' },
  { text: 'ZOUGLOU FM', bg: '#1c7ed6', fg: '#ffd43b', sub: '98.2' },
  { text: 'ATTIÉKÉ EXPRESS', bg: '#f08c00', fg: '#ffffff' },
  { text: 'BABI BALL', bg: '#2b8a3e', fg: '#ffffff', sub: 'Le quartier joue' },
  { text: 'ALLOCO CHAUD', bg: '#e8590c', fg: '#fff3bf' },
  { text: 'TRANSFERT RAPIDE', bg: '#5f3dc4', fg: '#ffffff' },
  { text: 'COIFFURE LE BOSS', bg: '#212529', fg: '#ffd43b' },
  { text: 'DIEU EST GRAND', bg: '#f1f3f5', fg: '#1864ab' },
  { text: 'YOP CITY', bg: '#c92a2a', fg: '#ffffff' },
]

/** A block wall: grey blocks and their mortar, the paint flaking, the earth splashed up its foot, the brands painted on in panels. */
function mural(key: string, len: number, h: number, brands: Brand[]) {
  const W = 1024
  const H = Math.max(48, Math.round((W * h) / len))
  return paint(`panier-wall${key}`, W, H, (g) => {
    const r = rng(`panier-wall${key}`)
    const k = W / len
    g.fillStyle = '#a7a39b'
    g.fillRect(0, 0, W, H)
    for (let y = 0, row = 0; y < H; y += 0.2 * k, row++)
      for (let x = row % 2 ? -0.2 * k : 0; x < W; x += 0.4 * k) {
        const v = 150 + Math.floor(r() * 30)
        g.fillStyle = `rgb(${v},${v - 3},${v - 10})`
        g.fillRect(x + 1, y + 1, 0.4 * k - 2, 0.2 * k - 2)
      }
    // Each brand in its panel, painted by hand (the edges not quite straight), the letters big.
    brands.forEach((b, i) => {
      const cell = W / brands.length
      const [px, pw] = [i * cell + cell * 0.06, cell * 0.88]
      const [py, ph] = [H * 0.1, H * 0.72]
      g.fillStyle = b.bg
      g.beginPath()
      g.moveTo(px + (r() - 0.5) * 6, py + (r() - 0.5) * 4)
      g.lineTo(px + pw + (r() - 0.5) * 6, py + (r() - 0.5) * 4)
      g.lineTo(px + pw + (r() - 0.5) * 6, py + ph + (r() - 0.5) * 4)
      g.lineTo(px + (r() - 0.5) * 6, py + ph + (r() - 0.5) * 4)
      g.closePath()
      g.fill()
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = b.fg
      g.font = `900 ${Math.round(ph * (b.sub ? 0.42 : 0.55))}px 'Baloo 2', Impact, sans-serif`
      g.fillText(b.text, px + pw / 2, py + ph * (b.sub ? 0.4 : 0.52), pw * 0.92)
      if (b.sub) {
        g.font = `800 ${Math.round(ph * 0.22)}px 'Baloo 2', Impact, sans-serif`
        g.fillText(b.sub, px + pw / 2, py + ph * 0.78, pw * 0.8)
      }
    })
    // The paint flaking off, the blocks showing through; the red earth splashed up the foot by the rains.
    for (let i = 0; i < 260; i++) {
      g.fillStyle = 'rgba(170,165,155,0.9)'
      g.fillRect(r() * W, r() * H, 3 + r() * 9, 2 + r() * 5)
    }
    const foot = g.createLinearGradient(0, H * 0.72, 0, H)
    foot.addColorStop(0, 'rgba(150,70,35,0)')
    foot.addColorStop(1, 'rgba(150,70,35,0.65)')
    g.fillStyle = foot
    g.fillRect(0, H * 0.72, W, H * 0.28)
  })
}

/** The board: a sheet of metal painted white long ago, the square in red, rust running down from the bolts. */
function board() {
  return paint('panier-board', 256, 168, (g) => {
    const r = rng('panier-board')
    g.fillStyle = '#e9e4d8'
    g.fillRect(0, 0, 256, 168)
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'
      g.fillRect(r() * 256, r() * 168, 2, 2)
    }
    for (const [x, y] of [
      [14, 12],
      [242, 12],
      [14, 156],
      [242, 156],
    ]) {
      const run = g.createLinearGradient(x, y, x, y + 60)
      run.addColorStop(0, 'rgba(140,60,20,0.7)')
      run.addColorStop(1, 'rgba(140,60,20,0)')
      g.fillStyle = run
      g.fillRect(x - 3, y, 6 + r() * 4, 60)
      g.fillStyle = '#5c4033'
      g.fillRect(x - 3, y - 3, 6, 6)
    }
    g.strokeStyle = '#b03428'
    g.lineWidth = 7
    g.strokeRect(84, 82, 88, 62)
    g.lineWidth = 9
    g.strokeRect(5, 5, 246, 158)
  })
}

const iron = flat('#7a2e1f')
const rust = flat('#8a4a2a')
const ring = flat('#c2410c')
const block = flat('#8f8a84')
const tyre = flat('#1c1c1e')
const wood = flat('#6b4a2e')
const black = flat('#17171a')
const cone = flat('#3a3a40')
const crate = flat('#1971c2')
const bulb = new THREE.MeshBasicMaterial({ color: '#fff6d5' })
const led = new THREE.MeshBasicMaterial({ color: '#40c057' })
// The chain net: grey steel links.
const chain = new THREE.MeshLambertMaterial({ color: '#9aa1a9', wireframe: true })

/** The ring on its board, a little bent (it's been hung on), and its chain net: pulled down by a dunker hanging on it, shaking back (the Gbê, hard); the chains jump as the ball goes through. */
function StreetRim({ g }: { g: Game }) {
  const hinge = useRef<THREE.Group>(null)
  const net = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const h = hinge.current
    if (!h) return
    const hanging = g.ps.some((p) => p.act === 'dunk' && (p.gbe ? p.at > 0.95 && p.at < 1.5 : p.at > 0.5 && p.at < 1.15))
    const since = g.time - g.rim.t
    const shake = since >= 0 && since < 1.8 ? Math.sin(since * 30) * g.rim.amp * Math.exp(-since * 3) : 0
    // (Bent: it droops a little at rest.)
    h.rotation.x = 0.06 + (hanging ? 0.16 + Math.sin(g.time * 30) * 0.025 : shake)
    const s = g.time - g.swish
    if (net.current) net.current.scale.y = s >= 0 && s < 0.5 ? 1 + Math.sin((s / 0.5) * Math.PI) * 0.35 : 1
  })
  const back = HOOP[1] - BOARD_Z
  return (
    <group ref={hinge} position={[HOOP[0], RIM_Y, BOARD_Z]} rotation={[0.06, 0, 0.04]}>
      <mesh position={[0, 0, back]} rotation={[Math.PI / 2, 0, 0]} material={ring}>
        <torusGeometry args={[0.23, 0.022, 6, 20]} />
      </mesh>
      {/* The bracket welded under it */}
      <mesh geometry={BOX} material={iron} position={[0, -0.03, back / 2]} scale={[0.08, 0.04, back - 0.18]} />
      <mesh geometry={BOX} material={iron} position={[0, -0.12, 0.05]} scale={[0.06, 0.22, 0.04]} rotation={[0.6, 0, 0]} />
      <mesh ref={net} position={[0, -0.22, back]} material={chain}>
        <cylinderGeometry args={[0.22, 0.16, 0.44, 12, 4, true]} />
      </mesh>
    </group>
  )
}

/** The court, its hoop and its walls, the sound system, the quarter round it. */
export function StreetCourt({ g, seed }: { g: Game; seed: string }) {
  const mats = useMemo(
    () => ({
      slab: new THREE.MeshLambertMaterial({ map: concrete() }),
      dirt: new THREE.MeshLambertMaterial({ map: dust() }),
      back: new THREE.MeshLambertMaterial({ map: mural('back', WALL.side * 2, WALL.backH, [BRANDS[0], BRANDS[1], BRANDS[2]]) }),
      left: new THREE.MeshLambertMaterial({ map: mural('left', WALL.end - WALL.back, WALL.sideH, [BRANDS[3], BRANDS[4], BRANDS[5]]) }),
      right: new THREE.MeshLambertMaterial({ map: mural('right', WALL.end - WALL.back, WALL.sideH, [BRANDS[6], BRANDS[7], BRANDS[8]]) }),
      board: new THREE.MeshLambertMaterial({ map: board() }),
    }),
    [],
  )
  const palms = useMemo(() => {
    const r = rng(`panier-props${seed}`)
    return [
      [-6 + r() * 2, -11.5],
      [5 + r() * 2, -12],
      [12, 1 + r() * 2],
      [-12.5, -3 + r() * 2],
    ] as [number, number][]
  }, [seed])
  const sideLen = WALL.end - WALL.back
  const pole = -7.95
  return (
    <>
      <StaticMerge>
        {/* The earth all round, the slab on it */}
        <mesh geometry={BOX} material={mats.dirt} position={[0, -0.05, 0]} scale={[110, 0.1, 90]} receiveShadow />
        <mesh geometry={BOX} material={mats.slab} position={[0, 0, (SLAB.z0 + SLAB.z1) / 2]} scale={[SLAB.x * 2, 0.04, SLAB.z1 - SLAB.z0]} receiveShadow />
        {/* The walls: behind the basket, the sides low enough to lean on; the near side open (the camera looks in from there), a kerb */}
        <mesh geometry={BOX} material={mats.back} position={[0, WALL.backH / 2, WALL.back]} scale={[WALL.side * 2 + 0.2, WALL.backH, 0.2]} castShadow receiveShadow />
        <mesh geometry={BOX} material={mats.left} position={[-WALL.side, WALL.sideH / 2, (WALL.back + WALL.end) / 2]} scale={[0.2, WALL.sideH, sideLen]} rotation={[0, 0, 0]} castShadow receiveShadow />
        <mesh geometry={BOX} material={mats.right} position={[WALL.side, WALL.sideH / 2, (WALL.back + WALL.end) / 2]} scale={[0.2, WALL.sideH, sideLen]} castShadow receiveShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={BOX} material={block} position={[s * WALL.side, WALL.sideH / 2 + 0.1, WALL.end + 0.1]} scale={[0.32, WALL.sideH + 0.2, 0.32]} castShadow />
        ))}
        <mesh geometry={BOX} material={block} position={[0, 0.1, SLAB.z1 + 0.2]} scale={[SLAB.x * 2, 0.2, 0.25]} receiveShadow />
        {/* The hoop: the pipe in its block of concrete, an old tyre round its foot, the arm and its brace, the board */}
        <mesh geometry={BOX} material={block} position={[0, 0.2, pole]} scale={[0.6, 0.4, 0.6]} castShadow />
        <mesh material={rust} position={[0, 1.8, pole]} castShadow>
          <cylinderGeometry args={[0.075, 0.085, 3.6, 8]} />
        </mesh>
        <mesh material={tyre} position={[0, 0.52, pole]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.3, 0.12, 6, 14]} />
        </mesh>
        <mesh geometry={BOX} material={iron} position={[0, 3.45, (pole + BOARD_Z) / 2]} scale={[0.09, 0.09, BOARD_Z - pole + 0.1]} castShadow />
        <mesh geometry={BOX} material={iron} position={[0, 3.02, pole + 0.68]} scale={[0.07, 0.07, 1.6]} rotation={[-0.56, 0, 0]} />
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} geometry={BOX} material={iron} position={[x, 3.4, BOARD_Z - 0.08]} scale={[0.06, 1.0, 0.06]} />
        ))}
        <mesh geometry={BOX} material={iron} position={[0, 3.4, BOARD_Z - 0.08]} scale={[1.2, 0.06, 0.06]} />
        <mesh geometry={BOX} material={mats.board} position={[0, 3.42, BOARD_Z - 0.03]} scale={[1.6, 1.05, 0.04]} rotation={[0, 0, 0.015]} castShadow />
        {/* The sound system on its crate at the corner, a speaker each side of the amp; a radio on the back wall; the bulb on its wire */}
        <group position={[-WALL.side - 0.9, 0, 7.4]} rotation={[0, Math.PI / 2 + 0.6, 0]}>
          <mesh geometry={BOX} material={crate} position={[0, 0.2, 0]} scale={[1.5, 0.4, 0.5]} castShadow />
          {[-0.45, 0.45].map((x) => (
            <group key={x} position={[x, 0.95, 0]}>
              <mesh geometry={BOX} material={black} scale={[0.55, 1.1, 0.45]} castShadow />
              <mesh material={cone} position={[0, -0.18, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.02, 14]} />
              </mesh>
              <mesh material={cone} position={[0, 0.3, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.02, 10]} />
              </mesh>
            </group>
          ))}
          <mesh geometry={BOX} material={black} position={[0, 0.5, 0.02]} scale={[0.3, 0.16, 0.36]} />
          <mesh geometry={BOX} material={led} position={[0.08, 0.5, 0.21]} scale={[0.04, 0.03, 0.01]} />
        </group>
        <group position={[5.6, WALL.backH, WALL.back]}>
          <mesh geometry={BOX} material={black} position={[0, 0.12, 0]} scale={[0.42, 0.24, 0.14]} />
          <mesh material={cone} position={[-0.1, 0.12, 0.075]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.01, 10]} />
          </mesh>
          <mesh geometry={BOX} material={black} position={[0.14, 0.45, 0]} scale={[0.012, 0.5, 0.012]} rotation={[0, 0, -0.3]} />
        </group>
        {/* Two wooden poles at the back corners, the wire between, the bulb hanging over the basket */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={BOX} material={wood} position={[s * (WALL.side + 0.5), 3.6, WALL.back - 0.4]} scale={[0.22, 7.2, 0.22]} castShadow />
            <mesh geometry={BOX} material={wood} position={[s * (WALL.side + 0.5), 6.9, WALL.back - 0.4]} scale={[0.12, 0.12, 1.2]} />
          </group>
        ))}
        <mesh geometry={BOX} material={black} position={[0, 6.75, WALL.back - 0.4]} scale={[WALL.side * 2 + 1, 0.025, 0.025]} />
        <mesh geometry={BOX} material={black} position={[0, 6.5, WALL.back - 0.4]} scale={[0.015, 0.5, 0.015]} />
        <mesh material={bulb} position={[0, 6.2, WALL.back - 0.4]}>
          <sphereGeometry args={[0.1, 8, 6]} />
        </mesh>
        {/* A stack of old tyres and a bench along the side, palms over the walls */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={tyre} position={[WALL.side + 1.1, 0.12 + i * 0.22, 5.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.3, 0.11, 6, 12]} />
          </mesh>
        ))}
        <mesh geometry={BOX} material={wood} position={[WALL.side + 1.5, 0.42, -1]} scale={[0.4, 0.06, 2.4]} castShadow />
        {[-0.9, 0.9].map((z) => (
          <mesh key={z} geometry={BOX} material={wood} position={[WALL.side + 1.5, 0.2, -1 + z]} scale={[0.32, 0.4, 0.08]} />
        ))}
        {palms.map((p, i) => (
          <Palm key={i} p={[p[0], 0, p[1]]} h={5.5 + i * 0.7} lean={0.1 + i * 0.05} />
        ))}
        <Quarter hx={WALL.side + 0.6} hz={8.3} seed={seed} gap={4.2} />
      </StaticMerge>
      <StreetRim g={g} />
    </>
  )
}
