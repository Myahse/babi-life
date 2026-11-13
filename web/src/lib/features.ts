import { useEffect, useSyncExternalStore } from 'react'
import { API_BASE } from './env'
import { englishOpen, lang } from './i18n'

// The game's updates (backend features/): the features the team opens one by
// one from the admin (« Mises à jour »). Until then they're hidden: the
// place's activities they bring (`interactions`), the phone's apps and the
// console's modes (`keys`: 'app:tikitoko', 'foot11'…). Asked when the game
// opens and every minute after; while it isn't known, everything listed is
// hidden (a closed feature never shows by mistake).

export type FeatureNews = { id: string; label: string; about: string; at: string }
type State = { known: boolean; closed: Set<string>; interactions: Set<string>; keys: Set<string>; news: FeatureNews[]; /** The server says the game is open to everyone (an older server says nothing: shut). */ game?: boolean; /** When the game opens to everyone, set and not yet come (ISO). */ opening?: string }

let state: State = { known: false, closed: new Set(), interactions: new Set(), keys: new Set(), news: [] }
const listeners = new Set<() => void>()
let asking: Promise<void> | null = null
let last = 0

async function ask() {
  try {
    const res = await fetch(`${API_BASE}/features`)
    if (!res.ok) return
    const d = (await res.json()) as { closed: string[]; interactions: string[]; keys: string[]; new: FeatureNews[]; opening?: string; game?: boolean }
    state = { known: true, closed: new Set(d.closed), interactions: new Set(d.interactions), keys: new Set(d.keys), news: d.new ?? [], opening: d.opening, game: d.game === true }
    last = Date.now()
    englishOpen(!state.keys.has('anglais'))
    // Kept for the next opening: how the game starts can't wait for this answer.
    try {
      localStorage.setItem(FAST_HEARD, keyOpen(state, FAST) ? '1' : '0')
    } catch {
      // Private mode: as the server says, once it has.
    }
    listeners.forEach((f) => f())
  } catch {
    // No network: as it was.
  }
}
/** Asks the server again (at most once a minute). */
export function refreshFeatures() {
  if (asking || Date.now() - last < 60_000) return asking
  asking = ask().finally(() => (asking = null))
  return asking
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => void listeners.delete(f)
}
/** The updates as known now (asked again every minute while something listens). */
export function useFeatures() {
  const s = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    void refreshFeatures()
    const t = setInterval(() => void refreshFeatures(), 60_000)
    return () => clearInterval(t)
  }, [])
  return s
}

// The labs (city.html) show everything: they're for looking at the features, open or not.
const LAB = typeof location !== 'undefined' && location.pathname.endsWith('city.html')
// In a lab page, ?open=a,b and ?shut=c force updates open or shut (to look at both sides).
const LAB_Q = typeof location !== 'undefined' && /\/(city|avatar|lab|poster)\.html$/.test(location.pathname) ? new URLSearchParams(location.search) : null
const FORCED_OPEN = new Set(LAB_Q?.get('open')?.split(',') ?? [])
const FORCED_SHUT = new Set(LAB_Q?.get('shut')?.split(',') ?? [])
/** A place's activity is there to do (not waiting for an update). Before the server has answered: held back only if it's one it may hide. */
export const activityOpen = (s: State, id: string) => LAB || (!s.interactions.has(id) && (s.known || !(MAYBE_INTERACTIONS.has(id) || id.startsWith(EVENT_CHOICE))))
/** An app or a console's mode is there ('app:tikitoko', 'foot11', 'foot-coupe', 'foot-carriere'). */
export const keyOpen = (s: State, key: string) => !FORCED_SHUT.has(key) && (FORCED_OPEN.has(key) || LAB || (!s.keys.has(key) && (s.known || !MAYBE_KEYS.has(key))))

/**
 * One update's key, open or not, for what draws often (every Sim asks): it only listens, re-renders
 * when that key changes, and leaves asking the server to useFeatures.
 */
export function useKeyOpen(key: string) {
  return useSyncExternalStore(subscribe, () => keyOpen(state, key))
}
/** The same, now, outside React (a still picture's cache). */
export const keyOpenNow = (key: string) => keyOpen(state, key)
/** The server has answered at least once (before that, a key it may hide reads as shut). */
export const featuresKnown = () => state.known
/** Called each time the server's answer comes (outside React: lib/lightPhone.ts). */
export const onFeatures = subscribe

/** The language choice is shown (the update « anglais » open, or already in English: the way back to French). */
export function useLangChoice() {
  return keyOpen(useFeatures(), 'anglais') || lang() === 'en'
}

/** Yamoussoukro's and Bouaké's activities (the updates « yakro-vivant », « bouake-vivant »: backend game/villes.go). */
const VILLES = ['basilique-visite', 'basilique-esplanade', 'basilique-cierge', 'mosquee-yakro-visite', 'caimans-nourrir', 'caimans-repas', 'lac-tour', 'fondation-visite', 'fondation-conference', 'resident-panorama', 'golf-parcours', 'golf-practice', 'golf-club-house', 'braise-kedjenou', 'braise-choukouya', 'marche-bouake-kita', 'marche-bouake-igname', 'jardin-animaux', 'nourrir-autruches', 'lodge-terrasse', 'lodge-feu', 'safari-4x4', 'safari-pied', 'nzi-pirogue', 'nzi-oiseaux', 'allocodrome-alloco', 'airfrance-zouglou']
/** San-Pédro's and Korhogo's activities (the updates « sanpedro-vivant », « korhogo-vivant »: backend game/villes2.go). */
const VILLES2 = ['port-grue-cacao', 'port-visite', 'port-cargos', 'peche-pirogue', 'peche-criee', 'peche-filets', 'peche-fume', 'bardot-ambiance', 'bardot-garba', 'sp-cathedrale-visite', 'monogaga-paillote', 'monogaga-rouleaux', 'sirenes-tortues', 'sirenes-crique', 'campement-langouste', 'merou-capitaine', 'merou-crabes', 'cargo-nuit', 'tai-excursion', 'tai-hana', 'waraniene-tisser', 'waraniene-pagne', 'waraniene-coton', 'fakaha-peindre', 'fakaha-toile', 'koni-forge', 'koni-daba', 'poro-oree', 'poro-fromagers', 'mont-korhogo-monter', 'mont-mangues', 'mont-coucher', 'korhogo-toile-marche', 'korhogo-cajou', 'korhogo-mosquee-visite', 'to-gombo', 'to-tchapalo', 'to-balafon', 'balafon-nuit']
/** Man's and Daloa's activities (the updates « man-vivant », « daloa-vivant »: backend game/villes3.go). */
const VILLES3 = ['dent-monter', 'dent-pique-nique', 'tonkpi-belvedere', 'tonkpi-brume', 'cascade-baigner', 'cascade-bambous', 'gbepleu-singes', 'gbepleu-respect', 'masques-spectacle', 'masques-tam-tam', 'masques-sculpteurs', 'masques-acheter', 'man-marche-cafe', 'man-marche-banane', 'man-cafe-cueillir', 'man-cafe-secher', 'man-cafe-gouter', 'lianes-traverser', 'lianes-histoire', 'dent-sauce-feuille', 'dent-bangui', 'sommet-nuit', 'brume-terrasse', 'brume-matin', 'daloa-balances', 'daloa-marche-vivres', 'plantation-cacao', 'plantation-secher', 'plantation-bangui', 'lobo-pirogue', 'lobo-nasses', 'bete-danse', 'bete-ziglibithy', 'bete-tohourou', 'bete-funerailles', 'daloa-cathedrale-visite', 'daloa-mosquee-visite', 'cabosse-sauce-graine', 'cabosse-planteurs', 'zigli-nuit', 'antilope-piscine', 'paix-cafe-touba', 'rond-point-alloco', 'zone-decharger', 'stade-daloa-match']
/** L'armée (backend game/armee.go ArmeeInteractions): the caserne's and the EMPT's actions. */
export const ARMEE = ['service-engager', 'armee-engager', 'caserne-couleurs', 'caserne-parcours', 'caserne-garde', 'caserne-marche', 'caserne-ordinaire', 'caserne-douche', 'caserne-dortoir', 'service-quitter', 'empt-concours-ecrit', 'empt-concours-physique', 'empt-rassemblement', 'empt-cours', 'empt-atelier', 'empt-sport', 'empt-refectoire', 'empt-douche', 'empt-dortoir', 'empt-quitter']
// What an update may hide (the same as backend features.List, with the old activities an open update replaces: Bassam's 'beach-volley'): held back while the server's answer hasn't come.
const MAYBE_INTERACTIONS = new Set(['console-storm', 'play-tennis', 'hotel-tennis', 'play-volley', 'play-beach-volley', 'beach-volley', 'jouets', 'premier-mot', 'coucou', 'cubes', 'premiers-pas', 'caca', 'pipi', 'vomir', 'pleurer', 'play-foot11', 'console-combat', 'console-course', 'course-kart', 'regarder-kart', 'borne-arcade', 'machine-maquis', 'machine-casino', 'casino-ivoire', 'tournoi-console', 'console-defi', 'street-traverser', 'boutique-mode', 'boutique-wax', 'maison-foot', 'maison-course', 'maison-combat', 'creche', 'bagarre-bebe', 'regler-circulation', 'aider-maison', 'chasser-chauves-souris', 'faire-menage', 'miroir-discours', 'pompes', 'footing', 'jouer-balafon', 'jouer-dames', 'bricoler', 'cuisiner-kedjenou', 'concert-salon', 'entrainement-intense', ...VILLES, ...VILLES2, ...VILLES3, 'carrefour-rdv', 'carrefour-garba', 'carrefour-credit', 'carrefour-regarder', 'prefecture-legalisation', 'prefecture-ceremonie', ...ARMEE])
/** The street happenings' choices (« evenements-joues », backend game.EventChoicePrefix): all of them may be hidden. */
const EVENT_CHOICE = 'evt-'
const MAYBE_KEYS = new Set(['yakro-vivant', 'bouake-vivant', 'sanpedro-vivant', 'korhogo-vivant', 'man-vivant', 'daloa-vivant', 'tennis', 'volley', 'chat-libre', 'gestes-maison', 'trajet-court', 'lot-carte', 'foot11', 'foot-coupe', 'foot-carriere', 'historique', 'soiree', 'loto', 'table', 'app:waye', 'app:gbairai', 'app:tikitoko', 'app:babigram', 'app:flashe', 'app:golvo', 'app:dodo', 'app:kineo', 'app:bolide', 'app:gnango', 'app:idrive', 'app:dames', 'app:huit', 'app:awale', 'app:ludo', 'app:bet225', 'app:parisfoot', 'app:bingo', 'app:casino', 'app:gode', 'app:politique', 'postures', 'deco-premium', 'deplacer-meubles', 'console-maison', 'frigo', 'ecole-vivante', 'ami-enfance', 'mentor', 'grandir-vite', 'looks-age', 'pubs-applis', 'gbairai-bebe', 'frais-operateur', 'arrivee', 'famille-liste', 'ambiance-sonore', 'bebe-jeux', 'bapteme', 'creche-ensemble', 'sonnerie-gbairai', 'sons-bebe', 'premieres-fois', 'choix-bebe', 'bagarre-bebe', 'combat-joueurs', 'repondre-message', 'gbairai-parents', 'parrainage', 'foot-de-rue', 'basket-de-rue', 'basket-palais', 'jeu', 'circulation', 'ville-vivante', 'soiree-deco', 'evenements-joues', 'jeux-en-ligne', 'anglais', 'paiement-google', 'voyages-villes', 'app:airlagune', 'plateau-vivant', 'sims-detailles', 'demandes', 'rue-vivante-gestes', 'storm', 'maison-v2', 'mode-vie', 'ecran-simple', 'pnj-vivants', 'demarrage-rapide', 'rendez-vous', 'camera-vie', 'communes-detail', 'papiers', 'ma-voiture', 'telephone-leger', 'armee'])

/** The update « demarrage-rapide »: a lighter start (the sign-in without waiting for the world, the game's screen before the street's 3D, the players online on the home page). */
const FAST = 'demarrage-rapide'
const FAST_HEARD = 'babi.fast'
/** Open as the server says, or, before it has answered, as it said the last time (the start can't wait for its answer). */
export function fastStartOpen() {
  if (state.known) return keyOpen(state, FAST)
  try {
    return localStorage.getItem(FAST_HEARD) === '1'
  } catch {
    return false
  }
}
/** The same, followed (and the server asked, at most once a minute). */
export function useFastStart() {
  const open = useSyncExternalStore(subscribe, fastStartOpen)
  useEffect(() => void refreshFeatures(), [])
  return open
}
