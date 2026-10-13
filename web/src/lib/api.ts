import type { ActionResult, HappeningNow, NewsItem, JournalEvent, Look, Sim, User, World } from './types'
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
}

export const api = {
  world: () => request<World>('/world'),
  news: () => request<{ items: NewsItem[]; updated: string }>('/news'),
  happening: (commune: string, gameMinutes: number) => request<HappeningNow>(`/happening?commune=${encodeURIComponent(commune)}&t=${Math.floor(gameMinutes)}`),
  googleLogin: (credential: string) => post<Session>('/auth/google', { credential }),
  devLogin: (name: string) => post<Session>('/auth/dev', { name }),
  register: (name: string, email: string, password: string) => post<Session>('/auth/register', { name, email, password }),
  login: (email: string, password: string) => post<Session>('/auth/login', { email, password }),
  me: () => request<User>('/me'),
  sims: () => request<Sim[]>('/sims'),
  sim: (id: string) => request<Sim & { journal: JournalEvent[] }>(`/sims/${id}`),
  createSim: (sim: NewSim) => post<Sim>('/sims', sim),
  deleteSim: (id: string) => request<void>(`/sims/${id}`, { method: 'DELETE' }),
  interact: (id: string, placeId: string, interactionId: string) =>
    post<ActionResult>(`/sims/${id}/interact`, { placeId, interactionId }),
  travel: (id: string, city: string, commune: string) => post<ActionResult>(`/sims/${id}/travel`, { city, commune }),
  career: (id: string, career: string) => post<ActionResult>(`/sims/${id}/career`, { career }),
  move: (id: string, housing: string) => post<ActionResult>(`/sims/${id}/move`, { housing }),
  repay: (id: string, what: 'loan' | 'rent', amount: number) => post<ActionResult>(`/sims/${id}/repay`, { what, amount }),
}
