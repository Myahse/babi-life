import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Airliner } from './airport'
import { TIER, SIGNS, type AirportTier, type SignLang } from './airportSite'
import { t as tr } from '../../lib/i18n'
import type { XZ } from './geo'

// Every city's airport but Abidjan's (whose Port-Bouët has its own model, airport.tsx Airport): the same
// terminal wherever, sized by how big the airport is (airportSite.ts TIER: a hub's long hall and pier of
// jet bridges, an international airport's, a regional one's low hall and its two planes on the apron with
// their stairs), its name on the front in the country's language, the departures and arrivals over the kerb,
// Air Lagune's planes at the gates and the control tower. Where the map has no runway, the one the game
// lays out behind it (airportSite.ts), drawn here. Its frame as the lot's: +z the kerb and the street, −z the apron.

const white = new THREE.MeshLambertMaterial({ color: '#f4f5f7' })
const grey = new THREE.MeshLambertMaterial({ color: '#c3c8cf' })
const dark = new THREE.MeshLambertMaterial({ color: '#2e3540' })
const glass = new THREE.MeshLambertMaterial({ color: '#4d7da8', emissive: '#16324d', emissiveIntensity: 0.4 })
const concrete = new THREE.MeshLambertMaterial({ color: '#bdb8ad' })
const apronMat = new THREE.MeshLambertMaterial({ color: '#9a9ea3' })
const asphalt = new THREE.MeshLambertMaterial({ color: '#4a4d52' })
const paint = new THREE.MeshLambertMaterial({ color: '#f4f5f7' })
const yellow = new THREE.MeshLambertMaterial({ color: '#f2c230' })
const orange = new THREE.MeshLambertMaterial({ color: '#f08a24' })
const box = new THREE.BoxGeometry(1, 1, 1)

/** A sign's face: its words on a band of colour, as wide as they need (the canvas keeps the plane's ratio). */
function signMat(text: string, bg: string, fg: string, w: number, h: number) {
  if (typeof document === 'undefined') return white
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `800 ${h * 0.56}px sans-serif`
  const k = Math.min(1, (w * 0.92) / g.measureText(text).width)
  g.font = `800 ${h * 0.56 * k}px sans-serif`
  g.fillText(text, w / 2, h / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshBasicMaterial({ map: t })
}

/** A block: where (its middle), how big, of what. */
function B({ p, s, m, shadow }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; shadow?: boolean }) {
  return <mesh geometry={box} position={p} scale={s} material={m} castShadow={shadow} receiveShadow={shadow} />
}

export type GenericAirportProps = {
  tier: AirportTier
  /** Its name as it's written there (airportSite.ts localName). */
  name: string
  lang: SignLang
  night: boolean
  /** The runway the game laid out (none on the map), in this frame. */
  runway?: [XZ, XZ]
  /** The terminal moved back toward the street (m): off the taxiways where the map's point is on the airfield. */
  shift?: number
}

export function GenericAirport({ tier, name, lang, night, runway, shift = 0 }: GenericAirportProps) {
  glass.emissiveIntensity = night ? 0.9 : 0.4
  const size = TIER[tier]
  const L = size.length
  const D = size.depth
  const H = tier === 'hub' ? 20 : tier === 'major' ? 15 : 9
  const words = lang === 'fr' ? null : SIGNS[lang]
  const signs = useMemo(
    () => ({
      name: signMat(name.toUpperCase(), '#14213d', '#ffd166', 4096, 160),
      dep: signMat(words ? words.departures : tr('DÉPARTS'), '#1d4ed8', '#ffffff', 512, 128),
      arr: signMat(words ? words.arrivals : tr('ARRIVÉES'), '#1f9a4a', '#ffffff', 512, 128),
      airline: signMat('AIR LAGUNE', '#f08a24', '#ffffff', 512, 128),
    }),
    [name, words],
  )
  const roof = useMemo(() => {
    // A long, gently curved roof (a hub's and an international one's); a regional hall's is flat.
    const r = L * 0.3
    const g = new THREE.CylinderGeometry(r, r, L + 10, 32, 1, true, -0.35, 0.7)
    g.rotateZ(Math.PI / 2)
    g.rotateX(-Math.PI / 2)
    g.translate(0, H - r * Math.cos(0.35) + 0.5, 0)
    // (Its depth: the curve's chord to the hall's.)
    g.scale(1, 1, (D + 6) / (2 * r * Math.sin(0.35)))
    return g
  }, [L, D, H])
  useEffect(() => () => roof.dispose(), [roof])
  // The gates along the pier (a hub's and an international one's) or the apron (a regional one's).
  const pier = tier !== 'regional'
  const gates = useMemo(() => Array.from({ length: size.gates }, (_, i) => (size.gates === 1 ? 0 : -L * 0.38 + (i * L * 0.76) / (size.gates - 1))), [L, size.gates])
  const pillars = useMemo(() => {
    const n = Math.max(3, Math.round(L / 15))
    return Array.from({ length: n + 1 }, (_, i) => -L / 2 + (i * L) / n)
  }, [L])
  const back = -D / 2
  const pierZ = back - 14
  const planeZ = pier ? pierZ - 40 : back - 46
  return (
    <group position={[0, 0, shift]}>
      {/* The kerb, its forecourt, the road in front */}
      <mesh position={[0, 0.05, D / 2 + 8]} rotation={[-Math.PI / 2, 0, 0]} material={concrete} receiveShadow>
        <planeGeometry args={[L + 30, 16]} />
      </mesh>
      <mesh position={[0, 0.04, D / 2 + 22]} rotation={[-Math.PI / 2, 0, 0]} material={asphalt} receiveShadow>
        <planeGeometry args={[L + 60, 12]} />
      </mesh>
      {/* The apron behind, where the planes stand */}
      <mesh position={[0, 0.03, back - 70]} rotation={[-Math.PI / 2, 0, 0]} material={apronMat} receiveShadow>
        <planeGeometry args={[L + 120, 140]} />
      </mesh>
      {gates.map((x) => (
        <B key={`l${x}`} p={[x, 0.06, planeZ + 4]} s={[0.4, 0.02, 56]} m={yellow} />
      ))}
      {/* The hall: glass between white pillars, under its roof */}
      <B p={[0, H / 2, 0]} s={[L, H, D]} m={glass} shadow />
      {pillars.map((x) => (
        <B key={x} p={[x, H / 2, D / 2 + 0.3]} s={[1.2, H, 0.8]} m={white} />
      ))}
      {tier === 'regional' ? <B p={[0, H + 0.6, 0]} s={[L + 4, 1.2, D + 4]} m={white} shadow /> : <mesh geometry={roof} material={white} castShadow />}
      {/* The name over the front; Air Lagune's sign at the end */}
      <mesh position={[0, H - (tier === 'regional' ? 1.6 : 2.6), D / 2 + 0.75]} material={signs.name}>
        <planeGeometry args={tier === 'regional' ? [64, 2.5] : [150, 5.86]} />
      </mesh>
      <mesh position={[L / 2 - Math.min(14, L * 0.12), H * 0.45, D / 2 + 0.75]} material={signs.airline}>
        <planeGeometry args={[Math.min(16, L * 0.14), Math.min(4, L * 0.035)]} />
      </mesh>
      {/* The canopy over the kerb, its signs: the departures one end, the arrivals the other */}
      <B p={[0, 5.5, D / 2 + 6]} s={[L - 6, 0.5, 9]} m={white} shadow />
      {[-1, 1].map((k) => (
        <group key={k}>
          <B p={[k * (L / 2 - 6), 2.75, D / 2 + 9.8]} s={[0.4, 5.5, 0.4]} m={grey} />
          <mesh position={[k * L * 0.25, 6.55, D / 2 + 10.55]} material={k < 0 ? signs.dep : signs.arr}>
            <planeGeometry args={[Math.min(12, L * 0.12), Math.min(3, L * 0.03)]} />
          </mesh>
        </group>
      ))}
      {pier && (
        <>
          {/* The pier along the apron and its jet bridges, each to a plane's front door */}
          <B p={[0, 4.5, pierZ]} s={[L * 0.86, 8, 14]} m={grey} shadow />
          <B p={[0, 4.5, (back + pierZ) / 2]} s={[16, 7, Math.abs(pierZ - back)]} m={grey} />
          {gates.map((x) => (
            <B key={x} p={[x - 2, 5, pierZ - 13]} s={[3.2, 3, 12]} m={white} shadow />
          ))}
        </>
      )}
      {gates.map((x, i) => (
        <group key={x} position={[x - 6, 0, planeZ]}>
          {/* Seen close: the whole plane (its windows, engines, lights) for the first few; the others plainer */}
          <Airliner far={i >= 4} lights={i < 4} spin={false} />
          {!pier && (
            // A regional one: the stairs up to the front door, the baggage cart.
            <>
              <B p={[2.9, 1.2, 15]} s={[1.6, 2.4, 4]} m={white} />
              <B p={[-4, 0.6, 9]} s={[2, 1.2, 1.4]} m={orange} />
            </>
          )}
        </group>
      ))}
      {/* The control tower, at the end of the hall */}
      <group position={[L / 2 + 28, 0, back - 12]}>
        <mesh position={[0, size.tower / 2, 0]} material={white} castShadow>
          <cylinderGeometry args={[size.tower * 0.07, size.tower * 0.09, size.tower, 12]} />
        </mesh>
        <mesh position={[0, size.tower + 1.5, 0]} material={white} castShadow>
          <cylinderGeometry args={[size.tower * 0.16, size.tower * 0.11, 3, 8]} />
        </mesh>
        <mesh position={[0, size.tower + 5, 0]} material={glass}>
          <cylinderGeometry args={[size.tower * 0.165, size.tower * 0.155, 4, 8]} />
        </mesh>
        <mesh position={[0, size.tower + 7.5, 0]} material={dark} castShadow>
          <cylinderGeometry args={[size.tower * 0.18, size.tower * 0.18, 1, 8]} />
        </mesh>
        <mesh position={[0, size.tower + 10.5, 0]} material={grey}>
          <cylinderGeometry args={[0.2, 0.2, 5, 6]} />
        </mesh>
      </group>
      {runway && <MadeRunway runway={runway} apronZ={back - 140} />}
    </group>
  )
}

/** The runway the game lays out where the map has none: the asphalt, its edges and dashed centre line, the taxiway to the apron. */
function MadeRunway({ runway: [a, b], apronZ }: { runway: [XZ, XZ]; apronZ: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const mid: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
  const dashes = useMemo(() => Array.from({ length: Math.floor(len / 50) }, (_, i) => -len / 2 + 25 + i * 50), [len])
  return (
    <group>
      <group position={[mid[0], 0, mid[1]]} rotation={[0, -ang, 0]}>
        <B p={[0, 0.06, 0]} s={[len, 0.04, 45]} m={asphalt} />
        <B p={[0, 0.08, -20.5]} s={[len, 0.02, 0.9]} m={paint} />
        <B p={[0, 0.08, 20.5]} s={[len, 0.02, 0.9]} m={paint} />
        {dashes.map((x) => (
          <B key={x} p={[x, 0.08, 0]} s={[30, 0.02, 0.9]} m={paint} />
        ))}
        {/* The thresholds' piano keys */}
        {[-1, 1].map((k) =>
          [-15, -9, -3, 3, 9, 15].map((z) => <B key={`${k}${z}`} p={[k * (len / 2 - 25), 0.08, z]} s={[30, 0.02, 3]} m={paint} />),
        )}
      </group>
      {/* The taxiway from the apron's back to the runway */}
      <B p={[0, 0.05, (apronZ + mid[1]) / 2]} s={[20, 0.03, Math.abs(mid[1] - apronZ)]} m={asphalt} />
    </group>
  )
}
