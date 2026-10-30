import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// The tasks of a work shift (backend jobs.go): each button of the job, its own little game, keyed task:<career>:<task>.
export const JEUX_TASKS: Record<string, Jeu> = {
  // Bureau: the office
  'task:bureau:mails': {
    engine: 'attraper', title: t('La boîte de réception'), how: t('Les mails tombent : attrape ceux des clients, laisse filer les spams et les arnaques.'), decor: 'bureau', from: 'ordinateur', into: 'dossier', count: 8,
    good: [{ name: t('Le mail du client'), prop: 'telephone' }, { name: t('La facture'), prop: 'billet' }, { name: t('Le rapport'), prop: 'cahier' }],
    bad: [{ name: t('La pub Promo-Choc'), prop: 'affiche' }, { name: t('Le faux gros lot'), prop: 'trophee' }],
  },
  'task:bureau:client': {
    engine: 'quiz', title: t('Appeler le client'), how: t('Le client pose ses questions sur la commande : donne-lui la bonne réponse, vite.'), decor: 'bureau', host: 'client',
    questions: [
      [t('J’ai commandé 40 cartons, vous en livrez 25. Il en manque ?'), ['10', '15', '20'], 1],
      [t('La livraison part lundi, trois jours de route. Elle arrive ?'), [t('Jeudi'), t('Mercredi'), t('Vendredi')], 0],
      [t('Un carton à 5 000 F, j’en prends 6. Ça fait ?'), [t('25 000 F'), t('35 000 F'), t('30 000 F')], 2],
    ],
  },
  'task:bureau:reunion': {
    engine: 'assembler', title: t('Animer la réunion'), how: t('Le chef veut la réunion dans l’ordre qu’il dit : déroule chaque point à son tour.'), decor: 'bureau', base: 'ecran', orders: 2,
    parts: [{ name: t('Le café d’accueil'), prop: 'cafe' }, { name: t('L’ordre du jour'), prop: 'cahier' }, { name: t('Les chiffres'), prop: 'calculatrice' }, { name: t('La présentation'), prop: 'ordinateur' }, { name: t('Les questions'), prop: 'micro' }],
  },
  'task:bureau:signer': {
    engine: 'tenir', title: t('Le contrat de l’année'), how: t('Tiens pour tracer ta signature d’un seul geste, et lâche pile dans le vert.'), decor: 'bureau', object: 'stylo', verb: t('Signe'), fill: 'force', times: 3,
  },

  // Maquis: the open-air restaurant
  'task:maquis:servir': {
    engine: 'equilibre', title: t('Servir la table'), how: t('Garba, alloco, bière glacée sur le plateau : porte-le droit jusqu’à la table du fond.'), decor: 'carrelage', carry: 'plateau-service', verb: t('Sers'), distance: 12,
  },
  'task:maquis:garba': {
    engine: 'tenir', title: t('Frire le thon'), how: t('Le thon grésille dans l’huile : tiens et sors-le pile dans le vert, bien doré.'), decor: 'comptoir', object: 'poele', verb: t('Fris'), fill: 'chaleur', times: 3,
  },
  'task:maquis:addition': {
    engine: 'choisir', title: t('Encaisser l’addition'), how: t('Le client dit comment il paie : touche le bon moyen avant qu’il s’impatiente.'), decor: 'table', caller: t('Le client'), rounds: 2,
    items: [{ name: t('Le billet'), prop: 'billet' }, { name: t('La monnaie'), prop: 'piece' }, { name: t('La carte'), prop: 'carte-bancaire' }, { name: t('Waye sur le téléphone'), prop: 'telephone' }, { name: t('L’addition'), prop: 'ticket' }],
  },

  // Commerce: the market stall
  'task:commerce:heler': {
    engine: 'rythme', title: t('Héler les clientes'), how: t('« Ma chérie, viens voir ! » Lance ton cri, tes tomates, tes piments, pile sur la ligne.'), decor: 'etal', lanes: ['megaphone', 'tomate', 'piment'], notes: 12,
  },
  'task:commerce:marchander': {
    engine: 'repondre', title: t('Tenir son prix'), how: t('La cliente veut payer moitié prix : tiens bon, avec le sourire, sans la vexer.'), decor: 'etal', npc: 'cliente',
    lines: [
      [t('Tes tomates là, c’est combien ?'), [t('Le tas à 500 F, ma chérie, regarde comme elles sont belles.'), t('Achète ou pars.'), t('Je sais pas, fais ton prix.')], 0],
      [t('Eh ! C’est trop cher. 250 F ?'), [t('D’accord, prends tout gratuit.'), t('Non, tu m’insultes !'), t('Ma sœur, mets 400 F, je t’ajoute un piment.')], 2],
      [t('Bon, 400 F mais tu me fais cadeau.'), [t('Jamais de cadeau ici.'), t('Tiens, un oignon en plus. Reviens me voir !'), t('Ok, 200 F alors.')], 1],
    ],
  },
  'task:commerce:etal': {
    engine: 'attraper', title: t('Vider le cageot'), how: t('Vide le cageot sur l’étal : attrape les légumes, laisse tomber cailloux et feuilles.'), decor: 'etal', from: 'carton', into: 'plateau-service', count: 8,
    good: [{ name: t('La tomate'), prop: 'tomate' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }, { name: t('La mangue'), prop: 'mangue' }],
    bad: [{ name: t('Le caillou'), prop: 'caillou' }, { name: t('La feuille fanée'), prop: 'feuille' }],
  },

  // Transport: the gbaka and the woro-woro
  'task:transport:crier': {
    engine: 'rythme', title: t('« Adjamé ! Adjamé ! »'), how: t('Crie la destination plus fort que l’apprenti d’en face : tape pile sur la ligne.'), decor: 'bitume', lanes: ['megaphone', 'sifflet', 'piece'], notes: 12,
  },
  'task:transport:encaisser': {
    engine: 'quiz', title: t('Rendre la monnaie'), how: t('Les passagers paient leur place : calcule vite la monnaie, le gbaka démarre.'), decor: 'bitume', host: 'client',
    questions: [
      [t('On est trois, la place est à 300 F. Ça fait ?'), [t('900 F'), t('600 F'), t('1 200 F')], 0],
      [t('Je te donne 1 000 F pour une place à 300 F.'), [t('600 F'), t('700 F'), t('800 F')], 1],
      [t('Deux places à 250 F, voilà 1 000 F.'), [t('250 F'), t('750 F'), t('500 F')], 2],
    ],
  },
  'task:transport:plein': {
    engine: 'tenir', title: t('Faire le plein'), how: t('Tiens le pistolet pour remplir le réservoir, et lâche pile avant que ça déborde.'), decor: 'bitume', object: 'essence', verb: t('Remplis'), fill: 'liquide', times: 3,
  },

  // Ambiance: the DJ, the animateur
  'task:ambiance:son': {
    engine: 'rythme', title: t('Le son du moment'), how: t('Lance le son qui fait exploser la piste : platine, enceinte, note, pile sur la ligne.'), decor: 'scene', lanes: ['platine', 'enceinte', 'note-musique'], notes: 12,
  },
  'task:ambiance:foule': {
    engine: 'tenir', title: t('« Vous êtes là ? »'), how: t('Tiens le micro pour faire monter le cri de la foule, et coupe pile dans le vert.'), decor: 'scene', object: 'micro', verb: t('Chauffe'), fill: 'force', times: 3,
  },
  'task:ambiance:dedicace': {
    engine: 'repondre', title: t('La dédicace'), how: t('Le grand patron veut son nom au micro : trouve la dédicace qui le fait lancer des billets.'), decor: 'scene', npc: 'client',
    lines: [
      [t('Eh DJ ! Cite mon nom, c’est Patron Konan !'), [t('Dédicace au grand Patron Konan, l’homme qui ne dort pas !'), t('C’est qui ça ?'), t('Paie d’abord.')], 0],
      [t('Dis aussi que je suis de Yopougon !'), [t('Yopougon, c’est loin hein.'), t('Yopougon est dans la place, avec Patron Konan !'), t('Plus tard, je suis occupé.')], 1],
      [t('Et ma chérie là, à la table 4 ?'), [t('Elle est où ?'), t('Je connais pas son nom.'), t('Pour la reine de la table 4, son homme l’aime trop !')], 2],
    ],
  },

  // Mairie: the town hall
  'task:mairie:usager': {
    engine: 'quiz', title: t('Recevoir l’usager'), how: t('Le vieux demande quels papiers fournir : explique-lui juste, avec patience.'), decor: 'bureau', host: 'vieux',
    questions: [
      [t('Pour l’extrait de naissance de mon petit-fils, il faut quoi ?'), [t('Sa photo de classe'), t('Le numéro de l’acte'), t('Son bulletin de notes')], 1],
      [t('On le retire où, l’extrait ?'), [t('À l’état civil'), t('À la voirie'), t('Au marché')], 0],
      [t('Et pour la légalisation d’un papier ?'), [t('Rien, c’est automatique'), t('Un ticket de cinéma'), t('L’original et la copie')], 2],
    ],
  },
  'task:mairie:orienter': {
    engine: 'course', title: t('Le bon bureau'), how: t('Guide la dame perdue jusqu’à l’état civil : ramasse ses papiers, évite les seaux du ménage.'), decor: 'carrelage', mode: 'pied', good: 'dossier', bad: 'seau', target: 8,
  },
  'task:mairie:acte': {
    engine: 'assembler', title: t('L’acte de naissance'), how: t('Établis l’acte dans l’ordre dicté : registre, formulaire, signature, tampon…'), decor: 'bureau', base: 'dossier', orders: 2,
    parts: [{ name: t('Le registre'), prop: 'livre' }, { name: t('Le formulaire'), prop: 'cahier' }, { name: t('La signature'), prop: 'stylo' }, { name: t('Le tampon'), prop: 'tampon' }, { name: t('Le timbre'), prop: 'ticket' }],
  },
  'task:mairie:mariage': {
    engine: 'repondre', title: t('Célébrer le mariage'), how: t('Les mariés sont devant toi, la famille attend : dis les bons mots, solennels et joyeux.'), decor: 'parquet', npc: 'amie',
    lines: [
      [t('Monsieur le maire, on peut commencer ?'), [t('Bienvenue à vous et à vos familles. Nous sommes réunis pour vous unir.'), t('Attendez, je mange.'), t('Vous êtes sûrs de vous ?')], 0],
      [t('Oui, je le veux !'), [t('Bon, ok.'), t('Et lui, il veut ou bien ?'), t('Je vous déclare unis par les liens du mariage !')], 2],
      [t('Merci ! On peut signer maintenant ?'), [t('Plus tard, revenez lundi.'), t('Bien sûr : les mariés, puis les témoins. Félicitations !'), t('Signez où vous voulez.')], 1],
    ],
  },

  // Enseignement: the school
  'task:enseignement:cours': {
    engine: 'quiz', title: t('Au tableau'), how: t('Tu fais la leçon : l’élève au tableau hésite, montre-lui la bonne réponse.'), decor: 'bureau', host: 'enfant',
    questions: [
      [t('Maître, 9 × 7, ça fait combien ?'), ['63', '56', '72'], 0],
      [t('Le plus grand port du pays, c’est où ?'), [t('Bouaké'), t('Abidjan'), t('Korhogo')], 1],
      [t('Un verbe, c’est lequel ?'), [t('Table'), t('Joli'), t('Courir')], 2],
    ],
  },
  'task:enseignement:copies': {
    engine: 'nettoyer', title: t('Le stylo rouge'), how: t('La pile de copies t’attend : touche chaque faute pour la corriger, jusqu’à la dernière.'), decor: 'bureau', object: 'cahier', bit: 'tache', verb: t('Corrige'), count: 8,
  },
  'task:enseignement:recre': {
    engine: 'course', title: t('La récréation'), how: t('Fais le tour de la cour : récupère les ballons perdus, évite les cailloux.'), decor: 'terre', mode: 'pied', good: 'ballon-foot', bad: 'caillou', target: 8,
  },

  // Coiffure: the barber, the braider
  'task:coiffure:degrade': {
    engine: 'tenir', title: t('Le contour net'), how: t('Tiens la tondeuse le long du contour, et lâche pile au bout pour un trait parfait.'), decor: 'carrelage', object: 'rasoir', verb: t('Passe'), fill: 'tissu', times: 3,
  },
  'task:coiffure:tresses': {
    engine: 'rythme', title: t('Les nattes'), how: t('Mèche, peigne, bigoudi : tresse au rythme de la radio, pile sur la ligne.'), decor: 'carrelage', lanes: ['meche', 'peigne', 'bigoudi'], notes: 12,
  },
  'task:coiffure:conseil': {
    engine: 'repondre', title: t('Conseiller une coupe'), how: t('La cliente hésite devant le miroir : propose-lui la coiffure qui lui va.'), decor: 'carrelage', npc: 'cliente',
    lines: [
      [t('Je vais à un mariage samedi. Je fais quoi ?'), [t('Des tresses fines relevées, ça va te rendre élégante.'), t('Rase tout.'), t('Fais comme tu veux.')], 0],
      [t('Mais les tresses, ça fait mal non ?'), [t('Oui, beaucoup.'), t('Je serre doucement, tu vas rien sentir.'), t('C’est pas mon problème.')], 1],
      [t('Ok, mais pas trop longues hein.'), [t('Non, jusqu’aux pieds.'), t('Longues, c’est mieux.'), t('D’accord, aux épaules : parfait avec ta robe.')], 2],
    ],
  },

  // Santé: the clinic
  'task:sante:tension': {
    engine: 'repondre', title: t('Rassurer le patient'), how: t('Tu lis la tension, le patient s’inquiète : explique-lui calmement, conseille-le.'), decor: 'carrelage', npc: 'patient',
    lines: [
      [t('Alors, ma tension, c’est grave ?'), [t('12/8 : c’est normal, tout va bien.'), t('Je sais pas lire ça.'), t('Tu vas mourir.')], 0],
      [t('Et mon frère, il a 16. C’est beaucoup ?'), [t('Non, c’est rien.'), t('C’est un peu haut : moins de sel, et qu’il voie le médecin.'), t('Qu’il mange plus de cube.')], 1],
      [t('Je dois revenir quand ?'), [t('Jamais.'), t('Quand tu veux, ça change rien.'), t('Dans un mois, pour vérifier. Bonne journée !')], 2],
    ],
  },
  'task:sante:piqure': {
    engine: 'equilibre', title: t('Sans douleur'), how: t('Le petit te regarde : garde la main bien stable jusqu’au bout, il ne pleurera pas.'), decor: 'carrelage', carry: 'seringue', verb: t('Garde la main stable'), distance: 12,
  },
  'task:sante:consulter': {
    engine: 'quiz', title: t('Le bon diagnostic'), how: t('Le patient raconte ce qu’il ressent : trouve ce qu’il a, et la bonne suite.'), decor: 'carrelage', host: 'patient',
    questions: [
      [t('Fièvre, frissons, mal de tête depuis la pluie et les moustiques.'), [t('Une entorse'), t('Le palu, on fait le test'), t('Une carie')], 1],
      [t('Je tousse, le nez coule, un peu de fièvre.'), [t('Un rhume : repos et beaucoup d’eau'), t('Une fracture'), t('On opère')], 0],
      [t('J’ai mangé un garba douteux, mon ventre tourne.'), [t('Courir 10 km'), t('Encore un garba'), t('Boire, sels de réhydratation')], 2],
    ],
  },

  // Caisse: the supermarket checkout
  'task:caisse:encaisser': {
    engine: 'rythme', title: t('Bip, bip, bip'), how: t('Le chariot est plein : scanne, tape la caisse, passe la carte, pile sur la ligne.'), decor: 'comptoir', lanes: ['scanner', 'caisse-enregistreuse', 'carte-bancaire'], notes: 12,
  },
  'task:caisse:monnaie': {
    engine: 'quiz', title: t('Au franc près'), how: t('Le client te tend son billet : trouve la monnaie juste, au franc près.'), decor: 'comptoir', host: 'cliente',
    questions: [
      [t('Ça fait 3 750 F, voilà 5 000 F.'), [t('1 250 F'), t('1 750 F'), t('2 250 F')], 0],
      [t('8 400 F, je te donne 10 000 F.'), [t('2 600 F'), t('1 600 F'), t('1 400 F')], 1],
      [t('12 300 F, voilà deux billets de 10 000 F.'), [t('8 300 F'), t('6 700 F'), t('7 700 F')], 2],
    ],
  },
  'task:caisse:cloture': {
    engine: 'attraper', title: t('La clôture de caisse'), how: t('Vide le tiroir pour compter : attrape billets et pièces, laisse tomber tickets et bonbons.'), decor: 'comptoir', from: 'caisse-enregistreuse', into: 'sac', count: 8,
    good: [{ name: t('Le billet'), prop: 'billet' }, { name: t('La pièce'), prop: 'piece' }],
    bad: [{ name: t('Le vieux ticket'), prop: 'ticket' }, { name: t('Le bonbon'), prop: 'bonbon' }],
  },

  // Vente: the clothes shop
  'task:vente:conseiller': {
    engine: 'choisir', title: t('La tenue du mariage'), how: t('Le client prépare un mariage : tends-lui ce qu’il demande avant qu’il change d’avis.'), decor: 'comptoir', caller: t('Le client'), rounds: 2,
    items: [{ name: t('La chemise en wax'), prop: 'chemise' }, { name: t('Le grand boubou'), prop: 'boubou' }, { name: t('Les chaussures'), prop: 'chaussure' }, { name: t('La montre'), prop: 'montre' }, { name: t('Le parfum'), prop: 'parfum' }],
  },
  'task:vente:essayage': {
    engine: 'assembler', title: t('La cabine d’essayage'), how: t('La cliente essaie une tenue : passe-lui chaque pièce dans l’ordre qu’elle demande.'), decor: 'carrelage', base: 'miroir', orders: 2,
    parts: [{ name: t('Le pagne'), prop: 'pagne' }, { name: t('La robe'), prop: 'robe' }, { name: t('Le collier'), prop: 'collier' }, { name: t('Le sac'), prop: 'sac' }, { name: t('Les lunettes'), prop: 'lunettes' }],
  },
  'task:vente:rayons': {
    engine: 'attraper', title: t('La nouvelle collection'), how: t('Déballe le carton : attrape les tenues pour les rayons, laisse tomber les emballages.'), decor: 'carrelage', from: 'carton', into: 'chariot', count: 8,
    good: [{ name: t('La chemise'), prop: 'chemise' }, { name: t('La robe'), prop: 'robe' }, { name: t('Le pagne'), prop: 'pagne' }, { name: t('La casquette'), prop: 'casquette' }],
    bad: [{ name: t('Le papier d’emballage'), prop: 'journal' }, { name: t('La poussière'), prop: 'poussiere' }],
  },

  // Hôtellerie: the hotel front desk
  'task:hotellerie:accueil': {
    engine: 'repondre', title: t('Bienvenue à l’hôtel'), how: t('Un touriste arrive, fatigué et exigeant : accueille-le avec le sourire.'), decor: 'carrelage', npc: 'touriste',
    lines: [
      [t('Bonsoir, j’ai réservé au nom de Martin.'), [t('Bienvenue, monsieur Martin ! Votre chambre est prête.'), t('Martin qui ?'), t('On est fermés.')], 0],
      [t('Le vol était long, je suis épuisé.'), [t('C’est pas mon problème.'), t('Je comprends : un jus de bissap offert vous attend.'), t('Moi aussi, je suis fatigué.')], 1],
      [t('Le petit-déjeuner, c’est à quelle heure ?'), [t('Je sais pas.'), t('Quand le cuisinier se réveille.'), t('De 6 h à 10 h, au bord de la piscine.')], 2],
    ],
  },
  'task:hotellerie:cles': {
    engine: 'choisir', title: t('Remettre les clés'), how: t('Le client demande ce qu’il lui faut pour sa chambre : tends-le-lui, vite et bien.'), decor: 'comptoir', caller: t('Le client'), rounds: 2,
    items: [{ name: t('La clé de la 214'), prop: 'cle' }, { name: t('Le badge'), prop: 'badge' }, { name: t('Le code du wifi'), prop: 'ticket' }, { name: t('Le journal du jour'), prop: 'journal' }, { name: t('La serviette de plage'), prop: 'serviette' }],
  },
  'task:hotellerie:bagages': {
    engine: 'assembler', title: t('Charger le chariot'), how: t('Le taxi décharge : charge le chariot dans l’ordre que le client te dit.'), decor: 'carrelage', base: 'chariot', orders: 2,
    parts: [{ name: t('La grosse valise'), prop: 'valise' }, { name: t('Le sac de voyage'), prop: 'sac' }, { name: t('Le colis'), prop: 'colis' }, { name: t('Le carton de souvenirs'), prop: 'carton' }, { name: t('Le chapeau'), prop: 'casquette' }],
  },

  // Droit: the law firm
  'task:droit:client': {
    engine: 'repondre', title: t('Recevoir le client'), how: t('Le client inquiet te confie son affaire : écoute-le et rassure-le en vrai avocat.'), decor: 'bureau', npc: 'client',
    lines: [
      [t('Maître, mon voisin a construit sur mon terrain !'), [t('Asseyez-vous, racontez-moi tout depuis le début.'), t('Ça arrive.'), t('Allez le frapper.')], 0],
      [t('J’ai mon attestation de terrain. Ça suffit ?'), [t('Non, c’est rien du tout.'), t('C’est une bonne base, apportez aussi le plan et les reçus.'), t('Jetez-la.')], 1],
      [t('Vous pensez qu’on va gagner ?'), [t('Sûr à cent pour cent !'), t('Aucune chance.'), t('Le dossier est solide, on va bien le défendre.')], 2],
    ],
  },
  'task:droit:dossier': {
    engine: 'assembler', title: t('Préparer le dossier'), how: t('Monte le dossier pour l’audience, pièce par pièce, dans l’ordre demandé.'), decor: 'bureau', base: 'dossier', orders: 2,
    parts: [{ name: t('Le Code civil'), prop: 'livre' }, { name: t('La jurisprudence'), prop: 'journal' }, { name: t('Les témoignages'), prop: 'cahier' }, { name: t('Les photos'), prop: 'appareil-photo' }, { name: t('Le contrat signé'), prop: 'stylo' }],
  },
  'task:droit:plaider': {
    engine: 'choisir', title: t('Plaider au tribunal'), how: t('Le juge réclame une pièce pendant ta plaidoirie : brandis la bonne, sans hésiter.'), decor: 'bureau', caller: t('Le juge'), rounds: 2,
    items: [{ name: t('Le contrat'), prop: 'dossier' }, { name: t('La photo du terrain'), prop: 'appareil-photo' }, { name: t('Le message du témoin'), prop: 'telephone' }, { name: t('Le reçu'), prop: 'ticket' }, { name: t('Le Code'), prop: 'livre' }],
  },

  // Pharmacie: the pharmacy
  'task:pharmacie:ordonnance': {
    engine: 'choisir', title: t('Lire l’ordonnance'), how: t('La patiente lit son ordonnance ligne par ligne : tends le bon produit à chaque fois.'), decor: 'comptoir', caller: t('La patiente'), rounds: 2,
    items: [{ name: t('Les comprimés'), prop: 'medicament' }, { name: t('Le pansement'), prop: 'pansement' }, { name: t('Le thermomètre'), prop: 'thermometre' }, { name: t('La pommade'), prop: 'creme' }, { name: t('Le sirop'), prop: 'bouteille' }],
  },
  'task:pharmacie:conseil': {
    engine: 'quiz', title: t('Le bon conseil'), how: t('Le client décrit son mal : donne le bon conseil, et envoie-le consulter si besoin.'), decor: 'comptoir', host: 'client',
    questions: [
      [t('J’ai le nez qui coule depuis hier.'), [t('Un antibiotique fort'), t('Du sérum pour le nez et du repos'), t('Rien, ça passe jamais')], 1],
      [t('Mon enfant a 40 de fièvre depuis trois jours.'), [t('Il faut voir le médecin tout de suite'), t('Un bonbon'), t('Attendre une semaine')], 0],
      [t('Je me suis coupé en cuisinant.'), [t('Du piment dessus'), t('Laisser ouvert'), t('Désinfecter et un pansement')], 2],
    ],
  },
  'task:pharmacie:stock': {
    engine: 'equilibre', title: t('La livraison'), how: t('Le carton de médicaments est lourd : porte-le droit jusqu’à la réserve.'), decor: 'carrelage', carry: 'carton', verb: t('Porte'), distance: 12,
  },

  // Police: the patrol, the station
  'task:police:ronde': {
    engine: 'course', title: t('La ronde du quartier'), how: t('Fais ta ronde : salue les commerçants au passage, évite les flaques du caniveau.'), decor: 'bitume', mode: 'pied', good: 'coeur', bad: 'goutte', target: 8,
  },
  'task:police:controle': {
    engine: 'choisir', title: t('Vos papiers !'), how: t('Le brigadier demande une pièce du chauffeur : trouve-la vite dans la boîte à gants.'), decor: 'bitume', caller: t('Le brigadier'), rounds: 2,
    items: [{ name: t('Le permis'), prop: 'carte-bancaire' }, { name: t('La carte grise'), prop: 'dossier' }, { name: t('L’assurance'), prop: 'ticket' }, { name: t('La pièce d’identité'), prop: 'passeport' }, { name: t('Le gilet'), prop: 'gilet' }],
  },
  'task:police:plainte': {
    engine: 'assembler', title: t('Le procès-verbal'), how: t('Monte le PV dans l’ordre : identité, faits, témoin, signature, tampon.'), decor: 'bureau', base: 'dossier', orders: 2,
    parts: [{ name: t('L’identité'), prop: 'passeport' }, { name: t('Les faits'), prop: 'cahier' }, { name: t('Le témoin'), prop: 'telephone' }, { name: t('La signature'), prop: 'stylo' }, { name: t('Le tampon'), prop: 'tampon' }],
  },

  // Aérien: the airport
  'task:aerien:enregistrer': {
    engine: 'tenir', title: t('La pesée des valises'), how: t('Pose la valise sur la balance : lâche pile dans le vert, avant les 23 kilos.'), decor: 'comptoir', object: 'balance', verb: t('Pèse'), fill: 'force', times: 3,
  },
  'task:aerien:annonce': {
    engine: 'quiz', title: t('L’annonce du vol'), how: t('Le chef d’escale vérifie tes annonces : choisis la bonne, claire et juste.'), decor: 'comptoir', host: 'chef',
    questions: [
      [t('Le vol Air Lagune pour Bouaké embarque porte 2. Tu dis ?'), [t('« Vol Bouaké, porte 2, embarquement immédiat. »'), t('« Allez où vous voulez. »'), t('« Bouaké est annulé. »')], 0],
      [t('Le vol est retardé d’une heure.'), [t('« Le vol est parti. »'), t('« Le vol est retardé d’une heure, merci de votre patience. »'), t('« On sait pas. »')], 1],
      [t('Un passager est en retard au comptoir.'), [t('« Tant pis pour lui. »'), t('« Rentrez chez vous. »'), t('« Monsieur Kouadio est attendu d’urgence porte 2. »')], 2],
    ],
  },
  'task:aerien:porte': {
    engine: 'course', title: t('Vite, porte 2 !'), how: t('Guide le passager en retard jusqu’à sa porte : ramasse ses tickets, évite les valises.'), decor: 'carrelage', mode: 'pied', good: 'ticket', bad: 'valise', target: 8,
  },
}
