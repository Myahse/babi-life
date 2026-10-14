import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// The sky over the open world: a dome that goes from the deep colour
// overhead to a pale haze at the horizon (the fog fades the far city into
// the same colour), a glow around the sun by day, and the stars at night.

export type SkyTone = { top: string; horizon: string }
export function skyTone(night: boolean, dusk: boolean): SkyTone {
  if (night) return { top: '#04071a', horizon: '#1d2552' }
  if (dusk) return { top: '#3b4a8f', horizon: '#ffb27a' }
  return { top: '#2f7fd0', horizon: '#cfe9f8' }
}

/** Where the sun is (the light comes from there): matches the Sun light's offset. */
const SUN = new THREE.Vector3(60, 110, 35).normalize()

export function SkyDome({ night, dusk }: { night: boolean; dusk: boolean }) {
  const tone = skyTone(night, dusk)
  const mesh = useRef<THREE.Group>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sun: { value: SUN }, glow: { value: 1 } },
        vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; uniform float glow; varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(horizon, top, pow(h, 0.55));
            float s = max(dot(normalize(vDir), sun), 0.0);
            c += glow * (pow(s, 64.0) * vec3(1.0, 0.95, 0.8) + pow(s, 6.0) * vec3(0.25, 0.2, 0.1));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  material.uniforms.top.value.set(tone.top)
  material.uniforms.horizon.value.set(tone.horizon)
  material.uniforms.glow.value = night ? 0 : dusk ? 0.7 : 1
  // The dome goes along with the camera: always at the far edge of the world.
  useFrame(({ camera }) => mesh.current?.position.copy(camera.position))
  const stars = useMemo(() => {
    const pts: number[] = []
    let seed = 7
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 900; i++) {
      const a = r() * Math.PI * 2
      const y = 0.08 + r() * 0.92
      const k = Math.sqrt(1 - y * y)
      pts.push(Math.cos(a) * k * 7000, y * 7000, Math.sin(a) * k * 7000)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <group ref={mesh}>
      <mesh material={material} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[7500, 32, 16]} />
      </mesh>
      {night && (
        <points geometry={stars} frustumCulled={false}>
          <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} fog={false} transparent opacity={0.85} />
        </points>
      )}
    </group>
  )
}
