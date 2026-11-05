import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Sign } from '../props'

// The clôture round a lot a player owns: a low wall of its owner's colour
// with pillars, a gate at the street side and the owner's name on it, so a
// player's house is known from the street. In the lot's own metres (x, z from
// its corner, the street at +z), just outside the lot.

/** The gate's width, in the middle of the street side. */
export const GATE = 3
const H = 1.3
const T = 0.25

const COLORS = ['#e8590c', '#2f9e44', '#1c7ed6', '#c2255c', '#f08c00', '#7048e8', '#0c8599', '#d6336c']

/** A colour for an owner, the same on every screen. */
export function ownerColor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

/** The fence's straight runs (centre x, z; length along x or z), the gate left open. */
export function fenceRuns(w: number, d: number) {
  const g0 = (w - GATE) / 2
  return [
    { x: w / 2, z: -T / 2, len: w + 2 * T, along: 'x' as const },
    { x: -T / 2, z: d / 2, len: d, along: 'z' as const },
    { x: w + T / 2, z: d / 2, len: d, along: 'z' as const },
    { x: (g0 - T) / 2, z: d + T / 2, len: g0 + T, along: 'x' as const },
    { x: (w + g0 + GATE + T) / 2, z: d + T / 2, len: w - g0 - GATE + T, along: 'x' as const },
  ]
}

/** The gate's upper half: iron bars with spear tips, see-through (one texture for every gate). */
let barsTex: THREE.CanvasTexture | null = null
function gateBars() {
  if (barsTex) return barsTex
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 16
  const g = c.getContext('2d')!
  g.fillStyle = '#2b2d31'
  for (let x = 1; x < 32; x += 4) {
    g.fillRect(x, 2, 2, 14)
    g.fillRect(x - 1, 1, 4, 2)
  }
  g.fillRect(0, 9, 32, 2)
  barsTex = new THREE.CanvasTexture(c)
  barsTex.magFilter = barsTex.minFilter = THREE.NearestFilter
  barsTex.generateMipmaps = false
  barsTex.colorSpace = THREE.SRGBColorSpace
  return barsTex
}
const barsMat = () => new THREE.MeshLambertMaterial({ map: gateBars(), alphaTest: 0.5, side: THREE.DoubleSide })
let bars: THREE.MeshLambertMaterial | null = null
const lampOff = new THREE.MeshLambertMaterial({ color: '#f3ead2' })
const lampOn = new THREE.MeshBasicMaterial({ color: '#fff1c2', toneMapped: false })
/** How far the gate's leaves stand open, swung in against the inside of the wall. */
const OPEN = 1.35

/** The gate's leaves (their painted sheets, their bars) and its lamps, in the lot's metres, each merged into one geometry. */
function gateParts(w: number, d: number) {
  const g0 = (w - GATE) / 2
  const sheets: THREE.BufferGeometry[] = []
  const bars: THREE.BufferGeometry[] = []
  const m = new THREE.Matrix4()
  for (const k of [0, 1]) {
    // Hinged at its pillar, swung in.
    m.makeRotationY(k ? -OPEN : OPEN).setPosition(k ? g0 + GATE : g0, 0, d + T / 2)
    const off = k ? -GATE / 4 : GATE / 4
    sheets.push(new THREE.BoxGeometry(GATE / 2 - 0.08, 1, 0.06).translate(off, 0.55, 0).applyMatrix4(m))
    bars.push(new THREE.BoxGeometry(GATE / 2 - 0.08, 0.75, 0.04).translate(off, 1.42, 0).applyMatrix4(m))
  }
  const lamps = [g0, g0 + GATE].map((x) => new THREE.BoxGeometry(0.24, 0.26, 0.24).translate(x, H - 0.1, d + T / 2 + 0.3))
  const merge = (gs: THREE.BufferGeometry[]) => {
    const out = mergeGeometries(gs)
    gs.forEach((g) => g.dispose())
    return out
  }
  return { sheets: merge(sheets), bars: merge(bars), lamps: merge(lamps) }
}

export function LotFence({ w, d, color, name, night }: { w: number; d: number; color: string; name?: string; /** After dark: the lamps on the gate's pillars on. */ night?: boolean }) {
  const wall = useMemo(() => new THREE.MeshLambertMaterial({ color }), [color])
  const sheet = useMemo(() => new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.62) }), [color])
  const gate = useMemo(() => gateParts(w, d), [w, d])
  useEffect(() => () => Object.values(gate).forEach((g) => g.dispose()), [gate])
  const cap = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f1efe9' }), [])
  const runs = fenceRuns(w, d)
  const g0 = (w - GATE) / 2
  // Pillars at the corners and either side of the gate.
  const pillars: [number, number][] = [
    [-T / 2, -T / 2],
    [w + T / 2, -T / 2],
    [-T / 2, d + T / 2],
    [w + T / 2, d + T / 2],
    [g0, d + T / 2],
    [g0 + GATE, d + T / 2],
  ]
  return (
    <group>
      {runs.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]}>
          <mesh position={[0, H / 2, 0]} material={wall} castShadow receiveShadow>
            <boxGeometry args={r.along === 'x' ? [r.len, H, T] : [T, H, r.len]} />
          </mesh>
          <mesh position={[0, H + 0.06, 0]} material={cap}>
            <boxGeometry args={r.along === 'x' ? [r.len, 0.12, T + 0.08] : [T + 0.08, 0.12, r.len]} />
          </mesh>
        </group>
      ))}
      {pillars.map(([x, z], i) => (
        <mesh key={i} position={[x, (H + 0.4) / 2, z]} material={cap} castShadow>
          <boxGeometry args={[0.45, H + 0.4, 0.45]} />
        </mesh>
      ))}
      {/* The gate: two painted iron leaves, bars on top, standing open inwards on their hinges; and a
          lamp on each of its pillars, on after dark (each kind of part one mesh: three draws in all) */}
      <mesh geometry={gate.sheets} material={sheet} castShadow />
      <mesh geometry={gate.bars} material={(bars ??= barsMat())} />
      <mesh geometry={gate.lamps} material={night ? lampOn : lampOff} />
      {/* The owner's name over the gate, facing the street */}
      {name && <Sign p={[w / 2, H + 1.3, d + T / 2]} w={Math.max(GATE + 0.6, name.length * 0.32 + 1)} text={name} bg={color} fg="#ffffff" />}
      {name && (
        <>
          <mesh position={[g0, H + 0.9, d + T / 2]} material={cap}>
            <boxGeometry args={[0.18, 1.6, 0.18]} />
          </mesh>
          <mesh position={[g0 + GATE, H + 0.9, d + T / 2]} material={cap}>
            <boxGeometry args={[0.18, 1.6, 0.18]} />
          </mesh>
        </>
      )}
    </group>
  )
}
