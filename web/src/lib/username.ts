import { useEffect, useRef, useState } from 'react'
import { api } from './api'

// Live username check, as in Out For Ground: a debounced server check while
// typing, and up to three free alternatives when the name is taken.

export const USERNAME = /^[A-Za-z0-9_.]{3,24}$/
export type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken'

/** Lowercase ASCII slug ("Aya Kouassi" → "ayakouassi"). */
export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')

/** A first username to offer from the person's names. */
export const suggestFrom = (first: string, last: string) => [slug(first), slug(last)].filter(Boolean).join('.').slice(0, 24)

const known = new Map<string, boolean>()
async function free(u: string) {
  const k = u.toLowerCase()
  if (known.has(k)) return known.get(k)!
  const ok = await api.usernameAvailable(u).then((r) => r.available, () => null)
  if (ok !== null) known.set(k, ok)
  return ok
}

export function useUsernameCheck(username: string, first = '', last = '') {
  const [state, setState] = useState<{ value: string; status: UsernameStatus; suggestions: string[] }>({ value: '', status: 'idle', suggestions: [] })
  const seq = useRef(0)
  const u = username.trim()
  const valid = USERNAME.test(u)

  useEffect(() => {
    const my = ++seq.current
    if (!u) return
    if (!valid) return
    const t = setTimeout(async () => {
      const ok = await free(u)
      if (my !== seq.current) return
      if (ok === null) return setState({ value: u, status: 'idle', suggestions: [] })
      setState({ value: u, status: ok ? 'available' : 'taken', suggestions: [] })
      if (!ok) {
        const two = () => String(10 + Math.floor(Math.random() * 90))
        const f = slug(first)
        const l = slug(last)
        const base = slug(u)
        const ideas = [...new Set([f && l ? `${f}.${l}` : '', base ? `${base}_${two()}` : '', f && l ? `${f}${l}${two()}` : '', base ? `${base}.ci` : '', base ? `${base}${two()}` : ''])]
          .map((c) => c.slice(0, 24))
          .filter((c) => USERNAME.test(c) && c.toLowerCase() !== u.toLowerCase())
        const found = (await Promise.all(ideas.map(async (c) => ((await free(c)) ? c : null)))).filter((c): c is string => !!c).slice(0, 3)
        if (my === seq.current) setState({ value: u, status: 'taken', suggestions: found })
      }
    }, known.has(u.toLowerCase()) ? 0 : 500)
    return () => clearTimeout(t)
  }, [u, valid]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: UsernameStatus = !u ? 'idle' : !valid ? 'invalid' : state.value === u ? state.status : 'checking'
  return { status, suggestions: state.value === u ? state.suggestions : [] }
}
