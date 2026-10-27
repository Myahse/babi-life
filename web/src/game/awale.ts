// L'awalé (abapa, comme on le joue en Côte d'Ivoire): two rows of six holes,
// four seeds in each. One takes all the seeds of a hole of one's row and sows
// them one by one, counter-clockwise, skipping the hole one started from when
// there are twelve or more. Ending in the other's row on a hole that now has
// 2 or 3 takes them, and the holes before it in that row with 2 or 3 as well;
// but not when that would take all the other has (« on ne prend pas tout »).
// When the other has nothing, one must give them some if one can. Over at 25
// (more than half), or when no one can play on: each keeps what's on their side.

/** The 12 holes: 0–5 the player's row (left to right as they see it), 6–11 the other's (right to left from the player). */
export type Awale = { holes: number[]; store: [number, number]; turn: 0 | 1; over: boolean; moves: number }

export const newAwale = (first: 0 | 1 = 0): Awale => ({ holes: Array(12).fill(4), store: [0, 0], turn: first, over: false, moves: 0 })

const mine = (side: 0 | 1, i: number) => (side === 0 ? i < 6 : i >= 6)
const rowSum = (h: number[], side: 0 | 1) => h.slice(side * 6, side * 6 + 6).reduce((a, b) => a + b, 0)

/** Sowing hole `from`: the holes after, and where the last seed fell. */
function sow(holes: number[], from: number) {
  const h = holes.slice()
  let n = h[from]
  h[from] = 0
  let i = from
  while (n > 0) {
    i = (i + 1) % 12
    if (i === from) continue
    h[i]++
    n--
  }
  return { h, last: i }
}

/** What playing `from` does: the holes after, the seeds taken, the holes they're taken from. */
export function play(a: Awale, from: number): { holes: number[]; taken: number; from: number[] } {
  const side = a.turn
  const { h, last } = sow(a.holes, from)
  const takenFrom: number[] = []
  let i = last
  while (!mine(side, i) && (h[i] === 2 || h[i] === 3)) {
    takenFrom.push(i)
    i = (i + 11) % 12
  }
  const taken = takenFrom.reduce((s, k) => s + h[k], 0)
  // Taking all the other has: the seeds stay.
  const other = (1 - side) as 0 | 1
  if (taken && taken === rowSum(h, other)) return { holes: h, taken: 0, from: [] }
  for (const k of takenFrom) h[k] = 0
  return { holes: h, taken, from: takenFrom }
}

/** The holes one may play: one's own, not empty; and when the other has none, only those that give them some. */
export function legal(a: Awale): number[] {
  if (a.over) return []
  const side = a.turn
  const own = [...Array(6)].map((_, k) => side * 6 + k).filter((i) => a.holes[i] > 0)
  const other = (1 - side) as 0 | 1
  if (rowSum(a.holes, other) > 0) return own
  return own.filter((i) => rowSum(play(a, i).holes, other) > 0)
}

/** The game after playing `from` (a legal hole). */
export function move(a: Awale, from: number): Awale {
  const r = play(a, from)
  const store: [number, number] = [...a.store]
  store[a.turn] += r.taken
  let next: Awale = { holes: r.holes, store, turn: (1 - a.turn) as 0 | 1, over: false, moves: a.moves + 1 }
  if (store[0] > 24 || store[1] > 24 || legal(next).length === 0 || next.moves >= 300) next = finish(next)
  return next
}

/** Over: what's left on each side goes to that side. */
function finish(a: Awale): Awale {
  return { ...a, holes: Array(12).fill(0), store: [a.store[0] + rowSum(a.holes, 0), a.store[1] + rowSum(a.holes, 1)], over: true }
}

/** Who won: 0, 1, or -1 for a draw (24 each). */
export const winner = (a: Awale) => (a.store[0] > a.store[1] ? 0 : a.store[1] > a.store[0] ? 1 : -1)

function value(a: Awale, side: 0 | 1): number {
  if (a.over) return (a.store[side] - a.store[1 - side]) * 100
  // The seeds taken, then a little for those kept on one's side (to play later).
  return (a.store[side] - a.store[1 - side]) * 10 + (rowSum(a.holes, side) - rowSum(a.holes, (1 - side) as 0 | 1)) * 0.5
}

function search(a: Awale, depth: number, side: 0 | 1, alpha: number, beta: number): number {
  const moves = legal(a)
  if (depth === 0 || a.over || !moves.length) return value(a, side)
  if (a.turn === side) {
    let best = -Infinity
    for (const m of moves) {
      best = Math.max(best, search(move(a, m), depth - 1, side, alpha, beta))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const m of moves) {
    best = Math.min(best, search(move(a, m), depth - 1, side, alpha, beta))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

/** The computer's hole: looking `depth` moves ahead (2 the beginner, 4 the regular, 6 the old man of the grin). */
export function think(a: Awale, depth: number, rand: () => number = Math.random): number {
  const moves = legal(a)
  let best = -Infinity
  let pick: number[] = []
  for (const m of moves) {
    const v = search(move(a, m), depth - 1, a.turn, -Infinity, Infinity)
    if (v > best + 1e-9) ((best = v), (pick = [m]))
    else if (Math.abs(v - best) < 1e-9) pick.push(m)
  }
  return pick[Math.floor(rand() * pick.length)] ?? moves[0]
}
