// « Les histoires se racontent » (FILM=histoires, scripts/histoires.md): Awa's lines,
// one MP3 each in out/voix-histoires/, with Lea's voice on Eleven v4 and its emotion
// tags (the same voice reads the prologues in the game). A line already made is kept
// unless --force. histoires-son.py then puts them together with the prologues.
//
//   ELEVENLABS_API_KEY=… node histoires-voix.mjs [--force]

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { OUT } from './shared.mjs'

/** Awa's lines, in order (their ids are the film's: FILMS.histoires in web/src/lab/poster.tsx). */
export const LINES = [
  ['hello', "[excited] La famille ! C'est Awa ! Y a du nouveau dans Babi Laïf... [laughs] et ça là, c'est fort !"],
  ['quartier', "[warmly] Les histoires du quartier : chaque jour, quelqu'un vient te voir avec son histoire... et le lendemain, il revient avec la suite !"],
  ['ecouter', "[mischievously] Et maintenant, tu appuies sur « Écouter »... et je te raconte tout. [whispers] Écoute ça..."],
  ['rire', "[laughs] Y a des histoires qui font peur... et d'autres qui font rire !"],
  ['coeur', "[tenderly] Des histoires qui touchent le cœur..."],
  ['mystere', "[mysterious] Et des mystères... [whispers] de sorcellerie !"],
  ['choix', "[excited] Vingt-cinq histoires ! Et c'est toi qui choisis la prochaine, parmi trois."],
  ['voyage', "[curious] Certaines t'emmènent en voyage : Man, Yamoussoukro, San-Pédro..."],
  ['djai', "[cheerful] Et chaque chapitre te rapporte jusqu'à deux mille djè."],
  ['laquelle', "[playful] Alors, tu commences par laquelle ? Dis-moi en commentaire ! [excited] Allez, à toi de jouer !"],
]

if (import.meta.url === `file://${process.argv[1]}`) {
  const KEY = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEYS
  if (!KEY) throw new Error('ELEVENLABS_API_KEY est nécessaire.')
  const dir = path.join(OUT, 'voix-histoires')
  mkdirSync(dir, { recursive: true })
  for (const [id, text] of LINES) {
    const file = path.join(dir, `${id}.mp3`)
    if (existsSync(file) && !process.argv.includes('--force')) continue
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/KSyQzmsYhFbuOhqj1Xxv?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_v4', voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.7, use_speaker_boost: true, speed: 1.08 } }),
    })
    if (!r.ok) throw new Error(`${id} : ${r.status} ${(await r.text()).slice(0, 200)}`)
    writeFileSync(file, Buffer.from(await r.arrayBuffer()))
    console.log(id, 'ok')
  }
}
