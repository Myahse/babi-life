import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// The countries' actions (the updates « pays-burkina », « pays-usa », « pays-canada », « pays-france », backend game/paysActs.go),
// the most played each its own little game; the others take one from what they are (configs/fallback.ts).
export const JEUX_PAYS: Record<string, Jeu> = {
  'faso-to': {
    engine: 'choisir',
    title: t('Le tô de la tantie'),
    how: t('La tantie sert : touche ce qu’elle annonce avant les autres clients du maquis.'),
    decor: 'table',
    caller: t('La tantie'),
    items: [
      { name: t('Le tô'), prop: 'pain' },
      { name: t('La sauce gombo'), prop: 'banane' },
      { name: t('L’eau'), prop: 'sachet-eau' },
      { name: t('Le piment'), prop: 'caillou' },
    ],
  },
  'dioulassoba-visite': {
    engine: 'photo',
    title: t('La mosquée de Dioulassoba'),
    how: t('Le guide te montre la mosquée : prends en photo ce qu’il désigne quand c’est dans le cadre.'),
    decor: 'terre',
    subjects: [
      { name: t('La grande tour'), prop: 'caillou' },
      { name: t('Les pieux de bois'), prop: 'fleur' },
      { name: t('Le ciel'), prop: 'nuage' },
    ],
  },
  'nyc-times-photo': {
    engine: 'photo',
    title: t('Times Square'),
    how: t('Les écrans géants changent sans arrêt : prends la photo quand ce qu’on te demande passe dans le cadre.'),
    decor: 'bitume',
    subjects: [
      { name: t('Les écrans'), prop: 'nuage' },
      { name: t('Le taxi jaune'), prop: 'caillou' },
      { name: t('Les marches rouges'), prop: 'fleur' },
    ],
  },
  'nyc-yankees-match': {
    engine: 'rythme',
    title: t('Le stade des Yankees'),
    how: t('La batte frappe, la foule se lève : tape en rythme avec les supporters.'),
    decor: 'herbe',
    lanes: ['tam-tam', 'sifflet', 'megaphone'],
    tempo: 104,
  },
  'nyc-central-jogging': {
    engine: 'course',
    title: t('Le tour du réservoir'),
    how: t('Cours autour du réservoir de Central Park : attrape les bouteilles d’eau, évite les pierres.'),
    decor: 'piste',
    mode: 'pied',
    good: 'sachet-eau',
    bad: 'caillou',
  },
  'mtl-belvedere': {
    engine: 'course',
    title: t('Le sentier du mont Royal'),
    how: t('Grimpe jusqu’au belvédère : ramasse les feuilles d’érable, évite les cailloux qui roulent.'),
    decor: 'terre',
    mode: 'pied',
    good: 'fleur',
    bad: 'caillou',
  },
  // France (backend game/franceActs.go).
  'paris-maquis-garba': {
    engine: 'choisir',
    title: t('Le garba de Château-Rouge'),
    how: t('Tantie Akissi sert la diaspora : touche ce qu’elle annonce avant les autres clients du maquis.'),
    decor: 'table',
    caller: t('Tantie Akissi'),
    items: [
      { name: t('L’attiéké'), prop: 'pain' },
      { name: t('Le thon frit'), prop: 'banane' },
      { name: t('L’eau'), prop: 'sachet-eau' },
      { name: t('Le piment'), prop: 'caillou' },
    ],
  },
  'paris-eiffel-sommet': {
    engine: 'photo',
    title: t('Au sommet de la tour Eiffel'),
    how: t('Tout Paris en bas : prends en photo ce qu’on te demande quand ça passe dans le cadre.'),
    decor: 'bitume',
    subjects: [
      { name: t('Le Sacré-Cœur'), prop: 'nuage' },
      { name: t('La Seine'), prop: 'caillou' },
      { name: t('L’Arc de Triomphe'), prop: 'fleur' },
    ],
  },
  'paris-sacre-coeur-marches': {
    engine: 'course',
    title: t('Les marches de Montmartre'),
    how: t('Grimpe la butte jusqu’au Sacré-Cœur : ramasse les bouteilles d’eau, évite les pavés qui dépassent.'),
    decor: 'piste',
    mode: 'pied',
    good: 'sachet-eau',
    bad: 'caillou',
  },
  'paris-bleus-match': {
    engine: 'rythme',
    title: t('Le Stade de France'),
    how: t('Les Bleus attaquent, le stade chante : tape en rythme avec les supporters.'),
    decor: 'herbe',
    lanes: ['tam-tam', 'sifflet', 'megaphone'],
    tempo: 110,
  },
}
