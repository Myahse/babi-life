package mail

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"strings"
)

// The e-mails' look: one layout (templates/layout.html), the game's colours,
// tables and inline styles because mail apps ignore the rest; each e-mail
// fills it with its words, and gets the same words as plain text.

//go:embed templates/*.html
var files embed.FS

var layout = template.Must(template.ParseFS(files, "templates/layout.html"))

// Page: what goes in the layout.
type Page struct {
	Site, Subject, Preheader, Title string
	Paragraphs                      []string
	Button, Link, Note              string
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
		Title:      "Un nouveau mot de passe",
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
