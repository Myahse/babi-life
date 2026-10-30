import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

export const JEUX_3: Record<string, Jeu> = {
  // Orphelinat: play, read, serve the little ones
  'jouer-enfants': {
    engine: 'attraper', title: t('Les petits te lancent tout'), how: t('Les enfants te lancent leurs jouets : attrape-les dans le carton, laisse tomber les cailloux.'), decor: 'herbe',
    from: 'ballon-fete', into: 'carton',
    good: [{ name: t('La peluche'), prop: 'peluche' }, { name: t('Le jouet'), prop: 'jouet' }, { name: t('Le ballon'), prop: 'ballon-foot' }, { name: t('Le bonbon'), prop: 'bonbon' }],
    bad: [{ name: t('Le caillou'), prop: 'caillou' }, { name: t('La feuille morte'), prop: 'feuille' }],
  },
  'lire-enfants': {
    engine: 'repondre', title: t('Kacou Ananzè raconte'), how: t('Tu lis le conte de l’araignée : réponds aux questions des petits comme il faut.'), decor: 'parquet',
    npc: 'enfant',
    lines: [
      [t('Tonton, tata, c’est qui Kacou Ananzè ?'), [t('L’araignée maligne des contes !'), t('Un footballeur'), t('Ton voisin')], 0],
      [t('Pourquoi il a voulu garder toute la sagesse pour lui ?'), [t('Pour la vendre au marché'), t('Je sais pas, dors'), t('Il était gourmand de savoir, et il a appris à partager')], 2],
      [t('Encore une histoire, s’il te plaît !'), [t('Non, laisse-moi'), t('Une dernière, et après on va manger'), t('Demande à la télé')], 1],
      [t('Moi aussi je peux lire ?'), [t('Bien sûr ! Viens, on lit la page ensemble'), t('Tu es trop petit'), t('Plus tard, peut-être jamais')], 0],
    ],
  },
  'repas-enfants': {
    engine: 'choisir', title: t('À table, les enfants !'), how: t('Chaque petit demande ce qu’il veut : sers-le avant que son voisin ne s’impatiente.'), decor: 'table',
    caller: t('Le petit Koffi'),
    items: [{ name: t('Le riz'), prop: 'riz' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('La banane'), prop: 'banane' }, { name: t('Le jus'), prop: 'jus' }, { name: t('Le pain'), prop: 'pain' }, { name: t('L’attiéké'), prop: 'attieke' }],
  },

  // Pharmacie: the ordonnance, from both sides of the counter
  medicaments: {
    engine: 'choisir', title: t('Ce que dit l’ordonnance'), how: t('La pharmacienne lit l’ordonnance : touche le bon produit avant le client d’à côté.'), decor: 'comptoir',
    caller: t('La pharmacienne'),
    items: [{ name: t('Les comprimés'), prop: 'medicament' }, { name: t('Le pansement'), prop: 'pansement' }, { name: t('Le thermomètre'), prop: 'thermometre' }, { name: t('La pommade'), prop: 'creme' }, { name: t('Le savon'), prop: 'savon' }],
  },
  'work:pharmacie': {
    engine: 'assembler', title: t('Servir l’ordonnance'), how: t('Mets dans le sachet ce que l’ordonnance demande, dans l’ordre où c’est écrit.'), decor: 'comptoir',
    base: 'sac', orders: 4,
    parts: [{ name: t('Les comprimés'), prop: 'medicament' }, { name: t('Le pansement'), prop: 'pansement' }, { name: t('Le thermomètre'), prop: 'thermometre' }, { name: t('La pommade'), prop: 'creme' }, { name: t('La seringue'), prop: 'seringue' }],
  },

  // Police: papers, complaints, the front desk, the shift
  'declaration-perte': {
    engine: 'repondre', title: t('Déclarer une perte'), how: t('L’agent prend ta déclaration : réponds-lui calmement et clairement.'), decor: 'bureau',
    npc: 'policier',
    lines: [
      [t('Bonjour, c’est pour quoi ?'), [t('Rien, je passais'), t('C’est vous qui l’avez prise ?'), t('Bonjour chef, je viens déclarer la perte de ma pièce')], 2],
      [t('Vous l’avez perdue où, et quand ?'), [t('Je sais pas, quelque part'), t('Hier soir, dans un gbaka entre Adjamé et Yopougon'), t('Ça vous regarde ?')], 1],
      [t('Vous avez une copie ou un autre papier ?'), [t('Oui, voici une photocopie et mon extrait de naissance'), t('Non, rien du tout, débrouillez-vous'), t('Je reviens dans un an')], 0],
      [t('Voilà votre attestation de perte, gardez-la bien.'), [t('C’est tout ?'), t('Pas besoin'), t('Merci beaucoup, bonne journée chef !')], 2],
    ],
  },
  'porter-plainte': {
    engine: 'choisir', title: t('Les preuves de la plainte'), how: t('L’agent demande une pièce du dossier : montre-lui la bonne, vite et sans te tromper.'), decor: 'bureau',
    caller: t('L’agent'),
    items: [{ name: t('La pièce d’identité'), prop: 'passeport' }, { name: t('Le téléphone (les photos)'), prop: 'telephone' }, { name: t('Le reçu'), prop: 'ticket' }, { name: t('La facture'), prop: 'dossier' }, { name: t('La clé'), prop: 'cle' }],
  },
  renseignement: {
    engine: 'quiz', title: t('À l’accueil du commissariat'), how: t('L’agent de l’accueil te teste sur les bons numéros : trouve la bonne réponse.'), decor: 'comptoir',
    host: 'agent',
    questions: [
      [t('Pour les sapeurs-pompiers, on compose ?'), [t('Le 007'), t('Le 180'), t('Le 225')], 1],
      [t('Et pour le SAMU ?'), [t('Le 185'), t('Le 100'), t('Le 999')], 0],
      [t('La police secours, c’est par exemple ?'), [t('Le 5050'), t('Le 123456'), t('Le 110 ou le 111')], 2],
      [t('Pour une déclaration de perte, on apporte ?'), [t('Un poulet'), t('Une copie ou un autre papier d’identité'), t('Rien, c’est magique')], 1],
    ],
  },
  'work:police': {
    engine: 'repondre', title: t('Le contrôle routier'), how: t('Les chauffeurs s’arrêtent au barrage : réponds poliment, dans les règles.'), decor: 'bitume',
    npc: 'papa',
    lines: [
      [t('Bonsoir chef, c’est comment ?'), [t('Bonsoir papa, ça va. Les papiers du véhicule, s’il vous plaît'), t('Descends vite !'), t('Va-t’en')], 0],
      [t('Voilà la carte grise et l’assurance.'), [t('C’est faux ça'), t('Donne-moi plutôt l’argent'), t('Merci, tout est en règle. Et le permis ?')], 2],
      [t('Chef, on peut pas s’arranger un peu ?'), [t('Combien tu as ?'), t('Non papa, ici on fait les choses dans les règles'), t('D’accord, cache ça')], 1],
      [t('J’ai oublié de mettre la ceinture…'), [t('Attachez-la, c’est pour votre sécurité. Bonne route !'), t('Tu vas dormir en cellule'), t('Pas grave, roule sans')], 0],
    ],
  },

  // Présidence: the palace, from the gates
  'conseil-ministres': {
    engine: 'quiz', title: t('Depuis la tribune'), how: t('Le guide t’explique comment ça marche : choisis la bonne réponse.'), decor: 'parquet',
    host: 'guide',
    questions: [
      [t('Qui préside le conseil des ministres ?'), [t('Le maire d’Abidjan'), t('Le capitaine des Éléphants'), t('Le président de la République')], 2],
      [t('Le Palais présidentiel se trouve dans quelle commune ?'), [t('Abobo'), t('Le Plateau'), t('Bingerville')], 1],
      [t('La capitale politique de la Côte d’Ivoire, c’est ?'), [t('Yamoussoukro'), t('Bouaké'), t('San-Pédro')], 0],
      [t('À la fin du conseil, on publie ?'), [t('Une chanson'), t('Un menu'), t('Un communiqué')], 2],
    ],
  },
  'manif-palais': {
    engine: 'rythme', title: t('La marche pacifique'), how: t('Scande les slogans en rythme avec la foule, dans le calme : tape sur la ligne.'), decor: 'bitume',
    lanes: ['megaphone', 'drapeau', 'sifflet'],
  },
  'selfie-palais': {
    engine: 'photo', title: t('Selfie aux grilles'), how: t('Tiens le téléphone : déclenche quand le drapeau ou le décor passe dans le cadre.'), decor: 'bitume',
    subjects: [{ name: t('Le drapeau'), prop: 'drapeau' }, { name: t('Le palmier'), prop: 'palmier' }, { name: t('L’oiseau'), prop: 'oiseau' }, { name: t('Le soleil'), prop: 'soleil' }],
  },
  'visite-palais': {
    engine: 'quiz', title: t('La visite du Palais'), how: t('Le guide pose ses questions sur l’histoire du pays : trouve la bonne réponse.'), decor: 'parquet',
    host: 'guide',
    questions: [
      [t('La Côte d’Ivoire est indépendante depuis le…'), [t('1er janvier 1900'), t('7 août 1960'), t('14 juillet 1789')], 1],
      [t('Le premier président du pays était…'), [t('Félix Houphouët-Boigny'), t('Didier Drogba'), t('Kacou Ananzè')], 0],
      [t('Les couleurs du drapeau sont…'), [t('Bleu, blanc, rouge'), t('Noir, jaune, vert'), t('Orange, blanc, vert')], 2],
      [t('L’hymne national s’appelle…'), [t('La Marseillaise'), t('L’Abidjanaise'), t('Premier Gaou')], 1],
    ],
  },

  // Restaurant: the birthday, the burger, the milkshake
  'anniversaire-resto': {
    engine: 'assembler', title: t('Le gâteau d’anniversaire'), how: t('Décore le gâteau dans l’ordre demandé avant que les amis ne chantent.'), decor: 'table',
    base: 'gateau',
    parts: [{ name: t('Les bonbons'), prop: 'bonbon' }, { name: t('La mangue'), prop: 'mangue' }, { name: t('L’étoile'), prop: 'etoile' }, { name: t('Le cœur'), prop: 'coeur' }, { name: t('Les bougies'), prop: 'bougie' }],
  },
  burger: {
    engine: 'assembler', title: t('Le burger maison'), how: t('Monte le burger comme le serveur l’annonce : chaque étage dans le bon ordre.'), decor: 'comptoir',
    base: 'pain',
    parts: [{ name: t('Le steak'), prop: 'burger' }, { name: t('La tomate'), prop: 'tomate' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }, { name: t('Le pain du dessus'), prop: 'pain' }],
  },
  milkshake: {
    engine: 'tenir', title: t('Le milkshake bien plein'), how: t('Verse le milkshake : lâche quand il arrive en haut du verre, sans déborder.'), decor: 'comptoir',
    object: 'verre', verb: t('Verse'), fill: 'liquide',
  },

  // Rue: street food, street dance, a stroll, a drink
  'brochettes-rue': {
    engine: 'choisir', title: t('Chez le braiseur'), how: t('Le braiseur crie ce qui est prêt : prends-le avant les autres clients.'), decor: 'etal',
    caller: t('Le braiseur'),
    items: [{ name: t('La brochette'), prop: 'brochette' }, { name: t('L’alloco'), prop: 'alloco' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Le poisson'), prop: 'poisson' }],
  },
  'danser-rue': {
    engine: 'rythme', title: t('Ça danse dans la rue'), how: t('Le djembé et la baffle lancent le son : tape chaque note sur la ligne.'), decor: 'bitume',
    lanes: ['djembe', 'enceinte', 'tam-tam'],
  },
  'flaner-rue': {
    engine: 'photo', title: t('Flâner en ville'), how: t('Tout défile dans la rue : déclenche quand le plus beau passe dans le cadre.'), decor: 'bitume',
    subjects: [{ name: t('Les mangues de la tantie'), prop: 'mangue' }, { name: t('Le perroquet'), prop: 'perroquet' }, { name: t('L’affiche'), prop: 'affiche' }, { name: t('Le pagne en vitrine'), prop: 'pagne' }, { name: t('Le cocotier'), prop: 'cocotier' }],
  },
  'pot-terrasse': {
    engine: 'tenir', title: t('Le pot en terrasse'), how: t('Verse ta boisson doucement : lâche quand le verre est plein, avant que la mousse déborde.'), decor: 'table',
    object: 'verre', verb: t('Verse'), fill: 'liquide',
  },

  // Salon: every hairstyle its own game
  carre: {
    engine: 'nettoyer', title: t('Le carré net'), how: t('Coupe chaque mèche qui dépasse pour un carré bien droit.'), decor: 'carrelage',
    object: 'meche', bit: 'cheveu', verb: t('Coupe'),
  },
  chignon: {
    engine: 'assembler', title: t('Le chignon'), how: t('La coiffeuse annonce les étapes : peigne, crème, mèche… dans le bon ordre.'), decor: 'carrelage',
    base: 'meche',
    parts: [{ name: t('Le peigne'), prop: 'peigne' }, { name: t('La crème'), prop: 'creme' }, { name: t('La mèche'), prop: 'meche' }, { name: t('Le bigoudi'), prop: 'bigoudi' }, { name: t('La fleur'), prop: 'fleur' }],
  },
  macarons: {
    engine: 'tenir', title: t('Les macarons sous le casque'), how: t('Sèche les macarons : lâche quand c’est chaud juste comme il faut, pas brûlé.'), decor: 'carrelage',
    object: 'seche-cheveux', verb: t('Sèche'), fill: 'chaleur',
  },
  manucure: {
    engine: 'choisir', title: t('Les ongles de star'), how: t('La manucure demande ses outils : passe-lui le bon avant qu’elle ne s’impatiente.'), decor: 'table',
    caller: t('La manucure'),
    items: [{ name: t('Le vernis'), prop: 'vernis' }, { name: t('La crème'), prop: 'creme' }, { name: t('Les ciseaux'), prop: 'ciseaux' }, { name: t('La serviette'), prop: 'serviette' }, { name: t('L’éponge'), prop: 'eponge' }],
  },
  nattes: {
    engine: 'rythme', title: t('Les nattes collées'), how: t('La tresseuse croise les mèches en cadence : suis son rythme sur la ligne.'), decor: 'carrelage',
    lanes: ['peigne', 'meche', 'bigoudi'], tempo: 90,
  },
  tissage: {
    engine: 'assembler', title: t('Poser le tissage'), how: t('Peigne, fil, mèches, ciseaux : passe chaque chose dans l’ordre pour le tissage.'), decor: 'carrelage',
    base: 'meche',
    parts: [{ name: t('Le peigne'), prop: 'peigne' }, { name: t('Le fil'), prop: 'bobine' }, { name: t('Les mèches'), prop: 'meche' }, { name: t('Les ciseaux'), prop: 'ciseaux' }, { name: t('Le sèche-cheveux'), prop: 'seche-cheveux' }],
  },
  tresses: {
    engine: 'equilibre', title: t('Tiens la tête droite'), how: t('Trois heures de tresses : garde la tête bien droite, la tresseuse compte sur toi.'), decor: 'carrelage',
    carry: 'meche', verb: t('Tiens bon'), distance: 90,
  },
  vanilles: {
    engine: 'repondre', title: t('Causer au salon'), how: t('Pendant les vanilles, la coiffeuse cause : réponds-lui bien.'), decor: 'carrelage',
    npc: 'vendeuse',
    lines: [
      [t('Tu veux tes vanilles longues ou courtes, ma chérie ?'), [t('Longues, jusqu’aux épaules !'), t('Fais n’importe quoi'), t('Rase tout')], 0],
      [t('Ça tire un peu, ça va ?'), [t('Aïe, arrête tout !'), t('Je vais partir sans payer'), t('Ça va, tu as la main douce')], 2],
      [t('Tu as vu la nouvelle série d’hier soir ?'), [t('La télé c’est nul'), t('Oui ! Le final m’a eue, on en parle ?'), t('Concentre-toi sur mes cheveux')], 1],
      [t('Et voilà, regarde-toi dans le miroir !'), [t('Waouh, c’est trop joli, merci !'), t('Bof'), t('Je préférais avant')], 0],
    ],
  },
  'work:coiffure': {
    engine: 'nettoyer', title: t('Le dégradé du client'), how: t('Le client veut un dégradé net : passe sur chaque cheveu qui dépasse.'), decor: 'carrelage',
    object: 'miroir', bit: 'cheveu', verb: t('Coupe'), count: 14,
  },

  // School: library, conference, evening class, the teacher's shift
  bibliotheque: {
    engine: 'choisir', title: t('Le bon livre'), how: t('La bibliothécaire te dit ce qu’il te faut : trouve-le avant les autres élèves.'), decor: 'etagere',
    caller: t('La bibliothécaire'),
    items: [{ name: t('Le livre d’histoire'), prop: 'livre' }, { name: t('Le cahier'), prop: 'cahier' }, { name: t('Le journal'), prop: 'journal' }, { name: t('Le dossier'), prop: 'dossier' }, { name: t('La calculatrice'), prop: 'calculatrice' }],
  },
  conference: {
    engine: 'quiz', title: t('La conférence du cacao'), how: t('Le conférencier pose ses questions sur le cacao : lève la main pour la bonne.'), decor: 'scene',
    host: 'prof',
    questions: [
      [t('Quel pays est le premier producteur de cacao au monde ?'), [t('La Suisse'), t('Le Canada'), t('La Côte d’Ivoire')], 2],
      [t('Le cacao, ça pousse où ?'), [t('Sous la terre'), t('Dans des cabosses sur l’arbre'), t('Dans la mer')], 1],
      [t('Avec les fèves de cacao, on fabrique…'), [t('Du chocolat'), t('Du ciment'), t('Du pagne')], 0],
    ],
  },
  'cours-du-soir': {
    engine: 'quiz', title: t('Le cours du soir'), how: t('Le prof interroge la classe : trouve la bonne réponse avant la fin de l’heure.'), decor: 'bureau',
    host: 'prof',
    questions: [
      [t('7 fois 8, ça fait combien ?'), ['54', '64', '56'], 2],
      [t('« Nous ___ au marché. » (aller, présent)'), [t('allez'), t('allons'), t('vont')], 1],
      [t('Combien y a-t-il de minutes dans une heure ?'), ['60', '100', '24'], 0],
      [t('La monnaie de la Côte d’Ivoire, c’est…'), [t('Le dollar'), t('Le naira'), t('Le franc CFA')], 2],
    ],
  },
  'work:enseignement': {
    engine: 'repondre', title: t('Faire cours'), how: t('Les élèves lèvent le doigt : réponds-leur juste et avec patience.'), decor: 'bureau',
    npc: 'enfant',
    lines: [
      [t('Maître, 3 fois 4, ça fait combien ?'), ['7', t('12, bravo d’avoir demandé !'), t('Cherche toi-même')], 1],
      [t('Madame, la capitale économique, c’est quoi ?'), [t('Abidjan, au bord de la lagune Ébrié'), t('Paris'), t('Le marché d’Adjamé')], 0],
      [t('J’ai pas compris l’exercice…'), [t('Tant pis pour toi'), t('Sors de la classe'), t('Pas de souci, on le refait ensemble au tableau')], 2],
      [t('Il a pris mon stylo !'), [t('Reprends-le de force'), t('On se calme, on partage, et chacun retrouve sa place'), t('Débrouillez-vous')], 1],
    ],
  },

  // Social: a call, hanging out
  appeler: {
    engine: 'repondre', title: t('Allô, mon gars ?'), how: t('Ton ami décroche : garde la conversation au top, réponds comme il faut.'), decor: 'parquet',
    npc: 'ami',
    lines: [
      [t('Allô ? C’est qui ça ?'), [t('C’est moi ! Je t’appelle pour prendre de tes nouvelles'), t('Devine'), '…'], 0],
      [t('Ah c’est toi ! On dit quoi ?'), [t('Rien'), t('Je raccroche'), t('On est là, Dieu merci. Et toi, la famille va bien ?')], 2],
      [t('Je suis un peu fatigué avec le boulot…'), [t('C’est ton problème'), t('Courage mon frère, on se voit ce week-end pour souffler ?'), t('Moi aussi, bye')], 1],
      [t('Bon, mon crédit va finir hein !'), [t('Ok, on se rappelle. Prends soin de toi !'), t('Rappelle-moi tout de suite'), t('Pas mon souci')], 0],
    ],
  },
  trainer: {
    engine: 'choisir', title: t('On prend quoi ?'), how: t('Ton pote dit ce qui lui fait envie : prends-le avant que la file n’avance.'), decor: 'etal',
    caller: t('Ton pote'),
    items: [{ name: t('L’alloco'), prop: 'alloco' }, { name: t('Le soda'), prop: 'soda' }, { name: t('La glace'), prop: 'glace' }, { name: t('Le garba'), prop: 'garba' }, { name: t('Le jus'), prop: 'jus' }, { name: t('Le pop-corn'), prop: 'popcorn' }],
  },

  // Soirée: the maquis-nightclub, every move its own game
  'atalaku-soiree': {
    engine: 'repondre', title: t('L’atalaku crie ton nom'), how: t('L’atalaku te chauffe au micro : réponds-lui avec style pour qu’il crie plus fort.'), decor: 'scene',
    npc: 'ami',
    lines: [
      [t('Eh, c’est qui le môgô de ce soir ?'), [t('Personne'), t('Laisse-moi tranquille'), t('C’est moi, crie mon nom fort !')], 2],
      [t('On t’appelle comment au quartier ?'), [t('Je sais pas'), t('Le Boss de la lagune !'), t('Pourquoi tu demandes ?')], 1],
      [t('Tu veux une dédicace pour qui ?'), [t('Pour toute ma famille et mes amis de Yop !'), t('Pour personne'), t('Pour moi seul, les autres non')], 0],
      [t('Le boss est dans la place ou bien ?'), [t('Non, je dors'), t('Baisse le son'), t('Le boss est là, mets l’ambiance !')], 2],
    ],
  },
  'boire-soiree': {
    engine: 'choisir', title: t('Au comptoir du bar'), how: t('Le barman annonce les verres : prends le tien avant les autres mains.'), decor: 'comptoir',
    caller: t('Le barman'),
    items: [{ name: t('Le cocktail'), prop: 'cocktail' }, { name: t('La bière'), prop: 'biere' }, { name: t('Le soda'), prop: 'soda' }, { name: t('Le jus'), prop: 'jus' }, { name: t('L’eau'), prop: 'sachet-eau' }],
  },
  'bouteille-soiree': {
    engine: 'equilibre', title: t('La bouteille du carré VIP'), how: t('Porte la bouteille et ses cierges magiques jusqu’au carré VIP sans la pencher.'), decor: 'parquet',
    carry: 'bouteille', verb: t('Porte'),
  },
  'danser-soiree': {
    engine: 'rythme', title: t('Le coupé-décalé'), how: t('Le DJ lance le coupé-décalé : tape chaque pas sur la ligne, comme un vrai champion.'), decor: 'parquet',
    lanes: ['enceinte', 'platine', 'micro'], tempo: 120,
  },
  'mixer-soiree': {
    engine: 'rythme', title: t('Aux platines'), how: t('Enchaîne les sons : tape la platine, les notes et la baffle juste sur le temps.'), decor: 'scene',
    lanes: ['platine', 'note-musique', 'enceinte'], tempo: 110,
  },
  'podium-soiree': {
    engine: 'equilibre', title: t('Sur le podium'), how: t('Le podium est petit et ça bouge : garde l’équilibre jusqu’à la fin du son.'), decor: 'scene',
    carry: 'chaussure', verb: t('Danse'),
  },
  'recevoir-soiree': {
    engine: 'repondre', title: t('Bienvenue chez toi'), how: t('Tes invités arrivent : accueille chacun comme il faut.'), decor: 'parquet',
    npc: 'amie',
    lines: [
      [t('Bonsoir ! Je suis pas trop en retard ?'), [t('Si, rentre chez toi'), t('Pas du tout, entre, tu es la bienvenue !'), t('Tu as apporté quoi ?')], 1],
      [t('J’ai apporté un petit gâteau.'), [t('Oh merci, fallait pas ! On le mange ensemble'), t('Il est petit hein'), t('Pose ça là-bas')], 0],
      [t('Je connais personne ici…'), [t('Débrouille-toi'), t('Reste dans un coin'), t('Viens, je te présente à tout le monde')], 2],
      [t('C’était top, merci pour la soirée !'), [t('Enfin tu pars'), t('Merci d’être venue, rentre bien !'), t('Tu ranges avant ?')], 1],
    ],
  },
  'slow-soiree': {
    engine: 'rythme', title: t('Le slow'), how: t('Le son ralentit : suis doucement le tempo, sans marcher sur les pieds de l’autre.'), decor: 'parquet',
    lanes: ['note-musique', 'coeur', 'etoile'], tempo: 70, notes: 20,
  },
  'travaillement-soiree': {
    engine: 'viser', title: t('Travailler le DJ'), how: t('Le DJ cite ton nom : lance tes billets pile sur lui, la foule crie.'), decor: 'scene',
    projectile: 'billet', target: 'platine', shots: 6,
  },

  // Sport: basket, foot, the match
  'play-basket': {
    engine: 'viser', title: t('Le tir à trois points'), how: t('Vise le panier, dose ta force : marque un maximum de paniers.'), decor: 'piste',
    projectile: 'ballon-basket', target: 'panier-basket',
  },
  'play-football': {
    engine: 'course', title: t('Le dribble du quartier'), how: t('Dribble entre les plots : récupère les ballons, évite les quilles.'), decor: 'terre',
    mode: 'pied', good: 'ballon-foot', bad: 'quille',
  },
  'watch-match': {
    engine: 'rythme', title: t('Supporter les Éléphants'), how: t('Tam-tam, sifflet, drapeau : encourage l’équipe en rythme avec les supporters.'), decor: 'herbe',
    lanes: ['tam-tam', 'sifflet', 'drapeau'],
  },

  // Stade: the big pitch, concerts, the national day, the meeting
  'play-foot11': {
    engine: 'viser', title: t('Le penalty'), how: t('Le gardien bouge : vise le coin et dose ta frappe pour marquer.'), decor: 'herbe',
    projectile: 'ballon-foot', target: 'but', shots: 5,
  },
  'stade-concert': {
    engine: 'rythme', title: t('Le concert géant'), how: t('Le stade chante avec la star : suis la guitare et le micro sur la ligne.'), decor: 'scene',
    lanes: ['micro', 'guitare', 'enceinte'], tempo: 115,
  },
  'stade-fete': {
    engine: 'equilibre', title: t('Le défilé du 7 août'), how: t('Tu portes le drapeau au défilé de la Fête de la Nation : garde-le bien droit.'), decor: 'piste',
    carry: 'drapeau', verb: t('Défile'),
  },
  'stade-footing': {
    engine: 'course', title: t('Les tours de piste'), how: t('Cours sur la piste : prends les sachets d’eau, évite les cailloux.'), decor: 'piste',
    mode: 'pied', good: 'sachet-eau', bad: 'caillou',
  },
  'stade-match': {
    engine: 'photo', title: t('Les moments du match'), how: t('Ne rate rien : déclenche quand le ballon ou le trophée passe dans le cadre.'), decor: 'herbe',
    subjects: [{ name: t('Le ballon'), prop: 'ballon-foot' }, { name: t('Le trophée'), prop: 'trophee' }, { name: t('Le drapeau'), prop: 'drapeau' }, { name: t('La médaille'), prop: 'medaille' }],
  },
  'stade-meeting': {
    engine: 'quiz', title: t('Bien voter, ça s’apprend'), how: t('Au meeting, on parle du vote : trouve la bonne réponse sur la façon de voter.'), decor: 'herbe',
    host: 'guide',
    questions: [
      [t('On peut voter en Côte d’Ivoire à partir de…'), [t('18 ans'), t('12 ans'), t('40 ans')], 0],
      [t('Dans l’urne, on met…'), [t('Son téléphone'), t('Sa carte bancaire'), t('Son bulletin')], 2],
      [t('Pour voter, il faut être…'), [t('Champion de foot'), t('Inscrit sur la liste électorale'), t('Né à Abidjan seulement')], 1],
    ],
  },

  // Station: breakfast, phone credit, gas, tyres
  'boutique-station': {
    engine: 'choisir', title: t('Le petit-déj de la station'), how: t('La caissière appelle ta commande : prends-la avant les clients pressés.'), decor: 'comptoir',
    caller: t('La caissière'),
    items: [{ name: t('Le café'), prop: 'cafe' }, { name: t('Le croissant'), prop: 'croissant' }, { name: t('Le pain'), prop: 'pain' }, { name: t('Le jus'), prop: 'jus' }, { name: t('Le thé'), prop: 'the' }, { name: t('L’eau'), prop: 'sachet-eau' }],
  },
  'credit-station': {
    engine: 'repondre', title: t('Recharger son crédit'), how: t('La vendeuse de crédit te sert : réponds juste pour que tout passe.'), decor: 'comptoir',
    npc: 'vendeuse',
    lines: [
      [t('Bonjour, c’est combien de crédit ?'), [t('1 000 francs, s’il te plaît'), t('Tout ton stock'), t('Je sais pas')], 0],
      [t('Donne-moi ton numéro.'), [t('Devine-le'), t('C’est secret'), t('Je te l’écris lentement, chiffre par chiffre')], 2],
      [t('Tu as reçu le message ?'), [t('Non, rembourse-moi deux fois'), t('Oui, c’est arrivé, merci beaucoup !'), t('Quel message ?')], 1],
    ],
  },
  'gaz-bouteille': {
    engine: 'tenir', title: t('La bouteille de gaz'), how: t('Remplis la bouteille de gaz : lâche quand la jauge est dans le vert.'), decor: 'bitume',
    object: 'bouteille', verb: t('Remplis'), fill: 'liquide',
  },
  'gonfler-pneus': {
    engine: 'tenir', title: t('Gonfler les pneus'), how: t('Pompe sur le pneu du vélo : lâche quand il est bien dur, avant qu’il éclate.'), decor: 'bitume',
    object: 'velo', verb: t('Gonfle'), fill: 'force',
  },

  // Gare routière: snacks, waiting, coxers, the apprenti's shift
  'arachides-route': {
    engine: 'choisir', title: t('Pour la route'), how: t('La vendeuse passe à la fenêtre du car : prends ce qu’elle annonce, vite !'), decor: 'bitume',
    caller: t('La vendeuse ambulante'),
    items: [{ name: t('Les arachides'), prop: 'sac' }, { name: t('La banane'), prop: 'banane' }, { name: t('La mangue'), prop: 'mangue' }, { name: t('L’eau glacée'), prop: 'sachet-eau' }, { name: t('Le pain'), prop: 'pain' }, { name: t('La noix de coco'), prop: 'noix-coco' }],
  },
  'attendre-car': {
    engine: 'photo', title: t('La vie de la gare'), how: t('En attendant le car, regarde la gare : déclenche quand une belle scène passe.'), decor: 'bitume',
    subjects: [{ name: t('La tantie aux mangues'), prop: 'mangue' }, { name: t('Le voyageur et sa valise'), prop: 'valise' }, { name: t('Le colis sur le toit'), prop: 'colis' }, { name: t('Le perroquet'), prop: 'perroquet' }, { name: t('L’affiche du car'), prop: 'affiche' }],
  },
  coxers: {
    engine: 'repondre', title: t('Les coxers'), how: t('Les coxers veulent te mettre dans leur car : discute sans te faire gâter.'), decor: 'bitume',
    npc: 'ami',
    lines: [
      [t('Mon frère, tu vas où ? Bouaké, Yakro ?'), [t('Yamoussoukro. C’est quelle compagnie ?'), t('Je vais nulle part'), t('Lâche-moi le bras')], 0],
      [t('Notre car part tout de suite, on attend que toi !'), [t('Je monte sans regarder'), t('Tu mens toujours'), t('Ah bon ? Montre-moi d’abord combien il reste de places')], 2],
      [t('Pour toi, c’est prix d’ami !'), [t('Je te donne tout mon argent'), t('Merci, mais je paie au guichet avec mon ticket'), t('C’est trop cher, je vais à pied')], 1],
      [t('Bon voyage, hein !'), [t('Merci, bonne journée à vous !'), t('Pas besoin'), t('Hum')], 0],
    ],
  },
  'eat-brochette': {
    engine: 'tenir', title: t('La brochette dorée'), how: t('Grille ta brochette : lâche quand elle est bien dorée, pas brûlée.'), decor: 'etal',
    object: 'brochette', verb: t('Grille'), fill: 'chaleur',
  },
  'eau-glacee-gare': {
    engine: 'attraper', title: t('Eau glacée, eau glacée !'), how: t('La vendeuse lance les sachets : attrape les bien glacés, laisse tomber les gouttes.'), decor: 'bitume',
    from: 'seau', into: 'sac', count: 10,
    good: [{ name: t('Le sachet d’eau glacée'), prop: 'sachet-eau' }],
    bad: [{ name: t('La goutte'), prop: 'goutte' }, { name: t('Le caillou'), prop: 'caillou' }],
  },
  'wait-gbaka': {
    engine: 'repondre', title: t('À l’arrêt du gbaka'), how: t('Un vieux attend avec toi : cause avec lui en attendant le gbaka.'), decor: 'bitume',
    npc: 'vieux',
    lines: [
      [t('Mon fils, le gbaka de Yopougon est déjà passé ?'), [t('Je sais pas, cherche'), t('C’est pas mon problème'), t('Pas encore, papa, on l’attend ensemble')], 2],
      [t('De mon temps, le transport coûtait 25 francs !'), [t('C’est faux'), t('Eh, ça a bien changé ! Raconte-moi un peu'), t('Tu radotes')], 1],
      [t('Voilà le gbaka, il est plein…'), [t('Montez en premier, papa, je prendrai le prochain'), t('Pousse-toi, je passe'), t('Tant pis pour vous')], 0],
    ],
  },
  'work:transport': {
    engine: 'attraper', title: t('Encaisser les passagers'), how: t('Chaque passager paie sa place : attrape pièces et billets, laisse tomber le reste.'), decor: 'bitume',
    from: 'casquette', into: 'sac', count: 14,
    good: [{ name: t('La pièce'), prop: 'piece' }, { name: t('Le billet'), prop: 'billet' }, { name: t('Le ticket'), prop: 'ticket' }],
    bad: [{ name: t('Le caillou'), prop: 'caillou' }, { name: t('La feuille'), prop: 'feuille' }, { name: t('Le bonbon'), prop: 'bonbon' }],
  },

  // Tribunal: the lawyer, the record, the complaint, a hearing
  avocat: {
    engine: 'repondre', title: t('Chez l’avocat'), how: t('Maître t’écoute pour préparer ton dossier : réponds-lui bien.'), decor: 'bureau',
    npc: 'chef',
    lines: [
      [t('Racontez-moi tout depuis le début.'), [t('Devinez'), t('C’est long, je résume en un mot'), t('Je vous dis tout, avec les dates et les papiers')], 2],
      [t('Vous avez des preuves ?'), [t('Non, mais croyez-moi'), t('Oui, voici les reçus et les messages'), t('Je vais en inventer')], 1],
      [t('On va essayer d’abord un arrangement à l’amiable.'), [t('D’accord, si c’est plus simple pour tout le monde'), t('Non, jamais'), t('Faites ce que vous voulez')], 0],
    ],
  },
  casier: {
    engine: 'choisir', title: t('Le casier judiciaire'), how: t('Le greffier demande une pièce : donne-lui la bonne pour avoir ton extrait.'), decor: 'comptoir',
    caller: t('Le greffier'),
    items: [{ name: t('La pièce d’identité'), prop: 'passeport' }, { name: t('Le timbre'), prop: 'ticket' }, { name: t('L’extrait de naissance'), prop: 'dossier' }, { name: t('Le stylo'), prop: 'stylo' }, { name: t('L’argent'), prop: 'billet' }],
  },
  plainte: {
    engine: 'assembler', title: t('Le dossier de plainte'), how: t('Monte ton dossier dans l’ordre : identité, preuves, lettre, signature, tampon.'), decor: 'bureau',
    base: 'dossier',
    parts: [{ name: t('La pièce d’identité'), prop: 'passeport' }, { name: t('Les preuves'), prop: 'ticket' }, { name: t('La lettre'), prop: 'cahier' }, { name: t('La signature'), prop: 'stylo' }, { name: t('Le tampon'), prop: 'tampon' }],
  },
  proces: {
    engine: 'quiz', title: t('Dans la salle d’audience'), how: t('Tu assistes au procès : l’huissier te teste, trouve la bonne réponse.'), decor: 'parquet',
    host: 'juge',
    questions: [
      [t('Quand les juges entrent dans la salle, on fait quoi ?'), [t('On applaudit'), t('On sort'), t('On se lève')], 2],
      [t('Qui défend l’accusé ?'), [t('Le greffier'), t('L’avocat'), t('Le public')], 1],
      [t('Le greffier, il sert à quoi ?'), [t('Il note tout ce qui se dit'), t('Il vend les tickets'), t('Il juge l’affaire')], 0],
      [t('Dans la salle, le téléphone doit être…'), [t('En haut-parleur'), t('En pleine vidéo'), t('Éteint ou en silencieux')], 2],
    ],
  },

  // Université: lectures, the BU, a conference, the exam, the canteen
  amphi: {
    engine: 'quiz', title: t('Cours de géographie'), how: t('Le prof de l’amphi interroge : trouve la bonne réponse parmi 500 étudiants.'), decor: 'scene',
    host: 'prof',
    questions: [
      [t('La lagune d’Abidjan s’appelle…'), [t('La lagune Bleue'), t('La lagune Ébrié'), t('Le lac Kossou')], 1],
      [t('Le point le plus haut du pays, c’est…'), [t('Le mont Nimba'), t('Le Kilimandjaro'), t('La tour F')], 0],
      [t('Un grand fleuve ivoirien, c’est…'), [t('Le Nil'), t('L’Amazone'), t('Le Bandama')], 2],
      [t('Abidjan est au bord de…'), [t('L’océan Indien'), t('L’océan Atlantique'), t('La mer Rouge')], 1],
    ],
  },
  bu: {
    engine: 'tenir', title: t('Concentré à la BU'), how: t('Garde ta concentration sur le livre : relâche quand c’est rentré, pas avant.'), decor: 'bureau',
    object: 'livre', verb: t('Concentre-toi'), fill: 'force', times: 4,
  },
  'conference-u': {
    engine: 'quiz', title: t('Conférence patrimoine'), how: t('La conférencière parle du patrimoine ivoirien : trouve la bonne réponse.'), decor: 'scene',
    host: 'prof',
    questions: [
      [t('Quelle ville historique est au patrimoine mondial de l’UNESCO ?'), ['Grand-Bassam', t('Daloa'), t('Divo')], 0],
      [t('Le parc national de Taï est connu pour…'), [t('Ses pingouins'), t('Son désert'), t('Sa forêt et ses chimpanzés')], 2],
      [t('Le parc de la Comoé est…'), [t('Un centre commercial'), t('Un des plus grands parcs d’Afrique de l’Ouest'), t('Un stade')], 1],
    ],
  },
  partiel: {
    engine: 'quiz', title: t('Le partiel'), how: t('Trois heures, une copie : réponds juste à chaque question du sujet.'), decor: 'bureau',
    host: 'prof',
    questions: [
      [t('La racine carrée de 81, c’est…'), ['9', '8', '18'], 0],
      [t('Le pluriel de « cheval », c’est…'), [t('Chevals'), t('Chevaus'), t('Chevaux')], 2],
      [t('En quelle année la Côte d’Ivoire devient indépendante ?'), ['1980', '1960', '1945'], 1],
      [t('L’attiéké est fait à partir de…'), [t('Manioc'), t('Maïs'), t('Riz')], 0],
      [t('25 % de 200, c’est…'), ['25', '75', '50'], 2],
    ],
  },
  'resto-u': {
    engine: 'choisir', title: t('La file du resto U'), how: t('La dame de la cantine appelle les plats : prends le tien avant les autres plateaux.'), decor: 'comptoir',
    caller: t('La dame de la cantine'),
    items: [{ name: t('Le riz'), prop: 'riz' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le poisson'), prop: 'poisson' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('Le foutou'), prop: 'foutou' }, { name: t('Le pain'), prop: 'pain' }],
  },

  // Village: the elders, fresh attiéké, making it
  anciens: {
    engine: 'repondre', title: t('Écouter les anciens'), how: t('Sous l’arbre à palabres, le vieux raconte : réponds-lui avec respect.'), decor: 'terre',
    npc: 'vieux',
    lines: [
      [t('Assieds-toi, mon enfant. Tu connais l’histoire du village ?'), [t('Non, et ça m’est égal'), t('Pas bien, papa. Raconte-moi, j’écoute'), t('Fais vite')], 1],
      [t('Nos grands-parents sont venus ici à pied, il y a longtemps.'), [t('Ils ont eu du courage ! Pourquoi ici ?'), t('Ils auraient dû prendre un car'), t('Bof')], 0],
      [t('Le respect des aînés, c’est la base, tu sais.'), [t('C’est dépassé'), t('Le respect se paie'), t('Oui, et je reviendrai vous écouter')], 2],
      [t('Tiens, prends cette noix de cola.'), [t('C’est tout ?'), t('Merci beaucoup, papa !'), t('Garde-la')], 1],
    ],
  },
  'attieke-frais': {
    engine: 'assembler', title: t('L’assiette du village'), how: t('La tantie compose ton assiette : attiéké, poisson, tomate, oignon… dans l’ordre.'), decor: 'table',
    base: 'assiette',
    parts: [{ name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le poisson'), prop: 'poisson' }, { name: t('La tomate'), prop: 'tomate' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }],
  },
  'preparer-attieke': {
    engine: 'tenir', title: t('L’attiéké à la vapeur'), how: t('Cuis la semoule de manioc à la vapeur : lâche quand ça fume juste comme il faut.'), decor: 'terre',
    object: 'marmite', verb: t('Cuis'), fill: 'chaleur', times: 5,
  },

  // Worship: songs, prayers, visits — every faith alike
  culte: {
    engine: 'rythme', title: t('Les chants du culte'), how: t('La chorale lance la louange : tape chaque note sur la ligne avec l’assemblée.'), decor: 'parquet',
    lanes: ['tam-tam', 'micro', 'guitare'], tempo: 100,
  },
  messe: {
    engine: 'repondre', title: t('La messe du dimanche'), how: t('Le prêtre parle à l’assemblée : donne la bonne réponse de la messe.'), decor: 'parquet',
    npc: 'pretre',
    lines: [
      [t('Le Seigneur soit avec vous.'), [t('Et avec votre esprit'), t('Bonjour à vous'), t('Merci, ça va')], 0],
      [t('Donnez-vous la paix.'), [t('Tu regardes ton téléphone'), t('Tu sors'), t('Tu serres la main de ton voisin avec un sourire')], 2],
      [t('Allez dans la paix du Christ.'), [t('À demain'), t('Nous rendons grâce à Dieu'), t('Déjà fini ?')], 1],
    ],
  },
  'messe-matin': {
    engine: 'tenir', title: t('Le cierge du matin'), how: t('Allume ton cierge doucement : lâche quand la flamme est belle et calme.'), decor: 'parquet',
    object: 'cierge', verb: t('Allume'), fill: 'chaleur', times: 3,
  },
  'monter-tour': {
    engine: 'equilibre', title: t('En haut de la tour'), how: t('Monte l’escalier en colimaçon sans lâcher ton appareil photo : la vue t’attend.'), decor: 'carrelage',
    carry: 'appareil-photo', verb: t('Monte'),
  },
  pray: {
    engine: 'tenir', title: t('Se recueillir'), how: t('Respire et concentre-toi : relâche quand ton cœur est calme.'), decor: 'carrelage',
    object: 'bougie', verb: t('Recueille-toi'), fill: 'force', times: 3,
  },
  'priere-vendredi': {
    engine: 'repondre', title: t('La prière du vendredi'), how: t('Avant la grande prière, l’imam et les fidèles te saluent : réponds bien.'), decor: 'carrelage',
    npc: 'imam',
    lines: [
      [t('As-salamou alaykoum.'), [t('Wa alaykoum as-salam'), t('Salut'), t('Je suis pressé')], 0],
      [t('Avant la prière, on commence par…'), [t('Un café'), t('Une photo'), t('Les ablutions')], 2],
      [t('Un vieux n’a pas de place dans la rangée…'), [t('Tant pis pour lui'), t('Je me serre pour lui faire de la place'), t('Je prends sa place')], 1],
      [t('Que Dieu te bénisse, à vendredi prochain.'), [t('Amine, à toi aussi !'), t('Peut-être'), t('Bof')], 0],
    ],
  },
  veillee: {
    engine: 'rythme', title: t('La veillée de prière'), how: t('Toute la nuit on chante : suis le djembé et le balafon à la lueur des bougies.'), decor: 'parquet',
    lanes: ['djembe', 'bougie', 'balafon'], tempo: 90,
  },
  visit: {
    engine: 'photo', title: t('La visite du lieu saint'), how: t('Admire le lieu en silence : déclenche quand une belle chose passe dans le cadre.'), decor: 'carrelage',
    subjects: [{ name: t('Le grand tapis'), prop: 'tapis' }, { name: t('La lampe'), prop: 'lampe' }, { name: t('La statue'), prop: 'statue' }, { name: t('Le tableau'), prop: 'tableau' }, { name: t('La colombe'), prop: 'oiseau' }, { name: t('Les fleurs'), prop: 'fleur' }],
  },

  // Zoo: the lions, the picnic, the visit
  'zoo-photos': {
    engine: 'photo', title: t('Selfie au zoo'), how: t('Les animaux bougent derrière toi : déclenche quand celui demandé est bien dans le cadre.'), decor: 'herbe',
    subjects: [{ name: t('Le lion'), prop: 'lion' }, { name: t('La girafe'), prop: 'girafe' }, { name: t('L’éléphant'), prop: 'elephant' }, { name: t('Le singe curieux'), prop: 'singe' }],
  },
  'zoo-pique-nique': {
    engine: 'attraper', title: t('Pique-nique sous l’arbre'), how: t('Les fruits tombent de l’arbre : attrape-les dans le sac, laisse tomber les feuilles.'), decor: 'herbe',
    from: 'palmier', into: 'sac',
    good: [{ name: t('La mangue'), prop: 'mangue' }, { name: t('La banane'), prop: 'banane' }, { name: t('La noix de coco'), prop: 'noix-coco' }],
    bad: [{ name: t('La feuille'), prop: 'feuille' }, { name: t('Le caillou'), prop: 'caillou' }],
  },
  'zoo-visite': {
    engine: 'quiz', title: t('La visite du zoo'), how: t('Le guide du zoo pose ses colles sur les animaux : trouve la bonne réponse.'), decor: 'herbe',
    host: 'guide',
    questions: [
      [t('Quel animal donne son surnom à l’équipe nationale de foot ?'), [t('Le lion'), t('La girafe'), t('L’éléphant')], 2],
      [t('La girafe mange surtout…'), [t('Du poisson'), t('Des feuilles d’arbres'), t('Des cailloux')], 1],
      [t('Quel oiseau peut imiter la voix humaine ?'), [t('Le perroquet'), t('Le pigeon'), t('Le hibou')], 0],
      [t('La tortue peut vivre…'), [t('Une semaine'), t('Un jour'), t('Très longtemps, parfois plus de 100 ans')], 2],
    ],
  },
}
