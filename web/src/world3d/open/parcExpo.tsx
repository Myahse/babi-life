import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { BOX, Blocks } from './ruePrincesse'
import { t as tr } from '../../lib/i18n'

// The Parc des Expositions d'Abidjan (Port-Bouët, on the airport road,
// opened in July 2023): its central building under a great white dome, the
// Convention Center (over 5 000 seats, about 10 000 standing), the glass all
// round its foot, the giant LED screen over the doors, the canopy and the
// flags on the forecourt. At night the dome glows and slowly changes colour,
// as its hundreds of lights can. The sources give no dimensions for the
// dome: these are the game's, set on the map's central building (about
// 125 m a side). Frame: +z the doors, toward the forecourt.

/** The dome: its foot's radius, the drum's height under it, how high it rises over the drum. */
export const DOME = { R: 58, DRUM: 9, H: 28 }

/** The dome's lattice: its ribs and rings, light on white. */
function lattice() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 512, 128)
  g.strokeStyle = '#c9ced6'
  g.lineWidth = 2
  for (let i = 0; i <= 48; i++) {
    g.beginPath()
    g.moveTo((i / 48) * 512, 0)
    g.lineTo((i / 48) * 512, 128)
    g.stroke()
  }
  for (let j = 1; j < 8; j++) {
    g.beginPath()
    g.moveTo(0, (j / 8) * 128)
    g.lineTo(512, (j / 8) * 128)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The screen over the doors: the fair's name in big letters on the LEDs. */
function screen() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 200
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 512, 0)
  grad.addColorStop(0, '#f77f00')
  grad.addColorStop(0.5, '#ffffff')
  grad.addColorStop(1, '#009e60')
  g.fillStyle = '#10131a'
  g.fillRect(0, 0, 512, 200)
  g.fillStyle = grad
  g.fillRect(0, 150, 512, 14)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.font = '800 40px sans-serif'
  g.fillText(tr('PARC DES EXPOSITIONS'), 256, 70)
  g.font = '800 34px sans-serif'
  g.fillText("D'ABIDJAN", 256, 120)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const white = new THREE.MeshLambertMaterial({ color: '#f3f1ec' })
const grass = new THREE.MeshLambertMaterial({ color: '#4e9a3f' })
const pillar = new THREE.MeshLambertMaterial({ color: '#d9d6cf' })
const steel = new THREE.MeshLambertMaterial({ color: '#c7ccd2' })

/** The colours the dome's lights go through at night: orange, white, green, a blue. */
const GLOW = ['#f77f00', '#fff2d6', '#009e60', '#2a6cf0'].map((c) => new THREE.Color(c))

export function ParcExpo({ night }: { night: boolean }) {
  const { R, DRUM, H } = DOME
  // A cap of a sphere: its foot R wide, H high.
  const sphere = (R * R + H * H) / (2 * H)
  const cap = Math.acos((sphere - H) / sphere)
  const dome = useMemo(() => {
    const t = lattice()
    t.repeat.set(1, 1)
    return new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveIntensity: 0 })
  }, [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2d4a63', emissive: '#ffd9a0', emissiveIntensity: 0 }), [])
  const led = useMemo(() => {
    const t = screen()
    return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.6 })
  }, [])
  glass.emissiveIntensity = night ? 0.5 : 0
  led.emissiveIntensity = night ? 1 : 0.6
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    if (!night) {
      dome.emissiveIntensity = 0
      return
    }
    // Slowly from one colour to the next.
    const t = (worldTime() / 6) % GLOW.length
    const i = Math.floor(t)
    tmp.copy(GLOW[i]).lerp(GLOW[(i + 1) % GLOW.length], t - i)
    dome.emissive.copy(tmp)
    dome.emissiveIntensity = 0.45
  })
  // The mullions round the glass, the canopy's pillars, the flagpoles in an arc on the forecourt.
  const mullions = useMemo(() => [...Array(72)].map((_, i) => {
    const a = (i / 72) * Math.PI * 2
    return { p: [Math.sin(a) * (R + 0.05), DRUM / 2, Math.cos(a) * (R + 0.05)] as [number, number, number], s: [0.35, DRUM, 0.35] as [number, number, number], ry: a }
  }), [R, DRUM])
  const pillars = useMemo(() => [-14, -7, 0, 7, 14].flatMap((x) => [{ p: [x, 3.5, R + 15] as [number, number, number], s: [0.8, 7, 0.8] as [number, number, number] }]), [R])
  const poles = useMemo(() => [...Array(9)].map((_, i) => {
    const a = -0.7 + (i / 8) * 1.4
    return { p: [Math.sin(a) * (R + 34), 6, Math.cos(a) * (R + 34)] as [number, number, number], s: [0.18, 12, 0.18] as [number, number, number] }
  }), [R])
  const lawns = useMemo(() => [-1, 1].map((k) => ({ p: [k * 42, 0.06, R + 30] as [number, number, number], s: [30, 0.12, 18] as [number, number, number] })), [R])
  return (
    <group>
      {/* The forecourt and the ground all round */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <circleGeometry args={[R + 36, 64]} />
        <meshLambertMaterial color="#d8d2c6" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <Blocks at={lawns} material={grass} />
      {/* The drum: glass between white mullions, a white band on top */}
      <mesh position={[0, DRUM / 2, 0]} material={glass} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, DRUM, 72, 1, true]} />
      </mesh>
      <Blocks at={mullions} material={white} />
      <mesh position={[0, DRUM + 0.6, 0]} castShadow>
        <cylinderGeometry args={[R + 1.2, R + 1.2, 1.2, 72]} />
        <meshLambertMaterial color="#f3f1ec" />
      </mesh>
      {/* The dome */}
      <mesh position={[0, DRUM + 1.2 + H - sphere, 0]} material={dome} castShadow receiveShadow>
        <sphereGeometry args={[sphere, 72, 20, 0, Math.PI * 2, 0, cap]} />
      </mesh>
      {/* Its lantern at the top */}
      <mesh position={[0, DRUM + 1.2 + H + 1, 0]}>
        <cylinderGeometry args={[4, 5, 2, 24]} />
        <meshLambertMaterial color="#e9e4da" />
      </mesh>
      {/* The giant screen over the doors, on the drum's band */}
      <mesh position={[0, DRUM + 7, R - 1]} rotation={[-0.32, 0, 0]} material={led}>
        <planeGeometry args={[26, 10]} />
      </mesh>
      {/* The canopy out over the doors, on its pillars */}
      <mesh geometry={BOX} position={[0, 7.4, R + 9]} scale={[34, 0.8, 16]} material={white} castShadow />
      <Blocks at={pillars} material={pillar} />
      {/* The flags on the forecourt: orange, white, green */}
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
  )
}
