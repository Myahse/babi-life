import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// Yamoussoukro's and Bouaké's actions (the updates « yakro-vivant », « bouake-vivant », backend
// game/villes.go), each its own little game. The basilica's visit, the crocodiles' feeding and the
// safari have games of their own (components/defi/Basilique.tsx, Caimans.tsx, Safari.tsx).
export const JEUX_VILLES: Record<string, Jeu> = {
  // Yamoussoukro
  'basilique-esplanade': {
    engine: 'photo', title: t('L’esplanade de la basilique'), how: t('Entre les colonnes, prends ce qu’on te demande en photo quand c’est bien dans le cadre.'), decor: 'carrelage',
    subjects: [{ name: t('La coupole'), prop: 'soleil' }, { name: t('La croix dorée'), prop: 'croix' }, { name: t('Une colonne'), prop: 'statue' }, { name: t('La fontaine'), prop: 'goutte' }, { name: t('Les pèlerins'), prop: 'chapelet' }],
  },
  'basilique-cierge': {
    engine: 'tenir', title: t('Le cierge sous la coupole'), how: t('Tiens la mèche au-dessus de la flamme, lâche quand elle prend, sans faire couler la cire.'), decor: 'carrelage', object: 'cierge', verb: t('Allume'), fill: 'chaleur', times: 3,
  },
  'mosquee-yakro-visite': {
    engine: 'quiz', title: t('La grande mosquée'), how: t('L’imam fait visiter, pieds nus sur les tapis : réponds à ses questions.'), decor: 'carrelage', host: 'imam',
    questions: [
      [t('Avant d’entrer dans la salle de prière, on fait quoi ?'), [t('On garde ses chaussures'), t('On enlève ses chaussures'), t('On court')], 1],
      [t('Combien de prières par jour pour un musulman ?'), [t('Cinq'), t('Deux'), t('Dix')], 0],
      [t('Le jour de la grande prière, c’est…'), [t('Le lundi'), t('Le vendredi'), t('Le dimanche')], 1],
      [t('Du haut du minaret, le muezzin…'), [t('Appelle à la prière'), t('Vend des beignets'), t('Surveille la circulation')], 0],
    ],
  },
  'caimans-repas': {
    engine: 'photo', title: t('Le repas des caïmans'), how: t('Le gardien lance le poulet : photographie le caïman qu’on te montre au moment où il ouvre la gueule.'), decor: 'eau',
    subjects: [{ name: t('Le gros caïman'), prop: 'crocodile' }, { name: t('Le gardien'), prop: 'casquette' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('Le héron'), prop: 'oiseau' }],
  },
  'lac-tour': {
    engine: 'course', title: t('Le tour des lacs du palais'), how: t('Marche au bord des lacs : ramasse les jolis coins à photographier, garde tes distances avec les caïmans.'), decor: 'herbe', mode: 'pied', good: 'appareil-photo', bad: 'crocodile',
  },
  'fondation-visite': {
    engine: 'quiz', title: t('La Fondation Félix-Houphouët-Boigny'), how: t('Le guide de la Fondation te fait visiter les salles de marbre : réponds à ses questions.'), decor: 'carrelage', host: 'guide',
    questions: [
      [t('La Fondation travaille pour…'), [t('La recherche de la paix'), t('Le football'), t('La pêche')], 0],
      [t('Yamoussoukro est la capitale…'), [t('Économique'), t('Politique'), t('Du cacao seulement')], 1],
      [t('Félix Houphouët-Boigny est né près de…'), [t('Yamoussoukro'), t('Korhogo'), t('San-Pédro')], 0],
      [t('Le grand monument de la ville, c’est…'), [t('La Tour F'), t('La Basilique Notre-Dame de la Paix'), t('Le pont HKB')], 1],
    ],
  },
  'fondation-conference': {
    engine: 'repondre', title: t('La conférence sur la paix'), how: t('Au micro, la conférencière te pose des questions : choisis la réponse qui va dans le sens de la paix.'), decor: 'scene', npc: 'prof',
    lines: [
      [t('Deux voisins se disputent une parcelle. Que faire ?'), [t('Chacun prend une machette.'), t('On s’assoit avec le chef et on parle.'), t('On laisse pourrir.')], 1],
      [t('Que veut dire « le dialogue » ?'), [t('Parler et écouter l’autre.'), t('Crier plus fort.'), t('Ne jamais répondre.')], 0],
      [t('Comment garder la paix au quartier ?'), [t('Chacun pour soi.'), t('Le respect et l’entraide.'), t('Les rumeurs.')], 1],
    ],
  },
  'resident-panorama': {
    engine: 'choisir', title: t('Le restaurant panoramique'), how: t('Tout en haut de la tour, le serveur annonce les plats : touche le bon avant la table d’à côté.'), decor: 'table', caller: t('Le serveur'),
    items: [{ name: t('Le capitaine braisé'), prop: 'poisson' }, { name: t('Le poulet kédjénou'), prop: 'poulet' }, { name: t('Le riz gras'), prop: 'riz' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le jus de bissap'), prop: 'jus' }, { name: t('La glace'), prop: 'glace' }],
  },
  'golf-parcours': {
    engine: 'viser', title: t('Le parcours de 9 trous'), how: t('Vise le drapeau, règle la force : la balle sur le green, le plus près du trou.'), decor: 'herbe', projectile: 'boule-petanque', target: 'drapeau', shots: 5,
  },
  'golf-practice': {
    engine: 'viser', title: t('Le practice'), how: t('Une balle après l’autre : vise la cible du practice.'), decor: 'herbe', projectile: 'boule-petanque', target: 'cible', shots: 6,
  },
  'golf-club-house': {
    engine: 'tenir', title: t('Le verre au club-house'), how: t('Verse la boisson fraîche, lâche avant que ça déborde.'), decor: 'comptoir', object: 'biere', verb: t('Verse'), fill: 'liquide',
  },
  'braise-kedjenou': {
    engine: 'choisir', title: t('Le kédjénou du Grand Braisé'), how: t('La tantie secoue la canari et sert : touche ce qu’elle annonce avant les autres clients.'), decor: 'table', caller: t('La tantie'),
    items: [{ name: t('Le poulet kédjénou'), prop: 'poulet' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le piment'), prop: 'piment' }, { name: t('La tomate'), prop: 'tomate' }, { name: t('L’oignon'), prop: 'oignon' }],
  },
  'braise-choukouya': {
    engine: 'choisir', title: t('Le choukouya entre amis'), how: t('Le braiseur coupe le mouton sur la planche : attrape le morceau qu’il annonce avant tes amis.'), decor: 'table', caller: t('Le braiseur'),
    items: [{ name: t('La brochette'), prop: 'brochette' }, { name: t('Le morceau grillé'), prop: 'poulet' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }, { name: t('Le pain'), prop: 'pain' }],
  },
  // Bouaké
  'marche-bouake-kita': {
    engine: 'choisir', title: t('Le pagne kita'), how: t('Le tisserand déplie ses pagnes tissés : touche celui que la cliente demande avant elle.'), decor: 'etal', caller: t('Le tisserand'),
    items: [{ name: t('Le kita jaune et vert'), prop: 'pagne' }, { name: t('Le kita rouge'), prop: 'tissu' }, { name: t('La bobine'), prop: 'bobine' }, { name: t('Le boubou'), prop: 'boubou' }, { name: t('Le sac tissé'), prop: 'sac' }],
  },
  'marche-bouake-igname': {
    engine: 'repondre', title: t('Les ignames du marché'), how: t('La vendeuse annonce son prix : marchande poliment, sans la vexer.'), decor: 'etal', npc: 'vendeuse',
    lines: [
      [t('Le tas de trois ignames, c’est 2 000.'), [t('Tantie, 1 200 et on est d’accord ?'), t('C’est du vol !'), t('Je prends à 2 500.')], 0],
      [t('1 200 ? Tu veux me tuer ? 1 700.'), [t('Laisse, je pars.'), t('On fait 1 500, je reviens demain.'), t('D’accord, 3 000.')], 1],
      [t('Bon, 1 500 pour toi. Tu veux le sachet ?'), [t('Oui, merci tantie, que Dieu te bénisse !'), t('Non, débrouille-toi.'), t('Donne gratuit.')], 0],
    ],
  },
  'jardin-animaux': {
    engine: 'photo', title: t('Le jardin aux animaux'), how: t('Fais le tour du jardin de l’hôtel : photographie l’animal demandé quand il passe dans le cadre.'), decor: 'herbe',
    subjects: [{ name: t('La tortue'), prop: 'tortue' }, { name: t('Le singe'), prop: 'singe' }, { name: t('Le paon'), prop: 'oiseau' }, { name: t('Le crocodile de la mare'), prop: 'crocodile' }, { name: t('Le perroquet'), prop: 'perroquet' }],
  },
  'nourrir-autruches': {
    engine: 'viser', title: t('Les autruches'), how: t('Lance le grain dans la mangeoire, par-dessus la barrière : les autruches tendent le cou.'), decor: 'sable', projectile: 'riz', target: 'oiseau', shots: 5,
  },
  'lodge-terrasse': {
    engine: 'choisir', title: t('Le dîner sur la terrasse'), how: t('Face à la rivière, le serveur annonce les plats : touche le bon avant la table voisine.'), decor: 'table', caller: t('Le serveur du lodge'),
    items: [{ name: t('Le poisson de la rivière'), prop: 'poisson' }, { name: t('Le foutou'), prop: 'foutou' }, { name: t('L’alloco'), prop: 'alloco' }, { name: t('La mangue'), prop: 'mangue' }, { name: t('Le jus'), prop: 'jus' }],
  },
  'lodge-feu': {
    engine: 'repondre', title: t('Autour du feu'), how: t('Le pisteur raconte la savane : réponds-lui comme il faut.'), decor: 'terre', npc: 'guide',
    lines: [
      [t('Un éléphant secoue les oreilles vers toi. Tu fais quoi ?'), [t('Je cours vers lui.'), t('Je recule doucement, sans bruit.'), t('Je crie.')], 1],
      [t('Le buffle, c’est l’animal le plus…'), [t('Dangereux de la savane.'), t('Petit.'), t('Lent.')], 0],
      [t('Pourquoi on ne nourrit pas les singes ?'), [t('Ils deviennent agressifs.'), t('Ils n’ont pas faim.'), t('Ils sont végétariens.')], 0],
    ],
  },
  'nzi-pirogue': {
    engine: 'course', title: t('La N’Zi en pirogue'), how: t('Pagaie entre les bancs de sable : attrape les beaux coins, évite les hippopotames et les caïmans.'), decor: 'eau', mode: 'pirogue', good: 'poisson-vivant', bad: 'crocodile',
  },
  'nzi-oiseaux': {
    engine: 'photo', title: t('Les oiseaux de la N’Zi'), how: t('Aux jumelles, au bord de l’eau : photographie l’oiseau qu’on te nomme.'), decor: 'herbe',
    subjects: [{ name: t('Le héron'), prop: 'oiseau' }, { name: t('Le calao'), prop: 'perroquet' }, { name: t('Le martin-pêcheur'), prop: 'oiseau' }, { name: t('Le papillon'), prop: 'papillon' }],
  },
  'allocodrome-alloco': {
    engine: 'attraper', title: t('L’allocodrome'), how: t('La vendeuse fait sauter l’alloco : glisse l’assiette dessous, laisse tomber ce qui est brûlé.'), decor: 'table', from: 'poele', into: 'assiette',
    good: [{ name: t('L’alloco'), prop: 'alloco' }, { name: t('Le poisson'), prop: 'poisson' }], bad: [{ name: t('Le brûlé'), prop: 'caillou' }], count: 14,
  },
  'airfrance-zouglou': {
    engine: 'rythme', title: t('Le zouglou d’Air France'), how: t('L’orchestre joue : tape en rythme sur le djembé, le micro et l’enceinte.'), decor: 'scene', lanes: ['djembe', 'micro', 'enceinte'],
  },
}
