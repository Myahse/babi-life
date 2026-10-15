// Google sign-in through Firebase Auth. The button stays hidden until the
// four VITE_FIREBASE_* values are set. Authorized domains in the Firebase
// console must include the site (lifeinbabi.com) and localhost.

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)

export type GoogleAccount = { token: string; email: string; firstName: string }

let authReady: Promise<import('firebase/auth').Auth> | null = null

function auth() {
  authReady ??= (async () => {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getAuth } = await import('firebase/auth')
    const app = getApps()[0] ?? initializeApp(config)
    return getAuth(app)
  })()
  return authReady
}

export function googleCancelled(err: unknown) {
  const code = (err as { code?: string }).code
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

/** Opens Google's window and returns a Firebase ID token plus the account. */
export async function signInWithGoogle(): Promise<GoogleAccount> {
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
  const cred = await signInWithPopup(await auth(), new GoogleAuthProvider())
  const email = cred.user.email
  if (!email) throw new Error('Ce compte Google n’a pas d’e-mail')
  const token = await cred.user.getIdToken()
  const first = cred.user.displayName?.trim().split(/\s+/)[0] || email.split('@')[0]
  return { token, email, firstName: first }
}
