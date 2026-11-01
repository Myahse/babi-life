import { useEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Bicycle } from '../vehicles'
import { setBikeStation, useBikeStation } from '../bikeShare'
import { Solid } from '../Solid'
import type { XZ } from './geo'
import type { Nav } from './nav'

// The commune's Vélo Babi station (world/bikes.go), at its heart: on the pavement of the street nearest the
// commune's middle, a rack of orange bikes (as many as are in it now) and its totem. The screen offers to
// hire one when the Sim is beside it (components/BikeShare.tsx).

const ORANGE = '#ff7a00'
const rackMat = new THREE.MeshLambertMaterial({ color: '#3a3f47' })
const totemMat = new THREE.MeshLambertMaterial({ color: ORANGE })
const panelMat = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const BOX = new THREE.BoxGeometry(1, 1, 1)
const SLOTS = 10

export function BikeStation({ nav, centre, dock }: { nav: Nav; centre: XZ; dock: string }) {
  // On the pavement beside the street nearest the commune's middle, along it.
  const spot = useMemo(() => {
    const n = nav.nearest(centre, 400, 7) ?? nav.nearest(centre, 400)
    if (!n) return null
    const e = nav.edges[n.edge]
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const rot = Math.atan2(b[0] - a[0], b[1] - a[1])
    for (const side of [1, -1]) {
      const off = e.width / 2 + 2.4
      const at: XZ = [n.at[0] + Math.cos(rot) * off * side, n.at[1] - Math.sin(rot) * off * side]
      if (nav.walkable(at[0], at[1])) return { at, rot: rot + (side > 0 ? 0 : Math.PI) }
    }
    return null
  }, [nav, centre])
  useEffect(() => {
    setBikeStation({ at: spot?.at ?? null, dock })
    if (import.meta.env.DEV) Object.assign(globalThis, { __bikeStation: spot })
    return () => setBikeStation({ at: null, dock: null })
  }, [spot, dock])
  const { free } = useBikeStation()
  if (!spot) return null
  return (
    <group position={[spot.at[0], nav.heightAt(spot.at[0], spot.at[1]), spot.at[1]]} rotation={[0, spot.rot, 0]}>
      <Solid parts>
        {/* The rack: a low rail along the pavement */}
        <mesh geometry={BOX} material={rackMat} position={[0, 0.35, 0]} scale={[0.12, 0.7, SLOTS * 0.75]} />
        {/* The totem, its panel */}
        <mesh geometry={BOX} material={totemMat} position={[0, 1.1, (SLOTS * 0.75) / 2 + 0.6]} scale={[0.5, 2.2, 0.35]} />
      </Solid>
      <mesh geometry={BOX} material={panelMat} position={[0.26, 1.5, (SLOTS * 0.75) / 2 + 0.6]} scale={[0.02, 0.7, 0.28]} />
      {[...Array(Math.min(SLOTS, free))].map((_, i) => (
        <group key={i} position={[0.55, 0, (i - (SLOTS - 1) / 2) * 0.75]} rotation={[0, Math.PI / 2, 0]}>
          <Bicycle color={ORANGE} />
        </group>
      ))}
      <Html position={[0, 2.7, (SLOTS * 0.75) / 2 + 0.6]} center zIndexRange={[10, 0]} distanceFactor={30}>
        <div className="rounded-md bg-[#ff7a00] px-2 py-0.5 text-[12px] font-extrabold whitespace-nowrap text-white shadow">🚲 Vélo Babi · {free}</div>
      </Html>
    </group>
  )
}
