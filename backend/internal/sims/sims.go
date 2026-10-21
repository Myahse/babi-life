// Package sims stores players' Sims and exposes the actions they can take.
package sims

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/myahse/babi-life/backend/internal/ads"
	"github.com/myahse/babi-life/backend/internal/auth"
	"github.com/myahse/babi-life/backend/internal/court"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
	"github.com/myahse/babi-life/backend/internal/kart"
	"github.com/myahse/babi-life/backend/internal/push"
	"github.com/myahse/babi-life/backend/internal/world"
)

// HomePlaceID is the virtual "Chez toi" place in the Sim's home commune.
const HomePlaceID = "home"

// HappeningPlaceID is whatever is going on in the Sim's commune right now.
const HappeningPlaceID = "happening"

type Look struct {
	Skin        string `json:"skin"`
	Hair        string `json:"hair"`
	HairColor   string `json:"hairColor"`
	Outfit      string `json:"outfit"`
	OutfitColor string `json:"outfitColor"`
	// Added with the new creator; older Sims fall back to defaults in the client.
	Body      string  `json:"body,omitempty"`
	Height    float64 `json:"height,omitempty"`
	Eyes      string  `json:"eyes,omitempty"`
	Beard     string  `json:"beard,omitempty"`
	Accessory string  `json:"accessory,omitempty"`
	Pattern   string  `json:"pattern,omitempty"`
	// Per-part colours; empty means the outfit's own colour.
	BottomColor    string `json:"bottomColor,omitempty"`
	ShoeColor      string `json:"shoeColor,omitempty"`
	AccessoryColor string `json:"accessoryColor,omitempty"`
	// Bumps and bruises: none, pansement, griffures, genou, bagarre.
	Marks string `json:"marks,omitempty"`
	// How worn the clothes are: neuf, use (faded), dechire (torn).
	Wear string `json:"wear,omitempty"`
}

// UnmarshalJSON keeps a look the creator sends. New parts (wear, and whatever
// comes next) must not make Naître fail: unknown keys are kept out of the
// strict request decoder, which would otherwise answer "requête invalide".
func (l *Look) UnmarshalJSON(b []byte) error {
	type plain Look
	var p plain
	if err := json.Unmarshal(b, &p); err != nil {
		return err
	}
	*l = Look(p)
	return nil
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Heights the creator allows, in metres, and the model's height at scale 1.
const (
	MinHeight = 1.40
	MaxHeight = 2.50
)

func baseHeight(gender string) float64 {
	if gender == "homme" {
		return 1.76
	}
	return 1.65
}

func (l Look) validate(gender string) error {
	if m := l.Height * baseHeight(gender); l.Height != 0 && (m < MinHeight-0.005 || m > MaxHeight+0.005) {
		return errors.New("taille invalide : entre 1,40 m et 2,50 m")
	}
	for _, c := range []string{l.Skin, l.HairColor, l.OutfitColor, l.Eyes, l.BottomColor, l.ShoeColor, l.AccessoryColor} {
		if c != "" && !hexColor.MatchString(c) {
			return errors.New("couleur invalide")
		}
	}
	switch l.Wear {
	case "", "neuf", "use", "dechire":
	default:
		return errors.New("usure invalide")
	}
	return validAccessories(l.Accessory)
}

// The accessories and where each goes on the body (web/src/avatar/options.ts,
// ACCESSORY_SLOT): several can be worn, one per place, five at most.
var accessorySlot = map[string]string{
	"cap": "head", "capback": "head", "beanie": "head", "hat": "head", "buckethat": "head", "bandana": "head", "headphones": "head", "kufi": "head",
	"glasses": "eyes", "sunglasses": "eyes",
	"earrings": "ears",
	"chain":    "neck", "beads": "neck", "croix": "neck", "chapelet": "hand",
	"watch": "wrist",
	"bag":   "bag",
}

const maxAccessories = 5

// validAccessories: « none », one accessory, or a list « glasses,bag,watch ».
func validAccessories(s string) error {
	if s == "" || s == "none" {
		return nil
	}
	parts := strings.Split(s, ",")
	if len(parts) > maxAccessories {
		return fmt.Errorf("%d accessoires au plus", maxAccessories)
	}
	used := map[string]bool{}
	for _, a := range parts {
		slot, ok := accessorySlot[a]
		if !ok {
			return errors.New("accessoire inconnu")
		}
		if used[slot] {
			return errors.New("un seul accessoire par endroit (tête, yeux, cou…)")
		}
		used[slot] = true
	}
	return nil
}

type Sim struct {
	ID          string     `json:"id"`
	FirstName   string     `json:"firstName"`
	LastName    string     `json:"lastName"`
	Gender      string     `json:"gender"`
	Look        Look       `json:"look"`
	Traits      []string   `json:"traits"`
	Aspiration  string     `json:"aspiration"`
	HomeCity    string     `json:"homeCity"`
	HomeCommune string     `json:"homeCommune"`
	City        string     `json:"city"`
	Commune     string     `json:"commune"`
	Needs       game.Needs `json:"needs"`
	Money       int        `json:"money"`
	GameMinutes int64      `json:"gameMinutes"`
	Origin      string     `json:"origin"`
	Housing     string     `json:"housing"`
	// Furnished: the furniture in the house the Sim built (game.Furnitures), for when it lives there.
	Furnished []string `json:"furnished"`
	// Stay: a hotel room or a home rented away from home (sims/hotel.go), while it lasts.
	Stay        *Stay  `json:"stay,omitempty"`
	Loan        int    `json:"loan"`
	RentArrears int    `json:"rentArrears"`
	Career      string `json:"career"`
	CareerLevel int    `json:"careerLevel"`
	Performance int    `json:"performance"`
	// Activity is what the Sim is busy with right now; nil when free.
	Activity *game.Activity `json:"activity"`
	// Apps installed on the phone (world.PhoneApps).
	Apps []string `json:"apps"`
	// BornAt: game minute of birth (0 = an adult from before births).
	BornAt int64 `json:"bornAt"`
	// Family the Sim was born into (game.Families); "" for older Sims.
	Family string `json:"family"`
	// People the Sim knows; the street gang ("", invited, member, left); arrests.
	Friends   []game.Friend `json:"friends"`
	Gang      string        `json:"gang"`
	Record    int           `json:"record"`
	CreatedAt time.Time     `json:"createdAt"`
	lastTick  time.Time
	// gymUntil: the game minute the gym membership runs out (0: none), read from the journal (gym.go).
	gymUntil int64
}

type Event struct {
	ID       int64     `json:"id"`
	Kind     string    `json:"kind"`
	Text     string    `json:"text"`
	Money    int       `json:"money"`
	GameTime int64     `json:"gameTime"`
	At       time.Time `json:"at"`
	// moment: a big moment for Babi Direct (babidirect.go), posted once it's saved.
	moment *directItem
}

func (s *Sim) state() game.State {
	return game.State{Needs: s.Needs, Money: s.Money, GameMinutes: s.GameMinutes}
}

func (s *Sim) setState(st game.State) {
	s.Needs, s.Money, s.GameMinutes = st.Needs, st.Money, st.GameMinutes
}

func (s *Sim) housing() game.Housing {
	if s.Housing == game.OwnHouse {
		// One's own house: no rent, as comfortable as what is in it.
		return game.Housing{ID: game.OwnHouse, Label: "Ma maison", Icon: "house", Comfort: game.HomeComfort(s.Furnished)}
	}
	h, _ := game.FindHousing(s.Housing)
	return h
}

func furnishedOrEmpty(f []string) []string {
	if f == nil {
		return []string{}
	}
	return f
}

type Handler struct {
	DB *pgxpool.Pool
	// Karts: the grids of Babi Karting (players racing each other).
	Karts *kart.Lobby
	// Courts: the matches at the football pitches and basketball courts (players together).
	Courts *court.Lobby
	// RealPhotos: stories may be photos from the phone, not only from the game (STORIES_REAL_PHOTOS).
	RealPhotos bool
	// Push: notifications to the players' phones (a Gbairai message, a bet over); nil: none.
	Push *push.Service
	// Bucket: where the phone's photos go (photos.go); not set up: in the database.
	Bucket *ads.Bucket
	// Online: how many players are connected now (the live hub); nil in tests.
	Online func() int
}

func (h *Handler) Routes(r chi.Router) {
	r.Get("/sims", h.list)
	r.Post("/sims", h.create)
	r.Get("/sims/{id}", h.get)
	r.Delete("/sims/{id}", h.delete)
	r.Post("/sims/{id}/interact", h.interact)
	r.Post("/sims/{id}/outing", h.outing)
	r.Post("/sims/{id}/moto", h.moto)
	r.Post("/sims/{id}/travel", h.travel)
	r.Post("/sims/{id}/career", h.career)
	r.Post("/sims/{id}/move", h.move)
	r.Post("/sims/{id}/repay", h.repay)
	r.Post("/sims/{id}/look", h.changeLookHandler)
	r.Post("/sims/{id}/stop", h.stopActivity)
	r.Post("/sims/{id}/tester", h.tester)
	r.Post("/sims/{id}/apps", h.apps)
	r.Post("/sims/{id}/send", h.send)
	r.Post("/sims/{id}/order", h.order)
	r.Post("/sims/{id}/street", h.street)
	r.Post("/sims/{id}/robbed", h.robbed)
	r.Post("/sims/{id}/chat", h.chatHandler)
	r.Post("/sims/{id}/friend", h.friend)
	r.Post("/sims/{id}/gang", h.gang)
	r.Get("/sims/{id}/gbairai", h.chats)
	r.Get("/sims/{id}/gbairai/{other}", h.thread)
	r.Get("/sims/{id}/gbairai/{other}/typing", h.typing)
	r.Post("/sims/{id}/gbairai/{other}", h.write)
	r.Post("/sims/{id}/gbairai/{other}/block", h.block)
	r.Post("/sims/{id}/gbairai/{other}/report", h.report)
	r.Get("/bets/rounds", h.betRounds)
	r.Get("/loto/draws", h.lotoDraws)
	r.Post("/sims/{id}/loto", h.buyLoto)
	r.Get("/sims/{id}/loto", h.myLoto)
	r.Post("/sims/{id}/bets", h.placeBet)
	r.Post("/sims/{id}/bets/settle", h.settleBets)
	r.Get("/sims/{id}/bets", h.myBets)
	r.Get("/sims/{id}/grin", h.grin)
	r.Post("/sims/{id}/grin", h.sayGrin)
	r.Post("/sims/{id}/grin/{msg}/report", h.reportGrin)
	r.Get("/sims/{id}/grin/direct", h.directFeed)
	r.Post("/sims/{id}/grin/direct/{post}/react", h.reactDirect)
	r.Get("/sims/{id}/stories", h.stories)
	r.Post("/sims/{id}/stories", h.postStory)
	r.Get("/sims/{id}/stories/{story}/photo", h.storyPhoto)
	r.Delete("/sims/{id}/stories/{story}", h.deleteStory)
	r.Post("/sims/{id}/stories/{story}/report", h.reportStory)
	r.Get("/sims/{id}/emotes", h.emoteList)
	r.Post("/sims/{id}/emotes/{emote}", h.emoteBuy)
	r.Get("/sims/{id}/photos", h.photoList)
	r.Post("/sims/{id}/photos", h.photoTake)
	r.Get("/sims/{id}/photos/{photo}/raw", h.photoRaw)
	r.Delete("/sims/{id}/photos/{photo}", h.photoDelete)
	r.Get("/sims/{id}/tiki", h.tikiFeed)
	r.Get("/sims/{id}/tiki/me", h.tikiMe)
	r.Post("/sims/{id}/tiki", h.tikiPost)
	r.Get("/sims/{id}/tiki/{post}/photo", h.tikiPhoto)
	r.Get("/sims/{id}/tiki/{post}/video", h.tikiVideo)
	r.Post("/sims/{id}/tiki/{post}/like", h.tikiLike)
	r.Post("/sims/{id}/tiki/{post}/report", h.tikiReport)
	r.Delete("/sims/{id}/tiki/{post}", h.tikiDelete)
	r.Post("/sims/{id}/tiki/follow/{other}", h.tikiFollow)
	r.Get("/sims/{id}/tiki/profile/{other}", h.tikiProfile)
	r.Get("/sims/{id}/tiki/{post}/comments", h.tikiComments)
	r.Post("/sims/{id}/tiki/{post}/comments", h.tikiComment)
	r.Post("/sims/{id}/tiki/{post}/save", h.tikiSave)
	r.Post("/sims/{id}/tiki/{post}/share", h.tikiShare)
	r.Delete("/sims/{id}/tiki/comments/{comment}", h.tikiUncomment)
	r.Post("/sims/{id}/tiki/comments/{comment}/like", h.tikiCommentLike)
	r.Post("/sims/{id}/tiki/comments/{comment}/report", h.tikiCommentReport)
	r.Get("/sims/{id}/gram", h.gramFeed)
	r.Post("/sims/{id}/gram", h.gramPost)
	r.Get("/sims/{id}/gram/activity", h.gramActivity)
	r.Get("/sims/{id}/gram/search", h.gramSearch)
	r.Put("/sims/{id}/gram/bio", h.gramBio)
	r.Get("/sims/{id}/gram/profile/{other}", h.gramProfile)
	r.Post("/sims/{id}/gram/follow/{other}", h.gramFollow)
	r.Get("/sims/{id}/gram/{post}/photo", h.gramPhoto)
	r.Post("/sims/{id}/gram/{post}/like", h.gramToggle("gram_likes"))
	r.Post("/sims/{id}/gram/{post}/save", h.gramToggle("gram_saves"))
	r.Post("/sims/{id}/gram/{post}/share", h.gramShare)
	r.Post("/sims/{id}/gram/{post}/report", h.gramReport)
	r.Delete("/sims/{id}/gram/{post}", h.gramDelete)
	r.Get("/sims/{id}/gram/{post}/comments", h.gramComments)
	r.Post("/sims/{id}/gram/{post}/comments", h.gramComment)
	r.Delete("/sims/{id}/gram/comments/{comment}", h.gramUncomment)
	r.Post("/sims/{id}/gram/comments/{comment}/like", h.gramCommentLike)
	r.Post("/sims/{id}/gram/comments/{comment}/report", h.gramCommentReport)
	r.Get("/sims/{id}/around", h.around)
	r.Get("/sims/{id}/plot", h.plot)
	r.Put("/sims/{id}/plot", h.build)
	r.Get("/sims/{id}/plots", h.plots)
	r.Get("/sims/{id}/lots", h.lotOffers)
	r.Post("/sims/{id}/lot", h.buyLot)
	r.Post("/sims/{id}/lot/sell", h.sellLot)
	r.Get("/sims/{id}/hotel/{place}", h.hotel)
	r.Post("/sims/{id}/hotel/{place}/book", h.bookRoom)
	r.Post("/sims/{id}/stay/end", h.endStay)
	r.Post("/sims/{id}/billets", h.billets)
	r.Get("/sims/{id}/dodo", h.dodo)
	r.Post("/sims/{id}/dodo/book", h.dodoBook)
	r.Post("/sims/{id}/dodo/list", h.dodoList)
	r.Post("/sims/{id}/dodo/unlist", h.dodoUnlist)
	r.Post("/sims/{id}/plot/movein", h.moveIn)
	r.Post("/sims/{id}/plot/plan", h.buildPlan)
	r.Post("/sims/{id}/meet", h.meet)
	r.Post("/sims/{id}/kart/join", h.kartJoin)
	r.Get("/kart/{race}", h.kartRace)
	r.Post("/sims/{id}/court/join", h.courtJoin)
	r.Get("/court/{match}", h.courtMatch)
	r.Post("/sims/{id}/court/{match}/leave", h.courtLeave)
	r.Get("/court/at/{place}", h.courtAt)
	r.Post("/sims/{id}/friends/{other}/answer", h.answerFriend)
	r.Post("/sims/{id}/friends/{other}/invite", h.inviteFriend)
	r.Post("/sims/{id}/friends/{other}/couple", h.couple)
	r.Post("/sims/{id}/invites/{invite}", h.answerInvite)
}

const simColumns = `id, first_name, last_name, gender, look, traits, aspiration,
	home_city, home_commune, city, commune, needs, money, game_minutes,
	origin, housing, loan, rent_arrears, career, career_level, performance, activity, apps, born_at, family, friends, gang, record, created_at, last_tick, furnished, stay`

func scanSim(row pgx.Row) (Sim, error) {
	var s Sim
	err := row.Scan(&s.ID, &s.FirstName, &s.LastName, &s.Gender, &s.Look, &s.Traits, &s.Aspiration,
		&s.HomeCity, &s.HomeCommune, &s.City, &s.Commune, &s.Needs, &s.Money, &s.GameMinutes,
		&s.Origin, &s.Housing, &s.Loan, &s.RentArrears, &s.Career, &s.CareerLevel, &s.Performance, &s.Activity, &s.Apps, &s.BornAt, &s.Family, &s.Friends, &s.Gang, &s.Record, &s.CreatedAt, &s.lastTick, &s.Furnished, &s.Stay)
	return s, err
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(),
		`SELECT `+simColumns+` FROM sims WHERE user_id = $1 ORDER BY created_at`, auth.UserID(r.Context()))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load sims")
		return
	}
	out, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Sim, error) { return scanSim(row) })
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load sims")
		return
	}
	now := time.Now()
	for i := range out {
		out[i].advance(now, newRand()) // preview only; saved on the next request for that Sim
	}
	httpx.JSON(w, http.StatusOK, out)
}

type createRequest struct {
	FirstName  string   `json:"firstName"`
	LastName   string   `json:"lastName"`
	Gender     string   `json:"gender"`
	Look       Look     `json:"look"`
	Traits     []string `json:"traits"`
	Aspiration string   `json:"aspiration"`
	// Ignored: nobody chooses where they're born.
	HomeCity    string `json:"homeCity,omitempty"`
	HomeCommune string `json:"homeCommune,omitempty"`
	// Where the player really is, if they share it: the Sim is born in the
	// nearest commune. Only that commune is kept, never the coordinates.
	Lat *float64 `json:"lat,omitempty"`
	Lng *float64 `json:"lng,omitempty"`
	// From abroad (or without a position): the commune the player says they
	// come from (« city »/« commune » ids); none: one is drawn at random.
	FromCity    string `json:"fromCity,omitempty"`
	FromCommune string `json:"fromCommune,omitempty"`
}

// MaxBirthKm: further than this from every commune of the game (abroad, in
// the bush), the Sim is born somewhere in Abidjan.
const MaxBirthKm = 30

// birthplace: where the Sim is born. In the country, the commune nearest
// the player; from abroad (or without a position), the commune they say
// they come from; otherwise any commune of the game, drawn at random (each
// has its villas and its precarious quarters).
func birthplace(lat, lng *float64, fromCity, fromCommune string, rng *rand.Rand) (city, commune string) {
	if lat != nil && lng != nil {
		if c, cm, ok := world.Nearest(*lat, *lng, MaxBirthKm); ok {
			return c.ID, cm.ID
		}
	}
	if c, ok := world.FindCity(fromCity); ok {
		if _, ok := c.Commune(fromCommune); ok {
			return c.ID, fromCommune
		}
	}
	var all [][2]string
	for _, c := range world.Cities {
		for _, cm := range c.Communes {
			all = append(all, [2]string{c.ID, cm.ID})
		}
	}
	pick := all[rng.IntN(len(all))]
	return pick[0], pick[1]
}

func (req *createRequest) validate() error {
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	switch {
	case req.FirstName == "" || len(req.FirstName) > 40:
		return errors.New("prénom invalide")
	case req.LastName == "" || len(req.LastName) > 40:
		return errors.New("nom invalide")
	case req.Gender != "femme" && req.Gender != "homme":
		return errors.New("genre invalide")
	case req.Look.Skin == "" || req.Look.Hair == "" || req.Look.Outfit == "":
		return errors.New("apparence incomplète")
	case req.Look.validate(req.Gender) != nil:
		return req.Look.validate(req.Gender)
	case len(req.Traits) == 0 || len(req.Traits) > game.MaxTraits:
		return fmt.Errorf("choisis entre 1 et %d traits", game.MaxTraits)
	case !game.ValidOption(game.Aspirations, req.Aspiration):
		return errors.New("aspiration invalide")
	}
	seen := map[string]bool{}
	for _, t := range req.Traits {
		if !game.ValidOption(game.Traits, t) || seen[t] {
			return errors.New("trait invalide")
		}
		seen[t] = true
	}
	return nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if err := req.validate(); err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	// Like in real life, nobody picks where they start: a baby, born into a
	// family drawn at random, where the player is.
	rng := newRand()
	fam := game.BornInto(rng)
	cityID, commune := birthplace(req.Lat, req.Lng, req.FromCity, req.FromCommune, rng)
	now := game.MinuteOf(time.Now())
	s, err := scanSim(h.DB.QueryRow(r.Context(), `
		INSERT INTO sims (user_id, first_name, last_name, gender, look, traits, aspiration,
		                  home_city, home_commune, city, commune, money, needs, game_minutes,
		                  origin, housing, loan, born_at, family, apps)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $13, $8, $13, $8, 0, $9, $10, '', $11, 0, $10, $12, '{}')
		RETURNING `+simColumns,
		auth.UserID(r.Context()), req.FirstName, req.LastName, req.Gender, req.Look, req.Traits, req.Aspiration,
		commune, game.FreshNeeds(), now, fam.Housing, fam.ID, cityID,
	))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create sim")
		return
	}
	city, _ := world.FindCity(s.HomeCity)
	cm, _ := city.Commune(s.HomeCommune)
	_ = insertEvent(r.Context(), h.DB, s.ID, "random", fmt.Sprintf("%s est %s %s, dans %s, d'une famille %s. %s", s.FirstName, bornWord(s.Gender, "né", "née"), inCommune(cm.Name), fam.Sector, strings.ToLower(fam.Label), fam.Hint), 0, s.GameMinutes)
	h.postMoments(r.Context(), []directItem{birthMoment(s)})
	httpx.JSON(w, http.StatusCreated, s)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	// Reading a Sim lets real time pass for it, so it is saved like an action.
	h.mutate(w, r, nil)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	tag, err := h.DB.Exec(r.Context(), `DELETE FROM sims WHERE id = $1 AND user_id = $2`, chi.URLParam(r, "id"), auth.UserID(r.Context()))
	if err != nil || tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// actionResult is returned by every read and action on a Sim.
type actionResult struct {
	Sim     Sim          `json:"sim"`
	Outcome game.Outcome `json:"outcome"`
	Journal []Event      `json:"journal"`
	// Fresh are the journal lines produced by this request: activities that
	// ended, surprises, Saturday bills. The client announces them.
	Fresh []Event `json:"fresh"`
}

func (h *Handler) interact(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PlaceID       string `json:"placeId"`
		InteractionID string `json:"interactionId"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}

	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		until, err := gymMembership(r.Context(), tx, s.ID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		s.gymUntil = until
		if req.InteractionID == game.NightID {
			if adult, err := accountAdult(r.Context(), tx); err != nil || !adult {
				return game.Outcome{}, nil, errNotAdult
			}
		}
		it, err := s.interactAt(req.PlaceID, req.InteractionID)
		if err != nil {
			return game.Outcome{}, nil, err
		}
		if err := h.courtTake(s, req.PlaceID, it); err != nil {
			return game.Outcome{}, nil, err
		}
		text := fmt.Sprintf("%s : %s (%s)", s.FirstName, it.Label, humanMinutes(game.Length(it.Minutes)))
		return game.Outcome{Text: text, Money: -max(it.Cost, 0)}, gymEvents(s, it), nil
	})
}

// interactAt: start an interaction at a place of the Sim's commune (or at
// home, or at the happening in the street).
func (s *Sim) interactAt(placeID, interactionID string) (game.Interaction, error) {
	var kind game.PlaceKind
	// A place of worship's faith: the mass, the culte, the Friday prayer are held at their own.
	faith := ""
	home := placeID == HomePlaceID
	if placeID == HappeningPlaceID {
		h, _, ok := game.HappeningAt(s.City, s.Commune, s.GameMinutes)
		if !ok || h.Join == nil || interactionID != game.JoinHappeningID {
			return game.Interaction{}, errors.New("c'est fini, il n'y a plus rien ici")
		}
		kind = h.Kind()
		kind.Interactions = []game.Interaction{*h.Join}
	} else if placeID == StayPlaceID {
		// A home booked on Dodo (dodo.go).
		k, _, err := s.atStay()
		if err != nil {
			return game.Interaction{}, err
		}
		kind = k
	} else if home {
		if s.City != s.HomeCity || s.Commune != s.HomeCommune {
			return game.Interaction{}, errors.New("rentre d'abord chez toi")
		}
		kind = game.Kinds["home"]
	} else {
		city, cm, place, ok := world.FindPlace(placeID)
		if !ok {
			return game.Interaction{}, errors.New("lieu inconnu")
		}
		if city.ID != s.City || cm.ID != s.Commune {
			return game.Interaction{}, fmt.Errorf("va d'abord %s", inCommune(cm.Name))
		}
		kind = game.Kinds[place.Kind]
		faith = place.Faith
	}
	var it game.Interaction
	var job game.Career
	if interactionID == game.WorkInteractionID {
		c, ok := game.FindCareer(s.Career)
		if !ok {
			return game.Interaction{}, errors.New("tu n'as pas de travail. Ouvre l'appli Boulot")
		}
		if !c.WorksAt(kind.ID) {
			return game.Interaction{}, errors.New("ce n'est pas ton lieu de travail")
		}
		job, it = c, c.Shift(s.CareerLevel)
	} else {
		var ok bool
		if it, ok = kind.Interaction(interactionID); !ok {
			return game.Interaction{}, errors.New("action inconnue")
		}
		if len(it.Places) > 0 && !slices.Contains(it.Places, placeID) {
			return game.Interaction{}, errors.New("pas possible ici")
		}
		if len(it.Faiths) > 0 && !slices.Contains(it.Faiths, faith) {
			return game.Interaction{}, errors.New("ce n'est pas célébré ici")
		}
		if home {
			if it.ID == game.NightID {
				p := s.partner()
				if p == nil || !p.Home {
					return game.Interaction{}, errors.New("il faut que ta moitié vive avec toi (propose-lui d'emménager)")
				}
				it.Label = "Passer la nuit avec " + p.Name
				p.Friendship = min(100, p.Friendship+5)
			}
			// In one's own house, sleeping takes a bed, cooking a stove…
			if it.ID == game.SwimID {
				if why := game.CanSwimAtHome(s.Housing, s.Furnished); why != "" {
					return game.Interaction{}, errors.New(why)
				}
			}
			if s.Housing == game.OwnHouse {
				if need := game.HomeNeeds(it.ID, s.Furnished); need != "" {
					return game.Interaction{}, fmt.Errorf("il te manque : %s (à poser chez toi : appli Logement, Ma maison)", need)
				}
			}
			it = s.housing().AtHome(it)
		}
		if kind.ID == game.StadiumKind {
			var err error
			if it, err = game.AtStadium(placeID, it, s.GameMinutes); err != nil {
				return game.Interaction{}, err
			}
		}
		if kind.ID == "gym" {
			var err error
			if it, err = s.atGym(it); err != nil {
				return game.Interaction{}, err
			}
		}
	}

	// Old enough? Then: residents only, enough money, the right trait or job.
	if err := it.AllowedFor(s.stage().ID); err != nil {
		return game.Interaction{}, err
	}
	if it.Gender != "" && it.Gender != s.Gender {
		return game.Interaction{}, errors.New("pas pour toi")
	}
	// In a room one has rented here (hotel.go), and only while the stay lasts.
	if it.Stay && !s.staysAt(placeID) {
		return game.Interaction{}, errNoRoom
	}
	// Who may do it: residents only, enough money, the right trait or job.
	if err := it.Requires.Check(game.Who{Resident: s.City == s.HomeCity && s.Commune == s.HomeCommune, Money: s.Money, Traits: s.Traits, Career: s.Career}); err != nil {
		return game.Interaction{}, err
	}

	placeName := kind.Label
	switch {
	case home:
		placeName = "Chez toi"
	case placeID == HappeningPlaceID:
		placeName = kind.Label
	case placeID == StayPlaceID:
		_, placeName, _ = s.atStay()
	default:
		if _, _, place, ok := world.FindPlace(placeID); ok {
			placeName = place.Name
		}
	}
	if err := s.start(it, placeID, kind.ID, placeName, kind.Events, job.ID); err != nil {
		return game.Interaction{}, err
	}
	s.restyle(it.ID)
	return it, nil
}

// restyle: a visit to the barbier or the salon changes the Sim's hair.
func (s *Sim) restyle(interaction string) {
	h, ok := game.Hairdos[interaction]
	if !ok {
		return
	}
	if h.Hair != "" {
		s.Look.Hair = h.Hair
	}
	if h.Beard != "" {
		s.Look.Beard = h.Beard
	}
}

func humanMinutes(m int64) string {
	switch {
	case m < 60:
		return fmt.Sprintf("%d min", m)
	case m%60 == 0:
		return fmt.Sprintf("%d h", m/60)
	default:
		return fmt.Sprintf("%d h %02d", m/60, m%60)
	}
}

func (h *Handler) stopActivity(w http.ResponseWriter, r *http.Request) {
	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		ev, err := s.stop()
		if err != nil {
			return game.Outcome{}, nil, err
		}
		return game.Outcome{Text: ev.Text, Money: ev.Money}, []Event{ev}, nil
	})
}

func (h *Handler) travel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		City    string `json:"city"`
		Commune string `json:"commune"`
		// App: "woro", "compteur" or a ride app ("gnango", "idrive"); empty = the
		// usual street taxi, or the car between cities.
		App   string `json:"app,omitempty"`
		Class string `json:"class,omitempty"` // the kind of car, on an app that has them
		Offer int    `json:"offer,omitempty"`
		Party int    `json:"party,omitempty"` // the Sim plus friends riding along
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	toCity, ok := world.FindCity(req.City)
	if !ok {
		httpx.Error(w, http.StatusUnprocessableEntity, "ville inconnue")
		return
	}
	toCommune, ok := toCity.Commune(req.Commune)
	if !ok {
		httpx.Error(w, http.StatusUnprocessableEntity, "commune inconnue")
		return
	}

	h.mutate(w, r, func(s *Sim) (game.Outcome, []Event, error) {
		if app, ok := world.FindRideApp(req.App); ok && !s.hasApp(app.ID) {
			return game.Outcome{}, nil, fmt.Errorf("installe d'abord %s depuis le Store", app.Name)
		}
		if err := s.leaveWith(toCity, toCommune, Ride{App: req.App, Class: req.Class, Offer: req.Offer, Party: req.Party}, newRand()); err != nil {
			return game.Outcome{}, nil, err
		}
		t := s.Activity.Trip
		text := fmt.Sprintf("%s (%s)", t.Label, humanMinutes(s.Activity.Interaction.Minutes))
		if t.Incident != "" {
			text += " · " + t.Incident
		}
		return game.Outcome{Text: text, Money: -t.Fare}, nil, nil
	})
}

// mutate loads the Sim under a row lock, lets time pass, applies fn and saves
// the result together with the journal entries it produced.
func (h *Handler) mutate(w http.ResponseWriter, r *http.Request, fn func(*Sim) (game.Outcome, []Event, error)) {
	var wrapped func(*Sim, pgx.Tx) (game.Outcome, []Event, error)
	if fn != nil {
		wrapped = func(s *Sim, _ pgx.Tx) (game.Outcome, []Event, error) { return fn(s) }
	}
	h.mutateTx(w, r, wrapped)
}

// mutateTx: like mutate, for actions that also write other rows. They must go
// through tx: the Sim's row is locked until it commits.
func (h *Handler) mutateTx(w http.ResponseWriter, r *http.Request, fn func(*Sim, pgx.Tx) (game.Outcome, []Event, error)) {
	ctx := r.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer tx.Rollback(ctx)

	s, err := scanSim(tx.QueryRow(ctx,
		`SELECT `+simColumns+` FROM sims WHERE id = $1 AND user_id = $2 FOR UPDATE`, chi.URLParam(r, "id"), auth.UserID(ctx)))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	// Real time passes first, so the action sees the real state.
	fresh := s.advance(time.Now(), newRand())
	// Bets and loto tickets that are over pay out.
	won, err := settle(ctx, tx, &s)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	fresh = append(fresh, won...)
	var out game.Outcome
	if fn != nil {
		var events []Event
		var err error
		if out, events, err = fn(&s, tx); err != nil {
			httpx.Error(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		fresh = append(fresh, events...)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE sims SET city = $2, commune = $3, needs = $4, money = $5, game_minutes = $6, last_tick = $7,
		       home_city = $8, home_commune = $9, housing = $10, loan = $11, rent_arrears = $12,
		       career = $13, career_level = $14, performance = $15, activity = $16, apps = $17,
		       friends = $18, gang = $19, record = $20, look = $21, born_at = $22, family = $23, furnished = $24, stay = $25
		WHERE id = $1`, s.ID, s.City, s.Commune, s.Needs, s.Money, s.GameMinutes, s.lastTick,
		s.HomeCity, s.HomeCommune, s.Housing, s.Loan, s.RentArrears, s.Career, s.CareerLevel, s.Performance, s.Activity, s.Apps,
		friendsOrEmpty(s.Friends), s.Gang, s.Record, s.Look, s.BornAt, s.Family, furnishedOrEmpty(s.Furnished), s.Stay); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save sim")
		return
	}
	for i, ev := range fresh {
		if err := tx.QueryRow(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
			s.ID, ev.Kind, ev.Text, ev.Money, ev.GameTime).Scan(&fresh[i].ID, &fresh[i].At); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not save journal")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save sim")
		return
	}
	var moments []directItem
	for _, ev := range fresh {
		if ev.moment != nil {
			moments = append(moments, *ev.moment)
		}
	}
	h.postMoments(ctx, moments)

	journal, _ := h.journal(ctx, s.ID)
	if fresh == nil {
		fresh = []Event{}
	}
	httpx.JSON(w, http.StatusOK, actionResult{Sim: s, Outcome: out, Journal: journal, Fresh: fresh})
}

type execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func insertEvent(ctx context.Context, db execer, simID, kind, text string, money int, gameTime int64) error {
	_, err := db.Exec(ctx, `INSERT INTO sim_events (sim_id, kind, text, money, game_time) VALUES ($1, $2, $3, $4, $5)`,
		simID, kind, text, money, gameTime)
	return err
}

func (h *Handler) journal(ctx context.Context, simID string) ([]Event, error) {
	rows, err := h.DB.Query(ctx, `
		SELECT id, kind, text, money, game_time, created_at FROM sim_events
		WHERE sim_id = $1 ORDER BY id DESC LIMIT 30`, simID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Event, error) {
		var e Event
		err := row.Scan(&e.ID, &e.Kind, &e.Text, &e.Money, &e.GameTime, &e.At)
		return e, err
	})
}
