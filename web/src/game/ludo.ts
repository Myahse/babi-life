// Le Ludo, comme dans les cours et les maquis: four colours, four pawns each.
// A 6 brings a pawn out of its house onto its start; then each goes once
// round the 52 squares and up its own home column (5 squares) to the centre,
// reached on the exact number. Ending on another colour's pawn sends it back
// home, but not on the safe squares (the starts and the stars). A 6 or a pawn
// taken plays again; three 6 in a row and the turn passes.

export const TRACK = 52
/** A pawn's progress: -1 in its house, 0–50 round the board, 51–55 up its home column, 56 arrived. */
export const HOME = 56
export const COLORS = ['rouge', 'vert', 'jaune', 'bleu'] as const

export type Ludo = { players: number[]; pawns: number[][]; turn: number; sixes: number; winners: number[]; over: boolean }

/** Seats: 2 players face to face (0 and 2), or 4. */
export const newLudo = (n: 2 | 4): Ludo => {
  const players = n === 2 ? [0, 2] : [0, 1, 2, 3]
  return { players, pawns: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]), turn: 0, sixes: 0, winners: [], over: false }
}

/** The square on the board (0–51) of a pawn of colour c at progress p, or null off the round. */
export const square = (c: number, p: number) => (p >= 0 && p <= 50 ? (c * 13 + p) % TRACK : null)
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47])
export const isSafe = (sq: number) => SAFE.has(sq)

/** Where a pawn would go with this die, or null if it can't. */
export function target(p: number, die: number): number | null {
  if (p === HOME) return null
  if (p < 0) return die === 6 ? 0 : null
  const t = p + die
  return t > HOME ? null : t
}

/** The pawns of the colour to play that can move with this die. */
export function legal(l: Ludo, die: number): number[] {
  const c = l.players[l.turn]
  return [0, 1, 2, 3].filter((k) => target(l.pawns[c][k], die) !== null)
}

export type Moved = { game: Ludo; taken: { c: number; k: number }[]; again: boolean; arrived: boolean }

/** Moving pawn k of the colour to play by the die; then whose turn. */
export function move(l: Ludo, k: number | null, die: number): Moved {
  const c = l.players[l.turn]
  const pawns = l.pawns.map((r) => r.slice())
  const taken: { c: number; k: number }[] = []
  let arrived = false
  if (k !== null) {
    const t = target(pawns[c][k], die)!
    pawns[c][k] = t
    arrived = t === HOME
    const sq = square(c, t)
    if (sq !== null && !SAFE.has(sq))
      for (const o of l.players)
        if (o !== c)
          pawns[o].forEach((p, j) => {
            if (square(o, p) === sq) {
              pawns[o][j] = -1
              taken.push({ c: o, k: j })
            }
          })
  }
  const winners = l.winners.slice()
  if (pawns[c].every((p) => p === HOME) && !winners.includes(c)) winners.push(c)
  const over = winners.length >= l.players.length - 1
  const sixes = die === 6 ? l.sixes + 1 : 0
  // A 6 (not the third) or a pawn taken: again; else the next one still playing.
  const again = !over && !winners.includes(c) && ((die === 6 && sixes < 3) || taken.length > 0 || arrived)
  let turn = l.turn
  if (!again) {
    do turn = (turn + 1) % l.players.length
    while (!over && winners.includes(l.players[turn]))
  }
  return { game: { players: l.players, pawns, turn, sixes: again ? sixes : 0, winners, over }, taken, again, arrived }
}

/** Threatened: an other colour's pawn 1 to 6 squares behind this square on the round. */
function danger(l: Ludo, c: number, sq: number) {
  if (SAFE.has(sq)) return false
  for (const o of l.players) {
    if (o === c) continue
    for (const p of l.pawns[o]) {
      const s = square(o, p)
      if (s === null) continue
      const behind = (sq - s + TRACK) % TRACK
      if (behind >= 1 && behind <= 6) return true
    }
  }
  return false
}

/** The computer's pawn: take, arrive, come out, get safe, flee, then the one furthest on. */
export function think(l: Ludo, die: number): number | null {
  const moves = legal(l, die)
  if (!moves.length) return null
  const c = l.players[l.turn]
  let best = -Infinity
  let pick = moves[0]
  for (const k of moves) {
    const p = l.pawns[c][k]
    const t = target(p, die)!
    const r = move(l, k, die)
    const sq = square(c, t)
    const from = square(c, p)
    let v = t / 10
    v += r.taken.length * 60
    if (t === HOME) v += 45
    if (p < 0) v += 35
    if (p <= 50 && t > 50) v += 28
    if (sq !== null && SAFE.has(sq)) v += 12
    if (from !== null && danger(l, c, from)) v += 22
    if (sq !== null && danger(r.game, c, sq)) v -= 30
    if (v > best) ((best = v), (pick = k))
  }
  return pick
}

export const roll = (rand: () => number = Math.random) => 1 + Math.floor(rand() * 6)
