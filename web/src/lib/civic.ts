import { useEffect, useState } from 'react'
import { api } from './api'
import type { Interaction, Sim, Terrain, World } from './types'
import { t as tr, locale } from './i18n'

// The republic in the street (backend game/civic.go, politics/presidency.go):
// the president's measures lowering prices, and what a Sim may do for the
// campaign or at the stadium's big days, shown in the places' menus.

/** The places where the republic has something to do: the campaign's, the stadium's big days. */
export const CIVIC_KINDS = new Set(['mairie', 'market', 'maquis', 'stade'])

/** The interactions of the republic: shown only when they mean something for the Sim. */
export const CIVIC = { tour: 'campagne-terrain', militant: 'militer', fete: 'stade-fete', meeting: 'stade-meeting' } as const
const CIVIC_IDS: string[] = Object.values(CIVIC)

/** The share off a price at a kind of place under the measures in force (the largest). */
export function measureOff(world: World, sim: Sim, kind: string) {
  let off = 0
  for (const id of sim.measures ?? []) {
    const m = world.measures?.find((x) => x.id === id)
    if (m?.kinds?.includes(kind)) off = Math.max(off, m.off)
  }
  return off
}

/** The share off the public transport's fares (the « transport » measure): the taxi, the woro-woro, the gbaka, the car. */
export function fareOff(world: World, sim: Sim) {
  let off = 0
  for (const id of sim.measures ?? []) {
    const m = world.measures?.find((x) => x.id === id)
    if (m?.fares) off = Math.max(off, m.off)
  }
  return off
}
/** The rides the « transport » measure halves (backend sims.publicFare). */
export const PUBLIC_RIDES = new Set(['taxi', 'woro', 'compteur', 'gbaka', 'car', 'metro'])

/** A price with a share off, rounded to 25 Djai, as the server does. */
export const discounted = (price: number, off: number) => (price <= 0 || off <= 0 ? price : Math.max(0, Math.round((price * (1 - off)) / 25) * 25))

/** An interaction at its price under the measures in force. */
export function withMeasures(world: World, sim: Sim, kind: string, it: Interaction): Interaction {
  const off = measureOff(world, sim, kind)
  return off > 0 && it.cost > 0 ? { ...it, cost: discounted(it.cost, off) } : it
}

/** What the Sim may do in the street for the republic, read when its menu is open at a place where it counts. */
export function useTerrain(simId: string, on: boolean) {
  const [terrain, setTerrain] = useState<Terrain | null>(null)
  useEffect(() => {
    if (!on) return
    let stop = false
    const get = () => void api.terrain(simId).then((t) => !stop && setTerrain(t), () => undefined)
    get()
    const t = setInterval(get, 60_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [simId, on])
  return terrain
}

/**
 * Whether one of the republic's interactions shows at a place, and why it can't be
 * done now (null: it can): the tour for a candidate during the campaign, the militant's
 * day on a call of the party here, the Fête and the meeting at their stadium.
 */
export function civicState(it: Interaction, terrain: Terrain | null, placeId: string, communeId: string): { show: boolean; why: string | null } {
  if (!CIVIC_IDS.includes(it.id)) return { show: true, why: null }
  if (!terrain) return { show: false, why: null }
  switch (it.id) {
    case CIVIC.tour: {
      const here = terrain.stands.some((s) => s.kind === 'president' || s.commune === communeId)
      return { show: here, why: terrain.toured.includes(placeId) ? tr('Déjà fait campagne ici') : null }
    }
    case CIVIC.militant: {
      const call = terrain.calls.find((c) => c.commune === communeId && !c.done && c.taken < c.slots)
      return { show: !!call, why: null }
    }
    default: {
      const kind = it.id === CIVIC.fete ? 'fete' : 'meeting'
      const e = terrain.events.find((x) => x.kind === kind && x.place === placeId)
      if (!e) return { show: false, why: null }
      const opens = Date.parse(e.startsAt) - 30 * 60_000
      if (Date.now() < opens) return { show: true, why: tr('Le {0}', { 0: new Date(e.startsAt).toLocaleString(locale(), { weekday: 'long', hour: '2-digit', minute: '2-digit' }) }) }
      return { show: true, why: null }
    }
  }
}
