// The world's signs (a place's name over it) are drawn over the 3D view, so
// one can slide under the HUD's buttons and sit on them: a tap then hits the
// wrong one. A sign under a HUD control fades out until the camera moves it clear.

let rects: DOMRect[] = []
let at = 0

/** Whether a box on screen lies under one of the HUD's controls (.hud outside the 3D view). */
export function underHud(r: DOMRect) {
  const now = performance.now()
  if (now - at > 400) {
    at = now
    const view = document.querySelector('canvas')?.parentElement
    rects = [...document.querySelectorAll('.hud')].filter((e) => !view?.contains(e)).map((e) => e.getBoundingClientRect())
  }
  return rects.some((q) => Math.min(r.right, q.right) - Math.max(r.left, q.left) > 2 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 2)
}
