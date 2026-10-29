import { music } from './music'

// The baby's voice, made in the browser like the music (nothing recorded): a
// voice (a sawtooth at a baby's pitch, with its wobble) through the mouth's
// formants. The cry: « ouin-ouin », rising and falling, between breaths; the
// whimper when something's wrong; the giggle; the little push (the caca);
// the « bleh ». Through the music's master: « couper le son » cuts it too.

type Voice = { f0: [number, number, number]; f1: [number, number]; f2: number; dur: number; vol: number; wobble?: number }

function out() {
  const o = music.out()
  return o && o.ctx.state === 'running' ? o : null
}

/** One sound of the voice: its pitch from start to peak to end, the mouth opening (F1) and the vowel (F2). */
function voice(at: number, v: Voice) {
  const o = out()
  if (!o) return
  const { ctx: c, master } = o
  const t = c.currentTime + at
  const src = c.createOscillator()
  src.type = 'sawtooth'
  const [a, peak, b] = v.f0
  src.frequency.setValueAtTime(a, t)
  src.frequency.linearRampToValueAtTime(peak, t + v.dur * 0.35)
  src.frequency.linearRampToValueAtTime(b, t + v.dur)
  // The wobble of a small voice.
  const lfo = c.createOscillator()
  lfo.frequency.value = 5.5 + Math.random() * 2
  const depth = c.createGain()
  depth.gain.value = v.wobble ?? 14
  lfo.connect(depth).connect(src.frequency)
  // The mouth: two formants in parallel, the first opening as the sound starts (the « w » of « ouin »).
  const mix = c.createGain()
  const f1 = c.createBiquadFilter()
  f1.type = 'bandpass'
  f1.Q.value = 4
  f1.frequency.setValueAtTime(v.f1[0], t)
  f1.frequency.linearRampToValueAtTime(v.f1[1], t + Math.min(0.12, v.dur / 3))
  const f2 = c.createBiquadFilter()
  f2.type = 'bandpass'
  f2.Q.value = 6
  f2.frequency.value = v.f2
  const g2 = c.createGain()
  g2.gain.value = 0.6
  src.connect(f1).connect(mix)
  src.connect(f2).connect(g2).connect(mix)
  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(v.vol, t + 0.06)
  env.gain.setValueAtTime(v.vol, t + v.dur * 0.75)
  env.gain.exponentialRampToValueAtTime(0.0001, t + v.dur)
  mix.connect(env).connect(master)
  for (const n of [src, lfo]) {
    n.start(t)
    n.stop(t + v.dur + 0.05)
  }
}

const r = (a: number, b: number) => a + Math.random() * (b - a)

export const baby = {
  /** A fit of crying: two or three « ouiiin », each with its breath. */
  cry() {
    let at = 0
    for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) {
      const dur = r(0.9, 1.5)
      const base = r(420, 470)
      voice(at, { f0: [base, base + r(70, 120), base - r(40, 80)], f1: [450, r(950, 1100)], f2: r(1500, 1800), dur, vol: 0.13, wobble: 22 })
      at += dur + r(0.25, 0.45)
    }
  },
  /** Something's wrong (hungry, tired, dirty): a little whimper. */
  whimper() {
    for (let i = 0; i < 2; i++) {
      const base = r(360, 400)
      voice(i * 0.55, { f0: [base, base + 30, base - 50], f1: [400, 700], f2: 1300, dur: 0.42, vol: 0.05, wobble: 10 })
    }
  },
  /** A giggle: little « hi-hi-hi », higher and higher, then down. */
  giggle() {
    const n = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const f = 620 + i * 25 - (i === n - 1 ? 80 : 0)
      voice(i * 0.13, { f0: [f, f + 40, f - 30], f1: [350, 450], f2: 2400, dur: 0.08, vol: 0.07, wobble: 4 })
    }
  },
  /** The little push (the caca): a strained « nnngh », then a happy sound. */
  push() {
    voice(0, { f0: [210, 240, 200], f1: [400, 520], f2: 1000, dur: 0.9, vol: 0.05, wobble: 30 })
    voice(1.1, { f0: [520, 600, 480], f1: [500, 750], f2: 1900, dur: 0.3, vol: 0.06, wobble: 6 })
  },
  /** « Bleh » (vomiting): a short low sound, falling. */
  bleh() {
    voice(0, { f0: [300, 280, 180], f1: [500, 750], f2: 1200, dur: 0.45, vol: 0.07, wobble: 20 })
  },
  /** Babbling (« ba-ba, da-da »): content, playing. */
  babble() {
    const syll = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < syll; i++) {
      const f = r(460, 560)
      voice(i * 0.2, { f0: [f, f + 30, f - 20], f1: [300, 800], f2: r(1200, 2000), dur: 0.14, vol: 0.05, wobble: 5 })
    }
  },
}
