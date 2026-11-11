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
	{ID: "rue-vivante-gestes", Label: "La rue se vit : s'asseoir, acheter aux vendeurs, jouer avec les enfants, saluer", About: "Dans la rue, quand ton perso passe près de quelque chose, une petite bulle apparaît : un toucher, et il le fait. S'asseoir sur un banc, un muret ou la chaise en plastique d'un maquis ; acheter un cornet d'alloco, un garba, des brochettes, un sachet d'eau, du crédit ou le journal aux vendeurs qui passent, et manger en marchant ; renvoyer le ballon aux enfants, faire quelques jongles, sauter à la corde avec eux ; saluer les passants (« On dit quoi ? ») et les autres joueurs ; caresser un cabri, donner une pièce à un talibé, aider une tantie à soulever sa bassine, pousser une voiture en panne ; un selfie devant un monument. Quelques secondes à chaque fois, un peu de bonne humeur, et tu repars quand tu veux.", Note: "Fermée : la rue reste comme avant (les vendeurs et les scènes à rejoindre gardent leurs actions longues).", Keys: []string{"rue-vivante-gestes"}},
	// Yamoussoukro and Bouaké alive (game/villes.go, world.go; web world3d/open/villes/): their places, their landmarks, their life.
	{ID: game.YakroKey, Label: "Yamoussoukro vivante : la basilique, les caïmans sacrés, ses nuits", About: "À Yamoussoukro, la Basilique Notre-Dame de la Paix se voit de toute la ville : visite-la avec le guide, sous la coupole, et retrouve les vitraux qu'il te décrit. Au lac du palais, les caïmans sacrés se chauffent sur la rive et glissent dans l'eau ; vers 16 h, c'est le repas : lance le poulet de derrière la barrière, sans t'approcher. Et aussi : la grande mosquée, la Fondation Félix-Houphouët-Boigny, l'Hôtel Le Résident et son restaurant tout en haut, le golf, le kédjénou du Maquis Le Grand Braisé, rue des Maquis, et les nuits du Caïman Club et du Totem.", Interactions: game.VilleIDs(game.YakroKey), Keys: []string{game.YakroKey},
		Places: []string{game.YakroMosqueeID, game.YakroFondationID, game.YakroHotelID, game.YakroGolfID, game.YakroMaquisID, game.YakroClubID, game.YakroClub2ID}},
	{ID: game.BouakeKey, Label: "Bouaké vivante : la réserve de la N'Zi, ses éléphants, et la ville", About: "À 45 km de Bouaké, la Réserve de la N'Zi : éléphants, buffles, antilopes, singes et oiseaux dans la savane, au bord de la rivière. Pars en safari en 4x4 ou à pied avec le pisteur et photographie-les, descends la N'Zi en pirogue, dors au Lodge des Rives de la N'Zi. En ville : le jardin aux animaux de l'Hôtel Le Jardin des Paons, le pagne kita du Grand marché, l'allocodrome, le zouglou du Maquis Ambiance d'Air France et les nuits du Gbêkê Night.", Interactions: game.VilleIDs(game.BouakeKey), Keys: []string{game.BouakeKey},
		Places: []string{game.BroboCommune, game.NziReserveID, game.NziLodgeID, game.BouakeHotelID, game.BouakeAllocoID, game.BouakeMaquisID, game.BouakeClubID}},
	// San-Pédro and Korhogo alive (game/villes2.go, world.go): their places, their landmarks, their life.
	{ID: game.SanPedroKey, Label: "San-Pédro vivante : le port du cacao, les pirogues, les plages, la forêt de Taï", About: "Au premier port de cacao du monde, prends la grue et descends les sacs de cacao dans la cale du cargo, sans heurter le bord. À l'aube, pars pêcher en pirogue avec les pêcheurs du port de pêche, et achète le poisson à leur retour. Les plages : Monogaga sous les cocotiers, la Baie des Sirènes à Grand-Béréby et ses tortues qui pondent la nuit. Le Bardot et ses nuits, la cathédrale, le capitaine braisé du Maquis Le Mérou Braisé, le Cargo Club. Et avec Taï Forêt Excursions, une journée au parc national de Taï : marche sans bruit derrière le pisteur, photographie les chimpanzés qui cassent les noix et l'hippopotame pygmée.", Interactions: game.VilleIDs(game.SanPedroKey), Keys: []string{game.SanPedroKey},
		Places: []string{game.SPPecheID, game.SPBardotID, game.SPCathedraleID, game.SPMonogagaID, game.SPMaquisID, game.SPClubID, game.SPTaiID, game.BerebyCommune, game.BerebySirenesID, game.BerebyHotelID}},
	{ID: game.KorhogoKey, Label: "Korhogo vivante : les tisserands, les peintres, les forgerons, le Poro", About: "Au pays sénoufo : tisse ta bande de pagne au métier avec les tisserands de Waraniéné, peins une toile avec les peintres de Fakaha, bats le fer avec les forgerons de Koni. Visite l'orée du bois sacré de Koko avec un guide, dans le respect : ce qui est dedans ne se montre pas. Monte sur le rocher du mont Korhogo, cueille les mangues, achète au grand marché une vraie toile de Korhogo sans te faire avoir. Le soir, le tô et le tchapalo au Maquis Le Tô de Mama Sita, le balafon jusqu'à tard au Balafon Club.", Interactions: game.VilleIDs(game.KorhogoKey), Keys: []string{game.KorhogoKey},
		Places: []string{game.KoMontID, game.KoBoisSacreID, game.KoWaranieneID, game.KoFakahaID, game.KoKoniID, game.KoMaquisID, game.KoClubID}},
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
