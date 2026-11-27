import type { Jeu } from '../../defi/jeux/types'
import { t } from '../../../lib/i18n'

// L'espace's training, as the action games see it (components/defi/jeux/data.ts): each drill's title and how
// it's played for the défi's card. The centrifuge, the pool, the parabolic flight, the sea survival and the
// written are played on their own games (./index.tsx ESPACE_JEUX, components/defi/Action.tsx); these configs
// are what's shown before (and a stand-in engine, never reached). The physical reuses the army's parcours.

const parcours: Jeu = {
  engine: 'course', title: t('L’épreuve physique d’Astrélia'), how: t('Le parcours du centre : cours, saute les haies, ramasse les fanions de l’agence, le chrono tourne.'), decor: 'piste', mode: 'pied', good: 'drapeau', bad: 'brique', target: 10,
}
const centri: Jeu = { engine: 'tenir', title: t('La centrifugeuse'), how: t('Garde les G dans la bande verte, palier après palier.'), decor: 'carrelage', object: 'chrono', verb: t('Accélère'), fill: 'force' }
const piscine: Jeu = { engine: 'tenir', title: t('La piscine, en flottabilité neutre'), how: t('Reste au niveau de la rampe et attrape chaque poignée de la maquette.'), decor: 'eau', object: 'bouee', verb: t('Palme'), fill: 'force' }
const survie: Jeu = { engine: 'tenir', title: t('La survie en mer'), how: t('La capsule a amerri : les gestes dans le bon ordre, avant l’arrivée du bateau.'), decor: 'eau', object: 'bouee', verb: t('Tiens'), fill: 'force' }
const ecrit: Jeu = { engine: 'quiz', title: t('Concours Astrélia : l’écrit'), how: t('Physique, maths, anglais : il faut la moitié pour réussir.'), decor: 'bureau', host: 'prof', questions: [] }

export const JEUX_ESPACE: Record<string, Jeu> = {
  'astrelia-concours-ecrit': ecrit,
  'selection-physique': parcours,
  'module-physique': { ...parcours, title: t('La préparation physique'), target: 12 },
  'selection-centrifugeuse': centri,
  'module-centrifugeuse': { ...centri, title: t('La centrifugeuse, jusqu’à 8 G') },
  'touriste-centrifugeuse': { ...centri, title: t('La centrifugeuse des voyageurs'), how: t('Jusqu’à 4 G, tranquillement : garde l’aiguille dans le vert.') },
  'selection-piscine': piscine,
  'module-piscine': { ...piscine, title: t('La sortie dans l’espace, en piscine') },
  'module-parabolique': { engine: 'tenir', title: t('Le vol parabolique'), how: t('Trois paraboles : en apesanteur, gobe les gouttes d’eau sans taper les coussins.'), decor: 'carrelage', object: 'goutte', verb: t('Flotte'), fill: 'force' },
  'selection-survie': survie,
  'module-survie': survie,
  'touriste-survie': { ...survie, title: t('Sortir de la capsule en mer'), how: t('Le gilet, l’écoutille, le radeau : dans l’ordre, avant la fin du temps.') },
  'module-systemes': { ...ecrit, title: t('Les systèmes de la Pirogue'), how: t('L’instructrice interroge la promotion sur la capsule.'), host: 'chef' },
}
