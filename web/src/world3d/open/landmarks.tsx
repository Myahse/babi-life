import { Suspense, lazy, useMemo } from 'react'
import * as THREE from 'three'
import { RuePrincesse, rueSlot } from './ruePrincesse'
import { StadiumLive } from './stadiumLive'
import { TOUR_F_FACING, TourF, TourFFar } from './tourF'
import type { StadiumEvent } from '../../lib/stadium'
import type { Obstacle } from '../obstacles'
import { STADIUM_TRACKS } from './stadiumTrack'
import { CARREFOUR_CLEAR, CARREFOUR_FRONT, CARREFOUR_IDS } from './quartiers'

// The landmarks' models, each loaded the first time it's near (not with the game: they weigh), drawn
// once loaded (nothing in their place the moment before). La Tour F and the rue Princesse stay with the
// game: the skyline and the street's slots need them from afar.
const Airport = lazy(() => import('./airport').then((m) => ({ default: m.Airport })))
const GareAdjame = lazy(() => import('./yopougon').then((m) => ({ default: m.GareAdjame })))
const GareBouake = lazy(() => import('./yopougon').then((m) => ({ default: m.GareBouake })))
const GareSiporex = lazy(() => import('./yopougon').then((m) => ({ default: m.GareSiporex })))
const PlaceFicgayo = lazy(() => import('./yopougon').then((m) => ({ default: m.PlaceFicgayo })))
const PalaisDesSports = lazy(() => import('./treichville').then((m) => ({ default: m.PalaisDesSports })))
const MarcheAbobo = lazy(() => import('./adjame').then((m) => ({ default: m.MarcheAbobo })))
const MarcheAdjame = lazy(() => import('./adjame').then((m) => ({ default: m.MarcheAdjame })))
const MarcheKoumassi = lazy(() => import('./adjame').then((m) => ({ default: m.MarcheKoumassi })))
const HotelIvoire = lazy(() => import('./hotelIvoire').then((m) => ({ default: m.HotelIvoire })))
const HotelPoulman = lazy(() => import('./poulman').then((m) => ({ default: m.HotelPoulman })))
const HotelNoum = lazy(() => import('./noum').then((m) => ({ default: m.HotelNoum })))
const HotelAzale = lazy(() => import('./azale').then((m) => ({ default: m.HotelAzale })))
const CapSud = lazy(() => import('./capsud').then((m) => ({ default: m.CapSud })))
const HotelRabisson = lazy(() => import('./rabisson').then((m) => ({ default: m.HotelRabisson })))
const Zoo = lazy(() => import('./zoo').then((m) => ({ default: m.Zoo })))
const BlockhaussMaquis = lazy(() => import('./blockhauss').then((m) => ({ default: m.BlockhaussMaquis })))
const BaieCocody = lazy(() => import('./baie').then((m) => ({ default: m.BaieCocody })))
const PlagePortBouet = lazy(() => import('./plage').then((m) => ({ default: m.PlagePortBouet })))
const ForetBanco = lazy(() => import('./banco').then((m) => ({ default: m.ForetBanco })))
const CarrefourVie = lazy(() => import('./carrefourVie').then((m) => ({ default: m.CarrefourVie })))
const Cathedral = lazy(() => import('./cathedral').then((m) => ({ default: m.Cathedral })))
const MosqueM6 = lazy(() => import('./mosqueM6').then((m) => ({ default: m.MosqueM6 })))
const ParcExpo = lazy(() => import('./parcExpo').then((m) => ({ default: m.ParcExpo })))
const Playce = lazy(() => import('./playce').then((m) => ({ default: m.Playce })))
const PlayceMarcory = lazy(() => import('./playceMarcory').then((m) => ({ default: m.PlayceMarcory })))
const PalaisJustice = lazy(() => import('./palaisJustice').then((m) => ({ default: m.PalaisJustice })))
const Presidence = lazy(() => import('./presidence').then((m) => ({ default: m.Presidence })))
const PalaisCulture = lazy(() => import('./palaisCulture').then((m) => ({ default: m.PalaisCulture })))
const Musee = lazy(() => import('./musee').then((m) => ({ default: m.Musee })))
const TourIvoire = lazy(() => import('./tourIvoire').then((m) => ({ default: m.TourIvoire })))
const Assemblee = lazy(() => import('./assemblee').then((m) => ({ default: m.Assemblee })))
const GrandMarche = lazy(() => import('./grandMarche').then((m) => ({ default: m.GrandMarche })))
const Rti = lazy(() => import('./rti').then((m) => ({ default: m.Rti })))
const Iugb = lazy(() => import('./iugb').then((m) => ({ default: m.Iugb })))
const JardinBingerville = lazy(() => import('./jardinBingerville').then((m) => ({ default: m.JardinBingerville })))
// Yamoussoukro and Bouaké (the updates « yakro-vivant », « bouake-vivant »; the basilica's own model ships to all).
const Basilica = lazy(() => import('./basilique').then((m) => ({ default: m.Basilica })))
const LacCaimans = lazy(() => import('./lacCaimans').then((m) => ({ default: m.LacCaimans })))
const NziReserve = lazy(() => import('./nziReserve').then((m) => ({ default: m.NziReserve })))
const JardinPaons = lazy(() => import('./jardinPaons').then((m) => ({ default: m.JardinPaons })))
// The towns' places that stood as the map's plain buildings: one module per town (yakroVille.tsx…).
const MosqueeYakro = lazy(() => import('./yakroVille').then((m) => ({ default: m.MosqueeYakro })))
const Fondation = lazy(() => import('./yakroVille').then((m) => ({ default: m.Fondation })))
const HotelResident = lazy(() => import('./yakroVille').then((m) => ({ default: m.HotelResident })))
const GolfResident = lazy(() => import('./yakroVille').then((m) => ({ default: m.GolfResident })))
const MaquisGrandBraise = lazy(() => import('./yakroVille').then((m) => ({ default: m.MaquisGrandBraise })))
const CaimanClub = lazy(() => import('./yakroVille').then((m) => ({ default: m.CaimanClub })))
const TotemClub = lazy(() => import('./yakroVille').then((m) => ({ default: m.TotemClub })))
const Allocodrome = lazy(() => import('./bouakeVille').then((m) => ({ default: m.Allocodrome })))
const MarcheBouake = lazy(() => import('./bouakeVille').then((m) => ({ default: m.MarcheBouake })))
const MaquisAirFrance = lazy(() => import('./bouakeVille').then((m) => ({ default: m.MaquisAirFrance })))
const GbekeNight = lazy(() => import('./bouakeVille').then((m) => ({ default: m.GbekeNight })))
// San-Pédro and Korhogo (the updates « sanpedro-vivant », « korhogo-vivant »): one module each.
const PortSanPedro = lazy(() => import('./sanPedro').then((m) => ({ default: m.PortSanPedro })))
const PortPeche = lazy(() => import('./sanPedro').then((m) => ({ default: m.PortPeche })))
const PlageSud = lazy(() => import('./sanPedro').then((m) => ({ default: m.PlageSud })))
const TaiAgence = lazy(() => import('./sanPedro').then((m) => ({ default: m.TaiAgence })))
const CathedraleSP = lazy(() => import('./sanPedro').then((m) => ({ default: m.CathedraleSP })))
const Bardot = lazy(() => import('./sanPedro').then((m) => ({ default: m.Bardot })))
const MaquisMerou = lazy(() => import('./sanPedro').then((m) => ({ default: m.MaquisMerou })))
const CargoClub = lazy(() => import('./sanPedro').then((m) => ({ default: m.CargoClub })))
const Waraniene = lazy(() => import('./korhogo').then((m) => ({ default: m.Waraniene })))
const Fakaha = lazy(() => import('./korhogo').then((m) => ({ default: m.Fakaha })))
const Koni = lazy(() => import('./korhogo').then((m) => ({ default: m.Koni })))
const BoisSacre = lazy(() => import('./korhogo').then((m) => ({ default: m.BoisSacre })))
const MontKorhogo = lazy(() => import('./korhogo').then((m) => ({ default: m.MontKorhogo })))
const MosqueeKorhogo = lazy(() => import('./korhogo').then((m) => ({ default: m.MosqueeKorhogo })))
const MarcheKorhogo = lazy(() => import('./korhogo').then((m) => ({ default: m.MarcheKorhogo })))
const MaquisMamaSita = lazy(() => import('./korhogo').then((m) => ({ default: m.MaquisMamaSita })))
const BalafonClub = lazy(() => import('./korhogo').then((m) => ({ default: m.BalafonClub })))
// Man and Daloa (the updates « man-vivant », « daloa-vivant »): one module each.
const DentDeMan = lazy(() => import('./man').then((m) => ({ default: m.DentDeMan })))
const MontTonkpi = lazy(() => import('./man').then((m) => ({ default: m.MontTonkpi })))
const CascadeMan = lazy(() => import('./man').then((m) => ({ default: m.CascadeMan })))
const ForetGbepleu = lazy(() => import('./man').then((m) => ({ default: m.ForetGbepleu })))
const CourMasques = lazy(() => import('./man').then((m) => ({ default: m.CourMasques })))
const PlantationCafe = lazy(() => import('./man').then((m) => ({ default: m.PlantationCafe })))
const LianesAgence = lazy(() => import('./man').then((m) => ({ default: m.LianesAgence })))
const MaquisPiedDent = lazy(() => import('./man').then((m) => ({ default: m.MaquisPiedDent })))
const SommetClub = lazy(() => import('./man').then((m) => ({ default: m.SommetClub })))
const HotelBrume = lazy(() => import('./man').then((m) => ({ default: m.HotelBrume })))
const MarcheDaloa = lazy(() => import('./daloa').then((m) => ({ default: m.MarcheDaloa })))
const PlantationCacao = lazy(() => import('./daloa').then((m) => ({ default: m.PlantationCacao })))
const BordLobo = lazy(() => import('./daloa').then((m) => ({ default: m.BordLobo })))
const CourBete = lazy(() => import('./daloa').then((m) => ({ default: m.CourBete })))
const CathedraleDaloa = lazy(() => import('./daloa').then((m) => ({ default: m.CathedraleDaloa })))
const MosqueeDaloa = lazy(() => import('./daloa').then((m) => ({ default: m.MosqueeDaloa })))
const MaquisCabosse = lazy(() => import('./daloa').then((m) => ({ default: m.MaquisCabosse })))
const ZigliClub = lazy(() => import('./daloa').then((m) => ({ default: m.ZigliClub })))
const HotelAntilope = lazy(() => import('./daloa').then((m) => ({ default: m.HotelAntilope })))
const RondPointDaloa = lazy(() => import('./daloa').then((m) => ({ default: m.RondPointDaloa })))
const ZoneCacao = lazy(() => import('./daloa').then((m) => ({ default: m.ZoneCacao })))
const PlacePaix = lazy(() => import('./man').then((m) => ({ default: m.PlacePaix })))
// The carrefours everybody knows (the update « communes-detail », quartiers.ts): one model, its sign by id.
const Carrefour = lazy(() => import('./carrefours').then((m) => ({ default: m.Carrefour })))

// Landmarks the map alone can't draw: their shape is what people know them
// by. Built from published descriptions; sizes are estimates for the game.

/** The game places drawn as landmarks, and the ground they need cleared (metres). */
export const LANDMARKS: Record<string, number> = {
  'plateau-cathedrale': 62,
  'treich-mosquee-m6': 62,
  'plateau-pyramide': 34,
  'plateau-stade': 105,
  'cocody-hotel-ivoire': 75,
  'plateau-poulman': 42,
  'plateau-noum': 42,
  'marcory-azale': 40,
  'marcory-capsud': 52,
  'pb-rabisson': 56,
  'yakro-basilique': 130,
  'pb-aeroport': 150,
  'cocody-oranjo': 42,
  'cocody-playce': 62,
  'marcory-playce': 60,
  'yop-rue-princesse': 32,
  'yop-gare-siporex': 36,
  'adjame-gare': 36,
  'bouake-gare': 36,
  'yop-ficgayo': 46,
  'treich-palais': 45,
  'adjame-forum': 52,
  'abobo-marche': 52,
  'koumassi-marche': 52,
  'cocody-zoo': 86,
  'cocody-blockhauss-maquis': 27,
  'cocody-baie': 46,
  'pb-plage': 45,
  'attecoube-banco': 34,
  'cocody-carrefour-vie': 27,
  'portbouet-parc-expo': 60,
  'plateau-tour-f': 40,
  'plateau-tribunal': 44,
  'plateau-presidence': 50,
  'treich-palais-culture': 66,
  'plateau-musee': 44,
  'plateau-assemblee': 68,
  'treich-marche': 78,
  'koumassi-tour-ivoire': 46,
  'cocody-rti': 64,
  'bassam-iugb': 42,
  'bingerville-jardin': 64,
  'yakro-lac': 48,
  'nzi-reserve': 150,
  'bouake-hotel-paons': 40,
  'sp-port': 90,
  'sp-peche': 70,
  'sp-monogaga': 80,
  'bereby-sirenes': 80,
  'sp-tai-excursions': 14,
  'korhogo-waraniene': 40,
  'korhogo-fakaha': 36,
  'korhogo-koni': 36,
  'korhogo-bois-sacre': 34,
  'korhogo-mont': 44,
  'yakro-mosquee': 34,
  'yakro-fondation': 100,
  'yakro-hotel': 32,
  'yakro-golf': 60,
  'yakro-maquis-braise': 16,
  'yakro-club-caiman': 16,
  'yakro-club-totem': 16,
  'bouake-allocodrome': 25,
  'bouake-marche': 46,
  'bouake-maquis-airfrance': 16,
  'bouake-club': 16,
  'sp-cathedrale': 32,
  'sp-bardot': 30,
  'sp-maquis-merou': 18,
  'sp-club-cargo': 16,
  'korhogo-mosquee': 46,
  'korhogo-marche': 44,
  'korhogo-maquis-to': 16,
  'korhogo-club-balafon': 16,
  'man-dent': 60,
  'man-tonkpi': 50,
  'man-cascade': 30,
  'man-gbepleu': 34,
  'man-masques': 20,
  'man-plantation': 30,
  'man-lianes-excursions': 14,
  'man-maquis-dent': 16,
  'man-club-sommet': 16,
  'man-hotel-brume': 26,
  'daloa-marche': 42,
  'daloa-plantation': 32,
  'daloa-lobo': 50,
  'daloa-cour-bete': 18,
  'daloa-cathedrale': 24,
  'daloa-mosquee': 22,
  'daloa-maquis-cabosse': 16,
  'daloa-club-zigli': 16,
  'daloa-hotel-antilope': 26,
  'daloa-rond-point': 16,
  'daloa-zone-cacao': 32,
  'man-place-paix': 14,
  ...Object.fromEntries(CARREFOUR_IDS.map((id) => [id, CARREFOUR_CLEAR])),
}

/** The landmarks an update brings (lib/features.ts keys): drawn only once it's open (else the place stands as before). */
export const LANDMARK_KEY: Record<string, string> = { 'yakro-lac': 'yakro-vivant', 'yakro-mosquee': 'yakro-vivant', 'yakro-fondation': 'yakro-vivant', 'yakro-hotel': 'yakro-vivant', 'yakro-golf': 'yakro-vivant', 'yakro-maquis-braise': 'yakro-vivant', 'yakro-club-caiman': 'yakro-vivant', 'yakro-club-totem': 'yakro-vivant', 'nzi-reserve': 'bouake-vivant', 'bouake-hotel-paons': 'bouake-vivant', 'bouake-allocodrome': 'bouake-vivant', 'bouake-marche': 'bouake-vivant', 'bouake-maquis-airfrance': 'bouake-vivant', 'bouake-club': 'bouake-vivant', 'sp-port': 'sanpedro-vivant', 'sp-peche': 'sanpedro-vivant', 'sp-monogaga': 'sanpedro-vivant', 'bereby-sirenes': 'sanpedro-vivant', 'sp-tai-excursions': 'sanpedro-vivant', 'sp-cathedrale': 'sanpedro-vivant', 'sp-bardot': 'sanpedro-vivant', 'sp-maquis-merou': 'sanpedro-vivant', 'sp-club-cargo': 'sanpedro-vivant', 'korhogo-waraniene': 'korhogo-vivant', 'korhogo-fakaha': 'korhogo-vivant', 'korhogo-koni': 'korhogo-vivant', 'korhogo-bois-sacre': 'korhogo-vivant', 'korhogo-mont': 'korhogo-vivant', 'korhogo-mosquee': 'korhogo-vivant', 'korhogo-marche': 'korhogo-vivant', 'korhogo-maquis-to': 'korhogo-vivant', 'korhogo-club-balafon': 'korhogo-vivant', ...Object.fromEntries(['man-dent', 'man-tonkpi', 'man-cascade', 'man-gbepleu', 'man-masques', 'man-plantation', 'man-lianes-excursions', 'man-maquis-dent', 'man-club-sommet', 'man-hotel-brume', 'man-place-paix'].map((id) => [id, 'man-vivant'])), ...Object.fromEntries(['daloa-marche', 'daloa-plantation', 'daloa-lobo', 'daloa-cour-bete', 'daloa-cathedrale', 'daloa-mosquee', 'daloa-maquis-cabosse', 'daloa-club-zigli', 'daloa-hotel-antilope', 'daloa-rond-point', 'daloa-zone-cacao'].map((id) => [id, 'daloa-vivant'])) }

/** How far a landmark's front is from its middle (metres): its ground starts at the roadside, the gare's yard at the street, not behind the houses along it. Else the middle stands its clearing back from the street. */
export const LANDMARK_FRONT: Record<string, number> = {
  'yop-gare-siporex': 19,
  'adjame-gare': 19,
  'bouake-gare': 19,
  // Their forecourts, gardens and pavements reach the street. (The Palais de la culture has none: pulled 12 m
  // back by its 49, its hall stood on the service lanes behind it; the musée's 25 put its lawn's edge on its lane.)
  'plateau-musee': 29,
  'plateau-assemblee': 56,
  'treich-marche': 54,
  'koumassi-tour-ivoire': 23,
  // Its paving and its kerb reach the crossroads' road.
  'cocody-carrefour-vie': 18,
  // Its car park reaches the route de Bonoua.
  'bassam-iugb': 20,
  // Its wall and its gate on the street.
  'bingerville-jardin': 8,
  // The reserve's gate at the road; the hotel's front on the street.
  'nzi-reserve': 62,
  'bouake-hotel-paons': 27,
  // A carrefour's corner: its paving from the kerb.
  ...Object.fromEntries(CARREFOUR_IDS.map((id) => [id, CARREFOUR_FRONT])),
}

/** The landmarks' own grounds in their frame (x from, x to, z from, z to; +z the street): no ad board stands on them (the PlaYce's car park). */
export const LANDMARK_GROUND: Record<string, [number, number, number, number]> = {
  'cocody-playce': [-51, 51, -34, 37],
  'marcory-playce': [-49, 49, -36, 35],
  'marcory-capsud': [-45, 45, -38, 35],
  // The towns' places (yakroVille.tsx…): no giant board in a mosque's courtyard or on a maquis' terrace.
  'yakro-mosquee': [-25, 25, -21, 29],
  'yakro-fondation': [-80, 80, -95, 85],
  'yakro-hotel': [-38, 24, -20, 28],
  'yakro-golf': [-58, 58, -66, 32],
  'bouake-allocodrome': [-17, 17, -14, 15],
  'bouake-marche': [-38, 38, -36, 36],
  'sp-cathedrale': [-24, 24, -21, 28],
  'sp-bardot': [-9, 9, -30, 24],
  'korhogo-mosquee': [-38, 38, -25, 25],
  'korhogo-marche': [-34, 34, -32, 32],
  ...Object.fromEntries(['yakro-maquis-braise', 'bouake-maquis-airfrance', 'sp-maquis-merou', 'korhogo-maquis-to', 'man-maquis-dent', 'daloa-maquis-cabosse'].map((id) => [id, [-8, 8, -7, 8] as [number, number, number, number]])),
  ...Object.fromEntries(['yakro-club-caiman', 'yakro-club-totem', 'bouake-club', 'sp-club-cargo', 'korhogo-club-balafon', 'man-club-sommet', 'daloa-club-zigli'].map((id) => [id, [-9, 9, -9, 13] as [number, number, number, number]])),
  // Man's and Daloa's (man.tsx, daloa.tsx).
  'man-masques': [-15, 15, -13, 13],
  'man-hotel-brume': [-16, 23, -11, 11],
  'daloa-hotel-antilope': [-16, 23, -11, 11],
  'daloa-marche': [-34, 34, -30, 30],
  'daloa-cour-bete': [-16, 16, -14, 10],
  'daloa-cathedrale': [-10, 12, -20, 17],
  'daloa-mosquee': [-11, 13, -14, 11],
}

/** Grounds where the game builds none of its own houses (the map's buildings stay): a fairground, metres round the place. */
export const NO_FILL: Record<string, number> = {
  'portbouet-parc-expo': 290,
  // The savanna of the N'Zi: no village of the game's own in it.
  'nzi-reserve': 220,
  // The port's quays, the craft villages and the rock: no house of the game's own on them.
  'sp-port': 100,
  'korhogo-waraniene': 45,
  // Koni and Fakaha are villages 20 km out, on the main roads (the Niellé road through Koni): the game's town
  // fill (two to four storeys and shops along a trunk road) made them look like the town's centre. Only the
  // map's own houses round them.
  'korhogo-fakaha': 320,
  'korhogo-koni': 320,
  // The beaches out of town, the same: Monogaga's village, the bay of Grand-Béréby.
  'sp-monogaga': 150,
  'bereby-sirenes': 150,
  'korhogo-mont': 50,
  'korhogo-bois-sacre': 40,
  // The golf course: no house of the game's own on its grass.
  'yakro-golf': 90,
  // Man's mountains, its waterfall and its forests; Daloa's plantation and the Lobo, out of town.
  'man-dent': 300,
  'man-tonkpi': 300,
  'man-cascade': 60,
  'man-gbepleu': 45,
  'man-plantation': 120,
  'daloa-plantation': 200,
  'daloa-lobo': 300,
}

/**
 * Villages out of town: the map's houses round them are one storey under tin (a building of the map with no
 * height is guessed one to three storeys, as in town: Koni's huts stood as the town's blocks of flats).
 * Metres round the place.
 */
export const VILLAGE: Record<string, number> = { 'korhogo-koni': 320, 'korhogo-fakaha': 320, 'sp-monogaga': 220, 'bereby-sirenes': 220, 'nzi-reserve': 260, 'man-dent': 300, 'man-tonkpi': 300, 'man-plantation': 160, 'daloa-plantation': 220, 'daloa-lobo': 300 }

/** Where a place inside a landmark is (its door on the landmark's ground, which way it faces), in the landmark's frame. */
export function slotIn(parent: string, slot: number): { door: [number, number]; rot: number } | null {
  if (parent === 'nzi-reserve') return { door: NZI_LODGE_DOOR, rot: 0 }
  return parent === 'yop-rue-princesse' ? rueSlot(slot) : null
}
/** The Lodge des Rives de la N'Zi's door in the reserve's frame (nziReserve.tsx LODGE_DOOR, kept here: the model loads late). */
const NZI_LODGE_DOOR: [number, number] = [-62, -10]

/** The landmarks one walks round freely on arriving (the park, the hotel's grounds, the street, the forecourts), before picking what to do. */
export const GROUNDS = new Set(['man-place-paix', 'daloa-rond-point', 'daloa-zone-cacao', 'man-dent', 'man-tonkpi', 'man-cascade', 'man-gbepleu', 'man-masques', 'man-plantation', 'daloa-plantation', 'daloa-lobo', 'daloa-cour-bete', 'sp-port', 'sp-peche', 'sp-monogaga', 'bereby-sirenes', 'korhogo-waraniene', 'korhogo-fakaha', 'korhogo-koni', 'korhogo-bois-sacre', 'korhogo-mont', 'yakro-lac', 'nzi-reserve', 'bouake-hotel-paons', 'cocody-zoo', 'cocody-hotel-ivoire', 'yop-rue-princesse', 'adjame-forum', 'abobo-marche', 'koumassi-marche', 'yop-ficgayo', 'yop-gare-siporex', 'bouake-gare', 'adjame-gare', 'cocody-blockhauss-maquis', 'cocody-baie', 'pb-plage', 'attecoube-banco', 'cocody-carrefour-vie', ...CARREFOUR_IDS])

/** The ones under the sky (a maquis by the lagoon, a street of maquis, a square, a gare, a market): one walks there, never into a room. */
export const OPEN_AIR = new Set([...GROUNDS].filter((id) => id !== 'cocody-hotel-ivoire' && id !== 'bouake-hotel-paons'))

/**
 * Landmarks seen from the whole city, over the roofs of the other communes (and from the far end of
 * their own, before their streets are loaded): their far model, turned as in their own. The Tour F
 * has a light one; the cathedral, the stadium, the Pyramide and the Palais de justice are drawn as
 * they are (they stand a kilometre apart in the Plateau: from one, the others were nowhere).
 */
export const SKYLINE = new Set(['yakro-basilique', 'plateau-tour-f', 'plateau-cathedrale', 'plateau-stade', 'plateau-pyramide', 'plateau-tribunal', 'plateau-presidence', 'pb-aeroport', 'pb-rabisson', 'portbouet-parc-expo', 'cocody-rti'])
/**
 * Which way each faces when drawn from afar (its lot not laid out yet): the way its street turns it.
 * The road to the airport's (the Parc des Expositions' dome, the Rabisson, the terminal) as Port-Bouët
 * lays them out on the map (the lab: city.html?view=map, window.marks), so they're seen from the
 * boulevard on the way there, from Koumassi and Marcory, not only once in Port-Bouët.
 */
const FAR_FACING: Record<string, number> = { 'plateau-cathedrale': 0, 'plateau-tribunal': Math.PI, 'plateau-stade': 0, 'plateau-pyramide': 0, 'plateau-presidence': 0, 'pb-aeroport': -2.015, 'pb-rabisson': 1.169, 'portbouet-parc-expo': 2.758 }

/** No further than this (the fog has them all by then). */
export const SKYLINE_FAR = 5500

export function FarLandmark({ id, night }: { id: string; night: boolean }) {
  switch (id) {
    case 'plateau-tour-f':
      return (
        <group rotation={[0, TOUR_F_FACING, 0]}>
          <TourFFar night={night} />
        </group>
      )
    case 'plateau-cathedrale':
    case 'plateau-stade':
    case 'plateau-pyramide':
    case 'plateau-tribunal':
    case 'plateau-presidence':
    case 'pb-aeroport':
    case 'pb-rabisson':
    case 'portbouet-parc-expo':
    case 'cocody-rti':
    case 'yakro-basilique':
      return (
        <group rotation={[0, FAR_FACING[id] ?? 0, 0]}>
          <Landmark id={id} night={night} />
        </group>
      )
    default:
      return null
  }
}

/** The landmark's model, by place. */
export function Landmark({ id, night, demo, open = true, shore }: { id: string; night: boolean; /** On the water (places.ts ON_SHORE): the water's edge in its frame. */ shore?: [number, number][]; /** The stadium: a made-up match or concert (the videos), instead of the agenda. */ demo?: StadiumEvent; /** Open now (its hours): closed, nobody visiting (the zoo). */ open?: boolean }) {
  return (
    <Suspense fallback={null}>
      <LandmarkModel id={id} night={night} demo={demo} open={open} shore={shore} />
    </Suspense>
  )
}

function LandmarkModel({ id, night, demo, open, shore }: { id: string; night: boolean; shore?: [number, number][]; demo?: StadiumEvent; open: boolean }) {
  switch (id) {
    case 'plateau-cathedrale':
      return <Cathedral night={night} />
    case 'bassam-iugb':
      return <Iugb night={night} />
    case 'bingerville-jardin':
      return <JardinBingerville night={night} />
    case 'treich-mosquee-m6':
      return <MosqueM6 night={night} />
    case 'plateau-pyramide':
      return <Pyramide night={night} />
    case 'portbouet-parc-expo':
      return <ParcExpo night={night} />
    case 'plateau-tour-f':
      return <TourF night={night} />
    case 'plateau-tribunal':
      return <PalaisJustice night={night} />
    case 'plateau-presidence':
      return <Presidence night={night} />
    case 'plateau-stade':
      return <Stadium place={id} night={night} demo={demo} />
    case 'cocody-hotel-ivoire':
      return <HotelIvoire night={night} />
    case 'plateau-poulman':
      return <HotelPoulman night={night} />
    case 'plateau-noum':
      return <HotelNoum night={night} />
    case 'marcory-azale':
      return <HotelAzale night={night} />
    case 'marcory-capsud':
      return <CapSud night={night} />
    case 'pb-rabisson':
      return <HotelRabisson night={night} />
    case 'yakro-basilique':
      return <Basilica night={night} />
    case 'yakro-lac':
      return <LacCaimans night={night} shore={shore} />
    case 'nzi-reserve':
      return <NziReserve night={night} />
    case 'bouake-hotel-paons':
      return <JardinPaons night={night} />
    case 'yakro-mosquee':
      return <MosqueeYakro night={night} />
    case 'yakro-fondation':
      return <Fondation night={night} />
    case 'yakro-hotel':
      return <HotelResident night={night} />
    case 'yakro-golf':
      return <GolfResident night={night} />
    case 'yakro-maquis-braise':
      return <MaquisGrandBraise night={night} />
    case 'yakro-club-caiman':
      return <CaimanClub night={night} />
    case 'yakro-club-totem':
      return <TotemClub night={night} />
    case 'bouake-allocodrome':
      return <Allocodrome night={night} />
    case 'bouake-marche':
      return <MarcheBouake night={night} />
    case 'bouake-maquis-airfrance':
      return <MaquisAirFrance night={night} />
    case 'bouake-club':
      return <GbekeNight night={night} />
    case 'sp-port':
      return <PortSanPedro night={night} />
    case 'sp-peche':
      return <PortPeche night={night} shore={shore} />
    case 'sp-monogaga':
      return <PlageSud night={night} shore={shore} kind="monogaga" />
    case 'bereby-sirenes':
      return <PlageSud night={night} shore={shore} kind="sirenes" />
    case 'sp-tai-excursions':
      return <TaiAgence night={night} />
    case 'sp-cathedrale':
      return <CathedraleSP night={night} />
    case 'sp-bardot':
      return <Bardot night={night} />
    case 'sp-maquis-merou':
      return <MaquisMerou night={night} />
    case 'sp-club-cargo':
      return <CargoClub night={night} />
    case 'korhogo-waraniene':
      return <Waraniene night={night} />
    case 'korhogo-fakaha':
      return <Fakaha night={night} />
    case 'korhogo-koni':
      return <Koni night={night} />
    case 'korhogo-bois-sacre':
      return <BoisSacre night={night} />
    case 'korhogo-mont':
      return <MontKorhogo night={night} />
    case 'korhogo-mosquee':
      return <MosqueeKorhogo night={night} />
    case 'korhogo-marche':
      return <MarcheKorhogo night={night} />
    case 'korhogo-maquis-to':
      return <MaquisMamaSita night={night} />
    case 'man-dent':
      return <DentDeMan night={night} />
    case 'man-tonkpi':
      return <MontTonkpi night={night} />
    case 'man-cascade':
      return <CascadeMan night={night} />
    case 'man-gbepleu':
      return <ForetGbepleu night={night} />
    case 'man-masques':
      return <CourMasques night={night} />
    case 'man-plantation':
      return <PlantationCafe night={night} />
    case 'man-lianes-excursions':
      return <LianesAgence night={night} />
    case 'man-maquis-dent':
      return <MaquisPiedDent night={night} />
    case 'man-club-sommet':
      return <SommetClub night={night} />
    case 'man-hotel-brume':
      return <HotelBrume night={night} />
    case 'daloa-marche':
      return <MarcheDaloa night={night} />
    case 'daloa-plantation':
      return <PlantationCacao night={night} />
    case 'daloa-lobo':
      return <BordLobo night={night} />
    case 'daloa-cour-bete':
      return <CourBete night={night} />
    case 'daloa-cathedrale':
      return <CathedraleDaloa night={night} />
    case 'daloa-mosquee':
      return <MosqueeDaloa night={night} />
    case 'daloa-maquis-cabosse':
      return <MaquisCabosse night={night} />
    case 'daloa-club-zigli':
      return <ZigliClub night={night} />
    case 'daloa-hotel-antilope':
      return <HotelAntilope night={night} />
    case 'daloa-rond-point':
      return <RondPointDaloa night={night} />
    case 'daloa-zone-cacao':
      return <ZoneCacao night={night} />
    case 'man-place-paix':
      return <PlacePaix night={night} />
    case 'korhogo-club-balafon':
      return <BalafonClub night={night} />
    case 'pb-aeroport':
      return <Airport night={night} />
    case 'cocody-oranjo':
      return <OranjoVillage night={night} />
    case 'cocody-playce':
      return <Playce night={night} />
    case 'marcory-playce':
      return <PlayceMarcory night={night} />
    case 'yop-rue-princesse':
      return <RuePrincesse night={night} />
    case 'adjame-gare':
      return <GareAdjame night={night} />
    case 'yop-gare-siporex':
      return <GareSiporex night={night} />
    case 'bouake-gare':
      return <GareBouake night={night} />
    case 'yop-ficgayo':
      return <PlaceFicgayo night={night} />
    case 'treich-palais':
      return <PalaisDesSports night={night} />
    case 'adjame-forum':
      return <MarcheAdjame night={night} />
    case 'abobo-marche':
      return <MarcheAbobo night={night} />
    case 'koumassi-marche':
      return <MarcheKoumassi night={night} />
    case 'cocody-zoo':
      return <Zoo night={night} open={open} />
    case 'cocody-blockhauss-maquis':
      return <BlockhaussMaquis night={night} />
    case 'cocody-baie':
      return <BaieCocody night={night} shore={shore} />
    case 'pb-plage':
      return <PlagePortBouet night={night} shore={shore} />
    case 'attecoube-banco':
      return <ForetBanco night={night} />
    case 'cocody-carrefour-vie':
      return <CarrefourVie night={night} />
    case 'treich-palais-culture':
      return <PalaisCulture night={night} />
    case 'plateau-musee':
      return <Musee night={night} />
    case 'koumassi-tour-ivoire':
      return <TourIvoire night={night} />
    case 'plateau-assemblee':
      return <Assemblee night={night} />
    case 'treich-marche':
      return <GrandMarche night={night} />
    case 'cocody-rti':
      return <Rti night={night} />
    default:
      return CARREFOUR_IDS.includes(id) ? <Carrefour id={id} night={night} /> : null
  }
}

/** A small pixel texture painted once, repeated over a facade. */
function pixels(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * A facade of floors: a band of glass under a band of concrete, with fins;
 * and its night version, where only some of the windows are lit.
 */
function floorsTexture(glass: string, wall: string, fin: string, floors: number, bays: number) {
  const paint = (night: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = night ? '#000000' : wall
    g.fillRect(0, 0, 8, 8)
    g.fillStyle = night ? '#ffffff' : glass
    g.fillRect(1, 3, 7, 4)
    g.fillStyle = night ? '#000000' : fin
    g.fillRect(0, 0, 1, 8)
  }
  return { map: pixels(8, 8, paint(false), [bays, floors]), lights: pixels(8, 8, paint(true), [bays, floors]) }
}

/** A lit-at-night facade material. */
function facade(t: ReturnType<typeof floorsTexture>) {
  return new THREE.MeshLambertMaterial({ map: t.map, emissiveMap: t.lights, emissive: '#ffd27a', emissiveIntensity: 0 })
}


/**
 * La Pyramide (Plateau, Rinaldo Olivieri, 1973): fifteen storeys stepping
 * back toward the top, about 62 m, around a hollow core. Here every face
 * steps back alike, a simplification of the real plan.
 */
export function Pyramide({ night }: { night: boolean }) {
  const concrete = useMemo(() => new THREE.MeshLambertMaterial({ color: '#cfc6b5' }), [])
  const glass = useMemo(() => {
    return facade(floorsTexture('#2d3f52', '#2d3f52', '#b8ad98', 1, 10))
  }, [])
  const green = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4f8a3a' }), [])
  const rail = useMemo(() => new THREE.MeshLambertMaterial({ color: '#9aa0a8' }), [])
  glass.emissiveIntensity = night ? 0.55 : 0
  const STOREY = 3.9
  const HOLE = 7
  const levels = [...Array(15)].map((_, i) => {
    const w = 46 - i * 2.5
    return { y: i * STOREY, w }
  })
  return (
    <group>
      {levels.map(({ y, w }, i) => {
        // A storey: glass set back under a concrete slab, the planted terrace
        // of the storey below showing in front; a ring around the hollow core.
        const band = (w - HOLE) / 2
        const off = HOLE / 2 + band / 2
        return (
          <group key={i} position={[0, y, 0]}>
            {[
              [0, off, w, band],
              [0, -off, w, band],
              [off, 0, band, HOLE],
              [-off, 0, band, HOLE],
            ].map(([x, z, sx, sz], k) => (
              <group key={k}>
                <mesh position={[x, STOREY / 2, z]} material={glass} castShadow receiveShadow>
                  <boxGeometry args={[sx - (k < 2 ? 2 : 1), STOREY - 0.6, sz - (k < 2 ? 1 : 0)]} />
                </mesh>
                <mesh position={[x, STOREY - 0.3, z]} material={concrete} castShadow receiveShadow>
                  <boxGeometry args={[sx, 0.6, sz]} />
                </mesh>
              </group>
            ))}
            {i > 0 && (
              <mesh position={[0, 0.05, 0]} material={green}>
                <boxGeometry args={[w + 1.2, 0.1, w + 1.2]} />
              </mesh>
            )}
          </group>
        )
      })}
      {/* The crown and its mast */}
      <mesh position={[0, 15 * STOREY + 0.5, 0]} material={concrete} castShadow>
        <boxGeometry args={[10, 1, 10]} />
      </mesh>
      {/* The rail round the crown, for those who come up to look at the city (rooftops.ts) */}
      {[-1, 1].flatMap((s) => [
        <mesh key={`x${s}`} position={[0, 15 * STOREY + 2, s * 4.9]} material={rail}>
          <boxGeometry args={[9.8, 0.08, 0.08]} />
        </mesh>,
        <mesh key={`z${s}`} position={[s * 4.9, 15 * STOREY + 2, 0]} material={rail}>
          <boxGeometry args={[0.08, 0.08, 9.8]} />
        </mesh>,
      ])}
      {[-4.9, 0, 4.9].flatMap((x) =>
        [-4.9, 4.9].flatMap((z) => [
          <mesh key={`a${x}${z}`} position={[x, 15 * STOREY + 1.5, z]} material={rail}>
            <boxGeometry args={[0.07, 1, 0.07]} />
          </mesh>,
          <mesh key={`b${x}${z}`} position={[z, 15 * STOREY + 1.5, x]} material={rail}>
            <boxGeometry args={[0.07, 1, 0.07]} />
          </mesh>,
        ]),
      )}
      <mesh position={[0, 15 * STOREY + 2.5, 0]} material={concrete}>
        <cylinderGeometry args={[0.25, 0.4, 4, 6]} />
      </mesh>
    </group>
  )
}

/**
 * Stade Félix-Houphouët-Boigny (Plateau, renovated for the CAN 2023):
 * a closed oval bowl under a roof ring held by 40 cantilevered beams. The
 * dimensions are estimates.
 */
/** Its running track and the tunnel to it. */
const TRACK = STADIUM_TRACKS['plateau-stade']
/** The bowl's outer oval (half-axes, metres): its wall, round the stands. */
const STADIUM_OVAL = { x: 80 * 1.25, z: 80 }

/** What a walker can't go through: the bowl, in slices across its oval. */
export const STADIUM_SOLID: Obstacle[] = [...Array(16)].map((_, i) => {
  const x = -STADIUM_OVAL.x + (i + 0.5) * ((2 * STADIUM_OVAL.x) / 16)
  return { x, z: 0, hw: STADIUM_OVAL.x / 16, hd: STADIUM_OVAL.z * Math.sqrt(1 - (x / STADIUM_OVAL.x) ** 2), rot: 0, top: 23 }
})

function Stadium({ place, night, demo }: { place: string; night: boolean; demo?: StadiumEvent }) {
  const SX = 1.25 // the oval: stretched along the pitch
  const seats = useMemo(() => {
    const t = pixels(1, 12, (g) => {
      ;['#f08a24', '#f08a24', '#ffffff', '#ffffff', '#2f9a4a', '#2f9a4a', '#f08a24', '#f08a24', '#ffffff', '#ffffff', '#2f9a4a', '#2f9a4a'].forEach((c, y) => ((g.fillStyle = c), g.fillRect(0, y, 1, 1)))
    })
    return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })
  }, [])
  const shell = useMemo(() => new THREE.MeshLambertMaterial({ color: '#e9e4da', side: THREE.DoubleSide }), [])
  const roof = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f6f6f2', side: THREE.DoubleSide }), [])
  const steel = useMemo(() => new THREE.MeshLambertMaterial({ color: '#c7ccd2' }), [])
  const pitch = useMemo(() => {
    const t = pixels(210, 136, (g) => {
      for (let x = 0; x < 210; x += 15) {
        g.fillStyle = (x / 15) % 2 ? '#3f9a45' : '#47a84c'
        g.fillRect(x, 0, 15, 136)
      }
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1
      g.strokeRect(1.5, 1.5, 207, 133)
      g.beginPath()
      g.moveTo(105, 1)
      g.lineTo(105, 135)
      g.stroke()
      g.beginPath()
      g.arc(105, 68, 18, 0, Math.PI * 2)
      g.stroke()
      g.strokeRect(1.5, 28, 33, 80)
      g.strokeRect(175.5, 28, 33, 80)
    })
    t.magFilter = THREE.LinearFilter
    return new THREE.MeshLambertMaterial({ map: t })
  }, [])
  const track = useMemo(() => new THREE.MeshLambertMaterial({ color: '#b5533c' }), [])
  const tunnelDark = useMemo(() => new THREE.MeshBasicMaterial({ color: '#141416' }), [])

  // The bowl, turned around the middle: tiers rising from the track to the top.
  const bowl = useMemo(() => {
    const g = new THREE.LatheGeometry([new THREE.Vector2(52, 0.2), new THREE.Vector2(53, 2.5), new THREE.Vector2(77, 22)], 64)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const outer = useMemo(() => {
    const g = new THREE.CylinderGeometry(79, 80, 23, 64, 1, true)
    g.translate(0, 11.5, 0)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const ring = useMemo(() => {
    const g = new THREE.LatheGeometry([new THREE.Vector2(62, 27.5), new THREE.Vector2(84, 25)], 64)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const floor = useMemo(() => {
    const g = new THREE.CircleGeometry(53, 48)
    g.rotateX(-Math.PI / 2)
    g.scale(SX, 1, 1)
    return g
  }, [])
  const beams = useMemo(
    () =>
      [...Array(40)].map((_, i) => {
        const a = (i / 40) * Math.PI * 2
        const [c, s] = [Math.cos(a), Math.sin(a)]
        // From the mast outside the bowl up and in over the stands.
        return { foot: [c * 84 * SX, s * 84] as [number, number], tip: [c * 62 * SX, s * 62] as [number, number] }
      }),
    [],
  )
  return (
    <group>
      <mesh geometry={floor} position={[0, 0.5, 0]} material={track} receiveShadow />
      <mesh position={[0, 0.7, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pitch} receiveShadow>
        <planeGeometry args={[105, 68]} />
      </mesh>
      <mesh geometry={bowl} material={seats} receiveShadow castShadow />
      <mesh geometry={outer} material={shell} castShadow receiveShadow />
      <mesh geometry={ring} material={roof} castShadow />
      {/* The tunnel in from the front (stadiumTrack.ts): its mouth in the wall, and the other on the track, under the first tier */}
      <mesh position={[TRACK.tunnel, 2.3, 80.15]} material={tunnelDark}>
        <boxGeometry args={[4.2, 4.6, 0.5]} />
      </mesh>
      <mesh position={[TRACK.tunnel, 2.6, 79.95]} material={steel}>
        <boxGeometry args={[5.2, 5.2, 0.3]} />
      </mesh>
      <mesh position={[TRACK.tunnel, 1.3, 51.9]} material={tunnelDark}>
        <boxGeometry args={[3.6, 2.6, 0.8]} />
      </mesh>
      {/* A match or a concert, when one is on */}
      <StadiumLive place={place} night={night} demo={demo} />
      {beams.map(({ foot, tip }, i) => {
        const a = new THREE.Vector3(foot[0], 0, foot[1])
        const top = new THREE.Vector3(foot[0], 30, foot[1])
        const b = new THREE.Vector3(tip[0], 27.6, tip[1])
        const mid = top.clone().add(b).multiplyScalar(0.5)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(top).normalize())
        return (
          <group key={i}>
            <mesh position={a.clone().setY(15)} material={steel} castShadow>
              <boxGeometry args={[1, 30, 1]} />
            </mesh>
            <mesh position={mid} quaternion={q} material={steel} castShadow>
              <boxGeometry args={[top.distanceTo(b), 1.2, 0.8]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/**
 * Oranjo Village, the game's name for Orange Village (Cocody, Riviera Golf,
 * Koffi & Diabaté Architectes, 2022): seven levels in rings 68 m across under
 * a perforated double skin shaped like a golf ball. The sphere's proportions
 * are an estimate.
 */
function OranjoVillage({ night }: { night: boolean }) {
  const R = 36
  const CY = -6 // the ball's centre, below the ground: a cap of it stands
  const skin = useMemo(() => {
    // White, pierced with round holes like a golf ball's dimples.
    const t = pixels(16, 16, (g) => {
      g.fillStyle = '#f7f7f4'
      g.fillRect(0, 0, 16, 16)
      g.globalCompositeOperation = 'destination-out'
      g.beginPath()
      g.arc(8, 8, 5, 0, Math.PI * 2)
      g.fill()
    }, [56, 18])
    return new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide })
  }, [])
  const cap = useMemo(() => new THREE.SphereGeometry(R, 56, 20, 0, Math.PI * 2, 0, Math.acos(-CY / R)), [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#36576f', emissive: '#ffd27a', emissiveIntensity: 0 }), [])
  const slab = useMemo(() => new THREE.MeshLambertMaterial({ color: '#efece6' }), [])
  const brand = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ff7900', emissive: '#ff7900', emissiveIntensity: 0.2 }), [])
  glass.emissiveIntensity = night ? 0.5 : 0
  brand.emissiveIntensity = night ? 0.8 : 0.2
  const levels = [...Array(7)].map((_, i) => {
    const y = i * 4
    return { y, r: Math.sqrt(R * R - (y + 2 - CY) ** 2) - 3 }
  })
  return (
    <group>
      {levels.map(({ y, r }, i) => (
        <group key={i} position={[0, y, 0]}>
          <mesh position={[0, 2, 0]} material={glass} castShadow>
            <cylinderGeometry args={[r - 1, r - 1, 3.5, 40]} />
          </mesh>
          <mesh position={[0, 3.8, 0]} material={slab} castShadow receiveShadow>
            <cylinderGeometry args={[r, r, 0.5, 40]} />
          </mesh>
        </group>
      ))}
      <mesh geometry={cap} position={[0, CY, 0]} material={skin} castShadow />
      {/* The orange band at the foot, and the forecourt */}
      <mesh position={[0, 0.6, 0]} material={brand}>
        <cylinderGeometry args={[Math.sqrt(R * R - CY * CY) + 0.3, Math.sqrt(R * R - CY * CY) + 0.3, 1.2, 56, 1, true]} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[42, 48]} />
        <meshLambertMaterial color="#cfc8b8" />
      </mesh>
    </group>
  )
}
