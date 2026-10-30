import { useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { worldTime } from '../../lib/worldClock'

// How full the street is, by commune and by the hour (the update « plateau-vivant »): the passers-by,
// the traffic, the cars parked along the kerbs, the crowd of the offices, the scenes the street plays.
// Every commune is as it always was (BASE) but those with a profile of their own: the Plateau, the
// business district, packed on a weekday from 7 h 30 to 18 h (the crowd at the food stalls at lunch,
// the kerbs full bumper to bumper), thinning out in the evening, nearly empty on the weekend (a few
// guards, a jogger, the kerbs bare). From the shared clock: the same street on every screen.

export type StreetDensity = {
  /** The passers-by (OpenWorld Passersby): a share of the usual number per cell. */
  walkers: number
  /** The traffic (OpenWorld RoadTraffic): a share of the usual cars per cell. */
  traffic: number
  /** The share of the kerb's places with a car parked in it (0: none, plateauLife.tsx ParkedCars). */
  parked: number
  /** The office crowd on the pavements, a share of its cap (plateauLife.tsx Crowd). */
  office: number
  /** Lunch: groups round the food stalls. */
  lunch: boolean
  /** The living city's scenes (livingCity.tsx): a share of their usual chance. */
  scenes: number
  /** The weekend's empty streets: a few guards at the doors, a jogger. */
  quiet: boolean
}

export const BASE: StreetDensity = { walkers: 1, traffic: 1, parked: 0, office: 0, lunch: false, scenes: 1, quiet: false }

type Key = { h: number } & Omit<StreetDensity, 'lunch' | 'quiet'>
/** A day's profile: its values at these hours, eased in between. */
type Day = Key[]

// The Plateau on a weekday: the offices open at 7 h 30, lunch from 12 to 14, out from 17 h 30.
const PLATEAU_WEEK: Day = [
  { h: 0, walkers: 0.35, traffic: 0.5, parked: 0.08, office: 0, scenes: 0.4 },
  { h: 5.5, walkers: 0.4, traffic: 0.6, parked: 0.1, office: 0, scenes: 0.5 },
  { h: 6.75, walkers: 0.9, traffic: 1.4, parked: 0.45, office: 0.35, scenes: 0.9 },
  { h: 7.5, walkers: 1, traffic: 2, parked: 0.9, office: 1, scenes: 1 },
  { h: 12, walkers: 1, traffic: 1.8, parked: 0.92, office: 1, scenes: 1 },
  { h: 14, walkers: 1, traffic: 1.8, parked: 0.92, office: 1, scenes: 1 },
  { h: 17.5, walkers: 1, traffic: 2, parked: 0.85, office: 0.85, scenes: 1 },
  { h: 18.5, walkers: 0.8, traffic: 1.4, parked: 0.4, office: 0.3, scenes: 0.8 },
  { h: 20.5, walkers: 0.45, traffic: 0.7, parked: 0.12, office: 0, scenes: 0.5 },
  { h: 24, walkers: 0.35, traffic: 0.5, parked: 0.08, office: 0, scenes: 0.4 },
]
// Friday: the « descente » comes early (from noon, in pagne).
const PLATEAU_FRIDAY: Day = PLATEAU_WEEK.map((k) => (k.h === 17.5 ? { ...k, h: 15.5, office: 0.6, parked: 0.7 } : k))
// Saturday and Sunday: nearly nobody.
const PLATEAU_WEEKEND: Day = [
  { h: 0, walkers: 0.2, traffic: 0.35, parked: 0.04, office: 0, scenes: 0.3 },
  { h: 24, walkers: 0.2, traffic: 0.35, parked: 0.04, office: 0, scenes: 0.3 },
]

/** At an hour of a day's profile, eased between its keys. */
function at(day: Day, h: number): Omit<StreetDensity, 'lunch' | 'quiet'> {
  const i = Math.max(1, day.findIndex((k) => k.h > h))
  const [a, b] = [day[i - 1], day[i] ?? day[i - 1]]
  const k = b.h > a.h ? Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h))) : 0
  const mix = (x: number, y: number) => x + (y - x) * k
  return { walkers: mix(a.walkers, b.walkers), traffic: mix(a.traffic, b.traffic), parked: mix(a.parked, b.parked), office: mix(a.office, b.office), scenes: mix(a.scenes, b.scenes) }
}

/** The communes with a profile of their own (by id): how full at a day (0 = Monday) and an hour. */
const PROFILES: Record<string, (day: number, h: number) => StreetDensity> = {
  plateau: (day, h) => {
    const weekend = day >= 5
    const v = at(weekend ? PLATEAU_WEEKEND : day === 4 ? PLATEAU_FRIDAY : PLATEAU_WEEK, h)
    return { ...v, lunch: !weekend && h >= 12 && h < 14, quiet: weekend && h >= 6 && h < 20 }
  },
}

/** How full the street is in a commune at a game minute (0 = Monday 00:00); `open`: its update is open. */
export function streetDensity(commune: string, gameMinutes: number, open: boolean): StreetDensity {
  const p = open ? PROFILES[commune] : undefined
  if (!p) return BASE
  return p(Math.floor(gameMinutes / 1440) % 7, (gameMinutes % 1440) / 60)
}

/** Now on the shared clock, looked at again every 20 seconds (a new object only when it changed). */
export function useStreetDensity(commune: string, open: boolean) {
  const now = () => streetDensity(commune, worldTime() / 60, open)
  const [d, setD] = useState(now)
  const [key, setKey] = useState(`${commune}|${open}`)
  if (key !== `${commune}|${open}`) {
    setKey(`${commune}|${open}`)
    setD(now())
  }
  const last = useState({ t: 0 })[0]
  useFrame(() => {
    const t = performance.now()
    if (t - last.t < 20000) return
    last.t = t
    const n = now()
    if (Math.abs(n.walkers - d.walkers) > 0.05 || Math.abs(n.traffic - d.traffic) > 0.05 || Math.abs(n.parked - d.parked) > 0.03 || Math.abs(n.office - d.office) > 0.03 || Math.abs(n.scenes - d.scenes) > 0.05 || n.lunch !== d.lunch || n.quiet !== d.quiet) setD(n)
  })
  return d
}
