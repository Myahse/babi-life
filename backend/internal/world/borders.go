package world

// bordersBoth: whether both countries have land borders listed (Borders): then roads may cross lands (Europe, Asia,
// the Middle East), and roadLinked alone decides.
func bordersBoth(a, b string) bool {
	_, okA := Borders[a]
	_, okB := Borders[b]
	return okA && okB
}
