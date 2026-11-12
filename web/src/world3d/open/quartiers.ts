// The communes in detail (the update « communes-detail », backend world/carrefours.go and
// game/quartiers.go): the carrefours everybody knows, drawn as landmarks (carrefours.tsx), and the
// zones (the industrial zones, the campus, the markets, the quarters people name) with their sign by the
// road, their name on the screen as the Sim enters (components/ZoneBanner.tsx) and on the map. Names and
// points from OpenStreetMap (Nominatim, 2026-11-12); a zone's radius is the game's.

/** The update. */
export const QUARTIERS_KEY = 'communes-detail'

/** The carrefours (backend places of kind « carrefour »): the text on their sign. */
export const CARREFOURS: Record<string, string> = {
  'yop-carrefour-siporex': 'ROND-POINT DE SIPOREX',
  'yop-carrefour-sable': 'CARREFOUR SABLE',
  'yop-carrefour-koute': 'CARREFOUR KOUTÉ',
  'cocody-carrefour-saint-jean': 'CARREFOUR SAINT-JEAN',
  'cocody-carrefour-riviera2': 'CARREFOUR RIVIERA 2',
  'cocody-rond-point-palmeraie': 'ROND-POINT DE LA PALMERAIE',
  'cocody-angre-chateau': 'ANGRÉ CHÂTEAU',
  'adjame-carrefour-liberte': 'CARREFOUR LIBERTÉ',
  'plateau-carrefour-indenie': "CARREFOUR DE L'INDÉNIÉ",
  'treich-grand-carrefour': 'GRAND CARREFOUR DE TREICHVILLE',
  'koumassi-grand-carrefour': 'GRAND CARREFOUR DE KOUMASSI',
  'pb-carrefour-akwaba': 'CARREFOUR AKWABA',
  'abobo-gare-carrefour': 'ABOBO GARE',
  'abobo-carrefour-samake': 'CARREFOUR SAMAKÉ',
  'yakro-rond-point-chateau': "ROND-POINT DU CHÂTEAU D'EAU",
  'bouake-rond-point-gare': 'ROND-POINT DE LA GARE ROUTIÈRE',
  'bouake-place-paix': 'PLACE DE LA PAIX',
  'bouake-rond-point-kennedy': 'ROND-POINT DE KENNEDY',
  'sp-rond-point-gare': 'ROND-POINT DE LA GARE ROUTIÈRE',
  'sp-rond-point-cite': 'ROND-POINT DE LA CITÉ',
  'bassam-rond-point-moossou': 'ROND-POINT DE MOOSSOU',
}
export const CARREFOUR_IDS = Object.keys(CARREFOURS)
/** The ground a carrefour's corner takes (metres round its middle), and how far its front is from it. */
export const CARREFOUR_CLEAR = 13
export const CARREFOUR_FRONT = 5

/** What a zone is like: its sign's colours and what stands by it. */
export type ZoneStyle = 'industrie' | 'marche' | 'campus' | 'sorties' | 'quartier' | 'gare' | 'admin' | 'village' | 'historique'

export type Zone = { id: string; commune: string; name: string; lat: number; lng: number; /** metres */ r: number; style: ZoneStyle }

export const ZONES: Zone[] = [
  // Yopougon.
  { id: 'zi-yopougon', commune: 'yopougon', name: 'Zone industrielle de Yopougon', lat: 5.37441, lng: -4.08454, r: 900, style: 'industrie' },
  { id: 'toits-rouges', commune: 'yopougon', name: 'Toits-Rouges', lat: 5.33132, lng: -4.055, r: 550, style: 'quartier' },
  { id: 'gesco', commune: 'yopougon', name: 'Gesco', lat: 5.36538, lng: -4.10398, r: 500, style: 'quartier' },
  // Cocody.
  { id: 'campus-ufhb', commune: 'cocody', name: 'Campus de l’Université Félix-Houphouët-Boigny', lat: 5.34274, lng: -3.98713, r: 550, style: 'campus' },
  { id: 'blockhauss', commune: 'cocody', name: 'Blockhauss', lat: 5.32322, lng: -4.00183, r: 260, style: 'village' },
  // Adjamé.
  { id: 'black-market', commune: 'adjame', name: 'Black Market', lat: 5.35424, lng: -4.02477, r: 170, style: 'marche' },
  { id: '220-logements', commune: 'adjame', name: '220 Logements', lat: 5.35162, lng: -4.01777, r: 330, style: 'quartier' },
  { id: 'marche-adjame', commune: 'adjame', name: 'Le marché d’Adjamé', lat: 5.34522, lng: -4.02665, r: 230, style: 'marche' },
  { id: 'gare-adjame', commune: 'adjame', name: 'La gare routière d’Adjamé', lat: 5.35182, lng: -4.02213, r: 200, style: 'gare' },
  // Plateau.
  { id: 'cite-administrative', commune: 'plateau', name: 'Cité administrative', lat: 5.33407, lng: -4.02279, r: 230, style: 'admin' },
  // Treichville.
  { id: 'gare-bassam', commune: 'treichville', name: 'Gare de Bassam', lat: 5.29905, lng: -4.00329, r: 130, style: 'gare' },
  { id: 'arras', commune: 'treichville', name: 'Arras', lat: 5.29995, lng: -4.00339, r: 320, style: 'quartier' },
  { id: 'avenue-16', commune: 'treichville', name: 'Avenue 16', lat: 5.30554, lng: -4.00601, r: 200, style: 'sorties' },
  // Marcory.
  { id: 'zone-4', commune: 'marcory', name: 'Zone 4', lat: 5.29194, lng: -3.98127, r: 650, style: 'sorties' },
  { id: 'pierre-marie-curie', commune: 'marcory', name: 'Rue Pierre-et-Marie-Curie', lat: 5.2915, lng: -3.98247, r: 220, style: 'sorties' },
  { id: 'bietry', commune: 'marcory', name: 'Biétry', lat: 5.27768, lng: -3.97499, r: 550, style: 'quartier' },
  { id: 'anoumabo', commune: 'marcory', name: 'Anoumabo', lat: 5.30966, lng: -3.96822, r: 300, style: 'village' },
  // Koumassi, Port-Bouët.
  { id: 'koumassi-remblais', commune: 'koumassi', name: 'Koumassi Remblais', lat: 5.30038, lng: -3.96444, r: 500, style: 'quartier' },
  { id: 'zi-vridi', commune: 'port-bouet', name: 'Zone industrielle de Vridi', lat: 5.26486, lng: -4.00232, r: 1100, style: 'industrie' },
  { id: 'gonzagueville', commune: 'port-bouet', name: 'Gonzagueville', lat: 5.24803, lng: -3.89585, r: 900, style: 'quartier' },
  // The other towns.
  { id: 'air-france-bouake', commune: 'bouake-centre', name: 'Air France', lat: 7.67948, lng: -5.01772, r: 700, style: 'quartier' },
  { id: 'quartier-france', commune: 'bassam-france', name: 'Quartier France', lat: 5.19699, lng: -3.73723, r: 650, style: 'historique' },
  { id: 'port-san-pedro', commune: 'sp-centre', name: 'Port autonome de San-Pédro', lat: 4.74228, lng: -6.62083, r: 600, style: 'industrie' },
]

/** A zone's sign colours: the board, the ink, the trim. */
export const ZONE_COLOURS: Record<ZoneStyle, [string, string, string]> = {
  industrie: ['#1c4f9c', '#ffffff', '#ffd43b'],
  marche: ['#e8590c', '#ffffff', '#ffe066'],
  campus: ['#1e3a8a', '#ffffff', '#f08c00'],
  sorties: ['#14101f', '#ff7ad9', '#4dabf7'],
  quartier: ['#0b5f36', '#ffffff', '#ffffff'],
  gare: ['#3d4fd6', '#ffffff', '#ffd43b'],
  admin: ['#00895a', '#ffffff', '#f77f00'],
  village: ['#7a4a1f', '#fff3d6', '#e9c46a'],
  historique: ['#6b3a2a', '#fff3d6', '#e9c46a'],
}

/** The zone a point is in (the smallest that holds it), from a point-to-metres function. */
export function zoneAt(zones: Zone[], at: [number, number], local: (lat: number, lng: number) => [number, number]): Zone | null {
  let best: Zone | null = null
  for (const z of zones) {
    const [x, y] = local(z.lat, z.lng)
    if (Math.hypot(x - at[0], y - at[1]) < z.r && (!best || z.r < best.r)) best = z
  }
  return best
}
