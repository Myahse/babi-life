import { useMemo } from 'react'
import * as THREE from 'three'
import { BOX, Blocks, PLANE, lettering, signMaterial } from './ruePrincesse'
import type { At } from './shoreline'

// La Forêt du Banco: the way into the national park, on the autoroute du Nord (the forest itself is
// the map's, all round). As the game draws it: the laterite track going in under a wooden gateway with
// the park's name, the rangers' welcome hut, the board with the trails, the wooden fences, a few giant
// fromagers (kapok trees) with their buttress roots, benches, and by the way in the fanicos' corner:
// the Banco's washermen, the clothes spread to dry on the grass and on lines, the basins and the
// barrels. The layout is the game's.
//
// The landmark's frame: +z toward the road (the way in), the forest behind (−z).

const M = {
  laterite: new THREE.MeshLambertMaterial({ color: '#b5723f', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  grass: new THREE.MeshLambertMaterial({ color: '#5e8f3a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  log: new THREE.MeshLambertMaterial({ color: '#6b4a2e' }),
  plank: new THREE.MeshLambertMaterial({ color: '#8a6440' }),
  hut: new THREE.MeshLambertMaterial({ color: '#e9dcc4' }),
  green: new THREE.MeshLambertMaterial({ color: '#2b8a3e' }),
  roof: new THREE.MeshLambertMaterial({ color: '#7a5a3a' }),
  bark: new THREE.MeshLambertMaterial({ color: '#9c8f7f' }),
  crown: new THREE.MeshLambertMaterial({ color: '#2f6b2a' }),
  crownLight: new THREE.MeshLambertMaterial({ color: '#3f8a35' }),
  basin: new THREE.MeshLambertMaterial({ color: '#1c7ed6' }),
  barrel: new THREE.MeshLambertMaterial({ color: '#c92a2a' }),
  line: new THREE.MeshLambertMaterial({ color: '#343a40' }),
  map: new THREE.MeshLambertMaterial({ color: '#40c057' }),
  board: new THREE.MeshLambertMaterial({ color: '#f1f3f5' }),
}
const CLOTHES = ['#e03131', '#1c7ed6', '#fcc419', '#ffffff', '#ff8200', '#9c36b5', '#12b886', '#f783ac', '#495057']
const DISC = new THREE.CylinderGeometry(1, 1, 1, 12)
const ICO = new THREE.IcosahedronGeometry(1, 0)

/** The fromagers: where, how tall. */
const GIANTS: [number, number, number][] = [
  [-16, -14, 26],
  [17, -18, 30],
  [-4, -30, 28],
  [24, 2, 22],
]

export function ForetBanco({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const gate = lettering('PARC NATIONAL DU BANCO', '#1b4d2b', '#ffe8a3', '#ffe8a3')
    const hut = lettering('ACCUEIL · GARDES DU PARC', '#ffffff', '#1b4d2b', '#1b4d2b')
    const trails = lettering('SENTIERS · RIVIÈRE BANCO', '#1b4d2b', '#ffffff', '#ffffff')
    const fanico = lettering('FANICOS DU BANCO', '#ffffff', '#1c7ed6', '#1c7ed6')
    return {
      gate: signMaterial(gate.t),
      gateAspect: gate.aspect,
      hut: signMaterial(hut.t),
      hutAspect: hut.aspect,
      trails: signMaterial(trails.t),
      trailsAspect: trails.aspect,
      fanico: signMaterial(fanico.t),
      fanicoAspect: fanico.aspect,
      clothes: CLOTHES.map((c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })),
    }
  }, [])
  mats.gate.emissiveIntensity = night ? 0.6 : 0

  // The fences either side of the gateway: posts and two rails.
  const fence = useMemo(() => {
    const out: At[] = []
    for (const s of [-1, 1]) {
      for (let x = 6; x <= 30; x += 3) out.push({ p: [s * x, 0.6, 6], s: [0.18, 1.2, 0.18] })
      out.push({ p: [s * 18, 0.9, 6], s: [24, 0.1, 0.1] }, { p: [s * 18, 0.45, 6], s: [24, 0.1, 0.1] })
    }
    return out
  }, [])

  // The fanicos' clothes spread on the grass, and on their lines between posts.
  const laundry = useMemo(() => {
    const flat: { p: [number, number, number]; s: [number, number]; ry: number; c: number }[] = []
    for (let i = 0; i < 26; i++) {
      const x = -26 + (i % 6) * 2.4 + ((i * 7) % 3) * 0.3
      const z = 13 + Math.floor(i / 6) * 2.6
      flat.push({ p: [x, 0.05, z], s: [1.4 + (i % 3) * 0.3, 1 + (i % 2) * 0.5], ry: ((i * 37) % 10) * 0.08, c: i % CLOTHES.length })
    }
    const hung: { p: [number, number, number]; s: [number, number]; c: number }[] = []
    for (let l = 0; l < 3; l++)
      for (let k = 0; k < 7; k++) hung.push({ p: [-27 + k * 1.8, 1.35, 25 + l * 2.2], s: [1.2, 0.9 + (k % 2) * 0.3], c: (k + l * 3) % CLOTHES.length })
    const posts: At[] = []
    for (let l = 0; l < 3; l++) posts.push({ p: [-28.2, 0.9, 25 + l * 2.2], s: [0.12, 1.8, 0.12] }, { p: [-15.2, 0.9, 25 + l * 2.2], s: [0.12, 1.8, 0.12] }, { p: [-21.7, 1.78, 25 + l * 2.2], s: [13, 0.03, 0.03] })
    return { flat, hung, posts }
  }, [])

  return (
    <group>
      {/* The ground: the grass of the clearing, the laterite square and the track going into the forest */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 4]} scale={[64, 56, 1]} geometry={PLANE} material={M.grass} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 16]} scale={[14, 18, 1]} geometry={PLANE} material={M.laterite} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -14]} scale={[5.5, 44, 1]} geometry={PLANE} material={M.laterite} receiveShadow />

      {/* The gateway: two great logs, the beam, the park's name */}
      <group position={[0, 0, 7]}>
        {[-4, 4].map((x) => (
          <mesh key={x} position={[x, 2.6, 0]} scale={[0.9, 5.2, 0.9]} geometry={DISC} material={M.log} castShadow />
        ))}
        <mesh position={[0, 5.3, 0]} scale={[10.5, 0.7, 0.7]} geometry={BOX} material={M.log} castShadow />
        <mesh position={[0, 4.4, 0]} scale={[8.6, 1.1, 0.3]} geometry={BOX} material={M.plank} />
        {[1, -1].map((s) => (
          <mesh key={s} position={[0, 4.4, s * 0.16]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[Math.min(8.2, 0.85 * mats.gateAspect), 0.85, 1]} geometry={PLANE} material={mats.gate} />
        ))}
      </group>
      <Blocks at={fence} material={M.plank} />

      {/* The rangers' welcome hut, its veranda, its sign */}
      <group position={[11, 0, 13]} rotation={[0, -0.3, 0]}>
        <mesh position={[0, 1.4, 0]} scale={[5, 2.8, 3.6]} geometry={BOX} material={M.hut} castShadow receiveShadow />
        <mesh position={[0, 0.5, 0]} scale={[5.04, 1, 3.64]} geometry={BOX} material={M.green} />
        <mesh position={[0, 3.1, 0.4]} rotation={[0.12, 0, 0]} scale={[6.2, 0.2, 5.2]} geometry={BOX} material={M.roof} castShadow />
        <mesh position={[0, 2.2, 1.83]} scale={[Math.min(4.6, 0.45 * mats.hutAspect), 0.45, 1]} geometry={PLANE} material={mats.hut} />
        {[-2.6, 2.6].map((x) => (
          <mesh key={x} position={[x, 1.4, 2.6]} scale={[0.15, 2.8, 0.15]} geometry={BOX} material={M.log} />
        ))}
        <mesh position={[0, 0.45, 2.4]} scale={[1.8, 0.08, 0.45]} geometry={BOX} material={M.plank} />
      </group>

      {/* The board with the trails */}
      <group position={[-7, 0, 12]} rotation={[0, 0.25, 0]}>
        {[-1.3, 1.3].map((x) => (
          <mesh key={x} position={[x, 1.2, 0]} scale={[0.15, 2.4, 0.15]} geometry={BOX} material={M.log} />
        ))}
        <mesh position={[0, 1.7, 0]} scale={[2.9, 1.6, 0.1]} geometry={BOX} material={M.board} />
        <mesh position={[-0.2, 1.62, 0.06]} scale={[1.9, 1.05, 0.02]} geometry={BOX} material={M.map} />
        <mesh position={[0.4, 1.5, 0.08]} rotation={[0, 0, 0.5]} scale={[1.6, 0.06, 0.02]} geometry={BOX} material={M.basin} />
        <mesh position={[0, 2.7, 0.07]} scale={[Math.min(2.9, 0.32 * mats.trailsAspect), 0.32, 1]} geometry={PLANE} material={mats.trails} />
      </group>

      {/* Benches along the square */}
      {[[-5, 21], [5, 21], [-5, 15.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <mesh position={[0, 0.45, 0]} scale={[2, 0.12, 0.5]} geometry={BOX} material={M.plank} />
          {[-0.8, 0.8].map((s) => (
            <mesh key={s} position={[s, 0.22, 0]} scale={[0.35, 0.44, 0.45]} geometry={BOX} material={M.log} />
          ))}
        </group>
      ))}

      {/* The fromagers: a pale trunk, the buttress roots, a wide crown high up */}
      {GIANTS.map(([x, z, h], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 1.1, 0]}>
          <mesh position={[0, h / 2, 0]} scale={[1.1, h, 1.1]} geometry={DISC} material={M.bark} castShadow />
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.26) * 1.4, 1.4, Math.sin(k * 1.26) * 1.4]} rotation={[0, -k * 1.26, 0]} scale={[2.4, 2.8, 0.3]} geometry={BOX} material={M.bark} castShadow />
          ))}
          <mesh position={[0, h, 0]} scale={[8, 3, 8]} geometry={ICO} material={M.crown} castShadow />
          <mesh position={[3, h - 2, 1]} scale={[5, 2.4, 5]} geometry={ICO} material={M.crownLight} castShadow />
          <mesh position={[-3, h - 1.5, -2]} scale={[5, 2.4, 5]} geometry={ICO} material={M.crownLight} castShadow />
        </group>
      ))}

      {/* The fanicos' corner: the clothes spread to dry, the lines, the basins, the barrels, the sign */}
      {laundry.flat.map((c, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, c.ry]} position={c.p} scale={[c.s[0], c.s[1], 1]} geometry={PLANE} material={mats.clothes[c.c]} />
      ))}
      {laundry.hung.map((c, i) => (
        <mesh key={i} position={c.p} scale={[c.s[0], c.s[1], 1]} geometry={PLANE} material={mats.clothes[c.c]} />
      ))}
      <Blocks at={laundry.posts} material={M.line} />
      {[[-12.5, 14], [-11, 15.8], [-12.8, 17.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]} scale={[0.7, 0.6, 0.7]} geometry={DISC} material={M.basin} castShadow />
      ))}
      {[[-10.5, 19.5], [-9.6, 20.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.55, z]} scale={[0.4, 1.1, 0.4]} geometry={DISC} material={M.barrel} castShadow />
      ))}
      <group position={[-21, 0, 31]}>
        <mesh position={[0, 1, 0]} scale={[0.12, 2, 0.12]} geometry={BOX} material={M.log} />
        <mesh position={[0, 1.9, 0.08]} scale={[Math.min(3, 0.35 * mats.fanicoAspect), 0.35, 1]} geometry={PLANE} material={mats.fanico} />
      </group>
    </group>
  )
}
