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
  'e1-fin': "[playful] Et toi, tu es tombé dans quelle famille ? Dis-moi en commentaire ! Épisode deux : tu grandis, de bébé à adulte.",
  // Épisode 2 : tu grandis (bébé, enfant, ado, adulte)
  'g-hook': "[excited] Épisode deux : tu grandis ! Bébé, enfant, ado... et adulte.",
  'g-bebe': "Tu commences bébé : c'est voulu ! Il a faim ? Biberon ! Sommeil ? Au berceau.",
  'g-coucou': "Et des petits jeux avec maman, comme coucou-caché ! [laughs]",
  'g-enfant': "Ça va vite : enfant, c'est l'école. Tu lèves la main... et tu réponds au maître !",
  'g-ado': "Ado, tu as ton premier téléphone : Gbairai, pour causer avec tes amis.",
  'g-adulte': "Et en moins d'une heure, tu as dix-huit ans ! [playful] Pressé ? La Boutique te fait grandir tout de suite.",
  'g-fin': "Épisode trois : ta vie de tous les jours ! Abonne-toi.",
  // Épisode 3 : ta vie de tous les jours (étape 4)
  'e2-hook': "[excited] Épisode trois : ta vie de tous les jours dans Babi Laïf !",
  'e2-besoins': "En bas, tes jauges : la faim, l'énergie, la propreté, les amis, l'amusement. [serious] Quand une jauge baisse... occupe-toi de toi !",
  'e2-marcher': "Pour marcher, le joystick. [playful] Pressé ? Appuie sur « Courir » ! C'est ta vraie commune, rue par rue.",
  'e2-maquis': "Tu as faim ? Direction le maquis ! Tu touches le plus... [happy] un bon garba, et la faim remonte.",
  'e2-dormir': "Le soir, fatiguée ? Rentre chez toi, le plus... et « Dormir ». [laughs] Bonne nuit !",
  'e2-fin': "Épisode quatre : ton premier boulot, et ton argent ! Abonne-toi pour ne rien rater.",
  // Épisode 4 : le boulot et l'argent (étape 5)
  'e3-hook': "[excited] Épisode quatre : le boulot... et l'argent !",
  'e3-boulot': "Étape cinq : dans ton téléphone, l'appli « Boulot ». Pas besoin de diplôme : tu choisis un métier, et tu commences en bas de l'échelle.",
  'e3-travail': "Moi, je suis DJ de quartier ! [excited] Le soir, je vais au club... et je fais mon service.",
  'e3-paie': "Ta paie tombe direct dans Waye : c'est ton argent, dans ton téléphone. [playful] Travaille bien, et tu montes en grade !",
  'e3-fin': "Épisode cinq : tous les jeux de Babi Laïf ! Abonne-toi.",
  // Épisode 5 : les jeux (étape 6)
  'e4-hook': "[excited] Épisode cinq : les jeux de Babi Laïf !",
  'e4-foot': "Étape six : les jeux ! Le foot à cinq : tu cours, tu passes, tu tires !",
  'e4-billard': "Le billard au maquis : tu vises, tu tires la queue... et tu lâches !",
  'e4-kart': "Le kart : [excited] à fond dans les virages !",
  'e4-combat': "Le combat de rue : poing, pied, garde... [laughs] protège ta tête !",
  'e4-cartes': "Et dans ton téléphone, l'appli « Jeux » : le huit américain, les dames, l'awalé... contre tes amis !",
  'e4-fin': "Épisode six : jouer avec tes amis ! Abonne-toi.",
  // Épisode 6 : les amis (étape 7)
  'e5-hook': "[excited] Épisode six : Babi Laïf, c'est mieux avec tes amis !",
  'e5-enligne': "Étape sept : en haut, le bouton des joueurs. Tu vois qui est en ligne, dans ta commune... et dans tout Babi.",
  'e5-saluer': "Tu croises quelqu'un dans la rue ? Tu le salues... [playful] et tu l'ajoutes en ami !",
  'e5-inviter': "Après, tu l'invites au maquis... et vous y allez ensemble.",
  'e5-live': "Et sur Tikitoko, tu lances ton live : [laughs] tout Babi te regarde !",
  'e5-fin': "Dernier épisode : voyager... et devenir debout ! Abonne-toi.",
  // Épisode 7 : voyager et réussir (étapes 8 et 9)
  'e6-hook': "[excited] Dernier épisode : on voyage... et on devient debout !",
  'e6-avion': "Étape huit : voyage ! L'avion pour Yamoussoukro... ou ta voiture pour San-Pédro !",
  'e6-plage': "La plage de Bassam, le soleil, les vagues...",
  'e6-safari': "Et le safari de la N'Zi en quatre-quatre : les éléphants, les buffles... [excited] c'est fort !",
  'e6-debout': "Étape neuf : ton but. Tu nais gnambro, poignon ou laté... et petit à petit, tu deviens debout !",
  'e6-fin': "Babi Laïf, c'est sur lifeinbabi point com. Crée ton perso... et on se voit dans le jeu !",
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
