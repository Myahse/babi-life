import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { BOX } from './ruePrincesse'

// The Tour F of the Cité administrative, in the Plateau (architect Pierre
// Fakhoury; begun in July 2021, its structure done, to open in 2026): about
// 333 m of tower over 76 floors of offices, a glass lantern of 30 m under its
// roof terrace, the spire to come up to 421 m. Its plan goes from a rectangle
// with cut corners at the foot to a many-sided top, its two great faces drawn
// like an African mask, a ridge down their middle; a double skin of light
// glass over a concrete core, its faces folded in long diagonals. On the map
// its foot is about 37 × 26 m. As the photos of the site show it: a little
// fuller a third of the way up, narrower at the top; the glass almost to the
// top, the last floors bare, a green screen round the highest; a red hoist up
// the front, where the glass is left open for it; a white crane on the roof,
// another on its own mast beside the tower. Round its foot, the hoarding, the
// huts, the silo, a mixer truck and the builders.
// Frame: +z the gate, toward the street; x along the long side.

const FLOOR = 333 / 76
const TOP = 333 // the last office floor's roof
const ROOF = TOP + 30 // over the lantern
const GLASS = 66 * FLOOR // the glass skin, this high so far
const SCREEN = 5 * FLOOR // the protective screen round the highest floors
const [W0, D0] = [18.5, 13] // half-sizes at the foot
const FOLD = 110 // metres: the faces' diagonal folds, one way then the other
/** The site's hoarding: half-sizes, height; the gate's width in the front. */
const SITE = { hx: 34, hz: 26, h: 2.5, gate: 8 }

// The plan, as twelve points round the middle (unit half-sizes): at the
// foot a rectangle with its corners cut, at the top the mask, its faces
// sloping back from the ridge.
const FOOT: [number, number][] = [[-1, 0], [-1, 0.72], [-0.55, 1], [0, 1], [0.55, 1], [1, 0.72], [1, 0], [1, -0.72], [0.55, -1], [0, -1], [-0.55, -1], [-1, -0.72]]
const MASK: [number, number][] = [[-1, 0], [-0.86, 0.55], [-0.45, 0.86], [0, 1], [0.45, 0.86], [0.86, 0.55], [1, 0], [0.86, -0.55], [0.45, -0.86], [0, -1], [-0.45, -0.86], [-0.86, -0.55]]

/** How wide it is at a share of its height, against its foot: fuller a third of the way, four fifths at the top. */
const girth = (t: number) => 1 + 0.07 * Math.sin(Math.PI * t) - 0.2 * t * t
/** -1 → 1 → -1 along the height: where the folds' ridges lean. */
const zigzag = (y: number) => 4 * Math.abs(y / FOLD - Math.floor(y / FOLD + 0.5)) - 1

/** The plan at a height (above the top, the top's), times `grow`. */
function plan(y: number, grow = 1): [number, number][] {
  const t = Math.min(1, Math.max(0, y / TOP))
  const k = t * t * (3 - 2 * t)
  const g = girth(t) * grow
  const f = 0.2 * zigzag(Math.min(y, TOP))
  return FOOT.map(([x, z], i) => {
    let [px, pz] = [x + (MASK[i][0] - x) * k, z + (MASK[i][1] - z) * k]
    // The ridges of the two faces and of the sides lean one way then the other: the long diagonal folds.
    if (i === 3 || i === 9) px += i === 3 ? f : -f
    if (i === 0 || i === 6) pz += (i === 0 ? f : -f) * 0.6
    return [px * W0 * g, pz * D0 * g]
  })
}

/** Builds quads up the tower between two heights, every quarter of a fold (so its turns are kept). */
function rise(y0: number, y1: number, step: number, ring: (y: number) => [number, number][], closed: boolean) {
  const ys: number[] = []
  for (let y = y0; y < y1 - 0.01; y = (Math.floor(y / step + 1e-6) + 1) * step) ys.push(y)
  ys.push(y1)
  const PANELS = 40
  const pos: number[] = []
  const uv: number[] = []
  for (let i = 0; i + 1 < ys.length; i++) {
    const [a, b] = [ring(ys[i]), ring(ys[i + 1])]
    const share = (r: [number, number][]) => {
      const len = r.slice(0, closed ? r.length : r.length - 1).map((p, k) => Math.hypot(r[(k + 1) % r.length][0] - p[0], r[(k + 1) % r.length][1] - p[1]))
      const all = len.reduce((s, l) => s + l, 0) || 1
      const out = [0]
      for (const l of len) out.push(out[out.length - 1] + l / all)
      return out
    }
    const [sa, sb] = [share(a), share(b)]
    for (let k = 0; k < (closed ? a.length : a.length - 1); k++) {
      const n = (k + 1) % a.length
      const quad = [
        [a[k][0], ys[i], a[k][1], sa[k], ys[i]],
        [a[n][0], ys[i], a[n][1], sa[k + 1], ys[i]],
        [b[n][0], ys[i + 1], b[n][1], sb[k + 1], ys[i + 1]],
        [b[k][0], ys[i + 1], b[k][1], sb[k], ys[i + 1]],
      ]
      for (const j of [0, 1, 2, 0, 2, 3]) {
        const [x, y, z, u, v] = quad[j]
        pos.push(x, y, z)
        uv.push(u * (closed ? PANELS : 3), v / FLOOR)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** The tower's skin between two heights. Its texture's u counts the facade's panels (as many at the top as at the foot), v the floors. */
const skin = (y0: number, y1: number, grow = 1) => rise(y0, y1, FOLD / 4, (y) => plan(y, grow), true)

/** Where the hoist climbs: a strip of the front face, toward its right corner. */
const HOIST_FACE: [number, number, number] = [4, 0.55, 0.8] // between plan points 4 and 5, from 55 % to 80 % of the way
const onFace = (y: number, f: number, grow = 1): [number, number] => {
  const p = plan(y, grow)
  const [a, b] = [p[HOIST_FACE[0]], p[HOIST_FACE[0] + 1]]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** A flat cap of the plan at a height (a roof, a floor's slab). */
function cap(y: number, ring: [number, number][]) {
  const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)))
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, y, 0)
}

function canvas(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, nearest = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (nearest) t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** One panel of the outer glass skin, one floor high: light glass in long vertical strips, the sky in it. */
const glassTexture = () =>
  canvas(16, 16, (g) => {
    g.fillStyle = '#c6d8e4'
    g.fillRect(0, 0, 16, 16)
    g.fillStyle = '#e1ebf1' // the strip that catches the light
    g.fillRect(1, 0, 6, 16)
    g.fillStyle = '#9fbacd' // the one in the shade
    g.fillRect(10, 0, 5, 16)
    g.fillStyle = '#f2f6f8' // the mullion
    g.fillRect(0, 0, 1, 16)
    g.fillStyle = '#a9bfcf' // the floor behind, just seen
    g.fillRect(0, 15, 16, 1)
  })

/**
 * The bare floors, eight panels by sixteen floors: the slab's edge, the
 * columns, the dark inside; `lit`: the work lamps, here and there.
 */
const frameTexture = (lit: boolean) => {
  const r = rng('tourf-lamps')
  const t = canvas(128, 256, (g) => {
    g.fillStyle = lit ? '#000000' : '#2b2f36'
    g.fillRect(0, 0, 128, 256)
    for (let f = 0; f < 16; f++)
      for (let p = 0; p < 8; p++) {
        const [x, y] = [p * 16, f * 16]
        if (lit) {
          if (r() < 0.14) {
            g.fillStyle = '#ffd98a'
            g.fillRect(x + 5, y + 6, 5, 4)
          }
          continue
        }
        g.fillStyle = '#b9b5ad' // the slab
        g.fillRect(x, y + 12, 16, 4)
        g.fillStyle = '#9d998f' // the column
        g.fillRect(x, y, 2, 16)
      }
  })
  t.repeat.set(1 / 8, 1 / 16)
  return t
}

/** A steel lattice (a crane's mast and jib, the hoist's mast): see-through between its bars. */
const latticeTexture = () =>
  canvas(16, 16, (g) => {
    g.clearRect(0, 0, 16, 16)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 1.6
    g.strokeRect(1, 1, 14, 14)
    g.beginPath()
    g.moveTo(1, 15)
    g.lineTo(15, 1)
    g.stroke()
  })

/** The green screen round the highest floors: a fine mesh, the bars that hold it. */
const screenTexture = () =>
  canvas(16, 16, (g) => {
    g.fillStyle = '#3f7d69'
    g.fillRect(0, 0, 16, 16)
    g.fillStyle = '#356a59'
    for (let y = 0; y < 16; y += 2) g.fillRect(0, y, 16, 1)
    g.fillStyle = '#c9ccd1'
    g.fillRect(0, 0, 1, 16)
  })

/** The hoarding: white panels, a blue foot, the country's colours along the top. */
const hoardTexture = () =>
  canvas(32, 16, (g) => {
    g.fillStyle = '#f4f5f2'
    g.fillRect(0, 0, 32, 16)
    g.fillStyle = '#1f4e8c'
    g.fillRect(0, 11, 32, 5)
    for (const [i, c] of ['#f77f00', '#ffffff', '#009e60'].entries()) {
      g.fillStyle = c
      g.fillRect(0, i, 32, 1)
    }
    g.fillStyle = '#d5d7d2'
    g.fillRect(31, 0, 1, 16)
  })

/** The site's board on the hoarding, toward the street. */
const boardTexture = () =>
  canvas(
    512,
    128,
    (g) => {
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, 512, 128)
      g.fillStyle = '#1f4e8c'
      g.fillRect(0, 0, 512, 34)
      g.fillStyle = '#ffffff'
      g.font = 'bold 26px sans-serif'
      g.textAlign = 'center'
      g.fillText('TOUR F', 256, 27)
      g.fillStyle = '#14213d'
      g.font = 'bold 15px sans-serif'
      g.fillText('CITÉ ADMINISTRATIVE · LE PLATEAU', 256, 56)
      g.font = '13px sans-serif'
      g.fillText('Ministère de la Construction, du Logement et de l’Urbanisme', 256, 78)
      g.fillStyle = '#f77f00'
      g.fillRect(0, 92, 512, 36)
      g.fillStyle = '#ffffff'
      g.font = 'bold 15px sans-serif'
      g.fillText('TRAVAUX EN COURS · PORT DU CASQUE OBLIGATOIRE', 256, 116)
    },
    false,
  )

/** A box whose lattice keeps two-metre squares on every face, however long. */
function latticeBox(w: number, h: number, d: number, cell = 2) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // Faces in order: +x, -x, +y, -y, +z, -z; four corners each.
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, (uv.getX(f * 4 + i) * dims[f][0]) / cell, (uv.getY(f * 4 + i) * dims[f][1]) / cell)
  return g
}

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color })
const lattice = (color: string) => new THREE.MeshLambertMaterial({ color, map: latticeTexture(), alphaTest: 0.5, side: THREE.DoubleSide })

export function TourF({ night }: { night: boolean }) {
  const mats = useMemo(
    () => ({
      glass: new THREE.MeshLambertMaterial({ map: glassTexture() }),
      frame: new THREE.MeshLambertMaterial({ map: frameTexture(false), emissiveMap: frameTexture(true), emissive: '#ffffff', emissiveIntensity: 0 }),
      screen: new THREE.MeshLambertMaterial({ map: screenTexture() }),
      concrete: lambert('#a9a59c'),
      slab: lambert('#bdb9b0'),
      steel: lattice('#eceff1'),
      hoist: lattice('#d9480f'),
      hoard: new THREE.MeshLambertMaterial({ map: hoardTexture() }),
      board: new THREE.MeshLambertMaterial({ map: boardTexture() }),
      red: new THREE.MeshBasicMaterial({ color: '#ff2a2a' }),
      lamp: new THREE.MeshBasicMaterial({ color: '#fff4d6' }),
    }),
    [],
  )
  // At night the offices behind the glass are empty and dark; the builders' lamps burn up on the bare floors.
  mats.frame.emissiveIntensity = night ? 1 : 0
  mats.lamp.color.set(night ? '#fff4d6' : '#c9ccd1')
  const geos = useMemo(
    () => ({
      glass: skin(0, GLASS),
      // Above the glass, the floors as they are, a little in from where the glass will be; the lantern's storeys too.
      frame: skin(GLASS, ROOF, 0.985),
      screen: skin(ROOF - SCREEN, ROOF + 1.2, 1.02),
      // The strip left open for the hoist, its bare floors seen through it.
      open: rise(4, GLASS, FOLD / 4, (y) => [onFace(y, HOIST_FACE[1], 1.004), onFace(y, HOIST_FACE[2], 1.004)], false),
      roof: cap(ROOF, plan(ROOF, 0.985)),
    }),
    [],
  )
  return (
    <group>
      {/* The tower: glass nearly to the top, the bare floors above, the screen round the highest, the roof */}
      <mesh geometry={geos.glass} material={mats.glass} castShadow receiveShadow />
      <mesh geometry={geos.frame} material={mats.frame} castShadow />
      <mesh geometry={geos.screen} material={mats.screen} />
      <mesh geometry={geos.open} material={mats.frame} />
      <mesh geometry={geos.roof} material={mats.slab} />
      <mesh geometry={BOX} material={mats.concrete} position={[0, ROOF + 2.5, 0]} scale={[7, 5, 4.5]} />
      <Cradles />
      <Crane at={[-4, ROOF, 0]} mast={26} turn={0.4} phase={0} night={night} mats={mats} />
      <Crane at={[CRANE_X, 0, 0]} mast={ROOF + 20} turn={2.6} phase={2.1} night={night} mats={mats} tied />
      <Hoist mats={mats} />
      <AviationLights night={night} mats={mats} />
      <Site night={night} mats={mats} />
    </group>
  )
}

type Mats = { steel: THREE.Material; hoist: THREE.Material; red: THREE.MeshBasicMaterial; lamp: THREE.MeshBasicMaterial; concrete: THREE.Material; hoard: THREE.Material; board: THREE.Material }

/** The external crane's mast, beside the east side. */
const CRANE_X = W0 * 1.06 + 7

/** The facade's cradles at the top of the glass, the fitters setting the next panels. */
function Cradles() {
  const at = useMemo(() => {
    const ring = plan(GLASS + 1, 1.04)
    return [1, 8, 11].map((k) => ring[k])
  }, [])
  const yellow = useMemo(() => lambert('#f2c230'), [])
  return (
    <group>
      {at.map(([x, z], i) => (
        <mesh key={i} geometry={BOX} material={yellow} position={[x, GLASS + 1.5, z]} rotation={[0, Math.atan2(x, z), 0]} scale={[3.5, 1.1, 0.8]} />
      ))}
    </group>
  )
}

/**
 * A tower crane: its mast (on the roof, or on its own beside the tower, tied
 * to it every thirty metres), the cab, the jib and the counter-jib with its
 * weights; it turns slowly to and fro, a pallet of glass panels on its hook
 * going up and down.
 */
function Crane({ at, mast, turn, phase, night, mats, tied }: { at: [number, number, number]; mast: number; turn: number; phase: number; night: boolean; mats: Mats; tied?: boolean }) {
  const head = useRef<THREE.Group>(null)
  const load = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const geos = useMemo(() => ({ mast: latticeBox(2.2, mast, 2.2), jib: latticeBox(52, 1.6, 1.6), back: latticeBox(16, 1.6, 1.6) }), [mast])
  const ties = useMemo(() => {
    if (!tied) return []
    const out: { y: number; len: number }[] = []
    for (let y = 30; y < TOP; y += 30) out.push({ y, len: at[0] - plan(y)[6][0] })
    return out
  }, [tied, at])
  useFrame(() => {
    const t = worldTime() * 0.05 + phase
    if (head.current) head.current.rotation.y = turn + Math.sin(t) * 1.1
    // The hook: down toward the street and back up, slowly.
    const drop = 30 + (Math.sin(t * 0.7) * 0.5 + 0.5) * 120
    if (load.current) load.current.position.y = -drop
    if (line.current) {
      line.current.position.y = -drop / 2
      line.current.scale.y = drop
    }
  })
  const weights = useMemo(() => lambert('#8d8a83'), [])
  const cab = useMemo(() => lambert('#e8e2d0'), [])
  const crate = useMemo(() => lambert('#a8763e'), [])
  return (
    <group position={at}>
      <mesh geometry={geos.mast} material={mats.steel} position={[0, mast / 2, 0]} />
      {ties.map((t) => (
        <mesh key={t.y} geometry={BOX} material={mats.steel} position={[-t.len / 2, t.y, 0]} scale={[t.len, 0.3, 0.3]} />
      ))}
      <group ref={head} position={[0, mast, 0]}>
        <mesh geometry={BOX} material={cab} position={[1.6, 0.9, 0]} scale={[2, 1.8, 1.8]} />
        <mesh geometry={geos.jib} material={mats.steel} position={[26 + 1, 2.4, 0]} />
        <mesh geometry={geos.back} material={mats.steel} position={[-8 - 1, 2.4, 0]} />
        <mesh geometry={BOX} material={weights} position={[-15, 1.6, 0]} scale={[3, 2, 2]} />
        {/* The top of the mast */}
        <mesh geometry={BOX} material={mats.steel} position={[0, 5, 0]} scale={[1.2, 5, 1.2]} />
        <group position={[30, 2.4, 0]}>
          <mesh ref={line} geometry={BOX} material={mats.concrete} scale={[0.06, 1, 0.06]} />
          <group ref={load}>
            <mesh geometry={BOX} material={crate} scale={[3, 0.6, 2.2]} />
          </group>
        </group>
        {night && (
          <>
            <mesh geometry={BOX} material={mats.red} position={[52, 2.4, 0]} scale={0.5} />
            <mesh geometry={BOX} material={mats.red} position={[-17, 2.4, 0]} scale={0.5} />
            <mesh geometry={BOX} material={mats.red} position={[0, 10.4, 0]} scale={0.5} />
          </>
        )}
      </group>
    </group>
  )
}

/** The builders' hoist up the front, in the strip the glass leaves open, tied to the floors; its cage going up and down. */
function Hoist({ mats }: { mats: Mats }) {
  const cage = useRef<THREE.Mesh>(null)
  const H = GLASS + 2 * FLOOR
  const { x, z, out, ties } = useMemo(() => {
    // Out from the face, square to it at the foot, clear of it all the way up.
    const [a, b] = [onFace(0, HOIST_FACE[1]), onFace(0, HOIST_FACE[2])]
    const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n: [number, number] = [(b[1] - a[1]) / len, -(a[0] - b[0]) / len]
    const outward = n[0] * mx + n[1] * mz > 0 ? n : ([-n[0], -n[1]] as [number, number])
    let far = 0
    for (let y = 0; y < H; y += 5) {
      const [fx, fz] = onFace(y, (HOIST_FACE[1] + HOIST_FACE[2]) / 2)
      far = Math.max(far, (fx - mx) * outward[0] + (fz - mz) * outward[1])
    }
    const off = far + 1.8
    const [x, z] = [mx + outward[0] * off, mz + outward[1] * off]
    const ties: { y: number; len: number }[] = []
    for (let y = 15; y < H; y += 15) {
      const [fx, fz] = onFace(y, (HOIST_FACE[1] + HOIST_FACE[2]) / 2)
      ties.push({ y, len: Math.hypot(x - fx, z - fz) })
    }
    return { x, z, out: Math.atan2(outward[0], outward[1]), ties }
  }, [H])
  const geo = useMemo(() => latticeBox(1.6, H, 1.6), [H])
  useFrame(() => {
    const k = (Math.sin(worldTime() * 0.03) * 0.5 + 0.5) * (H - 4)
    cage.current?.position.set(0, 2 + k, 1.6)
  })
  const cageMat = useMemo(() => lambert('#e8590c'), [])
  return (
    <group position={[x, 0, z]} rotation={[0, out, 0]}>
      <mesh geometry={geo} material={mats.hoist} position={[0, H / 2, 0]} />
      <mesh ref={cage} geometry={BOX} material={cageMat} scale={[3, 2.6, 1.6]} />
      {ties.map((t) => (
        <mesh key={t.y} geometry={BOX} material={mats.hoist} position={[0, t.y, -t.len / 2]} scale={[0.25, 0.25, t.len]} />
      ))}
    </group>
  )
}

/** At night the roof's corners blink red for the planes, like the cranes; and the top of the glass. */
function AviationLights({ night, mats }: { night: boolean; mats: Mats }) {
  useFrame(() => {
    if (!night) return
    mats.red.color.set(Math.floor(worldTime() / 0.9) % 2 ? '#ff2a2a' : '#5a0d0d')
  })
  const at = useMemo(() => [0, 3, 6, 9].map((k) => plan(ROOF, 1.02)[k]), [])
  const glass = useMemo(() => plan(GLASS, 1.02).filter((_, k) => k % 3 === 0), [])
  if (!night) return null
  return (
    <group>
      {at.map(([x, z], i) => (
        <mesh key={i} geometry={BOX} material={mats.red} position={[x, ROOF + 1.6, z]} scale={0.5} />
      ))}
      {glass.map(([x, z], i) => (
        <mesh key={`g${i}`} geometry={BOX} material={mats.red} position={[x, GLASS, z]} scale={0.4} />
      ))}
    </group>
  )
}

/* ---------- The site round its foot ---------- */

const BUILDERS: { p: [number, number]; r: number; pose: Pose }[] = [
  { p: [-14, 18], r: 0.4, pose: 'busy' },
  { p: [-12.6, 18.6], r: -2.4, pose: 'talk' },
  { p: [16, 17], r: 2.8, pose: 'busy' },
  { p: [22, -14], r: -1.2, pose: 'phone' },
  { p: [-24, 4], r: 1.5, pose: 'busy' },
]

function Site({ night, mats }: { night: boolean; mats: Mats }) {
  const people = useMemo(
    () =>
      BUILDERS.map((b, i) => {
        const r = rng(`tourf${i}`)
        return { ...b, look: { ...randomLook('homme', r), outfit: 'bleu', accessory: 'cap', accessoryColor: '#ffd43b' }, seed: r() * 100 }
      }),
    [],
  )
  const guard = useMemo(() => ({ ...randomLook('homme', rng('tourf-vigile')), outfit: 'vigile' }), [])
  const m = useMemo(
    () => ({
      hut: lambert('#eef0f2'),
      hutDoor: lambert('#2f6fb0'),
      silo: lambert('#8fa59a'),
      sand: lambert('#d8b878'),
      rebar: lambert('#8a4b2a'),
      crate: lambert('#a8763e'),
      truck: lambert('#f4f4f4'),
      drum: lambert('#f2a03d'),
      tyre: lambert('#1b1b20'),
      gate: lambert('#1f4e8c'),
      pole: lambert('#6b6f76'),
    }),
    [],
  )
  const drum = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (drum.current) drum.current.rotation.x += dt * 0.8
  })
  const { hx, hz, h, gate } = SITE
  // The hoarding's runs (x, z, length, along x?), the gate left in the front.
  const runs: [number, number, number, boolean][] = [
    [0, -hz, hx * 2, true],
    [-hx, 0, hz * 2, false],
    [hx, 0, hz * 2, false],
    [-(gate / 2 + (hx - gate / 2) / 2), hz, hx - gate / 2, true],
    [gate / 2 + (hx - gate / 2) / 2, hz, hx - gate / 2, true],
  ]
  const hoardGeos = useMemo(
    () =>
      runs.map(([, , len]) => {
        const g = new THREE.BoxGeometry(len, h, 0.15)
        const uv = g.attributes.uv as THREE.BufferAttribute
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 2.5))
        return g
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return (
    <group>
      {/* The hoarding, the board toward the street, the gate shut */}
      {runs.map(([x, z, , alongX], i) => (
        <mesh key={i} geometry={hoardGeos[i]} material={mats.hoard} position={[x, h / 2, z]} rotation={[0, alongX ? 0 : Math.PI / 2, 0]} receiveShadow />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={mats.board} position={[s * (gate / 2 + 7.5), h + 1.6, hz + 0.12]} scale={[11, 2.75, 0.1]} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={BOX} material={m.pole} position={[s * (gate / 2 + 7.5 - 5), h / 2 + 1.6, hz + 0.05]} scale={[0.15, h + 3.2, 0.15]} />
          <mesh geometry={BOX} material={m.gate} position={[s * (gate / 4), h / 2, hz - 0.2]} scale={[gate / 2, h, 0.08]} />
        </group>
      ))}
      {/* The guard's booth by the gate */}
      <mesh geometry={BOX} material={m.hut} position={[gate / 2 + 2, 1.3, hz - 2]} scale={[2, 2.6, 2]} />
      {/* The site's huts, two stacked, their blue doors */}
      {[[-26, -18], [-26, -12.5]].map(([x, z]) =>
        [0, 1].map((lvl) => (
          <group key={`${x}${z}${lvl}`} position={[x, lvl * 2.65, z]}>
            <mesh geometry={BOX} material={m.hut} position={[0, 1.3, 0]} scale={[6, 2.6, 2.4]} castShadow />
            <mesh geometry={BOX} material={m.hutDoor} position={[1.6, 1.1, 1.22]} scale={[0.9, 2, 0.05]} />
          </group>
        )),
      )}
      {/* The cement silo on its legs, the sand, the rebar, the crates of glass panels */}
      <group position={[24, 0, -18]}>
        <mesh material={m.silo} position={[0, 7, 0]} castShadow>
          <cylinderGeometry args={[1.4, 1.4, 7, 14]} />
        </mesh>
        <mesh material={m.silo} position={[0, 3, 0]}>
          <coneGeometry args={[1.4, 2, 14]} />
        </mesh>
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={BOX} material={m.pole} position={[x, 2, z]} scale={[0.15, 4, 0.15]} />
        ))}
      </group>
      <mesh material={m.sand} position={[-18, 0.8, 14]}>
        <coneGeometry args={[3.2, 1.6, 14]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={BOX} material={m.rebar} position={[10, 0.15 + i * 0.12, -22 + i * 0.3]} scale={[12, 0.1, 1.4]} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={BOX} material={m.crate} position={[-8 + (i % 2) * 3.4, 1.1 + Math.floor(i / 2) * 2.25, -21]} scale={[3, 2.2, 0.6]} castShadow />
      ))}
      {/* A mixer truck by the gate, its drum turning */}
      <group position={[9, 0, 16]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={BOX} material={m.truck} position={[3.1, 1.5, 0]} scale={[1.8, 2, 2.3]} castShadow />
        <mesh geometry={BOX} material={m.tyre} position={[0, 0.7, 0]} scale={[8, 0.5, 2.2]} />
        <mesh ref={drum} material={m.drum} position={[-0.8, 2.3, 0]} rotation={[0, 0, Math.PI / 2 - 0.25]} castShadow>
          <cylinderGeometry args={[1.05, 1.25, 5, 12]} />
        </mesh>
        {[-3, -1.6, 2.8].map((x) =>
          [-1, 1].map((s) => (
            <mesh key={`${x}${s}`} material={m.tyre} position={[x, 0.5, s * 1.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 0.4, 10]} />
            </mesh>
          )),
        )}
      </group>
      {/* Floodlights over the site, lit after dark */}
      {[[-hx + 3, hz - 3], [hx - 3, -hz + 3]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={BOX} material={m.pole} position={[0, 5, 0]} scale={[0.2, 10, 0.2]} />
          <mesh geometry={BOX} material={mats.lamp} position={[0, 10, 0]} scale={[1.4, 0.5, 0.5]} />
          {night && (
            <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[14, 24]} />
              <meshBasicMaterial color="#fff1cc" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          )}
        </group>
      ))}
      {/* The builders by day, the guard at the gate always */}
      <NoShadows>
        {!night &&
          people.map((b, i) => (
            <group key={i} position={[b.p[0], 0, b.p[1]]} rotation={[0, b.r, 0]}>
              <Human look={b.look} gender="homme" pose={b.pose} seed={b.seed} />
            </group>
          ))}
        <group position={[gate / 2 + 2, 0, hz - 0.4]}>
          <Human look={guard} gender="homme" pose="idle" seed={7} />
        </group>
      </NoShadows>
    </group>
  )
}
