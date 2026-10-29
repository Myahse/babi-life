import type { Jeu } from '../types'

// Every action of list00 (airport … happenings), dressed as its own little game.
export const JEUX_1: Record<string, Jeu> = {
  // The airport (Félix-Houphouët-Boigny, Port-Bouët)
  'accueillir-arrivees': {
    engine: 'repondre', title: 'Bienvenue au pays !', how: 'Ton cousin sort des arrivées après deux ans en France : trouve les mots qui font plaisir.', decor: 'carrelage', npc: 'ami',
    lines: [
      ['Eh, c’est toi ? Tu as grossi dèh !', ['C’est le garba de Babi, mon frère, bonne arrivée !', 'Toi tu as vieilli.', 'Je ne te connais pas.'], 0],
      ['Les valises sont lourdes, hein…', ['Débrouille-toi.', 'Donne, on porte à deux !', 'Tu as amené quoi pour moi ?'], 1],
      ['Il fait chaud comme ça ici ?', ['Non, c’est l’avion qui chauffe.', 'Bienvenue sous le soleil de Babi, on va boire une coco !', 'Retourne là-bas alors.'], 1],
      ['Tout le monde va bien à la maison ?', ['Je sais pas, je viens pas souvent.', 'Tout le monde t’attend, la tantie a fait du foutou !', 'Ça dépend.'], 1],
    ],
  },
  'babi-burger-aeroport': {
    engine: 'assembler', title: 'Le Babi Burger', how: 'Le voyageur pressé passe commande : empile ses ingrédients dans le bon ordre avant l’embarquement.', decor: 'comptoir', base: 'assiette',
    parts: [{ name: 'Le pain', prop: 'pain' }, { name: 'Le poulet pané', prop: 'poulet' }, { name: 'La tomate', prop: 'tomate' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }],
  },
  'boutique-aeroport': {
    engine: 'choisir', title: 'La boutique hors taxes', how: 'La vendeuse te montre ses articles : touche celui qu’elle nomme avant les autres voyageurs.', decor: 'etagere', caller: 'La vendeuse',
    items: [{ name: 'Le parfum', prop: 'parfum' }, { name: 'Les lunettes de soleil', prop: 'lunettes' }, { name: 'La montre', prop: 'montre' }, { name: 'Le sac', prop: 'sac' }, { name: 'Le collier', prop: 'collier' }, { name: 'Le masque sculpté', prop: 'masque' }],
  },
  'cafe-aeroport': {
    engine: 'tenir', title: 'Le café du comptoir', how: 'Tiens pour verser le café, lâche quand la tasse est pleine, sans déborder sur le comptoir.', decor: 'comptoir', object: 'cafe', verb: 'Verse', fill: 'liquide',
  },
  'resto-aeroport': {
    engine: 'choisir', title: 'Le resto de l’aérogare', how: 'Le serveur annonce les plats qui sortent : touche le bon avant la table d’à côté.', decor: 'table', caller: 'Le serveur',
    items: [{ name: 'Le poisson braisé', prop: 'poisson' }, { name: 'Le poulet', prop: 'poulet' }, { name: 'Le riz', prop: 'riz' }, { name: 'L’attiéké', prop: 'attieke' }, { name: 'L’alloco', prop: 'alloco' }],
  },
  'salle-attente': {
    engine: 'equilibre', title: 'Petit somme en salle', how: 'Tu piques du nez sur ton coussin : garde la tête droite pour ne pas tomber sur ton voisin.', decor: 'carrelage', carry: 'coussin', verb: 'Garde la tête droite',
  },
  'voir-avions': {
    engine: 'photo', title: 'Les avions décollent', how: 'Les avions passent au-dessus de la piste : déclenche quand l’un d’eux est bien dans le cadre.', decor: 'ciel',
    subjects: [{ name: 'Le vol pour Bouaké', prop: 'avion' }, { name: 'Le soleil couchant', prop: 'soleil' }, { name: 'Un oiseau', prop: 'oiseau' }, { name: 'Un nuage', prop: 'nuage' }],
  },
  'work:aerien': {
    engine: 'assembler', title: 'Le comptoir d’enregistrement', how: 'Un passager après l’autre : passeport, billet, pesée, étiquette, dans l’ordre demandé.', decor: 'comptoir', base: 'dossier',
    parts: [{ name: 'Le passeport', prop: 'passeport' }, { name: 'Le billet', prop: 'ticket' }, { name: 'La pesée de la valise', prop: 'balance' }, { name: 'L’étiquette bagage', prop: 'badge' }, { name: 'La carte d’embarquement', prop: 'billet-cinema' }],
  },

  // The National Assembly (Plateau)
  petition: {
    engine: 'assembler', title: 'La pétition du quartier', how: 'Monte le dossier pour le député dans l’ordre : la lettre, les signatures, les photos, le tampon.', decor: 'bureau', base: 'dossier',
    parts: [{ name: 'La lettre', prop: 'cahier' }, { name: 'Les signatures', prop: 'stylo' }, { name: 'Les photos du caniveau', prop: 'appareil-photo' }, { name: 'Le tampon de dépôt', prop: 'tampon' }],
  },
  'seance-publique': {
    engine: 'repondre', title: 'Dans la tribune', how: 'Le vieux à côté de toi chuchote pendant la séance : réponds-lui sans déranger personne.', decor: 'parquet', npc: 'vieux',
    lines: [
      ['Pssst… tu sais ce qu’ils votent aujourd’hui ?', ['Le budget, je crois. On écoute ?', 'ON VOTE QUOI ?!', 'Je m’en fous.'], 0],
      ['Mon fils, tu as un bonbon ?', ['Tiens, doucement, papa.', 'Non, tchrrr.', 'Achète toi-même.'], 0],
      ['Le président de séance a sonné. Ça veut dire quoi ?', ['Que c’est la récré.', 'Qu’il faut faire silence, on reprend.', 'Qu’on peut applaudir.'], 1],
      ['Tu reviendras avec moi la prochaine fois ?', ['Jamais.', 'Si tu me payes.', 'Avec plaisir, on apprend des choses ici.'], 2],
    ],
  },
  'selfie-assemblee': {
    engine: 'photo', title: 'Selfie devant l’Assemblée', how: 'Le drapeau flotte, les passants bougent : prends la photo quand le bon décor est dans le cadre.', decor: 'bitume',
    subjects: [{ name: 'Le drapeau qui flotte', prop: 'drapeau' }, { name: 'La statue', prop: 'statue' }, { name: 'Le palmier', prop: 'palmier' }, { name: 'Le soleil couchant', prop: 'soleil' }],
  },
  'visite-hemicycle': {
    engine: 'quiz', title: 'Visite de l’hémicycle', how: 'Le guide te fait visiter et te pose ses questions : trouve la bonne réponse.', decor: 'parquet', host: 'guide',
    questions: [
      ['Dans quelle commune se trouve l’Assemblée nationale ?', ['Au Plateau', 'À Yopougon', 'À Bingerville'], 0],
      ['Qui vote les lois ?', ['Les maires', 'Les députés', 'Les juges'], 1],
      ['Le Parlement a deux chambres : l’Assemblée nationale et…', ['La mairie', 'Le tribunal', 'Le Sénat'], 2],
      ['Les couleurs du drapeau ivoirien ?', ['Orange, blanc, vert', 'Rouge, jaune, vert', 'Bleu, blanc, rouge'], 0],
    ],
  },

  // The barber's
  'boule-a-zero': {
    engine: 'nettoyer', title: 'La boule à zéro', how: 'Le crâne est plein de mousse dans le miroir : passe le rasoir sur chaque bout, jusqu’à ce que ça brille.', decor: 'carrelage', object: 'miroir', bit: 'mousse', verb: 'Rase',
  },
  'coupe-courte': {
    engine: 'choisir', title: 'Passe-moi l’outil !', how: 'Le barbier te demande ses outils pour ta coupe : tends-lui le bon avant l’apprenti.', decor: 'carrelage', caller: 'Le barbier',
    items: [{ name: 'Les ciseaux', prop: 'ciseaux' }, { name: 'Le peigne', prop: 'peigne' }, { name: 'Le rasoir', prop: 'rasoir' }, { name: 'Le séchoir', prop: 'seche-cheveux' }, { name: 'La serviette', prop: 'serviette' }],
  },
  degrade: {
    engine: 'tenir', title: 'Le dégradé propre', how: 'Passe la tondeuse étage par étage : tiens, et lâche pile dans le vert pour un dégradé net.', decor: 'carrelage', object: 'rasoir', verb: 'Passe la tondeuse', fill: 'force', times: 4,
  },
  gbairai: {
    engine: 'repondre', title: 'Le gbairai du salon', how: 'Au salon, les nouvelles du quartier tournent : réponds pour rigoler sans blesser personne.', decor: 'carrelage', npc: 'vieux',
    lines: [
      ['Tu as vu ? Le fils du boutiquier s’est acheté une moto !', ['Il va nous déposer alors, on est ensemble !', 'Il l’a volée sûrement.', 'Moi je m’en fiche.'], 0],
      ['On dit que la tantie Awa a gagné à la tombola…', ['Faut lui demander la recette, c’est la chance !', 'Elle a triché.', 'Elle va tout gâter.'], 0],
      ['Et toi, toujours pas marié ?', ['Laisse-moi tranquille !', 'Patience, papa, le bon mouton se cherche !', 'Et toi, toujours pas coiffé ?'], 1],
      ['Le maquis d’en face a augmenté le garba !', ['Ils sont des voleurs.', 'Il faut fermer leur maquis.', 'Aïe, la vie est chère, on va cotiser pour le garba !'], 2],
    ],
  },
  iroquoise: {
    engine: 'assembler', title: 'L’iroquoise de star', how: 'Le client veut sa crête : rase les côtés, peigne, gel, séchoir, dans l’ordre qu’il réclame.', decor: 'carrelage', base: 'miroir',
    parts: [{ name: 'Les côtés rasés', prop: 'rasoir' }, { name: 'La crête peignée', prop: 'peigne' }, { name: 'Le gel', prop: 'creme' }, { name: 'Le coup de séchoir', prop: 'seche-cheveux' }],
  },
  'taille-barbe': {
    engine: 'nettoyer', title: 'La barbe bien taillée', how: 'Des poils dépassent de partout dans le miroir : taille chaque poil rebelle.', decor: 'carrelage', object: 'miroir', bit: 'cheveu', verb: 'Taille',
  },

  // The beach (Bassam, Port-Bouët)
  'balade-plage': {
    engine: 'course', title: 'Au bord de l’eau', how: 'Marche le long des vagues : ramasse les jolis coquillages, évite les crabes qui pincent.', decor: 'sable', mode: 'pied', good: 'coquillage', bad: 'crabe',
  },
  'chill-sand': {
    engine: 'photo', title: 'Sous les cocotiers', how: 'Allongé·e sous les cocotiers, regarde passer la vie : capture les plus beaux moments.', decor: 'sable',
    subjects: [{ name: 'La pirogue au loin', prop: 'pirogue' }, { name: 'Le soleil qui se couche', prop: 'soleil' }, { name: 'Une belle vague', prop: 'vague' }, { name: 'Un oiseau de mer', prop: 'oiseau' }],
  },
  'coco-plage': {
    engine: 'tenir', title: 'La coco bien fraîche', how: 'Aspire l’eau de coco à la paille : tiens, et lâche dans le vert avant de t’étrangler.', decor: 'sable', object: 'noix-coco', verb: 'Aspire', fill: 'liquide',
  },
  'eat-fish': {
    engine: 'assembler', title: 'Le poisson braisé', how: 'La braiseuse monte ton assiette : pose attiéké, poisson, piment, oignon dans l’ordre demandé.', decor: 'table', base: 'assiette',
    parts: [{ name: 'L’attiéké', prop: 'attieke' }, { name: 'Le poisson braisé', prop: 'poisson' }, { name: 'Le piment', prop: 'piment' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'La tomate', prop: 'tomate' }],
  },
  'foot-plage': {
    engine: 'viser', title: 'Foot pieds nus', how: 'Les buts sont deux tongs dans le sable : vise, dose ta frappe et marque.', decor: 'sable', projectile: 'ballon-foot', target: 'but',
  },
  swim: {
    engine: 'course', title: 'Une bonne baignade', how: 'Nage entre les bouées et passe sous les grosses vagues : à Bassam, la mer est forte.', decor: 'eau', mode: 'nage', good: 'bouee', bad: 'vague',
  },

  // The neighbourhood shop
  courses: {
    engine: 'attraper', title: 'Les courses du jour', how: 'Le boutiquier te lance les articles : attrape ceux de ta liste, laisse tomber le reste.', decor: 'comptoir', from: 'carton', into: 'sac',
    good: [{ name: 'Le riz', prop: 'riz' }, { name: 'Le pain', prop: 'pain' }, { name: 'Le savon', prop: 'savon' }, { name: 'Les tomates', prop: 'tomate' }],
    bad: [{ name: 'Les bonbons', prop: 'bonbon' }, { name: 'Le jouet', prop: 'jouet' }],
  },
  credit: {
    engine: 'tenir', title: 'Le crédit pile poil', how: 'La recharge monte sur ton téléphone : lâche pile à 500 F, pas un franc de plus.', decor: 'comptoir', object: 'telephone', verb: 'Recharge', fill: 'liquide', times: 3,
  },
  sucrerie: {
    engine: 'choisir', title: 'Une sucrerie glacée', how: 'Tes petits frères crient ce qu’ils veulent : sors la bonne sucrerie du frigo avant les autres.', decor: 'comptoir', caller: 'Ton petit frère',
    items: [{ name: 'Le soda orange', prop: 'soda' }, { name: 'Le jus de bissap', prop: 'jus' }, { name: 'L’eau en sachet', prop: 'sachet-eau' }, { name: 'La glace', prop: 'glace' }, { name: 'Les bonbons', prop: 'bonbon' }],
  },
  'work:vente': {
    engine: 'repondre', title: 'Conseiller la cliente', how: 'La cliente essaie tenue sur tenue : conseille-la avec sincérité et le sourire.', decor: 'comptoir', npc: 'cliente',
    lines: [
      ['Cette robe me grossit, non ?', ['Un peu, oui.', 'Essayez le bleu, il vous va encore mieux !', 'Tout vous grossit, madame.'], 1],
      ['C’est pour le mariage de ma sœur samedi.', ['Alors il faut le pagne qui brille, vous serez la reine !', 'On s’en fout du mariage.', 'Prenez n’importe quoi.'], 0],
      ['C’est trop cher, faut diminuer !', ['C’est le prix, point.', 'Partez alors.', 'Pour vous je fais un petit geste, et je vous offre le foulard.'], 2],
      ['Vous avez la taille au-dessus ?', ['Je regarde en réserve tout de suite !', 'Non, maigrissez.', 'Débrouillez-vous.'], 0],
    ],
  },

  // The Tour F building site (Plateau)
  'manoeuvre-tour-f': {
    engine: 'equilibre', title: 'Manœuvre sur le chantier', how: 'Pousse la brouette de ciment jusqu’à la grue : garde-la droite, sinon tout se renverse.', decor: 'terre', carry: 'brouette', verb: 'Pousse la brouette', distance: 120,
  },
  'regarder-tour-f': {
    engine: 'photo', title: 'La Tour F qui monte', how: 'La plus haute tour d’Afrique pousse au Plateau : capture les ouvriers et les charges qui montent.', decor: 'terre',
    subjects: [{ name: 'Le casque d’un ouvrier', prop: 'casque-chantier' }, { name: 'Le sac de ciment hissé', prop: 'sac-ciment' }, { name: 'La palette de briques', prop: 'brique' }, { name: 'Un oiseau sur la grue', prop: 'oiseau' }],
  },

  // The cinema
  film: {
    engine: 'photo', title: 'Les scènes cultes', how: 'Le film défile : tape au moment des scènes cultes pour les garder en mémoire.', decor: 'scene',
    subjects: [{ name: 'Le clap du début', prop: 'clap' }, { name: 'Le lion du film', prop: 'lion' }, { name: 'L’avion de la poursuite', prop: 'avion' }, { name: 'La star', prop: 'etoile' }],
  },
  'film-popcorn': {
    engine: 'attraper', title: 'Pop-corn qui saute', how: 'Le pop-corn saute de la machine : remplis ton cornet, laisse tomber les grains cramés.', decor: 'comptoir', from: 'marmite', into: 'popcorn',
    good: [{ name: 'Le pop-corn', prop: 'popcorn' }, { name: 'Le bonbon', prop: 'bonbon' }],
    bad: [{ name: 'Le grain cramé', prop: 'flamme' }],
  },

  // The street, campaigning
  'campagne-terrain': {
    engine: 'repondre', title: 'Faire campagne au quartier', how: 'Les électeurs te posent leurs questions : réponds avec respect et des idées concrètes.', decor: 'bitume', npc: 'electeur',
    lines: [
      ['Vous, les politiciens, vous venez seulement pendant les élections !', ['C’est faux, vous mentez.', 'Je vous donne mon numéro : appelez-moi même après.', 'Votez et taisez-vous.'], 1],
      ['Notre rue est noyée à chaque pluie.', ['On va curer les caniveaux, et je viendrai vérifier.', 'Achetez des bottes.', 'C’est pas mon problème.'], 0],
      ['Et les jeunes, ils vont travailler où ?', ['Partout, il faut chercher.', 'Allez au champ.', 'Formations et petits marchés pour les jeunes du quartier !'], 2],
      ['Je vote pour l’autre candidat, moi.', ['Alors partez.', 'C’est votre droit, merci de m’avoir écouté !', 'Il est nul, lui.'], 1],
    ],
  },
  militer: {
    engine: 'rythme', title: 'Le meeting en musique', how: 'Le cortège chante les slogans : mégaphone, drapeau, sifflet, tape quand la note passe la ligne.', decor: 'bitume', lanes: ['megaphone', 'drapeau', 'sifflet'],
  },

  // The night club
  atalaku: {
    engine: 'viser', title: 'Travailler l’atalaku', how: 'L’atalaku crie ton nom au micro : vise bien et lance tes billets jusqu’à lui.', decor: 'scene', projectile: 'billet', target: 'micro', shots: 5,
  },
  'bouteille-whisky': {
    engine: 'tenir', title: 'Servir la table', how: 'Verse un verre à chacun : tiens, et lâche pile au trait, sans gaspiller une goutte.', decor: 'table', object: 'verre', verb: 'Verse', fill: 'liquide', times: 4,
  },
  'champagne-vip': {
    engine: 'assembler', title: 'Le plateau du carré VIP', how: 'Prépare le plateau qui fait briller la boîte : bouteille, glace, verres, cierges, dans l’ordre.', decor: 'table', base: 'plateau-service',
    parts: [{ name: 'Le seau de glace', prop: 'seau' }, { name: 'La bouteille', prop: 'bouteille' }, { name: 'Les verres', prop: 'verre' }, { name: 'Les cierges magiques', prop: 'etoile' }],
  },
  party: {
    engine: 'rythme', title: 'Jusqu’au petit matin', how: 'Le coupé-décalé ne s’arrête pas : tape les notes sur la ligne jusqu’au lever du soleil.', decor: 'parquet', lanes: ['enceinte', 'djembe', 'ballon-fete'], notes: 40,
  },
  podium: {
    engine: 'rythme', title: 'Le roi du podium', how: 'Tout le club te regarde : enchaîne les pas sur la ligne pour faire crier la foule.', decor: 'scene', lanes: ['chaussure', 'micro', 'note-musique'], tempo: 120,
  },
  slow: {
    engine: 'repondre', title: 'Une danse, s’il te plaît', how: 'Les lumières baissent, le slow commence : invite avec respect et sans forcer.', decor: 'parquet', npc: 'amie',
    lines: [
      ['Tu veux danser avec moi ?', ['Avec plaisir, mais doucement, je marche sur les pieds !', 'Si tu insistes…', 'Non.'], 0],
      ['Tu danses souvent le slow ?', ['Jamais, c’est nul.', 'Seulement quand la chanson est belle comme ça.', 'Tous les soirs avec tout le monde.'], 1],
      ['Je suis un peu fatiguée…', ['On continue quand même !', 'Tant pis pour toi.', 'On va s’asseoir, je t’offre un jus ?'], 2],
    ],
  },
  'tournee-vendredi': {
    engine: 'equilibre', title: 'Champagne pour tous !', how: 'Porte le plateau chargé de bouteilles à travers la boîte bondée : rien ne doit tomber.', decor: 'parquet', carry: 'plateau-service', verb: 'Porte le plateau', distance: 140,
  },
  'work:ambiance': {
    engine: 'choisir', title: 'Aux platines', how: 'La foule réclame un son : lance le bon instrument avant que la piste se vide.', decor: 'scene', caller: 'La foule',
    items: [{ name: 'Le balafon', prop: 'balafon' }, { name: 'Le djembé', prop: 'djembe' }, { name: 'La guitare', prop: 'guitare' }, { name: 'Le micro pour la dédicace', prop: 'micro' }, { name: 'Les basses', prop: 'enceinte' }, { name: 'Le scratch', prop: 'platine' }],
  },

  // The tailor's
  'coudre-pagne': {
    engine: 'assembler', title: 'Ta tenue en pagne', how: 'Le couturier monte ta tenue : coupe, fil, machine, repassage, dans l’ordre qu’il te dit.', decor: 'table', base: 'pagne',
    parts: [{ name: 'Couper le tissu', prop: 'ciseaux' }, { name: 'Enfiler la bobine', prop: 'bobine' }, { name: 'Coudre à la machine', prop: 'machine-a-coudre' }, { name: 'Repasser', prop: 'fer-a-repasser' }],
  },
  retouche: {
    engine: 'tenir', title: 'La petite retouche', how: 'Appuie sur la pédale pour coudre l’ourlet : lâche pile au bout, sans dépasser.', decor: 'table', object: 'machine-a-coudre', verb: 'Couds', fill: 'tissu',
  },

  // Culture: concerts, shows, museum
  'concert-anoumabo': {
    engine: 'rythme', title: 'Concert à Anoumabo', how: 'Balafon, djembé, guitare : suis le groupe et tape chaque note sur la ligne.', decor: 'scene', lanes: ['balafon', 'djembe', 'guitare'],
  },
  exposition: {
    engine: 'photo', title: 'L’expo du moment', how: 'Les œuvres défilent sous tes yeux : garde en photo celles qui te parlent.', decor: 'parquet',
    subjects: [{ name: 'La grande toile', prop: 'tableau' }, { name: 'La sculpture en bois', prop: 'statue' }, { name: 'Le masque', prop: 'masque' }, { name: 'L’affiche de l’expo', prop: 'affiche' }],
  },
  spectacle: {
    engine: 'repondre', title: 'Le one-man-show', how: 'L’humoriste descend dans la salle et te parle : réponds pour faire rire tout le monde.', decor: 'scene', npc: 'ami',
    lines: [
      ['Toi là, tu viens d’où ?', ['De Yop City, la cité de la joie !', 'Ça te regarde pas.', 'De nulle part.'], 0],
      ['Tu as payé ton ticket ou bien tu es passé par la fenêtre ?', ['Par la fenêtre.', 'J’ai payé, mais je veux la monnaie en rires !', 'Laisse-moi.'], 1],
      ['Il fait chaud ici, c’est toi qui chauffes comme ça ?', ['Non.', 'Arrête.', 'C’est ton spectacle qui est trop chaud !'], 2],
    ],
  },
  'visite-guidee': {
    engine: 'quiz', title: 'Abidjan, la visite', how: 'Le guide te fait découvrir la ville : réponds juste à ses questions.', decor: 'bitume', host: 'guide',
    questions: [
      ['Abidjan est bâtie autour de quelle lagune ?', ['La lagune Aby', 'La lagune Ébrié', 'La lagune de Fresco'], 1],
      ['Le quartier des tours et des bureaux, c’est…', ['Le Plateau', 'Abobo', 'Port-Bouët'], 0],
      ['La forêt en pleine ville, c’est…', ['Le mont Nimba', 'La forêt de Taï', 'Le parc du Banco'], 2],
      ['Quelle ville, ancienne capitale, est classée à l’UNESCO ?', ['San-Pédro', 'Grand-Bassam', 'Korhogo'], 1],
      ['La capitale politique du pays ?', ['Yamoussoukro', 'Bouaké', 'Daloa'], 0],
    ],
  },
  'visite-musee': {
    engine: 'choisir', title: 'Les trésors du musée', how: 'Le guide raconte une œuvre : touche celle dont il parle avant le groupe d’écoliers.', decor: 'parquet', caller: 'Le guide',
    items: [{ name: 'Le masque dan', prop: 'masque' }, { name: 'La statue baoulé', prop: 'statue' }, { name: 'Le balafon sénoufo', prop: 'balafon' }, { name: 'Le tam-tam parleur', prop: 'tam-tam' }, { name: 'La calebasse gravée', prop: 'calebasse' }],
  },

  // The gaming room
  'regarder-console': {
    engine: 'repondre', title: 'Le consultant du canapé', how: 'Ton pote joue à la console et tu commentes : encourage sans le saboter.', decor: 'parquet', npc: 'ami',
    lines: [
      ['Il vient de m’égaliser à la dernière minute !', ['Tu es nul.', 'Respire, la prolongation est pour toi !', 'Donne la manette, je vais jouer.'], 1],
      ['Je fais quelle équipe, à ton avis ?', ['Les Éléphants, toujours !', 'Peu importe, tu vas perdre.', 'Je sais pas.'], 0],
      ['J’ai perdu… encore.', ['Normal.', 'Je vais le dire à tout le quartier.', 'La revanche, on la gagne ensemble !'], 2],
    ],
  },

  // The gym
  'abonnement-salle': {
    engine: 'repondre', title: 'L’abonnement du mois', how: 'L’accueil te présente la salle : réponds bien pour repartir avec ta carte.', decor: 'parquet', npc: 'agent',
    lines: [
      ['Bonjour ! C’est pour un abonnement ?', ['Oui, pour le mois, je suis motivé·e !', 'Non, je passais.', 'C’est gratuit ?'], 0],
      ['Vous venez plutôt matin ou soir ?', ['Jamais.', 'Le soir, après le boulot.', 'Quand il pleut.'], 1],
      ['Pensez à apporter votre serviette, hein.', ['J’utiliserai celle du voisin.', 'Pourquoi ?', 'Promis, et ma bouteille d’eau aussi !'], 2],
    ],
  },
  'boxe-sac': {
    engine: 'rythme', title: 'Le sac de frappe', how: 'Poing, pied, sifflet du coach : frappe chaque coup pile quand il passe la ligne.', decor: 'parquet', lanes: ['cible', 'chaussure', 'sifflet'], tempo: 110,
  },
  cardio: {
    engine: 'course', title: 'Tapis et vélo', how: 'Pédale à fond : attrape les cœurs pour le souffle, évite les burgers qui alourdissent.', decor: 'parquet', mode: 'velo', good: 'coeur', bad: 'burger',
  },
  'corde-a-sauter': {
    engine: 'tenir', title: 'Corde à sauter', how: 'La corde tourne : tiens pour prendre l’élan, lâche dans le vert pour sauter au bon moment.', decor: 'parquet', object: 'corde', verb: 'Saute', fill: 'force', times: 6,
  },
  'cours-collectif': {
    engine: 'rythme', title: 'Zumba collective', how: 'Le coach lance la musique : suis les pas avec tout le groupe, note après note.', decor: 'parquet', lanes: ['tapis-yoga', 'note-musique', 'sifflet'],
  },
  'douche-vestiaire': {
    engine: 'nettoyer', title: 'La douche du vestiaire', how: 'Après l’effort, la mousse partout : rince chaque bulle de savon.', decor: 'carrelage', object: 'serviette', bit: 'mousse', verb: 'Rince',
  },
  musculation: {
    engine: 'tenir', title: 'Développé couché', how: 'Pousse l’haltère : tiens l’effort et relâche dans le vert, série après série.', decor: 'parquet', object: 'haltere', verb: 'Pousse', fill: 'force', times: 5,
  },
  tractions: {
    engine: 'equilibre', title: 'Tractions à la barre', how: 'Monte à la barre sans te balancer : garde le corps bien droit jusqu’en haut.', decor: 'parquet', carry: 'haltere', verb: 'Monte', distance: 80,
  },

  // Happenings in the street
  'label:Aider à déboucher le caniveau': {
    engine: 'nettoyer', title: 'Le caniveau bouché', how: 'Avant la pluie, tout le quartier s’y met : retire chaque feuille qui bouche le caniveau.', decor: 'bitume', object: 'pelle', bit: 'feuille', verb: 'Retire',
  },
  'label:Aller au concert du FEMUA': {
    engine: 'attraper', title: 'La folie du FEMUA', how: 'Les artistes lancent des souvenirs à la foule : attrape-les, laisse filer les sachets d’eau.', decor: 'scene', from: 'micro', into: 'sac',
    good: [{ name: 'La casquette de l’artiste', prop: 'casquette' }, { name: 'La serviette de scène', prop: 'serviette' }, { name: 'Le ticket VIP', prop: 'ticket' }],
    bad: [{ name: 'Le sachet d’eau', prop: 'sachet-eau' }],
  },
  'label:Aller au stade': {
    engine: 'photo', title: 'Un soir au stade', how: 'Allez les Éléphants ! Capture les grands moments du match depuis les tribunes.', decor: 'herbe',
    subjects: [{ name: 'Le ballon au fond des filets', prop: 'ballon-foot' }, { name: 'Les drapeaux orange-blanc-vert', prop: 'drapeau' }, { name: 'L’arbitre qui siffle', prop: 'sifflet' }, { name: 'Le trophée', prop: 'trophee' }],
  },
  'label:Aller danser': {
    engine: 'rythme', title: 'Sur la piste', how: 'Le son est lancé : enchaîne les pas sur la ligne pour enflammer la piste.', decor: 'parquet', lanes: ['chaussure', 'note-musique', 'coeur'],
  },
  'label:Assister à la réunion et cotiser': {
    engine: 'repondre', title: 'La réunion du quartier', how: 'La présidente de l’association parle : participe avec sagesse et bonne humeur.', decor: 'terre', npc: 'maman',
    lines: [
      ['Qui n’a pas encore cotisé pour les lampadaires ?', ['Moi, voilà ma part !', 'Pas moi, je suis pas concerné.', 'Les lampadaires c’est inutile.'], 0],
      ['On fait quoi pour les ordures du marché ?', ['Rien.', 'Un samedi de salubrité tous ensemble !', 'On les jette chez le voisin.'], 1],
      ['La réunion a commencé avec une heure de retard…', ['C’est la faute à la présidente.', 'Je m’en vais.', 'L’heure ivoirienne, mais on est là, c’est l’essentiel !'], 2],
    ],
  },
  'label:Causer avec les voisins à la lampe': {
    engine: 'quiz', title: 'Devinettes à la lampe', how: 'Le vieux du quartier lance ses devinettes à la lumière de la lampe : trouve la réponse.', decor: 'terre', host: 'vieux',
    questions: [
      ['J’ai des dents mais je ne mange jamais. Qui suis-je ?', ['Le peigne', 'Le chien', 'Le bébé'], 0],
      ['Plus on m’enlève de terre, plus je deviens grand.', ['Le pagne', 'Le trou', 'Le riz'], 1],
      ['Je cours toujours, mais je n’ai pas de jambes.', ['Le gbaka', 'Le margouillat', 'La rivière'], 2],
      ['Qu’est-ce qui monte et ne descend jamais ?', ['L’âge', 'Le cerf-volant', 'Le prix du garba'], 0],
    ],
  },
  'label:Chanter « Joyeux anniversaire »': {
    engine: 'rythme', title: 'Joyeux anniversaire !', how: 'Tout le monde chante autour du gâteau : tape chaque note pile pour ne pas chanter faux.', decor: 'table', lanes: ['gateau', 'bougie', 'ballon-fete'], tempo: 90,
  },
  'label:Cotiser à la tontine': {
    engine: 'choisir', title: 'Le jour de la tontine', how: 'La présidente réclame chaque chose : tends-lui la bonne avant les autres membres.', decor: 'table', caller: 'La présidente',
    items: [{ name: 'Le billet de 10 000', prop: 'billet' }, { name: 'La pièce de 500', prop: 'piece' }, { name: 'Le cahier de la tontine', prop: 'cahier' }, { name: 'Le stylo', prop: 'stylo' }, { name: 'La calculatrice', prop: 'calculatrice' }],
  },
  'label:Danser avec la foule': {
    engine: 'rythme', title: 'La foule danse', how: 'Les tam-tams appellent tout le quartier : suis le rythme du djembé au balafon.', decor: 'terre', lanes: ['djembe', 'tam-tam', 'balafon'],
  },
  'label:Danser avec le cortège': {
    engine: 'equilibre', title: 'Le cortège qui danse', how: 'Danse avec la calebasse sur la tête comme les mamans du cortège : elle ne doit pas tomber.', decor: 'bitume', carry: 'calebasse', verb: 'Danse', distance: 100,
  },
  'label:Donner un coup de main': {
    engine: 'nettoyer', title: 'Un coup de main', how: 'La cour est poussiéreuse après la fête : balaie chaque tas de poussière.', decor: 'terre', object: 'tapis', bit: 'poussiere', verb: 'Balaie',
  },
  'label:Faire la tournée des vœux': {
    engine: 'repondre', title: 'La tournée des vœux', how: 'De porte en porte, on présente ses vœux : trouve les mots qui font sourire les aînés.', decor: 'terre', npc: 'vieux',
    lines: [
      ['Ah, mon enfant, tu es venu me saluer ?', ['Bonne année, papa ! Santé, longue vie et prospérité !', 'Oui, tu me donnes combien ?', 'Je passais seulement.'], 0],
      ['Et toi, qu’est-ce que tu souhaites cette année ?', ['Rien.', 'Que la famille reste unie, et un bon travail !', 'Ton argent.'], 1],
      ['Prends un peu de gâteau avant de partir.', ['C’est sec.', 'Non merci, je suis pressé.', 'Merci, papa, que Dieu te bénisse !'], 2],
    ],
  },
  'label:Féliciter les parents': {
    engine: 'assembler', title: 'Le panier du bébé', how: 'Prépare le cadeau de naissance pour les parents : pose chaque chose dans l’ordre.', decor: 'table', base: 'carton',
    parts: [{ name: 'Le pagne pour la maman', prop: 'pagne' }, { name: 'Le biberon', prop: 'biberon' }, { name: 'Le savon du bébé', prop: 'savon' }, { name: 'La peluche', prop: 'peluche' }],
  },
  'label:Fêter avec le quartier': {
    engine: 'photo', title: 'La fête au quartier', how: 'Musique, drapeaux, ballons : prends en photo les meilleurs moments de la fête.', decor: 'bitume',
    subjects: [{ name: 'Les drapeaux', prop: 'drapeau' }, { name: 'Les ballons', prop: 'ballon-fete' }, { name: 'Le djembé', prop: 'djembe' }, { name: 'Les pétards de joie', prop: 'etoile' }],
  },
  'label:Jouer avec eux': {
    engine: 'course', title: 'Attrape-moi si tu peux', how: 'Les enfants jouent à la poursuite : cours, ramasse les jouets, saute les cailloux.', decor: 'terre', mode: 'pied', good: 'jouet', bad: 'caillou',
  },
  'label:Jouer un match': {
    engine: 'viser', title: 'Le match du quartier', how: 'Deux briques pour poteaux : vise le coin, dose ta frappe et marque pour ton équipe.', decor: 'terre', projectile: 'ballon-foot', target: 'but',
  },
  'label:Montrer ses papiers': {
    engine: 'choisir', title: 'Contrôle de routine', how: 'Le policier te demande tes papiers un par un : tends le bon, sans t’énerver.', decor: 'bitume', caller: 'Le policier',
    items: [{ name: 'La carte d’identité', prop: 'badge' }, { name: 'Le passeport', prop: 'passeport' }, { name: 'Le ticket du gbaka', prop: 'ticket' }, { name: 'Le téléphone', prop: 'telephone' }, { name: 'Les clés', prop: 'cle' }],
  },
  'label:Offrir des bonbons aux enfants': {
    engine: 'choisir', title: 'Les bonbons du quartier', how: 'Chaque enfant crie ce qu’il veut : donne-lui la bonne douceur avant qu’il pleure.', decor: 'terre', caller: 'Les enfants',
    items: [{ name: 'Le bonbon', prop: 'bonbon' }, { name: 'La glace', prop: 'glace' }, { name: 'Le ballon', prop: 'ballon-fete' }, { name: 'Le gâteau', prop: 'gateau' }, { name: 'Le jus', prop: 'jus' }],
  },
  'label:Partager le repas de fête': {
    engine: 'assembler', title: 'Le plat de fête', how: 'Les tanties servent : monte chaque assiette dans l’ordre réclamé par les invités.', decor: 'table', base: 'assiette',
    parts: [{ name: 'Le riz', prop: 'riz' }, { name: 'Le poulet', prop: 'poulet' }, { name: 'L’alloco', prop: 'alloco' }, { name: 'L’attiéké', prop: 'attieke' }, { name: 'Le piment', prop: 'piment' }],
  },
  'label:Partager un moment avec les voisins': {
    engine: 'repondre', title: 'Entre voisins', how: 'La voisine t’invite à t’asseoir dans la cour : réponds chaleureusement.', decor: 'terre', npc: 'maman',
    lines: [
      ['Assieds-toi, je t’offre un thé ?', ['Avec plaisir, tantie, merci !', 'Pas le temps.', 'Il est sucré au moins ?'], 0],
      ['Ma fille passe le BAC cette année…', ['Elle va rater.', 'Elle va réussir, on va prier pour elle !', 'Et alors ?'], 1],
      ['Le courant a encore coupé hier soir !', ['C’est de ta faute.', 'Tant mieux.', 'On a causé à la lampe, c’était sympa quand même !'], 2],
    ],
  },
  'label:Passer voir les promos': {
    engine: 'attraper', title: 'La chasse aux promos', how: 'Les articles en promo tombent des rayons : attrape les bonnes affaires, laisse les prix gonflés.', decor: 'etagere', from: 'carton', into: 'chariot',
    good: [{ name: 'Le sac de riz en promo', prop: 'riz' }, { name: 'Le savon à moitié prix', prop: 'savon' }, { name: 'Les chaussures soldées', prop: 'chaussure' }, { name: 'Le sac soldé', prop: 'sac' }],
    bad: [{ name: 'Le prix gonflé', prop: 'ticket' }],
  },
}
