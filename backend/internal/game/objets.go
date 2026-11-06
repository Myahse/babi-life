package game

import (
	"fmt"
	"math"
	"strings"
)

// Le mode vie's objects that wear and break (the update « mode-vie », sims/objets.go; web
// world3d/objetsPanne.tsx). The house's things (the TV, the fridge, the gazinière, the shower, the
// toilets, the washbasin, the console) wear a little each time they're used and, the more worn, the
// likelier they break. Broken, one stops working (what's done on it is refused), shows it (sparks,
// a puddle, smoke) and weighs on the mood while it lasts. It's mended by oneself (« Réparer »: the
// bricolage decides, a failure may give a small shock) or by a repairman who's paid, comes and goes.
// The finer pieces (the furniture's Tier) wear slower.

// HomeObject: one of the house's things that can break: the actions done on it (Uses), the furniture
// it is (Base: the plainest; finer ones have it as their Base), how it breaks (Breaks: etincelles,
// fuite, fumee) and the mood it leaves while broken.
type HomeObject struct {
	ID     string   `json:"id"`
	Label  string   `json:"label"`
	Icon   string   `json:"icon"`
	Base   string   `json:"base"`
	Uses   []string `json:"uses"`
	Breaks string   `json:"breaks"`
	Mood   string   `json:"mood"`
	// Broken: how it's said (« La télé est en panne »).
	Broken string `json:"broken"`
}

// HomeObjects: the things that break.
var HomeObjects = []HomeObject{
	{ID: "tele", Label: "La télé", Icon: "tv", Base: "tele", Uses: []string{"watch-tv"}, Breaks: "etincelles", Mood: "panne-tele", Broken: "La télé est en panne"},
	{ID: "console", Label: "La console", Icon: "gamepad-2", Base: "console", Uses: []string{"maison-foot", "maison-course", "maison-combat"}, Breaks: "etincelles", Mood: "panne-console", Broken: "La console ne s'allume plus"},
	{ID: "frigo", Label: "Le frigo", Icon: "refrigerator", Base: "frigo", Uses: []string{"frigo-"}, Breaks: "fuite", Mood: "fuite-eau", Broken: "Le frigo fuit et ne refroidit plus"},
	{ID: "gaziniere", Label: "La gazinière", Icon: "cooking-pot", Base: "gaziniere", Uses: []string{"cook-attieke", "cuisiner-kedjenou"}, Breaks: "fumee", Mood: "gaziniere-fume", Broken: "La gazinière fume"},
	{ID: "douche", Label: "La douche", Icon: "shower-head", Base: "douche", Uses: []string{"shower"}, Breaks: "fuite", Mood: "fuite-eau", Broken: "Fuite d'eau à la douche"},
	{ID: "wc", Label: "Les toilettes", Icon: "toilet", Base: "wc", Uses: []string{"toilettes"}, Breaks: "fuite", Mood: "fuite-eau", Broken: "Les toilettes sont bouchées"},
	{ID: "lavabo", Label: "Le lavabo", Icon: "droplets", Base: "lavabo", Uses: []string{"dents", "miroir-discours"}, Breaks: "fuite", Mood: "fuite-eau", Broken: "Fuite d'eau au lavabo"},
}

// ObjectOf: the object `id`.
func ObjectOf(id string) (HomeObject, bool) {
	for _, o := range HomeObjects {
		if o.ID == id {
			return o, true
		}
	}
	return HomeObject{}, false
}

// ObjectUsed: the object an action done at home wears ("" for none).
func ObjectUsed(interactionID string) string {
	for _, o := range HomeObjects {
		for _, u := range o.Uses {
			if interactionID == u || (strings.HasSuffix(u, "-") && strings.HasPrefix(interactionID, u)) {
				return o.ID
			}
		}
	}
	return ""
}

// RepairPrefix: the actions that mend an object oneself (« reparer-tele »…), one per object.
const RepairPrefix = "reparer-"

// RepairOf: the object a repair action mends ("" when it isn't one).
func RepairOf(interactionID string) string {
	if !strings.HasPrefix(interactionID, RepairPrefix) {
		return ""
	}
	id := strings.TrimPrefix(interactionID, RepairPrefix)
	if _, ok := ObjectOf(id); !ok {
		return ""
	}
	return id
}

// RepairInteractions: the repair actions (in the home's catalogue, shut with le mode vie).
func RepairInteractions() []Interaction {
	out := make([]Interaction, 0, len(HomeObjects))
	for _, o := range HomeObjects {
		out = append(out, Interaction{ID: RepairPrefix + o.ID, Room: roomOfObject(o.ID), Ages: TeensUp, Label: fmt.Sprintf("Réparer %s", LowerFirst(o.Label)), Icon: "wrench", Minutes: 40, Effect: Needs{Fun: -4, Energy: -8, Hygiene: -6}})
	}
	return out
}

func roomOfObject(id string) string {
	switch id {
	case "tele", "console":
		return RoomLiving
	case "frigo", "gaziniere":
		return RoomKitchen
	}
	return RoomBath
}

// ObjState: an object's state in the Sim's house: how worn (0..100), broken since when (game minute,
// 0 working), the repairman on his way (until the game minute he's done), how many times mended.
type ObjState struct {
	Wear   float64 `json:"wear"`
	Broken int64   `json:"broken,omitempty"`
	Pro    int64   `json:"pro,omitempty"`
	ProAt  int64   `json:"proAt,omitempty"`
	Fixed  int     `json:"fixed,omitempty"`
}

// WearPerUse: what one use adds to an object's wear, by its furniture's tier (the finer, the slower).
func WearPerUse(tier string) float64 {
	switch tier {
	case TierPrestige:
		return 3
	case TierConfort:
		return 5
	}
	return 8
}

// BreakChance: how likely one use breaks an object this worn: nothing under 40, then more and more,
// sure at 100.
func BreakChance(wear float64) float64 {
	if wear < 40 {
		return 0
	}
	if wear >= 100 {
		return 1
	}
	k := (wear - 40) / 60
	return 0.04 + 0.5*k*k
}

// RepairChance: how likely mending it oneself works, by the bricolage's level (1..10): 40 % to 98 %.
func RepairChance(level int) float64 {
	return math.Min(0.98, 0.32+0.07*float64(max(1, level)))
}

// ShockChance: a repair that failed: how likely it ends in a small electric shock (the electrical things).
func ShockChance(o HomeObject) float64 {
	if o.Breaks == "etincelles" || o.Breaks == "fumee" {
		return 0.6
	}
	return 0.15
}

// RepairmanCost: what the repairman asks for this piece of furniture (its price, a little of it): 3 000 F
// at least, rounded to 500 F.
func RepairmanCost(price int) int {
	v := 3000 + float64(price)*0.025
	return int(math.Round(v/500)) * 500
}

// RepairmanMinutes: how long the repairman is there (game minutes = real ones), from the call.
const RepairmanMinutes = 2

func init() {
	for k, v := range lifeWorkMoodlets {
		Moodlets[k] = v
	}
	// The repair actions at home, shut with le mode vie.
	k := Kinds["home"]
	for _, it := range RepairInteractions() {
		k.Interactions = append(k.Interactions, it)
		LifeInteractions = append(LifeInteractions, it.ID)
	}
	Kinds["home"] = k
}

// lifeWorkMoodlets: the moods the work day and the house's objects give (added to Moodlets).
var lifeWorkMoodlets = map[string]MoodletDef{
	"bonne-journee":    {"Bonne journée au travail", "briefcase", 2, 180},
	"mauvaise-journee": {"Mauvaise journée au travail", "frown", -1, 150},
	"collegues":        {"Rigolé avec les collègues", "users", 1, 150},
	"tranquille":       {"Journée tranquille au boulot", "coffee", 1, 120},
	"journee-dure":     {"A tout donné au travail", "flame", 1, 120},
	"tard":             {"Resté·e tard au travail", "clock", -1, 150},
	"honte":            {"Un peu honte", "frown", -1, 90},
	"promu":            {"Promu·e !", "trophy", 3, 300},
	"bonne-ecole":      {"Bonne journée à l'école", "school", 1, 150},
	"puni":             {"Grondé·e à l'école", "frown", -1, 120},
	"panne-tele":       {"La télé est en panne", "tv", -1, 0},
	"panne-console":    {"La console est en panne", "gamepad-2", -1, 0},
	"fuite-eau":        {"Fuite d'eau", "droplets", -1, 0},
	"gaziniere-fume":   {"La gazinière fume", "flame", -1, 0},
	"decharge":         {"Petite décharge électrique", "zap", -2, 60},
	"repare":           {"Réparé de ses mains", "wrench", 1, 120},
}
