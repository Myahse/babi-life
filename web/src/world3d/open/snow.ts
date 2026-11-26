import type * as THREE from 'three'
import { europeSnow } from '../europeStyle'
import { moSnow } from '../moyenOrientStyle'
import { asieSnow } from '../asieStyle'

// Montréal's winter (the update « pays-canada »; France's, lighter: « pays-france »): from late November to March, snow lies on the ground,
// the lawns, the pavements and the roofs, swept from the roads but heaped along their kerbs and trodden
// grey where people walk; the trees are frosted. One shared amount (0: none, 1: deep) the materials read,
// set by OpenWorld from the country and the month; the flakes fall in snowSky.tsx.

export const SNOW = { value: 0 }

/** How much snow lies in Montréal in a month (1-12): deep in the heart of winter, a dusting at its ends. In France
 *  (« pays-france »), lighter and not always: a cold spell about one week in three from December to February,
 *  none on the Mediterranean (`mild`: Nice, Marseille). `day`: the day of the month. */
export function snowFor(country: string, month: number, day = 1, mild = false): number {
  if (country === 'fr') {
    const base = mild ? 0 : (({ 12: 0.3, 1: 0.4, 2: 0.3 } as Record<number, number>)[month] ?? 0)
    const week = Math.floor((month * 31 + day) / 7)
    return base && (week * 7919) % 3 === 0 ? base : 0
  }
  if (country !== 'ca') return europeSnow(country, month) || moSnow(country, month) || asieSnow(country, month)
  return ({ 11: 0.55, 12: 0.9, 1: 1, 2: 1, 3: 0.7, 4: 0.2 } as Record<number, number>)[month] ?? 0
}

export type SnowKind = 'flat' | 'road' | 'pavement' | 'roof' | 'leaves'

// How each surface takes it: `cover` the share whitened at full snow; the blocks keep the game's look.
const COVER: Record<SnowKind, string> = {
  flat: `float cover = smoothstep(0.25, 0.55, wSnowFbm(floor(vSnowW.xz * 2.0) / 2.0 / 9.0) + uSnow * 0.55);`,
  // The ploughs clear the middle; slush and heaps stay at the edges (lighter patches, the snow greyed).
  road: `float cover = smoothstep(0.62, 0.8, wSnowFbm(floor(vSnowW.xz * 2.0) / 2.0 / 4.0) + uSnow * 0.25) * 0.75;`,
  pavement: `float cover = smoothstep(0.4, 0.7, wSnowFbm(floor(vSnowW.xz * 2.0) / 2.0 / 3.0 + 9.0) + uSnow * 0.35);`,
  roof: `float cover = smoothstep(0.2, 0.45, wSnowFbm(floor(vSnowW.xz) / 6.0 + 4.0) + uSnow * 0.6);`,
  leaves: `float cover = smoothstep(0.45, 0.7, wSnowFbm(floor(vSnowW.xz * 3.0) / 3.0 / 2.0 + vSnowW.y * 0.3) + uSnow * 0.3) * 0.7;`,
}
const WHITE: Record<SnowKind, string> = { flat: 'vec3(0.93, 0.95, 0.98)', road: 'vec3(0.62, 0.63, 0.66)', pavement: 'vec3(0.8, 0.82, 0.86)', roof: 'vec3(0.95, 0.96, 0.99)', leaves: 'vec3(0.9, 0.93, 0.97)' }

const NOISE = `
uniform float uSnow;
varying vec3 vSnowW;
float wSnowHash(vec2 p) { return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453); }
float wSnowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wSnowHash(i), wSnowHash(i + vec2(1.0, 0.0)), f.x), mix(wSnowHash(i + vec2(0.0, 1.0)), wSnowHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wSnowFbm(vec2 p) { return wSnowNoise(p) * 0.6 + wSnowNoise(p * 2.1 + 5.3) * 0.4; }
`

/** Lets snow lie on a material (after its colours and its wear), by the shared amount. */
export function snowy<M extends THREE.Material>(m: M, kind: SnowKind): M {
  const before = m.onBeforeCompile
  const key = m.customProgramCacheKey?.bind(m)
  m.onBeforeCompile = (s, r) => {
    before.call(m, s, r)
    s.uniforms.uSnow = SNOW
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvSnowW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvSnowW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <alphamap_fragment>', `if (uSnow > 0.0) {\n${COVER[kind]}\ndiffuseColor.rgb = mix(diffuseColor.rgb, ${WHITE[kind]} * (0.96 + wSnowHash(floor(vSnowW.xz * 2.0)) * 0.05), clamp(cover, 0.0, 1.0) * min(uSnow * 1.4, 1.0));\n}\n#include <alphamap_fragment>`)
  }
  m.customProgramCacheKey = () => `${key ? key() : ''}|snow-${kind}`
  return m
}
