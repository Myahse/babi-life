import { useEffect, useRef, useState } from 'react'

// Game controllers (Xbox, PlayStation, the Bluetooth pads of Android phones)
// through the browser's Gamepad API: it works in Chrome, Edge, Firefox,
// Safari and the Android app's web view. The pad isn't an event source: it
// has to be read every frame, so `useGamepad` polls it on its own animation
// frame and hands the game the sticks, what is held and what was just
// pressed. The games write that into the same input they fill from the
// keyboard and the touch buttons, so the three can be mixed.

/** The buttons of the "standard" layout, by their Xbox names (PlayStation: a ✕, b ○, x □, y △). */
export type Btn = 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'select' | 'start' | 'ls' | 'rs' | 'up' | 'down' | 'left' | 'right' | 'home'
const ORDER: Btn[] = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'select', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home']

export type PadState = {
  /** The sticks, -1…1, right and down positive; a small dead zone round the middle reads 0. */
  lx: number
  ly: number
  rx: number
  ry: number
  /** The triggers, 0…1. */
  lt: number
  rt: number
  held: Set<Btn>
  /** Pressed since the last read: a press is seen once, however short. */
  pressed: Set<Btn>
}

const DEAD = 0.18

/** A stick's two axes with a round dead zone, the rest rescaled to start from 0. */
function stick(x: number, y: number): [number, number] {
  const m = Math.hypot(x, y)
  if (m < DEAD) return [0, 0]
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m
  return [x * k, y * k]
}

/** The first pad plugged in that has the standard layout (or any, failing that). */
function firstPad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  let any: Gamepad | null = null
  for (const p of navigator.getGamepads()) {
    if (!p || !p.connected) continue
    if (p.mapping === 'standard') return p
    any ??= p
  }
  return any
}

/** Read the pad now; `was` is what was held at the last read (for the presses). */
export function readPad(was: Set<Btn>): PadState | null {
  const p = firstPad()
  if (!p) return null
  const held = new Set<Btn>()
  p.buttons.forEach((b, i) => {
    const name = ORDER[i]
    if (name && (b.pressed || b.value > 0.5)) held.add(name)
  })
  const pressed = new Set([...held].filter((b) => !was.has(b)))
  const [lx, ly] = stick(p.axes[0] ?? 0, p.axes[1] ?? 0)
  const [rx, ry] = stick(p.axes[2] ?? 0, p.axes[3] ?? 0)
  return { lx, ly, rx, ry, lt: p.buttons[6]?.value ?? 0, rt: p.buttons[7]?.value ?? 0, held, pressed }
}

/**
 * Calls `onPad` every frame while a pad is plugged in (and `on`), with its
 * state. `onPad` is read through a ref: it may change every render.
 */
export function useGamepad(onPad: (p: PadState) => void, on = true) {
  const cb = useRef(onPad)
  cb.current = onPad
  useEffect(() => {
    if (!on || typeof window === 'undefined') return
    let raf = 0
    let was = new Set<Btn>()
    const tick = () => {
      const s = readPad(was)
      if (s) {
        was = s.held
        cb.current(s)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on])
}

/** Whether a pad is plugged in (for the screen to show its buttons instead of the touch ones' hints). */
export function usePadConnected() {
  const [on, setOn] = useState(() => !!firstPad())
  useEffect(() => {
    const check = () => setOn(!!firstPad())
    window.addEventListener('gamepadconnected', check)
    window.addEventListener('gamepaddisconnected', check)
    // Some browsers only list a pad once a button is pressed, without the event: look now and then.
    const t = setInterval(check, 2000)
    return () => {
      window.removeEventListener('gamepadconnected', check)
      window.removeEventListener('gamepaddisconnected', check)
      clearInterval(t)
    }
  }, [])
  return on
}

/** A short rumble, where the pad and the browser can (a goal, a hit, a crash); nothing elsewhere. */
export function rumble(strength = 0.6, ms = 140) {
  const p = firstPad() as (Gamepad & { vibrationActuator?: { playEffect?: (k: string, o: object) => Promise<unknown> } }) | null
  p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: Math.min(1, strength + 0.2) }).catch(() => undefined)
}

/**
 * A stick that hands back to the keyboard and the touch buttons: it writes
 * its value while pushed and once more when let go (to stop), then leaves the
 * input alone.
 */
export function stickOwner() {
  let owned = false
  return (x: number, y: number, write: (x: number, y: number) => void) => {
    if (x || y) {
      owned = true
      write(x, y)
    } else if (owned) {
      owned = false
      write(0, 0)
    }
  }
}
