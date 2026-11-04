import { t as tr } from '../lib/i18n'
import type { Game, Moment } from './game'

// The football's commentator (StreetMatch shows the line under the score): a
// voice with the street's words, a line for each big moment of the match,
// never the same twice in a row. The street (le foot de rue) has its own
// lines, the stadium its own, the rest shared.

type Kind = Moment['kind'] | 'kickoff' | 'end'
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
}

const last = new Map<Kind, Line>()

/** A line for this moment (null: nothing to say), with the name of who did it. */
export function commentFor(g: Game, kind: Kind, by?: number): string | null {
  const own = (g.street ? STREET : g.size === 11 ? STADIUM : null)?.[kind] ?? []
  const list = [...own, ...(LINES[kind] ?? [])]
  if (!list.length) return null
  let pick = list[Math.floor(Math.random() * list.length)]
  if (pick === last.get(kind) && list.length > 1) pick = list[(list.indexOf(pick) + 1) % list.length]
  last.set(kind, pick)
  return pick({ name: by !== undefined && g.ps[by] ? g.ps[by].name : '' })
}
