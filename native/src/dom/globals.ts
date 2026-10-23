import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert, AppState, Dimensions, Linking, PixelRatio, Share, Vibration } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Crypto from 'expo-crypto'
import { newCanvas, SkImageElement } from '@web/lib/canvas'
import { history, parse } from './history'
import { query, queryAll } from './node'
import { WEB_ORIGIN } from './origin'

// What the game's code (web/src) takes from the browser, on the phone: the
// window and its events, the document (its canvases are Skia's), the storage
// (kept in memory, saved to the phone), the address and its history, the
// screen's media queries, the clipboard, sharing, vibrating; and quiet stand-ins
// for what a phone app has no use for (service workers, IndexedDB, the
// recorder of videos, WebAudio until the sounds are ported).

const g = globalThis as any

/* ---------- Events on window and document ---------- */

type Listener = (e: any) => void
function eventTarget() {
  const map = new Map<string, Set<Listener>>()
  return {
    addEventListener(type: string, fn: Listener) {
      let s = map.get(type)
      if (!s) map.set(type, (s = new Set()))
      s.add(fn)
    },
    removeEventListener(type: string, fn: Listener) {
      map.get(type)?.delete(fn)
    },
    dispatchEvent(e: any) {
      for (const fn of map.get(e.type) ?? []) fn(e)
      return true
    },
  }
}
const winEvents = eventTarget()
const docEvents = eventTarget()
const fire = (target: ReturnType<typeof eventTarget>, type: string, extra: Record<string, any> = {}) => target.dispatchEvent({ type, preventDefault() {}, stopPropagation() {}, ...extra })

Dimensions.addEventListener('change', () => fire(winEvents, 'resize'))
let appState = AppState.currentState
AppState.addEventListener('change', (s) => {
  const was = appState
  appState = s
  fire(docEvents, 'visibilitychange')
  if (s === 'active' && was !== 'active') fire(winEvents, 'focus')
  if (s !== 'active' && was === 'active') {
    fire(winEvents, 'blur')
    fire(winEvents, 'pagehide')
  }
})

/* ---------- Storage: in memory, saved to the phone ---------- */

const PREFIX = 'web:'
function storage(persist: boolean) {
  const data = new Map<string, string>()
  const api = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem(k: string, v: string) {
      data.set(k, String(v))
      if (persist) void AsyncStorage.setItem(PREFIX + k, String(v))
    },
    removeItem(k: string) {
      data.delete(k)
      if (persist) void AsyncStorage.removeItem(PREFIX + k)
    },
    clear() {
      const keys = [...data.keys()]
      data.clear()
      if (persist) void AsyncStorage.multiRemove(keys.map((k) => PREFIX + k))
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
    /** What the phone kept from the last time (before the app draws). */
    async load() {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX))
      for (const [k, v] of await AsyncStorage.multiGet(keys)) if (v !== null) data.set(k.slice(PREFIX.length), v)
    },
  }
  return api
}
export const localStore = storage(true)
g.localStorage = localStore
g.sessionStorage = storage(false)

/** Before the first draw: the storage read back. */
export const loadStorage = () => localStore.load()

/* ---------- The address ---------- */

const loc = {
  get pathname() {
    return history.location.pathname
  },
  get search() {
    return history.location.search
  },
  get hash() {
    return history.location.hash
  },
  get href() {
    return `${WEB_ORIGIN}${history.location.pathname}${history.location.search}${history.location.hash}`
  },
  set href(v: string) {
    loc.assign(v)
  },
  origin: WEB_ORIGIN,
  host: WEB_ORIGIN.replace(/^https?:\/\//, ''),
  hostname: WEB_ORIGIN.replace(/^https?:\/\//, ''),
  protocol: 'https:',
  port: '',
  assign(v: string) {
    if (/^https?:/.test(v) && !v.startsWith(WEB_ORIGIN)) void Linking.openURL(v)
    else history.push(v)
  },
  replace(v: string) {
    history.replace(v)
  },
  /** Reloading the page: the app draws itself again from the start (App.tsx listens). */
  reload() {
    fire(winEvents, '__reload')
  },
  toString() {
    return loc.href
  },
}
g.location = loc
g.history = {
  get state() {
    return { ...(history.location.state ?? {}), idx: history.index }
  },
  get length() {
    return history.index + 1
  },
  pushState: (state: any, _t: string, url?: string) => history.push(url ?? parse(''), state),
  replaceState: (state: any, _t: string, url?: string) => history.replace(url ?? { pathname: history.location.pathname, search: history.location.search }, state),
  back: () => history.go(-1),
  forward: () => history.go(1),
  go: (n: number) => history.go(n),
}

/* ---------- The window ---------- */

/** A media query against the phone's screen: widths, heights, orientation, standalone (an app is). */
function mediaMatches(q: string) {
  const { width, height } = Dimensions.get('window')
  return q.split(',').some((part) =>
    [...part.matchAll(/\(([^)]+)\)/g)].every(([, cond]) => {
      const [k, v] = cond.split(':').map((s) => s.trim())
      const px = parseFloat(v)
      switch (k) {
        case 'min-width':
          return width >= px
        case 'max-width':
          return width <= px
        case 'min-height':
          return height >= px
        case 'max-height':
          return height <= px
        case 'orientation':
          return v === (width > height ? 'landscape' : 'portrait')
        case 'display-mode':
          return v === 'standalone' || v === 'fullscreen'
        case 'prefers-reduced-motion':
          return v === 'no-preference'
        case 'pointer':
          return v === 'coarse'
        case 'hover':
          return v === 'none'
        case 'prefers-color-scheme':
          return v === 'light'
        default:
          return false
      }
    }),
  )
}
g.matchMedia = (q: string) => {
  const listeners = new Set<Listener>()
  const mq = {
    media: q,
    get matches() {
      return mediaMatches(q)
    },
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
    addListener: (fn: Listener) => listeners.add(fn),
    removeListener: (fn: Listener) => listeners.delete(fn),
    onchange: null,
  }
  Dimensions.addEventListener('change', () => listeners.forEach((fn) => fn({ matches: mq.matches, media: q })))
  return mq
}

Object.defineProperties(g, {
  innerWidth: { get: () => Dimensions.get('window').width, configurable: true },
  innerHeight: { get: () => Dimensions.get('window').height, configurable: true },
  outerWidth: { get: () => Dimensions.get('window').width, configurable: true },
  outerHeight: { get: () => Dimensions.get('window').height, configurable: true },
  devicePixelRatio: { get: () => PixelRatio.get(), configurable: true },
})
g.window = g
g.self = g
g.top = g
g.parent = g
g.addEventListener = winEvents.addEventListener
g.removeEventListener = winEvents.removeEventListener
g.dispatchEvent = winEvents.dispatchEvent
g.scrollTo = () => {}
g.scrollBy = () => {}
g.scrollX = 0
g.scrollY = 0
g.pageXOffset = 0
g.pageYOffset = 0
g.open = (url: string) => {
  void Linking.openURL(url.startsWith('/') ? `${WEB_ORIGIN}${url}` : url)
  return null
}
g.alert = (m: string) => Alert.alert('', String(m))
// (No synchronous yes/no on a phone: the game asks with its own sheets; a confirm() says yes.)
g.confirm = () => true
g.prompt = () => null
g.getComputedStyle = () => ({ getPropertyValue: () => '' })
g.visualViewport = { get width() { return Dimensions.get('window').width }, get height() { return Dimensions.get('window').height }, offsetTop: 0, addEventListener() {}, removeEventListener() {} }
g.screen = { get width() { return Dimensions.get('screen').width }, get height() { return Dimensions.get('screen').height }, orientation: { type: 'portrait-primary', lock: async () => {}, unlock() {}, addEventListener() {}, removeEventListener() {} } }
g.CSS = { supports: () => false, escape: (s: string) => s }

/* ---------- The document ---------- */

const styleBag = () => new Proxy({} as Record<string, any>, { get: (t, k) => (k === 'setProperty' ? (n: string, v: string) => (t[n] = v) : k === 'removeProperty' ? (n: string) => delete t[n] : k === 'getPropertyValue' ? (n: string) => t[n] ?? '' : t[k as string]) })
const classes = () => {
  const s = new Set<string>()
  return { add: (...c: string[]) => c.forEach((x) => s.add(x)), remove: (...c: string[]) => c.forEach((x) => s.delete(x)), toggle: (c: string, on?: boolean) => ((on ?? !s.has(c)) ? s.add(c) : s.delete(c), s.has(c)), contains: (c: string) => s.has(c) }
}
/** An element made by hand (a <div> for measuring, an <a> to download, a <meta>): nothing drawn. */
function looseElement(tag: string): any {
  return {
    tagName: tag.toUpperCase(),
    style: styleBag(),
    classList: classes(),
    dataset: {},
    children: [],
    childNodes: [],
    setAttribute() {},
    getAttribute: () => null,
    removeAttribute() {},
    appendChild: (c: any) => c,
    removeChild: (c: any) => c,
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    click() {},
    focus() {},
    blur() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
    getContext: () => null,
    play: async () => {},
    pause() {},
    load() {},
    canPlayType: () => '',
  }
}
const body = looseElement('body')
const head = looseElement('head')
const root = looseElement('html')
g.document = {
  createElement: (tag: string) => (tag === 'canvas' ? newCanvas(300, 150) : tag === 'img' ? new SkImageElement() : looseElement(tag)),
  createElementNS: (_ns: string, tag: string) => (tag === 'canvas' ? newCanvas(300, 150) : tag === 'img' ? new SkImageElement() : looseElement(tag)),
  createTextNode: (t: string) => ({ textContent: t }),
  getElementById: (id: string) => query(`#${id}`),
  querySelector: (s: string) => query(s),
  querySelectorAll: (s: string) => queryAll(s),
  getElementsByTagName: () => [],
  body,
  head,
  documentElement: root,
  get visibilityState() {
    return appState === 'active' ? 'visible' : 'hidden'
  },
  get hidden() {
    return appState !== 'active'
  },
  hasFocus: () => appState === 'active',
  title: 'Babi Life',
  referrer: '',
  cookie: '',
  readyState: 'complete',
  fonts: { ready: Promise.resolve(), load: async () => [], check: () => true, add() {} },
  activeElement: null,
  fullscreenElement: null,
  exitFullscreen: async () => {},
  addEventListener: docEvents.addEventListener,
  removeEventListener: docEvents.removeEventListener,
  dispatchEvent: docEvents.dispatchEvent,
}
g.Image = SkImageElement
g.HTMLElement = class {}
g.HTMLCanvasElement = class {}
g.HTMLImageElement = SkImageElement
g.HTMLInputElement = class {}
g.HTMLVideoElement = class {}
g.Element = class {}
g.Node = class {}

/* ---------- The phone: clipboard, sharing, vibrating, where one is ---------- */

g.navigator = {
  ...(g.navigator ?? {}),
  userAgent: 'BabiLifeApp (Android; React Native)',
  platform: 'Android',
  language: 'fr-FR',
  languages: ['fr-FR', 'fr'],
  onLine: true,
  hardwareConcurrency: 4,
  maxTouchPoints: 5,
  standalone: true,
  clipboard: { writeText: (t: string) => Clipboard.setStringAsync(t).then(() => undefined), readText: () => Clipboard.getStringAsync() },
  share: async (d: { title?: string; text?: string; url?: string }) => {
    await Share.share({ title: d.title, message: [d.text, d.url].filter(Boolean).join('\n') })
  },
  canShare: () => true,
  vibrate: (p: number | number[]) => (Vibration.vibrate(p as any), true),
  geolocation: {
    getCurrentPosition: (ok: (p: any) => void, fail?: (e: any) => void) => {
      import('expo-location')
        .then(async (L) => {
          const { status } = await L.requestForegroundPermissionsAsync()
          if (status !== 'granted') throw Object.assign(new Error('denied'), { code: 1 })
          const p = await L.getCurrentPositionAsync({})
          ok({ coords: p.coords, timestamp: p.timestamp })
        })
        .catch((e) => fail?.({ code: e?.code ?? 2, message: String(e?.message ?? e) }))
    },
    watchPosition: () => 0,
    clearWatch() {},
  },
  permissions: { query: async () => ({ state: 'prompt', addEventListener() {}, removeEventListener() {} }) },
  wakeLock: { request: async () => ({ release: async () => {} }) },
}

g.crypto = { ...(g.crypto ?? {}), randomUUID: () => Crypto.randomUUID(), getRandomValues: <T extends ArrayBufferView>(a: T) => Crypto.getRandomValues(a as any) as T }

/* ---------- Quiet stand-ins ---------- */

g.IntersectionObserver = class {
  constructor(private cb: (entries: any[], o: any) => void) {}
  // Everything is in view: what waits to be seen (a list's next page, a lazy picture) comes at once.
  observe(target: any) {
    setTimeout(() => this.cb([{ target, isIntersecting: true, intersectionRatio: 1, boundingClientRect: target?.getBoundingClientRect?.() }], this), 0)
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
g.ResizeObserver = class {
  constructor(private cb: (entries: any[], o: any) => void) {}
  observe(target: any) {
    setTimeout(() => {
      const r = target?.getBoundingClientRect?.() ?? { width: 0, height: 0 }
      this.cb([{ target, contentRect: r, borderBoxSize: [{ inlineSize: r.width, blockSize: r.height }] }], this)
    }, 0)
  }
  unobserve() {}
  disconnect() {}
}
g.MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

/** WebAudio, until the game's sounds are played natively: every node takes calls and does nothing. */
function silentNode(): any {
  return new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? undefined : k === 'value' || k === 'gain' || k === 'frequency' || k === 'detune' || k === 'Q' || k === 'playbackRate' || k === 'pan' ? silentNode() : k === 'currentTime' ? Date.now() / 1000 : k === 'state' ? 'running' : k === 'sampleRate' ? 44100 : k === 'resume' || k === 'suspend' || k === 'close' || k === 'decodeAudioData' ? () => Promise.resolve(silentNode()) : silentNode()),
    apply: () => silentNode(),
    construct: () => silentNode(),
    set: () => true,
  })
}
g.AudioContext = function AudioContext() {
  return silentNode()
}
g.webkitAudioContext = g.AudioContext
g.Audio = function Audio() {
  return { play: () => Promise.resolve(), pause() {}, load() {}, addEventListener() {}, removeEventListener() {}, currentTime: 0, volume: 1, muted: false, loop: false, src: '' }
}
g.Notification = { permission: 'default', requestPermission: async () => 'default' }
g.URL.createObjectURL = () => ''
g.URL.revokeObjectURL = () => {}
g.structuredClone ??= (v: any) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
