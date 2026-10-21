// Tikitoko's sounds: a few short loops in the spirit of coupé-décalé,
// afrobeat and zouglou, made right here with WebAudio oscillators and noise
// (no audio file, so no licence to worry about). The same code plays them in
// the feed and mixes them into a clip being recorded (screens/TikitokoApp.tsx,
// through a MediaStreamDestination). The ids are the server's (sims/tikivideo.go).

export type TikiSound = { id: string; name: string; artist: string }

export const SOUNDS: TikiSound[] = [
  { id: '', name: 'son original', artist: '' },
  { id: 'decale', name: 'Décalé Express', artist: 'DJ Lagune' },
  { id: 'afro', name: 'Afro Plateau', artist: 'Les Gbakas' },
  { id: 'zouglou', name: 'Zouglou du campus', artist: 'Ambiance Facile' },
  { id: 'lagune', name: 'Nuit sur la lagune', artist: 'Babi Chill' },
]

export const soundOf = (id: string) => SOUNDS.find((s) => s.id === id) ?? SOUNDS[0]

/** A loop: drums on 16 steps (x: hit, o: soft), bass and lead on 32 (semitones above the root, null: rest). */
type Track = { bpm: number; root: number; kick: string; snare: string; hat: string; shaker?: string; bass: (number | null)[]; lead: (number | null)[]; leadWave: OscillatorType; bassWave: OscillatorType; swing?: number }

const _ = null
const TRACKS: Record<string, Track> = {
  // Four on the floor, offbeat hats, a quick marimba-like line: the coupé-décalé feel.
  decale: {
    bpm: 128, root: 55, leadWave: 'triangle', bassWave: 'sawtooth',
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...xo', shaker: 'o.o.o.o.o.o.o.o.',
    bass: [0, _, _, 0, _, _, 7, _, 5, _, _, 5, _, _, 3, _, 0, _, _, 0, _, _, 7, _, 10, _, _, 7, _, 5, _, _],
    lead: [12, 15, 19, 15, 22, 19, 15, 19, 12, 15, 17, 15, 19, 17, 15, 12, 12, 15, 19, 15, 24, 22, 19, 22, 17, 19, 17, 15, 12, _, 10, _],
  },
  // Laid-back syncopated kick, a clap on 2 and 4, shaker all along.
  afro: {
    bpm: 106, root: 49, leadWave: 'square', bassWave: 'triangle', swing: 0.12,
    kick: 'x.....x...x.....', snare: '....x.......x..o', hat: '................', shaker: 'oxoooxoooxoooxoo',
    bass: [0, _, _, _, _, _, 0, _, _, _, 3, _, 5, _, _, _, 7, _, _, _, _, _, 5, _, _, _, 3, _, 0, _, _, _],
    lead: [_, _, 12, _, 15, _, _, 17, _, _, 15, _, 12, _, _, _, _, _, 19, _, 17, _, _, 15, _, _, 12, _, 10, _, _, _],
  },
  // Zouglou: a bouncy kick, guitar-like plucks going up and down.
  zouglou: {
    bpm: 96, root: 52, leadWave: 'square', bassWave: 'triangle',
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: [0, _, 0, _, 7, _, 7, _, 5, _, 5, _, 4, _, 2, _, 0, _, 0, _, 7, _, 7, _, 9, _, 7, _, 5, _, 4, _],
    lead: [12, _, 16, _, 19, _, 16, _, 17, _, 21, _, 19, _, 16, _, 12, _, 16, _, 19, _, 24, _, 21, _, 19, _, 17, _, 16, _],
  },
  // Slow and soft: a sine melody over a gentle beat.
  lagune: {
    bpm: 88, root: 46, leadWave: 'sine', bassWave: 'sine',
    kick: 'x.........x.....', snare: '....o.......o...', hat: 'o...o...o...o...',
    bass: [0, _, _, _, _, _, _, _, 5, _, _, _, _, _, _, _, 3, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _],
    lead: [19, _, _, 17, _, _, 15, _, _, _, 12, _, _, _, _, _, 15, _, _, 17, _, _, 19, _, _, _, 22, _, 19, _, _, _],
  },
}

let shared: AudioContext | null = null
/** The app's one AudioContext; resume it from a tap (iOS keeps it silent otherwise). */
export function tikiAudio(): AudioContext | null {
  if (shared) return shared
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  shared = new AC()
  return shared
}
/** From a user's gesture: the sounds may play from now on. */
export function wakeAudio() {
  const ctx = tikiAudio()
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined)
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>()
function noise(ctx: BaseAudioContext) {
  let b = noises.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = b.getChannelData(0)
    // A fixed pseudo-random noise: the same hiss everywhere.
    let s = 1
    for (let i = 0; i < d.length; i++) {
      s = (s * 16807) % 2147483647
      d[i] = (s / 2147483647) * 2 - 1
    }
    noises.set(ctx, b)
  }
  return b
}

const hz = (root: number, semi: number) => root * Math.pow(2, semi / 12)

function env(ctx: BaseAudioContext, to: AudioNode, t: number, peak: number, decay: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  g.connect(to)
  return g
}

function kick(ctx: BaseAudioContext, out: AudioNode, t: number, v: number) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13)
  o.connect(env(ctx, out, t, 0.9 * v, 0.32))
  o.start(t)
  o.stop(t + 0.35)
}

function hiss(ctx: BaseAudioContext, out: AudioNode, t: number, type: BiquadFilterType, f: number, peak: number, decay: number) {
  const n = ctx.createBufferSource()
  n.buffer = noise(ctx)
  const flt = ctx.createBiquadFilter()
  flt.type = type
  flt.frequency.value = f
  n.connect(flt)
  flt.connect(env(ctx, out, t, peak, decay))
  // Each hit starts somewhere else in the noise, so they don't all sound alike.
  n.start(t, (t * 7.3) % 0.8)
  n.stop(t + decay + 0.02)
}

function tone(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, wave: OscillatorType, peak: number, decay: number, cutoff?: number) {
  const o = ctx.createOscillator()
  o.type = wave
  o.frequency.setValueAtTime(f, t)
  let to: AudioNode = env(ctx, out, t, peak, decay)
  if (cutoff) {
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = cutoff
    flt.connect(to)
    to = flt
  }
  o.connect(to)
  o.start(t)
  o.stop(t + decay + 0.02)
}

/**
 * Plays a sound in a loop into the given outputs (the speakers, a recording)
 * until the returned function is called. "" (son original) plays nothing.
 */
export function playSound(ctx: AudioContext, id: string, outs: AudioNode[]): () => void {
  const tr = TRACKS[id]
  if (!tr) return () => undefined
  const master = ctx.createGain()
  master.gain.value = 0.55
  const comp = ctx.createDynamicsCompressor()
  master.connect(comp)
  outs.forEach((o) => comp.connect(o))
  const step = 60 / tr.bpm / 4
  let n = 0
  let next = ctx.currentTime + 0.06
  const schedule = () => {
    // A little ahead of time, by the audio clock: steady even when the page is busy.
    while (next < ctx.currentTime + 0.15) {
      const s16 = n % 16
      const s32 = n % 32
      const t = next + (tr.swing && n % 2 ? step * tr.swing : 0)
      const hit = (pat: string | undefined) => (pat ? pat[s16] : '.')
      const v = (c: string) => (c === 'x' ? 1 : c === 'o' ? 0.45 : 0)
      if (v(hit(tr.kick))) kick(ctx, master, t, v(hit(tr.kick)))
      if (v(hit(tr.snare))) hiss(ctx, master, t, 'bandpass', 1900, 0.5 * v(hit(tr.snare)), 0.16)
      if (v(hit(tr.hat))) hiss(ctx, master, t, 'highpass', 7500, 0.16 * v(hit(tr.hat)), 0.05)
      if (v(hit(tr.shaker))) hiss(ctx, master, t, 'highpass', 5000, 0.08 * v(hit(tr.shaker)), 0.04)
      const b = tr.bass[s32]
      if (b !== null) tone(ctx, master, t, hz(tr.root, b), tr.bassWave, 0.32, step * 2.6, 700)
      const l = tr.lead[s32]
      if (l !== null) tone(ctx, master, t, hz(tr.root * 4, l), tr.leadWave, tr.leadWave === 'square' ? 0.07 : 0.16, tr.leadWave === 'sine' ? step * 3 : 0.2, 3200)
      next += step
      n++
    }
  }
  schedule()
  const timer = setInterval(schedule, 30)
  return () => {
    clearInterval(timer)
    const t = ctx.currentTime
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0, t + 0.12)
    setTimeout(() => comp.disconnect(), 300)
  }
}
