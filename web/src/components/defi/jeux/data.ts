import type { Jeu } from './types'
import { JEUX_1 } from './configs/part1'
import { JEUX_2 } from './configs/part2'
import { JEUX_3 } from './configs/part3'
import { JEUX_HOME } from './configs/home'
import { JEUX_TASKS } from './configs/tasks'
import { JEUX_EVENEMENTS } from './configs/evenements'
import { fallbackFor } from './configs/fallback'

// The games' data, apart from their engines (index.tsx): what the menus and the défi's intro need
// (the title, how it's played) without loading the engines and their props, which come with the
// game itself, the first time one is played.

// Every action, its own game (the update « gestes-maison »): the one written for it (configs/, by its
// id; the work shift by the career, `work:<career>`; a street happening by its label), else one made
// from what it is (configs/fallback.ts).

export const JEUX: Record<string, Jeu> = { ...JEUX_1, ...JEUX_2, ...JEUX_3, ...JEUX_HOME, ...JEUX_TASKS, ...JEUX_EVENEMENTS }

/** The game of an action. */
export function jeuOf(act: { id: string; icon: string; label: string }, career?: string): Jeu {
  return (act.id === 'work' && career ? JEUX[`work:${career}`] : undefined) ?? JEUX[act.id] ?? JEUX[`label:${act.label}`] ?? fallbackFor(act)
}
