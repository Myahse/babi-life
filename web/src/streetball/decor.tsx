import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sizedBox } from '../world3d/bevel'
import { StaticMerge } from '../world3d/staticMerge'
import { useMiniTier, type MiniTier } from '../world3d/minijeux'
import { rng } from '../world3d/themes'
import { paint } from './looks'
import { t } from '../lib/i18n'

// « Mini-jeux réalistes », phase 2: the sports' props and sets themselves (the concept's
// « realistic blocks »: still blocks, chamfered, pixel textures at a centimetre or two a texel,
// rich small details). Shared by every sport scene (streetball, the stadium, the Palais, tennis,
// volley, the ring, the track, the billiard table): benches with bags and water bottles, floodlight
// masts with their lamp heads, advertising boards and murals (invented brands only), stepped stands
// with their seats, chain-link fences, ground wear (cracks, worn goalmouths, footprints), the hoops'
// nets, the goals' box-weave, the balls' panels and seams.
// Nothing here is drawn while the update « minijeux-realistes » is shut: each scene mounts its
// <Dressing> only when the tier isn't « off ». The props are static: a scene puts them in one
// <StaticMerge> (baked by material: a handful of draw calls for the whole set). On « simple » the
// boxes stay plain (no chamfer) and the scenes leave out the smallest props.

/** The tier the set is drawn at (inside a <Dressing>). */
const TierCtx = createContext<MiniTier>('simple')
export const useDecorTier = () => useContext(TierCtx)
/** Whether the small things are drawn (bottles, decals): not on « simple ». */
export const useRich = () => useContext(TierCtx) !== 'simple'

/**
 * The set of a scene: drawn only while the update is open, baked into a few meshes. `children` is a
 * render function of the tier (to leave the small things out on « simple »).
 */
export function Dressing({ children, live }: { children: (tier: MiniTier) => ReactNode; /** Unbaked children (what moves). */ live?: (tier: MiniTier) => ReactNode }) {
  const tier = useMiniTier()
  if (tier === 'off') return null
  return (
    <TierCtx.Provider value={tier}>
      <StaticMerge>{children(tier)}</StaticMerge>
      {live?.(tier)}
    </TierCtx.Provider>
  )
}

/* ---------- Materials and textures (shared, made once) ---------- */

const flats = new Map<string, THREE.MeshLambertMaterial>()
/** A plain painted material, shared by colour. */
export function M(color: string) {
  let m = flats.get(color)
  if (!m) flats.set(color, (m = new THREE.MeshLambertMaterial({ color })))
  return m
}
const textured = new Map<string, THREE.MeshLambertMaterial>()
/** A material with a canvas texture, shared by key. */
export function TM(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, opts?: { repeat?: [number, number]; transparent?: boolean; alphaTest?: number; side?: THREE.Side; emissive?: string }) {
  let m = textured.get(key)
  if (!m) {
    const t = paint(`decor-${key}`, w, h, (g) => draw(g, rng(`decor-${key}`)), opts?.repeat)
    m = new THREE.MeshLambertMaterial({ map: t, transparent: !!opts?.transparent, alphaTest: opts?.alphaTest ?? 0, side: opts?.side ?? THREE.FrontSide })
    if (opts?.transparent) {
      m.depthWrite = false
      m.polygonOffset = true
      m.polygonOffsetFactor = -2
      m.polygonOffsetUnits = -2
    }
    if (opts?.emissive) {
      m.emissive.set(opts.emissive)
      m.emissiveMap = t
    }
    textured.set(key, m)
  }
  return m
}

/** Grain: n specks of light and dark over a base. */
function speck(g: CanvasRenderingContext2D, r: () => number, w: number, h: number, n: number, a = 0.08, s = 1) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.2})`
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), s, s)
  }
}

/** Planks of varnished wood along u, their grain and joints (2 cm a texel). */
export const woodMat = () =>
  TM('wood', 64, 64, (g, r) => {
    g.fillStyle = '#8a5a32'
    g.fillRect(0, 0, 64, 64)
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x += 1 + Math.floor(r() * 3)) {
      const v = Math.sin(y * 0.9 + Math.sin(x * 0.15) * 2) * 10 + (r() - 0.5) * 12
      g.fillStyle = `rgb(${138 + v},${90 + v * 0.7},${50 + v * 0.4})`
      g.fillRect(x, y, 3, 1)
    }
    g.fillStyle = 'rgba(40,20,8,0.55)'
    for (const y of [0, 21, 42]) g.fillRect(0, y, 64, 1)
  })
/** Painted steel: a little chipped, rust in the scratches. */
export const steelMat = (color = '#5b636e') =>
  TM(`steel${color}`, 32, 32, (g, r) => {
    g.fillStyle = color
    g.fillRect(0, 0, 32, 32)
    speck(g, r, 32, 32, 120, 0.07)
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(120,60,30,0.5)'
      g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1)
    }
  })
/** Cast concrete: grey, pores, a few darker stains. */
export const concreteMat = (tone = 168) =>
  TM(`concrete${tone}`, 64, 64, (g, r) => {
    g.fillStyle = `rgb(${tone},${tone - 4},${tone - 10})`
    g.fillRect(0, 0, 64, 64)
    speck(g, r, 64, 64, 900, 0.06)
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(40,36,30,0.08)'
      g.fillRect(Math.floor(r() * 56), Math.floor(r() * 56), 4 + Math.floor(r() * 8), 3 + Math.floor(r() * 6))
    }
  })

/* ---------- The shapes ---------- */

type V3 = [number, number, number]

/** A block: chamfered when the tier allows it (plain on « simple »), baked with the rest. */
export function B({ p, s, m, r, cast = true }: { p: V3; s: V3; m: THREE.Material; r?: V3; cast?: boolean }) {
  const tier = useDecorTier()
  return <mesh {...sizedBox(s, tier === 'simple' ? 'off' : 'plein')} position={p} rotation={r} material={m} castShadow={cast} receiveShadow />
}
/** A round bar (a post, a pipe), `n` sides. */
export function Pipe({ p, len, rad, m, r, n = 8 }: { p: V3; len: number; rad: number; m: THREE.Material; r?: V3; n?: number }) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow>
      <cylinderGeometry args={[rad, rad, len, n]} />
    </mesh>
  )
}

/* ---------- Bench, bags, bottles, cooler, chairs, towels ---------- */

/** A bench: three varnished slats on two steel frames; `len` its length along x (rotated by `rot`). */
export function Bench({ p, rot = 0, len = 2, back = false }: { p: V3; rot?: number; len?: number; back?: boolean }) {
  const wood = woodMat()
  const steel = steelMat('#3d4a57')
  return (
    <group position={p} rotation={[0, rot, 0]}>
      {[-0.13, 0, 0.13].map((z) => (
        <B key={z} p={[0, 0.45, z]} s={[len, 0.035, 0.11]} m={wood} />
      ))}
      {back && [0.62, 0.78].map((y) => <B key={y} p={[0, y, -0.2]} s={[len, 0.1, 0.03]} m={wood} r={[-0.12, 0, 0]} />)}
      {[-len / 2 + 0.2, len / 2 - 0.2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <B p={[0, 0.215, -0.15]} s={[0.04, 0.43, 0.04]} m={steel} />
          <B p={[0, 0.215, 0.15]} s={[0.04, 0.43, 0.04]} m={steel} />
          <B p={[0, 0.41, 0]} s={[0.04, 0.04, 0.36]} m={steel} />
          {back && <B p={[0, 0.62, -0.2]} s={[0.04, 0.42, 0.04]} m={steel} r={[-0.12, 0, 0]} />}
        </group>
      ))}
    </group>
  )
}

const BOTTLES = ['#74c0fc', '#e7f5ff', '#ff922b', '#69db7c']
/** A plastic water bottle (half full), its cap and label; `k` picks its kind. */
export function Bottle({ p, k = 0, down = false }: { p: V3; k?: number; down?: boolean }) {
  const body = M(BOTTLES[k % BOTTLES.length])
  const label = M(['#1c7ed6', '#2b8a3e', '#e03131', '#f08c00'][k % 4])
  const cap = M(['#1864ab', '#f8f9fa', '#212529', '#e03131'][k % 4])
  return (
    <group position={p} rotation={down ? [0, k, Math.PI / 2] : [0, k * 0.7, 0]}>
      <B p={[0, 0.1, 0]} s={[0.07, 0.2, 0.07]} m={body} cast={false} />
      <B p={[0, 0.1, 0]} s={[0.074, 0.06, 0.074]} m={label} cast={false} />
      <B p={[0, 0.215, 0]} s={[0.035, 0.03, 0.035]} m={cap} cast={false} />
    </group>
  )
}

/** A sports bag: the duffel, its contrasting band and its strap; `c` its colour. */
export function Bag({ p, rot = 0, c = '#1c1c22', band = '#ff8200', open = false }: { p: V3; rot?: number; c?: string; band?: string; open?: boolean }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0.14, 0]} s={[0.62, 0.28, 0.3]} m={M(c)} />
      <B p={[0, 0.14, 0]} s={[0.12, 0.285, 0.305]} m={M(band)} />
      <B p={[0, 0.285, 0]} s={[0.5, 0.012, 0.04]} m={M('#adb5bd')} cast={false} />
      {/* The strap lying over it */}
      <B p={[0.12, 0.3, 0.02]} s={[0.05, 0.02, 0.36]} m={M('#212529')} r={[0, 0.5, 0]} cast={false} />
      {open && <B p={[-0.1, 0.3, 0]} s={[0.26, 0.06, 0.2]} m={M('#f8f9fa')} r={[0, 0.2, 0.1]} />}
    </group>
  )
}

/** A cooler (glacière): blue tub, white lid, the handle. */
export function Cooler({ p, rot = 0, c = '#1c7ed6' }: { p: V3; rot?: number; c?: string }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0.17, 0]} s={[0.55, 0.34, 0.36]} m={M(c)} />
      <B p={[0, 0.36, 0]} s={[0.58, 0.05, 0.39]} m={M('#f1f3f5')} />
      <B p={[0, 0.405, 0]} s={[0.32, 0.03, 0.04]} m={M('#495057')} cast={false} />
    </group>
  )
}

/** The plastic chair of every maquis (monobloc), white or green or red. */
export function Chair({ p, rot = 0, c = '#f1f3f5' }: { p: V3; rot?: number; c?: string }) {
  const m = M(c)
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0.42, 0]} s={[0.44, 0.04, 0.42]} m={m} />
      <B p={[0, 0.66, -0.2]} s={[0.44, 0.44, 0.04]} m={m} r={[-0.15, 0, 0]} />
      {[-0.19, 0.19].flatMap((x) => [-0.17, 0.17].map((z) => <B key={`${x}${z}`} p={[x, 0.2, z]} s={[0.04, 0.42, 0.04]} m={m} r={[z * 0.4, 0, -x * 0.4]} />))}
    </group>
  )
}

/** A towel folded (or hanging over a bench's edge). */
export function Towel({ p, rot = 0, c = '#f8f9fa' }: { p: V3; rot?: number; c?: string }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, 0.02, 0]} s={[0.36, 0.04, 0.24]} m={M(c)} cast={false} />
      <B p={[0, 0.021, 0.08]} s={[0.36, 0.042, 0.03]} m={M('#adb5bd')} cast={false} />
    </group>
  )
}

/**
 * The team's corner: a bench, the bags at its feet, bottles on it and on the ground, a towel; on
 * « normal » and up the cooler and a spare ball. `seed` varies it.
 */
export function SideKit({ p, rot = 0, len = 2.4, seed = 'k', bag = '#1c1c22', band = '#ff8200', back = false, ball }: { p: V3; rot?: number; len?: number; seed?: string; bag?: string; band?: string; back?: boolean; ball?: THREE.Material }) {
  const rich = useRich()
  const r = useMemo(() => rng(`sidekit${seed}`), [seed])
  const layout = useMemo(() => {
    const n = 2 + Math.floor(r() * 2)
    return {
      bags: [...Array(n)].map((_, i) => ({ x: -len / 2 + 0.4 + (i * (len - 0.6)) / n + r() * 0.2, z: 0.45 + r() * 0.15, rot: (r() - 0.5) * 0.8, open: r() < 0.3 })),
      bottles: [...Array(4)].map((_, i) => ({ x: -len / 2 + 0.25 + r() * (len - 0.5), on: i < 2, k: Math.floor(r() * 4), down: i === 3 })),
      towel: -len / 2 + 0.3 + r() * (len - 0.8),
      cooler: len / 2 + 0.45,
    }
  }, [r, len])
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Bench p={[0, 0, 0]} len={len} back={back} />
      {layout.bags.map((b, i) => (
        <Bag key={i} p={[b.x, 0, b.z]} rot={b.rot} c={i % 2 ? '#2b2f36' : bag} band={band} open={b.open} />
      ))}
      {rich && layout.bottles.map((b, i) => <Bottle key={i} p={b.on ? [b.x, 0.47, 0] : [b.x, b.down ? 0.035 : 0, 0.32]} k={b.k} down={b.down} />)}
      {rich && <Towel p={[layout.towel, 0.47, 0]} rot={0.2} />}
      {rich && <Cooler p={[layout.cooler, 0, 0.1]} rot={0.3} />}
      {rich && ball && (
        <mesh position={[layout.cooler + 0.1, 0.11, 0.55]} material={ball} castShadow>
          <sphereGeometry args={[0.11, 12, 8]} />
        </mesh>
      )}
    </group>
  )
}

/* ---------- Floodlight masts ---------- */

/** The lamp's glass: pale by day, glowing at night (blooms on « haute »). */
const lampGlass = new THREE.MeshLambertMaterial({ color: '#f8f4e3', emissive: '#fff6d5', emissiveIntensity: 0.35 })
export const lampOf = (night: boolean) => {
  lampGlass.emissiveIntensity = night ? 1.6 : 0.3
  return lampGlass
}

/**
 * A floodlight mast: a tapering galvanised pole with its climbing rungs, the head frame on top and
 * its lamp heads in rows, each a dark housing with its glass, tilted down to the ground. `face`: the
 * angle the heads look towards (radians, round y). `cols × rows` heads.
 */
export function Mast({ p, face, h = 9, cols = 3, rows = 2, lit = false, scale = 1 }: { p: V3; face: number; h?: number; cols?: number; rows?: number; lit?: boolean; scale?: number }) {
  const rich = useRich()
  const pole = steelMat('#8d949c')
  const dark = M('#2b2f36')
  const glass = lampOf(lit)
  const k = scale
  const W = cols * 0.62 * k
  return (
    <group position={p} rotation={[0, face, 0]}>
      <B p={[0, 0.25 * k, 0]} s={[0.6 * k, 0.5 * k, 0.6 * k]} m={concreteMat(150)} />
      <B p={[0, h * 0.3, 0]} s={[0.28 * k, h * 0.6, 0.28 * k]} m={pole} />
      <B p={[0, h * 0.78, 0]} s={[0.2 * k, h * 0.44, 0.2 * k]} m={pole} />
      {rich && [...Array(Math.floor(h / 0.9))].map((_, i) => <B key={i} p={[0.16 * k, 0.9 + i * 0.85, 0]} s={[0.05, 0.03, 0.22 * k]} m={pole} cast={false} />)}
      {/* The head frame and its heads, looking down at the ground */}
      <group position={[0, h, 0.2 * k]}>
        <B p={[0, 0, 0]} s={[W + 0.2 * k, 0.08 * k, 0.08 * k]} m={pole} />
        <B p={[0, rows * 0.5 * k, 0]} s={[W + 0.2 * k, 0.08 * k, 0.08 * k]} m={pole} />
        {[-W / 2 - 0.1 * k, W / 2 + 0.1 * k].map((x) => (
          <B key={x} p={[x, (rows * 0.5 * k) / 2, 0]} s={[0.08 * k, rows * 0.5 * k, 0.08 * k]} m={pole} />
        ))}
        {[...Array(cols)].flatMap((_, c) =>
          [...Array(rows)].map((_, r) => (
            <group key={`${c}${r}`} position={[-W / 2 + (c + 0.5) * 0.62 * k, (r + 0.5) * 0.5 * k, 0.12 * k]} rotation={[0.5, 0, 0]}>
              <B p={[0, 0, 0]} s={[0.5 * k, 0.4 * k, 0.18 * k]} m={dark} />
              <B p={[0, 0, 0.092 * k]} s={[0.42 * k, 0.32 * k, 0.012]} m={glass} cast={false} />
            </group>
          )),
        )}
      </group>
    </group>
  )
}

/* ---------- Advertising boards and murals ---------- */

/** The boards' brands: the game's own and the quarter's (all invented). */
export const AD_BRANDS: { text: string; bg: string; fg: string; sub?: string; band?: string }[] = [
  { text: 'WAYE', bg: '#1d4ed8', fg: '#ffffff', sub: t('Paie en 1 clic'), band: '#ffd43b' },
  { text: 'GOLVO', bg: '#2b8a3e', fg: '#ffffff', band: '#ffffff' },
  { text: 'POULMAN', bg: '#c92a2a', fg: '#ffd43b', sub: t('Poulet braisé') },
  { text: 'NOUM', bg: '#141416', fg: '#ff8200', sub: t('Énergie') },
  { text: 'AZALÉ', bg: '#f1f3f5', fg: '#e8590c', band: '#e8590c' },
  { text: 'RABISSON', bg: '#ffd43b', fg: '#141416', sub: t('Le riz du pays') },
  { text: 'GBAIRAI', bg: '#7048e8', fg: '#ffffff' },
  { text: 'BABI COLA', bg: '#e03131', fg: '#ffffff', band: '#ffffff' },
]

/** One brand's board: its colour, the name in big letters, a slogan, a band; a little scuffed. */
function adMat(i: number) {
  const b = AD_BRANDS[i % AD_BRANDS.length]
  return TM(`ad${i}`, 256, 64, (g, r) => {
    g.fillStyle = b.bg
    g.fillRect(0, 0, 256, 64)
    if (b.band) {
      g.fillStyle = b.band
      g.fillRect(0, 54, 256, 6)
      g.fillRect(0, 4, 256, 2)
    }
    g.fillStyle = b.fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `900 ${b.sub ? 30 : 38}px 'Baloo 2', Impact, sans-serif`
    g.fillText(b.text, 128, b.sub ? 26 : 32, 236)
    if (b.sub) {
      g.font = "800 13px 'Baloo 2', Impact, sans-serif"
      g.fillText(b.sub, 128, 50, 220)
    }
    speck(g, r, 256, 64, 300, 0.05)
    // Ball marks.
    for (let k = 0; k < 2; k++) {
      g.fillStyle = 'rgba(60,40,30,0.18)'
      g.beginPath()
      g.arc(r() * 256, 20 + r() * 30, 6, 0, Math.PI * 2)
      g.fill()
    }
  })
}

/**
 * A run of advertising boards on their feet from a to b (x, z), facing `face` (the side the pitch
 * is on), each board one brand; `h` their height.
 */
export function AdBoards({ a, b, h = 0.9, seed = 0, len = 3 }: { a: [number, number]; b: [number, number]; h?: number; seed?: number; len?: number }) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const L = Math.hypot(dx, dz)
  const n = Math.max(1, Math.round(L / len))
  const w = L / n
  const rot = -Math.atan2(dz, dx)
  const back = steelMat('#343a40')
  return (
    <group position={[a[0], 0, a[1]]} rotation={[0, rot, 0]}>
      {[...Array(n)].map((_, i) => (
        <group key={i} position={[(i + 0.5) * w, 0, 0]}>
          <B p={[0, h / 2 + 0.05, 0]} s={[w - 0.04, h, 0.06]} m={back} />
          <mesh position={[0, h / 2 + 0.05, 0.031]} material={adMat(i + seed)}>
            <planeGeometry args={[w - 0.08, h - 0.06]} />
          </mesh>
          <B p={[0, 0.03, -0.25]} s={[w - 0.3, 0.04, 0.04]} m={back} cast={false} />
          <B p={[-w / 2 + 0.15, h * 0.35, -0.13]} s={[0.04, h * 0.75, 0.04]} m={back} r={[-0.5, 0, 0]} cast={false} />
        </group>
      ))}
    </group>
  )
}

const MURAL_WORDS = ['BABI', 'ZOUGLOU', 'AKWABA', 'YOP', 'GBÊ', 'NOUCHI', 'ABOBO', 'DJO', 'KPAKPATO', 'TCHAPA']
/**
 * A painted mural: graffiti-style letters (invented words) with their outline and shadow, drips,
 * stars and blocks of colour, tags, a sun; on a block wall whose joints show through. `seed` picks it.
 */
export function muralMat(seed: number, w = 4, h = 1.6) {
  const W = 512
  const H = Math.max(64, Math.round((W * h) / w / 8) * 8)
  return TM(`mural${seed}-${W}x${H}`, W, H, (g, r) => {
    const pal = [
      ['#ffd43b', '#e8590c', '#1c7ed6', '#141416'],
      ['#69db7c', '#7048e8', '#ff8787', '#141416'],
      ['#ff922b', '#22b8cf', '#f8f9fa', '#212529'],
      ['#f06595', '#ffd43b', '#20c997', '#1a1b2e'],
    ][seed % 4]
    g.fillStyle = '#b5b0a6'
    g.fillRect(0, 0, W, H)
    // The ground colour, sprayed in clouds.
    for (let i = 0; i < 18; i++) {
      const [x, y, rad] = [r() * W, r() * H, 30 + r() * 60]
      const gr = g.createRadialGradient(x, y, 0, x, y, rad)
      gr.addColorStop(0, pal[i % 3] + 'cc')
      gr.addColorStop(1, pal[i % 3] + '00')
      g.fillStyle = gr
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    // Stars and dots.
    for (let i = 0; i < 26; i++) {
      g.fillStyle = r() < 0.5 ? '#ffffff' : pal[(i + 1) % 3]
      const s = 2 + Math.floor(r() * 4)
      g.fillRect(Math.floor(r() * W), Math.floor(r() * H), s, s)
    }
    // The word: outline, shadow, fill, the shine; each letter a little tilted.
    const word = MURAL_WORDS[seed % MURAL_WORDS.length]
    const size = Math.min(H * 0.62, (W * 0.85) / (word.length * 0.62))
    g.font = `900 ${Math.round(size)}px 'Baloo 2', Impact, sans-serif`
    g.textBaseline = 'middle'
    const total = g.measureText(word).width
    let x = W / 2 - total / 2
    for (const ch of word) {
      const cw = g.measureText(ch).width
      g.save()
      g.translate(x + cw / 2, H * 0.52)
      g.rotate((r() - 0.5) * 0.25)
      g.textAlign = 'center'
      g.lineJoin = 'round'
      g.lineWidth = size * 0.2
      g.strokeStyle = pal[3]
      g.strokeText(ch, size * 0.06, size * 0.06)
      g.strokeText(ch, 0, 0)
      g.fillStyle = pal[0]
      g.fillText(ch, 0, 0)
      g.fillStyle = 'rgba(255,255,255,0.45)'
      g.fillRect(-cw * 0.3, -size * 0.3, cw * 0.18, size * 0.12)
      g.restore()
      x += cw * 0.94
    }
    // Drips under the letters.
    for (let i = 0; i < 9; i++) {
      g.fillStyle = pal[0]
      const dx = W / 2 - total / 2 + r() * total
      g.fillRect(dx, H * 0.52 + size * 0.3, 3, 6 + r() * H * 0.2)
    }
    // A tag or two, thin and quick.
    g.strokeStyle = pal[3]
    g.lineWidth = 2
    for (let t = 0; t < 2; t++) {
      let [tx, ty] = [r() * W * 0.8, H * (0.12 + r() * 0.15)]
      g.beginPath()
      g.moveTo(tx, ty)
      for (let k = 0; k < 7; k++) g.lineTo((tx += 6 + r() * 8), ty + (r() - 0.5) * 16)
      g.stroke()
    }
    // The blocks' joints through the paint, the earth at the foot.
    g.fillStyle = 'rgba(70,64,56,0.22)'
    const bh = H / Math.max(2, Math.round(h / 0.2))
    for (let y = bh; y < H; y += bh) g.fillRect(0, Math.floor(y), W, 1)
    for (let y = 0, row = 0; y < H; y += bh, row++) for (let bx = row % 2 ? (bh * 2) / 2 : 0; bx < W; bx += bh * 2) g.fillRect(Math.floor(bx), Math.floor(y), 1, Math.ceil(bh))
    const foot = g.createLinearGradient(0, H * 0.8, 0, H)
    foot.addColorStop(0, 'rgba(140,70,35,0)')
    foot.addColorStop(1, 'rgba(140,70,35,0.5)')
    g.fillStyle = foot
    g.fillRect(0, H * 0.8, W, H * 0.2)
  })
}

/** A mural painted on a wall's face: a plane laid on it (`p` its centre, `rot` the way it faces). */
export function Mural({ p, rot = 0, w, h, seed = 0 }: { p: V3; rot?: number; w: number; h: number; seed?: number }) {
  return (
    <mesh position={p} rotation={[0, rot, 0]} material={muralMat(seed, w, h)}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/* ---------- Stands ---------- */

/**
 * Stepped concrete terraces from a to b (x, z), going back away from the ground, `rows` steps; each
 * step with its row of plastic seats in blocks of colour (`colors`, the pattern every `block` seats).
 */
export function Terraces({ a, b, rows = 5, step = 0.8, rise = 0.42, colors = ['#ff8200', '#f8f9fa', '#009e60'], block = 6, y0 = 0 }: { a: [number, number]; b: [number, number]; rows?: number; step?: number; rise?: number; colors?: string[]; block?: number; y0?: number }) {
  const rich = useRich()
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const L = Math.hypot(dx, dz)
  const rot = -Math.atan2(dz, dx)
  const con = concreteMat(176)
  const seats = Math.floor(L / 0.5)
  const sw = L / seats
  // Runs of one colour per row, merged: a seat's back every 0.5 m only on « normal » and up.
  const runs = useMemo(() => {
    const out: { row: number; x0: number; n: number; c: string }[] = []
    for (let row = 0; row < rows; row++) {
      let start = 0
      const shift = row % 2
      for (let i = 0; i <= seats; i++) {
        const c = colors[(Math.floor((i + shift * Math.floor(block / 2)) / block) + row) % colors.length]
        const prev = i > 0 ? colors[(Math.floor((i - 1 + shift * Math.floor(block / 2)) / block) + row) % colors.length] : c
        if (i === seats || c !== prev) {
          out.push({ row, x0: start, n: i - start, c: prev })
          start = i
        }
      }
    }
    return out
  }, [rows, seats, colors, block])
  return (
    <group position={[a[0], y0, a[1]]} rotation={[0, rot, 0]}>
      {[...Array(rows)].map((_, row) => (
        <B key={row} p={[L / 2, ((row + 1) * rise) / 2, -(row + 0.5) * step]} s={[L, (row + 1) * rise, step]} m={con} />
      ))}
      {runs.map((u, i) => (
        <group key={i}>
          <B p={[(u.x0 + u.n / 2) * sw, (u.row + 1) * rise + 0.12, -(u.row + 0.5) * step + 0.05]} s={[u.n * sw - 0.06, 0.06, 0.38]} m={M(u.c)} cast={false} />
          <B p={[(u.x0 + u.n / 2) * sw, (u.row + 1) * rise + 0.3, -(u.row + 0.5) * step - 0.16]} s={[u.n * sw - 0.06, 0.34, 0.05]} m={M(u.c)} cast={false} />
        </group>
      ))}
      {/* The gaps between the seats (dark slits) and the railing at the front */}
      {rich &&
        [...Array(rows)].map((_, row) =>
          [...Array(Math.floor(seats / 2))].map((_, k) => <B key={`${row}-${k}`} p={[(k * 2 + 1) * sw, (row + 1) * rise + 0.3, -(row + 0.5) * step - 0.13]} s={[0.04, 0.34, 0.06]} m={M('#343a40')} cast={false} />),
        )}
      <B p={[L / 2, 1.0, 0.05]} s={[L, 0.05, 0.05]} m={steelMat('#adb5bd')} cast={false} />
      {[...Array(Math.floor(L / 2.5) + 1)].map((_, k) => (
        <B key={k} p={[Math.min(L, k * 2.5), 0.5, 0.05]} s={[0.05, 1.0, 0.05]} m={steelMat('#adb5bd')} cast={false} />
      ))}
    </group>
  )
}

/* ---------- Fences ---------- */

/** Chain-link (grillage): galvanised wire in diamonds, a few links bent, the alpha cut out. */
export const chainLinkMat = () =>
  TM(
    'chainlink',
    32,
    32,
    (g) => {
      g.clearRect(0, 0, 32, 32)
      g.strokeStyle = '#c6ccd2'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(0, 16)
      g.lineTo(16, 0)
      g.lineTo(32, 16)
      g.lineTo(16, 32)
      g.closePath()
      g.stroke()
      g.fillStyle = '#868e96'
      for (const [x, y] of [[0, 16], [16, 0], [32, 16], [16, 32]]) g.fillRect(x - 1, y - 1, 2, 2)
    },
    { transparent: false, alphaTest: 0.4, side: THREE.DoubleSide },
  )

/** A fence from a to b: posts every 2.5 m, the top rail, the chain-link between (`h` high). */
export function FenceRun({ a, b, h = 2.4, post = '#2f6b3a' }: { a: [number, number]; b: [number, number]; h?: number; post?: string }) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const L = Math.hypot(dx, dz)
  const rot = -Math.atan2(dz, dx)
  const n = Math.max(1, Math.round(L / 2.5))
  const pm = steelMat(post)
  const link = useMemo(() => {
    const m = chainLinkMat().clone()
    m.map = m.map!.clone()
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping
    m.map.repeat.set(L / 0.1, h / 0.1)
    m.map.needsUpdate = true
    return m
  }, [L, h])
  return (
    <group position={[a[0], 0, a[1]]} rotation={[0, rot, 0]}>
      <mesh position={[L / 2, h / 2, 0]} material={link}>
        <planeGeometry args={[L, h]} />
      </mesh>
      <B p={[L / 2, h, 0]} s={[L, 0.05, 0.05]} m={pm} cast={false} />
      <B p={[L / 2, 0.05, 0]} s={[L, 0.04, 0.04]} m={pm} cast={false} />
      {[...Array(n + 1)].map((_, k) => (
        <B key={k} p={[(k * L) / n, h / 2, 0]} s={[0.07, h + 0.05, 0.07]} m={pm} />
      ))}
    </group>
  )
}

/* ---------- Ground wear (decals) ---------- */

/** A decal on the ground: a plane just above it (no z-fight), `m` a transparent texture. */
export function Decal({ p, w, d, m, rot = 0 }: { p: V3; w: number; d: number; m: THREE.Material; rot?: number }) {
  return (
    <mesh position={p} rotation={[-Math.PI / 2, 0, rot]} material={m} receiveShadow>
      <planeGeometry args={[w, d]} />
    </mesh>
  )
}

/** Cracks in a concrete slab: branching dark lines, their edges chipped lighter, weeds in the widest. */
export const cracksMat = (k = 0) =>
  TM(
    `cracks${k}`,
    256,
    256,
    (g, r) => {
      g.clearRect(0, 0, 256, 256)
      const crack = (x: number, y: number, a: number, len: number, w: number) => {
        for (let i = 0; i < len; i++) {
          a += (r() - 0.5) * 0.7
          const nx = x + Math.cos(a) * 4
          const ny = y + Math.sin(a) * 4
          g.strokeStyle = 'rgba(205,200,190,0.5)'
          g.lineWidth = w + 2
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(nx, ny)
          g.stroke()
          g.strokeStyle = 'rgba(28,26,24,0.85)'
          g.lineWidth = w
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(nx, ny)
          g.stroke()
          if (w > 1.6 && r() < 0.08) {
            g.fillStyle = r() < 0.5 ? '#4c7a2b' : '#6a9a35'
            g.fillRect(nx - 2, ny - 3, 3, 4)
          }
          if (r() < 0.06 && w > 1) crack(nx, ny, a + (r() < 0.5 ? 1 : -1) * (0.6 + r()), Math.floor(len * 0.4), w * 0.6)
          x = nx
          y = ny
        }
      }
      for (let i = 0; i < 3; i++) crack(r() * 256, r() * 256, r() * Math.PI * 2, 30 + Math.floor(r() * 30), 2 + r() * 1.5)
    },
    { transparent: true },
  )

/** Worn grass: the bare earth showing in patches, studs' marks, the grass thinning to its edge. */
export const wornMat = (earth = '#8a6a42') =>
  TM(
    `worn${earth}`,
    128,
    128,
    (g, r) => {
      g.clearRect(0, 0, 128, 128)
      for (let i = 0; i < 2600; i++) {
        const a = r() * Math.PI * 2
        const d = Math.pow(r(), 0.7) * 62
        const x = 64 + Math.cos(a) * d * 1.2
        const y = 64 + Math.sin(a) * d * 0.75
        const k = 1 - d / 62
        g.fillStyle = r() < 0.75 ? earth : '#5c4428'
        g.globalAlpha = Math.min(1, k * 1.6) * (0.5 + r() * 0.5)
        g.fillRect(Math.floor(x), Math.floor(y), 2, 2)
      }
      g.globalAlpha = 1
      // Studs' marks.
      g.fillStyle = 'rgba(60,40,20,0.6)'
      for (let i = 0; i < 40; i++) g.fillRect(30 + Math.floor(r() * 68), 40 + Math.floor(r() * 48), 1, 2)
    },
    { transparent: true },
  )

/** Footprints in sand: pairs of soft hollows with a light rim, going all ways (tiled). */
export const footprintsMat = () =>
  TM(
    'footprints',
    256,
    256,
    (g, r) => {
      g.clearRect(0, 0, 256, 256)
      for (let t = 0; t < 7; t++) {
        let [x, y] = [r() * 256, r() * 256]
        let a = r() * Math.PI * 2
        for (let s = 0; s < 9; s++) {
          a += (r() - 0.5) * 0.5
          const side = s % 2 ? 1 : -1
          const fx = x + Math.cos(a + Math.PI / 2) * side * 4
          const fy = y + Math.sin(a + Math.PI / 2) * side * 4
          g.save()
          g.translate(((fx % 256) + 256) % 256, ((fy % 256) + 256) % 256)
          g.rotate(a)
          g.fillStyle = 'rgba(120,90,50,0.35)'
          g.fillRect(-5, -2.5, 10, 5)
          g.fillStyle = 'rgba(255,245,220,0.35)'
          g.fillRect(-6, 2.5, 12, 1)
          g.fillStyle = 'rgba(110,80,45,0.4)'
          g.fillRect(3, -2, 3, 4)
          g.restore()
          x += Math.cos(a) * 14
          y += Math.sin(a) * 14
        }
      }
      // Dents of dives and the ball's landings.
      for (let i = 0; i < 4; i++) {
        const [x, y] = [r() * 256, r() * 256]
        const gr = g.createRadialGradient(x, y, 0, x, y, 14)
        gr.addColorStop(0, 'rgba(120,90,50,0.3)')
        gr.addColorStop(0.8, 'rgba(120,90,50,0.1)')
        gr.addColorStop(1, 'rgba(255,240,210,0)')
        g.fillStyle = gr
        g.fillRect(x - 14, y - 14, 28, 28)
      }
    },
    { transparent: true, repeat: [1, 1] },
  )

/** Scuffs on a painted line: the paint worn through in flecks (laid over a line, the line looks old). */
export const lineWearMat = (ground: string) =>
  TM(
    `linewear${ground}`,
    128,
    16,
    (g, r) => {
      g.clearRect(0, 0, 128, 16)
      for (let i = 0; i < 260; i++) {
        g.fillStyle = ground
        g.globalAlpha = 0.4 + r() * 0.6
        g.fillRect(Math.floor(r() * 128), Math.floor(r() * 16), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2))
      }
      g.globalAlpha = 1
    },
    { transparent: true },
  )

/** Stains: oil, spilt drinks, a rubber smear (dark soft blots). */
export const stainsMat = () =>
  TM(
    'stains',
    128,
    128,
    (g, r) => {
      g.clearRect(0, 0, 128, 128)
      for (let i = 0; i < 6; i++) {
        const [x, y, rad] = [20 + r() * 88, 20 + r() * 88, 6 + r() * 16]
        const gr = g.createRadialGradient(x, y, 0, x, y, rad)
        gr.addColorStop(0, 'rgba(20,18,16,0.32)')
        gr.addColorStop(1, 'rgba(20,18,16,0)')
        g.fillStyle = gr
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      }
    },
    { transparent: true },
  )

/* ---------- Goals ---------- */

const goalWhite = new THREE.MeshLambertMaterial({ color: '#f4f5f2' })
const hookMat = new THREE.MeshLambertMaterial({ color: '#868e96' })
/**
 * A goal's frame on its line (x = 0): round posts and bar, the corners joined, the little hooks the
 * net hangs on along the back of the posts and bar, the posts' ground sleeves. `iron`: the street's
 * welded goal (red, rusted at the welds) instead of the white aluminium one.
 */
export function RoundGoal({ mouth, bar, r = 0.06, iron }: { mouth: number; bar: number; r?: number; iron?: boolean }) {
  const m = iron ? M('#a8361f') : goalWhite
  return (
    <group>
      {[-mouth, mouth].map((z) => (
        <group key={z}>
          <mesh position={[0, bar / 2, z]} material={m} castShadow>
            <cylinderGeometry args={[r, r, bar, 10]} />
          </mesh>
          <mesh position={[0, bar, z]} material={m}>
            <sphereGeometry args={[r, 10, 6]} />
          </mesh>
          <mesh position={[0, 0.03, z]} material={iron ? M('#5c3a2a') : hookMat}>
            <cylinderGeometry args={[r * 1.6, r * 1.6, 0.06, 10]} />
          </mesh>
          {[0.3, 0.75, 1.2, 1.65, 2.1].filter((y) => y < bar - 0.1).map((y) => (
            <mesh key={y} position={[r * 0.9, y, z]} material={hookMat}>
              <boxGeometry args={[0.04, 0.02, 0.02]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, bar, 0]} rotation={[Math.PI / 2, 0, 0]} material={m} castShadow>
        <cylinderGeometry args={[r, r, mouth * 2, 10]} />
      </mesh>
    </group>
  )
}

/* ---------- The hoops' nets ---------- */

/** A net's mesh: nylon white diamonds, or grey steel chain links (alpha cut out). */
export function hoopNetMat(chain: boolean) {
  return TM(
    chain ? 'hoopchain' : 'hoopnylon',
    64,
    64,
    (g) => {
      g.clearRect(0, 0, 64, 64)
      g.strokeStyle = chain ? '#a5adb6' : '#f8f9fa'
      g.lineWidth = chain ? 4 : 3
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(64, 64)
      g.moveTo(64, 0)
      g.lineTo(0, 64)
      g.stroke()
      if (chain) {
        // The links: small oval rings along the chains.
        g.fillStyle = '#6c757d'
        for (let k = 0; k < 64; k += 8) {
          g.fillRect(k, k, 3, 3)
          g.fillRect(64 - k - 3, k, 3, 3)
        }
      } else {
        g.fillStyle = '#ced4da'
        g.fillRect(30, 30, 4, 4)
      }
    },
    { alphaTest: 0.45, side: THREE.DoubleSide },
  )
}

/**
 * A hoop's net: a tapered tube of diamonds (12 round, 4 down), swinging when the ball goes through:
 * the rings below the rim pushed out and down, swaying back (`swish()` the seconds since the last
 * basket, `shake()` the rim's own shake). Cheap: 65 vertices moved on the CPU only while it moves.
 */
export function HoopNet({ swish, chain = false, r0 = 0.225, r1 = 0.15, h = 0.42 }: { swish: () => number; chain?: boolean; r0?: number; r1?: number; h?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(r0, r1, h, 12, 4, true)
    g.translate(0, -h / 2, 0)
    // Diamonds: 6 across the round, 3 down (the texture's two crossing strands).
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3)
    return { g, base: Float32Array.from(g.attributes.position.array as Float32Array) }
  }, [r0, r1, h])
  const mat = useMemo(() => {
    const m = hoopNetMat(chain).clone()
    m.map = m.map!.clone()
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping
    m.map.needsUpdate = true
    return m
  }, [chain])
  const still = useRef(true)
  useFrame(({ clock }) => {
    const s = swish()
    const pos = geo.g.attributes.position
    const moving = s >= 0 && s < 1.4
    if (!moving && still.current) return
    still.current = !moving
    const t = clock.elapsedTime
    // Out and long as the ball drops through, then swaying round, dying away; at rest, still.
    const out = moving ? Math.sin(Math.min(1, s / 0.35) * Math.PI) * (chain ? 0.25 : 0.4) : 0
    const sway = moving ? Math.exp(-s * 3) * 0.05 : 0
    for (let i = 0; i < pos.count; i++) {
      const x = geo.base[i * 3]
      const y = geo.base[i * 3 + 1]
      const z = geo.base[i * 3 + 2]
      const k = -y / h // 0 at the rim, 1 at the bottom
      const bulge = 1 + out * Math.sin(k * Math.PI) * 0.6
      pos.setXYZ(i, x * bulge + Math.sin(t * 11 + k * 3) * sway * k, y * (1 + out * 0.5 * k), z * bulge + Math.cos(t * 9 + k * 2) * sway * k)
    }
    pos.needsUpdate = true
  })
  return <mesh geometry={geo.g} material={mat} />
}

/** Stickers on a backboard: the maker's, a few the quarter stuck there (invented), sun-faded. */
export const boardStickersMat = (seed = 0) =>
  TM(
    `stickers${seed}`,
    128,
    64,
    (g, r) => {
      g.clearRect(0, 0, 128, 64)
      const S: [string, string, string][] = [
        ['BABI', '#ff8200', '#ffffff'],
        ['GOLVO', '#2b8a3e', '#ffffff'],
        ['225', '#141416', '#ffd43b'],
        ['ZOU', '#7048e8', '#ffffff'],
        ['NOUM', '#e03131', '#ffffff'],
      ]
      const spots = [
        [6, 6],
        [96, 8],
        [8, 46],
        [92, 44],
        [56, 4],
      ]
      spots.forEach(([x, y], i) => {
        if (r() < 0.25) return
        const [t, bg, fg] = S[(i + seed) % S.length]
        g.save()
        g.translate(x + 12, y + 6)
        g.rotate((r() - 0.5) * 0.4)
        g.globalAlpha = 0.7 + r() * 0.3
        g.fillStyle = bg
        g.fillRect(-13, -6, 26, 12)
        g.fillStyle = fg
        g.font = "900 9px 'Baloo 2', Impact, sans-serif"
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(t, 0, 1, 24)
        // A corner peeled up.
        g.fillStyle = 'rgba(255,255,255,0.8)'
        g.fillRect(9, -6, 4, 3)
        g.restore()
      })
    },
    { transparent: true },
  )

/* ---------- Balls: real panels and seams ---------- */

const ballTex = new Map<string, THREE.CanvasTexture>()
function sphereTex(key: string, w: number, h: number, shade: (x: number, y: number, z: number, u: number, v: number) => [number, number, number]) {
  let t = ballTex.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  for (let j = 0; j < h; j++) {
    const v = (j + 0.5) / h
    const th = v * Math.PI
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w
      const ph = u * Math.PI * 2
      // three's sphere: x = -cos(phi) sin(theta), y = cos(theta), z = sin(phi) sin(theta)
      const [r, gg, b] = shade(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th), u, v)
      const k = (j * w + i) * 4
      img.data[k] = r
      img.data[k + 1] = gg
      img.data[k + 2] = b
      img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  ballTex.set(key, t)
  return t
}
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** The 12 pentagons' centres of a truncated icosahedron (the football's 32 panels). */
const ICO = (() => {
  const p = (1 + Math.sqrt(5)) / 2
  const v: [number, number, number][] = []
  for (const a of [-1, 1]) for (const b of [-1, 1]) v.push([0, a, b * p], [a, b * p, 0], [b * p, 0, a])
  return v.map(([x, y, z]) => {
    const l = Math.hypot(x, y, z)
    return [x / l, y / l, z / l] as [number, number, number]
  })
})()
/** The 20 hexagons' centres (the icosahedron's faces). */
const HEX = (() => {
  const out: [number, number, number][] = []
  for (let a = 0; a < 12; a++)
    for (let b = a + 1; b < 12; b++)
      for (let c = b + 1; c < 12; c++) {
        const [A, B2, C] = [ICO[a], ICO[b], ICO[c]]
        const d = (P: number[], Q: number[]) => Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2])
        if (d(A, B2) < 1.1 && d(B2, C) < 1.1 && d(A, C) < 1.1) {
          const s = [A[0] + B2[0] + C[0], A[1] + B2[1] + C[1], A[2] + B2[2] + C[2]]
          const l = Math.hypot(s[0], s[1], s[2])
          out.push([s[0] / l, s[1] / l, s[2] / l])
        }
      }
  return out
})()

/** The football: 12 black pentagons, 20 white hexagons, the stitched seams between, the leather's grain. */
export function footballTex() {
  return sphereTex('foot', 256, 128, (x, y, z, u, v) => {
    let best = -2
    let second = -2
    let pent = false
    for (const c of ICO) {
      const d = c[0] * x + c[1] * y + c[2] * z
      if (d > best) {
        second = best
        best = d
        pent = true
      } else if (d > second) second = d
    }
    for (const c of HEX) {
      // (The hexagons' centres sit a little closer in angle: weighted so the pentagons are their real size.)
      const d = (c[0] * x + c[1] * y + c[2] * z) * 0.982
      if (d > best) {
        second = best
        best = d
        pent = false
      } else if (d > second) second = d
    }
    const n = (hash(Math.floor(u * 256), Math.floor(v * 128)) - 0.5) * 14
    if (best - second < 0.012) return [70 + n, 72 + n, 76 + n]
    const base = pent ? 30 : 238
    return [base + n, base + n, base + 4 + n]
  })
}

/** The basketball: orange pebbled leather, the eight black seams (two great circles and the two curves). */
export function basketballTex() {
  return sphereTex('basket', 256, 128, (x, y, z, u, v) => {
    const pebble = hash(Math.floor(u * 256), Math.floor(v * 128)) < 0.3 ? -16 : 0
    // The two great circles, and the two curved seams (where |x| bends towards the poles).
    const seam = Math.min(Math.abs(x), Math.abs(y), Math.abs(Math.abs(z) - 0.62 - 0.38 * y * y))
    if (seam < 0.035) return [34, 22, 16]
    return [214 + pebble, 98 + pebble * 0.6, 34 + pebble * 0.3]
  })
}

/** The volleyball: three bands of panels on each of its six faces, white, blue and yellow. */
export function volleyballTex() {
  return sphereTex('volley', 256, 128, (x, y, z, u, v) => {
    const ax = Math.abs(x)
    const ay = Math.abs(y)
    const az = Math.abs(z)
    const n = (hash(Math.floor(u * 256), Math.floor(v * 128)) - 0.5) * 10
    // The face of the cube it falls on, and the band within it.
    let a: number
    let b: number
    let face: number
    if (ax >= ay && ax >= az) [a, b, face] = [y / ax, z / ax, 0]
    else if (ay >= az) [a, b, face] = [z / ay, x / ay, 1]
    else [a, b, face] = [x / az, y / az, 2]
    const band = Math.floor(((face % 2 ? a : b) + 1) * 1.5)
    const edge = Math.min(Math.abs(((face % 2 ? a : b) + 1) * 1.5 - Math.round(((face % 2 ? a : b) + 1) * 1.5)), 1 - Math.max(Math.abs(a), Math.abs(b)) + 0.02)
    if (edge < 0.04) return [90 + n, 90 + n, 96 + n]
    const C = [
      [246, 246, 240],
      [36, 92, 196],
      [250, 204, 32],
    ][(band + face) % 3]
    return [C[0] + n, C[1] + n, C[2] + n]
  })
}

/** The tennis ball: yellow-green felt, the white curved seam. */
export function tennisballTex() {
  return sphereTex('tennis', 128, 64, (x, y, z, u, v) => {
    const fuzz = (hash(Math.floor(u * 128), Math.floor(v * 64)) - 0.5) * 30
    const seam = Math.abs(Math.abs(z) - 0.62 - 0.38 * y * y) * (Math.sign(z) === Math.sign(x) ? 1 : 1)
    if (seam < 0.05 && Math.abs(x) < 0.85) return [244, 244, 232]
    return [206 + fuzz, 228 + fuzz, 64 + fuzz * 0.5]
  })
}
