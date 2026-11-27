import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { LAUNCH_DEFAULTS, launchTimetable } from '../../lib/espace'
import { buildCalao, calaoMaterial, flameMaterial, mergeBoxes, metalMaterial, setCalaoFlames, CALAO_COLORS } from './calao'

// A spaceport in the street (the update « espace », open/landmarks.tsx through padLandmarks.ts): the four pads
// (Sassandra, Kourou, Cap Canaveral, Baïkonour) drawn the same, the agency's: the concrete deck and its flame
// trench, the red-and-white service tower and its arms, the lightning masts, the water tower, the assembly hall
// with its open door and the crawler's rails to the pad, the control room and its dishes. And the Calao on it,
// live with the shared timetable (lib/espace.ts): the arms swing back five minutes before, the engines light at
// the minute, it lifts off in its smoke; the pad stays empty half an hour, then the next one is rolled out.
// The visitor centres (Baïkonour's museum too) have theirs: the building, its glass front, a full-size Calao
// mock-up on its plinth, the agency's pennants (never a country's flag).

type B = [number, number, number, number, number, number, string, ('' | 'm' | 'g')?]

const GREY = '#a5a9ad'
const CONCRETE = '#c4c0b6'
const CONCRETE2 = '#b3aea3'
const DARK = '#3a3d42'
const RED = '#c92a2a'
const GLASS = '#5c7d99'
const YELLOW = '#f2c94c'

/** The spaceport whose pad (or visitor centre) this place is. */
const PAD_OF: Record<string, string> = Object.fromEntries([...LAUNCH_DEFAULTS.spaceports.map((s) => [s.pad, s.id]), ['sassandra-visiteurs', 'sassandra'], ['kourou-visiteurs', 'kourou'], ['canaveral-visiteurs', 'cap-canaveral']])

/** A seeded random, the same scatter every time. */
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** A lattice mast: four thin posts, rungs every few metres (x, z its foot, h its height). */
function lattice(b: B[], x: number, z: number, h: number, w: number, color: string, every = 3) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.push([x + (dx * w) / 2, h / 2, z + (dz * w) / 2, 0.22, h, 0.22, color])
  for (let y = every; y < h; y += every) {
    b.push([x, y, z - w / 2, w, 0.16, 0.16, color])
    b.push([x, y, z + w / 2, w, 0.16, 0.16, color])
    b.push([x - w / 2, y, z, 0.16, 0.16, w, color])
    b.push([x + w / 2, y, z, 0.16, 0.16, w, color])
  }
}

/** A sphere-ish tank in blocks (three crossed columns in five rings), on four legs. */
function tank(b: B[], x: number, z: number, r: number, y0: number, color: string, side: string) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.push([x + dx * r * 0.6, y0 / 2, z + dz * r * 0.6, 0.4, y0 + r * 0.6, 0.4, GREY])
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5
    const w = 2 * r * Math.sqrt(1 - (2 * t - 1) ** 2) + 0.2
    const y = y0 + t * 2 * r
    const h = (2 * r) / 5
    b.push([x, y, z, w * 0.7, h, w, color])
    b.push([x, y, z, w, h, w * 0.7, side])
    b.push([x, y, z, w * 0.88, h, w * 0.88, side])
  }
}

/** The pad's ground: the deck and its markings, the flame trench and its deflector, the rails, the masts and their wires, the tanks, the water tower (one geometry). */
function padBoxes(): B[] {
  const b: B[] = []
  // The apron round it, then the deck, raised, its slabs in two greys.
  b.push([0, 0.05, 0, 96, 0.1, 96, '#9e9a90'])
  for (let i = 0; i < 5; i++) for (let k = 0; k < 5; k++) b.push([-16 + i * 8, 0.75, -16 + k * 8, 7.9, 1.5, 7.9, (i + k) % 2 ? CONCRETE : CONCRETE2])
  // The flame trench: cut into the deck under the rocket and running out to +z, its walls, the deflector's wedge, the mouth.
  b.push([0, 1.52, 4, 8, 0.05, 16, '#1d1f23'])
  b.push([0, 0.2, 28, 10, 0.4, 24, '#2a2c30'])
  for (const x of [-5.2, 5.2]) b.push([x, 1.2, 28, 1.4, 2.4, 24, CONCRETE2])
  for (let i = 0; i < 4; i++) b.push([0, 1.3 - i * 0.3, -1 + i * 2.2, 7.6, 0.4, 2.2, '#4b4f56', 'm'])
  // Water deluge pipes along the trench, the scorch marks at its mouth.
  for (const x of [-4.3, 4.3]) b.push([x, 2.6, 26, 0.35, 0.35, 26, '#868e96', 'm'])
  b.push([0, 0.12, 44, 18, 0.06, 8, '#3b3733'])
  // Markings: the safety stripes round the deck's edge, the yellow lines, the agency's circle by the ramp.
  for (let i = 0; i < 20; i++) {
    const c = i % 2 ? YELLOW : '#26282c'
    b.push([-19 + i * 2, 1.52, 19.9, 2, 0.04, 0.4, c])
    b.push([-19 + i * 2, 1.52, -19.9, 2, 0.04, 0.4, c])
    b.push([19.9, 1.52, -19 + i * 2, 0.4, 0.04, 2, c])
    b.push([-19.9, 1.52, -19 + i * 2, 0.4, 0.04, 2, c])
  }
  b.push([-12, 1.52, 0, 0.3, 0.04, 30, YELLOW])
  b.push([12, 1.52, 0, 0.3, 0.04, 30, YELLOW])
  // The ramp down (to −x, where the crawler comes from), its edges.
  b.push([-26, 0.4, -20, 12, 0.8, 12, CONCRETE2])
  // The crawler's two rails on their gravel bed, from the hall to the deck, with ties.
  b.push([-56, 0.1, -20, 48, 0.12, 12, '#8b8577'])
  for (const off of [-3, 3]) b.push([-56, 0.26, -20 + off, 48, 0.2, 1.2, '#55585c', 'm'])
  for (let i = 0; i < 16; i++) b.push([-78 + i * 3, 0.2, -20, 0.5, 0.1, 9, '#6f6a5f'])
  // The four lightning masts at the deck's corners (lattices), their wires sagging between their tops.
  const masts: [number, number][] = [[-24, -24], [24, -24], [-24, 24], [24, 24]]
  for (const [x, z] of masts) {
    lattice(b, x, z, 60, 1.2, GREY, 4)
    b.push([x, 60.5, z, 1.6, 1, 1.6, RED])
    b.push([x, 63, z, 0.2, 4, 0.2, GREY, 'm'])
  }
  for (let m = 0; m < 4; m++) {
    const [x0, z0] = masts[m]
    const [x1, z1] = masts[(m + 1) % 4 === 2 ? 3 : (m + 1) % 4 === 3 ? 2 : (m + 1) % 4]
    if (x0 !== x1 && z0 !== z1) continue
    for (let i = 1; i < 24; i++) {
      const t = i / 24
      b.push([x0 + (x1 - x0) * t, 60 - 6 * Math.sin(Math.PI * t), z0 + (z1 - z0) * t, 0.12, 0.12, 0.12, '#3a3d42'])
      b.push([x0 + (x1 - x0) * t, 60.3 - 6 * Math.sin(Math.PI * t), z0 + (z1 - z0) * t, x0 === x1 ? 0.08 : 2, 0.08, x0 === x1 ? 2 : 0.08, '#4a4d52'])
    }
  }
  // The propellant farm (+x): two round tanks, white, the pipes to the deck.
  tank(b, 38, 14, 5, 2, '#f1f3f5', '#dde1e5')
  tank(b, 38, 30, 4, 2, '#f1f3f5', '#dde1e5')
  b.push([30, 1.4, 14, 16, 0.5, 0.5, '#868e96', 'm'])
  b.push([30, 1.4, 30, 16, 0.5, 0.5, '#868e96', 'm'])
  b.push([38, 7, 14 + 5.3, 3, 1.2, 0.08, CALAO_COLORS.orange])
  // The water tower (for the sound suppression), on its braced legs.
  lattice(b, 34, -30, 18, 6, GREY, 4.5)
  b.push([34, 21, -30, 9, 6, 9, '#e9ecef'])
  b.push([34, 21, -30, 9.2, 1.4, 9.2, CALAO_COLORS.orange])
  b.push([34, 24.3, -30, 8, 0.6, 8, '#ced4da'])
  return b
}

/** The service tower (beside the rocket, at −x): a red-and-white lattice, its platforms, the lift's shaft, the beacon. */
function towerBoxes(): B[] {
  const b: B[] = []
  const x = -10
  for (let i = 0; i < 13; i++) {
    const y = 1.5 + i * 4
    const c = i % 2 ? '#f1f3f5' : RED
    // Corner posts of this section, its rungs, a middle post on each face.
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.push([x + dx * 2.4, y + 2, dz * 2.4, 0.6, 4, 0.6, c])
    for (const d of [-2.4, 2.4]) {
      b.push([x, y + 2, d, 4.8, 0.35, 0.35, c])
      b.push([x + d, y + 2, 0, 0.35, 0.35, 4.8, c])
      b.push([x, y + 2, d, 0.3, 4, 0.3, c])
      b.push([x + d, y + 2, 0, 0.3, 4, 0.3, c])
    }
    // The platform with its grating and its rail.
    b.push([x, y + 4, 0, 6.2, 0.3, 6.2, '#7d8590', 'm'])
    b.push([x + 3, y + 4.6, 0, 0.12, 0.9, 6.2, YELLOW])
  }
  // The roof, the lightning rod, the beacon.
  b.push([x, 54, 0, 6.4, 0.6, 6.4, GREY])
  b.push([x, 56.5, 0, 0.25, 5, 0.25, '#868e96', 'm'])
  // The lift's shaft on its back, the stairs' cage.
  b.push([x - 3.4, 28, 0, 1.6, 53, 1.8, DARK])
  b.push([x - 3.4, 28, 0.95, 1.2, 53, 0.1, '#5c636e'])
  // The umbilical cables down the tower's front.
  for (const z of [-1.2, 1.2]) b.push([x + 2.7, 26, z, 0.3, 46, 0.3, '#2b2f36'])
  return b
}

/** An arm from the tower to the rocket (its pivot at the tower's side, reaching +x): the walkway, its rails, the white room at its end. */
function armBoxes(len: number, room: boolean): B[] {
  const b: B[] = [
    [len / 2, 0, 0, len, 0.6, 1.8, '#7d8590', 'm'],
    [len / 2, 0.8, 0.85, len, 0.12, 0.12, YELLOW],
    [len / 2, 0.8, -0.85, len, 0.12, 0.12, YELLOW],
    [len / 2, -0.6, 0, len, 0.5, 0.5, GREY],
  ]
  if (room) {
    b.push([len - 1.1, 1.3, 0, 2.2, 2.6, 2.6, '#f1f3f5'])
    b.push([len - 1.1, 1.6, 1.31, 1.4, 0.8, 0.05, GLASS])
    b.push([len - 1.1, 2.7, 0, 2.3, 0.2, 2.7, CALAO_COLORS.orange])
  } else b.push([len - 0.5, 0.6, 0, 1, 0.9, 1.8, DARK])
  return b
}

/** The assembly hall: tall, ribbed, its orange stripe, the agency's hornbill, the door open on a dark inside. */
function hallBoxes(): B[] {
  const b: B[] = []
  b.push([0, 30, 0, 30, 60, 26, '#e9ecef'])
  // The ribs up its long sides, the roof's edge.
  for (let i = 0; i < 7; i++) for (const z of [-13.1, 13.1]) b.push([-13.5 + i * 4.5, 30, z, 0.6, 60, 0.3, '#d3d7dc'])
  b.push([-15.05, 30, 0, 0.1, 60, 6, CALAO_COLORS.orange])
  b.push([0, 59.2, 0, 30.6, 1.6, 26.6, GREY])
  // The door on +x side (towards the pad), open: dark inside, its frame in yellow and black stripes.
  b.push([15.05, 24, 0, 0.1, 46, 14, '#20242a'])
  for (let i = 0; i < 12; i++) b.push([15.2, 1.9 + i * 4, 7.4, 0.3, 2, 0.8, i % 2 ? YELLOW : '#26282c'])
  for (let i = 0; i < 12; i++) b.push([15.2, 1.9 + i * 4, -7.4, 0.3, 2, 0.8, i % 2 ? '#26282c' : YELLOW])
  b.push([15.2, 47.5, 0, 0.3, 1.2, 15.6, GREY])
  // The agency's sign on its front: a navy panel, the hornbill in big blocks.
  b.push([0, 48.5, 13.12, 14, 12, 0.1, CALAO_COLORS.navy])
  const HB = ['..oo...', '.oooo..', 'kkkwkk.', '.kkkkkk', '..kk.kk', '..k...k']
  HB.forEach((row, r) => [...row].forEach((ch, k) => ch !== '.' && b.push([(k - 3) * 1.6, 52.5 - r * 1.6, 13.2, 1.6, 1.6, 0.1, ch === 'o' ? CALAO_COLORS.orange : ch === 'w' ? CALAO_COLORS.navy : '#f1f3f5'])))
  // Small office wing, its windows.
  b.push([0, 4, -16, 22, 8, 6, '#dee2e6'])
  for (let i = 0; i < 5; i++) for (const y of [2.6, 5.6]) b.push([-8 + i * 4, y, -19.05, 2.4, 1.4, 0.1, GLASS])
  return b
}

/** The control room: low, a band of glass, two dishes on the roof, its pennant. */
function controlBoxes(): B[] {
  const b: B[] = []
  b.push([0, 4, 0, 26, 8, 16, '#dee2e6'])
  b.push([0, 5, 8.05, 24, 2.6, 0.1, GLASS])
  for (let i = 0; i < 7; i++) b.push([-12 + i * 4, 5, 8.12, 0.25, 2.6, 0.1, '#f1f3f5'])
  b.push([0, 8.3, 0, 26.4, 0.6, 16.4, CALAO_COLORS.navy])
  b.push([0, 7.4, 8.15, 26, 0.3, 0.1, CALAO_COLORS.orange])
  for (const [x, s] of [[-7, 1], [6, 1.4]]) {
    b.push([x, 9.6 * 1, 0, 1, 2, 1, GREY])
    b.push([x, 11 + s, 0.6, 4.6 * s, 0.4, 4.6 * s, '#f8f9fa'])
    b.push([x, 11.2 + s, 0.6, 1.8 * s, 0.4, 1.8 * s, '#ced4da'])
    b.push([x, 12 + s, 0.6, 0.3, 1.6, 0.3, GREY])
  }
  // A pennant pole by the door: the agency's orange pennant.
  b.push([14, 5, 9, 0.3, 10, 0.3, GREY])
  b.push([15.3, 9, 9, 2.4, 1.4, 0.1, CALAO_COLORS.orange])
  b.push([14.6, 9, 9.06, 0.6, 0.6, 0.1, CALAO_COLORS.navy])
  return b
}

/** What grows round each pad: Sassandra's coconut palms on the sand, Kourou's forest, Canaveral's marsh and palmettos, Baïkonour's dry steppe. */
function greenBoxes(sp: string): B[] {
  const b: B[] = []
  const r = rng(sp.length * 977 + 13)
  // Clear of the deck (40), the hall (−x, −z), the control room (+x, −z), the tanks (+x).
  const spot = (min = 50, max = 95): [number, number] | null => {
    for (let n = 0; n < 12; n++) {
      const a = r() * Math.PI * 2
      const d = min + r() * (max - min)
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (x < -45 && z < 5 && z > -50) continue
      if (x > 38 && z < -30) continue
      if (x > 28 && Math.abs(z - 22) < 16) continue
      if (Math.abs(x) < 12 && z > 20 && z < 56) continue
      return [x, z]
    }
    return null
  }
  if (sp === 'baikonour') {
    // Steppe: tufts of dry grass, low shrubs, a few stones.
    for (let i = 0; i < 140; i++) {
      const p = spot(30, 95)
      if (!p) continue
      const [x, z] = p
      const k = r()
      if (k < 0.7) b.push([x, 0.25, z, 0.8 + r(), 0.5 + r() * 0.4, 0.8 + r(), r() > 0.5 ? '#b9a66a' : '#a3935a'])
      else if (k < 0.9) b.push([x, 0.5, z, 1.6, 1, 1.4, '#7d7a4a'])
      else b.push([x, 0.3, z, 1.2, 0.6, 1, '#9b958a'])
    }
    return b
  }
  if (sp === 'sassandra') {
    // Sand patches, coconut palms (a ringed trunk leaning, a crown of fronds), low bush.
    for (let i = 0; i < 18; i++) {
      const p = spot(48, 95)
      if (p) b.push([p[0], 0.06, p[1], 8 + r() * 10, 0.12, 6 + r() * 8, '#e3cf9a'])
    }
    for (let i = 0; i < 26; i++) {
      const p = spot(52, 95)
      if (!p) continue
      const [x, z] = p
      const h = 8 + r() * 6
      const lean = (r() - 0.5) * 0.25
      for (let k = 0; k < 6; k++) b.push([x + lean * k * (h / 6), (k + 0.5) * (h / 6), z, 0.6, h / 6 + 0.05, 0.6, k % 2 ? '#8a6a46' : '#7a5c3c'])
      const tx = x + lean * h
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]]) {
        b.push([tx + dx * 1.8, h + 0.2, z + dz * 1.8, Math.abs(dx) > 0.5 ? 3.2 : 1, 0.35, Math.abs(dz) > 0.5 ? 3.2 : 1, '#3f8f3a'])
        b.push([tx + dx * 3.2, h - 0.5, z + dz * 3.2, 1, 0.3, 1, '#367d32'])
      }
      b.push([tx, h + 0.3, z, 1.2, 0.8, 1.2, '#5e8f2f'])
      b.push([tx + 0.4, h - 0.3, z + 0.3, 0.5, 0.5, 0.5, '#6b4a2a'])
    }
    for (let i = 0; i < 30; i++) {
      const p = spot(46, 95)
      if (p) b.push([p[0], 0.6, p[1], 1.6 + r(), 1.2, 1.6 + r(), r() > 0.5 ? '#4f8a35' : '#5f9a3c'])
    }
    return b
  }
  if (sp === 'kourou') {
    // The forest's edge: tall trees in layered crowns, palms among them, thick undergrowth.
    for (let i = 0; i < 40; i++) {
      const p = spot(55, 95)
      if (!p) continue
      const [x, z] = p
      const h = 9 + r() * 9
      b.push([x, h / 2, z, 0.9, h, 0.9, '#5b4632'])
      const w = 5 + r() * 4
      const g = ['#2f6b2a', '#255e24', '#3a7a30'][Math.floor(r() * 3)]
      b.push([x, h, z, w, 2.2, w, g])
      b.push([x, h + 1.8, z, w * 0.7, 1.6, w * 0.7, '#3a7a30'])
      b.push([x + 0.5, h - 1.4, z - 0.4, w * 0.8, 1, w * 0.8, '#24562a'])
    }
    for (let i = 0; i < 50; i++) {
      const p = spot(48, 95)
      if (p) b.push([p[0], 0.9, p[1], 2 + r() * 2, 1.8, 2 + r() * 2, r() > 0.5 ? '#2f6b2a' : '#3f7a35'])
    }
    return b
  }
  // Canaveral: the marsh: pools of still water, reeds, saw palmettos, a few cabbage palms.
  for (let i = 0; i < 10; i++) {
    const p = spot(52, 92)
    if (p) b.push([p[0], 0.08, p[1], 10 + r() * 14, 0.12, 8 + r() * 10, '#4f7f8f'])
  }
  for (let i = 0; i < 90; i++) {
    const p = spot(46, 95)
    if (!p) continue
    const [x, z] = p
    if (r() < 0.6) for (let k = 0; k < 3; k++) b.push([x + (r() - 0.5) * 1.5, 0.8, z + (r() - 0.5) * 1.5, 0.2, 1.6 + r(), 0.2, r() > 0.5 ? '#9aa85a' : '#7f9248'])
    else b.push([x, 0.5, z, 2 + r(), 1, 2 + r(), '#5d7f44'])
  }
  for (let i = 0; i < 12; i++) {
    const p = spot(55, 95)
    if (!p) continue
    const [x, z] = p
    const h = 7 + r() * 4
    b.push([x, h / 2, z, 0.6, h, 0.6, '#7a6a52'])
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.push([x + dx * 1.3, h, z + dz * 1.3, dx ? 2.6 : 1, 0.6, dz ? 2.6 : 1, '#4f7a3a'])
    b.push([x, h + 0.4, z, 1.4, 0.8, 1.4, '#5d8a42'])
  }
  return b
}

/** The night's lamps: the floodlights on the masts, the tower's platform lamps, its beacon, the hall's door, the control room's windows. */
function lightBoxes(): B[] {
  const warm = '#fff1c1'
  const b: B[] = []
  for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
    for (const y of [30, 44]) b.push([x - Math.sign(x) * 0.9, y, z - Math.sign(z) * 0.9, 1.8, 1.1, 1.8, warm])
    b.push([x, 61.2, z, 0.9, 0.5, 0.9, '#ff4d4d'])
  }
  for (let i = 0; i < 13; i++) b.push([-7.4, 5.8 + i * 4, i % 2 ? 2.6 : -2.6, 0.3, 0.3, 0.3, '#ffe8a3'])
  b.push([-10, 55.1, 0, 1, 0.8, 1, '#ff4d4d'])
  b.push([34, 24.8, -30, 0.8, 0.5, 0.8, '#ff4d4d'])
  // The ground floodlights' beams up at the rocket (faint, added).
  return b
}
/** The searchlights' beams at night: tall pale columns, added to the dark (one draw). */
function beamBoxes(): B[] {
  const b: B[] = []
  for (const [x, z] of [[14, 16], [-14, 16], [14, -14]]) for (let i = 0; i < 6; i++) b.push([x * (1 - i * 0.12), 4 + i * 8, z * (1 - i * 0.12), 2.4 + i * 0.5, 8, 2.4 + i * 0.5, i < 2 ? '#3a3a2a' : '#22221a'])
  return b
}

const geos = new Map<string, THREE.BufferGeometry>()
const geo = (key: string, f: () => B[]) => geos.get(key) ?? (geos.set(key, mergeBoxes(f())), geos.get(key)!)
/** A part as its painted mesh and its metal (two draws). */
function Part({ k, f, ...rest }: { k: string; f: () => B[] } & ThreeElements['group']) {
  const body = geo(`${k}:`, () => f().filter((x) => !x[7]))
  const steel = geo(`${k}:m`, () => {
    const l = f().filter((x) => x[7] === 'm')
    return l.length ? l : [[0, -999, 0, 0.01, 0.01, 0.01, '#000']]
  })
  return (
    <group {...rest}>
      <mesh geometry={body} material={calaoMaterial()} castShadow receiveShadow />
      <mesh geometry={steel} material={metalMaterial()} castShadow />
    </group>
  )
}
let lamp: THREE.MeshBasicMaterial | null = null
const lampMat = () => (lamp ??= new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))
const smokeGeo = new THREE.BoxGeometry(1, 1, 1)

/** Where the Calao is on its pad now (minutes since the last launch, to the next). */
function padState(spaceport: string): { since: number; until: number } {
  const now = worldTime() / 60
  const all = launchTimetable(spaceport, Math.floor(now) - 240, Math.floor(now) + 240).filter((l) => !l.scrub)
  const last = [...all].reverse().find((l) => l.at <= now)
  const next = all.find((l) => l.at > now)
  return { since: last ? now - last.at : 999, until: next ? next.at - now : 999 }
}

const SMOKE = 72
/** Each puff's own draw (the same every time): its kind, its angle, its speed, its size, its grey. */
const PUFF = (() => {
  const r = rng(71)
  return Array.from({ length: SMOKE }, (_, i) => ({ kind: i % 10 < 4 ? 0 : i % 10 < 7 ? 1 : 2, a: r() * Math.PI * 2, v: 0.5 + r(), size: 0.6 + r() * 0.8, up: r(), grey: 0.86 + r() * 0.12 }))
})()

/** A spaceport's pad, live. */
export function PadLandmark({ id, night }: { id: string; night: boolean }) {
  if (VISITORS.has(id)) return <VisitorCentre id={id} night={night} />
  return <Pad id={id} night={night} />
}

/** A pad, live with the timetable (or with `clock`: the launch being lived, LaunchView.tsx). */
export function Pad({ id, night, clock }: { id: string; night: boolean; /** Minutes since the launch and to it (the trip's own clock). */ clock?: () => { since: number; until: number } }) {
  const sp = PAD_OF[id] ?? 'sassandra'
  const calao = useMemo(() => buildCalao('calao-1'), [])
  const rocket = useRef<THREE.Group>(null)
  const arms = useRef<THREE.Group>(null)
  const smoke = useRef<THREE.InstancedMesh>(null)
  const smokeMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }), [])
  useEffect(() => () => smokeMat.dispose(), [smokeMat])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), e: new THREE.Euler() }), [])
  useFrame(({ clock: c }) => {
    const { since, until } = clock ? clock() : padState(sp)
    const r = rocket.current
    if (!r) return
    const sec = since * 60
    // Gone (lifted off more than 3 minutes ago, not yet the next one rolled out): the pad stands empty.
    const flying = sec >= 0 && sec < 180
    const away = since >= 3 && since < 33 && until > 25
    r.visible = !away
    const lift = flying ? 1.6 * Math.pow(Math.max(0, sec - 3), 2.1) : 0
    r.position.y = 1.5 + lift
    // Lit at the minute, the flames long and hot while still held down.
    setCalaoFlames(calao, flying ? 1 : 0, flying ? 1 : 0, 0, c.elapsedTime, 9 + Math.min(30, sec * 2))
    // The arms swing back 5 minutes before, and stay back until the next rocket is there.
    const back = until < 5 || flying || away ? 1 : 0
    if (arms.current) arms.current.rotation.y += ((back * -Math.PI) / 2.2 - arms.current.rotation.y) * 0.05
    const s = smoke.current
    if (!s) return
    // Before: the vapour venting off the cold tanks (a few wisps drifting off its flanks). After: the clouds of
    // steam and smoke out of the trench, all round the deck, and the column it leaves climbing.
    const venting = !away && sec < 0 && sec > -600
    s.visible = venting || (sec >= 0 && sec < 420)
    if (!s.visible) return
    const { m, q, p, s: sc, c: col, e } = tmp
    const k = Math.max(0, sec)
    let n = 0
    for (let i = 0; i < SMOKE; i++) {
      const f = PUFF[i]
      if (venting) {
        if (i >= 14) break
        const ph = (c.elapsedTime * 0.25 * f.v + f.up) % 1
        const side = i % 2 ? 1 : -1
        p.set(side * (2 + ph * 7), 14 + (i % 7) * 3 + ph * 2, (f.up - 0.5) * 3)
        const z = (0.6 + ph * 2.6) * f.size
        sc.set(z, z * 0.8, z)
        col.setScalar(0.97)
      } else {
        const grow = 1 - Math.exp(-k / 7)
        const size = f.size * (2.4 + 8 * grow + k * 0.03)
        if (f.kind === 0) {
          // Out of the trench's mouth (+z), fanning, rolling up as it goes.
          const d = 22 + (16 + 26 * f.v) * grow + k * 0.05 * f.v
          const a = (f.a / Math.PI - 1) * 0.7
          p.set(Math.sin(a) * (d - 18), 2 + size * 0.35 + f.up * 10 * grow + k * 0.05 * f.up, 18 + Math.cos(a) * (d - 18))
        } else if (f.kind === 1) {
          // Spilling off the deck all round.
          const d = 16 + (8 + 14 * f.v) * grow + k * 0.03
          p.set(Math.cos(f.a) * d, 2 + size * 0.3 + f.up * 6 * grow, Math.sin(f.a) * d)
        } else {
          // The column left behind as it climbs: each puff where the rocket was, spreading.
          const at = f.up * Math.min(lift, 160)
          if (at + 4 > lift && lift < 200) {
            sc.set(0, 0, 0)
            m.compose(p.set(0, -99, 0), q, sc)
            s.setMatrixAt(n++, m)
            continue
          }
          p.set(Math.cos(f.a) * (2 + k * 0.05), 4 + at, Math.sin(f.a) * (2 + k * 0.05))
        }
        sc.set(size, size * 0.82, size)
        col.setScalar(f.grey * (f.kind === 0 && k < 8 ? 0.92 : 1))
      }
      q.setFromEuler(e.set(0, f.a, 0))
      m.compose(p, q, sc)
      s.setMatrixAt(n, m)
      s.setColorAt(n++, col)
    }
    s.count = n
    s.instanceMatrix.needsUpdate = true
    if (s.instanceColor) s.instanceColor.needsUpdate = true
    smokeMat.opacity = venting ? 0.55 : 0.92 * Math.max(0, 1 - Math.max(0, k - 120) / 300)
  })
  return (
    <group>
      <Part k="pad" f={padBoxes} />
      <Part k="tower" f={towerBoxes} />
      <mesh geometry={geo(`green:${sp}`, () => greenBoxes(sp))} material={calaoMaterial()} castShadow receiveShadow />
      <group ref={arms} position={[-7.5, 38.5, 0]}>
        <Part k="arm" f={() => armBoxes(5.9, true)} />
      </group>
      <group position={[-7.5, 20, 0]}>
        <Part k="arm-low" f={() => armBoxes(5.2, false)} />
      </group>
      <group ref={rocket} position={[0, 1.5, 0]}>
        <primitive object={calao.root} />
      </group>
      <instancedMesh ref={smoke} args={[smokeGeo, smokeMat, SMOKE]} frustumCulled={false} visible={false} />
      <Part k="hall" f={hallBoxes} position={[-70, 0, -24]} />
      <Part k="control" f={controlBoxes} position={[58, 0, -50]} rotation={[0, -0.6, 0]} />
      {night && (
        <>
          <mesh geometry={geo('lights', lightBoxes)} material={lampMat()} />
          <mesh geometry={geo('beams', beamBoxes)} material={flameMaterial()} />
          <pointLight position={[0, 34, 18]} intensity={5000} distance={180} color="#ffe8b0" />
        </>
      )}
    </group>
  )
}

/* ---------- The visitor centres ---------- */

const VISITORS = new Set(['sassandra-visiteurs', 'kourou-visiteurs', 'canaveral-visiteurs'])

/** The visitor centre: a long low hall with a glass front and a blue roof, its entrance canopy, the pennants. */
function visitorBoxes(): B[] {
  const b: B[] = []
  b.push([0, 0.15, 6, 50, 0.3, 30, '#d9d4c7'])
  b.push([0, 5, -4, 34, 10, 16, '#f1f3f5'])
  b.push([0, 4.6, 4.05, 32, 7, 0.12, GLASS])
  for (let i = 0; i < 9; i++) b.push([-16 + i * 4, 4.6, 4.15, 0.3, 7, 0.1, '#dee2e6'])
  b.push([0, 10.4, -4, 35, 0.8, 17, CALAO_COLORS.navy])
  // The entrance canopy, orange.
  b.push([0, 7.6, 7, 10, 0.4, 6, CALAO_COLORS.orange])
  for (const x of [-4.6, 4.6]) b.push([x, 3.8, 9.6, 0.4, 7.6, 0.4, GREY])
  // The sign over the glass: navy band, the hornbill's orange square.
  b.push([0, 9, 4.2, 14, 1.6, 0.12, CALAO_COLORS.navy])
  b.push([-5.8, 9, 4.3, 1.3, 1.3, 0.1, CALAO_COLORS.orange])
  // The agency's pennants along the walk.
  for (let i = 0; i < 4; i++) {
    const x = -20 + i * 5
    b.push([x, 4, 16, 0.25, 8, 0.25, GREY])
    b.push([x + 1, 7.2, 16, 1.8, 1.1, 0.08, i % 2 ? CALAO_COLORS.orange : CALAO_COLORS.navy])
  }
  // Benches, the mock-up's plinth.
  for (const x of [-12, -6]) b.push([x, 0.5, 12, 3, 0.4, 0.8, '#8a5a32'])
  b.push([18, 0.6, 12, 9, 1.2, 9, CONCRETE])
  return b
}

/** The visitor centre's own plants: a few of its place's (palms, trees, reeds), in beds along the walk. */
function visitorGreen(sp: string): B[] {
  const b: B[] = []
  for (const x of [-22, -14, -6, 6]) {
    b.push([x, 0.45, 19, 3, 0.6, 2, '#8a7a62'])
    if (sp === 'sassandra') {
      for (let k = 0; k < 4; k++) b.push([x, 0.8 + k * 1.4, 19, 0.45, 1.45, 0.45, k % 2 ? '#8a6a46' : '#7a5c3c'])
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.push([x + dx * 1.3, 6.4, 19 + dz * 1.3, dx ? 2.4 : 0.8, 0.3, dz ? 2.4 : 0.8, '#3f8f3a'])
    } else if (sp === 'kourou') {
      b.push([x, 2.5, 19, 0.5, 4, 0.5, '#5b4632'])
      b.push([x, 5, 19, 3.2, 2, 3.2, '#2f6b2a'])
    } else for (let k = 0; k < 4; k++) b.push([x - 0.8 + k * 0.5, 1.4, 19, 0.2, 1.4, 0.2, '#7f9248'])
  }
  return b
}
/** Its windows lit at night, the canopy's lamps. */
function visitorLights(): B[] {
  return [
    [0, 4.6, 4.2, 31.5, 6.6, 0.05, '#ffe3a3'],
    [0, 7.35, 7, 8, 0.1, 4, '#fff4d6'],
  ]
}

function VisitorCentre({ id, night }: { id: string; night: boolean }) {
  // The full-size mock-up (the real one in the street is the pad's): a Calao-1 standing outside.
  const mock = useMemo(() => buildCalao('calao-1'), [])
  const sp = PAD_OF[id] ?? 'sassandra'
  return (
    <group>
      <mesh geometry={geo('visitors', visitorBoxes)} material={calaoMaterial()} castShadow receiveShadow />
      <mesh geometry={geo(`visitors-green:${sp}`, () => visitorGreen(sp))} material={calaoMaterial()} castShadow />
      {night && <mesh geometry={geo('visitors-lights', visitorLights)} material={lampMat()} />}
      <group position={[18, 1.2, 12]}>
        <primitive object={mock.root} />
      </group>
      {night && <pointLight position={[0, 8, 14]} intensity={900} distance={60} color="#ffe8b0" />}
    </group>
  )
}
