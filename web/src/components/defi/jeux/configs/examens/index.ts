import type { Question } from '../../types'
import { BEPC_ANGLAIS, BEPC_FRANCAIS, BEPC_HISTGEO, BEPC_MATHS, BEPC_PHYSIQUE, BEPC_SVT } from './college'
import { BAC_ANGLAIS, BAC_FRANCAIS, BAC_FRANCAIS_A, BAC_HISTGEO, BAC_MATHS, BAC_MATHS_A, BAC_MATHS_C, BAC_PHILO, BAC_PHILO_A, BAC_PHYSIQUE, BAC_PHYSIQUE_C, BAC_SVT, BAC_SVT_D } from './lycee'
import { PARTIEL_DROIT, PARTIEL_ECO, PARTIEL_INFO, PARTIEL_LETTRES, PARTIEL_SCIENCES } from './partiels1'
import { PARTIEL_GENIE, PARTIEL_GESTION, PARTIEL_MEDECINE, PARTIEL_PHARMACIE } from './partiels2'

// The exams' banks (the update « parcours-etudes »), loaded only when an exam is played (engines/Quiz.tsx):
// by exam (Jeu.exam.bank), by subject (its id, the backend's game.ExamPlans). The terminale's philosophie,
// français and anglais are the same for every série; série A has more of its own, C more maths and
// physique, D more SVT. 68 questions for the BEPC, 71 for the bac A, 78 for the C, 74 for the D, 30 per
// filière for the partiels.
export const BANKS: Record<string, Record<string, Question[]>> = {
  bepc: { maths: BEPC_MATHS, francais: BEPC_FRANCAIS, 'histoire-geo': BEPC_HISTGEO, svt: BEPC_SVT, physique: BEPC_PHYSIQUE, anglais: BEPC_ANGLAIS },
  'bac-a': { philo: [...BAC_PHILO, ...BAC_PHILO_A], francais: [...BAC_FRANCAIS, ...BAC_FRANCAIS_A], 'histoire-geo': BAC_HISTGEO, anglais: BAC_ANGLAIS, maths: BAC_MATHS_A },
  'bac-c': { maths: [...BAC_MATHS, ...BAC_MATHS_C], physique: [...BAC_PHYSIQUE, ...BAC_PHYSIQUE_C], francais: BAC_FRANCAIS, svt: BAC_SVT, philo: BAC_PHILO, anglais: BAC_ANGLAIS },
  'bac-d': { svt: [...BAC_SVT, ...BAC_SVT_D], physique: BAC_PHYSIQUE, maths: BAC_MATHS, francais: BAC_FRANCAIS, philo: BAC_PHILO, anglais: BAC_ANGLAIS },
  partiel: { droit: PARTIEL_DROIT, lettres: PARTIEL_LETTRES, eco: PARTIEL_ECO, info: PARTIEL_INFO, sciences: PARTIEL_SCIENCES, medecine: PARTIEL_MEDECINE, pharmacie: PARTIEL_PHARMACIE, gestion: PARTIEL_GESTION, genie: PARTIEL_GENIE },
}
