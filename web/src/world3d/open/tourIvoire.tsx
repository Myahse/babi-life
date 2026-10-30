import { useMemo } from 'react'
import * as THREE from 'three'
import { NoShadows } from '../../avatar/Human'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { BOX, lettering } from './ruePrincesse'
import { People, Stroller, type Staff } from './hotelBits'
import { t as tr } from '../../lib/i18n'

// The Tour Ivoire, on the service road of the boulevard Félix-Houphouët-
// Boigny (the old VGE) at the interchange, on the Koumassi side: sixteen
// levels (OpenStreetMap), as the photos show it from the boulevard and from
// the air. One slab, its length going back from the street, its end toward
// the street rounded: a half-round of blue mirror glass, its last four
// floors ringed with dark bands round their curved balconies. The slab's
// long side on the left is light grey with a dark panel down its middle and
// the gold IVOIRE emblem; the one on the right anthracite, a light band at
// each floor. Under it, wider, the dark podium of two floors with its
// louvres and its shops (the game's names), the forecourt where cars park.
// Next door, the store with its two red frames round its doors.
// Frame: +z the street, x along it.

/** The slab: half its width; from its back to where its rounded end starts (that end's middle). */
const SW = 11
const SZ = { back: -24, round: 2 }
/** The podium under it, wider: x from, to; z from, to (its front under the rounded end's). */
const POD = { x0: -19, x1: 15, z0: -24, z1: SZ.round + SW }
const FRONT = POD.z1
const PODIUM = 9 // the shops, then the louvred floor
const SHOPS = 5
const FLOOR = 3.5
const TOP = 58
const GLASS_TOP = TOP - 4 * FLOOR // the rounded end's glass, under its four ringed floors
const FLOORS = Math.round((TOP - PODIUM) / FLOOR)
/** The store next door, with its red frames. */
const STORE = { x: POD.x1 + 11, z: 3, w: 18, d: 14, h: 9 }
/** The half of a cylinder toward the street (three.js measures its angle from +z). */
const HALF: [number, number] = [-Math.PI / 2, Math.PI]

const dark = new THREE.MeshLambertMaterial({ color: '#3a3e44' })
const roof = new THREE.MeshLambertMaterial({ color: '#8c8f93' })
const red = new THREE.MeshLambertMaterial({ color: '#d7262e' })
const paving = new THREE.MeshLambertMaterial({ color: '#cfcac0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const kerb = new THREE.MeshLambertMaterial({ color: '#e8e4dc', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })

type Paint = (g: CanvasRenderingContext2D, night: boolean, lit: () => boolean) => void
/** A face painted on a canvas, by day and lit at night (the emissive map), its windows lit at random. */
function painted(w: number, h: number, seed: string, paint: Paint, linear = false) {
  const make = (night: boolean) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    const r = rng(seed)
    paint(g, night, () => r() < 0.34)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    return t
  }
  return new THREE.MeshLambertMaterial({ map: make(false), emissiveMap: make(true), emissive: '#ffd994', emissiveIntensity: 0 })
}

const PX = 16 // canvas pixels a floor

/** The slab's long faces: anthracite, a light band at each floor over the strip of windows; toward the street a dark recess down the middle. */
const slabLong = (bays: number, seed: string, recess: boolean) =>
  painted(bays * PX, FLOORS * PX, seed, (g, night, lit) => {
    g.fillStyle = night ? '#000' : '#3b3f45'
    g.fillRect(0, 0, bays * PX, FLOORS * PX)
    for (let f = 0; f < FLOORS; f++) {
      const y = f * PX
      if (!night) {
        g.fillStyle = '#767b83'
        g.fillRect(0, y, bays * PX, 5)
      }
      for (let b = 0; b < bays; b++) {
        const mid = recess && Math.abs(b - (bays - 1) / 2) < 0.6
        g.fillStyle = night ? (lit() && !mid ? '#fff1cc' : '#000') : mid ? '#24272b' : '#24323d'
        g.fillRect(b * PX + 1, y + 6, PX - 2, 9)
      }
    }
  })

/** The slab's ends: light grey, small windows in the sides, a dark panel down the middle with its strips of windows. */
const slabEnd = (bays: number, seed: string) =>
  painted(bays * PX, FLOORS * PX, seed, (g, night, lit) => {
    const w = bays * PX
    g.fillStyle = night ? '#000' : '#d7d8d9'
    g.fillRect(0, 0, w, FLOORS * PX)
    const [p0, p1] = [Math.round(w * 0.28), Math.round(w * 0.72)]
    if (!night) {
      g.fillStyle = '#4a4f57'
      g.fillRect(p0, 0, p1 - p0, FLOORS * PX)
    }
    for (let f = 0; f < FLOORS; f++) {
      const y = f * PX
      for (const x of [Math.round(w * 0.08), Math.round(w * 0.17), Math.round(w * 0.79), Math.round(w * 0.88)]) {
        g.fillStyle = night ? (lit() ? '#fff1cc' : '#000') : '#2c3640'
        g.fillRect(x, y + 5, 5, 8)
      }
      for (let x = p0 + 3; x < p1 - 6; x += 9) {
        g.fillStyle = night ? (lit() ? '#fff1cc' : '#000') : '#26313b'
        g.fillRect(x, y + 6, 6, 7)
      }
    }
  })

/** The rounded end's mirror glass: the sky in it, lighter up high, its mullions and floor lines; at night some offices lit. */
const roundGlass = painted(256, 10 * PX * 2, 'tour-ivoire-glass', (g, night, lit) => {
  const h = 10 * PX * 2
  if (night) {
    g.fillStyle = '#000'
    g.fillRect(0, 0, 256, h)
    for (let f = 0; f < 10; f++) for (let c = 0; c < 32; c++) if (lit()) (g.fillStyle = c % 5 ? '#fff1cc' : '#cfe8ff'), g.fillRect(c * 8 + 1, f * 32 + 4, 6, 24)
    return
  }
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#c4dbee')
  grad.addColorStop(0.35, '#8fb3d6')
  grad.addColorStop(1, '#3f6f9c')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, h)
  // The clouds and the light caught in it, in long streaks.
  g.fillStyle = 'rgba(255,255,255,0.18)'
  for (const [x, y, ww] of [[20, 40, 60], [140, 90, 80], [60, 200, 50], [190, 250, 40]]) g.fillRect(x, y, ww, 10)
  g.fillStyle = 'rgba(40,70,100,0.45)'
  for (let x = 0; x < 256; x += 8) g.fillRect(x, 0, 1, h)
  for (let y = 0; y < h; y += 32) g.fillRect(0, y, 256, 2)
}, true)
roundGlass.map!.repeat.set(1.5, 1)
roundGlass.emissiveMap!.repeat.set(1.5, 1)
/** The glass of the ringed floors, darker, set back behind the curved balconies and their rings. */
const ringGlass = new THREE.MeshLambertMaterial({ color: '#5f7f9b', emissive: '#ffd994', emissiveIntensity: 0 })

/** The podium's louvres: dark slats over the first floor all round. */
const louvres = (() => {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const g = c.getContext('2d')!
  g.fillStyle = '#2e3237'
  g.fillRect(0, 0, 16, 16)
  g.fillStyle = '#5a5f66'
  for (let y = 1; y < 16; y += 4) g.fillRect(0, y, 16, 1)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const louvreMat = (w: number) => {
  const t = louvres.clone()
  t.repeat.set(w / 2, (PODIUM - SHOPS) / 1.2)
  t.needsUpdate = true
  return new THREE.MeshLambertMaterial({ map: t })
}
const shopGlass = new THREE.MeshLambertMaterial({ color: '#1f2a33', emissive: '#ffe6b0', emissiveIntensity: 0 })

/** A sign, its letters lit at night. */
function Sign({ text, bg, ink, p, h, r = 0 }: { text: string; bg: string; ink: string; p: [number, number, number]; h: number; r?: number }) {
  const s = useMemo(() => lettering(text, bg, ink, bg), [text, bg, ink])
  return (
    <mesh position={p} rotation={[0, r, 0]}>
      <planeGeometry args={[s.aspect * h, h]} />
      <meshBasicMaterial map={s.t} toneMapped={false} />
    </mesh>
  )
}

/** The slab's rounded end: its mirror glass up to the ringed floors, the dark rings round the curved balconies, the cap. */
function RoundedEnd({ night }: { night: boolean }) {
  roundGlass.emissiveIntensity = night ? 0.9 : 0
  ringGlass.emissiveIntensity = night ? 0.35 : 0
  return (
    <group position={[0, 0, SZ.round]}>
      <mesh material={dark} position={[0, PODIUM + 0.3, 0]}>
        <cylinderGeometry args={[SW + 0.3, SW + 0.3, 0.6, 32, 1, false, ...HALF]} />
      </mesh>
      <mesh material={roundGlass} position={[0, (PODIUM + GLASS_TOP) / 2, 0]}>
        <cylinderGeometry args={[SW, SW, GLASS_TOP - PODIUM, 32, 1, true, ...HALF]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <group key={k} position={[0, GLASS_TOP + k * FLOOR, 0]}>
          <mesh material={dark} position={[0, 0.4, 0]}>
            <cylinderGeometry args={[SW + 0.5, SW + 0.5, 0.8, 32, 1, false, ...HALF]} />
          </mesh>
          <mesh material={ringGlass} position={[0, 0.8 + (FLOOR - 0.8) / 2, 0]}>
            <cylinderGeometry args={[SW - 0.6, SW - 0.6, FLOOR - 0.8, 32, 1, true, ...HALF]} />
          </mesh>
        </group>
      ))}
      {/* The roof over the last floor, a little wider */}
      <mesh material={dark} position={[0, TOP + 0.35, 0]}>
        <cylinderGeometry args={[SW + 0.8, SW + 0.8, 0.7, 32, 1, false, ...HALF]} />
      </mesh>
    </group>
  )
}

/** The slab behind its rounded end: its long sides (light grey on the left, anthracite on the right), the emblem, its roof. */
function Slab({ night }: { night: boolean }) {
  const d = SZ.round - SZ.back
  const mats = useMemo(() => {
    const right = slabLong(Math.round(d / 2.2), 'tour-ivoire-right', false)
    const left = slabEnd(Math.round(d / 2), 'tour-ivoire-left')
    const back = slabLong(Math.round((2 * SW) / 2.2), 'tour-ivoire-back', false)
    // BoxGeometry's faces: +x, -x, +y, -y, +z (behind the rounded end), -z.
    return [right, left, roof, roof, dark, back]
  }, [d])
  mats.forEach((m) => m !== roof && m !== dark && ((m as THREE.MeshLambertMaterial).emissiveIntensity = night ? 1 : 0))
  const cz = (SZ.back + SZ.round) / 2
  return (
    <group>
      <mesh geometry={BOX} material={mats} position={[0, (PODIUM + TOP) / 2, cz]} scale={[2 * SW, TOP - PODIUM, d]} />
      <mesh geometry={BOX} material={dark} position={[0, TOP + 0.35, cz]} scale={[2 * SW + 0.4, 0.7, d + 0.4]} />
      {/* The air conditioners and the lift's room on the roof */}
      <mesh geometry={BOX} material={roof} position={[-4, TOP + 1.8, cz - 4]} scale={[6, 2.6, 5]} />
      {[[3, -2], [6, -2], [3, 2], [6, 2]].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={BOX} material={roof} position={[x, TOP + 1.1, SZ.round + z - 4]} scale={[1.8, 1.2, 1.4]} />
      ))}
      {/* The emblem: up the dark panel of the light grey side, and high on the anthracite one near the street */}
      <Sign text={tr('IVOIRE')} bg="#4a4f57" ink="#d9b45a" p={[-SW - 0.05, TOP - 12, cz]} h={1.1} r={-Math.PI / 2} />
      <Sign text={tr('IVOIRE')} bg="#3b3f45" ink="#d9b45a" p={[SW + 0.05, TOP - 9, SZ.round - 4]} h={1.1} r={Math.PI / 2} />
    </group>
  )
}

/** The podium: two dark floors, the louvres over the shops, the shop windows lit in the evening, their signs (the game's names). */
function Podium({ night }: { night: boolean }) {
  shopGlass.emissiveIntensity = night ? 0.6 : 0.05
  const [w, d] = [POD.x1 - POD.x0, POD.z1 - POD.z0]
  const [cx, cz] = [(POD.x0 + POD.x1) / 2, (POD.z0 + POD.z1) / 2]
  const mats = useMemo(() => {
    const long = louvreMat(w)
    const short = louvreMat(d)
    return [short, short, roof, roof, long, long]
  }, [w, d])
  return (
    <group>
      <mesh geometry={BOX} material={dark} position={[cx, SHOPS / 2, cz]} scale={[w - 0.6, SHOPS, d - 0.6]} />
      <mesh geometry={BOX} material={mats} position={[cx, (SHOPS + PODIUM) / 2, cz]} scale={[w, PODIUM - SHOPS, d]} />
      {/* The shop windows along the street, and the band over them */}
      <mesh geometry={BOX} material={shopGlass} position={[cx, SHOPS / 2 - 0.2, FRONT - 0.25]} scale={[w - 2, SHOPS - 1, 0.1]} />
      <mesh geometry={BOX} material={dark} position={[cx, SHOPS - 0.35, FRONT]} scale={[w, 0.7, 0.4]} />
      <Sign text={tr('BABI MODE')} bg="#2e3237" ink="#ffffff" p={[-12, SHOPS + 1.8, FRONT + 0.05]} h={1.4} />
      <Sign text={tr('SORTIE')} bg="#1b1d21" ink="#ffffff" p={[6, SHOPS - 1.2, FRONT + 0.06]} h={0.6} />
      <Sign text={tr('PHARMA+')} bg="#d7262e" ink="#ffffff" p={[-2, SHOPS - 1.2, FRONT + 0.06]} h={0.6} />
      {/* The tall totem at the corner of the forecourt, red at its top */}
      <group position={[11, 0, FRONT + 2.2]}>
        <mesh geometry={BOX} material={dark} position={[0, 6, 0]} scale={[1.6, 12, 0.8]} />
        <mesh geometry={BOX} material={red} position={[0, 11, 0.05]} scale={[1.7, 1.6, 0.85]} />
        <Sign text={tr('TOUR IVOIRE')} bg="#1b1d21" ink="#ffffff" p={[0, 8.8, 0.42]} h={0.32} />
      </group>
    </group>
  )
}

/** Next door: the store with two red frames standing out round its doors, ENTRÉE between them. */
function RedStore({ night }: { night: boolean }) {
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#1f2a33', emissive: '#ffe6b0', emissiveIntensity: 0 }), [])
  glass.emissiveIntensity = night ? 0.7 : 0.05
  const front = STORE.d / 2
  return (
    <group position={[STORE.x, 0, STORE.z]}>
      <mesh geometry={BOX} material={dark} position={[0, STORE.h / 2, 0]} scale={[STORE.w, STORE.h, STORE.d]} />
      <mesh geometry={BOX} material={glass} position={[0, 2.2, front + 0.02]} scale={[STORE.w - 1, 3.6, 0.1]} />
      <mesh geometry={BOX} material={glass} position={[0, 6.6, front + 0.02]} scale={[STORE.w - 1, 2.4, 0.1]} />
      {[-4.2, 3.2].map((x) => (
        <group key={x} position={[x, 0, front + 0.7]}>
          {/* A red frame: two posts and its lintel, standing out from the front */}
          {[-1.6, 1.6].map((dx) => (
            <mesh key={dx} geometry={BOX} material={red} position={[dx, 4.3, 0]} scale={[0.7, 8.6, 1.4]} />
          ))}
          <mesh geometry={BOX} material={red} position={[0, 8.6, 0]} scale={[3.9, 0.9, 1.4]} />
          <mesh geometry={BOX} material={glass} position={[0, 4.2, -0.4]} scale={[2.5, 8, 0.1]} />
        </group>
      ))}
      <Sign text={tr('BABI FER')} bg="#d7262e" ink="#ffffff" p={[-0.5, 8.2, front + 0.08]} h={0.9} />
      <Sign text={tr('ENTRÉE')} bg="#1b1d21" ink="#ffffff" p={[-0.5, 3.6, front + 0.1]} h={0.55} />
    </group>
  )
}

export function TourIvoire({ night }: { night: boolean }) {
  const people = useMemo<Staff[]>(
    () => [
      { p: [4.5, 0, FRONT + 1.6], r: 0.2, who: 'vigile' },
      { p: [-10, 0, FRONT + 3.2], r: -2.6, who: 'client', pose: 'phone' },
      { p: [-8.9, 0, FRONT + 2.6], r: -0.6, who: 'client', pose: 'talk' },
      { p: [STORE.x - 1, 0, STORE.z + STORE.d / 2 + 2.6], r: 2.8, who: 'client', pose: 'talk' },
    ],
    [],
  )
  const cars = useMemo(() => {
    const r = rng('tour-ivoire-cars')
    return [-17, -13, -9, 14, 18].map((x, i) => ({ x, seed: i + Math.floor(r() * 50) }))
  }, [])
  const [x0, x1] = [POD.x0 - 3, STORE.x + STORE.w / 2 + 2]
  return (
    <group>
      {/* The forecourt where cars park, along the service road, its kerb */}
      <mesh geometry={BOX} material={paving} position={[(x0 + x1) / 2, 0.03, FRONT + 4]} scale={[x1 - x0, 0.06, 8]} />
      <mesh geometry={BOX} material={kerb} position={[(x0 + x1) / 2, 0.08, FRONT + 8.1]} scale={[x1 - x0, 0.16, 0.3]} />
      <Podium night={night} />
      <RoundedEnd night={night} />
      <Slab night={night} />
      <RedStore night={night} />
      {/* Cars parked nose in on the forecourt, a taxi waiting */}
      {cars.map((c) => (
        <Vehicle key={c.x} p={[c.x, 0, FRONT + 5]} r={Math.PI / 2} kind="car" seed={c.seed} crew={false} />
      ))}
      <Vehicle p={[1, 0, FRONT + 6.4]} r={0} kind="taxi" seed={4} crew={false} />
      {night && <pointLight position={[0, 4, FRONT + 4]} intensity={25} distance={22} color="#ffe2b0" />}
      <NoShadows>
        <People at={people} seed="tour-ivoire" />
        {!night && <Stroller from={[-16, FRONT + 2]} to={[2, FRONT + 2.4]} seed="tour-ivoire-a" />}
        {!night && <Stroller from={[8, FRONT + 2.2]} to={[STORE.x, STORE.z + STORE.d / 2 + 2]} seed="tour-ivoire-b" bag />}
      </NoShadows>
    </group>
  )
}

/** What stands in the way: the podium under the tower, the store next door, the totem. */
export const TOUR_IVOIRE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: (POD.x0 + POD.x1) / 2, z: (POD.z0 + POD.z1) / 2, hw: (POD.x1 - POD.x0) / 2 + 0.3, hd: (POD.z1 - POD.z0) / 2 + 0.3, rot: 0, top: PODIUM },
  { x: STORE.x, z: STORE.z, hw: STORE.w / 2 + 0.3, hd: STORE.d / 2 + 1.2, rot: 0, top: STORE.h },
  { x: 11, z: FRONT + 2.2, r: 1 },
]
