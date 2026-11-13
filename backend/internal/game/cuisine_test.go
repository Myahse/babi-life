package game

import (
	"slices"
	"strings"
	"testing"
)

// Every dish is well made: its id, a real price, a carte section, places that exist, food that feeds.
func TestDishes(t *testing.T) {
	seen := map[string]bool{}
	sections := map[string]bool{}
	for _, s := range CarteSections {
		sections[s.ID] = true
	}
	for _, d := range Dishes {
		if !strings.HasPrefix(d.ID, DishPrefix) || seen[d.ID] {
			t.Errorf("%s: bad or repeated id", d.ID)
		}
		seen[d.ID] = true
		if d.Price < 100 || d.Price > 10000 || d.Price%50 != 0 {
			t.Errorf("%s: price %d", d.ID, d.Price)
		}
		if !sections[d.Section] || d.Name == "" || d.Label == "" || d.Plate == "" || d.Minutes < 5 {
			t.Errorf("%s: incomplete", d.ID)
		}
		if len(d.Kinds) == 0 {
			t.Errorf("%s: served nowhere", d.ID)
		}
		for _, k := range d.Kinds {
			kind, ok := Kinds[k]
			if !ok {
				t.Errorf("%s: no kind %s", d.ID, k)
				continue
			}
			if _, ok := kind.Interaction(d.ID); !ok {
				t.Errorf("%s: not at the %s", d.ID, k)
			}
		}
		// Plates fill; drinks and snacks less; nothing hurts the hunger.
		switch d.Section {
		case SecPlats:
			if d.Effect.Hunger < 40 {
				t.Errorf("%s: a plate that doesn't fill (%v)", d.ID, d.Effect.Hunger)
			}
		case SecBoissons, SecFruits:
			if d.Effect.Hunger > 15 || d.Price > 500 {
				t.Errorf("%s: a drink or a fruit too much (%v, %d)", d.ID, d.Effect.Hunger, d.Price)
			}
		}
		if d.Effect.Hunger < 0 {
			t.Errorf("%s: makes hungry", d.ID)
		}
		// The alcohol: grown-ups only, and the icon the phone's driving rule reads.
		if d.Alcohol != (d.Section == SecAlcools) || d.Alcohol && (!slices.Equal(d.Ages, Adults) || d.Icon != "wine") {
			t.Errorf("%s: alcohol badly set", d.ID)
		}
		if (len(d.Cities) > 0) != (d.Region != "") {
			t.Errorf("%s: region and cities go together", d.ID)
		}
	}
	if len(Dishes) < 40 {
		t.Errorf("only %d dishes", len(Dishes))
	}
}

// Breakfast is in the morning, the maquis' grills in the evening, the koutoukou late.
func TestDishHours(t *testing.T) {
	at := func(id string, h int) bool {
		d, ok := FindDish(id)
		if !ok {
			t.Fatalf("no %s", id)
		}
		return d.Interaction().Available(h)
	}
	for _, c := range []struct {
		id   string
		h    int
		want bool
	}{
		{"plat-pain-omelette", 7, true}, {"plat-pain-omelette", 14, false}, {"plat-bouillie-mil", 6, true}, {"plat-bouillie-mil", 20, false},
		{"plat-choukouya", 21, true}, {"plat-choukouya", 1, true}, {"plat-choukouya", 10, false},
		{"plat-foutou-banane-graine", 13, true}, {"plat-foutou-banane-graine", 8, false},
		{"plat-koutoukou", 23, true}, {"plat-koutoukou", 11, false}, {"plat-pepper-soup", 2, true},
		{"plat-mais-grille", 18, true}, {"plat-mais-grille", 9, false}, {"plat-bissap", 9, true},
	} {
		if got := at(c.id, c.h); got != c.want {
			t.Errorf("%s at %dh: %v", c.id, c.h, got)
		}
	}
	// The tantie's cantine: weekdays and Saturday, at noon.
	d, _ := FindDish("plat-cantine-tantie")
	if d.Interaction().OpenAt(6*24*60+12*60) || !d.Interaction().OpenAt(12*60) {
		t.Error("cantine days")
	}
}

// The rare dishes are on about half the cartes, the same answer every time; the common ones everywhere.
func TestServes(t *testing.T) {
	n := 0
	for i := range 200 {
		id := "maquis-" + strings.Repeat("x", i%7) + string(rune('a'+i%26)) + string(rune('a'+i/26))
		if Serves(id, "plat-agouti") {
			n++
		}
		if Serves(id, "plat-agouti") != Serves(id, "plat-agouti") || !Serves(id, "plat-kedjenou") {
			t.Fatal("unstable or missing")
		}
	}
	if n < 60 || n > 140 {
		t.Errorf("agouti at %d places of 200", n)
	}
	if Serves("x", "plat-inconnu") {
		t.Error("an unknown dish served")
	}
}

// The dish of the day: one of the place's plates, the same all day, cheaper; another place or day, maybe another.
func TestDishOfDay(t *testing.T) {
	const place = "yop-maquis-test"
	d := DishOfDay(place, "maquis", "abidjan", 10)
	dish, ok := FindDish(d)
	if !ok || !slices.Contains(dish.Kinds, "maquis") || len(dish.Cities) > 0 || dish.Section != SecPlats && dish.Section != SecGrillades {
		t.Fatalf("dish of the day %q", d)
	}
	if DishOfDay(place, "maquis", "abidjan", 10) != d {
		t.Error("changes within the day")
	}
	it, served := OnCarte(dish.Interaction(), place, "maquis", "abidjan", 10*24*60+13*60)
	if !served || it.Cost >= dish.Price {
		t.Errorf("not cheaper: %d for %d", it.Cost, dish.Price)
	}
	days := map[string]bool{}
	for day := range int64(20) {
		days[DishOfDay(place, "maquis", "abidjan", day)] = true
	}
	if len(days) < 3 {
		t.Errorf("the same dish nearly every day: %v", days)
	}
	if DishOfDay(place, "aeroport", "abidjan", 1) != "" {
		t.Error("a dish of the day where none is cooked")
	}
}

// Recipes: known ingredients, what's missing counted, cooking takes them and gives what it yields; and
// cooking at home feeds better than the same plate eaten out.
func TestRecipes(t *testing.T) {
	for _, r := range Recipes {
		if !strings.HasPrefix(r.ID, RecipePrefix) || len(r.Needs) == 0 {
			t.Errorf("%s: bad", r.ID)
		}
		for id := range r.Needs {
			if _, ok := FindIngredient(id); !ok {
				t.Errorf("%s: unknown ingredient %s", r.ID, id)
			}
		}
		for id := range r.Yields {
			if _, ok := FindGrocery(id); !ok {
				t.Errorf("%s: yields an unknown grocery %s", r.ID, id)
			}
		}
		if _, ok := Kinds["home"].Interaction(r.ID); !ok {
			t.Errorf("%s: not in the kitchen", r.ID)
		}
	}
	r, _ := FindRecipe("recette-foutou-graine")
	stock := map[string]int{"ing-banane": 1, "ing-graine": 3}
	miss := r.Missing(stock)
	if miss["ing-banane"] != 1 || miss["ing-poisson"] != 1 || miss["ing-condiments"] != 1 || miss["ing-graine"] != 0 {
		t.Errorf("missing %v", miss)
	}
	stock = map[string]int{"ing-banane": 2, "ing-graine": 1, "ing-poisson": 1, "ing-condiments": 2}
	if r.Missing(stock) != nil {
		t.Fatal("has it all")
	}
	r.Cook(stock)
	if stock["ing-banane"] != 0 || stock["ing-condiments"] != 1 {
		t.Errorf("after cooking %v", stock)
	}
	b, _ := FindRecipe("recette-bissap")
	st := map[string]int{"ing-bissap": 1, "ing-gingembre": 1}
	b.Cook(st)
	if st["bissap"] != 2 {
		t.Errorf("bissap yields %v", st)
	}
	out, _ := FindDish("plat-foutou-banane-graine")
	if r.Effect.Hunger <= out.Effect.Hunger || r.Effect.Fun < out.Effect.Fun {
		t.Error("home cooking no better than the maquis")
	}
	cost := 0
	for id, n := range r.Needs {
		g, _ := FindIngredient(id)
		cost += g.Price * n
	}
	if cost > 2*out.Price+1000 {
		t.Errorf("the foutou's ingredients cost %d", cost)
	}
	// Adjamé and Treichville are cheaper.
	g, _ := FindIngredient("ing-poulet")
	if IngredientPrice(g, MarcheTreichID) >= g.Price || IngredientPrice(g, "yop-marche") != g.Price {
		t.Error("big markets' prices")
	}
	if sk, _ := SkillOf("recette-kedjenou"); sk != "cuisine" {
		t.Error("cooking trains no skill")
	}
}
