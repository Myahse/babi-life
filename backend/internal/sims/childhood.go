package sims

import (
	"context"
	"slices"

	"github.com/myahse/babi-life/backend/internal/features"
	"github.com/myahse/babi-life/backend/internal/game"
)

// The friend from childhood (the update « ami-enfance »): made the first time
// at the crèche or at school, from the quarter and the same age, beside the Sim
// in class and at the récré (web world3d/interior/SchoolDay), and a friend still
// once both are grown up (comeOfAge).

func (s *Sim) childhoodFriend() *game.Friend {
	i := slices.IndexFunc(s.Friends, func(f game.Friend) bool { return f.Childhood })
	if i < 0 {
		return nil
	}
	return &s.Friends[i]
}

// toSchool: the first day at the crèche or at school, the friend from childhood is made; every
// day after, they're there again (seen, a little closer).
func (s *Sim) toSchool(it game.Interaction) *Event {
	if it.ID != "creche" && it.ID != "aller-ecole" || !s.minor() || features.Default.BlocksKey(context.Background(), "ami-enfance") != "" {
		return nil
	}
	if f := s.childhoodFriend(); f != nil {
		f.Seen = s.GameMinutes
		f.Friendship = min(100, f.Friendship+1)
		return nil
	}
	f := game.ChildhoodFriend(s.ID, s.HomeCommune, s.GameMinutes, newRand())
	s.Friends = append(s.Friends, f)
	where := "à l'école"
	if it.ID == "creche" {
		where = "à la crèche"
	}
	return &Event{Kind: "life", Text: s.FirstName + " s'est fait un ami d'enfance " + where + " : " + f.Name + ". Vous allez grandir ensemble.", GameTime: s.GameMinutes}
}
