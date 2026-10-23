// The app's address (/jeu, /creer?x=1…) and its history, kept here: the
// router (shims/react-router-dom) draws from it, and window.location and
// window.history (globals.ts) read and move it, as the game's code does on the web.

export type Where = { pathname: string; search: string; hash: string; state: any; key: string }

let stack: Where[] = [{ pathname: '/jeu', search: '', hash: '', state: null, key: 'default' }]
let at = 0
const listeners = new Set<() => void>()
let n = 0

/** An address (/jeu?a=1#b, or { pathname, search }) split up. */
export function parse(to: string | { pathname?: string; search?: string; hash?: string }, from: Where = stack[at]): Omit<Where, 'state' | 'key'> {
  if (typeof to !== 'string') return { pathname: to.pathname ?? from.pathname, search: to.search ? (to.search.startsWith('?') ? to.search : `?${to.search}`) : '', hash: to.hash ?? '' }
  let s = to.replace(/^https?:\/\/[^/]+/, '')
  let hash = ''
  const h = s.indexOf('#')
  if (h >= 0) [s, hash] = [s.slice(0, h), s.slice(h)]
  let search = ''
  const q = s.indexOf('?')
  if (q >= 0) [s, search] = [s.slice(0, q), s.slice(q)]
  // Relative to where one is (« ../ », « x »), as the web resolves it.
  const pathname = !s ? from.pathname : s.startsWith('/') ? s : `${from.pathname.replace(/[^/]*$/, '')}${s}`
  return { pathname, search, hash }
}

export const history = {
  get location() {
    return stack[at]
  },
  get index() {
    return at
  },
  push(to: string | { pathname?: string; search?: string; hash?: string }, state: any = null) {
    stack = [...stack.slice(0, at + 1), { ...parse(to), state, key: `k${++n}` }]
    at = stack.length - 1
    listeners.forEach((f) => f())
  },
  replace(to: string | { pathname?: string; search?: string; hash?: string }, state: any = null) {
    stack = stack.map((w, i) => (i === at ? { ...parse(to), state, key: `k${++n}` } : w))
    listeners.forEach((f) => f())
  },
  go(delta: number) {
    const to = Math.max(0, Math.min(stack.length - 1, at + delta))
    if (to === at) return
    at = to
    listeners.forEach((f) => f())
  },
  /** Back, if there's somewhere to go back to (Android's back button): false if not. */
  back() {
    if (at === 0) return false
    history.go(-1)
    return true
  },
  listen(f: () => void) {
    listeners.add(f)
    return () => void listeners.delete(f)
  },
}

/** A link followed (an <a href>, a router <Link>): within the app. */
export const navigateTo = (to: string) => history.push(to)
