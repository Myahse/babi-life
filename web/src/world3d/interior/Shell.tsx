import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// The room around the furniture, like a cutaway in the Sims: a textured
// floor, two full walls at the back (with real window openings the sun comes
// through, a skirting board and a painted lower band), and the two front walls
// cut low so the camera sees in, with the doorway in the front one. Pixel
// textures, crisp, like the streets outside.

export const ROOM = { W: 12, D: 9, H: 3.2, T: 0.22 }

export type FloorType = 'tiles' | 'wood' | 'concrete' | 'earth' | 'dark' | 'marble'
export type Opening = { wall: 'back' | 'left'; at: number; width: number }

function pixel(paint: (px: (x: number, y: number, c: string) => void, r: () => number) => void, seed: number, repeat: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const g = c.getContext('2d')!
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  paint((x, y, col) => ((g.fillStyle = col), g.fillRect(x, y, 1, 1)), r)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestMipmapNearestFilter
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const shade = (base: number, spread: number, r: () => number) => {
  const v = Math.max(0, Math.min(255, Math.round(base + (r() - 0.5) * spread)))
  return `rgb(${v},${v},${v})`
}

/** Light textures, tinted by the room's own colours. */
function useTextures() {
  return useMemo(
    () => ({
      // Carrelage: two tiles a metre, grout lines.
      tiles: pixel((px, r) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, x % 8 === 0 || y % 8 === 0 ? '#9a9a9a' : shade(238, 14, r))
      }, 3, 1),
      wood: pixel((px, r) => {
        for (let y = 0; y < 16; y++) {
          const plank = Math.floor(y / 4)
          for (let x = 0; x < 16; x++) px(x, y, y % 4 === 0 || (x + plank * 5) % 16 === 0 ? '#8a8a8a' : shade(215 - plank * 6, 18, r))
        }
      }, 5, 1),
      concrete: pixel((px, r) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, shade(220, 22, r))
      }, 7, 1),
      earth: pixel((px, r) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, r() < 0.08 ? '#b0b0b0' : shade(205, 30, r))
      }, 9, 1),
      // Plaster on the walls, a metre a tile.
      plaster: pixel((px, r) => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, shade(240, 10, r))
      }, 11, 1),
    }),
    [],
  )
}

const FLOOR_REPEAT: Record<FloorType, keyof ReturnType<typeof useTextures>> = { tiles: 'tiles', marble: 'tiles', wood: 'wood', concrete: 'concrete', earth: 'earth', dark: 'tiles' }

function Slab({ p, s, c, map, repeat }: { p: [number, number, number]; s: [number, number, number]; c: string; map?: THREE.Texture; repeat?: [number, number] }) {
  const tex = useMemo(() => {
    if (!map || !repeat) return map
    const t = map.clone()
    t.repeat.set(repeat[0], repeat[1])
    t.needsUpdate = true
    return t
  }, [map, repeat?.[0], repeat?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} map={tex} />
    </mesh>
  )
}

/** A wall along X (back) or Z (left) from a to b, with window openings cut in it. */
function Wall({ side, from, to, height, color, lower, map, openings, night }: { side: 'back' | 'left'; from: number; to: number; height: number; color: string; lower: string; map: THREE.Texture; openings: Opening[]; night: boolean }) {
  const { W, D, T } = ROOM
  const at = (u: number, y: number, len: number, h: number, key: string, c: string) => {
    const p: [number, number, number] = side === 'back' ? [u, y, -D / 2] : [-W / 2, y, u]
    const s: [number, number, number] = side === 'back' ? [len, h, T] : [T, h, len]
    return <Slab key={key} p={p} s={s} c={c} map={map} repeat={[Math.max(1, len / 1), Math.max(1, h)]} />
  }
  const SILL = 1.05
  const TOP = 2.45
  const holes = openings.filter((o) => o.wall === side).sort((a, b) => a.at - b.at)
  const parts: React.ReactNode[] = []
  let u = from
  for (const o of holes) {
    const [a, b] = [o.at - o.width / 2, o.at + o.width / 2]
    if (a > u) parts.push(at((u + a) / 2, height / 2, a - u, height, `s${u}`, color))
    // Under and over the window.
    parts.push(at(o.at, SILL / 2, o.width, SILL, `u${o.at}`, color))
    parts.push(at(o.at, (TOP + height) / 2, o.width, height - TOP, `o${o.at}`, color))
    parts.push(<Window key={`w${o.at}`} side={side} at={o.at} width={o.width} sill={SILL} top={TOP} night={night} />)
    u = b
  }
  if (to > u) parts.push(at((u + to) / 2, height / 2, to - u, height, `s${u}end`, color))
  // The painted lower band and the skirting board, on the room side.
  const inner = side === 'back' ? -D / 2 + T / 2 + 0.01 : -W / 2 + T / 2 + 0.01
  const band = (y: number, h: number, c: string, k: string) =>
    side === 'back' ? (
      <mesh key={k} position={[(from + to) / 2, y, inner]} receiveShadow>
        <boxGeometry args={[to - from, h, 0.02]} />
        <meshLambertMaterial color={c} />
      </mesh>
    ) : (
      <mesh key={k} position={[inner, y, (from + to) / 2]} receiveShadow>
        <boxGeometry args={[0.02, h, to - from]} />
        <meshLambertMaterial color={c} />
      </mesh>
    )
  return (
    <group>
      {parts}
      {band(0.08, 0.16, '#5b4636', 'skirt')}
      {holes.length === 0 && band(0.55, 0.9, lower, 'lower')}
      {holes.length > 0 && band(0.55, 0.9, lower, 'lower')}
      {/* The cut top of the wall, darker, like the Sims */}
      {side === 'back' ? (
        <mesh position={[(from + to) / 2, height + 0.01, -D / 2]}>
          <boxGeometry args={[to - from, 0.02, T]} />
          <meshBasicMaterial color="#3a3340" />
        </mesh>
      ) : (
        <mesh position={[-W / 2, height + 0.01, (from + to) / 2]}>
          <boxGeometry args={[T, 0.02, to - from]} />
          <meshBasicMaterial color="#3a3340" />
        </mesh>
      )}
    </group>
  )
}

/** A window: frame, sill, a pane of glass (the sky outside), louvres half open. */
function Window({ side, at, width, sill, top, night }: { side: 'back' | 'left'; at: number; width: number; sill: number; top: number; night: boolean }) {
  const { W, D, T } = ROOM
  const h = top - sill
  const glass = night ? '#1b2547' : '#bfe6ff'
  return (
    <group position={side === 'back' ? [at, sill + h / 2, -D / 2] : [-W / 2, sill + h / 2, at]} rotation={[0, side === 'back' ? 0 : Math.PI / 2, 0]}>
      {/* frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (width - 0.08)) / 2, 0, 0]} castShadow>
          <boxGeometry args={[0.08, h, T + 0.04]} />
          <meshLambertMaterial color="#6b4a32" />
        </mesh>
      ))}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[width, 0.08, T + 0.04]} />
        <meshLambertMaterial color="#6b4a32" />
      </mesh>
      <mesh position={[0, -h / 2 - 0.03, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.15, 0.06, T + 0.18]} />
        <meshLambertMaterial color="#d8d2c6" />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.05, h, 0.05]} />
        <meshLambertMaterial color="#6b4a32" />
      </mesh>
      {/* the glass, seen from inside: the sky; lets the sun through (no shadow) */}
      <mesh position={[0, 0, -T / 2 + 0.01]}>
        <planeGeometry args={[width - 0.1, h - 0.1]} />
        <meshBasicMaterial color={glass} transparent opacity={0.55} />
      </mesh>
      {/* nako louvres, a few slats */}
      {[...Array(6)].map((_, k) => (
        <mesh key={k} position={[width / 4, -h / 2 + 0.15 + k * (h / 6), 0.02]} rotation={[0.9, 0, 0]}>
          <boxGeometry args={[width / 2 - 0.08, 0.12, 0.01]} />
          <meshLambertMaterial color="#eef6fb" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * The shell: floor, the two back walls with windows, the low front walls
 * with the doorway, the sun through the windows and the room's own lamps.
 */
export function Shell({ floor, floorType, wall, lower, openings, night, dark, lamps = [[-2.5, 0], [2.5, 0]], fan }: { floor: string; floorType: FloorType; wall: string; lower: string; openings: Opening[]; night: boolean; dark?: boolean; lamps?: [number, number][]; fan?: boolean }) {
  const { W, D, H, T } = ROOM
  const t = useTextures()
  const floorMap = useMemo(() => {
    const m = t[FLOOR_REPEAT[floorType]].clone()
    m.repeat.set(W, D)
    m.needsUpdate = true
    return m
  }, [t, floorType]) // eslint-disable-line react-hooks/exhaustive-deps
  const STUB = 0.55 // the cut-away front walls
  const door = 1.6
  const lit = night || dark
  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[W, 0.1, D]} />
        <meshLambertMaterial color={floor} map={floorMap} />
      </mesh>
      <Wall side="back" from={-W / 2 - T / 2} to={W / 2 + T / 2} height={H} color={wall} lower={lower} map={t.plaster} openings={openings} night={!!lit} />
      <Wall side="left" from={-D / 2} to={D / 2 + T / 2} height={H} color={wall} lower={lower} map={t.plaster} openings={openings} night={!!lit} />
      {/* Front and right walls, cut low; the doorway in the front one */}
      <Slab p={[(-W / 2 - door / 2) / 2 - T / 4, STUB / 2, D / 2]} s={[W / 2 - door / 2 + T / 2, STUB, T]} c={wall} map={t.plaster} repeat={[5, 1]} />
      <Slab p={[(W / 2 + door / 2) / 2 + T / 4, STUB / 2, D / 2]} s={[W / 2 - door / 2 + T / 2, STUB, T]} c={wall} map={t.plaster} repeat={[5, 1]} />
      <Slab p={[W / 2, STUB / 2, 0]} s={[T, STUB, D]} c={wall} map={t.plaster} repeat={[9, 1]} />
      {/* Door frame posts at the doorway */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * door) / 2, STUB / 2 + 0.05, D / 2]} castShadow>
          <boxGeometry args={[0.12, STUB + 0.1, T + 0.06]} />
          <meshLambertMaterial color="#6b4a32" />
        </mesh>
      ))}
      {/* The sun through the windows, by day */}
      {!lit && <Sunbeam />}
      {/* The room's lamps: a shade on its cord, and its light */}
      {lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, H - 0.3, z]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
            <meshBasicMaterial color="#222" />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.12, 0.32, 0.25, 12, 1, true]} />
            <meshLambertMaterial color="#f2e6c9" side={THREE.DoubleSide} emissive="#ffd28a" emissiveIntensity={lit ? 0.9 : 0.15} />
          </mesh>
          <pointLight position={[0, -0.2, 0]} intensity={lit ? 9 : 3.5} distance={9} decay={1.6} color="#ffd9a0" />
        </group>
      ))}
      {fan && <CeilingFan />}
    </group>
  )
}

/** Sunlight coming in sideways through the window openings, casting their shape on the floor. */
function Sunbeam() {
  const light = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const l = light.current
    if (l && l.target.parent === null) l.parent?.add(l.target)
  })
  return (
    <directionalLight
      ref={light}
      position={[-16, 9, -11]}
      intensity={2.2}
      color="#fff1d6"
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
      shadow-camera-near={1}
      shadow-camera-far={40}
      shadow-bias={-0.0008}
    />
  )
}

/** The ceiling fan of every Abidjan room, turning. */
function CeilingFan() {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 4
  })
  return (
    <group position={[0, ROOM.H - 0.15, 0.5]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 4]} />
        <meshBasicMaterial color="#333" />
      </mesh>
      <group ref={ref}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.1, 12]} />
          <meshLambertMaterial color="#e9ecef" />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation={[0, (k * Math.PI * 2) / 3, 0]} position={[Math.cos((k * Math.PI * 2) / 3) * 0.45, 0, -Math.sin((k * Math.PI * 2) / 3) * 0.45]}>
            <boxGeometry args={[0.8, 0.02, 0.16]} />
            <meshLambertMaterial color="#cfd4dc" />
          </mesh>
        ))}
      </group>
    </group>
  )
}
