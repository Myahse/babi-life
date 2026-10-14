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
      <Clouds night={night} dusk={dusk} />
    </group>
  )
}

// Soft banks that drift over the city. They ride with the dome, so they
// stay overhead wherever the Sim walks, and turn slowly so the sky moves.
function Clouds({ night, dusk }: { night: boolean; dusk: boolean }) {
  const spin = useRef<THREE.Group>(null)
  const puff = useMemo(() => new THREE.SphereGeometry(1, 16, 12), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false }), [])
  mat.color.set(night ? '#e7eefc' : dusk ? '#ffe0c2' : '#ffffff')
  mat.opacity = night ? 0.55 : dusk ? 0.8 : 0.9
  const puffs = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number] }[] = []
    let seed = 11
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // High banks for when the camera looks down, and lower ones along the
    // horizon for when it looks across the city.
    const bands = [
      { n: 8, rad: 500, span: 700, y: 380, rise: 200, size: 55 },
      { n: 12, rad: 1100, span: 1400, y: 90, rise: 80, size: 90 },
    ]
    for (const band of bands) {
      for (let i = 0; i < band.n; i++) {
        const a = (i / band.n) * Math.PI * 2
        const rad = band.rad + r() * band.span
        const y = band.y + r() * band.rise
        const blobs = 4 + Math.floor(r() * 3)
        for (let k = 0; k < blobs; k++) {
          const s = band.size + r() * band.size
          out.push({
            p: [Math.cos(a) * rad + (r() - 0.5) * 120, y + (r() - 0.35) * 20, Math.sin(a) * rad + (r() - 0.5) * 70],
            s: [s, s * 0.42, s * 0.7],
          })
        }
      }
    }
    return out
  }, [])
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.012
  })
  return (
    <group ref={spin}>
      {puffs.map((c, i) => (
        <mesh key={i} geometry={puff} material={mat} position={c.p} scale={c.s} />
      ))}
    </group>
  )
}
