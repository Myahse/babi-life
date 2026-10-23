import { query, queryAll } from './node'

// A look at the app in a browser (react-native-web): the browser has its own window, document
// and storage, so nothing is stood in for, except where the game hands the browser one of our
// elements (a DomNode: its view, .native, is the page's element here) or looks one up by id.

const g = globalThis as any
const real = (t: any) => (t && typeof t === 'object' && 'native' in t && t.native ? t.native : t)

function unwrapping(Base: any) {
  if (!Base) return Base
  return class {
    private o: any
    private back = new Map<any, any>()
    constructor(cb: (entries: any[], o: any) => void, opts?: any) {
      // (An entry's fields are getters of its own kind: copied into a plain one.)
      const KEYS = ['isIntersecting', 'intersectionRatio', 'boundingClientRect', 'intersectionRect', 'rootBounds', 'time', 'contentRect', 'borderBoxSize', 'contentBoxSize']
      this.o = new Base((entries: any[]) => cb(entries.map((e) => Object.fromEntries([...KEYS.filter((k) => k in e).map((k) => [k, e[k]]), ['target', this.back.get(e.target) ?? e.target]])), this), opts)
    }
    observe(t: any, opts?: any) {
      const el = real(t)
      if (!(el instanceof Element)) return
      this.back.set(el, t)
      this.o.observe(el, opts)
    }
    unobserve(t: any) {
      const el = real(t)
      if (el instanceof Element) this.o.unobserve(el)
    }
    disconnect() {
      this.o.disconnect()
    }
    takeRecords() {
      return this.o.takeRecords?.() ?? []
    }
  }
}
g.IntersectionObserver = unwrapping(g.IntersectionObserver)
g.ResizeObserver = unwrapping(g.ResizeObserver)

const doc = document as any
const byId = doc.getElementById.bind(doc)
const one = doc.querySelector.bind(doc)
const all = doc.querySelectorAll.bind(doc)
doc.getElementById = (id: string) => query(`#${id}`) ?? byId(id)
doc.querySelector = (s: string) => query(s) ?? one(s)
doc.querySelectorAll = (s: string) => {
  const ours = queryAll(s)
  return ours.length ? ours : all(s)
}

export const localStore = window.localStorage
export const loadStorage = async () => {}
