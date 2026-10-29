import type { Jeu } from '../types'

// The tasks of a work shift (backend jobs.go): each button of the job, its own little game, keyed task:<career>:<task>.
export const JEUX_TASKS: Record<string, Jeu> = {
  // Bureau: the office
  'task:bureau:mails': {
    engine: 'attraper', title: 'La boîte de réception', how: 'Les mails tombent : attrape ceux des clients, laisse filer les spams et les arnaques.', decor: 'bureau', from: 'ordinateur', into: 'dossier', count: 8,
    good: [{ name: 'Le mail du client', prop: 'telephone' }, { name: 'La facture', prop: 'billet' }, { name: 'Le rapport', prop: 'cahier' }],
    bad: [{ name: 'La pub Promo-Choc', prop: 'affiche' }, { name: 'Le faux gros lot', prop: 'trophee' }],
  },
  'task:bureau:client': {
    engine: 'quiz', title: 'Appeler le client', how: 'Le client pose ses questions sur la commande : donne-lui la bonne réponse, vite.', decor: 'bureau', host: 'client',
    questions: [
      ['J’ai commandé 40 cartons, vous en livrez 25. Il en manque ?', ['10', '15', '20'], 1],
      ['La livraison part lundi, trois jours de route. Elle arrive ?', ['Jeudi', 'Mercredi', 'Vendredi'], 0],
      ['Un carton à 5 000 F, j’en prends 6. Ça fait ?', ['25 000 F', '35 000 F', '30 000 F'], 2],
    ],
  },
  'task:bureau:reunion': {
    engine: 'assembler', title: 'Animer la réunion', how: 'Le chef veut la réunion dans l’ordre qu’il dit : déroule chaque point à son tour.', decor: 'bureau', base: 'ecran', orders: 2,
    parts: [{ name: 'Le café d’accueil', prop: 'cafe' }, { name: 'L’ordre du jour', prop: 'cahier' }, { name: 'Les chiffres', prop: 'calculatrice' }, { name: 'La présentation', prop: 'ordinateur' }, { name: 'Les questions', prop: 'micro' }],
  },
  'task:bureau:signer': {
    engine: 'tenir', title: 'Le contrat de l’année', how: 'Tiens pour tracer ta signature d’un seul geste, et lâche pile dans le vert.', decor: 'bureau', object: 'stylo', verb: 'Signe', fill: 'force', times: 3,
  },

  // Maquis: the open-air restaurant
  'task:maquis:servir': {
    engine: 'equilibre', title: 'Servir la table', how: 'Garba, alloco, bière glacée sur le plateau : porte-le droit jusqu’à la table du fond.', decor: 'carrelage', carry: 'plateau-service', verb: 'Sers', distance: 12,
  },
  'task:maquis:garba': {
    engine: 'tenir', title: 'Frire le thon', how: 'Le thon grésille dans l’huile : tiens et sors-le pile dans le vert, bien doré.', decor: 'comptoir', object: 'poele', verb: 'Fris', fill: 'chaleur', times: 3,
  },
  'task:maquis:addition': {
    engine: 'choisir', title: 'Encaisser l’addition', how: 'Le client dit comment il paie : touche le bon moyen avant qu’il s’impatiente.', decor: 'table', caller: 'Le client', rounds: 2,
    items: [{ name: 'Le billet', prop: 'billet' }, { name: 'La monnaie', prop: 'piece' }, { name: 'La carte', prop: 'carte-bancaire' }, { name: 'Waye sur le téléphone', prop: 'telephone' }, { name: 'L’addition', prop: 'ticket' }],
  },

  // Commerce: the market stall
  'task:commerce:heler': {
    engine: 'rythme', title: 'Héler les clientes', how: '« Ma chérie, viens voir ! » Lance ton cri, tes tomates, tes piments, pile sur la ligne.', decor: 'etal', lanes: ['megaphone', 'tomate', 'piment'], notes: 12,
  },
  'task:commerce:marchander': {
    engine: 'repondre', title: 'Tenir son prix', how: 'La cliente veut payer moitié prix : tiens bon, avec le sourire, sans la vexer.', decor: 'etal', npc: 'cliente',
    lines: [
      ['Tes tomates là, c’est combien ?', ['Le tas à 500 F, ma chérie, regarde comme elles sont belles.', 'Achète ou pars.', 'Je sais pas, fais ton prix.'], 0],
      ['Eh ! C’est trop cher. 250 F ?', ['D’accord, prends tout gratuit.', 'Non, tu m’insultes !', 'Ma sœur, mets 400 F, je t’ajoute un piment.'], 2],
      ['Bon, 400 F mais tu me fais cadeau.', ['Jamais de cadeau ici.', 'Tiens, un oignon en plus. Reviens me voir !', 'Ok, 200 F alors.'], 1],
    ],
  },
  'task:commerce:etal': {
    engine: 'attraper', title: 'Vider le cageot', how: 'Vide le cageot sur l’étal : attrape les légumes, laisse tomber cailloux et feuilles.', decor: 'etal', from: 'carton', into: 'plateau-service', count: 8,
    good: [{ name: 'La tomate', prop: 'tomate' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'Le piment', prop: 'piment' }, { name: 'La mangue', prop: 'mangue' }],
    bad: [{ name: 'Le caillou', prop: 'caillou' }, { name: 'La feuille fanée', prop: 'feuille' }],
  },

  // Transport: the gbaka and the woro-woro
  'task:transport:crier': {
    engine: 'rythme', title: '« Adjamé ! Adjamé ! »', how: 'Crie la destination plus fort que l’apprenti d’en face : tape pile sur la ligne.', decor: 'bitume', lanes: ['megaphone', 'sifflet', 'piece'], notes: 12,
  },
  'task:transport:encaisser': {
    engine: 'quiz', title: 'Rendre la monnaie', how: 'Les passagers paient leur place : calcule vite la monnaie, le gbaka démarre.', decor: 'bitume', host: 'client',
    questions: [
      ['On est trois, la place est à 300 F. Ça fait ?', ['900 F', '600 F', '1 200 F'], 0],
      ['Je te donne 1 000 F pour une place à 300 F.', ['600 F', '700 F', '800 F'], 1],
      ['Deux places à 250 F, voilà 1 000 F.', ['250 F', '750 F', '500 F'], 2],
    ],
  },
  'task:transport:plein': {
    engine: 'tenir', title: 'Faire le plein', how: 'Tiens le pistolet pour remplir le réservoir, et lâche pile avant que ça déborde.', decor: 'bitume', object: 'essence', verb: 'Remplis', fill: 'liquide', times: 3,
  },

  // Ambiance: the DJ, the animateur
  'task:ambiance:son': {
    engine: 'rythme', title: 'Le son du moment', how: 'Lance le son qui fait exploser la piste : platine, enceinte, note, pile sur la ligne.', decor: 'scene', lanes: ['platine', 'enceinte', 'note-musique'], notes: 12,
  },
  'task:ambiance:foule': {
    engine: 'tenir', title: '« Vous êtes là ? »', how: 'Tiens le micro pour faire monter le cri de la foule, et coupe pile dans le vert.', decor: 'scene', object: 'micro', verb: 'Chauffe', fill: 'force', times: 3,
  },
  'task:ambiance:dedicace': {
    engine: 'repondre', title: 'La dédicace', how: 'Le grand patron veut son nom au micro : trouve la dédicace qui le fait lancer des billets.', decor: 'scene', npc: 'client',
    lines: [
      ['Eh DJ ! Cite mon nom, c’est Patron Konan !', ['Dédicace au grand Patron Konan, l’homme qui ne dort pas !', 'C’est qui ça ?', 'Paie d’abord.'], 0],
      ['Dis aussi que je suis de Yopougon !', ['Yopougon, c’est loin hein.', 'Yopougon est dans la place, avec Patron Konan !', 'Plus tard, je suis occupé.'], 1],
      ['Et ma chérie là, à la table 4 ?', ['Elle est où ?', 'Je connais pas son nom.', 'Pour la reine de la table 4, son homme l’aime trop !'], 2],
    ],
  },

  // Mairie: the town hall
  'task:mairie:usager': {
    engine: 'quiz', title: 'Recevoir l’usager', how: 'Le vieux demande quels papiers fournir : explique-lui juste, avec patience.', decor: 'bureau', host: 'vieux',
    questions: [
      ['Pour l’extrait de naissance de mon petit-fils, il faut quoi ?', ['Sa photo de classe', 'Le numéro de l’acte', 'Son bulletin de notes'], 1],
      ['On le retire où, l’extrait ?', ['À l’état civil', 'À la voirie', 'Au marché'], 0],
      ['Et pour la légalisation d’un papier ?', ['Rien, c’est automatique', 'Un ticket de cinéma', 'L’original et la copie'], 2],
    ],
  },
  'task:mairie:orienter': {
    engine: 'course', title: 'Le bon bureau', how: 'Guide la dame perdue jusqu’à l’état civil : ramasse ses papiers, évite les seaux du ménage.', decor: 'carrelage', mode: 'pied', good: 'dossier', bad: 'seau', target: 8,
  },
  'task:mairie:acte': {
    engine: 'assembler', title: 'L’acte de naissance', how: 'Établis l’acte dans l’ordre dicté : registre, formulaire, signature, tampon…', decor: 'bureau', base: 'dossier', orders: 2,
    parts: [{ name: 'Le registre', prop: 'livre' }, { name: 'Le formulaire', prop: 'cahier' }, { name: 'La signature', prop: 'stylo' }, { name: 'Le tampon', prop: 'tampon' }, { name: 'Le timbre', prop: 'ticket' }],
  },
  'task:mairie:mariage': {
    engine: 'repondre', title: 'Célébrer le mariage', how: 'Les mariés sont devant toi, la famille attend : dis les bons mots, solennels et joyeux.', decor: 'parquet', npc: 'amie',
    lines: [
      ['Monsieur le maire, on peut commencer ?', ['Bienvenue à vous et à vos familles. Nous sommes réunis pour vous unir.', 'Attendez, je mange.', 'Vous êtes sûrs de vous ?'], 0],
      ['Oui, je le veux !', ['Bon, ok.', 'Et lui, il veut ou bien ?', 'Je vous déclare unis par les liens du mariage !'], 2],
      ['Merci ! On peut signer maintenant ?', ['Plus tard, revenez lundi.', 'Bien sûr : les mariés, puis les témoins. Félicitations !', 'Signez où vous voulez.'], 1],
    ],
  },

  // Enseignement: the school
  'task:enseignement:cours': {
    engine: 'quiz', title: 'Au tableau', how: 'Tu fais la leçon : l’élève au tableau hésite, montre-lui la bonne réponse.', decor: 'bureau', host: 'enfant',
    questions: [
      ['Maître, 9 × 7, ça fait combien ?', ['63', '56', '72'], 0],
      ['Le plus grand port du pays, c’est où ?', ['Bouaké', 'Abidjan', 'Korhogo'], 1],
      ['Un verbe, c’est lequel ?', ['Table', 'Joli', 'Courir'], 2],
    ],
  },
  'task:enseignement:copies': {
    engine: 'nettoyer', title: 'Le stylo rouge', how: 'La pile de copies t’attend : touche chaque faute pour la corriger, jusqu’à la dernière.', decor: 'bureau', object: 'cahier', bit: 'tache', verb: 'Corrige', count: 8,
  },
  'task:enseignement:recre': {
    engine: 'course', title: 'La récréation', how: 'Fais le tour de la cour : récupère les ballons perdus, évite les cailloux.', decor: 'terre', mode: 'pied', good: 'ballon-foot', bad: 'caillou', target: 8,
  },

  // Coiffure: the barber, the braider
  'task:coiffure:degrade': {
    engine: 'tenir', title: 'Le contour net', how: 'Tiens la tondeuse le long du contour, et lâche pile au bout pour un trait parfait.', decor: 'carrelage', object: 'rasoir', verb: 'Passe', fill: 'tissu', times: 3,
  },
  'task:coiffure:tresses': {
    engine: 'rythme', title: 'Les nattes', how: 'Mèche, peigne, bigoudi : tresse au rythme de la radio, pile sur la ligne.', decor: 'carrelage', lanes: ['meche', 'peigne', 'bigoudi'], notes: 12,
  },
  'task:coiffure:conseil': {
    engine: 'repondre', title: 'Conseiller une coupe', how: 'La cliente hésite devant le miroir : propose-lui la coiffure qui lui va.', decor: 'carrelage', npc: 'cliente',
    lines: [
      ['Je vais à un mariage samedi. Je fais quoi ?', ['Des tresses fines relevées, ça va te rendre élégante.', 'Rase tout.', 'Fais comme tu veux.'], 0],
      ['Mais les tresses, ça fait mal non ?', ['Oui, beaucoup.', 'Je serre doucement, tu vas rien sentir.', 'C’est pas mon problème.'], 1],
      ['Ok, mais pas trop longues hein.', ['Non, jusqu’aux pieds.', 'Longues, c’est mieux.', 'D’accord, aux épaules : parfait avec ta robe.'], 2],
    ],
  },

  // Santé: the clinic
  'task:sante:tension': {
    engine: 'repondre', title: 'Rassurer le patient', how: 'Tu lis la tension, le patient s’inquiète : explique-lui calmement, conseille-le.', decor: 'carrelage', npc: 'patient',
    lines: [
      ['Alors, ma tension, c’est grave ?', ['12/8 : c’est normal, tout va bien.', 'Je sais pas lire ça.', 'Tu vas mourir.'], 0],
      ['Et mon frère, il a 16. C’est beaucoup ?', ['Non, c’est rien.', 'C’est un peu haut : moins de sel, et qu’il voie le médecin.', 'Qu’il mange plus de cube.'], 1],
      ['Je dois revenir quand ?', ['Jamais.', 'Quand tu veux, ça change rien.', 'Dans un mois, pour vérifier. Bonne journée !'], 2],
    ],
  },
  'task:sante:piqure': {
    engine: 'equilibre', title: 'Sans douleur', how: 'Le petit te regarde : garde la main bien stable jusqu’au bout, il ne pleurera pas.', decor: 'carrelage', carry: 'seringue', verb: 'Garde la main stable', distance: 12,
  },
  'task:sante:consulter': {
    engine: 'quiz', title: 'Le bon diagnostic', how: 'Le patient raconte ce qu’il ressent : trouve ce qu’il a, et la bonne suite.', decor: 'carrelage', host: 'patient',
    questions: [
      ['Fièvre, frissons, mal de tête depuis la pluie et les moustiques.', ['Une entorse', 'Le palu, on fait le test', 'Une carie'], 1],
      ['Je tousse, le nez coule, un peu de fièvre.', ['Un rhume : repos et beaucoup d’eau', 'Une fracture', 'On opère'], 0],
      ['J’ai mangé un garba douteux, mon ventre tourne.', ['Courir 10 km', 'Encore un garba', 'Boire, sels de réhydratation'], 2],
    ],
  },

  // Caisse: the supermarket checkout
  'task:caisse:encaisser': {
    engine: 'rythme', title: 'Bip, bip, bip', how: 'Le chariot est plein : scanne, tape la caisse, passe la carte, pile sur la ligne.', decor: 'comptoir', lanes: ['scanner', 'caisse-enregistreuse', 'carte-bancaire'], notes: 12,
  },
  'task:caisse:monnaie': {
    engine: 'quiz', title: 'Au franc près', how: 'Le client te tend son billet : trouve la monnaie juste, au franc près.', decor: 'comptoir', host: 'cliente',
    questions: [
      ['Ça fait 3 750 F, voilà 5 000 F.', ['1 250 F', '1 750 F', '2 250 F'], 0],
      ['8 400 F, je te donne 10 000 F.', ['2 600 F', '1 600 F', '1 400 F'], 1],
      ['12 300 F, voilà deux billets de 10 000 F.', ['8 300 F', '6 700 F', '7 700 F'], 2],
    ],
  },
  'task:caisse:cloture': {
    engine: 'attraper', title: 'La clôture de caisse', how: 'Vide le tiroir pour compter : attrape billets et pièces, laisse tomber tickets et bonbons.', decor: 'comptoir', from: 'caisse-enregistreuse', into: 'sac', count: 8,
    good: [{ name: 'Le billet', prop: 'billet' }, { name: 'La pièce', prop: 'piece' }],
    bad: [{ name: 'Le vieux ticket', prop: 'ticket' }, { name: 'Le bonbon', prop: 'bonbon' }],
  },

  // Vente: the clothes shop
  'task:vente:conseiller': {
    engine: 'choisir', title: 'La tenue du mariage', how: 'Le client prépare un mariage : tends-lui ce qu’il demande avant qu’il change d’avis.', decor: 'comptoir', caller: 'Le client', rounds: 2,
    items: [{ name: 'La chemise en wax', prop: 'chemise' }, { name: 'Le grand boubou', prop: 'boubou' }, { name: 'Les chaussures', prop: 'chaussure' }, { name: 'La montre', prop: 'montre' }, { name: 'Le parfum', prop: 'parfum' }],
  },
  'task:vente:essayage': {
    engine: 'assembler', title: 'La cabine d’essayage', how: 'La cliente essaie une tenue : passe-lui chaque pièce dans l’ordre qu’elle demande.', decor: 'carrelage', base: 'miroir', orders: 2,
    parts: [{ name: 'Le pagne', prop: 'pagne' }, { name: 'La robe', prop: 'robe' }, { name: 'Le collier', prop: 'collier' }, { name: 'Le sac', prop: 'sac' }, { name: 'Les lunettes', prop: 'lunettes' }],
  },
  'task:vente:rayons': {
    engine: 'attraper', title: 'La nouvelle collection', how: 'Déballe le carton : attrape les tenues pour les rayons, laisse tomber les emballages.', decor: 'carrelage', from: 'carton', into: 'chariot', count: 8,
    good: [{ name: 'La chemise', prop: 'chemise' }, { name: 'La robe', prop: 'robe' }, { name: 'Le pagne', prop: 'pagne' }, { name: 'La casquette', prop: 'casquette' }],
    bad: [{ name: 'Le papier d’emballage', prop: 'journal' }, { name: 'La poussière', prop: 'poussiere' }],
  },

  // Hôtellerie: the hotel front desk
  'task:hotellerie:accueil': {
    engine: 'repondre', title: 'Bienvenue à l’hôtel', how: 'Un touriste arrive, fatigué et exigeant : accueille-le avec le sourire.', decor: 'carrelage', npc: 'touriste',
    lines: [
      ['Bonsoir, j’ai réservé au nom de Martin.', ['Bienvenue, monsieur Martin ! Votre chambre est prête.', 'Martin qui ?', 'On est fermés.'], 0],
      ['Le vol était long, je suis épuisé.', ['C’est pas mon problème.', 'Je comprends : un jus de bissap offert vous attend.', 'Moi aussi, je suis fatigué.'], 1],
      ['Le petit-déjeuner, c’est à quelle heure ?', ['Je sais pas.', 'Quand le cuisinier se réveille.', 'De 6 h à 10 h, au bord de la piscine.'], 2],
    ],
  },
  'task:hotellerie:cles': {
    engine: 'choisir', title: 'Remettre les clés', how: 'Le client demande ce qu’il lui faut pour sa chambre : tends-le-lui, vite et bien.', decor: 'comptoir', caller: 'Le client', rounds: 2,
    items: [{ name: 'La clé de la 214', prop: 'cle' }, { name: 'Le badge', prop: 'badge' }, { name: 'Le code du wifi', prop: 'ticket' }, { name: 'Le journal du jour', prop: 'journal' }, { name: 'La serviette de plage', prop: 'serviette' }],
  },
  'task:hotellerie:bagages': {
    engine: 'assembler', title: 'Charger le chariot', how: 'Le taxi décharge : charge le chariot dans l’ordre que le client te dit.', decor: 'carrelage', base: 'chariot', orders: 2,
    parts: [{ name: 'La grosse valise', prop: 'valise' }, { name: 'Le sac de voyage', prop: 'sac' }, { name: 'Le colis', prop: 'colis' }, { name: 'Le carton de souvenirs', prop: 'carton' }, { name: 'Le chapeau', prop: 'casquette' }],
  },

  // Droit: the law firm
  'task:droit:client': {
    engine: 'repondre', title: 'Recevoir le client', how: 'Le client inquiet te confie son affaire : écoute-le et rassure-le en vrai avocat.', decor: 'bureau', npc: 'client',
    lines: [
      ['Maître, mon voisin a construit sur mon terrain !', ['Asseyez-vous, racontez-moi tout depuis le début.', 'Ça arrive.', 'Allez le frapper.'], 0],
      ['J’ai mon attestation de terrain. Ça suffit ?', ['Non, c’est rien du tout.', 'C’est une bonne base, apportez aussi le plan et les reçus.', 'Jetez-la.'], 1],
      ['Vous pensez qu’on va gagner ?', ['Sûr à cent pour cent !', 'Aucune chance.', 'Le dossier est solide, on va bien le défendre.'], 2],
    ],
  },
  'task:droit:dossier': {
    engine: 'assembler', title: 'Préparer le dossier', how: 'Monte le dossier pour l’audience, pièce par pièce, dans l’ordre demandé.', decor: 'bureau', base: 'dossier', orders: 2,
    parts: [{ name: 'Le Code civil', prop: 'livre' }, { name: 'La jurisprudence', prop: 'journal' }, { name: 'Les témoignages', prop: 'cahier' }, { name: 'Les photos', prop: 'appareil-photo' }, { name: 'Le contrat signé', prop: 'stylo' }],
  },
  'task:droit:plaider': {
    engine: 'choisir', title: 'Plaider au tribunal', how: 'Le juge réclame une pièce pendant ta plaidoirie : brandis la bonne, sans hésiter.', decor: 'bureau', caller: 'Le juge', rounds: 2,
    items: [{ name: 'Le contrat', prop: 'dossier' }, { name: 'La photo du terrain', prop: 'appareil-photo' }, { name: 'Le message du témoin', prop: 'telephone' }, { name: 'Le reçu', prop: 'ticket' }, { name: 'Le Code', prop: 'livre' }],
  },

  // Pharmacie: the pharmacy
  'task:pharmacie:ordonnance': {
    engine: 'choisir', title: 'Lire l’ordonnance', how: 'La patiente lit son ordonnance ligne par ligne : tends le bon produit à chaque fois.', decor: 'comptoir', caller: 'La patiente', rounds: 2,
    items: [{ name: 'Les comprimés', prop: 'medicament' }, { name: 'Le pansement', prop: 'pansement' }, { name: 'Le thermomètre', prop: 'thermometre' }, { name: 'La pommade', prop: 'creme' }, { name: 'Le sirop', prop: 'bouteille' }],
  },
  'task:pharmacie:conseil': {
    engine: 'quiz', title: 'Le bon conseil', how: 'Le client décrit son mal : donne le bon conseil, et envoie-le consulter si besoin.', decor: 'comptoir', host: 'client',
    questions: [
      ['J’ai le nez qui coule depuis hier.', ['Un antibiotique fort', 'Du sérum pour le nez et du repos', 'Rien, ça passe jamais'], 1],
      ['Mon enfant a 40 de fièvre depuis trois jours.', ['Il faut voir le médecin tout de suite', 'Un bonbon', 'Attendre une semaine'], 0],
      ['Je me suis coupé en cuisinant.', ['Du piment dessus', 'Laisser ouvert', 'Désinfecter et un pansement'], 2],
    ],
  },
  'task:pharmacie:stock': {
    engine: 'equilibre', title: 'La livraison', how: 'Le carton de médicaments est lourd : porte-le droit jusqu’à la réserve.', decor: 'carrelage', carry: 'carton', verb: 'Porte', distance: 12,
  },

  // Police: the patrol, the station
  'task:police:ronde': {
    engine: 'course', title: 'La ronde du quartier', how: 'Fais ta ronde : salue les commerçants au passage, évite les flaques du caniveau.', decor: 'bitume', mode: 'pied', good: 'coeur', bad: 'goutte', target: 8,
  },
  'task:police:controle': {
    engine: 'choisir', title: 'Vos papiers !', how: 'Le brigadier demande une pièce du chauffeur : trouve-la vite dans la boîte à gants.', decor: 'bitume', caller: 'Le brigadier', rounds: 2,
    items: [{ name: 'Le permis', prop: 'carte-bancaire' }, { name: 'La carte grise', prop: 'dossier' }, { name: 'L’assurance', prop: 'ticket' }, { name: 'La pièce d’identité', prop: 'passeport' }, { name: 'Le gilet', prop: 'gilet' }],
  },
  'task:police:plainte': {
    engine: 'assembler', title: 'Le procès-verbal', how: 'Monte le PV dans l’ordre : identité, faits, témoin, signature, tampon.', decor: 'bureau', base: 'dossier', orders: 2,
    parts: [{ name: 'L’identité', prop: 'passeport' }, { name: 'Les faits', prop: 'cahier' }, { name: 'Le témoin', prop: 'telephone' }, { name: 'La signature', prop: 'stylo' }, { name: 'Le tampon', prop: 'tampon' }],
  },

  // Aérien: the airport
  'task:aerien:enregistrer': {
    engine: 'tenir', title: 'La pesée des valises', how: 'Pose la valise sur la balance : lâche pile dans le vert, avant les 23 kilos.', decor: 'comptoir', object: 'balance', verb: 'Pèse', fill: 'force', times: 3,
  },
  'task:aerien:annonce': {
    engine: 'quiz', title: 'L’annonce du vol', how: 'Le chef d’escale vérifie tes annonces : choisis la bonne, claire et juste.', decor: 'comptoir', host: 'chef',
    questions: [
      ['Le vol Air Lagune pour Bouaké embarque porte 2. Tu dis ?', ['« Vol Bouaké, porte 2, embarquement immédiat. »', '« Allez où vous voulez. »', '« Bouaké est annulé. »'], 0],
      ['Le vol est retardé d’une heure.', ['« Le vol est parti. »', '« Le vol est retardé d’une heure, merci de votre patience. »', '« On sait pas. »'], 1],
      ['Un passager est en retard au comptoir.', ['« Tant pis pour lui. »', '« Rentrez chez vous. »', '« Monsieur Kouadio est attendu d’urgence porte 2. »'], 2],
    ],
  },
  'task:aerien:porte': {
    engine: 'course', title: 'Vite, porte 2 !', how: 'Guide le passager en retard jusqu’à sa porte : ramasse ses tickets, évite les valises.', decor: 'carrelage', mode: 'pied', good: 'ticket', bad: 'valise', target: 8,
  },
}
