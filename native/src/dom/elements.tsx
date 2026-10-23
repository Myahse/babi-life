import { createContext, Fragment, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Dimensions, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type GestureResponderEvent, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native'
import * as SVG from 'react-native-svg'
import { useVideoPlayer, VideoView } from 'expo-video'
import { strongOf, tw, type Parsed } from './tw'
import { acc, cssObject, merge, toRgb, transformList, withAlpha, type Acc, type Grid } from './style'
import { ownStyle, scopesOf } from './components'
import { fontFile, VARS, type FontKey } from './theme'
import { DomNode, register, unregister } from './node'
import { playOf, run, styleOf } from './anim'
import { navigateTo } from './links'
import { absUrl } from './origin'
import { Portal } from './portal'
import { CanvasView } from './canvasView'

// The game's HTML on the phone: every <div>, <span>, <button>, <input>, <svg>
// of web/src becomes this element (the JSX runtime, jsx-runtime.ts, sends the
// tags here). It reads the className (Tailwind, tw.ts) and the style={{}}
// (style.ts), lays its children out as the web does where React Native
// doesn't on its own (a block's lines of text and inline boxes, a grid, a
// scroller), passes the text style down to its words, and answers the touches
// as the web's pointer and click events.

/* ---------- What the children inherit ---------- */

type TextInh = {
  color: string
  fontKey: FontKey
  fontWeight: number
  fontSize: number
  lineHeight?: { ratio?: number; px?: number }
  letterSpacing?: { em?: number; px?: number }
  textAlign?: string
  textTransform?: string
  fontStyle?: string
  textDecorationLine?: string
  textShadowColor?: string
  textShadowOffset?: { width: number; height: number }
  textShadowRadius?: number
  fontVariant?: string[]
  ws?: string
}
type Inh = {
  text: TextInh
  vars: Record<string, string>
  scopes: string[]
  parentOwn: string[]
  /** Inside a <Text>: an inline element is a run of text in it, not a box. */
  inText: boolean
  /** pointer-events: none, inherited (until an element sets auto again). */
  peNone: boolean
  scroller?: DomNode
  form?: { submit: () => void }
  details?: { open: boolean; toggle: () => void }
  svg?: boolean
  /** Drawn in the screen's layer already (a `fixed` box: portal.tsx). */
  lifted?: boolean
  /** The parent lays its children in a row (flex-row): a child's auto margins push, they don't centre a block. */
  row?: boolean
  /** An inline box alone on its line: where on the line it sits (it doesn't stretch across as a block does). */
  selfAlign?: 'flex-start' | 'center' | 'flex-end'
  /** At the top of the page (Document): how far down it reaches, told to the page's scroller. */
  doc?: (node: DomNode, bottom: number) => void
  /** The page's scroller: how far it's scrolled (on the UI thread) and its content, to measure against (sticky boxes). */
  page?: Page
  /** The element this one is in. */
  parent?: DomNode
  /** Right in a scroller: its view's size (a child h-full in it is as tall as the view, not the content). */
  viewport?: { w: number; h: number; horizontal: boolean }
}
type Page = { y: Animated.Value; content: { current: any }; /** Measured again when the page's height changes (what's above may have moved). */ relayout: Set<() => void> }
const ROOT: Inh = { text: { color: VARS['--color-ink'], fontKey: 'sans', fontWeight: 400, fontSize: 16, lineHeight: { ratio: 1.5 } }, vars: VARS, scopes: [], parentOwn: [], inText: false, peNone: false }
export const DomCtx = createContext<Inh>(ROOT)
export const useDom = () => useContext(DomCtx)

/**
 * The page: what the game draws at its top, scrolled as a browser scrolls a
 * document taller than the screen. Its elements tell how far down they reach
 * (Box, inh.doc); the scroller's content is that tall, or the screen's height.
 */
export function Document({ children }: { children?: ReactNode }) {
  const { height } = useWindowDimensions()
  const [tall, setTall] = useState(0)
  const bottoms = useRef(new Map<DomNode, number>())
  const doc = useCallback((n: DomNode, bottom: number) => {
    if (bottom < 0) bottoms.current.delete(n)
    else bottoms.current.set(n, bottom)
    let m = 0
    for (const b of bottoms.current.values()) m = Math.max(m, b)
    setTall(Math.ceil(m))
  }, [])
  const y = useRef(new Animated.Value(0)).current
  const content = useRef<any>(null)
  const scroller = useRef<ScrollViewInstance>(null)
  const relayout = useRef(new Set<() => void>()).current
  const ctx = useMemo(() => ({ ...ROOT, doc, page: { y, content, relayout } }), [doc, y, relayout])
  useEffect(() => relayout.forEach((f) => f()), [tall, relayout])
  // The window's scroll is this scroller's: scrollY, scrollTo, and the 'scroll' event the game listens to.
  useEffect(() => {
    if (Platform.OS === 'web') return
    const g = globalThis as any
    g.scrollTo = (a?: number | { top?: number; behavior?: string }, b?: number) => {
      const top = typeof a === 'number' ? (b ?? 0) : (a?.top ?? 0)
      scroller.current?.scrollTo({ y: top, animated: typeof a === 'object' && a?.behavior === 'smooth' })
    }
  }, [])
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
        useNativeDriver: true,
        listener: (e: any) => {
          const top = e.nativeEvent.contentOffset.y
          if (Platform.OS === 'web') return void window.dispatchEvent(new Event('scroll'))
          const g = globalThis as any
          g.scrollY = g.pageYOffset = top
          g.dispatchEvent({ type: 'scroll' })
        },
      }),
    [y],
  )
  const scrolls = tall > height + 1
  return (
    <Animated.ScrollView ref={scroller} style={{ flex: 1 }} onScroll={onScroll} scrollEventThrottle={16} scrollEnabled={scrolls} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View ref={content} style={{ height: scrolls ? tall : height }}>
        <DomCtx.Provider value={ctx}>{children}</DomCtx.Provider>
      </View>
    </Animated.ScrollView>
  )
}

/* ---------- Values ---------- */

/** var(--x, fallback) replaced, as many times as they nest; currentColor the inherited colour; color-mix() mixed. */
export function resolve(v: string, vars: Record<string, string>, current?: string): string {
  let s = v
  for (let i = 0; i < 6 && s.includes('var('); i++) s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_, name: string, fb?: string) => vars[name] ?? fb?.trim() ?? '')
  if (current && s.includes('currentColor')) s = s.replace(/currentColor/g, current)
  if (s.includes('__mix(')) s = s.replace(/__mix\(([^|]+)\|([\d.]+)\)/g, (_, c: string, a: string) => withAlpha(c, Number(a)))
  if (s.includes('color-mix(')) s = s.replace(/color-mix\(\s*in\s+\w+\s*,\s*([^,]+?)\s+([\d.]+)%\s*,\s*([^)]+?)\s*\)/g, (_, a: string, p: string, b: string) => mix(a, Number(p) / 100, b))
  return s
}
function mix(a: string, k: number, b: string) {
  const x = toRgb(a)
  if (!x) return a
  if (b.trim() === 'transparent') return `rgba(${x[0]},${x[1]},${x[2]},${+(x[3] * k).toFixed(3)})`
  const y = toRgb(b) ?? [255, 255, 255, 1]
  const m = (i: number) => Math.round(x[i] * k + y[i] * (1 - k))
  return `rgba(${m(0)},${m(1)},${m(2)},${+(x[3] * k + y[3] * (1 - k)).toFixed(3)})`
}
function resolveAll<T extends Record<string, any>>(o: T, vars: Record<string, string>, current: string): T {
  let out: T | null = null
  for (const [k, v] of Object.entries(o)) {
    if (typeof v !== 'string' || (!v.includes('var(') && !v.includes('currentColor') && !v.includes('__mix') && !v.includes('color-mix'))) continue
    out ??= { ...o }
    ;(out as any)[k] = resolve(v, vars, current)
  }
  return out ?? o
}

/** The text a child inherits: the parent's, with what this element sets. */
function textOf(parent: TextInh, t: Record<string, any>, vars: Record<string, string>): TextInh {
  const keys = Object.keys(t)
  if (!keys.length) return parent
  const out: TextInh = { ...parent }
  for (const k of keys) {
    const v = t[k]
    if (v === undefined) continue
    if (k === 'color') out.color = resolve(String(v), vars, parent.color) || parent.color
    else if (k === 'textShadowColor') out.textShadowColor = resolve(String(v), vars, parent.color)
    else (out as any)[k] = v
  }
  // A font size set alone keeps the ratio a line height was given as; a pixel line height stays pixels.
  return out
}

/** The inherited text as React Native styles it. */
function rnText(t: TextInh): Record<string, any> {
  const lh = t.lineHeight?.px ?? (t.lineHeight?.ratio ? t.lineHeight.ratio * t.fontSize : undefined)
  const ls = t.letterSpacing?.px ?? (t.letterSpacing?.em !== undefined ? t.letterSpacing.em * t.fontSize : undefined)
  return {
    color: t.color,
    fontFamily: fontFile(t.fontKey, t.fontWeight),
    fontSize: t.fontSize,
    lineHeight: lh !== undefined ? Math.max(lh, t.fontSize * 0.9) : undefined,
    letterSpacing: ls,
    textAlign: t.textAlign as any,
    textTransform: t.textTransform as any,
    fontStyle: t.fontStyle as any,
    textDecorationLine: t.textDecorationLine as any,
    textShadowColor: t.textShadowColor,
    textShadowOffset: t.textShadowOffset,
    textShadowRadius: t.textShadowRadius,
    fontVariant: t.fontVariant as any,
  }
}

/** The transforms of the shape, in CSS's order (translate, rotate, scale, then transform:). */
function transforms(a: Acc): any[] | undefined {
  const tf = a.tf
  const out: any[] = []
  if (tf.tx !== undefined && tf.tx !== 0) out.push({ translateX: tf.tx })
  if (tf.ty !== undefined && tf.ty !== 0) out.push({ translateY: tf.ty })
  if (tf.rotate) out.push({ rotate: `${tf.rotate}deg` })
  if (tf.scale !== undefined && tf.scale !== 1) out.push({ scale: tf.scale })
  if (tf.sx !== undefined) out.push({ scaleX: tf.sx })
  if (tf.sy !== undefined) out.push({ scaleY: tf.sy })
  if (tf.skewX) out.push({ skewX: `${tf.skewX}deg` })
  if (tf.skewY) out.push({ skewY: `${tf.skewY}deg` })
  if (tf.list) out.push(...transformList(tf.list))
  return out.length ? out : undefined
}

/** The box's own style: its values, transforms, shadow and ring, gradient, visibility. */
function boxOf(a: Acc, vars: Record<string, string>, color: string, display: string): Record<string, any> {
  const s: Record<string, any> = resolveAll({ ...a.v }, vars, color)
  delete s.__bgUrl
  delete s.__placeItems
  delete s.__justifyItems
  delete s.__justifySelf
  if ((display === 'flex' || display === 'inline-flex') && !s.flexDirection) s.flexDirection = 'row'
  if (display === 'fit') s.alignSelf = s.alignSelf ?? 'flex-start'
  const tr = transforms(a)
  if (tr) s.transform = tr
  const shadows: string[] = []
  if (a.f.shadow && a.f.shadow !== 'none') {
    let sh = resolve(a.f.shadow, vars, color)
    if (a.f.shadowColor) sh = sh.replace(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/g, resolve(a.f.shadowColor, vars, color))
    shadows.push(sh)
  }
  if (a.f.ring) shadows.push(`${a.f.ringInset ? 'inset ' : ''}0 0 0 ${a.f.ring}px ${resolve(a.f.ringColor ?? 'rgba(59,130,246,0.5)', vars, color)}`)
  if (shadows.length) s.boxShadow = shadows.join(', ')
  if (a.f.from || a.f.to || a.f.via) {
    const stops = [a.f.from ?? 'transparent', a.f.via, a.f.to ?? 'transparent'].filter(Boolean).map((c) => resolve(c!, vars, color))
    s.backgroundImage = `linear-gradient(${a.f.gradientDir ?? 'to bottom'}, ${stops.join(', ')})`
  } else if (typeof s.backgroundImage === 'string' && !/gradient\(/.test(s.backgroundImage)) delete s.backgroundImage
  if (a.f.invisible) s.opacity = 0
  // The web's sizes count the border in (box-sizing), as React Native does; its outline isn't drawn.
  delete s.outlineWidth
  delete s.outlineOffset
  for (const k of ['backgroundSize', 'backgroundPosition', 'backgroundRepeat']) delete s[k]
  return s
}

/* ---------- What a child is, for its parent's flow ---------- */

const INLINE = new Set(['span', 'a', 'b', 'strong', 'i', 'em', 'small', 'code', 'sup', 'sub', 'time', 'mark', 'abbr', 'kbd', 's', 'u', 'br', 'label', 'q', 'cite', 'tspan'])
const ATOM = new Set(['button', 'img', 'input', 'select', 'textarea', 'svg', 'video', 'canvas', 'iframe', 'progress', 'icon'])
const SVG_TAGS: Record<string, any> = {
  svg: SVG.Svg,
  path: SVG.Path,
  circle: SVG.Circle,
  rect: SVG.Rect,
  g: SVG.G,
  line: SVG.Line,
  polyline: SVG.Polyline,
  polygon: SVG.Polygon,
  ellipse: SVG.Ellipse,
  defs: SVG.Defs,
  linearGradient: SVG.LinearGradient,
  radialGradient: SVG.RadialGradient,
  stop: SVG.Stop,
  text: SVG.Text,
  tspan: SVG.TSpan,
  clipPath: SVG.ClipPath,
  mask: SVG.Mask,
  pattern: SVG.Pattern,
  use: SVG.Use,
  symbol: SVG.Symbol,
  image: SVG.Image,
  foreignObject: SVG.ForeignObject,
}

type Kind = 'text' | 'inline' | 'atom' | 'block' | 'abs'

/** Display and position of an element of ours from its props, without drawing it. */
function placeOf(p: any): { display?: string; position?: string; span?: number } {
  const parsed = tw(p.className)
  const strong = strongOf(parsed)
  const st = p.style ?? {}
  return {
    display: st.display ?? strong.f.display ?? parsed.base.f.display,
    position: st.position ?? strong.f.position ?? parsed.base.f.position,
    span: strong.f.span ?? parsed.base.f.span ?? (typeof st.gridColumn === 'string' ? Number(/span\s+(\d+)/.exec(st.gridColumn)?.[1]) || undefined : undefined),
  }
}

function kindOf(c: any): Kind {
  if (typeof c === 'string' || typeof c === 'number') return 'text'
  if (!isValidElement(c)) return 'block'
  // Ours, or a component drawing one of ours (the router's Link: an <a>).
  const as: string | undefined = (c.type as any)?.__as
  if (c.type === El || as) {
    const p: any = c.props
    const tag: string = as ?? p.__tag
    const { display, position } = placeOf(p)
    if (position === 'absolute' || position === 'fixed') return 'abs'
    if (display) return display === 'inline' ? 'inline' : display.startsWith('inline') ? 'atom' : 'block'
    if (INLINE.has(tag)) return 'inline'
    if (ATOM.has(tag)) return 'atom'
    return 'block'
  }
  // The icons: inline boxes in the line, as an <svg> is.
  if ((c.type as any)?.__inline) return 'atom'
  return 'block'
}

/**
 * Where each child is among its parent's as React reconciles them (its place in the JSX, a
 * `{cond && …}` counting even when it's false; its key in a list), noted by flatten: the key it's
 * drawn with, so a sibling coming or going doesn't remount the ones after it (and lose their state).
 */
const slots = new WeakMap<object, string>()

/** Children as a flat list: arrays and fragments opened, nothing for null, false, true. */
function flatten(children: ReactNode, out: any[] = [], path = ''): any[] {
  if (children === null || children === undefined || typeof children === 'boolean') return out
  if (Array.isArray(children)) {
    children.forEach((c, j) => flatten(c, out, `${path}${isValidElement(c) && c.key != null ? `k${String(c.key)}` : j}.`))
    return out
  }
  if (isValidElement(children) && children.type === Fragment) return flatten((children.props as any).children, out, path)
  if (isValidElement(children)) slots.set(children, path)
  out.push(children)
  return out
}

/* ---------- Touches as the web's events ---------- */

function webEvent(type: string, e: GestureResponderEvent | null, dom: DomNode, extra?: Record<string, any>) {
  const n: any = e?.nativeEvent ?? {}
  const touch = (t: any) => ({ clientX: t.pageX, clientY: t.pageY, pageX: t.pageX, pageY: t.pageY, screenX: t.pageX, screenY: t.pageY, identifier: Number(t.identifier) || 0, target: dom })
  const ev: any = {
    type,
    clientX: n.pageX ?? 0,
    clientY: n.pageY ?? 0,
    pageX: n.pageX ?? 0,
    pageY: n.pageY ?? 0,
    screenX: n.pageX ?? 0,
    screenY: n.pageY ?? 0,
    offsetX: n.locationX ?? 0,
    offsetY: n.locationY ?? 0,
    movementX: 0,
    movementY: 0,
    pointerId: Number(n.identifier) || 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: /up|end|click|cancel/.test(type) ? 0 : 1,
    detail: 1,
    timeStamp: n.timestamp ?? Date.now(),
    touches: (n.touches ?? []).map(touch),
    targetTouches: (n.touches ?? []).map(touch),
    changedTouches: (n.changedTouches ?? (e ? [n] : [])).map(touch),
    currentTarget: dom,
    target: dom,
    nativeEvent: n,
    defaultPrevented: false,
    key: undefined,
    preventDefault() {
      ev.defaultPrevented = true
    },
    stopPropagation() {},
    persist() {},
    ...extra,
  }
  return ev
}

const DRAGS = ['onPointerMove', 'onTouchMove', 'onMouseMove']
const PRESSES = ['onClick', 'onPointerDown', 'onPointerUp', 'onTouchStart', 'onTouchEnd', 'onMouseDown', 'onMouseUp', 'onPointerCancel', 'onDoubleClick', 'onContextMenu', ...DRAGS]

/**
 * The element as a touch target: under the finger (pointer/touch/mouse down),
 * moved, let go (up, then click if the finger hardly moved), taken by a
 * scroller (cancel). A drag (a move handler) keeps the touch to itself.
 */
function usePress(dom: DomNode, p: any, enabled: boolean, onClickExtra?: (e: any) => void) {
  const [pressed, setPressed] = useState(false)
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const last = useRef(0)
  if (!enabled) return { pressed: false, handlers: null as null | Record<string, any>, unpress: () => {} }
  const drag = DRAGS.some((k) => p[k])
  const fire = (names: string[], type: string, e: GestureResponderEvent | null) => {
    for (const n of names) if (p[n]) p[n](webEvent(type, e, dom))
  }
  const handlers = {
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => !drag,
    onResponderGrant: (e: GestureResponderEvent) => {
      start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() }
      setPressed(true)
      fire(['onPointerDown', 'onMouseDown'], 'pointerdown', e)
      fire(['onTouchStart'], 'touchstart', e)
    },
    onResponderMove: (e: GestureResponderEvent) => {
      fire(['onPointerMove', 'onMouseMove'], 'pointermove', e)
      fire(['onTouchMove'], 'touchmove', e)
    },
    onResponderRelease: (e: GestureResponderEvent, tapped = false) => {
      setPressed(false)
      fire(['onPointerUp', 'onMouseUp'], 'pointerup', e)
      fire(['onTouchEnd'], 'touchend', e)
      // (A <Text>'s press comes once the finger's let go where it pressed: it's a click, whatever started it.)
      const s = start.current ?? (tapped ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() } : null)
      start.current = null
      if (!s || Math.hypot(e.nativeEvent.pageX - s.x, e.nativeEvent.pageY - s.y) > 12) return
      const ev = webEvent('click', e, dom)
      p.onClick?.(ev)
      onClickExtra?.(ev)
      const now = Date.now()
      if (p.onDoubleClick && now - last.current < 320) p.onDoubleClick(webEvent('dblclick', e, dom))
      last.current = now
      if (p.onContextMenu && now - s.t > 600) p.onContextMenu(webEvent('contextmenu', e, dom))
    },
    onResponderTerminate: (e: GestureResponderEvent) => {
      setPressed(false)
      start.current = null
      fire(['onPointerCancel'], 'pointercancel', e)
      fire(['onTouchCancel'], 'touchcancel', e)
    },
  }
  // A <Text>'s press (a button of only words): its press-out comes before its press, so it only lets go of the look.
  return { pressed, handlers, unpress: () => setPressed(false) }
}

/* ---------- The element ---------- */

const SEMANTIC: Record<string, Record<string, any>> = {
  b: { fontWeight: 700 },
  strong: { fontWeight: 700 },
  i: { fontStyle: 'italic' },
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through' },
  u: { textDecorationLine: 'underline' },
  code: { fontKey: 'mono' },
  kbd: { fontKey: 'mono' },
}

export function El(props: any) {
  const { __tag: tag } = props
  const inh = useContext(DomCtx)
  // What draws nothing here: a list of suggestions for a field (the phone's keyboard has its own), an SVG's SMIL animation (drawn still).
  if (tag === 'datalist' || tag === 'animate' || tag === 'animateTransform') return null
  if (SVG_TAGS[tag] && (tag === 'svg' || inh.svg)) return <SvgEl {...props} />
  // A `fixed` box is over the screen wherever it's written: drawn in the screen's layer, inheriting as it would here.
  if (!inh.lifted && placeOf(props).position === 'fixed')
    return (
      <Portal>
        <DomCtx.Provider value={{ ...inh, lifted: true, inText: false, doc: undefined }}>
          <Box {...props} />
        </DomCtx.Provider>
      </Portal>
    )
  return <Box {...props} />
}

function Box(props: any) {
  const { __tag: tag, ref, className, style, children, disabled: disabledProp } = props
  const inh = useContext(DomCtx)
  const nodeRef = useRef<DomNode | null>(null)
  if (!nodeRef.current) nodeRef.current = new DomNode(tag)
  const dom = nodeRef.current
  dom.props = props
  dom.scroller = inh.scroller
  if (props.value !== undefined && tag !== 'button') dom.value = String(props.value)
  const [focused, setFocused] = useState(false)
  const [webAnim, setWebAnim] = useState<Record<string, any> | null>(null)
  dom.setAnim = setWebAnim
  const [open, setOpen] = useState(!!props.open)
  // A scroller's view, once laid out (for its pages: children h-full).
  const [view, setView] = useState<{ w: number; h: number } | null>(null)

  // The ref the game holds: our node (its .native the view).
  useLayoutEffect(() => {
    if (!ref) return
    if (typeof ref === 'function') {
      const undo = ref(dom)
      return () => (typeof undo === 'function' ? undo() : ref(null))
    }
    ref.current = dom
    return () => {
      ref.current = null
    }
  }, [ref, dom])
  // Found by id and data-*: document.getElementById, querySelector('[data-tour="…"]').
  const keys = Object.keys(props)
    .filter((k) => k === 'id' || k.startsWith('data-'))
    .flatMap((k) => (k === 'id' ? [`id=${props.id}`] : [`${k}=${props[k]}`, k]))
    .join('|')
  useEffect(() => {
    if (!keys) return
    register(dom, keys.split('|'))
    return () => unregister(dom)
  }, [keys, dom])
  const doc = inh.doc
  useEffect(() => (doc ? () => doc(dom, -1) : undefined), [doc, dom])
  // position: sticky, from where it starts holding to where its parent's end pushes it on (measured against the page).
  const [stick, setStick] = useState<{ start: number; end: number } | null>(null)
  const stickLayout = useRef<{ y: number; height: number } | null>(null)
  const relayout = inh.page?.relayout
  useEffect(() => {
    if (!relayout) return
    const f = () => stickLayout.current && measureRef.current?.(stickLayout.current)
    relayout.add(f)
    return () => void relayout.delete(f)
  }, [relayout])
  const measureRef = useRef<((l: { y: number; height: number }) => void) | null>(null)

  const parsed: Parsed = tw(className)
  const disabled = !!disabledProp || props['aria-disabled'] === true || props['aria-disabled'] === 'true'
  const interactive = !disabled && (PRESSES.some((k) => props[k]) || tag === 'button' || (tag === 'a' && props.href) || tag === 'summary' || (tag === 'input' && (props.type === 'checkbox' || props.type === 'radio')))
  const submit = tag === 'button' && props.type !== 'button' && props.type !== 'reset' && !!inh.form
  const link = tag === 'a' && typeof props.href === 'string' ? props.href : undefined
  // Touchable where its own pointer-events say auto again, in a box that lets touches through (the HUD's buttons, in bars over the street).
  const ownPe = style?.pointerEvents ?? parsed.base.f.pe
  const { pressed, handlers, unpress } = usePress(dom, props, interactive && ownPe !== 'none' && (!inh.peNone || ownPe === 'auto'), (e) => {
    if (e.defaultPrevented) return
    if (submit) inh.form!.submit()
    if (tag === 'summary') inh.details?.toggle()
    if (link) {
      if (/^(https?:|mailto:|tel:|whatsapp:)/.test(link)) void Linking.openURL(link)
      else if (!props.onClick) navigateTo(link)
    }
  })

  // What a screen reader says of it (TalkBack, VoiceOver): its label, and that it's a button or a link.
  const a11y = { 'aria-label': props['aria-label'], role: tag === 'button' || props.role === 'button' ? ('button' as const) : link ? ('link' as const) : undefined }

  // The shape: the utilities, the game's own classes (by state), the inline style, the !important ones; under the finger, disabled.
  const a = acc()
  const sem = SEMANTIC[tag]
  if (sem) Object.assign(a.t, sem)
  if (tag === 'small') a.t.fontSize = inh.text.fontSize * 0.83
  if (tag === 'sup' || tag === 'sub') a.t.fontSize = inh.text.fontSize * 0.75
  merge(a, parsed.base)
  if (parsed.own.length || tag === 'button')
    merge(a, ownStyle({ tag, pressed, disabled, focused, ariaPressed: props['aria-pressed'] === true || props['aria-pressed'] === 'true', ariaSelected: props['aria-selected'] === true || props['aria-selected'] === 'true', ariaInvalid: props['aria-invalid'] === true || props['aria-invalid'] === 'true', scopes: inh.scopes, parentOwn: inh.parentOwn, own: parsed.own }))
  if (style) merge(a, cssObject(style, inh.text.fontSize))
  merge(a, strongOf(parsed))
  if (pressed && parsed.active) merge(a, parsed.active)
  if (disabled && parsed.disabled) merge(a, parsed.disabled)
  // The animation its classes name (motion.css), on a value 0 → 1 (before any return: it's a hook).
  const anim = useClassAnim(a.f.anim, a.f.delay)
  if (a.f.display === 'none' || a.f.srOnly || props.hidden) return null

  const vars = a.vars ? { ...inh.vars, ...resolveAll(a.vars, inh.vars, inh.text.color) } : inh.vars
  const text = textOf(inh.text, a.t, vars)
  const display = a.f.display ?? (INLINE.has(tag) ? 'inline' : ATOM.has(tag) ? 'inline-block' : 'block')
  const box = boxOf(a, vars, text.color, display)
  // A page of a scroller (h-full right in it, a feed's video): the view's size, as the web has it (Yoga's 100% would be of the content).
  const vp = inh.viewport
  if (vp && !vp.horizontal && box.height === '100%') box.height = vp.h
  if (vp && vp.horizontal && box.width === '100%') box.width = vp.w
  const textStyle = rnText(text)
  const pe = a.f.pe === 'none' || (inh.peNone && a.f.pe !== 'auto')
  const sticky = a.f.position === 'sticky' && !!inh.page
  const stickTop = sticky ? Number(box.top) || 0 : 0
  if (sticky) delete box.top
  if (inh.selfAlign && box.alignSelf === undefined) box.alignSelf = inh.selfAlign
  // At the top of the page, a height in % is of the screen (the page's body), not of the scroller's content that grows with it.
  if (doc) for (const k of ['height', 'minHeight', 'maxHeight'] as const) if (typeof box[k] === 'string' && box[k].endsWith('%')) box[k] = (parseFloat(box[k]) / 100) * Dimensions.get('window').height
  // A block centred by mx-auto still fills its line up to its max width, as CSS has it (Yoga's auto margins would shrink it to its content).
  if (box.marginLeft === 'auto' && box.marginRight === 'auto' && box.width === undefined && !inh.row && !display.startsWith('inline') && display !== 'fit' && box.position !== 'absolute') box.width = '100%'

  const childCtx: Inh = {
    text,
    vars,
    scopes: scopesOf(inh.scopes, a),
    parentOwn: parsed.own,
    inText: false,
    peNone: pe,
    scroller: inh.scroller,
    form: tag === 'form' ? { submit: () => props.onSubmit?.(webEvent('submit', null, dom)) } : inh.form,
    details: tag === 'details' ? { open, toggle: () => setOpen((o) => !o) } : inh.details,
    row: (display.includes('flex') && String(box.flexDirection ?? 'row').startsWith('row')) || undefined,
    page: inh.page,
    parent: dom,
  }
  const hostRef = (n: any) => {
    dom.native = n
  }
  const lines = a.f.lines || (text.ws === 'nowrap' ? 1 : undefined)

  /* The form controls, the image, the line break. */
  if (tag === 'br') return <Text>{'\n'}</Text>
  if (tag === 'input' || tag === 'textarea') return <Field dom={dom} p={props} box={box} textStyle={textStyle} placeholder={parsed.placeholder} disabled={disabled} setFocused={setFocused} form={inh.form} hostRef={hostRef} />
  if (tag === 'select') return <Select p={props} box={box} textStyle={textStyle} disabled={disabled} hostRef={hostRef} />
  if (tag === 'img') return <Img p={props} box={box} fit={a.f.fit} hostRef={hostRef} />
  if (tag === 'video') return <Video dom={dom} p={props} box={box} fit={a.f.fit} hostRef={hostRef} />
  if (tag === 'canvas') return <CanvasView dom={dom} box={box} pe={pe} handlers={handlers} hostRef={hostRef} />
  if (tag === 'iframe') return <View ref={hostRef} style={[{ backgroundColor: '#000' }, box]} />
  if (tag === 'icon') return <IconBox p={props} box={box} color={text.color} anim={webAnim ?? anim?.style} pe={pe} handlers={handlers} hostRef={hostRef} vars={vars} />
  if (tag === 'option') return null

  /* Inline, in a line of text: a run of text in it. */
  if (inh.inText && display === 'inline') {
    const bg = box.backgroundColor ? { backgroundColor: box.backgroundColor } : null
    return (
      <Text ref={hostRef} style={[textStyle, bg]} onPress={interactive ? () => { props.onClick?.(webEvent('click', null, dom)); if (link && !props.onClick) navigateTo(link) } : undefined}>
        <DomCtx.Provider value={{ ...childCtx, inText: true }}>{children}</DomCtx.Provider>
      </Text>
    )
  }

  /* Its children, laid out as the web would. */
  let kids = flatten(children)
  if (tag === 'details' && !open) kids = kids.filter((c) => isValidElement(c) && c.type === El && (c.props as any).__tag === 'summary')
  const container = display.includes('flex') || display.includes('grid') || !!a.f.grid
  const scroll = !!(a.f.scrollX || a.f.scrollY)
  const kinds = kids.map(kindOf)
  const animStyle = webAnim ?? anim?.style

  // A block of only text and inline runs: one <Text> is the box (not under a scroller, no shadow or gradient a Text can't draw).
  const onlyText = !container && !scroll && kids.length > 0 && kinds.every((k) => k === 'text' || k === 'inline') && kinds.some((k) => k === 'text' || k === 'inline')
  if (onlyText && !box.boxShadow && !box.backgroundImage && !animStyle && !DRAGS.some((k) => props[k])) {
    return (
      <Text
        ref={hostRef}
        style={[box, textStyle]}
        numberOfLines={lines}
        ellipsizeMode={a.f.lines ? 'tail' : 'clip'}
        pointerEvents={pe ? 'none' : undefined}
        {...a11y}
        onPress={handlers ? (e) => handlers.onResponderRelease(e, true) : undefined}
        onPressIn={handlers ? (e) => handlers.onResponderGrant(e) : undefined}
        onPressOut={handlers ? unpress : undefined}
      >
        <DomCtx.Provider value={{ ...childCtx, inText: true }}>{kids}</DomCtx.Provider>
      </Text>
    )
  }

  let content: ReactNode
  // (Its gaps and alignment as written: the box's own style loses them below, they're the grid's.)
  if (a.f.grid || display.includes('grid')) content = <GridRows kids={kids} kinds={kinds} grid={a.f.grid ?? {}} layout={{ rowGap: box.rowGap ?? box.gap, columnGap: box.columnGap ?? box.gap, alignItems: box.alignItems, justifyItems: a.v.__justifyItems ?? a.v.__placeItems }} textStyle={textStyle} ctx={childCtx} />
  else if (container) content = flexItems(kids, kinds, textStyle, childCtx)
  else content = flowRuns(kids, kinds, textStyle, childCtx, lines, text.textAlign)

  // space-x-*, space-y-*: the gap between the children.
  if (a.f.spaceX !== undefined) box.columnGap = a.f.spaceX
  if (a.f.spaceY !== undefined) box.rowGap = a.f.spaceY
  if (a.f.grid || display.includes('grid')) {
    box.flexDirection = 'column'
    box.rowGap = box.rowGap ?? box.gap
    delete box.gap
    delete box.columnGap
  }
  const bgImage = a.v.__bgUrl ? <Image source={{ uri: absUrl(String(a.v.__bgUrl)) }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : null

  if (scroll) {
    const horizontal = !!a.f.scrollX && !a.f.scrollY
    const { outer, inner } = splitScroll(box)
    return (
      <ScrollView
        ref={hostRef}
        horizontal={horizontal}
        // Sized as the web sizes a scrolling box (React Native's would grow into what room its parent has: a row of chips as tall as the page).
        style={{ flexGrow: 0, ...outer }}
        contentContainerStyle={inner}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        pointerEvents={pe ? 'box-none' : undefined}
        // snap-y snap-mandatory (a feed of full pages): one page at a time (a row of cards snaps freely: their width isn't the view's).
        pagingEnabled={!!a.f.snapPages && !horizontal}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout
          dom.scrollState.viewH = height
          dom.scrollState.viewW = width
          setView((v) => (v && v.w === width && v.h === height ? v : { w: width, h: height }))
        }}
        onContentSizeChange={(w, h) => {
          dom.scrollState.width = w
          dom.scrollState.height = h
        }}
        onScroll={(e) => {
          const o = e.nativeEvent.contentOffset
          dom.scrollState.top = o.y
          dom.scrollState.left = o.x
          const ev = webEvent('scroll', null, dom)
          props.onScroll?.(ev)
          dom.emit('scroll', ev)
        }}
      >
        {bgImage}
        <DomCtx.Provider value={{ ...childCtx, scroller: dom, viewport: view ? { ...view, horizontal } : undefined }}>{content}</DomCtx.Provider>
      </ScrollView>
    )
  }

  // Sticky: moved down with the page's scroll between its start and end (on the UI thread, as the scroll is).
  const stickStyle =
    sticky && stick && stick.end > stick.start
      ? { transform: [...((box.transform as any[]) ?? []), { translateY: inh.page!.y.interpolate({ inputRange: [stick.start, stick.end], outputRange: [0, stick.end - stick.start], extrapolate: 'clamp' }) }] }
      : null
  const measureStick = (layout: { y: number; height: number }) => {
    const content = inh.page?.content.current
    const parent = inh.parent?.native
    if (!content || !parent?.measureLayout) return
    parent.measureLayout(
      content,
      (_x: number, py: number, _w: number, ph: number) => {
        const start = py + layout.y - stickTop
        const end = py + ph - layout.height - stickTop
        setStick((s) => (s && Math.abs(s.start - start) < 0.5 && Math.abs(s.end - end) < 0.5 ? s : { start, end }))
      },
      () => {},
    )
  }
  measureRef.current = sticky ? measureStick : null
  const Host: any = animStyle || stickStyle ? Animated.View : View
  return (
    <Host
      ref={hostRef}
      style={[box, animStyle, stickStyle]}
      pointerEvents={pe ? 'box-none' : undefined}
      {...a11y}
      {...(handlers ?? {})}
      onLayout={
        doc || sticky
          ? (e: LayoutChangeEvent) => {
              props.onLayout?.(e)
              const l = e.nativeEvent.layout
              doc?.(dom, l.y + l.height)
              if (sticky) {
                stickLayout.current = { y: l.y, height: l.height }
                measureStick(l)
              }
            }
          : props.onLayout
      }
    >
      {bgImage}
      <DomCtx.Provider value={childCtx}>{content}</DomCtx.Provider>
    </Host>
  )
}


/* ---------- Flows ---------- */

/** Flex (or grid) items: each run of text its own item; whitespace between boxes dropped, as CSS does. */
function flexItems(kids: any[], kinds: Kind[], textStyle: any, ctx: Inh) {
  const out: ReactNode[] = []
  let buf: string[] = []
  const flush = () => {
    const s = buf.join('')
    buf = []
    if (!s.trim()) return
    out.push(
      <Text key={`t${out.length}`} style={textStyle}>
        {s}
      </Text>,
    )
  }
  kids.forEach((c, i) => {
    if (kinds[i] === 'text') buf.push(String(c))
    else {
      flush()
      out.push(<Fragment key={keyOf(c, i)}>{c}</Fragment>)
    }
  })
  flush()
  return out
}

const keyOf = (c: any, i: number) => (isValidElement(c) ? `s${slots.get(c) ?? (c.key != null ? `k${String(c.key)}` : i)}` : `i${i}`)
/** A line's key: its first box's (a run of words alone keeps its place's). */
const runKey = (kids: any[], run: number[]) => {
  const first = run.find((i) => isValidElement(kids[i]))
  return `r${first === undefined ? run[0] : keyOf(kids[first], first)}`
}

/**
 * A block's children: its lines (runs of text and inline boxes, one <Text>
 * each, or a row of inline boxes alone) between its blocks; what's absolute
 * set apart.
 */
function flowRuns(kids: any[], kinds: Kind[], textStyle: any, ctx: Inh, lines: number | undefined, align?: string) {
  const out: ReactNode[] = []
  let run: number[] = []
  const flush = () => {
    if (!run.length) return
    const hasText = run.some((i) => kinds[i] === 'text' || kinds[i] === 'inline')
    if (hasText) {
      const onlySpace = run.every((i) => kinds[i] === 'text' && !String(kids[i]).trim())
      if (!onlySpace)
        out.push(
          <Text key={runKey(kids, run)} style={textStyle} numberOfLines={lines}>
            <DomCtx.Provider value={{ ...ctx, inText: true }}>{run.map((i) => (kinds[i] === 'text' ? String(kids[i]) : <Fragment key={keyOf(kids[i], i)}>{kids[i]}</Fragment>))}</DomCtx.Provider>
          </Text>,
        )
    } else if (run.length === 1) {
      // One inline box alone on its line: set straight in the block (a row around it would undo its h-full), at the line's start, middle or end.
      const i = run[0]
      out.push(
        <DomCtx.Provider key={runKey(kids, run)} value={{ ...ctx, selfAlign: align === 'center' ? 'center' : align === 'right' || align === 'end' ? 'flex-end' : 'flex-start' }}>
          {kids[i]}
        </DomCtx.Provider>,
      )
    } else
      out.push(
        <View key={runKey(kids, run)} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: align === 'center' ? 'center' : align === 'right' || align === 'end' ? 'flex-end' : 'flex-start' }}>
          {run.map((i) => (
            <Fragment key={keyOf(kids[i], i)}>{kids[i]}</Fragment>
          ))}
        </View>,
      )
    run = []
  }
  kids.forEach((c, i) => {
    const k = kinds[i]
    if (k === 'text' || k === 'inline' || k === 'atom') run.push(i)
    else {
      flush()
      out.push(<Fragment key={keyOf(c, i)}>{c}</Fragment>)
    }
  })
  flush()
  return out
}

/** A grid: rows of cells, each column as its track says (1fr, auto, 80px, as many as fit). */
type GridLayout = { rowGap?: number; columnGap?: number; alignItems?: string; justifyItems?: string }
function GridRows({ kids, kinds, grid, layout: box, textStyle, ctx }: { kids: any[]; kinds: Kind[]; grid: Grid; layout: GridLayout; textStyle: any; ctx: Inh }) {
  const [width, setWidth] = useState(0)
  const items = flexItems(kids, kinds, textStyle, ctx) as any[]
  const abs: ReactNode[] = []
  const cells: { node: ReactNode; span: number }[] = []
  items.forEach((it) => {
    const inner = isValidElement(it) && it.type === Fragment ? (it.props as any).children : it
    if (kindOf(inner) === 'abs') abs.push(it)
    else cells.push({ node: it, span: isValidElement(inner) && inner.type === El ? Math.max(1, placeOf(inner.props).span ?? 1) : 1 })
  })
  let cols = grid.cols ?? (grid.flow === 'column' ? cells.map(() => '1fr') : ['1fr'])
  const fill = cols.find((c) => c.startsWith('fill:'))
  if (fill) {
    const min = Number(fill.slice(5)) || 100
    const gap = Number(box.columnGap ?? 0)
    cols = Array(Math.max(1, Math.floor((width + gap) / (min + gap)) || 1)).fill('1fr')
  }
  const n = cols.length
  const rows: { node: ReactNode; col: number; span: number }[][] = []
  let row: { node: ReactNode; col: number; span: number }[] = []
  let col = 0
  for (const c of cells) {
    const span = Math.min(c.span, n)
    if (col + span > n) {
      rows.push(row)
      row = []
      col = 0
    }
    row.push({ node: c.node, col, span })
    col += span
    if (col >= n) {
      rows.push(row)
      row = []
      col = 0
    }
  }
  if (row.length) rows.push(row)
  const cell = (start: number, span: number) => {
    let grow = 0
    let fixed = 0
    let auto = false
    for (let k = start; k < start + span; k++) {
      const t = cols[k] ?? '1fr'
      if (t.endsWith('fr')) grow += parseFloat(t) || 1
      else if (/^\d/.test(t)) fixed += Number(t.replace('px', ''))
      else auto = true
    }
    if (grow) return { flexGrow: grow, flexShrink: 1, flexBasis: 0, minWidth: 0 }
    if (fixed) return { width: fixed, flexShrink: 0 }
    return auto ? { flexShrink: 0 } : { flex: 1 }
  }
  // The empty cells at the end of a row keep their room (the row's other cells don't stretch into it).
  const pad = (r: typeof row) => {
    const used = r.reduce((s, c) => s + c.span, 0)
    return used < n && !fill ? [{ node: null, col: used, span: n - used }] : []
  }
  return (
    // The rows share what height the grid has beyond their own (CSS's auto tracks stretch): a sized grid's lone row fills it.
    <View style={{ rowGap: box.rowGap, alignSelf: 'stretch', flexGrow: 1 }} onLayout={fill ? (e) => setWidth(e.nativeEvent.layout.width) : undefined}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', columnGap: box.columnGap, alignItems: (box.alignItems ?? 'stretch') as any, flexGrow: 1 }}>
          {[...r, ...pad(r)].map((c, j) => (
            <View key={(isValidElement(c.node) && c.node.key) || `p${j}`} style={[cell(c.col, c.span), { alignItems: (box.justifyItems ?? 'stretch') as any }]}>
              {c.node}
            </View>
          ))}
        </View>
      ))}
      {abs}
    </View>
  )
}

/** A scroller's style: its size and place outside, its padding and layout inside. */
function splitScroll(box: Record<string, any>) {
  const inner: Record<string, any> = {}
  const outer: Record<string, any> = {}
  for (const [k, v] of Object.entries(box)) {
    if (/^padding|^gap$|^rowGap$|^columnGap$|^flexDirection$|^alignItems$|^justifyContent$|^flexWrap$/.test(k)) inner[k] = v
    else outer[k] = v
  }
  // A column scroller lays its children out as a block would.
  return { outer, inner }
}

/* ---------- Animations of the classes ---------- */

function useClassAnim(names?: string[], delay?: number) {
  const key = names?.join(' ') ?? ''
  const value = useRef<Animated.Value | null>(null)
  const play = useMemo(() => (key ? playOf(key, delay) : null), [key, delay])
  if (play && !value.current) value.current = new Animated.Value(0)
  useEffect(() => {
    if (!play || !value.current) return
    value.current.setValue(0)
    const h = run(play, value.current)
    return () => h.stop()
  }, [play])
  return play && value.current ? { style: styleOf(play, value.current) } : null
}

/* ---------- Icons ---------- */

/**
 * A lucide icon (shims/lucide.js): sized by its classes (h-4 w-4, size-5) or
 * its size, in the text's colour as the web's currentColor, placed, faded and
 * animated (animate-spin) as any element.
 */
function IconBox({ p, box, color, anim, pe, handlers, hostRef, vars }: { p: any; box: Record<string, any>; color: string; anim?: any; pe: boolean; handlers: Record<string, any> | null; hostRef: (n: any) => void; vars: Record<string, string> }) {
  const Icon = p.__icon
  const w = typeof box.width === 'number' ? box.width : (p.width ?? p.size ?? 24)
  const h = typeof box.height === 'number' ? box.height : (p.height ?? p.size ?? 24)
  const c = p.color ? resolve(String(p.color), vars, color) : color
  const fill = p.fill === undefined || p.fill === 'none' ? 'none' : resolve(String(p.fill), vars, c)
  const Host: any = anim ? Animated.View : View
  return (
    <Host ref={hostRef} style={[{ width: w, height: h }, box, anim]} pointerEvents={pe ? 'none' : undefined} {...(handlers ?? {})}>
      <Icon width={w} height={h} color={c} fill={fill} strokeWidth={p.strokeWidth ?? 2} absoluteStrokeWidth={p.absoluteStrokeWidth} />
    </Host>
  )
}

/* ---------- Form controls ---------- */

function Field({ dom, p, box, textStyle, placeholder, disabled, setFocused, form, hostRef }: { dom: DomNode; p: any; box: any; textStyle: any; placeholder?: string; disabled: boolean; setFocused: (f: boolean) => void; form?: { submit: () => void }; hostRef: (n: any) => void }) {
  const type = p.type ?? 'text'
  if (type === 'checkbox' || type === 'radio') {
    const on = !!p.checked
    return (
      <Pressable ref={hostRef} disabled={disabled} onPress={() => p.onChange?.({ target: Object.assign(dom, { checked: !on }), currentTarget: dom, preventDefault() {} })} style={[{ width: 20, height: 20, borderRadius: type === 'radio' ? 10 : 5, borderWidth: 2, borderColor: on ? '#ff7a00' : '#c4c8d4', backgroundColor: on ? '#ff7a00' : '#fff', alignItems: 'center', justifyContent: 'center' }, box]}>
        {on && <View style={{ width: 8, height: 8, borderRadius: type === 'radio' ? 4 : 1, backgroundColor: '#fff' }} />}
      </Pressable>
    )
  }
  if (type === 'range') return <Range dom={dom} p={p} box={box} disabled={disabled} hostRef={hostRef} />
  if (type === 'file' || type === 'hidden') return null
  const change = (text: string) => {
    dom.value = text
    const ev = { target: dom, currentTarget: dom, preventDefault() {}, stopPropagation() {}, nativeEvent: { text } }
    p.onChange?.(ev)
    p.onInput?.(ev)
  }
  const key = (k: string) => {
    // (A handler that prevents the default keeps Enter from sending the form.)
    const ev = { key: k, code: k, target: dom, currentTarget: dom, defaultPrevented: false, preventDefault() {
        ev.defaultPrevented = true
      }, stopPropagation() {}, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, nativeEvent: { isComposing: false } }
    p.onKeyDown?.(ev)
    p.onKeyUp?.(ev)
    return ev
  }
  const multiline = p.__tag === 'textarea'
  return (
    <TextInput
      ref={hostRef}
      style={[textStyle, { paddingVertical: 0 }, box, multiline ? { textAlignVertical: 'top' } : null]}
      value={p.value !== undefined ? String(p.value) : undefined}
      defaultValue={p.defaultValue !== undefined ? String(p.defaultValue) : undefined}
      onChangeText={change}
      placeholder={p.placeholder}
      placeholderTextColor={placeholder ?? '#9aa0b4'}
      secureTextEntry={type === 'password'}
      keyboardType={type === 'number' || p.inputMode === 'numeric' || p.inputMode === 'decimal' ? 'numeric' : type === 'email' ? 'email-address' : type === 'tel' ? 'phone-pad' : 'default'}
      autoCapitalize={type === 'email' || type === 'password' || p.autoCapitalize === 'none' || p.autoCapitalize === 'off' ? 'none' : 'sentences'}
      autoCorrect={p.autoCorrect !== 'off' && p.spellCheck !== false}
      autoFocus={!!p.autoFocus}
      maxLength={p.maxLength}
      editable={!disabled && !p.readOnly}
      multiline={multiline}
      numberOfLines={multiline ? (p.rows ?? 3) : undefined}
      onFocus={(e) => {
        setFocused(true)
        p.onFocus?.({ target: dom, currentTarget: dom, nativeEvent: e.nativeEvent })
      }}
      onBlur={(e) => {
        setFocused(false)
        p.onBlur?.({ target: dom, currentTarget: dom, nativeEvent: e.nativeEvent })
      }}
      onKeyPress={(e) => {
        const k = e.nativeEvent.key
        if (k !== 'Enter') key(k)
      }}
      onSubmitEditing={() => {
        const ev = key('Enter')
        if (!ev.defaultPrevented && !multiline) form?.submit()
      }}
      submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
    />
  )
}

/** <input type="range">: a track and a thumb, dragged. */
function Range({ dom, p, box, disabled, hostRef }: { dom: DomNode; p: any; box: any; disabled: boolean; hostRef: (n: any) => void }) {
  const min = Number(p.min ?? 0)
  const max = Number(p.max ?? 100)
  const step = Number(p.step ?? 1)
  const value = Number(p.value ?? p.defaultValue ?? min)
  const width = useRef(1)
  const set = (x: number) => {
    const k = Math.max(0, Math.min(1, x / width.current))
    const v = Math.round((min + k * (max - min)) / step) * step
    dom.value = String(v)
    p.onChange?.({ target: dom, currentTarget: dom, preventDefault() {} })
    p.onInput?.({ target: dom, currentTarget: dom, preventDefault() {} })
  }
  const k = (value - min) / (max - min || 1)
  return (
    <View
      ref={hostRef}
      style={[{ height: 28, justifyContent: 'center' }, box]}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width || 1)}
      onStartShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => set(e.nativeEvent.locationX)}
      onResponderMove={(e) => set(e.nativeEvent.locationX)}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: '#e7e9f2' }}>
        <View style={{ width: `${k * 100}%`, height: 6, borderRadius: 3, backgroundColor: '#ff7a00' }} />
      </View>
      <View style={{ position: 'absolute', left: `${k * 100}%`, marginLeft: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: '#ff7a00' }} />
    </View>
  )
}

/** <select>: the chosen option, and the list of them in a sheet when tapped. */
function Select({ p, box, textStyle, disabled, hostRef }: { p: any; box: any; textStyle: any; disabled: boolean; hostRef: (n: any) => void }) {
  const [open, setOpen] = useState(false)
  // The options, those in an <optgroup> under its label.
  const tagOf = (c: any) => (isValidElement(c) && c.type === El ? (c.props as any).__tag : undefined)
  const options = flatten(p.children).flatMap((c: any) =>
    tagOf(c) === 'optgroup'
      ? flatten(c.props.children)
          .filter((o) => tagOf(o) === 'option')
          .map((o: any) => ({ o, group: String(c.props.label ?? '') }))
      : tagOf(c) === 'option'
        ? [{ o: c, group: '' }]
        : [],
  ).map(({ o, group }: { o: any; group: string }) => ({ value: String(o.props.value ?? labelOf(o.props.children)), label: labelOf(o.props.children), disabled: !!o.props.disabled, group }))
  const current = options.find((o) => o.value === String(p.value ?? p.defaultValue ?? '')) ?? options[0]
  const pick = (v: string) => {
    setOpen(false)
    p.onChange?.({ target: { value: v }, currentTarget: { value: v }, preventDefault() {} })
  }
  return (
    <>
      <Pressable ref={hostRef} disabled={disabled} onPress={() => setOpen(true)} style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, box]}>
        <Text style={textStyle} numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <Text style={[textStyle, { marginLeft: 6, opacity: 0.6 }]}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,18,48,0.45)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <ScrollView style={{ maxHeight: '60%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 }} contentContainerStyle={{ paddingVertical: 10 }}>
            {options.map((o, i) => (
              <Fragment key={`${o.group}|${o.value}`}>
                {o.group && o.group !== options[i - 1]?.group && <Text style={[textStyle, { fontSize: 12, fontWeight: '800', opacity: 0.55, paddingTop: 12, paddingHorizontal: 20, textTransform: 'uppercase' }]}>{o.group}</Text>}
                <Pressable disabled={o.disabled} onPress={() => pick(o.value)} style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: o.value === current?.value ? '#fff7ef' : undefined }}>
                  <Text style={[textStyle, { fontSize: 16, opacity: o.disabled ? 0.4 : 1 }]}>{o.label}</Text>
                </Pressable>
              </Fragment>
            ))}
          </ScrollView>
        </Pressable>
      </Modal>
    </>
  )
}
const labelOf = (c: ReactNode): string => flatten(c).map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : isValidElement(x) ? labelOf((x.props as any).children) : '')).join('')

/** <img>: from the bundle (a number), a data: address, or the web. */
function Img({ p, box, fit, hostRef }: { p: any; box: any; fit?: string; hostRef: (n: any) => void }) {
  const src = p.src
  if (!src) return null
  const source = typeof src === 'number' ? src : { uri: typeof src === 'string' ? absUrl(src) : String(src) }
  const size = { width: p.width !== undefined ? Number(p.width) : undefined, height: p.height !== undefined ? Number(p.height) : undefined }
  return <Image ref={hostRef} source={source} style={[size, box]} resizeMode={fit === 'contain' ? 'contain' : fit === 'fill' ? 'stretch' : 'cover'} onLoad={p.onLoad ? () => p.onLoad({}) : undefined} onError={p.onError ? () => p.onError({}) : undefined} />
}

/**
 * A <video>: expo-video's player, as the web's element behaves: autoplay,
 * loop, muted, its poster until it plays, preload="none" fetching only when
 * it's played; play() and pause() from the game's code (DomNode.media).
 */
function Video({ dom, p, box, fit, hostRef }: { dom: DomNode; p: any; box: any; fit?: string; hostRef: (n: any) => void }) {
  const src = typeof p.src === 'string' && p.src ? absUrl(p.src) : null
  const want = useRef(!!p.autoPlay)
  const [loaded, setLoaded] = useState(p.preload !== 'none' || !!p.autoPlay)
  // Its poster stays until a frame of the video is drawn (playing, but not yet shown, is still the poster).
  const [shown, setShown] = useState(false)
  const player = useVideoPlayer(loaded ? src : null, (pl) => {
    pl.loop = !!p.loop
    pl.muted = !!p.muted
    if (want.current) pl.play()
  })
  useEffect(() => {
    const b = player.addListener('playToEnd', () => p.onEnded?.({ type: 'ended', target: dom, currentTarget: dom }))
    return () => b.remove()
  }, [player]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    player.loop = !!p.loop
  }, [player, p.loop])
  dom.media = {
    play: () => {
      want.current = true
      if (!loaded) setLoaded(true)
      else player.play()
    },
    pause: () => {
      want.current = false
      player.pause()
    },
    get playing() {
      return player.playing
    },
    get currentTime() {
      return player.currentTime
    },
    set currentTime(t: number) {
      player.currentTime = t
    },
    get muted() {
      return player.muted
    },
    set muted(v: boolean) {
      player.muted = v
    },
    get duration() {
      return player.duration
    },
  }
  const mode = fit === 'contain' ? 'contain' : fit === 'fill' ? 'fill' : 'cover'
  return (
    <View ref={hostRef} style={[{ overflow: 'hidden', backgroundColor: '#000' }, box]} pointerEvents={p.controls ? 'auto' : 'none'}>
      {loaded && src && <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={mode} nativeControls={!!p.controls} allowsPictureInPicture={false} onFirstFrameRender={() => setShown(true)} />}
      {typeof p.poster === 'string' && !shown && <Image source={{ uri: absUrl(p.poster) }} style={StyleSheet.absoluteFill} resizeMode={mode === 'fill' ? 'stretch' : mode} />}
    </View>
  )
}

/* ---------- SVG ---------- */

/** An <svg> and what's in it, as react-native-svg draws it; its size and place from its classes. */
function SvgEl(props: any) {
  const { __tag: tag, className, style, children, ref: _ref, ...rest } = props
  const inh = useContext(DomCtx)
  const Comp = SVG_TAGS[tag]
  const attrs: Record<string, any> = {}
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('on') || k.startsWith('aria-') || k.startsWith('data-') || k === 'xmlns' || k === 'role' || k === 'focusable') continue
    attrs[k === 'class' ? 'className' : k] = typeof v === 'string' && v.includes('var(') ? resolve(v, inh.vars, inh.text.color) : v
  }
  if (tag !== 'svg') {
    // A style={{}} on a shape: its fill and stroke only.
    if (style?.fill) attrs.fill = resolve(String(style.fill), inh.vars, inh.text.color)
    if (style?.stroke) attrs.stroke = resolve(String(style.stroke), inh.vars, inh.text.color)
    if (style?.opacity !== undefined) attrs.opacity = style.opacity
    return <Comp {...attrs}>{children}</Comp>
  }
  const parsed = tw(className)
  const a = acc()
  merge(a, parsed.base)
  if (style) merge(a, cssObject(style, inh.text.fontSize))
  merge(a, strongOf(parsed))
  if (a.f.display === 'none') return null
  const text = textOf(inh.text, a.t, inh.vars)
  const box = boxOf(a, inh.vars, text.color, 'block')
  const width = attrs.width ?? box.width
  const height = attrs.height ?? box.height
  return (
    <DomCtx.Provider value={{ ...inh, svg: true, text }}>
      <SVG.Svg {...attrs} width={width} height={height} color={text.color} style={box} pointerEvents={props.onClick ? undefined : 'none'}>
        {children}
      </SVG.Svg>
    </DomCtx.Provider>
  )
}
