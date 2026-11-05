import { Suspense, lazy, useRef, useState, type ComponentType } from 'react'
import { Countdown, FxLayer } from './kit'
import { weakDevice } from '../../../lib/device'
import type { Corner } from './Avatar'
import { JeuMeProvider, type JeuMe } from '../jeux/me'

const Avatar = lazy(() => import('./Avatar'))
import { t } from '../../../lib/i18n'

// Les épreuves (backend game/epreuves.go): each story's game of its own, seen nowhere else, played at
// its key moment (« epreuve-<story> », the défi « epreuve » in Defi.tsx). Each in its own file, loaded
// when it's played.

type Game = ComponentType<{ onEnd: (score: number) => void }>
export type EpreuveInfo = { title: string; how: string[]; bg: string; game: Game; /** Where the player's avatar stands (Avatar.tsx), or none where the game fills the screen. */ avatar?: Corner | false }

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
    avatar: false,
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
    avatar: false,
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
    avatar: false,
    game: game(() => import('./BacFanta')),
  },
  'roi-manette': {
    title: t('La combo de Seydou'),
    how: [t('Seydou te montre sa combo secrète : les boutons s’allument l’un après l’autre.'), t('Refais-la dans le même ordre. Chaque fois que c’est juste, il en rajoute un, et va plus vite.'), t('Une erreur et c’est fini. Jusqu’à 10 boutons pour la combo parfaite.')],
    bg: '#120c24',
    avatar: 'bl',
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
    avatar: 'tr',
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
    avatar: 'tr',
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
  'kone-petit-fils': {
    title: t('Le dégradé'),
    how: [t('Chez le barbier, pour être « tout propre » devant le petit-fils du vieux Koné.'), t('Pars du rond vert et suis le trait de craie avec la tondeuse, sans t’en écarter : sinon c’est un trou dans les cheveux.'), t('Trois passages : la nuque, le côté, la tempe.')],
    bg: '#f1e4d0',
    // (It's your own Sim in the barber's chair.)
    avatar: false,
    game: game(() => import('./KonePetitFils')),
  },
  'bintou-maquis': {
    title: t('Le service de l’ouverture'),
    how: [t('Le jour de l’ouverture, toutes les tables sont pleines, et tu aides Tantie Bintou.'), t('Chaque table montre sa commande. Glisse le plat du comptoir (en bas) jusqu’à la table, ou touche le plat puis la table.'), t('Le mauvais plat, ou une table qui attend trop, et les clients râlent. Sers-en le plus possible.')],
    bg: '#3b0f0f',
    // (Your Sim is in the maquis, at the counter.)
    avatar: false,
    game: game(() => import('./BintouMaquis')),
  },
  'serge-fatou': {
    title: t('Marchander les pagnes'),
    how: [
      t('Les pagnes de la dot, et les tanties du marché qui font toujours le prix fort à Serge.'),
      t('Fais ton offre avec le curseur. Trop bas, elle se vexe (« Tchrrr ! ») ; pas loin, elle descend ; à son prix, c’est vendu.'),
      t('Trois pagnes, trois offres chacun. Moins tu paies, mieux c’est, mais ne la vexe pas trois fois.'),
    ],
    bg: '#f4a259',
    game: game(() => import('./SergeFatou')),
  },
  'maquis-maudit': {
    title: t('Le braisé de Tantie'),
    how: [t('Le poisson frais de Tantie Bintou, « garanti sans sort », sur la grille.'), t('Quand une face est dorée (le cercle jaune), touche pour retourner ; quand l’autre est dorée, touche pour servir.'), t('Brûlé, il part à la poubelle… et la rumeur du sort revient.')],
    bg: '#2b1a12',
    game: game(() => import('./MaquisMaudit')),
  },
  caimans: {
    title: t('Les mots justes'),
    how: [
      t('Au maquis, devant témoins, Tonton Kouassi retrouve l’oncle qui garde la bague depuis vingt ans.'),
      t('L’oncle parle quatre fois ; choisis chaque fois la réponse : celle qui l’apaise, celle qui le laisse froid, celle qui le blesse.'),
      t('Son visage te dit où il en est. Amène-le à ouvrir son cœur.'),
    ],
    bg: '#1f140c',
    game: game(() => import('./Caimans')),
  },
  'mariage-attache': {
    title: t('La danse de la fête'),
    how: [t('La fête au maquis : le pagne rapporté de Man, la tante Akoua en larmes, le DJ qui lance le coupé-décalé.'), t('Les pas montent dans les quatre couloirs : touche le bon bouton quand le pas arrive sur la ligne.'), t('« Parfait », « Bien » ou raté ; le combo fait danser la foule.')],
    bg: '#1b1035',
    avatar: false,
    game: game(() => import('./MariageAttache')),
  },
  'revenant-port': {
    title: t('Les bougies pour Daniel'),
    how: [
      t('Au lieu de culte, les bougies allumées pour Daniel. Le vent de la mer entre par les portes.'),
      t('Une bougie tremble (le tourbillon la montre), puis la rafale : garde le doigt dessus pour la protéger.'),
      t('Éteinte, touche-la pour la rallumer avec une allumette. Garde-les allumées le plus longtemps possible.'),
    ],
    bg: '#15131f',
    game: game(() => import('./RevenantPort')),
  },
  'cacao-daloa': {
    title: t('Juste ou truqué'),
    how: [t('Au maquis de Daloa, les planteurs montrent ce que le pisteur a pesé.'), t('Lis l’aiguille de la balance toi-même, puis compare avec le carnet du pisteur.'), t('« Juste » s’il a écrit le bon poids, « Truqué ! » s’il a écrit moins. Dix sacs.')],
    bg: '#3b2a1a',
    game: game(() => import('./CacaoDaloa')),
  },
  'pretendant-accra': {
    title: t('Le vrai kente'),
    how: [t('Au marché, ce que vaut un vrai kente, et comment le reconnaître : les bandes tissées main répètent leurs blocs dans un ordre strict.'), t('Chaque bande a un bloc qui manque : choisis celui que le tisserand aurait mis.'), t('Huit bandes, des motifs de plus en plus longs.')],
    bg: '#f2b705',
    game: game(() => import('./PretendantAccra')),
  },
  'partir-rester': {
    title: t('La grue du port'),
    how: [t('Les premiers jours d’Ange-Michel au port de San-Pédro, dans la cabine de la grue.'), t('Le conteneur se balance : touche pour le lâcher sur la pile. Ce qui dépasse tombe à l’eau, et la pile rétrécit.'), t('Dix conteneurs sur le navire, le plus droit possible.')],
    bg: '#74c0fc',
    // (The crane runs along the top.)
    avatar: 'bl',
    game: game(() => import('./PartirRester')),
  },
}

/** A story's épreuve from its interaction (« epreuve-<story> »). */
export const epreuveOf = (interactionId?: string) => (interactionId?.startsWith('epreuve-') ? EPREUVES[interactionId.slice(8)] : undefined)

/** The épreuve played. */
export function EpreuveDefi({ interactionId, me, onEnd }: { interactionId?: string; /** The player's Sim: its avatar plays along. */ me?: JeuMe; onEnd: (score: number) => void }) {
  const e = epreuveOf(interactionId)
  const [go, setGo] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  if (!e) return null
  const G = e.game
  // The game under (shaken by the effects), the effects over it, the countdown first.
  return (
    <JeuMeProvider me={me}>
      <div className="absolute inset-0 overflow-hidden" style={{ background: e.bg }}>
        <div ref={box} className="absolute inset-0">
          <Suspense fallback={null}>{go && <G onEnd={onEnd} />}</Suspense>
        </div>
        <FxLayer target={box} />
        {go && e.avatar !== false && !weakDevice && (
          <Suspense fallback={null}>
            <Avatar corner={e.avatar ?? 'tl'} />
          </Suspense>
        )}
        {!go && <Countdown onDone={() => setGo(true)} />}
      </div>
    </JeuMeProvider>
  )
}
