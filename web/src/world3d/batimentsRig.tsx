import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bevels } from './bevel'
import { patinateTree, PRESETS, reflects, roomEnv, shaftGeometry, shaftMaterial, surfaceMaterial, useBatiments, type BatTier, type PresetName, type SurfaceKind } from './batiments'

// The scene side of « bâtiments réalistes » (batiments.ts): the patina on a big place's surfaces,
// the room's fill by its preset, the sun's shafts, and the small things every real room has on its
// walls (the split air conditioner, the switch, the sockets, the ceiling lights).

/** How often the patina looks for what was added to the scene (s): the furniture, the people come later. */
const PATINA_EVERY = 1.2

/**
 * The patina on the big surfaces of the place (batiments.ts `patinate`), and from `normal` the room
 * reflected, faintly, on its big floors (their own material only: never the scene's environment,
 * which every matte material, the Sims' too, would take). Nothing while the update is shut.
 */
export function Patina({ preset = 'chaud', base = 0 }: { preset?: PresetName; base?: number }) {
  const tier = useBatiments()
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const seen = useMemo(() => new WeakSet<THREE.Object3D>(), [])
  const wait = useRef(0)
  const runs = useRef(0)
  useFrame((_, dt) => {
    // (« simple »: the textures and the light only; the patina from « normal ».)
    if (!reflects(tier)) return
    wait.current -= dt
    if (wait.current > 0) return
    // Often at first (the room comes in pieces), then now and then.
    wait.current = runs.current++ < 8 ? PATINA_EVERY : 4
    patinateTree(scene, seen, base, reflects(tier) ? roomEnv(gl) : null, PRESETS[preset].env)
  })
  return null
}

/** The room's fill light by its preset (in place of the plain one the room had). */
export function PresetFill({ preset, dark }: { preset: PresetName; dark: boolean }) {
  const p = PRESETS[preset]
  return (
    <>
      <hemisphereLight args={[p.sky, p.ground, p.i[dark ? 1 : 0]]} />
      <ambientLight intensity={p.amb[dark ? 1 : 0]} color={p.sky} />
    </>
  )
}

/** A shaft of sunlight from a window (four corners round it) down to the floor, along `dir` (towards the floor). */
export function Shaft({ quad, dir, color, strength }: { quad: [number, number, number][]; dir: THREE.Vector3; color: string; strength?: number }) {
  const geo = useMemo(() => shaftGeometry(quad, dir), [quad, dir])
  const mat = useMemo(() => shaftMaterial(color, strength), [color, strength])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame((st) => {
    mat.uniforms.time.value = st.clock.elapsedTime
  })
  return <mesh geometry={geo} material={mat} renderOrder={5} frustumCulled={false} />
}

/** A box of the room's small things (chamfered when « blocs arrondis » is open, as the rest). */
function B({ p, s, c, glow, rough }: { p: [number, number, number]; s: [number, number, number]; c: string; glow?: number; rough?: boolean }) {
  return (
    <mesh position={p} castShadow={!glow} receiveShadow>
      {bevels(...s) ? <bevelBoxGeometry args={s} /> : <boxGeometry args={s} />}
      {rough === false ? <meshStandardMaterial color={c} roughness={0.35} /> : <meshLambertMaterial color={c} emissive={glow ? c : undefined} emissiveIntensity={glow ?? 0} />}
    </mesh>
  )
}

/** The split air conditioner high on a wall (its face along +z of its frame), the white pipe going out. */
export function SplitAC({ p, r = 0, on = true }: { p: [number, number, number]; r?: number; on?: boolean }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[0, 0, 0.11]} s={[0.92, 0.3, 0.22]} c="#f4f5f2" />
      {/* the louvre and its slot */}
      <B p={[0, -0.1, 0.225]} s={[0.78, 0.035, 0.02]} c="#c9ccc8" />
      {/* the small screen, green when on */}
      <B p={[0.3, 0.04, 0.225]} s={[0.06, 0.03, 0.01]} c={on ? '#3ddc84' : '#555'} glow={on ? 0.9 : 0} />
      {/* the pipe running to the side and out */}
      <B p={[0.53, -0.05, 0.05]} s={[0.14, 0.05, 0.05]} c="#e9ebe6" />
      <B p={[0.6, -0.4, 0.05]} s={[0.05, 0.75, 0.05]} c="#e9ebe6" />
    </group>
  )
}

/** A switch and a socket by a doorway (their faces along +z of their frame). */
export function Switches({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[0, 0, 0.01]} s={[0.09, 0.09, 0.02]} c="#f1f1ec" />
      <B p={[0, 0, 0.022]} s={[0.04, 0.05, 0.01]} c="#dcdcd4" />
      <B p={[0, -0.88, 0.01]} s={[0.09, 0.09, 0.02]} c="#f1f1ec" />
      <B p={[-0.015, -0.88, 0.022]} s={[0.012, 0.025, 0.006]} c="#333" />
      <B p={[0.015, -0.88, 0.022]} s={[0.012, 0.025, 0.006]} c="#333" />
    </group>
  )
}

/** A ceiling light: a square diffuser glowing, its rim (offices, shops, clinics: the fluorescent panel). */
export function CeilingPanel({ p, c = '#f2f6ff', lit }: { p: [number, number, number]; c?: string; lit: boolean }) {
  return (
    <group position={p}>
      <B p={[0, 0.02, 0]} s={[0.66, 0.04, 0.66]} c="#e4e6e2" />
      <mesh position={[0, -0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.58, 0.58]} />
        <meshBasicMaterial color={lit ? c : '#d8dbd8'} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Whether a tier draws the props on the walls (from `normal`). */
export const moreProps = (t: BatTier) => t === 'normal' || t === 'haute'

/**
 * A big place's floor (or wall) in one of the kit's surfaces, tinted `color`, for a face of `w`×`h` m;
 * null while the update is shut (the place keeps its own). Used as `material={real ?? undefined}`.
 */
export function useRealSurface(kind: SurfaceKind, color: string, w: number, h: number) {
  const tier = useBatiments()
  const gl = useThree((s) => s.gl)
  return useMemo(() => (tier === 'off' ? null : surfaceMaterial(kind, color, tier, w, h, reflects(tier) ? roomEnv(gl) : null)), [tier, gl, kind, color, w, h])
}

/** The same as a mesh's child: the kit's material when the update is open, else `children` (the place's own). */
export function RealMat({ kind, color, w, h, children }: { kind: SurfaceKind; color: string; w: number; h: number; children: React.ReactNode }) {
  const m = useRealSurface(kind, color, w, h)
  return m ? <primitive object={m} attach="material" /> : <>{children}</>
}
