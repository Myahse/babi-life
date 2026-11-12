import { useMemo } from 'react'
import * as THREE from 'three'
import { Blocks, lettering, signMaterial } from './ruePrincesse'
import type { At } from './shoreline'
import { blocksMat, put, seeded, type Part } from './kit3d'
import { People, plasticSet, usePeople, type Who } from './villeKit'
import { Vehicle } from '../vehicles'
import { CARREFOURS, ZONE_COLOURS, type ZoneStyle } from './quartiers'
import { t as tr } from '../../lib/i18n'

// The communes in detail (the update « communes-detail », quartiers.ts). A carrefour's corner, as
// everybody knows one: the tall green sign with its name over the kerb, the kiosk of phone credit and
// the tantie's garba under her parasol, the woro-woro waiting for fares, a bench, a lamp, people
// waiting for someone. And a zone's sign by the road (the industrial zone's blue board with its
// containers and a lorry, the market's orange one with its parasols…). All of a place's blocks in one
// list, one draw; the signs a plane each; the people only close by. Nothing moves: no work per frame
// but the people's own and the parked car's distance check.
//
// Frame: +z toward the street (the front at +z = CARREFOUR_FRONT), x along it.

const MAT = blocksMat()
const LAMP_ON = new THREE.MeshBasicMaterial({ color: '#fff2cc' })

/** A lettered sign's material and shape, made once per text (several carrefours share the kiosks' words). */
const signs = new Map<string, { m: THREE.MeshLambertMaterial; aspect: number }>()
function sign(text: string, bg: string, ink: string, border = ink) {
  const k = `${text}|${bg}|${ink}|${border}`
  let s = signs.get(k)
  if (!s) {
    const l = lettering(text, bg, ink, border)
    signs.set(k, (s = { m: signMaterial(l.t), aspect: l.aspect }))
  }
  return s
}

/** A sign's two faces (front and back), `w` wide, at p, turned ry. */
function Board({ s, w, p, ry = 0, night, glow = 0.7 }: { s: { m: THREE.MeshLambertMaterial; aspect: number }; w: number; p: [number, number, number]; ry?: number; night: boolean; glow?: number }) {
  s.m.emissiveIntensity = night ? glow : 0
  const h = w / s.aspect
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh material={s.m} position={[0, 0, 0.07]}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={s.m} position={[0, 0, -0.07]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  )
}

/** A kiosk: its box in its colour, its counter, its roof sticking out over the front. */
const kiosk = (c: string): Part[] => [
  [0, 1.2, 0, 2.4, 2.4, 1.8, c],
  [0, 1.05, 0.95, 2.2, 0.08, 0.35, '#f1ece2'],
  [0, 2.5, 0.25, 2.8, 0.14, 2.5, '#d9dde2'],
  [0, 1.6, 0.91, 1.9, 0.9, 0.02, '#2b2b30'],
]
/** A parasol on its pole, the tantie's table under it. */
const parasol = (c: string): Part[] => [
  [0, 1.2, 0, 0.06, 2.4, 0.06, '#d9dde2'],
  [0, 2.4, 0, 2.4, 0.12, 2.4, c],
  [0, 2.52, 0, 1.6, 0.12, 1.6, c],
  [0, 0.75, 0, 1.4, 0.06, 0.8, '#7a5233'],
  [0.5, 0.38, 0.3, 0.06, 0.75, 0.06, '#5a3a22'],
  [-0.5, 0.38, 0.3, 0.06, 0.75, 0.06, '#5a3a22'],
  [0.3, 0.86, 0, 0.5, 0.18, 0.5, '#e8a33d'],
  [-0.3, 0.86, 0, 0.5, 0.18, 0.5, '#f4f1e6'],
]
const KIOSK_COLOURS = ['#ff7900', '#1971c2', '#2b8a3e', '#f59f00', '#c92a2a', '#7048e8']
const PARASOL_COLOURS = ['#e03131', '#1c7ed6', '#f08c00', '#2f9e44']

const hashOf = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0

export function Carrefour({ id, night }: { id: string; night: boolean }) {
  const name = CARREFOURS[id] ?? ''
  const seed = hashOf(id)
  const { blocks, lamps } = useMemo(() => {
    const r = seeded(seed)
    const out: At[] = []
    // The corner's paving and its kerb on the street side.
    out.push({ p: [0, 0.05, 0], s: [14, 0.1, 10], c: '#c8c0b2' }, { p: [0, 0.12, 5.1], s: [14, 0.24, 0.3], c: '#e9ecef' })
    // The tall sign: its two posts on a plinth, at the corner by the kerb (the board itself is a plane).
    out.push({ p: [-4.4, 0.3, 3.6], s: [4.6, 0.6, 1.1], c: '#8a8f98' })
    for (const x of [-6.3, -2.5]) out.push({ p: [x, 3.3, 3.6], s: [0.28, 6, 0.28], c: '#c7ccd2' })
    out.push({ p: [-4.4, 6.55, 3.6], s: [5.4, 1.5, 0.12], c: '#0b5f36' })
    // The kiosks along the back, a parasol and its table, a plastic set, a bench.
    const k = Math.floor(r() * KIOSK_COLOURS.length)
    put(out, [-1.4, -3.4, 0], kiosk(KIOSK_COLOURS[k]))
    put(out, [1.4, -3.4, 0], kiosk(KIOSK_COLOURS[(k + 2) % KIOSK_COLOURS.length]))
    put(out, [4.9, -2, 0], parasol(PARASOL_COLOURS[Math.floor(r() * PARASOL_COLOURS.length)]))
    put(out, [4.9, 1.9, r()], plasticSet(r() < 0.5 ? '#f8f9fa' : '#e03131'))
    out.push({ p: [0.8, 0.45, 2.4], s: [2.4, 0.1, 0.5], c: '#7a5233' }, { p: [-0.2, 0.22, 2.4], s: [0.12, 0.44, 0.4], c: '#3a3d42' }, { p: [1.8, 0.22, 2.4], s: [0.12, 0.44, 0.4], c: '#3a3d42' })
    // A lamp post at the corner, a few planters.
    out.push({ p: [6.6, 2.8, 4.3], s: [0.16, 5.6, 0.16], c: '#3a3d42' }, { p: [6, 5.55, 4.3], s: [1.3, 0.12, 0.3], c: '#3a3d42' })
    for (const x of [-6.2, 6.2]) out.push({ p: [x, 0.35, -4.2], s: [1, 0.5, 1], c: '#9a8f80' }, { p: [x, 0.85, -4.2], s: [0.9, 0.6, 0.9], c: '#2f9e44' })
    const lamps: At[] = [{ p: [5.5, 5.45, 4.3], s: [0.5, 0.1, 0.25], c: '#fff2cc' }]
    return { blocks: out, lamps }
  }, [seed])
  const board = sign(name, '#0b5f36', '#ffffff', '#ffffff')
  const credit = sign(tr('CRÉDIT · TRANSFERT'), '#ffffff', '#1c1c1e', '#ff7900')
  const garba = sign(tr('GARBA · ALLOCO'), '#ffd43b', '#c92a2a', '#c92a2a')
  const people = usePeople(`carrefour:${id}`, PEOPLE)
  return (
    <group>
      <Blocks at={blocks} material={MAT} color />
      <Blocks key={night ? 'n' : 'd'} at={lamps} material={night ? LAMP_ON : MAT} color={!night} />
      <Board s={board} w={5.1} p={[-4.4, 6.55, 3.6]} night={night} glow={0.8} />
      <Board s={credit} w={2.2} p={[-1.4, 2.25, -2.4]} night={night} />
      <Board s={garba} w={2.2} p={[1.4, 2.25, -2.4]} night={night} />
      {/* The woro-woro waiting along the kerb for its fares */}
      <group position={[2, 0, 9.6]}>
        <Vehicle p={[0, 0, 0]} kind="woro" trim={seed % 2 ? '#2f9e44' : '#f4c430'} />
      </group>
      <People list={people} />
    </group>
  )
}

/** Who waits at the corner: for a friend, for a woro-woro, at the tantie's, on the bench. */
const PEOPLE: Who[] = [
  { p: [-1.5, 0, 4.1], ry: 0.2, pose: 'phone' },
  { p: [2.6, 0, 4.2], ry: -0.3, pose: 'talk' },
  { p: [3.2, 0, 4.6], ry: 2.8, pose: 'talk' },
  { p: [0.4, 0, 2.4], ry: 0, pose: 'sit' },
  { p: [4.9, 0, -2.9], ry: 0, pose: 'idle', dress: { outfit: 'pagne', outfitColor: '#e8590c' }, gender: 'femme' },
  { p: [4.4, 0, -0.6], ry: 2.6, pose: 'idle' },
  { p: [-1.4, 0, -1.7], ry: Math.PI, pose: 'phone' },
]

/* ---------- A zone's sign by the road ---------- */

/** What stands by a zone's sign, by its kind: containers and a lorry at an industrial zone, stalls at a market… */
function zoneParts(style: ZoneStyle, r: () => number): Part[] {
  const out: Part[] = []
  switch (style) {
    case 'industrie': {
      // A warehouse's end wall and its corrugated roof behind, containers stacked, a fence.
      out.push([0, 3.2, -9, 14, 6.4, 6, '#b8bec6'], [0, 6.6, -9, 14.6, 0.4, 6.6, '#8a929c'], [0, 2.2, -5.95, 5, 4.4, 0.1, '#5c6370'])
      const cols = ['#c92a2a', '#1c7ed6', '#2f9e44', '#f08c00']
      out.push([9, 1.3, -4, 6, 2.6, 2.4, cols[Math.floor(r() * 4)]], [9, 3.9, -4, 6, 2.6, 2.4, cols[Math.floor(r() * 4)]], [9, 1.3, -1.4, 6, 2.6, 2.4, cols[Math.floor(r() * 4)]])
      for (let x = -9; x <= 3; x += 1.5) out.push([x, 1, 1.2, 0.08, 2, 0.08, '#6c757d'])
      out.push([-3, 1.9, 1.2, 12.2, 0.06, 0.06, '#6c757d'], [-3, 1, 1.2, 12.2, 0.06, 0.06, '#6c757d'])
      // A lorry at the gate: its cab, its container on the trailer, its wheels.
      out.push([-8.6, 1.5, -2.6, 2, 2.2, 2.3, '#e9ecef'], [-8.6, 2, -2.6, 0.05, 0.8, 2, '#2b2b30'], [-4.2, 0.9, -2.6, 6.8, 0.3, 2.3, '#3a3d42'], [-4.2, 2.35, -2.6, 6.4, 2.6, 2.4, cols[Math.floor(r() * 4)]])
      for (const x of [-8.6, -5.6, -2]) out.push([x, 0.45, -1.4, 0.9, 0.9, 0.3, '#1c1c1e'], [x, 0.45, -3.8, 0.9, 0.9, 0.3, '#1c1c1e'])
      break
    }
    case 'marche':
      for (let i = 0; i < 4; i++) {
        const c = PARASOL_COLOURS[(i + Math.floor(r() * 4)) % 4]
        out.push([-6 + i * 3.6, 2.4, -2.5, 3, 0.12, 3, c], [-6 + i * 3.6, 1.2, -2.5, 0.06, 2.4, 0.06, '#d9dde2'], [-6 + i * 3.6, 0.75, -2.5, 2.2, 0.08, 1.2, '#7a5233'], [-6 + i * 3.6, 0.9, -2.5, 1.8, 0.2, 0.9, i % 2 ? '#e8a33d' : '#2f9e44'])
      }
      break
    case 'gare':
      out.push([0, 2.8, -3, 14, 0.15, 5, '#9aa5b1'])
      for (const x of [-6.5, 0, 6.5]) out.push([x, 1.4, -1, 0.15, 2.8, 0.15, '#6c757d'], [x, 1.4, -5, 0.15, 2.8, 0.15, '#6c757d'])
      break
    case 'sorties':
      for (const x of [-7, -1, 5]) out.push([x, 0.75, -2, 0.9, 0.06, 0.9, '#f8f9fa'], [x, 0.37, -2, 0.1, 0.74, 0.1, '#f8f9fa'])
      break
    case 'campus':
      out.push([-5, 0.9, -1, 9, 1.8, 0.4, '#f2c879'], [5, 0.9, -1, 6, 1.8, 0.4, '#f2c879'])
      break
    case 'village':
    case 'historique':
      out.push([-6, 0.5, -1.5, 1.2, 1, 1.2, '#9a8f80'], [-6, 1.4, -1.5, 1.4, 1, 1.4, '#2f9e44'], [6, 0.5, -1.5, 1.2, 1, 1.2, '#9a8f80'], [6, 1.4, -1.5, 1.4, 1, 1.4, '#2f9e44'])
      break
    default:
      break
  }
  return out
}

/** A zone's sign, beside the road (its two posts, the board in the zone's colours), and what stands by it. */
export function ZoneMark({ name, style, seed, night }: { name: string; style: ZoneStyle; seed: number; night: boolean }) {
  const [bg, ink, trim] = ZONE_COLOURS[style]
  const blocks = useMemo(() => {
    const out: At[] = []
    for (const x of [-3.4, 3.4]) out.push({ p: [x, 2.5, 1.5], s: [0.3, 5, 0.3], c: '#c7ccd2' })
    out.push({ p: [0, 4.4, 1.5], s: [7.6, 1.9, 0.12], c: bg })
    put(out, [0, 0, 0], zoneParts(style, seeded(seed)))
    return out
  }, [style, seed, bg])
  const s = sign(name.toUpperCase(), bg, ink, trim)
  return (
    <group>
      <Blocks at={blocks} material={MAT} color />
      <Board s={s} w={7.2} p={[0, 4.4, 1.5]} night={night} glow={0.75} />
    </group>
  )
}
