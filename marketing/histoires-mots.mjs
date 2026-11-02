// « Les histoires se racontent » (FILM=histoires): where to cut the four prologues heard in
// the film, and when each of their words is said. Each prologue (web/public/audio/histoires/)
// is transcribed by ElevenLabs (Scribe, with the time of every word), the transcript is lined
// up on the prologue's own text (the screen shows its true words: « Gbairai », not « béret »),
// and the excerpt runs from its first words to its last. Writes web/src/lab/histoiresMots.json,
// which histoires-son.py (the cuts) and lab/histoiresFilm.tsx (the words lit one by one) read.
//
//   ELEVENLABS_API_KEY=… node histoires-mots.mjs        (behind a proxy: NODE_USE_ENV_PROXY=1)

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { HERE } from './shared.mjs'

/** The excerpts: the story, the words it starts with, the word it ends on, and the words the voice doesn't say (it whispers instead of saying « à voix basse »). */
export const EXCERPTS = [
  { id: 'cour-hantee', first: 'Il se passe', last: 'louer.' },
  { id: 'dent-de-man', first: 'Boris', last: 'années.' },
  { id: 'kone-petit-fils', first: 'Son petit-fils', last: 'hauteur.' },
  { id: 'maquis-maudit', first: 'Un mot', last: 'maquis.', unsaid: 'à voix basse :' },
]

const KEY = process.env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEYS
if (!KEY) throw new Error('ELEVENLABS_API_KEY est nécessaire.')
const root = path.join(HERE, '..')
const prologues = Object.fromEntries(JSON.parse(execFileSync('go', ['run', './cmd/prologues'], { cwd: path.join(root, 'backend'), encoding: 'utf8' })).map((s) => [s.id, s.prologue]))
const norm = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const out = {}
for (const ex of EXCERPTS) {
  const fd = new FormData()
  fd.append('model_id', 'scribe_v1')
  fd.append('language_code', 'fra')
  fd.append('file', new Blob([readFileSync(path.join(root, 'web/public/audio/histoires', `${ex.id}.mp3`))], { type: 'audio/mpeg' }), `${ex.id}.mp3`)
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd })
  if (!r.ok) throw new Error(`${ex.id} : ${r.status} ${(await r.text()).slice(0, 200)}`)
  const heard = (await r.json()).words.filter((w) => w.type === 'word')
  // The prologue's words (punctuation kept on its word), from the excerpt's first words to its last.
  const text = prologues[ex.id]
  const words = []
  let open = ''
  for (const t of text.slice(text.toLowerCase().indexOf(ex.first.toLowerCase())).split(/\s+/)) {
    if (!norm(t)) {
      if (t === '«') open += '« '
      else if (words.length) words[words.length - 1] += ` ${t}`
      continue
    }
    words.push(open + t)
    open = ''
    if (norm(t) === norm(ex.last) && t.endsWith(ex.last.slice(-1))) break
  }
  if (ex.unsaid) {
    const i = words.findIndex((_, k) => words.slice(k).join(' ').startsWith(ex.unsaid))
    if (i >= 0) words.splice(i, ex.unsaid.split(' ').filter(norm).length)
  }
  words[0] = words[0][0].toUpperCase() + words[0].slice(1)
  // Line the two up (longest common run of words), then give every word of the text a time.
  const a = words.map(norm)
  const b = heard.map((w) => norm(w.text))
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const at = new Array(a.length).fill(null)
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) (at[i] = heard[j]), i++, j++
    else if (L[i + 1][j] >= L[i][j + 1]) i++
    else j++
  }
  // A word heard otherwise (« béret » for « Gbairai »): the time of the next word heard, a little before.
  for (let i = 0; i < a.length; i++) if (!at[i]) at[i] = { start: (at[i - 1]?.end ?? 0) + 0.05, end: (at[i - 1]?.end ?? 0) + 0.3, guessed: true }
  // (never before the word ahead of it)
  for (let i = 1; i < a.length; i++) if (at[i].start < at[i - 1].start) at[i] = { ...at[i], start: at[i - 1].start + 0.05 }
  const from = Math.max(0, at[0].start - 0.12)
  const to = at[a.length - 1].end + 0.3
  out[ex.id] = { from: +from.toFixed(2), to: +to.toFixed(2), words: words.map((w, i) => [w, +(at[i].start - from).toFixed(2)]) }
  console.log(`${ex.id} : ${from.toFixed(2)} – ${to.toFixed(2)} s, ${words.length} mots${at.some((x) => x.guessed) ? ' (certains devinés)' : ''}`)
}
writeFileSync(path.join(root, 'web/src/lab/histoiresMots.json'), JSON.stringify(out, null, 1) + '\n')
