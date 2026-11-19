// Transcribes takes back (ElevenLabs speech-to-text, scribe_v1, with audio events tagged): node stt3.mjs dir [prefix]
// writes dir/stt.json { take: { text, words: [[text, start, end]], events: [...] } } (kept across runs).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
const key = process.env.ELEVEN_LAB_KEY
if (!key) throw new Error('no key in the environment')
const [D, pre = ''] = process.argv.slice(2)
const outF = `${D}/stt.json`
const out = existsSync(outF) ? JSON.parse(readFileSync(outF, 'utf8')) : {}
const files = readdirSync(D).filter((f) => f.endsWith('.mp3') && f.startsWith(pre) && !out[f.replace('.mp3', '')]).sort()
async function one(f) {
  const fd = new FormData()
  fd.append('model_id', 'scribe_v1')
  fd.append('language_code', 'fr')
  fd.append('tag_audio_events', 'true')
  fd.append('file', new Blob([readFileSync(`${D}/${f}`)], { type: 'audio/mpeg' }), f)
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd })
  const d = await r.json()
  if (!r.ok) return console.log('ERR', f, r.status, JSON.stringify(d).slice(0, 200))
  const words = (d.words ?? []).filter((w) => w.type !== 'spacing').map((w) => [w.text, +w.start.toFixed(2), +w.end.toFixed(2), w.type])
  out[f.replace('.mp3', '')] = { text: d.text, words }
  console.log(f, '|', d.text)
}
const q = [...files]
await Promise.all(Array.from({ length: 3 }, async () => { while (q.length) await one(q.shift()) }))
writeFileSync(outF, JSON.stringify(out, null, 0))
