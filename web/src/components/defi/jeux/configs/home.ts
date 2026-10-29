import type { Jeu } from '../types'

// The home's everyday things and the baby's day (Gestes.tsx): after the arrows that get it ready, the
// action itself, played (`home:<kind>`).
export const JEUX_HOME: Record<string, Jeu> = {
  'home:douche': { engine: 'nettoyer', title: 'Sous la douche', how: 'Le savon mousse partout : rince chaque bout de mousse jusqu’à être tout propre.', decor: 'carrelage', object: 'serviette', bit: 'mousse', verb: 'Rince', count: 12 },
  'home:cuisine': {
    engine: 'assembler', title: 'L’attiéké-poisson maison', how: 'Monte l’assiette dans l’ordre demandé pour toute la famille.', decor: 'table', base: 'assiette',
    parts: [{ name: 'L’attiéké', prop: 'attieke' }, { name: 'Le poisson frit', prop: 'poisson' }, { name: 'Le piment', prop: 'piment' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'La tomate', prop: 'tomate' }],
  },
  'home:repas': {
    engine: 'choisir', title: 'À table !', how: 'Maman sert : prends ce qu’elle te dit avant que le petit frère se serve.', decor: 'table', caller: 'Maman',
    items: [{ name: 'Le riz', prop: 'riz' }, { name: 'Le poisson', prop: 'poisson' }, { name: 'Le pain', prop: 'pain' }, { name: 'L’eau', prop: 'sachet-eau' }, { name: 'La mangue', prop: 'mangue' }],
  },
  'home:cour': { engine: 'viser', title: 'Le but de la cour', how: 'Les copains sont dans les buts : vise bien, dose ta frappe et marque.', decor: 'terre', projectile: 'ballon-foot', target: 'but', shots: 5 },
  // The baby's day
  'home:biberon': { engine: 'tenir', title: 'Le biberon', how: 'Tiens pour téter, lâche dans le vert pour avaler : trop d’un coup et tu t’étrangles !', decor: 'parquet', object: 'biberon', verb: 'Tète', fill: 'liquide', times: 4 },
  'home:bouillie': {
    engine: 'attraper', title: 'La bouillie', how: 'Maman tend les cuillères : ouvre grand pour la bouillie, laisse passer le piment !', decor: 'parquet', from: 'marmite', into: 'assiette', count: 12,
    good: [{ name: 'La cuillère de bouillie', prop: 'louche' }], bad: [{ name: 'Le piment', prop: 'piment' }, { name: 'L’oignon', prop: 'oignon' }],
  },
  'home:bain': { engine: 'nettoyer', title: 'Le bain', how: 'Splash ! Fais partir toute la mousse du canard pour qu’il brille.', decor: 'carrelage', object: 'jouet', bit: 'mousse', verb: 'Éclabousse', count: 10 },
  'home:calin': { engine: 'tenir', title: 'Le gros câlin', how: 'Serre fort ta peluche dans les bras de maman… mais pas trop !', decor: 'parquet', object: 'peluche', verb: 'Serre', fill: 'tissu', times: 3 },
  'home:caca': { engine: 'tenir', title: 'Pousse !', how: 'Tiens pour pousser, lâche dans le vert : trop fort et ça déborde de la couche…', decor: 'carrelage', object: 'seau', verb: 'Pousse', fill: 'force', times: 3 },
  'home:pipi': { engine: 'tenir', title: 'Pipi au pot', how: 'Tiens, et lâche juste à temps pour que tout aille dans le pot.', decor: 'carrelage', object: 'seau', verb: 'Pipi', fill: 'liquide', times: 3 },
  'home:vomir': { engine: 'nettoyer', title: 'On nettoie', how: 'Aide maman à essuyer chaque tache sur la serviette.', decor: 'parquet', object: 'serviette', bit: 'tache', verb: 'Essuie', count: 8 },
  'home:pleurer': { engine: 'rythme', title: 'La berceuse de maman', how: 'Maman chante pour te calmer : tape la peluche, le hochet et le biberon en rythme.', decor: 'parquet', lanes: ['peluche', 'jouet', 'biberon'], notes: 16, tempo: 80 },
}
