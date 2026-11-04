import { setExpression, type Expression } from '../avatar/expressions'
import { sfx } from '../lib/sfx'
import { commentFor } from './commentary'
import type { Game, Moment } from './game'

// What a basketball match gives the ear and the eye besides the play itself (StreetMatch.tsx Loop):
// the ball on the floor (the concrete's slap, the parquet's boom), the iron's clang, the board's thud,
// the net, the whistle, the buzzer, the crowd going up; the players' faces at each moment (the scorer
// proud, the man blocked or robbed annoyed, the free-throw shooter focused); the commentator's line;
// and after a dunk, the ask for its replay (StreetMatch.tsx plays it with replay.ts, alone on the phone).

/** A face for a while on a player of the match (scene.tsx PlayerView's faceId). */
const face = (i: number, e: Expression, ms = 2600) => setExpression(`basket-${i}`, e, ms)

export class HoopFeel {
  readonly game: Game
  /** The commentator's line on the screen, and when (the moment's time). */
  comment: { text: string; k: number } | null = null
  private seen: number
  private rim: number
  private swish: number
  private board: number
  private whistle: number
  private prevY = 0
  private prevVy = 0
  private lastBounce = 0
  private ended = false
  private opened = false
  /** A dunk's replay to play once it's down (its moment, the ring): taken by StreetMatch's Loop. */
  replayAsk: { t: number; ring: [number, number] } | null = null
  private lastReplay = -99
  private clock = 0
  constructor(g: Game) {
    this.game = g
    const last = g.moments[g.moments.length - 1]
    this.seen = last ? last.t : -99
    this.rim = g.rim.t
    this.swish = g.swish
    this.board = g.board
    this.whistle = g.ref.whistle
  }

  /** After the match has stepped: the frame kept (for a replay), the sounds, the faces, the words. `alone`: no other phone in the match. */
  frame(dt: number, alone: boolean) {
    const g = this.game
    const b = g.ball
    const street = g.street
    if (!this.opened && g.time > -2) {
      this.opened = true
      this.comment = { text: commentFor(g, 'kickoff') ?? '', k: g.time }
    }
    if (this.comment && g.time - this.comment.k > 4.5) this.comment = null
    // The ball on the floor: a dribble, a loose ball bouncing.
    const vy = dt > 0 ? (b.y - this.prevY) / dt : 0
    if (this.prevVy < -0.4 && vy >= 0 && b.y < 0.35 && g.time - this.lastBounce > 0.12) {
      this.lastBounce = g.time
      const me = g.ps[g.me]
      const near = Math.hypot(b.x - me.x, b.z - me.z)
      sfx.dribble(g.full, Math.max(0.25, 1 - near / 14))
    }
    this.prevY = b.y
    this.prevVy = vy
    if (g.rim.t > this.rim + 0.05) {
      this.rim = g.rim.t
      sfx.clang(Math.min(1, g.rim.amp * 10))
    }
    if (g.swish > this.swish + 0.05) {
      this.swish = g.swish
      sfx.net(street)
    }
    if (g.board > this.board + 0.05) {
      this.board = g.board
      sfx.board(street)
    }
    if (g.ref.whistle > this.whistle + 0.05) {
      this.whistle = g.ref.whistle
      sfx.whistle()
    }
    // The shot clock's last seconds tick on the full court.
    if (g.full && g.clock >= 0 && g.clock < 5 && Math.ceil(g.clock) !== this.clock && g.phase === 'play') sfx.tick(1.4)
    this.clock = Math.ceil(g.clock)
    if (g.phase === 'over' && !this.ended) {
      this.ended = true
      if (g.full) sfx.buzzer(true)
      const won = g.score[0] === g.score[1] ? null : g.score[0] > g.score[1] ? 0 : 1
      g.ps.forEach((p, i) => won !== null && face(i, p.team === won ? 'cheer' : 'sad', 6000))
    }
    for (const m of g.moments) {
      if (m.t <= this.seen) continue
      this.seen = m.t
      this.moment(m, alone)
    }
  }

  private moment(m: Moment, alone: boolean) {
    const g = this.game
    const by = g.ps[m.by]
    if (!by) return
    // (The small ones not every time.)
    const line = (m.kind === 'basket' || m.kind === 'miss' || m.kind === 'geste') && Math.random() > 0.45 ? null : commentFor(g, m.kind, m.by)
    if (line) this.comment = { text: line, k: m.t }
    const mates = (team: 0 | 1) => g.ps.map((q, i) => [q, i] as const).filter(([q]) => q.team === team && !q.out)
    const other: 0 | 1 = by.team === 0 ? 1 : 0
    switch (m.kind) {
      case 'dunk':
      case 'alley':
      case 'gbe':
      case 'three':
      case 'basket': {
        const big = m.kind !== 'basket'
        face(m.by, big ? 'cheer' : 'proud', 3000)
        for (const [, i] of mates(by.team)) if (i !== m.by) face(i, big ? 'laugh' : 'grin', 2400)
        for (const [, i] of mates(other)) face(i, big ? 'disappointed' : 'annoyed', 2200)
        if (big && !(street(g) && (m.kind === 'dunk' || m.kind === 'gbe'))) sfx.roar()
        // A dunk: its replay (the player's side's every time, the others' now and then).
        if ((m.kind === 'dunk' || m.kind === 'alley' || m.kind === 'gbe') && alone && (by.team === g.ps[g.me].team || g.time - this.lastReplay > 40)) {
          this.replayAsk = { t: m.t, ring: g.hoops[by.team] }
          this.lastReplay = m.t
        }
        break
      }
      case 'block':
        face(m.by, 'shout', 2400)
        if (!street(g)) sfx.roar()
        break
      case 'steal':
        face(m.by, 'proud', 2200)
        break
      case 'ankle':
        face(m.by, 'proud', 2400)
        sfx.ooh()
        break
      case 'miss':
        face(m.by, 'disappointed', 1800)
        if (g.full && (m.t * 3.1) % 1 < 0.3) sfx.ooh()
        break
      case 'foul':
        face(m.by, 'annoyed', 2600)
        break
      case 'ft':
        face(m.by, 'concentrate', 3500)
        break
      case 'clock':
        sfx.buzzer()
        for (const [, i] of mates(by.team)) face(i, 'annoyed', 2000)
        break
      case 'jump':
        face(m.by, 'effort', 1500)
        break
    }
  }
}

const street = (g: Game) => g.street
