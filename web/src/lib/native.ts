import { t } from './i18n'
// The Babi Life app (mobile/, Flutter) runs this same game in a web view and
// lends it what a web page can't do well on a phone: Google's sign-in (it
// refuses to open inside a web view), the phone's share sheet. Outside the
// app, everything falls back to the web's own ways. It also shakes the phone
// (haptic), and its back button asks the game first (onBack).
//
// The game calls the app through the `BabiApp` channel ({id, name, arg});
// the app answers by calling window.__babiAnswer(id, result, error).

type Channel = { postMessage: (message: string) => void }
type Answer = { ok: (value: unknown) => void; fail: (error: Error) => void }

const channel = () => (window as unknown as { BabiApp?: Channel }).BabiApp
const waiting = new Map<number, Answer>()
let next = 1
;(window as unknown as { __babiAnswer: (id: number, result: unknown, error: string | null) => void }).__babiAnswer = (id, result, error) => {
  const a = waiting.get(id)
  if (!a) return
  waiting.delete(id)
  if (error) a.fail(new Error(error))
  else a.ok(result)
}

function call(name: string, arg?: string): Promise<unknown> {
  const c = channel()
  if (!c) return Promise.reject(new Error(t('not in the app')))
  const id = next++
  return new Promise((ok, fail) => {
    waiting.set(id, { ok, fail })
    c.postMessage(JSON.stringify({ id, name, arg }))
  })
}

/** In the Babi Life app (its web view says so in its user agent)? */
export const inApp = () => navigator.userAgent.includes('BabiLifeApp') || !!channel()

/** Google sign-in by the phone: the ID token for /auth/google, or null if cancelled. */
export async function nativeGoogleSignIn(): Promise<string | null> {
  const r = await call('googleSignIn')
  return typeof r === 'string' && r ? r : null
}

/** Share a text (and a link): the phone's share sheet in the app, the browser's elsewhere; false if neither. */
export async function share(text: string, url?: string): Promise<boolean> {
  if (channel()) {
    await call('share', url ? `${text} ${url}` : text)
    return true
  }
  if (navigator.share) {
    await navigator.share({ title: t('Babi Life'), text, url })
    return true
  }
  return false
}

/**
 * The app's notifications: 'status' (granted, denied or default), or
 * 'enable': Android asks (or, refused for good, its settings open), then the
 * app's Firebase token, '' if none, 'denied' if refused.
 */
export function nativeNotifications(what: 'status' | 'enable') {
  return call('notifications', what)
}

const BUZZ = { light: 12, medium: 22, heavy: 38, success: [14, 50, 14], error: [30, 40, 30] } as const
/**
 * A little shake of the phone for what happens in the game (a buoy passed, a bump, a card played): the
 * phone's own haptics in the app (no answer waited for), the browser's vibration elsewhere (Android).
 */
export function haptic(kind: keyof typeof BUZZ) {
  const c = channel()
  if (c) return c.postMessage(JSON.stringify({ name: 'haptic', arg: kind }))
  try {
    navigator.vibrate?.(BUZZ[kind] as number | number[])
  } catch {
    /* not allowed before a touch */
  }
}

// The phone's back button, in the app: it asks the game first (window.__babiBack), and the game
// closes what's open (the last one that said it would) before the app goes back a page.
const backs: (() => boolean)[] = []
;(window as unknown as { __babiBack: () => boolean }).__babiBack = () => {
  for (let i = backs.length - 1; i >= 0; i--) if (backs[i]()) return true
  return false
}
/** Back pressed: `close` closes something and says true, or says false (nothing open); returns how to stop listening. */
export function onBack(close: () => boolean) {
  backs.push(close)
  return () => {
    const i = backs.indexOf(close)
    if (i >= 0) backs.splice(i, 1)
  }
}

// A light tick under the finger on the game's buttons, like an app's: in the
// app always, in a phone's browser too (its vibration, where there is one).
if (typeof document !== 'undefined')
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return
      const b = (e.target as Element | null)?.closest?.('.btn, [role="tab"]')
      if (b && !(b as HTMLButtonElement).disabled) haptic('light')
    },
    { capture: true, passive: true },
  )
