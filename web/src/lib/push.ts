import { api } from './api'
import { inApp, nativeNotifications } from './native'

// Notifications on the phone (backend internal/push): a new message on
// Gbairai, a bet whose matches are over. On the site, the browser's Web Push
// (installed on the home screen or not); in the Android app, the app's own
// (Firebase). The game asks once, then the player can turn them on later from
// the Gbairai and betting apps; refused, they're turned on in the phone's
// settings.

export type PushState = 'on' | 'off' | 'denied' | 'unsupported'

const ASKED = 'babi.pushAsked'

const webSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Where the notifications stand on this phone or browser. */
export async function pushState(): Promise<PushState> {
  if (inApp()) {
    try {
      const r = (await nativeNotifications('status')) as string
      return r === 'granted' ? 'on' : r === 'denied' ? 'denied' : 'off'
    } catch {
      return 'unsupported'
    }
  }
  if (!webSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off'
}

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/**
 * Asks the phone for notifications and tells the server where to send them.
 * 'on' when they're on; 'denied' when refused (then: the phone's settings).
 */
export async function enablePush(): Promise<PushState> {
  try {
    localStorage.setItem(ASKED, String(Date.now()))
  } catch {
    /* private browsing */
  }
  if (inApp()) {
    // The app asks Android itself (and opens its settings when refused for good), then gives its token.
    const token = (await nativeNotifications('enable')) as string
    if (token === 'denied') return 'denied'
    if (!token) return 'off'
    await api.subscribePush({ kind: 'fcm', token })
    return 'on'
  }
  if (!webSupported()) return 'unsupported'
  const { key, web } = await api.pushKey()
  if (!web || !key) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }))
  await api.subscribePush({ kind: 'web', ...sub.toJSON() })
  return 'on'
}

/** Whether to ask now: never asked, or not for a week after « Plus tard ». */
export function shouldAsk() {
  try {
    const at = Number(localStorage.getItem(ASKED) ?? 0)
    return Date.now() - at > 7 * 24 * 3600 * 1000
  } catch {
    return false
  }
}

export function askLater() {
  try {
    localStorage.setItem(ASKED, String(Date.now()))
  } catch {
    /* private browsing */
  }
}

/** Where to turn them on once refused, said simply for each phone. */
export const SETTINGS_HELP = inApp()
  ? 'Ouvre les Paramètres de ton téléphone → Applis → Babi Life → Notifications, et active-les.'
  : /iPhone|iPad/.test(navigator.userAgent)
    ? 'Ajoute Babi Life à ton écran d’accueil (Partager → Sur l’écran d’accueil), ouvre-le de là, puis Réglages → Notifications → Babi Life.'
    : 'Touche le cadenas à côté de l’adresse du site → Autorisations → Notifications → Autoriser. Ou Paramètres → Applis → ton navigateur → Notifications.'
