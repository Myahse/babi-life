// The stories' prologues said aloud (web/src/components/prologue/scenarios/<story>.json): each shot's
// line by its speaker's voice on ElevenLabs (the cast's « voice »: the narrator Lea, a voice for each
// character), one MP3 a line in web/public/audio/prologues/<story>/<shot>.mp3. A line already said is
// kept (ElevenLabs bills by character) unless --force, or --only names its story.
//
//   ELEVENLABS_API_KEY=… node tools/voix/prologues.mjs [--only cour-hantee,kone-petit-fils] [--force] [--model eleven_v4]
//
// The words with the voice's tags ([whispers], [laughs]…) are the line's « say » (its « text » without
// them is what's written). « Gbairai » is said « gbèrè », « Djai » « djè ». Behind a proxy: NODE_USE_ENV_PROXY=1.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const KEY = (process.env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEYS ?? '').split(',')[0]
const ONLY = arg('only')?.split(',')
const MODEL = arg('model') ?? 'eleven_v4'
const FORCE = process.argv.includes('--force')
const LEA = 'KSyQzmsYhFbuOhqj1Xxv'
if (!KEY) {
  console.error('ELEVENLABS_API_KEY est nécessaire.')
  process.exit(2)
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const scripts = join(root, 'web', 'src', 'components', 'prologue', 'scenarios')
const say = (t) => t.replace(/gbairai/gi, 'gbèrè').replace(/djai/gi, 'djè')
let chars = 0
// The prologues, then the chapters' films (scenarios/chapitres/, tools/prologues/chapitres.py).
const files = [scripts, join(scripts, 'chapitres')].flatMap((d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => join(d, f)) : []))
for (const f of files) {
  const s = JSON.parse(readFileSync(f, 'utf8'))
  if (ONLY && !ONLY.includes(s.id)) continue
  const out = join(root, 'web', 'public', 'audio', 'prologues', s.id)
  mkdirSync(out, { recursive: true })
  for (const [n, shot] of s.shots.entries()) {
    if (!shot.line) continue
    const file = join(out, `${n}.mp3`)
    if (existsSync(file) && !FORCE) continue
    const who = s.cast[shot.line.who]
    const voice = who?.voice ?? LEA
    const narr = shot.line.who === 'narr'
    const text = say(shot.line.say ?? shot.line.text)
    const r = await fetch(`${process.env.ELEVENLABS_URL ?? 'https://api.elevenlabs.io'}/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      // The narrator steady and warm; the characters freer, more acted.
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: narr ? { stability: 0.35, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true, speed: 1.0 } : { stability: 0.3, similarity_boost: 0.8, style: 0.75, use_speaker_boost: true, speed: 1.02 } }),
    })
    if (!r.ok) {
      console.error(`${s.id} ${n} : ${r.status} ${(await r.text()).slice(0, 200)}`)
      continue
    }
    writeFileSync(file, Buffer.from(await r.arrayBuffer()))
    chars += text.length
    console.log(`${s.id} ${n} (${shot.line.who}) : dit`)
  }
}
console.log(`${chars} caractères`)
