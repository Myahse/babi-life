import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NoShadows } from '../../avatar/Human'
import { worldTime } from '../../lib/worldClock'
import { Blocks, PLANE } from './ruePrincesse'
import { Lamps, People, Stroller, type Staff } from './hotelBits'
import { WavingFlag } from './flag'
import { t as tr } from '../../lib/i18n'

// The Palais de la Culture of Treichville, on the lagoon by the pont De
// Gaulle: a long white hall under an orange band, the great salle Anoumabo
// rising from its middle under a curved roof, a deep portico of tall pillars
// with its name across, the flags along the way in, the fountain, the posters
// of the shows and the ticket window (a queue there at night). Its shape is
// the game's: the sources give its halls and size (12 900 m², seven halls,
// the salle Anoumabo of about 4 000 seats), not its plan. Frame: +z the street.

const W = 44 // half its length
const D = 20 // half its depth
const H = 12
/** The salle Anoumabo's block: half its width and depth, its height. */
const HALL = { x: 17, z: 15, h: 21 }
const COURT = 28 // the forecourt, from the facade to the street
const PORCH = 8 // the portico's depth

const white = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const roof = new THREE.MeshLambertMaterial({ color: '#3a8f86' })
const paving = new THREE.MeshLambertMaterial({ color: '#d6cfc0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const water = new THREE.MeshLambertMaterial({ color: '#5fb3d6', emissive: '#1d5f80', emissiveIntensity: 0.2 })
const spray = new THREE.MeshLambertMaterial({ color: '#d7f0fa', transparent: true, opacity: 0.75 })

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** A painted panel: a title over a line or two, on a colour. */
function panel(lines: { text: string; size: number; color: string }[], bg: string, w = 512, h = 256, frame?: string) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  if (frame) {
    g.strokeStyle = frame
    g.lineWidth = 10
    g.strokeRect(8, 8, w - 16, h - 16)
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const total = lines.reduce((s, l) => s + l.size * 1.25, 0)
  let y = (h - total) / 2
  for (const l of lines) {
    g.fillStyle = l.color
    g.font = tr('900 {size}px sans-serif', { size: l.size })
    g.fillText(l.text, w / 2, y + (l.size * 1.25) / 2)
    y += l.size * 1.25
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function PalaisCulture({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const name = new THREE.MeshLambertMaterial({ map: panel([{ text: tr('PALAIS DE LA CULTURE'), size: 84, color: '#7a3a12' }], '#f4efe6', 1600, 140) })
    const shows = [
      panel([{ text: tr('CE SOIR'), size: 34, color: '#ffd166' }, { text: tr('NUIT DU ZOUGLOU'), size: 58, color: '#ffffff' }, { text: tr('SALLE ANOUMABO · 20 H'), size: 30, color: '#ffd166' }], '#7a1f3d', 512, 384, '#ffd166'),
      panel([{ text: tr('THÉÂTRE'), size: 40, color: '#14213d' }, { text: tr('LES CHAISES'), size: 56, color: '#d9480f' }, { text: tr('SALLE KODJO-EBOUCLÉ'), size: 30, color: '#14213d' }], '#ffe8cc', 512, 384, '#d9480f'),
    ].map((map) => new THREE.MeshLambertMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0 }))
    const ticket = new THREE.MeshLambertMaterial({ map: panel([{ text: tr('BILLETTERIE'), size: 60, color: '#ffffff' }], '#d9480f', 512, 110) })
    return { name, shows, ticket }
  }, [])
  for (const m of mats.shows) m.emissiveIntensity = night ? 0.7 : 0
  const blocks = useMemo(() => {
    const b: Block[] = []
    // The long hall on its plinth; the orange band along its top; the dark bands of its windows.
    b.push({ p: [0, 0.3, 0], s: [2 * W + 2, 0.6, 2 * D + 2], c: '#cfc6b5' })
    b.push({ p: [0, H / 2, 0], s: [2 * W, H, 2 * D], c: '#f4efe6' })
    b.push({ p: [0, H - 1.1, 0], s: [2 * W + 0.3, 1.6, 2 * D + 0.3], c: '#e8590c' })
    for (const y of [3.4, 7.4])
      for (const z of [-D - 0.06, D + 0.06]) b.push({ p: [0, y, z], s: [2 * W - 6, 1.7, 0.1], c: '#2f3a48' })
    for (const y of [3.4, 7.4]) for (const x of [-W - 0.06, W + 0.06]) b.push({ p: [x, y, 0], s: [0.1, 1.7, 2 * D - 6], c: '#2f3a48' })
    // The salle Anoumabo's block out of the middle, its own band; the fly tower over its stage at the back.
    b.push({ p: [0, HALL.h / 2, 0], s: [2 * HALL.x, HALL.h, 2 * HALL.z], c: '#efe8db' })
    b.push({ p: [0, HALL.h - 1.4, 0], s: [2 * HALL.x + 0.3, 1.2, 2 * HALL.z + 0.3], c: '#e8590c' })
    b.push({ p: [0, HALL.h + 3, -HALL.z + 5], s: [22, 8, 9], c: '#e0d8c8' })
    // The portico on its podium: tall pillars ahead of the facade, the slab they hold; the steps down to the forecourt.
    b.push({ p: [0, 0.6, D + PORCH / 2], s: [60, 1.2, PORCH], c: '#d8d0c0' })
    for (let x = -26; x <= 26; x += 4) b.push({ p: [x, 7.3, D + PORCH - 0.6], s: [1, 14.6, 1], c: '#f4efe6' })
    b.push({ p: [0, 15.2, D + PORCH / 2], s: [58, 1.4, PORCH + 1], c: '#efe8db' })
    for (let i = 0; i < 4; i++) {
      const front = 3.3 - i * 0.7
      b.push({ p: [0, (i + 1) * 0.15, D + PORCH + front / 2], s: [40 - i, (i + 1) * 0.3, front], c: '#d8d0c0' })
    }
    // The glass doors under the portico, the ticket window to the right of them.
    b.push({ p: [0, 3.7, D + 0.08], s: [22, 5, 0.12], c: '#3d5a73' })
    b.push({ p: [24, 1.6, D + PORCH + 7], s: [5, 3.2, 3], c: '#f4efe6' }, { p: [24, 3.35, D + PORCH + 7], s: [5.6, 0.3, 3.6], c: '#e8590c' })
    // The posters' frames either side of the way in.
    for (const x of [-15, 15]) b.push({ p: [x, 1.2, D + PORCH + 11], s: [0.3, 2.4, 0.3], c: '#3a3d44' }, { p: [x, 3.2, D + PORCH + 11 - 0.12], s: [4.4, 3.3, 0.2], c: '#3a3d44' })
    return b
  }, [])
  // The forecourt: the night's queue at the ticket window, the security at the doors, people about.
  const people = useMemo<Staff[]>(() => {
    const queue: Staff[] = night ? [0, 1, 2, 3, 4, 5].map((i) => ({ p: [24 + (i % 2) * 0.4, 0, D + PORCH + 9.6 + i * 1.1], r: Math.PI, pose: i % 3 === 1 ? 'phone' : i % 3 === 2 ? 'talk' : 'idle', who: 'client' })) : [{ p: [24, 0, D + PORCH + 9.6], r: Math.PI, pose: 'idle', who: 'client' }]
    return [
      { p: [-4, 1.2, D + 1.5], r: 0, who: 'vigile' },
      { p: [4, 1.2, D + 1.5], r: 0, who: 'vigile' },
      { p: [-10, 0, D + PORCH + 16], r: 0.6, pose: 'talk' },
      { p: [-11.2, 0, D + PORCH + 16.6], r: -2.4, pose: 'talk' },
      { p: [12, 0, D + PORCH + 18], r: 2.9, pose: 'film' },
      ...queue,
    ]
  }, [night])
  return (
    <group>
      {/* The forecourt to the street: lawns, the paved way in */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, D + COURT / 2]} scale={[2 * W + 6, COURT + 2, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, D + COURT / 2]} scale={[30, COURT + 2, 1]} geometry={PLANE} material={paving} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, D + PORCH / 2 + 1]} scale={[2 * W + 2, PORCH + 4, 1]} geometry={PLANE} material={paving} receiveShadow />
      <Blocks at={blocks} material={white} color />
      {/* The salle Anoumabo's curved roof: half a drum lying front to back, flattened */}
      <group position={[0, HALL.h, 0]} scale={[1, 0.36, 1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={roof} castShadow receiveShadow>
          <cylinderGeometry args={[HALL.x + 1, HALL.x + 1, 2 * HALL.z + 2, 28, 1, false, Math.PI / 2, Math.PI]} />
        </mesh>
      </group>
      <mesh position={[0, 15.2, D + PORCH + 0.52]} scale={[50, 1.3, 1]} geometry={PLANE} material={mats.name} />
      {[-15, 15].map((x, i) => (
        <mesh key={x} position={[x, 3.2, D + PORCH + 11]} scale={[4, 3, 1]} geometry={PLANE} material={mats.shows[i]} />
      ))}
      <mesh position={[24, 2.6, D + PORCH + 8.52]} scale={[4.6, 1, 1]} geometry={PLANE} material={mats.ticket} />
      <Fountain at={[0, 0, D + PORCH + 15]} />
      {/* The flags along the way in, both sides */}
      {[0, 1, 2].flatMap((i) =>
        [-1, 1].map((s) => (
          <group key={`${i}${s}`} position={[s * 9, 0, D + PORCH + 6 + i * 7]}>
            <WavingFlag height={8} w={2.4} seed={i * 2 + (s > 0 ? 1 : 0)} />
          </group>
        )),
      )}
      <Lamps from={[-13, D + PORCH + 4]} to={[-13, D + COURT]} step={8} night={night} />
      <Lamps from={[13, D + PORCH + 4]} to={[13, D + COURT]} step={8} night={night} />
      {night && <pointLight position={[0, 13, D + PORCH + 2]} intensity={60} distance={30} color="#ffd8a8" />}
      <NoShadows>
        <People at={people} seed={night ? 'palais-culture-soir' : 'palais-culture'} />
        <Stroller from={[-20, D + PORCH + 20]} to={[20, D + PORCH + 20]} seed="palais-culture-a" />
        <Stroller from={[3, D + PORCH + 4]} to={[3, D + COURT]} seed="palais-culture-b" speed={1} />
        <Stroller from={[-6, D + COURT - 1]} to={[-6, D + PORCH + 5]} seed="palais-culture-c" speed={1.3} bag />
      </NoShadows>
    </group>
  )
}

/** The forecourt's fountain: its round basin, the jets rising and falling in turn. */
function Fountain({ at }: { at: [number, number, number] }) {
  const jets = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    jets.current.forEach((m, i) => {
      if (!m) return
      const h = 1.2 + (Math.sin(t * 1.6 + i * 1.3) * 0.5 + 0.5) * 2.2
      m.scale.set(1, h, 1)
      m.position.y = 0.6 + h / 2
    })
  })
  const ring = [0, 1, 2, 3, 4, 5].map((i): [number, number] => [Math.sin((i * Math.PI) / 3) * 2.2, Math.cos((i * Math.PI) / 3) * 2.2])
  return (
    <group position={at}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[4, 4.2, 0.6, 28]} />
        <meshLambertMaterial color="#d8d0c0" />
      </mesh>
      <mesh position={[0, 0.58, 0]} material={water}>
        <cylinderGeometry args={[3.7, 3.7, 0.05, 28]} />
      </mesh>
      {[[0, 0] as [number, number], ...ring].map(([x, z], i) => (
        <mesh key={i} ref={(m) => void (jets.current[i] = m)} position={[x, 1, z]} material={spray}>
          <cylinderGeometry args={[0.05, i ? 0.14 : 0.22, 1, 6]} />
        </mesh>
      ))}
    </group>
  )
}

/** What a walker can't go through: the hall, the portico's pillars, the fountain, the ticket window (its frame). */
export const PALAIS_CULTURE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: 0, hw: W + 0.5, hd: D + 0.5, rot: 0, top: H },
  ...[...Array(14)].map((_, i) => ({ x: -26 + i * 4, z: D + PORCH - 0.6, r: 0.6 })),
  { x: 0, z: D + PORCH + 15, r: 4.2 },
  { x: 24, z: D + PORCH + 7, hw: 2.6, hd: 1.6, rot: 0, top: 3.4 },
]
