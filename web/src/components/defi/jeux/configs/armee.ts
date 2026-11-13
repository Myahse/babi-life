import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// L'armée (update « armee », backend game/armee.go): the service's drills at the caserne, the EMPT's
// concours and school year, the career's missions (task:armee:<id>) and its shift (work:armee). Each one
// played on the game's engines with its 3D blocks; a drill under 50 isn't passed (backend sims/armee.go).
// Ceremonial and humanitarian only: nothing is ever aimed at anyone.

const couleurs: Jeu = {
  engine: 'tenir', title: t('Le lever des couleurs'), how: t('Le clairon sonne : hisse le drapeau d’un geste régulier, et lâche pile dans le vert quand il touche le haut du mât.'), decor: 'terre', object: 'drapeau', verb: t('Hisse'), fill: 'force', times: 3,
}

export const JEUX_ARMEE: Record<string, Jeu> = {
  // The service militaire at the caserne
  'caserne-couleurs': couleurs,
  'caserne-parcours': {
    engine: 'course', title: t('Le parcours du combattant'), how: t('Cours, saute les murets de briques, ramasse les fanions du parcours : le chrono tourne.'), decor: 'terre', mode: 'pied', good: 'drapeau', bad: 'brique', target: 10,
  },
  'caserne-garde': {
    engine: 'photo', title: t('La garde de nuit'), how: t('À la guérite, la nuit : touche quand ce qui doit être signalé passe dans ta lampe.'), decor: 'terre', shots: 4,
    subjects: [{ name: t('Le portail resté ouvert'), prop: 'cle' }, { name: t('La lampe qui clignote'), prop: 'lampe' }, { name: t('Le colis oublié'), prop: 'colis' }, { name: t('La radio qui grésille'), prop: 'telephone' }],
  },
  'caserne-marche': {
    engine: 'equilibre', title: t('La marche, sac au dos'), how: t('Des kilomètres au pas, le sac bien calé : garde-le droit jusqu’au bout de la piste.'), decor: 'piste', carry: 'sac', verb: t('Marche'), distance: 14, stance: 'tete',
  },
  'caserne-ordinaire': {
    engine: 'assembler', title: t('Le plateau de l’ordinaire'), how: t('À la file de l’ordinaire : remplis ton plateau dans l’ordre du cuisinier.'), decor: 'comptoir', base: 'plateau-service',
    parts: [{ name: t('Le riz'), prop: 'riz' }, { name: t('La sauce'), prop: 'louche' }, { name: t('Le poisson'), prop: 'poisson' }, { name: t('Le pain'), prop: 'pain' }, { name: t('L’eau'), prop: 'sachet-eau' }],
  },
  'caserne-dortoir': {
    engine: 'nettoyer', title: t('Le lit au carré'), how: t('Avant de dormir, le lit au carré : lisse chaque pli du drap, l’adjudant passe.'), decor: 'parquet', object: 'linge', bit: 'poussiere', verb: t('Lisse'), count: 8,
  },

  // The EMPT: its concours, its school year
  'empt-concours-ecrit': {
    engine: 'quiz', title: t('Concours de l’EMPT : l’écrit'), how: t('Le jury pose ses questions : maths, sciences, culture. Il faut au moins la moitié pour réussir.'), decor: 'bureau', host: 'prof',
    questions: [
      [t('Combien font 12 × 8 ?'), ['86', '96', '108'], 1],
      [t('L’eau bout à quelle température, au niveau de la mer ?'), [t('100 °C'), t('50 °C'), t('0 °C')], 0],
      [t('Quelle est la capitale politique de la Côte d’Ivoire ?'), [t('Bouaké'), t('Abidjan'), t('Yamoussoukro')], 2],
      [t('Un rectangle de 6 m sur 4 m : son aire ?'), [t('20 m²'), t('24 m²'), t('10 m²')], 1],
      [t('La fête de l’Indépendance, c’est le ?'), [t('7 août'), t('1er mai'), t('25 décembre')], 0],
      [t('Un aimant attire ?'), [t('Le bois'), t('Le plastique'), t('Le fer')], 2],
    ],
  },
  'empt-concours-physique': {
    engine: 'course', title: t('Concours de l’EMPT : l’épreuve physique'), how: t('La course du concours : ramasse les plots du parcours, évite les flaques, ne t’arrête pas.'), decor: 'piste', mode: 'pied', good: 'chrono', bad: 'flaque', target: 10,
  },
  'empt-rassemblement': { ...couleurs, title: t('Le rassemblement du matin'), how: t('Toute l’école dans la cour : hisse les couleurs pile dans le vert, l’adjudant d’internat regarde.') },
  'empt-cours': {
    engine: 'quiz', title: t('Le cours de maths et de sciences'), how: t('Le professeur interroge la classe : réponds juste, et vite.'), decor: 'bureau', host: 'prof',
    questions: [
      [t('Combien font 3/4 de 200 ?'), ['150', '120', '175'], 0],
      [t('Un courant électrique se mesure en ?'), [t('Litres'), t('Ampères'), t('Kilos')], 1],
      [t('La racine carrée de 81 ?'), ['8', '7', '9'], 2],
      [t('Un triangle a combien d’angles ?'), ['3', '4', '5'], 0],
    ],
  },
  'empt-atelier': {
    engine: 'assembler', title: t('L’atelier technique'), how: t('Monte le circuit dans l’ordre du chef d’atelier : pas une pièce de travers.'), decor: 'etagere', base: 'carton',
    parts: [{ name: t('Le plan'), prop: 'cahier' }, { name: t('Les vis'), prop: 'piece' }, { name: t('Le marteau'), prop: 'marteau' }, { name: t('La lampe'), prop: 'lampe' }, { name: t('Le contrôle'), prop: 'calculatrice' }],
  },
  'empt-sport': {
    engine: 'course', title: t('Le sport sur le terrain'), how: t('Tours de terrain en section : ramasse les ballons, évite les cônes.'), decor: 'herbe', mode: 'pied', good: 'ballon-foot', bad: 'quille', target: 9,
  },
  'empt-refectoire': {
    engine: 'assembler', title: t('Le plateau du réfectoire'), how: t('Au réfectoire : remplis ton plateau dans l’ordre, sans faire attendre la file.'), decor: 'comptoir', base: 'plateau-service',
    parts: [{ name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('La banane'), prop: 'banane' }, { name: t('L’eau'), prop: 'sachet-eau' }],
  },
  'empt-dortoir': {
    engine: 'nettoyer', title: t('Le lit de l’internat'), how: t('Le lit fait au carré avant l’extinction des feux : lisse chaque pli.'), decor: 'parquet', object: 'linge', bit: 'poussiere', verb: t('Lisse'), count: 8,
  },

  // The career's missions (backend game/jobs.go « armee »)
  'task:armee:patrouille': {
    engine: 'photo', title: t('La patrouille du quartier'), how: t('Tu passes dans le quartier : repère ce qui a besoin d’aide quand ça passe dans ton cadre.'), decor: 'bitume',
    subjects: [{ name: t('L’enfant perdu'), prop: 'jouet' }, { name: t('Le câble tombé'), prop: 'lampe' }, { name: t('Le caniveau bouché'), prop: 'caniveau' }, { name: t('La vieille qui porte trop lourd'), prop: 'sac' }],
  },
  'task:armee:garde': {
    engine: 'choisir', title: t('La garde au camp'), how: t('Au portail, le chef de poste demande une pièce au visiteur : trouve-la vite.'), decor: 'bitume', caller: t('Le chef de poste'), rounds: 2,
    items: [{ name: t('Le badge'), prop: 'badge' }, { name: t('La pièce d’identité'), prop: 'passeport' }, { name: t('Le laissez-passer'), prop: 'ticket' }, { name: t('Le registre'), prop: 'cahier' }, { name: t('Le stylo'), prop: 'stylo' }],
  },
  'task:armee:defile': {
    engine: 'rythme', title: t('Le défilé du 7 août'), how: t('Au pas cadencé derrière la fanfare : tape pile sur la ligne, tous ensemble.'), decor: 'bitume', lanes: ['drapeau', 'tam-tam', 'sifflet'], notes: 14,
  },
  'task:armee:inondation': {
    engine: 'course', title: t('Après l’inondation'), how: t('En pirogue dans le quartier inondé : ramasse les colis de vivres, évite les débris.'), decor: 'eau', mode: 'pirogue', good: 'colis', bad: 'caillou', target: 8, rain: true,
  },
  'task:armee:instruction': {
    engine: 'repondre', title: t('Instruire les recrues'), how: t('Les recrues posent leurs questions : réponds comme un bon instructeur, ferme et juste.'), decor: 'terre', npc: 'ami',
    lines: [
      [t('Chef, on fait comment le lit au carré ?'), [t('Débrouille-toi.'), t('Drap tendu, coins pliés, je te montre une fois.'), t('Pas besoin de lit.')], 1],
      [t('J’ai raté le parcours, je suis nul…'), [t('Tu recommences demain, on travaille ensemble.'), t('Rentre chez toi.'), t('Oui, tu es nul.')], 0],
      [t('Pourquoi on se lève si tôt ?'), [t('Pour rien.'), t('Demande au capitaine.'), t('Pour être prêts quand on a besoin de nous.')], 2],
    ],
  },
  'task:armee:planifier': {
    engine: 'assembler', title: t('Planifier la mission de secours'), how: t('Monte le plan dans l’ordre : la carte, les camions, les vivres, la radio, le départ.'), decor: 'bureau', base: 'dossier',
    parts: [{ name: t('La carte'), prop: 'journal' }, { name: t('Les camions'), prop: 'voiture' }, { name: t('Les vivres'), prop: 'colis' }, { name: t('La radio'), prop: 'telephone' }, { name: t('L’heure du départ'), prop: 'chrono' }],
  },
  'work:armee': {
    engine: 'equilibre', title: t('La journée à la caserne'), how: t('Corvée de sacs de sable pour la digue : porte-les droit jusqu’au bout.'), decor: 'terre', carry: 'sac-ciment', verb: t('Porte'), distance: 12,
  },
}
