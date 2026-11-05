import { music } from '../audio/music'

// The table games' sounds (dames, 8 américain, awalé, Ludo, godé), made in the browser like lib/sfx.ts:
// a seed dropping into its hole, a wooden piece put down or taking, a card snapped down, slid or turned,
// the deck shuffled, a die rattling then rolling to a stop, a pawn's hop. One noise buffer made once and
// played from a random point, so a sound costs a few nodes and no allocation. Silent with the music off.

let ctx: AudioContext | null = null
let out: GainNode | null = null
let grain: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (music.muted) return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      out = ctx.createGain()
      out.gain.value = 0.7
      out.connect(ctx.destination)
      // One second of white noise, every noisy sound cut from it.
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

/** A burst of noise through a filter: its length, centre, sharpness, loudness, and the attack's shape. */
function noise(c: AudioContext, at: number, len: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
  const src = c.createBufferSource()
  src.buffer = grain
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, at)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + len)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  src.connect(f).connect(g).connect(out!)
  src.start(at, Math.random() * 0.8)
  src.stop(at + len + 0.02)
}

/** A short knock of a body: a sine dropping in pitch (the wood, the table). */
function body(c: AudioContext, at: number, freq: number, len: number, gain: number, to = freq * 0.6) {
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq, at)
  o.frequency.exponentialRampToValueAtTime(to, at + len)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(out!)
  o.start(at)
  o.stop(at + len + 0.02)
}

const jitter = (v: number, k = 0.08) => v * (1 - k + Math.random() * 2 * k)

export const tableSfx = {
  /** A seed of the awalé dropping into a hole of the wooden board: a click, a little hollow knock; `fill` (0..1) how full the hole is (fuller, duller). */
  seed(fill = 0) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.035, jitter(3400 - fill * 1400), 5, 0.35)
    body(c, t, jitter(620 - fill * 180), 0.07, 0.22)
  },
  /** The seeds of a hole scooped into the hand: a soft rattle. */
  scoop(n = 4) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    for (let i = 0; i < Math.min(8, n); i++) noise(c, t + i * 0.018 + Math.random() * 0.01, 0.03, jitter(2600), 4, 0.12)
  },
  /** Seeds taken, poured into one's store. */
  pour(n = 3) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    for (let i = 0; i < Math.min(14, n * 2); i++) noise(c, t + i * 0.028 + Math.random() * 0.015, 0.04, jitter(2200), 3, 0.16)
    body(c, t + 0.05, 300, 0.12, 0.15)
  },
  /** A wooden piece put down on the board (heavier: a dame). */
  clack(heavy = false) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.05, jitter(heavy ? 1500 : 2200), 3, 0.5)
    body(c, t, jitter(heavy ? 300 : 420), 0.09, 0.4)
  },
  /** A piece lifted off the board. */
  lift() {
    const c = audio()
    if (!c) return
    noise(c, c.currentTime, 0.04, 3800, 2, 0.12)
  },
  /** A piece jumped and taken: the hop's knock, then the taken one swept off. */
  take() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.05, 1900, 3, 0.55)
    body(c, t, 380, 0.08, 0.4)
    noise(c, t + 0.12, 0.16, 1200, 0.7, 0.18, 'bandpass', 4200)
  },
  /** A card snapped down on the pile. */
  snap() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.05, jitter(2600), 1.2, 0.45)
    body(c, t, 180, 0.05, 0.18)
  },
  /** A card sliding across the cloth. */
  slide() {
    const c = audio()
    if (!c) return
    noise(c, c.currentTime, 0.16, 900, 0.8, 0.16, 'bandpass', 3800)
  },
  /** A card turned over. */
  flip() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.06, 4200, 1.5, 0.18)
    noise(c, t + 0.05, 0.04, 2400, 2, 0.2)
  },
  /** The deck riffled before the deal. */
  shuffle() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    for (let i = 0; i < 22; i++) noise(c, t + i * 0.022, 0.025, jitter(3000, 0.2), 3, 0.14 + (i / 22) * 0.1)
    noise(c, t + 0.52, 0.06, 1800, 2, 0.3)
  },
  /** The die shaken in the hand (or the godet), for `ms`. */
  rattle(ms = 500) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    for (let k = 0; k < ms / 45; k++) noise(c, t + k * 0.045 + Math.random() * 0.02, 0.03, jitter(2400, 0.3), 5, 0.2)
  },
  /** One bounce of the die on the table (`power` 0..1, the first the loudest). */
  bounce(power = 1) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.04, jitter(1800), 4, 0.15 + 0.4 * power)
    body(c, t, jitter(240), 0.06, 0.1 + 0.3 * power)
  },
  /** A pawn's hop onto a square (`pitch` rises along the way). */
  hop(pitch = 1) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(c, t, 0.03, 2800 * pitch, 4, 0.22)
    body(c, t, 520 * pitch, 0.05, 0.16)
  },
  /** A pawn sent back to its house: a slide away, down. */
  knocked() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    body(c, t, 520, 0.35, 0.25, 160)
    noise(c, t, 0.25, 3000, 1, 0.12, 'bandpass', 600)
  },
  /** One's turn comes: a soft two-note wooden call. */
  turn() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    body(c, t, 880, 0.09, 0.12, 860)
    body(c, t + 0.09, 1175, 0.12, 0.12, 1150)
  },
}
