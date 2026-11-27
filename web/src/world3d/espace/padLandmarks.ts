// The spaceports' pads as landmarks in the street (open/landmarks.tsx, the update « espace »): the ground each
// needs cleared (metres), the update each waits for, and those seen from afar. Drawn by spatioport.tsx (the pad,
// the tower, the assembly hall, the control room; the visitor centres apart).
export const ESPACE_LANDMARKS: Record<string, number> = {
  'sassandra-pas-de-tir': 95,
  'kourou-pas-de-tir': 95,
  'canaveral-pas-de-tir': 95,
  'baikonour-pas-de-tir': 95,
  'sassandra-visiteurs': 35,
  'kourou-visiteurs': 35,
  'canaveral-visiteurs': 35,
}
export const ESPACE_LANDMARK_KEY: Record<string, string> = Object.fromEntries(Object.keys(ESPACE_LANDMARKS).map((id) => [id, 'espace']))
export const ESPACE_SKYLINE = Object.keys(ESPACE_LANDMARKS).filter((id) => id.endsWith('-pas-de-tir'))
