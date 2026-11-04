// The ball's flight for the racket and net sports (tennis.ts, volley.ts): gravity, the air's drag
// (quadratic, k = ½ ρ Cd A / m), the spin's Magnus push (topspin dips the ball, backspin floats it),
// stepped at a fixed rate so a flight foreseen (the AI's and the assist's plans) is the one played.
// And the aim: the start velocity that brings the ball to a point after a given time, found by
// flying it and correcting (the drag has no closed form).

export const G = 9.81
/** The physics' fixed step (s). */
export const DT = 1 / 120

export type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number; /** Spin along the flight: + topspin, - backspin (rad/s, ~0..400). */ spin: number }
export type Air = { /** Drag factor (1/m). */ k: number; /** Magnus factor: m/s² of dip per (rad/s · m/s). */ magnus: number }

/** One step of flight (no ground, no net). */
export function fly(b: Ball, air: Air, dt = DT) {
  const v = Math.hypot(b.vx, b.vy, b.vz)
  const d = air.k * v
  // Magnus: perpendicular to the flight in its vertical plane, down for topspin.
  const h = Math.hypot(b.vx, b.vz) || 1e-6
  const m = air.magnus * b.spin
  // (v × spin axis): the flight's normal in its vertical plane, as long as v, pointed down for topspin.
  const ax = -d * b.vx + m * ((b.vy * b.vx) / h)
  const az = -d * b.vz + m * ((b.vy * b.vz) / h)
  const ay = -G - d * b.vy - m * h
  b.vx += ax * dt
  b.vy += ay * dt
  b.vz += az * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.z += b.vz * dt
  // The spin wears off slowly in the air.
  b.spin *= 1 - 0.15 * dt
}

/** The start velocity that takes a ball from `from` to `to` in `t` seconds through this air, with this spin. */
export function aim(from: [number, number, number], to: [number, number, number], t: number, spin: number, air: Air): [number, number, number] {
  let v: [number, number, number] = [(to[0] - from[0]) / t, (to[1] - from[1]) / t + 0.5 * G * t, (to[2] - from[2]) / t]
  const steps = Math.max(1, Math.round(t / DT))
  for (let it = 0; it < 6; it++) {
    const b: Ball = { x: from[0], y: from[1], z: from[2], vx: v[0], vy: v[1], vz: v[2], spin }
    for (let i = 0; i < steps; i++) fly(b, air)
    const e = [to[0] - b.x, to[1] - b.y, to[2] - b.z]
    if (Math.hypot(e[0], e[1], e[2]) < 0.01) break
    v = [v[0] + (e[0] / t) * 1.05, v[1] + (e[1] / t) * 1.05, v[2] + (e[2] / t) * 1.05]
  }
  return v
}

/** A seeded random (the sims and the labs replay the same match). */
export function seeded(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A normal draw (Box-Muller) from a uniform random. */
export function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r())
}

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
