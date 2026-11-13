import type { Jeu } from './types'
import { JEUX_1 } from './configs/part1'
import { JEUX_2 } from './configs/part2'
import { JEUX_3 } from './configs/part3'
import { JEUX_HOME } from './configs/home'
import { JEUX_TASKS } from './configs/tasks'
import { JEUX_EVENEMENTS } from './configs/evenements'
import { JEUX_VILLES } from './configs/villes'
import { JEUX_VILLES2 } from './configs/villes2'
import { JEUX_VILLES3 } from './configs/villes3'
import { JEUX_PAPIERS } from './configs/papiers'
import { JEUX_ARMEE } from './configs/armee'
import { JEUX_ETUDES } from './configs/etudes'
import { fallbackFor } from './configs/fallback'

// The games' data, apart from their engines (index.tsx): what the menus and the défi's intro need
// (the title, how it's played) without loading the engines and their props, which come with the
// game itself, the first time one is played.

// Every action, its own game (the update « gestes-maison »): the one written for it (configs/, by its
// id; the work shift by the career, `work:<career>`; a street happening by its label), else one made
// from what it is (configs/fallback.ts).

export const JEUX: Record<string, Jeu> = { ...JEUX_1, ...JEUX_2, ...JEUX_3, ...JEUX_HOME, ...JEUX_TASKS, ...JEUX_EVENEMENTS, ...JEUX_VILLES, ...JEUX_VILLES2, ...JEUX_VILLES3, ...JEUX_PAPIERS, ...JEUX_ARMEE, ...JEUX_ETUDES }

/** The game of an action. */
export function jeuOf(act: { id: string; icon: string; label: string; variant?: string }, career?: string): Jeu {
  return (act.id === 'work' && career ? JEUX[`work:${career}`] : undefined) ?? (act.variant ? JEUX[`${act.id}:${act.variant}`] : undefined) ?? JEUX[act.id] ?? JEUX[`label:${act.label}`] ?? fallbackFor(act)
}
