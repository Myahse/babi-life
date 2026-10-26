import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { Blocks, PLANE } from './ruePrincesse'

// The RTI's site in Vieux Cocody (Radiodiffusion Télévision Ivoirienne): the
// low white studio buildings with their blue band and the name over the
// entrance, the satellite dishes on the roof, the car park in front, and the
// red-and-white lattice mast that one sees from all over Cocody, its red
// lights blinking at night. Sizes and the mast's height are the game's
// estimates. Frame: +z the street.

const W = 22 // half the studios' length
const D = 9 // half their depth
const H = 9
const MAST = 110 // the mast's height (estimated)
const MAST_AT: [number, number] = [-W - 14, -6]

const white = new THREE.MeshLambertMaterial({ color: '#f4f4f0' })
const tarmac = new THREE.MeshLambertMaterial({ color: '#5d6066', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const red = new THREE.MeshLambertMaterial({ color: '#d8312a' })
const steel = new THREE.MeshLambertMaterial({ color: '#f2f2f2' })
const glass = new THREE.MeshLambertMaterial({ color: '#2b4a66' })
const BOX = new THREE.BoxGeometry(1, 1, 1)

/** The name over the doors: « RTI » in the house's orange, white and green, the full name under it. */
function sign() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 1024, 256)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const letters: [string, string][] = [
    ['R', '#f07d00'],
    ['T', '#1a1a1a'],
    ['I', '#009a44'],
  ]
  g.font = '900 190px Anton, Impact, sans-serif'
  letters.forEach(([l, col], i) => {
    g.fillStyle = col
    g.fillText(l, 380 + i * 132, 108)
  })
  g.fillStyle = '#1b2a3a'
  g.font = '700 46px sans-serif'
  g.fillText('Radiodiffusion Télévision Ivoirienne', 512, 222)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: t })
}

/** The lattice mast: four legs drawing together as it rises, banded red and white, cross-braced, lit on top. */
function Mast({ night }: { night: boolean }) {
  const lamps = useRef<THREE.MeshBasicMaterial>(null)
  const parts = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; r: [number, number, number]; c: 'red' | 'white' }[] = []
    const n = 11 // bands
    for (let i = 0; i < n; i++) {
      const y0 = (i * MAST) / n
      const y1 = ((i + 1) * MAST) / n
      const w0 = 5 - (4.2 * i) / n
      const w1 = 5 - (4.2 * (i + 1)) / n
      const c = i % 2 ? 'white' : 'red'
      const mid = (y0 + y1) / 2
      const w = (w0 + w1) / 2
      const lean = Math.atan2(w0 - w1, y1 - y0)
      // The four legs.
      for (const [sx, sz] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        out.push({ p: [sx * w, mid, sz * w], s: [0.35, y1 - y0, 0.35], r: [sz * lean, 0, -sx * lean], c })
      // A cross on each face, and the ring at the band's top.
      for (const face of [0, 1, 2, 3]) {
        const a = (face * Math.PI) / 2
        const len = Math.hypot(2 * w, y1 - y0)
        const tilt = Math.atan2(2 * w, y1 - y0)
        for (const k of [1, -1]) out.push({ p: [Math.sin(a) * w, mid, Math.cos(a) * w], s: [0.16, len, 0.16], r: [0, a, k * tilt], c })
        out.push({ p: [Math.sin(a) * w1, y1, Math.cos(a) * w1], s: [2 * w1, 0.2, 0.2], r: [0, a, 0], c })
      }
    }
    return out
  }, [])
  const mesh = useMemo(() => {
    // (The instances' colours multiply the material's: white, so the bands stay red and white.)
    const m = new THREE.InstancedMesh(BOX, steel, parts.length)
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    parts.forEach((b, i) => {
      o.position.set(...b.p)
      o.scale.set(...b.s)
      o.rotation.set(...b.r)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, col.set(b.c === 'red' ? '#d8312a' : '#f2f2f2'))
    })
    m.castShadow = true
    return m
  }, [parts])
  useFrame(() => {
    if (lamps.current) lamps.current.color.set(night && Math.floor(worldTime() * 1.2) % 2 ? '#ff2a1a' : '#5a1410')
  })
  return (
    <group position={[MAST_AT[0], 0, MAST_AT[1]]}>
      <primitive object={mesh} />
      {/* The antennas at the top, and the red lamps at three heights. */}
      <mesh position={[0, MAST + 4, 0]} material={steel} scale={[0.4, 8, 0.4]} geometry={BOX} />
      <mesh position={[1.2, MAST - 6, 0]} material={steel} scale={[1.6, 2.4, 0.5]} geometry={BOX} />
      <mesh position={[-1.2, MAST - 14, 0]} material={steel} scale={[1.6, 2.4, 0.5]} geometry={BOX} />
      {[MAST + 8, MAST * 0.66, MAST * 0.33].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <sphereGeometry args={[0.7, 8, 6]} />
          <meshBasicMaterial ref={y === MAST + 8 ? lamps : undefined} color="#5a1410" />
        </mesh>
      ))}
    </group>
  )
}

export function Rti({ night }: { night: boolean }) {
  const name = useMemo(sign, [])
  const blocks = useMemo(
    () => [
      // The studios: two storeys, a blue band under the roof, the glass entrance in the middle.
      { p: [0, H / 2, 0] as [number, number, number], s: [2 * W, H, 2 * D] as [number, number, number], c: '#f4f4f0' },
      { p: [0, H - 0.8, D + 0.05] as [number, number, number], s: [2 * W, 1.2, 0.2] as [number, number, number], c: '#1f5fa8' },
      { p: [W - 9, H + 2.5, -2] as [number, number, number], s: [12, 5, 10] as [number, number, number], c: '#e9e9e4' },
      // The gatehouse at the street.
      { p: [-W + 4, 1.5, D + 17] as [number, number, number], s: [4, 3, 3] as [number, number, number], c: '#f4f4f0' },
      { p: [0, 0.6, D + 20] as [number, number, number], s: [2 * W + 20, 1.2, 0.3] as [number, number, number], c: '#d9d4c7' },
    ],
    [],
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, D + 9]} scale={[2 * W + 16, 18, 1]} geometry={PLANE} material={tarmac} receiveShadow />
      <Blocks at={blocks} material={white} color />
      {/* The glass entrance, the name over it. */}
      <mesh position={[0, 2.6, D + 0.12]} scale={[8, 5.2, 1]} geometry={PLANE} material={glass} />
      <mesh position={[0, 6.4, D + 0.16]} scale={[14, 3.5, 1]} geometry={PLANE} material={name} />
      {/* The satellite dishes on the roof, turned up to the sky. */}
      {[-14, -6, 2].map((x) => (
        <group key={x} position={[x, H + 0.6, -3]} rotation={[-0.9, 0.4, 0]}>
          <mesh>
            <cylinderGeometry args={[1.8, 0.4, 0.6, 16, 1, true]} />
            <meshLambertMaterial color="#f2f2f2" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <Mast night={night} />
      <mesh position={[MAST_AT[0], 0.5, MAST_AT[1]]} scale={[12, 1, 12]} geometry={BOX} material={red} />
    </group>
  )
}
