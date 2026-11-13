import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// Le parcours d'études (update « parcours-etudes », backend game/etudes.go): the lycée's day played (the
// class, the récré, the cantine, the internat's étude, night and 5:30 wake-up), the BEPC and the bac by
// série, and the university's partiels by filière (`partiel:<filière>`, the activity's variant: data.ts
// jeuOf). The exams' score is their mark (backend ExamNote: score / 5, the school's bonus added).

const quiz = (title: string, how: string, questions: [string, string[], number][]): Jeu => ({ engine: 'quiz', title, how, decor: 'bureau', host: 'prof', questions })
const partiel = (what: string, questions: [string, string[], number][]) => quiz(t('Le partiel : {0}', { 0: what }), t('La salle d’examen, une copie, un sujet : réponds juste. Il faut 10/20 pour valider le semestre.'), questions)

export const JEUX_ETUDES: Record<string, Jeu> = {
  'cours-lycee': {
    engine: 'quiz', title: t('Le cours au lycée'), how: t('Le prof interroge la classe : lève la main avec la bonne réponse.'), decor: 'scene', host: 'prof',
    questions: [
      [t('Combien de côtés a un hexagone ?'), ['5', '6', '8'], 1],
      [t('Le passé simple de « il voit » ?'), [t('Il vit'), t('Il voyait'), t('Il verra')], 0],
      [t('Le fleuve qui donne son nom au lac de Kossou ?'), [t('Le Niger'), t('Le Bandama'), t('Le Congo')], 1],
      [t('En anglais, « mercredi » se dit…'), ['Wednesday', 'Thursday', 'Tuesday'], 0],
    ],
  },
  'recre-lycee': {
    engine: 'repondre', title: t('La récré'), how: t('Dans la cour, les copains t’attendent sous le manguier : réponds comme il faut.'), decor: 'terre', npc: 'ami',
    lines: [
      [t('Eh, tu as fini l’exercice de maths ?'), [t('Oui, viens je t’explique'), t('Laisse-moi tranquille'), t('Copie sur un autre')], 0],
      [t('On partage le pain-beurre ?'), [t('Non, c’est à moi'), t('Bien sûr, prends la moitié'), t('Achète le tien')], 1],
      [t('La cloche sonne déjà !'), [t('On reste encore un peu'), t('On se cache'), t('Vite, en rang !')], 2],
    ],
  },
  'cantine-lycee': {
    engine: 'choisir', title: t('La file de la cantine'), how: t('La dame de la cantine appelle les plats : prends le tien avant les autres plateaux.'), decor: 'comptoir', caller: t('La dame de la cantine'),
    items: [{ name: t('Le riz'), prop: 'riz' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le poisson'), prop: 'poisson' }, { name: t('Le pain'), prop: 'pain' }, { name: t('La banane'), prop: 'banane' }],
  },
  'etude-du-soir': {
    engine: 'tenir', title: t('L’étude du soir'), how: t('Le surveillant passe dans les rangs : garde ta concentration sur la leçon, relâche quand c’est rentré.'), decor: 'bureau', object: 'livre', verb: t('Révise'), fill: 'force', times: 4,
  },
  'dortoir-internat': {
    engine: 'tenir', title: t('La nuit au dortoir'), how: t('Les lits superposés grincent, un camarade ronfle : trouve le sommeil, relâche au bon moment.'), decor: 'parquet', object: 'coussin', verb: t('Endors-toi'), fill: 'force', times: 3,
  },
  'reveil-internat': {
    engine: 'assembler', title: t('Le réveil de 5 h 30'), how: t('La cloche ! Toilette au seau, l’uniforme, le cahier : prépare-toi dans l’ordre avant le rassemblement.'), decor: 'carrelage', base: 'seau',
    parts: [{ name: t('Le savon'), prop: 'savon' }, { name: t('L’éponge'), prop: 'eponge' }, { name: t('La serviette'), prop: 'serviette' }, { name: t('L’uniforme'), prop: 'chemise' }, { name: t('Le cahier'), prop: 'cahier' }],
  },

  // The exams.
  'examen-bepc': quiz(t('Le BEPC'), t('L’épreuve du BEPC : une question par matière. Il faut 10/20 (tes notes de l’année t’aident un peu).'), [
    [t('Combien font 7 × 8 ?'), ['54', '56', '64'], 1],
    [t('Le participe passé de « prendre » ?'), [t('Prendu'), t('Pris'), t('Prit')], 1],
    [t('La capitale politique de la Côte d’Ivoire ?'), ['Abidjan', 'Bouaké', 'Yamoussoukro'], 2],
    [t('L’eau pure bout à quelle température, au niveau de la mer ?'), ['50 °C', '100 °C', '150 °C'], 1],
    [t('Combien font (−3) × (−4) ?'), ['−12', '7', '12'], 2],
    [t('En anglais, « je suis élève » se dit…'), ['I am a pupil', 'I have a pupil', 'I is a pupil'], 0],
  ]),
  'bac-serie-a': quiz(t('Le bac, série A'), t('Lettres, philosophie, histoire : le sujet de la série A. Il faut 10/20.'), [
    [t('Qui a écrit « Les Soleils des indépendances » ?'), ['Ahmadou Kourouma', 'Bernard Dadié', 'Camara Laye'], 0],
    [t('« Je pense, donc je suis » est de…'), [t('Platon'), t('Descartes'), t('Sartre')], 1],
    [t('Une figure de style qui exagère, c’est…'), [t('La litote'), t('L’hyperbole'), t('La métonymie')], 1],
    [t('Bernard Dadié a écrit…'), ['« L’Enfant noir »', '« Une si longue lettre »', '« Climbié »'], 2],
    [t('L’indépendance de la Côte d’Ivoire est proclamée le…'), [t('7 août 1960'), t('1er mai 1958'), t('4 avril 1960')], 0],
  ]),
  'bac-serie-c': quiz(t('Le bac, série C'), t('Mathématiques et physique : le sujet de la série C. Il faut 10/20.'), [
    [t('La dérivée de x² ?'), ['x', '2x', 'x³/3'], 1],
    [t('Une valeur approchée de π ?'), ['2,71', '1,41', '3,14'], 2],
    [t('L’unité de la force ?'), [t('Le joule'), t('Le newton'), t('Le watt')], 1],
    [t('sin²x + cos²x = ?'), ['0', '1', '2'], 1],
    [t('La vitesse de la lumière dans le vide, environ…'), ['300 000 km/s', '300 km/s', '3 000 km/h'], 0],
  ]),
  'bac-serie-d': quiz(t('Le bac, série D'), t('Sciences de la vie, chimie, maths : le sujet de la série D. Il faut 10/20.'), [
    [t('L’organite qui fournit l’énergie de la cellule ?'), [t('Le noyau'), t('La mitochondrie'), t('Le ribosome')], 1],
    [t('Le paludisme est transmis par…'), [t('La mouche tsé-tsé'), t('Le moustique anophèle'), t('L’eau du robinet')], 1],
    [t('La formule chimique de l’eau ?'), ['CO₂', 'O₂', 'H₂O'], 2],
    [t('La photosynthèse rejette…'), [t('Du dioxygène'), t('Du méthane'), t('De l’azote')], 0],
    [t('Le support de l’information génétique ?'), [t('L’insuline'), t('L’ADN'), t('Le glucose')], 1],
  ]),

  // The partiels, by filière.
  'partiel:droit': partiel(t('droit'), [
    [t('La règle la plus haute de l’État, c’est…'), [t('Le décret'), t('La Constitution'), t('L’arrêté municipal')], 1],
    [t('Un contrat se forme par…'), [t('L’accord des volontés'), t('Un tampon'), t('Un témoin seulement')], 0],
    [t('« Nul n’est censé ignorer… »'), [t('son voisin'), t('le prix'), t('la loi')], 2],
    [t('Une personne poursuivie est présumée…'), [t('Coupable'), t('Innocente'), t('Absente')], 1],
    [t('La plus haute juridiction de l’ordre judiciaire ?'), [t('La Cour de cassation'), t('Le tribunal de commerce'), t('La mairie')], 0],
  ]),
  'partiel:lettres': partiel(t('lettres'), [
    [t('Un alexandrin compte…'), [t('10 syllabes'), t('12 syllabes'), t('8 syllabes')], 1],
    [t('« Le Cid » est de…'), [t('Molière'), t('Corneille'), t('Racine')], 1],
    [t('Le contraire de « prolixe » ?'), [t('Bavard'), t('Concis'), t('Lent')], 1],
    [t('Un poème de 14 vers, c’est…'), [t('Un sonnet'), t('Une ode'), t('Un haïku')], 0],
    [t('Le zouglou est né…'), [t('À Paris'), t('Chez les étudiants d’Abidjan'), t('À Dakar')], 1],
  ]),
  'partiel:eco': partiel(t('sciences économiques'), [
    [t('L’inflation, c’est…'), [t('La hausse générale des prix'), t('La baisse des salaires'), t('Un impôt')], 0],
    [t('La banque centrale des pays de l’UEMOA ?'), [t('La BEAC'), t('La BCEAO'), t('La BAD')], 1],
    [t('Le PIB mesure…'), [t('La population'), t('La dette'), t('La richesse produite dans le pays')], 2],
    [t('Le premier producteur mondial de cacao ?'), [t('Le Ghana'), t('La Côte d’Ivoire'), t('Le Brésil')], 1],
    [t('L’offre et la demande se rencontrent sur…'), [t('Le marché'), t('Le bilan'), t('Le budget')], 0],
  ]),
  'partiel:info': partiel(t('informatique'), [
    [t('Un octet, c’est…'), [t('8 bits'), t('10 bits'), t('2 bits')], 0],
    [t('HTML sert à…'), [t('Compiler du C'), t('Structurer une page web'), t('Refroidir le processeur')], 1],
    [t('En binaire, 5 s’écrit…'), ['110', '111', '101'], 2],
    [t('La RAM, c’est…'), [t('La mémoire vive'), t('Le disque dur'), t('La carte réseau')], 0],
    [t('Une boucle qui ne s’arrête jamais est…'), [t('Compilée'), t('Infinie'), t('Triée')], 1],
  ]),
  'partiel:sciences': partiel(t('sciences'), [
    [t('L’énergie cinétique vaut…'), ['½mv²', 'mgh', 'mc'], 0],
    [t('Le pH d’une solution neutre à 25 °C ?'), ['0', '7', '14'], 1],
    [t('Le symbole chimique du fer ?'), ['F', 'Fr', 'Fe'], 2],
    [t('La pesanteur sur Terre, environ…'), ['9,8 m/s²', '98 m/s²', '1 m/s²'], 0],
    [t('La Terre fait le tour du Soleil en…'), [t('Un jour'), t('Un an'), t('Un mois')], 1],
  ]),
  'partiel:medecine': partiel(t('médecine'), [
    [t('Le cœur humain a combien de cavités ?'), ['2', '4', '6'], 1],
    [t('Le paludisme est causé par…'), [t('Un virus'), t('Un plasmodium'), t('Une carence en fer')], 1],
    [t('L’os de la cuisse ?'), [t('Le fémur'), t('Le radius'), t('L’humérus')], 0],
    [t('Les globules rouges transportent surtout…'), [t('Les anticorps'), t('Le sucre'), t('L’oxygène')], 2],
    [t('Une tension normale de l’adulte, environ…'), ['12/8', '25/15', '5/2'], 0],
  ]),
  'partiel:pharmacie': partiel(t('pharmacie'), [
    [t('Le paracétamol sert surtout à…'), [t('Tuer les bactéries'), t('Calmer la douleur et la fièvre'), t('Soigner le diabète')], 1],
    [t('Un antibiotique agit contre…'), [t('Les bactéries'), t('Les virus du rhume'), t('Le stress')], 0],
    [t('La posologie, c’est…'), [t('Le prix'), t('La date de péremption'), t('La dose et le rythme des prises')], 2],
    [t('Un médicament périmé…'), [t('Se rapporte à la pharmacie'), t('Se prend en double'), t('Se revend au marché')], 0],
    [t('La quinine a longtemps soigné…'), [t('La grippe'), t('Le paludisme'), t('L’asthme')], 1],
  ]),
  'partiel:gestion': partiel(t('gestion commerciale'), [
    [t('Le chiffre d’affaires, c’est…'), [t('Le total des ventes'), t('Le bénéfice'), t('Le stock')], 0],
    [t('Le bénéfice, c’est…'), [t('Recettes + charges'), t('Recettes − charges'), t('Stock × prix')], 1],
    [t('Une facture doit dire…'), [t('La couleur du magasin'), t('L’âge du client'), t('Le montant et la date')], 2],
    [t('La TVA est…'), [t('Un impôt sur la consommation'), t('Une prime'), t('Un salaire')], 0],
    [t('Fidéliser un client, c’est…'), [t('Le faire payer deux fois'), t('Le faire revenir'), t('L’ignorer')], 1],
  ]),
  'partiel:genie': partiel(t('génie civil'), [
    [t('Le béton armé contient…'), [t('Du bois'), t('Des barres d’acier'), t('Du plastique')], 1],
    [t('L’unité de la pression ?'), [t('Le pascal'), t('Le volt'), t('Le lux')], 0],
    [t('La loi d’Ohm : U = …'), ['R + I', 'I / R', 'R × I'], 2],
    [t('Une poutre posée sur deux appuis travaille surtout en…'), [t('Flexion'), t('Évaporation'), t('Fusion')], 0],
    [t('Sur un plan, 1 cm pour 1 m : c’est l’…'), [t('Échelle au 1/100'), t('Échelle au 1/10'), t('Échelle au 1/1000')], 0],
  ]),
}
