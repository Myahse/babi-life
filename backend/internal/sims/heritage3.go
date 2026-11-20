package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/push"
)

// L'héritage, phase 3 (the update « heritage », game/heritage3.go; web screens/FamilleApp.tsx « Héritage »,
// components/heritage/Crest*.tsx): the heirlooms, the crest and its devise, the weekly fête.
//   - Heirlooms live in their own table (heirlooms): the thing itself stays where it always was (a piece of
//     furniture in a house on a lot, a piece in the wardrobe, a row of vehicles), the table only says which
//     one is the family's, how many times it was handed down and the lines engraved. Selling it is refused
//     (the garage, the house editor taking away the last one, a lot sold or cleared with it inside).
//   - The crest: in the family (life.famille.crest, the Sim's own screens) and in sims.crest (the others':
//     the ranking, the houses, Babi Direct). Chosen once a generation; the devise moderated like the chat.
//   - The fête: the Palais de la Culture's « La Fête des grandes familles » during the rendez-vous; its renom
//     once a week (rendezvous_done), every renom gained written in renom_log, so the week's three best families
//     are told in Babi Direct with their crests once it's over (on a read: nothing runs by itself for it).

var (
	errCrestOnce     = errors.New("le blason se choisit une fois par génération : ton héritier pourra le changer")
	errDeviseWords   = errors.New("cette devise ne passe pas : choisis d'autres mots")
	errDeviseLinks   = errors.New("pas de lien ni de numéro dans la devise")
	errHeirloomPick  = errors.New("cet objet n'est pas à toi : choisis-en un autre")
	errHeirloomsFull = fmt.Errorf("ta famille garde déjà %d objets de famille : transmets l'un d'eux", game.HeirloomsMax)
	errFeteClosed    = errors.New("la Fête des grandes familles, c'est le dimanche de 19 h à 22 h au Palais de la Culture")
)

// deviseBanned: words a devise never shows (shown to every player, on the houses): insults and slurs, in
// French and nouchi, matched as whole words once the accents and the leet digits are read as letters.
var deviseBanned = []string{"pute", "putain", "salope", "connard", "connasse", "encule", "batard", "merde", "nique", "niquer", "fdp", "pd", "tapette", "negre"}

// unaccent: the accents a devise's words are read without (« enculé » is « encule »).
var unaccent = strings.NewReplacer("\u00e9", "e", "\u00e8", "e", "\u00ea", "e", "\u00eb", "e", "\u00e0", "a", "\u00e2", "a", "\u00ee", "i", "\u00ef", "i", "\u00f4", "o", "\u00fb", "u", "\u00f9", "u", "\u00e7", "c")

// moderateDevise: the devise as the chat would take it (cleanMessage: no links, no phone numbers), on one
// line, not passing for the game's team (the names' rule, auth.ReservedUsername), no insult.
func moderateDevise(d string) (string, error) {
	if strings.TrimSpace(d) == "" {
		return "", nil
	}
	clean, err := cleanMessage(d)
	if err != nil {
		return "", err
	}
	if clean != strings.TrimSpace(d) || strings.ContainsAny(clean, "@") {
		return "", errDeviseLinks
	}
	if auth.ReservedUsername(clean) {
		return "", errDeviseWords
	}
	plain := strings.NewReplacer("0", "o", "1", "i", "3", "e", "4", "a", "5", "s", "$", "s").Replace(unaccent.Replace(strings.ToLower(clean)))
	words := strings.FieldsFunc(plain, func(r rune) bool { return !(r >= 'a' && r <= 'z' || r > 127) })
	for _, w := range words {
		if slices.Contains(deviseBanned, w) {
			return "", errDeviseWords
		}
	}
	return clean, nil
}

// heritageCrest: POST /sims/{id}/heritage/blason {shape, colors, emblem, devise}: the family's crest,
// chosen once a generation.
func (h *Handler) heritageCrest(w http.ResponseWriter, r *http.Request) {
	var req game.Crest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		if !s.heritageOn {
			return game.Outcome{}, nil, errLifeClosed
		}
		c, err := req.Check()
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if c.Devise, err = moderateDevise(c.Devise); err != nil {
			return game.Outcome{}, nil, err
		}
		var gen int
		if err := tx.QueryRow(ctx, `SELECT generation FROM sims WHERE id = $1`, s.ID).Scan(&gen); err != nil {
			return game.Outcome{}, nil, err
		}
		f := s.fam()
		if f.Crest != nil && f.CrestGen >= gen {
			return game.Outcome{}, nil, errCrestOnce
		}
		raw, _ := json.Marshal(c)
		if _, err := tx.Exec(ctx, `UPDATE sims SET crest = $2 WHERE id = $1`, s.ID, raw); err != nil {
			return game.Outcome{}, nil, err
		}
		f.Crest, f.CrestGen = &c, gen
		s.Needs = s.Needs.Add(game.Needs{Fun: 5})
		text := fmt.Sprintf("Le blason de la famille %s est prêt : il est sur ta maison.", s.LastName)
		if c.Devise != "" {
			text = fmt.Sprintf("Le blason de la famille %s est prêt, avec sa devise : « %s ».", s.LastName, c.Devise)
		}
		return game.Outcome{Text: text}, []Event{{Kind: "life", Text: text, GameTime: s.GameMinutes}}, nil
	})
}

/* ---------- Heirlooms ---------- */

// HeirloomPick: what the parent hands down at the passation (kind and item, as HeirloomChoice gives them).
type HeirloomPick struct {
	Kind string `json:"kind"`
	Item string `json:"item"`
}

// HeirloomChoice: something the parent owns that could be handed down.
type HeirloomChoice struct {
	Kind  string `json:"kind"`
	Item  string `json:"item"`
	Label string `json:"label"`
	// Ref: what draws it (a furniture's or a piece's id, a vehicle's model); Color: a vehicle's.
	Ref   string `json:"ref"`
	Color string `json:"color,omitempty"`
	// Gens: already an heirloom, handed down that many times (0: not yet).
	Gens int `json:"gens,omitempty"`
}

// HeirloomView: a family heirloom, as « Ma famille » and the card show it.
type HeirloomView struct {
	Kind  string   `json:"kind"`
	Item  string   `json:"item"`
	Label string   `json:"label"`
	Ref   string   `json:"ref"`
	Color string   `json:"color,omitempty"`
	Gens  int      `json:"gens"`
	Lines []string `json:"lines"`
	// Renom: what it added at its last passation.
	Renom int `json:"renom,omitempty"`
}

// heirloomChoices: the furniture in the houses on the Sim's lots (each kind once), the pieces in its wardrobe,
// its vehicles; the family's heirlooms marked.
func heirloomChoices(ctx context.Context, q queryer, sim string) ([]HeirloomChoice, error) {
	out := []HeirloomChoice{}
	rows, err := q.Query(ctx, `SELECT DISTINCT x->>4 FROM plots p, jsonb_array_elements(p.furniture) x WHERE p.sim_id = $1 AND p.lot_w > 0`, sim)
	if err != nil {
		return nil, err
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[*string])
	if err != nil {
		return nil, err
	}
	for _, id := range ids {
		if id == nil {
			continue
		}
		if f, ok := game.FindFurniture(*id); ok {
			out = append(out, HeirloomChoice{Kind: game.HeirloomMeuble, Item: f.ID, Label: f.Label, Ref: f.ID, Color: f.Color})
		}
	}
	var clothes []string
	if err := q.QueryRow(ctx, `SELECT clothes FROM sims WHERE id = $1`, sim).Scan(&clothes); err != nil {
		return nil, err
	}
	for _, id := range clothes {
		if p, ok := game.FindPiece(id); ok && !slices.ContainsFunc(out, func(c HeirloomChoice) bool { return c.Kind == game.HeirloomVetement && c.Item == id }) {
			out = append(out, HeirloomChoice{Kind: game.HeirloomVetement, Item: p.ID, Label: p.Label, Ref: p.ID})
		}
	}
	rows, err = q.Query(ctx, `SELECT id, model, color FROM vehicles WHERE sim_id = $1 ORDER BY id`, sim)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var model, color string
		if rows.Scan(&id, &model, &color) == nil {
			if m, ok := game.FindVehicleModel(model); ok {
				out = append(out, HeirloomChoice{Kind: game.HeirloomVehicule, Item: strconv.FormatInt(id, 10), Label: m.Name, Ref: m.ID, Color: color})
			}
		}
	}
	rows.Close()
	have, err := readHeirlooms(ctx, q, sim)
	if err != nil {
		return nil, err
	}
	for i := range out {
		for _, hl := range have {
			if hl.Kind == out[i].Kind && hl.Item == out[i].Item {
				out[i].Gens = hl.Gens
			}
		}
	}
	// The heirlooms first, then the furniture, the clothes, the vehicles.
	slices.SortStableFunc(out, func(a, b HeirloomChoice) int { return b.Gens - a.Gens })
	return out, nil
}

// readHeirlooms: the family's heirlooms, the oldest first.
func readHeirlooms(ctx context.Context, q queryer, sim string) ([]HeirloomView, error) {
	rows, err := q.Query(ctx, `SELECT kind, item, label, ref, color, gens, lines, renom FROM heirlooms WHERE sim_id = $1 ORDER BY id`, sim)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HeirloomView{}
	for rows.Next() {
		var v HeirloomView
		if err := rows.Scan(&v.Kind, &v.Item, &v.Label, &v.Ref, &v.Color, &v.Gens, &v.Lines, &v.Renom); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// passHeirloom: the thing picked handed down with the house: an heirloom once more (or for the first time),
// its line engraved; its renom (growing with the times handed down) added to the generation's. The card and
// the history's row get it too. pick nil: nothing handed down (the bonus 0).
func (s *Sim) passHeirloom(ctx context.Context, tx pgx.Tx, pick *HeirloomPick, from, to string, gen int) (*HeirloomView, error) {
	if pick == nil || pick.Kind == "" {
		return nil, nil
	}
	choices, err := heirloomChoices(ctx, tx, s.ID)
	if err != nil {
		return nil, err
	}
	i := slices.IndexFunc(choices, func(c HeirloomChoice) bool { return c.Kind == pick.Kind && c.Item == pick.Item })
	if i < 0 {
		return nil, errHeirloomPick
	}
	c := choices[i]
	if c.Gens == 0 {
		var n int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM heirlooms WHERE sim_id = $1`, s.ID).Scan(&n); err != nil {
			return nil, err
		}
		if n >= game.HeirloomsMax {
			return nil, errHeirloomsFull
		}
	}
	gens := c.Gens + 1
	bonus := game.HeirloomRenom(gens)
	line := game.HeirloomLine(from, to)
	v := &HeirloomView{Kind: c.Kind, Item: c.Item, Label: c.Label, Ref: c.Ref, Color: c.Color, Gens: gens, Renom: bonus}
	if err := tx.QueryRow(ctx, `INSERT INTO heirlooms (sim_id, kind, item, label, ref, color, gens, lines, renom) VALUES ($1, $2, $3, $4, $5, $6, 1, ARRAY[$7], $8)
		ON CONFLICT (sim_id, kind, item) DO UPDATE SET gens = heirlooms.gens + 1, lines = heirlooms.lines || $7, renom = $8, at = now()
		RETURNING lines`, s.ID, c.Kind, c.Item, c.Label, c.Ref, c.Color, line, bonus).Scan(&v.Lines); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE sims SET renom = renom + $2 WHERE id = $1`, s.ID, bonus); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE family_generations SET renom = renom + $3 WHERE sim_id = $1 AND n = $2`, s.ID, gen, bonus); err != nil {
		return nil, err
	}
	return v, nil
}

// heirloomFurniture: the furniture kinds that are the family's heirlooms.
func heirloomFurniture(ctx context.Context, q queryer, sim string) ([]string, error) {
	rows, err := q.Query(ctx, `SELECT item FROM heirlooms WHERE sim_id = $1 AND kind = $2`, sim, game.HeirloomMeuble)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// heirloomStays: a lot's furniture about to be `left` (nil: the lot sold or cleared): refused when an
// heirloom piece would be gone from every house of the Sim (taking it away sells it back by half).
func heirloomStays(ctx context.Context, q queryer, sim string, lot int64, left []game.Piece) error {
	kinds, err := heirloomFurniture(ctx, q, sim)
	if err != nil || len(kinds) == 0 {
		return err
	}
	for _, k := range kinds {
		if slices.ContainsFunc(left, func(p game.Piece) bool { return p.ID == k }) {
			continue
		}
		var elsewhere bool
		if err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM plots p, jsonb_array_elements(p.furniture) x WHERE p.sim_id = $1 AND p.id <> $2 AND x->>4 = $3)`, sim, lot, k).Scan(&elsewhere); err != nil {
			return err
		}
		if !elsewhere {
			return game.ErrHeirloomLocked
		}
	}
	return nil
}

// heirloomVehicle: whether a vehicle is the family's heirloom (not to be sold).
func heirloomVehicle(ctx context.Context, q queryer, sim string, id int64) bool {
	var yes bool
	_ = q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM heirlooms WHERE sim_id = $1 AND kind = $2 AND item = $3)`, sim, game.HeirloomVehicule, strconv.FormatInt(id, 10)).Scan(&yes)
	return yes
}

// logRenom: renom gained, written with when (the week's best families, the fête's podium).
func logRenom(ctx context.Context, tx pgx.Tx, sim string, pts int, why string) error {
	if pts <= 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `INSERT INTO renom_log (sim_id, pts, why) VALUES ($1, $2, $3)`, sim, pts, why)
	return err
}

/* ---------- The fête des grandes familles ---------- */

// feteBefore: the Palais' fête is only on during the rendez-vous (the update and the team's switch on).
func feteBefore(ctx context.Context, tx pgx.Tx, s *Sim, interaction string) error {
	if interaction != game.FamillesFeteActID {
		return nil
	}
	if !s.heritageOn {
		return errLifeClosed
	}
	if _, ok := rendezLive(ctx, tx, game.FamillesFeteID, rendezNow()); !ok {
		return errFeteClosed
	}
	return nil
}

// feteCome: come to the fête: counted among those who came, the good mood, and once a week the family's
// renom. In a savepoint: a failure here never undoes the evening. The line said, or "".
func feteCome(ctx context.Context, tx pgx.Tx, s *Sim, interaction string) string {
	if interaction != game.FamillesFeteActID || !s.heritageOn {
		return ""
	}
	sp, err := tx.Begin(ctx)
	if err != nil {
		return ""
	}
	defer sp.Rollback(ctx)
	o, ok := rendezLive(ctx, sp, game.FamillesFeteID, rendezNow())
	if !ok {
		return ""
	}
	if _, err := sp.Exec(ctx, `INSERT INTO rendezvous_joins (occ, sim, joined_at) VALUES ($1, $2, now()) ON CONFLICT (occ, sim) DO UPDATE SET joined_at = COALESCE(rendezvous_joins.joined_at, now())`, o.Key, s.ID); err != nil {
		return ""
	}
	s.addMood("fete-familles", "")
	said := "La Fête des grandes familles : les familles dansent, les anciens racontent, on se montre."
	tag, err := sp.Exec(ctx, `INSERT INTO rendezvous_done (key) VALUES ($1) ON CONFLICT DO NOTHING`, fmt.Sprintf("fete:%s:%s", o.Key, s.ID))
	if err != nil {
		return ""
	}
	if tag.RowsAffected() > 0 {
		if _, err := sp.Exec(ctx, `UPDATE sims SET renom = renom + $2 WHERE id = $1`, s.ID, game.FeteRenom); err != nil {
			return ""
		}
		if err := logRenom(ctx, sp, s.ID, game.FeteRenom, "fete"); err != nil {
			return ""
		}
		said += fmt.Sprintf(" La famille %s gagne +%d de renommée.", s.LastName, game.FeteRenom)
	} else {
		said += " (La renommée de la fête, c'est une fois par semaine.)"
	}
	if sp.Commit(ctx) != nil {
		return ""
	}
	return said
}

// FeteFamily: a family on the week's podium, with its crest.
type FeteFamily struct {
	Sim        string          `json:"sim"`
	Name       string          `json:"name"`
	LastName   string          `json:"lastName"`
	Generation int             `json:"generation"`
	Gained     int             `json:"gained"`
	Crest      json.RawMessage `json:"crest,omitempty"`
}

// feteWeek: the families that gained the most renom in the week before `until` (the testers left out).
func feteWeek(ctx context.Context, q queryer, until time.Time, n int) ([]FeteFamily, error) {
	rows, err := q.Query(ctx, `
		SELECT s.id, s.first_name, s.last_name, s.generation, sum(l.pts)::int g, s.crest
		FROM renom_log l JOIN sims s ON s.id = l.sim_id JOIN users u ON u.id = s.user_id
		WHERE l.at >= $1 AND l.at < $2 AND NOT u.tester AND NOT s.tested
		GROUP BY s.id ORDER BY g DESC, max(l.at) ASC LIMIT $3`, until.Add(-7*24*time.Hour), until, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FeteFamily{}
	for rows.Next() {
		var f FeteFamily
		var crest []byte
		if err := rows.Scan(&f.Sim, &f.Name, &f.LastName, &f.Generation, &f.Gained, &crest); err != nil {
			return nil, err
		}
		if len(crest) > 0 && string(crest) != "null" {
			f.Crest = crest
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// fetePodium: an ended fête's three families, told once in Babi Direct with their crests (the key written in
// the same transaction), and on their phones.
func (h *Handler) fetePodium(ctx context.Context, o game.Occurrence) error {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `INSERT INTO rendezvous_done (key) VALUES ($1) ON CONFLICT DO NOTHING`, "podium:"+o.Key)
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	top, err := feteWeek(ctx, tx, o.Until, game.FetePodium)
	if err != nil {
		return err
	}
	body := "La Fête des grandes familles est finie. Aucune famille n'a gagné de renommée cette semaine : dimanche prochain, à vous !"
	if len(top) > 0 {
		body = "La Fête des grandes familles : les familles de la semaine !"
		for i, f := range top {
			body += fmt.Sprintf("\n%d. Famille %s (%s), +%d de renommée", i+1, f.LastName, game.GenerationLabel(f.Generation), f.Gained)
		}
	}
	extra, _ := json.Marshal(map[string]any{"familles": top})
	if err := storeDirect(ctx, tx, []directItem{{Key: "rdv:" + o.Key + ":podium", Kind: "rendezvous", Emoji: "👑", Body: body, At: o.Until, Extra: extra}}); err != nil {
		return err
	}
	now := game.MinuteOf(time.Now())
	for i, f := range top {
		text := fmt.Sprintf("Fête des grandes familles : la famille %s est %s de la semaine, avec +%d de renommée !", f.LastName, placeWord(i+1), f.Gained)
		if err := insertEvent(ctx, tx, f.Sim, "social", text, 0, now); err != nil {
			return err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	if h.Push != nil {
		for i, f := range top {
			h.Push.ToSim(f.Sim, push.Message{Title: "Babi Life · Grandes familles", Body: fmt.Sprintf("Ta famille est %s de la semaine à la Fête des grandes familles !", placeWord(i+1)), URL: "/jeu?app=famille", Tag: "fete-" + o.Key})
		}
	}
	return nil
}

// feteCatchUp: the fêtes over in the last day told (on a read: the ranking, Babi Direct, the clock).
func (h *Handler) feteCatchUp(ctx context.Context, now time.Time) {
	if !heritageOpen(ctx) {
		return
	}
	held := rendezHeld(ctx, h.DB)
	i := slices.IndexFunc(held, func(r game.RendezVous) bool { return r.ID == game.FamillesFeteID })
	if i < 0 {
		return
	}
	for _, o := range RendezBetween(ctx, held[i:i+1], now.Add(-rendezPayWithin), now) {
		if !now.Before(o.Until) {
			_ = h.fetePodium(ctx, o)
		}
	}
}

// FeteState: the fête as « Ma famille » shows it: the next one (or the one on), whether the family came this
// week, the week's best families so far.
type FeteState struct {
	Key   string       `json:"key,omitempty"`
	From  time.Time    `json:"from"`
	Until time.Time    `json:"until"`
	Live  bool         `json:"live"`
	Came  bool         `json:"came"`
	Renom int          `json:"renom"`
	Week  []FeteFamily `json:"week"`
}

// feteState: nil when the fête isn't held (the rendez-vous shut, or the team's switch off).
func feteState(ctx context.Context, q queryer, sim string, now time.Time) *FeteState {
	held := rendezHeld(ctx, q)
	i := slices.IndexFunc(held, func(r game.RendezVous) bool { return r.ID == game.FamillesFeteID })
	if i < 0 {
		return nil
	}
	occs := RendezBetween(ctx, held[i:i+1], now, now.Add(8*24*time.Hour))
	if len(occs) == 0 {
		return nil
	}
	o := occs[0]
	st := &FeteState{Key: o.Key, From: o.From, Until: o.Until, Live: o.Live(now), Renom: game.FeteRenom}
	_ = q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM rendezvous_done WHERE key = $1)`, fmt.Sprintf("fete:%s:%s", o.Key, sim)).Scan(&st.Came)
	st.Week, _ = feteWeek(ctx, q, now, game.FetePodium)
	return st
}

// crestsOf: the crests of some Sims (the ranking), by id.
func crestsOf(ctx context.Context, q queryer, ids []string) map[string]json.RawMessage {
	out := map[string]json.RawMessage{}
	rows, err := q.Query(ctx, `SELECT id::text, crest FROM sims WHERE id::text = ANY($1) AND crest IS NOT NULL`, ids)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var c []byte
		if rows.Scan(&id, &c) == nil {
			out[id] = c
		}
	}
	return out
}

// elderGrinNow: the testers' shortcut « heritage-ancien »: the Sim's own elder (still about) says one of the elders'
// words in its home commune's grin at once, as the slot's roll would (elderGrin, heritage2.go), to see it on screen.
func (h *Handler) elderGrinNow(ctx context.Context, sim, user string) {
	if !heritageOpen(ctx) {
		return
	}
	var room string
	var raw []byte
	if h.DB.QueryRow(ctx, `SELECT home_commune, coalesce(life->'famille'->'elders', '[]') FROM sims WHERE id = $1 AND user_id = $2`, sim, user).Scan(&room, &raw) != nil {
		return
	}
	es := worldElders(raw)
	if len(es) == 0 {
		return
	}
	now := time.Now()
	body := game.ElderGrinWords[int(now.Unix())%len(game.ElderGrinWords)]
	key := fmt.Sprintf("ancien:testeur:%s:%d", sim, now.Unix())
	_, _ = h.DB.Exec(ctx, `INSERT INTO grin (room, pnj, pnj_name, body, pnj_key) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (pnj_key) DO NOTHING`, room, ancienPrefix+sim, es[0].Name, body, key)
}
