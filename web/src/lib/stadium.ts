import { useEffect, useState } from 'react'

// The stadium's agenda (backend game/stadium.go, GET /stadium): the match or
// the concert on now, and the week's. Shared by the place sheet and the 3D
// stadium; asked again every five minutes.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

export type StadiumEvent = { kind: 'match' | 'concert'; title: string; detail: string; start: number; end: number; home?: string; away?: string; score?: string; homeGoals?: number[]; awayGoals?: number[]; artist?: string; genre?: string }
export type Agenda = { now: number; on: StadiumEvent | null; agenda: StadiumEvent[] }

/** How long before the start the doors open, in minutes (game.DoorsOpen). */
export const DOORS_OPEN = 60

const cache = new Map<string, { at: number; data: Promise<Agenda | null> }>()
function load(place: string) {
  const c = cache.get(place)
  if (c && Date.now() - c.at < 5 * 60_000) return c.data
  const data = fetch(`${BASE}/stadium?place=${encodeURIComponent(place)}`)
    .then((r) => (r.ok ? (r.json() as Promise<Agenda>) : null))
    .catch(() => null)
  cache.set(place, { at: Date.now(), data })
  return data
}

export function useStadium(place: string | null) {
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  useEffect(() => {
    if (!place) return
    let stop = false
    const get = () => void load(place).then((a) => !stop && setAgenda(a))
    get()
    const t = setInterval(get, 5 * 60_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [place])
  return agenda
}

/** What is on at this game minute (from the doors opening to the end). */
export function eventAt(agenda: Agenda | null, minute: number) {
  return agenda?.agenda.find((e) => minute >= e.start - DOORS_OPEN && minute < e.end) ?? null
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
/** « samedi 16 h », « vendredi 20 h » */
export function when(minute: number) {
  const day = DAYS[Math.floor(minute / 1440) % 7]
  const h = Math.floor(minute / 60) % 24
  const m = minute % 60
  return `${day} ${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`
}
