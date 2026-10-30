import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// The street's happenings played (the update « evenements-joues », backend game/happenings_joues.go):
// each choice, by its id, its own little game on the engines, with the game's own 3D objects.
export const JEUX_EVENEMENTS: Record<string, Jeu> = {
  // Grosse pluie
  'evt-pluie-courir': {
    engine: 'course', title: t('Courir s’abriter'), how: t('L’averse tombe : cours jusqu’à l’auvent, ramasse les journaux pour te couvrir, saute les flaques… et gare au gbaka qui fonce dedans !'), decor: 'bitume', mode: 'pied', good: 'journal', bad: 'flaque', rush: 'gbaka', rain: true, target: 12,
  },
  'evt-pluie-sachets': {
    engine: 'choisir', title: t('Les sachets de pluie'), how: t('Les passants courent sous l’averse : chacun réclame quelque chose, tends-le-lui avant l’autre petit vendeur.'), decor: 'bitume', caller: t('Un passant'),
    items: [{ name: t('Le chapeau-sachet'), prop: 'sachet-pluie' }, { name: t('Le parapluie'), prop: 'parapluie' }, { name: t('Le journal'), prop: 'journal' }, { name: t('Le sachet d’eau'), prop: 'sachet-eau' }, { name: t('La serviette'), prop: 'serviette' }, { name: t('Le pagne'), prop: 'pagne' }],
    rounds: 6,
  },
  'evt-pluie-danser': {
    engine: 'rythme', title: t('Danser sous la pluie'), how: t('Les enfants dansent sous l’averse : tape chaque note sur la ligne, entre les gouttes et les éclaboussures.'), decor: 'bitume', lanes: ['goutte', 'djembe', 'flaque'], tempo: 110,
  },
  'evt-pluie-voiture': {
    engine: 'tenir', title: t('La voiture embourbée'), how: t('La roue patine dans la boue : tout le monde pousse ensemble. Tiens pour pousser, lâche dans le vert quand le chauffeur accélère.'), decor: 'terre', object: 'voiture', verb: t('Pousse'), fill: 'force', times: 3,
  },

  // Délestage
  'evt-delestage-lampe': {
    engine: 'tenir', title: t('La lampe-tempête'), how: t('Tout est noir : monte la mèche doucement, lâche dans le vert. Trop haut, ça fume ; trop bas, ça s’éteint.'), decor: 'table', object: 'lampe', verb: t('Monte la mèche'), fill: 'chaleur', times: 3,
  },
  'evt-delestage-contes': {
    engine: 'quiz', title: t('Les contes du noir'), how: t('Autour de la bougie, le vieux raconte : Kacou Ananzè, la tortue, le lièvre… Trouve la suite de l’histoire.'), decor: 'terre', host: 'vieux',
    questions: [
      [t('Kacou Ananzè, le héros des contes, c’est quel animal ?'), [t('L’araignée'), t('Le lion'), t('Le crocodile')], 0],
      [t('Dans les contes, qui gagne la course contre le lièvre ?'), [t('Le léopard'), t('La tortue, lente mais maline'), t('Le singe')], 1],
      [t('Quand le conteur dit « Il était une fois… », on répond ?'), [t('« Tais-toi ! »'), t('« Bonne nuit »'), t('« On t’écoute, papa ! »')], 2],
      [t('Pourquoi l’araignée a-t-elle la taille si fine, dit le conte ?'), [t('Elle a trop serré sa ceinture par gourmandise'), t('Elle fait du sport'), t('Elle ne mange que du riz')], 0],
      [t('Le conte fini, que dit le vieux à la fin ?'), [t('« Le conte est parti dans la brousse, que le prochain le ramène »'), t('« Payez-moi »'), t('« C’était faux »')], 0],
    ],
  },
  'evt-delestage-groupe': {
    engine: 'assembler', title: t('Le groupe électrogène'), how: t('Le voisin te passe ses outils : remets tout dans l’ordre demandé pour faire repartir le groupe.'), decor: 'terre', base: 'groupe-electrogene',
    parts: [{ name: t('L’essence'), prop: 'essence' }, { name: t('La clé'), prop: 'cle' }, { name: t('La corde du démarreur'), prop: 'corde' }, { name: t('Le marteau'), prop: 'marteau' }, { name: t('La lampe'), prop: 'lampe' }],
  },

  // Mariage
  'evt-mariage-danser': {
    engine: 'rythme', title: t('Le cortège danse'), how: t('Les klaxons, le tam-tam et la sono : danse avec les tantes en pagne assorti, chaque note sur la ligne.'), decor: 'bitume', lanes: ['tam-tam', 'enceinte', 'pagne'], tempo: 115,
  },
  'evt-mariage-riz': {
    engine: 'viser', title: t('Le riz sur les mariés'), how: t('Les mariés sortent sous les applaudissements : vise et lance ton riz jusqu’à eux, sans arroser les tantes.'), decor: 'bitume', projectile: 'riz', target: 'coeur', shots: 5,
  },
  'evt-mariage-photo': {
    engine: 'photo', title: t('La photo des mariés'), how: t('Tout le monde bouge : déclenche quand le bon sujet est bien dans le cadre.'), decor: 'bitume',
    subjects: [{ name: t('La mariée et sa robe'), prop: 'robe' }, { name: t('Le marié en boubou'), prop: 'boubou' }, { name: t('Le gâteau à étages'), prop: 'gateau' }, { name: t('Les ballons du cortège'), prop: 'ballon-fete' }],
  },

  // Match des Éléphants
  'evt-match-ambiance': {
    engine: 'rythme', title: t('Allez les Éléphants !'), how: t('Devant l’écran géant, le quartier chante : tam-tam, sifflet, drapeau, chaque temps sur la ligne.'), decor: 'bitume', lanes: ['tam-tam', 'sifflet', 'drapeau'], tempo: 120,
  },
  'evt-match-prono': {
    engine: 'quiz', title: t('Le pronostic'), how: t('Ton ami sort son carnet de pronos : prouve que tu connais tes Éléphants.'), decor: 'bitume', host: 'ami',
    questions: [
      [t('Les Éléphants portent quelle couleur à domicile ?'), [t('Le orange'), t('Le bleu'), t('Le rouge')], 0],
      [t('Combien de joueurs par équipe sur le terrain ?'), ['9', '11', '13'], 1],
      [t('La CAN 2023, jouée en Côte d’Ivoire, qui l’a gagnée ?'), [t('Le Nigeria'), t('L’Égypte'), t('La Côte d’Ivoire')], 2],
      [t('Un match nul en phase de poules, ça vaut combien de points ?'), [t('Un point'), t('Trois points'), t('Zéro')], 0],
      [t('Le pronostic le plus sage, c’est ?'), [t('10-0 pour nous !'), t('Une victoire serrée, 2-1'), t('On perd, c’est sûr')], 1],
    ],
  },
  'evt-match-but': {
    engine: 'equilibre', title: t('Sur les épaules !'), how: t('BUT ! Le grand frère te hisse sur ses épaules : agite le drapeau sans tomber dans la foule.'), decor: 'bitume', carry: 'drapeau', verb: t('Reste debout'), distance: 90,
  },

  // Concert de coupé-décalé
  'evt-concert-danser': {
    engine: 'rythme', title: t('Les pas du coupé-décalé'), how: t('Le DJ lance le son : enchaîne les pas sur la ligne, la foule te regarde.'), decor: 'scene', lanes: ['enceinte', 'platine', 'chaussure'], tempo: 125, notes: 32,
  },
  'evt-concert-travailler': {
    engine: 'viser', title: t('Le « travaillement »'), how: t('Le DJ crie ton nom : vise bien et lance tes billets jusqu’au micro, comme un vrai boss.'), decor: 'scene', projectile: 'billet', target: 'micro', shots: 5,
  },
  'evt-concert-dj': {
    engine: 'repondre', title: t('Ton morceau au DJ'), how: t('Le DJ est occupé : trouve les mots pour qu’il passe ton morceau.'), decor: 'scene', npc: 'ami',
    lines: [
      [t('Eh, petit, tu veux quoi ?'), [t('Grand DJ, un coupé-décalé pour moi, s’il te plaît !'), t('Change ta musique, c’est nul.'), t('Rien.')], 0],
      [t('Tout le monde me demande des morceaux…'), [t('Moi d’abord !'), t('Je danse devant si tu le mets, je chauffe la piste !'), t('Tant pis.')], 1],
      [t('Tu vas dire mon nom au micro aussi ?'), [t('Jamais.'), t('Ça coûte combien ?'), t('Le meilleur DJ du quartier, tout le monde va l’entendre !')], 2],
      [t('Allez, celui-là c’est pour toi. Ça te va ?'), [t('C’est ça même ! Merci grand frère !'), t('Bof.'), t('J’ai demandé autre chose.')], 0],
    ],
  },

  // Embouteillage (« Régler la circulation » keeps its own game: defi/Circulation.tsx)
  'evt-embouteillage-eau': {
    engine: 'choisir', title: t('Entre les voitures'), how: t('Le bouchon ne bouge pas : chaque chauffeur réclame quelque chose par la fenêtre, tends-le-lui avant l’autre vendeur.'), decor: 'bitume', caller: t('Un chauffeur'),
    items: [{ name: t('Le sachet d’eau glacée'), prop: 'sachet-eau' }, { name: t('Le jus de bissap'), prop: 'jus' }, { name: t('Le soda'), prop: 'soda' }, { name: t('La noix de coco'), prop: 'noix-coco' }, { name: t('Les bonbons'), prop: 'bonbon' }, { name: t('Le journal'), prop: 'journal' }],
    rounds: 6,
  },

  // Contrôle de police
  'evt-controle-papiers': {
    engine: 'choisir', title: t('Vos papiers !'), how: t('L’agent réclame un papier après l’autre : sors le bon, vite, sans fouiller partout.'), decor: 'bitume', caller: t('L’agent'),
    items: [{ name: t('La carte d’identité'), prop: 'badge' }, { name: t('Le passeport'), prop: 'passeport' }, { name: t('Les papiers de la moto'), prop: 'dossier' }, { name: t('Le ticket de la vignette'), prop: 'ticket' }, { name: t('Les clés'), prop: 'cle' }, { name: t('Le téléphone'), prop: 'telephone' }],
  },
  'evt-controle-poli': {
    engine: 'repondre', title: t('Rester poli'), how: t('L’agent est fatigué et il fait chaud : garde ton calme et trouve la réponse qui passe.'), decor: 'bitume', npc: 'policier',
    lines: [
      [t('Bonjour ! Tu vas où comme ça ?'), [t('Bonjour chef ! Je rentre à la maison.'), t('Ça te regarde ?'), t('Nulle part.')], 0],
      [t('Ton casque, il est où ?'), [t('C’est pas obligatoire.'), t('Pardon chef, je le mets tout de suite.'), t('Je l’ai oublié chez toi.')], 1],
      [t('Laisse quelque chose pour le café…'), [t('Tiens, 5 000.'), t('Je vais le dire à ta maman.'), t('Je n’ai que mes papiers en règle, chef, et un grand merci.')], 2],
      [t('Bon, c’est bon. Bonne route.'), [t('Merci chef, bonne journée à vous !'), t('Enfin !'), t('Tu m’as fait perdre mon temps.')], 0],
    ],
  },

  // Match de foot de quartier (« Jouer avec eux » keeps its real 3D match)
  'evt-foot-penalty': {
    engine: 'viser', title: t('La séance de penalties'), how: t('Les petits ont posé deux cailloux pour les poteaux : vise, dose ta frappe, marque.'), decor: 'terre', projectile: 'ballon-foot', target: 'but', shots: 5,
  },
  'evt-foot-commenter': {
    engine: 'repondre', title: t('Le commentateur'), how: t('Les petits veulent leur commentateur, comme à la télé : trouve la phrase qui fait crier le terrain.'), decor: 'terre', npc: 'enfant',
    lines: [
      [t('Tonton, il a dribblé trois joueurs !'), [t('« Quel talent ! On dirait Drogba ce petit ! »'), t('« Bof. »'), t('« Il triche. »')], 0],
      [t('But ! Tu dis quoi ?'), [t('« Ok. »'), t('« GOOOOOAAAL ! Le quartier est en feu ! »'), t('« Il était hors-jeu. »')], 1],
      [t('Le gardien a plongé dans la poussière !'), [t('« Il est sale maintenant. »'), t('« Rentre chez toi. »'), t('« Arrêt de grande classe, mesdames et messieurs ! »')], 2],
      [t('On a perdu… tu dis quoi ?'), [t('« Belle bagarre, on prend la revanche demain ! »'), t('« Vous êtes nuls. »'), t('« Je m’en vais. »')], 0],
    ],
  },

  // Baptême
  'evt-bapteme-plateau': {
    engine: 'equilibre', title: t('Le plateau du baptême'), how: t('Fais le tour des chaises en plastique avec le plateau de jus de bissap : garde-le droit jusqu’au bout.'), decor: 'terre', carry: 'plateau-service', verb: t('Garde le plateau droit'), distance: 110,
  },
  'evt-bapteme-cadeau': {
    engine: 'choisir', title: t('Le cadeau du bébé'), how: t('La maman dit ce qui manque au bébé : tends-lui le bon cadeau avant les autres invités.'), decor: 'table', caller: t('La maman'),
    items: [{ name: t('Le biberon'), prop: 'biberon' }, { name: t('La peluche'), prop: 'peluche' }, { name: t('Le pagne pour le dos'), prop: 'pagne' }, { name: t('Le savon du bébé'), prop: 'savon' }, { name: t('Le hochet'), prop: 'jouet' }, { name: t('La crème'), prop: 'creme' }],
  },

  // Anniversaire chez les voisins
  'evt-anniversaire-bougies': {
    engine: 'tenir', title: t('Souffle les bougies !'), how: t('Tout le monde chante : prends ton souffle, lâche dans le vert, toutes les bougies d’un coup.'), decor: 'table', object: 'gateau', verb: t('Prends ton souffle'), fill: 'force', times: 3,
  },
  'evt-anniversaire-gateau': {
    engine: 'assembler', title: t('Le gâteau servi'), how: t('Chaque invité attend sa part : pose dans l’ordre demandé, la part, la fourchette, la serviette.'), decor: 'table', base: 'assiette',
    parts: [{ name: t('La part de gâteau'), prop: 'gateau' }, { name: t('La fourchette'), prop: 'fourchette' }, { name: t('La serviette'), prop: 'serviette' }, { name: t('La bougie'), prop: 'bougie' }, { name: t('Le jus'), prop: 'jus' }],
  },
  'evt-anniversaire-cadeau': {
    engine: 'assembler', title: t('Le paquet cadeau'), how: t('Vite, avant qu’on ouvre les cadeaux : emballe dans l’ordre demandé.'), decor: 'table', base: 'carton',
    parts: [{ name: t('La peluche'), prop: 'peluche' }, { name: t('Le papier cadeau'), prop: 'tissu' }, { name: t('Le ruban'), prop: 'ruban' }, { name: t('La petite carte'), prop: 'affiche' }, { name: t('Le nœud'), prop: 'cadeau' }],
  },

  // Veillée funéraire (respectful)
  'evt-funerailles-chorale': {
    engine: 'rythme', title: t('Avec la chorale'), how: t('La chorale chante pour accompagner la famille : suis le tam-tam doucement, chaque note sur la ligne.'), decor: 'terre', lanes: ['bible', 'tam-tam', 'cierge'], tempo: 80, notes: 24,
  },
  'evt-funerailles-servir': {
    engine: 'equilibre', title: t('Servir les invités'), how: t('Sous les bâches, porte les verres d’eau aux invités, sans rien renverser, avec calme.'), decor: 'terre', carry: 'plateau-service', verb: t('Porte les verres'), distance: 110,
  },
  'evt-funerailles-condoleances': {
    engine: 'repondre', title: t('Les condoléances'), how: t('La tantie de la famille te reçoit : trouve les mots justes et respectueux.'), decor: 'terre', npc: 'maman',
    lines: [
      [t('Merci d’être venu·e, mon enfant.'), [t('Toutes mes condoléances, tantie. Que Dieu vous donne la force.'), t('Il y a à manger ?'), t('Je passais.')], 0],
      [t('Il était bon avec tout le quartier…'), [t('Ah bon ?'), t('Oui, on se souviendra toujours de lui.'), t('Je ne le connaissais pas.')], 1],
      [t('Tu restes un peu pour la veillée ?'), [t('Non, j’ai un match.'), t('Ça finit à quelle heure ?'), t('Oui tantie, je reste avec vous ce soir.')], 2],
      [t('Que Dieu te bénisse.'), [t('Amen, tantie. Courage à toute la famille.'), t('Merci, au revoir.'), t('Toi aussi, hein.')], 0],
    ],
  },

  // Réunion des ressortissants
  'evt-association-caisse': {
    engine: 'choisir', title: t('La caisse de l’association'), how: t('Le trésorier compte la caisse sous l’apatam : passe-lui chaque chose qu’il réclame, sans te tromper.'), decor: 'table', caller: t('Le trésorier'),
    items: [{ name: t('Le billet de 10 000'), prop: 'billet' }, { name: t('La pièce de 500'), prop: 'piece' }, { name: t('Le cahier des cotisations'), prop: 'cahier' }, { name: t('Le tampon'), prop: 'tampon' }, { name: t('Le stylo'), prop: 'stylo' }, { name: t('La calculatrice'), prop: 'calculatrice' }],
  },
  'evt-association-parole': {
    engine: 'repondre', title: t('La parole au village'), how: t('Le doyen te donne la parole : parle avec sagesse, comme on parle au village.'), decor: 'terre', npc: 'vieux',
    lines: [
      [t('Mon fils, tu as quelque chose à dire ?'), [t('Oui, doyen : on peut cotiser pour le puits du village.'), t('Non, j’ai faim.'), t('C’est trop long ici.')], 0],
      [t('Les jeunes ne viennent plus aux réunions…'), [t('C’est vrai, ils sont nuls.'), t('Je vais ramener mes amis la prochaine fois.'), t('Moi non plus je ne viendrai plus.')], 1],
      [t('Qui va représenter le quartier aux funérailles au village ?'), [t('Pas moi.'), t('Le président, c’est son travail.'), t('Je peux y aller avec les anciens.')], 2],
      [t('On lève la séance ?'), [t('Oui doyen, merci pour vos sages paroles.'), t('Enfin !'), t('On mange d’abord.')], 0],
    ],
  },

  // Jour de tontine
  'evt-tontine-cotiser': {
    engine: 'choisir', title: t('La part de la tontine'), how: t('La présidente réclame chaque chose : tends-lui la bonne avant les autres membres.'), decor: 'table', caller: t('La présidente'),
    items: [{ name: t('Le billet de 5 000'), prop: 'billet' }, { name: t('La pièce de 500'), prop: 'piece' }, { name: t('Le cahier de la tontine'), prop: 'cahier' }, { name: t('Le stylo'), prop: 'stylo' }, { name: t('La calculatrice'), prop: 'calculatrice' }],
  },
  'evt-tontine-cahier': {
    engine: 'quiz', title: t('Le cahier de la tontine'), how: t('La présidente te confie le cahier : fais les comptes juste, tout le monde regarde.'), decor: 'table', host: 'vendeuse',
    questions: [
      [t('Douze membres versent 5 000 chacun. Combien dans la caisse ?'), ['60 000', '50 000', '17 000'], 0],
      [t('Awa a déjà versé 3 000 sur 5 000. Il lui reste ?'), ['3 000', '2 000', '8 000'], 1],
      [t('La tontine tourne chaque mois, douze membres. Ton tour revient dans ?'), [t('Un mois'), t('Six mois'), t('Douze mois')], 2],
      [t('Quelqu’un ne cotise pas ce mois-ci. On fait quoi ?'), [t('On l’écrit dans le cahier et on en parle avec lui'), t('On garde l’argent pour nous'), t('On arrête la tontine')], 0],
    ],
  },

  // Journée de salubrité
  'evt-salubrite-caniveau': {
    engine: 'nettoyer', title: t('Curer le caniveau'), how: t('Tout le quartier s’y met : retire chaque sachet qui bouche le caniveau avant la pluie.'), decor: 'bitume', object: 'caniveau', bit: 'sachet-eau', verb: t('Retire'), count: 10,
  },
  'evt-salubrite-brouette': {
    engine: 'equilibre', title: t('La brouette du quartier'), how: t('La brouette est pleine de feuilles et de sachets : pousse-la jusqu’au tas, sans la renverser.'), decor: 'terre', carry: 'brouette', verb: t('Pousse la brouette'), distance: 120,
  },

  // Ouverture d'une boutique
  'evt-boutique-cartons': {
    engine: 'equilibre', title: t('Les cartons de la boutique'), how: t('Le patron te paie pour porter les cartons : empile, avance, et rien ne tombe.'), decor: 'carrelage', carry: 'carton', verb: t('Porte les cartons'), distance: 100,
  },
  'evt-boutique-ruban': {
    engine: 'tenir', title: t('Couper le ruban'), how: t('Le patron te donne l’honneur : les ciseaux en main, serre et lâche pile dans le vert, sous les applaudissements.'), decor: 'carrelage', object: 'ruban', verb: t('Serre les ciseaux'), fill: 'tissu', times: 2,
  },
  'evt-boutique-file': {
    engine: 'course', title: t('Premier dans la file'), how: t('Les promos d’ouverture partent vite : fonce vers la porte, ramasse les tickets de tombola, évite les cartons.'), decor: 'carrelage', mode: 'pied', good: 'ticket', bad: 'carton', target: 12,
  },

  // Match de Ligue 1
  'evt-ligue1-chants': {
    engine: 'rythme', title: t('Dans la tribune'), how: t('Les supporters chantent pour leur club : tam-tam, mégaphone, drapeau, chaque temps sur la ligne.'), decor: 'herbe', lanes: ['tam-tam', 'megaphone', 'drapeau'], tempo: 120,
  },
  'evt-ligue1-tifo': {
    engine: 'photo', title: t('Le tifo'), how: t('La tribune se lève : filme les grands moments quand ils passent dans le cadre.'), decor: 'herbe',
    subjects: [{ name: t('Le grand drapeau'), prop: 'drapeau' }, { name: t('Le ballon au fond des filets'), prop: 'ballon-foot' }, { name: t('Les ballons du virage'), prop: 'ballon-fete' }, { name: t('La coupe'), prop: 'trophee' }],
  },

  // Tournoi de basket (« Jouer un match » keeps its real 3D match)
  'evt-basket-lancers': {
    engine: 'viser', title: t('Les lancers francs'), how: t('Le concours de lancers du tournoi : vise le panier, dose ton tir, swish.'), decor: 'bitume', projectile: 'ballon-basket', target: 'panier-basket', shots: 5,
  },
  'evt-basket-micro': {
    engine: 'repondre', title: t('Au micro du tournoi'), how: t('Le commentateur te passe le micro : chauffe le public.'), decor: 'bitume', npc: 'ami',
    lines: [
      [t('Un dunk ! Tu dis quoi au micro ?'), [t('« Il a plié le cercle ! Le quartier est debout ! »'), t('« Pas mal. »'), t('« Il a eu de la chance. »')], 0],
      [t('Le public s’endort un peu…'), [t('« Bon, rentrez chez vous. »'), t('« Faites du bruit pour les équipes ! »'), t('« Moi aussi j’ai sommeil. »')], 1],
      [t('Score serré, dernière minute !'), [t('« Bof, ça va finir pareil. »'), t('« Qui a de l’eau ? »'), t('« Tout se joue maintenant, mesdames et messieurs ! »')], 2],
      [t('On remercie qui à la fin ?'), [t('« Merci aux joueurs, au public, et au quartier ! »'), t('« Moi-même. »'), t('« Personne. »')], 0],
    ],
  },

  // Rue inondée
  'evt-inondation-caniveau': {
    engine: 'nettoyer', title: t('Le caniveau bouché'), how: t('L’eau ne descend plus : retire chaque sachet et chaque feuille qui bouchent le caniveau.'), decor: 'bitume', object: 'caniveau', bit: 'feuille', verb: t('Retire'), count: 10,
  },
  'evt-inondation-passeur': {
    engine: 'equilibre', title: t('Le passeur de la rue'), how: t('Les passants te confient leur sac pour traverser l’eau : porte-le sur la tête sans le mouiller.'), decor: 'eau', carry: 'sac', verb: t('Garde le sac au sec'), distance: 100,
  },
  'evt-inondation-affaires': {
    engine: 'course', title: t('Les affaires emportées'), how: t('L’eau emporte les sandales et les seaux du quartier : nage, repêche-les, évite les cartons qui flottent.'), decor: 'eau', mode: 'nage', good: 'chaussure', bad: 'carton', target: 12,
  },

  // FEMUA
  'evt-femua-danser': {
    engine: 'rythme', title: t('Devant la grande scène'), how: t('Anoumabo est plein : danse avec la foule, chaque note sur la ligne, jusqu’au bout du concert.'), decor: 'scene', lanes: ['micro', 'guitare', 'enceinte'], tempo: 125, notes: 36,
  },
  'evt-femua-filmer': {
    engine: 'photo', title: t('Filmer les artistes'), how: t('Les artistes bougent sur la grande scène : filme quand le bon moment est dans le cadre.'), decor: 'scene',
    subjects: [{ name: t('Le chanteur au micro'), prop: 'micro' }, { name: t('Le guitariste'), prop: 'guitare' }, { name: t('Les baffles qui tremblent'), prop: 'enceinte' }, { name: t('Les ballons de la foule'), prop: 'ballon-fete' }],
  },
  'evt-femua-quiz': {
    engine: 'quiz', title: t('Le quiz du FEMUA'), how: t('Ton amie connaît le festival par cœur : réponds juste à ses questions.'), decor: 'scene', host: 'amie',
    questions: [
      [t('FEMUA, ça veut dire ?'), [t('Festival des musiques urbaines d’Anoumabo'), t('Fête des mamans unies d’Abidjan'), t('Festival de Marcory')], 0],
      [t('Anoumabo, c’est dans quelle commune ?'), [t('Cocody'), t('Marcory'), t('Abobo')], 1],
      [t('L’entrée du grand concert, c’est combien ?'), ['50 000', '10 000', t('Gratuit')], 2],
      [t('Le festival est né en quelle année ?'), ['2008', '1990', '2020'], 0],
    ],
  },

  // Abissa (Grand-Bassam)
  'evt-abissa-tambours': {
    engine: 'rythme', title: t('Les tambours de l’Abissa'), how: t('Les N’zima dansent au son des tambours : suis le rythme, chaque coup sur la ligne.'), decor: 'sable', lanes: ['tam-tam', 'djembe', 'calebasse'], tempo: 115,
  },
  'evt-abissa-photo': {
    engine: 'photo', title: t('La fête en photo'), how: t('Danseurs, pagnes et tambours passent : déclenche quand le bon sujet est dans le cadre.'), decor: 'sable',
    subjects: [{ name: t('Le grand tambour'), prop: 'tam-tam' }, { name: t('Le pagne de fête'), prop: 'pagne' }, { name: t('Le masque'), prop: 'masque' }, { name: t('Le drapeau'), prop: 'drapeau' }],
  },

  // Carnaval de Bouaké
  'evt-carnaval-danser': {
    engine: 'rythme', title: t('Derrière les chars'), how: t('La fanfare passe : danse derrière les chars, chaque note sur la ligne.'), decor: 'bitume', lanes: ['tam-tam', 'enceinte', 'ballon-fete'], tempo: 120,
  },
  'evt-carnaval-bonbons': {
    engine: 'attraper', title: t('Les bonbons des chars'), how: t('Les chars lancent des bonbons à la foule : attrape-les dans ton sac, laisse tomber les cailloux.'), decor: 'bitume', from: 'ballon-fete', into: 'sac',
    good: [{ name: t('Le bonbon'), prop: 'bonbon' }, { name: t('La sucette'), prop: 'glace' }, { name: t('Le petit jouet'), prop: 'jouet' }],
    bad: [{ name: t('Le caillou'), prop: 'caillou' }],
  },

  // Fête des masques (Man)
  'evt-masques-photo': {
    engine: 'photo', title: t('Les masques dansent'), how: t('Les masques et les échassiers passent sur la place : photographie-les quand ils sont dans le cadre.'), decor: 'terre',
    subjects: [{ name: t('Le grand masque'), prop: 'masque' }, { name: t('La statue sculptée'), prop: 'statue' }, { name: t('Le tambour'), prop: 'tam-tam' }, { name: t('Les montagnes au loin'), prop: 'caillou' }],
  },
  'evt-masques-griot': {
    engine: 'quiz', title: t('Le griot raconte'), how: t('Le vieux griot raconte la fête : écoute bien et réponds à ses questions.'), decor: 'terre', host: 'vieux',
    questions: [
      [t('Man, on l’appelle la ville aux dix-huit… ?'), [t('Montagnes'), t('Rivières'), t('Marchés')], 0],
      [t('Les danseurs perchés sur de grandes jambes de bois, ce sont… ?'), [t('Des acrobates de cirque'), t('Les échassiers'), t('Des géants')], 1],
      [t('Devant un masque sacré, on fait quoi ?'), [t('On le touche'), t('On rigole'), t('On le respecte, on garde ses distances')], 2],
      [t('Ce qui fait danser les masques ?'), [t('Les tambours et les percussions'), t('La radio'), t('Le silence')], 0],
    ],
  },

  // Fête de l'Indépendance
  'evt-independance-drapeau': {
    engine: 'tenir', title: t('Le drapeau hissé'), how: t('Tout le monde se lève : tire la corde doucement, lâche dans le vert pour que le drapeau monte bien droit.'), decor: 'bitume', object: 'drapeau', verb: t('Hisse'), fill: 'force', times: 3,
  },
  'evt-independance-defile': {
    engine: 'rythme', title: t('Le défilé du 7 août'), how: t('Les écoles et le quartier défilent : marche au pas, chaque temps sur la ligne.'), decor: 'bitume', lanes: ['tam-tam', 'sifflet', 'drapeau'], tempo: 100,
  },
  'evt-independance-quiz': {
    engine: 'quiz', title: t('Le quiz du 7 août'), how: t('Le vieux du quartier interroge les jeunes : montre que tu connais ton pays.'), decor: 'bitume', host: 'vieux',
    questions: [
      [t('La Côte d’Ivoire est indépendante depuis quelle année ?'), ['1960', '1980', '1945'], 0],
      [t('Les couleurs du drapeau, dans l’ordre ?'), [t('Vert, blanc, orange'), t('Orange, blanc, vert'), t('Rouge, jaune, vert')], 1],
      [t('L’hymne national s’appelle ?'), [t('« La Marseillaise »'), t('« Le chant de Babi »'), t('« L’Abidjanaise »')], 2],
      [t('La capitale politique du pays ?'), [t('Yamoussoukro'), t('Bouaké'), t('San-Pédro')], 0],
    ],
  },

  // Journée de la Paix
  'evt-paix-message': {
    engine: 'repondre', title: t('Un mot de paix'), how: t('Ton voisin a eu une dispute avec un autre voisin : trouve les mots qui rapprochent.'), decor: 'terre', npc: 'ami',
    lines: [
      [t('Lui et moi on ne se parle plus depuis la fête…'), [t('Aujourd’hui c’est la journée de la Paix, allez vous serrer la main !'), t('Laisse-le.'), t('Il a raison contre toi.')], 0],
      [t('Et s’il refuse ?'), [t('Tant pis pour lui.'), t('On y va ensemble, je serai à côté de toi.'), t('Frappe-le.')], 1],
      [t('Tu crois qu’on peut encore être amis ?'), [t('Non.'), t('Peut-être, je ne sais pas.'), t('Bien sûr : un voisin, c’est un frère.')], 2],
      [t('Merci, tu es un vrai voisin.'), [t('C’est la paix qui gagne, mon frère !'), t('Tu me dois une bière.'), t('Bof.')], 0],
    ],
  },
  'evt-paix-arbre': {
    engine: 'tenir', title: t('L’arbre de la paix'), how: t('Le quartier a planté un jeune arbre : arrose-le doucement, lâche dans le vert, sans noyer ses racines.'), decor: 'terre', object: 'plante', verb: t('Arrose'), fill: 'liquide', times: 3,
  },

  // Fête du Travail
  'evt-travail-defile': {
    engine: 'rythme', title: t('Le défilé du 1er mai'), how: t('Les collègues défilent : mégaphone, sifflet, tam-tam, chaque slogan sur la ligne.'), decor: 'bitume', lanes: ['megaphone', 'sifflet', 'tam-tam'], tempo: 105,
  },
  'evt-travail-repas': {
    engine: 'choisir', title: t('Le repas entre collègues'), how: t('Le collègue commande pour toute la table : sers-lui le bon plat avant le serveur.'), decor: 'table', caller: t('Le collègue'),
    items: [{ name: t('Le garba'), prop: 'garba' }, { name: t('L’alloco'), prop: 'alloco' }, { name: t('Les brochettes'), prop: 'brochette' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le poulet braisé'), prop: 'poulet' }, { name: t('Le jus'), prop: 'jus' }],
  },

  // Noël
  'evt-noel-bonbons': {
    engine: 'choisir', title: t('Les bonbons de Noël'), how: t('Les enfants en habits neufs font la queue : donne à chacun ce qu’il demande, sans te tromper.'), decor: 'bitume', caller: t('Un enfant'),
    items: [{ name: t('Les bonbons'), prop: 'bonbon' }, { name: t('La glace'), prop: 'glace' }, { name: t('Le ballon'), prop: 'ballon-foot' }, { name: t('La peluche'), prop: 'peluche' }, { name: t('Le ballon de fête'), prop: 'ballon-fete' }, { name: t('Le petit jouet'), prop: 'jouet' }],
  },
  'evt-noel-cadeaux': {
    engine: 'assembler', title: t('Les paquets de Noël'), how: t('Les cadeaux des enfants du quartier : emballe chacun dans l’ordre demandé.'), decor: 'table', base: 'carton',
    parts: [{ name: t('Le jouet'), prop: 'jouet' }, { name: t('Le papier cadeau'), prop: 'tissu' }, { name: t('Le ruban'), prop: 'ruban' }, { name: t('L’étoile'), prop: 'etoile' }, { name: t('Le nœud'), prop: 'cadeau' }],
  },

  // Bonne année
  'evt-nouvel-an-voeux': {
    engine: 'repondre', title: t('La tournée des vœux'), how: t('De cour en cour, les anciens attendent leurs vœux : trouve les bons mots.'), decor: 'terre', npc: 'vieux',
    lines: [
      [t('Eh, c’est toi ! Tu viens me souhaiter quoi ?'), [t('Bonne année papa, bonne santé et longue vie !'), t('Rien, je passe.'), t('Donne-moi mes étrennes.')], 0],
      [t('Et l’année passée, c’était comment ?'), [t('Nulle.'), t('Dure, mais on est là, Dieu merci !'), t('Je ne sais pas.')], 1],
      [t('Tu vas faire quoi de bien cette année ?'), [t('Dormir.'), t('Rien du tout.'), t('Travailler dur et aider la famille.')], 2],
      [t('Tiens, prends ça pour la route.'), [t('Merci papa, que l’année te garde !'), t('C’est tout ?'), t('Garde-le.')], 0],
    ],
  },
  'evt-nouvel-an-danser': {
    engine: 'rythme', title: t('Jusqu’au matin'), how: t('La cour est en fête : danse jusqu’au lever du soleil, chaque note sur la ligne.'), decor: 'terre', lanes: ['enceinte', 'djembe', 'ballon-fete'], tempo: 120, notes: 36,
  },

  // Korité
  'evt-korite-marmite': {
    engine: 'equilibre', title: t('La marmite de fête'), how: t('Porte la grande marmite jusqu’à la natte des voisins, sans renverser la sauce sur ton boubou neuf.'), decor: 'terre', carry: 'marmite', verb: t('Porte la marmite'), distance: 110,
  },
  'evt-korite-voeux': {
    engine: 'repondre', title: t('Bonne fête !'), how: t('Les voisins sortent en boubous neufs : souhaite la bonne fête comme il faut.'), decor: 'terre', npc: 'imam',
    lines: [
      [t('Bonne fête, mon enfant !'), [t('Bonne fête à vous aussi, que Dieu accepte vos prières !'), t('Merci, au revoir.'), t('Il y a quoi à manger ?')], 0],
      [t('Tu as fait la prière du matin avec nous ?'), [t('Non, j’ai dormi.'), t('Je suis venu·e vous saluer après, avec tout le respect.'), t('Ça ne me regarde pas.')], 1],
      [t('Viens, assieds-toi, on partage le repas.'), [t('Non merci, je n’aime pas.'), t('Je mange vite et je pars.'), t('Avec plaisir, merci pour votre accueil.')], 2],
      [t('Que la paix soit avec toi.'), [t('Et avec vous aussi, bonne fête à toute la famille !'), t('D’accord.'), t('Bye.')], 0],
    ],
  },

  // Tabaski
  'evt-tabaski-assiettes': {
    engine: 'assembler', title: t('Les assiettes des voisins'), how: t('La viande du mouton se partage : prépare chaque assiette dans l’ordre demandé.'), decor: 'table', base: 'assiette',
    parts: [{ name: t('Le riz'), prop: 'riz' }, { name: t('La viande grillée'), prop: 'brochette' }, { name: t('Les oignons'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }, { name: t('La tomate'), prop: 'tomate' }],
  },
  'evt-tabaski-visites': {
    engine: 'repondre', title: t('Les visites de Tabaski'), how: t('Tu fais le tour des voisins avec ton assiette : sois poli·e à chaque porte.'), decor: 'terre', npc: 'maman',
    lines: [
      [t('Ah, bonne fête ! Tu nous apportes quoi ?'), [t('La part de viande de la famille, bonne fête tantie !'), t('Rien.'), t('Combien tu me donnes ?')], 0],
      [t('Assieds-toi un peu, tu as mangé ?'), [t('Je suis pressé·e.'), t('Merci tantie, juste un peu alors !'), t('Ta cuisine n’est pas bonne.')], 1],
      [t('Salue bien ta maman pour moi.'), [t('Fais-le toi-même.'), t('Ok.'), t('Je n’y manquerai pas, tantie, merci !')], 2],
      [t('Que Dieu bénisse ta famille.'), [t('Amen, et la vôtre aussi !'), t('Merci, bye.'), t('Hum.')], 0],
    ],
  },
}
