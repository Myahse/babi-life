import type { ActionResult, Block, HappeningNow, NewsItem, Look, Plot, Sim, User, World, Ride, Around, Place, Chat, ChatMessage, Story, StoryRing, TikiPost, TikiMe, TikiComment, TikiProfile, Piece, Lot, LotOffer, GrinMessage, BetRounds, BetView } from './types'
import { useSession } from '../store/session'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** A photo behind the login (a story, a post): fetched with the token, as an object URL. */
export async function photoURL(path: string) {
  const token = useSession.getState().token
  const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiError(res.status, 'photo introuvable')
  return URL.createObjectURL(await res.blob())
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useSession.getState().token
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (res.status === 401 && token) useSession.getState().signOut()
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // A 404 with no message of ours: the server doesn't know this address yet (an older version is running).
    throw new ApiError(res.status, body.error ?? (res.status === 404 ? "Le serveur n'a pas encore cette fonction : il doit être mis à jour." : res.statusText))
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

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

export const api = {
  world: () => request<World>('/world'),
  /** A commune's places from the map (OpenStreetMap) within r km of a point. */
  mapPlace: (commune: string, id: string) => request<{ places: Place[]; total: number }>(`/places?commune=${encodeURIComponent(commune)}&id=${encodeURIComponent(id)}`),
  mapPlaces: (commune: string, lat: number, lng: number, r = 1.2) => request<{ places: Place[]; total: number }>(`/places?commune=${encodeURIComponent(commune)}&lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&r=${r}`),
  news: () => request<{ items: NewsItem[]; updated: string }>('/news'),
  happening: (city: string, commune: string, gameMinutes: number) => request<HappeningNow>(`/happening?city=${encodeURIComponent(city)}&commune=${encodeURIComponent(commune)}&t=${Math.floor(gameMinutes)}`),
  googleLogin: (credential: string) => post<Session>('/auth/google', { credential }),
  devLogin: (name: string) => post<Session>('/auth/dev', { name }),
  register: (u: { firstName: string; lastName: string; username: string; email: string; password: string }) => post<Session>('/auth/register', u),
  /** `login` is an e-mail or a username. */
  login: (login: string, password: string) => post<Session>('/auth/login', { email: login, password }),
  usernameAvailable: (u: string) => request<{ available: boolean }>(`/auth/username?u=${encodeURIComponent(u)}`),
  setUsername: (username: string) => request<User>('/me/username', { method: 'PUT', body: JSON.stringify({ username }) }),
  me: () => request<User>('/me'),
  /** With the testers' code (or the admin key), the account becomes a tester's. */
  becomeTester: (code: string) => post<User>('/me/tester', { code }),
  sims: () => request<Sim[]>('/sims'),
  sim: (id: string) => request<ActionResult>(`/sims/${id}`),
  createSim: (sim: NewSim) => post<Sim>('/sims', sim),
  deleteSim: (id: string) => request<void>(`/sims/${id}`, { method: 'DELETE' }),
  interact: (id: string, placeId: string, interactionId: string) =>
    post<ActionResult>(`/sims/${id}/interact`, { placeId, interactionId }),
  travel: (id: string, city: string, commune: string, ride?: Ride) => post<ActionResult>(`/sims/${id}/travel`, { city, commune, ...ride }),
  career: (id: string, career: string) => post<ActionResult>(`/sims/${id}/career`, { career }),
  move: (id: string, housing: string) => post<ActionResult>(`/sims/${id}/move`, { housing }),
  repay: (id: string, what: 'loan' | 'rent', amount: number) => post<ActionResult>(`/sims/${id}/repay`, { what, amount }),
  /** The wish list; with a Sim, it is born there (the family is drawn by the server). */
  joinWaitlist: (body: WaitlistJoin) => post<{ ok: boolean; already: boolean; count: number; birth?: { family: string; commune: string } }>('/waitlist', body),
  changeLook: (id: string, look: Look) => post<ActionResult>(`/sims/${id}/look`, look),
  setApp: (id: string, app: string, install: boolean) => post<ActionResult>(`/sims/${id}/apps`, { app, install }),
  send: (id: string, to: string, amount: number) => post<ActionResult>(`/sims/${id}/send`, { to, amount }),
  friend: (id: string, friend: string, action: string) => post<ActionResult>(`/sims/${id}/friend`, { friend, action }),
  gang: (id: string, action: string) => post<ActionResult>(`/sims/${id}/gang`, { action }),
  order: (id: string, place: string, dish: string) => post<ActionResult>(`/sims/${id}/order`, { place, dish }),
  /** Buy alloco from the tantie's stall in the street (she may have none left). */
  /** Talk to a passer-by: what they answer comes back as the outcome. */
  chat: (id: string, npc: { id: string; name: string; gender: string; seed: number }, topic: string, said?: string) => post<ActionResult>(`/sims/${id}/chat`, { with: npc, topic, said: said ?? '' }),
  street: (id: string, vendor: string, choice?: string) => post<ActionResult>(`/sims/${id}/street`, { vendor, choice: choice ?? '' }),
  /** The nouchis of a couloir got the Sim: they take what's in its pockets (the API says how much). */
  robbed: (id: string, spot: string) => post<ActionResult>(`/sims/${id}/robbed`, { spot }),
  stop: (id: string) => post<ActionResult>(`/sims/${id}/stop`, {}),
  /** The testers' toolbox (pass: the code typed on /testeur). */
  tester: (id: string, pass: string, action: 'age' | 'money' | 'needs' | 'finish' | 'apps', extra: { stage?: string; amount?: number } = {}) => post<ActionResult>(`/sims/${id}/tester`, { pass, action, ...extra }),
  /** Other players: who's in the commune, invitations, player friends. */
  around: (id: string) => request<Around>(`/sims/${id}/around`),
  /** Gbairai: the chats, a thread (after a message id), writing, blocking, reporting. */
  chats: (id: string) => request<Chat[]>(`/sims/${id}/gbairai`),
  thread: (id: string, friend: string, after = 0) => request<ChatMessage[]>(`/sims/${id}/gbairai/${friend}?after=${after}`),
  write: (id: string, friend: string, body: string) => post<ChatMessage>(`/sims/${id}/gbairai/${friend}`, { body }),
  block: (id: string, friend: string, blocked: boolean) => post<{ blocked: boolean }>(`/sims/${id}/gbairai/${friend}/block`, { blocked }),
  report: (id: string, friend: string, reason: string, messageId?: number) => post<{ text: string }>(`/sims/${id}/gbairai/${friend}/report`, { reason, messageId }),
  lotoDraws: () => request<{ now: number; pays: Record<number, number>; draws: { id: number; name: string; at: number; numbers?: number[] }[] }>('/loto/draws'),
  buyLoto: (id: string, kiosk: string, draw: number, numbers: number[], stake: number) => post<ActionResult>(`/sims/${id}/loto`, { kiosk, draw, numbers, stake }),
  betRounds: (app: string) => request<BetRounds>(`/bets/rounds?app=${app}`),
  placeBet: (id: string, app: string, stake: number, legs: { match: string; pick: string }[]) => post<ActionResult>(`/sims/${id}/bets`, { app, stake, legs }),
  settleBets: (id: string) => post<ActionResult>(`/sims/${id}/bets/settle`, {}),
  buildPlan: (id: string, plan: string) => post<ActionResult>(`/sims/${id}/plot/plan`, { plan }),
  clearPlot: (id: string) => post<ActionResult>(`/sims/${id}/plot/plan`, { clear: true }),
  myBets: (id: string, app = '') => request<BetView[]>(`/sims/${id}/bets?app=${app}`),
  grin: (id: string, room: 'babi' | 'commune', after = 0) => request<{ room: string; messages: GrinMessage[] }>(`/sims/${id}/grin?room=${room}&after=${after}`),
  sayGrin: (id: string, room: 'babi' | 'commune', body: string) => post<{ id: number; body: string }>(`/sims/${id}/grin`, { room, body }),
  reportGrin: (id: string, msg: number, reason: string) => post<{ text: string }>(`/sims/${id}/grin/${msg}/report`, { reason }),
  stories: (id: string) => request<StoryRing[]>(`/sims/${id}/stories`),
  postStory: (id: string, photo: string, caption: string, source: 'jeu' | 'reel') => post<Story>(`/sims/${id}/stories`, { photo, caption, source }),
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
  tikiPost: (id: string, photo: string, caption: string, theme: string, placeId: string) => post<ActionResult>(`/sims/${id}/tiki`, { photo, caption, theme, placeId }),
  tikiLike: (id: string, postId: number, liked: boolean) => post<{ liked: boolean }>(`/sims/${id}/tiki/${postId}/like`, { liked }),
  tikiFollow: (id: string, other: string, follow: boolean) => post<{ follow: boolean }>(`/sims/${id}/tiki/follow/${other}`, { follow }),
  tikiReport: (id: string, postId: number, reason: string) => post<{ text: string }>(`/sims/${id}/tiki/${postId}/report`, { reason }),
  tikiDelete: (id: string, postId: number) => request<void>(`/sims/${id}/tiki/${postId}`, { method: 'DELETE' }),
  tikiPhoto: (id: string, postId: number) => `/sims/${id}/tiki/${postId}/photo`,
  /** The player's own plot, and the houses built in the commune where the Sim is. */
  plot: (id: string) => request<Plot>(`/sims/${id}/plot`),
  plots: (id: string) => request<Plot[]>(`/sims/${id}/plots`),
  /** Blocks placed and taken down; paid from the Sim's money. */
  build: (id: string, place: Block[], remove: [number, number, number][], furnish: Piece[] = [], unfurnish: [number, number, number][] = []) => request<ActionResult>(`/sims/${id}/plot`, { method: 'PUT', body: JSON.stringify({ place, remove, furnish, unfurnish }) }),
  /** Lots for sale where the Sim is, and the one it owns. */
  lots: (id: string) => request<{ offers: LotOffer[]; lot: Lot | null; fees: number; adult: boolean }>(`/sims/${id}/lots`),
  buyLot: (id: string, size: string) => post<ActionResult>(`/sims/${id}/lot`, { size }),
  moveIn: (id: string) => post<ActionResult>(`/sims/${id}/plot/movein`, {}),
  meet: (id: string, to: string, action: 'saluer' | 'inviter' | 'rejoindre' | 'ajouter') => post<ActionResult>(`/sims/${id}/meet`, { to, action }),
  /** Friends between players: answer a request; invite a friend, wherever they are, to what the Sim is doing. */
  answerFriend: (id: string, other: string, answer: 'accepter' | 'refuser') => post<ActionResult>(`/sims/${id}/friends/${other}/answer`, { answer }),
  inviteFriend: (id: string, other: string) => post<ActionResult>(`/sims/${id}/friends/${other}/invite`, {}),
  answerInvite: (id: string, invite: string, answer: 'accepter' | 'refuser') => post<ActionResult>(`/sims/${id}/invites/${invite}`, { answer }),
}
