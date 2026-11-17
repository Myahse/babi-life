// Lists the owner's voices (names, ids, category) — the key read from the environment, sent only as a header.
const key = process.env.ELEVEN_LAB_KEY
if (!key) throw new Error('no key in the environment')
const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
const d = await r.json()
if (!r.ok) throw new Error('voices: ' + r.status)
for (const v of d.voices) console.log(v.voice_id, '|', v.name, '|', v.category, '|', v.labels?.language ?? '', v.labels?.gender ?? '')
