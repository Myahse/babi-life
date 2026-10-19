/**
 * The streets stay shut until launch. Set VITE_GAME_OPEN=true to open them.
 * Before then, testers play the whole game: the testers' build of the app
 * (mobile/, --dart-define=TESTER=true) says so in its user agent, and on any
 * browser the team opens /testeur with the admin key (checked by the
 * server), which marks that browser as a tester's.
 */
const TESTER = 'babi-testeur'

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
