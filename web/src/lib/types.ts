export type Needs = { hunger: number; energy: number; hygiene: number; social: number; fun: number }
export type NeedKey = keyof Needs

export type Place = { id: string; name: string; kind: string; lat: number; lng: number }
export type Commune = { id: string; name: string; blurb: string; lat: number; lng: number; places: Place[] }
export type City = { id: string; name: string; blurb: string; lat: number; lng: number; zoom: number; communes: Commune[] }

export type Interaction = {
  id: string
  label: string
  icon: string
  minutes: number
  cost: number
  effect: Needs
  minHour?: number
  maxHour?: number
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
  config: { devLogin: boolean; googleLogin: boolean }
}

export type User = { id: string; email: string; name: string; avatarUrl: string; createdAt: string }

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
  trip?: { fromCity: string; fromCommune: string; city: string; commune: string; mode: 'taxi' | 'car'; fare: number; label: string }
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

export type Happening = { id: string; label: string; icon: string; text: string; minHour?: number; maxHour?: number; join?: Interaction }
export type HappeningNow = { happening: Happening | null; start: number; end: number }

export type NewsItem = { id: string; title: string; source: string; link: string; published: string; topic: 'sport' | 'politique' | 'economie' | 'societe' | 'culture' | 'meteo' }
