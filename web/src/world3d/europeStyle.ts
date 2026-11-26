import type { CountryLook } from './countryStyle'
import { EUROPE_CITIES } from '../lib/europeData'
import type { EuropeId } from '../lib/paysEurope'

// L'Europe dans la rue (the update « pays-europe », backend world/europe.go): each country's own look, told by the
// position like the others (countryStyle.ts lookAt): the nearest of Europe's cities gives the country. Its traffic
// (cars; taxis in their city's colours: London's black cabs, Berlin's ivory, Istanbul's and Moscow's yellow;
// scooters in Rome, Athens, Barcelona), the passers-by in jeans and jackets (coats in the north and the east), no
// coconut palms but on the Mediterranean, no houses under tin; the walls' colours (facades), the first names, the
// snow of the winter, the church bells.

type Taxi = { color: string; trim: string }
const look = (id: EuropeId, taxi: Taxi, o: { scooters?: number; coats?: boolean; palms?: boolean } = {}): CountryLook => ({
  id,
  mopeds: (o.scooters ?? 0) >= 4,
  traffic: [...Array<'car'>(6).fill('car'), 'woro', 'woro', ...Array<'moto'>(o.scooters ?? 0).fill('moto')],
  woro: taxi,
  clothes: 'west',
  coats: o.coats,
  palms: !!o.palms,
  fill: false,
})
const WHITE: Taxi = { color: '#f1f3f5', trim: '#1a1a1a' }
const BLACK: Taxi = { color: '#1a1a1a', trim: '#f1f3f5' }
const YELLOW: Taxi = { color: '#f7c600', trim: '#1a1a1a' }
const IVORY: Taxi = { color: '#efe6c8', trim: '#1a1a1a' }

export const EUROPE_LOOKS: Record<EuropeId, CountryLook> = {
  be: look('be', BLACK, { coats: true }),
  gb: look('gb', BLACK, { coats: true }), // the black cabs
  de: look('de', IVORY, { coats: true }),
  it: look('it', WHITE, { scooters: 4 }),
  es: look('es', { color: '#f1f3f5', trim: '#c92a2a' }, { scooters: 3, palms: true }),
  pt: look('pt', { color: '#efe6c8', trim: '#2b8a3e' }, { scooters: 1, palms: true }),
  ch: look('ch', WHITE, { coats: true }),
  nl: look('nl', BLACK, { coats: true, scooters: 2 }),
  ie: look('ie', WHITE, { coats: true }),
  at: look('at', BLACK, { coats: true }),
  pl: look('pl', WHITE, { coats: true }),
  cz: look('cz', YELLOW, { coats: true }),
  hu: look('hu', YELLOW, { coats: true }),
  gr: look('gr', YELLOW, { scooters: 4, palms: true }),
  se: look('se', WHITE, { coats: true }),
  no: look('no', BLACK, { coats: true }),
  dk: look('dk', BLACK, { coats: true }),
  fi: look('fi', BLACK, { coats: true }),
  ro: look('ro', YELLOW, { coats: true }),
  bg: look('bg', YELLOW, { coats: true }),
  hr: look('hr', WHITE, { scooters: 1 }),
  rs: look('rs', WHITE, { coats: true }),
  ua: look('ua', YELLOW, { coats: true }),
  ru: look('ru', YELLOW, { coats: true }),
  tr: look('tr', YELLOW, { scooters: 2 }),
  is: look('is', WHITE, { coats: true }),
  lu: look('lu', BLACK, { coats: true }),
  mc: look('mc', WHITE, { scooters: 2, palms: true }),
}

/** The country of Europe at a position: the nearest of its cities' (the chunks of the game are all near one). */
export function europeLookAt(lat: number, lng: number): CountryLook {
  let best = EUROPE_CITIES[0]
  let d = Infinity
  const k = Math.cos((lat * Math.PI) / 180)
  for (const c of EUROPE_CITIES) {
    const dd = (c[2] - lat) ** 2 + ((c[3] - lng) * k) ** 2
    if (dd < d) (d = dd), (best = c)
  }
  return EUROPE_LOOKS[best[1] as EuropeId] ?? EUROPE_LOOKS.be
}

/** The walls' colours (buildings.ts): the brick of the north, the stone and stucco of the middle, the ochres and whites of the south, the painted wood of the Nordics. */
const BRICK = ['#8b4a3a', '#a0553f', '#7a3b2e', '#b86a4f', '#c4bba8', '#d9d2c3', '#6c4a3e', '#9c5a42', '#e6e0d2']
const STONE = ['#e8e1d0', '#d6cdb8', '#c9c0ac', '#efe8d8', '#b8b0a0', '#f2ead8', '#d9cfc0', '#a8a398', '#e3d6bc']
const SOUTH = ['#e8b27a', '#d98e5a', '#f2d49b', '#c8643c', '#f5e6c8', '#e0a96d', '#f7efe2', '#d4a373', '#b5583c']
const WHITEWASH = ['#f8f9fa', '#f1f3f5', '#e9ecef', '#f5efe0', '#dbe4ee', '#f7f1e3', '#e3d5b8']
const NORDIC = ['#c0392b', '#e6b33a', '#f2f2ee', '#5b7c99', '#8c2f39', '#e8d9b0', '#4a6b5a', '#d9a441']
const EAST = ['#e9dcc0', '#d4c7a8', '#c9a98a', '#b3b8bd', '#f0e6d2', '#9fa6ad', '#e8c9a0', '#cfd4d8', '#a88c74']
const PASTEL = ['#f4c2a1', '#f7e1a0', '#b9d7c9', '#e8b4b8', '#f1d6a7', '#c7d6e6', '#f2efe6', '#e7c3a0']
const byCountry: Record<string, string[]> = {
  be: BRICK, gb: BRICK, nl: BRICK, ie: PASTEL, dk: NORDIC, de: STONE, at: STONE, ch: STONE, lu: STONE, cz: PASTEL, hu: STONE, pl: PASTEL,
  it: SOUTH, es: SOUTH, pt: PASTEL, mc: SOUTH, gr: WHITEWASH, hr: SOUTH, tr: SOUTH, se: NORDIC, no: NORDIC, fi: STONE, is: NORDIC,
  ro: EAST, bg: EAST, rs: EAST, ua: EAST, ru: PASTEL,
}
export const EUROPE_FACADES: Record<string, string[]> = byCountry

/** How much snow lies in a month (1-12): the north and the east deep in winter, the middle a little, the south none. */
const COLD: Record<string, Record<number, number>> = {
  ru: { 11: 0.6, 12: 0.9, 1: 1, 2: 1, 3: 0.8, 4: 0.2 },
  fi: { 11: 0.5, 12: 0.85, 1: 1, 2: 1, 3: 0.8, 4: 0.3 },
  se: { 12: 0.5, 1: 0.8, 2: 0.8, 3: 0.4 },
  no: { 11: 0.3, 12: 0.6, 1: 0.9, 2: 0.9, 3: 0.6, 4: 0.1 },
  is: { 11: 0.3, 12: 0.5, 1: 0.6, 2: 0.6, 3: 0.4 },
  ua: { 12: 0.5, 1: 0.8, 2: 0.7, 3: 0.3 },
  pl: { 12: 0.35, 1: 0.6, 2: 0.5, 3: 0.15 },
  cz: { 12: 0.3, 1: 0.5, 2: 0.4 },
  at: { 12: 0.3, 1: 0.5, 2: 0.4 },
  ch: { 12: 0.25, 1: 0.4, 2: 0.35 },
  hu: { 1: 0.35, 2: 0.25 },
  ro: { 12: 0.3, 1: 0.5, 2: 0.4 },
  bg: { 1: 0.4, 2: 0.3 },
  rs: { 1: 0.3, 2: 0.25 },
  de: { 1: 0.3, 2: 0.25 },
}
export const europeSnow = (country: string, month: number) => COLD[country]?.[month] ?? 0

/** Where the church bells ring now and then in the street (ambience.ts). */
export const EUROPE_BELLS = new Set(['be', 'de', 'it', 'es', 'pt', 'ch', 'at', 'pl', 'cz', 'hu', 'hr', 'lu', 'mc', 'ie', 'gb', 'nl', 'ro', 'bg', 'rs', 'ua', 'ru', 'gr', 'se', 'no', 'dk', 'fi', 'is'])

/** The passers-by's first names (talk.ts). */
export const EUROPE_NAMES: Record<EuropeId, { femme: string[]; homme: string[] }> = {
  be: { femme: ['Marie', 'Laura', 'Emma', 'Lotte', 'Sarah', 'Julie', 'Inès', 'Fatou', 'Grace', 'Nadia', 'Charlotte', 'Elise'], homme: ['Thomas', 'Nicolas', 'Lucas', 'Pieter', 'Mehdi', 'Kevin', 'Jordan', 'Patrick', 'Christian', 'Arthur', 'Mamadou', 'Louis'] },
  gb: { femme: ['Olivia', 'Amelia', 'Chloe', 'Sophie', 'Grace', 'Chioma', 'Abena', 'Aisha', 'Jessica', 'Hannah', 'Ruby', 'Priya'], homme: ['Oliver', 'Harry', 'Jack', 'George', 'Tunde', 'Kwame', 'Daniel', 'James', 'Mohammed', 'Callum', 'Femi', 'Raj'] },
  de: { femme: ['Anna', 'Lena', 'Lea', 'Hannah', 'Sophie', 'Marie', 'Ayşe', 'Laura', 'Julia', 'Mia', 'Katrin', 'Elif'], homme: ['Lukas', 'Jonas', 'Felix', 'Leon', 'Maximilian', 'Paul', 'Tobias', 'Mehmet', 'Jan', 'Florian', 'Stefan', 'Moritz'] },
  it: { femme: ['Giulia', 'Sofia', 'Chiara', 'Francesca', 'Martina', 'Alessia', 'Giorgia', 'Valentina', 'Elena', 'Sara', 'Federica', 'Aurora'], homme: ['Marco', 'Luca', 'Matteo', 'Alessandro', 'Lorenzo', 'Andrea', 'Davide', 'Giuseppe', 'Francesco', 'Riccardo', 'Simone', 'Pietro'] },
  es: { femme: ['Lucía', 'María', 'Carmen', 'Paula', 'Laura', 'Marta', 'Sara', 'Elena', 'Aminata', 'Núria', 'Ana', 'Cristina'], homme: ['Javier', 'Pablo', 'Alejandro', 'Daniel', 'Sergio', 'Carlos', 'Jordi', 'Manuel', 'David', 'Moussa', 'Álvaro', 'Hugo'] },
  pt: { femme: ['Beatriz', 'Mariana', 'Inês', 'Ana', 'Sofia', 'Leonor', 'Catarina', 'Rita', 'Joana', 'Carla', 'Djamila', 'Margarida'], homme: ['João', 'Tiago', 'Rodrigo', 'Pedro', 'Miguel', 'Diogo', 'Duarte', 'Rui', 'Nuno', 'Edson', 'Gonçalo', 'André'] },
  ch: { femme: ['Léa', 'Chloé', 'Laura', 'Sarah', 'Camille', 'Noémie', 'Julie', 'Anouk', 'Mia', 'Lara', 'Céline', 'Valentina'], homme: ['Luca', 'Noah', 'Nathan', 'Julien', 'Mathieu', 'Samuel', 'Loïc', 'David', 'Yannick', 'Bastien', 'Gaël', 'Florian'] },
  nl: { femme: ['Emma', 'Julia', 'Sanne', 'Lotte', 'Fleur', 'Anouk', 'Sophie', 'Shanice', 'Naomi', 'Eva', 'Femke', 'Yara'], homme: ['Daan', 'Sem', 'Lars', 'Thijs', 'Bram', 'Jesse', 'Ruben', 'Kofi', 'Milan', 'Stijn', 'Jayden', 'Tim'] },
  ie: { femme: ['Aoife', 'Siobhán', 'Niamh', 'Ciara', 'Saoirse', 'Emma', 'Orla', 'Sinéad', 'Grace', 'Róisín', 'Chloe', 'Caoimhe'], homme: ['Seán', 'Conor', 'Patrick', 'Cian', 'Oisín', 'Liam', 'Darragh', 'Eoin', 'Ciarán', 'Jack', 'Fionn', 'Niall'] },
  at: { femme: ['Anna', 'Lena', 'Sophie', 'Katharina', 'Julia', 'Hannah', 'Lisa', 'Magdalena', 'Elena', 'Valentina', 'Theresa', 'Laura'], homme: ['Lukas', 'Florian', 'David', 'Tobias', 'Jakob', 'Maximilian', 'Elias', 'Sebastian', 'Matthias', 'Fabian', 'Stefan', 'Paul'] },
  pl: { femme: ['Anna', 'Zofia', 'Julia', 'Maja', 'Agnieszka', 'Katarzyna', 'Magdalena', 'Ola', 'Kasia', 'Natalia', 'Ewa', 'Marta'], homme: ['Jakub', 'Piotr', 'Krzysztof', 'Tomasz', 'Michał', 'Kamil', 'Paweł', 'Bartek', 'Mateusz', 'Łukasz', 'Marek', 'Adam'] },
  cz: { femme: ['Tereza', 'Eliška', 'Anna', 'Lucie', 'Kateřina', 'Petra', 'Veronika', 'Klára', 'Barbora', 'Jana', 'Adéla', 'Markéta'], homme: ['Jakub', 'Jan', 'Tomáš', 'Petr', 'Martin', 'Lukáš', 'Ondřej', 'Vojtěch', 'Filip', 'David', 'Pavel', 'Matěj'] },
  hu: { femme: ['Anna', 'Réka', 'Zsófia', 'Eszter', 'Katalin', 'Dóra', 'Lilla', 'Petra', 'Noémi', 'Fanni', 'Hanna', 'Boglárka'], homme: ['Bence', 'Máté', 'Levente', 'Ádám', 'Dávid', 'Gábor', 'Péter', 'Balázs', 'Zoltán', 'Tamás', 'Áron', 'Márk'] },
  gr: { femme: ['Maria', 'Eleni', 'Katerina', 'Sofia', 'Georgia', 'Dimitra', 'Ioanna', 'Anna', 'Despina', 'Christina', 'Vasiliki', 'Angeliki'], homme: ['Giorgos', 'Dimitris', 'Nikos', 'Kostas', 'Giannis', 'Panagiotis', 'Christos', 'Vasilis', 'Thanasis', 'Stelios', 'Alexandros', 'Michalis'] },
  se: { femme: ['Elsa', 'Alice', 'Maja', 'Ebba', 'Wilma', 'Astrid', 'Saga', 'Linnea', 'Ida', 'Sara', 'Hanna', 'Amira'], homme: ['Erik', 'Lars', 'Oskar', 'William', 'Hugo', 'Axel', 'Elias', 'Lucas', 'Filip', 'Johan', 'Anders', 'Nils'] },
  no: { femme: ['Nora', 'Ingrid', 'Emma', 'Sofie', 'Thea', 'Ida', 'Maja', 'Kari', 'Hanne', 'Sigrid', 'Live', 'Frida'], homme: ['Jakob', 'Emil', 'Henrik', 'Ola', 'Magnus', 'Sander', 'Lars', 'Kristian', 'Mathias', 'Even', 'Sindre', 'Aksel'] },
  dk: { femme: ['Freja', 'Ida', 'Emma', 'Clara', 'Mathilde', 'Sofie', 'Laura', 'Signe', 'Mette', 'Karen', 'Astrid', 'Line'], homme: ['Frederik', 'Mads', 'Rasmus', 'Mikkel', 'Emil', 'Magnus', 'Søren', 'Anders', 'Kasper', 'Jonas', 'Christian', 'Oliver'] },
  fi: { femme: ['Aino', 'Emma', 'Sofia', 'Helmi', 'Ella', 'Venla', 'Anni', 'Laura', 'Liisa', 'Sanna', 'Elina', 'Hanna'], homme: ['Mikko', 'Juha', 'Matti', 'Eino', 'Väinö', 'Onni', 'Leo', 'Ville', 'Antti', 'Jukka', 'Teemu', 'Lauri'] },
  ro: { femme: ['Andreea', 'Ioana', 'Maria', 'Elena', 'Alexandra', 'Cristina', 'Bianca', 'Diana', 'Raluca', 'Mihaela', 'Ana', 'Irina'], homme: ['Andrei', 'Alexandru', 'Mihai', 'Ionuț', 'Ștefan', 'Bogdan', 'Cristian', 'Florin', 'Vlad', 'Radu', 'Gabriel', 'Adrian'] },
  bg: { femme: ['Maria', 'Ivana', 'Elena', 'Desislava', 'Gergana', 'Nikol', 'Petya', 'Yana', 'Radina', 'Viktoria', 'Teodora', 'Silvia'], homme: ['Georgi', 'Ivan', 'Dimitar', 'Nikolay', 'Stoyan', 'Petar', 'Hristo', 'Todor', 'Martin', 'Aleksandar', 'Kaloyan', 'Boris'] },
  hr: { femme: ['Ana', 'Lucija', 'Petra', 'Ivana', 'Marija', 'Mia', 'Ema', 'Katarina', 'Nikolina', 'Maja', 'Lana', 'Tena'], homme: ['Luka', 'Ivan', 'Marko', 'Josip', 'Ante', 'Filip', 'Matej', 'Tomislav', 'Karlo', 'Petar', 'Domagoj', 'Mario'] },
  rs: { femme: ['Milica', 'Jovana', 'Ana', 'Marija', 'Teodora', 'Jelena', 'Ivana', 'Nevena', 'Katarina', 'Sara', 'Dragana', 'Tijana'], homme: ['Nikola', 'Stefan', 'Marko', 'Lazar', 'Luka', 'Miloš', 'Aleksa', 'Nemanja', 'Dušan', 'Vuk', 'Đorđe', 'Filip'] },
  ua: { femme: ['Olena', 'Iryna', 'Oksana', 'Natalia', 'Sofiia', 'Anastasiia', 'Kateryna', 'Yuliia', 'Daryna', 'Mariia', 'Tetiana', 'Viktoriia'], homme: ['Oleksandr', 'Andrii', 'Mykola', 'Dmytro', 'Taras', 'Bohdan', 'Serhii', 'Yurii', 'Ivan', 'Maksym', 'Volodymyr', 'Artem'] },
  ru: { femme: ['Anastasia', 'Maria', 'Ekaterina', 'Anna', 'Olga', 'Daria', 'Natalia', 'Elena', 'Polina', 'Svetlana', 'Ksenia', 'Irina'], homme: ['Alexeï', 'Dmitri', 'Ivan', 'Sergueï', 'Nikolaï', 'Andreï', 'Mikhaïl', 'Vladimir', 'Pavel', 'Artiom', 'Igor', 'Maxime'] },
  tr: { femme: ['Elif', 'Zeynep', 'Ayşe', 'Fatma', 'Merve', 'Esra', 'Defne', 'Ebru', 'Selin', 'Büşra', 'Emine', 'Naz'], homme: ['Mehmet', 'Mustafa', 'Ahmet', 'Emre', 'Can', 'Burak', 'Murat', 'Yusuf', 'Kerem', 'Ali', 'Hakan', 'Oğuz'] },
  is: { femme: ['Guðrún', 'Sigríður', 'Anna', 'Kristín', 'Helga', 'Katrín', 'Ásta', 'Embla', 'Hildur', 'Sara', 'Bryndís', 'Freyja'], homme: ['Jón', 'Sigurður', 'Gunnar', 'Ólafur', 'Einar', 'Kristján', 'Magnús', 'Björn', 'Stefán', 'Arnar', 'Aron', 'Hákon'] },
  lu: { femme: ['Emma', 'Lara', 'Léa', 'Mia', 'Sophie', 'Ana', 'Zoé', 'Lina', 'Chloé', 'Sara', 'Julie', 'Inês'], homme: ['Gabriel', 'Luca', 'Noah', 'Tom', 'Ben', 'Max', 'Liam', 'Pol', 'Tiago', 'Jeff', 'Yves', 'Marc'] },
  mc: { femme: ['Charlotte', 'Stéphanie', 'Caroline', 'Giulia', 'Léa', 'Alice', 'Camille', 'Sofia', 'Victoria', 'Inès', 'Clara', 'Elena'], homme: ['Louis', 'Pierre', 'Albert', 'Marco', 'Lorenzo', 'Hugo', 'Thomas', 'Antoine', 'Jules', 'Matteo', 'Enzo', 'Gabriel'] },
}
