// The stories' prologues read aloud (backend game/stories.go Prologue), by a
// narrator's voice on ElevenLabs: one MP3 a story in web/public/audio/histoires/,
// and index.json listing the stories that have one (the phone shows « Écouter »
// for those only: web/src/lib/narration.ts). A prologue already read is kept
// (ElevenLabs bills by character), unless --force, or --only names it.
//
//   ELEVENLABS_API_KEY=… node tools/voix/histoires.mjs [--voice <voice id>] [--model eleven_v4] [--only kone-petit-fils,chat-grigri] [--force]
//
// By default Lea (« Lea - UGC creator », KSyQzmsYhFbuOhqj1Xxv) on eleven_v4, 1 credit
// a character (the 25 prologues: about 6 900). eleven_v4_turbo or eleven_flash_v2_5
// cost half.
//
// Another voice: ElevenLabs, Voices, the voice's « ID ». Behind a proxy: NODE_USE_ENV_PROXY=1.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const KEY = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEYS
const VOICE = arg('voice') ?? 'KSyQzmsYhFbuOhqj1Xxv'
const ONLY = arg('only')?.split(',')
const MODEL = arg('model') ?? 'eleven_v4'
const FORCE = process.argv.includes('--force')
if (!KEY) {
  console.error('ELEVENLABS_API_KEY est nécessaire.')
  process.exit(2)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'web', 'public', 'audio', 'histoires')
mkdirSync(out, { recursive: true })
const stories = JSON.parse(execFileSync('go', ['run', './cmd/prologues'], { cwd: join(root, 'backend'), encoding: 'utf8' }))

let made = 0
for (const st of stories) {
  const file = join(out, `${st.id}.mp3`)
  if (ONLY ? !ONLY.includes(st.id) : existsSync(file) && !FORCE) continue
  const r = await fetch(`${process.env.ELEVENLABS_URL ?? 'https://api.elevenlabs.io'}/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: st.prologue, model_id: MODEL, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25 } }),
  })
  if (!r.ok) {
    console.error(`${st.id} : ${r.status} ${(await r.text()).slice(0, 200)}`)
    continue
  }
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  made++
  console.log(`${st.id} : lu (${st.prologue.length} caractères)`)
}

// The list the phone reads: every story with its MP3.
const have = readdirSync(out).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort()
writeFileSync(join(out, 'index.json'), JSON.stringify(have) + '\n')
console.log(`${made} prologue${made > 1 ? 's' : ''} lu${made > 1 ? 's' : ''}, ${have.length} histoire${have.length > 1 ? 's' : ''} avec sa voix.`)
