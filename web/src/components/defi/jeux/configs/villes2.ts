import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// San-Pédro's and Korhogo's actions (the updates « sanpedro-vivant », « korhogo-vivant », backend
// game/villes2.go), each its own little game. The crane, the pirogue, the Taï forest, the loom and the
// market's toile have games of their own (components/defi/GrueCacao.tsx, PechePirogue.tsx, ForetTai.tsx,
// Tissage.tsx, epreuves/ToileKorhogo.tsx).
export const JEUX_VILLES2: Record<string, Jeu> = {
  // San-Pédro: the port
  'port-visite': {
    engine: 'quiz', title: t('Le port de San-Pédro'), how: t('L’agent du port te fait visiter les quais : réponds à ses questions.'), decor: 'bitume', host: 'guide',
    questions: [
      [t('San-Pédro est le premier port du monde pour…'), [t('Le cacao'), t('Le pétrole'), t('Les voitures')], 0],
      [t('Le cacao part dans des sacs en…'), [t('Plastique'), t('Jute'), t('Papier')], 1],
      [t('Avec le cacao, le port exporte aussi…'), [t('Du café, du bois, de l’huile de palme'), t('De la neige'), t('Des avions')], 0],
      [t('Le port a été ouvert en…'), [t('1971'), t('1931'), t('2011')], 0],
    ],
  },
  'port-cargos': {
    engine: 'photo', title: t('Les cargos du port'), how: t('Au bout du quai : prends en photo ce qu’on te montre quand c’est dans le cadre.'), decor: 'eau',
    subjects: [{ name: t('Le cargo'), prop: 'carton' }, { name: t('Le conteneur'), prop: 'colis' }, { name: t('La grue'), prop: 'drapeau' }, { name: t('La mouette'), prop: 'oiseau' }, { name: t('Le remorqueur'), prop: 'pirogue' }],
  },
  // The fishing port
  'peche-criee': {
    engine: 'choisir', title: t('Le retour des pirogues'), how: t('Les pêcheurs déchargent : touche le poisson que la fumeuse demande avant elle.'), decor: 'sable', caller: t('La fumeuse'),
    items: [{ name: t('La sardinelle'), prop: 'poisson-vivant' }, { name: t('Le capitaine'), prop: 'poisson' }, { name: t('Le crabe'), prop: 'crabe' }, { name: t('Le seau'), prop: 'seau' }, { name: t('Le coquillage'), prop: 'coquillage' }],
  },
  'peche-filets': {
    engine: 'nettoyer', title: t('Les filets à démêler'), how: t('Les herbes et les coquillages sont pris dans le filet : enlève-les un à un.'), decor: 'sable', object: 'filet', bit: 'feuille', verb: t('Démêle'), count: 12,
  },
  'peche-fume': {
    engine: 'attraper', title: t('Le poisson fumé'), how: t('La fumeuse retire les poissons du four : glisse le plateau dessous, laisse tomber les braises.'), decor: 'sable', from: 'marmite', into: 'plateau-service',
    good: [{ name: t('Le poisson fumé'), prop: 'poisson' }], bad: [{ name: t('La braise'), prop: 'flamme' }], count: 12,
  },
  // The Bardot, the cathedral
  'bardot-ambiance': {
    engine: 'rythme', title: t('Les nuits du Bardot'), how: t('De maquis en maquis : tape en rythme sur l’enceinte, le djembé et le micro.'), decor: 'scene', lanes: ['enceinte', 'djembe', 'micro'], tempo: 112,
  },
  'bardot-garba': {
    engine: 'choisir', title: t('Le garba du Bardot'), how: t('Le garbadrome est plein : touche ce que le vendeur annonce avant les autres.'), decor: 'table', caller: t('Le vendeur'),
    items: [{ name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le thon frit'), prop: 'poisson' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('La tomate'), prop: 'tomate' }],
  },
  'sp-cathedrale-visite': {
    engine: 'quiz', title: t('La cathédrale de San-Pédro'), how: t('Le prêtre te fait visiter : réponds à ses questions.'), decor: 'carrelage', host: 'pretre',
    questions: [
      [t('Dans une église, en entrant, on…'), [t('Parle fort'), t('Baisse la voix'), t('Court')], 1],
      [t('La grande messe, c’est le…'), [t('Dimanche'), t('Mardi'), t('Jeudi')], 0],
      [t('La cathédrale est l’église…'), [t('De l’évêque'), t('Du maire'), t('Du port')], 0],
    ],
  },
  // The beaches
  'monogaga-paillote': {
    engine: 'choisir', title: t('La paillote de Monogaga'), how: t('Sous la paillote, la serveuse annonce les plats : touche le bon avant la table voisine.'), decor: 'sable', caller: t('La serveuse'),
    items: [{ name: t('Le poisson braisé'), prop: 'poisson' }, { name: t('L’alloco'), prop: 'alloco' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('La noix de coco'), prop: 'noix-coco' }, { name: t('Le jus'), prop: 'jus' }],
  },
  'monogaga-rouleaux': {
    engine: 'course', title: t('Les rouleaux de Monogaga'), how: t('Nage entre les rouleaux : attrape les coquillages, évite les vagues qui cassent.'), decor: 'eau', mode: 'nage', good: 'coquillage', bad: 'vague',
  },
  'sirenes-tortues': {
    engine: 'photo', title: t('Les tortues de la Baie des Sirènes'), how: t('La nuit, sans lampe forte, avec l’écogarde : photographie ce qu’il te montre, de loin.'), decor: 'sable',
    subjects: [{ name: t('La tortue qui pond'), prop: 'tortue' }, { name: t('Les œufs dans le sable'), prop: 'bulle' }, { name: t('Le bébé tortue vers la mer'), prop: 'tortue' }, { name: t('La lune sur la baie'), prop: 'lune' }, { name: t('Le crabe'), prop: 'crabe' }],
  },
  'sirenes-crique': {
    engine: 'course', title: t('La crique des Sirènes'), how: t('Nage dans la crique entre les rochers : ramasse les coquillages, évite les rochers.'), decor: 'eau', mode: 'nage', good: 'coquillage', bad: 'caillou',
  },
  'campement-langouste': {
    engine: 'choisir', title: t('Le dîner face à la baie'), how: t('Le serveur annonce les plats : touche le bon avant la table d’à côté.'), decor: 'table', caller: t('Le serveur'),
    items: [{ name: t('La langouste grillée'), prop: 'crabe' }, { name: t('Le poisson'), prop: 'poisson' }, { name: t('Le riz'), prop: 'riz' }, { name: t('L’ananas'), prop: 'ananas' }, { name: t('Le cocktail'), prop: 'cocktail' }],
  },
  // The maquis, the club
  'merou-capitaine': {
    engine: 'choisir', title: t('Le capitaine du Mérou Braisé'), how: t('Le braiseur sort les poissons de la grille : touche celui qu’il annonce avant les autres clients.'), decor: 'table', caller: t('Le braiseur'),
    items: [{ name: t('Le capitaine braisé'), prop: 'poisson' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('L’alloco'), prop: 'alloco' }],
  },
  'merou-crabes': {
    engine: 'attraper', title: t('Crabes et crevettes'), how: t('La tantie fait sauter les crabes sur la braise : glisse l’assiette dessous, pas les braises.'), decor: 'table', from: 'poele', into: 'assiette',
    good: [{ name: t('Le crabe'), prop: 'crabe' }, { name: t('La crevette'), prop: 'poisson' }], bad: [{ name: t('La braise'), prop: 'flamme' }], count: 14,
  },
  'cargo-nuit': {
    engine: 'rythme', title: t('La nuit au Cargo Club'), how: t('Le DJ envoie le coupé-décalé : tape en rythme sur la platine, l’enceinte et le micro.'), decor: 'scene', lanes: ['platine', 'enceinte', 'micro'], tempo: 120,
  },
  'tai-hana': {
    engine: 'course', title: t('La Hana en pirogue'), how: t('Pagaie sur la rivière de la forêt : photographie les beaux coins, évite les troncs.'), decor: 'eau', mode: 'pirogue', good: 'appareil-photo', bad: 'caillou',
  },
  // Korhogo: the craft villages
  'waraniene-pagne': {
    engine: 'choisir', title: t('Les pagnes de la coopérative'), how: t('Le tisserand déplie ses pagnes : touche celui que la cliente demande avant elle.'), decor: 'etal', caller: t('Le tisserand'),
    items: [{ name: t('Le pagne indigo'), prop: 'pagne' }, { name: t('Le pagne blanc'), prop: 'tissu' }, { name: t('La bobine de coton'), prop: 'bobine' }, { name: t('Le boubou tissé'), prop: 'boubou' }, { name: t('Le sac tissé'), prop: 'sac' }],
  },
  'waraniene-coton': {
    engine: 'photo', title: t('Le coton filé'), how: t('Les femmes filent le coton au fuseau : prends en photo ce qu’on te montre.'), decor: 'terre',
    subjects: [{ name: t('La bobine'), prop: 'bobine' }, { name: t('La fileuse'), prop: 'tissu' }, { name: t('Le métier à tisser'), prop: 'machine-a-coudre' }, { name: t('La bande de pagne'), prop: 'pagne' }],
  },
  'fakaha-peindre': {
    engine: 'assembler', title: t('La toile de Fakaha'), how: t('Le peintre dicte les figures dans l’ordre : pose-les sur la toile comme il le dit.'), decor: 'terre', base: 'tableau',
    parts: [{ name: t('Le poisson'), prop: 'poisson-vivant' }, { name: t('L’oiseau calao'), prop: 'oiseau' }, { name: t('La tortue'), prop: 'tortue' }, { name: t('Le masque'), prop: 'masque' }, { name: t('Le crocodile'), prop: 'crocodile' }, { name: t('Le soleil'), prop: 'soleil' }],
  },
  'fakaha-toile': {
    engine: 'choisir', title: t('Les toiles du village'), how: t('Le peintre montre ses toiles : touche celle que tu veux avant le touriste d’à côté.'), decor: 'terre', caller: t('Le peintre'),
    items: [{ name: t('La toile aux poissons'), prop: 'tableau' }, { name: t('La toile au masque'), prop: 'masque' }, { name: t('La toile aux oiseaux'), prop: 'oiseau' }, { name: t('La toile à la tortue'), prop: 'tortue' }, { name: t('Le pinceau'), prop: 'stylo' }],
  },
  'koni-forge': {
    engine: 'rythme', title: t('La forge de Koni'), how: t('Le forgeron sort le fer rouge : frappe en rythme au marteau, souffle sur la braise, refroidis.'), decor: 'terre', lanes: ['marteau', 'flamme', 'goutte'], tempo: 92,
  },
  'koni-daba': {
    engine: 'choisir', title: t('Les outils de Koni'), how: t('Le forgeron montre ses outils : touche celui qu’on te demande avant les autres.'), decor: 'terre', caller: t('Le forgeron'),
    items: [{ name: t('La daba'), prop: 'pelle' }, { name: t('Le couteau'), prop: 'couteau' }, { name: t('Le marteau'), prop: 'marteau' }, { name: t('La marmite'), prop: 'marmite' }, { name: t('La clé'), prop: 'cle' }],
  },
  // The sacred wood (only its edge, nothing of what's inside)
  'poro-oree': {
    engine: 'repondre', title: t('L’orée du bois sacré'), how: t('Le guide du quartier t’explique comment se tenir au bois sacré : réponds comme il faut.'), decor: 'herbe', npc: 'vieux',
    lines: [
      [t('Ici commence le bois sacré du Poro. On entre ?'), [t('Non, on reste dehors, c’est réservé aux initiés.'), t('Oui, je veux tout voir.'), t('Je passe par derrière.')], 0],
      [t('Tu veux prendre des photos ?'), [t('Je photographie tout, même dedans.'), t('Seulement si tu me dis que c’est permis, et de l’extérieur.'), t('Je fais un direct sur Tikitoko.')], 1],
      [t('Ce qui se passe dans le Poro…'), [t('On le raconte à tout le monde.'), t('On ne le raconte pas : ça appartient aux initiés.'), t('On l’écrit sur un mur.')], 1],
      [t('Avant de partir, on fait quoi ?'), [t('On remercie les anciens du quartier.'), t('On ramasse une branche en souvenir.'), t('On crie.')], 0],
    ],
  },
  'poro-fromagers': {
    engine: 'photo', title: t('Les grands fromagers'), how: t('De l’extérieur, sans entrer : photographie ce que le guide te montre, à l’orée.'), decor: 'herbe',
    subjects: [{ name: t('Le grand fromager'), prop: 'plante' }, { name: t('Les feuilles'), prop: 'feuille' }, { name: t('L’oiseau'), prop: 'oiseau' }, { name: t('Le papillon'), prop: 'papillon' }],
  },
  // Mont Korhogo
  'mont-korhogo-monter': {
    engine: 'course', title: t('Le rocher de Korhogo'), how: t('Grimpe le rocher : ramasse les mangues tombées, évite les cailloux qui roulent.'), decor: 'terre', mode: 'pied', good: 'mangue', bad: 'caillou',
  },
  'mont-mangues': {
    engine: 'attraper', title: t('Les mangues du mont'), how: t('Un enfant secoue le manguier : glisse le panier dessous, laisse tomber les feuilles.'), decor: 'herbe', from: 'plante', into: 'seau',
    good: [{ name: t('La mangue'), prop: 'mangue' }], bad: [{ name: t('La feuille'), prop: 'feuille' }], count: 14,
  },
  'mont-coucher': {
    engine: 'photo', title: t('Le coucher de soleil sur Korhogo'), how: t('Du haut du rocher : prends en photo ce qu’on te montre.'), decor: 'terre',
    subjects: [{ name: t('Le soleil'), prop: 'soleil' }, { name: t('La mosquée'), prop: 'tapis-priere' }, { name: t('Les oiseaux'), prop: 'oiseau' }, { name: t('Les nuages'), prop: 'nuage' }],
  },
  // The market, the mosque
  'korhogo-cajou': {
    engine: 'choisir', title: t('Cajou et mangues'), how: t('La vendeuse annonce : touche ce qu’elle dit avant les autres clients.'), decor: 'etal', caller: t('La vendeuse'),
    items: [{ name: t('La mangue'), prop: 'mangue' }, { name: t('Les noix de cajou'), prop: 'caillou' }, { name: t('La banane'), prop: 'banane' }, { name: t('L’ananas'), prop: 'ananas' }, { name: t('Le piment'), prop: 'piment' }],
  },
  'korhogo-mosquee-visite': {
    engine: 'quiz', title: t('La grande mosquée de Korhogo'), how: t('L’imam fait visiter, pieds nus sur les tapis : réponds à ses questions.'), decor: 'carrelage', host: 'imam',
    questions: [
      [t('Avant d’entrer dans la salle de prière, on…'), [t('Garde ses chaussures'), t('Enlève ses chaussures'), t('Court')], 1],
      [t('Le jour de la grande prière, c’est…'), [t('Le vendredi'), t('Le lundi'), t('Le dimanche')], 0],
      [t('Du haut du minaret, le muezzin…'), [t('Appelle à la prière'), t('Vend des mangues'), t('Chante du zouglou')], 0],
    ],
  },
  // The maquis, the club
  'to-gombo': {
    engine: 'choisir', title: t('Le tô de Mama Sita'), how: t('Mama Sita sert : touche ce qu’elle annonce avant les autres clients.'), decor: 'table', caller: t('Mama Sita'),
    items: [{ name: t('Le tô'), prop: 'foutou' }, { name: t('La sauce gombo'), prop: 'marmite' }, { name: t('La sauce feuille'), prop: 'feuille' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’eau fraîche'), prop: 'sachet-eau' }],
  },
  'to-tchapalo': {
    engine: 'tenir', title: t('Le tchapalo'), how: t('Verse la bière de mil dans la calebasse, lâche avant que ça déborde.'), decor: 'table', object: 'calebasse', verb: t('Verse'), fill: 'liquide',
  },
  'to-balafon': {
    engine: 'rythme', title: t('Le balafon au maquis'), how: t('Le balafoniste joue : tape en rythme avec lui, sur le balafon, le djembé et la calebasse.'), decor: 'terre', lanes: ['balafon', 'djembe', 'calebasse'], tempo: 100,
  },
  'balafon-nuit': {
    engine: 'rythme', title: t('La nuit du Balafon Club'), how: t('Le groupe envoie le balafon électrique : tape en rythme sur le balafon, le djembé et l’enceinte.'), decor: 'scene', lanes: ['balafon', 'djembe', 'enceinte'], tempo: 116,
  },
}
