import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { whereabouts } from './whereabouts'
import { photoCam, usePhotoMode } from './photoCam'

// A photo of the game, for a story or a Tikitoko post: the 3D drawn once
// more and read straight away (the canvas keeps nothing between frames),
// shrunk to 720 px and saved as a JPEG. <Snapper /> sits in each 3D scene.

let snap: (() => HTMLCanvasElement | null) | null = null
/**
 * The phone's own view while its camera is open (PhotoView): it takes the
 * photo, whichever scene's Snapper set `snap` last (a scene and the camera
 * mounted together, as when Flashé opens with the game: the child's effect
 * runs first, the scene's after it).
 */
let viewSnap: (() => HTMLCanvasElement | null) | null = null

/**
 * A Tikitoko clip being filmed (world3d/clip.ts): each frame the 3D draws is
 * handed over right after it's drawn (the canvas keeps nothing after that).
 * street: which scene it wants, the street or the room the Sim is in (both
 * can be mounted, the street hidden under the room).
 */
type FrameTap = { street: boolean; frame: (c: HTMLCanvasElement) => void }
let tap: FrameTap | null = null
const tapListeners = new Set<() => void>()
export function setFrameTap(t: FrameTap | null) {
  tap = t
  tapListeners.forEach((f) => f())
}
const useFrameTap = () => useSyncExternalStore((f) => (tapListeners.add(f), () => void tapListeners.delete(f)), () => tap)

export function Snapper({ street }: { /** The open street: the phone's camera can be held anywhere round the Sim. */ street?: boolean }) {
  const { gl, scene, camera } = useThree()
  const mode = usePhotoMode()
  const tapping = useFrameTap()
  useEffect(() => {
    snap = () => {
      gl.render(scene, camera)
      return gl.domElement
    }
    return () => void (snap = null)
  }, [gl, scene, camera])
  return (
    <>
      {street && mode && <PhotoView />}
      {tapping && tapping.street === !!street && <Tap />}
    </>
  )
}

/**
 * Hands each frame to the clip. With a priority above 0 here, the canvas no
 * longer draws itself: when nobody else drew this frame (the phone's camera,
 * the screen effects), it's drawn here first.
 */
function Tap() {
  const { gl, scene, camera } = useThree()
  const last = useRef(-1)
  useFrame(() => {
    if (gl.info.render.frame === last.current) gl.render(scene, camera)
    last.current = gl.info.render.frame
    tap?.frame(gl.domElement)
  }, 2)
  return null
}

/** Eye height of a grown-up Sim (world3d/Character.tsx: 2.15 m to the top of the head). */
const HEAD = 1.8

/**
 * While the camera app is open in the street: the scene is drawn from the
 * phone (a camera of its own, so the street's camera and its controls are
 * left as they were), every frame, and that's what a photo takes.
 */
function PhotoView() {
  const { gl, scene, size } = useThree()
  const cam = useMemo(() => new THREE.PerspectiveCamera(60, 1, 0.1, 4000), [])
  const place = () => {
    const [x, z] = whereabouts.sim
    const y = whereabouts.simY
    const h = whereabouts.simHeading
    if (photoCam.mode === 'film') {
      // On a stand a few steps ahead at chest height, the Sim whole in the frame (a Tikitoko clip).
      const a = h + photoCam.yaw
      const d = 3.4
      cam.position.set(x + Math.sin(a) * d, y + 1.25, z + Math.cos(a) * d)
      cam.lookAt(x, y + 1.05, z)
      cam.fov = 50
    } else if (photoCam.mode === 'selfie') {
      // Held out in front, a little above the head, looking back at the face.
      const a = h + photoCam.yaw
      const d = 1.5
      cam.position.set(x + Math.sin(a) * d, y + HEAD + 0.25 + photoCam.pitch * 1.2, z + Math.cos(a) * d)
      cam.lookAt(x, y + HEAD - 0.45, z)
      cam.fov = 62 / photoCam.zoom
    } else {
      // From the eyes (a step ahead, out of the head), the way the Sim faces.
      const a = h + photoCam.yaw
      cam.position.set(x + Math.sin(h) * 0.45, y + HEAD + 0.05, z + Math.cos(h) * 0.45)
      const p = Math.max(-0.9, Math.min(0.9, photoCam.pitch))
      cam.lookAt(cam.position.x + Math.sin(a) * Math.cos(p), cam.position.y - Math.sin(p), cam.position.z + Math.cos(a) * Math.cos(p))
      cam.fov = 58 / photoCam.zoom
    }
    cam.aspect = size.width / Math.max(1, size.height)
    cam.updateProjectionMatrix()
  }
  useEffect(() => {
    viewSnap = () => {
      place()
      gl.render(scene, cam)
      return gl.domElement
    }
    return () => void (viewSnap = null)
  }, [gl, scene, cam]) // eslint-disable-line react-hooks/exhaustive-deps
  // A priority above 0: this draws the frame (the canvas's own drawing pauses while the camera is open).
  useFrame(() => {
    place()
    gl.render(scene, cam)
  }, 1)
  return null
}

/** Shrink an image or canvas to at most 720 px wide, as a JPEG data URL. */
export function shrink(src: CanvasImageSource & { width: number; height: number }, max = 720) {
  const k = Math.min(1, max / Math.max(src.width, src.height))
  const c = document.createElement('canvas')
  c.width = Math.round(src.width * k)
  c.height = Math.round(src.height * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

/** A photo of what's on screen in the game, or null when no 3D is showing. */
export function takePhoto(): string | null {
  const c = (viewSnap ?? snap)?.()
  return c && c.width > 0 ? shrink(c) : null
}

/** A photo from the phone's gallery (when the server allows real photos), shrunk the same way. */
export function readPhoto(file: File): Promise<string> {
  return new Promise((ok, fail) => {
    const img = new Image()
    img.onload = () => (ok(shrink(img)), URL.revokeObjectURL(img.src))
    img.onerror = fail
    img.src = URL.createObjectURL(file)
  })
}

/** The place the Sim stands at (within 60 m of its door), for where a video is filmed. */
export function placeHere() {
  const [x, z] = whereabouts.sim
  let best: { id: string; d: number } | null = null
  for (const p of whereabouts.places) {
    const d = Math.hypot(p.door[0] - x, p.door[1] - z)
    if (d < 60 && (!best || d < best.d)) best = { id: p.id, d }
  }
  return best?.id ?? ''
}
