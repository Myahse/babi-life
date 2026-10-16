/**
 * The streets stay shut until launch. Set VITE_GAME_OPEN=true to open them.
 * The testers' build of the app (mobile/, --dart-define=TESTER=true) says so
 * in its user agent and plays the whole game before then.
 */
export const gameOpen = import.meta.env.VITE_GAME_OPEN === 'true' || (typeof navigator !== 'undefined' && navigator.userAgent.includes('BabiTest'))
