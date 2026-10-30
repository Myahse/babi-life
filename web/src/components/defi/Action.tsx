import { useState } from 'react'
import type { Look } from '../../lib/types'
import { GestesDefi, type GesteKind } from './Gestes'
import { JeuDefi, JEUX, jeuOf } from './jeux'
import { DoucheJeu } from './Douche'
import { ToilettesJeu } from './Toilettes'

// An action played (the update « gestes-maison »): first getting it ready, a few steps of arrows (the
// perso doing them in the house), then the action itself, its own game (jeux/). The score: the
// getting ready counts a little, the game most.

export function ActionDefi({ kind, act, career, look, gender, onEnd }: { kind: GesteKind | 'geste'; act?: { id: string; icon: string; label: string }; /** At work: the career (its own game). */ career?: string; look?: Look; gender?: 'femme' | 'homme'; onEnd: (score: number) => void }) {
  const [ready, setReady] = useState<number | null>(null)
  const jeu = kind === 'geste' ? (act ? jeuOf(act, career) : null) : JEUX[`home:${kind}`]
  // Nothing to play after (none written): the arrows are the action.
  if (!jeu) return <GestesDefi kind={kind} act={act} look={look} gender={gender} onEnd={onEnd} />
  if (ready === null) return <GestesDefi kind={kind} act={act} look={look} gender={gender} prep={kind === 'geste' ? 2 : 3} onEnd={setReady} />
  const end = (s: number) => onEnd(Math.round(ready * 0.3 + s * 0.7))
  // The shower: the perso itself, soaped and rinsed by the player (Douche.tsx).
  if (kind === 'douche') return <DoucheJeu look={look} gender={gender} onEnd={end} />
  // The toilet: seated, pushing, the flush, the hands washed (Toilettes.tsx).
  if (act?.id === 'toilettes') return <ToilettesJeu look={look} gender={gender} onEnd={end} />
  return <JeuDefi act={act ?? { id: kind, icon: '', label: '' }} jeu={jeu} me={look ? { look, gender: gender ?? 'homme' } : undefined} onEnd={end} />
}
