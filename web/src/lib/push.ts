import { api } from './api'
import { inApp, nativeNotifications } from './native'

// Notifications on the phone (backend internal/push): a new message on
// Gbairai, a bet whose matches are over, the team's news (admin
// « Notifications »). On the site, the browser's Web Push (installed on the
// home screen or not); in the Android app, the app's own (Firebase). The game
// asks once, then the player can turn them on later from the Gbairai and
// betting apps or the profile; refused, they're turned on in the phone's
// settings. Each time the game opens with them allowed, this phone's
// subscription is given to the server again (syncPush): one the server forgot
// (expired, another account on the same phone) comes back by itself.

// 'blocked': allowed, but the browser couldn't subscribe (Brave without Google's push service, a private window);
// 'install': an iPhone, where the site gets them only once added to the home screen.
export type PushState = 'on' | 'off' | 'denied' | 'blocked' | 'install' | 'unsupported'

const ASKED = 'babi.pushAsked'
// The browser said no while subscribing (kept so the help shows again the next time).
const FAILED = 'babi.pushFailed'
const SYNCED = 'babi.pushSynced'

const webSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const isBrave = () => !!(navigator as { brave?: unknown }).brave

const store = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* private browsing */
  }
}
const stored = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

/** Where the notifications stand on this phone or browser. */
export async function pushState(): Promise<PushState> {
  if (inApp()) {
    try {
      const r = (await nativeNotifications('status')) as string
      return r === 'granted' ? 'on' : r === 'denied' ? 'denied' : 'off'
    } catch {
      // (Not the browser's diagnostics: the app always has its own notifications; « Activer » asks again.)
      return 'off'
    }
  }
  if (!webSupported()) return isIOS() && !standalone() ? 'install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  if (Notification.permission === 'granted' && (await reg?.pushManager.getSubscription())) return 'on'
  return stored(FAILED) ? 'blocked' : 'off'
}

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** This browser's subscription (made if there's none: the permission is already given), told to the server. */
async function subscribeWeb(): Promise<PushState> {
  const { key, web } = await api.pushKey()
  if (!web || !key) return 'unsupported'
  const reg = await navigator.serviceWorker.ready
  let sub: PushSubscription
  try {
    sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }))
  } catch {
    // Brave (« Utiliser les services Google pour la messagerie push » off), a private window, a browser without a push service.
    store(FAILED, String(Date.now()))
    return 'blocked'
  }
  store(FAILED, null)
  await api.subscribePush({ kind: 'web', ...sub.toJSON() })
  return 'on'
}

/**
 * Asks the phone for notifications and tells the server where to send them.
 * 'on' when they're on; 'denied' when refused (then: the phone's settings);
 * 'blocked' when allowed but the browser couldn't subscribe (pushHelp says what to do).
 */
export async function enablePush(): Promise<PushState> {
  store(ASKED, String(Date.now()))
  if (inApp()) {
    // The app asks Android itself (and opens its settings when refused for good), then gives its token.
    const token = (await nativeNotifications('enable')) as string
    if (token === 'denied') return 'denied'
    if (!token) return 'off'
    await api.subscribePush({ kind: 'fcm', token })
    return 'on'
  }
  if (!webSupported()) return isIOS() && !standalone() ? 'install' : 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  return subscribeWeb()
}

/**
 * With the notifications allowed, this phone's subscription given to the
 * server again (once a day at most), made anew if the browser lost it: never
 * asks anything.
 */
export async function syncPush(): Promise<void> {
  const last = Number(stored(SYNCED) ?? 0)
  if (Date.now() - last < 24 * 3600 * 1000) return
  try {
    if (inApp()) {
      if ((await nativeNotifications('status')) !== 'granted') return
      const token = (await nativeNotifications('enable')) as string
      if (token && token !== 'denied') await api.subscribePush({ kind: 'fcm', token })
    } else {
      if (!webSupported() || Notification.permission !== 'granted') return
      if ((await subscribeWeb()) !== 'on') return
    }
    store(SYNCED, String(Date.now()))
  } catch {
    /* no network: next time */
  }
}

/** Whether to ask now: never asked, or not for a week after « Plus tard ». */
export function shouldAsk() {
  const at = Number(stored(ASKED) ?? 0)
  return Date.now() - at > 7 * 24 * 3600 * 1000
}

export function askLater() {
  store(ASKED, String(Date.now()))
}

/** Where to turn them on once refused, said simply for each phone. */
export const SETTINGS_HELP = inApp()
  ? 'Ouvre les Paramètres de ton téléphone → Applis → Babi Life → Notifications, et active-les.'
  : /iPhone|iPad/.test(navigator.userAgent)
    ? 'Ajoute Babi Life à ton écran d’accueil (Partager → Sur l’écran d’accueil), ouvre-le de là, puis Réglages → Notifications → Babi Life.'
    : 'Touche le cadenas à côté de l’adresse du site → Autorisations → Notifications → Autoriser. Ou Paramètres → Applis → ton navigateur → Notifications.'

/** What to do when they can't come on, for each case ('' when there's nothing to say). */
export function pushHelp(state: PushState | null): string {
  switch (state) {
    case 'denied':
      return SETTINGS_HELP
    case 'blocked':
      return isBrave()
        ? 'Brave bloque les notifications des sites : ouvre ses Paramètres → Confidentialité et sécurité, active « Utiliser les services Google pour la messagerie push » (sur ordinateur : brave://settings/privacy), relance Brave, puis touche à nouveau « Activer ».'
        : 'Ton navigateur n’a pas pu activer les notifications (navigation privée ?). Ouvre Babi Life dans Chrome, ou installe l’appli Android, puis touche à nouveau « Activer ».'
    case 'install':
      return 'Sur iPhone, les notifications marchent seulement depuis l’écran d’accueil : touche Partager → « Sur l’écran d’accueil », ouvre Babi Life de là, puis touche « Activer ».'
    case 'unsupported':
      return 'Ce navigateur ne reçoit pas les notifications : ouvre Babi Life dans Chrome, ou installe l’appli Android.'
    default:
      return ''
  }
}
