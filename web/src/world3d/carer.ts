// Maman walking up to her baby (HomeInside Parents): while she is on her way
// (`coming`), the maman of the baby's scene (interior/doings Mother, BabyMess)
// waits; she takes over once maman is there (`here`).
export const carer = { coming: false, here: false }

/** The scene's maman can show: nobody is walking up, or she has arrived. */
export const carerShown = () => !carer.coming || carer.here

// Cleaning up after the baby (caca, pipi, vomir): maman (or the nounou, the
// gouvernante) first; if she is at it already, papa takes the next one. The
// baby is free meanwhile. Going out, the pram is pushed by whoever is free:
// maman, else papa; both busy cleaning, the baby waits at home.
const CLEANING_S = 90
export const cleaning = { maman: 0, papa: 0 }

/** A mess to clean: who takes it (null: both are at it already, it waits for maman). */
export function startCleaning(now = Date.now()): 'maman' | 'papa' | null {
  if (cleaning.maman < now) return (cleaning.maman = now + CLEANING_S * 1000), 'maman'
  if (cleaning.papa < now) return (cleaning.papa = now + CLEANING_S * 1000), 'papa'
  cleaning.maman += CLEANING_S * 1000
  return null
}

/** Who can push the pram now: maman, else papa, else nobody (both cleaning). */
export function pusher(now = Date.now()): 'maman' | 'papa' | null {
  return cleaning.maman < now ? 'maman' : cleaning.papa < now ? 'papa' : null
}
