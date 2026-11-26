import type { CountryLook } from './countryStyle'
import { AFRIQUE_ANCHORS } from '../lib/paysAfriqueVilles'

// L'Afrique dans la rue (the update « pays-afrique », backend world/afrique.go): each country's street, told by
// the place's position like the others (countryStyle.ts lookAt): the nearest city of the game (Africa's,
// Côte d'Ivoire's, Burkina's) gives the country. Its traffic (Dakar's yellow and black taxis, Lagos's yellow
// danfos, the zémidjans of Cotonou and Lomé, the boda-bodas of Kampala, Casablanca's red petits taxis, the
// Cairo's black and white ones), the passers-by's clothes, the walls' colours, the first names, the sounds.

type Look = Omit<CountryLook, 'id'> & { id: CountryLook['id'] }
const W = (color: string, trim: string) => ({ color, trim })
const coast = (id: CountryLook['id'], traffic: CountryLook['traffic'], woro: { color: string; trim: string }, clothes: CountryLook['clothes'] = 'abidjan'): Look => ({ id, traffic, woro, clothes, palms: true, fill: true })

const MOTOS: CountryLook['traffic'] = ['moto', 'moto', 'moto', 'moto', 'woro', 'woro', 'car', 'car']
const TAXIS: CountryLook['traffic'] = ['taxi', 'woro', 'woro', 'woro', 'car', 'car', 'car', 'moto']
const CARS: CountryLook['traffic'] = ['woro', 'woro', 'car', 'car', 'car', 'car', 'car', 'moto']

export const AFRIQUE_LOOKS: Record<string, Look> = {
  sn: coast('sn', TAXIS, W('#f7c600', '#1a1a1a')),
  ml: coast('ml', MOTOS, W('#2f9e44', '#f8f9fa'), 'sahel'),
  gh: coast('gh', TAXIS, W('#f8f9fa', '#f59f00')),
  gn: coast('gn', TAXIS, W('#f7c600', '#1a1a1a')),
  tg: coast('tg', MOTOS, W('#f7c600', '#2f9e44')),
  bj: coast('bj', MOTOS, W('#f7c600', '#2f9e44')),
  ng: coast('ng', ['woro', 'woro', 'woro', 'moto', 'moto', 'car', 'car', 'taxi'], W('#f7c600', '#1a1a1a')),
  ne: coast('ne', MOTOS, W('#2f9e44', '#f8f9fa'), 'sahel'),
  lr: coast('lr', TAXIS, W('#f7c600', '#1a1a1a')),
  sl: coast('sl', TAXIS, W('#f7c600', '#1c7ed6')),
  gm: coast('gm', TAXIS, W('#2f9e44', '#f7c600')),
  gw: coast('gw', TAXIS, W('#1c7ed6', '#f8f9fa')),
  cv: coast('cv', CARS, W('#f1e3c8', '#1a1a1a'), 'ville'),
  mr: coast('mr', TAXIS, W('#f1f3f5', '#2f9e44'), 'sahel'),
  cm: coast('cm', MOTOS, W('#f7c600', '#1a1a1a')),
  ga: coast('ga', TAXIS, W('#e03131', '#f8f9fa')),
  cg: coast('cg', TAXIS, W('#2f9e44', '#f8f9fa')),
  cd: coast('cd', TAXIS, W('#f7c600', '#1c7ed6')),
  td: coast('td', MOTOS, W('#f7c600', '#1a1a1a'), 'sahel'),
  cf: coast('cf', MOTOS, W('#f7c600', '#1a1a1a')),
  gq: coast('gq', CARS, W('#f8f9fa', '#1c7ed6')),
  ma: coast('ma', CARS, W('#c92a2a', '#f8f9fa'), 'nord'),
  dz: coast('dz', CARS, W('#f7c600', '#1a1a1a'), 'nord'),
  tn: coast('tn', CARS, W('#f7c600', '#1a1a1a'), 'nord'),
  eg: coast('eg', ['woro', 'woro', 'woro', 'car', 'car', 'car', 'moto', 'taxi'], W('#f8f9fa', '#1a1a1a'), 'nord'),
  ly: coast('ly', CARS, W('#f8f9fa', '#e03131'), 'nord'),
  et: coast('et', TAXIS, W('#1c7ed6', '#f8f9fa'), 'ville'),
  ke: coast('ke', ['woro', 'woro', 'woro', 'car', 'car', 'car', 'moto', 'moto'], W('#7048e8', '#f7c600'), 'ville'),
  tz: coast('tz', ['woro', 'woro', 'moto', 'moto', 'car', 'car', 'car', 'taxi'], W('#f8f9fa', '#2f9e44'), 'ville'),
  ug: coast('ug', MOTOS, W('#f8f9fa', '#1c7ed6'), 'ville'),
  rw: coast('rw', MOTOS, W('#f8f9fa', '#2f9e44'), 'ville'),
  sd: coast('sd', TAXIS, W('#f7c600', '#1a1a1a'), 'sahel'),
  so: coast('so', TAXIS, W('#f8f9fa', '#1c7ed6'), 'sahel'),
  dj: coast('dj', TAXIS, W('#2f9e44', '#f8f9fa'), 'sahel'),
  mg: coast('mg', TAXIS, W('#f1e3c8', '#1a1a1a'), 'ville'),
  za: { id: 'za', traffic: ['woro', 'woro', 'car', 'car', 'car', 'car', 'car', 'car'], woro: W('#f8f9fa', '#868e96'), clothes: 'ville', palms: false, fill: true },
  ao: coast('ao', CARS, W('#1c7ed6', '#f8f9fa'), 'ville'),
  mz: coast('mz', CARS, W('#f8f9fa', '#e03131'), 'ville'),
  zm: coast('zm', CARS, W('#4dabf7', '#f8f9fa'), 'ville'),
  zw: coast('zw', CARS, W('#f8f9fa', '#2f9e44'), 'ville'),
  na: { id: 'na', traffic: CARS, woro: W('#f8f9fa', '#1c7ed6'), clothes: 'ville', palms: false, fill: true },
  bw: { id: 'bw', traffic: CARS, woro: W('#1c7ed6', '#f8f9fa'), clothes: 'ville', palms: false, fill: true },
}

// Côte d'Ivoire's and Burkina's cities, to tell them from their neighbours' (countryStyle.ts keeps their looks).
const HOME: [string, string, number, number][] = [
  ['abidjan', 'ci', 5.33, -4.01],
  ['grand-bassam', 'ci', 5.2, -3.74],
  ['yamoussoukro', 'ci', 6.82, -5.28],
  ['bouake', 'ci', 7.69, -5.03],
  ['san-pedro', 'ci', 4.75, -6.64],
  ['man', 'ci', 7.41, -7.55],
  ['korhogo', 'ci', 9.46, -5.63],
  ['daloa', 'ci', 6.88, -6.45],
  ['ouagadougou', 'bf', 12.37, -1.53],
  ['bobo-dioulasso', 'bf', 11.18, -4.3],
]
const ALL = [...HOME, ...AFRIQUE_ANCHORS]

/** Africa's look at a position: its nearest city's country's, or null for Côte d'Ivoire's and Burkina's own (and off the continent). */
export function afriqueLookAt(lat: number, lng: number): Look | null {
  if (lng < -30 || lng > 60 || lat > 38 || lat < -36) return null
  let best = ALL[0]
  let d = Infinity
  const k = Math.cos((lat * Math.PI) / 180)
  for (const a of ALL) {
    const e = (a[2] - lat) ** 2 + ((a[3] - lng) * k) ** 2
    if (e < d) (d = e), (best = a)
  }
  return AFRIQUE_LOOKS[best[1]] ?? null
}

/** The countries whose streets buzz with mopeds and moto-taxis (audio/ambience.ts: the zémidjans, the okadas, the boda-bodas). */
export const MOPED_LANDS = new Set(['bf', 'ml', 'ne', 'tg', 'bj', 'cm', 'td', 'cf', 'ug', 'rw', 'ng'])
/** The countries whose traffic honks the most (Lagos, Cairo, Dakar, Kinshasa, Accra). */
export const HONK_LANDS = new Set(['ng', 'eg', 'sn', 'cd', 'gh', 'ke'])

// The walls' colours (open/buildings.ts): the Sahel's banco and ochres, the Maghreb's whites and blues, Marrakech's
// red ochre, Egypt's sand, the colonial pastels of the coasts.
const SAHEL = ['#d9a46a', '#c98b52', '#e6c08a', '#b8784a', '#f0dcb4', '#cf9a6a', '#e8d2a6', '#f3efe6']
const MAGHREB = ['#ffffff', '#f8f9fa', '#f1f3f5', '#e7f1fb', '#d0e3f5', '#f6efe0', '#ffffff', '#eef4fa']
export const AFRIQUE_FACADES: Record<string, string[]> = {
  ml: SAHEL,
  ne: SAHEL,
  td: SAHEL,
  mr: ['#e9d8b4', '#f3ead6', '#d8c49c', '#ffffff', '#efe2c4', '#c9b48a'],
  sd: SAHEL,
  ma: ['#c9714f', '#d98b65', '#e3a27f', '#f3e2d2', '#ffffff', '#b85e3f', '#e8c4a8'],
  dz: MAGHREB,
  tn: MAGHREB,
  ly: MAGHREB,
  eg: ['#e8d9b8', '#d9c49a', '#cdb48a', '#f1e7d0', '#bfa47a', '#e0cfa9', '#a89070'],
  cv: ['#f6d58e', '#f4b89a', '#cfe3f3', '#bfe3c6', '#f2a99f', '#ffffff', '#e3d3ef', '#ffd6a5'],
  za: ['#e9ecef', '#dee2e6', '#c9b79c', '#b5654a', '#a8a49c', '#f1e3c8', '#8a7f74', '#ffffff'],
}

/** The first names of the street (world3d/talk.ts), each country its own. */
export const AFRIQUE_NAMES: Record<string, { femme: string[]; homme: string[] }> = {
  sn: { femme: ['Fatou', 'Aminata', 'Awa', 'Khady', 'Ndèye', 'Mariama', 'Coumba', 'Astou', 'Seynabou', 'Rokhaya', 'Bineta', 'Adama'], homme: ['Mamadou', 'Ousmane', 'Cheikh', 'Abdoulaye', 'Moussa', 'Ibrahima', 'Modou', 'Pape', 'Serigne', 'Babacar', 'Alioune', 'Lamine'] },
  ml: { femme: ['Aminata', 'Kadiatou', 'Fatoumata', 'Mariam', 'Oumou', 'Assitan', 'Djeneba', 'Rokia', 'Salimata', 'Nana', 'Hawa', 'Aïssata'], homme: ['Modibo', 'Seydou', 'Bakary', 'Boubacar', 'Souleymane', 'Mamadou', 'Drissa', 'Lassana', 'Adama', 'Sékou', 'Oumar', 'Daouda'] },
  gh: { femme: ['Ama', 'Akosua', 'Abena', 'Adwoa', 'Efua', 'Esi', 'Yaa', 'Akua', 'Afua', 'Naa', 'Adjoa', 'Gifty'], homme: ['Kwame', 'Kofi', 'Kwabena', 'Kwaku', 'Yaw', 'Kojo', 'Kwesi', 'Nana', 'Kobby', 'Emmanuel', 'Isaac', 'Samuel'] },
  gn: { femme: ['Mariama', 'Fatoumata', 'Kadiatou', 'Aïssatou', 'Saran', 'Nènè', 'Mabinty', 'Djénab', 'Oumou', 'Bintou', 'Kankou', 'Hadja'], homme: ['Alpha', 'Mamadou', 'Sékou', 'Ibrahima', 'Lansana', 'Thierno', 'Abdoulaye', 'Moussa', 'Ousmane', 'Fodé', 'Kaba', 'Souleymane'] },
  tg: { femme: ['Akossiwa', 'Ayaba', 'Adjoa', 'Kafui', 'Yawa', 'Afi', 'Essi', 'Dzifa', 'Mawusi', 'Abla', 'Enyonam', 'Sena'], homme: ['Koffi', 'Kodjo', 'Komlan', 'Yao', 'Kossi', 'Kokou', 'Edem', 'Sélom', 'Mawuli', 'Kwami', 'Dodji', 'Elom'] },
  bj: { femme: ['Ahouéfa', 'Sika', 'Dossi', 'Kpèvi', 'Nadège', 'Bénédicta', 'Gisèle', 'Chimène', 'Raïssa', 'Prisca', 'Fifamè', 'Houéfa'], homme: ['Codjo', 'Sèna', 'Kocou', 'Dossou', 'Rodrigue', 'Fiacre', 'Aurel', 'Gildas', 'Romaric', 'Sourou', 'Comlan', 'Hounkpè'] },
  ng: { femme: ['Chiamaka', 'Ngozi', 'Amaka', 'Funmilayo', 'Folake', 'Aisha', 'Zainab', 'Adaeze', 'Bisi', 'Temitope', 'Hauwa', 'Chioma'], homme: ['Chinedu', 'Emeka', 'Tunde', 'Femi', 'Olumide', 'Ibrahim', 'Musa', 'Obinna', 'Segun', 'Kelechi', 'Babatunde', 'Abubakar'] },
  ne: { femme: ['Mariama', 'Hadiza', 'Rakia', 'Zeinabou', 'Fati', 'Haoua', 'Aïchatou', 'Ramatou', 'Salamatou', 'Balkissa', 'Hassana', 'Mounira'], homme: ['Moussa', 'Issoufou', 'Abdou', 'Hamani', 'Seyni', 'Boubacar', 'Amadou', 'Ali', 'Ibrahim', 'Hassane', 'Souley', 'Garba'] },
  lr: { femme: ['Fatu', 'Musu', 'Comfort', 'Precious', 'Blessing', 'Esther', 'Martha', 'Hawa', 'Kebbeh', 'Satta', 'Mamie', 'Patience'], homme: ['Emmanuel', 'Joseph', 'Prince', 'Moses', 'Varney', 'Sekou', 'Momo', 'Kollie', 'Augustine', 'Samuel', 'Boima', 'Jallah'] },
  sl: { femme: ['Fatmata', 'Isatu', 'Mariatu', 'Aminata', 'Kadiatu', 'Hawa', 'Mabinty', 'Adama', 'Zainab', 'Christiana', 'Memunatu', 'Salamatu'], homme: ['Mohamed', 'Abu', 'Ibrahim', 'Alhaji', 'Sorie', 'Foday', 'Sahr', 'Brima', 'Abdul', 'Musa', 'Joseph', 'Komba'] },
  gm: { femme: ['Fatou', 'Isatou', 'Mariama', 'Awa', 'Binta', 'Haddy', 'Ndey', 'Oumie', 'Jainaba', 'Kaddy', 'Amie', 'Sainabou'], homme: ['Lamin', 'Ebrima', 'Modou', 'Musa', 'Omar', 'Alieu', 'Momodou', 'Bakary', 'Abdoulie', 'Ousman', 'Sheriff', 'Pa'] },
  gw: { femme: ['Maria', 'Fatumata', 'Ana', 'Djenabu', 'Aminata', 'Rosa', 'Mariama', 'Adelina', 'Fátima', 'Joana', 'Isabel', 'Sadjo'], homme: ['João', 'Amílcar', 'Domingos', 'Braima', 'Mamadu', 'Carlos', 'Lassana', 'Bubacar', 'Armando', 'Augusto', 'Malam', 'Seco'] },
  cv: { femme: ['Maria', 'Ana', 'Carla', 'Sandra', 'Elisa', 'Lúcia', 'Ivone', 'Dina', 'Edna', 'Joana', 'Sónia', 'Nancy'], homme: ['João', 'José', 'Carlos', 'Manuel', 'António', 'Paulo', 'Jorge', 'Nelson', 'Mário', 'Hélder', 'Ivo', 'Tito'] },
  mr: { femme: ['Mariem', 'Fatimetou', 'Aïchetou', 'Khadijetou', 'Mounina', 'Lalla', 'Mekfoula', 'Zeinebou', 'Toutou', 'Selma', 'Vatma', 'Aminetou'], homme: ['Mohamed', 'Ahmed', 'Sidi', 'Cheikh', 'Moustapha', 'Brahim', 'Mohamedou', 'Abdallahi', 'El Hacen', 'Yahya', 'Mamadou', 'Isselmou'] },
  cm: { femme: ['Christelle', 'Nadège', 'Mireille', 'Brenda', 'Aïssatou', 'Laure', 'Estelle', 'Murielle', 'Carine', 'Pélagie', 'Hadja', 'Ngono'], homme: ['Samuel', 'Jean-Pierre', 'Rigobert', 'Ibrahim', 'Junior', 'Thierry', 'Fabrice', 'Hervé', 'Boris', 'Roger', 'Achille', 'Joël'] },
  ga: { femme: ['Nadège', 'Ornella', 'Larissa', 'Gisèle', 'Pascaline', 'Murielle', 'Laure', 'Annick', 'Prisca', 'Sandrine', 'Joëlle', 'Rachel'], homme: ['Arnaud', 'Landry', 'Rodrigue', 'Ulrich', 'Brice', 'Christian', 'Davy', 'Junior', 'Loïc', 'Fabrice', 'Serge', 'Guy'] },
  cg: { femme: ['Grâce', 'Merveille', 'Chancelvie', 'Divine', 'Plamedie', 'Exaucée', 'Bénie', 'Rebecca', 'Nadège', 'Christelle', 'Gloria', 'Ruth'], homme: ['Destin', 'Exaucé', 'Fiston', 'Ghislain', 'Ulrich', 'Rufin', 'Christ', 'Jordan', 'Prince', 'Dieudonné', 'Junior', 'Bienvenu'] },
  cd: { femme: ['Mamie', 'Merveille', 'Grâce', 'Plamedie', 'Divine', 'Gloire', 'Chancelle', 'Bénédicte', 'Tshala', 'Mbuyi', 'Kapinga', 'Exaucée'], homme: ['Fiston', 'Patrick', 'Dieudonné', 'Junior', 'Bienvenu', 'Christian', 'Héritier', 'Glody', 'Trésor', 'Ilunga', 'Mukendi', 'Kabeya'] },
  td: { femme: ['Achta', 'Fatimé', 'Haoua', 'Zara', 'Halimé', 'Mariam', 'Khadidja', 'Amina', 'Hadjé', 'Ache', 'Nadjiyam', 'Mbaïdedji'], homme: ['Mahamat', 'Abakar', 'Idriss', 'Ahmat', 'Moussa', 'Hassan', 'Ousmane', 'Brahim', 'Djibrine', 'Saleh', 'Adoum', 'Youssouf'] },
  cf: { femme: ['Clarisse', 'Bertille', 'Josiane', 'Pélagie', 'Yvette', 'Gisèle', 'Nadège', 'Rosine', 'Huguette', 'Odile', 'Prisca', 'Mireille'], homme: ['Jean-Claude', 'Firmin', 'Faustin', 'Martial', 'Thierry', 'Serge', 'Gervais', 'Prosper', 'Didier', 'Éloi', 'Romaric', 'Wilfried'] },
  gq: { femme: ['María', 'Rosa', 'Ana', 'Pilar', 'Mercedes', 'Teresa', 'Carmen', 'Isabel', 'Natividad', 'Remedios', 'Lucía', 'Elena'], homme: ['Juan', 'José', 'Pedro', 'Francisco', 'Antonio', 'Santiago', 'Manuel', 'Ángel', 'Fausto', 'Carlos', 'Miguel', 'Pablo'] },
  ma: { femme: ['Fatima', 'Khadija', 'Salma', 'Imane', 'Meryem', 'Zineb', 'Nadia', 'Houda', 'Sanaa', 'Hajar', 'Kawtar', 'Amina'], homme: ['Mohammed', 'Youssef', 'Hamza', 'Mehdi', 'Omar', 'Karim', 'Rachid', 'Anas', 'Ayoub', 'Saïd', 'Hicham', 'Adil'] },
  dz: { femme: ['Amina', 'Lynda', 'Sarah', 'Yasmine', 'Nesrine', 'Lamia', 'Samira', 'Kahina', 'Meriem', 'Rania', 'Imène', 'Dalila'], homme: ['Mohamed', 'Amine', 'Karim', 'Sofiane', 'Yacine', 'Bilal', 'Riad', 'Walid', 'Nassim', 'Mourad', 'Djamel', 'Farid'] },
  tn: { femme: ['Amira', 'Sarra', 'Inès', 'Mariem', 'Rim', 'Olfa', 'Nour', 'Emna', 'Asma', 'Hela', 'Yosra', 'Sonia'], homme: ['Mohamed', 'Ahmed', 'Aymen', 'Hamza', 'Skander', 'Wassim', 'Bilel', 'Mehdi', 'Youssef', 'Anis', 'Karim', 'Slim'] },
  eg: { femme: ['Fatma', 'Mona', 'Nour', 'Yasmin', 'Salma', 'Hoda', 'Mariam', 'Aya', 'Dina', 'Rana', 'Heba', 'Shaimaa'], homme: ['Mohamed', 'Ahmed', 'Mahmoud', 'Mostafa', 'Omar', 'Youssef', 'Khaled', 'Amr', 'Tarek', 'Karim', 'Hassan', 'Sherif'] },
  ly: { femme: ['Fatima', 'Aïcha', 'Hana', 'Salma', 'Mabrouka', 'Nour', 'Asma', 'Huda', 'Amal', 'Rim', 'Zainab', 'Sara'], homme: ['Mohamed', 'Ali', 'Ahmed', 'Abdullah', 'Omar', 'Khaled', 'Salem', 'Mustafa', 'Faraj', 'Ibrahim', 'Tarek', 'Anwar'] },
  et: { femme: ['Hiwot', 'Meron', 'Selam', 'Tigist', 'Bethlehem', 'Liya', 'Mahlet', 'Saba', 'Hana', 'Eden', 'Rahel', 'Almaz'], homme: ['Abebe', 'Dawit', 'Yonas', 'Bereket', 'Tesfaye', 'Biniam', 'Kidus', 'Henok', 'Getachew', 'Solomon', 'Mesfin', 'Haile'] },
  ke: { femme: ['Wanjiku', 'Akinyi', 'Njeri', 'Atieno', 'Wambui', 'Chebet', 'Faith', 'Mercy', 'Achieng', 'Nyambura', 'Wairimu', 'Grace'], homme: ['Kamau', 'Otieno', 'Mwangi', 'Kipchoge', 'Odhiambo', 'Kibet', 'Njoroge', 'Ochieng', 'Brian', 'Kevin', 'Wafula', 'Kariuki'] },
  tz: { femme: ['Neema', 'Rehema', 'Zawadi', 'Upendo', 'Amani', 'Furaha', 'Halima', 'Mwanaisha', 'Asha', 'Subira', 'Imani', 'Rose'], homme: ['Baraka', 'Juma', 'Hamisi', 'Rashidi', 'Emmanuel', 'Salim', 'Athumani', 'Goodluck', 'Daudi', 'Mussa', 'Omari', 'Joseph'] },
  ug: { femme: ['Nakato', 'Babirye', 'Namubiru', 'Nalwoga', 'Sarah', 'Esther', 'Nankya', 'Prossy', 'Florence', 'Grace', 'Aisha', 'Achieng'], homme: ['Mukasa', 'Kato', 'Waswa', 'Okello', 'Opio', 'Mugisha', 'Byaruhanga', 'Isaac', 'Brian', 'Ivan', 'Ronald', 'Ssali'] },
  rw: { femme: ['Uwase', 'Mutoni', 'Ingabire', 'Umutoni', 'Keza', 'Ishimwe', 'Uwimana', 'Mukamana', 'Iradukunda', 'Gisèle', 'Diane', 'Aline'], homme: ['Habimana', 'Niyonzima', 'Mugisha', 'Kwizera', 'Nshuti', 'Hirwa', 'Ndayisaba', 'Eric', 'Jean-Paul', 'Olivier', 'Patrick', 'Manzi'] },
  sd: { femme: ['Fatima', 'Amna', 'Mawahib', 'Samah', 'Hiba', 'Sara', 'Rayan', 'Tasneem', 'Afraa', 'Malaz', 'Nusiba', 'Hawa'], homme: ['Mohamed', 'Ahmed', 'Osman', 'Abdelrahman', 'Hassan', 'Mustafa', 'Omer', 'Elsir', 'Babiker', 'Hamid', 'Yasir', 'Khalid'] },
  so: { femme: ['Hodan', 'Faadumo', 'Ayaan', 'Hibaaq', 'Sahra', 'Ifrah', 'Hamdi', 'Nimco', 'Ubah', 'Ladan', 'Khadra', 'Amina'], homme: ['Abdi', 'Mohamed', 'Ahmed', 'Abdirahman', 'Hassan', 'Farah', 'Yusuf', 'Omar', 'Liban', 'Ismail', 'Mahad', 'Bashir'] },
  dj: { femme: ['Hasna', 'Fathia', 'Kadra', 'Hodan', 'Amina', 'Deka', 'Saïda', 'Zahra', 'Roukia', 'Mouna', 'Fatouma', 'Asma'], homme: ['Ahmed', 'Moussa', 'Omar', 'Ismaël', 'Houssein', 'Hassan', 'Abdourahman', 'Daher', 'Ali', 'Mohamed', 'Idriss', 'Aden'] },
  mg: { femme: ['Hanitra', 'Voahangy', 'Fanja', 'Lalao', 'Nirina', 'Haingo', 'Tiana', 'Mialy', 'Fara', 'Rindra', 'Malala', 'Noro'], homme: ['Andry', 'Hery', 'Tahina', 'Toky', 'Rivo', 'Faly', 'Mamy', 'Njaka', 'Fidy', 'Lova', 'Tojo', 'Rado'] },
  za: { femme: ['Thandi', 'Nomvula', 'Lerato', 'Zanele', 'Ayanda', 'Palesa', 'Naledi', 'Busisiwe', 'Thandeka', 'Precious', 'Anele', 'Michelle'], homme: ['Sipho', 'Thabo', 'Bongani', 'Mandla', 'Themba', 'Lwazi', 'Kagiso', 'Tshepo', 'Johan', 'Pieter', 'Siyabonga', 'Lungile'] },
  ao: { femme: ['Ana', 'Maria', 'Isabel', 'Luísa', 'Esperança', 'Fátima', 'Joana', 'Teresa', 'Neusa', 'Yola', 'Edna', 'Wilma'], homme: ['João', 'António', 'Manuel', 'José', 'Paulo', 'Domingos', 'Agostinho', 'Mateus', 'Nelson', 'Adilson', 'Edson', 'Hélder'] },
  mz: { femme: ['Ana', 'Maria', 'Graça', 'Luísa', 'Celeste', 'Albertina', 'Isabel', 'Rosa', 'Lurdes', 'Amélia', 'Esperança', 'Telma'], homme: ['João', 'José', 'Armando', 'Fernando', 'Carlos', 'Alberto', 'Celso', 'Ernesto', 'Mário', 'Abílio', 'Edson', 'Benedito'] },
  zm: { femme: ['Mwila', 'Chanda', 'Mutale', 'Bwalya', 'Natasha', 'Precious', 'Mercy', 'Chileshe', 'Mwape', 'Thandiwe', 'Namakau', 'Grace'], homme: ['Mulenga', 'Chanda', 'Bwalya', 'Mwansa', 'Kabwe', 'Banda', 'Phiri', 'Mutale', 'Lubinda', 'Musonda', 'Moses', 'Joseph'] },
  zw: { femme: ['Rudo', 'Tendai', 'Chipo', 'Nyasha', 'Tatenda', 'Rumbidzai', 'Tsitsi', 'Vimbai', 'Farai', 'Kudzai', 'Fadzai', 'Shamiso'], homme: ['Tendai', 'Tatenda', 'Farai', 'Tinashe', 'Tafadzwa', 'Kudakwashe', 'Takudzwa', 'Blessing', 'Simba', 'Munashe', 'Tonderai', 'Nyasha'] },
  na: { femme: ['Ndapewa', 'Ndeshi', 'Hilma', 'Selma', 'Martha', 'Saara', 'Frieda', 'Monika', 'Nangula', 'Johanna', 'Aina', 'Ester'], homme: ['Shikongo', 'Petrus', 'Johannes', 'Tangeni', 'Kaarlo', 'Simon', 'Elia', 'Festus', 'Hafeni', 'Matheus', 'Thomas', 'Ndapanda'] },
  bw: { femme: ['Boitumelo', 'Lesego', 'Neo', 'Masego', 'Onalenna', 'Kelebogile', 'Gorata', 'Mpho', 'Naledi', 'Tebogo', 'Keabetswe', 'Kagiso'], homme: ['Kagiso', 'Thato', 'Tshepo', 'Mpho', 'Kabelo', 'Oratile', 'Lesedi', 'Tebogo', 'Kgosi', 'Onkemetse', 'Bakang', 'Goitseone'] },
}
