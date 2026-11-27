import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { serverNow } from '../../lib/worldClock'
import { isLandCell, LAND_H, LAND_W } from './landMask'

// The Earth seen from up there (the updates « espace-station », « espace-lune »), in voxels: its lands from a
// 3° grid (landMask.ts), the oceans, the ice, a few clouds; lit by the real sun of the moment (the shared
// worldClock: the day/night line is where it really is now), and at night the lights of every city of the game,
// Abidjan's brighter and orange. Seen from the Station Akwaba it turns under the cupola as the station goes round:
// one orbit in 92 real minutes (51.6° of inclination), so the sun rises every 92 minutes.

/** One orbit of the station, in real minutes. */
export const ORBIT_MINUTES = 92
const INCLINATION = (51.6 * Math.PI) / 180
const SIDEREAL_DAY = 86164
const DEG = Math.PI / 180

export type LightCity = { id: string; name: string; lat: number; lng: number }

/** A point of the sphere (lat, lng in degrees), radius r: lng 0 lat 0 faces +z, north is +y. */
export function onSphere(lat: number, lng: number, r: number, out = new THREE.Vector3()) {
  const a = lat * DEG
  const b = lng * DEG
  return out.set(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)).multiplyScalar(r)
}

/** Where the sun is overhead now (degrees). */
export function subsolar(ms = serverNow()) {
  const d = new Date(ms)
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const doy = (ms - start) / 86400000
  const lat = 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365)
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  return { lat, lng: wrap(-15 * (hours - 12)) }
}

/** Where the station is overhead now (degrees): its ground track, one orbit in 92 minutes. */
export function groundTrack(ms = serverNow()) {
  const t = ms / 1000
  const phi = (2 * Math.PI * t) / (ORBIT_MINUTES * 60)
  const lat = Math.asin(Math.sin(INCLINATION) * Math.sin(phi)) / DEG
  const inertial = Math.atan2(Math.cos(INCLINATION) * Math.sin(phi), Math.cos(phi)) / DEG
  return { lat, lng: wrap(inertial - (360 * t) / SIDEREAL_DAY) }
}

const wrap = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180

/** Night at that point now (the sun below its horizon). */
export function isNightAt(lat: number, lng: number, ms = serverNow()) {
  const s = subsolar(ms)
  return onSphere(lat, lng, 1).dot(onSphere(s.lat, s.lng, 1)) < 0
}

/** The game's city nearest the point, within `km` (the cupola's « tu survoles… »). */
export function nearestCity(cities: LightCity[], lat: number, lng: number, km = 900) {
  const here = onSphere(lat, lng, 1)
  let best: LightCity | undefined
  let bestKm = km
  for (const c of cities) {
    const d = here.angleTo(onSphere(c.lat, c.lng, 1)) * 6371
    if (d < bestKm) {
      bestKm = d
      best = c
    }
  }
  return best
}

type Cell = { lat: number; lng: number; land: boolean; c: THREE.Color; up: number }

const OCEAN = new THREE.Color('#1d5fb8')
const DEEP = new THREE.Color('#174e9c')
const GREEN = new THREE.Color('#3c8d3a')
const FOREST = new THREE.Color('#2b6e2c')
const SAND = new THREE.Color('#d4b06a')
const ICE = new THREE.Color('#eef3f8')
const NIGHT = new THREE.Color('#050b1c')

/** Sand where the deserts are (the Sahara and Arabia, the Kalahari, Australia's heart, the US southwest, the Gobi). */
function desert(lat: number, lng: number) {
  return (lat > 15 && lat < 33 && lng > -17 && lng < 60) || (lat > -30 && lat < -18 && lng > 15 && lng < 25) || (lat > -32 && lat < -18 && lng > 118 && lng < 142) || (lat > 28 && lat < 38 && lng > -118 && lng < -104) || (lat > 38 && lat < 46 && lng > 95 && lng < 112)
}

function cells(): Cell[] {
  const out: Cell[] = []
  for (let j = 0; j < LAND_H; j++) {
    const lat = 90 - (j + 0.5) * (180 / LAND_H)
    // Fewer cells towards the poles, so the blocks keep their size.
    const every = Math.max(1, Math.round(1 / Math.max(0.12, Math.cos(lat * DEG))))
    for (let i = 0; i < LAND_W; i += every) {
      const lng = -180 + (i + 0.5) * (360 / LAND_W)
      const land = !!isLandCell(i, j)
      const polar = lat < -62 || lat > 76
      const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453
      const r = n - Math.floor(n)
      const c = polar ? ICE : land ? (desert(lat, lng) ? SAND : Math.abs(lat) < 12 && r > 0.4 ? FOREST : GREEN) : r > 0.5 ? OCEAN : DEEP
      out.push({ lat, lng, land: land || polar, c, up: land || polar ? 0.6 + r * 0.5 : 0 })
    }
  }
  return out
}

/** The globe: blocks, clouds, the glow of the air, the cities' lights at night. */
export function Terre({ radius = 10, cities = [], view = 'orbite', spin = true }: { radius?: number; cities?: LightCity[]; view?: 'orbite' | 'lune' | 'fixe'; spin?: boolean }) {
  const globe = useRef<THREE.Group>(null)
  const grid = useMemo(cells, [])
  const block = (radius * 2 * Math.PI) / LAND_W
  const ground = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), grid.length)
    const o = new THREE.Object3D()
    const p = new THREE.Vector3()
    grid.forEach((g, k) => {
      const h = block * (0.5 + g.up)
      onSphere(g.lat, g.lng, radius + h / 2 - block * 0.5, p)
      o.position.copy(p)
      o.lookAt(0, 0, 0)
      o.scale.set(block * 1.02, block * 1.02, h)
      o.updateMatrix()
      m.setMatrixAt(k, o.matrix)
      m.setColorAt(k, g.c)
    })
    return m
  }, [grid, radius, block])
  const clouds = useMemo(() => {
    const n = 140
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), n)
    const o = new THREE.Object3D()
    let seed = 11
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let k = 0; k < n; k++) {
      const lat = (r() * 2 - 1) * 65
      const lng = r() * 360 - 180
      onSphere(lat, lng, radius + block * 1.6, o.position)
      o.lookAt(0, 0, 0)
      o.scale.set(block * (1 + r() * 2.5), block * (0.8 + r() * 1.2), block * 0.3)
      o.updateMatrix()
      m.setMatrixAt(k, o.matrix)
    }
    return m
  }, [radius, block])
  const lit = useMemo(() => cities.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng)), [cities])
  const lights = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffd166', toneMapped: false }), Math.max(1, lit.length))
    m.count = lit.length
    return m
  }, [lit])
  const abidjan = useRef<THREE.Mesh>(null)
  const abj = useMemo(() => onSphere(5.32, -4.02, radius + block * 1.25), [radius, block])

  // The light of the moment: each block lit or in the night, every few seconds (the line moves slowly).
  useEffect(() => {
    const paint = () => {
      const s = onSphere(subsolar().lat, subsolar().lng, 1)
      const tmp = new THREE.Color()
      const v = new THREE.Vector3()
      grid.forEach((g, k) => {
        const d = onSphere(g.lat, g.lng, 1, v).dot(s)
        const day = THREE.MathUtils.smoothstep(d, -0.12, 0.12)
        tmp.copy(NIGHT).lerp(g.c, 0.12 + day * 0.88)
        ground.setColorAt(k, tmp)
      })
      if (ground.instanceColor) ground.instanceColor.needsUpdate = true
      const o = new THREE.Object3D()
      lit.forEach((c, k) => {
        const night = onSphere(c.lat, c.lng, 1, v).dot(s) < -0.03
        onSphere(c.lat, c.lng, radius + block * 1.15, o.position)
        o.lookAt(0, 0, 0)
        const sz = night ? block * 0.42 : 0.0001
        o.scale.set(sz, sz, sz)
        o.updateMatrix()
        lights.setMatrixAt(k, o.matrix)
      })
      lights.instanceMatrix.needsUpdate = true
      if (abidjan.current) abidjan.current.visible = onSphere(5.32, -4.02, 1, v).dot(s) < -0.03
    }
    paint()
    const t = setInterval(paint, 5000)
    return () => clearInterval(t)
  }, [grid, ground, lights, lit, radius, block])

  useFrame(({ clock }) => {
    if (abidjan.current) abidjan.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.25)
    if (!globe.current) return
    // Turn the globe so that the point below (the station's, the Moon's) faces +z.
    const under = view === 'orbite' ? groundTrack() : view === 'lune' ? { lat: 0, lng: subsolar().lng + 70 } : { lat: 8, lng: -4 }
    const g = spin ? under : { lat: 8, lng: -4 }
    globe.current.rotation.set(g.lat * DEG, -g.lng * DEG, 0, 'XYZ')
  })

  return (
    <group>
      <group ref={globe}>
        <primitive object={ground} />
        <primitive object={clouds} />
        <primitive object={lights} />
        <mesh ref={abidjan} position={abj}>
          <boxGeometry args={[block * 1.1, block * 1.1, block * 1.1]} />
          <meshBasicMaterial color="#ff7a00" toneMapped={false} />
        </mesh>
      </group>
      {/* The thin blue air all round */}
      <mesh>
        <sphereGeometry args={[radius + block * 3, 32, 24]} />
        <meshBasicMaterial color="#6fb8ff" transparent opacity={0.12} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
