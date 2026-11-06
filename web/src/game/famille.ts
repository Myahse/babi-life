import type { FamKid, FamElder, FamVisit, Famille, Look, Sim } from '../lib/types'
import { fullLook, randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { t as tr } from '../lib/i18n'

// Le mode vie's generations and visitors (the update « mode-vie », backend sims/famille.go keeps and decides
// all of it): the looks the app draws for the house's children, elders and visitors (the same on every
// phone, from their seeds), how the years show (white hair is the server's; the slower, stooped walk is
// here), and the pregnancy's belly. Nothing per frame.

export const famOf = (sim: Pick<Sim, 'life'>): Famille | undefined => sim.life?.famille

/** A child of the house's look: drawn from its seed, with a parent's skin (the same everywhere). */
export function kidLook(kid: Pick<FamKid, 'seed' | 'gender'>, parent: Look): Required<Look> {
  const l = randomLook(kid.gender, rng(`enfant:${kid.seed}`))
  return { ...l, skin: parent.skin || l.skin, hairColor: '#1b1b1b', beard: 'none' }
}

/** An elder's look: theirs (kept by the server), else drawn from the seed; their hair as their years made it. */
export function elderLook(e: Pick<FamElder, 'look' | 'seed' | 'gender' | 'stage'> & { id?: string }): Required<Look> {
  // (The partner who stayed, « ep-<friend id> »: the face they had as the partner, HomeInside's partnerLook.)
  const l = e.look ? fullLook(e.look) : e.id?.startsWith('ep-') ? randomLook(e.gender, rng(`partner${e.id.slice(1)}`)) : randomLook(e.gender, rng(`ancien:${e.seed ?? 0}`))
  return e.stage === 'senior' ? { ...l, hairColor: '#d9d6d0' } : l
}

/** A visitor's look: the face they had when met, else drawn from their seed. */
export function visitorLook(v: Pick<FamVisit, 'look' | 'seed' | 'gender'>): Required<Look> {
  return v.look ? fullLook(v.look) : randomLook(v.gender, rng(`visite:${v.seed}`))
}

/** How fast a senior walks against the others (the steps and the way across the house). */
export const SENIOR_PACE = 0.62

/** The Sim's walk: slower once a senior. */
export const paceOf = (sim: Pick<Sim, 'life'>) => (famOf(sim)?.stage === 'senior' ? SENIOR_PACE : 1)

/** The Sim is a senior (stooped a little). */
export const isSenior = (sim: Pick<Sim, 'life'>) => famOf(sim)?.stage === 'senior'

/** The belly of a baby on its way (0 none … 1 its day), the Sim carrying it. */
export function bellyOf(sim: Pick<Sim, 'life' | 'gameMinutes'>): number {
  const e = famOf(sim)?.expecting
  if (!e || e.mother !== 'self') return 0
  return Math.max(0.35, Math.min(1, (sim.gameMinutes - e.since) / Math.max(1, e.due - e.since)))
}

/** What a part of life is called. */
export function stageLabel(id?: string): string {
  switch (id) {
    case 'jeune':
      return tr('Jeune adulte')
    case 'senior':
      return tr('Senior')
    case 'bebe':
      return tr('Bébé')
    case 'enfant':
      return tr('Enfant')
    case 'ado':
      return tr('Ado')
  }
  return tr('Adulte')
}

/** The children of the house who are 18: they can take over. */
export const heirsOf = (f?: Famille) => (f?.kids ?? []).filter((k) => k.stage === 'adulte')
