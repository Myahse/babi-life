import { Dimensions } from 'react-native'
import { acc, arbitrary, colorOf, declare, length, merge, tracks, type Acc } from './style'
import { BREAKPOINT, CONTAINER, LEADING, RADIUS, SHADOW, TEXT, TRACKING, WEIGHT } from './theme'

// A className of the game (Tailwind v4 utilities, and the game's own classes of index.css) read
// once into our shape (style.ts) and kept. What depends on the screen (sm:, max-sm:, short:) is
// read for the screen as it is: the cache starts again when it turns.

export type Parsed = {
  /** The utilities, then the game's own classes (unlayered, they win), then the !important ones. */
  base: Acc
  /** Under a finger (active:), and disabled (disabled:). */
  active?: Acc
  disabled?: Acc
  placeholder?: string
  /** The game's own classes (btn, card, tile…), styled with the element's state (components.ts). */
  own: string[]
  group?: boolean
}

const cache = new Map<string, Parsed>()
Dimensions.addEventListener('change', () => cache.clear())

/** Is a variant (sm:, max-md:, short:, landscape:) on, on this screen? undefined: not a variant we keep (hover:, focus:…: off). */
function variantOn(v: string): boolean | 'active' | 'disabled' | 'placeholder' {
  const { width, height } = Dimensions.get('window')
  if (BREAKPOINT[v]) return width >= BREAKPOINT[v]
  const max = /^max-(.+)$/.exec(v)
  if (max && BREAKPOINT[max[1]]) return width < BREAKPOINT[max[1]]
  switch (v) {
    case 'short':
      return height <= 520
    case 'landscape':
      return width > height
    case 'portrait':
      return height >= width
    case 'motion-safe':
      return true
    case 'active':
    case 'group-active':
      return 'active'
    case 'disabled':
      return 'disabled'
    case 'placeholder':
      return 'placeholder'
    default:
      return false
  }
}

/** Tailwind's spacing (v4: 0.25rem a step), fractions, keywords and [arbitrary]. */
function size(v: string, axis: 'w' | 'h' = 'w'): number | string | undefined {
  if (v === 'px') return 1
  if (v === 'full') return '100%'
  if (v === 'auto') return 'auto'
  if (['screen', 'dvh', 'svh', 'lvh', 'dvw', 'svw', 'lvw'].includes(v)) {
    const d = Dimensions.get('window')
    return v === 'screen' ? (axis === 'w' ? d.width : d.height) : v.endsWith('w') ? d.width : d.height
  }
  if (v === 'fit' || v === 'min' || v === 'max') return undefined
  if (/^\d+\/\d+$/.test(v)) {
    const [a, b] = v.split('/').map(Number)
    return `${+((a / b) * 100).toFixed(4)}%`
  }
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v) * 4
  if (v.startsWith('[')) return length(arbitrary(v))
  if (v.startsWith('(')) return length(`var(${v.slice(1, -1)})`)
  return undefined
}

const neg = (n: number | string | undefined, minus: boolean) => (!minus || n === undefined ? n : typeof n === 'number' ? -n : n.startsWith('-') ? n.slice(1) : `-${n}`)

const SIDES: Record<string, string[]> = {
  '': ['Top', 'Right', 'Bottom', 'Left'],
  x: ['Left', 'Right'],
  y: ['Top', 'Bottom'],
  t: ['Top'],
  r: ['Right'],
  b: ['Bottom'],
  l: ['Left'],
  s: ['Left'],
  e: ['Right'],
}
const CORNERS: Record<string, string[]> = {
  '': ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'],
  t: ['TopLeft', 'TopRight'],
  b: ['BottomLeft', 'BottomRight'],
  l: ['TopLeft', 'BottomLeft'],
  r: ['TopRight', 'BottomRight'],
  tl: ['TopLeft'],
  tr: ['TopRight'],
  bl: ['BottomLeft'],
  br: ['BottomRight'],
  s: ['TopLeft', 'BottomLeft'],
  e: ['TopRight', 'BottomRight'],
}
const ALIGN: Record<string, string> = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around', evenly: 'space-evenly', stretch: 'stretch', baseline: 'baseline', normal: 'stretch', 'center-safe': 'center', 'end-safe': 'flex-end' }
const GRAD_DIR: Record<string, string> = { t: 'to top', b: 'to bottom', l: 'to left', r: 'to right', tr: 'to top right', tl: 'to top left', br: 'to bottom right', bl: 'to bottom left' }
const ANIMS = new Set(['animate-pop', 'animate-up', 'animate-float', 'animate-spin', 'animate-pulse', 'animate-ping', 'animate-bounce', 'animate-spin-y'])

/** One utility (no variant, no !) into the shape; false when it's none we know. */
function utility(a: Acc, u: string): boolean {
  const minus = u.startsWith('-')
  const c = minus ? u.slice(1) : u
  const v = a.v
  const t = a.t
  const f = a.f

  // [prop:value]
  if (c.startsWith('[') && c.endsWith(']') && c.includes(':')) {
    const body = arbitrary(c)
    const i = body.indexOf(':')
    declare(a, body.slice(0, i), body.slice(i + 1))
    return true
  }

  switch (c) {
    case 'block':
    case 'inline-block':
    case 'inline':
    case 'flex':
    case 'inline-flex':
    case 'grid':
    case 'inline-grid':
    case 'contents':
    case 'table':
    case 'flow-root':
      f.display = c
      if (c === 'flex' || c === 'inline-flex') v.flexDirection ??= 'row'
      return true
    case 'hidden':
      f.display = 'none'
      return true
    case 'flex-row':
      v.flexDirection = 'row'
      return true
    case 'flex-row-reverse':
      v.flexDirection = 'row-reverse'
      return true
    case 'flex-col':
      v.flexDirection = 'column'
      return true
    case 'flex-col-reverse':
      v.flexDirection = 'column-reverse'
      return true
    case 'flex-wrap':
      v.flexWrap = 'wrap'
      return true
    case 'flex-wrap-reverse':
      v.flexWrap = 'wrap-reverse'
      return true
    case 'flex-nowrap':
      v.flexWrap = 'nowrap'
      return true
    case 'flex-1':
      Object.assign(v, { flexGrow: 1, flexShrink: 1, flexBasis: 0 })
      return true
    case 'flex-auto':
      Object.assign(v, { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' })
      return true
    case 'flex-initial':
      Object.assign(v, { flexGrow: 0, flexShrink: 1 })
      return true
    case 'flex-none':
      Object.assign(v, { flexGrow: 0, flexShrink: 0 })
      return true
    case 'grow':
      v.flexGrow = 1
      return true
    case 'grow-0':
      v.flexGrow = 0
      return true
    case 'shrink':
      v.flexShrink = 1
      return true
    case 'shrink-0':
      v.flexShrink = 0
      return true
    case 'static':
      f.position = 'static'
      v.position = 'relative'
      return true
    case 'relative':
    case 'absolute':
      f.position = c
      v.position = c
      return true
    case 'fixed':
      f.position = 'fixed'
      v.position = 'absolute'
      return true
    case 'sticky':
      f.position = 'sticky'
      v.position = 'relative'
      return true
    case 'isolate':
    case 'transform':
    case 'transform-gpu':
    case 'antialiased':
    case 'select-none':
    case 'select-text':
    case 'select-all':
    case 'outline-none':
    case 'resize-none':
    case 'appearance-none':
    case 'break-words':
    case 'break-all':
    case 'box-decoration-clone':
    case 'no-scrollbar':
    case 'overscroll-contain':
    case 'overscroll-none':
    case 'touch-none':
    case 'touch-manipulation':
    case 'touch-pan-y':
    case 'touch-pan-x':
    case 'group':
    case 'peer':
    case 'snap-x':
    case 'snap-y':
    case 'snap-start':
    case 'snap-center':
    case 'snap-always':
    case 'snap-end':
    case 'will-change-transform':
    case 'transition':
    case 'transition-all':
    case 'transition-colors':
    case 'transition-opacity':
    case 'transition-transform':
    case 'transition-none':
    case 'ease-in':
    case 'ease-out':
    case 'ease-in-out':
    case 'ease-linear':
    case 'grid-flow-dense':
    case 'list-none':
    case 'list-disc':
    case 'list-inside':
    case 'ring-inset':
    case 'border-solid':
    case 'border-collapse':
    case 'subpixel-antialiased':
    case 'text-ellipsis':
    case 'text-clip':
    case 'box-border':
    case 'box-content':
    case 'bg-fixed':
    case 'bg-no-repeat':
    case 'bg-repeat':
    case 'bg-center':
    case 'bg-top':
    case 'bg-bottom':
      if (c === 'ring-inset') f.ringInset = true
      return true
    case 'bg-cover':
    case 'bg-contain':
      f.fit = c.slice(3)
      return true
    case 'object-cover':
    case 'object-contain':
    case 'object-fill':
    case 'object-center':
    case 'object-top':
    case 'object-bottom':
      f.fit = c.slice(7)
      return true
    case 'overflow-hidden':
    case 'overflow-clip':
    case 'overflow-x-hidden':
    case 'overflow-y-hidden':
    case 'overflow-x-clip':
    case 'overflow-y-clip':
      v.overflow = 'hidden'
      return true
    case 'overflow-visible':
    case 'overflow-x-visible':
    case 'overflow-y-visible':
      v.overflow = 'visible'
      return true
    case 'overflow-auto':
    case 'overflow-scroll':
    case 'overflow-y-auto':
    case 'overflow-y-scroll':
      f.scrollY = true
      return true
    case 'overflow-x-auto':
    case 'overflow-x-scroll':
      f.scrollX = true
      return true
    case 'snap-mandatory':
      f.snapPages = true
      return true
    case 'pointer-events-none':
      f.pe = 'none'
      return true
    case 'pointer-events-auto':
      f.pe = 'auto'
      return true
    case 'visible':
      f.invisible = false
      return true
    case 'invisible':
      f.invisible = true
      return true
    case 'sr-only':
      f.srOnly = true
      return true
    case 'truncate':
      f.lines = 1
      return true
    case 'line-clamp-none':
      f.lines = 0
      return true
    // White space is inherited, as in CSS: the words' own state (elements.tsx).
    case 'whitespace-nowrap':
    case 'text-nowrap':
      t.ws = 'nowrap'
      return true
    case 'whitespace-pre':
    case 'whitespace-pre-line':
    case 'whitespace-pre-wrap':
    case 'whitespace-break-spaces':
      t.ws = 'pre'
      return true
    case 'whitespace-normal':
    case 'text-wrap':
    case 'text-balance':
    case 'text-pretty':
      t.ws = 'normal'
      return true
    case 'italic':
      t.fontStyle = 'italic'
      return true
    case 'not-italic':
      t.fontStyle = 'normal'
      return true
    case 'uppercase':
    case 'lowercase':
    case 'capitalize':
      t.textTransform = c
      return true
    case 'normal-case':
      t.textTransform = 'none'
      return true
    case 'underline':
      t.textDecorationLine = 'underline'
      return true
    case 'line-through':
      t.textDecorationLine = 'line-through'
      return true
    case 'no-underline':
      t.textDecorationLine = 'none'
      return true
    case 'tabular-nums':
      t.fontVariant = ['tabular-nums']
      return true
    case 'font-sans':
      t.fontKey = 'sans'
      return true
    case 'font-display':
      // index.css: .font-display draws a hair tighter.
      t.fontKey = 'display'
      t.letterSpacing = { em: -0.01 }
      return true
    case 'font-mono':
      t.fontKey = 'mono'
      return true
    case 'font-serif':
      t.fontKey = 'slab'
      return true
    case 'text-left':
    case 'text-start':
      t.textAlign = 'left'
      return true
    case 'text-center':
      t.textAlign = 'center'
      return true
    case 'text-right':
    case 'text-end':
      t.textAlign = 'right'
      return true
    case 'text-justify':
      t.textAlign = 'justify'
      return true
    case 'border':
      v.borderWidth = 1
      return true
    case 'border-dashed':
    case 'border-dotted':
      v.borderStyle = c.slice(7)
      return true
    case 'border-none':
      v.borderWidth = 0
      return true
    case 'ring':
      f.ring = 3
      return true
    case 'shadow':
      f.shadow = SHADOW['']
      return true
    case 'rounded':
      v.borderRadius = RADIUS['']
      return true
    case 'aspect-square':
      v.aspectRatio = 1
      return true
    case 'aspect-video':
      v.aspectRatio = 16 / 9
      return true
    case 'mx-auto':
      v.marginLeft = v.marginRight = 'auto'
      return true
    case 'my-auto':
      v.marginTop = v.marginBottom = 'auto'
      return true
    case 'm-auto':
      v.marginLeft = v.marginRight = v.marginTop = v.marginBottom = 'auto'
      return true
    case 'ml-auto':
    case 'ms-auto':
      v.marginLeft = 'auto'
      return true
    case 'mr-auto':
    case 'me-auto':
      v.marginRight = 'auto'
      return true
    case 'mt-auto':
      v.marginTop = 'auto'
      return true
    case 'mb-auto':
      v.marginBottom = 'auto'
      return true
    case 'blur':
    case 'backdrop-blur':
    case 'drop-shadow':
      return true
    case 'divide-y':
      f.divideY = 1
      return true
    case 'divide-x':
      f.divideX = 1
      return true
    case 'bg-none':
      v.backgroundImage = undefined
      return true
    case 'inset-0':
      Object.assign(v, { top: 0, right: 0, bottom: 0, left: 0 })
      return true
  }
  if (ANIMS.has(c)) {
    f.anim = [...(f.anim ?? []), c.slice(8)]
    return true
  }

  let m: RegExpExecArray | null
  // Spacing: p-4, px-2.5, -mt-1, m-[3px], space-y-2, gap-x-3
  if ((m = /^(p|m)([xytrblse]?)-(.+)$/.exec(c))) {
    const n = neg(size(m[3]), minus)
    if (n === undefined) return false
    for (const s of SIDES[m[2]]) v[`${m[1] === 'p' ? 'padding' : 'margin'}${s}`] = n
    return true
  }
  if ((m = /^space-(x|y)-(.+)$/.exec(c))) {
    const n = size(m[2])
    if (typeof n !== 'number') return m[2] === 'reverse'
    if (m[1] === 'x') f.spaceX = n
    else f.spaceY = n
    return true
  }
  if ((m = /^gap-(x-|y-)?(.+)$/.exec(c))) {
    const n = size(m[2])
    if (n === undefined) return false
    if (!m[1]) v.gap = n
    else if (m[1] === 'x-') v.columnGap = n
    else v.rowGap = n
    return true
  }
  // Sizes: w-10, h-full, min-w-0, max-w-sm, size-8, max-h-[70vh]
  if ((m = /^(min-|max-)?(w|h)-(.+)$/.exec(c))) {
    const key = `${m[1] === 'min-' ? 'min' : m[1] === 'max-' ? 'max' : ''}${m[2] === 'w' ? 'Width' : 'Height'}`
    const prop = key[0].toLowerCase() + key.slice(1)
    let n: number | string | undefined
    if (m[1] === 'max-' && m[2] === 'w' && CONTAINER[m[3]]) n = CONTAINER[m[3]]
    else if (m[3] === 'none') n = undefined
    else if (m[3] === 'prose') n = 65 * 9
    else n = size(m[3], m[2] as 'w' | 'h')
    if (n === undefined && !['fit', 'min', 'max', 'none'].includes(m[3])) return false
    v[prop] = n
    if (m[3] === 'fit' && m[2] === 'w') f.display = f.display ?? 'fit'
    return true
  }
  if ((m = /^size-(.+)$/.exec(c))) {
    const n = size(m[1])
    if (n === undefined) return false
    v.width = v.height = n
    return true
  }
  // Placement: inset-x-0, top-1/2, -left-2, z-10
  if ((m = /^(inset|inset-x|inset-y|top|right|bottom|left|start|end)-(.+)$/.exec(c))) {
    const n = neg(size(m[2]), minus)
    if (n === undefined) return false
    const keys = m[1] === 'inset' ? ['top', 'right', 'bottom', 'left'] : m[1] === 'inset-x' ? ['left', 'right'] : m[1] === 'inset-y' ? ['top', 'bottom'] : [m[1] === 'start' ? 'left' : m[1] === 'end' ? 'right' : m[1]]
    for (const k of keys) v[k] = n
    return true
  }
  if ((m = /^z-(.+)$/.exec(c))) {
    v.zIndex = m[1] === 'auto' ? undefined : neg(Number(m[1].replace(/[[\]]/g, '')), minus)
    return true
  }
  if ((m = /^order-(.+)$/.exec(c))) {
    v.order = m[1] === 'first' ? -9999 : m[1] === 'last' ? 9999 : Number(m[1])
    return true
  }
  // Flex and grid alignment
  if ((m = /^(items|justify|self|content|place-items|place-content|place-self|justify-items|justify-self)-(.+)$/.exec(c))) {
    const val = ALIGN[m[2]] ?? (m[2] === 'auto' ? 'auto' : undefined)
    if (!val) return false
    if (m[1] === 'items') v.alignItems = val
    else if (m[1] === 'justify') v.justifyContent = val
    else if (m[1] === 'self') v.alignSelf = val
    else if (m[1] === 'content') v.alignContent = val
    else if (m[1] === 'place-items') {
      v.alignItems = val
      v.__placeItems = val
    } else if (m[1] === 'place-content') {
      v.alignContent = val
      v.justifyContent = val
    } else if (m[1] === 'place-self') v.alignSelf = val
    else if (m[1] === 'justify-items') v.__justifyItems = val
    else if (m[1] === 'justify-self') v.__justifySelf = val
    return true
  }
  if ((m = /^basis-(.+)$/.exec(c))) {
    const n = size(m[1])
    if (n === undefined) return false
    v.flexBasis = n
    return true
  }
  if ((m = /^(grow|shrink)-(\d+|\[.+\])$/.exec(c))) {
    v[m[1] === 'grow' ? 'flexGrow' : 'flexShrink'] = Number(m[2].replace(/[[\]]/g, ''))
    return true
  }
  if ((m = /^flex-(\[.+\]|\d+)$/.exec(c))) {
    declare(a, 'flex', m[1].startsWith('[') ? arbitrary(m[1]) : `${m[1]} 1 0%`)
    return true
  }
  if ((m = /^grid-cols-(.+)$/.exec(c))) {
    f.grid = { ...f.grid, cols: /^\d+$/.test(m[1]) ? Array(Number(m[1])).fill('1fr') : m[1] === 'none' ? [] : tracks(arbitrary(m[1])) }
    return true
  }
  if ((m = /^grid-rows-(.+)$/.exec(c))) {
    f.grid = { ...f.grid, rows: /^\d+$/.test(m[1]) ? Array(Number(m[1])).fill('1fr') : tracks(arbitrary(m[1])) }
    return true
  }
  if ((m = /^grid-flow-(row|col|column)/.exec(c))) {
    f.grid = { ...f.grid, flow: m[1] === 'row' ? 'row' : 'column' }
    return true
  }
  if ((m = /^col-span-(.+)$/.exec(c))) {
    f.span = m[1] === 'full' ? 99 : Number(m[1])
    return true
  }
  if (/^(row-span|col-start|col-end|row-start|row-end|auto-cols|auto-rows)-/.test(c)) return true
  if ((m = /^aspect-\[(.+)\]$/.exec(c))) {
    const [x, y] = m[1].split('/').map(Number)
    v.aspectRatio = y ? x / y : x
    return true
  }
  if ((m = /^line-clamp-(\d+)$/.exec(c))) {
    f.lines = Number(m[1])
    return true
  }

  // Borders: border-2, border-t, border-x-4, border-white/30, border-[#ffc233]
  if ((m = /^border(?:-([xytrblse]))?(?:-(\d+|\[\d+(?:\.\d+)?px\]))?$/.exec(c))) {
    const w = m[2] === undefined ? 1 : Number(m[2].replace(/[[\]px]/g, ''))
    for (const s of SIDES[m[1] ?? '']) v[`border${s}Width`] = w
    return true
  }
  if ((m = /^border(?:-([xytrblse]))?-(.+)$/.exec(c))) {
    const col = colorOf(m[2])
    if (!col) return false
    if (!m[1]) v.borderColor = col
    else for (const s of SIDES[m[1]]) v[`border${s}Color`] = col
    return true
  }
  if ((m = /^divide-(x|y)-(\d+)$/.exec(c))) {
    f[m[1] === 'x' ? 'divideX' : 'divideY'] = Number(m[2])
    return true
  }
  if ((m = /^divide-(.+)$/.exec(c))) {
    const col = colorOf(m[1])
    if (!col) return false
    f.divideColor = col
    return true
  }
  if ((m = /^rounded(?:-(t|b|l|r|tl|tr|bl|br|s|e))?(?:-(.+))?$/.exec(c))) {
    const r = m[2] === undefined ? RADIUS[''] : m[2] in RADIUS ? RADIUS[m[2]] : m[2].startsWith('[') ? length(arbitrary(m[2])) : undefined
    if (r === undefined) return false
    if (!m[1]) v.borderRadius = r
    else for (const k of CORNERS[m[1]]) v[`border${k}Radius`] = r
    return true
  }
  if ((m = /^ring-(\d+)$/.exec(c))) {
    f.ring = Number(m[1])
    return true
  }
  if ((m = /^ring-offset-/.exec(c))) return true
  if ((m = /^ring-(.+)$/.exec(c))) {
    const col = colorOf(m[1])
    if (!col) return false
    f.ringColor = col
    return true
  }
  if ((m = /^outline-(.+)$/.exec(c))) return true

  // Backgrounds: bg-white/90, bg-[#ffc233], bg-gradient-to-b, from-black/60, via-…, to-transparent
  if ((m = /^bg-(?:gradient|linear)-to-(t|b|l|r|tr|tl|br|bl)$/.exec(c))) {
    f.gradientDir = GRAD_DIR[m[1]]
    return true
  }
  if ((m = /^bg-linear-(\d+)$/.exec(c))) {
    f.gradientDir = `${m[1]}deg`
    return true
  }
  if ((m = /^(from|via|to)-(.+)$/.exec(c))) {
    if (/^\d+%$/.test(m[2])) return true
    const col = colorOf(m[2])
    if (!col) return false
    f[m[1] as 'from' | 'via' | 'to'] = col
    return true
  }
  if ((m = /^bg-(.+)$/.exec(c))) {
    if (m[1].startsWith('[') && /gradient\(|url\(/.test(m[1])) {
      declare(a, 'background', arbitrary(m[1]))
      return true
    }
    if (m[1].startsWith('[length:') || m[1].startsWith('[size:')) return true
    const col = colorOf(m[1])
    if (!col) return false
    v.backgroundColor = col
    return true
  }
  if ((m = /^opacity-(.+)$/.exec(c))) {
    v.opacity = m[1].startsWith('[') ? Number(arbitrary(m[1])) : Number(m[1]) / 100
    return true
  }
  if ((m = /^shadow-(.+)$/.exec(c))) {
    if (m[1] in SHADOW) f.shadow = SHADOW[m[1]]
    else if (m[1].startsWith('[')) f.shadow = arbitrary(m[1])
    else {
      const col = colorOf(m[1])
      if (!col) return false
      f.shadowColor = col
    }
    return true
  }
  if (/^(blur|backdrop-blur|drop-shadow|backdrop-brightness|brightness|saturate|contrast|grayscale|sepia|hue-rotate|mix-blend|duration|delay|ease|transition|origin|cursor|accent|caret|fill|stroke|decoration|underline-offset|scroll-m|scroll-p|snap|will-change|content|list|columns|break|tracking-\[|indent|align|font-\[|leading-\[)/.test(c)) {
    if ((m = /^delay-(\d+)$/.exec(c))) f.delay = Number(m[1])
    if ((m = /^origin-(.+)$/.exec(c))) v.transformOrigin = m[1].startsWith('[') ? arbitrary(m[1]) : m[1].replace('-', ' ')
    if ((m = /^tracking-\[(.+)\]$/.exec(c))) declare(a, 'letterSpacing', m[1])
    if ((m = /^leading-\[(.+)\]$/.exec(c))) declare(a, 'lineHeight', m[1])
    if ((m = /^font-\[(.+)\]$/.exec(c))) declare(a, /^\d+$/.test(m[1]) ? 'fontWeight' : 'fontFamily', arbitrary(`[${m[1]}]`))
    if ((m = /^mix-blend-(.+)$/.exec(c))) v.mixBlendMode = m[1]
    if ((m = /^(brightness|saturate|contrast|grayscale)-(\d+)$/.exec(c))) v.filter = `${m[1]}(${Number(m[2]) / 100})`
    return true
  }

  // Transforms: translate-x-1/2, -translate-y-full, rotate-6, scale-95, scale-x-[-1]
  if ((m = /^translate-(x|y)-(.+)$/.exec(c))) {
    const n = neg(size(m[2]), minus)
    if (n === undefined) return false
    a.tf[m[1] === 'x' ? 'tx' : 'ty'] = n
    return true
  }
  if ((m = /^rotate-(.+)$/.exec(c))) {
    const deg = m[1].startsWith('[') ? parseFloat(arbitrary(m[1])) : Number(m[1])
    a.tf.rotate = minus ? -deg : deg
    return true
  }
  if ((m = /^scale-(x-|y-)?(.+)$/.exec(c))) {
    const n = (m[2].startsWith('[') ? Number(arbitrary(m[2])) : Number(m[2]) / 100) * (minus ? -1 : 1)
    if (Number.isNaN(n)) return false
    if (!m[1]) a.tf.scale = n
    else a.tf[m[1] === 'x-' ? 'sx' : 'sy'] = n
    return true
  }
  if ((m = /^skew-(x|y)-(.+)$/.exec(c))) {
    a.tf[m[1] === 'x' ? 'skewX' : 'skewY'] = (minus ? -1 : 1) * Number(m[2].replace(/[[\]deg]/g, ''))
    return true
  }

  // Text: text-sm, text-[13px], text-white/80, text-[var(--color-ink)], font-extrabold, leading-tight, tracking-wide
  if ((m = /^text-(.+)$/.exec(c))) {
    const sz = /^(.+?)(?:\/(.+))?$/.exec(m[1])!
    if (TEXT[sz[1]]) {
      t.fontSize = TEXT[sz[1]][0]
      // Tailwind gives it as a ratio (calc(1.25 / 0.875)): what's inside, in another size, keeps the ratio.
      t.lineHeight = sz[2] ? lead(sz[2]) : { ratio: TEXT[sz[1]][1] / TEXT[sz[1]][0] }
      return true
    }
    if (m[1].startsWith('[') && !m[1].includes('#') && !m[1].includes('var(') && !m[1].includes('rgb')) {
      const n = length(arbitrary(m[1].replace(/\/.*$/, '')))
      if (typeof n === 'number') {
        t.fontSize = n
        // Its own size, with the line height it inherits as a ratio (CSS: line-height 1.5 from the page).
        return true
      }
    }
    const col = colorOf(m[1])
    if (!col) return false
    t.color = col
    return true
  }
  if ((m = /^font-(.+)$/.exec(c))) {
    if (WEIGHT[m[1]]) {
      t.fontWeight = WEIGHT[m[1]]
      return true
    }
    return false
  }
  if ((m = /^leading-(.+)$/.exec(c))) {
    t.lineHeight = lead(m[1])
    return true
  }
  if ((m = /^tracking-(.+)$/.exec(c))) {
    if (!(m[1] in TRACKING)) return false
    t.letterSpacing = { em: (minus ? -1 : 1) * TRACKING[m[1]] }
    return true
  }
  return false
}

/** A line height: leading-tight (a ratio), leading-5 (20 px), leading-[1.1]. */
function lead(v: string) {
  if (v in LEADING) return { ratio: LEADING[v] }
  if (/^\d+(\.\d+)?$/.test(v)) return { px: Number(v) * 4 }
  const s = arbitrary(`[${v.replace(/^\[|\]$/g, '')}]`)
  if (/^[\d.]+$/.test(s)) return { ratio: Number(s) }
  const n = length(s)
  return typeof n === 'number' ? { px: n } : { ratio: 1.5 }
}

/** The game's own classes (index.css, motion.css): styled where they're drawn (components.ts). */
export const OWN = new Set(['btn', 'btn-emerald', 'btn-white', 'btn-soft', 'icon-btn', 'tile', 'input', 'label', 'segmented', 'card', 'hud', 'sheet', 'tnum', 'street', 'paint', 'slab', 'chalk-hand', 'ci-stripe', 'sign-btn', 'alt', 'turq', 'taped', 'cap', 'ardoise', 'worn', 'phone-screen', 'field', 'tiki-pan', 'tiki-disc', 'tiki-marquee', 'tiki-progress', 'tiki-heart', 'tiki-pop', 'sim-body', 'sim-eyes'])

/** A className, read (and kept). */
export function tw(className: string | undefined): Parsed {
  const key = className ?? ''
  let p = cache.get(key)
  if (p) return p
  const base = acc()
  const strong = acc()
  const own: string[] = []
  let active: Acc | undefined
  let disabled: Acc | undefined
  let placeholder: string | undefined
  let group = false
  for (const raw of key.split(/\s+/)) {
    if (!raw) continue
    // Variants: sm:, max-sm:, short:, active:, hover: (none, on a phone)…
    const parts = splitVariants(raw)
    let token = parts.pop()!
    let into: 'base' | 'active' | 'disabled' | 'placeholder' | null = 'base'
    for (const v of parts) {
      const on = variantOn(v)
      if (on === false) into = null
      else if (on !== true && into) into = on
    }
    if (!into) continue
    let important = false
    if (token.startsWith('!')) {
      important = true
      token = token.slice(1)
    } else if (token.endsWith('!')) {
      important = true
      token = token.slice(0, -1)
    }
    if (token === 'group') group = true
    if (into === 'placeholder') {
      const col = colorOf(token.replace(/^text-/, ''))
      if (col) placeholder = col
      continue
    }
    // (.street .rounded-xl: square corners on the wall; the utility still applies elsewhere.)
    if (token === 'rounded-xl' && into === 'base') own.push(token)
    if (OWN.has(token) || token.startsWith('motion-')) {
      if (into === 'base') own.push(token)
      continue
    }
    const target = into === 'active' ? (active ??= acc()) : into === 'disabled' ? (disabled ??= acc()) : important ? strong : base
    utility(target, token)
  }
  p = { base, own, active, disabled, placeholder, group, strong } as Parsed & { strong: Acc }
  cache.set(key, p)
  return p
}

/** sm:max-w-md, [&>*]:w-full, max-sm:[&>*]:h-10: the variants, then the utility. */
function splitVariants(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '[' || ch === '(') depth++
    if (ch === ']' || ch === ')') depth--
    if (ch === ':' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  // A child selector variant ([&>*]:…): not drawn here.
  if (out.slice(0, -1).some((v) => v.startsWith('['))) return ['__off', out[out.length - 1]]
  return out
}

/** The !important utilities of a className (they beat the game's own classes). */
export const strongOf = (p: Parsed) => (p as Parsed & { strong: Acc }).strong

export { merge }
