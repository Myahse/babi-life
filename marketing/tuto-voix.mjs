// The tutorial (tuto.mjs, scripts/tuto.md): Awa's lines, one MP3 each in out/voix-tuto/, with Lea's
// voice on Eleven v4 (Awa's voice in the other films). A line already made is kept unless --force;
// then each line's length is measured (ffprobe) into out/voix-tuto/report.json, the film is timed on it.
//
//   node tuto-voix.mjs [--force] [ids,…]

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { OUT } from './shared.mjs'

/** Awa's lines, by episode (their ids are tuto.mjs's takes). */
export const LINES = {
  // Épisode 1 : commencer (étapes 1 à 3)
  'e1-hook': "[excited] Tu débutes dans Babi Laïf ? Suis-moi, je te montre tout... depuis zéro !",
  'e1-compte': "Étape un : sur lifeinbabi point com, tu appuies sur « Créer un compte ». Ton nom, ton e-mail, un mot de passe... et c'est bon !",
  'e1-perso': "Étape deux : ton perso. Fille ou garçon, ton teint, ta coiffure, ta tenue... [playful] Pas d'idée ? Le dé choisit pour toi !",
  'e1-naissance': "Étape trois : tu appuies sur « Naître »... [whispers] et là, ta famille est tirée au sort ! [excited] Gnambro, poignon ou laté : c'est le sort qui décide.",
  'e1-fin': "[playful] Et toi, tu es tombé dans quelle famille ? Dis-moi en commentaire ! Épisode deux : ta vie de tous les jours.",
}

const VOICE = 'KSyQzmsYhFbuOhqj1Xxv'
export const DIR = path.join(OUT, 'voix-tuto')

if (import.meta.url === `file://${process.argv[1]}`) {
  const KEY = process.env.ELEVENLABS_API_KEY
  if (!KEY) throw new Error('ELEVENLABS_API_KEY est nécessaire.')
  mkdirSync(DIR, { recursive: true })
  const only = process.argv.slice(2).find((a) => !a.startsWith('--'))?.split(',')
  const report = {}
  for (const [id, text] of Object.entries(LINES)) {
    const file = path.join(DIR, `${id}.mp3`)
    if ((!only || only.includes(id)) && (!existsSync(file) || process.argv.includes('--force'))) {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_v4', voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.7, use_speaker_boost: true, speed: 1.1 } }),
      })
      if (!r.ok) throw new Error(`${id} : ${r.status} ${(await r.text()).slice(0, 200)}`)
      writeFileSync(file, Buffer.from(await r.arrayBuffer()))
      console.log(id, 'ok')
    }
    if (existsSync(file)) report[id] = { dur: +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim() }
  }
  writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(report, null, 2))
  console.log(report)
}
