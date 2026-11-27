// The village plots as landmarks in the street (open/landmarks.tsx, the update « agriculture »): the ground each
// needs cleared (metres) and the update it waits for. Drawn by FermeLandmark.tsx (the fields at their stages, the
// pens, the appatam; the player's own plot there as it is).
export const FERME_LANDMARKS: Record<string, number> = {
  'ferme-gonate': 34,
  'ferme-sangouine': 34,
  'ferme-djebonoua': 34,
  'ferme-karakoro': 34,
  'ferme-attiegouakro': 34,
  'ferme-gabiadji': 34,
  'ferme-ebimpe': 30,
  'ferme-akandje': 30,
  'ferme-bama': 34,
  'ferme-ejisu': 34,
  'ferme-loire': 30,
  'ferme-iowa': 36,
}
export const FERME_LANDMARK_KEY: Record<string, string> = Object.fromEntries(Object.keys(FERME_LANDMARKS).map((id) => [id, 'agriculture']))
/** Out of town: no house of the game's own on the fields, and the map's round them one storey (VILLAGE). */
export const FERME_NO_FILL: Record<string, number> = Object.fromEntries(Object.keys(FERME_LANDMARKS).map((id) => [id, 60]))
