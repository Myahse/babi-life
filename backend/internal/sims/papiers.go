package sims

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les papiers (the update « papiers », game/papiers.go; web components/Papiers.tsx): the Sim's
// documents, one table (documents). Some come by themselves with what happens (the extrait at
// birth, the contract when hired, the lease when renting, the title when buying a lot, the
// carte grise with a vehicle, the bac), derived from the Sim's state (syncPapers) whenever the
// wallet is opened or one of those things is done; the others are asked for at a place (the
// card at the mairie or the commissariat, the permis' test, the wedding, the legalisation).
// Issuing is idempotent: one live document per (sim, kind, ref).

var (
	errNeedCNI       = errors.New("il faut d'abord ta carte d'identité : demande-la à la mairie de ta commune ou au commissariat (appli Papiers)")
	errNeedCNIJob    = errors.New("pour ce métier, il faut ta carte d'identité : demande-la à la mairie de ta commune ou au commissariat")
	errNeedCNILot    = errors.New("pour acheter un terrain, il faut ta carte d'identité : demande-la à la mairie de ta commune ou au commissariat")
	errCNIStillValid = errors.New("ta carte d'identité est encore valable : reviens quand elle arrivera à expiration")
	errHasPermis     = errors.New("tu as déjà ton permis de conduire")
	errNoSpouse      = errors.New("pour te marier, il te faut un·e partenaire (en couple avec un perso ou un joueur)")
	errMarried       = errors.New("tu es déjà marié·e")
)

// Paper is a document as the wallet shows it.
type Paper struct {
	ID        int64          `json:"id"`
	Kind      string         `json:"kind"`
	Ref       string         `json:"ref"`
	Number    string         `json:"number"`
	Data      map[string]any `json:"data"`
	Legalised bool           `json:"legalised"`
	Ended     bool           `json:"ended"`
	IssuedAt  time.Time      `json:"issuedAt"`
	ExpiresAt *time.Time     `json:"expiresAt,omitempty"`
}

// How a document is issued again when it's already there.
const (
	paperKeep   = 0 // left as it is (the extrait keeps its birth place)
	paperUpdate = 1 // what it says brought up to date (a promotion on the contract, a child on the livret)
	paperRenew  = 2 // a new copy: a new number, today's date, its validity again, not legalised
)

// paperIssue: a document to issue, from deep inside an action (comeOfAge), written with the Sim (mutateWith).
type paperIssue struct {
	kind, ref string
	data      map[string]any
	mode      int
	valid     int64 // real minutes it lasts (0: forever)
	// line: the journal's line when it's new.
	line string
}

func papersOpen(ctx context.Context) bool {
	return features.Default != nil && features.Default.BlocksKey(ctx, game.PapersKey) == ""
}

// issuePaperSQL: one document, its number from the sequence (« BL-2026-000123 »); fresh: newly made.
const issuePaperSQL = `
	INSERT INTO documents (sim_id, kind, ref, number, data, expires_at)
	SELECT $1, $2, $3, 'BL-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, greatest(6, length(n::text)), '0'), $4, $5
	FROM (SELECT nextval('documents_number') AS n) seq
	ON CONFLICT (sim_id, kind, ref) DO UPDATE SET
		data = CASE WHEN $6 = 0 THEN documents.data ELSE documents.data || EXCLUDED.data END,
		ended = CASE WHEN $6 = 0 THEN documents.ended ELSE false END,
		number = CASE WHEN $6 = 2 THEN EXCLUDED.number ELSE documents.number END,
		issued_at = CASE WHEN $6 = 2 THEN now() ELSE documents.issued_at END,
		expires_at = CASE WHEN $6 = 2 THEN EXCLUDED.expires_at ELSE documents.expires_at END,
		legalised = CASE WHEN $6 = 2 THEN false ELSE documents.legalised END
	RETURNING (xmax = 0)`

// queueIssue: the document in a batch; fresh tells whether it was made now.
func queueIssue(b *pgx.Batch, simID string, p paperIssue, fresh *bool) {
	var exp *time.Time
	if p.valid > 0 {
		t := time.Now().Add(time.Duration(p.valid) * time.Minute)
		exp = &t
	}
	if p.data == nil {
		p.data = map[string]any{}
	}
	b.Queue(issuePaperSQL, simID, p.kind, p.ref, p.data, exp, p.mode).QueryRow(func(row pgx.Row) error {
		return row.Scan(fresh)
	})
}

// issuePapers: documents issued now; the journal's lines of the new ones.
func issuePapers(ctx context.Context, tx pgx.Tx, s *Sim, list []paperIssue) ([]Event, error) {
	if len(list) == 0 {
		return nil, nil
	}
	b := &pgx.Batch{}
	fresh := make([]bool, len(list))
	for i, p := range list {
		queueIssue(b, s.ID, p, &fresh[i])
	}
	if err := tx.SendBatch(ctx, b).Close(); err != nil {
		return nil, err
	}
	var evs []Event
	for i, p := range list {
		if fresh[i] && p.line != "" {
			evs = append(evs, Event{Kind: "life", Text: p.line, GameTime: s.GameMinutes})
		}
	}
	return evs, nil
}

// bornAt: the Sim's birth on its papers (game time); a Sim from before births was born the day it was made.
func (s *Sim) bornMinute() int64 {
	if s.BornAt != 0 {
		return s.BornAt
	}
	return game.MinuteOf(s.CreatedAt)
}

// who: the Sim's identity on its papers.
func (s *Sim) who() map[string]any {
	// years: its age that day (a game year is hours of play: the card shows the birth's year as so many years back).
	return map[string]any{"firstName": s.FirstName, "lastName": s.LastName, "gender": s.Gender, "born": s.bornMinute(), "years": s.age()}
}

// extraitPaper: the birth certificate, its parents from the family (the commune it was born in: where its family lives).
func (s *Sim) extraitPaper(mode int) paperIssue {
	father, mother := game.ParentNames(s.ID, s.LastName)
	d := s.who()
	d["commune"], d["city"], d["father"], d["mother"] = communeName(s.HomeCity, s.HomeCommune), s.HomeCity, father, mother
	if f, ok := game.FindFamily(s.Family); ok {
		d["family"] = f.Label
	}
	return paperIssue{kind: game.DocExtrait, data: d, mode: mode}
}

// syncPapers: the documents the Sim's life gives by itself, issued (or brought up to date), and those
// it no longer has reason for (a job left, a lot sold) marked ended. A few rows, one round trip each way.
func syncPapers(ctx context.Context, tx pgx.Tx, s *Sim) ([]Event, error) {
	list := []paperIssue{s.extraitPaper(paperKeep)}
	live := map[string][]string{game.DocTravail: {}, game.DocBail: {}, game.DocTitre: {}, game.DocCarteGrise: {}}
	home := communeName(s.HomeCity, s.HomeCommune)
	if c, ok := game.FindCareer(s.Career); ok && s.Career != "" && !s.minor() {
		l := c.Levels[min(max(s.CareerLevel, 0), len(c.Levels)-1)]
		list = append(list, paperIssue{kind: game.DocTravail, ref: c.ID, mode: paperUpdate, line: fmt.Sprintf("Contrat de travail signé avec %s : il est dans tes papiers.", game.Employer(s.ID, c.ID)),
			data: map[string]any{"career": c.Label, "title": l.Title, "pay": l.Pay, "employer": game.Employer(s.ID, c.ID), "commune": home, "holder": s.FirstName + " " + s.LastName}})
		live[game.DocTravail] = append(live[game.DocTravail], c.ID)
	}
	if hs, ok := game.FindHousing(s.Housing); ok && s.Housing != game.OwnHouse && !s.minor() {
		ref := s.Housing + "@" + s.HomeCity + "/" + s.HomeCommune
		list = append(list, paperIssue{kind: game.DocBail, ref: ref, mode: paperUpdate, line: "Contrat de bail signé pour ton logement : il est dans tes papiers.",
			data: map[string]any{"housing": hs.Label, "rent": hs.Rent, "landlord": game.Landlord(s.ID, ref), "commune": home, "holder": s.FirstName + " " + s.LastName}})
		live[game.DocBail] = append(live[game.DocBail], ref)
	}
	// The lots and the vehicles, read in the same round trip; the wedding, for the livret.
	b := &pgx.Batch{}
	type lot struct {
		id            int64
		w, d, paid    int
		city, commune string
		built         bool
	}
	var lots []lot
	b.Queue(`SELECT id, lot_w, lot_d, lot_paid, lot_city, lot_commune, jsonb_array_length(blocks) > 0 FROM plots WHERE sim_id = $1 AND lot_w > 0`, s.ID).Query(func(rows pgx.Rows) error {
		for rows.Next() {
			var l lot
			if err := rows.Scan(&l.id, &l.w, &l.d, &l.paid, &l.city, &l.commune, &l.built); err != nil {
				return err
			}
			lots = append(lots, l)
		}
		return rows.Err()
	})
	type car struct {
		id           int64
		model, color string
		at           time.Time
	}
	var cars []car
	b.Queue(`SELECT id, model, color, bought_at FROM vehicles WHERE sim_id = $1`, s.ID).Query(func(rows pgx.Rows) error {
		for rows.Next() {
			var c car
			if err := rows.Scan(&c.id, &c.model, &c.color, &c.at); err != nil {
				return err
			}
			cars = append(cars, c)
		}
		return rows.Err()
	})
	var spouse string
	b.Queue(`SELECT coalesce((SELECT data->>'spouse' FROM documents WHERE sim_id = $1 AND kind = $2 AND NOT ended LIMIT 1), '')`, s.ID, game.DocMariage).QueryRow(func(row pgx.Row) error {
		return row.Scan(&spouse)
	})
	if err := tx.SendBatch(ctx, b).Close(); err != nil {
		return nil, err
	}
	for _, l := range lots {
		ref := strconv.FormatInt(l.id, 10)
		list = append(list, paperIssue{kind: game.DocTitre, ref: ref, mode: paperUpdate, line: fmt.Sprintf("Titre de propriété de ton terrain %s : il est dans tes papiers.", inCommune(communeName(l.city, l.commune))),
			data: map[string]any{"w": l.w, "d": l.d, "area": l.w * l.d, "paid": l.paid, "commune": communeName(l.city, l.commune), "built": l.built, "holder": s.FirstName + " " + s.LastName}})
		live[game.DocTitre] = append(live[game.DocTitre], ref)
	}
	for _, c := range cars {
		m, ok := game.FindVehicleModel(c.model)
		// A bike has no carte grise.
		if !ok || m.Kind == "velo" {
			continue
		}
		ref := strconv.FormatInt(c.id, 10)
		list = append(list, paperIssue{kind: game.DocCarteGrise, ref: ref, mode: paperUpdate, line: fmt.Sprintf("Carte grise de ta %s : elle est dans tes papiers.", m.Name),
			data: map[string]any{"model": m.Name, "vehicle": m.Kind, "color": c.color, "bought": game.MinuteOf(c.at), "plate": plate(c.id), "holder": s.FirstName + " " + s.LastName, "commune": home}})
		live[game.DocCarteGrise] = append(live[game.DocCarteGrise], ref)
	}
	// The livret de famille: with a wedding or children.
	if kids := s.fam().Kids; spouse != "" || len(kids) > 0 {
		ks := make([]map[string]any, 0, len(kids))
		for _, k := range kids {
			ks = append(ks, map[string]any{"name": k.Name, "gender": k.Gender, "born": k.Born})
		}
		list = append(list, paperIssue{kind: game.DocLivret, mode: paperUpdate, line: "Livret de famille ouvert : il est dans tes papiers.",
			data: map[string]any{"holder": s.FirstName + " " + s.LastName, "spouse": spouse, "kids": ks, "commune": home}})
	}
	evs, err := issuePapers(ctx, tx, s, list)
	if err != nil {
		return nil, err
	}
	// What the Sim no longer has: kept, marked ended.
	b = &pgx.Batch{}
	for kind, refs := range live {
		b.Queue(`UPDATE documents SET ended = true WHERE sim_id = $1 AND kind = $2 AND NOT ended AND NOT (ref = ANY($3))`, s.ID, kind, refs)
	}
	if err := tx.SendBatch(ctx, b).Close(); err != nil {
		return nil, err
	}
	return evs, nil
}

// plate: a vehicle's number plate in the game's own format (never a real one): « BL 0123 AB ».
func plate(id int64) string {
	l := func(n int64) byte { return byte('A' + n%26) }
	return fmt.Sprintf("BL %04d %c%c", id%10000, l(id/7+3), l(id/11+17))
}

// papersFlush: the documents an action brought (s.papers, s.paperSync), with the Sim's save (mutateWith).
// Never fails the action: a savepoint, and nothing more said if it can't.
func papersFlush(ctx context.Context, tx pgx.Tx, s *Sim) []Event {
	if (len(s.papers) == 0 && !s.paperSync) || !papersOpen(ctx) {
		return nil
	}
	if _, err := tx.Exec(ctx, `SAVEPOINT papiers`); err != nil {
		return nil
	}
	evs, err := issuePapers(ctx, tx, s, s.papers)
	if err == nil && s.paperSync {
		var more []Event
		more, err = syncPapers(ctx, tx, s)
		evs = append(evs, more...)
	}
	if err != nil {
		_, _ = tx.Exec(ctx, `ROLLBACK TO SAVEPOINT papiers`)
		return nil
	}
	s.papers, s.paperSync = nil, false
	return evs
}

// hasPaper: a live document of that kind, still valid.
func hasPaper(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, simID, kind string) bool {
	var ok bool
	_ = q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM documents WHERE sim_id = $1 AND kind = $2 AND NOT ended AND (expires_at IS NULL OR expires_at > now()))`, simID, kind).Scan(&ok)
	return ok
}

// needCNI: the card asked for (a job, a lot), only with the update open.
func needCNI(ctx context.Context, tx pgx.Tx, s *Sim, why error) error {
	if !papersOpen(ctx) || hasPaper(ctx, tx, s.ID, game.DocCNI) {
		return nil
	}
	return why
}

// spouseOf: whom the Sim would marry: the player it's together with, else its partner met in the game.
func spouseOf(ctx context.Context, tx pgx.Tx, s *Sim) (id, name string) {
	if other := inCouple(ctx, tx, s.ID); other != "" {
		_ = tx.QueryRow(ctx, `SELECT first_name || ' ' || last_name FROM sims WHERE id = $1`, other).Scan(&name)
		if name != "" {
			return other, name
		}
	}
	if p := s.partner(); p != nil {
		return "pnj:" + p.ID, p.Name
	}
	return "", ""
}

// papersBefore: what a place's paper action needs, checked before it's paid for.
func papersBefore(ctx context.Context, tx pgx.Tx, s *Sim, interaction string) error {
	switch interaction {
	case game.CNIMairieID, game.CNIPoliceID:
		var left bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM documents WHERE sim_id = $1 AND kind = $2 AND NOT ended AND expires_at > now() + make_interval(mins => $3))`, s.ID, game.DocCNI, int(game.YearMinutes)).Scan(&left)
		if left {
			return errCNIStillValid
		}
	case game.PermisID:
		if !hasPaper(ctx, tx, s.ID, game.DocCNI) {
			return errNeedCNI
		}
		if hasPaper(ctx, tx, s.ID, game.DocPermis) {
			return errHasPermis
		}
	case game.MariageID:
		if hasPaper(ctx, tx, s.ID, game.DocMariage) {
			return errMarried
		}
		if id, _ := spouseOf(ctx, tx, s); id == "" {
			return errNoSpouse
		}
		if !hasPaper(ctx, tx, s.ID, game.DocCNI) {
			return errNeedCNI
		}
	}
	return nil
}

// cniPaper: the identity card, its photo the Sim's look as it is today.
func (s *Sim) cniPaper() paperIssue {
	d := s.who()
	d["commune"], d["city"], d["look"] = communeName(s.HomeCity, s.HomeCommune), s.HomeCity, s.Look
	return paperIssue{kind: game.DocCNI, data: d, mode: paperRenew, valid: game.CNIValidMinutes()}
}

// permisPaper: the driving licence (A for motos, B for cars: both, the test passed).
func (s *Sim) permisPaper() paperIssue {
	d := s.who()
	d["look"], d["classes"], d["commune"] = s.Look, "A · B", communeName(s.HomeCity, s.HomeCommune)
	return paperIssue{kind: game.DocPermis, data: d, mode: paperRenew}
}

// papersAct: what a place's paper action gives, once it's started (paid for); the line to add.
func papersAct(ctx context.Context, tx pgx.Tx, s *Sim, placeName string, it game.Interaction) (string, error) {
	if !papersOpen(ctx) {
		return "", nil
	}
	switch it.ID {
	case game.ExtraitID:
		if _, err := issuePapers(ctx, tx, s, []paperIssue{s.extraitPaper(paperRenew)}); err != nil {
			return "", err
		}
		return " Ton extrait d'acte de naissance est prêt : il est dans l'appli Papiers.", nil
	case game.CNIMairieID, game.CNIPoliceID:
		if _, err := issuePapers(ctx, tx, s, []paperIssue{s.extraitPaper(paperKeep), s.cniPaper()}); err != nil {
			return "", err
		}
		return fmt.Sprintf(" Ta carte d'identité est faite, avec ta photo (valable %d ans de jeu) : elle est dans l'appli Papiers.", game.CNIYears), nil
	case game.PermisID:
		// Played (the update « gestes-maison »): the code's quiz decides (papersPermis); else it's passed.
		if features.Default != nil && features.Default.BlocksKey(ctx, "gestes-maison") == "" {
			// Paid: if it isn't passed, the next try is free; the free try used, the one after is paid.
			s.Life.PermisRetry = it.Cost > 0
			return " Réussis l'examen du code pour avoir ton permis.", nil
		}
		if _, err := issuePapers(ctx, tx, s, []paperIssue{s.permisPaper()}); err != nil {
			return "", err
		}
		return " Permis de conduire en poche : il est dans l'appli Papiers.", nil
	case game.MariageID:
		id, name := spouseOf(ctx, tx, s)
		if id == "" {
			return "", errNoSpouse
		}
		me := s.FirstName + " " + s.LastName
		d := map[string]any{"holder": me, "spouse": name, "commune": communeName(s.City, s.Commune), "place": placeName, "on": s.GameMinutes}
		if _, err := issuePapers(ctx, tx, s, []paperIssue{{kind: game.DocMariage, ref: id, data: d, mode: paperRenew}}); err != nil {
			return "", err
		}
		// The player married too gets the same act, the other way round.
		if !strings.HasPrefix(id, "pnj:") {
			other := Sim{ID: id}
			od := map[string]any{"holder": name, "spouse": me, "commune": d["commune"], "place": placeName, "on": s.GameMinutes}
			if _, err := issuePapers(ctx, tx, &other, []paperIssue{{kind: game.DocMariage, ref: s.ID, data: od, mode: paperRenew}}); err != nil {
				return "", err
			}
		}
		s.paperSync = true
		return fmt.Sprintf(" Vous voilà mariés, %s et toi ! L'acte de mariage et le livret de famille sont dans l'appli Papiers.", name), nil
	case game.LegalisationID, game.PrefLegalisationID:
		rows, err := tx.Query(ctx, `UPDATE documents SET legalised = true WHERE sim_id = $1 AND NOT ended AND kind <> ALL($2) RETURNING kind, number`, s.ID, []string{game.DocLegalisation, game.DocAvertissement})
		if err != nil {
			return "", err
		}
		var docs []map[string]any
		for rows.Next() {
			var k, n string
			if err := rows.Scan(&k, &n); err != nil {
				rows.Close()
				return "", err
			}
			docs = append(docs, map[string]any{"kind": k, "number": n})
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return "", err
		}
		if len(docs) == 0 {
			return " Tu n'as encore aucun papier à faire légaliser.", nil
		}
		d := map[string]any{"holder": s.FirstName + " " + s.LastName, "docs": docs, "place": placeName}
		if _, err := issuePapers(ctx, tx, s, []paperIssue{{kind: game.DocLegalisation, data: d, mode: paperRenew}}); err != nil {
			return "", err
		}
		return fmt.Sprintf(" %d papier(s) légalisé(s) : l'attestation est dans l'appli Papiers.", len(docs)), nil
	}
	return "", nil
}

// papersPermis: the code's quiz played at the permis' test: passed, the licence.
func papersPermis(ctx context.Context, tx pgx.Tx, s *Sim, score int) (string, error) {
	if !papersOpen(ctx) {
		return "", nil
	}
	if score < game.PermisPass {
		if s.Life.PermisRetry {
			return " Recalé·e à l'examen du code : reviens le repasser au commissariat, le prochain essai est gratuit.", nil
		}
		return " Recalé·e à l'examen du code : reviens le repasser au commissariat.", nil
	}
	s.Life.PermisRetry = false
	if _, err := issuePapers(ctx, tx, s, []paperIssue{s.permisPaper()}); err != nil {
		return "", err
	}
	return " Reçu·e ! Ton permis de conduire est dans l'appli Papiers.", nil
}

// papersCheck: the police roadblock (the street's « controle »): the card, and with a vehicle the
// licence and the carte grise. Missing: a warning the first time (the avis), then a small fine.
// Never more: a newcomer can always go on playing. The fine paid, and the line said.
func papersCheck(ctx context.Context, tx pgx.Tx, s *Sim) (string, int, error) {
	if !papersOpen(ctx) {
		return "", 0, nil
	}
	if s.minor() {
		return " L'agent sourit : « Les petits, pas de papiers. File à la maison ! »", 0, nil
	}
	// What its life gives by itself first (the carte grise of a moto bought before the wallet was ever opened).
	if _, err := syncPapers(ctx, tx, s); err != nil {
		return "", 0, err
	}
	var cni, cniOld, permis, avis bool
	var motors, grises int
	b := &pgx.Batch{}
	b.Queue(`SELECT
		EXISTS (SELECT 1 FROM documents WHERE sim_id = $1 AND kind = $2 AND NOT ended AND expires_at > now()),
		EXISTS (SELECT 1 FROM documents WHERE sim_id = $1 AND kind = $2 AND NOT ended),
		EXISTS (SELECT 1 FROM documents WHERE sim_id = $1 AND kind = $3 AND NOT ended),
		EXISTS (SELECT 1 FROM documents WHERE sim_id = $1 AND kind = $4 AND issued_at > now() - interval '7 days'),
		(SELECT count(*) FROM documents WHERE sim_id = $1 AND kind = $5 AND NOT ended)`,
		s.ID, game.DocCNI, game.DocPermis, game.DocAvertissement, game.DocCarteGrise).QueryRow(func(row pgx.Row) error {
		return row.Scan(&cni, &cniOld, &permis, &avis, &grises)
	})
	b.Queue(`SELECT model FROM vehicles WHERE sim_id = $1`, s.ID).Query(func(rows pgx.Rows) error {
		for rows.Next() {
			var m string
			if err := rows.Scan(&m); err != nil {
				return err
			}
			if v, ok := game.FindVehicleModel(m); ok && v.Kind != "velo" {
				motors++
			}
		}
		return rows.Err()
	})
	if err := tx.SendBatch(ctx, b).Close(); err != nil {
		return "", 0, err
	}
	var missing []string
	switch {
	case !cniOld:
		missing = append(missing, "la carte d'identité")
	case !cni:
		// Expired: a reminder, nothing more.
		return " L'agent lit ta carte d'identité : « Elle a expiré, mon frère. Va la renouveler à la mairie. » Il te laisse passer.", 0, nil
	}
	if motors > 0 && !permis {
		missing = append(missing, "le permis de conduire")
	}
	if motors > grises {
		missing = append(missing, "la carte grise")
	}
	if len(missing) == 0 {
		if motors > 0 {
			return " L'agent regarde ta carte d'identité, ton permis et ta carte grise : « Tout est en règle. Bonne route ! »", 0, nil
		}
		return " L'agent regarde ta carte d'identité : « En règle. Bonne route ! »", 0, nil
	}
	what := strings.Join(missing, ", ")
	if !avis {
		d := map[string]any{"holder": s.FirstName + " " + s.LastName, "missing": missing, "commune": communeName(s.City, s.Commune)}
		if _, err := issuePapers(ctx, tx, s, []paperIssue{{kind: game.DocAvertissement, data: d, mode: paperRenew}}); err != nil {
			return "", 0, err
		}
		return fmt.Sprintf(" « Va chercher tes papiers ! » Il te manque %s : un avertissement cette fois (dans l'appli Papiers). La carte d'identité se demande à la mairie de ta commune ou au commissariat.", what), 0, nil
	}
	paid := min(game.PapersFine, max(s.Money, 0))
	s.Money -= paid
	return fmt.Sprintf(" Il te manque encore %s : amende de %s. Passe à la mairie ou au commissariat pour être en règle.", what, game.FCFA(game.PapersFine)), paid, nil
}

// papers: GET /sims/{id}/papiers — the wallet: the documents, brought up to date first.
func (h *Handler) papers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !papersOpen(ctx) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)
	s, err := scanSim(tx.QueryRow(ctx, `SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	s.GameMinutes = max(s.GameMinutes, game.MinuteOf(time.Now()))
	if _, err := syncPapers(ctx, tx, &s); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	list, err := listPapers(ctx, tx, s.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"papers": list})
}

// paperOrder: how the wallet lists them, identity first.
var paperOrder = []string{game.DocCNI, game.DocExtrait, game.DocPermis, game.DocCarteGrise, game.DocMariage, game.DocLivret, game.DocTravail, game.DocBail, game.DocTitre, game.DocBAC, game.DocBEPC, game.DocEMPT, game.DocService, game.DocLegalisation, game.DocAvertissement}

func listPapers(ctx context.Context, q interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, simID string) ([]Paper, error) {
	rows, err := q.Query(ctx, `SELECT id, kind, ref, number, data, legalised, ended, issued_at, expires_at FROM documents WHERE sim_id = $1 ORDER BY ended, issued_at DESC`, simID)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Paper, error) {
		var p Paper
		err := row.Scan(&p.ID, &p.Kind, &p.Ref, &p.Number, &p.Data, &p.Legalised, &p.Ended, &p.IssuedAt, &p.ExpiresAt)
		return p, err
	})
	if err != nil {
		return nil, err
	}
	rank := func(k string) int {
		if i := slices.Index(paperOrder, k); i >= 0 {
			return i
		}
		return len(paperOrder)
	}
	slices.SortStableFunc(list, func(a, b Paper) int {
		if a.Ended != b.Ended {
			if a.Ended {
				return 1
			}
			return -1
		}
		return rank(a.Kind) - rank(b.Kind)
	})
	if list == nil {
		list = []Paper{}
	}
	return list, nil
}

// sharedPaper: a document someone showed in a chat (« [ticket:papier:ref:sig] », tickets.go).
func (h *Handler) sharedPaper(ctx context.Context, id int64) (map[string]any, error) {
	var p Paper
	var owner, gender string
	if err := h.DB.QueryRow(ctx, `SELECT d.id, d.kind, d.ref, d.number, d.data, d.legalised, d.ended, d.issued_at, d.expires_at, s.first_name, s.gender
		FROM documents d JOIN sims s ON s.id = d.sim_id WHERE d.id = $1`, id).
		Scan(&p.ID, &p.Kind, &p.Ref, &p.Number, &p.Data, &p.Legalised, &p.Ended, &p.IssuedAt, &p.ExpiresAt, &owner, &gender); err != nil {
		return nil, err
	}
	return map[string]any{"kind": "papier", "owner": owner, "gender": gender, "paper": p}, nil
}

// diploma: a school diploma (the game's BEPC, the game's bac): the Sim, the day, its marks out of 20.
func (s *Sim) diploma(on int64, marks int) map[string]any {
	d := s.who()
	d["on"], d["marks"], d["commune"] = on, min(20, max(10, 10+marks/4)), communeName(s.HomeCity, s.HomeCommune)
	return d
}
