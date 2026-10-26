import { music } from '../audio/music'

// The casino's sounds, made in the browser (nothing recorded, nothing to
// license): a chip put down, the ball running round the wheel and dropping
// into its pocket, a card dealt, the coins of a win, the chime of a big one,
// the low note of a loss. Silent when the game's music button is off.

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
  /** A tick (the plane's multiplier climbing, the price moving). */
  tick(pitch = 1) {
    const c = audio()
    if (!c) return
    tone(c, c.currentTime, 880 * pitch, 0.05, 0.05, 'sine')
  },
}
