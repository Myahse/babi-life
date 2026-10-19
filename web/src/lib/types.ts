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
  /** What the map calls it (pitch, basketball, swimming_pool…), for places from the map. */
  type?: string
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
/** An app of the phone's store (invented names, modelled on real services). */
export type PhoneApp = { id: string; name: string; tagline: string; about: string; category: string; sizeMB: number; preinstalled?: boolean; source: Source }
/** Someone to send money to with Waye. */
export type Contact = { id: string; name: string; note: string; effect: Partial<Needs> }
/** A dish on Golvo. */
export type Dish = { id: string; label: string; icon: string; price: number; minutes: number; effect: Partial<Needs>; minHour?: number; maxHour?: number }
export type Woro = { color?: string; trim?: string; label?: string; none?: boolean; source: Source }
export type City = { id: string; name: string; blurb: string; lat: number; lng: number; zoom: number; admin?: { type: string; region?: string; source?: Source }; communes: Commune[] }
/** A ride-hailing app: "fixed" sets the price, "offer" lets you propose it. */
export type RideApp = { id: string; name: string; model: 'fixed' | 'offer'; cities: string[]; source: Source; classes?: RideClass[] }
/** A kind of car on an app (Éco, Confort, Confort+): dearer and longer to come as it gets better. */
export type RideClass = { id: string; name: string; factor: number; wait: number; cars: string; perks: string; effect: Partial<Record<'hunger' | 'energy' | 'hygiene' | 'social' | 'fun', number>> }
/** Booking a ride app instead of the shared taxi; offer = the fare proposed; class = the kind of car. */
export type Ride = { app?: string; class?: string; offer?: number; party?: number }
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
  /** Life stages that can do it; empty = from childhood up. */
  ages?: string[]
}
export type PlaceKind = { id: string; label: string; icon: string; interactions: Interaction[] }
export type Option = { id: string; label: string; icon: string; hint: string }

export type Origin = Option & { money: number; loan: number; housing: string }
/** The family a Sim is born into: debout, laté, lagnon, poignon, coulé, gnambro. */
export type Family = { id: string; label: string; icon: string; hint: string; /** The kind of neighbourhood, found in every commune. */ sector: string; housing: string; pocket: number; start: number; leave: string; bacGift: number; weight: number }
/** Someone the Sim knows. */
export type Friend = { id: string; name: string; gender: 'femme' | 'homme'; seed: number; commune: string; friendship: number; gang?: boolean; met: number; seen: number }
/** Another player's Sim, as others see it. */
export type Player = {
  id: string
  firstName: string
  username: string
  gender: 'femme' | 'homme'
  look: Look
  stage: LifeStage['id']
  activity?: { placeId: string; placeName: string; interactionId: string; label: string; icon: string; joinable: boolean }
  friendship: number
  city?: string
  commune?: string
  online: boolean
  /** Friends (asked and accepted), and a friend request between the two. */
  friend: boolean
  request?: '' | 'sent' | 'received'
}
export type Invite = { id: string; from: string; fromName: string; placeId: string; interactionId: string; label: string; at: string }
export type Around = { players: Player[]; friends: Player[]; invites: Invite[]; /** Friend requests waiting for an answer. */ requests?: Player[] }
/** Gbairai: a message, and a friend's chat in the list. */
export type ChatMessage = { id: number; mine: boolean; body: string; at: string; readAt?: string }
export type Chat = { friend: Player; last?: ChatMessage; unread: number; blocked?: boolean }
/** The betting apps (Bet225, ParisFoot): the virtual football and the bets. */
export type BetOdds = Record<'1' | 'N' | '2' | 'plus' | 'moins' | 'btsOui' | 'btsNon', number>
export type VirtualMatch = { key: string; round: number; home: string; away: string; kickoff: number; end: number; odds: BetOdds; minute: number; score?: [number, number]; goals?: string[] }
export type BetRounds = { now: number; app: string; boost: number; rounds: { round: number; kickoff: number; matches: VirtualMatch[] }[] }
export type BetLeg = { match: string; label: string; pick: string; odds: number; won: boolean | null; score?: [number, number] }
export type BetView = { id: number; app: string; stake: number; odds: number; status: 'open' | 'won' | 'lost'; payout: number; at: string; legs: BetLeg[] }
/** Le grin: the public chat (all of Babi, or the commune). */
export type GrinMessage = { id: number; sim: string; firstName: string; gender: 'femme' | 'homme'; look: Look; commune: string; mine: boolean; friend: boolean; body: string; at: string }
/** Stories (in Gbairai) and Tikitoko. */
export type Author = { id: string; firstName: string; gender: 'femme' | 'homme'; look: Look }
export type Story = { id: number; caption: string; source: 'jeu' | 'reel'; at: string; expiresAt: string; seen: boolean; views?: number }
export type StoryRing = { sim: Author; mine: boolean; stories: Story[] }
export type TikiPost = { id: number; author: Author; handle: string; fans: number; tier: string; followed: boolean; mine: boolean; caption: string; theme: string; place: string; views: number; likes: number; liked: boolean; comments: number; saves: number; saved: boolean; shares: number; at: string }
/** A comment under a video; no author: the game's audience. */
export type TikiComment = { id: string; author?: Author; name: string; handle: string; body: string; likes: number; liked: boolean; mine: boolean; byCreator: boolean; canDelete: boolean; at: string }
export type TikiProfile = { author: Author; handle: string; tier: string; following: number; fans: number; likes: number; posts: number; followed: boolean; mine: boolean }
export type TikiMe = { fans: number; players: number; posts: number; views: number; tier: string; next: number; dealFrom: number; themes: { id: string; label: string }[] }
export type FriendAction = { id: string; label: string; icon: string; minutes: number; cost: number; friendship: number; phone?: boolean }
/** A stage of life, from an age in years. */
export type LifeStage = { id: 'bebe' | 'enfant' | 'ado' | 'adulte'; label: string; from: number; scale: number }
export type Housing = Option & { rent: number; comfort: number }
export type Career = {
  id: string
  label: string
  icon: string
  kind: string
  /** Other kinds of place where the job is done. */
  also?: string[]
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
  phoneApps?: PhoneApp[]
  contacts?: Contact[]
  menus?: Record<string, Dish[]>
  families?: Family[]
  friendActions?: FriendAction[]
  stages?: LifeStage[]
  /** Real minutes in a year of game life. */
  yearMinutes?: number
  /** Minutes of play at each age of childhood ([age, minute]): childhood goes fast. */
  growUp?: [number, number][]
  compteur?: { color: string; cities: string[]; source: Source }
  roads?: Record<string, RoadNet>
  /** What a house can be built with (game/build.go), and the plot's size in blocks. */
  materials?: Material[]
  plot?: { w: number; d: number; h: number }
  furniture?: Furniture[]
  lotSizes?: { id: string; label: string; w: number; d: number }[]
  config: { devLogin: boolean; googleLogin: boolean; realPhotos?: boolean }
}

export type User = { id: string; email: string; name: string; firstName: string; lastName: string; username: string; avatarUrl: string; createdAt: string; /** A team account: the testers' toolbox in the game. */ tester?: boolean }

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
  /** How worn the clothes are: neuf, use (faded, stained), dechire (torn, dirty). */
  wear?: string
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
  /** The furniture in the house the Sim built (for when it lives there). */
  furnished?: string[]
  loan: number
  rentArrears: number
  career: string
  careerLevel: number
  performance: number
  /** What the Sim is busy with right now (real time), or null. */
  activity: Activity | null
  createdAt: string
  /** Apps installed on the phone (from the Store). */
  apps?: string[]
  /** Game minute of birth; 0 = an adult from before births. */
  bornAt?: number
  family?: string
  friends?: Friend[]
  /** The street gang: '' | invited | member | left. */
  gang?: string
  /** Times arrested by the police. */
  record?: number
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
  trip?: { fromCity: string; fromCommune: string; city: string; commune: string; mode: TripMode; class?: string; fare: number; label: string; incident?: string; path?: [number, number][]; bridges?: string[]; party?: number }
}

export type JournalEvent = {
  id: number
  kind: 'life' | 'social' | 'transfer' | 'interaction' | 'random' | 'travel' | 'bill' | 'career' | 'robbed' | 'abonnement' | 'annonce'
  text: string
  money: number
  gameTime: number
  at: string
}

export type Outcome = { text: string; money: number }
/** Every read or action on a Sim returns this; `fresh` = journal lines this request produced. */
/** A building material: basic ones from the start, the others unlocked by building. */
export type Material = { id: string; label: string; color: string; price: number; unlock: number; glass?: boolean }
/** One block of a house: x, y (up), z on the plot, and its material. */
export type Block = [number, number, number, string]
/** A piece of furniture in a house: corner cell, turned a quarter (1) or not, which piece. */
export type Piece = [number, number, number, number, string]
/** Furniture one can put in one's house (game/house.go). */
export type Furniture = { id: string; label: string; icon: string; w: number; d: number; h: number; price: number; comfort: number; unlocks?: string[]; color: string }
export type Lot = { w: number; d: number; area: number; city: string; commune: string; paid: number }
export type LotOffer = { id: string; label: string; w: number; d: number; area: number; price: number; perM2: number; commune: string; name: string; upgrade: boolean; payable: number; possible: boolean }
export type Plot = { simId: string; firstName?: string; blocks: Block[]; built: number; furniture: Piece[]; lot: Lot | null; livable: boolean; home?: boolean }

export type ActionResult = { sim: Sim; outcome: Outcome; journal: JournalEvent[]; fresh: JournalEvent[] }

export type Happening = { id: string; label: string; icon: string; text: string; category?: string; minHour?: number; maxHour?: number; days?: number[]; join?: Interaction; source?: Source }
export type HappeningNow = { happening: Happening | null; start: number; end: number }

export type NewsItem = { id: string; title: string; source: string; link: string; published: string; topic: 'sport' | 'politique' | 'economie' | 'societe' | 'culture' | 'meteo' }
