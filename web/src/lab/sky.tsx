import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { XZ } from '../world3d/open/geo'
import { SkyLife } from '../world3d/open/skyLife'
import { Airliner } from '../world3d/open/airport'
import { airLegs } from '../lib/airTraffic'
import type { World } from '../lib/types'

// ?view=sky: the sky's life of the update « camera-vie » (world3d/open/skyLife.tsx) over a few blocks of houses,
// trees and a strip of lagoon: the birds, the airline's planes, the helicopter, the kites.
// &cam=x,y,z&look=x,y,z the camera; &hour= the hour (birds and kites by day); &plane=m moves the timetable on to
// the next plane within m metres; &heli moves it to the helicopter's next pass; &night.
// ?view=glb&id=sky-plane | sky-birds-up | sky-birds-down (city.tsx GlbExport): the big map's models (components/map/skyMap.ts).

const q = new URLSearchParams(location.search)
const vec = (k: string, d: [number, number, number]) => (q.get(k)?.split(',').map(Number) as [number, number, number] | undefined) ?? d

/** Port-Bouët, by the airport: the planes climb out over it. */
const ORIGIN = { lat: 5.268, lng: -3.948 }
// The airline's airports and its routes from Abidjan, both ways (as backend world.FlightRoutes gives them).
const AIRPORTS: [string, string, number, number][] = [
  ['abidjan', 'pb-aeroport', 5.2544, -3.93268],
  ['yamoussoukro', 'yakro-aeroport', 6.90607, -5.35955],
  ['bouake', 'bouake-aeroport', 7.73576, -5.0691],
  ['san-pedro', 'sp-aeroport', 4.7469, -6.6607],
  ['daloa', 'daloa-aeroport', 6.7928, -6.4731],
]
export const LAB_WORLD = {
  cities: AIRPORTS.map(([city, place, lat, lng]) => ({ id: city, communes: [{ places: [{ id: place, lat, lng }] }] })),
  flights: AIRPORTS.slice(1).flatMap(([city, place], i) => [
    { from: 'abidjan', place: 'pb-aeroport', to: city, toPlace: place, game: 19 + i, km: 240 + i * 40 },
    { from: city, place, to: 'abidjan', toPlace: 'pb-aeroport', game: 19 + i, km: 240 + i * 40 },
  ]),
} as unknown as Pick<World, 'flights' | 'cities'>

// The houses (x, z, width, depth, height) and trees of the lab's quarter.
const HOUSES: [number, number, number, number, number][] = [
  [-14, -10, 10, 8, 6],
  [0, -16, 12, 9, 9],
  [16, -9, 9, 9, 5],
  [-20, 10, 8, 10, 7],
  [22, 12, 10, 8, 12],
]
const TREES: XZ[] = [
  [-6, 4],
  [8, 6],
  [-30, -2],
  [30, -2],
]
const WATER: XZ[][][] = [[[...Array.from({ length: 31 }, (_, i): XZ => [-300 + i * 20, 60]), [300, 400], [-300, 400]]]]

function Rig() {
  // (Set every frame: the canvas aims its camera once it is made, after the effects.)
  const at = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3() }), [])
  useFrame(({ camera, scene }) => {
    if (q.has('orbit')) return
    camera.position.set(...vec('cam', [2, 1.7, 34]))
    camera.lookAt(...vec('look', [0, 14, -30]))
    // &track=plane|heli: the camera follows the nearest plane (or the helicopter) from where it stands.
    const track = q.get('track')
    if (!track) return
    scene.traverse((o) => {
      const im = o as THREE.InstancedMesh
      if (track === 'plane' && im.isInstancedMesh && im.geometry.type === 'LatheGeometry' && im.count) {
        im.getMatrixAt(0, at.m)
        camera.lookAt(at.p.setFromMatrixPosition(at.m))
      }
      if (track === 'heli' && o.name === 'heli' && o.visible) camera.lookAt(o.getWorldPosition(at.p))
    })
  })
  return null
}

function Quarter() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshLambertMaterial color="#c9b48a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 230]}>
        <planeGeometry args={[600, 340]} />
        <meshLambertMaterial color="#2fb3e6" />
      </mesh>
      {HOUSES.map(([x, z, w, d, h], i) => (
        <mesh key={i} position={[x, h / 2, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshLambertMaterial color={['#e9d8b4', '#d98f5c', '#f1efe6', '#b9c9a7', '#e8c46a'][i]} />
        </mesh>
      ))}
      {TREES.map(([x, z], i) => {
        const h = 3 + ((i * 7) % 3)
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[1, h, 1]} />
              <meshLambertMaterial color="#6b4a2f" />
            </mesh>
            <mesh position={[0, h + 1.2, 0]}>
              <boxGeometry args={[4, 3, 4]} />
              <meshLambertMaterial color="#3f8f3a" />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/** Moves the sky's timetable to what the page asks for (a plane near, the helicopter's pass). */
function Shift() {
  useEffect(() => {
    const w = globalThis as { __skyFind?: (m: number) => number; __skyShift?: number }
    const k = setTimeout(() => {
      if (q.get('plane')) w.__skyFind?.(Number(q.get('plane')))
      // (The helicopter passes for 75 s every 420 s of the shared clock: to the start of the next one, plus &heli s.)
      if (q.has('heli')) w.__skyShift = 420 - ((Date.now() / 1000 - Date.UTC(2024, 0, 1) / 1000) % 420) + Number(q.get('heli') || 30)
    }, 500)
    return () => clearTimeout(k)
  }, [])
  return null
}

function Info() {
  useFrame(({ gl, scene, camera }) => void Object.assign(window, { __info: { calls: gl.info.render.calls, triangles: gl.info.render.triangles }, __scene: scene, __camera: camera }))
  return null
}

export function SkyLab() {
  const focus = useRef<XZ>([0, 0])
  const legs = useMemo(() => airLegs(LAB_WORLD, () => true), [])
  const trees = useMemo(() => TREES.map(([x, z], i) => ({ x, z, h: 3 + ((i * 7) % 3) })), [])
  const roofAt = useMemo(
    () => (x: number, z: number) => {
      for (const [hx, hz, w, d, h] of HOUSES) if (Math.abs(x - hx) < w / 2 && Math.abs(z - hz) < d / 2) return h
      return 0
    },
    [],
  )
  const night = q.has('night')
  const hour = Number(q.get('hour') ?? (night ? 22 : 10))
  return (
    <Canvas style={{ width: '100vw', height: '100vh', background: night ? '#0b1430' : '#8fd0f2' }} camera={{ fov: 45, near: 0.5, far: 6000 }}>
      <fog attach="fog" args={[night ? '#0b1430' : '#bfe3f5', 400, 5200]} />
      <ambientLight intensity={night ? 0.35 : 1.1} />
      <directionalLight position={[60, 120, 40]} intensity={night ? 0.2 : 1.6} />
      <Rig />
      <Quarter />
      <SkyLife focus={focus} origin={ORIGIN} legs={legs} roofAt={roofAt} trees={trees} water={WATER} hour={hour} night={night} rain={false} />
      <Shift />
      <Info />
      {q.has('orbit') && <OrbitControls target={vec('look', [0, 14, -30])} />}
    </Canvas>
  )
}

// The big map's models, exported by city.tsx's GlbExport: one airliner; seven birds in a V, wings up or down.
const birdMat = new THREE.MeshLambertMaterial({ color: '#f3f1ea' })
export function SkyModel({ id }: { id: string }) {
  if (id === 'sky-plane') return <Airliner gear={false} far lights={false} spin={false} />
  const up = id === 'sky-birds-up' ? 0.7 : -0.6
  return (
    <group>
      {Array.from({ length: 7 }, (_, i) => {
        const row = Math.ceil(i / 2)
        const side = i === 0 ? 0 : i % 2 ? 1 : -1
        return (
          <group key={i} position={[side * row * 1.6, 0, -row * 1.4]}>
            <mesh material={birdMat}>
              <boxGeometry args={[0.18, 0.16, 0.6]} />
            </mesh>
            {[1, -1].map((sg) => (
              <group key={sg} rotation={[0, 0, sg * up]}>
                <mesh material={birdMat} position={[sg * 0.33, 0, 0]}>
                  <boxGeometry args={[0.6, 0.04, 0.24]} />
                </mesh>
              </group>
            ))}
          </group>
        )
      })}
    </group>
  )
}
