import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// Le parcours d'études (update « parcours-etudes », backend game/etudes.go): the lycée's day played (the
// class, the récré, the cantine, the internat's étude, night and 5:30 wake-up), the BEPC and the bac by
// série, and the university's partiels by filière (`partiel:<filière>`, the activity's variant: data.ts
// jeuOf). The exams draw their questions from big banks (examens/, loaded with the game), each subject
// on its own; their mark is the server's, from the right answers per subject and the série's coefficients
// (backend game.CopieNote).

// The subjects' names, as the exam's paper says them (the backend's game.ExamPlans labels).
const SUBJECTS: Record<string, string> = { maths: t('Mathématiques'), francais: t('Français'), 'histoire-geo': t('Histoire-géographie'), svt: t('SVT'), physique: t('Physique-chimie'), anglais: t('Anglais'), philo: t('Philosophie') }
/** An exam: so many questions drawn from each subject's bank (examens/), 20 seconds each. */
const exam = (title: string, how: string, bank: string, subjects: [string, number, string?][]): Jeu => ({ engine: 'quiz', title, how, decor: 'bureau', host: 'prof', questions: [], timer: 20, exam: { bank, subjects: subjects.map(([id, n, name]) => ({ id, name: name ?? SUBJECTS[id] ?? id, n })) } })
const oral = (title: string, bank: string, subjects: string[]) => exam(title, t('Cinq questions, une par grande matière, 20 secondes chacune. Ton premier tour compte pour deux tiers, l’oral pour un tiers : il faut arriver à 10/20.'), bank, subjects.map((id) => [id, 1]))
const partiel = (what: string, filiere: string) => exam(t('Le partiel : {0}', { 0: what }), t('La salle d’examen, dix questions tirées au sort, 20 secondes chacune. Il faut 10/20 pour valider le semestre (tes cours suivis comptent aussi).'), 'partiel', [[filiere, 10, what]])

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

  // The exams: drawn from the banks (examens/, loaded with the game), 20 seconds a question, four answers.
  'examen-bepc': exam(t('Le BEPC'), t('Quinze questions tirées au sort, matière par matière, 20 secondes chacune. La note : chaque matière sur 20, avec ses coefficients (français et maths ×3). Il faut 10/20.'), 'bepc', [['maths', 3], ['francais', 3], ['histoire-geo', 3], ['svt', 2], ['physique', 2], ['anglais', 2]]),
  'bac-serie-a': exam(t('Le bac, série A'), t('Quinze questions tirées au sort, 20 secondes chacune : philosophie ×5, français ×4, histoire-géo ×3, anglais ×3, maths ×2. Il faut 10/20 ; entre 8 et 10, l’oral du second tour.'), 'bac-a', [['philo', 3], ['francais', 3], ['histoire-geo', 3], ['anglais', 3], ['maths', 3]]),
  'bac-serie-c': exam(t('Le bac, série C'), t('Quinze questions tirées au sort, 20 secondes chacune : maths ×5, physique-chimie ×5, français ×3, SVT, philosophie et anglais ×2. Il faut 10/20 ; entre 8 et 10, l’oral du second tour.'), 'bac-c', [['maths', 3], ['physique', 3], ['francais', 3], ['svt', 2], ['philo', 2], ['anglais', 2]]),
  'bac-serie-d': exam(t('Le bac, série D'), t('Quinze questions tirées au sort, 20 secondes chacune : SVT ×5, physique-chimie et maths ×4, français ×3, philosophie et anglais ×2. Il faut 10/20 ; entre 8 et 10, l’oral du second tour.'), 'bac-d', [['svt', 3], ['physique', 3], ['maths', 3], ['francais', 2], ['philo', 2], ['anglais', 2]]),
  // The second tour (the bac's variant « oral »): a question from each of the série's five heaviest subjects.
  'bac-serie-a:oral': oral(t('L’oral du second tour, série A'), 'bac-a', ['philo', 'francais', 'histoire-geo', 'anglais', 'maths']),
  'bac-serie-c:oral': oral(t('L’oral du second tour, série C'), 'bac-c', ['maths', 'physique', 'francais', 'svt', 'philo']),
  'bac-serie-d:oral': oral(t('L’oral du second tour, série D'), 'bac-d', ['svt', 'physique', 'maths', 'francais', 'philo']),

  // The partiels, by filière: ten questions of its bank.
  'partiel:droit': partiel(t('droit'), 'droit'),
  'partiel:lettres': partiel(t('lettres'), 'lettres'),
  'partiel:eco': partiel(t('sciences économiques'), 'eco'),
  'partiel:info': partiel(t('informatique'), 'info'),
  'partiel:sciences': partiel(t('sciences'), 'sciences'),
  'partiel:medecine': partiel(t('médecine'), 'medecine'),
  'partiel:pharmacie': partiel(t('pharmacie'), 'pharmacie'),
  'partiel:gestion': partiel(t('gestion commerciale'), 'gestion'),
  'partiel:genie': partiel(t('génie civil'), 'genie'),
}
