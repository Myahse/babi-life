import { keyOpenNow } from '../lib/features'

// « Blocs HD » (the update « blocs-hd »): the realistic Sims (« persos-realistes », RealHuman.tsx) still
// in blocks, finer up close: the hair sculpted in steps of small blocks (an afro round, the puffs and the
// buns in balls: detail/build.ts blob), the wax printed at half the size, painted at the atlas's own
// centimetre (detail/atlas.ts sub-texels, paint.ts waxBig), and bigger, livelier eyes (face.tsx fineEye).
// Only for the looks built while it's open (the build's cache keys it).

export const HD_KEY = 'blocs-hd'
export const hdNow = () => keyOpenNow(HD_KEY)

/** The sub-texel being painted in the finer atlas (null: painting whole texels): wax prints read it. */
let sub: [number, number] | null = null
export const subTexel = () => sub
export const setSubTexel = (s: [number, number] | null) => void (sub = s)
