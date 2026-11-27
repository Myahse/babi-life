import type { City, World } from './types'

// L'espace (backend game/espace.go, world/espace.go, sims/espace.go): the agency Astrélia, its four spaceports on
// Earth, the three places up there (the Station Akwaba, the Moon's Base Clair-de-Terre, Mars's Colonie Harmattan).
// The cities up there come apart from the Earth's (World.espace, never in World.cities): isSpaceCity, cityOf.
// The launches' timetable is worked out here as the server does (launchHash, nextLaunch): the same to the minute
// (LAUNCH_GOLDEN, checked by the backend's game/espace_test.go).
//
// Where the other workstreams plug in (each its own files, at most one import line elsewhere):
//   - world3d/espace/SpaceWorld.tsx (D): the scene drawn instead of the street up there (Play.tsx imports it lazily).
//   - world3d/espace/LaunchView.tsx (C): the trip by rocket (trip.mode 'fusee'), the launch and the way back.
//   - world3d/espace/EspaceInside.tsx (D): a place's inside up there (a kind starting with 'espace-').
//   - components/espace/LaunchCTA.tsx (C): the boarding and the way back, in the place's sheet.
//   - world3d/open/launchSky.tsx (C): the plumes in the sky (open/skyLife.tsx draws it).
//   - screens/SolarMap.tsx (D): the solar system's map (WorldMap's button).

/** The four updates (backend features.go). */
export const ESPACE_KEY = 'espace'
export const ESPACE_STATION_KEY = 'espace-station'
export const ESPACE_LUNE_KEY = 'espace-lune'
export const ESPACE_MARS_KEY = 'espace-mars'
export const ESPACE_KEYS = [ESPACE_KEY, ESPACE_STATION_KEY, ESPACE_LUNE_KEY, ESPACE_MARS_KEY]

/** The trip's mode (backend game.RocketApp), and a float from one module to another. */
export const ROCKET = 'fusee'
export const FLOAT = 'flotte'
/** The pad's kind on Earth; the kinds up there all start with 'espace-'. */
export const SPATIOPORT_KIND = 'spatioport'
export const isSpaceKind = (kind?: string) => !!kind && kind.startsWith('espace-')

/** Every action the four updates bring (backend game.EspaceActs): may be hidden while the server hasn't answered. */
export const ESPACE_ACTS = ['espace-billet-annuler', 'espace-pas-de-tir-regarder', 'espace-billet-station', 'station-coupole', 'station-sachet', 'station-sac', 'station-eponge', 'station-appel', 'station-tapis', 'sas-combinaison', 'espace-billet-lune', 'croisiere-dormir', 'croisiere-repas', 'croisiere-maintenance', 'lune-marcher', 'lune-lever-terre', 'lune-sachet', 'lune-sac', 'lune-eponge', 'espace-billet-mars', 'croisiere-sport', 'croisiere-appel', 'mars-marcher', 'mars-serre', 'mars-sachet', 'mars-sac', 'mars-eponge', 'mars-message',
  // La vie là-haut (workstream D, backend game/espaceActs.go).
  'station-kedjenou', 'station-saltos', 'station-photo', 'station-abidjan', 'labo-plantes', 'labo-cristaux', 'labo-attieke', 'station-sortie', 'lune-photo', 'lune-serre', 'lune-margouillat', 'lune-regolithe', 'mars-photo', 'mars-labo-roches', 'mars-rover']

/** The careers and the training (backend game/espaceCarriere.go): Astrélia's six jobs, the centre's kinds and actions. */
export const ESPACE_CAREERS = ['astronaute', 'ingenieur-lancement', 'controle-mission', 'tourisme-spatial', 'pas-de-tir', 'guide-spatial']
export const ENTRAINEMENT_KIND = 'astrelia-entrainement'
export const SIEGE_KIND = 'astrelia-siege'
export const FORMATION_ACTS = ['astrelia-concours-ecrit', 'selection-physique', 'selection-centrifugeuse', 'selection-piscine', 'selection-survie', 'selection-medicale', 'module-systemes', 'module-centrifugeuse', 'module-piscine', 'module-parabolique', 'module-survie', 'module-physique', 'touriste-centrifugeuse', 'touriste-survie', 'entrainement-cantine', 'entrainement-douche', 'entrainement-chambre', 'siege-salle-controle']
ESPACE_ACTS.push(...FORMATION_ACTS)
// The Earth's space activities (backend game/espaceTerreActs.go): the visitor centre, the beach, the Albatros 0G…
export const ESPACE_TERRE_ACTS = ['espace-visiteurs', 'espace-centrifugeuse', 'espace-plage-lancement', 'espace-steppe-lancement', 'espace-albatros', 'espace-saut-suborbital']
ESPACE_ACTS.push(...ESPACE_TERRE_ACTS)

/** The game's names (all invented). */
export const AGENCY = 'Astrélia'
export const ROCKET_NAME = 'Calao-1'
export const CAPSULE = 'Pirogue'

export type Spaceport = { id: string; name: string; commune: string; pad: string; splash: string; landing: 'mer' | 'steppe'; key?: string }
export type Destination = { id: 'station' | 'lune' | 'mars'; name: string; city: string; commune: string; cruise?: string; rounds: number; steps?: string[]; price: number; key: string; rocket: string; ship: string; ticket: string }
/** backend game.LaunchRules. */
export type LaunchRules = {
  agency: string
  every: number
  cargoEvery: number
  scrubOneIn: number
  boardWindow: number
  preflight: number
  launchLeg: number
  returnLeg: number
  landingLeg: number
  spaceports: Spaceport[]
  destinations: Destination[]
  refund: number
  minAge: number
  minEnergy: number
  stationNights: number
  stationNight: number
  suborbital: number
}
/** backend sims.Espace (the Sim's life.espace). */
export type SpaceLife = {
  ticket?: { dest: string; paid: number; bought: number }
  voyage?: { dest: string; from: string; round: number; rounds: number; steps?: string[]; done: string[]; launched: number; arrived?: number; paid?: number; mission?: boolean }
  training?: boolean
  visited?: string[]
  missions?: number
  launchNow?: boolean
  /** The training centre's record (backend sims/espaceFormation.go, components/espace/Formation.tsx). */
  formation?: SpaceFormation
}
/** backend sims.Formation. */
export type SpaceFormation = {
  ecrit?: number
  drills?: Record<string, number>
  selected?: boolean
  stay?: { module: number; modules: number; done: string[]; since: number }
  brevet?: boolean
  brevetOn?: number
  tourist?: string[]
  mission?: { dest: string; launched: number; shifts: number; need: number; done?: boolean }
  missionsDone?: number
}
export type Launch = { spaceport: string; at: number; crewed: boolean; scrub?: boolean }

/** The rules as the server had them when this was written (an older server sends none). */
export const LAUNCH_DEFAULTS: LaunchRules = {
  agency: AGENCY, every: 180, cargoEvery: 90, scrubOneIn: 10, boardWindow: 20, preflight: 5, launchLeg: 8, returnLeg: 8, landingLeg: 4,
  spaceports: [
    { id: 'sassandra', name: 'Spatioport Astrélia de Sassandra', commune: 'sassandra-spatioport', pad: 'sassandra-pas-de-tir', splash: 'sassandra-centre', landing: 'mer' },
    { id: 'kourou', name: 'Ensemble de lancement Calao de Kourou', commune: 'kourou-spatioport', pad: 'kourou-pas-de-tir', splash: 'kourou-centre', landing: 'mer', key: 'pays-ameriques' },
    { id: 'cap-canaveral', name: 'Pas de tir Calao de Canaveral', commune: 'canaveral-merritt', pad: 'canaveral-pas-de-tir', splash: 'canaveral-cocoa', landing: 'mer', key: 'pays-usa' },
    { id: 'baikonour', name: 'Pas de tir Calao de Baïkonour', commune: 'baikonour-steppe', pad: 'baikonour-pas-de-tir', splash: 'baikonour-centre', landing: 'steppe', key: 'pays-asie' },
  ],
  destinations: [
    { id: 'station', name: 'Station Akwaba', city: 'station-akwaba', commune: 'akwaba-noeud', rounds: 0, price: 12_000_000, key: ESPACE_STATION_KEY, rocket: 'Calao-1', ship: 'Pirogue', ticket: 'espace-billet-station' },
    { id: 'lune', name: 'Base Clair-de-Terre', city: 'lune', commune: 'lune-base', cruise: 'lune-pirogue', rounds: 1, price: 45_000_000, key: ESPACE_LUNE_KEY, rocket: 'Calao-1', ship: 'Pirogue', ticket: 'espace-billet-lune' },
    { id: 'mars', name: 'Colonie Harmattan', city: 'mars', commune: 'mars-colonie', cruise: 'mars-pirogue', rounds: 3, price: 150_000_000, key: ESPACE_MARS_KEY, rocket: 'Calao Lourd', ship: 'Grande Pirogue', ticket: 'espace-billet-mars' },
  ],
  refund: 80, minAge: 18, minEnergy: 30, stationNights: 3, stationNight: 400_000, suborbital: 1_500_000,
}
export const launchRules = (world?: Pick<World, 'launchRules'>): LaunchRules => world?.launchRules ?? LAUNCH_DEFAULTS

const SPACE_CITIES = new Set(LAUNCH_DEFAULTS.destinations.map((d) => d.city))
/** A city up there (not on the Earth's map). */
export const isSpaceCity = (id?: string) => !!id && SPACE_CITIES.has(id)
/** A city by id, the Earth's or up there. */
export const cityOf = (world: Pick<World, 'cities' | 'espace'>, id: string): City | undefined => world.cities.find((c) => c.id === id) ?? world.espace?.find((c) => c.id === id)
/** The destination a space city is. */
export const destinationOf = (world: Pick<World, 'launchRules'> | undefined, city: string) => launchRules(world).destinations.find((d) => d.city === city)
/** The spaceport whose pad is in this commune. */
export const spaceportAt = (world: Pick<World, 'launchRules'> | undefined, city: string, commune: string) => launchRules(world).spaceports.find((s) => s.id === city && s.commune === commune)
export const spaceportOf = (world: Pick<World, 'launchRules'> | undefined, id: string) => launchRules(world).spaceports.find((s) => s.id === id)

/* ---------- The timetable (backend game/espace.go) ---------- */

/** FNV-1a over the string's UTF-8 bytes (backend launchHash). */
export function launchHash(s: string): number {
  let h = 0x811c9dc5
  for (const b of new TextEncoder().encode(s)) {
    h ^= b
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
export const launchOffset = (spaceport: string, crewed: boolean, r: LaunchRules = LAUNCH_DEFAULTS) => (crewed ? launchHash(spaceport) % r.every : launchHash(`${spaceport}:cargo`) % r.cargoEvery)
export const scrubbed = (spaceport: string, crewed: boolean, n: number, r: LaunchRules = LAUNCH_DEFAULTS) => launchHash(`${spaceport}:${crewed ? 'h' : 'c'}:${n}`) % r.scrubOneIn === 0
export function launchAt(spaceport: string, crewed: boolean, n: number, r: LaunchRules = LAUNCH_DEFAULTS): Launch {
  return { spaceport, at: n * (crewed ? r.every : r.cargoEvery) + launchOffset(spaceport, crewed, r), crewed, scrub: scrubbed(spaceport, crewed, n, r) }
}
const launchIndex = (spaceport: string, crewed: boolean, from: number, r: LaunchRules) => Math.ceil((from - launchOffset(spaceport, crewed, r)) / (crewed ? r.every : r.cargoEvery))
/** The launches (crewed and cargo, the scrubbed too) from a spaceport in [from, to), in order. */
export function launchTimetable(spaceport: string, from: number, to: number, r: LaunchRules = LAUNCH_DEFAULTS): Launch[] {
  const out: Launch[] = []
  for (const crewed of [true, false]) {
    for (let n = launchIndex(spaceport, crewed, from, r); ; n++) {
      const l = launchAt(spaceport, crewed, n, r)
      if (l.at >= to) break
      if (l.at >= from) out.push(l)
    }
  }
  return out.sort((a, b) => a.at - b.at)
}
/** The next crewed launch not « reporté » at or after now (game minute). */
export function nextLaunch(spaceport: string, now: number, r: LaunchRules = LAUNCH_DEFAULTS): Launch {
  for (let n = launchIndex(spaceport, true, now, r); ; n++) {
    const l = launchAt(spaceport, true, n, r)
    if (!l.scrub && l.at >= now) return l
  }
}
/** Every launch in the sky now, from every spaceport ([from, to)): for the plumes (open/launchSky.tsx). */
export const launchesBetween = (from: number, to: number, r: LaunchRules = LAUNCH_DEFAULTS) => r.spaceports.flatMap((s) => launchTimetable(s.id, from, to, r))

// The golden case (backend game/espace_test.go reads it from here): keep it one JSON line.
export const LAUNCH_GOLDEN = {"at": 1528560, "offsets": {"sassandra": 101, "kourou": 0, "cap-canaveral": 61, "baikonour": 177}, "cargoOffsets": {"sassandra": 65, "kourou": 20, "cap-canaveral": 73, "baikonour": 51}, "next": {"sassandra": 1528661, "kourou": 1528560, "cap-canaveral": 1528801, "baikonour": 1528737}, "hash": 1115043221, "scrubbed": [5]}
