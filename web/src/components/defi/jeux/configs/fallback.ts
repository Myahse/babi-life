import type { Item, Jeu, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Any action without a game written for it: a game made from its icon (the kind of thing it is),
// titled with its label. Each icon family has its engine; an unknown icon gets the « choisir » default.

const it = (name: string, prop: PropId): Item => ({ name, prop })
type Make = (title: string) => Jeu

// The label as a title: no parenthesis, at most 30 characters.
const titleOf = (label: string) => {
  const t = label.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  return [...t].length > 30 ? [...t].slice(0, 29).join('').trimEnd() + '…' : t
}

const FOOD = [it(tr('Le garba'), 'garba'), it(tr('L’alloco'), 'alloco'), it(tr('Le poulet'), 'poulet'), it(tr('Le poisson'), 'poisson'), it(tr('Le riz'), 'riz'), it(tr('L’attiéké'), 'attieke')]
const PAPERS = [it(tr('La pièce d’identité'), 'passeport'), it(tr('Le dossier'), 'dossier'), it(tr('Le stylo'), 'stylo'), it(tr('Le tampon'), 'tampon'), it(tr('Le reçu'), 'ticket')]
const CHAT: [string, string[], number][] = [
  [tr('Eh, c’est comment ? Ça fait longtemps !'), [tr('On est là, Dieu merci ! Et toi ?'), 'Laisse-moi', tr('Hum')], 0],
  [tr('Tu as vu ce qui s’est passé au quartier ?'), [tr('Non, on dit quoi ?'), tr('Je m’en fiche'), tr('Va raconter ailleurs')], 0],
  [tr('Je suis un peu fatigué ces temps-ci…'), [tr('Tu dis ça ?'), tr('Courage, si tu as besoin, je suis là'), tr('C’est ton problème')], 1],
  [tr('Bon, on se voit bientôt alors ?'), [tr('Peut-être jamais'), tr('Bof'), tr('Avec plaisir, on s’appelle !')], 2],
]
const QUIZ: [string, string[], number][] = [
  [tr('La lagune d’Abidjan s’appelle…'), [tr('La lagune Ébrié'), tr('Le lac Kossou'), tr('La mer Rouge')], 0],
  [tr('La capitale politique de la Côte d’Ivoire, c’est…'), [tr('Bouaké'), tr('Yamoussoukro'), tr('Man')], 1],
  [tr('La Côte d’Ivoire est indépendante depuis…'), ['1945', '1980', '1960'], 2],
  [tr('L’attiéké est fait à partir de…'), [tr('Manioc'), tr('Maïs'), tr('Mil')], 0],
]

const eat: Make = (title) => ({ engine: 'choisir', title, how: tr('La tantie annonce ce qui est prêt : prends-le avant les autres mains.'), decor: 'etal', caller: tr('La tantie'), items: FOOD })
const cook: Make = (title) => ({ engine: 'assembler', title, how: tr('Mets chaque ingrédient dans la marmite, dans l’ordre de la recette.'), decor: 'table', base: 'marmite', parts: [it(tr('L’oignon'), 'oignon'), it(tr('La tomate'), 'tomate'), it(tr('Le piment'), 'piment'), it(tr('Le poisson'), 'poisson'), it(tr('Le riz'), 'riz')] })
const drink: Make = (title) => ({ engine: 'tenir', title, how: tr('Verse doucement : lâche quand le verre est plein, sans déborder.'), decor: 'comptoir', object: 'verre', verb: tr('Verse'), fill: 'liquide' })
const dance: Make = (title) => ({ engine: 'rythme', title, how: tr('Le son est lancé : tape chaque note pile sur la ligne.'), decor: 'parquet', lanes: ['enceinte', 'djembe', 'micro'] })
const drums: Make = (title) => ({ engine: 'rythme', title, how: tr('Les tambours parlent : suis-les en tapant sur la ligne.'), decor: 'terre', lanes: ['djembe', 'tam-tam', 'balafon'] })
const dj: Make = (title) => ({ engine: 'rythme', title, how: tr('Aux platines : enchaîne les sons juste sur le temps.'), decor: 'scene', lanes: ['platine', 'note-musique', 'enceinte'] })
const songs: Make = (title) => ({ engine: 'rythme', title, how: tr('Les chants commencent : suis l’assemblée en tapant sur la ligne.'), decor: 'parquet', lanes: ['tam-tam', 'micro', 'guitare'], tempo: 90 })
const pray: Make = (title) => ({ engine: 'tenir', title, how: tr('Respire et concentre-toi : relâche quand ton cœur est calme.'), decor: 'carrelage', object: 'bougie', verb: tr('Recueille-toi'), fill: 'force', times: 3 })
const foot: Make = (title) => ({ engine: 'viser', title, how: tr('Vise le coin du but et dose ta frappe pour marquer.'), decor: 'herbe', projectile: 'ballon-foot', target: 'but' })
const basket: Make = (title) => ({ engine: 'viser', title, how: tr('Vise le panier, dose ta force : marque un maximum de paniers.'), decor: 'piste', projectile: 'ballon-basket', target: 'panier-basket' })
const lift: Make = (title) => ({ engine: 'tenir', title, how: tr('Pousse fort : relâche quand la jauge est dans le vert, pas avant.'), decor: 'parquet', object: 'haltere', verb: tr('Soulève'), fill: 'force' })
const run: Make = (title) => ({ engine: 'course', title, how: tr('Avance : prends les sachets d’eau, évite les cailloux.'), decor: 'piste', mode: 'pied', good: 'sachet-eau', bad: 'caillou' })
const swim: Make = (title) => ({ engine: 'course', title, how: tr('Nage : attrape les bouées, évite les crabes.'), decor: 'eau', mode: 'nage', good: 'bouee', bad: 'crabe' })
const paddle: Make = (title) => ({ engine: 'course', title, how: tr('Pagaie sur l’eau : ramasse les coquillages, évite les vagues.'), decor: 'eau', mode: 'pirogue', good: 'coquillage', bad: 'vague' })
const bike: Make = (title) => ({ engine: 'course', title, how: tr('Pédale : prends les sachets d’eau, évite les cailloux.'), decor: 'bitume', mode: 'velo', good: 'sachet-eau', bad: 'caillou' })
const kart: Make = (title) => ({ engine: 'course', title, how: tr('Pied au plancher : prends l’essence, évite les quilles.'), decor: 'piste', mode: 'kart', good: 'essence', bad: 'quille' })
const climb: Make = (title) => ({ engine: 'equilibre', title, how: tr('Ça monte : garde ton sac bien droit jusqu’en haut.'), decor: 'terre', carry: 'sac', verb: tr('Monte') })
const look = (subjects: Item[], decor: Jeu['decor'] = 'herbe'): Make => (title) => ({ engine: 'photo', title, how: tr('Regarde bien : déclenche quand le plus beau passe dans le cadre.'), decor, subjects })
const learn: Make = (title) => ({ engine: 'quiz', title, how: tr('On te pose des questions : trouve la bonne réponse.'), decor: 'bureau', host: 'prof', questions: QUIZ })
const papers: Make = (title) => ({ engine: 'choisir', title, how: tr('L’agent demande une pièce : donne-lui la bonne, sans te tromper.'), decor: 'comptoir', caller: tr('L’agent'), items: PAPERS })
const shop = (caller: string, items: Item[], decor: Jeu['decor'] = 'etal'): Make => (title) => ({ engine: 'choisir', title, how: tr('{caller} te montre ce qu’il te faut : touche le bon avant les autres.', { caller }), decor, caller, items })
const market: Make = (title) => ({ engine: 'attraper', title, how: tr('La vendeuse te lance les bons produits : attrape-les, laisse tomber les abîmés.'), decor: 'etal', from: 'carton', into: 'sac', good: [it(tr('La tomate'), 'tomate'), it(tr('L’oignon'), 'oignon'), it(tr('La mangue'), 'mangue'), it(tr('La banane'), 'banane')], bad: [it(tr('Le caillou'), 'caillou'), it(tr('La feuille'), 'feuille')] })
const haircut: Make = (title) => ({ engine: 'nettoyer', title, how: tr('Passe sur chaque cheveu qui dépasse pour une coupe bien nette.'), decor: 'carrelage', object: 'miroir', bit: 'cheveu', verb: tr('Coupe') })
const beauty: Make = (title) => ({ engine: 'assembler', title, how: tr('Passe chaque chose dans l’ordre annoncé : peigne, crème, mèches…'), decor: 'carrelage', base: 'meche', parts: [it(tr('Le peigne'), 'peigne'), it(tr('La crème'), 'creme'), it(tr('La mèche'), 'meche'), it(tr('Le bigoudi'), 'bigoudi'), it(tr('La fleur'), 'fleur')] })
const clean = (object: PropId, bit: PropId, verb: string, decor: Jeu['decor'] = 'carrelage'): Make => (title) => ({ engine: 'nettoyer', title, how: tr('{verb} chaque trace jusqu’à ce que ce soit tout propre.', { verb }), decor, object, bit, verb })
const chat: Make = (title) => ({ engine: 'repondre', title, how: tr('On te parle : choisis la réponse qui fait plaisir.'), decor: 'parquet', npc: 'ami', lines: CHAT })
const rally: Make = (title) => ({ engine: 'rythme', title, how: tr('Scande en rythme avec la foule, dans la bonne humeur : tape sur la ligne.'), decor: 'bitume', lanes: ['megaphone', 'drapeau', 'sifflet'] })
const care: Make = (title) => ({ engine: 'choisir', title, how: tr('Le docteur demande un outil ou un médicament : donne-lui le bon.'), decor: 'comptoir', caller: tr('Le docteur'), items: [it(tr('Le stéthoscope'), 'stethoscope'), it(tr('Les comprimés'), 'medicament'), it(tr('Le thermomètre'), 'thermometre'), it(tr('Le pansement'), 'pansement'), it(tr('Le tensiomètre'), 'tensiometre')] })
const rest: Make = (title) => ({ engine: 'tenir', title, how: tr('Respire tout doucement : relâche quand tu es bien détendu.'), decor: 'parquet', object: 'coussin', verb: tr('Respire'), fill: 'force', times: 3 })
const carry: Make = (title) => ({ engine: 'equilibre', title, how: tr('La brouette est pleine : garde-la droite jusqu’au bout du chantier.'), decor: 'terre', carry: 'brouette', verb: tr('Pousse') })
const money: Make = (title) => ({ engine: 'attraper', title, how: tr('L’argent arrive : attrape les pièces et les billets, laisse tomber le reste.'), decor: 'table', from: 'sac', into: 'calebasse', good: [it(tr('La pièce'), 'piece'), it(tr('Le billet'), 'billet')], bad: [it(tr('Le caillou'), 'caillou'), it(tr('La feuille'), 'feuille')] })
const gifts: Make = (title) => ({ engine: 'attraper', title, how: tr('Les cadeaux arrivent : attrape-les tous, laisse tomber les cailloux.'), decor: 'parquet', from: 'ballon-fete', into: 'carton', good: [it(tr('Le cadeau'), 'cadeau'), it(tr('Le jouet'), 'jouet'), it(tr('Le bonbon'), 'bonbon'), it(tr('La peluche'), 'peluche')], bad: [it(tr('Le caillou'), 'caillou')] })
const games: Make = (title) => ({ engine: 'choisir', title, how: tr('Le croupier annonce : touche le bon jeton ou la bonne carte avant les autres.'), decor: 'table', caller: tr('Le croupier'), items: [it(tr('Le jeton'), 'jeton'), it(tr('La carte'), 'carte-jeu'), it(tr('Le dé'), 'de'), it(tr('Le damier'), 'damier')] })
const baby: Make = (title) => ({ engine: 'tenir', title, how: tr('Remplis le biberon : lâche quand c’est juste à la bonne mesure.'), decor: 'table', object: 'biberon', verb: tr('Remplis'), fill: 'liquide' })
const office: Make = (title) => ({ engine: 'assembler', title, how: tr('Monte le dossier dans l’ordre : pièce, formulaire, signature, tampon.'), decor: 'bureau', base: 'dossier', parts: [it(tr('La pièce'), 'passeport'), it(tr('Le formulaire'), 'cahier'), it(tr('La signature'), 'stylo'), it(tr('Le tampon'), 'tampon')] })
const travel: Make = (title) => ({ engine: 'equilibre', title, how: tr('Ta valise est lourde : garde-la droite jusqu’au bout du couloir.'), decor: 'carrelage', carry: 'valise', verb: tr('Roule') })

const BY_ICON: Record<string, Make> = {
  // Eating, cooking
  utensils: eat, fish: eat, drumstick: eat, soup: eat, sandwich: eat, apple: eat, banana: eat, cherry: eat,
  hamburger: (t) => ({ engine: 'assembler', title: t, how: tr('Monte le burger étage par étage, dans le bon ordre.'), decor: 'comptoir', base: 'pain', parts: [it(tr('Le steak'), 'burger'), it(tr('La tomate'), 'tomate'), it(tr('L’oignon'), 'oignon'), it(tr('Le pain du dessus'), 'pain')] }),
  'ice-cream-cone': shop(tr('Le glacier'), [it(tr('La glace'), 'glace'), it(tr('Le gâteau'), 'gateau'), it(tr('Le jus'), 'jus'), it(tr('Le bonbon'), 'bonbon')], 'comptoir'),
  cake: (t) => ({ engine: 'assembler', title: t, how: tr('Décore le gâteau dans l’ordre demandé, bougies à la fin.'), decor: 'table', base: 'gateau', parts: [it(tr('Les bonbons'), 'bonbon'), it(tr('L’étoile'), 'etoile'), it(tr('Le cœur'), 'coeur'), it(tr('Les bougies'), 'bougie')] }),
  popcorn: (t) => ({ engine: 'attraper', title: t, how: tr('Le pop-corn saute : attrape-le dans le pot, laisse tomber les flammes.'), decor: 'table', from: 'marmite', into: 'verre', good: [it(tr('Le pop-corn'), 'popcorn')], bad: [it(tr('La flamme'), 'flamme')] }),
  flame: (t) => ({ engine: 'tenir', title: t, how: tr('Sur la braise : lâche quand c’est bien doré, pas brûlé.'), decor: 'etal', object: 'brochette', verb: tr('Grille'), fill: 'chaleur' }),
  'cooking-pot': cook, 'chef-hat': cook,
  // Drinking
  'cup-soda': drink, beer: drink, coffee: drink, milk: drink, martini: drink, 'glass-water': drink, droplet: drink,
  citrus: (t) => ({ engine: 'tenir', title: t, how: tr('Verse l’eau de coco dans le verre : lâche quand il est plein.'), decor: 'sable', object: 'noix-coco', verb: tr('Verse'), fill: 'liquide' }),
  // Party, music
  music: dance, 'party-popper': dance, crown: dance, piano: dance, drum: drums, 'disc-3': dj,
  drama: look([it(tr('Le masque'), 'masque'), it(tr('La statue'), 'statue'), it(tr('Le tableau'), 'tableau'), it(tr('Le clap'), 'clap')], 'scene'),
  // Sport
  volleyball: foot, trophy: basket, dumbbell: lift, footprints: run, swords: run, bike, car: kart, waves: swim, sailboat: paddle, mountain: climb,
  // Worship
  church: songs, moon: pray, 'hand-heart': pray, 'heart-handshake': pray,
  // Seeing, visiting
  tv: look([it(tr('L’écran'), 'ecran'), it(tr('Le ballon'), 'ballon-foot'), it(tr('Le micro'), 'micro'), it(tr('Le trophée'), 'trophee')], 'parquet'),
  clapperboard: look([it(tr('L’écran'), 'ecran'), it(tr('La caméra'), 'camera'), it(tr('Le clap'), 'clap'), it(tr('L’affiche'), 'affiche')], 'scene'),
  camera: look([it(tr('Le palmier'), 'palmier'), it(tr('L’oiseau'), 'oiseau'), it(tr('Le soleil'), 'soleil'), it(tr('Le drapeau'), 'drapeau')]),
  eye: look([it(tr('Le ballon'), 'ballon-foot'), it(tr('L’oiseau'), 'oiseau'), it(tr('Le papillon'), 'papillon'), it(tr('Le nuage'), 'nuage')]),
  landmark: look([it(tr('La statue'), 'statue'), it(tr('Le masque'), 'masque'), it(tr('Le drapeau'), 'drapeau'), it(tr('Le tableau'), 'tableau')], 'carrelage'),
  castle: look([it(tr('La statue'), 'statue'), it(tr('Le drapeau'), 'drapeau'), it(tr('Le palmier'), 'palmier')], 'carrelage'),
  'building-2': look([it(tr('L’avion'), 'avion'), it(tr('Le nuage'), 'nuage'), it(tr('Le soleil'), 'soleil'), it(tr('L’oiseau'), 'oiseau')], 'ciel'),
  bird: look([it(tr('L’oiseau'), 'oiseau'), it(tr('Le perroquet'), 'perroquet'), it(tr('Le papillon'), 'papillon')]),
  'paw-print': look([it(tr('Le lion'), 'lion'), it(tr('La girafe'), 'girafe'), it(tr('L’éléphant'), 'elephant'), it(tr('Le singe'), 'singe'), it(tr('Le crocodile'), 'crocodile')]),
  sunset: look([it(tr('Le soleil'), 'soleil'), it(tr('La pirogue'), 'pirogue'), it(tr('Le cocotier'), 'cocotier'), it(tr('L’oiseau'), 'oiseau')], 'sable'),
  'tree-palm': look([it(tr('Le cocotier'), 'cocotier'), it(tr('La vague'), 'vague'), it(tr('Le crabe'), 'crabe'), it(tr('Le coquillage'), 'coquillage')], 'sable'),
  palette: look([it(tr('Le tableau'), 'tableau'), it(tr('La statue'), 'statue'), it(tr('Le masque'), 'masque'), it(tr('L’affiche'), 'affiche')], 'carrelage'),
  plane: look([it(tr('L’avion'), 'avion'), it(tr('Le nuage'), 'nuage'), it(tr('Le soleil'), 'soleil'), it(tr('L’oiseau'), 'oiseau')], 'ciel'),
  'flower-2': beauty, sparkles: beauty, gem: shop(tr('La vendeuse'), [it(tr('Le collier'), 'collier'), it(tr('La montre'), 'montre'), it(tr('Le parfum'), 'parfum'), it(tr('Les lunettes'), 'lunettes')], 'comptoir'),
  // Learning, papers
  library: learn, 'book-open': learn, newspaper: learn, 'notebook-pen': learn, presentation: learn, 'graduation-cap': learn,
  'file-text': office, stamp: papers, shield: papers, 'id-card': papers, gavel: papers, briefcase: office,
  // Shopping
  'shopping-bag': shop(tr('La vendeuse'), [it(tr('Le sac'), 'sac'), it(tr('La chaussure'), 'chaussure'), it(tr('La casquette'), 'casquette'), it(tr('Les lunettes'), 'lunettes'), it(tr('Le parfum'), 'parfum')], 'etagere'),
  shirt: shop(tr('La vendeuse'), [it(tr('Le pagne wax'), 'pagne'), it(tr('La robe'), 'robe'), it(tr('Le boubou'), 'boubou'), it(tr('La chemise'), 'chemise')]),
  store: shop(tr('Le commerçant'), [it(tr('Le savon'), 'savon'), it(tr('Le pain'), 'pain'), it(tr('Le soda'), 'soda'), it(tr('Le sachet d’eau'), 'sachet-eau'), it(tr('Le riz'), 'riz')], 'comptoir'),
  'shopping-cart': shop(tr('La caissière'), [it(tr('Le riz'), 'riz'), it(tr('Le jus'), 'jus'), it(tr('Le savon'), 'savon'), it(tr('Le pain'), 'pain'), it(tr('La tomate'), 'tomate')], 'comptoir'),
  'shopping-basket': market,
  gift: gifts, 'piggy-bank': money, banknote: money, 'dice-5': games, baby,
  // Hair, cleaning
  scissors: haircut,
  'brush-cleaning': clean('tapis', 'poussiere', tr('Balaie')), shovel: clean('seau', 'tache', tr('Racle'), 'terre'), toothbrush: clean('miroir', 'mousse', tr('Brosse')),
  bath: clean('serviette', 'mousse', tr('Rince')), 'shower-head': clean('serviette', 'mousse', tr('Rince')), toilet: clean('seau', 'tache', tr('Nettoie')),
  // Talking
  users: chat, 'messages-square': chat, phone: chat, smartphone: chat, handshake: chat, heart: chat, mail: chat,
  megaphone: rally, flag: rally,
  // Health
  stethoscope: care, pill: care, syringe: care, 'heart-pulse': care, hospital: care,
  // Resting, waiting
  sofa: rest, bed: rest, 'bed-single': rest, armchair: rest, umbrella: rest, hourglass: rest,
  // Work, travel
  'hard-hat': carry, hotel: (t) => ({ engine: 'assembler', title: t, how: tr('Prépare le plateau du client dans l’ordre de la commande.'), decor: 'comptoir', base: 'plateau-service', parts: [it(tr('Le café'), 'cafe'), it(tr('Le croissant'), 'croissant'), it(tr('Le jus'), 'jus'), it(tr('La serviette'), 'serviette')] }),
  bus: travel, luggage: travel,
}

/** Any action without a game written for it: one made from what it is (its icon, its name). */
export function fallbackFor(act: { id: string; icon: string; label: string }): Jeu {
  const title = titleOf(act.label)
  const make = BY_ICON[act.icon]
  if (make) return make(title)
  // Unknown icon: pick the right thing the person asks for (works for almost anything).
  return { engine: 'choisir', title, how: tr('On te demande quelque chose : touche le bon avant les autres.'), decor: 'table', caller: tr('On te demande'), items: [it(tr('Le verre'), 'verre'), it(tr('L’assiette'), 'assiette'), it(tr('Le billet'), 'billet'), it(tr('Le téléphone'), 'telephone'), it(tr('Le sac'), 'sac')] }
}
