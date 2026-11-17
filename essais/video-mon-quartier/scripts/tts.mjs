// One mp3 per line, Lea (the owner's « Lea - UGC creator »), multilingual v2, a little slower than normal.
// The key is read from the environment and sent only as the xi-api-key header.
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
const key = process.env.ELEVEN_LAB_KEY
if (!key) throw new Error('no key in the environment')
const VOICE = 'KSyQzmsYhFbuOhqj1Xxv'
const OUT = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/voix'
mkdirSync(OUT, { recursive: true })
const lines = JSON.parse(readFileSync(new URL('./lines.json', import.meta.url), 'utf8'))
const only = process.argv[2]
for (const [id, text] of lines) {
  if (only && !only.split(',').includes(id)) continue
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_192`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: 'fr', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true, speed: 0.85 } }),
  })
  if (!r.ok) throw new Error(`${id}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  writeFileSync(`${OUT}/${id}.mp3`, Buffer.from(await r.arrayBuffer()))
  console.log('ok', id)
}
