import { openSpot, setSceneActions, useSceneActions, type SceneAction } from '../world3d/sceneActions'
import { gesture } from '../world3d/gesture'
import type { Pose } from '../avatar/Human'
import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, BookOpen, ZapOff, KeyRound, Volleyball, Banknote, Bike, Camera, Plane, Images, Megaphone, Smile, Cake, Hammer, Eye, LocateFixed, LogOut, Mountain, Navigation, Briefcase, DoorOpen, Hourglass, Newspaper, Square, Shirt, Scissors, Bus, CarTaxiFront, ChevronLeft, ChevronRight, Clock3, Dice5, Footprints, House, Lock, Map as MapIcon, MapPin, MessageCircle, ReceiptText, Smartphone, Sparkles, TriangleAlert, UserRound, Users, X, Bath, BedDouble, CookingPot, Sofa, Trees, type LucideIcon, CornerUpLeft, CornerUpRight, ArrowUp, Undo2, Car, Gamepad2, ShoppingBag, Lightbulb, Landmark, PartyPopper } from 'lucide-react'
import { api, ApiError, errorText } from '../lib/api'
import { useOnline } from '../lib/offline'
import { onSynced, pendingOffline, picking } from '../lib/offlinePlay'
import type { ActionResult, City, Commune, HappeningNow, Interaction, JobTask, JournalEvent, Player, Sim, Soiree, World, Ride, Place, Plot, StreetRide } from '../lib/types'
import { useWorld } from '../store/world'
import { useSession } from '../store/session'
import { joinMatch, type CourtMatch } from '../streetball/online'
import { serverNow } from '../lib/worldClock'
import { SIM_CHANGED, useLive } from '../lib/live'
import { WorldMap } from './WorldMap'
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
import { Portrait } from '../avatar/portrait'
import { Neighbourhood } from '../world3d/Neighbourhood'
import { OpenWorld } from '../world3d/open/OpenWorld'
import { GROUNDS, LANDMARKS, OPEN_AIR } from '../world3d/open/landmarks'
import { rooftopFor } from '../world3d/open/rooftops'
import { iconFor, kindColors } from '../components/icons'
import { SOIREE_COST, SOIREE_HOURS, SOIREE_THEMES } from '../game/soirees'
import { Chip, Coin, DayNight, IconTile, MotiveRing, MoodPin, Row, needColor } from '../components/ui'
import { EPOCH, NEEDS, km, actionLength, ageBlock, amount, fcfa, atHome, blockedBy, homeLacks, housingOf, lifeOf, minutesToAge, clock, duration, mood, openAt, openingLabel, predict, shift, trip } from '../game/rules'
import { DOORS_OPEN, eventAt, useStadium, when } from '../lib/stadium'
import { CIVIC_KINDS, civicState, discounted, fareOff, PUBLIC_RIDES, useTerrain, withMeasures } from '../lib/civic'
import { HomeApp, JobsApp, type Act } from './phoneApps'
import { NewsApp, topicOf } from './NewsApp'
import { GuideApp } from './GuideApp'
import { IdeasApp } from './IdeasApp'
import { PolitiqueApp } from './PolitiqueApp'
import { DodoApp } from './DodoApp'
import { KineoApp } from './KineoApp'
import { DamesApp } from './DamesApp'
import { AwaleApp } from './AwaleApp'
import { LudoApp } from './LudoApp'
import { HuitApp } from './HuitApp'
import { BingoApp } from './BingoApp'
import { CasinoApp } from './CasinoApp'
import { GodeApp } from './GodeApp'
import { RideFlow, type FlowRequest } from '../components/RideFlow'
import { INDOOR, Interior, SCENES } from '../world3d/Interior'
import { HomeInside } from '../world3d/HomeInside'
import { ARENAS, Arena } from '../world3d/interior/Arena'
import { AppLogo } from '../components/AppLogo'
import { TesterTools } from '../components/TesterTools'
import { GolvoApp, deliveryState, type Delivery } from './GolvoApp'
import { FilmButton, FilmPlayer } from './FilmPlayer'
import { GbairaiApp } from './GbairaiApp'
import { TikitokoApp } from './TikitokoApp'
import { BabigramApp } from './BabigramApp'
import { BetApp } from './BetApp'
import { WayeApp } from './WayeApp'
import { BoutiqueApp, passOn } from './BoutiqueApp'
import { StoreApp } from './StoreApp'
import { FriendsApp } from './FriendsApp'
import { CameraView } from './CameraView'
import { FlasheApp } from './FlasheApp'
import { EmoteSheet } from './EmoteSheet'
import { GalleryApp } from './GalleryApp'
import { InviteBanner, PlayersChip, PlayersSheet, usePlayers } from '../components/Players'
import { DamesBanner, DamesSheet, DamesStake } from '../components/Dames'
import { HuitBanner, HuitSheet, HuitStake } from '../components/Huit'
import { MachineButton, MachineSheet, isSlots } from '../components/Machine'
import { ClothesShop } from '../components/ClothesShop'
import { SHOP_OF } from '../lib/clothes'
import { SoundToggle, Soundtrack } from '../components/Soundtrack'
import { usePartySound } from '../world3d/open/party'
import { MiniMap, WhereTo } from '../components/Navigator'
import { ChatSheet, type FreeTalk, type Reply } from '../components/ChatSheet'
import { SERVICES } from '../world3d/interior/worshipRooms'
import { npcReact } from '../world3d/open/npcReact'
import type { Npc } from '../world3d/open/OpenWorld'
import { setTalkHandler, setTalking } from '../world3d/talk'
import type { Track } from '../audio/music'
import { NotifyPrompt } from '../components/NotifyPrompt'
import { motoPaid, motoWalk, rideFare, RIDES, useMoto, type RideKind } from '../world3d/moto'
import { GBAKA, inkOn, kerbWait, MOTO, waitsAtKerb } from '../game/rides'
import { answerDrop, useDropAsk } from '../world3d/dropRoute'
import { DefiButton, DefiSheet, defiLook, defiOf, PRACTICE, type DefiKind } from '../components/Defi'
import { BolideApp } from './BolideApp'
import { Tutorial, beginner, openTutorial, useTutorialAsked } from '../components/Tutorial'
import { haptic, onBack } from '../lib/native'
import { drive, getIn, gps, parkedNow, parkIn, setParked, startDrive, stopDrive, topSpeed, useDriving, useParked, type Driven } from '../world3d/drive'
import { FlightView } from '../world3d/FlightView'
import { MetroView } from '../world3d/MetroView'
import { PhoneIcon } from '../components/PhoneIcon'
import { aCommune } from '../lib/french'

/** Building one's house: its own screen, downloaded when opened. */
/** A game home on Dodo, by its kind: the house drawn (game/plans.go), two to choose from by its seed. */
const DODO_PLANS: Record<string, string[]> = { chambre: ['cour', 'baraque'], studio: ['studio'], appart: ['appart'], duplex: ['maison', 'appart'], villa: ['villa', 'villa-grande'] }
/** What's done in a home booked on Dodo, as the home's inside shows it (backend game/dodo.go « logement »). */
const DODO_AT_HOME: Record<string, string> = { 'logement-dormir': 'sleep', 'logement-sieste': 'nap', 'logement-douche': 'shower', 'logement-cuisiner': 'cook-attieke', 'logement-tele': 'watch-tv', 'logement-amis': 'call-family' }
const BuildMode = lazy(() => import('../components/BuildMode'))
const KartRace = lazy(() => import('../kart/KartRace'))
// The Hôtel Ivoire's own inside: its hall, cinema, casino, terrace.
// The big shopping centres' own inside: the supermarket, the gallery of shops, the food court.
const MallInside = lazy(() => import('../world3d/interior/MallInside').then((m) => ({ default: m.MallInside })))
import type { MallLayout } from '../world3d/interior/MallInside'
import { activityOpen, keyOpen, useFeatures } from '../lib/features'
import { FeatureNews } from '../components/FeatureNews'
import { Sheet } from '../components/Sheet'
import { Splash } from '../components/Splash'
import { Helper } from '../components/Helper'
import { LotPlaceHud } from '../components/LotPlaceHud'
import { useLotPlace } from '../store/lotPlace'
const IvoireInside = lazy(() => import('../world3d/interior/IvoireInside').then((m) => ({ default: m.IvoireInside })))
const CathedralInside = lazy(() => import('../world3d/interior/CathedralInside').then((m) => ({ default: m.CathedralInside })))
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
  'cocody-sococe': { market: 'SOCOCÉ', back: ['PRESSING DES 2 PLATEAUX', 'BOULANGERIE', 'PHONE 225', 'PHARMACIE', 'MODE WAX'], front: ['LIBRAIRIE', 'BEAUTÉ & CO', '', 'CAFÉ DES PLATEAUX'], kineo: true },
  'marcory-capsud': { kineo: true },
  'cocody-playce': { market: 'BABI MARKET', back: ['MODE WAX', 'BABI SNEAKERS', 'PHONE 225', 'PHARMACIE DE LA PALMERAIE', 'OPTIQUE D’IVOIRE'], front: ['LIBRAIRIE', 'BEAUTÉ & CO', 'BURGER 225', 'CAFÉ DE LA RIVIERA'], style: 'palmeraie' },
  'marcory-playce': { market: 'BABI MARKET', back: ['MODE WAX', 'BABI SNEAKERS', 'PHONE 225', 'PHARMACIE DE MARCORY', 'BIJOUX D’ÉBÈNE'], front: ['LIBRAIRIE', 'JOUETS & CO', 'ARCADE 225', 'GLACIER COCO'], style: 'marcory' },
}
/** The landing at Azito: the pinasse over to Île Boulay, its own scene while there. */
const BOULAY = 'yop-ile-boulay'
const HotelInside = lazy(() => import('../world3d/interior/HotelInside').then((m) => ({ default: m.HotelInside })))
const HotelStay = lazy(() => import('../world3d/interior/HotelFloors').then((m) => ({ default: m.HotelStay })))
const StreetMatch = lazy(() => import('../streetball/StreetMatch'))

type Toast = { id: number; title: string; text?: string; money: number; tone: 'random' | 'done' | 'error' | 'promo' | 'event'; kind?: string; icon?: string }

function useIsDesktop() {
  const q = '(min-width: 1024px)'
  const [match, setMatch] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return match
}

// In development, ?hour=22 shows the street at that hour (to check the night).
const HOUR_OVERRIDE = import.meta.env.DEV && new URLSearchParams(location.search).get('hour') ? Number(new URLSearchParams(location.search).get('hour')) : undefined
const MAP_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
/** The Golvo order on its way, kept on the device. */
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
  alloco: ["L'alloco de la tantie", 'banana'],
  porc: ['Le porc au four', 'drumstick'],
  cafe: ['Le café du pousse-pousse', 'coffee'],
  the: ['Le thé avec les gars', 'cup-soda'],
  garba: ['Le garba du garbadrome', 'fish'],
  brochette: ['Le pain brochette', 'sandwich'],
  loto: ['Un ticket de Loto Chance', 'ticket'],
  foot: ['Le foot du quartier', 'volleyball'],
  basket: ['Le basket du quartier', 'trophy'],
  grin: ['Le thé au grin', 'cup-soda'],
  causerie: ['La causerie du quartier', 'messages-square'],
  travail: ['Le travaillement', 'music'],
  dames: ['Les dames sous le lampadaire', 'grid-3x3'],
  preche: ['Le prêcheur de rue', 'book-open'],
  oranges: ['Les oranges de la marchande', 'citrus'],
  eau: ["L'eau glacée", 'droplet'],
  credit: ['Le crédit du vendeur', 'smartphone'],
  pain: ['Le pain chaud', 'croissant'],
}

export function Play() {
  const world = useWorld((s) => s.world)!
  const user = useSession((s) => s.user)
  const token = useSession((s) => s.token)
  const navigate = useNavigate()
  const desktop = useIsDesktop()

  const [base, setBase] = useState<{ sim: Sim; at: number } | null>(null)
  const [journal, setJournal] = useState<JournalEvent[]>([])
  const [seen, setSeen] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [placeId, setPlaceId] = useState<string | null>(null)
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
  const [pending, setPending] = useState<{ label: string; icon: string; kind: string } | null>(null)
  // The place whose door the Sim is standing at after walking with the pad.
  const [near, setNear] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [street, setStreet] = useState<HappeningNow | null>(null)
  const [flow, setFlow] = useState<FlowRequest | null>(null)
  // Looking at the street rather than inside the place the Sim is in.
  const [outside, setOutside] = useState(false)
  // The place an action was picked in: still on screen while it's asked for (no flash of the
  // street before the Sim is seen at it), and open again once it's done, for another thing there
  // (Sortir is what leaves).
  const [backTo, setBackTo] = useState<string | null>(null)
  // A Golvo order on its way, and the phone app to open.
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
    if (!want || !['gbairai', 'bet225', 'parisfoot', 'guide', 'flashe', 'boutique'].includes(want)) return
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
  // Three views of the street: close behind the perso (the default), over its
  // shoulder (third person), or from above. The choice is remembered.
  const [view, setView] = useState<'pres' | 'epaule' | 'haut'>(() => {
    try {
      const v = localStorage.getItem('babi.view')
      if (v === 'pres' || v === 'epaule' || v === 'haut') return v
      return localStorage.getItem('babi.closeView') === 'false' ? 'haut' : 'pres'
    } catch {
      return 'pres'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('babi.view', view)
    } catch {
      /* private window */
    }
  }, [view])
  const closeView = view !== 'haut'
  const NEXT_VIEW = { pres: 'epaule', epaule: 'haut', haut: 'pres' } as const
  const [whereTo, setWhereTo] = useState(false)
  const announced = useRef('')

  useEffect(() => {
    api.sims().then(async (sims) => {
      if (!sims.length) return navigate('/creer', { replace: true })
      const res = await api.sim(sims[0].id)
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
    return { ...base.sim, gameMinutes: base.sim.gameMinutes + mins, needs: predict(base.sim, mins) }
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
        toast({ tone: 'done', title: 'De retour en ligne', text: res.outcome.text, money: 0 })
      }),
    [],
  )
  // The network back: the Sim as the server has it (what was played offline sent first).
  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current && base) {
      const played = pendingOffline()
      void api.sim(base.sim.id).then(apply, () => undefined)
      if (!played) toast({ tone: 'done', title: 'De retour en ligne', text: 'Ton perso reprend sa vie.', money: 0 })
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
          setTimeout(() => toast({ tone: 'event', title: `Ça se passe ${aCommune(name)} !`, text: h.text, money: 0, icon: h.icon }), 300)
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [where, slot]) // eslint-disable-line react-hooks/exhaustive-deps
  // Arrived (or still walking) after it ended: say so instead of opening nothing.
  useEffect(() => {
    if (placeId === 'happening' && street && !street.happening) {
      setPlaceId(null)
      toast({ tone: 'error', title: "C'est fini !", text: 'Tu es arrivé·e trop tard, tout le monde est rentré.', money: 0 })
    }
  }, [placeId, street]) // eslint-disable-line react-hooks/exhaustive-deps
  const happening = useMemo(() => (street?.happening ? { id: street.happening.id, icon: street.happening.icon, label: street.happening.label } : null), [street])

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .news()
        .then(({ items }) => {
          const top = items[0]
          if (!top || sessionStorage.getItem('babi-flash') === top.id) return
          sessionStorage.setItem('babi-flash', top.id)
          toast({ tone: 'event', title: `Flash info · ${topicOf(top.topic).label}`, text: `${top.title} (${top.source})`, money: 0, icon: 'newspaper' })
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
        if (e.kind === 'robbed') toast({ tone: 'random', title: 'Les nouchis du couloir !', text: e.text, money: e.money })
        else if (e.kind === 'random') toast({ tone: 'random', title: 'Imprévu !', text: e.text, money: e.money })
        else if (e.kind === 'career') toast({ tone: 'promo', title: 'Promotion !', text: e.text.replace(/^Promotion ! /, ''), money: 0 })
        else if (e.kind === 'travel') toast({ tone: 'done', title: 'Bien arrivé·e !', text: e.text, money: e.money, icon: 'car-taxi-front', kind: 'transport' })
        // Life news (a birthday's pocket money, coming of age): its own toast, not the activity that just ended.
        else if (e.kind === 'life') toast({ tone: 'event', title: /anniversaire/i.test(e.text) ? 'Joyeux anniversaire !' : 'Dans ta vie', text: e.text, money: e.money, icon: 'cake' })
        else toast({ tone: 'done', title: 'Terminé', text: e.text, money: e.money })
      }, 300 + i * 700),
    )
    if (bills.length) setTimeout(() => toast({ tone: 'random', title: 'Samedi, jour du loyer', text: bills.map((b) => b.text).join(' '), money: bills.reduce((t, b) => t + b.money, 0) }), 300 + rest.length * 700)
  }

  // Talking to someone in the street (and who, while the chat lasts).
  const [chat, setChat] = useState<Npc | null>(null)
  const talkedTo = useRef<string | null>(null)
  // Anyone tapped anywhere (a maquis, a club, a hotel lobby: world3d/talk.ts) opens the same chat.
  useEffect(() => setTalkHandler((npc) => (setChat(npc), npcReact(npc.id, 'hello', 1.6))), [])
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
      if (money) toast({ tone: 'done', title: label, money, kind: 'social', icon: 'messages-square' })
      return { text, mood }
    } catch (e) {
      toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? 'Hors ligne' : 'Pas possible', text: errorText(e, 'Erreur'), money: 0 })
      return null
    }
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
      toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? 'Hors ligne' : 'Pas possible', text: errorText(e, 'Erreur'), money: 0 })
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
      toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? 'Hors ligne' : 'Pas possible', text: errorText(e, 'Erreur'), money: 0 })
      return false
    } finally {
      setPending(null)
    }
  }

  /** A game of dames: against a man of the grin (`with` 'npc', his name) or a friend, for the stake picked. */
  const startDames = async (ask: { with: string; name: string }, stake: number) => {
    setDamesAsk(null)
    const ok = await run('Une partie de dames', 'crown', 'social', () => api.damesStart(sim!.id, ask.with === 'npc' ? { with: 'npc', npc: ask.name, stake } : { with: ask.with, stake }))
    if (ok) setDamesOpen(true)
  }
  /** A game of 8 américain: at a table of the game's players (`with` 'npc', their names) or against a friend, for the stake picked. */
  const startHuit = async (ask: { with: string; npcs?: string[] }, stake: number) => {
    setHuitAsk(null)
    const ok = await run('Une partie de 8 américain', 'sparkles', 'social', () => api.huitStart(sim!.id, ask.with === 'npc' ? { with: 'npc', npcs: ask.npcs, stake } : { with: ask.with, stake }))
    if (ok) setHuitOpen(true)
  }
  const walkTo = (id: string) => {
    setOverlay(null)
    setGoTo({ placeId: id, nonce: Date.now() })
  }
  const interact = (it: Interaction, kind: string) => {
    const id = placeId!
    setPlaceId(null)
    setOutside(false)
    setBackTo(id)
    // Already doing something at the zoo (or the hotel's grounds): it gives way to the new thing.
    const there = sim!.activity?.kind === 'do' && sim!.activity.placeId === id && GROUNDS.has(id)
    // Without network the phone plays it: what it is at this place.
    const at = id === 'home' ? { kind: 'home', name: 'Chez toi' } : commune.places.find((p) => p.id === id)
    if (at) picking(id, it, { kind: at.kind, name: at.name })
    run(it.label, it.icon, kind, async () => {
      if (there) await api.stop(sim!.id)
      return api.interact(sim!.id, id, it.id)
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
      const was = driven
      const metres = was ? stopDrive() : 0
      if (parkedNow()?.v.id === ride.vehicle) setParked(null)
      return void run(label, 'car', 'transport', async () => {
        if (was && metres) await api.garageAct(sim!.id, 'drive', { vehicle: was.id, metres }).catch(() => undefined)
        return api.travel(sim!.id, cityId, communeId, ride)
      })
    }
    // A flight is booked at the airport (Flights): no driver to find, straight on board.
    if (ride?.app === 'avion') return void (setOverlay(null), run(label, 'plane', 'transport', () => api.travel(sim!.id, cityId, communeId, ride)))
    // The métro: down to the station, on the next train.
    if (ride?.app === 'metro') return void (setOverlay(null), run(label, 'train-front', 'transport', () => api.travel(sim!.id, cityId, communeId, ride)))
    // A moto-taxi: one stops right away, the Sim gets on behind.
    if (ride?.app === 'moto') return void (setOverlay(null), run(label, 'bike', 'transport', () => api.travel(sim!.id, cityId, communeId, { app: 'moto' })))
    // The woro-woro, the taxi compteur, the gbaka: waited for at the roadside, the one chosen.
    if (ride?.app?.startsWith('street') && to) return setFlow({ cityId, from, to, kind: 'street', want: (ride.app.split(':')[1] || undefined) as StreetRide | undefined, fare, party: ride.party ?? 1, money: sim!.money, off: fareOff(world, sim!) })
    if (ride?.app && to) return setFlow({ cityId, from, to, kind: ride.app, offer: ride.offer, fare, party: ride.party ?? 1, money: sim!.money })
    run(label, 'bus', 'transport', () => api.travel(sim!.id, cityId, communeId, ride))
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
  // Started with the tuto: the two old first tips (FirstSteps) aren't needed after it.
  const [firstTime] = useState(beginner)
  const tutoAsked = useTutorialAsked()
  // A défi taken on during the activity (components/Defi.tsx): the one going on.
  const [defi, setDefi] = useState<DefiKind | null>(null)
  // One of the phone's « Jeux », played for practice.
  const [practice, setPractice] = useState<DefiKind | null>(null)
  // At the wheel of one's own vehicle (world3d/drive.ts): parked, the petrol paid on the distance.
  const driven = useDriving()
  const park = () => {
    const v = driven
    if (!v) return
    // It stays where it's left, against the kerb (the Walker sets it there), until the Sim gets back in.
    parkIn.commune = commune.id
    const metres = stopDrive()
    void run(`${v.name} garé`, 'car', 'transport', () => api.garageAct(sim!.id, 'drive', { vehicle: v.id, metres }))
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
  useEffect(() => {
    const t = sim?.activity?.kind === 'travel' ? sim.activity.trip : undefined
    if (t?.mode === 'perso' && t.vehicle) return void (ownTrip.current = { id: t.vehicle.id, kind: t.vehicle.kind, body: t.vehicle.body, color: t.vehicle.color, name: t.vehicle.name, top: topSpeed(t.vehicle.top) })
    const v = ownTrip.current
    if (!v || sim?.activity) return
    ownTrip.current = null
    setPlaceId(null)
    setOutside(true)
    startDrive(v)
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
  // The soirées thrown by players here (backend sims/party.go): picking a theme for one's own.
  const [soireeAsk, setSoireeAsk] = useState(false)
  const soirees = around.parties ?? []
  const soireeOf = (id: string | null | undefined) => (id ? soirees.find((p) => `soiree:${p.id}` === id) : undefined)
  const mySoiree = soirees.find((p) => p.host === sim?.id)
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
  const ballSport = !ballAct ? null : ballAct.interaction.id === 'play-basket' || ballAct.interaction.id === 'street-basket' || (ballAct.placeId === 'happening' && ballAct.interaction.id === 'join' && street?.happening?.id === 'basket') ? 'basket' : ballAct.interaction.id === 'play-football' || ballAct.interaction.id === 'play-foot11' || ballAct.interaction.id === 'street-foot' || (ballAct.placeId === 'happening' && ballAct.interaction.id === 'join' && street?.happening?.id === 'foot') ? 'foot' : null
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

  if (!sim) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-night)] text-white">
        <div className="flex flex-col items-center gap-3">
          <MoodPin size={22} />
          <span className="font-display text-xl font-bold">Chargement de Babi…</span>
        </div>
      </div>
    )
  }

  const c = clock(sim.gameMinutes)
  const moodHex = needColor(mood(sim.needs))
  // The activity the Sim is acting out here, if any (a trip happens on the road).
  const doing = sim.activity?.kind === 'do' ? sim.activity : null
  // The défi this activity can be taken on as, not yet played (the ski off the island only, seen there).
  const defiNow = doing && !doing.defi ? defiOf(doing.interaction.id) : null
  const stop = () => run('Arrêter', 'x', '', () => api.stop(sim.id))
  // The pad shows in the shoulder view (and the classic street); the buttons over the street sit beside it, or in the middle.
  // (At the wheel, the pedals and the wheel take its place.)
  const padShown = (classic || view === 'epaule') && !driven
  const padBeside = padShown ? 'left-[132px] max-w-[calc(100vw-144px)] sm:left-[152px] sm:max-w-[calc(100vw-164px)]' : 'left-1/2 max-w-[calc(100vw-24px)] -translate-x-1/2'
  const city = world.cities.find((x) => x.id === sim.city)!
  const commune = withMapPlaces(city.communes.find((x) => x.id === sim.commune)!, classic ? [] : mapPlaces)
  const unseen = journal.filter((e) => e.id > seen).length
  const placeName = (id: string) => (id === 'home' ? 'Chez toi' : id === 'happening' ? (street?.happening?.label ?? 'En ce moment') : id.startsWith('soiree:') ? (soireeOf(id) ? `${soireeOf(id)!.title} chez ${soireeOf(id)!.hostName}` : 'La soirée') : (commune.places.find((p) => p.id === id)?.name ?? ''))
  // Inside a place: while doing something there, or looking at what it offers.
  const inside = (() => {
    if (doing) {
      // A Golvo meal eaten where the Sim is: in the street (eaten at home, its place is « home »).
      if (doing.placeId === 'golvo') return null
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
    // (An action just picked, or just done: still in the place it was picked in.)
    const at = placeId ?? backTo
    if (at && at !== 'happening' && !OPEN_AIR.has(at)) {
      // A covered hall (the Palais des Sports) has its own inside.
      const kind = at === 'home' ? 'home' : ARENAS.has(at) ? 'arena' : commune.places.find((p) => p.id === at)?.kind
      return kind && (INDOOR.has(kind) || SCENES.has(kind) || kind === 'arena') ? { id: at, kind, it: undefined } : null
    }
    return null
  })()
  const showInside = !!inside && !outside
  // Doing something at the zoo or round the hotel's grounds: the Sim walks about them freely meanwhile.
  const onGrounds = !!doing?.placeId && GROUNDS.has(doing.placeId) && sim.city === city.id && sim.commune === commune.id && !classic
  // Just come in (nothing being done yet): the Sim can walk about the room.
  const visiting = !!placeId && placeId !== 'happening' && showInside && !doing && sim.city === city.id && sim.commune === commune.id
  // Come to the zoo, the hotel's grounds, a known street: the Sim walks round it in the street view.
  const strolling = !!placeId && GROUNDS.has(placeId) && !inside && !doing && sim.city === city.id && sim.commune === commune.id && !classic
  const roaming = visiting || strolling
  // A long way ahead, a moto-taxi offered: its card takes the place of « En ce moment » (they sat on each other).
  const motoAsking = !!moto.offer && !moto.paid
  // The music of where the Sim is: the club and the maquis inside, a show on
  // its stage (the drums, the singers, the audience), the hush of a museum; at
  // the stadium, the crowd of the match or the concert; and in the street, the
  // fanfare of a wedding cortège, a concert, the masks.
  const happeningId = street?.happening?.id
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
  const trackSeed = partyHeard ? `party${party.id}` : showInside ? inside!.id : `${commune.id}${happeningId ?? ''}`

  return (
    <div className="relative h-full overflow-hidden bg-[var(--color-night)] select-none">
      {/* An update the team just opened (the admin's « Mises à jour »), once. */}
      <FeatureNews />
      {racing && (
        <Suspense fallback={<div className="fixed inset-0 z-50"><Splash label="Babi Karting…" /></div>}>
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
      {ballKey && ballKey !== played && !racing && (!courtKey || court?.key === courtKey) && (
        <Suspense fallback={<div className="fixed inset-0 z-50"><Splash label={ballSport === 'basket' ? 'Sur le terrain…' : eleven ? 'Au stade…' : 'Au maracana…'} /></div>}>
          <StreetMatch key={ballKey} sport={ballSport!} name={sim.firstName} look={sim.look} gender={sim.gender} online={courtKey ? (court?.online ?? undefined) : undefined} rules={elevenRules} onExit={() => setPlayed(ballKey)} />
        </Suspense>
      )}
      {showInside && (
        <div className="absolute inset-0 z-[1]">
          {inside!.id === 'logement' && dodoPlot ? (
            // A home booked on Dodo: its own house, walked in like one's own.
            <HomeInside sim={sim} world={world} plot={dodoPlot} interactionId={inside!.it} roam={false} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
          ) : inside!.kind === 'home' && inside!.id !== 'logement' && homePlot && !classic ? (
            <HomeInside partner={sim.friends?.find((f) => f.partner && f.home)} sim={sim} world={world} plot={homePlot} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} onBuild={() => setBuilding(0)} />
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
              <AirportInside sim={sim} name={placeName(inside!.id)} flights={(world.flights ?? []).filter((f) => f.place === inside!.id)} interactionId={inside!.it} roam={visiting && !menuOpen} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} />
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
            <Interior faith={commune.places.find((p) => p.id === inside!.id)?.faith} party={inside!.id.startsWith('soiree:') ? (soireeOf(inside!.id)?.hostName ?? doing?.placeName?.split(' chez ').pop()) : undefined} open={inside!.kind === 'home' || inside!.id.startsWith('soiree:') || (world.kinds[inside!.kind]?.interactions.some((it) => openAt(it, sim.gameMinutes)) ?? true)} sim={sim} kind={inside!.kind} placeId={inside!.id} interactionId={inside!.it} roam={visiting && !menuOpen} housing={inside!.id === 'logement' ? 'appart' : sim.housing} night={c.isNight} stage={lifeOf(world, sim).stage?.id ?? 'adulte'} others={around.players.filter((p) => p.activity?.placeId === inside!.id && inside!.id !== 'home')} />
          )}
        </div>
      )}
      <div className={`absolute inset-0 ${showInside ? 'invisible' : ''}`}>
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
            stationAt: doing?.placeId ?? null,
            // Busy inside (the street seen through « Voir la rue »): the Sim is in there, not at the door.
            indoors: !!inside && !!doing,
            // In the air (FlightView over the street), no name floating over the clouds.
            nameTag: sim.activity?.trip?.mode === 'avion' || sim.activity?.trip?.mode === 'metro' ? undefined : `${mine.crew ? `[${mine.crew}] ` : ''}${user?.username ? `@${user.username}` : sim.firstName}${passOn(sim) ? ' ★' : ''}${mine.title ? ` · ${mine.title}` : ''}`,
            happening,
            onNear: setNear,
            // Busy, the Sim isn't frozen: it does what it does where it stands, and walking far
            // from the place stops it (onLeave). Only on a trip, in a match, or while a request is out.
            frozen: !!pending || sim.activity?.kind === 'travel' || /^play-/.test(doing?.interaction.id ?? ''),
            onLeave: () => void run('Activité arrêtée', 'x', '', () => api.stop(sim.id)),
            delivery,
            onCollect: () => delivery && deliveryState(delivery, Date.now()).stage === 'here' && collect(),
            players: around.players,
            parties: soirees,
            onPickPlayer: (id: string) => setPlayers({ focus: id }),
            recenter,
            onFreeCamera: setFreeCam,
            closeView,
            shoulderView: view === 'epaule',
            onTalk: (npc: Npc) => (setChat(npc), npcReact(npc.id, 'hello', 1.6)),
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
            onRobbed: async (spot: string) => {
              try {
                const res = await api.robbed(sim.id, spot)
                apply(res)
                // Taken: the journal's event says it (announce); nothing taken: say why here.
                if (!res.outcome.money) toast({ tone: 'random', title: 'Les nouchis du couloir', text: res.outcome.text, money: 0 })
                return res.outcome.text
              } catch {
                return null
              }
            },
          }
          return classic ? <Neighbourhood key={commune.id} {...street} /> : <OpenWorld key={commune.id} {...street} commune={ownPlaces(commune)} token={MAP_TOKEN ?? ''} onFail={() => setMapSlow(true)} onLoaded={() => setMapSlow(false)} onMapPlaces={setMapPlaces} onHomeSpots={setHomeSpots} onHomePlot={setHomePlot} />
        })()}
      </div>
      {/* At the club, open, from 18: « Lancer des billets » on the dancers, a tap at a time */}
      {showInside && inside!.kind === 'club' && !lifeOf(world, sim).minor && clubOpenAt(sim.gameMinutes) && sim.city === city.id && sim.commune === commune.id && !overlay && (
        <Billets money={sim.money} onThrow={(amount) => api.billets(sim.id, inside!.id, amount).then((res) => (apply(res), throwBillets(amount), res.outcome.text))} />
      )}
      {/* At mass, the culte or the Friday prayer: the quête, the offrande, the aumône, a tap at a time (backend sims/offrande.go) */}
      {sim.activity?.kind === 'do' && SERVICES.has(sim.activity.interaction?.id ?? '') && !overlay && (() => {
        const faith = commune.places.find((p) => p.id === sim.activity!.placeId)?.faith
        const label = faith === 'catholique' ? 'Donner à la quête' : faith === 'musulman' ? 'Donner l’aumône' : 'Donner à l’offrande'
        return <Billets money={sim.money} amounts={[100, 500, 1000, 5000]} label={label} color="#c9a14a" onThrow={(amount) => api.offrande(sim.id, amount).then((res) => (apply(res), res.outcome.text))} />
      })()}
      {/* Never over a match or a race: it waits till the street */}
      {!showInside && !overlay && building === false && !(ballKey && ballKey !== played) && !racing && <NotifyPrompt />}
      {mapSlow && (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] z-10 flex justify-center px-6">
          <p className="hud rounded-2xl px-4 py-2.5 text-center text-sm font-extrabold">La carte de Babi charge… Le réseau est lent : on réessaie tout seul.</p>
        </div>
      )}

      {/* ---------- Top HUD ---------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
        <Link to="/profil" viewTransition className="hud pointer-events-auto flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 transition active:scale-95 max-sm:max-w-[52vw] short:max-w-[36vw] sm:gap-2.5 sm:pr-4">
          <span className="block shrink-0 rounded-full p-[3px]" style={{ background: `conic-gradient(${moodHex} ${mood(sim.needs) * 3.6}deg, #e7e9f2 0)` }}>
            <span className="block h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-gradient-to-b sm:h-11 sm:w-11 from-[#ffe7c7] to-[#ffb27a]">
              <Portrait look={sim.look} gender={sim.gender} framing="head" />
            </span>
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[15px] font-extrabold sm:text-[17px]">
              {mine.crew ? `[${mine.crew}] ` : ''}
              {user?.username ? `@${user.username}` : sim.firstName}
              {passOn(sim) && <span className="ml-1 text-[#e6b422]" title="Babi Pass">★</span>}
              {mine.title && <span className="ml-1 text-[#3d4fd6]">· {mine.title}</span>}
            </span>
            <span className="flex min-w-0 items-center gap-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
              <MapPin size={11} strokeWidth={3} className="shrink-0" />
              <span className="truncate">
                {commune.name} · <span className="max-sm:hidden">{lifeOf(world, sim).stage?.label ?? ''}, </span>
                {lifeOf(world, sim).age < 1 ? "moins d'un an" : `${lifeOf(world, sim).age} an${lifeOf(world, sim).age > 1 ? 's' : ''}`}
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
              <TesterTools sim={sim} act={run} />
              <PlayersChip count={around.players.length} online={around.online} invites={around.invites.length} onOpen={() => setPlayers({ focus: null })} />
            </div>
          </div>
          {inside && (
            <button className="hud pointer-events-auto rounded-full px-4 py-2 text-sm font-extrabold" onClick={() => setOutside((o) => !o)}>
              {outside ? `Entrer · ${placeName(inside.id) || 'Chez toi'}` : 'Voir la rue'}
            </button>
          )}
          {!showInside && !placeId && !overlay && (
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {!classic && (
                <button className="hud flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setView((v) => NEXT_VIEW[v])} title="Changer de vue" data-tour="vue">
                  {/* What the next tap gives */}
                  {view === 'epaule' ? <Mountain size={17} strokeWidth={2.6} className="text-[var(--color-emerald)]" /> : <Eye size={17} strokeWidth={2.6} className="text-[var(--color-emerald)]" />}
                  <span className="max-sm:hidden short:hidden">{{ pres: 'Vue épaule', epaule: 'Vue de haut', haut: 'Vue de près' }[view]}</span>
                </button>
              )}
              {!sim.activity && (
                <button className="hud flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setEmotesOpen(true)} title="Émotes">
                  <Smile size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" />
                  <span className="max-sm:hidden short:hidden">Émotes</span>
                </button>
              )}
              {/* On a phone, a finger drag on the street turns the view: no compass to crowd the screen */}
              <div className="max-sm:hidden short:hidden">
              <OrbitGizmo
                read={streetPose}
                onYaw={(d) => (cameraTurn.yaw += d)}
                onPitch={(d) => (cameraTurn.pitch += d)}
                onNorth={() => (cameraTurn.snap = true)}
              />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ---------- Bottom HUD: needs, map, phone ---------- */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-5">
        <button data-tour="carte" className="hud pointer-events-auto flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-extrabold transition active:scale-95" onClick={() => setOverlay('map')}>
          <MapIcon size={24} strokeWidth={2.4} className="text-[var(--color-emerald)]" />
          Carte
        </button>
        <div data-tour="besoins" className="hud pointer-events-auto flex flex-1 justify-around gap-1 rounded-[26px] px-2 py-2 sm:max-w-md sm:flex-none sm:gap-3 sm:px-4">
          {NEEDS.map((n) => (
            <MotiveRing key={n.key} value={sim.needs[n.key]} icon={n.icon} label={desktop ? n.label : undefined} size={desktop ? 52 : 44} />
          ))}
        </div>
        <button
          data-tour="phone"
          className="pointer-events-auto relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[22px] bg-[var(--color-orange)] text-[11px] font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(224,90,0,0.8)] transition hover:bg-[#f26f00] active:scale-95"
          onClick={() => (setOverlay('phone'), setSeen(journal[0]?.id ?? 0))}
        >
          <Smartphone size={24} strokeWidth={2.4} />
          Phone
          {unseen > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[var(--color-rose)] px-1 text-xs text-white ring-2 ring-white">{unseen}</span>}
        </button>
      </footer>

      <Soundtrack track={partyHeard ? 'club' : track} seed={trackSeed} level={partyHeard ? party.level : 1} />
      {/* Finding the way: the mini-map, and every place of the quarter (at the wheel, the GPS does it) */}
      {!showInside && !placeId && !overlay && !players && !driven && (
        <div className="pointer-events-none absolute top-[4.5rem] left-3 z-20 flex flex-col items-start gap-2 sm:top-[5.5rem] lg:left-5">
          {/* A smaller map on a phone (scaled: the canvas keeps its sharpness) */}
          <div className="origin-top-left max-sm:-mr-[33px] max-sm:-mb-[33px] max-sm:scale-75 short:-mr-[53px] short:-mb-[53px] short:scale-[0.6]">
            <MiniMap onWalk={walkTo} />
          </div>
          <button data-tour="ou-aller" className="hud pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold" onClick={() => setWhereTo(true)}>
            <Navigation size={17} strokeWidth={2.6} className="text-[var(--color-orange)]" /> Où aller ?
          </button>
          {/* On the way somewhere: how far, how long */}
          <WayLeft />
          {/* The power cut where the Sim stands */}
          <PowerCutBadge commune={commune.id} />
        </div>
      )}
      {whereTo && (
        <WhereTo
          world={world}
          commune={commune.id}
          total={ownPlaces(commune).places.length + (commune.mapCount ?? 0)}
          // At the wheel: the GPS takes the car there (arrows on the road); on foot, the Sim walks.
          onWalk={(id, spot) => (setWhereTo(false), driven ? void (gps.to = { id, name: spot.name, door: spot.door }, gps.way = null) : walkTo(id))}
          onClose={() => setWhereTo(false)}
        />
      )}
      {freeCam && !placeId && !overlay && (
        <button className="hud motion-pop absolute right-3 bottom-[6.25rem] z-20 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold lg:right-5 lg:bottom-[7.5rem]" onClick={() => setRecenter((n) => n + 1)}>
          <LocateFixed size={18} strokeWidth={2.6} className="text-[var(--color-orange)]" /> Revenir à moi
        </button>
      )}

      {!classic && <FirstSteps pad={padShown} hidden={showInside || !!placeId || !!overlay || !!players || whereTo || !!sim.activity || !!pending || tuto || tutoAsked || firstTime} />}
      {/* The first time (or asked for again from the Encyclo): Koffi shows the beginner round */}
      {(tuto || tutoAsked) && !classic && <Tutorial state={{ whereTo, placeId, overlay }} onEnd={() => setTuto(false)} />}
      {/* Walking: the keys always (arrows / WASD); the pad on screen only in the shoulder view (the third-person
          view, chosen with the view button), so the other views stay clear. There, one walks with « Où aller ? »,
          the mini-map and the places' signs. The classic street has no views: the pad stays. */}
      {(!placeId || (strolling && !menuOpen)) && !overlay && !sim.activity && <WalkKeys />}
      {(!placeId ? padShown : roaming && !menuOpen && (strolling || !desktop)) && !overlay && !sim.activity && (
        <div className={`pointer-events-none absolute left-3 z-20 lg:left-5 ${placeId ? 'bottom-[11rem] lg:bottom-[12rem]' : 'bottom-[6.25rem] lg:bottom-[7.5rem]'}`}>
          <RunButton />
          <Joystick disabled={!!sim.activity || !!pending} className="pointer-events-auto" />
        </div>
      )}
      {near && !placeId && !pending && !sim.activity && (
        <button
          className={`motion-pop absolute bottom-[6.5rem] ${padBeside} z-30 flex items-center lg:left-1/2 lg:max-w-sm lg:-translate-x-1/2 gap-2 rounded-2xl bg-[var(--color-ink)] py-2 pr-4 pl-2 text-left text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] lg:bottom-[7.5rem]`}
          onClick={() => setPlaceId(near)}
        >
          <IconTile icon={DoorOpen} colors={['#ffa040', '#ff6a00']} size={32} radius={10} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-70">Entrer</span>
            <span className="block truncate text-sm font-extrabold">{placeName(near)}</span>
          </span>
        </button>
      )}

      {street?.happening && !near && !placeId && !pending && !sim.activity && !motoAsking && (
        <button
          className={`animate-pop absolute bottom-[6.5rem] ${padBeside} z-20 flex items-center lg:left-1/2 lg:max-w-md lg:-translate-x-1/2 gap-2 rounded-full bg-[var(--color-gold)] py-1.5 pr-4 pl-1.5 text-left text-[#5a3a00] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] lg:bottom-[7.5rem]`}
          onClick={() => walkTo('happening')}
        >
          <IconTile icon={iconFor(street.happening.icon)} colors={['#ffd54f', '#ffa000']} size={36} radius={18} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-80">En ce moment</span>
            <span className="block truncate font-display text-[15px] font-extrabold">{street.happening.label}</span>
          </span>
          <ChevronRight size={18} strokeWidth={3} className="shrink-0" />
        </button>
      )}

      {soirees.length > 0 && !placeId && !pending && !sim.activity && !motoAsking && (() => {
        // The soirée here (one's own first): walked to; one's own is at home, opened at once.
        const p = mySoiree ?? soirees[0]
        return (
          <button
            className={`animate-pop absolute ${near || street?.happening ? 'bottom-[10.75rem] lg:bottom-[12rem]' : 'bottom-[6.5rem] lg:bottom-[7.5rem]'} ${padBeside} z-20 flex items-center lg:left-1/2 lg:max-w-md lg:-translate-x-1/2 gap-2 rounded-full bg-[#2b1240] py-1.5 pr-4 pl-1.5 text-left text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)]`}
            onClick={() => (p.host === sim.id ? setPlaceId(`soiree:${p.id}`) : walkTo(`soiree:${p.id}`))}
          >
            <IconTile icon={PartyPopper} colors={['#ff5cc8', '#7a2bd6']} size={36} radius={18} />
            <span className="min-w-0 leading-tight">
              <span className="block text-[10px] font-extrabold tracking-wider uppercase opacity-80">{p.host === sim.id ? 'Ta soirée' : `Soirée chez ${p.hostName}`}{p.guests ? ` · ${p.guests} invité${p.guests > 1 ? 's' : ''}` : ''}</span>
              <span className="block truncate font-display text-[15px] font-extrabold">{p.title}</span>
            </span>
            <ChevronRight size={18} strokeWidth={3} className="shrink-0" />
          </button>
        )
      })()}

      {placeId === 'happening' && street?.happening && (
        <HappeningSheet now={street} sim={sim} commune={commune} onClose={() => setPlaceId(null)} onJoin={(it) => (setPlaceId(null), run(it.label, it.icon, 'happening', () => api.interact(sim.id, 'happening', it.id)))} />
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
        />
      )}
      {soireeAsk && (
        <ThrowSoireeSheet
          sim={sim}
          onClose={() => setSoireeAsk(false)}
          onThrow={(theme) => {
            setSoireeAsk(false)
            setPlaceId(null)
            run('Ta soirée', 'party-popper', 'soiree', () => api.throwParty(sim.id, theme)).then((ok) => ok && refreshPlayers())
          }}
        />
      )}
      {placeId && placeId !== 'happening' && !placeId.startsWith('soiree:') && (!roaming || menuOpen) && (
        <InteractionMenu world={world} sim={sim} city={city} commune={commune} placeId={placeId} desktop={desktop} onClose={() => (roaming ? setMenuOpen(false) : setPlaceId(null))} onPick={interact} onTravel={travel} onStop={stop} onBuild={() => (setPlaceId(null), setBuilding(0))} soiree={mySoiree} onSoiree={() => (mySoiree ? setPlaceId(`soiree:${mySoiree.id}`) : (setMenuOpen(false), setSoireeAsk(true)))} />
      )}
      {visiting && !menuOpen && <SpotSheet />}
      {visiting && !menuOpen && placeId && (
        <SceneActionsFeed world={world} sim={sim} city={city} commune={commune} placeId={placeId} onPick={(it, kind, why) => (why ? toast({ tone: 'error', title: it.label, text: why, money: 0 }) : interact(it, kind))} />
      )}
      {roaming && !menuOpen && (
        // Walking about inside (or round the grounds): the place's name, what to do here, the way out.
        // Above the needs, the map and the phone, which stay in reach (it used to cover them on a phone).
        <div className="pointer-events-none absolute inset-x-0 bottom-[6.5rem] z-20 flex justify-center px-3 lg:bottom-[7.5rem]">
          <div className="hud pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-[26px] p-2">
            <button className="btn btn-soft !px-3 !py-2.5 !text-sm" onClick={() => setPlaceId(null)}>
              {/* (At a hotel, the way out of the whole hotel: out of one's room is « Sortir de la chambre », up there.) */}
              <LogOut size={18} /> {placeId && commune.places.find((p) => p.id === placeId)?.kind === 'hotel' ? 'Quitter l’hôtel' : 'Sortir'}
            </button>
            <div className="min-w-0 flex-1 px-1 text-center leading-tight">
              <div className="truncate font-display text-[15px] font-extrabold">{placeName(placeId!)}</div>
              <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{strolling ? (desktop ? 'Flèches ou WASD pour visiter' : 'Le joystick pour visiter') : desktop ? 'Marche, clique une icône pour agir' : 'Marche, touche une icône pour agir'}</div>
            </div>
            <button className="btn !px-3 !py-2.5 !text-sm" onClick={() => setMenuOpen(true)}>
              <Sparkles size={18} /> Que faire ?
            </button>
          </div>
        </div>
      )}
      {building !== false && (
        <Suspense fallback={null}>
          <BuildMode world={world} sim={sim} lot={building || 0} onResult={apply} onClose={() => (setBuilding(false), setPlotsVersion((v) => v + 1))} />
        </Suspense>
      )}

      {players && <PlayersSheet sim={sim} around={around} communeName={commune.name} focus={players.focus} act={run} onClose={() => setPlayers(null)} />}

      {/* (Its time up, the bar goes at once: the server is settling it, nothing left to follow.) */}
      {sim.activity && !ended && !placeId && !defi && <ActivityBar world={world} onTask={sim.activity.kind === 'do' && sim.activity.career && sim.activity.career === sim.career ? (t) => api.jobTask(sim.id, t.id).then((res) => (apply(res), gesture(t.pose as Pose), res.outcome)) : undefined} onDefi={defiNow ? () => (defiNow === 'ski' && setOutside(false), setDefi(defiNow)) : undefined} onRejoin={ballKey && played === ballKey ? { sport: ballSport!, go: rejoin } : undefined} sim={sim} onStop={stop} stopping={!!pending} onRoute={() => setOverlay('map')} onMore={onGrounds ? () => (setPlaceId(doing!.placeId!), setMenuOpen(true)) : undefined} onFilm={() => setWatching(true)} onMachine={doing && isSlots(doing.interaction.id) ? () => setMachineOpen(true) : undefined} onShop={doing && SHOP_OF[doing.interaction.id] ? () => setShopOpen(true) : undefined} />}
      {/* The ciné-club's film, watched for real (screens/FilmPlayer.tsx). */}
      {watching && doing?.seance?.video && doing.seance.at !== undefined && <FilmPlayer video={doing.seance.video} at={doing.seance.at} title={doing.seance.title ?? doing.interaction.label} credit={doing.seance.credit} file={doing.seance.file} onClose={() => setWatching(false)} />}

      {/* The invitation and the toasts in one column under the top bar: they stack, never on top of each other */}
      <div className="pointer-events-none absolute top-[5.5rem] left-1/2 z-40 flex w-[min(400px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2 lg:top-24">
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
        {!players && !placeId && !overlay && (() => {
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
          onClose={() => (setOverlay(null), setPhoneApp(null))}
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
        />
      )}
      {/* At the wheel: the pedals, the wheel, the speed, and to park */}
      {placingLot && <LotPlaceHud />}
      {driven && <DriveHud driven={driven} onPark={park} onWhere={() => setWhereTo(true)} onParkAt={(id) => (park(), walkTo(id))} />}
      {/* Its vehicle parked near: get back in */}
      {!driven && !showInside && !placeId && !overlay && !sim.activity && <GetIn simId={sim.id} commune={commune.id} />}
      {emotesOpen && <EmoteSheet world={world} sim={sim} onClose={() => setEmotesOpen(false)} onResult={apply} />}
      {damesAsk && <DamesStake against={damesAsk.name} max={damesAsk.max} money={sim.money} onClose={() => setDamesAsk(null)} onPick={(stake) => void startDames(damesAsk, stake)} />}
      {huitAsk && <HuitStake against={huitAsk.name} max={huitAsk.max} money={sim.money} onClose={() => setHuitAsk(null)} onPick={(stake) => void startHuit(huitAsk, stake)} />}
      {huitOpen && (
        <HuitSheet
          simId={sim.id}
          onClose={() => (setHuitOpen(false), refreshPlayers())}
          onAgain={(npcs, stake) => (setHuitOpen(false), void startHuit({ with: 'npc', npcs }, stake))}
          onMoney={() => void api.sim(sim.id).then(apply, () => undefined)}
        />
      )}
      {damesOpen && (
        <DamesSheet
          simId={sim.id}
          onClose={() => (setDamesOpen(false), refreshPlayers())}
          onAgain={(npc) => (setDamesOpen(false), setDamesAsk({ with: 'npc', name: npc, max: 2000 }))}
          onMoney={() => void api.sim(sim.id).then(apply, () => undefined)}
        />
      )}
      {overlay === 'flashe' && <FlasheApp world={world} sim={sim} street={!showInside} act={run} onClose={() => setOverlay(null)} />}
      {overlay === 'camera' && <CameraView sim={sim} street={!showInside} onClose={() => setOverlay(null)} onGallery={() => (setPhoneApp('galerie'), setOverlay('phone'))} />}
      {overlay === 'map' && <WorldMap world={world} sim={sim} night={c.isNight} desktop={desktop} onClose={() => setOverlay(null)} onTravel={travel} onWalk={(id) => (setOverlay(null), walkTo(id))} />}
      {delivery && overlay !== 'phone' && <DeliveryPill delivery={delivery} now={now} onOpen={() => (setPhoneApp('golvo'), setOverlay('phone'))} />}
      {defi && sim.activity && (
        <DefiSheet
          kind={defi}
          simId={sim.id}
          big={sim.activity.interaction.id === 'supermarche'}
          interactionId={sim.activity.interaction.id}
          me={sim}
          send={async (score) => {
            try {
              const res = await api.defi(sim.id, defi, score)
              apply(res)
              return res
            } catch (e) {
              toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? 'Hors ligne' : 'Pas possible', text: errorText(e, 'Erreur'), money: 0 })
              return null
            }
          }}
          onResult={apply}
          onClose={() => setDefi(null)}
        />
      )}
      {practice && !defi && <DefiSheet kind={practice} simId={sim.id} me={sim} practice onResult={apply} onClose={() => setPractice(null)} />}
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
              toast({ tone: 'error', title: e instanceof ApiError && e.status === 0 ? 'Hors ligne' : 'Pas possible', text: errorText(e, 'Erreur'), money: 0 })
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
      {!overlay && (dropAsk ? <DropRouteAsk from={dropAsk.from} moto={dropAsk.moto} /> : <MotoOffer world={world} sim={sim} commune={commune} act={run} />)}
      {/* On a flight: the plane over the clouds (the map is a tap away) */}
      {!overlay && sim.activity?.kind === 'travel' && sim.activity.trip?.mode === 'avion' && <FlightView sim={sim} night={c.isNight} onMap={() => setOverlay('map')} />}
      {!overlay && sim.activity?.kind === 'travel' && sim.activity.trip?.mode === 'metro' && <MetroView world={world} sim={sim} night={c.isNight} onMap={() => setOverlay('map')} />}
      {chat && (
        <ChatSheet
          npc={chat}
          simGender={sim.gender}
          onSay={say}
          onType={keyOpen(features, 'chat-libre') ? sayFree : undefined}
          onClose={() => setChat(null)}
          onDames={/^(grin:|dames-)/.test(chat.id) && lifeOf(world, sim).stage?.id !== 'enfant' ? () => (setChat(null), setDamesAsk({ with: 'npc', name: chat.name, max: 2000 })) : undefined}
          onBye={() => {
            // « Au revoir » is the end: the chat stops there, nothing more is said or done.
            const a = sim.activity
            if (a?.kind === 'do' && a.placeKind === 'chat' && a.placeName === chat.name) void api.stop(sim.id).then(apply, () => undefined)
            npcReact(chat.id, 'bye', 2.5)
            setChat(null)
          }}
          languages={sim.languages ?? []}
          onLanguages={async (langs) => {
            const r = await api.setLanguages(sim.id, langs).catch(() => null)
            if (r) setBase((b) => (b ? { ...b, sim: { ...b.sim, languages: r.languages } } : b))
          }}
          gameMinutes={sim.gameMinutes}
          friend={sim.friends?.find((f) => f.id === `p-${chat.id}`)}
          taken={sim.friends?.find((f) => f.partner && f.id !== `p-${chat.id}`)?.name}
          grownUp={!lifeOf(world, sim).minor}
          adultAccount={!!user?.adult}
          onConfirmAdult={async () => {
            const u = await api.confirmAdult()
            if (token) useSession.getState().signIn(token, u)
          }}
        />
      )}
      {flow && <RideFlow world={world} req={flow} gameMinutes={sim.gameMinutes} onBoard={board} onClose={() => setFlow(null)} />}
    </div>
  )
}

/* ---------- The in-game phone ---------- */

type PhoneAppId = 'here' | 'jobs' | 'home' | 'messages' | 'news' | 'store' | 'waye' | 'golvo' | 'friends' | 'gbairai' | 'tikitoko' | 'babigram' | 'bet225' | 'parisfoot' | 'bingo' | 'casino' | 'galerie' | 'guide' | 'dodo' | 'kineo' | 'dames' | 'huit' | 'awale' | 'ludo' | 'gode' | 'bolide' | 'jeux' | 'boutique' | 'idees' | 'politique'
type PhoneProps = {
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

function Phone({ world, sim, commune, at, onAutoWork, journal, time, act, startApp, achat, onResult, onConfirmAdult, delivery, onDelivery, onCollect, onClose, onMap, onCamera, onFlashe, onPractice, street, onWalk, onBuild, onDames, onDamesOnline, onDamesResume, onHuitTable, onHuitFriend, onHuitResume, onDrive }: PhoneProps) {
  const [app, setApp] = useState<PhoneAppId | null>(startApp)
  // A photo of the gallery on its way to Tikitoko.
  const [tikiPhoto, setTikiPhoto] = useState<{ id: number; src: string } | undefined>()
  // A photo of the gallery on its way to Babigram.
  const [gramPhoto, setGramPhoto] = useState<{ id: number; src: string } | undefined>()
  // A player friend to send money to, picked in Amis.
  const [wayeTo, setWayeTo] = useState<string | undefined>()
  const navigate = useNavigate()
  // On a computer, Échap goes back: out of the app, then the phone away.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (app) setApp(null)
      else onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [app, onClose])
  const home = sim.homeCity === sim.city && sim.homeCommune === commune.id
  const places = [...(home ? [{ id: 'home', name: 'Chez toi', kind: 'home' }] : []), ...commune.places]
  const city = world.cities.find((c) => c.id === sim.city)!

  const life = lifeOf(world, sim)
  // A phone of one's own comes at 12; work and rent at 18.
  const ownPhone = !life.minor || life.age >= 12
  // (An app an update hasn't opened yet doesn't show, even installed: lib/features.ts.)
  const feats = useFeatures()
  const has = (id: string) => ownPhone && (sim.apps?.includes(id) ?? false) && keyOpen(feats, `app:${id}`)
  // Apps from the store, once installed. The ride apps open the map to pick where to go.
  const STORE_APPS: { id: string; label: string; open: () => void }[] = [
    // Before 12 the Store is there, locked: it says when the phone comes.
    { id: 'store', label: 'Store', open: () => setApp('store') },
    ...(has('waye') ? [{ id: 'waye', label: 'Waye', open: () => setApp('waye') }] : []),
    ...(has('gbairai') ? [{ id: 'gbairai', label: 'Gbairai', open: () => setApp('gbairai') }] : []),
    ...(has('tikitoko') ? [{ id: 'tikitoko', label: 'Tikitoko', open: () => setApp('tikitoko') }] : []),
    ...(has('babigram') ? [{ id: 'babigram', label: 'Babigram', open: () => setApp('babigram') }] : []),
    ...(has('flashe') ? [{ id: 'flashe', label: 'Flashé', open: onFlashe }] : []),
    ...(has('bet225') ? [{ id: 'bet225', label: 'Bet225', open: () => setApp('bet225') }] : []),
    ...(has('parisfoot') ? [{ id: 'parisfoot', label: 'ParisFoot', open: () => setApp('parisfoot') }] : []),
    ...(has('bingo') ? [{ id: 'bingo', label: 'Babi Bingo', open: () => setApp('bingo') }] : []),
    ...(has('casino') ? [{ id: 'casino', label: 'Babi Casino', open: () => setApp('casino') }] : []),
    ...(has('gode') ? [{ id: 'gode', label: 'Godé', open: () => setApp('gode') }] : []),
    ...(has('golvo') ? [{ id: 'golvo', label: 'Golvo', open: () => setApp('golvo') }] : []),
    ...(has('dodo') ? [{ id: 'dodo', label: 'Dodo', open: () => setApp('dodo') }] : []),
    ...(has('kineo') ? [{ id: 'kineo', label: 'Kinéo', open: () => setApp('kineo') }] : []),
    ...(has('bolide') ? [{ id: 'bolide', label: 'Bolide', open: () => setApp('bolide') }] : []),
    ...(has('dames') ? [{ id: 'dames', label: 'Dames', open: () => setApp('dames') }] : []),
    ...(has('huit') ? [{ id: 'huit', label: '8 américain', open: () => setApp('huit') }] : []),
    ...(has('awale') ? [{ id: 'awale', label: 'Awalé', open: () => setApp('awale') }] : []),
    ...(has('ludo') ? [{ id: 'ludo', label: 'Ludo', open: () => setApp('ludo') }] : []),
    ...(has('gnango') ? [{ id: 'gnango', label: 'Gnango', open: onMap }] : []),
    ...(has('idrive') ? [{ id: 'idrive', label: 'iDrive', open: onMap }] : []),
  ]
  type Tile = { id: string; label: string; icon: LucideIcon; colors: [string, string]; open: () => void }
  const APPS = (
    [
    { id: 'map', label: 'Carte', icon: MapIcon, colors: ['#69e2a0', '#00a862'], open: onMap },
    { id: 'here', label: 'Quartier', icon: MapPin, colors: ['#ffa040', '#ff6a00'], open: () => setApp('here') },
    { id: 'jobs', label: 'Boulot', icon: Briefcase, colors: ['#64b5ff', '#2a6cf0'], open: () => setApp('jobs') },
    { id: 'home', label: 'Logement', icon: House, colors: ['#ffb347', '#ff7a00'], open: () => setApp('home') },
    { id: 'news', label: 'Infos', icon: Newspaper, colors: ['#ff8a65', '#e8590c'], open: () => setApp('news') },
    { id: 'messages', label: 'Messages', icon: MessageCircle, colors: ['#b39dff', '#6c47ff'], open: () => setApp('messages') },
    { id: 'friends', label: 'Amis', icon: Users, colors: ['#ffa8c5', '#e83e8c'], open: () => setApp('friends') },
    ...(ownPhone
      ? [
          { id: 'camera', label: 'Caméra', icon: Camera, colors: ['#9aa5b8', '#3d4659'], open: onCamera },
          { id: 'galerie', label: 'Galerie', icon: Images, colors: ['#ffd36e', '#ff8a3d'], open: () => setApp('galerie') },
        ]
      : []),
    { id: 'jeux', label: 'Jeux', icon: Gamepad2, colors: ['#c49bff', '#7048e8'], open: () => setApp('jeux') },
    { id: 'guide', label: 'Encyclo', icon: BookOpen, colors: ['#9fa8ff', '#4b4fd6'], open: () => setApp('guide') },
    { id: 'boutique', label: 'Boutique', icon: ShoppingBag, colors: ['#ffc233', '#e07800'], open: () => setApp('boutique') },
    { id: 'idees', label: 'Idées', icon: Lightbulb, colors: ['#ffe066', '#f5a000'], open: () => setApp('idees') },
    ...(keyOpen(feats, 'app:politique') ? [{ id: 'politique', label: 'Politique', icon: Landmark, colors: ['#8c9eff', '#3d4fd6'] as [string, string], open: () => setApp('politique') }] : []),
    { id: 'profile', label: 'Profil', icon: UserRound, colors: ['#ff8a9b', '#ff3d57'], open: () => navigate('/profil', { viewTransition: true }) },
    ] as Tile[]
  ).filter((a) => !life.minor || (a.id !== 'jobs' && a.id !== 'home'))
  // The dock: the map, the messages, the friends, the camera (when the phone is one's own; else the games).
  const DOCK = ['map', 'messages', 'friends', ownPhone ? 'camera' : 'jeux']
  const title: Record<PhoneAppId, string> = { bingo: 'Babi Bingo', casino: 'Babi Casino', here: commune.name, jobs: 'Boulot', home: 'Logement', messages: 'Messages', news: 'Infos · Côte d’Ivoire', store: 'Store', waye: 'Waye', golvo: 'Golvo', friends: 'Amis', gbairai: 'Gbairai', tikitoko: 'Tikitoko', babigram: 'Babigram', bet225: 'Bet225', parisfoot: 'ParisFoot', galerie: 'Galerie', guide: 'Encyclopédie de Babi', dodo: 'Dodo', kineo: 'Kinéo', dames: 'Dames 225', huit: '8 américain', awale: 'Awalé 225', ludo: 'Ludo 225', gode: 'Godé', bolide: 'Bolide', jeux: 'Jeux', boutique: 'Boutique', idees: 'Tes idées pour Babi Life', politique: 'Politique' }

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-[#0f1230]/55 backdrop-blur-[3px] sm:items-center" onClick={onClose}>
      {/* The phone: a metal band round it, its buttons on the sides, the black border, the screen. */}
      <div
        className="animate-up relative h-[min(92%,780px)] w-[min(100%,384px)] rounded-[56px] p-[3px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.75),inset_0_0_0_1px_rgba(255,255,255,0.25)] max-sm:h-[88%] max-sm:rounded-b-none max-sm:pb-0"
        style={{ background: 'linear-gradient(145deg,#d4d7dd 0%,#7a7e87 22%,#30333a 50%,#8d919a 78%,#e1e4e9 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {[
          ['left', 104, 26],
          ['left', 150, 50],
          ['left', 212, 50],
          ['right', 170, 78],
        ].map(([side, top, h]) => (
          <span key={`${side}${top}`} className={`absolute w-[3px] rounded-sm max-sm:hidden ${side === 'left' ? '-left-[3px]' : '-right-[3px]'}`} style={{ top: top as number, height: h as number, background: 'linear-gradient(90deg,#5d616a,#a9adb5)' }} />
        ))}
        <div className="relative h-full rounded-[53px] bg-black p-[8px] max-sm:rounded-b-none max-sm:pb-0">
          <div className={`phone-screen relative flex h-full flex-col overflow-hidden rounded-[45px] max-sm:rounded-b-none ${app === null ? 'bg-[#1a1033]' : 'bg-white'}`}>
            {/* The wallpaper: a sunset over the lagoon, its soft lights. */}
            {app === null && (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#ffb27a,#e0306a_55%,#3b1d6e)]">
                <span className="absolute -top-10 -left-16 h-56 w-56 rounded-full bg-[#ffd166]/40 blur-3xl" />
                <span className="absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-[#7048e8]/40 blur-3xl" />
                <span className="absolute -bottom-16 left-6 h-56 w-56 rounded-full bg-[#00a862]/25 blur-3xl" />
              </div>
            )}
            {/* The status bar: the time, the Dynamic Island in the middle, the network and the battery (the Sim's energy). */}
            <div className={`relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-7 pt-[11px] pb-1 text-[13px] font-bold ${app === null ? 'text-white' : 'text-[#111]'}`}>
              <span className="tnum">{time}</span>
              <span className="flex h-[30px] w-[108px] items-center justify-end rounded-full bg-black pr-3">
                <span className="h-[9px] w-[9px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#3b4a7a,#0b0d16)] ring-1 ring-[#1c1f2b]" />
              </span>
              <span className="flex items-center justify-end gap-1.5">
                <SignalBars />
                <span className="text-[11px] font-extrabold">4G</span>
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
                    <button key={a.id} onClick={a.open} className="flex min-w-0 flex-col items-center gap-1 active:scale-90">
                      <span className="relative">
                        <PhoneIcon id={a.id} icon={a.icon} colors={a.colors} />
                        {((a.id === 'friends' && sim.gang === 'invited') || (a.id === 'home' && sim.rentArrears > 0) || (a.id === 'jobs' && !sim.career)) && <Badge />}
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{a.label}</span>
                    </button>
                  ))}
                  {STORE_APPS.map((a) => (
                    <button key={a.id} onClick={a.open} className="flex min-w-0 flex-col items-center gap-1 active:scale-90">
                      <span className="relative block h-14 w-14">
                        <AppLogo id={a.id} size={56} radius={13} />
                        {a.id === 'golvo' && delivery && <Badge />}
                      </span>
                      <span className="w-full truncate text-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">{a.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex justify-center gap-1.5">
                  <span className="h-[7px] w-[7px] rounded-full bg-white" />
                  <span className="h-[7px] w-[7px] rounded-full bg-white/40" />
                </div>
              </div>
              {/* The dock: four apps always at hand, on frosted glass. */}
              <div className="absolute inset-x-3 bottom-6 z-10 grid grid-cols-4 gap-2 rounded-[32px] bg-white/25 px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] backdrop-blur-xl max-sm:bottom-7">
                {DOCK.map((id) => APPS.find((a) => a.id === id))
                  .filter((a): a is Tile => !!a)
                  .map((a) => (
                    <button key={a.id} onClick={a.open} className="flex justify-center active:scale-90" aria-label={a.label}>
                      <span className="relative">
                        <PhoneIcon id={a.id} icon={a.icon} colors={a.colors} />
                        {a.id === 'messages' && journal.length > 0 && <Badge n={Math.min(99, journal.length)} />}
                      </span>
                    </button>
                  ))}
              </div>
              {/* The home bar: a tap puts the phone away. */}
              <button className="absolute bottom-1.5 left-1/2 z-10 h-5 w-36 -translate-x-1/2" onClick={onClose} aria-label="Ranger le téléphone">
                <span className="mx-auto block h-[5px] w-[124px] rounded-full bg-white/85" />
              </button>
            </>
          ) : (
            <div key={app} className="motion-app relative flex flex-1 flex-col overflow-hidden bg-white">
              {/* The app's bar: back to the home screen on the left, its name in the middle. */}
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 border-b border-black/5 px-2 pt-1 pb-2">
                <button className="flex items-center text-[15px] font-semibold text-[var(--color-orange)] active:opacity-60" onClick={() => setApp(null)} aria-label="Retour">
                  <ChevronLeft size={26} strokeWidth={2.6} />
                  Accueil
                </button>
                <h3 className="truncate text-center font-display text-[17px] font-extrabold">{title[app]}</h3>
                <span className="w-[76px]" />
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-6">
                {app === 'here' && (
                  <ul className="motion-stagger space-y-2">
                    {places.map((p) => (
                      <Row key={p.id} icon={iconFor(p.kind === 'home' ? 'house' : world.kinds[p.kind].icon)} colors={kindColors(p.kind)} title={p.name} sub={p.kind === 'home' ? 'Dormir, se doucher, cuisiner' : world.kinds[p.kind].label} onClick={() => onWalk(p.id)}>
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
                    <p className="text-sm font-bold text-[var(--color-ink-soft)]">Pour s'entraîner, même sans réseau : rien n'est envoyé ni gagné. Les vrais défis se jouent sur place (la salle de jeux vidéo, le grin, le supermarché) et rapportent.</p>
                    <ul className="motion-stagger space-y-2">
                      {PRACTICE.map((k) => {
                        const d = defiLook(k)
                        return <Row key={k} icon={d.icon} colors={d.colors} title={d.title} sub="Entraînement" onClick={() => onPractice(k)} />
                      })}
                    </ul>
                  </div>
                )}
                {app === 'guide' && <GuideApp world={world} onTutorial={() => (onClose(), openTutorial())} onGo={(kind) => goToKind(kind, commune, onWalk, onMap)} />}
                {app === 'dodo' && <DodoApp world={world} sim={sim} act={act} onMap={onMap} />}
                {app === 'bolide' && <BolideApp world={world} sim={sim} act={act} onDrive={onDrive} />}
                {app === 'dames' && <DamesApp sim={sim} onOnline={onDamesOnline} onFriend={onDames} onResume={onDamesResume} />}
                {app === 'awale' && <AwaleApp sim={sim} />}
                {app === 'ludo' && <LudoApp sim={sim} />}
                {app === 'huit' && <HuitApp sim={sim} onTable={onHuitTable} onFriend={onHuitFriend} onResume={onHuitResume} />}
                {app === 'kineo' && <KineoApp world={world} sim={sim} act={act} onWalk={onWalk} onMap={onMap} onClose={onClose} />}
                {app === 'friends' && <FriendsApp world={world} sim={sim} act={act} onPay={has('waye') ? (p) => (setWayeTo(p.id), setApp('waye')) : undefined} onDames={onDames} />}
                {app === 'store' && !ownPhone && (
                  <div className="grid place-items-center gap-3 px-6 py-12 text-center">
                    <Lock size={34} className="text-[var(--color-ink-soft)]" />
                    <p className="font-display text-xl font-extrabold">Pas encore de téléphone</p>
                    <p className="text-sm font-bold text-[var(--color-ink-soft)]">
                      {sim.firstName} aura son téléphone à 12 ans, avec Waye dessus : le Store s'ouvre alors (Gbairai, Tikitoko, Golvo, Gnango…).
                      {(() => {
                        const left = Math.ceil((sim.bornAt ?? 0) + minutesToAge(world, 12) - sim.gameMinutes)
                        return left > 0 ? ` Encore ${duration(left)}.` : ''
                      })()}
                    </p>
                  </div>
                )}
                {app === 'store' && ownPhone && <StoreApp world={world} sim={sim} act={act} onOpen={(id) => (id === 'gnango' || id === 'idrive' ? onMap() : id === 'flashe' ? onFlashe() : setApp(id as PhoneAppId))} />}
                {app === 'boutique' && <BoutiqueApp sim={sim} back={achat} onConfirmAdult={onConfirmAdult} onResult={onResult} />}
                {app === 'idees' && <IdeasApp sim={sim} />}
                {app === 'politique' && <PolitiqueApp world={world} sim={sim} commune={commune} at={at} onWalk={(id) => (onClose(), onWalk(id))} />}
                {app === 'waye' && <WayeApp world={world} sim={sim} act={act} journal={journal} renderJournal={(events) => <Journal events={events} />} payTo={wayeTo} />}
                {app === 'gbairai' && <GbairaiApp world={world} sim={sim} />}
                {app === 'tikitoko' && <TikitokoApp sim={sim} act={act} photo={tikiPhoto} street={street} onClose={() => (setApp(null), setTikiPhoto(undefined))} />}
                {app === 'babigram' && <BabigramApp sim={sim} act={act} photo={gramPhoto} stories={has('gbairai')} onClose={() => (setApp(null), setGramPhoto(undefined))} />}
                {app === 'galerie' && <GalleryApp sim={sim} onCamera={onCamera} story={has('gbairai')} onTiki={has('tikitoko') ? (p, src) => (setTikiPhoto({ id: p.id, src }), setApp('tikitoko')) : null} onGram={has('babigram') ? (p, src) => (setGramPhoto({ id: p.id, src }), setApp('babigram')) : null} />}
                {(app === 'bet225' || app === 'parisfoot') && <BetApp sim={sim} act={act} app={app} />}
                {app === 'bingo' && <BingoApp world={world} sim={sim} act={act} onConfirmAdult={onConfirmAdult} />}
                {app === 'casino' && <CasinoApp world={world} sim={sim} act={act} onConfirmAdult={onConfirmAdult} />}
                {app === 'gode' && <GodeApp sim={sim} act={act} onConfirmAdult={onConfirmAdult} />}
                {app === 'golvo' && <GolvoApp world={world} sim={sim} delivery={delivery} onOrder={onDelivery} onCancel={() => onDelivery(null)} onCollect={onCollect} />}
              </div>
              {/* The home bar: a tap goes back to the home screen. */}
              <button className="flex h-6 shrink-0 items-center justify-center bg-white" onClick={() => setApp(null)} aria-label="Écran d'accueil">
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
    <span className="flex items-center gap-[1px]" title={`Énergie ${Math.round(level)} %`}>
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
}

/**
 * Walking about inside a place: what's done there, for the scene to show
 * over its spots (world3d/SpotActions), the same list as « Que faire ? ». Sent
 * again only when it changes (an open pin stays open as the clock ticks).
 */
function SceneActionsFeed({ world, sim, city, commune, placeId, onPick }: { world: World; sim: Sim; city: City; commune: Commune; placeId: string; /** why: what stops it now (shown instead of doing it). */ onPick: (it: Interaction, kind: string, why?: string) => void }) {
  const pa = usePlaceActions(world, sim, city, commune, placeId)
  const whyNot = (it: Interaction) => {
    const st = pa!.state(it)
    return st.reason ?? (!st.open ? `Ouvert ${openingLabel(it)}` : st.broke ? 'Pas assez de Djai' : undefined)
  }
  const acts: SceneAction[] = pa
    ? pa.items.map((it) => ({
        id: it.id,
        label: it.label,
        icon: it.icon,
        colors: kindColors(pa.place.kind),
        note: [duration(actionLength(it.minutes)), it.cost > 0 ? `−${amount(it.cost)} Djai` : it.cost < 0 ? `+${amount(-it.cost)} Djai` : ''].filter(Boolean).join(' · '),
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

/** The things of the pin tapped in the room (world3d/SpotActions), in a card over the place's bar: tap one, the Sim goes. */
function SpotSheet() {
  const { open, pick } = useSceneActions()
  if (!open) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[11.25rem] z-30 flex justify-center px-3 lg:bottom-[12.25rem]">
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
          Fermer
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
  const place = !placeId ? null : placeId === 'home' ? { name: 'Chez toi', kind: 'home' } : (commune.places.find((p) => p.id === placeId) ?? null)
  const adult = !!useSession((s) => s.user?.adult)
  // At the stadium: what's on, and the match or the concert only while it's on.
  const agenda = useStadium(place?.kind === 'stade' ? placeId : null)
  // The updates not opened yet (lib/features.ts).
  const feats = useFeatures()
  // The republic's (lib/civic.ts): the campaign at the mairie, the market, the maquis; the stadium's big days.
  const terrain = useTerrain(sim.id, !!place && CIVIC_KINDS.has(place.kind))
  if (!place || !placeId) return null
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
  const items = [...(career ? [shift(career, sim.careerLevel)] : []), ...kind.interactions.map((it) => (placeId === 'home' ? atHome(it, home) : it))].filter((it) => !it.stay || roomHere)
    .filter((it) => ageBlock(it, life.stage?.id) !== 'Plus de ton âge' && (!it.places || it.places.includes(placeId)) && (!it.cities || it.cities.includes(city.id)) && (!it.faiths || it.faiths.includes((place as Place).faith!)) && (!it.gender || it.gender === sim.gender))
    .filter((it) => it.id !== 'passer-nuit' || (partner && adult && !life.minor))
    .filter((it) => civicState(it, terrain, placeId, commune.id).show)
    // What an update hasn't brought yet (lib/features.ts).
    .filter((it) => activityOpen(feats, it.id))
    // Once the boutiques are open, they take the place of the old « S'acheter une tenue ».
    .filter((it) => it.id !== 'vetements' || !activityOpen(feats, 'boutique-mode'))
    .map((it) => (it.id === 'passer-nuit' && partner ? { ...it, label: `Passer la nuit avec ${partner.name}` } : it))
    // The president's measures of the week: some prices lowered for everyone.
    .map((it) => withMeasures(world, sim, place.kind, it))
  // Busy at these grounds (the zoo visit): the other things there can still be picked, they take over.
  const busy = !!sim.activity && !(sim.activity.kind === 'do' && sim.activity.placeId === placeId && GROUNDS.has(placeId))
  const on = eventAt(agenda, sim.gameMinutes)
  const stadiumBlock = (it: Interaction) => {
    const k = it.id === 'stade-match' ? 'match' : it.id === 'stade-concert' ? 'concert' : null
    if (!k || on?.kind === k) return null
    const next = agenda?.agenda.find((e) => e.kind === k && e.start - DOORS_OPEN > sim.gameMinutes)
    return next ? `Prochain : ${when(next.start)}` : k === 'match' ? 'Pas de match' : 'Pas de concert'
  }
  // In one's own house, sleeping takes a bed, cooking a stove, the TV a TV.
  const furnitureBlock = (it: Interaction) => {
    // Swimming: a pool in the house one built, or the villa one rents (game.CanSwimAtHome).
    if (placeId === 'home' && it.id === 'nager' && !(sim.housing === 'maison' ? sim.furnished?.includes('piscine') : sim.housing === 'villa')) return 'Il te faut une piscine'
    const lack = placeId === 'home' ? homeLacks(world, sim, it.id) : ''
    if (lack) return `Il te faut : ${lack}`
    // The TV wants the power: none while the home's zone is cut (world3d/power.ts).
    const home = whereabouts.places.find((p) => p.id === 'home')
    if (placeId === 'home' && it.id === 'watch-tv' && home) {
      const cut = inCut(cutsAround(commune.id, home.door[0], home.door[1], sim.gameMinutes, 0), home.door[0], home.door[1])
      if (cut) return `Coupure de courant jusqu'à ${clock(cut.end).time}`
    }
    return null
  }
  const state = (it: Interaction) => ({ open: openAt(it, sim.gameMinutes), broke: it.cost > 0 && sim.money < it.cost, busy, reason: ageBlock(it, life.stage?.id) ?? stadiumBlock(it) ?? civicState(it, terrain, placeId, commune.id).why ?? blockedBy(it, sim, city.id, commune.id) ?? furnitureBlock(it) })
  return { place, kind, home, career, life, roomHere, items, busy, here, agenda, on, state }
}

function InteractionMenu({ world, sim, city, commune, placeId, desktop, onClose, onPick, onTravel, onStop, onBuild, soiree, onSoiree }: MenuProps) {
  const navigate = useNavigate()
  const pa = usePlaceActions(world, sim, city, commune, placeId)
  const feats = useFeatures()
  // (A place of the map the street hasn't loaded yet, or not any more: the Sim went far.)
  if (!pa) return null
  const { place, kind, life, roomHere, items, busy, here, agenda, on, state } = pa
  const colors = kindColors(place.kind)
  const canBuild = placeId === 'home' && here && !!world.materials?.length
  // Building is on one's own lot, bought from 18.
  const tooYoung = life.minor
  const billing = place.kind === 'stade' && (
    <div className="min-w-0 rounded-[20px] bg-[#fff4e8] p-3">
      <div className="label">À l'affiche</div>
      {on ? (
        <div className="mt-1">
          <div className="font-display text-[17px] leading-tight font-extrabold">
            {on.title} {on.score && <span className="ml-1 rounded-full bg-[#141416] px-2 py-0.5 text-[13px] text-[#ffd166]">{on.score}</span>}
          </div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{sim.gameMinutes < on.start ? `Les portes sont ouvertes · ${on.detail}` : `En ce moment · ${on.detail}`}</div>
        </div>
      ) : (
        <p className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">Rien en ce moment.</p>
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
        <span className="block font-display text-[15px] leading-tight font-extrabold">Construire ma maison</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{tooYoung ? 'À 18 ans : ton terrain, puis ta maison' : 'Ton terrain, tes murs, tes meubles'}</span>
      </span>
    </button>
  )
  // At home: a soirée for the players of the quarter (backend sims/party.go), from 18 (the host is an adult).
  // (An update the team opens from the admin: lib/features.ts.)
  const party = placeId === 'home' && here && onSoiree && keyOpen(feats, 'soiree') && (
    <button disabled={(busy && !soiree) || life.minor} onClick={onSoiree} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#f6e8ff] p-2.5 text-left transition active:scale-[0.98] ${(busy && !soiree) || life.minor ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={life.minor ? Lock : PartyPopper} colors={['#ff5cc8', '#7a2bd6']} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{soiree ? `Ta soirée : ${soiree.title}` : 'Organiser une soirée'}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{life.minor ? 'À 18 ans' : soiree ? `${soiree.guests} invité${soiree.guests > 1 ? 's' : ''} · retourne sur la piste` : `${fcfa(SOIREE_COST)} · 3 h · les joueurs du quartier viennent danser`}</span>
      </span>
    </button>
  )
  // The wardrobe at home and at the couturier; a new hairdo at the barber or the salon.
  const lookTab = { home: 'tenue', couture: 'tenue', boutique: 'tenue', salon: 'coiffure', barbier: 'coiffure' }[place.kind]
  const restyle = lookTab && here && (
    <button disabled={busy} onClick={() => navigate(`/look?tab=${lookTab}`, { viewTransition: true })} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#fff4e8] p-2.5 text-left transition active:scale-[0.98] ${busy ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={lookTab === 'coiffure' ? Scissors : Shirt} colors={colors} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">Changer de look</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{lookTab === 'coiffure' ? (sim.gender === 'homme' ? 'Coupe, couleur, barbe' : 'Coupe, couleur') + ' · 2 000 Djai' : 'Tenue, pagne, couleurs, accessoire · gratuit'}</span>
      </span>
    </button>
  )
  // A hotel's floors and rooms: up by the lift (world3d/interior/HotelFloors), to visit and rent one.
  const rooms = place.kind === 'hotel' && here && !life.minor && (
    <button disabled={busy} onClick={() => (onClose(), openLift())} className={`flex w-full items-center gap-3 rounded-[20px] bg-[#fff6d6] p-2.5 text-left transition active:scale-[0.98] ${busy ? 'opacity-55 grayscale-[0.6]' : ''}`}>
      <IconTile icon={KeyRound} colors={['#ffd36e', '#e0a100']} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] leading-tight font-extrabold">{roomHere ? `Ta chambre ${sim.stay!.room}` : 'Les chambres'}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--color-ink-soft)]">{roomHere ? 'L’ascenseur, ta clé, le room service' : 'L’ascenseur : visite les étages, loue une chambre'}</span>
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
          <button className="animate-pop relative z-10 flex flex-col items-center" onClick={onClose} aria-label="Fermer">
            <IconTile icon={iconFor(kind.icon)} colors={colors} size={96} radius={34} />
            <span className="mt-2 rounded-full bg-white px-4 py-1.5 font-display text-lg font-extrabold shadow-lg">{place.name}</span>
          </button>
          {(build || restyle || billing || rooms || party) && (
            <div className="absolute top-full left-1/2 mt-[200px] grid w-64 -translate-x-1/2 gap-2">
              {billing}
              {party}
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
          <button className="icon-btn self-start bg-white/80" onClick={close} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        {'id' in place && (kind.id === 'sport' || place.id === 'plateau-stade') && <CourtCount placeId={place.id} />}
        {'id' in place && <Flights world={world} sim={sim} placeId={place.id} busy={busy} onTravel={onTravel} />}
        {'id' in place && place.kind === 'transport' && place.type !== 'ferry_terminal' && <Departures world={world} sim={sim} busy={busy} onTravel={onTravel} />}
        {busy && (
          <div className="mb-3 flex items-center gap-3 rounded-[20px] bg-[#fff4e8] p-3">
            <Hourglass className="shrink-0 text-[var(--color-orange)]" size={22} />
            <p className="min-w-0 flex-1 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">
              {sim.firstName} est occupé·e : {sim.activity!.interaction.label.toLowerCase()}. Arrête pour faire autre chose.
            </p>
            {sim.activity!.kind === 'do' && (
              <button className="btn btn-soft shrink-0 !px-3 !py-2 !text-sm" onClick={onStop}>
                Arrêter
              </button>
            )}
          </div>
        )}
        {here ? (
          <div className="motion-stagger grid gap-2">
            {billing}
            {party}
            {build}
            {restyle}
            {rooms}
            {byRoom(items).map(([room, list]) => (
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
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold text-[var(--color-ink-soft)]">
              {sim.firstName} n'est pas {aCommune(commune.name)}. Vas-y d'abord pour faire une activité ici.
            </p>
            <TravelCTA world={world} sim={sim} cityId={city.id} communeId={commune.id} onTravel={onTravel} />
          </>
        )}
        </>
      )}
    </Sheet>
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
      Délestage ici · jusqu'à {clock(cut.end).time}
    </span>
  )
}

function ActionButton({ it, colors, open, broke, busy, reason, onPick, compact }: { it: Interaction; colors: [string, string]; open: boolean; broke: boolean; busy?: boolean; reason?: string | null; onPick: () => void; compact?: boolean }) {
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
          <Chip>
            <Clock3 size={11} /> {duration(actionLength(it.minutes))}
          </Chip>
          {it.cost !== 0 && (
            <Chip tone={it.cost < 0 ? 'good' : 'gold'}>
              {it.cost < 0 ? '+' : '−'}
              {amount(Math.abs(it.cost))} Djai
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

function HappeningSheet({ now, sim, commune, onClose, onJoin }: { now: HappeningNow; sim: Sim; commune: Commune; onClose: () => void; onJoin: (it: Interaction) => void }) {
  const h = now.happening!
  const left = Math.max(0, now.end - sim.gameMinutes)
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full overflow-hidden rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[var(--color-gold)] p-4 text-[#5a3a00]">
          <div className="flex items-center gap-3">
            <IconTile icon={iconFor(h.icon)} colors={['#ffffff66', '#ffffff22']} size={52} />
            <div className="min-w-0 flex-1">
              <div className="label !text-[#7a5200]">En ce moment {aCommune(commune.name)}</div>
              <div className="font-display text-[22px] leading-tight font-extrabold">{h.label}</div>
            </div>
            <button className="icon-btn bg-white/60" onClick={onClose} aria-label="Fermer">
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          <p className="mt-2 text-sm leading-snug font-bold">{h.text}</p>
          <div className="mt-2">
            <Chip tone="dark">
              <Clock3 size={12} /> Encore {duration(left)}
            </Chip>
          </div>
        </div>
        <div className="p-4">
          {h.join ? (
            <ActionButton it={h.join} colors={['#ffd54f', '#ffa000']} open={openAt(h.join, sim.gameMinutes)} broke={h.join.cost > 0 && sim.money < h.join.cost} busy={!!sim.activity} reason={blockedBy(h.join, sim, sim.city, commune.id)} onPick={() => onJoin(h.join!)} />
          ) : (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">Rien à faire ici à part regarder… et attendre que ça passe.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** A player's soirée (backend sims/party.go): its host, its guests, how long it goes on; what's done there; the host ends it. */
function SoireeSheet({ party, world, sim, city, commune, onClose, onPick, onEnd }: { party?: Soiree; world: World; sim: Sim; city: City; commune: Commune; onClose: () => void; onPick: (it: Interaction) => void; onEnd: () => void }) {
  const life = lifeOf(world, sim)
  const host = party?.host === sim.id
  const left = party ? Math.max(0, Math.round((new Date(party.ends).getTime() - serverNow()) / 60000)) : 0
  const items = (world.kinds.soiree?.interactions ?? []).filter((it) => (it.id === 'recevoir-soiree' ? host : true) && ageBlock(it, life.stage?.id) !== 'Plus de ton âge')
  const colors: [string, string] = ['#ff5cc8', '#7a2bd6']
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up max-h-[80%] w-full overflow-y-auto rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-[#3a0f5c] to-[#c2187a] p-4 text-white">
          <div className="flex items-center gap-3">
            <IconTile icon={PartyPopper} colors={['#ffffff55', '#ffffff22']} size={52} />
            <div className="min-w-0 flex-1">
              <div className="label !text-white/75">{party ? (host ? 'Ta soirée' : `Chez ${party.hostName}`) : 'Soirée'}</div>
              <div className="truncate font-display text-[22px] leading-tight font-extrabold">{party?.title ?? 'La soirée est finie'}</div>
            </div>
            <button className="icon-btn bg-white/20 text-white" onClick={onClose} aria-label="Fermer">
              <X size={22} strokeWidth={2.6} />
            </button>
          </div>
          {party && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone="dark">
                <Clock3 size={12} /> Encore {duration(left)}
              </Chip>
              <Chip tone="dark">
                <Users size={12} /> {party.guests ? `${party.guests} invité${party.guests > 1 ? 's' : ''}` : 'Les premiers arrivent'}
              </Chip>
            </div>
          )}
        </div>
        <div className="motion-stagger grid gap-2 p-4">
          {party ? (
            <>
              {items.map((it) => (
                <ActionButton key={it.id} it={it} colors={colors} open={openAt(it, sim.gameMinutes)} broke={it.cost > 0 && sim.money < it.cost} busy={!!sim.activity} reason={ageBlock(it, life.stage?.id) ?? blockedBy(it, sim, city.id, commune.id)} onPick={() => onPick(it)} />
              ))}
              {host && (
                <button className="btn btn-soft mt-1 !text-sm" onClick={onEnd}>
                  Finir la soirée
                </button>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-[var(--color-ink-soft)]">La musique s'est arrêtée, les invités sont rentrés.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Throwing a soirée at home: its theme (from the list: players never write to one another), what it costs. */
function ThrowSoireeSheet({ sim, onClose, onThrow }: { sim: Sim; onClose: () => void; onThrow: (theme: string) => void }) {
  const [theme, setTheme] = useState(SOIREE_THEMES[0].id)
  const broke = sim.money < SOIREE_COST
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up max-h-[85%] w-full overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <IconTile icon={PartyPopper} colors={['#ff5cc8', '#7a2bd6']} size={52} />
          <div className="min-w-0 flex-1">
            <div className="label">Chez toi</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">Organiser une soirée</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        <p className="mb-3 text-sm leading-snug font-bold text-[var(--color-ink-soft)]">
          La sono, le DJ et les boissons pour {SOIREE_HOURS} h. Les lumières s'allument au-dessus de chez toi : les joueurs du quartier les voient et viennent danser, tes amis sont prévenus.
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
        <button className="btn mt-4 w-full" disabled={broke} onClick={() => onThrow(theme)}>
          <PartyPopper size={18} /> {broke ? `Il te faut ${fcfa(SOIREE_COST)}` : `Lancer la soirée · ${fcfa(SOIREE_COST)}`}
        </button>
      </div>
    </div>
  )
}

/* ---------- Feedback ---------- */

/** A distance to read at a glance: « 320 m », « 1,2 km ». */
const metres = (m: number) => (m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`)

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
        {metres(way.left)} · {secs < 60 ? "moins d'1 min" : `${Math.round(secs / 60)} min`}
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
      <div className="hud absolute top-[4.6rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-4 text-sm font-extrabold whitespace-nowrap">
        <span className={`font-display text-[22px] leading-none ${bumped ? 'text-[var(--color-rose)]' : ''}`}>{kmh}</span>
        <span className="text-[11px] text-[var(--color-ink-soft)]">km/h · {metres(drive.metres)}</span>
        <span className="max-w-[110px] truncate text-[12px]">{driven.name}</span>
        <button className="icon-btn !h-8 !w-8 bg-[var(--color-canvas)]" onClick={onWhere} aria-label="Où aller ?">
          <Navigation size={16} strokeWidth={2.6} className="text-[var(--color-orange)]" />
        </button>
        <button className="btn !bg-[var(--color-orange)] !px-3 !py-1.5 !text-xs" onClick={onPark}>
          Garer
        </button>
      </div>
      {/* The GPS: the next turn, and where to */}
      {to && (
        <div className="hud absolute top-[7.9rem] left-1/2 z-30 flex w-[min(360px,calc(100vw-24px))] -translate-x-1/2 items-center gap-3 rounded-[20px] py-2 pr-2 pl-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ffd43b] text-[#16161c]">
            {!next && gps.lost ? <ArrowUp size={28} strokeWidth={3} style={{ transform: `rotate(${bearingTo(to.door)}rad)` }} /> : arrived ? <MapPin size={26} strokeWidth={2.8} /> : next?.turn === 'left' ? <CornerUpLeft size={28} strokeWidth={3} /> : next?.turn === 'right' ? <CornerUpRight size={28} strokeWidth={3} /> : next?.turn === 'uturn' ? <Undo2 size={26} strokeWidth={3} /> : <ArrowUp size={28} strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-display text-[17px] font-extrabold">
              {!next && gps.lost ? `Hors des rues : ${metres(gps.lost)}, par là` : !next ? 'Je cherche le chemin…' : arrived ? 'Tu es arrivé·e' : next.turn === 'uturn' ? 'Fais demi-tour' : next.turn === 'straight' ? `Tout droit, ${metres(next.in)}` : `À ${next.turn === 'left' ? 'gauche' : 'droite'} dans ${metres(Math.max(10, Math.round(next.in / 10) * 10))}`}
            </span>
            <span className="block truncate text-xs font-bold text-[var(--color-ink-soft)]">
              {to.name}
              {next && !arrived ? ` · ${metres(gps.left)}` : ''}
            </span>
          </span>
          <button className="icon-btn !h-8 !w-8 bg-[var(--color-canvas)]" onClick={() => ((gps.to = null), (gps.way = null), (gps.next = null))} aria-label="Arrêter le GPS">
            <X size={16} strokeWidth={2.6} />
          </button>
        </div>
      )}
      {/* At a place's door: park and go in */}
      {there && Math.abs(drive.speed) < 9 && (
        <div className="absolute inset-x-0 bottom-[calc(13.2rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-3">
          <button className="btn animate-pop max-w-full !px-4 !py-2.5 !text-sm" onClick={() => onParkAt(there.id)}>
            <Car size={17} strokeWidth={2.6} /> <span className="truncate">Garer devant {there.name}</span>
          </button>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 flex items-end justify-between px-4">
        <div className="flex gap-2">
          {([-1, 1] as const).map((d) => (
            <button key={d} className={`${round} h-[72px] w-[72px] bg-white/90 text-[var(--color-ink)]`} {...hold(() => (drive.steer = d), () => drive.steer === d && (drive.steer = 0))} aria-label={d < 0 ? 'À gauche' : 'À droite'}>
              {d < 0 ? <ChevronLeft size={40} strokeWidth={3} /> : <ChevronRight size={40} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button className={`${round} h-[64px] w-[64px] bg-[#e03131] text-[13px] font-extrabold text-white`} {...hold(() => (drive.throttle = -1), () => drive.throttle < 0 && (drive.throttle = 0))}>
            Frein
          </button>
          <button className={`${round} h-[84px] w-[84px] bg-[var(--color-emerald)] text-[13px] font-extrabold text-white`} {...hold(() => (drive.throttle = 1), () => drive.throttle > 0 && (drive.throttle = 0))}>
            Gaz
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
    if (!parked || parked.sim !== simId || parked.commune !== commune) return setNear(false)
    const t = setInterval(() => setNear(distanceTo([parked.x, parked.z]) < 5), 400)
    return () => clearInterval(t)
  }, [parked, simId, commune])
  if (!parked || !near) return null
  return (
    <div className="absolute inset-x-0 bottom-[calc(7.4rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-3">
      <button
        className="btn animate-pop max-w-full !px-4 !py-2.5 !text-sm"
        onClick={() => {
          getIn.at = { x: parked.x, z: parked.z, h: parked.h }
          setParked(null)
          startDrive(parked.v)
        }}
      >
        <Car size={17} strokeWidth={2.6} /> <span className="truncate">Monter dans {parked.v.name}</span>
      </button>
    </div>
  )
}

/** A tap on the ground on the way to a place: drop the way for that spot? (world3d/dropRoute.ts) */
function DropRouteAsk({ from, moto }: { from: string; moto: boolean }) {
  return (
    <div className="hud animate-up absolute bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex w-[min(380px,calc(100vw-24px))] -translate-x-1/2 items-center gap-2 rounded-[22px] p-2 pl-3 text-sm font-extrabold">
      <Navigation size={20} className="shrink-0 text-[var(--color-orange)]" />
      <span className="min-w-0 flex-1 leading-tight">
        Aller plutôt ici ?
        <span className="line-clamp-2 block text-xs text-[var(--color-ink-soft)]">
          Tu laisses tomber {from}
          {moto ? ' et tu descends de la moto-taxi (déjà payée).' : '.'}
        </span>
      </span>
      <button className="btn btn-soft !px-3 !py-2 !text-xs" onClick={() => answerDrop(false)}>
        Continuer
      </button>
      <button className="btn !px-3 !py-2 !text-xs" onClick={() => answerDrop(true)}>
        Aller ici
      </button>
    </div>
  )
}

/** What the Sim is busy with, on real time: progress, time left, and a way to stop. */
function ActivityBar({ world, sim, onStop, stopping, onRoute, onMore, onRejoin, onDefi, onTask, onFilm, onMachine, onShop }: { world: World; sim: Sim; onStop: () => void; stopping: boolean; onRoute: () => void; /** At a slot machine: back to it. */ onMachine?: () => void; /** In a boutique: back to its rails. */ onShop?: () => void; /** At the ciné-club: the real film, to watch. */ onFilm?: () => void; /** At the zoo: the other things to do there. */ onMore?: () => void; /** A match left before its end: back onto the pitch. */ onRejoin?: { sport: 'foot' | 'basket'; go: () => void }; /** The activity taken on as a défi. */ onDefi?: () => void; /** At work: one of the job's tasks (backend sims/jobs.go). */ onTask?: (t: JobTask) => Promise<ActionResult['outcome']> }) {
  const a = sim.activity!
  const span = Math.max(1, a.end - a.start)
  const done = Math.min(1, Math.max(0, (sim.gameMinutes - a.start) / span))
  const left = Math.max(0, Math.ceil(a.end - sim.gameMinutes))
  const travel = a.kind === 'travel'
  // On the server's clock, like the car in the street (the Sim's minutes come with its updates, late).
  const road = travel ? tripLeft(world, a, (serverNow() - EPOCH) / 60000) : undefined
  // In one's own vehicle: it, in its colour.
  const own = travel ? a.trip?.vehicle : undefined
  const icon = own ? (own.kind === 'voiture' ? Car : Bike) : travel ? CarTaxiFront : iconFor(a.interaction.icon)
  const colors = own ? ([own.color, own.color] as [string, string]) : travel ? (['#ffa040', '#ff6a00'] as [string, string]) : kindColors(a.placeKind ?? '')
  return (
    <div className="absolute bottom-[6.5rem] left-1/2 z-30 w-[min(360px,calc(100vw-24px))] -translate-x-1/2 lg:bottom-[7.5rem]">
      <div className="card animate-pop flex items-center gap-3 p-3">
        <IconTile icon={icon} colors={colors} size={46} style={own ? { color: inkOn(own.color), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' } : undefined} />
        <div className="min-w-0 flex-1">
          <div className="label truncate">{travel ? 'En route' : a.placeName}</div>
          <div className="truncate font-display text-[15px] leading-tight font-extrabold">{travel ? a.trip!.label.replace(/^Trajet /, '') : a.interaction.label}</div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div className="h-full rounded-full bg-[var(--color-emerald)] transition-[width] duration-1000 ease-linear" style={{ width: `${done * 100}%` }} />
          </div>
          <div className="mt-1 text-[11px] font-extrabold text-[var(--color-ink-soft)]">{left <= 0 ? 'Presque fini…' : road === null ? `${a.trip?.mode === 'perso' ? 'Tu montes' : a.trip && waitsAtKerb(a.trip.mode) ? 'Il t’attend au bord de la route' : 'Le chauffeur arrive'} · encore ${duration(left)}` : `Encore ${duration(left)}${road !== undefined ? ` · ${metres(road * 1000)}` : ''} · fin à ${clock(a.end).time}`}</div>
        </div>
        {travel && (
          <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onRoute} aria-label="Voir le trajet" title="Voir le trajet">
            <MapIcon size={20} strokeWidth={2.4} />
          </button>
        )}
        {onMore && (
          <button className="icon-btn shrink-0 bg-[var(--color-orange)] text-white" onClick={onMore} aria-label="Que faire ?" title="Que faire ?">
            <Sparkles size={18} strokeWidth={2.6} />
          </button>
        )}
        {!travel && (
          <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onStop} disabled={stopping} aria-label="Arrêter" title="Arrêter">
            <Square size={18} strokeWidth={2.8} />
          </button>
        )}
      </div>
      {onTask && <JobTasks world={world} sim={sim} onTask={onTask} />}
      {onFilm && a.seance?.video && a.seance.at !== undefined && <FilmButton at={a.seance.at} onWatch={onFilm} />}
      {onDefi && defiOf(a.interaction.id) && <DefiButton kind={defiOf(a.interaction.id)!} interactionId={a.interaction.id} onClick={onDefi} />}
      {onMachine && <MachineButton onClick={onMachine} />}
      {onShop && (
        <button className="btn animate-pop mt-2 w-full !py-2.5" onClick={onShop}>
          <Shirt size={18} /> Voir les vêtements
        </button>
      )}
      {onRejoin && (
        <button className="btn animate-pop mt-2 w-full !py-2.5" onClick={onRejoin.go}>
          <Volleyball size={18} /> {onRejoin.sport === 'basket' ? 'Revenir sur le terrain' : 'Revenir au match'}
        </button>
      )}
    </div>
  )
}

/** A job's tasks done once a shift count for the promotion; the same one again after an hour of the shift (backend game.TaskCooldown). */
const TASK_COOLDOWN = 60

/**
 * At work: the job's tasks as buttons (the cashier scans, the lawyer
 * pleads, the DG signs), those of the Sim's rung; each makes the Sim's
 * gesture in the room and says how it went. One done waits an hour of the
 * shift before it can be done again.
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
      setSaid({ text: errorText(e, 'Pas possible maintenant.'), bad: true })
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="card animate-pop mt-2 p-2.5">
      <div className="label mb-1.5 px-0.5">Au travail · {career.levels[sim.careerLevel]?.title}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tasks.map((t) => {
          const last = done[t.id]
          const wait = last === undefined ? 0 : Math.max(0, last + TASK_COOLDOWN - sim.gameMinutes)
          const Icon = iconFor(t.icon)
          return (
            <button key={t.id} className="tile flex min-w-0 items-center gap-2 p-2 text-left disabled:opacity-50" disabled={wait > 0 || !!busy} onClick={() => go(t)}>
              <IconTile icon={Icon} colors={kindColors(career.kind)} size={32} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[12.5px] font-extrabold">{t.label}</span>
                <span className="block text-[10.5px] font-bold text-[var(--color-ink-soft)]">{wait > 0 ? `Encore ${duration(actionLength(wait))}` : last !== undefined ? 'Fait · à refaire' : t.tip ? 'Pourboires possibles' : '+1 pour la promotion'}</span>
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
  { id: 'salle-de-bain', label: 'Salle de bain', icon: Bath },
  { id: 'chambre', label: 'Chambre', icon: BedDouble },
  { id: 'cuisine', label: 'Cuisine', icon: CookingPot },
  { id: 'salon', label: 'Salon', icon: Sofa },
  { id: 'cour', label: 'Cour', icon: Trees },
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
    <div className={`card motion-toast pointer-events-auto flex items-center gap-3 p-3 ${t.tone === 'random' || t.tone === 'event' ? 'ring-2 ring-[var(--color-gold)]' : t.tone === 'promo' ? 'ring-2 ring-[var(--color-emerald)]' : ''}`}>
      {/* Something that didn't go through: Koffi comes to say it, kindly */}
      {t.tone === 'error' ? <Helper offline={t.title === 'Hors ligne'} /> : <IconTile icon={icon} colors={colors} size={44} />}
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15px] leading-tight font-extrabold">{t.title}</div>
        {t.text && <div className="text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{t.text}</div>}
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
  if (!events.length) return <p className="text-sm font-bold text-[var(--color-ink-soft)]">Rien pour l'instant. Va vivre ta vie !</p>
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
        <span className="text-[11px] font-extrabold tracking-wide uppercase opacity-80">Le mot du jour · {e.lang}</span>
        {e.source.urls?.[0] && (
          <a href={e.source.urls[0]} target="_blank" rel="noreferrer" className="text-[11px] font-bold underline opacity-80">
            source
          </a>
        )}
      </div>
      <div className="mt-1 font-display text-xl leading-tight font-extrabold">« {e.text} »</div>
      <p className="text-sm leading-snug font-semibold opacity-95">{e.meaning}</p>
      <p className="mt-1 text-xs italic opacity-80">{e.example}</p>
    </div>
  )
}

/** The Golvo courier on the way, over the street. */
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
function MotoOffer({ world, sim, commune, act }: { world: World; sim: Sim; commune: Commune; act: Act }) {
  const { offer, paid, walk } = useMoto()
  if (!offer || paid || walk) return null
  const abidjan = !!world.compteur?.cities.includes(sim.city)
  const woro = abidjan && commune.woro && !commune.woro.none ? commune.woro : null
  const rides: { kind: RideKind; color: string; trim?: string }[] = [
    { kind: 'moto', color: MOTO },
    { kind: 'taxi', color: world.compteur?.color ?? '#ff7a00' },
    ...(woro ? [{ kind: 'woro' as const, color: woro.color ?? '#f1f3f5', trim: woro.trim }] : []),
    ...(abidjan ? [{ kind: 'gbaka' as const, color: GBAKA, trim: '#00a862' }] : []),
  ]
  const take = async (r: (typeof rides)[number]) => {
    if (await act(RIDES[r.kind].name, r.kind === 'moto' ? 'bike' : r.kind === 'gbaka' ? 'bus' : 'car-taxi-front', 'transport', () => api.moto(sim.id, offer, r.kind))) motoPaid(r)
  }
  return (
    <div className="hud animate-up absolute bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-[min(400px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] p-2.5 text-sm font-extrabold">
      <div className="flex items-center gap-2 px-1">
        <span className="min-w-0 flex-1 leading-tight">
          C'est loin ({(offer / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km) : comment tu y vas ?
        </span>
        <button className="btn btn-soft !min-h-0 !px-3 !py-1.5 !text-xs" onClick={motoWalk}>
          <Footprints size={14} /> À pied
        </button>
      </div>
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

function DeliveryPill({ delivery, now, onOpen }: { delivery: Delivery; now: number; onOpen: () => void }) {
  const st = deliveryState(delivery, now)
  return (
    <button className="hud absolute top-[5.5rem] left-1/2 z-30 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-extrabold whitespace-nowrap" onClick={onOpen}>
      <AppLogo id="golvo" size={30} radius={15} />
      {st.stage === 'here' ? `${delivery.courier} est là avec ta commande !` : st.stage === 'kitchen' ? `${delivery.place.name} prépare ta commande` : `${delivery.courier} arrive · ${st.minutesLeft} min`}
    </button>
  )
}

/**
 * At an airport: the flights out (backend game/flights.go, the game's own
 * airline): where to, how long, how much a seat. Booked, the Sim boards.
 */
function Flights({ world, sim, placeId, busy, onTravel }: { world: World; sim: Sim; placeId: string; busy: boolean; onTravel: OnTravel }) {
  const flights = (world.flights ?? []).filter((f) => f.place === placeId && f.from === sim.city)
  if (!flights.length) return null
  return (
    <div className="mb-3 rounded-[20px] bg-[#eef4ff] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#1d4ed8]">
        <Plane size={18} /> Envols · {flights[0].airline}
      </div>
      <ul className="space-y-1.5">
        {flights.map((f) => (
          <li key={f.to} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{f.toName}</span>
              <span className="block text-xs font-bold text-[var(--color-ink-soft)]">
                {f.km} km · {f.minutes} min de vol
              </span>
            </span>
            <button className="btn !bg-[#1d4ed8] !px-3 !py-2 !text-xs" disabled={busy || sim.money < f.fare} onClick={() => onTravel(f.to, f.commune, `Vol pour ${f.toName}`, { app: 'avion' }, f.fare)}>
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
function Departures({ world, sim, busy, onTravel }: { world: World; sim: Sim; busy: boolean; onTravel: OnTravel }) {
  const from = world.cities.find((c) => c.id === sim.city)?.communes.find((c) => c.id === sim.commune)
  if (!from) return null
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
        <Bus size={18} /> Départs en car
      </div>
      <ul className="space-y-1.5">
        {cars.map(({ city, to, t }) => (
          <li key={city.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{city.name}</span>
              <span className="block truncate text-xs font-bold text-[var(--color-ink-soft)]">
                {to.name !== city.name ? `${to.name} · ` : ''}
                {duration(actionLength(t.minutes))} de route
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
      {full ? `Terrain complet : ${c.players}/${c.cap} joueurs` : c.players ? `${c.players}/${c.cap} joueurs ${on ? 'en plein match' : 'attendent le coup d’envoi'}` : `Terrain libre : ${c.cap} places (${c.sport === 'foot' ? '5 contre 5' : c.sport === 'foot11' ? '11 contre 11' : '3 contre 3'})`}
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
function Billets({ money, onThrow, amounts = [1000, 5000, 10000], label = 'Lancer des billets', color = '#1f9a4a' }: { money: number; onThrow: (amount: number) => Promise<string>; amounts?: number[]; label?: string; color?: string }) {
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
      setSaid({ text: errorText(e, 'Pas possible'), bad: true })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pointer-events-none absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+3.9rem)] left-3 z-20 flex w-[min(15rem,calc(100vw-9rem))] flex-col items-start gap-1.5 lg:top-[6.5rem] lg:left-5">
      <div className="hud pointer-events-auto flex gap-1 rounded-full p-1">
        {amounts.map((a) => (
          <button key={a} onClick={() => setAmount(a)} className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${amount === a ? 'bg-[var(--color-ink)] text-white' : ''}`}>
            {a >= 1000 ? `${a / 1000} 000` : a}
          </button>
        ))}
      </div>
      <button disabled={busy || money < amount} onClick={() => void go()} className="pointer-events-auto flex items-center gap-2 rounded-full py-2.5 pr-4 pl-3 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] transition active:scale-95 disabled:opacity-50" style={{ background: color }}>
        <Banknote size={18} /> {money < amount ? 'Pas assez' : label}
      </button>
      {said && <span className={`hud animate-pop rounded-2xl px-3 py-1.5 text-xs font-bold ${said.bad ? 'text-[#d81b3f]' : ''}`}>{said.text}</span>}
    </div>
  )
}
