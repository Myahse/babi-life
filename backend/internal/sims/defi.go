package sims

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
	"github.com/myahse/babi-life/backend/internal/httpx"
)

// Les défis (web components/Defi.tsx): while doing some things, the player can
// take them on as a little game with an action button: the tea made at the
// grin (poured from high for the foam, three glasses), water-skiing round the
// buoys off Île Boulay, the shopping list at the supermarket or the boutique,
// the games of the salle de jeux vidéo (foot, the car race, the fighting game,
// the arcade's mosquitoes).
// The challenge where the loser pays is played for its stake (won: the other's
// stake too), the Saturday tournament for its prizes; a made-up score there buys
// a few thousand francs at most, once a game paid for (the tournament once a week).
// The phone plays it and sends the score (0–100). What it earns is small, a
// bonus on the activity (a better mood, some money saved on the shopping), so
// a score made up buys little. Once each time; the best score of each défi is
// kept, a record to beat.

// defiFor: each défi, and the interactions it's played during.
var defiFor = map[string][]string{
	// The tea one makes oneself, with the boys at the grin (the pousse-pousse's is served: no défi).
	"the":     {"street-grin", "chat-grin"},
	"ski":     {"ski-boulay"},
	"courses": {"supermarche", "courses"},
	"foot":    {"console-foot", "console-defi", "tournoi-console", "maison-foot"},
	"course":  {"console-course", "maison-course"},
	"combat":  {"console-combat", "maison-combat"},
	"arcade":  {"borne-arcade"},
	// The maître's lesson, at school (the update « ecole-vivante »).
	"ecole": {"aller-ecole"},
	// The baby's games (the update « bebe-jeux »).
	"coucou": {"coucou"},
	"cubes":  {"cubes"},
	"pas":    {"premiers-pas"},
	"hochet": {"hochet"},
	// The baby fight (the update « bagarre-bebe »).
	"bagarre": {"bagarre-bebe"},
	// The home's everyday things played as combos (the update « gestes-maison »): done, the action is done.
	// (The meal: whatever is eaten from the fridge, game.FromFridgePrefix.)
	"douche":  {"shower"},
	"cuisine": {"cook-attieke"},
	"repas":   {},
	"dodo":    {"sleep", "nap", "chambre-dormir", "logement-dormir", "nuit-hotel"},
	"cour":    {"jouer-cour"},
	// The baby's day, played too.
	"biberon":  {"biberon"},
	"bouillie": {"bouillie"},
	"bain":     {"bain-bebe"},
	"calin":    {"calin"},
	"caca":     {"caca"},
	"pipi":     {"pipi"},
	"vomir":    {"vomir"},
	"pleurer":  {"pleurer"},
	// The street food, played its own way: the fish fished out of the oil, the alloco caught in its paper.
	"garba":  {"eat-garba", "street-garba"},
	"alloco": {"eat-alloco", "street-alloco"},
	// The pot with the friends at the maquis: sat at the table, drinking, served again, the banknotes
	// thrown, and the alcohol to watch (web components/defi/Bar.tsx).
	"bar": {"drink-with-friends"},
	// The street's jam regulated at the junction (the update « circulation », jam.go).
	"circulation": {game.RegulateTrafficID},
	// The street's happenings, each choice played (the update « evenements-joues », evenements.go).
	"evenement": game.HappeningChoiceIDs(),
}

// The jam regulated: what the drivers slip the volunteer, played well and perfectly.
const (
	circulationTip     = 500
	circulationTipBest = 1500
)

// homeDefis: the home's gestures, behind the update « gestes-maison »: their score is the action itself.
var homeDefis = []string{"douche", "cuisine", "repas", "dodo", "cour", "biberon", "bouillie", "bain", "calin", "caca", "pipi", "vomir", "pleurer", "garba", "alloco", "bar"}

// The bar (the « bar » défi's extra « tournees:N;billets:M;soul »): a round served again, the banknotes
// thrown at most, and what being drunk costs.
const (
	barRound   = 500
	barRounds  = 6
	barBillets = 20000
)

var barDrunk = game.Needs{Energy: -25, Hygiene: -10}

// The alloco's egg (the alloco défi's extra « oeuf »): what it costs, what it fills.
const (
	allocoEgg     = 100
	allocoEggFill = 12
)

// gesteNot: the activities with a screen of their own (the slot machine, the banknotes thrown, the night
// together's fade to black): not played as gestures.
// playedHold: how long an action that's played waits for its game (game minutes): a day.
const playedHold = 24 * 60

// playedNoClock: the actions are played, not timed (the update « gestes-maison » open with the players).
// Without a store (the tests, a database-less run) the clock stays: what they check is the clock.
func playedNoClock() bool {
	return features.Default != nil && features.Default.BlocksKey(context.Background(), "gestes-maison") == ""
}

var gesteNot = []string{game.SlotsMaquisID, game.SlotsCasinoID, game.NightID, "petit-travaillement", "travaillement", "grand-travaillement", "aller-ecole", "creche",
	// The matches on the courts and in the street (their own 3D match, web streetball/), the clothes shops (their own shop).
	"play-basket", "street-basket", "play-football", "play-foot11", "street-foot", "boutique-mode", "boutique-wax",
	// The karting race (its own 3D race), the baby's choices (their own sheet), the shopping for the fridge (its sheet, while it lasts).
	"course-kart", "jouets", "premier-mot", "buy-food"}

// gesteNotLabels: the street happenings joined that are a match of their own (the neighbourhood foot, the basket tournament).
var gesteNotLabels = []string{"Jouer avec eux", "Jouer un match"}

// gesteOK: whether an activity with no défi of its own is played (the update « gestes-maison »: every
// action is a game, nothing waits on a clock any more; web components/defi/jeux). The work shift and
// the jobs that pay too: the game played, the pay comes (scaled by how well, playDefi). Never a talk
// (its own sheet), nor a film at the ciné-club (watched for real).
func gesteOK(a *game.Activity) bool {
	it := a.Interaction
	return a.Kind == "do" && a.PlaceKind != "chat" && defiOf(it.ID) == "" && !slices.Contains(gesteNot, it.ID) && !(it.ID == game.JoinHappeningID && slices.Contains(gesteNotLabels, it.Label)) && a.Seance == nil
}

// homeLines: what's said after a home gesture, played badly, well, perfectly.
var homeLines = map[string][3]string{
	"douche":   {"Une douche vite fait : il reste du savon derrière les oreilles.", "Une bonne douche, propre et frais.", "La douche parfaite : tu sens bon jusqu'au bout de la rue !"},
	"cuisine":  {"Le poisson a un peu brûlé… mais ça se mange.", "Un bon attiéké-poisson, bien assaisonné.", "Attiéké-poisson de chef : même la voisine vient goûter !"},
	"repas":    {"Mangé trop vite : un peu lourd sur l'estomac.", "Un bon repas, tranquillement.", "Un repas savouré jusqu'à la dernière bouchée : le ventre content !"},
	"dodo":     {"Une nuit agitée, tu t'es retourné·e dans tous les sens.", "Une bonne nuit de sommeil.", "Dormi comme un bébé : tu te lèves en pleine forme !"},
	"cour":     {"Tombé·e sur les genoux : un pansement et on recommence.", "Une belle partie dans la cour avec les copains.", "Le roi de la cour : les copains crient ton nom !"},
	"biberon":  {"Du lait partout sur le menton…", "Le biberon bu, le petit rot fait.", "Biberon fini d'un trait : maman te félicite !"},
	"bouillie": {"La moitié de la bouillie sur le bavoir.", "Toute la bouillie mangée.", "Tu ouvres grand à chaque cuillère : maman est ravie !"},
	"bain":     {"De l'eau partout dans la salle de bain !", "Un bon bain avec les petits canards.", "Le plus beau bain du monde : tout propre et tout content !"},
	"calin":    {"Un câlin un peu gigotant.", "Un doux câlin dans les bras de maman.", "Le câlin le plus tendre : maman fond !"},
	"caca":     {"Ça déborde un peu… maman soupire.", "Caca fait, couche changée.", "Caca fait, couche propre en un clin d'œil : bravo bébé !"},
	"pipi":     {"Un peu à côté…", "Pipi fait, papa change la couche.", "Pipi fait au bon moment : couche propre !"},
	"vomir":    {"Bleuh, partout sur papa !", "Un petit renvoi, maman nettoie.", "Juste un petit renvoi dans le bavoir : propre !"},
	"pleurer":  {"Des pleurs à réveiller tout le quartier.", "Quelques larmes, et maman te console.", "Un petit chagrin vite consolé : tu souris déjà !"},
	"geste":    {"Fait, mais un peu à la va-vite.", "Bien fait !", "Parfait, du début à la fin !"},
	"garba":    {"Un autre client a eu ton thon, et l'attiéké t'a fait tousser…", "Un bon garba, bien mangé.", "Le meilleur morceau et pas une toux : garba de champion !"},
	"alloco":   {"La moitié de l'alloco dans le sable…", "Presque tout l'alloco dans le papier.", "Tout l'alloco attrapé, rien de perdu !"},
	"bar":      {"Une soirée un peu molle à la table.", "Une bonne ambiance avec les amis.", "La table la plus ambiancée du maquis !"},
}

// babyDefis: the baby's games, behind the update « bebe-jeux ».
var babyDefis = []string{"coucou", "cubes", "pas", "hochet"}

// The tournament's prizes: the cup, the final lost (the entry is 1 000; played once a day, game.FromTournament).
const (
	tournamentWin   = 2000
	tournamentFinal = 800
)

var (
	errDefiKind = errors.New("défi inconnu")
	errDefiNot  = errors.New("ce défi se joue pendant l'activité")
	errDefiDone = errors.New("défi déjà joué cette fois-ci")
)

// defiOf: the défi of an interaction, or "".
func defiOf(interaction string) string {
	if strings.HasPrefix(interaction, game.FromFridgePrefix) {
		return "repas"
	}
	for k, ids := range defiFor {
		if slices.Contains(ids, interaction) {
			return k
		}
	}
	return ""
}

// defiReward: what a score earns (the needs, the money back on what was paid) and the line said.
// interaction: the activity it's played during (the foot's match, challenge or tournament).
func defiReward(kind, interaction string, score, cost int) (game.Needs, int, string) {
	k := float64(score) / 100
	tier := 0
	switch {
	case score >= 85:
		tier = 2
	case score >= 50:
		tier = 1
	}
	if l, ok := homeLines[kind]; ok {
		return game.Needs{}, 0, l[tier]
	}
	switch kind {
	case "the":
		lines := []string{"Ton thé n'a pas de mousse : les gars rigolent, on recommence.", "Ton thé mousse bien : les gars en redemandent.", "Ton thé mousse comme celui des vieux du grin : respect !"}
		return game.Needs{Social: math.Round(12 * k), Fun: math.Round(6 * k), Energy: 3}, 0, lines[tier]
	case "ski":
		lines := []string{"Quelques bouées ratées et un plongeon : la lagune est bonne !", "Belle sortie : les bouées passées, un saut ou deux.", "Slalom parfait et des sauts de champion : le pilote te filme !"}
		return game.Needs{Fun: math.Round(16 * k)}, 0, lines[tier]
	case "foot":
		fun := game.Needs{Fun: math.Round(14 * k), Social: math.Round(6 * k)}
		switch interaction {
		case "console-defi":
			// The loser pays: won, the stake back and the other's; level, each keeps his own.
			switch {
			case score > 50:
				return fun, 2 * cost, fmt.Sprintf("Tu gagnes le défi : le gars du quartier te paie %s.", game.FCFA(cost))
			case score == 50:
				return fun, cost, "Match nul : chacun reprend sa mise."
			}
			return fun, 0, "Perdu : c'est toi qui paies. La revanche, c'est quand tu veux."
		case "tournoi-console":
			switch {
			case score >= 100:
				return game.Needs{Fun: 20, Social: 15}, tournamentWin, fmt.Sprintf("Champion du tournoi du samedi ! La coupe et %s.", game.FCFA(tournamentWin))
			case score >= 66:
				return fun, tournamentFinal, fmt.Sprintf("Finaliste du tournoi : %s pour la deuxième place.", game.FCFA(tournamentFinal))
			case score >= 33:
				return fun, 0, "Éliminé·e en demi-finale : pas mal du tout."
			}
			return fun, 0, "Éliminé·e en quart de finale : samedi prochain, ce sera la bonne."
		}
		lines := []string{"Défaite : les gars du quartier rigolent, tu veux ta revanche.", "Un bon match, serré jusqu'au bout.", "Victoire nette : tu es le roi de la manette !"}
		return fun, 0, lines[tier]
	case "course":
		lines := []string{"Le woro-woro t'a coupé la route : deuxième, de loin.", "Une belle course, au coude-à-coude.", "Premier avec de l'avance : tu pilotes comme un chauffeur de gbaka !"}
		return game.Needs{Fun: math.Round(14 * k), Social: math.Round(4 * k)}, 0, lines[tier]
	case "combat":
		lines := []string{"Ton adversaire t'a mis K.O. : entraîne-toi.", "Un combat accroché, round après round.", "Ton adversaire au tapis : la salle crie ton nom !"}
		return game.Needs{Fun: math.Round(14 * k), Social: math.Round(4 * k)}, 0, lines[tier]
	case "ecole":
		lines := []string{"Le maître secoue la tête : « Il faut réviser, hein ! » Ce soir, les devoirs.", "« Bien ! » dit le maître. Quelques erreurs, mais tu as suivi.", "« Excellent ! Applaudissez-le ! » Toute la classe tape dans les mains. Ça compte pour le bac !"}
		return game.Needs{Fun: math.Round(10 * k), Social: math.Round(8 * k)}, 0, lines[tier]
	case "coucou":
		lines := []string{"Maman a fait coucou, tu as regardé ailleurs. On recommence !", "Des petits rires : maman est ravie.", "Tu éclates de rire à chaque coucou : maman t'embrasse partout !"}
		return game.Needs{Fun: math.Round(14 * k), Social: math.Round(10 * k)}, 0, lines[tier]
	case "cubes":
		lines := []string{"La tour s'écroule… et ça te fait rire quand même.", "Une jolie tour de cubes !", "Une tour immense : papa prend une photo !"}
		return game.Needs{Fun: math.Round(16 * k)}, 0, lines[tier]
	case "pas":
		lines := []string{"Boum, boum : les fesses par terre. Demain ça ira mieux.", "Quelques pas tout seul : papa applaudit !", "Tu marches jusqu'à papa sans tomber : toute la maison crie de joie !"}
		return game.Needs{Fun: math.Round(12 * k), Social: math.Round(10 * k)}, 0, lines[tier]
	case "hochet":
		lines := []string{"Le hochet part dans tous les sens.", "Tu secoues en rythme : maman chante avec toi.", "Un vrai petit percussionniste : maman sort le tam-tam !"}
		return game.Needs{Fun: math.Round(16 * k)}, 0, lines[tier]
	case "bagarre":
		lines := []string{"Le cousin t'a pris le jouet… et tu pleures dans les bras de maman.", "Une bagarre serrée : maman sépare tout le monde, chacun son jouet.", "Le cousin au tapis, le jouet est à toi ! Toute la famille rit aux éclats."}
		return game.Needs{Fun: math.Round(14 * k), Social: math.Round(6 * k)}, 0, lines[tier]
	case "circulation":
		// Played well, the drivers thank the volunteer with a few coins (a gain, within the day's limit).
		lines := []string{"Coups de klaxon et pare-chocs qui se frôlent : le bouchon est toujours là.", "Le carrefour se vide petit à petit : les chauffeurs te saluent de la main.", "Circulation fluide en un temps record ! Les chauffeurs t'applaudissent, un gbaka crie ton nom."}
		tip := 0
		switch tier {
		case 2:
			tip = circulationTipBest
		case 1:
			tip = circulationTip
		}
		if score < JamClearScore {
			tip = 0
		}
		return game.Needs{Social: math.Round(12 * k), Fun: math.Round(8 * k)}, tip, lines[tier]
	case "evenement":
		// Its good is the action's own (playDefi, homeDone); the line names it.
		return game.Needs{}, 0, eventLine(interaction, tier)
	case "arcade":
		lines := []string{"Les moustiques ont gagné cette nuit.", "Pas mal de moustiques au tapis.", "Un massacre de moustiques : ton nom tout en haut de la borne !"}
		return game.Needs{Fun: math.Round(14 * k)}, 0, lines[tier]
	default:
		// Good shopping: the right things, quickly, nothing silly bought: up to a fifth saved.
		back := int(math.Round(float64(cost)*0.2*k/50)) * 50
		lines := []string{"Des oublis et des achats en trop : la liste, c'est la liste.", "Presque toute la liste, sans traîner.", "Toute la liste, vite et bien : tu es fort aux courses !"}
		text := lines[tier]
		if back > 0 {
			text += fmt.Sprintf(" %s économisés.", game.FCFA(back))
		}
		return game.Needs{Hunger: math.Round(5 * k)}, back, text
	}
}

// defi: POST {kind, score}: the défi played during the activity, its bonus, the record.
func (h *Handler) defi(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind  string `json:"kind"`
		Score int    `json:"score"`
		// What was chosen along the way: the alloco's egg (« oeuf »).
		Extra string `json:"extra"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if (req.Kind == "ecole" && features.Default.BlocksKey(r.Context(), "ecole-vivante") != "") || (slices.Contains(babyDefis, req.Kind) && features.Default.BlocksKey(r.Context(), "bebe-jeux") != "") || (req.Kind == "bagarre" && features.Default.BlocksKey(r.Context(), "bagarre-bebe") != "") || (req.Kind == "circulation" && features.Default.BlocksKey(r.Context(), "circulation") != "") || ((slices.Contains(homeDefis, req.Kind) || req.Kind == "geste") && features.Default.BlocksKey(r.Context(), "gestes-maison") != "") || (req.Kind == "evenement" && !eventsOpen(r.Context())) {
		httpx.Error(w, http.StatusForbidden, "bientôt dans le jeu")
		return
	}
	if _, ok := defiFor[req.Kind]; !ok && req.Kind != "geste" {
		httpx.Error(w, http.StatusUnprocessableEntity, errDefiKind.Error())
		return
	}
	score := max(0, min(100, req.Score))
	ctx := r.Context()
	h.mutateTx(w, r, func(s *Sim, tx pgx.Tx) (game.Outcome, []Event, error) {
		text, back, err := playDefi(ctx, tx, s, req.Kind, score)
		if err == nil && req.Kind == "alloco" && req.Extra == "oeuf" {
			var paid int
			text, paid = allocoWithEgg(s, text)
			back -= paid
		}
		if err == nil && req.Kind == "circulation" {
			// Played well: the jam is over for the whole street (jam.go).
			cleared, cerr := clearJam(ctx, tx, s, score)
			if cerr != nil {
				return game.Outcome{}, nil, cerr
			}
			if cleared {
				text += " Le bouchon se vide : la circulation est rétablie dans tout le quartier !"
			}
		}
		if err == nil && req.Kind == "evenement" {
			// Played badly: the happening's mishap (soaked by the gbaka, the « café » for the agent…).
			var paid int
			text, paid = eventMishap(s, s.Activity.Interaction.ID, score, text)
			back -= paid
		}
		if err == nil && req.Kind == "bar" {
			var spent int
			text, spent = barNight(s, req.Extra, text)
			back -= spent
		}
		if err != nil {
			return game.Outcome{}, nil, err
		}
		// The défi played, the activity is over there and then (not at the next look): the Sim is free,
		// what it did is in the journal. (Not the school's lesson: the day goes on.)
		var events []Event
		if req.Kind != "ecole" {
			events = s.advanceTo(s.GameMinutes, newRand())
		}
		return game.Outcome{Text: text, Money: back}, events, nil
	})
}

// playDefi: the défi played during the Sim's activity (once): its bonus, the record; the line said and the money back.
func playDefi(ctx context.Context, tx pgx.Tx, s *Sim, kind string, score int) (string, int, error) {
	a := s.Activity
	if a == nil || a.Kind != "do" || (kind == "geste" && !gesteOK(a)) || (kind != "geste" && defiOf(a.Interaction.ID) != kind) {
		return "", 0, errDefiNot
	}
	if a.Defi > 0 {
		return "", 0, errDefiDone
	}
	a.Defi = max(1, score)
	needs, back, text := defiReward(kind, a.Interaction.ID, score, a.Interaction.Cost)
	s.Needs = s.Needs.Add(needs)
	// The home's gestures are the action itself: played, all of it is done at once (well done, all its
	// good; badly, a little less), whatever time it had left.
	if slices.Contains(homeDefis, kind) || kind == "geste" || kind == "evenement" {
		s.Needs = homeDone(s.Needs, a, score)
		// What it pays (the shift, the petit boulot): the whole of it played well, a little less played badly.
		if a.Interaction.Cost < 0 {
			a.Interaction.Cost = int(math.Round(float64(a.Interaction.Cost) * (0.6 + 0.4*float64(score)/100)))
		}
	}
	// What comes back up to what was paid (the stake, money saved on the
	// shopping) isn't a gain; what's won over it is, within the day's limit
	// (the score is the phone's: a made-up one buys little).
	refund := min(back, max(a.Interaction.Cost, 0))
	s.Money += refund
	if gain := back - refund; gain > 0 {
		src := game.FromDefi
		if a.Interaction.ID == game.TournamentID {
			src = game.FromTournament
		}
		would := s.withSect(s.withPass(gain), "defi")
		got := s.earn(src, would)
		back = refund + got
		text = capNote(text, src, got, would)
	}
	var before int
	if err := tx.QueryRow(ctx, `SELECT best FROM defis WHERE sim_id = $1 AND kind = $2`, s.ID, kind).Scan(&before); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", 0, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO defis (sim_id, kind, best, played) VALUES ($1, $2, $3, 1)
		ON CONFLICT (sim_id, kind) DO UPDATE SET best = GREATEST(defis.best, EXCLUDED.best), played = defis.played + 1, updated_at = now()`, s.ID, kind, score); err != nil {
		return "", 0, err
	}
	// (Not the happenings' choices: each its own game, one record would compare them.)
	if score > before && before > 0 && kind != "evenement" {
		text += fmt.Sprintf(" Nouveau record : %d (avant : %d) !", score, before)
	}
	// The défi was what the activity was for: played, it's over (the tea at the grin drunk, the match at
	// the console done), not left running for the rest of its time. Talking on is an action of its own.
	// (Not the school's lesson: the day goes on, the récré, class again.)
	if kind == "ecole" {
		// Answered well: a good mark, towards the bac.
		if score >= 85 {
			s.schoolMark(game.Interaction{ID: "aller-ecole"})
		}
	} else {
		a.End = min(a.End, s.GameMinutes)
	}
	return fmt.Sprintf("Défi %d/100. %s", score, text), back, nil
}

// allocoWithEgg: the egg taken with the alloco: paid, eaten (none when there's not enough money left).
func allocoWithEgg(s *Sim, text string) (string, int) {
	if s.Money < allocoEgg {
		return text + " Pas assez pour l'œuf : ce sera pour la prochaine fois.", 0
	}
	s.Money -= allocoEgg
	s.Needs = s.Needs.Add(game.Needs{Hunger: allocoEggFill})
	return text + fmt.Sprintf(" Avec l'œuf (%s).", game.FCFA(allocoEgg)), allocoEgg
}

// barNight: the rounds served again and the banknotes thrown, paid (as far as the money goes), and
// drunk, its cost. extra: « tournees:2;billets:5000;soul ». What was spent, and the line.
func barNight(s *Sim, extra, text string) (string, int) {
	rounds, billets, drunk := 0, 0, false
	for _, part := range strings.Split(extra, ";") {
		k, v, _ := strings.Cut(part, ":")
		n, _ := strconv.Atoi(v)
		switch k {
		case "tournees":
			rounds = min(max(n, 0), barRounds)
		case "billets":
			billets = min(max(n, 0), barBillets) / 100 * 100
		case "soul":
			drunk = true
		}
	}
	spent := 0
	if c := rounds * barRound; c > 0 {
		c = min(c, s.Money/barRound*barRound)
		s.Money -= c
		spent += c
		text += fmt.Sprintf(" Tournées : %s.", game.FCFA(c))
	}
	if b := min(billets, s.Money/100*100); b > 0 {
		s.Money -= b
		spent += b
		s.Needs = s.Needs.Add(game.Needs{Social: math.Min(20, float64(b)/1000)})
		text += fmt.Sprintf(" Billets lancés : %s, la table crie ton nom !", game.FCFA(b))
	}
	if drunk {
		s.Needs = s.Needs.Add(barDrunk)
		text += " Mais tu as trop bu : les amis te ramènent, la tête qui tourne."
	}
	return text, spent
}

// homeDone: a home gesture played: what was left of the action's good, all at once (0.6 of it played
// badly, all of it played perfectly), and the action counted as done.
// (What it costs, hunger after caca, is all of it however it's played; only the good is scaled.)
func homeDone(n game.Needs, a *game.Activity, score int) game.Needs {
	left := max(0, 1-a.Applied)
	well := 0.6 + 0.4*float64(score)/100
	part := func(v float64) float64 {
		if v < 0 {
			return v * left
		}
		return v * left * well
	}
	e := a.Interaction.Effect
	a.Applied = 1
	return n.Add(game.Needs{Hunger: part(e.Hunger), Energy: part(e.Energy), Hygiene: part(e.Hygiene), Social: part(e.Social), Fun: part(e.Fun)})
}

// defis: GET: the Sim's best score at each défi (none played: not there).
func (h *Handler) defis(w http.ResponseWriter, r *http.Request) {
	id, _, _, err := h.mySim(r)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "sim introuvable")
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT kind, best FROM defis WHERE sim_id = $1`, id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "database unavailable")
		return
	}
	defer rows.Close()
	best := map[string]int{}
	for rows.Next() {
		var k string
		var b int
		if err := rows.Scan(&k, &b); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "database unavailable")
			return
		}
		best[k] = b
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"best": best})
}
