import { BackHandler, Linking, Share, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { t } from '../lib/i18n'

// In the app (native/; React Native picks this file over native.ts) the game
// is the app itself: Google's sign-in, the share sheet, the haptics and the
// back button are the phone's own, called straight from here.

let configured = false
const configure = () => {
  if (configured) return
  configured = true
  // The Web client's ID: the ID token comes back for it, as the server checks (backend auth/google).
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID })
}

// A notification while the game is open: shown as when it's closed (its banner, its picture: Firebase's
// notification.image, which expo-notifications draws big), not kept quiet as Android would.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

/** In the Babi Life app: always, here. */
export const inApp = () => true

/** The game drawn by the app itself (React Native): always, here. */
export const nativeApp = true

/** What a failed Google sign-in says to the player: its code, and what to do. */
function googleErrorText(code: string) {
  switch (code) {
    // DEVELOPER_ERROR: Google doesn't know this app's signing key (its SHA-1) for the project (native/README.md).
    case '10':
      return t('Connexion Google impossible (code 10) : cette version de l’appli n’est pas encore reconnue par Google. Connecte-toi avec ton e-mail en attendant.')
    case '7':
      return t('Connexion Google impossible (code 7) : pas de réseau. Réessaie.')
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return t('Connexion Google impossible : les services Google Play manquent ou sont à mettre à jour.')
    case statusCodes.IN_PROGRESS:
      return t('Connexion Google déjà en cours…')
    case 'NO_ID_TOKEN':
      return t('Connexion Google impossible : Google n’a pas répondu avec ton compte. Réessaie.')
    default:
      return t('Connexion Google impossible (code {code}). Connecte-toi avec ton e-mail en attendant.', { code: code || '?' })
  }
}

/**
 * Google sign-in by the phone: the ID token for /auth/google, or null if cancelled. A failure throws
 * the player's sentence (with Google's code: 10 is a signing key Google doesn't know), and is logged.
 */
export async function nativeGoogleSignIn(): Promise<string | null> {
  configure()
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const r = await GoogleSignin.signIn()
    if (r.type !== 'success') return null
    if (!r.data.idToken) throw Object.assign(new Error('no ID token (webClientId missing?)'), { code: 'NO_ID_TOKEN' })
    return r.data.idToken
  } catch (e) {
    const code = String((e as { code?: unknown }).code ?? '')
    console.warn(`[google sign-in] failed: code ${code}: ${(e as Error)?.message}`)
    if (code === statusCodes.SIGN_IN_CANCELLED || code === '12501') return null
    throw new Error(googleErrorText(code))
  }
}

/** Share a text (and a link): the phone's share sheet. */
export async function share(text: string, url?: string): Promise<boolean> {
  await Share.share({ message: url ? `${text} ${url}` : text })
  return true
}

/**
 * The app's notifications (backend internal/push, through Firebase): 'status' says 'granted', 'denied'
 * (refused for good: only the phone's settings turn them on) or 'default'; 'enable' asks Android, then
 * gives this phone's token for the server: '' without Firebase in this build (native/README.md), 'denied'
 * when refused for good (the app's settings open, as the old app did).
 */
export async function nativeNotifications(what: 'status' | 'enable'): Promise<unknown> {
  const p = await Notifications.getPermissionsAsync()
  if (what === 'status') return p.granted ? 'granted' : p.canAskAgain ? 'default' : 'denied'
  if (!p.granted && !p.canAskAgain) {
    await Linking.openSettings()
    return 'denied'
  }
  // (Android only asks once there's a channel to show them in.)
  await Notifications.setNotificationChannelAsync('default', { name: 'Babi Life', importance: Notifications.AndroidImportance.HIGH, lightColor: '#FF7A00' })
  const r = p.granted ? p : await Notifications.requestPermissionsAsync()
  if (!r.granted) return r.canAskAgain ? '' : 'denied'
  try {
    return String((await Notifications.getDevicePushTokenAsync()).data)
  } catch {
    return ''
  }
}

/** A notification tapped (its page of the game: « /jeu?app=gbairai »), as the app opens or while it runs; returns how to stop listening. */
export function onNotificationOpen(open: (url: string) => void) {
  const urlOf = (r: Notifications.NotificationResponse | null) => {
    const data = (r?.notification.request.content.data ?? {}) as { url?: string }
    // (Shown by Android itself while the app was closed: what the server sent is the message's data.)
    const sent = (r?.notification.request.trigger as { remoteMessage?: { data?: { url?: string } } } | null)?.remoteMessage?.data
    return data.url || sent?.url || ''
  }
  const first = urlOf(Notifications.getLastNotificationResponse())
  if (first) open(first)
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = urlOf(r)
    if (url) open(url)
  })
  return () => sub.remove()
}

const IMPACT = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy } as const
/** A little shake of the phone for what happens in the game. */
export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error') {
  if (kind === 'success') return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => Vibration.vibrate([14, 50, 14]))
  if (kind === 'error') return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => Vibration.vibrate([30, 40, 30]))
  void Haptics.impactAsync(IMPACT[kind]).catch(() => Vibration.vibrate(12))
}

// The phone's back button: the game closes what's open (the last one that said it would);
// with nothing open, the app's history goes back (App.tsx), and at its start the app leaves.
const backs: (() => boolean)[] = []
export function gameBack() {
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
export { BackHandler }
