import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'
import { BOX, Blocks } from './ruePrincesse'
import { t as tr } from '../../lib/i18n'

// The Parc des Expositions d'Abidjan (Port-Bouët, on the airport road, opened in July 2023, the
// architect Pierre Fakhoury): its Convention Center, a « flying saucer » 37 m high set on the square
// podium of the halls: the round hall flaring out from its glazed foot to a wide rim, the low dome
// over it, its curved walls clad in horizontal slats the colour of ochre (the builders' own words); the
// giant LED screen over the doors, the canopy and the flags on the podium's front. At night the dome
// glows and slowly changes colour, as its lights can. On the map the podium is a square about 134 m a
// side (OpenStreetMap's building, turned as it stands: places.ts ON_BUILDING), the hall round, about
// 110 m across; the heights of its parts are the game's, to make 37 m. Frame: +z the doors.

/** The podium (the map's square, drawn by the map): its height; the saucer: its foot, rim and dome. */
export const DOME = { PODIUM: 5, FOOT: 44, R: 57, BODY: 14, H: 18 }

/** The slats of the curved walls: ochre bands with their dark joints between, many rows high. */
function slats(light: boolean) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = light ? '#d8b27a' : '#c48a3f'
  g.fillRect(0, 0, 64, 256)
  for (let j = 0; j < 32; j++) {
    g.fillStyle = light ? '#b8915d' : '#8f5e27'
    g.fillRect(0, j * 8 + 6, 64, 2)
    g.fillStyle = light ? '#e6c896' : '#d29a52'
    g.fillRect(0, j * 8, 64, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
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
const podium = new THREE.MeshLambertMaterial({ color: '#e4ded2' })
const grass = new THREE.MeshLambertMaterial({ color: '#4e9a3f' })
const pillar = new THREE.MeshLambertMaterial({ color: '#d9d6cf' })
const steel = new THREE.MeshLambertMaterial({ color: '#c7ccd2' })

/** The colours the dome's lights go through at night: orange, white, green, a blue. */
const GLOW = ['#f77f00', '#fff2d6', '#009e60', '#2a6cf0'].map((c) => new THREE.Color(c))

export function ParcExpo({ night }: { night: boolean }) {
  const { PODIUM, FOOT, R, BODY, H } = DOME
  // The dome: a cap of a sphere, its foot R wide, H high.
  const sphere = (R * R + H * H) / (2 * H)
  const cap = Math.acos((sphere - H) / sphere)
  const wall = useMemo(() => {
    const t = slats(false)
    t.repeat.set(48, 2)
    // (Its wall leans out over the podium, facing down: lit a little from the paving, not black.)
    return new THREE.MeshLambertMaterial({ map: t, emissive: '#6b4518', emissiveIntensity: 0.45 })
  }, [])
  const dome = useMemo(() => {
    const t = slats(true)
    t.repeat.set(64, 3)
    return new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveIntensity: 0 })
  }, [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2d4a63', emissive: '#ffd9a0', emissiveIntensity: 0 }), [])
  const led = useMemo(() => {
    const t = screen()
    return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.6 })
  }, [])
  glass.emissiveIntensity = night ? 0.6 : 0
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
    dome.emissiveIntensity = 0.4
  })
  const GLASS = 4.5
  // The glazed foot's mullions; the canopy's pillars; the flags along the podium's front.
  const mullions = useMemo(() => [...Array(64)].map((_, i) => {
    const a = (i / 64) * Math.PI * 2
    return { p: [Math.sin(a) * (FOOT + 0.3), GLASS / 2, Math.cos(a) * (FOOT + 0.3)] as [number, number, number], s: [0.4, GLASS, 0.4] as [number, number, number], ry: a }
  }), [FOOT])
  const pillars = useMemo(() => [-16, -8, 0, 8, 16].map((x) => ({ p: [x, 3.5, FOOT + 15] as [number, number, number], s: [0.8, 7, 0.8] as [number, number, number] })), [FOOT])
  const poles = useMemo(() => [...Array(11)].map((_, i) => ({ p: [-50 + i * 10, 6, 64] as [number, number, number], s: [0.18, 12, 0.18] as [number, number, number] })), [])
  const wide = FOOT + (R - FOOT) * (GLASS / BODY)
  return (
    <group>
      {/* The podium (the halls' square base, as on the map), its glazed front, the steps up to it */}
      <mesh geometry={BOX} position={[0, PODIUM / 2, 0]} scale={[132, PODIUM, 132]} material={podium} castShadow receiveShadow />
      <mesh geometry={BOX} position={[0, PODIUM / 2, 66.05]} scale={[90, PODIUM - 1.2, 0.2]} material={glass} />
      <mesh geometry={BOX} position={[0, PODIUM / 4, 69]} scale={[40, PODIUM / 2, 6]} material={podium} />
      {/* Its top: paved, a lawn each side of the way in */}
      <group position={[0, PODIUM, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
          <planeGeometry args={[132, 132]} />
          <meshLambertMaterial color="#d8d2c6" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
        <Blocks at={[-1, 1].map((k) => ({ p: [k * 44, 0.12, 56] as [number, number, number], s: [26, 0.12, 14] as [number, number, number] }))} material={grass} />
        {/* The glazed foot of the hall, between its mullions */}
        <mesh position={[0, GLASS / 2, 0]} material={glass} castShadow receiveShadow>
          <cylinderGeometry args={[wide, FOOT, GLASS, 64, 1, true]} />
        </mesh>
        <Blocks at={mullions} material={white} />
        {/* The saucer's body, flaring out to its rim, in its ochre slats */}
        <mesh position={[0, GLASS + (BODY - GLASS) / 2, 0]} material={wall} castShadow receiveShadow>
          <cylinderGeometry args={[R, wide, BODY - GLASS, 72, 1, true]} />
        </mesh>
        {/* The rim */}
        <mesh position={[0, BODY + 0.4, 0]} castShadow>
          <cylinderGeometry args={[R + 0.8, R + 0.8, 0.8, 72]} />
          <meshLambertMaterial color="#f3f1ec" />
        </mesh>
        {/* The low dome over it, its slats lighter in the sun */}
        <mesh position={[0, BODY + 0.8 + H - sphere, 0]} material={dome} castShadow receiveShadow>
          <sphereGeometry args={[sphere, 72, 20, 0, Math.PI * 2, 0, cap]} />
        </mesh>
        {/* The skylight at its top */}
        <mesh position={[0, BODY + 0.8 + H + 0.3, 0]}>
          <cylinderGeometry args={[6, 7, 0.8, 32]} />
          <meshLambertMaterial color="#9fb8c8" />
        </mesh>
        {/* The giant screen over the doors, on the flaring wall */}
        <mesh position={[0, GLASS + 5.5, (FOOT + R) / 2 + 0.8]} rotation={[-0.62, 0, 0]} material={led}>
          <planeGeometry args={[28, 9]} />
        </mesh>
        {/* The canopy out over the doors, on its pillars */}
        <mesh geometry={BOX} position={[0, 7.4, FOOT + 9]} scale={[38, 0.8, 16]} material={white} castShadow />
        <Blocks at={pillars} material={pillar} />
        {/* The flags along the podium's front: orange, white, green */}
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
