import * as THREE from 'three'
import { t } from '../../lib/i18n'

// While a lot is being set in the world (lotGhost.tsx) and it can go there,
// what will be cleared for it goes at once: every building within its ground
// (as chunkJob.ts clears a lot's ground: a corner of it on it is enough) and
// the trees on it. So nothing stands across the lot, and one sees the quarter
// as it will be. The buildings carry their middle and size (meshes.ts
// `lotBc`); the trees, their instance's place.

/** Where the lot's ground is (its middle, its radius); `on` 0 when nothing is cleared. */
export const LOT_CLIP = { on: { value: 0 }, at: { value: new THREE.Vector2() }, r: { value: 0 } }

/** Hides what of a material's meshes stands on the lot being set: `buildings` by their own middle and size, `instances` (trees) by where each stands. */
export function lotClip<M extends THREE.Material>(m: M, by: 'buildings' | 'instances'): M {
  const before = m.onBeforeCompile
  const key = m.customProgramCacheKey?.bind(m)
  m.onBeforeCompile = (s, r) => {
    before.call(m, s, r)
    s.uniforms.uLotOn = LOT_CLIP.on
    s.uniforms.uLotAt = LOT_CLIP.at
    s.uniforms.uLotR = LOT_CLIP.r
    const head = by === 'buildings' ? t('attribute vec3 lotBc;\nvarying vec3 vLotBc;') : t('varying vec3 vLotBc;')
    // (A mesh without the attribute reads 0 0 0: its radius 0, never hidden.)
    const set = by === 'buildings' ? t('vLotBc = lotBc;') : '#ifdef USE_INSTANCING\n vec4 lotO = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n vLotBc = vec3(lotO.x, lotO.z, 0.01);\n#else\n vLotBc = vec3(0.0);\n#endif'
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>\n${head}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${set}`)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLotOn;\nuniform vec2 uLotAt;\nuniform float uLotR;\nvarying vec3 vLotBc;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uLotOn > 0.5 && vLotBc.z > 0.0 && distance(vLotBc.xy, uLotAt) < uLotR + vLotBc.z) discard;')
  }
  m.customProgramCacheKey = () => `${key ? key() : ''}|lotclip-${by}`
  return m
}
