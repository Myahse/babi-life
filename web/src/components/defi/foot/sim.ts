import type { Team } from './teams'

// The matches the console plays out without the player (the cup's other
// ties, the league's other games): goals by the two sides' stars.

/** A count of goals around `mean` (Poisson, by Knuth's way). */
export function goals(mean: number, rnd: () => number) {
  const l = Math.exp(-mean)
  let k = 0
  let p = rnd()
  while (p > l && k < 12) {
    k++
    p *= rnd()
  }
  return k
}

/** A match's score between two sides (a draw is a draw): more goals in the maracana's five, the stronger side scoring more. */
export function scoreOf(a: Pick<Team, 'stars'>, b: Pick<Team, 'stars'>, size: 5 | 11, rnd: () => number): [number, number] {
  const base = size === 5 ? 2.4 : 1.3
  return [goals(base * Math.pow(1.22, a.stars - b.stars), rnd), goals(base * Math.pow(1.22, b.stars - a.stars), rnd)]
}

/** The match result as a score out of 100: a win from 65, by the goals between; a draw 50; a loss under 40. */
export function matchScore(mine: number, theirs: number) {
  const d = mine - theirs
  if (d > 0) return Math.min(100, 55 + d * 10 + Math.min(10, mine * 2))
  if (d === 0) return 50
  return Math.max(4, 42 - 12 * (-d - 1) + Math.min(6, mine * 3) - 6)
}
