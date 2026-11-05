import { airborne, MOVES, NO_PAD, turn, type Fight, type Pad } from './engine'

// How the computer fights in Adjamé Storm: it circles at a distance, picks
// its moment to rush in, chains its blows, guards what it sees coming, rolls
// out of a combo when it can, punishes a blow that missed, grabs one hiding
// behind the guard, charges its special when it's safe and sets it off. Its
// skill (0 easy … 1 hard) is how quickly it sees and how well it chooses.

export type Skill = { react: number; block: number; aggro: number; punish: number; escape: number; grab: number; chain: number; sp: number }

/** The three levels (the menu's « Facile », « Normal », « Difficile »), and the ladder's climb between them. */
export function skillOf(level: number): Skill {
  const k = Math.max(0, Math.min(1, level))
  const lerp = (a: number, b: number) => a + (b - a) * k
  return { react: lerp(0.42, 0.14), block: lerp(0.15, 0.62), aggro: lerp(0.45, 0.75), punish: lerp(0.15, 0.8), escape: lerp(0.05, 0.6), grab: lerp(0.05, 0.4), chain: lerp(0.3, 0.95), sp: lerp(0.3, 0.9) }
}

export type Mind = { next: number; until: number; held: Pad; side: number; guarded: number; chain: number }
export const newMind = (): Mind => ({ next: 0, until: 0, held: NO_PAD, side: 1, guarded: 0, chain: 0 })

/** The pad of fighter i, played by the computer. */
export function aiPad(F: Fight, i: 0 | 1, sk: Skill, mind: Mind, rnd: () => number = Math.random): Pad {
  if (F.phase !== 'fight') return NO_PAD
  const me = F.f[i]
  const them = F.f[1 - i]
  const t = F.time
  const dx = them.x - me.x
  const dz = them.z - me.z
  const d = Math.hypot(dx, dz)
  const ux = dx / Math.max(d, 0.01)
  const uz = dz / Math.max(d, 0.01)
  // Round the other: sideways to the line between them.
  const sx = -uz * mind.side
  const sz = ux * mind.side
  mind.guarded = them.act === 'block' ? mind.guarded + 1 / 60 : Math.max(0, mind.guarded - 1 / 30)
  // A chain under way: « Attaque » again as each blow comes out.
  if (me.act === 'attack' && me.move && MOVES[me.move].next && mind.chain > 0 && me.t >= MOVES[me.move].startup) {
    mind.chain--
    return { ...NO_PAD, attack: true }
  }
  // Under a combo: the escape, when it's ready.
  if ((me.act === 'hit' || me.act === 'air') && me.esc <= 0 && me.combo >= 2 && rnd() < sk.escape * 0.08) return { ...NO_PAD, esc: true, x: sx, z: sz }
  if (me.act === 'down' && rnd() < sk.escape * 0.05) return { ...NO_PAD, jump: true }
  if (t < mind.next) return t < mind.until ? mind.held : { ...NO_PAD }
  // Each look takes a moment: the easy ones see late.
  mind.next = t + sk.react * (0.6 + rnd() * 0.7)
  const hold = (p: Partial<Pad>, s: number) => {
    mind.held = { ...NO_PAD, ...p }
    mind.until = t + s
    return mind.held
  }
  const press = (p: Partial<Pad>, chain = 0) => {
    mind.chain = chain
    mind.until = 0
    return { ...NO_PAD, ...p }
  }
  const tm = them.move ? MOVES[them.move] : null
  const facingMe = Math.cos(turn(them.h, Math.atan2(-dx, -dz))) > 0.4
  const coming = them.act === 'attack' && tm && them.t < tm.startup + tm.active && d < tm.reach + (tm.lunge ?? 0) * 0.25 + 0.8 && (facingMe || tm.arc < 0)
  const missed = them.act === 'attack' && tm && !them.hit && them.t >= tm.startup + tm.active && !airborne(them)
  // A blow coming: the guard (a special: a roll out of its way, sometimes).
  if (coming && tm.special && rnd() < sk.escape) return press({ esc: true, x: sx, z: sz })
  if (coming && rnd() < sk.block) return hold({ guard: true }, 0.3 + rnd() * 0.25)
  if (coming && rnd() < sk.escape * 0.4) return press({ esc: true, x: sx, z: sz })
  // A blow that missed: in, and punished.
  if (missed && d < 1.6 && rnd() < sk.punish) return press({ attack: true }, rnd() < sk.chain ? 3 : 1)
  if (missed && d < 4 && rnd() < sk.punish * 0.6) return press({ dash: true, x: ux, z: uz })
  // Down or flying: wait for it, a little way off.
  if (them.act === 'down' || them.act === 'getup' || them.act === 'air' || them.act === 'thrown') return hold({ x: d > 2.5 ? ux : sx * 0.6, z: d > 2.5 ? uz : sz * 0.6 }, 0.25)
  // The gauge full: the special, when the other is near enough and not guarding.
  if (me.meter >= 100 && d < 6 && them.act !== 'block' && rnd() < sk.sp * 0.45) return press({ sp: true })
  // Far: charge the gauge when safe, else rush in, or run in circling.
  if (d > 6) {
    const r = rnd()
    if (me.meter < 100 && r < 0.35 && them.act !== 'dash') return hold({ charge: true }, 0.5 + rnd() * 0.5)
    if (r < 0.35 + sk.aggro * 0.4) return press({ dash: true, x: ux, z: uz })
    return hold({ x: ux * 0.8 + sx * 0.4, z: uz * 0.8 + sz * 0.4 }, 0.35)
  }
  if (d > 2) {
    const r = rnd()
    if (rnd() < 0.15) mind.side = -mind.side
    if (r < sk.aggro * 0.45) return press({ dash: true, x: ux, z: uz })
    if (r < sk.aggro * 0.55) return press({ jump: true, x: ux, z: uz })
    // Circling, closing in a little.
    return hold({ x: sx * 0.9 + ux * 0.35, z: sz * 0.9 + uz * 0.35 }, 0.3 + rnd() * 0.4)
  }
  // Close.
  const r = rnd()
  if (mind.guarded > 0.4 && r < sk.grab * 2) return press({ guard: true, attack: true })
  if (r < sk.aggro) return press({ attack: true }, rnd() < sk.chain ? (rnd() < 0.6 ? 3 : 2) : rnd() < 0.5 ? 1 : 0)
  if (r < sk.aggro + (1 - sk.aggro) * sk.block) return hold({ guard: true }, 0.35)
  // Stepping round, or back out.
  if (rnd() < 0.5) return press({ esc: true, x: sx, z: sz })
  return press({ dash: true, x: -ux, z: -uz })
}
