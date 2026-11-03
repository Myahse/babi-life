// The prologues' sounds (types.ts Shot.bd.sfx: the word written big in the comic), made in the browser
// (Web Audio: nothing to download): steps on a tin roof, a phone ringing, a crowd, a drop, a whoosh, a
// cat's whine… The film plays a shot's as it starts, the comic its panel's as it comes.

let ctx: AudioContext | null = null
const audio = () => {
  if (typeof window === 'undefined') return null
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(c: AudioContext, at: number, freq: number, len: number, { type = 'sine', vol = 0.2, to }: { type?: OscillatorType; vol?: number; to?: number } = {}) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + len)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + len + 0.05)
}

function noise(c: AudioContext, at: number, len: number, { freq = 1200, q = 1, vol = 0.25, type = 'bandpass' }: { freq?: number; q?: number; vol?: number; type?: BiquadFilterType } = {}) {
  const n = Math.max(1, Math.floor(c.sampleRate * len))
  const buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  const s = c.createBufferSource()
  s.buffer = buf
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(vol, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  s.connect(f).connect(g).connect(c.destination)
  s.start(at)
}

/** The sound for a comic's word, if it has one. */
export function playSfx(word: string | undefined, muted = false) {
  if (!word || muted) return
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.05
  const w = word.toLowerCase()
  if (w.includes('tap')) {
    // Steps on the tin roof: dull knocks, one after another.
    for (let i = 0; i < 6; i++) noise(c, t + 0.8 + i * 0.32, 0.12, { freq: 300 + (i % 2) * 60, q: 4, vol: 0.5 })
  } else if (w.includes('dring')) {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) tone(c, t + r * 1.2 + i * 0.05, i % 2 ? 1250 : 1000, 0.05, { type: 'square', vol: 0.06 })
  } else if (w.includes('bip')) {
    for (let i = 0; i < 3; i++) tone(c, t + i * 0.9, 440, 0.5, { vol: 0.08 })
  } else if (w.includes('ouinn')) {
    tone(c, t + 0.4, 700, 1.1, { type: 'triangle', vol: 0.12, to: 420 })
  } else if (w.includes('ronron')) {
    for (let i = 0; i < 6; i++) noise(c, t + i * 0.45, 0.4, { freq: 90, q: 2, vol: 0.35, type: 'lowpass' })
  } else if (w.includes('ploc')) {
    tone(c, t + 0.3, 900, 0.18, { vol: 0.25, to: 300 })
  } else if (w.includes('vlan')) {
    noise(c, t + 0.5, 0.45, { freq: 2000, q: 0.7, vol: 0.35 })
  } else if (w.includes('chhh')) {
    noise(c, t + 0.2, 0.9, { freq: 4500, q: 0.8, vol: 0.12 })
  } else if (w.includes('ouais') || w.includes('pari') || w.includes('tournoi')) {
    // A crowd going up.
    for (let i = 0; i < 4; i++) noise(c, t + 0.3 + i * 0.12, 1.2, { freq: 600 + i * 300, q: 0.6, vol: 0.12 })
  } else if (w.includes('♪') || w.includes('♫')) {
    ;[523, 659, 784, 659, 880].forEach((f, i) => tone(c, t + 0.2 + i * 0.22, f, 0.3, { type: 'triangle', vol: 0.1 }))
  } else if (w.includes('♥')) {
    ;[660, 880].forEach((f, i) => tone(c, t + 0.2 + i * 0.25, f, 0.6, { vol: 0.1 }))
  } else if (w.includes('?!') || w.includes('!')) {
    tone(c, t + 0.2, 220, 0.6, { type: 'sawtooth', vol: 0.06, to: 160 })
  }
}
