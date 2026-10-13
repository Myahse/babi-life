import type { RoadNet } from '../game/roads'
export type Needs = { hunger: number; energy: number; hygiene: number; social: number; fun: number }
export type NeedKey = keyof Needs

/** Where a fact comes from: verified, partial, unverified, or invented for the game. */
export type Source = { status: 'verified' | 'partial' | 'unverified' | 'fictional'; urls?: string[]; checked?: string; note?: string }
export type Place = {
  id: string
  name: string
  kind: string
  lat: number
  lng: number
  quarter?: string
  real?: boolean
  approx?: boolean
  owner?: string
  operator?: string
  closed?: string
  source?: Source
}
export type Commune = {
  id: string
  name: string
  blurb: string
  lat: number
  lng: number
  admin?: { type: string; parent: string; mairie: string; bank?: 'nord' | 'sud'; source?: Source }
  /** Colour of the commune's woro-woro (Abidjan); none = there aren't any. */
  woro?: Woro
  places: Place[]
}
export type Woro = { color?: string; trim?: string; label?: string; none?: boolean; source: Source }
export type City = { id: string; name: string; blurb: string; lat: number; lng: number; zoom: number; admin?: { type: string; region?: string; source?: Source }; communes: Commune[] }
/** A ride-hailing app: "fixed" sets the price, "offer" lets you propose it. */
export type RideApp = { id: string; name: string; model: 'fixed' | 'offer'; cities: string[]; source: Source }
/** Booking a ride app instead of the shared taxi; offer = the fare proposed. */
export type Ride = { app?: string; offer?: number; party?: number }
/** taxi = a town's taxi (or an older trip); yango/indrive = older trips. */
export type TripMode = 'woro' | 'compteur' | 'taxi' | 'car' | 'gnango' | 'idrive' | 'yango' | 'indrive'
export type Expression = { id: string; text: string; lang: string; meaning: string; example: string; context?: string; source: Source }

export type Interaction = {
  id: string
  label: string
  icon: string
  minutes: number
  cost: number
  effect: Needs
  minHour?: number
  maxHour?: number
  /** Opening days, 0 = lundi … 6 = dimanche; absent = every day. */
  days?: number[]
  requires?: { resident?: boolean; minMoney?: number; anyTrait?: string[]; career?: string }
}
export type PlaceKind = { id: string; label: string; icon: string; interactions: Interaction[] }
export type Option = { id: string; label: string; icon: string; hint: string }

export type Origin = Option & { money: number; loan: number; housing: string }
export type Housing = Option & { rent: number; comfort: number }
export type Career = {
  id: string
  label: string
  icon: string
  kind: string
  levels: { title: string; pay: number }[]
  minHour: number
  maxHour: number
  minutes: number
  effect: Needs
}

export type World = {
  cities: City[]
  kinds: Record<string, PlaceKind>
  traits: Option[]
  aspirations: Option[]
  origins: Origin[]
  housings: Housing[]
  careers: Career[]
  expressions?: Expression[]
  rideApps?: RideApp[]
  compteur?: { color: string; cities: string[]; source: Source }
  roads?: Record<string, RoadNet>
  config: { devLogin: boolean; googleLogin: boolean }
}

export type User = { id: string; email: string; name: string; firstName: string; lastName: string; username: string; avatarUrl: string; createdAt: string }

export type Look = {
  skin: string
  hair: string
  hairColor: string
  outfit: string
  outfitColor: string
  body?: string
  height?: number
  eyes?: string
  beard?: string
  accessory?: string
  pattern?: string
  // Per-part colours; empty means the outfit's own colour.
  bottomColor?: string
  shoeColor?: string
  accessoryColor?: string
  marks?: string // bumps and bruises: none, pansement, griffures, genou, bagarre
}

export type Sim = {
  id: string
  firstName: string
  lastName: string
  gender: 'femme' | 'homme'
  look: Look
  traits: string[]
  aspiration: string
  homeCity: string
  homeCommune: string
  city: string
  commune: string
  needs: Needs
  money: number
  gameMinutes: number
  origin: string
  housing: string
  loan: number
  rentArrears: number
  career: string
  careerLevel: number
  performance: number
  /** What the Sim is busy with right now (real time), or null. */
  activity: Activity | null
  createdAt: string
}

export type Activity = {
  kind: 'do' | 'travel'
  placeId?: string
  placeKind?: string
  placeName?: string
  interaction: Interaction
  /** Game minutes = real minutes since 2024-01-01 00:00 UTC (Abidjan time). */
  start: number
  end: number
  applied: number
  career?: string
  trip?: { fromCity: string; fromCommune: string; city: string; commune: string; mode: TripMode; fare: number; label: string; incident?: string; path?: [number, number][]; bridges?: string[]; party?: number }
}

export type JournalEvent = {
  id: number
  kind: 'interaction' | 'random' | 'travel' | 'bill' | 'career'
  text: string
  money: number
  gameTime: number
  at: string
}

export type Outcome = { text: string; money: number }
/** Every read or action on a Sim returns this; `fresh` = journal lines this request produced. */
export type ActionResult = { sim: Sim; outcome: Outcome; journal: JournalEvent[]; fresh: JournalEvent[] }

export type Happening = { id: string; label: string; icon: string; text: string; category?: string; minHour?: number; maxHour?: number; days?: number[]; join?: Interaction; source?: Source }
export type HappeningNow = { happening: Happening | null; start: number; end: number }

export type NewsItem = { id: string; title: string; source: string; link: string; published: string; topic: 'sport' | 'politique' | 'economie' | 'societe' | 'culture' | 'meteo' }
