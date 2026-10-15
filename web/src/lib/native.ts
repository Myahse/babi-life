// The Babi Life app (mobile/, Flutter) runs this same game in a web view and
// lends it what a web page can't do well on a phone: Google's sign-in (it
// refuses to open inside a web view), the phone's share sheet. Outside the
// app, everything falls back to the web's own ways.
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
  if (!c) return Promise.reject(new Error('not in the app'))
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
    await navigator.share({ title: 'Babi Life', text, url })
    return true
  }
  return false
}
