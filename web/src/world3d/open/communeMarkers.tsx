import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Commune } from '../../lib/types'
import { toLocal, type Origin } from './geo'

// Zoomed out over the city, each commune's name on a tall pin over its
// middle (the one the Sim is in, in orange): they come in as the camera
// rises above the roofs and keep the same size on the screen however far.

/** Camera heights (m) between which the markers fade in. */
const FROM = 260
const FULL = 420
/** The label's height over the ground, and its width on the screen (a share of the distance). */
const TOP = 160
const SIZE = 0.15
/** No marker drawn further than this from the camera (it draws up to 6 km). */
const NEAR = 4500

function label(name: string, here: boolean) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.font = '800 54px sans-serif'
  const w = Math.min(500, g.measureText(name).width + 110)
  const x0 = (512 - w) / 2
  g.fillStyle = here ? '#ff7a00' : '#ffffff'
  g.beginPath()
  g.roundRect(x0, 14, w, 100, 50)
  g.fill()
  // The pin's dot, then the name.
  g.fillStyle = here ? '#ffffff' : '#ff7a00'
  g.beginPath()
  g.arc(x0 + 46, 64, 15, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = here ? '#ffffff' : '#141416'
  g.textBaseline = 'middle'
  g.fillText(name, x0 + 76, 66)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function CommuneMarkers({ communes, origin, here }: { communes: Commune[]; origin: Origin; here: string }) {
  const marks = useMemo(
    () =>
      communes.map((c) => {
        const [x, z] = toLocal(origin, c.lat, c.lng)
        const map = label(c.name, c.id === here)
        return { id: c.id, x, z, sprite: new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, opacity: 0, fog: false }), pin: new THREE.MeshBasicMaterial({ color: c.id === here ? '#ff7a00' : '#ffffff', transparent: true, depthWrite: false, opacity: 0, fog: false }) }
      }),
    [communes, origin, here],
  )
  const camera = useThree((s) => s.camera)
  const at = useMemo(() => new THREE.Vector3(), [])
  const group = useRef<THREE.Group>(null)
  const sprites = useRef<(THREE.Sprite | null)[]>([])
  const pins = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const k = Math.min(1, Math.max(0, (camera.position.y - FROM) / (FULL - FROM)))
    if (group.current) group.current.visible = k > 0
    if (k === 0) return
    marks.forEach((m, i) => {
      m.sprite.opacity = k
      m.pin.opacity = k * 0.7
      const s = sprites.current[i]
      const p = pins.current[i]
      at.set(m.x, TOP, m.z)
      let d = camera.position.distanceTo(at)
      // Far off, low over its commune: on the horizon rather than up in the sky.
      if (d > NEAR) at.y = 40
      // Kilometres off, past what the camera draws: brought nearer along the same line of sight (the same place and size on
      // the screen), without its pin.
      const pulled = d > NEAR
      if (pulled) {
        at.sub(camera.position).multiplyScalar(NEAR / d).add(camera.position)
        d = NEAR
      }
      if (s) {
        s.position.set(at.x - m.x, at.y, at.z - m.z)
        // Standing on the pin's top (the label's foot there).
        s.scale.set(d * SIZE, d * SIZE * 0.25, 1)
        s.center.set(0.5, 0.08)
      }
      // The pin: as thin on the screen as the distance allows.
      if (p) (p.visible = !pulled, p.scale.set(d * 0.0016, 1, d * 0.0016))
    })
  })
  return (
    <group ref={group} visible={false}>
      {marks.map((m, i) => (
        <group key={m.id} position={[m.x, 0, m.z]}>
          <mesh ref={(p) => void (pins.current[i] = p)} position={[0, TOP / 2, 0]} material={m.pin} renderOrder={998}>
            <cylinderGeometry args={[1, 1, TOP, 6]} />
          </mesh>
          <sprite ref={(s) => void (sprites.current[i] = s)} position={[0, TOP, 0]} material={m.sprite} renderOrder={999} />
        </group>
      ))}
    </group>
  )
}
