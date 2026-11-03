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

/** A story's prologue, if written. */
export async function loadScenario(id: string): Promise<Scenario | null> {
  const load = SCRIPTS[`./scenarios/${id}.json`]
  return load ? (await load()).default : null
}
