import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Armchair, Banana, Bird, Camera, CarFront, Droplet, Drumstick, Fish, Footprints, Hand, HandCoins, HandHeart, Newspaper, PawPrint, Smartphone, Volleyball, type LucideIcon } from 'lucide-react'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look, Player } from '../../lib/types'
import { api, errorText } from '../../lib/api'
import { GESTE_IN, sampleLive } from '../../lib/live'
import { worldTime } from '../../lib/worldClock'
import { t } from '../../lib/i18n'
import { Character } from '../Character'
import { approach, emoteNow, playEmote, POSTURE_SECONDS, stopEmote, useEmote } from '../emoteNow'
import { moveObstacle } from '../obstacles'
import { setPhotoMode } from '../photoCam'
import { Box } from '../props'
import type { Hold } from '../inHand'
import { say } from '../simVoice'
import { placeHere, takePhoto } from '../snapshot'
import { StaticMerge } from '../staticMerge'
import { TalkHuman } from '../Talkable'
import { InHand } from '../inHand'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { whereabouts } from '../whereabouts'
import type { XZ } from './geo'
import { greetPasser, passers } from './gestes'
import { inScene } from './joinIn'
import { LANDMARKS } from './landmarks'
import type { Nav } from './nav'
import { npcReact } from './npcReact'
import type { Taken } from './streetlife'
import { report } from './trafficFlow'
import { roadwayAt } from './ways'
import { useKeepOnScreen } from '../tagDeclutter'

// The street lived in passing (the update « rue-vivante-gestes », backend sims/gestes.go): at corners
// of the real streets round the Sim, always the same ones, things to do with one tap and no menu. A
// bench, a low wall, a maquis's terrace of plastic chairs to sit on; the sellers who stand or walk
// the street (the alloco tantie with her basin, the garba woman and her glass box, the brochettes on
// their grill, the boy with the sachets of water, the phone credit under its parasol, the paper man);
// the children with their ball or their skipping rope; a talibé with his tin; a goat tied to its post
// and the hens; a tantie waiting for a hand with her basin; a taxi broken down at the kerb. And the
// passers-by and the other players to greet, a selfie at a landmark. As the Sim comes close, one
// small bubble over the nearest; a tap walks the Sim up to it and plays it there, 2 to 6 seconds
// (the pad stops it at once). The server says the money and the needs. Cheap: the corners are found
// once per street, the nearest few drawn (each baked in one mesh per colour, StaticMerge), and what's
// near the Sim is looked for four times a second, not every frame.

export type GesteKind = 'assis' | 'alloco' | 'garba' | 'brochette' | 'eau' | 'credit' | 'journal' | 'ballon' | 'jongles' | 'corde' | 'saluer' | 'joueur' | 'cabri' | 'poule' | 'talibe' | 'bassine' | 'panne' | 'selfie'

/** A pose played, its seconds, what's in the hand meanwhile. */
type Step = [Pose, number, Hold?]
/** How long the money goes out and the thing bought comes back (s): the seller's hand meets the Sim's in it. */
const HAND_OVER = 1.2
/** What each seller hands over (in her hand from the moment the Sim's money comes). */
const SOLD: Partial<Record<CoinKind, Hold>> = { alloco: 'alloco', garba: 'garba', brochette: 'brochette', eau: 'sachet', credit: 'ticket', journal: 'journal' }

/**
 * Each gesture's button (its price, as the server's: sims/gestes.go) and how the Sim plays it: poses in turn,
 * seconds each, and what it holds meanwhile. Buying, the money goes out to the seller first (her hand comes
 * with the cornet as it does), then it eats what it was handed.
 */
const ACTS: Record<GesteKind, { label: () => string; icon: LucideIcon; cost?: number; steps: Step[] }> = {
  assis: { label: () => t('S’asseoir'), icon: Armchair, steps: [['sit', POSTURE_SECONDS]] },
  alloco: { label: () => t('Un cornet d’alloco'), icon: Banana, cost: 300, steps: [['give', HAND_OVER, 'notes'], ['snack', 4, 'alloco']] },
  garba: { label: () => t('Un garba'), icon: Fish, cost: 500, steps: [['give', HAND_OVER, 'notes'], ['snack', 4.5, 'garba']] },
  brochette: { label: () => t('Des brochettes'), icon: Drumstick, cost: 500, steps: [['give', HAND_OVER, 'notes'], ['snack', 4, 'brochette']] },
  eau: { label: () => t('Un sachet d’eau'), icon: Droplet, cost: 50, steps: [['give', HAND_OVER, 'coin'], ['snack', 2.8, 'sachet']] },
  credit: { label: () => t('Du crédit'), icon: Smartphone, cost: 500, steps: [['give', HAND_OVER, 'notes'], ['phone', 3.5, 'phone']] },
  journal: { label: () => t('Le journal'), icon: Newspaper, cost: 200, steps: [['give', HAND_OVER, 'coin'], ['busy', 4, 'journal']] },
  ballon: { label: () => t('Renvoyer le ballon'), icon: Volleyball, steps: [['idle', 0.7], ['kick', 1.5]] },
  jongles: { label: () => t('Faire des jongles'), icon: Footprints, steps: [['juggle', 5]] },
  corde: { label: () => t('Sauter à la corde'), icon: Footprints, steps: [['bounce', 5]] },
  saluer: { label: () => t('Saluer'), icon: Hand, steps: [['wave', 2.4]] },
  joueur: { label: () => t('Saluer'), icon: Hand, steps: [['wave', 2.4]] },
  cabri: { label: () => t('Caresser le cabri'), icon: PawPrint, steps: [['bow', 3]] },
  poule: { label: () => t('Courir après les poules'), icon: Bird, steps: [['cheer', 2.5]] },
  talibe: { label: () => t('Donner une pièce'), icon: HandCoins, cost: 50, steps: [['give', 1.6, 'coin']] },
  bassine: { label: () => t('Aider la tantie'), icon: HandHeart, steps: [['carry', 3]] },
  panne: { label: () => t('Pousser la voiture'), icon: CarFront, steps: [['push', 4.5]] },
  selfie: { label: () => t('Un selfie'), icon: Camera, steps: [['phone', 3]] },
}

/* ---------- The corners ---------- */

type CoinKind = 'banc' | 'muret' | 'terrasse' | 'alloco' | 'garba' | 'brochette' | 'eau' | 'credit' | 'journal' | 'ballon' | 'corde' | 'talibe' | 'cabris' | 'bassine' | 'panne'
const WEIGHTS: [CoinKind, number][] = [
  ['banc', 3],
  ['muret', 2.5],
  ['terrasse', 2],
  ['alloco', 1.4],
  ['garba', 1],
  ['brochette', 1],
  ['eau', 1.2],
  ['credit', 1],
  ['journal', 0.8],
  ['ballon', 1.8],
  ['corde', 1.2],
  ['talibe', 1.2],
  ['cabris', 1.3],
  ['bassine', 1.2],
  ['panne', 1],
]
const WEIGHT_SUM = WEIGHTS.reduce((s, [, w]) => s + w, 0)
/** When the corner's people are there (hours of the game day); its furniture always is. As the server's hours (sims/gestes.go). */
const HOURS: Partial<Record<CoinKind, [number, number]>> = { alloco: [8, 23], garba: [9, 24], brochette: [16, 24], eau: [7, 22], credit: [6, 22], journal: [6, 20], ballon: [7, 19], corde: [7, 19], talibe: [7, 19], cabris: [6, 19], bassine: [6, 19], panne: [7, 21] }
const isOn = (k: CoinKind, hour: number) => {
  const h = HOURS[k]
  return !h || (hour >= h[0] && hour < h[1])
}

/** A corner: where on the pavement (its frame's +z faces the road, x along it), and how far the kerb's lane is (for the broken-down car). */
type Coin = { key: string; kind: CoinKind; at: XZ; face: number; kerbZ: number; seed: string }

/** How near the corners are drawn, how many at most; how close the Sim comes to be asked. */
const NEAR = 70
const SHOWN = 7
const REACH = 3.6

/** The corners along the streets from edge `from` on (the same every time: the street's own rng). */
function findCoins(nav: Nav, seed: string, from: number, out: Coin[]) {
  for (let i = from; i < nav.edges.length; i++) {
    const e = nav.edges[i]
    if (e.walled || e.fast || e.width < 6 || e.len < 18) continue
    const r = rng(`rg|${seed}|${i}`)
    if (r() > 0.42) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const k = 0.3 + r() * 0.4
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const u: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const side = r() < 0.5 ? 1 : -1
    const off = e.width >= 6 ? Math.min(7.3, Math.max(4.9, e.width / 2 + 1.5)) : e.width / 2 + 1.5
    const n: XZ = [u[1] * side, -u[0] * side]
    const p: XZ = [a[0] + (b[0] - a[0]) * k + n[0] * off, a[1] + (b[1] - a[1]) * k + n[1] * off]
    // Not on another street.
    if (roadwayAt(nav, p[0], p[1]) !== null) continue
    let w = r() * WEIGHT_SUM
    let kind: CoinKind = 'banc'
    for (const [kk, wt] of WEIGHTS) if ((w -= wt) < 0) ((kind = kk), (w = Infinity))
    // The broken-down car wants a road wide enough to stand in.
    if (kind === 'panne' && e.width < 7) kind = 'banc'
    out.push({ key: `${seed}|${i}`, kind, at: p, face: Math.atan2(-n[0], -n[1]), kerbZ: off - (e.width / 2 - 1.2), seed: `rg|${seed}|${i}` })
  }
}

/** Room at the corner (no stall, parked car, post or tree there already: Walker's roomAt), across its width. */
function free(c: Coin) {
  for (const x of [-1.6, 0, 1.6]) {
    const [wx, wz] = inScene({ at: c.at, rot: c.face }, x, 0.3)
    if (!whereabouts.roomAt(wx, wz)) return false
  }
  return true
}

/** Where the Sim goes for a gesture, which way it turns there. */
type Stand = { x: number; z: number; h: number }
const standIn = (c: Coin, x: number, z: number, r: number): Stand => {
  const [wx, wz] = inScene({ at: c.at, rot: c.face }, x, z)
  return { x: wx, z: wz, h: c.face + r }
}
/** A corner's gesture: its id (cooldowns), where its bubble floats, the gestures, where the Sim stands for each. */
type Spot = { id: string; coin: string; at: XZ; y: number; acts: GesteKind[]; stand: Stand }

/** The ones to sit, buy, play… at each corner (in its frame, then in the world). */
function spotsOf(c: Coin, hour: number, gone: boolean): Spot[] {
  const on = isOn(c.kind, hour)
  const spot = (id: string, x: number, z: number, acts: GesteKind[], st: Stand, y = 2.2): Spot => ({ id: `${c.key}|${id}`, coin: c.key, at: inScene({ at: c.at, rot: c.face }, x, z), y, acts, stand: st })
  switch (c.kind) {
    case 'banc':
      return [spot('s', -0.5, 0, ['assis'], standIn(c, -0.5, 0, 0), 1.6), ...(sitter(c, hour) ? [spot('v', 0.5, 0, ['saluer'], standIn(c, 0.5, 1.2, Math.PI))] : [])]
    case 'muret':
      return [spot('s', 0.3, 0, ['assis'], standIn(c, 0.3, 0.05, 0), 1.6)]
    case 'terrasse':
      return [spot('s', 0, -0.45, ['assis'], standIn(c, 0, -0.45, 0), 1.7), ...(on || hour < 2 || hour >= 9 ? [spot('c', -0.75, 0.3, ['saluer'], standIn(c, -0.75, 1.3, Math.PI))] : [])]
    case 'alloco':
    case 'garba':
    case 'brochette':
    case 'eau':
    case 'credit':
    case 'journal':
      return on ? [spot('v', 0, 0.3, [c.kind], standIn(c, 0, 1.35, Math.PI), 2.5)] : []
    case 'ballon':
      return on ? [spot('k', 0, 0.8, ['ballon', 'jongles'], standIn(c, 0, 1.8, -Math.PI / 2 - 0.4), 1.9)] : []
    case 'corde':
      return on ? [spot('k', 0, 0, ['corde'], standIn(c, 0, 0, 0), 2.1)] : []
    case 'talibe':
      return on ? [spot('t', 0, 0, ['talibe'], standIn(c, 0, 1.1, Math.PI), 1.9)] : []
    case 'cabris':
      return on ? [spot('g', 0.6, 0, ['cabri'], standIn(c, 0.6, 0.95, Math.PI), 1.5), spot('h', 1.8, 0.2, ['poule'], standIn(c, 1.8, 1.3, Math.PI), 1.3)] : []
    case 'bassine':
      return on && !gone ? [spot('b', 0.3, 0.2, ['bassine'], standIn(c, 1.1, 0.35, -Math.PI / 2), 2.4)] : []
    case 'panne':
      return on && !gone ? [spot('p', -1, c.kerbZ, ['panne'], standIn(c, -2.75, c.kerbZ - 0.5, Math.PI / 2), 2.3)] : []
  }
}
/** The old man on the bench (some benches, by day). */
const sitter = (c: Coin, hour: number) => hour >= 7 && hour < 20 && c.seed.length % 2 === 0

/* ---------- What's being done, shared with the corner drawn ---------- */

type Acting = { coin: string; kind: GesteKind; phase: 'go' | 'do'; t0: number }
let acting: Acting | null = null
const actListeners = new Set<() => void>()
const setActing = (a: Acting | null) => ((acting = a), actListeners.forEach((f) => f()))
const subscribeAct = (f: () => void) => (actListeners.add(f), () => void actListeners.delete(f))
/** The gesture done at this corner now (null: none). */
const useActing = (coin: string) => useSyncExternalStore(subscribeAct, () => (acting?.coin === coin && acting.phase === 'do' ? acting : null))
/** The corners whose scene is played out (the basin carried off, the car gone): when (world seconds). */
const doneAt = new Map<string, number>()
const GONE_FOR = 600
const isGone = (coin: string) => worldTime() - (doneAt.get(coin) ?? -1e9) < GONE_FOR

/* ---------- The layer ---------- */

/** What the bubble offers now: where it floats (moved each frame for someone walking), the gestures, who. */
type Offer = { id: string; coin?: string; acts: GesteKind[]; where: (v: THREE.Vector3) => void; stand: () => Stand; name?: string; to?: string; passer?: string }

export function RueGestes({ nav, seed, simId, hour, players, busy, onGeste, taken = [] }: { nav: Nav; seed: string; simId: string; hour: number; players?: Player[]; /** Busy, frozen or inside: nothing offered. */ busy: boolean; onGeste: (kind: string, to?: string) => Promise<string>; taken?: Taken[] }) {
  const all = useRef<{ coins: Coin[]; edges: number }>({ coins: [], edges: 0 })
  const [shown, setShown] = useState<Coin[]>([])
  const [watch, setWatch] = useState(false)
  const [goneV, setGoneV] = useState(0)
  const spots = useMemo(() => shown.flatMap((c) => spotsOf(c, hour, isGone(c.key))), [shown, hour, goneV]) // eslint-disable-line react-hooks/exhaustive-deps
  const [offer, setOffer] = useState<Offer | null>(null)
  const offerRef = useRef<Offer | null>(null)
  offerRef.current = offer
  const bubble = useRef<THREE.Group>(null)
  // (The offer slides back inside the screen when the one it hangs over is near its side.)
  const offerBox = useRef<HTMLDivElement>(null)
  useKeepOnScreen(offerBox)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const tick = useRef({ coins: 9, scan: 9 })
  const busyRef = useRef(busy)
  busyRef.current = busy
  const ctx = useRef({ spots, players, taken })
  ctx.current = { spots, players, taken }
  /** Done lately (an offer's id → until when, ms): not offered again straight away. */
  const cool = useRef(new Map<string, number>())
  /** Sat down by a gesture (its needs drift while it stays). */
  const seated = useRef(false)
  /** The passers-by who said a word in passing lately. */
  const nodded = useRef({ at: 0, ids: new Map<string, number>() })
  // What's said back, over whoever says it (or the Sim's head): a moment.
  const [said, setSaid] = useState<{ text: string; cost?: number; where: (v: THREE.Vector3) => void } | null>(null)
  const saidG = useRef<THREE.Group>(null)
  const saidTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const answer = (text: string, where: (v: THREE.Vector3) => void, cost?: number, ms = 4500) => {
    setSaid({ text, cost, where })
    clearTimeout(saidTimer.current)
    saidTimer.current = setTimeout(() => setSaid(null), ms)
  }
  useEffect(
    () => () => {
      clearTimeout(saidTimer.current)
      setActing(null)
      approach.to = null
    },
    [],
  )
  // Greeted by another player: their bubble a moment, and an answer with a tap.
  const [hello, setHello] = useState<{ from: string; name: string; text: string } | null>(null)
  const helloG = useRef<THREE.Group>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ from: string; name: string; text: string }>).detail
      setHello(d)
      clearTimeout(timer)
      timer = setTimeout(() => setHello(null), 7000)
    }
    window.addEventListener(GESTE_IN, on)
    return () => (window.removeEventListener(GESTE_IN, on), clearTimeout(timer))
  }, [])

  useFrame((_, dt) => {
    const tk = tick.current
    tk.coins += dt
    tk.scan += dt
    const [sx, sz] = whereabouts.sim
    if (tk.coins > 1) {
      tk.coins = 0
      // The streets came in: their corners too.
      if (nav.edges.length !== all.current.edges) {
        findCoins(nav, seed, all.current.edges, all.current.coins)
        all.current.edges = nav.edges.length
      }
      const tk2 = ctx.current.taken
      const near: { c: Coin; d: number }[] = []
      for (const c of all.current.coins) {
        const d = Math.hypot(c.at[0] - sx, c.at[1] - sz)
        if (d < NEAR && free(c) && !tk2.some((x) => Math.hypot(x.at[0] - c.at[0], x.at[1] - c.at[1]) < x.r + 3) && !whereabouts.places.some((p) => Math.hypot(p.door[0] - c.at[0], p.door[1] - c.at[1]) < 4)) near.push({ c, d })
      }
      near.sort((a, b) => a.d - b.d)
      const next = near.slice(0, SHOWN).map((x) => x.c)
      if (next.length !== shown.length || next.some((c, i) => c !== shown[i])) setShown(next)
      if (import.meta.env.DEV && ((globalThis as { __rueWatch?: number }).__rueWatch !== undefined) !== watch) setWatch(!watch)
      if (import.meta.env.DEV) Object.assign(globalThis, { __rueCoins: next, __rueAll: all.current.coins, __rueSpots: ctx.current.spots })
    }
    if (tk.scan > 0.25) {
      tk.scan = 0
      // Up from the seat (walked off, another emote), or never got there: done.
      if (acting && ((acting.kind === 'assis' && acting.phase === 'do' && emoteNow.pose !== 'sit') || (acting.phase === 'go' && worldTime() - acting.t0 > 20))) {
        if (acting.phase === 'go') approach.to = null
        seated.current = false
        setActing(null)
      }
      const next = busyRef.current || acting ? null : scan(sx, sz)
      if ((next?.id ?? null) !== (offerRef.current?.id ?? null)) setOffer(next)
      if (import.meta.env.DEV) Object.assign(globalThis, { __rueOffer: next?.id ?? (acting ? `acting:${acting.kind}` : busyRef.current ? 'busy' : null) })
    }
    const o = offerRef.current
    if (o && bubble.current) {
      o.where(tmp)
      bubble.current.position.copy(tmp)
    }
    if (said && saidG.current) {
      said.where(tmp)
      saidG.current.position.copy(tmp)
    }
    if (hello && helloG.current) {
      const s = sampleLive(hello.from)
      if (s) helloG.current.position.set(s.x, s.y + 2.7, s.z)
      helloG.current.visible = !!s
    }
  })

  /** The nearest thing to do round the Sim (the corners first, then the people, a landmark last). */
  const scan = (sx: number, sz: number): Offer | null => {
    const now = Date.now()
    const cooled = (id: string) => (cool.current.get(id) ?? 0) > now
    let best: Offer | null = null
    let bestD = REACH
    for (const s of ctx.current.spots) {
      const d = Math.hypot(s.at[0] - sx, s.at[1] - sz)
      if (d < bestD && !cooled(s.id)) {
        bestD = d
        best = { id: s.id, coin: s.coin, acts: s.acts, where: (v) => v.set(s.at[0], nav.heightAt(s.at[0], s.at[1]) + s.y, s.at[1]), stand: () => s.stand }
      }
    }
    // The passers-by: greeted when close; a word from one in passing now and then.
    for (const [id, p] of passers) {
      const d = Math.hypot(p.g.position.x - sx, p.g.position.z - sz)
      if (d < 2.4 && now - nodded.current.at > 15000 && (nodded.current.ids.get(id) ?? 0) < now && Math.random() < 0.3) {
        nodded.current.at = now
        nodded.current.ids.set(id, now + 120000)
        greetPasser(id, pickOf([t('Bonjour !'), t('Bonne journée !'), t('Ça va ?'), t('Bonne arrivée !')]), false, 2.5)
      }
      if (d < Math.min(bestD, 3.2) && !cooled(`p|${id}`)) {
        bestD = d
        const g = p.g
        best = { id: `p|${id}`, acts: ['saluer'], name: p.name, passer: id, where: (v) => v.set(g.position.x, g.position.y + 2.55, g.position.z), stand: () => ({ x: whereabouts.sim[0], z: whereabouts.sim[1], h: Math.atan2(g.position.x - whereabouts.sim[0], g.position.z - whereabouts.sim[1]) }) }
      }
    }
    // The other players, where they really are (lib/live.ts).
    for (const p of ctx.current.players ?? []) {
      if (p.npc) continue
      const s = sampleLive(p.id)
      if (!s) continue
      const d = Math.hypot(s.x - sx, s.z - sz)
      if (d < Math.min(bestD + 1.4, 5) && !cooled(`j|${p.id}`)) {
        bestD = d
        best = {
          id: `j|${p.id}`,
          acts: ['joueur'],
          name: p.username ? `@${p.username}` : p.firstName,
          to: p.id,
          where: (v) => {
            const q = sampleLive(p.id)
            if (q) v.set(q.x, q.y + 2.7, q.z)
          },
          stand: () => ({ x: whereabouts.sim[0], z: whereabouts.sim[1], h: Math.atan2(s.x - whereabouts.sim[0], s.z - whereabouts.sim[1]) }),
        }
      }
    }
    if (best) return best
    // A landmark close by: a selfie with it behind.
    for (const pl of whereabouts.places) {
      const size = LANDMARKS[pl.id]
      if (!size) continue
      const d = Math.hypot(pl.door[0] - sx, pl.door[1] - sz)
      if (d < Math.max(28, size * 0.6) && !cooled(`l|${pl.id}`))
        return {
          id: `l|${pl.id}`,
          acts: ['selfie'],
          name: pl.name,
          where: (v) => v.set(whereabouts.sim[0], whereabouts.simY + 2.75, whereabouts.sim[1]),
          // Its back to the landmark: the phone held out sees it behind the Sim.
          stand: () => ({ x: whereabouts.sim[0], z: whereabouts.sim[1], h: Math.atan2(whereabouts.sim[0] - pl.door[0], whereabouts.sim[1] - pl.door[1]) }),
        }
    }
    return null
  }

  // Sitting: the needs drift a little while the Sim stays (a call now and then); up as soon as it walks.
  const emote = useEmote()
  useEffect(() => {
    if (emote !== 'sit' || !seated.current) {
      if (seated.current && emote !== 'sit') ((seated.current = false), acting?.kind === 'assis' && setActing(null))
      return
    }
    const id = setInterval(() => void onGeste('assis').catch(() => {}), 90000)
    return () => clearInterval(id)
  }, [emote]) // eslint-disable-line react-hooks/exhaustive-deps

  /** A tap: walk up to it, the server's yes, then played there (its poses in turn, the corner's people answering). */
  const perform = (o: Offer, kind: GesteKind) => {
    if (busyRef.current || acting) return
    const st = o.stand()
    const coin = o.coin ?? o.id
    const mine: Acting = { coin, kind, phase: 'go', t0: worldTime() }
    setActing(mine)
    setOffer(null)
    const where = o.where
    const fail = (text?: string) => {
      if (acting === mine) setActing(null)
      if (text) answer(text, (v) => v.set(whereabouts.sim[0], whereabouts.simY + 2.6, whereabouts.sim[1]), undefined, 3500)
    }
    approach.to = {
      x: st.x,
      z: st.z,
      sent: false,
      cancel: () => fail(),
      arrive: () => {
        if (acting !== mine) return
        // (Someone walking: faced again where they are now.)
        const h = o.passer || o.to ? o.stand().h : st.h
        // Played at once, there (no waiting on the server with the hand in the pocket): on its spot (the seat,
        // before the seller), even if the way there stopped short; greeting or a selfie, where it stands.
        const a = ACTS[kind]
        const here = !!(o.passer || o.to) || kind === 'selfie'
        const at = { x: here ? whereabouts.sim[0] : st.x, z: here ? whereabouts.sim[1] : st.z, h }
        const total = play(a.steps, at)
        const doing: Acting = { ...mine, phase: 'do', t0: worldTime() }
        setActing(doing)
        if (kind === 'assis') seated.current = true
        if (kind === 'saluer' || kind === 'joueur') say(pickOf([t('On dit quoi ?'), t('Bonjour !'), t('Ça va un peu ?')]), 2.5)
        // The passer-by greeted stops and waves back at once (their line comes with the server's answer).
        if (o.passer) npcReact(o.passer, 'hello', 2.6)
        onGeste(kind, o.to)
          .then((text) => {
            if (acting !== doing) return
            cool.current.set(o.id, Date.now() + (kind === 'assis' ? 4000 : 20000))
            // Said back: by the passer-by (in their own bubble), over the corner, or by the Sim.
            if (o.passer) setTimeout(() => greetPasser(o.passer!, text, true, 3.2), 300)
            else if (kind === 'selfie') selfie()
            else answer(text, where, a.cost)
            if (kind === 'credit') setTimeout(() => say(t('Allô, maman ?'), 2.5), 1500)
            if (kind !== 'assis')
              setTimeout(() => {
                if (acting?.coin === coin && acting.kind === kind) setActing(null)
                if (kind === 'bassine' || kind === 'panne') (doneAt.set(coin, worldTime()), setGoneV((n) => n + 1))
              }, (kind === 'bassine' || kind === 'panne' ? total + 6 : total) * 1000)
          })
          .catch((e) => {
            // Refused (no money, closed): the gesture stops there, the reason said.
            if (acting !== doing) return
            stopEmote()
            setActing(null)
            seated.current = false
            answer(errorText(e, t('Pas maintenant')), (v) => v.set(whereabouts.sim[0], whereabouts.simY + 2.6, whereabouts.sim[1]), undefined, 3500)
          })
      },
    }
  }

  // The selfie: the phone held out, a shot of the Sim with the landmark behind, into the gallery.
  const selfie = () => {
    setPhotoMode('selfie')
    setTimeout(() => {
      const shot = takePhoto()
      setPhotoMode(null)
      if (shot) void api.takePhoto(simId, shot, 'selfie', placeHere()).catch(() => {})
      answer(t('Clic ! Le selfie est dans ta galerie.'), (v) => v.set(whereabouts.sim[0], whereabouts.simY + 2.7, whereabouts.sim[1]))
    }, 1100)
  }

  return (
    <NoShadows>
      {watch && <WatchCam />}
      {shown.map((c) => (
        <CoinView key={c.key} c={c} nav={nav} hour={hour} gone={isGone(c.key)} />
      ))}
      {offer && (
        <group ref={bubble}>
          <Html center zIndexRange={[25, 0]}>
            <div ref={offerBox} className="flex items-center gap-1.5 transition-[translate] duration-200">
              {offer.acts.map((k) => {
                const a = ACTS[k]
                const Icon = a.icon
                return (
                  <button key={k} onClick={() => perform(offer, k)} className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] transition active:scale-95">
                    <Icon size={15} strokeWidth={2.6} className="text-[#ff7a00]" />
                    {offer.name && (k === 'saluer' || k === 'joueur' || k === 'selfie') ? t('{what} · {who}', { what: a.label(), who: offer.name }) : a.label()}
                    {a.cost ? <span className="text-[11px] text-[#ff7a00]">{t('{n} F', { n: a.cost })}</span> : null}
                  </button>
                )
              })}
            </div>
          </Html>
        </group>
      )}
      {said && (
        <group ref={saidG}>
          <Html center zIndexRange={[24, 0]}>
            <div className="w-max max-w-[240px] rounded-2xl rounded-bl-sm border border-black/5 bg-white/95 px-3 py-1.5 text-center text-[12.5px] font-extrabold text-[var(--color-ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.45)]">
              {said.text}
              {said.cost ? <span className="ml-1 text-[#e03131]">{t('−{n} F', { n: said.cost })}</span> : null}
            </div>
          </Html>
        </group>
      )}
      {hello && (
        <group ref={helloG}>
          <Html center zIndexRange={[25, 0]}>
            <button
              onClick={() => {
                const from = hello.from
                setHello(null)
                const s = sampleLive(from)
                if (!s) return
                perform({ id: `j|${from}`, acts: ['joueur'], to: from, where: (v) => v.set(s.x, s.y + 2.7, s.z), stand: () => ({ x: whereabouts.sim[0], z: whereabouts.sim[1], h: Math.atan2(s.x - whereabouts.sim[0], s.z - whereabouts.sim[1]) }) }, 'joueur')
              }}
              className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] transition active:scale-95"
            >
              <span className="text-[#3b82f6]">{hello.name}</span> · {t(hello.text)}
              <Hand size={15} strokeWidth={2.6} className="text-[#ff7a00]" />
            </button>
          </Html>
        </group>
      )}
    </NoShadows>
  )
}

/** Development only (captures, globalThis.__rueWatch = angle): the camera beside the Sim, a little above, to see the gesture. */
function WatchCam() {
  useFrame(({ gl, scene, camera }) => {
    const a = (globalThis as { __rueWatch?: number }).__rueWatch ?? 0
    const [x, z] = whereabouts.sim
    const h = whereabouts.simHeading + a
    camera.position.set(x + Math.sin(h) * 5.6, whereabouts.simY + 3.4, z + Math.cos(h) * 5.6)
    camera.lookAt(x, whereabouts.simY + 1, z)
    gl.render(scene, camera)
  }, 1)
  return null
}

const pickOf = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)]

/** The poses in turn on the Sim, where it stands; stopped as soon as it walks (or another emote comes). Their total, in seconds. */
function play(steps: Step[], at: { x: number; z: number; h: number }) {
  let total = 0
  steps.forEach(([pose, secs, hold], i) => {
    const start = total
    total += secs
    if (i === 0) return playEmote(pose, secs, at, hold ?? null)
    const before = steps[i - 1][0]
    // (A moment before the one before ends, so that one's own end doesn't come first.)
    setTimeout(
      () => {
        // (Walked off, or something else played meanwhile: the rest isn't.)
        if (emoteNow.pose !== before) return
        playEmote(pose, secs, at, hold ?? null)
      },
      start * 1000 - 80,
    )
  })
  return total
}

/* ---------- The corners drawn ---------- */

type Who = { look: Look; gender: 'femme' | 'homme' }
const who = (seed: string, gender?: 'femme' | 'homme', look: Partial<Look> = {}): Who => {
  const r = rng(seed)
  const g = gender ?? (r() < 0.5 ? 'femme' : 'homme')
  return { look: { ...randomLook(g, r), ...look } as Look, gender: g }
}
/** One of the corner's people, talkable (a tap: a chat, world3d/talk.ts). */
const Person = ({ id, w, pose, p, r = 0, hold }: { id: string; w: Who; pose: Pose; p: [number, number, number]; r?: number; /** In the right hand (what's sold, handed over). */ hold?: Hold }) => (
  <group position={p} rotation={[0, r, 0]}>
    <TalkHuman id={id} look={w.look} gender={w.gender} pose={pose} seed={id.length} hold={hold ? <InHand what={hold} /> : undefined} />
  </group>
)
/** A child of the corner. */
const Kid = ({ w, pose, p, r = 0 }: { w: Who; pose: Pose; p: [number, number, number]; r?: number }) => (
  <group position={p} rotation={[0, r, 0]}>
    <Character look={w.look} gender={w.gender} stage="enfant" pose={pose} marker={false} seed={w.look.skin.length} />
  </group>
)

/** The corner's own clock while a gesture is played there (seconds since it began), looked at a few times a second. */
function useSince(a: Acting | null) {
  const [s, setS] = useState(0)
  useFrame(() => {
    if (!a) return
    const now = worldTime() - a.t0
    if (Math.floor(now * 5) !== Math.floor(s * 5)) setS(now)
  })
  return a ? s : -1
}

function CoinView({ c, nav, hour, gone }: { c: Coin; nav: Nav; hour: number; gone: boolean }) {
  const a = useActing(c.key)
  const since = useSince(a)
  const on = isOn(c.kind, hour)
  return (
    <group position={[c.at[0], nav.heightAt(c.at[0], c.at[1]), c.at[1]]} rotation={[0, c.face, 0]}>
      <StaticMerge version={`${on}${gone}`}>
        <Decor c={c} on={on} />
      </StaticMerge>
      <People c={c} hour={hour} on={on} gone={gone} a={a} since={since} />
    </group>
  )
}

/** A plastic chair of the maquis (seat at 0.42 m), its back at -z. */
const Chair = ({ p, r = 0, c = '#f1f3f5' }: { p: [number, number, number]; r?: number; c?: string }) => (
  <group position={p} rotation={[0, r, 0]}>
    <Box p={[0, 0.42, 0]} s={[0.46, 0.05, 0.46]} c={c} />
    <Box p={[0, 0.68, -0.21]} s={[0.46, 0.48, 0.05]} c={c} />
    {[-0.19, 0.19].flatMap((x) => [-0.19, 0.19].map((z) => <Box key={`${x}${z}`} p={[x, 0.2, z]} s={[0.05, 0.4, 0.05]} c={c} />))}
  </group>
)
const Parasol = ({ p, c, r = 1.5 }: { p: [number, number, number]; c: string; r?: number }) => (
  <group position={p}>
    <Box p={[0, 1.15, 0]} s={[0.06, 2.3, 0.06]} c="#dee2e6" />
    <mesh position={[0, 2.35, 0]}>
      <coneGeometry args={[r, 0.45, 8]} />
      <meshLambertMaterial color={c} />
    </mesh>
  </group>
)
const Table = ({ p, c = '#8a5a32', w = 0.9, d = 0.6, h = 0.78 }: { p: [number, number, number]; c?: string; w?: number; d?: number; h?: number }) => (
  <group position={p}>
    <Box p={[0, h, 0]} s={[w, 0.05, d]} c={c} />
    {[-w / 2 + 0.05, w / 2 - 0.05].map((x) => <Box key={x} p={[x, h / 2, 0]} s={[0.05, h, d - 0.08]} c="#5c3d24" />)}
  </group>
)

/** What doesn't move at the corner: the bench, the wall, the terrace, the seller's table and wares. */
function Decor({ c, on }: { c: Coin; on: boolean }) {
  switch (c.kind) {
    case 'banc':
      return (
        <group>
          <Box p={[0, 0.43, 0]} s={[1.9, 0.08, 0.46]} c="#b9b3a8" />
          <Box p={[0, 0.76, -0.22]} s={[1.9, 0.36, 0.07]} c="#2f9e44" />
          {[-0.75, 0.75].map((x) => <Box key={x} p={[x, 0.2, 0]} s={[0.14, 0.4, 0.42]} c="#8d877c" />)}
        </group>
      )
    case 'muret':
      return (
        <group>
          <Box p={[0, 0.21, 0]} s={[3.4, 0.42, 0.36]} c="#e9dcc3" />
          <Box p={[0, 0.3, 0.185]} s={[3.4, 0.1, 0.01]} c="#1c7ed6" />
          <Box p={[0, 0.44, 0]} s={[3.5, 0.05, 0.42]} c="#cfc3aa" />
        </group>
      )
    case 'terrasse':
      return (
        <group>
          <Table p={[0, 0, 0.3]} c="#f1f3f5" w={0.8} d={0.8} h={0.7} />
          <Chair p={[-0.75, 0, 0.3]} r={Math.PI / 2} c="#e03131" />
          <Chair p={[0.75, 0, 0.3]} r={-Math.PI / 2} />
          <Chair p={[0, 0, -0.45]} c="#e03131" />
          <Chair p={[0, 0, 1.05]} r={Math.PI} />
          <Parasol p={[0, 0, 0.3]} c="#2f9e44" />
          <Box p={[-0.15, 0.85, 0.3]} s={[0.07, 0.26, 0.07]} c="#5c3d24" />
          <Box p={[0.18, 0.85, 0.22]} s={[0.07, 0.26, 0.07]} c="#2b8a3e" />
        </group>
      )
    case 'alloco':
      return on ? (
        <group>
          <Table p={[0, 0, 0.5]} />
          <Box p={[-0.2, 0.88, 0.5]} s={[0.4, 0.14, 0.36]} c="#c3c9cf" />
          {[-0.3, -0.2, -0.1].map((x) => <Box key={x} p={[x, 0.97, 0.5]} s={[0.08, 0.05, 0.25]} c="#f2a81d" />)}
          <Box p={[0.25, 0.9, 0.5]} s={[0.3, 0.18, 0.3]} c="#212529" />
          <Box p={[0.25, 1.0, 0.5]} s={[0.26, 0.02, 0.26]} c="#e8a33a" />
          <Box p={[-0.55, 0.22, 0.05]} s={[0.36, 0.44, 0.36]} c="#1c7ed6" />
          <Parasol p={[-0.45, 0, -0.5]} c="#f08c00" r={1.1} />
        </group>
      ) : null
    case 'garba':
      return on ? (
        <group>
          <Table p={[0, 0, 0.5]} />
          <mesh position={[-0.12, 0.98, 0.5]}>
            <boxGeometry args={[0.5, 0.36, 0.4]} />
            <meshLambertMaterial color="#d0ebff" transparent opacity={0.5} />
          </mesh>
          {[-0.25, -0.1, 0.05].map((x) => <Box key={x} p={[x, 0.86, 0.5]} s={[0.12, 0.08, 0.2]} c="#a0522d" />)}
          <Box p={[0.3, 0.88, 0.5]} s={[0.3, 0.14, 0.3]} c="#f1f3f5" />
          <Box p={[0.3, 0.97, 0.5]} s={[0.26, 0.04, 0.26]} c="#fff8e1" />
        </group>
      ) : null
    case 'brochette':
      return on ? (
        <group>
          <Box p={[0, 0.82, 0.5]} s={[1.2, 0.14, 0.32]} c="#343a40" />
          <Box p={[0, 0.9, 0.5]} s={[1.1, 0.02, 0.26]} c="#e8590c" glow={0.5} />
          {[-0.4, -0.2, 0, 0.2, 0.4].map((x) => <Box key={x} p={[x, 0.95, 0.5]} s={[0.05, 0.05, 0.4]} c="#7a3e1d" />)}
          {[-0.55, 0.55].map((x) => <Box key={x} p={[x, 0.38, 0.5]} s={[0.05, 0.76, 0.05]} c="#495057" />)}
          <Box p={[0.85, 0.5, 0.45]} s={[0.4, 1.0, 0.4]} c="#adb5bd" />
          <mesh position={[0.85, 1.12, 0.45]}>
            <boxGeometry args={[0.36, 0.24, 0.36]} />
            <meshLambertMaterial color="#e7f5ff" transparent opacity={0.55} />
          </mesh>
        </group>
      ) : null
    case 'credit':
      return on ? (
        <group>
          <Table p={[0, 0, 0.5]} w={0.7} d={0.5} />
          {['#f08c00', '#fcc419', '#1c7ed6', '#e03131'].map((col, i) => <Box key={col} p={[-0.24 + i * 0.16, 0.82, 0.5]} s={[0.12, 0.02, 0.18]} c={col} />)}
          <Box p={[0, 1.15, 0.76]} s={[0.66, 0.36, 0.03]} c="#fcc419" />
          <Box p={[0, 1.15, 0.78]} s={[0.5, 0.08, 0.01]} c="#212529" />
          <Parasol p={[-0.45, 0, -0.5]} c="#fcc419" r={1.1} />
          <Box p={[0.6, 0.22, 0.05]} s={[0.36, 0.44, 0.36]} c="#495057" />
        </group>
      ) : null
    case 'journal':
      return on ? (
        <group>
          <Box p={[0, 0.6, 0.5]} s={[1.1, 0.04, 0.5]} c="#8a5a32" />
          <Box p={[0, 0.85, 0.28]} s={[1.1, 0.5, 0.04]} c="#8a5a32" />
          {[-0.4, -0.13, 0.14, 0.41].map((x, i) => (
            <group key={x}>
              <Box p={[x, 0.63, 0.5]} s={[0.24, 0.02, 0.32]} c="#f8f9fa" />
              <Box p={[x, 0.645, 0.43]} s={[0.2, 0.01, 0.07]} c={['#e03131', '#1c7ed6', '#212529', '#2f9e44'][i]} />
              <Box p={[x, 0.9, 0.31]} s={[0.22, 0.3, 0.01]} c="#f1f3f5" />
            </group>
          ))}
          {[-0.5, 0.5].map((x) => <Box key={x} p={[x, 0.3, 0.5]} s={[0.05, 0.6, 0.45]} c="#5c3d24" />)}
        </group>
      ) : null
    case 'talibe':
    case 'cabris':
      return c.kind === 'cabris' ? <Box p={[0, 0.45, -0.3]} s={[0.1, 0.9, 0.1]} c="#6b4a2a" /> : null
    default:
      return null
  }
}

/** The corner's people (and what moves): each answering the gesture done there. */
function People({ c, hour, on, gone, a, since }: { c: Coin; hour: number; on: boolean; gone: boolean; a: Acting | null; since: number }) {
  const id = (i: number) => `rg${c.key}|${i}`
  const cast = useMemo(() => [0, 1, 2].map((i) => who(`${c.seed}|${i}`, c.kind === 'bassine' || c.kind === 'alloco' || c.kind === 'garba' ? 'femme' : c.kind === 'panne' || c.kind === 'talibe' || c.kind === 'journal' ? 'homme' : undefined, c.kind === 'bassine' || c.kind === 'alloco' || c.kind === 'garba' ? { outfit: 'pagne' } : c.kind === 'talibe' ? { outfit: 'boubou', outfitColor: '#d9d2c3' } : {})), [c.seed, c.kind])
  // Handing over: her hand out with it a moment after the Sim's money comes, let go as the Sim takes it.
  const handing = since >= 0.2 && since < HAND_OVER
  const sold = SOLD[c.kind]
  switch (c.kind) {
    case 'banc':
      return sitter(c, hour) ? <Person id={id(0)} w={{ ...cast[0], look: { ...cast[0].look, hairColor: '#d9d9d9' } }} pose={a?.kind === 'saluer' && since < 2.6 ? 'wave' : 'sit'} p={[0.5, 0, 0]} /> : null
    case 'terrasse':
      return hour < 2 || hour >= 9 ? (
        <>
          <Person id={id(0)} w={cast[0]} pose={a?.kind === 'saluer' && since < 2.6 ? 'wave' : 'drink'} p={[-0.75, 0, 0.3]} r={Math.PI / 2} />
          <Person id={id(1)} w={cast[1]} pose={a?.kind === 'saluer' && since < 2.6 ? 'laugh' : 'eat'} p={[0.75, 0, 0.3]} r={-Math.PI / 2} />
        </>
      ) : null
    case 'alloco':
    case 'garba':
    case 'brochette':
    case 'credit':
    case 'journal':
      return on ? <Person id={id(0)} w={cast[0]} pose={handing ? 'give' : since >= HAND_OVER && since < 3 ? 'thumbsup' : c.kind === 'brochette' ? 'cook' : 'idle'} hold={handing ? sold : undefined} p={[0, 0, 0]} /> : null
    case 'eau':
      return on ? (
        <group>
          <Person id={id(0)} w={cast[0]} pose={handing ? 'give' : 'idle'} hold={handing ? sold : undefined} p={[0, 0, 0]} />
          <group position={[0, 1.98, 0]}>
            <mesh geometry={CYL} material={BASIN} scale={[0.62, 0.16, 0.62]} />
            {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} geometry={BOX} material={SACHET} position={[Math.sin(i) * 0.16, 0.1, Math.cos(i) * 0.16]} scale={[0.14, 0.06, 0.1]} />)}
          </group>
        </group>
      ) : null
    case 'ballon':
      return on ? <Ballon cast={cast} a={a} since={since} /> : null
    case 'corde':
      return on ? <Corde cast={cast} a={a} since={since} /> : null
    case 'talibe':
      return on ? (
        <group>
          <Kid w={cast[0]} pose={since >= 0.8 && since < 3 ? 'bow' : 'beg'} p={[0, 0, 0]} />
          <Box p={[0, 0.72, 0.32]} s={[0.14, 0.16, 0.14]} c="#ced4da" />
        </group>
      ) : null
    case 'cabris':
      return on ? <Cabris a={a} since={since} /> : null
    case 'bassine':
      return on && !gone ? <Bassine w={cast[0]} pid={id(0)} since={a ? since : -1} /> : null
    case 'panne':
      return on && !gone ? <Panne c={c} w={cast[0]} pid={id(0)} since={a ? since : -1} /> : null
    default:
      return null
  }
}

const M = (color: string) => new THREE.MeshLambertMaterial({ color })
const BASIN = M('#2f6fd6')
const SACHET = new THREE.MeshLambertMaterial({ color: '#dff3ff', transparent: true, opacity: 0.85 })
const BALL = M('#f8f9fa')
const ROPE = M('#e64980')
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12)
const SPHERE = new THREE.IcosahedronGeometry(0.12, 1)

/** Two children passing the ball; with the Sim, the ball to it and back, or bouncing on its foot. */
function Ballon({ cast, a, since }: { cast: Who[]; a: Acting | null; since: number }) {
  const ball = useRef<THREE.Mesh>(null)
  const [kick, setKick] = useState(0)
  const A: [number, number] = [-2.2, 0.6]
  const B: [number, number] = [2.2, 0.6]
  const S: [number, number] = [0, 1.8]
  const loc = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const m = ball.current
    if (!m) return
    const t = worldTime()
    if (a?.kind === 'ballon' && since >= 0) {
      const s = worldTime() - a.t0
      // To the Sim (0.8 s), then back to the first child (1 s).
      const back = s >= 0.8
      const [f, to] = back ? [S, A] : [A, S]
      const k = back ? Math.min(1, s - 0.8) : s / 0.8
      m.position.set(f[0] + (to[0] - f[0]) * k, 0.12 + Math.sin(Math.PI * k) * 0.9, f[1] + (to[1] - f[1]) * k)
      return
    }
    if (a?.kind === 'jongles' && since >= 0) {
      // On the Sim's foot, up and down (the Sim's own place, in the corner's frame).
      const g = m.parent
      if (g) {
        loc.set(whereabouts.sim[0], 0, whereabouts.sim[1])
        g.worldToLocal(loc)
        m.position.set(loc.x, 0.25 + Math.abs(Math.sin((t - a.t0) * 5.5)) * 0.7, loc.z)
      }
      return
    }
    // Between the two children, 2.4 s a pass, each kicking in turn.
    const cyc = (t % 4.8) / 2.4
    const leg = Math.floor(cyc)
    const k = cyc - leg
    const [f, to] = leg ? [B, A] : [A, B]
    m.position.set(f[0] + (to[0] - f[0]) * k, 0.12 + Math.sin(Math.PI * k) * 0.35, f[1] + (to[1] - f[1]) * k)
    const kicker = k < 0.25 ? leg + 1 : 0
    if (kicker !== kick) setKick(kicker)
  })
  const cheer = since >= 1.8 || (a?.kind === 'jongles' && since >= 0)
  return (
    <group>
      <Kid w={cast[0]} pose={cheer ? 'clap' : (a?.kind === 'ballon' && since < 0.4) || kick === 1 ? 'kick' : 'idle'} p={[A[0], 0, A[1]]} r={Math.PI / 2} />
      <Kid w={cast[1]} pose={cheer ? 'cheer' : kick === 2 ? 'kick' : 'idle'} p={[B[0], 0, B[1]]} r={-Math.PI / 2} />
      <mesh ref={ball} geometry={SPHERE} material={BALL} userData={{ live: true }} />
    </group>
  )
}

/** Two girls turning the rope, a third jumping; with the Sim, she steps out and claps. */
function Corde({ cast, a, since }: { cast: Who[]; a: Acting | null; since: number }) {
  const rope = useRef<THREE.Group>(null)
  useFrame(() => {
    if (rope.current) rope.current.rotation.x = (worldTime() * (a ? 8 : 6.5)) % (Math.PI * 2)
  })
  const sim = !!a && since >= 0
  return (
    <group>
      <Kid w={{ ...cast[0], gender: 'femme' }} pose="wave" p={[-1.7, 0, 0]} r={Math.PI / 2} />
      <Kid w={{ ...cast[1], gender: 'femme' }} pose="wave" p={[1.7, 0, 0]} r={-Math.PI / 2} />
      <Kid w={{ ...cast[2], gender: 'femme' }} pose={sim ? 'clap' : 'bounce'} p={sim ? [0.3, 0, -1.1] : [0, 0, 0]} />
      <group ref={rope} position={[0, 0.95, 0]} userData={{ live: true }}>
        <mesh geometry={BOX} material={ROPE} position={[0, -0.85, 0]} scale={[3.2, 0.03, 0.03]} />
      </group>
    </group>
  )
}

/** A goat tied to its post, two hens pecking; petted, the goat lifts its head; chased, the hens run off and come back. */
function Cabris({ a, since }: { a: Acting | null; since: number }) {
  const head = useRef<THREE.Group>(null)
  const hens = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    if (head.current) head.current.rotation.x = a?.kind === 'cabri' && since >= 0 ? -0.35 + Math.sin(t * 6) * 0.1 : Math.max(0, Math.sin(t * 0.9)) * 0.6
    if (hens.current) {
      const run = a?.kind === 'poule' && since >= 0 ? Math.min(1, since / 1.2) * (since > 4 ? Math.max(0, 1 - (since - 4) / 3) : 1) : 0
      hens.current.position.x = run * 3
      hens.current.children.forEach((h, i) => (h.position.y = run ? Math.abs(Math.sin(t * 14 + i)) * 0.08 : 0))
    }
  })
  return (
    <group>
      <group position={[0.6, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Box p={[0, 0.55, 0]} s={[0.34, 0.32, 0.8]} c="#e9e2d0" />
        {[-0.12, 0.12].flatMap((x) => [-0.3, 0.3].map((z) => <Box key={`${x}${z}`} p={[x, 0.2, z]} s={[0.07, 0.4, 0.07]} c="#6b5a43" />))}
        <group ref={head} position={[0, 0.7, 0.4]} userData={{ live: true }}>
          <Box p={[0, 0.08, 0.06]} s={[0.2, 0.24, 0.26]} c="#d6ccb3" />
          <Box p={[0, 0.24, 0]} s={[0.18, 0.08, 0.06]} c="#3a2a1a" />
        </group>
      </group>
      <Box p={[0.3, 0.6, -0.15]} s={[0.6, 0.02, 0.02]} c="#a0703d" />
      <group ref={hens} userData={{ live: true }}>
        {[
          [1.6, 0.4, 0.3],
          [2.1, -0.1, -0.6],
        ].map(([x, z, r], i) => (
          <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
            <Box p={[0, 0.22, 0]} s={[0.24, 0.22, 0.34]} c={i ? '#8a5a32' : '#f1e3c8'} />
            <Box p={[0, 0.38, 0.16]} s={[0.12, 0.14, 0.12]} c={i ? '#8a5a32' : '#f1e3c8'} />
            <Box p={[0, 0.47, 0.17]} s={[0.04, 0.06, 0.08]} c="#e03131" />
            <Box p={[0, 0.06, 0]} s={[0.04, 0.12, 0.04]} c="#f59f00" />
          </group>
        ))}
      </group>
    </group>
  )
}

/** The tantie by her basin on the ground; helped, it goes up onto her head and she walks off with it. */
function Bassine({ w, pid, since }: { w: Who; pid: string; since: number }) {
  const basin = useRef<THREE.Group>(null)
  const her = useRef<THREE.Group>(null)
  useFrame(() => {
    const b = basin.current
    const h = her.current
    if (!b || !h) return
    const s = since < 0 ? -1 : since
    // Lifted (0 to 2.6 s) from the ground to the head, then off along the street.
    const k = s < 0 ? 0 : Math.min(1, s / 2.6)
    const walk = s > 3 ? (s - 3) * 1.1 : 0
    h.position.x = walk
    b.position.set(0.55 * (1 - k) + walk, 0.12 + k * 1.74, 0.38 * (1 - k))
  })
  const pose: Pose = since < 0 ? 'idle' : since < 2.7 ? 'carry' : since < 3 ? 'idle' : 'walk'
  return (
    <group>
      <group ref={her} rotation={[0, since > 3 ? Math.PI / 2 : 0, 0]}>
        <TalkHuman id={pid} look={w.look} gender={w.gender} pose={pose} seed={3} />
      </group>
      <group ref={basin} userData={{ live: true }}>
        <Box p={[0, 0, 0]} s={[0.72, 0.18, 0.72]} c="#c3c9cf" />
        {[-0.16, 0.16].flatMap((x) => [-0.16, 0.16].map((z) => <Box key={`${x}${z}`} p={[x, 0.15, z]} s={[0.22, 0.18, 0.22]} c={x > 0 ? '#f08c00' : '#e03131'} />))}
      </group>
    </group>
  )
}

/** A taxi broken down at the kerb, its hazards blinking, the driver at its back; pushed, it coughs into life and drives off. */
function Panne({ c, w, pid, since }: { c: Coin; w: Who; pid: string; since: number }) {
  const car = useRef<THREE.Group>(null)
  const lights = useRef<THREE.Group>(null)
  const oid = `rg-panne${c.key}`
  // In the way of the Sim and of the traffic, where it stands.
  useEffect(() => {
    const [x, z] = inScene({ at: c.at, rot: c.face }, 0, c.kerbZ)
    report(oid, { x, z, h: c.face + Math.PI / 2, half: 2.2, wait: 'parked' })
    moveObstacle(oid, { x, z, hw: 2.2, hd: 0.9, rot: c.face })
    return () => void (report(oid, null), moveObstacle(oid, null))
  }, [oid, c.at, c.face, c.kerbZ])
  useFrame(() => {
    const t = worldTime()
    const s = since
    // Pushed 0.6 m over the push, then away down the street.
    const x = s < 0 ? 0 : s < 4.5 ? (s / 4.5) * 0.6 : 0.6 + (s - 4.5) ** 2 * 1.6
    if (car.current) car.current.position.x = x
    if (lights.current) lights.current.visible = s < 4.5 && Math.floor(t * 2.5) % 2 === 0
  })
  return (
    <group>
      <group ref={car} position={[0, 0, c.kerbZ]} userData={{ live: true }}>
        <Vehicle p={[0, 0, 0]} kind="taxi" seed={c.seed.length} crew={false} />
        <group ref={lights}>
          {[-2.2, 2.2].flatMap((x) => [-0.75, 0.75].map((z) => <Box key={`${x}${z}`} p={[x, 0.75, z]} s={[0.06, 0.1, 0.18]} c="#ff922b" glow={1} />))}
        </group>
      </group>
      <group position={[-2.8, 0, c.kerbZ + 0.45]} rotation={[0, Math.PI / 2, 0]}>
        <TalkHuman id={pid} look={w.look} gender={w.gender} pose={since < 0 ? 'shrug' : since < 4.5 ? 'push' : 'cheer'} seed={5} />
      </group>
    </group>
  )
}
