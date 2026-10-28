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
	// Tagline: the words on the right of the sign (« Ton compte »).
	Tagline            string
	Paragraphs         []string
	Button, Link, Note string
	// Footer: why the person gets it (an account's e-mail by default); Unsubscribe: the news e-mails' way out.
	Footer, Unsubscribe string
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
	if p.Link != "" {
		fmt.Fprintf(&t, "%s :\n%s\n\n", p.Button, p.Link)
	}
	if p.Note != "" {
		t.WriteString(p.Note + "\n\n")
	}
	t.WriteString("À tout de suite dans Babi !\n" + p.Site + "\n")
	if p.Unsubscribe != "" {
		t.WriteString("\nNe plus recevoir ces e-mails : " + p.Unsubscribe + "\n")
	}
	return b.String(), t.String(), nil
}

// Reset: the « mot de passe oublié » e-mail, its link good for minutes.
func Reset(site, to, firstName, link string, minutes int) (Message, error) {
	hello := "Bonjour,"
	if firstName != "" {
		hello = "Bonjour " + firstName + ","
	}
	p := Page{
		Site:       site,
		Subject:    "Babi Life : ton nouveau mot de passe",
		Preheader:  fmt.Sprintf("Ton lien pour choisir un nouveau mot de passe (valable %d minutes).", minutes),
		Title:      "Nouveau mot de passe",
		Tagline:    "Ton compte",
		Paragraphs: []string{hello, "Quelqu'un (toi, on espère) a demandé un nouveau mot de passe pour ton compte Babi Life.", fmt.Sprintf("Touche le bouton pour en choisir un. Le lien marche une seule fois, pendant %d minutes.", minutes)},
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

// Account: « comment te connecter », for someone who no longer knows: the
// address and the pseudo of their account, whether it's Google or a
// password (or both), and a link to choose a (new) password, good for minutes.
func Account(site, to, firstName, username string, google, password bool, link string, minutes int) (Message, error) {
	hello := "Bonjour,"
	if firstName != "" {
		hello = "Bonjour " + firstName + ","
	}
	paras := []string{hello, "Tu ne sais plus comment tu te connectes à Babi Life ? Voici ton compte."}
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
