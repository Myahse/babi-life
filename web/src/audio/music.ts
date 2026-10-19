// Music made in the browser, so nothing is copyrighted: the game plays its
// own tunes, written note by note here, in the style of what you'd hear in
// Abidjan. Coupé-décalé in the club and at the maquis (four-on-the-floor kick,
// claps, busy hi-hats, a bouncing bass and a bright guitar-like arpeggio), and
// the fanfare that walks in front of a wedding cortège (bass drum, snare,
// tuba oom-pah, two trumpets in thirds). Each place gets its own variation.

export type Track = 'club' | 'maquis' | 'fanfare'

type Style = { bpm: number; steps: number; swing: number; build: (r: () => number) => Song }
type Song = (ctx: AudioContext, out: AudioNode, step: number, t: number, dur: number) => void

const KEY = 'babi-music'
let ctx: AudioContext | null = null
let master: GainNode | null = null
let current: { track: Track; seed: string } | null = null
let timer: number | null = null
let bus: GainNode | null = null
/** How near the music is (1: where it plays; less: a party heard from down the street). */
let level = 1
let near: GainNode | null = null
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
})()

/** A small seeded random, so a place always plays its own variation. */
function seeded(s: string) {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/* ---------- Instruments ---------- */

function noise(c: AudioContext) {
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}
let noiseBuf: AudioBuffer | null = null

function env(c: AudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(out)
  return g
}

function kick(c: AudioContext, out: AudioNode, t: number, vol = 0.9) {
  const o = c.createOscillator()
  o.frequency.setValueAtTime(130, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  o.connect(env(c, out, t, vol, 0.004, 0.28))
  o.start(t)
  o.stop(t + 0.32)
}

function hiss(c: AudioContext, out: AudioNode, t: number, { vol, decay, type, freq, q = 1 }: { vol: number; decay: number; type: BiquadFilterType; freq: number; q?: number }) {
  const s = c.createBufferSource()
  s.buffer = noiseBuf ??= noise(c)
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  s.connect(f).connect(env(c, out, t, vol, 0.002, decay))
  s.start(t, Math.random() * 0.5)
  s.stop(t + decay + 0.05)
}
const clap = (c: AudioContext, out: AudioNode, t: number, vol = 0.5) => {
  hiss(c, out, t, { vol, decay: 0.12, type: 'bandpass', freq: 1600, q: 0.8 })
  hiss(c, out, t + 0.012, { vol: vol * 0.7, decay: 0.1, type: 'bandpass', freq: 1200, q: 0.8 })
}
const snare = (c: AudioContext, out: AudioNode, t: number, vol = 0.45) => {
  hiss(c, out, t, { vol, decay: 0.16, type: 'highpass', freq: 1800 })
  tone(c, out, t, 190, 0.08, vol * 0.5, 'triangle')
}
const hat = (c: AudioContext, out: AudioNode, t: number, open = false, vol = 0.18) => hiss(c, out, t, { vol, decay: open ? 0.22 : 0.04, type: 'highpass', freq: 7500 })
const shaker = (c: AudioContext, out: AudioNode, t: number, vol = 0.07) => hiss(c, out, t, { vol, decay: 0.05, type: 'bandpass', freq: 5000, q: 2 })
const crash = (c: AudioContext, out: AudioNode, t: number) => hiss(c, out, t, { vol: 0.22, decay: 1.2, type: 'highpass', freq: 5000 })

function tone(c: AudioContext, out: AudioNode, t: number, freq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.connect(env(c, out, t, vol, 0.005, dur))
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** A conga-like tom, pitch falling. */
function conga(c: AudioContext, out: AudioNode, t: number, freq: number, vol = 0.35) {
  const o = c.createOscillator()
  o.frequency.setValueAtTime(freq * 1.4, t)
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.03)
  o.connect(env(c, out, t, vol, 0.003, 0.18))
  o.start(t)
  o.stop(t + 0.25)
}

function bass(c: AudioContext, out: AudioNode, t: number, midi: number, dur: number, vol = 0.32) {
  const o = c.createOscillator()
  o.type = 'square'
  o.frequency.value = hz(midi)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(220, t + dur)
  o.connect(f).connect(env(c, out, t, vol, 0.008, dur))
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** The bright plucked guitar of the seben, in the high register. */
function pluck(c: AudioContext, out: AudioNode, t: number, midi: number, vol = 0.12) {
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = hz(midi)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(4200, t)
  f.frequency.exponentialRampToValueAtTime(700, t + 0.18)
  o.connect(f).connect(env(c, out, t, vol, 0.003, 0.22))
  o.start(t)
  o.stop(t + 0.3)
}

/** A synth chord stab on the offbeat. */
function stab(c: AudioContext, out: AudioNode, t: number, notes: number[], vol = 0.05) {
  for (const n of notes) {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(n)
    o.detune.value = (Math.random() - 0.5) * 14
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2200
    o.connect(f).connect(env(c, out, t, vol, 0.004, 0.12))
    o.start(t)
    o.stop(t + 0.2)
  }
}

/** Brass: two detuned saws, the filter opening as the note speaks, a little vibrato. */
function brass(c: AudioContext, out: AudioNode, t: number, midi: number, dur: number, vol = 0.09, bright = 2600) {
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 2
  f.frequency.setValueAtTime(300, t)
  f.frequency.linearRampToValueAtTime(bright, t + 0.05)
  f.frequency.linearRampToValueAtTime(bright * 0.6, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.04)
  g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.05, dur - 0.06))
  g.gain.linearRampToValueAtTime(0.0001, t + dur)
  f.connect(g).connect(out)
  const lfo = c.createOscillator()
  const depth = c.createGain()
  lfo.frequency.value = 5.5
  depth.gain.value = 6
  lfo.connect(depth)
  for (const d of [-7, 7]) {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(midi)
    o.detune.value = d
    depth.connect(o.detune)
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  lfo.start(t)
  lfo.stop(t + dur + 0.05)
}

/* ---------- Songs ---------- */

// Chord loops (roots as MIDI notes, with the chord's tones), bright and major
// like most dance music in Abidjan.
const LOOPS: { root: number; tones: number[] }[][] = [
  [{ root: 45, tones: [0, 4, 7] }, { root: 50, tones: [0, 4, 7] }, { root: 52, tones: [0, 4, 7] }, { root: 50, tones: [0, 4, 7] }],
  [{ root: 48, tones: [0, 4, 7] }, { root: 45, tones: [0, 3, 7] }, { root: 53, tones: [0, 4, 7] }, { root: 55, tones: [0, 4, 7] }],
  [{ root: 43, tones: [0, 4, 7] }, { root: 48, tones: [0, 4, 7] }, { root: 50, tones: [0, 4, 7] }, { root: 48, tones: [0, 4, 7] }],
  [{ root: 47, tones: [0, 3, 7] }, { root: 43, tones: [0, 4, 7] }, { root: 50, tones: [0, 4, 7] }, { root: 45, tones: [0, 4, 7] }],
]

function coupeDecale(r: () => number, light: boolean): Song {
  const loop = LOOPS[Math.floor(r() * LOOPS.length)]
  // The bass and the guitar each have their riff, kept for the whole song.
  const bassSteps = [[0, 3, 6, 8, 11, 14], [0, 3, 7, 10, 12, 14], [0, 2, 6, 8, 10, 13]][Math.floor(r() * 3)]
  const bassNotes = bassSteps.map(() => [0, 0, 7, 12, 10][Math.floor(r() * 5)])
  const riff = [...Array(16)].map(() => (r() < 0.78 ? Math.floor(r() * 6) : -1))
  return (c, out, step, t, dur) => {
    const bar = Math.floor(step / 16)
    const s = step % 16
    const chord = loop[bar % loop.length]
    const breakdown = bar % 16 === 15 // a bar without kick before the drop
    if (s % 4 === 0 && !breakdown) kick(c, out, t, light ? 0.7 : 0.95)
    if (s === 4 || s === 12) clap(c, out, t, light ? 0.35 : 0.5)
    if (breakdown && s >= 8) snare(c, out, t, 0.12 + (s - 8) * 0.04) // the roll into the drop
    if (s % 2 === 0) hat(c, out, t, s % 4 === 2, light ? 0.1 : 0.16)
    shaker(c, out, t, light ? 0.05 : 0.07)
    if (light && (s === 3 || s === 6 || s === 10 || s === 11)) conga(c, out, t, s === 6 ? 180 : 240)
    const bi = bassSteps.indexOf(s)
    if (bi >= 0) bass(c, out, t, chord.root - 12 + bassNotes[bi], dur * 2.2, light ? 0.26 : 0.32)
    if (riff[s] >= 0 && bar % 8 >= 2) {
      const tones = chord.tones
      const n = riff[s]
      pluck(c, out, t, chord.root + 24 + tones[n % 3] + (n >= 3 ? 12 : 0), light ? 0.09 : 0.11)
    }
    if (!light && s % 4 === 2 && bar % 8 >= 4) stab(c, out, t, chord.tones.map((x) => chord.root + 12 + x))
  }
}

function fanfare(r: () => number): Song {
  // A march in a major key, phrases of four bars: the trumpets play a tune
  // made of a few motifs, the second trumpet a third below.
  const key = 58 + Math.floor(r() * 4) // B♭ to C♯
  const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14]
  const chords = [0, 5, 7, 0, 0, 5, 7, 0].map((x) => key - 24 + x)
  const motif = () => [...Array(8)].map(() => (r() < 0.8 ? Math.floor(r() * 7) : -1))
  const motifs = [motif(), motif(), motif()]
  const tune = [0, 1, 0, 2].map((i) => motifs[i])
  return (c, out, step, t, dur) => {
    const bar = Math.floor(step / 8)
    const s = step % 8
    const root = chords[bar % chords.length]
    // Drums: bass drum on the beats, the snare's march pattern and rolls.
    if (s === 0 || s === 4) kick(c, out, t, 0.7)
    if (s === 2 || s === 6 || (s === 7 && bar % 2 === 1)) snare(c, out, t, 0.32)
    if (bar % 4 === 3 && s >= 4) snare(c, out, t + dur / 2, 0.18)
    if (bar % 8 === 0 && s === 0) crash(c, out, t)
    // Tuba oom-pah, horns on the offbeats.
    if (s === 0) brass(c, out, t, root, dur * 1.6, 0.11, 900)
    if (s === 4) brass(c, out, t, root + 7, dur * 1.6, 0.1, 900)
    if (s === 2 || s === 6) for (const x of [12, 16, 19]) brass(c, out, t, root + x, dur * 0.8, 0.035, 1800)
    // The tune.
    const n = tune[Math.floor(bar / 2) % 4][(bar % 2) * 4 + Math.floor(s / 2)]
    if (s % 2 === 0 && n >= 0 && bar % 16 < 14) {
      const len = r() < 0.3 ? dur * 3.6 : dur * 1.8
      brass(c, out, t, key + scale[n], len, 0.075, 3200)
      brass(c, out, t, key + scale[Math.max(0, n - 2)], len, 0.05, 2600)
    }
  }
}

const STYLES: Record<Track, Style> = {
  club: { bpm: 128, steps: 4, swing: 0.04, build: (r) => coupeDecale(r, false) },
  maquis: { bpm: 118, steps: 4, swing: 0.08, build: (r) => coupeDecale(r, true) },
  fanfare: { bpm: 112, steps: 2, swing: 0, build: fanfare },
}

/* ---------- Playing ---------- */

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.5
  // A touch of compression keeps it even on phone speakers.
  const comp = ctx.createDynamicsCompressor()
  master.connect(comp).connect(ctx.destination)
  near = ctx.createGain()
  near.gain.value = level
  near.connect(master)
  return ctx
}

// Browsers only let sound start after a tap: start then.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = ensure()
    c?.resume()
    if (current && !timer) start(current.track, current.seed)
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

function stopNow() {
  if (timer) clearInterval(timer)
  timer = null
  if (bus && ctx) {
    const b = bus
    b.gain.setTargetAtTime(0, ctx.currentTime, 0.25)
    setTimeout(() => b.disconnect(), 1500)
  }
  bus = null
}

function start(track: Track, seed: string) {
  const c = ensure()
  if (!c || c.state !== 'running' || !master) return
  stopNow()
  const style = STYLES[track]
  const song = style.build(seeded(`${track}${seed}`))
  const out = c.createGain()
  out.gain.setValueAtTime(0, c.currentTime)
  out.gain.linearRampToValueAtTime(1, c.currentTime + 1.2)
  out.connect(near ?? master)
  bus = out
  const dur = 60 / style.bpm / style.steps
  let step = 0
  let next = c.currentTime + 0.1
  // Schedule a little ahead, so timers' jitter never shows.
  timer = window.setInterval(() => {
    // Back from a hidden tab: carry on from now rather than play the backlog.
    if (next < c.currentTime - 0.05) next = c.currentTime + 0.05
    while (next < c.currentTime + 0.15) {
      const swing = step % 2 === 1 ? style.swing * dur * 4 : 0
      song(c, out, step, next + swing, dur)
      next += dur
      step++
    }
  }, 25)
}

export const music = {
  /** Play this track (null: silence). The same call twice keeps it going. */
  play(track: Track | null, seed = '') {
    if (!track) {
      current = null
      stopNow()
      return
    }
    if (current && current.track === track && current.seed === seed && timer) return
    current = { track, seed }
    start(track, seed)
  },
  /** How loud, from 0 to 1: a party far down the street is heard softly, louder as one comes near. */
  setLevel(v: number) {
    level = Math.max(0, Math.min(1, v))
    if (near && ctx) near.gain.setTargetAtTime(level, ctx.currentTime, 0.4)
  },
  get muted() {
    return muted
  },
  setMuted(m: boolean) {
    muted = m
    try {
      localStorage.setItem(KEY, m ? 'off' : 'on')
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.1)
  },
}

/** Render some seconds of a track offline (to listen to it outside the game). */
export async function render(track: Track, seed: string, seconds: number): Promise<AudioBuffer> {
  const c = new OfflineAudioContext(2, 44100 * seconds, 44100)
  const out = c.createGain()
  out.gain.value = 0.5
  out.connect(c.createDynamicsCompressor()).connect(c.destination)
  const style = STYLES[track]
  const song = style.build(seeded(`${track}${seed}`))
  const dur = 60 / style.bpm / style.steps
  for (let step = 0, t = 0.05; t < seconds; step++, t += dur) song(c as unknown as AudioContext, out, step, t + (step % 2 === 1 ? style.swing * dur * 4 : 0), dur)
  return c.startRendering()
}
