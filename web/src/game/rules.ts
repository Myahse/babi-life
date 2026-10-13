// Mirrors backend/internal/game so the HUD can tick smoothly between server
// round-trips. The server stays authoritative on every action.
import { Droplets, Gamepad2, MessageCircle, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react'
import type { Interaction, NeedKey, Needs } from '../lib/types'

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

export const mood = (n: Needs) => (n.hunger + n.energy + n.hygiene + n.social + n.fun) / 5


export function clock(gameMinutes: number) {
  const day = Math.floor(gameMinutes / 1440) + 1
  const h = Math.floor((gameMinutes % 1440) / 60)
  const m = Math.floor(gameMinutes % 60)
  const weekday = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][(day - 1) % 7]
  return { day, weekday, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, hour: h, isNight: h < 6 || h >= 19 }
}

export function available(it: Interaction, hour: number) {
  if (!it.minHour && !it.maxHour) return true
  const min = it.minHour ?? 0
  const end = it.maxHour || 24
  return min < end ? hour >= min && hour < end : hour >= min || hour < end
}

export const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} F`
export const amount = (n: number) => n.toLocaleString('fr-FR')

export function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
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

export function trip(fromCity: string, from: Pt & { id: string }, toCity: string, to: Pt & { id: string }) {
  const d = km(from, to)
  if (fromCity === toCity) {
    if (from.id === to.id) return { minutes: 0, fare: 0, mode: 'sur place' }
    return { minutes: 20 + Math.trunc(d * 4), fare: 300 + 50 * Math.trunc(d / 3), mode: 'woro-woro' }
  }
  const road = d * 1.3
  return { minutes: Math.trunc(road) + 30, fare: Math.max(500, Math.round(road * 25 / 500) * 500), mode: 'car' }
}
