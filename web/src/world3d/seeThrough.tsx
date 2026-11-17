import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// The player's Sim (and the « À faire maintenant » light) seen through what stands in front of it: from the raised
// cameras (the quartier's `sims`, the city's view from above) a tree's crown or a roof can hide it. Where something
// does, its shape is drawn again over it, flat and see-through, as a life-sim shows its Sims behind the walls.
//
// Cheap: no second Sim, no stencil. The same meshes are drawn once more at the end of the frame (after everything
// else) with one plain material that only passes where the depth already there is NEARER than the Sim (depthFunc
// GreaterDepth): only the hidden parts show. The shape is pulled a little towards the camera first, so the Sim's
// own arm behind its body (a few dozen centimetres) never counts as « hidden »; a tree or a roof a metre and more in
// front does.

/** How far (m) the shape is pulled towards the camera: more than a Sim is thick, less than what hides it. */
const PULL = 0.7

/** The see-through material: one colour, translucent, drawn only where something nearer stands. */
export function xrayMaterial(color: string, opacity: number) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false, toneMapped: false })
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\nmvPosition.z += ${PULL.toFixed(2)};\ngl_Position = projectionMatrix * mvPosition;`)
  }
  m.customProgramCacheKey = () => 'xray'
  return m
}

const tiny = (() => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3))
  return g
})()

/**
 * Draws what's under `of` (its visible, opaque meshes) see-through where something hides it, while the camera is
 * further than `from` metres from it (up close the cameras keep clear of the walls themselves: nothing to do).
 */
export function SeeThrough({ of, color = '#8fe9ff', opacity = 0.42, from = 7 }: { of: React.RefObject<THREE.Object3D | null>; color?: string; opacity?: number; from?: number }) {
  const mat = useMemo(() => xrayMaterial(color, opacity), [color, opacity])
  const hook = useRef<THREE.Mesh>(null)
  const mainCam = useThree((s) => s.camera)
  // The meshes to draw again, gathered once a frame (no allocation: the list reused).
  const list = useRef<THREE.Mesh[]>([])
  const on = useRef(false)
  const at = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ camera }) => {
    const o = of.current
    const l = list.current
    l.length = 0
    on.current = false
    if (!o || !o.visible) return
    o.getWorldPosition(at)
    if (at.distanceTo(camera.position) < from) return
    o.traverseVisible((x) => {
      const m = x as THREE.Mesh
      if (!m.isMesh || !m.geometry) return
      const mm = m.material as THREE.Material | THREE.Material[]
      // (Glows, auras and shadows on the ground: not the Sim's shape.)
      if (Array.isArray(mm) ? mm.some((q) => q.transparent) : !mm || mm.transparent) return
      l.push(m)
    })
    on.current = l.length > 0
  })
  useEffect(() => {
    const h = hook.current
    if (!h) return
    // Called once the whole scene's opaque and transparent parts are drawn (this hook is the last thing drawn):
    // the depth of every tree and roof is there.
    h.onAfterRender = (gl, scene, camera) => {
      if (!on.current || camera !== mainCam) return
      for (const m of list.current) {
        m.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, m.matrixWorld)
        m.normalMatrix.getNormalMatrix(m.modelViewMatrix)
        const groups = Array.isArray(m.material) ? m.geometry.groups : null
        if (groups?.length) for (const g of groups) gl.renderBufferDirect(camera, scene, m.geometry, mat, m, g)
        else gl.renderBufferDirect(camera, scene, m.geometry, mat, m, null as unknown as THREE.GeometryGroup)
      }
    }
  }, [mat, mainCam])
  // (Its own triangle is empty: nothing of it shows; drawn last, with the transparent things.)
  return (
    <mesh ref={hook} geometry={tiny} frustumCulled={false} renderOrder={100000}>
      <meshBasicMaterial transparent depthWrite={false} depthTest={false} colorWrite={false} />
    </mesh>
  )
}
