// Generated with backend world/oceanie.go (the update « pays-oceanie »): Oceania's cities, where they are (the
// street's look is told by the nearest one, oceanieStyle.ts), the activities.
export const OC_CITIES: [string, string, number, number][] = [
  ['sydney', 'au', -33.8688, 151.2093],
  ['melbourne', 'au', -37.8136, 144.9631],
  ['brisbane', 'au', -27.4698, 153.0251],
  ['perth', 'au', -31.9505, 115.8605],
  ['canberra', 'au', -35.2809, 149.13],
  ['auckland', 'nz', -36.8485, 174.7633],
  ['wellington', 'nz', -41.2865, 174.7762],
  ['suva', 'fj', -18.1416, 178.4419],
  ['port-moresby', 'pg', -9.4438, 147.1803],
  ['noumea', 'nc', -22.2758, 166.458],
  ['papeete', 'pf', -17.535, -149.5696],
  ['apia', 'ws', -13.8333, -171.7667],
  ['nukualofa', 'to', -21.1394, -175.2018],
  ['port-vila', 'vu', -17.7333, 168.3273],
]

/** The land borders open to travellers (backend moBorders), added to Europe's (lib/pays.ts roadLinked). */
export const OC_BORDERS: Record<string, string[]> = {
  au: [],
  nz: [],
  fj: [],
  pg: [],
  nc: [],
  pf: [],
  ws: [],
  to: [],
  vu: [],
}

export const OC_ACTS = [
  'oc-opera-syd', 'oc-parlement-cbr', 'oc-art-aborigene', 'oc-sky-jump', 'oc-taonga', 'oc-te-papa', 'oc-beehive', 'oc-fiji-museum', 'oc-parlement-pom', 'oc-tjibaou', 'oc-stevenson',
  'oc-bridge-climb', 'oc-fed-square', 'oc-hosier', 'oc-story-bridge', 'oc-roulottes',
  'oc-ferry-manly', 'oc-cable-car',
  'oc-rocks-market', 'oc-queen-vic', 'oc-suva-marche', 'oc-bilum', 'oc-marche-noumea', 'oc-papeete-marche', 'oc-fugalei', 'oc-talamahu',
  'oc-jardin-syd', 'oc-bondi-coogee', 'oc-kings-park', 'oc-mont-eden', 'oc-mele',
  'oc-bondi-surf', 'oc-bondi', 'oc-icebergs', 'oc-south-bank', 'oc-cottesloe', 'oc-anse-vata', 'oc-pointe-venus',
  'oc-meat-pie', 'oc-flat-white', 'oc-barbie', 'oc-fish-chips-oc', 'oc-souvlaki-mel', 'oc-hangi', 'oc-kava', 'oc-lovo', 'oc-mumu', 'oc-bougna', 'oc-poisson-cru', 'oc-oka', 'oc-lu-pulu', 'oc-lap-lap',
  'oc-kings-cross',
  'oc-afro-syd', 'oc-monoi',
  'oc-mcg-footy',
  'oc-koala',
  'oc-chants-tonga',
]
