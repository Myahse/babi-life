import { createElement, Fragment, isValidElement, type ReactNode } from 'react'

// The game's languages. French is the source: t() takes the French text
// itself, and the catalogue (src/i18n/lang-en.json, built by
// scripts/i18n/extract.mjs) gives its English. What has no English yet stays
// in French. In French, t() is the text as written: the game reads as before.
//
// The language is read once, as the game loads (the modules' own lists, the
// mini-games' configs, are made in it): changing it reloads the page.

export type Lang = 'fr' | 'en'
export const LANGS: { id: Lang; label: string; native: string }[] = [
  { id: 'fr', label: 'Français', native: 'Français' },
  { id: 'en', label: 'English', native: 'English' },
]

const KEY = 'babi.lang'
/** A catalogue's entry: the text, or its singular and plural (picked by {n}). */
type Entry = string | [string, string]
type Vars = Record<string, unknown>

let catalogue: Record<string, Entry> | null = null

function saved(): Lang | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'fr' || v === 'en' ? v : null
  } catch {
    return null
  }
}

/** The browser's (or the phone's) first language: English if it's English, else French. */
function device(): Lang {
  let first = ''
  try {
    first = (typeof navigator !== 'undefined' && (navigator.languages?.[0] ?? navigator.language)) || Intl.DateTimeFormat().resolvedOptions().locale || ''
  } catch {
    first = ''
  }
  return first.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

let current: Lang = saved() ?? device()

/** The game's language now. */
export const lang = (): Lang => current
/** Chosen on this device in « Réglages » (else it's the device's own, and the account's may win). */
export const langChosen = () => saved() !== null

/** The catalogue, before the game's modules load (main.tsx): nothing to fetch in French. */
export async function loadLang(): Promise<void> {
  if (current === 'fr' || catalogue) return
  try {
    catalogue = (await import('../i18n/lang-en.json')).default as Record<string, Entry>
  } catch {
    // No network for the chunk: the game in French this time.
    current = 'fr'
  }
}

/** Told when the language changes (lib/api.ts saves it on the account). */
const listeners = new Set<(l: Lang) => void>()
export const onLangChange = (f: (l: Lang) => void) => {
  listeners.add(f)
  return () => void listeners.delete(f)
}

/** The language changed: kept on this device, then the game loaded again in it. */
export function setLang(l: Lang, opts: { reload?: boolean } = {}) {
  try {
    localStorage.setItem(KEY, l)
  } catch {
    // Private mode: for this visit only.
  }
  listeners.forEach((f) => f(l))
  if (l === current || opts.reload === false) return
  // The words first (the phone app draws the game anew without loading its modules again).
  const was = current
  current = l
  void loadLang().then(() => {
    if (current !== l) current = was
    location.reload()
  })
}

/** The plural's count: {n}, else {count}, else the first number given. */
function count(vars?: Vars): number | undefined {
  if (!vars) return undefined
  for (const k of ['n', 'count']) if (typeof vars[k] === 'number') return vars[k] as number
  for (const v of Object.values(vars)) if (typeof v === 'number') return v
  return undefined
}

function pick(e: Entry | undefined, vars?: Vars): string | undefined {
  if (e === undefined || e === '' || e === '=') return undefined
  if (typeof e === 'string') return e
  return Math.abs(count(vars) ?? 2) === 1 ? e[0] : e[1]
}

const PH = /\{(\w+)\}/g

/** The text in the game's language, its {names} filled in (as a template literal would: false is « false »). */
export function t(fr: string, vars?: Vars): string {
  const s = current === 'fr' ? fr : pick(catalogue?.[fr], vars) ?? fr
  if (!vars) return s
  return s.replace(PH, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** French's own plural: « 1 ami », « 3 amis » (0 and 1 are singular in French); the English entry may hold its two forms. */
export function tn(n: number, one: string, other: string, vars?: Vars): string {
  return t(Math.abs(n) < 2 ? one : other, { n, ...vars })
}

const nothing = (v: unknown) => v === null || v === undefined || v === false || v === true

/**
 * The same for JSX text: the {names} may be elements (a bold name, an icon),
 * and, as in JSX, null, undefined and booleans show nothing.
 */
export function tx(fr: string, vars: Vars): ReactNode {
  const s = current === 'fr' ? fr : pick(catalogue?.[fr], vars) ?? fr
  const parts: ReactNode[] = []
  let last = 0
  let rich = false
  for (const m of s.matchAll(PH)) {
    const k = m[1]
    if (!(k in vars)) continue
    parts.push(s.slice(last, m.index))
    const v = vars[k]
    if (isValidElement(v) || (typeof v === 'object' && v !== null)) {
      rich = true
      parts.push(v as ReactNode)
    } else parts.push(nothing(v) ? '' : String(v))
    last = m.index! + m[0].length
  }
  parts.push(s.slice(last))
  return rich ? createElement(Fragment, null, ...parts) : parts.join('')
}
