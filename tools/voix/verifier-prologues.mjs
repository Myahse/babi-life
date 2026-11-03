// The prologues' lines checked (tools/voix/prologues.mjs): each MP3 transcribed (ElevenLabs speech to text) and
// compared with its text; the ones where words are missing are listed, to say again.
//
//   ELEVENLABS_API_KEY=… node tools/voix/verifier-prologues.mjs [cour-hantee,kone-petit-fils]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web')
const KEY = (process.env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEYS ?? '').split(',')[0]
const only = process.argv[2]?.split(',')
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
const report = []
for (const f of readdirSync(`${root}/src/components/prologue/scenarios`).sort()) {
  const s = JSON.parse(readFileSync(`${root}/src/components/prologue/scenarios/${f}`, 'utf8'))
  if (only && !only.includes(s.id)) continue
  for (const [n, sh] of s.shots.entries()) {
    if (!sh.line) continue
    const file = `${root}/public/audio/prologues/${s.id}/${n}.mp3`
    if (!existsSync(file)) { report.push(`${s.id} ${n}: MANQUE`); continue }
    const fd = new FormData()
    fd.append('model_id', 'scribe_v1'); fd.append('language_code', 'fra')
    fd.append('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), 'a.mp3')
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd })
    if (!r.ok) { report.push(`${s.id} ${n}: stt ${r.status}`); continue }
    const heard = (await r.json()).text
    const want = norm(sh.line.text), got = new Set(norm(heard))
    const missed = want.filter((w) => !got.has(w))
    const score = 1 - missed.length / Math.max(1, want.length)
    if (score < 0.85) report.push(`${s.id} ${n} (${sh.line.who}) ${Math.round(score * 100)}% : manque [${missed.join(' ')}] | entendu : ${heard}`)
  }
}

console.log(report.length ? report.join('\n') : 'tout est bien dit')
