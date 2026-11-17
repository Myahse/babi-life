import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { XZ } from '../world3d/open/geo'
import type { ChunkData } from '../world3d/open/tiles'
import { buildChunk } from '../world3d/open/meshes'
import { blockRing } from '../world3d/open/voxel'
import { makeWorldMaterials, useFacadeLook } from '../world3d/open/OpenWorld'
import { facadesBuild, facadesTier } from '../world3d/open/facades'
import { LumiereRig, Fill } from '../world3d/open/lumiereRig'
import { daylight, setDaylight } from '../world3d/open/lumiere'
import { litShare } from '../world3d/open/textures'
import { Dressing } from '../world3d/open/dressing'
import { weather } from '../world3d/open/weathering'

// « Façades réalistes » (city.html?view=facades&cam=x,y,z&look=x,y,z&heure=17.5, &facades=off|simple|normal|haute
// to compare): a street of shops and flats, a quarter of towers and a maquis, built by the street's own
// chunk builder (meshes.ts), lit by « lumière réaliste ». Its chunk's build time is shown in the title.

const q = new URLSearchParams(location.search)
const GROUND = weather(new THREE.MeshLambertMaterial({ color: '#cbb38c' }), 'ground')
const rect = (x: number, z: number, w: number, d: number): XZ[] => [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]]
let seed = 7
const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

function street(): ChunkData {
  const box = { x0: -200, z0: -200, x1: 400, z1: 200 }
  const roads: ChunkData['roads'] = [
    { cls: 'primary', pts: [[-200, 0], [400, 0]], width: 12, paved: true, bridge: false },
    { cls: 'street', pts: [[-200, 60], [120, 60]], width: 7, paved: true, bridge: false },
    { cls: 'secondary', pts: [[140, -200], [140, 200]], width: 10, paved: true, bridge: false },
  ]
  const buildings: ChunkData['buildings'] = []
  // The boulevard: shops, flats over them (2 to 5 storeys), both sides.
  for (let x = -150; x < 120; x += 15)
    for (const sd of [-1, 1]) {
      const [w, d] = [11 + r() * 3, 10 + r() * 4]
      const c: XZ = [x, sd * (9 + d / 2)]
      buildings.push({ ring: blockRing(rect(c[0], c[1], w, d), [], c), holes: [], height: 3 * (1 + Math.floor(r() * 5)), c, tint: r(), style: r() < 0.6 ? 'commerce' : undefined })
    }
  // A residential street: low houses and small blocks of flats.
  for (let x = -150; x < 110; x += 13)
    if (r() > 0.2) {
      const [w, d] = [9 + r() * 2, 8 + r() * 3]
      const c: XZ = [x, 60 + 6 + d / 2]
      buildings.push({ ring: blockRing(rect(c[0], c[1], w, d), [], c), holes: [], height: r() < 0.4 ? 6 : r() < 0.7 ? 9 : 3, c, tint: r() })
    }
  // The Plateau: towers of every height.
  const towers: [number, number, number, number, number][] = [
    [175, -30, 24, 20, 48],
    [210, -35, 22, 22, 84],
    [250, -30, 30, 22, 63],
    [295, -40, 26, 26, 96],
    [175, 40, 20, 30, 39],
    [215, 40, 26, 20, 72],
    [255, 45, 24, 24, 54],
    [300, 40, 30, 20, 33],
    [340, -35, 24, 18, 60],
    [340, 40, 22, 22, 45],
  ]
  for (const [x, z, w, d, h] of towers) buildings.push({ ring: blockRing(rect(x, z, w, d), [], [x, z]), holes: [], height: h, c: [x, z], tint: r(), style: 'civic' })
  return { key: 'facadeslab', tx: 0, ty: 0, box, roads, buildings, areas: [], trees: [], palms: [], aeroways: [], pois: [] }
}

export function FacadesLab() {
  const data = useMemo(street, [])
  const tier = facadesTier()
  const mats = useMemo(() => makeWorldMaterials(), [])
  useFacadeLook(mats, mats, tier)
  const hour = Number(q.get('heure') ?? 11)
  const { meshes, ms } = useMemo(() => {
    const build = facadesBuild(tier, false)
    const dress = build && { tower: true, props: build === 'props' }
    // (Built a few times: its mean, as the worker would take.)
    const t0 = performance.now()
    let m = buildChunk(data, () => false, undefined, undefined, false, dress)
    for (let i = 0; i < 4; i++) m = buildChunk(data, () => false, undefined, undefined, false, dress)
    return { meshes: m, ms: (performance.now() - t0) / 5 }
  }, [data, tier])
  useEffect(() => {
    document.title = `facades ${tier} build ${ms.toFixed(1)} ms`
    ;(window as unknown as { __labBuildMs?: number }).__labBuildMs = ms
  }, [tier, ms])
  setDaylight(hour)
  const night = hour < 6 || hour >= 19
  const dusk = hour >= 17 && hour < 19
  useEffect(() => {
    mats.walls.emissiveIntensity = night ? 0.95 : 0
    mats.shop.emissiveIntensity = night ? 0.8 : 0
    for (const k of ['glass', 'glassFlat', 'tower'] as const) mats[k].emissiveIntensity = night ? 0.85 : dusk ? 0.22 : 0
    mats.facade.emissiveIntensity = night ? 0.85 : dusk ? 0.25 : 0
    mats.walls.userData.litShare.value = litShare(hour)
    for (const k of ['glass', 'glassFlat', 'tower'] as const) mats[k].userData.litShare.value = dusk ? 0.35 : litShare(hour)
  }, [mats, night, dusk, hour])
  const cam = (q.get('cam') ?? '-30,4,-14').split(',').map(Number) as [number, number, number]
  const look = (q.get('look') ?? '0,5,12').split(',').map(Number) as [number, number, number]
  const glassMat = tier === 'normal' || tier === 'haute' ? mats.glass : mats.glassFlat
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: cam, fov: 50, far: 4000 }} style={{ width: '100vw', height: '100vh' }} onCreated={({ gl, scene }) => Object.assign(window, { __gl: gl, __scene: scene })}>
      <color attach="background" args={[night ? '#141a3d' : '#9cc8ec']} />
      <LumiereRig tier="normal" hour={hour} rain={false} />
      <Fill tier="normal" scale={1} />
      <directionalLight position={daylight.dir.clone().multiplyScalar(200).toArray()} intensity={daylight.sunI} color={daylight.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} shadow-camera-far={600} />
      {Object.entries(meshes).map(([name, g]) => {
        const m = name === 'glass' ? glassMat : name === 'facade2' ? (tier === 'haute' ? mats.facade : null) : (mats as unknown as Record<string, THREE.Material>)[name === 'tinLow' ? 'tin' : name]
        return g && m && name !== 'tinLow' ? <mesh key={name} geometry={g} material={m} receiveShadow castShadow={name !== 'contact'} /> : null
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <primitive object={GROUND} attach="material" />
      </mesh>
      {/* A maquis facing the residential street */}
      <group position={[-40, 0, 50]}>
        <Dressing kind="maquis" name="Maquis Akwaba Soir" seed={0.37} night={night} />
      </group>
      <OrbitControls target={look} />
    </Canvas>
  )
}
