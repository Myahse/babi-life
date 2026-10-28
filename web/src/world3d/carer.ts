// Maman walking up to her baby (HomeInside Parents): while she is on her way
// (`coming`), the maman of the baby's scene (interior/doings Mother, BabyMess)
// waits; she takes over once maman is there (`here`).
export const carer = { coming: false, here: false }

/** The scene's maman can show: nobody is walking up, or she has arrived. */
export const carerShown = () => !carer.coming || carer.here
