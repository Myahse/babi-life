import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

export const JEUX_2: Record<string, Jeu> = {
  // Happenings in the street
  'label:Présenter ses condoléances': {
    engine: 'repondre', title: t('Les condoléances'), how: t('Le vieux de la famille t’accueille : trouve les mots justes, doux et respectueux.'), decor: 'parquet', npc: 'vieux',
    lines: [
      [t('Merci d’être venu, mon fils. Ça nous touche.'), [t('Je suis de tout cœur avec vous, papa.'), t('Y a à manger ici ?'), t('Je passais seulement.')], 0],
      [t('Il était bon, il aidait tout le quartier.'), [t('Ah bon ? Je savais pas.'), t('Oui, tout le monde se souvient de sa gentillesse.'), t('On parle d’autre chose ?')], 1],
      [t('Asseyons-nous un peu, la famille est là.'), [t('Je dois filer, désolé.'), t('J’ai pas le temps hein.'), t('Avec plaisir, je reste avec vous un moment.')], 2],
      [t('Que Dieu te le rende.'), [t('Courage à toute la famille.'), t('Bon, c’est fini ?'), t('Tu me dois rien.')], 0],
    ],
  },
  'label:Regarder le match': {
    engine: 'quiz', title: t('Devant le match'), how: t('Ton ami teste tes connaissances de foot pendant le match : réponds juste !'), decor: 'bitume', host: 'ami',
    questions: [
      [t('Le surnom de l’équipe de Côte d’Ivoire ?'), [t('Les Lions'), t('Les Éléphants'), t('Les Aigles')], 1],
      [t('Combien de joueurs par équipe sur le terrain ?'), ['11', '9', '13'], 0],
      [t('Combien de CAN la Côte d’Ivoire a gagnées ?'), [t('Une'), t('Deux'), t('Trois')], 2],
      [t('Où s’est jouée la CAN 2023 ?'), [t('Au Sénégal'), t('En Côte d’Ivoire'), t('Au Ghana')], 1],
    ],
  },
  'label:Regarder les masques': {
    engine: 'photo', title: t('La sortie des masques'), how: t('Les masques dansent sur la place : tape quand l’un d’eux passe dans le cadre.'), decor: 'terre',
    subjects: [{ name: t('Le grand masque'), prop: 'masque' }, { name: t('Le tam-tam'), prop: 'tam-tam' }, { name: t('Le djembé'), prop: 'djembe' }, { name: t('La statue'), prop: 'statue' }, { name: t('La calebasse'), prop: 'calebasse' }],
  },
  "label:S'abriter sous un auvent": {
    engine: 'course', title: t('Sauve-toi de la pluie'), how: t('Il pleut fort : cours d’auvent en auvent, ramasse les journaux, évite les gouttes.'), decor: 'bitume', mode: 'pied', good: 'journal', bad: 'goutte',
  },
  'label:Se joindre aux collègues': {
    engine: 'repondre', title: t('Avec les collègues'), how: t('Les collègues t’accueillent dans le groupe : réponds avec bonne humeur.'), decor: 'bitume', npc: 'collegue',
    lines: [
      [t('Eh, c’est toi ! Viens t’asseoir avec nous.'), [t('Merci, je suis content de vous voir !'), t('Non, je préfère rester seul.'), t('Vous faites quoi là ?')], 0],
      [t('On parlait du chef, il est en forme ce matin.'), [t('Il est nul, hein.'), t('Ah, c’est bien, ça va faire une bonne journée !'), t('Je m’en fous.')], 1],
      [t('Tu prends quelque chose ? C’est ma tournée.'), [t('Rien, garde ton argent.'), t('Je prends le plus cher !'), t('Un jus, merci. La prochaine c’est pour moi !')], 2],
    ],
  },
  'label:Suivre le défilé': {
    engine: 'rythme', title: t('Le défilé'), how: t('La fanfare passe : tape le tam-tam, le sifflet et le drapeau pile sur la ligne.'), decor: 'bitume', lanes: ['tam-tam', 'sifflet', 'drapeau'],
  },

  // Health: the clinic
  consultation: {
    engine: 'repondre', title: t('Chez le docteur'), how: t('Le médecin t’ausculte et te pose des questions : réponds-lui franchement.'), decor: 'carrelage', npc: 'medecin',
    lines: [
      [t('Bonjour ! Qu’est-ce qui t’amène ?'), [t('J’ai mal à la tête depuis deux jours.'), t('Rien, je suis venu voir.'), t('Devinez !')], 0],
      [t('Tu bois assez d’eau dans la journée ?'), [t('Non, que du soda.'), t('Pas trop, je vais faire plus attention.'), t('L’eau, c’est pour les poissons.')], 1],
      [t('Prends ce traitement trois jours, et repose-toi.'), [t('Je prendrai tout d’un coup.'), t('Trois jours ? C’est long.'), t('D’accord docteur, merci beaucoup.')], 2],
    ],
  },
  'visite-malade': {
    engine: 'assembler', title: t('Le panier du malade'), how: t('Garnis le panier dans l’ordre demandé avant d’entrer dans la chambre.'), decor: 'carrelage', base: 'sac',
    parts: [{ name: t('Les mangues'), prop: 'mangue' }, { name: t('Les bananes'), prop: 'banane' }, { name: t('Le jus'), prop: 'jus' }, { name: t('L’eau'), prop: 'sachet-eau' }, { name: t('Les fleurs'), prop: 'fleur' }],
  },
  'work:sante': {
    engine: 'tenir', title: t('Prendre la tension'), how: t('Gonfle le brassard en tenant, et lâche pile dans le vert pour lire la tension.'), decor: 'carrelage', object: 'tensiometre', verb: t('Gonfle'), fill: 'force',
  },

  // Home: the family house
  'call-family': {
    engine: 'repondre', title: t('Allô, le village ?'), how: t('Maman est au bout du fil depuis le village : réponds-lui avec tendresse.'), decor: 'parquet', npc: 'maman',
    lines: [
      [t('Allô, mon enfant ? On t’entend pas depuis !'), [t('Pardon maman, je pense à vous chaque jour.'), t('J’étais occupé.'), t('Qui est à l’appareil ?')], 0],
      [t('Tu manges bien à Abidjan ?'), [t('Que du pain.'), t('Oui maman, mais ton foutou me manque !'), t('Ça te regarde pas.')], 1],
      [t('Ton grand-père te salue beaucoup.'), [t('Ah, il est encore là ?'), t('Ok.'), t('Salue-le fort pour moi, je viens bientôt !')], 2],
    ],
  },
  dents: {
    engine: 'nettoyer', title: t('Le sourire blanc'), how: t('Devant le miroir, brosse chaque tache jusqu’à avoir un sourire qui brille.'), decor: 'carrelage', object: 'miroir', bit: 'tache', verb: t('Brosse'),
  },
  devoirs: {
    engine: 'quiz', title: t('Les devoirs'), how: t('Papa vérifie tes devoirs : trouve la bonne réponse à chaque question.'), decor: 'parquet', host: 'papa',
    questions: [
      [t('7 × 8, ça fait combien ?'), ['54', '56', '64'], 1],
      [t('La capitale politique de la Côte d’Ivoire ?'), [t('Yamoussoukro'), t('Bouaké'), t('Abidjan')], 0],
      [t('Le pluriel de « cheval » ?'), [t('Chevals'), t('Chevaux'), t('Chevaus')], 1],
      [t('Le plus long fleuve de Côte d’Ivoire ?'), [t('Le Bandama'), t('Le Sassandra'), t('La Comoé')], 2],
    ],
  },
  jouets: {
    engine: 'choisir', title: t('Le coffre à jouets'), how: t('Maman nomme un jouet : touche-le avant que ton petit frère l’attrape.'), decor: 'parquet', caller: t('Maman'),
    items: [{ name: t('La petite voiture'), prop: 'jouet' }, { name: t('Le nounours'), prop: 'peluche' }, { name: t('Le ballon'), prop: 'ballon-foot' }, { name: t('Le dé'), prop: 'de' }, { name: t('Le ballon de fête'), prop: 'ballon-fete' }],
  },
  nager: {
    engine: 'course', title: t('Longueurs à la piscine'), how: t('Nage d’un bout à l’autre : attrape les bouées, évite les feuilles qui flottent.'), decor: 'eau', mode: 'nage', good: 'bouee', bad: 'feuille',
  },
  'premier-mot': {
    engine: 'repondre', title: t('Le premier mot'), how: t('Maman te parle doucement : réponds-lui en bébé, avec le bon petit mot.'), decor: 'parquet', npc: 'maman',
    lines: [
      [t('Dis « maman », mon bébé… Ma-man !'), [t('Ma… ma… maman !'), t('Brrrr !'), t('Ouin ouin !')], 0],
      [t('Oh, il a parlé ! Et papa ? Pa-pa ?'), [t('Gâteau !'), t('Pa… papa !'), t('Atchoum !')], 1],
      [t('Tu veux ton biberon ?'), [t('Non !'), t('Ba-ba-ba…'), t('Ouiii, bibi !')], 2],
    ],
  },
  toilettes: {
    engine: 'course', title: t('Urgence !'), how: t('Vite, cours jusqu’aux toilettes : prends la serviette, évite les jouets qui traînent.'), decor: 'parquet', mode: 'pied', good: 'serviette', bad: 'jouet',
  },
  'watch-tv': {
    engine: 'photo', title: t('Ce soir sur RTI 1'), how: t('Tu zappes : tape quand ton émission préférée passe dans l’écran.'), decor: 'parquet',
    subjects: [{ name: t('Le journal'), prop: 'micro' }, { name: t('Le match'), prop: 'ballon-foot' }, { name: t('Le clip'), prop: 'note-musique' }, { name: t('La météo'), prop: 'soleil' }, { name: t('Le feuilleton'), prop: 'coeur' }],
  },

  // Hotel: the big hotel by the lagoon
  'bar-hotel': {
    engine: 'choisir', title: t('Au bar de l’hôtel'), how: t('Ton ami commande : touche le bon verre avant que le barman serve la table d’à côté.'), decor: 'comptoir', caller: t('Ton ami'),
    items: [{ name: t('La bière'), prop: 'biere' }, { name: t('Le cocktail'), prop: 'cocktail' }, { name: t('Le jus'), prop: 'jus' }, { name: t('Le soda'), prop: 'soda' }, { name: t('Le café'), prop: 'cafe' }],
  },
  'brunch-lagune': {
    engine: 'assembler', title: t('Brunch face à la lagune'), how: t('Compose ton assiette dans l’ordre que tu as en tête, face à l’eau.'), decor: 'table', base: 'assiette',
    parts: [{ name: t('Le croissant'), prop: 'croissant' }, { name: t('Le pain'), prop: 'pain' }, { name: t('La mangue'), prop: 'mangue' }, { name: t('L’ananas'), prop: 'ananas' }, { name: t('Le poulet'), prop: 'poulet' }],
  },
  'casino-ivoire': {
    engine: 'attraper', title: t('Le jackpot'), how: t('La machine crache : attrape les jetons et les pièces, laisse tomber les cartes perdantes.'), decor: 'parquet', from: 'ecran', into: 'sac',
    good: [{ name: t('Le jeton'), prop: 'jeton' }, { name: t('La pièce'), prop: 'piece' }, { name: t('Le billet'), prop: 'billet' }],
    bad: [{ name: t('La carte perdante'), prop: 'carte-jeu' }, { name: t('Le dé'), prop: 'de' }],
  },
  'chambre-bain': {
    engine: 'tenir', title: t('Le bain moussant'), how: t('Tiens pour faire couler l’eau chaude, lâche quand la mousse arrive dans le vert.'), decor: 'carrelage', object: 'bulle', verb: t('Fais couler'), fill: 'liquide',
  },
  'chambre-douche': {
    engine: 'nettoyer', title: t('La douche'), how: t('Sous l’eau bien chaude, rince chaque bout de mousse jusqu’au dernier.'), decor: 'carrelage', object: 'eponge', bit: 'mousse', verb: t('Rince'),
  },
  'chambre-sieste': {
    engine: 'attraper', title: t('Les beaux rêves'), how: t('Attrape les beaux rêves sur ton oreiller, laisse tomber le téléphone qui sonne.'), decor: 'parquet', from: 'nuage', into: 'coussin',
    good: [{ name: t('L’étoile'), prop: 'etoile' }, { name: t('La lune'), prop: 'lune' }, { name: t('Le cœur'), prop: 'coeur' }],
    bad: [{ name: t('Le téléphone'), prop: 'telephone' }, { name: t('Le réveil'), prop: 'montre' }],
  },
  'chambre-tele': {
    engine: 'choisir', title: t('Télé au lit'), how: t('Le programme annonce une émission : touche-la avant que ça zappe.'), decor: 'parquet', caller: t('Le programme'),
    items: [{ name: t('Le film'), prop: 'clap' }, { name: t('Le match'), prop: 'ballon-foot' }, { name: t('Le clip'), prop: 'note-musique' }, { name: t('Le talk-show'), prop: 'micro' }, { name: t('Le documentaire'), prop: 'lion' }],
  },
  'cinema-ivoire': {
    engine: 'photo', title: t('Au Ciné Ivoire'), how: t('Le film défile : tape au bon moment pour garder les plus belles scènes.'), decor: 'scene',
    subjects: [{ name: t('Le héros'), prop: 'camera' }, { name: t('L’avion'), prop: 'avion' }, { name: t('Le lion'), prop: 'lion' }, { name: t('La course-poursuite'), prop: 'kart' }, { name: t('Le trophée'), prop: 'trophee' }],
  },
  'lobby-ivoire': {
    engine: 'repondre', title: t('Dans le grand hall'), how: t('Un touriste perdu te demande conseil : réponds-lui en vrai Abidjanais.'), decor: 'carrelage', npc: 'touriste',
    lines: [
      [t('Excusez-moi, où manger un bon garba ?'), [t('Au restaurant de l’hôtel, c’est pareil.'), t('Demande à la tantie du carrefour, c’est le meilleur !'), t('Je sais pas.')], 1],
      [t('C’est quoi un woro-woro ?'), [t('Un taxi collectif, pas cher et rapide.'), t('Une danse.'), t('Un plat de poisson.')], 0],
      [t('Que veut dire « on dit quoi » ?'), [t('Au revoir.'), t('C’est une insulte.'), t('Ça veut dire « quoi de neuf ? »')], 2],
      [t('Merci beaucoup, vous êtes gentil !'), [t('Bienvenue à Babi, profite bien !'), t('C’est 1 000 F.'), t('Hum.')], 0],
    ],
  },
  'piscine-hotel': {
    engine: 'course', title: t('Le grand bassin'), how: t('Nage dans la piscine de l’hôtel : prends les bulles, évite les ballons des enfants.'), decor: 'eau', mode: 'nage', good: 'bulle', bad: 'ballon-fete',
  },
  'rs-club': {
    engine: 'assembler', title: t('Le club sandwich'), how: t('Monte ton club sandwich étage par étage, dans l’ordre de la recette.'), decor: 'table', base: 'assiette',
    parts: [{ name: t('Le pain'), prop: 'pain' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('La tomate'), prop: 'tomate' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Les frites d’alloco'), prop: 'alloco' }],
  },
  'rs-cocktail': {
    engine: 'tenir', title: t('Le cocktail du bar'), how: t('Tiens pour verser le cocktail, lâche quand le verre est plein dans le vert.'), decor: 'table', object: 'cocktail', verb: t('Verse'), fill: 'liquide',
  },
  'rs-glace': {
    engine: 'attraper', title: t('La coupe de glace'), how: t('Les boules et les fruits tombent : attrape-les dans la coupe, laisse tomber le piment !'), decor: 'table', from: 'plateau-service', into: 'verre',
    good: [{ name: t('La boule de glace'), prop: 'glace' }, { name: t('La mangue'), prop: 'mangue' }, { name: t('L’ananas'), prop: 'ananas' }, { name: t('Le bonbon'), prop: 'bonbon' }],
    bad: [{ name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }],
  },
  'rs-petitdej': {
    engine: 'equilibre', title: t('Petit-déj au lit'), how: t('Porte le plateau jusqu’au lit sans renverser le café : penche à gauche, à droite.'), decor: 'parquet', carry: 'plateau-service', verb: t('Porte'),
  },
  'rs-poisson': {
    engine: 'tenir', title: t('Poisson braisé, attiéké'), how: t('Pomme l’attiéké : tiens pour serrer la boule, lâche quand elle est bien ronde.'), decor: 'table', object: 'attieke', verb: t('Pomme'), fill: 'force',
  },
  'work:hotellerie': {
    engine: 'equilibre', title: t('Les bagages du client'), how: t('Monte les valises du client jusqu’à sa chambre sans les faire tomber.'), decor: 'carrelage', carry: 'valise', verb: t('Monte'),
  },

  // Karting track
  'course-kart': {
    engine: 'course', title: t('Trois tours de kart'), how: t('Fonce sur la piste : prends les étoiles, évite les plots.'), decor: 'piste', mode: 'kart', good: 'etoile', bad: 'quille',
  },
  'regarder-kart': {
    engine: 'photo', title: t('Depuis la tribune'), how: t('Les karts passent à toute vitesse : tape quand l’un d’eux est dans le cadre.'), decor: 'piste',
    subjects: [{ name: t('Le kart rouge'), prop: 'kart' }, { name: t('Le drapeau'), prop: 'drapeau' }, { name: t('Le chrono'), prop: 'chrono' }, { name: t('Le trophée'), prop: 'trophee' }],
  },

  // Lagoon
  'balade-lagune': {
    engine: 'course', title: t('Au bord de la lagune'), how: t('Promène-toi au bord de l’eau : ramasse les coquillages, évite les crabes.'), decor: 'sable', mode: 'pied', good: 'coquillage', bad: 'crabe',
  },
  'coucher-soleil': {
    engine: 'tenir', title: t('Le soleil se couche'), how: t('Tiens pendant que le soleil descend, lâche pile quand il touche la lagune.'), decor: 'ciel', object: 'soleil', verb: t('Regarde'), fill: 'chaleur',
  },
  'photo-plateau': {
    engine: 'photo', title: t('Les tours du Plateau'), how: t('Depuis la rive, tape quand un beau sujet passe devant les tours du Plateau.'), decor: 'eau',
    subjects: [{ name: t('La pirogue'), prop: 'pirogue' }, { name: t('L’oiseau'), prop: 'oiseau' }, { name: t('L’avion'), prop: 'avion' }, { name: t('Le nuage'), prop: 'nuage' }, { name: t('Le soleil'), prop: 'soleil' }],
  },
  'ski-boulay': {
    engine: 'equilibre', title: t('Ski nautique'), how: t('Le bateau tire : reste debout sur la planche en penchant à gauche et à droite.'), decor: 'eau', carry: 'planche-surf', verb: t('Tiens debout'),
  },
  'traversee-boulay': {
    engine: 'course', title: t('Cap sur l’île Boulay'), how: t('Pagaie jusqu’à l’île : attrape les poissons, évite les grosses vagues.'), decor: 'eau', mode: 'pirogue', good: 'poisson-vivant', bad: 'vague',
  },

  // Own home (logement)
  'logement-amis': {
    engine: 'choisir', title: t('Les amis sont là'), how: t('Chaque ami demande à boire : sers-lui le bon avant qu’il se lève.'), decor: 'parquet', caller: t('Ton ami'),
    items: [{ name: t('Le soda'), prop: 'soda' }, { name: t('Le jus'), prop: 'jus' }, { name: t('La bière'), prop: 'biere' }, { name: t('L’eau'), prop: 'sachet-eau' }, { name: t('Le popcorn'), prop: 'popcorn' }],
  },
  'logement-cuisiner': {
    engine: 'assembler', title: t('Ma sauce maison'), how: t('Mets les ingrédients dans la marmite dans le bon ordre.'), decor: 'table', base: 'marmite',
    parts: [{ name: t('L’oignon'), prop: 'oignon' }, { name: t('La tomate'), prop: 'tomate' }, { name: t('Le piment'), prop: 'piment' }, { name: t('Le poisson'), prop: 'poisson' }, { name: t('Le riz'), prop: 'riz' }],
  },
  'logement-douche': {
    engine: 'tenir', title: t('La douche au seau'), how: t('Pas d’eau au robinet : remplis le seau et lâche avant que ça déborde.'), decor: 'carrelage', object: 'seau', verb: t('Remplis'), fill: 'liquide',
  },
  'logement-sieste': {
    engine: 'repondre', title: t('La sieste'), how: t('Le petit du voisin vient te réveiller : réponds-lui gentiment pour dormir en paix.'), decor: 'parquet', npc: 'enfant',
    lines: [
      [t('Tonton, tu dors ?'), [t('Oui, je fais un petit somme. Va jouer, champion !'), t('Laisse-moi !'), t('Non, je suis mort.')], 0],
      [t('Je peux regarder la télé avec toi ?'), [t('Jamais.'), t('Après ma sieste, promis.'), t('Prends tout, la télé.')], 1],
      [t('Maman a dit de te donner ça.'), [t('Pose ça par terre.'), t('Je veux rien.'), t('Merci mon grand, dis-lui merci !')], 2],
    ],
  },
  'logement-tele': {
    engine: 'quiz', title: t('Le jeu télé'), how: t('Le jeu télé passe : réponds avant le candidat, ton ami compte les points.'), decor: 'parquet', host: 'ami',
    questions: [
      [t('Le plus grand port de Côte d’Ivoire ?'), [t('Abidjan'), t('Korhogo'), t('Man')], 0],
      [t('L’attiéké est fait avec ?'), [t('Le riz'), t('Le manioc'), t('Le maïs')], 1],
      [t('Les couleurs du drapeau ivoirien ?'), [t('Rouge, jaune, vert'), t('Bleu, blanc, rouge'), t('Orange, blanc, vert')], 2],
    ],
  },

  // City hall (mairie)
  'campagne-terrain': {
    engine: 'repondre', title: t('Campagne de terrain'), how: t('Un électeur t’arrête : écoute-le et réponds avec respect et sincérité.'), decor: 'bitume', npc: 'electeur',
    lines: [
      [t('Vous, les candidats, on vous voit qu’en campagne !'), [t('Tu as raison, je viendrai après aussi, c’est promis.'), t('C’est faux !'), t('Vote et tais-toi.')], 0],
      [t('Notre rue est pleine de trous.'), [t('C’est pas mon problème.'), t('Je note, c’est une priorité pour le quartier.'), t('Achète un 4×4.')], 1],
      [t('Et pour les jeunes, tu fais quoi ?'), [t('Rien, ils ont qu’à chercher.'), t('Les jeunes, c’est fatigant.'), t('Des formations et des petits boulots, on en parle ?')], 2],
    ],
  },
  conseil: {
    engine: 'quiz', title: t('Le conseil municipal'), how: t('Un ancien t’explique la séance : réponds à ses questions sur la commune.'), decor: 'bureau', host: 'vieux',
    questions: [
      [t('Qui dirige le conseil municipal ?'), [t('Le maire'), t('Le juge'), t('Le préfet de police')], 0],
      [t('Qui élit les conseillers municipaux ?'), [t('Le président'), t('Les habitants de la commune'), t('Les voisins de la mairie')], 1],
      [t('La mairie s’occupe de ?'), [t('L’armée'), t('La monnaie'), t('L’état civil et les marchés')], 2],
    ],
  },
  'etat-civil': {
    engine: 'assembler', title: t('Le dossier d’état civil'), how: t('Monte ton dossier dans l’ordre que l’agent demande, sans rien oublier.'), decor: 'bureau', base: 'dossier',
    parts: [{ name: t('Le formulaire'), prop: 'cahier' }, { name: t('La pièce d’identité'), prop: 'passeport' }, { name: t('Le timbre'), prop: 'ticket' }, { name: t('Les frais'), prop: 'piece' }, { name: t('La signature'), prop: 'stylo' }],
  },
  legalisation: {
    engine: 'tenir', title: t('Le coup de tampon'), how: t('Appuie sur le tampon et lâche quand la pression est dans le vert : pas de bavure !'), decor: 'bureau', object: 'tampon', verb: t('Appuie'), fill: 'force',
  },
  'mariage-civil': {
    engine: 'photo', title: t('Témoin du mariage'), how: t('Tu es témoin, et photographe aussi : tape quand un beau moment passe.'), decor: 'carrelage',
    subjects: [{ name: t('Les mariés'), prop: 'coeur' }, { name: t('Le bouquet'), prop: 'fleur' }, { name: t('Le gâteau'), prop: 'gateau' }, { name: t('Les cadeaux'), prop: 'cadeau' }, { name: t('Les ballons'), prop: 'ballon-fete' }],
  },
  militer: {
    engine: 'rythme', title: t('Militer'), how: t('Le cortège chante : tape le mégaphone, le sifflet et le drapeau en rythme.'), decor: 'bitume', lanes: ['megaphone', 'sifflet', 'drapeau'],
  },
  'work:mairie': {
    engine: 'choisir', title: t('Au guichet'), how: t('L’usager demande une pièce : donne-lui la bonne avant que la file s’énerve.'), decor: 'bureau', caller: t('L’usager'),
    items: [{ name: t('Le formulaire'), prop: 'dossier' }, { name: t('Le tampon'), prop: 'tampon' }, { name: t('Le stylo'), prop: 'stylo' }, { name: t('Le ticket'), prop: 'ticket' }, { name: t('Le registre'), prop: 'livre' }],
  },

  // The mall
  'boutique-mode': {
    engine: 'repondre', title: t('Les boutiques'), how: t('La vendeuse te conseille : réponds-lui poliment, et avec style.'), decor: 'carrelage', npc: 'vendeuse',
    lines: [
      [t('Bonjour ! Je peux t’aider ?'), [t('Je regarde seulement, merci !'), t('Laisse-moi.'), t('C’est gratuit ?')], 0],
      [t('Cette chemise va bien avec ton teint.'), [t('Elle est moche.'), t('Tu trouves ? Je l’essaie alors !'), t('Toi aussi tu vas bien.')], 1],
      [t('La cabine est libre au fond.'), [t('Je me change ici.'), t('Pas besoin.'), t('Merci beaucoup !')], 2],
    ],
  },
  glace: {
    engine: 'tenir', title: t('La glace à l’italienne'), how: t('Tiens la manette pour remplir le cornet, lâche avant que ça déborde.'), decor: 'comptoir', object: 'glace', verb: t('Remplis'), fill: 'liquide',
  },
  'leche-vitrine': {
    engine: 'photo', title: t('Lèche-vitrine'), how: t('Les vitrines défilent : tape quand ce qui te plaît passe dans le cadre.'), decor: 'carrelage',
    subjects: [{ name: t('La robe'), prop: 'robe' }, { name: t('Les chaussures'), prop: 'chaussure' }, { name: t('La montre'), prop: 'montre' }, { name: t('Le parfum'), prop: 'parfum' }, { name: t('Le sac'), prop: 'sac' }],
  },
  supermarche: {
    engine: 'choisir', title: t('Les courses'), how: t('Maman dicte la liste au téléphone : prends le bon article dans le rayon.'), decor: 'etagere', caller: t('Maman'),
    items: [{ name: t('Le riz'), prop: 'riz' }, { name: t('Le pain'), prop: 'pain' }, { name: t('Le savon'), prop: 'savon' }, { name: t('L’eau'), prop: 'sachet-eau' }, { name: t('Les tomates'), prop: 'tomate' }, { name: t('Le jus'), prop: 'jus' }],
  },
  vetements: {
    engine: 'assembler', title: t('Ta nouvelle tenue'), how: t('Devant le miroir, enfile la tenue dans l’ordre pour être frais de la tête aux pieds.'), decor: 'carrelage', base: 'miroir',
    parts: [{ name: t('La chemise'), prop: 'chemise' }, { name: t('Les chaussures'), prop: 'chaussure' }, { name: t('La montre'), prop: 'montre' }, { name: t('Les lunettes'), prop: 'lunettes' }, { name: t('La casquette'), prop: 'casquette' }],
  },
  'work:caisse': {
    engine: 'choisir', title: t('À la caisse'), how: t('Le client demande ce qu’il lui faut : touche-le vite, la file attend.'), decor: 'comptoir', caller: t('Le client'),
    items: [{ name: t('La monnaie en pièces'), prop: 'piece' }, { name: t('Le billet'), prop: 'billet' }, { name: t('Le sac'), prop: 'sac' }, { name: t('Le ticket de caisse'), prop: 'ticket' }, { name: t('Le terminal pour la carte'), prop: 'carte-bancaire' }],
  },

  // Maquis
  'dance-coupe-decale': {
    engine: 'rythme', title: t('Coupé-décalé !'), how: t('Le DJ lance le son : tape l’enceinte, le djembé et le micro pile sur la ligne.'), decor: 'scene', lanes: ['enceinte', 'djembe', 'micro'],
  },
  'eat-poulet-braise': {
    engine: 'choisir', title: t('Poulet braisé'), how: t('Le braiseur appelle ta commande : touche-la avant les mains des autres clients.'), decor: 'table', caller: t('Le braiseur'),
    items: [{ name: t('Le poulet'), prop: 'poulet' }, { name: t('L’alloco'), prop: 'alloco' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le piment'), prop: 'piment' }, { name: t('La brochette'), prop: 'brochette' }],
  },
  'work:maquis': {
    engine: 'assembler', title: t('Le garba du maquis'), how: t('Les clients commandent : monte chaque assiette dans l’ordre demandé.'), decor: 'comptoir', base: 'assiette',
    parts: [{ name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le thon frit'), prop: 'poisson' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('La tomate'), prop: 'tomate' }],
  },

  // The market
  bargain: {
    engine: 'repondre', title: t('Marchander'), how: t('La tantie annonce son prix : marchande avec le sourire, sans la vexer.'), decor: 'etal', npc: 'vendeuse',
    lines: [
      [t('Ma chérie, les tomates c’est 1 000 le tas !'), [t('Tantie, fais-moi 700, je suis ta cliente fidèle !'), t('C’est du vol !'), t('Donne gratuit.')], 0],
      [t('700 ? Tu veux me tuer ? 900 !'), [t('Garde tes tomates.'), t('Bon, 800 et je reviens demain.'), t('D’accord, 2 000.')], 1],
      [t('Allez, 800, mais tu dis pas aux autres !'), [t('Tu es dure, tantie.'), t('Je réfléchis encore.'), t('Merci tantie, Dieu te bénisse !')], 2],
    ],
  },
  'boutique-wax': {
    engine: 'assembler', title: t('Le complet en wax'), how: t('Compose ton complet dans l’ordre que la vendeuse propose.'), decor: 'etal', base: 'miroir',
    parts: [{ name: t('Le pagne'), prop: 'pagne' }, { name: t('La robe'), prop: 'robe' }, { name: t('Le foulard'), prop: 'tissu' }, { name: t('Le collier'), prop: 'collier' }, { name: t('Le sac'), prop: 'sac' }],
  },
  'buy-food': {
    engine: 'attraper', title: t('Faire le marché'), how: t('Les tanties te lancent la marchandise : attrape-la dans ton sac, laisse les cailloux.'), decor: 'etal', from: 'carton', into: 'sac',
    good: [{ name: t('La tomate'), prop: 'tomate' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }, { name: t('La banane'), prop: 'banane' }, { name: t('Le poisson'), prop: 'poisson' }],
    bad: [{ name: t('Le caillou'), prop: 'caillou' }, { name: t('La feuille'), prop: 'feuille' }],
  },
  'meches-cocody': {
    engine: 'choisir', title: t('Les mèches à l’étage'), how: t('Ta coiffeuse t’appelle : prends ce qu’elle demande avant la cliente d’à côté.'), decor: 'etagere', caller: t('Ta coiffeuse'),
    items: [{ name: t('Les mèches'), prop: 'meche' }, { name: t('Les bigoudis'), prop: 'bigoudi' }, { name: t('Le peigne'), prop: 'peigne' }, { name: t('La crème'), prop: 'creme' }, { name: t('Le vernis'), prop: 'vernis' }],
  },
  'pagnes-treich': {
    engine: 'tenir', title: t('Six yards de pagne'), how: t('Déroule le pagne en tenant, lâche pile à six yards, ni plus ni moins.'), decor: 'etal', object: 'tissu', verb: t('Déroule'), fill: 'tissu',
  },
  'sell-goods': {
    engine: 'choisir', title: t('Le petit commerce'), how: t('La cliente demande un article : tends-le-lui avant que la voisine la prenne.'), decor: 'etal', caller: t('La cliente'),
    items: [{ name: t('Les tomates'), prop: 'tomate' }, { name: t('Les oignons'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’eau'), prop: 'sachet-eau' }, { name: t('Les bonbons'), prop: 'bonbon' }, { name: t('Les bananes'), prop: 'banane' }],
  },
  'work:commerce': {
    engine: 'assembler', title: t('Le plus bel étal'), how: t('Range ton étal dans l’ordre pour donner envie à toute l’allée.'), decor: 'etal', base: 'plateau-service',
    parts: [{ name: t('Les tomates'), prop: 'tomate' }, { name: t('Les oignons'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }, { name: t('Les mangues'), prop: 'mangue' }, { name: t('L’ananas'), prop: 'ananas' }],
  },

  // Nature
  hike: {
    engine: 'equilibre', title: t('La randonnée'), how: t('Le sentier grimpe : garde ton sac bien droit jusqu’au sommet.'), decor: 'terre', carry: 'sac', verb: t('Marche'),
  },
  photos: {
    engine: 'photo', title: t('Photos dans la nature'), how: t('Les animaux passent entre les arbres : tape quand l’un d’eux est dans le cadre.'), decor: 'herbe',
    subjects: [{ name: t('Le singe'), prop: 'singe' }, { name: t('Le perroquet'), prop: 'perroquet' }, { name: t('Le papillon'), prop: 'papillon' }, { name: t('La tortue'), prop: 'tortue' }, { name: t('L’oiseau'), prop: 'oiseau' }],
  },

  // Office towers (Plateau)
  'coffee-break': {
    engine: 'tenir', title: t('La pause café'), how: t('Tiens pour verser le café des collègues, lâche quand la tasse est pleine.'), decor: 'bureau', object: 'cafe', verb: t('Verse'), fill: 'liquide',
  },
  'comptoir-air-lagune': {
    engine: 'quiz', title: t('Au comptoir Air Lagune'), how: t('L’agent répond à tes questions… et te teste un peu : choisis la bonne réponse.'), decor: 'comptoir', host: 'agent',
    questions: [
      [t('L’aéroport d’Abidjan est à ?'), [t('Port-Bouët'), t('Yopougon'), t('Abobo')], 0],
      [t('Pour un vol à l’étranger, il faut ?'), [t('Une carte de fidélité'), t('Un passeport'), t('Un ticket de bus')], 1],
      [t('Pour un vol international, on arrive ?'), [t('Pile à l’heure du départ'), t('Après le départ'), t('Environ deux heures avant')], 2],
    ],
  },
  'read-ads': {
    engine: 'choisir', title: t('Les offres d’emploi'), how: t('Ton ami cherche un métier : trouve son annonce dans le journal avant les autres.'), decor: 'bureau', caller: t('Ton ami'),
    items: [{ name: t('Serveur'), prop: 'plateau-service' }, { name: t('Caissier'), prop: 'caisse-enregistreuse' }, { name: t('Maçon'), prop: 'brique' }, { name: t('Chauffeur'), prop: 'volant-auto' }, { name: t('Couturière'), prop: 'machine-a-coudre' }, { name: t('Infirmier'), prop: 'stethoscope' }],
  },
  'rti-casting': {
    engine: 'rythme', title: t('Le casting télé'), how: t('Chante devant le jury : tape le micro, la note et le clap pile en rythme.'), decor: 'scene', lanes: ['micro', 'note-musique', 'clap'],
  },
  'rti-emission': {
    engine: 'attraper', title: t('Dans le public'), how: t('L’animateur lance des cadeaux au public : attrape-les, laisse tomber les cartons vides.'), decor: 'scene', from: 'micro', into: 'sac',
    good: [{ name: t('Le cadeau'), prop: 'cadeau' }, { name: t('La casquette'), prop: 'casquette' }, { name: t('Le ticket'), prop: 'ticket' }, { name: t('Les bonbons'), prop: 'bonbon' }],
    bad: [{ name: t('Le carton vide'), prop: 'carton' }],
  },
  'rti-visite': {
    engine: 'quiz', title: t('Les studios de la RTI'), how: t('Le guide te fait visiter les studios et te pose des questions : réponds juste.'), decor: 'scene', host: 'guide',
    questions: [
      [t('RTI, ça veut dire ?'), [t('Radio Télé Internationale'), t('Radiodiffusion Télévision Ivoirienne'), t('Réseau Télé Ivoire')], 1],
      [t('Le clap sert à ?'), [t('Marquer le début d’une prise'), t('Applaudir'), t('Éteindre la caméra')], 0],
      [t('Le présentateur lit son texte sur ?'), [t('Un livre'), t('Sa main'), t('Le prompteur')], 2],
    ],
  },
  'terrasse-pyramide': {
    engine: 'photo', title: t('Sur le toit de la Pyramide'), how: t('Tout Abidjan est à tes pieds : tape quand un beau sujet passe dans le cadre.'), decor: 'ciel',
    subjects: [{ name: t('L’avion'), prop: 'avion' }, { name: t('L’oiseau'), prop: 'oiseau' }, { name: t('Le nuage'), prop: 'nuage' }, { name: t('La pirogue'), prop: 'pirogue' }, { name: t('Le drapeau'), prop: 'drapeau' }],
  },
  'visiter-pyramide': {
    engine: 'course', title: t('Le tour de la galerie'), how: t('Fais le tour des boutiques : ramasse les tickets promo, évite les cartons.'), decor: 'carrelage', mode: 'pied', good: 'ticket', bad: 'carton',
  },
  'vue-tour-ivoire': {
    engine: 'quiz', title: t('Vue du 16e étage'), how: t('Le guide te montre la ville d’en haut : réponds à ses questions sur Abidjan.'), decor: 'ciel', host: 'guide',
    questions: [
      [t('Le quartier des affaires d’Abidjan ?'), [t('Le Plateau'), t('Abobo'), t('Koumassi')], 0],
      [t('La lagune qui entoure Abidjan ?'), [t('La lagune Aby'), t('La lagune Ébrié'), t('La lagune Tagba')], 1],
      [t('Un taxi collectif, à Abidjan, c’est un ?'), [t('Gbèlè'), t('Kpaklo'), 'Woro-woro'], 2],
    ],
  },
  'work:bureau': {
    engine: 'repondre', title: t('Le client au téléphone'), how: t('Un client mécontent appelle : rassure-le avec calme et diplomatie.'), decor: 'bureau', npc: 'client',
    lines: [
      [t('Ma commande n’est toujours pas arrivée !'), [t('Je comprends, je vérifie tout de suite pour vous.'), t('C’est pas ma faute.'), t('Rappelez demain.')], 0],
      [t('Ça fait deux semaines, c’est trop !'), [t('Deux semaines, c’est rien.'), t('Vous avez raison, je vous la livre jeudi sans frais.'), t('Allez ailleurs alors.')], 1],
      [t('Bon… jeudi alors. Merci.'), [t('Enfin !'), t('Si on a le temps.'), t('Merci à vous pour votre patience, bonne journée !')], 2],
    ],
  },
  'work:droit': {
    engine: 'quiz', title: t('À la barre'), how: t('Le juge t’interroge pendant l’audience : réponds en vrai avocat.'), decor: 'bureau', host: 'juge',
    questions: [
      [t('Avant d’être jugée, une personne est présumée ?'), [t('Innocente'), t('Coupable'), t('Absente')], 0],
      [t('Le rôle de l’avocat ?'), [t('Juger l’accusé'), t('Défendre son client'), t('Arrêter les voleurs')], 1],
      [t('Qui rend la décision au tribunal ?'), [t('L’avocat'), t('Le public'), t('Le juge')], 2],
      [t('Ce que l’avocat porte à l’audience ?'), [t('Une robe noire'), t('Un gilet orange'), t('Un boubou de fête')], 0],
    ],
  },

  // Orphanage
  'benevolat-orphelinat': {
    engine: 'nettoyer', title: t('Le linge des enfants'), how: t('Frotte chaque tache sur le linge des petits, jusqu’à ce qu’il soit tout propre.'), decor: 'carrelage', object: 'linge', bit: 'tache', verb: t('Frotte'),
  },
  'don-orphelinat': {
    engine: 'repondre', title: t('Le don'), how: t('La directrice te reçoit : réponds-lui avec simplicité et chaleur.'), decor: 'parquet', npc: 'maman',
    lines: [
      [t('Merci pour ton don, ça va beaucoup aider.'), [t('C’est normal, c’est pour les enfants.'), t('Tu me dois une faveur.'), t('C’est tout ce que j’ai, hein.')], 0],
      [t('Les enfants voulaient te dire merci.'), [t('Pas le temps.'), t('Avec plaisir, je viens les saluer !'), t('Ils peuvent écrire.')], 1],
      [t('Reviens nous voir quand tu veux.'), [t('Peut-être.'), t('On verra.'), t('Promis, je reviendrai jouer avec eux !')], 2],
    ],
  },
  'grand-don-orphelinat': {
    engine: 'equilibre', title: t('Le grand don'), how: t('Porte les cartons de lait et de cahiers jusqu’au dortoir sans rien faire tomber.'), decor: 'terre', carry: 'carton', verb: t('Porte'),
  },
}
