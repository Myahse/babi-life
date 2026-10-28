import { useEffect, useSyncExternalStore } from 'react'
import { API_BASE } from './env'

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
/** A place's activity is there to do (not waiting for an update). Before the server has answered: held back only if it's one it may hide. */
export const activityOpen = (s: State, id: string) => LAB || (!s.interactions.has(id) && (s.known || !MAYBE_INTERACTIONS.has(id)))
/** An app or a console's mode is there ('app:tikitoko', 'foot11', 'foot-coupe', 'foot-carriere'). */
export const keyOpen = (s: State, key: string) => LAB || (!s.keys.has(key) && (s.known || !MAYBE_KEYS.has(key)))

// What an update may hide (the same as backend features.List): held back while the server's answer hasn't come.
const MAYBE_INTERACTIONS = new Set(['caca', 'pipi', 'vomir', 'pleurer', 'play-foot11', 'console-combat', 'console-course', 'course-kart', 'regarder-kart', 'borne-arcade', 'machine-maquis', 'machine-casino', 'casino-ivoire', 'tournoi-console', 'console-defi', 'street-traverser', 'boutique-mode', 'boutique-wax', 'maison-foot', 'maison-course', 'maison-combat', 'creche'])
const MAYBE_KEYS = new Set(['chat-libre', 'lot-carte', 'foot11', 'foot-coupe', 'foot-carriere', 'historique', 'soiree', 'loto', 'table', 'app:waye', 'app:gbairai', 'app:tikitoko', 'app:babigram', 'app:flashe', 'app:golvo', 'app:dodo', 'app:kineo', 'app:bolide', 'app:gnango', 'app:idrive', 'app:dames', 'app:huit', 'app:awale', 'app:ludo', 'app:bet225', 'app:parisfoot', 'app:bingo', 'app:casino', 'app:gode', 'app:politique', 'postures', 'deco-premium', 'deplacer-meubles', 'console-maison', 'frigo', 'ecole-vivante', 'ami-enfance', 'mentor', 'grandir-vite', 'looks-age', 'pubs-applis', 'jeu'])
