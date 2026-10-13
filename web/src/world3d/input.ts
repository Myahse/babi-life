// Free movement input, shared between the on-screen pad (DOM) and the Sim's
// walker (inside the 3D canvas) without going through React state: the
// walker reads it every frame. x: right +, y: forward + (both -1…1).

export const pad = { x: 0, y: 0 }
const keys = { x: 0, y: 0 }

/** The current direction: the pad, or the keyboard when the pad is idle. */
export function moveInput() {
  return Math.hypot(pad.x, pad.y) > 0.01 ? pad : keys
}

const held = new Set<string>()
const DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, 1], KeyW: [0, 1], KeyZ: [0, 1],
  ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], KeyQ: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
}

function update() {
  let x = 0
  let y = 0
  for (const k of held) {
    x += DIRS[k][0]
    y += DIRS[k][1]
  }
  const len = Math.hypot(x, y) || 1
  keys.x = x / len
  keys.y = y / len
}

/** Arrow keys, WASD and ZQSD (AZERTY) walk the Sim; returns a cleanup. */
export function listenKeys() {
  const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
  const down = (e: KeyboardEvent) => {
    if (!DIRS[e.code] || typing(e)) return
    e.preventDefault()
    held.add(e.code)
    update()
  }
  const up = (e: KeyboardEvent) => {
    if (!held.delete(e.code)) return
    update()
  }
  const blur = () => (held.clear(), update())
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    blur()
  }
}
