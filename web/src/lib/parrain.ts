// Inviting one's friends (backend sims/parrainage.go): a friend's link is
// lifeinbabi.com/?p=code. The code it came with is kept on this browser (the
// landing page, the wish list, a sign-up days later) and sent with the
// sign-up: the server records it only on a new account (auth/referral.go).

const KEY = 'babi.parrain'
const CODE = /^[a-z0-9]{4,12}$/

/** The code of the link this browser came by ('' none). */
export function parrainCode(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** `?p=code` for a sign-up, '' without a code. */
export const parrainQuery = () => (parrainCode() ? `?p=${encodeURIComponent(parrainCode())}` : '')

/** Signed in: the code has done its job (a new account kept it; an old one never takes it). */
export function parrainDone() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // No storage: nothing kept.
  }
}

/** The player's own link, to send to friends. */
export function inviteLink(code: string) {
  const origin = typeof location !== 'undefined' && /^https?:/.test(location.origin) ? location.origin : 'https://lifeinbabi.com'
  return `${origin}/?p=${code}`
}

/** Come by a link (its `?p=code`): the code kept (the first one: a later link doesn't take its place). */
export function keepParrain(search: string) {
  const p = new URLSearchParams(search).get('p')?.trim().toLowerCase()
  if (p && CODE.test(p) && !parrainCode()) {
    try {
      localStorage.setItem(KEY, p)
    } catch {
      // No storage: the link is lost on this browser.
    }
  }
}

if (typeof location !== 'undefined') keepParrain(location.search)
