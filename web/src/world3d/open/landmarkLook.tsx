import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { patinateTree, reflects, skyEnv, useBatiments, type Outside } from '../batiments'

// « Bâtiments réalistes » on the named landmarks (world3d/batiments.ts): the Pyramide, the Tour F,
// the cathedral, the basilica, the Hôtel Ivoire, the stadium, the Parc des expositions, the airport,
// the mosques… Each is drawn its own way (landmarks.tsx and its files); this goes over what they
// draw, once each new piece comes in:
// - their concrete and stone weather like the concept's walls (a mottle, rain streaks down them);
// - their glass becomes glass: smooth and a little metallic, it reflects the sky the street lights
//   them with (lumière réaliste's environment, from `normal`), keeping its colour, its pattern and
//   its lit windows at night (copied each frame from the landmark's own material);
// - at night their facades are floodlit from their foot, warm, except in a power cut (délestage).

/** The landmarks done so (their ids in landmarks.tsx). */
export const NAMED = new Set([
  'plateau-pyramide',
  'plateau-tour-f',
  'plateau-cathedrale',
  'yakro-basilique',
  'cocody-hotel-ivoire',
  'plateau-stade',
  'portbouet-parc-expo',
  'pb-aeroport',
  'koumassi-tour-ivoire',
  'treich-mosquee-m6',
  'yakro-mosquee',
  'korhogo-mosquee',
  'daloa-mosquee',
  'sp-cathedrale',
  'daloa-cathedrale',
  'plateau-presidence',
  'plateau-tribunal',
  'plateau-poulman',
  'plateau-noum',
  'marcory-azale',
  'pb-rabisson',
  'cocody-rti',
])

const hsl = { h: 0, s: 0, l: 0 }
/** Glass by its look: a facade with lit windows at night, or a blue-green tint not too light, or see-through and bluish. */
function glassy(m: THREE.Material) {
  if (!(m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshPhongMaterial)) return false
  if (m.emissiveMap && m.map) return true
  m.color.getHSL(hsl)
  const blue = hsl.h > 0.45 && hsl.h < 0.72 && hsl.s > 0.12
  if (m.transparent && m.opacity < 0.85 && blue) return true
  return blue && hsl.l < 0.5 && hsl.l > 0.08
}

const box = new THREE.Box3()
const size = new THREE.Vector3()
/** A pane or a facade, not a car or a lamp parked by it (those have lit maps too): one mesh, of a building's size. */
function big(mesh: THREE.Mesh) {
  if ((mesh as THREE.InstancedMesh).isInstancedMesh || !mesh.geometry) return false
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
  box.copy(mesh.geometry.boundingBox!).getSize(size).multiply(mesh.scale)
  return Math.max(size.x, size.y, size.z) >= 3
}

/** Glass made physical: its colour, pattern and night windows kept. */
function toGlass(m: THREE.MeshLambertMaterial | THREE.MeshPhongMaterial) {
  const facade = !!m.emissiveMap
  return new THREE.MeshStandardMaterial({
    color: m.color,
    map: m.map,
    emissive: m.emissive,
    emissiveMap: m.emissiveMap,
    emissiveIntensity: m.emissiveIntensity,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
    // A facade texture holds its concrete bands too: less of a mirror than a pane.
    roughness: facade ? 0.3 : 0.12,
    metalness: facade ? 0.35 : 0.55,
    envMapIntensity: facade ? 1 : 1.3,
  })
}

const FLOOD = new THREE.Color('#ffc98a')

/** Wraps a landmark: its look made real while the update is open (nothing changes while it's shut). */
export function LandmarkLook({ id, night, cut, children }: { id: string; night: boolean; /** In a power cut (délestage): no floodlights. */ cut?: boolean; children: React.ReactNode }) {
  const tier = useBatiments()
  // (From « normal »: on the small phones the landmarks stay as they are.)
  const on = reflects(tier) && NAMED.has(id)
  const g = useRef<THREE.Group>(null)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const state = useMemo(() => ({ seen: new WeakSet<THREE.Object3D>(), swapped: new Map<THREE.Material, THREE.MeshStandardMaterial>(), wait: 0, runs: 0 }), [])
  const outside = useMemo<Outside>(() => ({ flood: { value: 0 }, color: FLOOD }), [])
  useFrame((_, dt) => {
    if (!on || !g.current) return
    outside.flood.value = night && !cut ? 1 : 0
    // The landmark's own materials change (the night's windows): their glass follows.
    for (const [from, to] of state.swapped) {
      to.emissiveIntensity = (from as THREE.MeshLambertMaterial).emissiveIntensity
      to.emissive.copy((from as THREE.MeshLambertMaterial).emissive)
      to.color.copy((from as THREE.MeshLambertMaterial).color)
    }
    state.wait -= dt
    if (state.wait > 0) return
    // Often while its pieces load (lazy models), then now and then.
    state.wait = state.runs++ < 10 ? 1.5 : 6
    // The sky lumière réaliste lights the street with, else a plain one (batiments.ts skyEnv).
    const glass = reflects(tier)
    const env = scene.environment ? null : skyEnv(gl)
    g.current.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || state.seen.has(o) || Array.isArray(mesh.material)) return
      const m = mesh.material
      if (glass && big(mesh) && !m.vertexColors && glassy(m)) {
        let to = state.swapped.get(m)
        if (!to) {
          to = toGlass(m as THREE.MeshLambertMaterial)
          // (Its own sky only where the scene has none: the scene's follows the hour.)
          if (env) to.envMap = env
          state.swapped.set(m, to)
        }
        mesh.material = to
      }
    })
    patinateTree(g.current, state.seen, 0, null, 1, outside)
  })
  return <group ref={g}>{children}</group>
}
