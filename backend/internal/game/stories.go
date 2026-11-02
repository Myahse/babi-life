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
	{ID: "bintou-maquis", Title: "Le maquis de Tantie Bintou", Giver: "Tantie Bintou", Role: "Vendeuse de garba", Gender: "femme", Effect: Needs{Social: 6, Fun: 4}, After: "kone-petit-fils",
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
	{ID: "serge-fatou", Title: "Serge et Fatou", Giver: "Serge", Role: "Voisin de cour", Gender: "homme", Effect: Needs{Social: 8, Fun: 2}, After: "bintou-maquis",
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
	// The second series.
	{ID: "chimpanze", Title: "L'évasion de Zézé", Giver: "Monsieur Gnagne", Role: "Soigneur au zoo d'Abidjan", Gender: "homme", Effect: Needs{Fun: 10},
		Chapters: []StoryChapter{
			{Ask: "Zézé, notre chimpanzé, s'est échappé cette nuit ! Viens au zoo et prends sa cage en photo : il faut comprendre comment il a fait.",
				Thanks: "Sur tes photos, on voit la clé… accrochée à l'intérieur de la cage. Quelqu'un l'a oubliée. Ou quelqu'un l'a aidé ?",
				Steps:  []ErrandStep{{Kind: "zoo", Do: []string{"zoo-photos"}, City: "abidjan", Text: "Prendre la cage vide en photo au zoo"}}, Reward: 600},
			{Ask: "On dit qu'un « petit monsieur poilu » a volé des sucreries à la boutique du quartier. Va voir !",
				Thanks: "Le boutiquier jure qu'il a payé avec une capsule de bouteille. Zézé est malin, mais pas à ce point… Il a un complice.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"sucrerie"}, Text: "Enquêter à la boutique (en prenant une sucrerie)"}}, Reward: 700},
			{Ask: "Suis la piste : le marché d'abord, puis la rue. Ouvre bien les yeux.",
				Thanks: "C'est le petit Junior, le fils du gardien ! Il a libéré Zézé parce qu'il le trouvait triste tout seul. Zézé dormait chez lui, dans son lit, avec son doudou.",
				Steps: []ErrandStep{
					{Kind: "market", Do: []string{"eat-alloco"}, Text: "Suivre la piste au marché (en mangeant un alloco)",
						Said: "La vendeuse d'alloco dit qu'un enfant lui achète des bananes tous les jours « pour son grand frère poilu »…"},
					{Kind: "rue", Do: []string{"flaner-rue"}, Text: "Retrouver l'enfant dans la rue"},
				}, Reward: 900},
			{Ask: "Zézé est rentré, et le zoo lui a trouvé une copine ! Viens pique-niquer au zoo pour fêter ça.",
				Thanks: "Junior est devenu « assistant soigneur » le mercredi. Et Zézé ? Il a déjà appris à ouvrir la nouvelle cage. On a un problème.",
				Steps:  []ErrandStep{{Kind: "zoo", Do: []string{"zoo-pique-nique"}, City: "abidjan", Text: "Pique-niquer au zoo"}}, Reward: 900},
		}},
	{ID: "cacao-daloa", Title: "Le cacao de Daloa", Giver: "Cousin Gnaoré", Role: "Planteur de cacao", Gender: "homme", Effect: Needs{Social: 8}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Je t'appelle de Daloa : mon cacao pèse de moins en moins chez le pisteur, alors que ma récolte est meilleure que l'an dernier ! Achète-moi du crédit, mon téléphone est à sec.",
				Thanks: "Le pisteur dit que mes fèves sont « trop légères ». Les fèves de tout le village sont trop légères, comme par hasard.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"credit"}, Text: "Acheter du crédit pour le cousin"}}, Reward: 900},
			{Ask: "Viens à Daloa. Va au marché voir les balances, puis écoute les planteurs au maquis.",
				Thanks: "Les planteurs vont aller ensemble à la coopérative avec une vraie balance. Le pisteur a déjà disparu du village.",
				Steps: []ErrandStep{
					{Kind: "market", Do: []string{"bargain", "gbairai"}, City: "daloa", Text: "Regarder les balances au marché de Daloa",
						Said: "Au marché, une vieille balance de pisteur se vend… avec un aimant collé dessous ! Les balances sont truquées."},
					{Kind: "maquis", Do: []string{"gbairai"}, City: "daloa", Text: "Écouter les planteurs au maquis de Daloa"},
				}, Reward: 2000},
			{Ask: "Va au commissariat demander comment on porte plainte pour une balance truquée.",
				Thanks: "Il faut que les planteurs portent plainte ensemble. Le village entier est d'accord !",
				Steps:  []ErrandStep{{Kind: "police", Do: []string{"renseignement"}, City: "abidjan", Text: "Se renseigner au commissariat"}}, Reward: 500},
			{Ask: "Je suis à Abidjan pour la plainte ! Viens manger avec moi au maquis, c'est moi qui paie.",
				Thanks: "Le pisteur doit rembourser tout le village. Pour la première fois, mon cacao a été payé au vrai poids. Chez moi, tu auras toujours du chocolat.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger au maquis avec le cousin"}}, Reward: 900},
		}},
	{ID: "bac-fanta", Title: "Le bac de Fanta", Giver: "Fanta", Role: "Élève de terminale", Gender: "femme", Effect: Needs{Social: 6, Fun: 4},
		Chapters: []StoryChapter{
			{Ask: "Le bac est dans une semaine et je ne dors plus. Va demander au pharmacien s'il y a quelque chose contre le stress… mais pas de dopage, hein !",
				Thanks: "Il dit : dormir, boire de l'eau et bien manger. Rien de magique. Ma tante, elle, veut m'acheter un « bic béni » chez le marabout…",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil-pharmacien"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "On révise mieux le ventre plein. Va goûter le garba du maquis, c'est la tradition de la veille du bac.",
				Thanks: "Le garba de la veille du bac, ça porte bonheur, tout le monde le sait. Maintenant, la philo !",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger le garba de la veille du bac"}}, Reward: 700},
			{Ask: "C'est demain. Va prier pour moi, j'ai la tête qui tourne.",
				Thanks: "J'ai écrit quatre pages sur « Peut-on être libre sans les autres ? ». Je crois que j'ai parlé de toi.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour Fanta"}}, Reward: 500},
			{Ask: "Les résultats sont affichés ! Va prendre une sucrerie à la boutique, je n'ose pas regarder…",
				Thanks: "Admise, mention assez bien ! Et le « bic béni » de ma tante ? Je ne l'ai jamais utilisé : il n'avait plus d'encre.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"sucrerie"}, Text: "Prendre une sucrerie en attendant les résultats"}}, Reward: 700},
		}},
	{ID: "telephone-vole", Title: "Le téléphone de Prisca", Giver: "Prisca", Role: "Étudiante en droit", Gender: "femme", Effect: Needs{Social: 8}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "On m'a arraché mon téléphone au carrefour ! Tous mes cours sont dedans. Viens faire la déclaration au commissariat avec moi.",
				Thanks: "Le policier dit que les téléphones volés finissent souvent au marché, revendus dès le lendemain.",
				Steps:  []ErrandStep{{Kind: "police", Do: []string{"declaration-perte"}, City: "abidjan", Text: "Faire la déclaration au commissariat"}}, Reward: 600},
			{Ask: "Va au marché écouter les vendeurs de téléphones d'occasion.",
				Thanks: "Un vendeur a reconnu ma coque rose ! Il l'a achetée à un garçon de quatorze ans qui traîne à la gare.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"gbairai"}, Text: "Écouter les vendeurs au marché"}}, Reward: 600},
			{Ask: "Va à la gare et demande aux coxers s'ils connaissent ce garçon.",
				Thanks: "Il s'appelle Kevin. Il vole pour payer l'école de sa petite sœur. Il m'a rendu le téléphone en pleurant.",
				Steps:  []ErrandStep{{Kind: "transport", Do: []string{"coxers"}, City: "abidjan", Text: "Questionner les coxers de la gare"}}, Reward: 600},
			{Ask: "Je ne veux pas porter plainte. Va prier pour lui, et pour moi : je vais l'aider autrement.",
				Thanks: "Sa sœur a une bourse, et Kevin vend des journaux au carrefour, là même où il m'a volée. Il me dit bonjour tous les matins.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour Kevin"}}, Reward: 700},
		}},
	{ID: "cour-hantee", Title: "La cour hantée", Giver: "Maman Brigitte", Role: "Propriétaire de la cour commune", Gender: "femme", Effect: Needs{Social: 6, Fun: 6},
		Chapters: []StoryChapter{
			{Ask: "Chaque nuit, on entend des pas sur le toit et des pleurs dans la chambre vide. Les locataires disent que c'est l'ancien propriétaire, mort l'année dernière. Va prier pour qu'il repose en paix.",
				Thanks: "Cette nuit, ça a encore marché sur le toit. L'âme n'est pas calmée… ou alors, ce n'est pas une âme.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour l'ancien propriétaire"}}, Reward: 500},
			{Ask: "Va demander au commissariat s'il y a eu des cambriolages dans le quartier.",
				Thanks: "Aucun cambriolage. Mais des enfants des rues dorment parfois sur les toits quand il pleut… Hum.",
				Steps:  []ErrandStep{{Kind: "police", Do: []string{"renseignement"}, City: "abidjan", Text: "Se renseigner au commissariat"}}, Reward: 500},
			{Ask: "Va traîner dans la rue ce soir et ouvre bien l'œil.",
				Thanks: "Tu as vu une ombre sauter du toit vers le manguier ? Et un chat qui miaule comme un bébé qui pleure… Le fantôme est double !",
				Steps:  []ErrandStep{{Kind: "rue", Do: []string{"flaner-rue"}, Text: "Guetter le fantôme dans la rue"}}, Reward: 600},
			{Ask: "On a trouvé le « fantôme » : deux enfants qui dormaient dans la chambre vide, et la chatte du voisin pour les pleurs. Prends-leur des sucreries à la boutique.",
				Thanks: "Les deux petits dorment dans la chambre, pour de vrai maintenant, et ils vont à l'école : les locataires ont cotisé. La cour n'a jamais été aussi vivante.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"sucrerie"}, Text: "Prendre des sucreries pour les enfants"}}, Reward: 700},
		}},
	{ID: "dent-de-man", Title: "Le défi de la Dent de Man", Giver: "Boris", Role: "Coach sportif (sur Gbairai)", Gender: "homme", Effect: Needs{Fun: 10}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "J'ai parié avec les gars que je monterais la Dent de Man en moins de trois heures. Le problème : je n'ai pas couru depuis 2009. Viens t'entraîner au stade avec moi.",
				Thanks: "Trois tours, et je crachais mes poumons. Il me faut un plan B…",
				Steps:  []ErrandStep{{Kind: "stade", Do: []string{"stade-footing"}, City: "abidjan", Text: "S'entraîner au stade avec Boris"}}, Reward: 600},
			{Ask: "Va demander au pharmacien ce qu'il faut pour les courbatures. J'ai mal à des muscles que je ne connaissais pas.",
				Thanks: "De la pommade et du repos. Mais le départ, c'est demain : pas le temps de se reposer !",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil-pharmacien"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "On part pour Man ! Passe au marché prendre un bâton de marche, et on attaque la montagne.",
				Thanks: "On est en haut ! Quatre heures et demie : j'ai perdu le pari… mais quelle vue ! Les gars ont filmé, je suis une star sur Tikitoko.",
				Steps: []ErrandStep{
					{Kind: "market", Do: []string{"bargain", "gbairai"}, City: "man", Text: "Acheter un bâton de marche au marché de Man",
						Said: "Le vendeur t'a dit : « La Dent, on la monte doucement, sinon c'est elle qui te mord. » Boris n'a pas écouté."},
					{Kind: "nature", Do: []string{"hike"}, City: "man", Text: "Monter la Dent de Man"},
				}, Reward: 2000},
			{Ask: "J'ai perdu le pari : c'est moi qui paie le garba à tout le monde. Viens, tu as mérité ta part.",
				Thanks: "L'année prochaine, je refais le pari. Mais cette fois, je m'entraîne avant. Peut-être.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Manger le garba du pari perdu"}}, Reward: 800},
		}},
	{ID: "roi-manette", Title: "Le roi de la manette", Giver: "Petit Seydou", Role: "Collégien", Gender: "homme", Effect: Needs{Fun: 10},
		Chapters: []StoryChapter{
			{Ask: "Le grand Momo est imbattable au foot sur console, il humilie tout le monde à la salle de jeux. Va le regarder jouer et trouve son secret !",
				Thanks: "Il prend toujours la même équipe et il attaque toujours par la gauche ? Je vais défendre à gauche !",
				Steps:  []ErrandStep{{Kind: "gaming", Do: []string{"regarder-console"}, City: "abidjan", Text: "Regarder Momo jouer à la salle de jeux"}}, Reward: 500},
			{Ask: "Entraîne-toi avec moi : un match à la console !",
				Thanks: "Tu m'as mis 4-0… Bon. Au moins, je sais encaisser.",
				Steps:  []ErrandStep{{Kind: "gaming", Do: []string{"console-foot"}, City: "abidjan", Text: "Jouer un match de foot à la console avec Seydou"}}, Reward: 600},
			{Ask: "La finale contre Momo, c'est ce soir. Va prier pour moi, ou au moins pour ma manette.",
				Thanks: "J'ai défendu à gauche toute la partie… et j'ai gagné 2-1 ! Momo a jeté sa manette par terre.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour Seydou (et sa manette)"}}, Reward: 500},
			{Ask: "Momo est venu me serrer la main : il veut faire équipe avec moi pour le tournoi de Marcory. Viens fêter ça avec une sucrerie !",
				Thanks: "Le roi et le prince de la manette, ensemble ! Et maman dit que si mes notes baissent, la console part à la poubelle. Alors je révise aussi.",
				Steps:  []ErrandStep{{Kind: "boutique", Do: []string{"sucrerie"}, Text: "Fêter ça avec une sucrerie"}}, Reward: 700},
		}},
	{ID: "pretendant-accra", Title: "Le prétendant d'Accra", Giver: "Tantie Pélagie", Role: "Mère d'Aya", Gender: "femme", Effect: Needs{Social: 8, Fun: 4}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "Ma fille Aya veut épouser un Ghanéen, Kwame, qui arrive par le car d'Accra. Va l'attendre à la gare et dis-moi de quoi il a l'air !",
				Thanks: "Poli, bien habillé, et il t'a salué en nouchi avec un accent terrible ? Hmm. Au moins, il essaie.",
				Steps:  []ErrandStep{{Kind: "transport", Do: []string{"attendre-car"}, City: "abidjan", Text: "Attendre Kwame à la gare"}}, Reward: 600},
			{Ask: "Il dit qu'il apporte du kente pour la dot. Va au marché demander ce que vaut un vrai kente.",
				Thanks: "Un vrai kente, tissé à la main, c'est une fortune ! S'il en apporte un vrai, c'est qu'il est sérieux.",
				Steps:  []ErrandStep{{Kind: "market", Do: []string{"bargain"}, Text: "Demander le prix du kente au marché"}}, Reward: 600},
			{Ask: "Emmène-le manger un garba : un homme qui ne mange pas notre garba ne mérite pas ma fille.",
				Thanks: "Il en a repris deux fois et il a demandé la recette ! Il a même mangé le piment sans pleurer… presque.",
				Steps:  []ErrandStep{{Kind: "maquis", Do: []string{"eat-garba"}, Text: "Faire goûter le garba à Kwame"}}, Reward: 700},
			{Ask: "Il demande sa main dimanche. Va prier pour que tout se passe bien, mon cœur de maman est fragile.",
				Thanks: "J'ai dit oui ! Le mariage se fera à Abidjan et à Accra : deux fêtes, deux fois plus de garba. Tu es invité·e aux deux.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour la demande en mariage"}}, Reward: 700},
		}},
	{ID: "marathon-yao", Title: "Le marathon de Pépé Yao", Giver: "Pépé Yao", Role: "Ancien champion de course", Gender: "homme", Effect: Needs{Fun: 8, Social: 4}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "J'ai 72 ans et je veux courir le semi-marathon de Bouaké, comme en 1978. Mes enfants rient. Viens courir avec moi au stade.",
				Thanks: "Tu as vu ? Je t'ai dépassé dans le dernier virage ! Les jambes se souviennent.",
				Steps:  []ErrandStep{{Kind: "stade", Do: []string{"stade-footing"}, City: "abidjan", Text: "Courir au stade avec Pépé Yao"}}, Reward: 600},
			{Ask: "Mon docteur dit non, ma femme dit non. Va demander au pharmacien : lui dira peut-être oui.",
				Thanks: "« Seulement en marchant vite, et en s'arrêtant pour boire. » Marcher vite, je sais faire.",
				Steps:  []ErrandStep{{Kind: "pharmacie", Do: []string{"conseil-pharmacien"}, Text: "Demander conseil au pharmacien"}}, Reward: 500},
			{Ask: "C'est le jour de la course à Bouaké ! Accompagne-moi au stade de la Paix, et après, on fête ça à l'alloco du grand marché.",
				Thanks: "J'ai fini ! Dernier de ma catégorie… mais j'étais le seul de ma catégorie, donc premier ! Ils m'ont donné une médaille.",
				Steps: []ErrandStep{
					{Kind: "stade", Do: []string{"stade-footing"}, City: "bouake", Text: "Courir avec Pépé Yao au stade de Bouaké",
						Said: "Toute la tribune a applaudi le vieux qui marchait vite en saluant comme un champion. Il a faim, maintenant."},
					{Kind: "market", Do: []string{"eat-alloco"}, City: "bouake", Text: "Fêter ça à l'alloco du grand marché de Bouaké"},
				}, Reward: 2000},
			{Ask: "Viens, je fais le tour du quartier avec ma médaille. Il faut que tout le monde la voie.",
				Thanks: "Mes enfants ne rient plus : ils veulent courir avec moi l'année prochaine. Et ma femme a accroché la médaille au-dessus de la télé.",
				Steps:  []ErrandStep{{Kind: "rue", Do: []string{"flaner-rue"}, Text: "Faire le tour du quartier avec la médaille"}}, Reward: 700},
		}},
	{ID: "partir-rester", Title: "Partir ou rester", Giver: "Ange-Michel", Role: "Diplômé sans emploi", Gender: "homme", Effect: Needs{Social: 8}, Adults: true,
		Chapters: []StoryChapter{
			{Ask: "J'ai mon master, mais pas de travail. Un « passeur » me promet l'Europe pour deux millions. Avant de partir, lis les offres d'emploi avec moi, une dernière fois.",
				Thanks: "Rien pour moi… ou alors ce poste de technicien au port de San-Pédro ? Non. Je pars.",
				Steps:  []ErrandStep{{Kind: "office", Do: []string{"read-ads"}, City: "abidjan", Text: "Lire les offres d'emploi avec Ange-Michel"}}, Reward: 900},
			{Ask: "Mon cousin Hervé rentre d'Italie. Va l'accueillir à l'aéroport : il va me dire comment c'est, là-bas.",
				Thanks: "Hervé a traversé le désert, la mer, et dormi dans la rue à Milan pendant un an. Il rentre sans rien. Il a pleuré en me voyant.",
				Steps:  []ErrandStep{{Kind: "aeroport", Do: []string{"accueillir-arrivees"}, City: "abidjan", Text: "Accueillir le cousin Hervé à l'aéroport"}}, Reward: 600},
			{Ask: "J'ai la tête qui tourne. Va prier pour moi, que je prenne la bonne décision.",
				Thanks: "J'ai appelé pour le poste de San-Pédro : entretien la semaine prochaine. Le passeur garde l'avance de 200 000 F, mais moi, je garde ma vie.",
				Steps:  []ErrandStep{{Kind: "worship", Do: []string{"pray"}, Text: "Prier pour Ange-Michel"}}, Reward: 600},
			{Ask: "J'ai le poste au port de San-Pédro ! Viens me voir, on prend un café avec mes collègues.",
				Thanks: "Je gagne moins que ce que le passeur promettait, mais je dors chez moi. Et Hervé ? Il travaille avec moi au port, maintenant.",
				Steps:  []ErrandStep{{Kind: "office", Do: []string{"coffee-break"}, City: "san-pedro", Text: "Prendre un café au port de San-Pédro avec Ange-Michel"}}, Reward: 2000},
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

// StoryChoices: the stories a Sim may begin now, `n` at most: those not yet seen
// that it can do, the one each follows on from done. A sequel just unlocked
// comes first (the story it follows on from leads to it), then the list's order.
func StoryChoices(seen map[string]bool, stage string, kinds map[string]bool, n int) []Story {
	var sequels, others []Story
	for _, st := range Stories {
		if seen[st.ID] || st.After != "" && !seen[st.After] || !st.For(stage, kinds) {
			continue
		}
		if st.After != "" {
			sequels = append(sequels, st)
		} else {
			others = append(others, st)
		}
	}
	all := append(sequels, others...)
	return all[:min(n, len(all))]
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
