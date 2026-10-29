// Music made in the browser, so nothing is copyrighted: the game plays its
// own tunes, written note by note here, in the style of what you'd hear in
// Abidjan. Coupé-décalé in the club and at the maquis (four-on-the-floor kick,
// claps, busy hi-hats, a bouncing bass and a bright guitar-like arpeggio), the
// fanfare that walks in front of a wedding cortège (bass drum, snare, tuba
// oom-pah, two trumpets in thirds), the show of a cultural centre or a village
// (djembés, the dunun and its bell, a balafon, a singer and the choir that
// answers him, the audience's applause and you-yous), the crowd of a match at
// the stadium, the stadium's concert (the stage's coupé-décalé over the
// crowd's roar, its cheers and shouts), the hush of a museum. Each place gets
// its own variation.

export type Track = 'club' | 'maquis' | 'fanfare' | 'spectacle' | 'stade' | 'concert' | 'expo'

type Style = { bpm: number; steps: number; swing: number; build: (r: () => number) => Song }
type Song = (ctx: AudioContext, out: AudioNode, step: number, t: number, dur: number) => void

const KEY = 'babi-music'
/** How loud the game's sound is: gentle, in the background (was 0.5). */
const VOLUME = 0.3
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

/** A sung vowel: a buzz through the vowel's formants (the mouth), a little vibrato, a scoop up to the note. */
const VOWELS = { a: [800, 1150, 2900], o: [450, 800, 2830], e: [400, 2000, 2550], i: [300, 2300, 3000], u: [325, 700, 2530] } as const
type Vowel = keyof typeof VOWELS
function voice(c: AudioContext, out: AudioNode, t: number, midi: number, dur: number, vol: number, vowel: Vowel = 'a', trill = 0) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.06)
  g.gain.setValueAtTime(vol, t + Math.max(0.07, dur - 0.1))
  g.gain.linearRampToValueAtTime(0.0001, t + dur)
  g.connect(out)
  const src = c.createOscillator()
  src.type = 'sawtooth'
  src.frequency.setValueAtTime(hz(midi - 1), t)
  src.frequency.linearRampToValueAtTime(hz(midi), t + 0.08)
  VOWELS[vowel].forEach((f, i) => {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = 9
    const k = c.createGain()
    k.gain.value = [3, 1.6, 0.8][i]
    bp.connect(k).connect(g)
    src.connect(bp)
  })
  // The vibrato; a you-you's trill is the same, quicker and wider.
  const lfo = c.createOscillator()
  const depth = c.createGain()
  lfo.frequency.value = trill ? 7.5 : 5.2
  depth.gain.value = trill ? trill : 14
  lfo.connect(depth).connect(src.detune)
  src.start(t)
  lfo.start(t)
  src.stop(t + dur + 0.05)
  lfo.stop(t + dur + 0.05)
}

/** The djembé: its bass (the palm in the middle), its tone (the fingers at the edge), its slap (cracking). */
const djembe = (c: AudioContext, out: AudioNode, t: number, hit: 'B' | 'T' | 'S', vol = 1) => {
  if (hit === 'B') conga(c, out, t, 78, 0.5 * vol)
  if (hit === 'T') conga(c, out, t, 215, 0.3 * vol)
  if (hit === 'S') {
    hiss(c, out, t, { vol: 0.32 * vol, decay: 0.07, type: 'bandpass', freq: 2600, q: 1.2 })
    conga(c, out, t, 330, 0.12 * vol)
  }
}
/** The dunun's iron bell. */
const bell = (c: AudioContext, out: AudioNode, t: number, vol = 0.05) => {
  tone(c, out, t, 1240, 0.09, vol, 'triangle')
  tone(c, out, t, 3310, 0.05, vol * 0.4, 'sine')
}
/** A balafon's wooden key under the mallet: the note, its bright partial, the knock. */
function balafon(c: AudioContext, out: AudioNode, t: number, midi: number, vol = 0.16) {
  tone(c, out, t, hz(midi), 0.28, vol, 'sine')
  tone(c, out, t, hz(midi) * 3.9, 0.06, vol * 0.35, 'sine')
  hiss(c, out, t, { vol: vol * 0.25, decay: 0.02, type: 'bandpass', freq: 1800, q: 2 })
}
/** The audience: a round of applause (claps scattered over `len` seconds). */
function applause(c: AudioContext, out: AudioNode, t: number, len: number, vol = 0.12) {
  for (let i = 0; i < len * 28; i++) {
    const at = t + Math.random() * len
    hiss(c, out, at, { vol: vol * (0.4 + Math.random() * 0.6) * Math.min(1, (t + len - at) / 0.8), decay: 0.06, type: 'bandpass', freq: 1100 + Math.random() * 1400, q: 1.1 })
  }
}
/** A crowd murmuring, a while: noise shaped like voices, far off. */
function murmur(c: AudioContext, out: AudioNode, t: number, len: number, vol = 0.05, freq = 520) {
  const s = c.createBufferSource()
  s.buffer = noiseBuf ??= noise(c)
  s.loop = true
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = 0.9
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.3)
  g.gain.setValueAtTime(vol, t + len - 0.3)
  g.gain.linearRampToValueAtTime(0.0001, t + len)
  s.connect(f).connect(g).connect(out)
  s.start(t, Math.random() * 0.5)
  s.stop(t + len + 0.05)
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

/**
 * The show (a cultural centre's stage, the village of Anoumabo, the masks):
 * the djembés and the dunun, the shekere; the balafon's tune; a singer calls,
 * the choir answers, then all sing; and at the end of each round, the
 * audience claps, the women's you-yous, a shout.
 */
function spectacle(r: () => number): Song {
  const key = 57 + Math.floor(r() * 5) // A to C♯: the singer's note
  const penta = [0, 3, 5, 7, 10, 12, 15]
  const lead = [0, 1, 2].map(() => [...Array(8)].map(() => Math.floor(r() * 5)))
  const riff = [...Array(16)].map(() => (r() < 0.6 ? Math.floor(r() * 7) : -1))
  const vowels: Vowel[] = ['e', 'o', 'a', 'e', 'o', 'i', 'a', 'o']
  const ONE = 'B..TT.S.B..TT.SS'
  const TWO = '..ST..ST..ST..ST'
  return (c, out, step, t, dur) => {
    const bar = Math.floor(step / 16)
    const s = step % 16
    const round = bar % 16
    // The last bar of the round: the drums stop, the audience claps and cheers.
    if (round === 15) {
      if (s === 0) {
        applause(c, out, t, dur * 16 * 1.4, 0.13)
        voice(c, out, t + dur * 2, key + 27, dur * 7, 0.035, 'i', 160)
        voice(c, out, t + dur * 5, key + 24, dur * 6, 0.03, 'i', 190)
        voice(c, out, t + dur * 1, key + 4, dur * 1.5, 0.05, 'e')
      }
      return
    }
    // The djembés, the dunun and its bell, the shekere.
    const intro = round < 2
    const h1 = ONE[s]
    if (h1 !== '.') djembe(c, out, t, h1 as 'B' | 'T' | 'S', intro ? 1.1 : 0.9)
    const h2 = TWO[s]
    if (!intro && h2 !== '.') djembe(c, out, t, h2 as 'B' | 'T' | 'S', 0.55)
    if (!intro && (s === 0 || s === 6 || s === 8 || s === 11)) kick(c, out, t, 0.45)
    if (!intro && s % 2 === 0) bell(c, out, t, s % 4 === 0 ? 0.06 : 0.04)
    if (!intro) shaker(c, out, t, s % 4 === 0 ? 0.09 : 0.05)
    // The balafon's tune, after the drums' call.
    if (round >= 2 && riff[s] >= 0 && (round < 4 || s % 2 === 0)) balafon(c, out, t, key + 12 + penta[riff[s]], round < 4 ? 0.17 : 0.11)
    // The song: the singer calls (two bars), the choir answers (two bars), then all of them.
    const phrase = Math.floor((round - 4) / 2)
    if (round >= 4 && s % 2 === 0) {
      const n = lead[phrase % 3][s / 2]
      const note = key + penta[n]
      const len = dur * (s % 4 === 0 ? 3.6 : 1.8)
      const v = vowels[(s / 2 + phrase) % vowels.length]
      if (phrase % 2 === 0 || round >= 12) voice(c, out, t, note, len, 0.07, v)
      if (phrase % 2 === 1 || round >= 12)
        for (const [x, vv] of [
          [0, 0.045],
          [-5, 0.035],
          [7, 0.03],
        ] as [number, number][])
          voice(c, out, t + Math.random() * 0.02, note + x, len, vv, v)
    }
    // Now and then someone in the audience shouts their joy.
    if (round === 8 && s === 0) voice(c, out, t, key + 9, dur * 2, 0.04, 'e')
  }
}

/**
 * The stadium on match day: the crowd's roar all along, the supporters' big
 * drum and their song (« O-lé »), the trumpets; the roar rising now and then
 * (a chance, a goal).
 */
function stade(r: () => number): Song {
  const key = 60 + Math.floor(r() * 3)
  const chant = [0, 4, 7, 4, 0, 4, 7, 12]
  return (c, out, step, t, dur) => {
    const bar = Math.floor(step / 8)
    const s = step % 8
    if (s === 0) murmur(c, out, t, dur * 8 + 0.3, bar % 12 === 11 ? 0.16 : 0.08, 650)
    // A chance, a goal: the roar swells.
    if (s === 0 && bar % 12 === 11) applause(c, out, t, dur * 8, 0.1)
    // The big drum: boum, boum, boum… boum.
    if (s === 0 || s === 2 || s === 4) kick(c, out, t, 0.55)
    if (s === 6) snare(c, out, t, 0.18)
    // The song, every other phrase, the whole stand in unison.
    if (bar % 4 < 2 && s % 2 === 0) {
      const n = chant[((bar % 2) * 4 + s / 2) % chant.length]
      for (const x of [0, 12, -12]) voice(c, out, t, key + n + x, dur * 1.8, x ? 0.025 : 0.045, s % 4 === 0 ? 'o' : 'e')
    }
    // The trumpets of the brass band in the stand.
    if (bar % 8 === 6 && s === 0) brass(c, out, t, key + 7, dur * 3, 0.06, 2000)
    if (bar % 8 === 6 && s === 4) brass(c, out, t, key + 12, dur * 3.5, 0.06, 2000)
  }
}

/**
 * The stadium's concert: the stage's coupé-décalé (the club's, bigger) over a
 * crowd of thousands: its roar all along, louder between two songs with the
 * cheers and the whistles, shouts and you-yous in it, and the singer calling
 * the crowd, which answers in one voice.
 */
function concert(r: () => number): Song {
  const song = coupeDecale(r, false)
  const key = 57 + Math.floor(r() * 4)
  return (c, out, step, t, dur) => {
    song(c, out, step, t, dur)
    const bar = Math.floor(step / 16)
    const s = step % 16
    if (s === 0) murmur(c, out, t, dur * 16 + 0.3, bar % 8 === 7 ? 0.2 : 0.11, 700)
    // Between two songs: the crowd cheers and whistles.
    if (s === 0 && bar % 8 === 7) applause(c, out, t, dur * 16, 0.14)
    // Shouts here and there in the crowd, a you-you now and then.
    if (r() < 0.1) voice(c, out, t + r() * dur, key + 12 + Math.floor(r() * 5), dur * 1.5, 0.03, 'e', r() < 0.3 ? 9 : 0)
    // The singer calls (« Babi ! »), the crowd answers, every fourth bar.
    if (bar % 4 === 3 && (s === 0 || s === 6)) for (const x of [0, 12, -12]) voice(c, out, t, key + (s === 0 ? 7 : 4) + x, dur * 3, x ? 0.03 : 0.05, s === 0 ? 'a' : 'o')
  }
}

/** The museum, the gallery: hushed voices of the visitors, a kora playing softly somewhere. */
function expo(r: () => number): Song {
  const key = 57 + Math.floor(r() * 5)
  const scale = [0, 2, 4, 7, 9, 12, 14, 16]
  const run = [...Array(16)].map(() => Math.floor(r() * scale.length))
  return (c, out, step, t, dur) => {
    const bar = Math.floor(step / 8)
    const s = step % 8
    if (s === 0 && bar % 2 === 0) murmur(c, out, t, dur * 16 + 0.3, 0.05, 480)
    // The kora's arpeggio, quiet.
    if (bar % 4 !== 3) pluck(c, out, t, key + scale[run[(bar % 2) * 8 + s]], 0.085)
    if (s === 0) pluck(c, out, t, key - 12, 0.075)
  }
}

const STYLES: Record<Track, Style> = {
  club: { bpm: 128, steps: 4, swing: 0.04, build: (r) => coupeDecale(r, false) },
  maquis: { bpm: 118, steps: 4, swing: 0.08, build: (r) => coupeDecale(r, true) },
  fanfare: { bpm: 112, steps: 2, swing: 0, build: fanfare },
  spectacle: { bpm: 112, steps: 4, swing: 0.06, build: spectacle },
  stade: { bpm: 120, steps: 2, swing: 0, build: stade },
  concert: { bpm: 128, steps: 4, swing: 0.04, build: concert },
  expo: { bpm: 72, steps: 2, swing: 0.04, build: expo },
}

/* ---------- Playing ---------- */

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : VOLUME
  // A touch of compression keeps it even on phone speakers; the top softened, so it's never shrill.
  const comp = ctx.createDynamicsCompressor()
  const soft = ctx.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 6500
  master.connect(soft).connect(comp).connect(ctx.destination)
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
  /** The game's sound out (the context and the master, muted with the music): for the street's ambience (ambience.ts). */
  out(): { ctx: AudioContext; master: GainNode } | null {
    const c = ensure()
    return c && master ? { ctx: c, master } : null
  },
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
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.1)
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
