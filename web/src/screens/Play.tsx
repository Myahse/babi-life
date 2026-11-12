import { openSpot, setSceneActions, useSceneActions, type SceneAction } from '../world3d/sceneActions'
import { gesture } from '../world3d/gesture'
import type { Pose } from '../avatar/Human'
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Refrigerator, BadgeCheck, BookOpen, ZapOff, KeyRound, Volleyball, Banknote, Bike, Camera, Plane, Images, Megaphone, Smile, Cake, Hammer, Eye, LocateFixed, LogOut, Mountain, Navigation, Briefcase, DoorOpen, Hourglass, Newspaper, Square, Shirt, Scissors, Bus, CarTaxiFront, ChevronLeft, ChevronRight, Clock3, Trophy, Dice5, Footprints, House, Lock, Map as MapIcon, MapPin, MessageCircle, ReceiptText, Smartphone, Sparkles, TriangleAlert, UserRound, Users, X, Bath, BedDouble, CookingPot, Sofa, Trees, type LucideIcon, CornerUpLeft, CornerUpRight, ArrowUp, Undo2, Car, Gamepad2, ShoppingBag, Lightbulb, Landmark, PartyPopper, Settings, Gift, Ticket, Check, HandHelping, ChevronDown, CalendarClock, IdCard } from 'lucide-react'
import { api, ApiError, errorText, type RendezVousItem } from '../lib/api'
import { RENDEZVOUS_OPEN } from '../lib/rendezvous'
import { useOnline } from '../lib/offline'
import { onSynced, pendingOffline, picking } from '../lib/offlinePlay'
import { kindOf, type ActionResult, type City, type Commune, type HappeningNow, type Interaction, type NeedKey, type JobTask, type JournalEvent, type Player, type Sim, type Soiree, type World, type Ride, type Place, type Plot, type StreetRide, type Piece, type SoireeRoom } from '../lib/types'
import { FridgeSheet } from '../components/Fridge'
import { GiftsSheet, useFriendGifts } from '../components/GiftDrawer'
import { useWorld } from '../store/world'
import { useSession } from '../store/session'
import { joinMatch, type CourtMatch } from '../streetball/online'
import { serverNow } from '../lib/worldClock'
import { DUEL_IN, MESSAGE_IN, SIM_CHANGED, useLive } from '../lib/live'
import { sfx } from '../lib/sfx'
import { Joystick, RunButton, WalkKeys } from '../components/Joystick'
import { cameraTurn } from '../world3d/input'
import { bearingTo, distanceTo, whereabouts } from '../world3d/whereabouts'
import { challengeInAddress, useShare } from '../lib/share'
import { ShareSheet } from '../components/SharedCard'
import { cutsAround, inCut, type PowerCut } from '../world3d/power'
import { isRoomAct, openLift } from '../world3d/hotelLift'
import { throwBillets } from '../world3d/clubBillets'
import { OrbitGizmo } from '../components/OrbitGizmo'
import { FirstSteps } from '../components/FirstSteps'
import { TravelCTA, type OnTravel } from '../components/TravelCTA'
import { ARRIVE_AT, farOf, farSpots, setTripThen, useTripThen, type FarSpot } from '../game/far'
import { Portrait } from '../avatar/portrait'
// The street's 3D (world3d/open/OpenWorld, a third of the game's code): its own download, asked the moment
// the game's code is there, so the game's screen needn't wait for it (update « demarrage-rapide »:
// world3d/StreetComing.tsx shows it coming meanwhile; closed, the loading screen waits for it as before).
let streetCode = false
const streetHeard = new Set<() => void>()
const loadStreet = () => import('../world3d/open/OpenWorld')
// Asked once, now; whoever waits hears when it's there (or failed: the street then asks again, as any lazy screen).
void loadStreet()
  .catch(() => null)
  .then(() => ((streetCode = true), streetHeard.forEach((f) => f())))
const OpenWorld = lazy(() => loadStreet().then((m) => ({ default: m.OpenWorld })))
const Neighbourhood = lazy(() => import('../world3d/Neighbourhood').then((m) => ({ default: m.Neighbourhood })))
/** The street's code is there. */
function useStreetCode() {
  const [ok, setOk] = useState(streetCode)
  useEffect(() => {
    if (ok) return
    const heard = () => setOk(true)
    streetHeard.add(heard)
    if (streetCode) heard()
    return () => void streetHeard.delete(heard)
  }, [ok])
  return ok
}
import { GROUNDS, LANDMARKS, OPEN_AIR } from '../world3d/open/landmarks'
import { rooftopFor } from '../world3d/open/rooftops'
import { iconFor, kindColors } from '../components/icons'
import { SOIREE_HOURS, SOIREE_THEMES, entryLabel, keepRoom, lastRoom, soireeCost } from '../game/soirees'
import { Chip, Coin, DayNight, IconTile, MotiveRing, Row, needColor } from '../components/ui'
import { EPOCH, NEEDS, km, actionLength, homePlanFor, ageBlock, amount, fcfa, atHome, blockedBy, homeLacks, housingOf, lifeOf, minutesToAge, clock, duration, mood, openAt, openingLabel, predict, shift, trip } from '../game/rules'
import { DOORS_OPEN, eventAt, useStadium, when } from '../lib/stadium'
import { CIVIC_KINDS, civicState, discounted, fareOff, PUBLIC_RIDES, useTerrain, withMeasures } from '../lib/civic'
import { HomeApp, JobsApp, type Act } from './phoneApps'
import { PrisonPanel } from '../components/Prison'
import { BankPlan, WantedChip, useBraquage } from '../components/Braquage'
import { BikeShare } from '../components/BikeShare'
import { RENTED } from '../world3d/bikeShare'
import { useNearBuilding, type Visitable } from '../world3d/visit'
import { NewsApp, topicOf } from './NewsApp'
import { ErrandsApp, ErrandsChip } from '../components/ErrandsApp'
import { useEpreuveNow } from '../lib/epreuve'
import { NextGoal, useNextGoal, type Goal } from '../components/NextGoal'
import { ZoneBanner } from '../components/ZoneBanner'
import { FirstStory } from '../components/FirstStory'
import { lazyIn } from '../lib/lazyIn'
import { RideFlow, type FlowRequest } from '../components/RideFlow'
import { INDOOR, Interior, SCENES } from '../world3d/Interior'
import { HomeInside } from '../world3d/HomeInside'
import { SCHOOL_LINE, SchoolDay, schoolPart } from '../world3d/interior/SchoolDay'
import { childhoodBuddy } from '../game/childhood'
import { ARENAS, Arena } from '../world3d/interior/Arena'
import { AppLogo } from '../components/AppLogo'
import { TesterTools } from '../components/TesterTools'
import { GolvoApp, deliveryState, type Delivery } from './GolvoApp'
import { FilmButton, FilmPlayer } from './FilmPlayer'
import { LiveBar } from './TikiLive'
import { BoutiqueApp, passOn } from './BoutiqueApp'
import { InviteBanner, PlayersChip, PlayersSheet, joinableActivity, usePlayers } from '../components/Players'
import { DuelLayer } from '../components/Duel'
import { LandscapeHint, ReglagesApp } from '../components/Reglages'
import { DamesBanner, DamesSheet, DamesStake } from '../components/Dames'
import { HuitBanner, HuitSheet, HuitStake } from '../components/Huit'
import { MachineButton, MachineSheet, isSlots } from '../components/Machine'
import { SHOP_OF } from '../lib/clothes'
import { Ambience, BabyVoice, ClearViewToggle, SoundToggle, Soundtrack } from '../components/Soundtrack'
import { useClearView } from '../store/clearView'
import { DanceFloor, floorOfTheme } from '../avatar/dances'
import { usePartySound } from '../world3d/open/party'
import { MiniMap, WhereTo } from '../components/Navigator'
import type { FreeTalk, Reply } from '../components/ChatSheet'
import { SERVICES } from '../world3d/interior/worshipRooms'
import { npcReact } from '../world3d/open/npcReact'
import type { Npc } from '../world3d/open/OpenWorld'
import { setTalkHandler, setTalking, type Where } from '../world3d/talk'
import { greetingFor, meeting, walkUpTo } from '../world3d/meet'
import { lastTap, lifeListening, openPie, setPlayerTap, setQueueExtra, tapPerson, type PieOption } from '../game/lifeMode'
import { PieMenu } from '../components/LifeHud'
import { parseWish, wishBurst } from '../components/Envies'
import { approach, emoteNow, playEmote } from '../world3d/emoteNow'
import { LifeHome } from '../components/LifeHome'
import { LifeButtons } from '../components/LifePanels'
import { FamilleVie } from '../components/Famille'
import { BackHome, Shock, TimeToGo, WorkCard, brokenFor, timeToGo, unseenDay } from '../components/LifeWork'
import type { WorkTrip } from '../world3d/lifeWork3d'
import type { WorkDay } from '../lib/types'
import { STATUS, moodColor, skillsRose, socialOf } from '../game/vie'
import type { Track } from '../audio/music'
import { NotifyPrompt } from '../components/NotifyPrompt'
import { motoHold, offerMoto, motoPaid, motoWalk, rideFare, rideThere, RIDES, useMoto, type RideKind, type Taken } from '../world3d/moto'
import { GBAKA, inkOn, kerbWait, MOTO, waitsAtKerb } from '../game/rides'
import { answerDrop, useDropAsk } from '../world3d/dropRoute'
import { TripLoading } from '../components/TripLoading'
import { AIRLINE_APP, clockLabel, coachCompany, coachesFrom, flightsFrom, gareOf, nextCoach, TRAVEL_KEY } from '../game/voyages'
import { rideLook } from '../game/rides'
import { setDrop } from '../world3d/open/tripDrop'
import { tripRide } from '../world3d/open/tripRide'
import { gesteOK } from '../components/defi/Gestes'
import { JEUX } from '../components/defi/jeux/data'
import { BABY_DEFIS, GESTE_DEFIS, DefiButton, DefiSheet, defiLook, defiOf, PRACTICE, type DefiKind } from '../components/Defi'
import { PvpLayer } from '../components/pvp/PvpLayer'
import { PvpJeux } from '../components/pvp/PvpButton'
import { Tutorial, adultChapterDue, beginner, openTutorial, useTutorialAsked } from '../components/Tutorial'
import { Arrival, arrivalDue, type ArrivalPart } from '../components/Arrival'
import { haptic, onBack } from '../lib/native'
import { openAd, seen, useAds } from '../lib/ads'
import { drive, getIn, gps, parkedNow, parkIn, setParked, startDrive, stopDrive, topSpeed, useDriving, useParked, walkToVehicle, type Driven, type Parked } from '../world3d/drive'
import { drankLately, myKindLabel, noteDrink, pickCar, toCar, useMyVehicles, type CarHere } from '../game/myCar'
import { PhoneIcon } from '../components/PhoneIcon'
import { aCommune } from '../lib/french'

/** Building one's house: its own screen, downloaded when opened. */
/** A game home on Dodo, by its kind: the house drawn (game/plans.go), two to choose from by its seed. */
const DODO_PLANS: Record<string, string[]> = { chambre: ['cour', 'baraque'], studio: ['studio'], appart: ['appart'], duplex: ['maison', 'appart'], villa: ['villa', 'villa-grande'] }
/** What's done in a home booked on Dodo, as the home's inside shows it (backend game/dodo.go « logement »). */
const DODO_AT_HOME: Record<string, string> = { 'logement-dormir': 'sleep', 'logement-sieste': 'nap', 'logement-douche': 'shower', 'logement-cuisiner': 'cook-attieke', 'logement-tele': 'watch-tv', 'logement-amis': 'call-family' }
// The phone's apps: each loaded when it's first opened, not with the game (they were a good part of its download).
// Loaded when first opened (lib/lazyIn.tsx), not with the game: the phone's apps, the map, the camera,
// the emotes, the shops, the long trips, the talks.
const LudoApp = lazy(() => import('./LudoApp').then((m) => ({ default: m.LudoApp })))
const BetApp = lazy(() => import('./BetApp').then((m) => ({ default: m.BetApp })))
const CameraView = lazyIn(() => import('./CameraView').then((m) => ({ default: m.CameraView })))
const EmoteSheet = lazyIn(() => import('./EmoteSheet').then((m) => ({ default: m.EmoteSheet })))
const ClothesShop = lazyIn(() => import('../components/ClothesShop').then((m) => ({ default: m.ClothesShop })))
const WorldMap = lazyIn(() => import('./WorldMap').then((m) => ({ default: m.WorldMap })))
const CityTrip = lazyIn(() => import('../components/CityTrip').then((m) => ({ default: m.CityTrip })))
const FlightView = lazyIn(() => import('../world3d/FlightView').then((m) => ({ default: m.FlightView })))
const MetroView = lazyIn(() => import('../world3d/MetroView').then((m) => ({ default: m.MetroView })))
const CommuneGrin = lazy(() => import('./Grin').then((m) => ({ default: m.CommuneGrin })))
const ChatSheet = lazyIn(() => import('../components/ChatSheet').then((m) => ({ default: m.ChatSheet })))
const MentorApp = lazy(() => import('../components/MentorApp').then((m) => ({ default: m.MentorApp })))
const InviteApp = lazy(() => import('../components/InviteApp').then((m) => ({ default: m.InviteApp })))
const GuideApp = lazy(() => import('./GuideApp').then((m) => ({ default: m.GuideApp })))
const IdeasApp = lazy(() => import('./IdeasApp').then((m) => ({ default: m.IdeasApp })))
const PolitiqueApp = lazy(() => import('./PolitiqueApp').then((m) => ({ default: m.PolitiqueApp })))
const RendezVousApp = lazy(() => import('../components/RendezVous').then((m) => ({ default: m.RendezVousApp })))
const PapiersApp = lazy(() => import('../components/Papiers').then((m) => ({ default: m.PapiersApp })))
const DodoApp = lazy(() => import('./DodoApp').then((m) => ({ default: m.DodoApp })))
const KineoApp = lazy(() => import('./KineoApp').then((m) => ({ default: m.KineoApp })))
const DamesApp = lazy(() => import('./DamesApp').then((m) => ({ default: m.DamesApp })))
const AwaleApp = lazy(() => import('./AwaleApp').then((m) => ({ default: m.AwaleApp })))
const BillardApp = lazy(() => import('./BillardApp').then((m) => ({ default: m.BillardApp })))
const HuitApp = lazy(() => import('./HuitApp').then((m) => ({ default: m.HuitApp })))
const BingoApp = lazy(() => import('./BingoApp').then((m) => ({ default: m.BingoApp })))
const CasinoApp = lazy(() => import('./CasinoApp').then((m) => ({ default: m.CasinoApp })))
const GodeApp = lazy(() => import('./GodeApp').then((m) => ({ default: m.GodeApp })))
const GbairaiApp = lazy(() => import('./GbairaiApp').then((m) => ({ default: m.GbairaiApp })))
const TikitokoApp = lazy(() => import('./TikitokoApp').then((m) => ({ default: m.TikitokoApp })))
const BabigramApp = lazy(() => import('./BabigramApp').then((m) => ({ default: m.BabigramApp })))
const WayeApp = lazy(() => import('./WayeApp').then((m) => ({ default: m.WayeApp })))
const StoreApp = lazy(() => import('./StoreApp').then((m) => ({ default: m.StoreApp })))
const FriendsApp = lazy(() => import('./FriendsApp').then((m) => ({ default: m.FriendsApp })))
const FlasheApp = lazy(() => import('./FlasheApp').then((m) => ({ default: m.FlasheApp })))
const GalleryApp = lazy(() => import('./GalleryApp').then((m) => ({ default: m.GalleryApp })))
const AirLaguneApp = lazy(() => import('../components/AirLaguneApp').then((m) => ({ default: m.AirLaguneApp })))
const BolideApp = lazy(() => import('./BolideApp').then((m) => ({ default: m.BolideApp })))
const JeuDefi = lazy(() => import('../components/defi/jeux').then((m) => ({ default: m.JeuDefi })))
const BuildMode = lazy(() => import('../components/BuildMode'))
const SoireeDeco = lazy(() => import('../components/SoireeDeco'))
const KartRace = lazy(() => import('../kart/KartRace'))
// The Hôtel Ivoire's own inside: its hall, cinema, casino, terrace.
// The big shopping centres' own inside: the supermarket, the gallery of shops, the food court.
const MallInside = lazy(() => import('../world3d/interior/MallInside').then((m) => ({ default: m.MallInside })))
import type { MallLayout } from '../world3d/interior/MallInside'
import { activityOpen, keyOpen, useFastStart, useFeatures, useKeyOpen } from '../lib/features'
import { takeStart } from '../lib/fastStart'
import { StreetComing, StreetSky } from '../world3d/StreetComing'
import { lowNeeds } from '../world3d/NeedsAura'
import { ListedFamily } from '../components/ListedFamily'
import { Bapteme } from '../components/Bapteme'
import { GrowUpParty } from '../components/GrowUpParty'
import { ChoiceSheet, FirstsChip, useFirsts, useSteps } from '../components/Firsts'
import { FeatureNews } from '../components/FeatureNews'
import { BottomBar, MoiSheet, PlaceStrip, type HudActs, type HudTab } from '../components/SimpleHud'
import { Sheet } from '../components/Sheet'
import { Splash } from '../components/Splash'
import { pusher, startCleaning } from '../world3d/carer'
import { Helper } from '../components/Helper'
import { LotPlaceHud } from '../components/LotPlaceHud'
import { useLotPlace } from '../store/lotPlace'
import { t as tr, tn, tx, locale } from '../lib/i18n'
import { setExpression, setSpeaking, type Expression } from '../avatar/expressions'
const IvoireInside = lazy(() => import('../world3d/interior/IvoireInside').then((m) => ({ default: m.IvoireInside })))
const CathedralInside = lazy(() => import('../world3d/interior/CathedralInside').then((m) => ({ default: m.CathedralInside })))
const BasiliqueInside = lazy(() => import('../world3d/interior/BasiliqueInside').then((m) => ({ default: m.BasiliqueInside })))
/** Yamoussoukro's, Bouaké's, San-Pédro's and Korhogo's played games, by activity, and the update each waits for (backend sims/defi.go villeDefis). */
const VILLE_DEFIS: Record<string, string> = { 'basilique-visite': 'yakro-vivant', 'caimans-nourrir': 'yakro-vivant', 'safari-4x4': 'bouake-vivant', 'safari-pied': 'bouake-vivant', 'port-grue-cacao': 'sanpedro-vivant', 'peche-pirogue': 'sanpedro-vivant', 'tai-excursion': 'sanpedro-vivant', 'waraniene-tisser': 'korhogo-vivant', 'korhogo-toile-marche': 'korhogo-vivant', 'dent-monter': 'man-vivant', 'lianes-traverser': 'man-vivant', 'daloa-balances': 'daloa-vivant', 'plantation-cacao': 'daloa-vivant' }
const MosqueM6Inside = lazy(() => import('../world3d/interior/MosqueM6Inside').then((m) => ({ default: m.MosqueM6Inside })))
const PyramideInside = lazy(() => import('../world3d/interior/PyramideInside').then((m) => ({ default: m.PyramideInside })))
const PalaisCultureInside = lazy(() => import('../world3d/interior/PalaisCultureInside').then((m) => ({ default: m.PalaisCultureInside })))
const MuseeInside = lazy(() => import('../world3d/interior/MuseeInside').then((m) => ({ default: m.MuseeInside })))
const AssembleeInside = lazy(() => import('../world3d/interior/AssembleeInside').then((m) => ({ default: m.AssembleeInside })))
const MarcheTreichInside = lazy(() => import('../world3d/interior/MarcheTreichInside').then((m) => ({ default: m.MarcheTreichInside })))
const KineoInside = lazy(() => import('../world3d/interior/KineoInside').then((m) => ({ default: m.KineoInside })))
const BoulayScene = lazy(() => import('../world3d/interior/BoulayScene').then((m) => ({ default: m.BoulayScene })))
// An airport's terminal: its hall, the check-in, the departures board, the planes beyond the glass.
const AirportInside = lazy(() => import('../world3d/interior/AirportInside').then((m) => ({ default: m.AirportInside })))
// A beach: down on the sand, the waves, the paillotes (not by the road).
const BeachScene = lazy(() => import('../world3d/interior/BeachScene').then((m) => ({ default: m.BeachScene })))
/** The centres that aren't the default mall: Sococé's own supermarket and shops, the Kinéo cinemas in their galleries. */
const MALLS: Record<string, MallLayout> = {
  'cocody-sococe': { market: tr('SOCOCÉ'), back: [tr('PRESSING DES 2 PLATEAUX'), 'BOULANGERIE', tr('PHONE 225'), 'PHARMACIE', tr('MODE WAX')], front: ['LIBRAIRIE', tr('BEAUTÉ & CO'), '', tr('CAFÉ DES PLATEAUX')], kineo: true },
  'marcory-capsud': { kineo: true },
  'cocody-playce': { market: tr('BABI MARKET'), back: [tr('MODE WAX'), tr('BABI SNEAKERS'), tr('PHONE 225'), tr('PHARMACIE DE LA PALMERAIE'), tr('OPTIQUE D’IVOIRE')], front: ['LIBRAIRIE', tr('BEAUTÉ & CO'), tr('BURGER 225'), tr('CAFÉ DE LA RIVIERA')], style: 'palmeraie' },
  'marcory-playce': { market: tr('BABI MARKET'), back: [tr('MODE WAX'), tr('BABI SNEAKERS'), tr('PHONE 225'), tr('PHARMACIE DE MARCORY'), tr('BIJOUX D’ÉBÈNE')], front: ['LIBRAIRIE', tr('JOUETS & CO'), tr('ARCADE 225'), tr('GLACIER COCO')], style: 'marcory' },
}
/** The landing at Azito: the pinasse over to Île Boulay, its own scene while there. */
const BOULAY = 'yop-ile-boulay'
const HotelInside = lazy(() => import('../world3d/interior/HotelInside').then((m) => ({ default: m.HotelInside })))
const HotelStay = lazy(() => import('../world3d/interior/HotelFloors').then((m) => ({ default: m.HotelStay })))
const StreetMatch = lazy(() => import('../streetball/StreetMatch'))
// Tennis and volleyball at their courts (updates « tennis », « volley »), each downloaded apart.
const TennisMatch = lazy(() => import('../sports/TennisMatch'))
const VolleyMatch = lazy(() => import('../sports/VolleyMatch'))

type Toast = { id: number; title: string; text?: string; money: number; tone: 'random' | 'done' | 'error' | 'promo' | 'event'; kind?: string; icon?: string }

function useIsDesktop() {
  return useMedia('(min-width: 1024px)')
}

/** A short screen (index.css's `short`: a phone on its side). */
const useShort = () => useMedia('(max-height: 520px)')

function useMedia(q: string) {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return match
}

// In development, ?hour=22 shows the street at that hour (to check the night).
const HOUR_OVERRIDE = import.meta.env.DEV && new URLSearchParams(location.search).get('hour') ? Number(new URLSearchParams(location.search).get('hour')) : undefined
const MAP_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
/** The Garbaya order on its way, kept on the device. */
const GOLVO_KEY = 'babi-golvo'

/**
 * The commune with its places from the map added (for the menus, names and
 * kinds of what the Sim walks to), the same object while neither changes.
 */
const withMap = new WeakMap<Commune, { list: Place[]; merged: Commune }>()
function withMapPlaces(c: Commune, list: Place[]): Commune {
  if (!list.length) return c
  const had = withMap.get(c)
  if (had?.list === list) return had.merged
  const merged = { ...c, places: [...c.places, ...list] }
  withMap.set(c, { list, merged })
  own.set(merged, c)
  return merged
}
/** The commune as the server sends it, without the map's places (the world adds its own). */
const own = new WeakMap<Commune, Commune>()
const ownPlaces = (c: Commune) => own.get(c) ?? c

const streetPose = () => ({ heading: whereabouts.heading, polar: whereabouts.polar })

/** The street sellers (world3d/open/stalls.tsx; backend sims/street.go): what buying from each is called. */
/**
 * To the nearest place of a kind (the Encyclo's « Y aller »): one in the quarter round the Sim, else
 * one of the commune (walked to), else the map to find one elsewhere.
 */
function goToKind(kind: string, commune: Commune, onWalk: (id: string) => void, onMap: () => void) {
  const around = whereabouts.places.filter((p) => p.kind === kind).sort((a, b) => distanceTo(a.door) - distanceTo(b.door))[0]
  const here = around ?? commune.places.find((p) => p.kind === kind)
  if (here) onWalk(here.id)
  else onMap()
}

const STREET_SELLERS: Record<string, [string, string]> = {
  alloco: [tr("L'alloco de la tantie"), 'banana'],
  porc: [tr('Le porc au four'), 'drumstick'],
  cafe: [tr('Le café du pousse-pousse'), 'coffee'],
  the: [tr('Le thé avec les gars'), 'cup-soda'],
  garba: [tr('Le garba du garbadrome'), 'fish'],
  brochette: [tr('Le pain brochette'), 'sandwich'],
  loto: [tr('Un ticket de Loto Chance'), 'ticket'],
  foot: [tr('Le foot du quartier'), 'volleyball'],
  basket: [tr('Le basket du quartier'), 'trophy'],
  grin: [tr('Le thé au grin'), 'cup-soda'],
  causerie: [tr('La causerie du quartier'), 'messages-square'],
  travail: [tr('Le travaillement'), 'music'],
  dames: [tr('Les dames sous le lampadaire'), 'grid-3x3'],
  preche: [tr('Le prêcheur de rue'), 'book-open'],
  oranges: [tr('Les oranges de la marchande'), 'citrus'],
  eau: [tr("L'eau glacée"), 'droplet'],
  credit: [tr('Le crédit du vendeur'), 'smartphone'],
  pain: [tr('Le pain chaud'), 'croissant'],
}

/** How a chat went, on the faces (avatar/expressions.ts): a compliment or a flirt that works blushes them, teasing gone wrong angers them. */
function chatFaces(npc: string, topic: string, mood: string | undefined) {
  if ((topic === 'drague' || topic === 'compliment') && mood === 'good') return setExpression(npc, 'love', 3500), setExpression('me', 'shy', 3500)
  if (topic === 'blague' && mood === 'good') return setExpression('me', 'laugh', 3000)
  if (topic === 'chambrer' && mood === 'bad') return setExpression(npc, 'angry', 3500), setExpression('me', 'scared', 2500)
  if (mood === 'good') setExpression('me', 'smile', 3000)
  else if (mood === 'bad') setExpression('me', 'disappointed', 3000)
}

export function Play() {
  const world = useWorld((s) => s.world)!
  const user = useSession((s) => s.user)
  const token = useSession((s) => s.token)
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const short = useShort()
  // « Écran dégagé » (store/clearView.ts): the side panels hidden over the street.
  const clearView = useClearView((s) => s.on)

  const [base, setBase] = useState<{ sim: Sim; at: number } | null>(null)
  const [journal, setJournal] = useState<JournalEvent[]>([])
  const [seen, setSeen] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [placeId, setPlaceId] = useState<string | null>(null)
  // Development only (tests in the browser): a place's card opened straight away.
  if (import.meta.env.DEV) Object.assign(globalThis, { __openPlace: setPlaceId })
  // The game on screen: the account's play time goes on (every minute, and as the game comes back on screen; never while hidden).
  useEffect(() => {
    if (!token) return
    const ping = () => document.visibilityState === 'visible' && void api.playing().catch(() => undefined)
    ping()
    const t = setInterval(ping, 60_000)
    document.addEventListener('visibilitychange', ping)
    return () => (clearInterval(t), document.removeEventListener('visibilitychange', ping))
  }, [token])
  // Inside a place, the Sim walks about first; the actions open when asked for.
  const [menuOpen, setMenuOpen] = useState(false)
  // The ciné-club's film open on the screen (screens/FilmPlayer.tsx).
  const [watching, setWatching] = useState(false)
  // The « Émotes » sheet.
  const [emotesOpen, setEmotesOpen] = useState(false)
  useEffect(() => {
    setMenuOpen(false)
  }, [placeId])
  // Walking round the zoo or the hotel's grounds: gone well past them, the visit is over.
  useEffect(() => {
    if (!placeId || !GROUNDS.has(placeId)) return
    const t = setInterval(() => {
      const door = whereabouts.places.find((p) => p.id === placeId)?.door
      if (door && Math.hypot(door[0] - whereabouts.sim[0], door[1] - whereabouts.sim[1]) > (LANDMARKS[placeId] ?? 40) * 2 + 20) setPlaceId(null)
    }, 1000)
    return () => clearInterval(t)
  }, [placeId])
  const [goTo, setGoTo] = useState<{ placeId: string; nonce: number } | null>(null)
  const [overlay, setOverlay] = useState<'phone' | 'map' | 'camera' | 'flashe' | null>(null)
  const overlayRef = useRef(overlay)
  overlayRef.current = overlay
  const [pending, setPending] = useState<{ label: string; icon: string; kind: string } | null>(null)
  // The place whose door the Sim is standing at after walking with the pad.
  const [near, setNear] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [street, setStreet] = useState<HappeningNow | null>(null)
  // Asked again after the jam was regulated (the update « circulation »): cleared, its cars drive off.
  const [streetAsk, setStreetAsk] = useState(0)
  const [flow, setFlow] = useState<FlowRequest | null>(null)
  // Looking at the street rather than inside the place the Sim is in.
  const [outside, setOutside] = useState(false)
  // The place an action was picked in: still on screen while it's asked for (no flash of the
  // street before the Sim is seen at it), and open again once it's done, for another thing there
  // (Sortir is what leaves).
  const [backTo, setBackTo] = useState<string | null>(null)
  // A Garbaya order on its way, and the phone app to open.
  // Kept on the device: the phone dropping the tab (or a reload) mid-delivery no longer loses the order.
  const [delivery, setDelivery] = useState<Delivery | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(GOLVO_KEY) ?? 'null')
    } catch {
      return null
    }
  })
  useEffect(() => {
    try {
      if (delivery) localStorage.setItem(GOLVO_KEY, JSON.stringify(delivery))
      else localStorage.removeItem(GOLVO_KEY)
    } catch {
      /* private browsing: the order lasts as long as the page */
    }
  }, [delivery])
  const [phoneApp, setPhoneApp] = useState<PhoneAppId | null>(null)
  // Development only (tests): /jeu?place=<id> opens a place of the commune where the Sim is, as if walked to.
  useEffect(() => {
    const want = import.meta.env.DEV ? new URLSearchParams(location.search).get('place') : null
    if (want) setPlaceId(want)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Back from GeniusPay's page (/jeu?achat=<purchase>, &echec=1 the error way): the phone opens on the Boutique, which asks how it went.
  const [achat] = useState(() => {
    const q = new URLSearchParams(location.search)
    const id = q.get('achat')
    return id ? { id, failed: q.get('echec') === '1' } : null
  })
  useEffect(() => {
    if (!achat) return
    setPhoneApp('boutique')
    setOverlay('phone')
    const q = new URLSearchParams(location.search)
    q.delete('achat')
    q.delete('echec')
    history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : ''))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // A notification tapped (/jeu?app=gbairai, ?app=bet225): the phone opens on that app.
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const want = q.get('app') as PhoneAppId | 'flashe' | null
    // (Also the apps an update opens: its notification leads there, admin « Prévenir les joueurs ».)
    if (!want || !['gbairai', 'bet225', 'parisfoot', 'home', 'guide', 'flashe', 'boutique', 'mentor', 'demandes', 'inviter', 'tikitoko', 'babigram', 'waye', 'golvo', 'dodo', 'kineo', 'bolide', 'dames', 'huit', 'awale', 'billard', 'ludo', 'bingo', 'casino', 'gode', 'politique', 'rendezvous', 'papiers', 'news', 'idees', 'reglages'].includes(want)) return
    // Flashé opens over the game (its camera sees the street), not in the phone.
    if (want === 'flashe') setOverlay('flashe')
    else (setPhoneApp(want), setOverlay('phone'))
    q.delete('app')
    history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : ''))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The other players in the commune, and the invitations they send.
  const [players, setPlayers] = useState<{ focus: string | null } | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  // The camera dragged away from the Sim, and the way back.
  const [freeCam, setFreeCam] = useState(false)
  const [recenter, setRecenter] = useState(0)
  // The real streets (open world): from Mapbox with a token, else from
  // OpenFreeMap (no key). Never the old classic street (only ?classic, for developers): a map that
  // loads badly says so and keeps trying.
  const [classic] = useState(() => import.meta.env.DEV && new URLSearchParams(location.search).has('classic'))
  const [mapSlow, setMapSlow] = useState(false)
  // The commune's places from the map, as the open world loads them around the Sim.
  const [mapPlaces, setMapPlaces] = useState<Place[]>([])
  // Three views of the street: over its shoulder (third person, close behind the perso: the default, as in
  // the block games), a little further back and higher, or from above. The choice is remembered (« babi.view2 »:
  // everyone starts over the shoulder once; who had chosen the view from above keeps it).
  const [view, setView] = useState<'pres' | 'epaule' | 'haut'>(() => {
    try {
      const v = localStorage.getItem('babi.view2')
      if (v === 'pres' || v === 'epaule' || v === 'haut') return v
      return localStorage.getItem('babi.view') === 'haut' ? 'haut' : 'epaule'
    } catch {
      return 'epaule'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('babi.view2', view)
    } catch {
      /* private window */
    }
  }, [view])
  // The update « camera-vie »: everyone starts once in the close view behind the perso (whatever view was kept),
  // so a first session shows one's own perso up close; the view from above stays a button away.
  const camVie = useKeyOpen('camera-vie')
  useEffect(() => {
    if (!camVie) return
    try {
      if (localStorage.getItem('babi.view3')) return
      localStorage.setItem('babi.view3', '1')
    } catch {
      return
    }
    setView('epaule')
  }, [camVie])
  const closeView = view !== 'haut'
  const NEXT_VIEW = { epaule: 'pres', pres: 'haut', haut: 'epaule' } as const
  // The calmer screen (update « ecran-simple », components/SimpleHud.tsx): « Moi » and the commune's grin, opened from its bar and strip.
  const [moiOpen, setMoiOpen] = useState(false)
  const [grinOpen, setGrinOpen] = useState(false)
  // The week's rendez-vous (update « rendez-vous »): opened from Gbairai's strip, anywhere (components/RendezVous.tsx).
  useEffect(() => {
    const open = () => (setGrinOpen(false), setPhoneDirect(false), setPhoneApp('rendezvous'), setOverlay('phone'))
    window.addEventListener(RENDEZVOUS_OPEN, open)
    return () => window.removeEventListener(RENDEZVOUS_OPEN, open)
  }, [])
  const hud = useRef<HudActs>(null)
  const [whereTo, setWhereTo] = useState(false)
  // « Où aller ? » opened on a place out of town (game/far.ts: the next goal's « Y aller » to the N'Zi's reserve).
  const [farPick, setFarPick] = useState<string | null>(null)
  const announced = useRef('')

  useEffect(() => {
    // Asked ahead while the game's code came (lib/fastStart.ts, update « demarrage-rapide »), else now.
    const ahead = takeStart()
    ;(ahead ? ahead.sims.catch(() => api.sims()) : api.sims()).then(async (sims) => {
      if (!sims.length) return navigate('/creer', { replace: true })
      const early = ahead && (await ahead.sim.catch(() => null))
      const res = early && early.sim.id === sims[0].id ? early : await api.sim(sims[0].id)
      setBase({ sim: res.sim, at: Date.now() })
      setJournal(res.journal)
      setSeen(res.journal[0]?.id ?? 0)
      announce(res.fresh)
    })
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // The same account open on another device (or this one): whatever changes there shows here, at once;
  // and coming back to the game (the phone woken up, the tab shown again), the latest.
  const simId = base?.sim.id
  useEffect(() => {
    if (!simId) return
    let pending: ReturnType<typeof setTimeout> | null = null
    const reload = () => {
      if (pending) return
      pending = setTimeout(() => {
        pending = null
        api
          .sim(simId)
          .then((res) => {
            setBase({ sim: res.sim, at: Date.now() })
            setJournal(res.journal)
          })
          .catch(() => undefined)
      }, 300)
    }
    const changed = (e: Event) => {
      if ((e as CustomEvent<string>).detail === simId) reload()
    }
    // Put away (another app, the screen off, the tab hidden, closed): the Sim held from that very
    // moment, nothing advances until it's played again; back, the latest.
    const shown = () => {
      if (document.visibilityState === 'visible') reload()
      else void api.pause(simId).catch(() => undefined)
    }
    const gone = () => void api.pause(simId).catch(() => undefined)
    window.addEventListener(SIM_CHANGED, changed)
    document.addEventListener('visibilitychange', shown)
    window.addEventListener('pagehide', gone)
    return () => {
      window.removeEventListener(SIM_CHANGED, changed)
      document.removeEventListener('visibilitychange', shown)
      window.removeEventListener('pagehide', gone)
      if (pending) clearTimeout(pending)
    }
  }, [simId])

  // The game runs on real time; between server round-trips the clock, needs
  // and the current activity advance locally, minute by minute. Without network too: the phone
  // plays the Sim as the server would (lib/offlinePlay.ts) and sends it all once back online.
  const online = useOnline()
  const sim = useMemo(() => {
    if (!base) return null
    const mins = Math.max(0, (now - base.at) / 60000)
    const gameMinutes = base.sim.gameMinutes + mins
    // Growing up by milestones (backend sims/grandir.go): the baby's, the child's age waits at the edge of its stage.
    const hold = base.sim.growHold
    const bornAt = hold && base.sim.bornAt && gameMinutes - base.sim.bornAt > hold ? gameMinutes - hold : base.sim.bornAt
    return { ...base.sim, gameMinutes, bornAt, needs: predict(base.sim, mins) }
  }, [base, now])
  // One's own office and gang's tag (politics): over the name in the street, by it on the HUD; read again when the phone closes.
  const [mine, setMine] = useState<{ title?: string; crew?: string }>({})
  useEffect(() => {
    const id = sim?.id
    if (!id || phoneApp) return
    let gone = false
    api
      .politics(id)
      .then((p) => !gone && setMine({ title: p.offices[0]?.label, crew: p.crew?.tag }))
      .catch(() => undefined)
    return () => {
      gone = true
    }
  }, [sim?.id, phoneApp]) // eslint-disable-line react-hooks/exhaustive-deps
  // What was played offline, counted by the server: its Sim (the toasts were shown as it was played).
  useEffect(
    () =>
      onSynced((res, late) => {
        if (!late) {
          setBase({ sim: res.sim, at: Date.now() })
          setJournal(res.journal)
        }
        toast({ tone: 'done', title: tr('De retour en ligne'), text: res.outcome.text, money: 0 })
      }),
    [],
  )
  // The network back: the Sim as the server has it (what was played offline sent first).
  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current && base) {
      const played = pendingOffline()
      void api.sim(base.sim.id).then(apply, () => undefined)
      if (!played) toast({ tone: 'done', title: tr('De retour en ligne'), text: tr('Ton perso reprend sa vie.'), money: 0 })
    }
    wasOnline.current = online
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps
  // Another commune, another street: the door one stood at is gone (the new street's walker
  // starts with nothing near, so it never says so), or « Chez toi » was offered in Plateau.
  useEffect(() => setNear(null), [sim?.city, sim?.commune])

  // When the activity's end comes, ask the server to settle it (pay, surprises).
  const settling = useRef(false)
  const ended = !!sim?.activity && sim.gameMinutes >= sim.activity.end
  useEffect(() => {
    if (!ended || !base || settling.current) return
    settling.current = true
    api
      .sim(base.sim.id)
      .then(apply)
      .catch(() => undefined)
      .finally(() => (settling.current = false))
  }, [ended]) // eslint-disable-line react-hooks/exhaustive-deps
  // The action picked in a place done (its time up, stopped, or over at once): back in that place, if
  // the Sim is still there (not walked off, not gone elsewhere), its menu or its room to pick another.
  const doingAt = sim?.activity?.kind === 'do' ? (sim.activity.placeId ?? null) : null
  // The place of the action under way, from the action itself: its end brings the Sim back in
  // there too when it wasn't picked on this page (the app opened again during a night's sleep,
  // the Sim's own life).
  const lastAt = useRef<string | null>(null)
  useEffect(() => {
    if (!doingAt || !sim) return
    const known = (id: string) => world.cities.find((c) => c.id === sim.city)?.communes.find((c) => c.id === sim.commune)?.places.some((p) => p.id === id) || mapPlaces.some((p) => p.id === id)
    lastAt.current = doingAt === 'home' || known(doingAt) ? doingAt : null
  }, [doingAt]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pending || doingAt) return
    const was = backTo ?? lastAt.current
    lastAt.current = null
    if (!was) return
    setBackTo(null)
    const door = whereabouts.places.find((p) => p.id === was)?.door
    if (was === 'home' || !door || Math.hypot(door[0] - whereabouts.sim[0], door[1] - whereabouts.sim[1]) < (LANDMARKS[was] ?? 0) + 25) setPlaceId(was)
  }, [backTo, pending, doingAt]) // eslint-disable-line react-hooks/exhaustive-deps
  // At home (in the house, or doing something there): kept on the device, so the Sim is still
  // home when the game opens again after the action is over (a night's sleep, the app closed).
  const inHome = placeId === 'home' || doingAt === 'home'
  const restored = useRef<string | null>(null)
  useEffect(() => {
    if (!sim) return
    const key = `babi.chezToi.${sim.id}`
    if (restored.current !== sim.id) {
      restored.current = sim.id
      let was: string | null = null
      try {
        was = localStorage.getItem(key)
      } catch {
        // (No storage here: the street, as before.)
      }
      if (was && !sim.activity && !placeId && sim.city === sim.homeCity && sim.commune === sim.homeCommune) return setPlaceId('home')
    }
    try {
      if (inHome) localStorage.setItem(key, '1')
      else localStorage.removeItem(key)
    } catch {
      // (Idem.)
    }
  }, [sim?.id, inHome]) // eslint-disable-line react-hooks/exhaustive-deps
  // The séance over (or left): the film's screen with it.
  const filmOn = sim?.activity?.kind === 'do' ? (sim.activity.seance?.video ?? null) : null
  useEffect(() => {
    if (!filmOn) setWatching(false)
  }, [filmOn])
  // And every minute anyway: Saturdays, a long nap, another tab. Only while the game is in sight:
  // these say the player is there (a minute without, the Sim's life goes on hold: backend sims/clock.go).
  useEffect(() => {
    if (!base) return
    const t = setInterval(() => !document.hidden && api.sim(base.sim.id).then(apply).catch(() => undefined), 60000)
    return () => clearInterval(t)
  }, [base?.sim.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const slot = sim ? Math.floor(sim.gameMinutes / 120) : -1
  const where = sim?.commune
  const whereCity = sim?.city
  useEffect(() => {
    if (!where || slot < 0) return
    let live = true
    api
      .happening(whereCity ?? '', where, slot * 120 + 1)
      .then((now) => {
        if (!live) return
        setStreet(now)
        // Announce each happening once (state updaters may run twice, so not in one).
        const h = now.happening
        const key = h ? `${where}|${now.start}|${h.id}` : ''
        if (h && announced.current !== key) {
          announced.current = key
          const name = world.cities.flatMap((c) => c.communes).find((c) => c.id === where)?.name ?? ''
          setTimeout(() => toast({ tone: 'event', title: tr('Ça se passe {0} !', { 0: aCommune(name) }), text: h.text, money: 0, icon: h.icon }), 300)
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [where, slot, streetAsk]) // eslint-disable-line react-hooks/exhaustive-deps
  // Arrived (or still walking) after it ended: say so instead of opening nothing.
  useEffect(() => {
    if (placeId === 'happening' && street && !street.happening) {
      setPlaceId(null)
      toast({ tone: 'error', title: tr("C'est fini !"), text: tr('Tu es arrivé·e trop tard, tout le monde est rentré.'), money: 0 })
    }
  }, [placeId, street]) // eslint-disable-line react-hooks/exhaustive-deps
  const happening = useMemo(() => (street?.happening ? { id: street.happening.id, icon: street.happening.icon, label: street.happening.label, cleared: street.cleared !== undefined } : null), [street])

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .news()
        .then(({ items }) => {
          const top = items[0]
          if (!top || sessionStorage.getItem('babi-flash') === top.id) return
          sessionStorage.setItem('babi-flash', top.id)
          toast({ tone: 'event', title: tr('Flash info · {label}', { label: topicOf(top.topic).label }), text: `${top.title} (${top.source})`, money: 0, icon: 'newspaper' })
        })
        .catch(() => undefined)
    }, 4000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Les dames: who's asked (a man of the grin, a friend) and for how much; the board open.
  const [damesAsk, setDamesAsk] = useState<{ with: string; name: string; max: number } | null>(null)
  const [damesOpen, setDamesOpen] = useState(false)
  const [damesSeen, setDamesSeen] = useState<number[]>([])
  // 8 américain: who's asked (a table of the game's players, a friend) and for how much; the table open.
  const [huitAsk, setHuitAsk] = useState<{ with: string; name: string; npcs?: string[]; max: number } | null>(null)
  const [huitOpen, setHuitOpen] = useState(false)
  const [huitSeen, setHuitSeen] = useState<number[]>([])
  // At a slot machine (components/Machine): its screen opens as the Sim sits down at it.
  const [machineOpen, setMachineOpen] = useState(false)
  const machineAt = sim?.activity?.kind === 'do' && isSlots(sim.activity.interaction.id) ? sim.activity.start : null
  useEffect(() => setMachineOpen(machineAt !== null), [machineAt])
  // In a boutique: the shop's pieces, open as one starts shopping (components/ClothesShop).
  const [shopOpen, setShopOpen] = useState(false)
  // The fridge (components/Fridge): filled while shopping, opened at home.
  const [fridgeOpen, setFridgeOpen] = useState<'fill' | 'open' | null>(null)
  // The friends' gifts (components/GiftDrawer, update « parrainage »): the drawer at home, the phone's « Inviter ».
  const gifts = useFriendGifts(sim?.id)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const feats = useFeatures()
  // A lighter start (update « demarrage-rapide »): the game's screen as soon as the Sim is there, the street's 3D coming behind it.
  const fastStart = useFastStart()
  const streetReady = useStreetCode()
  const shopAt = sim?.activity?.kind === 'do' && SHOP_OF[sim.activity.interaction.id] ? sim.activity.start : null
  useEffect(() => setShopOpen(shopAt !== null), [shopAt])
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts.slice(-1), { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000)
  }, [])

  // Sharing (lib/share.ts): who sends, what's being sent, a défi taken on (also from a link: /jeu?defi=…).
  const { sharing, challenge, share: shareThis, challengeWith } = useShare()
  const applyNow = useRef(apply)
  applyNow.current = apply
  useEffect(() => {
    if (sim) useShare.setState({ simId: sim.id, firstName: sim.firstName, apply: (r) => applyNow.current(r) })
  }, [sim?.id, sim?.firstName]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = challengeInAddress()
    if (!c) return
    challengeWith(c)
    history.replaceState(null, '', location.pathname)
  }, [challengeWith])
  function apply(res: ActionResult) {
    // Le mode vie: the skills that rose pop over the scene (« +cuisine »).
    skillsRose(base?.sim, res.sim)
    setBase({ sim: res.sim, at: Date.now() })
    setJournal(res.journal)
    announce(res.fresh)
  }

  /** Toasts for what happened since the last request: activities that ended, surprises, bills. */
  function announce(fresh: JournalEvent[]) {
    const bills = fresh.filter((e) => e.kind === 'bill' && e.text.startsWith('Samedi'))
    const rest = fresh.filter((e) => !bills.includes(e))
    rest.forEach((e, i) =>
      setTimeout(() => {
        // The player's Sim takes the news on its face (avatar/expressions.ts).
        const face: Expression | null = e.kind === 'robbed' ? 'scared' : e.kind === 'random' ? (e.money < 0 ? 'disappointed' : 'surprised') : e.kind === 'career' ? 'proud' : e.kind === 'errand' && e.money > 0 ? 'smile' : e.kind === 'life' && /anniversaire/i.test(e.text) ? 'laugh' : e.kind === 'bill' ? 'meh' : null
        if (face) setExpression('me', face, 4500)
        if (e.kind === 'robbed') toast({ tone: 'random', title: tr('Les nouchis du couloir !'), text: e.text, money: e.money })
        else if (e.kind === 'random') toast({ tone: 'random', title: tr('Imprévu !'), text: e.text, money: e.money })
        else if (e.kind === 'career') toast({ tone: 'promo', title: tr('Promotion !'), text: e.text.replace(/^Promotion ! /, ''), money: 0 })
        // A demande of the quartier: a step done, or the thanks and what was given (sims/errands.go).
        else if (e.kind === 'errand') toast({ tone: e.money > 0 ? 'promo' : 'event', title: e.money > 0 ? tr('Demande accomplie !') : tr('Demande du quartier'), text: e.text, money: e.money, icon: 'hand-heart' })
        // A skill's level reached (le mode vie, backend sims/vie.go): proud.
        else if (e.kind === 'skill') (setExpression('me', 'proud', 4000), toast({ tone: 'promo', title: tr('Compétence'), text: e.text, money: 0, icon: 'star' }))
        // A wish fulfilled (le mode vie, backend sims/envies.go): the burst in the middle, a cheer, a laugh, the sound.
        else if (e.kind === 'wish') {
          const w = parseWish(e.text)
          wishBurst(w.label, w.points)
          setExpression('me', 'laugh', 3500)
          sfx.win()
          haptic('success')
          if (!sim?.activity && !emoteNow.pose) playEmote('cheer', 1.8)
        } else if (e.kind === 'perk') toast({ tone: 'promo', title: tr('Récompense'), text: e.text, money: 0, icon: 'star' })
        else if (e.kind === 'travel') toast({ tone: 'done', title: tr('Bien arrivé·e !'), text: e.text, money: e.money, icon: 'car-taxi-front', kind: 'transport' })
        // Life news (a birthday's pocket money, coming of age): its own toast, not the activity that just ended.
        else if (e.kind === 'life') toast({ tone: 'event', title: /anniversaire/i.test(e.text) ? tr('Joyeux anniversaire !') : tr('Dans ta vie'), text: e.text, money: e.money, icon: 'cake' })
        else toast({ tone: 'done', title: tr('Terminé'), text: e.text, money: e.money })
      }, 300 + i * 700),
    )
    if (bills.length) setTimeout(() => toast({ tone: 'random', title: tr('Samedi, jour du loyer'), text: bills.map((b) => b.text).join(' '), money: bills.reduce((t, b) => t + b.money, 0) }), 300 + rest.length * 700)
  }

  // Talking to someone in the street (and who, while the chat lasts).
  const [chat, setChat] = useState<Npc | null>(null)
  const talkedTo = useRef<string | null>(null)
  // Anyone tapped anywhere (a maquis, a club, a hotel lobby: world3d/talk.ts) opens the same chat at once;
  // they wave, and in the street the Sim walks up to them and greets them as fits (world3d/meet.ts).
  const meetSim = useRef(sim)
  meetSim.current = sim
  const meet = (npc: Npc, where?: Where, direct = false) => {
    // Le mode vie (update « mode-vie »): papa, maman or anyone met tapped, the wheel of what to say, as close as they are (components/LifeHome.tsx).
    if (!direct && lifeListening()) return tapPerson(npc, where)
    setChat(npc)
    npcReact(npc.id, 'hello', 1.6)
    const s = meetSim.current
    if (!where || !s || !world) return
    walkUpTo(npc.id, where, greetingFor(npc.id, npc.gender, s.gender, lifeOf(world, s).stage?.id ?? 'adulte', s.friends?.find((f) => f.id === `p-${npc.id}`)))
  }
  // A word with papa or maman queued in le mode vie: the Sim walks up, they greet each other, it's said
  // (the ordinary chat request: backend sims/parents.go), they answer, and a moment after it's over.
  const lifeTalk = async (npc: Npc, where: Where | undefined, topic: string) => {
    const s = meetSim.current
    if (!s || !world) return
    setTalking(npc.id)
    npcReact(npc.id, 'hello', 1.6)
    if (where) walkUpTo(npc.id, where, greetingFor(npc.id, npc.gender, s.gender, lifeOf(world, s).stage?.id ?? 'adulte'))
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const t0 = performance.now()
    while (where && meeting.id === npc.id && !meeting.greeted && performance.now() - t0 < 7000) await wait(250)
    try {
      const res = await api.chat(s.id, { id: npc.id, name: npc.name, gender: npc.gender, seed: npc.seed, look: npc.look }, topic)
      apply(res)
      const { text, money, mood } = res.outcome
      if (mood) npcReact(npc.id, mood, 3.2)
      setSpeaking(npc.id, Math.min(4000, 600 + text.length * 40))
      chatFaces(npc.id, topic, mood)
      toast({ tone: 'done', title: npc.name, text, money, kind: 'social', icon: 'messages-square' })
      await wait(3200)
    } catch (e) {
      toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : tr('Pas possible'), text: errorText(e, tr('Erreur')), money: 0 })
    } finally {
      setTalking(null)
    }
  }
  const meetRef = useRef(meet)
  meetRef.current = meet
  useEffect(() => setTalkHandler((npc, where) => meetRef.current(npc, where)), [])
  useEffect(() => setTalking(chat?.id ?? null), [chat?.id])
  // What they answer stays in the chat sheet (no toast), and they react to it.
  const say = async (topic: string, label: string, phrase?: string, lang?: string): Promise<Reply | null> => {
    const npc = chat!
    talkedTo.current = npc.id
    try {
      const res = await api.chat(sim!.id, { id: npc.id, name: npc.name, gender: npc.gender, seed: npc.seed, look: npc.look }, topic, phrase, lang)
      apply(res)
      const { text, money, mood } = res.outcome
      if (mood) npcReact(npc.id, mood, mood === 'bye' ? 2.5 : 3.2)
      // Their faces (avatar/expressions.ts): they answer (the mouth moves), and how it went shows on both.
      setSpeaking(npc.id, Math.min(4000, 600 + text.length * 40))
      chatFaces(npc.id, topic, mood)
      if (money) toast({ tone: 'done', title: label, money, kind: 'social', icon: 'messages-square' })
      return { text, mood }
    } catch (e) {
      toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : tr('Pas possible'), text: errorText(e, tr('Erreur')), money: 0 })
      return null
    }
  }

  // « Au revoir », « À plus » once they've said goodbye, or the sheet shut: the chat is over there and then
  // (the talk with them stops; no Sim and passer-by left face to face, still « discussing »).
  const endChat = () => {
    const npc = chat
    if (!npc) return
    const a = sim?.activity
    if (sim && a?.kind === 'do' && a.placeKind === 'chat' && a.placeName === npc.name) void api.stop(sim.id).then(apply, () => undefined)
    npcReact(npc.id, 'bye', 2.5)
    talkedTo.current = null
    setChat(null)
  }

  // What the player typed themselves (an update: parler-libre): answered in the passer-by's own words (backend sims/chatfree.go).
  const features = useFeatures()
  const sayFree = async (text: string, about: FreeTalk): Promise<Reply | null> => {
    const npc = chat!
    talkedTo.current = npc.id
    try {
      const res = await api.chatFree(sim!.id, { id: npc.id, name: npc.name, gender: npc.gender, seed: npc.seed, look: npc.look }, text, about)
      apply(res)
      const { text: answer, mood } = res.outcome
      if (mood) npcReact(npc.id, mood, mood === 'bye' ? 2.5 : 3.2)
      return { text: answer, mood }
    } catch (e) {
      toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : tr('Pas possible'), text: errorText(e, tr('Erreur')), money: 0 })
      return null
    }
  }

  const run: Act = async (label, icon, kind, call) => {
    setPending({ label, icon, kind })
    try {
      const res = await call()
      apply(res)
      if (res.outcome.text) toast({ tone: 'done', title: res.outcome.text, money: res.outcome.money, kind, icon })
      if (kind === 'social') refreshPlayers()
      return true
    } catch (e) {
      toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : tr('Pas possible'), text: errorText(e, tr('Erreur')), money: 0 })
      return false
    } finally {
      setPending(null)
    }
  }

  /**
   * Le mode vie with another player (update « mode-vie », backend sims/playersocial.go): their Sim tapped, in
   * the street or in a place, opens the wheel of what can be said to them, as the server says from your bond
   * (friendship, romance, fallen out, together; romance only as the couple's rules allow). A choice is said
   * at once; both feel it, and they're told. « Son profil » opens their card as before.
   */
  const playerPie = async (id: string) => {
    const s = meetSim.current
    const p = around.players.find((x) => x.id === id)
    if (!s || !p || p.npc) return setPlayers({ focus: id })
    const at = { x: lastTap.x, y: lastTap.y }
    try {
      const r = await api.playerSocials(s.id, id)
      const colors = (t: string): [string, string] => (t === 'disputer' ? ['#9aa0b4', '#3b3f52'] : ['#ff8fb1', '#e0245e'])
      const options: PieOption[] = r.options
        .filter((o) => !o.why && socialOf(o.topic))
        // (The deep ones first, to the wheel's top, as with the people of the game: game/vie.ts socialsFor.)
        .sort((a, b) => DEEP.indexOf(b.topic) - DEEP.indexOf(a.topic))
        .slice(0, 7)
        .map((o) => {
          const x = socialOf(o.topic)!
          const say = () => {
            setExpression('me', 'grin', 1800)
            if (o.topic === 'sortir') return void run(tr('Sortir ensemble'), 'heart', 'social', () => api.couple(s.id, id, 'proposer'))
            void run(x.label, x.icon, 'social', () => api.playerSocial(s.id, id, o.topic)).then((ok) => ok && setExpression('me', o.topic === 'disputer' ? 'annoyed' : 'laugh', 2500))
          }
          return { id: o.topic, label: x.label, icon: x.icon, colors: colors(o.topic), order: { kind: 'act' as const, id: o.topic, label: x.label, icon: x.icon, colors: colors(o.topic) }, run: say }
        })
      options.push({ id: 'profil', label: tr('Son profil'), icon: 'users', colors: ['#8fd3ff', '#2b7bd6'], order: { kind: 'act', id: 'profil', label: '', icon: '', colors: ['#8fd3ff', '#2b7bd6'] }, run: () => setPlayers({ focus: id }) })
      openPie({ ...at, title: `${p.firstName} · ${STATUS[r.bond.status].label}`, options })
    } catch {
      setPlayers({ focus: id })
    }
  }
  const playerPieRef = useRef(playerPie)
  playerPieRef.current = playerPie
  const lifeOpen = !!sim && keyOpen(feats, 'mode-vie')
  useEffect(() => {
    if (!lifeOpen) return
    setPlayerTap((id) => playerPieRef.current(id))
    return () => setPlayerTap(null)
  }, [lifeOpen])

  /** A game of dames: against a man of the grin (`with` 'npc', his name) or a friend, for the stake picked. */
  const startDames = async (ask: { with: string; name: string }, stake: number) => {
    setDamesAsk(null)
    const ok = await run(tr('Une partie de dames'), 'crown', 'social', () => api.damesStart(sim!.id, ask.with === 'npc' ? { with: 'npc', npc: ask.name, stake } : { with: ask.with, stake }))
    if (ok) setDamesOpen(true)
  }
  /** A game of 8 américain: at a table of the game's players (`with` 'npc', their names) or against a friend, for the stake picked. */
  const startHuit = async (ask: { with: string; npcs?: string[] }, stake: number) => {
    setHuitAsk(null)
    const ok = await run(tr('Une partie de 8 américain'), 'sparkles', 'social', () => api.huitStart(sim!.id, ask.with === 'npc' ? { with: 'npc', npcs: ask.npcs, stake } : { with: ask.with, stake }))
    if (ok) setHuitOpen(true)
  }
  const walkTo = (id: string) => {
    setOverlay(null)
    setGoTo({ placeId: id, nonce: Date.now() })
  }
  // Out of the house into the street. A baby goes in its pram: maman pushes it, or papa if she's cleaning;
  // both at it, it waits (world3d/carer.ts).
  const goOut = () => {
    if (sim && lifeOf(world, sim).stage?.id === 'bebe' && !pusher()) {
      toast({ tone: 'random', title: tr('Pas tout de suite'), text: tr('Maman et papa sont en train de nettoyer. Attends un peu pour sortir en poussette !'), money: 0 })
      return
    }
    setPlaceId(null)
    setBackTo(null)
    setOutside(false)
  }
  /** auto: left to play by itself, its game not played (le mode vie, update « mode-vie »). */
  const interact = (it: Interaction, kind: string, auto = false, from?: string) => {
    const id = from ?? placeId!
    setPlaceId(null)
    setOutside(false)
    setBackTo(id)
    // Already doing something at the zoo (or the hotel's grounds): it gives way to the new thing.
    const there = sim!.activity?.kind === 'do' && sim!.activity.placeId === id && GROUNDS.has(id)
    // Without network the phone plays it: what it is at this place.
    const at = id === 'home' ? { kind: 'home', name: tr('Chez toi') } : commune.places.find((p) => p.id === id)
    if (at) picking(id, it, { kind: at.kind, name: at.name })
    // A baby's mess: maman cleans it (papa, if she's at one already); the pram waits for whoever is free.
    if (id === 'home' && /^(caca|pipi|vomir)$/.test(it.id)) startCleaning()
    return run(it.label, it.icon, kind, async () => {
      if (there) await api.stop(sim!.id)
      return api.interact(sim!.id, id, it.id, auto)
    })
  }
  // The ride shows on the map: the route, and the taxi moving along it.
  // In town, a ride is arranged first (hailed at the roadside, or an app
  // driver coming); the trip starts once the Sim is in the car. The ride
  // shows on the map: the route, and the taxi moving along it.
  const travel = (cityId: string, communeId: string, label: string, ride?: Ride, fare = 0) => {
    setPlaceId(null)
    setOverlay('map')
    const fromCity = world.cities.find((x) => x.id === sim!.city)!
    const from = fromCity.communes.find((x) => x.id === sim!.commune)!
    const to = world.cities.find((x) => x.id === cityId)?.communes.find((x) => x.id === communeId)
    // One's own vehicle (the Bolide app): no one to wait for, the Sim drives off at once. Driven
    // here, its petrol so far is settled first; left parked somewhere, it comes along (it's the one driven).
    if (ride?.vehicle) {
      setOverlay(null)
      // (« ma-voiture »: left at the kerb in this commune a way off, the Sim walks to it first, then sets off.)
      const left = parkedNow()
      if (keyOpen(feats, 'ma-voiture') && !driven && left && left.sim === sim!.id && left.v.id === ride.vehicle && left.commune === sim!.commune && Math.hypot(left.x - whereabouts.sim[0], left.z - whereabouts.sim[1]) > 12) return walkToMyCar(left, () => travel(cityId, communeId, label, ride, fare))
      const was = driven
      const metres = was ? stopDrive() : 0
      if (parkedNow()?.v.id === ride.vehicle) setParked(null)
      return void run(label, 'car', 'transport', async () => {
        if (was && metres && was.id !== RENTED) await api.garageAct(sim!.id, 'drive', { vehicle: was.id, metres }).catch(() => undefined)
        return api.travel(sim!.id, cityId, communeId, ride)
      })
    }
    // A flight is booked at the airport (Flights): no driver to find, straight on board.
    if (ride?.app === 'avion') return void (setOverlay(null), run(label, 'plane', 'transport', () => api.travel(sim!.id, cityId, communeId, ride)))
    // A coach ticket bought at the gare (« voyages-villes »): on board for the next departure.
    if (ride?.app === 'car') return void (setOverlay(null), run(label, 'bus', 'transport', () => api.travel(sim!.id, cityId, communeId, ride)))
    // The métro: down to the station, on the next train.
    if (ride?.app === 'metro') return void (setOverlay(null), run(label, 'train-front', 'transport', () => api.travel(sim!.id, cityId, communeId, ride)))
    // The train: on the platform, on board at its departure.
    if (ride?.app === 'train') return void (setOverlay(null), run(label, 'train-front', 'transport', () => api.travel(sim!.id, cityId, communeId, ride)))
    // A moto-taxi: one stops right away, the Sim gets on behind.
    if (ride?.app === 'moto') return void (setOverlay(null), run(label, 'bike', 'transport', () => api.travel(sim!.id, cityId, communeId, { app: 'moto' })))
    // The woro-woro, the taxi compteur, the gbaka: waited for at the roadside, the one chosen.
    if (ride?.app?.startsWith('street') && to) return setFlow({ cityId, from, to, kind: 'street', want: (ride.app.split(':')[1] || undefined) as StreetRide | undefined, fare, party: ride.party ?? 1, money: sim!.money, off: fareOff(world, sim!) })
    if (ride?.app && to) return setFlow({ cityId, from, to, kind: ride.app, offer: ride.offer, fare, party: ride.party ?? 1, money: sim!.money })
    run(label, 'bus', 'transport', () => api.travel(sim!.id, cityId, communeId, ride))
  }
  // To a place out of town (« Où aller ? », game/far.ts): the trip to its commune, the place remembered (the lodge
  // is walked to from the reserve's gate where the taxi sets the Sim down).
  const farTravel =
    (spot: FarSpot): OnTravel =>
    (...a) => {
      setTripThen(spot.back ? null : { cityId: spot.cityId, communeId: spot.communeId, placeId: spot.id, name: spot.name })
      setWhereTo(false)
      setFarPick(null)
      travel(...a)
    }
  const board = (ride: Ride, label: string) => {
    const f = flow!
    setFlow(null)
    run(label, ride.app === 'moto' ? 'bike' : 'bus', 'transport', () => api.travel(sim!.id, f.cityId, f.to.id, ride))
  }

  // The order handed over: eaten where the Sim is, or at home (delivered there, or taken in; in the
  // house already), in the house at the table, and the Sim stays in after.
  const collect = (home = !!delivery?.home) => {
    const d = delivery!
    const inside = home || placeId === 'home'
    if (inside) {
      setPlaceId(null)
      setOutside(false)
      setBackTo('home')
    }
    run(d.dish.label, d.dish.icon, 'eat', () => api.order(sim!.id, d.place.id, d.dish.id, inside)).then((ok) => ok && setDelivery(null))
  }

  // Building one's house on the plot; the houses are fetched again after.
  const moto = useMoto()
  // The tuto for a beginner (components/Tutorial.tsx), or asked for again from the Encyclo.
  const [tuto, setTuto] = useState(beginner)
  // After the tuto, « Ta première histoire » (components/FirstStory.tsx).
  const [firstStory, setFirstStory] = useState(false)
  const endFirstStory = useCallback(() => setFirstStory(false), [])
  // Started with the tuto: the two old first tips (FirstSteps) aren't needed after it.
  const [firstTime] = useState(beginner)
  const tutoAsked = useTutorialAsked()
  // The arrival before it (update « arrivee », components/Arrival.tsx): the flight over the commune, the welcome, Awa.
  const [arriving, setArriving] = useState(() => beginner() && arrivalDue())
  // Which part of it: while it waits for the street and flies over it, the street is what's shown (not the inside).
  const [arrivalPart, setArrivalPart] = useState<ArrivalPart | null>(null)
  const arrivalPlot = useRef<{ key: string; plot?: Plot } | null>(null)
  // A baby's « premières fois » and its choices (updates « premieres-fois », « choix-bebe »): fetched again as actions start and end.
  const isBaby = !!sim && !!world && lifeOf(world, sim).stage?.id === 'bebe'
  // The robberies (update « braquages »): wanted after a job got away with.
  const braquage = useBraquage(sim?.id ?? '', keyOpen(features, 'braquages') && !!sim, `${sim?.activity?.start ?? ''}${journal[0]?.id ?? ''}`)
  const [firstsView, setFirstsView] = useFirsts(sim?.id ?? '', isBaby, `${sim?.activity?.interaction.id ?? ''}${sim?.activity?.start ?? ''}${journal[0]?.id ?? ''}`)
  const firstsShown = isBaby
  // Growing up by milestones (backend sims/grandir.go): the child's « étapes », fetched again as actions start and end and as it ages.
  const lifeNow = sim && world ? lifeOf(world, sim) : null
  const stepsView = useSteps(sim?.id ?? '', lifeNow?.stage?.id === 'enfant', `${sim?.activity?.interaction.id ?? ''}${sim?.activity?.start ?? ''}${lifeNow?.age ?? ''}${journal[0]?.id ?? ''}`)
  // The next thing to do (components/NextGoal.tsx): under the mini-map, a tap and the Sim goes.
  const nextGoal = useNextGoal(sim, `${sim?.activity?.start ?? ''}${journal[0]?.id ?? ''}${Math.floor((sim?.gameMinutes ?? 0) / 30)}`)
  // The place a trip was for, when it landed elsewhere (game/far.ts): the coach from Abidjan at Bouaké's gare, for the
  // N'Zi's reserve, says the next step (the taxi out there); the taxi at the reserve's gate, for the lodge, walks on to it.
  const then = useTripThen()
  const far = then && sim && world && sim.city === then.cityId && sim.commune !== then.communeId ? farOf(world, sim, then.placeId) : null
  const goal: Goal | null = far && then ? { icon: MapPin, label: tr('Prochaine étape'), text: tr('{name} · à {km} km', { name: then.name, km: far.km }), color: '#0ca678', go: { kind: far.kind, place: far.id } } : nextGoal
  // (The place to walk on to, kept apart: forgetting the trip re-renders, and must not stop the wait.)
  const walkOn = useRef<string | null>(null)
  useEffect(() => {
    if (!then || !sim || sim.activity || sim.city !== then.cityId || sim.commune !== then.communeId) return
    setTripThen(null)
    if (then.placeId !== ARRIVE_AT[sim.commune]) walkOn.current = then.placeId
  }, [then, sim?.city, sim?.commune, !!sim?.activity]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!walkOn.current) return
    // (Once the street has set it down at the gate, the map closed: the streets out there take a while to stand.)
    let tries = 0
    const t = setInterval(() => {
      const id = walkOn.current
      if (!id || ++tries > 180) return void (clearInterval(t), (walkOn.current = null))
      // (Arrived in one's own vehicle, « ma-voiture »: once it's parked by the place.)
      if (overlayRef.current || parkingOwn.current || !whereabouts.places.some((p) => p.id === id)) return
      walkOn.current = null
      clearInterval(t)
      setTimeout(() => setGoTo({ placeId: id, nonce: Date.now() }), 1500)
    }, 500)
    return () => clearInterval(t)
  }, [sim?.commune, !!sim?.activity]) // eslint-disable-line react-hooks/exhaustive-deps
  // The stage reached by milestones (or bought): the family's party in the courtyard (components/GrowUpParty.tsx).
  const [growParty, setGrowParty] = useState<'enfant' | 'ado' | null>(null)
  const lastStage = useRef('')
  const stageKey = sim && lifeNow?.stage ? `${sim.id}:${lifeNow.stage.id}` : ''
  useEffect(() => {
    const was = lastStage.current
    lastStage.current = stageKey
    if (!was || !stageKey) return
    const [wasSim, wasStage] = was.split(':')
    const [simNow, stageNow] = stageKey.split(':')
    if (wasSim === simNow && ((wasStage === 'bebe' && stageNow === 'enfant') || (wasStage === 'enfant' && stageNow === 'ado'))) setGrowParty(stageNow)
  }, [stageKey])
  const [choiceShut, setChoiceShut] = useState('')
  // A Gbairai message arriving (the update « sonnerie-gbairai », lib/live.ts): the ring, a buzz, the phone button
  // shaking, and a dot on it until the phone is opened.
  const [buzz, setBuzz] = useState(0)
  const [newMsgs, setNewMsgs] = useState(0)
  // The phone opened straight on Gbairai (its own button): closing the app goes back to the game.
  const [phoneDirect, setPhoneDirect] = useState(false)
  useEffect(() => {
    const on = () => {
      sfx.ring()
      haptic('medium')
      try {
        navigator.vibrate?.([70, 50, 70])
      } catch {
        /* not on this device */
      }
      setBuzz(Date.now())
      setNewMsgs((n) => n + 1)
    }
    window.addEventListener(MESSAGE_IN, on)
    return () => window.removeEventListener(MESSAGE_IN, on)
  }, [])
  // The baptism (the update « bapteme »): asked once a baby is in the game.
  const [baptism, setBaptism] = useState(false)
  const babyNow = !!sim && !!world && lifeOf(world, sim).stage?.id === 'bebe'
  useEffect(() => {
    if (!sim || !babyNow || !keyOpen(features, 'bapteme')) return
    let gone = false
    api
      .baptismDue(sim.id)
      .then((r) => !gone && setBaptism(r.due))
      .catch(() => undefined)
    return () => void (gone = true)
  }, [sim?.id, babyNow, features]) // eslint-disable-line react-hooks/exhaustive-deps
  // The tuto's chapter for the Sim's age: growing up at home, or an adult's life (the second one comes by itself at 18).
  const tutoChapter = sim && lifeOf(world, sim).minor ? 'enfance' : 'adulte'
  const grownNow = tutoChapter === 'adulte'
  // A défi taken on during the activity (components/Defi.tsx): the one going on.
  const [defi, setDefi] = useState<DefiKind | null>(null)
  // The activity a défi is played over, kept while its sheet is open: the score sent ends the activity
  // (the server's advanceTo), and the sheet must stay to say what came of it (the roadblock's papers…).
  const defiAct = useRef<NonNullable<Sim['activity']> | null>(null)
  if (!defi) defiAct.current = null
  else if (sim?.activity) defiAct.current = sim.activity
  // A job's task being played (its own little game, components/defi/jeux): then sent with its score.
  const [taskGame, setTaskGame] = useState<{ t: JobTask; resolve: (o: ActionResult['outcome']) => void; reject: (e: unknown) => void } | null>(null)
  // One of the phone's « Jeux », played for practice.
  const [practice, setPractice] = useState<DefiKind | null>(null)
  // At the wheel of one's own vehicle (world3d/drive.ts): parked, the petrol paid on the distance.
  const driven = useDriving()
  // An ordinary building of the street gone into (world3d/visit.ts): its inside, looked round, nothing to buy.
  const nearBuilding = useNearBuilding()
  const [visit, setVisit] = useState<Visitable | null>(null)
  const visitCommune = useRef(sim?.commune)
  useEffect(() => {
    if (visit && (sim?.activity || placeId || sim?.commune !== visitCommune.current)) setVisit(null)
  }, [!!sim?.activity, placeId, sim?.commune]) // eslint-disable-line react-hooks/exhaustive-deps
  const park = () => {
    const v = driven
    if (!v) return
    // It stays where it's left, against the kerb (the Walker sets it there), until the Sim gets back in.
    parkIn.commune = commune.id
    const metres = stopDrive()
    // (A hired Vélo Babi isn't the garage's: left there, BikeShare looks after it.)
    if (v.id === RENTED) return
    void run(tr('{name} garé', { name: v.name }), 'car', 'transport', () => api.garageAct(sim!.id, 'drive', { vehicle: v.id, metres }))
  }
  // One's own vehicle for the way (the update « ma-voiture »): left at the kerb a way off, the Sim walks to its
  // door first (not asked how it goes meanwhile), then it's off from where it stood.
  const walkToMyCar = (p: Parked, then: () => void) => {
    toCar.active = true
    walkToVehicle(p, () => ((toCar.active = false), setParked(null), then()))
    if (approach.to) approach.to.cancel = () => void (toCar.active = false)
  }
  /** The long way to a place, in one's own vehicle (MotoOffer's « Ma voiture »): at the wheel, the GPS taking it there. */
  const driveOwn = (c: { v: Driven; parked: Parked | null; metres: number }) => {
    const id = goTo?.placeId
    const dest = id ? [...whereabouts.places, ...whereabouts.further].find((p) => p.id === id) : undefined
    offerMoto(null)
    const go = () => {
      startDrive(c.v)
      if (dest) ((gps.to = { id: dest.id, name: dest.name, door: dest.door }), (gps.way = null))
    }
    if (c.parked && c.metres > 12) return walkToMyCar(c.parked, go)
    // A few steps away: in, and off from where it stands.
    if (c.parked) getIn.at = { x: c.parked.x, z: c.parked.z, h: c.parked.h }
    go()
  }
  // The phone's back button, in the app (lib/native.ts onBack): what's open closes first, the last
  // opened first (a défi, a game's table, the phone or the map, the places' list, a place); at the
  // wheel, the vehicle is parked. Nothing open: the app goes back a page.
  const back = useRef<() => boolean>(() => false)
  back.current = () => {
    if (defi) return (setDefi(null), true)
    if (practice) return (setPractice(null), true)
    if (huitOpen) return (setHuitOpen(false), true)
    if (machineOpen) return (setMachineOpen(false), true)
    if (shopOpen) return (setShopOpen(false), true)
    if (fridgeOpen) return (setFridgeOpen(null), true)
    if (drawerOpen) return (setDrawerOpen(false), true)
    if (damesOpen) return (setDamesOpen(false), true)
    if (overlay) return (setOverlay(null), setPhoneApp(null), true)
    if (whereTo) return (setWhereTo(false), true)
    if (driven) return (park(), true)
    if (placeId) return (setPlaceId(null), true)
    return false
  }
  useEffect(() => onBack(() => back.current()), [])
  // Something to do (an activity, a place gone into): out of the vehicle, parked.
  useEffect(() => {
    if (driven && (sim?.activity || placeId)) park()
  }, [!!sim?.activity, placeId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Gone to another commune in one's own vehicle (a « perso » trip): there, at the wheel again, the
  // GPS to take it on to a place. Kept while the trip lasts (a reload mid-way too: it's read again).
  const ownTrip = useRef<Driven | null>(null)
  // A drink at the maquis, the bar, a soirée (game/myCar.ts): no wheel for a while (« ma-voiture » offers a taxi).
  useEffect(() => {
    if (sim?.activity?.kind === 'do') noteDrink(sim.activity.interaction.icon)
  }, [sim?.activity?.start]) // eslint-disable-line react-hooks/exhaustive-deps
  // (« ma-voiture »: the short trip across town at the wheel; there, it's parked at the kerb before the place it was
  // for (or where it set down), the Sim getting out: the commune, the place, and while it's being parked.)
  const ownShort = useRef<{ commune: string; to: string; start: number; place?: string } | null>(null)
  const parkingOwn = useRef(false)
  /** The short trip's screen seen for that trip (its start): a very short one may be over by itself before. */
  const ownShown = useRef(-1)
  /** Over before its screen came: the screen at the arrival, then parked. */
  const [ownLoading, setOwnLoading] = useState<{ v: Driven; to: string; done: () => void } | null>(null)
  useEffect(() => {
    const t = sim?.activity?.kind === 'travel' ? sim.activity.trip : undefined
    if (t?.mode === 'perso' && t.vehicle) {
      const to = world?.cities.find((c) => c.id === t.city)?.communes.find((c) => c.id === t.commune)?.name ?? t.commune
      ownShort.current = keyOpen(feats, 'ma-voiture') && keyOpen(feats, 'trajet-court') && t.city === t.fromCity ? { commune: t.commune, to: then?.communeId === t.commune ? then.name : to, start: sim!.activity!.start, place: then?.communeId === t.commune ? then.placeId : undefined } : null
      return void (ownTrip.current = { id: t.vehicle.id, kind: t.vehicle.kind, body: t.vehicle.body, color: t.vehicle.color, name: t.vehicle.name, top: topSpeed(t.vehicle.top) })
    }
    const v = ownTrip.current
    if (!v || sim?.activity) return
    ownTrip.current = null
    setPlaceId(null)
    setOutside(true)
    const short = ownShort.current
    ownShort.current = null
    if (!short) return startDrive(v)
    // Once the street there stands (and the place, if it was for one): the vehicle set at the kerb by its door, and
    // parked there (the Walker pulls it in and gets the Sim out); the others see it arrive and stay.
    parkingOwn.current = true
    const parkThere = () => {
      let tries = 0
      const k = setInterval(() => {
        const door = short.place ? whereabouts.places.find((p) => p.id === short.place)?.door : undefined
        if (++tries < 4 || !whereabouts.places.length || (!door && short.place && tries < 40)) return
        clearInterval(k)
        if (door) getIn.at = { x: door[0], z: door[1], h: whereabouts.simHeading }
        startDrive(v)
        // Parked once the Walker has it on the street (it says so to the others: at the wheel).
        let waits = 0
        const w = setInterval(() => {
          if (!['drive', 'moto', 'pedal'].includes(whereabouts.simPose) && ++waits < 100) return
          clearInterval(w)
          if (waits >= 100) return void (parkingOwn.current = false)
          parkIn.commune = short.commune
          stopDrive()
          setTimeout(() => (parkingOwn.current = false), 2200)
        }, 150)
      }, 500)
    }
    if (ownShown.current === short.start) parkThere()
    else setOwnLoading({ v, to: short.to, done: parkThere })
  }, [sim?.activity?.start, sim?.commune]) // eslint-disable-line react-hooks/exhaustive-deps
  // A tap on the ground on the way to a place: asked before the way is dropped.
  const dropAsk = useDropAsk()
  // In a home booked on Dodo: the very house (a player's, as built; else the plan of its kind).
  const dodoStay = sim?.stay?.kind === 'dodo' ? sim.stay : null
  const [hostPlot, setHostPlot] = useState<Plot | null>(null)
  useEffect(() => {
    if (!dodoStay?.lot || !sim || sim.city !== dodoStay.city || sim.commune !== dodoStay.commune) return setHostPlot(null)
    void api.plots(sim.id).then((ps) => setHostPlot(ps.find((p) => p.id === dodoStay.lot) ?? null), () => undefined)
  }, [dodoStay?.lot, sim?.commune]) // eslint-disable-line react-hooks/exhaustive-deps
  const dodoPlot = useMemo<Plot | null>(() => {
    if (!dodoStay || !world) return null
    if (dodoStay.lot) return hostPlot
    const ids = DODO_PLANS[dodoStay.type ?? ''] ?? ['studio']
    const plan = world.homePlans?.[ids[(dodoStay.seed ?? 0) % ids.length]]
    return plan ? { id: 0, key: 'dodo', simId: sim!.id, blocks: plan.blocks, furniture: plan.furniture, zones: plan.zones, built: 0, lot: { w: plan.w, d: plan.d, area: plan.w * plan.d, city: dodoStay.city, commune: dodoStay.commune, paid: 0 }, livable: true } : null
  }, [dodoStay?.type, dodoStay?.seed, dodoStay?.lot, hostPlot, world]) // eslint-disable-line react-hooks/exhaustive-deps
  // Building on one of the Sim's lots (its id; 0: the one lived in, else the first), or not.
  const [building, setBuilding] = useState<number | false>(false)
  // A lot being set in the 3D world (store/lotPlace.ts): the phone and the rest put away, the world seen from above.
  const placingLot = useLotPlace((s) => !!s.placing)
  useEffect(() => {
    if (!placingLot) return
    setOverlay(null)
    setPhoneApp(null)
    setPlaceId(null)
    setBuilding(false)
  }, [placingLot])
  // Arrived at one of one's lots (« plot:<key> »): building on that one; someone else's lot has nothing to do.
  const buildAt = async (key: string) => {
    if (key !== sim?.id && !key.startsWith(`${sim?.id}:`)) return
    const lots = await api.lots(sim!.id).then((d) => d.lots, () => [])
    setBuilding(lots.find((l) => l.key === key)?.id ?? 0)
  }
  const [plotsVersion, setPlotsVersion] = useState(0)
  // The home actions done on the furniture of one's own built house (OpenWorld says which); none: no house.
  const [, setHomeSpots] = useState<string[]>([])
  // That house itself: going home opens it on a screen of its own (world3d/HomeInside).
  const [homePlot, setHomePlot] = useState<Plot | undefined>(undefined)

  // Live: the other players in the commune, every few seconds.
  const [around, refreshPlayers] = usePlayers(base?.sim.id, `${sim?.city}/${sim?.commune}`)
  // Le mode vie (backend sims/playersocial.go): what another player just said or did to this Sim, as a toast, once each.
  const socialSeen = useRef(new Set<number>())
  useEffect(() => {
    for (const e of [...(around.social ?? [])].reverse()) {
      if (socialSeen.current.has(e.id)) continue
      socialSeen.current.add(e.id)
      toast({ tone: 'event', title: tr('Un joueur'), text: e.text, money: 0, kind: 'social', icon: 'users' })
      setExpression('me', /dispute/.test(e.text) ? 'annoyed' : 'smile', 3000)
    }
  }, [around.social])
  // (The perk « file-plus »: one more order in le mode vie's queue.)
  const lifePerks = base?.sim.life?.perks?.join() ?? ''
  useEffect(() => setQueueExtra(lifePerks.split(',').includes('file-plus') ? 1 : 0), [lifePerks])
  // The soirées thrown by players here (backend sims/party.go): picking a theme for one's own.
  const [soireeAsk, setSoireeAsk] = useState(false)
  const soirees = around.parties ?? []
  const soireeOf = (id: string | null | undefined) => (id ? soirees.find((p) => `soiree:${p.id}` === id) : undefined)
  const mySoiree = soirees.find((p) => p.host === sim?.id)
  // « soiree-deco »: the room being arranged (before the soirée starts, kept for it; while it goes on, saved), and the entry.
  const decoOn = keyOpen(feats, 'soiree-deco') && !!world.soiree
  const [soireeDeco, setSoireeDeco] = useState<'draft' | 'live' | null>(null)
  const [soireeDraft, setSoireeDraft] = useState<Piece[] | null>(null)
  // …and where they are in the street, a few times a second.
  useLive(base?.sim.id, classic ? 'street' : 'open', `${sim?.city}/${sim?.commune}`)

  // At Babi Karting: the race opens when the Sim starts one, and stays until the player leaves it.
  const kartAct = sim?.activity?.kind === 'do' && sim.activity.interaction.id === 'course-kart' ? sim.activity : null
  const raceKey = kartAct ? `${kartAct.placeId}:${kartAct.start}` : null
  const [racing, setRacing] = useState<string | null>(null)
  const [raced, setRaced] = useState<string | null>(null)
  useEffect(() => {
    if (raceKey && raceKey !== raced) setRacing(raceKey)
  }, [raceKey, raced])

  // Playing basketball or football (on a court, a pitch, or with the quarter's match): the player plays the match, once per activity.
  const ballAct = sim?.activity?.kind === 'do' ? sim.activity : null
  // (The same on every court: the game's, the quartier's match, the street's pitch and court, the kids' game in the street.)
  // Tennis and volleyball (the updates open; their courts only: backend game.Courts): played the same way.
  const netGame = !ballAct ? null : (ballAct.interaction.id === 'play-tennis' || ballAct.interaction.id === 'hotel-tennis') && keyOpen(features, 'tennis') ? 'tennis' : ballAct.interaction.id === 'play-volley' && keyOpen(features, 'volley') ? 'volley' : ballAct.interaction.id === 'play-beach-volley' && keyOpen(features, 'volley') ? 'beach' : null
  const ballSport = !ballAct ? null : netGame ? netGame : ballAct.interaction.id === 'play-basket' || ballAct.interaction.id === 'street-basket' || (ballAct.placeId === 'happening' && ballAct.interaction.id === 'join' && street?.happening?.id === 'basket') ? 'basket' : ballAct.interaction.id === 'play-football' || ballAct.interaction.id === 'play-foot11' || ballAct.interaction.id === 'street-foot' || (ballAct.placeId === 'happening' && ballAct.interaction.id === 'join' && street?.happening?.id === 'foot') ? 'foot' : null
  // The stadium's pitch: eleven against eleven on the console's rules (a referee, lines, corners), each player in its own place online.
  const eleven = ballAct?.interaction.id === 'play-foot11'
  const ballKey = ballAct && ballSport ? `${ballSport}:${ballAct.placeId}:${ballAct.start}` : null
  const [played, setPlayed] = useState<string | null>(null)
  // Left the match before its end (the activity goes on): back onto the pitch; at a court, into the court's match again.
  const rejoin = () => {
    joining.current = null
    setCourt(null)
    setPlayed(null)
  }
  // At a court (not the quarter's street match): the match with the other players there.
  // (A street game has no place: played with the street's players, as the quartier's match.)
  const courtKey = ballKey && ballAct!.placeId && ballAct!.placeId !== 'happening' && ballKey !== played ? ballKey : null
  const [court, setCourt] = useState<{ key: string; online: { token: string; simId: string; match: CourtMatch } | null } | null>(null)
  const joining = useRef<string | null>(null)
  useEffect(() => {
    if (!courtKey || !sim || court?.key === courtKey || joining.current === courtKey) return
    joining.current = courtKey
    const token = useSession.getState().token
    if (!token) return setCourt({ key: courtKey, online: null })
    joinMatch(token, sim.id)
      .then((match) => setCourt({ key: courtKey, online: { token, simId: sim.id, match } }))
      // Not a court of the game (or it's gone): played alone with the quarter's players.
      .catch(() => setCourt({ key: courtKey, online: null }))
  }, [courtKey, sim, court?.key])
  // The party heard from the street at night (world3d/open/party.tsx).
  const party = usePartySound()
  // Kept from render to render (a new one would start the match over); alone (no court match), the console's switching too.
  const elevenRules = useMemo(() => (eleven ? { size: 11 as const, referee: true, switching: !court?.online } : undefined), [eleven, court?.online])
  // Le foot de rue (the street, the quarter's courts, the quarter's match): four a side and the moves, once its update is open.
  const streetFoot = ballSport === 'foot' && !eleven && keyOpen(features, 'foot-de-rue')
  // Le basket de rue (the quarter's courts, the street, the quarter's tournament; not the Palais des Sports' arena): three a side under one iron hoop and the moves, once its update is open.
  // (A court's match begun as le basket de rue, its eight places, plays as it began.)
  const streetBasket = ballSport === 'basket' && ballAct?.placeId !== 'treich-palais' && (keyOpen(features, 'basket-de-rue') || court?.online?.match.sport === 'basket-rue')
  // The Palais des Sports: five against five on the full court at the real size, once its update is open (a match begun on it plays as it began).
  const proBasket = ballSport === 'basket' && ballAct?.placeId === 'treich-palais' && (keyOpen(features, 'basket-palais') || court?.online?.match.sport === 'basket-pro') && court?.online?.match.sport !== 'basket'
  const streetRules = useMemo(() => (proBasket ? { full: true } : streetFoot || streetBasket ? { street: true } : undefined), [streetFoot, streetBasket, proBasket])

  // « Voir la rue » is only for while inside: going in again (the street's « Entrer », arriving at a door,
  // back in after an action) shows the inside (else, back at the door, the street stayed on screen and
  // the house never showed again).
  useEffect(() => {
    if (placeId) setOutside(false)
  }, [placeId])

  // The home's gestures (the update « gestes-maison »): the action is the game, it opens as soon as it starts
  // (not played yet; left with « Plus tard », the action goes on in its time).
  // (Every other action, the same way: played as gestures made from what it is.)
  // (At work, not at once: the job's tasks can be played first; the shift's own game from the bar's button.)
  const gesteNow = sim?.activity?.kind === 'do' && !sim.activity.defi && !sim.activity.career && keyOpen(feats, 'gestes-maison') ? (defiOf(sim.activity.interaction.id) ?? (gesteOK(sim.activity) ? 'geste' : null)) : null
  // (Le mode vie, update « mode-vie »: an action left to play by itself, its game not opened; « Jouer » on its bar opens it.)
  const gesteAt = gesteNow && GESTE_DEFIS.has(gesteNow) && !sim!.activity!.auto ? `${sim!.activity!.interaction.id}@${sim!.activity!.start}` : null
  useEffect(() => {
    if (gesteAt && gesteNow) setDefi(gesteNow)
  }, [gesteAt]) // eslint-disable-line react-hooks/exhaustive-deps
  // The défi an activity can be taken on as, its update open (the ski off the island only, seen there; the school's lesson: « ecole-vivante »).
  const defiKindOf = (a: { kind: 'do' | 'travel'; interaction: Interaction; placeKind?: string; career?: string; seance?: unknown }) => {
    const id = a.interaction.id
    const k = defiOf(id)
    if ((id === 'aller-ecole' && !keyOpen(feats, 'ecole-vivante')) || (BABY_DEFIS.has(k!) && !keyOpen(feats, 'bebe-jeux')) || (id === 'bagarre-bebe' && !keyOpen(feats, 'bagarre-bebe')) || (id === 'chasser-chauves-souris' && !keyOpen(feats, 'plateau-vivant')) || (VILLE_DEFIS[id] && !keyOpen(feats, VILLE_DEFIS[id])) || (GESTE_DEFIS.has(k!) && !keyOpen(feats, 'gestes-maison'))) return null
    return k ?? (keyOpen(feats, 'gestes-maison') && gesteOK(a) ? 'geste' : null)
  }
  // Le mode vie: an order to be played (« Jouer pour un meilleur résultat »), its game opened once it has started (the home's gestures open by themselves).
  const playAsked = useRef<string | null>(null)
  const playAt = sim?.activity?.kind === 'do' && !sim.activity.defi && playAsked.current === sim.activity.interaction.id ? `${sim.activity.interaction.id}@${sim.activity.start}` : null
  useEffect(() => {
    if (!playAt || !sim?.activity) return
    playAsked.current = null
    const k = defiKindOf(sim.activity)
    if (k && !gesteAt) setDefi(k)
  }, [playAt]) // eslint-disable-line react-hooks/exhaustive-deps
  // The jam joined (the update « circulation »): straight to the junction, the whistle in hand.
  const jamAt = sim?.activity?.kind === 'do' && !sim.activity.defi && sim.activity.interaction.id === 'regler-circulation' && keyOpen(feats, 'circulation') ? sim.activity.start : null
  useEffect(() => {
    if (jamAt !== null) setDefi('circulation')
  }, [jamAt])
  // The Plateau's bats (the update « plateau-vivant »): straight to the trees, the lance-pierre in hand.
  const batsAt = sim?.activity?.kind === 'do' && !sim.activity.defi && sim.activity.interaction.id === 'chasser-chauves-souris' && keyOpen(feats, 'plateau-vivant') ? sim.activity.start : null
  useEffect(() => {
    if (batsAt !== null) setDefi('chauves')
  }, [batsAt])
  // Yamoussoukro's and Bouaké's games (the updates « yakro-vivant », « bouake-vivant »): straight into them,
  // the guide's visit of the basilica, the crocodiles' chicken in hand, the 4x4 or the tracker waiting.
  const villeKey = VILLE_DEFIS[sim?.activity?.kind === 'do' ? sim.activity.interaction.id : '']
  const villeAt = villeKey && sim?.activity?.kind === 'do' && !sim.activity.defi && keyOpen(feats, villeKey) ? `${sim.activity.interaction.id}@${sim.activity.start}` : null
  useEffect(() => {
    if (villeAt !== null) setDefi(defiOf(villeAt.split('@')[0])!)
  }, [villeAt]) // eslint-disable-line react-hooks/exhaustive-deps
  // A street happening's choice (the update « evenements-joues »): straight into its game, nothing to wait for.
  const eventAt = sim?.activity?.kind === 'do' && !sim.activity.defi && sim.activity.interaction.id.startsWith('evt-') && keyOpen(feats, 'evenements-joues') ? `${sim.activity.interaction.id}@${sim.activity.start}` : null
  useEffect(() => {
    if (eventAt !== null) setDefi('evenement')
  }, [eventAt])
  // A story's épreuve (backend game/epreuves.go): straight into its game, it's the step itself.
  const epreuveAt = sim?.activity?.kind === 'do' && !sim.activity.defi && sim.activity.interaction.id.startsWith('epreuve-') ? `${sim.activity.interaction.id}@${sim.activity.start}` : null
  useEffect(() => {
    if (epreuveAt !== null) setDefi('epreuve')
  }, [epreuveAt])

  // A ride in town, short (the update « trajet-court »): a short loading screen, the perso climbing in,
  // and it's there (the server ends the ride: sims.go arriveNow); then the vehicle drops it in the street.
  // (Not a flight or a coach to another city seen in 3D, « voyages-villes »: CityTrip below.)
  const cityTrip = sim?.activity?.kind === 'travel' && sim.activity.trip?.place && sim.activity.trip.fromCity !== sim.activity.trip.city && keyOpen(feats, TRAVEL_KEY) ? sim.activity : null
  // (One's own vehicle across town too, with « ma-voiture »: the short trip at the wheel, parked where it arrives.)
  const ride = sim?.activity?.kind === 'travel' && sim.activity.trip && !cityTrip && !['avion', 'metro', 'train'].includes(sim.activity.trip.mode) && (sim.activity.trip.mode !== 'perso' || (keyOpen(feats, 'ma-voiture') && sim.activity.trip.city === sim.activity.trip.fromCity)) && keyOpen(feats, 'trajet-court') ? sim.activity : null
  // Just landed or off the coach: the Sim stands at the airport or the gare it arrived at (its place in the street).
  const [landed, setLanded] = useState<{ commune: string; place: string } | null>(null)
  const [cityTripDone, setCityTripDone] = useState<number | null>(null)
  // (Set down there once: then the street goes on as ever.)
  useEffect(() => {
    if (!landed) return
    const k = setTimeout(() => setLanded(null), 20_000)
    return () => clearTimeout(k)
  }, [landed])
  const [rideDone, setRideDone] = useState<number | null>(null)
  // Its loading screen once the Sim is in (the vehicle at the kerb, world3d/open/tripRide); no street seen (the classic view), at once.
  const [rideIn, setRideIn] = useState<number | null>(null)
  useEffect(() => {
    if (!ride) return
    const t0 = performance.now()
    const t = setInterval(() => {
      const since = performance.now() - t0
      if ((tripRide.active && tripRide.boarded) || (!tripRide.active && since > 2500) || since > 40_000) (setRideIn(ride.start), clearInterval(t))
    }, 200)
    return () => clearInterval(t)
  }, [ride?.start]) // eslint-disable-line react-hooks/exhaustive-deps
  // A ride in the commune, short too: the same loading screen, then set down there (world3d/Walker), the vehicle dropping the Sim.
  const [townRide, setTownRide] = useState<(Taken & { to: string }) | null>(null)
  // Le mode vie's lived work day (components/LifeWork.tsx, world3d/lifeWork3d.tsx): the ride at the gate (leaving,
  // back), the camera kept at home or following the Sim to work, and the day told once back.
  const [workTrip, setWorkTrip] = useState<WorkTrip | null>(null)
  const [followWork, setFollowWork] = useState(false)
  const [backDay, setBackDay] = useState<WorkDay | null>(null)
  const [, setToldTick] = useState(0)
  const shiftNow = base?.sim.activity?.shift ? base.sim.activity : null
  const shiftKey = shiftNow ? `${shiftNow.start}` : null
  const shiftSeen = useRef<string | null>(null)
  useEffect(() => {
    if (!keyOpen(feats, 'mode-vie')) return
    if (shiftKey && shiftNow && shiftSeen.current !== shiftKey) {
      shiftSeen.current = shiftKey
      setFollowWork(false)
      setBackDay(null)
      // Just begun (not the app opened in the middle of it): the ride comes to the gate.
      const fresh = !!base && base.sim.gameMinutes - shiftNow.start < 1.5
      setWorkTrip(fresh ? { phase: 'leave', ride: shiftNow.shift!.ride, key: `l${shiftKey}` } : null)
    } else if (!shiftKey && shiftSeen.current) {
      // Over: back home in the ride (watching the house), then the day told; followed to work, told at once.
      const was = shiftSeen.current
      shiftSeen.current = null
      const day = base ? unseenDay(base.sim) : null
      if (day && !followWork) setWorkTrip({ phase: 'back', ride: (day.ride ?? 'gbaka') as WorkTrip['ride'], key: `b${was}` })
      else setWorkTrip(null)
      setFollowWork(false)
    }
  }, [shiftKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Closed, the street's code too, as when it came with the game's.
  if (!sim || (!fastStart && !streetReady)) {
    // The same loading screen as everywhere: the perso dancing (components/Splash.tsx).
    return <Splash label={tr('Chargement de Babi…')} />
  }

  const c = clock(sim.gameMinutes)
  // Le mode vie (update « mode-vie », game/vie.ts): the pin over the head and the portrait's ring take the moodlets' overall mood.
  const lifeMood = keyOpen(feats, 'mode-vie') ? moodColor(sim.mood) : null
  const moodHex = lifeMood ?? needColor(mood(sim.needs))
  // The activity the Sim is acting out here, if any (a trip happens on the road).
  const doing = sim.activity?.kind === 'do' ? sim.activity : null
  // The défi this activity can be taken on as, not yet played (the ski off the island only, seen there).
  // (The school's lesson: an update, « ecole-vivante ».)
  const defiNow = doing && !doing.defi ? defiKindOf(doing) : null
  const stop = () => run(tr('Arrêter'), 'x', '', () => api.stop(sim.id))
  // The pad shows in the shoulder view (and the classic street); the buttons over the street sit beside it, or in the middle.
  // (At the wheel, the pedals and the wheel take its place.)
  const padShown = (classic || view === 'epaule') && !driven
  // An invitation's card over the street (the column under the top bar).
  const inviting = !players && !placeId && !overlay && !clearView && around.invites.some((i) => !dismissed.includes(i.id))
  const padBeside = padShown ? 'left-[132px] max-w-[calc(100vw-144px)] sm:left-[152px] sm:max-w-[calc(100vw-164px)]' : 'left-1/2 max-w-[calc(100vw-24px)] -translate-x-1/2'
  const city = world.cities.find((x) => x.id === sim.city)!
  const commune = withMapPlaces(city.communes.find((x) => x.id === sim.commune)!, classic ? [] : mapPlaces)
  const unseen = journal.filter((e) => e.id > seen).length
  const placeName = (id: string) => (id === 'home' ? tr('Chez toi') : id === 'happening' ? (street?.happening?.label ?? tr('En ce moment')) : id.startsWith('soiree:') ? (soireeOf(id) ? tr('{0} chez {1}', { 0: soireeOf(id)!.title, 1: soireeOf(id)!.hostName }) : tr('La soirée')) : (commune.places.find((p) => p.id === id)?.name ?? ''))
  // Inside a place: while doing something there, or looking at what it offers.
  const inside = (() => {
    // Le mode vie: a word with someone in the house or the place (a chat has no place of its own) is said there, not out in the street.
    const chatHere = doing?.placeKind === 'chat' && keyOpen(feats, 'mode-vie') && !!(placeId ?? backTo)
    if (doing && !chatHere) {
      // Le mode vie's lived work day (components/LifeWork.tsx): out at work or at school, the house stays on screen (« Suivre » shows the Sim there).
      if (doing.shift && keyOpen(feats, 'mode-vie') && !classic && !followWork && homePlot && sim.city === sim.homeCity && sim.commune === sim.homeCommune) return { id: 'home', kind: 'home', it: workTrip?.phase === 'leave' ? 'partir-travail' : undefined }
      // A Garbaya meal eaten where the Sim is: in the street (eaten at home, its place is « home »).
      if (doing.placeId === 'golvo') return null
      // At school, at the crèche (an update, « ecole-vivante »), from home or at the commune's own (backend world/ecoles.go): the day there, seen (world3d/interior/SchoolDay).
      if ((doing.placeId === 'home' || doing.placeKind === 'school' || doing.placeKind === 'creche') && (doing.interaction.id === 'aller-ecole' || doing.interaction.id === 'creche') && keyOpen(feats, 'ecole-vivante')) return { id: 'ecole', kind: 'schoolday', it: doing.interaction.id }
      // In a home booked on Dodo: a home's inside, what's done in it as at home.
      if (doing.placeId === 'logement') return { id: 'logement', kind: 'home', it: DODO_AT_HOME[doing.interaction.id] ?? 'watch-tv' }
      // At a player's soirée: in its club.
      if (doing.placeId?.startsWith('soiree:')) return { id: doing.placeId, kind: 'club', it: doing.interaction.id }
      if (!doing.placeId || OPEN_AIR.has(doing.placeId)) return null
      // Up on a landmark's roof (La Pyramide's): in the street, the city all round (Walker, open/rooftops.ts).
      if (!classic && rooftopFor(doing.placeId, doing.interaction.id)) return null
      if (doing.placeId === BOULAY && doing.interaction.id.endsWith('-boulay')) return { id: doing.placeId, kind: 'boulay', it: doing.interaction.id }
      const kind = doing.placeId === 'home' ? 'home' : ARENAS.has(doing.placeId) ? 'arena' : (doing.placeKind ?? '')
      return INDOOR.has(kind) || SCENES.has(kind) || kind === 'arena' ? { id: doing.placeId, kind, it: doing.interaction.id } : null
    }
    // (An ordinary building gone into.)
    if (visit && !placeId) return { id: `visite:${visit.key}`, kind: visit.kind, it: undefined }
    // (An action just picked, or just done: still in the place it was picked in.)
    const at = placeId ?? backTo
    // Le mode vie (update « mode-vie »): between two orders, still in the Dodo home rented or at the soirée (their next order starts there).
    if (at && keyOpen(feats, 'mode-vie') && !classic) {
      if (at === 'logement' && sim.stay?.kind === 'dodo' && sim.stay.city === sim.city && sim.stay.commune === sim.commune) return { id: 'logement', kind: 'home', it: undefined }
      if (at.startsWith('soiree:') && soireeOf(at)) return { id: at, kind: 'club', it: undefined }
    }
    if (at && at !== 'happening' && !OPEN_AIR.has(at)) {
      // A covered hall (the Palais des Sports) has its own inside.
      const kind = at === 'home' ? 'home' : ARENAS.has(at) ? 'arena' : commune.places.find((p) => p.id === at)?.kind
      return kind && (INDOOR.has(kind) || SCENES.has(kind) || kind === 'arena') ? { id: at, kind, it: undefined } : null
    }
    return null
  })()
  // The home the arrival shows: the house the street has for the Sim, or its family's (game/rules homePlanFor), drawn the same way (kept, so it isn't rebuilt each render).
  let arrivalHome = homePlot
  if (!arrivalHome && arriving) {
    const key = `${sim.id}|${sim.housing}|${sim.family}`
    if (arrivalPlot.current?.key !== key) {
      const plan = homePlanFor(world, sim)
      arrivalPlot.current = { key, plot: plan ? { id: 0, key: sim.id, simId: sim.id, blocks: plan.blocks, furniture: plan.furniture, zones: plan.zones, built: 0, lot: { w: plan.w, d: plan.d, area: plan.w * plan.d, city: sim.homeCity, commune: sim.homeCommune, paid: 0 }, livable: true } : undefined }
    }
    arrivalHome = arrivalPlot.current.plot
  }
  const arrivalStreet = arriving && keyOpen(features, 'arrivee') && !classic && (arrivalPart === 'wait' || arrivalPart === 'fly')
  const showInside = !!inside && !outside && !arrivalStreet
  // Doing something at the zoo or round the hotel's grounds: the Sim walks about them freely meanwhile.
  const onGrounds = !!doing?.placeId && GROUNDS.has(doing.placeId) && sim.city === city.id && sim.commune === commune.id && !classic
  // Just come in (nothing being done yet): the Sim can walk about the room.
  const visiting = !!placeId && placeId !== 'happening' && showInside && !doing && sim.city === city.id && sim.commune === commune.id
  // In an ordinary building of the street (a visit): walked about freely too.
  const visitRoam = !!visit && showInside && !doing
  // Come to the zoo, the hotel's grounds, a known street: the Sim walks round it in the street view.
  const strolling = !!placeId && GROUNDS.has(placeId) && !inside && !doing && sim.city === city.id && sim.commune === commune.id && !classic
  const roaming = visiting || strolling
  // Le mode vie (update « mode-vie », components/LifeHome.tsx): in one's own house seen in 3D, the objects tapped, the orders queued, free will.
  const lifeHere = keyOpen(feats, 'mode-vie') && !classic && !!homePlot && showInside && inside!.kind === 'home' && inside!.id === 'home' && sim.city === sim.homeCity && sim.commune === sim.homeCommune
  // …and in the places one walks into (their pins, world3d/SpotActions): the orders queued there too (no free will: it would spend).
  // (Everywhere one goes in, the school day, the hotel, Île Boulay, the club and the soirées, the arenas and a Dodo home
  // included: their own flows stay as they are, the wheel and the queue work for their simple things. Not an ordinary
  // building of the street, a visit with nothing to do.)
  const lifeAt = lifeHere ? 'home' : keyOpen(feats, 'mode-vie') && !classic && showInside && sim.city === city.id && sim.commune === commune.id && inside!.id !== 'home' && !inside!.id.startsWith('visite:') ? (inside!.kind === 'schoolday' ? schoolPlace(commune, doing, inside!.it) : inside!.id) : null
  const lifeFree = !!lifeAt && !pending && !sim.activity && visiting && placeId === lifeAt && !menuOpen && !chat && !defi && !overlay && !fridgeOpen && building === false && !drawerOpen
  // Le mode vie's work day: its card while out (at home or followed there), the day not told yet once back.
  const workCard = !!doing?.shift && keyOpen(feats, 'mode-vie') && !classic && !defi && !overlay && !taskGame && workTrip?.phase !== 'leave'
  const told = lifeHere && !sim.activity ? (backDay ?? unseenDay(sim)) : null
  const goWork = async (school: boolean) => {
    setPlaceId(null)
    setOutside(false)
    setBackTo('home')
    if (school) {
      const it = world.kinds.home?.interactions.find((x) => x.id === 'aller-ecole')
      return it ? interact(it, 'home', true, 'home') : false
    }
    return run(tr('Aller au travail'), 'briefcase', 'work', () => api.workGo(sim.id))
  }
  // A long way ahead, a moto-taxi offered: its card takes the place of « En ce moment » (they sat on each other).
  const motoAsking = !!moto.offer && !moto.paid
  // The music of where the Sim is: the club and the maquis inside, a show on
  // its stage (the drums, the singers, the audience), the hush of a museum; at
  // the stadium, the crowd of the match or the concert; and in the street, the
  // fanfare of a wedding cortège, a concert, the masks.
  const happeningId = street?.happening?.id
  // At the crèche: the other players' babies there now (the update « creche-ensemble »).
  const crecheMates = inside?.it === 'creche' && keyOpen(features, 'creche-ensemble') ? around.players.filter((p) => p.stage === 'bebe' && p.activity?.interactionId === 'creche') : []
  const doingId = doing?.interaction.id
  const track: Track | null = showInside
    ? inside!.kind === 'club'
      ? 'club'
      : inside!.kind === 'maquis'
        ? 'maquis'
        : doingId === 'spectacle'
          ? 'spectacle'
          : doingId === 'exposition'
            ? 'expo'
            : null
    : doingId === 'stade-match'
      ? 'stade'
      : doingId === 'stade-concert' || doingId === 'stade-fete' || happeningId === 'femua'
        ? 'concert'
        : happeningId === 'mariage'
          ? 'fanfare'
          : happeningId === 'concert'
            ? 'club'
            : happeningId === 'fete-masques' || happeningId === 'abissa' || happeningId === 'carnaval-bouake'
              ? 'spectacle'
              : happeningId === 'anniversaire' || happeningId === 'bapteme'
                ? 'maquis'
                : null
  // Out in the street at night, the party at the Rue Princesse or Blockhauss is heard from down the road, louder as one comes near.
  const partyHeard = !track && !showInside && party.id !== null && party.level > 0
  // The party is in the Sim's own commune (Rue Princesse for Yopougon, Blockhauss for Cocody).
  const partyHere = !!party.id && commune.places.some((p) => p.id === party.id)
  const trackSeed = partyHeard ? `party${party.id}` : showInside ? inside!.id : `${commune.id}${happeningId ?? ''}`

  // The calmer screen (update « ecran-simple », components/SimpleHud.tsx): its bar, the strip of who is here and the
  // commune's grin, the top kept to the hour, the money, the next goal and what is going on.
  const simple = keyOpen(feats, 'ecran-simple') && !classic
  // In a place of the commune (not home, not a building only visited): the players doing something there.
  const atPlace = showInside && inside && inside.id !== 'home' && !inside.id.startsWith('visite:') ? inside.id : null
  const hereCount = atPlace ? around.players.filter((p) => !p.npc && p.activity?.placeId === atPlace).length : (around.here ?? around.players.filter((p) => !p.npc).length)
  const stripShown = simple && !defi && !overlay && !driven && !clearView && !players && !whereTo && !moiOpen && !grinOpen && !sim.prison && !chat && building === false && !(placeId && !roaming)
  const goGoal = (g: Goal) => {
    if ('app' in g.go) return (setPhoneApp('demandes'), setOverlay('phone'))
    if (g.go.kind === 'home') return walkTo('home')
    const place = g.go.place
    if (place && commune.places.some((p) => p.id === place)) return walkTo(place)
    // Out of town (the N'Zi's reserve from Bouaké): the trip there, not a walk to the nearest place of its kind.
    if (place && farOf(world, sim, place)) return (setFarPick(place), setWhereTo(true))
    if (g.go.city && g.go.city !== sim.city) return setOverlay('map')
    goToKind(g.go.kind, commune, walkTo, () => setOverlay('map'))
  }
  const openPhone = () => (setPhoneDirect(false), setOverlay('phone'), setSeen(journal[0]?.id ?? 0), setNewMsgs(0))
  const atHomeNow = showInside && inside?.id === 'home'
  hud.current = {
    tab: (t: HudTab) => {
      if (t === 'carte') return setOverlay('map')
      if (t === 'moi') return setMoiOpen(true)
      // New messages: straight into Gbairai (what is new), as its old button did.
      if (t === 'phone') return newMsgs > 0 && gbairaiAccess(world, sim, feats).any ? (setPhoneApp('gbairai'), setPhoneDirect(true), setOverlay('phone'), setNewMsgs(0)) : openPhone()
      if (t === 'maison') {
        // At home: what to do here; elsewhere, the way home.
        if (atHomeNow) return roaming ? setMenuOpen(true) : placeId !== 'home' && setPlaceId('home')
        return walkTo('home')
      }
      // « Ici »: walking about a place, what to do in it; else the places of the quarter.
      if (roaming) return setMenuOpen(true)
      setWhereTo(true)
    },
    who: (focus) => setPlayers({ focus }),
    causer: () => setGrinOpen(true),
    greet: (p) => void run(tr('Saluer {0}', { 0: p.username ? `@${p.username}` : p.firstName }), 'hand', 'social', () => api.meet(sim.id, p.id, 'saluer')),
    invite: (p) => void run(tr('Inviter {0}', { 0: p.username ? `@${p.username}` : p.firstName }), 'send', 'social', () => api.meet(sim.id, p.id, 'inviter')),
  }
  // The happenings, the soirée, over the street (the update moves them up top, as what is going on now).
  const happeningLive = !!street?.happening && street.cleared === undefined && !placeId && !sim.activity && !driven
  const soireeLive = soirees.length > 0 && !placeId && !sim.activity

  return (
    <div className="relative h-full overflow-hidden bg-[var(--color-night)] select-none" data-cinema={(arriving && keyOpen(features, 'arrivee') && !classic) || undefined} style={simple ? ({ '--hud-lift': stripShown && !desktop && !short ? '3.75rem' : '0px' } as CSSProperties) : undefined}>
      {/* An update the team just opened (the admin's « Mises à jour »), once. */}
      <FeatureNews />
      {keyOpen(features, 'famille-liste') && !arriving && !tuto && !classic && <ListedFamily simId={sim.id} onResult={apply} />}
      {/* The baby's « premières fois »: the chip (inside, top left; out, under « Où aller ? ») */}
      {firstsView && firstsShown && showInside && !overlay && !players && <FirstsChip view={firstsView} className="absolute top-[max(4.75rem,calc(var(--sat,env(safe-area-inset-top))+4.25rem))] left-3 z-20" />}
      {/* Wanted after a robbery (update « braquages »): the police looking, the time left */}
      {braquage && !sim.prison && !overlay && !players && <WantedChip v={braquage} now={sim.gameMinutes} className="absolute top-[max(8rem,calc(var(--sat,env(safe-area-inset-top))+7.5rem))] right-3 z-20" />}
      {/* Prison at the MACA (update « braquages »): its étapes, its actions */}
      {sim.prison && !overlay && !players && <PrisonPanel sim={sim} kind={world.kinds.prison} run={run} />}
      {/* The child's « étapes »: the same chip */}
      {stepsView && showInside && !overlay && !players && <FirstsChip view={stepsView} steps className="absolute top-[max(4.75rem,calc(var(--sat,env(safe-area-inset-top))+4.25rem))] left-3 z-20" />}
      {/* Choosing the toy, the first word, while doing it */}
      {firstsView && isBaby && keyOpen(features, 'choix-bebe') && doing && (doing.interaction.id === 'jouets' || doing.interaction.id === 'premier-mot') && choiceShut !== `${doing.interaction.id}${doing.start}` && (
        <ChoiceSheet simId={sim.id} kind={doing.interaction.id === 'jouets' ? 'talent' : 'mot'} view={firstsView} onResult={(r) => (apply(r), void api.firsts(sim.id).then(setFirstsView).catch(() => undefined))} onDone={() => setChoiceShut(`${doing.interaction.id}${doing.start}`)} />
      )}
      {/* The baptism, once, in the baby's first days (after the arrival's flight) */}
      {baptism && !arriving && <Bapteme sim={sim} onResult={apply} onEnd={() => setBaptism(false)} />}
      {/* Grown up by milestones: the party */}
      {growParty && !arriving && <GrowUpParty sim={sim} to={growParty} onEnd={() => setGrowParty(null)} />}
      {racing && (
        <Suspense fallback={<div className="fixed inset-0 z-50"><Splash label={tr('Babi Karting…')} /></div>}>
          <KartRace
            key={racing}
            name={sim.firstName}
            look={sim.look}
            gender={sim.gender}
            simId={sim.id}
            token={token ?? undefined}
            onExit={() => {
              setRaced(racing)
              setRacing(null)
            }}
            // Another race is paid for again; the new activity opens the next grid.
            onReplay={async () => {
              setRaced(racing)
              // The last race may still be the Sim's activity: it ends, then the next one is paid.
              await api.stop(sim.id).catch(() => undefined)
              return run('Faire une course de karting', 'car', 'karting', () => api.interact(sim.id, kartAct?.placeId ?? 'marcory-karting', 'course-kart'))
            }}
          />
        </Suspense>
      )}
      {ballKey && ballKey !== played && !racing && (!courtKey || court?.key === courtKey) && netGame && (
        <Suspense fallback={<div className="fixed inset-0 z-50"><Splash label={netGame === 'tennis' ? tr('Sur le court…') : netGame === 'beach' ? tr('Sur le sable…') : tr('Au Palais des Sports…')} /></div>}>
          {netGame === 'tennis' ? (
            <TennisMatch key={ballKey} name={sim.firstName} look={sim.look} gender={sim.gender} venue={ballAct!.placeId === 'cocody-hotel-ivoire' ? 'ivoire' : ballAct!.placeId === 'plateau-tennis' ? 'plateau' : 'club'} online={courtKey ? (court?.online ?? undefined) : undefined} onExit={() => setPlayed(ballKey)} />
          ) : (
            <VolleyMatch key={ballKey} name={sim.firstName} look={sim.look} gender={sim.gender} beach={netGame === 'beach' ? (ballAct!.placeId === 'bassam-plage' ? 'bassam' : 'portbouet') : undefined} online={courtKey ? (court?.online ?? undefined) : undefined} onExit={() => setPlayed(ballKey)} />
          )}
        </Suspense>
      )}
      {ballKey && ballKey !== played && !racing && (!courtKey || court?.key === courtKey) && !netGame && (
        <Suspense fallback={<div className="fixed inset-0 z-50"><Splash label={ballSport === 'basket' ? (streetBasket ? tr('Au terrain du quartier…') : proBasket ? tr('Au Palais des Sports…') : tr('Sur le terrain…')) : eleven ? tr('Au stade…') : streetFoot ? tr('Au terrain du quartier…') : tr('Au maracana…')} /></div>}>
          <StreetMatch key={ballKey} sport={ballSport as 'foot' | 'basket'} name={sim.firstName} look={sim.look} gender={sim.gender} online={courtKey ? (court?.online ?? undefined) : undefined} rules={elevenRules ?? streetRules} onExit={() => setPlayed(ballKey)} />
        </Suspense>
      )}
      {showInside && (
        <div className="absolute inset-0 z-[1]">
          {inside!.kind === 'schoolday' && doing ? (
            <>
              <SchoolDay sim={sim} stage={lifeOf(world, sim).stage?.id ?? 'enfant'} part={schoolPart(inside!.it, Math.min(1, Math.max(0, (sim.gameMinutes - doing.start) / Math.max(1, doing.end - doing.start))))} buddy={childhoodBuddy(sim)} night={c.isNight} mates={crecheMates} onMate={(id) => setPlayers({ focus: id })} />
              {/* The players' babies at the crèche too: their names, tapped, their card (to become friends) */}
              {crecheMates.length > 0 && (
                <div className="absolute inset-x-3 bottom-[calc(7.5rem+var(--hud-lift,0px))] z-10 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="hud rounded-full px-3 py-1.5 text-[12px] font-extrabold">{tr('Avec toi à la crèche :')}</span>
                  {crecheMates.map((m) => (
                    <button key={m.id} className="rounded-full bg-[#2563eb] px-3 py-1.5 text-[12px] font-extrabold text-white shadow active:scale-95" onClick={() => setPlayers({ focus: m.id })}>
                      {m.username ? `@${m.username}` : m.firstName}
                    </button>
                  ))}
                </div>
              )}
              <div className="hud pointer-events-none absolute top-[max(5rem,calc(var(--sat,env(safe-area-inset-top))+4.5rem))] left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-extrabold whitespace-nowrap">
                {SCHOOL_LINE[schoolPart(inside!.it, Math.min(1, Math.max(0, (sim.gameMinutes - doing.start) / Math.max(1, doing.end - doing.start))))]}
              </div>
            </>
          ) : inside!.id === 'logement' && dodoPlot ? (
            // A home booked on Dodo: its own house, walked in like one's own.
            <HomeInside sim={sim} world={world} plot={dodoPlot} interactionId={inside!.it} roam={false} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
          ) : inside!.kind === 'home' && inside!.id !== 'logement' && !inside!.id.startsWith('visite:') && homePlot && !classic ? (
            <HomeInside trip={lifeHere ? (workTrip ?? undefined) : undefined} away={lifeHere && !!doing?.shift && workTrip?.phase !== 'leave'} onTripDone={() => (workTrip?.phase === 'back' && setBackDay(unseenDay(sim)), setWorkTrip(null))} moodColor={lifeMood ?? undefined} partner={sim.friends?.find((f) => f.partner && f.home)} parents={sim.housing !== 'maison' && lifeOf(world, sim).stage?.id !== 'adulte'} sim={sim} world={world} plot={homePlot} life={lifeHere} interactionId={lifeHere && workTrip?.phase === 'back' ? 'retour-travail' : inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} onBuild={() => setBuilding(0)} drawer={gifts.on ? { count: gifts.wrapped, onOpen: () => setDrawerOpen(true) } : undefined} />
          ) : inside!.kind === 'mall' ? (
            <Suspense fallback={null}>
              <MallInside sim={sim} name={placeName(inside!.id)} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} layout={MALLS[inside!.id]} />
            </Suspense>
          ) : inside!.kind === 'hotel' ? (
            // Every hotel: the whole hotel (lobby, restaurant, bar, pool deck) and, by its lifts, its floors and rooms (HotelFloors).
            <Suspense fallback={null}>
              <HotelStay world={world} sim={sim} placeId={inside!.id} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} night={c.isNight} interactionId={inside!.it} act={run} onAct={(it) => {
                const id = inside!.id
                // As from the place's menu: the menu closes, the room shows what's done in it, and once
                // it's done the Sim is still there (in its room: the hotel's floors stay as they were).
                setPlaceId(null)
                setOutside(false)
                setBackTo(id)
                void run(it.label, it.icon, 'home', () => api.interact(sim.id, id, it.id))
              }}>
                {inside!.id === 'cocody-hotel-ivoire' ? (
                  <IvoireInside sim={sim} interactionId={isRoomAct(inside!.it) ? undefined : inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
                ) : (
                  <HotelInside sim={sim} placeId={inside!.id} name={placeName(inside!.id)} interactionId={isRoomAct(inside!.it) ? undefined : inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
                )}
              </HotelStay>
            </Suspense>
          ) : inside!.id === 'plateau-cathedrale' ? (
            // The cathedral: its whole nave in tiers round the altar, full on Sunday morning; the top of its tower.
            <Suspense fallback={null}>
              <CathedralInside sim={sim} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'yakro-basilique' && keyOpen(feats, 'yakro-vivant') ? (
            // The Basilique Notre-Dame de la Paix: its round nave under the dome, its windows all round.
            <Suspense fallback={null}>
              <BasiliqueInside sim={sim} interactionId={inside!.it} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'treich-mosquee-m6' ? (
            // The Mosquée Mohammed VI: its great hall under the arcades, full and praying as one on Friday.
            <Suspense fallback={null}>
              <MosqueM6Inside sim={sim} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'plateau-pyramide' ? (
            // La Pyramide: its gallery of shops round the open well, the lifts to the offices; its roof over the Plateau.
            <Suspense fallback={null}>
              <PyramideInside sim={sim} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'treich-palais-culture' ? (
            // The Palais de la Culture: its great salle Anoumabo (the stage, the band, the rows, the pit), its foyer of paintings.
            <Suspense fallback={null}>
              <PalaisCultureInside sim={sim} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'plateau-musee' ? (
            // The Musée des Civilisations: its hall of masks, carved figures, gold-weights and cloths; the guide and the class.
            <Suspense fallback={null}>
              <MuseeInside sim={sim} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'plateau-assemblee' ? (
            // The Assemblée nationale: the hemicycle in a sitting, seen from the public gallery.
            <Suspense fallback={null}>
              <AssembleeInside sim={sim} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'treich-marche' ? (
            // The Grand Marché de Treichville: its hall of food, the stairs up to its floor of pagnes.
            <Suspense fallback={null}>
              <MarcheTreichInside sim={sim} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.id === 'marcory-kineo' || inside!.id === 'cocody-kineo' ? (
            // A Kinéo cinema: its lobby; with a ticket, the screen's room and the Sim in its seat.
            <Suspense fallback={null}>
              <KineoInside sim={sim} placeId={inside!.id} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.kind === 'aeroport' ? (
            <Suspense fallback={null}>
              <AirportInside sim={sim} name={placeName(inside!.id)} flights={flightsFrom(world, sim.city, (k) => keyOpen(feats, k)).filter((f) => f.place === inside!.id)} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.kind === 'beach' ? (
            <Suspense fallback={null}>
              <BeachScene sim={sim} placeId={inside!.id} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} others={around.players.filter((p) => p.activity?.placeId === inside!.id)} />
            </Suspense>
          ) : inside!.kind === 'boulay' ? (
            // Over on Île Boulay: its village and its beach, or water-skiing off it.
            <Suspense fallback={null}>
              <BoulayScene sim={sim} interactionId={inside!.it} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
            </Suspense>
          ) : inside!.kind === 'arena' ? (
            <Arena sim={sim} placeId={inside!.id} interactionId={inside!.it} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} others={around.players.filter((p) => p.activity?.placeId === inside!.id)} />
          ) : (
            // A soirée zouglou in its club is danced zouglou (avatar/dances.ts).
            <DanceFloor.Provider value={floorOfTheme(soireeOf(inside!.id)?.theme)}>
              <Interior faith={commune.places.find((p) => p.id === inside!.id)?.faith} deco={decoOn && soireeOf(inside!.id)?.layout ? { room: world.soiree!, layout: soireeOf(inside!.id)!.layout! } : undefined} party={inside!.id.startsWith('soiree:') ? (soireeOf(inside!.id)?.hostName ?? doing?.placeName?.split(/ chez | at /).pop()?.replace(/'s$/, '')) : undefined} open={inside!.kind === 'home' || inside!.id.startsWith('soiree:') || (world.kinds[inside!.kind]?.interactions.some((it) => openAt(it, sim.gameMinutes)) ?? true)} sim={sim} kind={inside!.kind} placeId={inside!.id} interactionId={inside!.it} roam={(visiting || visitRoam) && !menuOpen} housing={inside!.id === 'logement' ? 'appart' : inside!.id.startsWith('visite:') ? (visit?.key && Number(visit.key.split(':')[0]) % 2 ? 'appart' : 'maison') : sim.housing} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} others={around.players.filter((p) => p.activity?.placeId === inside!.id && inside!.id !== 'home')} pins={!!lifeAt && lifeAt === inside!.id && !!doing && !defi} /> 
            </DanceFloor.Provider>
          )}
        </div>
      )}
      <div className={`street-view absolute inset-0 ${showInside ? 'invisible' : ''}`}>
        {(() => {
          const street = {
            world,
            commune,
            sim,
            moodColor: moodHex,
            hour: HOUR_OVERRIDE ?? c.hour,
            goTo,
            onPick: walkTo,
            // At one's own lot: building; someone else's lot has nothing to do.
            onArrive: (id: string) => (id.startsWith('plot:') ? void buildAt(id.slice(5)) : (setOutside(false), setPlaceId(id))),
            busy: doing ? { icon: doing.interaction.icon, kind: doing.placeKind ?? '', id: doing.interaction.id } : pending,
            stationAt: doing?.placeId ?? (landed?.commune === sim.commune ? landed.place : null),
            // Busy inside (the street seen through « Voir la rue »): the Sim is in there, not at the door.
            indoors: !!inside && !!doing,
            // In the air (FlightView over the street), no name floating over the clouds.
            nameTag: sim.activity?.trip?.mode === 'avion' || sim.activity?.trip?.mode === 'metro' ? undefined : `${mine.crew ? `[${mine.crew}] ` : ''}${user?.username ? `@${user.username}` : sim.firstName}${passOn(sim) ? ' ★' : ''}${mine.title ? ` · ${mine.title}` : ''}`,
            happening,
            onNear: setNear,
            // Busy, the Sim isn't frozen: it does what it does where it stands, and walking far
            // from the place stops it (onLeave). Only on a trip, in a match, or while a request is out.
            frozen: !!pending || sim.activity?.kind === 'travel' || /^play-/.test(doing?.interaction.id ?? ''),
            onLeave: () => void run(tr('Activité arrêtée'), 'x', '', () => api.stop(sim.id)),
            delivery,
            onCollect: () => delivery && deliveryState(delivery, Date.now()).stage === 'here' && collect(),
            players: around.players,
            parties: soirees,
            onPickPlayer: (id: string) => (lifeOpen ? void playerPie(id) : setPlayers({ focus: id })),
            recenter,
            onFreeCamera: setFreeCam,
            closeView,
            shoulderView: view === 'epaule',
            onTalk: (npc: Npc, where?: Where) => meet(npc, where),
            talkingTo: chat?.id ?? (doing?.placeKind === 'chat' ? talkedTo.current : null),
            plotsVersion,
            onStreetBuy: async (vendor: string, choice?: string) => {
              let said: string | null = null
              // Which seller (the id's prefix: porc, cafe, the; else alloco), as the API does.
              const [label, icon] = STREET_SELLERS[vendor.split(':')[0]] ?? STREET_SELLERS.alloco
              await run(label, icon, 'market', async () => {
                // The loto kiosk: the ticket (draw, numbers, stake) comes as JSON.
                const ticket = vendor.startsWith('loto:') && choice ? (JSON.parse(choice) as { draw: number; numbers: number[]; stake: number }) : null
                const res = ticket ? await api.buyLoto(sim.id, vendor, ticket.draw, ticket.numbers, ticket.stake) : await api.street(sim.id, vendor, choice)
                said = res.outcome.text
                return res
              })
              return said
            },
            // A street gesture in passing (world3d/open/rueGestes.tsx): the money and the needs it brings.
            onGeste: (kind: string, to?: string) => api.geste(sim.id, kind, to).then((res) => (apply(res), res.outcome.text)),
            onRobbed: async (spot: string) => {
              try {
                const res = await api.robbed(sim.id, spot)
                apply(res)
                // Taken: the journal's event says it (announce); nothing taken: say why here.
                if (!res.outcome.money) toast({ tone: 'random', title: tr('Les nouchis du couloir'), text: res.outcome.text, money: 0 })
                return res.outcome.text
              } catch {
                return null
              }
            },
          }
          // Their code may still be on its way (update « demarrage-rapide »): the sky meanwhile, and the street's progress over it.
          return (
            <>
              <Suspense fallback={<StreetSky hour={c.hour} />}>{classic ? <Neighbourhood key={commune.id} {...street} /> : <OpenWorld key={commune.id} {...street} paused={lifeHere} commune={ownPlaces(commune)} token={MAP_TOKEN ?? ''} onFail={() => setMapSlow(true)} onLoaded={() => setMapSlow(false)} onMapPlaces={setMapPlaces} onHomeSpots={setHomeSpots} onHomePlot={setHomePlot} />}</Suspense>
              {fastStart && !classic && !mapSlow && !lifeHere && <StreetComing key={commune.id} />}
            </>
          )
        })()}
      </div>
      {/* At the club, open, from 18: « Lancer des billets » on the dancers, a tap at a time */}
      {showInside && inside!.kind === 'club' && !lifeOf(world, sim).minor && clubOpenAt(sim.gameMinutes) && sim.city === city.id && sim.commune === commune.id && !overlay && (
        <Billets money={sim.money} onThrow={(amount) => api.billets(sim.id, inside!.id, amount).then((res) => (apply(res), throwBillets(amount), res.outcome.text))} />
      )}
      {/* At mass, the culte or the Friday prayer: the quête, the offrande, the aumône, a tap at a time (backend sims/offrande.go) */}
      {sim.activity?.kind === 'do' && SERVICES.has(sim.activity.interaction?.id ?? '') && !overlay && (() => {
        const faith = commune.places.find((p) => p.id === sim.activity!.placeId)?.faith
        const label = faith === 'catholique' ? tr('Donner à la quête') : faith === 'musulman' ? tr('Donner l’aumône') : tr('Donner à l’offrande')
        return <Billets money={sim.money} amounts={[100, 500, 1000, 5000]} label={label} color="#c9a14a" onThrow={(amount) => api.offrande(sim.id, amount).then((res) => (apply(res), res.outcome.text))} />
      })()}
      {/* Never over a match or a race: it waits till the street */}
      {/* Asked inside too (a baby lives at home), not over the arrival or the baptism */}
      {!overlay && building === false && !(ballKey && ballKey !== played) && !racing && !arriving && !baptism && <NotifyPrompt />}
      {mapSlow && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] z-10 flex justify-center px-6">
          <p className="hud rounded-2xl px-4 py-2.5 text-center text-sm font-extrabold">{tr('La carte de Babi charge… Le réseau est lent : on réessaie tout seul.')}</p>
        </div>
      )}

      {/* « communes-detail »: the zone or the carrefour just walked into, named */}
      {keyOpen(features, 'communes-detail') && !classic && <ZoneBanner commune={commune} hidden={showInside || !!placeId || !!overlay || !!defi} />}

      {/* ---------- Top HUD ---------- */}
      {simple && (
        <header className={`pointer-events-none absolute inset-x-0 top-0 z-20 ${defi ? 'hidden' : 'flex'} items-start justify-between gap-2 p-3 pt-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] lg:p-5`}>
          <div className="flex min-w-0 flex-col items-start gap-2">
            {/* The hour and the money, in one pill. */}
            <div className="hud flex h-10 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-1 sm:h-11">
              <span key={sim.money} className="motion-coin">
                <Coin size={26} />
              </span>
              <span className="tnum font-display text-base font-extrabold sm:text-lg">{amount(sim.money)}</span>
              <span className="h-5 w-px bg-black/10" />
              <DayNight night={c.isNight} size={15} />
              <span className="tnum font-display text-base font-extrabold sm:text-lg">{c.time}</span>
              <span className="text-xs font-extrabold text-[var(--color-ink-soft)] max-sm:hidden short:hidden">
                {c.weekday} {c.date}
              </span>
            </div>
            {/* One thing to do: the way being walked, the baby's or child's next step, else the next goal (a need first). */}
            {!showInside && !placeId && !overlay && !players && !driven && !sim.prison && !chat && !clearView && (
              <>
                <WayLeft />
                {firstsView && firstsShown ? <FirstsChip view={firstsView} /> : stepsView ? <FirstsChip view={stepsView} steps /> : goal && !sim.activity && !tuto && !inviting && <NextGoal goal={goal} onGo={goGoal} />}
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {/* What is going on now: the street's happening, a soirée, the power cut. */}
            {happeningLive && !clearView && (
              <button className="hud pointer-events-auto flex max-w-[46vw] items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-left text-xs font-extrabold active:scale-95 lg:max-w-xs" onClick={() => walkTo('happening')}>
                <IconTile icon={iconFor(street!.happening!.icon)} colors={['#ffd54f', '#ffa000']} size={26} radius={13} />
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--color-rose)]" />
                <span className="truncate">{street!.happening!.label}</span>
              </button>
            )}
            {soireeLive && !clearView && (() => {
              const p = mySoiree ?? soirees[0]
              return (
                <button className="pointer-events-auto flex max-w-[46vw] items-center gap-1.5 rounded-full bg-[#2b1240] py-1 pr-3 pl-1 text-left text-xs font-extrabold text-white shadow-md active:scale-95 lg:max-w-xs" onClick={() => (p.host === sim.id ? setPlaceId(`soiree:${p.id}`) : walkTo(`soiree:${p.id}`))}>
                  <IconTile icon={PartyPopper} colors={['#ff5cc8', '#7a2bd6']} size={26} radius={13} />
                  <span className="truncate">{p.host === sim.id ? tr('Ta soirée') : tr('Soirée chez {hostName}', { hostName: p.hostName })}</span>
                </button>
              )
            })()}
            {!showInside && !clearView && <PowerCutBadge commune={commune.id} />}
            {inside && (
              <button className="hud pointer-events-auto rounded-full px-4 py-2 text-sm font-extrabold" onClick={() => (!doing && !outside ? goOut() : setOutside((o) => !o))}>
                {outside ? tr('Entrer · {0}', { 0: placeName(inside.id) || tr('Chez toi') }) : tr('Voir la rue')}
              </button>
            )}
            {!showInside && !placeId && !overlay && !clearView && (
              <div className="pointer-events-auto flex flex-col items-end gap-2">
                {/* The camera's view: one small round button (its name in « Moi » too). */}
                <button className="hud grid h-10 w-10 place-items-center rounded-full active:scale-95" onClick={() => setView((v) => NEXT_VIEW[v])} aria-label={{ pres: tr('Vue épaule'), epaule: tr('Vue de haut'), haut: tr('Vue de près') }[view]} data-tour="vue">
                  {view === 'epaule' ? <Mountain size={18} strokeWidth={2.6} className="text-[var(--color-emerald)]" /> : <Eye size={18} strokeWidth={2.6} className="text-[var(--color-emerald)]" />}
                </button>
                {/* The compass on the street itself, smaller on a phone: drag it to turn and tilt the view, tap N for north. */}
                <OrbitGizmo read={streetPose} size={desktop ? 112 : short ? 72 : 84} onYaw={(d) => (cameraTurn.yaw += d)} onPitch={(d) => (cameraTurn.pitch += d)} onNorth={() => (cameraTurn.snap = true)} />
              </div>
            )}
          </div>
        </header>
      )}
      {!simple && (
      <header className={`pointer-events-none absolute inset-x-0 top-0 z-20 ${defi ? 'hidden' : 'flex'} items-start justify-between gap-2 p-3 pt-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] lg:p-5`}>
        <Link to="/profil" viewTransition className="hud pointer-events-auto flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 transition active:scale-95 max-sm:max-w-[52vw] short:max-w-[36vw] sm:gap-2.5 sm:pr-4">
          <span className="block shrink-0 rounded-full p-[3px]" style={{ background: `conic-gradient(${moodHex} ${mood(sim.needs) * 3.6}deg, #e7e9f2 0)` }}>
            <span className="block h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b sm:h-11 sm:w-11 from-[#ffe7c7] to-[#ffb27a]">
              <Portrait look={sim.look} gender={sim.gender} framing="head" stage={lifeOf(world, sim).stage?.id} />
            </span>
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[15px] font-extrabold sm:text-[17px]">
              {mine.crew ? `[${mine.crew}] ` : ''}
              {user?.username ? `@${user.username}` : sim.firstName}
              {passOn(sim) && <span className="ml-1 text-[#e6b422]" title={tr('Babi Pass')}>★</span>}
              {mine.title && <span className="ml-1 text-[#3d4fd6]">· {mine.title}</span>}
            </span>
            <span className="flex min-w-0 items-center gap-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
              <MapPin size={11} strokeWidth={3} className="shrink-0" />
              <span className="truncate">
                {commune.name} · <span className="max-sm:hidden short:hidden">{lifeOf(world, sim).stage?.label ?? ''}, </span>
                {lifeOf(world, sim).age < 1 ? tr("moins d'un an") : tn(lifeOf(world, sim).age, '{n} an', '{n} ans')}
              </span>
            </span>
          </span>
        </Link>

        {/* The money and the hour, then the camera's controls under them (in the flow, so a wrapped row on a phone pushes them down instead of hiding them). */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* On a phone: the money and the hour, the small buttons under them; wider, one row. */}
          <div className="pointer-events-auto flex flex-col items-end gap-1.5 sm:flex-row-reverse sm:items-center sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hud flex h-10 items-center gap-1.5 rounded-full pr-3 pl-1 sm:h-11 sm:pr-4 sm:pl-1.5">
              <span key={sim.money} className="motion-coin">
                <Coin size={26} />
              </span>
              <span className="tnum font-display text-base font-extrabold sm:text-lg">{amount(sim.money)}</span>
            </div>
            <div className="hud flex h-10 items-center gap-1.5 rounded-full px-3 sm:h-11">
              <span className="max-sm:hidden short:hidden">
                <DayNight night={c.isNight} size={16} />
              </span>
              <span className="tnum font-display text-base font-extrabold sm:text-lg">{c.time}</span>
              <span className="text-xs font-extrabold text-[var(--color-ink-soft)] max-sm:hidden short:hidden">
                {c.weekday} {c.date}
              </span>
            </div>
            </div>
            <div className="flex items-center gap-1.5 max-sm:[&>*]:h-9 max-sm:[&>*]:w-auto max-sm:[&>*]:min-w-9 max-sm:[&>*]:px-2.5 sm:gap-2">
              <SoundToggle />
              <ClearViewToggle />
              <TesterTools sim={sim} act={run} />
              <PlayersChip count={around.here ?? around.players.length} online={around.online} invites={around.invites.length} onOpen={() => setPlayers({ focus: null })} />
              {keyOpen(feats, 'demandes') && <ErrandsChip sim={sim} seen={journal[0]?.id} onOpen={() => (setPhoneApp('demandes'), setOverlay('phone'))} />}
            </div>
          </div>
          {inside && (
            <button
              className="hud pointer-events-auto rounded-full px-4 py-2 text-sm font-extrabold"
              // Nothing going on inside: « Voir la rue » takes the Sim straight out into the street (not the street
              // seen with the Sim still in the house); busy inside, the street is only looked at, the Sim stays in.
              onClick={() => (!doing && !outside ? goOut() : setOutside((o) => !o))}
            >
              {outside ? tr('Entrer · {0}', { 0: placeName(inside.id) || tr('Chez toi') }) : tr('Voir la rue')}
            </button>
          )}
          {!showInside && !placeId && !overlay && !clearView && (
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {!classic && (
                <button className="hud flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setView((v) => NEXT_VIEW[v])} title={tr('Changer de vue')} data-tour="vue">
                  {/* What the next tap gives */}
                  {view === 'epaule' ? <Mountain size={17} strokeWidth={2.6} className="text-[var(--color-emerald)]" /> : <Eye size={17} strokeWidth={2.6} className="text-[var(--color-emerald)]" />}
                  <span className="max-sm:hidden short:hidden">{{ pres: tr('Vue épaule'), epaule: tr('Vue de haut'), haut: tr('Vue de près') }[view]}</span>
                </button>
              )}
              {!sim.activity && (
                <button className="hud flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setEmotesOpen(true)} title={tr('Émotes')}>
                  <Smile size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" />
                  <span className="max-sm:hidden short:hidden">{tr('Émotes')}</span>
                </button>
              )}
              {/* The compass, smaller on a phone: a finger drag on the street turns the view too */}
              <div>
              <OrbitGizmo
                read={streetPose}
                size={desktop ? 112 : short ? 72 : 84}
                onYaw={(d) => (cameraTurn.yaw += d)}
                onPitch={(d) => (cameraTurn.pitch += d)}
                onNorth={() => (cameraTurn.snap = true)}
              />
              </div>
            </div>
          )}
        </div>
      </header>
      )}

      {/* ---------- Bottom HUD: needs, map, phone ---------- */}
      {simple && (
        // The calmer screen: who is here and the commune's grin, then the bar of five (side by side on a wide screen or a phone on its side).
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 has-[[data-card]]:z-40 ${defi ? 'hidden' : 'flex'} flex-col items-stretch gap-1.5 px-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))] lg:flex-row lg:items-end lg:justify-center lg:px-5 lg:pb-5 short:flex-row-reverse short:items-end short:gap-2`}>
          {stripShown && (
            <div className="lg:absolute lg:bottom-5 lg:left-5 short:min-w-0 short:flex-1">
              <PlaceStrip hud={hud} simId={sim.id} commune={commune.id} where={atPlace ? placeName(atPlace) : commune.name} players={around.players} place={atPlace} here={hereCount} invites={around.invites.length} online={around.online ?? 0} canChat={gbairaiAccess(world, sim, feats).friends} canInvite={joinableActivity(sim)} />
            </div>
          )}
          <div className="flex justify-center short:w-[min(420px,55vw)] short:shrink-0">
            <BottomBar hud={hud} at={atHomeNow ? 'maison' : !showInside ? 'ici' : null} unseen={unseen} msgs={newMsgs} alert={NEEDS.some((n) => sim.needs[n.key] < 30)} ringColor={moodHex} ringPct={Math.round(mood(sim.needs))} look={sim.look} gender={sim.gender} stage={lifeOf(world, sim).stage?.id} />
          </div>
        </div>
      )}
      {moiOpen && (
        <MoiSheet
          sim={sim}
          world={world}
          title={`${mine.crew ? `[${mine.crew}] ` : ''}${user?.username ? `@${user.username}` : sim.firstName}${mine.title ? ` · ${mine.title}` : ''}`}
          view={!classic && !showInside ? { pres: tr('Vue épaule'), epaule: tr('Vue de haut'), haut: tr('Vue de près') }[view] : undefined}
          onView={() => setView((v) => NEXT_VIEW[v])}
          onEmotes={!sim.activity ? () => setEmotesOpen(true) : undefined}
          vie={keyOpen(feats, 'mode-vie')}
          tools={
            <>
              <SoundToggle />
              <ClearViewToggle />
              <TesterTools sim={sim} act={run} />
              {keyOpen(feats, 'demandes') && <ErrandsChip sim={sim} seen={journal[0]?.id} onOpen={() => (setMoiOpen(false), setPhoneApp('demandes'), setOverlay('phone'))} />}
            </>
          }
          onClose={() => setMoiOpen(false)}
        />
      )}
      {grinOpen && (
        <Suspense fallback={null}>
          <CommuneGrin world={world} sim={sim} onBack={() => setGrinOpen(false)} />
        </Suspense>
      )}
      {!simple && (
      <footer className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${defi ? 'hidden' : 'flex'} items-end justify-between gap-2 p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))] lg:p-5`}>
        <button data-tour="carte" className="hud pointer-events-auto flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-extrabold transition active:scale-95" onClick={() => setOverlay('map')}>
          <MapIcon size={24} strokeWidth={2.4} className="text-[var(--color-emerald)]" />
          {tr('Carte')}
        </button>
        <div data-tour="besoins" className="hud pointer-events-auto flex flex-1 justify-around gap-1 rounded-[26px] px-2 py-2 sm:max-w-md sm:flex-none sm:gap-3 sm:px-4">
          {NEEDS.map((n) => (
            <MotiveRing key={n.key} value={sim.needs[n.key]} icon={n.icon} label={desktop ? n.label : undefined} size={desktop ? 52 : 44} />
          ))}
        </div>
        {/* Gbairai on its own, over the phone: straight into the chats (and back out to the game). */}
        <div className="flex shrink-0 flex-col items-center gap-2">
        {gbairaiAccess(world, sim, feats).any && (
          <button
            className="pointer-events-auto relative flex h-14 w-14 flex-col items-center justify-center gap-0 rounded-full bg-[#25a35a] text-[9.5px] font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(20,120,60,0.8)] transition hover:bg-[#1f9150] active:scale-95"
            onClick={() => (setPhoneApp('gbairai'), setPhoneDirect(true), setOverlay('phone'), setNewMsgs(0))}
            aria-label={tr('Ouvrir Gbairai')}
          >
            <MessageCircle size={21} strokeWidth={2.4} />
            {tr('Gbairai')}
            {newMsgs > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--color-rose)] px-1 text-xs text-white ring-2 ring-white">{newMsgs}</span>}
          </button>
        )}
        <button
          data-tour="phone"
          key={buzz}
          className={`pointer-events-auto relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[22px] bg-[var(--color-orange)] text-[11px] font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(224,90,0,0.8)] transition hover:bg-[#f26f00] active:scale-95 ${buzz ? 'phone-buzz' : ''}`}
          onClick={() => (setPhoneDirect(false), setOverlay('phone'), setSeen(journal[0]?.id ?? 0), setNewMsgs(0))}
        >
          <Smartphone size={24} strokeWidth={2.4} />
          {tr('Phone')}
          {unseen > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--color-rose)] px-1 text-xs text-white ring-2 ring-white">{unseen}</span>}
          {/* New Gbairai messages: a green bubble on the other corner */}
          {newMsgs > 0 && !gbairaiAccess(world, sim, feats).any && <span className="absolute -top-1.5 -left-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[#25a35a] px-1 text-xs text-white ring-2 ring-white">{newMsgs}</span>}
        </button>
        </div>
      </footer>
      )}

      {/* A party heard from the street: loud in its own commune, faint from the next one */}
      <Soundtrack track={partyHeard ? 'club' : track} seed={trackSeed} level={partyHeard ? (partyHere ? Math.min(1, party.level * 1.4 + 0.15) : party.level * 0.3) : 1} />
      {/* The street's sound (update « ambiance-sonore »): the rain, the thunder, the hum, birds or crickets */}
      {/* The baby's voice: its cries, its babbling, its whimpers (the update « sons-bebe ») */}
      {keyOpen(features, 'sons-bebe') && lifeOf(world, sim).stage?.id === 'bebe' && <BabyVoice act={doing?.interaction.id ?? null} low={lowNeeds(sim.needs).length > 0} />}
      {keyOpen(features, 'ambiance-sonore') && <Ambience rain={happeningId === 'pluie'} night={c.isNight} inside={showInside} music={!!(partyHeard || track)} />}
      {/* Finding the way: the mini-map, and every place of the quarter (at the wheel, the GPS does it).
          (Not while talking with someone: the little of the street above the chat is theirs to see.) */}
      {!simple && !showInside && !placeId && !overlay && !players && !driven && !sim.prison && !chat && !clearView && (
        <div className="pointer-events-none absolute top-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+3.75rem)] left-3 z-20 flex flex-col items-start gap-2 sm:top-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+4.75rem)] lg:left-5 short:top-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+4.5rem)] short:flex-row">
          {/* A smaller map on a phone (scaled: the canvas keeps its sharpness) */}
          <div className="origin-top-left max-sm:-mr-[33px] max-sm:-mb-[33px] max-sm:scale-75 short:-mr-[53px] short:-mb-[53px] short:scale-[0.6]">
            <MiniMap onWalk={walkTo} />
          </div>
          <button data-tour="ou-aller" className="hud pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setWhereTo(true)}>
            <Navigation size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" /> {tr('Où aller ?')}
          </button>
          {/* On the way somewhere: how far, how long */}
          <WayLeft />
          {/* The power cut where the Sim stands */}
          <PowerCutBadge commune={commune.id} />
          {firstsView && firstsShown && <FirstsChip view={firstsView} />}
          {stepsView && <FirstsChip view={stepsView} steps />}
          {/* (On a phone held sideways, not the next goal: the requests' button up top keeps its count; nor while an
              invitation's card is up, the two would stack over the street.) */}
          {goal && !firstsView && !stepsView && !sim.activity && !tuto && !short && !inviting && (
            <NextGoal goal={goal} onGo={goGoal} />
          )}
        </div>
      )}
      {whereTo && (
        <WhereTo
          world={world}
          commune={commune.id}
          total={ownPlaces(commune).places.length + (commune.mapCount ?? 0)}
          parties={decoOn ? soirees : undefined}
          // At the wheel: the GPS takes the car there (arrows on the road); on foot, the Sim walks.
          onWalk={(id, spot) => (setWhereTo(false), driven ? void (gps.to = { id, name: spot.name, door: spot.door }, gps.way = null) : walkTo(id))}
          onClose={() => (setWhereTo(false), setFarPick(null))}
          far={farSpots(world, sim)}
          trip={{ sim, onTravel: farTravel }}
          pick={farPick ?? undefined}
          head={
            simple && !showInside && !driven ? (
              <div className="flex justify-center pb-2">
                <MiniMap onWalk={(id) => (setWhereTo(false), walkTo(id))} />
              </div>
            ) : undefined
          }
        />
      )}
      {freeCam && !placeId && !overlay && (
        <button className="hud motion-pop absolute right-3 bottom-[calc(6.25rem+var(--hud-lift,0px))] z-20 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold lg:right-5 lg:bottom-[calc(7.5rem+var(--hud-lift,0px))]" onClick={() => setRecenter((n) => n + 1)}>
          <LocateFixed size={18} strokeWidth={2.6} className="text-[var(--color-orange)]" /> {tr('Revenir à moi')}
        </button>
      )}

      {!classic && <FirstSteps pad={padShown} hidden={showInside || !!placeId || !!overlay || !!players || whereTo || !!sim.activity || !!pending || tuto || tutoAsked || firstTime} />}
      {/* The first time (or asked for again from the Encyclo): Koffi shows the beginner round */}
      {arriving && keyOpen(features, 'arrivee') && !classic && (
        <div className="cinema-keep">
          <Arrival
            commune={commune.name}
            firstName={sim.firstName}
            onPart={setArrivalPart}
            home={arrivalHome && <HomeInside parents={sim.housing !== 'maison' && lifeOf(world, sim).stage?.id !== 'adulte'} sim={sim} world={world} plot={arrivalHome} roam={false} closeUp night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />}
            onEnd={() => (setArriving(false), setArrivalPart(null))}
          />
        </div>
      )}
      {(tuto || tutoAsked || (grownNow && adultChapterDue())) && !classic && !(arriving && keyOpen(features, 'arrivee')) && <Tutorial key={tutoChapter} chapter={tutoChapter} simple={simple} state={{ whereTo, placeId, overlay, menu: menuOpen }} onEnd={() => (setTuto(false), tutoChapter === 'adulte' && keyOpen(features, 'demandes') && keyOpen(features, 'histoires') && setFirstStory(true))} />}
      {/* Straight after the tuto: the first story to pick, and its film (components/FirstStory.tsx) */}
      {firstStory && !overlay && <FirstStory sim={sim} onDone={endFirstStory} />}
      {/* Walking: the keys always (arrows / WASD); the pad on screen only in the shoulder view (the third-person
          view, chosen with the view button), so the other views stay clear. There, one walks with « Où aller ? »,
          the mini-map and the places' signs. The classic street has no views: the pad stays. */}
      {(!placeId || (strolling && !menuOpen)) && !overlay && !sim.activity && <WalkKeys />}
      {(!placeId ? padShown : roaming && !menuOpen && (strolling || !desktop)) && !overlay && !sim.activity && (
        <div className={`pointer-events-none absolute left-3 z-20 lg:left-5 ${placeId ? 'bottom-[calc(11rem+var(--hud-lift,0px))] lg:bottom-[calc(12rem+var(--hud-lift,0px))]' : 'bottom-[calc(6.25rem+var(--hud-lift,0px))] lg:bottom-[calc(7.5rem+var(--hud-lift,0px))]'} short:bottom-[calc(5.25rem+var(--hud-lift,0px))] short:flex short:flex-row-reverse short:items-end short:gap-2`}>
          <RunButton />
          <Joystick disabled={!!sim.activity || !!pending} className="pointer-events-auto" />
        </div>
      )}
      {near && !driven && !placeId && !whereTo && !pending && !sim.activity && !sim.prison && (
        <button
          // (A phone on its side: higher, over « Courir » beside the pad, not on it.)
          className={`motion-pop absolute bottom-[calc(6.5rem+var(--hud-lift,0px))] short:bottom-[calc(9rem+var(--hud-lift,0px))] ${padBeside} z-30 flex items-center lg:left-1/2 lg:max-w-sm lg:-translate-x-1/2 gap-2 rounded-2xl bg-[var(--color-ink)] py-2 pr-4 pl-2 text-left text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] lg:bottom-[calc(7.5rem+var(--hud-lift,0px))]`}
          onClick={() => setPlaceId(near)}
        >
          <IconTile icon={DoorOpen} colors={['#ffa040', '#ff6a00']} size={32} radius={10} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-70">{tr('Entrer')}</span>
            <span className="block truncate text-sm font-extrabold">{placeName(near)}</span>
          </span>
        </button>
      )}

      {!simple && street?.happening && street.cleared === undefined && !near && !placeId && !pending && !sim.activity && !motoAsking && !driven && (
        <button
          className={`animate-pop absolute bottom-[calc(6.5rem+var(--hud-lift,0px))] ${padBeside} z-20 flex items-center lg:left-1/2 lg:max-w-md lg:-translate-x-1/2 gap-2 rounded-full bg-[var(--color-gold)] py-1.5 pr-4 pl-1.5 text-left text-[#5a3a00] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] lg:bottom-[calc(7.5rem+var(--hud-lift,0px))]`}
          onClick={() => walkTo('happening')}
        >
          <IconTile icon={iconFor(street.happening.icon)} colors={['#ffd54f', '#ffa000']} size={36} radius={18} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-80">{tr('En ce moment')}</span>
            <span className="block truncate font-display text-[15px] font-extrabold">{street.happening.label}</span>
          </span>
          <ChevronRight size={18} strokeWidth={3} className="shrink-0" />
        </button>
      )}

      {!simple && soirees.length > 0 && !placeId && !pending && !sim.activity && !motoAsking && (() => {
        // The soirée here (one's own first): walked to; one's own is at home, opened at once.
        const p = mySoiree ?? soirees[0]
        return (
          <button
            className={`animate-pop absolute ${near || street?.happening ? 'bottom-[calc(10.75rem+var(--hud-lift,0px))] lg:bottom-[calc(12rem+var(--hud-lift,0px))]' : 'bottom-[calc(6.5rem+var(--hud-lift,0px))] lg:bottom-[calc(7.5rem+var(--hud-lift,0px))]'} ${padBeside} z-20 flex items-center lg:left-1/2 lg:max-w-md lg:-translate-x-1/2 gap-2 rounded-full bg-[#2b1240] py-1.5 pr-4 pl-1.5 text-left text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)]`}
            onClick={() => (p.host === sim.id ? setPlaceId(`soiree:${p.id}`) : walkTo(`soiree:${p.id}`))}
          >
            <IconTile icon={PartyPopper} colors={['#ff5cc8', '#7a2bd6']} size={36} radius={18} />
            <span className="min-w-0 leading-tight">
              <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-80">{p.host === sim.id ? tr('Ta soirée') : tr('Soirée chez {hostName}', { hostName: p.hostName })}{p.guests ? tr(' · {guests} invité{0}', { guests: p.guests, 0: p.guests > 1 ? 's' : '' }) : ''}{decoOn ? ` · ${p.free && p.price ? tr('Entrée offerte') : entryLabel(p.price)}` : ''}</span>
              <span className="block truncate font-display text-[15px] font-extrabold">{p.title}</span>
            </span>
            <ChevronRight size={18} strokeWidth={3} className="shrink-0" />
          </button>
        )
      })()}

      {placeId === 'happening' && street?.happening && (
        <HappeningSheet now={street} sim={sim} commune={commune} joinOpen={!street.happening.join || activityOpen(feats, street.happening.join.id)} choices={(street.happening.choices ?? []).filter((it) => activityOpen(feats, it.id) && (!it.id.startsWith('evt-') || keyOpen(feats, 'evenements-joues')))} onClose={() => setPlaceId(null)} onJoin={(it) => (setPlaceId(null), run(it.label, it.icon, 'happening', () => api.interact(sim.id, 'happening', it.id)))} />
      )}
      {placeId?.startsWith('soiree:') && (
        <SoireeSheet
          party={soireeOf(placeId)}
          world={world}
          sim={sim}
          city={city}
          commune={commune}
          onClose={() => setPlaceId(null)}
          onPick={(it) => {
            const id = placeId
            setPlaceId(null)
            setBackTo(id)
            run(it.label, it.icon, 'soiree', () => api.interact(sim.id, id, it.id))
          }}
          onEnd={() => (setPlaceId(null), run('Fin de la soirée', 'party-popper', 'social', () => api.endParty(sim.id)))}
          deco={decoOn}
          onArrange={() => setSoireeDeco('live')}
        />
      )}
      {soireeAsk && (
        <ThrowSoireeSheet
          sim={sim}
          room={decoOn ? world.soiree : undefined}
          arranged={!!soireeDraft}
          onArrange={() => setSoireeDeco('draft')}
          onClose={() => setSoireeAsk(false)}
          onThrow={(theme, price) => {
            setSoireeAsk(false)
            setPlaceId(null)
            run('Ta soirée', 'party-popper', 'soiree', () => api.throwParty(sim.id, theme, decoOn ? { price, layout: soireeDraft ?? undefined } : undefined)).then((ok) => ok && (setSoireeDraft(null), refreshPlayers()))
          }}
        />
      )}
      {soireeDeco && world.soiree && (
        <Suspense fallback={null}>
          <SoireeDeco
            room={world.soiree}
            host={sim.firstName}
            // Before it starts: the room as last arranged (the server keeps the last soirée's); going on: its own.
            layout={soireeDeco === 'live' ? (mySoiree?.layout ?? world.soiree.start) : (soireeDraft ?? lastRoom() ?? world.soiree.start)}
            onClose={() => setSoireeDeco(null)}
            onSave={async (layout) => {
              keepRoom(layout)
              if (soireeDeco === 'draft') return (setSoireeDraft(layout), true)
              const ok = await run('La salle de ta soirée', 'party-popper', 'soiree', () => api.arrangeParty(sim.id, layout))
              if (ok) refreshPlayers()
              return !!ok
            }}
          />
        </Suspense>
      )}
      {/* (Looking at the street from inside: no menu over it, the « Entrer » button at the top takes the Sim back in.) */}
      {/* (Le mode vie: a word with someone queued is said where the Sim stands, the place's menu stays shut.) */}
      {placeId && placeId !== 'happening' && !placeId.startsWith('soiree:') && (!roaming || menuOpen) && !(outside && inside) && !(lifeAt && !menuOpen && doing?.placeKind === 'chat') && (
        <InteractionMenu world={world} sim={sim} city={city} commune={commune} placeId={placeId} desktop={desktop} onClose={() => (roaming ? setMenuOpen(false) : setPlaceId(null))} onPick={interact} onTravel={travel} onStop={stop} onBuild={() => (setPlaceId(null), setBuilding(0))} soiree={mySoiree} onSoiree={() => (mySoiree ? setPlaceId(`soiree:${mySoiree.id}`) : (setMenuOpen(false), setSoireeAsk(true)))} onFridge={() => (roaming && setMenuOpen(false), setFridgeOpen('open'))} />
      )}
      {/* Le mode vie's moods, skills, relationships (update « mode-vie », components/LifePanels.tsx): the buttons on the side, their panels */}
      {keyOpen(feats, 'mode-vie') && !classic && !defi && !overlay && !players && !chat && !tuto && !(arriving && keyOpen(features, 'arrivee')) && building === false && !sim.prison && !clearView && (
        <LifeButtons sim={sim} world={world} top={!!lifeAt} onResult={apply} side={!simple} />
      )}
      {/* Le mode vie's generations and visitors (components/Famille.tsx): the knock at the door, the family's moments */}
      {keyOpen(feats, 'mode-vie') && !classic && !defi && !tuto && building === false && <FamilleVie sim={sim} home={lifeHere} onResult={apply} />}
      {/* (Out of the house and the places: the wheel of another player tapped in the street.) */}
      {keyOpen(feats, 'mode-vie') && !lifeAt && <PieMenu />}
      {lifeAt && (
        <LifeFeed
          onResult={apply}
          key={lifeAt}
          placeId={lifeAt}
          world={world}
          sim={sim}
          city={city}
          commune={commune}
          canStart={lifeFree && !workTrip && !told && !(lifeHere && timeToGo(sim, world))}
          progress={doing ? Math.min(1, Math.max(0, (sim.gameMinutes - doing.start) / Math.max(1, doing.end - doing.start))) : 0}
          stage={lifeOf(world, sim).stage?.id ?? 'adulte'}
          fridgeOn={keyOpen(feats, 'frigo') && hasFridge(world, sim)}
          gameFor={(it) => !!defiKindOf({ kind: 'do', placeKind: 'home', interaction: it })}
          start={(it, auto) => {
            if (!auto) playAsked.current = it.id
            return interact(it, inside!.kind, auto, lifeAt)
          }}
          eat={(item, auto) => {
            if (!auto) playAsked.current = `frigo-${item}`
            setPlaceId(null)
            setOutside(false)
            setBackTo('home')
            const g = world.groceries?.find((x) => x.id === item)
            return run(g?.label ?? tr('Le frigo'), g?.icon ?? 'refrigerator', 'home', () => api.eatFromFridge(sim.id, item, auto))
          }}
          talk={lifeTalk}
          openFridge={() => setFridgeOpen('open')}
          openChat={(npc, where) => meetRef.current(npc, where, true)}
          stop={() => void stop()}
          onPlay={doing && defiNow && !defi ? () => setDefi(defiNow) : undefined}
          hud={!defi}
        />
      )}
      {/* Le mode vie's lived work day (components/LifeWork.tsx): the card while out, time to go, the day told back home */}
      {workCard && (
        <WorkCard
          sim={sim}
          world={world}
          onResult={apply}
          following={followWork}
          onFollow={() => setFollowWork((f) => !f)}
          tasks={doing?.career && doing.career === sim.career ? <JobTasks world={world} sim={sim} onTask={(t) => new Promise<ActionResult['outcome']>((resolve, reject) => setTaskGame({ t, resolve, reject }))} /> : undefined}
        />
      )}
      {lifeHere && !sim.activity && !workTrip && !told && !pending && !menuOpen && !overlay && !defi && <TimeToGo sim={sim} world={world} onGo={goWork} />}
      {lifeHere && told && !workTrip && !overlay && <BackHome key={told.at} sim={sim} world={world} day={told} onClose={() => (setBackDay(null), setToldTick((n) => n + 1))} />}
      {lifeHere && <Shock sim={sim} />}
      {visiting && !menuOpen && !lifeAt && <SpotSheet />}
      {visiting && !menuOpen && placeId && (
        <SceneActionsFeed world={world} sim={sim} city={city} commune={commune} placeId={placeId} onPick={(it, kind, why) => (why ? toast({ tone: 'error', title: it.label, text: why, money: 0 }) : interact(it, kind))} />
      )}
      {/* Le mode vie: in a place, something being done, its pins stay (a tap opens the wheel: the next order queued, LifeHome). */}
      {!visiting && lifeAt && lifeAt !== 'home' && !!doing && !defi && <SceneActionsFeed world={world} sim={sim} city={city} commune={commune} placeId={lifeAt} onPick={() => undefined} />}
      {roaming && !menuOpen && (
        // Walking about inside (or round the grounds): the place's name, what to do here, the way out.
        // Above the needs, the map and the phone, which stay in reach (it used to cover them on a phone).
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(6.5rem+var(--hud-lift,0px))] z-20 flex justify-center px-3 lg:bottom-[calc(7.5rem+var(--hud-lift,0px))]">
          <div className="hud pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-[26px] p-2">
            <button className="btn btn-soft !px-3 !py-2.5 !text-sm" onClick={() => (placeId === 'home' ? goOut() : setPlaceId(null))}>
              {/* (At a hotel, the way out of the whole hotel: out of one's room is « Sortir de la chambre », up there.) */}
              <LogOut size={18} /> {placeId && commune.places.find((p) => p.id === placeId)?.kind === 'hotel' ? tr('Quitter l’hôtel') : tr('Sortir')}
            </button>
            <div className="min-w-0 flex-1 px-1 text-center leading-tight">
              <div className="truncate font-display text-[15px] font-extrabold">{placeName(placeId!)}</div>
              <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{strolling ? (desktop ? tr('Flèches ou WASD pour visiter') : tr('Le joystick pour visiter')) : desktop ? tr('Marche, clique une icône pour agir') : tr('Marche, touche une icône pour agir')}</div>
            </div>
            <button data-tour="que-faire" className="btn !px-3 !py-2.5 !text-sm" onClick={() => setMenuOpen(true)}>
              <Sparkles size={18} /> {tr('Que faire ?')}
            </button>
          </div>
        </div>
      )}
      {building !== false && (
        <Suspense fallback={null}>
          <BuildMode world={world} sim={sim} lot={building || 0} onResult={apply} onClose={() => (setBuilding(false), setPlotsVersion((v) => v + 1))} />
        </Suspense>
      )}

      <DuelLayer sim={sim} token={token} on={keyOpen(feats, 'combat-joueurs')} act={run} />
      {/* The games against real players (update « jeux-en-ligne »): dames and 8 américain open their board; nobody in the queue, the computer. */}
      <PvpLayer sim={sim} token={token} on={keyOpen(feats, 'jeux-en-ligne')} stage={lifeOf(world, sim).stage?.id} onBoard={(g) => (setOverlay(null), setPhoneApp(null), g === 'dames' ? setDamesOpen(true) : setHuitOpen(true))} onAI={(g) => (PRACTICE.includes(g as DefiKind) ? (setOverlay(null), setPhoneApp(null), setPractice(g as DefiKind)) : (setPhoneApp(g as PhoneAppId), setOverlay('phone')))} />
      <LandscapeHint />
      {players && <PlayersSheet sim={sim} around={around} communeName={commune.name} communes={city.communes} cities={world.cities} myStage={lifeOf(world, sim).stage?.id} onDuel={keyOpen(feats, 'combat-joueurs') ? (p) => void api.challenge(sim.id, p.id).then(() => (setPlayers(null), window.dispatchEvent(new CustomEvent(DUEL_IN)))).catch((e) => toast({ tone: 'error', title: 'Pas possible', text: errorText(e, 'Erreur'), money: 0 })) : undefined} focus={players.focus} act={run} onClose={() => setPlayers(null)} />}

      {/* (Its time up, the bar goes at once: the server is settling it, nothing left to follow.) */}
      {/* (Le mode vie at home: the queue at the top shows it, its progress, its cancel and its game.) */}
      {sim.activity && !ended && !placeId && !defi && !driven && !(lifeAt && doing?.placeId === lifeAt) && !(doing?.shift && keyOpen(feats, 'mode-vie')) && <ActivityBar world={world} onTask={sim.activity.kind === 'do' && sim.activity.career && sim.activity.career === sim.career ? (t) => new Promise<ActionResult['outcome']>((resolve, reject) => setTaskGame({ t, resolve, reject })) : undefined} onDefi={defiNow ? () => (defiNow === 'ski' && setOutside(false), setDefi(defiNow)) : undefined} onRejoin={ballKey && played === ballKey ? { sport: ballSport!, go: rejoin } : undefined} sim={sim} onStop={stop} stopping={!!pending} onRoute={() => setOverlay('map')} onMore={onGrounds ? () => (setPlaceId(doing!.placeId!), setMenuOpen(true)) : undefined} onFilm={() => setWatching(true)} onMachine={doing && isSlots(doing.interaction.id) ? () => setMachineOpen(true) : undefined} onShop={doing && SHOP_OF[doing.interaction.id] ? () => setShopOpen(true) : undefined} onFridge={doing && FRIDGE_SHOPPING.has(doing.interaction.id) && keyOpen(feats, 'frigo') && hasFridge(world, sim) ? () => setFridgeOpen('fill') : undefined} />}
      {/* The ciné-club's film, watched for real (screens/FilmPlayer.tsx). */}
      {watching && doing?.seance?.video && doing.seance.at !== undefined && <FilmPlayer video={doing.seance.video} at={doing.seance.at} title={doing.seance.title ?? doing.interaction.label} credit={doing.seance.credit} file={doing.seance.file} onClose={() => setWatching(false)} />}

      {/* The invitation and the toasts in one column under the top bar: they stack, never on top of each other */}
      {/* (A phone held sideways, the screen low: narrower, and the last toast only, so the street stays in sight.) */}
      <div className={`pointer-events-none absolute top-[5.5rem] left-1/2 z-40 ${defi ? 'hidden' : 'flex'} w-[min(400px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2 lg:top-24 short:top-[4.25rem] short:w-[min(340px,calc(100vw-24px))] short:gap-1.5 short:[&>.toast-card:not(:last-child)]:hidden`}>
        {!players && !placeId && !overlay && !damesOpen && around.dames && !damesSeen.includes(around.dames.id) && (
          <DamesBanner
            dame={around.dames}
            onOpen={() => setDamesOpen(true)}
            onDecline={() => {
              const d = around.dames!
              setDamesSeen((s) => [...s, d.id])
              void api.damesAct(sim.id, d.id, 'decline').then(refreshPlayers, () => undefined)
            }}
            onAccept={() => {
              const d = around.dames!
              void run('Une partie de dames', 'crown', 'social', () => api.damesAccept(sim.id, d.id)).then((ok) => ok && setDamesOpen(true))
            }}
          />
        )}
        {!players && !placeId && !overlay && !huitOpen && around.huit && !huitSeen.includes(around.huit.id) && (
          <HuitBanner
            game={around.huit}
            onOpen={() => setHuitOpen(true)}
            onDecline={() => {
              const h = around.huit!
              setHuitSeen((s) => [...s, h.id])
              void api.huitAct(sim.id, h.id, 'decline').then(refreshPlayers, () => undefined)
            }}
            onAccept={() => {
              const h = around.huit!
              void run('Une partie de 8 américain', 'sparkles', 'social', () => api.huitAccept(sim.id, h.id)).then((ok) => ok && setHuitOpen(true))
            }}
          />
        )}
        {!players && !placeId && !overlay && !clearView && (() => {
          const inv = around.invites.find((i) => !dismissed.includes(i.id))
          return inv ? (
            <InviteBanner
              key={inv.id}
              invite={inv}
              onAnswer={(a) => (setDismissed((d) => [...d, inv.id]), run(a === 'accepter' ? `Rejoindre ${inv.fromName}` : 'Refuser', a === 'accepter' ? 'users' : 'x', 'social', () => api.answerInvite(sim.id, inv.id, a)))}
            />
          ) : null
        })()}
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>

      {overlay === 'phone' && (
        <Phone
          onAutoWork={async (on) => {
            const r = await api.autoWork(sim.id, on).catch(() => null)
            if (r) setBase((b) => (b ? { ...b, sim: { ...b.sim, autoWork: r.autoWork } } : b))
          }}
          world={world}
          sim={sim}
          commune={ownPlaces(commune)}
          at={inside?.id ?? doing?.placeId ?? placeId ?? null}
          journal={journal}
          time={c.time}
          act={run}
          startApp={phoneApp}
          direct={phoneDirect && phoneApp === 'gbairai'}
          gifts={gifts}
          achat={achat}
          onResult={apply}
          onConfirmAdult={async () => {
            const u = await api.confirmAdult()
            if (token) useSession.getState().signIn(token, u)
          }}
          delivery={delivery}
          onDelivery={setDelivery}
          // (The phone put away: the meal is seen being eaten.)
          onCollect={(home) => (setOverlay(null), setPhoneApp(null), collect(home))}
          onClose={() => (setOverlay(null), setPhoneApp(null), setPhoneDirect(false))}
          onMap={() => setOverlay('map')}
          onCamera={() => (setPhoneApp(null), setOverlay('camera'))}
          onFlashe={() => (setPhoneApp(null), setOverlay('flashe'))}
          onPractice={(k) => (setOverlay(null), setPhoneApp(null), setPractice(k))}
          street={!showInside}
          onWalk={walkTo}
          onBuild={(lot) => (setOverlay(null), setBuilding(lot ?? 0))}
          onDames={(p) => (setOverlay(null), setPhoneApp(null), setDamesAsk({ with: p.id, name: p.firstName, max: 10000 }))}
          onDamesOnline={(name) => (setOverlay(null), setPhoneApp(null), setDamesAsk({ with: 'npc', name, max: 2000 }))}
          onDamesResume={() => (setOverlay(null), setPhoneApp(null), setDamesOpen(true))}
          onHuitTable={(npcs) => (setOverlay(null), setPhoneApp(null), setHuitAsk({ with: 'npc', name: npcs.join(', '), npcs, max: 2000 }))}
          onHuitFriend={(p) => (setOverlay(null), setPhoneApp(null), setHuitAsk({ with: p.id, name: p.firstName, max: 10000 }))}
          onHuitResume={() => (setOverlay(null), setPhoneApp(null), setHuitOpen(true))}
          onDrive={(v) => (setOverlay(null), setPhoneApp(null), setPlaceId(null), setOutside(true), startDrive(v))}
          onTravel={travel}
        />
      )}
      {/* At the wheel: the pedals, the wheel, the speed, and to park */}
      {placingLot && <LotPlaceHud />}
      {/* Live on Tikitoko: the bar over the game (the viewers, the hearts, the mic, the chat) */}
      <LiveBar sim={sim} doing={doing ? `${doing.interaction.label} · ${placeName(doing.placeId ?? '')}` : commune.name} pose={() => (whereabouts.simPose === 'moto' || whereabouts.simPose === 'drive' ? 'sit' : whereabouts.simPose)} />
      {driven && <DriveHud driven={driven} onPark={park} onWhere={() => setWhereTo(true)} onParkAt={(id) => (park(), walkTo(id))} />}
      {/* Its vehicle parked near: get back in */}
      {!driven && !showInside && !placeId && !overlay && !sim.activity && !sim.prison && <GetIn simId={sim.id} commune={commune.id} />}
      {/* An ordinary building at hand: go in; inside one, its name and the way out (world3d/visit.ts) */}
      {!classic && !driven && !visit && !showInside && !placeId && !overlay && !sim.activity && !sim.prison && nearBuilding && (
        <div className="absolute inset-x-0 bottom-[calc(7.4rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 flex justify-center px-3">
          <button className="btn animate-pop max-w-full !px-4 !py-2.5 !text-sm" onClick={() => ((visitCommune.current = sim.commune), setVisit(nearBuilding))}>
            <DoorOpen size={17} strokeWidth={2.6} /> <span className="truncate">{tr('Entrer')} · {nearBuilding.name}</span>
          </button>
        </div>
      )}
      {visit && showInside && (
        <div className="absolute top-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+3.5rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
          <span className="hud rounded-full px-3 py-1.5 text-xs font-extrabold whitespace-nowrap">{visit.name}</span>
          <button className="btn !px-3 !py-1.5 !text-xs" onClick={() => setVisit(null)}>
            {tr('Sortir')}
          </button>
        </div>
      )}
      {/* Vélo Babi: hire one at the commune's station, the time left, locked when it's up (components/BikeShare.tsx) */}
      {!showInside && !placeId && !overlay && <BikeShare sim={sim} run={run} />}
      {emotesOpen && <EmoteSheet world={world} sim={sim} onClose={() => setEmotesOpen(false)} onResult={apply} />}
      {damesAsk && <DamesStake against={damesAsk.name} max={damesAsk.max} money={sim.money} onClose={() => setDamesAsk(null)} onPick={(stake) => void startDames(damesAsk, stake)} />}
      {huitAsk && <HuitStake against={huitAsk.name} max={huitAsk.max} money={sim.money} onClose={() => setHuitAsk(null)} onPick={(stake) => void startHuit(huitAsk, stake)} />}
      {huitOpen && (
        <HuitSheet
          simId={sim.id}
          me={{ name: sim.firstName, look: sim.look, gender: sim.gender }}
          onClose={() => (setHuitOpen(false), refreshPlayers())}
          onAgain={(npcs, stake) => (setHuitOpen(false), void startHuit({ with: 'npc', npcs }, stake))}
          onMoney={() => void api.sim(sim.id).then(apply, () => undefined)}
        />
      )}
      {damesOpen && (
        <DamesSheet
          simId={sim.id}
          me={{ name: sim.firstName, look: sim.look, gender: sim.gender }}
          onClose={() => (setDamesOpen(false), refreshPlayers())}
          onAgain={(npc) => (setDamesOpen(false), setDamesAsk({ with: 'npc', name: npc, max: 2000 }))}
          onMoney={() => void api.sim(sim.id).then(apply, () => undefined)}
        />
      )}
      {overlay === 'flashe' && (
        <Suspense fallback={null}>
          <FlasheApp world={world} sim={sim} street={!showInside} act={run} onClose={() => setOverlay(null)} />
        </Suspense>
      )}
      {overlay === 'camera' && <CameraView sim={sim} street={!showInside} onClose={() => setOverlay(null)} onGallery={() => (setPhoneApp('galerie'), setOverlay('phone'))} />}
      {overlay === 'map' && <WorldMap world={world} sim={sim} night={c.isNight} desktop={desktop} onClose={() => setOverlay(null)} onTravel={travel} onWalk={(id) => (setOverlay(null), walkTo(id))} />}
      {delivery && overlay !== 'phone' && <DeliveryPill delivery={delivery} now={now} low={simple} onOpen={() => (setPhoneApp('golvo'), setOverlay('phone'))} />}
      {defi && defiAct.current && (
        <DefiSheet
          kind={defi}
          act={defiAct.current.interaction}
          career={defiAct.current.career}
          simId={sim.id}
          big={defiAct.current.interaction.id === 'supermarche'}
          older={lifeOf(world, sim).stage?.id === 'ado'}
          interactionId={defiAct.current.interaction.id}
          me={sim}
          send={async (score, extra) => {
            try {
              const res = await api.defi(sim.id, defi, score, extra)
              apply(res)
              // The jam regulated: the street asked again (cleared, its cars drive off for everyone there).
              if (defi === 'circulation') setStreetAsk((n) => n + 1)
              return res
            } catch (e) {
              toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : tr('Pas possible'), text: errorText(e, tr('Erreur')), money: 0 })
              return null
            }
          }}
          onResult={apply}
          onClose={() => {
            // An action left without playing it isn't done (no clock to finish it any more): it stops. (The baby's games too.)
            // (Le mode vie: left to play by itself, it goes on by itself; asked to be played, it's left to play by itself from now on.)
            const life = lifeHere && sim.activity?.placeId === 'home' && GESTE_DEFIS.has(defi)
            if (life && sim.activity && !sim.activity.defi && !sim.activity.auto) void api.lifeAuto(sim.id).then(apply, () => stop())
            else if ((GESTE_DEFIS.has(defi) || BABY_DEFIS.has(defi) || defi === 'circulation' || defi === 'evenement' || defi === 'epreuve') && sim.activity && !sim.activity.defi && !(life && sim.activity.auto)) stop()
            setDefi(null)
          }}
        />
      )}
      {taskGame && sim.activity?.career && (
        <div className="fixed inset-0 z-[70]">
          <Suspense fallback={null}>
          <JeuDefi
            act={{ id: `task:${sim.activity.career}:${taskGame.t.id}`, icon: taskGame.t.icon, label: taskGame.t.label }}
            jeu={JEUX[`task:${sim.activity.career}:${taskGame.t.id}`]}
            onEnd={(score) => {
              const { t, resolve, reject } = taskGame
              setTaskGame(null)
              api
                .jobTask(sim.id, t.id, score)
                .then((res) => (apply(res), gesture(t.pose as Pose), resolve(res.outcome)))
                .catch(reject)
            }}
          />
          </Suspense>
          <button className="absolute top-12 right-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white" onClick={() => (taskGame.reject(new Error('Tâche laissée tombée.')), setTaskGame(null))} aria-label={tr('Laisser tomber la tâche')}>
            <X size={17} strokeWidth={2.6} />
          </button>
        </div>
      )}
      {practice && !defi && <DefiSheet kind={practice} simId={sim.id} me={sim} practice onResult={apply} onClose={() => setPractice(null)} />}
      {drawerOpen && gifts.on && <GiftsSheet world={world} sim={sim} view={gifts.view} onResult={apply} onOpened={gifts.reload} onClose={() => setDrawerOpen(false)} />}
      {fridgeOpen && <FridgeSheet world={world} sim={sim} how={fridgeOpen} onResult={apply} onClose={() => setFridgeOpen(null)} onStarted={() => (setPlaceId(null), setMenuOpen(false), setOutside(false), setBackTo('home'))} />}
      {shopOpen && doing && SHOP_OF[doing.interaction.id] && <ClothesShop world={world} sim={sim} shop={SHOP_OF[doing.interaction.id]} onResult={apply} onClose={() => setShopOpen(false)} onLeave={() => (setShopOpen(false), stop())} />}
      {machineOpen && doing && isSlots(doing.interaction.id) && (
        <MachineSheet
          world={world}
          sim={sim}
          adultAccount={!!user?.adult}
          onConfirmAdult={async () => {
            const u = await api.confirmAdult()
            if (token) useSession.getState().signIn(token, u)
          }}
          spin={async (stake) => {
            try {
              return await api.machineSpin(sim.id, stake)
            } catch (e) {
              toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : tr('Pas possible'), text: errorText(e, tr('Erreur')), money: 0 })
              return null
            }
          }}
          onResult={apply}
          onLeave={() => (setMachineOpen(false), stop())}
          onClose={() => setMachineOpen(false)}
        />
      )}
      {/* A défi taken on from someone (a message, a link): played for fun, the score to send back */}
      {challenge && !defi && (
        <>
          {challenge.kind === 'ski' && (
            <div className="absolute inset-0 z-40 bg-[var(--color-night)]">
              <Suspense fallback={null}>
                <BoulayScene sim={sim} interactionId="ski-boulay" night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
              </Suspense>
            </div>
          )}
          <DefiSheet kind={challenge.kind} simId={sim.id} me={sim} challenge={{ score: challenge.score, from: challenge.from }} onResult={apply} onClose={() => challengeWith(null)} />
        </>
      )}
      {sharing && <ShareSheet sharing={sharing} onClose={() => shareThis(null)} />}
      {!overlay && (dropAsk ? <DropRouteAsk from={dropAsk.from} moto={dropAsk.moto} /> : <MotoOffer
                world={world}
                sim={sim}
                commune={commune}
                act={run}
                onOwn={keyOpen(feats, 'ma-voiture') && !driven ? driveOwn : undefined}
                onTaken={
                  keyOpen(feats, 'trajet-court')
                    ? (r) => {
                        // It pulls up at the kerb, the Sim gets in (world3d/open/tripDrop), then the loading screen.
                        const to = whereabouts.way?.to ?? commune.name
                        let shown = false
                        const show = () => void (shown || ((shown = true), setTownRide({ ...r, to })))
                        setDrop({ pickup: true, mode: r.kind === 'taxi' ? 'compteur' : r.kind, fromCity: sim.city, fromCommune: sim.commune, at: performance.now(), onIn: show })
                        // (No street seen here, the classic view: straight to the loading screen.)
                        setTimeout(show, 7000)
                      }
                    : undefined
                }
              />)}
      {/* On a flight: the plane over the clouds (the map is a tap away) */}
      {townRide && (
        <TripLoading
          mode={townRide.kind}
          to={townRide.to}
          color={townRide.color}
          trim={townRide.trim}
          onDone={() => {
            rideThere()
            setTownRide(null)
            setDrop({ mode: townRide.kind === 'taxi' ? 'compteur' : townRide.kind, fromCity: sim.city, fromCommune: sim.commune, at: performance.now() })
          }}
        />
      )}
      {ride && rideDone !== ride.start && rideIn === ride.start && (() => {
        const t = ride.trip!
        const to = world.cities.find((c) => c.id === t.city)?.communes.find((c) => c.id === t.commune)?.name ?? t.commune
        const from = world.cities.find((c) => c.id === t.fromCity)?.communes.find((c) => c.id === t.fromCommune)
        const look = rideLook(world, t.mode, from, t.class)
        return (
          <TripLoading
            key={ride.start}
            mode={t.mode}
            to={to}
            color={look.color}
            trim={look.trim}
            own={t.mode === 'perso' ? t.vehicle : undefined}
            rider={t.mode === 'perso' ? { look: sim.look, gender: sim.gender, stage: lifeOf(world, sim).stage?.id ?? 'adulte' } : undefined}
            onDone={() => {
              setRideDone(ride.start)
              if (t.mode === 'perso') ownShown.current = ride.start
              // (Already over by itself, a very short ride: there all the same, the vehicle dropping the Sim. One's own
              // vehicle: parked where it arrives, ownTrip above.)
              const drop = () => t.mode !== 'perso' && setDrop({ mode: t.mode, class: t.class, fromCity: t.fromCity, fromCommune: t.fromCommune, at: performance.now() })
              void api.arrive(sim.id).then((res) => (apply(res), drop()), drop)
            }}
          />
        )
      })()}
      {/* In one's own vehicle across town (« ma-voiture »), the trip over before its screen came: the screen now, then parked there */}
      {ownLoading && <TripLoading mode="perso" to={ownLoading.to} own={ownLoading.v} rider={{ look: sim.look, gender: sim.gender, stage: lifeOf(world, sim).stage?.id ?? 'adulte' }} onDone={() => (ownLoading.done(), setOwnLoading(null))} />}
      {/* From city to city (« voyages-villes »): boarding, the short trip, the arrival, all in 3D */}
      {cityTrip && cityTripDone !== cityTrip.start && (
        <CityTrip
          key={cityTrip.start}
          world={world}
          sim={sim}
          night={c.isNight}
          onDone={() => {
            const t = cityTrip.trip!
            setCityTripDone(cityTrip.start)
            setLanded({ commune: t.commune, place: t.place! })
            void api.arrive(sim.id).then(apply, () => undefined)
          }}
        />
      )}
      {!overlay && !cityTrip && sim.activity?.kind === 'travel' && sim.activity.trip?.mode === 'avion' && <FlightView sim={sim} night={c.isNight} onMap={() => setOverlay('map')} />}
      {!overlay && sim.activity?.kind === 'travel' && sim.activity.trip?.mode === 'metro' && <MetroView world={world} sim={sim} night={c.isNight} onMap={() => setOverlay('map')} />}
      {chat && (
        <ChatSheet
          npc={chat}
          simGender={sim.gender}
          onSay={say}
          onType={keyOpen(features, 'chat-libre') ? sayFree : undefined}
          onClose={endChat}
          onDames={/^(grin:|dames-)/.test(chat.id) && lifeOf(world, sim).stage?.id !== 'enfant' ? () => (setChat(null), setDamesAsk({ with: 'npc', name: chat.name, max: 2000 })) : undefined}
          onBye={endChat}
          languages={sim.languages ?? []}
          onLanguages={async (langs) => {
            const r = await api.setLanguages(sim.id, langs).catch(() => null)
            if (r) setBase((b) => (b ? { ...b, sim: { ...b.sim, languages: r.languages } } : b))
          }}
          gameMinutes={sim.gameMinutes}
          friend={sim.friends?.find((f) => f.id === `p-${chat.id}`)}
          taken={sim.friends?.find((f) => f.partner && f.id !== `p-${chat.id}`)?.name}
          grownUp={!lifeOf(world, sim).minor}
          baby={lifeOf(world, sim).stage?.id === 'bebe'}
          adultAccount={!!user?.adult}
          onConfirmAdult={async () => {
            const u = await api.confirmAdult()
            if (token) useSession.getState().signIn(token, u)
          }}
        />
      )}
      {flow && <RideFlow world={world} req={flow} gameMinutes={sim.gameMinutes} me={{ look: sim.look, gender: sim.gender, stage: lifeOf(world, sim).stage?.id ?? 'adulte' }} onBoard={board} onClose={() => setFlow(null)} />}
    </div>
  )
}

/* ---------- The in-game phone ---------- */

/** Who may open Gbairai (its own button by the phone, and the phone's icon): the phone's owner with the app, a
 * child through « gbairai-bebe », a minor writing to papa and maman (« gbairai-parents »). */
function gbairaiAccess(world: World, sim: Sim, feats: ReturnType<typeof useFeatures>) {
  const life = lifeOf(world, sim)
  const ownPhone = !life.minor || life.age >= 12
  const friends = (ownPhone && (sim.apps?.includes('gbairai') ?? false) && keyOpen(feats, 'app:gbairai')) || keyOpen(feats, 'gbairai-bebe')
  const parents = keyOpen(feats, 'gbairai-parents') && life.minor && life.stage?.id !== 'bebe'
  return { friends, parents, any: friends || parents }
}

type PhoneAppId = 'papiers' | 'rendezvous' | 'airlagune' | 'inviter' | 'mentor' | 'demandes' | 'here' | 'jobs' | 'home' | 'messages' | 'news' | 'store' | 'waye' | 'golvo' | 'friends' | 'gbairai' | 'tikitoko' | 'babigram' | 'bet225' | 'parisfoot' | 'bingo' | 'casino' | 'galerie' | 'guide' | 'dodo' | 'kineo' | 'dames' | 'huit' | 'awale' | 'billard' | 'ludo' | 'gode' | 'bolide' | 'jeux' | 'boutique' | 'idees' | 'politique' | 'reglages'
type PhoneProps = {
  /** Off somewhere (the Air Lagune app's flights, the way to the airport): screens/Play's travel. */
  onTravel: OnTravel
  world: World
  sim: Sim
  commune: Commune
  /** The place the Sim is in (inside it, or just picked there): the Politique app votes at a mairie. */
  at: string | null
  /** The Boulot app's switch: to work by oneself as the shift's hours come. */
  onAutoWork: (on: boolean) => Promise<void>
  journal: JournalEvent[]
  time: string
  act: Act
  startApp: PhoneAppId | null
  /** Opened straight on an app (the Gbairai button): leaving the app puts the phone away. */
  direct?: boolean
  /** The friends' gifts (update « parrainage »): the « Inviter » app. */
  gifts: ReturnType<typeof useFriendGifts>
  /** Back from GeniusPay: the purchase the Boutique asks about. */
  achat: { id: string; failed: boolean } | null
  /** Something bought in an app outside `act` (the Boutique's clothes): the Sim after it. */
  onResult: (r: ActionResult) => void
  /** The account says it's 18 or over (the Boutique's purchases need it). */
  onConfirmAdult: () => Promise<void>
  delivery: Delivery | null
  onDelivery: (d: Delivery | null) => void
  onCollect: (home: boolean) => void
  onClose: () => void
  onMap: () => void
  /** The camera, full screen over the game. */
  onCamera: () => void
  /** Flashé, full screen over the game too (its camera sees the street). */
  onFlashe: () => void
  /** One of the « Jeux », for practice (nothing sent). */
  onPractice: (kind: DefiKind) => void
  /** Out in the street (else in a room): what Tikitoko films. */
  street: boolean
  onWalk: (id: string) => void
  onBuild: (lot?: number) => void
  /** Challenge a player friend to a game of dames. */
  onDames: (p: Player) => void
  /** Sit down at Dames 225 with a player online (their name). */
  onDamesOnline: (name: string) => void
  /** Back to the board of the game going on. */
  onDamesResume: () => void
  /** Sit down at a table of 8 américain with the game's players (their names). */
  onHuitTable: (npcs: string[]) => void
  /** Challenge a player friend to 8 américain. */
  onHuitFriend: (p: Player) => void
  /** Back to the table of the game going on. */
  onHuitResume: () => void
  /** At the wheel of one's own vehicle (Bolide). */
  onDrive: (v: Driven) => void
}

function Phone({ world, sim, commune, at, onAutoWork, journal, time, act, startApp, direct, gifts, achat, onResult, onConfirmAdult, delivery, onDelivery, onCollect, onClose, onMap, onCamera, onFlashe, onPractice, street, onWalk, onBuild, onDames, onDamesOnline, onDamesResume, onHuitTable, onHuitFriend, onHuitResume, onDrive, onTravel }: PhoneProps) {
  const [app, setApp] = useState<PhoneAppId | null>(startApp)
  // Adjamé Storm 4 in the « Jeux » once its update is open (« combat-arene »).
  const storm = useKeyOpen('storm')
  // A photo of the gallery on its way to Tikitoko.
  const [tikiPhoto, setTikiPhoto] = useState<{ id: number; src: string } | undefined>()
  // A photo of the gallery on its way to Babigram.
  const [gramPhoto, setGramPhoto] = useState<{ id: number; src: string } | undefined>()
  // A player friend to send money to, picked in Amis.
  const [wayeTo, setWayeTo] = useState<string | undefined>()
  const navigate = useNavigate()
  // Like a phone's own: an app grows out of its icon and shrinks back into it;
  // the phone slides down when put away; on a real phone, the edge swiped
  // back and the home bar swiped up.
  const screen = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [origin, setOrigin] = useState('50% 50%')
  const [leaving, setLeaving] = useState(false)
  const [away, setAway] = useState(false)
  const openFrom = (e: React.MouseEvent, open: () => void) => {
    const r = screen.current?.getBoundingClientRect()
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (r) setOrigin(tr('{0}px {1}px', { 0: b.left + b.width / 2 - r.left, 1: b.top + b.height / 2 - r.top }))
    open()
  }
  const goHome = () => {
    // Straight in from the game: back out to the game, not to the home screen.
    if (direct) return putAway()
    if (leaving) return
    setLeaving(true)
    setTimeout(() => (setApp(null), setLeaving(false)), 200)
  }
  const putAway = () => {
    if (away) return
    setAway(true)
    setTimeout(onClose, 220)
  }
  const swipe = useRef<{ x: number; y: number; t: number; kind: 'back' | 'home' } | null>(null)
  const swipeStart = (kind: 'back' | 'home') => (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, kind }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const swipeMove = (e: React.PointerEvent) => {
    const g = swipe.current
    const el = g?.kind === 'back' ? panel.current : screen.current
    if (!g || !el) return
    el.style.transition = 'none'
    if (g.kind === 'back') el.style.transform = `translateX(${Math.max(0, e.clientX - g.x)}px)`
    else {
      const up = Math.max(0, g.y - e.clientY)
      el.style.transform = `translateY(${-up * 0.6}px) scale(${1 - Math.min(0.25, up / 900)})`
    }
  }
  const swipeEnd = (e: React.PointerEvent) => {
    const g = swipe.current
    swipe.current = null
    const el = g?.kind === 'back' ? panel.current : screen.current
    if (!g || !el) return
    const d = g.kind === 'back' ? e.clientX - g.x : g.y - e.clientY
    const fast = d / Math.max(1, e.timeStamp - g.t) > 0.5
    const tap = Math.abs(d) < 6 && Math.abs(e.clientY - g.y) < 6
    el.style.transition = 'transform 0.3s var(--ease-out)'
    if (g.kind === 'back' && (d > 110 || (d > 30 && fast))) {
      el.style.transform = 'translateX(100%)'
      return void setTimeout(() => (direct ? onClose() : setApp(null)), 230)
    }
    el.style.transform = ''
    if (g.kind === 'home' && (tap || d > 60 || (d > 20 && fast))) {
      if (app) goHome()
      else putAway()
    }
  }
  // On a computer, Échap goes back: out of the app, then the phone away.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (app) goHome()
      else putAway()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [app, onClose]) // eslint-disable-line react-hooks/exhaustive-deps
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id
  const places = [...(home ? [{ id: 'home', name: tr('Chez toi'), kind: 'home' }] : []), ...commune.places]
  const city = world.cities.find((c) => c.id === sim.city)!

  const life = lifeOf(world, sim)
  // A phone of one's own comes at 12; work and rent at 18.
  const ownPhone = !life.minor || life.age >= 12
  // (An app an update hasn't opened yet doesn't show, even installed: lib/features.ts.)
  const feats = useFeatures()
  const has = (id: string) => ownPhone && (sim.apps?.includes(id) ?? false) && keyOpen(feats, `app:${id}`)
  // Gbairai's « Rendez-vous » strip tapped with the phone already out: straight to the app.
  useEffect(() => {
    const open = () => setApp('rendezvous')
    window.addEventListener(RENDEZVOUS_OPEN, open)
    return () => window.removeEventListener(RENDEZVOUS_OPEN, open)
  }, [])
  // A rendez-vous' « Y aller »: its app (Dames 225, Politique), or the place in the commune (a maquis, the
  // quarter's pitch), else the map (the soirées' lights, another commune).
  const goRendezVous = (it: RendezVousItem) => {
    if (it.mode === 'dames') return setApp(has('dames') ? 'dames' : 'store')
    if (it.mode === 'politique') return setApp('politique')
    const here = !it.commune || (sim.city === 'abidjan' && commune.id === it.commune)
    if (!here || it.mode === 'soiree') return onMap()
    // The nearest of its kind around (as the next goal's « Y aller »).
    goToKind(it.mode === 'maquis' ? 'maquis' : 'sport', commune, (id) => (onClose(), onWalk(id)), onMap)
  }
  // Gbairai from the cradle (update « gbairai-bebe »): babies and children write to their friends too, without a phone.
  // Papa and maman in Gbairai from 3 (update « gbairai-parents »): before 12, only them unless « gbairai-bebe ».
  const { friends: gbairaiFriends, parents: gbairaiParents, any: gbairai } = gbairaiAccess(world, sim, feats)
  // Babi Pub: the advertisers' apps on the home screen (features « pubs-applis »), with their icon.
  const adApps = useAds(ownPhone && keyOpen(feats, 'pubs-applis') ? sim.commune : undefined, 'telephone').filter((ad) => ad.icon && ad.appName && ad.link)
  // Apps from the store, once installed. The ride apps open the map to pick where to go.
  const STORE_APPS: { id: string; label: string; open: () => void }[] = [
    // Before 12 the Store is there, locked: it says when the phone comes.
    { id: 'store', label: tr('Store'), open: () => setApp('store') },
    ...(has('waye') ? [{ id: 'waye', label: tr('Waye'), open: () => setApp('waye') }] : []),
    ...(gbairai ? [{ id: 'gbairai', label: tr('Gbairai'), open: () => setApp('gbairai') }] : []),
    ...(has('tikitoko') ? [{ id: 'tikitoko', label: tr('Tikitoko'), open: () => setApp('tikitoko') }] : []),
    ...(has('babigram') ? [{ id: 'babigram', label: tr('Babigram'), open: () => setApp('babigram') }] : []),
    ...(has('flashe') ? [{ id: 'flashe', label: tr('Flashé'), open: onFlashe }] : []),
    ...(has('bet225') ? [{ id: 'bet225', label: tr('Bet225'), open: () => setApp('bet225') }] : []),
    ...(has('parisfoot') ? [{ id: 'parisfoot', label: tr('ParisFoot'), open: () => setApp('parisfoot') }] : []),
    ...(has('bingo') ? [{ id: 'bingo', label: tr('Babi Bingo'), open: () => setApp('bingo') }] : []),
    ...(has('casino') ? [{ id: 'casino', label: tr('Babi Casino'), open: () => setApp('casino') }] : []),
    ...(has('gode') ? [{ id: 'gode', label: tr('Godé'), open: () => setApp('gode') }] : []),
    ...(has('golvo') ? [{ id: 'golvo', label: tr('Garbaya'), open: () => setApp('golvo') }] : []),
    ...(has('dodo') ? [{ id: 'dodo', label: tr('Dodo'), open: () => setApp('dodo') }] : []),
    ...(has('kineo') ? [{ id: 'kineo', label: tr('Kinéo'), open: () => setApp('kineo') }] : []),
    ...(has('bolide') ? [{ id: 'bolide', label: tr('Bolide'), open: () => setApp('bolide') }] : []),
    ...(has('dames') ? [{ id: 'dames', label: tr('Dames'), open: () => setApp('dames') }] : []),
    ...(has('huit') ? [{ id: 'huit', label: tr('8 américain'), open: () => setApp('huit') }] : []),
    ...(has('awale') ? [{ id: 'awale', label: tr('Awalé'), open: () => setApp('awale') }] : []),
    ...(has('billard') ? [{ id: 'billard', label: tr('Billard'), open: () => setApp('billard') }] : []),
    ...(has('ludo') ? [{ id: 'ludo', label: tr('Ludo'), open: () => setApp('ludo') }] : []),
    ...(has('gnango') ? [{ id: 'gnango', label: tr('Gnango'), open: onMap }] : []),
    ...(has('idrive') ? [{ id: 'idrive', label: tr('iDrive'), open: onMap }] : []),
    // The airline's (« voyages-villes »): its flights from the city's airport.
    ...(has(AIRLINE_APP) ? [{ id: AIRLINE_APP, label: tr('Air Lagune'), open: () => setApp('airlagune') }] : []),
  ]
  type Tile = { id: string; label: string; icon: LucideIcon; colors: [string, string]; open: () => void }
  const APPS = (
    [
    { id: 'map', label: tr('Carte'), icon: MapIcon, colors: ['#69e2a0', '#00a862'], open: onMap },
    { id: 'here', label: tr('Quartier'), icon: MapPin, colors: ['#ffa040', '#ff6a00'], open: () => setApp('here') },
    { id: 'jobs', label: tr('Boulot'), icon: Briefcase, colors: ['#64b5ff', '#2a6cf0'], open: () => setApp('jobs') },
    { id: 'home', label: tr('Logement'), icon: House, colors: ['#ffb347', '#ff7a00'], open: () => setApp('home') },
    { id: 'news', label: tr('Infos'), icon: Newspaper, colors: ['#ff8a65', '#e8590c'], open: () => setApp('news') },
    { id: 'messages', label: tr('Messages'), icon: MessageCircle, colors: ['#b39dff', '#6c47ff'], open: () => setApp('messages') },
    { id: 'friends', label: tr('Amis'), icon: Users, colors: ['#ffa8c5', '#e83e8c'], open: () => setApp('friends') },
    ...(ownPhone
      ? [
          { id: 'camera', label: tr('Caméra'), icon: Camera, colors: ['#9aa5b8', '#3d4659'], open: onCamera },
          { id: 'galerie', label: tr('Galerie'), icon: Images, colors: ['#ffd36e', '#ff8a3d'], open: () => setApp('galerie') },
        ]
      : []),
    { id: 'jeux', label: tr('Jeux'), icon: Gamepad2, colors: ['#c49bff', '#7048e8'], open: () => setApp('jeux') },
    { id: 'guide', label: tr('Encyclo'), icon: BookOpen, colors: ['#9fa8ff', '#4b4fd6'], open: () => setApp('guide') },
    { id: 'boutique', label: tr('Boutique'), icon: ShoppingBag, colors: ['#ffc233', '#e07800'], open: () => setApp('boutique') },
    { id: 'idees', label: tr('Idées'), icon: Lightbulb, colors: ['#ffe066', '#f5a000'], open: () => setApp('idees') },
    // The quartier's demandes of the day (an update: « demandes »).
    ...(keyOpen(feats, 'demandes') ? [{ id: 'demandes', label: tr('Demandes'), icon: HandHelping, colors: ['#8ce99a', '#2b8a3e'] as [string, string], open: () => setApp('demandes') }] : []),
    // The family's mentor, from 18 (an update: « mentor »).
    ...(!life.minor && keyOpen(feats, 'mentor') ? [{ id: 'mentor', label: tr('Mentor'), icon: GraduationCap, colors: ['#ffd36e', '#c98a00'] as [string, string], open: () => setApp('mentor') }] : []),
    // One's link to send to friends, and the gifts they brought (an update: « parrainage »).
    ...(gifts.on ? [{ id: 'inviter', label: tr('Inviter'), icon: Gift, colors: ['#ffb066', '#e8590c'] as [string, string], open: () => setApp('inviter') }] : []),
    ...(keyOpen(feats, 'app:politique') ? [{ id: 'politique', label: tr('Politique'), icon: Landmark, colors: ['#8c9eff', '#3d4fd6'] as [string, string], open: () => setApp('politique') }] : []),
    // The week's rendez-vous at fixed times (update « rendez-vous »).
    ...(keyOpen(feats, 'rendez-vous') ? [{ id: 'rendezvous', label: tr('Rendez-vous'), icon: CalendarClock, colors: ['#ffd36e', '#e8590c'] as [string, string], open: () => setApp('rendezvous') }] : []),
    // The Sim's documents, the game's own (update « papiers », components/Papiers.tsx).
    ...(keyOpen(feats, 'papiers') ? [{ id: 'papiers', label: tr('Papiers'), icon: IdCard, colors: ['#ffb066', '#00a37a'] as [string, string], open: () => setApp('papiers') }] : []),
    // How the game is shown on this phone: held sideways (components/Reglages.tsx).
    { id: 'reglages', label: tr('Réglages'), icon: Settings, colors: ['#b8c0cc', '#5c6676'], open: () => setApp('reglages') },
    { id: 'profile', label: tr('Profil'), icon: UserRound, colors: ['#ff8a9b', '#ff3d57'], open: () => navigate('/profil', { viewTransition: true }) },
    ] as Tile[]
  ).filter((a) => !life.minor || (a.id !== 'jobs' && a.id !== 'home'))
  // The dock: the map, the messages, the friends, the camera (when the phone is one's own; else the games).
  const DOCK = ['map', 'messages', 'friends', ownPhone ? 'camera' : 'jeux']
  const title: Record<PhoneAppId, string> = { airlagune: tr('Air Lagune'), inviter: tr('Inviter mes amis'), mentor: tr('Ton mentor'), demandes: tr('Demandes du quartier'), bingo: tr('Babi Bingo'), casino: tr('Babi Casino'), here: commune.name, jobs: tr('Boulot'), home: tr('Logement'), messages: tr('Messages'), news: tr('Infos · Côte d’Ivoire'), store: tr('Store'), waye: tr('Waye'), golvo: tr('Garbaya'), friends: tr('Amis'), gbairai: tr('Gbairai'), tikitoko: tr('Tikitoko'), babigram: tr('Babigram'), bet225: 'Bet225', parisfoot: 'ParisFoot', galerie: tr('Galerie'), guide: tr('Encyclopédie de Babi'), dodo: tr('Dodo'), kineo: tr('Kinéo'), dames: tr('Dames 225'), huit: tr('8 américain'), awale: tr('Awalé 225'), billard: tr('Billard 225'), ludo: tr('Ludo 225'), gode: tr('Godé'), bolide: tr('Bolide'), jeux: tr('Jeux'), boutique: tr('Boutique'), idees: tr('Tes idées pour Babi Life'), politique: tr('Politique'), rendezvous: tr('Rendez-vous'), papiers: tr('Mes papiers'), reglages: tr('Réglages') }

  return (
    <div className="phone-backdrop absolute inset-0 z-50 flex items-end justify-center bg-[#0f1230]/55 backdrop-blur-[3px] sm:items-center short:items-stretch short:justify-end" data-away={away || undefined} onClick={putAway}>
      {/* The phone: a metal band round it, its buttons on the sides, the black border, the screen. On a
          real phone, no phone drawn in it: the game's phone takes the whole screen, as its own would; held
          sideways, it stands on the right, the whole height, the street still in sight on the left. */}
      <div
        className="phone-body animate-up relative h-[min(92%,780px)] w-[min(100%,384px)] rounded-[56px] p-[3px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.75),inset_0_0_0_1px_rgba(255,255,255,0.25)] max-sm:h-full max-sm:w-full max-sm:rounded-none max-sm:p-0 max-sm:shadow-none short:h-full short:w-[min(100%,420px)] short:rounded-none short:p-0"
        data-away={away || undefined}
        style={{ background: 'linear-gradient(145deg,#d4d7dd 0%,#7a7e87 22%,#30333a 50%,#8d919a 78%,#e1e4e9 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {[
          ['left', 104, 26],
          ['left', 150, 50],
          ['left', 212, 50],
          ['right', 170, 78],
        ].map(([side, top, h]) => (
          <span key={`${side}${top}`} className={`absolute w-[3px] rounded-sm max-sm:hidden short:hidden ${side === 'left' ? '-left-[3px]' : '-right-[3px]'}`} style={{ top: top as number, height: h as number, background: 'linear-gradient(90deg,#5d616a,#a9adb5)' }} />
        ))}
        <div className="relative h-full rounded-[53px] bg-black p-[8px] max-sm:rounded-none max-sm:p-0 short:rounded-none short:p-0">
          <div ref={screen} className={`phone-screen relative flex h-full flex-col overflow-hidden rounded-[45px] max-sm:rounded-none short:rounded-none ${app === null ? 'bg-[#1a1033]' : 'bg-white'}`}>
            {/* The wallpaper: a sunset over the lagoon, its soft lights. */}
            {app === null && (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#ffb27a,#e0306a_55%,#3b1d6e)]">
                <span className="absolute -top-10 -left-16 h-56 w-56 rounded-full bg-[#ffd166]/40 blur-3xl" />
                <span className="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-[#7048e8]/40 blur-3xl" />
                <span className="absolute -bottom-16 left-6 h-56 w-56 rounded-full bg-[#00a862]/25 blur-3xl" />
              </div>
            )}
            {/* The status bar: the time, the Dynamic Island in the middle, the network and the battery (the Sim's energy). */}
            <div className="h-[max(8px,var(--sat,env(safe-area-inset-top)))] shrink-0 sm:hidden" />
            <div className={`relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-7 pt-[11px] pb-1 text-[13px] font-bold max-sm:hidden ${app === null ? 'text-white' : 'text-[#111]'}`}>
              <span className="tnum">{time}</span>
              <span className="flex h-[30px] w-[108px] items-center justify-end rounded-full bg-black pr-3">
                <span className="h-[9px] w-[9px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#3b4a7a,#0b0d16)] ring-1 ring-[#1c1f2b]" />
              </span>
              <span className="flex items-center justify-end gap-1.5">
                <SignalBars />
                <span className="text-[11px] font-extrabold">{tr('4G')}</span>
                <Battery level={sim.needs.energy} />
              </span>
            </div>

          {app === null ? (
            <>
              <div className="relative flex-1 overflow-y-auto px-4 pt-5 pb-28">
                <div className="mb-5 text-center text-white">
                  <div className="text-sm font-semibold opacity-85">
                    {commune.name}, {city.name}
                  </div>
                  <div className="font-display text-[64px] leading-none font-extrabold tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.25)]">{time}</div>
                </div>
                <WordOfTheDay world={world} gameMinutes={sim.gameMinutes} />
                <div className="motion-stagger grid grid-cols-4 gap-x-2 gap-y-4">
                  {APPS.filter((a) => !DOCK.includes(a.id)).map((a) => (
                    <button key={a.id} onClick={(e) => openFrom(e, a.open)} className="flex min-w-0 flex-col items-center gap-1 transition-transform active:scale-90">
                      <span className="relative">
                        <PhoneIcon id={a.id} icon={a.icon} colors={a.colors} />
                        {((a.id === 'friends' && sim.gang === 'invited') || (a.id === 'home' && sim.rentArrears > 0) || (a.id === 'jobs' && !sim.career)) && <Badge />}
                        {a.id === 'inviter' && gifts.wrapped > 0 && <Badge n={gifts.wrapped} />}
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{a.label}</span>
                    </button>
                  ))}
                  {STORE_APPS.map((a) => (
                    <button key={a.id} onClick={(e) => openFrom(e, a.open)} className="flex min-w-0 flex-col items-center gap-1 transition-transform active:scale-90">
                      <span className="relative block h-14 w-14">
                        <AppLogo id={a.id} size={56} radius={13} />
                        {a.id === 'golvo' && delivery && <Badge />}
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{a.label}</span>
                    </button>
                  ))}
                  {/* Babi Pub: the advertisers' apps and sites (their icon, their name); a tap opens their link, outside the game. */}
                  {adApps.map((ad) => (
                    <button key={ad.id} onClick={() => (seen(sim.commune, ad.id), openAd(ad))} className="flex min-w-0 flex-col items-center gap-1 transition-transform active:scale-90">
                      <span className="relative block h-14 w-14 overflow-hidden rounded-[13px] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                        <img src={ad.icon} alt="" draggable={false} className="h-full w-full object-cover" />
                        <span className="absolute right-0.5 bottom-0.5 rounded bg-black/55 px-1 text-[8px] leading-[12px] font-extrabold text-white">{tr('Pub')}</span>
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{ad.appName}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex justify-center gap-1.5">
                  <span className="h-[7px] w-[7px] rounded-full bg-white" />
                  <span className="h-[7px] w-[7px] rounded-full bg-white/40" />
                </div>
              </div>
              {/* The dock: four apps always at hand, on frosted glass. */}
              <div className="absolute inset-x-3 bottom-6 z-10 grid grid-cols-4 gap-2 rounded-[32px] bg-white/25 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] backdrop-blur-xl max-sm:bottom-[calc(var(--sab,env(safe-area-inset-bottom))+22px)]">
                {DOCK.map((id) => APPS.find((a) => a.id === id))
                  .filter((a): a is Tile => !!a)
                  .map((a) => (
                    <button key={a.id} onClick={(e) => openFrom(e, a.open)} className="flex justify-center transition-transform active:scale-90" aria-label={a.label}>
                      <span className="relative">
                        <PhoneIcon id={a.id} icon={a.icon} colors={a.colors} />
                        {a.id === 'messages' && journal.length > 0 && <Badge n={Math.min(99, journal.length)} />}
                      </span>
                    </button>
                  ))}
              </div>
              {/* The home bar: a tap, or a swipe up, puts the phone away. */}
              <button
                className="absolute bottom-1.5 left-1/2 z-10 flex h-6 w-44 -translate-x-1/2 touch-none items-end justify-center pb-1 max-sm:bottom-[var(--sab,env(safe-area-inset-bottom))]"
                onPointerDown={swipeStart('home')}
                onPointerMove={swipeMove}
                onPointerUp={swipeEnd}
                onPointerCancel={swipeEnd}
                aria-label={tr('Ranger le téléphone')}
              >
                <span className="block h-[5px] w-[124px] rounded-full bg-white/85" />
              </button>
            </>
          ) : (
            <div key={app} ref={panel} className="phone-app relative flex flex-1 flex-col overflow-hidden bg-white" style={{ transformOrigin: origin }} data-leaving={leaving || undefined}>
              {/* The left edge: swiped right, back to the home screen (a phone's back). */}
              <div className="absolute inset-y-0 left-0 z-20 w-4 touch-none sm:hidden" onPointerDown={swipeStart('back')} onPointerMove={swipeMove} onPointerUp={swipeEnd} onPointerCancel={swipeEnd} aria-hidden />
              {/* The app's bar: back to the home screen on the left, its name in the middle. */}
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 border-b border-black/5 px-2 pt-1 pb-2">
                <button className="flex items-center text-[15px] font-semibold text-[var(--color-orange)] active:opacity-60" onClick={goHome} aria-label={tr('Retour')}>
                  <ChevronLeft size={26} strokeWidth={2.6} />
                  {tr('Accueil')}
                </button>
                <h3 className="truncate text-center font-display text-[17px] font-extrabold">{title[app]}</h3>
                <span className="w-[76px]" />
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-6">
                {/* (An app loads the first time it's opened: a moment's spinner, then it.) */}
                <Suspense fallback={<AppLoading />}>
                {app === 'here' && (
                  <ul className="motion-stagger space-y-2">
                    {places.map((p) => (
                      <Row key={p.id} icon={iconFor(p.kind === 'home' ? 'house' : world.kinds[p.kind].icon)} colors={kindColors(p.kind)} title={p.name} sub={p.kind === 'home' ? tr('Dormir, se doucher, cuisiner') : world.kinds[p.kind].label} onClick={() => onWalk(p.id)}>
                        <Footprints size={18} className="text-[var(--color-ink-soft)]" />
                      </Row>
                    ))}
                  </ul>
                )}
                {app === 'jobs' && (
                  <JobsApp
                    world={world}
                    sim={sim}
                    commune={commune}
                    act={act}
                    onWalk={onWalk}
                    onMap={onMap}
                    onAutoWork={onAutoWork}
                  />
                )}
                {app === 'home' && <HomeApp world={world} sim={sim} commune={commune} act={act} onBuild={onBuild} onWalk={onWalk} onMap={onMap} />}
                {app === 'messages' && <Journal events={journal} />}
                {app === 'news' && <NewsApp />}
                {app === 'jeux' && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr("Pour s'entraîner, même sans réseau : rien n'est envoyé ni gagné. Les vrais défis se jouent sur place (la salle de jeux vidéo, le grin, le supermarché) et rapportent.")}</p>
                    <ul className="motion-stagger space-y-2">
                      {PRACTICE.filter((k) => k !== 'storm' || storm).map((k) => {
                        const d = defiLook(k)
                        return <Row key={k} icon={d.icon} colors={d.colors} title={d.title} sub={tr('Entraînement')} onClick={() => onPractice(k)} />
                      })}
                    </ul>
                    <PvpJeux />
                  </div>
                )}
                {app === 'mentor' && <MentorApp sim={sim} onResult={onResult} />}
                {app === 'demandes' && <ErrandsApp sim={sim} onGo={(step) => (onClose(), step.city && step.city !== sim.city ? onMap() : goToKind(step.kind, commune, onWalk, onMap))} />}
                {app === 'inviter' && <InviteApp world={world} sim={sim} view={gifts.view} onResult={onResult} onOpened={gifts.reload} />}
                {app === 'guide' && <GuideApp world={world} onTutorial={() => (onClose(), openTutorial())} onGo={(kind) => goToKind(kind, commune, onWalk, onMap)} />}
                {app === 'dodo' && <DodoApp world={world} sim={sim} act={act} onMap={onMap} />}
                {app === 'airlagune' && <AirLaguneApp world={world} sim={sim} onTravel={(...a) => (onClose(), onTravel(...a))} />}
                {app === 'bolide' && <BolideApp world={world} sim={sim} act={act} onDrive={onDrive} />}
                {app === 'dames' && <DamesApp sim={sim} onOnline={onDamesOnline} onFriend={onDames} onResume={onDamesResume} />}
                {app === 'awale' && <AwaleApp sim={sim} />}
                {app === 'billard' && <BillardApp />}
                {app === 'ludo' && <LudoApp sim={sim} />}
                {app === 'huit' && <HuitApp sim={sim} onTable={onHuitTable} onFriend={onHuitFriend} onResume={onHuitResume} />}
                {app === 'kineo' && <KineoApp world={world} sim={sim} act={act} onWalk={onWalk} onMap={onMap} onClose={onClose} />}
                {app === 'friends' && <FriendsApp world={world} sim={sim} act={act} onPay={has('waye') ? (p) => (setWayeTo(p.id), setApp('waye')) : undefined} onDames={onDames} />}
                {app === 'store' && !ownPhone && (
                  <div className="grid place-items-center gap-3 px-6 py-12 text-center">
                    <Lock size={34} className="text-[var(--color-ink-soft)]" />
                    <p className="font-display text-xl font-extrabold">{tr('Pas encore de téléphone')}</p>
                    <p className="text-sm font-bold text-[var(--color-ink-soft)]">
                      {tx("{firstName} aura son téléphone à 12 ans, avec Waye dessus : le Store s'ouvre alors (Gbairai, Tikitoko, Garbaya, Gnango…).", { firstName: sim.firstName })}
                      {(() => {
                        const left = Math.ceil((sim.bornAt ?? 0) + minutesToAge(world, 12) - sim.gameMinutes)
                        return left > 0 ? tr(' Encore {0}.', { 0: duration(left) }) : ''
                      })()}
                    </p>
                  </div>
                )}
                {app === 'store' && ownPhone && <StoreApp world={world} sim={sim} act={act} onOpen={(id) => (id === 'gnango' || id === 'idrive' ? onMap() : id === 'flashe' ? onFlashe() : setApp(id as PhoneAppId))} />}
                {app === 'boutique' && <BoutiqueApp sim={sim} back={achat} onConfirmAdult={onConfirmAdult} onResult={onResult} />}
                {app === 'idees' && <IdeasApp sim={sim} />}
                {app === 'reglages' && <ReglagesApp />}
                {app === 'rendezvous' && <RendezVousApp world={world} sim={sim} onGo={goRendezVous} />}
                {app === 'papiers' && <PapiersApp sim={sim} minor={life.minor} onGo={(kind) => goToKind(kind, commune, (id) => (onClose(), onWalk(id)), onMap)} />}
                {app === 'politique' && <PolitiqueApp world={world} sim={sim} commune={commune} at={at} onWalk={(id) => (onClose(), onWalk(id))} />}
                {app === 'waye' && <WayeApp world={world} sim={sim} act={act} journal={journal} renderJournal={(events) => <Journal events={events} />} payTo={wayeTo} />}
                {app === 'gbairai' && <GbairaiApp world={world} sim={sim} parents={gbairaiParents} friends={gbairaiFriends} />}
                {app === 'tikitoko' && <TikitokoApp sim={sim} act={act} photo={tikiPhoto} street={street} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} onClose={() => (setApp(null), setTikiPhoto(undefined))} />}
                {app === 'babigram' && <BabigramApp sim={sim} act={act} photo={gramPhoto} stories={has('gbairai')} onClose={() => (setApp(null), setGramPhoto(undefined))} />}
                {app === 'galerie' && <GalleryApp sim={sim} onCamera={onCamera} story={has('gbairai')} onTiki={has('tikitoko') ? (p, src) => (setTikiPhoto({ id: p.id, src }), setApp('tikitoko')) : null} onGram={has('babigram') ? (p, src) => (setGramPhoto({ id: p.id, src }), setApp('babigram')) : null} />}
                {(app === 'bet225' || app === 'parisfoot') && <BetApp sim={sim} act={act} app={app} />}
                {app === 'bingo' && <BingoApp world={world} sim={sim} act={act} onConfirmAdult={onConfirmAdult} />}
                {app === 'casino' && <CasinoApp world={world} sim={sim} act={act} onConfirmAdult={onConfirmAdult} />}
                {app === 'gode' && <GodeApp sim={sim} act={act} onConfirmAdult={onConfirmAdult} />}
                {app === 'golvo' && <GolvoApp world={world} sim={sim} delivery={delivery} onOrder={onDelivery} onCancel={() => onDelivery(null)} onCollect={onCollect} />}
                </Suspense>
              </div>
              {/* The home bar: a tap, or a swipe up, goes back to the home screen. */}
              <button
                className="flex h-6 shrink-0 touch-none items-center justify-center bg-white max-sm:h-[calc(var(--sab,env(safe-area-inset-bottom))+22px)] max-sm:items-start max-sm:pt-2"
                onPointerDown={swipeStart('home')}
                onPointerMove={swipeMove}
                onPointerUp={swipeEnd}
                onPointerCancel={swipeEnd}
                aria-label={tr("Écran d'accueil")}
              >
                <span className="block h-[5px] w-[124px] rounded-full bg-black/80" />
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** While an app loads (the first time it's opened): a spinner in the phone's screen. */
function AppLoading() {
  return (
    <div className="flex h-40 items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-orange)] border-t-transparent" />
    </div>
  )
}

/** The network's bars in the status bar: four, all full (Babi is well covered). */
function SignalBars() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 4.5} y={8 - i * 2.6} width="3" height={3 + i * 2.6} rx="0.8" />
      ))}
    </svg>
  )
}

/** The battery: the Sim's energy (red below a fifth). */
function Battery({ level }: { level: number }) {
  const k = Math.max(0, Math.min(100, level)) / 100
  return (
    <span className="flex items-center gap-[1px]" title={tr('Énergie {0} %', { 0: Math.round(level) })}>
      <span className="relative h-[12px] w-[24px] rounded-[4px] border border-current/40 p-[1.5px]">
        <span className="block h-full rounded-[2px]" style={{ width: `${Math.max(8, k * 100)}%`, background: k < 0.2 ? '#ff3b30' : 'currentColor' }} />
      </span>
      <span className="h-[4px] w-[1.5px] rounded-r-sm bg-current/40" />
    </span>
  )
}

/** A notification badge on an app: a red dot, or a count. */
function Badge({ n }: { n?: number }) {
  return n ? (
    <span className="absolute -top-1.5 -right-1.5 grid h-[20px] min-w-[20px] place-items-center rounded-full bg-[#ff3b30] px-1 text-[11px] font-bold text-white">{n}</span>
  ) : (
    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#ff3b30] ring-2 ring-white/80" />
  )
}

/* ---------- Interaction menu ---------- */

type MenuProps = {
  world: World
  sim: Sim
  city: City
  commune: Commune
  placeId: string
  desktop: boolean
  onClose: () => void
  onPick: (it: Interaction, kind: string) => void
  onTravel: OnTravel
  onStop: () => void
  /** At home: build one's house on the plot. */
  onBuild: () => void
  /** At home: one's soirée going on, or throwing one. */
  soiree?: Soiree
  onSoiree?: () => void
  /** At home: the fridge opened (the update « frigo »). */
  onFridge?: () => void
}

/** The Sim's house has a fridge (or a finer one). */
const hasFridge = (world: World, sim: Sim) => sim.housing === 'maison' && (sim.furnished ?? []).some((id) => kindOf(world.furniture?.find((f) => f.id === id) ?? { id }) === 'frigo')
/** The shopping during which the fridge is filled (backend game/fridge.go FridgeShopping). */
const FRIDGE_SHOPPING = new Set(['buy-food', 'supermarche', 'courses'])

/**
 * Walking about inside a place: what's done there, for the scene to show
 * over its spots (world3d/SpotActions), the same list as « Que faire ? ». Sent
 * again only when it changes (an open pin stays open as the clock ticks).
 */
function SceneActionsFeed({ world, sim, city, commune, placeId, onPick }: { world: World; sim: Sim; city: City; commune: Commune; placeId: string; /** why: what stops it now (shown instead of doing it). */ onPick: (it: Interaction, kind: string, why?: string) => void }) {
  const pa = usePlaceActions(world, sim, city, commune, placeId)
  const whyNot = (it: Interaction) => {
    const st = pa!.state(it)
    return st.reason ?? (!st.open ? tr('Ouvert {0}', { 0: openingLabel(it) }) : st.broke ? tr('Pas assez de Djai') : undefined)
  }
  const acts: SceneAction[] = pa
    ? pa.items.map((it) => ({
        id: it.id,
        label: it.label,
        icon: it.icon,
        colors: kindColors(pa.place.kind),
        note: [duration(actionLength(it.minutes)), it.cost > 0 ? tr('−{0} Djai', { 0: amount(it.cost) }) : it.cost < 0 ? tr('+{0} Djai', { 0: amount(-it.cost) }) : ''].filter(Boolean).join(' · '),
        why: whyNot(it),
      }))
    : []
  const latest = useRef({ pa, onPick, whyNot })
  latest.current = { pa, onPick, whyNot }
  const key = JSON.stringify(acts)
  useEffect(() => {
    setSceneActions(JSON.parse(key) as SceneAction[], (id) => {
      const { pa, onPick, whyNot } = latest.current
      const it = pa?.items.find((x) => x.id === id)
      if (pa && it) onPick(it, pa.place.kind, whyNot(it))
    })
  }, [key])
  useEffect(() => () => setSceneActions([], () => undefined), [])
  return null
}

/** The school day (or the crèche's) seen in le mode vie: the school place it's at (its own things in the wheel), the commune's when it's done from home. */
/** The wheel with another player: these first (the last of the list first), the rest after, as the server sends them. */
const DEEP = ['calin', 'confier', 'drague', 'sortir', 'embrasser', 'excuser']

function schoolPlace(commune: Commune, doing: Sim['activity'] | null, it: string | undefined) {
  if (doing?.placeId && doing.placeId !== 'home' && commune.places.some((p) => p.id === doing.placeId)) return doing.placeId
  const kind = it === 'creche' ? 'creche' : 'school'
  return commune.places.find((p) => p.kind === kind)?.id ?? null
}

/** Le mode vie at home (components/LifeHome.tsx), with what can be done there now (the same list as « Que faire ? »). */
function LifeFeed({ world, sim, city, commune, placeId, ...rest }: { world: World; sim: Sim; city: City; commune: Commune } & Omit<ComponentProps<typeof LifeHome>, 'items' | 'whyNot' | 'note' | 'colors' | 'sim' | 'world'>) {
  const pa = usePlaceActions(world, sim, city, commune, placeId)
  const whyNot = (it: Interaction) => {
    const st = pa!.state(it)
    return st.reason ?? (!st.open ? tr('Ouvert {0}', { 0: openingLabel(it) }) : st.broke ? tr('Pas assez de Djai') : undefined)
  }
  const note = (it: Interaction) => [duration(actionLength(it.minutes)), it.cost > 0 ? tr('−{0} Djai', { 0: amount(it.cost) }) : it.cost < 0 ? tr('+{0} Djai', { 0: amount(-it.cost) }) : ''].filter(Boolean).join(' · ')
  if (!pa) return null
  return <LifeHome world={world} sim={sim} placeId={placeId} items={pa.items} whyNot={whyNot} note={note} colors={kindColors(pa.place.kind)} {...rest} />
}

/** The things of the pin tapped in the room (world3d/SpotActions), in a card over the place's bar: tap one, the Sim goes. */
function SpotSheet() {
  const { open, pick } = useSceneActions()
  if (!open) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(11.25rem+var(--hud-lift,0px))] z-30 flex justify-center px-3 lg:bottom-[calc(12.25rem+var(--hud-lift,0px))]">
      <div className="card animate-pop pointer-events-auto w-full max-w-md p-2">
        <div className="max-h-[38vh] space-y-1 overflow-y-auto">
          {open.map((a) => (
            <button key={a.id} className={`tile flex w-full items-center gap-2.5 p-2 text-left ${a.why ? 'opacity-60' : ''}`} onClick={() => (openSpot(null), pick(a.id))}>
              <IconTile icon={iconFor(a.icon)} colors={a.colors} size={36} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[14px] font-extrabold">{a.label}</span>
                <span className="block truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">{a.why ?? a.note}</span>
              </span>
            </button>
          ))}
        </div>
        <button className="mt-1 w-full rounded-xl py-1.5 text-xs font-extrabold text-[var(--color-ink-soft)]" onClick={() => openSpot(null)}>
          {tr('Fermer')}
        </button>
      </div>
    </div>
  )
}

/**
 * What can be done at a place, and why each thing can't be now: the place's
 * menu (« Que faire ? ») and the buttons over their spots inside it
 * (world3d/SpotActions) show the same.
 */
function usePlaceActions(world: World, sim: Sim, city: City, commune: Commune, placeId: string | null) {
  // (Le mode vie's wheel in a Dodo home rented and at a player's soirée: their own kinds of things, backend game/dodo.go, soiree.go.)
  const place = !placeId ? null : placeId === 'home' ? { name: tr('Chez toi'), kind: 'home' } : placeId === 'logement' ? { name: sim.stay?.name ?? tr('Ta location'), kind: 'logement' } : placeId.startsWith('soiree:') ? { name: tr('La soirée'), kind: 'soiree' } : (commune.places.find((p) => p.id === placeId) ?? null)
  const adult = !!useSession((s) => s.user?.adult)
  // At the stadium: what's on, and the match or the concert only while it's on.
  const agenda = useStadium(place?.kind === 'stade' ? placeId : null)
  // The updates not opened yet (lib/features.ts).
  const feats = useFeatures()
  // The republic's (lib/civic.ts): the campaign at the mairie, the market, the maquis; the stadium's big days.
  const terrain = useTerrain(sim.id, !!place && CIVIC_KINDS.has(place.kind))
  // A story's épreuve (lib/epreuve.ts): only the one the story is at.
  const epreuve = useEpreuveNow(sim.id, !!place && !!world.kinds[place.kind]?.interactions.some((it) => it.id.startsWith('epreuve-')), `${placeId}${sim.activity?.start ?? ''}`)
  if (!place || !placeId || !world.kinds[place.kind]) return null
  const kind = world.kinds[place.kind]
  const here = sim.city === city.id && sim.commune === commune.id
  const home = housingOf(world, sim)
  const career = world.careers.find((c) => c.id === sim.career && (c.kind === place.kind || c.also?.includes(place.kind)))
  const life = lifeOf(world, sim)
  // Things past this age (the biberon for an adult) don't show; things for later do, greyed.
  // A night together: only with one's partner living at home, and a player who said they're 18 or over.
  const partner = sim.friends?.find((f) => f.partner && f.home)
  // What's done in a rented room only shows with the room (backend sims/hotel.go): else the lift's « Les chambres ».
  const roomHere = !!sim.stay && sim.stay.place === placeId && sim.stay.until > sim.gameMinutes
  const items = [...(career ? [shift(career, sim.careerLevel)] : []), ...kind.interactions.map((it) => (placeId === 'home' ? atHome(it, home) : it))].filter((it) => !it.stay || roomHere).filter((it) => !it.id.startsWith('reparer-') || (placeId === 'home' && !!sim.life?.objects?.[it.id.slice(8)]?.broken && !sim.life?.objects?.[it.id.slice(8)]?.pro))
    .filter((it) => ageBlock(it, life.stage?.id) !== tr('Plus de ton âge') && (!it.places || it.places.includes(placeId)) && (!it.cities || it.cities.includes(city.id)) && (!it.faiths || it.faiths.includes((place as Place).faith!)) && (!it.gender || it.gender === sim.gender))
    .filter((it) => it.id !== 'passer-nuit' || (partner && adult && !life.minor))
    .filter((it) => !it.id.startsWith('epreuve-') || it.id === epreuve)
    .filter((it) => civicState(it, terrain, placeId, commune.id).show)
    // What an update hasn't brought yet (lib/features.ts).
    .filter((it) => activityOpen(feats, it.id))
    // Once the boutiques are open, they take the place of the old « S'acheter une tenue ».
    .filter((it) => it.id !== 'vetements' || !activityOpen(feats, 'boutique-mode'))
    .map((it) => (it.id === 'passer-nuit' && partner ? { ...it, label: tr('Passer la nuit avec {name}', { name: partner.name }) } : it))
    // The president's measures of the week: some prices lowered for everyone.
    .map((it) => withMeasures(world, sim, place.kind, it))
  // Busy at these grounds (the zoo visit): the other things there can still be picked, they take over.
  const busy = !!sim.activity && !(sim.activity.kind === 'do' && sim.activity.placeId === placeId && GROUNDS.has(placeId))
  const on = eventAt(agenda, sim.gameMinutes)
  const stadiumBlock = (it: Interaction) => {
    const k = it.id === 'stade-match' ? 'match' : it.id === 'stade-concert' ? 'concert' : null
    if (!k || on?.kind === k) return null
    const next = agenda?.agenda.find((e) => e.kind === k && e.start - DOORS_OPEN > sim.gameMinutes)
    return next ? tr('Prochain : {0}', { 0: when(next.start) }) : k === 'match' ? tr('Pas de match') : tr('Pas de concert')
  }
  // In one's own house, sleeping takes a bed, cooking a stove, the TV a TV.
  const furnitureBlock = (it: Interaction) => {
    // Swimming: a pool in the house one built, or the villa one rents (game.CanSwimAtHome).
    if (placeId === 'home' && it.id === 'nager' && !(sim.housing === 'maison' ? sim.furnished?.includes('piscine') : sim.housing === 'villa')) return tr('Il te faut une piscine')
    const lack = placeId === 'home' ? homeLacks(world, sim, it.id) : ''
    if (lack) return tr('Il te faut : {lack}', { lack })
    // Le mode vie: a broken thing does nothing until it's mended (components/LifeWork.tsx).
    if (placeId === 'home' && brokenFor(sim, it.id)) return tr('En panne : à réparer')
    // The TV wants the power: none while the home's zone is cut (world3d/power.ts).
    const home = whereabouts.places.find((p) => p.id === 'home')
    if (placeId === 'home' && it.id === 'watch-tv' && home) {
      const cut = inCut(cutsAround(commune.id, home.door[0], home.door[1], sim.gameMinutes, 0), home.door[0], home.door[1])
      if (cut) return tr("Coupure de courant jusqu'à {time}", { time: clock(cut.end).time })
    }
    return null
  }
  const state = (it: Interaction) => ({ open: openAt(it, sim.gameMinutes), broke: it.cost > 0 && sim.money < it.cost, busy, reason: ageBlock(it, life.stage?.id) ?? stadiumBlock(it) ?? civicState(it, terrain, placeId, commune.id).why ?? blockedBy(it, sim, city.id, commune.id) ?? furnitureBlock(it) })
  return { place, kind, home, career, life, roomHere, items, busy, here, agenda, on, state, epreuve }
}

function InteractionMenu({ world, sim, city, commune, placeId, desktop, onClose, onPick, onTravel, onStop, onBuild, soiree, onSoiree, onFridge }: MenuProps) {
  const navigate = useNavigate()
  const pa = usePlaceActions(world, sim, city, commune, placeId)
  const feats = useFeatures()
  const braquageOn = keyOpen(feats, 'braquages')
  const braq = useBraquage(sim.id, braquageOn && !!pa && pa.place.kind === 'banque', `${placeId}${sim.activity?.start ?? ''}`)
  // A long list (the maquis' twenty things): first what's for you now, the rest behind « Toutes les actions ».
  const [all, setAll] = useState(false)
  // (A place of the map the street hasn't loaded yet, or not any more: the Sim went far.)
  if (!pa) return null
  const { place, kind, life, roomHere, items, busy, here, agenda, on, state } = pa
  const colors = kindColors(place.kind)
  // At a bank, with the robberies open: where the big job stands.
  const plan = place.kind === 'banque' && braquageOn && braq ? <BankPlan v={braq} placeId={placeId} /> : null
  const canBuild = placeId === 'home' && here && !!world.materials?.length
  // Building is on one's own lot, bought from 18.
  const tooYoung = life.minor
  const billing = place.kind === 'stade' && (
    <div className="min-w-0 rounded-[20px] bg-[#fff4e8] p-3">
      <div className="label">{tr("À l'affiche")}</div>
      {on ? (
        <div className="mt-1">
          <div className="font-display text-[17px] leading-tight font-extrabold">
            {on.title} {on.score && <span className="ml-1 rounded-full bg-[#141416] px-2 py-0.5 text-[13px] text-[#ffd166]">{on.score}</span>}
          </div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{sim.gameMinutes < on.start ? tr('Les portes sont ouvertes · {detail}', { detail: on.detail }) : tr('En ce moment · {detail}', { detail: on.detail })}</div>
        </div>
      ) : (
        <p className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">{tr('Rien en ce moment.')}</p>
      )}
      {/* (One column that can be narrower than its longest title: else the title, kept on one line, widened the whole sheet past a small phone's edge.) */}
      <ul className="mt-2 grid grid-cols-1 gap-1">
        {agenda?.agenda
          .filter((e) => e !== on && e.start > sim.gameMinutes)
          .slice(0, 4)
          .map((e) => (
            <li key={e.start} className="flex min-w-0 items-baseline gap-2 text-[13px] font-bold">
              <span className="shrink-0 whitespace-nowrap text-[var(--color-ink-soft)]">{when(e.start)}</span>
              <span className="min-w-0 truncate">{e.title}</span>
            </li>
          ))}
      </ul>
    </div>
  )
  const build = canBuild && (
    <button disabled={tooYoung} onClick={onBuild} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#fff4e8] p-2.5 text-left transition active:scale-[0.98] ${tooYoung ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={tooYoung ? Lock : Hammer} colors={colors} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{tr('Construire ma maison')}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{tooYoung ? tr('À 18 ans : ton terrain, puis ta maison') : tr('Ton terrain, tes murs, tes meubles')}</span>
      </span>
    </button>
  )
  // At home: a soirée for the players of the quarter (backend sims/party.go), from 18 (the host is an adult).
  // (An update the team opens from the admin: lib/features.ts.)
  const party = placeId === 'home' && here && onSoiree && keyOpen(feats, 'soiree') && (
    <button disabled={(busy && !soiree) || life.minor} onClick={onSoiree} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#f6e8ff] p-2.5 text-left transition active:scale-[0.98] ${(busy && !soiree) || life.minor ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={life.minor ? Lock : PartyPopper} colors={['#ff5cc8', '#7a2bd6']} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{soiree ? tr('Ta soirée : {title}', { title: soiree.title }) : tr('Organiser une soirée')}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{life.minor ? tr('À 18 ans') : soiree ? tr('{guests} invité{0} · retourne sur la piste', { guests: soiree.guests, 0: soiree.guests > 1 ? 's' : '' }) : tr('{0} · 3 h · les joueurs du quartier viennent danser', { 0: fcfa(soireeCost(sim)) })}</span>
      </span>
    </button>
  )
  // At home: the fridge, what's in it, to eat or drink (backend sims/fridge.go).
  const fridge = placeId === 'home' && here && onFridge && keyOpen(feats, 'frigo') && hasFridge(world, sim) && (
    <button onClick={onFridge} className="flex w-full items-center gap-3 rounded-[20px] bg-[#e9f6ff] p-2.5 text-left transition active:scale-[0.98]">
      <IconTile icon={Refrigerator} colors={['#74c0fc', '#1c7ed6']} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{tr('Ouvrir le frigo')}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{tr('Ce que tu as acheté au marché, à manger ou à boire')}</span>
      </span>
    </button>
  )
  // The wardrobe at home and at the couturier; a new hairdo at the barber or the salon.
  const lookTab = { home: 'tenue', couture: 'tenue', boutique: 'tenue', salon: 'coiffure', barbier: 'coiffure' }[place.kind]
  const restyle = lookTab && here && (
    <button disabled={busy} onClick={() => navigate(`/look?tab=${lookTab}`, { viewTransition: true })} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#fff4e8] p-2.5 text-left transition active:scale-[0.98] ${busy ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={lookTab === 'coiffure' ? Scissors : Shirt} colors={colors} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{tr('Changer de look')}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{lookTab === 'coiffure' ? (sim.gender === 'homme' ? tr('Coupe, couleur, barbe') : tr('Coupe, couleur')) + tr(' · 2 000 Djai') : tr('Tenue, pagne, couleurs, accessoire · gratuit')}</span>
      </span>
    </button>
  )
  // A hotel's floors and rooms: up by the lift (world3d/interior/HotelFloors), to visit and rent one.
  const rooms = place.kind === 'hotel' && here && !life.minor && (
    <button disabled={busy} onClick={() => (onClose(), openLift())} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#fff6d6] p-2.5 text-left transition active:scale-[0.98] ${busy ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={KeyRound} colors={['#ffd36e', '#e0a100']} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{roomHere ? tr('Ta chambre {room}', { room: sim.stay!.room }) : tr('Les chambres')}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{roomHere ? tr('L’ascenseur, ta clé, le room service') : tr('L’ascenseur : visite les étages, loue une chambre')}</span>
      </span>
    </button>
  )

  // Desktop: the Sims radial menu around the place (at home, the rooms' list: too many things for a ring;
  // the stadium's programme, too tall to go under the ring: the list, which has room for it).
  if (desktop && here && !busy && !items.some((it) => it.room) && !billing) {
    const rx = 250
    const ry = 175
    return (
      <div className="absolute inset-0 z-30 grid place-items-center bg-[#0f1230]/55 backdrop-blur-[3px]" onClick={onClose}>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button className="animate-pop relative z-10 flex flex-col items-center" onClick={onClose} aria-label={tr('Fermer')}>
            <IconTile icon={iconFor(kind.icon)} colors={colors} size={96} radius={34} />
            <span className="mt-2 rounded-full bg-white px-4 py-1.5 font-display text-lg font-extrabold shadow-lg">{place.name}</span>
          </button>
          {(build || restyle || billing || rooms || party || fridge) && (
            <div className="absolute top-full left-1/2 mt-[200px] grid w-64 -translate-x-1/2 gap-2">
              {billing}
            {plan}
              {plan}
              {party}
              {fridge}
              {build}
              {restyle}
              {rooms}
            </div>
          )}
          {items.map((it, i) => {
            const a = (i / items.length) * Math.PI * 2 - Math.PI / 2
            return (
              // Each one flies out from the place in the middle to its spot on the ring.
              <div key={it.id} className="motion-fan absolute top-1/2 left-1/2" style={{ '--fx': `${Math.cos(a) * rx}px`, '--fy': `${Math.sin(a) * ry}px`, animationDelay: `${40 + i * 40}ms` } as React.CSSProperties}>
                <div>
                  <ActionButton it={it} colors={colors} {...state(it)} onPick={() => onPick(it, place.kind)} compact />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Mobile (and "not here"): a thumb-friendly action sheet.
  return (
    <Sheet onClose={onClose} className="max-h-[80%] overflow-y-auto p-4 lg:w-[440px] [&>*]:shrink-0">
      {(close) => (
        <>
        {/* The place: its colour washing down from the top, its sign popping in */}
        <div className="-mx-4 -mt-4 mb-3 flex items-center gap-3 rounded-t-[28px] px-4 pt-6 pb-3" style={{ background: `linear-gradient(180deg, ${colors[1]}30, ${colors[1]}00)` }}>
          <IconTile icon={iconFor(kind.icon)} colors={colors} size={54} className="motion-pop" style={{ boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.3), 0 10px 18px -10px rgba(0,0,0,0.5)' }} />
          <div className="min-w-0 flex-1">
            <div className="label">{kind.label}</div>
            <div className="truncate font-display text-[23px] leading-tight font-extrabold">{place.name}</div>
          </div>
          <button className="icon-btn self-start bg-white/80" onClick={close} aria-label={tr('Fermer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {'id' in place && (kind.id === 'sport' || place.id === 'plateau-stade') && <CourtCount placeId={place.id} />}
        {'id' in place && <Flights world={world} sim={sim} placeId={place.id} busy={busy} onTravel={onTravel} />}
        {'id' in place && place.kind === 'transport' && place.type !== 'ferry_terminal' && <Departures world={world} sim={sim} placeId={place.id} busy={busy} onTravel={onTravel} />}
        {busy && (
          <div className="mb-3 flex items-center gap-3 rounded-[20px] bg-[#fff4e8] p-3">
            <Hourglass className="shrink-0 text-[var(--color-orange)]" size={22} />
            <p className="min-w-0 flex-1 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">
              {tx('{firstName} est occupé·e : {0}. Arrête pour faire autre chose.', { firstName: sim.firstName, 0: sim.activity!.interaction.label.toLowerCase() })}
            </p>
            {sim.activity!.kind === 'do' && (
              <button className="btn btn-soft shrink-0 !px-3 !py-2 !text-sm" onClick={onStop}>
                {tr('Arrêter')}
              </button>
            )}
          </div>
        )}
        {here ? (
          <div className="motion-stagger grid gap-2">
            {billing}
            {party}
            {fridge}
            {build}
            {restyle}
            {rooms}
            {(() => {
              // « Pour toi »: the story's épreuve, then what fills the needs that are lowest; the rest folded.
              if (items.some((it) => it.room) || items.length <= 6) return null
              const usable = (it: Interaction) => {
                const st = state(it)
                return st.open && !st.broke && !st.reason && !st.busy
              }
              const score = (it: Interaction) => (it.id === pa.epreuve ? 1000 : 0) + (Object.keys(sim.needs) as NeedKey[]).reduce((a, k) => a + Math.max(0, it.effect?.[k] ?? 0) * ((100 - sim.needs[k]) / 100) ** 2, 0)
              const top = items
                .filter(usable)
                .map((it) => [it, score(it)] as const)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([it]) => it)
              if (top.length < 2) return null
              const rest = items.filter((it) => !top.includes(it))
              return (
                <>
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">
                    <Sparkles size={14} strokeWidth={2.6} /> {tr('Pour toi maintenant')}
                  </div>
                  {top.map((it) => (
                    <ActionButton key={it.id} it={it} colors={colors} {...state(it)} onPick={() => onPick(it, place.kind)} />
                  ))}
                  <button className="mt-1 flex items-center justify-center gap-1.5 rounded-2xl bg-black/5 py-2.5 text-sm font-extrabold text-[var(--color-ink)]" onClick={() => setAll((v) => !v)}>
                    {all ? tr('Moins d’actions') : tr('Toutes les actions ({n})', { n: rest.length })}
                    <ChevronDown size={16} strokeWidth={2.8} className={`transition ${all ? 'rotate-180' : ''}`} />
                  </button>
                  {all && rest.map((it) => <ActionButton key={it.id} it={it} colors={colors} {...state(it)} onPick={() => onPick(it, place.kind)} />)}
                </>
              )
            })() ??
              byRoom(items).map(([room, list]) => (
              <Fragment key={room?.id ?? 'any'}>
                {room && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">
                    <room.icon size={14} strokeWidth={2.6} /> {room.label}
                  </div>
                )}
                {list.map((it) => (
                  <ActionButton key={it.id} it={it} colors={colors} {...state(it)} onPick={() => onPick(it, place.kind)} />
                ))}
              </Fragment>
            ))}
            {/* Out of town (the reserve, its lodge): the way back, after what's done here. */}
            {ARRIVE_AT[commune.id] && <BackToTown world={world} sim={sim} onTravel={onTravel} />}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold text-[var(--color-ink-soft)]">
              {tx("{firstName} n'est pas {0}. Vas-y d'abord pour faire une activité ici.", { firstName: sim.firstName, 0: aCommune(commune.name) })}
            </p>
            <TravelCTA world={world} sim={sim} cityId={city.id} communeId={commune.id} onTravel={onTravel} />
          </>
        )}
        </>
      )}
    </Sheet>
  )
}

/**
 * Out of town (the N'Zi's reserve, its lodge; game/far.ts): « Rentrer à Bouaké », a tap away in the place's menu,
 * opening the taxi there (its fare and time).
 */
function BackToTown({ world, sim, onTravel }: { world: World; sim: Sim; onTravel: OnTravel }) {
  const [open, setOpen] = useState(false)
  const back = farSpots(world, sim).find((f) => f.back)
  if (!back) return null
  if (open) return <div className="mt-2"><TravelCTA world={world} sim={sim} cityId={back.cityId} communeId={back.communeId} onTravel={onTravel} /></div>
  return (
    <button className="tile mt-2 flex w-full items-center gap-3 p-2.5 text-left" onClick={() => setOpen(true)}>
      <IconTile icon={CarTaxiFront} colors={['#ffa040', '#ff6a00']} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] leading-tight font-extrabold">{tr('Rentrer à {name}', { name: back.name })}</span>
        <span className="text-xs font-bold text-[var(--color-ink-soft)]">{tr('à {km} km, en taxi', { km: back.km })}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-[var(--color-ink-soft)]" />
    </button>
  )
}

/** The power is cut where the Sim stands (world3d/power.ts): till when, under the profile. */
function PowerCutBadge({ commune }: { commune: string }) {
  const [cut, setCut] = useState<PowerCut | null>(null)
  useEffect(() => {
    const tick = () => {
      const [x, z] = whereabouts.sim
      setCut(inCut(cutsAround(commune, x, z, Math.floor((serverNow() - EPOCH) / 60000), 0), x, z))
    }
    tick()
    const t = setInterval(tick, 10000)
    return () => clearInterval(t)
  }, [commune])
  if (!cut) return null
  return (
    <span className="hud flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold">
      <ZapOff size={14} strokeWidth={2.6} className="text-[#e8590c]" />
      {tx("Délestage ici · jusqu'à {time}", { time: clock(cut.end).time })}
    </span>
  )
}

function ActionButton({ it, colors, open, broke, busy, reason, onPick, compact, played }: { it: Interaction; colors: [string, string]; open: boolean; broke: boolean; busy?: boolean; reason?: string | null; onPick: () => void; compact?: boolean; /** Played as a game, not waited for (a street happening's choice): no time shown. */ played?: boolean }) {
  const disabled = !open || broke || !!busy || !!reason
  const ups = NEEDS.filter((n) => it.effect[n.key] >= 10)
  return (
    <button
      disabled={disabled}
      onClick={onPick}
      className={`flex items-center gap-3 rounded-[20px] p-2.5 text-left transition ${compact ? 'w-60 bg-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.45)] hover:scale-105' : 'w-full bg-[var(--color-canvas)] shadow-[inset_0_-3px_0_rgba(15,18,48,0.07)] active:translate-y-[2px] active:shadow-none'} ${disabled ? 'opacity-55 grayscale-[0.6] hover:scale-100' : ''}`}
    >
      <IconTile icon={disabled && (!open || reason) ? Lock : iconFor(it.icon)} colors={colors} size={44} style={{ boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.16), inset 0 2px 0 rgba(255,255,255,0.28)' }} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{it.label}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {played ? (
            <Chip tone="gold">
              <Trophy size={11} /> {tr('À jouer')}
            </Chip>
          ) : (
            <Chip>
              <Clock3 size={11} /> {duration(actionLength(it.minutes))}
            </Chip>
          )}
          {it.cost !== 0 && (
            <Chip tone={it.cost < 0 ? 'good' : 'gold'}>
              {tx('{0} {1} Djai', { 0: it.cost < 0 ? '+' : '−', 1: amount(Math.abs(it.cost)) })}
            </Chip>
          )}
          {!open && <Chip tone="bad">{openingLabel(it)}</Chip>}
          {reason && <Chip tone="bad">{reason}</Chip>}
          {ups.map((n) => (
            <span key={n.key} className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#e3f9ee] text-[var(--color-emerald-deep)]" title={`${n.label} +`}>
              <n.icon size={12} strokeWidth={3} />
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}

/* ---------- What's going on in the street ---------- */

function HappeningSheet({ now, sim, commune, joinOpen, choices, onClose, onJoin }: { now: HappeningNow; sim: Sim; commune: Commune; /** Its join not waiting for an update (the jam's: « circulation »). */ joinOpen: boolean; /** What there is to do, each played (the update « evenements-joues »): open, instead of the join. */ choices: Interaction[]; onClose: () => void; onJoin: (it: Interaction) => void }) {
  const h = now.happening!
  const left = Math.max(0, now.end - sim.gameMinutes)
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full overflow-hidden rounded-t-[28px] pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[var(--color-gold)] p-4 text-[#5a3a00]">
          <div className="flex items-center gap-3">
            <IconTile icon={iconFor(h.icon)} colors={['#ffffff66', '#ffffff22']} size={52} />
            <div className="min-w-0 flex-1">
              <div className="label !text-[#7a5200]">{tr('En ce moment')} {aCommune(commune.name)}</div>
              <div className="font-display text-[22px] leading-tight font-extrabold">{h.label}</div>
            </div>
            <button className="icon-btn bg-white/60" onClick={onClose} aria-label={tr('Fermer')}>
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          <p className="mt-2 text-sm leading-snug font-bold">{h.text}</p>
          <div className="mt-2">
            <Chip tone="dark">
              <Clock3 size={12} /> {tx('Encore {0}', { 0: duration(left) })}
            </Chip>
          </div>
        </div>
        <div className="p-4">
          {now.cleared !== undefined ? (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Quelqu’un a réglé le carrefour : la circulation est rétablie, les voitures repartent.')}</p>
          ) : choices.length > 0 ? (
            <div className="space-y-2">
              <div className="label">{tr('Qu’est-ce que tu fais ?')}</div>
              {choices.map((it) => (
                <ActionButton key={it.id} it={it} colors={['#ffd54f', '#ffa000']} open={openAt(it, sim.gameMinutes)} broke={it.cost > 0 && sim.money < it.cost} busy={!!sim.activity} reason={blockedBy(it, sim, sim.city, commune.id)} played={it.id.startsWith('evt-') || it.id === 'regler-circulation'} onPick={() => onJoin(it)} />
              ))}
            </div>
          ) : h.join && joinOpen ? (
            <ActionButton it={h.join} colors={['#ffd54f', '#ffa000']} open={openAt(h.join, sim.gameMinutes)} broke={h.join.cost > 0 && sim.money < h.join.cost} busy={!!sim.activity} reason={blockedBy(h.join, sim, sim.city, commune.id)} onPick={() => onJoin(h.join!)} />
          ) : (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Rien à faire ici à part regarder… et attendre que ça passe.')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** A player's soirée (backend sims/party.go): its host, its guests, how long it goes on; what's done there; the host ends it. */
function SoireeSheet({ party, world, sim, city, commune, onClose, onPick, onEnd, deco, onArrange }: { party?: Soiree; world: World; sim: Sim; city: City; commune: Commune; onClose: () => void; onPick: (it: Interaction) => void; onEnd: () => void; /** « soiree-deco » open: its entry said, its room arranged by the host. */ deco?: boolean; onArrange?: () => void }) {
  const life = lifeOf(world, sim)
  const host = party?.host === sim.id
  const left = party ? Math.max(0, Math.round((new Date(party.ends).getTime() - serverNow()) / 60000)) : 0
  const items = (world.kinds.soiree?.interactions ?? []).filter((it) => (it.id === 'recevoir-soiree' ? host : true) && ageBlock(it, life.stage?.id) !== tr('Plus de ton âge'))
  const colors: [string, string] = ['#ff5cc8', '#7a2bd6']
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up max-h-[80%] w-full overflow-y-auto rounded-t-[28px] pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-[#3a0f5c] to-[#c2187a] p-4 text-white">
          <div className="flex items-center gap-3">
            <IconTile icon={PartyPopper} colors={['#ffffff55', '#ffffff22']} size={52} />
            <div className="min-w-0 flex-1">
              <div className="label !text-white/75">{party ? (host ? tr('Ta soirée') : tr('Chez {hostName}', { hostName: party.hostName })) : tr('Soirée')}</div>
              <div className="truncate font-display text-[22px] leading-tight font-extrabold">{party?.title ?? tr('La soirée est finie')}</div>
            </div>
            <button className="icon-btn bg-white/20 text-white" onClick={onClose} aria-label={tr('Fermer')}>
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          {party && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="dark">
                <Clock3 size={12} /> {tx('Encore {0}', { 0: duration(left) })}
              </Chip>
              <Chip tone="dark">
                <Users size={12} /> {party.guests ? tr('{guests} invité{0}', { guests: party.guests, 0: party.guests > 1 ? 's' : '' }) : tr('Les premiers arrivent')}
              </Chip>
              {deco && (
                <Chip tone="dark">
                  <Ticket size={12} /> {entryLabel(party.price)}
                </Chip>
              )}
              {deco && party.starts && (
                <Chip tone="dark">
                  <PartyPopper size={12} /> {tx('Depuis {0}', { 0: new Date(party.starts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })}
                </Chip>
              )}
            </div>
          )}
          {deco && party && !host && !!party.price && (
            <p className="mt-2 text-xs leading-snug font-bold text-white/85">
              {party.free ? tr("Pour toi, l'entrée est offerte : tu es invité·e par {hostName}.", { hostName: party.hostName }) : tr('Tu paies {0} à {hostName} en entrant (une fois), avec ta première action ici. Ses amis entrent gratuitement.', { 0: fcfa(party.price), hostName: party.hostName })}
            </p>
          )}
        </div>
        <div className="motion-stagger grid gap-2 p-4">
          {party ? (
            <>
              {items.map((it) => (
                <ActionButton key={it.id} it={it} colors={colors} open={openAt(it, sim.gameMinutes)} broke={it.cost > 0 && sim.money < it.cost} busy={!!sim.activity} reason={ageBlock(it, life.stage?.id) ?? blockedBy(it, sim, city.id, commune.id)} onPick={() => onPick(it)} />
              ))}
              {host && deco && onArrange && (
                <button className="btn btn-soft mt-1 !text-sm" onClick={onArrange}>
                  <Sofa size={16} /> {tr('Aménager la salle')}
                </button>
              )}
              {host && (
                <button className="btn btn-soft mt-1 !text-sm" onClick={onEnd}>
                  {tr('Finir la soirée')}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr("La musique s'est arrêtée, les invités sont rentrés.")}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Throwing a soirée at home: its theme (from the list: players never write to one another), what it costs; with « soiree-deco », its entry and its room. */
function ThrowSoireeSheet({ sim, room, arranged, onArrange, onClose, onThrow }: { sim: Sim; /** « soiree-deco » open: the room's rules and the entry's bounds. */ room?: SoireeRoom; /** The room arranged already for this one. */ arranged?: boolean; onArrange?: () => void; onClose: () => void; onThrow: (theme: string, price: number) => void }) {
  const [theme, setTheme] = useState(SOIREE_THEMES[0].id)
  const [price, setPrice] = useState(0)
  const cost = soireeCost(sim)
  const broke = sim.money < cost
  const prices = room ? [...Array(Math.floor((room.entry.max - room.entry.min) / room.entry.step) + 1)].map((_, i) => room.entry.min + i * room.entry.step) : []
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up max-h-[85%] w-full overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <IconTile icon={PartyPopper} colors={['#ff5cc8', '#7a2bd6']} size={52} />
          <div className="min-w-0 flex-1">
            <div className="label">{tr('Chez toi')}</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{tr('Organiser une soirée')}</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        <p className="mb-3 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">
          {tx("La sono, le DJ et les boissons pour {SOIREE_HOURS} h. Les lumières s'allument au-dessus de chez toi : les joueurs du quartier les voient et viennent danser, tes amis sont prévenus.", { SOIREE_HOURS })}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SOIREE_THEMES.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} className={`flex items-center gap-2 rounded-[16px] border-2 p-2.5 text-left text-[13px] font-extrabold transition active:scale-[0.97] ${theme === t.id ? 'border-[#c2187a] bg-[#fdeaf6]' : 'border-transparent bg-[var(--color-canvas)]'}`}>
              <span className="flex shrink-0 gap-0.5">
                {t.colours.map((c) => (
                  <span key={c} className="h-4 w-1.5 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </span>
              <span className="min-w-0 leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        {room && (
          <>
            <div className="label mt-4 mb-1.5">{tr("L'entrée")}</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[0, ...prices].map((p) => (
                <button key={p} onClick={() => setPrice(p)} aria-pressed={price === p} className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-[13px] font-extrabold transition active:scale-[0.97] ${price === p ? 'border-[#c2187a] bg-[#fdeaf6]' : 'border-transparent bg-[var(--color-canvas)]'}`}>
                  {p ? fcfa(p) : tr('Entrée libre')}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs leading-snug font-bold text-[var(--color-ink-soft)]">
              {price ? tr('Chaque joueur paie {0} en entrant, pour toi. Tes amis et ceux que tu invites entrent gratuitement.', { 0: fcfa(price) }) : tr('Tout le monde entre sans payer.')}
            </p>
            <button className="mt-3 flex w-full items-center gap-3 rounded-[18px] bg-[#f6e8ff] p-2.5 text-left transition active:scale-[0.98]" onClick={onArrange}>
              <IconTile icon={Sofa} colors={['#ff5cc8', '#7a2bd6']} size={40} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-display text-[15px] font-extrabold">{tr('Aménager la salle')}</span>
                <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{arranged ? tr('Prête : touche pour la changer encore') : tr('Le bar, la sono, les tables, les canapés… comme ta maison')}</span>
              </span>
              {arranged ? <Check size={18} strokeWidth={3} className="shrink-0 text-[var(--color-emerald)]" /> : <ChevronRight size={18} strokeWidth={3} className="shrink-0" />}
            </button>
          </>
        )}
        <button className="btn mt-4 w-full" disabled={broke} onClick={() => onThrow(theme, price)}>
          <PartyPopper size={18} /> {broke ? tr('Il te faut {0}', { 0: fcfa(cost) }) : tr('Lancer la soirée · {0}', { 0: fcfa(cost) })}
        </button>
      </div>
    </div>
  )
}

/* ---------- Feedback ---------- */

/** A distance to read at a glance: « 320 m », « 1,2 km ». */
const metres = (m: number) => (m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`)

/**
 * A trip's kilometres left, as the map moves the car (WorldMap's useTrip): along its road (or the
 * crow's way, a quarter longer, for a trip without one), once the driver has come; null till then.
 */
function tripLeft(world: World, a: NonNullable<Sim['activity']>, now: number) {
  const t = a.trip
  if (!t) return undefined
  const from = world.cities.find((c) => c.id === t.fromCity)?.communes.find((c) => c.id === t.fromCommune)
  const to = world.cities.find((c) => c.id === t.city)?.communes.find((c) => c.id === t.commune)
  const total = t.path && t.path.length > 1 ? t.path.reduce((s, p, i) => (i ? s + km({ lng: t.path![i - 1][0], lat: t.path![i - 1][1] }, { lng: p[0], lat: p[1] }) : 0), 0) : from && to ? km(from, to) * 1.25 : 0
  if (!total) return undefined
  // Hailed at the roadside (or one's own), it's waiting at the kerb a moment; else the driver comes.
  const pick = t.city !== t.fromCity || t.mode === 'avion' || t.mode === 'metro' ? 0 : t.mode === 'perso' ? 0.2 : waitsAtKerb(t.mode) ? kerbWait(a.end - a.start) : Math.min(3, Math.max(0.75, (a.end - a.start) * 0.33))
  const at = now - a.start
  if (at < pick) return null
  return total * (1 - Math.min(1, Math.max(0, (at - pick) / Math.max(0.5, a.end - a.start - pick))))
}

/** On the way somewhere in the street (Walker publishes it): how far is left, and about how long. */
function WayLeft() {
  const [way, setWay] = useState(whereabouts.way)
  useEffect(() => {
    const t = setInterval(() => setWay(whereabouts.way && { ...whereabouts.way }), 500)
    return () => clearInterval(t)
  }, [])
  if (!way || way.left < 15) return null
  const Icon = way.how === 'moto' ? Bike : way.how === 'gbaka' ? Bus : way.how === 'taxi' || way.how === 'woro' ? CarTaxiFront : Footprints
  const secs = way.left / Math.max(0.5, way.speed)
  return (
    <span className="hud flex max-w-[230px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold">
      <Icon size={14} strokeWidth={2.6} className={`shrink-0 ${way.how === 'moto' ? 'text-[#c92a2a]' : 'text-[var(--color-orange)]'}`} />
      {way.to && <span className="min-w-0 truncate">{way.to}</span>}
      <span className="shrink-0 whitespace-nowrap">
        {way.to ? '· ' : ''}
        {metres(way.left)} · {secs < 60 ? tr("moins d'1 min") : `${Math.round(secs / 60)} min`}
      </span>
    </span>
  )
}

/**
 * At the wheel (world3d/drive.ts): the speed and the distance up top with « Garer »; the wheel
 * (◀ ▶) under the left thumb, the pedals (brake, accelerate) under the right; held down. The keys
 * drive too (the arrows, ZQSD), and the pad.
 */
function DriveHud({ driven, onPark, onWhere, onParkAt }: { driven: Driven; onPark: () => void; /** « Où aller ? »: the places, the GPS taking the car to the one chosen. */ onWhere: () => void; /** Parked before a place, and in. */ onParkAt: (id: string) => void }) {
  const [, tick] = useState(0)
  useEffect(() => {
    // A bump (a wall, a car): felt in the hands.
    let felt = drive.bumped
    const t = setInterval(() => {
      tick((n) => n + 1)
      if (drive.bumped !== felt) {
        felt = drive.bumped
        haptic('heavy')
      }
    }, 150)
    return () => {
      clearInterval(t)
      Object.assign(drive, { throttle: 0, steer: 0 })
    }
  }, [])
  const hold = (set: () => void, clear: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => (e.currentTarget.setPointerCapture(e.pointerId), set()),
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  const kmh = Math.round(Math.abs(drive.speed) * 3.6)
  const bumped = performance.now() - drive.bumped < 600
  // A place's door by the car (slowing down before Babi Burger…): park there and go in.
  const near = whereabouts.places.filter((p) => p.kind !== 'happening' && p.kind !== 'plot').map((p) => ({ p, d: distanceTo(p.door) })).filter((x) => x.d < 16).sort((a, b) => a.d - b.d)[0]?.p
  const to = gps.to
  const next = to ? gps.next : null
  const arrived = next?.turn === 'arrive'
  const there = arrived && to ? to : near
  const round = 'grid touch-none place-items-center rounded-full shadow-[0_5px_0_rgba(0,0,0,0.25)] select-none active:translate-y-1'
  return (
    <>
      {/* (The speed and « Garer » over the pedals, the GPS under the buttons on the right: nothing on top of anything.) */}
      <div className="hud absolute bottom-[calc(12.3rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] left-1/2 z-30 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-4 text-sm font-extrabold whitespace-nowrap">
        <span className={`font-display text-[22px] leading-none ${bumped ? 'text-[var(--color-rose)]' : ''}`}>{kmh}</span>
        <span className="text-[11px] text-[var(--color-ink-soft)]">{tr('km/h ·')} {metres(drive.metres)}</span>
        <span className="max-w-[110px] truncate text-[12px]">{driven.name}</span>
        <button className="icon-btn !h-8 !w-8 bg-[var(--color-canvas)]" onClick={onWhere} aria-label={tr('Où aller ?')}>
          <Navigation size={16} strokeWidth={2.6} className="text-[var(--color-orange)]" />
        </button>
        <button className="btn !bg-[var(--color-orange)] !px-3 !py-1.5 !text-xs" onClick={onPark}>
          {tr('Garer')}
        </button>
      </div>
      {/* The GPS: the next turn, and where to */}
      {to && (
        <div className="hud absolute top-[9rem] left-1/2 z-30 flex w-[min(360px,calc(100vw-24px))] -translate-x-1/2 items-center gap-3 rounded-[20px] py-2 pr-2 pl-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ffd43b] text-[#16161c]">
            {!next && gps.lost ? <ArrowUp size={28} strokeWidth={3} style={{ transform: `rotate(${bearingTo(to.door)}rad)` }} /> : arrived ? <MapPin size={26} strokeWidth={2.8} /> : next?.turn === 'left' ? <CornerUpLeft size={28} strokeWidth={3} /> : next?.turn === 'right' ? <CornerUpRight size={28} strokeWidth={3} /> : next?.turn === 'uturn' ? <Undo2 size={26} strokeWidth={3} /> : <ArrowUp size={28} strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-display text-[17px] font-extrabold">
              {!next && gps.lost ? tr('Hors des rues : {0}, par là', { 0: metres(gps.lost) }) : !next ? tr('Je cherche le chemin…') : arrived ? tr('Tu es arrivé·e') : next.turn === 'uturn' ? tr('Fais demi-tour') : next.turn === 'straight' ? tr('Tout droit, {0}', { 0: metres(next.in) }) : tr('À {0} dans {1}', { 0: next.turn === 'left' ? 'gauche' : 'droite', 1: metres(Math.max(10, Math.round(next.in / 10) * 10)) })}
            </span>
            <span className="block truncate text-xs font-bold text-[var(--color-ink-soft)]">
              {to.name}
              {next && !arrived ? ` · ${metres(gps.left)}` : ''}
            </span>
          </span>
          <button className="icon-btn !h-8 !w-8 bg-[var(--color-canvas)]" onClick={() => ((gps.to = null), (gps.way = null), (gps.next = null))} aria-label={tr('Arrêter le GPS')}>
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>
      )}
      {/* At a place's door: park and go in */}
      {there && Math.abs(drive.speed) < 9 && (
        <div className="absolute inset-x-0 bottom-[calc(15.6rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 flex justify-center px-3">
          <button className="btn animate-pop max-w-full !px-4 !py-2.5 !text-sm" onClick={() => onParkAt(there.id)}>
            <Car size={17} strokeWidth={2.6} /> <span className="truncate">{tr('Garer devant')} {there.name}</span>
          </button>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-[calc(6.5rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 flex items-end justify-between px-4">
        <div className="flex gap-2">
          {([-1, 1] as const).map((d) => (
            <button key={d} className={`${round} h-[72px] w-[72px] bg-white/90 text-[var(--color-ink)]`} {...hold(() => (drive.steer = d), () => drive.steer === d && (drive.steer = 0))} aria-label={d < 0 ? tr('À gauche') : tr('À droite')}>
              {d < 0 ? <ChevronLeft size={40} strokeWidth={3} /> : <ChevronRight size={40} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button className={`${round} h-[64px] w-[64px] bg-[#e03131] text-[13px] font-extrabold text-white`} {...hold(() => (drive.throttle = -1), () => drive.throttle < 0 && (drive.throttle = 0))}>
            {tr('Frein')}
          </button>
          <button className={`${round} h-[84px] w-[84px] bg-[var(--color-emerald)] text-[13px] font-extrabold text-white`} {...hold(() => (drive.throttle = 1), () => drive.throttle > 0 && (drive.throttle = 0))}>
            {driven.kind === 'velo' ? tr('Pédaler') : tr('Gaz')}
          </button>
        </div>
      </div>
    </>
  )
}

/** Its vehicle parked a few steps away (drive.ts parked): « Monter », and off from where it stands. */
function GetIn({ simId, commune }: { simId: string; commune: string }) {
  const parked = useParked()
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (!parked || parked.sim !== simId || parked.commune !== commune || parked.v.id === RENTED) return setNear(false)
    const t = setInterval(() => setNear(distanceTo([parked.x, parked.z]) < 5), 400)
    return () => clearInterval(t)
  }, [parked, simId, commune])
  if (!parked || !near) return null
  return (
    <div className="absolute inset-x-0 bottom-[calc(7.4rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] z-30 flex justify-center px-3">
      <button
        className="btn animate-pop max-w-full !px-4 !py-2.5 !text-sm"
        onClick={() =>
          // To its door first, then in and off from where it stands.
          walkToVehicle(parked, () => {
            setParked(null)
            startDrive(parked.v)
          })
        }
      >
        <Car size={17} strokeWidth={2.6} /> <span className="truncate">{tr('Monter dans')} {parked.v.name}</span>
      </button>
    </div>
  )
}

/** A tap on the ground on the way to a place: drop the way for that spot? (world3d/dropRoute.ts) */
function DropRouteAsk({ from, moto }: { from: string; moto: boolean }) {
  return (
    <div className="hud animate-up absolute bottom-[calc(7.5rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] left-1/2 z-30 flex w-[min(380px,calc(100vw-24px))] -translate-x-1/2 items-center gap-2 rounded-[22px] p-2 pl-3 text-sm font-extrabold">
      <Navigation size={20} className="shrink-0 text-[var(--color-orange)]" />
      <span className="min-w-0 flex-1 leading-tight">
        {tr('Aller plutôt ici ?')}
        <span className="line-clamp-2 block text-xs text-[var(--color-ink-soft)]">
          {tx('Tu laisses tomber {from} {0}', { from, 0: moto ? tr(' et tu descends de la moto-taxi (déjà payée).') : '.' })}
        </span>
      </span>
      <button className="btn btn-soft !px-3 !py-2 !text-xs" onClick={() => answerDrop(false)}>
        {tr('Continuer')}
      </button>
      <button className="btn !px-3 !py-2 !text-xs" onClick={() => answerDrop(true)}>
        {tr('Aller ici')}
      </button>
    </div>
  )
}

/** What the Sim is busy with, on real time: progress, time left, and a way to stop. */
function ActivityBar({ world, sim, onStop, stopping, onRoute, onMore, onRejoin, onDefi, onTask, onFilm, onMachine, onShop, onFridge }: { world: World; sim: Sim; onStop: () => void; stopping: boolean; onRoute: () => void; /** At a slot machine: back to it. */ onMachine?: () => void; /** In a boutique: back to its rails. */ onShop?: () => void; /** Doing the shopping: some for the fridge at home. */ onFridge?: () => void; /** At the ciné-club: the real film, to watch. */ onFilm?: () => void; /** At the zoo: the other things to do there. */ onMore?: () => void; /** A match left before its end: back onto the pitch. */ onRejoin?: { sport: 'foot' | 'basket' | 'tennis' | 'volley' | 'beach'; go: () => void }; /** The activity taken on as a défi. */ onDefi?: () => void; /** At work: one of the job's tasks (backend sims/jobs.go). */ onTask?: (t: JobTask) => Promise<ActionResult['outcome']> }) {
  const a = sim.activity!
  const span = Math.max(1, a.end - a.start)
  const done = Math.min(1, Math.max(0, (sim.gameMinutes - a.start) / span))
  const left = Math.max(0, Math.ceil(a.end - sim.gameMinutes))
  const travel = a.kind === 'travel'
  // Played, not waited for (the update « gestes-maison »): no time to show, the game finishes it.
  // (Left to play by itself, le mode vie: it has its time; its game can still be played, for a better result.)
  const toPlay = !!onDefi && a.kind === 'do' && !a.auto && (gesteOK(a) || GESTE_DEFIS.has(defiOf(a.interaction.id)!))
  // On the server's clock, like the car in the street (the Sim's minutes come with its updates, late).
  const road = travel ? tripLeft(world, a, (serverNow() - EPOCH) / 60000) : undefined
  // In one's own vehicle: it, in its colour.
  const own = travel ? a.trip?.vehicle : undefined
  const icon = own ? (own.kind === 'voiture' ? Car : Bike) : travel ? CarTaxiFront : iconFor(a.interaction.icon)
  const colors = own ? ([own.color, own.color] as [string, string]) : travel ? (['#ffa040', '#ff6a00'] as [string, string]) : kindColors(a.placeKind ?? '')
  return (
    <div className="absolute bottom-[calc(6.5rem+var(--hud-lift,0px))] left-1/2 z-30 w-[min(360px,calc(100vw-24px))] -translate-x-1/2 lg:bottom-[calc(7.5rem+var(--hud-lift,0px))]">
      <div className="card animate-pop flex items-center gap-3 p-3">
        <IconTile icon={icon} colors={colors} size={46} style={own ? { color: inkOn(own.color), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' } : undefined} />
        <div className="min-w-0 flex-1">
          <div className="label truncate">{travel ? tr('En route') : a.placeName}</div>
          <div className="truncate font-display text-[15px] leading-tight font-extrabold">{travel ? a.trip!.label.replace(/^Trajet /, '') : a.interaction.label}</div>
          {!toPlay && (
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
              <div className="h-full rounded-full bg-[var(--color-emerald)] transition-[width] duration-1000 ease-linear" style={{ width: `${done * 100}%` }} />
            </div>
          )}
          <div className="mt-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">{toPlay ? tr('Joue-la pour la faire : pas de temps qui compte') : left <= 0 ? tr('Presque fini…') : road === null ? tr('{0} · encore {1}', { 0: a.trip?.mode === 'perso' ? tr('Tu montes') : a.trip && waitsAtKerb(a.trip.mode) ? tr('Il t’attend au bord de la route') : tr('Le chauffeur arrive'), 1: duration(left) }) : tr('Encore {0}{1} · fin à {time}', { 0: duration(left), 1: road !== undefined ? ` · ${metres(road * 1000)}` : '', time: clock(a.end).time })}</div>
        </div>
        {travel && (
          <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onRoute} aria-label={tr('Voir le trajet')} title={tr('Voir le trajet')}>
            <MapIcon size={20} strokeWidth={2.4} />
          </button>
        )}
        {onMore && (
          <button className="icon-btn shrink-0 bg-[var(--color-orange)] text-white" onClick={onMore} aria-label={tr('Que faire ?')} title={tr('Que faire ?')}>
            <Sparkles size={18} strokeWidth={2.6} />
          </button>
        )}
        {!travel && a.placeId !== 'maca' && a.placeId !== 'commissariat' && (
          <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onStop} disabled={stopping} aria-label={tr('Arrêter')} title={tr('Arrêter')}>
            <Square size={18} strokeWidth={2.8} />
          </button>
        )}
      </div>
      {onTask && <JobTasks world={world} sim={sim} onTask={onTask} />}
      {onFilm && a.seance?.video && a.seance.at !== undefined && <FilmButton at={a.seance.at} onWatch={onFilm} />}
      {onDefi && (defiOf(a.interaction.id) || a.auto) && <DefiButton kind={defiOf(a.interaction.id) ?? 'geste'} interactionId={a.interaction.id} onClick={onDefi} better={!!a.auto} />}
      {onMachine && <MachineButton onClick={onMachine} />}
      {onShop && (
        <button className="btn animate-pop mt-2 w-full !py-2.5" onClick={onShop}>
          <Shirt size={18} /> {tr('Voir les vêtements')}
        </button>
      )}
      {onFridge && (
        <button className="btn animate-pop mt-2 w-full !py-2.5" onClick={onFridge}>
          <Refrigerator size={18} /> {tr('Remplir le frigo')}
        </button>
      )}
      {onRejoin && (
        <button className="btn animate-pop mt-2 w-full !py-2.5" onClick={onRejoin.go}>
          <Volleyball size={18} /> {onRejoin.sport === 'tennis' ? tr('Revenir sur le court') : onRejoin.sport === 'basket' ? tr('Revenir sur le terrain') : tr('Revenir au match')}
        </button>
      )}
    </div>
  )
}

/**
 * At work: the job's tasks as buttons (the cashier scans, the lawyer
 * pleads, the DG signs), those of the Sim's rung; each one played as its own
 * little game (five a day, backend game.TasksADay), then the Sim's gesture in
 * the room and how it went.
 */
function JobTasks({ world, sim, onTask }: { world: World; sim: Sim; onTask: (t: JobTask) => Promise<ActionResult['outcome']> }) {
  const career = world.careers.find((c) => c.id === sim.career)
  const [said, setSaid] = useState<{ text: string; money?: number; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    if (!said) return
    const t = setTimeout(() => setSaid(null), 4500)
    return () => clearTimeout(t)
  }, [said])
  if (!career) return null
  const done = sim.activity?.tasks ?? {}
  const tasks = career.tasks.filter((t) => sim.careerLevel >= (t.minLevel ?? 0))
  const go = async (t: JobTask) => {
    setBusy(t.id)
    try {
      const out = await onTask(t)
      setSaid({ text: out.text, money: out.money })
    } catch (e) {
      setSaid({ text: errorText(e, tr('Pas possible maintenant.')), bad: true })
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="card animate-pop mt-2 p-2.5">
      <div className="label mb-1.5 px-0.5">{tx('Au travail · {title} · 5 tâches par jour', { title: career.levels[sim.careerLevel]?.title })}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tasks.map((t) => {
          const last = done[t.id]
          const Icon = iconFor(t.icon)
          return (
            <button key={t.id} className="tile flex min-w-0 items-center gap-2 p-2 text-left disabled:opacity-50" disabled={!!busy} onClick={() => go(t)}>
              <IconTile icon={Icon} colors={kindColors(career.kind)} size={32} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[12.5px] font-extrabold">{t.label}</span>
                <span className="block text-[10.5px] font-bold text-[var(--color-ink-soft)]">{last !== undefined ? tr('Fait · à rejouer') : t.tip ? tr('Pourboires possibles') : tr('+1 pour la promotion')}</span>
              </span>
            </button>
          )
        })}
      </div>
      {said && (
        <p className={`animate-pop mt-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-bold ${said.bad ? 'bg-[#fff0f0] text-[#c92a2a]' : 'bg-[#e6fcf5] text-[#087f5b]'}`}>
          {said.text}
        </p>
      )}
    </div>
  )
}

/** The rooms of a home, in the order the menu shows them. */
const ROOMS: { id: NonNullable<Interaction['room']>; label: string; icon: LucideIcon }[] = [
  { id: 'salle-de-bain', label: tr('Salle de bain'), icon: Bath },
  { id: 'chambre', label: tr('Chambre'), icon: BedDouble },
  { id: 'cuisine', label: tr('Cuisine'), icon: CookingPot },
  { id: 'salon', label: tr('Salon'), icon: Sofa },
  { id: 'cour', label: tr('Cour'), icon: Trees },
]
/** The actions room by room (those of no room first, without a heading); elsewhere than home, one list. */
function byRoom(items: Interaction[]): [(typeof ROOMS)[number] | null, Interaction[]][] {
  if (!items.some((it) => it.room)) return [[null, items]]
  const out: [(typeof ROOMS)[number] | null, Interaction[]][] = []
  const none = items.filter((it) => !it.room)
  if (none.length) out.push([null, none])
  for (const r of ROOMS) {
    const list = items.filter((it) => it.room === r.id)
    if (list.length) out.push([r, list])
  }
  return out
}

function ToastCard({ toast: t }: { toast: Toast }) {
  const icon = t.tone === 'random' ? Dice5 : t.tone === 'promo' ? BadgeCheck : t.tone === 'error' ? TriangleAlert : t.icon ? iconFor(t.icon) : Sparkles
  const colors: [string, string] =
    t.tone === 'random' || t.tone === 'event' ? ['#ffd54f', '#ffa000'] : t.tone === 'promo' ? ['#69e2a0', '#00a862'] : t.tone === 'error' ? ['#ff8a9b', '#ff3d57'] : kindColors(t.kind ?? '')
  return (
    <div className={`toast-card card motion-toast pointer-events-auto flex items-center gap-3 p-3 short:gap-2 short:p-2 ${t.tone === 'random' || t.tone === 'event' ? 'ring-2 ring-[var(--color-gold)]' : t.tone === 'promo' ? 'ring-2 ring-[var(--color-emerald)]' : ''}`}>
      {/* Something that didn't go through: Koffi comes to say it, kindly */}
      {t.tone === 'error' ? <Helper offline={t.title === 'Hors ligne'} /> : <IconTile icon={icon} colors={colors} size={44} />}
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15px] leading-tight font-extrabold short:text-[14px]">{t.title}</div>
        {t.text && <div className="text-sm leading-snug font-semibold text-[var(--color-ink-soft)] short:line-clamp-2 short:text-[12.5px]">{t.text}</div>}
      </div>
      {t.money !== 0 && <MoneyDelta value={t.money} />}
    </div>
  )
}

export function MoneyDelta({ value }: { value: number }) {
  return (
    <span className={`flex shrink-0 items-center gap-1 font-display text-base font-extrabold ${value > 0 ? 'text-[var(--color-emerald-deep)]' : 'text-[#d81b3f]'}`}>
      {value > 0 ? '+' : '−'}
      {amount(Math.abs(value))}
      <Coin size={16} />
    </span>
  )
}

export function Journal({ events }: { events: JournalEvent[] }) {
  if (!events.length) return <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr("Rien pour l'instant. Va vivre ta vie !")}</p>
  return (
    <ol className="relative space-y-2">
      {events.map((e) => {
        const c = clock(e.gameTime)
        const [icon, colors]: [LucideIcon, [string, string]] =
          e.kind === 'random'
            ? [Dice5, ['#ffd54f', '#ffa000']]
            : e.kind === 'travel'
              ? [Bus, ['#8c9eff', '#3d4fd6']]
              : e.kind === 'bill'
                ? [ReceiptText, ['#ff8a9b', '#ff3d57']]
                : e.kind === 'career'
                  ? [BadgeCheck, ['#69e2a0', '#00a862']]
                  : e.kind === 'life'
                    ? [Cake, ['#ff8ad8', '#d63aa8']]
                    : e.kind === 'social'
                      ? [Users, ['#ffa8c5', '#e83e8c']]
                    : e.kind === 'annonce'
                      ? [Megaphone, ['#ffb347', '#ea580c']]
                    : e.kind === 'errand'
                      ? [HandHelping, ['#8ce99a', '#2b8a3e']]
                    : [Sparkles, ['#ffa040', '#ff6a00']]
        return (
          <li key={e.id} className={`flex items-center gap-3 rounded-[20px] p-2.5 ${e.kind === 'random' ? 'bg-[#fff7df]' : e.kind === 'annonce' ? 'bg-[#fff1e6]' : 'bg-[var(--color-canvas)]'}`}>
            <IconTile icon={icon} colors={colors} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-snug font-bold">{e.text}</div>
              <div className="text-[11px] font-extrabold text-[var(--color-ink-soft)]">
                {c.stamp}
              </div>
            </div>
            {e.money !== 0 && <MoneyDelta value={e.money} />}
          </li>
        )
      })}
    </ol>
  )
}

/** "Le mot du jour": a Nouchi or Ivorian French expression, one per real day, from the checked ones only. */
function WordOfTheDay({ world, gameMinutes }: { world: World; gameMinutes: number }) {
  const words = (world.expressions ?? []).filter((e) => e.source.status === 'verified' || e.source.status === 'partial')
  if (!words.length) return null
  const e = words[Math.floor(gameMinutes / (24 * 60)) % words.length]
  return (
    <div className="mb-5 rounded-2xl bg-white/15 p-3 text-white backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold tracking-wide uppercase opacity-80">{tr('Le mot du jour ·')} {e.lang}</span>
        {e.source.urls?.[0] && (
          <a href={e.source.urls[0]} target="_blank" rel="noreferrer" className="text-[11px] font-bold underline opacity-80">
            {tr('source')}
          </a>
        )}
      </div>
      <div className="mt-1 font-display text-xl leading-tight font-extrabold">« {e.text} »</div>
      <p className="text-sm leading-snug font-semibold opacity-95">{e.meaning}</p>
      <p className="mt-1 text-xs italic opacity-80">{e.example}</p>
    </div>
  )
}

/** The Garbaya courier on the way, over the street. */
/**
 * A long way on foot: a moto-taxi is offered, for a fare by the distance
 * (world3d/moto.ts, backend sims/moto.go). Paid, the Sim rides the rest;
 * else it walks (runs, it's far).
 */
/**
 * A long way in the commune (world3d/moto.ts): on foot, or a ride for the rest, each with its
 * fare: the moto-taxi (the quickest), the taxi, the commune's woro-woro (where it has one), the
 * gbaka (in Abidjan). Picked, it's paid, and the Sim rides it in the street.
 */
function MotoOffer({ world, sim, commune, act, onTaken, onOwn }: { world: World; sim: Sim; commune: Commune; act: Act; /** Paid (the update « trajet-court »): the short loading screen instead of the whole ride. */ onTaken?: (r: Taken) => void; /** One's own vehicle chosen (the update « ma-voiture »): walked to if it's parked off, then driven there with the GPS. */ onOwn?: (c: CarHere) => void }) {
  const { offer, paid, walk, held } = useMoto()
  // One's own vehicles (« ma-voiture »), asked again with each offer (one bought meanwhile).
  const mine = useMyVehicles(world, sim, !!onOwn, offer)
  // On the way to one's own vehicle (myCar.ts): walking it, not asked how.
  useEffect(() => {
    if (toCar.active && offer && !walk && !paid) motoWalk()
  }, [offer, walk, paid])
  if (!offer || paid || walk || held || toCar.active) return null
  const car = onOwn ? pickCar(mine, sim.id, commune.id) : null
  const drunk = !!car && drankLately()
  const away = car && 'elsewhere' in car ? (world.cities.find((c) => c.id === sim.city)?.communes.find((c) => c.id === car.elsewhere)?.name ?? car.elsewhere) : null
  const there = car && !('elsewhere' in car) ? car : null
  const abidjan = !!world.compteur?.cities.includes(sim.city)
  const woro = abidjan && commune.woro && !commune.woro.none ? commune.woro : null
  const rides: { kind: RideKind; color: string; trim?: string }[] = [
    { kind: 'moto', color: MOTO },
    { kind: 'taxi', color: world.compteur?.color ?? '#ff7a00' },
    ...(woro ? [{ kind: 'woro' as const, color: woro.color ?? '#f1f3f5', trim: woro.trim }] : []),
    ...(abidjan ? [{ kind: 'gbaka' as const, color: GBAKA, trim: '#00a862' }] : []),
  ]
  const take = async (r: (typeof rides)[number]) => {
    if (await act(RIDES[r.kind].name, r.kind === 'moto' ? 'bike' : r.kind === 'gbaka' ? 'bus' : 'car-taxi-front', 'transport', () => api.moto(sim.id, offer, r.kind))) {
      if (onTaken) (motoHold(), onTaken(r))
      else motoPaid(r)
    }
  }
  return (
    <div className="hud animate-up absolute bottom-[calc(7.5rem+var(--sab,env(safe-area-inset-bottom))+var(--hud-lift,0px))] left-1/2 z-30 w-[min(400px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] p-2.5 text-sm font-extrabold">
      <div className="flex items-center gap-2 px-1">
        <span className="min-w-0 flex-1 leading-tight">
          {tx("C'est loin ({0} km) : comment tu y vas ?", { 0: (offer / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 }) })}
        </span>
        <button className="btn btn-soft !min-h-0 !px-3 !py-1.5 !text-xs" onClick={motoWalk}>
          <Footprints size={14} /> {tr('À pied')}
        </button>
      </div>
      {car && (() => {
        // One's own vehicle first (« ma-voiture »): at the wheel, the GPS takes it there; parked a way off, walked to
        // first. Not after a drink, nor when it was left in another commune: then a ride below.
        const v = car.v
        const Icon = v.kind === 'voiture' ? Car : Bike
        const per = world.vehicles?.find((m) => m.name === v.name)?.fuelPerKm ?? 0
        const fuel = per ? Math.ceil(((offer / 1000) * per) / 25) * 25 : 0
        const off = drunk || !!away
        const line = drunk ? tr('Tu as bu : pas de volant. Prends un taxi.') : away ? tr('Garée à {commune} : prends un taxi.', { commune: away }) : there && there.parked && there.metres > 12 ? tr('{name} · à {m} m à pied, puis le GPS', { name: v.name, m: Math.round(there.metres) }) : fuel ? tr('{name} · le GPS t’y mène · ~{fuel} d’essence', { name: v.name, fuel: fcfa(fuel) }) : tr('{name} · le GPS t’y mène', { name: v.name })
        return (
          <button disabled={off} onClick={() => there && onOwn!(there)} className="mt-2 flex w-full items-center gap-2.5 rounded-2xl bg-[var(--color-canvas)] p-2 text-left ring-2 ring-[var(--color-emerald)] disabled:opacity-50 disabled:ring-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-black/10" style={{ background: v.color, color: inkOn(v.color) }}>
              <Icon size={20} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-display text-[15px]">{myKindLabel(v.kind)}</span>
              <span className="block truncate text-[11.5px] text-[var(--color-ink-soft)]">{line}</span>
            </span>
            {!off && <span className="shrink-0 rounded-full bg-[var(--color-emerald)] px-3 py-1.5 text-xs text-white">{there?.parked && there.metres > 12 ? tr('J’y vais') : tr('Conduire')}</span>}
          </button>
        )
      })()}
      <div className={`mt-2 grid gap-1.5 ${rides.length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {rides.map((r) => {
          const fare = PUBLIC_RIDES.has(r.kind) ? discounted(rideFare(r.kind, offer), fareOff(world, sim)) : rideFare(r.kind, offer)
          const Icon = r.kind === 'moto' ? Bike : r.kind === 'gbaka' ? Bus : CarTaxiFront
          return (
            <button key={r.kind} disabled={sim.money < fare} onClick={() => void take(r)} className="flex flex-col items-center gap-0.5 rounded-2xl bg-[var(--color-canvas)] px-1 py-2 text-[11.5px] leading-tight disabled:opacity-40">
              <span className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-black/10" style={{ background: r.color, color: inkOn(r.color) }}>
                <Icon size={17} strokeWidth={2.4} />
              </span>
              <span className="truncate">{RIDES[r.kind].name}</span>
              <span className="text-[var(--color-ink-soft)]">{fcfa(fare)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DeliveryPill({ delivery, now, onOpen, low }: { delivery: Delivery; now: number; onOpen: () => void; /** Under the next goal (update « ecran-simple »: the goal has the top's second row). */ low?: boolean }) {
  const st = deliveryState(delivery, now)
  return (
    <button className={`hud absolute ${low ? 'top-[max(7.5rem,calc(var(--sat,env(safe-area-inset-top))+7rem))]' : 'top-[5.5rem]'} left-1/2 z-30 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-extrabold whitespace-nowrap`} onClick={onOpen}>
      <AppLogo id="golvo" size={30} radius={15} />
      {st.stage === 'here' ? tr('{courier} est là avec ta commande !', { courier: delivery.courier }) : st.stage === 'kitchen' ? tr('{name} prépare ta commande', { name: delivery.place.name }) : tr('{courier} arrive · {minutesLeft} min', { courier: delivery.courier, minutesLeft: st.minutesLeft })}
    </button>
  )
}

/**
 * At an airport: the flights out (backend game/flights.go, the game's own
 * airline): where to, how long, how much a seat. Booked, the Sim boards.
 */
function Flights({ world, sim, placeId, busy, onTravel }: { world: World; sim: Sim; placeId: string; busy: boolean; onTravel: OnTravel }) {
  const feats = useFeatures()
  // (Those an update holds back, Grand-Bassam's: « voyages-villes ».)
  const flights = flightsFrom(world, sim.city, (k) => keyOpen(feats, k)).filter((f) => f.place === placeId)
  if (!flights.length) return null
  return (
    <div className="mb-3 rounded-[20px] bg-[#eef4ff] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#1d4ed8]">
        <Plane size={18} /> {tx('Envols · {airline}', { airline: flights[0].airline })}
      </div>
      <ul className="space-y-1.5">
        {flights.map((f) => (
          <li key={f.to} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{f.toName}</span>
              <span className="block text-xs font-bold text-[var(--color-ink-soft)]">
                {tx('{km} km · {minutes} min de vol', { km: f.km, minutes: keyOpen(feats, TRAVEL_KEY) ? (f.game ?? f.minutes) : f.minutes })}
              </span>
            </span>
            <button className="btn !bg-[#1d4ed8] !px-3 !py-2 !text-xs" disabled={busy || sim.money < f.fare} onClick={() => onTravel(f.to, f.commune, tr('Vol pour {name}', { name: f.toName }), { app: 'avion' }, f.fare)}>
              {fcfa(f.fare)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * At a gare routière: the cars to the other cities, with their time and
 * fare, as the flights at the airport. They arrive at the town's own gare
 * (Abidjan's at Adjamé), or its centre.
 */
function Departures({ world, sim, placeId, busy, onTravel }: { world: World; sim: Sim; placeId: string; busy: boolean; onTravel: OnTravel }) {
  const feats = useFeatures()
  const from = world.cities.find((c) => c.id === sim.city)?.communes.find((c) => c.id === sim.commune)
  if (!from) return null
  if (keyOpen(feats, TRAVEL_KEY)) return <CoachBoard world={world} sim={sim} placeId={placeId} busy={busy} onTravel={onTravel} />
  const cars = world.cities
    .filter((c) => c.id !== sim.city)
    .map((c) => {
      const to = c.communes.find((cm) => cm.places.some((p) => p.kind === 'transport' && /gare routi/i.test(p.name))) ?? c.communes[0]
      return { city: c, to, t: trip(sim.city, from, c.id, to, world) }
    })
    .sort((a, b) => a.t.minutes - b.t.minutes)
  return (
    <div className="mb-3 rounded-[20px] bg-[#e9fbf1] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#087f5b]">
        <Bus size={18} /> {tr('Départs en car')}
      </div>
      <ul className="space-y-1.5">
        {cars.map(({ city, to, t }) => (
          <li key={city.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{city.name}</span>
              <span className="block truncate text-xs font-bold text-[var(--color-ink-soft)]">
                {tx('{0} {1} de route', { 0: to.name !== city.name ? `${to.name} · ` : '', 1: duration(actionLength(t.minutes)) })}
              </span>
            </span>
            <button className="btn !bg-[#087f5b] !px-3 !py-2 !text-xs" disabled={busy || sim.money < t.fare} onClick={() => onTravel(city.id, to.id, `En car vers ${city.name}`, undefined, t.fare)}>
              {fcfa(t.fare)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * At the gare routière (the update « voyages-villes »): the coaches to every
 * other city, each line's company, its next departure, how long on the road and
 * the ticket's price; bought, the Sim boards it. At another gare (the gbakas'),
 * where the coaches leave from.
 */
function CoachBoard({ world, sim, placeId, busy, onTravel }: { world: World; sim: Sim; placeId: string; busy: boolean; onTravel: OnTravel }) {
  const lines = coachesFrom(world, sim.city)
  const gare = gareOf(world, sim.city)
  if (!lines.length || !gare) return null
  if (gare.place.id !== placeId)
    return (
      <div className="mb-3 flex items-center gap-2 rounded-[20px] bg-[#e9fbf1] p-3 text-sm font-bold text-[#087f5b]">
        <Bus size={18} className="shrink-0" /> {tx('Les cars pour les autres villes partent de la {0}.', { 0: gare.place.name })}
      </div>
    )
  const rows = lines.map((r) => ({ r, at: nextCoach(r, sim.gameMinutes), co: coachCompany(world, r.company) })).sort((a, b) => a.r.game - b.r.game)
  return (
    <div className="mb-3 rounded-[20px] bg-[#e9fbf1] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#087f5b]">
        <Bus size={18} /> {tr('Départs en car')}
      </div>
      <ul className="space-y-1.5">
        {rows.map(({ r, at, co }) => (
          <li key={r.to} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: `linear-gradient(${co.body}, ${co.stripe})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{r.toName}</span>
              <span className="block truncate text-xs font-bold text-[var(--color-ink-soft)]">
                {at === null ? tx("{0} · plus de départ aujourd'hui (premier à {1})", { 0: co.name, 1: clockLabel(r.first) }) : tx('{0} · départ {1} · {2} de route', { 0: co.name, 1: clockLabel(at), 2: duration(r.game) })}
              </span>
            </span>
            <button className="btn !bg-[#087f5b] !px-3 !py-2 !text-xs" disabled={busy || at === null || sim.money < r.fare} onClick={() => onTravel(r.to, r.commune, tr('En car vers {name}', { name: r.toName }), { app: 'car' }, r.fare)}>
              {fcfa(r.fare)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** At a court: how many play there now, out of the places the sport has. */
function CourtCount({ placeId }: { placeId: string }) {
  const [c, setC] = useState<Awaited<ReturnType<typeof api.courtAt>> | null>(null)
  useEffect(() => {
    let live = true
    const load = () => api.courtAt(placeId).then((r) => live && setC(r), () => live && setC(null))
    load()
    const t = setInterval(load, 10000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [placeId])
  if (!c) return null
  const full = c.players >= c.cap
  const on = c.start !== undefined && c.start <= serverNow()
  return (
    <div className={`mb-3 flex items-center gap-2 rounded-[18px] p-3 text-sm font-extrabold ${full ? 'bg-[#ffe3e3] text-[#c92a2a]' : 'bg-[#e6fcf5] text-[#087f5b]'}`}>
      <Users size={18} />
      {full ? tr('Terrain complet : {players}/{cap} joueurs', { players: c.players, cap: c.cap }) : c.players ? `${c.players}/${c.cap} joueurs ${on ? tr('en plein match') : tr('attendent le coup d’envoi')}` : tr('Terrain libre : {cap} places ({0})', { cap: c.cap, 0: c.sport === 'foot' ? tr('5 contre 5') : c.sport === 'foot11' ? tr('11 contre 11') : c.sport === 'tennis' ? tr('simple') : c.sport === 'beach' ? tr('2 contre 2') : c.sport === 'volley' ? tr('6 contre 6') : tr('3 contre 3') })}
    </div>
  )
}

/** The club's hours (backend sims/billets.go clubOpen): 21 h to 4 h. */
const clubOpenAt = (m: number) => {
  const h = Math.floor(m / 60) % 24
  return h >= 21 || h < 4
}

/**
 * « Lancer des billets »: the handful chosen (1 000, 5 000, 10 000 Djai), a
 * tap throws it over the dancers (world3d/clubDecor BilletsBurst); not an
 * activity, whatever the Sim is doing. Under the name, where nothing is in a
 * place, on every screen.
 */
/** A gift a tap at a time, not an activity: the notes over the club's dancers, the quête at mass, the offrande at the culte. */
function Billets({ money, onThrow, amounts = [1000, 5000, 10000], label = tr('Lancer des billets'), color = '#1f9a4a' }: { money: number; onThrow: (amount: number) => Promise<string>; amounts?: number[]; label?: string; color?: string }) {
  const [amount, setAmount] = useState(amounts[0])
  const [said, setSaid] = useState<{ text: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!said) return
    const t = setTimeout(() => setSaid(null), 3500)
    return () => clearTimeout(t)
  }, [said])
  const go = async () => {
    setBusy(true)
    try {
      setSaid({ text: await onThrow(amount) })
    } catch (e) {
      setSaid({ text: errorText(e, tr('Pas possible')), bad: true })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pointer-events-none absolute top-[calc(max(0.75rem,var(--sat,env(safe-area-inset-top)))+3.9rem)] left-3 z-20 flex w-[min(15rem,calc(100vw-9rem))] flex-col items-start gap-1.5 lg:top-[6.5rem] lg:left-5">
      <div className="hud pointer-events-auto flex gap-1 rounded-full p-1">
        {amounts.map((a) => (
          <button key={a} onClick={() => setAmount(a)} className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${amount === a ? 'bg-[var(--color-ink)] text-white' : ''}`}>
            {a >= 1000 ? `${a / 1000} 000` : a}
          </button>
        ))}
      </div>
      <button disabled={busy || money < amount} onClick={() => void go()} className="pointer-events-auto flex items-center gap-2 rounded-full py-2.5 pr-4 pl-3 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] transition active:scale-95 disabled:opacity-50" style={{ background: color }}>
        <Banknote size={18} /> {money < amount ? tr('Pas assez') : label}
      </button>
      {said && <span className={`hud animate-pop rounded-2xl px-3 py-1.5 text-xs font-bold ${said.bad ? 'text-[#d81b3f]' : ''}`}>{said.text}</span>}
    </div>
  )
}
