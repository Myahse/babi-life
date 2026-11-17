import type { MiniTier } from '../../../../../world3d/minijeux'
import { RealMesh, type Recipe } from './kit'
import { FOOD } from './food'
import { GARBA } from './garba'
import { ALLOCO } from './alloco'
import { HOME } from './home'
import { WORK } from './work'
import { SCENES } from './scenes'
import { TREATS } from './treats'
import { CARE } from './care'
import { SPORT } from './sport'
import { CULTURE } from './culture'
import { NATURE } from './nature'
import { FX } from './fx'
import { EVENTS } from './events'
import { SHOP } from './shop'
import { LAGOON } from './lagoon'

// « Mini-jeux réalistes », phase 2: the props of the played actions redrawn like the concept's blocks
// (props/real/*). Only while the update is open; a prop with no recipe yet keeps its old look.

const REAL: Record<string, Recipe> = { ...FOOD, ...GARBA, ...ALLOCO, ...HOME, ...WORK, ...SCENES, ...TREATS, ...CARE, ...SPORT, ...CULTURE, ...NATURE, ...FX, ...EVENTS, ...SHOP, ...LAGOON }

/** Whether a prop has its realistic recipe. */
export const hasReal = (id: string) => id in REAL

/** A realistic prop by its id (one merged mesh). */
export function RealProp({ id, tier }: { id: string; tier: MiniTier }) {
  return <RealMesh id={id} recipe={REAL[id]} tier={tier} />
}

/** A one-off recipe drawn the same way (a scene's set built for its size: give the size in the id). */
export { RealMesh, useRealTier, useRealBuilt, propMats, bake, qOf } from './kit'

/** A prop's recipe by its id (for a scene that instances it). */
export const realRecipe = (id: string): Recipe | undefined => REAL[id]
