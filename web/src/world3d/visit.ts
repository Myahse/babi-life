import { useSyncExternalStore } from 'react'
import type { XZ } from './open/geo'

// The ordinary buildings of the street one can go into (open/nearBuilding.tsx finds the one the Sim stands at;
// the game screen offers « Entrer » and shows its inside, components/Visit.tsx): what it is, its name, where.

export type Visitable = { key: string; kind: 'boutique' | 'maquis' | 'home' | 'office' | 'pharmacie' | 'salon' | 'barbier'; name: string; at: XZ }

let near: Visitable | null = null
const listeners = new Set<() => void>()
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))
export function setNearBuilding(v: Visitable | null) {
  if (v?.key === near?.key) return
  near = v
  listeners.forEach((f) => f())
}
export const useNearBuilding = () => useSyncExternalStore(subscribe, () => near)
