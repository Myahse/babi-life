import { t as tr } from '../lib/i18n'
import type { Game, Moment } from './game'

// The matches' commentator (StreetMatch shows the line under the score): a
// voice with the street's words, a line for each big moment of the match,
// never the same twice in a row. Football: the street (le foot de rue) has its
// own lines, the stadium its own, the rest shared. Basketball has its own
// (the dunk, the three, the block, the free throws, the shot clock, the tip),
// the Palais des Sports and the quarter's court their own at the tip.

type Kind = Moment['kind'] | 'kickoff' | 'end' | 'half'
type Line = (v: { name: string }) => string

const LINES: Partial<Record<Kind, Line[]>> = {
  goal: [
    (v) => tr('BUUUT ! {name} ne pardonne pas !', v),
    (v) => tr('Et c’est au fond ! {name}, le tueur !', v),
    (v) => tr('Le filet a tremblé ! {name} !', v),
    (v) => tr('Quel but de {name} ! Le stade est debout !', v),
    (v) => tr('Gardien battu ! {name} fait parler la poudre !', v),
    (v) => tr('C’est gâté ! {name} a mis ça au fond !', v),
  ],
  save: [(v) => tr('Quel arrêt de {name} ! Il dit non !', v), (v) => tr('{name} sort le grand jeu !', v), (v) => tr('Arrêt décisif de {name}, c’est un mur !', v), (v) => tr('{name} était là ! Pas de passage !', v)],
  post: [(v) => tr('Sur le poteau ! Le montant tremble encore…', v), (v) => tr('Ohhh, la barre ! C’était pas loin !', v), (v) => tr('Le poteau sauve le gardien !', v)],
  tackle: [(v) => tr('Tacle propre de {name}.', v), (v) => tr('{name} récupère le ballon, bien joué.', v), (v) => tr('{name} coupe tout, rien ne passe !', v)],
  steal: [(v) => tr('Interception de {name} !', v), (v) => tr('{name} a lu la passe !', v)],
  foul: [(v) => tr('Coup de sifflet : faute de {name}.', v), (v) => tr('L’arbitre a vu, faute de {name}.', v), (v) => tr('{name} est arrivé en retard…', v)],
  card: [(v) => tr('Carton pour {name} ! L’arbitre ne rigole pas.', v), (v) => tr('{name} prend un carton, il doit se calmer.', v)],
  geste: [(v) => tr('{name} fait danser son défenseur !', v), (v) => tr('Regardez-moi ça ! {name} s’amuse !', v), (v) => tr('Le public adore {name} !', v), (v) => tr('Gestes techniques, c’est ivoirien ça !', v)],
  ankle: [(v) => tr('{name} l’a mis par terre !', v), (v) => tr('Le défenseur est assis ! {name} !', v)],
  gbe: [(v) => tr('Le Gbê ! {name} a frappé comme une mule !', v), (v) => tr('GBÊ ! Personne ne pouvait arrêter ça !', v)],
  half: [() => tr('C’est la mi-temps ! Les joueurs rentrent aux vestiaires.'), () => tr('Mi-temps ! On souffle un peu, et on change de côté.')],
  kickoff: [(v) => tr('C’est parti ! Que le meilleur gagne.', v), (v) => tr('Coup d’envoi ! Le public est chaud ce soir.', v), (v) => tr('Et c’est le coup d’envoi, on y va !', v)],
  end: [(v) => tr('C’est terminé ! Merci pour le spectacle.', v), (v) => tr('Coup de sifflet final !', v), (v) => tr('Fin du match, on rentre à la maison.', v)],
}
const STREET: Partial<Record<Kind, Line[]>> = {
  goal: [(v) => tr('BUUUT ! {name} a cassé les petites cages !', v), (v) => tr('Dans le fer ! {name}, le vrai ballon du quartier !', v), (v) => tr('Le quartier crie ! {name} !', v)],
  kickoff: [(v) => tr('Le match du quartier commence !', v), (v) => tr('Les gars sont prêts, ballon à terre !', v)],
  end: [(v) => tr('Fini ! Les perdants paient le sucré.', v), (v) => tr('C’est fini, on se retrouve demain au terrain.', v)],
}
const STADIUM: Partial<Record<Kind, Line[]>> = {
  goal: [(v) => tr('BUUUT ! Le Félix-Houphouët-Boigny explose ! {name} !', v), (v) => tr('Quel but de {name} ! Toute la tribune chante !', v)],
  kickoff: [(v) => tr('Coup d’envoi au stade ! Le public est venu en nombre.', v), (v) => tr('Les vingt-deux acteurs sont sur la pelouse, c’est parti !', v)],
  offside: [(v) => tr('Le drapeau se lève : {name} est hors-jeu !', v), (v) => tr('Hors-jeu ! {name} est parti trop tôt.', v), (v) => tr('La défense a bien monté, {name} est pris au piège du hors-jeu.', v)],
}

const BASKET: Partial<Record<Kind, Line[]>> = {
  dunk: [(v) => tr('{name} est monté, il a tout cassé ! Le cercle demande pardon !', v), (v) => tr('Sur la tête ! {name} l’a mis sur sa tête, c’est gâté !', v), (v) => tr('Wouyééé ! {name} a smashé, le Palais est debout !', v), (v) => tr('C’est lourd, c’est lourd ! {name} écrase tout !', v)],
  alley: [(v) => tr('Alley-oop ! La passe en l’air, {name} est allé la chercher là-haut !', v), (v) => tr('Quelle connexion ! {name} attrape et claque ça !', v)],
  gbe: [(v) => tr('Le Gbê de {name} ! Mes amis, il a volé depuis l’arc !', v), (v) => tr('Gbêêê ! {name} a plié le fer, on va changer le cercle !', v)],
  three: [(v) => tr('De loin… FICELLE ! {name} est en feu !', v), (v) => tr('{name} déclenche de loin… dedans ! Propre, net, sans bavure !', v), (v) => tr('Rien que le filet ! {name} a la main chaude aujourd’hui.', v)],
  basket: [(v) => tr('{name} marque, tranquille.', v), (v) => tr('Deux points pour {name}, doucement mais sûrement.', v), (v) => tr('{name} met ça dedans, on avance.', v)],
  block: [(v) => tr('CONTRÉ ! {name} dit : pas chez moi !', v), (v) => tr('Retour à l’envoyeur ! {name} a renvoyé ça au marché !', v), (v) => tr('{name} a fermé la porte, on ne passe pas !', v)],
  steal: [(v) => tr('{name} a pris la balle comme on prend un woro-woro au vol !', v), (v) => tr('Interception de {name} ! Il lisait le jeu comme le journal.', v), (v) => tr('Main baladeuse de {name}, ballon récupéré !', v)],
  ankle: [(v) => tr('Chevilles cassées ! {name} l’a assis par terre, on appelle le docteur !', v), (v) => tr('{name} l’a fait danser, le défenseur cherche encore ses chaussures !', v)],
  geste: [(v) => tr('{name} fait son show, le public aime ça !', v), (v) => tr('Regardez-moi ce dribble de {name}, c’est du travail d’artiste !', v)],
  miss: [(v) => tr('{name} tente… à côté.', v), (v) => tr('Ça tourne, ça ressort… pas pour {name}.', v), (v) => tr('Le fer a dit non à {name}.', v)],
  foul: [(v) => tr('Coup de sifflet : faute de {name}. L’arbitre a tout vu.', v), (v) => tr('Faute ! {name} a eu la main un peu lourde.', v)],
  ft: [(v) => tr('{name} sur la ligne des lancers francs. Silence dans la salle…', v), (v) => tr('Lancers francs pour {name}. Concentration maximale.', v)],
  clock: [() => tr('Les 24 secondes ! L’attaque a trop traîné, ballon perdu.')],
  jump: [(v) => tr('Entre-deux ! {name} saute le plus haut.', v), () => tr('Balle tenue, c’est la flèche qui décide.')],
  eight: [() => tr('Huit secondes ! Ils n’ont pas passé le milieu à temps.')],
  half: [() => tr('C’est la mi-temps au Palais ! Les joueurs vont au banc.')],
}
/** Basketball's first words: the tip at the Palais, the check at the top in the quarter, the old game's. */
const BASKET_OPEN = { full: () => tr('Bonsoir et bienvenue au Palais des Sports de Treichville ! L’entre-deux va être lancé.'), street: () => tr('Ça joue au quartier ! Le premier à 11, on check en haut.'), half: () => tr('Le match commence, ballon en haut de la raquette.') }

const last = new Map<Kind, Line>()

/** A line for this moment (null: nothing to say), with the name of who did it. */
export function commentFor(g: Game, kind: Kind, by?: number): string | null {
  if (g.sport === 'basket' && kind === 'kickoff') return (g.full ? BASKET_OPEN.full : g.street ? BASKET_OPEN.street : BASKET_OPEN.half)()
  if (g.sport === 'basket' && kind === 'end') return null
  const own = (g.sport === 'basket' ? null : g.street ? STREET : g.size === 11 ? STADIUM : null)?.[kind] ?? []
  const list = g.sport === 'basket' ? (BASKET[kind] ?? []) : [...own, ...(LINES[kind] ?? [])]
  if (!list.length) return null
  let pick = list[Math.floor(Math.random() * list.length)]
  if (pick === last.get(kind) && list.length > 1) pick = list[(list.indexOf(pick) + 1) % list.length]
  last.set(kind, pick)
  return pick({ name: by !== undefined && g.ps[by] ? g.ps[by].name : '' })
}
