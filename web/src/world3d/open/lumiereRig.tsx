import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { serverNow } from '../../lib/worldClock'
import { daylight, gradeOff, gradeOn, HEURE, setDaylight, useLumiereOpen, type LumiereTier } from './lumiere'

// « Lumière réaliste » in the open world (open/lumiere.ts): the clock that moves the light,
// the grade on the renderer, the haze's colour, and the sky as environment light.

/** The sky as the environment map sees it: the dome's colours, the ground under the horizon, the sun's glow. */
const ENV_FRAG = /* glsl */ `
uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunCol; uniform vec3 sun; uniform float glow;
varying vec3 vDir;
void main() {
  vec3 d = normalize( vDir );
  vec3 c = d.y > 0.0 ? mix( horizon, top, pow( d.y, 0.55 ) ) : mix( horizon, ground, clamp( -d.y * 4.0, 0.0, 1.0 ) );
  float s = max( dot( d, sun ), 0.0 );
  c += glow * pow( s, 6.0 ) * sunCol * 0.5;
  gl_FragColor = vec4( c, 1.0 );
}
`

/**
 * Moves the light with the game's clock (the hour, with its minutes), keeps the renderer's
 * grade and exposure, the haze's colour; on « normal » and « haute », draws the sky into an
 * environment map again each quarter of an hour (the materials' sky light).
 */
export function LumiereRig({ tier, hour, rain }: { tier: LumiereTier; hour: number; rain: boolean }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const post = tier === 'haute'
  const env = tier === 'normal' || tier === 'haute'
  const since = useRef(1)
  const built = useRef({ version: -1, rain: false })
  const hourRef = useRef(hour)
  hourRef.current = hour
  const sky = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sun: { value: new THREE.Vector3() }, glow: { value: 1 } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: ENV_FRAG,
    })
    const s = new THREE.Scene()
    s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), material))
    return { scene: s, material }
  }, [])
  const pmrem = useMemo(() => (env ? new THREE.PMREMGenerator(gl) : null), [env, gl])
  const target = useRef<THREE.WebGLRenderTarget | null>(null)
  useEffect(
    () => () => {
      target.current?.dispose()
      target.current = null
      pmrem?.dispose()
      scene.environment = null
      built.current.version = -1
    },
    [pmrem, scene],
  )
  useEffect(
    () => () => {
      sky.material.dispose()
      ;(sky.scene.children[0] as THREE.Mesh).geometry.dispose()
    },
    [sky],
  )
  // The renderer back to plain ACES when the street goes (or the update shuts).
  useEffect(() => () => gradeOff(gl), [gl])
  useFrame((_, dt) => {
    since.current += dt
    if (since.current >= 1) {
      since.current = 0
      setDaylight(HEURE ?? hourRef.current + new Date(serverNow()).getUTCMinutes() / 60)
    }
    // (With the high tier's post pass, the composer holds the renderer's curve off and does it itself.)
    if (!post) gradeOn(gl, daylight.exposure)
    const fog = scene.fog as THREE.Fog | null
    if (fog && !rain) fog.color.copy(daylight.fog)
    if (pmrem && (built.current.version !== daylight.version || built.current.rain !== rain)) {
      built.current = { version: daylight.version, rain }
      const u = sky.material.uniforms
      const grey = rain ? 0.55 : 0
      u.top.value.copy(daylight.top).lerp(daylight.fog, grey)
      u.horizon.value.copy(daylight.horizon).lerp(daylight.fog, grey)
      u.ground.value.copy(daylight.hemiGround).multiplyScalar(0.45)
      u.sunCol.value.copy(daylight.sun)
      u.sun.value.copy(daylight.dir)
      u.glow.value = rain ? 0 : daylight.glow
      const old = target.current
      target.current = pmrem.fromScene(sky.scene, 0, 0.1, 100, { size: 64 })
      scene.environment = target.current.texture
      old?.dispose()
    }
    if (env) scene.environmentIntensity = daylight.envI * (rain ? 0.7 : 1)
  })
  return null
}

/** The sky and ground fill, coloured by the hour; less of it where the environment map lights already. */
export function Fill({ tier, scale }: { tier: LumiereTier; /** The rain, a power cut at night: darker. */ scale: number }) {
  const light = useRef<THREE.HemisphereLight>(null)
  const env = tier === 'normal' || tier === 'haute'
  useFrame(() => {
    const l = light.current
    if (!l) return
    l.color.copy(daylight.hemiSky)
    l.groundColor.copy(daylight.hemiGround)
    // (By night the environment is faint: the fill stays nearly whole, the night as readable as before.)
    l.intensity = daylight.hemiI * (env ? 1 - daylight.envI * 0.67 : 1) * scale
  })
  return <hemisphereLight ref={light} />
}

/**
 * The rooms (homes, hotels, shops, big places) with « lumière réaliste »: their own lights and
 * tone curve kept (they were made for them, and the sun's preset would wash them out), only the
 * grade on top. Where a room draws its ambient occlusion, the post chain does the grade instead.
 */
export function RoomGrade() {
  const on = useLumiereOpen()
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    if (on) gradeOn(gl, 1)
  })
  useEffect(() => () => gradeOff(gl), [gl, on])
  return null
}
