// The feel of the football and the basketball (src/streetball/game.ts), measured with a scripted pair of hands:
// how fast the player gets going and stops, how a reversal and a 90° cut go (no instant turns), the
// ball at the feet or in the hand (no jump from one step to the next), the presses made while busy
// (buffered, not lost), and a pass taken first-time. Run from web/:
//   npx esbuild scripts/feel-sim.ts --bundle --platform=node --format=esm --outfile=/tmp/feel-sim.mjs && node /tmp/feel-sim.mjs
import { createGame, seeded, step, pass, NO_INPUT, type Game, type Input, type Player, type Rules, type Sport } from '../src/streetball/game'

const dt = 1 / 60
const hyp = Math.hypot

/** A match with only the local player moving (the others standing far off), past the countdown, the ball given to him or not. */
function bench(sport: Sport, rules: Rules, ball: boolean) {
  const g: Game = createGame(sport, 'Moi', seeded(5), rules)
  while (g.phase !== 'play') step(g, dt, NO_INPUT)
  for (let i = 0; i < 30; i++) step(g, dt, NO_INPUT)
  const me = g.ps[g.me]
  for (const p of g.ps) {
    if (p === me) continue
    p.human = false
    p.x = (p.team === me.team ? -1 : 1) * 30 + p.id
    p.z = 30
  }
  me.x = 0
  me.z = 0
  me.vx = me.vz = 0
  me.act = 'none'
  g.ball.flight = null
  g.set = null
  g.inb = null
  g.ft = null
  g.tip = -1
  g.hold = 0
  g.shot = null
  if (ball) {
    g.ball.owner = me.id
    g.ball.rel = undefined
  } else {
    g.ball.owner = -1
    g.ball.x = 40
    g.ball.z = 40
    g.ball.vx = g.ball.vz = g.ball.vy = 0
  }
  // The others don't move.
  for (const p of g.ps) if (p !== me) p.think = 1e9
  return g
}

const hold = (mx: number, mz: number, extra: Partial<Input> = {}): Input => ({ ...NO_INPUT, mx, mz, ...extra })

function run(g: Game, input: (t: number) => Input, secs: number, each: (t: number) => void, free: Player[] = [], remote?: Player) {
  const others = g.ps.filter((p) => p.id !== g.me && !free.includes(p))
  for (let i = 0; i < secs / dt; i++) {
    const t = i * dt
    // A court match: the hands are another phone's, handed to the host's step.
    if (remote) step(g, dt, NO_INPUT, new Map([[remote.id, input(t)]]))
    else step(g, dt, input(t))
    // Keep the others out of it.
    for (const p of others) {
      p.want = [0, 0]
      p.vx = p.vz = 0
      p.x = (p.team === g.ps[g.me].team ? -1 : 1) * 30 + p.id
      p.z = 30
    }
    if (g.sport === 'basket') g.clock = 24
    each(t)
  }
}

function moves(label: string, sport: Sport, rules: Rules, ball: boolean) {
  // Going: the time to 90 % of the top speed; stopping: the time and the distance from top speed.
  let g = bench(sport, rules, ball)
  let me = g.ps[g.me]
  let top = 0
  let t90 = -1
  const sp: number[] = []
  run(
    g,
    () => hold(1, 0),
    2,
    () => sp.push(hyp(me.vx, me.vz)),
  )
  top = Math.max(...sp)
  t90 = sp.findIndex((v) => v >= top * 0.9) * dt
  const x0 = me.x
  let tStop = -1
  run(
    g,
    () => hold(0, 0),
    2,
    (t) => {
      if (tStop < 0 && hyp(me.vx, me.vz) < 0.3) tStop = t
    },
  )
  const stopD = me.x - x0
  // A reversal at top speed: the time until running the other way at half speed.
  g = bench(sport, rules, ball)
  me = g.ps[g.me]
  run(
    g,
    () => hold(1, 0),
    1.5,
    () => {},
  )
  let tRev = -1
  let peakA = 0
  let pv = [me.vx, me.vz]
  run(
    g,
    () => hold(-1, 0),
    2,
    (t) => {
      if (tRev < 0 && me.vx < -top * 0.5) tRev = t
      peakA = Math.max(peakA, hyp(me.vx - pv[0], me.vz - pv[1]) / dt)
      pv = [me.vx, me.vz]
    },
  )
  // A 90° cut at top speed: the radius of the turn (how far it carries him on along the old line) and the speed kept.
  g = bench(sport, rules, ball)
  me = g.ps[g.me]
  run(
    g,
    () => hold(1, 0),
    1.5,
    () => {},
  )
  const cx = me.x
  let carry = 0
  let minSp = 99
  let faceRate = 0
  let pf = me.face
  run(
    g,
    () => hold(0, 1),
    1,
    () => {
      carry = Math.max(carry, me.x - cx)
      minSp = Math.min(minSp, hyp(me.vx, me.vz))
      let d = me.face - pf
      d = Math.atan2(Math.sin(d), Math.cos(d))
      faceRate = Math.max(faceRate, Math.abs(d) / dt)
      pf = me.face
    },
  )
  // The ball: its biggest jump from one 60th to the next, relative to the player (snapping), while dribbling a zig-zag.
  let jump = 0
  let bounces = 0
  if (ball) {
    g = bench(sport, rules, true)
    me = g.ps[g.me]
    const b = g.ball
    let rel = [b.x - me.x, b.y, b.z - me.z]
    let vy = 0
    run(
      g,
      (t) => (Math.floor(t / 0.8) % 2 ? hold(1, 0.7) : hold(1, -0.7)),
      4,
      (t) => {
        const r = [b.x - me.x, b.y, b.z - me.z]
        if (b.owner === me.id && t > 0.05) jump = Math.max(jump, hyp(r[0] - rel[0], r[1] - rel[1], r[2] - rel[2]))
        const v = (r[1] - rel[1]) / dt
        if (vy < -0.3 && v >= 0) bounces++
        vy = v
        rel = r
      },
    )
  }
  const f = (x: number, n = 2) => x.toFixed(n)
  console.log(
    `${label.padEnd(16)} top ${f(top, 1)} m/s · 90% in ${f(t90)} s · stop ${f(tStop)} s over ${f(stopD)} m · reversal ${f(tRev)} s (peak ${f(peakA, 0)} m/s²) · 90° cut carries ${f(carry)} m, keeps ${f(minSp, 1)} m/s, face ≤ ${f(faceRate, 1)} rad/s${ball ? ` · ball jump ≤ ${f(jump, 3)} m/frame${sport === 'basket' ? `, ${f(bounces / 4, 1)} bounces/s` : ''}` : ''}`,
  )
}

/** A team-mate's pass on its way, Passe pressed (once) a little before it arrives: how often it goes straight back out first time (buffered, not lost). */
function buffered(label: string, sport: Sport, rules: Rules, online = false) {
  let done = 0
  let when = 0
  const N = 12
  for (let k = 0; k < N; k++) {
    const g = bench(sport, rules, false)
    const local = g.ps[g.me]
    const mate = g.ps.find((p) => p.team === local.team && p !== local && !p.keeper && !p.out)!
    // Online: the one the pass is for is another phone's player (the host steps his hands), the local one out of it.
    const me = online ? g.ps.find((p) => p.team === local.team && p !== local && p !== mate && !p.keeper && !p.out)! : local
    if (online) {
      me.human = true
      me.x = me.z = 0
      me.vx = me.vz = 0
      me.act = 'none'
      g.switching = false
      local.z = -25
    }
    mate.x = -8
    mate.z = 0
    mate.act = 'none'
    mate.cool = 0
    g.ball.owner = mate.id
    g.ball.x = -7.6
    g.ball.z = 0
    g.ball.y = 0.2
    pass(g, mate, [1, 0])
    // Pressed 0.15 s to 0.48 s after the pass (it takes about 0.6 s to get there).
    const at = 0.15 + k * 0.03
    let got = -1
    let out = -1
    run(
      g,
      (t) => (t >= at && t < at + dt ? hold(0, 0, { pass: true }) : hold(0, 0)),
      1.6,
      (t) => {
        if (g.ball.owner === me.id && got < 0) got = t
        else if (got >= 0 && out < 0 && g.ball.owner !== me.id && g.ball.lastBy === me.id) out = t
      },
      online ? [mate, me] : [mate],
      online ? me : undefined,
    )
    if (out >= 0) {
      done++
      when += out - got
    }
  }
  console.log(`${(online ? label + ' (en ligne)' : label).padEnd(16)} Passe pressed as the ball comes: ${done}/${N} played first time${done ? ` (${(when / done).toFixed(2)} s after the touch)` : ''}`)
}

const MODES: [string, Sport, Rules][] = [
  ['stade', 'foot', { size: 11, referee: true, switching: true }],
  ['foot 5', 'foot', { referee: true, switching: true }],
  ['foot de rue', 'foot', { street: true }],
  ['basket rue', 'basket', { street: true }],
  ['palais', 'basket', { full: true }],
]
for (const [name, sport, rules] of MODES) {
  moves(name, sport, rules, false)
  moves(name + ' +ballon', sport, rules, true)
  buffered(name, sport, rules)
  buffered(name, sport, rules, true)
}
