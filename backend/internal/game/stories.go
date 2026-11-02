package game

import "slices"

// The quartier's stories (the update « histoires », with the demandes): the
// same person comes back day after day with what happened next. A story is a
// few chapters, one a real day at most, each a demande of its own (steps at a
// place of the commune, a thanks, a reward); its last chapter's thanks
// introduces the one whose story comes next. Only free or cheap activities
// with no fixed days, as for the demandes, so a chapter can always be done.

// StoriesKey: the update that opens them (features.go).
const StoriesKey = "histoires"

// StoryChapter: one day's part of a story.
type StoryChapter struct {
	Ask    string       `json:"ask"`
	Thanks string       `json:"thanks"`
	Steps  []ErrandStep `json:"steps"`
	Reward int          `json:"reward"`
}

// Story: who it's about and its chapters, in order.
type Story struct {
	ID       string         `json:"id"`
	Title    string         `json:"title"`
	Giver    string         `json:"giver"`
	Role     string         `json:"role"`
	Gender   string         `json:"gender"`
	Chapters []StoryChapter `json:"-"`
	// Effect: how the Sim feels after each chapter.
	Effect Needs `json:"-"`
	// After: the story it follows on from, which must be done first ("": none).
	After string `json:"-"`
	// Adults: for an adult only (a marriage, a sorcerer's gbairai, a trip alone across the country).
	Adults bool `json:"-"`
}

// Stories: in the order they come; each one's end leads to the next. A story
// a Sim can't do (its age, its commune's places) is passed over.
var Stories = []Story{
	{ID: "kone-petit-fils", Title: "Le petit-fils du vieux Koné", Giver: "Le vieux Koné", Role: "Doyen du grin", Gender: "homme", Effect: Needs{Social: 8},
		Chapters: []StoryChapter{
			{Ask: "Mes yeux ne voient plus bien. Mon petit-fils arrive de France et je veux revoir ses photos : demande au pharmacien s'il a quelque chose pour mes yeux.",
				Thanks: "Des gouttes ? Je vois déjà mieux ! Reviens demain, j'aurai encore besoin de toi.",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil-pharmacien"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "Il arrive demain ! Va te faire beau chez le barbier, je veux te présenter à lui. C'est moi qui paie.",
				Thanks: "Te voilà tout propre ! Il va voir qu'à Babi on a la classe.",
				Steps:  []ErrandStep{{Kind: "barbier", Do: []string{"coupe-courte", "degrade", "boule-a-zero"}, Text: "Se faire couper les cheveux chez le barbier"}}, Reward: 1300},
			{Ask: "Il est arrivé, mais il ne connaît rien ici. Emmène-le manger un garba au maquis, montre-lui Babi !",
				Thanks: "Il a mangé avec les doigts comme un vrai enfant de Babi ! Il ne parle que de toi.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger un garba au maquis avec lui"}}, Reward: 800},
			{Ask: "Il repart demain, mon cœur est lourd. Va prier pour son voyage, qu'il revienne vite.",
				Thanks: "Il a promis de revenir chaque année. Tu fais partie de la famille maintenant. Ah, Tantie Bintou cherche quelqu'un de confiance : passe la voir de ma part.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour son voyage au lieu de culte"}}, Reward: 1000},
		}},
	{ID: "chat-grigri", Title: "Le chat de Mamie Rose", Giver: "Mamie Rose", Role: "Retraitée de la Poste", Gender: "femme", Effect: Needs{Fun: 8, Social: 4},
		Chapters: []StoryChapter{
			{Ask: "Mon chat Grigri a disparu ! Il adore l'odeur de l'alloco du marché. Va voir s'il traîne là-bas.",
				Thanks: "La vendeuse l'a vu filer vers le maquis avec un poisson dans la gueule ! Ce voleur… Reviens demain, on continue les recherches.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"eat-alloco"}, Text: "Chercher Grigri au marché (en mangeant un alloco)"}}, Reward: 500},
			{Ask: "Va au maquis et demande si on a vu un gros chat noir, voleur de poisson.",
				Thanks: "Trois poissons volés, et il est parti vers la pharmacie ?! Mais qu'est-ce qu'il fabrique ?",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Chercher Grigri au maquis (en mangeant un garba)"}}, Reward: 700},
			{Ask: "Va à la pharmacie. Et si mon Grigri était malade ?",
				Thanks: "Grigri est derrière la pharmacie… avec quatre chatons ! Grigri est une maman ! Et moi qui l'appelle « mon gros garçon » depuis cinq ans…",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil-pharmacien"}, Text: "Demander au pharmacien s'il a vu Grigri"}}, Reward: 600},
			{Ask: "Il faut fêter ça ! Prends une sucrerie à la boutique et viens voir les chatons.",
				Thanks: "Je t'en garde un, le plus coquin. Il dort déjà dans une boîte à chaussures avec ton nom dessus.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"sucrerie"}, Text: "Prendre une sucrerie à la boutique pour fêter ça"}}, Reward: 600},
		}},
	{ID: "bintou-maquis", Title: "Le maquis de Tantie Bintou", Giver: "Tantie Bintou", Role: "Vendeuse de garba", Gender: "femme", Effect: Needs{Social: 6, Fun: 4},
		Chapters: []StoryChapter{
			{Ask: "Le vieux Koné m'a parlé de toi. Je veux ouvrir mon propre maquis ! Va manger chez la concurrence et regarde bien comment ils font.",
				Thanks: "Leur attiéké est sec ? Je savais ! Le mien sera meilleur. Reviens demain.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger un garba au maquis du coin"}}, Reward: 700},
			{Ask: "Un maquis sans clients, c'est rien. Va au marché faire le gbairai et dis à tout le monde que Tantie Bintou ouvre bientôt !",
				Thanks: "Tout le marché ne parle que de ça ! Toi-là, tu es ma meilleure publicité.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"gbairai"}, Text: "Faire le gbairai au marché"}}, Reward: 600},
			{Ask: "Aïe, mon dos ! J'ai porté trop de marmites pour préparer l'ouverture. Va demander au pharmacien ce qu'il faut.",
				Thanks: "La pommade fait du bien. Demain c'est le grand jour, ne rate pas ça !",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil-pharmacien"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "C'est l'ouverture ! Viens manger au maquis, je veux voir du monde à mes tables.",
				Thanks: "Mon maquis est plein ! Je n'oublierai jamais ce que tu as fait. Serge, le voisin de cour, a un gros souci de cœur : il a besoin de toi.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger au maquis le jour de l'ouverture"}}, Reward: 1500},
		}},
	{ID: "grand-match", Title: "La finale des moins de 13 ans", Giver: "Coach Bamba", Role: "Entraîneur des petits du quartier", Gender: "homme", Effect: Needs{Fun: 8},
		Chapters: []StoryChapter{
			{Ask: "Mes petits jouent la finale samedi, et l'équipe d'en face a un « petit » qui mesure deux mètres ! Va regarder leur match au terrain, espionne-les pour moi.",
				Thanks: "Il a de la barbe, ce « petit » ! Et il conduit une moto pour venir aux matchs. On va porter réclamation.",
				Steps:  []ErrandStep{{Kind: "sport", Do: []string{"watch-match"}, City: "abidjan", Text: "Espionner l'équipe adverse au terrain"}}, Reward: 1300},
			{Ask: "Va au commissariat demander comment on prouve l'âge d'un joueur.",
				Thanks: "Il faut son extrait de naissance. Et comme par hasard, il l'a « perdu » la semaine dernière…",
				Steps:  []ErrandStep{{Kind: "police", Do: []string{"renseignement"}, City: "abidjan", Text: "Se renseigner à l'accueil du commissariat"}}, Reward: 500},
			{Ask: "Mes petits ont besoin de forces pour la finale : va manger un alloco au marché et dis à la vendeuse d'en préparer pour toute l'équipe.",
				Thanks: "Ils ont tout mangé en deux minutes. J'ai une équipe qui a faim de victoire !",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"eat-alloco"}, Text: "Commander l'alloco de l'équipe au marché"}}, Reward: 600},
			{Ask: "C'est le jour de la finale. Va prier pour mes petits, ils tremblent comme des feuilles.",
				Thanks: "On a gagné 2-1 ! Et le « petit » a fini par avouer : il redouble sa troisième pour la troisième fois. La coupe est dans ma boutique, viens la voir quand tu veux.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour l'équipe avant la finale"}}, Reward: 800},
		}},
	{ID: "serge-fatou", Title: "Serge et Fatou", Giver: "Serge", Role: "Voisin de cour", Gender: "homme", Effect: Needs{Social: 8, Fun: 2},
		Chapters: []StoryChapter{
			{Ask: "Fatou, ma go, ne me parle plus et je ne sais même pas pourquoi. Va au maquis faire le gbairai : je veux savoir ce qu'on dit sur moi.",
				Thanks: "J'ai oublié son anniversaire ?! Je suis mort. Reviens demain, il faut un plan.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"gbairai"}, Text: "Faire le gbairai au maquis"}}, Reward: 600},
			{Ask: "Je dois l'appeler pour m'excuser, mais mon crédit est fini. Va m'en acheter à la boutique, je te rembourse.",
				Thanks: "Elle a décroché ! Elle veut bien me revoir… si je deviens sérieux.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"credit"}, Text: "Acheter du crédit à la boutique"}}, Reward: 900},
			{Ask: "Être sérieux, c'est demander sa main. J'ai peur ! Va prier pour moi, que Dieu me donne le courage.",
				Thanks: "Je me sens fort comme un lion. Demain, on prépare la dot !",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour lui au lieu de culte"}}, Reward: 600},
			{Ask: "Pour la dot, il faut des pagnes, et les tanties du marché me font toujours le prix fort. Va marchander pour moi !",
				Thanks: "Elle a dit oui ! Le mariage est à la fin du mois, et c'est toi mon témoin. Tout le quartier te connaît maintenant.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"bargain"}, Text: "Marchander les pagnes au marché"}}, Reward: 1200},
		}},
	{ID: "recette-ahou", Title: "La recette de Mémé Ahou", Giver: "Mémé Ahou", Role: "La grand-mère que tout le quartier appelle Mémé", Gender: "femme", Effect: Needs{Social: 8, Hunger: 6},
		Chapters: []StoryChapter{
			{Ask: "Je suis trop vieille pour transmettre ma sauce graine à n'importe qui. D'abord, prouve-moi que tu as du goût : va au maquis et dis-moi ce que vaut leur cuisine.",
				Thanks: "Trop d'huile, pas assez d'amour ? Tu as la langue fine. Reviens demain.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Goûter la cuisine du maquis"}}, Reward: 700},
			{Ask: "Une bonne sauce commence au marché. Va goûter les bananes de la vendeuse du coin : pour le foutou, il faut les meilleures.",
				Thanks: "Elles sont bien mûres, tu dis ? Tu commences à comprendre.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"eat-alloco"}, Text: "Goûter les bananes au marché"}}, Reward: 600},
			{Ask: "Ma recette me vient de ma mère, qui la tenait de la sienne. Va prier pour elles avant que je te la donne.",
				Thanks: "Voilà. Maintenant, les anciennes savent que tu es digne. Demain, on cuisine.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour les anciennes"}}, Reward: 500},
			{Ask: "Va dire à toute la rue que Mémé Ahou fait sa sauce graine dimanche, et que tout le monde est invité !",
				Thanks: "Tout le quartier est venu, et c'est toi qui as servi. La recette est à toi maintenant : ne la donne à personne… sauf à tes petits-enfants.",
				Steps:  []ErrandStep{{Kind: "rue", Do: []string{"flaner-rue"}, Text: "Inviter toute la rue d'ambiance"}}, Reward: 900},
		}},
	// The mysteries: a gbairai nobody expected, a sorcerer the quartier swears by, and a trip to see
	// for oneself. What's behind them is people (jealousy, greed); a little of the mystery stays.
	{ID: "maquis-maudit", Title: "Le maquis maudit", Giver: "Tantie Bintou", Role: "Patronne de maquis", Gender: "femme", Effect: Needs{Social: 6, Fun: 6}, After: "bintou-maquis", Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Depuis une semaine, mes clients ont mal au ventre et tout le quartier dit que mon maquis est « travaillé » : quelqu'un m'aurait lancé un sort ! Va au maquis écouter ce qu'on raconte.",
				Thanks: "On dit que c'est Tantie Mado, ma concurrente, qui est allée voir un marabout à Grand-Bassam ?! Je n'y crois pas… mais j'ai peur. Reviens demain.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"gbairai"}, Text: "Écouter le gbairai au maquis"}}, Reward: 600},
			{Ask: "Avant de crier au sort, va demander au pharmacien ce qui peut donner mal au ventre comme ça.",
				Thanks: "Il dit que ça vient souvent du poisson pas frais… Mon poisson arrive de Grand-Bassam. Le marabout et le poisson, la même ville ! Il faut aller voir là-bas.",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil-pharmacien"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "Va à Grand-Bassam. Marche sur la plage où les pêcheurs débarquent et regarde d'où vient mon poisson ; puis va au maquis de la plage demander qui raconte cette histoire de sort. Je te rembourse une partie du car.",
				Thanks: "Le « marabout », c'est le cousin du fournisseur ! Il faisait courir le gbairai pour qu'on accuse Tantie Mado au lieu de son poisson. Les gens, hein…",
				Steps: []ErrandStep{
					{Kind: "beach", Do: []string{"balade-plage"}, City: "grand-bassam", Text: "Marcher sur la plage de Grand-Bassam, chez les pêcheurs",
						Said: "Les pêcheurs t'ont dit ça ? Mon fournisseur garde le poisson trois jours sans glace pour gagner plus ! Le voilà, le sort. Mais qui a inventé le marabout ?"},
					{Kind: "maquis", Do: []string{"gbairai"}, City: "grand-bassam", Text: "Faire le gbairai au maquis de Grand-Bassam"},
				}, Reward: 2000},
			{Ask: "J'ai changé de fournisseur et je me suis réconciliée avec Mado. Viens manger chez moi : poisson frais, garanti sans sort !",
				Thanks: "Mado et moi, on va faire un maquis ensemble ! Mais dis… Serge m'a dit que la famille de Fatou raconte des choses bizarres sur son mariage. Va le voir, il a besoin de toi.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger au maquis de Tantie Bintou"}}, Reward: 900},
		}},
	{ID: "avion-gilbert", Title: "Le retour de Tonton Gilbert", Giver: "Tata Odette", Role: "Vendeuse de pagnes", Gender: "femme", Effect: Needs{Fun: 8, Social: 4}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Mon mari Gilbert rentre de Paris après dix ans ! Va faire une retouche chez le couturier, je veux qu'il me dise si son travail est encore bon avant de lui confier mon pagne.",
				Thanks: "Il travaille toujours bien ? Alors mon pagne sera prêt pour l'arrivée !",
				Steps:  []ErrandStep{{Kind: "couture", Do: []string{"retouche"}, Text: "Essayer le couturier avec une retouche"}}, Reward: 1300},
			{Ask: "Il arrive demain. Va l'attendre aux arrivées de l'aéroport, moi je suis trop émue, je vais pleurer devant tout le monde.",
				Thanks: "Il est arrivé… avec une Blanche et deux enfants ?! Dix ans que je l'attends, et voilà ce qu'il me ramène !",
				Steps:  []ErrandStep{{Kind: "aeroport", Do: []string{"accueillir-arrivees"}, City: "abidjan", Text: "Attendre Tonton Gilbert aux arrivées de l'aéroport"}}, Reward: 800},
			{Ask: "Je ne sais plus quoi penser. Va prier pour moi, et pour lui… s'il le mérite.",
				Thanks: "La « Blanche », c'est sa nièce, la fille de son frère de Lyon ! Et les enfants, ses petits-neveux. J'ai cassé deux assiettes pour rien.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour Tata Odette"}}, Reward: 600},
			{Ask: "Pour me faire pardonner, on fait la fête au maquis ce soir. Viens, Gilbert veut te remercier.",
				Thanks: "Gilbert rit encore de ma crise. Moi aussi, maintenant. Il dit que tu es la seule personne calme de tout le quartier.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Faire la fête au maquis avec la famille"}}, Reward: 800},
		}},
	{ID: "caimans", Title: "La bague des caïmans sacrés", Giver: "Tonton Kouassi", Role: "Chauffeur de woro-woro", Gender: "homme", Effect: Needs{Social: 6, Fun: 6}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Quand j'étais petit, la bague de mon père est tombée dans le lac aux caïmans de Yamoussoukro. Depuis, ma famille dit qu'on est maudits. Et voilà que je rêve des caïmans toutes les nuits… Va à la gare, les chauffeurs de car pour Yakro savent tout du lac.",
				Thanks: "Ils disent que les caïmans gardent ce qu'on leur jette, et ne le rendent qu'à celui qui a le cœur pur. Tu vois que je ne suis pas fou !",
				Steps:  []ErrandStep{{Kind: "transport", Do: []string{"coxers"}, City: "abidjan", Text: "Questionner les coxers de la gare"}}, Reward: 500},
			{Ask: "Va à Yamoussoukro, au lac aux caïmans. Mon père disait que la bague brillait au fond, près du plus gros caïman. Et si tu ne vois rien, demande autour de toi.",
				Thanks: "Il l'a vendue à… mon propre oncle ! Celui qui me répète depuis vingt ans que la famille est maudite ! Rentre vite, il faut que je lui parle.",
				Steps: []ErrandStep{
					{Kind: "nature", Do: []string{"photos", "hike"}, City: "yamoussoukro", Text: "Aller au lac aux caïmans de Yamoussoukro",
						Said: "Le gardien du lac dit qu'un pêcheur a trouvé une bague sur la rive il y a vingt ans, et qu'il l'a vendue ? Les caïmans n'ont rien gardé du tout… Le pêcheur boit au maquis du lac, paraît-il."},
					{Kind: "maquis", Do: []string{"gbairai"}, City: "yamoussoukro", Text: "Retrouver le pêcheur au maquis de Yamoussoukro",
						Said: "Le pêcheur a avoué à qui il l'a vendue, mais il veut que tu ailles d'abord prier à la Basilique pour son pardon. Drôle de bonhomme…"},
					{Kind: "worship", Do: []string{"pray"}, City: "yamoussoukro", Text: "Prier à la Basilique de Yamoussoukro"},
				}, Reward: 2000},
			{Ask: "Mon oncle accepte de me voir, mais seulement au maquis, devant témoins. Viens avec moi, j'ai les jambes qui tremblent.",
				Thanks: "Mon oncle m'a rendu la bague en pleurant : il avait honte depuis vingt ans. La malédiction, c'était juste le silence. Je ne rêve plus des caïmans.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Accompagner Tonton Kouassi au maquis"}}, Reward: 1000},
		}},
	{ID: "brouteur", Title: "Le neveu brouteur", Giver: "Tantie Clarisse", Role: "Commerçante au marché", Gender: "femme", Effect: Needs{Social: 8}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Mon neveu Jojo roule en grosse voiture depuis un mois, et il ne travaille pas. Il me demande du crédit pour « son business sur internet ». Achète-moi du crédit, je veux l'appeler et comprendre.",
				Thanks: "Il parle d'un « mugu » à Paris qui lui envoie de l'argent… Il broute ! Mon propre neveu arnaque des gens sur internet !",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"credit"}, Text: "Acheter du crédit à la boutique"}}, Reward: 900},
			{Ask: "Va au commissariat demander ce qu'on risque pour ce genre d'arnaque.",
				Thanks: "La prison, la honte, et tout l'argent à rendre ! Il faut qu'il arrête avant qu'il soit trop tard.",
				Steps:  []ErrandStep{{Kind: "police", Do: []string{"renseignement"}, City: "abidjan", Text: "Se renseigner au commissariat"}}, Reward: 500},
			{Ask: "Sa mère dit qu'il a payé un « blindage » chez un féticheur pour ne jamais être pris. Va prier pour qu'il ouvre les yeux.",
				Thanks: "Il a vu à la télé une vieille femme qui avait tout perdu à cause d'un brouteur. Il n'arrête pas d'y penser. Le blindage, il commence à douter.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour Jojo"}}, Reward: 600},
			{Ask: "Il veut un vrai travail ! Va lire les offres d'emploi avec lui, il a honte d'y aller seul.",
				Thanks: "Il commence lundi comme livreur. Moins d'argent, mais il dort la nuit. Et il a vendu la voiture pour rembourser ce qu'il pouvait.",
				Steps:  []ErrandStep{{Kind: "office", Do: []string{"read-ads"}, City: "abidjan", Text: "Lire les offres d'emploi avec Jojo"}}, Reward: 900},
		}},
	{ID: "mami-wata", Title: "La lumière sur la lagune", Giver: "Akpa", Role: "Pêcheur ébrié", Gender: "homme", Effect: Needs{Fun: 6, Social: 4},
		Chapters: []StoryChapter{
			{Ask: "Depuis trois nuits, une lumière danse sur la lagune. Les anciens disent que c'est Mami Wata qui est fâchée. Va voir au bord de l'eau, moi je n'ose plus.",
				Thanks: "Des bouteilles en plastique partout, tu dis ? Mami Wata est fâchée parce qu'on salit sa maison, voilà !",
				Steps:  []ErrandStep{{Kind: "lagune", Do: []string{"balade-lagune"}, City: "abidjan", Text: "Aller voir la lagune de près"}}, Reward: 600},
			{Ask: "Va dans la rue d'ambiance et dis aux gens d'arrêter de jeter leurs déchets dans la lagune.",
				Thanks: "Certains ont ri, d'autres ont promis. Un vieux t'a même dit qu'il avait vu Mami Wata en personne, en 1987. C'est un début.",
				Steps:  []ErrandStep{{Kind: "rue", Do: []string{"flaner-rue"}, Text: "Parler aux gens de la rue d'ambiance"}}, Reward: 500},
			{Ask: "Ce soir, au coucher du soleil, on ramasse les plastiques au bord de l'eau. Viens avec nous !",
				Thanks: "Vingt sacs de plastique ! Et la lumière ? C'était la lampe d'un pêcheur de crabes… Mais chut : laisse les enfants croire à Mami Wata, ça les rend sages.",
				Steps:  []ErrandStep{{Kind: "lagune", Do: []string{"coucher-soleil", "balade-lagune"}, City: "abidjan", Text: "Ramasser les plastiques au bord de la lagune"}}, Reward: 900},
		}},
	{ID: "mariage-attache", Title: "Le mariage attaché", Giver: "Serge", Role: "Voisin de cour", Gender: "homme", Effect: Needs{Social: 8, Fun: 6}, After: "serge-fatou", Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Tout le quartier raconte que mon mariage est « attaché » : la tante de Fatou aurait fait faire un fétiche à Man pour l'empêcher. Fatou pleure tous les jours. Va écouter le gbairai, savoir qui a lancé ça.",
				Thanks: "C'est parti de la cour de la tante Akoua… Elle vient de Man, de la montagne. Fatou dit qu'on ne peut pas se marier sans la bénédiction de sa grand-mère là-bas, Mama Gueu.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"gbairai"}, Text: "Écouter le gbairai au maquis"}}, Reward: 600},
			{Ask: "Avant le voyage, va prier pour nous protéger. Avec ces histoires de fétiches, je ne dors plus.",
				Thanks: "Bon. Tu pars pour Man : à la gare, prends le car de l'Ouest. Je t'en dois une, mon ami·e.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier au lieu de culte"}}, Reward: 600},
			{Ask: "À Man, va au marché : tout le monde connaît Mama Gueu. Demande où la trouver, puis monte la voir dans la montagne. N'aie pas peur de ce que tu vas entendre.",
				Thanks: "Mama Gueu a ri : « Le seul fétiche ici, c'est la jalousie. » La tante Akoua voulait que Fatou épouse le fils de son amie. Mama Gueu t'a donné un pagne pour la mariée : c'est sa bénédiction.",
				Steps: []ErrandStep{
					{Kind: "market", Do: []string{"gbairai", "bargain"}, City: "man", Text: "Demander Mama Gueu au marché de Man",
						Said: "« Mama Gueu ? Elle parle aux génies de la montagne », disent les gens. Elle t'attend près de la cascade."},
					{Kind: "nature", Do: []string{"hike", "photos"}, City: "man", Text: "Aller voir Mama Gueu dans la montagne de Man"},
				}, Reward: 2000},
			{Ask: "Tu es rentré·e avec le pagne ! Viens au maquis, on fête ça : la tante Akoua l'a vu et elle a pleuré.",
				Thanks: "Le mariage aura lieu ! Sorcellerie ou pas, c'est toi qui as tout débloqué. Le vieux Koné dit qu'on parle de toi jusqu'à Man maintenant.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Fêter ça au maquis"}}, Reward: 1000},
		}},
	{ID: "toile-korhogo", Title: "La fausse toile de Korhogo", Giver: "Madame Diomandé", Role: "Galeriste à Cocody", Gender: "femme", Effect: Needs{Fun: 6}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Au marché, on vend des « toiles de Korhogo » à 5 000 F. Une vraie vaut dix fois plus. Va marchander, écoute bien ce que le vendeur raconte.",
				Thanks: "« Peinte à Korhogo, garanti » ? Peinte hier dans une cour d'Adjamé, oui ! Les vrais artistes doivent savoir.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"bargain"}, Text: "Marchander une fausse toile au marché"}}, Reward: 600},
			{Ask: "Va au grand marché de Korhogo et demande les peintres de Fakaha, le village des vraies toiles. Quelqu'un saura te guider.",
				Thanks: "Il t'a confié une vraie toile, signée : le coton filé à la main, les teintures de boue et d'écorce. Une merveille. On va monter une exposition !",
				Steps: []ErrandStep{
					{Kind: "market", Do: []string{"gbairai", "bargain"}, City: "korhogo", Text: "Demander les peintres au grand marché de Korhogo",
						Said: "Les peintres savent déjà : leurs dessins sont copiés et vendus à Abidjan. Le vieux maître Soro t'attend après la prière, à la grande mosquée."},
					{Kind: "worship", Do: []string{"pray"}, City: "korhogo", Text: "Rejoindre maître Soro à la grande mosquée de Korhogo"},
				}, Reward: 2000},
			{Ask: "C'est le vernissage ! Viens faire un tour au centre commercial, l'expo est dans le hall.",
				Thanks: "Un succès ! Les peintres de Korhogo vendront leurs toiles eux-mêmes, au vrai prix. Et le faussaire d'Adjamé ? Il fait des copies… de tes photos de l'expo.",
				Steps:  []ErrandStep{{Kind: "mall", Do: []string{"leche-vitrine"}, City: "abidjan", Text: "Aller au vernissage au centre commercial"}}, Reward: 800},
		}},
	{ID: "voix-bouake", Title: "La voix de Bouaké", Giver: "DJ Kader", Role: "DJ du quartier", Gender: "homme", Effect: Needs{Fun: 10}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Une chanson tourne sur tous les téléphones : « Mami de Bouaké ». Personne ne sait qui chante. Va au maquis, écoute ce qu'on dit.",
				Thanks: "Elle chante au grand marché de Bouaké, entre deux clients, et refuse qu'on la filme. Je veux la faire chanter à ma soirée !",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"gbairai"}, Text: "Écouter le gbairai au maquis"}}, Reward: 600},
			{Ask: "Va au grand marché de Bouaké et trouve-la. Suis la voix !",
				Thanks: "Il a écouté la chanson sur ton téléphone, et il a pleuré. Il ne savait pas qu'elle chantait si bien. Il a dit oui !",
				Steps: []ErrandStep{
					{Kind: "market", Do: []string{"gbairai", "bargain"}, City: "bouake", Text: "Trouver la chanteuse au grand marché de Bouaké",
						Said: "C'est Awa Kouakou, la vendeuse de piment ! Mais elle a peur : son mari dit que chanter, ce n'est pas pour une femme mariée. Il est au CHU, la jambe cassée : va lui parler."},
					{Kind: "health", Do: []string{"visite-malade"}, City: "bouake", Text: "Rendre visite au mari au CHU de Bouaké"},
				}, Reward: 2000},
			{Ask: "Elle chante ce soir dans la rue d'ambiance ! Viens danser.",
				Thanks: "Toute la rue chantait avec elle, et son mari était au premier rang avec ses béquilles. Trois maisons de disques m'ont déjà appelé.",
				Steps:  []ErrandStep{{Kind: "rue", Do: []string{"danser-rue", "flaner-rue"}, Text: "Danser au concert de la rue d'ambiance"}}, Reward: 1000},
		}},
	{ID: "revenant-port", Title: "Le bateau fantôme de San-Pédro", Giver: "Pépé Tagro", Role: "Ancien pêcheur", Gender: "homme", Effect: Needs{Social: 6, Fun: 6}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Mon fils Daniel est parti pêcher à San-Pédro il y a un mois, et il ne répond plus. Là-bas, on dit qu'on voit son bateau la nuit, sans personne à bord. Va prier pour lui.",
				Thanks: "Un bateau fantôme… Les gens disent qu'il est mort et qu'il revient. Moi, je ne veux pas le croire. Il faut aller voir.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour Daniel"}}, Reward: 600},
			{Ask: "Va à San-Pédro. Parle aux pêcheurs sur la plage, écoute les marins, et trouve mon fils.",
				Thanks: "Daniel est dans le car avec toi ? Mon fils rentre ! Merci, merci…",
				Steps: []ErrandStep{
					{Kind: "beach", Do: []string{"balade-plage"}, City: "san-pedro", Text: "Parler aux pêcheurs sur la plage de San-Pédro",
						Said: "Le bateau sort la nuit, toutes lumières éteintes… et revient chargé jusqu'au bord. Un fantôme qui travaille autant, ce n'est pas un fantôme. Les marins boivent au maquis du port."},
					{Kind: "maquis", Do: []string{"gbairai"}, City: "san-pedro", Text: "Écouter les marins au maquis du port de San-Pédro",
						Said: "Daniel travaille pour des trafiquants de bois ! Il n'ose pas rentrer : ils disent qu'il leur doit de l'argent. Il t'attend à la gare routière."},
					{Kind: "transport", Do: []string{"attendre-car"}, City: "san-pedro", Text: "Retrouver Daniel à la gare routière de San-Pédro"},
				}, Reward: 2000},
			{Ask: "Daniel a peur de parler. Viens prier avec nous, il ira à la police demain.",
				Thanks: "Mon fils a tout dit à la police, et les vrais revenants sont en prison. Le bateau ? Il pêche de nouveau, en plein jour.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier avec Pépé Tagro et Daniel"}}, Reward: 800},
		}},
}

// FindStory: a story by its ID.
func FindStory(id string) (Story, bool) {
	i := slices.IndexFunc(Stories, func(s Story) bool { return s.ID == id })
	if i < 0 {
		return Story{}, false
	}
	return Stories[i], true
}

// For: whether a Sim at this stage can do every chapter, with the kinds of place
// it can reach (its commune's, and other cities' as « city/kind » when it may travel).
func (st Story) For(stage string, kinds map[string]bool) bool {
	if stage == StageBebe || st.Adults && stage != StageAdulte {
		return false
	}
	for _, c := range st.Chapters {
		if !errandFor(Errand{Steps: c.Steps}, stage, kinds) {
			return false
		}
	}
	return true
}

// NextStory: the first story not yet seen that the Sim can do, the one it follows on from done
// (`seen`: the stories begun, all done when none is under way).
func NextStory(seen map[string]bool, stage string, kinds map[string]bool) (Story, bool) {
	for _, st := range Stories {
		if !seen[st.ID] && (st.After == "" || seen[st.After]) && st.For(stage, kinds) {
			return st, true
		}
	}
	return Story{}, false
}
