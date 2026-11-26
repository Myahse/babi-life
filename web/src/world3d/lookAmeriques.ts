import type { CountryLook } from './countryStyle'

// Latin America's and the Caribbean's street (the update « pays-ameriques », backend world/ameriques.go;
// countryStyle.ts lookAt): each country's traffic and its taxis' colours (Mexico's pink and white, Bogota's
// and Rio's yellow, Buenos Aires's black and yellow, Port-au-Prince's painted tap-taps, Havana's old cars),
// the passers-by's names, the walls' colours, the palms where it's hot and low (not in Bogota, Quito, La Paz,
// Mexico, Buenos Aires, Santiago). Told by the place's position like the rest (the chunk workers know only
// that): south of the United States (24.6° N, Miami and Honolulu aside), the country of the nearest city of the game.

type Names = { femme: string[]; homme: string[] }
const ES: Names = {
  femme: ['María', 'Guadalupe', 'Valentina', 'Camila', 'Daniela', 'Sofía', 'Mariana', 'Fernanda', 'Gabriela', 'Lucía', 'Paola', 'Andrea'],
  homme: ['José', 'Juan', 'Luis', 'Carlos', 'Jorge', 'Miguel', 'Alejandro', 'Diego', 'Santiago', 'Andrés', 'Javier', 'Fernando'],
}
const NAMES: Record<string, Names> = {
  mx: { femme: ['María', 'Guadalupe', 'Ximena', 'Fernanda', 'Valeria', 'Sofía', 'Itzel', 'Mariana', 'Lupita', 'Andrea', 'Daniela', 'Citlali'], homme: ['José', 'Juan', 'Luis', 'Jorge', 'Miguel', 'Alejandro', 'Emiliano', 'Diego', 'Santiago', 'Javier', 'Cuauhtémoc', 'Fernando'] },
  cu: { femme: ['Yanelis', 'Dayana', 'María', 'Yusimí', 'Odalys', 'Lázara', 'Yaneisy', 'Daniela', 'Rosa', 'Mayelín', 'Yudith', 'Ana'], homme: ['Yoandry', 'Lázaro', 'Yasmani', 'Raúl', 'Ernesto', 'Alexis', 'Osmany', 'Yunior', 'Reinaldo', 'Pedro', 'Jorge', 'Michel'] },
  ht: { femme: ['Marie', 'Nadège', 'Roseline', 'Fabiola', 'Wideline', 'Mirlande', 'Guerline', 'Stéphanie', 'Esther', 'Daphnée', 'Judith', 'Sabine'], homme: ['Jean', 'Pierre', 'Wilson', 'Frantz', 'Jean-Robert', 'Wesner', 'Kervens', 'Ricardo', 'Jameson', 'Steeve', 'Emmanuel', 'Wisly'] },
  br: { femme: ['Ana', 'Maria', 'Juliana', 'Fernanda', 'Camila', 'Beatriz', 'Larissa', 'Luana', 'Thaís', 'Gabriela', 'Jéssica', 'Francisca'], homme: ['João', 'José', 'Lucas', 'Gabriel', 'Pedro', 'Rafael', 'Thiago', 'Matheus', 'Felipe', 'Bruno', 'Anderson', 'Wellington'] },
  ar: { femme: ['Sofía', 'Valentina', 'Camila', 'Lucía', 'Martina', 'Florencia', 'Agustina', 'Micaela', 'Julieta', 'Carolina', 'Paula', 'Romina'], homme: ['Santiago', 'Mateo', 'Juan Pablo', 'Facundo', 'Nicolás', 'Matías', 'Lautaro', 'Tomás', 'Gonzalo', 'Federico', 'Martín', 'Diego'] },
  jm: { femme: ['Shanice', 'Kimberly', 'Tashana', 'Nicole', 'Simone', 'Kerry-Ann', 'Shelly-Ann', 'Jodian', 'Tanesha', 'Monique', 'Sasha', 'Annmarie'], homme: ['Andre', 'Damion', 'Omar', 'Kemar', 'Ricardo', 'Shane', 'Romario', 'Leon', 'Jermaine', 'Dwayne', 'Rohan', 'Kirk'] },
  tt: { femme: ['Keisha', 'Anisa', 'Shania', 'Priya', 'Kerrie', 'Tamika', 'Renée', 'Savitri', 'Alicia', 'Nadia', 'Kavita', 'Jada'], homme: ['Marlon', 'Ravi', 'Kevin', 'Darren', 'Shiva', 'Jason', 'Akeem', 'Sean', 'Kerwin', 'Vishal', 'Brian', 'Kyle'] },
  gy: { femme: ['Shondel', 'Anjali', 'Keisha', 'Natasha', 'Priya', 'Tiffany', 'Melissa', 'Shari', 'Nadira', 'Alicia', 'Rochelle', 'Devika'], homme: ['Ravi', 'Shawn', 'Ryan', 'Kevin', 'Anil', 'Marlon', 'Andrew', 'Rakesh', 'Troy', 'Leon', 'Vikash', 'Dexter'] },
  sr: { femme: ['Sharon', 'Priya', 'Gail', 'Kimberley', 'Sarita', 'Naomi', 'Roshni', 'Jennifer', 'Ingrid', 'Sandra', 'Anisha', 'Esther'], homme: ['Ricardo', 'Rakesh', 'Ronald', 'Glenn', 'Sunil', 'Romeo', 'Dennis', 'Kenneth', 'Ashwin', 'Erwin', 'Stanley', 'Marvin'] },
  antilles: { femme: ['Maëva', 'Nadège', 'Léa', 'Océane', 'Laetitia', 'Ketty', 'Marlène', 'Jessica', 'Mélissa', 'Sandrine', 'Gwladys', 'Aurélie'], homme: ['Kévin', 'Mickaël', 'Jordan', 'Teddy', 'Loïc', 'Joël', 'Steeve', 'Dimitri', 'Thierry', 'Fabrice', 'Didier', 'Ludovic'] },
}

// The walls: the bright colonial colours, the pastels of Havana and of the islands, the creole houses, the stone of Buenos Aires.
const BRIGHT = ['#e8590c', '#f59f00', '#d6336c', '#1c7ed6', '#f8f0e3', '#c2255c', '#fab005', '#2b8a3e', '#e9d8a6', '#8b2f1e', '#f1e3c8', '#74c0fc']
const PASTEL = ['#f3d9b1', '#a5d8ff', '#ffc9c9', '#b2f2bb', '#ffe066', '#e599f7', '#f8f9fa', '#ffa94d', '#c5f6fa', '#fff3bf']
const CONCRETE = ['#d9d4c7', '#bfb8a8', '#e8e2d4', '#9aa0a6', '#c9b79c', '#f1ece0', '#a8a49c', '#d6c6a8', '#f4b89a', '#74c0fc']
const STONE = ['#d9cbb3', '#c9b79c', '#a68a6d', '#e8dfcf', '#8d7b68', '#bfb3a0', '#e6dccb', '#b5654a']
const CREOLE = ['#f8f9fa', '#ffd43b', '#74c0fc', '#ff8787', '#69db7c', '#e599f7', '#ffa94d', '#dee2e6', '#fff3bf', '#4dabf7']

type Car = CountryLook['traffic'][number]
const look = (id: string, traffic: Car[], woro: { color: string; trim: string }, names: Names, facades: string[], mopeds = false): CountryLook & { facades: string[] } => ({ id, traffic, woro, clothes: 'west', palms: true, fill: false, names, facades, mopeds })
const TAXI_CARS: Car[] = ['car', 'car', 'car', 'woro', 'woro', 'car', 'moto', 'car']

/** Each country's look (its palms set by the city, below). */
export const AMERIQUES_LOOKS: Record<string, CountryLook & { facades: string[] }> = {
  // Mexico: the pink-and-white taxis of the capital, the VW-like cars, the colonial colours.
  mx: look('mx', TAXI_CARS, { color: '#e64980', trim: '#f8f9fa' }, NAMES.mx, BRIGHT),
  gt: look('gt', ['car', 'car', 'woro', 'moto', 'car', 'moto'], { color: '#f8f9fa', trim: '#c92a2a' }, ES, BRIGHT),
  sv: look('sv', ['car', 'car', 'woro', 'moto', 'car'], { color: '#fcc419', trim: '#1a1a1a' }, ES, BRIGHT),
  hn: look('hn', ['car', 'car', 'woro', 'woro', 'moto', 'car'], { color: '#f8f9fa', trim: '#1c7ed6' }, ES, BRIGHT),
  ni: look('ni', ['car', 'woro', 'woro', 'moto', 'car'], { color: '#f8f9fa', trim: '#2f9e44' }, ES, BRIGHT),
  cr: look('cr', TAXI_CARS, { color: '#e03131', trim: '#fcc419' }, ES, BRIGHT),
  pa: look('pa', TAXI_CARS, { color: '#fcc419', trim: '#1a1a1a' }, ES, CONCRETE),
  // Havana: the old American cars, painted, shared like taxis; the pastel walls.
  cu: look('cu', ['woro', 'woro', 'woro', 'car', 'car', 'moto'], { color: '#4dabf7', trim: '#f8f9fa' }, NAMES.cu, PASTEL),
  // Port-au-Prince: the tap-taps painted in every colour, the motos.
  ht: look('ht', ['moto', 'moto', 'woro', 'woro', 'woro', 'car', 'car'], { color: '#f03e3e', trim: '#fcc419' }, NAMES.ht, CREOLE, true),
  do: look('do', ['moto', 'moto', 'car', 'car', 'woro', 'car'], { color: '#1c7ed6', trim: '#f8f9fa' }, ES, CREOLE, true),
  jm: look('jm', ['car', 'car', 'woro', 'car', 'car', 'moto'], { color: '#f8f9fa', trim: '#e03131' }, NAMES.jm, CREOLE),
  pr: look('pr', ['car', 'car', 'car', 'woro', 'car'], { color: '#f8f9fa', trim: '#1c7ed6' }, ES, PASTEL),
  tt: look('tt', ['car', 'car', 'woro', 'woro', 'car'], { color: '#f8f9fa', trim: '#2b8a3e' }, NAMES.tt, CREOLE),
  gp: look('gp', ['car', 'car', 'car', 'woro', 'moto'], { color: '#f8f9fa', trim: '#1c3f94' }, NAMES.antilles, CREOLE),
  mq: look('mq', ['car', 'car', 'car', 'woro', 'moto'], { color: '#f8f9fa', trim: '#1c3f94' }, NAMES.antilles, CREOLE),
  gf: look('gf', ['car', 'car', 'car', 'woro', 'moto'], { color: '#f8f9fa', trim: '#1c3f94' }, NAMES.antilles, CREOLE),
  // Bogota's and Caracas's and Quito's yellow taxis.
  co: look('co', TAXI_CARS, { color: '#fcc419', trim: '#1a1a1a' }, ES, BRIGHT),
  ve: look('ve', TAXI_CARS, { color: '#fcc419', trim: '#1a1a1a' }, ES, CONCRETE),
  ec: look('ec', TAXI_CARS, { color: '#fcc419', trim: '#1a1a1a' }, ES, BRIGHT),
  pe: look('pe', ['car', 'woro', 'woro', 'car', 'car', 'moto'], { color: '#f8f9fa', trim: '#c92a2a' }, ES, BRIGHT),
  bo: look('bo', ['woro', 'woro', 'car', 'car', 'car'], { color: '#f8f9fa', trim: '#2f9e44' }, ES, STONE),
  // Rio's yellow taxis with the blue stripe (São Paulo's are white).
  br: look('br', TAXI_CARS, { color: '#fcc419', trim: '#1971c2' }, NAMES.br, CONCRETE),
  py: look('py', TAXI_CARS, { color: '#f8f9fa', trim: '#c92a2a' }, ES, CONCRETE),
  uy: look('uy', TAXI_CARS, { color: '#1a1a1a', trim: '#fcc419' }, NAMES.ar, STONE),
  // Buenos Aires's black-and-yellow taxis, its stone and brick.
  ar: look('ar', TAXI_CARS, { color: '#1a1a1a', trim: '#fcc419' }, NAMES.ar, STONE),
  cl: look('cl', TAXI_CARS, { color: '#1a1a1a', trim: '#fcc419' }, ES, STONE),
  gy: look('gy', ['car', 'car', 'woro', 'woro', 'car'], { color: '#f8f9fa', trim: '#2b8a3e' }, NAMES.gy, CREOLE),
  sr: look('sr', ['car', 'car', 'woro', 'moto', 'car', 'moto'], { color: '#f8f9fa', trim: '#2b8a3e' }, NAMES.sr, CREOLE),
}

// The game's cities there: [lat, lng, country, palms].
const CITIES: [number, number, string, boolean][] = [
  [-23.55, -46.63, 'br', false], [-22.91, -43.18, 'br', true], [-12.97, -38.51, 'br', true], [-15.79, -47.88, 'br', false],
  [19.43, -99.13, 'mx', false], [21.16, -86.85, 'mx', true],
  [18.54, -72.34, 'ht', true], [19.76, -72.2, 'ht', true], [23.14, -82.35, 'cu', true],
  [4.6, -74.07, 'co', false], [10.42, -75.55, 'co', true], [-34.61, -58.37, 'ar', false],
  [-12.05, -77.03, 'pe', false], [-33.44, -70.65, 'cl', false], [10.5, -66.91, 've', true], [-0.22, -78.51, 'ec', false], [-2.19, -79.88, 'ec', true],
  [-16.5, -68.13, 'bo', false], [-17.78, -63.18, 'bo', true], [-25.28, -57.63, 'py', true], [-34.9, -56.2, 'uy', false],
  [6.8, -58.16, 'gy', true], [5.82, -55.15, 'sr', true], [4.94, -52.33, 'gf', true],
  [18.0, -76.79, 'jm', true], [18.47, -69.89, 'do', true], [10.66, -61.51, 'tt', true], [18.47, -66.11, 'pr', true], [16.24, -61.53, 'gp', true], [14.6, -61.07, 'mq', true],
  [14.63, -90.51, 'gt', false], [9.93, -84.08, 'cr', false], [8.98, -79.52, 'pa', true], [14.07, -87.19, 'hn', false], [15.5, -88.03, 'hn', true], [12.13, -86.25, 'ni', true], [13.7, -89.19, 'sv', true],
]
// One look per city, made once (setCountryLook compares them).
const LOOKS = CITIES.map(([, , k, palms]) => ({ ...AMERIQUES_LOOKS[k], palms }))

/** The look of a place of Latin America or the Caribbean, if it is there (else null: the United States, Canada). */
export function ameriquesLookAt(lat: number, lng: number): CountryLook | null {
  if (!(lng > -130 && lng < -30 && lat < 24.6)) return null
  let best = 0
  let bestD = Infinity
  CITIES.forEach(([la, ln], i) => {
    const d = (la - lat) ** 2 + ((ln - lng) * Math.cos((lat * Math.PI) / 180)) ** 2
    if (d < bestD) (bestD = d), (best = i)
  })
  return LOOKS[best]
}
