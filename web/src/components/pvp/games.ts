import { Car, Coffee, Crown, Dice5, Gamepad2, Joystick, ShoppingCart, Spade, Sprout, Swords, Dices, type LucideIcon } from 'lucide-react'
import type { PvpGameId } from '../../lib/api'

// The games that can be played against a real player (update « jeux-en-ligne »,
// backend sims/pvp.go): their names, icons and colours, how they're played
// (real time, both at once; or move by move), whether they take a stake.

export type PvpLook = { title: string; icon: LucideIcon; colors: [string, string]; mode: 'direct' | 'tour'; /** Players at most (two: the others are the computer's, or wait). */ max: number; /** Can be played for Djai, between adults. */ bets: boolean; /** 18 and over, even for nothing. */ adult?: boolean; how: string }

export const PVP_GAMES: Record<PvpGameId, PvpLook> = {
  foot: { title: 'Babi Foot', icon: Gamepad2, colors: ['#ff9a3c', '#e8590c'], mode: 'direct', max: 2, bets: false, how: 'Cinq contre cinq, chacun son équipe : tu joues ton ailier, l’autre le sien, en direct.' },
  course: { title: 'La course à deux', icon: Car, colors: ['#4dabf7', '#1c7ed6'], mode: 'direct', max: 2, bets: false, how: 'Deux tours du Plateau, ta voiture contre la sienne, en direct.' },
  combat: { title: 'Le combat de rue', icon: Swords, colors: ['#ff6b6b', '#c92a2a'], mode: 'direct', max: 2, bets: false, how: 'Deux rounds gagnants, chacun son combattant, en direct.' },
  arcade: { title: 'Moustiques !', icon: Joystick, colors: ['#b197fc', '#7048e8'], mode: 'direct', max: 2, bets: false, how: 'Chacun sa borne en même temps : le meilleur score gagne, tu vois le sien monter.' },
  the: { title: 'Le thé du grin', icon: Coffee, colors: ['#ff9a3c', '#c8641e'], mode: 'direct', max: 2, bets: false, how: 'Trois verres chacun en même temps : le plus beau thé gagne.' },
  courses: { title: 'La liste de courses', icon: ShoppingCart, colors: ['#00b86b', '#00894f'], mode: 'direct', max: 2, bets: false, how: 'La même liste, en même temps : le plus rapide et le plus juste gagne.' },
  dames: { title: 'Dames 225', icon: Crown, colors: ['#b07a3c', '#4a2a12'], mode: 'tour', max: 2, bets: true, how: 'Le damier de 100 cases, coup par coup : une minute et demie par coup.' },
  huit: { title: '8 américain', icon: Spade, colors: ['#1f8a55', '#073f24'], mode: 'tour', max: 2, bets: true, how: 'Sept cartes chacun, coup par coup : une minute et demie par coup.' },
  awale: { title: 'Awalé 225', icon: Sprout, colors: ['#9c6b3a', '#4a2a12'], mode: 'tour', max: 2, bets: false, how: 'Les douze trous, coup par coup : une minute par coup.' },
  ludo: { title: 'Ludo 225', icon: Dice5, colors: ['#e03131', '#7a1020'], mode: 'tour', max: 2, bets: false, how: 'Rouge contre jaune, le dé lancé par le serveur : une minute par coup.' },
  gode: { title: 'Godé', icon: Dices, colors: ['#ffd166', '#b8860b'], mode: 'tour', max: 2, bets: true, adult: true, how: 'Le premier à trois manches : les dés lancés par le serveur, personne ne voit le dé de l’autre avant d’annoncer.' },
}

/** The games in the order the phone lists them. */
export const PVP_ORDER: PvpGameId[] = ['foot', 'course', 'combat', 'arcade', 'the', 'courses', 'dames', 'huit', 'awale', 'ludo', 'gode']

/** The window event that opens « Jouer contre un joueur » for a game (components/pvp/PvpLayer.tsx). */
export const PVP_OPEN = 'babi:pvp-open'
/** « Jouer contre un joueur »: for a game; or, a player picked (the players' list), the game to choose first. */
export const openPvp = (game?: PvpGameId, to?: string) => window.dispatchEvent(new CustomEvent(PVP_OPEN, { detail: { game, to } }))

/** A défi's kind (components/Defi.tsx) played against a player too. */
export const pvpOfDefi = (kind: string): PvpGameId | null => (['foot', 'course', 'combat', 'arcade', 'the', 'courses'].includes(kind) ? (kind as PvpGameId) : null)
