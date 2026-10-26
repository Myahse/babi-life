package game

import (
	"slices"
	"time"
)

// The republic's week (politics/politics.go, sims/civic.go): the campaign on
// Friday evening and Saturday, the vote on Sunday, the results on Monday at
// 9 h, when the new president's week begins. What the president decrees for
// the week (the measures), the Fête de la Nation at the stadium, and the
// campaign done in the street: the candidate's tour of a commune, the
// party's militants, the meeting at the stadium.

/* ---------- The calendar ---------- */

// The week's calendar, from the results (Monday 9 h, Abidjan's clock is UTC):
// the campaign opens on Friday at 18 h, the vote on Sunday at 0 h, it closes
// on Monday at 0 h, and the results fall at 9 h.
const (
	ResultsHour    = 9
	CampaignBefore = 2*24*time.Hour + 15*time.Hour // Friday 18 h
	VoteBefore     = 33 * time.Hour                // Sunday 0 h
	CloseBefore    = 9 * time.Hour                 // Monday 0 h
	// MandateLength: from one Monday's results to the next's.
	MandateLength = 7 * 24 * time.Hour
	// MandatesAMonth: the most presidential mandates a Sim may win starting in one month.
	MandatesAMonth = 3
)

// ElectionWeek: the dates of the next election from a moment: its campaign,
// its vote, its close and its results (the next Monday at 9 h; the one after
// if the vote would open within a day, so there's time to stand).
func ElectionWeek(now time.Time) (campaign, votes, closes, results time.Time) {
	now = now.UTC()
	d := (8 - int(now.Weekday())) % 7 // days to Monday
	results = time.Date(now.Year(), now.Month(), now.Day()+d, ResultsHour, 0, 0, 0, time.UTC)
	if !results.After(now) {
		results = results.Add(MandateLength)
	}
	if results.Add(-VoteBefore).Sub(now) < 24*time.Hour {
		results = results.Add(MandateLength)
	}
	return results.Add(-CampaignBefore), results.Add(-VoteBefore), results.Add(-CloseBefore), results
}

/* ---------- The measures of the week ---------- */

// Measure: what the president decrees for the week, for everyone: a share off
// the prices at some places (Kinds), or off the fares (Fares).
type Measure struct {
	ID    string   `json:"id"`
	Label string   `json:"label"`
	About string   `json:"about"`
	Kinds []string `json:"kinds,omitempty"`
	Fares bool     `json:"fares,omitempty"`
	// Off: the share taken off the price (0.5: half price).
	Off float64 `json:"off"`
}

var Measures = []Measure{
	{ID: "transport", Label: "Transport à moitié prix", About: "Le gbaka, le woro-woro, le taxi et les cars à moitié prix pour tout le monde.", Fares: true, Kinds: []string{"transport"}, Off: 0.5},
	{ID: "sante", Label: "Soins à moitié prix", About: "Hôpitaux, cliniques et pharmacies à moitié prix.", Kinds: []string{"health", "pharmacie"}, Off: 0.5},
	{ID: "marche", Label: "Marché à prix cassés", About: "Au marché, au maquis et au restaurant, un quart de moins sur l'addition.", Kinds: []string{"market", "maquis", "restaurant"}, Off: 0.25},
	{ID: "culture", Label: "Semaine de la culture", About: "Cinémas, Palais de la culture, concerts et matchs au stade à moitié prix.", Kinds: []string{"cinema", "culture", StadiumKind}, Off: 0.5},
	{ID: "sport", Label: "Sport pour tous", About: "Salles de sport, terrains et karting à moitié prix.", Kinds: []string{"gym", "sport", "karting"}, Off: 0.5},
	{ID: "beaute", Label: "Belle ville", About: "Coiffeurs, barbiers, salons et couturiers à moitié prix : tout le monde se fait beau.", Kinds: []string{"barbier", "salon", "couture"}, Off: 0.5},
}

// MeasuresAMandate: how many measures a president decrees in a week.
const MeasuresAMandate = 2

// FindMeasure: a measure by its id.
func FindMeasure(id string) (Measure, bool) {
	for _, m := range Measures {
		if m.ID == id {
			return m, true
		}
	}
	return Measure{}, false
}

// MeasureOff: the share off a price at a kind of place under the measures in force (the largest).
func MeasureOff(active []string, kind string) float64 {
	off := 0.0
	for _, id := range active {
		if m, ok := FindMeasure(id); ok && slices.Contains(m.Kinds, kind) {
			off = max(off, m.Off)
		}
	}
	return off
}

// FareOff: the share off a trip's fare under the measures in force.
func FareOff(active []string) float64 {
	off := 0.0
	for _, id := range active {
		if m, ok := FindMeasure(id); ok && m.Fares {
			off = max(off, m.Off)
		}
	}
	return off
}

// Discounted: a price with a share off, rounded to 25 Djai (never below 0).
func Discounted(price int, off float64) int {
	if price <= 0 || off <= 0 {
		return price
	}
	return max(0, int(float64(price)*(1-off)/25+0.5)*25)
}

/* ---------- The campaign in the street, the stadium's big days ---------- */

const (
	// CampaignTourID: a candidate's tour of a place (the mairie, the market, a maquis):
	// handshakes, caps and t-shirts; it counts in the commune, once a place an election.
	CampaignTourID = "campagne-terrain"
	// MilitantID: a party member campaigning for the party's candidate, on a call (paid by the candidate).
	MilitantID = "militer"
	// The Fête de la Nation the president gives at the stadium, and a candidate's meeting there.
	FeteID    = "stade-fete"
	MeetingID = "stade-meeting"
)

// What a tour costs (caps, t-shirts, the drinks) and how many points it brings
// in its commune; a militant's points; a meeting's, and each guest's (up to a cap).
const (
	TourCost        = 5000
	TourPoints      = 10
	MilitantPoints  = 6
	MeetingCost     = 150_000
	MeetingPoints   = 40
	MeetingGuest    = 2
	MeetingGuests   = 30
	FeteHours       = 3
	MeetingHours    = 2
	MilitantPayMin  = 1000
	MilitantPayMax  = 5000
	MilitantSlotMax = 20
)

// IsCivic: whether an interaction is one of these (the server checks them against the politics).
func IsCivic(id string) bool {
	return id == CampaignTourID || id == MilitantID || id == FeteID || id == MeetingID
}

func init() {
	tour := Interaction{ID: CampaignTourID, Ages: Adults, Label: "Faire campagne ici", Icon: "megaphone", Minutes: 20, Cost: TourCost, Effect: Needs{Social: 20, Fun: 5, Energy: -10}}
	militer := Interaction{ID: MilitantID, Ages: Adults, Label: "Militer pour ton parti", Icon: "flag", Minutes: 20, Effect: Needs{Social: 20, Energy: -10}}
	for _, k := range []string{"mairie", "market", "maquis"} {
		kind := Kinds[k]
		kind.Interactions = append(kind.Interactions, tour, militer)
		Kinds[k] = kind
	}
	stade := Kinds[StadiumKind]
	stade.Interactions = append(stade.Interactions,
		Interaction{ID: FeteID, Label: "Fête de la Nation", Icon: "party-popper", Minutes: FeteHours * 60, Effect: Needs{Fun: 60, Social: 35, Energy: -15}},
		Interaction{ID: MeetingID, Ages: TeensUp, Label: "Écouter le meeting", Icon: "megaphone", Minutes: MeetingHours * 60, Effect: Needs{Social: 30, Fun: 15, Energy: -10}},
	)
	Kinds[StadiumKind] = stade
}
