import { useEffect, type ReactNode } from 'react'
import * as THREE from 'three'
import { ANIMAL_MAT } from './open/wildlife'
import { EauRig, useEauMaterials } from './open/eau'
import type { MondeTier } from './mondes'

// « Mini-jeux réalistes », phase 2 (mondes.tsx): the nature scenes' living parts, apart so the scenes
// without animals or water don't load wildlife.tsx and eau.tsx.

/* ---------- The animals' skins ---------- */

const SKIN_FRAG = /* glsl */ `
{
  // The animals' blocks carry their colours per vertex: the skin's pattern is read from the colour.
  // Grey (elephant, rhino, hippo): wrinkles; green-olive (crocodile): scales; the rest: fur.
  vec3 mdC = vColor.rgb;
  float mdHi = max( mdC.r, max( mdC.g, mdC.b ) );
  float mdSat = mdHi - min( mdC.r, min( mdC.g, mdC.b ) );
  vec3 mdQ = mdP * 40.0;
  float mdN = mdHash( floor( mdQ ) );
  float mdK = 1.0;
  if ( mdSat < 0.05 * max( mdHi, 0.2 ) && mdHi > 0.08 ) {
    // Wrinkles: wavy creases a few cm apart, crossing.
    float w1 = fract( mdP.y * 9.0 + sin( mdP.x * 7.0 + mdP.z * 5.0 ) * 0.35 );
    float w2 = fract( ( mdP.x + mdP.z ) * 6.0 + sin( mdP.y * 9.0 ) * 0.4 );
    mdK = 1.0 - 0.22 * step( w1, 0.12 ) - 0.12 * step( w2, 0.08 ) + ( mdN - 0.5 ) * 0.12;
  } else if ( mdC.g > mdC.r && mdC.g >= mdC.b && mdSat > 0.04 ) {
    // Scales: cells of ~6 cm, a dark rim, each its own shade; ridges along the back.
    vec2 mdS = vec2( mdP.x * 16.0, ( mdP.z + mdP.y ) * 16.0 );
    vec2 mdF = fract( mdS );
    float rim = step( mdF.x, 0.14 ) + step( mdF.y, 0.14 );
    mdK = 1.0 - 0.25 * min( rim, 1.0 ) + ( mdHash( floor( vec3( mdS, 0.0 ) ) ) - 0.5 ) * 0.22;
  } else {
    // Fur: strands longer than wide (down the body), tips darker, a little light on top.
    float s = mdHash( floor( vec3( mdP.x * 55.0, mdP.y * 18.0, mdP.z * 55.0 ) ) );
    mdK = 1.0 + ( s - 0.5 ) * 0.28 + ( mdN - 0.5 ) * 0.1;
  }
  diffuseColor.rgb *= mdK;
}
`
let skinPatched = 0
/**
 * While mounted, the animals (wildlife.tsx' shared material) wear a pixel skin: wrinkled grey hide,
 * scales, fur. Given back as it was on unmount. Off: nothing.
 */
export function AnimalSkins({ tier }: { tier: MondeTier }) {
  useEffect(() => {
    if (tier === 'off') return
    if (skinPatched++ === 0) {
      ANIMAL_MAT.onBeforeCompile = (s) => {
        s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 mdP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nmdP = position;')
        s.fragmentShader = s.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 mdP;\nfloat mdHash( vec3 p3 ) { p3 = fract( p3 * 0.1031 ); p3 += dot( p3, p3.zyx + 31.32 ); return fract( ( p3.x + p3.y ) * p3.z ); }')
          .replace('#include <color_fragment>', `#include <color_fragment>\n${SKIN_FRAG}`)
      }
      ANIMAL_MAT.customProgramCacheKey = () => 'mondes-skin1'
      ANIMAL_MAT.userData.noMini = true
      ANIMAL_MAT.needsUpdate = true
    }
    return () => {
      if (--skinPatched > 0) return
      ANIMAL_MAT.onBeforeCompile = THREE.Material.prototype.onBeforeCompile
      ANIMAL_MAT.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey
      delete ANIMAL_MAT.userData.noMini
      ANIMAL_MAT.needsUpdate = true
    }
  }, [tier])
  return null
}

/* ---------- Water: the « eau réaliste » shader on a scene's river, lake or sea ---------- */

/**
 * A sheet of water using the street's water shader (ripples, Fresnel, the sun's glint) on « normal »
 * and « haute »; on « simple » (or with no shader), `fallback` is drawn instead (the scene's own).
 * `hour`: the scene's light (its colours follow it).
 */
export function EauScene({ tier, hour, children, fallback, grain = 1 }: { tier: MondeTier; hour: number; children: (m: THREE.Material) => ReactNode; fallback: ReactNode; /** The near squares' and ripples' scale (1: the street's 25 cm; 0.5: 50 cm squares and ripples twice as large, calmer for water seen from a metre or two). */ grain?: number }) {
  const eau = useEauMaterials(tier === 'haute' ? 'normal' : tier)
  if (eau) eau.near.uniforms.uGrain.value = grain
  if (!eau) return <>{fallback}</>
  return (
    <>
      <EauRig eau={eau} hour={hour} rain={false} ownClock foam={NO_FOAM} />
      {children(eau.near)}
    </>
  )
}
const NO_FOAM: THREE.MeshBasicMaterial[] = []
