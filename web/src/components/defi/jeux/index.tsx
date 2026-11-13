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
import { Piler } from './engines/Piler'
import { Griller } from './engines/Griller'
import { JeuMeProvider, type JeuMe } from './me'
import { JEUX, jeuOf } from './data'

// An action's game played on the engine it's made for (engines/); its data is in data.ts.

const ENGINES: { [E in Engine]: (p: EngineProps<E>) => ReactElement | null } = { choisir: Choisir, attraper: Attraper, nettoyer: Nettoyer, rythme: Rythme, tenir: Tenir, viser: Viser, course: Course, quiz: Quiz, photo: Photo, assembler: Assembler, equilibre: Equilibre, repondre: Repondre, piler: Piler, griller: Griller }

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

export { JEUX, jeuOf }
