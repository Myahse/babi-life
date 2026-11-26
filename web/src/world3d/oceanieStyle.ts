import type { CountryLook } from './countryStyle'
import { OC_CITIES } from '../lib/oceanieData'
import type { OceanieId } from '../lib/paysOceanie'

// L'Océanie dans la rue (the update « pays-oceanie », backend world/oceanie.go): each country's own look, told by the
// position (countryStyle.ts lookAt, asked first: Papeete and Apia are west of the Americas): the nearest of the
// region's cities gives the country. Australia's and New Zealand's cars and white taxis, the passers-by in shorts
// and tee-shirts, the islands' floral shirts and wraps (the sulu, the pareo, the lavalava kept as the pagne), the
// palms on the beaches of Sydney, Brisbane and the islands; the walls' colours, the first names.

type Taxi = { color: string; trim: string }
const CARS: CountryLook['traffic'] = ['car', 'car', 'car', 'car', 'car', 'car', 'woro', 'moto']
const ISLAND: CountryLook['traffic'] = ['car', 'car', 'car', 'car', 'woro', 'woro', 'woro', 'moto']
const look = (id: OceanieId, taxi: Taxi, clothes: CountryLook['clothes'], o: { palms?: boolean; island?: boolean } = {}): CountryLook => ({
  id,
  traffic: o.island ? ISLAND : CARS,
  woro: taxi,
  clothes,
  palms: o.palms ?? true,
  fill: false,
})
export const OC_LOOKS: Record<OceanieId, CountryLook> = {
  au: look('au', { color: '#f1f3f5', trim: '#1a1a1a' }, 'west'),
  nz: look('nz', { color: '#1a1a1a', trim: '#f7c600' }, 'west', { palms: false }),
  fj: look('fj', { color: '#f1f3f5', trim: '#1c7ed6' }, 'ville', { island: true }),
  pg: look('pg', { color: '#f1f3f5', trim: '#c92a2a' }, 'ville', { island: true }),
  nc: look('nc', { color: '#f1f3f5', trim: '#2b8a3e' }, 'ville', { island: true }),
  pf: look('pf', { color: '#f1f3f5', trim: '#e8590c' }, 'ville', { island: true }),
  ws: look('ws', { color: '#f1f3f5', trim: '#1c7ed6' }, 'ville', { island: true }),
  to: look('to', { color: '#f1f3f5', trim: '#c92a2a' }, 'ville', { island: true }),
  vu: look('vu', { color: '#f1f3f5', trim: '#2b8a3e' }, 'ville', { island: true }),
}
// Melbourne, Canberra, Perth, Wellington: no coconut palms there.
const COOL = new Set(['melbourne', 'canberra', 'wellington', 'auckland'])
const AU_COOL: CountryLook = { ...OC_LOOKS.au, palms: false }

/** Oceania's look at a position: its nearest city's country's, or null off the region (Indonesia, north of 11° S and west of 141° E, is Asia's). */
export function oceanieLookAt(lat: number, lng: number): CountryLook | null {
  if (!(lat < -11 || (lng > 141 && lat < 0)) || !(lng > 110 || lng < -140)) return null
  let best = OC_CITIES[0]
  let d = Infinity
  for (const c of OC_CITIES) {
    // (Across the 180th meridian: Fiji, Samoa, Tonga.)
    const dl = Math.abs(c[3] - lng) > 180 ? 360 - Math.abs(c[3] - lng) : c[3] - lng
    const e = (c[2] - lat) ** 2 + (dl * Math.cos((lat * Math.PI) / 180)) ** 2
    if (e < d) (d = e), (best = c)
  }
  return COOL.has(best[0]) && best[1] === 'au' ? AU_COOL : (OC_LOOKS[best[1] as OceanieId] ?? null)
}

/** The walls' colours (open/buildings.ts): Australia's red brick and sandstone and white render, New Zealand's painted weatherboards, the islands' pastels. */
const AU = ['#b5583f', '#a0553f', '#d9c49a', '#e9dcc0', '#f8f9fa', '#c9a27a', '#8a3e2f', '#dee2e6', '#e6d2b0']
const NZ = ['#f8f9fa', '#e9ecef', '#cfe3f3', '#f1e3c8', '#bfd8c6', '#a8a49c', '#d6d0c4', '#f4c2a1']
const PACIFIC = ['#f6d58e', '#b9e3d6', '#cfe3f3', '#f4b89a', '#ffffff', '#e3d3ef', '#ffd6a5', '#c3e8a4']
export const OC_FACADES: Record<string, string[]> = { au: AU, nz: NZ, fj: PACIFIC, pg: PACIFIC, nc: PACIFIC, pf: PACIFIC, ws: PACIFIC, to: PACIFIC, vu: PACIFIC }

/** The passers-by's first names (talk.ts). */
export const OC_NAMES: Record<OceanieId, { femme: string[]; homme: string[] }> = {
  au: { femme: ['Charlotte', 'Olivia', 'Mia', 'Chloe', 'Isla', 'Grace', 'Ruby', 'Mei', 'Priya', 'Kylie', 'Jessica', 'Adut'], homme: ['Jack', 'Oliver', 'Liam', 'Noah', 'Lachlan', 'Cooper', 'Mitchell', 'Wei', 'Arjun', 'Bradley', 'Kofi', 'Ahmed'] },
  nz: { femme: ['Aroha', 'Charlotte', 'Isla', 'Mere', 'Olivia', 'Ava', 'Ana', 'Moana', 'Grace', 'Sophie', 'Kiri', 'Lucy'], homme: ['Oliver', 'Jack', 'Tama', 'Wiremu', 'Leo', 'Hemi', 'Noah', 'Sione', 'James', 'Mason', 'Rangi', 'Lucas'] },
  fj: { femme: ['Mere', 'Litia', 'Adi', 'Salote', 'Ana', 'Priya', 'Sereana', 'Vani', 'Losana', 'Unaisi', 'Asena', 'Kavita'], homme: ['Jone', 'Semi', 'Josefa', 'Pita', 'Isikeli', 'Ravi', 'Waisale', 'Tevita', 'Viliame', 'Sanjay', 'Apenisa', 'Mosese'] },
  pg: { femme: ['Mary', 'Grace', 'Ruth', 'Esther', 'Kila', 'Dorcas', 'Agnes', 'Lucy', 'Rose', 'Joyce', 'Martha', 'Helen'], homme: ['John', 'Peter', 'Michael', 'James', 'Kila', 'Paul', 'Joseph', 'David', 'Samuel', 'Moses', 'Tau', 'Bernard'] },
  nc: { femme: ['Marie', 'Léa', 'Wanessa', 'Siosaia', 'Emma', 'Chloé', 'Hnadro', 'Kenza', 'Manon', 'Malia', 'Inès', 'Sonia'], homme: ['Jean', 'Lucas', 'Wahea', 'Hugo', 'Kalolo', 'Thomas', 'Yannick', 'Kevin', 'Samuel', 'Mathis', 'Alphonse', 'Teva'] },
  pf: { femme: ['Hinano', 'Vaiana', 'Moana', 'Teura', 'Maeva', 'Heiata', 'Tiare', 'Poerani', 'Vaimiti', 'Marie', 'Hina', 'Rava'], homme: ['Teva', 'Manutea', 'Tamatoa', 'Heimana', 'Raiarii', 'Tehau', 'Matahi', 'Moana', 'Ariitea', 'Jean', 'Vaitea', 'Tumata'] },
  ws: { femme: ['Sina', 'Losa', 'Malia', 'Tupe', 'Seini', 'Fiaola', 'Leilani', 'Ana', 'Mele', 'Lagi', 'Faith', 'Saunoa'], homme: ['Tavita', 'Sione', 'Iosefa', 'Falani', 'Tasi', 'Mikaele', 'Pita', 'Ioane', 'Lafaele', 'Viliamu', 'Toleafoa', 'Samu'] },
  to: { femme: ['Mele', 'Salote', 'Ana', 'Losaline', 'Siosiana', 'Lupe', 'Sela', 'Fifita', 'Kalolaine', 'Ofa', 'Seini', 'Vika'], homme: ['Sione', 'Tevita', 'Viliami', 'Siaosi', 'Sitani', 'Taniela', 'Lopeti', 'Pita', 'Semisi', 'Paula', 'Moses', 'Uiliami'] },
  vu: { femme: ['Marie', 'Leimara', 'Esther', 'Mélissa', 'Rose', 'Annie', 'Lisa', 'Nadia', 'Leah', 'Florence', 'Joyce', 'Mina'], homme: ['Jean', 'Kalo', 'Moses', 'Willie', 'Joe', 'Pierre', 'John', 'Tom', 'Simon', 'Ralph', 'Kalsakau', 'Daniel'] },
}
