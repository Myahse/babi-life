// Mirrors backend/internal/game so the HUD can tick smoothly between server
// round-trips. The server stays authoritative on every action.
import { Droplets, Gamepad2, MessageCircle, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react'
import type { Career, Housing, Interaction, NeedKey, Needs, Sim, World } from '../lib/types'
import { routeIn, type LngLat, type Path } from './roads'

export const NEEDS: { key: NeedKey; label: string; icon: LucideIcon }[] = [
  { key: 'hunger', label: 'Faim', icon: UtensilsCrossed },
  { key: 'energy', label: 'Énergie', icon: Zap },
  { key: 'hygiene', label: 'Hygiène', icon: Droplets },
  { key: 'social', label: 'Social', icon: MessageCircle },
  { key: 'fun', label: 'Loisirs', icon: Gamepad2 },
]

const DECAY_PER_HOUR: Needs = { hunger: 4, energy: 3, hygiene: 3, social: 2.5, fun: 3 }

export function decay(n: Needs, minutes: number): Needs {
  const out = { ...n }
  for (const k of Object.keys(DECAY_PER_HOUR) as NeedKey[]) {
    out[k] = Math.max(0, Math.min(100, n[k] - (DECAY_PER_HOUR[k] * minutes) / 60))
  }
  return out
}

/** Mirrors game.IdleFloor: left alone, needs stop dropping here. */
export const IDLE_FLOOR = 8

/** Needs `minutes` after the server's snapshot, on the real clock. */
export function predict(sim: Sim, minutes: number): Needs {
  const a = sim.activity
  if (!a) {
    const d = decay(sim.needs, minutes)
    for (const k of Object.keys(d) as NeedKey[]) d[k] = Math.max(d[k], Math.min(sim.needs[k], IDLE_FLOOR))
    return d
  }
  const now = sim.gameMinutes + minutes
  const span = Math.max(1, a.end - a.start)
  const share = Math.min(1, Math.max(0, (Math.min(now, a.end) - a.start) / span)) - a.applied
  const effect = a.kind === 'travel' ? { hunger: 0, energy: -span / 30, hygiene: 0, social: 0, fun: 0 } : a.interaction.effect
  const out = decay(sim.needs, minutes)
  for (const k of Object.keys(out) as NeedKey[]) out[k] = Math.max(0, Math.min(100, out[k] + (effect[k] ?? 0) * Math.max(0, share)))
  return out
}

export const mood = (n: Needs) => (n.hunger + n.energy + n.hygiene + n.social + n.fun) / 5


/** Game minutes are real minutes since 2024-01-01 00:00 UTC, which is Abidjan time (UTC+0). */
export const EPOCH = Date.UTC(2024, 0, 1)
export const minuteOf = (ms: number) => Math.floor((ms - EPOCH) / 60000)

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function clock(gameMinutes: number) {
  const d = new Date(EPOCH + gameMinutes * 60000)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const weekday = DAYS[d.getUTCDay()]
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  return { weekday, date, time, hour: h, isNight: h < 6 || h >= 19, stamp: `${weekday} ${date} · ${time}` }
}

export function available(it: Interaction, hour: number) {
  if (!it.minHour && !it.maxHour) return true
  const min = it.minHour ?? 0
  const end = it.maxHour || 24
  return min < end ? hour >= min && hour < end : hour >= min || hour < end
}

/** 0 = lundi … 6 = dimanche (the epoch is a Monday). */
export const weekdayOf = (gameMinutes: number) => Math.floor(gameMinutes / (24 * 60)) % 7
const DAY_SHORT = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

/** Open at this game minute: the right hour and, if it has opening days, the right day. */
export function openAt(it: Interaction, gameMinutes: number) {
  if (!available(it, Math.floor(gameMinutes / 60) % 24)) return false
  return !it.days?.length || it.days.includes(weekdayOf(gameMinutes))
}

/** "08h–16h · lun–ven" */
export function openingLabel(it: Interaction) {
  const h = it.minHour || it.maxHour ? hours(it) : ''
  const d = it.days?.length ? daysLabel(it.days) : ''
  return [h, d].filter(Boolean).join(' · ') || 'fermé'
}

export function daysLabel(days: number[]) {
  const s = [...days].sort((a, b) => a - b)
  const run = s.every((d, i) => i === 0 || d === s[i - 1] + 1)
  return run && s.length > 2 ? `${DAY_SHORT[s[0]]}–${DAY_SHORT[s[s.length - 1]]}` : s.map((d) => DAY_SHORT[d]).join(', ')
}

/** Why this Sim can't do it (mirrors game.Requirement.Check), or null. */
export function blockedBy(it: Interaction, sim: Sim, cityId: string, communeId: string): string | null {
  if (it.fed && sim.needs.hunger < FED_HUNGER) return "Mange d'abord"
  const r = it.requires
  if (!r) return null
  if (r.resident && !(sim.homeCity === cityId && sim.homeCommune === communeId && sim.city === cityId && sim.commune === communeId)) return 'Habitants seulement'
  if (r.minMoney && sim.money < r.minMoney) return `Il faut ${amount(r.minMoney)} Djai`
  if (r.career && sim.career !== r.career) return 'Réservé au personnel'
  if (r.anyTrait?.length && !r.anyTrait.some((t) => sim.traits.includes(t))) return 'Pas ton caractère'
  return null
}

/** How full the tummy must be for what comes after a meal (mirrors game.FedHunger). */
export const FED_HUNGER = 40

export const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} Djai`
export const amount = (n: number) => n.toLocaleString('fr-FR')

/** The longest an action takes, in real minutes (game/realtime.go MaxAction). */
export const MAX_ACTION = 8
/**
 * How many real minutes an action takes, from its length in the catalog
 * (game/realtime.go Length): a shower of 20 min takes 1, the zoo's 2 h take
 * 4, a shift or a night's sleep 8.
 */
export const actionLength = (m: number) => (m <= 30 ? Math.max(1, Math.ceil(m / 20)) : Math.min(MAX_ACTION, 2 + Math.floor(m / 60)))

export function duration(minutes: number) {
  // What's left of something under way is fractional: to the nearest minute, never « 0 min » while it lasts.
  minutes = minutes > 0 ? Math.max(1, Math.round(minutes)) : 0
  if (minutes < 60) return `${minutes} min`
  if (minutes >= 24 * 60) {
    const d = Math.floor(minutes / 1440)
    const h = Math.floor((minutes % 1440) / 60)
    return h ? `${d} j ${h} h` : `${d} j`
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m}` : `${h} h`
}

// Mirrors world.Trip on the server, for the "Y aller" estimate.
type Pt = { lat: number; lng: number }
export function km(a: Pt, b: Pt) {
  const r = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/**
 * The 3e pont's toll (mirrors world.TollOf): 500 F a car when it opened; taxi
 * drivers pass it on. A woro-woro seat carries a fifth of it, a compteur or
 * an app ride all of it.
 */
export const HKB_TOLL = 500
export const TOLL_SEATS = 5
export const tollOf = (bridges?: string[]) => (bridges?.includes('3e pont') ? HKB_TOLL : 0)
/** A car's fare from the seat fare: the seat's share of the toll out, the whole toll on top. */
export const withToll = (seat: number, toll: number, times: number, min: number, round: number) => Math.max(min, Math.round(((seat - toll / TOLL_SEATS) * times) / round) * round) + toll

/** A private ride inside a city (mirrors world.RideQuote): dearer than the taxi, quicker. */
export function rideQuote(taxi: { minutes: number; fare: number; toll?: number }) {
  return { minutes: Math.round(taxi.minutes * 0.7), fare: withToll(taxi.fare, taxi.toll ?? 0, 3, 1000, 100) }
}

/**
 * Minutes, fare and the way a trip goes. Mirrors world.TripPath: on the city's
 * roads and over its bridges when it has a road network; trips are shortened
 * for the game (minutes across Abidjan, under an hour up country).
 */
export function trip(fromCity: string, from: Pt & { id: string }, toCity: string, to: Pt & { id: string }, world?: World) {
  const d = km(from, to)
  if (fromCity === toCity) {
    if (from.id === to.id) return { minutes: 0, fare: 0, toll: 0, mode: 'sur place', path: null as Path | null }
    const path = (world && routeIn(world, fromCity, from.id, to.id)) || { points: [[from.lng, from.lat], [to.lng, to.lat]] as LngLat[], km: Math.round(d * 12.5) / 10, bridges: [] }
    const toll = tollOf(path.bridges)
    return { minutes: Math.round(2 + path.km * 0.6) + path.bridges.length, fare: 300 + 50 * Math.trunc(path.km / 3) + toll / TOLL_SEATS, toll, mode: 'woro-woro', path }
  }
  const road = d * 1.3
  return { minutes: 10 + Math.trunc(road / 12), fare: Math.max(500, Math.round(road * 25 / 500) * 500), toll: 0, mode: 'car', path: null as Path | null }
}

// Mirrors backend/internal/game/economy.go.
export const DEPOSIT_WEEKS = 2
export const LOAN_INSTALLMENT = 10000
export const PERFORMANCE_TO_PROMOTE = 10
export const neededToPromote = (level: number) => PERFORMANCE_TO_PROMOTE * (level + 1)

/** The work interaction for a career level, as the server builds it. */
export function shift(c: Career, level: number): Interaction {
  const l = c.levels[level]
  return { id: 'work', label: `Aller au travail (${l.title})`, icon: c.icon, minutes: c.minutes, cost: -l.pay, effect: c.effect, minHour: c.minHour, maxHour: c.maxHour }
}

/** Home interactions are better in a nicer home. */
export function atHome(it: Interaction, h: Housing): Interaction {
  const effect = { ...it.effect }
  for (const k of Object.keys(effect) as NeedKey[]) if (effect[k] > 0) effect[k] = Math.round(effect[k] * h.comfort)
  return { ...it, effect }
}

/** Game minutes until rent is due (00:00 next Saturday). */
export function untilSaturday(gameMinutes: number) {
  const week = 7 * 1440
  const sat = 5 * 1440
  const into = (((gameMinutes - sat) % week) + week) % week
  return week - into
}

export function hours(it: { minHour?: number; maxHour?: number }) {
  return `${String(it.minHour ?? 0).padStart(2, '0')}h–${String(it.maxHour || 24).padStart(2, '0')}h`
}

/** A Sim's age in years and stage of life (mirrors game.AgeAt / StageOf). */
/**
 * A Sim's age in years (mirrors game.AgeAt): childhood goes fast, along the
 * world's growUp points (minutes of play at each age); then a year is yearMinutes.
 */
export function ageOf(world: World, bornAt: number, gameMinutes: number) {
  if (!bornAt) return 25
  const t = Math.max(0, gameMinutes - bornAt)
  const pts = world.growUp ?? [[0, 0]] // an older API: a year is yearMinutes from birth
  const [lastAge, lastAt] = pts[pts.length - 1]
  if (t >= lastAt) return lastAge + Math.floor((t - lastAt) / (world.yearMinutes ?? 480))
  for (let i = pts.length - 2; i >= 0; i--) {
    const [a, at] = pts[i]
    const [b, bt] = pts[i + 1]
    if (t >= at) return Math.floor(a + ((t - at) * (b - a)) / (bt - at))
  }
  return 0
}

/** Childhood's time left before a stage (« enfant », « adulte »), in minutes; 0 when there. */
export function minutesTill(world: World, sim: Pick<Sim, 'bornAt' | 'gameMinutes'>, stage: string) {
  const from = world.stages?.find((s) => s.id === stage)?.from ?? 18
  if (!sim.bornAt) return 0
  return Math.max(0, Math.ceil(sim.bornAt + minutesToAge(world, from) - sim.gameMinutes))
}

/** How many minutes after birth a Sim turns `age` (mirrors game.MinutesToAge). */
export function minutesToAge(world: World, age: number) {
  const pts = world.growUp ?? [[0, 0]]
  const [lastAge, lastAt] = pts[pts.length - 1]
  if (age >= lastAge) return lastAt + (age - lastAge) * (world.yearMinutes ?? 480)
  for (let i = 1; i < pts.length; i++) {
    const [a, at] = pts[i - 1]
    const [b, bt] = pts[i]
    if (age <= b) return at + ((age - a) * (bt - at)) / (b - a)
  }
  return 0
}

export function lifeOf(world: World, sim: Pick<Sim, 'bornAt' | 'gameMinutes'>) {
  const stages = world.stages ?? []
  const age = ageOf(world, sim.bornAt ?? 0, sim.gameMinutes)
  const stage = [...stages].reverse().find((s) => age >= s.from) ?? stages[stages.length - 1]
  return { age, stage, minor: age < 18 }
}

const AGE_ORDER = ['bebe', 'enfant', 'ado', 'adulte']
/** Why this stage of life can't do it (mirrors Interaction.AllowedFor). */
export function ageBlock(it: Interaction, stage?: string) {
  if (!stage) return null
  const ages = it.ages?.length ? it.ages : ['enfant', 'ado', 'adulte']
  if (ages.includes(stage)) return null
  return AGE_ORDER.indexOf(stage) < AGE_ORDER.indexOf(ages[0]) ? 'Trop jeune pour ça' : "Plus de ton âge"
}

/** One's own house (game/house.go): no rent, as comfortable as what is in it. */
export const OWN_HOUSE = 'maison'

/**
 * The home a Sim lives in (game/plans.go HomePlanFor): its family's own while
 * it still has the family's housing (a shack for the gnambro, the grande villa
 * for the debout), else its housing's; none in the house it built.
 */
export function homePlanFor(world: World, sim: Sim) {
  if (sim.housing === OWN_HOUSE || !world.homePlans || !world.homeFor) return undefined
  const fam = world.families?.find((f) => f.id === sim.family)
  const id = (fam && fam.housing === sim.housing && world.homeFor.family[fam.id]) || world.homeFor.housing[sim.housing]
  return id ? world.homePlans[id] : undefined
}
/** The basics make a house up to 1.35; the finer pieces (a tier up) add on top, up to 1.5 (game/house.go HomeComfort). */
export function homeComfort(world: World, furnished: string[] = []) {
  let [c, fine] = [0.75, 0]
  for (const id of furnished) {
    const f = world.furniture?.find((x) => x.id === id)
    if (!f) continue
    if (f.tier) fine += f.comfort
    else c += f.comfort
  }
  return Math.round((Math.min(1.35, c) + Math.min(0.15, fine)) * 100) / 100
}
/** Where the Sim lives: a rented tier, or the house it built. */
export function housingOf(world: World, sim: Pick<Sim, 'housing' | 'furnished'>): Housing {
  if (sim.housing === OWN_HOUSE) return { id: OWN_HOUSE, label: 'Ma maison', icon: 'house', hint: 'La maison que tu as bâtie sur ton terrain. Pas de loyer : tu es chez toi.', rent: 0, comfort: homeComfort(world, sim.furnished) }
  return world.housings.find((h) => h.id === sim.housing) ?? world.housings[0]
}
/** In one's own house, the furniture a home activity needs and is missing ('' when nothing). */
export function homeLacks(world: World, sim: Pick<Sim, 'housing' | 'furnished'>, interaction: string) {
  // The console's games: only in one's own house, on its console.
  if (sim.housing !== OWN_HOUSE) return interaction.startsWith('maison-') ? 'une console, dans ta propre maison' : ''
  const pieces = (world.furniture ?? []).filter((f) => f.unlocks?.includes(interaction))
  return pieces.length && !pieces.some((f) => sim.furnished?.includes(f.id)) ? pieces[0].label : ''
}
