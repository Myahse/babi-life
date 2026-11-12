import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// Les papiers (update « papiers », backend game/papiers.go): the desks' actions played. The card's file
// put together in the order the agent asks; the permis' test is the highway code's quiz (its score
// decides: 50 and over, the licence, backend sims/papiers.go papersPermis); the wedding's « oui ».

const cni: Jeu = {
  engine: 'assembler', title: t('Le dossier de la carte d’identité'), how: t('L’agent demande les pièces une à une : donne-les dans l’ordre, sans rien oublier.'), decor: 'bureau', base: 'dossier',
  parts: [{ name: t('Le formulaire rempli'), prop: 'cahier' }, { name: t('L’extrait de naissance'), prop: 'dossier' }, { name: t('Les photos'), prop: 'appareil-photo' }, { name: t('Le timbre'), prop: 'ticket' }, { name: t('Les frais'), prop: 'piece' }, { name: t('La signature'), prop: 'stylo' }],
}

export const JEUX_PAPIERS: Record<string, Jeu> = {
  'carte-identite-mairie': cni,
  'carte-identite-commissariat': cni,
  'permis-conduire': {
    engine: 'quiz', title: t('L’examen du code'), how: t('L’inspecteur pose ses questions sur la route : trois bonnes réponses au moins, et le permis est à toi.'), decor: 'bitume', host: 'agent',
    questions: [
      [t('Le feu passe à l’orange. Tu fais quoi ?'), [t('J’accélère pour passer'), t('Je m’arrête si je peux le faire sans danger'), t('Je klaxonne')], 1],
      [t('À moto, le casque, c’est ?'), [t('Obligatoire, pour le conducteur et le passager'), t('Seulement la nuit'), t('Seulement sur l’autoroute')], 0],
      [t('Un piéton s’engage sur le passage piéton.'), [t('Je le laisse traverser'), t('Je passe avant lui'), t('Je fais des appels de phares')], 0],
      [t('Au carrefour sans panneau, qui passe en premier ?'), [t('Le plus gros véhicule'), t('Celui qui vient de droite'), t('Celui qui klaxonne')], 1],
      [t('Avant de rouler, on attache ?'), [t('La ceinture de sécurité'), t('Le téléphone au volant'), t('Rien en ville')], 0],
      [t('Un gbaka s’arrête devant toi pour prendre des passagers.'), [t('Je le dépasse par le trottoir'), t('J’attends ou je le dépasse prudemment'), t('Je le pousse')], 1],
    ],
  },
  'se-marier': {
    engine: 'repondre', title: t('Le mariage à la mairie'), how: t('L’officier d’état civil mène la cérémonie : réponds comme il faut, devant toute la famille.'), decor: 'carrelage', npc: 'agent',
    lines: [
      [t('Mesdames, messieurs, bienvenue. Les futurs mariés sont là ?'), [t('Présents, monsieur l’officier !'), t('On est en retard, pardon'), t('Ça dépend')], 0],
      [t('Vos témoins ont apporté leurs papiers ?'), [t('Ils les ont oubliés'), t('Oui, leurs cartes d’identité sont là'), t('Pas besoin de témoins')], 1],
      [t('Voulez-vous prendre pour époux·se la personne ici présente ?'), [t('Je réfléchis encore'), t('Oui !'), t('Demande à ma maman')], 1],
      [t('Je vous déclare unis par les liens du mariage. Signez le registre.'), [t('Je signe, avec un grand sourire'), t('Je n’ai pas de stylo'), t('Plus tard')], 0],
    ],
  },
}
