import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NoShadows } from '../../avatar/Human'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { BOX, Blocks, lettering } from './ruePrincesse'
import { People, Stroller, type Staff } from './hotelBits'

// The Tour Ivoire, on the service road of the boulevard Félix-Houphouët-
// Boigny (the old VGE) at the interchange, on the Koumassi side: a slab of
// sixteen levels on a foot of about 47 × 24 m (OpenStreetMap). No published
// description was found, so its look is the game's: a concrete frame, its
// bays of blue-green glass between white piers, the glazed lobby under a
// canopy, the name lit on the roof, a red light on the mast for the planes
// going down to Port-Bouët. At night the offices are lit here and there.
// Frame: +z the street, x along the long side.

const W = 23.5 // half the long side
const D = 11.8 // half the short side
const LOBBY = 4.6 // the ground floor
const FLOOR = 3.4
const LEVELS = 15 // above the lobby
const H = LOBBY + LEVELS * FLOOR
const [BAYS_X, BAYS_Z] = [16, 8]

const frame = new THREE.MeshLambertMaterial({ color: '#ece7dc' })
const roof = new THREE.MeshLambertMaterial({ color: '#9a9690' })
const pier = new THREE.MeshLambertMaterial({ color: '#f7f4ee' })
const lobbyGlass = new THREE.MeshLambertMaterial({ color: '#29414d', emissive: '#ffe1a8', emissiveIntensity: 0 })
const steel = new THREE.MeshLambertMaterial({ color: '#7d848c' })
const paving = new THREE.MeshLambertMaterial({ color: '#cfcac0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4f9a42', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const beacon = new THREE.MeshBasicMaterial({ color: '#ff2a2a' })

/** A face of the tower: a bay of glass in each frame of the grid, the offices lit at random at night (each face its own). */
function face(bays: number, seed: string) {
  const make = (night: boolean) => {
    const c = document.createElement('canvas')
    const [cw, ch] = [8, 8]
    c.width = bays * cw
    c.height = LEVELS * ch
    const g = c.getContext('2d')!
    g.fillStyle = night ? '#000' : '#ece7dc'
    g.fillRect(0, 0, c.width, c.height)
    const r = rng(seed)
    for (let i = 0; i < bays; i++)
      for (let j = 0; j < LEVELS; j++) {
        // By day the glass, darker or lighter as it catches the sky; at night a third of the offices lit, whole floors now and then.
        const lit = r() < 0.32 || (j % 5 === 2 && r() < 0.6)
        g.fillStyle = night ? (lit ? (r() < 0.2 ? '#cfe8ff' : '#fff1cc') : '#000') : r() < 0.15 ? '#5f8f9c' : '#3c6c7a'
        g.fillRect(i * cw + 1, j * ch + 1, cw - 2, ch - 3)
      }
    const t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return new THREE.MeshLambertMaterial({ map: make(false), emissiveMap: make(true), emissive: '#ffd994', emissiveIntensity: 0 })
}

/** The white piers up the long faces, every four bays, and at the corners. */
const PIERS = (() => {
  const out: { p: [number, number, number]; s: [number, number, number] }[] = []
  const top = H + 1.2
  for (let k = 0; k <= BAYS_X; k += 4) {
    const x = -W + (k / BAYS_X) * W * 2
    for (const z of [-1, 1]) out.push({ p: [x, LOBBY + (top - LOBBY) / 2, z * (D + 0.25)], s: [0.7, top - LOBBY, 0.5] })
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) out.push({ p: [x * (W + 0.2), top / 2, z * (D + 0.2)], s: [0.6, top, 0.6] })
  return out
})()

/** Floor slabs showing on the lobby's level: the first floor's edge over the glass. */
const EDGES = [
  { p: [0, LOBBY + 0.15, D + 0.35] as [number, number, number], s: [W * 2 + 0.8, 0.3, 0.7] as [number, number, number] },
  { p: [0, LOBBY + 0.15, -D - 0.35] as [number, number, number], s: [W * 2 + 0.8, 0.3, 0.7] as [number, number, number] },
]

export function TourIvoire({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const long = face(BAYS_X, 'tour-ivoire-front')
    const back = face(BAYS_X, 'tour-ivoire-back')
    const sideA = face(BAYS_Z, 'tour-ivoire-east')
    const sideB = face(BAYS_Z, 'tour-ivoire-west')
    // BoxGeometry's faces: +x, -x, +y, -y, +z, -z.
    return [sideA, sideB, roof, roof, long, back]
  }, [])
  mats.forEach((m) => {
    if (m !== roof) (m as THREE.MeshLambertMaterial).emissiveIntensity = night ? 1 : 0
  })
  lobbyGlass.emissiveIntensity = night ? 0.8 : 0
  const sign = useMemo(() => {
    return lettering('TOUR IVOIRE', '#0f2f3a', '#ffffff', '#f28c28').t
  }, [])
  // The red light on the mast: on, off, on.
  const light = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (light.current) light.current.visible = (worldTime() % 1.6) < 0.8
  })
  const people = useMemo<Staff[]>(
    () => [
      { p: [-2.4, 0, D + 3.4], r: 0.2, who: 'vigile' },
      { p: [6, 0, D + 5.5], r: -2.6, who: 'client', pose: 'phone' },
      { p: [7.1, 0, D + 4.8], r: -0.6, who: 'client', pose: 'talk' },
      { p: [-12, 0, D + 6], r: 2.8, who: 'client', pose: 'talk' },
    ],
    [],
  )
  return (
    <group>
      {/* The forecourt and its strip of lawn along the road */}
      <mesh geometry={BOX} material={paving} position={[0, 0.03, D + 5]} scale={[W * 2 + 8, 0.06, 10]} />
      <mesh geometry={BOX} material={lawn} position={[0, 0.05, D + 10.4]} scale={[W * 2 + 8, 0.08, 1.2]} />
      {/* The lobby: glass all round, set back under the first floor */}
      <mesh geometry={BOX} material={lobbyGlass} position={[0, LOBBY / 2, 0]} scale={[W * 2 - 1.2, LOBBY, D * 2 - 1.2]} />
      {/* The tower over it */}
      <mesh geometry={BOX} material={mats} position={[0, LOBBY + (H - LOBBY) / 2, 0]} scale={[W * 2, H - LOBBY, D * 2]} />
      <Blocks at={PIERS} material={pier} />
      <Blocks at={EDGES} material={frame} />
      {/* The canopy over the doors, on two posts */}
      <mesh geometry={BOX} material={pier} position={[0, 3.6, D + 2.4]} scale={[9, 0.3, 4.8]} />
      {[-4, 4].map((x) => (
        <mesh key={x} geometry={BOX} material={steel} position={[x, 1.75, D + 4.5]} scale={[0.3, 3.5, 0.3]} />
      ))}
      <mesh geometry={BOX} material={frame} position={[0, 0.12, D + 0.6]} scale={[7, 0.24, 1.6]} />
      {/* On the roof: its parapet, the machine rooms and the water tanks, the mast */}
      <mesh geometry={BOX} material={roof} position={[-W / 2, H + 1.6, -2]} scale={[8, 3.2, 6]} />
      {[4, 9].map((x) => (
        <mesh key={x} geometry={BOX} material={steel} position={[x, H + 1.1, -4]} scale={[3, 2.2, 3]} />
      ))}
      <mesh geometry={BOX} material={steel} position={[W - 4, H + 6, -3]} scale={[0.35, 12, 0.35]} />
      <mesh ref={light} geometry={BOX} material={beacon} position={[W - 4, H + 12.2, -3]} scale={[0.6, 0.6, 0.6]} />
      {/* The name, along the top of the front, lit at night */}
      <mesh position={[0, H - 1.4, D + 0.62]}>
        <planeGeometry args={[20, 2.4]} />
        <meshBasicMaterial map={sign} toneMapped={false} color={night ? '#ffffff' : '#d7d7d7'} />
      </mesh>
      {/* Cars parked on the forecourt, a taxi waiting */}
      {[-18, -14, -10, 12, 16].map((x, i) => (
        <Vehicle key={x} p={[x, 0, D + 6.5]} r={0} kind="car" seed={i + 11} crew={false} />
      ))}
      <Vehicle p={[20.5, 0, D + 8.5]} r={-Math.PI / 2} kind="taxi" seed={4} crew={false} />
      {night && <pointLight position={[0, 3.2, D + 3.5]} intensity={25} distance={18} color="#ffe2b0" />}
      <NoShadows>
        <People at={people} seed="tour-ivoire" />
        {!night && <Stroller from={[-3, D + 2.5]} to={[-16, D + 8.5]} seed="tour-ivoire-a" />}
        {!night && <Stroller from={[3, D + 2.5]} to={[10, D + 8.5]} seed="tour-ivoire-b" bag />}
      </NoShadows>
    </group>
  )
}

/** What stands in the way: the tower, the canopy's posts. */
export const TOUR_IVOIRE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: 0, hw: W + 0.5, hd: D + 0.6, rot: 0, top: H },
  { x: -4, z: D + 4.5, r: 0.3 },
  { x: 4, z: D + 4.5, r: 0.3 },
]
