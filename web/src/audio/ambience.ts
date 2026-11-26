import { music } from './music'
import { countryLookNow } from '../world3d/countryStyle'
import { HONK_LANDS, MOPED_LANDS } from '../world3d/countryStyleAfrique'
import { EUROPE_BELLS } from '../world3d/europeStyle'

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
const next = { bird: 0, cricket: 0, horn: 0, thunder: 0, siren: 0, moped: 0, bells: 0 }

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

/** A siren going by far off (New York): the wail rising and falling a few times. */
function siren(n: Nodes, at: number, vol: number) {
  const c = n.ctx
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  for (let k = 0; k < 4; k++) {
    osc.frequency.setValueAtTime(650, at + k * 1.6)
    osc.frequency.linearRampToValueAtTime(1350, at + k * 1.6 + 0.8)
    osc.frequency.linearRampToValueAtTime(650, at + k * 1.6 + 1.6)
  }
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 1800
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 2)
  g.gain.linearRampToValueAtTime(0, at + 6.4)
  osc.connect(f).connect(g).connect(n.out)
  osc.start(at)
  osc.stop(at + 6.6)
}

/** The French police's two-tone « pin-pon » going by far off (France): the two notes in turn, swelling and fading. */
function pinPon(n: Nodes, at: number, vol: number) {
  for (let k = 0; k < 8; k++) tone(n, 'square', k % 2 ? 488 : 435, k % 2 ? 488 : 435, at + k * 0.6, 0.55, vol * Math.sin((Math.PI * (k + 0.5)) / 8), 1400)
}

/** A moped going by (Ouagadougou): its two-stroke buzz, rising and falling as it passes. */
function moped(n: Nodes, at: number, vol: number) {
  const c = n.ctx
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  const base = 95 + Math.random() * 40
  osc.frequency.setValueAtTime(base, at)
  osc.frequency.linearRampToValueAtTime(base * 1.35, at + 1.4)
  osc.frequency.linearRampToValueAtTime(base * 1.1, at + 3)
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 520
  f.Q.value = 1.2
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 1.3)
  g.gain.linearRampToValueAtTime(0, at + 3.2)
  osc.connect(f).connect(g).connect(n.out)
  osc.start(at)
  osc.stop(at + 3.4)
}

/** A church's bells far off (Montréal, « la ville aux cent clochers »): a few slow strokes. */
function bells(n: Nodes, at: number, vol: number) {
  const f = 392 + Math.random() * 60
  for (let k = 0; k < 4; k++) {
    tone(n, 'sine', f, f * 0.995, at + k * 1.3, 1.6, vol)
    tone(n, 'sine', f * 2.4, f * 2.39, at + k * 1.3, 1.1, vol * 0.35)
  }
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

/** How deep in the bush the Sim is (0 in town, 1 in the reserve): set by the reserve itself. */
let wild = 0
const wildNext = { hornbill: 0, dove: 0, hippo: 0, far: 0, frog: 0, owl: 0 }

/** An elephant's trumpet: a brassy blare rising, wavering and falling, vol by how near. */
function trumpet(n: Nodes, at: number, vol: number) {
  const c = n.ctx
  for (const [type, mul, v] of [['sawtooth', 1, 1], ['square', 1.5, 0.35]] as const) {
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(330 * mul, at)
    osc.frequency.linearRampToValueAtTime(720 * mul, at + 0.25)
    osc.frequency.linearRampToValueAtTime(640 * mul, at + 0.7)
    osc.frequency.linearRampToValueAtTime(420 * mul, at + 1.25)
    const wob = c.createOscillator()
    wob.frequency.value = 23
    const wobG = c.createGain()
    wobG.gain.value = 18 * mul
    wob.connect(wobG).connect(osc.frequency)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1100
    f.Q.value = 0.8
    const g = c.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.09 * vol * v, at + 0.12)
    g.gain.setTargetAtTime(0.06 * vol * v, at + 0.4, 0.3)
    g.gain.setTargetAtTime(0, at + 1.1, 0.12)
    osc.connect(f).connect(g).connect(n.out)
    for (const o of [osc, wob]) (o.start(at), o.stop(at + 1.8))
  }
}

/** The bush's own voices: hornbills and doves by day, a hippo's honking laugh from the river, an elephant far off; frogs and an owl at night. */
function wildVoices(n: Nodes, now: number, night: boolean) {
  const r = Math.random
  const w = wild
  if (!night && now > wildNext.hornbill) {
    // The hornbill's nasal « kok-kok-kok », quickening.
    for (let k = 0; k < 5; k++) tone(n, 'square', 620, 520, now + k * (0.32 - k * 0.04), 0.09, 0.012 * w, 1400)
    wildNext.hornbill = now + 14 + r() * 20
  }
  if (!night && now > wildNext.dove) {
    // A dove's soft coo, three notes.
    for (const [k, f] of [[0, 520], [0.45, 470], [0.75, 470]]) tone(n, 'sine', f, f * 0.94, now + k, 0.28, 0.02 * w, 1200)
    wildNext.dove = now + 9 + r() * 14
  }
  if (now > wildNext.hippo) {
    // The hippo's honk: a wheeze, then the deep « hoh-hoh-hoh ».
    tone(n, 'sawtooth', 210, 160, now, 0.5, 0.012 * w, 500)
    for (let k = 0; k < 4; k++) tone(n, 'square', 120, 90, now + 0.6 + k * 0.28, 0.2, 0.02 * w, 420)
    wildNext.hippo = now + 25 + r() * 35
  }
  if (now > wildNext.far) {
    if (wildNext.far) trumpet(n, now, 0.18 * w)
    wildNext.far = now + 50 + r() * 60
  }
  if (night && now > wildNext.frog) {
    // The frogs by the river: a croak, then another answering.
    for (let k = 0; k < 2; k++) tone(n, 'square', 260 + k * 40, 180, now + k * 0.35, 0.12, 0.01 * w, 700)
    wildNext.frog = now + 0.8 + r() * 2
  }
  if (night && now > wildNext.owl) {
    for (const k of [0, 0.5]) tone(n, 'sine', 380, 340, now + k, 0.35, 0.025 * w, 900)
    wildNext.owl = now + 30 + r() * 40
  }
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
  // In the bush (a reserve): its own voices instead of the town's.
  if (wild > 0 && !inside && !rain) wildVoices(n, now, night)
  // The country's own street (world3d/countryStyle.ts): New York's sirens and car horns, Ouaga's mopeds, Montréal's bells;
  // France's police « pin-pon », its scooters and its church bells.
  const land = countryLookNow().id
  // A horn far off (a taxi's « pin-pin »; a car's deeper honk in America), out (not out in the bush).
  if (!inside && wild < 0.5 && now > next.horn) {
    const us = land === 'us' || land === 'ca' || land === 'fr' || EUROPE_BELLS.has(land)
    const f = us ? 300 + r() * 90 : 380 + r() * 160
    const twice = r() < 0.5
    tone(n, us ? 'sawtooth' : 'square', f, f, now, us ? 0.34 : 0.16, 0.008, 1100)
    if (twice) tone(n, us ? 'sawtooth' : 'square', f, f, now + (us ? 0.45 : 0.24), 0.2, 0.008, 1100)
    next.horn = now + (land === 'us' || HONK_LANDS.has(land) ? 8 : land === 'ca' || land === 'fr' ? 35 : 18) + r() * 25
  }
  if (!inside && wild < 0.5 && land === 'us' && now > next.siren) {
    if (next.siren) siren(n, now, night ? 0.012 : 0.009)
    next.siren = now + 45 + r() * 60
  }
  if (!inside && wild < 0.5 && land === 'fr' && now > next.siren) {
    if (next.siren) pinPon(n, now, night ? 0.01 : 0.007)
    next.siren = now + 70 + r() * 80
  }
  if (!inside && wild < 0.5 && (land === 'bf' || land === 'fr' || countryLookNow().mopeds || MOPED_LANDS.has(land)) && !rain && now > next.moped) {
    if (next.moped) moped(n, now, land === 'fr' ? 0.008 + r() * 0.006 : 0.014 + r() * 0.01)
    next.moped = now + (land === 'fr' ? 12 + r() * 18 : 3 + r() * 6)
  }
  if (!inside && (land === 'ca' || land === 'fr' || EUROPE_BELLS.has(land)) && !night && now > next.bells) {
    if (next.bells) bells(n, now, 0.01)
    next.bells = now + 90 + r() * 90
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
  // In the bush the town's hum fades, and it's the river's murmur instead (the same low noise, softer).
  n.street.gain.setTargetAtTime(s.inside ? 0.04 : (s.night ? 0.14 : 0.24) * (s.music ? 0.4 : 1) * (s.rain ? 0.5 : 1) * (1 - wild * 0.6), t, 1)
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
  /** A procession's drum: a low beat, struck twice. */
  drum(vol = 1) {
    const n = live()
    if (!n || vol <= 0.02) return
    const now = n.ctx.currentTime
    for (const k of [0, 0.28]) tone(n, 'sine', 150, 55, now + k, 0.22, 0.09 * Math.min(1, vol), 900)
  },
  /** A club's or a maquis' music through its walls: the kick of the beat, the bass under it, muffled by distance. */
  thump(vol = 1, bass = 55) {
    const n = live()
    if (!n || vol <= 0.02) return
    const now = n.ctx.currentTime
    const v = Math.min(1, vol)
    tone(n, 'sine', 140, 48, now, 0.16, 0.08 * v, 400)
    tone(n, 'triangle', bass * 2, bass * 2, now + 0.25, 0.22, 0.025 * v, 300 + 500 * v)
  },
  /** Tyres screeching (a near miss). */
  screech(vol = 1) {
    const n = live()
    if (!n || vol <= 0.02) return
    tone(n, 'sawtooth', 1800, 1300, n.ctx.currentTime, 0.45, 0.02 * Math.min(1, vol), 3000)
  },

  /** Fruit bats scared off a tree (the Plateau's, plateau-vivant): a burst of shrill squeaks. */
  bats(vol = 1) {
    const n = live()
    if (!n || vol <= 0.02) return
    const now = n.ctx.currentTime
    for (let k = 0; k < 7; k++) {
      const f = 3200 + Math.random() * 2200
      tone(n, k % 2 ? 'square' : 'triangle', f, f * (0.82 + Math.random() * 0.1), now + k * 0.07 + Math.random() * 0.04, 0.06, 0.014 * Math.min(1, vol), 7000)
    }
  },
  /** A lance-pierre's rubber let go: a short snap. */
  snap(vol = 1) {
    const n = live()
    if (!n || vol <= 0.02) return
    tone(n, 'triangle', 620, 160, n.ctx.currentTime, 0.09, 0.05 * Math.min(1, vol), 2400)
  },

  /** How deep in the bush the Sim is (0..1, the reserve sets it): its voices, no taxi horns. */
  wild(v: number) {
    wild = Math.max(0, Math.min(1, v))
  },
  /** An elephant trumpeting, vol by how near. */
  trumpet(vol = 1) {
    const n = live()
    if (!n || vol <= 0.02) return
    trumpet(n, n.ctx.currentTime, Math.min(1, vol))
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
