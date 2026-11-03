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
  'mami-wata': {
    title: t('Le filet sur la lagune'),
    how: [
      t('Le soir tombe sur la lagune. Les plastiques flottent : bouteilles, sachets, tapettes. Les poissons remontent dessous.'),
      t('Dessine une boucle autour avec le doigt, comme un filet, et ferme-la : tout ce qui est dedans est repêché.'),
      t('Vingt plastiques avant la nuit. Un poisson pris, on le relâche… et ça coûte.'),
    ],
    bg: '#14303a',
    game: game(() => import('./MamiWata')),
  },
  'bac-fanta': {
    title: t('Réviser la philo'),
    how: [t('La veille du bac, le garba avalé : place à la philo. Les fiches de Fanta sont retournées.'), t('Retourne-les deux par deux : chaque philosophe a son idée cachée parmi elles. La bonne paire reste ouverte.'), t('Toutes les paires avant la fin du temps, en le moins de tours possible.')],
    bg: '#1a1b3a',
    game: game(() => import('./BacFanta')),
  },
  'roi-manette': {
    title: t('La combo de Seydou'),
    how: [t('Seydou te montre sa combo secrète : les boutons s’allument l’un après l’autre.'), t('Refais-la dans le même ordre. Chaque fois que c’est juste, il en rajoute un, et va plus vite.'), t('Une erreur et c’est fini. Jusqu’à 10 boutons pour la combo parfaite.')],
    bg: '#120c24',
    game: game(() => import('./RoiManette')),
  },
  'telephone-vole': {
    title: t('Repérer Kevin'),
    how: [
      t('La gare routière, la foule entre les gbakas. Le garçon au téléphone est quelque part là-dedans.'),
      t('Les coxers disent ce qu’ils ont vu, un détail à la fois : la casquette, le sac, le t-shirt, la taille.'),
      t('Touche-le dès que tu es sûr·e. Plus tu es rapide, mieux c’est ; te tromper coûte.'),
    ],
    bg: '#8a8f98',
    game: game(() => import('./TelephoneVole')),
  },
  'marathon-yao': {
    title: t('Au rythme de Pépé Yao'),
    how: [
      t('Deux tours de piste avec Pépé Yao, 72 ans, réglé comme une horloge.'),
      t('Pied gauche, pied droit (les deux moitiés de l’écran), chaque foulée sur son rythme : le tambour et le rond qui s’allume.'),
      t('Dans le rythme, tu le suis ou tu passes devant ; à côté, tu perds du terrain ; deux fois le même pied, tu trébuches. Et garde ton souffle.'),
    ],
    bg: '#2f9e44',
    game: game(() => import('./MarathonYao')),
  },
  'chat-grigri': {
    title: t('Trouver Grigri'),
    how: [
      t('Grigri a suivi l’odeur de l’alloco jusqu’au marché. Entre les paniers, des têtes sortent et rentrent : des chats du marché, des poules… et Grigri.'),
      t('Touche Grigri à chaque fois qu’il sort : gris, avec son collier rouge. Pas les autres, sinon les vendeuses te chassent et tu perds du temps.'),
      t('Dix fois Grigri avant qu’il file avec son poisson.'),
    ],
    bg: '#e8a15a',
    game: game(() => import('./ChatGrigri')),
  },
  'recette-ahou': {
    title: t('La sauce de Mémé Ahou'),
    how: [
      t('« Prouve-moi que tu as du goût. » Mémé Ahou te donne les assaisonnements un par un, chacun avec son trait sur la marmite.'),
      t('Garde le bouton appuyé pour verser, lâche pile sur le trait. Pas assez, c’est fade ; trop, c’est gâché.'),
      t('Cinq assaisonnements, et le regard de Mémé à la fin.'),
    ],
    bg: '#3d2414',
    game: game(() => import('./RecetteAhou')),
  },
  'grand-match': {
    title: t('Espionner l’équipe'),
    how: [
      t('L’équipe d’en face fait tourner le ballon, vite (et leur « petit » de deux mètres est dans le coup).'),
      t('Suis le ballon des yeux. Quand ça s’arrête, il est caché dans les pieds d’un joueur : touche celui qui l’a.'),
      t('Cinq actions, chaque fois plus longues et plus rapides, les joueurs bougent de plus en plus.'),
    ],
    bg: '#2b8a3e',
    game: game(() => import('./GrandMatch')),
  },
  'avion-gilbert': {
    title: t('Les bagages de Tonton'),
    how: [
      t('Le tapis à bagages des arrivées tourne avec les valises de tout le monde.'),
      t('La liste de Tata Odette : la grosse valise rouge au ruban jaune, le sac en wax, le carton ficelé « GILBERT ». Touche-les quand ils passent.'),
      t('Pas les valises des autres : leurs propriétaires crient ! Et à la fin… des petites valises roses ?'),
    ],
    bg: '#dee2e6',
    game: game(() => import('./AvionGilbert')),
  },
  brouteur: {
    title: t('Le vrai du faux'),
    how: [
      t('Jojo veut un vrai travail. Mais toutes les annonces ne sont pas vraies.'),
      t('Glisse à droite (ou « Vrai ») une vraie offre, à gauche (ou « Arnaque ») une arnaque : le salaire trop beau, l’argent à envoyer d’abord, le code demandé, le compte à prêter.'),
      t('Douze annonces. À chaque erreur, Jojo fronce les sourcils.'),
    ],
    bg: '#adb5bd',
    game: game(() => import('./Brouteur')),
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
