// The Babi Life app (mobile/, Flutter) runs this same game in a web view and
// lends it what a web page can't do well on a phone: Google's sign-in (it
// refuses to open inside a web view), the phone's share sheet. Outside the
// app, everything falls back to the web's own ways.

type Bridge = { callHandler: (name: string, ...args: unknown[]) => Promise<unknown> }
const bridge = () => (window as unknown as { flutter_inappwebview?: Bridge }).flutter_inappwebview

/** In the Babi Life app (its web view says so in its user agent)? */
export const inApp = () => navigator.userAgent.includes('BabiLifeApp')

/** Google sign-in by the phone: the ID token for /auth/google, or null if cancelled. */
export async function nativeGoogleSignIn(): Promise<string | null> {
  const r = await bridge()?.callHandler('googleSignIn')
  return typeof r === 'string' && r ? r : null
}

/** Share a text (and a link): the phone's share sheet in the app, the browser's elsewhere; false if neither. */
export async function share(text: string, url?: string): Promise<boolean> {
  const b = bridge()
  if (b) {
    await b.callHandler('share', url ? `${text} ${url}` : text)
    return true
  }
  if (navigator.share) {
    await navigator.share({ title: 'Babi Life', text, url })
    return true
  }
  return false
}
