import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../avatar/Human'
import { randomLook } from '../avatar/options'

// Abidjan's traffic, modelled on what drives there: the woro-woro and the
// orange taxi compteur are small saloons (Corolla-style), the gbaka a Hiace-
// type minibus with its roof rack and its apprenti at the open door, private
// cars are saloons, berlines, SUVs, 4x4s and the odd limousine (carModel), and the motos the cheap Chinese bikes, with their
// rider; the SITRA bus, white with its green and orange band. All in blocks, like the Sims and the buildings: Minecraft style.
// Real size, in metres, nose towards +x.

export type VehicleKind = 'taxi' | 'woro' | 'gbaka' | 'car' | 'moto' | 'sotra'

// Shared by every vehicle: their lights come on at night (setVehicleNight),
// with a pool of light on the road ahead.
const HEAD = new THREE.MeshLambertMaterial({ color: '#fff6cc', emissive: '#fff6cc', emissiveIntensity: 0.6 })
const TAIL = new THREE.MeshLambertMaterial({ color: '#d7263d', emissive: '#ff2a3d', emissiveIntensity: 0.4 })
const BEAM = new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, visible: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })
const GLASS = new THREE.MeshPhongMaterial({ color: '#26303d', shininess: 120, specular: new THREE.Color('#b9c8d8') })
const BEAM_GEO = (() => {
  // A fan of light on the road: narrow at the car, wide 12 m ahead.
  const s = new THREE.Shape([new THREE.Vector2(0, -0.7), new THREE.Vector2(12, -2.6), new THREE.Vector2(12, 2.6), new THREE.Vector2(0, 0.7)])
  const g = new THREE.ShapeGeometry(s)
  g.rotateX(Math.PI / 2)
  return g
})()
export function setVehicleNight(night: boolean) {
  HEAD.emissiveIntensity = night ? 2.2 : 0.6
  TAIL.emissiveIntensity = night ? 1.6 : 0.4
  BEAM.visible = night
}

/* ---------- Everything in blocks, like Minecraft ---------- */

const UNIT = new THREE.BoxGeometry(1, 1, 1)
/** A little pixel grain on the paint, so a flat colour reads as a block. */
const GRAIN = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 8
  const g = c.getContext('2d')!
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      const v = 225 + Math.floor((n - Math.floor(n)) * 30)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(x, y, 1, 1)
    }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const paints = new Map<string, THREE.Material>()
/** Paint for a colour, shared by every vehicle of that colour. */
const paint = (color: string) => {
  let m = paints.get(color)
  if (!m) paints.set(color, (m = new THREE.MeshLambertMaterial({ color, map: GRAIN })))
  return m
}
type V3 = [number, number, number]
/** One block: centre and size, in metres. */
const K = ({ p, s, m, cast = true }: { p: V3; s: V3; m: THREE.Material; cast?: boolean }) => <mesh geometry={UNIT} material={m} position={p} scale={s} castShadow={cast} />

/** Square wheels, a lighter hub on the outside (`hub`: its colour; `caliper`: the brake showing through it). */
function Wheels({ x, r, wide, hub = '#c3c7cf', caliper }: { x: number[]; r: number; wide: number; hub?: string; caliper?: string }) {
  return (
    <>
      {x.flatMap((wx) =>
        [-1, 1].map((sz) => (
          <group key={`${wx}${sz}`} position={[wx, r, sz * (wide / 2 - 0.1)]}>
            <K p={[0, 0, 0]} s={[r * 2, r * 2, 0.3]} m={paint('#1b1b20')} cast={false} />
            <K p={[0, 0, sz * 0.16]} s={[r * 1.15, r * 1.15, 0.02]} m={paint(hub)} cast={false} />
            {hub !== '#c3c7cf' && <K p={[0, 0, sz * 0.165]} s={[r * 0.3, r * 0.3, 0.02]} m={paint('#1b1b20')} cast={false} />}
            {caliper && <K p={[r * 0.32, r * 0.1, sz * 0.163]} s={[r * 0.28, r * 0.46, 0.02]} m={paint(caliper)} cast={false} />}
          </group>
        )),
      )}
    </>
  )
}

/** Lights, bumpers and plates at both ends, mirrors, the beam at night. */
function Ends({ len, wide, y, mirror }: { len: number; wide: number; y: number; mirror: [number, number] }) {
  const h = len / 2
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s}>
          <K p={[s * (h + 0.05), 0.42, 0]} s={[0.1, 0.2, wide]} m={paint('#2b2f36')} cast={false} />
          <K p={[s * (h + 0.11), 0.42, 0]} s={[0.02, 0.12, 0.42]} m={paint('#f4f4f4')} cast={false} />
          <K p={[h + 0.03, y, s * (wide / 2 - 0.25)]} s={[0.06, 0.16, 0.3]} m={HEAD} cast={false} />
          <K p={[-h - 0.03, y, s * (wide / 2 - 0.22)]} s={[0.06, 0.16, 0.28]} m={TAIL} cast={false} />
          <K p={[mirror[0], mirror[1], s * (wide / 2 + 0.1)]} s={[0.14, 0.12, 0.14]} m={paint('#1b1b20')} cast={false} />
        </group>
      ))}
      <K p={[h + 0.035, y - 0.05, 0]} s={[0.04, 0.18, 0.6]} m={paint('#1b1b20')} cast={false} />
      <mesh geometry={BEAM_GEO} material={BEAM} position={[h + 0.2, 0.08, 0]} />
    </>
  )
}

/** A saloon (taxi, woro-woro) or an SUV: a chassis block, a cabin block, glass all round. */
function Car4({ type, body, trim, roofSign }: { type: 'saloon' | 'suv'; body: string; trim?: string; roofSign?: boolean }) {
  const suv = type === 'suv'
  const [len, wide, r] = suv ? [4.6, 1.82, 0.38] : [4.4, 1.66, 0.32]
  const [c0, c1] = suv ? [0.4, 1.1] : [0.32, 0.88] // chassis, bottom and top
  const [cabLen, cabX, cabTop] = suv ? [3.0, -0.55, 1.8] : [2.2, -0.25, 1.44]
  const p = paint(body)
  return (
    <group>
      <K p={[0, (c0 + c1) / 2, 0]} s={[len, c1 - c0, wide]} m={p} />
      <K p={[cabX, (c1 + cabTop) / 2, 0]} s={[cabLen, cabTop - c1, wide - 0.16]} m={p} />
      {/* Glass: the sides, the windscreen, the rear window, and the pillars between */}
      <K p={[cabX, (c1 + cabTop) / 2 + 0.01, 0]} s={[cabLen - 0.3, (cabTop - c1) * 0.72, wide - 0.12]} m={GLASS} cast={false} />
      <K p={[cabX + cabLen / 2 + 0.005, (c1 + cabTop) / 2 + 0.01, 0]} s={[0.02, (cabTop - c1) * 0.72, wide - 0.4]} m={GLASS} cast={false} />
      {!suv && <K p={[cabX - cabLen / 2 - 0.005, (c1 + cabTop) / 2 + 0.01, 0]} s={[0.02, (cabTop - c1) * 0.72, wide - 0.4]} m={GLASS} cast={false} />}
      {(suv ? [-1.15, 0.05] : [-0.28]).map((x) => (
        <K key={x} p={[cabX + x + (suv ? 0.55 : 0.25), (c1 + cabTop) / 2, 0]} s={[0.14, cabTop - c1, wide - 0.1]} m={p} cast={false} />
      ))}
      {/* A woro-woro's lower band in a second colour (Abobo, Port-Bouët) */}
      {trim && <K p={[0, c0 + 0.12, 0]} s={[len + 0.02, 0.2, wide + 0.02]} m={paint(trim)} cast={false} />}
      {/* The taxi compteur's sign */}
      {roofSign && <K p={[cabX, cabTop + 0.1, 0]} s={[0.55, 0.2, 0.32]} m={HEAD} cast={false} />}
      <Wheels x={suv ? [-1.45, 1.45] : [-1.32, 1.32]} r={r} wide={wide} />
      <Ends len={len} wide={wide} y={suv ? 0.85 : 0.68} mirror={suv ? [1.0, 1.2] : [0.85, 1.0]} />
    </group>
  )
}

/* ---------- The people's own cars ---------- */

/**
 * What a private car is, from its number (the same on every screen): a plain saloon, the big
 * berline of the Plateau's managers (long, low, chrome), an SUV, the 4x4 of the up-country
 * roads (tall, bull bar, spare wheel, roof rack) and now and then a limousine (a wedding, a big man).
 */
export type CarModel = 'saloon' | 'berline' | 'suv' | '4x4' | 'limo' | 'cruiser' | 'pickup' | 'hyper'
export function carModel(seed: number): CarModel {
  const u = (Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1
  return u < 0.26 ? 'saloon' : u < 0.44 ? 'berline' : u < 0.6 ? 'suv' : u < 0.7 ? '4x4' : u < 0.8 ? 'cruiser' : u < 0.93 ? 'pickup' : u < 0.975 ? 'limo' : 'hyper'
}
/** Length, width, wheel radius: what the far shape also needs. */
const CAR_SIZE: Record<CarModel, [number, number, number]> = { saloon: [4.4, 1.66, 0.32], berline: [4.9, 1.82, 0.34], suv: [4.6, 1.82, 0.38], '4x4': [4.8, 1.92, 0.44], limo: [6.4, 1.84, 0.34], cruiser: [4.92, 1.98, 0.42], pickup: [5.4, 2.0, 0.46], hyper: [4.55, 2.04, 0.36] }
/** How tall each looks far off (the body's block). */
const FAR_TALL: Record<CarModel, number> = { saloon: 1.05, berline: 1.05, suv: 1.3, '4x4': 1.5, limo: 1.05, cruiser: 1.55, pickup: 1.45, hyper: 0.7 }
const CHROME = new THREE.MeshPhongMaterial({ color: '#d9dee5', shininess: 160, specular: new THREE.Color('#ffffff') })
/** A limousine's or a big car's tinted glass, darker than the rest. */
const TINT = new THREE.MeshPhongMaterial({ color: '#0d1117', shininess: 140, specular: new THREE.Color('#8b9bb0') })

function PrivateCar({ model, body }: { model: CarModel; body: string }) {
  if (model === 'saloon' || model === 'suv') return <Car4 type={model} body={body} />
  if (model === 'cruiser') return <Cruiser body={body} />
  if (model === 'pickup') return <Pickup body={body} />
  if (model === 'hyper') return <Hyper body={body} />
  const [len, wide, r] = CAR_SIZE[model]
  const p = paint(body)
  const tall = model === '4x4'
  const [c0, c1] = tall ? [0.5, 1.2] : [0.3, 0.84] // chassis, bottom and top
  // The cabin: the 4x4's a long box to the tail; the limousine's stretched; the berline's set back, a long bonnet.
  const [cabLen, cabX, cabTop] = tall ? [3.3, -0.55, 2.02] : model === 'limo' ? [4.3, -0.35, 1.4] : [2.6, -0.4, 1.38]
  const glass = model === 'limo' ? TINT : GLASS
  const midY = (c1 + cabTop) / 2
  // The pillars between the windows: the limousine has four doors' worth down each side.
  const pillars = model === 'limo' ? [-1.6, -0.5, 0.6] : tall ? [-1.0, 0.2] : [-0.2]
  const wheels = model === 'limo' ? [-2.35, 2.35] : tall ? [-1.55, 1.55] : [-1.5, 1.5]
  return (
    <group>
      <K p={[0, (c0 + c1) / 2, 0]} s={[len, c1 - c0, wide]} m={p} />
      <K p={[cabX, midY, 0]} s={[cabLen, cabTop - c1, wide - 0.16]} m={p} />
      <K p={[cabX, midY + 0.01, 0]} s={[cabLen - 0.3, (cabTop - c1) * 0.72, wide - 0.12]} m={glass} cast={false} />
      <K p={[cabX + cabLen / 2 + 0.005, midY + 0.01, 0]} s={[0.02, (cabTop - c1) * 0.72, wide - 0.4]} m={GLASS} cast={false} />
      {!tall && <K p={[cabX - cabLen / 2 - 0.005, midY + 0.01, 0]} s={[0.02, (cabTop - c1) * 0.72, wide - 0.4]} m={glass} cast={false} />}
      {pillars.map((x) => (
        <K key={x} p={[cabX + x, midY, 0]} s={[0.14, cabTop - c1, wide - 0.1]} m={p} cast={false} />
      ))}
      {/* The chrome: a line along the sides and the grille (a plain bar: no maker's own shape) */}
      {model !== '4x4' && <K p={[0, c1 - 0.06, 0]} s={[len - 0.4, 0.05, wide + 0.02]} m={CHROME} cast={false} />}
      <K p={[len / 2 + 0.04, c1 - 0.2, 0]} s={[0.04, 0.16, wide * 0.42]} m={CHROME} cast={false} />
      {tall && (
        <>
          {/* Bull bar, spare wheel on the tailgate, roof rack */}
          <K p={[len / 2 + 0.22, 0.75, 0]} s={[0.08, 0.5, wide * 0.8]} m={paint('#2b2f36')} cast={false} />
          <K p={[len / 2 + 0.2, 1.0, 0]} s={[0.3, 0.08, wide * 0.8]} m={paint('#2b2f36')} cast={false} />
          <group position={[-len / 2 - 0.16, 1.0, 0]}>
            <K p={[0, 0, 0]} s={[0.26, r * 2, r * 2]} m={paint('#1b1b20')} cast={false} />
            <K p={[-0.02, 0, 0]} s={[0.24, r, r]} m={paint('#c3c7cf')} cast={false} />
          </group>
          {[-1, 1].map((s) => (
            <K key={s} p={[cabX, cabTop + 0.08, s * (wide / 2 - 0.2)]} s={[cabLen - 0.4, 0.08, 0.08]} m={paint('#3a3f4b')} cast={false} />
          ))}
        </>
      )}
      <Wheels x={wheels} r={r} wide={wide} />
      <Ends len={len} wide={wide} y={tall ? 0.95 : 0.66} mirror={[cabX + cabLen / 2 - 0.1, c1 + 0.12]} />
    </group>
  )
}

const BLACK = '#202328'

/** A car's front and back of its own: the bumpers, the lights, the plate, the mirrors, the beam at night. */
function Face({ len, wide, y, lights, bumper, mirror, plate = true }: { len: number; wide: number; y: number; /** the lamps' width and height */ lights: [number, number]; bumper: number; mirror?: [number, number]; plate?: boolean }) {
  const h = len / 2
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s}>
          <K p={[h + 0.03, y, s * (wide / 2 - lights[0] / 2 - 0.08)]} s={[0.06, lights[1], lights[0]]} m={HEAD} cast={false} />
          <K p={[-h - 0.03, y, s * (wide / 2 - 0.2)]} s={[0.06, lights[1] * 1.2, 0.26]} m={TAIL} cast={false} />
          {mirror && <K p={[mirror[0], mirror[1], s * (wide / 2 + 0.12)]} s={[0.16, 0.16, 0.18]} m={paint(BLACK)} cast={false} />}
          <K p={[s * (h + 0.06), bumper, 0]} s={[0.14, 0.24, wide + 0.04]} m={paint(BLACK)} cast={false} />
        </group>
      ))}
      {plate && (
        <>
          <K p={[h + 0.14, bumper + 0.02, 0]} s={[0.02, 0.12, 0.44]} m={paint('#f4f4f4')} cast={false} />
          <K p={[-h - 0.14, bumper + 0.02, 0]} s={[0.02, 0.12, 0.44]} m={paint('#f4f4f4')} cast={false} />
        </>
      )}
      <mesh geometry={BEAM_GEO} material={BEAM} position={[h + 0.2, 0.08, 0]} />
    </>
  )
}

/** Black wheel arches standing out over the wheels (the big 4x4s and the pick-ups). */
function Flares({ x, r, wide, y, out = 0.08 }: { x: number[]; r: number; wide: number; y: number; out?: number }) {
  return (
    <>
      {x.flatMap((wx) =>
        [-1, 1].map((s) => (
          <group key={`${wx}${s}`}>
            <K p={[wx, y, s * (wide / 2 + out / 2)]} s={[r * 2.5, 0.16, out + 0.04]} m={paint(BLACK)} cast={false} />
            {[-1, 1].map((e) => (
              <K key={e} p={[wx + e * r * 1.2, y - 0.2, s * (wide / 2 + out / 2)]} s={[0.12, 0.34, out + 0.04]} m={paint(BLACK)} cast={false} />
            ))}
          </group>
        )),
      )}
    </>
  )
}

/**
 * The big square 4x4 of the bosses and the ministers (the Savane Cruiser):
 * upright and boxy, a flat bonnet, the wide grille with its bars and the thin
 * lamps at its corners, black cladding all round the bottom and over the
 * wheels, the side step, the roof rails, the rear lamps standing up.
 */
function Cruiser({ body }: { body: string }) {
  const [len, wide, r] = CAR_SIZE.cruiser
  const p = paint(body)
  const [c0, c1, top] = [0.52, 1.28, 2.06]
  const [cabLen, cabX] = [3.35, -0.5]
  const midY = (c1 + top) / 2
  const wheels = [-1.48, 1.5]
  return (
    <group>
      <K p={[0, (c0 + c1) / 2, 0]} s={[len, c1 - c0, wide]} m={p} />
      {/* The black cladding round the bottom, the skid plate under the nose */}
      <K p={[0, c0 + 0.12, 0]} s={[len + 0.02, 0.26, wide + 0.04]} m={paint(BLACK)} cast={false} />
      <K p={[len / 2 - 0.05, c0 - 0.06, 0]} s={[0.5, 0.08, wide * 0.6]} m={CHROME} cast={false} />
      {/* The cabin: almost the car's width, upright */}
      <K p={[cabX, midY, 0]} s={[cabLen, top - c1, wide - 0.1]} m={p} />
      <K p={[cabX, midY + 0.02, 0]} s={[cabLen - 0.24, (top - c1) * 0.66, wide - 0.06]} m={TINT} cast={false} />
      <K p={[cabX + cabLen / 2 + 0.005, midY + 0.02, 0]} s={[0.02, (top - c1) * 0.66, wide - 0.36]} m={GLASS} cast={false} />
      {/* The pillars: the black ones between the doors, the thick one at the back in the paint */}
      <K p={[cabX + 0.35, midY, 0]} s={[0.12, top - c1, wide - 0.04]} m={paint(BLACK)} cast={false} />
      <K p={[cabX - cabLen / 2 + 0.3, midY, 0]} s={[0.36, top - c1, wide - 0.04]} m={p} cast={false} />
      {/* The grille: wide, black, three bright bars, the lamps a thin line at its ends */}
      <K p={[len / 2 + 0.02, c1 - 0.3, 0]} s={[0.05, 0.42, wide * 0.72]} m={paint('#15171b')} cast={false} />
      {[0, 1, 2].map((k) => (
        <K key={k} p={[len / 2 + 0.05, c1 - 0.16 - k * 0.13, 0]} s={[0.02, 0.04, wide * 0.66]} m={CHROME} cast={false} />
      ))}
      <Face len={len} wide={wide} y={c1 - 0.12} lights={[0.32, 0.1]} bumper={c0 + 0.1} mirror={[cabX + cabLen / 2 - 0.12, c1 + 0.16]} />
      {/* Side step, roof rails and their bars */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <K p={[0, c0 - 0.1, s * (wide / 2 + 0.06)]} s={[wheels[1] - wheels[0] - r * 2.6, 0.06, 0.2]} m={paint('#3a3f46')} cast={false} />
          <K p={[cabX, top + 0.08, s * (wide / 2 - 0.22)]} s={[cabLen - 0.5, 0.06, 0.07]} m={paint('#2b2f36')} cast={false} />
        </group>
      ))}
      {[-0.9, 0.5].map((x) => (
        <K key={x} p={[cabX + x, top + 0.13, 0]} s={[0.06, 0.04, wide - 0.4]} m={paint('#2b2f36')} cast={false} />
      ))}
      <Flares x={wheels} r={r} wide={wide} y={c0 + r * 1.35} />
      <Wheels x={wheels} r={r} wide={wide} hub="#b8bdc4" />
    </group>
  )
}

/**
 * The double-cab pick-up (the Baobab): tall on its big tyres, wide black arches,
 * the big black grille and its silver bar, the skid plate, a stripe down its
 * flank, four doors, and behind them the bed with its sport bar.
 */
function Pickup({ body }: { body: string }) {
  const [len, wide, r] = CAR_SIZE.pickup
  const p = paint(body)
  const [c0, c1, top] = [0.58, 1.3, 2.08]
  const [cabLen, cabX] = [2.55, 0.3]
  const bedX = -len / 2 + 0.85 // the middle of the bed
  const bedLen = len / 2 + cabX - cabLen / 2 - 0.1
  const midY = (c1 + top) / 2
  const wheels = [-1.7, 1.7]
  const dark = paint(BLACK)
  return (
    <group>
      <K p={[0, (c0 + c1) / 2, 0]} s={[len, c1 - c0, wide]} m={p} />
      <K p={[0, c0 + 0.1, 0]} s={[len + 0.02, 0.2, wide + 0.04]} m={dark} cast={false} />
      {/* The cab and its glass, the pillar between the two doors */}
      <K p={[cabX, midY, 0]} s={[cabLen, top - c1, wide - 0.14]} m={p} />
      <K p={[cabX, midY + 0.02, 0]} s={[cabLen - 0.24, (top - c1) * 0.66, wide - 0.1]} m={TINT} cast={false} />
      <K p={[cabX + cabLen / 2 + 0.005, midY + 0.02, 0]} s={[0.02, (top - c1) * 0.66, wide - 0.4]} m={GLASS} cast={false} />
      <K p={[cabX - cabLen / 2 - 0.005, midY + 0.04, 0]} s={[0.02, (top - c1) * 0.5, wide - 0.6]} m={GLASS} cast={false} />
      <K p={[cabX - 0.1, midY, 0]} s={[0.12, top - c1, wide - 0.08]} m={dark} cast={false} />
      {/* The bed: its sides and tailgate standing over the body, a black floor, the sport bar behind the cab */}
      {[-1, 1].map((s) => (
        <K key={s} p={[bedX, c1 + 0.17, s * (wide / 2 - 0.05)]} s={[bedLen, 0.34, 0.1]} m={p} />
      ))}
      <K p={[-len / 2 + 0.06, c1 + 0.17, 0]} s={[0.12, 0.34, wide - 0.1]} m={p} />
      <K p={[bedX, c1 + 0.01, 0]} s={[bedLen - 0.1, 0.02, wide - 0.2]} m={paint('#15171b')} cast={false} />
      {[-1, 1].map((s) => (
        <K key={s} p={[cabX - cabLen / 2 - 0.25, c1 + 0.45, s * (wide / 2 - 0.2)]} s={[0.1, 0.9, 0.1]} m={dark} cast={false} />
      ))}
      <K p={[cabX - cabLen / 2 - 0.25, c1 + 0.88, 0]} s={[0.1, 0.1, wide - 0.3]} m={dark} cast={false} />
      {/* The big black grille, its silver bar, the skid plate */}
      <K p={[len / 2 + 0.02, c1 - 0.3, 0]} s={[0.05, 0.46, wide * 0.78]} m={paint('#111316')} cast={false} />
      <K p={[len / 2 + 0.05, c1 - 0.52, 0]} s={[0.03, 0.07, wide * 0.8]} m={CHROME} cast={false} />
      <K p={[len / 2 - 0.05, c0 - 0.08, 0]} s={[0.6, 0.08, wide * 0.62]} m={CHROME} cast={false} />
      {/* The stripe down the flank */}
      {[-1, 1].map((s) => (
        <K key={s} p={[-0.6, c1 - 0.22, s * (wide / 2 + 0.005)]} s={[len * 0.55, 0.06, 0.01]} m={paint('#c3c7cf')} cast={false} />
      ))}
      <Face len={len} wide={wide} y={c1 - 0.1} lights={[0.36, 0.12]} bumper={c0 + 0.08} mirror={[cabX + cabLen / 2 - 0.15, c1 + 0.18]} />
      <Flares x={wheels} r={r} wide={wide} y={c0 + r * 1.3} out={0.12} />
      <Wheels x={wheels} r={r} wide={wide} hub="#2b2f36" />
    </group>
  )
}

/**
 * The hypercar (the Éclair): low and wide, a small glass canopy, the horseshoe
 * grille, the great chrome curve on the flank round the side intake, the rear
 * in the second colour, the light bar right across the back, and the wing.
 */
function Hyper({ body }: { body: string }) {
  const [len, wide, r] = CAR_SIZE.hyper
  const p = paint(body)
  const second = paint(body === '#0f1115' || body === '#16161c' ? '#1b2a6b' : '#0f1115')
  const [c0, c1, top] = [0.2, 0.74, 1.16]
  const [cabLen, cabX] = [1.9, -0.15]
  const wheels = [-1.4, 1.36]
  return (
    <group>
      {/* The nose in the paint, the back in the second colour */}
      <K p={[0.55, (c0 + c1) / 2, 0]} s={[len - 1.1, c1 - c0, wide]} m={p} />
      <K p={[-len / 2 + 0.55, (c0 + c1) / 2 + 0.03, 0]} s={[1.1, c1 - c0 + 0.06, wide]} m={second} />
      <K p={[len / 2 - 0.5, c1 - 0.04, 0]} s={[1.0, 0.08, wide - 0.3]} m={p} cast={false} />
      {/* The canopy: almost all glass, narrow, set back */}
      <K p={[cabX, (c1 + top) / 2, 0]} s={[cabLen, top - c1, wide - 0.5]} m={second} />
      <K p={[cabX + 0.1, (c1 + top) / 2 + 0.01, 0]} s={[cabLen - 0.2, (top - c1) * 0.8, wide - 0.46]} m={TINT} cast={false} />
      <K p={[cabX + cabLen / 2 + 0.005, (c1 + top) / 2, 0]} s={[0.02, (top - c1) * 0.8, wide - 0.7]} m={GLASS} cast={false} />
      {/* The great chrome curve down each flank, round the dark intake behind the door */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <K p={[-0.55, (c0 + top) / 2, s * (wide / 2 + 0.01)]} s={[0.07, top - c0 - 0.1, 0.02]} m={CHROME} cast={false} />
          <K p={[-0.15, top - 0.08, s * (wide / 2 - 0.12)]} s={[0.8, 0.05, 0.02]} m={CHROME} cast={false} />
          <K p={[0.2, c0 + 0.08, s * (wide / 2 + 0.01)]} s={[1.5, 0.05, 0.02]} m={CHROME} cast={false} />
          <K p={[-0.85, (c0 + c1) / 2 + 0.05, s * (wide / 2 + 0.005)]} s={[0.5, 0.3, 0.01]} m={paint('#0b0c0f')} cast={false} />
          <K p={[cabX + cabLen / 2 - 0.1, c1 + 0.08, s * (wide / 2 - 0.2)]} s={[0.12, 0.1, 0.16]} m={second} cast={false} />
        </group>
      ))}
      {/* The horseshoe grille in the middle of the nose, the thin lamps either side */}
      <K p={[len / 2 + 0.02, c0 + 0.28, 0]} s={[0.04, 0.34, 0.36]} m={paint('#0b0c0f')} cast={false} />
      {[-1, 1].map((s) => (
        <K key={s} p={[len / 2 + 0.04, c0 + 0.3, s * 0.19]} s={[0.03, 0.36, 0.04]} m={CHROME} cast={false} />
      ))}
      <K p={[len / 2 + 0.04, c0 + 0.11, 0]} s={[0.03, 0.04, 0.3]} m={CHROME} cast={false} />
      {[-1, 1].map((s) => (
        <K key={s} p={[len / 2 + 0.03, c1 - 0.2, s * (wide / 2 - 0.36)]} s={[0.05, 0.07, 0.42]} m={HEAD} cast={false} />
      ))}
      {/* The light bar across the back, the wing on its two struts */}
      <K p={[-len / 2 - 0.03, c1 - 0.14, 0]} s={[0.05, 0.06, wide - 0.2]} m={TAIL} cast={false} />
      {[-1, 1].map((s) => (
        <K key={s} p={[-len / 2 + 0.25, c1 + 0.12, s * 0.5]} s={[0.12, 0.22, 0.05]} m={second} cast={false} />
      ))}
      <K p={[-len / 2 + 0.22, c1 + 0.24, 0]} s={[0.36, 0.04, wide - 0.2]} m={second} cast={false} />
      <mesh geometry={BEAM_GEO} material={BEAM} position={[len / 2 + 0.2, 0.08, 0]} />
      <Wheels x={wheels} r={r} wide={wide} hub="#9aa0a6" caliper="#2f6fe0" />
    </group>
  )
}

/** What the people's cars are painted: white and black above all, silver and grey, the navy, the wine red, the champagne. */
export const CAR_COLORS = ['#f8f9fa', '#f8f9fa', '#212529', '#212529', '#adb5bd', '#6c757d', '#1b2a4a', '#7a1f2b', '#c9b48a', '#1c7ed6', '#c92a2a']

/** The paint of a private car: limousines black or white, the rest the caller's (or a plain one). */
export const carPaint = (model: CarModel, seed: number, color?: string) => (model === 'limo' ? (Math.floor(seed) % 3 === 0 ? '#f4f4f2' : '#0f1115') : color ?? '#e9ecef')

// The gbaka's apprenti hangs out of the sliding door, calling the stops and
// waving at people on the sidewalk.
/** Where the apprenti stands on the gbaka's step, outside the open door (the gbaka's frame: +x forward, +z its right). */
export const GBAKA_DOOR: [number, number, number] = [1.0, 0.42, 1.9 / 2 + 0.3]
export const APPRENTI = { ...randomLook('homme', () => 0.37), outfit: 'jersey', outfitColor: '#ff8200', hair: 'short', accessory: 'capback' }

/** The gbaka, a Hiace-type minibus: one tall block, its windows, the open door, a loaded roof rack. */
function Gbaka({ body, stripe, crew }: { body: string; stripe: string; crew: boolean }) {
  const [len, wide] = [5.3, 1.9]
  const p = paint(body)
  return (
    <group>
      <K p={[0, 1.2, 0]} s={[len, 1.6, wide]} m={p} />
      {/* The windows down both sides and the windscreen, the pillars between */}
      <K p={[-0.3, 1.6, 0]} s={[len - 1.1, 0.55, wide + 0.02]} m={GLASS} cast={false} />
      <K p={[len / 2 + 0.005, 1.6, 0]} s={[0.02, 0.55, wide - 0.3]} m={GLASS} cast={false} />
      {[-1.6, -0.5].map((x) => (
        <K key={x} p={[x, 1.6, 0]} s={[0.14, 0.6, wide + 0.04]} m={p} cast={false} />
      ))}
      {/* The painted band along the side */}
      <K p={[-0.2, 1.08, 0]} s={[len - 0.5, 0.18, wide + 0.04]} m={paint(stripe)} cast={false} />
      {/* The sliding door, always open */}
      <K p={[0.95, 1.12, wide / 2 + 0.01]} s={[0.95, 1.45, 0.04]} m={paint('#151820')} cast={false} />
      {/* Roof rack and luggage */}
      {[-1, 1].map((s) => (
        <K key={s} p={[-0.4, 2.06, s * 0.8]} s={[3.6, 0.08, 0.08]} m={paint('#3a3f4b')} cast={false} />
      ))}
      {([[-1.5, '#7a5230', 0.5], [-0.6, '#2a6cf0', 0.35], [0.4, '#c92a2a', 0.45]] as const).map(([x, c, h]) => (
        <K key={x} p={[x, 2.1 + h / 2, 0]} s={[0.8, h, 1.2]} m={paint(c)} />
      ))}
      <Wheels x={[-1.75, 1.75]} r={0.36} wide={wide} />
      <Ends len={len} wide={wide} y={0.82} mirror={[2.2, 1.3]} />
      {crew && (
        <NoShadows>
          <group position={[GBAKA_DOOR[0], GBAKA_DOOR[1], GBAKA_DOOR[2]]} rotation={[0, Math.PI / 2, 0]}>
            <Human look={APPRENTI} gender="homme" pose="hang" seed={2} />
          </group>
        </NoShadows>
      )}
    </group>
  )
}

/**
 * The SITRA bus: 11 m long, white over a green skirt with the orange band, two doors on the right, windows all along, the line on the front.
 * With a skirt: a coach of the roads up country, in its company's colours (a gare routière's).
 */
function Sotra({ body, skirt }: { body: string; skirt?: string }) {
  const [len, wide] = [11, 2.5]
  const p = paint(body)
  const green = paint(skirt ?? '#008f4c')
  return (
    <group>
      <K p={[0, 1.75, 0]} s={[len, 2.6, wide]} m={p} />
      {/* The green skirt and the orange band, round the bus */}
      <K p={[0, 0.78, 0]} s={[len + 0.02, 0.62, wide + 0.02]} m={green} cast={false} />
      <K p={[0, 1.16, 0]} s={[len + 0.02, 0.14, wide + 0.02]} m={paint(skirt ? '#1c1c1e' : '#ff7a00')} cast={false} />
      {/* Windows all along, the windscreen, the back window */}
      <K p={[-0.4, 2.15, 0]} s={[len - 1.6, 0.95, wide + 0.02]} m={GLASS} cast={false} />
      <K p={[len / 2 + 0.005, 2.0, 0]} s={[0.02, 1.35, wide - 0.25]} m={GLASS} cast={false} />
      <K p={[-len / 2 - 0.005, 2.25, 0]} s={[0.02, 0.8, wide - 0.6]} m={GLASS} cast={false} />
      {[-3.6, -1.6, 0.4, 2.4].map((x) => (
        <K key={x} p={[x, 2.15, 0]} s={[0.14, 1.0, wide + 0.04]} m={p} cast={false} />
      ))}
      {/* The two doors, on the kerb side (+z, like the gbaka's) */}
      {[4.2, -0.6].map((x) => (
        <K key={x} p={[x, 1.55, wide / 2 + 0.01]} s={[1.1, 2.2, 0.04]} m={GLASS} cast={false} />
      ))}
      {/* The line's sign over the windscreen: green, lit */}
      <K p={[len / 2 + 0.02, 2.88, 0]} s={[0.04, 0.3, wide - 0.5]} m={paint('#0b5f36')} cast={false} />
      <K p={[len / 2 + 0.04, 2.88, 0]} s={[0.02, 0.16, 0.9]} m={HEAD} cast={false} />
      {/* The roof's air box */}
      <K p={[-1, 3.15, 0]} s={[3.2, 0.2, 1.6]} m={paint('#dfe3e8')} cast={false} />
      <Wheels x={[-3.6, 3.4]} r={0.5} wide={wide} />
      <Ends len={len} wide={wide} y={0.9} mirror={[4.9, 1.8]} />
    </group>
  )
}

const RIDER = { ...randomLook('homme', () => 0.81), outfit: 'casual', accessory: 'cap' }

/** A moto: square wheels, a frame, the tank, the seat, the bars, and its rider (none: the Sim rides its own). */
function Moto({ color, rider = true }: { color: string; rider?: boolean }) {
  const dark = paint('#1b1b20')
  const metal = paint('#c3c7cf')
  return (
    <group>
      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0.3, 0]}>
          <K p={[0, 0, 0]} s={[0.6, 0.6, 0.12]} m={dark} />
          <K p={[0, 0, 0]} s={[0.26, 0.26, 0.14]} m={metal} cast={false} />
        </group>
      ))}
      <K p={[0, 0.55, 0]} s={[1.05, 0.14, 0.14]} m={paint('#3a3f4b')} />
      <K p={[0.18, 0.78, 0]} s={[0.45, 0.24, 0.32]} m={paint(color)} />
      <K p={[-0.32, 0.8, 0]} s={[0.6, 0.12, 0.3]} m={dark} />
      <K p={[0.56, 0.72, 0]} s={[0.08, 0.8, 0.08]} m={metal} cast={false} />
      <K p={[0.68, 1.1, 0]} s={[0.08, 0.06, 0.66]} m={dark} cast={false} />
      <K p={[0.74, 0.92, 0]} s={[0.1, 0.14, 0.18]} m={HEAD} cast={false} />
      {/* The rider, seated, hands on the bars */}
      {rider && (
        <NoShadows>
          <group position={[-0.25, 0.42, 0]} rotation={[0, Math.PI / 2, 0]}>
            <Human look={RIDER} gender="homme" pose="sit" seed={4} />
          </group>
        </NoShadows>
      )}
    </group>
  )
}

/** Abidjan's traffic: orange taxi compteur, woro-woro, gbaka, cars and motos. */
type VehicleProps = { p: [number, number, number]; r?: number; kind?: VehicleKind; color?: string; trim?: string; seed?: number; /** The gbaka's apprenti at the door, the moto's rider (false: someone else moves him, see OpenWorld's Gbaka; the Sim rides its own moto). */ crew?: boolean; /** A private car of this model (else one by the seed): the Sim's own (world3d/drive.ts). */ model?: CarModel; /** A bus as a coach up country, its skirt in its company's colour (a gare routière's). */ skirt?: string }

/**
 * A vehicle in full detail up close; past FAR metres, a simple shape in the
 * same colours (a body, its windows, the wheels' shadow): nobody sees the
 * mirrors and the plates from there.
 */
const FAR = 55
export function Vehicle(props: VehicleProps) {
  const anchor = useRef<THREE.Group>(null)
  const [far, setFar] = useState(false)
  const at = useRef(new THREE.Vector3())
  useFrame(({ camera }) => {
    if (!anchor.current) return
    const d = anchor.current.getWorldPosition(at.current).distanceTo(camera.position)
    if (!far && d > FAR + 5) setFar(true)
    else if (far && d < FAR - 5) setFar(false)
  })
  return <group ref={anchor}>{far ? <FarVehicle {...props} /> : <NearVehicle {...props} />}</group>
}

const FAR_SIZE: Record<VehicleKind, [number, number, number]> = { taxi: [4.4, 1.0, 1.66], woro: [4.4, 1.0, 1.66], car: [4.5, 1.1, 1.75], gbaka: [5.3, 1.7, 1.9], moto: [1.9, 0.9, 0.5], sotra: [11, 2.7, 2.5] }
const farBody = new Map<string, THREE.MeshLambertMaterial>()
const farMat = (c: string) => {
  let m = farBody.get(c)
  if (!m) farBody.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
const FAR_BOX = new THREE.BoxGeometry(1, 1, 1)
function FarVehicle({ p, r = 0, kind = 'taxi', color, seed = 0, model: own }: VehicleProps) {
  // A private car far off keeps its length and height (a limousine stays long, a 4x4 tall) and its paint.
  const model = kind === 'car' ? (own ?? carModel(seed)) : null
  const [l, h, w] = model ? [CAR_SIZE[model][0], FAR_TALL[model], CAR_SIZE[model][1]] : FAR_SIZE[kind]
  const body = model ? carPaint(model, seed, color) : (color ?? (kind === 'taxi' ? '#ff7a00' : kind === 'gbaka' ? '#f4c430' : kind === 'moto' ? '#c92a2a' : kind === 'sotra' ? '#f4f6f5' : '#e9ecef'))
  return (
    <group position={p} rotation={[0, r, 0]}>
      <mesh geometry={FAR_BOX} material={farMat(body)} position={[0, 0.3 + h / 2, 0]} scale={[l, h, w]} />
      {kind !== 'moto' && <mesh geometry={FAR_BOX} material={GLASS} position={[kind === 'gbaka' ? 0 : -0.25, 0.3 + h + 0.22, 0]} scale={[kind === 'gbaka' ? l * 0.95 : l * 0.5, 0.42, w * 0.96]} />}
      <mesh geometry={FAR_BOX} material={farMat('#1b1b20')} position={[0, 0.17, 0]} scale={[l * 0.8, 0.34, w * 1.02]} />
      {/* Headlights and tail lights even far off: at night the streets are lines of white and red */}
      <mesh geometry={FAR_BOX} material={HEAD} position={[l / 2 + 0.03, 0.62, 0]} scale={[0.08, 0.16, w * 0.8]} />
      <mesh geometry={FAR_BOX} material={TAIL} position={[-l / 2 - 0.03, 0.62, 0]} scale={[0.08, 0.14, w * 0.8]} />
    </group>
  )
}

function NearVehicle({ p, r = 0, kind = 'taxi', color, trim, seed = 0, crew = true, model, skirt }: VehicleProps) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      {kind === 'moto' ? (
        <Moto color={color ?? '#c92a2a'} rider={crew} />
      ) : kind === 'sotra' ? (
        <Sotra body={color ?? '#f4f6f5'} skirt={skirt} />
      ) : kind === 'gbaka' ? (
        <Gbaka body={color ?? '#f4c430'} stripe={trim ?? '#00a862'} crew={crew} />
      ) : kind === 'car' ? (
        <PrivateCar model={model ?? carModel(seed)} body={carPaint(model ?? carModel(seed), seed, color)} />
      ) : (
        <Car4 type="saloon" body={color ?? (kind === 'taxi' ? '#ff7a00' : '#e9ecef')} trim={kind === 'woro' ? trim : undefined} roofSign={kind === 'taxi'} />
      )}
    </group>
  )
}

/** A bicycle, its nose along +x like the others: two wheels, the frame in its colour, the saddle, the bars. */
export function Bicycle({ color }: { color: string }) {
  const dark = paint('#1b1b20')
  const metal = paint('#c3c7cf')
  return (
    <group>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, 0.34, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.31, 0.04, 6, 18]} />
          <meshLambertMaterial color="#1b1b20" />
        </mesh>
      ))}
      <K p={[0, 0.58, 0]} s={[0.95, 0.06, 0.06]} m={paint(color)} />
      <K p={[-0.18, 0.62, 0]} s={[0.06, 0.5, 0.06]} m={paint(color)} />
      <K p={[0.2, 0.46, 0]} s={[0.7, 0.05, 0.05]} m={paint(color)} cast={false} />
      <K p={[-0.2, 0.9, 0]} s={[0.26, 0.06, 0.14]} m={dark} />
      <K p={[0.48, 0.78, 0]} s={[0.05, 0.6, 0.05]} m={metal} cast={false} />
      <K p={[0.48, 1.08, 0]} s={[0.05, 0.05, 0.56]} m={dark} cast={false} />
    </group>
  )
}
