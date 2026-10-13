import { createContext, useContext, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { fullLook } from './options'
import { tint, waxTexture } from './textures'

// A stylised cartoon Sim with human proportions (about six heads tall): soft
// rounded shapes, toon shading and an expressive face. Built from primitives
// so every skin × body × hair × outfit combination works without art assets.
// Units are metres: feet on y=0, facing +Z.

export type Pose = 'idle' | 'walk' | 'busy' | 'hero' | 'wave'

/* ---------- Shared geometry and toon materials ---------- */

const geoCache = new Map<string, THREE.BufferGeometry>()
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = make()))
  return g
}
const SPHERE = () => geo('sphere', () => new THREE.SphereGeometry(1, 28, 20))
/** A capsule hanging down from its top end, length = distance between the two ball centres. */
const limb = (r0: number, r1: number, len: number) =>
  geo(`limb${r0}|${r1}|${len}`, () => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.sin(a) * r1, -len - Math.cos(a) * r1))
    }
    for (let i = 8; i >= 0; i--) {
      const a = (i / 8) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * r0))
    }
    return new THREE.LatheGeometry(pts, 20)
  })

let gradient: THREE.DataTexture | null = null
function toonRamp() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat)
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter
    gradient.needsUpdate = true
  }
  return gradient
}

const matCache = new Map<string, THREE.Material>()
function mat(color: string, o: { map?: THREE.Texture; double?: boolean; shine?: boolean } = {}) {
  const key = `${color}|${o.map?.uuid ?? ''}|${o.double ?? false}|${o.shine ?? false}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: o.map ? '#ffffff' : color,
      map: o.map,
      gradientMap: toonRamp(),
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      emissive: o.shine ? new THREE.Color(color).multiplyScalar(0.25) : undefined,
    })
    matCache.set(key, m)
  }
  return m
}
const flat = (color: string) => {
  const key = `basic|${color}`
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = new THREE.MeshBasicMaterial({ color })))
  return m
}

type V3 = [number, number, number]
const Shadows = createContext(true)
/** Wrap crowds in this: background Sims don't need to cast shadows. */
export const NoShadows = ({ children }: { children: React.ReactNode }) => <Shadows.Provider value={false}>{children}</Shadows.Provider>

function Part({ g, m, p, s, r }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; s?: V3 | number; r?: V3 }) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} castShadow={useContext(Shadows)} />
}
const Blob = ({ m, p, r, rot }: { m: THREE.Material; p: V3; r: V3; rot?: V3 }) => <Part g={SPHERE()} m={m} p={p} s={r} r={rot} />

/* ---------- Proportions ---------- */

const BODY: Record<string, { w: number; limb: number; belly: number }> = {
  mince: { w: 0.9, limb: 0.86, belly: 0 },
  moyen: { w: 1, limb: 1, belly: 0 },
  fort: { w: 1.14, limb: 1.2, belly: 0.008 },
  rond: { w: 1.2, limb: 1.12, belly: 0.05 },
}

const HIP_Y = 0.86
const THIGH = 0.37
const SHIN = 0.37
const SHOULDER_Y = 1.265
const UPPER_ARM = 0.25
const FOREARM = 0.23
const HEAD_Y = 1.5
const HEAD: V3 = [0.122, 0.138, 0.124] // head radii

function torsoGeometry(femme: boolean, w: number, belly: number) {
  return geo(`torso${femme}|${w}|${belly}`, () => {
    // (radius, height) from the crotch up to the base of the neck.
    const male: [number, number][] = [[0.001, 0.79], [0.12, 0.8], [0.155, 0.86], [0.16, 0.93], [0.15 + belly, 1.0], [0.152 + belly, 1.08], [0.165, 1.16], [0.172, 1.23], [0.16, 1.285], [0.11, 1.33], [0.05, 1.36], [0.001, 1.365]]
    const female: [number, number][] = [[0.001, 0.79], [0.13, 0.8], [0.172, 0.86], [0.168, 0.93], [0.128 + belly, 1.02], [0.132 + belly, 1.08], [0.155, 1.15], [0.16, 1.2], [0.145, 1.265], [0.1, 1.315], [0.048, 1.35], [0.001, 1.355]]
    // A smooth curve through the profile, so toon shading doesn't band.
    const curve = new THREE.SplineCurve((femme ? female : male).map(([r, y]) => new THREE.Vector2(r * w, y)))
    const g = new THREE.LatheGeometry(curve.getPoints(48), 36)
    g.scale(1, 1, 0.7)
    return g
  })
}

/** A flared tube (skirt, robe), drawn bottom → top so it faces outwards. */
function flare(top: number, bottom: number, yTop: number, yBottom: number, depth = 0.8) {
  return geo(`flare${top}|${bottom}|${yTop}|${yBottom}|${depth}`, () => {
    const pts = [new THREE.Vector2(bottom, yBottom), new THREE.Vector2(bottom * 0.97, yBottom + 0.04), new THREE.Vector2((top + bottom) / 2 + 0.012, (yTop + yBottom) / 2), new THREE.Vector2(top, yTop)]
    const g = new THREE.LatheGeometry(pts, 32)
    g.scale(1, 1, depth)
    return g
  })
}

/* ---------- Outfits ---------- */

type Shoe = { color: string; kind: 'sneaker' | 'dress' | 'sandal' | 'boot' | 'heel' }
type Dress = {
  top: THREE.Material
  sleeve: THREE.Material | null // upper arm; null = bare
  forearm: THREE.Material | null // null = bare
  thigh: THREE.Material | null
  shin: THREE.Material | null
  shoe: Shoe
  skirt?: { m: THREE.Material; hem: number; r: number }
  robe?: THREE.Material
  bell?: boolean // wide boubou sleeves
  extra?: (w: number) => React.ReactNode
}

function dressFor(l: Required<Look>, femme: boolean): Dress {
  const wax = mat('#fff', { map: waxTexture(l.outfitColor, l.pattern) })
  const solid = mat(l.outfitColor)
  const dark = mat('#2b2f45')
  switch (l.outfit) {
    case 'pagne':
      return femme
        ? { top: wax, sleeve: wax, forearm: null, thigh: null, shin: null, shoe: { color: '#8a5a2b', kind: 'sandal' }, skirt: { m: wax, hem: 0.07, r: 0.2 }, extra: (w) => <Blob m={wax} p={[0.11 * w, 0.95, 0.09 * w]} r={[0.035, 0.03, 0.02]} /> }
        : { top: wax, sleeve: wax, forearm: null, thigh: dark, shin: dark, shoe: { color: '#6b4423', kind: 'dress' } }
    case 'boubou': {
      const fabric = mat(l.outfitColor, { double: true })
      const gold = mat('#e8b93c', { shine: true })
      return {
        top: fabric,
        sleeve: fabric,
        forearm: null,
        thigh: fabric,
        shin: fabric,
        shoe: { color: '#e8d9b5', kind: 'sandal' },
        robe: fabric,
        bell: true,
        extra: (w) => (
          <group>
            <mesh geometry={geo('collar', () => new THREE.TorusGeometry(0.06, 0.008, 8, 28))} material={gold} position={[0, 1.33, 0.025]} rotation={[1.2, 0, 0]} scale={[w, 1, 1]} />
            <Blob m={gold} p={[0, 1.18, 0.125 * w]} r={[0.022, 0.08, 0.008]} />
            <Blob m={gold} p={[0, 1.08, 0.13 * w]} r={[0.05, 0.012, 0.008]} />
          </group>
        ),
      }
    }
    case 'robe':
      if (!femme) return dressFor({ ...l, outfit: 'casual' }, femme)
      return { top: wax, sleeve: null, forearm: null, thigh: null, shin: null, shoe: { color: '#1c1c22', kind: 'heel' }, skirt: { m: wax, hem: 0.45, r: 0.25 } }
    case 'suit': {
      const navy = mat('#1f2a44')
      return {
        top: navy,
        sleeve: navy,
        forearm: navy,
        thigh: navy,
        shin: navy,
        shoe: { color: '#141416', kind: 'dress' },
        extra: (w) => (
          <group>
            <Blob m={mat('#f8f9fa')} p={[0, 1.25, 0.1 * w]} r={[0.045, 0.075, 0.03]} />
            <Blob m={mat(l.outfitColor === '#14213d' ? '#d6336c' : l.outfitColor)} p={[0, 1.2, 0.118 * w]} r={[0.017, 0.085, 0.012]} />
            {[-1, 1].map((s) => (
              <Blob key={s} m={navy} p={[s * 0.05 * w, 1.24, 0.108 * w]} r={[0.02, 0.09, 0.018]} rot={[0, 0, s * 0.35]} />
            ))}
          </group>
        ),
      }
    }
    case 'jersey': {
      const orange = mat('#ff8200')
      const green = mat('#009a44')
      return {
        top: orange,
        sleeve: orange,
        forearm: null,
        thigh: mat('#f8f9fa'),
        shin: null,
        shoe: { color: '#141416', kind: 'boot' },
        extra: (w) => (
          <group>
            <mesh geometry={geo('collar', () => new THREE.TorusGeometry(0.06, 0.008, 8, 28))} material={green} position={[0, 1.33, 0.025]} rotation={[1.2, 0, 0]} scale={[w, 1, 1]} />
            <Blob m={green} p={[0, 1.13, 0.118 * w]} r={[0.03, 0.03, 0.006]} />
          </group>
        ),
      }
    }
    default:
      return { top: solid, sleeve: solid, forearm: null, thigh: mat('#3d64a8'), shin: mat('#3d64a8'), shoe: { color: '#f4f4f4', kind: 'sneaker' } }
  }
}

/* ---------- Face ---------- */

function Face({ l, femme, skin }: { l: Required<Look>; femme: boolean; skin: THREE.Material }) {
  const [rx, ry, rz] = HEAD
  const shade = mat(tint(l.skin, -0.14))
  const lash = flat('#1a0f0a')
  const lip = mat(tint(l.skin, femme ? -0.35 : -0.28).replace(/^#(..)/, (_, r) => `#${Math.min(255, parseInt(r, 16) + 30).toString(16).padStart(2, '0')}`))
  const brow = mat(tint(l.hairColor, -0.25))
  return (
    <group>
      {/* Skull, jaw, ears */}
      <Blob m={skin} p={[0, 0, 0]} r={[rx, ry, rz]} />
      <Blob m={skin} p={[0, -0.055, 0.012]} r={[rx * 0.86, ry * 0.62, rz * 0.88]} />
      {[-1, 1].map((s) => (
        <Blob key={s} m={shade} p={[s * rx * 0.98, -0.01, -0.005]} r={[0.016, 0.03, 0.022]} />
      ))}
      {/* Eyes: white, iris, pupil, a catch-light and a lash line */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.047, 0.0, rz * 0.88]}>
          <Blob m={flat('#fbfaf7')} p={[0, 0, 0]} r={[0.027, 0.031, 0.014]} />
          <Blob m={flat(l.eyes)} p={[0, -0.002, 0.008]} r={[0.0185, 0.021, 0.008]} />
          <Blob m={flat('#080605')} p={[0, -0.002, 0.012]} r={[0.0095, 0.011, 0.005]} />
          <Blob m={flat('#ffffff')} p={[0.006 * s, 0.008, 0.016]} r={[0.0055, 0.0055, 0.003]} />
          <Blob m={lash} p={[0, 0.026, 0.004]} r={[0.03, 0.006, 0.012]} rot={[0, 0, s * -0.06]} />
          {femme && <Blob m={lash} p={[s * 0.028, 0.03, 0.002]} r={[0.01, 0.004, 0.006]} rot={[0, 0, s * 0.6]} />}
          <Blob m={brow} p={[s * 0.002, 0.05, 0.004]} r={[0.026, 0.0065, 0.008]} rot={[0, 0, s * -0.14]} />
        </group>
      ))}
      {/* Nose and a smile */}
      <Blob m={shade} p={[0, -0.04, rz * 0.94]} r={[0.022, 0.017, 0.016]} />
      <mesh geometry={geo('smile', () => new THREE.TorusGeometry(0.026, 0.0055, 8, 20, Math.PI))} material={lip} position={[0, -0.068, rz * 0.9]} rotation={[0.25, 0, Math.PI]} />
      {femme && <Blob m={lip} p={[0, -0.078, rz * 0.875]} r={[0.02, 0.008, 0.008]} />}
      {femme && [-1, 1].map((s) => <Blob key={s} m={mat(tint(l.skin, 0.08).replace(/^#(..)/, (_, r) => `#${Math.min(255, parseInt(r, 16) + 25).toString(16).padStart(2, '0')}`))} p={[s * 0.07, -0.04, rz * 0.78]} r={[0.022, 0.014, 0.01]} />)}
      <Hair l={l} />
      <Beard l={l} />
      <HeadAccessory l={l} />
    </group>
  )
}

function Hair({ l }: { l: Required<Look> }) {
  const [rx, ry, rz] = HEAD
  const hair = mat(l.hairColor)
  const cap = (
    <mesh geometry={geo('haircap', () => new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.58))} material={hair} position={[0, 0.016, -0.008]} rotation={[-0.62, 0, 0]} scale={[rx * 1.06, ry * 1.06, rz * 1.06]} castShadow />
  )
  const strands = (n: number, r: number, len: number) =>
    [...Array(n)].map((_, i) => {
      const a = Math.PI + (i / (n - 1) - 0.5) * Math.PI * 1.15
      return <Part key={i} g={limb(r, r * 0.8, len)} m={hair} p={[Math.sin(a) * rx * 0.95, 0.02, Math.cos(a) * rz * 0.95 - 0.01]} r={[Math.cos(a) * -0.18, 0, Math.sin(a) * 0.18]} />
    })
  if (l.accessory === 'cap' && ['afro', 'bun', 'headwrap'].includes(l.hair)) return cap
  switch (l.hair) {
    case 'bald':
      return null
    case 'afro':
      return (
        <group>
          {cap}
          <mesh geometry={geo('afro', () => new THREE.IcosahedronGeometry(1, 3))} material={hair} position={[0, 0.07, -0.035]} scale={[rx * 1.55, ry * 1.32, rz * 1.42]} castShadow />
        </group>
      )
    case 'braids':
      return (
        <group>
          {cap}
          {strands(15, 0.011, 0.33)}
        </group>
      )
    case 'locks':
      return (
        <group>
          {cap}
          {strands(11, 0.018, 0.2)}
        </group>
      )
    case 'bun':
      return (
        <group>
          {cap}
          <Blob m={hair} p={[0, ry * 1.02, -rz * 0.35]} r={[0.062, 0.056, 0.062]} />
        </group>
      )
    case 'weave':
      return (
        <group>
          {cap}
          <mesh geometry={geo('weave', () => new THREE.CylinderGeometry(1.06, 1.25, 1, 32, 1, true, Math.PI * 0.4, Math.PI * 1.2))} material={mat(tint(l.hairColor, 0.05), { double: true })} position={[0, -0.12, -0.012]} scale={[rx, 0.3, rz]} castShadow />
          <Blob m={hair} p={[rx * 0.3, ry * 0.68, rz * 0.42]} r={[rx * 0.72, ry * 0.3, rz * 0.5]} rot={[0.25, 0, -0.35]} />
        </group>
      )
    case 'headwrap': {
      const wax = mat('#fff', { map: waxTexture(l.outfitColor, l.pattern) })
      return (
        <group position={[0, 0.03, -0.015]} rotation={[-0.3, 0, 0]}>
          <Part g={geo('wrap', () => new THREE.CylinderGeometry(1.25, 1.02, 1, 32))} m={wax} p={[0, ry * 0.55, 0]} s={[rx, ry * 0.95, rz]} />
          <Blob m={wax} p={[0, ry * 1.05, 0]} r={[rx * 1.25, ry * 0.4, rz * 1.25]} />
          <Blob m={wax} p={[rx * 0.3, ry * 1.28, rz * 0.6]} r={[rx * 0.55, ry * 0.36, rz * 0.3]} rot={[0, 0, 0.55]} />
          <Blob m={wax} p={[-rx * 0.38, ry * 1.22, rz * 0.66]} r={[rx * 0.46, ry * 0.32, rz * 0.26]} rot={[0, 0, -0.65]} />
        </group>
      )
    }
    default:
      return cap
  }
}

function Beard({ l }: { l: Required<Look> }) {
  const [, , rz] = HEAD
  const hair = mat(l.hairColor)
  const moustache = <Blob m={hair} p={[0, -0.055, rz * 0.94]} r={[0.03, 0.007, 0.01]} />
  switch (l.beard) {
    case 'moustache':
      return moustache
    case 'bouc':
      return (
        <group>
          {moustache}
          <Blob m={hair} p={[0, -0.11, rz * 0.66]} r={[0.026, 0.026, 0.02]} />
        </group>
      )
    case 'full':
      return (
        <group>
          {moustache}
          <mesh geometry={geo('beard', () => new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.42))} material={hair} position={[0, -0.05, 0.012]} scale={[HEAD[0] * 0.92, HEAD[1] * 0.68, HEAD[2] * 0.92]} castShadow />
        </group>
      )
    default:
      return null
  }
}

function HeadAccessory({ l }: { l: Required<Look> }) {
  const [rx, ry, rz] = HEAD
  const gold = mat('#e8b93c', { shine: true })
  switch (l.accessory) {
    case 'glasses': {
      const frame = flat('#17171a')
      return (
        <group position={[0, 0.0, rz * 0.98]}>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo('lens', () => new THREE.TorusGeometry(0.03, 0.004, 8, 24))} material={frame} position={[s * 0.047, 0, 0]} />
          ))}
          <Part g={geo('bridge', () => new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6))} m={frame} p={[0, 0.006, 0]} r={[0, 0, Math.PI / 2]} />
          {[-1, 1].map((s) => (
            <Part key={s} g={geo('temple', () => new THREE.CylinderGeometry(0.003, 0.003, 0.12, 6))} m={frame} p={[s * rx * 0.97, 0.005, -0.06]} r={[Math.PI / 2, 0, 0]} />
          ))}
        </group>
      )
    }
    case 'earrings':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo('hoop', () => new THREE.TorusGeometry(0.019, 0.003, 8, 24))} material={gold} position={[s * rx * 1.0, -0.055, 0]} rotation={[0, Math.PI / 2, 0]} />
          ))}
        </>
      )
    case 'cap': {
      const c = l.outfitColor === '#f4efe6' ? '#14213d' : l.outfitColor
      return (
        <group position={[0, 0.03, -0.004]} rotation={[-0.14, 0, 0]}>
          <mesh geometry={geo('capdome', () => new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5))} material={mat(c)} scale={[rx * 1.1, ry * 1.04, rz * 1.1]} castShadow />
          <Blob m={mat(tint(c, -0.25))} p={[0, 0.002, rz * 1.12]} r={[rx * 0.82, 0.008, rz * 0.62]} />
          <Blob m={mat(tint(c, -0.25))} p={[0, ry * 1.04, 0]} r={[0.012, 0.008, 0.012]} />
        </group>
      )
    }
    default:
      return null
  }
}

/* ---------- Feet ---------- */

function ShoeMesh({ shoe, skin }: { shoe: Shoe; skin: THREE.Material }) {
  const upper = mat(shoe.color)
  const sole = mat(shoe.kind === 'sneaker' ? '#ffffff' : '#2a1c12')
  if (shoe.kind === 'sandal')
    return (
      <group>
        <Blob m={skin} p={[0, 0.03, 0.035]} r={[0.042, 0.028, 0.085]} />
        <Blob m={sole} p={[0, 0.008, 0.035]} r={[0.05, 0.008, 0.1]} />
        <Blob m={upper} p={[0, 0.04, 0.06]} r={[0.046, 0.012, 0.022]} />
      </group>
    )
  return (
    <group>
      <Blob m={sole} p={[0, 0.012, 0.035]} r={[0.05, 0.012, 0.105]} />
      <Blob m={upper} p={[0, shoe.kind === 'heel' ? 0.05 : 0.038, 0.035]} r={[0.047, shoe.kind === 'boot' ? 0.05 : 0.036, 0.1]} />
      {shoe.kind === 'heel' && <Part g={limb(0.008, 0.006, 0.05)} m={sole} p={[0, 0.055, -0.045]} />}
      {shoe.kind === 'sneaker' && <Blob m={mat('#ff7a00')} p={[0.047, 0.04, 0.03]} r={[0.004, 0.015, 0.055]} />}
    </group>
  )
}

/* ---------- The whole Sim ---------- */

type Props = { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number }

export function Human({ look, gender, pose = 'idle', seed = 0 }: Props) {
  const l = fullLook(look)
  const femme = gender === 'femme'
  const { w, limb: lw, belly } = BODY[l.body] ?? BODY.moyen
  const skin = mat(l.skin)
  const d = useMemo(() => dressFor(l, femme), [l.outfit, l.outfitColor, l.pattern, femme]) // eslint-disable-line react-hooks/exhaustive-deps

  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const hip = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const knee = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const shoulder = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const elbow = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed
    const walk = pose === 'walk'
    const s = Math.sin(t * 8)
    for (const i of [0, 1]) {
      const out = i === 0 ? -1 : 1 // -1 = left side (-X)
      const swing = walk ? s * 0.5 * out : 0
      hip[i].current!.rotation.x = swing
      knee[i].current!.rotation.x = walk ? Math.max(0, Math.sin(t * 8 + (out > 0 ? Math.PI : 0))) * 0.8 : 0
      const sh = shoulder[i].current!
      const el = elbow[i].current!
      el.rotation.z = 0
      if (pose === 'busy') {
        sh.rotation.set(-1.1 + Math.sin(t * 6 + i) * 0.25, 0, out * 0.15)
        el.rotation.x = -0.9 + Math.sin(t * 6 + i) * 0.2
      } else if (pose === 'wave' && out > 0) {
        sh.rotation.set(0, 0, 2.6)
        el.rotation.x = 0
        el.rotation.z = 0.35 + Math.sin(t * 9) * 0.35
      } else if (pose === 'hero' && out > 0) {
        sh.rotation.set(0.15, 0, 0.6)
        el.rotation.x = -0.35
        el.rotation.z = -1.75
      } else {
        sh.rotation.set(walk ? -swing * 0.8 : Math.sin(t * 1.2 + i) * 0.03, 0, out * 0.08)
        el.rotation.x = walk ? -0.35 : -0.12
      }
    }
    root.current!.position.y = walk ? Math.abs(Math.cos(t * 8)) * 0.025 : pose === 'busy' ? Math.abs(Math.sin(t * 6)) * 0.02 : Math.sin(t * 1.6) * 0.003
    head.current!.rotation.y = walk ? 0 : Math.sin(t * 0.5) * 0.2
    head.current!.rotation.z = pose === 'wave' ? 0.08 : 0
    head.current!.rotation.x = pose === 'busy' ? 0.25 : Math.sin(t * 0.7) * 0.03
  })

  const hipX = 0.082 * w
  const shX = (femme ? 0.16 : 0.178) * w
  const thighR = 0.072 * lw * (femme ? 1.06 : 1)
  const skinOr = (m: THREE.Material | null) => m ?? skin

  return (
    <group scale={l.height}>
      <group ref={root}>
        {/* Torso, hips, skirt or robe */}
        {!d.robe && <Part g={torsoGeometry(femme, w, belly)} m={d.top} />}
        {!d.robe && <Part g={limb(0.15, 0.13, 0.08)} m={d.skirt ? d.top : skinOr(d.thigh)} p={[0, 0.94, 0]} s={[w, 1, 0.7 * w]} />}
        <Part g={limb(0.062 * lw, 0.062 * lw, shX * 2 - 0.12)} m={d.robe ?? d.top} p={[-(shX - 0.06), SHOULDER_Y + 0.01, 0]} r={[0, 0, Math.PI / 2]} s={[1, 1, 0.85]} />
        {d.robe && <Part g={flare(0.17 * w, 0.31 * w, 1.33, 0.06, 0.72)} m={d.robe} />}
        {d.skirt && <Part g={flare(0.16 * w, d.skirt.r * w, 1.0, d.skirt.hem)} m={d.skirt.m} />}
        {d.extra?.(w)}

        {/* Neck and head */}
        <Part g={limb(0.045, 0.05, 0.08)} m={skin} p={[0, 1.42, 0]} />
        {l.accessory === 'chain' && <mesh geometry={geo('chain', () => new THREE.TorusGeometry(0.068, 0.005, 6, 28))} material={mat('#e8b93c', { shine: true })} position={[0, 1.335, 0.035]} rotation={[1.15, 0, 0]} scale={[w, 1.1, 1]} />}
        <group ref={head} position={[0, HEAD_Y, 0.008]}>
          <Face l={l} femme={femme} skin={skin} />
        </group>

        {/* Legs: hip → knee → foot */}
        {[0, 1].map((i) => {
          const side = i === 0 ? -1 : 1
          return (
            <group key={i} ref={hip[i]} position={[side * hipX, HIP_Y, 0]}>
              <Part g={limb(thighR, 0.054 * lw, THIGH)} m={skinOr(d.thigh)} />
              <group ref={knee[i]} position={[0, -THIGH, 0]}>
                <Part g={limb(0.054 * lw, 0.04 * lw, SHIN - 0.04)} m={skinOr(d.shin)} />
                {l.outfit === 'jersey' && <Part g={limb(0.05 * lw, 0.045 * lw, 0.14)} m={mat('#009a44')} p={[0, -0.17, 0]} />}
                <group position={[0, -SHIN - 0.01, 0]}>
                  <ShoeMesh shoe={d.shoe} skin={skin} />
                </group>
              </group>
            </group>
          )
        })}

        {/* Arms: shoulder → elbow → hand */}
        {[0, 1].map((i) => {
          const side = i === 0 ? -1 : 1
          return (
            <group key={i} ref={shoulder[i]} position={[side * shX, SHOULDER_Y, 0]} rotation={[0, 0, side * 0.08]}>
              <Part g={limb(0.046 * lw, 0.04 * lw, UPPER_ARM)} m={skinOr(d.sleeve)} />
              {d.sleeve && !d.forearm && !d.bell && <Part g={limb(0.05 * lw, 0.047 * lw, UPPER_ARM * 0.45)} m={d.sleeve} />}
              {d.bell && <Part g={geo('bell1', () => new THREE.CylinderGeometry(0.06, 0.11, 1, 20, 1, true).translate(0, -0.5, 0))} m={d.sleeve!} s={[lw, UPPER_ARM + 0.02, lw]} />}
              <group ref={elbow[i]} position={[0, -UPPER_ARM, 0]}>
                <Part g={limb(0.04 * lw, 0.033 * lw, FOREARM)} m={skinOr(d.forearm)} />
                {d.bell && <Part g={geo('bell2', () => new THREE.CylinderGeometry(0.11, 0.17, 1, 20, 1, true).translate(0, -0.5, 0))} m={d.sleeve!} p={[0, 0.01, 0]} s={[lw, 0.16, lw]} />}
                {/* Mitten hand with a thumb */}
                <Blob m={skin} p={[0, -FOREARM - 0.05, 0.004]} r={[0.03, 0.048, 0.021]} />
                <Blob m={skin} p={[side * -0.022, -FOREARM - 0.035, 0.016]} r={[0.011, 0.024, 0.011]} rot={[0, 0, side * 0.4]} />
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}
