package mail

import (
	"fmt"
	"strings"
)

// The news e-mails the team sends from /admin (« E-mails »): each a ready
// model, its words changeable before sending, in the same look as the
// password e-mail. {prénom} becomes each person's first name (dropped with
// its space when there's none); a link starting with / goes to the site.
// They're for people who asked to hear from Babi Life (the wish list, the
// players), never ads, and each has its « ne plus recevoir » link.

// Template: one model, as /admin shows and fills it.
type Template struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// Use: when to send it, in a few words.
	Use       string `json:"use"`
	Subject   string `json:"subject"`
	Preheader string `json:"preheader"`
	Tagline   string `json:"tagline"`
	Title     string `json:"title"`
	// Text: the paragraphs, a blank line between two.
	Text   string `json:"text"`
	Button string `json:"button,omitempty"`
	Link   string `json:"link,omitempty"`
	Note   string `json:"note,omitempty"`
	// System: sent by the game itself (the password one): shown, never sent from /admin.
	System bool `json:"system,omitempty"`
	// Media, added from /admin: a picture under the text (Image, its words for
	// those who don't see it in ImageAlt), and a video: mail apps don't play
	// them, so its poster (Poster, the play button drawn on it) links to its
	// page on the site (Video: /regarder/<id>, web screens/Watch.tsx).
	Image    string `json:"image,omitempty"`
	ImageAlt string `json:"imageAlt,omitempty"`
	Video    string `json:"video,omitempty"`
	Poster   string `json:"poster,omitempty"`
}

var Templates = []Template{
	{
		ID: "sortie", Label: "C'est ouvert !", Use: "Le jour de la sortie : à toute la liste d'attente et aux joueurs.",
		Subject: "Babi Life est ouvert : ta vie t'attend", Preheader: "Le jeu est là. Ton perso naît bébé, à Abidjan, dans une famille tirée au sort.",
		Tagline: "C'est le jour", Title: "C'est ouvert !",
		Text:   "Bonjour {prénom},\n\nOn te l'avait promis : Babi Life est ouvert. Ta vie à Abidjan, dans ton téléphone, à l'heure d'Abidjan.\n\nTon perso naît bébé, dans une famille tirée au sort : gnambro, coulé, poignon, lagnon, laté ou debout. L'école, les copains, le premier boulot, ta maison… Le reste, c'est toi qui l'écris.",
		Button: "Jouer maintenant", Link: "/jeu",
		Note: "C'est gratuit, du début à la fin. Rien à installer : ça marche dans le navigateur de ton téléphone.",
	},
	{
		ID: "infos", Label: "Les nouvelles", Use: "Des nouvelles du jeu, quand il y a quelque chose à dire.",
		Subject: "Les nouvelles de Babi Life", Preheader: "Ce qui se passe à Babi en ce moment.",
		Tagline: "Les nouvelles", Title: "Quoi de neuf à Babi ?",
		Text:   "Bonjour {prénom},\n\nVoici ce qui a bougé à Babi ces derniers jours.\n\n(Écris ici les nouvelles : un nouveau lieu, une fête, un tournoi…)",
		Button: "Aller voir", Link: "/jeu",
	},
	{
		ID: "nouveaute", Label: "Une nouveauté", Use: "Une mise à jour qui vient d'ouvrir dans le jeu.",
		Subject: "Nouveau dans Babi Life", Preheader: "Une nouveauté vient d'arriver dans le jeu.",
		Tagline: "Nouveau", Title: "Nouveau à Babi",
		Text:   "Bonjour {prénom},\n\n(Le nom de la nouveauté, et en deux phrases ce qu'on peut faire avec.)\n\nOuvre le jeu pour l'essayer : elle t'attend.",
		Button: "Essayer", Link: "/jeu",
	},
	{
		ID: "beta", Label: "Invitation à tester", Use: "Aux inscrits qui veulent tester avant tout le monde.",
		Subject: "Teste Babi Life avant tout le monde", Preheader: "Tu as dit que tu voulais tester : c'est le moment.",
		Tagline: "Testeur", Title: "Tu testes avant tout le monde",
		Text:   "Bonjour {prénom},\n\nSur la liste d'attente, tu as dit que tu voulais tester Babi Life avant sa sortie. C'est le moment.\n\nJoue, casse tout, et dis-nous ce qui ne va pas avec l'appli « Idées » de ton téléphone dans le jeu.",
		Button: "Commencer à tester", Link: "/testeur",
		Note: "Le code testeur, on te l'envoie à part. Ne le partage pas.",
	},
	{
		ID: "rappel", Label: "Ton perso t'attend", Use: "À ceux qui n'ont pas joué depuis un moment.",
		Subject: "{prénom}, ton perso t'attend à Babi", Preheader: "Il n'a pas bougé depuis ton départ : le temps l'attend.",
		Tagline: "Reviens", Title: "On t'attend !",
		Text:   "Bonjour {prénom},\n\nTon perso est resté là où tu l'as laissé : à Babi, le temps l'attend quand tu n'es pas là.\n\nTes amis, ton boulot, ta maison… Viens voir ce qui a changé dans ton quartier.",
		Button: "Revenir à Babi", Link: "/jeu",
	},
	{
		ID: "evenement", Label: "Un événement", Use: "Une fête, un concert, un tournoi à une date précise.",
		Subject: "Ce week-end à Babi : (l'événement)", Preheader: "Un rendez-vous à ne pas manquer dans le jeu.",
		Tagline: "Rendez-vous", Title: "Rendez-vous à Babi",
		Text:   "Bonjour {prénom},\n\n(Quoi, où et quand : le concert au Stade FHB samedi à 16 h, le tournoi de dames au grin…)\n\nViens avec tes amis : on y sera.",
		Button: "J'y vais", Link: "/jeu",
	},
	{
		ID: "compte", Label: "Ton compte (identifiants)", Use: "Envoyé par le jeu (« Identifiants oubliés ? ») ou par l'équipe depuis Joueurs : comment la personne se connecte, et un lien pour un mot de passe.",
		Subject: "Babi Life : comment te connecter", Preheader: "Ton adresse, ton pseudo, et comment entrer dans Babi Life.",
		Tagline: "Ton compte", Title: "Ton compte",
		Text:   "Bonjour {prénom},\n\nTu ne sais plus comment tu te connectes à Babi Life ? Voici ton compte.\n\nTon adresse e-mail : awa@example.com. Ton pseudo : awa225.\n\nTu t'es inscrit·e avec Google : sur l'écran de connexion, touche « Continuer avec Google » et choisis le compte Google awa@example.com.\n\nTu préfères un mot de passe ? Le bouton t'en fait choisir un : ensuite tu pourras aussi entrer avec ton e-mail ou ton pseudo, sans Google.\n\nLe lien marche une seule fois, pendant 30 minutes.",
		Button: "Choisir mon mot de passe", Link: "/mot-de-passe",
		Note:   "Tu n'as rien demandé ? Ignore cet e-mail : rien ne change, et personne ne peut entrer sans ce lien.",
		System: true,
	},
}

// FindTemplate: the model of that id.
func FindTemplate(id string) (Template, bool) {
	for _, t := range Templates {
		if t.ID == id {
			return t, true
		}
	}
	return Template{}, false
}

// Named: {prénom} filled in, or dropped with its space (« Bonjour {prénom}, » → « Bonjour, »).
func Named(s, first string) string {
	if first == "" {
		return strings.NewReplacer(" {prénom}", "", "{prénom} ", "", "{prénom}", "").Replace(s)
	}
	return strings.ReplaceAll(s, "{prénom}", first)
}

// News: the e-mail of a model (its words as given) for one person; unsubscribe: their own « ne plus recevoir » link.
func News(site string, t Template, to, firstName, unsubscribe string) (Message, error) {
	link := t.Link
	if strings.HasPrefix(link, "/") {
		link = strings.TrimRight(site, "/") + link
	}
	var paras []string
	for _, p := range strings.Split(strings.ReplaceAll(t.Text, "\r\n", "\n"), "\n\n") {
		if p = strings.TrimSpace(Named(p, firstName)); p != "" {
			paras = append(paras, p)
		}
	}
	if t.Title == "" || len(paras) == 0 {
		return Message{}, fmt.Errorf("il faut un titre et un texte")
	}
	p := Page{
		Site: site, Subject: Named(t.Subject, firstName), Preheader: Named(t.Preheader, firstName), Title: Named(t.Title, firstName), Tagline: t.Tagline,
		Paragraphs: paras, Button: t.Button, Note: Named(t.Note, firstName),
		Footer:      "Tu reçois cet e-mail parce que tu t'es inscrit·e pour avoir des nouvelles de Babi Life.",
		Unsubscribe: unsubscribe,
	}
	if t.Button != "" && link != "" {
		p.Link = link
	} else {
		p.Button = ""
	}
	if strings.HasPrefix(t.Image, "https://") {
		p.Image, p.ImageAlt = t.Image, Named(t.ImageAlt, firstName)
	}
	if strings.HasPrefix(t.Video, "/") && strings.HasPrefix(t.Poster, "https://") {
		p.VideoLink, p.Poster = strings.TrimRight(site, "/")+t.Video, t.Poster
		if p.ImageAlt == "" {
			p.ImageAlt = "La vidéo"
		}
	}
	h, txt, err := p.Render()
	if err != nil {
		return Message{}, err
	}
	return Message{To: to, Name: firstName, Subject: p.Subject, Text: txt, HTML: h, Tag: "nouvelles-" + t.ID, Unsubscribe: unsubscribe}, nil
}
