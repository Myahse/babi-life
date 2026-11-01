import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { whereabouts } from '../whereabouts'
import { setNearBuilding, type Visitable } from '../visit'
import { hash, type XZ } from './geo'
import type { Building } from './tiles'
import { t as tr } from '../../lib/i18n'

// The ordinary building the Sim stands at (within a couple of metres of one of its walls): what it is, by
// its look and by chance, the same every time (a shop or a maquis on a shopping street, a neighbour's house
// under tin, offices or flats in a tall block, a hotel), for the screen to offer to go in.

const REACH = 2.6

function kindOf(b: Building): Visitable['kind'] {
  const h = hash(Math.round(b.c[0]), Math.round(b.c[1]), 521)
  // (A hotel along a big road: its bar, a maquis inside.)
  if (b.style === 'hotel') return 'maquis'
  if (b.style === 'civic') return 'office'
  if (b.style === 'commerce') return h < 0.35 ? 'boutique' : h < 0.6 ? 'maquis' : h < 0.72 ? 'pharmacie' : h < 0.86 ? 'salon' : 'barbier'
  if (b.tin) return h < 0.75 ? 'home' : h < 0.88 ? 'boutique' : 'maquis'
  if (b.height >= 15) return h < 0.55 ? 'office' : 'home'
  return h < 0.5 ? 'home' : h < 0.7 ? 'boutique' : h < 0.85 ? 'maquis' : 'salon'
}

const NAMES: Record<Visitable['kind'], () => string[]> = {
  boutique: () => [tr('Boutique du quartier'), tr('Alimentation générale'), tr('Quincaillerie du coin')],
  maquis: () => [tr('Maquis du coin'), tr('Chez Tantie'), tr('Le petit maquis')],
  home: () => [tr('Chez les voisins'), tr('La cour commune'), tr("Chez la famille d'à côté")],
  office: () => [tr('Bureaux'), tr('Un immeuble de bureaux')],
  pharmacie: () => [tr('Pharmacie de quartier')],
  salon: () => [tr('Salon de coiffure')],
  barbier: () => [tr('Chez le barbier')],
}

/** The distance from p to a ring's walls. */
function toWalls(p: XZ, ring: XZ[]) {
  let best = Infinity
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2))
    best = Math.min(best, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t)))
  }
  return best
}

export function NearBuilding({ buildings, off }: { buildings: Building[]; /** busy elsewhere (inside a place, driving): none */ off: boolean }) {
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.4) return
    last.current = clock.elapsedTime
    const p = whereabouts.sim
    if (import.meta.env.DEV) Object.assign(globalThis, { __someWall: buildings.find((b) => Math.hypot(b.c[0] - p[0], b.c[1] - p[1]) < 60)?.ring[0] ?? null, __nearOff: off })
    if (off) return setNearBuilding(null)
    let found: Visitable | null = null
    let bestD = REACH
    for (const b of buildings) {
      if (Math.abs(b.c[0] - p[0]) > 80 || Math.abs(b.c[1] - p[1]) > 80) continue
      const d = toWalls(p, b.ring)
      if (d < bestD) {
        bestD = d
        const kind = kindOf(b)
        const names = NAMES[kind]()
        found = { key: `${Math.round(b.c[0])}:${Math.round(b.c[1])}`, kind, name: names[Math.floor(hash(Math.round(b.c[1]), Math.round(b.c[0]), 7) * names.length)], at: b.c }
      }
    }
    setNearBuilding(found)
    if (import.meta.env.DEV) Object.assign(globalThis, { __nearBuilding: found })
  })
  useEffect(() => () => setNearBuilding(null), [])
  return null
}
