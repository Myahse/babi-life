import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { whereabouts } from './whereabouts'

// A photo of the game, for a story or a Tikitoko post: the 3D drawn once
// more and read straight away (the canvas keeps nothing between frames),
// shrunk to 720 px and saved as a JPEG. <Snapper /> sits in each 3D scene.

let snap: (() => HTMLCanvasElement | null) | null = null

export function Snapper() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    snap = () => {
      gl.render(scene, camera)
      return gl.domElement
    }
    return () => void (snap = null)
  }, [gl, scene, camera])
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
  const c = snap?.()
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
