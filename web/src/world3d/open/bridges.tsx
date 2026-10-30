import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { worldTime } from '../../lib/worldClock'
import { Vehicle, type VehicleKind } from '../vehicles'
import { Html } from '@react-three/drei'
import { StaticMerge } from '../staticMerge'
import * as THREE from 'three'
import { BRIDGE_HEIGHT, type XZ } from './geo'
import { bridgeKind, type BridgeKind } from './bridgeNames'
import type { ChunkData } from './tiles'
import { bridgeWay, wayAt, type Way } from './bridgeLine'

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
  // The 5e pont's pylon on its deck's middle line: from the near chunks when they have it (the far
  // horizon's coarser pieces only when it's out of reach), so it stands on the deck drawn up close.
  const ado = useMemo(() => {
    const near = chunks.filter((c) => !c.key.includes(':'))
    return bridgeWay(near, 'ado') ?? bridgeWay(chunks, 'ado')
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const hkb = useMemo(() => ends(chunks, 'hkb'), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const tolls = useMemo(() => tollsOnMap(chunks), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  // The 3e pont's plaza where the map has its toll booth; without it (the map
  // not loaded that far), on the northern approach as before.
  const hkbToll = tolls.hkb ?? (hkb ? northApproach(hkb) : null)
  return (
    <>
      {ado && <CableStayed way={ado} />}
      {hkbToll && <TollPlaza at={hkbToll.at} rot={hkbToll.rot} lanes={Math.max(21, hkbToll.lanes ?? 0)} label="Péage du 3e pont · 500 Djai" night={night} look="hkb" />}
      {tolls.yop && <TollPlaza at={tolls.yop.at} rot={tolls.yop.rot} lanes={Math.max(10, tolls.yop.lanes ?? 0)} label="Péage du 4e pont" night={night} look="yop" />}
    </>
  )
}

const white = new THREE.MeshLambertMaterial({ color: '#eef0f2' })
const cableMat = new THREE.MeshLambertMaterial({ color: '#d9dde2' })

/**
 * The 5e pont (Alassane-Ouattara): a 200 m cable-stayed span in the middle,
 * 19 stays on a 108 m tower (Abidjan.net). As photos show it: one white
 * pylon, its two legs standing either side of the deck and joining above it
 * into a single mast that leans back, away from the main span; the stays fan
 * from the mast down to the middle of the deck on both sides.
 */
export function CableStayed({ way }: { way: Way }) {
  // In the middle of the bridge, on its deck, turned the way it runs there.
  const m = wayAt(way, way.len / 2)
  const mid: XZ = [m.x, m.z]
  const [ux, uz] = [m.dx, m.dz]
  const deckY = m.y > 1 ? m.y : BRIDGE_HEIGHT
  const H = 108
  const LEAN = 0.16 // radians, back along the bridge (towards a)
  const JOIN = 42 // where the legs meet
  // A point on the mast at height h: it leans back along -u.
  const mastAt = (h: number) => new THREE.Vector3(mid[0] - ux * Math.tan(LEAN) * Math.max(0, h - JOIN * 0.6), h, mid[1] - uz * Math.tan(LEAN) * Math.max(0, h - JOIN * 0.6))
  const cables = useMemo(() => {
    const out: { pos: THREE.Vector3; q: THREE.Quaternion; l: number }[] = []
    for (let k = 0; k < 19; k++) {
      // Alternate sides: 10 one way (the main span), 9 the other, the farthest from the top.
      const side = k % 2 ? -1 : 1
      const n = Math.floor(k / 2)
      const d = 16 + n * (side > 0 ? 10 : 7.5)
      const top = mastAt(H - 8 - n * 3.6)
      const deck = new THREE.Vector3(mid[0] + ux * d * side, deckY + 0.6, mid[1] + uz * d * side)
      const dir = top.clone().sub(deck)
      out.push({ pos: deck.clone().add(top).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), l: dir.length() })
    }
    return out
  }, [mid[0], mid[1], ux, uz]) // eslint-disable-line react-hooks/exhaustive-deps
  // The pylon's pieces: two legs from the water, either side of the deck, meeting at JOIN; the mast above.
  const pieces = useMemo(() => {
    const [vx, vz] = [uz, -ux] // across the bridge
    const seg = (p: THREE.Vector3, q: THREE.Vector3, w0: number, w1: number) => {
      const dir = q.clone().sub(p)
      return { pos: p.clone().add(q).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), l: dir.length(), w0, w1 }
    }
    const join = mastAt(JOIN)
    const out = [-1, 1].map((s) => seg(new THREE.Vector3(mid[0] + vx * 13 * s, -2, mid[1] + vz * 13 * s), join, 3.4, 2.6))
    out.push(seg(join, mastAt(H), 4.2, 1.8))
    // The cross-beam under the deck, between the legs.
    return { legs: out, beam: { at: new THREE.Vector3(mid[0], deckY - 2.2, mid[1]), rot: Math.atan2(vx, vz) } }
  }, [mid[0], mid[1], ux, uz]) // eslint-disable-line react-hooks/exhaustive-deps
  const top = mastAt(H)
  return (
    <group>
      {pieces.legs.map((p, i) => (
        <mesh key={i} position={p.pos} quaternion={p.q} material={white} castShadow>
          <cylinderGeometry args={[p.w1, p.w0, p.l, 4]} />
        </mesh>
      ))}
      <mesh position={pieces.beam.at} rotation={[0, pieces.beam.rot, 0]} material={white}>
        <boxGeometry args={[2.5, 2.5, 26]} />
      </mesh>
      <mesh position={[top.x, top.y + 2, top.z]} material={white}>
        <coneGeometry args={[1.8, 5, 4]} />
      </mesh>
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
 * A toll plaza: lanes, booths on their islands, barriers, the traffic paying.
 * The 3e pont's has 21 lanes (Bouygues), 500 F a car when it opened; the 4e
 * pont's lanes aren't published (10 here, an estimate). Each as photos show it:
 * - the 3e pont's (« hkb »): one long green metal roof over all the lanes on
 *   round white columns, red booths, the islands' noses striped, the
 *   offices with their green roofs at the side;
 * - the 4e pont's (« yop »): a white arch over each island, the orange-red
 *   gantry across all the lanes with a red cross or a green arrow over each,
 *   green booths, red-and-white barriers before the islands, lamp masts.
 */
export function TollPlaza({ at, rot, lanes: LANES, label, night, look }: { at: XZ; rot: number; lanes: number; label: string; night: boolean; look: 'hkb' | 'yop' }) {
  const W = LANES * 3.6
  const M = useMemo(
    () => ({
      glow: new THREE.MeshLambertMaterial({ color: '#fff4d6', emissive: '#ffe2a0', emissiveIntensity: 0 }),
      green: new THREE.MeshLambertMaterial({ color: '#1f9a5a', side: THREE.DoubleSide }),
      greenDark: new THREE.MeshLambertMaterial({ color: '#15703f' }),
      red: new THREE.MeshLambertMaterial({ color: '#d4262d' }),
      band: new THREE.MeshLambertMaterial({ color: '#e8642c' }),
      island: new THREE.MeshLambertMaterial({ color: '#d8d3c8' }),
      apron: new THREE.MeshLambertMaterial({ color: '#8f8e88' }),
      line: new THREE.MeshLambertMaterial({ color: '#f4f4f4' }),
      glass: new THREE.MeshLambertMaterial({ color: '#35506e' }),
      stripeA: new THREE.MeshLambertMaterial({ color: '#e8432f' }),
      stripeB: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
      go: new THREE.MeshLambertMaterial({ color: '#20c05a', emissive: '#20c05a', emissiveIntensity: 0.9 }),
      stop: new THREE.MeshLambertMaterial({ color: '#e8222d', emissive: '#e8222d', emissiveIntensity: 0.9 }),
    }),
    [],
  )
  M.glow.emissiveIntensity = night ? 1 : 0
  const hkb = look === 'hkb'
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      {/* The plaza's hundreds of blocks drawn as a few meshes (staticMerge.tsx): its traffic and barriers move, apart. */}
      <StaticMerge version={night ? 1 : 0}>
        {/* The apron, the lane lines running up to the islands */}
        <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} material={M.apron} receiveShadow>
          <planeGeometry args={[W + 10, 90]} />
        </mesh>
        {[...Array(LANES + 1)].map((_, i) =>
          [-1, 1].map((s) => <mesh key={`${i}${s}`} position={[-W / 2 + i * 3.6, 0.09, s * 24]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.15, 30, 1]} material={M.line} geometry={PLANE_GEO} />),
        )}

        {hkb ? (
          <>
            {/* One long roof over everything: green metal, a low ridge along it, on round white columns */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0, 7.4, s * 4.2]} rotation={[s * 0.12, 0, 0]} material={M.green} castShadow>
                <boxGeometry args={[W + 6, 0.3, 8.6]} />
              </mesh>
            ))}
            <mesh position={[0, 7.0, 0]} material={M.greenDark}>
              <boxGeometry args={[W + 6, 0.8, 1.2]} />
            </mesh>
            {/* The fascia along both eaves, with the lamps under it */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0, 6.75, s * 8.4]} material={M.greenDark}>
                <boxGeometry args={[W + 6, 0.5, 0.25]} />
              </mesh>
            ))}
            <mesh position={[0, 6.3, 0]} material={M.glow}>
              <boxGeometry args={[W, 0.08, 10]} />
            </mesh>
            {/* The offices at the side, under their own green roofs */}
            {[0, 1].map((k) => (
              <group key={k} position={[W / 2 + 14 + k * 13, 0, -26 + k * 6]}>
                <mesh position={[0, 3, 0]} castShadow>
                  <boxGeometry args={[11, 6, 8]} />
                  <meshLambertMaterial color="#e9e3cf" />
                </mesh>
                <mesh position={[0, 6.6, 0]} material={M.green} castShadow>
                  <coneGeometry args={[8.3, 2.4, 4, 1]} />
                </mesh>
                <mesh position={[0, 3, 4.02]} material={M.glass}>
                  <boxGeometry args={[8, 1.6, 0.05]} />
                </mesh>
              </group>
            ))}
          </>
        ) : (
          <>
            {/* The gantry across all the lanes: orange-red, a signal over each lane */}
            <mesh position={[0, 6.4, -1.5]} material={M.band} castShadow>
              <boxGeometry args={[W + 2, 0.9, 0.9]} />
            </mesh>
            {[...Array(LANES)].map((_, i) => (
              <mesh key={i} position={[-W / 2 + i * 3.6 + 1.8, 6.4, -1.0]} material={TOLL_BUSY.includes(i) ? M.go : M.stop}>
                <boxGeometry args={[0.7, 0.6, 0.1]} />
              </mesh>
            ))}
            {/* Lamp masts beside the plaza */}
            {[-1, 1].map((s) => (
              <group key={s} position={[s * (W / 2 + 6), 0, -10]}>
                <mesh position={[0, 7, 0]} material={white}>
                  <cylinderGeometry args={[0.18, 0.25, 14, 6]} />
                </mesh>
                <mesh position={[0, 14.2, 0]} material={M.glow}>
                  <boxGeometry args={[1.6, 0.4, 0.6]} />
                </mesh>
              </group>
            ))}
          </>
        )}

        {/* Between the lanes, the islands with their booths; the barriers */}
        {[...Array(LANES + 1)].map((_, i) => {
          const x = -W / 2 + i * 3.6
          return (
            <group key={i} position={[x, 0, 0]}>
              <mesh position={[0, 0.15, 0]} material={M.island}>
                <boxGeometry args={[1.1, 0.3, 16]} />
              </mesh>
              {/* The island's noses: striped red and white (the 4e pont: a barrier block in front) */}
              {[-1, 1].map((s) => (
                <group key={s} position={[0, 0, s * 8.6]}>
                  <mesh position={[0, 0.45, 0]} material={M.stripeB}>
                    <boxGeometry args={[1.1, 0.6, 1.2]} />
                  </mesh>
                  <mesh position={[0, 0.45, s * 0.2]} material={M.stripeA}>
                    <boxGeometry args={[1.12, 0.3, 0.5]} />
                  </mesh>
                  {!hkb && (
                    <mesh position={[0, 0.5, s * 1.6]} material={M.red}>
                      <boxGeometry args={[1.4, 0.8, 0.5]} />
                    </mesh>
                  )}
                </group>
              ))}
              {i < LANES && (
                <>
                  {/* The booth: red (3e pont) or green (4e pont), its window toward the cars */}
                  <mesh position={[0, 1.5, 0]} material={hkb ? M.red : M.green} castShadow>
                    <boxGeometry args={[0.95, 2.4, 2.0]} />
                  </mesh>
                  <mesh position={[0, 2.8, 0]} material={hkb ? M.red : M.greenDark}>
                    <boxGeometry args={[1.1, 0.2, 2.2]} />
                  </mesh>
                  <mesh position={[0.49, 1.8, 0]} material={M.glass}>
                    <boxGeometry args={[0.04, 0.9, 1.4]} />
                  </mesh>
                  {!TOLL_BUSY.includes(i) && (
                    <mesh position={[1.75, 1, -2.5]}>
                      <boxGeometry args={[2.9, 0.12, 0.12]} />
                      <meshLambertMaterial color={i % 2 ? '#e8432f' : '#ffffff'} />
                    </mesh>
                  )}
                </>
              )}
              {/* The 3e pont: a round column every two islands; the 4e pont: an arch over each island */}
              {hkb && i % 2 === 0 && (
                <mesh position={[0, 3.5, 3]} material={white}>
                  <cylinderGeometry args={[0.35, 0.35, 7, 10]} />
                </mesh>
              )}
              {!hkb && (
                <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI / 2, 0]} material={white} castShadow>
                  <torusGeometry args={[6.6, 0.32, 6, 18, Math.PI]} />
                </mesh>
              )}
            </group>
          )
        })}
      </StaticMerge>
      <TollTraffic lanes={LANES} />
      <Html position={[0, 10, 0]} center zIndexRange={[15, 0]}>
        <div className={`rounded-xl border border-black/5 px-2.5 py-1 text-[12.5px] font-extrabold whitespace-nowrap text-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)] ${hkb ? 'bg-[#1f9a5a]' : 'bg-[#e8642c]'}`}>{label}</div>
      </Html>
    </group>
  )
}
const PLANE_GEO = new THREE.PlaneGeometry(1, 1)

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
