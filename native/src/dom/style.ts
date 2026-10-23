import { Dimensions } from 'react-native'
import { initialWindowMetrics } from 'react-native-safe-area-context'
import { fontKeyOf, VARS, type FontKey } from './theme'

// The game's styles (a className's utilities, a style={{}} object, an arbitrary [prop:value]) all
// end up in one shape: the box's own style, the text style its words inherit, the transforms
// (composed at the end, as CSS does), and what React Native has no style for (a grid, a scroller,
// a gradient made of from/via/to, an animation), kept as flags for the element to do.

export type Grid = { cols?: string[]; rows?: string[]; flow?: 'row' | 'column' }
export type Flags = {
  display?: string
  position?: string
  scrollX?: boolean
  scrollY?: boolean
  /** snap-mandatory: the scroller stops on each page (pagingEnabled). */
  snapPages?: boolean
  lines?: number
  pe?: 'none' | 'auto'
  anim?: string[]
  delay?: number
  grid?: Grid
  span?: number
  spaceX?: number
  spaceY?: number
  divideX?: number
  divideY?: number
  divideColor?: string
  from?: string
  via?: string
  to?: string
  gradientDir?: string
  invisible?: boolean
  fit?: string
  ring?: number
  ringColor?: string
  ringInset?: boolean
  shadow?: string
  shadowColor?: string
  placeholder?: string
  scopes?: string[]
  srOnly?: boolean
}
export type Transform = { tx?: number | string; ty?: number | string; rotate?: number; scale?: number; sx?: number; sy?: number; skewX?: number; skewY?: number; list?: string }
export type Acc = { v: Record<string, any>; t: Record<string, any>; tf: Transform; f: Flags; vars?: Record<string, string> }

export const acc = (): Acc => ({ v: {}, t: {}, tf: {}, f: {} })

/** One onto the other, the later winning (as the later rule does in CSS). */
export function merge(into: Acc, from: Acc) {
  Object.assign(into.v, from.v)
  Object.assign(into.t, from.t)
  Object.assign(into.tf, from.tf)
  for (const [k, val] of Object.entries(from.f)) {
    const key = k as keyof Flags
    if (key === 'anim' || key === 'scopes') (into.f as any)[key] = [...((into.f as any)[key] ?? []), ...(val as string[])]
    else (into.f as any)[key] = val
  }
  if (from.vars) into.vars = { ...into.vars, ...from.vars }
  return into
}

/* ---------- Colours ---------- */

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000', transparent: 'transparent', current: 'currentColor', currentcolor: 'currentColor', inherit: 'currentColor' }

/** A colour with an opacity on top (bg-white/15, bg-[#16161c]/80): rgba, or a mark resolved once its variable is known. */
export function withAlpha(c: string, a: number): string {
  if (a >= 1) return c
  if (c === 'transparent' || c === 'currentColor') return c
  const rgb = toRgb(c)
  if (rgb) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${+(rgb[3] * a).toFixed(3)})`
  return `__mix(${c}|${a})`
}

/** A CSS colour's red, green, blue (0–255) and alpha (0–1), when it's written in a way we read. */
export function toRgb(c: string): [number, number, number, number] | null {
  const s = c.trim().toLowerCase()
  if (NAMED[s] && NAMED[s].startsWith('#')) return toRgb(NAMED[s])
  if (s[0] === '#') {
    let h = s.slice(1)
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(s)
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean)
    const num = (x: string, max: number) => (x.endsWith('%') ? (parseFloat(x) / 100) * max : parseFloat(x))
    return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), parts[3] !== undefined ? num(parts[3], 1) : 1]
  }
  return null
}

/** A colour as Tailwind writes it after bg-/text-/border-: white, white/15, [#ffc233], [#16161c]/80, [var(--color-ink)]. */
export function colorOf(raw: string): string | undefined {
  let alpha = 1
  let c = raw
  const slash = /^(.*?)\/(\[[\d.]+\]|\d+(?:\.\d+)?)$/.exec(raw)
  if (slash) {
    c = slash[1]
    const a = slash[2]
    // white/15 is 15 %, white/[0.06] is 0.06.
    alpha = a.startsWith('[') ? Number(a.slice(1, -1).replace('%', '')) / (a.includes('%') ? 100 : 1) : Number(a) / 100
  }
  let out: string | undefined
  if (c.startsWith('[') && c.endsWith(']')) {
    out = arbitrary(c)
    if (out.startsWith('color:')) out = out.slice(6)
  } else if (NAMED[c]) out = NAMED[c]
  else if (VARS[`--color-${c}`]) out = `var(--color-${c})`
  if (!out) return undefined
  if (!/^(#|rgb|hsl|var\(|transparent|currentColor|oklch|color-mix)/.test(out)) return undefined
  return withAlpha(out, alpha)
}

/** An arbitrary value's text: [13px] → 13px, [0_4px_0_#e09a00] → 0 4px 0 #e09a00. */
export const arbitrary = (v: string) => v.slice(1, -1).replace(/_/g, ' ')

/* ---------- Lengths ---------- */

const win = () => Dimensions.get('window')

/** A CSS length as React Native takes it: a number (px), a percentage, 'auto', or undefined if it can't. */
export function length(raw: string | number | undefined, fontSize = 16): number | string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'number') return raw
  const s = raw.trim()
  if (s === 'auto') return 'auto'
  if (s === '0') return 0
  // The phone's notch and its gesture bar (the page's env(safe-area-inset-*)).
  if (s.includes('env(')) return length(s.replace(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,[^)]*)?\)/g, (_, k: 'top' | 'bottom' | 'left' | 'right') => `${initialWindowMetrics?.insets[k] ?? 0}px`), fontSize)
  const m = /^(-?[\d.]+)(px|rem|em|%|vh|vw|dvh|svh|lvh|dvw|svw|lvw)?$/.exec(s)
  if (m) {
    const n = parseFloat(m[1])
    switch (m[2]) {
      case undefined:
      case 'px':
        return n
      case 'rem':
        return n * 16
      case 'em':
        return n * fontSize
      case '%':
        return `${n}%`
      case 'vh':
      case 'dvh':
      case 'svh':
      case 'lvh':
        return (n / 100) * win().height
      default:
        return (n / 100) * win().width
    }
  }
  // min(92vw, 380px), max(…), clamp(…): worked out now when every part is a length in px.
  const fn = /^(min|max|clamp)\((.*)\)$/.exec(s)
  if (fn) {
    const parts = splitTop(fn[2], ',').map((p) => length(p, fontSize))
    if (parts.every((p) => typeof p === 'number')) {
      const ns = parts as number[]
      if (fn[1] === 'min') return Math.min(...ns)
      if (fn[1] === 'max') return Math.max(...ns)
      return Math.min(Math.max(ns[1], ns[0]), ns[2])
    }
    return parts.find((p) => typeof p === 'string')
  }
  // calc(): its px worked out, or its percentage alone when it mixes them (calc(100% - 2rem) ≈ 100%).
  const calc = /^calc\((.*)\)$/.exec(s)
  if (calc) {
    const body = calc[1]
    const terms = body.match(/[+-]?\s*[\d.]+(?:px|rem|em|%|vh|vw|dvh|svh)?/g)
    if (/[*/]/.test(body)) {
      const mul = /^\s*([\d.]+(?:px|rem|em|vh|vw|dvh)?)\s*\*\s*([\d.]+)\s*$/.exec(body) ?? /^\s*([\d.]+)\s*\*\s*([\d.]+(?:px|rem|em|vh|vw|dvh)?)\s*$/.exec(body)
      if (mul) {
        const a = length(mul[1], fontSize)
        const b = length(mul[2], fontSize)
        if (typeof a === 'number' && typeof b === 'number') return a * b
      }
      const div = /^\s*([\d.]+(?:px|rem|em|vh|vw|dvh|%)?)\s*\/\s*([\d.]+)\s*$/.exec(body)
      if (div) {
        const a = length(div[1], fontSize)
        if (typeof a === 'number') return a / Number(div[2])
        if (typeof a === 'string') return `${parseFloat(a) / Number(div[2])}%`
      }
      return undefined
    }
    if (!terms) return undefined
    let px = 0
    let pct: string | undefined
    for (const t of terms) {
      const sign = t.trim().startsWith('-') ? -1 : 1
      const v = length(t.replace(/^[+-]\s*/, ''), fontSize)
      if (typeof v === 'number') px += sign * v
      else if (typeof v === 'string' && v.endsWith('%')) pct = v
    }
    return pct ?? px
  }
  if (s.startsWith('var(')) return s
  return undefined
}

/** Split at the commas (or spaces) that aren't inside brackets. */
export function splitTop(s: string, by: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth === 0 && (by === ' ' ? /\s/.test(ch) : ch === by)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/* ---------- CSS declarations → our shape ---------- */

const TEXT_PROPS = new Set(['color', 'fontSize', 'fontWeight', 'fontStyle', 'fontFamily', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecorationLine', 'textDecorationColor', 'textDecorationStyle', 'fontVariant', 'textShadowColor', 'textShadowOffset', 'textShadowRadius', 'writingDirection'])
const camel = (k: string) => (k.startsWith('--') ? k : k.replace(/^-(webkit|moz|ms)-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()))

/** Four sides from a CSS shorthand (margin: 0 4px → top 0, right 4, bottom 0, left 4). */
function sides(v: string | number, fontSize: number): (number | string | undefined)[] {
  if (typeof v === 'number') return [v, v, v, v]
  const p = splitTop(v, ' ').map((x) => length(x, fontSize))
  if (p.length === 1) return [p[0], p[0], p[0], p[0]]
  if (p.length === 2) return [p[0], p[1], p[0], p[1]]
  if (p.length === 3) return [p[0], p[1], p[2], p[1]]
  return p.slice(0, 4)
}

/** A text shadow (0 2px 0 rgba(0,0,0,.3)) as React Native draws one (the first, when there are several). */
function textShadow(a: Acc, v: string) {
  if (v === 'none') {
    a.t.textShadowColor = 'transparent'
    return
  }
  const first = splitTop(v, ',')[0]
  const parts = splitTop(first, ' ')
  const color = parts.find((p) => !/^-?[\d.]/.test(p)) ?? 'rgba(0,0,0,0.5)'
  const nums = parts.filter((p) => /^-?[\d.]/.test(p)).map((p) => Number(length(p)) || 0)
  a.t.textShadowColor = color
  a.t.textShadowOffset = { width: nums[0] ?? 0, height: nums[1] ?? 0 }
  a.t.textShadowRadius = nums[2] ?? 0
}

/** A CSS transform written out (translate(-50%,-50%) rotate(8deg)) as React Native takes one. */
export function transformList(v: string): any[] {
  const out: any[] = []
  for (const m of v.matchAll(/([a-zA-Z0-9]+)\(([^)]*)\)/g)) {
    const fn = m[1]
    const args = m[2].split(/\s*,\s*|\s+/).filter(Boolean)
    const len = (x: string) => {
      const l = length(x)
      return l === undefined ? 0 : l
    }
    const deg = (x: string) => (x.endsWith('rad') ? `${(parseFloat(x) * 180) / Math.PI}deg` : x.endsWith('turn') ? `${parseFloat(x) * 360}deg` : x.endsWith('deg') ? x : `${parseFloat(x) || 0}deg`)
    switch (fn) {
      case 'translate':
      case 'translate3d':
        out.push({ translateX: len(args[0]) }, { translateY: len(args[1] ?? '0') })
        break
      case 'translateX':
        out.push({ translateX: len(args[0]) })
        break
      case 'translateY':
        out.push({ translateY: len(args[0]) })
        break
      case 'scale':
      case 'scale3d':
        if (args[1] !== undefined && args[1] !== args[0]) out.push({ scaleX: Number(args[0]) }, { scaleY: Number(args[1]) })
        else out.push({ scale: Number(args[0]) })
        break
      case 'scaleX':
        out.push({ scaleX: Number(args[0]) })
        break
      case 'scaleY':
        out.push({ scaleY: Number(args[0]) })
        break
      case 'rotate':
      case 'rotateZ':
        out.push({ rotate: deg(args[0]) })
        break
      case 'rotateX':
        out.push({ rotateX: deg(args[0]) })
        break
      case 'rotateY':
        out.push({ rotateY: deg(args[0]) })
        break
      case 'skewX':
        out.push({ skewX: deg(args[0]) })
        break
      case 'skewY':
        out.push({ skewY: deg(args[0]) })
        break
      case 'perspective':
        out.push({ perspective: Number(len(args[0])) })
        break
    }
  }
  return out
}

/** Milliseconds from a CSS time (200ms, 0.3s). */
export const ms = (v: string | number) => (typeof v === 'number' ? v : v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000 || 0)

/** One CSS declaration (a style={{}} key, an arbitrary [prop:value]) into the shape. */
export function declare(a: Acc, key: string, value: any, fontSize = 16) {
  if (value === undefined || value === null || value === '') return
  const k = camel(key)
  const s = typeof value === 'string' ? value.trim().replace(/\s*!important$/, '') : value
  if (k.startsWith('--')) {
    a.vars = { ...a.vars, [k]: String(s) }
    return
  }
  const L = (x: any) => length(x, fontSize)
  switch (k) {
    case 'background':
    case 'backgroundImage':
    case 'backgroundColor': {
      const str = String(s)
      if (/gradient\(/.test(str)) {
        a.v.backgroundImage = str
        if (k === 'background') a.v.backgroundColor = 'transparent'
      } else if (/url\(/.test(str)) a.v.__bgUrl = /url\(["']?([^"')]+)["']?\)/.exec(str)?.[1]
      else if (str === 'none') {
        if (k !== 'backgroundColor') a.v.backgroundImage = undefined
        if (k === 'background') a.v.backgroundColor = 'transparent'
      } else if (k !== 'backgroundImage') a.v.backgroundColor = str
      return
    }
    case 'backgroundSize':
    case 'backgroundPosition':
    case 'backgroundRepeat':
      a.v[k] = s
      return
    case 'margin':
    case 'padding': {
      const [t, r, b, l] = sides(s, fontSize)
      a.v[`${k}Top`] = t
      a.v[`${k}Right`] = r
      a.v[`${k}Bottom`] = b
      a.v[`${k}Left`] = l
      return
    }
    case 'paddingInline':
    case 'marginInline':
    case 'paddingBlock':
    case 'marginBlock': {
      const base = k.startsWith('padding') ? 'padding' : 'margin'
      const [x, y] = splitTop(String(s), ' ').map(L)
      if (k.endsWith('Inline')) {
        a.v[`${base}Left`] = x
        a.v[`${base}Right`] = y ?? x
      } else {
        a.v[`${base}Top`] = x
        a.v[`${base}Bottom`] = y ?? x
      }
      return
    }
    case 'inset': {
      const [t, r, b, l] = sides(s, fontSize)
      Object.assign(a.v, { top: t, right: r, bottom: b, left: l })
      return
    }
    case 'border':
    case 'borderTop':
    case 'borderRight':
    case 'borderBottom':
    case 'borderLeft': {
      const side = k.slice(6)
      const str = String(s)
      if (str === 'none' || str === '0') {
        a.v[`border${side}Width`] = 0
        return
      }
      for (const part of splitTop(str, ' ')) {
        if (/^(solid|dashed|dotted)$/.test(part)) a.v.borderStyle = part
        else if (/^[\d.]/.test(part)) a.v[`border${side}Width`] = L(part)
        else a.v[`border${side}Color`] = part
      }
      return
    }
    case 'borderRadius': {
      const str = String(s)
      if (typeof s === 'number' || !str.includes(' ')) a.v.borderRadius = L(s)
      else {
        const [tl, tr, br, bl] = sides(str.split('/')[0], fontSize)
        Object.assign(a.v, { borderTopLeftRadius: tl, borderTopRightRadius: tr, borderBottomRightRadius: br, borderBottomLeftRadius: bl })
      }
      return
    }
    case 'boxShadow':
      a.f.shadow = String(s)
      return
    case 'transform':
      a.tf.list = s === 'none' ? '' : String(s)
      return
    case 'translate': {
      const [x, y] = splitTop(String(s), ' ')
      a.tf.tx = L(x)
      a.tf.ty = L(y ?? '0')
      return
    }
    case 'rotate':
      a.tf.rotate = parseFloat(String(s))
      return
    case 'scale': {
      const [x, y] = String(s).split(/\s+/)
      if (y && y !== x) {
        a.tf.sx = Number(x)
        a.tf.sy = Number(y)
      } else a.tf.scale = Number(x)
      return
    }
    case 'transformOrigin':
      a.v.transformOrigin = s
      return
    case 'fontFamily': {
      const fk = fontKeyOf(String(s))
      if (fk) a.t.fontKey = fk as FontKey
      return
    }
    case 'fontWeight':
      a.t.fontWeight = s === 'bold' ? 700 : s === 'normal' ? 400 : Number(s)
      return
    case 'fontSize': {
      const n = L(s)
      if (typeof n === 'number') a.t.fontSize = n
      return
    }
    case 'lineHeight':
      if (typeof s === 'number' || /^[\d.]+$/.test(String(s))) a.t.lineHeight = { ratio: Number(s) }
      else if (String(s) === 'normal') a.t.lineHeight = { ratio: 1.2 }
      else {
        const n = L(s)
        if (typeof n === 'number') a.t.lineHeight = { px: n }
      }
      return
    case 'letterSpacing': {
      const str = String(s)
      if (str.endsWith('em') && !str.endsWith('rem')) a.t.letterSpacing = { em: parseFloat(str) }
      else if (str !== 'normal') a.t.letterSpacing = { px: Number(L(s)) || 0 }
      return
    }
    case 'textDecoration':
    case 'textDecorationLine':
      a.t.textDecorationLine = /line-through/.test(String(s)) ? 'line-through' : /underline/.test(String(s)) ? 'underline' : 'none'
      return
    case 'textShadow':
      textShadow(a, String(s))
      return
    case 'whiteSpace':
      a.t.ws = /nowrap/.test(String(s)) ? 'nowrap' : /pre|break/.test(String(s)) ? 'pre' : 'normal'
      return
    case 'textOverflow':
      return
    case 'display':
      a.f.display = String(s)
      return
    case 'position':
      a.f.position = String(s)
      a.v.position = s === 'fixed' || s === 'sticky' ? (s === 'fixed' ? 'absolute' : 'relative') : s === 'static' ? 'relative' : s
      return
    case 'overflow':
    case 'overflowX':
    case 'overflowY': {
      const str = String(s)
      if (str === 'auto' || str === 'scroll') {
        if (k !== 'overflowY') a.f.scrollX = k === 'overflowX' || a.f.scrollX
        if (k !== 'overflowX') a.f.scrollY = true
        if (k === 'overflow') a.f.scrollX = false
      } else a.v.overflow = str === 'clip' ? 'hidden' : str
      return
    }
    case 'pointerEvents':
      a.f.pe = s === 'none' ? 'none' : 'auto'
      return
    case 'visibility':
      a.f.invisible = s === 'hidden'
      return
    case 'gridTemplateColumns':
      a.f.grid = { ...a.f.grid, cols: tracks(String(s)) }
      return
    case 'gridTemplateRows':
      a.f.grid = { ...a.f.grid, rows: tracks(String(s)) }
      return
    case 'gridAutoFlow':
      a.f.grid = { ...a.f.grid, flow: String(s).startsWith('column') ? 'column' : 'row' }
      return
    case 'gridColumn': {
      const m = /span\s+(\d+)/.exec(String(s))
      if (m) a.f.span = Number(m[1])
      else if (/1\s*\/\s*-1/.test(String(s))) a.f.span = 99
      return
    }
    case 'animation':
    case 'animationName':
      for (const name of String(s).split(',')) {
        const n = name.trim().split(/\s+/)[0]
        if (n && n !== 'none') a.f.anim = [...(a.f.anim ?? []), n]
      }
      return
    case 'animationDelay':
      a.f.delay = ms(s)
      return
    case 'objectFit':
      a.f.fit = String(s)
      return
    case 'width':
    case 'height':
    case 'minWidth':
    case 'minHeight':
    case 'maxWidth':
    case 'maxHeight':
    case 'top':
    case 'left':
    case 'right':
    case 'bottom':
    case 'gap':
    case 'rowGap':
    case 'columnGap':
    case 'flexBasis':
    case 'borderWidth':
    case 'outlineWidth':
    case 'outlineOffset':
    case 'marginTop':
    case 'marginRight':
    case 'marginBottom':
    case 'marginLeft':
    case 'paddingTop':
    case 'paddingRight':
    case 'paddingBottom':
    case 'paddingLeft':
    case 'borderTopWidth':
    case 'borderBottomWidth':
    case 'borderLeftWidth':
    case 'borderRightWidth':
    case 'borderTopLeftRadius':
    case 'borderTopRightRadius':
    case 'borderBottomLeftRadius':
    case 'borderBottomRightRadius': {
      const n = k === 'maxWidth' && s === 'none' ? undefined : L(s)
      if (n !== undefined && !(typeof n === 'string' && /^(fit|min|max)-content$/.test(String(s)))) a.v[k] = n
      return
    }
    case 'flex': {
      const str = String(s)
      if (str === 'none') Object.assign(a.v, { flexGrow: 0, flexShrink: 0 })
      else if (str === 'auto') Object.assign(a.v, { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' })
      else {
        const [g, sh, b] = str.split(/\s+/)
        a.v.flexGrow = Number(g)
        a.v.flexShrink = sh !== undefined && /^[\d.]+$/.test(sh) ? Number(sh) : 1
        const basis = sh !== undefined && !/^[\d.]+$/.test(sh) ? sh : b
        a.v.flexBasis = basis === undefined ? 0 : L(basis)
      }
      return
    }
    case 'flexGrow':
    case 'flexShrink':
    case 'opacity':
    case 'zIndex':
    case 'aspectRatio':
    case 'order':
      a.v[k] = typeof s === 'string' && /^[\d.\s/-]+$/.test(s) && !s.includes('/') ? Number(s) : s
      return
    case 'cursor':
    case 'userSelect':
    case 'touchAction':
    case 'WebkitTapHighlightColor':
    case 'webkitTapHighlightColor':
    case 'transition':
    case 'transitionProperty':
    case 'transitionDuration':
    case 'transitionTimingFunction':
    case 'transitionDelay':
    case 'animationDuration':
    case 'animationFillMode':
    case 'animationIterationCount':
    case 'animationTimingFunction':
    case 'animationPlayState':
    case 'willChange':
    case 'backdropFilter':
    case 'WebkitBackdropFilter':
    case 'webkitBackdropFilter':
    case 'contain':
    case 'imageRendering':
    case 'scrollbarWidth':
    case 'overscrollBehavior':
    case 'WebkitMaskImage':
    case 'maskImage':
    case 'clipPath':
    case 'transformStyle':
    case 'backfaceVisibility':
    case 'perspective':
    case 'writingMode':
    case 'boxSizing':
    case 'isolation':
    case 'appearance':
    case 'outline':
    case 'resize':
    case 'wordBreak':
    case 'overflowWrap':
    case 'hyphens':
    case 'textWrap':
    case 'fontVariantNumeric':
    case 'WebkitTouchCallout':
    case 'webkitTouchCallout':
    case 'content':
      if (k === 'fontVariantNumeric' && String(s).includes('tabular')) a.t.fontVariant = ['tabular-nums']
      if (k === 'backfaceVisibility') a.v.backfaceVisibility = s
      return
    default:
      if (TEXT_PROPS.has(k)) a.t[k] = s
      else a.v[k] = s
  }
}

/** A grid's tracks (repeat(3, minmax(0, 1fr)), auto 1fr, 80px 1fr) as a list: 'auto', '1fr', '80'. */
export function tracks(v: string): string[] {
  const out: string[] = []
  for (const t of splitTop(v.replace(/_/g, ' '), ' ')) {
    const rep = /^repeat\(\s*(\d+|auto-fill|auto-fit)\s*,\s*(.*)\)$/.exec(t)
    if (rep) {
      const n = /^\d+$/.test(rep[1]) ? Number(rep[1]) : 0
      if (n) for (let i = 0; i < n; i++) out.push(...tracks(rep[2]))
      else {
        // As many columns as fit, each at least its minimum: fill:80.
        const min = /minmax\(\s*([\d.]+)px/.exec(rep[2])?.[1] ?? /^([\d.]+)px/.exec(rep[2])?.[1] ?? '100'
        out.push(`fill:${min}`)
      }
      continue
    }
    const mm = /^minmax\((.*),\s*(.*)\)$/.exec(t)
    if (mm) out.push(mm[2].trim().endsWith('fr') ? mm[2].trim() : mm[1].trim().replace('px', ''))
    else out.push(t.endsWith('px') ? t.replace('px', '') : t)
  }
  return out
}

/** A style={{}} object of the web (camelCase CSS) in our shape. */
export function cssObject(style: Record<string, any>, fontSize = 16): Acc {
  const a = acc()
  for (const [k, v] of Object.entries(style)) declare(a, k, v, fontSize)
  return a
}
