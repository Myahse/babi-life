import type { Jeu } from '../types'

export const JEUX_2: Record<string, Jeu> = {
  // Happenings in the street
  'label:Présenter ses condoléances': {
    engine: 'repondre', title: 'Les condoléances', how: 'Le vieux de la famille t’accueille : trouve les mots justes, doux et respectueux.', decor: 'parquet', npc: 'vieux',
    lines: [
      ['Merci d’être venu, mon fils. Ça nous touche.', ['Je suis de tout cœur avec vous, papa.', 'Y a à manger ici ?', 'Je passais seulement.'], 0],
      ['Il était bon, il aidait tout le quartier.', ['Ah bon ? Je savais pas.', 'Oui, tout le monde se souvient de sa gentillesse.', 'On parle d’autre chose ?'], 1],
      ['Asseyons-nous un peu, la famille est là.', ['Je dois filer, désolé.', 'J’ai pas le temps hein.', 'Avec plaisir, je reste avec vous un moment.'], 2],
      ['Que Dieu te le rende.', ['Courage à toute la famille.', 'Bon, c’est fini ?', 'Tu me dois rien.'], 0],
    ],
  },
  'label:Regarder le match': {
    engine: 'quiz', title: 'Devant le match', how: 'Ton ami teste tes connaissances de foot pendant le match : réponds juste !', decor: 'bitume', host: 'ami',
    questions: [
      ['Le surnom de l’équipe de Côte d’Ivoire ?', ['Les Lions', 'Les Éléphants', 'Les Aigles'], 1],
      ['Combien de joueurs par équipe sur le terrain ?', ['11', '9', '13'], 0],
      ['Combien de CAN la Côte d’Ivoire a gagnées ?', ['Une', 'Deux', 'Trois'], 2],
      ['Où s’est jouée la CAN 2023 ?', ['Au Sénégal', 'En Côte d’Ivoire', 'Au Ghana'], 1],
    ],
  },
  'label:Regarder les masques': {
    engine: 'photo', title: 'La sortie des masques', how: 'Les masques dansent sur la place : tape quand l’un d’eux passe dans le cadre.', decor: 'terre',
    subjects: [{ name: 'Le grand masque', prop: 'masque' }, { name: 'Le tam-tam', prop: 'tam-tam' }, { name: 'Le djembé', prop: 'djembe' }, { name: 'La statue', prop: 'statue' }, { name: 'La calebasse', prop: 'calebasse' }],
  },
  "label:S'abriter sous un auvent": {
    engine: 'course', title: 'Sauve-toi de la pluie', how: 'Il pleut fort : cours d’auvent en auvent, ramasse les journaux, évite les gouttes.', decor: 'bitume', mode: 'pied', good: 'journal', bad: 'goutte',
  },
  'label:Se joindre aux collègues': {
    engine: 'repondre', title: 'Avec les collègues', how: 'Les collègues t’accueillent dans le groupe : réponds avec bonne humeur.', decor: 'bitume', npc: 'collegue',
    lines: [
      ['Eh, c’est toi ! Viens t’asseoir avec nous.', ['Merci, je suis content de vous voir !', 'Non, je préfère rester seul.', 'Vous faites quoi là ?'], 0],
      ['On parlait du chef, il est en forme ce matin.', ['Il est nul, hein.', 'Ah, c’est bien, ça va faire une bonne journée !', 'Je m’en fous.'], 1],
      ['Tu prends quelque chose ? C’est ma tournée.', ['Rien, garde ton argent.', 'Je prends le plus cher !', 'Un jus, merci. La prochaine c’est pour moi !'], 2],
    ],
  },
  'label:Suivre le défilé': {
    engine: 'rythme', title: 'Le défilé', how: 'La fanfare passe : tape le tam-tam, le sifflet et le drapeau pile sur la ligne.', decor: 'bitume', lanes: ['tam-tam', 'sifflet', 'drapeau'],
  },

  // Health: the clinic
  consultation: {
    engine: 'repondre', title: 'Chez le docteur', how: 'Le médecin t’ausculte et te pose des questions : réponds-lui franchement.', decor: 'carrelage', npc: 'medecin',
    lines: [
      ['Bonjour ! Qu’est-ce qui t’amène ?', ['J’ai mal à la tête depuis deux jours.', 'Rien, je suis venu voir.', 'Devinez !'], 0],
      ['Tu bois assez d’eau dans la journée ?', ['Non, que du soda.', 'Pas trop, je vais faire plus attention.', 'L’eau, c’est pour les poissons.'], 1],
      ['Prends ce traitement trois jours, et repose-toi.', ['Je prendrai tout d’un coup.', 'Trois jours ? C’est long.', 'D’accord docteur, merci beaucoup.'], 2],
    ],
  },
  'visite-malade': {
    engine: 'assembler', title: 'Le panier du malade', how: 'Garnis le panier dans l’ordre demandé avant d’entrer dans la chambre.', decor: 'carrelage', base: 'sac',
    parts: [{ name: 'Les mangues', prop: 'mangue' }, { name: 'Les bananes', prop: 'banane' }, { name: 'Le jus', prop: 'jus' }, { name: 'L’eau', prop: 'sachet-eau' }, { name: 'Les fleurs', prop: 'fleur' }],
  },
  'work:sante': {
    engine: 'tenir', title: 'Prendre la tension', how: 'Gonfle le brassard en tenant, et lâche pile dans le vert pour lire la tension.', decor: 'carrelage', object: 'tensiometre', verb: 'Gonfle', fill: 'force',
  },

  // Home: the family house
  'call-family': {
    engine: 'repondre', title: 'Allô, le village ?', how: 'Maman est au bout du fil depuis le village : réponds-lui avec tendresse.', decor: 'parquet', npc: 'maman',
    lines: [
      ['Allô, mon enfant ? On t’entend pas depuis !', ['Pardon maman, je pense à vous chaque jour.', 'J’étais occupé.', 'Qui est à l’appareil ?'], 0],
      ['Tu manges bien à Abidjan ?', ['Que du pain.', 'Oui maman, mais ton foutou me manque !', 'Ça te regarde pas.'], 1],
      ['Ton grand-père te salue beaucoup.', ['Ah, il est encore là ?', 'Ok.', 'Salue-le fort pour moi, je viens bientôt !'], 2],
    ],
  },
  dents: {
    engine: 'nettoyer', title: 'Le sourire blanc', how: 'Devant le miroir, brosse chaque tache jusqu’à avoir un sourire qui brille.', decor: 'carrelage', object: 'miroir', bit: 'tache', verb: 'Brosse',
  },
  devoirs: {
    engine: 'quiz', title: 'Les devoirs', how: 'Papa vérifie tes devoirs : trouve la bonne réponse à chaque question.', decor: 'parquet', host: 'papa',
    questions: [
      ['7 × 8, ça fait combien ?', ['54', '56', '64'], 1],
      ['La capitale politique de la Côte d’Ivoire ?', ['Yamoussoukro', 'Bouaké', 'Abidjan'], 0],
      ['Le pluriel de « cheval » ?', ['Chevals', 'Chevaux', 'Chevaus'], 1],
      ['Le plus long fleuve de Côte d’Ivoire ?', ['Le Bandama', 'Le Sassandra', 'La Comoé'], 2],
    ],
  },
  jouets: {
    engine: 'choisir', title: 'Le coffre à jouets', how: 'Maman nomme un jouet : touche-le avant que ton petit frère l’attrape.', decor: 'parquet', caller: 'Maman',
    items: [{ name: 'La petite voiture', prop: 'jouet' }, { name: 'Le nounours', prop: 'peluche' }, { name: 'Le ballon', prop: 'ballon-foot' }, { name: 'Le dé', prop: 'de' }, { name: 'Le ballon de fête', prop: 'ballon-fete' }],
  },
  nager: {
    engine: 'course', title: 'Longueurs à la piscine', how: 'Nage d’un bout à l’autre : attrape les bouées, évite les feuilles qui flottent.', decor: 'eau', mode: 'nage', good: 'bouee', bad: 'feuille',
  },
  'premier-mot': {
    engine: 'repondre', title: 'Le premier mot', how: 'Maman te parle doucement : réponds-lui en bébé, avec le bon petit mot.', decor: 'parquet', npc: 'maman',
    lines: [
      ['Dis « maman », mon bébé… Ma-man !', ['Ma… ma… maman !', 'Brrrr !', 'Ouin ouin !'], 0],
      ['Oh, il a parlé ! Et papa ? Pa-pa ?', ['Gâteau !', 'Pa… papa !', 'Atchoum !'], 1],
      ['Tu veux ton biberon ?', ['Non !', 'Ba-ba-ba…', 'Ouiii, bibi !'], 2],
    ],
  },
  toilettes: {
    engine: 'course', title: 'Urgence !', how: 'Vite, cours jusqu’aux toilettes : prends la serviette, évite les jouets qui traînent.', decor: 'parquet', mode: 'pied', good: 'serviette', bad: 'jouet',
  },
  'watch-tv': {
    engine: 'photo', title: 'Ce soir sur RTI 1', how: 'Tu zappes : tape quand ton émission préférée passe dans l’écran.', decor: 'parquet',
    subjects: [{ name: 'Le journal', prop: 'micro' }, { name: 'Le match', prop: 'ballon-foot' }, { name: 'Le clip', prop: 'note-musique' }, { name: 'La météo', prop: 'soleil' }, { name: 'Le feuilleton', prop: 'coeur' }],
  },

  // Hotel: the big hotel by the lagoon
  'bar-hotel': {
    engine: 'choisir', title: 'Au bar de l’hôtel', how: 'Ton ami commande : touche le bon verre avant que le barman serve la table d’à côté.', decor: 'comptoir', caller: 'Ton ami',
    items: [{ name: 'La bière', prop: 'biere' }, { name: 'Le cocktail', prop: 'cocktail' }, { name: 'Le jus', prop: 'jus' }, { name: 'Le soda', prop: 'soda' }, { name: 'Le café', prop: 'cafe' }],
  },
  'brunch-lagune': {
    engine: 'assembler', title: 'Brunch face à la lagune', how: 'Compose ton assiette dans l’ordre que tu as en tête, face à l’eau.', decor: 'table', base: 'assiette',
    parts: [{ name: 'Le croissant', prop: 'croissant' }, { name: 'Le pain', prop: 'pain' }, { name: 'La mangue', prop: 'mangue' }, { name: 'L’ananas', prop: 'ananas' }, { name: 'Le poulet', prop: 'poulet' }],
  },
  'casino-ivoire': {
    engine: 'attraper', title: 'Le jackpot', how: 'La machine crache : attrape les jetons et les pièces, laisse tomber les cartes perdantes.', decor: 'parquet', from: 'ecran', into: 'sac',
    good: [{ name: 'Le jeton', prop: 'jeton' }, { name: 'La pièce', prop: 'piece' }, { name: 'Le billet', prop: 'billet' }],
    bad: [{ name: 'La carte perdante', prop: 'carte-jeu' }, { name: 'Le dé', prop: 'de' }],
  },
  'chambre-bain': {
    engine: 'tenir', title: 'Le bain moussant', how: 'Tiens pour faire couler l’eau chaude, lâche quand la mousse arrive dans le vert.', decor: 'carrelage', object: 'bulle', verb: 'Fais couler', fill: 'liquide',
  },
  'chambre-douche': {
    engine: 'nettoyer', title: 'La douche', how: 'Sous l’eau bien chaude, rince chaque bout de mousse jusqu’au dernier.', decor: 'carrelage', object: 'eponge', bit: 'mousse', verb: 'Rince',
  },
  'chambre-sieste': {
    engine: 'attraper', title: 'Les beaux rêves', how: 'Attrape les beaux rêves sur ton oreiller, laisse tomber le téléphone qui sonne.', decor: 'parquet', from: 'nuage', into: 'coussin',
    good: [{ name: 'L’étoile', prop: 'etoile' }, { name: 'La lune', prop: 'lune' }, { name: 'Le cœur', prop: 'coeur' }],
    bad: [{ name: 'Le téléphone', prop: 'telephone' }, { name: 'Le réveil', prop: 'montre' }],
  },
  'chambre-tele': {
    engine: 'choisir', title: 'Télé au lit', how: 'Le programme annonce une émission : touche-la avant que ça zappe.', decor: 'parquet', caller: 'Le programme',
    items: [{ name: 'Le film', prop: 'clap' }, { name: 'Le match', prop: 'ballon-foot' }, { name: 'Le clip', prop: 'note-musique' }, { name: 'Le talk-show', prop: 'micro' }, { name: 'Le documentaire', prop: 'lion' }],
  },
  'cinema-ivoire': {
    engine: 'photo', title: 'Au Ciné Ivoire', how: 'Le film défile : tape au bon moment pour garder les plus belles scènes.', decor: 'scene',
    subjects: [{ name: 'Le héros', prop: 'camera' }, { name: 'L’avion', prop: 'avion' }, { name: 'Le lion', prop: 'lion' }, { name: 'La course-poursuite', prop: 'kart' }, { name: 'Le trophée', prop: 'trophee' }],
  },
  'lobby-ivoire': {
    engine: 'repondre', title: 'Dans le grand hall', how: 'Un touriste perdu te demande conseil : réponds-lui en vrai Abidjanais.', decor: 'carrelage', npc: 'touriste',
    lines: [
      ['Excusez-moi, où manger un bon garba ?', ['Au restaurant de l’hôtel, c’est pareil.', 'Demande à la tantie du carrefour, c’est le meilleur !', 'Je sais pas.'], 1],
      ['C’est quoi un woro-woro ?', ['Un taxi collectif, pas cher et rapide.', 'Une danse.', 'Un plat de poisson.'], 0],
      ['Que veut dire « on dit quoi » ?', ['Au revoir.', 'C’est une insulte.', 'Ça veut dire « quoi de neuf ? »'], 2],
      ['Merci beaucoup, vous êtes gentil !', ['Bienvenue à Babi, profite bien !', 'C’est 1 000 F.', 'Hum.'], 0],
    ],
  },
  'piscine-hotel': {
    engine: 'course', title: 'Le grand bassin', how: 'Nage dans la piscine de l’hôtel : prends les bulles, évite les ballons des enfants.', decor: 'eau', mode: 'nage', good: 'bulle', bad: 'ballon-fete',
  },
  'rs-club': {
    engine: 'assembler', title: 'Le club sandwich', how: 'Monte ton club sandwich étage par étage, dans l’ordre de la recette.', decor: 'table', base: 'assiette',
    parts: [{ name: 'Le pain', prop: 'pain' }, { name: 'Le poulet', prop: 'poulet' }, { name: 'La tomate', prop: 'tomate' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'Les frites d’alloco', prop: 'alloco' }],
  },
  'rs-cocktail': {
    engine: 'tenir', title: 'Le cocktail du bar', how: 'Tiens pour verser le cocktail, lâche quand le verre est plein dans le vert.', decor: 'table', object: 'cocktail', verb: 'Verse', fill: 'liquide',
  },
  'rs-glace': {
    engine: 'attraper', title: 'La coupe de glace', how: 'Les boules et les fruits tombent : attrape-les dans la coupe, laisse tomber le piment !', decor: 'table', from: 'plateau-service', into: 'verre',
    good: [{ name: 'La boule de glace', prop: 'glace' }, { name: 'La mangue', prop: 'mangue' }, { name: 'L’ananas', prop: 'ananas' }, { name: 'Le bonbon', prop: 'bonbon' }],
    bad: [{ name: 'Le piment', prop: 'piment' }, { name: 'L’oignon', prop: 'oignon' }],
  },
  'rs-petitdej': {
    engine: 'equilibre', title: 'Petit-déj au lit', how: 'Porte le plateau jusqu’au lit sans renverser le café : penche à gauche, à droite.', decor: 'parquet', carry: 'plateau-service', verb: 'Porte',
  },
  'rs-poisson': {
    engine: 'tenir', title: 'Poisson braisé, attiéké', how: 'Pomme l’attiéké : tiens pour serrer la boule, lâche quand elle est bien ronde.', decor: 'table', object: 'attieke', verb: 'Pomme', fill: 'force',
  },
  'work:hotellerie': {
    engine: 'equilibre', title: 'Les bagages du client', how: 'Monte les valises du client jusqu’à sa chambre sans les faire tomber.', decor: 'carrelage', carry: 'valise', verb: 'Monte',
  },

  // Karting track
  'course-kart': {
    engine: 'course', title: 'Trois tours de kart', how: 'Fonce sur la piste : prends les étoiles, évite les plots.', decor: 'piste', mode: 'kart', good: 'etoile', bad: 'quille',
  },
  'regarder-kart': {
    engine: 'photo', title: 'Depuis la tribune', how: 'Les karts passent à toute vitesse : tape quand l’un d’eux est dans le cadre.', decor: 'piste',
    subjects: [{ name: 'Le kart rouge', prop: 'kart' }, { name: 'Le drapeau', prop: 'drapeau' }, { name: 'Le chrono', prop: 'chrono' }, { name: 'Le trophée', prop: 'trophee' }],
  },

  // Lagoon
  'balade-lagune': {
    engine: 'course', title: 'Au bord de la lagune', how: 'Promène-toi au bord de l’eau : ramasse les coquillages, évite les crabes.', decor: 'sable', mode: 'pied', good: 'coquillage', bad: 'crabe',
  },
  'coucher-soleil': {
    engine: 'tenir', title: 'Le soleil se couche', how: 'Tiens pendant que le soleil descend, lâche pile quand il touche la lagune.', decor: 'ciel', object: 'soleil', verb: 'Regarde', fill: 'chaleur',
  },
  'photo-plateau': {
    engine: 'photo', title: 'Les tours du Plateau', how: 'Depuis la rive, tape quand un beau sujet passe devant les tours du Plateau.', decor: 'eau',
    subjects: [{ name: 'La pirogue', prop: 'pirogue' }, { name: 'L’oiseau', prop: 'oiseau' }, { name: 'L’avion', prop: 'avion' }, { name: 'Le nuage', prop: 'nuage' }, { name: 'Le soleil', prop: 'soleil' }],
  },
  'ski-boulay': {
    engine: 'equilibre', title: 'Ski nautique', how: 'Le bateau tire : reste debout sur la planche en penchant à gauche et à droite.', decor: 'eau', carry: 'planche-surf', verb: 'Tiens debout',
  },
  'traversee-boulay': {
    engine: 'course', title: 'Cap sur l’île Boulay', how: 'Pagaie jusqu’à l’île : attrape les poissons, évite les grosses vagues.', decor: 'eau', mode: 'pirogue', good: 'poisson-vivant', bad: 'vague',
  },

  // Own home (logement)
  'logement-amis': {
    engine: 'choisir', title: 'Les amis sont là', how: 'Chaque ami demande à boire : sers-lui le bon avant qu’il se lève.', decor: 'parquet', caller: 'Ton ami',
    items: [{ name: 'Le soda', prop: 'soda' }, { name: 'Le jus', prop: 'jus' }, { name: 'La bière', prop: 'biere' }, { name: 'L’eau', prop: 'sachet-eau' }, { name: 'Le popcorn', prop: 'popcorn' }],
  },
  'logement-cuisiner': {
    engine: 'assembler', title: 'Ma sauce maison', how: 'Mets les ingrédients dans la marmite dans le bon ordre.', decor: 'table', base: 'marmite',
    parts: [{ name: 'L’oignon', prop: 'oignon' }, { name: 'La tomate', prop: 'tomate' }, { name: 'Le piment', prop: 'piment' }, { name: 'Le poisson', prop: 'poisson' }, { name: 'Le riz', prop: 'riz' }],
  },
  'logement-douche': {
    engine: 'tenir', title: 'La douche au seau', how: 'Pas d’eau au robinet : remplis le seau et lâche avant que ça déborde.', decor: 'carrelage', object: 'seau', verb: 'Remplis', fill: 'liquide',
  },
  'logement-sieste': {
    engine: 'repondre', title: 'La sieste', how: 'Le petit du voisin vient te réveiller : réponds-lui gentiment pour dormir en paix.', decor: 'parquet', npc: 'enfant',
    lines: [
      ['Tonton, tu dors ?', ['Oui, je fais un petit somme. Va jouer, champion !', 'Laisse-moi !', 'Non, je suis mort.'], 0],
      ['Je peux regarder la télé avec toi ?', ['Jamais.', 'Après ma sieste, promis.', 'Prends tout, la télé.'], 1],
      ['Maman a dit de te donner ça.', ['Pose ça par terre.', 'Je veux rien.', 'Merci mon grand, dis-lui merci !'], 2],
    ],
  },
  'logement-tele': {
    engine: 'quiz', title: 'Le jeu télé', how: 'Le jeu télé passe : réponds avant le candidat, ton ami compte les points.', decor: 'parquet', host: 'ami',
    questions: [
      ['Le plus grand port de Côte d’Ivoire ?', ['Abidjan', 'Korhogo', 'Man'], 0],
      ['L’attiéké est fait avec ?', ['Le riz', 'Le manioc', 'Le maïs'], 1],
      ['Les couleurs du drapeau ivoirien ?', ['Rouge, jaune, vert', 'Bleu, blanc, rouge', 'Orange, blanc, vert'], 2],
    ],
  },

  // City hall (mairie)
  'campagne-terrain': {
    engine: 'repondre', title: 'Campagne de terrain', how: 'Un électeur t’arrête : écoute-le et réponds avec respect et sincérité.', decor: 'bitume', npc: 'electeur',
    lines: [
      ['Vous, les candidats, on vous voit qu’en campagne !', ['Tu as raison, je viendrai après aussi, c’est promis.', 'C’est faux !', 'Vote et tais-toi.'], 0],
      ['Notre rue est pleine de trous.', ['C’est pas mon problème.', 'Je note, c’est une priorité pour le quartier.', 'Achète un 4×4.'], 1],
      ['Et pour les jeunes, tu fais quoi ?', ['Rien, ils ont qu’à chercher.', 'Les jeunes, c’est fatigant.', 'Des formations et des petits boulots, on en parle ?'], 2],
    ],
  },
  conseil: {
    engine: 'quiz', title: 'Le conseil municipal', how: 'Un ancien t’explique la séance : réponds à ses questions sur la commune.', decor: 'bureau', host: 'vieux',
    questions: [
      ['Qui dirige le conseil municipal ?', ['Le maire', 'Le juge', 'Le préfet de police'], 0],
      ['Qui élit les conseillers municipaux ?', ['Le président', 'Les habitants de la commune', 'Les voisins de la mairie'], 1],
      ['La mairie s’occupe de ?', ['L’armée', 'La monnaie', 'L’état civil et les marchés'], 2],
    ],
  },
  'etat-civil': {
    engine: 'assembler', title: 'Le dossier d’état civil', how: 'Monte ton dossier dans l’ordre que l’agent demande, sans rien oublier.', decor: 'bureau', base: 'dossier',
    parts: [{ name: 'Le formulaire', prop: 'cahier' }, { name: 'La pièce d’identité', prop: 'passeport' }, { name: 'Le timbre', prop: 'ticket' }, { name: 'Les frais', prop: 'piece' }, { name: 'La signature', prop: 'stylo' }],
  },
  legalisation: {
    engine: 'tenir', title: 'Le coup de tampon', how: 'Appuie sur le tampon et lâche quand la pression est dans le vert : pas de bavure !', decor: 'bureau', object: 'tampon', verb: 'Appuie', fill: 'force',
  },
  'mariage-civil': {
    engine: 'photo', title: 'Témoin du mariage', how: 'Tu es témoin, et photographe aussi : tape quand un beau moment passe.', decor: 'carrelage',
    subjects: [{ name: 'Les mariés', prop: 'coeur' }, { name: 'Le bouquet', prop: 'fleur' }, { name: 'Le gâteau', prop: 'gateau' }, { name: 'Les cadeaux', prop: 'cadeau' }, { name: 'Les ballons', prop: 'ballon-fete' }],
  },
  militer: {
    engine: 'rythme', title: 'Militer', how: 'Le cortège chante : tape le mégaphone, le sifflet et le drapeau en rythme.', decor: 'bitume', lanes: ['megaphone', 'sifflet', 'drapeau'],
  },
  'work:mairie': {
    engine: 'choisir', title: 'Au guichet', how: 'L’usager demande une pièce : donne-lui la bonne avant que la file s’énerve.', decor: 'bureau', caller: 'L’usager',
    items: [{ name: 'Le formulaire', prop: 'dossier' }, { name: 'Le tampon', prop: 'tampon' }, { name: 'Le stylo', prop: 'stylo' }, { name: 'Le ticket', prop: 'ticket' }, { name: 'Le registre', prop: 'livre' }],
  },

  // The mall
  'boutique-mode': {
    engine: 'repondre', title: 'Les boutiques', how: 'La vendeuse te conseille : réponds-lui poliment, et avec style.', decor: 'carrelage', npc: 'vendeuse',
    lines: [
      ['Bonjour ! Je peux t’aider ?', ['Je regarde seulement, merci !', 'Laisse-moi.', 'C’est gratuit ?'], 0],
      ['Cette chemise va bien avec ton teint.', ['Elle est moche.', 'Tu trouves ? Je l’essaie alors !', 'Toi aussi tu vas bien.'], 1],
      ['La cabine est libre au fond.', ['Je me change ici.', 'Pas besoin.', 'Merci beaucoup !'], 2],
    ],
  },
  glace: {
    engine: 'tenir', title: 'La glace à l’italienne', how: 'Tiens la manette pour remplir le cornet, lâche avant que ça déborde.', decor: 'comptoir', object: 'glace', verb: 'Remplis', fill: 'liquide',
  },
  'leche-vitrine': {
    engine: 'photo', title: 'Lèche-vitrine', how: 'Les vitrines défilent : tape quand ce qui te plaît passe dans le cadre.', decor: 'carrelage',
    subjects: [{ name: 'La robe', prop: 'robe' }, { name: 'Les chaussures', prop: 'chaussure' }, { name: 'La montre', prop: 'montre' }, { name: 'Le parfum', prop: 'parfum' }, { name: 'Le sac', prop: 'sac' }],
  },
  supermarche: {
    engine: 'choisir', title: 'Les courses', how: 'Maman dicte la liste au téléphone : prends le bon article dans le rayon.', decor: 'etagere', caller: 'Maman',
    items: [{ name: 'Le riz', prop: 'riz' }, { name: 'Le pain', prop: 'pain' }, { name: 'Le savon', prop: 'savon' }, { name: 'L’eau', prop: 'sachet-eau' }, { name: 'Les tomates', prop: 'tomate' }, { name: 'Le jus', prop: 'jus' }],
  },
  vetements: {
    engine: 'assembler', title: 'Ta nouvelle tenue', how: 'Devant le miroir, enfile la tenue dans l’ordre pour être frais de la tête aux pieds.', decor: 'carrelage', base: 'miroir',
    parts: [{ name: 'La chemise', prop: 'chemise' }, { name: 'Les chaussures', prop: 'chaussure' }, { name: 'La montre', prop: 'montre' }, { name: 'Les lunettes', prop: 'lunettes' }, { name: 'La casquette', prop: 'casquette' }],
  },
  'work:caisse': {
    engine: 'choisir', title: 'À la caisse', how: 'Le client demande ce qu’il lui faut : touche-le vite, la file attend.', decor: 'comptoir', caller: 'Le client',
    items: [{ name: 'La monnaie en pièces', prop: 'piece' }, { name: 'Le billet', prop: 'billet' }, { name: 'Le sac', prop: 'sac' }, { name: 'Le ticket de caisse', prop: 'ticket' }, { name: 'Le terminal pour la carte', prop: 'carte-bancaire' }],
  },

  // Maquis
  'dance-coupe-decale': {
    engine: 'rythme', title: 'Coupé-décalé !', how: 'Le DJ lance le son : tape l’enceinte, le djembé et le micro pile sur la ligne.', decor: 'scene', lanes: ['enceinte', 'djembe', 'micro'],
  },
  'eat-poulet-braise': {
    engine: 'choisir', title: 'Poulet braisé', how: 'Le braiseur appelle ta commande : touche-la avant les mains des autres clients.', decor: 'table', caller: 'Le braiseur',
    items: [{ name: 'Le poulet', prop: 'poulet' }, { name: 'L’alloco', prop: 'alloco' }, { name: 'L’attiéké', prop: 'attieke' }, { name: 'Le piment', prop: 'piment' }, { name: 'La brochette', prop: 'brochette' }],
  },
  'work:maquis': {
    engine: 'assembler', title: 'Le garba du maquis', how: 'Les clients commandent : monte chaque assiette dans l’ordre demandé.', decor: 'comptoir', base: 'assiette',
    parts: [{ name: 'L’attiéké', prop: 'attieke' }, { name: 'Le thon frit', prop: 'poisson' }, { name: 'Le piment', prop: 'piment' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'La tomate', prop: 'tomate' }],
  },

  // The market
  bargain: {
    engine: 'repondre', title: 'Marchander', how: 'La tantie annonce son prix : marchande avec le sourire, sans la vexer.', decor: 'etal', npc: 'vendeuse',
    lines: [
      ['Ma chérie, les tomates c’est 1 000 le tas !', ['Tantie, fais-moi 700, je suis ta cliente fidèle !', 'C’est du vol !', 'Donne gratuit.'], 0],
      ['700 ? Tu veux me tuer ? 900 !', ['Garde tes tomates.', 'Bon, 800 et je reviens demain.', 'D’accord, 2 000.'], 1],
      ['Allez, 800, mais tu dis pas aux autres !', ['Tu es dure, tantie.', 'Je réfléchis encore.', 'Merci tantie, Dieu te bénisse !'], 2],
    ],
  },
  'boutique-wax': {
    engine: 'assembler', title: 'Le complet en wax', how: 'Compose ton complet dans l’ordre que la vendeuse propose.', decor: 'etal', base: 'miroir',
    parts: [{ name: 'Le pagne', prop: 'pagne' }, { name: 'La robe', prop: 'robe' }, { name: 'Le foulard', prop: 'tissu' }, { name: 'Le collier', prop: 'collier' }, { name: 'Le sac', prop: 'sac' }],
  },
  'buy-food': {
    engine: 'attraper', title: 'Faire le marché', how: 'Les tanties te lancent la marchandise : attrape-la dans ton sac, laisse les cailloux.', decor: 'etal', from: 'carton', into: 'sac',
    good: [{ name: 'La tomate', prop: 'tomate' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }, { name: 'La banane', prop: 'banane' }, { name: 'Le poisson', prop: 'poisson' }],
    bad: [{ name: 'Le caillou', prop: 'caillou' }, { name: 'La feuille', prop: 'feuille' }],
  },
  'meches-cocody': {
    engine: 'choisir', title: 'Les mèches à l’étage', how: 'Ta coiffeuse t’appelle : prends ce qu’elle demande avant la cliente d’à côté.', decor: 'etagere', caller: 'Ta coiffeuse',
    items: [{ name: 'Les mèches', prop: 'meche' }, { name: 'Les bigoudis', prop: 'bigoudi' }, { name: 'Le peigne', prop: 'peigne' }, { name: 'La crème', prop: 'creme' }, { name: 'Le vernis', prop: 'vernis' }],
  },
  'pagnes-treich': {
    engine: 'tenir', title: 'Six yards de pagne', how: 'Déroule le pagne en tenant, lâche pile à six yards, ni plus ni moins.', decor: 'etal', object: 'tissu', verb: 'Déroule', fill: 'tissu',
  },
  'sell-goods': {
    engine: 'choisir', title: 'Le petit commerce', how: 'La cliente demande un article : tends-le-lui avant que la voisine la prenne.', decor: 'etal', caller: 'La cliente',
    items: [{ name: 'Les tomates', prop: 'tomate' }, { name: 'Les oignons', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }, { name: 'L’eau', prop: 'sachet-eau' }, { name: 'Les bonbons', prop: 'bonbon' }, { name: 'Les bananes', prop: 'banane' }],
  },
  'work:commerce': {
    engine: 'assembler', title: 'Le plus bel étal', how: 'Range ton étal dans l’ordre pour donner envie à toute l’allée.', decor: 'etal', base: 'plateau-service',
    parts: [{ name: 'Les tomates', prop: 'tomate' }, { name: 'Les oignons', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }, { name: 'Les mangues', prop: 'mangue' }, { name: 'L’ananas', prop: 'ananas' }],
  },

  // Nature
  hike: {
    engine: 'equilibre', title: 'La randonnée', how: 'Le sentier grimpe : garde ton sac bien droit jusqu’au sommet.', decor: 'terre', carry: 'sac', verb: 'Marche',
  },
  photos: {
    engine: 'photo', title: 'Photos dans la nature', how: 'Les animaux passent entre les arbres : tape quand l’un d’eux est dans le cadre.', decor: 'herbe',
    subjects: [{ name: 'Le singe', prop: 'singe' }, { name: 'Le perroquet', prop: 'perroquet' }, { name: 'Le papillon', prop: 'papillon' }, { name: 'La tortue', prop: 'tortue' }, { name: 'L’oiseau', prop: 'oiseau' }],
  },

  // Office towers (Plateau)
  'coffee-break': {
    engine: 'tenir', title: 'La pause café', how: 'Tiens pour verser le café des collègues, lâche quand la tasse est pleine.', decor: 'bureau', object: 'cafe', verb: 'Verse', fill: 'liquide',
  },
  'comptoir-air-lagune': {
    engine: 'quiz', title: 'Au comptoir Air Lagune', how: 'L’agent répond à tes questions… et te teste un peu : choisis la bonne réponse.', decor: 'comptoir', host: 'agent',
    questions: [
      ['L’aéroport d’Abidjan est à ?', ['Port-Bouët', 'Yopougon', 'Abobo'], 0],
      ['Pour un vol à l’étranger, il faut ?', ['Une carte de fidélité', 'Un passeport', 'Un ticket de bus'], 1],
      ['Pour un vol international, on arrive ?', ['Pile à l’heure du départ', 'Après le départ', 'Environ deux heures avant'], 2],
    ],
  },
  'read-ads': {
    engine: 'choisir', title: 'Les offres d’emploi', how: 'Ton ami cherche un métier : trouve son annonce dans le journal avant les autres.', decor: 'bureau', caller: 'Ton ami',
    items: [{ name: 'Serveur', prop: 'plateau-service' }, { name: 'Caissier', prop: 'caisse-enregistreuse' }, { name: 'Maçon', prop: 'brique' }, { name: 'Chauffeur', prop: 'volant-auto' }, { name: 'Couturière', prop: 'machine-a-coudre' }, { name: 'Infirmier', prop: 'stethoscope' }],
  },
  'rti-casting': {
    engine: 'rythme', title: 'Le casting télé', how: 'Chante devant le jury : tape le micro, la note et le clap pile en rythme.', decor: 'scene', lanes: ['micro', 'note-musique', 'clap'],
  },
  'rti-emission': {
    engine: 'attraper', title: 'Dans le public', how: 'L’animateur lance des cadeaux au public : attrape-les, laisse tomber les cartons vides.', decor: 'scene', from: 'micro', into: 'sac',
    good: [{ name: 'Le cadeau', prop: 'cadeau' }, { name: 'La casquette', prop: 'casquette' }, { name: 'Le ticket', prop: 'ticket' }, { name: 'Les bonbons', prop: 'bonbon' }],
    bad: [{ name: 'Le carton vide', prop: 'carton' }],
  },
  'rti-visite': {
    engine: 'quiz', title: 'Les studios de la RTI', how: 'Le guide te fait visiter les studios et te pose des questions : réponds juste.', decor: 'scene', host: 'guide',
    questions: [
      ['RTI, ça veut dire ?', ['Radio Télé Internationale', 'Radiodiffusion Télévision Ivoirienne', 'Réseau Télé Ivoire'], 1],
      ['Le clap sert à ?', ['Marquer le début d’une prise', 'Applaudir', 'Éteindre la caméra'], 0],
      ['Le présentateur lit son texte sur ?', ['Un livre', 'Sa main', 'Le prompteur'], 2],
    ],
  },
  'terrasse-pyramide': {
    engine: 'photo', title: 'Sur le toit de la Pyramide', how: 'Tout Abidjan est à tes pieds : tape quand un beau sujet passe dans le cadre.', decor: 'ciel',
    subjects: [{ name: 'L’avion', prop: 'avion' }, { name: 'L’oiseau', prop: 'oiseau' }, { name: 'Le nuage', prop: 'nuage' }, { name: 'La pirogue', prop: 'pirogue' }, { name: 'Le drapeau', prop: 'drapeau' }],
  },
  'visiter-pyramide': {
    engine: 'course', title: 'Le tour de la galerie', how: 'Fais le tour des boutiques : ramasse les tickets promo, évite les cartons.', decor: 'carrelage', mode: 'pied', good: 'ticket', bad: 'carton',
  },
  'vue-tour-ivoire': {
    engine: 'quiz', title: 'Vue du 16e étage', how: 'Le guide te montre la ville d’en haut : réponds à ses questions sur Abidjan.', decor: 'ciel', host: 'guide',
    questions: [
      ['Le quartier des affaires d’Abidjan ?', ['Le Plateau', 'Abobo', 'Koumassi'], 0],
      ['La lagune qui entoure Abidjan ?', ['La lagune Aby', 'La lagune Ébrié', 'La lagune Tagba'], 1],
      ['Un taxi collectif, à Abidjan, c’est un ?', ['Gbèlè', 'Kpaklo', 'Woro-woro'], 2],
    ],
  },
  'work:bureau': {
    engine: 'repondre', title: 'Le client au téléphone', how: 'Un client mécontent appelle : rassure-le avec calme et diplomatie.', decor: 'bureau', npc: 'client',
    lines: [
      ['Ma commande n’est toujours pas arrivée !', ['Je comprends, je vérifie tout de suite pour vous.', 'C’est pas ma faute.', 'Rappelez demain.'], 0],
      ['Ça fait deux semaines, c’est trop !', ['Deux semaines, c’est rien.', 'Vous avez raison, je vous la livre jeudi sans frais.', 'Allez ailleurs alors.'], 1],
      ['Bon… jeudi alors. Merci.', ['Enfin !', 'Si on a le temps.', 'Merci à vous pour votre patience, bonne journée !'], 2],
    ],
  },
  'work:droit': {
    engine: 'quiz', title: 'À la barre', how: 'Le juge t’interroge pendant l’audience : réponds en vrai avocat.', decor: 'bureau', host: 'juge',
    questions: [
      ['Avant d’être jugée, une personne est présumée ?', ['Innocente', 'Coupable', 'Absente'], 0],
      ['Le rôle de l’avocat ?', ['Juger l’accusé', 'Défendre son client', 'Arrêter les voleurs'], 1],
      ['Qui rend la décision au tribunal ?', ['L’avocat', 'Le public', 'Le juge'], 2],
      ['Ce que l’avocat porte à l’audience ?', ['Une robe noire', 'Un gilet orange', 'Un boubou de fête'], 0],
    ],
  },

  // Orphanage
  'benevolat-orphelinat': {
    engine: 'nettoyer', title: 'Le linge des enfants', how: 'Frotte chaque tache sur le linge des petits, jusqu’à ce qu’il soit tout propre.', decor: 'carrelage', object: 'linge', bit: 'tache', verb: 'Frotte',
  },
  'don-orphelinat': {
    engine: 'repondre', title: 'Le don', how: 'La directrice te reçoit : réponds-lui avec simplicité et chaleur.', decor: 'parquet', npc: 'maman',
    lines: [
      ['Merci pour ton don, ça va beaucoup aider.', ['C’est normal, c’est pour les enfants.', 'Tu me dois une faveur.', 'C’est tout ce que j’ai, hein.'], 0],
      ['Les enfants voulaient te dire merci.', ['Pas le temps.', 'Avec plaisir, je viens les saluer !', 'Ils peuvent écrire.'], 1],
      ['Reviens nous voir quand tu veux.', ['Peut-être.', 'On verra.', 'Promis, je reviendrai jouer avec eux !'], 2],
    ],
  },
  'grand-don-orphelinat': {
    engine: 'equilibre', title: 'Le grand don', how: 'Porte les cartons de lait et de cahiers jusqu’au dortoir sans rien faire tomber.', decor: 'terre', carry: 'carton', verb: 'Porte',
  },
}
