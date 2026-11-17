import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Effect } from 'postprocessing'
import { EffectComposer, Bloom, N8AO } from '@react-three/postprocessing'
import { CONTRAST, daylight, GRADE_GLSL, SAT } from './open/lumiere'

// Screen effects, in their own chunk: the postprocessing library is big and
// small phones never use it, so it is only downloaded where it's shown
// (loaded with React.lazy by the streets).

/** Soft shade in corners and at the foot of walls (the classic street, rooms). */
export default function AmbientOcclusion({ radius = 3, falloff = 1, intensity }: { radius?: number; falloff?: number; intensity: number }) {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <N8AO halfRes aoRadius={radius} distanceFalloff={falloff} intensity={intensity} quality="performance" color="#1a1410" />
    </EffectComposer>
  )
}

/** At night, lamps, windows and headlights bloom a little (the open world). */
export function NightBloom() {
  return (
    <EffectComposer enableNormalPass={false} multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.75} luminanceSmoothing={0.2} intensity={0.85} />
    </EffectComposer>
  )
}

// « Lumière réaliste » (open/lumiere.ts), the high tier: the street's tone curve, grade and
// vignette in one pass after the ambient occlusion and a faint bloom (only what really shines).
const LOOK_GLSL = /* glsl */ `
uniform float exposure;
uniform float warm;
uniform float vignette;
uniform float tonemap;
vec3 babiRRT( vec3 v ) {
  vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
  vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
  return a / b;
}
vec3 babiACES( vec3 color ) {
  const mat3 inM = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 outM = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  color *= exposure / 0.6;
  return clamp( outM * babiRRT( inM * color ), 0.0, 1.0 );
}
${GRADE_GLSL}
void mainImage( const in vec4 inputColor, const in vec2 uv, out vec4 outputColor ) {
  vec3 c = tonemap > 0.5 ? babiACES( inputColor.rgb ) : inputColor.rgb;
  c = babiGrade( c, ${SAT.toFixed(3)}, ${CONTRAST.toFixed(3)}, warm );
  vec2 d = uv - 0.5;
  c *= 1.0 - vignette * smoothstep( 0.25, 0.85, dot( d, d ) * 2.2 );
  outputColor = vec4( c, inputColor.a );
}
`
class LookEffectImpl extends Effect {
  constructor() {
    super('BabiLook', LOOK_GLSL, {
      uniforms: new Map<string, THREE.Uniform<number>>([
        ['exposure', new THREE.Uniform(1)],
        ['warm', new THREE.Uniform(0)],
        ['vignette', new THREE.Uniform(0.18)],
        ['tonemap', new THREE.Uniform(1)],
      ]),
    })
  }
}

/** The look's pass: ACES at the light's exposure (or the curve left as it was: the rooms), the grade, the vignette. */
function Look({ tonemap = true, vignette = 0.18, exposure, warm }: { tonemap?: boolean; vignette?: number; /** A fixed exposure and warmth (the played scenes' presets) instead of the street's hour. */ exposure?: number; warm?: number }) {
  const effect = useMemo(() => new LookEffectImpl(), [])
  useEffect(() => () => effect.dispose(), [effect])
  useFrame(() => {
    const u = effect.uniforms
    u.get('exposure')!.value = tonemap ? (exposure ?? daylight.exposure) : 1
    u.get('warm')!.value = tonemap ? (warm ?? daylight.warm * 0.35) : 0
    u.get('vignette')!.value = vignette
    u.get('tonemap')!.value = tonemap ? 1 : 0
  })
  return <primitive object={effect} dispose={null} />
}

/** The open world in « haute »: ambient occlusion near the camera, a faint bloom (more at night), the look. */
export function LumierePost({ night, ao = true }: { night: boolean; ao?: boolean }) {
  return (
    <EffectComposer enableNormalPass={false} multisampling={4}>
      {ao ? <N8AO halfRes aoRadius={2} distanceFalloff={0.6} intensity={1.6} quality="performance" color="#1a1410" /> : <></>}
      <Bloom mipmapBlur luminanceThreshold={night ? 0.75 : 1.1} luminanceSmoothing={0.2} intensity={night ? 0.85 : 0.22} />
      <Look />
    </EffectComposer>
  )
}

/** The rooms with « lumière réaliste »: their ambient occlusion, then the grade (their own lights and curve kept). */
export function RoomLook({ radius = 3, falloff = 1, intensity }: { radius?: number; falloff?: number; intensity: number }) {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <N8AO halfRes aoRadius={radius} distanceFalloff={falloff} intensity={intensity} quality="performance" color="#1a1410" />
      <Look tonemap={false} vignette={0.12} />
    </EffectComposer>
  )
}

/** The played scenes in « haute » (world3d/minijeux.tsx): ambient occlusion, a bloom by the preset (the floodlights at night), the look at the preset's exposure. */
export function MiniPost({ exposure, warm, bloom }: { exposure: number; warm: number; bloom: { threshold: number; intensity: number } }) {
  return (
    <EffectComposer enableNormalPass={false} multisampling={4}>
      <N8AO halfRes aoRadius={1.2} distanceFalloff={0.6} intensity={1.5} quality="performance" color="#1a1410" />
      <Bloom mipmapBlur luminanceThreshold={bloom.threshold} luminanceSmoothing={0.2} intensity={bloom.intensity} />
      <Look exposure={exposure} warm={warm} vignette={0.16} />
    </EffectComposer>
  )
}
