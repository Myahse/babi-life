import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// The sky over the open world: a dome that goes from the deep colour
// overhead to a pale haze at the horizon (the fog fades the far city into
// the same colour), a glow around the sun by day, and at night the stars
// (some brighter, twinkling), the moon with its halo, and the orange glow
// the city's lights throw up on the haze along the horizon.

export type SkyTone = { top: string; horizon: string }
export function skyTone(night: boolean, dusk: boolean): SkyTone {
  if (night) return { top: '#04071a', horizon: '#1d2552' }
  if (dusk) return { top: '#3b4a8f', horizon: '#ffb27a' }
  return { top: '#2f7fd0', horizon: '#cfe9f8' }
}

/** Where the sun is (the light comes from there): matches the Sun light's offset. */
const SUN = new THREE.Vector3(60, 110, 35).normalize()

export function SkyDome({ night, dusk, rain = false }: { night: boolean; dusk: boolean; /** Raining: the sky's clouds go grey, like the rain's own (rainSky.tsx). */ rain?: boolean }) {
  const tone = skyTone(night, dusk)
  const mesh = useRef<THREE.Group>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sun: { value: SUN }, glow: { value: 1 }, city: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; uniform float glow; uniform float city; varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(horizon, top, pow(h, 0.55));
            float s = max(dot(normalize(vDir), sun), 0.0);
            c += glow * (pow(s, 64.0) * vec3(1.0, 0.95, 0.8) + pow(s, 6.0) * vec3(0.25, 0.2, 0.1));
            // The city's glow on the night haze: sodium orange low down, fading up into the blue.
            float low = 1.0 - clamp(vDir.y * 5.0, 0.0, 1.0);
            c += city * low * low * vec3(0.42, 0.2, 0.08);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  material.uniforms.top.value.set(tone.top)
  material.uniforms.horizon.value.set(tone.horizon)
  material.uniforms.glow.value = night ? 0 : dusk ? 0.7 : 1
  material.uniforms.city.value = night ? 1 : dusk ? 0.25 : 0
  // The dome goes along with the camera: always at the far edge of the world.
  useFrame(({ camera }) => mesh.current?.position.copy(camera.position))
  // Two layers of stars: many faint ones, and fewer bright ones that twinkle.
  const stars = useMemo(() => {
    const layer = (n: number, seed: number) => {
      const pts: number[] = []
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2
        const y = 0.08 + r() * 0.92
        const k = Math.sqrt(1 - y * y)
        pts.push(Math.cos(a) * k * 7000, y * 7000, Math.sin(a) * k * 7000)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      return g
    }
    return { faint: layer(900, 7), bright: layer(140, 23) }
  }, [])
  const twinkle = useMemo(() => new THREE.PointsMaterial({ color: '#fff6e0', size: 2.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }), [])
  useFrame(({ clock }) => {
    if (night) twinkle.opacity = 0.65 + Math.sin(clock.elapsedTime * 2.3) * 0.2 + Math.sin(clock.elapsedTime * 5.1) * 0.1
  })
  return (
    <group ref={mesh}>
      {/* Inside the camera's far plane (6 km), or the middle of the dome, the stars and the moon are cut away */}
      <group scale={0.66}>
        <mesh material={material} renderOrder={-10} frustumCulled={false}>
          <sphereGeometry args={[7500, 32, 16]} />
        </mesh>
        {night && (
          <>
            <points geometry={stars.faint} frustumCulled={false}>
              <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} fog={false} transparent opacity={0.85} />
            </points>
            <points geometry={stars.bright} material={twinkle} frustumCulled={false} />
            <Moon />
          </>
        )}
      </group>
      <Clouds night={night} dusk={dusk} rain={rain} />
    </group>
  )
}

// Soft banks that drift over the city. They ride with the dome, so they
// stay overhead wherever the Sim walks, and turn slowly so the sky moves.
function Clouds({ night, dusk, rain }: { night: boolean; dusk: boolean; rain: boolean }) {
  const spin = useRef<THREE.Group>(null)
  const puff = useMemo(() => new THREE.SphereGeometry(1, 16, 12), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false }), [])
  mat.color.set(rain ? (night ? '#3a3f4f' : '#8d97a3') : night ? '#5a6890' : dusk ? '#ffe0c2' : '#ffffff')
  mat.opacity = rain ? 0.95 : night ? 0.55 : dusk ? 0.8 : 0.9
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
      {/* All the puffs in one draw (the same sphere, stretched) */}
      <instancedMesh
        args={[puff, mat, puffs.length]}
        frustumCulled={false}
        ref={(m) => {
          if (!m || m.userData.set) return
          const o = new THREE.Object3D()
          puffs.forEach((c, i) => {
            o.position.set(...c.p)
            o.scale.set(...c.s)
            o.updateMatrix()
            m.setMatrixAt(i, o.matrix)
          })
          m.instanceMatrix.needsUpdate = true
          m.userData.set = true
        }}
      />
    </group>
  )
}

/** Where the moon hangs: high in the east-south-east, away from the sun's side. */
const MOON = new THREE.Vector3(-0.55, 0.62, -0.56).normalize().multiplyScalar(6500)

/** The moon: a pale disc with its grey seas, and a soft halo round it on the haze. */
function Moon() {
  const { disc, halo } = useMemo(() => {
    const paint = (size: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      draw(c.getContext('2d')!)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    const disc = paint(64, (g) => {
      g.fillStyle = '#f4f1e6'
      g.beginPath()
      g.arc(32, 32, 30, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(150,150,160,0.45)'
      for (const [x, y, r] of [[22, 24, 8], [38, 36, 10], [30, 46, 5], [44, 20, 4]]) {
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
      }
    })
    const halo = paint(64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(220,230,255,0.55)')
      grad.addColorStop(0.35, 'rgba(180,200,255,0.18)')
      grad.addColorStop(1, 'rgba(180,200,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
    })
    return { disc, halo }
  }, [])
  return (
    <group position={MOON}>
      <sprite scale={[1500, 1500, 1]} renderOrder={-9}>
        <spriteMaterial map={halo} fog={false} depthWrite={false} transparent blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={[260, 260, 1]} renderOrder={-8}>
        <spriteMaterial map={disc} fog={false} depthWrite={false} transparent />
      </sprite>
    </group>
  )
}
