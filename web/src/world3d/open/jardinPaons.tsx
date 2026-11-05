import { useMemo } from 'react'
import * as THREE from 'three'
import { BOX, Blocks, lettering, signMaterial } from './ruePrincesse'
import { CRANE, CROCODILE, Herd, MONKEY, OSTRICH, PEACOCK, TORTOISE, crocBrain, grazer, makeHerd } from './wildlife'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { t as tr } from '../../lib/i18n'

// L'Hôtel Le Jardin des Paons, Bouaké (the game's, the update « bouake-vivant »): like many hotels of the
// centre, a garden of animals behind the hotel. As the game draws it: the hotel's three storeys in ochre
// with their balconies, the sign, the gate on the street; behind, the lawn under the mango trees, its
// paths, and the animals: the peacocks loose on the grass, the ostriches in their paddock, the crowned
// cranes, the tortoises, the monkeys' cage, the little pond with its crocodile; the bar's paillote, the
// pool. The layout is the game's. Frame: +z the street.

const M = {
  wall: new THREE.MeshLambertMaterial({ color: '#d99a5b' }),
  trim: new THREE.MeshLambertMaterial({ color: '#f4ead8' }),
  glass: new THREE.MeshLambertMaterial({ color: '#3b5a73', emissive: '#ffd27a', emissiveIntensity: 0 }),
  roof: new THREE.MeshLambertMaterial({ color: '#8a3b22' }),
  lawn: new THREE.MeshLambertMaterial({ color: '#5f9e48', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  path: new THREE.MeshLambertMaterial({ color: '#c9a77a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  sand: new THREE.MeshLambertMaterial({ color: '#d6bd86', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  pond: new THREE.MeshLambertMaterial({ color: '#3f7a6e', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  pool: new THREE.MeshLambertMaterial({ color: '#3cb7d6', emissive: '#22b6d6', emissiveIntensity: 0 }),
  fence: new THREE.MeshLambertMaterial({ color: '#6e5640' }),
  mesh: new THREE.MeshLambertMaterial({ color: '#3d4a3f', transparent: true, opacity: 0.45 }),
  thatch: new THREE.MeshLambertMaterial({ color: '#c79a52' }),
  colored: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  trunk: new THREE.MeshLambertMaterial({ color: '#6e5640' }),
}
const CONE = new THREE.ConeGeometry(1, 1, 10)

/** A paddock's fence: posts every 1.6 m and two rails, round a rectangle (centre, size), open at `gap` (+z side) if asked. */
function paddock(cx: number, cz: number, w: number, d: number) {
  const out: { p: [number, number, number]; s: [number, number, number] }[] = []
  for (const [x0, z0, x1, z1] of [[-w / 2, -d / 2, w / 2, -d / 2], [w / 2, -d / 2, w / 2, d / 2], [w / 2, d / 2, -w / 2, d / 2], [-w / 2, d / 2, -w / 2, -d / 2]]) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    for (let k = 0; k <= len; k += 1.6) {
      const t = k / len
      out.push({ p: [cx + x0 + (x1 - x0) * t, 0.6, cz + z0 + (z1 - z0) * t], s: [0.12, 1.2, 0.12] })
    }
    for (const y of [0.5, 1.05]) out.push({ p: [cx + (x0 + x1) / 2, y, cz + (z0 + z1) / 2], s: [Math.abs(x1 - x0) + 0.1, 0.07, Math.abs(z1 - z0) + 0.1] })
  }
  return out
}

export function JardinPaons({ night }: { night: boolean }) {
  M.glass.emissiveIntensity = night ? 0.6 : 0
  M.pool.emissiveIntensity = night ? 0.5 : 0
  const sign = useMemo(() => {
    const l = lettering(tr('HÔTEL LE JARDIN DES PAONS'), '#1f5b3a', '#fff6d6', '#e8c35a')
    return { m: signMaterial(l.t), aspect: l.aspect }
  }, [])
  sign.m.emissiveIntensity = night ? 0.8 : 0
  const fences = useMemo(() => [...paddock(-16, -14, 14, 12), ...paddock(14, -16, 12, 10)], [])
  const trees = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }[] = []
    const trunks: { p: [number, number, number]; s: [number, number, number] }[] = []
    const r = rng('jardin-paons-arbres')
    for (const [x, z] of [[-30, 0], [-26, -28], [28, 0], [30, -28], [0, -32], [-6, -6]] as const) {
      const h = 5 + r() * 2
      trunks.push({ p: [x, h / 2, z], s: [0.7, h, 0.7] })
      out.push({ p: [x, h + 0.8, z], s: [9, 3, 9], ry: r(), c: '#2f7a35' }, { p: [x + 0.5, h + 2.4, z], s: [6, 2, 6], ry: r(), c: '#3b8a3e' })
    }
    return { out, trunks }
  }, [])
  const animals = useMemo(() => {
    const peac = { x: 0, z: -4 }
    const ost = { x: -16, z: -14 }
    const cra = { x: 14, z: -16 }
    const tor = { x: 2, z: -20 }
    const mon = { x: -28, z: 14 }
    const inside = (c: { x: number; z: number }, w: number, d: number) => (x: number, z: number) => Math.abs(x - c.x) < w / 2 - 1 && Math.abs(z - c.z) < d / 2 - 1
    return {
      peacocks: { a: makeHerd('paons', 5, [peac.x, peac.z], 6), b: grazer(peac, 10, (x, z) => Math.abs(x) < 28 && z < 6 && z > -34 && !inside(ost, 16, 14)(x, z) && !inside(cra, 14, 12)(x, z)) },
      ostriches: { a: makeHerd('autruches', 3, [ost.x, ost.z], 3), b: grazer(ost, 4, inside(ost, 14, 12)) },
      cranes: { a: makeHerd('grues', 4, [cra.x, cra.z], 3), b: grazer(cra, 3.5, inside(cra, 12, 10)) },
      tortoises: { a: makeHerd('tortues', 4, [tor.x, tor.z], 3, [0.9, 1.3]), b: grazer(tor, 3) },
      monkeys: { a: makeHerd('singes-cage', 3, [mon.x, mon.z], 1.5), b: grazer(mon, 2.5, inside(mon, 8, 7)) },
      croc: { a: makeHerd('croco-mare', 1, [22, 8], 0.5, [0.75, 0.75]), b: crocBrain([[20, 6], [24, 6.5]], () => [22, 11]) },
    }
  }, [])
  const people = useMemo(() => {
    const r = rng('jardin-paons-gens')
    return [
      [-9, -7, 2.4, 'film'], [-10, -9, 2.2, 'touch'], [8, -10, -2.2, 'phone'], [9, -12, -2.4, 'cheer'], [-26, 9, 0, 'film'], [3, 12, Math.PI, 'talk'], [20, 16, 0, 'drink'],
    ].map(([x, z, ry, pose], i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { p: [x as number, 0, z as number] as [number, number, number], ry: ry as number, pose: pose as 'film', gender, look: randomLook(gender, r), seed: r() * 100, kid: i % 3 === 1 }
    })
  }, [])

  return (
    <group>
      {/* The hotel along the street: three storeys, the balconies, the roof, the sign over the door */}
      <group position={[0, 0, 22]}>
        <mesh geometry={BOX} position={[0, 5.4, 0]} scale={[34, 10.8, 10]} material={M.wall} castShadow receiveShadow />
        {[0, 1, 2].map((f) => (
          <group key={f}>
            <mesh geometry={BOX} position={[0, 2 + f * 3.6, 5.05]} scale={[30, 1.6, 0.1]} material={M.glass} />
            <mesh geometry={BOX} position={[0, 0.9 + f * 3.6 + 3.6, 5.6]} scale={[32, 0.2, 1.2]} material={M.trim} />
          </group>
        ))}
        <mesh geometry={BOX} position={[0, 11.2, 0]} scale={[35, 0.8, 11]} material={M.roof} castShadow />
        <mesh position={[0, 3.3, 5.7]} material={sign.m}>
          <planeGeometry args={[12, 12 / sign.aspect]} />
        </mesh>
        <mesh geometry={BOX} position={[0, 1.2, 5.12]} scale={[3, 2.4, 0.12]} material={M.trim} />
      </group>
      {/* The garden behind */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -8]} material={M.lawn} receiveShadow>
        <planeGeometry args={[70, 52]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 2]} material={M.path}>
        <planeGeometry args={[60, 2.4]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -12]} material={M.path}>
        <planeGeometry args={[2.4, 30]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-16, 0.055, -14]} material={M.sand}>
        <planeGeometry args={[14, 12]} />
      </mesh>
      <Blocks at={fences} material={M.fence} />
      {/* The monkeys' cage: its frame and its mesh, a branch inside */}
      <group position={[-28, 0, 14]}>
        {[-4, 4].flatMap((x) => [-3.5, 3.5].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 2, z]} scale={[0.15, 4, 0.15]} material={M.fence} />))}
        <mesh geometry={BOX} position={[0, 2, 0]} scale={[8, 4, 7]} material={M.mesh} />
        <mesh geometry={BOX} position={[0, 2.2, 0]} scale={[6, 0.25, 0.25]} rotation={[0, 0.4, 0.2]} material={M.trunk} />
      </group>
      {/* The pond with its crocodile, behind a low wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[22, 0.06, 11]} material={M.pond}>
        <circleGeometry args={[4.5, 20]} />
      </mesh>
      <Blocks at={[...Array(20)].map((_, i) => ({ p: [22 + Math.cos((i / 20) * Math.PI * 2) * 6, 0.45, 9 + Math.sin((i / 20) * Math.PI * 2) * 5.5] as [number, number, number], s: [1.9, 0.9, 0.4] as [number, number, number], ry: -(i / 20) * Math.PI * 2 + Math.PI / 2 }))} material={M.trim} />
      {/* The bar's paillote and the pool */}
      <group position={[20, 0, -30]}>
        {[-2.5, 2.5].flatMap((x) => [-2.5, 2.5].map((z) => <mesh key={`${x}${z}`} geometry={BOX} position={[x, 1.4, z]} scale={[0.2, 2.8, 0.2]} material={M.fence} />))}
        <mesh geometry={CONE} position={[0, 3.6, 0]} scale={[4.6, 2, 4.6]} material={M.thatch} castShadow />
        <mesh geometry={BOX} position={[0, 0.55, 0]} scale={[3, 1.1, 1]} material={M.fence} />
      </group>
      <mesh geometry={BOX} position={[-14, 0.08, -32]} scale={[12, 0.12, 6]} material={M.pool} />
      <Blocks at={trees.trunks} material={M.trunk} />
      <Blocks at={trees.out} material={M.colored} color />
      <Herd species={PEACOCK} animals={animals.peacocks.a} brain={animals.peacocks.b} far={140} />
      <Herd species={OSTRICH} animals={animals.ostriches.a} brain={animals.ostriches.b} far={140} />
      <Herd species={CRANE} animals={animals.cranes.a} brain={animals.cranes.b} far={120} />
      <Herd species={TORTOISE} animals={animals.tortoises.a} brain={animals.tortoises.b} far={80} />
      <Herd species={MONKEY} animals={animals.monkeys.a} brain={animals.monkeys.b} far={100} />
      <Herd species={CROCODILE} animals={animals.croc.a} brain={animals.croc.b} far={100} />
      <NoShadows>
        {people.map((p, i) => (
          <group key={i} position={p.p} rotation={[0, p.ry, 0]} scale={p.kid ? 0.7 : 1}>
            <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}
