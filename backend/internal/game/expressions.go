package game

// Local expressions: Nouchi (the street language born in Abidjan) and
// everyday Ivorian French. Meanings come from published glossaries; the
// example sentences are written for the game to show the usage. Meanings vary
// between neighbourhoods and generations, as the glossaries themselves say.
type Expression struct {
	ID      string `json:"id"`
	Text    string `json:"text"`
	Lang    string `json:"lang"` // "nouchi" | "français ivoirien"
	Meaning string `json:"meaning"`
	Example string `json:"example"`
	// Context: when it's used, and any variation worth knowing.
	Context string  `json:"context,omitempty"`
	Source  *Source `json:"source"`
}

var Expressions = []Expression{
	{ID: "enjailler", Text: "s'enjailler", Lang: "nouchi", Meaning: "S'amuser, faire la fête ; aimer beaucoup quelque chose.",
		Example: "Ce soir on part s'enjailler au maquis.", Context: "Vient de l'anglais « enjoy ». « Être enjaillé » d'une musique, c'est l'adorer.",
		Source: Verified("Même sens dans trois glossaires.", SrcNouchiGrin, SrcNouchiAnnuaire, SrcNouchiGV)},
	{ID: "gaou", Text: "gaou", Lang: "nouchi", Meaning: "Personne naïve, qui se fait avoir facilement.",
		Example: "Il a payé le double au marché, c'est un vrai gaou.",
		Source:  Verified("Même sens dans deux glossaires.", SrcNouchiGrin, SrcNouchiAfrik)},
	{ID: "gbe", Text: "gbê", Lang: "nouchi", Meaning: "La vérité, ce qui est vrai.",
		Example: "C'est le gbê que je te dis !",
		Source:  Partial("Un glossaire.", SrcNouchiGrin)},
	{ID: "kpakpato", Text: "kpakpato", Lang: "nouchi", Meaning: "Personne qui colporte les ragots.",
		Example: "Ne lui raconte rien, c'est une kpakpato.",
		Source:  Partial("Un glossaire.", SrcNouchiGrin)},
	{ID: "gbairai", Text: "gbairai", Lang: "nouchi", Meaning: "Les commérages, les ragots : parler de la vie des autres.",
		Example: "Au salon, c'est le gbairai du matin au soir.", Context: "Celui ou celle qui en vit, c'est le kpakpato. Tout le monde en fait, au salon, chez le barbier, au maquis ou au marché.",
		Source: Unverified("Sens donné par un joueur ivoirien ; aucun glossaire publié trouvé.")},
	{ID: "yako", Text: "yako", Lang: "nouchi", Meaning: "Mot de compassion, pour consoler quelqu'un.",
		Example: "Tu as perdu ton téléphone ? Yako, mon frère.",
		Source:  Partial("Un glossaire.", SrcNouchiGrin)},
	{ID: "deh", Text: "dêh", Lang: "nouchi", Meaning: "Petit mot qui appuie ce qu'on dit.",
		Example: "C'est bon dêh !",
		Source:  Partial("Un glossaire.", SrcNouchiAnnuaire)},
	{ID: "go", Text: "go", Lang: "nouchi", Meaning: "Jeune femme ; petite amie.",
		Example: "Il est venu avec sa go.",
		Source:  Partial("Un article de 2013.", SrcNouchiGV)},
	{ID: "dja", Text: "dja", Lang: "nouchi", Meaning: "Femme, fille.",
		Example: "Les djas du quartier sont au marché.",
		Source:  Partial("Un seul glossaire ; à confirmer.", SrcNouchiAnnuaire)},
	{ID: "brouteur", Text: "brouteur", Lang: "nouchi", Meaning: "Escroc qui arnaque ses victimes à distance par Internet.",
		Example: "Méfie-toi de ce message, c'est un brouteur.",
		Source:  Verified("Entrée de dictionnaire, origine ivoirienne indiquée.", SrcBrouteur)},
	{ID: "garba", Text: "garba", Lang: "français ivoirien", Meaning: "Plat d'attiéké et de thon frit.",
		Example: "Un garba avec piment, s'il te plaît.", Context: "Plat populaire et bon marché, servi partout.",
		Source: Partial("Un glossaire.", SrcNouchiAnnuaire)},
	{ID: "woro-woro", Text: "woro-woro", Lang: "français ivoirien", Meaning: "Taxi collectif qui fait des trajets dans une commune.",
		Example: "Je prends un woro-woro jusqu'au carrefour.",
		Source:  Partial("Un glossaire.", SrcNouchiAnnuaire)},
	{ID: "gbaka", Text: "gbaka", Lang: "français ivoirien", Meaning: "Minibus de transport en commun.",
		Example: "Le gbaka pour Adjamé est déjà plein.",
		Source:  Partial("Un glossaire.", SrcNouchiAnnuaire)},
	// Used in the game's texts but not confirmed by any source found: the
	// audit lists them until someone checks them.
	{ID: "ya-fohi", Text: "ya fohi", Lang: "nouchi", Meaning: "Il n'y a rien, tout va bien.",
		Example: "Ça va ? — Ya fohi !", Context: "Les sources divergent : « rien à signaler » ou « ce n'est pas gratuit ».",
		Source: Unverified("Sens contradictoires selon les sources.", SrcNouchiAnnuaire)},
	{ID: "gnambro", Text: "gnambro", Lang: "nouchi", Meaning: "Homme qui fait payer les passagers et les chauffeurs aux gares.",
		Example: "Le gnambro réclame 100 F de plus.",
		Source:  Unverified("Utilisé dans le jeu ; aucune source trouvée.")},
	{ID: "travaillement", Text: "travaillement", Lang: "nouchi", Meaning: "Faire pleuvoir des billets sur un artiste ou des danseurs pour montrer sa générosité.",
		Example: "Le grand-frère fait le travaillement sur la piste.", Context: "Lié au coupé-décalé.",
		Source: Unverified("Utilisé dans le jeu ; aucune source trouvée.")},
}
