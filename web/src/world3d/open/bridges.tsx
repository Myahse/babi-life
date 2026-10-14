import { useMemo } from 'react'
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
  return (
    <>
      {ado && <CableStayed ends={ado} />}
      {hkb && <TollPlaza ends={hkb} night={night} />}
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

/**
 * The 3e pont's toll plaza: 21 lanes under a canopy (Bouygues), 500 F a car
 * when it opened. No source says on which bank it stands; it's put here on
 * the northern (Riviera) approach, 130 m from the end of the bridge.
 */
function TollPlaza({ ends: [a, b], night }: { ends: [XZ, XZ]; night: boolean }) {
  // The northern end is the one further up the map (smaller z).
  const [north, south] = a[1] < b[1] ? [a, b] : [b, a]
  const len = Math.hypot(north[0] - south[0], north[1] - south[1])
  const [ux, uz] = [(north[0] - south[0]) / len, (north[1] - south[1]) / len]
  const at: XZ = [north[0] + ux * 130, north[1] + uz * 130]
  const rot = Math.atan2(ux, uz)
  const LANES = 21
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
                <mesh position={[1.75, 1, -2.5]}>
                  <boxGeometry args={[2.9, 0.12, 0.12]} />
                  <meshLambertMaterial color={i % 2 ? '#e8432f' : '#ffffff'} />
                </mesh>
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
      <Html position={[0, 10, 0]} center zIndexRange={[15, 0]}>
        <div className="rounded-xl border border-black/5 bg-[#f08a24] px-2.5 py-1 text-[12.5px] font-extrabold whitespace-nowrap text-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)]">Péage du 3e pont · 500 F</div>
      </Html>
    </group>
  )
}
