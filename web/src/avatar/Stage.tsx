import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Look, Sim } from '../lib/types'
import { Baby, FullDetail, Human, type Pose } from './Human'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { usePersos } from './persos'
import { sizeOf } from '../world3d/Character'
import { lookAt } from './options'

// The creator's turntable: the Sim on a round podium, drag to spin it.
// `focus` glides the camera between the whole body and a close-up of the face.

export type Focus = 'body' | 'face' | 'outfit'

const SHOTS: Record<Focus, { y: number; dist: number }> = {
  body: { y: 0.92, dist: 4.4 },
  outfit: { y: 1.0, dist: 3.6 },
  face: { y: 1.5, dist: 1.25 },
}

// A baby sitting on the podium (at 1.5×): its own shots.
const BABY_SHOTS: Record<Focus, { y: number; dist: number }> = {
  body: { y: 0.5, dist: 2.5 },
  outfit: { y: 0.5, dist: 2.3 },
  face: { y: 0.72, dist: 1.4 },
}

function Rig({ focus, height, baby, back = 1 }: { focus: Focus; height: number; baby?: boolean; /** Further back (a child's big head). */ back?: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const want = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    if (!controls) return
    const shot = (baby ? BABY_SHOTS : SHOTS)[focus]
    const k = 1 - Math.exp(-dt * 5)
    controls.target.lerp(want.current.set(0, shot.y * height, 0), k)
    const dir = camera.position.clone().sub(controls.target).normalize()
    const dist = camera.position.distanceTo(controls.target)
    camera.position.copy(controls.target).add(dir.multiplyScalar(THREE.MathUtils.lerp(dist, shot.dist * height * back, k)))
    controls.update()
  })
  return null
}

/**
 * « persos-realistes »: the creator lit like a photo studio: a soft room as the sky light (an
 * environment map, made once), a key from the front, a fill so dark skin keeps its shape on the
 * shadow side, a warm rim behind to cut the silhouette out, softer shadows.
 *
 * The lights are near white and the tone mapping linear: the lit cheek of each of the 13 skin tones
 * comes out within ΔE 2 of the swatch the player picked (it was up to 10 under a warm key and the
 * street's filmic grade, which pushed the mid tones orange and greyed the darkest ones; measured with
 * avatar.html?view=skins). The materials' low specular (detail/real.ts matte) does the rest.
 */
export function StudioLight() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pm.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.32
    const [tm, exposure] = [gl.toneMapping, gl.toneMappingExposure]
    gl.toneMapping = THREE.LinearToneMapping
    gl.toneMappingExposure = 1
    return () => {
      scene.environment = null
      env.dispose()
      pm.dispose()
      room.clear()
      gl.toneMapping = tm
      gl.toneMappingExposure = exposure
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={['#ffffff', '#a8a098', 0.35]} />
      <directionalLight position={[2.2, 3.6, 3.2]} intensity={1.7} color="#fff8f2" castShadow shadow-mapSize={[1024, 1024]} shadow-radius={4} shadow-bias={-0.0004} />
      <directionalLight position={[-3, 1.6, 2]} intensity={0.5} color="#f4f2ff" />
      <directionalLight position={[-1.5, 2.6, -3.5]} intensity={1.3} color="#ffd6a8" />
    </>
  )
}

/** The creator's lights while « persos-realistes » is shut. */
export function PlainLight() {
  return (
    <>
      <hemisphereLight args={['#fff4e6', '#c0704f', 1.2]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.9} color="#ffd1a6" />
      <ambientLight intensity={0.45} />
    </>
  )
}

export function Stage({ look, gender, focus = 'body', pose = 'idle', className = '', baby = false, stage }: { look: Look; gender: Sim['gender']; focus?: Focus; pose?: Pose; className?: string; /** Show the Sim as the baby it will be born. */ baby?: boolean; /** Show the Sim at its age, in what fits it (« Changer de look »). */ stage?: string }) {
  const young = stage && stage !== 'adulte' && stage !== 'bebe' ? sizeOf(stage) : null
  const worn = stage ? lookAt(look, stage) : look
  // The camera frames a child as small as it is.
  const h = stage === 'bebe' ? 1 : (look.height ?? 1) * (young ? young.scale * 1.08 : 1)
  const real = usePersos() !== 'off'
  return (
    <Canvas className={className} shadows={real ? 'soft' : true} dpr={[1, 2]} camera={{ position: [0.9, 1.1, 4.3], fov: 28 }} gl={{ antialias: true, alpha: true }}>
      {real ? <StudioLight /> : <PlainLight />}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.75, 0.82, 0.08, 64]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.66, 0.74, 64]} />
        <meshBasicMaterial color="#ff9a2e" />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={2.4} blur={2.5} far={1.5} />
      <FullDetail.Provider value={real}>
      {baby || stage === 'bebe' ? (
        <group scale={stage === 'bebe' ? 1.5 : 2.6}>
          <Baby look={worn} fitted={!!stage} gender={gender} pose="busy" />
        </group>
      ) : young ? (
        <group scale={young.scale}>
          <Human look={worn} fitted gender={gender} pose={pose} headScale={young.head} />
        </group>
      ) : (
        <Human look={worn} gender={gender} pose={pose} />
      )}
      </FullDetail.Provider>
      <OrbitControls makeDefault enablePan={false} enableZoom={false} minPolarAngle={1.05} maxPolarAngle={1.75} rotateSpeed={0.7} />
      <Rig focus={focus} height={h} baby={stage === 'bebe'} back={young?.head} />
    </Canvas>
  )
}
