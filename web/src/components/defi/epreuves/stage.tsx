import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { sceneDpr, weakDevice } from '../../../lib/device'

// The épreuves in the game's 3D blocks (the ones redone from their 2D drawings): one canvas the size of the
// screen, the camera set by the game, the street's daylight, and the finger read straight on the scene: the
// game gets where it touches on a level of the scene (`groundAt`: the table's top, the floor) and where a
// thing of the scene is on the screen (`screenOf`, for the kit's bursts and words, fx.good / fx.bad). The
// finger is heard on the canvas's own element (down, move, up), the scene's objects found by distance on
// that level: no raycast per object, cheap on a phone.

const S = { camera: null as THREE.Camera | null, w: 1, h: 1, el: null as HTMLElement | null }
const ray = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const tmp = new THREE.Vector3()

/** Where the finger (in px, from the canvas's corner) meets the level y of the scene, into `out` (false: it misses). */
export function groundAt(x: number, y: number, level: number, out: THREE.Vector3) {
  if (!S.camera) return false
  ndc.set((x / S.w) * 2 - 1, -(y / S.h) * 2 + 1)
  ray.setFromCamera(ndc, S.camera)
  plane.constant = -level
  return !!ray.ray.intersectPlane(plane, out)
}

/** Where a point of the scene is on the screen, in px from the canvas's corner (for the kit's effects). */
export function screenOf(x: number, y: number, z: number) {
  if (!S.camera) return { x: S.w / 2, y: S.h / 2 }
  tmp.set(x, y, z).project(S.camera)
  return { x: ((tmp.x + 1) / 2) * S.w, y: ((1 - tmp.y) / 2) * S.h }
}

const dir = new THREE.Vector3()
/**
 * Keeps the camera's own direction, pulled back just enough that a box `fit` [width, depth] round `look`
 * stays in the picture whatever the screen's shape (a tall phone, a wide computer).
 */
function Bridge({ cam, look, fit }: { cam: [number, number, number]; look: [number, number, number]; fit?: [number, number] }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  S.camera = camera
  S.w = size.width
  S.h = size.height
  useLayoutEffect(() => {
    if (!fit) return
    dir.set(cam[0] - look[0], cam[1] - look[1], cam[2] - look[2]).normalize()
    const v = THREE.MathUtils.degToRad(camera.fov) / 2
    const h = Math.atan(Math.tan(v) * (size.width / Math.max(1, size.height)))
    // The width across, the depth seen at a slant (its height on the picture is the depth times the camera's tilt).
    const tilt = Math.max(0.3, Math.hypot(dir.x, dir.y))
    const d = Math.max(fit[0] / 2 / Math.tan(h), (fit[1] * tilt) / 2 / Math.tan(v)) * 1.04
    camera.position.set(look[0] + dir.x * d, look[1] + dir.y * d, look[2] + dir.z * d)
    camera.lookAt(...look)
    camera.updateMatrixWorld()
  }, [size.width, size.height]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Calls `onReady` once the scene has really been drawn twice (the first draws compile the blocks' shaders, long on a phone). */
function Ready({ onReady }: { onReady?: () => void }) {
  const n = useRef(0)
  useFrame(() => {
    if (++n.current === 3) onReady?.()
  })
  return null
}

export type Finger = { kind: 'down' | 'move' | 'up'; x: number; y: number }

/**
 * The scene: `cam` where the camera stands (its direction, when `fit` sets its distance), `look` what it looks at, the sky's colour `bg`; `touch` hears
 * the finger (px from the canvas's corner). Daylight from above and in front, flat-shaded blocks.
 */
export function Stage3D({ children, cam = [0, 6, 6], look = [0, 0, 0], fov = 45, fit, bg, touch, light = 1, onReady }: { /** The scene is on the screen: the game's clock can start. */ onReady?: () => void; children: ReactNode; cam?: [number, number, number]; look?: [number, number, number]; fov?: number; /** The [width, depth] of the scene to keep in the picture (the camera pulled back along its direction to fit). */ fit?: [number, number]; bg?: string; touch?: (f: Finger) => void; light?: number }) {
  const hear = useRef(touch)
  hear.current = touch
  const box = useRef<HTMLDivElement>(null)
  const at = (e: React.PointerEvent, kind: Finger['kind']) => {
    const r = box.current!.getBoundingClientRect()
    hear.current?.({ kind, x: e.clientX - r.left, y: e.clientY - r.top })
  }
  return (
    <div
      ref={box}
      className="absolute inset-0 touch-none select-none"
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        at(e, 'down')
      }}
      onPointerMove={(e) => at(e, 'move')}
      onPointerUp={(e) => at(e, 'up')}
      onPointerCancel={(e) => at(e, 'up')}
    >
      <Canvas dpr={weakDevice ? 1 : sceneDpr} gl={{ antialias: !weakDevice, powerPreference: 'low-power' }} camera={{ position: cam, fov }} onCreated={({ camera }) => camera.lookAt(...look)}>
        {bg && <color attach="background" args={[bg]} />}
        <hemisphereLight args={['#fff7e6', '#6b4a2a', 1.3 * light]} />
        <directionalLight position={[3, 8, 5]} intensity={1.5 * light} />
        <ambientLight intensity={0.25 * light} />
        <Bridge cam={cam} look={look} fit={fit} />
        <Ready onReady={onReady} />
        {children}
      </Canvas>
    </div>
  )
}

/** Smooth toward a target, the same at any frame rate. */
export const ease = (v: number, to: number, rate: number, dt: number) => v + (to - v) * (1 - Math.exp(-rate * dt))
