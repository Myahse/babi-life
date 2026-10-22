import { Animated, Easing } from 'react-native'
import { length, splitTop, transformList, ms } from './style'

// The game's animations: its CSS ones (animate-pop, motion-rise, piece-out…, by name, with the
// keyframes of index.css and motion.css) and the ones it starts by hand (element.animate(), the
// card flights). Both are keyframes of a transform and an opacity, played on an Animated value.

export type Keyframe = { offset?: number; transform?: string; opacity?: number; translate?: string; scale?: string }
type Named = { frames: Keyframe[]; duration: number; easing?: string; infinite?: boolean; alternate?: boolean; both?: boolean }

const SPRING = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const f = (offset: number, transform?: string, opacity?: number): Keyframe => ({ offset, transform, opacity })

/** The keyframes of index.css and motion.css, by the name a class or an animation: gives. */
const NAMED: Record<string, Named> = {
  'pop-in': { frames: [f(0, 'scale(0.86) translateY(10px)', 0), f(1, 'scale(1) translateY(0px)', 1)], duration: 260, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)', both: true },
  'slide-up': { frames: [f(0, 'translateY(24px)', 0), f(1, 'translateY(0px)', 1)], duration: 320, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)', both: true },
  float: { frames: [f(0, 'translateY(0px)'), f(0.5, 'translateY(-6px)'), f(1, 'translateY(0px)')], duration: 3200, easing: 'ease-in-out', infinite: true },
  'sway-y': { frames: [f(0, 'rotateY(-35deg)'), f(0.5, 'rotateY(35deg)'), f(1, 'rotateY(-35deg)')], duration: 3600, easing: 'ease-in-out', infinite: true },
  spin: { frames: [f(0, 'rotate(0deg)'), f(1, 'rotate(360deg)')], duration: 1000, easing: 'linear', infinite: true },
  pulse: { frames: [f(0, undefined, 1), f(0.5, undefined, 0.5), f(1, undefined, 1)], duration: 2000, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', infinite: true },
  ping: { frames: [f(0, 'scale(1)', 1), f(0.75, 'scale(2)', 0), f(1, 'scale(2)', 0)], duration: 1000, easing: 'cubic-bezier(0, 0, 0.2, 1)', infinite: true },
  bounce: { frames: [f(0, 'translateY(-8px)'), f(0.5, 'translateY(0px)'), f(1, 'translateY(-8px)')], duration: 1000, easing: 'ease-in-out', infinite: true },
  'tuto-ring': { frames: [f(0, 'scale(1)', 1), f(0.5, 'scale(1.05)', 0.7), f(1, 'scale(1)', 1)], duration: 1400, easing: 'ease-in-out', infinite: true },
  'piece-out': { frames: [f(0, 'scale(1)', 1), f(1, 'scale(0.3)', 0)], duration: 300, both: true },
  'crown-in': { frames: [f(0, 'scale(0) rotate(-40deg)'), f(0.7, 'scale(1.5) rotate(8deg)'), f(1, 'scale(1) rotate(0deg)')], duration: 500, both: true },
  ripple: { frames: [f(0, 'translate(-50%, -50%) scale(0.4)', 0.7), f(1, 'translate(-50%, -50%) scale(1.6)', 0)], duration: 1400, infinite: true },
  breathe: { frames: [f(0, 'scaleY(1)'), f(0.5, 'scaleY(1.018)'), f(1, 'scaleY(1)')], duration: 3400, easing: 'ease-in-out', infinite: true },
  'motion-pop': { frames: [f(0, 'scale(0.4)', 0), f(1, 'scale(1)', 1)], duration: 450, easing: SPRING, both: true },
  'motion-boing': { frames: [f(0, 'scaleX(1) scaleY(1)'), f(0.3, 'scaleX(1.12) scaleY(0.9)'), f(0.6, 'scaleX(0.95) scaleY(1.06)'), f(1, 'scaleX(1) scaleY(1)')], duration: 500, easing: SPRING },
  'motion-land': { frames: [f(0, 'scaleX(1.2) scaleY(0.8)'), f(1, 'scaleX(1) scaleY(1)')], duration: 350, easing: SPRING },
  'motion-shake': { frames: [f(0, 'translateX(0px)'), f(0.2, 'translateX(-6px)'), f(0.4, 'translateX(6px)'), f(0.6, 'translateX(-6px)'), f(0.8, 'translateX(6px)'), f(1, 'translateX(0px)')], duration: 420, easing: 'ease-in-out' },
  'motion-breathe': { frames: [f(0, 'scale(1)'), f(0.5, 'scale(1.06)'), f(1, 'scale(1)')], duration: 2400, easing: 'ease-in-out', infinite: true },
  'motion-rise': { frames: [f(0, 'translateY(12px)', 0), f(1, 'translateY(0px)', 1)], duration: 420, easing: OUT, both: true },
  'motion-toast': { frames: [f(0, 'translateY(-18px) scale(0.92)', 0), f(1, 'translateY(0px) scale(1)', 1)], duration: 500, easing: SPRING, both: true },
  'motion-app': { frames: [f(0, 'translateX(18px)', 0), f(1, 'translateX(0px)', 1)], duration: 320, easing: OUT, both: true },
  'motion-low': { frames: [f(0, 'scale(1)'), f(0.5, 'scale(1.09)'), f(1, 'scale(1)')], duration: 1400, easing: 'ease-in-out', infinite: true },
  'motion-typing': { frames: [f(0, 'translateY(0px)', 0.45), f(0.3, 'translateY(-4px)', 1), f(0.6, 'translateY(0px)', 0.45), f(1, 'translateY(0px)', 0.45)], duration: 1100, easing: 'ease-in-out', infinite: true },
  'motion-flood': { frames: [f(0, undefined, 0.9), f(0.7, undefined, 0.55), f(1, undefined, 0)], duration: 600, easing: OUT, both: true },
  'motion-coin': { frames: [f(0, 'translateY(0px) rotate(0deg)'), f(0.35, 'translateY(-6px) rotate(-12deg)'), f(0.7, 'translateY(1px) rotate(4deg)'), f(1, 'translateY(0px) rotate(0deg)')], duration: 600, easing: SPRING },
  'motion-gram-in': { frames: [f(0, undefined, 0), f(1, undefined, 1)], duration: 400, easing: OUT, both: true },
  'motion-gram-heart': { frames: [f(0, 'scale(0) translateY(0px)', 0), f(0.15, 'scale(1.2) translateY(0px)', 1), f(0.3, 'scale(0.95) translateY(0px)', 1), f(0.45, 'scale(1) translateY(0px)', 1), f(0.75, 'scale(1) translateY(0px)', 1), f(1, 'scale(0.6) translateY(-30px)', 0)], duration: 900, easing: SPRING, both: true },
  'motion-gram-like': { frames: [f(0, 'scale(1)'), f(0.35, 'scale(1.35)'), f(0.7, 'scale(0.9)'), f(1, 'scale(1)')], duration: 450, easing: SPRING },
  'tiki-pan': { frames: [f(0, 'scale(1.08) translateX(-3%) translateY(1%)'), f(1, 'scale(1.22) translateX(3%) translateY(-2%)')], duration: 9000, easing: 'ease-in-out', infinite: true, alternate: true },
  'tiki-spin': { frames: [f(0, 'rotate(0deg)'), f(1, 'rotate(360deg)')], duration: 4000, easing: 'linear', infinite: true },
  'tiki-marquee': { frames: [f(0, 'translateX(0%)'), f(1, 'translateX(-50%)')], duration: 7000, easing: 'linear', infinite: true },
  'tiki-progress': { frames: [f(0, 'scaleX(0)'), f(1, 'scaleX(1)')], duration: 9000, easing: 'linear', infinite: true },
  'tiki-heart': { frames: [f(0, 'scale(0.3) rotate(-15deg) translateY(0px)', 0), f(0.2, 'scale(1.15) rotate(-8deg) translateY(0px)', 1), f(0.7, 'scale(1) rotate(-8deg) translateY(-10px)', 1), f(1, 'scale(1.4) rotate(-8deg) translateY(-60px)', 0)], duration: 900, easing: 'ease-out', both: true },
  'tiki-pop': { frames: [f(0, 'scale(1)'), f(0.5, 'scale(1.3)'), f(1, 'scale(1)')], duration: 350, easing: 'ease-out' },
}
/** The classes that play one (animate-pop is pop-in, motion-* by their own name). */
const BY_CLASS: Record<string, string> = { pop: 'pop-in', up: 'slide-up', float: 'float', 'spin-y': 'sway-y', spin: 'spin', pulse: 'pulse', ping: 'ping', bounce: 'bounce', 'tiki-disc': 'tiki-spin' }

export function easing(e?: string): (t: number) => number {
  switch (e?.trim()) {
    case undefined:
    case 'ease':
      return Easing.bezier(0.25, 0.1, 0.25, 1)
    case 'linear':
      return Easing.linear
    case 'ease-in':
      return Easing.bezier(0.42, 0, 1, 1)
    case 'ease-out':
      return Easing.bezier(0, 0, 0.58, 1)
    case 'ease-in-out':
      return Easing.bezier(0.42, 0, 0.58, 1)
  }
  const m = /cubic-bezier\(([^)]+)\)/.exec(e ?? '')
  if (m) {
    const [a, b, c, d] = m[1].split(',').map(Number)
    return Easing.bezier(a, b, c, d)
  }
  return Easing.bezier(0.25, 0.1, 0.25, 1)
}

export type Play = { frames: Keyframe[]; duration: number; delay: number; easing?: string; iterations: number; alternate?: boolean; both?: boolean; forwards?: boolean }

/** An animation: by a class (pop), a name of index.css, or an animation: shorthand (piece-out 300ms ease-in forwards). */
export function playOf(spec: string, delay = 0): Play | null {
  const words = splitTop(spec, ' ')
  const name = BY_CLASS[words[0]] ?? words.find((w) => NAMED[w]) ?? (NAMED[`motion-${words[0]}`] ? `motion-${words[0]}` : words[0])
  const n = NAMED[name] ?? NAMED[BY_CLASS[name] ?? '']
  if (!n) return null
  const times = words.filter((w) => /^[\d.]+m?s$/.test(w)).map(ms)
  const count = words.find((w) => /^\d+$/.test(w))
  return {
    frames: n.frames,
    duration: times[0] ?? n.duration,
    delay: times[1] ?? delay,
    easing: words.find((w) => /^(ease|linear|cubic-bezier)/.test(w)) ?? n.easing,
    iterations: words.includes('infinite') || (n.infinite && !count) ? Infinity : Number(count ?? 1),
    alternate: words.includes('alternate') || n.alternate,
    both: words.includes('both') || words.includes('backwards') || n.both,
    forwards: words.includes('forwards') || words.includes('both') || n.both,
  }
}

/** A keyframe's transform as named parts, in the order they're written. */
function parts(k: Keyframe): [string, number | string][] {
  const out: [string, number | string][] = []
  const list = [k.translate ? `translate(${k.translate.split(/\s+/).join(',')})` : '', k.scale ? `scale(${k.scale.split(/\s+/).join(',')})` : '', k.transform ?? ''].join(' ')
  for (const t of transformList(list)) for (const [key, val] of Object.entries(t)) out.push([key, val as number | string])
  return out
}

const IDENTITY: Record<string, number | string> = { translateX: 0, translateY: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: '0deg', rotateX: '0deg', rotateY: '0deg', skewX: '0deg', skewY: '0deg', perspective: 1000 }

/** The style an animation gives on a value going 0 → 1 (the keyframes between). */
export function styleOf(play: Play, t: Animated.Value): Record<string, any> {
  const frames = play.frames.map((k, i, all) => ({ ...k, offset: k.offset ?? (all.length === 1 ? 1 : i / (all.length - 1)) }))
  if (frames[0].offset > 0) frames.unshift({ offset: 0 })
  if (frames[frames.length - 1].offset < 1) frames.push({ offset: 1 })
  const order: string[] = []
  const per = frames.map((k) => {
    const map = new Map(parts(k))
    for (const key of map.keys()) if (!order.includes(key)) order.push(key)
    return map
  })
  const offsets = frames.map((k) => k.offset)
  // Two keyframes at the same offset: a hair apart, as interpolate wants them rising.
  for (let i = 1; i < offsets.length; i++) if (offsets[i] <= offsets[i - 1]) offsets[i] = offsets[i - 1] + 1e-4
  const range = (values: (number | string)[]) => {
    const numeric = values.every((v) => typeof v === 'number')
    return numeric ? t.interpolate({ inputRange: offsets, outputRange: values as number[], extrapolate: 'clamp' }) : t.interpolate({ inputRange: offsets, outputRange: values.map(String), extrapolate: 'clamp' })
  }
  const style: Record<string, any> = {}
  if (order.length)
    style.transform = order.map((key) => {
      const values = per.map((m) => m.get(key) ?? IDENTITY[key] ?? 0)
      // A percentage and a 0 between: both percentages, or interpolate can't go between.
      const pct = values.some((v) => typeof v === 'string' && v.endsWith('%'))
      return { [key]: range(pct ? values.map((v) => (typeof v === 'number' ? `${v}%` : v)) : values) }
    })
  if (frames.some((k) => k.opacity !== undefined)) style.opacity = range(frames.map((k) => k.opacity ?? 1))
  return style
}

/** Play it: the value runs 0 → 1 (looping, back and forth), its end calls done. */
export function run(play: Play, t: Animated.Value, done?: () => void) {
  const one = (to: number) => Animated.timing(t, { toValue: to, duration: play.duration, easing: easing(play.easing), useNativeDriver: false })
  let a: Animated.CompositeAnimation
  if (play.iterations === Infinity) a = Animated.loop(play.alternate ? Animated.sequence([one(1), one(0)]) : Animated.sequence([one(1), Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: false })]))
  else {
    const seq: Animated.CompositeAnimation[] = []
    for (let i = 0; i < play.iterations; i++) {
      seq.push(play.alternate && i % 2 ? one(0) : one(1))
      if (!play.alternate && i < play.iterations - 1) seq.push(Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: false }))
    }
    a = Animated.sequence(seq)
  }
  const go = play.delay ? Animated.sequence([Animated.delay(play.delay), a]) : a
  go.start(({ finished }) => {
    if (!finished) return
    // Without « forwards », what it ends on goes: the element as it is.
    if (!play.forwards && play.iterations !== Infinity) t.setValue(play.both ? 1 : 0)
    done?.()
  })
  return go
}

/** element.animate(keyframes, options) of the web, on an Animated value: an Animation-like object. */
export function webAnimation(frames: Keyframe[], options: number | { duration?: number; easing?: string; fill?: string; delay?: number; iterations?: number; direction?: string }, set: (style: Record<string, any> | null) => void) {
  const o = typeof options === 'number' ? { duration: options } : options
  const t = new Animated.Value(0)
  const play: Play = { frames, duration: o.duration ?? 0, delay: o.delay ?? 0, easing: o.easing, iterations: o.iterations ?? 1, alternate: o.direction === 'alternate', forwards: o.fill === 'forwards' || o.fill === 'both', both: o.fill === 'both' }
  set(styleOf(play, t))
  let resolve!: () => void
  const finished = new Promise<void>((r) => (resolve = r))
  const anim = {
    onfinish: null as null | (() => void),
    oncancel: null as null | (() => void),
    finished,
    playState: 'running',
    cancel() {
      handle.stop()
      anim.playState = 'idle'
      set(null)
      anim.oncancel?.()
    },
    finish() {
      handle.stop()
      t.setValue(1)
      end()
    },
    pause() {
      handle.stop()
    },
    play() {},
    reverse() {},
  }
  const end = () => {
    anim.playState = 'finished'
    if (!play.forwards) set(null)
    resolve()
    anim.onfinish?.()
  }
  const handle = run({ ...play, forwards: true }, t, end)
  return anim
}

export { length }
