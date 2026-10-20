import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { sign } from '../interior/bigPlace'
import { BOX, Blocks } from './ruePrincesse'

// The Hôtel Poulman, on the Plateau by the lagoon, as the photo of the real one
// shows it: a slab of ten floors in two wings, the right one stepped forward;
// long bands of windows between warm spandrels, cut by deep vertical fins in
// pairs; blank end walls rising above the roof at each wing's edges; at night
// the facade glows orange in its floodlights. In front, the low grey concrete
// canopy over the drop-off on two square pillars, the hotel's name on its
// fascia, the revolving door lit behind; palms, a flag, cars dropping guests.
// Sizes are the game's estimates. Frame: +z toward the street.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** Ten floors of 3.3 m, the ground floor's lobby higher. */
const FLOORS = 10
const STOREY = 3.3
const BASE = 4.5
const TOP = BASE + FLOORS * STOREY

/** The two wings: x from–to, the front face's z, the depth. */
const WINGS = [
  { x0: -30, x1: 3, front: 0, depth: 16 },
  { x0: 3, x1: 30, front: 4, depth: 16 },
] as const

const concrete = new THREE.MeshLambertMaterial({ color: '#8f9296' })
const fin = (night: boolean) => new THREE.MeshLambertMaterial({ color: night ? '#f0b27a' : '#e9dcc4', emissive: night ? '#b8561c' : '#000000', emissiveIntensity: night ? 0.55 : 0 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const paving = new THREE.MeshLambertMaterial({ color: '#cfcac0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const trunk = new THREE.MeshLambertMaterial({ color: '#8a6a48' })
const leaves = new THREE.MeshLambertMaterial({ color: '#2f8a3a' })

/** The facade between the fins: per floor a band of glass, the spandrel under it; at night the spandrels glow and some rooms are lit. */
function facadeTexture(night: boolean, bays: number) {
  const c = document.createElement('canvas')
  c.width = 16 * bays
  c.height = 16 * FLOORS
  const g = c.getContext('2d')!
  for (let f = 0; f < FLOORS; f++)
    for (let b = 0; b < bays; b++) {
      const [x, y] = [b * 16, f * 16]
      g.fillStyle = night ? '#ff9a4a' : '#d9b98c'
      g.fillRect(x, y, 16, 16)
      // The window band: dark glass, a frame line between the panes; a few rooms lit at night.
      const lit = night && Math.sin(f * 12.9898 + b * 78.233) * 43758.5453 % 1 > 0.55
      g.fillStyle = lit ? '#ffe7a8' : night ? '#2a2530' : '#3d4c5c'
      g.fillRect(x + 1, y + 2, 14, 8)
      g.fillStyle = night ? '#c46a2a' : '#c8a576'
      g.fillRect(x + 7, y + 2, 1, 8)
    }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function HotelPoulman({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const front = WINGS.map((w) => {
      const map = facadeTexture(night, Math.round((w.x1 - w.x0) / 3))
      return new THREE.MeshLambertMaterial({ map, emissive: night ? '#ffffff' : '#000000', emissiveMap: night ? map : null, emissiveIntensity: night ? 0.45 : 0 })
    })
    const side = new THREE.MeshLambertMaterial({ map: facadeTexture(night, 5), emissive: night ? '#ffffff' : '#000000', emissiveIntensity: night ? 0.3 : 0 })
    return { front, side, fin: fin(night), name: sign('POULMAN', '#1b1d22', '#f4f4f4', 512, 128), city: sign('ABIDJAN', '#1b1d22', '#f4f4f4', 512, 96), canopy: new THREE.MeshLambertMaterial({ color: '#8f9296', emissive: night ? '#6b6e74' : '#000000', emissiveIntensity: night ? 0.6 : 0 }), door: new THREE.MeshLambertMaterial({ color: '#ffcf8a', emissive: '#ffb45a', emissiveIntensity: night ? 1 : 0.3 }) }
  }, [night])
  const fins = useMemo(() => {
    const out: Block[] = []
    for (const w of WINGS) {
      // Fins in pairs every ~6.5 m, standing proud of the facade, running up past the roof line.
      for (let x = w.x0 + 4; x < w.x1 - 2; x += 6.5) for (const dx of [0, 1.6]) out.push({ p: [x + dx, (TOP + 1) / 2, w.front + 0.45], s: [0.35, TOP + 1, 0.9] })
      // The blank end walls of each wing, taller than the roof.
      out.push({ p: [w.x0 + 1.2, (TOP + 2.4) / 2, w.front - w.depth / 2], s: [2.4, TOP + 2.4, w.depth + 0.4] })
      out.push({ p: [w.x1 - 1.2, (TOP + 2.4) / 2, w.front - w.depth / 2], s: [2.4, TOP + 2.4, w.depth + 0.4] })
    }
    return out
  }, [])
  return (
    <group>
      {/* The grounds: the forecourt and the drive, lawns at the sides */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.02, 14]} geometry={PLANE_GEO} scale={[40, 20, 1]} material={paving} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-22, 0.03, 12]} geometry={PLANE_GEO} scale={[18, 16, 1]} material={lawn} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[34, 0.03, 14]} geometry={PLANE_GEO} scale={[10, 16, 1]} material={lawn} />
      {/* The two wings: the lobby floor in grey, the floors above with their bands */}
      {WINGS.map((w, i) => {
        const [cx, cz, wd] = [(w.x0 + w.x1) / 2, w.front - w.depth / 2, w.x1 - w.x0]
        return (
          <group key={i}>
            <mesh geometry={BOX} position={[cx, BASE / 2, cz]} scale={[wd, BASE, w.depth]} material={concrete} castShadow receiveShadow />
            <mesh geometry={BOX} position={[cx, BASE + (FLOORS * STOREY) / 2, cz]} scale={[wd, FLOORS * STOREY, w.depth]} material={mats.side} castShadow />
            {/* The front, a plane over the box carrying the windows */}
            <mesh position={[cx, BASE + (FLOORS * STOREY) / 2, w.front + 0.02]} material={mats.front[i]}>
              <planeGeometry args={[wd, FLOORS * STOREY]} />
            </mesh>
            {/* The roof's parapet */}
            <mesh geometry={BOX} position={[cx, TOP + 0.5, cz]} scale={[wd, 1, w.depth]} material={mats.fin} />
          </group>
        )
      })}
      <Blocks at={fins} material={mats.fin} />
      {/* The canopy over the drop-off: a low concrete slab on two square pillars, the name on its fascia; floodlit grey at night like the facade */}
      <Blocks
        at={[
          { p: [12, 5.2, 9.5], s: [22, 1.4, 11] },
          { p: [3.5, 2.25, 13.5], s: [1.6, 4.5, 1.6] },
          { p: [20.5, 2.25, 13.5], s: [1.6, 4.5, 1.6] },
        ]}
        material={mats.canopy}
      />
      <mesh position={[6, 5.25, 15.03]} material={mats.name}>
        <planeGeometry args={[7, 1.15]} />
      </mesh>
      <mesh position={[14.5, 5.3, 15.03]} material={mats.city}>
        <planeGeometry args={[4, 0.6]} />
      </mesh>
      {/* Under it, the glass front and the revolving door, lit warm */}
      <mesh position={[12, 2, 4.06]} material={mats.door}>
        <planeGeometry args={[14, 3.6]} />
      </mesh>
      <mesh geometry={BOX} position={[12, 1.8, 4.9]} scale={[2.6, 3.6, 2.6]} material={GLASS} />
      {night && <pointLight position={[12, 4, 9]} intensity={30} distance={16} color="#ffd9a0" />}
      {/* The flag on its pole, by the canopy */}
      <mesh geometry={BOX} position={[27, 6, 18]} scale={[0.14, 12, 0.14]} material={concrete} />
      <Blocks at={[{ p: [27.6, 11, 18], s: [0.7, 1.4, 0.05], c: '#ff8200' }, { p: [28.3, 11, 18], s: [0.7, 1.4, 0.05], c: '#ffffff' }, { p: [29, 11, 18], s: [0.7, 1.4, 0.05], c: '#009e60' }]} material={COLORED} color />
      {/* Palms in front, a hedge along the lawns */}
      {[[-4, 14], [-12, 16], [-24, 18], [-30, 12], [31, 22], [34, 10]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={BOX} position={[0, 3.5, 0]} scale={[0.5, 7, 0.5]} material={trunk} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} geometry={BOX} position={[Math.cos((k * Math.PI) / 3) * 1.4, 7, Math.sin((k * Math.PI) / 3) * 1.4]} rotation={[0, -(k * Math.PI) / 3, 0.35]} scale={[2.8, 0.18, 0.7]} material={leaves} />
          ))}
        </group>
      ))}
      {/* Cars dropping guests under the canopy, one parked by the lawn */}
      <Vehicle p={[9, 0, 10]} r={0} kind="car" seed={7} color="#212529" />
      <Vehicle p={[16, 0, 11]} r={Math.PI} kind="taxi" seed={2} />
      <Vehicle p={[-14, 0, 8]} r={Math.PI / 2} kind="car" seed={11} color="#f8f9fa" />
    </group>
  )
}

const PLANE_GEO = new THREE.PlaneGeometry(1, 1)
const GLASS = new THREE.MeshLambertMaterial({ color: '#bfe3f2', transparent: true, opacity: 0.35 })
const COLORED = new THREE.MeshLambertMaterial({ color: '#ffffff' })

/** What one can't walk through: the two wings, the canopy's pillars. */
export const POULMAN_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  ...WINGS.map((w) => ({ x: (w.x0 + w.x1) / 2, z: w.front - w.depth / 2, hw: (w.x1 - w.x0) / 2 + 0.5, hd: w.depth / 2 + 0.9, rot: 0, top: TOP + 2 })),
  { x: 3.5, z: 13.5, r: 1.1 },
  { x: 20.5, z: 13.5, r: 1.1 },
]
