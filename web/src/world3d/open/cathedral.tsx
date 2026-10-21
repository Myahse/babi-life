import { useMemo } from 'react'
import * as THREE from 'three'
import type { Obstacle } from '../obstacles'

// Cathédrale Saint-Paul (Plateau, Aldo Spirito, consecrated in 1985): a
// triangle of 4 200 m² whose roof rises from the forecourt to the great tower
// at its point. The tower's top is a cross 70 m up, leaning out over the
// lagoon; seven steel cables tie it back to the roof, and three bell towers
// in all hold the triangle (the two small ones at the front corners here).
// Inside, tiers around a central altar (4 500 seats) and Roberto Franzosi's
// stained glass, lit from inside, in four panels (370 m²). Figures from the
// cathedral's Wikipedia page; the triangle's proportions and the towers'
// sections are the game's.
// Local frame: +z the front (the forecourt, toward the Palais de justice), -z the tower and the lagoon.

/** The plan: half-width FW at the front (z F), BW at the back (z B, the tower); the roof H0 high at the front, H1 at the back. */
export const NAVE = { F: 34, B: -50, FW: 40, BW: 6, H0: 11, H1: 36 }
/** The great tower: its foot, its height, how far it leans out (radians, toward -z). */
export const TOWER = { z: NAVE.B - 2, H: 70, lean: 0.16, arm: 52 }

/** Half the triangle's width at z. */
export const naveHalf = (z: number) => NAVE.BW + ((z - NAVE.B) / (NAVE.F - NAVE.B)) * (NAVE.FW - NAVE.BW)
/** The roof's height at z. */
export const roofAt = (z: number) => NAVE.H1 + ((z - NAVE.B) / (NAVE.F - NAVE.B)) * (NAVE.H0 - NAVE.H1)

/** A slice of the triangle, from bottom(z) to top(z), grown by `grow` all round. */
function prism(grow: number, bottom: (z: number) => number, top: (z: number) => number) {
  const g = new THREE.BoxGeometry(1, 1, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) > 0 ? NAVE.F + grow : NAVE.B - grow
    p.setXYZ(i, Math.sign(p.getX(i)) * (naveHalf(z) + grow), p.getY(i) > 0 ? top(z) : bottom(z), z)
  }
  g.computeVertexNormals()
  return g
}

/** A straight piece from a to b (a beam, a cable): where it goes and how it's turned. */
export function span(a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a)
  return { at: a.clone().add(b).multiplyScalar(0.5), len: d.length(), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) }
}

/** Where the tower's axis is, h metres up it (leaning back). */
export const towerPoint = (h: number) => new THREE.Vector3(0, h * Math.cos(TOWER.lean), TOWER.z - h * Math.sin(TOWER.lean))

/**
 * Stained glass: leaded cells of deep colours, a figure's halo here and there
 * (the windows tell the Church in Côte d'Ivoire, Christ, Paul and the
 * sacraments: the game only gives their colours and shapes).
 */
export function vitrail(seed: number, w = 128, h = 96) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const colours = ['#1f4fa8', '#2a6fd6', '#d62f2f', '#f2b51d', '#2f9a4a', '#7a3fb0', '#f07a1a', '#1aa3b8', '#f4e2a0']
  g.fillStyle = '#1b1b22'
  g.fillRect(0, 0, w, h)
  const cell = 8
  for (let y = 0; y < h; y += cell)
    for (let x = 0; x < w; x += cell) {
      // Bands of blue and gold, with warm figures standing in them.
      const band = Math.floor((y / h) * 3)
      const k = r() < 0.55 ? [0, 1, 7][band] : Math.floor(r() * colours.length)
      g.fillStyle = colours[k]
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2)
    }
  for (let i = 0; i < w / 24; i++) {
    const x = 12 + i * 24 + r() * 4
    g.fillStyle = '#f4e2a0'
    g.beginPath()
    g.arc(x, h * 0.32, 6, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = ['#d62f2f', '#f07a1a', '#ffffff', '#7a3fb0'][i % 4]
    g.fillRect(x - 5, h * 0.42, 10, h * 0.4)
  }
  g.strokeStyle = '#141418'
  g.lineWidth = 2
  for (let x = 0; x <= w; x += w / 4) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, h)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The four windows: along each side wall, two panels (where along it from the front, 0–1). */
export const WINDOWS = [-1, 1].flatMap((side) => [0.24, 0.56].map((t, i) => ({ side, t, seed: 11 + i * 7 + (side > 0 ? 3 : 0) })))

/** A window's middle and turn, on the wall's outer face (inside: flip it). */
export function windowAt(side: number, t: number) {
  const [x0, z0, x1, z1] = [side * NAVE.FW, NAVE.F, side * NAVE.BW, NAVE.B]
  const [x, z] = [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]
  // The wall's outward normal: across its length, away from the middle.
  let [nx, nz] = [-(z1 - z0), x1 - x0]
  if (nx * x + nz * z < 0) [nx, nz] = [-nx, -nz]
  const n = Math.hypot(nx, nz)
  return { x, z, y: 2.5 + (roofAt(z) - 5) / 2, h: Math.min(9, roofAt(z) - 5), rot: Math.atan2(nx / n, nz / n), n: [nx / n, nz / n] as [number, number] }
}

export function Cathedral({ night }: { night: boolean }) {
  const white = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f4f1ea' }), [])
  const shade = useMemo(() => new THREE.MeshLambertMaterial({ color: '#dcd6ca' }), [])
  const cable = useMemo(() => new THREE.MeshLambertMaterial({ color: '#5b6068' }), [])
  const panel = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2f6fb0' }), [])
  const doors = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2a3442', emissive: '#ffcf7a', emissiveIntensity: 0 }), [])
  const glass = useMemo(() => WINDOWS.map((w) => new THREE.MeshLambertMaterial({ map: vitrail(w.seed), emissive: '#ffffff', emissiveMap: vitrail(w.seed), emissiveIntensity: 0.15 })), [])
  // Lit from inside: dull by day from the street, glowing at night.
  for (const m of glass) m.emissiveIntensity = night ? 0.9 : 0.15
  doors.emissiveIntensity = night ? 0.35 : 0

  const body = useMemo(() => prism(0, () => 0, roofAt), [])
  const roof = useMemo(() => prism(1.6, (z) => roofAt(z) - 0.2, (z) => roofAt(z) + 1.1), [])
  // Ribs over the roof, from the front edge to the tower, drawing in.
  const ribs = useMemo(
    () =>
      [...Array(9)].map((_, i) => {
        const k = i / 8 - 0.5
        return span(new THREE.Vector3(k * 2 * (NAVE.FW + 1), roofAt(NAVE.F) + 1.5, NAVE.F + 1.5), new THREE.Vector3(k * 2 * NAVE.BW, roofAt(NAVE.B) + 1.5, NAVE.B))
      }),
    [],
  )
  // The tower: a shaft narrowing upward, leaning out.
  const shaft = useMemo(() => {
    const g = new THREE.BoxGeometry(7, TOWER.H, 5)
    g.translate(0, TOWER.H / 2, 0)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const k = 1 - (p.getY(i) / TOWER.H) * 0.5
      p.setX(i, p.getX(i) * k)
      p.setZ(i, p.getZ(i) * k)
    }
    g.computeVertexNormals()
    return g
  }, [])
  // Seven cables from up the tower down onto the roof, fanning out.
  const cables = useMemo(
    () =>
      [-3, -2, -1, 0, 1, 2, 3].map((k) => {
        const top = towerPoint(TOWER.arm - 6 + (3 - Math.abs(k)) * 3)
        const z = -22 + Math.abs(k) * 5
        return span(top, new THREE.Vector3(k * 6.5, roofAt(z) + 1.2, z))
      }),
    [],
  )
  const windows = useMemo(() => WINDOWS.map((w) => ({ ...w, ...windowAt(w.side, w.t) })), [])
  return (
    <group>
      <mesh geometry={body} material={white} castShadow receiveShadow />
      <mesh geometry={roof} material={shade} castShadow receiveShadow />
      {ribs.map((r, i) => (
        <mesh key={i} position={r.at} quaternion={r.q} material={white} castShadow>
          <boxGeometry args={[0.9, r.len, 0.9]} />
        </mesh>
      ))}
      {/* The stained glass, two panels on each side wall */}
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x + w.n[0] * 0.08, w.y, w.z + w.n[1] * 0.08]} rotation={[0, w.rot, 0]} material={glass[i]}>
          <planeGeometry args={[12, w.h]} />
        </mesh>
      ))}
      {/* The ceramic panels low along the walls */}
      {windows.map((w, i) => (
        <mesh key={`c${i}`} position={[w.x + w.n[0] * 0.1, 1.2, w.z + w.n[1] * 0.1]} rotation={[0, w.rot, 0]} material={panel}>
          <planeGeometry args={[16, 1.6]} />
        </mesh>
      ))}
      {/* The front: white fins, the glass doors under their canopy */}
      {[...Array(19)].map((_, i) => (
        <mesh key={`f${i}`} position={[-36 + i * 4, NAVE.H0 / 2, NAVE.F + 0.5]} material={white} castShadow>
          <boxGeometry args={[0.6, NAVE.H0, 1]} />
        </mesh>
      ))}
      <mesh position={[0, 2.4, NAVE.F + 0.06]} material={doors}>
        <planeGeometry args={[22, 4.8]} />
      </mesh>
      <mesh position={[0, 5.4, NAVE.F + 3]} material={white} castShadow receiveShadow>
        <boxGeometry args={[28, 0.6, 6]} />
      </mesh>
      {[-13, -6.5, 6.5, 13].map((x) => (
        <mesh key={x} position={[x, 2.6, NAVE.F + 5.5]} material={white} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 5.2, 10]} />
        </mesh>
      ))}
      {/* The forecourt and its steps */}
      {[0, 1, 2].map((i) => (
        <mesh key={`s${i}`} position={[0, 0.15 + i * 0.15, NAVE.F + 11 - i * 1.2]} material={shade} receiveShadow>
          <boxGeometry args={[60 - i * 2, 0.3, 12 - i * 2.4]} />
        </mesh>
      ))}
      {/* The great tower and its cross, leaning out over the lagoon */}
      <group position={[0, 0, TOWER.z]} rotation={[-TOWER.lean, 0, 0]}>
        <mesh geometry={shaft} material={white} castShadow receiveShadow />
        <mesh position={[0, TOWER.arm, 0]} material={white} castShadow>
          <boxGeometry args={[22, 3.2, 3]} />
        </mesh>
      </group>
      {cables.map((c, i) => (
        <mesh key={`k${i}`} position={c.at} quaternion={c.q} material={cable}>
          <cylinderGeometry args={[0.16, 0.16, c.len, 5]} />
        </mesh>
      ))}
      {/* The two small bell towers at the front corners, their bells under a little cross */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (NAVE.FW - 3), 0, NAVE.F - 3]}>
          <mesh position={[0, 12, 0]} material={white} castShadow>
            <boxGeometry args={[2.6, 24, 2.6]} />
          </mesh>
          <mesh position={[0, 20.5, 0]} material={doors}>
            <boxGeometry args={[2.7, 2.6, 1.6]} />
          </mesh>
          <mesh position={[0, 25.5, 0]} material={white}>
            <boxGeometry args={[0.4, 3, 0.4]} />
          </mesh>
          <mesh position={[0, 26.2, 0]} material={white}>
            <boxGeometry args={[1.6, 0.4, 0.4]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** What a walker can't go through: the triangle in slices, the towers. */
export const CATHEDRAL_SOLID: Obstacle[] = [
  ...[...Array(12)].map((_, i) => {
    const [z0, z1] = [NAVE.B + (i * (NAVE.F - NAVE.B)) / 12, NAVE.B + ((i + 1) * (NAVE.F - NAVE.B)) / 12]
    return { x: 0, z: (z0 + z1) / 2, hw: naveHalf((z0 + z1) / 2) + 0.6, hd: (z1 - z0) / 2, rot: 0, top: roofAt(z1) }
  }),
  { x: 0, z: TOWER.z, r: 4.5 },
  { x: -(NAVE.FW - 3), z: NAVE.F - 3, r: 2 },
  { x: NAVE.FW - 3, z: NAVE.F - 3, r: 2 },
  ...[-13, -6.5, 6.5, 13].map((x) => ({ x, z: NAVE.F + 5.5, r: 0.5 })),
]
