import * as THREE from 'three'

// A canvas to paint on (a Sim's clothes, a shop's sign, the windows' lights) and what three.js
// draws from it: the browser's own here; in the app (native/), canvas.native.ts paints the same
// with Skia and hands three.js the pixels.

/** A picture to paint with: the browser's own (the app has its own, canvas.native.ts). */
export const SkImageElement = globalThis.Image

/** A blank canvas this size. */
export function newCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

/** The texture of a painted canvas (painted again later: `needsUpdate = true`, as ever). */
export const canvasTexture = (c: HTMLCanvasElement): THREE.Texture => new THREE.CanvasTexture(c)

/** A painted canvas as a picture for the page (a swatch): a data URL. */
export const canvasUrl = (c: HTMLCanvasElement) => c.toDataURL()
