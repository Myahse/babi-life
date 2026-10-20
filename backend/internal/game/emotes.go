package game

// The emotes: what the player's Sim does on a tap of the « Émotes » wheel,
// seen live by the other players in the street (live.go: the pose sent).
// Some come with every Sim; the others are bought once with Djai and kept.
// The moves are drawn in web/src/avatar/emotes.ts (and Human.tsx for the
// older poses); the ID is the pose.

type Emote struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Emoji string `json:"emoji"`
	// Price in Djai; 0: free, every Sim has it.
	Price int `json:"price"`
	// Seconds it plays for (it stops sooner when the Sim walks off).
	Seconds int `json:"seconds"`
}

var Emotes = []Emote{
	{ID: "wave", Label: "Saluer", Emoji: "👋", Seconds: 4},
	{ID: "clap", Label: "Applaudir", Emoji: "👏", Seconds: 5},
	{ID: "thumbsup", Label: "Pouce levé", Emoji: "👍", Seconds: 4},
	{ID: "shrug", Label: "Bof", Emoji: "🤷", Seconds: 4},
	{ID: "laugh", Label: "Mort de rire", Emoji: "😂", Seconds: 5},
	{ID: "cheer", Label: "Saut de joie", Emoji: "🙌", Seconds: 5},
	{ID: "dance", Label: "Coupé-décalé", Emoji: "💃", Seconds: 10},
	{ID: "film", Label: "Selfie", Emoji: "🤳", Seconds: 6},
	{ID: "dab", Label: "Dab", Emoji: "😎", Price: 1000, Seconds: 4},
	{ID: "heart", Label: "Cœur avec les mains", Emoji: "🫶", Price: 1000, Seconds: 5},
	{ID: "salute", Label: "Salut militaire", Emoji: "🫡", Price: 1000, Seconds: 4},
	{ID: "facepalm", Label: "Ah non !", Emoji: "🤦", Price: 1000, Seconds: 4},
	{ID: "cry", Label: "Pleurer", Emoji: "😭", Price: 1000, Seconds: 6},
	{ID: "kiss", Label: "Bisou volant", Emoji: "😘", Price: 1500, Seconds: 5},
	{ID: "bow", Label: "Révérence", Emoji: "🙇", Price: 1500, Seconds: 6},
	{ID: "flex", Label: "Gros bras", Emoji: "💪", Price: 1500, Seconds: 5},
	{ID: "airplane", Label: "Le pas de l'avion", Emoji: "✈️", Price: 2000, Seconds: 6},
	{ID: "zouglou", Label: "Zouglou", Emoji: "🥁", Price: 2500, Seconds: 10},
	{ID: "gweta", Label: "Gweta", Emoji: "🔥", Price: 3000, Seconds: 10},
	{ID: "robot", Label: "Robot", Emoji: "🤖", Price: 3000, Seconds: 8},
	{ID: "shout", Label: "Atalaku", Emoji: "🎤", Price: 3500, Seconds: 8},
	{ID: "moonwalk", Label: "Moonwalk", Emoji: "🕺", Price: 4000, Seconds: 8},
	{ID: "meditate", Label: "Méditer", Emoji: "🧘", Price: 4000, Seconds: 10},
	{ID: "kneeslide", Label: "But en or", Emoji: "⚽", Price: 5000, Seconds: 6},
}

func FindEmote(id string) (Emote, bool) {
	for _, e := range Emotes {
		if e.ID == id {
			return e, true
		}
	}
	return Emote{}, false
}
