import { Children, createContext, isValidElement, useContext, useEffect, useMemo, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import { history, parse, type Where } from '../dom/history'
import { El } from '../dom/elements'

// The parts of react-router-dom the game uses (web/src: BrowserRouter,
// Routes, Route, Navigate, Link, useNavigate, useLocation, useSearchParams),
// on the app's own history (dom/history.ts): no browser address bar here.

const subscribe = (f: () => void) => history.listen(f)
const snapshot = () => history.location
export const useLocation = (): Where => useSyncExternalStore(subscribe, snapshot)

const Params = createContext<Record<string, string>>({})
export const useParams = () => useContext(Params)

export function BrowserRouter({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export const MemoryRouter = BrowserRouter
export const HashRouter = BrowserRouter

type NavigateOptions = { replace?: boolean; state?: any; viewTransition?: boolean }
export function useNavigate() {
  return useMemo(
    () => (to: string | number | { pathname?: string; search?: string; hash?: string }, o: NavigateOptions = {}) => {
      if (typeof to === 'number') return history.go(to)
      if (o.replace) history.replace(to, o.state ?? null)
      else history.push(to, o.state ?? null)
    },
    [],
  )
}

/** A path pattern (/sims/:id, /liste/*, *) against a pathname: its params, or null. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  if (pattern === '*' || pattern === '/*') return { '*': pathname.slice(1) }
  const a = pattern.replace(/\/+$/, '').split('/')
  const b = pathname.replace(/\/+$/, '').split('/')
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '*') {
      params['*'] = b.slice(i).join('/')
      return params
    }
    if (b[i] === undefined) return null
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return a.length === b.length ? params : null
}

type RouteProps = { path?: string; index?: boolean; element?: ReactNode; children?: ReactNode }
export function Route(_: RouteProps): ReactElement | null {
  return null
}

export function Routes({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  // The routes in order, the most specific path first among equals, as the router ranks them.
  const routes = Children.toArray(children).filter(isValidElement) as ReactElement<RouteProps>[]
  const ranked = [...routes].sort((x, y) => rank(y.props.path) - rank(x.props.path))
  for (const r of ranked) {
    const params = r.props.index ? (pathname === '/' ? {} : null) : matchPath(r.props.path ?? '*', pathname)
    if (params) return <Params.Provider value={params}>{r.props.element ?? r.props.children ?? null}</Params.Provider>
  }
  return null
}
const rank = (p?: string) => (!p || p === '*' ? 0 : p.split('/').filter(Boolean).reduce((s, seg) => s + (seg === '*' ? 1 : seg.startsWith(':') ? 3 : 4), 0))

export function Navigate({ to, replace, state }: { to: string | { pathname?: string; search?: string; hash?: string }; replace?: boolean; state?: any }) {
  useEffect(() => {
    if (replace) history.replace(to, state ?? null)
    else history.push(to, state ?? null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** A link: an <a> of ours, pressed, goes there in the app. */
export function Link({ to, replace, state, children, onClick, ...rest }: { to: string | { pathname?: string; search?: string }; replace?: boolean; state?: any; children?: ReactNode; onClick?: (e: any) => void; [k: string]: any }) {
  const href = typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}`
  return (
    <El
      {...rest}
      __tag="a"
      href={href}
      onClick={(e: any) => {
        onClick?.(e)
        if (e?.defaultPrevented) return
        e?.preventDefault?.()
        if (replace) history.replace(to, state ?? null)
        else history.push(to, state ?? null)
      }}
    >
      {children}
    </El>
  )
}
// Laid out as the <a> it draws (inline in a line of text): elements.tsx kindOf.
;(Link as any).__as = 'a'
export const NavLink = Link

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string> | string, o?: { replace?: boolean }) => void] {
  const { search, pathname } = useLocation()
  const params = useMemo(() => new URLSearchParams(search), [search])
  const set = (next: URLSearchParams | Record<string, string> | string, o: { replace?: boolean } = {}) => {
    const s = new URLSearchParams(next as any).toString()
    const to = { pathname, search: s ? `?${s}` : '' }
    if (o.replace) history.replace(to)
    else history.push(to)
  }
  return [params, set]
}

export { parse }
