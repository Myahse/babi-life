import type { Jeu } from '../types'

// The street's happenings played (the update « evenements-joues », backend game/happenings_joues.go):
// each choice, by its id, its own little game on the engines, with the game's own 3D objects.
export const JEUX_EVENEMENTS: Record<string, Jeu> = {
  // Grosse pluie
  'evt-pluie-courir': {
    engine: 'course', title: 'Courir s’abriter', how: 'L’averse tombe : cours jusqu’à l’auvent, ramasse les journaux pour te couvrir, saute les flaques… et gare au gbaka qui fonce dedans !', decor: 'bitume', mode: 'pied', good: 'journal', bad: 'flaque', rush: 'gbaka', rain: true, target: 12,
  },
  'evt-pluie-sachets': {
    engine: 'choisir', title: 'Les sachets de pluie', how: 'Les passants courent sous l’averse : chacun réclame quelque chose, tends-le-lui avant l’autre petit vendeur.', decor: 'bitume', caller: 'Un passant',
    items: [{ name: 'Le chapeau-sachet', prop: 'sachet-pluie' }, { name: 'Le parapluie', prop: 'parapluie' }, { name: 'Le journal', prop: 'journal' }, { name: 'Le sachet d’eau', prop: 'sachet-eau' }, { name: 'La serviette', prop: 'serviette' }, { name: 'Le pagne', prop: 'pagne' }],
    rounds: 6,
  },
  'evt-pluie-danser': {
    engine: 'rythme', title: 'Danser sous la pluie', how: 'Les enfants dansent sous l’averse : tape chaque note sur la ligne, entre les gouttes et les éclaboussures.', decor: 'bitume', lanes: ['goutte', 'djembe', 'flaque'], tempo: 110,
  },
  'evt-pluie-voiture': {
    engine: 'tenir', title: 'La voiture embourbée', how: 'La roue patine dans la boue : tout le monde pousse ensemble. Tiens pour pousser, lâche dans le vert quand le chauffeur accélère.', decor: 'terre', object: 'voiture', verb: 'Pousse', fill: 'force', times: 3,
  },

  // Délestage
  'evt-delestage-lampe': {
    engine: 'tenir', title: 'La lampe-tempête', how: 'Tout est noir : monte la mèche doucement, lâche dans le vert. Trop haut, ça fume ; trop bas, ça s’éteint.', decor: 'table', object: 'lampe', verb: 'Monte la mèche', fill: 'chaleur', times: 3,
  },
  'evt-delestage-contes': {
    engine: 'quiz', title: 'Les contes du noir', how: 'Autour de la bougie, le vieux raconte : Kacou Ananzè, la tortue, le lièvre… Trouve la suite de l’histoire.', decor: 'terre', host: 'vieux',
    questions: [
      ['Kacou Ananzè, le héros des contes, c’est quel animal ?', ['L’araignée', 'Le lion', 'Le crocodile'], 0],
      ['Dans les contes, qui gagne la course contre le lièvre ?', ['Le léopard', 'La tortue, lente mais maline', 'Le singe'], 1],
      ['Quand le conteur dit « Il était une fois… », on répond ?', ['« Tais-toi ! »', '« Bonne nuit »', '« On t’écoute, papa ! »'], 2],
      ['Pourquoi l’araignée a-t-elle la taille si fine, dit le conte ?', ['Elle a trop serré sa ceinture par gourmandise', 'Elle fait du sport', 'Elle ne mange que du riz'], 0],
      ['Le conte fini, que dit le vieux à la fin ?', ['« Le conte est parti dans la brousse, que le prochain le ramène »', '« Payez-moi »', '« C’était faux »'], 0],
    ],
  },
  'evt-delestage-groupe': {
    engine: 'assembler', title: 'Le groupe électrogène', how: 'Le voisin te passe ses outils : remets tout dans l’ordre demandé pour faire repartir le groupe.', decor: 'terre', base: 'groupe-electrogene',
    parts: [{ name: 'L’essence', prop: 'essence' }, { name: 'La clé', prop: 'cle' }, { name: 'La corde du démarreur', prop: 'corde' }, { name: 'Le marteau', prop: 'marteau' }, { name: 'La lampe', prop: 'lampe' }],
  },

  // Mariage
  'evt-mariage-danser': {
    engine: 'rythme', title: 'Le cortège danse', how: 'Les klaxons, le tam-tam et la sono : danse avec les tantes en pagne assorti, chaque note sur la ligne.', decor: 'bitume', lanes: ['tam-tam', 'enceinte', 'pagne'], tempo: 115,
  },
  'evt-mariage-riz': {
    engine: 'viser', title: 'Le riz sur les mariés', how: 'Les mariés sortent sous les applaudissements : vise et lance ton riz jusqu’à eux, sans arroser les tantes.', decor: 'bitume', projectile: 'riz', target: 'coeur', shots: 5,
  },
  'evt-mariage-photo': {
    engine: 'photo', title: 'La photo des mariés', how: 'Tout le monde bouge : déclenche quand le bon sujet est bien dans le cadre.', decor: 'bitume',
    subjects: [{ name: 'La mariée et sa robe', prop: 'robe' }, { name: 'Le marié en boubou', prop: 'boubou' }, { name: 'Le gâteau à étages', prop: 'gateau' }, { name: 'Les ballons du cortège', prop: 'ballon-fete' }],
  },

  // Match des Éléphants
  'evt-match-ambiance': {
    engine: 'rythme', title: 'Allez les Éléphants !', how: 'Devant l’écran géant, le quartier chante : tam-tam, sifflet, drapeau, chaque temps sur la ligne.', decor: 'bitume', lanes: ['tam-tam', 'sifflet', 'drapeau'], tempo: 120,
  },
  'evt-match-prono': {
    engine: 'quiz', title: 'Le pronostic', how: 'Ton ami sort son carnet de pronos : prouve que tu connais tes Éléphants.', decor: 'bitume', host: 'ami',
    questions: [
      ['Les Éléphants portent quelle couleur à domicile ?', ['Le orange', 'Le bleu', 'Le rouge'], 0],
      ['Combien de joueurs par équipe sur le terrain ?', ['9', '11', '13'], 1],
      ['La CAN 2023, jouée en Côte d’Ivoire, qui l’a gagnée ?', ['Le Nigeria', 'L’Égypte', 'La Côte d’Ivoire'], 2],
      ['Un match nul en phase de poules, ça vaut combien de points ?', ['Un point', 'Trois points', 'Zéro'], 0],
      ['Le pronostic le plus sage, c’est ?', ['10-0 pour nous !', 'Une victoire serrée, 2-1', 'On perd, c’est sûr'], 1],
    ],
  },
  'evt-match-but': {
    engine: 'equilibre', title: 'Sur les épaules !', how: 'BUT ! Le grand frère te hisse sur ses épaules : agite le drapeau sans tomber dans la foule.', decor: 'bitume', carry: 'drapeau', verb: 'Reste debout', distance: 90,
  },

  // Concert de coupé-décalé
  'evt-concert-danser': {
    engine: 'rythme', title: 'Les pas du coupé-décalé', how: 'Le DJ lance le son : enchaîne les pas sur la ligne, la foule te regarde.', decor: 'scene', lanes: ['enceinte', 'platine', 'chaussure'], tempo: 125, notes: 32,
  },
  'evt-concert-travailler': {
    engine: 'viser', title: 'Le « travaillement »', how: 'Le DJ crie ton nom : vise bien et lance tes billets jusqu’au micro, comme un vrai boss.', decor: 'scene', projectile: 'billet', target: 'micro', shots: 5,
  },
  'evt-concert-dj': {
    engine: 'repondre', title: 'Ton morceau au DJ', how: 'Le DJ est occupé : trouve les mots pour qu’il passe ton morceau.', decor: 'scene', npc: 'ami',
    lines: [
      ['Eh, petit, tu veux quoi ?', ['Grand DJ, un coupé-décalé pour moi, s’il te plaît !', 'Change ta musique, c’est nul.', 'Rien.'], 0],
      ['Tout le monde me demande des morceaux…', ['Moi d’abord !', 'Je danse devant si tu le mets, je chauffe la piste !', 'Tant pis.'], 1],
      ['Tu vas dire mon nom au micro aussi ?', ['Jamais.', 'Ça coûte combien ?', 'Le meilleur DJ du quartier, tout le monde va l’entendre !'], 2],
      ['Allez, celui-là c’est pour toi. Ça te va ?', ['C’est ça même ! Merci grand frère !', 'Bof.', 'J’ai demandé autre chose.'], 0],
    ],
  },

  // Embouteillage (« Régler la circulation » keeps its own game: defi/Circulation.tsx)
  'evt-embouteillage-eau': {
    engine: 'choisir', title: 'Entre les voitures', how: 'Le bouchon ne bouge pas : chaque chauffeur réclame quelque chose par la fenêtre, tends-le-lui avant l’autre vendeur.', decor: 'bitume', caller: 'Un chauffeur',
    items: [{ name: 'Le sachet d’eau glacée', prop: 'sachet-eau' }, { name: 'Le jus de bissap', prop: 'jus' }, { name: 'Le soda', prop: 'soda' }, { name: 'La noix de coco', prop: 'noix-coco' }, { name: 'Les bonbons', prop: 'bonbon' }, { name: 'Le journal', prop: 'journal' }],
    rounds: 6,
  },

  // Contrôle de police
  'evt-controle-papiers': {
    engine: 'choisir', title: 'Vos papiers !', how: 'L’agent réclame un papier après l’autre : sors le bon, vite, sans fouiller partout.', decor: 'bitume', caller: 'L’agent',
    items: [{ name: 'La carte d’identité', prop: 'badge' }, { name: 'Le passeport', prop: 'passeport' }, { name: 'Les papiers de la moto', prop: 'dossier' }, { name: 'Le ticket de la vignette', prop: 'ticket' }, { name: 'Les clés', prop: 'cle' }, { name: 'Le téléphone', prop: 'telephone' }],
  },
  'evt-controle-poli': {
    engine: 'repondre', title: 'Rester poli', how: 'L’agent est fatigué et il fait chaud : garde ton calme et trouve la réponse qui passe.', decor: 'bitume', npc: 'policier',
    lines: [
      ['Bonjour ! Tu vas où comme ça ?', ['Bonjour chef ! Je rentre à la maison.', 'Ça te regarde ?', 'Nulle part.'], 0],
      ['Ton casque, il est où ?', ['C’est pas obligatoire.', 'Pardon chef, je le mets tout de suite.', 'Je l’ai oublié chez toi.'], 1],
      ['Laisse quelque chose pour le café…', ['Tiens, 5 000.', 'Je vais le dire à ta maman.', 'Je n’ai que mes papiers en règle, chef, et un grand merci.'], 2],
      ['Bon, c’est bon. Bonne route.', ['Merci chef, bonne journée à vous !', 'Enfin !', 'Tu m’as fait perdre mon temps.'], 0],
    ],
  },

  // Match de foot de quartier (« Jouer avec eux » keeps its real 3D match)
  'evt-foot-penalty': {
    engine: 'viser', title: 'La séance de penalties', how: 'Les petits ont posé deux cailloux pour les poteaux : vise, dose ta frappe, marque.', decor: 'terre', projectile: 'ballon-foot', target: 'but', shots: 5,
  },
  'evt-foot-commenter': {
    engine: 'repondre', title: 'Le commentateur', how: 'Les petits veulent leur commentateur, comme à la télé : trouve la phrase qui fait crier le terrain.', decor: 'terre', npc: 'enfant',
    lines: [
      ['Tonton, il a dribblé trois joueurs !', ['« Quel talent ! On dirait Drogba ce petit ! »', '« Bof. »', '« Il triche. »'], 0],
      ['But ! Tu dis quoi ?', ['« Ok. »', '« GOOOOOAAAL ! Le quartier est en feu ! »', '« Il était hors-jeu. »'], 1],
      ['Le gardien a plongé dans la poussière !', ['« Il est sale maintenant. »', '« Rentre chez toi. »', '« Arrêt de grande classe, mesdames et messieurs ! »'], 2],
      ['On a perdu… tu dis quoi ?', ['« Belle bagarre, on prend la revanche demain ! »', '« Vous êtes nuls. »', '« Je m’en vais. »'], 0],
    ],
  },

  // Baptême
  'evt-bapteme-plateau': {
    engine: 'equilibre', title: 'Le plateau du baptême', how: 'Fais le tour des chaises en plastique avec le plateau de jus de bissap : garde-le droit jusqu’au bout.', decor: 'terre', carry: 'plateau-service', verb: 'Garde le plateau droit', distance: 110,
  },
  'evt-bapteme-cadeau': {
    engine: 'choisir', title: 'Le cadeau du bébé', how: 'La maman dit ce qui manque au bébé : tends-lui le bon cadeau avant les autres invités.', decor: 'table', caller: 'La maman',
    items: [{ name: 'Le biberon', prop: 'biberon' }, { name: 'La peluche', prop: 'peluche' }, { name: 'Le pagne pour le dos', prop: 'pagne' }, { name: 'Le savon du bébé', prop: 'savon' }, { name: 'Le hochet', prop: 'jouet' }, { name: 'La crème', prop: 'creme' }],
  },

  // Anniversaire chez les voisins
  'evt-anniversaire-bougies': {
    engine: 'tenir', title: 'Souffle les bougies !', how: 'Tout le monde chante : prends ton souffle, lâche dans le vert, toutes les bougies d’un coup.', decor: 'table', object: 'gateau', verb: 'Prends ton souffle', fill: 'force', times: 3,
  },
  'evt-anniversaire-gateau': {
    engine: 'assembler', title: 'Le gâteau servi', how: 'Chaque invité attend sa part : pose dans l’ordre demandé, la part, la fourchette, la serviette.', decor: 'table', base: 'assiette',
    parts: [{ name: 'La part de gâteau', prop: 'gateau' }, { name: 'La fourchette', prop: 'fourchette' }, { name: 'La serviette', prop: 'serviette' }, { name: 'La bougie', prop: 'bougie' }, { name: 'Le jus', prop: 'jus' }],
  },
  'evt-anniversaire-cadeau': {
    engine: 'assembler', title: 'Le paquet cadeau', how: 'Vite, avant qu’on ouvre les cadeaux : emballe dans l’ordre demandé.', decor: 'table', base: 'carton',
    parts: [{ name: 'La peluche', prop: 'peluche' }, { name: 'Le papier cadeau', prop: 'tissu' }, { name: 'Le ruban', prop: 'ruban' }, { name: 'La petite carte', prop: 'affiche' }, { name: 'Le nœud', prop: 'cadeau' }],
  },

  // Veillée funéraire (respectful)
  'evt-funerailles-chorale': {
    engine: 'rythme', title: 'Avec la chorale', how: 'La chorale chante pour accompagner la famille : suis le tam-tam doucement, chaque note sur la ligne.', decor: 'terre', lanes: ['bible', 'tam-tam', 'cierge'], tempo: 80, notes: 24,
  },
  'evt-funerailles-servir': {
    engine: 'equilibre', title: 'Servir les invités', how: 'Sous les bâches, porte les verres d’eau aux invités, sans rien renverser, avec calme.', decor: 'terre', carry: 'plateau-service', verb: 'Porte les verres', distance: 110,
  },
  'evt-funerailles-condoleances': {
    engine: 'repondre', title: 'Les condoléances', how: 'La tantie de la famille te reçoit : trouve les mots justes et respectueux.', decor: 'terre', npc: 'maman',
    lines: [
      ['Merci d’être venu·e, mon enfant.', ['Toutes mes condoléances, tantie. Que Dieu vous donne la force.', 'Il y a à manger ?', 'Je passais.'], 0],
      ['Il était bon avec tout le quartier…', ['Ah bon ?', 'Oui, on se souviendra toujours de lui.', 'Je ne le connaissais pas.'], 1],
      ['Tu restes un peu pour la veillée ?', ['Non, j’ai un match.', 'Ça finit à quelle heure ?', 'Oui tantie, je reste avec vous ce soir.'], 2],
      ['Que Dieu te bénisse.', ['Amen, tantie. Courage à toute la famille.', 'Merci, au revoir.', 'Toi aussi, hein.'], 0],
    ],
  },

  // Réunion des ressortissants
  'evt-association-caisse': {
    engine: 'choisir', title: 'La caisse de l’association', how: 'Le trésorier compte la caisse sous l’apatam : passe-lui chaque chose qu’il réclame, sans te tromper.', decor: 'table', caller: 'Le trésorier',
    items: [{ name: 'Le billet de 10 000', prop: 'billet' }, { name: 'La pièce de 500', prop: 'piece' }, { name: 'Le cahier des cotisations', prop: 'cahier' }, { name: 'Le tampon', prop: 'tampon' }, { name: 'Le stylo', prop: 'stylo' }, { name: 'La calculatrice', prop: 'calculatrice' }],
  },
  'evt-association-parole': {
    engine: 'repondre', title: 'La parole au village', how: 'Le doyen te donne la parole : parle avec sagesse, comme on parle au village.', decor: 'terre', npc: 'vieux',
    lines: [
      ['Mon fils, tu as quelque chose à dire ?', ['Oui, doyen : on peut cotiser pour le puits du village.', 'Non, j’ai faim.', 'C’est trop long ici.'], 0],
      ['Les jeunes ne viennent plus aux réunions…', ['C’est vrai, ils sont nuls.', 'Je vais ramener mes amis la prochaine fois.', 'Moi non plus je ne viendrai plus.'], 1],
      ['Qui va représenter le quartier aux funérailles au village ?', ['Pas moi.', 'Le président, c’est son travail.', 'Je peux y aller avec les anciens.'], 2],
      ['On lève la séance ?', ['Oui doyen, merci pour vos sages paroles.', 'Enfin !', 'On mange d’abord.'], 0],
    ],
  },

  // Jour de tontine
  'evt-tontine-cotiser': {
    engine: 'choisir', title: 'La part de la tontine', how: 'La présidente réclame chaque chose : tends-lui la bonne avant les autres membres.', decor: 'table', caller: 'La présidente',
    items: [{ name: 'Le billet de 5 000', prop: 'billet' }, { name: 'La pièce de 500', prop: 'piece' }, { name: 'Le cahier de la tontine', prop: 'cahier' }, { name: 'Le stylo', prop: 'stylo' }, { name: 'La calculatrice', prop: 'calculatrice' }],
  },
  'evt-tontine-cahier': {
    engine: 'quiz', title: 'Le cahier de la tontine', how: 'La présidente te confie le cahier : fais les comptes juste, tout le monde regarde.', decor: 'table', host: 'vendeuse',
    questions: [
      ['Douze membres versent 5 000 chacun. Combien dans la caisse ?', ['60 000', '50 000', '17 000'], 0],
      ['Awa a déjà versé 3 000 sur 5 000. Il lui reste ?', ['3 000', '2 000', '8 000'], 1],
      ['La tontine tourne chaque mois, douze membres. Ton tour revient dans ?', ['Un mois', 'Six mois', 'Douze mois'], 2],
      ['Quelqu’un ne cotise pas ce mois-ci. On fait quoi ?', ['On l’écrit dans le cahier et on en parle avec lui', 'On garde l’argent pour nous', 'On arrête la tontine'], 0],
    ],
  },

  // Journée de salubrité
  'evt-salubrite-caniveau': {
    engine: 'nettoyer', title: 'Curer le caniveau', how: 'Tout le quartier s’y met : retire chaque sachet qui bouche le caniveau avant la pluie.', decor: 'bitume', object: 'caniveau', bit: 'sachet-eau', verb: 'Retire', count: 10,
  },
  'evt-salubrite-brouette': {
    engine: 'equilibre', title: 'La brouette du quartier', how: 'La brouette est pleine de feuilles et de sachets : pousse-la jusqu’au tas, sans la renverser.', decor: 'terre', carry: 'brouette', verb: 'Pousse la brouette', distance: 120,
  },

  // Ouverture d'une boutique
  'evt-boutique-cartons': {
    engine: 'equilibre', title: 'Les cartons de la boutique', how: 'Le patron te paie pour porter les cartons : empile, avance, et rien ne tombe.', decor: 'carrelage', carry: 'carton', verb: 'Porte les cartons', distance: 100,
  },
  'evt-boutique-ruban': {
    engine: 'tenir', title: 'Couper le ruban', how: 'Le patron te donne l’honneur : les ciseaux en main, serre et lâche pile dans le vert, sous les applaudissements.', decor: 'carrelage', object: 'ruban', verb: 'Serre les ciseaux', fill: 'tissu', times: 2,
  },
  'evt-boutique-file': {
    engine: 'course', title: 'Premier dans la file', how: 'Les promos d’ouverture partent vite : fonce vers la porte, ramasse les tickets de tombola, évite les cartons.', decor: 'carrelage', mode: 'pied', good: 'ticket', bad: 'carton', target: 12,
  },

  // Match de Ligue 1
  'evt-ligue1-chants': {
    engine: 'rythme', title: 'Dans la tribune', how: 'Les supporters chantent pour leur club : tam-tam, mégaphone, drapeau, chaque temps sur la ligne.', decor: 'herbe', lanes: ['tam-tam', 'megaphone', 'drapeau'], tempo: 120,
  },
  'evt-ligue1-tifo': {
    engine: 'photo', title: 'Le tifo', how: 'La tribune se lève : filme les grands moments quand ils passent dans le cadre.', decor: 'herbe',
    subjects: [{ name: 'Le grand drapeau', prop: 'drapeau' }, { name: 'Le ballon au fond des filets', prop: 'ballon-foot' }, { name: 'Les ballons du virage', prop: 'ballon-fete' }, { name: 'La coupe', prop: 'trophee' }],
  },

  // Tournoi de basket (« Jouer un match » keeps its real 3D match)
  'evt-basket-lancers': {
    engine: 'viser', title: 'Les lancers francs', how: 'Le concours de lancers du tournoi : vise le panier, dose ton tir, swish.', decor: 'bitume', projectile: 'ballon-basket', target: 'panier-basket', shots: 5,
  },
  'evt-basket-micro': {
    engine: 'repondre', title: 'Au micro du tournoi', how: 'Le commentateur te passe le micro : chauffe le public.', decor: 'bitume', npc: 'ami',
    lines: [
      ['Un dunk ! Tu dis quoi au micro ?', ['« Il a plié le cercle ! Le quartier est debout ! »', '« Pas mal. »', '« Il a eu de la chance. »'], 0],
      ['Le public s’endort un peu…', ['« Bon, rentrez chez vous. »', '« Faites du bruit pour les équipes ! »', '« Moi aussi j’ai sommeil. »'], 1],
      ['Score serré, dernière minute !', ['« Bof, ça va finir pareil. »', '« Qui a de l’eau ? »', '« Tout se joue maintenant, mesdames et messieurs ! »'], 2],
      ['On remercie qui à la fin ?', ['« Merci aux joueurs, au public, et au quartier ! »', '« Moi-même. »', '« Personne. »'], 0],
    ],
  },

  // Rue inondée
  'evt-inondation-caniveau': {
    engine: 'nettoyer', title: 'Le caniveau bouché', how: 'L’eau ne descend plus : retire chaque sachet et chaque feuille qui bouchent le caniveau.', decor: 'bitume', object: 'caniveau', bit: 'feuille', verb: 'Retire', count: 10,
  },
  'evt-inondation-passeur': {
    engine: 'equilibre', title: 'Le passeur de la rue', how: 'Les passants te confient leur sac pour traverser l’eau : porte-le sur la tête sans le mouiller.', decor: 'eau', carry: 'sac', verb: 'Garde le sac au sec', distance: 100,
  },
  'evt-inondation-affaires': {
    engine: 'course', title: 'Les affaires emportées', how: 'L’eau emporte les sandales et les seaux du quartier : nage, repêche-les, évite les cartons qui flottent.', decor: 'eau', mode: 'nage', good: 'chaussure', bad: 'carton', target: 12,
  },

  // FEMUA
  'evt-femua-danser': {
    engine: 'rythme', title: 'Devant la grande scène', how: 'Anoumabo est plein : danse avec la foule, chaque note sur la ligne, jusqu’au bout du concert.', decor: 'scene', lanes: ['micro', 'guitare', 'enceinte'], tempo: 125, notes: 36,
  },
  'evt-femua-filmer': {
    engine: 'photo', title: 'Filmer les artistes', how: 'Les artistes bougent sur la grande scène : filme quand le bon moment est dans le cadre.', decor: 'scene',
    subjects: [{ name: 'Le chanteur au micro', prop: 'micro' }, { name: 'Le guitariste', prop: 'guitare' }, { name: 'Les baffles qui tremblent', prop: 'enceinte' }, { name: 'Les ballons de la foule', prop: 'ballon-fete' }],
  },
  'evt-femua-quiz': {
    engine: 'quiz', title: 'Le quiz du FEMUA', how: 'Ton amie connaît le festival par cœur : réponds juste à ses questions.', decor: 'scene', host: 'amie',
    questions: [
      ['FEMUA, ça veut dire ?', ['Festival des musiques urbaines d’Anoumabo', 'Fête des mamans unies d’Abidjan', 'Festival de Marcory'], 0],
      ['Anoumabo, c’est dans quelle commune ?', ['Cocody', 'Marcory', 'Abobo'], 1],
      ['L’entrée du grand concert, c’est combien ?', ['50 000', '10 000', 'Gratuit'], 2],
      ['Le festival est né en quelle année ?', ['2008', '1990', '2020'], 0],
    ],
  },

  // Abissa (Grand-Bassam)
  'evt-abissa-tambours': {
    engine: 'rythme', title: 'Les tambours de l’Abissa', how: 'Les N’zima dansent au son des tambours : suis le rythme, chaque coup sur la ligne.', decor: 'sable', lanes: ['tam-tam', 'djembe', 'calebasse'], tempo: 115,
  },
  'evt-abissa-photo': {
    engine: 'photo', title: 'La fête en photo', how: 'Danseurs, pagnes et tambours passent : déclenche quand le bon sujet est dans le cadre.', decor: 'sable',
    subjects: [{ name: 'Le grand tambour', prop: 'tam-tam' }, { name: 'Le pagne de fête', prop: 'pagne' }, { name: 'Le masque', prop: 'masque' }, { name: 'Le drapeau', prop: 'drapeau' }],
  },

  // Carnaval de Bouaké
  'evt-carnaval-danser': {
    engine: 'rythme', title: 'Derrière les chars', how: 'La fanfare passe : danse derrière les chars, chaque note sur la ligne.', decor: 'bitume', lanes: ['tam-tam', 'enceinte', 'ballon-fete'], tempo: 120,
  },
  'evt-carnaval-bonbons': {
    engine: 'attraper', title: 'Les bonbons des chars', how: 'Les chars lancent des bonbons à la foule : attrape-les dans ton sac, laisse tomber les cailloux.', decor: 'bitume', from: 'ballon-fete', into: 'sac',
    good: [{ name: 'Le bonbon', prop: 'bonbon' }, { name: 'La sucette', prop: 'glace' }, { name: 'Le petit jouet', prop: 'jouet' }],
    bad: [{ name: 'Le caillou', prop: 'caillou' }],
  },

  // Fête des masques (Man)
  'evt-masques-photo': {
    engine: 'photo', title: 'Les masques dansent', how: 'Les masques et les échassiers passent sur la place : photographie-les quand ils sont dans le cadre.', decor: 'terre',
    subjects: [{ name: 'Le grand masque', prop: 'masque' }, { name: 'La statue sculptée', prop: 'statue' }, { name: 'Le tambour', prop: 'tam-tam' }, { name: 'Les montagnes au loin', prop: 'caillou' }],
  },
  'evt-masques-griot': {
    engine: 'quiz', title: 'Le griot raconte', how: 'Le vieux griot raconte la fête : écoute bien et réponds à ses questions.', decor: 'terre', host: 'vieux',
    questions: [
      ['Man, on l’appelle la ville aux dix-huit… ?', ['Montagnes', 'Rivières', 'Marchés'], 0],
      ['Les danseurs perchés sur de grandes jambes de bois, ce sont… ?', ['Des acrobates de cirque', 'Les échassiers', 'Des géants'], 1],
      ['Devant un masque sacré, on fait quoi ?', ['On le touche', 'On rigole', 'On le respecte, on garde ses distances'], 2],
      ['Ce qui fait danser les masques ?', ['Les tambours et les percussions', 'La radio', 'Le silence'], 0],
    ],
  },

  // Fête de l'Indépendance
  'evt-independance-drapeau': {
    engine: 'tenir', title: 'Le drapeau hissé', how: 'Tout le monde se lève : tire la corde doucement, lâche dans le vert pour que le drapeau monte bien droit.', decor: 'bitume', object: 'drapeau', verb: 'Hisse', fill: 'force', times: 3,
  },
  'evt-independance-defile': {
    engine: 'rythme', title: 'Le défilé du 7 août', how: 'Les écoles et le quartier défilent : marche au pas, chaque temps sur la ligne.', decor: 'bitume', lanes: ['tam-tam', 'sifflet', 'drapeau'], tempo: 100,
  },
  'evt-independance-quiz': {
    engine: 'quiz', title: 'Le quiz du 7 août', how: 'Le vieux du quartier interroge les jeunes : montre que tu connais ton pays.', decor: 'bitume', host: 'vieux',
    questions: [
      ['La Côte d’Ivoire est indépendante depuis quelle année ?', ['1960', '1980', '1945'], 0],
      ['Les couleurs du drapeau, dans l’ordre ?', ['Vert, blanc, orange', 'Orange, blanc, vert', 'Rouge, jaune, vert'], 1],
      ['L’hymne national s’appelle ?', ['« La Marseillaise »', '« Le chant de Babi »', '« L’Abidjanaise »'], 2],
      ['La capitale politique du pays ?', ['Yamoussoukro', 'Bouaké', 'San-Pédro'], 0],
    ],
  },

  // Journée de la Paix
  'evt-paix-message': {
    engine: 'repondre', title: 'Un mot de paix', how: 'Ton voisin a eu une dispute avec un autre voisin : trouve les mots qui rapprochent.', decor: 'terre', npc: 'ami',
    lines: [
      ['Lui et moi on ne se parle plus depuis la fête…', ['Aujourd’hui c’est la journée de la Paix, allez vous serrer la main !', 'Laisse-le.', 'Il a raison contre toi.'], 0],
      ['Et s’il refuse ?', ['Tant pis pour lui.', 'On y va ensemble, je serai à côté de toi.', 'Frappe-le.'], 1],
      ['Tu crois qu’on peut encore être amis ?', ['Non.', 'Peut-être, je ne sais pas.', 'Bien sûr : un voisin, c’est un frère.'], 2],
      ['Merci, tu es un vrai voisin.', ['C’est la paix qui gagne, mon frère !', 'Tu me dois une bière.', 'Bof.'], 0],
    ],
  },
  'evt-paix-arbre': {
    engine: 'tenir', title: 'L’arbre de la paix', how: 'Le quartier a planté un jeune arbre : arrose-le doucement, lâche dans le vert, sans noyer ses racines.', decor: 'terre', object: 'plante', verb: 'Arrose', fill: 'liquide', times: 3,
  },

  // Fête du Travail
  'evt-travail-defile': {
    engine: 'rythme', title: 'Le défilé du 1er mai', how: 'Les collègues défilent : mégaphone, sifflet, tam-tam, chaque slogan sur la ligne.', decor: 'bitume', lanes: ['megaphone', 'sifflet', 'tam-tam'], tempo: 105,
  },
  'evt-travail-repas': {
    engine: 'choisir', title: 'Le repas entre collègues', how: 'Le collègue commande pour toute la table : sers-lui le bon plat avant le serveur.', decor: 'table', caller: 'Le collègue',
    items: [{ name: 'Le garba', prop: 'garba' }, { name: 'L’alloco', prop: 'alloco' }, { name: 'Les brochettes', prop: 'brochette' }, { name: 'L’attiéké', prop: 'attieke' }, { name: 'Le poulet braisé', prop: 'poulet' }, { name: 'Le jus', prop: 'jus' }],
  },

  // Noël
  'evt-noel-bonbons': {
    engine: 'choisir', title: 'Les bonbons de Noël', how: 'Les enfants en habits neufs font la queue : donne à chacun ce qu’il demande, sans te tromper.', decor: 'bitume', caller: 'Un enfant',
    items: [{ name: 'Les bonbons', prop: 'bonbon' }, { name: 'La glace', prop: 'glace' }, { name: 'Le ballon', prop: 'ballon-foot' }, { name: 'La peluche', prop: 'peluche' }, { name: 'Le ballon de fête', prop: 'ballon-fete' }, { name: 'Le petit jouet', prop: 'jouet' }],
  },
  'evt-noel-cadeaux': {
    engine: 'assembler', title: 'Les paquets de Noël', how: 'Les cadeaux des enfants du quartier : emballe chacun dans l’ordre demandé.', decor: 'table', base: 'carton',
    parts: [{ name: 'Le jouet', prop: 'jouet' }, { name: 'Le papier cadeau', prop: 'tissu' }, { name: 'Le ruban', prop: 'ruban' }, { name: 'L’étoile', prop: 'etoile' }, { name: 'Le nœud', prop: 'cadeau' }],
  },

  // Bonne année
  'evt-nouvel-an-voeux': {
    engine: 'repondre', title: 'La tournée des vœux', how: 'De cour en cour, les anciens attendent leurs vœux : trouve les bons mots.', decor: 'terre', npc: 'vieux',
    lines: [
      ['Eh, c’est toi ! Tu viens me souhaiter quoi ?', ['Bonne année papa, bonne santé et longue vie !', 'Rien, je passe.', 'Donne-moi mes étrennes.'], 0],
      ['Et l’année passée, c’était comment ?', ['Nulle.', 'Dure, mais on est là, Dieu merci !', 'Je ne sais pas.'], 1],
      ['Tu vas faire quoi de bien cette année ?', ['Dormir.', 'Rien du tout.', 'Travailler dur et aider la famille.'], 2],
      ['Tiens, prends ça pour la route.', ['Merci papa, que l’année te garde !', 'C’est tout ?', 'Garde-le.'], 0],
    ],
  },
  'evt-nouvel-an-danser': {
    engine: 'rythme', title: 'Jusqu’au matin', how: 'La cour est en fête : danse jusqu’au lever du soleil, chaque note sur la ligne.', decor: 'terre', lanes: ['enceinte', 'djembe', 'ballon-fete'], tempo: 120, notes: 36,
  },

  // Korité
  'evt-korite-marmite': {
    engine: 'equilibre', title: 'La marmite de fête', how: 'Porte la grande marmite jusqu’à la natte des voisins, sans renverser la sauce sur ton boubou neuf.', decor: 'terre', carry: 'marmite', verb: 'Porte la marmite', distance: 110,
  },
  'evt-korite-voeux': {
    engine: 'repondre', title: 'Bonne fête !', how: 'Les voisins sortent en boubous neufs : souhaite la bonne fête comme il faut.', decor: 'terre', npc: 'imam',
    lines: [
      ['Bonne fête, mon enfant !', ['Bonne fête à vous aussi, que Dieu accepte vos prières !', 'Merci, au revoir.', 'Il y a quoi à manger ?'], 0],
      ['Tu as fait la prière du matin avec nous ?', ['Non, j’ai dormi.', 'Je suis venu·e vous saluer après, avec tout le respect.', 'Ça ne me regarde pas.'], 1],
      ['Viens, assieds-toi, on partage le repas.', ['Non merci, je n’aime pas.', 'Je mange vite et je pars.', 'Avec plaisir, merci pour votre accueil.'], 2],
      ['Que la paix soit avec toi.', ['Et avec vous aussi, bonne fête à toute la famille !', 'D’accord.', 'Bye.'], 0],
    ],
  },

  // Tabaski
  'evt-tabaski-assiettes': {
    engine: 'assembler', title: 'Les assiettes des voisins', how: 'La viande du mouton se partage : prépare chaque assiette dans l’ordre demandé.', decor: 'table', base: 'assiette',
    parts: [{ name: 'Le riz', prop: 'riz' }, { name: 'La viande grillée', prop: 'brochette' }, { name: 'Les oignons', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }, { name: 'La tomate', prop: 'tomate' }],
  },
  'evt-tabaski-visites': {
    engine: 'repondre', title: 'Les visites de Tabaski', how: 'Tu fais le tour des voisins avec ton assiette : sois poli·e à chaque porte.', decor: 'terre', npc: 'maman',
    lines: [
      ['Ah, bonne fête ! Tu nous apportes quoi ?', ['La part de viande de la famille, bonne fête tantie !', 'Rien.', 'Combien tu me donnes ?'], 0],
      ['Assieds-toi un peu, tu as mangé ?', ['Je suis pressé·e.', 'Merci tantie, juste un peu alors !', 'Ta cuisine n’est pas bonne.'], 1],
      ['Salue bien ta maman pour moi.', ['Fais-le toi-même.', 'Ok.', 'Je n’y manquerai pas, tantie, merci !'], 2],
      ['Que Dieu bénisse ta famille.', ['Amen, et la vôtre aussi !', 'Merci, bye.', 'Hum.'], 0],
    ],
  },
}
