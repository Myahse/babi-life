import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import type { Sim } from '../lib/types'
import type { Buddy } from '../world3d/interior/SchoolDay'

/**
 * The friend from childhood (backend sims/childhood.go), as the school's scene
 * draws them: their face drawn from who they are, always the same; their chat
 * id the friend's without its « p- ».
 */
export function childhoodBuddy(sim: Pick<Sim, 'friends'>): Buddy | undefined {
  const f = sim.friends?.find((x) => x.childhood)
  if (!f) return undefined
  return { id: f.id.replace(/^p-/, ''), name: f.name, gender: f.gender, look: f.look ?? randomLook(f.gender, rng(`enfance:${f.id}`)) }
}
