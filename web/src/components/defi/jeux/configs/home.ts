import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// The home's everyday things and the baby's day (Gestes.tsx): after the arrows that get it ready, the
// action itself, played (`home:<kind>`).
export const JEUX_HOME: Record<string, Jeu> = {
  'home:douche': { engine: 'nettoyer', title: t('Sous la douche'), how: t('Le savon mousse partout : rince chaque bout de mousse jusqu’à être tout propre.'), decor: 'carrelage', object: 'serviette', bit: 'mousse', verb: t('Rince'), count: 12 },
  'home:cuisine': {
    engine: 'assembler', title: t('L’attiéké-poisson maison'), how: t('Monte l’assiette dans l’ordre demandé pour toute la famille.'), decor: 'table', base: 'assiette',
    parts: [{ name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le poisson frit'), prop: 'poisson' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('La tomate'), prop: 'tomate' }],
  },
  'home:repas': {
    engine: 'choisir', title: t('À table !'), how: t('Maman sert : prends ce qu’elle te dit avant que le petit frère se serve.'), decor: 'table', caller: t('Maman'),
    items: [{ name: t('Le riz'), prop: 'riz' }, { name: t('Le poisson'), prop: 'poisson' }, { name: t('Le pain'), prop: 'pain' }, { name: t('L’eau'), prop: 'sachet-eau' }, { name: t('La mangue'), prop: 'mangue' }],
  },
  'home:cour': { engine: 'viser', title: t('Le but de la cour'), how: t('Les copains sont dans les buts : vise bien, dose ta frappe et marque.'), decor: 'terre', projectile: 'ballon-foot', target: 'but', shots: 5 },
  // The baby's day
  'home:biberon': { engine: 'tenir', title: t('Le biberon'), how: t('Tiens pour téter, lâche dans le vert pour avaler : trop d’un coup et tu t’étrangles !'), decor: 'parquet', object: 'biberon', verb: t('Tète'), fill: 'liquide', times: 4 },
  'home:bouillie': {
    engine: 'attraper', title: t('La bouillie'), how: t('Maman tend les cuillères : ouvre grand pour la bouillie, laisse passer le piment !'), decor: 'parquet', from: 'marmite', into: 'assiette', count: 12,
    good: [{ name: t('La cuillère de bouillie'), prop: 'louche' }], bad: [{ name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }],
  },
  'home:bain': { engine: 'nettoyer', title: t('Le bain'), how: t('Splash ! Fais partir toute la mousse du canard pour qu’il brille.'), decor: 'carrelage', object: 'jouet', bit: 'mousse', verb: t('Éclabousse'), count: 10 },
  'home:calin': { engine: 'tenir', title: t('Le gros câlin'), how: t('Serre fort ta peluche dans les bras de maman… mais pas trop !'), decor: 'parquet', object: 'peluche', verb: t('Serre'), fill: 'tissu', times: 3 },
  'home:caca': { engine: 'tenir', title: t('Pousse !'), how: t('Tiens pour pousser, lâche dans le vert : trop fort et ça déborde de la couche…'), decor: 'carrelage', object: 'seau', verb: t('Pousse'), fill: 'force', times: 3 },
  'home:pipi': { engine: 'tenir', title: t('Pipi au pot'), how: t('Tiens, et lâche juste à temps pour que tout aille dans le pot.'), decor: 'carrelage', object: 'seau', verb: t('Pipi'), fill: 'liquide', times: 3 },
  'home:vomir': { engine: 'nettoyer', title: t('On nettoie'), how: t('Aide maman à essuyer chaque tache sur la serviette.'), decor: 'parquet', object: 'serviette', bit: 'tache', verb: t('Essuie'), count: 8 },
  'home:pleurer': { engine: 'rythme', title: t('La berceuse de maman'), how: t('Maman chante pour te calmer : tape la peluche, le hochet et le biberon en rythme.'), decor: 'parquet', lanes: ['peluche', 'jouet', 'biberon'], notes: 16, tempo: 80 },
}
