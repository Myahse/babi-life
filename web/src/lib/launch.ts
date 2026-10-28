import { useEffect, useState } from 'react'
import { useFeatures } from './features'

/**
 * The streets stay shut until launch. Set VITE_GAME_OPEN=true to open them, or (no new build)
 * open « L'ouverture de Babi Life » in the admin's « Mises à jour », at a set day and hour: useGameOpen.
 * Before then, testers play the whole game: the testers' build of the app
 * (mobile/, --dart-define=TESTER=true) says so in its user agent, and on any
 * browser the team opens /testeur with the testers' code (or the admin
 * key, checked by the server), which marks that browser as a tester's.
 */
const TESTER = 'babi-testeur'
const TESTER_PASS = 'babi-testeur-code'
/** The code was just typed on /testeur, not only kept: the server takes it even after the testers' reset. */
const TESTER_TYPED = 'babi-testeur-tape'

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

/** The code typed on /testeur (the testers' code or the admin key): the server asks for it in the testers' toolbox. */
export function testerPass() {
  try {
    return localStorage.getItem(TESTER_PASS) ?? ''
  } catch {
    return ''
  }
}

/** Marks (or unmarks) this browser as a tester's, with the code typed; reload for it to apply. */
export function setTester(on: boolean, pass = '') {
  try {
    if (on) {
      localStorage.setItem(TESTER, '1')
      if (pass) (localStorage.setItem(TESTER_PASS, pass.trim()), localStorage.setItem(TESTER_TYPED, '1'))
    } else {
      localStorage.removeItem(TESTER)
      localStorage.removeItem(TESTER_PASS)
      localStorage.removeItem(TESTER_TYPED)
    }
  } catch {
    /* private browsing: nothing kept */
  }
}

/** Whether the code kept was typed on /testeur and the server hasn't taken it yet. */
export function testerTyped() {
  try {
    return localStorage.getItem(TESTER_TYPED) === '1'
  } catch {
    return false
  }
}

/**
 * The server answered for the code kept: it's no longer « just typed ». With
 * forget, the code goes too (refused after the testers' reset): the game
 * stays open on this browser, and the toolbox asks for the code again.
 */
export function testerAnswered(forget = false) {
  try {
    localStorage.removeItem(TESTER_TYPED)
    if (forget) localStorage.removeItem(TESTER_PASS)
  } catch {
    /* private browsing: nothing kept */
  }
}

/** The game opened as an app from the home screen: no address bar there, and on an iPhone its own storage, apart from Safari's. */
export const homeScreenApp = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const gameOpen = import.meta.env.VITE_GAME_OPEN === 'true' || (typeof navigator !== 'undefined' && navigator.userAgent.includes('BabiTest')) || isTester()

/**
 * Open for this browser now: by the build or for a tester (gameOpen), or since the admin's « L'ouverture
 * de Babi Life » (backend features.OpeningID, key « jeu ») reached its hour, asked every minute. null
 * while the server hasn't answered yet (a few seconds at most: no answer, it's taken as still shut).
 */
export function useGameOpen(): boolean | null {
  const feats = useFeatures()
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (gameOpen || feats.known) return
    const t = setTimeout(() => setLate(true), 6000)
    return () => clearTimeout(t)
  }, [feats.known])
  if (gameOpen) return true
  if (!feats.known) return late ? false : null
  // Only on the server's yes: an older server, which doesn't know the opening, keeps it shut.
  return feats.game === true
}
