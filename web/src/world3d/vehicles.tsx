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

/** Square wheels, a lighter hub on the outside. */
function Wheels({ x, r, wide }: { x: number[]; r: number; wide: number }) {
  return (
    <>
      {x.flatMap((wx) =>
        [-1, 1].map((sz) => (
          <group key={`${wx}${sz}`} position={[wx, r, sz * (wide / 2 - 0.1)]}>
            <K p={[0, 0, 0]} s={[r * 2, r * 2, 0.3]} m={paint('#1b1b20')} cast={false} />
            <K p={[0, 0, sz * 0.16]} s={[r, r, 0.02]} m={paint('#c3c7cf')} cast={false} />
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
export type CarModel = 'saloon' | 'berline' | 'suv' | '4x4' | 'limo'
export function carModel(seed: number): CarModel {
  const u = (Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1
  return u < 0.3 ? 'saloon' : u < 0.52 ? 'berline' : u < 0.74 ? 'suv' : u < 0.92 ? '4x4' : 'limo'
}
/** Length, width, wheel radius: what the far shape also needs. */
const CAR_SIZE: Record<CarModel, [number, number, number]> = { saloon: [4.4, 1.66, 0.32], berline: [4.9, 1.82, 0.34], suv: [4.6, 1.82, 0.38], '4x4': [4.8, 1.92, 0.44], limo: [6.4, 1.84, 0.34] }
const CHROME = new THREE.MeshPhongMaterial({ color: '#d9dee5', shininess: 160, specular: new THREE.Color('#ffffff') })
/** A limousine's or a big car's tinted glass, darker than the rest. */
const TINT = new THREE.MeshPhongMaterial({ color: '#0d1117', shininess: 140, specular: new THREE.Color('#8b9bb0') })

function PrivateCar({ model, body }: { model: CarModel; body: string }) {
  if (model === 'saloon' || model === 'suv') return <Car4 type={model} body={body} />
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

/** The SITRA bus: 11 m long, white over a green skirt with the orange band, two doors on the right, windows all along, the line on the front. */
function Sotra({ body }: { body: string }) {
  const [len, wide] = [11, 2.5]
  const p = paint(body)
  const green = paint('#008f4c')
  return (
    <group>
      <K p={[0, 1.75, 0]} s={[len, 2.6, wide]} m={p} />
      {/* The green skirt and the orange band, round the bus */}
      <K p={[0, 0.78, 0]} s={[len + 0.02, 0.62, wide + 0.02]} m={green} cast={false} />
      <K p={[0, 1.16, 0]} s={[len + 0.02, 0.14, wide + 0.02]} m={paint('#ff7a00')} cast={false} />
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

/** A moto: square wheels, a frame, the tank, the seat, the bars, and its rider. */
function Moto({ color }: { color: string }) {
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
      <NoShadows>
        <group position={[-0.25, 0.42, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Human look={RIDER} gender="homme" pose="sit" seed={4} />
        </group>
      </NoShadows>
    </group>
  )
}

/** Abidjan's traffic: orange taxi compteur, woro-woro, gbaka, cars and motos. */
type VehicleProps = { p: [number, number, number]; r?: number; kind?: VehicleKind; color?: string; trim?: string; seed?: number; /** The gbaka's apprenti at the door (false: someone else moves him, see OpenWorld's Gbaka). */ crew?: boolean }

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
function FarVehicle({ p, r = 0, kind = 'taxi', color, seed = 0 }: VehicleProps) {
  // A private car far off keeps its length and height (a limousine stays long, a 4x4 tall) and its paint.
  const model = kind === 'car' ? carModel(seed) : null
  const [l, h, w] = model ? [CAR_SIZE[model][0], model === '4x4' ? 1.5 : model === 'suv' ? 1.3 : 1.05, CAR_SIZE[model][1]] : FAR_SIZE[kind]
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

function NearVehicle({ p, r = 0, kind = 'taxi', color, trim, seed = 0, crew = true }: VehicleProps) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      {kind === 'moto' ? (
        <Moto color={color ?? '#c92a2a'} />
      ) : kind === 'sotra' ? (
        <Sotra body={color ?? '#f4f6f5'} />
      ) : kind === 'gbaka' ? (
        <Gbaka body={color ?? '#f4c430'} stripe={trim ?? '#00a862'} crew={crew} />
      ) : kind === 'car' ? (
        <PrivateCar model={carModel(seed)} body={carPaint(carModel(seed), seed, color)} />
      ) : (
        <Car4 type="saloon" body={color ?? (kind === 'taxi' ? '#ff7a00' : '#e9ecef')} trim={kind === 'woro' ? trim : undefined} roofSign={kind === 'taxi'} />
      )}
    </group>
  )
}
