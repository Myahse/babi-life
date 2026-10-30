import { music } from './music'

// The sound of where the Sim is, made in the browser like the music: the
// rain on the street (muffled on the roof indoors) and its thunder; the
// street's hum and, now and then, a horn far off; birds by day, crickets at
// night. Through the music's master, so « couper le son » cuts it too; under
// a place's music it steps back.

export type Scene = { rain: boolean; night: boolean; inside: boolean; music: boolean }

let scene: Scene | null = null
let timer: number | null = null
type Nodes = { ctx: AudioContext; out: GainNode; rain: GainNode; rainTone: BiquadFilterNode; street: GainNode }
let nodes: Nodes | null = null
const next = { bird: 0, cricket: 0, horn: 0, thunder: 0 }

function noise(c: AudioContext, brown: boolean, seconds = 3): AudioBuffer {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return b
}

function loop(c: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const s = c.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.start()
  return s
}

function build(): Nodes | null {
  const o = music.out()
  if (!o || o.ctx.state !== 'running') return null
  const c = o.ctx
  const out = c.createGain()
  out.gain.value = 0
  out.connect(o.master)
  // The rain: white noise for the hiss of the drops, brown under it for the body of the downpour.
  const rain = c.createGain()
  rain.gain.value = 0
  const rainTone = c.createBiquadFilter()
  rainTone.type = 'lowpass'
  rainTone.frequency.value = 5000
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 350
  const hiss = c.createGain()
  hiss.gain.value = 0.55
  loop(c, noise(c, false)).connect(hp).connect(hiss).connect(rainTone)
  const body = c.createGain()
  body.gain.value = 0.9
  loop(c, noise(c, true)).connect(body).connect(rainTone)
  rainTone.connect(rain).connect(out)
  // The street: the far-off hum of the traffic.
  const street = c.createGain()
  street.gain.value = 0
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 280
  loop(c, noise(c, true)).connect(lp).connect(street).connect(out)
  return { ctx: c, out, rain, rainTone, street }
}

/** A short tone, enveloped: a chirp, a cricket, a horn. */
function tone(n: Nodes, type: OscillatorType, from: number, to: number, at: number, dur: number, vol: number, cutoff = 8000) {
  const c = n.ctx
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + dur)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = cutoff
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + Math.min(0.02, dur / 3))
  g.gain.setTargetAtTime(0, at + dur * 0.6, dur / 4)
  osc.connect(f).connect(g).connect(n.out)
  osc.start(at)
  osc.stop(at + dur + 0.3)
}

/** Thunder: a rumble swelling and rolling away, far or nearer. */
function thunder(n: Nodes, at: number, vol: number) {
  const c = n.ctx
  const s = c.createBufferSource()
  s.buffer = noise(c, true, 6)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 140 + Math.random() * 120
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 0.25 + Math.random() * 0.4)
  g.gain.setTargetAtTime(vol * 0.5, at + 0.8, 0.5)
  g.gain.setTargetAtTime(0, at + 1.8, 1.4)
  s.connect(f).connect(g).connect(n.out)
  s.start(at)
  s.stop(at + 6)
}

function tick() {
  if (!scene) return
  if (!nodes) nodes = build()
  const n = nodes
  if (!n || n.ctx.state !== 'running') return
  const { rain, night, inside } = scene
  const now = n.ctx.currentTime
  const r = Math.random
  // Birds by day, out, in the dry: two or three chirps.
  if (!night && !rain && !inside && now > next.bird) {
    const base = 2400 + r() * 1400
    for (let k = 0, m = 2 + Math.floor(r() * 3); k < m; k++) tone(n, 'sine', base, base * (1.25 + r() * 0.3), now + k * 0.13, 0.08, 0.018)
    next.bird = now + 3 + r() * 6
  }
  // Crickets at night, out, in the dry: a trill now and then.
  if (night && !rain && !inside && now > next.cricket) {
    for (let k = 0; k < 3; k++) tone(n, 'sine', 4600, 4700, now + k * 0.05, 0.03, 0.01)
    next.cricket = now + 0.5 + r() * 0.9
  }
  // A horn far off (a taxi's « pin-pin »), out.
  if (!inside && now > next.horn) {
    const f = 380 + r() * 160
    const twice = r() < 0.5
    tone(n, 'square', f, f, now, 0.16, 0.008, 1100)
    if (twice) tone(n, 'square', f, f, now + 0.24, 0.2, 0.008, 1100)
    next.horn = now + 18 + r() * 25
  }
  // Thunder in the rain, every half-minute or so.
  if (rain && now > next.thunder) {
    if (next.thunder) thunder(n, now, (inside ? 0.18 : 0.3) * (0.6 + r() * 0.4))
    next.thunder = now + 40 + r() * 50
  }
}

function apply() {
  const n = nodes
  if (!n) return
  const t = n.ctx.currentTime
  const s = scene
  n.out.gain.setTargetAtTime(s ? 0.45 : 0, t, 0.6)
  if (!s) return
  n.rain.gain.setTargetAtTime(s.rain ? (s.inside ? 0.14 : 0.32) : 0, t, 1.5)
  // Indoors, the rain is on the roof: only its low drumming comes through.
  n.rainTone.frequency.setTargetAtTime(s.inside ? 650 : 5000, t, 0.3)
  n.street.gain.setTargetAtTime(s.inside ? 0.04 : (s.night ? 0.14 : 0.24) * (s.music ? 0.4 : 1) * (s.rain ? 0.5 : 1), t, 1)
}

/** Out in the street with its sound on (the update « ambiance-sonore »): the street's own sounds can play. */
const live = () => (scene && !scene.inside && nodes && nodes.ctx.state === 'running' ? nodes : null)

export const ambience = {
  /** A horn close by (a jam, a cortège): vol 0–1, how near; twice now and then, or held long (a horn storm). */
  horn(vol = 1, long = false) {
    const n = live()
    if (!n || vol <= 0.02) return
    const now = n.ctx.currentTime
    const f = 340 + Math.random() * 220
    const v = 0.03 * Math.min(1, vol)
    if (long) return tone(n, 'square', f, f * 0.98, now, 0.9, v, 1400)
    tone(n, 'square', f, f, now, 0.14, v, 1400)
    if (Math.random() < 0.6) tone(n, 'square', f, f, now + 0.22, 0.18, v, 1400)
  },
  /** The traffic cop's whistle: one long blow, or two short. */
  whistle(short = false) {
    const n = live()
    if (!n) return
    const now = n.ctx.currentTime
    if (short) for (const k of [0, 0.2]) tone(n, 'triangle', 2900, 2950, now + k, 0.12, 0.05, 6000)
    else tone(n, 'triangle', 2800, 3100, now, 0.55, 0.05, 6000)
  },
  /** A police siren going by (the wail, up and down), vol by how near. */
  siren(vol = 1) {
    const n = live()
    if (!n || vol <= 0.02) return
    const now = n.ctx.currentTime
    tone(n, 'sawtooth', 620, 980, now, 0.5, 0.012 * Math.min(1, vol), 2200)
    tone(n, 'sawtooth', 980, 620, now + 0.5, 0.5, 0.012 * Math.min(1, vol), 2200)
  },
  /** Tyres screeching (a near miss). */
  screech(vol = 1) {
    const n = live()
    if (!n || vol <= 0.02) return
    tone(n, 'sawtooth', 1800, 1300, n.ctx.currentTime, 0.45, 0.02 * Math.min(1, vol), 3000)
  },

  /** Where the Sim is now (null: silence). */
  set(s: Scene | null) {
    scene = s
    if (s && !timer) timer = window.setInterval(() => (tick(), apply()), 250)
    if (!s && timer) {
      clearInterval(timer)
      timer = null
    }
    apply()
  },
}
