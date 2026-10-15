import type { ActionResult, Block, HappeningNow, NewsItem, Look, Plot, Sim, User, World, Ride, Around, Place } from './types'
import { useSession } from '../store/session'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
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
    throw new ApiError(res.status, body.error ?? res.statusText)
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
}

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
  setApp: (id: string, app: string, install: boolean) => post<ActionResult>(`/sims/${id}/apps`, { app, install }),
  send: (id: string, to: string, amount: number) => post<ActionResult>(`/sims/${id}/send`, { to, amount }),
  friend: (id: string, friend: string, action: string) => post<ActionResult>(`/sims/${id}/friend`, { friend, action }),
  gang: (id: string, action: string) => post<ActionResult>(`/sims/${id}/gang`, { action }),
  order: (id: string, place: string, dish: string) => post<ActionResult>(`/sims/${id}/order`, { place, dish }),
  /** Buy alloco from the tantie's stall in the street (she may have none left). */
  /** Talk to a passer-by: what they answer comes back as the outcome. */
  chat: (id: string, npc: { id: string; name: string; gender: string; seed: number }, topic: string) => post<ActionResult>(`/sims/${id}/chat`, { with: npc, topic }),
  street: (id: string, vendor: string) => post<ActionResult>(`/sims/${id}/street`, { vendor }),
  stop: (id: string) => post<ActionResult>(`/sims/${id}/stop`, {}),
  /** Other players: who's in the commune, invitations, player friends. */
  around: (id: string) => request<Around>(`/sims/${id}/around`),
  /** The player's own plot, and the houses built in the commune where the Sim is. */
  plot: (id: string) => request<Plot>(`/sims/${id}/plot`),
  plots: (id: string) => request<Plot[]>(`/sims/${id}/plots`),
  /** Blocks placed and taken down; paid from the Sim's money. */
  build: (id: string, place: Block[], remove: [number, number, number][]) => request<ActionResult>(`/sims/${id}/plot`, { method: 'PUT', body: JSON.stringify({ place, remove }) }),
  meet: (id: string, to: string, action: 'saluer' | 'inviter' | 'rejoindre') => post<ActionResult>(`/sims/${id}/meet`, { to, action }),
  answerInvite: (id: string, invite: string, answer: 'accepter' | 'refuser') => post<ActionResult>(`/sims/${id}/invites/${invite}`, { answer }),
}
