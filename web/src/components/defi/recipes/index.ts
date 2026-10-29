import type { Pose } from '../../../avatar/Human'
import { RECIPES_1 } from './part1'
import { RECIPES_2 } from './part2'
import { RECIPES_3 } from './part3'

/** Every action's own steps (components/defi/Gestes.tsx), by its id: what the perso does, and its pose. */
export const RECIPES: Record<string, [string, Pose][]> = { ...RECIPES_1, ...RECIPES_2, ...RECIPES_3 }
