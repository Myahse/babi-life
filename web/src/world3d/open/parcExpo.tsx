import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { BOX, Blocks } from './ruePrincesse'

// The Parc des Expositions d'Abidjan (Port-Bouët, on the airport road, opened in July 2023, the architect
// Pierre Fakhoury), as the photos show it: its Convention Center, a great bell of pale blue metal, its
// skirt spread out wide and low all round, curving up hollow to a broad round top, a ring of little round
// lights high on it; under the skirt's edge, all round, a dark band of glass; the whole on a wide
// esplanade paved terracotta, a few steps up from the ground. (The grey exhibition hall beside it and the
// car park's white shades are the map's buildings.) At night the bell glows and slowly changes colour, as
// its lights can. On the map the esplanade is a square about 134 m a side (OpenStreetMap's building,
// turned as it stands: places.ts ON_BUILDING), the hall about 110 m across; the bell is 37 m high.
// Frame: +z the doors.

/** The esplanade's height; the shell: its half-width along a side, its edge's height over the esplanade (and how much higher at the corners), its top's. */
export const DOME = { PLAZA: 1.5, R: 52, EAVE: 4.5, LIFT: 3, TOP: 33 }

/** The bell's skin: pale blue metal in panels, their joints a shade darker. */
function panels() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#6fa6e0'
  g.fillRect(0, 0, 256, 256)
  // A little light and shade from panel to panel, as on a metal skin.
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++) {
      g.fillStyle = `rgba(255,255,255,${0.04 + ((i * 7 + j * 13) % 5) * 0.025})`
      g.fillRect(i * 16, j * 16, 16, 16)
    }
  g.strokeStyle = '#7f9fc2'
  g.lineWidth = 1
  for (let k = 0; k <= 16; k++) {
    g.beginPath()
    g.moveTo(k * 16, 0)
    g.lineTo(k * 16, 256)
    g.moveTo(0, k * 16)
    g.lineTo(256, k * 16)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * How high the shell stands at a fraction p of the way out from its middle to its edge (1 at the top,
 * 0 at the eave): a round top, then the hollow curve of the skirt spreading out flat (a logistic curve).
 */
function rise(p: number) {
  const f = (x: number) => 1 / (1 + (x / 0.43) ** 3.2)
  return (f(p) - f(1)) / (f(0) - f(1))
}

/** The shell's outline: not round, a rounded square (a superellipse), its corners reaching out. */
const outline = (R: number, a: number) => R / (Math.abs(Math.cos(a)) ** 3 + Math.abs(Math.sin(a)) ** 3) ** (1 / 3)
/** How much a point of the edge is a corner (0 along a side's middle, 1 at a corner). */
const corner = (a: number) => Math.abs(Math.sin(2 * a)) ** 3

/**
 * The shell, as the photos show it: a tent of metal over a rounded square, the edge thin and lifted
 * a few metres over the esplanade, rising at the four corners, the skirt curving up hollow to a broad
 * round top. Its sides face the frame's axes (+z the doors).
 */
function shell(R: number, eave: number, lift: number, top: number, inset = 0) {
  const A = 160
  const P = 44
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= A; i++) {
    const a = (i / A) * Math.PI * 2
    const r0 = outline(R, a) - inset
    const e = eave + lift * corner(a)
    for (let j = 0; j <= P; j++) {
      const p = 1 - j / P
      pos.push(Math.sin(a) * r0 * p, e + (top - inset * 0.6 - e) * rise(p), Math.cos(a) * r0 * p)
      uv.push((i / A) * 40, p * 12)
    }
  }
  for (let i = 0; i < A; i++)
    for (let j = 0; j < P; j++) {
      const k = i * (P + 1) + j
      idx.push(k, k + 1, k + P + 1, k + 1, k + P + 2, k + P + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** The dark wall of glass set back under the shell's edge, following its outline. */
function glassWall(R: number, h: number) {
  const A = 160
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= A; i++) {
    const a = (i / A) * Math.PI * 2
    const r = outline(R, a)
    pos.push(Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, h, Math.cos(a) * r)
    if (i < A) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const plaza = new THREE.MeshLambertMaterial({ color: '#c98d62' })
const plazaTop = new THREE.MeshLambertMaterial({ color: '#d9a273', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const steps = new THREE.MeshLambertMaterial({ color: '#d9d2c4' })
const steel = new THREE.MeshLambertMaterial({ color: '#c7ccd2' })
const lamp = new THREE.MeshLambertMaterial({ color: '#3c4552' })

/** The colours the bell's lights go through at night: orange, white, green, a blue. */
const GLOW = ['#f77f00', '#fff2d6', '#009e60', '#2a6cf0'].map((c) => new THREE.Color(c))

export function ParcExpo({ night }: { night: boolean }) {
  const { PLAZA, R, EAVE, LIFT, TOP } = DOME
  const bell = useMemo(() => shell(R, EAVE, LIFT, TOP), [R, EAVE, LIFT, TOP])
  // Under the skin: the same shape a little in and down, so the thin edge has a thickness seen from below.
  const under = useMemo(() => shell(R, EAVE - 0.35, LIFT, TOP, 0.6), [R, EAVE, LIFT, TOP])
  const wall = useMemo(() => glassWall(R - 7, EAVE), [R, EAVE])
  // The metal skin: blue, shining in the sun (its panels' grid), both faces drawn.
  const skin = useMemo(() => {
    const t = panels()
    t.repeat.set(1, 1)
    return new THREE.MeshPhongMaterial({ map: t, specular: '#8fa9c9', shininess: 140, emissive: '#ffffff', emissiveIntensity: 0, side: THREE.DoubleSide })
  }, [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#1b2633', emissive: '#ffd9a0', emissiveIntensity: 0 }), [])
  const portholes = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2b3a4a', emissive: '#fff4d6', emissiveIntensity: 0 }), [])
  glass.emissiveIntensity = night ? 0.55 : 0
  portholes.emissiveIntensity = night ? 1 : 0.1
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    if (!night) {
      skin.emissiveIntensity = 0
      return
    }
    // Slowly from one colour to the next.
    const t = (worldTime() / 6) % GLOW.length
    const i = Math.floor(t)
    tmp.copy(GLOW[i]).lerp(GLOW[(i + 1) % GLOW.length], t - i)
    skin.emissive.copy(tmp)
    skin.emissiveIntensity = 0.35
  })
  // The round lights high on the shell, in a ring: on its surface, part of the way in.
  const ring = useMemo(() => {
    const p = 0.44
    return [...Array(16)].map((_, i) => {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 16
      const r = outline(R, a) * p
      const e = EAVE + LIFT * corner(a)
      const y = e + (TOP - e) * rise(p)
      const tilt = Math.atan2(y - (e + (TOP - e) * rise(p + 0.01)), outline(R, a) * 0.01)
      return { a, r: r + 0.2, y: y + 0.12, tilt }
    })
  }, [R, EAVE, LIFT, TOP])
  // The lamp posts round the esplanade, and the flags at its front.
  const posts = useMemo(() => [...Array(12)].map((_, i) => {
    const a = (i / 12) * Math.PI * 2 + 0.26
    return { p: [Math.sin(a) * (outline(R, a) + 6), 4.5, Math.cos(a) * (outline(R, a) + 6)] as [number, number, number], s: [0.15, 9, 0.15] as [number, number, number] }
  }), [R])
  const poles = useMemo(() => [...Array(7)].map((_, i) => ({ p: [-30 + i * 10, 6, 64] as [number, number, number], s: [0.18, 12, 0.18] as [number, number, number] })), [])
  return (
    <group>
      {/* The esplanade, paved terracotta, a few steps up all along its front */}
      <mesh geometry={BOX} position={[0, PLAZA / 2, 0]} scale={[132, PLAZA, 132]} material={plaza} castShadow receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PLAZA + 0.02, 0]} material={plazaTop} receiveShadow>
        <planeGeometry args={[131, 131]} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={BOX} position={[0, (PLAZA * (3 - k)) / 6, 66 + 1.4 + k * 0.7]} scale={[70, (PLAZA * (3 - k)) / 3, 0.7]} material={steps} />
      ))}
      <group position={[0, PLAZA, 0]}>
        {/* The dark band of glass all round under the skirt */}
        <mesh geometry={wall} material={glass} />
        {/* The bell */}
        <mesh geometry={bell} material={skin} castShadow receiveShadow />
        <mesh geometry={under} material={skin} />
        {/* Its ring of round lights */}
        {ring.map((h, i) => (
          <mesh key={i} position={[Math.sin(h.a) * h.r, h.y, Math.cos(h.a) * h.r]} rotation={[h.tilt, h.a, 0]} scale={[1, 1, 0.35]} material={portholes}>
            <sphereGeometry args={[0.7, 12, 8]} />
          </mesh>
        ))}
        {/* The doors at the front, under the skirt */}
        <mesh geometry={BOX} position={[0, 1.6, R - 6.8]} scale={[16, 3.2, 0.3]} material={glass} />
        {/* The lamp posts round it, the flags at the front */}
        <Blocks at={posts} material={lamp} />
        <Blocks at={poles} material={steel} />
        {poles.map((pl, i) => (
          <group key={i} position={[pl.p[0] + 1.2, 10.6, pl.p[2]]}>
            {['#f77f00', '#ffffff', '#009e60'].map((c, k) => (
              <mesh key={k} geometry={BOX} position={[(k - 1) * 0.8, 0, 0]} scale={[0.8, 1.6, 0.04]}>
                <meshLambertMaterial color={c} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}
