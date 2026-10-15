import { useMemo } from 'react'
import * as THREE from 'three'
import { Human, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'

// The Palais des Sports de Treichville, rue du Stade, beside the Parc des
// sports: a rotunda 66 m across (OpenStreetMap), white, ringed by two tiers
// of arches with the red of the stairs and the seats showing through, under
// a low dark dome topped by a lantern. A floodlight mast stands by the pitch.
// Built from photos of the renovated hall; heights are the game's estimates.
// Frame: +z toward the main road, the entrance on that side.

type Block = {
  p: [number, number, number]
  s: [number, number, number]
  ry?: number
  c?: string
}

const R = 33 // outer radius of the arcade
const BAYS = 28
const LOW = 10.2 // the floor of the upper gallery
const TOP = 19 // top of the cornice, where the dome starts
const STEP = (Math.PI * 2) / BAYS
const CHORD = 2 * R * Math.sin(STEP / 2)

const white = new THREE.MeshLambertMaterial({ color: '#f3f1ec' })
const shade = new THREE.MeshLambertMaterial({ color: '#d9d6cf' })
const red = new THREE.MeshLambertMaterial({ color: '#d1352b' })
const dome = new THREE.MeshLambertMaterial({
  color: '#4d5156',
  side: THREE.DoubleSide,
})
const lantern = new THREE.MeshLambertMaterial({ color: '#9aa0a6' })
const iron = new THREE.MeshLambertMaterial({ color: '#5c6166' })
const paving = new THREE.MeshLambertMaterial({
  color: '#c9c4ba',
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
})
const lampOff = new THREE.MeshLambertMaterial({ color: '#e6e9ec' })
const lampOn = new THREE.MeshBasicMaterial({ color: '#fff6dc' })

/** A block on the ring: at angle a, radius r, height y (its centre), facing out. */
function onRing(a: number, r: number, y: number, s: [number, number, number], c?: string): Block {
  return { p: [Math.sin(a) * r, y, Math.cos(a) * r], s, ry: a, c }
}

/** An arched opening in a wall: straight sides up to the spring, then a half circle. */
function archHole(cx: number, bottom: number, width: number, spring: number) {
  const h = new THREE.Path()
  const r = width / 2
  h.moveTo(cx - r, bottom)
  h.lineTo(cx + r, bottom)
  h.lineTo(cx + r, spring)
  h.absarc(cx, spring, r, 0, Math.PI, false)
  h.lineTo(cx - r, bottom)
  return h
}

/** One bay of the arcade, flat, centred on x = 0, its face at z = 0: the tall arch, the smaller one above, the cornice's two windows. */
function bayGeometry() {
  const w = CHORD + 0.05
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, TOP)
  s.lineTo(-w / 2, TOP)
  s.lineTo(-w / 2, 0)
  s.holes.push(archHole(0, 0.6, 4.9, 7.6), archHole(0, LOW + 0.9, 4.3, 14.8))
  for (const x of [-1.1, 1.1]) {
    const q = new THREE.Path()
    q.moveTo(x - 0.4, 17.4)
    q.lineTo(x + 0.4, 17.4)
    q.lineTo(x + 0.4, 18.1)
    q.lineTo(x - 0.4, 18.1)
    q.lineTo(x - 0.4, 17.4)
    s.holes.push(q)
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 1.1,
    bevelEnabled: false,
    curveSegments: 6,
  })
  g.translate(0, 0, -1.1)
  return g
}

/** The same piece around the ring, once per bay. */
function Ring({ geometry, material, r }: { geometry: THREE.BufferGeometry; material: THREE.Material; r: number }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, BAYS)
    const o = new THREE.Object3D()
    for (let i = 0; i < BAYS; i++) {
      const a = i * STEP
      o.position.set(Math.sin(a) * r, 0, Math.cos(a) * r)
      o.rotation.set(0, a, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.castShadow = true
    m.receiveShadow = true
    return m
  }, [geometry, material, r])
  return <primitive object={mesh} />
}

/** Behind the arches: the pilasters in front of each pier, the red balustrades and stair landings, the hall's wall. */
function arcade() {
  const pilasters: Block[] = []
  const bands: Block[] = []
  const reds: Block[] = []
  const inner: Block[] = []
  for (let i = 0; i < BAYS; i++) {
    const mid = i * STEP // the bay's middle; its piers either side
    const a = mid + STEP / 2
    pilasters.push(onRing(a, R + 0.25, TOP / 2, [1.1, TOP, 0.5]))
    // The ledges between the tiers and under the cornice, and the lip on top.
    bands.push(onRing(mid, R + 0.15, LOW + 0.45, [CHORD + 0.3, 0.35, 0.4]), onRing(mid, R + 0.15, 16.9, [CHORD + 0.3, 0.3, 0.4]), onRing(mid, R + 0.3, TOP + 0.12, [CHORD + 0.5, 0.3, 1.4]))
    reds.push(onRing(mid, R - 2.2, 2.1, [4.9, 1.3, 0.25]), onRing(mid, R - 2.2, LOW + 1.6, [4.3, 1.0, 0.25]))
    if (i % 2 === 0) reds.push(onRing(mid, R - 3, 5.2, [4.6, 0.4, 0.3]))
    inner.push(onRing(mid, R - 4, TOP / 2, [CHORD * 0.9, TOP, 0.4]))
  }
  return { pilasters, bands, reds, inner }
}

/** The dome: a low cap from the cornice to the lantern, and the lantern itself. */
function useDome() {
  return useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      pts.push(new THREE.Vector2(R - 0.4 - t * (R - 14.5), TOP + 0.2 + Math.sin((t * Math.PI) / 2) * 4.6))
    }
    const cap = new THREE.LatheGeometry(pts, 48)
    const top = new THREE.LatheGeometry([new THREE.Vector2(14.3, TOP + 6.2), new THREE.Vector2(9, TOP + 7.1), new THREE.Vector2(0.01, TOP + 7.5)], 32)
    return { cap, top }
  }, [])
}

/** The floodlight mast by the pitch: a lattice column and its bank of lamps. */
function mast(x: number, z: number) {
  const steel: Block[] = []
  for (const [dx, dz] of [
    [-0.35, -0.35],
    [0.35, -0.35],
    [-0.35, 0.35],
    [0.35, 0.35],
  ])
    steel.push({ p: [x + dx, 15, z + dz], s: [0.14, 30, 0.14] })
  for (let y = 2; y < 30; y += 2.5) steel.push({ p: [x, y, z], s: [0.85, 0.1, 0.85] })
  const lamps: Block[] = []
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++)
      lamps.push({
        p: [x - 1.35 + col * 0.9, 30.6 + row * 0.85, z + 0.3],
        s: [0.75, 0.7, 0.3],
      })
  steel.push({ p: [x, 31.45, z], s: [3.8, 2.8, 0.25] })
  return { steel, lamps }
}

export function PalaisDesSports({ night }: { night: boolean }) {
  const parts = useMemo(arcade, [])
  const { cap, top } = useDome()
  const bay = useMemo(bayGeometry, [])
  const flood = useMemo(() => mast(-44, 20), [])
  const sign = useMemo(() => {
    const l = lettering('PALAIS DES SPORTS', '#f3f1ec', '#1c1c1e', '#d1352b')
    return { m: signMaterial(l.t), aspect: l.aspect }
  }, [])
  sign.m.emissiveIntensity = night ? 0.7 : 0
  // At night the hall glows through its arches.
  const hall = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: '#767a80',
        emissive: '#ffcf8a',
        emissiveIntensity: 0,
      }),
    [],
  )
  hall.emissiveIntensity = night ? 0.55 : 0
  const ring = useMemo(() => {
    const g = new THREE.CylinderGeometry(14.3, 14.3, 1.5, 32, 1, true)
    g.translate(0, TOP + 4.8 + 0.7, 0)
    return g
  }, [])
  const cast = useMemo(() => {
    const r = rng('treich-palais')
    return [...Array(7)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'homme' : 'femme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [])
  const people: [number, number, number, Pose][] = [
    [-3, R + 6, Math.PI, 'walk'],
    [4, R + 9, 0.4, 'talk'],
    [5.2, R + 9.6, -2.6, 'talk'],
    [-12, R + 4, 2.4, 'idle'],
    [16, R + 2, -0.6, 'phone'],
    [0.8, R + 3, Math.PI, 'walk'],
    [-20, R - 2, 1.2, 'walk'],
  ]

  return (
    <group>
      {/* The forecourt, round like the hall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={useMemo(() => new THREE.CircleGeometry(R + 11, 48), [])} material={paving} receiveShadow />

      <Blocks at={parts.inner} material={hall} />
      <Blocks at={parts.reds} material={red} />
      <Ring geometry={bay} material={white} r={R * Math.cos(STEP / 2)} />
      <Blocks at={parts.pilasters} material={white} />
      <Blocks at={parts.bands} material={shade} />
      {/* The floor of the upper gallery, seen through the arches */}
      <mesh position={[0, LOW + 0.75, 0]} geometry={useMemo(() => new THREE.CylinderGeometry(R - 0.4, R - 0.4, 0.3, 48), [])} material={shade} receiveShadow />

      <mesh geometry={cap} material={dome} castShadow receiveShadow />
      <mesh geometry={ring} material={lantern} />
      <mesh geometry={top} material={dome} castShadow />

      {/* The entrance on the road side: steps, a canopy and the name */}
      <group position={[0, 0, R + 1.2]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[0, 0.12 + k * 0.12, 2.4 - k * 0.6]} scale={[12, 0.24 + k * 0.24, 1.2]} geometry={BOX} material={shade} receiveShadow />
        ))}
        <mesh position={[0, 4.6, 1.2]} scale={[13, 0.35, 3.6]} geometry={BOX} material={white} castShadow />
        {[-6, 6].map((x) => (
          <mesh key={x} position={[x, 2.3, 2.7]} scale={[0.35, 4.6, 0.35]} geometry={BOX} material={white} castShadow />
        ))}
        <mesh position={[0, 5.25, 2.2]} scale={[Math.min(12, 0.95 * sign.aspect), 0.95, 1]} geometry={PLANE} material={sign.m} />
      </group>

      <Blocks at={flood.steel} material={iron} />
      <Blocks key={night ? 'n' : 'd'} at={flood.lamps} material={night ? lampOn : lampOff} />

      {people.map(([x, z, ry, pose], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <Human look={cast[i].look} gender={cast[i].gender} pose={pose} seed={cast[i].seed} />
        </group>
      ))}
    </group>
  )
}
