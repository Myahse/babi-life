// The soirées players throw at home (backend sims/party.go, game/soiree.go):
// what one costs the host, how long it lasts, and its themes with their
// colours (the beams over the house, the bulbs, the sign).

import type { Furniture, Piece, Soiree, SoireeRoom } from '../lib/types'
import { fcfa } from './rules'
import { t as tr } from '../lib/i18n'

export const SOIREE_COST = 5000
export const SOIREE_HOURS = 3

export const SOIREE_THEMES: { id: string; label: string; colours: string[] }[] = [
  { id: 'coupe-decale', label: tr('Soirée coupé-décalé'), colours: ['#ff2d95', '#ffe600', '#2ee6ff'] },
  { id: 'zouglou', label: tr('Soirée zouglou'), colours: ['#f07a12', '#ffffff', '#0b9a52'] },
  { id: 'anniversaire', label: tr('Anniversaire'), colours: ['#ff8fab', '#ffd166', '#06d6a0'] },
  { id: 'blanche', label: tr('Soirée blanche'), colours: ['#ffffff', '#cfe8ff', '#ffd6f5'] },
  { id: 'pagne', label: tr('Soirée pagne'), colours: ['#f4a261', '#e76f51', '#2a9d8f'] },
  { id: 'cremaillere', label: tr('Crémaillère'), colours: ['#ffd166', '#ef476f', '#118ab2'] },
  { id: 'afro', label: tr('Soirée afrobeats'), colours: ['#a35bff', '#ff2d95', '#ffe600'] },
  { id: 'retro', label: tr('Soirée rétro'), colours: ['#ff6b6b', '#4ecdc4', '#ffe66d'] },
]

export const soireeColours = (theme: string) => (SOIREE_THEMES.find((t) => t.id === theme) ?? SOIREE_THEMES[0]).colours

// « soiree-deco »: the soirée's room the host arranges (backend game/soiree.go
// CheckLayout, checked the same there), and its entry.

/** A cell of the room kept clear: the stage, the dance floor, the way in. */
export const keptAt = (room: SoireeRoom, x: number, z: number) => room.kept.some((k) => x >= k.x0 && x < k.x1 && z >= k.z0 && z < k.z1)

/** A piece's footprint, turned. */
export const turned = (f: Furniture, r: number): [number, number] => (r % 2 ? [f.d, f.w] : [f.w, f.d])

/** The cells a piece covers. */
export function cellsOf(f: Furniture, p: Piece): [number, number][] {
  const [w, d] = turned(f, p[3])
  const out: [number, number][] = []
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) out.push([p[0] + x, p[2] + z])
  return out
}

/** Why a piece can't stand there among the others ('' when it can). */
export function misfit(room: SoireeRoom, others: Piece[], p: Piece): string {
  const byId = new Map(room.furniture.map((f) => [f.id, f]))
  const f = byId.get(p[4])
  if (!f) return tr('Ce meuble ne va pas dans la salle de la soirée.')
  const cells = cellsOf(f, p)
  if (cells.some(([x, z]) => x < 0 || z < 0 || x >= room.w || z >= room.d)) return tr('Ça dépasse de la salle : tourne-le ou pose-le ailleurs.')
  if (cells.some(([x, z]) => keptAt(room, x, z))) return tr("La scène, la piste de danse et l'entrée restent libres.")
  const taken = new Set(others.flatMap((o) => (byId.get(o[4]) ? cellsOf(byId.get(o[4])!, o).map(([x, z]) => `${x},${z}`) : [])))
  if (cells.some(([x, z]) => taken.has(`${x},${z}`))) return tr('Pas la place : il y a déjà quelque chose ici.')
  return ''
}

/**
 * Where one stands before a piece, facing it, in the room's metres (its
 * middle at the origin, as Interior's): the piece's front is its +z, turned
 * a quarter at a time as the furniture is drawn (world3d/build/Furniture).
 */
export function before(room: SoireeRoom, f: Furniture, p: Piece, gap = 0.6): { p: [number, number, number]; r: number } {
  const [w, d] = turned(f, p[3])
  const a = (-p[3] * Math.PI) / 2
  const [fx, fz] = [Math.sin(a), Math.cos(a)]
  const reach = f.d / 2 + gap
  const [cx, cz] = [p[0] + w / 2 - room.w / 2, p[2] + d / 2 - room.d / 2]
  // Turned to the wall: from its other side, within the room.
  const out = (x: number, z: number) => Math.abs(x) > room.w / 2 - 0.4 || Math.abs(z) > room.d / 2 - 0.4
  const k = out(cx + fx * reach, cz + fz * reach) ? -1 : 1
  return { p: [cx + k * fx * reach, 0, cz + k * fz * reach], r: Math.atan2(-k * fx, -k * fz) }
}

/** The entry as the map and the menus say it. */
export const entryLabel = (price?: number) => (price ? tr('Entrée {0}', { 0: fcfa(price) }) : tr('Entrée libre'))

/** A soirée in one line, under its name on the street's sign and in « Où aller ? »: its entry, how many are there, since when. */
export function partyLine(p?: Soiree) {
  if (!p) return undefined
  const since = p.starts ? tr(' · depuis {0}', { 0: new Date(p.starts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }) : ''
  return tr('{0} · {guests} invité{1}{since}', { 0: p.free && p.price ? tr('Entrée offerte') : entryLabel(p.price), guests: p.guests, 1: p.guests > 1 ? 's' : '', since })
}

// The room last arranged on this phone: the next soirée's editor opens on it (the server keeps the last soirée's too).
const ROOM_KEY = 'babi.soireeSalle'
export function lastRoom(): Piece[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(ROOM_KEY) ?? 'null')
    return Array.isArray(v) ? (v as Piece[]) : null
  } catch {
    return null
  }
}
export function keepRoom(layout: Piece[]) {
  try {
    localStorage.setItem(ROOM_KEY, JSON.stringify(layout))
  } catch {
    // (private browsing: the next one starts from the soirée's own)
  }
}
