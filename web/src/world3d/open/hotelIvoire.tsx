import { useMemo } from 'react'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'

// The Hôtel Ivoire, Cocody, over the Ébrié lagoon: the long main building of
// 1963 (architects Heinz Fenchel and Thomas Leitersdorf) and the tower of
// 1969, with Le Toit d'Abidjan, the restaurant on its 23rd floor; the Palais
// des Congrès (1 650 seats) beside them; two outdoor pools; the terrace over
// the lagoon. Sources: Forbes Afrique, Greyscape (world/world.go). Sizes and
// the plan are the game's estimates.
// Frame: +z toward the street (the entrance), -z toward the lagoon.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const white = new THREE.MeshLambertMaterial({ color: '#f3f0e8' })
const shade = new THREE.MeshLambertMaterial({ color: '#d9d3c4' })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const paving = new THREE.MeshLambertMaterial({ color: '#e6dfd0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const tarmac = new THREE.MeshLambertMaterial({ color: '#4a4d55', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const deck = new THREE.MeshLambertMaterial({ color: '#9c7048' })
const trunk = new THREE.MeshLambertMaterial({ color: '#8a6a48' })
const palm = new THREE.MeshLambertMaterial({ color: '#2f8a3a' })
const steel = new THREE.MeshLambertMaterial({ color: '#b8bec6' })
const colored = new THREE.MeshLambertMaterial({ color: '#ffffff' })

/** Glass by day; at night, some windows lit (a pixel texture repeated per bay and floor). */
function windows(bays: number, floors: number, glass: string) {
  const make = (night: boolean) => {
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const g = c.getContext('2d')!
    g.fillStyle = night ? '#000' : glass
    g.fillRect(0, 0, 8, 8)
    if (night) {
      g.fillStyle = '#fff'
      // A few rooms lit: a pattern that doesn't repeat too obviously.
      for (const [x, y] of [[1, 1], [5, 2], [3, 5], [6, 6]]) g.fillRect(x, y, 2, 2)
    } else {
      g.fillStyle = '#5d7a99'
      g.fillRect(0, 0, 8, 1) // reflection of the sky at the top of the pane
      g.fillStyle = '#e9e4d8'
      g.fillRect(3, 0, 1, 8) // the mullion
    }
    const t = new THREE.CanvasTexture(c)
    t.magFilter = t.minFilter = THREE.NearestFilter
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(bays / 2, floors / 2)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return new THREE.MeshLambertMaterial({ map: make(false), emissiveMap: make(true), emissive: '#ffd27a', emissiveIntensity: 0 })
}

/** A slab building's frame: a projecting balcony at each floor, fins between the bays, on its two long faces. */
function frame(len: number, depth: number, floors: number, floorH: number, bay: number, y0: number, out = 0.9): { slabs: Block[]; fins: Block[] } {
  const slabs: Block[] = []
  const fins: Block[] = []
  for (let f = 0; f <= floors; f++) {
    const y = y0 + f * floorH
    for (const s of [-1, 1]) slabs.push({ p: [0, y, s * (depth / 2 + out / 2 - 0.05)], s: [len + 0.4, 0.28, out] })
  }
  for (let x = -len / 2; x <= len / 2 + 0.01; x += bay)
    for (const s of [-1, 1]) fins.push({ p: [x, y0 + (floors * floorH) / 2, s * (depth / 2 + out - 0.12)], s: [0.22, floors * floorH, 0.22] })
  return { slabs, fins }
}

/** A palm tree in blocks: a slender trunk, leaves out in a star. */
function palms(at: [number, number][], seed: string) {
  const r = rng(seed)
  const trunks: Block[] = []
  const leaves: Block[] = []
  for (const [x, z] of at) {
    const h = 8 + r() * 5
    trunks.push({ p: [x, h / 2, z], s: [0.45, h, 0.45] })
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r()
      leaves.push({ p: [x + Math.cos(a) * 1.5, h - 0.2, z + Math.sin(a) * 1.5], s: [3.2, 0.25, 0.8], ry: -a, c: k % 2 ? '#2f8a3a' : '#3c9a45' })
    }
    leaves.push({ p: [x, h + 0.2, z], s: [1.2, 0.6, 1.2], c: '#3c9a45' })
  }
  return { trunks, leaves }
}

export function HotelIvoire({ night }: { night: boolean }) {
  const H = 90 // the tower, about 25 floors
  const TOWER: [number, number] = [20, -12] // its middle, in the frame
  const towerGlass = useMemo(() => windows(14, 24, '#2e4a66'), [])
  const towerEnd = useMemo(() => windows(5, 24, '#2e4a66'), [])
  const wingGlass = useMemo(() => windows(34, 6, '#35526f'), [])
  const crown = useMemo(() => new THREE.MeshLambertMaterial({ color: '#1d2b3c', emissive: '#ffcf6a', emissiveIntensity: 0 }), [])
  // Over the pool deck (drawn on top of it, as the deck is of the lawn).
  const water = useMemo(() => new THREE.MeshLambertMaterial({ color: '#39b2dc', emissive: '#1fa3e0', emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), [])
  const name = useMemo(() => lettering('HÔTEL IVOIRE', '#1b2340', '#ffffff', '#d4b052'), [])
  const nameMat = useMemo(() => signMaterial(name.t), [name])
  const congres = useMemo(() => lettering('PALAIS DES CONGRÈS', '#f3f0e8', '#1b2340', '#d4b052'), [])
  const congresMat = useMemo(() => signMaterial(congres.t), [congres])
  for (const m of [towerGlass, towerEnd, wingGlass]) m.emissiveIntensity = night ? 0.75 : 0
  crown.emissiveIntensity = night ? 0.7 : 0
  water.emissiveIntensity = night ? 0.5 : 0
  nameMat.emissiveIntensity = night ? 1 : 0
  congresMat.emissiveIntensity = night ? 0.8 : 0

  // The tower's frame (from the 2nd floor up) and the main building's.
  const towerFrame = useMemo(() => frame(40, 15, 24, 3.5, 3, 5), [])
  const wingFrame = useMemo(() => frame(100, 16, 6, 3.2, 3, 4.5, 1.2), [])
  // The main building stands on pilotis over its glazed lobby.
  const pilotis = useMemo(() => {
    const out: Block[] = []
    for (let x = -48; x <= 48; x += 6) for (const z of [-7, 7]) out.push({ p: [x, 2.2, z], s: [0.7, 4.4, 0.7] })
    return out
  }, [])
  const trees = useMemo(
    () =>
      palms(
        [[-64, 22], [-40, 20], [-26, 18], [52, 16], [60, 4], [62, -12], [-64, -54], [-44, -57], [-4, -56], [36, -56], [56, -50], [-8, 14], [46, 16]],
        'ivoire-palmes',
      ),
    [],
  )
  // The pools' deck: loungers in rows, parasols.
  const pool = useMemo(() => {
    const loungers: Block[] = []
    const parasols: [number, number][] = []
    for (let x = -52; x <= -14; x += 3.2) {
      loungers.push({ p: [x, 0.35, -51.5], s: [0.8, 0.12, 2], c: '#ffffff' }, { p: [x, 0.6, -52.3], s: [0.8, 0.5, 0.12], ry: 0, c: '#ffffff' })
      if (Math.round(x * 10) % 2 === 0) parasols.push([x + 1.6, -51])
    }
    return { loungers, parasols }
  }, [])
  // The flags along the drive: Côte d'Ivoire's, and those of the guests' countries.
  const flags = useMemo(() => {
    const masts: Block[] = []
    const cloth: Block[] = []
    const COLORS = [
      ['#ff8200', '#ffffff', '#009a44'],
      ['#002395', '#ffffff', '#ed2939'],
      ['#ce1126', '#fcd116', '#009e49'],
      ['#ff8200', '#ffffff', '#009a44'],
      ['#00853f', '#fdef42', '#e31b23'],
    ]
    COLORS.forEach((c, i) => {
      const x = 4 + i * 5
      masts.push({ p: [x, 4, 14], s: [0.12, 8, 0.12] })
      c.forEach((col, k) => cloth.push({ p: [x + 0.4 + k * 0.5, 7.3, 14], s: [0.5, 1.0, 0.04], c: col }))
    })
    return { masts, cloth }
  }, [])
  // Who's there: sunbathers, swimmers, guests on the terrace, the doorman, people arriving.
  const people = useMemo(() => {
    const r = rng('ivoire-gens')
    const one = (p: [number, number, number], ry: number, pose: Pose, lie = false) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { p, ry, pose, lie, gender, look: randomLook(gender, r), seed: r() * 100 }
    }
    return [
      one([-49.6, 0.55, -50.6], 0, 'sleep', true),
      one([-39.99, 0.55, -50.6], 0, 'sleep', true),
      one([-27.2, 0.55, -50.6], 0, 'sleep', true),
      one([-44, -1.05, -44], Math.PI, 'wave'),
      one([-31, -1.05, -46], 0.6, 'idle'),
      one([-16, -1.05, -44], -0.8, 'talk'),
      one([-36, 0, -49.5], Math.PI, 'phone'),
      one([10, 0.4, -61.5], Math.PI, 'talk'),
      one([12, 0.4, -61.2], Math.PI * 0.8, 'talk'),
      one([24, 0.4, -62], Math.PI, 'idle'),
      one([14, 0, 4], 0, 'idle'), // the doorman, at the door
      one([22, 0, 5], 0.4, 'phone'),
      one([26, 0, 4.5], -0.3, 'talk'),
    ]
  }, [])
  return (
    <group>
      {/* The grounds: lawns, the drive, the paving round the buildings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -20]} scale={[140, 100, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0.03, 8]} scale={[44, 9, 1]} geometry={PLANE} material={tarmac} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0.04, -1]} scale={[30, 7, 1]} geometry={PLANE} material={paving} receiveShadow />

      {/* The tower: the slab and its glass, the frame of balconies and fins */}
      <group position={[TOWER[0], 0, TOWER[1]]}>
        <mesh position={[0, H / 2, 0]} castShadow receiveShadow material={[towerEnd, towerEnd, white, white, towerGlass, towerGlass]}>
          <boxGeometry args={[40, H, 15]} />
        </mesh>
        <Blocks at={towerFrame.slabs} material={white} />
        <Blocks at={towerFrame.fins} material={shade} />
        {/* The ends: blind concrete with a stripe of stair windows */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 20.15, H / 2, 0]} geometry={BOX} scale={[0.3, H, 9]} material={white} castShadow />
        ))}
        {/* Le Toit d'Abidjan: the glazed restaurant on the roof, its overhang, the mast; the name */}
        <mesh position={[0, H + 3, 0]} material={crown} castShadow>
          <boxGeometry args={[36, 5, 13]} />
        </mesh>
        <mesh position={[0, H + 5.8, 0]} material={white} castShadow>
          <boxGeometry args={[42, 0.9, 18]} />
        </mesh>
        <mesh position={[14, H + 11, 0]} material={steel}>
          <cylinderGeometry args={[0.3, 0.3, 10, 6]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, H + 8.2, s * 9.2]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[2.6 * name.aspect, 2.6, 1]} geometry={PLANE} material={nameMat} />
        ))}
        {/* The entrance at its foot: the canopy over the drive, on two pillars */}
        <mesh position={[-6, 5, 14.5]} geometry={BOX} scale={[22, 0.7, 14]} material={white} castShadow />
        {[-15, 3].map((x) => (
          <mesh key={x} position={[x, 2.4, 20.5]} geometry={BOX} scale={[0.8, 4.8, 0.8]} material={white} />
        ))}
        <mesh position={[-6, 2.2, 8]} geometry={BOX} scale={[20, 4.4, 0.2]} material={wingGlass} />
      </group>

      {/* The main building: long and low, on pilotis, balconies all along, toward the lagoon */}
      <group position={[-18, 0, -28]}>
        <Blocks at={pilotis} material={white} />
        <mesh position={[0, 2.2, 0]} geometry={BOX} scale={[90, 4.4, 10]} material={wingGlass} />
        <mesh position={[0, 4.5 + (6 * 3.2) / 2, 0]} castShadow receiveShadow material={[white, white, white, white, wingGlass, wingGlass]}>
          <boxGeometry args={[100, 6 * 3.2, 16]} />
        </mesh>
        <Blocks at={wingFrame.slabs} material={white} />
        <Blocks at={wingFrame.fins} material={shade} />
        <mesh position={[0, 4.5 + 6 * 3.2 + 0.5, 0]} geometry={BOX} scale={[103, 1, 20]} material={white} castShadow />
      </group>

      {/* The Palais des Congrès, beside: wide and low, its roof folded in two slopes */}
      <group position={[-52, 0, 4]}>
        <mesh position={[0, 6, 0]} geometry={BOX} scale={[30, 12, 24]} material={white} castShadow receiveShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 7.6, 13.4, 0]} rotation={[0, 0, s * -0.22]} geometry={BOX} scale={[16, 0.6, 26]} material={shade} castShadow />
        ))}
        <mesh position={[0, 3, 12.05]} geometry={BOX} scale={[22, 6, 0.2]} material={wingGlass} />
        <mesh position={[0, 8.6, 12.2]} scale={[1.1 * congres.aspect, 1.1, 1]} geometry={PLANE} material={congresMat} />
      </group>

      {/* The two pools by the lagoon side, their deck, the loungers and parasols */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-33, 0.05, -47]} scale={[46, 14, 1]} geometry={PLANE} material={paving} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-36, 0.09, -45]} scale={[30, 7, 1]} geometry={PLANE} material={water} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-16, 0.09, -45]} scale={[7, 7, 1]} geometry={PLANE} material={water} />
      <Blocks at={pool.loungers} material={colored} color />
      {pool.parasols.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.2, 0]} material={steel}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 5]} />
          </mesh>
          <mesh position={[0, 2.35, 0]}>
            <coneGeometry args={[1.4, 0.45, 8, 1, true]} />
            <meshLambertMaterial color={i % 2 ? '#1b2340' : '#f3f0e8'} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* The terrace over the lagoon: a wooden deck, tables under parasols */}
      <mesh position={[16, 0.2, -62]} geometry={BOX} scale={[40, 0.4, 8]} material={deck} receiveShadow />
      {[4, 12, 20, 28].map((x) => (
        <group key={x} position={[x, 0.4, -62]}>
          <mesh position={[0, 0.4, 0]} geometry={BOX} scale={[1.2, 0.08, 1.2]} material={white} />
          <mesh position={[0, 0.2, 0]} geometry={BOX} scale={[0.1, 0.4, 0.1]} material={steel} />
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[1.5, 0.45, 8, 1, true]} />
            <meshLambertMaterial color="#1b2340" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.2, 0]} material={steel}>
            <cylinderGeometry args={[0.04, 0.04, 2.0, 5]} />
          </mesh>
        </group>
      ))}

      {/* Palms, the flags on the drive, taxis at the door */}
      <Blocks at={trees.trunks} material={trunk} />
      <Blocks at={trees.leaves} material={palm} color />
      <Blocks at={flags.masts} material={steel} />
      <Blocks at={flags.cloth} material={colored} color />
      <Vehicle p={[8, 0, 8]} r={0} kind="taxi" seed={1} />
      <Vehicle p={[30, 0, 9]} r={Math.PI} kind="car" color="#1b1b20" seed={3} />

      <NoShadows>
        {people.map((g, i) => (
          <group key={i} position={g.p} rotation={g.lie ? [-Math.PI / 2, 0, 0] : [0, g.ry, 0]}>
            <Human look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}
