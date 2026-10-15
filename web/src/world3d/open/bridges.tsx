import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { worldTime } from '../../lib/worldClock'
import { Vehicle, type VehicleKind } from '../vehicles'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BRIDGE_HEIGHT, type XZ } from './geo'
import { bridgeKind, type BridgeKind } from './bridgeNames'
import type { ChunkData } from './tiles'

// What stands on Abidjan's bridges besides the deck: the 5e pont's tower
// and its cables, and the 3e pont's toll plaza. Both are found from the map:
// the bridge's ends, wherever its pieces are loaded (the far horizon too).

/** A bridge's two ends, from all its loaded pieces: the farthest pair of points. */
function ends(chunks: ChunkData[], kind: BridgeKind): [XZ, XZ] | null {
  const pts: XZ[] = []
  for (const c of chunks) for (const r of c.roads) if (r.bridge && bridgeKind(r.name) === kind) pts.push(r.pts[0], r.pts[r.pts.length - 1])
  if (pts.length < 2) return null
  let best: [XZ, XZ] = [pts[0], pts[1]]
  let bd = -1
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
      if (d > bd) [best, bd] = [[pts[i], pts[j]], d]
    }
  return bd > 80 ? best : null
}

export function BridgeSights({ chunks, night }: { chunks: ChunkData[]; night: boolean }) {
  // Keyed on the pieces found, so it's only worked out again when they change.
  const key = chunks.map((c) => c.key).join()
  const ado = useMemo(() => ends(chunks, 'ado'), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const hkb = useMemo(() => ends(chunks, 'hkb'), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const tolls = useMemo(() => tollsOnMap(chunks), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  // The 3e pont's plaza where the map has its toll booth; without it (the map
  // not loaded that far), on the northern approach as before.
  const hkbToll = tolls.hkb ?? (hkb ? northApproach(hkb) : null)
  return (
    <>
      {ado && <CableStayed ends={ado} />}
      {hkbToll && <TollPlaza at={hkbToll.at} rot={hkbToll.rot} lanes={Math.max(21, hkbToll.lanes ?? 0)} label="Péage du 3e pont · 500 F" night={night} />}
      {tolls.yop && <TollPlaza at={tolls.yop.at} rot={tolls.yop.rot} lanes={Math.max(10, tolls.yop.lanes ?? 0)} label="Péage du 4e pont" night={night} />}
    </>
  )
}

const white = new THREE.MeshLambertMaterial({ color: '#eef0f2' })
const cableMat = new THREE.MeshLambertMaterial({ color: '#d9dde2' })

/**
 * The 5e pont (Alassane-Ouattara): a 200 m cable-stayed span in the middle,
 * 19 stays on a 108 m tower (Abidjan.net). The sources don't give the tower's
 * shape: here a single mast between the carriageways, its stays fanning out
 * along the deck on both sides.
 */
function CableStayed({ ends: [a, b] }: { ends: [XZ, XZ] }) {
  const mid: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const [ux, uz] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
  const H = 108
  const cables = useMemo(() => {
    const out: { pos: THREE.Vector3; q: THREE.Quaternion; l: number }[] = []
    for (let k = 0; k < 19; k++) {
      // Alternate sides: 10 one way, 9 the other, the farthest from the top.
      const side = k % 2 ? -1 : 1
      const n = Math.floor(k / 2)
      const d = 14 + n * 9.5
      const top = new THREE.Vector3(mid[0], H - 6 - n * 4.2, mid[1])
      const deck = new THREE.Vector3(mid[0] + ux * d * side, BRIDGE_HEIGHT + 0.6, mid[1] + uz * d * side)
      const dir = top.clone().sub(deck)
      out.push({ pos: deck.clone().add(top).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), l: dir.length() })
    }
    return out
  }, [mid[0], mid[1], ux, uz]) // eslint-disable-line react-hooks/exhaustive-deps
  const rot = Math.atan2(ux, uz)
  return (
    <group>
      {/* The mast: tapering, from the lagoon floor to 108 m */}
      <group position={[mid[0], 0, mid[1]]} rotation={[0, rot, 0]}>
        <mesh position={[0, (H - 4) / 2, 0]} material={white} castShadow>
          <cylinderGeometry args={[1.6, 2.6, H + 4, 8]} />
        </mesh>
        <mesh position={[0, H + 1, 0]} material={white}>
          <coneGeometry args={[1.6, 4, 8]} />
        </mesh>
        <mesh position={[0, 1.5, 0]} material={white}>
          <boxGeometry args={[7, 6, 9]} />
        </mesh>
      </group>
      {cables.map((c, i) => (
        <mesh key={i} position={c.pos} quaternion={c.q} material={cableMat}>
          <cylinderGeometry args={[0.12, 0.12, c.l, 5]} />
        </mesh>
      ))}
    </group>
  )
}

type Toll = { at: XZ; rot: number; /** lanes wide enough to cover the roadways on both sides */ lanes?: number }

/**
 * The toll booths the map has (OpenStreetMap: « Péage pont HKB » on the
 * Riviera side, about 700 m from the end of the 3e pont; « Péage du 4ème
 * Pont » on the Yopougon side): where each stands, turned along the big
 * road through it.
 */
function tollsOnMap(chunks: ChunkData[]): { hkb?: Toll; yop?: Toll } {
  const found: Record<'hkb' | 'yop', XZ[]> = { hkb: [], yop: [] }
  for (const c of chunks)
    for (const p of c.pois ?? []) {
      const n = p.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      if (!/peage|toll/.test(n)) continue
      if (/hkb|konan/.test(n)) found.hkb.push(p.at)
      else if (/\b4e|4eme|quatrieme/.test(n)) found.yop.push(p.at)
    }
  const out: { hkb?: Toll; yop?: Toll } = {}
  for (const k of ['hkb', 'yop'] as const) {
    const pts = found[k]
    if (!pts.length) continue
    const at: XZ = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
    const rot = roadAngleAt(chunks, at)
    out[k] = { ...spanRoads(chunks, at, rot), rot }
  }
  return out
}

/**
 * A plaza covers the roadways around its booth: where the map draws the two
 * directions apart (the 4e pont's, its booths in the middle), it is moved
 * and widened to span both, from one outer edge to the other.
 */
function spanRoads(chunks: ChunkData[], [x, z]: XZ, rot: number): { at: XZ; lanes?: number } {
  const [ux, uz] = [Math.sin(rot), Math.cos(rot)] // along the road
  const [vx, vz] = [uz, -ux] // across it
  let [lo, hi] = [0, 0]
  for (const c of chunks)
    for (const r of c.roads) {
      if (!['motorway', 'trunk', 'primary'].includes(r.cls)) continue
      for (const [px, pz] of r.pts) {
        const [dx, dz] = [px - x, pz - z]
        const along = dx * ux + dz * uz
        const across = dx * vx + dz * vz
        if (Math.abs(along) > 30 || Math.abs(across) > 70) continue
        lo = Math.min(lo, across - r.width / 2)
        hi = Math.max(hi, across + r.width / 2)
      }
    }
  const width = hi - lo
  if (width < 20) return { at: [x, z] }
  const mid = (lo + hi) / 2
  return { at: [x + vx * mid, z + vz * mid], lanes: Math.round(width / 3.6) }
}

/** Which way the big road nearest a point runs (for a plaza across it). */
function roadAngleAt(chunks: ChunkData[], [x, z]: XZ) {
  let best = { d: Infinity, rot: 0 }
  for (const c of chunks)
    for (const r of c.roads) {
      if (!['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link'].includes(r.cls)) continue
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1]
        const [bx, bz] = r.pts[i]
        const l2 = (bx - ax) ** 2 + (bz - az) ** 2
        const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0
        const d = Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z)
        if (d < best.d) best = { d, rot: Math.atan2(bx - ax, bz - az) }
      }
    }
  return best.rot
}

/** Without the map's booth: on the 3e pont's northern (Riviera) approach, as the map has it, past the end. */
function northApproach([a, b]: [XZ, XZ]): Toll {
  // The northern end is the one further up the map (smaller z).
  const [north, south] = a[1] < b[1] ? [a, b] : [b, a]
  const len = Math.hypot(north[0] - south[0], north[1] - south[1])
  const [ux, uz] = [(north[0] - south[0]) / len, (north[1] - south[1]) / len]
  return { at: [north[0] + ux * 130, north[1] + uz * 130], rot: Math.atan2(ux, uz) }
}

/**
 * A toll plaza: lanes under a canopy, booths and barriers, the traffic
 * paying. The 3e pont's has 21 lanes (Bouygues), 500 F a car when it
 * opened; the 4e pont's lanes aren't published (10 here, an estimate).
 */
function TollPlaza({ at, rot, lanes: LANES, label, night }: { at: XZ; rot: number; lanes: number; label: string; night: boolean }) {
  const W = LANES * 3.6
  const glow = useMemo(() => new THREE.MeshLambertMaterial({ color: '#fff4d6', emissive: '#ffe2a0', emissiveIntensity: 0 }), [])
  glow.emissiveIntensity = night ? 1 : 0
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      {/* The apron of the plaza */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 10, 70]} />
        <meshLambertMaterial color="#9a9890" />
      </mesh>
      {/* The canopy, its orange band, the lights under it */}
      <mesh position={[0, 7, 0]} material={white} castShadow>
        <boxGeometry args={[W + 4, 1, 16]} />
      </mesh>
      <mesh position={[0, 7.6, 0]}>
        <boxGeometry args={[W + 4.2, 0.5, 16.2]} />
        <meshLambertMaterial color="#f08a24" />
      </mesh>
      <mesh position={[0, 6.45, 0]} material={glow}>
        <boxGeometry args={[W, 0.1, 12]} />
      </mesh>
      {/* Between the lanes, the booths on their islands, and the barriers */}
      {[...Array(LANES + 1)].map((_, i) => {
        const x = -W / 2 + i * 3.6
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 0.15, 0]}>
              <boxGeometry args={[0.9, 0.3, 14]} />
              <meshLambertMaterial color="#d8d3c8" />
            </mesh>
            {i < LANES && (
              <>
                <mesh position={[0, 1.45, 0]} castShadow>
                  <boxGeometry args={[0.8, 2.3, 1.8]} />
                  <meshLambertMaterial color="#e9e6df" />
                </mesh>
                <mesh position={[0, 1.7, 0.92]}>
                  <boxGeometry args={[0.7, 0.9, 0.05]} />
                  <meshLambertMaterial color="#35506e" />
                </mesh>
                {!TOLL_BUSY.includes(i) && (
                  <mesh position={[1.75, 1, -2.5]}>
                    <boxGeometry args={[2.9, 0.12, 0.12]} />
                    <meshLambertMaterial color={i % 2 ? '#e8432f' : '#ffffff'} />
                  </mesh>
                )}
              </>
            )}
            {/* The pillars holding the canopy, every few lanes */}
            {i % 4 === 0 && (
              <mesh position={[0, 3.5, 5]} material={white}>
                <boxGeometry args={[0.6, 7, 0.6]} />
              </mesh>
            )}
          </group>
        )
      })}
      <TollTraffic lanes={LANES} />
      <Html position={[0, 10, 0]} center zIndexRange={[15, 0]}>
        <div className="rounded-xl border border-black/5 bg-[#f08a24] px-2.5 py-1 text-[12.5px] font-extrabold whitespace-nowrap text-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)]">{label}</div>
      </Html>
    </group>
  )
}

/**
 * The toll at work: in the busy lanes a car comes up, stops at the booth to
 * pay (500 F), the barrier lifts, it drives on, the barrier comes down for
 * the next one. Both ways (the lanes left of the middle go the other way).
 * From the shared clock.
 */
const TOLL_KINDS: VehicleKind[] = ['taxi', 'car', 'gbaka', 'car', 'woro', 'car']
/** The lanes open with traffic in them (the others have their barrier down, nobody). */
const TOLL_BUSY = [2, 4, 6, 8, 12, 14, 16, 18]
function TollTraffic({ lanes }: { lanes: number }) {
  const busy = useMemo(() => TOLL_BUSY.filter((i) => i < lanes), [lanes])
  const cars = useRef<(THREE.Group | null)[]>([])
  const bars = useRef<(THREE.Group | null)[]>([])
  const CYCLE = 14
  useFrame(() => {
    const t = worldTime()
    busy.forEach((lane, k) => {
      const u = ((t + k * 3.7) % CYCLE) / CYCLE
      const dir = lane < lanes / 2 ? -1 : 1
      // Coming up (0–0.4), paying (0.4–0.65), the barrier up and off (0.65–1).
      const z = u < 0.4 ? -45 + (u / 0.4) * 41 : u < 0.65 ? -4 : -4 + ((u - 0.65) / 0.35) ** 1.6 * 70
      const g = cars.current[k]
      if (g) {
        g.position.set(-((lanes * 3.6) / 2) + lane * 3.6 + 1.8, 0, z * dir)
        g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2
      }
      const b = bars.current[k]
      const up = u < 0.6 ? 0 : u < 0.7 ? (u - 0.6) / 0.1 : u < 0.85 ? 1 : Math.max(0, 1 - (u - 0.85) / 0.1)
      if (b) b.rotation.z = up * 1.35
    })
  })
  return (
    <group>
      {busy.map((lane, k) => (
        <group key={lane}>
          <group ref={(g) => void (cars.current[k] = g)}>
            <Vehicle p={[0, 0, 0]} kind={TOLL_KINDS[k % TOLL_KINDS.length]} seed={k * 11} />
          </group>
          {/* The barrier arm, hinged at the booth */}
          <group ref={(g) => void (bars.current[k] = g)} position={[-((lanes * 3.6) / 2) + lane * 3.6 + 0.3, 1, lane < lanes / 2 ? 2.5 : -2.5]}>
            <mesh position={[1.45, 0, 0]}>
              <boxGeometry args={[2.9, 0.12, 0.12]} />
              <meshLambertMaterial color={k % 2 ? '#e8432f' : '#ffffff'} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}
