// Filming the real game, smoothly, on a machine too slow to play it: the
// page's clock is stopped (Date, performance.now, requestAnimationFrame,
// setTimeout, setInterval) and moved on by hand, one frame at a time, with a
// screenshot after each (gameplay.mjs). Network, workers and CSS animations
// keep real time.

/** The page's stopped clock: window.__advance(ms) moves it on, running the timers due and the frames asked for. */
export const STOPPED_CLOCK = `(() => {
  const RealDate = Date
  const t0 = RealDate.now()
  let now = 0
  const raf = new Map()
  let rafId = 0
  const timers = new Map()
  let timerId = 1e7
  window.requestAnimationFrame = (cb) => (raf.set(++rafId, cb), rafId)
  window.cancelAnimationFrame = (id) => raf.delete(id)
  performance.now = () => now
  function FakeDate(...a) {
    if (!(this instanceof FakeDate)) return new RealDate(t0 + now).toString()
    return a.length ? new RealDate(...a) : new RealDate(t0 + now)
  }
  FakeDate.prototype = RealDate.prototype
  FakeDate.now = () => t0 + now
  FakeDate.parse = RealDate.parse
  FakeDate.UTC = RealDate.UTC
  window.Date = FakeDate
  window.setTimeout = (fn, ms = 0, ...args) => (timers.set(++timerId, { at: now + Math.max(0, +ms || 0), fn, args }), timerId)
  window.setInterval = (fn, ms = 0, ...args) => (timers.set(++timerId, { at: now + Math.max(1, +ms || 0), fn, args, every: Math.max(1, +ms || 0) }), timerId)
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id)
  window.__clockNow = () => now
  window.__advance = (ms) => {
    const end = now + ms
    for (let guard = 0; guard < 10000; guard++) {
      let next = null
      for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t]
      if (!next) break
      const [id, t] = next
      now = Math.max(now, t.at)
      if (t.every) t.at += t.every
      else timers.delete(id)
      try {
        typeof t.fn === 'function' ? t.fn(...t.args) : (0, eval)(t.fn)
      } catch (e) {
        console.error(e)
      }
    }
    now = end
    const cbs = [...raf.values()]
    raf.clear()
    for (const cb of cbs) {
      try {
        cb(now)
      } catch (e) {
        console.error(e)
      }
    }
  }
})()`
