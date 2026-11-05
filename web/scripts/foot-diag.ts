// Where a scripted human's console match against the AI is won (foot-human.ts' hands): by team, the
// shots, the saves, the first touches and the heavy ones, the balls lost on a control, the possession,
// the turnovers; the human's steals, the offsides and headers at goal. Run from web/:
//   npx esbuild scripts/foot-diag.ts --bundle --platform=node --format=esm --outfile=/tmp/foot-diag.mjs && node /tmp/foot-diag.mjs
// (SIZE=5|11, FOE=, N= seeds, AI=1: the AI on both sides.)
import { createGame, seeded, step, type Game, type Input } from '../src/streetball/game'
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
function play(size: 5 | 11, seed: number, foe: number) {
  const g: Game = createGame('foot', 'Moi', seeded(seed), { size, switching: true, referee: true, length: size === 11 ? 360 : 240, foe })
  if (env.AI) {
    for (const p of g.ps) p.human = false
    g.switching = false
  }
  const dt = 1 / 60
  let charging = 0
  const T = { res: [0, 0, 0, 0, 0, 0], leak: [0, 0], shots: [0, 0], dist: [0, 0], wide: [0, 0], saves: [0, 0], ctrl: [0, 0], heavy: [0, 0], lostCtrl: [0, 0], poss: [0, 0], turnovers: [0, 0], humanSteals: 0, offside: 0, headers: 0, inter: 0, tackles: 0, slides: 0 }
  let lastShot: { save: boolean } | null = null
  let sc = [0, 0]
  let track = -1
  let trackT = 0
  let lastOwnerTeam = -1
  let lastFlash = ''
  for (let i = 0; i < 60 * 60 * 12 && g.phase !== 'over'; i++) {
    const me = g.ps[g.me]
    const b = g.ball
    const has = b.owner === me.id
    const inp: Input = { mx: 0, mz: 0, pass: false, shoot: false, skill: false, defend: false, guard: false, sprint: false, charge: false }
    const goalX = g.field.x
    if (has) {
      const [dx, dz] = [goalX - me.x, -me.z]
      const l = Math.hypot(dx, dz) || 1
      inp.mx = dx / l
      inp.mz = dz / l
      inp.sprint = true
      if (l < (size === 11 ? 22 : 12) || (g.set && g.set.taker === me.id)) {
        charging += dt
        // (Aiming: the stick to the corner away from their keeper, as anyone who plays does.)
        const k = g.ps.find((q) => q.keeper && q.team !== me.team)
        if (k && !g.set) inp.mz = k.z > 0 ? -0.75 : 0.75
        inp.charge = charging < 0.55
        if (!inp.charge) charging = 0
      }
    } else {
      charging = 0
      const [dx, dz] = [b.x - me.x, b.z - me.z]
      const l = Math.hypot(dx, dz) || 1
      inp.mx = dx / l
      inp.mz = dz / l
      inp.sprint = l > 4
      if (l > 15 && i % 90 === 0) inp.swap = true
      if (l < 1.3 && i % 20 === 0) inp.defend = true
    }
    const before = b.owner >= 0 ? g.ps[b.owner] : null
    const wasCtrl = !!before && before.act === 'control'
    step(g, dt, inp)
    // The team 0 shots' ends: in, the keeper's, another's (blocked, cleared), out (a goal kick, a corner), else.
    if (track >= 0) {
      const tt = g.time - trackT
      if (g.score[0] > sc[0]) (T.res[0]++, (track = -1))
      else if (b.owner >= 0 && g.ps[b.owner].keeper && g.ps[b.owner].team === 1) (T.res[1]++, (track = -1))
      else if (b.owner >= 0 && g.ps[b.owner].team === 1) (T.res[2]++, (track = -1))
      else if (g.set) (T.res[3]++, (track = -1))
      else if (b.owner >= 0) (T.res[4]++, (track = -1))
      else if (tt > 3) (T.res[5]++, (track = -1))
    }
    if (g.shot && g.shot !== lastShot && g.ps[b.lastBy].team === 0) {
      track = 0
      trackT = g.time
    }
    if (g.shot && g.shot !== lastShot) {
      const by = g.ps[b.lastBy]
      T.shots[by.team]++
      if (g.shot.save) T.saves[by.team]++
      T.dist[by.team] += Math.hypot(g.shot.goalX - by.x, by.z)
      if (Math.abs(g.shot.z) > g.field.mouth) T.wide[by.team]++
      lastShot = g.shot
    }
    for (const k of [0, 1]) if (g.score[k] > sc[k] && lastShot?.save) T.leak[k]++
    sc = [...g.score]
    const f = g.flash?.text ?? ''
    if (f !== lastFlash) {
      if (/Hors-jeu/i.test(f)) T.offside++
      if (/Tête/.test(f)) T.headers++
      if (/Interception/.test(f)) T.inter++
      if (/taclé|récupéré/.test(f)) T.tackles++
      if (/Tacle glissé/.test(f)) T.slides++
      lastFlash = f
    }
    for (const p of g.ps)
      if (p.act === 'control' && p.at <= dt) {
        T.ctrl[p.team]++
        if (p.ctrl?.heavy) T.heavy[p.team]++
      }
    if (before && wasCtrl && b.owner >= 0 && g.ps[b.owner].team !== before.team) T.lostCtrl[before.team]++
    if (b.owner >= 0) {
      const tm = g.ps[b.owner].team
      T.poss[tm] += dt
      if (lastOwnerTeam >= 0 && tm !== lastOwnerTeam) T.turnovers[lastOwnerTeam]++
      lastOwnerTeam = tm
    }
  }
  T.humanSteals = g.stats.steals
  for (const k of [0, 1]) T.dist[k] /= Math.max(1, T.shots[k])
  return { score: g.score.join('-'), T }
}
const N = Number(env.N ?? 4)
for (const size of (env.SIZE ? [Number(env.SIZE)] : [5, 11]) as (5 | 11)[])
  for (const foe of env.FOE ? [Number(env.FOE)] : [1]) {
    const sum: Record<string, number[]> = {}
    const scores: string[] = []
    for (let s = 0; s < N; s++) {
      const r = play(size, 3 + s * 4, foe)
      scores.push(r.score)
      for (const [k, v] of Object.entries(r.T)) {
        const a = Array.isArray(v) ? v : [v]
        sum[k] = (sum[k] ?? a.map(() => 0)).map((x, i) => x + a[i] / N)
      }
    }
    console.log(size, foe, scores.join(' '), JSON.stringify(Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v.map((x) => +x.toFixed(1))]))))
  }
