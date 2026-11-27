// The spaceports' pads as landmarks in the street (open/landmarks.tsx, the update « espace »): the ground each
// needs cleared (metres), the update each waits for, and those seen from afar. Drawn by padLandmark.tsx (C's
// spatioport.tsx: the tower, the assembly hall, the visitor centre, replaces it).
export const ESPACE_LANDMARKS: Record<string, number> = {
  'sassandra-pas-de-tir': 40,
  'kourou-pas-de-tir': 40,
  'canaveral-pas-de-tir': 40,
  'baikonour-pas-de-tir': 40,
}
export const ESPACE_LANDMARK_KEY: Record<string, string> = Object.fromEntries(Object.keys(ESPACE_LANDMARKS).map((id) => [id, 'espace']))
export const ESPACE_SKYLINE = Object.keys(ESPACE_LANDMARKS)
