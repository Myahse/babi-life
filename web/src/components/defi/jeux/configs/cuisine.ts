import type { Decor, Item, Jeu, PropId } from '../types'
import { t } from '../../../../lib/i18n'

// La cuisine ivoirienne (the update « cuisine-ivoire », backend game/cuisine.go): its played games. The
// six made for it: the foutou pounded at the mortar (engine piler), the sauce graine put together in the
// pot, the kédjénou shaken in its canari without opening it, the corn over the coals (engine griller),
// the boutiquier's pain-omelette, the bissap poured. The other dishes are eaten as a little game of their
// own kind (the plate brought to the table, the beignets caught from the oil, the orange peeled…).

const I = (name: string, prop: PropId): Item => ({ name, prop })
const SIDES = [I(t('Le piment'), 'piment'), I(t('L’eau fraîche'), 'sachet-eau'), I(t('L’oignon'), 'oignon')]

/** A plate brought to the table: the server calls it, take yours before the next table. */
const plat = (title: string, dish: Item, extra: Item[] = [], decor: Decor = 'table'): Jeu => ({
  engine: 'choisir',
  title,
  how: t('La serveuse apporte les plats : prends ce qu’elle annonce avant la table d’à côté, et régale-toi.'),
  decor,
  caller: t('La serveuse'),
  items: [dish, ...extra, ...SIDES],
  rounds: 4,
})
/** A drink poured, held, let go in the green. */
const boisson = (title: string, how: string, pour?: PropId): Jeu => ({ engine: 'tenir', title, how, decor: 'table', object: 'verre', verb: t('Verse'), fill: 'liquide', times: 3, pour })
/** Over the coals. */
const braise = (title: string, item: Extract<Jeu, { engine: 'griller' }>['item'], count = 6): Jeu => ({
  engine: 'griller',
  title,
  how: t('Tourne chaque morceau quand sa jauge est dans le vert, puis retire-le quand les deux côtés sont dorés. Laissé trop longtemps, il brûle.'),
  decor: 'terre',
  item,
  count,
})
/** Fried things caught out of the oil into the bowl. */
const friture = (title: string, prop: PropId): Jeu => ({
  engine: 'attraper',
  title,
  how: t('La tantie les sort de l’huile bouillante : attrape-les dans le bol, laisse tomber ce qui est brûlé.'),
  decor: 'etal',
  from: 'marmite',
  into: 'assiette',
  count: 12,
  good: [I(t('Le beignet doré'), prop)],
  bad: [I(t('Le morceau brûlé'), 'caillou')],
})
/** Fruit peeled or cut: rub off the skin. */
const fruit = (title: string, object: PropId): Jeu => ({ engine: 'nettoyer', title, how: t('Le vendeur te tend le couteau : enlève chaque bout de peau avant de croquer.'), decor: 'etal', object, bit: 'feuille', verb: t('Épluche'), count: 9 })

const FOUTOU_HOW = t('Pile quand le cercle blanc se ferme sur le mortier. Au rouge, retiens-toi : la main de ta partenaire tourne la pâte !')

export const JEUX_CUISINE: Record<string, Jeu> = {
  // ---------- The six made for it ----------
  // 1. The foutou at the mortar.
  'recette-foutou-graine': { engine: 'piler', title: t('Le foutou au mortier'), how: FOUTOU_HOW, decor: 'terre', dough: 'banane', helper: t('maman'), strikes: 16 },
  'recette-foutou-igname': { engine: 'piler', title: t('Le foutou igname au mortier'), how: FOUTOU_HOW, decor: 'terre', dough: 'igname', helper: t('ta sœur'), strikes: 18, tempo: 90 },
  // 2. The sauce graine: the palm nuts pounded, their juice, the smoked fish, the rest, in the right order.
  'recette-sauce-graine': {
    engine: 'assembler',
    title: t('La sauce graine'),
    how: t('Maman dit dans quel ordre tout mettre dans la marmite : le jus de graine, le poisson fumé, le gombo… suis-la, sans te tromper.'),
    decor: 'table',
    base: 'marmite',
    parts: [I(t('Le jus de graine'), 'graine'), I(t('Le poisson fumé'), 'poisson'), I(t('La tomate'), 'tomate'), I(t('L’oignon'), 'oignon'), I(t('Le piment'), 'piment'), I(t('Le gombo'), 'gombo')],
    orders: 3,
    steps: 4,
  },
  // 3. The kédjénou: the canari shaken now and then, never opened, never spilt.
  'recette-kedjenou': { engine: 'equilibre', title: t('Le kédjénou dans la canari'), how: t('On ne soulève pas le couvercle : secoue la canari pour remuer le poulet, sans renverser une goutte.'), decor: 'terre', carry: 'canari', verb: t('Secoue sans renverser'), stance: 'debout', distance: 14 },
  // 4. The corn over the coals.
  'recette-mais-braise': braise(t('Le maïs braisé'), 'mais', 6),
  'plat-mais-grille': braise(t('Le maïs de la braiseuse'), 'mais', 4),
  'street-mais': braise(t('Aide la braiseuse'), 'mais', 4),
  // 5. The boutiquier's pain-omelette.
  'recette-pain-omelette': {
    engine: 'assembler',
    title: t('Le pain-omelette'),
    how: t('Le client du matin passe commande : monte son pain dans l’ordre qu’il demande, vite, il a son gbaka.'),
    decor: 'comptoir',
    base: 'pain',
    parts: [I(t('Le beurre'), 'beurre'), I(t('L’omelette'), 'omelette'), I(t('L’oignon'), 'oignon'), I(t('Le piment'), 'piment'), I(t('La tomate'), 'tomate')],
    orders: 3,
    steps: 4,
  },
  // 6. The bissap poured into its glasses.
  'recette-bissap': { engine: 'tenir', title: t('Le jus de bissap maison'), how: t('Verse le bissap filtré dans les verres : lâche quand c’est plein, sans déborder sur la table.'), decor: 'table', object: 'verre', verb: t('Verse'), fill: 'liquide', times: 4, pour: 'bissap' },

  // ---------- The same games, for what's bought ----------
  'plat-pain-omelette': {
    engine: 'assembler',
    title: t('Chez le boutiquier'),
    how: t('Dis au boutiquier comment tu le veux : il monte ton pain-omelette dans l’ordre que tu lui donnes.'),
    decor: 'comptoir',
    base: 'pain',
    parts: [I(t('Le beurre'), 'beurre'), I(t('L’omelette'), 'omelette'), I(t('L’oignon'), 'oignon'), I(t('Le piment'), 'piment')],
    orders: 2,
    steps: 3,
  },
  'street-omelette': {
    engine: 'assembler',
    title: t('Le pain-omelette de la tantie'),
    how: t('La tantie casse les œufs : passe-lui les ingrédients dans l’ordre pour ton pain.'),
    decor: 'etal',
    base: 'pain',
    parts: [I(t('Les œufs'), 'oeuf'), I(t('Le beurre'), 'beurre'), I(t('L’oignon'), 'oignon'), I(t('Le piment'), 'piment')],
    orders: 2,
    steps: 3,
  },
  'plat-bissap': boisson(t('Le bissap glacé'), t('Le serveur te laisse te servir : remplis ton verre sans déborder.'), 'bissap'),
  'street-bissap': boisson(t('Le bissap de la vendeuse'), t('Elle sort une bouteille de la glacière : verse dans ton verre sans en mettre à côté.'), 'bissap'),
  'plat-gnamankoudji': boisson(t('Le gnamankoudji'), t('Ça pique ! Verse doucement, sans déborder.')),
  'plat-tomi': boisson(t('Le jus de tomi'), t('Le jus de baobab, épais : verse doucement dans le verre.')),
  'plat-kedjenou': plat(t('Le kédjénou du maquis'), I(t('La canari de kédjénou'), 'canari'), [I(t('L’attiéké'), 'attieke')]),
  'plat-kedjenou-pintade': plat(t('Le kédjénou de pintade'), I(t('La canari de pintade'), 'canari'), [I(t('L’attiéké'), 'attieke')]),

  // ---------- The plates ----------
  'plat-foutou-banane-graine': plat(t('Foutou sauce graine'), I(t('Le foutou sauce graine'), 'foutou'), [I(t('Le poisson fumé'), 'poisson')]),
  'plat-foutou-igname-graine': plat(t('Foutou igname'), I(t('Le foutou igname'), 'foutou'), [I(t('La viande'), 'poulet')]),
  'plat-foutou-arachide': plat(t('Foutou sauce arachide'), I(t('Le foutou sauce arachide'), 'foutou'), [I(t('Le poulet'), 'poulet')]),
  'plat-foufou-claire': plat(t('Foufou sauce claire'), I(t('Le foufou'), 'foutou'), [I(t('Le poisson fumé'), 'poisson')]),
  'plat-foutou-claire-mouton': plat(t('Le foutou de Bouaké'), I(t('Le foutou au mouton'), 'foutou'), [I(t('La viande de mouton'), 'poulet')]),
  'plat-igname-pilee-bouake': plat(t('L’igname pilée'), I(t('L’igname pilée'), 'foutou'), [I(t('La sauce djoumgblé'), 'gombo')]),
  'plat-to-baobab': plat(t('Le tô de Korhogo'), I(t('Le tô'), 'foutou'), [I(t('La sauce feuille'), 'feuille')]),
  'plat-graine-escargots-daloa': plat(t('La sauce graine de Daloa'), I(t('Les escargots'), 'escargot'), [I(t('Le foutou'), 'foutou')]),
  'plat-riz-gombo': plat(t('Riz sauce gombo'), I(t('Le riz'), 'riz'), [I(t('Le gombo'), 'gombo')]),
  'plat-riz-arachide': plat(t('Riz sauce arachide'), I(t('Le riz sauce arachide'), 'riz'), [I(t('Le poulet'), 'poulet')]),
  'plat-riz-gras': plat(t('Le riz gras'), I(t('Le riz gras'), 'riz'), [I(t('Le poulet'), 'poulet')]),
  'plat-riz-feuille-man': plat(t('Le riz de montagne'), I(t('Le riz de Man'), 'riz'), [I(t('La sauce feuille'), 'feuille')]),
  'plat-cantine-tantie': plat(t('La cantine de la tantie'), I(t('Le riz sauce du jour'), 'riz'), [I(t('Le poisson'), 'poisson')], 'etal'),
  'plat-placali-kplala': plat(t('Placali sauce kplala'), I(t('Le placali'), 'attieke'), [I(t('La sauce kplala'), 'feuille')]),
  'plat-attoukpou': plat(t('L’attoukpou'), I(t('L’attoukpou'), 'attieke'), [I(t('La sauce aubergine'), 'tomate')]),
  'plat-attieke-poisson': plat(t('Attiéké-poisson'), I(t('Le poisson braisé'), 'poisson'), [I(t('L’attiéké'), 'attieke')]),
  'plat-ablo-poisson': plat(t('Ablo et poisson'), I(t('L’ablo'), 'pain'), [I(t('Le poisson frit'), 'poisson')], 'etal'),
  'plat-langouste-bassam': plat(t('La langouste de Bassam'), I(t('La langouste'), 'crabe'), [I(t('Les frites d’alloco'), 'alloco')], 'sable'),
  'plat-soupe-poisson': plat(t('La soupe de poisson'), I(t('La soupe'), 'marmite'), [I(t('Le poisson'), 'poisson')]),
  'plat-pepper-soup': plat(t('La pepper soup'), I(t('La pepper soup'), 'marmite'), [I(t('Le poisson'), 'poisson')]),
  'plat-escargots': plat(t('Les escargots braisés'), I(t('Les escargots'), 'escargot'), [I(t('La sauce pimentée'), 'piment')]),
  // ---------- The grills ----------
  'plat-choukouya': braise(t('Le choukouya'), 'brochette', 5),
  'plat-agouti': braise(t('L’agouti braisé'), 'brochette', 4),
  'plat-igname-braisee': braise(t('L’igname braisée'), 'igname', 4),
  'plat-aloco-braise': braise(t('La banane braisée'), 'banane', 4),
  // ---------- Breakfast and the street ----------
  'plat-beignets': friture(t('Les beignets'), 'beignet'),
  'plat-claclo': friture(t('Les claclos'), 'beignet'),
  'plat-gbofloto': friture(t('Les gboflotos'), 'beignet'),
  'plat-galettes': friture(t('Les galettes de maïs'), 'beignet'),
  'plat-bouillie-mil': boisson(t('La bouillie de mil'), t('La tantie te sert : remplis ton bol de bouillie chaude sans en mettre partout.')),
  'plat-degue': boisson(t('Le dêguê'), t('Remplis ton gobelet de dêguê bien frais sans déborder.')),
  'plat-gari-sucre': boisson(t('Le gari sucré'), t('Verse l’eau glacée sur le gari, juste ce qu’il faut.')),
  'plat-cafe-touba': { engine: 'tenir', title: t('Le café Touba'), how: t('Le vendeur verse de haut pour la mousse : lâche quand la tasse est pleine.'), decor: 'comptoir', object: 'cafe', verb: t('Verse'), fill: 'liquide', times: 3 },
  'plat-cafe-man': { engine: 'tenir', title: t('Le café de Man'), how: t('Le café des montagnes, bien serré : remplis la tasse sans déborder.'), decor: 'comptoir', object: 'cafe', verb: t('Verse'), fill: 'liquide', times: 3 },
  'plat-arachides-grillees': {
    engine: 'attraper',
    title: t('Les arachides grillées'),
    how: t('Lance-les en l’air et attrape-les dans la bouche… enfin, dans le cornet !'),
    decor: 'etal',
    from: 'arachide',
    into: 'assiette',
    count: 12,
    good: [I(t('L’arachide'), 'arachide')],
    bad: [I(t('Le caillou'), 'caillou')],
  },
  'plat-mangue': fruit(t('La mangue'), 'mangue'),
  'plat-ananas': fruit(t('L’ananas'), 'ananas'),
  'plat-papaye': fruit(t('La papaye'), 'mangue'),
  'plat-orange-pelee': fruit(t('Les oranges'), 'ananas'),
  'street-fruits': fruit(t('Les fruits du vendeur'), 'mangue'),
  // ---------- For the grown-ups ----------
  'plat-bandji': { engine: 'tenir', title: t('Le bandji'), how: t('Le vin de palme mousse : remplis la calebasse sans la faire déborder.'), decor: 'table', object: 'calebasse', verb: t('Verse'), fill: 'liquide', times: 3 },
  'plat-koutoukou': { engine: 'tenir', title: t('Le koutoukou'), how: t('Juste un petit verre : lâche tôt, c’est fort !'), decor: 'table', object: 'verre', verb: t('Verse'), fill: 'liquide', times: 2 },
  // ---------- The other recipes ----------
  'recette-sauce-arachide': {
    engine: 'assembler',
    title: t('La sauce arachide'),
    how: t('La pâte d’arachide, le poulet, la tomate… mets chaque chose dans la marmite dans l’ordre.'),
    decor: 'table',
    base: 'marmite',
    parts: [I(t('Le poulet'), 'poulet'), I(t('La pâte d’arachide'), 'arachide'), I(t('La tomate'), 'tomate'), I(t('L’oignon'), 'oignon'), I(t('Le piment'), 'piment')],
    orders: 3,
    steps: 4,
  },
  'recette-sauce-gombo': {
    engine: 'nettoyer',
    title: t('La sauce gombo'),
    how: t('Coupe le gombo en rondelles, chaque bout, avant de le jeter dans la sauce.'),
    decor: 'table',
    object: 'gombo',
    bit: 'feuille',
    verb: t('Coupe'),
    count: 10,
  },
  'recette-placali-kplala': { engine: 'tenir', title: t('Le placali'), how: t('Tourne la pâte de manioc sur le feu : lâche quand elle est bien prise, avant qu’elle accroche.'), decor: 'table', object: 'marmite', verb: t('Tourne'), fill: 'chaleur', times: 3 },
  'recette-riz-gras': {
    engine: 'assembler',
    title: t('Le riz gras'),
    how: t('L’huile, la tomate, le poulet, puis le riz : monte le riz gras dans l’ordre.'),
    decor: 'table',
    base: 'marmite',
    parts: [I(t('Le poulet'), 'poulet'), I(t('La tomate'), 'tomate'), I(t('L’oignon'), 'oignon'), I(t('Le riz'), 'riz'), I(t('Le piment'), 'piment')],
    orders: 3,
    steps: 4,
  },
}
