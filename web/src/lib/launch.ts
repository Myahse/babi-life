/**
 * The streets stay shut until launch. Set VITE_GAME_OPEN=true to open them.
 * Before then, testers play the whole game: the testers' build of the app
 * (mobile/, --dart-define=TESTER=true) says so in its user agent, and on any
 * browser the team opens /testeur with the testers' code (or the admin
 * key, checked by the server), which marks that browser as a tester's.
 */
const TESTER = 'babi-testeur'

/**
 * The SHA-256 of the testers' code, checked in the browser (no server, so
 * nothing can be asleep or refuse the site). The code itself is never in the
 * repository; to change it, put the new code's hash here.
 */
export const TESTER_CODE_SHA256 = '92b21e0ee6aa63de70e43ad4d37d005b992d0c44837a0e4f6ad4773123971e4d'

/** Whether a code typed on /testeur is the testers' code. */
export async function isTesterCode(code: string) {
  try {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim().toLowerCase()))
    const hex = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
    return hex === TESTER_CODE_SHA256
  } catch {
    return false
  }
}

export function isTester() {
  try {
    return localStorage.getItem(TESTER) === '1'
  } catch {
    return false
  }
}

/** Marks (or unmarks) this browser as a tester's; reload for it to apply. */
export function setTester(on: boolean) {
  try {
    if (on) localStorage.setItem(TESTER, '1')
    else localStorage.removeItem(TESTER)
  } catch {
    /* private browsing: nothing kept */
  }
}

export const gameOpen = import.meta.env.VITE_GAME_OPEN === 'true' || (typeof navigator !== 'undefined' && navigator.userAgent.includes('BabiTest')) || isTester()
