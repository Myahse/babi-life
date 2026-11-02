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

/** The esplanade's height; the bell: its skirt's radius, the eave's height over the esplanade, the top's. */
export const DOME = { PLAZA: 1.5, R: 57, EAVE: 3.2, TOP: 33 }

/** The bell's skin: pale blue metal in panels, their joints a shade darker. */
function panels() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#86b2e2'
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
 * How high the bell stands at a distance r from its middle (0 at the eave, 1 at the top): a broad round
 * top, then the hollow curve of the skirt spreading out flat to its edge (a logistic curve, set to 0 at R).
 */
function rise(r: number, R: number) {
  const f = (x: number) => 1 / (1 + (x / (R * 0.5)) ** 3.2)
  return (f(r) - f(R)) / (f(0) - f(R))
}

/** The bell's profile: from its eave out at the skirt's edge, up the hollow curve to the round top. */
function bellProfile(R: number, eave: number, top: number) {
  const pts: THREE.Vector2[] = []
  const N = 48
  for (let i = 0; i <= N; i++) {
    const r = R * (1 - i / N)
    pts.push(new THREE.Vector2(Math.max(r, 0.01), eave + (top - eave) * rise(r, R)))
  }
  return pts
}

const plaza = new THREE.MeshLambertMaterial({ color: '#c47f55' })
const plazaTop = new THREE.MeshLambertMaterial({ color: '#cf8c62', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const steps = new THREE.MeshLambertMaterial({ color: '#d9d2c4' })
const steel = new THREE.MeshLambertMaterial({ color: '#c7ccd2' })
const lamp = new THREE.MeshLambertMaterial({ color: '#3c4552' })

/** The colours the bell's lights go through at night: orange, white, green, a blue. */
const GLOW = ['#f77f00', '#fff2d6', '#009e60', '#2a6cf0'].map((c) => new THREE.Color(c))

export function ParcExpo({ night }: { night: boolean }) {
  const { PLAZA, R, EAVE, TOP } = DOME
  const bell = useMemo(() => new THREE.LatheGeometry(bellProfile(R, EAVE, TOP), 96), [R, EAVE, TOP])
  // Under the skirt: the same shape a little in, so the skirt has a thickness seen from below.
  const under = useMemo(() => new THREE.LatheGeometry(bellProfile(R - 0.4, EAVE - 0.5, TOP - 1).reverse(), 96), [R, EAVE, TOP])
  const skin = useMemo(() => {
    const t = panels()
    t.repeat.set(36, 10)
    return new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveIntensity: 0, side: THREE.DoubleSide })
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
  // The ring of round lights high on the bell: on its surface, at a third of the way in.
  const ring = useMemo(() => {
    const r = R * 0.4
    const y = EAVE + (TOP - EAVE) * rise(r, R)
    // The surface's slope there, to lay the lights on it.
    const tilt = Math.atan2(y - (EAVE + (TOP - EAVE) * rise(r + 0.5, R)), 0.5)
    return [...Array(14)].map((_, i) => ({ a: (i / 14) * Math.PI * 2, r: r + 0.25, y: y + 0.15, tilt }))
  }, [R, EAVE, TOP])
  const glassR = R - 9
  // The lamp posts round the esplanade, and the flags at its front.
  const posts = useMemo(() => [...Array(12)].map((_, i) => {
    const a = (i / 12) * Math.PI * 2 + 0.26
    return { p: [Math.sin(a) * (R + 6), 4.5, Math.cos(a) * (R + 6)] as [number, number, number], s: [0.15, 9, 0.15] as [number, number, number] }
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
        <mesh position={[0, EAVE / 2, 0]} material={glass} castShadow>
          <cylinderGeometry args={[glassR, glassR, EAVE, 72, 1, true]} />
        </mesh>
        {/* The bell */}
        <mesh geometry={bell} material={skin} castShadow receiveShadow />
        <mesh geometry={under} material={skin} />
        {/* Its ring of round lights */}
        {ring.map((h, i) => (
          <mesh key={i} position={[Math.sin(h.a) * h.r, h.y, Math.cos(h.a) * h.r]} rotation={[h.tilt, h.a, 0]} scale={[1, 1, 0.35]} material={portholes}>
            <sphereGeometry args={[0.9, 12, 8]} />
          </mesh>
        ))}
        {/* The doors at the front, under the skirt */}
        <mesh geometry={BOX} position={[0, 1.4, glassR + 0.2]} scale={[14, 2.8, 0.3]} material={glass} />
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
