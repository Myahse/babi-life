// Transcribes each line back (ElevenLabs speech-to-text) to check the words and get their times.
import { readFileSync, writeFileSync, readdirSync } from 'fs'
const key = process.env.ELEVEN_LAB_KEY
if (!key) throw new Error('no key in the environment')
const D = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/voix'
const out = {}
for (const f of readdirSync(D).filter((f) => f.endsWith('.mp3')).sort()) {
  const fd = new FormData()
  fd.append('model_id', 'scribe_v1')
  fd.append('language_code', 'fr')
  fd.append('file', new Blob([readFileSync(`${D}/${f}`)], { type: 'audio/mpeg' }), f)
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd })
  const d = await r.json()
  if (!r.ok) throw new Error(f + ' ' + r.status + JSON.stringify(d).slice(0, 200))
  const words = (d.words ?? []).filter((w) => w.type === 'word').map((w) => [w.text, +w.start.toFixed(2), +w.end.toFixed(2)])
  out[f.replace('.mp3', '')] = words
  console.log(f, '|', d.text, '|', words[0]?.[1], '-', words.at(-1)?.[2])
}
writeFileSync(`${D}/words.json`, JSON.stringify(out))
