import { MOVES, NO_PAD, type Fight, type Pad } from './engine'

// The fighters of the street, from the easiest to the hardest, and how they
// fight: how quickly they see a blow coming, how often they put the guard
// up, go in, kick, catch a jump, punish a blow that missed, throw one who
// hides behind the guard, finish a chain, set off the Super.

export type FoeId = 'yao' | 'go' | 'boss' | 'koffi' | 'aya' | 'gros'
export type Foe = {
  id: FoeId
  name: string
  about: string
  gender: 'femme' | 'homme'
  seed: number
  react: number
  block: number
  aggro: number
  kick: number
  antiAir: number
  punish: number
  throws: number
  chain: number
  sup: number
  jump: number
}

export const FOES: Foe[] = [
  {
    id: 'yao',
    name: 'Petit Yao',
    about: 'Il apprend : des coups au hasard, la garde souvent baissée.',
    gender: 'homme',
    seed: 41,
    react: 0.42,
    block: 0.15,
    aggro: 0.5,
    kick: 0.3,
    antiAir: 0.05,
    punish: 0.2,
    throws: 0.05,
    chain: 0.25,
    sup: 0.3,
    jump: 0.05,
  },
  {
    id: 'go',
    name: 'La Go de Yop',
    about: 'Rapide, elle aime les pieds et les balayages.',
    gender: 'femme',
    seed: 77,
    react: 0.33,
    block: 0.27,
    aggro: 0.6,
    kick: 0.6,
    antiAir: 0.2,
    punish: 0.38,
    throws: 0.12,
    chain: 0.45,
    sup: 0.5,
    jump: 0.1,
  },
  {
    id: 'boss',
    name: "Le Boss d'Adjamé",
    about: 'Il pare, il punit, et il saisit ceux qui se cachent.',
    gender: 'homme',
    seed: 12,
    react: 0.2,
    block: 0.5,
    aggro: 0.6,
    kick: 0.4,
    antiAir: 0.5,
    punish: 0.72,
    throws: 0.35,
    chain: 0.8,
    sup: 0.9,
    jump: 0.07,
  },
]

/** What the fighter has in mind: held until `until` (a walk, the guard, crouching), the blows of a chain still to press. */
export type Mind = { next: number; until: number; held: Pad; plan: ('p' | 'k')[]; guarded: number }
export const newMind = (): Mind => ({ next: 0, until: 0, held: NO_PAD, plan: [], guarded: 0 })

/** The pad of fighter i, played by `foe`. */
export function aiPad(F: Fight, i: 0 | 1, foe: Foe, mind: Mind, rnd: () => number = Math.random): Pad {
  if (F.phase !== 'fight') return NO_PAD
  const me = F.f[i]
  const them = F.f[1 - i]
  const t = F.time
  const d = Math.abs(them.x - me.x)
  const toward = them.x >= me.x ? 1 : -1
  // How long the other has been behind the guard (a reason to throw).
  mind.guarded = them.act === 'block' ? mind.guarded + 1 / 60 : Math.max(0, mind.guarded - 1 / 30)
  // A chain under way: the next blow as soon as this one lands.
  if (mind.plan.length && me.act === 'attack' && me.hit && me.move && me.t >= MOVES[me.move].startup) {
    const b = mind.plan.shift()!
    return { ...NO_PAD, x: 0, punch: b === 'p', kick: b === 'k' }
  }
  if (me.act !== 'attack') mind.plan = []
  if (t < mind.next) return t < mind.until ? mind.held : NO_PAD
  // Each look takes a moment: the easy ones see late.
  mind.next = t + foe.react * (0.7 + rnd() * 0.6)
  const hold = (p: Partial<Pad>, s: number) => {
    mind.held = { ...NO_PAD, ...p }
    mind.until = t + s
    return mind.held
  }
  const press = (p: Partial<Pad>, plan: ('p' | 'k')[] = []) => {
    mind.plan = plan
    mind.until = 0
    return { ...NO_PAD, ...p }
  }
  const tm = them.move ? MOVES[them.move] : null
  const coming = them.act === 'attack' && tm && them.t < tm.startup + tm.active && d < tm.reach + 0.5
  const missed = them.act === 'attack' && tm && !them.hit && them.t >= tm.startup + tm.active && them.y === 0
  const up = them.y > 0.3 && them.act !== 'air' && them.act !== 'thrown'
  // A blow coming: the guard, at the right height.
  if (coming && rnd() < foe.block) return hold({ guard: true, down: tm.level === 'low' }, 0.3 + rnd() * 0.2)
  // Jumping in: the high kick catches it.
  if (up && d < 2.0 && rnd() < foe.antiAir) return press({ kick: true })
  // A blow that missed: punished with a chain.
  if (missed && d < 1.1 && rnd() < foe.punish) return press({ punch: true }, rnd() < foe.chain ? ['p', 'p'] : [])
  if (them.act === 'down' || them.act === 'getup' || them.act === 'air') return hold({ x: d > 1.4 ? toward : 0 }, 0.2)
  // The gauge full and close enough: the Super.
  if (me.meter >= 100 && d < 2.6 && them.act !== 'block' && rnd() < foe.sup * 0.5) return press({ sup: true })
  if (d > 1.5) {
    const r = rnd()
    if (r < foe.jump) return press({ up: true, x: toward })
    if (r < foe.jump + foe.aggro * 0.25 && d > 2.2) return hold({ x: toward }, 0.05)
    if (r < 0.15 * (1 - foe.aggro)) return hold({ guard: true }, 0.3)
    return hold({ x: toward }, 0.25 + rnd() * 0.35)
  }
  if (d > 1.0) {
    const r = rnd()
    if (r < foe.kick * 0.55) return press({ kick: true })
    if (r < foe.kick * 0.8) return press({ kick: true, down: true })
    return hold({ x: toward }, 0.15)
  }
  // Close.
  const r = rnd()
  if (mind.guarded > 0.4 && r < foe.throws * 2) return press({ guard: true, punch: true })
  if (r < foe.aggro) {
    const k = rnd()
    if (k < 0.55) return press({ punch: true }, rnd() < foe.chain ? (rnd() < 0.6 ? ['p', 'p'] : ['k']) : [])
    if (k < 0.75) return press({ punch: true, down: true }, rnd() < foe.chain * 0.6 ? ['k'] : [])
    if (k < 0.88) return press({ guard: true, punch: true })
    return press({ kick: true })
  }
  if (r < foe.aggro + (1 - foe.aggro) * foe.block) return hold({ guard: true, down: rnd() < 0.3 }, 0.35)
  return hold({ x: -toward }, 0.25)
}

/** The baby fight (the update « bagarre-bebe »): the cousins after the toy, the same minds, the babies' names. */
export const BABY_FOES: Foe[] = FOES.map((f, i) => ({
  ...f,
  id: (['koffi', 'aya', 'gros'] as FoeId[])[i],
  name: ['Le petit cousin Koffi', 'La cousine Aya', 'Gros Bébé'][i],
  about: ['Il tape un peu partout, et il rit en même temps.', 'Elle tire les cheveux et donne des coups de pied.', 'Le plus lourd de la famille : il pare, et il s’assoit sur toi.'][i],
}))
