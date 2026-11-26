// The Middle East's and Oceania's landmarks in blocks (moyenOrient3d.tsx, the updates « pays-moyen-orient »,
// « pays-oceanie »): the ground each needs cleared (metres), and the update each waits for.
export const MO_LANDMARKS: Record<string, number> = {
  'mecque-masjid-al-haram': 80,
  'medine-masjid-nabawi': 70,
  'auh-grande-mosquee': 90,
  'dxb-burj-khalifa': 50,
  'dxb-deira-naif': 36,
  'ryd-kingdom-centre': 50,
  'jlm-dome-rocher': 64,
  'petra-tresor': 48,
  'teh-azadi-tour': 58,
  'isf-mosquee-imam': 56,
  'bey-hamra-raouche': 70,
  'syd-opera': 80,
  'syd-harbour-bridge': 150,
  'auckland-sky-tower': 36,
}
export const MO_LANDMARK_KEY: Record<string, string> = Object.fromEntries(Object.keys(MO_LANDMARKS).map((id) => [id, id.startsWith('syd-') || id.startsWith('auckland-') ? 'pays-oceanie' : 'pays-moyen-orient']))
/** The ones seen from afar (landmarks.tsx SKYLINE). */
export const MO_SKYLINE = ['dxb-burj-khalifa', 'ryd-kingdom-centre', 'auckland-sky-tower', 'syd-harbour-bridge', 'mecque-masjid-al-haram', 'auh-grande-mosquee']
