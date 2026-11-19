// v3 sound bed: ElevenLabs sound effects (/v1/sound-generation). node sfx3.mjs jobs.json outdir
// jobs: [{ id, text, dur, influence }]. The key is read from the environment and sent only as the xi-api-key header.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
const key = process.env.ELEVEN_LAB_KEY
if (!key) throw new Error('no key in the environment')
const [jobsFile, OUT] = process.argv.slice(2)
mkdirSync(OUT, { recursive: true })
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8')).filter((j) => !existsSync(`${OUT}/${j.id}.mp3`))
async function one(j) {
  for (let a = 0; a < 3; a++) {
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192', {
      method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text: j.text, duration_seconds: j.dur, prompt_influence: j.influence ?? 0.4 }),
    })
    if (r.ok) { writeFileSync(`${OUT}/${j.id}.mp3`, Buffer.from(await r.arrayBuffer())); console.log('ok', j.id); return }
    const t = (await r.text()).slice(0, 300)
    if (r.status !== 429 && r.status < 500) { console.log('ERR', j.id, r.status, t); return }
    await new Promise((s) => setTimeout(s, 3000 * (a + 1)))
  }
  console.log('FAIL', j.id)
}
const q = [...jobs]
await Promise.all(Array.from({ length: 3 }, async () => { while (q.length) await one(q.shift()) }))
