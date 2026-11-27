import type { Pose } from './Human'

// Les gestes des champs (the update « agriculture »: the Sim working its plot, world3d/ferme/, and the villagers
// at work on theirs). In the rig's terms (Human.tsx usePoseRig, as jobs.ts): arms [sx, sy, sz, ex, ez], `out`
// -1 the left side, 1 the right; the body as a whole (its height, its lean forward about the hips, the head's
// nod); the legs [hip x, hip z, knee x], kept upright under a body bent at the hips. The tool in the right hand
// is world3d/ferme/outils.tsx's.

export const FERME_POSES = ['machette', 'daba', 'semer', 'arroser', 'desherber', 'traiter', 'cueillir', 'couper', 'arracher', 'etaler', 'nourrir', 'abreuver', 'oeufs', 'traire', 'mener'] as const
export type FermePose = (typeof FERME_POSES)[number]
const IS = new Set<string>(FERME_POSES)
export const isFerme = (p: string): p is FermePose => IS.has(p)

type Arm = [number, number, number, number, number]
type Body = { y?: number; x?: number; z?: number; rx?: number; rz?: number; ry?: number; head?: number }
const up = (v: number) => Math.max(0, v)
const ease = (k: number) => k * k * (3 - 2 * k)
/** A stroke: up slowly (0 → 1 over `rise` of the period), down fast; k the period's share. */
const stroke = (k: number, rise = 0.65) => (k < rise ? ease(k / rise) : 1 - ease(Math.min(1, (k - rise) / (1 - rise))))
/** The body bent `rx` forward about the hips (0.84 m up), the hips kept where they are (as the salat's bow). */
const bend = (rx: number, hip = 0.84): Body => ({ y: hip - 0.84 * Math.cos(rx), z: -0.84 * Math.sin(rx), rx, x: 0 })

/** How far forward each pose bends the body now (radians). */
function lean(pose: FermePose, t: number): number {
  switch (pose) {
    case 'machette':
      return 0.45 + stroke((t * 0.9) % 1) * -0.15
    case 'daba': {
      // Up with the hoe, the back straightening; down into the earth, bent over it.
      const k = stroke((t * 0.75) % 1, 0.6)
      return 0.62 - k * 0.38
    }
    case 'semer':
      return 0.95
    case 'desherber':
      return 1.05
    case 'arracher':
      return 0.85 - stroke((t * 0.45) % 1, 0.7) * 0.35
    case 'etaler':
      return 0.5
    case 'abreuver':
      return 0.45
    case 'oeufs':
      return 0.75
    case 'traiter':
      return 0.15
    case 'traire':
      return 0.3
    case 'arroser':
      return 0.12
    default:
      return 0.04
  }
}

export function fermeBody(pose: Pose, t: number): Body | null {
  if (!isFerme(pose)) return null
  const rx = lean(pose, t)
  // Milking: on the little stool, low by the goat (the hips down at seat height).
  if (pose === 'traire') return { ...bend(rx, 0.42), head: 0.3 }
  const knees = pose === 'desherber' || pose === 'semer' || pose === 'oeufs' ? 0.74 : 0.84
  return { ...bend(rx, knees), head: pose === 'cueillir' || pose === 'couper' ? -0.35 : pose === 'mener' ? -0.05 : 0.28 }
}

export function fermeLegs(pose: Pose, out: number, t: number): [number, number, number] | null {
  if (!isFerme(pose)) return null
  const rx = lean(pose, t)
  if (pose === 'traire') return [-1.5 - rx, out * 0.12, 1.55]
  // Bent low (the weeding, the sowing, the eggs): the knees give.
  const low = pose === 'desherber' || pose === 'semer' || pose === 'oeufs'
  // The hoe: a wide stance, one foot ahead.
  const stance = pose === 'daba' || pose === 'machette' ? out * 0.12 : 0
  return [-rx - (low ? 0.35 : 0) - stance * 1.5, out * (pose === 'daba' ? 0.1 : 0.04), low ? 0.7 : pose === 'daba' ? 0.18 : 0.06]
}

export function fermeArms(pose: Pose, out: number, t: number): Arm | null {
  if (!isFerme(pose)) return null
  const right = out > 0
  switch (pose) {
    case 'machette': {
      // The machette up behind the head and down across the bush; the other hand holding the stems back.
      const k = stroke((t * 0.9) % 1, 0.55)
      return right ? [-0.45 - k * 2.0, 0, 0.35 - k * 0.15 - (1 - k) * 0.55, -0.35 - k * 0.6, 0] : [-1.1, 0, out * 0.35, -0.5, 0]
    }
    case 'daba': {
      // Both hands on the handle: lifted over the shoulder, brought down into the earth.
      const k = stroke((t * 0.75) % 1, 0.6)
      return [-0.55 - k * 2.05, 0, out * (right ? 0.05 : -0.12), -0.25 - k * 0.55, 0]
    }
    case 'semer': {
      // The calabash of seed held at the belly; the other hand to the ground, a pinch dropped, back to the calabash.
      if (!right) return [-0.95, 0, out * -0.3, -1.65, 0]
      const k = stroke((t * 1.1) % 1, 0.5)
      return [-0.7 - (1 - k) * 0.35, 0, 0.05 + k * 0.1, -0.2 - (1 - k) * 0.9, 0]
    }
    case 'arroser': {
      // The can held out by its handle, the spout down over the row, going along it; the other hand under the spout.
      const s = Math.sin(t * 0.9)
      return right ? [-1.15, 0, 0.12 + s * 0.22, -0.35, 0] : [-1.0, 0, out * -0.05 + s * 0.2, -0.8, 0]
    }
    case 'desherber': {
      // Bent to the ground, the hands pulling the weeds in turn and throwing them aside.
      const k = up(Math.sin(t * 3.4 + (right ? 0 : Math.PI)))
      return [-0.55 - k * 0.55, 0, out * (0.12 + k * 0.25), -0.25 - k * 0.6, 0]
    }
    case 'traiter': {
      // The sprayer on the back: the left hand pumping its lever, the right sweeping the lance over the plants.
      if (!right) return [-0.35 + Math.sin(t * 4) * 0.35, 0, out * 0.32, -1.3, 0]
      return [-1.05, 0, 0.1 + Math.sin(t * 1.3) * 0.38, -0.3, 0]
    }
    case 'cueillir': {
      // Up to the pods, the cobs, the cherries in turn: twisted off, down into the basket.
      const k = stroke((t * 0.8 + (right ? 0 : 0.5)) % 1, 0.45)
      return [-0.8 - k * 1.45, 0, out * (0.18 + k * 0.1), -0.9 + k * 0.5, 0]
    }
    case 'couper': {
      // The régime high on its stem: the machette up, a cut at head height; the other hand holding the stem.
      const k = stroke((t * 0.8) % 1, 0.6)
      return right ? [-1.5 - k * 1.2, 0, 0.35 - k * 0.2, -0.3 - k * 0.5, 0] : [-2.3, 0, out * 0.2, -0.4, 0]
    }
    case 'arracher': {
      // Both hands round the stem low down, pulled up slowly with the back.
      const k = stroke((t * 0.45) % 1, 0.7)
      return [-0.7 - k * 0.6, 0, out * -0.05, -0.35 - k * 0.5, 0]
    }
    case 'etaler': {
      // Over the claie (the tarp), both hands raking the beans flat, side to side.
      const s = Math.sin(t * 2.2)
      return [-1.05, 0, out * 0.12 + s * 0.3, -0.45, 0]
    }
    case 'nourrir': {
      // The bowl of grain in the left arm; the right hand flinging handfuls out in front.
      if (!right) return [-0.95, 0, out * -0.25, -1.55, 0]
      const k = stroke((t * 0.9) % 1, 0.7)
      return [-0.55 - (1 - k) * 1.0, 0, 0.1 + (1 - k) * 0.45, -1.4 + (1 - k) * 1.2, 0]
    }
    case 'abreuver': {
      // The bucket tipped into the trough with both hands.
      const k = up(Math.sin(t * 0.7))
      return [-0.75 - k * 0.3, 0, out * 0.08, -0.6 - k * 0.2, 0]
    }
    case 'oeufs': {
      // Into the nest boxes for an egg, the basket on the other arm.
      if (!right) return [-0.3, 0, out * 0.2, -1.35, 0]
      const k = up(Math.sin(t * 1.4))
      return [-0.85 - k * 0.65, 0, 0.12, -0.9 + k * 0.6, 0]
    }
    case 'traire': {
      // Low under the goat, the hands squeezing in turn into the bowl.
      const k = up(Math.sin(t * 5 + (right ? 0 : Math.PI)))
      return [-1.05, 0, out * 0.04, -0.55 - k * 0.3, 0]
    }
    case 'mener': {
      // The herder's stick held up, now and then pointing the way; the other arm loose.
      const k = up(Math.sin(t * 0.9))
      return right ? [-0.9 - k * 0.7, 0, 0.25, -0.6 + k * 0.4, 0] : [0.05, 0, out * 0.1, -0.2, 0]
    }
  }
  return null
}

/** The tool each pose has in hand (world3d/ferme/outils.tsx). */
export type FermeTool = 'machette' | 'daba' | 'arrosoir' | 'lance' | 'calebasse' | 'baton' | 'seau' | 'bol' | 'panier' | 'rateau'
export function fermeTool(pose: Pose): FermeTool | undefined {
  switch (pose) {
    case 'machette':
    case 'couper':
      return 'machette'
    case 'daba':
      return 'daba'
    case 'arroser':
      return 'arrosoir'
    case 'traiter':
      return 'lance'
    case 'semer':
      return undefined
    case 'mener':
      return 'baton'
    case 'abreuver':
      return 'seau'
    case 'nourrir':
      return undefined
    case 'etaler':
      return 'rateau'
  }
  return undefined
}
