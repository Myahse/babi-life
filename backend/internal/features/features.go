// Package features holds the game's updates: the features that ship closed
// and that the team opens one by one from the admin (web screens/Admin.tsx,
// « Mises à jour »), now or at a set moment, so the game seems to grow as the
// weeks go by. A closed feature is hidden on the phone (GET /features says
// what to hide) and refused by the server (sims: Blocks).
package features

import (
	"context"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/world"
)

// Feature is one update: its name and what it is for the team, the place
// activities it opens (catalog interaction IDs, refused while closed), and the
// phone's keys it shows (apps, modes: web lib/features.ts).
type Feature struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// About: what the players read when it opens (never anything of the server's).
	About string `json:"about"`
	// Note: for the team only, in the admin (a key to set, a date to pick).
	Note         string   `json:"note,omitempty"`
	Interactions []string `json:"interactions,omitempty"`
	Keys         []string `json:"keys,omitempty"`
	// Replaces: older place activities this update takes the place of, hidden and
	// refused once it's open (while it's closed they stay as they were).
	Replaces []string `json:"replaces,omitempty"`
	// Places: the places and communes it brings (world.go), hidden from the world while it's closed and refused by the server.
	Places []string `json:"places,omitempty"`
}

// List is every update, in the order they're meant to come (each new feature is added here, closed).
var List = []Feature{
	{ID: "foot11", Label: "Le foot au stade, 11 contre 11", About: "Le 11 contre 11 à la console et le match entre amis au stade (22 places).", Interactions: []string{"play-foot11"}, Keys: []string{"foot11"}},
	{ID: "foot-coupe", Label: "La Coupe de foot", About: "Huit équipes, tirs au but ou but en or, à la console de la salle de jeux.", Keys: []string{"foot-coupe"}},
	{ID: "foot-carriere", Label: "La carrière foot", About: "Le club du quartier, son championnat de 7 journées et le marché des joueurs (payés en Djai).", Keys: []string{"foot-carriere"}},
	{ID: "combat", Label: "Le combat de rue en 3D", About: "Le jeu de combat de la salle de jeux, contre Petit Yao, la Go de Yop et le Boss d'Adjamé.", Interactions: []string{"console-combat", "maison-combat"}},
	{ID: "course", Label: "La course à deux", About: "La course de voitures de la salle de jeux, dans la ville au crépuscule.", Interactions: []string{"console-course", "maison-course"}},
	{ID: "kart", Label: "Babi Karting", About: "Les courses de kart à Marcory : sept objets, les pièces, les tremplins, entre joueurs.", Interactions: []string{"course-kart", "regarder-kart"}},
	{ID: "arcade", Label: "La borne d'arcade", About: "« Moustiques ! » à la borne de la salle de jeux.", Interactions: []string{"borne-arcade"}},
	{ID: "tikitoko", Label: "Tikitoko", About: "L'appli des vidéos courtes dans le téléphone du perso.", Keys: []string{"app:tikitoko"}},
	{ID: "babigram", Label: "Babigram", About: "L'appli des photos dans le téléphone du perso.", Keys: []string{"app:babigram"}},
	{ID: "historique", Label: "L'historique des jeux d'argent", About: "Dans chaque jeu du casino, au bingo, aux paris et au loto : tes dernières parties, ce que tu as misé et récupéré aujourd'hui et sur 7 jours.", Keys: []string{"historique"}},
	// The phone's apps (each one hidden in the Store and on the phone, and refused by the server, until opened).
	{ID: "app-waye", Label: "Waye", About: "Envoyer et recevoir de l'argent entre amis, depuis le téléphone du perso.", Keys: []string{"app:waye"}},
	{ID: "app-gbairai", Label: "Gbairai", About: "La messagerie des amis et des groupes.", Keys: []string{"app:gbairai"}},
	{ID: "app-flashe", Label: "Flashé", About: "Payer en flashant le code des commerçants.", Keys: []string{"app:flashe"}},
	{ID: "app-golvo", Label: "Garbaya", About: "La livraison de repas à domicile, le livreur qui arrive en moto.", Keys: []string{"app:golvo"}},
	{ID: "app-dodo", Label: "Dodo", About: "Réserver une maison ou un appartement pour quelques nuits.", Keys: []string{"app:dodo"}},
	{ID: "app-kineo", Label: "Kinéo", About: "Le cinéma : les films à l'affiche et les places.", Keys: []string{"app:kineo"}},
	{ID: "app-bolide", Label: "Bolide", About: "Acheter son vélo, sa moto ou sa voiture, et la conduire en ville.", Keys: []string{"app:bolide"}},
	{ID: "app-gnango", Label: "Gnango", About: "Commander un taxi et faire le trajet dedans.", Keys: []string{"app:gnango"}},
	{ID: "app-idrive", Label: "iDrive", About: "Les VTC : une voiture avec chauffeur jusqu'à ta destination.", Keys: []string{"app:idrive"}},
	{ID: "app-dames", Label: "Dames 225", About: "Le jeu de dames contre les gens du quartier ou un ami.", Keys: []string{"app:dames"}},
	{ID: "app-huit", Label: "8 américain", About: "Le jeu de cartes, contre le quartier ou entre amis.", Keys: []string{"app:huit"}},
	{ID: "app-awale", Label: "Awalé 225", About: "L'awalé sur le téléphone, contre l'ordinateur à trois niveaux, sans mise.", Keys: []string{"app:awale"}},
	{ID: "app-gode", Label: "Godé", About: "Le dé du maquis sur le téléphone : un dé chacun, « mon grand » ou « mon petit », on mise à chaque manche contre les gars du quartier (18 ans et plus).", Keys: []string{"app:gode"}},
	{ID: "app-ludo", Label: "Ludo 225", About: "Le Ludo sur le téléphone, à deux ou à quatre contre l'ordinateur, sans mise.", Keys: []string{"app:ludo"}},
	{ID: "app-bet225", Label: "Bet225", About: "Les paris sur les matchs du jeu (18 ans et plus).", Keys: []string{"app:bet225"}},
	{ID: "app-parisfoot", Label: "ParisFoot", About: "L'autre appli de paris, ses cotes et ses combinés (18 ans et plus).", Keys: []string{"app:parisfoot"}},
	{ID: "app-bingo", Label: "Babi Bingo", About: "Quatre salles de bingo, une partie toutes les quelques minutes (18 ans et plus).", Keys: []string{"app:bingo"}},
	{ID: "app-casino", Label: "Babi Casino", About: "La roulette, le 21, les tickets à gratter, L'Envol et Babi Trade (18 ans et plus).", Keys: []string{"app:casino"}},
	// What isn't an app.
	{ID: "soirees", Label: "Organiser une soirée", About: "Inviter ses amis chez soi ou dans un lieu, la musique, à boire, la soirée qui dure.", Keys: []string{"soiree"}},
	{ID: "politique", Label: "La politique", About: "Les élections du quartier et du pays, les campagnes, la présidence.", Keys: []string{"app:politique"}},
	{ID: "loto", Label: "Le loto", About: "Les kiosques Loto Chance dans les rues et leurs tirages.", Keys: []string{"loto"}},
	{ID: "machines", Label: "Les machines à sous", About: "Aux maquis et au casino de l'Hôtel Ivoire (18 ans et plus).", Interactions: []string{"machine-maquis", "machine-casino"}},
	{ID: "casino-ivoire", Label: "La soirée au casino de l'Hôtel Ivoire", About: "Passer la soirée au casino du grand hôtel.", Interactions: []string{"casino-ivoire"}},
	{ID: "tournoi-console", Label: "Le tournoi console du samedi", About: "Quart, demie et finale à la salle de jeux, la coupe à gagner.", Interactions: []string{"tournoi-console"}},
	{ID: "console-defi", Label: "Le défi console « le perdant paie »", About: "Défier un gars du quartier à la console, le perdant paie.", Interactions: []string{"console-defi"}},
	{ID: "metro", Label: "Le métro d'Abidjan (ligne 1)", About: "La ligne 1, d'Anyama à Port-Bouët par Abobo, Adjamé, le Plateau, Treichville, Marcory et Koumassi : un ticket, pas d'embouteillage.", Note: "Mets sa date d'ouverture : il ouvre tout seul ce jour-là.", Keys: []string{"metro"}},
	{ID: "boutiques", Label: "Les boutiques de vêtements et la garde-robe", About: "Au centre commercial et chez les vendeuses de wax du marché : près de 60 pièces de marques d'ici (Babi Denim, Kôrô Wear, Wax d'Adjamé, Bogolan & Co…) à essayer et acheter une par une, rangées dans ta garde-robe.", Interactions: []string{"boutique-mode", "boutique-wax"}},
	{ID: "traverser", Label: "Aider les anciens à traverser", About: "Au bord des rues, une maman ou un vieux père attend pour traverser et te demande un coup de main : vous traversez ensemble.", Interactions: []string{"street-traverser"}},
	{ID: "parler-libre", Label: "Parler librement aux gens", About: "Dans la discussion avec un passant, tu tapes ce que tu veux comme dans une vraie conversation, et il te répond avec ses propres mots, dans son personnage (son métier, son quartier, votre entente).", Note: "Il faut la clé NPC_CHAT_KEY sur Render (Groq, gratuit).", Keys: []string{"chat-libre"}},
	{ID: "lot-carte", Label: "Choisir son terrain dans la ville", About: "Quand tu achètes un terrain dans la commune où tu es, la caméra monte au-dessus du quartier et ton terrain apparaît dans la ville en 3D, au bord de la rue : tu fais glisser la vue, il passe au vert là où c'est libre, au rouge sur la route, dans l'eau, sur une maison ou chez un voisin, et ta maison sera bâtie exactement là. Pour une autre commune, tu choisis sur la carte. Un terrain encore vide se déplace aussi.", Keys: []string{"lot-carte"}},
	{ID: "postures", Label: "S'asseoir par terre, s'adosser à un arbre", About: "Dans les émotes, « Se poser » : ton perso s'assoit par terre où il est, les genoux relevés, ou s'adosse à l'arbre le plus proche, bras croisés, un pied contre le tronc. Il reste ainsi jusqu'à ce que tu repartes, et les autres joueurs le voient.", Keys: []string{"postures"}},
	{ID: "deco-premium", Label: "Meubles de luxe et déco", About: "Dans « Meubles » de ta maison, de nouveaux rayons : Confort et Prestige. Lit à baldaquin, canapé d'angle en cuir, écran géant, cuisine avec îlot, frigo américain, douche à l'italienne, baignoire balnéo, piano à queue, aquarium, masque en bronze… et le lavabo avec son miroir pour se brosser les dents. Tu peux aussi déplacer un meuble sans le racheter.", Keys: []string{"deco-premium", "deplacer-meubles"}},
	{ID: "console-maison", Label: "La console de jeux à la maison", About: "Une console et son écran à poser chez toi : Babi Foot, la course à deux et le combat de rue, comme à la salle de jeux, sans payer la partie.", Interactions: []string{"maison-foot", "maison-course", "maison-combat"}, Keys: []string{"console-maison"}},
	{ID: "frigo", Label: "Le frigo qu'on remplit", About: "Au marché ou au supermarché, « Remplir le frigo » : bissap, yaourts, attiéké-poisson, alloco… rangés dans ton frigo. À la maison, ouvre le frigo et sers-toi quand tu as faim.", Keys: []string{"frigo"}},
	{ID: "ecole-vivante", Label: "L'école et la crèche en vrai", About: "Bébé, « Aller à la crèche » : les tapis, les jouets, les nounous et les autres bébés. Enfant et ado, « Aller à l'école » se voit : la classe aux tables-bancs, le maître au tableau, la récré dans la cour sous le manguier, puis retour en classe. Et « Lever la main » : six questions du maître (calcul, français, la Côte d'Ivoire…) ; bien répondre compte pour le bac.", Interactions: []string{"creche"}, Keys: []string{"ecole-vivante"}},
	{ID: "ami-enfance", Label: "L'ami d'enfance", About: "À la crèche ou à l'école, tu te fais un ami d'enfance. Il grandit avec toi : à côté de toi en classe, avec toi à la récré, et il reste ton ami à 18 ans.", Keys: []string{"ami-enfance"}},
	{ID: "mentor", Label: "Le mentor", About: "À 18 ans, un mentor proche de ta famille te prend sous son aile : dans le téléphone, l'appli Mentor. Il te donne des conseils pour ta vie d'adulte et, de temps en temps, un coup de main.", Keys: []string{"mentor"}},
	{ID: "bebe-besoins", Label: "Les bêtises du bébé", About: "Le bébé bien nourri peut faire caca, faire pipi, vomir ou pleurer. Papa et maman s'exclament, et maman nettoie tout (ou te console).", Interactions: []string{"caca", "pipi", "vomir", "pleurer"}},
	{ID: "immobilier", Label: "Immobilier : immeubles, commerces et tours", About: "Après ta maison, deviens propriétaire : sur une parcelle de 1 000 m², bâtis un immeuble de rapport (huit appartements) ou un immeuble avec un commerce en bas ; sur un îlot de 2 500 m², une tour de bureaux de quinze niveaux. Les locataires paient un loyer chaque jour tant que l'immeuble est entretenu ; au rez-de-chaussée, ouvre une boutique, un maquis, une pharmacie… et embauche du monde. Tu encaisses depuis l'appli Logement, l'impôt en moins. Et tes terrains, tu les prends où tu veux : plus de limite par commune.", Note: "Les loyers ont leur propre plafond du jour (100 000 Djai), hors du total gagné en jouant, comme Dodo.", Keys: []string{"immobilier"}},
	{ID: "mon-quartier", Label: "Mon quartier et Babi en ligne", About: "Chaque joueur a son propre quartier autour de chez lui, comme un quartier des Sims : la vue du quartier montre tout le voisinage (environ 1,2 km de vraies rues) avec chaque terrain marqué (les siens, ceux des autres joueurs, les maquis, boutiques, écoles, églises et mosquées de la commune), et on joue un terrain à la fois, chargé en un instant. Une seule chose « à faire maintenant », et des bâtiments qu'il ouvre lui-même sur ses terrains libres (boutique, grin, maquis, salon, cabine Mobile Money, terrain, arrêt de gbaka, école, marché, salle des fêtes…). Sa réputation monte avec ses bâtiments, leurs clients, les visites et les demandes faites ; chaque niveau débloque de nouveaux bâtiments. Les gains s'encaissent depuis « Gérer mon quartier ». Babi en ligne se rejoint en un bouton : les communes où il y a du monde, les soirées, les matchs et les concerts. On peut visiter le quartier de ses amis.", Note: "Les gains du quartier partagent le plafond du jour des loyers (100 000 Djai), l'impôt en moins.", Keys: []string{"mon-quartier"}},
	{ID: "testeurs-android", Label: "Deviens testeur de l'appli Android", About: "Babi Life arrive sur le Play Store : une carte invite les joueurs sur un téléphone Android à tester l'appli pendant 14 jours (rejoindre le groupe des testeurs, accepter le test, installer l'appli).", Note: "Colle d'abord les deux liens dans « Testeurs de l'appli » (le groupe Google et la page de test du Play Store) : sans eux, la carte ne s'affiche pas.", Keys: []string{"testeurs-android"}},
	{ID: "babi-quartiers", Label: "Babi, quartier par quartier", About: "Le monde de Babi n'est plus une seule grande ville ouverte : on est dans un vrai quartier à la fois (la Rue Princesse, Sideci, le Plateau des tours, Angré, la Riviera, le marché de Koumassi…), ses vraies rues chargées en un instant, vues d'en haut comme dans un jeu de vie, le reste de la ville au loin. Au bout du quartier, ou depuis la carte et « Les quartiers », on part en taxi vers un autre. Un lieu d'un autre quartier ? Le taxi t'y dépose.", Keys: []string{"babi-quartiers"}},
	{ID: "grandir-vite", Label: "Grandir tout de suite", About: "On grandit en jouant : le bébé devient enfant après ses premières fois, l'enfant devient ado après ses étapes, et l'ado devient adulte après 1 h de jeu. Pressé ? Dans la Boutique, grandir tout de suite : bébé → enfant 1 000 F, enfant → ado ou ado → adulte 2 000 F, bébé → ado 3 000 F, bébé → adulte 5 000 F.", Keys: []string{"grandir-vite"}},
	{ID: "looks-age", Label: "Un look pour chaque âge", About: "Dans « Changer de look », le bébé a ses habits (grenouillère, body, petite robe, ensemble en pagne, petite salopette), sa tétine, son bavoir, son bonnet et son hochet ; l'enfant son tee-shirt et short, sa robe à volants, son pyjama, son cartable, ses barrettes, sa sucette, ses couettes et ses nattes à perles ; l'ado son tee large et cargo, son crop top, son maillot de club, ses écouteurs et son sac à dos. Jusqu'à 18 ans, c'est maman qui coiffe : gratuit.", Keys: []string{"looks-age"}},
	// The game itself, for every account (auth.GameGate, web lib/launch.ts useGameOpen): set its day and hour here
	// and it opens by itself (GAME_OPEN=true opens it anyway). Not one of the « Nouveau » news.
	{ID: OpeningID, Label: "L'ouverture de Babi Life", About: "Le jeu s'ouvre à tous les comptes : la liste d'attente entre dans les rues. Programme le jour et l'heure, il s'ouvre tout seul.", Keys: []string{"jeu"}},
	{ID: "pubs-applis", Label: "Les pubs dans les applis", About: "Babi Pub ne s'arrête plus aux panneaux : les annonceurs passent aussi entre les vidéos de Tikitoko, dans le fil de Babigram, et ceux qui ont une appli ou un site ont leur icône sur l'écran du téléphone (un toucher ouvre leur lien).", Keys: []string{"pubs-applis"}},
	{ID: "gbairai-bebe", Label: "Gbairai dès le berceau", About: "Bébés et enfants ont Gbairai eux aussi, sans attendre leur téléphone à 12 ans : ils écrivent à leurs amis du jeu (toujours seulement à leurs amis, liens et numéros masqués).", Keys: []string{"gbairai-bebe"}},
	{ID: "frais-operateur", Label: "Les frais de l'opérateur", About: "À la Boutique, avant de payer, tu choisis Wave, Orange Money, MTN Money ou Moov Money : tu vois les frais de chacun (Wave 1,5 %, les autres 3,5 %) et le total, avant d'aller sur la page de paiement.", Keys: []string{"frais-operateur"}},
	{ID: "arrivee", Label: "L'arrivée à Babi", About: "La première fois dans le jeu : la caméra survole ta commune, ses rues et ses gens, puis « Bienvenue à Babi Life » et le message d'Awa, avant que Koffi te fasse le tour.", Keys: []string{"arrivee"}},
	{ID: "famille-liste", Label: "Retrouver sa famille de la liste", About: "Ceux qui avaient créé leur perso sur la liste d'attente avant que le compte le reprenne peuvent retrouver la famille (et la commune) tirée sur la liste, ou garder la leur : une seule fois.", Keys: []string{"famille-liste"}},
	{ID: "ambiance-sonore", Label: "Le son de la rue", About: "La pluie s'entend (étouffée sur le toit quand on est dedans) ; l'orage gronde ; la rue bourdonne, un taxi klaxonne au loin ; les oiseaux le jour, les grillons la nuit.", Keys: []string{"ambiance-sonore"}},
	{ID: "bebe-jeux", Label: "Les jeux de bébé", About: "Coucou-caché avec maman ; la tour de cubes ; les premiers pas vers papa ; le hochet en rythme. Quatre petits jeux pour le bébé, avec un score à battre.", Interactions: []string{"coucou", "cubes", "premiers-pas"}, Keys: []string{"bebe-jeux"}},
	{ID: "foot-de-rue", Label: "Le foot de rue (gestes techniques)", About: "Dans la rue, au terrain du quartier et au match de quartier, le foot n'est plus celui de la console : quatre contre quatre sur la terre battue entre les murs, des petites cages en fer, le premier à cinq. Et les gestes : passement de jambes, roulette, petit pont, sombrero, feinte de frappe, aile de pigeon, talonnade, jongles. Bien placés devant un défenseur, il est dans le vent ; la jauge de style pleine, c'est le Gbê.", Keys: []string{"foot-de-rue"}},
	// The courts of the quarter and the street's basketball (web streetball/game.ts Rules.street, streetball/panier.tsx), not the Palais des Sports' arena; at a court, eight places (court.Cap "basket-rue").
	{ID: "basket-de-rue", Label: "Le basket de rue (gestes techniques)", About: "Au terrain de basket du quartier et dans la rue, le basket n'est plus celui de la salle : trois contre trois sous un panier en fer soudé, sur le béton fissuré entre les murs peints, le quatrième attend derrière le mur. Le premier à 11 (2 points derrière l'arc), qui marque garde la balle. Et les gestes : crossover, entre les jambes, dans le dos, spin, hésitation, le show, feinte de tir, step-back. Bien placés devant le défenseur, il est assis par terre ; la jauge de style pleine, c'est le Gbê, le dunk qui plie le cercle. Et l'alley-oop.", Note: "Fermée : l'ancien match de basket, à l'identique. Ouverte : les terrains du quartier passent à 8 places (6 sur le terrain, un qui attend de chaque côté) dès le match suivant (un match déjà ouvert finit comme il a commencé, on le rejoint). Le Palais des Sports garde l'ancien match.", Keys: []string{"basket-de-rue"}},
	// The Palais des Sports' basketball (web streetball/game.ts Rules.full, streetball/palais.tsx): five a side on the full court at the real size; at its court, ten places (court.Cap "basket-pro").
	{ID: "basket-palais", Label: "Le basket du Palais des Sports (5 contre 5)", About: "Au Palais des Sports de Treichville, on joue enfin le vrai basket : cinq contre cinq sur un terrain à la taille réelle (28,65 m sur 15,24 m, la ligne à 3 points à 7,24 m), le parquet, les deux panneaux en verre, les tribunes pleines. Entre-deux au début, paniers à 2 et 3 points, remises en jeu, les 24 secondes, les fautes et les lancers francs, le jeu à cinq (écrans, pick-and-roll, aide en défense, rebonds). La caméra comme à la télé, le commentateur, et le ralenti après chaque dunk.", Note: "Fermée : le Palais garde l'ancien match à trois contre trois sous un panier. Ouverte : son terrain passe à 10 places dès le match suivant.", Keys: []string{"basket-palais"}},
	// Tennis (web sports/tennis.ts, sports/tennisScene.tsx): the real court and scoring, at the Cocody club, the Plateau's court and the Hôtel Ivoire's; two places at a court (court.Cap "tennis").
	{ID: "tennis", Label: "Le tennis", About: "On joue au tennis, comme à la télé : au Club de tennis de Cocody sur la terre battue, au court du Plateau et à l'Hôtel Ivoire sur dur. Le vrai court (23,77 m sur 8,23 m, le filet à 0,914 m au centre), le vrai comptage (15, 30, 40, égalité, avantage, jeu décisif) en un set court, le service (on lance la balle, on frappe en haut, faute, double faute, let), le coup droit et le revers, le lifté, le slicé, le lob, l'amortie, la volée au filet et le smash. Le juge de ligne crie « Faute ! », l'adversaire a quatre niveaux, et un ami peut venir jouer contre toi sur le même court.", Note: "Ouverte : « Jouer au tennis » aux courts de Cocody et du Plateau et à l'Hôtel Ivoire, deux places par court.", Interactions: []string{game.TennisID, game.HotelTennisID}, Keys: []string{"tennis"}},
	// Volleyball (web sports/volley.ts, sports/volleyScene.tsx): six against six at the Palais des Sports (court.Cap "volley", twelve), beach-volley two against two at Port-Bouët and Grand-Bassam (court.Cap "beach", four).
	{ID: "volley", Label: "Le volley et le beach-volley", About: "Le volley au Palais des Sports : six contre six sur un terrain de 18 m sur 9, le filet à 2,43 m (2,24 m chez les dames), la rotation, trois touches au plus. Et le beach-volley à deux contre deux sur le sable de Port-Bouët et de Grand-Bassam. Réception en manchette, passe, smash au bon moment, contre au filet, défense, feinte ; le point à chaque échange, un set en 15 points. Les coéquipiers jouent avec toi, le ralenti montre les grands smashs, et les amis viennent jouer au même terrain.", Note: "Ouverte : « Jouer au volley » au Palais des Sports (12 places, à côté du basket) et « Jouer un match de beach-volley » aux plages de Port-Bouët et de Grand-Bassam (4 places). À Bassam, l'ancien « Jouer au beach-volley » (sans match) disparaît.", Interactions: []string{game.VolleyID, game.BeachVolleyID}, Keys: []string{"volley"}, Replaces: []string{game.BassamVolleyID}},
	{ID: "soiree-deco", Label: "Aménager sa soirée, entrée libre ou payante", About: "En organisant ta soirée, tu arranges la salle comme ta maison : le comptoir du bar, la sono, les platines, les jeux de lumières, les tables, les chaises, les canapés, les plantes et les tapis, que tu poses, tournes, déplaces ou enlèves. Tes invités la voient telle quelle en entrant. Et tu choisis l'entrée : libre, ou de 500 à 5 000 F, payée par ceux qui viennent (tes amis entrent gratuitement). Sur la carte et dans la rue, chacun voit ta soirée, son prix, son heure et combien sont déjà là.", Note: "Il faut aussi « Organiser une soirée » ouvert. Fermée : les soirées comme avant, gratuites, dans la salle du club.", Keys: []string{"soiree-deco"}},
	{ID: "bagarre-bebe", Label: "La bagarre de bébés", About: "Le bébé se bagarre avec le cousin pour un jouet, comme le combat de rue des grands : coups de poing mous, coups de pied, la garde, la colère de bébé en super. Trois cousins, du plus gentil au plus terrible.", Interactions: []string{"bagarre-bebe"}, Keys: []string{"bagarre-bebe"}},
	{ID: "combat-joueurs", Label: "Le combat entre joueurs", About: "Défier au combat de rue un joueur de sa commune, en direct : il accepte, et chacun se bat depuis son téléphone. Deux bébés se font leur bagarre de bébés.", Keys: []string{"combat-joueurs"}},
	{ID: "gestes-maison", Label: "Les actions se jouent", About: "Chaque action se joue au lieu d'attendre : la douche, la cuisine, le dodo et son rêve, la journée du bébé (caca, pipi, biberon…), le garba (le poisson pioché dans l'huile, l'attiéké qui ne passe pas), l'alloco et son œuf, le pot au maquis (l'alcool à surveiller), et toutes les autres en combinaisons de flèches. Fini, l'action est faite, sans attendre.", Keys: []string{"gestes-maison"}},
	{ID: "trajet-court", Label: "Les trajets courts", About: "En ville, plus besoin d'attendre la fin du trajet : un court écran où le perso monte dans le taxi, le gbaka ou sur la moto, et le voilà arrivé ; il descend, le véhicule repart à toute vitesse.", Keys: []string{"trajet-court"}},
	{ID: "bapteme", Label: "Le baptême", About: "Le bébé est accueilli par toute la famille : les tantes, les oncles, la grand-mère qui lui donne son nom ; on danse, on offre des cadeaux.", Keys: []string{"bapteme"}},
	{ID: "creche-ensemble", Label: "Les bébés ensemble à la crèche", About: "À la crèche, les bébés des autres joueurs sont là aussi : on les voit, on joue avec eux, on peut devenir amis. La crèche est ouverte tous les jours de 7 h à 17 h.", Keys: []string{"creche-ensemble"}},
	{ID: "sonnerie-gbairai", Label: "La sonnerie de Gbairai", About: "Un message Gbairai arrive pendant qu'on joue : le téléphone sonne (« ding-ding »), vibre, et le bouton Téléphone tremble ; une bulle verte compte les nouveaux messages.", Keys: []string{"sonnerie-gbairai"}},
	{ID: "sons-bebe", Label: "La voix du bébé", About: "Étant bébé, on entend sa voix : les pleurs quand il pleure, le petit effort du caca, le « bleh » quand il vomit, les gazouillis et les rires quand il joue, un petit gémissement quand il a faim, sommeil ou besoin d'un bain.", Keys: []string{"sons-bebe"}},
	{ID: "premieres-fois", Label: "Les premières fois du bébé", About: "Le premier sourire, la première bouillie, le premier bain, la première dent, le premier éclat de rire, les premiers pas, le premier jour de crèche, le premier mot : chacune arrive la première fois que le bébé fait ce qu'il faut ; « Mes premières fois 3/8 » montre où il en est ; toutes, et le bébé est aux anges.", Keys: []string{"premieres-fois"}},
	{ID: "choix-bebe", Label: "Les choix du bébé", About: "Parmi les jouets, le bébé va vers le ballon, le tam-tam, le livre ou le téléphone de papa : l'enfant en garde un talent (sportif, artiste, de bonnes notes d'avance, charmeur) ; et son premier mot, choisi par le joueur, reste le sien.", Interactions: []string{"jouets", "premier-mot"}, Keys: []string{"choix-bebe"}},
	{ID: "table", Label: "Les gens viennent te parler dans les lieux", About: "« Je peux m'asseoir à ta table ? » au resto ou au bar (tu acceptes et vous causez, ou tu refuses poliment), et au travail les clients qui viennent te demander de l'aide.", Keys: []string{"table"}},
	{ID: "repondre-message", Label: "Répondre à un message", About: "Dans Gbairai et au grin, glisse un message vers la droite (ou appuie longtemps dessus) pour y répondre : ta réponse le cite, et un toucher sur la citation ramène au message. Sous les vidéos de Tikitoko, « Répondre » sous un commentaire : les réponses s'affichent en dessous, comme sur TikTok.", Keys: []string{"repondre-message"}},
	{ID: "parrainage", Label: "Inviter ses amis (cadeaux)", About: "Dans le téléphone, l'appli Inviter : ton lien à toi, à envoyer sur WhatsApp. Chaque ami qui s'inscrit avec et qui joue un peu t'apporte un cadeau emballé, rangé dans le tiroir à cadeaux de ta maison : un habit, un meuble de déco, de quoi remplir le frigo, des Djai, et parfois une vraie surprise.", Note: "Les inscriptions par lien sont gardées même fermé : elles comptent dès l'ouverture.", Keys: []string{"parrainage"}},
	{ID: "gbairai-parents", Label: "Écrire à papa et maman (dès 3 ans)", About: "Dès 3 ans, bien avant son téléphone à 12 ans, l'enfant a Gbairai avec deux contacts : Papa et Maman. Il leur écrit ce qu'il veut (et des stickers), et ils lui répondent comme de vrais parents d'ici : tendres, drôles, sévères quand il faut (« Tu as fini tes devoirs ? »), au courant de sa journée. Sans « Gbairai dès le berceau », un enfant n'écrit qu'à ses parents.", Note: "Avec « Parler librement aux gens » ouvert et sa clé NPC_CHAT_KEY, ils répondent avec leurs propres mots ; sinon, des réponses toutes prêtes.", Keys: []string{"gbairai-parents"}},
	{ID: "circulation", Label: "Régler la circulation", About: "Un embouteillage dans la rue : les voitures avancent au pas, pare-chocs contre pare-chocs, et klaxonnent. Prends le sifflet et les gants blancs au carrefour : arrête une file, laisse passer l'autre. Bien réglé, le bouchon se vide pour tout le quartier, et les chauffeurs te remercient.", Interactions: []string{"regler-circulation"}, Keys: []string{"circulation"}},
	{ID: "plateau-vivant", Label: "Le Plateau vivant : la foule des bureaux en semaine, désert le week-end, et la chasse aux chauves-souris", About: "En semaine, de 7 h 30 à 18 h, le Plateau déborde : les gens des bureaux en costume ou en pagne sur les trottoirs, badge au cou, mallette à la main, téléphone à l'oreille, les groupes autour des tanties à midi, les voitures garées pare-chocs contre pare-chocs le long des trottoirs et la circulation qui grossit. Le soir, ça se vide ; le week-end, presque personne : quelques gardiens, un joggeur, des trottoirs vides. Et le samedi et le dimanche, dans les grands arbres du Plateau : prends le lance-pierre et le sac de boulettes d'argile, et fais fuir les chauves-souris (elles s'envolent en criant, personne ne leur fait de mal) : chaque arbre dégagé rapporte quelques Djai, une fois par jour.", Note: "Fermée : le Plateau reste comme avant (la même foule et la même circulation que partout, pas de voitures garées, pas de chauves-souris).", Interactions: []string{game.BatsID}, Keys: []string{"plateau-vivant"}},
	{ID: "ville-vivante", Label: "La ville vivante", About: "La rue vit toute seule autour de toi : des joggeurs le matin, la police qui poursuit une voiture toutes sirènes dehors ou un voleur à pied, la tantie et sa bassine, les enfants et leur ballon, un cortège qui klaxonne, la moto qui lève la roue, la voiture en panne qu'on pousse, les vieux au damier sous l'arbre… À regarder en passant.", Keys: []string{"ville-vivante"}},
	{ID: game.EventsKey, Label: "Les événements de la rue se jouent", About: "Ce qui se passe dans la rue ne se regarde plus, il se joue : sous la grosse pluie, cours t'abriter entre les flaques (gare à l'éclaboussure du gbaka), vends des sachets aux passants, danse sous l'averse ou pousse la voiture embourbée. Au délestage, allume la lampe, raconte des contes ou répare le groupe ; au mariage, danse dans le cortège, lance le riz, prends la photo ; devant le match des Éléphants, fais l'ambiance et ton pronostic… Chaque événement a ses choix, chacun son petit jeu, et bien joué, ça rapporte plus.", Note: "Fermée : chaque événement garde sa seule action, comme avant. Le match de foot et le basket de rue restent les vrais matchs ; « Régler la circulation » garde sa propre mise à jour.", Interactions: game.HappeningChoiceIDs(), Keys: []string{game.EventsKey}},
	{ID: "jeux-en-ligne", Label: "Les jeux contre de vrais joueurs", About: "Dans l'appli Jeux, à la salle de jeux et dans Dames 225, 8 américain, Awalé 225, Ludo 225 et Godé : « Jouer contre un joueur ». Défie un ami ou un joueur en ligne dans la ville (le défi arrive dans Gbairai, Accepter ou Refuser), ou « Trouver un adversaire » : la partie se joue en direct, chacun sur son téléphone. Le foot, la course, le combat et la borne en temps réel ; les jeux de plateau coup par coup, avec une minute par coup. Une mise en Djai entre adultes pour les dames, le 8 américain et le godé ; un classement par jeu.", Note: "Fermée : chaque jeu se joue comme avant, contre l'ordinateur (le combat entre joueurs reste sous « Le combat entre joueurs »).", Keys: []string{"jeux-en-ligne"}},
	// The Android app's shop paid through Google Play Billing (shop/play.go, web lib/play.native.ts); the website keeps GeniusPay.
	{ID: "paiement-google", Label: "Paiement Google Play dans l'appli", About: "Dans l'appli Android, la Boutique s'ouvre : les packs de Djai, le Babi Pass, les coups de pouce et les vêtements exclusifs se paient avec Google Play, comme dans toutes les applis du Play Store (carte, Orange Money, MTN, solde Google Play…).", Note: "Il faut le compte de service GOOGLE_PLAY_SERVICE_ACCOUNT sur Render et les produits créés dans la Play Console (native/README.md, « Paiements Google Play »). Fermée : dans l'appli, la Boutique ne vend rien (les Djai se gagnent en jouant) ; le site garde GeniusPay, ouvert ou fermé.", Keys: []string{"paiement-google"}},
	// The game in English (web lib/i18n.ts, i18n/lang-en.json; the server's answers: internal/i18n). Closed: French for everyone, whatever the phone's language.
	{ID: "anglais", Label: "Le jeu en anglais", About: "Babi Life parle aussi anglais : dans le téléphone, « Réglages » › « Langue », choisis Français ou English. Un téléphone en anglais ouvre le jeu en anglais. Les mots d'ici restent les nôtres : garba, alloco, gbaka, maquis, Djai.", Note: "Fermée : tout le monde en français, même un téléphone en anglais ; le choix de langue n'est pas montré. Ouverte : un téléphone en anglais passe en anglais à sa prochaine ouverture.", Keys: []string{"anglais"}},
	// Growing up by milestones (sims/grandir.go, web components/Firsts.tsx, GrowUpParty.tsx): the baby a child once its
	// « premières fois » are done, the child a teenager once its « étapes » are; from the teenager on, as before.
	// From city to city (game/coaches.go, world/coaches.go, sims leaveWith; web components/CityTrip.tsx): the coaches from
	// every gare routière at their hours, Grand-Bassam's aérodrome, the Air Lagune app, and the trips seen in 3D.
	{ID: game.TravelKey, Label: "Voyager de ville en ville : avions et cars", About: "Chaque ville a son aéroport (même Grand-Bassam, son petit aérodrome) et sa gare routière. À l'aéroport, un vol Air Lagune vers toutes les autres villes ; à la gare, le car de Savane Lignes, Gbê Express ou Côte Bleue Cars, qui part à heures fixes, de 5 h à 21 h : beaucoup moins cher que l'avion, beaucoup plus long, et la route fatigue. Sur la carte, choisis une autre ville : « Avion » ou « Car ». Et l'appli Air Lagune dans le Store. Ton perso entre dans l'aérogare ou monte dans le car, l'avion vole au-dessus des nuages ou le car roule sur la route, et te voilà à l'aéroport ou à la gare de l'autre ville. Les bébés et les enfants ne voyagent pas seuls.", Note: "Fermée : les vols d'avant entre les sept aéroports (Abidjan, Yamoussoukro, Bouaké, San-Pédro, Man, Korhogo, Daloa) restent ouverts et le car part de n'importe où, sans horaire, comme avant ; pas de vol pour Grand-Bassam, pas d'appli Air Lagune.", Keys: []string{game.TravelKey, "app:" + game.AirlineApp}},
	// Grand-Bassam's beach (game/bassam.go, web world3d/interior/BeachScene.tsx): the surf, the jet-ski, the ski nautique,
	// beach-volley, the swimming lesson and the dive, the beach party on Friday and Saturday nights.
	{ID: game.BassamKey, Label: "La plage de Grand-Bassam", About: "À Bassam, la plage se vit : un cours de surf ou une planche louée dans les rouleaux, un tour de jet-ski, le ski nautique derrière le bateau, le beach-volley sur le sable, la leçon de natation avec le maître-nageur (et son drapeau : on ne dépasse pas la barre), le baptême de plongée avec un moniteur, et le vendredi et le samedi soir, la beach party autour du feu jusqu'à 2 h.", Interactions: game.BassamIDs()},
	// Tikitoko Live (live/tiki.go, web screens/TikiLive.tsx): going live from the Tikitoko app, the voice, the comments, the hearts.
	{ID: "tikitoko-live", Label: "Tikitoko Live", About: "Dans Tikitoko, « Lancer un live » : les autres joueurs viennent te regarder en direct, ton perso tel qu'il est en ce moment (ce qu'il fait, où il est), ta voix si tu ouvres ton micro, leurs commentaires qui défilent et les cœurs qui montent. Et toi, va voir les lives des autres depuis l'onglet « Live ».", Note: "La voix passe par le serveur du jeu (pas de serveur vidéo) : le micro du téléphone, codé petit comme un appel. Le téléphone demande l'accès au micro la première fois.", Keys: []string{"tikitoko-live"}},
	{ID: "sims-detailles", Label: "Des persos plus détaillés", About: "Tous les persos du jeu gagnent en détails, dans le même style en blocs : un vrai visage (le blanc des yeux, les paupières qui clignent, les sourcils, les lèvres), les oreilles, les mains et leur pouce, les cols, les poignets, les boutons, les ceintures et leurs boucles, les poches, les chaussures avec leur semelle, le nœud du pagne, les mèches, les tresses et les perles. Les mêmes tenues, les mêmes couleurs, les mêmes pagnes : ton perso reste le tien, en plus beau.", Note: "Fermée : les persos d'avant partout. Le changement est immédiat, sans recharger.", Keys: []string{"sims-detailles"}},
	{ID: "demandes", Label: "Les demandes du quartier", About: "Chaque jour, les gens de ta commune te demandent des services : goûter le garba du maquis d'à côté, lire une histoire aux enfants de l'orphelinat, prier pour la santé du vieux Koné… Trois demandes par jour dans l'appli « Demandes » du téléphone, avec « Y aller », et un petit merci en Djai quand c'est fait.", Keys: []string{"demandes"}},
	{ID: "histoires", Label: "Les histoires du quartier", About: "Dans l'appli « Demandes », une histoire qui continue de jour en jour : le vieux Koné attend son petit-fils venu de France, Tantie Bintou ouvre son propre maquis, Serge veut reconquérir Fatou… Un chapitre par jour, et à la fin, la personne te présente quelqu'un d'autre qui a besoin de toi.", Note: "À ouvrir avec « Les demandes du quartier » : les histoires s'affichent dans la même appli.", Keys: []string{"histoires"}},
	{ID: "braquages", Label: "Les banques et les braquages", About: "Des banques dans les communes d'Abidjan, et pour les persos adultes, les braquages : la caisse de presque tous les commerces, seul, et la banque, en équipe, après avoir repéré les lieux et préparé le matériel. Ça se joue (la fuite, le coffre) : bien joué, la police a moins de chances de t'attraper. Mais ça dépend aussi du lieu, de l'heure, du commissariat le plus proche et de ton casier. Attrapé : la prison à la MACA, une amende et le casier. Pas attrapé : le butin, et tu es recherché pendant quelques heures.", Note: "Les banques sont des lieux comme les autres (toujours visibles) ; seules les actions de braquage sont fermées tant que la mise à jour l'est.", Interactions: game.BraquageIDs(), Keys: []string{"braquages"}},
	{ID: "combat-arene", Label: "Adjamé Storm 4", About: "Le jeu de combat en 3D, un jeu à part entière : écran titre, ton Sim et les combattants d'Abidjan (chacun son style et son coup spécial), quatre arènes (Adjamé, Treichville, Yopougon, Bassam), contre l'ordinateur, l'échelle, ou en ligne contre un joueur. À la salle de jeux et dans les Jeux du téléphone.", Interactions: []string{"console-storm"}, Keys: []string{"storm"}},
	// The new houses to build on a lot (game/plans.go MaisonV2Key): the villa with its balcony, the cour commune.
	{ID: "maison-v2", Label: "Nouvelles maisons : la villa à balcon et la cour commune", About: "Dans « Plans », deux nouvelles maisons à bâtir sur ton terrain : la villa à étage avec son grand balcon sur piliers, et la cour commune, trois chambres en rang sous la tôle autour de la cour où l'on cuisine et cause.", Keys: []string{"maison-v2"}},
	// The Sim's life as one watches it (sims/lifemode.go; web game/lifeMode.ts, components/LifeHud.tsx): the house's
	// objects tapped, the orders queued, free will, the games optional.
	{ID: "mode-vie", Label: "Le mode vie : ton perso vit sous tes yeux, tu lui donnes des ordres", About: "Chez toi, touche un objet (le frigo, le lit, la douche, la télé, le canapé, la gazinière…) ou quelqu'un de ta famille : une roue s'ouvre avec ce qu'on peut y faire. Ton perso y va et le fait pour de vrai, sous tes yeux. Donne-lui plusieurs ordres à la suite : ils s'alignent en haut de l'écran, touche-en un pour l'annuler. Quand il n'a rien à faire, il se débrouille tout seul selon ses besoins (le libre arbitre, que tu peux couper). Et les mini-jeux deviennent facultatifs : « Jouer pour un meilleur résultat ». Ton perso a des humeurs (« A bien mangé », « Dispute avec Koffi », « Nuit blanche », « Salaire reçu »…) qui colorent son épingle et jouent un peu sur ce qu'il fait ; des compétences (cuisine, charisme, forme, bricolage, musique, logique, danse) qui montent en pratiquant, ouvrent de nouvelles actions et comptent pour les promotions ; des relations avec une jauge d'amitié et une jauge d'amour par personne (connaissance, ami, meilleur ami, ennemi, partenaire), qui décident de ce qu'on peut lui dire ; et chez toi, tu peux diriger les autres de la maison (papa, maman, ta moitié) d'un toucher sur leur portrait.", Interactions: game.LifeInteractions, Keys: []string{"mode-vie"}},
	// The calmer game screen (web components/SimpleHud.tsx): a bottom bar of five, the top for the hour, the money,
	// one goal and what is going on; who is here and the commune's grin at the bottom.
	{ID: "ecran-simple", Label: "Un écran de jeu plus simple, et les vrais joueurs devant", About: "L'écran de jeu se calme : en bas, une seule barre (Ici, Maison, Carte, Téléphone, Moi) ; en haut, rien que l'heure, ton argent, ton prochain but (ou un besoin à remplir) et ce qui se passe en ce moment. Tes besoins, ton humeur, tes compétences, tes envies, les émotes et les réglages rapides sont dans « Moi ». Et les autres joueurs passent devant : chaque lieu et chaque rue dit combien de joueurs sont là (touche pour voir qui, les saluer ou les inviter d'un toucher), et le grin de ta commune défile en bas de l'écran, avec « Causer » pour y écrire.", Note: "Fermée : l'écran de jeu reste comme avant.", Keys: []string{"ecran-simple"}},
	// The PNJ players live like players (sims/pnjvivants.go): they talk in the grin, share coupons, défis and their soirées, and have a life on their card.
	{ID: "pnj-vivants", Label: "Les PNJ vivent comme des joueurs : ils causent au grin, partagent leurs coupons, font des soirées", About: "Les PNJ du jeu (l'anneau violet, « PNJ » après le nom : on ne peut pas les confondre avec de vrais joueurs) vivent maintenant comme des joueurs. Au grin, ils répondent de temps en temps à ce que tu écris, ou réagissent d'un emoji, et quand c'est calme ils lancent la causerie, partagent leur coupon Bet225 (tu peux jouer le même), te défient à un jeu, ou annoncent leur soirée : un soir sur deux, l'un d'eux fait une soirée chez lui dans ta commune, et tu peux y aller danser. Touche un PNJ : sa maison et son quartier, son métier, sa famille, sa voiture ou sa moto. Et dans « Jouer contre un joueur », les PNJ du quartier acceptent ton défi quand personne n'est là.", Note: "Fermée : les PNJ restent comme avant (ils jouent dans la rue, saluent et invitent).", Keys: []string{"pnj-vivants"}},
	{ID: "demarrage-rapide", Label: "Un démarrage rapide, même sur un petit téléphone et un réseau lent", About: "Babi Life s'ouvre plus vite. Avant même de t'inscrire, l'accueil te montre combien de joueurs sont en ligne en ce moment et combien ont joué aujourd'hui. Une fois connecté, ton écran de jeu arrive tout de suite (ton téléphone, tes applis, le grin) pendant que la ville en 3D se construit derrière, avec sa barre de progression. Nouveau joueur : la création de ton perso s'ouvre sans attendre la ville.", Note: "Fermée : le chargement reste comme avant (l'écran de chargement jusqu'à ce que tout soit là).", Keys: []string{"demarrage-rapide"}},
	// The close camera on one's own perso, birds and planes in the sky (web world3d/Walker.tsx lifeCam, world3d/open/skyLife.tsx, components/map/skyMap.ts).
	{ID: "camera-vie", Label: "Ton perso de près, et la vie dans le ciel", About: "La caméra se met près de ton perso, juste derrière lui : on le voit en entier, son visage et ses habits. Quand il reste immobile, elle vient doucement de trois quarts devant lui ; quand il marche, elle repasse derrière. Glisse le doigt vers le haut pour regarder le ciel. Pour voir la ville de plus haut, le bouton de vue est toujours là. Et le ciel vit : des nuées d'oiseaux le traversent et se posent sur les toits et les arbres, des pigeons picorent dans la rue et s'envolent quand tu approches, les avions d'Air Lagune passent au-dessus de la ville sur leurs vraies lignes, un hélicoptère de temps en temps, des cerfs-volants au bord de l'eau. Sur la grande carte aussi, les avions suivent leurs routes et les oiseaux passent.", Note: "Fermée : la caméra et le ciel restent comme avant.", Keys: []string{"camera-vie"}},
	{ID: "rue-vivante-gestes", Label: "La rue se vit : s'asseoir, acheter aux vendeurs, jouer avec les enfants, saluer", About: "Dans la rue, quand ton perso passe près de quelque chose, une petite bulle apparaît : un toucher, et il le fait. S'asseoir sur un banc, un muret ou la chaise en plastique d'un maquis ; acheter un cornet d'alloco, un garba, des brochettes, un sachet d'eau, du crédit ou le journal aux vendeurs qui passent, et manger en marchant ; renvoyer le ballon aux enfants, faire quelques jongles, sauter à la corde avec eux ; saluer les passants (« On dit quoi ? ») et les autres joueurs ; caresser un cabri, donner une pièce à un talibé, aider une tantie à soulever sa bassine, pousser une voiture en panne ; un selfie devant un monument. Quelques secondes à chaque fois, un peu de bonne humeur, et tu repars quand tu veux.", Note: "Fermée : la rue reste comme avant (les vendeurs et les scènes à rejoindre gardent leurs actions longues).", Keys: []string{"rue-vivante-gestes"}},
	// Yamoussoukro and Bouaké alive (game/villes.go, world.go; web world3d/open/villes/): their places, their landmarks, their life.
	{ID: game.RendezVousKey, Label: "Les rendez-vous de la semaine : happy hour, nuit des soirées, tournoi de dames, foot du dimanche, le vote", About: "Chaque semaine, des rendez-vous à heure fixe (heure d'Abidjan), dans la nouvelle appli « Rendez-vous » du téléphone : du lundi au jeudi de 18 h à 19 h, le happy hour au maquis (une commune différente chaque jour, tout à moitié prix) ; le vendredi de 21 h à 1 h, la nuit des soirées (les habitants de la commune de la nuit organisent leur soirée à moitié prix) ; le samedi de 16 h à 18 h, le tournoi de dames sur Dames 225, avec 8 000, 4 500 et 2 500 Djai pour les trois premiers ; le dimanche de 17 h à 18 h, le foot de rue au terrain du quartier (1 000 Djai pour ton premier match) ; le dimanche, le vote, et le lundi à 9 h, ses résultats. Touche « J'y serai » : un rappel te prévient un quart d'heure avant, et Babi Infos l'annonce une heure avant et au début. Quand c'est en cours : « Rejoins ! », et un toucher t'y emmène.", Note: "Fermée : rien ne change (pas d'appli, pas d'annonce, pas de bonus). Ouverte, chaque rendez-vous se coupe à part dans la carte « Rendez-vous de la semaine ».", Keys: []string{game.RendezVousKey}},
	{ID: game.YakroKey, Label: "Yamoussoukro vivante : la basilique, les caïmans sacrés, ses nuits", About: "À Yamoussoukro, la Basilique Notre-Dame de la Paix se voit de toute la ville : visite-la avec le guide, sous la coupole, et retrouve les vitraux qu'il te décrit. Au lac du palais, les caïmans sacrés se chauffent sur la rive et glissent dans l'eau ; vers 16 h, c'est le repas : lance le poulet de derrière la barrière, sans t'approcher. Et aussi : la grande mosquée, la Fondation Félix-Houphouët-Boigny, l'Hôtel Le Résident et son restaurant tout en haut, le golf, le kédjénou du Maquis Le Grand Braisé, rue des Maquis, et les nuits du Caïman Club et du Totem.", Interactions: game.VilleIDs(game.YakroKey), Keys: []string{game.YakroKey},
		Places: []string{game.YakroMosqueeID, game.YakroFondationID, game.YakroHotelID, game.YakroGolfID, game.YakroMaquisID, game.YakroClubID, game.YakroClub2ID}},
	{ID: game.BouakeKey, Label: "Bouaké vivante : la réserve de la N'Zi, ses éléphants, et la ville", About: "À 45 km de Bouaké, la Réserve de la N'Zi : éléphants, buffles, antilopes, singes et oiseaux dans la savane, au bord de la rivière. Pars en safari en 4x4 ou à pied avec le pisteur et photographie-les, descends la N'Zi en pirogue, dors au Lodge des Rives de la N'Zi. En ville : le jardin aux animaux de l'Hôtel Le Jardin des Paons, le pagne kita du Grand marché, l'allocodrome, le zouglou du Maquis Ambiance d'Air France et les nuits du Gbêkê Night.", Interactions: game.VilleIDs(game.BouakeKey), Keys: []string{game.BouakeKey},
		Places: []string{game.BroboCommune, game.NziReserveID, game.NziLodgeID, game.BouakeHotelID, game.BouakeAllocoID, game.BouakeMaquisID, game.BouakeClubID}},
	// San-Pédro and Korhogo alive (game/villes2.go, world.go): their places, their landmarks, their life.
	{ID: game.SanPedroKey, Label: "San-Pédro vivante : le port du cacao, les pirogues, les plages, la forêt de Taï", About: "Au premier port de cacao du monde, prends la grue et descends les sacs de cacao dans la cale du cargo, sans heurter le bord. À l'aube, pars pêcher en pirogue avec les pêcheurs du port de pêche, et achète le poisson à leur retour. Les plages : Monogaga sous les cocotiers, la Baie des Sirènes à Grand-Béréby et ses tortues qui pondent la nuit. Le Bardot et ses nuits, la cathédrale, le capitaine braisé du Maquis Le Mérou Braisé, le Cargo Club. Et avec Taï Forêt Excursions, une journée au parc national de Taï : marche sans bruit derrière le pisteur, photographie les chimpanzés qui cassent les noix et l'hippopotame pygmée.", Interactions: game.VilleIDs(game.SanPedroKey), Keys: []string{game.SanPedroKey},
		Places: []string{game.SPPecheID, game.SPBardotID, game.SPCathedraleID, game.SPMonogagaID, game.SPMaquisID, game.SPClubID, game.SPTaiID, game.BerebyCommune, game.BerebySirenesID, game.BerebyHotelID}},
	{ID: game.KorhogoKey, Label: "Korhogo vivante : les tisserands, les peintres, les forgerons, le Poro", About: "Au pays sénoufo : tisse ta bande de pagne au métier avec les tisserands de Waraniéné, peins une toile avec les peintres de Fakaha, bats le fer avec les forgerons de Koni. Visite l'orée du bois sacré de Koko avec un guide, dans le respect : ce qui est dedans ne se montre pas. Monte sur le rocher du mont Korhogo, cueille les mangues, achète au grand marché une vraie toile de Korhogo sans te faire avoir. Le soir, le tô et le tchapalo au Maquis Le Tô de Mama Sita, le balafon jusqu'à tard au Balafon Club.", Interactions: game.VilleIDs(game.KorhogoKey), Keys: []string{game.KorhogoKey},
		Places: []string{game.KoMontID, game.KoBoisSacreID, game.KoWaranieneID, game.KoFakahaID, game.KoKoniID, game.KoMaquisID, game.KoClubID}},
	// Man and Daloa alive (game/villes3.go, world.go): their places, their landmarks, their life.
	{ID: game.ManKey, Label: "Man vivante : la Dent, le Tonkpi, la cascade, les ponts de lianes, les masques", About: "La ville aux dix-huit montagnes : grimpe la Dent de Man à l'aube avec un guide, monte au belvédère du mont Tonkpi voir les montagnes sortir de la brume, baigne-toi au pied de la cascade. Avec Lianes & Montagnes Excursions, traverse le pont de lianes de Lieupleu sans regarder en bas. À la Cour des Masques, les échassiers et les masques dansent au son des tam-tams. Donne des bananes aux singes sacrés de Gbêpleu, cueille le café sous les grands arbres, et le soir, le riz sauce feuille du Maquis Le Pied de la Dent, le Sommet Club, la terrasse de l'Hôtel La Brume du Tonkpi.", Interactions: game.VilleIDs(game.ManKey), Keys: []string{game.ManKey},
		Places: []string{game.ManTonkpiID, game.ManGbepleuID, game.ManMasquesID, game.ManPlantationID, game.ManLianesID, game.ManMaquisID, game.ManClubID, game.ManHotelID}},
	{ID: game.DaloaKey, Label: "Daloa vivante : le cacao, la Lobo, la culture bété", About: "La cité des antilopes, au cœur de la boucle du cacao : passe une journée de récolte avec les planteurs (cueillir les cabosses, les écabosser à la machette, sécher les fèves), surveille les balances du grand marché pour qu'aucun planteur ne soit volé, descends la Lobo en pirogue avec un pêcheur. À la Cour des Anciens bétés, les danses, le tohourou et le ziglibithy d'Ernesto Djédjé ; une veillée de funérailles, avec respect. La cathédrale du Christ-Roi, la grande mosquée, la sauce graine du Maquis La Cabosse d'Or, le Ziglibithy Club, la piscine de l'Hôtel L'Antilope Dorée.", Interactions: game.VilleIDs(game.DaloaKey), Keys: []string{game.DaloaKey},
		Places: []string{game.DaloaPlantationID, game.DaloaLoboID, game.DaloaBeteID, game.DaloaCathedraleID, game.DaloaMosqueeID, game.DaloaMaquisID, game.DaloaClubID, game.DaloaHotelID}},
	{ID: game.CommunesDetailKey, Label: "Les communes en détail : mairies, carrefours, préfectures, zones", About: "Chaque mairie a sa façade avec le nom de sa commune, ses drapeaux et son perron, à sa vraie place. Les carrefours que tout le monde connaît (Siporex, Sable, Saint-Jean, la Palmeraie, Liberté, l'Indénié, Akwaba, Abobo Gare…) ont leur panneau, leurs kiosques et leurs woro-woro : on s'y donne rendez-vous. Les préfectures, et les zones (zone industrielle de Yopougon, Vridi, Zone 4, le campus, Black Market…) avec leur panneau et leur nom à l'écran quand on y entre, et sur la carte.",
		Interactions: game.QuartierIDs(), Keys: []string{game.CommunesDetailKey}, Places: world.QuartierPlaceIDs()},
	{ID: game.PapersKey, Label: "Les papiers : carte d'identité, extrait de naissance, contrats, permis", About: "Dans le téléphone, l'appli « Papiers » range les documents de ton perso (des documents du jeu, sans valeur dans la vraie vie) : l'extrait d'acte de naissance avec le nom de tes parents, la carte d'identité avec ta photo (à demander dès 18 ans à la mairie de ta commune ou au commissariat, 2 000 Djai, valable 10 ans de jeu), le contrat de travail quand tu es embauché·e, le contrat de bail de ton logement, le titre de propriété de tes terrains, la carte grise de tes véhicules et le permis de conduire (l'examen du code au commissariat), le bac, l'acte de mariage (on se marie à la mairie) et le livret de famille avec tes enfants. À la mairie, fais-les légaliser. Au contrôle de police, montre ta carte d'identité (et ton permis et ta carte grise si tu as un véhicule) : sans elle, un avertissement, puis une petite amende. « Montrer » envoie un papier à un ami dans Gbairai.",
		Interactions: game.PapersInteractions, Keys: []string{game.PapersKey}},
	{ID: game.ArmeeKey, Label: "L'armée : le service militaire, l'EMPT de Bingerville, la carrière de soldat à capitaine", About: "À la caserne du Bataillon des Lagunes (Cocody, Akouédo), dès 18 ans, engage-toi pour le service militaire : trois semaines de classes où tu vis à la caserne, avec le lever des couleurs, le parcours du combattant, la garde de nuit et la marche sac au dos, chacun joué. À la fin, ton attestation de service dans l'appli Papiers. À Bingerville, l'École militaire préparatoire technique (EMPT) : réussis son concours (l'écrit et l'épreuve physique), puis vis l'internat, trois trimestres de cours, d'atelier et de sport, jusqu'au brevet. Et la carrière dans l'armée, de soldat à capitaine, en uniforme : patrouilles, garde au camp, répétition du défilé du 7 août, aide après les inondations. Le service te fait entrer caporal, l'EMPT sergent. Des unités et des papiers du jeu, sans valeur dans la vraie vie.",
		Interactions: game.ArmeeInteractions(), Keys: []string{game.ArmeeKey}, Places: []string{game.CaserneID, game.EmptID}},
	{ID: game.EtudesKey, Label: "Le parcours d'études : collège, lycée, BEPC, bac, université, diplômes", About: "Les vrais lycées des grandes villes (Lycée classique d'Abidjan, Sainte-Marie de Cocody, Lycée scientifique de Yamoussoukro…) et des collèges modernes : ado, va en cours, à la récré, à la cantine, ou choisis l'internat (le dortoir, l'étude du soir, le réveil à 5 h 30, et le week-end à la maison). Passe le BEPC dès 14 ans, puis le bac en série A, C ou D dès 16 ans : des examens joués, ta moyenne et ta mention sur ton diplôme. Après 18 ans, le bac se passe en candidat libre. À l'université (UFHB, Nangui-Abrogoua, Bouaké, Korhogo, Daloa, l'INP-HB, et les privées UCAO, IUA, IUGB), inscris-toi sur place dans l'appli Études : une filière que ta série permet (droit, lettres, sciences éco, informatique, sciences, médecine, pharmacie), les frais de l'année (30 000 Djai dans le public, plus dans le privé), puis chaque semestre : six cours en amphi (trois par jour au plus) et le partiel joué. Licence en six semestres, Master en quatre, BTS en quatre, médecine et pharmacie en huit. Tes diplômes vont dans l'appli Papiers. Certains métiers en demandent pour monter (avocat·e : Master de droit ; médecin : doctorat en médecine ; pharmacien·ne : doctorat en pharmacie ; professeur·e : une Licence), et un diplôme te fait commencer plus haut. Ceux qui ont déjà leur poste le gardent.",
		Note:         "Un semestre prend au moins deux jours réels (six cours, trois comptés par jour, en semaine) : une Licence environ deux semaines.",
		Interactions: game.EtudesInteractions, Keys: []string{game.EtudesKey}, Places: world.LyceePlaceIDs()},
	// Les examens avant le travail (game/examens.go, sims/examens.go): works only with « parcours-etudes » open too.
	{ID: game.ExamensKey, Label: "Les examens avant le travail : repasser le BEPC et le bac pour travailler", About: "Plus de travail sans examens : pour être embauché·e et pour travailler, il faut repasser ses examens au lycée, en candidat libre, même si on les avait déjà. Les petits métiers de la rue (maquis, marché, gbaka et woro-woro, DJ de quartier, coiffure) demandent le BEPC ; tous les autres métiers, le BEPC puis le bac. Ceux qui travaillent déjà gardent leur poste et leur niveau : leur poste les attend, ils reprennent là où ils en étaient dès leurs examens réussis. Les anciens diplômes restent dans les papiers mais ne comptent plus pour travailler. L'appli Études et l'appli Boulot disent ce qui est fait et ce qui reste.", Note: "À ouvrir avec « Le parcours d'études » : sans lui, les examens ne se passent pas et la règle ne s'applique pas. Les petits boulots, les commerces et terrains (revenus passifs), les mandats politiques et le service militaire ne sont pas concernés.", Keys: []string{game.ExamensKey}},
	{ID: "ma-voiture", Label: "Ma voiture pour mes trajets", About: "Avec un vélo, une moto ou une voiture à toi (Bolide), « C'est loin : comment tu y vas ? » propose d'abord « Ma voiture » : tu prends le volant et le GPS t'y mène. Vers une autre commune, le court trajet se fait dans ta voiture, et elle reste garée devant le lieu d'arrivée. Si tu as bu au maquis, pas de volant : un taxi. Ta voiture garée loin : tu marches jusqu'à elle, ou tu prends un taxi.", Keys: []string{"ma-voiture"}},
	{ID: "telephone-leger", Label: "Téléphone léger : la rue 3D allégée pour les petits téléphones", About: "Sur les petits téléphones Android, la rue 3D se fait plus légère pour rester fluide : moins de pixels, pas d'ombres, la ville un peu moins loin dans la brume, moins de passants, de voitures et d'oiseaux. Choisi tout seul quand le téléphone rame, ou dans Réglages (Auto, Léger, Normal).", Keys: []string{"telephone-leger"}},
	{ID: game.CuisineKey, Label: "La cuisine ivoirienne : les cartes des maquis, les vendeuses de la rue, la cuisine à la maison", About: "Le pays se mange enfin : foutou banane ou igname sauce graine, sauce arachide, sauce gombo, sauce claire, kédjénou, placali sauce kplala, attiéké-poisson, riz gras, choukouya, pepper soup, escargots, agouti… Chaque maquis et restaurant a sa carte, ses prix et son plat du jour moins cher. Le matin, le pain-beurre-omelette du boutiquier, le café Touba, la bouillie de mil, les beignets ; dans la rue, le maïs grillé, l'igname et la banane braisées, les claclos, les gboflotos, les fruits coupés ; à boire, le bissap, le gnamankoudji, le tomi, et pour les grands le bandji et le koutoukou (après, pas de volant). Chaque région a ses plats : le foutou au mouton de Bouaké, le tô de Korhogo, le riz de montagne de Man, la sauce graine aux escargots de Daloa, le kédjénou de pintade de Yamoussoukro, la langouste de Bassam. Dans la rue, la tantie au pain-omelette, la vendeuse de bissap, la braiseuse de maïs et le vendeur de fruits t'attendent. Et à la maison : achète les ingrédients au marché (moins cher à Adjamé et à Treichville), puis pile le foutou au mortier, prépare la sauce graine, secoue le kédjénou, braise le maïs, fais ton bissap ; partage le plat avec la maison. Garbaya livre les nouveaux plats.", Note: "Il faut aussi « Le frigo qu'on remplit » ouvert pour la cuisine à la maison.",
		Interactions: game.CuisineIDs(), Keys: []string{game.CuisineKey}},
	// Tagging people in the grin (sims/mentions.go, web components/Mentions.tsx).
	{ID: "mentions-grin", Label: "Mentionner quelqu'un au grin (@pseudo)", About: "Au grin, tape @ dans ton message : la liste des joueurs s'ouvre, d'abord ceux qui viennent d'écrire, puis tes amis, puis n'importe qui par son pseudo. Touche un nom et il s'ajoute. Le joueur mentionné reçoit une notification ; un toucher l'amène au message, où son nom est en couleur et sa ligne surlignée.", Note: "Fermée : un « @pseudo » reste du texte simple et personne n'est prévenu.", Keys: []string{"mentions-grin"}},
	// The open world lit like the « blocs réalistes » concept (web world3d/open/lumiere.ts).
	{ID: "lumiere-realiste", Label: "Lumière réaliste : le soleil qui tourne avec l'heure, le ciel et les couleurs", About: "La rue 3D change de lumière avec l'heure du jeu : soleil bas et orangé le matin et à l'heure dorée, longues ombres, ciel bleu profond au-dessus de la brume chaude d'Abidjan, couleurs un peu plus vives. Le ciel éclaire aussi les blocs. Sur les ordinateurs et en qualité « Belle » : ombres plus fines, ombre douce dans les coins, léger halo sur ce qui brille. Les intérieurs gardent leur éclairage avec les mêmes couleurs. Les petits téléphones gardent la même fluidité.", Keys: []string{"lumiere-realiste"}},
	// The lagoon and the sea drawn as water (web world3d/open/eau.tsx).
	{ID: "eau-realiste", Label: "Eau réaliste : la lagune et la mer qui reflètent le ciel et le soleil", About: "Dans la rue 3D, la lagune Ébrié et la mer deviennent de l'eau : vaguelettes qui bougent, en petits carrés près de toi, reflet du ciel qui suit l'heure, scintillement du soleil (orange à l'heure dorée), lumières de la ville qui tremblent dessus la nuit, eau plus grise et agitée sous la pluie, écume sur la berge, pirogues de pêcheurs qui se balancent près du bord. Sur les ordinateurs et en qualité « Belle », les ponts, les tours et les bateaux se reflètent dans l'eau. Les petits téléphones gardent l'eau d'avant.", Keys: []string{"eau-realiste"}},
	// Chamfered block edges in the shared 3D kits (web world3d/bevel.ts).
	{ID: "blocs-arrondis", Label: "Blocs arrondis : les arêtes des blocs adoucies", About: "Les blocs de la 3D gardent leur style, mais leurs arêtes sont légèrement chanfreinées : la lumière dessine un fin trait clair le long de chaque bord, et les Sims, les voitures, les meubles, les étals et les maisons se lisent comme de vrais objets plutôt que des cartons. Les coins des immeubles de la rue sont coupés eux aussi. Les visages et les vêtements gardent exactement leurs textures. Sur les petits téléphones, seuls les objets proches (Sims, voitures, meubles, petits objets) sont adoucis, les grands bâtiments restent comme avant.", Note: "Les maisons qu'on construit bloc par bloc restent carrées (les blocs s'y touchent). Les rues déjà gardées dans le navigateur sont refaites une fois, avec les coins coupés.", Keys: []string{"blocs-arrondis"}},
	// The loading times measured on the players' phones (auth/perf.go, admin/chargement.go, web lib/mesures.ts).
	{ID: "mesures-chargement", Label: "Mesures de chargement : le temps que met la rue à venir sur ton téléphone", About: "Pour rendre le jeu plus rapide là où il est lent, il note combien de temps il met à s'ouvrir et à construire ta rue sur ton téléphone, et après chaque trajet. Juste des chronos, la commune, le type de téléphone et de connexion : rien de ce que tu fais ou écris.", Note: "Le jeu envoie quelques petits paquets par session (aucun tant que c'est fermé). Les résultats sont dans l'onglet « Chargement » de l'admin. Gardés 30 jours.", Keys: []string{"mesures-chargement"}},
	{ID: "naitre-adulte", Label: "Naître, puis jouer adulte : la fin du bébé jouable", About: "On naît toujours dans une famille tirée au sort, puis quatre petits écrans « Souvenirs d'enfance » racontent ton enfance : où tu as grandi (cour commune, villa ou village), ton école (CM2, BEPC ou bac), ton ami d'enfance, et ce que tu étais petit. Ton perso arrive à 18 ans, avec l'argent de départ de sa famille, son logement et son mentor. Les bébés, enfants et ados déjà en jeu passent à 18 ans à leur prochaine connexion, avec leurs diplômes et leur ami d'enfance. Ceux qui avaient payé « grandir vite » deviennent Pionniers : un badge à côté du nom, un pin exclusif et des Djai offerts.", Note: "Ouvrir fait passer tous les joueurs mineurs à 18 ans (à leur prochaine connexion) et retire « Grandir tout de suite » de la Boutique. Les acheteurs de « grandir vite » reçoivent leur bonus Pionnier à leur connexion (une seule fois).", Keys: []string{"naitre-adulte"}},
	// Detailed block vehicles (web world3d/voituresKit.ts, voituresModels.ts).
	{ID: "voitures-realistes", Label: "Voitures réalistes : taxis, gbakas, motos et voitures en blocs détaillés", About: "Dans la rue 3D, tous les véhicules sont refaits en blocs détaillés : le taxi compteur orange devient une vraie berline avec son lanterneau « TAXI » et son numéro sur les portières, les woro-woros gardent leur bande de couleur, le gbaka a sa porte coulissante ouverte, son apprenti, sa galerie chargée et sa devise peinte à l'arrière, le bus SITRA sa girouette lumineuse, les motos leur fourche chromée. Chaque voiture qu'on peut acheter garde son modèle et sa couleur (berline, 4×4 avec pare-buffle et roue de secours, pick-up, limousine…). Peinture vernie, vitres qui reflètent le ciel, plaques d'immatriculation, poussière sur le bas de caisse, phares et feux qui s'allument la nuit, roues qui tournent et braquent. De loin, une version simple et légère.", Keys: []string{"voitures-realistes"}},
	// The realistic block Sims (web avatar/RealHuman.tsx, avatar/persos.ts).
	{ID: "persos-realistes", Label: "Persos réalistes : des Sims plus détaillés et plus vivants", About: "Les Sims restent en blocs, avec leurs grosses têtes, mais de près ils sont bien plus fins : tissus avec leur trame (wax, jean, coton, maillot), cheveux mèche par mèche, visage dessiné au centimètre (grands yeux avec le blanc, l'iris et un reflet, sourcils fins, lèvres, joues), mains, chaussures. Les expressions (sourire, rire aux éclats, surprise, tristesse, colère, la bouche qui parle, les clignements) sont redessinées à cette finesse et se lisent sur toutes les peaux. Les nattes, les cheveux longs et les boucles d'oreilles suivent les mouvements de la tête. La création du perso et « Changer de look » les montrent sous une lumière de studio. Le nez et les lèvres sont en relief (les lèvres suivent chaque expression), le pagne, la robe et le boubou flottent en marchant, et huit coiffures d'Abidjan arrivent dans la création, « Changer de look », chez le barbier et au salon de coiffure : tresses longues, nattes fulani, dreads attachées, twists courts, chignon haut, taper avec dessin, perruque lisse, foulard attaché. Sous la lumière de la création, chaque teint a la couleur choisie. Seuls les Sims proches sont dessinés ainsi (ton perso toujours) : les autres restent comme avant, et les petits téléphones en gardent moins.", Interactions: []string{"tresses-longues", "nattes-fulani", "dreads-attachees", "twists-courts", "chignon-haut", "taper-dessin", "perruque-lisse", "foulard-attache"}, Keys: []string{"persos-realistes"}},
	// Realistic façades, Plateau towers and maquis terraces (web world3d/open/facades.ts).
	{ID: "facades-realistes", Label: "Façades réalistes : les rues d'Abidjan et les tours du Plateau en détail", About: "Les immeubles de la rue 3D prennent l'allure des vraies rues d'Abidjan : béton peint taché par la pluie, fenêtres en aluminium et naco, claustras, devantures carrelées, boutiques ouvertes sur leurs étagères. Près de toi, des enseignes aux noms inventés au-dessus des boutiques, des climatiseurs avec leur tuyau qui goutte, des balcons en claustra. Les grandes tours du Plateau deviennent de vraies tours : verre bleu, bronze ou argent qui reflète le ciel, béton blanc à ailettes, retraits, gradins, couronne et flèche, bureaux allumés au crépuscule (éteints pendant un délestage). Les maquis ont leur pergola, leurs guirlandes d'ampoules, leur congélateur et leurs casiers. Les petits téléphones gardent seulement les nouvelles textures et les formes des tours.", Note: "Les rues déjà gardées dans le navigateur sont refaites une fois avec les tours et les enseignes.", Keys: []string{"facades-realistes"}},
	// The played scenes (sports, défis, gestes, the baby's games) with the « blocs réalistes » look (web world3d/minijeux.tsx).
	{ID: "minijeux-realistes", Label: "Mini-jeux réalistes : les sports et les défis en blocs premium", About: "Les matchs et les mini-jeux prennent le look « blocs réalistes ». Foot de rue, basket de rue, foot au stade : la lumière suit l'heure d'Abidjan (plein jour, heure dorée avec ses ombres longues, et le soir sous les projecteurs, le terrain éclairé et le quartier dans le noir). Partout, les objets des défis (plats, ustensiles, outils), les terrains et les murs ont une fine texture en pixels, le dessus des blocs plus clair, le pied des murs dans l'ombre, et les couleurs un peu plus vives. Sur les ordinateurs et en qualité « Belle » : reflets du ciel, ombre douce dans les coins, halo des projecteurs. Les petits téléphones gardent la même fluidité ; le jeu, les commandes et la caméra ne changent pas.", Keys: []string{"minijeux-realistes"}},
	// The « blocs réalistes » look inside the buildings and on the named landmarks (web world3d/batiments.ts).
	{ID: "batiments-realistes", Label: "Bâtiments réalistes : l'intérieur des bâtiments et les monuments refaits", About: "Les intérieurs du jeu changent de matières : carrelage avec ses joints et ses coins ébréchés, terrazzo, parquet, marbre poli, enduit peint avec ses traces et ses petites fissures, vraies plinthes. Chaque lieu a sa lumière : ampoules chaudes à la maison et au maquis, néons au club, lumière du jour au bureau, à l'école et au magasin, lumière froide à l'hôpital. Les sols brillants et les vitres reflètent la pièce, le climatiseur et les interrupteurs sont aux murs, et sur les appareils puissants le soleil entre par les fenêtres en rayons. La maison qu'on construit bloc par bloc garde ses blocs carrés, avec des textures plus fines. Les monuments (Pyramide, cathédrale, basilique, Hôtel Ivoire, stade, mosquées…) ont des verres et des pierres plus vrais, éclairés la nuit.", Note: "Les petits téléphones ont les textures et la lumière seulement ; les reflets et les objets en plus à partir du niveau normal, les rayons de soleil en haute qualité.", Keys: []string{"batiments-realistes"}},
	// Abidjan's big bridges drawn whole, each as it is built (web world3d/open/ponts.tsx).
	{ID: "ponts-realistes", Label: "Ponts réalistes : les ponts d'Abidjan comme les vrais", About: "Dans la rue 3D, les grands ponts de la lagune sont dessinés comme ils sont construits, en blocs : le pont Félix-Houphouët-Boigny et son étage du train qu'on voit passer par les ouvertures, ses piles en lame et sa vieille balustrade ; le pont Charles-de-Gaulle et sa poutre plus épaisse au-dessus des piles ; le pont Henri-Konan-Bédié, ses deux caissons côte à côte sur des piles rondes, ses grands lampadaires au milieu et sa piste piétonne ; le pont Alassane-Ouattara, son pylône blanc penché et ses 19 haubans éclairés la nuit. Rambardes, marquages, joints, lampadaires allumés le soir : de loin, la nuit, les ponts deviennent des colliers de lumière sur la lagune. On roule et on marche dessus comme avant.", Keys: []string{"ponts-realistes"}},
	// La vie amoureuse, phase 1 (game/amour.go, sims/amour.go; web screens/CoeurApp.tsx, components/amour/RendezVous.tsx).
	{ID: game.AmourKey, Label: "La vie amoureuse : « Mon cœur » et les rendez-vous à deux", About: "Quand tu es en couple, l'appli « Mon cœur » s'ouvre dans ton téléphone : ta moitié, depuis combien de jours vous êtes ensemble, votre amour qui grandit quand tu en prends soin (et baisse doucement si tu l'oublies), votre prochain anniversaire. Envoie-lui un mot doux, fais-lui un câlin à la maison, et emmène-la ou emmène-le en rendez-vous : un dîner au maquis, une balade au coucher du soleil au bord de la lagune, une glace au centre commercial. Le rendez-vous se joue : elle ou il te parle, tu choisis un mot doux, une blague ou d'écouter, et son visage te répond. Chaque matin, ta moitié t'écrit « Bonjour mon cœur ». Et à la maison, elle ou il vient t'accueillir à la porte.", Interactions: []string{"rdv-maquis", "rdv-lagune", "rdv-glace"}, Keys: []string{game.AmourKey, game.CoeurKey}},
	// L'héritage (game/heritage.go, sims/heritage.go): works on its own; with « mode-vie » open too, the elders show at home in 3D.
	{ID: game.HeritageKey, Label: "L'héritage : jouer sa famille, génération après génération", About: "Ton perso vieillit pendant que tu joues (jamais quand le jeu est fermé ou en pause) : jeune adulte, adulte, senior. À 60 ans, ou dès 50 ans en ayant rempli 3 des 5 jalons (propriétaire, patron, fortune, respecté·e, famille), tu passes la main : ton enfant de 18 ans, un enfant adopté à l'orphelinat, ou à défaut un neveu ou une nièce reprend la maison, le nom, les terrains, les immeubles, les véhicules et ton quartier. L'argent passe après les droits de succession : les trois quarts à l'héritier, un quart à l'ancien, qui te le rend en bénédictions chaque semaine. Les dettes ne passent jamais. Les diplômes et les papiers sont ceux de l'héritier : il repasse son BEPC et son bac. Il garde une part de ce que tu savais faire, et tes amis deviennent ses tontons et tatas. En couple officiel avec un joueur, vous pouvez avoir un enfant à deux, s'il ou elle dit oui : le premier de vous deux qui lui passe la main l'emmène. Sans enfant, l'enfant de ton ami·e d'enfance peut aussi reprendre la maison. Tes anciens passent au grin de la commune, s'assoient devant ta maison dans Mon quartier et viennent à tes soirées. Les anciens restent à la maison : un conseil, une bénédiction, une visite ; deux générations plus tard, ils partent se reposer au village. Chaque génération ajoute à la renommée de ta famille : l'appli « Ma famille » montre l'arbre, les jalons, les anciens et le classement des grandes familles.", Note: "Ouvrir donne un âge aux persos adultes d'après leur temps de jeu (un an par 40 minutes, 40 ans au plus) ; leurs 21 jours avant de pouvoir passer la main commencent à leur connexion. Durées réglables par HERITAGE_DUREES (en heures de jeu).", Interactions: game.HeritageInteractions, Keys: []string{game.HeritageKey, game.HeritageAppKey}},
	// Le cycle de vie (game/sante.go, sims/sante.go; game/funerailles.go): illness, and the funerals of the elders.
	{ID: game.CycleVieKey, Label: "Le cycle de vie : tomber malade, se soigner, et les funérailles", About: "Ton perso peut tomber malade, comme dans la vraie vie : le palu (les moustiques, la nuit), la grippe quand il est épuisé, la typhoïde ou le mal de ventre quand l'hygiène est oubliée, l'entorse au sport. Malade, il se fatigue plus vite et n'a pas le moral ; pas soigné, ça s'aggrave chaque jour. Les médicaments de la pharmacie soignent un petit mal, la consultation au centre de santé tout le reste. Une moustiquaire imprégnée (à la pharmacie) éloigne le palu. Et quand un ancien de la famille s'éteint, tu choisis ses funérailles (simples, dignes ou grandes, avec l'orchestre) : la famille cotise, le renom monte, et tu vois la cérémonie.", Interactions: []string{game.MoustiquaireID}, Keys: []string{game.CycleVieKey}},
	// La famille jouable (game/famillejouable.go, sims/famillejouable.go; web game/household.ts): needs « mode-vie ».
	{ID: game.FamilleJouableKey, Label: "La famille jouable : chacun sa vie à la maison", About: "Avec le mode vie, touche le portrait d'un membre de la famille à gauche pour le diriger : chacun a sa propre vie. L'enfant fait ses devoirs, joue au ballon dans la cour, dessine ; l'ado révise son bac, cause avec ses amis au téléphone, danse ; l'ancien raconte des contes à toute la famille, prie, fait la sieste dans le hamac ; un adulte de la maison prépare le repas pour tous et fait le ménage. Touche un autre membre (ou ton perso) pour qu'ils fassent quelque chose ensemble : aider aux devoirs, jouer, un câlin, un conseil. Les enfants ont leur moyenne à l'école : les devoirs la font monter, un enfant négligé (faim, fatigue, ennui) la voit baisser. Devenu grand, une bonne moyenne, c'est une mention au bac et du renom pour la famille.", Note: "Ne fait rien sans « mode-vie » ouverte.", Keys: []string{game.FamilleJouableKey}},
	// Le grin libre (sims/grinlibre.go, npcchat/grin.go): needs « pnj-vivants » and the model's key (parler-libre's).
	{ID: "grin-libre", Label: "Le grin libre : les PNJ du chat répondent vraiment", About: "Dans le chat de groupe (Tout Babi, ta commune), quand tu réponds à un PNJ ou que tu l'appelles par son nom, il te répond avec ses propres mots, comme dans une vraie discussion. Il prend ta façon d'écrire : court ou long, nouchi ou bien écrit, avec des emojis ou pas, en anglais si tu écris en anglais. Et il fait ce que tu lui demandes quand ça se fait en paroles : une blague, une histoire, une devinette, un conseil, un quiz, un couplet de zouglou inventé, un plan pour ce soir. Il pose parfois les questions laissées sans réponse dans le chat. Chat public : rien de sexuel, pas de drague, pas de numéros ni de liens.", Note: "Ne fait rien sans « pnj-vivants » ouverte et sans la clé du modèle (NPC_CHAT_KEY ou ANTHROPIC_API_KEY, celle de « parler-libre »). Chaque réponse est un appel au modèle : 150 messages par joueur et par jour au plus (le même quota que la discussion dans la rue), 60 réponses par chat et par heure.", Keys: []string{"grin-libre"}},
	// La vitrine des panneaux (web components/Vitrine.tsx, ads.Clicked).
	{ID: "pub-vitrine", Label: "La vitrine des panneaux de pub", About: "Touche un panneau de pub dans la rue : la vitrine de l'annonceur s'ouvre, avec son affiche ou sa vidéo en grand, son nom et un bouton vers son site ou son appli. Un panneau libre montre comment y mettre sa pub. Les annonceurs voient combien de joueurs ont ouvert leur vitrine, à côté des vues.", Keys: []string{"pub-vitrine"}},
	// Les pays (world/pays.go, game/pays.go): the countries abroad, their cities hidden while closed.
	{ID: game.BurkinaKey, Label: "Le Burkina Faso : Ouagadougou et Bobo-Dioulasso", About: "Le Burkina Faso s'ouvre : Ouagadougou (le centre et son Grand marché, Ouaga 2000, Zogona et l'université) et Bobo-Dioulasso (la grande mosquée de Dioulassoba, le Grand marché), avec leurs vraies rues. Un joueur qui vit au Burkina naît là-bas ; ceux de Côte d'Ivoire y vont en avion, ou par la route.", Note: "Les rues viennent d'OpenStreetMap ; les lieux réels sont placés d'après OpenStreetMap, les maquis et les clubs sont inventés. À enrichir.", Places: world.CountryCommunes("bf"), Keys: []string{game.BurkinaKey}},
	{ID: game.USAKey, Label: "Les États-Unis : New York", About: "New York s'ouvre : Manhattan (Times Square, Central Park, Harlem et la « Little Senegal »), le Bronx et sa grande communauté ouest-africaine, Queens et l'aéroport JFK. Un joueur qui vit à New York naît là-bas ; ceux de Côte d'Ivoire y vont en avion, depuis l'aéroport.", Note: "Seulement en avion depuis l'Afrique (pas de route par-dessus l'océan). Lieux à enrichir.", Places: world.CountryCommunes("us"), Keys: []string{game.USAKey}},
	{ID: game.CanadaKey, Label: "Le Canada : Montréal", About: "Montréal s'ouvre : Ville-Marie et le Vieux-Montréal, le mont Royal, Côte-des-Neiges et l'Université de Montréal, Dorval et l'aéroport Montréal-Trudeau. Un joueur qui vit à Montréal naît là-bas ; ceux de Côte d'Ivoire y vont en avion.", Note: "Seulement en avion depuis l'Afrique ; de New York, aussi par la route. Lieux à enrichir.", Places: world.CountryCommunes("ca"), Keys: []string{game.CanadaKey}},
	// Blocs HD (web avatar/hd.ts): the Sims still in blocks, finer up close.
	{ID: "blocs-hd", Label: "Blocs HD : des persos en blocs plus fins", About: "Les persos restent en blocs, mais de près ils sont plus beaux : les cheveux sculptés en petits blocs (l'afro bien rond, les puffs, les chignons et les couettes en boules), le wax imprimé deux fois plus fin (des motifs plus petits et plus nombreux, comme un vrai pagne), et des yeux plus grands et plus vivants (un vrai iris, la pupille, deux reflets, des cils plus fournis).", Note: "Le wax fin et les grands yeux demandent « persos-realistes » ouverte ; les cheveux sculptés marchent aussi avec « sims-detailles ».", Keys: []string{"blocs-hd"}},
	// Les voisins vivants (game/voisins.go, sims/voisins.go; web components/VoisinsApp.tsx).
	{ID: game.VoisinsKey, Label: "Les voisins vivants : la cour et ses familles", About: "Dans ton téléphone, l'appli « Voisins » : les trois familles de ta cour, toujours les mêmes, avec leur nom, leur métier, leur caractère et leurs enfants. Leur vie avance avec les jours : un bébé, un mariage, un nouveau travail, une dispute entendue à travers le mur, une famille qui déménage et une autre qui arrive. Ils viennent te demander : prêter un peu d'argent, venir au baptême, garder les enfants, aider à monter l'armoire, la musique trop forte en pleine nuit, des condoléances. Salue-les, apporte-leur un plat, réponds oui ou non : le lien monte ou baisse. Proches, ils t'apportent à manger et rendent ce qu'ils ont emprunté. Avec le mode vie, le voisin qui frappe à ta porte est l'un d'eux.", Keys: []string{game.VoisinsKey, "app:voisins"}},
	// Les animaux (game/animaux.go, sims/animaux.go; web components/AnimauxApp.tsx, world3d/pets.tsx).
	{ID: game.AnimauxKey, Label: "Les animaux : chien, chat, poules et le mouton de Tabaski", About: "Dans ton téléphone, l'appli « Animaux » : adopte un chien (il garde la maison et te suit dans la rue), un chat (il ronronne sur le lit), des poules (leurs œufs se vendent au marché) ou le mouton de Tabaski (engraissé dans la cour jusqu'à la fête, ou revendu plus cher). Ils ont faim, ils s'ennuient : nourris-les, caresse-les, promène le chien. Plus tu t'en occupes, plus ils t'aiment. Oublié un jour entier le ventre vide, ton animal fugue : il faut le chercher dans le quartier.", Keys: []string{game.AnimauxKey, "app:animaux"}},
	// Adult nights (18+, users.adult_at): GoNow app, street corners, hotel, partner at home, pole girls in the club. Real 3D scenes, no fade to black.
	{ID: game.GoNowKey, Label: "GoNow et les nuits payantes", About: "Dans le Store, l'appli GoNow (18 ans et plus) : réserve une compagnie, choisis le service (branlette, fellation, missionnaire, califourchon, levrette, 69…). La rue la nuit, l'hôtel, et chez toi avec ta moitié : les mêmes scènes, en vrai 3D. En boîte, les filles dansent sur la barre de fer ; tu peux regarder ou prendre une danse privée.", Note: "Fermée tant que tu ne l'ouvres pas. Gate adult_at + perso adulte.", Interactions: game.GonowInteractionIDs(), Keys: []string{"app:" + game.GoNowApp}},
}

// OpeningID is the game's opening to everyone, set like an update.
const OpeningID = "ouverture"

// GameOpenEnv: GAME_OPEN=true on the server (cmd/api), the game open whatever the opening says.
var GameOpenEnv bool

// OpeningDefault is when the game opens if the admin hasn't set it: Wednesday 28 October 2026, 21:30 in Abidjan.
var OpeningDefault = time.Date(2026, 10, 28, 21, 30, 0, 0, time.UTC)

// Find is the update of that ID.
func Find(id string) (Feature, bool) {
	i := slices.IndexFunc(List, func(f Feature) bool { return f.ID == id })
	if i < 0 {
		return Feature{}, false
	}
	return List[i], true
}

// State is an update's switch as the team set it.
type State struct {
	Open     bool       `json:"open"`
	OpensAt  *time.Time `json:"opensAt"`
	OpenedAt *time.Time `json:"openedAt"`
}

// Live reports whether the update is with the players now (opened by hand, or its time has come).
func (s State) Live(now time.Time) bool {
	return s.Open || (s.OpensAt != nil && !now.Before(*s.OpensAt))
}

// Store keeps the switches, read again from the database every little while.
type Store struct {
	DB *pgxpool.Pool

	mu     sync.RWMutex
	state  map[string]State
	loaded time.Time
}

// Default is the store the game asks (set in main): nil opens everything (tests, a database-less run).
var Default *Store

const fresh = 15 * time.Second

func (s *Store) states(ctx context.Context) map[string]State {
	s.mu.RLock()
	st, at := s.state, s.loaded
	s.mu.RUnlock()
	if st != nil && time.Since(at) < fresh {
		return st
	}
	next := map[string]State{}
	rows, err := s.DB.Query(ctx, `SELECT id, open, opens_at, opened_at FROM features`)
	if err != nil {
		if st != nil {
			return st
		}
		return next
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var v State
		if rows.Scan(&id, &v.Open, &v.OpensAt, &v.OpenedAt) == nil {
			next[id] = v
		}
	}
	// The launch: tonight at 21:30 in Abidjan (UTC), unless the admin has set it otherwise.
	if _, set := next[OpeningID]; !set {
		at := OpeningDefault
		next[OpeningID] = State{OpensAt: &at}
	}
	s.mu.Lock()
	s.state, s.loaded = next, time.Now()
	s.mu.Unlock()
	return next
}

// Open reports whether the update is with the players.
func (s *Store) Open(ctx context.Context, id string) bool {
	if s == nil {
		return true
	}
	return s.states(ctx)[id].Live(time.Now())
}

// Blocks is the update a place activity waits for, "" when it's there to do.
func (s *Store) Blocks(ctx context.Context, interactionID string) string {
	if s == nil {
		return ""
	}
	st := s.states(ctx)
	now := time.Now()
	for _, f := range List {
		if slices.Contains(f.Interactions, interactionID) && !st[f.ID].Live(now) {
			return f.ID
		}
		// The old activity an open update replaced (Bassam's passive beach-volley, once the real match is there).
		if slices.Contains(f.Replaces, interactionID) && st[f.ID].Live(now) {
			return f.ID
		}
	}
	return ""
}

// BlocksKey is the update a phone key ('app:tikitoko', 'foot11'…) waits for, "" when it's there.
func (s *Store) BlocksKey(ctx context.Context, key string) string {
	if s == nil {
		return ""
	}
	st := s.states(ctx)
	now := time.Now()
	for _, f := range List {
		if slices.Contains(f.Keys, key) && !st[f.ID].Live(now) {
			return f.ID
		}
	}
	return ""
}

// BlocksPlace is the update a place or a commune waits for (Feature.Places), "" when it's there.
func (s *Store) BlocksPlace(ctx context.Context, id string) string {
	if s == nil {
		return ""
	}
	st := s.states(ctx)
	now := time.Now()
	for _, f := range List {
		if slices.Contains(f.Places, id) && !st[f.ID].Live(now) {
			return f.ID
		}
	}
	return ""
}

// HiddenPlaces: the places and communes of the updates not opened yet (the world sent to the phone leaves them out).
func (s *Store) HiddenPlaces(ctx context.Context) map[string]bool {
	out := map[string]bool{}
	if s == nil {
		return out
	}
	st := s.states(ctx)
	now := time.Now()
	for _, f := range List {
		if !st[f.ID].Live(now) {
			for _, id := range f.Places {
				out[id] = true
			}
		}
	}
	return out
}

// Set switches an update: open or closed now, and when it opens by itself (nil: by hand).
func (s *Store) Set(ctx context.Context, id string, open bool, opensAt *time.Time) error {
	_, err := s.DB.Exec(ctx, `INSERT INTO features (id, open, opens_at, opened_at, updated_at)
		VALUES ($1, $2, $3, CASE WHEN $2 THEN now() END, now())
		ON CONFLICT (id) DO UPDATE SET open = $2, opens_at = $3,
			opened_at = CASE WHEN $2 AND features.opened_at IS NULL THEN now() ELSE features.opened_at END, updated_at = now()`, id, open, opensAt)
	s.mu.Lock()
	s.state = nil
	s.mu.Unlock()
	return err
}

// Row is an update as the admin lists it.
type Row struct {
	Feature
	State
	Live bool `json:"live"`
}

// All is every update with its switch.
func (s *Store) All(ctx context.Context) []Row {
	st := s.states(ctx)
	now := time.Now()
	out := make([]Row, 0, len(List))
	for _, f := range List {
		v := st[f.ID]
		out = append(out, Row{Feature: f, State: v, Live: v.Live(now)})
	}
	return out
}

// News is an update the players got lately, for the « Nouveau » card on the phone.
type News struct {
	ID    string    `json:"id"`
	Label string    `json:"label"`
	About string    `json:"about"`
	At    time.Time `json:"at"`
}

// Public serves GET /features: what the phone hides (the closed updates' activities and keys), and what's new.
func (s *Store) Public(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	st := s.states(r.Context())
	now := time.Now()
	out := struct {
		Closed       []string `json:"closed"`
		Interactions []string `json:"interactions"`
		Keys         []string `json:"keys"`
		New          []News   `json:"new"`
		// The game open to everyone now (GAME_OPEN, or the opening's hour come): the site opens only on a yes.
		Game bool `json:"game"`
		// When the game opens to everyone, set but not yet come (the wish list's countdown).
		Opening *time.Time `json:"opening,omitempty"`
	}{Closed: []string{}, Interactions: []string{}, Keys: []string{}, New: []News{}}
	for _, f := range List {
		v := st[f.ID]
		if f.ID == OpeningID {
			out.Game = GameOpenEnv || v.Live(now)
			if !v.Live(now) && v.OpensAt != nil {
				out.Opening = v.OpensAt
			}
		}
		if v.Live(now) {
			out.Interactions = append(out.Interactions, f.Replaces...)
		}
		if !v.Live(now) {
			out.Closed = append(out.Closed, f.ID)
			out.Interactions = append(out.Interactions, f.Interactions...)
			out.Keys = append(out.Keys, f.Keys...)
			continue
		}
		// Opened in the last two weeks: shown as new (the moment it came, by hand or at its set time).
		at := v.OpenedAt
		if at == nil {
			at = v.OpensAt
		}
		if at != nil && now.Sub(*at) < 14*24*time.Hour && f.ID != OpeningID {
			out.New = append(out.New, News{ID: f.ID, Label: f.Label, About: f.About, At: *at})
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}
