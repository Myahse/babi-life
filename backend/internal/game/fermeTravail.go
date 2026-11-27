package game

// FermeWork: an act of the farm done by the Sim at the plot, as a timed action (sims/fermeTravail.go): what it
// is (the act and what it carries, as the phone sent it), done when the action ends.
type FermeWork struct {
	Act     string `json:"act"`
	Plot    string `json:"plot"`
	Offre   string `json:"offre"`
	Crop    string `json:"crop,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Product string `json:"product,omitempty"`
	Score   int    `json:"score,omitempty"`
	Hire    bool   `json:"hire,omitempty"`
	Qty     int    `json:"qty,omitempty"`
}
