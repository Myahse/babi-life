import { useSyncExternalStore } from 'react'
import { featuresKnown, keyOpenNow, onFeatures } from './features'

// « Téléphone léger » (the update « telephone-leger »): the street's 3D cut down for the cheap Android
// phones, where it lagged. Fewer pixels, no shadows, the city's edge closer in the haze, fewer
// passers-by, cars, birds and planes, no bloom (world3d/open/OpenWorld.tsx and its parts read it).
// On by itself on a phone with few cores or little memory, or one measured slow in its first seconds
// of street (SlowProbe); the player's choice in Réglages (Auto / Léger / Normal) wins. While the
// update is shut, or on a phone that keeps up, nothing changes at all.

export const LIGHT_PHONE = 'telephone-leger'
export type LightChoice = 'auto' | 'leger' | 'normal'
const CHOICE_KEY = 'babi.telLeger'
/** The update open, as the server said last time (the street's sizes can't wait for its answer). */
const HEARD_KEY = 'babi.telLeger.ouvert'
/** This phone was measured slow in the street (kept: measured once). */
const SLOW_KEY = 'babi.telLeger.lent'
/** Under this many frames a second in the street, the phone is slow. */
export const SLOW_FPS = 25

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function write(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    // Private mode: for this time only.
  }
}

const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number })
/** Few cores or little memory: the cheap Android phones. */
export const weakHardware = !!nav && ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3)

let choice: LightChoice = (() => {
  const c = read(CHOICE_KEY)
  return c === 'leger' || c === 'normal' ? c : 'auto'
})()
let slow = read(SLOW_KEY) === '1'
const open = () => (featuresKnown() ? keyOpenNow(LIGHT_PHONE) : read(HEARD_KEY) === '1')
const compute = () => open() && (choice === 'leger' || (choice === 'auto' && (weakHardware || slow)))

let light = compute()
/** As it was when the game opened: for what is sized once (the canvas's antialiasing, the sky's birds and planes, the Plateau's crowd). */
export const lightAtStart = light
const listeners = new Set<() => void>()
function update() {
  const now = compute()
  if (now === light) return
  light = now
  listeners.forEach((f) => f())
}
onFeatures(() => {
  if (featuresKnown()) write(HEARD_KEY, keyOpenNow(LIGHT_PHONE) ? '1' : '0')
  update()
})

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => void listeners.delete(f)
}
/** The street drawn light now (followed: it can come on in the first seconds of street). */
export const useLightPhone = () => useSyncExternalStore(subscribe, () => light)
export const lightPhoneNow = () => light
/** The setting is shown (the update open). */
export const useLightPhoneOpen = () => useSyncExternalStore(onFeatures, open)

/** The player's choice in Réglages (followed). */
export const useLightChoice = () => useSyncExternalStore(subscribe, () => choice)
/** The player's choice in Réglages: applied at once. */
export function setLightChoice(c: LightChoice) {
  choice = c
  write(CHOICE_KEY, c === 'auto' ? null : c)
  light = compute()
  listeners.forEach((f) => f())
}

/** Whether to measure this phone in the street: only where « Auto » could still turn it on. */
export const shouldProbe = () => open() && choice === 'auto' && !weakHardware && !slow
/** The frames a second measured in the street's first seconds: under SLOW_FPS, light from now on. */
export function reportFps(fps: number) {
  if (fps >= SLOW_FPS || slow) return
  slow = true
  write(SLOW_KEY, '1')
  update()
}
