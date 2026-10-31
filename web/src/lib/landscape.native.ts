import { useEffect, useState } from 'react'
import { Dimensions } from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation'

// Playing sideways in the app (native/; React Native picks this file over landscape.ts): the app
// opens upright (app.json), and turns to landscape only when the player turned « Jouer en
// paysage » on in the phone's « Réglages ». The app turns the screen itself (expo-screen-orientation):
// no full screen to ask for, no « tourne ton téléphone ». Turned, the game is drawn anew in its new
// shape (its styles are read for the screen as it is: native/src/dom/tw.ts).

const KEY = 'babi.paysage'
const CHANGED = 'babi:paysage'

export function landscapeOn() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** The app always can. */
export const canLock = () => true

const wide = () => {
  const d = Dimensions.get('window')
  return d.width > d.height
}

/** The screen locked as the setting says (sideways or upright): once the window has turned (or after a second and a half). */
export async function applyOrientation(on = landscapeOn()): Promise<boolean> {
  try {
    await ScreenOrientation.lockAsync(on ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP)
  } catch {
    return false
  }
  if (wide() === on) return true
  await new Promise<void>((done) => {
    const end = () => {
      sub.remove()
      clearTimeout(late)
      done()
    }
    const sub = Dimensions.addEventListener('change', () => wide() === on && end())
    const late = setTimeout(end, 1500)
  })
  return true
}

export const lockLandscape = () => applyOrientation(true)

export async function setLandscape(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* nothing kept: for this time only */
  }
  window.dispatchEvent(new Event(CHANGED))
  const done = await applyOrientation(on)
  // The game drawn anew for the screen's new shape (as a change of language does).
  location.reload()
  return done
}

export function useLandscape() {
  const [on, setOn] = useState(landscapeOn)
  useEffect(() => {
    const again = () => setOn(landscapeOn())
    window.addEventListener(CHANGED, again)
    return () => window.removeEventListener(CHANGED, again)
  }, [])
  return on
}

/** Never « tourne ton téléphone » in the app: it turns the screen itself. */
export const usePortraitNow = () => false
