import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { put, blocksMat, seeded, type Part } from './kit3d'
import { Club, Maquis, Near, People, Sign, usePeople, useSign, type ClubSpec, type MaquisSpec } from './villeKit'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'

// Yamoussoukro's places (the update « yakro-vivant », backend game/villes.go) that stood as the map's
// plain buildings, in the game's blocks, each where the map has it:
// - the Grande mosquée (Énergie), snow-white, its walls and arches worked in lattice, its five square
//   minarets, the founder's tomb in the courtyard (the guides: « inspired by the Sudanese style »);
// - the Fondation Félix-Houphouët-Boigny (Cacoub, 1987) on its hill: the long arcade of Italian marble and
//   its lofty pillars, the lofty windows behind them, the great octagonal hall of conferences behind (the
//   map's three buildings, where they stand);
// - the Hôtel Le Résident, the game's name for the round tower of the avenue (fifteen storeys, 1980) and
//   its panoramic restaurant cantilevered at the top; no real brand;
// - its Golf Club du Résident: the fairway and the greens, the flags, the bunkers, the club house;
// - the Maquis Le Grand Braisé, Le Caïman Club, Le Totem (the game's, invented names and signs).
// Sizes are the map's footprints; heights and details are estimates.

const WHITE = '#f7f5ef'

/** A lit-at-night white: the floodlights' warmth on the walls, through the blocks' own material. */
function useWashed(night: boolean, k = 0.12) {
  const mat = useMemo(() => {
    const m = blocksMat()
    m.emissive = new THREE.Color('#ffe8c0')
    return m
  }, [])
  mat.emissiveIntensity = night ? k : 0
  return mat
}

/** Lamps and lit windows: dark by day, glowing at night. */
function useLamp(night: boolean, colour = '#ffd27a', k = 1.1) {
  const m = useMemo(() => new THREE.MeshLambertMaterial({ color: '#3a3a3a', emissive: colour, emissiveIntensity: 0 }), [colour])
  m.emissiveIntensity = night ? k : 0
  return m
}

/* ---------- The Grande mosquée ---------- */

/** A square minaret of white tiers: its lattice band, its balcony, its crown and finial. Height h. */
function squareMinaret(h: number, w: number): Part[] {
  const out: Part[] = [[0, h * 0.28, 0, w, h * 0.56, w, WHITE]]
  // Lattice: rows of small dark openings on each face of the shaft.
  for (let k = 0; k < 3; k++)
    for (const [fx, fz, rx] of [[0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, 1]] as const) {
      const y = h * 0.2 + k * h * 0.12
      for (let j = -1; j <= 1; j++) out.push([fx * (w / 2 + 0.02) + (rx ? 0 : j * w * 0.25), y, fz * (w / 2 + 0.02) + (rx ? j * w * 0.25 : 0), rx ? 0.05 : w * 0.14, h * 0.05, rx ? w * 0.14 : 0.05, '#3c4a50'])
    }
  out.push([0, h * 0.57, 0, w + 0.9, 0.4, w + 0.9, WHITE], [0, h * 0.7, 0, w * 0.78, h * 0.26, w * 0.78, WHITE])
  // The upper tier's arched openings, a band of pale green tiles under the crown.
  for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) out.push([fx * (w * 0.39 + 0.02), h * 0.71, fz * (w * 0.39 + 0.02), fx ? 0.05 : w * 0.34, h * 0.15, fz ? 0.05 : w * 0.34, '#3c4a50'])
  out.push([0, h * 0.835, 0, w * 0.82, 0.35, w * 0.82, '#5fa67a'], [0, h * 0.86, 0, w * 0.9, 0.3, w * 0.9, WHITE], [0, h * 0.9, 0, w * 0.55, h * 0.06, w * 0.55, WHITE], [0, h * 0.95, 0, w * 0.3, h * 0.05, w * 0.3, WHITE], [0, h * 0.99, 0, 0.12, h * 0.04, 0.12, '#d9b34a'], [0.12, h * 1.02, 0, 0.3, 0.3, 0.06, '#d9b34a'])
  return out
}

/** The mosque's frame: its hall, 46 by 34 m on the map, its front (+z) on the street. */
export function MosqueeYakro({ night }: { night: boolean }) {
  const mat = useWashed(night, 0.14)
  const lamp = useLamp(night, '#f4ffe8', 0.9)
  const b = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    // The prayer hall, its parapet of merlons, its arched bays on every side, the zellige band at its foot.
    put(out, [0, -4, 0], [[0, 4.5, 0, 40, 9, 24, WHITE], [0, 9.2, 0, 40.6, 0.4, 24.6, WHITE], [0, 0.4, 12.03, 40, 0.8, 0.05, '#2f7f8a'], [0, 0.4, -12.03, 40, 0.8, 0.05, '#2f7f8a']])
    for (let x = -19; x <= 19; x += 2) for (const z of [-16.1, 7.9]) out.push({ p: [x, 9.9, z], s: [0.9, 1, 0.5], c: WHITE })
    for (let z = -14; z <= 6; z += 2) for (const x of [-20.1, 20.1]) out.push({ p: [x, 9.9, z], s: [0.5, 1, 0.9], c: WHITE })
    for (let x = -16; x <= 16; x += 4) {
      // A bay: the dark arch stepped at its top, the lattice over it.
      for (const z of [8.04, -16.04]) out.push({ p: [x, 2.6, z], s: [2.4, 4.2, 0.05], c: '#34424a' }, { p: [x, 4.95, z], s: [1.6, 0.5, 0.05], c: '#34424a' }, { p: [x, 5.35, z], s: [0.8, 0.3, 0.05], c: '#34424a' }, { p: [x, 6.6, z], s: [2.8, 0.4, 0.05], c: '#cfe3d8' })
    }
    // The gallery along the front: its slab on square pillars, its own merlons.
    out.push({ p: [0, 6.8, 11.5], s: [42, 0.7, 7], c: WHITE })
    for (let x = -20; x <= 20; x += 4) out.push({ p: [x, 3.2, 14.5], s: [1, 6.4, 1], c: WHITE }, { p: [x, 5.9, 14.5], s: [3, 0.6, 0.6], c: WHITE })
    for (let x = -20; x <= 20; x += 2) out.push({ p: [x, 7.5, 14.8], s: [0.9, 0.7, 0.4], c: WHITE })
    // The wrought doors in the middle, black and gold.
    out.push({ p: [0, 2.4, 8.06], s: [3.4, 4.8, 0.1], c: '#2a2a2e' }, { p: [0, 2.4, 8.12], s: [0.12, 4.6, 0.05], c: '#c9a14a' }, { p: [0, 3.6, 8.12], s: [3.2, 0.1, 0.05], c: '#c9a14a' }, { p: [0, 1.2, 8.12], s: [3.2, 0.1, 0.05], c: '#c9a14a' })
    // The five minarets: the tall one at the front corner, three at the other corners, one over the back wall's middle.
    put(out, [-21.5, 14, 0], squareMinaret(34, 4.4))
    put(out, [0, -18, 0], squareMinaret(22, 3.4))
    for (const [x, z] of [[21.5, 14], [-21.5, -18], [21.5, -18]]) put(out, [x, z, 0], squareMinaret(18, 3.6))
    // Their lit tiers at night.
    for (const [x, z, h, w] of [[-21.5, 14, 34, 4.4], [0, -18, 22, 3.4], [21.5, 14, 18, 3.6], [-21.5, -18, 18, 3.6], [21.5, -18, 18, 3.6]]) lit.push({ p: [x, h * 0.835, z], s: [w * 0.84, 0.25, w * 0.84] })
    for (let x = -18; x <= 18; x += 6) lit.push({ p: [x, 6.3, 14.9], s: [0.5, 0.3, 0.3] })
    return { out, lit }
  }, [])
  // The courtyard: its paving, the ablutions' fountain, the founder's tomb at its side under its green cloth.
  const yard = useMemo<At[]>(() => {
    const out: At[] = []
    put(out, [0, 0, 0], [[0, 0.04, 22, 46, 0.08, 12, '#e8e2d4'], [-12, 0.5, 22, 4, 1, 4, WHITE], [-12, 1.05, 22, 3, 0.1, 3, '#4aa3c8'], [-12, 1.5, 22, 0.4, 1, 0.4, WHITE]])
    put(out, [15, 22, 0], [[0, 1.4, 0, 4, 2.8, 4, WHITE], [0, 3.2, 0, 3, 0.8, 3, WHITE], [0, 3.9, 0, 1.6, 0.6, 1.6, WHITE], [0, 4.4, 0, 0.1, 0.6, 0.1, '#d9b34a'], [0, 1.2, 2.02, 1.2, 2.2, 0.05, '#2a2a2e'], [0, 0.45, 3.2, 2, 0.6, 1, '#2f7f4a']])
    // Shoes left by the doors, the low wall to the street.
    for (let i = 0; i < 10; i++) out.push({ p: [-3 + (i % 5) * 0.5 + (i > 4 ? 4 : 0), 0.1, 16], s: [0.22, 0.1, 0.32], c: ['#1b1b1f', '#8a5a32', '#e8e4dc', '#2f6db3'][i % 4] })
    for (const s of [-1, 1]) out.push({ p: [s * 14, 0.6, 28.3], s: [18, 1.2, 0.4], c: WHITE })
    return out
  }, [])
  const people = usePeople('yakro-mosquee', [
    { p: [-1.5, 0, 18], ry: 0.3, pose: 'talk', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#f8f9fa' } },
    { p: [1, 0, 19], ry: 3.4, pose: 'idle', gender: 'homme', dress: { outfit: 'imam', outfitColor: '#f8f9fa' } },
    { p: [-11, 0, 20], ry: 1.2, pose: 'wash', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#d0e8d8' } },
    { p: [13, 0, 25.5], ry: Math.PI, pose: 'pray', gender: 'homme' },
    { p: [6, 0, 24], ry: 0, pose: 'walk', gender: 'femme', dress: { outfit: 'abaya', outfitColor: '#2f4f6a' } },
  ])
  return (
    <group>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <Near within={220}>
        <Blocks at={yard} material={mat} color />
      </Near>
      <People list={people} />
    </group>
  )
}

/* ---------- The Fondation Félix-Houphouët-Boigny ---------- */

/** The wing on the street (156 by 44 m), the link, the hall (105 m across): the map's three, in its frame (+z the street, the north). */
const WING_Z = 57
const HALL_Z = -40

export function Fondation({ night }: { night: boolean }) {
  const mat = useWashed(night, 0.1)
  const mats = useMemo(
    () => ({
      marble: new THREE.MeshLambertMaterial({ color: '#f3f0e8', emissive: '#ffe8c0', emissiveIntensity: 0 }),
      glass: new THREE.MeshLambertMaterial({ color: '#3d5f7a', emissive: '#ffd690', emissiveIntensity: 0 }),
      paving: new THREE.MeshLambertMaterial({ color: '#d9d3c4', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    }),
    [],
  )
  mats.marble.emissiveIntensity = night ? 0.1 : 0
  mats.glass.emissiveIntensity = night ? 0.45 : 0
  const sign = useSign(tr('FONDATION FÉLIX-HOUPHOUËT-BOIGNY POUR LA RECHERCHE DE LA PAIX'), '#f3f0e8', '#8a6a2a', night, 0.5, '#f3f0e8')
  // The hall: an octagon, its band of glass, its stepped crown and lantern (a few turned shapes).
  const hall = useMemo(() => {
    const body = new THREE.CylinderGeometry(50, 50, 14, 8)
    body.rotateY(Math.PI / 8)
    const crown = new THREE.CylinderGeometry(38, 52.5, 4, 8)
    crown.rotateY(Math.PI / 8)
    const top = new THREE.CylinderGeometry(20, 30, 7, 8)
    top.rotateY(Math.PI / 8)
    const band = new THREE.CylinderGeometry(50.3, 50.3, 6, 8, 1, true)
    band.rotateY(Math.PI / 8)
    return { body, crown, top, band }
  }, [])
  const b = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    // The wing: its body set back behind the arcade, the heavy flat roof over all, the lofty pillars front and back.
    out.push({ p: [0, 9, WING_Z], s: [146, 18, 34], c: '#f3f0e8' }, { p: [0, 19.6, WING_Z], s: [158, 2.6, 46], c: '#f3f0e8' }, { p: [0, 21.3, WING_Z], s: [150, 0.8, 40], c: '#e4dfd2' })
    for (let x = -75; x <= 75; x += 6)
      for (const z of [WING_Z + 21, WING_Z - 21]) out.push({ p: [x, 9.2, z], s: [1.6, 18.4, 1.6], c: '#f3f0e8' }, { p: [x, 0.3, z], s: [2.4, 0.6, 2.4], c: '#ddd6c6' })
    // The lofty windows between the pillars (the glass, separate: lit at night), and the great door in the middle.
    for (let x = -72; x <= 72; x += 6) if (Math.abs(x) > 4) lit.push({ p: [x, 8.5, WING_Z + 17.05], s: [3.2, 13, 0.1] })
    out.push({ p: [0, 5, WING_Z + 17.1], s: [7, 10, 0.2], c: '#5a4630' }, { p: [0, 10.6, WING_Z + 17.12], s: [8, 0.6, 0.2], c: '#c9a14a' })
    // The steps the whole length of the front, the flags of the country at the foot.
    for (let i = 0; i < 4; i++) out.push({ p: [0, 0.15 + i * 0.3, WING_Z + 26 - i * 1.2], s: [130 - i * 4, 0.3, 2.4], c: '#e8e2d4' })
    for (const x of [-40, -34, 34, 40]) {
      out.push({ p: [x, 6, WING_Z + 33], s: [0.2, 12, 0.2], c: '#d0d0d0' })
      ;['#f77f00', '#ffffff', '#009e60'].forEach((c, k) => out.push({ p: [x + 0.9, 11, WING_Z + 33 + (k - 1) * 0.6], s: [1.6, 1.1, 0.6], c, ry: Math.PI / 2 }))
    }
    // The link between the wing and the hall: glass between marble bands.
    out.push({ p: [0, 7.5, 19], s: [51, 15, 36], c: '#f3f0e8' }, { p: [0, 15.4, 19], s: [53, 0.8, 38], c: '#e4dfd2' })
    for (const x of [-25.6, 25.6]) for (let z = 4; z <= 34; z += 6) lit.push({ p: [x, 7, z], s: [0.1, 9, 3.6] })
    // The ring of slender pillars round the hall, under its crown's eaves.
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      out.push({ p: [Math.cos(a) * 51.6, 7, HALL_Z + Math.sin(a) * 51.6], s: [1.2, 14, 1.2], c: '#f3f0e8' })
    }
    return { out, lit }
  }, [])
  const people = usePeople('fondation', [
    { p: [-6, 0, WING_Z + 30], ry: Math.PI, pose: 'walk' },
    { p: [-4.6, 0, WING_Z + 30.6], ry: Math.PI, pose: 'talk', gender: 'femme' },
    { p: [8, 0, WING_Z + 28], ry: 0.3, pose: 'film' },
    { p: [4, 0, WING_Z + 22.5], ry: 0, pose: 'idle', gender: 'homme', dress: { outfit: 'uniforme', outfitColor: '#3b4a2a' } },
    { p: [20, 0, WING_Z + 27], ry: -0.4, pose: 'phone', dress: { outfit: 'suit', outfitColor: '#22324a' } },
  ])
  return (
    <group>
      {/* The forecourt along the front, where the steps come down */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, WING_Z + 27]} material={mats.paving} receiveShadow>
        <planeGeometry args={[150, 14]} />
      </mesh>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={mats.glass} />
      <group position={[0, 0, HALL_Z]}>
        <mesh geometry={hall.body} position={[0, 7, 0]} material={mats.marble} castShadow receiveShadow />
        <mesh geometry={hall.band} position={[0, 8, 0]} material={mats.glass} />
        <mesh geometry={hall.crown} position={[0, 16, 0]} material={mats.marble} castShadow />
        <mesh geometry={hall.top} position={[0, 21.5, 0]} material={mats.marble} castShadow />
        <mesh geometry={BOX} position={[0, 26.5, 0]} scale={[12, 3, 12]} material={mats.glass} />
        <mesh geometry={BOX} position={[0, 28.4, 0]} scale={[13, 0.8, 13]} material={mats.marble} />
      </group>
      <Sign s={sign} w={60} p={[0, 20.2, WING_Z + 23.35]} />
      <People list={people} within={160} />
    </group>
  )
}

/* ---------- The Hôtel Le Résident ---------- */

/** The tower's skin: floor upon floor of balconies and dark glass all round, its windows lit here and there at night. */
function towerSkin() {
  const [bays, floors] = [48, 14]
  const mk = (night: boolean) => {
    const c = document.createElement('canvas')
    c.width = bays * 4
    c.height = floors * 4
    const g = c.getContext('2d')!
    const r = seeded(night ? 23 : 5)
    for (let f = 0; f < floors; f++)
      for (let k = 0; k < bays; k++) {
        const [x, y] = [k * 4, f * 4]
        g.fillStyle = night ? '#000000' : '#f4f1ea'
        g.fillRect(x, y, 4, 4)
        g.fillStyle = night ? (r() < 0.35 ? '#ffe2a0' : '#000000') : '#46607a'
        g.fillRect(x, y + 1, 3, 2)
      }
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return new THREE.MeshLambertMaterial({ map: mk(false), emissiveMap: mk(true), emissive: '#ffffff', emissiveIntensity: 0 })
}

/** Its round tower (the map's 38 m across, 51 m high) on the building's middle, the lobby and its canopy on the street (+z). */
export function HotelResident({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const lamp = useLamp(night, '#ffd27a', 1)
  const mats = useMemo(
    () => ({
      skin: towerSkin(),
      white: new THREE.MeshLambertMaterial({ color: '#f4f1ea' }),
      glass: new THREE.MeshLambertMaterial({ color: '#2e4a60', emissive: '#ffcf80', emissiveIntensity: 0 }),
      water: new THREE.MeshLambertMaterial({ color: '#3fb6d8', emissive: '#1a8fb0', emissiveIntensity: 0 }),
    }),
    [],
  )
  mats.skin.emissiveIntensity = night ? 0.9 : 0
  mats.glass.emissiveIntensity = night ? 0.8 : 0
  mats.water.emissiveIntensity = night ? 0.5 : 0
  const sign = useSign(tr('LE RÉSIDENT'), '#7a1f2a', '#f4e2a0', night, 1)
  const top = useSign(tr('LE RÉSIDENT'), '#f4f1ea', '#7a1f2a', night, 0.6, '#f4f1ea')
  const b = useMemo(() => {
    const out: At[] = []
    // The service core up the back, past the roof; the lobby's low wing on the front, its canopy and its columns.
    out.push({ p: [0, 27, -16], s: [7, 54, 6], c: '#e8e3d8' })
    put(out, [0, 12, 0], [[0, 2.6, 0, 30, 5.2, 12, '#f4f1ea'], [0, 5.4, 0, 31, 0.5, 13, '#c9c2b2'], [0, 4.2, 9.5, 12, 0.5, 7, '#7a1f2a'], [-5.5, 2, 12.6, 0.5, 4, 0.5, '#f4f1ea'], [5.5, 2, 12.6, 0.5, 4, 0.5, '#f4f1ea'], [0, 0.04, 9, 10, 0.08, 6, '#9c2a35']])
    // The pool deck on the garden side, its loungers and its parasols, palms.
    put(out, [-27, 2, 0], [[0, 0.3, 0, 18, 0.6, 12, '#e4ddcd'], ...[0, 1, 2, 3].map((i): Part => [-6 + i * 4, 0.75, 5, 0.8, 0.3, 2, '#f4f1ea']), ...[-4, 4].flatMap((x): Part[] => [[x, 1.6, -4.5, 0.1, 2.6, 0.1, '#ffffff'], [x, 2.9, -4.5, 2.6, 0.12, 2.6, '#7a1f2a']])])
    for (const [x, z] of [[-36, -4], [-36, 8], [-18, -7], [20, 14], [24, 2]]) put(out, [x, z, x], [[0, 4, 0, 0.45, 8, 0.45, '#8a7a64'], ...[0, 1, 2, 3, 4].map((k): Part => [Math.cos(k * 1.26) * 1.5, 8, Math.sin(k * 1.26) * 1.5, 3.2, 0.14, 0.8, '#4e8a3a', -k * 1.26])])
    // Flags at the drive, taxis at the canopy.
    for (const x of [-9, -7, 7, 9]) out.push({ p: [x, 4, 26], s: [0.16, 8, 0.16], c: '#d0d0d0' }, { p: [x + 0.7, 7.3, 26], s: [1.4, 0.9, 0.05], c: x < 0 ? '#f77f00' : '#009e60' })
    for (const x of [-3, 3.5]) put(out, [x, 24, Math.PI / 2], [[0, 0.7, 0, 4.2, 0.8, 1.8, '#f0b429'], [0, 1.35, -0.2, 2.2, 0.55, 1.6, '#2b3a4a'], [0, 1.75, -0.2, 0.6, 0.2, 0.3, '#f4f1ea']])
    const lit: At[] = [{ p: [0, 3, 18.05], s: [10, 3, 0.1] }, ...[-4.5, 0, 4.5].map((x): At => ({ p: [x, 3.95, 15.2], s: [0.6, 0.12, 0.6] }))]
    return { out, lit }
  }, [])
  return (
    <group>
      {/* The tower: fourteen floors of balconies, the cantilevered drum of the restaurant, its roof and mast */}
      <mesh position={[0, 23.5, 0]} material={mats.skin} castShadow receiveShadow>
        <cylinderGeometry args={[17, 17, 47, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 46.8, 0]} material={mats.white} castShadow>
        <cylinderGeometry args={[21, 17, 2.4, 24]} />
      </mesh>
      <mesh position={[0, 49.3, 0]} material={mats.glass}>
        <cylinderGeometry args={[21, 21, 2.6, 24]} />
      </mesh>
      <mesh position={[0, 51.2, 0]} material={mats.white} castShadow>
        <cylinderGeometry args={[19, 21.6, 1.2, 24]} />
      </mesh>
      <mesh position={[0, 54.6, 0]} material={mats.white}>
        <cylinderGeometry args={[0.3, 0.5, 6, 6]} />
      </mesh>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-27, 0.65, 0]} material={mats.water}>
        <planeGeometry args={[12, 6]} />
      </mesh>
      <Sign s={sign} w={7} p={[0, 4.75, 13.03]} />
      <Sign s={top} w={18} p={[0, 49.3, 21.08]} />
    </group>
  )
}

/* ---------- The Golf Club du Résident ---------- */

/** The course round its middle, the club house on the street (+z), the practice beside it. */
export function GolfResident({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const lamp = useLamp(night, '#ffd27a', 1)
  const mats = useMemo(
    () => ({
      rough: new THREE.MeshLambertMaterial({ color: '#5a9440', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      fairway: new THREE.MeshLambertMaterial({ color: '#6fb24a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      green: new THREE.MeshLambertMaterial({ color: '#8fd062', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      sand: new THREE.MeshLambertMaterial({ color: '#ead9a6', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      water: new THREE.MeshLambertMaterial({ color: '#3c7f94', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      flag: new THREE.MeshLambertMaterial({ color: '#e03131', side: THREE.DoubleSide }),
    }),
    [],
  )
  const sign = useSign(tr('GOLF CLUB DU RÉSIDENT'), '#1f5a2e', '#f4f1e6', night, 0.8)
  const greens: [number, number][] = useMemo(() => [[-30, -40], [28, -30], [-6, 2]], [])
  const b = useMemo(() => {
    const out: At[] = []
    // The club house: white, its tiled roof in steps, the terrace and its parasols, the carts in a row.
    put(out, [0, 26, 0], [[0, 2.5, 0, 22, 5, 10, '#f4f1ea'], [0, 5.3, 0, 23, 0.6, 11, '#a4472a'], [0, 5.9, 0, 18, 0.6, 7, '#b5532c'], [0, 6.5, 0, 12, 0.6, 3, '#a4472a'], [0, 2, -5.02, 18, 2.4, 0.05, '#3d5f7a'], [0, 0.25, -8, 22, 0.5, 6, '#d9cfb8']])
    // (Its front on the street, its terrace on the course behind.)
    for (const x of [-7, 0, 7]) put(out, [x, 18.5, 0], [[0, 1.3, 0, 0.1, 2.6, 0.1, '#ffffff'], [0, 2.6, 0, 3, 0.1, 3, '#1f5a2e'], [0, 0.95, 0, 1, 0.06, 1, '#ffffff'], [-0.9, 0.7, 0, 0.45, 0.5, 0.45, '#ffffff'], [0.9, 0.7, 0, 0.45, 0.5, 0.45, '#ffffff']], 0.5)
    for (let i = 0; i < 4; i++) put(out, [15 + i * 2, 24, 0], [[0, 0.6, 0, 1.2, 0.5, 2.2, '#f4f1ea'], [0, 1.9, 0, 1.2, 0.08, 1.6, '#f4f1ea'], [0, 1.3, -0.7, 0.06, 1.2, 0.06, '#c0c0c0'], [0, 1.3, 0.7, 0.06, 1.2, 0.06, '#c0c0c0'], [0, 0.25, 0.8, 1.3, 0.4, 0.4, '#1c1c1e'], [0, 0.25, -0.8, 1.3, 0.4, 0.4, '#1c1c1e']])
    // The practice: its mats in a row, the yardage boards out on the grass.
    for (let i = 0; i < 6; i++) out.push({ p: [-30 + i * 3, 0.06, 18], s: [2, 0.08, 1.6], c: '#3a7a3a' }, { p: [-30 + i * 3 + 0.5, 0.15, 18.3], s: [0.4, 0.2, 0.3], c: '#ffffff' })
    for (const [x, z] of [[-24, 10], [-30, -2]]) out.push({ p: [x, 1, z], s: [1.6, 1.2, 0.1], c: '#f4f1ea' }, { p: [x, 0.3, z], s: [0.1, 0.6, 0.1], c: '#8a8a8a' })
    // The flagsticks on the greens, the tee markers, the trees between the holes.
    for (const [x, z] of greens) out.push({ p: [x, 1.2, z], s: [0.06, 2.4, 0.06], c: '#ffffff' }, { p: [x, 0.04, z], s: [0.18, 0.04, 0.18], c: '#111111' })
    for (const [x, z] of [[-10, 12], [18, 8]]) out.push({ p: [x, 0.08, z], s: [3, 0.1, 3], c: '#5aa03e' }, { p: [x - 0.8, 0.25, z], s: [0.25, 0.3, 0.25], c: '#3b5bdb' }, { p: [x + 0.8, 0.25, z], s: [0.25, 0.3, 0.25], c: '#3b5bdb' })
    const r = seeded(41)
    for (let i = 0; i < 16; i++) {
      // Behind and beside the course, not out on the street's side.
      const a = Math.PI * (0.95 + r() * 1.1)
      const d = 44 + r() * 12
      const h = 5 + r() * 4
      put(out, [Math.cos(a) * d, Math.sin(a) * d - 8, 0], [[0, h / 2, 0, 0.6, h, 0.6, '#6e5640'], [0, h + 1, 0, 5, 2.6, 5, i % 2 ? '#3f7a35' : '#2f6a2f'], [0.5, h + 2.4, 0.3, 3.2, 1.6, 3.2, '#3f7a35']])
    }
    const lit: At[] = [{ p: [0, 2.2, 31.06], s: [16, 2, 0.1] }]
    return { out, lit }
  }, [greens])
  const flags = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = flags.current
    if (!g) return
    const t = worldTime()
    for (let i = 0; i < g.children.length; i++) g.children[i].rotation.y = Math.sin(t * 2.2 + i) * 0.35
  })
  const people = usePeople('golf-resident', [
    { p: [-8, 0, -3], ry: 2.6, pose: 'backhand', gender: 'homme', dress: { outfit: 'chemise', outfitColor: '#f4f1ea' } },
    { p: [-10, 0, -1.5], ry: 2.4, pose: 'idle', gender: 'homme', dress: { outfit: 'casual', outfitColor: '#1f5a2e' } },
    { p: [-27, 0, 19.2], ry: Math.PI, pose: 'forehand', gender: 'femme' },
    { p: [-21, 0, 19.2], ry: Math.PI, pose: 'idle', gender: 'homme' },
    { p: [-1, 0, 19], ry: 0.4, pose: 'drink' },
    { p: [6.2, 0, 18.8], ry: -0.6, pose: 'talk', gender: 'femme' },
  ])
  return (
    <group>
      {/* The rough all round, the fairways, the greens, the bunkers, the pond */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -8]} material={mats.rough} receiveShadow>
        <circleGeometry args={[58, 32]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0.5]} position={[-14, 0.03, -18]} material={mats.fairway} receiveShadow>
        <planeGeometry args={[22, 70]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -0.7]} position={[16, 0.03, -10]} material={mats.fairway} receiveShadow>
        <planeGeometry args={[20, 56]} />
      </mesh>
      {greens.map(([x, z]) => (
        <mesh key={`${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.05, z]} material={mats.green} receiveShadow>
          <circleGeometry args={[7, 20]} />
        </mesh>
      ))}
      {[[-22, -36, 3.5], [34, -24, 3], [2, 6, 2.6]].map(([x, z, r]) => (
        <mesh key={`b${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.06, z]} scale={[1.6, 1, 1]} material={mats.sand}>
          <circleGeometry args={[r, 14]} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.05, -26]} scale={[1.5, 1, 1]} material={mats.water}>
        <circleGeometry args={[9, 20]} />
      </mesh>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <group ref={flags}>
        {greens.map(([x, z]) => (
          <group key={`f${x}`} position={[x, 2.1, z]}>
            <mesh position={[0.45, 0, 0]} material={mats.flag}>
              <planeGeometry args={[0.9, 0.6]} />
            </mesh>
          </group>
        ))}
      </group>
      <Sign s={sign} w={14} p={[0, 4.2, 31.06]} />
      <People list={people} within={140} />
    </group>
  )
}

/* ---------- The maquis and the clubs ---------- */

const GRAND_BRAISE: MaquisSpec = {
  name: 'MAQUIS LE GRAND BRAISÉ',
  sign: ['#c92a2a', '#fff3bf'],
  wall: '#f08c00',
  roof: 'tin',
  food: 'meat',
  plastic: ['#ffffff', '#c92a2a', '#ffffff', '#1971c2'],
  seed: 3,
  // The canaris of kédjénou on their hearth by the grill, the mutton's skewers of choukouya.
  extra: [[-4.6, 0.25, 3.6, 0.7, 0.5, 0.7, '#8a4a2a'], [-4.6, 0.62, 3.6, 0.5, 0.25, 0.5, '#7a3a1e'], [-3.6, 0.25, 3.6, 0.6, 0.45, 0.6, '#8a4a2a'], [-3.6, 0.55, 3.6, 0.42, 0.2, 0.42, '#7a3a1e'], [-4.1, 0.08, 3.6, 2, 0.16, 1, '#3a3a3a']],
}
const CAIMAN_CLUB: ClubSpec = {
  name: 'LE CAÏMAN CLUB',
  neon: '#2bdc6b',
  neon2: '#ffd43b',
  wall: '#14241a',
  seed: 5,
  // A caiman lying along the roof's edge over the door, its jaws open on the street.
  motif: [
    [0, 7.9, 4.2, 8, 0.9, 1.6, '#4a9a52'], [5, 7.9, 4.2, 2.6, 0.7, 1.3, '#4a9a52'], [6.6, 8.3, 4.2, 1.6, 0.25, 1.1, '#4a9a52', 0], [6.6, 7.6, 4.2, 1.6, 0.25, 1.1, '#244f2c'],
    [5.2, 8.35, 4.75, 0.25, 0.25, 0.1, '#ffd43b'], [5.2, 8.35, 3.65, 0.25, 0.25, 0.1, '#ffd43b'], [-5.2, 7.8, 4.2, 3, 0.6, 1, '#4a9a52'], [-7.6, 7.7, 4.2, 2.2, 0.4, 0.6, '#4a9a52'],
    [2.4, 7.5, 5.1, 0.6, 0.6, 0.6, '#244f2c'], [-2.4, 7.5, 5.1, 0.6, 0.6, 0.6, '#244f2c'], [2.4, 7.5, 3.3, 0.6, 0.6, 0.6, '#244f2c'], [-2.4, 7.5, 3.3, 0.6, 0.6, 0.6, '#244f2c'],
    ...[-3, -1, 1, 3].map((x): Part => [x, 8.45, 4.2, 0.5, 0.2, 0.5, '#1f4a28']),
  ],
}
const TOTEM: ClubSpec = {
  name: 'LE TOTEM',
  neon: '#ff922b',
  neon2: '#be4bdb',
  wall: '#2a1a12',
  seed: 9,
  bpm: 124,
  // Two carved poles either side of the door, faces stacked one over the other.
  motif: [-3.4, 3.4].flatMap((x): Part[] => [
    [x, 3.6, 5.6, 1.1, 7.2, 1.1, '#7a4a22'],
    ...[1.6, 3.8, 6].flatMap((y, k): Part[] => [[x, y, 6.17, 1, 1.4, 0.06, ['#c9a14a', '#e03131', '#f4f1e6'][k]], [x - 0.25, y + 0.25, 6.22, 0.2, 0.2, 0.04, '#111111'], [x + 0.25, y + 0.25, 6.22, 0.2, 0.2, 0.04, '#111111'], [x, y - 0.35, 6.22, 0.5, 0.12, 0.04, '#111111']]),
    [x, 7.5, 5.6, 2, 0.3, 0.5, '#7a4a22'],
  ]),
}

export const MaquisGrandBraise = ({ night }: { night: boolean }) => <Maquis spec={GRAND_BRAISE} night={night} />
export const CaimanClub = ({ night }: { night: boolean }) => <Club spec={CAIMAN_CLUB} night={night} />
export const TotemClub = ({ night }: { night: boolean }) => <Club spec={TOTEM} night={night} />
