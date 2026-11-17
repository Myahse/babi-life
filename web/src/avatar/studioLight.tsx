import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// The creator's lights (Stage.tsx), shared with the still pictures of a Sim (portrait.tsx).

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
