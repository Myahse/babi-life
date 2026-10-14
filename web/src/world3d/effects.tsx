import { EffectComposer, Bloom, N8AO } from '@react-three/postprocessing'

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
