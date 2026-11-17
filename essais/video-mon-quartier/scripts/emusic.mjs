// Tries ElevenLabs' music generation for the bed (instrumental); key from the environment, as a header only.
import { writeFileSync } from 'fs'
const key = process.env.ELEVEN_LAB_KEY
if (!key) throw new Error('no key in the environment')
const prompt = process.argv[2] ?? 'Light, joyful instrumental Ivorian coupé-décalé / afropop groove, 118 BPM, clean palm-wine guitar arpeggios, soft talking drum, shakers, warm round bass, gentle kick, sunny and friendly, no vocals, background music for a mobile game ad, steady energy throughout, clean ending.'
const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
  method: 'POST',
  headers: { 'xi-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt, music_length_ms: 50000, force_instrumental: true }),
})
if (!r.ok) {
  console.log('music', r.status, (await r.text()).slice(0, 300))
  process.exit(1)
}
writeFileSync(process.argv[3] ?? '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/musique-el.mp3', Buffer.from(await r.arrayBuffer()))
console.log('ok')
