import type { CountryLook } from './countryStyle'
import { ASIE_CITIES } from '../lib/asieData'
import { inAsia, type AsieId } from '../lib/paysAsie'

// L'Asie dans la rue (the update « pays-asie », backend world/asie.go): each country's own look, told by the position
// like the others (countryStyle.ts lookAt): the nearest of Asia's cities gives the country. Its traffic (the scooters
// by the thousand in Hanoi, Saigon, Jakarta, Bangkok, Taipei; the cars and the taxis in their city's colours: Tokyo's
// black and dark-green cabs, Bangkok's pink and green, Mumbai's black-and-yellow, Singapore's blue, Manila's painted
// jeepneys as its woro), the passers-by in jeans, shirts and light clothes (coats in the cold north), palms in the
// tropics, never Abidjan's tin roofs; the walls' colours, the first names, the snow of the winter, the horns of the
// South Asian street.

type Taxi = { color: string; trim: string }
const look = (id: AsieId, taxi: Taxi, o: { scooters?: number; coats?: boolean; palms?: boolean; taxis?: number } = {}): CountryLook => ({
  id,
  mopeds: (o.scooters ?? 0) >= 3,
  traffic: [...Array<'car'>(5).fill('car'), ...Array<'woro'>(o.taxis ?? 2).fill('woro'), ...Array<'moto'>(o.scooters ?? 0).fill('moto')],
  woro: taxi,
  clothes: 'west',
  coats: o.coats,
  palms: !!o.palms,
  fill: false,
})

export const ASIE_LOOKS: Record<AsieId, CountryLook> = {
  cn: look('cn', { color: '#f7c600', trim: '#1c7ed6' }, { scooters: 2, coats: false }),
  jp: look('jp', { color: '#1a1a1a', trim: '#f1f3f5' }, { taxis: 3 }),
  in: look('in', { color: '#1a1a1a', trim: '#f7c600' }, { scooters: 5, taxis: 3, palms: true }),
  kr: look('kr', { color: '#e8590c', trim: '#f1f3f5' }, { taxis: 2 }),
  th: look('th', { color: '#e64980', trim: '#2f9e44' }, { scooters: 5, taxis: 3, palms: true }),
  vn: look('vn', { color: '#f1f3f5', trim: '#2f9e44' }, { scooters: 10, taxis: 1, palms: true }),
  id: look('id', { color: '#1c7ed6', trim: '#f1f3f5' }, { scooters: 8, palms: true }),
  sg: look('sg', { color: '#1971c2', trim: '#f1f3f5' }, { taxis: 3, palms: true }),
  my: look('my', { color: '#c92a2a', trim: '#f1f3f5' }, { scooters: 3, palms: true }),
  ph: look('ph', { color: '#e8e2d0', trim: '#c92a2a' }, { scooters: 3, taxis: 4, palms: true }),
  hk: look('hk', { color: '#e03131', trim: '#f1f3f5' }, { taxis: 4 }),
  tw: look('tw', { color: '#f7c600', trim: '#1a1a1a' }, { scooters: 7, taxis: 2, palms: true }),
  pk: look('pk', { color: '#f7c600', trim: '#1a1a1a' }, { scooters: 5, taxis: 2, palms: true }),
  bd: look('bd', { color: '#2f9e44', trim: '#f7c600' }, { scooters: 5, taxis: 3, palms: true }),
  lk: look('lk', { color: '#c92a2a', trim: '#1a1a1a' }, { scooters: 4, taxis: 3, palms: true }),
  np: look('np', { color: '#1a1a1a', trim: '#f1f3f5' }, { scooters: 6, coats: true }),
  kh: look('kh', { color: '#f1f3f5', trim: '#1c7ed6' }, { scooters: 7, taxis: 2, palms: true }),
  la: look('la', { color: '#f1f3f5', trim: '#c92a2a' }, { scooters: 6, palms: true }),
  mm: look('mm', { color: '#f1f3f5', trim: '#2b8a3e' }, { scooters: 3, palms: true }),
  mn: look('mn', { color: '#f1f3f5', trim: '#1c7ed6' }, { coats: true }),
  kz: look('kz', { color: '#f7c600', trim: '#1a1a1a' }, { coats: true }),
  uz: look('uz', { color: '#f1f3f5', trim: '#1c7ed6' }, {}),
  mv: look('mv', { color: '#f1f3f5', trim: '#2b8a3e' }, { scooters: 8, palms: true }),
  bn: look('bn', { color: '#f7c600', trim: '#1a1a1a' }, { palms: true }),
  bt: look('bt', { color: '#1c7ed6', trim: '#f1f3f5' }, { coats: true }),
}

/** The country of Asia at a position (inside Asia's box: paysAsie.ts inAsia), the nearest of its cities'; null outside. */
export function asieLookAt(lat: number, lng: number): CountryLook | null {
  if (!inAsia(lat, lng)) return null
  let best = ASIE_CITIES[0]
  let d = Infinity
  const k = Math.cos((lat * Math.PI) / 180)
  for (const c of ASIE_CITIES) {
    const dd = (c[2] - lat) ** 2 + ((c[3] - lng) * k) ** 2
    if (dd < d) (d = dd), (best = c)
  }
  return ASIE_LOOKS[best[1] as AsieId] ?? ASIE_LOOKS.cn
}

/** The walls' colours (buildings.ts): the grey and white concrete and the glass of East Asia's towers, the tiles of Japan,
 *  the pastels and the rain-streaked whites of the tropics, the ochres and pinks of the Indian street, the Soviet blocks of
 *  the steppe, the whitewash of the Himalaya. */
const EAST = ['#d9dde1', '#c8cdd2', '#e9ecef', '#b8bec5', '#f1f3f5', '#a8b0b8', '#cfd8dc', '#e3dcd2', '#9aa5b1']
const JAPAN = ['#efece6', '#e2ddd3', '#d6d1c7', '#c9c4ba', '#f5f3ef', '#bdb6aa', '#8d8a85', '#e8e0d0', '#d8d4cc']
const TROPIC = ['#f8f9fa', '#f4e3c3', '#cfe8e0', '#f2d0a9', '#e0ecd6', '#f7e8a4', '#d0e2f2', '#e8d6c8', '#c3d9c0']
const INDIA = ['#f2c48d', '#e8a87c', '#f4dfb6', '#d9897a', '#efe4cf', '#c9d7c0', '#f6c6a0', '#e6b8c8', '#d8c3a5']
const STEPPE = ['#e9e4d8', '#d8d2c4', '#c7c0b0', '#b8c4cc', '#f0ebe0', '#a9b3b9', '#e3c9a8', '#cfd6da']
const SILK = ['#e8d5b0', '#d9c095', '#f0e2c4', '#c9ad80', '#e6dcc8', '#bfd3de', '#f3ece0']
const HIMALAYA = ['#f5f1e8', '#e9dfcc', '#c45a3a', '#d9c7a8', '#ece4d6', '#a65a3a', '#f2ead8']
export const ASIE_FACADES: Record<string, string[]> = {
  cn: EAST, hk: EAST, tw: EAST, kr: EAST, jp: JAPAN, sg: TROPIC, my: TROPIC, th: TROPIC, vn: TROPIC, id: TROPIC, ph: TROPIC, kh: TROPIC,
  la: TROPIC, mm: TROPIC, bn: TROPIC, mv: TROPIC, lk: TROPIC, in: INDIA, pk: INDIA, bd: INDIA, mn: STEPPE, kz: STEPPE, uz: SILK, np: HIMALAYA, bt: HIMALAYA,
}

/** How much snow lies in a month (1-12): Oulan-Bator and Astana deep in winter, Séoul and Almaty a little, Tokyo rarely. */
const COLD: Record<string, Record<number, number>> = {
  mn: { 10: 0.3, 11: 0.7, 12: 0.9, 1: 1, 2: 1, 3: 0.7, 4: 0.2 },
  kz: { 11: 0.6, 12: 0.9, 1: 1, 2: 1, 3: 0.7, 4: 0.1 },
  kr: { 12: 0.25, 1: 0.4, 2: 0.3 },
  uz: { 1: 0.2, 2: 0.1 },
  jp: { 1: 0.1, 2: 0.15 },
  bt: { 1: 0.15, 2: 0.1 },
}
/** Snow in Asia (none in China: Pékin's winters are dry, Canton's and Hong Kong's warm). */
export const asieSnow = (country: string, month: number) => COLD[country]?.[month] ?? 0

/** Where the horns never stop (ambience.ts): South Asia's streets and Hanoi's, Saigon's, Jakarta's. */
export const ASIE_HONK = new Set(['in', 'pk', 'bd', 'np', 'lk', 'vn', 'id', 'kh', 'ph'])

/** The passers-by's first names (talk.ts). */
export const ASIE_NAMES: Record<AsieId, { femme: string[]; homme: string[] }> = {
  cn: { femme: ['Li Na', 'Wang Fang', 'Zhang Min', 'Liu Yang', 'Chen Jing', 'Xiaoyu', 'Mei', 'Huang Lan', 'Yuting', 'Zhou Xin', 'Fatou', 'Lin Hui'], homme: ['Wei', 'Zhang Wei', 'Li Qiang', 'Wang Lei', 'Chen Jie', 'Haoran', 'Jun', 'Zhao Gang', 'Yang Tao', 'Liu Bo', 'Chinedu', 'Moussa'] },
  jp: { femme: ['Yui', 'Sakura', 'Haruka', 'Aoi', 'Yuki', 'Misaki', 'Rina', 'Mei', 'Nanami', 'Akiko', 'Emi', 'Hina'], homme: ['Haruto', 'Ren', 'Sōta', 'Takumi', 'Kenji', 'Hiroshi', 'Yūto', 'Daiki', 'Kaito', 'Shun', 'Takeshi', 'Riku'] },
  in: { femme: ['Priya', 'Ananya', 'Aisha', 'Kavya', 'Neha', 'Pooja', 'Divya', 'Meera', 'Lakshmi', 'Sana', 'Riya', 'Simran'], homme: ['Arjun', 'Rahul', 'Vikram', 'Aditya', 'Rohan', 'Amit', 'Karan', 'Imran', 'Sanjay', 'Harpreet', 'Ravi', 'Kunal'] },
  kr: { femme: ['Ji-woo', 'Seo-yeon', 'Min-ji', 'Ha-eun', 'Soo-ah', 'Ye-jin', 'Eun-ji', 'Da-eun', 'Hye-jin', 'Yuna', 'Chae-won', 'Ji-hye'], homme: ['Min-jun', 'Seo-jun', 'Ji-ho', 'Do-yun', 'Joon-ho', 'Hyun-woo', 'Tae-yang', 'Sung-min', 'Jae-won', 'Dong-hyun', 'Kwame', 'Min-ho'] },
  th: { femme: ['Siriporn', 'Malee', 'Ploy', 'Nok', 'Pim', 'Kanya', 'Lalita', 'Fon', 'Mint', 'Ratana', 'Achara', 'Noi'], homme: ['Somchai', 'Anan', 'Krit', 'Niran', 'Tawan', 'Boon', 'Chai', 'Prasert', 'Arthit', 'Kittisak', 'Nattapong', 'Wichai'] },
  vn: { femme: ['Linh', 'Lan', 'Huong', 'Mai', 'Thao', 'Trang', 'Ngoc', 'Hoa', 'Phuong', 'Anh', 'Thu', 'Hanh'], homme: ['Minh', 'Duc', 'Huy', 'Tuan', 'Nam', 'Long', 'Quang', 'Hieu', 'Khanh', 'Bao', 'Thanh', 'Phong'] },
  id: { femme: ['Putri', 'Dewi', 'Siti', 'Ayu', 'Ratna', 'Indah', 'Sari', 'Nur', 'Wulan', 'Made', 'Ketut', 'Fitri'], homme: ['Budi', 'Agus', 'Rizky', 'Adi', 'Dimas', 'Bayu', 'Wayan', 'Joko', 'Eko', 'Hendra', 'Fajar', 'Putu'] },
  sg: { femme: ['Mei Ling', 'Siti', 'Priya', 'Jia Hui', 'Nurul', 'Rachel', 'Kavitha', 'Wei Ting', 'Aisyah', 'Hui Min', 'Deepa', 'Shu Fen'], homme: ['Wei Jie', 'Muhammad', 'Ravi', 'Jun Hao', 'Hafiz', 'Daniel', 'Arun', 'Kai Wen', 'Syed', 'Zhi Hao', 'Ryan', 'Kumar'] },
  my: { femme: ['Nur Aisyah', 'Siti', 'Mei Ling', 'Kavitha', 'Farah', 'Aminah', 'Li Wen', 'Nadia', 'Sharmila', 'Hui Yi', 'Aina', 'Zarina'], homme: ['Muhammad', 'Ahmad', 'Ali', 'Wei Ming', 'Rajesh', 'Hafiz', 'Jun Wei', 'Faizal', 'Suresh', 'Azlan', 'Kok Leong', 'Imran'] },
  ph: { femme: ['Maria', 'Angel', 'Princess', 'Grace', 'Joy', 'Kristine', 'Andrea', 'Mae', 'Liza', 'Jasmine', 'Rosario', 'Bea'], homme: ['Juan', 'Jose', 'Mark', 'John Paul', 'Rafael', 'Miguel', 'Carlo', 'Jericho', 'Paolo', 'Ramon', 'Angelo', 'Christian'] },
  hk: { femme: ['Ka Yan', 'Wing Yee', 'Mei', 'Hoi Ying', 'Cheryl', 'Sze Wan', 'Yan Ting', 'Ivy', 'Pui Man', 'Hei Tung', 'Grace', 'Chloe'], homme: ['Ka Ho', 'Chun Kit', 'Wai Lun', 'Ho Yin', 'Jason', 'Kwok Wing', 'Tsz Hin', 'Man Kit', 'Kelvin', 'Chi Ming', 'Emeka', 'Raj'] },
  tw: { femme: ['Ya-ting', 'Hsin-yi', 'Yi-chen', 'Shu-fen', 'Pei-shan', 'Mei-ling', 'Yu-ting', 'Chia-hui', 'Wen-ling', 'Hui-chun', 'Jia-yi', 'Ting'], homme: ['Chih-ming', 'Chia-hao', 'Wei-lun', 'Jun-jie', 'Cheng-en', 'Yu-hsiang', 'Kuan-yu', 'Po-han', 'Tsung-han', 'Chien', 'Yi-ting', 'Hao'] },
  pk: { femme: ['Ayesha', 'Fatima', 'Zainab', 'Hira', 'Sana', 'Mahnoor', 'Amna', 'Iqra', 'Maryam', 'Sadia', 'Nimra', 'Rabia'], homme: ['Muhammad', 'Ahmed', 'Ali', 'Hamza', 'Usman', 'Bilal', 'Imran', 'Faisal', 'Zubair', 'Saad', 'Hassan', 'Kashif'] },
  bd: { femme: ['Nusrat', 'Fatema', 'Tasnim', 'Sumaiya', 'Ayesha', 'Shirin', 'Rupa', 'Mitu', 'Jannat', 'Farzana', 'Purnima', 'Sadia'], homme: ['Rahim', 'Karim', 'Tanvir', 'Arif', 'Sakib', 'Rafiq', 'Mehedi', 'Hasan', 'Sumon', 'Anik', 'Shakil', 'Biplob'] },
  lk: { femme: ['Nimali', 'Dilini', 'Sanduni', 'Kavindi', 'Tharushi', 'Anjali', 'Fathima', 'Ishara', 'Chamari', 'Priyanka', 'Shalini', 'Hasini'], homme: ['Kasun', 'Nuwan', 'Chamara', 'Dinesh', 'Lahiru', 'Tharindu', 'Ruwan', 'Mohamed', 'Suresh', 'Pradeep', 'Ashan', 'Kumar'] },
  np: { femme: ['Sita', 'Gita', 'Anjali', 'Sunita', 'Pema', 'Laxmi', 'Sabina', 'Manisha', 'Dolma', 'Sarita', 'Rina', 'Asha'], homme: ['Ram', 'Hari', 'Bikash', 'Suman', 'Pasang', 'Dawa', 'Nabin', 'Rajesh', 'Sanjay', 'Prakash', 'Tenzing', 'Krishna'] },
  kh: { femme: ['Sreymom', 'Sophea', 'Chantha', 'Dara', 'Bopha', 'Srey Neang', 'Kanha', 'Sokha', 'Mealea', 'Chenda', 'Sothea', 'Rachana'], homme: ['Sokha', 'Vannak', 'Dara', 'Rithy', 'Sambath', 'Pisey', 'Veasna', 'Kosal', 'Bunthoeun', 'Samnang', 'Chea', 'Visal'] },
  la: { femme: ['Noy', 'Keo', 'Phonsavanh', 'Souksavanh', 'Manivanh', 'Bounmy', 'Vilayvanh', 'Daovy', 'Chanthala', 'Malaythong', 'Nang', 'Sengdao'], homme: ['Somphone', 'Bounthavy', 'Khamphanh', 'Souk', 'Phet', 'Vilay', 'Thongsavanh', 'Khamla', 'Sisavath', 'Bounmy', 'Vongsa', 'Kham'] },
  mm: { femme: ['Aye Aye', 'Thida', 'Su Su', 'Hnin', 'May Thu', 'Khin', 'Nilar', 'Ei Ei', 'Phyu', 'Zin Mar', 'Yadanar', 'Thandar'], homme: ['Aung', 'Kyaw', 'Min Thu', 'Zaw', 'Htet', 'Myo', 'Thant', 'Soe', 'Ko Ko', 'Naing', 'Tun', 'Win'] },
  mn: { femme: ['Oyuun', 'Saraa', 'Altantsetseg', 'Enkhjargal', 'Nomin', 'Anu', 'Bolormaa', 'Solongo', 'Tsetseg', 'Khulan', 'Undrakh', 'Narantsetseg'], homme: ['Bat', 'Ganbold', 'Tömör', 'Bold', 'Erdene', 'Temuujin', 'Sükh', 'Batbayar', 'Munkh', 'Enkhbayar', 'Khaliun', 'Altai'] },
  kz: { femme: ['Aigerim', 'Dana', 'Aruzhan', 'Madina', 'Asel', 'Zhanna', 'Kamila', 'Dinara', 'Saule', 'Olga', 'Aliya', 'Gulnara'], homme: ['Nurlan', 'Arman', 'Daniyar', 'Yerlan', 'Aidos', 'Bauyrzhan', 'Sultan', 'Timur', 'Ruslan', 'Dmitri', 'Askar', 'Marat'] },
  uz: { femme: ['Dilnoza', 'Madina', 'Nodira', 'Gulnora', 'Shahnoza', 'Malika', 'Zarina', 'Feruza', 'Nilufar', 'Sevara', 'Kamola', 'Lola'], homme: ['Jasur', 'Bekzod', 'Sardor', 'Rustam', 'Otabek', 'Aziz', 'Farrukh', 'Timur', 'Sherzod', 'Ulugbek', 'Doston', 'Bobur'] },
  mv: { femme: ['Aishath', 'Mariyam', 'Fathimath', 'Hawwa', 'Aminath', 'Shiuna', 'Hudha', 'Zeena', 'Nasheeda', 'Shifa', 'Raufa', 'Liusha'], homme: ['Mohamed', 'Ahmed', 'Ibrahim', 'Hassan', 'Ali', 'Hussain', 'Abdulla', 'Ismail', 'Moosa', 'Yoosuf', 'Shifan', 'Naseem'] },
  bn: { femme: ['Nurul', 'Siti', 'Hajah', 'Aqilah', 'Nadiah', 'Amalina', 'Syazwani', 'Farah', 'Hazirah', 'Liyana', 'Mei Ling', 'Izzati'], homme: ['Muhammad', 'Awang', 'Hafiz', 'Azri', 'Amirul', 'Haziq', 'Faiz', 'Syafiq', 'Firdaus', 'Khairul', 'Wei Jie', 'Aiman'] },
  bt: { femme: ['Pema', 'Dechen', 'Sonam', 'Tshering', 'Kinley', 'Choki', 'Yangchen', 'Karma', 'Deki', 'Tashi', 'Wangmo', 'Dorji'], homme: ['Tshering', 'Dorji', 'Sonam', 'Karma', 'Jigme', 'Ugyen', 'Kinley', 'Tashi', 'Pema', 'Namgay', 'Sangay', 'Wangchuk'] },
}
