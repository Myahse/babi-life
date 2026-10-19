// The virtual clock of marketing/gameplay.mjs (loaded before the page).
// A virtual clock for the page: frames, timers and dates advance only when told (window.__advance(ms)).
(() => {
  const realPerf = performance.now.bind(performance)
  const RealDate = Date
  const perf0 = realPerf()
  const date0 = RealDate.now()
  let vt = 0
  performance.now = () => perf0 + vt
  class VDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(date0 + vt) }
    static now() { return date0 + vt }
  }
  window.Date = VDate
  let seq = 0
  const timers = new Map()
  window.setTimeout = (fn, ms = 0, ...args) => { const id = ++seq; timers.set(id, { at: vt + Math.max(0, ms), fn, args }); return id }
  window.setInterval = (fn, ms = 0, ...args) => { const id = ++seq; timers.set(id, { at: vt + Math.max(1, ms), fn, args, every: Math.max(1, ms) }); return id }
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id)
  let raf = new Map()
  window.requestAnimationFrame = (cb) => { const id = ++seq; raf.set(id, cb); return id }
  window.cancelAnimationFrame = (id) => raf.delete(id)
  window.__advance = (ms) => {
    const end = vt + ms
    for (;;) {
      let next = null
      for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t]
      if (!next) break
      const [id, t] = next
      vt = Math.max(vt, t.at)
      if (t.every) t.at += t.every
      else timers.delete(id)
      try { typeof t.fn === 'function' ? t.fn(...t.args) : eval(t.fn) } catch (e) { console.error(e) }
    }
    vt = end
    const cbs = raf
    raf = new Map()
    for (const cb of cbs.values()) try { cb(perf0 + vt) } catch (e) { console.error(e) }
  }
  window.__vt = () => vt
})()
