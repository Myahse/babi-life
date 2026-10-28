package game

// What's done at work, during a shift, a tap at a time (sims/jobs.go): the
// cashier scans and gives the change, the lawyer pleads, the DG signs. Each
// shows (the Sim's gesture in the room), counts once a shift towards the
// promotion, and in the jobs where customers tip, sometimes brings a little.

// A JobTask is one thing done at work.
type JobTask struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
	// Pose: the Sim's gesture while doing it (the client's avatar poses).
	Pose string `json:"pose"`
	// MinLevel: from this rung of the ladder (0: the first): the stagiaire doesn't sign the contracts.
	MinLevel int `json:"minLevel,omitempty"`
	// Tip: what a happy customer may leave at the first rung (more higher up); 0: no tips in this.
	Tip int `json:"tip,omitempty"`
	// Lines: how it went, one of them.
	Lines []string `json:"-"`
}

// TaskCooldown: game minutes before the same task can be done again (an hour of the shift).
const TaskCooldown = 60

// TaskOf: the career's task by its id, if the Sim's rung allows it.
func (c Career) TaskOf(id string, level int) (JobTask, bool) {
	for _, t := range c.Tasks {
		if t.ID == id && level >= t.MinLevel {
			return t, true
		}
	}
	return JobTask{}, false
}

// TaskTip: the tip at this rung (a quarter more each rung up), rounded to 50 FCFA.
func TaskTip(t JobTask, level int, roll float64) int {
	if t.Tip == 0 {
		return 0
	}
	v := float64(t.Tip) * (0.6 + 0.8*roll) * (1 + 0.25*float64(level))
	return int(v/50+0.5) * 50
}

var jobTasks = map[string][]JobTask{
	"bureau": {
		{ID: "mails", Label: "Répondre aux mails", Icon: "mail", Pose: "write", Lines: []string{"Boîte de réception vidée. Le chef est impressionné.", "Trente mails, trente réponses. Efficace.", "Tu réponds au client mécontent avec diplomatie : il se calme."}},
		{ID: "client", Label: "Appeler un client", Icon: "smartphone", Pose: "phone", Lines: []string{"Le client est content : il renouvelle sa commande.", "Une heure au téléphone, mais l'affaire est conclue.", "Tu rassures le client sur les délais. Il te remercie."}},
		{ID: "reunion", Label: "Animer une réunion", Icon: "presentation", Pose: "board", MinLevel: 2, Lines: []string{"Réunion bouclée en vingt minutes : un record.", "Ton équipe repart motivée.", "Tu présentes les chiffres du trimestre : applaudissements."}},
		{ID: "signer", Label: "Signer les gros contrats", Icon: "pen-line", Pose: "write", MinLevel: 3, Lines: []string{"Signé. Des millions de francs de chiffre d'affaires.", "Le partenaire serre la main du DG : affaire conclue.", "Tu signes le contrat de l'année. Champagne au bureau !"}},
	},
	"maquis": {
		{ID: "servir", Label: "Servir une table", Icon: "utensils", Pose: "serve", Tip: 300, Lines: []string{"Garba, alloco, bière bien glacée : la table est servie.", "Les clients en redemandent.", "Service rapide, sourire en plus."}},
		{ID: "garba", Label: "Préparer le garba", Icon: "chef-hat", Pose: "cook", Lines: []string{"Le thon est bien frit, l'attiéké bien chaud.", "L'odeur du garba attire tout le quartier.", "Une marmite entière partie en une heure."}},
		{ID: "addition", Label: "Encaisser l'addition", Icon: "receipt", Pose: "cash", Tip: 200, Lines: []string{"L'addition est réglée sans discuter.", "« Garde la monnaie ! »", "Le client paie avec Waye : rien de plus simple."}},
	},
	"commerce": {
		{ID: "heler", Label: "Héler les clients", Icon: "megaphone", Pose: "wave", Lines: []string{"« Ma chérie, viens voir ! C'est pas cher ! »", "Ta voix porte jusqu'au bout du marché.", "Trois clientes s'arrêtent à ta table."}},
		{ID: "marchander", Label: "Marchander avec une cliente", Icon: "hand-coins", Pose: "talk", Tip: 200, Lines: []string{"Après dix minutes de palabres, vous tombez d'accord.", "Elle voulait payer moitié prix : tu tiens bon, elle achète.", "Elle repart contente et reviendra."}},
		{ID: "etal", Label: "Ranger l'étal", Icon: "store", Pose: "shelve", Lines: []string{"Les tomates en pyramide, les piments à côté : ça donne envie.", "Ton étal est le plus beau de l'allée.", "Tout est rangé, prêt pour l'affluence."}},
	},
	"transport": {
		{ID: "crier", Label: "Crier la destination", Icon: "megaphone", Pose: "shout", Lines: []string{"« Adjamé ! Adjamé ! Adjamé ! » Le véhicule se remplit.", "Tu cries plus fort que l'apprenti d'en face : tu gagnes.", "Plein en cinq minutes."}},
		{ID: "encaisser", Label: "Encaisser les passagers", Icon: "coins", Pose: "cash", Tip: 100, Lines: []string{"Chacun paie sa place, la monnaie est rendue.", "Un passager arrondit au-dessus : merci !", "Les pièces s'entassent dans ta main."}},
		{ID: "plein", Label: "Faire le plein", Icon: "fuel", Pose: "pump", MinLevel: 1, Lines: []string{"Le réservoir est plein, on peut rouler.", "Tu négocies un bon prix avec le pompiste.", "Plein fait, pneus vérifiés."}},
	},
	"ambiance": {
		{ID: "son", Label: "Lancer le son du moment", Icon: "music", Pose: "dj", Lines: []string{"Le son du moment : la piste explose !", "Tout le monde chante le refrain.", "Les premières notes, et la piste se remplit."}},
		{ID: "foule", Label: "Faire crier la foule", Icon: "party-popper", Pose: "cheer", Lines: []string{"« Est-ce que vous êtes là ? » La foule hurle.", "Les mains en l'air, de la scène jusqu'au bar.", "L'ambiance est à son comble."}},
		{ID: "dedicace", Label: "Faire une dédicace", Icon: "megaphone", Pose: "mic", Tip: 1000, Lines: []string{"Tu cites le nom du grand patron : il lance des billets.", "Dédicace aux gens de Yopougon ! Ça crie.", "Le client voulait son nom au micro : il est servi."}},
	},
	"mairie": {
		{ID: "usager", Label: "Recevoir un usager", Icon: "users", Pose: "talk", Lines: []string{"Le dossier est complet : c'est réglé.", "Tu expliques patiemment les papiers à fournir.", "L'usager repart satisfait."}},
		{ID: "orienter", Label: "Orienter les visiteurs", Icon: "messages-square", Pose: "point", Lines: []string{"« L'état civil, c'est au premier étage, à gauche. »", "Une dame perdue trouve enfin le bon bureau.", "Tu calmes la file d'attente avec le sourire."}},
		{ID: "acte", Label: "Établir un acte de naissance", Icon: "stamp", Pose: "stamp", MinLevel: 1, Lines: []string{"Un nouveau petit Ivoirien inscrit à l'état civil.", "Tampon, signature : l'acte est prêt.", "Les parents émus repartent avec l'extrait."}},
		{ID: "mariage", Label: "Célébrer un mariage", Icon: "heart", Pose: "present", MinLevel: 2, Lines: []string{"« Je vous déclare unis par les liens du mariage ! »", "Les youyous résonnent dans la salle des mariages.", "Les mariés s'embrassent, la famille applaudit."}},
	},
	"enseignement": {
		{ID: "cours", Label: "Faire cours", Icon: "presentation", Pose: "board", Lines: []string{"Les élèves ont tout compris.", "Même le fond de la classe écoute.", "Belle leçon : les questions fusent."}},
		{ID: "copies", Label: "Corriger des copies", Icon: "notebook-pen", Pose: "write", Lines: []string{"Une pile de copies corrigées.", "Une copie à 19/20 : tu es fier·ère de ton élève.", "Le stylo rouge a beaucoup travaillé."}},
		{ID: "recre", Label: "Surveiller la récréation", Icon: "users", Pose: "whistle", Lines: []string{"Une bagarre évitée de justesse.", "Récré calme, tout le monde joue.", "Tu confisques un ballon envoyé sur le toit."}},
	},
	"coiffure": {
		{ID: "degrade", Label: "Faire un dégradé", Icon: "scissors", Pose: "cut", Tip: 500, Lines: []string{"Un dégradé net : le client se regarde sous tous les angles.", "Le contour est parfait.", "« Ça c'est propre ! »"}},
		{ID: "tresses", Label: "Tresser une cliente", Icon: "sparkles", Pose: "braid", Tip: 500, Lines: []string{"Des nattes impeccables.", "La cliente envoie une photo à toutes ses copines.", "Trois heures de travail, un résultat magnifique."}},
		{ID: "conseil", Label: "Conseiller une coupe", Icon: "messages-square", Pose: "talk", Lines: []string{"Tu proposes une coupe qui lui va à merveille.", "Elle hésitait, tu l'as convaincue.", "Le client repartira avec la coupe de son footballeur préféré."}},
	},
	"sante": {
		{ID: "tension", Label: "Prendre la tension", Icon: "heart-pulse", Pose: "stetho", Lines: []string{"Tension normale : le patient est rassuré.", "Un peu haute : tu donnes de bons conseils.", "Le patient suivant attend déjà."}},
		{ID: "piqure", Label: "Faire une piqûre", Icon: "syringe", Pose: "inject", Lines: []string{"Le petit n'a même pas pleuré.", "Rapide et sans douleur.", "Vaccin fait, carnet tamponné."}},
		{ID: "consulter", Label: "Consulter un patient", Icon: "stethoscope", Pose: "talk", MinLevel: 3, Lines: []string{"Le bon diagnostic, la bonne ordonnance.", "Le patient te remercie chaleureusement.", "Un cas difficile, mais tu as trouvé."}},
	},
	"caisse": {
		{ID: "encaisser", Label: "Encaisser un client", Icon: "scan-line", Pose: "scan", Lines: []string{"Bip, bip, bip : le chariot est passé.", "Le client paie par Waye.", "Une longue file, mais tu vas vite."}},
		{ID: "monnaie", Label: "Rendre la monnaie", Icon: "coins", Pose: "cash", Lines: []string{"La monnaie est juste, au franc près.", "Pas de petite monnaie ? Tu en trouves quand même.", "Le client vérifie : tout est bon."}},
		{ID: "cloture", Label: "Faire la clôture de caisse", Icon: "calculator", Pose: "write", MinLevel: 1, Lines: []string{"Caisse juste, pas un franc d'écart.", "Le compte est bon, le chef signe.", "Clôture faite en un temps record."}},
	},
	"vente": {
		{ID: "conseiller", Label: "Conseiller un client", Icon: "messages-square", Pose: "talk", Tip: 300, Lines: []string{"Tu trouves la tenue parfaite pour son mariage.", "Il voulait une chemise, il repart avec trois.", "Les bons conseils, ça fidélise."}},
		{ID: "essayage", Label: "Faire essayer une tenue", Icon: "shirt", Pose: "display", Lines: []string{"« Ça vous va très bien ! » Elle achète.", "La taille au-dessus, et c'est parfait.", "La cabine d'essayage ne désemplit pas."}},
		{ID: "rayons", Label: "Ranger les rayons", Icon: "shopping-bag", Pose: "shelve", Lines: []string{"Tout est plié, trié par taille.", "La nouvelle collection est en vitrine.", "La boutique est impeccable."}},
	},
	"hotellerie": {
		{ID: "accueil", Label: "Accueillir un client", Icon: "concierge-bell", Pose: "bow", Tip: 500, Lines: []string{"« Bienvenue ! Votre chambre est prête. »", "Un client exigeant, mais tu restes souriant·e.", "Le client te félicite pour l'accueil."}},
		{ID: "cles", Label: "Remettre les clés", Icon: "key-round", Pose: "hand", Lines: []string{"Chambre 214, vue sur la lagune.", "Les clés et le code du wifi, avec le sourire.", "Check-in fait en deux minutes."}},
		{ID: "bagages", Label: "Porter les bagages", Icon: "luggage", Pose: "carry", Tip: 1000, Lines: []string{"Trois valises jusqu'au cinquième : un pourboire bien mérité.", "Le client glisse un billet dans ta main.", "Les bagages sont montés en un instant."}},
	},
	"droit": {
		{ID: "client", Label: "Recevoir un client", Icon: "handshake", Pose: "talk", Lines: []string{"Le client te confie son affaire.", "Tu le rassures : le dossier est solide.", "Une heure de conseil, une affaire de plus au cabinet."}},
		{ID: "dossier", Label: "Préparer un dossier", Icon: "file-text", Pose: "write", Lines: []string{"Le dossier est prêt, solide comme un roc.", "Tu trouves la jurisprudence qui change tout.", "Des pages de notes, et l'argument décisif."}},
		{ID: "plaider", Label: "Plaider au tribunal", Icon: "gavel", Pose: "rant", MinLevel: 1, Lines: []string{"Ta plaidoirie fait sensation : affaire gagnée !", "Le juge hoche la tête : bon signe.", "« L'audience est levée. » Ton client te serre dans ses bras."}},
	},
	"pharmacie": {
		{ID: "ordonnance", Label: "Servir une ordonnance", Icon: "pill", Pose: "hand", Lines: []string{"Tous les médicaments sont là.", "Tu expliques bien la posologie.", "La patiente repart soulagée."}},
		{ID: "conseil", Label: "Conseiller un client", Icon: "messages-square", Pose: "talk", Lines: []string{"Pour ce rhume, tu as la bonne solution.", "Tu l'envoies consulter : c'est plus prudent.", "Le client te remercie pour tes conseils."}},
		{ID: "stock", Label: "Ranger les médicaments", Icon: "clipboard-list", Pose: "shelve", Lines: []string{"Les étagères sont en ordre, les dates vérifiées.", "La livraison est rangée.", "Rien ne manque pour la garde de ce soir."}},
	},
	"police": {
		{ID: "ronde", Label: "Faire une ronde", Icon: "footprints", Pose: "whistle", Lines: []string{"Le quartier est calme.", "Tu salues les commerçants, tout va bien.", "Un petit voleur a filé en te voyant."}},
		{ID: "controle", Label: "Contrôler un véhicule", Icon: "car", Pose: "direct", Lines: []string{"Papiers en règle : bonne route !", "Pas de ceinture : un rappel à l'ordre.", "Le chauffeur avait tout, tu le laisses passer."}},
		{ID: "plainte", Label: "Prendre une plainte", Icon: "notebook-pen", Pose: "write", Lines: []string{"La plainte est enregistrée, l'enquête commence.", "Tu écoutes la victime avec patience.", "Le procès-verbal est signé."}},
	},
	"aerien": {
		{ID: "enregistrer", Label: "Enregistrer des passagers", Icon: "luggage", Pose: "scan", Lines: []string{"Bagages pesés, cartes d'embarquement imprimées.", "Une valise trop lourde : on s'arrange.", "Le vol pour Bouaké est complet."}},
		{ID: "annonce", Label: "Annoncer un vol", Icon: "megaphone", Pose: "mic", Lines: []string{"« Les passagers du vol Air Lagune sont priés de se présenter porte 2. »", "Annonce faite en français et en anglais.", "Embarquement immédiat !"}},
		{ID: "porte", Label: "Guider vers la porte", Icon: "plane", Pose: "point", Lines: []string{"Tout le monde est à bord, à l'heure.", "Un passager perdu retrouve sa porte grâce à toi.", "L'avion décolle à l'heure."}},
	},
}

func init() {
	for i := range Careers {
		Careers[i].Tasks = jobTasks[Careers[i].ID]
	}
}
