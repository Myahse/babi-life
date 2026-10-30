import type { Jeu } from '../types'
import { t } from '../../../../lib/i18n'

// Every action of list00 (airport … happenings), dressed as its own little game.
export const JEUX_1: Record<string, Jeu> = {
  // The airport (Félix-Houphouët-Boigny, Port-Bouët)
  'accueillir-arrivees': {
    engine: 'repondre', title: t('Bienvenue au pays !'), how: t('Ton cousin sort des arrivées après deux ans en France : trouve les mots qui font plaisir.'), decor: 'carrelage', npc: 'ami',
    lines: [
      [t('Eh, c’est toi ? Tu as grossi dèh !'), [t('C’est le garba de Babi, mon frère, bonne arrivée !'), t('Toi tu as vieilli.'), t('Je ne te connais pas.')], 0],
      [t('Les valises sont lourdes, hein…'), [t('Débrouille-toi.'), t('Donne, on porte à deux !'), t('Tu as amené quoi pour moi ?')], 1],
      [t('Il fait chaud comme ça ici ?'), [t('Non, c’est l’avion qui chauffe.'), t('Bienvenue sous le soleil de Babi, on va boire une coco !'), t('Retourne là-bas alors.')], 1],
      [t('Tout le monde va bien à la maison ?'), [t('Je sais pas, je viens pas souvent.'), t('Tout le monde t’attend, la tantie a fait du foutou !'), t('Ça dépend.')], 1],
    ],
  },
  'babi-burger-aeroport': {
    engine: 'assembler', title: t('Le Babi Burger'), how: t('Le voyageur pressé passe commande : empile ses ingrédients dans le bon ordre avant l’embarquement.'), decor: 'comptoir', base: 'assiette',
    parts: [{ name: t('Le pain'), prop: 'pain' }, { name: t('Le poulet pané'), prop: 'poulet' }, { name: t('La tomate'), prop: 'tomate' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('Le piment'), prop: 'piment' }],
  },
  'boutique-aeroport': {
    engine: 'choisir', title: t('La boutique hors taxes'), how: t('La vendeuse te montre ses articles : touche celui qu’elle nomme avant les autres voyageurs.'), decor: 'etagere', caller: t('La vendeuse'),
    items: [{ name: t('Le parfum'), prop: 'parfum' }, { name: t('Les lunettes de soleil'), prop: 'lunettes' }, { name: t('La montre'), prop: 'montre' }, { name: t('Le sac'), prop: 'sac' }, { name: t('Le collier'), prop: 'collier' }, { name: t('Le masque sculpté'), prop: 'masque' }],
  },
  'cafe-aeroport': {
    engine: 'tenir', title: t('Le café du comptoir'), how: t('Tiens pour verser le café, lâche quand la tasse est pleine, sans déborder sur le comptoir.'), decor: 'comptoir', object: 'cafe', verb: t('Verse'), fill: 'liquide',
  },
  'resto-aeroport': {
    engine: 'choisir', title: t('Le resto de l’aérogare'), how: t('Le serveur annonce les plats qui sortent : touche le bon avant la table d’à côté.'), decor: 'table', caller: t('Le serveur'),
    items: [{ name: t('Le poisson braisé'), prop: 'poisson' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('Le riz'), prop: 'riz' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('L’alloco'), prop: 'alloco' }],
  },
  'salle-attente': {
    engine: 'equilibre', title: t('Petit somme en salle'), how: t('Tu piques du nez sur ton coussin : garde la tête droite pour ne pas tomber sur ton voisin.'), decor: 'carrelage', carry: 'coussin', verb: t('Garde la tête droite'),
  },
  'voir-avions': {
    engine: 'photo', title: t('Les avions décollent'), how: t('Les avions passent au-dessus de la piste : déclenche quand l’un d’eux est bien dans le cadre.'), decor: 'ciel',
    subjects: [{ name: t('Le vol pour Bouaké'), prop: 'avion' }, { name: t('Le soleil couchant'), prop: 'soleil' }, { name: t('Un oiseau'), prop: 'oiseau' }, { name: t('Un nuage'), prop: 'nuage' }],
  },
  'work:aerien': {
    engine: 'assembler', title: t('Le comptoir d’enregistrement'), how: t('Un passager après l’autre : passeport, billet, pesée, étiquette, dans l’ordre demandé.'), decor: 'comptoir', base: 'dossier',
    parts: [{ name: t('Le passeport'), prop: 'passeport' }, { name: t('Le billet'), prop: 'ticket' }, { name: t('La pesée de la valise'), prop: 'balance' }, { name: t('L’étiquette bagage'), prop: 'badge' }, { name: t('La carte d’embarquement'), prop: 'billet-cinema' }],
  },

  // The National Assembly (Plateau)
  petition: {
    engine: 'assembler', title: t('La pétition du quartier'), how: t('Monte le dossier pour le député dans l’ordre : la lettre, les signatures, les photos, le tampon.'), decor: 'bureau', base: 'dossier',
    parts: [{ name: t('La lettre'), prop: 'cahier' }, { name: t('Les signatures'), prop: 'stylo' }, { name: t('Les photos du caniveau'), prop: 'appareil-photo' }, { name: t('Le tampon de dépôt'), prop: 'tampon' }],
  },
  'seance-publique': {
    engine: 'repondre', title: t('Dans la tribune'), how: t('Le vieux à côté de toi chuchote pendant la séance : réponds-lui sans déranger personne.'), decor: 'parquet', npc: 'vieux',
    lines: [
      [t('Pssst… tu sais ce qu’ils votent aujourd’hui ?'), [t('Le budget, je crois. On écoute ?'), t('ON VOTE QUOI ?!'), t('Je m’en fous.')], 0],
      [t('Mon fils, tu as un bonbon ?'), [t('Tiens, doucement, papa.'), t('Non, tchrrr.'), t('Achète toi-même.')], 0],
      [t('Le président de séance a sonné. Ça veut dire quoi ?'), [t('Que c’est la récré.'), t('Qu’il faut faire silence, on reprend.'), t('Qu’on peut applaudir.')], 1],
      [t('Tu reviendras avec moi la prochaine fois ?'), [t('Jamais.'), t('Si tu me payes.'), t('Avec plaisir, on apprend des choses ici.')], 2],
    ],
  },
  'selfie-assemblee': {
    engine: 'photo', title: t('Selfie devant l’Assemblée'), how: t('Le drapeau flotte, les passants bougent : prends la photo quand le bon décor est dans le cadre.'), decor: 'bitume',
    subjects: [{ name: t('Le drapeau qui flotte'), prop: 'drapeau' }, { name: t('La statue'), prop: 'statue' }, { name: t('Le palmier'), prop: 'palmier' }, { name: t('Le soleil couchant'), prop: 'soleil' }],
  },
  'visite-hemicycle': {
    engine: 'quiz', title: t('Visite de l’hémicycle'), how: t('Le guide te fait visiter et te pose ses questions : trouve la bonne réponse.'), decor: 'parquet', host: 'guide',
    questions: [
      [t('Dans quelle commune se trouve l’Assemblée nationale ?'), [t('Au Plateau'), t('À Yopougon'), t('À Bingerville')], 0],
      [t('Qui vote les lois ?'), [t('Les maires'), t('Les députés'), t('Les juges')], 1],
      [t('Le Parlement a deux chambres : l’Assemblée nationale et…'), [t('La mairie'), t('Le tribunal'), t('Le Sénat')], 2],
      [t('Les couleurs du drapeau ivoirien ?'), [t('Orange, blanc, vert'), t('Rouge, jaune, vert'), t('Bleu, blanc, rouge')], 0],
    ],
  },

  // The barber's
  'boule-a-zero': {
    engine: 'nettoyer', title: t('La boule à zéro'), how: t('Le crâne est plein de mousse dans le miroir : passe le rasoir sur chaque bout, jusqu’à ce que ça brille.'), decor: 'carrelage', object: 'miroir', bit: 'mousse', verb: t('Rase'),
  },
  'coupe-courte': {
    engine: 'choisir', title: t('Passe-moi l’outil !'), how: t('Le barbier te demande ses outils pour ta coupe : tends-lui le bon avant l’apprenti.'), decor: 'carrelage', caller: t('Le barbier'),
    items: [{ name: t('Les ciseaux'), prop: 'ciseaux' }, { name: t('Le peigne'), prop: 'peigne' }, { name: t('Le rasoir'), prop: 'rasoir' }, { name: t('Le séchoir'), prop: 'seche-cheveux' }, { name: t('La serviette'), prop: 'serviette' }],
  },
  degrade: {
    engine: 'tenir', title: t('Le dégradé propre'), how: t('Passe la tondeuse étage par étage : tiens, et lâche pile dans le vert pour un dégradé net.'), decor: 'carrelage', object: 'rasoir', verb: t('Passe la tondeuse'), fill: 'force', times: 4,
  },
  gbairai: {
    engine: 'repondre', title: t('Le gbairai du salon'), how: t('Au salon, les nouvelles du quartier tournent : réponds pour rigoler sans blesser personne.'), decor: 'carrelage', npc: 'vieux',
    lines: [
      [t('Tu as vu ? Le fils du boutiquier s’est acheté une moto !'), [t('Il va nous déposer alors, on est ensemble !'), t('Il l’a volée sûrement.'), t('Moi je m’en fiche.')], 0],
      [t('On dit que la tantie Awa a gagné à la tombola…'), [t('Faut lui demander la recette, c’est la chance !'), t('Elle a triché.'), t('Elle va tout gâter.')], 0],
      [t('Et toi, toujours pas marié ?'), [t('Laisse-moi tranquille !'), t('Patience, papa, le bon mouton se cherche !'), t('Et toi, toujours pas coiffé ?')], 1],
      [t('Le maquis d’en face a augmenté le garba !'), [t('Ils sont des voleurs.'), t('Il faut fermer leur maquis.'), t('Aïe, la vie est chère, on va cotiser pour le garba !')], 2],
    ],
  },
  iroquoise: {
    engine: 'assembler', title: t('L’iroquoise de star'), how: t('Le client veut sa crête : rase les côtés, peigne, gel, séchoir, dans l’ordre qu’il réclame.'), decor: 'carrelage', base: 'miroir',
    parts: [{ name: t('Les côtés rasés'), prop: 'rasoir' }, { name: t('La crête peignée'), prop: 'peigne' }, { name: t('Le gel'), prop: 'creme' }, { name: t('Le coup de séchoir'), prop: 'seche-cheveux' }],
  },
  'taille-barbe': {
    engine: 'nettoyer', title: t('La barbe bien taillée'), how: t('Des poils dépassent de partout dans le miroir : taille chaque poil rebelle.'), decor: 'carrelage', object: 'miroir', bit: 'cheveu', verb: t('Taille'),
  },

  // The beach (Bassam, Port-Bouët)
  'balade-plage': {
    engine: 'course', title: t('Au bord de l’eau'), how: t('Marche le long des vagues : ramasse les jolis coquillages, évite les crabes qui pincent.'), decor: 'sable', mode: 'pied', good: 'coquillage', bad: 'crabe',
  },
  'chill-sand': {
    engine: 'photo', title: t('Sous les cocotiers'), how: t('Allongé·e sous les cocotiers, regarde passer la vie : capture les plus beaux moments.'), decor: 'sable',
    subjects: [{ name: t('La pirogue au loin'), prop: 'pirogue' }, { name: t('Le soleil qui se couche'), prop: 'soleil' }, { name: t('Une belle vague'), prop: 'vague' }, { name: t('Un oiseau de mer'), prop: 'oiseau' }],
  },
  'coco-plage': {
    engine: 'tenir', title: t('La coco bien fraîche'), how: t('Aspire l’eau de coco à la paille : tiens, et lâche dans le vert avant de t’étrangler.'), decor: 'sable', object: 'noix-coco', verb: t('Aspire'), fill: 'liquide',
  },
  'eat-fish': {
    engine: 'assembler', title: t('Le poisson braisé'), how: t('La braiseuse monte ton assiette : pose attiéké, poisson, piment, oignon dans l’ordre demandé.'), decor: 'table', base: 'assiette',
    parts: [{ name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le poisson braisé'), prop: 'poisson' }, { name: t('Le piment'), prop: 'piment' }, { name: t('L’oignon'), prop: 'oignon' }, { name: t('La tomate'), prop: 'tomate' }],
  },
  'foot-plage': {
    engine: 'viser', title: t('Foot pieds nus'), how: t('Les buts sont deux tongs dans le sable : vise, dose ta frappe et marque.'), decor: 'sable', projectile: 'ballon-foot', target: 'but',
  },
  swim: {
    engine: 'course', title: t('Une bonne baignade'), how: t('Nage entre les bouées et passe sous les grosses vagues : à Bassam, la mer est forte.'), decor: 'eau', mode: 'nage', good: 'bouee', bad: 'vague',
  },

  // The neighbourhood shop
  courses: {
    engine: 'attraper', title: t('Les courses du jour'), how: t('Le boutiquier te lance les articles : attrape ceux de ta liste, laisse tomber le reste.'), decor: 'comptoir', from: 'carton', into: 'sac',
    good: [{ name: t('Le riz'), prop: 'riz' }, { name: t('Le pain'), prop: 'pain' }, { name: t('Le savon'), prop: 'savon' }, { name: t('Les tomates'), prop: 'tomate' }],
    bad: [{ name: t('Les bonbons'), prop: 'bonbon' }, { name: t('Le jouet'), prop: 'jouet' }],
  },
  credit: {
    engine: 'tenir', title: t('Le crédit pile poil'), how: t('La recharge monte sur ton téléphone : lâche pile à 500 F, pas un franc de plus.'), decor: 'comptoir', object: 'telephone', verb: t('Recharge'), fill: 'liquide', times: 3,
  },
  sucrerie: {
    engine: 'choisir', title: t('Une sucrerie glacée'), how: t('Tes petits frères crient ce qu’ils veulent : sors la bonne sucrerie du frigo avant les autres.'), decor: 'comptoir', caller: t('Ton petit frère'),
    items: [{ name: t('Le soda orange'), prop: 'soda' }, { name: t('Le jus de bissap'), prop: 'jus' }, { name: t('L’eau en sachet'), prop: 'sachet-eau' }, { name: t('La glace'), prop: 'glace' }, { name: t('Les bonbons'), prop: 'bonbon' }],
  },
  'work:vente': {
    engine: 'repondre', title: t('Conseiller la cliente'), how: t('La cliente essaie tenue sur tenue : conseille-la avec sincérité et le sourire.'), decor: 'comptoir', npc: 'cliente',
    lines: [
      [t('Cette robe me grossit, non ?'), [t('Un peu, oui.'), t('Essayez le bleu, il vous va encore mieux !'), t('Tout vous grossit, madame.')], 1],
      [t('C’est pour le mariage de ma sœur samedi.'), [t('Alors il faut le pagne qui brille, vous serez la reine !'), t('On s’en fout du mariage.'), t('Prenez n’importe quoi.')], 0],
      [t('C’est trop cher, faut diminuer !'), [t('C’est le prix, point.'), t('Partez alors.'), t('Pour vous je fais un petit geste, et je vous offre le foulard.')], 2],
      [t('Vous avez la taille au-dessus ?'), [t('Je regarde en réserve tout de suite !'), t('Non, maigrissez.'), t('Débrouillez-vous.')], 0],
    ],
  },

  // The Tour F building site (Plateau)
  'manoeuvre-tour-f': {
    engine: 'equilibre', title: t('Manœuvre sur le chantier'), how: t('Pousse la brouette de ciment jusqu’à la grue : garde-la droite, sinon tout se renverse.'), decor: 'terre', carry: 'brouette', verb: t('Pousse la brouette'), distance: 120,
  },
  'regarder-tour-f': {
    engine: 'photo', title: t('La Tour F qui monte'), how: t('La plus haute tour d’Afrique pousse au Plateau : capture les ouvriers et les charges qui montent.'), decor: 'terre',
    subjects: [{ name: t('Le casque d’un ouvrier'), prop: 'casque-chantier' }, { name: t('Le sac de ciment hissé'), prop: 'sac-ciment' }, { name: t('La palette de briques'), prop: 'brique' }, { name: t('Un oiseau sur la grue'), prop: 'oiseau' }],
  },

  // The cinema
  film: {
    engine: 'photo', title: t('Les scènes cultes'), how: t('Le film défile : tape au moment des scènes cultes pour les garder en mémoire.'), decor: 'scene',
    subjects: [{ name: t('Le clap du début'), prop: 'clap' }, { name: t('Le lion du film'), prop: 'lion' }, { name: t('L’avion de la poursuite'), prop: 'avion' }, { name: t('La star'), prop: 'etoile' }],
  },
  'film-popcorn': {
    engine: 'attraper', title: t('Pop-corn qui saute'), how: t('Le pop-corn saute de la machine : remplis ton cornet, laisse tomber les grains cramés.'), decor: 'comptoir', from: 'marmite', into: 'popcorn',
    good: [{ name: t('Le pop-corn'), prop: 'popcorn' }, { name: t('Le bonbon'), prop: 'bonbon' }],
    bad: [{ name: t('Le grain cramé'), prop: 'flamme' }],
  },

  // The street, campaigning
  'campagne-terrain': {
    engine: 'repondre', title: t('Faire campagne au quartier'), how: t('Les électeurs te posent leurs questions : réponds avec respect et des idées concrètes.'), decor: 'bitume', npc: 'electeur',
    lines: [
      [t('Vous, les politiciens, vous venez seulement pendant les élections !'), [t('C’est faux, vous mentez.'), t('Je vous donne mon numéro : appelez-moi même après.'), t('Votez et taisez-vous.')], 1],
      [t('Notre rue est noyée à chaque pluie.'), [t('On va curer les caniveaux, et je viendrai vérifier.'), t('Achetez des bottes.'), t('C’est pas mon problème.')], 0],
      [t('Et les jeunes, ils vont travailler où ?'), [t('Partout, il faut chercher.'), t('Allez au champ.'), t('Formations et petits marchés pour les jeunes du quartier !')], 2],
      [t('Je vote pour l’autre candidat, moi.'), [t('Alors partez.'), t('C’est votre droit, merci de m’avoir écouté !'), t('Il est nul, lui.')], 1],
    ],
  },
  militer: {
    engine: 'rythme', title: t('Le meeting en musique'), how: t('Le cortège chante les slogans : mégaphone, drapeau, sifflet, tape quand la note passe la ligne.'), decor: 'bitume', lanes: ['megaphone', 'drapeau', 'sifflet'],
  },

  // The night club
  atalaku: {
    engine: 'viser', title: t('Travailler l’atalaku'), how: t('L’atalaku crie ton nom au micro : vise bien et lance tes billets jusqu’à lui.'), decor: 'scene', projectile: 'billet', target: 'micro', shots: 5,
  },
  'bouteille-whisky': {
    engine: 'tenir', title: t('Servir la table'), how: t('Verse un verre à chacun : tiens, et lâche pile au trait, sans gaspiller une goutte.'), decor: 'table', object: 'verre', verb: t('Verse'), fill: 'liquide', times: 4,
  },
  'champagne-vip': {
    engine: 'assembler', title: t('Le plateau du carré VIP'), how: t('Prépare le plateau qui fait briller la boîte : bouteille, glace, verres, cierges, dans l’ordre.'), decor: 'table', base: 'plateau-service',
    parts: [{ name: t('Le seau de glace'), prop: 'seau' }, { name: t('La bouteille'), prop: 'bouteille' }, { name: t('Les verres'), prop: 'verre' }, { name: t('Les cierges magiques'), prop: 'etoile' }],
  },
  party: {
    engine: 'rythme', title: t('Jusqu’au petit matin'), how: t('Le coupé-décalé ne s’arrête pas : tape les notes sur la ligne jusqu’au lever du soleil.'), decor: 'parquet', lanes: ['enceinte', 'djembe', 'ballon-fete'], notes: 40,
  },
  podium: {
    engine: 'rythme', title: t('Le roi du podium'), how: t('Tout le club te regarde : enchaîne les pas sur la ligne pour faire crier la foule.'), decor: 'scene', lanes: ['chaussure', 'micro', 'note-musique'], tempo: 120,
  },
  slow: {
    engine: 'repondre', title: t('Une danse, s’il te plaît'), how: t('Les lumières baissent, le slow commence : invite avec respect et sans forcer.'), decor: 'parquet', npc: 'amie',
    lines: [
      [t('Tu veux danser avec moi ?'), [t('Avec plaisir, mais doucement, je marche sur les pieds !'), t('Si tu insistes…'), t('Non.')], 0],
      [t('Tu danses souvent le slow ?'), [t('Jamais, c’est nul.'), t('Seulement quand la chanson est belle comme ça.'), t('Tous les soirs avec tout le monde.')], 1],
      [t('Je suis un peu fatiguée…'), [t('On continue quand même !'), t('Tant pis pour toi.'), t('On va s’asseoir, je t’offre un jus ?')], 2],
    ],
  },
  'tournee-vendredi': {
    engine: 'equilibre', title: t('Champagne pour tous !'), how: t('Porte le plateau chargé de bouteilles à travers la boîte bondée : rien ne doit tomber.'), decor: 'parquet', carry: 'plateau-service', verb: t('Porte le plateau'), distance: 140,
  },
  'work:ambiance': {
    engine: 'choisir', title: t('Aux platines'), how: t('La foule réclame un son : lance le bon instrument avant que la piste se vide.'), decor: 'scene', caller: t('La foule'),
    items: [{ name: t('Le balafon'), prop: 'balafon' }, { name: t('Le djembé'), prop: 'djembe' }, { name: t('La guitare'), prop: 'guitare' }, { name: t('Le micro pour la dédicace'), prop: 'micro' }, { name: t('Les basses'), prop: 'enceinte' }, { name: t('Le scratch'), prop: 'platine' }],
  },

  // The tailor's
  'coudre-pagne': {
    engine: 'assembler', title: t('Ta tenue en pagne'), how: t('Le couturier monte ta tenue : coupe, fil, machine, repassage, dans l’ordre qu’il te dit.'), decor: 'table', base: 'pagne',
    parts: [{ name: t('Couper le tissu'), prop: 'ciseaux' }, { name: t('Enfiler la bobine'), prop: 'bobine' }, { name: t('Coudre à la machine'), prop: 'machine-a-coudre' }, { name: t('Repasser'), prop: 'fer-a-repasser' }],
  },
  retouche: {
    engine: 'tenir', title: t('La petite retouche'), how: t('Appuie sur la pédale pour coudre l’ourlet : lâche pile au bout, sans dépasser.'), decor: 'table', object: 'machine-a-coudre', verb: t('Couds'), fill: 'tissu',
  },

  // Culture: concerts, shows, museum
  'concert-anoumabo': {
    engine: 'rythme', title: t('Concert à Anoumabo'), how: t('Balafon, djembé, guitare : suis le groupe et tape chaque note sur la ligne.'), decor: 'scene', lanes: ['balafon', 'djembe', 'guitare'],
  },
  exposition: {
    engine: 'photo', title: t('L’expo du moment'), how: t('Les œuvres défilent sous tes yeux : garde en photo celles qui te parlent.'), decor: 'parquet',
    subjects: [{ name: t('La grande toile'), prop: 'tableau' }, { name: t('La sculpture en bois'), prop: 'statue' }, { name: t('Le masque'), prop: 'masque' }, { name: t('L’affiche de l’expo'), prop: 'affiche' }],
  },
  spectacle: {
    engine: 'repondre', title: t('Le one-man-show'), how: t('L’humoriste descend dans la salle et te parle : réponds pour faire rire tout le monde.'), decor: 'scene', npc: 'ami',
    lines: [
      [t('Toi là, tu viens d’où ?'), [t('De Yop City, la cité de la joie !'), t('Ça te regarde pas.'), t('De nulle part.')], 0],
      [t('Tu as payé ton ticket ou bien tu es passé par la fenêtre ?'), [t('Par la fenêtre.'), t('J’ai payé, mais je veux la monnaie en rires !'), t('Laisse-moi.')], 1],
      [t('Il fait chaud ici, c’est toi qui chauffes comme ça ?'), [t('Non.'), t('Arrête.'), t('C’est ton spectacle qui est trop chaud !')], 2],
    ],
  },
  'visite-guidee': {
    engine: 'quiz', title: t('Abidjan, la visite'), how: t('Le guide te fait découvrir la ville : réponds juste à ses questions.'), decor: 'bitume', host: 'guide',
    questions: [
      [t('Abidjan est bâtie autour de quelle lagune ?'), [t('La lagune Aby'), t('La lagune Ébrié'), t('La lagune de Fresco')], 1],
      [t('Le quartier des tours et des bureaux, c’est…'), [t('Le Plateau'), t('Abobo'), t('Port-Bouët')], 0],
      [t('La forêt en pleine ville, c’est…'), [t('Le mont Nimba'), t('La forêt de Taï'), t('Le parc du Banco')], 2],
      [t('Quelle ville, ancienne capitale, est classée à l’UNESCO ?'), [t('San-Pédro'), 'Grand-Bassam', t('Korhogo')], 1],
      [t('La capitale politique du pays ?'), [t('Yamoussoukro'), t('Bouaké'), t('Daloa')], 0],
    ],
  },
  'visite-musee': {
    engine: 'choisir', title: t('Les trésors du musée'), how: t('Le guide raconte une œuvre : touche celle dont il parle avant le groupe d’écoliers.'), decor: 'parquet', caller: t('Le guide'),
    items: [{ name: t('Le masque dan'), prop: 'masque' }, { name: t('La statue baoulé'), prop: 'statue' }, { name: t('Le balafon sénoufo'), prop: 'balafon' }, { name: t('Le tam-tam parleur'), prop: 'tam-tam' }, { name: t('La calebasse gravée'), prop: 'calebasse' }],
  },

  // The gaming room
  'regarder-console': {
    engine: 'repondre', title: t('Le consultant du canapé'), how: t('Ton pote joue à la console et tu commentes : encourage sans le saboter.'), decor: 'parquet', npc: 'ami',
    lines: [
      [t('Il vient de m’égaliser à la dernière minute !'), [t('Tu es nul.'), t('Respire, la prolongation est pour toi !'), t('Donne la manette, je vais jouer.')], 1],
      [t('Je fais quelle équipe, à ton avis ?'), [t('Les Éléphants, toujours !'), t('Peu importe, tu vas perdre.'), t('Je sais pas.')], 0],
      [t('J’ai perdu… encore.'), [t('Normal.'), t('Je vais le dire à tout le quartier.'), t('La revanche, on la gagne ensemble !')], 2],
    ],
  },

  // The gym
  'abonnement-salle': {
    engine: 'repondre', title: t('L’abonnement du mois'), how: t('L’accueil te présente la salle : réponds bien pour repartir avec ta carte.'), decor: 'parquet', npc: 'agent',
    lines: [
      [t('Bonjour ! C’est pour un abonnement ?'), [t('Oui, pour le mois, je suis motivé·e !'), t('Non, je passais.'), t('C’est gratuit ?')], 0],
      [t('Vous venez plutôt matin ou soir ?'), [t('Jamais.'), t('Le soir, après le boulot.'), t('Quand il pleut.')], 1],
      [t('Pensez à apporter votre serviette, hein.'), [t('J’utiliserai celle du voisin.'), t('Pourquoi ?'), t('Promis, et ma bouteille d’eau aussi !')], 2],
    ],
  },
  'boxe-sac': {
    engine: 'rythme', title: t('Le sac de frappe'), how: t('Poing, pied, sifflet du coach : frappe chaque coup pile quand il passe la ligne.'), decor: 'parquet', lanes: ['cible', 'chaussure', 'sifflet'], tempo: 110,
  },
  cardio: {
    engine: 'course', title: t('Tapis et vélo'), how: t('Pédale à fond : attrape les cœurs pour le souffle, évite les burgers qui alourdissent.'), decor: 'parquet', mode: 'velo', good: 'coeur', bad: 'burger',
  },
  'corde-a-sauter': {
    engine: 'tenir', title: t('Corde à sauter'), how: t('La corde tourne : tiens pour prendre l’élan, lâche dans le vert pour sauter au bon moment.'), decor: 'parquet', object: 'corde', verb: t('Saute'), fill: 'force', times: 6,
  },
  'cours-collectif': {
    engine: 'rythme', title: t('Zumba collective'), how: t('Le coach lance la musique : suis les pas avec tout le groupe, note après note.'), decor: 'parquet', lanes: ['tapis-yoga', 'note-musique', 'sifflet'],
  },
  'douche-vestiaire': {
    engine: 'nettoyer', title: t('La douche du vestiaire'), how: t('Après l’effort, la mousse partout : rince chaque bulle de savon.'), decor: 'carrelage', object: 'serviette', bit: 'mousse', verb: t('Rince'),
  },
  musculation: {
    engine: 'tenir', title: t('Développé couché'), how: t('Pousse l’haltère : tiens l’effort et relâche dans le vert, série après série.'), decor: 'parquet', object: 'haltere', verb: t('Pousse'), fill: 'force', times: 5,
  },
  tractions: {
    engine: 'equilibre', title: t('Tractions à la barre'), how: t('Monte à la barre sans te balancer : garde le corps bien droit jusqu’en haut.'), decor: 'parquet', carry: 'haltere', verb: t('Monte'), distance: 80,
  },

  // Happenings in the street
  'label:Aider à déboucher le caniveau': {
    engine: 'nettoyer', title: t('Le caniveau bouché'), how: t('Avant la pluie, tout le quartier s’y met : retire chaque feuille qui bouche le caniveau.'), decor: 'bitume', object: 'pelle', bit: 'feuille', verb: t('Retire'),
  },
  'label:Aller au concert du FEMUA': {
    engine: 'attraper', title: t('La folie du FEMUA'), how: t('Les artistes lancent des souvenirs à la foule : attrape-les, laisse filer les sachets d’eau.'), decor: 'scene', from: 'micro', into: 'sac',
    good: [{ name: t('La casquette de l’artiste'), prop: 'casquette' }, { name: t('La serviette de scène'), prop: 'serviette' }, { name: t('Le ticket VIP'), prop: 'ticket' }],
    bad: [{ name: t('Le sachet d’eau'), prop: 'sachet-eau' }],
  },
  'label:Aller au stade': {
    engine: 'photo', title: t('Un soir au stade'), how: t('Allez les Éléphants ! Capture les grands moments du match depuis les tribunes.'), decor: 'herbe',
    subjects: [{ name: t('Le ballon au fond des filets'), prop: 'ballon-foot' }, { name: t('Les drapeaux orange-blanc-vert'), prop: 'drapeau' }, { name: t('L’arbitre qui siffle'), prop: 'sifflet' }, { name: t('Le trophée'), prop: 'trophee' }],
  },
  'label:Aller danser': {
    engine: 'rythme', title: t('Sur la piste'), how: t('Le son est lancé : enchaîne les pas sur la ligne pour enflammer la piste.'), decor: 'parquet', lanes: ['chaussure', 'note-musique', 'coeur'],
  },
  'label:Assister à la réunion et cotiser': {
    engine: 'repondre', title: t('La réunion du quartier'), how: t('La présidente de l’association parle : participe avec sagesse et bonne humeur.'), decor: 'terre', npc: 'maman',
    lines: [
      [t('Qui n’a pas encore cotisé pour les lampadaires ?'), [t('Moi, voilà ma part !'), t('Pas moi, je suis pas concerné.'), t('Les lampadaires c’est inutile.')], 0],
      [t('On fait quoi pour les ordures du marché ?'), [t('Rien.'), t('Un samedi de salubrité tous ensemble !'), t('On les jette chez le voisin.')], 1],
      [t('La réunion a commencé avec une heure de retard…'), [t('C’est la faute à la présidente.'), t('Je m’en vais.'), t('L’heure ivoirienne, mais on est là, c’est l’essentiel !')], 2],
    ],
  },
  'label:Causer avec les voisins à la lampe': {
    engine: 'quiz', title: t('Devinettes à la lampe'), how: t('Le vieux du quartier lance ses devinettes à la lumière de la lampe : trouve la réponse.'), decor: 'terre', host: 'vieux',
    questions: [
      [t('J’ai des dents mais je ne mange jamais. Qui suis-je ?'), [t('Le peigne'), t('Le chien'), t('Le bébé')], 0],
      [t('Plus on m’enlève de terre, plus je deviens grand.'), [t('Le pagne'), t('Le trou'), t('Le riz')], 1],
      [t('Je cours toujours, mais je n’ai pas de jambes.'), [t('Le gbaka'), t('Le margouillat'), t('La rivière')], 2],
      [t('Qu’est-ce qui monte et ne descend jamais ?'), [t('L’âge'), t('Le cerf-volant'), t('Le prix du garba')], 0],
    ],
  },
  'label:Chanter « Joyeux anniversaire »': {
    engine: 'rythme', title: t('Joyeux anniversaire !'), how: t('Tout le monde chante autour du gâteau : tape chaque note pile pour ne pas chanter faux.'), decor: 'table', lanes: ['gateau', 'bougie', 'ballon-fete'], tempo: 90,
  },
  'label:Cotiser à la tontine': {
    engine: 'choisir', title: t('Le jour de la tontine'), how: t('La présidente réclame chaque chose : tends-lui la bonne avant les autres membres.'), decor: 'table', caller: t('La présidente'),
    items: [{ name: t('Le billet de 10 000'), prop: 'billet' }, { name: t('La pièce de 500'), prop: 'piece' }, { name: t('Le cahier de la tontine'), prop: 'cahier' }, { name: t('Le stylo'), prop: 'stylo' }, { name: t('La calculatrice'), prop: 'calculatrice' }],
  },
  'label:Danser avec la foule': {
    engine: 'rythme', title: t('La foule danse'), how: t('Les tam-tams appellent tout le quartier : suis le rythme du djembé au balafon.'), decor: 'terre', lanes: ['djembe', 'tam-tam', 'balafon'],
  },
  'label:Danser avec le cortège': {
    engine: 'equilibre', title: t('Le cortège qui danse'), how: t('Danse avec la calebasse sur la tête comme les mamans du cortège : elle ne doit pas tomber.'), decor: 'bitume', carry: 'calebasse', verb: t('Danse'), distance: 100,
  },
  'label:Donner un coup de main': {
    engine: 'nettoyer', title: t('Un coup de main'), how: t('La cour est poussiéreuse après la fête : balaie chaque tas de poussière.'), decor: 'terre', object: 'tapis', bit: 'poussiere', verb: t('Balaie'),
  },
  'label:Faire la tournée des vœux': {
    engine: 'repondre', title: t('La tournée des vœux'), how: t('De porte en porte, on présente ses vœux : trouve les mots qui font sourire les aînés.'), decor: 'terre', npc: 'vieux',
    lines: [
      [t('Ah, mon enfant, tu es venu me saluer ?'), [t('Bonne année, papa ! Santé, longue vie et prospérité !'), t('Oui, tu me donnes combien ?'), t('Je passais seulement.')], 0],
      [t('Et toi, qu’est-ce que tu souhaites cette année ?'), [t('Rien.'), t('Que la famille reste unie, et un bon travail !'), t('Ton argent.')], 1],
      [t('Prends un peu de gâteau avant de partir.'), [t('C’est sec.'), t('Non merci, je suis pressé.'), t('Merci, papa, que Dieu te bénisse !')], 2],
    ],
  },
  'label:Féliciter les parents': {
    engine: 'assembler', title: t('Le panier du bébé'), how: t('Prépare le cadeau de naissance pour les parents : pose chaque chose dans l’ordre.'), decor: 'table', base: 'carton',
    parts: [{ name: t('Le pagne pour la maman'), prop: 'pagne' }, { name: t('Le biberon'), prop: 'biberon' }, { name: t('Le savon du bébé'), prop: 'savon' }, { name: t('La peluche'), prop: 'peluche' }],
  },
  'label:Fêter avec le quartier': {
    engine: 'photo', title: t('La fête au quartier'), how: t('Musique, drapeaux, ballons : prends en photo les meilleurs moments de la fête.'), decor: 'bitume',
    subjects: [{ name: t('Les drapeaux'), prop: 'drapeau' }, { name: t('Les ballons'), prop: 'ballon-fete' }, { name: t('Le djembé'), prop: 'djembe' }, { name: t('Les pétards de joie'), prop: 'etoile' }],
  },
  'label:Jouer avec eux': {
    engine: 'course', title: t('Attrape-moi si tu peux'), how: t('Les enfants jouent à la poursuite : cours, ramasse les jouets, saute les cailloux.'), decor: 'terre', mode: 'pied', good: 'jouet', bad: 'caillou',
  },
  'label:Jouer un match': {
    engine: 'viser', title: t('Le match du quartier'), how: t('Deux briques pour poteaux : vise le coin, dose ta frappe et marque pour ton équipe.'), decor: 'terre', projectile: 'ballon-foot', target: 'but',
  },
  'label:Montrer ses papiers': {
    engine: 'choisir', title: t('Contrôle de routine'), how: t('Le policier te demande tes papiers un par un : tends le bon, sans t’énerver.'), decor: 'bitume', caller: t('Le policier'),
    items: [{ name: t('La carte d’identité'), prop: 'badge' }, { name: t('Le passeport'), prop: 'passeport' }, { name: t('Le ticket du gbaka'), prop: 'ticket' }, { name: t('Le téléphone'), prop: 'telephone' }, { name: t('Les clés'), prop: 'cle' }],
  },
  'label:Offrir des bonbons aux enfants': {
    engine: 'choisir', title: t('Les bonbons du quartier'), how: t('Chaque enfant crie ce qu’il veut : donne-lui la bonne douceur avant qu’il pleure.'), decor: 'terre', caller: t('Les enfants'),
    items: [{ name: t('Le bonbon'), prop: 'bonbon' }, { name: t('La glace'), prop: 'glace' }, { name: t('Le ballon'), prop: 'ballon-fete' }, { name: t('Le gâteau'), prop: 'gateau' }, { name: t('Le jus'), prop: 'jus' }],
  },
  'label:Partager le repas de fête': {
    engine: 'assembler', title: t('Le plat de fête'), how: t('Les tanties servent : monte chaque assiette dans l’ordre réclamé par les invités.'), decor: 'table', base: 'assiette',
    parts: [{ name: t('Le riz'), prop: 'riz' }, { name: t('Le poulet'), prop: 'poulet' }, { name: t('L’alloco'), prop: 'alloco' }, { name: t('L’attiéké'), prop: 'attieke' }, { name: t('Le piment'), prop: 'piment' }],
  },
  'label:Partager un moment avec les voisins': {
    engine: 'repondre', title: t('Entre voisins'), how: t('La voisine t’invite à t’asseoir dans la cour : réponds chaleureusement.'), decor: 'terre', npc: 'maman',
    lines: [
      [t('Assieds-toi, je t’offre un thé ?'), [t('Avec plaisir, tantie, merci !'), t('Pas le temps.'), t('Il est sucré au moins ?')], 0],
      [t('Ma fille passe le BAC cette année…'), [t('Elle va rater.'), t('Elle va réussir, on va prier pour elle !'), t('Et alors ?')], 1],
      [t('Le courant a encore coupé hier soir !'), [t('C’est de ta faute.'), t('Tant mieux.'), t('On a causé à la lampe, c’était sympa quand même !')], 2],
    ],
  },
  'label:Passer voir les promos': {
    engine: 'attraper', title: t('La chasse aux promos'), how: t('Les articles en promo tombent des rayons : attrape les bonnes affaires, laisse les prix gonflés.'), decor: 'etagere', from: 'carton', into: 'chariot',
    good: [{ name: t('Le sac de riz en promo'), prop: 'riz' }, { name: t('Le savon à moitié prix'), prop: 'savon' }, { name: t('Les chaussures soldées'), prop: 'chaussure' }, { name: t('Le sac soldé'), prop: 'sac' }],
    bad: [{ name: t('Le prix gonflé'), prop: 'ticket' }],
  },
}
