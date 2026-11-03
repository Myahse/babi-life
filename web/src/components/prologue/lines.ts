import type { Scenario } from './types'

// The prologues' lines: as written (without the voice's tags), their sound (public/audio/prologues/<id>/<n>.mp3,
// tools/voix/prologues.mjs), and the scripts themselves, loaded when one is opened.

/** A line as shown: no [tag] the voice reads. */
export const plain = (text: string) => text.replace(/\[[^\]]*\]\s*/g, '').trim()

/** The sound of a shot's line (nothing plays if it isn't recorded). */
export function lineAudio(id: string, shot: number) {
  if (typeof Audio === 'undefined') return null
  const a = new Audio(`/audio/prologues/${id}/${shot}.mp3`)
  a.preload = 'auto'
  return a
}

const SCRIPTS = import.meta.glob<{ default: Scenario }>('./scenarios/*.json')

/** The stories that have a prologue of their own. */
export const PROLOGUES = Object.keys(SCRIPTS).map((p) => p.replace(/^.*\/(.+)\.json$/, '$1'))

// The chapters' films (tools/prologues/chapitres.py): « <story>-c<n> » for the chapter n (0: the prologue's), « <story>-fin » for the end.
const CHAPTERS = import.meta.glob<{ default: Scenario }>('./scenarios/chapitres/*.json')
const FILMS = new Set([...PROLOGUES, ...Object.keys(CHAPTERS).map((p) => p.replace(/^.*\/(.+)\.json$/, '$1'))])

/** A story's film for its chapter (0: the prologue), or its end (« fin »). */
export const filmKey = (story: string, chapter: number | 'fin') => (chapter === 'fin' ? `${story}-fin` : chapter === 0 ? story : `${story}-c${chapter}`)

/** Whether that film is written. */
export const hasFilm = (key: string) => FILMS.has(key)

/** A story's prologue, a chapter's film or the end's, if written. */
export async function loadScenario(id: string): Promise<Scenario | null> {
  const load = SCRIPTS[`./scenarios/${id}.json`] ?? CHAPTERS[`./scenarios/chapitres/${id}.json`]
  return load ? (await load()).default : null
}
