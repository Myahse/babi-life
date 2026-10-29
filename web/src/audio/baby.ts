import { music } from './music'

// The baby's voice: real babies, recorded (public/audio/bebe/, from Wikimedia
// Commons, in the public domain: see its SOURCES.md). Its cries, its whimpers,
// its laughs and babbling, cut into short pieces and played at random so it
// never sounds the same twice. Through the music's master: « couper le son »
// cuts it too.

type Kind = 'pleurs' | 'gemit' | 'rire' | 'gazouille'
/** The pieces there are of each (public/audio/bebe/<kind>-<n>.mp3). */
const PIECES: Record<Kind, number> = { pleurs: 4, gemit: 0, rire: 0, gazouille: 0 }
/** What stands in for a kind with no piece of its own yet. */
const STANDIN: Record<Kind, Kind> = { pleurs: 'pleurs', gemit: 'pleurs', rire: 'gazouille', gazouille: 'gazouille' }
const VOLUME: Record<Kind, number> = { pleurs: 0.55, gemit: 0.3, rire: 0.5, gazouille: 0.45 }

const buffers = new Map<string, Promise<AudioBuffer | null>>()

function load(ctx: AudioContext, name: string) {
  let b = buffers.get(name)
  if (!b) {
    b = fetch(`/audio/bebe/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null)
    buffers.set(name, b)
  }
  return b
}

let last = ''
/** A piece of this kind (never the same twice in a row), played once; a whimper is a cry, short and soft. */
async function say(kind: Kind) {
  const o = music.out()
  if (!o || o.ctx.state !== 'running') return
  let k = kind
  if (!PIECES[k]) k = STANDIN[k]
  const n = PIECES[k]
  if (!n) return
  let i = 1 + Math.floor(Math.random() * n)
  if (n > 1 && `${k}-${i}` === last) i = (i % n) + 1
  last = `${k}-${i}`
  const buf = await load(o.ctx, last)
  if (!buf) return
  const { ctx: c, master } = o
  const src = c.createBufferSource()
  src.buffer = buf
  // A little higher or lower each time: not always the same baby's breath.
  src.playbackRate.value = 0.95 + Math.random() * 0.1
  const g = c.createGain()
  const short = kind === 'gemit' && k !== kind
  const length = short ? Math.min(1.2, buf.duration) : buf.duration
  g.gain.setValueAtTime(VOLUME[kind], c.currentTime)
  g.gain.setValueAtTime(VOLUME[kind], c.currentTime + length - 0.25)
  g.gain.linearRampToValueAtTime(0, c.currentTime + length)
  src.connect(g).connect(master)
  src.start(c.currentTime, 0, length)
}

export const baby = {
  /** A fit of crying. */
  cry: () => void say('pleurs'),
  /** Something's wrong (hungry, tired, dirty): a little whimper. */
  whimper: () => void say('gemit'),
  /** A laugh. */
  giggle: () => void say('rire'),
  /** The little push (the caca): its babble of effort. */
  push: () => void say('gazouille'),
  /** Vomiting: a short, unhappy sound. */
  bleh: () => void say('gemit'),
  /** Babbling: content, playing. */
  babble: () => void say('gazouille'),
}
