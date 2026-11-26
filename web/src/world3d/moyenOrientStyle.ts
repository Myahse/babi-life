import type { CountryLook } from './countryStyle'
import { MO_CITIES } from '../lib/moyenOrientData'
import { AFRIQUE_ANCHORS } from '../lib/paysAfriqueVilles'
import { EUROPE_CITIES } from '../lib/europeData'
import type { MoyenOrientId } from '../lib/paysMoyenOrient'

// Le Moyen-Orient dans la rue (the update « pays-moyen-orient », backend world/moyenOrient.go): each country's own
// look, told by the position like the others (countryStyle.ts lookAt, asked before Europe's and Africa's: Tehran
// and Beirut are as far north as Seville): the nearest city of the region, of Africa or of Europe gives the
// country, the region's only when it's the nearest. Its traffic (cars, the taxis in their city's colours: Dubai's
// cream, Doha's turquoise, Tehran's yellow and green, Amman's yellow), the passers-by (the Gulf's white thobes and
// black abayas, the Levant's and Iran's shirts and veils), the date palms, no houses under tin; the walls' colours,
// the first names, a little snow on Tehran in winter.

type Taxi = { color: string; trim: string }
const CARS: CountryLook['traffic'] = ['car', 'car', 'car', 'car', 'car', 'car', 'woro', 'woro']
const look = (id: MoyenOrientId, taxi: Taxi, clothes: CountryLook['clothes'], o: { palms?: boolean; scooters?: number; traffic?: CountryLook['traffic'] } = {}): CountryLook => ({
  id,
  traffic: o.traffic ?? [...CARS, ...Array<'moto'>(o.scooters ?? 0).fill('moto')],
  woro: taxi,
  clothes,
  palms: o.palms ?? true,
  fill: false,
  mopeds: (o.scooters ?? 0) >= 3,
})

export const MO_LOOKS: Record<MoyenOrientId, CountryLook> = {
  ae: look('ae', { color: '#efe6c8', trim: '#c92a2a' }, 'golfe'),
  sa: look('sa', { color: '#f1f3f5', trim: '#2b8a3e' }, 'golfe'),
  qa: look('qa', { color: '#3bc9db', trim: '#f8f9fa' }, 'golfe'),
  kw: look('kw', { color: '#f1f3f5', trim: '#e8590c' }, 'golfe'),
  bh: look('bh', { color: '#f1f3f5', trim: '#c92a2a' }, 'golfe'),
  om: look('om', { color: '#f1f3f5', trim: '#e8590c' }, 'golfe'),
  ye: look('ye', { color: '#f8f9fa', trim: '#1c7ed6' }, 'golfe', { scooters: 2 }),
  lb: look('lb', { color: '#f1f3f5', trim: '#c92a2a' }, 'nord', { scooters: 3 }),
  sy: look('sy', { color: '#f7c600', trim: '#1a1a1a' }, 'nord', { scooters: 1 }),
  iq: look('iq', { color: '#f1f3f5', trim: '#e8590c' }, 'nord', { scooters: 1 }),
  jo: look('jo', { color: '#f7c600', trim: '#1a1a1a' }, 'nord'),
  ps: look('ps', { color: '#f7c600', trim: '#1a1a1a' }, 'nord'),
  il: look('il', { color: '#f1f3f5', trim: '#f7c600' }, 'west', { scooters: 3 }),
  ir: look('ir', { color: '#f7c600', trim: '#2b8a3e' }, 'nord', { palms: false, scooters: 3 }),
}

const NEAR = [...MO_CITIES, ...AFRIQUE_ANCHORS, ...EUROPE_CITIES]
/** The Middle East's look at a position: its nearest city's country's, or null where the nearest is Africa's or Europe's (or off the region). */
export function moyenOrientLookAt(lat: number, lng: number): CountryLook | null {
  // (East of 61°, and Central Asia north of Iran: Asia's.)
  if (lat < 11 || lat > 40 || lng < 33.5 || lng > 61 || (lng > 58 && lat > 36.5)) return null
  let best = NEAR[0]
  let d = Infinity
  const k = Math.cos((lat * Math.PI) / 180)
  for (const c of NEAR) {
    const e = (c[2] - lat) ** 2 + ((c[3] - lng) * k) ** 2
    if (e < d) (d = e), (best = c)
  }
  return MO_LOOKS[best[1] as MoyenOrientId] ?? null
}

/** The walls' colours (open/buildings.ts): the Gulf's whites and sands, the Levant's pale limestone, Tehran's brick and Isfahan's ochre, Sanaa's earth and white. */
const GULF = ['#f8f9fa', '#f3ead6', '#e9dcc0', '#ffffff', '#efe2c4', '#d8c49c', '#e3d5b8', '#cfd8dc']
const LIMESTONE = ['#efe6d2', '#e6dac0', '#d9cba8', '#f5efe0', '#cdbf9f', '#e8dcc4', '#bfb08e', '#f1ead8']
const PERSIA = ['#c9a27a', '#b8865a', '#d9b48a', '#a8744c', '#e6d2b0', '#9c6b48', '#cfd4d8', '#e3c9a0']
const EARTH = ['#a8744c', '#9c6b48', '#c49064', '#f3efe6', '#b8865a', '#8a5a3a']
export const MO_FACADES: Record<string, string[]> = {
  ae: GULF, sa: GULF, qa: GULF, kw: GULF, bh: GULF, om: GULF,
  lb: LIMESTONE, sy: LIMESTONE, jo: LIMESTONE, ps: LIMESTONE, il: LIMESTONE, iq: ['#d9c49a', '#c9b48a', '#e8d9b8', '#b8a07a', '#f1e7d0', '#a89070'],
  ir: PERSIA, ye: EARTH,
}

/** Snow (open/snow.ts): a little on Tehran in the heart of winter, at the foot of the Alborz. */
export const moSnow = (country: string, month: number) => (country === 'ir' ? ({ 12: 0.15, 1: 0.35, 2: 0.25 } as Record<number, number>)[month] ?? 0 : 0)

/** The passers-by's first names (talk.ts). */
export const MO_NAMES: Record<MoyenOrientId, { femme: string[]; homme: string[] }> = {
  ae: { femme: ['Fatima', 'Mariam', 'Aisha', 'Hessa', 'Shamma', 'Noura', 'Priya', 'Maria', 'Amna', 'Aminata', 'Grace', 'Latifa'], homme: ['Mohammed', 'Ahmed', 'Rashid', 'Saeed', 'Khalid', 'Hamdan', 'Rahul', 'Imran', 'José', 'Abdullah', 'Moussa', 'Chinedu'] },
  sa: { femme: ['Nora', 'Sara', 'Reem', 'Lama', 'Haya', 'Fatimah', 'Aljawhara', 'Maha', 'Jawaher', 'Dana', 'Lulwa', 'Amal'], homme: ['Mohammed', 'Abdullah', 'Faisal', 'Turki', 'Fahad', 'Saud', 'Abdulaziz', 'Nasser', 'Omar', 'Khalid', 'Sultan', 'Bandar'] },
  qa: { femme: ['Al Anoud', 'Mariam', 'Noor', 'Hind', 'Moza', 'Aisha', 'Dana', 'Sheikha', 'Priya', 'Fatma', 'Rania', 'Shaikha'], homme: ['Hamad', 'Tamim', 'Jassim', 'Khalifa', 'Nasser', 'Ali', 'Abdulrahman', 'Ahmed', 'Ravi', 'Mohammed', 'Faisal', 'Youssef'] },
  kw: { femme: ['Dalal', 'Fatma', 'Noura', 'Shaikha', 'Sarah', 'Hessa', 'Rawan', 'Ghadeer', 'Lulwa', 'Maryam', 'Asma', 'Bibi'], homme: ['Mubarak', 'Fahad', 'Bader', 'Jaber', 'Yousef', 'Talal', 'Saad', 'Khaled', 'Abdullah', 'Meshal', 'Hamad', 'Nawaf'] },
  bh: { femme: ['Zainab', 'Fatima', 'Maryam', 'Noor', 'Hawra', 'Sara', 'Lulwa', 'Amina', 'Huda', 'Layla', 'Ghada', 'Dana'], homme: ['Ali', 'Hussain', 'Ahmed', 'Isa', 'Salman', 'Khalifa', 'Hamad', 'Mohammed', 'Jassim', 'Nabeel', 'Yusuf', 'Sayed'] },
  om: { femme: ['Aisha', 'Fatma', 'Muna', 'Shaima', 'Asma', 'Zuwaina', 'Maryam', 'Salma', 'Thuraya', 'Ruqaiya', 'Badriya', 'Khadija'], homme: ['Said', 'Salim', 'Hamed', 'Khalfan', 'Ahmed', 'Sultan', 'Haitham', 'Nasser', 'Talib', 'Mohammed', 'Khamis', 'Ali'] },
  ye: { femme: ['Amat', 'Fatima', 'Arwa', 'Bilqis', 'Huda', 'Sumaya', 'Nadia', 'Afrah', 'Raja', 'Wafa', 'Ibtisam', 'Samira'], homme: ['Ali', 'Abdullah', 'Mohammed', 'Saleh', 'Ahmed', 'Yahya', 'Abdulrahman', 'Hamoud', 'Nabil', 'Fouad', 'Tarek', 'Hussein'] },
  lb: { femme: ['Nour', 'Maya', 'Rita', 'Lara', 'Yasmine', 'Rania', 'Myriam', 'Joëlle', 'Hiba', 'Zeina', 'Nadine', 'Carla'], homme: ['Georges', 'Ali', 'Karim', 'Elie', 'Hassan', 'Joseph', 'Rami', 'Ziad', 'Fadi', 'Mohammad', 'Charbel', 'Walid'] },
  sy: { femme: ['Lina', 'Rasha', 'Dima', 'Rim', 'Hala', 'Ghada', 'Sawsan', 'Nour', 'Layal', 'Maysa', 'Ruba', 'Salma'], homme: ['Ahmad', 'Omar', 'Bassel', 'Fadi', 'Samer', 'Tarek', 'Majd', 'Hussam', 'Wassim', 'Khaled', 'Ayman', 'Firas'] },
  iq: { femme: ['Zahraa', 'Fatima', 'Noor', 'Rusul', 'Maryam', 'Sura', 'Huda', 'Shahad', 'Ayat', 'Ban', 'Dalia', 'Hiba'], homme: ['Ali', 'Hussein', 'Mohammed', 'Abbas', 'Ahmed', 'Mustafa', 'Haidar', 'Karrar', 'Omar', 'Yasser', 'Qasim', 'Saif'] },
  jo: { femme: ['Rania', 'Dana', 'Lina', 'Sara', 'Haya', 'Tala', 'Nour', 'Rasha', 'Leen', 'Ruba', 'Aya', 'Zeina'], homme: ['Mohammad', 'Ahmad', 'Omar', 'Hussein', 'Zaid', 'Khaled', 'Yazan', 'Laith', 'Hamza', 'Ali', 'Fares', 'Tariq'] },
  ps: { femme: ['Mariam', 'Rawan', 'Hanan', 'Leila', 'Dalia', 'Nadia', 'Reem', 'Shireen', 'Salma', 'Amal', 'Huda', 'Lana'], homme: ['Mohammad', 'Ahmad', 'Yousef', 'Khalil', 'Omar', 'Issa', 'Saleh', 'Mahmoud', 'Ibrahim', 'Rami', 'Elias', 'Karim'] },
  il: { femme: ['Noa', 'Tamar', 'Maya', 'Yael', 'Shira', 'Michal', 'Avigail', 'Sara', 'Lior', 'Rina', 'Mazal', 'Hana'], homme: ['David', 'Yosef', 'Daniel', 'Avi', 'Eitan', 'Noam', 'Itay', 'Moshe', 'Yossi', 'Amir', 'Ori', 'Ariel'] },
  ir: { femme: ['Fatemeh', 'Zahra', 'Maryam', 'Sara', 'Narges', 'Leila', 'Shirin', 'Parisa', 'Mahsa', 'Niloufar', 'Roya', 'Yasaman'], homme: ['Mohammad', 'Ali', 'Hossein', 'Reza', 'Mehdi', 'Amir', 'Saeed', 'Hamid', 'Babak', 'Dariush', 'Kaveh', 'Arash'] },
}
