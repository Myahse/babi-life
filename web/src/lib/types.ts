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

export type World = {
  cities: City[]
  kinds: Record<string, PlaceKind>
  traits: Option[]
  aspirations: Option[]
  config: { devLogin: boolean; googleLogin: boolean }
}

export type User = { id: string; email: string; name: string; avatarUrl: string; createdAt: string }

export type Look = { skin: string; hair: string; hairColor: string; outfit: string; outfitColor: string }

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
  createdAt: string
}

export type JournalEvent = {
  id: number
  kind: 'interaction' | 'random' | 'travel'
  text: string
  money: number
  gameTime: number
  at: string
}

export type Outcome = { text: string; money: number; random?: { text: string; money: number } }
export type ActionResult = { sim: Sim; outcome: Outcome; journal: JournalEvent[] }
