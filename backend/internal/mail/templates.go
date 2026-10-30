package mail

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"strings"
)

// The e-mails' look: one layout (templates/layout.html), painted like the wish list,
// tables and inline styles because mail apps ignore the rest; each e-mail
// fills it with its words, and gets the same words as plain text.

//go:embed templates/*.html
var files embed.FS

var layout = template.Must(template.ParseFS(files, "templates/layout.html"))

// Page: what goes in the layout.
type Page struct {
	Site, Subject, Preheader, Title string
	// Lang: the layout's own words in English for "en" (a player who plays in English), else French.
	Lang string
	// Tagline: the words on the right of the sign (« Ton compte »).
	Tagline            string
	Paragraphs         []string
	Button, Link, Note string
	// Footer: why the person gets it (an account's e-mail by default); Unsubscribe: the news e-mails' way out.
	Footer, Unsubscribe string
	// Image: a hosted picture (absolute URL) under the text, ImageAlt its words.
	// VideoLink: a video's page on the site, shown as its Poster (a picture) with a play button.
	Image, ImageAlt, VideoLink, Poster string
}

// Render: the HTML and the plain text of a page.
func (p Page) Render() (htmlBody, text string, err error) {
	var b bytes.Buffer
	if err := layout.Execute(&b, p); err != nil {
		return "", "", err
	}
	var t strings.Builder
	t.WriteString(p.Title + "\n\n")
	for _, s := range p.Paragraphs {
		t.WriteString(s + "\n\n")
	}
	en := p.Lang == "en"
	if p.VideoLink != "" {
		fmt.Fprintf(&t, pick(en, "Watch the video:\n%s\n\n", "Regarder la vidéo :\n%s\n\n"), p.VideoLink)
	}
	if p.Link != "" {
		fmt.Fprintf(&t, pick(en, "%s:\n%s\n\n", "%s :\n%s\n\n"), p.Button, p.Link)
	}
	if p.Note != "" {
		t.WriteString(p.Note + "\n\n")
	}
	t.WriteString(pick(en, "See you soon in Babi!\n", "À tout de suite dans Babi !\n") + p.Site + "\n")
	if p.Unsubscribe != "" {
		t.WriteString(pick(en, "\nStop getting these e-mails: ", "\nNe plus recevoir ces e-mails : ") + p.Unsubscribe + "\n")
	}
	return b.String(), t.String(), nil
}

// pick: the English or the French.
func pick(en bool, english, french string) string {
	if en {
		return english
	}
	return french
}

// hello: « Bonjour Awa, » (« Hi Awa, » in English).
func hello(en bool, firstName string) string {
	switch {
	case en && firstName != "":
		return "Hi " + firstName + ","
	case en:
		return "Hi,"
	case firstName != "":
		return "Bonjour " + firstName + ","
	}
	return "Bonjour,"
}

// Reset: the « mot de passe oublié » e-mail, its link good for minutes; lang "en": in English.
func Reset(site, lang, to, firstName, link string, minutes int) (Message, error) {
	if lang == "en" {
		return resetEN(site, to, firstName, link, minutes)
	}
	p := Page{
		Site:       site,
		Subject:    "Babi Life : ton nouveau mot de passe",
		Preheader:  fmt.Sprintf("Ton lien pour choisir un nouveau mot de passe (valable %d minutes).", minutes),
		Title:      "Nouveau mot de passe",
		Tagline:    "Ton compte",
		Paragraphs: []string{hello(false, firstName), "Quelqu'un (toi, on espère) a demandé un nouveau mot de passe pour ton compte Babi Life.", fmt.Sprintf("Touche le bouton pour en choisir un. Le lien marche une seule fois, pendant %d minutes.", minutes)},
		Button:     "Choisir mon mot de passe",
		Link:       link,
		Note:       "Ce n'était pas toi ? Ignore cet e-mail : ton mot de passe ne change pas, et personne ne peut entrer sans ce lien.",
	}
	h, t, err := p.Render()
	if err != nil {
		return Message{}, err
	}
	return Message{To: to, Name: firstName, Subject: p.Subject, Text: t, HTML: h, Tag: "mot-de-passe"}, nil
}

func resetEN(site, to, firstName, link string, minutes int) (Message, error) {
	p := Page{
		Site:       site,
		Lang:       "en",
		Subject:    "Babi Life: your new password",
		Preheader:  fmt.Sprintf("Your link to choose a new password (good for %d minutes).", minutes),
		Title:      "New password",
		Tagline:    "Your account",
		Paragraphs: []string{hello(true, firstName), "Someone (you, we hope) asked for a new password for your Babi Life account.", fmt.Sprintf("Tap the button to choose one. The link works only once, for %d minutes.", minutes)},
		Button:     "Choose my password",
		Link:       link,
		Note:       "Wasn't you? Ignore this e-mail: your password doesn't change, and nobody can get in without this link.",
	}
	h, t, err := p.Render()
	if err != nil {
		return Message{}, err
	}
	return Message{To: to, Name: firstName, Subject: p.Subject, Text: t, HTML: h, Tag: "mot-de-passe"}, nil
}

// Account: « comment te connecter », for someone who no longer knows: the
// address and the pseudo of their account, whether it's Google or a
// password (or both), and a link to choose a (new) password, good for
// minutes; lang "en": in English (the player plays in English).
func Account(site, lang, to, firstName, username string, google, password bool, link string, minutes int) (Message, error) {
	if lang == "en" {
		return accountEN(site, to, firstName, username, google, password, link, minutes)
	}
	paras := []string{hello(false, firstName), "Tu ne sais plus comment tu te connectes à Babi Life ? Voici ton compte."}
	id := "Ton adresse e-mail : " + to + "."
	if username != "" {
		id += " Ton pseudo : " + username + "."
	}
	paras = append(paras, id)
	switch {
	case google && password:
		paras = append(paras, "Tu peux entrer de deux façons : avec « Continuer avec Google » (le compte Google "+to+"), ou avec ton e-mail (ou ton pseudo) et ton mot de passe.")
	case google:
		paras = append(paras, "Tu t'es inscrit·e avec Google : sur l'écran de connexion, touche « Continuer avec Google » et choisis le compte Google "+to+".", "Tu préfères un mot de passe ? Le bouton t'en fait choisir un : ensuite tu pourras aussi entrer avec ton e-mail ou ton pseudo, sans Google.")
	default:
		paras = append(paras, "Tu entres avec ton e-mail (ou ton pseudo) et ton mot de passe. Tu l'as oublié ? Le bouton t'en fait choisir un nouveau.")
	}
	paras = append(paras, fmt.Sprintf("Le lien marche une seule fois, pendant %d minutes.", minutes))
	p := Page{
		Site:       site,
		Subject:    "Babi Life : comment te connecter",
		Preheader:  "Ton adresse, ton pseudo, et comment entrer dans Babi Life.",
		Title:      "Ton compte",
		Tagline:    "Ton compte",
		Paragraphs: paras,
		Button:     "Choisir mon mot de passe",
		Link:       link,
		Note:       "Tu n'as rien demandé ? Ignore cet e-mail : rien ne change, et personne ne peut entrer sans ce lien.",
	}
	h, t, err := p.Render()
	if err != nil {
		return Message{}, err
	}
	return Message{To: to, Name: firstName, Subject: p.Subject, Text: t, HTML: h, Tag: "compte"}, nil
}

// accountEN: the same e-mail, in English.
func accountEN(site, to, firstName, username string, google, password bool, link string, minutes int) (Message, error) {
	paras := []string{hello(true, firstName), "Can't remember how you sign in to Babi Life? Here's your account."}
	id := "Your e-mail address: " + to + "."
	if username != "" {
		id += " Your username: " + username + "."
	}
	paras = append(paras, id)
	switch {
	case google && password:
		paras = append(paras, "You can get in two ways: with « Continue with Google » (the Google account "+to+"), or with your e-mail (or your username) and your password.")
	case google:
		paras = append(paras, "You signed up with Google: on the sign-in screen, tap « Continue with Google » and choose the Google account "+to+".", "Prefer a password? The button lets you choose one: then you can also get in with your e-mail or your username, without Google.")
	default:
		paras = append(paras, "You sign in with your e-mail (or your username) and your password. Forgot it? The button lets you choose a new one.")
	}
	paras = append(paras, fmt.Sprintf("The link works only once, for %d minutes.", minutes))
	p := Page{
		Site:       site,
		Lang:       "en",
		Subject:    "Babi Life: how to sign in",
		Preheader:  "Your address, your username, and how to get into Babi Life.",
		Title:      "Your account",
		Tagline:    "Your account",
		Paragraphs: paras,
		Button:     "Choose my password",
		Link:       link,
		Note:       "Didn't ask for anything? Ignore this e-mail: nothing changes, and nobody can get in without this link.",
	}
	h, t, err := p.Render()
	if err != nil {
		return Message{}, err
	}
	return Message{To: to, Name: firstName, Subject: p.Subject, Text: t, HTML: h, Tag: "compte"}, nil
}
