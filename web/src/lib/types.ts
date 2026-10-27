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
  /** A place of worship's faith (backend game/faith.go). */
  faith?: Faith
  /** A place inside another (a club in the Rue Princesse), drawn by it at its slot. */
  parent?: string
  slot?: number
}
export type Faith = 'catholique' | 'protestant' | 'evangelique' | 'musulman' | 'autre'
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
  /** How many more places the map has there (sent a few at a time, round the Sim): the commune has places.length + mapCount. */
  mapCount?: number
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
export type Ride = { app?: string; class?: string; offer?: number; party?: number; /** One of the Sim's own vehicles, driven there (backend sims/clock.go). */ vehicle?: number }
/** Waited for at the roadside (components/RideFlow.tsx): the one the player chose. */
export type StreetRide = 'woro' | 'compteur' | 'gbaka'
/** taxi = a town's taxi (or an older trip); yango/indrive = older trips. */
export type TripMode = 'woro' | 'compteur' | 'gbaka' | 'moto' | 'taxi' | 'car' | 'avion' | 'metro' | 'gnango' | 'idrive' | 'yango' | 'indrive' | 'perso'
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
  /** Only in a room (or a home) one has rented there. */
  stay?: boolean
  /** Life stages that can do it; empty = from childhood up. */
  ages?: string[]
  /** Only at these places of the kind (the Hôtel Ivoire's cinema…). */
  places?: string[]
  /** Only in these cities (the gbaka is Abidjan's). */
  cities?: string[]
  /** Only at the places of worship of these faiths (the mass, the culte, the Friday prayer). */
  faiths?: Faith[]
  /** Only Sims of this gender (a beard trim is for men). */
  gender?: 'femme' | 'homme'
  /** At home, the room it's done in: the menu shows the house room by room. */
  room?: 'salle-de-bain' | 'chambre' | 'cuisine' | 'salon' | 'cour'
}
export type PlaceKind = { id: string; label: string; icon: string; interactions: Interaction[] }
export type Option = { id: string; label: string; icon: string; hint: string }

export type Origin = Option & { money: number; loan: number; housing: string }
/** The family a Sim is born into: debout, laté, lagnon, poignon, coulé, gnambro. */
export type Family = { id: string; label: string; icon: string; hint: string; /** The kind of neighbourhood, found in every commune. */ sector: string; housing: string; pocket: number; start: number; leave: string; bacGift: number; weight: number }
/** Someone the Sim knows. */
export type Friend = { id: string; name: string; gender: 'femme' | 'homme'; seed: number; commune: string; friendship: number; gang?: boolean; met: number; seen: number; /** Met as an adult: romance possible. */ adult?: boolean; /** Together. */ partner?: boolean; /** Lives at home with the Sim. */ home?: boolean; /** The face they had when met (a passer-by, someone at the maquis…): the same one at your side and at home. */ look?: Look }
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
  /** Together (backend sims/couple.go), and a couple request between the two. */
  couple?: boolean
  coupleRequest?: '' | 'sent' | 'received'
  /** In office (politics): « Présidente », « Maire de Cocody »; the tag of their gang. */
  title?: string
  crew?: string
}
export type Invite = { id: string; from: string; fromName: string; placeId: string; interactionId: string; label: string; at: string }
/** A soirée thrown by a player at home (backend sims/party.go): its lights over the house, the others in the commune come. */
export type Soiree = { id: string; host: string; hostName: string; theme: string; title: string; city: string; commune: string; ends: string; guests: number }

export type Around = { players: Player[]; friends: Player[]; invites: Invite[]; /** Friend requests waiting for an answer. */ requests?: Player[]; /** Players in the game right now, everywhere. */ online?: number; /** A game of dames waiting for an answer, or going on. */ dames?: DameInvite | null; /** A game of 8 américain waiting for an answer, or going on. */ huit?: DameInvite | null; /** The soirées going on in the commune. */ parties?: Soiree[] }
/** Les dames (backend sims/dames.go): a move, the squares (0–49) it goes through and the pieces it takes. */
export type DamesMove = { path: number[]; taken?: number[] }
export type DameSide = { id?: string; name: string; npc?: boolean }
/** A game seen from one side: `you` 1 white (plays first, from the bottom), -1 black; the board's 50 dark squares (1 a man, 2 a dame, negative black). */
export type DameGame = { id: number; you: 1 | -1; white: DameSide; black: DameSide; stake: number; board: number[]; turn: 1 | -1; status: 'invited' | 'playing' | 'done' | 'declined' | 'expired'; winner: number; last?: DamesMove; legal?: DamesMove[]; text?: string }
export type DameInvite = { id: number; status: 'invited' | 'playing'; fromName: string; stake: number; mine: boolean }
/**
 * 8 américain (backend game/huit.go, sims/huit.go). A card: 0–51 is suit × 13 + value − 1 (value 1 the ace … 13 the
 * king; suits trèfle, carreau, cœur, pique), 52 and 53 the jokers.
 */
export type HuitStep = { seat: number; kind: 'play' | 'draw' | 'pass'; card: number; /** Asked with an 8 (-1 none). */ suit: number; drawn?: number; /** Only the cards the player drew themselves. */ cards?: number[]; carte?: boolean; forgot?: boolean; won?: boolean }
export type HuitSeat = { id?: string; name: string; npc?: boolean; cards: number }
export type HuitGame = {
  id: number
  you: number
  seats: HuitSeat[]
  hand: number[]
  /** The last card down, and the one played on (under the jokers). */
  top: number
  under: number
  deck: number
  turn: number
  dir: number
  /** The suit asked by an 8 (-1 none); owed: cards to draw unless answered (by 2: a 2's, 0: a joker's); ace: an ace to answer. */
  suit: number
  owed: number
  by: number
  ace: boolean
  /** The card just drawn, which goes (-1 none). */
  drawn: number
  legal?: number[] | null
  stake: number
  pot: number
  status: 'invited' | 'playing' | 'done' | 'declined' | 'expired'
  winner: number
  text?: string
  steps?: HuitStep[] | null
}
/** Gbairai: a message, and a friend's chat in the list. */
export type ChatMessage = { id: number; mine: boolean; body: string; at: string; readAt?: string }
export type Chat = { friend: Player; last?: ChatMessage; unread: number; blocked?: boolean }
/** The betting apps (Bet225, ParisFoot): the virtual football and the bets. */
export type BetOdds = Record<'1' | 'N' | '2' | 'plus' | 'moins' | 'btsOui' | 'btsNon', number>
export type VirtualMatch = { key: string; round: number; home: string; away: string; kickoff: number; end: number; odds: BetOdds; minute: number; score?: [number, number]; goals?: string[]; /** foot, basket, tennis */ sport?: Sport; /** basketball's points line */ line?: number }
export type Sport = 'foot' | 'basket' | 'tennis'
export type BetRounds = { now: number; app: string; boost: number; sport?: Sport; league?: string; rounds: { round: number; kickoff: number; matches: VirtualMatch[] }[] }
export type BetLeg = { match: string; label: string; pick: string; odds: number; won: boolean | null; score?: [number, number] }
export type LotoTicket = { id: number; draw: number; name: string; numbers: number[]; drawn?: number[]; stake: number; status: 'open' | 'won' | 'lost'; payout: number }
export type BetView = { id: number; app: string; stake: number; odds: number; status: 'open' | 'won' | 'lost'; payout: number; at: string; legs: BetLeg[] }
/** Le grin: the public chat (all of Babi, or the commune). */
export type GrinMessage = { id: number; sim: string; firstName: string; gender: 'femme' | 'homme'; look: Look; commune: string; mine: boolean; friend: boolean; body: string; at: string }
/** Babi Direct, in the grin's « Tout Babi »: what happens in the game, posted by the game; one reaction a player. */
export type DirectPost = { id: number; kind: 'quartier' | 'stade' | 'bet' | 'joueur'; emoji: string; body: string; commune: string; at: string; reactions: Record<string, number>; mine: string }
/** Stories (in Gbairai) and Tikitoko. */
export type Author = { id: string; firstName: string; gender: 'femme' | 'homme'; look: Look }
export type Story = { id: number; caption: string; source: 'jeu' | 'reel'; at: string; expiresAt: string; seen: boolean; views?: number }
export type StoryRing = { sim: Author; mine: boolean; stories: Story[] }
export type TikiPost = { id: number; author: Author; handle: string; fans: number; tier: string; followed: boolean; mine: boolean; caption: string; theme: string; place: string; views: number; likes: number; liked: boolean; comments: number; saves: number; saved: boolean; shares: number; at: string; /** The clip (old posts: a photo only): its public address, else fetched from tikiVideo. */ hasVideo?: boolean; video?: string; durationMs?: number; sound?: string; /** A game creator's video, played live from its seeds (screens/TikiScene.tsx). */ npc?: TikiNPC; /** One of the Sim's friends posted it (met in the game). */ friend?: boolean }
/** The seeds of a game creator's video: their look, the scene. */
export type TikiNPC = { look: number; scene: number }
/** A comment under a video; no author: the game's audience. */
export type TikiComment = { id: string; author?: Author; name: string; handle: string; body: string; likes: number; liked: boolean; mine: boolean; byCreator: boolean; canDelete: boolean; at: string }
export type TikiProfile = { author: Author; handle: string; tier: string; following: number; fans: number; likes: number; posts: number; followed: boolean; mine: boolean; npc?: TikiNPC }
/** A photo of the phone's gallery: in the bucket (url), or from the API with the token (path). */
export type Photo = { id: number; url?: string; path?: string; kind: 'photo' | 'selfie'; place: string; at: string }
export type TikiMe = { fans: number; players: number; posts: number; views: number; tier: string; next: number; dealFrom: number; themes: { id: string; label: string }[] }
/** Babigram: an account is a player's (author) or one of the game's (npc, its look drawn from its handle). */
export type GramAccount = { id: string; author?: Author; npc?: boolean; name: string; gender: 'femme' | 'homme'; handle: string }
/** A photo in a feed: a player's (photo: its API path) or the game's (painted by the app from scene and seed). */
export type GramPost = { id: number; account: GramAccount; followed: boolean; mine: boolean; photo?: string; scene?: string; seed?: number; ratio: 'carre' | 'portrait'; filter?: string; caption: string; place: string; likes: number; liked: boolean; likedBy?: string; comments: number; saved: boolean; shares: number; at: string }
/** A friend in Flashé (backend sims/flashe.go): a player (id: their Sim, look) or one met in the game (id « npc:… », friend). */
export type FlashContact = { id: string; name: string; gender: 'femme' | 'homme'; look?: Look; friend?: Friend; online?: boolean; /** Their snaps not opened yet. */ new: number; last?: { mine: boolean; opened: boolean; at: string }; /** The flame: days in a row both snapped. */ streak: number }
/** A snap opened: a player's photo, or a scene the app paints (a friend met in the game's). */
export type FlashSnap = { id: number; from: string; photo?: string; scene?: string; seed?: number; caption: string; place?: string; seconds: number; at: string }
export type GramProfile = { account: GramAccount; bio: string; posts: number; fans: number; following: number; followed: boolean; mine: boolean; left?: number }
export type GramFound = { account: GramAccount; bio: string; fans: number; followed: boolean }
export type GramActivity = { kind: 'like' | 'comment' | 'follow' | 'audience' | 'audience-comments' | 'fans'; who?: GramAccount; others?: number; post?: number; photo?: string; text?: string; at: string }
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
  /** What's done during a shift, a tap at a time (backend game/jobs.go). */
  tasks: JobTask[]
}
/** One thing done at work: its gesture, from which rung, whether customers tip. */
export type JobTask = { id: string; label: string; icon: string; pose: string; minLevel?: number; tip?: number }

/** An emote: its pose (the id), name, emoji, price (0: free), how long it plays. */
/** A piece of the boutiques (game/clothes.go): a whole outfit or one more accessory, bought once and kept in the wardrobe. */
export type MetroLine = { name: string; stations: { commune: string; name: string }[]; fare: number; perStop: number; wait: number }
export type ClothingPiece = { id: string; label: string; brand: string; kind: 'tenue' | 'accessoire'; gender?: 'femme' | 'homme'; price: number; outfit?: string; outfitColor?: string; pattern?: string; bottomColor?: string; shoeColor?: string; accessory?: string; accessoryColor?: string; shop: 'mall' | 'marche' | 'exclu' | 'premium' }
export type ClothingPack = { id: string; label: string; about: string; pieces: string[] }
export type Emote = { id: string; label: string; emoji: string; price: number; seconds: number }
export type World = {
  cities: City[]
  /** The airline's flights (backend world.FlightRoutes): from each airport. */
  flights?: { from: string; place: string; to: string; toName: string; commune: string; minutes: number; fare: number; km: number; airline: string }[]
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
  /** The emotes (game/emotes.go): free ones, and ones bought once with Djai. */
  emotes?: Emote[]
  /** The boutiques' pieces (game/clothes.go). */
  clothes?: ClothingPiece[]
  /** Lots of pieces at once, in the phone's Boutique (game/clothes.go). */
  clothingPacks?: ClothingPack[]
  /** The métro's line 1 (world/metro.go): its stations by commune, one ticket, minutes a stop. */
  metro?: MetroLine
  /** The slot machines (game/slots.go): the pictures and what they pay, the stakes each machine takes. */
  slots?: { symbols: SlotSymbol[]; stakes: Record<string, number[]>; perDay: number }
  /** Babi Bingo (game/bingo.go): the four games, the stakes, the cards a draw and a day. */
  bingo?: { games: BingoGame[]; stakes: number[]; perDraw: number; perDay: number }
  /** Babi Casino (game/casino.go): the roulette's chips and limits, le 21's stakes, the tickets, the rounds a day. */
  /** The measures a president may decree (backend game.Measures). */
  measures?: Measure[]
  casino?: {
    chips: number[]
    maxTotal: number
    maxBets: number
    stakes: number[]
    tickets: ScratchTicket[]
    perDay: number
    /** L'Envol (game/envol.go): a round every `period` s, `wait` s of bets, a flight of `maxFlight` s at most to ×`max`. */
    envol?: { stakes: number[]; period: number; wait: number; maxFlight: number; max: number }
    /** Babi Trade: the made-up prices, the stakes, the lengths (s), what a right call pays, the calls open at once. */
    trade?: { assets: TradeAsset[]; stakes: number[]; secs: number[]; pays: number; open: number }
  }
  /** Vehicles to buy on Bolide, and the places to keep them (backend game/vehicles.go). */
  vehicles?: VehicleModel[]
  parkings?: ParkingKind[]
  /** What one does in the street (backend sims.StreetActivities): the sellers, the scenes joined. */
  street?: { interaction: Interaction; place: string }[]
  lotSizes?: { id: string; label: string; w: number; d: number }[]
  /** Whole houses (game/plans.go): the homes Sims are born in, and those one can build on a lot. */
  homePlans?: Record<string, HousePlan>
  lotPlans?: HousePlan[]
  /** Which home plan: by housing, and a family's own while the Sim lives with its parents. */
  homeFor?: { housing: Record<string, string>; family: Record<string, string> }
  config: { devLogin: boolean; googleLogin: boolean; realPhotos?: boolean }
}

export type User = { id: string; email: string; name: string; firstName: string; lastName: string; username: string; avatarUrl: string; createdAt: string; /** A team account: the testers' toolbox in the game. */ tester?: boolean; /** Said they are 18 or over: romance in the game. */ adult?: boolean }

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
  /** A hotel room or a home booked on Dodo, while it lasts (backend sims/hotel.go). */
  stay?: Stay
  /** The languages the player speaks besides French (lib/languages.ts). */
  languages?: string[]
  loan: number
  rentArrears: number
  career: string
  careerLevel: number
  performance: number
  /** It goes to work by itself as the shift's hours come (the Boulot app's switch). */
  autoWork?: boolean
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
  /** The Babi Pass (Boutique): a quarter more on the Djai earned, the gold star by the name, till then (ISO). */
  passUntil?: string
  /** The account's day so far by source, and its limits (backend game/money.go): travail, boulot, total… */
  today?: Partial<Record<Income, DayLimit>>
  /** The Pack Prestige bought (Boutique): the crown may be worn. */
  prestige?: boolean
  /** The secret society joined (politics): '' none; baobab, sept, lumiere. */
  sect?: string
  /** The president's measures in force for everyone (backend game/civic.go): some prices lowered. */
  measures?: string[]
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
  /** At work: the job's tasks done in this shift, when each was last done (game minute). */
  tasks?: Record<string, number>
  /** An outing (backend sims/outing.go): the friends met in the game who came along (Friend ids). */
  with?: string[]
  trip?: { fromCity: string; fromCommune: string; city: string; commune: string; mode: TripMode; class?: string; fare: number; label: string; incident?: string; path?: [number, number][]; bridges?: string[]; party?: number; /** Its own vehicle (mode « perso »): the Sim drives it there. */ vehicle?: { id: number; kind: 'velo' | 'moto' | 'voiture'; body: string; color: string; name: string; top: number; km: number } }
  /** A film seen with a Kinéo ticket: which, the screen, the seats. */
  /** video, at: a real film (the ciné-club's), and the game minute it starts. */
  seance?: { film: string; salle: number; seats: string[]; vip?: boolean; video?: string; at?: number; title?: string; credit?: string; file?: string }
  /** The défi taken on during it (components/Defi.tsx): its score, 1–100; not there, not played. */
  defi?: number
  /** At a slot machine (backend sims/machine.go): the session so far. */
  machine?: SlotSession
}

/** Babi Casino (backend game/casino.go): a bet on the roulette's cloth (plein: number 0–36; douzaine, colonne: 1–3; cheval, transversale, carre, sixain: their numbers). */
export type RouletteBet = { kind: string; number?: number; numbers?: number[]; stake: number }
export type RouletteSpin = { number: number; colour: 'rouge' | 'noir' | 'vert'; wins: number[]; back: number }
/** A hand of le 21 as the player sees it: the dealer's second card hidden till the end. */
export type BlackjackMove = 'distribuer' | 'tirer' | 'rester' | 'doubler' | 'separer' | 'assurance' | 'non'
export type BlackjackResult = 'blackjack' | 'gagne' | 'egalite' | 'perdu' | 'saute'
/** One of the player's hands at le 21 (two once split). */
export type BlackjackSeat = { cards: number[]; stake: number; doubled?: boolean; done?: boolean; result?: BlackjackResult; paid?: number }
/** A round of le 21: `player` and `total` are the hand being played; `offer` while the bank, an ace up, asks about the insurance. */
/** A round of godé (backend sims/gode.go): the dice thrown in order, more than one each when both were the same. */
export type GodeRound = {
  stake: number
  first: 'me' | 'them'
  them: string
  call?: 'grand' | 'petit'
  me: number[]
  npc: number[]
  done?: boolean
  won?: boolean
  paid?: number
}

export type BlackjackView = {
  stake: number
  hands: BlackjackSeat[]
  at: number
  player: number[]
  total: number
  dealer: number[]
  shown: number
  doubled?: boolean
  offer?: boolean
  insurance?: number
  canSplit?: boolean
  staked: number
  done: boolean
  result?: BlackjackResult
  paid?: number
}
export type ScratchTicket = { id: string; name: string; about: string; price: number; prizes: { amount: number; odds: number }[] }
export type ScratchResult = { ticket: string; cells: number[]; prize: number }
/** L'Envol (backend sims/envol.go): the round (attente: bets taken; vol; parti: its crash told), the last planes, the Sim's bets, this round's players. */
export type EnvolBet = { id: number; round: number; stake: number; auto?: number; cashed?: number; status: 'open' | 'won' | 'lost'; payout?: number }
export type EnvolState = {
  now: number
  round: { n: number; phase: 'attente' | 'vol' | 'parti'; takeoff: number; next: number; crash?: number; flown?: number }
  history: number[]
  mine: EnvolBet[]
  players: { name: string; stake: number; mine: boolean; cashed?: number }[]
}
/** Babi Trade (backend sims/trade.go): a made-up price, a call on it, the last minutes of a price (one a second from `from`). */
export type TradeAsset = { id: string; label: string; unit: string }
export type TradeCall = { id: number; asset: string; dir: 'hausse' | 'baisse'; stake: number; entryAt: number; entryPrice: number; expiryAt: number; exitPrice?: number; status: 'open' | 'won' | 'lost' | 'tie'; payout?: number }
export type TradeState = { now: number; asset: string; from: number; prices: number[]; last: Record<string, number>; calls: TradeCall[]; /** When the market's session (an hour) closes: a call ends before (Unix s). */ closes: number }

/** Babi Bingo (backend game/bingo.go): a prize, done within so many balls, paid times the stake. */
export type BingoPrize = { id: string; label: string; within: number; times: number }
/** One of the games: its balls (Drawn of 1…Balls), its card (Rows × Cols, the free middle), its draws (a ball every Every ms, a draw every Period s). */
export type BingoGame = { id: string; name: string; about: string; balls: number; drawn: number; rows: number; cols: number; free?: boolean; every: number; period: number; prizes: BingoPrize[] }
/** A card: row by row (0: blank, or the free middle); its result once its draw is over. */
export type BingoCard = { id: number; game: string; draw: number; numbers: number[]; stake: number; status: 'open' | 'won' | 'lost'; prize?: string; payout?: number }
/** A room now: its draw (running, or just over), the balls out, the next draw, how many play. */
export type BingoRoom = { game: string; draw: number; start: number; balls: number[]; over: boolean; next: number; nextAt: number; players: number; waiting: number }
export type BingoWinner = { name: string; game: string; prize: string; payout: number; mine?: boolean }
export type BingoState = { now: number; rooms: BingoRoom[]; mine: BingoCard[]; winners: BingoWinner[] }

/** A slot machine's picture (backend game/slots.go): what three of it and two of it pay, times the stake. */
export type SlotSymbol = { id: string; label: string; three: number; two: number }
/** One turn of the reels, and the multiple of the stake won (0: lost). */
export type SlotSpin = { reels: [string, string, string]; times: number; line?: string }
/** At a slot machine: the session so far. */
export type SlotSession = { last?: SlotSpin; stake: number; spins: number; staked: number; won: number }

export type JournalEvent = {
  id: number
  kind: 'life' | 'social' | 'transfer' | 'interaction' | 'random' | 'travel' | 'bill' | 'career' | 'robbed' | 'abonnement' | 'annonce'
  text: string
  money: number
  gameTime: number
  at: string
}

export type Outcome = { text: string; money: number; mood?: 'good' | 'bad' | 'bye'; /** What a game played sends back (the roulette's number, a ticket's cells, a hand of le 21). */ data?: unknown }
/** Every read or action on a Sim returns this; `fresh` = journal lines this request produced. */
/** A building material: basic ones from the start, the others unlocked by building. */
export type Material = { id: string; label: string; color: string; price: number; unlock: number; glass?: boolean }
/** One block of a house: x, y (up), z on the plot, and its material. */
export type Block = [number, number, number, string]
/** A piece of furniture in a house: corner cell, turned a quarter (1) or not, which piece. */
export type Piece = [number, number, number, number, string]
/** Furniture one can put in one's house (game/house.go). */
export type Furniture = { id: string; label: string; icon: string; w: number; d: number; h: number; price: number; comfort: number; unlocks?: string[]; color: string }
export type Lot = { w: number; d: number; area: number; city: string; commune: string; paid: number; /** Where the player set it on the map (none: the spot the game drew). */ lat?: number; lng?: number }
/** A lot of a commune on the map where one picks a spot (backend sims/plot.go lotSpots). */
export type LotSpot = { key: string; lat?: number; lng?: number; w: number; d: number; mine?: boolean; lot?: number; bare?: boolean }
export type LotOffer = { id: string; label: string; w: number; d: number; area: number; price: number; perM2: number; city: string; commune: string; name: string; /** One of the Sim's lots made bigger: its id. */ upgrade?: number; payable: number; possible: boolean }
export type Plot = { /** The lot's own id (0: none yet); key: where it stands in the commune (world3d lotSpot). */ id: number; key: string; simId: string; firstName?: string; blocks: Block[]; built: number; furniture: Piece[]; zones?: Zone[]; lot: Lot | null; livable: boolean; home?: boolean; /** A house from a plan going up: its building site, from when to when (ISO). */ buildFrom?: string; buildUntil?: string }
/** A stretch of ground in a house: x, z of its corner, w × d, its kind (sol, beton, cour, jardin, terrasse, piscine) and a room's name. */
export type Zone = [number, number, number, number, string, string]
/** A whole house (game/plans.go): its rooms' walls and furniture, its floors, garden and pool. */
export type HousePlan = { id: string; label: string; hint: string; w: number; d: number; rooms: number; pool: boolean; blocks: Block[]; furniture: Piece[]; zones: Zone[]; lot: boolean; cost: number }

export type ActionResult = { sim: Sim; outcome: Outcome; journal: JournalEvent[]; fresh: JournalEvent[] }

/** La boutique (backend shop/): Djai for real money (F CFA), through GeniusPay. */
export type ShopPack = { id: string; label: string; price: number; djai: number; bonus?: string }
/** Something else than Djai: the Pass, a boost, the Pack Prestige (once: bought once and kept). */
export type ShopItem = { id: string; label: string; text: string; price: number; once?: boolean; /** A piece of clothing into the wardrobe (game/clothes.go Premium). */ piece?: string }
/** kind: djai | pass | energie | prestige (| pub, an advertiser's); item: the pack's or item's id. */
export type ShopPurchase = { id: string; kind: string; item: string; price: number; djai: number; status: string; credited: boolean; at: string }
/** open: GeniusPay set up; sandbox: its test keys; adult: the account said it's 18 or over; passUntil: the Pass on till then. */
export type ShopView = { open: boolean; sandbox?: boolean; adult: boolean; passUntil?: string; prestige: boolean; packs: ShopPack[]; items: ShopItem[]; purchases: ShopPurchase[] }

export type Happening = { id: string; label: string; icon: string; text: string; category?: string; minHour?: number; maxHour?: number; days?: number[]; join?: Interaction; source?: Source }
export type HappeningNow = { happening: Happening | null; start: number; end: number }

/** An idea a player sent Babi Life from the phone (the Idées app), and what the team did with it. */
export type Idea = { id: number; topic: 'jeu' | 'lieu' | 'bug' | 'autre'; text: string; status: 'new' | 'read' | 'kept' | 'done' | 'no'; reply: string; at: string; answeredAt?: string }
export type NewsItem = { id: string; title: string; source: string; link: string; published: string; topic: 'sport' | 'politique' | 'economie' | 'societe' | 'culture' | 'meteo' }

/** A room (or a home) rented away from home, until a game minute (backend sims/hotel.go Stay). */
export type Stay = { kind: 'hotel' | 'dodo'; place: string; name: string; room?: string; floor?: number; type?: string; city: string; commune: string; from: number; until: number; paid: number; listing?: number; host?: string; /** Dodo: a player's house (its plot), or a game home's seed (its plan). */ lot?: number; seed?: number }
export type RoomType = { id: string; label: string; hint: string; rate: number }
export type StayLength = { id: string; label: string; minutes: number; rate: number }
export type HotelInfo = { place: string; floors: number; roomsPerFloor: number; suitesFrom: number; stars: number; night: number; busy: number }
export type HotelRoom = { room: string; type: string; taken: boolean; mine: boolean }
export type HotelView = { hotel: HotelInfo; name: string; types: RoomType[]; lengths: StayLength[]; prices: Record<string, Record<string, number>>; stay: Stay | null; floor?: number; rooms?: HotelRoom[] }
/** A home on Dodo (backend game/dodo.go): the game's own, or a player's house. */
export type DodoListing = { id: string; title: string; type: string; typeName: string; host: string; hostSim?: string; city: string; commune: string; night: number; rating: number; reviews: number; guests: number; has: string[]; seed: number; full: boolean; mine?: boolean }
export type DodoMine = { id: number; lot: number; title: string; night: number; stays: number; earned: number; city: string; commune: string; busy: boolean }
export type DodoView = { listings: DodoListing[]; stay: Stay | null; mine: DodoMine[]; lettable: Plot[]; lengths: StayLength[]; fee: number; studio: number; adult: boolean }

/** Kinéo, the game's cinemas (backend game/cinema.go, sims/cinema.go). */
/** video: a real film (the ciné-club's, YouTube's id on its makers' channel), credit: who made it, under what licence. */
export type CinemaFilm = { id: string; title: string; genre: string; minutes: number; rating: string; tagline: string; colors: [string, string]; video?: string; credit?: string; file?: string }
export type CinemaSalle = { n: number; rows: number; cols: number; aisles: number[]; vip?: boolean; club?: boolean; price: number; name: string }
export type CinemaSession = { film: string; salle: number; at: number; price: number; vip?: boolean; left: number }
export type CinemaProgram = { cinema: { id: string; name: string; salles: CinemaSalle[] }; day: number; today: number; now: number; films: CinemaFilm[]; sessions: CinemaSession[] }
export type CinemaSeats = { salle: CinemaSalle; session: Omit<CinemaSession, 'left'>; film: CinemaFilm; taken: string[] }
export type CinemaTicket = { id: number; cinema: string; cinemaName: string; salle: number; salleName: string; film: string; title: string; at: number; seats: string[]; price: number; code: string; used: boolean; vip?: boolean }

/** A vehicle on Bolide (backend game/vehicles.go): body is how it's drawn ("velo", "moto", a car model). */
export type VehicleModel = { id: string; kind: 'velo' | 'moto' | 'voiture'; name: string; price: number; topSpeed: number; body: string; colors: string[]; fuelPerKm: number; about: string }
/** A place to keep vehicles of a kind, bought in a commune. */
export type ParkingKind = { id: string; for: VehicleModel['kind']; name: string; slots: number; price: number; about: string }
/** The Sim's own: its vehicles (where each is kept) and its places (how many each keeps). */
export type Garage = { vehicles: { id: number; model: string; color: string; parking: number | null; km: number }[]; parkings: { id: number; kind: string; city: string; commune: string; used: number }[] }

/* ---------- Politics (backend/internal/politics): parties, elections, offices, gangs, sects ---------- */
export type Party = { id: number; name: string; acronym: string; color: string; slogan: string; leader: string; leaderName: string; members: number }
export type Candidate = { sim: string; name: string; username?: string; look: Look; gender: 'femme' | 'homme'; party?: number; acronym?: string; color?: string; programme: string; points: number; votes: number; npcVotes: number }
/** An election's week (backend game.ElectionWeek): one stands till the vote, campaigns from campaignAt (Friday 18 h), votes from votesAt (Sunday) to closesAt, hears the results at resultsAt (Monday 9 h). */
export type Election = { id: number; kind: 'president' | 'maire'; commune?: string; opensAt: string; campaignAt: string; votesAt: string; closesAt: string; resultsAt: string; settled: boolean; winner?: string; turnout: number; candidates: Candidate[]; myVote?: string }
/** The president's measures of the week (backend game/civic.go): a share off at some places, or off the public transport. */
export type Measure = { id: string; label: string; about: string; kinds?: string[]; fares?: boolean; off: number }
/** The stadium's big days: the president's Fête de la Nation, a candidate's meeting. */
export type StateEvent = { id: number; kind: 'fete' | 'meeting'; sim: string; name: string; acronym?: string; color?: string; place: string; startsAt: string; endsAt: string; guests: number }
/** A candidate's call to the party's militants (their pay held from the candidate). */
export type MilitCall = { id: number; election: number; candidate: string; name: string; commune: string; pay: number; slots: number; taken: number; done?: boolean }
/** The president's week: their words, measures, rating, Fête de la Nation. */
export type PresidentWeek = {
  election: number
  sim: string
  name: string
  acronym?: string
  color?: string
  until: string
  words: { id: number; kind: 'discours' | 'adresse'; text: string; at: string }[]
  measures: string[]
  rating: { avg: number; count: number; mine: number }
  fete?: StateEvent
}
/** What a Sim may do in the street for the republic (backend politics.terrain). */
export type Terrain = { stands: { election: number; kind: 'president' | 'maire'; commune?: string }[]; toured: string[]; calls: MilitCall[]; events: StateEvent[] }
export type Holder = { office: string; label: string; sim: string; name: string; username?: string; gender: 'femme' | 'homme'; look: Look; acronym?: string; color?: string; since: string; until: string }
export type CrewMember = { sim: string; name: string; username?: string; role: string }
export type Crew = { id: number; name: string; tag: string; color: string; commune: string; leader: string; leaderName: string; treasury: number; members?: CrewMember[]; size: number; asked?: boolean; requests?: CrewMember[] }
export type Sect = { id: string; name: string; motto: string; fee: number; dues: number; perk: string; risk?: string }
export type CampaignAct = { id: string; label: string; cost: number; points: number; scope: 'commune' | 'all'; blurb: string }
export type Politics = {
  party: Party | null
  offices: Holder[]
  crew: Crew | null
  sect: string
  president: Election | null
  lastPresident: Election | null
  mayor: Election | null
  lastMayor: Election | null
  government: Holder[]
  mayors: Holder[]
  communiques: string[]
  campaignActs: CampaignAct[]
  sects: Sect[]
  fees: { party: number; crew: number }
  pay: { president: number; ministre: number; depute: number; maire: number }
  deposits: { president: number; maire: number }
  playerWeight: number
  week: PresidentWeek | null
  measures: Measure[]
  mandatesLeft: number
  myCalls: MilitCall[]
  myEvents: StateEvent[]
  events: StateEvent[]
  rules: Record<'tourCost' | 'tourPoints' | 'militantPoints' | 'meetingCost' | 'meetingPoints' | 'meetingGuest' | 'meetingGuests' | 'feteHours' | 'meetingHours' | 'payMin' | 'payMax' | 'slotsMax' | 'measures' | 'mandatesAMonth', number>
}

/** Where Djai earned by playing comes from (backend game/money.go). */
export type Income = 'travail' | 'boulot' | 'pourboire' | 'defi' | 'tournoi' | 'jeux' | 'chance' | 'coup' | 'reseaux' | 'recu' | 'envoye' | 'location' | 'total' | 'machine' | 'bingo' | 'casino'
/** A source's day so far: Djai got and the most a day (0: none), times done and the most a day. */
export type DayLimit = { got: number; max?: number; times?: number; maxTimes?: number }

/** Babi Foot's career (backend game/footcareer.go): a player on the market (G keeper, D back, M midfield, A forward). */
export type FootRecruit = { id: string; name: string; post: 'G' | 'D' | 'M' | 'A'; stars: number; price: number }
/** The Sim's career (null: none yet; the season is the phone's), the market, the most signings. */
export type FootCareerView = { career: { club: string; squad: string[]; season: unknown } | null; market: FootRecruit[]; max: number }
