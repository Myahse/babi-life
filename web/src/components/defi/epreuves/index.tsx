import { Suspense, lazy, type ComponentType } from 'react'
import { t } from '../../../lib/i18n'

// Les épreuves (backend game/epreuves.go): each story's game of its own, seen nowhere else, played at
// its key moment (« epreuve-<story> », the défi « epreuve » in Defi.tsx). Each in its own file, loaded
// when it's played.

type Game = ComponentType<{ onEnd: (score: number) => void }>
export type EpreuveInfo = { title: string; how: string[]; bg: string; game: Game }

const game = (load: () => Promise<{ default: Game }>) => lazy(load)

export const EPREUVES: Record<string, EpreuveInfo> = {
  'cour-hantee': {
    title: t('La lampe torche'),
    how: [
      t('La nuit, dans la cour. Quelque chose marche sur le toit de tôle : écoute de quel côté, regarde où tombe la poussière.'),
      t('Promène le doigt pour éclairer le toit. Garde la lumière dessus un instant : vu !'),
      t('Six apparitions avant que la pile lâche. Mais au fait… c’est quoi, ce fantôme ?'),
    ],
    bg: '#0b0d1c',
    game: game(() => import('./CourHantee')),
  },
  chimpanze: {
    title: t('Coincer Zézé'),
    how: [
      t('Zézé est dans la boutique, au milieu des sucreries. Chaque fois que tu poses un carton (touche une case), il saute d’une case vers la sortie.'),
      t('Enferme-le avec les cartons avant qu’il atteigne le bord : il est malin, il prend toujours le chemin le plus court.'),
      t('Moins tu utilises de cartons, mieux c’est.'),
    ],
    bg: '#5c3a21',
    game: game(() => import('./Chimpanze')),
  },
  'toile-korhogo': {
    title: t('La fausse toile'),
    how: [
      t('La vraie toile de Korhogo, et la copie qu’on veut te vendre au même prix. Le copieur est allé trop vite.'),
      t('Trouve ses 5 erreurs : un animal oublié, un autre à l’envers, la mauvaise encre, des taches en trop, la bordure cassée. Touche-les sur l’une ou l’autre.'),
      t('Attention : toucher au hasard fait perdre du temps.'),
    ],
    bg: '#6b4423',
    game: game(() => import('./ToileKorhogo')),
  },
  'voix-bouake': {
    title: t('La voix de Bouaké'),
    how: [
      t('Le concert, la foule, la nuit. Quelque part, la chanteuse fredonne. Monte le son !'),
      t('Ton doigt est ton oreille : plus il est près d’elle, plus sa voix est forte (et la jauge se remplit). Lâche le doigt sur elle.'),
      t('Trois fois : elle se faufile ailleurs dans la foule. Se tromper coûte des secondes.'),
    ],
    bg: '#141033',
    game: game(() => import('./VoixBouake')),
  },
  'dent-de-man': {
    title: t('La Dent de Man'),
    how: [
      t('Le pari de Boris : le dernier bout de la montée, la paroi jusqu’au sommet.'),
      t('Touche la prise suivante (une ou deux rangées plus haut). Les grises tiennent, les brunes fissurées s’effritent. Le souffle baisse : les corniches le rendent.'),
      t('Quand le vent souffle, garde le doigt sur l’écran jusqu’à ce qu’il tombe, sinon il te décroche.'),
    ],
    bg: '#9fd3ff',
    game: game(() => import('./DentDeMan')),
  },
}

/** A story's épreuve from its interaction (« epreuve-<story> »). */
export const epreuveOf = (interactionId?: string) => (interactionId?.startsWith('epreuve-') ? EPREUVES[interactionId.slice(8)] : undefined)

/** The épreuve played. */
export function EpreuveDefi({ interactionId, onEnd }: { interactionId?: string; onEnd: (score: number) => void }) {
  const e = epreuveOf(interactionId)
  if (!e) return null
  const G = e.game
  return (
    <Suspense fallback={null}>
      <G onEnd={onEnd} />
    </Suspense>
  )
}
