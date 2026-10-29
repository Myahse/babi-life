import type { Jeu } from '../types'

export const JEUX_3: Record<string, Jeu> = {
  // Orphelinat: play, read, serve the little ones
  'jouer-enfants': {
    engine: 'attraper', title: 'Les petits te lancent tout', how: 'Les enfants te lancent leurs jouets : attrape-les dans le carton, laisse tomber les cailloux.', decor: 'herbe',
    from: 'ballon-fete', into: 'carton',
    good: [{ name: 'La peluche', prop: 'peluche' }, { name: 'Le jouet', prop: 'jouet' }, { name: 'Le ballon', prop: 'ballon-foot' }, { name: 'Le bonbon', prop: 'bonbon' }],
    bad: [{ name: 'Le caillou', prop: 'caillou' }, { name: 'La feuille morte', prop: 'feuille' }],
  },
  'lire-enfants': {
    engine: 'repondre', title: 'Kacou Ananzè raconte', how: 'Tu lis le conte de l’araignée : réponds aux questions des petits comme il faut.', decor: 'parquet',
    npc: 'enfant',
    lines: [
      ['Tonton, tata, c’est qui Kacou Ananzè ?', ['L’araignée maligne des contes !', 'Un footballeur', 'Ton voisin'], 0],
      ['Pourquoi il a voulu garder toute la sagesse pour lui ?', ['Pour la vendre au marché', 'Je sais pas, dors', 'Il était gourmand de savoir, et il a appris à partager'], 2],
      ['Encore une histoire, s’il te plaît !', ['Non, laisse-moi', 'Une dernière, et après on va manger', 'Demande à la télé'], 1],
      ['Moi aussi je peux lire ?', ['Bien sûr ! Viens, on lit la page ensemble', 'Tu es trop petit', 'Plus tard, peut-être jamais'], 0],
    ],
  },
  'repas-enfants': {
    engine: 'choisir', title: 'À table, les enfants !', how: 'Chaque petit demande ce qu’il veut : sers-le avant que son voisin ne s’impatiente.', decor: 'table',
    caller: 'Le petit Koffi',
    items: [{ name: 'Le riz', prop: 'riz' }, { name: 'Le poulet', prop: 'poulet' }, { name: 'La banane', prop: 'banane' }, { name: 'Le jus', prop: 'jus' }, { name: 'Le pain', prop: 'pain' }, { name: 'L’attiéké', prop: 'attieke' }],
  },

  // Pharmacie: the ordonnance, from both sides of the counter
  medicaments: {
    engine: 'choisir', title: 'Ce que dit l’ordonnance', how: 'La pharmacienne lit l’ordonnance : touche le bon produit avant le client d’à côté.', decor: 'comptoir',
    caller: 'La pharmacienne',
    items: [{ name: 'Les comprimés', prop: 'medicament' }, { name: 'Le pansement', prop: 'pansement' }, { name: 'Le thermomètre', prop: 'thermometre' }, { name: 'La pommade', prop: 'creme' }, { name: 'Le savon', prop: 'savon' }],
  },
  'work:pharmacie': {
    engine: 'assembler', title: 'Servir l’ordonnance', how: 'Mets dans le sachet ce que l’ordonnance demande, dans l’ordre où c’est écrit.', decor: 'comptoir',
    base: 'sac', orders: 4,
    parts: [{ name: 'Les comprimés', prop: 'medicament' }, { name: 'Le pansement', prop: 'pansement' }, { name: 'Le thermomètre', prop: 'thermometre' }, { name: 'La pommade', prop: 'creme' }, { name: 'La seringue', prop: 'seringue' }],
  },

  // Police: papers, complaints, the front desk, the shift
  'declaration-perte': {
    engine: 'repondre', title: 'Déclarer une perte', how: 'L’agent prend ta déclaration : réponds-lui calmement et clairement.', decor: 'bureau',
    npc: 'policier',
    lines: [
      ['Bonjour, c’est pour quoi ?', ['Rien, je passais', 'C’est vous qui l’avez prise ?', 'Bonjour chef, je viens déclarer la perte de ma pièce'], 2],
      ['Vous l’avez perdue où, et quand ?', ['Je sais pas, quelque part', 'Hier soir, dans un gbaka entre Adjamé et Yopougon', 'Ça vous regarde ?'], 1],
      ['Vous avez une copie ou un autre papier ?', ['Oui, voici une photocopie et mon extrait de naissance', 'Non, rien du tout, débrouillez-vous', 'Je reviens dans un an'], 0],
      ['Voilà votre attestation de perte, gardez-la bien.', ['C’est tout ?', 'Pas besoin', 'Merci beaucoup, bonne journée chef !'], 2],
    ],
  },
  'porter-plainte': {
    engine: 'choisir', title: 'Les preuves de la plainte', how: 'L’agent demande une pièce du dossier : montre-lui la bonne, vite et sans te tromper.', decor: 'bureau',
    caller: 'L’agent',
    items: [{ name: 'La pièce d’identité', prop: 'passeport' }, { name: 'Le téléphone (les photos)', prop: 'telephone' }, { name: 'Le reçu', prop: 'ticket' }, { name: 'La facture', prop: 'dossier' }, { name: 'La clé', prop: 'cle' }],
  },
  renseignement: {
    engine: 'quiz', title: 'À l’accueil du commissariat', how: 'L’agent de l’accueil te teste sur les bons numéros : trouve la bonne réponse.', decor: 'comptoir',
    host: 'agent',
    questions: [
      ['Pour les sapeurs-pompiers, on compose ?', ['Le 007', 'Le 180', 'Le 225'], 1],
      ['Et pour le SAMU ?', ['Le 185', 'Le 100', 'Le 999'], 0],
      ['La police secours, c’est par exemple ?', ['Le 5050', 'Le 123456', 'Le 110 ou le 111'], 2],
      ['Pour une déclaration de perte, on apporte ?', ['Un poulet', 'Une copie ou un autre papier d’identité', 'Rien, c’est magique'], 1],
    ],
  },
  'work:police': {
    engine: 'repondre', title: 'Le contrôle routier', how: 'Les chauffeurs s’arrêtent au barrage : réponds poliment, dans les règles.', decor: 'bitume',
    npc: 'papa',
    lines: [
      ['Bonsoir chef, c’est comment ?', ['Bonsoir papa, ça va. Les papiers du véhicule, s’il vous plaît', 'Descends vite !', 'Va-t’en'], 0],
      ['Voilà la carte grise et l’assurance.', ['C’est faux ça', 'Donne-moi plutôt l’argent', 'Merci, tout est en règle. Et le permis ?'], 2],
      ['Chef, on peut pas s’arranger un peu ?', ['Combien tu as ?', 'Non papa, ici on fait les choses dans les règles', 'D’accord, cache ça'], 1],
      ['J’ai oublié de mettre la ceinture…', ['Attachez-la, c’est pour votre sécurité. Bonne route !', 'Tu vas dormir en cellule', 'Pas grave, roule sans'], 0],
    ],
  },

  // Présidence: the palace, from the gates
  'conseil-ministres': {
    engine: 'quiz', title: 'Depuis la tribune', how: 'Le guide t’explique comment ça marche : choisis la bonne réponse.', decor: 'parquet',
    host: 'guide',
    questions: [
      ['Qui préside le conseil des ministres ?', ['Le maire d’Abidjan', 'Le capitaine des Éléphants', 'Le président de la République'], 2],
      ['Le Palais présidentiel se trouve dans quelle commune ?', ['Abobo', 'Le Plateau', 'Bingerville'], 1],
      ['La capitale politique de la Côte d’Ivoire, c’est ?', ['Yamoussoukro', 'Bouaké', 'San-Pédro'], 0],
      ['À la fin du conseil, on publie ?', ['Une chanson', 'Un menu', 'Un communiqué'], 2],
    ],
  },
  'manif-palais': {
    engine: 'rythme', title: 'La marche pacifique', how: 'Scande les slogans en rythme avec la foule, dans le calme : tape sur la ligne.', decor: 'bitume',
    lanes: ['megaphone', 'drapeau', 'sifflet'],
  },
  'selfie-palais': {
    engine: 'photo', title: 'Selfie aux grilles', how: 'Tiens le téléphone : déclenche quand le drapeau ou le décor passe dans le cadre.', decor: 'bitume',
    subjects: [{ name: 'Le drapeau', prop: 'drapeau' }, { name: 'Le palmier', prop: 'palmier' }, { name: 'L’oiseau', prop: 'oiseau' }, { name: 'Le soleil', prop: 'soleil' }],
  },
  'visite-palais': {
    engine: 'quiz', title: 'La visite du Palais', how: 'Le guide pose ses questions sur l’histoire du pays : trouve la bonne réponse.', decor: 'parquet',
    host: 'guide',
    questions: [
      ['La Côte d’Ivoire est indépendante depuis le…', ['1er janvier 1900', '7 août 1960', '14 juillet 1789'], 1],
      ['Le premier président du pays était…', ['Félix Houphouët-Boigny', 'Didier Drogba', 'Kacou Ananzè'], 0],
      ['Les couleurs du drapeau sont…', ['Bleu, blanc, rouge', 'Noir, jaune, vert', 'Orange, blanc, vert'], 2],
      ['L’hymne national s’appelle…', ['La Marseillaise', 'L’Abidjanaise', 'Premier Gaou'], 1],
    ],
  },

  // Restaurant: the birthday, the burger, the milkshake
  'anniversaire-resto': {
    engine: 'assembler', title: 'Le gâteau d’anniversaire', how: 'Décore le gâteau dans l’ordre demandé avant que les amis ne chantent.', decor: 'table',
    base: 'gateau',
    parts: [{ name: 'Les bonbons', prop: 'bonbon' }, { name: 'La mangue', prop: 'mangue' }, { name: 'L’étoile', prop: 'etoile' }, { name: 'Le cœur', prop: 'coeur' }, { name: 'Les bougies', prop: 'bougie' }],
  },
  burger: {
    engine: 'assembler', title: 'Le burger maison', how: 'Monte le burger comme le serveur l’annonce : chaque étage dans le bon ordre.', decor: 'comptoir',
    base: 'pain',
    parts: [{ name: 'Le steak', prop: 'burger' }, { name: 'La tomate', prop: 'tomate' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }, { name: 'Le pain du dessus', prop: 'pain' }],
  },
  milkshake: {
    engine: 'tenir', title: 'Le milkshake bien plein', how: 'Verse le milkshake : lâche quand il arrive en haut du verre, sans déborder.', decor: 'comptoir',
    object: 'verre', verb: 'Verse', fill: 'liquide',
  },

  // Rue: street food, street dance, a stroll, a drink
  'brochettes-rue': {
    engine: 'choisir', title: 'Chez le braiseur', how: 'Le braiseur crie ce qui est prêt : prends-le avant les autres clients.', decor: 'etal',
    caller: 'Le braiseur',
    items: [{ name: 'La brochette', prop: 'brochette' }, { name: 'L’alloco', prop: 'alloco' }, { name: 'Le poulet', prop: 'poulet' }, { name: 'Le piment', prop: 'piment' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'Le poisson', prop: 'poisson' }],
  },
  'danser-rue': {
    engine: 'rythme', title: 'Ça danse dans la rue', how: 'Le djembé et la baffle lancent le son : tape chaque note sur la ligne.', decor: 'bitume',
    lanes: ['djembe', 'enceinte', 'tam-tam'],
  },
  'flaner-rue': {
    engine: 'photo', title: 'Flâner en ville', how: 'Tout défile dans la rue : déclenche quand le plus beau passe dans le cadre.', decor: 'bitume',
    subjects: [{ name: 'Les mangues de la tantie', prop: 'mangue' }, { name: 'Le perroquet', prop: 'perroquet' }, { name: 'L’affiche', prop: 'affiche' }, { name: 'Le pagne en vitrine', prop: 'pagne' }, { name: 'Le cocotier', prop: 'cocotier' }],
  },
  'pot-terrasse': {
    engine: 'tenir', title: 'Le pot en terrasse', how: 'Verse ta boisson doucement : lâche quand le verre est plein, avant que la mousse déborde.', decor: 'table',
    object: 'verre', verb: 'Verse', fill: 'liquide',
  },

  // Salon: every hairstyle its own game
  carre: {
    engine: 'nettoyer', title: 'Le carré net', how: 'Coupe chaque mèche qui dépasse pour un carré bien droit.', decor: 'carrelage',
    object: 'meche', bit: 'cheveu', verb: 'Coupe',
  },
  chignon: {
    engine: 'assembler', title: 'Le chignon', how: 'La coiffeuse annonce les étapes : peigne, crème, mèche… dans le bon ordre.', decor: 'carrelage',
    base: 'meche',
    parts: [{ name: 'Le peigne', prop: 'peigne' }, { name: 'La crème', prop: 'creme' }, { name: 'La mèche', prop: 'meche' }, { name: 'Le bigoudi', prop: 'bigoudi' }, { name: 'La fleur', prop: 'fleur' }],
  },
  macarons: {
    engine: 'tenir', title: 'Les macarons sous le casque', how: 'Sèche les macarons : lâche quand c’est chaud juste comme il faut, pas brûlé.', decor: 'carrelage',
    object: 'seche-cheveux', verb: 'Sèche', fill: 'chaleur',
  },
  manucure: {
    engine: 'choisir', title: 'Les ongles de star', how: 'La manucure demande ses outils : passe-lui le bon avant qu’elle ne s’impatiente.', decor: 'table',
    caller: 'La manucure',
    items: [{ name: 'Le vernis', prop: 'vernis' }, { name: 'La crème', prop: 'creme' }, { name: 'Les ciseaux', prop: 'ciseaux' }, { name: 'La serviette', prop: 'serviette' }, { name: 'L’éponge', prop: 'eponge' }],
  },
  nattes: {
    engine: 'rythme', title: 'Les nattes collées', how: 'La tresseuse croise les mèches en cadence : suis son rythme sur la ligne.', decor: 'carrelage',
    lanes: ['peigne', 'meche', 'bigoudi'], tempo: 90,
  },
  tissage: {
    engine: 'assembler', title: 'Poser le tissage', how: 'Peigne, fil, mèches, ciseaux : passe chaque chose dans l’ordre pour le tissage.', decor: 'carrelage',
    base: 'meche',
    parts: [{ name: 'Le peigne', prop: 'peigne' }, { name: 'Le fil', prop: 'bobine' }, { name: 'Les mèches', prop: 'meche' }, { name: 'Les ciseaux', prop: 'ciseaux' }, { name: 'Le sèche-cheveux', prop: 'seche-cheveux' }],
  },
  tresses: {
    engine: 'equilibre', title: 'Tiens la tête droite', how: 'Trois heures de tresses : garde la tête bien droite, la tresseuse compte sur toi.', decor: 'carrelage',
    carry: 'meche', verb: 'Tiens bon', distance: 90,
  },
  vanilles: {
    engine: 'repondre', title: 'Causer au salon', how: 'Pendant les vanilles, la coiffeuse cause : réponds-lui bien.', decor: 'carrelage',
    npc: 'vendeuse',
    lines: [
      ['Tu veux tes vanilles longues ou courtes, ma chérie ?', ['Longues, jusqu’aux épaules !', 'Fais n’importe quoi', 'Rase tout'], 0],
      ['Ça tire un peu, ça va ?', ['Aïe, arrête tout !', 'Je vais partir sans payer', 'Ça va, tu as la main douce'], 2],
      ['Tu as vu la nouvelle série d’hier soir ?', ['La télé c’est nul', 'Oui ! Le final m’a eue, on en parle ?', 'Concentre-toi sur mes cheveux'], 1],
      ['Et voilà, regarde-toi dans le miroir !', ['Waouh, c’est trop joli, merci !', 'Bof', 'Je préférais avant'], 0],
    ],
  },
  'work:coiffure': {
    engine: 'nettoyer', title: 'Le dégradé du client', how: 'Le client veut un dégradé net : passe sur chaque cheveu qui dépasse.', decor: 'carrelage',
    object: 'miroir', bit: 'cheveu', verb: 'Coupe', count: 14,
  },

  // School: library, conference, evening class, the teacher's shift
  bibliotheque: {
    engine: 'choisir', title: 'Le bon livre', how: 'La bibliothécaire te dit ce qu’il te faut : trouve-le avant les autres élèves.', decor: 'etagere',
    caller: 'La bibliothécaire',
    items: [{ name: 'Le livre d’histoire', prop: 'livre' }, { name: 'Le cahier', prop: 'cahier' }, { name: 'Le journal', prop: 'journal' }, { name: 'Le dossier', prop: 'dossier' }, { name: 'La calculatrice', prop: 'calculatrice' }],
  },
  conference: {
    engine: 'quiz', title: 'La conférence du cacao', how: 'Le conférencier pose ses questions sur le cacao : lève la main pour la bonne.', decor: 'scene',
    host: 'prof',
    questions: [
      ['Quel pays est le premier producteur de cacao au monde ?', ['La Suisse', 'Le Canada', 'La Côte d’Ivoire'], 2],
      ['Le cacao, ça pousse où ?', ['Sous la terre', 'Dans des cabosses sur l’arbre', 'Dans la mer'], 1],
      ['Avec les fèves de cacao, on fabrique…', ['Du chocolat', 'Du ciment', 'Du pagne'], 0],
    ],
  },
  'cours-du-soir': {
    engine: 'quiz', title: 'Le cours du soir', how: 'Le prof interroge la classe : trouve la bonne réponse avant la fin de l’heure.', decor: 'bureau',
    host: 'prof',
    questions: [
      ['7 fois 8, ça fait combien ?', ['54', '64', '56'], 2],
      ['« Nous ___ au marché. » (aller, présent)', ['allez', 'allons', 'vont'], 1],
      ['Combien y a-t-il de minutes dans une heure ?', ['60', '100', '24'], 0],
      ['La monnaie de la Côte d’Ivoire, c’est…', ['Le dollar', 'Le naira', 'Le franc CFA'], 2],
    ],
  },
  'work:enseignement': {
    engine: 'repondre', title: 'Faire cours', how: 'Les élèves lèvent le doigt : réponds-leur juste et avec patience.', decor: 'bureau',
    npc: 'enfant',
    lines: [
      ['Maître, 3 fois 4, ça fait combien ?', ['7', '12, bravo d’avoir demandé !', 'Cherche toi-même'], 1],
      ['Madame, la capitale économique, c’est quoi ?', ['Abidjan, au bord de la lagune Ébrié', 'Paris', 'Le marché d’Adjamé'], 0],
      ['J’ai pas compris l’exercice…', ['Tant pis pour toi', 'Sors de la classe', 'Pas de souci, on le refait ensemble au tableau'], 2],
      ['Il a pris mon stylo !', ['Reprends-le de force', 'On se calme, on partage, et chacun retrouve sa place', 'Débrouillez-vous'], 1],
    ],
  },

  // Social: a call, hanging out
  appeler: {
    engine: 'repondre', title: 'Allô, mon gars ?', how: 'Ton ami décroche : garde la conversation au top, réponds comme il faut.', decor: 'parquet',
    npc: 'ami',
    lines: [
      ['Allô ? C’est qui ça ?', ['C’est moi ! Je t’appelle pour prendre de tes nouvelles', 'Devine', '…'], 0],
      ['Ah c’est toi ! On dit quoi ?', ['Rien', 'Je raccroche', 'On est là, Dieu merci. Et toi, la famille va bien ?'], 2],
      ['Je suis un peu fatigué avec le boulot…', ['C’est ton problème', 'Courage mon frère, on se voit ce week-end pour souffler ?', 'Moi aussi, bye'], 1],
      ['Bon, mon crédit va finir hein !', ['Ok, on se rappelle. Prends soin de toi !', 'Rappelle-moi tout de suite', 'Pas mon souci'], 0],
    ],
  },
  trainer: {
    engine: 'choisir', title: 'On prend quoi ?', how: 'Ton pote dit ce qui lui fait envie : prends-le avant que la file n’avance.', decor: 'etal',
    caller: 'Ton pote',
    items: [{ name: 'L’alloco', prop: 'alloco' }, { name: 'Le soda', prop: 'soda' }, { name: 'La glace', prop: 'glace' }, { name: 'Le garba', prop: 'garba' }, { name: 'Le jus', prop: 'jus' }, { name: 'Le pop-corn', prop: 'popcorn' }],
  },

  // Soirée: the maquis-nightclub, every move its own game
  'atalaku-soiree': {
    engine: 'repondre', title: 'L’atalaku crie ton nom', how: 'L’atalaku te chauffe au micro : réponds-lui avec style pour qu’il crie plus fort.', decor: 'scene',
    npc: 'ami',
    lines: [
      ['Eh, c’est qui le môgô de ce soir ?', ['Personne', 'Laisse-moi tranquille', 'C’est moi, crie mon nom fort !'], 2],
      ['On t’appelle comment au quartier ?', ['Je sais pas', 'Le Boss de la lagune !', 'Pourquoi tu demandes ?'], 1],
      ['Tu veux une dédicace pour qui ?', ['Pour toute ma famille et mes amis de Yop !', 'Pour personne', 'Pour moi seul, les autres non'], 0],
      ['Le boss est dans la place ou bien ?', ['Non, je dors', 'Baisse le son', 'Le boss est là, mets l’ambiance !'], 2],
    ],
  },
  'boire-soiree': {
    engine: 'choisir', title: 'Au comptoir du bar', how: 'Le barman annonce les verres : prends le tien avant les autres mains.', decor: 'comptoir',
    caller: 'Le barman',
    items: [{ name: 'Le cocktail', prop: 'cocktail' }, { name: 'La bière', prop: 'biere' }, { name: 'Le soda', prop: 'soda' }, { name: 'Le jus', prop: 'jus' }, { name: 'L’eau', prop: 'sachet-eau' }],
  },
  'bouteille-soiree': {
    engine: 'equilibre', title: 'La bouteille du carré VIP', how: 'Porte la bouteille et ses cierges magiques jusqu’au carré VIP sans la pencher.', decor: 'parquet',
    carry: 'bouteille', verb: 'Porte',
  },
  'danser-soiree': {
    engine: 'rythme', title: 'Le coupé-décalé', how: 'Le DJ lance le coupé-décalé : tape chaque pas sur la ligne, comme un vrai champion.', decor: 'parquet',
    lanes: ['enceinte', 'platine', 'micro'], tempo: 120,
  },
  'mixer-soiree': {
    engine: 'rythme', title: 'Aux platines', how: 'Enchaîne les sons : tape la platine, les notes et la baffle juste sur le temps.', decor: 'scene',
    lanes: ['platine', 'note-musique', 'enceinte'], tempo: 110,
  },
  'podium-soiree': {
    engine: 'equilibre', title: 'Sur le podium', how: 'Le podium est petit et ça bouge : garde l’équilibre jusqu’à la fin du son.', decor: 'scene',
    carry: 'chaussure', verb: 'Danse',
  },
  'recevoir-soiree': {
    engine: 'repondre', title: 'Bienvenue chez toi', how: 'Tes invités arrivent : accueille chacun comme il faut.', decor: 'parquet',
    npc: 'amie',
    lines: [
      ['Bonsoir ! Je suis pas trop en retard ?', ['Si, rentre chez toi', 'Pas du tout, entre, tu es la bienvenue !', 'Tu as apporté quoi ?'], 1],
      ['J’ai apporté un petit gâteau.', ['Oh merci, fallait pas ! On le mange ensemble', 'Il est petit hein', 'Pose ça là-bas'], 0],
      ['Je connais personne ici…', ['Débrouille-toi', 'Reste dans un coin', 'Viens, je te présente à tout le monde'], 2],
      ['C’était top, merci pour la soirée !', ['Enfin tu pars', 'Merci d’être venue, rentre bien !', 'Tu ranges avant ?'], 1],
    ],
  },
  'slow-soiree': {
    engine: 'rythme', title: 'Le slow', how: 'Le son ralentit : suis doucement le tempo, sans marcher sur les pieds de l’autre.', decor: 'parquet',
    lanes: ['note-musique', 'coeur', 'etoile'], tempo: 70, notes: 20,
  },
  'travaillement-soiree': {
    engine: 'viser', title: 'Travailler le DJ', how: 'Le DJ cite ton nom : lance tes billets pile sur lui, la foule crie.', decor: 'scene',
    projectile: 'billet', target: 'platine', shots: 6,
  },

  // Sport: basket, foot, the match
  'play-basket': {
    engine: 'viser', title: 'Le tir à trois points', how: 'Vise le panier, dose ta force : marque un maximum de paniers.', decor: 'piste',
    projectile: 'ballon-basket', target: 'panier-basket',
  },
  'play-football': {
    engine: 'course', title: 'Le dribble du quartier', how: 'Dribble entre les plots : récupère les ballons, évite les quilles.', decor: 'terre',
    mode: 'pied', good: 'ballon-foot', bad: 'quille',
  },
  'watch-match': {
    engine: 'rythme', title: 'Supporter les Éléphants', how: 'Tam-tam, sifflet, drapeau : encourage l’équipe en rythme avec les supporters.', decor: 'herbe',
    lanes: ['tam-tam', 'sifflet', 'drapeau'],
  },

  // Stade: the big pitch, concerts, the national day, the meeting
  'play-foot11': {
    engine: 'viser', title: 'Le penalty', how: 'Le gardien bouge : vise le coin et dose ta frappe pour marquer.', decor: 'herbe',
    projectile: 'ballon-foot', target: 'but', shots: 5,
  },
  'stade-concert': {
    engine: 'rythme', title: 'Le concert géant', how: 'Le stade chante avec la star : suis la guitare et le micro sur la ligne.', decor: 'scene',
    lanes: ['micro', 'guitare', 'enceinte'], tempo: 115,
  },
  'stade-fete': {
    engine: 'equilibre', title: 'Le défilé du 7 août', how: 'Tu portes le drapeau au défilé de la Fête de la Nation : garde-le bien droit.', decor: 'piste',
    carry: 'drapeau', verb: 'Défile',
  },
  'stade-footing': {
    engine: 'course', title: 'Les tours de piste', how: 'Cours sur la piste : prends les sachets d’eau, évite les cailloux.', decor: 'piste',
    mode: 'pied', good: 'sachet-eau', bad: 'caillou',
  },
  'stade-match': {
    engine: 'photo', title: 'Les moments du match', how: 'Ne rate rien : déclenche quand le ballon ou le trophée passe dans le cadre.', decor: 'herbe',
    subjects: [{ name: 'Le ballon', prop: 'ballon-foot' }, { name: 'Le trophée', prop: 'trophee' }, { name: 'Le drapeau', prop: 'drapeau' }, { name: 'La médaille', prop: 'medaille' }],
  },
  'stade-meeting': {
    engine: 'quiz', title: 'Bien voter, ça s’apprend', how: 'Au meeting, on parle du vote : trouve la bonne réponse sur la façon de voter.', decor: 'herbe',
    host: 'guide',
    questions: [
      ['On peut voter en Côte d’Ivoire à partir de…', ['18 ans', '12 ans', '40 ans'], 0],
      ['Dans l’urne, on met…', ['Son téléphone', 'Sa carte bancaire', 'Son bulletin'], 2],
      ['Pour voter, il faut être…', ['Champion de foot', 'Inscrit sur la liste électorale', 'Né à Abidjan seulement'], 1],
    ],
  },

  // Station: breakfast, phone credit, gas, tyres
  'boutique-station': {
    engine: 'choisir', title: 'Le petit-déj de la station', how: 'La caissière appelle ta commande : prends-la avant les clients pressés.', decor: 'comptoir',
    caller: 'La caissière',
    items: [{ name: 'Le café', prop: 'cafe' }, { name: 'Le croissant', prop: 'croissant' }, { name: 'Le pain', prop: 'pain' }, { name: 'Le jus', prop: 'jus' }, { name: 'Le thé', prop: 'the' }, { name: 'L’eau', prop: 'sachet-eau' }],
  },
  'credit-station': {
    engine: 'repondre', title: 'Recharger son crédit', how: 'La vendeuse de crédit te sert : réponds juste pour que tout passe.', decor: 'comptoir',
    npc: 'vendeuse',
    lines: [
      ['Bonjour, c’est combien de crédit ?', ['1 000 francs, s’il te plaît', 'Tout ton stock', 'Je sais pas'], 0],
      ['Donne-moi ton numéro.', ['Devine-le', 'C’est secret', 'Je te l’écris lentement, chiffre par chiffre'], 2],
      ['Tu as reçu le message ?', ['Non, rembourse-moi deux fois', 'Oui, c’est arrivé, merci beaucoup !', 'Quel message ?'], 1],
    ],
  },
  'gaz-bouteille': {
    engine: 'tenir', title: 'La bouteille de gaz', how: 'Remplis la bouteille de gaz : lâche quand la jauge est dans le vert.', decor: 'bitume',
    object: 'bouteille', verb: 'Remplis', fill: 'liquide',
  },
  'gonfler-pneus': {
    engine: 'tenir', title: 'Gonfler les pneus', how: 'Pompe sur le pneu du vélo : lâche quand il est bien dur, avant qu’il éclate.', decor: 'bitume',
    object: 'velo', verb: 'Gonfle', fill: 'force',
  },

  // Gare routière: snacks, waiting, coxers, the apprenti's shift
  'arachides-route': {
    engine: 'choisir', title: 'Pour la route', how: 'La vendeuse passe à la fenêtre du car : prends ce qu’elle annonce, vite !', decor: 'bitume',
    caller: 'La vendeuse ambulante',
    items: [{ name: 'Les arachides', prop: 'sac' }, { name: 'La banane', prop: 'banane' }, { name: 'La mangue', prop: 'mangue' }, { name: 'L’eau glacée', prop: 'sachet-eau' }, { name: 'Le pain', prop: 'pain' }, { name: 'La noix de coco', prop: 'noix-coco' }],
  },
  'attendre-car': {
    engine: 'photo', title: 'La vie de la gare', how: 'En attendant le car, regarde la gare : déclenche quand une belle scène passe.', decor: 'bitume',
    subjects: [{ name: 'La tantie aux mangues', prop: 'mangue' }, { name: 'Le voyageur et sa valise', prop: 'valise' }, { name: 'Le colis sur le toit', prop: 'colis' }, { name: 'Le perroquet', prop: 'perroquet' }, { name: 'L’affiche du car', prop: 'affiche' }],
  },
  coxers: {
    engine: 'repondre', title: 'Les coxers', how: 'Les coxers veulent te mettre dans leur car : discute sans te faire gâter.', decor: 'bitume',
    npc: 'ami',
    lines: [
      ['Mon frère, tu vas où ? Bouaké, Yakro ?', ['Yamoussoukro. C’est quelle compagnie ?', 'Je vais nulle part', 'Lâche-moi le bras'], 0],
      ['Notre car part tout de suite, on attend que toi !', ['Je monte sans regarder', 'Tu mens toujours', 'Ah bon ? Montre-moi d’abord combien il reste de places'], 2],
      ['Pour toi, c’est prix d’ami !', ['Je te donne tout mon argent', 'Merci, mais je paie au guichet avec mon ticket', 'C’est trop cher, je vais à pied'], 1],
      ['Bon voyage, hein !', ['Merci, bonne journée à vous !', 'Pas besoin', 'Hum'], 0],
    ],
  },
  'eat-brochette': {
    engine: 'tenir', title: 'La brochette dorée', how: 'Grille ta brochette : lâche quand elle est bien dorée, pas brûlée.', decor: 'etal',
    object: 'brochette', verb: 'Grille', fill: 'chaleur',
  },
  'eau-glacee-gare': {
    engine: 'attraper', title: 'Eau glacée, eau glacée !', how: 'La vendeuse lance les sachets : attrape les bien glacés, laisse tomber les gouttes.', decor: 'bitume',
    from: 'seau', into: 'sac', count: 10,
    good: [{ name: 'Le sachet d’eau glacée', prop: 'sachet-eau' }],
    bad: [{ name: 'La goutte', prop: 'goutte' }, { name: 'Le caillou', prop: 'caillou' }],
  },
  'wait-gbaka': {
    engine: 'repondre', title: 'À l’arrêt du gbaka', how: 'Un vieux attend avec toi : cause avec lui en attendant le gbaka.', decor: 'bitume',
    npc: 'vieux',
    lines: [
      ['Mon fils, le gbaka de Yopougon est déjà passé ?', ['Je sais pas, cherche', 'C’est pas mon problème', 'Pas encore, papa, on l’attend ensemble'], 2],
      ['De mon temps, le transport coûtait 25 francs !', ['C’est faux', 'Eh, ça a bien changé ! Raconte-moi un peu', 'Tu radotes'], 1],
      ['Voilà le gbaka, il est plein…', ['Montez en premier, papa, je prendrai le prochain', 'Pousse-toi, je passe', 'Tant pis pour vous'], 0],
    ],
  },
  'work:transport': {
    engine: 'attraper', title: 'Encaisser les passagers', how: 'Chaque passager paie sa place : attrape pièces et billets, laisse tomber le reste.', decor: 'bitume',
    from: 'casquette', into: 'sac', count: 14,
    good: [{ name: 'La pièce', prop: 'piece' }, { name: 'Le billet', prop: 'billet' }, { name: 'Le ticket', prop: 'ticket' }],
    bad: [{ name: 'Le caillou', prop: 'caillou' }, { name: 'La feuille', prop: 'feuille' }, { name: 'Le bonbon', prop: 'bonbon' }],
  },

  // Tribunal: the lawyer, the record, the complaint, a hearing
  avocat: {
    engine: 'repondre', title: 'Chez l’avocat', how: 'Maître t’écoute pour préparer ton dossier : réponds-lui bien.', decor: 'bureau',
    npc: 'chef',
    lines: [
      ['Racontez-moi tout depuis le début.', ['Devinez', 'C’est long, je résume en un mot', 'Je vous dis tout, avec les dates et les papiers'], 2],
      ['Vous avez des preuves ?', ['Non, mais croyez-moi', 'Oui, voici les reçus et les messages', 'Je vais en inventer'], 1],
      ['On va essayer d’abord un arrangement à l’amiable.', ['D’accord, si c’est plus simple pour tout le monde', 'Non, jamais', 'Faites ce que vous voulez'], 0],
    ],
  },
  casier: {
    engine: 'choisir', title: 'Le casier judiciaire', how: 'Le greffier demande une pièce : donne-lui la bonne pour avoir ton extrait.', decor: 'comptoir',
    caller: 'Le greffier',
    items: [{ name: 'La pièce d’identité', prop: 'passeport' }, { name: 'Le timbre', prop: 'ticket' }, { name: 'L’extrait de naissance', prop: 'dossier' }, { name: 'Le stylo', prop: 'stylo' }, { name: 'L’argent', prop: 'billet' }],
  },
  plainte: {
    engine: 'assembler', title: 'Le dossier de plainte', how: 'Monte ton dossier dans l’ordre : identité, preuves, lettre, signature, tampon.', decor: 'bureau',
    base: 'dossier',
    parts: [{ name: 'La pièce d’identité', prop: 'passeport' }, { name: 'Les preuves', prop: 'ticket' }, { name: 'La lettre', prop: 'cahier' }, { name: 'La signature', prop: 'stylo' }, { name: 'Le tampon', prop: 'tampon' }],
  },
  proces: {
    engine: 'quiz', title: 'Dans la salle d’audience', how: 'Tu assistes au procès : l’huissier te teste, trouve la bonne réponse.', decor: 'parquet',
    host: 'juge',
    questions: [
      ['Quand les juges entrent dans la salle, on fait quoi ?', ['On applaudit', 'On sort', 'On se lève'], 2],
      ['Qui défend l’accusé ?', ['Le greffier', 'L’avocat', 'Le public'], 1],
      ['Le greffier, il sert à quoi ?', ['Il note tout ce qui se dit', 'Il vend les tickets', 'Il juge l’affaire'], 0],
      ['Dans la salle, le téléphone doit être…', ['En haut-parleur', 'En pleine vidéo', 'Éteint ou en silencieux'], 2],
    ],
  },

  // Université: lectures, the BU, a conference, the exam, the canteen
  amphi: {
    engine: 'quiz', title: 'Cours de géographie', how: 'Le prof de l’amphi interroge : trouve la bonne réponse parmi 500 étudiants.', decor: 'scene',
    host: 'prof',
    questions: [
      ['La lagune d’Abidjan s’appelle…', ['La lagune Bleue', 'La lagune Ébrié', 'Le lac Kossou'], 1],
      ['Le point le plus haut du pays, c’est…', ['Le mont Nimba', 'Le Kilimandjaro', 'La tour F'], 0],
      ['Un grand fleuve ivoirien, c’est…', ['Le Nil', 'L’Amazone', 'Le Bandama'], 2],
      ['Abidjan est au bord de…', ['L’océan Indien', 'L’océan Atlantique', 'La mer Rouge'], 1],
    ],
  },
  bu: {
    engine: 'tenir', title: 'Concentré à la BU', how: 'Garde ta concentration sur le livre : relâche quand c’est rentré, pas avant.', decor: 'bureau',
    object: 'livre', verb: 'Concentre-toi', fill: 'force', times: 4,
  },
  'conference-u': {
    engine: 'quiz', title: 'Conférence patrimoine', how: 'La conférencière parle du patrimoine ivoirien : trouve la bonne réponse.', decor: 'scene',
    host: 'prof',
    questions: [
      ['Quelle ville historique est au patrimoine mondial de l’UNESCO ?', ['Grand-Bassam', 'Daloa', 'Divo'], 0],
      ['Le parc national de Taï est connu pour…', ['Ses pingouins', 'Son désert', 'Sa forêt et ses chimpanzés'], 2],
      ['Le parc de la Comoé est…', ['Un centre commercial', 'Un des plus grands parcs d’Afrique de l’Ouest', 'Un stade'], 1],
    ],
  },
  partiel: {
    engine: 'quiz', title: 'Le partiel', how: 'Trois heures, une copie : réponds juste à chaque question du sujet.', decor: 'bureau',
    host: 'prof',
    questions: [
      ['La racine carrée de 81, c’est…', ['9', '8', '18'], 0],
      ['Le pluriel de « cheval », c’est…', ['Chevals', 'Chevaus', 'Chevaux'], 2],
      ['En quelle année la Côte d’Ivoire devient indépendante ?', ['1980', '1960', '1945'], 1],
      ['L’attiéké est fait à partir de…', ['Manioc', 'Maïs', 'Riz'], 0],
      ['25 % de 200, c’est…', ['25', '75', '50'], 2],
    ],
  },
  'resto-u': {
    engine: 'choisir', title: 'La file du resto U', how: 'La dame de la cantine appelle les plats : prends le tien avant les autres plateaux.', decor: 'comptoir',
    caller: 'La dame de la cantine',
    items: [{ name: 'Le riz', prop: 'riz' }, { name: 'L’attiéké', prop: 'attieke' }, { name: 'Le poisson', prop: 'poisson' }, { name: 'Le poulet', prop: 'poulet' }, { name: 'Le foutou', prop: 'foutou' }, { name: 'Le pain', prop: 'pain' }],
  },

  // Village: the elders, fresh attiéké, making it
  anciens: {
    engine: 'repondre', title: 'Écouter les anciens', how: 'Sous l’arbre à palabres, le vieux raconte : réponds-lui avec respect.', decor: 'terre',
    npc: 'vieux',
    lines: [
      ['Assieds-toi, mon enfant. Tu connais l’histoire du village ?', ['Non, et ça m’est égal', 'Pas bien, papa. Raconte-moi, j’écoute', 'Fais vite'], 1],
      ['Nos grands-parents sont venus ici à pied, il y a longtemps.', ['Ils ont eu du courage ! Pourquoi ici ?', 'Ils auraient dû prendre un car', 'Bof'], 0],
      ['Le respect des aînés, c’est la base, tu sais.', ['C’est dépassé', 'Le respect se paie', 'Oui, et je reviendrai vous écouter'], 2],
      ['Tiens, prends cette noix de cola.', ['C’est tout ?', 'Merci beaucoup, papa !', 'Garde-la'], 1],
    ],
  },
  'attieke-frais': {
    engine: 'assembler', title: 'L’assiette du village', how: 'La tantie compose ton assiette : attiéké, poisson, tomate, oignon… dans l’ordre.', decor: 'table',
    base: 'assiette',
    parts: [{ name: 'L’attiéké', prop: 'attieke' }, { name: 'Le poisson', prop: 'poisson' }, { name: 'La tomate', prop: 'tomate' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }],
  },
  'preparer-attieke': {
    engine: 'tenir', title: 'L’attiéké à la vapeur', how: 'Cuis la semoule de manioc à la vapeur : lâche quand ça fume juste comme il faut.', decor: 'terre',
    object: 'marmite', verb: 'Cuis', fill: 'chaleur', times: 5,
  },

  // Worship: songs, prayers, visits — every faith alike
  culte: {
    engine: 'rythme', title: 'Les chants du culte', how: 'La chorale lance la louange : tape chaque note sur la ligne avec l’assemblée.', decor: 'parquet',
    lanes: ['tam-tam', 'micro', 'guitare'], tempo: 100,
  },
  messe: {
    engine: 'repondre', title: 'La messe du dimanche', how: 'Le prêtre parle à l’assemblée : donne la bonne réponse de la messe.', decor: 'parquet',
    npc: 'pretre',
    lines: [
      ['Le Seigneur soit avec vous.', ['Et avec votre esprit', 'Bonjour à vous', 'Merci, ça va'], 0],
      ['Donnez-vous la paix.', ['Tu regardes ton téléphone', 'Tu sors', 'Tu serres la main de ton voisin avec un sourire'], 2],
      ['Allez dans la paix du Christ.', ['À demain', 'Nous rendons grâce à Dieu', 'Déjà fini ?'], 1],
    ],
  },
  'messe-matin': {
    engine: 'tenir', title: 'Le cierge du matin', how: 'Allume ton cierge doucement : lâche quand la flamme est belle et calme.', decor: 'parquet',
    object: 'cierge', verb: 'Allume', fill: 'chaleur', times: 3,
  },
  'monter-tour': {
    engine: 'equilibre', title: 'En haut de la tour', how: 'Monte l’escalier en colimaçon sans lâcher ton appareil photo : la vue t’attend.', decor: 'carrelage',
    carry: 'appareil-photo', verb: 'Monte',
  },
  pray: {
    engine: 'tenir', title: 'Se recueillir', how: 'Respire et concentre-toi : relâche quand ton cœur est calme.', decor: 'carrelage',
    object: 'bougie', verb: 'Recueille-toi', fill: 'force', times: 3,
  },
  'priere-vendredi': {
    engine: 'repondre', title: 'La prière du vendredi', how: 'Avant la grande prière, l’imam et les fidèles te saluent : réponds bien.', decor: 'carrelage',
    npc: 'imam',
    lines: [
      ['As-salamou alaykoum.', ['Wa alaykoum as-salam', 'Salut', 'Je suis pressé'], 0],
      ['Avant la prière, on commence par…', ['Un café', 'Une photo', 'Les ablutions'], 2],
      ['Un vieux n’a pas de place dans la rangée…', ['Tant pis pour lui', 'Je me serre pour lui faire de la place', 'Je prends sa place'], 1],
      ['Que Dieu te bénisse, à vendredi prochain.', ['Amine, à toi aussi !', 'Peut-être', 'Bof'], 0],
    ],
  },
  veillee: {
    engine: 'rythme', title: 'La veillée de prière', how: 'Toute la nuit on chante : suis le djembé et le balafon à la lueur des bougies.', decor: 'parquet',
    lanes: ['djembe', 'bougie', 'balafon'], tempo: 90,
  },
  visit: {
    engine: 'photo', title: 'La visite du lieu saint', how: 'Admire le lieu en silence : déclenche quand une belle chose passe dans le cadre.', decor: 'carrelage',
    subjects: [{ name: 'Le grand tapis', prop: 'tapis' }, { name: 'La lampe', prop: 'lampe' }, { name: 'La statue', prop: 'statue' }, { name: 'Le tableau', prop: 'tableau' }, { name: 'La colombe', prop: 'oiseau' }, { name: 'Les fleurs', prop: 'fleur' }],
  },

  // Zoo: the lions, the picnic, the visit
  'zoo-photos': {
    engine: 'photo', title: 'Selfie au zoo', how: 'Les animaux bougent derrière toi : déclenche quand celui demandé est bien dans le cadre.', decor: 'herbe',
    subjects: [{ name: 'Le lion', prop: 'lion' }, { name: 'La girafe', prop: 'girafe' }, { name: 'L’éléphant', prop: 'elephant' }, { name: 'Le singe curieux', prop: 'singe' }],
  },
  'zoo-pique-nique': {
    engine: 'attraper', title: 'Pique-nique sous l’arbre', how: 'Les fruits tombent de l’arbre : attrape-les dans le sac, laisse tomber les feuilles.', decor: 'herbe',
    from: 'palmier', into: 'sac',
    good: [{ name: 'La mangue', prop: 'mangue' }, { name: 'La banane', prop: 'banane' }, { name: 'La noix de coco', prop: 'noix-coco' }],
    bad: [{ name: 'La feuille', prop: 'feuille' }, { name: 'Le caillou', prop: 'caillou' }],
  },
  'zoo-visite': {
    engine: 'quiz', title: 'La visite du zoo', how: 'Le guide du zoo pose ses colles sur les animaux : trouve la bonne réponse.', decor: 'herbe',
    host: 'guide',
    questions: [
      ['Quel animal donne son surnom à l’équipe nationale de foot ?', ['Le lion', 'La girafe', 'L’éléphant'], 2],
      ['La girafe mange surtout…', ['Du poisson', 'Des feuilles d’arbres', 'Des cailloux'], 1],
      ['Quel oiseau peut imiter la voix humaine ?', ['Le perroquet', 'Le pigeon', 'Le hibou'], 0],
      ['La tortue peut vivre…', ['Une semaine', 'Un jour', 'Très longtemps, parfois plus de 100 ans'], 2],
    ],
  },
}
