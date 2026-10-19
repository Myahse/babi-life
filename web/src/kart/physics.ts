import { LAPS, locate, pointAt, type Track } from './track'

// The race: the karts (the player's and five rivals), how they drive, the
// items and what they do, the laps. Arcade handling: the kart goes where it
// points; drifting (held through a bend) charges a mini-turbo, released as
// a boost. Off the road is slow, the tyre walls bounce you back. Pure code,
// stepped by the scene each frame (and testable on its own).

export type Item = 'piment' | 'banane' | 'coco'
export const ITEMS: Record<Item, { label: string; emoji: string; help: string }> = {
  piment: { label: 'Piment', emoji: '🌶️', help: 'Un coup de boost' },
  banane: { label: 'Banane plantain', emoji: '🍌', help: 'Posée derrière toi : qui roule dessus tourne sur lui-même' },
  coco: { label: 'Noix de coco', emoji: '🥥', help: 'Lancée devant : elle file sur la piste et fait tourner qui elle touche' },
}

export type Input = { throttle: number; brake: number; steer: number; drift: boolean; use: boolean }
export const NO_INPUT: Input = { throttle: 0, brake: 0, steer: 0, drift: false, use: false }

export type Kart = {
  id: number
  name: string
  /** The one this phone drives. */
  human: boolean
  /** A real person (this phone's or another player's). */
  player: boolean
  /** Driven elsewhere (another player, or the quarter's drivers driven by the host): drawn from the network. */
  remote: boolean
  /** The other player's Sim (online). */
  sim?: string
  color: string
  x: number
  z: number
  /** Rotation about y (0 faces +z); the kart moves along (sin, cos). */
  heading: number
  speed: number
  /** The steering as shown (the wheels, the driver leaning). */
  steer: number
  /** Drifting: 0, or the side (+1 right, −1 left); the charge built up (s). */
  drift: number
  charge: number
  boost: number
  /** Spinning out (s left), and the spin shown. */
  spin: number
  spinAngle: number
  /** The little hop at the start of a drift (s left). */
  hop: number
  item: Item | null
  /** The item roulette turning (s left). */
  rolling: number
  /** Where it is on the track. */
  i: number
  s: number
  d: number
  offroad: boolean
  /** Laps done, and whether it went past the far side of the lap since the line. */
  lap: number
  half: boolean
  progress: number
  finished: number | null
  /** The rivals: how good, which line they like, when they use their item. */
  skill: number
  lane: number
  itemTimer: number
  /** Shaken (s left), after hitting the wall or another kart. */
  bump: number
  /** The drift's sparks: 0 none, 1 blue, 2 orange. */
  sparks: number
  lastInput: Input
  startHeld: number
  /** How long it has been going the wrong way, or stuck against a wall (s). */
  wrong: number
  stuck: number
}

export type Hazard = { id: string; kind: 'banane' | 'coco'; x: number; z: number; s: number; d: number; ttl: number; owner: number; seed: number }

export type Race = {
  track: Track
  karts: Kart[]
  hazards: Hazard[]
  boxes: { x: number; z: number; off: number }[]
  pads: { x: number; z: number; heading: number }[]
  /** Seconds since the start (negative during the countdown). */
  time: number
  /** Things to show the player for a moment: "Mini-turbo !", "Banane !"… */
  flash: { text: string; until: number } | null
  nextId: number
  /** Racing other players: the items thrown here, waiting to be sent to them. */
  online: boolean
  outbox: Hazard[]
}

const MAX = 23 // m/s on the road (about 83 km/h)
const OFF_MAX = 9 // in the grass
const BOOST_MAX = 31
const ACCEL = 11
const BRAKE = 24
const REVERSE = 6
const TURN = 2.1 // rad/s at speed
const WALL = 2.6 // tyre walls this far past the road's edge
export const COUNTDOWN = 3.6

const RIVALS = [
  { name: 'Ange', color: '#e8432f' },
  { name: 'Fatou', color: '#2f9e44' },
  { name: 'Koffi', color: '#f2c94c' },
  { name: 'Mariam', color: '#6d28d9' },
  { name: 'Yao', color: '#1f6fd0' },
]

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Someone on the grid: this phone's player, another player (online), or empty (a driver of the quarter). */
export type Seat = { kind: 'me' | 'player' | 'bot'; name?: string; color?: string; sim?: string }

/**
 * A race: the karts on the grid, two by two behind the line. Alone, the
 * player starts 5th of 6 among the quarter's drivers; online, the grid is the
 * players in the order they joined, the quarter's drivers after them, and
 * `botsHere` says whether this phone drives those (the host) or draws them.
 */
export function createRace(track: Track, player: { name: string; color: string }, rng: () => number = Math.random, online?: { seats: Seat[]; botsHere: boolean }): Race {
  const seats: Seat[] = online?.seats ?? [{ kind: 'bot' }, { kind: 'bot' }, { kind: 'bot' }, { kind: 'bot' }, { kind: 'me' }, { kind: 'bot' }]
  let bot = 0
  const karts: Kart[] = seats.map((seat, slot) => {
    const row = Math.floor(slot / 2)
    const s = track.n - 6 - row * 5
    const d = slot % 2 ? 2.6 : -2.6
    const [x, z] = pointAt(track, s, d)
    const i = ((s % track.n) + track.n) % track.n
    const human = seat.kind === 'me'
    const r = seat.kind === 'bot' ? RIVALS[bot++ % RIVALS.length] : null
    return {
      id: slot,
      name: human ? player.name : (seat.name ?? r!.name),
      human,
      player: seat.kind !== 'bot',
      remote: seat.kind === 'player' || (seat.kind === 'bot' && !!online && !online.botsHere),
      sim: seat.sim,
      color: human ? player.color : (seat.color ?? r!.color),
      x,
      z,
      heading: Math.atan2(track.tx[i], track.tz[i]),
      speed: 0,
      steer: 0,
      drift: 0,
      charge: 0,
      boost: 0,
      spin: 0,
      spinAngle: 0,
      hop: 0,
      item: null,
      rolling: 0,
      i,
      s: s - track.n,
      d,
      offroad: false,
      lap: 0,
      half: false,
      progress: s - track.n,
      finished: null,
      skill: seat.kind === 'bot' ? 0.9 + rng() * 0.09 : 1,
      lane: (rng() - 0.5) * 1.2,
      itemTimer: 1 + rng() * 2,
      bump: 0,
      sparks: 0,
      lastInput: NO_INPUT,
      startHeld: 0,
      wrong: 0,
      stuck: 0,
    }
  })
  const boxes = track.boxes.map((b) => {
    const [x, z] = pointAt(track, b.s, b.d)
    return { x, z, off: 0 }
  })
  const pads = track.pads.map((p) => {
    const [x, z] = pointAt(track, p.s, p.d)
    const i = ((p.s % track.n) + track.n) % track.n
    return { x, z, heading: Math.atan2(track.tx[i], track.tz[i]) }
  })
  return { track, karts, hazards: [], boxes, pads, time: -COUNTDOWN, flash: null, nextId: 1, online: !!online, outbox: [] }
}

/* ---------- Over the network: a kart as a row of numbers ---------- */

/** [x, z, heading, speed, steer, drift, boost, spinAngle, progress, finished (−1: racing), lap, sparks, hop, offroad] */
export function kartVec(k: Kart): number[] {
  return [k.x, k.z, k.heading, k.speed, k.steer, k.drift, Math.max(0, k.boost), k.spinAngle, k.progress, k.finished ?? -1, k.lap, k.sparks, k.hop, k.offroad ? 1 : 0]
}

/** A kart driven elsewhere, as last heard. */
export function applyVec(k: Kart, v: number[]) {
  ;[k.x, k.z, k.heading, k.speed, k.steer, k.drift, k.boost, k.spinAngle, k.progress] = v
  k.finished = v[9] >= 0 ? v[9] : null
  k.lap = v[10]
  k.sparks = v[11]
  k.hop = v[12]
  k.offroad = v[13] === 1
}

/** This phone takes the wheel of a kart it was only drawing (the host left): from where it is. */
export function takeOver(race: Race, k: Kart) {
  k.remote = false
  const loc = locate(race.track, k.x, k.z)
  k.i = loc.i
  k.s = loc.s
  k.d = loc.d
  // Past the far side of this lap? From how far round it was (not where it stands: behind the line at the start is the end of a lap).
  k.half = k.progress - k.lap * race.track.n > race.track.n * 0.5
}

/** The order now: the finished first (by time), then the furthest along. */
export function standings(race: Race): Kart[] {
  return [...race.karts].sort((a, b) => {
    if (a.finished !== null || b.finished !== null) return (a.finished ?? Infinity) - (b.finished ?? Infinity)
    return b.progress - a.progress
  })
}

export const playerOf = (race: Race) => race.karts.find((k) => k.human)!

function say(race: Race, text: string, k: Kart) {
  if (k.human) race.flash = { text, until: race.time + 1.4 }
}

/** What a rival does: follow its line round the lap, brake for the tight bends, use its item. */
function rivalInput(race: Race, k: Kart, player: Kart): Input {
  const tr = race.track
  const ahead = k.s + 9 + Math.max(0, k.speed) * 0.45
  const lane = clamp(k.lane + Math.sin(race.time * 0.13 + k.id * 1.7) * 0.25, -0.75, 0.75) * tr.half
  const [tx, tz] = pointAt(tr, ahead, lane)
  const want = Math.atan2(tx - k.x, tz - k.z)
  const diff = wrap(want - k.heading)
  // Further round the bend: how sharp is it?
  const j = ((Math.floor(k.s + 22) % tr.n) + tr.n) % tr.n
  const bend = Math.abs(wrap(Math.atan2(tr.tx[j], tr.tz[j]) - Math.atan2(tr.tx[k.i], tr.tz[k.i])))
  const steer = clamp(-diff * 2.6, -1, 1)
  const brake = (bend > 0.9 && k.speed > 15) || (Math.abs(diff) > 0.8 && k.speed > 10) ? 1 : 0
  let use = false
  if (k.item) {
    k.itemTimer -= 1 / 60
    if (k.itemTimer <= 0) {
      if (k.item === 'coco') use = race.karts.some((o) => o !== k && o.progress > k.progress && o.progress - k.progress < 30)
      else use = k.item === 'banane' || bend < 0.3
      if (use) k.itemTimer = 2 + Math.random() * 3
    }
  }
  void player
  return { throttle: brake ? 0 : 1, brake, steer, drift: false, use }
}

/** One step of the race. */
export function step(race: Race, dtRaw: number, input: Input) {
  const dt = Math.min(dtRaw, 1 / 20)
  const tr = race.track
  const before = race.time
  race.time += dt
  const player = playerOf(race)
  const leader = standings(race).find((k) => k.finished === null) ?? player

  for (const k of race.karts) {
    // Driven elsewhere: drawn as heard (KartNet), not moved here.
    if (k.remote) continue
    const inp = k.finished !== null ? (k.human ? { ...NO_INPUT } : rivalInput(race, k, player)) : k.human ? input : rivalInput(race, k, player)
    k.lastInput = inp
    k.bump = Math.max(0, k.bump - dt)
    k.hop = Math.max(0, k.hop - dt)
    k.steer += (inp.steer - k.steer) * Math.min(1, dt * 10)

    // The countdown: engines revving. Pressing just before the green (the last second,
    // not all along) gives a rocket start.
    if (race.time < 0) {
      if (k.human) k.startHeld = inp.throttle || inp.drift ? k.startHeld + dt : 0
      continue
    }
    if (before < 0 && race.time >= 0) {
      if (k.human ? k.startHeld > 0.1 && k.startHeld < 1 : Math.random() < 0.35) {
        k.boost = 1
        say(race, 'Départ canon !', k)
      }
    }

    // Spinning out: no control, the kart turns round and slows down.
    if (k.spin > 0) {
      k.spin -= dt
      k.spinAngle += dt * 14
      k.speed *= Math.pow(0.15, dt)
      k.drift = 0
      k.charge = 0
    } else {
      k.spinAngle = 0
      // Rubber band: a rival far ahead eases off, one far behind pushes.
      let skill = k.skill
      if (!k.player) {
        // Rubber band, against the best real driver.
        const best = Math.max(...race.karts.filter((o) => o.player).map((o) => o.progress))
        const gap = k.progress - best
        skill *= gap > 70 ? 0.92 : gap < -70 ? 1.08 : 1
      }
      const top = (k.boost > 0 ? BOOST_MAX : k.offroad ? OFF_MAX : MAX) * skill
      if (k.boost > 0) {
        k.boost -= dt
        k.speed = Math.max(k.speed, top * 0.92)
      }
      if (inp.throttle > 0) k.speed += ACCEL * inp.throttle * dt * Math.max(0, 1 - k.speed / top) * 1.6
      if (inp.brake > 0) k.speed -= BRAKE * inp.brake * dt * (k.speed > 0 ? 1 : 0.35)
      if (!inp.throttle && !inp.brake) k.speed -= Math.sign(k.speed) * Math.min(Math.abs(k.speed), 5 * dt)
      if (k.speed > top) k.speed -= Math.min(k.speed - top, 20 * dt)
      k.speed = Math.max(-REVERSE, k.speed)

      // Drifting: press with a direction at speed; the longer, the bigger the turbo when let go.
      if (inp.drift && !k.drift && Math.abs(inp.steer) > 0.3 && k.speed > 10) {
        k.drift = Math.sign(inp.steer)
        k.charge = 0
        k.hop = 0.22
      }
      if (k.drift && (!inp.drift || k.speed < 7)) {
        if (k.speed >= 7 && k.charge > 1.7) {
          k.boost = Math.max(k.boost, 1.3)
          say(race, 'Super mini-turbo !', k)
        } else if (k.speed >= 7 && k.charge > 0.8) {
          k.boost = Math.max(k.boost, 0.7)
          say(race, 'Mini-turbo !', k)
        }
        k.drift = 0
        k.charge = 0
      }
      let turn: number
      if (k.drift) {
        // Round the bend on the drift: steering tightens or widens it.
        turn = k.drift * (1.05 + 0.55 * k.drift * inp.steer) * TURN * 0.62
        k.charge += dt * (0.7 + 0.5 * Math.abs(inp.steer))
      } else {
        const grip = clamp(k.speed / 7, -1, 1) * (1 - 0.3 * Math.min(1, Math.abs(k.speed) / MAX))
        turn = inp.steer * TURN * grip
      }
      k.sparks = k.drift ? (k.charge > 1.7 ? 2 : k.charge > 0.8 ? 1 : 0) : 0
      k.heading = wrap(k.heading - turn * dt)
    }

    // Move along the heading.
    const [fx, fz] = [Math.sin(k.heading), Math.cos(k.heading)]
    k.x += fx * k.speed * dt
    k.z += fz * k.speed * dt
    // A drift slides the back out a little.
    if (k.drift) {
      k.x += Math.cos(k.heading) * k.drift * k.speed * 0.08 * dt
      k.z += -Math.sin(k.heading) * k.drift * k.speed * 0.08 * dt
    }

    // Where on the track: the grass, the tyre walls.
    const prevS = k.i
    const loc = locate(tr, k.x, k.z, k.i)
    k.i = loc.i
    k.d = loc.d
    k.offroad = Math.abs(loc.d) > tr.half + 0.3
    if (Math.abs(loc.d) > tr.half + WALL) {
      const [wx, wz] = pointAt(tr, loc.i, Math.sign(loc.d) * (tr.half + WALL - 0.05))
      k.x = wx
      k.z = wz
      // Bounce: the kart turns back toward the road, and loses speed.
      const way = Math.atan2(tr.tx[loc.i], tr.tz[loc.i])
      k.heading = wrap(way + wrap(k.heading - way) * 0.4)
      k.speed *= 0.55
      k.bump = 0.3
      k.drift = 0
    }

    // The lap: over the line with the far side seen counts one.
    const n = tr.n
    if (loc.i > n * 0.45 && loc.i < n * 0.6) k.half = true
    if (prevS > n * 0.8 && loc.i < n * 0.2) {
      if (k.half) {
        k.lap += 1
        k.half = false
        if (k.lap >= LAPS && k.finished === null) {
          k.finished = race.time
          say(race, 'Arrivée !', k)
        } else if (k.lap === LAPS - 1) say(race, 'Dernier tour !', k)
      }
    } else if (prevS < n * 0.2 && loc.i > n * 0.8 && k.lap >= 0) {
      // Backwards over the line.
      k.lap -= 1
      k.half = true
    }
    k.s = loc.s
    k.progress = k.lap * n + loc.s - (loc.i > n * 0.8 && !k.half ? n : 0)

    // Going the wrong way, or stuck (in the grass against the tyres, turned round):
    // a warning, then back on the track, facing the right way.
    const along = fx * tr.tx[loc.i] + fz * tr.tz[loc.i]
    k.wrong = along < -0.3 && Math.abs(k.speed) > 2 ? k.wrong + dt : 0
    if (k.wrong > 0.7) say(race, 'Mauvais sens !', k)
    k.stuck = race.time > 2 && k.spin <= 0 && Math.abs(k.speed) < 2 && (k.offroad || !k.player) ? k.stuck + dt : 0
    if (k.stuck > (k.player ? 3 : 2) || k.wrong > 6) {
      const [rx, rz] = pointAt(tr, loc.i, 0)
      k.x = rx
      k.z = rz
      k.d = 0
      k.heading = Math.atan2(tr.tx[loc.i], tr.tz[loc.i])
      k.speed = 0
      k.drift = 0
      k.stuck = 0
      k.wrong = 0
      say(race, 'Remis sur la piste', k)
    }

    // The item boxes.
    if (!k.item && k.rolling <= 0) {
      for (const b of race.boxes) {
        if (b.off > 0) continue
        if ((b.x - k.x) ** 2 + (b.z - k.z) ** 2 < 2.4) {
          b.off = 3
          k.rolling = 1.1
        }
      }
    }
    if (k.rolling > 0) {
      k.rolling -= dt
      if (k.rolling <= 0) {
        // Further back, the better the luck.
        const rank = standings(race).indexOf(k)
        const r = Math.random()
        k.item = rank >= 4 ? (r < 0.6 ? 'piment' : r < 0.85 ? 'coco' : 'banane') : rank <= 1 ? (r < 0.6 ? 'banane' : r < 0.85 ? 'coco' : 'piment') : r < 0.34 ? 'piment' : r < 0.67 ? 'coco' : 'banane'
      }
    }
    // The boost pads.
    for (const p of race.pads) if ((p.x - k.x) ** 2 + (p.z - k.z) ** 2 < 5) {
      if (k.boost < 0.5) say(race, 'Boost !', k)
      k.boost = Math.max(k.boost, 0.9)
    }
    // Using the item.
    if (inp.use && k.item && k.spin <= 0) {
      const it = k.item
      k.item = null
      if (it === 'piment') {
        k.boost = Math.max(k.boost, 1.6)
        say(race, 'Ça pique !', k)
      } else {
        const h: Hazard =
          it === 'banane'
            ? { id: `l${race.nextId++}`, kind: 'banane', x: k.x - fx * 2.4, z: k.z - fz * 2.4, s: k.s - 2.4, d: k.d, ttl: 40, owner: k.id, seed: Math.random() * 6 }
            : { id: `l${race.nextId++}`, kind: 'coco', x: k.x + fx * 2.5, z: k.z + fz * 2.5, s: k.s + 2.5, d: clamp(k.d, -tr.half + 1, tr.half - 1), ttl: 4, owner: k.id, seed: 0 }
        race.hazards.push(h)
        // Racing others: they get it on their track too.
        if (race.online) race.outbox.push(h)
      }
    }
  }

  // The boxes come back.
  for (const b of race.boxes) b.off = Math.max(0, b.off - dt)

  // Coconuts roll on along the track; anything that hits a kart spins it.
  for (const h of race.hazards) {
    h.ttl -= dt
    if (h.kind === 'coco') {
      h.s += 34 * dt
      ;[h.x, h.z] = pointAt(tr, h.s, h.d)
    }
    for (const k of race.karts) {
      if (h.ttl <= 0 || (h.kind === 'coco' && k.id === h.owner && h.ttl > 3.6)) continue
      if ((h.x - k.x) ** 2 + (h.z - k.z) ** 2 < (h.kind === 'coco' ? 2.2 : 1.6)) {
        h.ttl = 0
        // A kart driven elsewhere spins on its own phone; here the item just goes.
        if (k.remote) continue
        if (k.boost <= 0.2 || h.kind === 'coco') {
          k.spin = h.kind === 'coco' ? 1.3 : 1.0
          k.item = k.item === 'banane' ? null : k.item
          say(race, h.kind === 'coco' ? 'Touché par une coco !' : 'Sur la banane !', k)
        }
      }
    }
  }
  race.hazards = race.hazards.filter((h) => h.ttl > 0)

  // Karts bump into each other.
  const ks = race.karts
  for (let a = 0; a < ks.length; a++)
    for (let b = a + 1; b < ks.length; b++) {
      const [p, q] = [ks[a], ks[b]]
      const dx = q.x - p.x
      const dz = q.z - p.z
      const d2 = dx * dx + dz * dz
      if (d2 > 0 && d2 < 1.7 * 1.7 && !(p.remote && q.remote)) {
        const d = Math.sqrt(d2)
        // Only the karts driven here are pushed (each phone pushes its own).
        const push = (1.7 - d) / (p.remote || q.remote ? 1 : 2)
        if (!p.remote) {
          p.x -= (dx / d) * push
          p.z -= (dz / d) * push
        }
        if (!q.remote) {
          q.x += (dx / d) * push
          q.z += (dz / d) * push
        }
        p.bump = q.bump = 0.2
        const v = (p.speed + q.speed) / 2
        p.speed = p.speed * 0.8 + v * 0.2
        q.speed = q.speed * 0.8 + v * 0.2
      }
    }
  void leader
  if (race.flash && race.time > race.flash.until) race.flash = null
}

/** The race is over for the player once they've crossed the line (the others finish behind them). */
export const playerDone = (race: Race) => playerOf(race).finished !== null

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}
