package mail

// Welcome: the e-mail a new account gets once, the first time (auth/welcome.go); lang "en": in English.
// community: the players' WhatsApp group (empty: not mentioned).
func Welcome(site, lang, to, firstName, community string) (Message, error) {
	en := lang == "en"
	p := Page{Site: site, Lang: lang, Link: site, Unsubscribe: ""}
	if en {
		p.Subject = "Welcome to Babi Life!"
		p.Preheader = "Your life in Abidjan starts now: your family, the city, your first steps."
		p.Title = "Welcome to Babi!"
		p.Tagline = "Welcome"
		p.Paragraphs = []string{
			hello(true, firstName),
			"Your account is ready. In Babi Life, your family is drawn at birth, then you live Côte d'Ivoire on the real map, on Abidjan time: work, maquis, taxis, street weddings, real news.",
			"To start well: follow Koffi, he shows you the first steps. Then choose where to go, meet people, find a job, play football at the corner or a match of dames at the grin.",
		}
		if community != "" {
			p.Paragraphs = append(p.Paragraphs, "Join the players on WhatsApp to share your stories and your ideas: "+community)
		}
		p.Button = "Play now"
		p.Note = "You received this e-mail because you just created a Babi Life account."
	} else {
		p.Subject = "Bienvenue dans Babi Life !"
		p.Preheader = "Ta vie à Abidjan commence : ta famille, la ville, tes premiers pas."
		p.Title = "Bienvenue à Babi !"
		p.Tagline = "Bienvenue"
		p.Paragraphs = []string{
			hello(false, firstName),
			"Ton compte est prêt. Dans Babi Life, ta famille est tirée au sort à ta naissance, puis tu vis la Côte d'Ivoire sur la vraie carte, à l'heure d'Abidjan : boulot, maquis, taxi, mariages dans la rue, vraie actu.",
			"Pour bien commencer : suis Koffi, il te montre tes premiers pas. Ensuite, choisis où aller, fais des rencontres, trouve un boulot, joue au foot au coin de la rue ou aux dames au grin.",
		}
		if community != "" {
			p.Paragraphs = append(p.Paragraphs, "Rejoins les joueurs sur WhatsApp pour partager tes histoires et tes idées : "+community)
		}
		p.Button = "Jouer maintenant"
		p.Note = "Tu reçois cet e-mail parce que tu viens de créer ton compte Babi Life."
	}
	h, t, err := p.Render()
	if err != nil {
		return Message{}, err
	}
	return Message{To: to, Name: firstName, Subject: p.Subject, Text: t, HTML: h, Tag: "bienvenue"}, nil
}
