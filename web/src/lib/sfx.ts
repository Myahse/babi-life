import { music } from '../audio/music'

// The games' sounds, made in the browser (nothing recorded, nothing to
// license): a chip put down, the ball running round the wheel and dropping
// into its pocket, a card dealt, the coins of a win, the chime of a big one,
// the low note of a loss; the street fight's blows, guard, swish, fall and
// bell. Silent when the game's music button is off.

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (music.muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** A burst of noise through a band-pass: clicks, rattles, swishes. */
function noise(c: AudioContext, at: number, length: number, freq: number, q: number, gain: number, sweepTo?: number) {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * length)), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(freq, at)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + length)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + length)
  src.connect(f).connect(g).connect(c.destination)
  src.start(at)
  src.stop(at + length + 0.02)
}

/** A note: its wave, its pitch, how long, how loud. */
function tone(c: AudioContext, at: number, freq: number, length: number, gain: number, type: OscillatorType = 'triangle', slideTo?: number) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + length)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + length)
  o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + length + 0.02)
}

export const sfx = {
  /** A chip put down on the cloth. */
  chip() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.05, 3200, 4, 0.5)
    tone(c, t, 1900, 0.06, 0.08, 'sine')
  },
  /** The ball running round the wheel for `seconds`, slowing, then its bounces into the pocket. */
  spin(seconds: number) {
    const c = audio()
    if (!c) return
    const t0 = c.currentTime
    // The ball's ticks on the frets: quick at first, further apart as it slows.
    let t = 0
    let gap = 0.045
    while (t < seconds * 0.78) {
      noise(c, t0 + t, 0.03, 2600 + Math.random() * 600, 6, 0.18)
      t += gap
      gap *= 1.028
    }
    // Into the pockets: four bounces, then still.
    for (const [dt, g] of [
      [0.0, 0.5],
      [0.22, 0.35],
      [0.38, 0.22],
      [0.48, 0.12],
    ] as [number, number][])
      noise(c, t0 + seconds * 0.82 + dt, 0.05, 1800, 3, g)
  },
  /** A card slid off the shoe. */
  card() {
    const c = audio()
    if (!c) return
    noise(c, c.currentTime, 0.14, 1200, 0.8, 0.35, 5200)
  },
  /** The coins of a win: a ching for each, up to six. */
  coins(n = 3) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    for (let i = 0; i < Math.min(6, Math.max(1, n)); i++) {
      tone(c, t + i * 0.07, 2093 + (i % 2) * 300, 0.25, 0.12, 'sine')
      tone(c, t + i * 0.07, 3136, 0.12, 0.05, 'square')
    }
  },
  /** A win: the arpeggio up; a big one goes on with the coins. */
  win(big = false) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    const notes = big ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047]
    notes.forEach((f, i) => tone(c, t + i * 0.09, f, 0.32, 0.16))
    if (big) setTimeout(() => sfx.coins(6), notes.length * 90)
  },
  /** A loss: a short note going down. */
  lose() {
    const c = audio()
    if (!c) return
    tone(c, c.currentTime, 330, 0.35, 0.12, 'triangle', 196)
  },
  /** A blow landing: a thud in the body, a slap on top; heavier, lower and longer. */
  punch(heavy = false) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(c, t, heavy ? 120 : 170, heavy ? 0.22 : 0.12, heavy ? 0.5 : 0.35, 'sine', 45)
    noise(c, t, heavy ? 0.12 : 0.07, heavy ? 900 : 1500, 1.2, heavy ? 0.7 : 0.5)
  },
  /** A blow on the guard: a dull knock. */
  guard() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.06, 600, 2, 0.45)
    tone(c, t, 260, 0.06, 0.15, 'square', 180)
  },
  /** A fist or a foot through the air. */
  swish(heavy = false) {
    const c = audio()
    if (!c) return
    noise(c, c.currentTime, heavy ? 0.2 : 0.12, heavy ? 500 : 900, 1.5, 0.22, heavy ? 2400 : 3400)
  },
  /** A body down on the road. */
  fall() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(c, t, 90, 0.3, 0.45, 'sine', 40)
    noise(c, t, 0.18, 400, 1, 0.5)
  },
  /** The bell: a round begins, a fight ends. */
  bell(times = 1) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    for (let k = 0; k < times; k++) {
      tone(c, t + k * 0.32, 1568, 0.9, 0.12, 'sine')
      tone(c, t + k * 0.32, 2350, 0.6, 0.05, 'sine')
    }
  },
  /** The Super going off: a rising roar. */
  rise() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(c, t, 180, 0.5, 0.18, 'sawtooth', 720)
    noise(c, t, 0.5, 400, 0.8, 0.25, 3000)
  },
  /** A little pop (a mosquito bursting). */
  pop() {
    const c = audio()
    if (!c) return
    tone(c, c.currentTime, 900 + Math.random() * 300, 0.07, 0.08, 'square', 300)
  },
  /** The referee's whistle: a pea trilling (three long ones at the end of a match). */
  whistle(long = false) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    const blow = (at: number, length: number) => {
      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.setValueAtTime(2900, at)
      // The pea rattling in the whistle: the pitch wobbling fast.
      const lfo = c.createOscillator()
      lfo.frequency.value = 32
      const depth = c.createGain()
      depth.gain.value = 180
      lfo.connect(depth).connect(o.frequency)
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 2900
      f.Q.value = 3
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.09, at + 0.02)
      g.gain.setValueAtTime(0.09, at + length - 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, at + length)
      o.connect(f).connect(g).connect(c.destination)
      o.start(at)
      lfo.start(at)
      o.stop(at + length + 0.02)
      lfo.stop(at + length + 0.02)
    }
    if (long) [0, 0.55, 1.1].forEach((d, i) => blow(t + d, i === 2 ? 0.9 : 0.4))
    else blow(t, 0.32)
  },
  /** A ball struck: a thump, harder for a shot. */
  kick(power = 0.5) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(c, t, 150 + power * 60, 0.12, 0.12 + power * 0.12, 'sine', 55)
    noise(c, t, 0.04, 1400, 1.5, 0.12 + power * 0.1)
  },
  /** The crowd going up for a goal: a roar that swells and fades. */
  roar() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 2.4), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 900
    f.Q.value = 0.6
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    src.connect(f).connect(g).connect(c.destination)
    src.start(t)
    src.stop(t + 2.45)
  },
  /** A tick (the plane's multiplier climbing, the price moving). */
  tick(pitch = 1) {
    const c = audio()
    if (!c) return
    tone(c, c.currentTime, 880 * pitch, 0.05, 0.05, 'sine')
  },
}
