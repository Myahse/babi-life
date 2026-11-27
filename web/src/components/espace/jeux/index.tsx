import type { ComponentType } from 'react'
import { Centrifugeuse } from './Centrifugeuse'
import { Piscine } from './Piscine'
import { Parabolique } from './Parabolique'
import { Survie } from './Survie'
import { ConcoursEcrit } from './ConcoursEcrit'

// L'espace's training games (backend game/espaceCarriere.go), each played as the action's game
// (components/defi/Action.tsx): the id of the drill → its game. The physical isn't here: it's the army's
// parcours (configs.ts, the course engine); the medical isn't played (backend: it checks the needs).

type Props = { id: string; onEnd: (score: number) => void }

export const ESPACE_JEUX: Record<string, ComponentType<Props>> = {
  'astrelia-concours-ecrit': ConcoursEcrit,
  'module-systemes': ConcoursEcrit,
  'selection-centrifugeuse': Centrifugeuse,
  'module-centrifugeuse': Centrifugeuse,
  'touriste-centrifugeuse': Centrifugeuse,
  'selection-piscine': Piscine,
  'module-piscine': Piscine,
  'module-parabolique': Parabolique,
  'selection-survie': Survie,
  'module-survie': Survie,
  'touriste-survie': Survie,
}

/** The training's own game for this action, if it has one. */
export function EspaceJeu({ id, onEnd }: Props) {
  const J = ESPACE_JEUX[id]
  return J ? <J id={id} onEnd={onEnd} /> : null
}
