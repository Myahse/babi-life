package world

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/myahse/babi-life/backend/internal/game"
)

// The "Look to fix" list: everything in the world data that is missing,
// unverified, inconsistent or broken. Errors break the game and fail the
// tests; warnings are work still to do (mostly facts to verify).

type Issue struct {
	Severity string `json:"severity"` // "error" | "warning"
	Code     string `json:"code"`
	Ref      string `json:"ref"` // what it is about: "place:cocody-chu", "happening:femua"…
	Message  string `json:"message"`
}

const (
	SevError   = "error"
	SevWarning = "warning"
)

// Issue codes, grouped as the audit reports them.
const (
	CodeMissingField   = "missing-field"
	CodeDuplicateID    = "duplicate-id"
	CodeDuplicatePlace = "duplicate-place"
	CodeBadReference   = "bad-reference"
	CodeGeography      = "geography"
	CodeMairie         = "mairie"
	CodeUnverified     = "unverified"
	CodeApproxPosition = "approx-position"
	CodeInconsistent   = "inconsistent"
	CodeIncompleteEvt  = "incomplete-event"
	CodeUndeclaredDate = "undeclared-date"
	CodeUnpopulated    = "unpopulated"
	CodeCapacity       = "capacity"
)

// Country bounds, and how far a place may sit from its commune's centre.
var countryBounds = [4]float64{-8.7, 4.3, -2.4, 10.8} // west, south, east, north

const (
	maxPlaceKmAbidjan = 7.0
	maxPlaceKm        = 12.0
	maxCommuneKm      = 40.0
	// The 3D quartier has 12 lots for places, one of them the Sim's home.
	maxPlacesShown = 11
	// Places closer than this are probably the same place twice.
	minPlaceGapKm = 0.05
)

// Reserved place IDs used by the API.
var reservedIDs = map[string]bool{"home": true, "happening": true}

// Audit checks the world data and the game catalogue that refers to it.
func Audit() []Issue {
	a := &auditor{}
	a.world()
	a.kinds()
	a.careers()
	a.happenings()
	a.holidays(time.Now().Year())
	a.trips()
	a.expressions()
	a.rides()
	sort.SliceStable(a.issues, func(i, j int) bool {
		if a.issues[i].Severity != a.issues[j].Severity {
			return a.issues[i].Severity == SevError
		}
		return a.issues[i].Code < a.issues[j].Code
	})
	return a.issues
}

type auditor struct{ issues []Issue }

func (a *auditor) add(sev, code, ref, format string, args ...any) {
	a.issues = append(a.issues, Issue{Severity: sev, Code: code, Ref: ref, Message: fmt.Sprintf(format, args...)})
}

func (a *auditor) source(ref string, s *game.Source, real bool) {
	switch {
	case s == nil:
		a.add(SevError, CodeMissingField, ref, "pas de provenance (source)")
	case real && s.Status == game.StatusFictional:
		a.add(SevError, CodeInconsistent, ref, "marqué réel mais sa source dit « fictif »")
	case !real && s.Status != game.StatusFictional && strings.HasPrefix(ref, "place:"):
		// An invented place must say so; a real-sounding unchecked one is "unverified".
		if s.Status == game.StatusVerified {
			a.add(SevError, CodeInconsistent, ref, "source vérifiée mais le lieu n'est pas marqué réel")
		}
	case s.Status == game.StatusUnverified:
		a.add(SevWarning, CodeUnverified, ref, "à vérifier : %s", orDash(s.Note))
	case s.Status == game.StatusPartial && len(s.URLs) == 0:
		a.add(SevWarning, CodeUnverified, ref, "vérification partielle sans lien vers la source")
	case s.Status == game.StatusVerified && len(s.URLs) == 0:
		a.add(SevError, CodeMissingField, ref, "marqué vérifié sans lien vers la source")
	}
	if s != nil && s.Status != game.StatusFictional && s.Checked == "" && len(s.URLs) > 0 {
		a.add(SevWarning, CodeMissingField, ref, "pas de date de vérification")
	}
}

func orDash(s string) string {
	if s == "" {
		return "—"
	}
	return s
}

func (a *auditor) world() {
	cityIDs, communeIDs, placeIDs := map[string]bool{}, map[string]bool{}, map[string]string{}
	for _, c := range Cities {
		cref := "city:" + c.ID
		if c.ID == "" || c.Name == "" || c.Blurb == "" {
			a.add(SevError, CodeMissingField, cref, "identifiant, nom ou description manquant")
		}
		if cityIDs[c.ID] {
			a.add(SevError, CodeDuplicateID, cref, "ville en double")
		}
		cityIDs[c.ID] = true
		if c.Admin.Type == "" {
			a.add(SevError, CodeMissingField, cref, "statut administratif manquant")
		}
		a.source(cref, c.Admin.Source, true)
		a.point(cref, c.Lat, c.Lng)
		if len(c.Communes) == 0 {
			a.add(SevError, CodeUnpopulated, cref, "ville sans commune")
		}
		for _, cm := range c.Communes {
			mref := "commune:" + cm.ID
			if cm.ID == "" || cm.Name == "" || cm.Blurb == "" {
				a.add(SevError, CodeMissingField, mref, "identifiant, nom ou description manquant")
			}
			if communeIDs[cm.ID] {
				a.add(SevError, CodeDuplicateID, mref, "commune en double (les identifiants doivent être uniques dans tout le pays)")
			}
			communeIDs[cm.ID] = true
			a.point(mref, cm.Lat, cm.Lng)
			if d := distanceKm(c.Lat, c.Lng, cm.Lat, cm.Lng); d > maxCommuneKm {
				a.add(SevError, CodeGeography, mref, "à %.0f km du centre de %s", d, c.Name)
			}
			if cm.Admin.Type == "" || cm.Admin.Parent == "" {
				a.add(SevError, CodeMissingField, mref, "type ou rattachement administratif manquant")
			}
			a.source(mref, cm.Admin.Source, true)
			if c.ID == "abidjan" && cm.Admin.Bank != "nord" && cm.Admin.Bank != "sud" {
				a.add(SevError, CodeMissingField, mref, "rive de la lagune manquante (nord/sud) : les incidents de pont en dépendent")
			}
			a.mairie(cm)
			if len(cm.Places) > maxPlacesShown {
				a.add(SevWarning, CodeCapacity, mref, "%d lieux : le quartier 3D n'en montre que %d", len(cm.Places), maxPlacesShown)
			}
			names := map[string]string{}
			for i, p := range cm.Places {
				pref := "place:" + p.ID
				if p.ID == "" || p.Name == "" || p.Kind == "" {
					a.add(SevError, CodeMissingField, pref, "identifiant, nom ou type manquant")
				}
				if reservedIDs[p.ID] {
					a.add(SevError, CodeBadReference, pref, "identifiant réservé par l'API")
				}
				if prev, ok := placeIDs[p.ID]; ok {
					a.add(SevError, CodeDuplicateID, pref, "même identifiant qu'un lieu de %s", prev)
				}
				placeIDs[p.ID] = cm.ID
				if _, ok := game.Kinds[p.Kind]; !ok {
					a.add(SevError, CodeBadReference, pref, "type de lieu inconnu %q", p.Kind)
				}
				a.point(pref, p.Lat, p.Lng)
				limit := maxPlaceKm
				if c.ID == "abidjan" {
					limit = maxPlaceKmAbidjan
				}
				if d := distanceKm(cm.Lat, cm.Lng, p.Lat, p.Lng); d > limit {
					a.add(SevWarning, CodeGeography, pref, "à %.1f km du centre de %s : vérifier la commune", d, cm.Name)
				}
				key := fold(p.Name) + "|" + p.Kind
				if prev, ok := names[key]; ok {
					a.add(SevError, CodeDuplicatePlace, pref, "même nom et même type que %s", prev)
				}
				names[key] = p.ID
				for _, q := range cm.Places[:i] {
					if distanceKm(p.Lat, p.Lng, q.Lat, q.Lng) < minPlaceGapKm {
						a.add(SevWarning, CodeDuplicatePlace, pref, "au même endroit que %s", q.ID)
					}
				}
				a.source(pref, p.Source, p.Real)
				if p.Real && p.Approx && p.Kind != "mairie" {
					a.add(SevWarning, CodeApproxPosition, pref, "position approximative : relever les coordonnées")
				}
				if p.Kind == "mairie" && p.Approx {
					a.add(SevWarning, CodeApproxPosition, pref, "position de la mairie à relever (adresse officielle)")
				}
				if p.Closed != "" {
					a.add(SevWarning, CodeInconsistent, pref, "lieu réel fermé depuis %s mais encore actif dans le jeu", p.Closed)
				}
				if p.Real && (p.Kind == "health" || p.Kind == "school" || p.Kind == "mairie") && p.Operator == "" {
					a.add(SevWarning, CodeMissingField, pref, "service public sans gestionnaire indiqué")
				}
			}
		}
	}
}

func (a *auditor) point(ref string, lat, lng float64) {
	if lat == 0 && lng == 0 {
		a.add(SevError, CodeMissingField, ref, "coordonnées manquantes")
		return
	}
	b := countryBounds
	if lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3] {
		a.add(SevError, CodeGeography, ref, "hors de la Côte d'Ivoire (%.4f, %.4f)", lat, lng)
	}
}

// mairie: every commune has exactly one mairie, the one its Admin names.
func (a *auditor) mairie(cm Commune) {
	ref := "commune:" + cm.ID
	var found []string
	for _, p := range cm.Places {
		if p.Kind == "mairie" {
			found = append(found, p.ID)
		}
	}
	switch {
	case len(found) == 0:
		a.add(SevError, CodeMairie, ref, "aucune mairie")
	case len(found) > 1:
		a.add(SevError, CodeMairie, ref, "plusieurs mairies : %s", strings.Join(found, ", "))
	case cm.Admin.Mairie != found[0]:
		a.add(SevError, CodeMairie, ref, "rattachée à la mairie %q mais sa mairie est %q", cm.Admin.Mairie, found[0])
	}
}

func (a *auditor) interaction(ref string, it game.Interaction) {
	if it.ID == "" || it.Label == "" || it.Icon == "" {
		a.add(SevError, CodeMissingField, ref, "identifiant, libellé ou icône manquant")
	}
	if it.Minutes <= 0 {
		a.add(SevError, CodeInconsistent, ref, "durée nulle")
	}
	if it.MinHour < 0 || it.MinHour > 23 || it.MaxHour < 0 || it.MaxHour > 24 {
		a.add(SevError, CodeInconsistent, ref, "heures hors de 0–24")
	}
	for _, d := range it.Days {
		if d < 0 || d > 6 {
			a.add(SevError, CodeInconsistent, ref, "jour %d hors de 0 (lundi) – 6 (dimanche)", d)
		}
	}
	if r := it.Requires; r != nil && r.Career != "" {
		if _, ok := game.FindCareer(r.Career); !ok {
			a.add(SevError, CodeBadReference, ref, "métier requis inconnu %q", r.Career)
		}
	}
}

func (a *auditor) kinds() {
	used := map[string]int{}
	for _, c := range Cities {
		for _, cm := range c.Communes {
			for _, p := range cm.Places {
				used[p.Kind]++
			}
		}
	}
	for id, k := range game.Kinds {
		ref := "kind:" + id
		if k.ID != id || k.Label == "" || k.Icon == "" {
			a.add(SevError, CodeMissingField, ref, "identifiant, libellé ou icône manquant")
		}
		if len(k.Interactions) == 0 {
			a.add(SevError, CodeUnpopulated, ref, "aucune activité")
		}
		seen := map[string]bool{}
		for _, it := range k.Interactions {
			if seen[it.ID] {
				a.add(SevError, CodeDuplicateID, ref+"/"+it.ID, "activité en double")
			}
			seen[it.ID] = true
			a.interaction(ref+"/"+it.ID, it)
		}
		if id != "home" && used[id] == 0 {
			a.add(SevWarning, CodeUnpopulated, ref, "aucun lieu de ce type sur la carte")
		}
	}
}

func (a *auditor) careers() {
	for _, c := range game.Careers {
		ref := "career:" + c.ID
		k, ok := game.Kinds[c.Kind]
		if !ok {
			a.add(SevError, CodeBadReference, ref, "type de lieu inconnu %q", c.Kind)
			continue
		}
		if len(c.Levels) == 0 {
			a.add(SevError, CodeMissingField, ref, "aucun échelon")
		}
		a.interaction(ref, c.Shift(0))
		places := 0
		for _, city := range Cities {
			for _, cm := range city.Communes {
				for _, p := range cm.Places {
					if p.Kind == k.ID {
						places++
					}
				}
			}
		}
		if places == 0 {
			a.add(SevError, CodeUnpopulated, ref, "aucun lieu de travail (%s) sur la carte", k.Label)
		}
	}
}

func (a *auditor) happenings() {
	holidays := map[string]bool{}
	for _, h := range game.Holidays {
		holidays[h.ID] = true
	}
	seen := map[string]bool{}
	for _, h := range game.Happenings {
		ref := "happening:" + h.ID
		if seen[h.ID] {
			a.add(SevError, CodeDuplicateID, ref, "événement en double")
		}
		seen[h.ID] = true
		if h.ID == "" || h.Label == "" || h.Text == "" || h.Icon == "" || h.Category == "" {
			a.add(SevError, CodeIncompleteEvt, ref, "identifiant, libellé, texte, icône ou catégorie manquant")
		}
		if h.Join == nil {
			a.add(SevWarning, CodeIncompleteEvt, ref, "rien à faire pour le joueur (pas d'action « rejoindre »)")
		} else {
			a.interaction(ref+"/join", *h.Join)
		}
		if h.Holiday != "" && !holidays[h.Holiday] {
			a.add(SevError, CodeBadReference, ref, "jour férié inconnu %q", h.Holiday)
		}
		for _, m := range h.Months {
			if m < 1 || m > 12 {
				a.add(SevError, CodeInconsistent, ref, "mois %d hors de 1–12", m)
			}
		}
		a.interaction(ref, game.Interaction{ID: h.ID, Label: h.Label, Icon: h.Icon, Minutes: game.HappeningMinutes, MinHour: h.MinHour, MaxHour: h.MaxHour, Days: h.Days})
		for _, id := range h.Cities {
			if _, ok := FindCity(id); !ok {
				a.add(SevError, CodeBadReference, ref, "ville inconnue %q", id)
			}
		}
		for _, id := range h.Communes {
			if !communeExists(id) {
				a.add(SevError, CodeBadReference, ref, "commune inconnue %q", id)
			}
		}
		a.source(ref, h.Source, h.Source != nil && h.Source.Status != game.StatusFictional)
	}
}

// holidays: lunar holidays need their date declared for the current year.
func (a *auditor) holidays(year int) {
	for _, h := range game.Holidays {
		ref := "holiday:" + h.ID
		a.source(ref, h.Source, true)
		switch h.Rule {
		case "fixed":
			if _, err := time.Parse("2006-1-2", fmt.Sprintf("%d-%d-%d", year, h.Month, h.Day)); err != nil {
				a.add(SevError, CodeInconsistent, ref, "date invalide")
			}
		case "easter":
		case "declared":
			ok := false
			for _, d := range h.Declared {
				ok = ok || strings.HasPrefix(d, fmt.Sprint(year))
			}
			if !ok {
				a.add(SevWarning, CodeUndeclaredDate, ref, "date %d pas encore saisie (annoncée chaque année par le gouvernement) : le jeu ne la fête pas", year)
			}
		default:
			a.add(SevError, CodeInconsistent, ref, "règle de date inconnue %q", h.Rule)
		}
	}
}

func (a *auditor) trips() {
	for _, t := range game.TripIncidents {
		ref := "trip-incident:" + t.ID
		if t.Text == "" || t.Extra <= 0 {
			a.add(SevError, CodeIncompleteEvt, ref, "texte ou retard manquant")
		}
		if t.Chance <= 0 || t.Chance > 1 {
			a.add(SevError, CodeInconsistent, ref, "probabilité hors de ]0, 1]")
		}
		if !t.CrossesLagoon && !t.Intercity && !t.WithinCity && len(t.Ends) == 0 {
			a.add(SevWarning, CodeIncompleteEvt, ref, "s'applique à tous les trajets : préciser l'itinéraire concerné")
		}
		for _, id := range t.Ends {
			if !communeExists(id) {
				a.add(SevError, CodeBadReference, ref, "commune inconnue %q", id)
			}
		}
		a.source(ref, t.Source, t.Source != nil && t.Source.Status != game.StatusFictional)
	}
}

func (a *auditor) expressions() {
	seen := map[string]bool{}
	for _, e := range game.Expressions {
		ref := "expression:" + e.ID
		if seen[e.ID] {
			a.add(SevError, CodeDuplicateID, ref, "expression en double")
		}
		seen[e.ID] = true
		if e.Text == "" || e.Meaning == "" || e.Example == "" || e.Lang == "" {
			a.add(SevError, CodeMissingField, ref, "texte, sens, exemple ou langue manquant")
		}
		a.source(ref, e.Source, true)
	}
}

func (a *auditor) rides() {
	for _, app := range RideApps {
		ref := "ride-app:" + app.ID
		if app.Name == "" || (app.Model != "fixed" && app.Model != "offer") {
			a.add(SevError, CodeMissingField, ref, "nom ou modèle de prix manquant")
		}
		if len(app.Cities) == 0 {
			a.add(SevError, CodeUnpopulated, ref, "aucune ville desservie")
		}
		for _, id := range app.Cities {
			if _, ok := FindCity(id); !ok {
				a.add(SevError, CodeBadReference, ref, "ville inconnue %q", id)
			}
		}
		// The apps are invented brands modelled on real ones.
		a.source(ref, app.Source, false)
	}
	a.source("taxi:compteur", Compteur.Source, true)
	for _, c := range Cities {
		if c.ID != "abidjan" {
			continue
		}
		for _, cm := range c.Communes {
			ref := "woro:" + cm.ID
			switch {
			case cm.Woro == nil:
				a.add(SevWarning, CodeMissingField, ref, "couleur des woro-woro non renseignée")
			case !cm.Woro.None && cm.Woro.Color == "":
				a.add(SevError, CodeMissingField, ref, "woro-woro sans couleur")
			default:
				a.source(ref, cm.Woro.Source, true)
			}
		}
	}
}

func communeExists(id string) bool {
	for _, c := range Cities {
		if _, ok := c.Commune(id); ok {
			return true
		}
	}
	return false
}

// fold compares names without case or accents ("Marché" = "marche").
var accents = strings.NewReplacer("à", "a", "â", "a", "ä", "a", "é", "e", "è", "e", "ê", "e", "ë", "e", "î", "i", "ï", "i", "ô", "o", "ö", "o", "ù", "u", "û", "u", "ü", "u", "ç", "c", "’", "'")

func fold(s string) string { return accents.Replace(strings.ToLower(strings.TrimSpace(s))) }

// Summary counts issues by severity and code, for the CLI and the endpoint.
func Summary(issues []Issue) map[string]map[string]int {
	out := map[string]map[string]int{}
	for _, i := range issues {
		if out[i.Severity] == nil {
			out[i.Severity] = map[string]int{}
		}
		out[i.Severity][i.Code]++
	}
	return out
}
