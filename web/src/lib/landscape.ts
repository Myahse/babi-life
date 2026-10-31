import { useEffect, useState } from 'react'
import { askApp, inApp } from './native'

// Playing on a phone held sideways (the phone's « Réglages » app, screens/Play.tsx):
// the choice kept on this phone; when it's on, the game asks the browser for the
// whole screen and turns it to landscape at the next touch (a browser only does
// it on a touch, and only full screen). Where it can't (an iPhone's Safari), the
// player is asked to turn the phone (LandscapeHint). In the app (its web view), the app turns it.

const KEY = 'babi.paysage'
const CHANGED = 'babi:paysage'

export function landscapeOn() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Whether this browser can turn the screen itself (Android's Chrome, the app). */
export const canLock = () => inApp() || (typeof screen !== 'undefined' && !!(screen.orientation as ScreenOrientation & { lock?: unknown })?.lock && !!document.documentElement.requestFullscreen)

/** Full screen, then landscape: false when the browser won't (no touch yet, an iPhone). */
export async function lockLandscape(): Promise<boolean> {
  try {
    if (inApp()) return !!(await askApp('orientation', 'landscape'))
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    await (screen.orientation as ScreenOrientation & { lock: (o: string) => Promise<void> }).lock('landscape')
    return true
  } catch {
    return false
  }
}

export async function setLandscape(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* private window: for this time only */
  }
  window.dispatchEvent(new Event(CHANGED))
  if (on) return lockLandscape()
  if (inApp()) return !!(await askApp('orientation', 'portrait').catch(() => false))
  try {
    ;(screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.()
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* already left */
  }
  return true
}

export function useLandscape() {
  const [on, setOn] = useState(landscapeOn)
  useEffect(() => {
    const again = () => setOn(landscapeOn())
    window.addEventListener(CHANGED, again)
    return () => window.removeEventListener(CHANGED, again)
  }, [])
  // On: back to landscape at the next touch (opening the game, or after leaving full screen).
  useEffect(() => {
    if (!on || !canLock()) return
    // (The app turns the screen at once, and it stays turned.)
    if (inApp()) return void lockLandscape()
    const touch = () => {
      if (!document.fullscreenElement || !String(screen.orientation?.type).startsWith('landscape')) void lockLandscape()
    }
    window.addEventListener('pointerdown', touch)
    return () => window.removeEventListener('pointerdown', touch)
  }, [on])
  return on
}

/** The phone held upright while the landscape is asked for, where the browser can't turn it: « tourne ton téléphone ». */
export function usePortraitNow() {
  const query = '(orientation: portrait) and (pointer: coarse)'
  const [portrait, setPortrait] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setPortrait(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return portrait
}
