import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { makeWorldMaterials, Palms, Trees } from '../open/OpenWorld'
import { buildChunk } from '../open/meshes'
import { genUnivers, universChunk, UNIV_EXT, UNIV_ORIGIN, UNIV_TILES, type Built, type UniversSpec } from './univers/gen'
import { terrainKey } from './univers/terrain'

// « Vue du quartier » in the game's own 3D (update « mon-quartier », components/quartier/QuartierVue.tsx): the
// quartier's world as the street draws it, seen from high up: its four chunks laid out by the world (univers/gen.ts,
// with what the player built and the ground it shaped) and built by the street's own meshes (open/meshes.ts: the
// asphalt, the pavements and kerbs, the water and its foam, the grass, the sand, the walls and tin roofs), its trees
// and palms, in the street's materials and textures. No plain town of blocks: the quartier as it is.

/** The game's grass under the whole land (its texture every 2 m, like the streets'). */
const GRASS = (() => {
  const g = new THREE.PlaneGeometry(UNIV_EXT * 2.4, UNIV_EXT * 2.4, 1, 1).rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2)
  return g
})()

export function VueWorld({ spec, built, onReady }: { spec: UniversSpec; built: Built[]; /** Once its meshes are made (the view can show its pins). */ onReady?: () => void }) {
  const mats = useMemo(makeWorldMaterials, [])
  // (The grass under it all drawn as it is, not pushed back like the street's green patches: it covers the view's plain ground.)
  const grass = useMemo(() => {
    const m = mats.green.clone()
    m.polygonOffset = false
    return m
  }, [mats])
  useEffect(() => () => grass.dispose(), [grass])
  const builtKey = built.map((b) => `${b.lot}${b.kind}`).join('.')
  const parts = useMemo(() => {
    const u = genUnivers(spec)
    return UNIV_TILES.map(([tx, ty]) => {
      // (The home's house too: the street draws the player's own, the view a house on its spot.)
      const chunk = universChunk(u, UNIV_ORIGIN, tx, ty, built.some((b) => b.lot === -1) ? built : [...built, { lot: -1, kind: 'maison' }])
      return { chunk, geos: buildChunk(chunk, () => false) as unknown as Record<string, THREE.BufferGeometry | null> }
    })
  }, [spec.seed, spec.preset, spec.variant, terrainKey(spec.terrain), builtKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => parts.forEach((p) => Object.values(p.geos).forEach((g) => g?.dispose())), [parts])
  useEffect(() => onReady?.(), [parts]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => Object.values(mats).forEach((m) => (m as THREE.Material).dispose?.()), [mats])
  return (
    <>
      <hemisphereLight args={['#eef6ff', '#7a6a4a', 1.05]} />
      <directionalLight position={[300, 600, 200]} intensity={1.6} color="#fff4e0" />
      <mesh geometry={GRASS} material={grass} position={[0, -0.03, 0]} />
      {parts.map(({ chunk, geos }) => (
        <group key={chunk.key}>
          {Object.entries(geos).map(([name, g]) => (g ? <mesh key={name} geometry={g} material={mats[(name === 'tinLow' ? 'tin' : name) as keyof typeof mats] as THREE.Material} /> : null))}
          <Trees pts={chunk.trees} bark={mats.bark} leaves={mats.leaves} shadows={false} />
          <Palms pts={chunk.palms ?? []} bark={mats.bark} leaves={mats.leaves} shadows={false} />
        </group>
      ))}
    </>
  )
}
