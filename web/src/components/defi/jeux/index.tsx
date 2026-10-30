import type { ReactElement } from 'react'
import type { Engine, EngineProps, Jeu } from './types'
import { Choisir } from './engines/Choisir'
import { Attraper } from './engines/Attraper'
import { Nettoyer } from './engines/Nettoyer'
import { Rythme } from './engines/Rythme'
import { Tenir } from './engines/Tenir'
import { Viser } from './engines/Viser'
import { Course } from './engines/Course'
import { Quiz } from './engines/Quiz'
import { Photo } from './engines/Photo'
import { Assembler } from './engines/Assembler'
import { Equilibre } from './engines/Equilibre'
import { Repondre } from './engines/Repondre'
import { JEUX_1 } from './configs/part1'
import { JEUX_2 } from './configs/part2'
import { JEUX_3 } from './configs/part3'
import { JEUX_HOME } from './configs/home'
import { JEUX_TASKS } from './configs/tasks'
import { JEUX_EVENEMENTS } from './configs/evenements'
import { fallbackFor } from './configs/fallback'
import { JeuMeProvider, type JeuMe } from './me'

// Every action, its own game (the update « gestes-maison »): the one written for it (configs/, by its
// id; the work shift by the career, `work:<career>`; a street happening by its label), else one made
// from what it is (configs/fallback.ts). Played on the engine it's made for (engines/).

const JEUX: Record<string, Jeu> = { ...JEUX_1, ...JEUX_2, ...JEUX_3, ...JEUX_HOME, ...JEUX_TASKS, ...JEUX_EVENEMENTS }

const ENGINES: { [E in Engine]: (p: EngineProps<E>) => ReactElement | null } = { choisir: Choisir, attraper: Attraper, nettoyer: Nettoyer, rythme: Rythme, tenir: Tenir, viser: Viser, course: Course, quiz: Quiz, photo: Photo, assembler: Assembler, equilibre: Equilibre, repondre: Repondre }

/** The game of an action. */
export function jeuOf(act: { id: string; icon: string; label: string }, career?: string): Jeu {
  return (act.id === 'work' && career ? JEUX[`work:${career}`] : undefined) ?? JEUX[act.id] ?? JEUX[`label:${act.label}`] ?? fallbackFor(act)
}

/** An action played: its game, on its engine; the score sent when it's over. */
export function JeuDefi({ act, career, jeu, me, onEnd }: { act: { id: string; icon: string; label: string }; /** At work: the career (its own game). */ career?: string; /** A game given (the lab page). */ jeu?: Jeu; /** The player's Sim, to play it itself (the penalty, the free throws, the mic: me.tsx). */ me?: JeuMe; onEnd: (score: number) => void }) {
  const j = jeu ?? jeuOf(act, career)
  const E = ENGINES[j.engine] as (p: EngineProps<typeof j.engine>) => ReactElement | null
  return (
    <JeuMeProvider me={me}>
      <E jeu={j as never} onEnd={onEnd} />
    </JeuMeProvider>
  )
}

export { JEUX }
