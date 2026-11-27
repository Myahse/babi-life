import { keyOpenNow } from '../lib/features'
import { t as tr } from '../lib/i18n'
import type { Sim } from '../lib/types'

// Les examens avant le travail (update « examens-avant-travail », mirrors backend game/examens.go and
// sims/examens.go): no work before the BEPC (a small trade) or the BEPC and the bac (every other career)
// retaken at a lycée, en candidat libre, while the update is open. The old diplomas don't count (only
// Etudes.reBepc / reBac do); a post already held waits for them, at its rung. The server refuses all the
// same: this only says it before, and shows the way to the lycée.

export const EXAMENS_KEY = 'examens-avant-travail'
export type WorkExam = 'bepc' | 'bac'

/** The street and informal trades, open with the BEPC alone (backend game.SmallTrades). */
export const SMALL_TRADES = new Set(['maquis', 'commerce', 'transport', 'ambiance', 'coiffure', 'agriculteur', 'eleveur', 'ouvrier-agricole'])

/** The rule applies now: the update open, with the studies (where the exams are sat). */
export const examsGateOn = () => keyOpenNow(EXAMENS_KEY) && keyOpenNow('parcours-etudes')

/** The exams a career asks for (backend game.WorkExams). */
export const workExams = (career?: string | null): WorkExam[] => (!career ? [] : SMALL_TRADES.has(career) ? ['bepc'] : ['bepc', 'bac'])

/** Those it still asks of this Sim (retaken with the update open), in order; none with the update shut. */
export function workMissing(sim: Sim, career: string | null | undefined = sim.career): WorkExam[] {
  if (!career || !examsGateOn()) return []
  const e = sim.life?.etudes
  return workExams(career).filter((x) => (x === 'bepc' ? !e?.reBepc : !e?.reBac))
}

/** The exams a career asks for, said short (« BEPC », « BEPC + BAC »). */
export const examsLabel = (career: string) => workExams(career).map((x) => (x === 'bepc' ? 'BEPC' : 'BAC')).join(' + ')

/** Why this career can't be taken or worked now, the server's own sentence (null: it can); held: said as the post waiting. */
export function examsBlock(sim: Sim, career: string | null | undefined = sim.career, held = career === sim.career): string | null {
  const miss = workMissing(sim, career)
  if (!miss.length) return null
  if (miss.length === 2) return held ? tr('Ton poste t’attend : pour reprendre le travail, repasse d’abord ton BEPC puis ton BAC au lycée (en candidat libre).') : tr('Pour travailler, repasse d’abord ton BEPC puis ton BAC au lycée (en candidat libre).')
  if (miss[0] === 'bac') return held ? tr('Ton poste t’attend : pour reprendre le travail, repasse d’abord ton BAC au lycée (en candidat libre). Ton BEPC est déjà fait.') : tr('Pour travailler, repasse d’abord ton BAC au lycée (en candidat libre) : ton BEPC est déjà fait.')
  return held ? tr('Ton poste t’attend : pour reprendre le travail, repasse d’abord ton BEPC au lycée (en candidat libre).') : tr('Pour travailler, repasse d’abord ton BEPC au lycée (en candidat libre).')
}

/** The lycées (backend game.LyceeIDs). */
export const LYCEES = new Set(['lycee-classique-abidjan', 'lycee-sainte-marie-cocody', 'lycee-moderne-yopougon', 'lycee-moderne-adjame', 'lycee-moderne-treichville', 'lycee-moderne-koumassi', 'lycee-moderne-port-bouet', 'lycee-garcons-bingerville', 'college-moderne-abobo', 'college-moderne-marcory', 'college-moderne-plateau', 'lycee-scientifique-yamoussoukro', 'lycee-mamie-adjoua', 'lycee-classique-bouake', 'lycee-djibo-sounkalo', 'lycee-moderne-daloa', 'lycee-moderne-korhogo', 'lycee-moderne-man', 'lycee-moderne-san-pedro', 'college-moderne-grand-bassam'])
