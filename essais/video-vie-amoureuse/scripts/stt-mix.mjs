// Transcribes a whole voice track back (ElevenLabs speech-to-text): checks the cut lines on the timeline.
import { readFileSync } from 'fs'
const key = process.env.ELEVEN_LAB_KEY
if (!key) throw new Error('no key in the environment')
const f = process.argv[2]
const fd = new FormData()
fd.append('model_id', 'scribe_v1')
fd.append('language_code', 'fr')
fd.append('file', new Blob([readFileSync(f)], { type: 'audio/mpeg' }), 'voice.mp3')
const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd })
const d = await r.json()
if (!r.ok) throw new Error(r.status + JSON.stringify(d).slice(0, 200))
const words = (d.words ?? []).filter((w) => w.type === 'word')
let line = [], last = -9
for (const w of words) {
  if (w.start - last > 0.8 && line.length) (console.log(line.join(' ')), (line = []))
  if (!line.length) line.push(`[${w.start.toFixed(1)}]`)
  line.push(w.text)
  last = w.end
}
console.log(line.join(' '))
