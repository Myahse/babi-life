import type { Item, Jeu, PropId } from '../types'

// Any action without a game written for it: a game made from its icon (the kind of thing it is),
// titled with its label. Each icon family has its engine; an unknown icon gets the « choisir » default.

const it = (name: string, prop: PropId): Item => ({ name, prop })
type Make = (title: string) => Jeu

// The label as a title: no parenthesis, at most 30 characters.
const titleOf = (label: string) => {
  const t = label.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  return [...t].length > 30 ? [...t].slice(0, 29).join('').trimEnd() + '…' : t
}

const FOOD = [it('Le garba', 'garba'), it('L’alloco', 'alloco'), it('Le poulet', 'poulet'), it('Le poisson', 'poisson'), it('Le riz', 'riz'), it('L’attiéké', 'attieke')]
const PAPERS = [it('La pièce d’identité', 'passeport'), it('Le dossier', 'dossier'), it('Le stylo', 'stylo'), it('Le tampon', 'tampon'), it('Le reçu', 'ticket')]
const CHAT: [string, string[], number][] = [
  ['Eh, c’est comment ? Ça fait longtemps !', ['On est là, Dieu merci ! Et toi ?', 'Laisse-moi', 'Hum'], 0],
  ['Tu as vu ce qui s’est passé au quartier ?', ['Non, on dit quoi ?', 'Je m’en fiche', 'Va raconter ailleurs'], 0],
  ['Je suis un peu fatigué ces temps-ci…', ['Tu dis ça ?', 'Courage, si tu as besoin, je suis là', 'C’est ton problème'], 1],
  ['Bon, on se voit bientôt alors ?', ['Peut-être jamais', 'Bof', 'Avec plaisir, on s’appelle !'], 2],
]
const QUIZ: [string, string[], number][] = [
  ['La lagune d’Abidjan s’appelle…', ['La lagune Ébrié', 'Le lac Kossou', 'La mer Rouge'], 0],
  ['La capitale politique de la Côte d’Ivoire, c’est…', ['Bouaké', 'Yamoussoukro', 'Man'], 1],
  ['La Côte d’Ivoire est indépendante depuis…', ['1945', '1980', '1960'], 2],
  ['L’attiéké est fait à partir de…', ['Manioc', 'Maïs', 'Mil'], 0],
]

const eat: Make = (title) => ({ engine: 'choisir', title, how: 'La tantie annonce ce qui est prêt : prends-le avant les autres mains.', decor: 'etal', caller: 'La tantie', items: FOOD })
const cook: Make = (title) => ({ engine: 'assembler', title, how: 'Mets chaque ingrédient dans la marmite, dans l’ordre de la recette.', decor: 'table', base: 'marmite', parts: [it('L’oignon', 'oignon'), it('La tomate', 'tomate'), it('Le piment', 'piment'), it('Le poisson', 'poisson'), it('Le riz', 'riz')] })
const drink: Make = (title) => ({ engine: 'tenir', title, how: 'Verse doucement : lâche quand le verre est plein, sans déborder.', decor: 'comptoir', object: 'verre', verb: 'Verse', fill: 'liquide' })
const dance: Make = (title) => ({ engine: 'rythme', title, how: 'Le son est lancé : tape chaque note pile sur la ligne.', decor: 'parquet', lanes: ['enceinte', 'djembe', 'micro'] })
const drums: Make = (title) => ({ engine: 'rythme', title, how: 'Les tambours parlent : suis-les en tapant sur la ligne.', decor: 'terre', lanes: ['djembe', 'tam-tam', 'balafon'] })
const dj: Make = (title) => ({ engine: 'rythme', title, how: 'Aux platines : enchaîne les sons juste sur le temps.', decor: 'scene', lanes: ['platine', 'note-musique', 'enceinte'] })
const songs: Make = (title) => ({ engine: 'rythme', title, how: 'Les chants commencent : suis l’assemblée en tapant sur la ligne.', decor: 'parquet', lanes: ['tam-tam', 'micro', 'guitare'], tempo: 90 })
const pray: Make = (title) => ({ engine: 'tenir', title, how: 'Respire et concentre-toi : relâche quand ton cœur est calme.', decor: 'carrelage', object: 'bougie', verb: 'Recueille-toi', fill: 'force', times: 3 })
const foot: Make = (title) => ({ engine: 'viser', title, how: 'Vise le coin du but et dose ta frappe pour marquer.', decor: 'herbe', projectile: 'ballon-foot', target: 'but' })
const basket: Make = (title) => ({ engine: 'viser', title, how: 'Vise le panier, dose ta force : marque un maximum de paniers.', decor: 'piste', projectile: 'ballon-basket', target: 'panier-basket' })
const lift: Make = (title) => ({ engine: 'tenir', title, how: 'Pousse fort : relâche quand la jauge est dans le vert, pas avant.', decor: 'parquet', object: 'haltere', verb: 'Soulève', fill: 'force' })
const run: Make = (title) => ({ engine: 'course', title, how: 'Avance : prends les sachets d’eau, évite les cailloux.', decor: 'piste', mode: 'pied', good: 'sachet-eau', bad: 'caillou' })
const swim: Make = (title) => ({ engine: 'course', title, how: 'Nage : attrape les bouées, évite les crabes.', decor: 'eau', mode: 'nage', good: 'bouee', bad: 'crabe' })
const paddle: Make = (title) => ({ engine: 'course', title, how: 'Pagaie sur l’eau : ramasse les coquillages, évite les vagues.', decor: 'eau', mode: 'pirogue', good: 'coquillage', bad: 'vague' })
const bike: Make = (title) => ({ engine: 'course', title, how: 'Pédale : prends les sachets d’eau, évite les cailloux.', decor: 'bitume', mode: 'velo', good: 'sachet-eau', bad: 'caillou' })
const kart: Make = (title) => ({ engine: 'course', title, how: 'Pied au plancher : prends l’essence, évite les quilles.', decor: 'piste', mode: 'kart', good: 'essence', bad: 'quille' })
const climb: Make = (title) => ({ engine: 'equilibre', title, how: 'Ça monte : garde ton sac bien droit jusqu’en haut.', decor: 'terre', carry: 'sac', verb: 'Monte' })
const look = (subjects: Item[], decor: Jeu['decor'] = 'herbe'): Make => (title) => ({ engine: 'photo', title, how: 'Regarde bien : déclenche quand le plus beau passe dans le cadre.', decor, subjects })
const learn: Make = (title) => ({ engine: 'quiz', title, how: 'On te pose des questions : trouve la bonne réponse.', decor: 'bureau', host: 'prof', questions: QUIZ })
const papers: Make = (title) => ({ engine: 'choisir', title, how: 'L’agent demande une pièce : donne-lui la bonne, sans te tromper.', decor: 'comptoir', caller: 'L’agent', items: PAPERS })
const shop = (caller: string, items: Item[], decor: Jeu['decor'] = 'etal'): Make => (title) => ({ engine: 'choisir', title, how: `${caller} te montre ce qu’il te faut : touche le bon avant les autres.`, decor, caller, items })
const market: Make = (title) => ({ engine: 'attraper', title, how: 'La vendeuse te lance les bons produits : attrape-les, laisse tomber les abîmés.', decor: 'etal', from: 'carton', into: 'sac', good: [it('La tomate', 'tomate'), it('L’oignon', 'oignon'), it('La mangue', 'mangue'), it('La banane', 'banane')], bad: [it('Le caillou', 'caillou'), it('La feuille', 'feuille')] })
const haircut: Make = (title) => ({ engine: 'nettoyer', title, how: 'Passe sur chaque cheveu qui dépasse pour une coupe bien nette.', decor: 'carrelage', object: 'miroir', bit: 'cheveu', verb: 'Coupe' })
const beauty: Make = (title) => ({ engine: 'assembler', title, how: 'Passe chaque chose dans l’ordre annoncé : peigne, crème, mèches…', decor: 'carrelage', base: 'meche', parts: [it('Le peigne', 'peigne'), it('La crème', 'creme'), it('La mèche', 'meche'), it('Le bigoudi', 'bigoudi'), it('La fleur', 'fleur')] })
const clean = (object: PropId, bit: PropId, verb: string, decor: Jeu['decor'] = 'carrelage'): Make => (title) => ({ engine: 'nettoyer', title, how: `${verb} chaque trace jusqu’à ce que ce soit tout propre.`, decor, object, bit, verb })
const chat: Make = (title) => ({ engine: 'repondre', title, how: 'On te parle : choisis la réponse qui fait plaisir.', decor: 'parquet', npc: 'ami', lines: CHAT })
const rally: Make = (title) => ({ engine: 'rythme', title, how: 'Scande en rythme avec la foule, dans la bonne humeur : tape sur la ligne.', decor: 'bitume', lanes: ['megaphone', 'drapeau', 'sifflet'] })
const care: Make = (title) => ({ engine: 'choisir', title, how: 'Le docteur demande un outil ou un médicament : donne-lui le bon.', decor: 'comptoir', caller: 'Le docteur', items: [it('Le stéthoscope', 'stethoscope'), it('Les comprimés', 'medicament'), it('Le thermomètre', 'thermometre'), it('Le pansement', 'pansement'), it('Le tensiomètre', 'tensiometre')] })
const rest: Make = (title) => ({ engine: 'tenir', title, how: 'Respire tout doucement : relâche quand tu es bien détendu.', decor: 'parquet', object: 'coussin', verb: 'Respire', fill: 'force', times: 3 })
const carry: Make = (title) => ({ engine: 'equilibre', title, how: 'La brouette est pleine : garde-la droite jusqu’au bout du chantier.', decor: 'terre', carry: 'brouette', verb: 'Pousse' })
const money: Make = (title) => ({ engine: 'attraper', title, how: 'L’argent arrive : attrape les pièces et les billets, laisse tomber le reste.', decor: 'table', from: 'sac', into: 'calebasse', good: [it('La pièce', 'piece'), it('Le billet', 'billet')], bad: [it('Le caillou', 'caillou'), it('La feuille', 'feuille')] })
const gifts: Make = (title) => ({ engine: 'attraper', title, how: 'Les cadeaux arrivent : attrape-les tous, laisse tomber les cailloux.', decor: 'parquet', from: 'ballon-fete', into: 'carton', good: [it('Le cadeau', 'cadeau'), it('Le jouet', 'jouet'), it('Le bonbon', 'bonbon'), it('La peluche', 'peluche')], bad: [it('Le caillou', 'caillou')] })
const games: Make = (title) => ({ engine: 'choisir', title, how: 'Le croupier annonce : touche le bon jeton ou la bonne carte avant les autres.', decor: 'table', caller: 'Le croupier', items: [it('Le jeton', 'jeton'), it('La carte', 'carte-jeu'), it('Le dé', 'de'), it('Le damier', 'damier')] })
const baby: Make = (title) => ({ engine: 'tenir', title, how: 'Remplis le biberon : lâche quand c’est juste à la bonne mesure.', decor: 'table', object: 'biberon', verb: 'Remplis', fill: 'liquide' })
const office: Make = (title) => ({ engine: 'assembler', title, how: 'Monte le dossier dans l’ordre : pièce, formulaire, signature, tampon.', decor: 'bureau', base: 'dossier', parts: [it('La pièce', 'passeport'), it('Le formulaire', 'cahier'), it('La signature', 'stylo'), it('Le tampon', 'tampon')] })
const travel: Make = (title) => ({ engine: 'equilibre', title, how: 'Ta valise est lourde : garde-la droite jusqu’au bout du couloir.', decor: 'carrelage', carry: 'valise', verb: 'Roule' })

const BY_ICON: Record<string, Make> = {
  // Eating, cooking
  utensils: eat, fish: eat, drumstick: eat, soup: eat, sandwich: eat, apple: eat, banana: eat, cherry: eat,
  hamburger: (t) => ({ engine: 'assembler', title: t, how: 'Monte le burger étage par étage, dans le bon ordre.', decor: 'comptoir', base: 'pain', parts: [it('Le steak', 'burger'), it('La tomate', 'tomate'), it('L’oignon', 'oignon'), it('Le pain du dessus', 'pain')] }),
  'ice-cream-cone': shop('Le glacier', [it('La glace', 'glace'), it('Le gâteau', 'gateau'), it('Le jus', 'jus'), it('Le bonbon', 'bonbon')], 'comptoir'),
  cake: (t) => ({ engine: 'assembler', title: t, how: 'Décore le gâteau dans l’ordre demandé, bougies à la fin.', decor: 'table', base: 'gateau', parts: [it('Les bonbons', 'bonbon'), it('L’étoile', 'etoile'), it('Le cœur', 'coeur'), it('Les bougies', 'bougie')] }),
  popcorn: (t) => ({ engine: 'attraper', title: t, how: 'Le pop-corn saute : attrape-le dans le pot, laisse tomber les flammes.', decor: 'table', from: 'marmite', into: 'verre', good: [it('Le pop-corn', 'popcorn')], bad: [it('La flamme', 'flamme')] }),
  flame: (t) => ({ engine: 'tenir', title: t, how: 'Sur la braise : lâche quand c’est bien doré, pas brûlé.', decor: 'etal', object: 'brochette', verb: 'Grille', fill: 'chaleur' }),
  'cooking-pot': cook, 'chef-hat': cook,
  // Drinking
  'cup-soda': drink, beer: drink, coffee: drink, milk: drink, martini: drink, 'glass-water': drink, droplet: drink,
  citrus: (t) => ({ engine: 'tenir', title: t, how: 'Verse l’eau de coco dans le verre : lâche quand il est plein.', decor: 'sable', object: 'noix-coco', verb: 'Verse', fill: 'liquide' }),
  // Party, music
  music: dance, 'party-popper': dance, crown: dance, piano: dance, drum: drums, 'disc-3': dj,
  drama: look([it('Le masque', 'masque'), it('La statue', 'statue'), it('Le tableau', 'tableau'), it('Le clap', 'clap')], 'scene'),
  // Sport
  volleyball: foot, trophy: basket, dumbbell: lift, footprints: run, swords: run, bike, car: kart, waves: swim, sailboat: paddle, mountain: climb,
  // Worship
  church: songs, moon: pray, 'hand-heart': pray, 'heart-handshake': pray,
  // Seeing, visiting
  tv: look([it('L’écran', 'ecran'), it('Le ballon', 'ballon-foot'), it('Le micro', 'micro'), it('Le trophée', 'trophee')], 'parquet'),
  clapperboard: look([it('L’écran', 'ecran'), it('La caméra', 'camera'), it('Le clap', 'clap'), it('L’affiche', 'affiche')], 'scene'),
  camera: look([it('Le palmier', 'palmier'), it('L’oiseau', 'oiseau'), it('Le soleil', 'soleil'), it('Le drapeau', 'drapeau')]),
  eye: look([it('Le ballon', 'ballon-foot'), it('L’oiseau', 'oiseau'), it('Le papillon', 'papillon'), it('Le nuage', 'nuage')]),
  landmark: look([it('La statue', 'statue'), it('Le masque', 'masque'), it('Le drapeau', 'drapeau'), it('Le tableau', 'tableau')], 'carrelage'),
  castle: look([it('La statue', 'statue'), it('Le drapeau', 'drapeau'), it('Le palmier', 'palmier')], 'carrelage'),
  'building-2': look([it('L’avion', 'avion'), it('Le nuage', 'nuage'), it('Le soleil', 'soleil'), it('L’oiseau', 'oiseau')], 'ciel'),
  bird: look([it('L’oiseau', 'oiseau'), it('Le perroquet', 'perroquet'), it('Le papillon', 'papillon')]),
  'paw-print': look([it('Le lion', 'lion'), it('La girafe', 'girafe'), it('L’éléphant', 'elephant'), it('Le singe', 'singe'), it('Le crocodile', 'crocodile')]),
  sunset: look([it('Le soleil', 'soleil'), it('La pirogue', 'pirogue'), it('Le cocotier', 'cocotier'), it('L’oiseau', 'oiseau')], 'sable'),
  'tree-palm': look([it('Le cocotier', 'cocotier'), it('La vague', 'vague'), it('Le crabe', 'crabe'), it('Le coquillage', 'coquillage')], 'sable'),
  palette: look([it('Le tableau', 'tableau'), it('La statue', 'statue'), it('Le masque', 'masque'), it('L’affiche', 'affiche')], 'carrelage'),
  plane: look([it('L’avion', 'avion'), it('Le nuage', 'nuage'), it('Le soleil', 'soleil'), it('L’oiseau', 'oiseau')], 'ciel'),
  'flower-2': beauty, sparkles: beauty, gem: shop('La vendeuse', [it('Le collier', 'collier'), it('La montre', 'montre'), it('Le parfum', 'parfum'), it('Les lunettes', 'lunettes')], 'comptoir'),
  // Learning, papers
  library: learn, 'book-open': learn, newspaper: learn, 'notebook-pen': learn, presentation: learn, 'graduation-cap': learn,
  'file-text': office, stamp: papers, shield: papers, 'id-card': papers, gavel: papers, briefcase: office,
  // Shopping
  'shopping-bag': shop('La vendeuse', [it('Le sac', 'sac'), it('La chaussure', 'chaussure'), it('La casquette', 'casquette'), it('Les lunettes', 'lunettes'), it('Le parfum', 'parfum')], 'etagere'),
  shirt: shop('La vendeuse', [it('Le pagne wax', 'pagne'), it('La robe', 'robe'), it('Le boubou', 'boubou'), it('La chemise', 'chemise')]),
  store: shop('Le commerçant', [it('Le savon', 'savon'), it('Le pain', 'pain'), it('Le soda', 'soda'), it('Le sachet d’eau', 'sachet-eau'), it('Le riz', 'riz')], 'comptoir'),
  'shopping-cart': shop('La caissière', [it('Le riz', 'riz'), it('Le jus', 'jus'), it('Le savon', 'savon'), it('Le pain', 'pain'), it('La tomate', 'tomate')], 'comptoir'),
  'shopping-basket': market,
  gift: gifts, 'piggy-bank': money, banknote: money, 'dice-5': games, baby,
  // Hair, cleaning
  scissors: haircut,
  'brush-cleaning': clean('tapis', 'poussiere', 'Balaie'), shovel: clean('seau', 'tache', 'Racle', 'terre'), toothbrush: clean('miroir', 'mousse', 'Brosse'),
  bath: clean('serviette', 'mousse', 'Rince'), 'shower-head': clean('serviette', 'mousse', 'Rince'), toilet: clean('seau', 'tache', 'Nettoie'),
  // Talking
  users: chat, 'messages-square': chat, phone: chat, smartphone: chat, handshake: chat, heart: chat, mail: chat,
  megaphone: rally, flag: rally,
  // Health
  stethoscope: care, pill: care, syringe: care, 'heart-pulse': care, hospital: care,
  // Resting, waiting
  sofa: rest, bed: rest, 'bed-single': rest, armchair: rest, umbrella: rest, hourglass: rest,
  // Work, travel
  'hard-hat': carry, hotel: (t) => ({ engine: 'assembler', title: t, how: 'Prépare le plateau du client dans l’ordre de la commande.', decor: 'comptoir', base: 'plateau-service', parts: [it('Le café', 'cafe'), it('Le croissant', 'croissant'), it('Le jus', 'jus'), it('La serviette', 'serviette')] }),
  bus: travel, luggage: travel,
}

/** Any action without a game written for it: one made from what it is (its icon, its name). */
export function fallbackFor(act: { id: string; icon: string; label: string }): Jeu {
  const title = titleOf(act.label)
  const make = BY_ICON[act.icon]
  if (make) return make(title)
  // Unknown icon: pick the right thing the person asks for (works for almost anything).
  return { engine: 'choisir', title, how: 'On te demande quelque chose : touche le bon avant les autres.', decor: 'table', caller: 'On te demande', items: [it('Le verre', 'verre'), it('L’assiette', 'assiette'), it('Le billet', 'billet'), it('Le téléphone', 'telephone'), it('Le sac', 'sac')] }
}
