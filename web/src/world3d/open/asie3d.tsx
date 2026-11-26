import { useMemo } from 'react'
import * as THREE from 'three'
import { Blocks } from './ruePrincesse'
import type { At } from './shoreline'
import { seeded } from './kit3d'
import { People, usePeople } from './villeKit'
import { dome, octo, spire, streetLife, useBlocks } from './paysKit'

// Asia's landmarks in blocks (the update « pays-asie », backend world/asie.go), at their real size where known,
// proportions from photographs, the details the game's: Beijing's Forbidden City behind the Tiananmen gate, the Great
// Wall at Badaling; Shanghai's Oriental Pearl Tower and Pudong; Guangzhou's Xiaobei street; Tokyo's Shibuya crossing
// under its screens and Sensō-ji's Thunder gate and pagoda; Kyoto's thousand torii; Delhi's India Gate; Mumbai's Gateway
// of India; Bangkok's Wat Arun; Hanoi's red bridge to the Ngoc Son temple; Kuala Lumpur's twin towers; Angkor Wat.
// Frames: +z the street.

type Props = { night: boolean }
const RED = '#b8322a'
const RED_D = '#8f241e'
const GOLD = '#d4a017'
const TILE_Y = '#e0a526'

/** The neon and the screens: unlit colours that glow day and night. */
function useNeon() {
  return useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
}

/** A Chinese hip roof of glazed tiles, `w`×`d`, from y: the eaves wider, the ridge, the upturned corners. */
function hipRoof(out: At[], [x, y, z]: [number, number, number], w: number, d: number, c: string, steps = 4) {
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps
    out.push({ p: [x, y + i * 1.1 + 0.55, z], s: [w * (0.55 + 0.45 * k) + 2, 1.1, d * (0.4 + 0.6 * k) + 2], c: i % 2 ? c : '#c98f1e' })
  }
  out.push({ p: [x, y + steps * 1.1 + 0.4, z], s: [w * 0.55, 0.8, 1], c })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ p: [x + sx * (w / 2 + 1.2), y + 0.9, z + sz * (d / 2 + 1.2)], s: [0.8, 0.8, 0.8], c })
}

/** The Forbidden City from the south: the Tiananmen gate on its red wall, the portrait's place, the golden roofs of the halls behind. */
function CiteInterdite({ night }: Props) {
  const mat = useBlocks(night, '#ffd8a0', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    // The red wall and the gate's terrace, its five arches.
    out.push({ p: [0, 7, -12], s: [110, 14, 12], c: RED })
    for (const x of [-16, -8, 0, 8, 16]) out.push({ p: [x, 3.2, -5.9], s: [x === 0 ? 5 : 3.6, 6.4, 0.2], c: '#3a2a20' })
    out.push({ p: [0, 14.4, -12], s: [70, 0.8, 14], c: '#e9e2d0' })
    // The gate's hall: red columns, the double roof of yellow tiles.
    for (let i = 0; i < 10; i++) out.push({ p: [-27 + i * 6, 18, -8], s: [1.2, 7, 1.2], c: RED })
    out.push({ p: [0, 18, -14], s: [60, 7, 9], c: RED_D })
    hipRoof(out, [0, 21.5, -12], 62, 16, TILE_Y)
    hipRoof(out, [0, 27.5, -12], 54, 12, TILE_Y, 3)
    // The halls beyond, roof after roof.
    for (const [z, w, h] of [[-50, 70, 16], [-85, 60, 14], [-115, 50, 12]] as const) {
      out.push({ p: [0, h / 2 + 2, z], s: [w, h, 22], c: RED_D })
      out.push({ p: [0, 1, z], s: [w + 12, 2, 32], c: '#e9e2d0' })
      hipRoof(out, [0, h + 2, z], w, 22, TILE_Y)
    }
    // The bridges of gold water and the square's flagstones, the lanterns.
    out.push({ p: [0, 0.05, 16], s: [130, 0.1, 30], c: '#bdb6a8' })
    for (const x of [-14, -7, 0, 7, 14]) out.push({ p: [x, 0.5, 4], s: [4, 1, 6], c: '#f1ede3' })
    for (const x of [-40, 40]) out.push({ p: [x, 4, 6], s: [1.6, 8, 1.6], c: '#f1ede3' }, { p: [x, 8.6, 6], s: [4, 0.8, 1.4], c: '#f1ede3' })
    streetLife(out, 'asie', -50, 50, 26, 1420)
    return out
  }, [])
  const people = usePeople('cite-interdite', [
    { p: [2, 0.1, 10], ry: Math.PI, pose: 'film' },
    { p: [-10, 0.1, 14], ry: 0.3, pose: 'walk' },
    { p: [12, 0.1, 18], ry: 2.4, pose: 'talk' },
    { p: [-3, 0.1, 20], ry: 3, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Great Wall at Badaling: the wall of grey bricks climbing the ridge, its crenellations, the watchtowers, the hills round. */
function GrandeMuraille({ night }: Props) {
  const mat = useBlocks(night, '#ffe0b0', 0.1)
  const at = useMemo(() => {
    const out: At[] = []
    const B = '#8d8a80'
    const B2 = '#a19d92'
    // The wall: segments along a curve that climbs from the street to the crest and back.
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      pts.push([-90 + t * 180, Math.sin(t * Math.PI) * 34 + Math.sin(t * 9) * 3, -20 - Math.sin(t * Math.PI * 2) * 28])
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y, z] = pts[i]
      const [x2, y2, z2] = pts[i + 1]
      const len = Math.hypot(x2 - x, z2 - z)
      const ry = Math.atan2(x2 - x, z2 - z) - Math.PI / 2
      const my = (y + y2) / 2
      // The ridge under the wall (the hill's green), the wall on it: 7 m of brick, its walkway, its crenels.
      if (my > 0.5) out.push({ p: [(x + x2) / 2, my / 2, (z + z2) / 2], s: [len + 0.6, my, 14], ry, c: i % 2 ? '#5b7f3a' : '#6c8f46' })
      out.push({ p: [(x + x2) / 2, my + 3.5, (z + z2) / 2], s: [len + 0.4, 7, 6.5], ry, c: i % 2 ? B : B2 })
      out.push({ p: [(x + x2) / 2, my + 7.1, (z + z2) / 2], s: [len + 0.4, 0.2, 5.2], ry, c: '#b7b2a6' })
      for (const side of [-1, 1]) {
        const nx = Math.sin(ry) * side * 3
        const nz = Math.cos(ry) * side * 3
        for (let k = 0; k < 3; k++) {
          const f = (k + 0.5) / 3
          out.push({ p: [x + (x2 - x) * f + nx, y + (y2 - y) * f + 7.8, z + (z2 - z) * f + nz], s: [1.2, 1.4, 0.6], ry, c: B })
        }
      }
      // A watchtower every few segments.
      if (i % 8 === 4) {
        out.push({ p: [x, y + 6, z], s: [10, 12, 10], c: B2 })
        for (const d of [-1, 1]) out.push({ p: [x + d * 2.5, y + 8, z + 5.05], s: [1.4, 2.4, 0.1], c: '#2b2a28' })
        out.push({ p: [x, y + 12.6, z], s: [11, 1.2, 11], c: B })
      }
    }
    // The hills under it.
    const r = seeded(1505)
    for (let i = 0; i < 16; i++) {
      const x = -100 + i * 13 + r() * 6
      const h = 8 + Math.sin(((x + 90) / 180) * Math.PI) * 30 * (0.6 + r() * 0.4)
      out.push({ p: [x, h / 2 - 2, -50 - r() * 30], s: [18, h, 30], c: r() < 0.5 ? '#5b7f3a' : '#6c8f46' })
    }
    out.push({ p: [0, 0.05, 20], s: [120, 0.1, 30], c: '#b8b2a4' })
    streetLife(out, 'asie', -40, 40, 26, 1505)
    return out
  }, [])
  const people = usePeople('muraille', [
    { p: [4, 0.1, 14], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 18], ry: 0.5, pose: 'walk' },
    { p: [12, 0.1, 22], ry: 2.2, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Oriental Pearl Tower (468 m in life, here scaled to the game's sky): the three columns, the pink spheres, and Pudong's towers behind: the Shanghai Tower's twist and Jin Mao's tiers. */
function PerleOrient({ night }: Props) {
  const mat = useBlocks(night, '#ffd0f0', 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    const P = '#e8508a'
    const S = '#cfd4da'
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      out.push({ p: [Math.sin(a) * 6, 40, Math.cos(a) * 6], s: [3, 80, 3], c: S })
      out.push({ p: [Math.sin(a) * 14, 14, Math.cos(a) * 14], s: [2.4, 30, 2.4], ry: a, c: S })
    }
    const ball = (y: number, r: number) => {
      dome(out, [0, y, 0], r, 5, P, '#d63d78')
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * (Math.PI / 2)
        const a2 = ((i + 1) / 5) * (Math.PI / 2)
        octo(out, [0, y - r * Math.sin(a) - (r * (Math.sin(a2) - Math.sin(a))) / 2, 0], 2 * r * Math.cos((a + a2) / 2), r * (Math.sin(a2) - Math.sin(a)) + 0.02, i % 2 ? '#d63d78' : P)
      }
    }
    ball(24, 13)
    ball(88, 10)
    ball(112, 4)
    out.push({ p: [0, 100, 0], s: [2.6, 20, 2.6], c: S }, { p: [0, 128, 0], s: [1.2, 28, 1.2], c: S })
    // The Shanghai Tower: stacked, turning, narrowing.
    for (let i = 0; i < 18; i++) out.push({ p: [70, 6 + i * 9, -60], s: [26 - i * 0.7, 9.1, 26 - i * 0.7], ry: i * 0.07, c: i % 2 ? '#a9c6d8' : '#94b6cc' })
    // Jin Mao: the tiers of a pagoda in glass and steel, its spire.
    for (let i = 0; i < 12; i++) out.push({ p: [40, 5 + i * 10, -80], s: [22 - i * 1.2, 10.1, 22 - i * 1.2], c: i % 2 ? '#6d7f8f' : '#8297a8' })
    spire(out, [40, 125, -80], 5, 14, 5, '#8297a8')
    // The river's edge, the promenade.
    out.push({ p: [0, 0.05, 40], s: [130, 0.1, 30], c: '#bdb6a8' }, { p: [0, -0.3, 70], s: [180, 0.2, 40], c: '#5b7e8f' })
    streetLife(out, 'asie', -50, 50, 30, 1994)
    return out
  }, [])
  const people = usePeople('perle', [
    { p: [6, 0.1, 30], ry: Math.PI, pose: 'film' },
    { p: [-10, 0.1, 34], ry: 0.5, pose: 'walk' },
    { p: [14, 0.1, 36], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** A row of shops along +z: fronts, signs, goods out, awnings (Xiaobei, Shibuya's side streets). */
function shopRow(out: At[], seed: number, fronts: string[], awnings: string[], goods: string[], len = 64, z0 = -6, tall = 18) {
  const r = seeded(seed)
  for (let x = -len / 2; x < len / 2; x += 8) {
    const h = tall + Math.floor(r() * 4) * 4
    out.push({ p: [x + 4, h / 2, z0], s: [7.8, h, 10], c: fronts[Math.floor(r() * fronts.length)] })
    for (let fl = 1; fl < h / 3.2; fl++) for (const dx of [-2, 2]) out.push({ p: [x + 4 + dx, 1.8 + fl * 3.1, z0 + 5.05], s: [1.4, 1.6, 0.1], c: '#3d5a80' })
    out.push({ p: [x + 4, 1.6, z0 + 5.05], s: [6, 2.8, 0.1], c: '#2b2b2b' })
    out.push({ p: [x + 4, 3.4, z0 + 6.2], s: [7, 0.2, 2.4], c: awnings[Math.floor(r() * awnings.length)] })
    for (let k = 0; k < 3; k++) if (r() < 0.7) out.push({ p: [x + 1.6 + k * 2.4, 0.5 + r() * 0.4, z0 + 7], s: [1.4, 0.9 + r() * 0.8, 0.8], c: goods[Math.floor(r() * goods.length)] })
  }
  out.push({ p: [0, 0.05, z0 + 12], s: [len + 8, 0.1, 8], c: '#a6a39c' })
}

/** Xiaobei, Guangzhou: the Tianxiu tower of the wholesalers, the shops of the street — wax and pagnes hung out, phones, hair, the African restaurants' signs among the Chinese ones, the bales and the trolleys of the freight to Lagos and Abidjan — and the people. */
function Xiaobei({ night }: Props) {
  const mat = useBlocks(night, '#ffd9a0', 0.2)
  const neon = useNeon()
  const { at, lit } = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    shopRow(out, 2011, ['#d9dde1', '#c8cdd2', '#e9ecef', '#b8bec5', '#e3dcd2'], ['#c92a2a', '#2f9e44', '#f08c00', '#1c7ed6', '#fab005'], ['#f08c00', '#2f9e44', '#c92a2a', '#7048e8', '#fab005', '#e64980'], 72, -8, 14)
    // The Tianxiu tower behind: two blocks of glass and white, its name's red band.
    out.push({ p: [0, 40, -36], s: [36, 80, 22], c: '#dfe3e6' }, { p: [24, 30, -36], s: [14, 60, 18], c: '#cdd3d8' })
    for (let f = 0; f < 24; f++) out.push({ p: [0, 4 + f * 3.2, -24.9], s: [34, 1.2, 0.1], c: '#5c7a92' })
    lit.push({ p: [0, 76, -24.8], s: [20, 3, 0.2], c: '#e03131' })
    // The shop signs, lit: red Chinese boards and the restaurants' colours (green-white-green, orange-white-green, red-yellow-green).
    const r = seeded(86)
    const signs = ['#e03131', '#2f9e44', '#f08c00', '#e03131', '#fab005', '#1c7ed6', '#e03131', '#12b886', '#e03131']
    for (let i = 0; i < 9; i++) lit.push({ p: [-32 + i * 8, 5 + r() * 2, -2.8], s: [6, 1.4, 0.15], c: signs[i] })
    // Wax hung out to sell, the pagnes on their rails; the bales of the freight, the trolleys.
    for (let i = 0; i < 12; i++) out.push({ p: [-33 + i * 6, 2.2, 0], s: [0.1, 2.2, 1.4], c: ['#f08c00', '#2f9e44', '#c92a2a', '#7048e8', '#fab005'][Math.floor(r() * 5)] })
    for (let i = 0; i < 8; i++) out.push({ p: [-26 + i * 7, 0.7 + (i % 2) * 0.7, 8], s: [1.6, 1.4, 1.4], c: i % 3 ? '#c8a878' : '#5c7cfa' })
    for (const x of [-12, 9]) out.push({ p: [x, 0.5, 9], s: [1.2, 0.1, 0.8], c: '#495057' }, { p: [x + 0.6, 0.9, 9], s: [0.1, 0.9, 0.8], c: '#495057' })
    streetLife(out, 'asie', -34, 34, 14, 2011)
    return { at: out, lit }
  }, [])
  const people = usePeople('xiaobei', [
    { p: [2, 0.1, 5], ry: 0, pose: 'talk', dress: { outfit: 'boubou', outfitColor: '#1c7ed6' } },
    { p: [3.4, 0.1, 5.6], ry: Math.PI, pose: 'talk' },
    { p: [-10, 0.1, 6], ry: 1.2, pose: 'walk', dress: { outfit: 'pagne', outfitColor: '#f08c00' } },
    { p: [14, 0.1, 4], ry: -1, pose: 'phone' },
    { p: [-20, 0.1, 7], ry: 2, pose: 'push' },
    { p: [20, 0.1, 6], ry: -2.2, pose: 'pay' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={lit} material={neon} color />
      <People list={people} />
    </group>
  )
}

/** The Shibuya crossing: the zebra stripes every way at once, the towers round it with their giant screens and neon, the station's side, the crowd crossing. */
function Shibuya({ night }: Props) {
  const mat = useBlocks(night, '#e8f0ff', 0.15)
  const neon = useNeon()
  const { at, lit } = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    // The asphalt, the stripes: four sides and the two diagonals.
    out.push({ p: [0, 0.04, 0], s: [64, 0.08, 64], c: '#3a3d42' })
    const zebra = (x: number, z: number, ry: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const o = -((n - 1) * 1.4) / 2 + i * 1.4
        out.push({ p: [x + Math.cos(ry) * o, 0.1, z - Math.sin(ry) * o], s: [0.7, 0.05, 6], ry, c: '#f1f3f5' })
      }
    }
    zebra(0, 22, 0, 18)
    zebra(0, -22, 0, 18)
    zebra(22, 0, Math.PI / 2, 18)
    zebra(-22, 0, Math.PI / 2, 18)
    zebra(0, 0, Math.PI / 4, 22)
    zebra(0, 0, -Math.PI / 4, 22)
    // The towers at the corners, their screens.
    const corners: [number, number, number, number, string][] = [
      [-44, -44, 24, 48, '#c8ccd2'],
      [44, -44, 26, 36, '#d9d4cc'],
      [0, -52, 22, 30, '#b8bec5'],
      [50, 8, 20, 42, '#e3e6ea'],
    ]
    const r = seeded(2000)
    const screen = ['#4dabf7', '#f783ac', '#ffd43b', '#69db7c', '#b197fc', '#ff922b']
    corners.forEach(([x, z, w, h, c]) => {
      out.push({ p: [x, h / 2, z], s: [w, h, w], c })
      // The windows on the faces seen from the crossing (+z, and the side toward it), the screens and the neon.
      for (let f = 1; f < h / 3.4; f++) {
        out.push({ p: [x, f * 3.4, z + w / 2 + 0.05], s: [w - 2, 1.2, 0.1], c: '#556677' })
        if (x !== 0) out.push({ p: [x - Math.sign(x) * (w / 2 + 0.05), f * 3.4, z], s: [0.1, 1.2, w - 2], c: '#556677' })
      }
      lit.push({ p: [x, h * 0.62, z + w / 2 + 0.2], s: [w * 0.8, h * 0.32, 0.2], c: screen[Math.floor(r() * screen.length)] })
      for (let k = 0; k < 4; k++) lit.push({ p: [x - w / 2 + 1.5 + k * ((w - 3) / 3), 5 + (k % 2) * 3, z + w / 2 + 0.4], s: [1.4, 4, 0.3], c: screen[Math.floor(r() * screen.length)] })
    })
    // The station's long low front on one side, the Hachikō statue on its plinth.
    out.push({ p: [-50, 6, 4], s: [20, 12, 30], c: '#9aa5b1' })
    for (let k = 0; k < 6; k++) out.push({ p: [-39.9, 4, -6 + k * 4], s: [0.1, 3, 2.6], c: '#4a5b6c' })
    out.push({ p: [-32, 0.6, 14], s: [2.2, 1.2, 1.6], c: '#8a8f94' }, { p: [-32, 1.8, 14], s: [0.8, 1.2, 1.6], c: '#6b5a3a' }, { p: [-32, 2.6, 14.6], s: [0.6, 0.6, 0.6], c: '#6b5a3a' })
    // The traffic lights.
    for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) out.push({ p: [x, 2.5, z], s: [0.25, 5, 0.25], c: '#3a3a3a' }, { p: [x, 4.6, z], s: [0.6, 1.4, 0.5], c: '#1a1a1a' })
    streetLife(out, 'asie', -28, 28, 40, 2000)
    return { at: out, lit }
  }, [])
  const crowd = useMemo(() => {
    const r = seeded(109)
    const out: { p: [number, number, number]; ry: number; pose: 'walk' | 'phone' }[] = []
    for (let i = 0; i < 14; i++) {
      const t = r() * 2 - 1
      const diag = i % 2 ? 1 : -1
      out.push({ p: [t * 20, 0.1, t * 20 * diag + (r() - 0.5) * 3], ry: diag > 0 ? Math.PI / 4 : -Math.PI / 4 + (r() < 0.5 ? Math.PI : 0), pose: r() < 0.2 ? 'phone' : 'walk' })
    }
    return out
  }, [])
  const people = usePeople('shibuya', crowd)
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <Blocks at={lit} material={neon} color />
      <People list={people} />
    </group>
  )
}

/** Sensō-ji: the Kaminarimon (the Thunder gate) and its great red lantern, the Nakamise stalls, the main hall and the five-storey pagoda. */
function Sensoji({ night }: Props) {
  const mat = useBlocks(night, '#ffd8a0', 0.25)
  const at = useMemo(() => {
    const out: At[] = []
    const ROOF = '#4a4f57'
    // The gate: red posts, the roof, the lantern.
    out.push({ p: [0, 4, 14], s: [16, 8, 6], c: RED })
    out.push({ p: [0, 4, 17.05], s: [4.4, 7.6, 0.1], c: '#2b1d16' })
    for (let i = 0; i < 3; i++) out.push({ p: [0, 8.6 + i * 0.8, 14], s: [20 - i * 4, 0.8, 9 - i * 2], c: ROOF })
    out.push({ p: [0, 4.2, 17.3], s: [3.2, 3.8, 3.2], c: '#d6336c' }, { p: [0, 4.2, 18.95], s: [2, 1.6, 0.05], c: '#1a1a1a' }, { p: [0, 2.2, 17.3], s: [2.4, 0.3, 2.4], c: '#1a1a1a' })
    // The Nakamise: two rows of red-roofed stalls to the temple.
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      out.push({ p: [side * 8, 2, 4 - i * 6], s: [5, 4, 5.4], c: '#f1e3c8' }, { p: [side * 8, 4.3, 4 - i * 6], s: [6, 0.6, 6], c: RED })
    }
    // The main hall: on its platform, the steep great roof.
    out.push({ p: [0, 1, -44], s: [40, 2, 30], c: '#c9c4ba' }, { p: [0, 8, -44], s: [32, 12, 22], c: RED })
    for (let i = 0; i < 5; i++) out.push({ p: [0, 15 + i * 1.6, -44], s: [42 - i * 6, 1.6, 30 - i * 4], c: ROOF })
    // The pagoda: five storeys, each its roof, the gilded finial.
    for (let i = 0; i < 5; i++) {
      out.push({ p: [-30, 3 + i * 6, -30], s: [7 - i * 0.6, 5, 7 - i * 0.6], c: RED })
      out.push({ p: [-30, 6 + i * 6, -30], s: [11 - i * 0.8, 0.9, 11 - i * 0.8], c: ROOF })
    }
    out.push({ p: [-30, 37, -30], s: [0.6, 8, 0.6], c: GOLD })
    for (let k = 0; k < 6; k++) out.push({ p: [-30, 33 + k * 1.2, -30], s: [1.4, 0.3, 1.4], c: GOLD })
    // The incense burner.
    out.push({ p: [0, 1, -24], s: [3, 2, 3], c: '#5c5045' }, { p: [0, 2.6, -24], s: [4, 0.5, 4], c: '#4a4038' })
    out.push({ p: [0, 0.05, 26], s: [60, 0.1, 18], c: '#a8a398' })
    streetLife(out, 'asie', -28, 28, 30, 645)
    return out
  }, [])
  const people = usePeople('sensoji', [
    { p: [2, 0.1, 22], ry: Math.PI, pose: 'film' },
    { p: [-3, 0.1, 6], ry: Math.PI, pose: 'walk', dress: { outfit: 'pagne', outfitColor: '#e64980' } },
    { p: [4, 0.1, -8], ry: 0, pose: 'walk' },
    { p: [0.5, 0.1, -21], ry: Math.PI, pose: 'pray' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Fushimi Inari: the tunnel of vermilion torii up the hill, the shrine's gate and its foxes at the bottom. */
function Fushimi({ night }: Props) {
  const mat = useBlocks(night, '#ffd0a0', 0.2)
  const at = useMemo(() => {
    const out: At[] = []
    const V = '#e8590c'
    const torii = (x: number, y: number, z: number, ry: number, w: number, h: number) => {
      const cx = Math.cos(ry)
      const sz = -Math.sin(ry)
      for (const s of [-1, 1]) out.push({ p: [x + cx * s * (w / 2), y + h / 2, z + sz * s * (w / 2)], s: [0.5, h, 0.5], ry, c: V })
      out.push({ p: [x, y + h - 0.8, z], s: [w + 0.4, 0.4, 0.4], ry, c: V })
      out.push({ p: [x, y + h + 0.1, z], s: [w + 1.6, 0.5, 0.6], ry, c: '#1a1a1a' })
    }
    // The great gate.
    torii(0, 0, 14, 0, 9, 10)
    out.push({ p: [0, 5, -6], s: [18, 10, 10], c: V }, { p: [0, 10.8, -6], s: [22, 1.6, 14], c: '#3a3f46' })
    for (const s of [-1, 1]) out.push({ p: [s * 7, 1.5, 6], s: [1.2, 3, 1.2], c: '#c9c4ba' }, { p: [s * 7, 3.6, 6], s: [0.8, 1.4, 1.4], c: '#d8d2c4' })
    // The thousand torii: a path up and round the hill.
    for (let i = 0; i < 70; i++) {
      const t = i / 70
      const a = t * Math.PI * 1.3
      const x = 22 + Math.sin(a) * 26
      const z = -20 - Math.cos(a) * 26 + 26
      const y = t * 16
      torii(x, y, z, a, 2.6, 3.4)
      out.push({ p: [x, y - 0.4, z], s: [3.4, 0.8, 1.1], ry: a, c: '#8d7a5c' })
    }
    // The hill's forest.
    const r = seeded(711)
    for (let i = 0; i < 26; i++) {
      const x = -20 + r() * 80
      const z = -60 + r() * 50
      out.push({ p: [x, 6 + r() * 6, z], s: [6 + r() * 4, 10 + r() * 8, 6 + r() * 4], c: r() < 0.5 ? '#3f6b35' : '#4f7d3e' })
    }
    out.push({ p: [0, 0.05, 24], s: [50, 0.1, 18], c: '#b8b2a4' })
    streetLife(out, 'asie', -22, 22, 30, 711)
    return out
  }, [])
  const people = usePeople('fushimi', [
    { p: [1, 0.1, 18], ry: Math.PI, pose: 'film' },
    { p: [-4, 0.1, 10], ry: 0, pose: 'walk' },
    { p: [3, 0.1, 2], ry: Math.PI, pose: 'pray' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** A triumphal arch of stone toward +z (India Gate, the Gateway of India). */
function arch(out: At[], w: number, h: number, d: number, open: number, c: string, c2: string) {
  const pier = (w - open) / 2
  for (const s of [-1, 1]) out.push({ p: [s * (open / 2 + pier / 2), h / 2, 0], s: [pier, h, d], c })
  out.push({ p: [0, h * 0.85, 0], s: [open, h * 0.3, d], c })
  // The arch's curve, in steps.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI
    out.push({ p: [Math.cos(a) * (open / 2 - 0.6), h * 0.7 + Math.sin(a) * 2, d / 2 + 0.05], s: [1.6, 1.2, 0.1], c: c2 })
  }
}

/** India Gate (42 m): the arch of red and buff sandstone, its cornice and its dome-topped attic; the lawns and the eternal flame. */
function IndiaGate({ night }: Props) {
  const mat = useBlocks(night, '#ffd8a0', 0.25)
  const at = useMemo(() => {
    const out: At[] = []
    const S = '#d9b38a'
    arch(out, 24, 34, 9, 10, S, '#c08a5e')
    out.push({ p: [0, 35, 0], s: [26, 2, 11], c: '#c08a5e' }, { p: [0, 38, 0], s: [20, 4, 8], c: S })
    dome(out, [0, 40, 0], 4, 4, S, '#c08a5e', 0.5)
    for (let i = 0; i < 3; i++) out.push({ p: [0, 3 + i * 9, 4.6], s: [9, 0.6, 0.2], c: '#a86a42' })
    // The flame's urns, the lawns, the avenue.
    out.push({ p: [0, 0.8, 14], s: [3, 1.6, 3], c: '#495057' }, { p: [0, 2.2, 14], s: [1, 1.2, 1], c: '#ff922b' })
    out.push({ p: [0, 0.05, 30], s: [120, 0.1, 40], c: '#7fae5a' }, { p: [0, 0.07, 30], s: [14, 0.1, 40], c: '#c9c0ac' })
    streetLife(out, 'asie', -40, 40, 48, 1931)
    return out
  }, [])
  const people = usePeople('india-gate', [
    { p: [6, 0.1, 22], ry: Math.PI, pose: 'film' },
    { p: [-10, 0.1, 26], ry: 0.5, pose: 'sit' },
    { p: [14, 0.1, 30], ry: 2.6, pose: 'snack' },
    { p: [-2, 0.1, 34], ry: 3, pose: 'walk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The Gateway of India (26 m): the basalt arch on the waterfront, its four turrets, the boats to Elephanta at the steps. */
function Gateway({ night }: Props) {
  const mat = useBlocks(night, '#ffe0b0', 0.25)
  const at = useMemo(() => {
    const out: At[] = []
    const B = '#c9b48f'
    arch(out, 26, 20, 14, 10, B, '#a8936d')
    out.push({ p: [0, 21, 0], s: [28, 2, 15], c: '#a8936d' })
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      octo(out, [sx * 11.5, 25, sz * 5.5], 3.4, 6, B)
      dome(out, [sx * 11.5, 28, sz * 5.5], 1.8, 3, B, '#a8936d')
    }
    dome(out, [0, 22, 0], 5, 4, B, '#a8936d', 0.6)
    // The sea behind (toward −z), the boats.
    out.push({ p: [0, -0.4, -40], s: [140, 0.2, 50], c: '#5b7e8f' })
    for (let i = 0; i < 5; i++) out.push({ p: [-24 + i * 12, 0.4, -24], s: [3, 0.8, 8], c: ['#f1f3f5', '#1c7ed6', '#e8590c'][i % 3] })
    out.push({ p: [0, 0.05, 22], s: [80, 0.1, 28], c: '#bdb6a8' })
    streetLife(out, 'asie', -36, 36, 34, 1924)
    return out
  }, [])
  const people = usePeople('gateway', [
    { p: [4, 0.1, 14], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 18], ry: 0.5, pose: 'walk' },
    { p: [10, 0.1, 20], ry: 2.2, pose: 'snack' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Wat Arun (the temple of Dawn): the central prang, 70 m, stepped and covered in porcelain, its four small prangs, by the river. */
function WatArun({ night }: Props) {
  const mat = useBlocks(night, '#fff0d0', 0.25)
  const at = useMemo(() => {
    const out: At[] = []
    const W = '#e9e4da'
    const prang = (x: number, z: number, base: number, h: number) => {
      const n = 10
      for (let i = 0; i < n; i++) {
        const k = 1 - i / n
        out.push({ p: [x, (h / n) * (i + 0.5), z], s: [base * (0.25 + 0.75 * k), h / n, base * (0.25 + 0.75 * k)], c: i % 2 ? W : '#d2c6b2' })
        out.push({ p: [x, (h / n) * (i + 0.5), z], s: [base * (0.25 + 0.75 * k) * 0.92, h / n, base * (0.25 + 0.75 * k) * 1.04], ry: Math.PI / 4, c: i % 3 ? '#cfe0e6' : '#e6b8c8' })
      }
      out.push({ p: [x, h + 2, z], s: [0.8, 4, 0.8], c: GOLD })
    }
    prang(0, -10, 30, 60)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) prang(sx * 22, -10 + sz * 22, 9, 22)
    out.push({ p: [0, 1, -10], s: [60, 2, 60], c: '#d8d2c4' })
    // The river in front, a long-tail boat.
    out.push({ p: [0, -0.4, 40], s: [160, 0.2, 40], c: '#7a6a4a' }, { p: [10, 0.3, 36], s: [12, 0.6, 1.8], c: '#8a5a3a' })
    out.push({ p: [0, 0.05, 20], s: [80, 0.1, 14], c: '#bdb6a8' })
    streetLife(out, 'asie', -36, 36, 26, 1842)
    return out
  }, [])
  const people = usePeople('wat-arun', [
    { p: [4, 0.1, 18], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 20], ry: 0.5, pose: 'walk' },
    { p: [0, 2.1, 22 - 30], ry: 0, pose: 'pray' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Hoàn Kiếm lake: the red wooden Thê Húc bridge arching to the Ngọc Sơn temple's islet, the lake, the scooters parked on the shore. */
function NgocSon({ night }: Props) {
  const mat = useBlocks(night, '#ffd8a0', 0.3)
  const at = useMemo(() => {
    const out: At[] = []
    out.push({ p: [0, -0.3, -30], s: [140, 0.2, 70], c: '#5f8a70' })
    // The bridge: an arc of red planks and rails.
    for (let i = 0; i < 18; i++) {
      const t = i / 17
      const z = 6 - t * 30
      const y = Math.sin(t * Math.PI) * 3 + 0.4
      out.push({ p: [0, y, z], s: [3.4, 0.3, 1.8], c: RED })
      for (const s of [-1, 1]) out.push({ p: [s * 1.6, y + 0.6, z], s: [0.15, 1.2, 1.7], c: RED_D })
    }
    // The gate at the shore, the temple on its islet among the trees.
    for (const s of [-1, 1]) out.push({ p: [s * 3, 3, 8], s: [0.8, 6, 0.8], c: '#e9e4da' })
    out.push({ p: [0, 6.4, 8], s: [7.6, 0.8, 1.2], c: '#e9e4da' })
    out.push({ p: [0, 0.6, -32], s: [24, 1.2, 18], c: '#8a8070' }, { p: [0, 3.5, -34], s: [14, 5, 9], c: '#c9a46a' })
    for (let i = 0; i < 3; i++) out.push({ p: [0, 6.5 + i * 0.7, -34], s: [17 - i * 4, 0.7, 11 - i * 2], c: '#6b4a3a' })
    for (const [x, z] of [[-9, -28], [9, -28], [-8, -38], [8, -38]]) out.push({ p: [x, 4, z], s: [5, 6, 5], c: '#3f7d3a' }, { p: [x, 0.8, z], s: [0.6, 1.6, 0.6], c: '#5a4632' })
    // The Turtle tower far on the lake.
    out.push({ p: [34, 4, -50], s: [5, 8, 4], c: '#d8cfc0' }, { p: [34, 8.6, -50], s: [3, 1.2, 2.6], c: '#c9bfae' })
    // The shore, the scooters in rows.
    out.push({ p: [0, 0.05, 18], s: [100, 0.1, 16], c: '#b8b2a4' })
    const r = seeded(1865)
    for (let i = 0; i < 18; i++) {
      const x = -34 + i * 2.2 + (i > 8 ? 30 : 0)
      const c = ['#1c7ed6', '#c92a2a', '#f1f3f5', '#2b2b2b', '#e8590c'][Math.floor(r() * 5)]
      out.push({ p: [x, 0.4, 14], s: [0.5, 0.35, 1.6], c }, { p: [x, 0.75, 13.6], s: [0.5, 0.3, 0.7], c: '#1a1a1a' }, { p: [x, 0.9, 14.6], s: [0.1, 0.6, 0.1], c: '#3a3a3a' })
    }
    streetLife(out, 'asie', -40, 40, 22, 1865)
    return out
  }, [])
  const people = usePeople('ngoc-son', [
    { p: [0.5, 0.2, 10], ry: Math.PI, pose: 'walk' },
    { p: [-6, 0.1, 18], ry: 0.4, pose: 'sit' },
    { p: [8, 0.1, 20], ry: -2, pose: 'talk' },
    { p: [10, 0.1, 15], ry: 0, pose: 'pedal' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** The twin towers of Kuala Lumpur (452 m): the two steel shafts of eight-pointed floors, narrowing in tiers, the sky bridge, the spires. */
function ToursJumelles({ night }: Props) {
  const mat = useBlocks(night, '#e8f0ff', 0.35)
  const at = useMemo(() => {
    const out: At[] = []
    const S = '#c9d1d9'
    const tower = (x: number) => {
      const tiers: [number, number][] = [[18, 70], [15, 30], [12, 20], [9, 14], [6, 10]]
      let y = 0
      tiers.forEach(([w, h], i) => {
        octo(out, [x, y + h / 2, 0], w, h, i % 2 ? S : '#aeb8c2', i % 2 ? '#aeb8c2' : S)
        y += h
        octo(out, [x, y + 0.4, 0], w + 0.6, 0.8, '#7d8a96')
      })
      out.push({ p: [x, y + 12, 0], s: [1, 24, 1], c: S }, { p: [x, y + 2, 0], s: [3, 4, 3], c: S })
    }
    tower(-18)
    tower(18)
    // The sky bridge, its legs.
    out.push({ p: [0, 62, 0], s: [22, 3, 4], c: '#7d8a96' })
    for (const s of [-1, 1]) out.push({ p: [s * 5, 50, 0], s: [1, 26, 1], ry: s * 0.4, c: '#7d8a96' })
    out.push({ p: [0, 0.05, 34], s: [100, 0.1, 30], c: '#7fae5a' }, { p: [0, 0.3, 40], s: [30, 0.2, 14], c: '#5b9fc4' })
    streetLife(out, 'asie', -40, 40, 26, 1998)
    return out
  }, [])
  const people = usePeople('klcc', [
    { p: [4, 0.1, 22], ry: Math.PI, pose: 'film' },
    { p: [-8, 0.1, 28], ry: 0.5, pose: 'walk' },
    { p: [12, 0.1, 30], ry: 2.2, pose: 'phone' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

/** Angkor Wat: the moat and its causeway, the galleries round, the five towers in lotus buds on their terraces. */
function AngkorWat({ night }: Props) {
  const mat = useBlocks(night, '#ffe0b0', 0.12)
  const at = useMemo(() => {
    const out: At[] = []
    const G = '#9c9583'
    const G2 = '#857e6d'
    out.push({ p: [0, -0.3, 30], s: [180, 0.2, 20], c: '#5f8a70' }, { p: [0, 0.4, 30], s: [8, 0.8, 22], c: G })
    // The terraces, rising.
    for (let i = 0; i < 3; i++) out.push({ p: [0, 2 + i * 4, -30], s: [90 - i * 22, 4, 70 - i * 18], c: i % 2 ? G2 : G })
    // The galleries' roofs.
    for (const s of [-1, 1]) out.push({ p: [s * 44, 5, -30], s: [2, 6, 70], c: G2 }, { p: [0, 5, -30 + s * 34], s: [90, 6, 2], c: G2 })
    // The five towers: the lotus buds.
    const tower = (x: number, z: number, y: number, h: number, w: number) => {
      for (let i = 0; i < 9; i++) {
        const k = i < 3 ? 1 : 1 - (i - 3) / 7
        octo(out, [x, y + (h / 9) * (i + 0.5), z], w * k, h / 9 + 0.02, i % 2 ? G : G2)
      }
    }
    tower(0, -30, 14, 30, 12)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * 16, -30 + sz * 14, 10, 20, 8)
    out.push({ p: [0, 0.05, 50], s: [80, 0.1, 20], c: '#b8a888' })
    // The palms of the causeway's end.
    for (const x of [-30, -18, 18, 30]) out.push({ p: [x, 5, 44], s: [0.5, 10, 0.5], c: '#7a6040' }, { p: [x, 10.2, 44], s: [4, 0.6, 4], c: '#4f8f3e' })
    streetLife(out, 'asie', -30, 30, 56, 1150)
    return out
  }, [])
  const people = usePeople('angkor', [
    { p: [2, 0.9, 30], ry: Math.PI, pose: 'film' },
    { p: [-2, 0.9, 26], ry: 0, pose: 'walk' },
    { p: [10, 0.1, 50], ry: 2.6, pose: 'talk' },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
    </group>
  )
}

export function AsieLandmark({ id, night }: { id: string; night: boolean }) {
  switch (id) {
    case 'pekin-cite-interdite':
      return <CiteInterdite night={night} />
    case 'badaling-muraille':
      return <GrandeMuraille night={night} />
    case 'sh-perle':
      return <PerleOrient night={night} />
    case 'gz-xiaobei-tianxiu':
      return <Xiaobei night={night} />
    case 'tokyo-croisement':
      return <Shibuya night={night} />
    case 'tokyo-sensoji':
      return <Sensoji night={night} />
    case 'kyoto-fushimi':
      return <Fushimi night={night} />
    case 'delhi-india-gate':
      return <IndiaGate night={night} />
    case 'mumbai-gateway':
      return <Gateway night={night} />
    case 'bkk-wat-arun':
      return <WatArun night={night} />
    case 'hanoi-ngoc-son':
      return <NgocSon night={night} />
    case 'kl-tours':
      return <ToursJumelles night={night} />
    case 'rep-angkor-wat':
      return <AngkorWat night={night} />
    default:
      return null
  }
}
