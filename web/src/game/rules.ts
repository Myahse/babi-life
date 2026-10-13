// Mirrors backend/internal/game so the HUD can tick smoothly between server
// round-trips. The server stays authoritative on every action.
import { Droplets, Gamepad2, MessageCircle, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react'
import type { Career, Housing, Interaction, NeedKey, Needs, Sim } from '../lib/types'

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
  const r = it.requires
  if (!r) return null
  if (r.resident && !(sim.homeCity === cityId && sim.homeCommune === communeId && sim.city === cityId && sim.commune === communeId)) return 'Habitants seulement'
  if (r.minMoney && sim.money < r.minMoney) return `Il faut ${amount(r.minMoney)} F`
  if (r.career && sim.career !== r.career) return 'Réservé au personnel'
  if (r.anyTrait?.length && !r.anyTrait.some((t) => sim.traits.includes(t))) return 'Pas ton caractère'
  return null
}

export const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} F`
export const amount = (n: number) => n.toLocaleString('fr-FR')

export function duration(minutes: number) {
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
function km(a: Pt, b: Pt) {
  const r = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/** A private ride inside a city (mirrors world.RideQuote): dearer than the taxi, quicker. */
export function rideQuote(taxi: { minutes: number; fare: number }) {
  return { minutes: Math.round(taxi.minutes * 0.7), fare: Math.max(1000, Math.round((taxi.fare * 3) / 100) * 100) }
}

export function trip(fromCity: string, from: Pt & { id: string }, toCity: string, to: Pt & { id: string }) {
  const d = km(from, to)
  if (fromCity === toCity) {
    if (from.id === to.id) return { minutes: 0, fare: 0, mode: 'sur place' }
    return { minutes: 20 + Math.trunc(d * 4), fare: 300 + 50 * Math.trunc(d / 3), mode: 'woro-woro' }
  }
  const road = d * 1.3
  return { minutes: Math.trunc(road) + 30, fare: Math.max(500, Math.round(road * 25 / 500) * 500), mode: 'car' }
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
