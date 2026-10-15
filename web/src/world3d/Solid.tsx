import { useEffect, useId, useRef } from 'react'
import * as THREE from 'three'
import { clearObstacles, setObstacles } from './obstacles'

/**
 * What's inside can't be walked through: once drawn, it's measured in its
 * own frame (its turned box, so the door in front stays reachable) and put
 * in the obstacles until it goes.
 */
export function Solid({ children, pad = 0 }: { children: React.ReactNode; pad?: number }) {
  const ref = useRef<THREE.Group>(null)
  const key = useId()
  useEffect(() => {
    const g = ref.current
    if (!g) return
    // A frame later, once everything inside has its geometry.
    const id = requestAnimationFrame(() => {
      g.updateWorldMatrix(true, true)
      const inv = g.matrixWorld.clone().invert()
      const box = new THREE.Box3()
      const part = new THREE.Box3()
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.geometry) return
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
        part.copy(m.geometry.boundingBox!).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
        box.union(part)
      })
      if (box.isEmpty()) return
      const c = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const at = g.localToWorld(c.clone())
      const rot = new THREE.Euler().setFromQuaternion(g.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
      setObstacles(key, [{ x: at.x, z: at.z, hw: size.x / 2 + pad, hd: size.z / 2 + pad, rot, top: at.y + size.y / 2 }])
    })
    return () => {
      cancelAnimationFrame(id)
      clearObstacles(key)
    }
  }, [key, pad])
  return <group ref={ref}>{children}</group>
}
