import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { BOX, Blocks } from './ruePrincesse'
import { People, Stroller, type Staff } from './hotelBits'
import { CarPark, LampPost, Trolleys, cladding, marketSign } from './playce'
import { Palm } from './noum'

// PlaYce Marcory (boulevard Valéry Giscard d'Estaing), as the photos of the
// real one show it: tall boxes in cream panels, joints running across them;
// the hypermarket on the left (the game's Babi Market) with a brown louvred
// panel; in the middle, rising over them, the great frame of the entrance in
// dark grey ribbed cladding, the PLAYCE letters on it in orange, pink, blue,
// green, pink and orange, MARCORY in cream under them, the shops' signs on
// its pillars; under it, the glass doors and a bronze canopy stepping out in
// three slats; on the right the gallery's box with its blue stripe. In front
// the car park (510 places), its lamp posts, palms along the boulevard.
// Sizes are the game's estimates. Frame: +z toward the street.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The boxes, left to right: x from, x to, height, depth back from the front (z 0). */
const MARKET = { x0: -46, x1: -8, h: 11, d: 34 }
const CORE = { x0: -8, x1: 12, h: 15, d: 30 }
const GALLERY = { x0: 12, x1: 46, h: 12.5, d: 30 }
const BOXES = [MARKET, CORE, GALLERY]
/** The entrance's frame: its pillars' x, how high, how far it stands out. */
const FRAME = { x0: -5, x1: 10, h: 18, out: 3 }
const PARK = { x0: -48, x1: 48, z0: 1, z1: 34 }

const COLORED = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const glassDay = '#7e9fb4'

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}
const tex = (c: HTMLCanvasElement, nearest = true) => {
  const t = new THREE.CanvasTexture(c)
  if (nearest) t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The frame's dark grey cladding: long horizontal ribs. */
function ribbed(w: number, h: number) {
  const [c, g] = canvas(16, 32)
  g.fillStyle = '#3a3d42'
  g.fillRect(0, 0, 16, 32)
  g.fillStyle = '#2c2e32'
  for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 16, 1)
  g.fillStyle = '#474a50'
  for (let y = 2; y < 32; y += 4) g.fillRect(0, y, 16, 1)
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(w / 4, h / 4)
  return new THREE.MeshLambertMaterial({ map: t })
}

/** The PLAYCE letters, each its colour, MARCORY in cream under them, on nothing: the ribs show behind. */
function letters(night: boolean) {
  const [c, g] = canvas(1024, 320)
  g.textBaseline = 'alphabetic'
  g.textAlign = 'center'
  g.font = '900 190px sans-serif'
  const cols = ['#f28c28', '#e8457a', '#2f8fd8', '#7cc242', '#e8457a', '#f28c28']
  // Each letter a little lower than the one before: they run down the beam as on the real one.
  ;[...'PLAYCE'].forEach((l, i) => {
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.fillText(l, 118 + i * 158 + 6, 200 + i * 6 + 6)
    g.fillStyle = cols[i]
    g.fillText(l, 118 + i * 158, 200 + i * 6)
  })
  g.fillStyle = '#efe4cc'
  g.font = '800 54px serif'
  g.fillText('M A R C O R Y', 380, 290)
  const t = tex(c, false)
  return new THREE.MeshLambertMaterial({ map: t, transparent: true, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: night ? 0.75 : 0.1 })
}

/** A shop's sign on the frame's pillars, white on dark, the game's own names. */
function shopSign(text: string, bg: string, fg: string) {
  const [c, g] = canvas(256, 96)
  g.fillStyle = bg
  g.fillRect(0, 0, 256, 96)
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 34px sans-serif'
  g.fillText(text, 128, 50)
  return new THREE.MeshLambertMaterial({ map: tex(c, false) })
}

/** Who's about: the guard at the doors, people waiting by the pillars, a family coming out. */
const MARCORY_PEOPLE: Staff[] = [
  { p: [1, 0, 4.5], who: 'vigile' },
  { p: [-3, 0, 5], r: 0.4, pose: 'phone' },
  { p: [8, 0, 5.4], r: -0.3, pose: 'talk' },
  { p: [9, 0, 6.2], r: -2.8, pose: 'talk' },
  { p: [-30, 0, 2.6], r: 0.2, pose: 'idle' },
]

export function PlayceMarcory({ night }: { night: boolean }) {
  const mats = useMemo(
    () => ({
      boxes: BOXES.map((b) => cladding(b.x1 - b.x0, b.h, 'cream')),
      frame: ribbed(FRAME.x1 - FRAME.x0, FRAME.h),
      letters: letters(night),
      market: marketSign(night),
      signs: [shopSign('MODE WAX', '#2b2e33', '#ffffff'), shopSign('BURGER 225', '#2b2e33', '#ffb347'), shopSign('PHONE 225', '#2b2e33', '#7cc8ff')],
      glass: new THREE.MeshLambertMaterial({ color: night ? '#ffe2a8' : glassDay, emissive: '#ffd590', emissiveIntensity: night ? 0.85 : 0 }),
      bronze: new THREE.MeshLambertMaterial({ color: '#9a5f3a' }),
    }),
    [night],
  )
  // The brown louvres on the hypermarket, the blue stripe up the gallery, the parapets' caps.
  const trims = useMemo<Block[]>(() => {
    const out: Block[] = []
    for (let x = -14; x <= -10; x += 0.5) out.push({ p: [x, 6, 0.15], s: [0.22, 8, 0.3], c: '#6e3f24' })
    out.push({ p: [16.5, GALLERY.h / 2, 0.08], s: [1, GALLERY.h - 0.6, 0.12], c: '#1f5fbf' })
    for (const b of BOXES) out.push({ p: [(b.x0 + b.x1) / 2, b.h + 0.15, -b.d / 2], s: [b.x1 - b.x0 + 0.1, 0.3, b.d + 0.1], c: '#c9bda6' })
    return out
  }, [])
  const fw = FRAME.x1 - FRAME.x0
  const fx = (FRAME.x0 + FRAME.x1) / 2
  return (
    <group>
      <CarPark park={PARK} walkX={fx} front={[-26, 40]} arrows={[{ p: [24, 14.3], r: 0 }, { p: [-30, 10.7], r: Math.PI }, { p: [30, 26.3], r: 0 }, { p: [-16, 22.7], r: Math.PI }]} />
      {/* The boxes in their cream panels */}
      {BOXES.map((b, i) => (
        <mesh key={i} geometry={BOX} position={[(b.x0 + b.x1) / 2, b.h / 2, -b.d / 2]} scale={[b.x1 - b.x0, b.h, b.d]} material={mats.boxes[i]} castShadow receiveShadow />
      ))}
      <Blocks at={trims} material={COLORED} color />
      <mesh position={[-28, MARKET.h - 2.4, 0.12]} material={mats.market}>
        <planeGeometry args={[14, 3.5]} />
      </mesh>
      {/* The great frame of the entrance: its two pillars, its beam over them with the letters */}
      {[FRAME.x0 + 1, FRAME.x1 - 1].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, FRAME.h / 2, FRAME.out / 2 - 0.5]} scale={[2, FRAME.h, FRAME.out + 1]} material={mats.frame} castShadow />
      ))}
      <mesh geometry={BOX} position={[fx, FRAME.h - 2.6, FRAME.out / 2 - 0.5]} scale={[fw, 5.2, FRAME.out + 1]} material={mats.frame} castShadow />
      <mesh position={[fx, FRAME.h - 2.6, FRAME.out + 0.02]} material={mats.letters}>
        <planeGeometry args={[fw - 1, 4.6]} />
      </mesh>
      {/* The shops' signs down the pillars */}
      {mats.signs.map((m, i) => (
        <mesh key={i} position={[i === 2 ? FRAME.x1 - 1 : FRAME.x0 + 1, 10 - (i % 2) * 2.6, FRAME.out + 0.02]} material={m}>
          <planeGeometry args={[1.8, 0.7]} />
        </mesh>
      ))}
      {/* Under it: the glass front of the hall, its doors, the bronze canopy stepping out */}
      <mesh position={[fx, 6, 0.08]} material={mats.glass}>
        <planeGeometry args={[fw - 4, 11.5]} />
      </mesh>
      <Blocks at={[...[-2, 2, 6].map((x): Block => ({ p: [x, 6, 0.14], s: [0.12, 11.5, 0.06], c: '#2b2e33' })), { p: [fx, 3.4, 0.14], s: [fw - 4, 0.15, 0.06], c: '#2b2e33' }]} material={COLORED} color />
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={BOX} position={[fx + 1.5, 4.6 + k * 0.45, 1.4 + k * 0.7]} scale={[fw - 6 - k * 1.2, 0.3, 2.8 - k * 0.7]} material={mats.bronze} castShadow />
      ))}
      {/* The gallery's own door, smaller, on the right */}
      <mesh position={[34, 2.4, 0.08]} material={mats.glass}>
        <planeGeometry args={[6, 4.4]} />
      </mesh>
      <mesh geometry={BOX} position={[34, 4.9, 1.4]} scale={[8, 0.3, 2.8]} material={mats.bronze} />
      {night && <pointLight position={[fx, 5, 6]} intensity={35} distance={24} color="#ffe2b0" />}
      {/* The lamp posts, the palms along the boulevard */}
      {[[-34, 12.5], [-10, 12.5], [14, 12.5], [38, 12.5], [-34, 24.5], [-10, 24.5], [14, 24.5], [38, 24.5]].map(([x, z]) => (
        <LampPost key={`${x},${z}`} x={x} z={z} night={night} />
      ))}
      {[-44, -30, -16, 16, 30, 44].map((x) => (
        <Palm key={x} x={x} z={PARK.z1 - 1} h={7} />
      ))}
      <Trolleys x={-22} z={2.6} />
      <Vehicle p={[-20, 0, 8.6]} r={0} kind="car" seed={4} color="#f1f3f5" />
      <Vehicle p={[-12.2, 0, 8.6]} r={0} kind="car" seed={9} color="#212529" />
      <Vehicle p={[22, 0, 16.4]} r={Math.PI} kind="car" seed={13} color="#c92a2a" />
      <Vehicle p={[33, 0, 20.6]} r={0} kind="car" seed={18} color="#adb5bd" />
      <Vehicle p={[-38, 0, 28]} r={Math.PI} kind="car" seed={22} color="#f8f9fa" />
      <People at={MARCORY_PEOPLE} seed="playce-marcory" />
      <Stroller from={[fx, 32]} to={[fx, 5]} seed="pm-a" />
      <Stroller from={[-24, 4]} to={[30, 4]} seed="pm-b" speed={1} />
      <Stroller from={[-30, 30]} to={[-6, 6]} seed="pm-c" speed={1.1} bag />
    </group>
  )
}

/** What one can't walk through: the boxes, the frame's pillars, the trolleys' shelter. */
export const PLAYCE_MARCORY_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  ...BOXES.map((b) => ({ x: (b.x0 + b.x1) / 2, z: -b.d / 2, hw: (b.x1 - b.x0) / 2 + 0.3, hd: b.d / 2 + 0.3, rot: 0, top: b.h })),
  ...[FRAME.x0 + 1, FRAME.x1 - 1].map((x) => ({ x, z: FRAME.out / 2 - 0.5, hw: 1.2, hd: (FRAME.out + 1) / 2 + 0.2, rot: 0, top: FRAME.h })),
  { x: -22, z: 2.6, hw: 2.3, hd: 0.9, rot: 0, top: 2.4 },
]
