import type { Geste, Input } from './game'

// What the match online (online.ts, which the game screen imports to join a match) needs of the game,
// without loading the whole game (game.ts, its rules and its players' AI): it comes with the match.

/** Every skill move, in the order they're offered. */
export const GESTES: Geste[] = ['passement', 'roulette', 'petitpont', 'sombrero', 'crochet', 'aile', 'talonnade', 'jongle', 'crossover', 'entrejambe', 'dos', 'spin', 'hesitation', 'show', 'pompe', 'stepback']

/** The player's hands at rest: the stick centred, no button pressed. */
export const NO_INPUT: Input = { mx: 0, mz: 0, pass: false, shoot: false, skill: false, defend: false, guard: false }
