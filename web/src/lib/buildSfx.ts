import { music } from '../audio/music'

// The house editor's sounds (components/BuildMode), made in the browser like lib/sfx.ts: a block set
// down (earth thuds, tin rings, glass clinks), a piece of furniture put on the floor, a block knocked
// down, an undo, a spot that won't do. One noise buffer made once and played from a random point, so a
// sound costs a few nodes and no allocation. Silent with the music off.

let ctx: AudioContext | null = null
let out: GainNode | null = null
let grain: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (music.muted) return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      out = ctx.createGain()
      out.gain.value = 0.6
      out.connect(ctx.destination)
      grain = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = grain.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function noise(c: AudioContext, at: number, len: number, freq: number, q: number, gain: number, sweepTo?: number) {
  const src = c.createBufferSource()
  src.buffer = grain
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(freq, at)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + len)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + len)
  src
    .connect(f)
    .connect(g)
    .connect(out ?? c.destination)
  src.start(at, Math.random() * 0.5)
  src.stop(at + len + 0.02)
}

function tone(c: AudioContext, at: number, freq: number, len: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + len)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(out ?? c.destination)
  o.start(at)
  o.stop(at + len + 0.02)
}

export const buildSfx = {
  /** A block set down: by what it's made of (a little higher each time, as a wall goes up). */
  block(material: string, step = 0) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    const up = 1 + (step % 6) * 0.04
    if (material === 'tole') {
      tone(c, t, 420 * up, 0.18, 0.07, 'triangle', 380)
      noise(c, t, 0.12, 3200, 3, 0.12)
    } else if (material === 'verre') {
      tone(c, t, 2100 * up, 0.12, 0.06)
      tone(c, t + 0.02, 3150 * up, 0.1, 0.03)
    } else if (material === 'bois') {
      tone(c, t, 230 * up, 0.08, 0.16, 'triangle', 160)
      noise(c, t, 0.05, 1500, 2, 0.18)
    } else {
      // Earth, cement, brick, tiles, marble: a dull thud and a little grit.
      tone(c, t, 150 * up, 0.12, 0.22, 'sine', 70)
      noise(c, t, 0.08, material === 'banco' ? 700 : 1100, 1.2, 0.22)
    }
  },
  /** A piece of furniture put on the floor: two knocks of its feet. */
  piece() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(c, t, 190, 0.09, 0.16, 'triangle', 120)
    noise(c, t, 0.05, 900, 1.5, 0.16)
    tone(c, t + 0.07, 240, 0.07, 0.1, 'triangle', 150)
    tone(c, t + 0.1, 880, 0.12, 0.04)
  },
  /** A block knocked down, a piece taken away: rubble falling. */
  crumble() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.22, 600, 0.8, 0.26, 260)
    for (let k = 0; k < 3; k++) noise(c, t + 0.04 + k * 0.05, 0.04, 1600 + k * 300, 3, 0.08)
  },
  /** Undo: a quick swish back. */
  undo() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.16, 2600, 1.2, 0.12, 700)
    tone(c, t, 660, 0.12, 0.05, 'sine', 440)
  },
  /** A spot that won't do: a short low buzz. */
  nope() {
    const c = audio()
    if (!c) return
    tone(c, c.currentTime, 150, 0.14, 0.07, 'square', 120)
  },
  /** Picked up, turned: a light tick. */
  tick() {
    const c = audio()
    if (!c) return
    tone(c, c.currentTime, 1250, 0.05, 0.05)
  },
}
