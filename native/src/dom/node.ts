import { webAnimation, type Keyframe } from './anim'

// What the game's code holds of an element (ref.current, e.currentTarget): the web's element as
// far as the game uses it. Where it's measured, React Native's own element answers (the new
// architecture lays out and reads back at once: getBoundingClientRect, scrollTop, offsetWidth).

type Rect = { x: number; y: number; left: number; top: number; width: number; height: number; right: number; bottom: number }
const EMPTY: Rect = { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }

/** Elements with an id or a data-* attribute, for document.getElementById and querySelector('[data-tour="…"]'). */
const named = new Map<string, Set<DomNode>>()
export function register(node: DomNode, keys: string[]) {
  for (const k of node.keys) if (!keys.includes(k)) named.get(k)?.delete(node)
  for (const k of keys) {
    let s = named.get(k)
    if (!s) named.set(k, (s = new Set()))
    s.add(node)
  }
  node.keys = keys
}
export function unregister(node: DomNode) {
  for (const k of node.keys) named.get(k)?.delete(node)
  node.keys = []
}
/** The first element a simple selector names: #id, [data-x="y"], [data-x]. */
export function query(selector: string): DomNode | null {
  for (const one of selector.split(',')) {
    const s = one.trim()
    const key = s.startsWith('#') ? `id=${s.slice(1)}` : /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(s)?.slice(1).filter((x) => x !== undefined).join('=')
    if (!key) continue
    const found = named.get(key)
    if (found?.size) return [...found][0]
  }
  return null
}
export const queryAll = (selector: string) => {
  const n = query(selector)
  return n ? [n] : []
}

export class DomNode {
  native: any = null
  keys: string[] = []
  props: Record<string, any> = {}
  tag: string
  /** The scroller this element is in (for scrollIntoView). */
  scroller?: DomNode
  /** A scroller's own offsets and sizes (onScroll keeps them). */
  scrollState = { top: 0, left: 0, height: 0, width: 0, viewH: 0, viewW: 0 }
  /** element.animate(): the Box draws the style it gives. */
  setAnim?: (style: Record<string, any> | null) => void
  /** element.style.x = …: drawn straight onto the view. */
  readonly style: Record<string, any>
  readonly classList = { add() {}, remove() {}, toggle() {}, contains: () => false, replace() {} }
  value = ''
  private listeners = new Map<string, Set<(e: any) => void>>()

  constructor(tag: string) {
    this.tag = tag
    const self = this
    this.style = new Proxy({} as Record<string, any>, {
      set(target, key, v) {
        target[key as string] = v
        self.native?.setNativeProps?.({ style: { [key as string]: typeof v === 'string' && /^-?[\d.]+px$/.test(v) ? parseFloat(v) : v } })
        return true
      },
    })
  }

  get tagName() {
    return this.tag.toUpperCase()
  }
  get dataset() {
    const d: Record<string, string> = {}
    for (const [k, v] of Object.entries(this.props)) if (k.startsWith('data-')) d[k.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = String(v)
    return d
  }
  get id() {
    return this.props.id ?? ''
  }
  getAttribute(name: string) {
    const v = this.props[name]
    return v === undefined ? null : String(v)
  }

  getBoundingClientRect(): Rect {
    const r = this.native?.getBoundingClientRect?.()
    if (!r) return EMPTY
    return { x: r.x, y: r.y, left: r.left ?? r.x, top: r.top ?? r.y, width: r.width, height: r.height, right: r.right ?? r.x + r.width, bottom: r.bottom ?? r.y + r.height }
  }
  get offsetWidth() {
    return this.native?.offsetWidth ?? this.getBoundingClientRect().width
  }
  get offsetHeight() {
    return this.native?.offsetHeight ?? this.getBoundingClientRect().height
  }
  get offsetLeft() {
    return this.native?.offsetLeft ?? 0
  }
  get offsetTop() {
    return this.native?.offsetTop ?? 0
  }
  get clientWidth() {
    return this.scrollState.viewW || this.offsetWidth
  }
  get clientHeight() {
    return this.scrollState.viewH || this.offsetHeight
  }
  get scrollTop() {
    return this.scrollState.top
  }
  set scrollTop(y: number) {
    this.scrollTo({ top: y, behavior: 'instant' })
  }
  get scrollLeft() {
    return this.scrollState.left
  }
  set scrollLeft(x: number) {
    this.scrollTo({ left: x, behavior: 'instant' })
  }
  get scrollHeight() {
    return this.scrollState.height || this.offsetHeight
  }
  get scrollWidth() {
    return this.scrollState.width || this.offsetWidth
  }
  scrollTo(a?: number | { top?: number; left?: number; behavior?: string }, b?: number) {
    const o = typeof a === 'number' ? { left: a, top: b } : (a ?? {})
    this.native?.scrollTo?.({ x: o.left ?? this.scrollState.left, y: o.top ?? this.scrollState.top, animated: o.behavior === 'smooth' })
  }
  scrollBy(a?: number | { top?: number; left?: number; behavior?: string }, b?: number) {
    const o = typeof a === 'number' ? { left: a, top: b } : (a ?? {})
    this.scrollTo({ left: this.scrollState.left + (o.left ?? 0), top: this.scrollState.top + (o.top ?? 0), behavior: o.behavior })
  }
  /** Into its scroller's view (block: start, center, end, nearest). */
  scrollIntoView(o?: boolean | { block?: string; inline?: string; behavior?: string }) {
    const s = this.scroller
    if (!s) return
    const block = typeof o === 'object' ? (o.block ?? 'start') : 'start'
    const me = this.getBoundingClientRect()
    const box = s.getBoundingClientRect()
    const vertical = !s.props.__horizontal
    const pos = vertical ? me.top - box.top : me.left - box.left
    const size = vertical ? me.height : me.width
    const view = vertical ? box.height : box.width
    let d = pos
    if (block === 'center') d = pos - (view - size) / 2
    else if (block === 'end') d = pos - (view - size)
    else if (block === 'nearest') d = pos < 0 ? pos : pos + size > view ? pos + size - view : 0
    const behavior = typeof o === 'object' ? o.behavior : undefined
    if (vertical) s.scrollTo({ top: Math.max(0, s.scrollState.top + d), behavior })
    else s.scrollTo({ left: Math.max(0, s.scrollState.left + d), behavior })
  }
  focus() {
    this.native?.focus?.()
  }
  blur() {
    this.native?.blur?.()
  }
  select() {}
  click() {
    this.props.onClick?.({ preventDefault() {}, stopPropagation() {}, currentTarget: this, target: this })
  }
  contains(other: unknown) {
    if (other === this) return true
    const o = (other as DomNode | null)?.native
    return !!o && !!this.native?.contains?.(o)
  }
  closest() {
    return null
  }
  querySelector(selector: string) {
    return query(selector)
  }
  querySelectorAll(selector: string) {
    return queryAll(selector)
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  hasPointerCapture() {
    return false
  }
  requestFullscreen() {
    return Promise.resolve()
  }
  addEventListener(type: string, fn: (e: any) => void) {
    let s = this.listeners.get(type)
    if (!s) this.listeners.set(type, (s = new Set()))
    s.add(fn)
  }
  removeEventListener(type: string, fn: (e: any) => void) {
    this.listeners.get(type)?.delete(fn)
  }
  /** What the element tells those who listen to it by hand (addEventListener: scroll, wheel…). */
  emit(type: string, e: any) {
    for (const fn of this.listeners.get(type) ?? []) fn(e)
  }
  animate(frames: Keyframe[] | Record<string, any[]>, options: any) {
    const list = Array.isArray(frames) ? frames : toFrames(frames)
    return webAnimation(list, options, (s) => this.setAnim?.(s))
  }
  getAnimations() {
    return []
  }
}

/** { transform: [a, b], opacity: [0, 1] } keyframes as a list. */
function toFrames(o: Record<string, any[]>): Keyframe[] {
  const n = Math.max(...Object.values(o).map((v) => v.length))
  return Array.from({ length: n }, (_, i) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v[i]])) as Keyframe)
}
