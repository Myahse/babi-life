import type { ActionResult, Block, HappeningNow, NewsItem, Look, Plot, Sim, User, World, Ride, Around, Place, Chat, ChatMessage, Story, StoryRing, TikiPost, TikiMe, Photo, TikiComment, TikiProfile, Piece, LotOffer, HotelView, DodoView, GrinMessage, DirectPost, BetRounds, BetView, LotoTicket, GramPost, GramProfile, GramFound, GramActivity, FlashContact, FlashSnap, DameGame, HuitGame, CinemaProgram, CinemaSeats, CinemaTicket, Garage, ShopPurchase, ShopView, Idea, Politics, Party, Holder, Crew, BingoState, RouletteBet, BlackjackMove, BlackjackView, EnvolState, TradeState, Terrain, FootCareerView, LotSpot, GodeRound } from './types'
import { useSession } from '../store/session'
import { keepData, keptData, OFFLINE_TEXT, setOnline } from './offline'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/**
 * What a player may read of a refusal: the server's own sentences in the game's
 * words, never its insides (a database, a code, a key, a variable, English).
 * The admin screens see it as it came.
 */
const TECHNICAL = /\b(database|could not|not found|unavailable|try again|internal|server error|bad gateway|sql|pgx|null|undefined|token|api|https?|json|timeout|panic|stack|env|requête|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/i
export function playerText(status: number, message: string): string {
  if (location.pathname.startsWith('/admin')) return message
  if (!message || TECHNICAL.test(message) || /^[\x20-\x7e]+$/.test(message) && !/[éèàùçêô]/i.test(message) && /\b(the|is|not|error|failed|invalid)\b/i.test(message)) {
    return status === 404 ? "Ce n'est pas encore là : reviens un peu plus tard." : 'Petit souci de notre côté : réessaie dans un instant.'
  }
  return message
}

/** A refusal or a failure, as a player may read it (`fallback` when it says nothing usable). */
export function errorText(e: unknown, fallback = 'Erreur'): string {
  if (e instanceof ApiError) return e.message || fallback
  if (e instanceof Error) {
    const t = playerText(0, e.message)
    return t === e.message ? t : fallback
  }
  return fallback
}

/** A photo behind the login (a story, a post): fetched with the token, as an object URL. */
export async function photoURL(path: string) {
  const token = useSession.getState().token
  const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiError(res.status, 'photo introuvable')
  return URL.createObjectURL(await res.blob())
}

/**
 * The key of a write, for the server to do it once (backend/internal/auth/idempotency.go):
 * the same write again (same address, same content) while the first is under way or just
 * done (a double tap, a button pressed twice) carries the same key; a new one otherwise.
 */
const writes = new Map<string, { key: string; until: number }>()
function writeKey(method: string, path: string, body: unknown) {
  const what = `${method} ${path} ${typeof body === 'string' ? body : ''}`
  const now = Date.now()
  for (const [k, v] of writes) if (v.until < now) writes.delete(k)
  const had = writes.get(what)
  if (had) {
    had.until = now + 4000
    return had.key
  }
  const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`
  writes.set(what, { key, until: now + 4000 })
  return key
}

/** The writes under way: the same one asked again (a double tap) waits for the first instead of going twice. */
const inflight = new Map<string, Promise<unknown>>()

function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  if (method === 'GET') return send<T>(path, init)
  const what = `${method} ${path} ${typeof init.body === 'string' ? init.body : ''}`
  const had = inflight.get(what)
  if (had) return had as Promise<T>
  const p = send<T>(path, init).finally(() => inflight.delete(what))
  inflight.set(what, p)
  return p
}

/**
 * The reads kept for the times without network (lib/offline.ts): what the game
 * needs to open and be looked round as it was (the world, the account and its
 * Sim, the commune's places, the garage, the défis' records, the messages and
 * the snaps' list, the news), not the rest (a feed, a match going on).
 */
const KEEP = /^\/(world|me|sims|news)(\?|$)|^\/sims\/[^/]+(\?|$)|^\/sims\/[^/]+\/(gbairai|photos|garage|defis|flashe|stories|lots|plots|emotes|clothes)(\?|$)|^\/places\?/

/**
 * Played without network (lib/offlinePlay.ts): what it answers in the server's place (a Sim's
 * reads and the actions the phone can play), the Sim each time the server sends it, and what was
 * played offline sent before anything else once online (the server counts it in order).
 */
export const offlinePlay: {
  answer?: (method: string, path: string, body: unknown) => Promise<unknown>
  seen?: (sim: Sim, journal?: ActionResult['journal']) => void
  flush?: () => Promise<void>
} = {}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  if (offlinePlay.flush && !/^\/sims\/[^/]+\/sync$/.test(path)) await offlinePlay.flush()
  const token = useSession.getState().token
  const key = method !== 'GET' && token ? writeKey(method, path, init.body) : null
  const kept = method === 'GET' && KEEP.test(path) ? `${useSession.getState().user?.id ?? 'guest'} ${path}` : null
  // No network: a read from what was kept, a write not even tried (it waits for the network).
  const offline = async (): Promise<T> => {
    setOnline(false)
    const own = await offlinePlay.answer?.(method, path, init.body)
    if (own !== undefined) return own as T
    const hit = kept ? await keptData<T>(kept) : undefined
    if (hit !== undefined) return hit
    throw new ApiError(0, OFFLINE_TEXT)
  }
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: {
        // A form (a Tikitoko clip) sets its own multipart type, with the boundary.
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...init.headers,
      },
    })
  } catch (e) {
    // The request didn't leave (or no answer came): the network, not the server.
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return offline()
  }
  setOnline(true)
  if (res.status === 401 && token) useSession.getState().signOut()
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // A 404 with no message of ours: the server doesn't know this address yet (an older version is running).
    throw new ApiError(res.status, playerText(res.status, body.error ?? ''))
  }
  if (res.status === 204) return undefined as T
  const data = (await res.json()) as T
  if (kept) void keepData(kept, data)
  // An action's answer carries the Sim as it is now: the kept copy follows (else, without network, it'd go back to before).
  const withSim = data as { sim?: Sim; journal?: ActionResult['journal'] } | null
  const sim = withSim?.sim
  if (sim?.id && method !== 'GET') void keepSim(sim)
  if (sim?.id && sim.needs) offlinePlay.seen?.(sim, withSim?.journal)
  return data
}

async function keepSim(sim: { id?: string }) {
  const key = `${useSession.getState().user?.id ?? 'guest'} /sims/${sim.id}`
  const was = await keptData<Record<string, unknown>>(key)
  if (was) await keepData(key, { ...was, sim })
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

/** A device signed in to the account (a session). */
export type Device = { id: string; device: string; createdAt: string; lastSeen: string; current: boolean }

type Session = { token: string; user: User }

export type NewSim = {
  firstName: string
  lastName: string
  gender: Sim['gender']
  look: Look
  traits: string[]
  aspiration: string
  homeCity: string
  homeCommune: string
  /** Where the player is, if shared: the Sim is born in the nearest commune. */
  lat?: number
  lng?: number
  /** From abroad (or no position): the commune the player comes from; none: drawn at random. */
  fromCity?: string
  fromCommune?: string
}

export type WaitlistJoin = { firstName: string; contact: string; commune: string; beta: boolean; source: string; website: string; terms: boolean; privacy: boolean; sim?: { lastName: string; gender: 'femme' | 'homme'; look: Look; traits: string[]; aspiration: string } }

/** A commune to buy land in, anywhere in the game. */
export type LotWhere = { city: string; commune: string }

export type HistRound = { at: string; stake: number; payout: number; status: 'open' | 'won' | 'lost' | 'tie'; detail: string }
export type HistTotal = { rounds: number; staked: number; back: number }
export type Historique = { rounds: HistRound[]; today: HistTotal; week: HistTotal }

export const api = {
  /** The devices signed in to the account; sign one out, all the others, or this one. */
  /** The emotes bought; buying one. */
  emotes: (id: string) => request<{ owned: string[] }>(`/sims/${id}/emotes`),
  buyEmote: (id: string, emote: string) => post<ActionResult>(`/sims/${id}/emotes/${emote}`, {}),
  /** The boutiques' pieces bought; buying one (in the shop that sells it). */
  clothes: (id: string) => request<{ owned: string[] }>(`/sims/${id}/clothes`),
  buyPiece: (id: string, piece: string, app = false) => post<ActionResult>(`/sims/${id}/clothes/${piece}${app ? '?app=1' : ''}`, {}),
  buyClothingPack: (id: string, pack: string) => post<ActionResult>(`/sims/${id}/clothes/pack/${pack}`, {}),
  sessions: () => request<{ sessions: Device[]; legacy: boolean }>('/me/sessions'),
  revokeSession: (id: string) => request<void>(`/me/sessions/${id}`, { method: 'DELETE' }),
  revokeOthers: () => post<{ signedOut: number }>('/me/sessions/others', {}),
  endSession: () => request<void>('/me/session', { method: 'DELETE' }),
  world: () => request<World>('/world'),
  /** A commune's places from the map (OpenStreetMap) within r km of a point. */
  mapPlace: (commune: string, id: string) => request<{ places: Place[]; total: number }>(`/places?commune=${encodeURIComponent(commune)}&id=${encodeURIComponent(id)}`),
  /** All the commune's places from the map (one with a few hundred). */
  allPlaces: (commune: string) => request<{ places: Place[]; total: number }>(`/places?commune=${encodeURIComponent(commune)}&all=1`),
  /** The commune's places from the map whose name has these words, wherever they are. */
  searchPlaces: (commune: string, q: string) => request<{ places: Place[]; total: number }>(`/places?commune=${encodeURIComponent(commune)}&q=${encodeURIComponent(q)}`),
  mapPlaces: (commune: string, lat: number, lng: number, r = 1.2) => request<{ places: Place[]; total: number }>(`/places?commune=${encodeURIComponent(commune)}&lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&r=${r}`),
  news: () => request<{ items: NewsItem[]; updated: string }>('/news'),
  /** The ideas the player sent Babi Life, and sending one (from the Sim whose phone it is). */
  ideas: () => request<{ ideas: Idea[] }>('/me/ideas'),
  /** Politics (backend/internal/politics): the Sim's summary, and everything done from the Politique app. */
  politics: (id: string) => request<Politics>(`/sims/${id}/politics`),
  parties: () => request<{ parties: Party[]; fee: number }>('/politics/parties'),
  foundParty: (id: string, p: { name: string; acronym: string; color: string; slogan: string }) => post<{ id: number; text: string }>(`/sims/${id}/politics/party`, p),
  joinParty: (id: string, party: number) => post<{ text: string }>(`/sims/${id}/politics/party/${party}/join`, {}),
  leaveParty: (id: string) => post<{ ok: boolean }>(`/sims/${id}/politics/party/leave`, {}),
  declare: (id: string, election: number, programme: string) => post<{ text: string }>(`/sims/${id}/politics/candidacy`, { election, programme }),
  campaign: (id: string, election: number, kind: string, commune: string) => post<{ text: string }>(`/sims/${id}/politics/campaign`, { election, kind, commune }),
  vote: (id: string, election: number, candidate: string, at: string) => post<{ text: string }>(`/sims/${id}/politics/vote`, { election, candidate, at }),
  /** The president's week and the campaign in the street (backend politics/presidency.go). */
  speak: (id: string, kind: 'discours' | 'adresse', text: string) => post<{ text: string }>(`/sims/${id}/politics/parole`, { kind, text }),
  /** Reports the president's words (five players take them down). */
  reportWord: (id: string, word: number, reason: string) => post<{ text: string; hidden?: boolean }>(`/sims/${id}/politics/parole/${word}/signaler`, { reason }),
  decree: (id: string, measure: string) => post<{ text: string }>(`/sims/${id}/politics/mesure`, { measure }),
  ratePresident: (id: string, score: number) => post<{ text: string }>(`/sims/${id}/politics/note`, { score }),
  fete: (id: string, place: string, at: string) => post<{ text: string }>(`/sims/${id}/politics/fete`, { place, at }),
  meeting: (id: string, election: number, place: string, at: string) => post<{ text: string }>(`/sims/${id}/politics/meeting`, { election, place, at }),
  callMilitants: (id: string, election: number, commune: string, pay: number, slots: number) => post<{ text: string }>(`/sims/${id}/politics/militants`, { election, commune, pay, slots }),
  terrain: (id: string) => request<Terrain>(`/sims/${id}/politics/terrain`),
  posters: (commune: string) => request<{ posters: { name: string; acronym?: string; color: string; slogan?: string; kind: 'president' | 'maire'; points: number }[] }>(`/politics/affiches?commune=${encodeURIComponent(commune)}`),
  government: () => request<{ holders: Holder[]; portfolios: { id: string; label: string }[] }>('/politics/government'),
  nameOffice: (id: string, office: string, sim: string) => post<{ text: string }>(`/sims/${id}/politics/name`, { office, sim }),
  communique: (id: string, text: string) => post<{ text: string }>(`/sims/${id}/politics/communique`, { text }),
  searchSims: (q: string) => request<{ sims: { id: string; firstName: string; lastName: string; username: string; commune: string }[] }>(`/politics/search?q=${encodeURIComponent(q)}`),
  crews: () => request<{ crews: Crew[]; fee: number }>('/politics/crews'),
  foundCrew: (id: string, c: { name: string; tag: string; color: string }) => post<{ id: number; text: string }>(`/sims/${id}/politics/crew`, c),
  askCrew: (id: string, crew: number) => post<{ text: string }>(`/sims/${id}/politics/crew/${crew}/ask`, {}),
  answerCrew: (id: string, sim: string, no: boolean) => post<{ text?: string }>(`/sims/${id}/politics/crew/accept`, { sim, no }),
  kickCrew: (id: string, sim: string, role?: string) => post<{ text: string }>(`/sims/${id}/politics/crew/kick`, { sim, role }),
  leaveCrew: (id: string) => post<{ ok: boolean }>(`/sims/${id}/politics/crew/leave`, {}),
  fundCrew: (id: string, amount: number) => post<{ text: string }>(`/sims/${id}/politics/crew/fund`, { amount }),
  setSect: (id: string, sect: string) => post<{ text: string }>(`/sims/${id}/politics/sect`, { sect }),
  sendIdea: (simId: string, topic: Idea['topic'], text: string) => post<{ idea: Idea; text: string }>('/me/ideas', { simId, topic, text }),
  happening: (city: string, commune: string, gameMinutes: number) => request<HappeningNow>(`/happening?city=${encodeURIComponent(city)}&commune=${encodeURIComponent(commune)}&t=${Math.floor(gameMinutes)}`),
  googleLogin: (credential: string) => post<Session>('/auth/google', { credential }),
  devLogin: (name: string) => post<Session>('/auth/dev', { name }),
  register: (u: { firstName: string; lastName: string; username: string; email: string; password: string }) => post<Session>('/auth/register', u),
  /** `login` is an e-mail or a username. */
  login: (login: string, password: string) => post<Session>('/auth/login', { email: login, password }),
  /** « Mot de passe oublié » (backend auth/reset.go): the e-mail with the link, then the new password. */
  forgotPassword: (login: string) => post<{ text: string }>('/auth/forgot', { email: login }),
  resetPassword: (token: string, password: string) => post<{ text: string }>('/auth/reset', { token, password }),
  usernameAvailable: (u: string) => request<{ available: boolean }>(`/auth/username?u=${encodeURIComponent(u)}`),
  setUsername: (username: string) => request<User>('/me/username', { method: 'PUT', body: JSON.stringify({ username }) }),
  me: () => request<User>('/me'),
  /** With the testers' code (or the admin key), the account becomes a tester's. typed: just typed by the person (it holds even after the testers' reset). */
  becomeTester: (code: string, typed = false) => post<User>('/me/tester', { code, typed }),
  /** The player says once that they are 18 or over (romance). */
  confirmAdult: () => post<User>('/me/adult', {}),
  /** La boutique (backend shop/): the packs, and the account's purchases. */
  shop: (id: string) => request<ShopView>(`/sims/${id}/shop`),
  /** A pack or an item bought: the payment opened at GeniusPay, its page to go to. */
  buy: (id: string, what: { pack?: string; item?: string }) => post<{ id: string; url: string }>(`/sims/${id}/shop`, what),
  /** Back from GeniusPay: the purchase as it stands (its Djai added once paid). */
  purchase: (id: string, purchase: string) => post<ShopPurchase>(`/sims/${id}/shop/${purchase}`, {}),
  sims: () => request<Sim[]>('/sims'),
  sim: (id: string) => request<ActionResult>(`/sims/${id}`),
  /** The app put away (hidden, closed): the Sim held from now (backend sims/clock.go); sent even as the page goes. */
  pause: (id: string) => request<ActionResult>(`/sims/${id}/pause`, { method: 'POST', body: '{}', keepalive: true }),
  /** What was played offline (lib/offlinePlay.ts), sent once online: the server plays it again (backend sims/sync.go). */
  sync: (id: string, steps: unknown[]) => post<ActionResult>(`/sims/${id}/sync`, { clock: Date.now(), steps }),
  createSim: (sim: NewSim) => post<Sim>('/sims', sim),
  deleteSim: (id: string) => request<void>(`/sims/${id}`, { method: 'DELETE' }),
  interact: (id: string, placeId: string, interactionId: string) =>
    post<ActionResult>(`/sims/${id}/interact`, { placeId, interactionId }),
  travel: (id: string, city: string, commune: string, ride?: Ride) => post<ActionResult>(`/sims/${id}/travel`, { city, commune, ...ride }),
  career: (id: string, career: string) => post<ActionResult>(`/sims/${id}/career`, { career }),
  /** One of the job's tasks, during the shift (backend sims/jobs.go). */
  jobTask: (id: string, task: string) => post<ActionResult>(`/sims/${id}/job-task`, { task }),
  /** Going to work by oneself as the shift's hours come. */
  autoWork: (id: string, on: boolean) => request<{ autoWork: boolean }>(`/sims/${id}/auto-work`, { method: 'PUT', body: JSON.stringify({ on }) }),
  move: (id: string, housing: string, where?: LotWhere) => post<ActionResult>(`/sims/${id}/move`, { housing, ...where }),
  repay: (id: string, what: 'loan' | 'rent', amount: number) => post<ActionResult>(`/sims/${id}/repay`, { what, amount }),
  /** The wish list; with a Sim, it is born there (the family is drawn by the server). */
  joinWaitlist: (body: WaitlistJoin) => post<{ ok: boolean; already: boolean; count: number; birth?: { family: string; commune: string } }>('/waitlist', body),
  changeLook: (id: string, look: Look) => post<ActionResult>(`/sims/${id}/look`, look),
  setApp: (id: string, app: string, install: boolean) => post<ActionResult>(`/sims/${id}/apps`, { app, install }),
  send: (id: string, to: string, amount: number) => post<ActionResult>(`/sims/${id}/send`, { to, amount }),
  friend: (id: string, friend: string, action: string) => post<ActionResult>(`/sims/${id}/friend`, { friend, action }),
  gang: (id: string, action: string) => post<ActionResult>(`/sims/${id}/gang`, { action }),
  /** home: eaten in the house, at the table. */
  order: (id: string, place: string, dish: string, home = false) => post<ActionResult>(`/sims/${id}/order`, { place, dish, home }),
  /** Buy alloco from the tantie's stall in the street (she may have none left). */
  /** Talk to a passer-by: what they answer comes back as the outcome. */
  /** A moto-taxi for the rest of a long way (backend sims/moto.go). */
  /** A ride in the commune (world3d/moto.ts): a moto-taxi, a taxi, the woro-woro, a gbaka. */
  moto: (id: string, metres: number, kind = 'moto') => post<ActionResult>(`/sims/${id}/moto`, { metres, kind }),
  /** Vehicles of one's own (backend sims/garage.go): what the Sim has; a place bought, a vehicle bought or sold, a drive over (its petrol). */
  garage: (id: string) => request<Garage>(`/sims/${id}/garage`),
  garageAct: (id: string, action: 'parking' | 'buy' | 'sell' | 'drive', body: { kind?: string; model?: string; color?: string; vehicle?: number; metres?: number }) => post<ActionResult>(`/sims/${id}/garage/${action}`, body),
  /** Les défis (backend sims/defi.go): the best scores, and a score played during the activity. */
  defis: (id: string) => request<{ best: Record<string, number> }>(`/sims/${id}/defis`),
  defi: (id: string, kind: string, score: number) => post<ActionResult>(`/sims/${id}/defi`, { kind, score }),
  /** Babi Foot's career: read, the season saved, a player signed (paid in Djai) or let go. */
  footCareer: (id: string) => request<FootCareerView>(`/sims/${id}/foot`),
  footSave: (id: string, club: string, season: unknown) => request<FootCareerView>(`/sims/${id}/foot`, { method: 'PUT', body: JSON.stringify({ club, season }) }),
  footSign: (id: string, player: string) => post<ActionResult>(`/sims/${id}/foot/sign/${player}`, {}),
  footRelease: (id: string, player: string) => post<FootCareerView>(`/sims/${id}/foot/release/${player}`, {}),
  /** An outing (backend sims/outing.go): friends met in the game come at once, player friends are invited. */
  outing: (id: string, o: { placeId: string; interactionId: string; friends: string[]; players: string[] }) => post<ActionResult>(`/sims/${id}/outing`, o),
  chatFree: (id: string, npc: { id: string; name: string; gender: string; seed: number; look?: Look }, text: string, about: { before: { who: 'me' | 'them'; text: string }[]; job: string; doing?: string; languages: string[]; rapport: number; met: number }) => post<ActionResult>(`/sims/${id}/chat/free`, { with: npc, text, ...about }),
  chat: (id: string, npc: { id: string; name: string; gender: string; seed: number; look?: Look }, topic: string, said?: string, lang?: string) => post<ActionResult>(`/sims/${id}/chat`, { with: npc, topic, said: said ?? '', lang: lang ?? '' }),
  setLanguages: (id: string, languages: string[]) => request<{ languages: string[] }>(`/sims/${id}/languages`, { method: 'PUT', body: JSON.stringify({ languages }) }),
  street: (id: string, vendor: string, choice?: string) => post<ActionResult>(`/sims/${id}/street`, { vendor, choice: choice ?? '' }),
  /** The nouchis of a couloir got the Sim: they take what's in its pockets (the API says how much). */
  robbed: (id: string, spot: string) => post<ActionResult>(`/sims/${id}/robbed`, { spot }),
  stop: (id: string) => post<ActionResult>(`/sims/${id}/stop`, {}),
  /** The testers' toolbox (pass: the code typed on /testeur). */
  tester: (id: string, pass: string, action: 'age' | 'money' | 'needs' | 'finish' | 'apps', extra: { stage?: string; amount?: number } = {}) => post<ActionResult>(`/sims/${id}/tester`, { pass, action, ...extra }),
  /** Other players: who's in the commune, invitations, player friends. */
  around: (id: string) => request<Around>(`/sims/${id}/around`),
  /** How many play at a court now, out of how many (backend court.Cap). */
  courtAt: (place: string) => request<{ sport: 'foot' | 'basket' | 'foot11'; cap: number; players: number; start?: number; end?: number }>(`/court/at/${place}`),
  /** Gbairai: the chats, a thread (after a message id), writing, blocking, reporting. */
  chats: (id: string) => request<Chat[]>(`/sims/${id}/gbairai`),
  thread: (id: string, friend: string, after = 0) => request<ChatMessage[]>(`/sims/${id}/gbairai/${friend}?after=${after}`),
  write: (id: string, friend: string, body: string) => post<ChatMessage>(`/sims/${id}/gbairai/${friend}`, { body }),
  /** Says whether this player is writing to the friend, and answers whether the friend is writing back. */
  typing: (id: string, friend: string, writing: boolean) => request<{ typing: boolean }>(`/sims/${id}/gbairai/${friend}/typing?writing=${writing ? 1 : 0}`),
  block: (id: string, friend: string, blocked: boolean) => post<{ blocked: boolean }>(`/sims/${id}/gbairai/${friend}/block`, { blocked }),
  report: (id: string, friend: string, reason: string, messageId?: number) => post<{ text: string }>(`/sims/${id}/gbairai/${friend}/report`, { reason, messageId }),
  lotoDraws: () => request<{ now: number; pays: Record<number, number>; draws: { id: number; name: string; at: number; numbers?: number[] }[] }>('/loto/draws'),
  buyLoto: (id: string, kiosk: string, draw: number, numbers: number[], stake: number) => post<ActionResult>(`/sims/${id}/loto`, { kiosk, draw, numbers, stake }),
  myLoto: (id: string) => request<LotoTicket[]>(`/sims/${id}/loto`),
  /** A ticket of one's own, as a message carries it ([ticket:…], components/SharedCard.tsx). */
  shareTicket: (id: string, kind: 'bet' | 'loto', ticket: number) => post<{ ref: string }>(`/sims/${id}/tickets/share`, { kind, id: ticket }),
  /** A ticket someone shared, as it stands now. */
  sharedTicket: (kind: string, ref: string, sig: string) => request<{ kind: 'bet' | 'loto'; owner: string; bet?: BetView; loto?: LotoTicket }>(`/tickets/${kind}/${ref}/${sig}`),
  betRounds: (app: string, sport = 'foot') => request<BetRounds>(`/bets/rounds?app=${app}&sport=${sport}`),
  placeBet: (id: string, app: string, stake: number, legs: { match: string; pick: string }[]) => post<ActionResult>(`/sims/${id}/bets`, { app, stake, legs }),
  settleBets: (id: string) => post<ActionResult>(`/sims/${id}/bets/settle`, {}),
  pushKey: () => request<{ key: string; web: boolean; app: boolean }>('/push/key'),
  subscribePush: (sub: unknown) => request<void>('/me/push', { method: 'POST', body: JSON.stringify(sub) }),
  buildPlan: (id: string, plan: string, lot = 0) => post<ActionResult>(`/sims/${id}/plot/plan`, { plan, lot }),
  clearPlot: (id: string, lot = 0) => post<ActionResult>(`/sims/${id}/plot/plan`, { clear: true, lot }),
  myBets: (id: string, app = '') => request<BetView[]>(`/sims/${id}/bets?app=${app}`),
  grin: (id: string, room: 'babi' | 'commune', after = 0) => request<{ room: string; messages: GrinMessage[] }>(`/sims/${id}/grin?room=${room}&after=${after}`),
  sayGrin: (id: string, room: 'babi' | 'commune', body: string) => post<{ id: number; body: string }>(`/sims/${id}/grin`, { room, body }),
  reportGrin: (id: string, msg: number, reason: string) => post<{ text: string }>(`/sims/${id}/grin/${msg}/report`, { reason }),
  direct: (id: string, after = 0) => request<{ name: string; reactions: string[]; posts: DirectPost[] }>(`/sims/${id}/grin/direct?after=${after}`),
  reactDirect: (id: string, postId: number, emoji: string) => post<{ reactions: Record<string, number>; mine: string }>(`/sims/${id}/grin/direct/${postId}/react`, { emoji }),
  stories: (id: string) => request<StoryRing[]>(`/sims/${id}/stories`),
  postStory: (id: string, photo: string, caption: string, source: 'jeu' | 'reel') => post<Story>(`/sims/${id}/stories`, { photo, caption, source }),
  /** A photo of the gallery put in one's story. */
  storyFromGallery: (id: string, photoId: number, caption: string) => post<Story>(`/sims/${id}/stories`, { photo: '', caption, source: 'jeu', photoId }),
  deleteStory: (id: string, story: number) => request<void>(`/sims/${id}/stories/${story}`, { method: 'DELETE' }),
  reportStory: (id: string, story: number, reason: string) => post<{ text: string }>(`/sims/${id}/stories/${story}/report`, { reason }),
  storyPhoto: (id: string, story: number) => `/sims/${id}/stories/${story}/photo`,
  tikiFeed: (id: string, tab: 'pour-toi' | 'abonnements' | 'favoris' | 'auteur', author = '') => request<TikiPost[]>(`/sims/${id}/tiki?tab=${tab}&author=${encodeURIComponent(author)}`),
  tikiProfile: (id: string, other: string) => request<TikiProfile>(`/sims/${id}/tiki/profile/${other}`),
  tikiComments: (id: string, postId: number) => request<TikiComment[]>(`/sims/${id}/tiki/${postId}/comments`),
  tikiComment: (id: string, postId: number, body: string) => post<{ id: string; body: string }>(`/sims/${id}/tiki/${postId}/comments`, { body }),
  tikiUncomment: (id: string, comment: string) => request<void>(`/sims/${id}/tiki/comments/${comment}`, { method: 'DELETE' }),
  tikiCommentLike: (id: string, comment: string, liked: boolean) => post<{ liked: boolean }>(`/sims/${id}/tiki/comments/${comment}/like`, { liked }),
  tikiCommentReport: (id: string, comment: string, reason: string) => post<{ text: string }>(`/sims/${id}/tiki/comments/${comment}/report`, { reason }),
  tikiSave: (id: string, postId: number, saved: boolean) => post<{ saved: boolean }>(`/sims/${id}/tiki/${postId}/save`, { saved }),
  tikiShare: (id: string, postId: number) => post<void>(`/sims/${id}/tiki/${postId}/share`, {}),
  tikiMe: (id: string) => request<TikiMe>(`/sims/${id}/tiki/me`),
  tikiPost: (id: string, photo: string, caption: string, theme: string, placeId: string, photoId?: number) => post<ActionResult>(`/sims/${id}/tiki`, { photo, caption, theme, placeId, photoId }),
  /** The phone's gallery (the camera's photos and selfies). */
  photos: (id: string) => request<{ photos: Photo[] }>(`/sims/${id}/photos`),
  takePhoto: (id: string, photo: string, kind: 'photo' | 'selfie', placeId: string) => post<{ photo: Photo }>(`/sims/${id}/photos`, { photo, kind, placeId }),
  deletePhoto: (id: string, photoId: number) => request<void>(`/sims/${id}/photos/${photoId}`, { method: 'DELETE' }),
  tikiLike: (id: string, postId: number, liked: boolean) => post<{ liked: boolean }>(`/sims/${id}/tiki/${postId}/like`, { liked }),
  tikiFollow: (id: string, other: string, follow: boolean) => post<{ follow: boolean }>(`/sims/${id}/tiki/follow/${other}`, { follow }),
  tikiReport: (id: string, postId: number, reason: string) => post<{ text: string }>(`/sims/${id}/tiki/${postId}/report`, { reason }),
  tikiDelete: (id: string, postId: number) => request<void>(`/sims/${id}/tiki/${postId}`, { method: 'DELETE' }),
  tikiPhoto: (id: string, postId: number) => `/sims/${id}/tiki/${postId}/photo`,
  tikiVideo: (id: string, postId: number) => `/sims/${id}/tiki/${postId}/video`,
  /** A recorded clip, with its first frame as the poster (a multipart form: the clip is too big for JSON). */
  tikiPostVideo: (id: string, clip: { video: Blob; poster: string; durationMs: number; sound: string }, caption: string, theme: string, placeId: string) => {
    const f = new FormData()
    f.append('video', clip.video, clip.video.type.includes('mp4') ? 'clip.mp4' : 'clip.webm')
    f.append('poster', clip.poster)
    f.append('durationMs', String(clip.durationMs))
    f.append('sound', clip.sound)
    f.append('caption', caption)
    f.append('theme', theme)
    f.append('placeId', placeId)
    return request<ActionResult>(`/sims/${id}/tiki`, { method: 'POST', body: f })
  },
  /** Babigram: the feeds, posting (instant), likes, saves, comments, follows, profiles, search and activity. An account is a Sim's id or « npc:<handle> » (sent as it is: the router reads the path undecoded). */
  gramFeed: (id: string, tab: 'accueil' | 'explorer' | 'auteur' | 'enregistres', author = '') => request<GramPost[]>(`/sims/${id}/gram?tab=${tab}&author=${encodeURIComponent(author)}`),
  flashe: (id: string) => request<{ contacts: FlashContact[]; left: number }>(`/sims/${id}/flashe`),
  flashSend: (id: string, p: { photo: string; caption: string; seconds: number; to: string[]; story: boolean; placeId: string }) => post<ActionResult>(`/sims/${id}/flashe`, p),
  flashFrom: (id: string, other: string) => request<{ ids: number[] }>(`/sims/${id}/flashe/from/${other}`),
  flashOpen: (id: string, snap: number) => post<FlashSnap>(`/sims/${id}/flashe/${snap}/open`, {}),
  flashReport: (id: string, snap: number, reason: string) => post<{ text: string }>(`/sims/${id}/flashe/${snap}/report`, { reason }),
  gramPost: (id: string, p: { photo: string; photoId?: number; caption: string; placeId: string; filter: string; ratio: 'carre' | 'portrait' }) => post<ActionResult>(`/sims/${id}/gram`, p),
  gramLike: (id: string, postId: number, on: boolean) => post<{ on: boolean }>(`/sims/${id}/gram/${postId}/like`, { on }),
  gramSave: (id: string, postId: number, on: boolean) => post<{ on: boolean }>(`/sims/${id}/gram/${postId}/save`, { on }),
  gramShare: (id: string, postId: number) => post<void>(`/sims/${id}/gram/${postId}/share`, {}),
  gramReport: (id: string, postId: number, reason: string) => post<{ text: string }>(`/sims/${id}/gram/${postId}/report`, { reason }),
  gramDelete: (id: string, postId: number) => request<void>(`/sims/${id}/gram/${postId}`, { method: 'DELETE' }),
  gramComments: (id: string, postId: number) => request<TikiComment[]>(`/sims/${id}/gram/${postId}/comments`),
  gramComment: (id: string, postId: number, body: string) => post<{ id: string; body: string }>(`/sims/${id}/gram/${postId}/comments`, { body }),
  gramUncomment: (id: string, comment: string) => request<void>(`/sims/${id}/gram/comments/${comment}`, { method: 'DELETE' }),
  gramCommentLike: (id: string, comment: string, on: boolean) => post<{ on: boolean }>(`/sims/${id}/gram/comments/${comment}/like`, { on }),
  gramCommentReport: (id: string, comment: string, reason: string) => post<{ text: string }>(`/sims/${id}/gram/comments/${comment}/report`, { reason }),
  gramFollow: (id: string, other: string, on: boolean) => post<{ on: boolean }>(`/sims/${id}/gram/follow/${other}`, { on }),
  gramProfile: (id: string, other: string) => request<GramProfile>(`/sims/${id}/gram/profile/${other}`),
  gramSearch: (id: string, q: string) => request<GramFound[]>(`/sims/${id}/gram/search?q=${encodeURIComponent(q)}`),
  gramActivity: (id: string) => request<GramActivity[]>(`/sims/${id}/gram/activity`),
  gramBio: (id: string, bio: string) => request<{ bio: string }>(`/sims/${id}/gram/bio`, { method: 'PUT', body: JSON.stringify({ bio }) }),
  /** One of the player's lots (0: the one lived in, else the first), and the houses built in the commune where the Sim is. */
  plot: (id: string, lot = 0) => request<Plot>(`/sims/${id}/plot${lot ? `?lot=${lot}` : ''}`),
  plots: (id: string) => request<Plot[]>(`/sims/${id}/plots`),
  /** Blocks placed and taken down; paid from the Sim's money. */
  build: (id: string, place: Block[], remove: [number, number, number][], furnish: Piece[] = [], unfurnish: [number, number, number][] = [], lot = 0) => request<ActionResult>(`/sims/${id}/plot`, { method: 'PUT', body: JSON.stringify({ place, remove, furnish, unfurnish, lot }) }),
  /** The lots for sale in a commune (where the Sim is when none is given), and the Sim's own (two at most a commune). */
  lots: (id: string, where?: LotWhere) => request<{ offers: LotOffer[]; lots: Plot[]; fees: number; adult: boolean; perCommune: number; max: number }>(`/sims/${id}/lots${where ? `?city=${encodeURIComponent(where.city)}&commune=${encodeURIComponent(where.commune)}` : ''}`),
  buyLot: (id: string, size: string, where?: LotWhere, upgrade = 0, spot?: { lat: number; lng: number }) => post<ActionResult>(`/sims/${id}/lot`, { size, ...where, upgrade, ...spot }),
  lotSpots: (id: string, city: string, commune: string) => request<LotSpot[]>(`/sims/${id}/lots/spots?city=${encodeURIComponent(city)}&commune=${encodeURIComponent(commune)}`),
  moveLot: (id: string, lot: number, lat: number, lng: number) => post<ActionResult>(`/sims/${id}/lot/move`, { lot, lat, lng }),
  /** A hotel's floors and prices, one floor's rooms, the Sim's stay; a room rented; the key handed back. */
  hotel: (id: string, place: string, floor = 0) => request<HotelView>(`/sims/${id}/hotel/${place}${floor ? `?floor=${floor}` : ''}`),
  bookRoom: (id: string, place: string, room: string, length: string) => post<ActionResult>(`/sims/${id}/hotel/${place}/book`, { room, length }),
  endStay: (id: string) => post<ActionResult>(`/sims/${id}/stay/end`, {}),
  /** A handful of notes over the club's dancers (backend sims/billets.go): a tap, not an activity. */
  billets: (id: string, place: string, amount: number) => post<ActionResult>(`/sims/${id}/billets`, { place, amount }),
  offrande: (id: string, amount: number) => post<ActionResult>(`/sims/${id}/offrande`, { amount }),
  /** Dodo: homes by the night in a commune; book one; let one's own house, or not. */
  dodo: (id: string, where?: LotWhere) => request<DodoView>(`/sims/${id}/dodo${where ? `?city=${encodeURIComponent(where.city)}&commune=${encodeURIComponent(where.commune)}` : ''}`),
  dodoBook: (id: string, listing: string, length: string) => post<ActionResult>(`/sims/${id}/dodo/book`, { listing, length }),
  dodoList: (id: string, lot: number, night: number, title = '') => post<ActionResult>(`/sims/${id}/dodo/list`, { lot, night, title }),
  dodoUnlist: (id: string, lot: number) => post<ActionResult>(`/sims/${id}/dodo/unlist`, { lot }),
  sellLot: (id: string, lot: number) => post<ActionResult>(`/sims/${id}/lot/sell`, { lot }),
  moveIn: (id: string, lot = 0) => post<ActionResult>(`/sims/${id}/plot/movein`, { lot }),
  meet: (id: string, to: string, action: 'saluer' | 'inviter' | 'rejoindre' | 'ajouter') => post<ActionResult>(`/sims/${id}/meet`, { to, action }),
  /** Friends between players: answer a request; invite a friend, wherever they are, to what the Sim is doing. */
  /** Two players together (backend sims/couple.go): ask, answer, or break it off. */
  couple: (id: string, other: string, action: 'proposer' | 'accepter' | 'refuser' | 'rompre') => post<ActionResult>(`/sims/${id}/friends/${other}/couple`, { action }),
  answerFriend: (id: string, other: string, answer: 'accepter' | 'refuser') => post<ActionResult>(`/sims/${id}/friends/${other}/answer`, { answer }),
  inviteFriend: (id: string, other: string) => post<ActionResult>(`/sims/${id}/friends/${other}/invite`, {}),
  /** Kinéo (backend sims/cinema.go): a cinema's day, a session's seats, the Sim's tickets, buying, the ticket at the door. */
  cinemaProgram: (cinema: string, day?: number) => request<CinemaProgram>(`/cinema/${cinema}/program${day !== undefined ? `?day=${day}` : ''}`),
  cinemaSeats: (cinema: string, salle: number, at: number) => request<CinemaSeats>(`/cinema/${cinema}/seats?salle=${salle}&at=${at}`),
  cinemaTickets: (id: string) => request<{ tickets: CinemaTicket[]; now: number }>(`/sims/${id}/cinema/tickets`),
  cinemaBuy: (id: string, o: { cinema: string; salle: number; at: number; seats: string[] }) => post<ActionResult>(`/sims/${id}/cinema/tickets`, o),
  cinemaUse: (id: string, ticket: number) => post<ActionResult>(`/sims/${id}/cinema/tickets/${ticket}/use`, {}),
  /** Les dames (backend sims/dames.go): the game going on, a game against a man of the grin or a friend challenged, the answer, the moves. */
  dames: (id: string) => request<{ game: DameGame | null }>(`/sims/${id}/dames`),
  damesStart: (id: string, o: { with: string; npc?: string; stake: number }) => post<ActionResult>(`/sims/${id}/dames`, o),
  damesAccept: (id: string, game: number) => post<ActionResult>(`/sims/${id}/dames/${game}/accept`, {}),
  damesAct: (id: string, game: number, action: 'move' | 'resign' | 'decline', path?: number[]) => post<{ game: DameGame }>(`/sims/${id}/dames/${game}/${action}`, path ? { path } : {}),
  /** 8 américain (backend sims/huit.go): the game going on, a table with the game's players or a friend challenged, the answer, the cards. */
  huit: (id: string) => request<{ game: HuitGame | null }>(`/sims/${id}/huit`),
  huitStart: (id: string, o: { with: string; npcs?: string[]; stake: number }) => post<ActionResult>(`/sims/${id}/huit`, o),
  huitAccept: (id: string, game: number) => post<ActionResult>(`/sims/${id}/huit/${game}/accept`, {}),
  huitAct: (id: string, game: number, action: 'play' | 'draw' | 'pass' | 'resign' | 'decline', play?: { card: number; suit: number; carte: boolean }) => post<{ game: HuitGame }>(`/sims/${id}/huit/${game}/${action}`, play ?? {}),
  answerInvite: (id: string, invite: string, answer: 'accepter' | 'refuser') => post<ActionResult>(`/sims/${id}/invites/${invite}`, { answer }),
  /** A soirée at home (backend sims/party.go): thrown with one of its themes, ended by its host. */
  throwParty: (id: string, theme: string) => post<ActionResult>(`/sims/${id}/soiree`, { theme }),
  /** One turn of the slot machine the Sim is playing (backend sims/machine.go). */
  machineSpin: (id: string, stake: number) => post<ActionResult>(`/sims/${id}/machine`, { stake }),
  /** Babi Bingo (backend sims/bingo.go): the rooms and the Sim's cards; cards for a room's next draw; the cards over settled. */
  bingo: (id: string) => request<BingoState>(`/sims/${id}/bingo`),
  /** A money game's « Historique »: the last rounds (before `avant`), today's and the week's totals. */
  historique: (id: string, jeu: string, avant?: string) => request<Historique>(`/sims/${id}/historique?jeu=${jeu}${avant ? `&avant=${encodeURIComponent(avant)}` : ''}`),
  buyBingo: (id: string, game: string, cards: number, stake: number) => post<ActionResult>(`/sims/${id}/bingo`, { game, cards, stake }),
  bingoPay: (id: string) => post<ActionResult>(`/sims/${id}/bingo/paye`, {}),
  /** Le godé (backend sims/gode.go): the round going on (or the last); start one with a stake, throw, call « grand » or « petit ». */
  gode: (id: string) => request<{ round: GodeRound | null }>(`/sims/${id}/gode`),
  godePlay: (id: string, action: 'start' | 'throw' | 'call', stake = 0, call = '') => post<ActionResult>(`/sims/${id}/gode`, { action, stake, call }),
  /** Babi Casino (backend sims/casino.go): a spin of the roulette, le 21 (the hand going on; a move), a ticket à gratter. */
  roulette: (id: string, bets: RouletteBet[]) => post<ActionResult>(`/sims/${id}/casino/roulette`, { bets }),
  blackjack: (id: string) => request<{ hand: BlackjackView | null }>(`/sims/${id}/casino/21`),
  blackjackMove: (id: string, move: BlackjackMove, stake = 0) => post<ActionResult>(`/sims/${id}/casino/21`, { move, stake }),
  scratch: (id: string, ticket: string) => post<ActionResult>(`/sims/${id}/casino/grattage`, { ticket }),
  /** L'Envol (backend sims/envol.go): the round (held till the next thing happens, 2 s at most), a bet on the next plane, cashing in now. */
  envol: (id: string) => request<EnvolState>(`/sims/${id}/casino/envol?attendre=1`),
  envolBet: (id: string, stake: number, auto: number) => post<ActionResult>(`/sims/${id}/casino/envol`, { stake, auto }),
  envolCash: (id: string) => post<ActionResult>(`/sims/${id}/casino/envol/encaisser`, {}),
  /** Babi Trade (backend sims/trade.go): the last minutes of a price and the Sim's calls; a call taken now. */
  trade: (id: string, asset: string) => request<TradeState>(`/sims/${id}/casino/trade?asset=${encodeURIComponent(asset)}`),
  tradeCall: (id: string, asset: string, dir: 'hausse' | 'baisse', stake: number, secs: number) => post<ActionResult>(`/sims/${id}/casino/trade`, { asset, dir, stake, secs }),
  endParty: (id: string) => post<ActionResult>(`/sims/${id}/soiree/fin`, {}),
}
