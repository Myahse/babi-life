// Google sign-in through Firebase Auth. The button stays hidden until the
// four VITE_FIREBASE_* values are set. Authorized domains in the Firebase
// console must include the site (lifeinbabi.com) and localhost.
//
// On an iPhone, Safari opens Google's window only straight from the tap:
// Firebase is loaded beforehand (preloadGoogle, when the title screen
// shows), so the tap opens the window at once. From the home screen (the game
// added as an app), a window never comes back to the game: there the page
// goes to Google and comes back (a redirect), through the site's own domain
// (vercel.json sends /__/auth/ on to Firebase), which needs
// VITE_FIREBASE_SAME_DOMAIN=1 and https://<site>/__/auth/handler among the
// OAuth client's redirect URIs in the Google Cloud console.

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)

export type GoogleAccount = { token: string; email: string; firstName: string }

/** The game opened from the iPhone's home screen (or an iPad's). */
const iosApp = () => typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && (navigator as Navigator & { standalone?: boolean }).standalone === true
/** Sign in by going to Google and back (the home-screen app), through the site's own domain. */
const byRedirect = () => iosApp() && import.meta.env.VITE_FIREBASE_SAME_DOMAIN === '1'

type Loaded = { auth: import('firebase/auth').Auth; lib: typeof import('firebase/auth') }
let loaded: Loaded | null = null
let loading: Promise<Loaded> | null = null

function load() {
  loading ??= (async () => {
    const { initializeApp, getApps } = await import('firebase/app')
    const lib = await import('firebase/auth')
    // Going to Google and back: through this site, so Safari keeps what Firebase stored on the way.
    const app = getApps()[0] ?? initializeApp(byRedirect() ? { ...config, authDomain: window.location.host } : config)
    loaded = { auth: lib.getAuth(app), lib }
    return loaded
  })()
  return loading
}

/** Loads Firebase ahead of the tap (Safari opens Google's window only straight from it). */
export function preloadGoogle() {
  if (firebaseConfigured) void load()
}

export function googleCancelled(err: unknown) {
  const code = (err as { code?: string }).code
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

export function googleBlocked(err: unknown) {
  return (err as { code?: string }).code === 'auth/popup-blocked'
}

async function account(user: import('firebase/auth').User): Promise<GoogleAccount> {
  const email = user.email
  if (!email) throw new Error('Ce compte Google n’a pas d’e-mail')
  const token = await user.getIdToken()
  const first = user.displayName?.trim().split(/\s+/)[0] || email.split('@')[0]
  return { token, email, firstName: first }
}

/**
 * Opens Google's window and returns a Firebase ID token plus the account.
 * From the home-screen app the page goes to Google instead: this then never
 * resolves, and googleRedirectResult picks the account up when it's back.
 */
export function signInWithGoogle(): Promise<GoogleAccount> {
  // Nothing awaited before the window opens: still in the tap for Safari.
  const open = (l: Loaded) => {
    const provider = new l.lib.GoogleAuthProvider()
    if (byRedirect()) return l.lib.signInWithRedirect(l.auth, provider).then(() => new Promise<never>(() => {}))
    return l.lib.signInWithPopup(l.auth, provider).then((cred) => account(cred.user))
  }
  return loaded ? open(loaded) : load().then(open)
}

/** Back from Google (the home-screen app's way): the account signed in with, or null. */
export async function googleRedirectResult(): Promise<GoogleAccount | null> {
  if (!firebaseConfigured || !byRedirect()) return null
  const l = await load()
  const cred = await l.lib.getRedirectResult(l.auth)
  return cred ? account(cred.user) : null
}

/**
 * In the app (mobile/), the phone signs in with Google itself (Google won't
 * open in a web view) and hands over a Google ID token: made a Firebase
 * sign-in here, without any window, for the server's Firebase check.
 */
export async function firebaseFromGoogle(googleIdToken: string): Promise<string> {
  const l = await load()
  const cred = await l.lib.signInWithCredential(l.auth, l.lib.GoogleAuthProvider.credential(googleIdToken))
  return cred.user.getIdToken()
}
