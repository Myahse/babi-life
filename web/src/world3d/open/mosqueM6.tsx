import { useMemo } from 'react'
import * as THREE from 'three'
import type { Obstacle } from '../obstacles'

// The Mosquée Mohammed VI (Treichville, Biafra; inaugurated on 5 April 2024,
// architect Mustapha Zeghari): Moroccan in style, 25 000 m² of grounds, a
// prayer hall for 7 000, a library and a conference room, and a minaret of
// more than 69 m. The figures are from the press of its opening; the layout
// (the hall under its green-tiled roofs, the courtyard and its fountain
// under arcades, the square minaret at its corner) is the game's, after the
// Moroccan mosques it follows.
// Local frame: +z the gate and the street, -z the qibla wall.

/** The prayer hall: half-width, front and back. */
export const HALL = { hw: 36, front: 14, back: -34, h: 13 }
/** The courtyard before it, to the gate. */
export const COURT = { hw: 30, front: 44 }
/** The minaret: its corner, side, height. */
export const MINARET = { x: COURT.hw - 2, z: COURT.front - 4, side: 9, h: 69 }

const cream = '#efe4cf'
const green = '#1f7a4a'

export function MosqueM6({ night }: { night: boolean }) {
  const wall = useMemo(() => new THREE.MeshLambertMaterial({ color: cream }), [])
  const tile = useMemo(() => new THREE.MeshLambertMaterial({ color: green }), [])
  const dark = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4a3a2a', emissive: '#ffcf7a', emissiveIntensity: 0 }), [])
  const gold = useMemo(() => new THREE.MeshLambertMaterial({ color: '#d4a017', emissive: '#d4a017', emissiveIntensity: 0.2 }), [])
  const zellige = useMemo(() => {
    // The courtyard's floor: white and green tiles in a star pattern, pixel style.
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    g.fillStyle = '#f4f1ea'
    g.fillRect(0, 0, 32, 32)
    g.fillStyle = '#2f8a5a'
    for (const [x, y] of [[0, 0], [16, 16]]) {
      g.fillRect(x + 6, y + 2, 4, 12)
      g.fillRect(x + 2, y + 6, 12, 4)
    }
    g.fillStyle = '#c9a14a'
    g.fillRect(7, 7, 2, 2)
    g.fillRect(23, 23, 2, 2)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(18, 9)
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshLambertMaterial({ map: t })
  }, [])
  dark.emissiveIntensity = night ? 0.6 : 0
  // The roofs: three long hipped roofs of green tiles over the hall, side by side.
  const roof = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 4, 1)
    g.rotateY(Math.PI / 4)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  // Arches along the hall's front and the courtyard's galleries.
  const arches = useMemo(() => {
    const out: { p: [number, number, number]; ry: number }[] = []
    for (let x = -HALL.hw + 4; x <= HALL.hw - 4; x += 6) out.push({ p: [x, 0, HALL.front + 0.05], ry: 0 })
    for (const s of [-1, 1]) for (let z = HALL.front + 6; z <= COURT.front - 6; z += 6) out.push({ p: [s * (COURT.hw - 0.05), 0, z], ry: s * (Math.PI / 2) })
    return out
  }, [])
  const ARCH = 2.6
  return (
    <group>
      {/* The prayer hall, its three roofs and the cupola over the mihrab */}
      <mesh position={[0, HALL.h / 2, (HALL.front + HALL.back) / 2]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[HALL.hw * 2, HALL.h, HALL.front - HALL.back]} />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <mesh key={k} geometry={roof} material={tile} position={[k * 24, HALL.h, (HALL.front + HALL.back) / 2]} scale={[12 * Math.SQRT2, 7, ((HALL.front - HALL.back) / 2) * Math.SQRT2]} castShadow />
      ))}
      <mesh position={[0, HALL.h + 2, HALL.back - 3]} material={wall} castShadow>
        <boxGeometry args={[10, 4, 6]} />
      </mesh>
      <mesh position={[0, HALL.h + 4, HALL.back - 3]} material={tile}>
        <sphereGeometry args={[4.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* The arches: dark doorways under a horseshoe of green tiles */}
      {arches.map((a, i) => (
        <group key={i} position={a.p} rotation={[0, a.ry, 0]}>
          <mesh position={[0, 3.2, 0.06]} material={dark}>
            <planeGeometry args={[ARCH * 1.3, 6.4]} />
          </mesh>
          <mesh position={[0, 6.6, 0.1]} material={tile}>
            <torusGeometry args={[ARCH * 0.7, 0.35, 6, 12, Math.PI]} />
          </mesh>
        </group>
      ))}
      {/* The courtyard: its zellige, the galleries round it, the fountain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, (HALL.front + COURT.front) / 2]} material={zellige} receiveShadow>
        <planeGeometry args={[COURT.hw * 2, COURT.front - HALL.front]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (COURT.hw + 3), 4, (HALL.front + COURT.front) / 2]} material={wall} castShadow receiveShadow>
            <boxGeometry args={[6, 8, COURT.front - HALL.front]} />
          </mesh>
          <mesh position={[s * (COURT.hw + 3), 8.6, (HALL.front + COURT.front) / 2]} material={tile}>
            <boxGeometry args={[7, 1.2, COURT.front - HALL.front + 1]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.5, (HALL.front + COURT.front) / 2]} material={wall}>
        <cylinderGeometry args={[4, 4.2, 1, 8]} />
      </mesh>
      <mesh position={[0, 1.02, (HALL.front + COURT.front) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.6, 8]} />
        <meshLambertMaterial color="#4fb3d6" />
      </mesh>
      <mesh position={[0, 1.6, (HALL.front + COURT.front) / 2]} material={wall}>
        <cylinderGeometry args={[0.4, 0.6, 1.4, 8]} />
      </mesh>
      {/* The gate: a great arch in a wall of green and cream, the wall along the street either side */}
      <mesh position={[0, 6, COURT.front]} material={wall} castShadow>
        <boxGeometry args={[16, 12, 3]} />
      </mesh>
      <mesh position={[0, 4.5, COURT.front + 1.55]} material={dark}>
        <planeGeometry args={[7, 9]} />
      </mesh>
      <mesh position={[0, 9, COURT.front + 1.6]} material={tile}>
        <torusGeometry args={[3.8, 0.5, 6, 14, Math.PI]} />
      </mesh>
      <mesh position={[0, 12.6, COURT.front]} material={tile}>
        <boxGeometry args={[17, 1.2, 4]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (8 + (COURT.hw + 6 - 8) / 2), 2, COURT.front]} material={wall} castShadow>
          <boxGeometry args={[COURT.hw + 6 - 8, 4, 0.8]} />
        </mesh>
      ))}
      <Minaret wall={wall} tile={tile} dark={dark} gold={gold} />
    </group>
  )
}

/** The square minaret at the courtyard's corner: its shaft and the panels carved in it, the crenellated top, the lantern, the dome and the three golden balls. */
function Minaret({ wall, tile, dark, gold }: { wall: THREE.Material; tile: THREE.Material; dark: THREE.Material; gold: THREE.Material }) {
  const { side, h } = MINARET
  const shaft = h - 14
  return (
    <group position={[MINARET.x, 0, MINARET.z]}>
      <mesh position={[0, shaft / 2, 0]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[side, shaft, side]} />
      </mesh>
      {/* The carved panels, up each face, and the green bands */}
      {[0, 1, 2, 3].map((f) =>
        [12, 26, 40].map((y) => (
          <group key={`${f}${y}`} rotation={[0, (f * Math.PI) / 2, 0]}>
            <mesh position={[0, y, side / 2 + 0.05]} material={dark}>
              <planeGeometry args={[side * 0.4, 6]} />
            </mesh>
            <mesh position={[0, y + 3.6, side / 2 + 0.08]} material={tile}>
              <planeGeometry args={[side * 0.6, 0.6]} />
            </mesh>
          </group>
        )),
      )}
      <mesh position={[0, shaft + 0.6, 0]} material={tile}>
        <boxGeometry args={[side + 0.8, 1.2, side + 0.8]} />
      </mesh>
      {/* The merlons round the top */}
      {[...Array(16)].map((_, i) => {
        const f = Math.floor(i / 4)
        const k = (i % 4) - 1.5
        const a = (f * Math.PI) / 2
        return (
          <mesh key={i} position={[Math.sin(a) * (side / 2) + Math.cos(a) * k * 2.2, shaft + 1.8, Math.cos(a) * (side / 2) - Math.sin(a) * k * 2.2]} material={wall}>
            <boxGeometry args={[1, 1.4, 1]} />
          </mesh>
        )
      })}
      {/* The lantern on top, its green dome, the jamour of three golden balls */}
      <mesh position={[0, shaft + 5.5, 0]} material={wall} castShadow>
        <boxGeometry args={[side * 0.45, 9, side * 0.45]} />
      </mesh>
      <mesh position={[0, shaft + 10, 0]} material={tile}>
        <sphereGeometry args={[side * 0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0.9, 0.7, 0.5].map((r, i) => (
        <mesh key={i} position={[0, shaft + 12.2 + i * 1.3, 0]} material={gold}>
          <sphereGeometry args={[r, 10, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/** What a walker can't go through: the hall, the galleries, the fountain, the minaret, the gate's wall (its arch open). */
export const MOSQUE_M6_SOLID: Obstacle[] = [
  { x: 0, z: (HALL.front + HALL.back) / 2, hw: HALL.hw, hd: (HALL.front - HALL.back) / 2, rot: 0, top: HALL.h },
  { x: -(COURT.hw + 3), z: (HALL.front + COURT.front) / 2, hw: 3, hd: (COURT.front - HALL.front) / 2, rot: 0, top: 8 },
  { x: COURT.hw + 3, z: (HALL.front + COURT.front) / 2, hw: 3, hd: (COURT.front - HALL.front) / 2, rot: 0, top: 8 },
  { x: 0, z: (HALL.front + COURT.front) / 2, r: 4.4 },
  { x: MINARET.x, z: MINARET.z, hw: MINARET.side / 2, hd: MINARET.side / 2, rot: 0, top: MINARET.h },
  { x: -5.5, z: COURT.front, hw: 2.5, hd: 1.5, rot: 0, top: 12 },
  { x: 5.5, z: COURT.front, hw: 2.5, hd: 1.5, rot: 0, top: 12 },
  ...[-1, 1].map((s): Obstacle => ({ x: s * (8 + (COURT.hw + 6 - 8) / 2), z: COURT.front, hw: (COURT.hw + 6 - 8) / 2, hd: 0.4, rot: 0, top: 4 })),
]
