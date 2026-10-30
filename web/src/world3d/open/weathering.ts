import type * as THREE from 'three'

// The city as it has lived: nothing in Abidjan is one even colour. The ground
// goes from pale sand to red earth with tufts of dry grass; the asphalt is
// greyer here, darker there, patched where it was mended, dusty; the walls
// are dirtier at their foot, where the rain splashes the earth, and blotched
// higher up; the roofs are stained by the rain; the bridges' concrete is
// darker under its edges. All of it worked out from where each pixel is in
// the world (no texture to load), in blocks of a few decimetres so it keeps
// the game's blocky look, and added to each material's own shader.

export type Weather = 'ground' | 'asphalt' | 'walls' | 'roofs' | 'concrete' | 'tin' | 'paint' | 'pavement'

const NOISE = `
varying vec3 vWeatherW;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wFbm(vec2 p) { return wNoise(p) * 0.55 + wNoise(p * 2.03 + 7.1) * 0.3 + wNoise(p * 4.1 + 3.3) * 0.15; }
`

// What each kind does to the colour (diffuseColor), from vWeatherW; `b` is the world position snapped to blocks.
const LOOK: Record<Weather, string> = {
  ground: `
    vec2 b = floor(vWeatherW.xz * 2.0) / 2.0;
    vec3 tone = mix(vec3(1.03, 0.86, 0.72), vec3(1.07, 1.08, 1.1), smoothstep(0.3, 0.7, wFbm(b / 45.0)));
    float tuft = smoothstep(0.6, 0.72, wFbm(b / 22.0 + 11.0));
    tone = mix(tone, vec3(0.66, 0.8, 0.5), tuft * 0.6);
    diffuseColor.rgb *= tone * (0.95 + wHash(b) * 0.08);`,
  asphalt: `
    vec2 b = floor(vWeatherW.xz * 2.0) / 2.0;
    float wear = wFbm(b / 28.0);
    diffuseColor.rgb *= 0.78 + wear * 0.4;
    float patchy = step(0.8, wNoise(floor(vWeatherW.xz / 3.0) * 0.37 + 5.0));
    diffuseColor.rgb *= mix(1.0, 0.8, patchy);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.55, 0.45), smoothstep(0.55, 0.9, wFbm(b / 60.0 + 3.0)) * 0.22);
    // Potholes, one road cell in a dozen (none up on the bridges): a ragged dark hole, a lighter broken rim.
    vec2 cell = floor(vWeatherW.xz / 9.0);
    if (wHash(cell + 17.0) > 0.92 && vWeatherW.y < 0.8) {
      vec2 at = (cell + 0.2 + 0.6 * vec2(wHash(cell + 3.0), wHash(cell + 5.0))) * 9.0;
      vec2 q = floor(vWeatherW.xz * 4.0) / 4.0 - at;
      float rad = 0.45 + 0.5 * wHash(cell + 7.0) + 0.25 * (wNoise(q * 3.0 + cell) - 0.5);
      float d = length(q * vec2(1.0, 0.75));
      diffuseColor.rgb *= d < rad ? 0.5 : d < rad + 0.25 ? 1.12 : 1.0;
    }
    // A manhole cover now and then: a dark iron square with its grid.
    vec2 mc = floor(vWeatherW.xz / 23.0);
    if (wHash(mc + 41.0) > 0.85) {
      vec2 at = (mc + 0.3 + 0.4 * vec2(wHash(mc + 43.0), wHash(mc + 47.0))) * 23.0;
      vec2 q = abs(vWeatherW.xz - at);
      if (max(q.x, q.y) < 0.4) diffuseColor.rgb = vec3(0.09, 0.09, 0.1) * (max(q.x, q.y) > 0.33 || fract((vWeatherW.x - at.x) * 6.0) < 0.3 ? 1.6 : 1.0);
    }`,
  walls: `
    vec2 bw = floor(vec2(vWeatherW.x + vWeatherW.z, vWeatherW.y) * 3.0) / 3.0;
    float foot = smoothstep(0.0, 1.4, vWeatherW.y);
    diffuseColor.rgb *= mix(vec3(0.72, 0.66, 0.6), vec3(1.0), foot);
    float blotch = smoothstep(0.62, 0.85, wFbm(bw / 2.5));
    diffuseColor.rgb *= 1.0 - blotch * 0.12;
    diffuseColor.rgb *= 0.95 + wFbm(floor(vWeatherW.xz / 12.0)) * 0.1;`,
  roofs: `
    vec2 b = floor(vWeatherW.xz) ;
    float stain = smoothstep(0.5, 0.85, wFbm(b / 5.0));
    diffuseColor.rgb *= 1.0 - stain * 0.18;
    diffuseColor.rgb *= 0.94 + wHash(floor(vWeatherW.xz / 9.0)) * 0.1;`,
  // The sheet's own light and shade, its colour the house's (the vertex colour, applied next); rust running down it.
  tin: `
    float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = vec3(l / 0.26);
    vec2 bw = floor(vWeatherW.xz * 2.0) / 2.0;
    float rust = smoothstep(0.58, 0.85, wFbm(bw / 3.0 + 9.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.25, 0.62, 0.32), rust * 0.35);`,
  // The paint on the road worn away where the wheels go: grey patches through the white.
  paint: `
    vec2 b = floor(vWeatherW.xz * 4.0) / 4.0;
    float worn = smoothstep(0.45, 0.75, wFbm(b / 1.8 + 21.0));
    diffuseColor.rgb *= mix(1.0, 0.5, worn);`,
  // The pavement's slabs: some darker, sand blown onto them, a few cracked.
  pavement: `
    vec2 slab = floor(vWeatherW.xz);
    diffuseColor.rgb *= 0.9 + wHash(slab) * 0.14;
    float drift = smoothstep(0.55, 0.85, wFbm(floor(vWeatherW.xz * 2.0) / 2.0 / 7.0 + 31.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 0.95, 0.78), drift * 0.6);`,
  concrete: `
    vec2 bw = floor(vec2(vWeatherW.x + vWeatherW.z, vWeatherW.y) * 3.0) / 3.0;
    float streak = smoothstep(0.55, 0.9, wNoise(vec2(bw.x * 1.3, bw.y * 0.15)));
    diffuseColor.rgb *= 1.0 - streak * 0.16;
    diffuseColor.rgb *= mix(vec3(0.8, 0.77, 0.73), vec3(1.0), smoothstep(0.0, 1.2, vWeatherW.y));`,
}

/** Adds the kind of wear to a material, after any shader change it already has. */
export function weather<M extends THREE.Material>(m: M, kind: Weather): M {
  const before = m.onBeforeCompile
  const key = m.customProgramCacheKey?.bind(m)
  m.onBeforeCompile = (s, r) => {
    before.call(m, s, r)
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWeatherW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWeatherW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}`).replace('#include <map_fragment>', `#include <map_fragment>\n{${LOOK[kind]}\n}`)
  }
  m.customProgramCacheKey = () => `${key ? key() : ''}|weather-${kind}`
  return m
}
