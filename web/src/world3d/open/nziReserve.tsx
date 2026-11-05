import { useMemo } from 'react'
import * as THREE from 'three'
import { BOX, Blocks, lettering, signMaterial } from './ruePrincesse'
import { BUFFALO, CROCODILE, ELEPHANT, Flock, HIPPO, Herd, KOB_SPECIES, MONKEY, Waders, crocBrain, grazer, hippoBrain, makeHerd } from './wildlife'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { t as tr } from '../../lib/i18n'

// La Réserve de la N'Zi (the update « bouake-vivant »), by N'Dokro in the commune of Brobo, 30 km
// north-east of Bouaké: the wooded savanna of the centre (the « V baoulé »), tall dry grass, rôniers
// and shea trees, red termite mounds, and the N'Zi winding through it with its sandbanks. The herds as
// the reserve's guides show them: the elephants down by the river, the buffalo in the open grass, the
// kobs, the green monkeys round the trees by the lodge; the hippos in the river, a crocodile on the
// sand, herons in the shallows, egrets wheeling. At the road, the gate with its name and the rangers'
// hut, the open 4x4 of the game drives; the laterite track looping out into the savanna; the
// watchtower; and the lodge (Lodge des Rives de la N'Zi, the game's) on the bank: its round thatched
// bungalows, the main house and its terrace over the water, the pool. All of it the game's own
// layout, not surveyed.
//
// Frame: +z the road and the gate, the river across the back (−z).

/** The river's line (its middle) across the back, and its half-width. */
const RIVER: [number, number][] = [[-170, -92], [-110, -78], [-50, -84], [0, -98], [50, -90], [110, -76], [170, -86]]
const RIVER_HALF = 11
/** The lodge's reception, where its door is (landmarks.tsx slotIn), and its grounds. */
export const LODGE_DOOR: [number, number] = [-62, -10]
const LODGE: [number, number] = [-70, -40]

/** The river's middle at x (its line, eased between the points). */
export function riverZ(x: number) {
  const i = Math.max(1, RIVER.findIndex((p) => p[0] >= x))
  const [a, b] = [RIVER[i - 1], RIVER[i] ?? RIVER[i - 1]]
  const k = b[0] > a[0] ? Math.min(1, Math.max(0, (x - a[0]) / (b[0] - a[0]))) : 0
  return a[1] + (b[1] - a[1]) * (0.5 - Math.cos(k * Math.PI) / 2)
}
/** On dry land (not in the river nor on its banks), in the reserve. */
const dry = (x: number, z: number) => Math.abs(x) < 150 && z < 70 && z > riverZ(x) + RIVER_HALF + 5 && Math.hypot(x - LODGE[0], z - LODGE[1]) > 34

const M = {
  savanna: new THREE.MeshLambertMaterial({ color: '#b7a35c', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  track: new THREE.MeshLambertMaterial({ color: '#b5653a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  sand: new THREE.MeshLambertMaterial({ color: '#dcc58e', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  water: new THREE.MeshLambertMaterial({ color: '#4c7f74', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  lawn: new THREE.MeshLambertMaterial({ color: '#6aa34f', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  wood: new THREE.MeshLambertMaterial({ color: '#7a5230' }),
  dark: new THREE.MeshLambertMaterial({ color: '#4a3220' }),
  thatch: new THREE.MeshLambertMaterial({ color: '#c79a52' }),
  wall: new THREE.MeshLambertMaterial({ color: '#d9b48a' }),
  pool: new THREE.MeshLambertMaterial({ color: '#3cb7d6', emissive: '#22b6d6', emissiveIntensity: 0 }),
  colored: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  truck: new THREE.MeshLambertMaterial({ color: '#4f6b3a' }),
  tyre: new THREE.MeshLambertMaterial({ color: '#1d1b1a' }),
  canvas: new THREE.MeshLambertMaterial({ color: '#d8c79a' }),
  lamp: new THREE.MeshLambertMaterial({ color: '#fff4d0', emissive: '#ffb84a', emissiveIntensity: 0 }),
}
const CONE = new THREE.ConeGeometry(1, 1, 10)
const DISC = new THREE.CylinderGeometry(1, 1, 1, 14)

/** A band along a line (the river, the track): one flat strip, `half` each side, at height y. */
function strip(line: [number, number][], half: number, y: number, steps = 8) {
  const pts: [number, number][] = []
  for (let i = 1; i < line.length; i++) for (let k = 0; k < steps; k++) {
    const x = line[i - 1][0] + ((line[i][0] - line[i - 1][0]) * k) / steps
    pts.push([x, riverOr(line, x, i, k / steps)])
  }
  pts.push(line[line.length - 1])
  const pos: number[] = []
  const idx: number[] = []
  pts.forEach(([x, z], i) => {
    const [a, b] = [pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]]
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
    const l = Math.hypot(dx, dz) || 1
    const [nx, nz] = [-dz / l, dx / l]
    pos.push(x + nx * half, y, z + nz * half, x - nx * half, y, z - nz * half)
    if (i) idx.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Facing up whichever way the points went.
  if (g.attributes.normal.getY(0) < 0) {
    g.setIndex(idx.map((_, j) => idx[j - (j % 3) + 2 - (j % 3)]))
    g.computeVertexNormals()
  }
  return g
}
/** The river's own line is eased (riverZ); another line is straight between its points. */
function riverOr(line: [number, number][], x: number, i: number, k: number) {
  return line === RIVER ? riverZ(x) : line[i - 1][1] + (line[i][1] - line[i - 1][1]) * k
}

/** The game-drive's track: from the gate out round the savanna and back. */
const TRACK: [number, number][] = [[0, 62], [10, 30], [40, 10], [90, -10], [120, -40], [80, -60], [20, -62], [-20, -55], [-30, -20], [-10, 20], [0, 62]]

export function NziReserve({ night }: { night: boolean }) {
  M.pool.emissiveIntensity = night ? 0.5 : 0
  M.lamp.emissiveIntensity = night ? 1.3 : 0
  const ground = useMemo(() => ({ river: strip(RIVER, RIVER_HALF, 0.05, 10), banks: strip(RIVER, RIVER_HALF + 4, 0.04, 10), track: strip(TRACK, 2.2, 0.06, 1) }), [])
  const signs = useMemo(() => {
    const g = lettering(tr("RÉSERVE DE LA N'ZI"), '#5a3a1e', '#fff1c9', '#e8b54a')
    const l = lettering(tr('LODGE DES RIVES DE LA N’ZI'), '#2f4d2a', '#fff6d6', '#e8c35a')
    return { gate: signMaterial(g.t), gateAspect: g.aspect, lodge: signMaterial(l.t), lodgeAspect: l.aspect }
  }, [])
  signs.gate.emissiveIntensity = night ? 0.5 : 0
  signs.lodge.emissiveIntensity = night ? 0.6 : 0

  // The savanna's trees (rôniers, shea trees, the odd big one), its termite mounds and bushes.
  const flora = useMemo(() => {
    const r = rng('nzi-savane')
    const trunks: { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }[] = []
    const crowns: { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }[] = []
    const mounds: { p: [number, number, number]; s: [number, number, number]; ry?: number }[] = []
    const onTrack = (x: number, z: number) => TRACK.some((p, i) => i > 0 && segDist([x, z], TRACK[i - 1], p) < 5)
    let n = 0
    for (let guard = 0; n < 70 && guard < 900; guard++) {
      const x = (r() - 0.5) * 300
      const z = 70 - r() * 165
      if (!dry(x, z) || onTrack(x, z) || (Math.abs(x) < 14 && z > 40)) continue
      n++
      const palm = r() < 0.4
      const h = palm ? 9 + r() * 5 : 4 + r() * 4
      trunks.push({ p: [x, h / 2, z], s: [palm ? 0.5 : 0.6, h, palm ? 0.5 : 0.6], c: palm ? '#8a7a64' : '#6e5640' })
      if (palm)
        for (let k = 0; k < 5; k++) crowns.push({ p: [x, h, z], s: [4.2, 0.25, 1.1], ry: (k / 5) * Math.PI + r() * 0.3, c: '#5d8a3a' })
      else {
        const R = 3 + r() * 3
        crowns.push({ p: [x, h + 0.6, z], s: [R * 1.7, 1.6, R * 1.7], ry: r() * 3, c: ['#6f8d3a', '#5d7f33', '#7c9a45'][Math.floor(r() * 3)] })
      }
    }
    for (let k = 0; k < 18; k++) {
      const x = (r() - 0.5) * 280
      const z = 60 - r() * 140
      if (!dry(x, z) || onTrack(x, z)) continue
      const h = 1.4 + r() * 2.2
      mounds.push({ p: [x, h / 2, z], s: [1.6 + r(), h, 1.6 + r()], ry: r() * 3 })
      mounds.push({ p: [x + 0.3, h + 0.4, z], s: [0.7, 0.9, 0.7] })
    }
    // Tufts of tall dry grass, in clumps.
    const grass: { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }[] = []
    for (let k = 0; k < 260; k++) {
      const x = (r() - 0.5) * 300
      const z = 70 - r() * 165
      if (!dry(x, z) || onTrack(x, z)) continue
      grass.push({ p: [x, 0.5, z], s: [0.5 + r() * 0.8, 0.6 + r() * 0.9, 0.5 + r() * 0.8], ry: r() * 3, c: ['#c9b26a', '#b39b52', '#d6c27c', '#9f9a4f'][Math.floor(r() * 4)] })
    }
    return { trunks, crowns, mounds, grass }
  }, [])

  // The herds, their brains (each round its middle, which stays put: the reserve is theirs).
  const herds = useMemo(() => {
    const ele = { x: 70, z: -58 }
    const buf = { x: 30, z: -18 }
    const kob = { x: -5, z: 10 }
    const mon = { x: -48, z: -12 }
    return {
      elephants: { a: makeHerd('nzi-elephants', 6, [ele.x, ele.z], 10, [0.8, 1.05]), b: grazer(ele, 18, dry) },
      buffalo: { a: makeHerd('nzi-buffles', 10, [buf.x, buf.z], 8, [0.85, 1.05]), b: grazer(buf, 16, dry) },
      kobs: { a: makeHerd('nzi-kobs', 14, [kob.x, kob.z], 9, [0.85, 1.1]), b: grazer(kob, 20, dry) },
      monkeys: { a: makeHerd('nzi-singes', 9, [mon.x, mon.z], 6, [0.9, 1.1]), b: grazer(mon, 9, dry) },
      hippos: { a: makeHerd('nzi-hippos', 4, [-20, riverZ(-20)], 8, [0.9, 1.1], -1.1), b: hippoBrain((x, z) => [Math.max(-60, Math.min(30, x)), Math.max(riverZ(x) - RIVER_HALF + 3, Math.min(riverZ(x) + RIVER_HALF - 3, z))]) },
      crocs: {
        a: makeHerd('nzi-crocos', 3, [100, riverZ(100) + RIVER_HALF + 1], 4, [1, 1.2]),
        b: crocBrain(
          [[96, riverZ(96) + RIVER_HALF + 1.5], [104, riverZ(104) + RIVER_HALF + 1.2], [112, riverZ(112) + RIVER_HALF + 1.6]],
          (x) => [x, riverZ(x)],
        ),
      },
    }
  }, [])

  // The lodge: the bungalows in an arc on the bank, the main house, the terrace on stilts over the water, the pool.
  const lodge = useMemo(() => {
    const huts = [...Array(7)].map((_, i) => {
      const a = -0.4 + i * 0.32
      return [LODGE[0] + Math.sin(a) * 30, LODGE[1] + 6 - Math.cos(a) * 4 + i * 0.5] as [number, number]
    })
    return { huts }
  }, [])
  // The people: the rangers at the gate, the guests on the terrace, a guide by the 4x4.
  const people = useMemo(() => {
    const r = rng('nzi-gens')
    const one = (p: [number, number, number], ry: number, pose: 'idle' | 'talk' | 'sit' | 'drink' | 'film' | 'phone' | 'eat', dress?: { outfit: string; outfitColor: string }) => {
      const gender: 'femme' | 'homme' = r() < 0.45 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, ...dress } : look, seed: r() * 100 }
    }
    const ranger = { outfit: 'uniforme', outfitColor: '#5c6b3a' }
    return [
      one([9, 0, 58], -Math.PI / 2, 'talk', ranger),
      one([-8, 0, 57], Math.PI / 2, 'idle', ranger),
      one([6.5, 0, 46], Math.PI, 'phone'),
      one([LODGE[0] - 6, 3.2, LODGE[1] - 20], Math.PI, 'film'),
      one([LODGE[0] + 2, 3.2, LODGE[1] - 19], Math.PI, 'drink'),
      one([LODGE[0] - 1, 3.2, LODGE[1] - 18], Math.PI, 'talk'),
      one([LODGE[0] + 10, 0, LODGE[1] + 6], 0.4, 'phone'),
    ]
  }, [])
  const guide = useMemo(() => randomLook('homme', rng('nzi-guide')), [])

  return (
    <group>
      {/* The savanna's ground, the river, its sandy banks, the track */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -20]} material={M.savanna} receiveShadow>
        <planeGeometry args={[340, 200]} />
      </mesh>
      <mesh geometry={ground.banks} material={M.sand} receiveShadow />
      <mesh geometry={ground.river} material={M.water} />
      <mesh geometry={ground.track} material={M.track} receiveShadow />
      <Blocks at={flora.trunks} material={M.colored} color />
      <Blocks at={flora.crowns} material={M.colored} color />
      <Blocks at={flora.mounds} material={M.track} />
      <Blocks at={flora.grass} material={M.colored} color />
      {/* The gate at the road: two posts of logs, the beam, the name; the rangers' hut */}
      <group position={[0, 0, 60]}>
        {[-6, 6].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 3, 0]} scale={[0.9, 6, 0.9]} material={M.wood} castShadow />
        ))}
        <mesh geometry={BOX} position={[0, 6.2, 0]} scale={[14, 0.7, 0.8]} material={M.wood} castShadow />
        <mesh position={[0, 5, 0.45]} material={signs.gate}>
          <planeGeometry args={[9, 9 / signs.gateAspect]} />
        </mesh>
        <mesh geometry={BOX} position={[0, 0.9, -1]} scale={[12, 0.15, 0.15]} material={M.dark} />
        <group position={[-11, 0, -3]}>
          <mesh geometry={BOX} position={[0, 1.4, 0]} scale={[4, 2.8, 4]} material={M.wall} castShadow />
          <mesh geometry={CONE} position={[0, 3.6, 0]} scale={[3.6, 1.8, 3.6]} material={M.thatch} castShadow />
        </group>
      </group>
      {/* The game drive's open 4x4, waiting by the gate */}
      <SafariTruck p={[6, 0, 44]} ry={Math.PI / 2} />
      {/* The watchtower over the savanna */}
      <group position={[40, 0, -40]}>
        {[-1.6, 1.6].flatMap((x) => [-1.6, 1.6].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 3.5, z]} scale={[0.3, 7, 0.3]} material={M.wood} />))}
        <mesh geometry={BOX} position={[0, 7, 0]} scale={[4.4, 0.3, 4.4]} material={M.wood} />
        <mesh geometry={CONE} position={[0, 9.4, 0]} scale={[3.6, 2, 3.6]} material={M.thatch} />
      </group>
      {/* The lodge */}
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LODGE[0], 0.05, LODGE[1] + 8]} material={M.lawn} receiveShadow>
          <planeGeometry args={[70, 46]} />
        </mesh>
        {lodge.huts.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh geometry={DISC} position={[0, 1.4, 0]} scale={[3, 2.8, 3]} material={M.wall} castShadow />
            <mesh geometry={CONE} position={[0, 3.9, 0]} scale={[4, 2.6, 4]} material={M.thatch} castShadow />
            <mesh geometry={BOX} position={[0, 1, 3]} scale={[1, 2, 0.1]} material={M.dark} />
            <mesh geometry={BOX} position={[1.6, 1.6, 2.6]} scale={[0.25, 0.25, 0.25]} material={M.lamp} />
          </group>
        ))}
        {/* The main house: the reception at its door (the place's), the dining room under the big thatch */}
        <group position={[LODGE_DOOR[0], 0, LODGE_DOOR[1] - 7]}>
          <mesh geometry={BOX} position={[0, 2, 0]} scale={[16, 4, 12]} material={M.wall} castShadow receiveShadow />
          <mesh geometry={CONE} position={[0, 6.2, 0]} scale={[12, 4.4, 10]} material={M.thatch} castShadow />
          <mesh position={[0, 4.4, 6.05]} material={signs.lodge}>
            <planeGeometry args={[9, 9 / signs.lodgeAspect]} />
          </mesh>
          <mesh geometry={BOX} position={[0, 1.4, 6.05]} scale={[2.4, 2.8, 0.1]} material={M.dark} />
        </group>
        {/* The terrace on stilts over the river's bank, its tables */}
        <group position={[LODGE[0], 0, LODGE[1] - 18]}>
          {[-7, 0, 7].flatMap((x) => [-3, 3].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 1.5, z]} scale={[0.3, 3, 0.3]} material={M.wood} />))}
          <mesh geometry={BOX} position={[0, 3.05, 0]} scale={[16, 0.2, 8]} material={M.wood} receiveShadow />
          <mesh geometry={BOX} position={[0, 3.6, -3.95]} scale={[16, 0.08, 0.08]} material={M.dark} />
          {[-5, 0, 5].map((x) => (
            <mesh key={x} geometry={DISC} position={[x, 3.6, 0.5]} scale={[0.8, 0.08, 0.8]} material={M.dark} />
          ))}
          <mesh geometry={CONE} position={[0, 6.5, 0]} scale={[10, 2.5, 6]} material={M.thatch} castShadow />
          {[-7, 7].map((x) => (
            <mesh key={x} geometry={BOX} position={[x, 4.8, 0]} scale={[0.25, 3.4, 0.25]} material={M.wood} />
          ))}
        </group>
        <mesh geometry={BOX} position={[LODGE[0] + 18, 0.08, LODGE[1] + 2]} scale={[10, 0.1, 5]} material={M.pool} />
      </group>
      {/* The animals */}
      <Herd species={ELEPHANT} animals={herds.elephants.a} brain={herds.elephants.b} far={420} />
      <Herd species={BUFFALO} animals={herds.buffalo.a} brain={herds.buffalo.b} far={320} />
      <Herd species={KOB_SPECIES} animals={herds.kobs.a} brain={herds.kobs.b} far={260} />
      <Herd species={MONKEY} animals={herds.monkeys.a} brain={herds.monkeys.b} far={160} />
      <Herd species={HIPPO} animals={herds.hippos.a} brain={herds.hippos.b} far={300} />
      <Herd species={CROCODILE} animals={herds.crocs.a} brain={herds.crocs.b} far={200} />
      <Waders spots={[[-110, riverZ(-110) + RIVER_HALF - 1.5, 1.2], [-96, riverZ(-96) + RIVER_HALF - 2, 2.4], [30, riverZ(30) + RIVER_HALF - 1, 0.6], [60, riverZ(60) - RIVER_HALF + 1.5, 3.4]]} />
      <Flock centre={[10, -80]} radius={40} height={16} seed="nzi-aigrettes" />
      <NoShadows>
        {people.map((p, i) => (
          <group key={i} position={p.p} rotation={[0, p.ry, 0]}>
            <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
      <group position={[3, 0, 46]} rotation={[0, Math.PI, 0]}>
        <TalkHuman id="nzi-guide" look={{ ...guide, outfit: 'uniforme', outfitColor: '#5c6b3a' }} gender="homme" pose="talk" seed={4} />
      </group>
    </group>
  )
}

const segDist = ([x, z]: [number, number], a: [number, number], b: [number, number]) => {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const L = dx * dx + dz * dz || 1
  const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L))
  return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k)
}

/** The game drives' open 4x4: olive green, the cab, the raised benches behind under a canvas roof, the spare wheel. Facing +x. */
export function SafariTruck({ p, ry = 0, roof = true }: { p: [number, number, number]; ry?: number; /** Its canvas roof (not when one rides on it: it would hide the view). */ roof?: boolean }) {
  return (
    <group position={p} rotation={[0, ry, 0]}>
      <mesh geometry={BOX} position={[0, 1.1, 0]} scale={[5.2, 1, 2.1]} material={M.truck} castShadow />
      <mesh geometry={BOX} position={[1.6, 1.9, 0]} scale={[1.6, 0.8, 2]} material={M.truck} castShadow />
      <mesh geometry={BOX} position={[2.42, 1.9, 0]} scale={[0.05, 0.6, 1.8]} material={M.tyre} />
      {[-0.4, -1.6].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 1.9 + (x < -1 ? 0.3 : 0), 0]} scale={[0.5, 0.15, 1.9]} material={M.wood} />
      ))}
      {[-2.4, 0.6].flatMap((x) => [-0.95, 0.95].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 2.6, z]} scale={[0.08, 1.6, 0.08]} material={M.dark} />))}
      {roof && <mesh geometry={BOX} position={[-0.9, 3.4, 0]} scale={[3.3, 0.08, 2.2]} material={M.canvas} />}
      {[-1.7, 1.7].flatMap((x) => [-1.05, 1.05].map((z) => <mesh key={`w${x}${z}`} geometry={DISC} position={[x, 0.5, z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.5, 0.3, 0.5]} material={M.tyre} />))}
      <mesh geometry={DISC} position={[-2.7, 1.3, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.45, 0.25, 0.45]} material={M.tyre} />
    </group>
  )
}
