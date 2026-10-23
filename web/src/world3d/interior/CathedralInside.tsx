import { SpotActions } from '../SpotActions'
import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { NoShadows, type Pose } from '../../avatar/Human'
import { LowHuman } from '../../avatar/LowHuman'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Character } from '../Character'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere } from './bigPlace'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Cathedral, NAVE, TOWER, WINDOWS, naveHalf, roofAt, towerPoint, vitrail, windowAt } from '../open/cathedral'

// Inside the Cathédrale Saint-Paul: one great triangle under the roof, the
// seats in tiers going down toward the altar in the middle (4 500 seats),
// Franzosi's four windows along the walls, lit from inside, the baptismal
// font in the south-west corner and the confessionals in the south-east (as
// the cathedral's page places them). Sunday morning it's full for mass; on
// other days a few people pray and visitors film the windows. Behind the
// altar, the stairs up the tower: the view from the top. The frame is the
// outside's (cathedral.tsx): +z the doors, -z the tower; y 0 the doors'
// level, the altar down at the bottom of the tiers.

/** The altar, in the middle of the tiers. */
const ALTAR: XZ = [0, -24]
/** The sanctuary's podium round it (radius). */
const SANCTUARY = 6
/** The first tier, its depth, its rise, how many. */
const R0 = 8
const STEP = 1.4
const RISE = 0.2
const ROWS = 34
/** The altar's floor, below the doors'. */
const PIT = ROWS * RISE
/** The tiers go round the altar this far each way (radians from straight ahead, the doors). */
const SPREAD = 1.35
/** The stairs down between the blocks of seats (their direction from the altar). */
const AISLES = [0, -0.62, 0.62]
/** The level walk along the doors. */
const FRONT = NAVE.F - 3.5
/** The floor is laid in blocks this size (the game's look): the walk follows the same blocks. */
const CELL = 0.6
const ENTRANCE: XZ = [0, NAVE.F - 1.6]

const polar = (x: number, z: number) => ({ r: Math.hypot(x - ALTAR[0], z - ALTAR[1]), t: Math.atan2(x - ALTAR[0], z - ALTAR[1]) })
const tierOf = (r: number) => Math.floor((r - R0) / STEP)

/** The floor's height at a point: the walk by the doors, the tiers, the altar's floor. */
function level(x: number, z: number) {
  if (z > FRONT) return 0
  const { r, t } = polar(x, z)
  if (r < R0 || Math.abs(t) > SPREAD) return -PIT
  return Math.min(0, -PIT + (tierOf(r) + 1) * RISE)
}
const snap = (v: number) => (Math.floor(v / CELL) + 0.5) * CELL
/** Where the Sim's feet are: the block it stands on. */
const ground = (x: number, z: number) => level(snap(x), snap(z))

const inside = (x: number, z: number, m = 0) => z < NAVE.F - m && z > NAVE.B + m && Math.abs(x) < naveHalf(z) - m

/** On the stairs down (an aisle between the blocks of seats). */
function inAisle(x: number, z: number) {
  const { r, t } = polar(x, z)
  return AISLES.some((a) => Math.abs(r * Math.sin(t - a)) < 1.2) || Math.abs(x) > naveHalf(z) - 2.4
}

/** Where the benches are: the back of each tier, but the stairs and the walk along the walls. */
function onBench(x: number, z: number) {
  if (z > FRONT - 0.5) return false
  const { r, t } = polar(x, z)
  if (r < R0 || Math.abs(t) > SPREAD || (r - R0) % STEP < 0.7) return false
  return !inAisle(x, z)
}

/** The rest that's in the way, as boxes [x, z, half-width, half-depth]: the font, the confessionals, the bishop's chair and the choir. */
const SOLID: [number, number, number, number][] = [
  [-NAVE.FW + 10, NAVE.F - 5.5, 1.6, 1.6], // the baptismal font
  [NAVE.FW - 11, NAVE.F - 5.2, 5, 1], // the confessionals
  [0, ALTAR[1] - 8.5, 3.2, 1.2], // the cathedra and its step
  [-7, ALTAR[1] - 11, 4, 1.2], // the choir's benches
  [7, ALTAR[1] - 11, 4, 1.2],
]

function free(x: number, z: number) {
  if (!inside(x, z, 0.7) || onBench(x, z)) return false
  if (polar(x, z).r < SANCTUARY + 0.4) return false
  for (const [cx, cz, hw, hd] of SOLID) if (Math.abs(x - cx) < hw + 0.3 && Math.abs(z - cz) < hd + 0.3) return false
  return true
}

/** A point on a tier: row i, direction t from the altar, `into` metres from the tier's front edge. */
const onTier = (i: number, t: number, into: number): XZ => {
  const r = R0 + i * STEP + into
  return [ALTAR[0] + r * Math.sin(t), ALTAR[1] + r * Math.cos(t)]
}
/** Facing the altar from a point. */
const toAltar = ([x, z]: XZ) => Math.atan2(ALTAR[0] - x, ALTAR[1] - z)

const SPOTS: Record<string, Spot> = (() => {
  // Praying: standing in the sixth row, by the middle stairs; the mass: sitting in the ninth.
  const pray = onTier(6, 1.6 / (R0 + 6 * STEP), 0.35)
  const seat = onTier(9, 1.7 / (R0 + 9 * STEP + 1), 1)
  // Visiting: in front of the first window on the left, filming it.
  const w = windowAt(WINDOWS[0].side, WINDOWS[0].t)
  const look: XZ = [w.x - w.n[0] * 3, w.z - w.n[1] * 3]
  return {
    pray: { at: pray, rot: toAltar(pray), pose: 'pray', y: level(...pray), from: onTier(6, 0, 0.35) },
    messe: { at: seat, rot: toAltar(seat), pose: 'sit', y: level(...seat) + 0.05, from: onTier(9, 0, 0.35) },
    visit: { at: look, rot: Math.atan2(w.n[0], w.n[1]), pose: 'film', y: ground(...look) },
  }
})()

/** The benches, each a stretch of a tier's back between two stairs, and the seats along them (for the people). */
function benches() {
  const out: { p: [number, number, number]; s: [number, number, number]; ry: number }[] = []
  const seats: { at: XZ; y: number; row: number }[] = []
  for (let i = 0; i < ROWS; i++) {
    const r = R0 + i * STEP + 1
    const y = -PIT + (i + 1) * RISE
    if (y > 0.01) break
    let run: number[] = []
    const flush = () => {
      if (run.length > 1) {
        // Broken into benches about 4 m long.
        const per = Math.max(2, Math.round(4 / (r * (run[1] - run[0]))))
        for (let k = 0; k < run.length - 1; k += per) {
          const [t0, t1] = [run[k], run[Math.min(run.length - 1, k + per)]]
          const t = (t0 + t1) / 2
          const len = r * (t1 - t0) - 0.15
          const [x, z] = [ALTAR[0] + r * Math.sin(t), ALTAR[1] + r * Math.cos(t)]
          const [bx, bz] = [ALTAR[0] + (r + 0.27) * Math.sin(t), ALTAR[1] + (r + 0.27) * Math.cos(t)]
          out.push({ p: [x, y + 0.22, z], s: [len, 0.44, 0.42], ry: t }, { p: [bx, y + 0.68, bz], s: [len, 0.5, 0.08], ry: t })
          for (let j = 0.4; j < len - 0.2; j += 0.65) {
            const tj = t0 + (j + 0.075) / r
            seats.push({ at: [ALTAR[0] + r * Math.sin(tj), ALTAR[1] + r * Math.cos(tj)], y, row: i })
          }
        }
      }
      run = []
    }
    const dt = 0.25 / r
    for (let t = -SPREAD; t <= SPREAD; t += dt) {
      const [x, z] = [ALTAR[0] + r * Math.sin(t), ALTAR[1] + r * Math.cos(t)]
      if (z < FRONT - 0.5 && inside(x, z) && onBench(x, z)) run.push(t)
      else flush()
    }
    flush()
  }
  return { out, seats }
}

/** The floor in blocks: the tiers, the stairs carpeted red, the altar's floor, the walk by the doors; one mesh. */
function floorGeometry() {
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()
  const quad = (p: [number, number, number][], n: [number, number, number], colour: string) => {
    // Wound to face n.
    const [a, b, d] = p
    const cr = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])]
    const q = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? [p[0], p[3], p[2], p[1]] : p
    c.set(colour)
    const base = pos.length / 3
    for (const v of q) pos.push(...v), nor.push(...n), col.push(c.r, c.g, c.b)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const colourAt = (x: number, z: number) => {
    if (z > FRONT) return '#d9d0bf'
    const { r, t } = polar(x, z)
    if (r < R0 || Math.abs(t) > SPREAD) return r < SANCTUARY + 2 ? '#f4efe4' : '#e9e2d3'
    if (inAisle(x, z) && Math.abs(x) < naveHalf(z) - 2.4) return '#9e2b2b'
    return tierOf(r) % 2 ? '#e3dac8' : '#ece4d4'
  }
  const [nx, nz] = [Math.ceil((2 * NAVE.FW) / CELL), Math.ceil((NAVE.F - NAVE.B) / CELL)]
  const cx = (i: number) => -NAVE.FW + (i + 0.5) * CELL
  const cz = (j: number) => NAVE.B + (j + 0.5) * CELL
  const ok = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < nz && inside(cx(i), cz(j))
  for (let j = 0; j < nz; j++) {
    // The tops, merged along x where the height and the colour stay the same.
    let start = -1
    let key = ''
    const close = (end: number) => {
      if (start < 0) return
      const y = level(cx(start), cz(j))
      const [x0, x1, z0, z1] = [cx(start) - CELL / 2, cx(end) + CELL / 2, cz(j) - CELL / 2, cz(j) + CELL / 2]
      quad([[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]], [0, 1, 0], colourAt(cx(start), cz(j)))
      start = -1
    }
    for (let i = 0; i <= nx; i++) {
      const here = ok(i, j) ? `${level(cx(i), cz(j))}|${colourAt(cx(i), cz(j))}` : ''
      if (here !== key) {
        close(i - 1)
        if (here) start = i
        key = here
      }
    }
    close(nx - 1)
    // The risers, where a block stands higher than the next (along x and along z).
    for (let i = 0; i < nx; i++) {
      if (!ok(i, j)) continue
      const y = level(cx(i), cz(j))
      for (const [di, dj] of [[1, 0], [0, 1]] as const) {
        if (!ok(i + di, j + dj)) continue
        const y2 = level(cx(i + di), cz(j + dj))
        if (Math.abs(y2 - y) < 0.01) continue
        const [lo, hi] = y < y2 ? [y, y2] : [y2, y]
        // Facing the lower side.
        const n: [number, number, number] = di ? [y < y2 ? -1 : 1, 0, 0] : [0, 0, y < y2 ? -1 : 1]
        if (di) {
          const x = cx(i) + CELL / 2
          quad([[x, lo, cz(j) - CELL / 2], [x, hi, cz(j) - CELL / 2], [x, hi, cz(j) + CELL / 2], [x, lo, cz(j) + CELL / 2]], n, '#cbbfa9')
        } else {
          const z = cz(j) + CELL / 2
          quad([[cx(i) - CELL / 2, lo, z], [cx(i) - CELL / 2, hi, z], [cx(i) + CELL / 2, hi, z], [cx(i) + CELL / 2, lo, z]], n, '#cbbfa9')
        }
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

/** A wall from a to b, `thick` through, from `bottom` up to top(z) (the roof's slope). */
function wall(a: XZ, b: XZ, thick: number, bottom: number, top: (z: number) => number) {
  const g = new THREE.BoxGeometry(1, 1, 1)
  const p = g.attributes.position
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const len = Math.hypot(dx, dz)
  const [nx, nz] = [-dz / len, dx / len]
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5
    const w = p.getZ(i) * thick
    const [x, z] = [a[0] + dx * u + nx * w, a[1] + dz * u + nz * w]
    p.setXYZ(i, x, p.getY(i) > 0 ? top(z) : bottom, z)
  }
  g.computeVertexNormals()
  return g
}

export function CathedralInside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  if (interactionId === 'monter-tour') return <TowerTop sim={sim} night={night} stage={stage} />
  // Sunday morning, or one's come for it: the mass, the nave full.
  const minute = sim.gameMinutes ?? 0
  const mass = interactionId === 'messe' || (Math.floor(minute / 1440) % 7 === 6 && Math.floor(minute / 60) % 24 >= 7 && Math.floor(minute / 60) % 24 < 12)
  return <Nave sim={sim} interactionId={interactionId} roam={roam} night={night} stage={stage} mass={mass} />
}

function Nave({ sim, interactionId, roam, night, stage, mass }: { sim: Sim; interactionId?: string; roam?: boolean; night: boolean; stage: string; mass: boolean }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 26, NAVE.F + 10], fov: 45, near: 0.3, far: 900 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <NaveWorld night={night} mass={mass} onFloor={roam && !interactionId ? tap : undefined} />
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} ground={ground} />
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, -3, NAVE.F - 16]} enablePan={false} minDistance={6} maxDistance={95} minPolarAngle={0.25} maxPolarAngle={1.3} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** Where the altar is, and how deep the nave goes down to it: for a camera looking down the nave (the trailer's). */
export const NAVE_VIEW = { altar: ALTAR, pit: PIT, front: NAVE.F }

/**
 * The nave and everything in it (the benches, the windows, the sanctuary,
 * the faithful, at mass or not), without anyone walking in it: the game's
 * own room (Nave) and the trailer (lab/poster.tsx) draw it.
 */
export function NaveWorld({ night, mass, onFloor }: { night: boolean; mass: boolean; /** A tap on the floor: walk there. */ onFloor?: (at: XZ) => void }) {
  const floor = useMemo(floorGeometry, [])
  const bench = useMemo(benches, [])
  const floorMat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), [])
  const walls = useMemo(() => {
    const top = (z: number) => roofAt(z)
    return [
      wall([-NAVE.FW, NAVE.F], [-NAVE.BW, NAVE.B], 0.6, -PIT - 0.2, top),
      wall([NAVE.BW, NAVE.B], [NAVE.FW, NAVE.F], 0.6, -PIT - 0.2, top),
      wall([-NAVE.BW, NAVE.B], [NAVE.BW, NAVE.B], 0.6, -PIT - 0.2, top),
      // The front, cut low so the camera sees in, open at the doors.
      wall([-NAVE.FW, NAVE.F], [-4.5, NAVE.F], 0.6, -0.2, () => 1.2),
      wall([4.5, NAVE.F], [NAVE.FW, NAVE.F], 0.6, -0.2, () => 1.2),
    ]
  }, [])
  const glass = useMemo(() => WINDOWS.map((w) => new THREE.MeshLambertMaterial({ map: vitrail(w.seed), emissive: '#ffffff', emissiveMap: vitrail(w.seed), emissiveIntensity: 0.8 })), [])
  for (const m of glass) m.emissiveIntensity = night ? 1.1 : 0.8
  const signs = useMemo(() => ({ tower: sign('ACCÈS À LA TOUR', '#2b3a55', '#ffffff', 512, 96) }), [])
  return (
    <>
      <hemisphereLight args={[night ? '#7080c0' : '#ffffff', '#c9b48c', night ? 0.7 : 1.15]} />
      <directionalLight position={[25, 60, 30]} intensity={night ? 0.2 : 1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} />
      <pointLight position={[ALTAR[0], -PIT + 9, ALTAR[1]]} intensity={night ? 80 : 30} distance={40} color="#ffe0a8" />
      <pointLight position={[0, 6, 6]} intensity={night ? 60 : 10} distance={50} color="#ffe8c4" />
      <mesh
        geometry={floor}
        material={floorMat}
        receiveShadow
        onClick={(e) => {
          if (!onFloor || e.delta > 6) return
          e.stopPropagation()
          onFloor([e.point.x, e.point.z])
        }}
      />
      {walls.map((g, i) => (
        <mesh key={i} geometry={g} material={mat('#f1ece2')} castShadow receiveShadow />
      ))}
      {/* Outside the doors: the forecourt and its steps down to the street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, NAVE.F + 30]} receiveShadow>
        <planeGeometry args={[200, 60]} />
        <meshLambertMaterial color="#d6cdbb" />
      </mesh>
      <Blocks at={bench.out} material={mat('#8a5a34')} />
      <Windows glass={glass} />
      <Sanctuary night={night} mass={mass} tower={signs.tower} />
      <Corners />
      {/* The tower rising out of the roof, over the altar's back */}
      <group position={[0, -PIT, TOWER.z]} rotation={[-TOWER.lean, 0, 0]}>
        <mesh geometry={BOX} position={[0, TOWER.H / 2 + PIT / 2, 0]} scale={[5.5, TOWER.H + PIT, 4]} material={mat('#f4f1ea')} castShadow />
        <mesh geometry={BOX} position={[0, TOWER.arm + PIT, 0]} scale={[22, 3.2, 3]} material={mat('#f4f1ea')} castShadow />
      </group>
      <People seats={bench.seats} mass={mass} />
    </>
  )
}

function Windows({ glass }: { glass: THREE.Material[] }) {
  const list = useMemo(() => WINDOWS.map((w) => windowAt(w.side, w.t)), [])
  const panels = useMemo(
    () =>
      [-1, 1].flatMap((side) =>
        [...Array(6)].map((_, i) => {
          const w = windowAt(side, 0.1 + i * 0.14)
          const [x, z] = [w.x - w.n[0] * 0.4, w.z - w.n[1] * 0.4]
          return { x, z, y: ground(w.x - w.n[0] * 1.5, w.z - w.n[1] * 1.5) + 1.8, rot: w.rot + Math.PI }
        }),
      ),
    [],
  )
  return (
    <group>
      {list.map((w, i) => (
        <mesh key={i} position={[w.x - w.n[0] * 0.36, w.y - 1, w.z - w.n[1] * 0.36]} rotation={[0, w.rot + Math.PI, 0]} material={glass[i]}>
          <planeGeometry args={[16, w.h + 4]} />
        </mesh>
      ))}
      {panels.map((p, i) => (
        <mesh key={`p${i}`} position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} material={mat(['#2f6fb0', '#1f8a8a', '#b5532c'][i % 3])}>
          <planeGeometry args={[3.2, 2]} />
        </mesh>
      ))}
    </group>
  )
}

/** The sanctuary: the podium and its steps, the altar, the ambo, the cathedra, the candles, the crucifix; the choir; the door to the tower. */
function Sanctuary({ night, mass, tower }: { night: boolean; mass: boolean; tower: THREE.Material }) {
  const y = -PIT
  const flame = mat('#ffd36b', '#ffb020')
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[ALTAR[0], y + 0.1 + i * 0.2, ALTAR[1]]} material={mat(i === 2 ? '#f7f4ee' : '#e6dfd0')} receiveShadow castShadow>
          <cylinderGeometry args={[SANCTUARY + 1.2 - i * 0.6, SANCTUARY + 1.2 - i * 0.6, 0.2, 40]} />
        </mesh>
      ))}
      {/* The altar: a block of white marble, its cloth, the candles */}
      <mesh geometry={BOX} position={[ALTAR[0], y + 1.1, ALTAR[1]]} scale={[3.2, 1, 1.3]} material={mat('#fbfaf6')} castShadow />
      <mesh geometry={BOX} position={[ALTAR[0], y + 1.62, ALTAR[1]]} scale={[3.4, 0.04, 1.4]} material={mat('#f2e6b8')} />
      {[-1.2, 1.2].map((x) => (
        <group key={x}>
          <mesh geometry={BOX} position={[ALTAR[0] + x, y + 1.85, ALTAR[1]]} scale={[0.08, 0.42, 0.08]} material={mat('#fdfcf8')} />
          <mesh geometry={BOX} position={[ALTAR[0] + x, y + 2.1, ALTAR[1]]} scale={[0.07, 0.1, 0.07]} material={flame} />
        </group>
      ))}
      {/* The ambo, on the right */}
      <mesh geometry={BOX} position={[ALTAR[0] + 3.6, y + 1.2, ALTAR[1] + 1.5]} scale={[0.9, 1.4, 0.6]} material={mat('#c9a46a')} castShadow />
      {/* The cathedra on its step, behind; the processional cross */}
      <mesh geometry={BOX} position={[0, y + 0.2, ALTAR[1] - 8.5]} scale={[6.4, 0.4, 2.4]} material={mat('#e6dfd0')} />
      <mesh geometry={BOX} position={[0, y + 1.2, ALTAR[1] - 9]} scale={[1.2, 2, 0.4]} material={mat('#7a2a2a')} castShadow />
      <mesh geometry={BOX} position={[0, y + 0.85, ALTAR[1] - 8.5]} scale={[1.2, 0.2, 1]} material={mat('#7a2a2a')} />
      <mesh geometry={BOX} position={[-3.4, y + 1.6, ALTAR[1] - 3.5]} scale={[0.08, 3.2, 0.08]} material={mat('#c9a14a')} />
      <mesh geometry={BOX} position={[-3.4, y + 3, ALTAR[1] - 3.5]} scale={[0.6, 0.08, 0.08]} material={mat('#c9a14a')} />
      {/* The great crucifix, high over the altar's back */}
      <group position={[0, y + 15, ALTAR[1] - 13]}>
        <mesh geometry={BOX} scale={[0.6, 9, 0.4]} material={mat('#6b4426')} castShadow />
        <mesh geometry={BOX} position={[0, 2.2, 0]} scale={[5, 0.6, 0.4]} material={mat('#6b4426')} />
        <mesh geometry={BOX} position={[0, 0.8, 0.3]} scale={[0.5, 3, 0.3]} material={mat('#e8cfa6')} />
      </group>
      {/* The choir's benches, either side behind the altar */}
      {[-7, 7].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, y + 0.45, ALTAR[1] - 11]} scale={[8, 0.9, 2.4]} material={mat('#8a5a34')} castShadow />
      ))}
      {/* The candle stand, where people light one */}
      <mesh geometry={BOX} position={[-9.5, y + 0.6, ALTAR[1] - 2]} scale={[2.4, 1.2, 0.8]} material={mat('#3a3a40')} />
      {[...Array(10)].map((_, i) => (
        <mesh key={i} geometry={BOX} position={[-10.5 + (i % 5) * 0.5, y + 1.32, ALTAR[1] - 2.2 + Math.floor(i / 5) * 0.4]} scale={[0.06, 0.16, 0.06]} material={flame} />
      ))}
      {/* The door to the tower's stairs, at the point of the triangle */}
      <mesh geometry={BOX} position={[0, y + 1.6, NAVE.B + 0.45]} scale={[2.4, 3.2, 0.1]} material={mat('#3b2a1c')} />
      <mesh position={[0, y + 3.8, NAVE.B + 0.52]} material={tower}>
        <planeGeometry args={[3.6, 0.68]} />
      </mesh>
      {(night || mass) && <pointLight position={[ALTAR[0], y + 3, ALTAR[1] + 2]} intensity={14} distance={14} color="#ffcf7a" />}
    </group>
  )
}

/** The baptismal font (south-west) and the confessionals (south-east). */
function Corners() {
  const [fx, fz] = SOLID[0]
  const [cx, cz] = SOLID[1]
  return (
    <group>
      <mesh position={[fx, 0.5, fz]} material={mat('#f2efe8')} castShadow>
        <cylinderGeometry args={[1.4, 1.1, 1, 16]} />
      </mesh>
      <mesh position={[fx, 1.01, fz]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#5fb6d6')}>
        <circleGeometry args={[1.15, 16]} />
      </mesh>
      {[-3.4, 0, 3.4].map((dx) => (
        <group key={dx} position={[cx + dx, 0, cz]}>
          <mesh geometry={BOX} position={[0, 1.2, 0]} scale={[3, 2.4, 1.8]} material={mat('#7b4f2c')} castShadow />
          <mesh geometry={BOX} position={[0, 1, 0.92]} scale={[1, 1.9, 0.04]} material={mat('#5a3a20')} />
        </group>
      ))}
    </group>
  )
}

/** The people: a few praying and filming on a weekday; at mass, the tiers full, the priest at the altar, the choir singing. */
function People({ seats, mass }: { seats: { at: XZ; y: number; row: number }[]; mass: boolean }) {
  const crowd = useMemo(() => {
    const r = rng(mass ? 'cathedrale-messe' : 'cathedrale-semaine')
    // At mass the middle rows fill first; on a weekday, a few here and there.
    const want = mass ? 120 : 14
    const pool = seats.filter((s) => (mass ? s.row < 24 : true))
    const picked = new Set<number>()
    while (picked.size < Math.min(want, pool.length)) picked.add(Math.floor(r() * pool.length))
    return [...picked].map((i) => {
      const s = pool[i]
      const gender: 'femme' | 'homme' = r() < 0.58 ? 'femme' : 'homme'
      return { ...s, gender, look: randomLook(gender, r), pose: (mass ? (r() < 0.2 ? 'pray' : 'sit') : r() < 0.6 ? 'pray' : 'sit') as Pose, seed: r() * 100 }
    })
  }, [seats, mass])
  const named = useMemo(() => {
    const r = rng('cathedrale-gens')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string, g?: 'femme' | 'homme') => {
      const gender: 'femme' | 'homme' = g ?? (r() < 0.5 ? 'femme' : 'homme')
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress } : look, seed: r() * 100 }
    }
    const y = -PIT + 0.6
    if (mass)
      return [
        // The priest at the altar, two servers, the choir standing by its benches.
        one([ALTAR[0], y, ALTAR[1] - 1.2], 0, 'pray', 'soutane', 'homme'),
        one([ALTAR[0] - 2.4, y, ALTAR[1] - 2], 0.3, 'idle', 'soutane'),
        one([ALTAR[0] + 2.4, y, ALTAR[1] - 2], -0.3, 'idle', 'soutane'),
        ...[-9.5, -8, -6.5, -5, 5, 6.5, 8, 9.5].map((x) => one([x, -PIT, ALTAR[1] - 9.6], 0, 'cheer', r() < 0.5 ? 'boubou' : 'pagne')),
      ]
    const w = windowAt(WINDOWS[2].side, WINDOWS[2].t)
    const [vx, vz] = [w.x - w.n[0] * 3, w.z - w.n[1] * 3]
    return [
      // The sacristan at the candles; a sister at prayer; visitors filming a window.
      one([-9.5, -PIT, ALTAR[1] - 0.8], Math.PI, 'busy', 'soutane', 'homme'),
      one([2, y, ALTAR[1] + 4.4], Math.PI, 'pray', 'soeur', 'femme'),
      one([vx, ground(vx, vz), vz], Math.atan2(w.n[0], w.n[1]), 'film'),
      one([vx + 1.2, ground(vx + 1.2, vz + 0.6), vz + 0.6], Math.atan2(w.n[0], w.n[1]), 'idle'),
    ]
  }, [mass])
  return (
    <NoShadows>
      {crowd.map((c, i) => (
        <group key={i} position={[c.at[0], c.y + 0.05, c.at[1]]} rotation={[0, toAltar(c.at), 0]}>
          <LowHuman look={c.look} gender={c.gender} pose={c.pose} seed={c.seed} />
        </group>
      ))}
      {named.map((g, i) => (
        <group key={`n${i}`} position={g.p} rotation={[0, g.ry, 0]}>
          <TalkHuman id={`cathedrale-${mass ? 'm' : 's'}${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
        </group>
      ))}
    </NoShadows>
  )
}

/* ---------- The top of the tower ---------- */

/** Up on the cross's arm, 50 m over the roof: the cables going down, the Plateau's towers, the lagoon. */
function TowerTop({ sim, night, stage }: { sim: Sim; night: boolean; stage: string }) {
  // The arm's top, where the Sim stands: the cathedral is drawn round it.
  const top = useMemo(() => towerPoint(TOWER.arm).add(new THREE.Vector3(0, 1.6, 0)), [])
  const city = useMemo(() => {
    const r = rng('plateau-vue')
    // The Plateau south and east of the cathedral, the towers taller toward its middle.
    return [...Array(90)].map(() => {
      const [x, z] = [-260 + r() * 640, 60 + r() * 520]
      const mid = Math.max(0, 1 - Math.hypot(x - 120, z - 320) / 300)
      const h = 10 + r() * 20 + mid * mid * (40 + r() * 90)
      return { x, z, h, w: 10 + r() * 16, d: 10 + r() * 16, c: ['#d9d6cf', '#c4cbd3', '#e6dfd2', '#9fb0c2', '#d2c3a8'][Math.floor(r() * 5)] }
    })
  }, [])
  // The Plateau's grid of streets seen from above.
  const streets = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#cbb38c'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#55585e'
    g.fillRect(0, 60, 128, 8)
    g.fillRect(60, 0, 8, 128)
    g.fillStyle = '#9fae7a'
    g.fillRect(8, 8, 20, 14)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(9, 6)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [7, 6, -10], fov: 50, near: 0.3, far: 3000 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#5060a0' : '#ffffff', '#b8a27c', night ? 0.5 : 1.2]} />
          <directionalLight position={[60, 120, 80]} intensity={night ? 0.15 : 1.5} />
          <group position={[-top.x, -top.y, -top.z]}>
            <Cathedral night={night} />
            {/* The ground of the Plateau, the lagoon round its point to the north and west */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[60, -0.1, 300]}>
              <planeGeometry args={[900, 620]} />
              <meshLambertMaterial map={streets} color={night ? '#4a4a58' : '#ffffff'} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -200]}>
              <planeGeometry args={[3000, 1400]} />
              <meshLambertMaterial color={night ? '#0e2a3a' : '#3c7c8a'} />
            </mesh>
            {/* Across the water, the green hills of the other shore */}
            <mesh geometry={BOX} position={[0, 6, -900]} scale={[3000, 12, 200]} material={mat(night ? '#10241a' : '#4f7f4a')} />
            {city.map((b, i) => (
              <mesh key={i} geometry={BOX} position={[b.x, b.h / 2, b.z]} scale={[b.w, b.h, b.d]} material={mat(night ? '#1b2238' : b.c, night && i % 3 === 0 ? '#3a3010' : undefined)} />
            ))}
          </group>
          {/* The railing along the arm */}
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={BOX} position={[2, 1, s * 1.4]} scale={[18, 0.08, 0.08]} material={mat('#9aa0a8')} />
          ))}
          <group position={[4, 0, 0]} rotation={[0, 0, 0]}>
            <Character look={sim.look} gender={sim.gender} pose="film" stage={stage} />
          </group>
          <OrbitControls makeDefault target={[4, -6, 12]} enablePan={false} minDistance={4} maxDistance={40} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}
