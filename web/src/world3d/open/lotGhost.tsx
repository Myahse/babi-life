import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Nav } from './nav'
import type { Resolved } from './places'
import { toLatLng, type Origin, type XZ } from './geo'
import type { LotGhost as Ghost } from '../../store/lotPlace'
import { LOT_CLIP } from './lotClip'
import { t as tr } from '../../lib/i18n'

// The lot one is about to buy (or move), drawn in the 3D world where the
// view's middle is: beside its street and facing it, as the house will stand
// (the same placement as a bought lot, places.ts resolvePlaces). Green where
// it can go, red where it can't (the water, the street, a pitch, the map's own
// buildings, a neighbour), with its corner stakes, its gate on the street side
// and a pin over it. The houses the game fills the quarters with are cleared
// for it, as for every lot.

/** As the server checks (sims/plot.go spotGap): two lots set on the map this far apart at least. */
const GAP = 30

type Props = {
  nav: Nav
  origin: Origin
  w: number
  d: number
  /** Where a lot seeded here stands (null: the quarter isn't loaded there yet). */
  resolve: (at: XZ) => Resolved | null
  /** The other lots and houses: where they stand and the ground they clear; their seeds (the spots set). */
  others: { at: XZ; r: number }[]
  seeds: XZ[]
  /** The places round it, to say where it is. */
  named: { name: string; at: XZ }[]
  onGhost: (g: Ghost) => void
}

export function LotGhost({ nav, origin, w, d, resolve, others, seeds, named, onGhost }: Props) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const group = useRef<THREE.Group>(null)
  const cursor = useRef<THREE.Mesh>(null)
  const pin = useRef<THREE.Group>(null)
  const last = useRef<{ x: number; z: number; t: number } | null>(null)
  const want = useRef<{ at: XZ; rot: number } | null>(null)
  const ok = useRef(true)
  const fill = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00b86b', transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), [])
  const edge = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00b86b' }), [])
  // Gone, nothing is hidden any more.
  useEffect(() => () => void (LOT_CLIP.on.value = 0), [])

  useFrame(({ clock, camera }, dt) => {
    if (!controls) return
    const t = clock.elapsedTime
    const [x, z] = [controls.target.x, controls.target.z]
    // Looked at again when the view moved, a few times a second.
    const l = last.current
    if (!l || ((Math.abs(l.x - x) > 0.4 || Math.abs(l.z - z) > 0.4) && t - l.t > 0.12) || t - l.t > 1) {
      last.current = { x, z, t }
      const r = resolve([x, z])
      let why = ''
      if (!r) why = tr('Le quartier se charge ici…')
      else {
        want.current = { at: r.center, rot: r.rot }
        why = check(nav, r, w, d) || (seeds.some((s) => Math.hypot(s[0] - x, s[1] - z) < GAP) || others.some((o) => Math.hypot(o.at[0] - r.center[0], o.at[1] - r.center[1]) < o.r + Math.hypot(w, d) / 2 - 3) ? tr('Ce coin est pris par un voisin : déplace-toi un peu.') : '')
      }
      let near: { name: string; m: number } | null = null
      for (const p of named) {
        const m = Math.hypot(p.at[0] - x, p.at[1] - z)
        if (m < 400 && (!near || m < near.m)) near = { name: p.name, m }
      }
      const ll = toLatLng(origin, [x, z])
      ok.current = !why
      // (The button buys where the view is: told each time.)
      onGhost({ lat: ll.lat, lng: ll.lng, why, near: near?.name ?? '' })
    }
    const g = group.current
    const goal = want.current
    if (g && goal) {
      // Glides to where it stands (a lot jumps from one side of the street to the other).
      const k = 1 - Math.exp(-12 * Math.min(dt, 0.1))
      if (!g.visible || Math.hypot(g.position.x - goal.at[0], g.position.z - goal.at[1]) > 60) g.position.set(goal.at[0], 0, goal.at[1]), (g.rotation.y = goal.rot)
      else {
        g.position.x += (goal.at[0] - g.position.x) * k
        g.position.z += (goal.at[1] - g.position.z) * k
        const dr = Math.atan2(Math.sin(goal.rot - g.rotation.y), Math.cos(goal.rot - g.rotation.y))
        g.rotation.y += dr * k
      }
      g.position.y = nav.heightAt(g.position.x, g.position.z)
      g.visible = true
      // Where it can go: what will be cleared for it (its ground, as a bought lot's) goes from under it.
      LOT_CLIP.on.value = ok.current ? 1 : 0
      LOT_CLIP.at.value.set(g.position.x, g.position.z)
      LOT_CLIP.r.value = Math.max(12, Math.hypot(w, d) / 2 + 3)
    }
    const colour = ok.current ? '#00b86b' : '#ff3d57'
    fill.color.set(colour)
    edge.color.set(colour)
    fill.opacity = 0.3 + 0.12 * Math.sin(t * 4)
    // The pin over the lot, bobbing, as big seen from high up as close.
    const far = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) / 60, 0.6, 4)
    if (pin.current) {
      pin.current.position.y = 5 * far + Math.sin(t * 3) * 0.6 * far
      pin.current.scale.setScalar(far)
      pin.current.rotation.y = t * 1.2
    }
    if (cursor.current) {
      cursor.current.position.set(x, nav.heightAt(x, z) + 0.2, z)
      cursor.current.scale.setScalar(far)
    }
  })

  const [hw, hd] = [w / 2, d / 2]
  const posts: XZ[] = [
    [-hw, -hd],
    [hw, -hd],
    [-hw, hd],
    [hw, hd],
  ]
  return (
    <>
      <group ref={group} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} material={fill} renderOrder={5}>
          <planeGeometry args={[w, d]} />
        </mesh>
        {/* Its edges, and the corner stakes */}
        {[
          [0, -hd, w, 0.35],
          [0, hd, w, 0.35],
          [-hw, 0, 0.35, d],
          [hw, 0, 0.35, d],
        ].map(([px, pz, sx, sz], i) => (
          <mesh key={i} position={[px, 0.15, pz]} material={edge}>
            <boxGeometry args={[sx, 0.3, sz]} />
          </mesh>
        ))}
        {posts.map(([px, pz], i) => (
          <group key={i} position={[px, 0, pz]}>
            <mesh position={[0, 0.8, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 1.6, 6]} />
              <meshLambertMaterial color="#f4efe6" />
            </mesh>
            <mesh position={[0, 1.65, 0]} material={edge}>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
            </mesh>
          </group>
        ))}
        {/* The gate, on the street side */}
        <mesh position={[0, 0.16, hd + 0.9]} rotation={[-Math.PI / 2, 0, Math.PI]} material={edge}>
          <circleGeometry args={[1.4, 3]} />
        </mesh>
        <group ref={pin}>
          <mesh position={[0, 1.1, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.55, 2.2, 12]} />
            <meshLambertMaterial color="#ff7a00" />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshLambertMaterial color="#ff7a00" />
          </mesh>
          <mesh position={[0, 2.5, 0.75]}>
            <sphereGeometry args={[0.42, 12, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      </group>
      {/* The view's middle: where the lot is looked for */}
      <mesh ref={cursor} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
        <ringGeometry args={[0.9, 1.25, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </>
  )
}

/** What's in the way of a lot standing there, said for the player ('' if nothing). */
function check(nav: Nav, r: Resolved, w: number, d: number) {
  const [c, s] = [Math.cos(r.rot), Math.sin(r.rot)]
  let road = false
  let busy = false
  let house = false
  // Over the lot, every two metres, its edges just inside.
  const us = steps(w / 2 - 0.6)
  const vs = steps(d / 2 - 0.6)
  for (const u of us)
    for (const v of vs) {
      const x = r.center[0] + u * c + v * s
      const z = r.center[1] - u * s + v * c
      if (nav.inWater(x, z)) return tr("C'est dans l'eau ! Choisis la terre ferme.")
      if (nav.onStreet([x, z])) road = true
      else if (!nav.openGround(x, z)) busy = true
      else if (nav.inRealBuilding(x, z)) house = true
    }
  if (road) return tr('Le terrain mord sur la route : déplace-toi un peu.')
  if (busy) return tr('Il y a déjà un terrain de sport ou un commerce ici.')
  if (house) return tr('Il y a déjà des maisons ici : trouve un coin libre.')
  return ''
}

const steps = (h: number) => {
  const n = Math.max(1, Math.round((2 * h) / 2))
  return Array.from({ length: n + 1 }, (_, i) => -h + (2 * h * i) / n)
}
