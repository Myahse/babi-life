import { buildTrack, locate, pointAt, type Track } from '../../../kart/track'

// La course à deux, on the console of the salle de jeux: two cars round a
// street circuit of the Plateau and the lagoon at dusk, the city's traffic
// (woro-woros, gbakas, taxis) on the way. The car goes by itself; ◀ ▶ steer,
// « Frein » brakes (held in a bend at speed: a drift, that charges a
// mini-turbo), « Nitro » burns a third of the gauge for a burst. The gauge
// fills by grazing the traffic, drifting, and riding in the other's wake.
// Concrete walls line the road: hit one, you lose speed; hit a car, more.
// Pure rules, stepped by the scene (and tested on their own).

export const LAPS = 2
export const COUNTDOWN = 3
const HALF = 7 // half the road (4 lanes)
const WALL = HALF + 0.9
const MAX = 36 // m/s, about 130 km/h
const NITRO_MAX = 47
const ACCEL = 8.5
const BRAKE = 20
const TURN = 1.75
const STEP = 1 / 120
export const LANES = [-5.2, -1.75, 1.75, 5.2]

/** The street circuit: the lagoon's boulevard at the bottom, the Plateau's streets round the rest. */
export const CORNERS: [number, number][] = [
  [-189, 123],
  [-49, 131],
  [98, 123],
  [176, 98],
  [201, 45],
  [176, 0],
  [123, -8],
  [90, 29],
  [45, 33],
  [16, -16],
  [45, -74],
  [25, -131],
  [-41, -156],
  [-123, -144],
  [-168, -90],
  [-139, -37],
  [-176, 12],
  [-217, 66],
]

export type Car = {
  name: string
  color: string
  me: boolean
  x: number
  z: number
  heading: number
  speed: number
  steer: number
  /** Drifting: the side (±1), or 0; the turbo it has charged (s). */
  drift: number
  charge: number
  boost: number
  /** The nitro gauge, 0 to 1 (a burst takes a third). */
  nitro: number
  bump: number
  i: number
  s: number
  d: number
  lap: number
  half: boolean
  progress: number
  finished: number | null
  /** The rival's driving. */
  skill: number
  lane: number
}

export type Traffic = { kind: 'woro' | 'gbaka' | 'taxi'; s: number; d: number; lane: number; speed: number; len: number; seed: number; passed: boolean[] }

export type RaceEvent = { kind: 'wall' | 'bump' | 'crash' | 'graze' | 'nitro' | 'turbo' | 'lap' | 'finish' | 'pass'; me: boolean; x: number; z: number; big?: boolean; text?: string }

export type Race = {
  track: Track
  cars: [Car, Car]
  traffic: Traffic[]
  time: number
  acc: number
  events: RaceEvent[]
  over: boolean
  /** After the other has finished, the wait for the player (s). */
  wait: number
  /** The player ahead (for the overtakes). */
  lead: boolean
  /** Against a real player (components/pvp/course.tsx): the other car's hands, from its phone (none: the rival drives). */
  remote?: RaceInput | null
}

export type RaceInput = { steer: number; brake: boolean; nitro: boolean }
export const NO_INPUT: RaceInput = { steer: 0, brake: false, nitro: false }

/** A rival: its name, its car, how fast it drives, how well it slips through the traffic, how keen on the nitro. */
export type Rival = { id: 'taxi' | 'garage' | 'fou'; name: string; about: string; color: string; skill: number; eyes: number; nitro: number }
export const RIVALS: Rival[] = [
  { id: 'taxi', name: 'Le Taximan', about: 'Il connaît la route, mais il freine tôt et n’aime pas doubler.', color: '#f2c94c', skill: 0.86, eyes: 0.5, nitro: 0.3 },
  { id: 'garage', name: 'La Fille du garage', about: 'Sa voiture bleue est réglée au millimètre : elle passe partout.', color: '#1c7ed6', skill: 0.93, eyes: 0.8, nitro: 0.6 },
  { id: 'fou', name: 'Le Fou du volant', about: 'Nitro à chaque ligne droite, il frôle tout ce qui roule.', color: '#212529', skill: 0.99, eyes: 1, nitro: 1 },
]

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function car(track: Track, name: string, color: string, me: boolean, d: number, skill: number): Car {
  const s = track.n - 8
  const [x, z] = pointAt(track, s, d)
  const i = s
  return { name, color, me, x, z, heading: Math.atan2(track.tx[i], track.tz[i]), speed: 0, steer: 0, drift: 0, charge: 0, boost: 0, nitro: 0.34, bump: 0, i, s, d, lap: 0, half: false, progress: -8, finished: null, skill, lane: d }
}

export function createRace(rival: Rival, rnd: () => number = Math.random): Race {
  const track = buildTrack(CORNERS, HALF)
  const kinds: Traffic['kind'][] = ['woro', 'gbaka', 'taxi', 'woro', 'taxi', 'gbaka', 'woro']
  // The city's traffic, spread round the lap, in its lanes, slower than the race.
  const traffic: Traffic[] = Array.from({ length: 11 }, (_, k) => {
    const kind = kinds[k % kinds.length]
    const lane = Math.floor(rnd() * 4)
    return { kind, s: 120 + (k / 11) * (track.n - 200) + rnd() * 30, d: LANES[lane], lane, speed: kind === 'gbaka' ? 12 + rnd() * 3 : 15 + rnd() * 5, len: kind === 'gbaka' ? 6.4 : 4.4, seed: k, passed: [false, false] }
  })
  return { track, cars: [car(track, 'Toi', '#ff7a00', true, -2.6, 1), car(track, rival.name, rival.color, false, 2.6, rival.skill)], traffic, time: -COUNTDOWN, acc: 0, events: [], over: false, wait: 0, lead: false }
}

/** Along the lap from a to b, the shortest way (−n/2…n/2). */
const ahead = (tr: Track, a: number, b: number) => {
  const d = (((b - a) % tr.n) + tr.n) % tr.n
  return d > tr.n / 2 ? d - tr.n : d
}

/** How sharp the road turns over the next `len` metres from s (radians). */
function bendAhead(tr: Track, s: number, len: number) {
  const i = ((Math.floor(s) % tr.n) + tr.n) % tr.n
  const j = ((Math.floor(s + len) % tr.n) + tr.n) % tr.n
  return Math.abs(wrap(Math.atan2(tr.tx[j], tr.tz[j]) - Math.atan2(tr.tx[i], tr.tz[i])))
}

/** The rival's hands (or an autopilot's): its lane clear of the traffic ahead, braking for the bends, the nitro on the straights. */
export function autoDrive(R: Race, c: Car, rival: Rival): RaceInput {
  const tr = R.track
  // The traffic ahead in its lane, seen further the faster it closes in (and the better the driver):
  // over to a clear lane, or slowed down behind it if there is none.
  const look = 12 + Math.max(0, c.speed - 12) * (1.3 + 1.4 * rival.eyes)
  const inLane = (d: number) =>
    R.traffic.filter((t) => {
      const a = ahead(tr, c.s, t.s)
      return a > -t.len / 2 - 3 && a < look && Math.abs(t.d - d) < 2.4
    })
  let follow = Infinity
  if (inLane(c.lane).length) {
    const free = LANES.filter((d) => !inLane(d).length).sort((p, q) => Math.abs(p - c.d) - Math.abs(q - c.d))
    if (free.length) c.lane = free[0]
    else follow = Math.min(...inLane(c.lane).map((t) => t.speed))
  }
  const far = c.s + 10 + Math.max(0, c.speed) * 0.4
  const [tx, tz] = pointAt(tr, far, c.lane)
  const diff = wrap(Math.atan2(tx - c.x, tz - c.z) - c.heading)
  const bend = bendAhead(tr, c.s + 8, 45)
  // The speed the bend allows, and braking down to it.
  const safe = MAX * c.skill * (1 - clamp((bend - 0.35) * 0.55, 0, 0.55))
  const brake = c.speed > Math.min(safe, follow + 4) + 1.5
  const nitro = c.nitro >= 0.34 && c.boost <= 0 && bend < 0.25 && c.speed > 22 && Math.random() < rival.nitro * 0.02
  return { steer: clamp(diff * 2.4, -1, 1), brake, nitro }
}

/** The whole race, `dt` real seconds on. */
export function stepRace(R: Race, dt: number, input: RaceInput, rival: Rival) {
  R.acc += Math.min(dt, 0.1)
  let nitro = input.nitro
  while (R.acc >= STEP) {
    R.acc -= STEP
    tick(R, STEP, { ...input, nitro }, rival)
    nitro = false
  }
}

function tick(R: Race, h: number, input: RaceInput, rival: Rival) {
  const tr = R.track
  R.time += h
  // The traffic goes its way, at its pace.
  for (const t of R.traffic) t.s = (t.s + t.speed * h) % tr.n
  if (R.time < 0) return
  const [me, them] = R.cars
  for (const c of R.cars) {
    const done = c.finished !== null
    const inp = done && (c.me || R.remote) ? { steer: 0, brake: true, nitro: false } : c.me ? input : R.remote ? R.remote : autoDrive(R, c, rival)
    drive(R, c, inp, h)
  }
  // The two cars against each other: pushed apart, a little speed lost.
  const dx = them.x - me.x
  const dz = them.z - me.z
  const dist = Math.hypot(dx, dz)
  if (dist < 2.1 && dist > 0) {
    const push = (2.1 - dist) / 2
    me.x -= (dx / dist) * push
    me.z -= (dz / dist) * push
    them.x += (dx / dist) * push
    them.z += (dz / dist) * push
    if (me.bump <= 0) {
      me.speed *= 0.94
      them.speed *= 0.94
      me.bump = 0.3
      R.events.push({ kind: 'bump', me: true, x: (me.x + them.x) / 2, z: (me.z + them.z) / 2 })
    }
  }
  // Overtaking.
  if (me.finished === null && them.finished === null) {
    const lead = me.progress > them.progress
    if (lead !== R.lead) {
      R.lead = lead
      if (R.time > 2) R.events.push({ kind: 'pass', me: lead, x: me.x, z: me.z })
    }
  }
  // The end: the player across the line, or a while after the other.
  if (them.finished !== null && me.finished === null) R.wait += h
  if (me.finished !== null || R.wait > 15) R.over = true
}

function drive(R: Race, c: Car, inp: RaceInput, h: number) {
  const tr = R.track
  c.bump = Math.max(0, c.bump - h)
  c.steer += (clamp(inp.steer, -1, 1) - c.steer) * Math.min(1, h * 9)
  // Nitro: a third of the gauge, two seconds flat out.
  if (inp.nitro && c.nitro >= 0.33 && c.boost < 0.5) {
    c.nitro -= 0.33
    c.boost = 2
    R.events.push({ kind: 'nitro', me: c.me, x: c.x, z: c.z })
  }
  // The rival eases off far ahead and pushes far behind (a race to the end).
  const band = c.me || R.remote ? 1 : clamp(1 - (c.progress - R.cars[0].progress) / 2500, 0.95, 1.04)
  const top = (c.boost > 0 ? NITRO_MAX : MAX) * c.skill * band
  if (c.boost > 0) {
    c.boost -= h
    c.speed = Math.max(c.speed, Math.min(top, c.speed + 30 * h))
  }
  // Drifting: braking hard into a bend at speed; the car swings round, the turbo charges.
  if (inp.brake && !c.drift && Math.abs(c.steer) > 0.45 && c.speed > 20) {
    c.drift = Math.sign(c.steer)
    c.charge = 0
  }
  if (c.drift && (!inp.brake || c.speed < 12)) {
    if (c.charge > 0.6) {
      c.boost = Math.max(c.boost, c.charge > 1.4 ? 1.2 : 0.6)
      c.nitro = Math.min(1, c.nitro + (c.charge > 1.4 ? 0.14 : 0.07))
      R.events.push({ kind: 'turbo', me: c.me, x: c.x, z: c.z, big: c.charge > 1.4 })
    }
    c.drift = 0
  }
  if (c.drift) {
    c.charge += h
    c.speed -= 3.5 * h
  } else if (inp.brake) c.speed -= BRAKE * h
  else c.speed += ACCEL * h * Math.max(0, 1 - c.speed / top) * 1.7
  if (c.speed > top) c.speed -= Math.min(c.speed - top, 14 * h)
  c.speed = Math.max(0, c.speed)
  // Turning: quicker at speed, less sharp flat out; a drift turns tighter.
  const k = c.speed / MAX
  const rate = TURN * Math.min(1, c.speed / 10) * (1 - 0.3 * k) * (c.drift ? 1.55 : 1)
  c.heading += c.steer * rate * h + (c.drift ? c.drift * 0.25 * h : 0)
  c.x += Math.sin(c.heading) * c.speed * h
  c.z += Math.cos(c.heading) * c.speed * h
  const at = locate(tr, c.x, c.z, c.i)
  c.i = at.i
  c.d = at.d
  // The walls: back on the road, the nose turned along it, speed lost by how square it hit.
  if (Math.abs(c.d) > WALL) {
    const side = Math.sign(c.d)
    const [x, z] = pointAt(tr, at.s, side * WALL)
    c.x = x
    c.z = z
    c.d = side * WALL
    const along = Math.atan2(tr.tx[at.i], tr.tz[at.i])
    const into = Math.abs(Math.sin(wrap(c.heading - along)))
    c.heading = along + wrap(c.heading - along) * 0.3
    if (c.bump <= 0 || into > 0.3) {
      c.speed *= 1 - clamp(0.12 + into * 0.6, 0.12, 0.6)
      c.bump = 0.35
      c.drift = 0
      R.events.push({ kind: 'wall', me: c.me, x: c.x, z: c.z, big: into > 0.35 })
    }
  }
  // The traffic: run into one, the speed's gone; graze one at speed, the gauge fills.
  R.traffic.forEach((t) => {
    const a = ahead(tr, at.s, t.s)
    const side = Math.abs(t.d - c.d)
    const idx = c.me ? 0 : 1
    if (Math.abs(a) < t.len / 2 + 2.2 && side < 1.95) {
      if (c.bump <= 0 || c.speed > t.speed) {
        c.speed = Math.min(c.speed, t.speed * 0.55)
        c.bump = 0.6
        c.drift = 0
        // Thrown off to the side it hit from.
        const [x, z] = pointAt(tr, at.s - 1, c.d + (c.d >= t.d ? 1 : -1) * 0.8)
        c.x = x
        c.z = z
        R.events.push({ kind: 'crash', me: c.me, x: c.x, z: c.z, big: true, text: t.kind === 'gbaka' ? 'Le gbaka !' : t.kind === 'taxi' ? 'Le taxi !' : 'Aïe, le woro !' })
      }
    } else if (a < -t.len / 2 - 1 && a > -t.len / 2 - 6 && !t.passed[idx]) {
      t.passed[idx] = true
      if (side < 3.2 && c.speed > 24) {
        c.nitro = Math.min(1, c.nitro + 0.12)
        R.events.push({ kind: 'graze', me: c.me, x: c.x, z: c.z })
      }
    } else if (a > 20) t.passed[idx] = false
  })
  // In the other's wake: the gauge fills a little.
  const o = R.cars[c.me ? 1 : 0]
  const behind = ahead(tr, at.s, o.s)
  if (behind > 3 && behind < 14 && Math.abs(o.d - c.d) < 1.6 && c.speed > 22) c.nitro = Math.min(1, c.nitro + 0.05 * h)
  // The laps: past the far side, then over the line.
  if (at.i > tr.n * 0.4 && at.i < tr.n * 0.6) c.half = true
  const prev = c.s
  c.s = at.s
  if (c.half && prev > tr.n * 0.8 && at.s < tr.n * 0.2) {
    c.lap++
    c.half = false
    if (c.lap >= LAPS && c.finished === null) {
      c.finished = R.time
      R.events.push({ kind: 'finish', me: c.me, x: c.x, z: c.z })
    } else R.events.push({ kind: 'lap', me: c.me, x: c.x, z: c.z })
  }
  c.progress = c.lap * tr.n + (c.half || at.s < tr.n * 0.5 ? at.s : at.s - tr.n)
}

/** First or not, and by how many seconds. */
export function standing(R: Race): { first: boolean; gap: number } {
  const [me, them] = R.cars
  if (me.finished !== null && them.finished !== null) return { first: me.finished <= them.finished, gap: Math.abs(them.finished - me.finished) }
  if (me.finished !== null) return { first: true, gap: (LAPS * R.track.n - them.progress) / Math.max(10, them.speed) }
  return { first: false, gap: R.wait + (LAPS * R.track.n - me.progress) / Math.max(10, me.speed) }
}

/** The race as a score out of 100: a win by the rival's rank (70, 85, 100 at most) and the lead; second, by how close. */
export function raceScore(first: boolean, gap: number, rank = 2) {
  const top = [70, 85, 100][rank] ?? 100
  return first ? Math.round(clamp(top - 25 + gap * 5, top - 25, top)) : Math.round(clamp(45 - gap * 3, 5, 45))
}
