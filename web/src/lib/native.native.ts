import { BackHandler, Share, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'
import { GoogleSignin } from '@react-native-google-signin/google-signin'

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

/** In the Babi Life app: always, here. */
export const inApp = () => true

/** Google sign-in by the phone: the ID token for /auth/google, or null if cancelled. */
export async function nativeGoogleSignIn(): Promise<string | null> {
  configure()
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const r = await GoogleSignin.signIn()
  if (r.type !== 'success') return null
  return r.data.idToken ?? null
}

/** Share a text (and a link): the phone's share sheet. */
export async function share(text: string, url?: string): Promise<boolean> {
  await Share.share({ message: url ? `${text} ${url}` : text })
  return true
}

/** The app's notifications: none sent to the phone yet ('denied' asked to enable). */
export async function nativeNotifications(what: 'status' | 'enable'): Promise<unknown> {
  return what === 'status' ? 'default' : ''
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
