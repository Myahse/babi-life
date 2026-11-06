import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { FamVisit, Sim } from '../lib/types'
import type { HomeSpot } from './Walker'
import type { Pose } from '../avatar/Human'
import { Character } from './Character'
import { Talkable } from './Talkable'
import { gridWay } from './gridPath'
import { Crib } from './build/Crib'
import { doingOf as memberDoing, useHousehold, type Member } from '../game/household'
import { clock } from '../game/rules'
import { elderLook, famOf, kidLook, visitorLook } from '../game/famille'

// Le mode vie's generations and visitors at home (the update « mode-vie », game/famille.ts; backend
// sims/famille.go): the house's children (the baby in its cot, the child playing in the yard, the teenager
// on the phone), the elders on their seats (white-haired, walking slowly), the photos of those gone on their
// stand, and the visitor: at the gate knocking, then in, on the sofa, at the table for what they're served,
// round the house when shown it, and off through the gate at their time. Everyone walks round the furniture
// (gridWay), nobody pops; directed (game/household.ts) they go where they're told. Few draws: the game's
// own characters and a handful of boxes.

type XZ = [number, number]

/** What was just done for the visitor (components/Famille.tsx tells it): where they go for it, a while. */
let hosted: { act: string; at: number } | null = null
const subs = new Set<() => void>()
export function hostedNow(act: string) {
  hosted = { act, at: Date.now() }
  subs.forEach((f) => f())
}
const useHosted = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => hosted)

/** The children (not babies: they aren't told what to do) and the elders, for the household strip. */
export function familyMembers(sim: Sim): Member[] {
  const f = famOf(sim)
  if (!f) return []
  const out: Member[] = []
  for (const k of f.kids ?? []) if (k.stage && k.stage !== 'bebe') out.push({ id: `kid:${k.id}`, name: k.name, kin: 'enfant', gender: k.gender, look: kidLook(k, sim.look), stage: k.stage })
  for (const e of f.elders ?? []) out.push({ id: `elder:${e.id}`, name: e.name, kin: 'ancien', gender: e.gender, look: elderLook(e) })
  return out
}

const KID_PACE = 1.5
const ELDER_PACE = 0.8
const GUEST_PACE = 1.25

export function FamilyHome({ sim, spots, spot, free, span, gate }: { sim: Sim; spots: Record<string, HomeSpot>; /** Where the Sim is (not taken by another). */ spot: HomeSpot | null; free: (x: number, z: number) => boolean; span: number; gate: XZ }) {
  const f = famOf(sim)
  const hh = useHousehold()
  const host = useHosted()
  const { hour } = clock(sim.gameMinutes)
  const night = hour >= 22 || hour < 6
  // The places to be, handed out in turn so nobody sits on another (the Sim's own spot left alone).
  const free_ = (s?: HomeSpot) => !!s && !(spot && Math.hypot(s.at[0] - spot.at[0], s.at[1] - spot.at[1]) < 0.4)
  const seats = Object.keys(spots).filter((k) => k.startsWith('seat:')).sort().map((k) => spots[k]).filter(free_)
  const beds = Object.keys(spots).filter((k) => k.startsWith('bed:')).sort().reverse().map((k) => spots[k]).filter(free_)
  const pool = [...(night ? beds : []), ...seats, spots['watch-tv'], spots.golvo].filter(free_) as HomeSpot[]
  const used = new Set<HomeSpot>()
  const take = (prefer?: HomeSpot): HomeSpot | undefined => {
    if (prefer && !used.has(prefer) && free_(prefer)) return (used.add(prefer), prefer)
    const s = pool.find((x) => !used.has(x))
    if (s) used.add(s)
    return s
  }
  // A spot beside another (two at the table, a child by the sofa), when the places run out.
  const beside = (s: HomeSpot | undefined, k: number): HomeSpot | undefined => (s ? { ...s, at: [s.at[0] + Math.cos(s.rot) * 0.8 * k, s.at[1] - Math.sin(s.rot) * 0.8 * k], from: [s.from[0] + Math.cos(s.rot) * 0.8 * k, s.from[1] - Math.sin(s.rot) * 0.8 * k], y: 0, lying: false, stool: false, pose: 'idle' } : undefined)
  const v = f?.visit
  // The visitor gone: seen walking off to the gate first.
  const [leaving, setLeaving] = useState<FamVisit | null>(null)
  const last = useRef<FamVisit | undefined>(undefined)
  useEffect(() => {
    if (last.current?.state === 'dedans' && !v) setLeaving(last.current)
    last.current = v
  }, [v])
  const guest = v ?? leaving ?? null
  let guestAt: HomeSpot | undefined
  if (guest) {
    const outside: HomeSpot = { at: gate, from: gate, y: 0, rot: Math.PI, pose: 'idle', lying: false }
    if (!v || v.state !== 'dedans') guestAt = v?.state === 'porte' ? outside : !v ? { ...outside, at: [gate[0], gate[1] + 2], from: [gate[0], gate[1] + 2] } : undefined
    else {
      const fresh = host && Date.now() - host.at < 45_000 ? host.act : null
      if (fresh === 'manger') guestAt = spots.golvo && { ...spots.golvo, pose: 'eat' }
      else if (fresh === 'dames') guestAt = spots.golvo && { ...spots.golvo, pose: 'sit' }
      else if (fresh === 'boire') {
        const seat = take(spots['watch-tv'] ?? seats[0])
        guestAt = seat && { ...seat, pose: 'drink' }
      }
      else if (fresh === 'visite') guestAt = tour(spots, Math.floor((Date.now() - host!.at) / 9000))
      // (The sofa's middle is the partner's: a seat, else the sofa's other end.)
      const sofa = spots['watch-tv']
      guestAt ??= seats.find((x) => !used.has(x) && !(sofa && Math.hypot(x.at[0] - sofa.at[0], x.at[1] - sofa.at[1]) < 0.6)) ?? beside(sofa, -0.9)
      if (guestAt && !fresh) guestAt = { ...guestAt, pose: Math.floor(Date.now() / 20000) % 2 ? 'talk' : 'sit' }
      if (guestAt) used.add(guestAt)
    }
  }
  const kids = f?.kids ?? []
  const elders = f?.elders ?? []
  return (
    <>
      {kids.map((k, i) => {
        const look = kidLook(k, sim.look)
        if (k.stage === 'bebe') {
          // The baby: in its cot (by the beds), sleeping at night, awake and wriggling by day.
          const at = beside(spots.sleep ?? seats[0] ?? spots['watch-tv'], -1.2 - i * 0.6)
          if (!at) return null
          return (
            <group key={k.id} position={[at.at[0], 0, at.at[1]]} rotation={[0, at.rot, 0]}>
              <Crib />
              <group position={[0, 0.45, 0]} rotation={night ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
                <Talkable npc={{ id: `kid:${k.id}`, name: k.name, gender: k.gender, seed: k.seed, look }} pose={night ? 'sleep' : 'idle'}>
                  {() => <Character look={look} gender={k.gender} stage="bebe" pose={night ? 'sleep' : 'idle'} marker={false} seed={k.seed % 97} />}
                </Talkable>
              </group>
            </group>
          )
        }
        const told = memberDoing(hh, `kid:${k.id}`)
        let s = told && spots[told.id] ? spots[told.id] : undefined
        if (!s && !night && k.stage === 'enfant' && spots['jouer-cour'] && !used.has(spots['jouer-cour'])) s = (used.add(spots['jouer-cour']), { ...spots['jouer-cour'], pose: hour % 2 ? 'kick' : 'dance' })
        s ??= take() ?? beside(spots['watch-tv'] ?? seats[0], 1 + i)
        if (!s) return null
        const pose: Pose = s.lying ? 'sleep' : told ? s.pose : k.stage === 'ado' && s.pose === 'sit' ? 'call' : s.pose
        return <Person key={k.id} id={`kid:${k.id}`} name={k.name} gender={k.gender} seed={k.seed} look={look} stage={k.stage ?? 'enfant'} to={{ ...s, pose }} free={free} span={span} pace={KID_PACE} />
      })}
      {elders.map((e, i) => {
        const told = memberDoing(hh, `elder:${e.id}`)
        const s = (told && spots[told.id]) || take() || beside(spots['watch-tv'] ?? seats[0], -1 - i)
        if (!s) return null
        return <Person key={e.id} id={`elder:${e.id}`} name={e.name} gender={e.gender} seed={(e.seed ?? 0) + 11} look={elderLook(e)} stage="adulte" to={s} free={free} span={span} pace={e.stage === 'senior' ? ELDER_PACE : 1.2} old={e.stage === 'senior'} />
      })}
      {guest && guestAt && (
        <Person key={guest.who} id={guest.who} talkId={guest.who.replace(/^p-/, '')} name={guest.name} gender={guest.gender} seed={guest.seed} look={visitorLook(guest)} stage="adulte" to={v?.state === 'porte' ? { ...guestAt, pose: 'wave' } : guestAt} free={free} span={span} pace={GUEST_PACE} onThere={!v ? () => setLeaving(null) : undefined} marker />
      )}
      {f?.memorials?.length ? <Memorials sim={sim} spots={spots} free={free} /> : null}
      <VisitCam at={guest && guestAt ? [guestAt.at[0], guestAt.y + 0.8, guestAt.at[1]] : null} />
    </>
  )
}

/**
 * The camera while someone visits: HomeInside's FocusOn looks over to them (at the gate knocking, on the sofa,
 * at the table for what they're served), and lets go once they're gone.
 */
let focus: [number, number, number] | null = null
const focusSubs = new Set<() => void>()
const setFocus = (f: typeof focus) => {
  if (f?.join() === focus?.join()) return
  focus = f
  focusSubs.forEach((x) => x())
}
export const useVisitFocus = () => useSyncExternalStore((f) => (focusSubs.add(f), () => void focusSubs.delete(f)), () => focus)

function VisitCam({ at }: { at: [number, number, number] | null }) {
  const key = at?.map((n) => n.toFixed(1)).join() ?? ''
  useEffect(() => {
    setFocus(at)
    return () => setFocus(null)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** Shown round the house: a room after another (the kitchen, the beds, the bathroom…), every few seconds. */
function tour(spots: Record<string, HomeSpot>, step: number): HomeSpot | undefined {
  const stops = ['cook-attieke', 'sleep', 'shower', 'watch-tv', 'golvo'].map((k) => spots[k]).filter(Boolean)
  const s = stops[step % Math.max(1, stops.length)]
  // Standing at the way in, looking at it (not lying in the bed, not under the shower).
  return s && { ...s, at: s.from, y: 0, lying: false, stool: false, pose: 'idle', screen: undefined }
}

/** Someone of the house (or the visitor) going where they're to be, round the furniture, at their pace. */
function Person({ id, talkId, name, gender, seed, look, stage, to, free, span, pace, old, onThere, marker }: { id: string; talkId?: string; name: string; gender: 'femme' | 'homme'; seed: number; look: ReturnType<typeof kidLook>; stage: string; to: HomeSpot; free: (x: number, z: number) => boolean; span: number; pace: number; old?: boolean; onThere?: () => void; marker?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const at = useRef({ x: to.at[0], z: to.at[1], y: to.y, rot: to.rot })
  const path = useRef<XZ[]>([])
  const [walking, setWalking] = useState(false)
  const key = `${to.at[0].toFixed(2)},${to.at[1].toFixed(2)},${to.rot.toFixed(2)},${to.y}`
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const a = at.current
    const from: XZ = [a.x, a.z]
    if (Math.hypot(from[0] - to.at[0], from[1] - to.at[1]) < 0.3) {
      Object.assign(a, { x: to.at[0], z: to.at[1], y: to.y, rot: to.rot })
      onThere?.()
      return
    }
    a.y = 0
    const way = gridWay(from, to.from, free, 0.35, span + 6, 160 * 160) ?? [from, to.from]
    path.current = [...way.slice(1), to.at]
    setWalking(true)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dtIn) => {
    const o = g.current
    if (!o) return
    const a = at.current
    if (walking) {
      const dt = Math.min(dtIn, 0.15)
      const next = path.current[0]
      if (!next) {
        Object.assign(a, { x: to.at[0], z: to.at[1], y: to.y, rot: to.rot })
        setWalking(false)
        onThere?.()
      } else {
        const [dx, dz] = [next[0] - a.x, next[1] - a.z]
        const d = Math.hypot(dx, dz)
        const step = pace * dt
        if (d <= step) {
          a.x = next[0]
          a.z = next[1]
          path.current.shift()
        } else {
          a.x += (dx / d) * step
          a.z += (dz / d) * step
          const want = Math.atan2(dx, dz)
          a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 8)
        }
      }
    }
    o.position.set(a.x, a.y, a.z)
    o.rotation.set(0, a.rot, 0)
  })
  const npc = { id: talkId ?? id, name, gender, seed, look }
  return (
    <group ref={g} name={`fam:${id}`}>
      {walking ? (
        // (Tappable on the way too: the wheel as they come in.)
        <Talkable npc={npc} pose="walk">
          {() => <Character look={look} gender={gender} walking stage={stage} marker={!!marker} moodColor="#ffb020" seed={seed % 97} speed={pace} old={old} />}
        </Talkable>
      ) : (
        <group rotation={to.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
          <Talkable npc={npc} pose={to.pose}>
            {(shown) => <Character look={look} gender={gender} pose={to.lying ? 'sleep' : shown} stage={stage} marker={!!marker} moodColor="#ffb020" seed={seed % 97} old={old} />}
          </Talkable>
        </group>
      )}
    </group>
  )
}

/** Those gone: their photo in a frame on a little stand by the living room, the face in 3D inside it. */
function Memorials({ sim, spots, free }: { sim: Sim; spots: Record<string, HomeSpot>; free: (x: number, z: number) => boolean }) {
  const ms = famOf(sim)?.memorials ?? []
  // Beside the sofa (or the first seat), on free floor.
  const base = spots['watch-tv'] ?? Object.values(spots).find((s) => !s.lying)
  const where = useMemo((): { at: XZ; rot: number } | null => {
    if (!base) return null
    for (const r of [1.1, 1.5, 1.9, 2.4])
      for (let a = 0; a < 8; a++) {
        const ang = base.rot + Math.PI / 2 + (a * Math.PI) / 4
        const p: XZ = [base.at[0] + Math.sin(ang) * r, base.at[1] + Math.cos(ang) * r]
        if (free(p[0], p[1]) && free(p[0] + 0.3, p[1]) && free(p[0] - 0.3, p[1])) return { at: p, rot: base.rot }
      }
    return null
  }, [base?.at[0], base?.at[1], base?.rot]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!where) return null
  return (
    <group position={[where.at[0], 0, where.at[1]]} rotation={[0, where.rot, 0]}>
      {/* The little table */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.5 + 0.35 * Math.min(3, ms.length - 1), 0.7, 0.4]} />
        <meshLambertMaterial color="#6b4423" />
      </mesh>
      {ms.slice(-4).map((m, i, all) => {
        const look = elderLook({ look: m.look, seed: m.seed, gender: m.gender, stage: 'senior' })
        const x = (i - (all.length - 1) / 2) * 0.36
        return (
          <group key={m.name + m.at} position={[x, 0.7, 0]}>
            {/* The frame, its glass dark behind the face, a candle beside */}
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.3, 0.38, 0.04]} />
              <meshLambertMaterial color="#c9a227" />
            </mesh>
            <mesh position={[0, 0.2, 0.022]}>
              <boxGeometry args={[0.24, 0.32, 0.01]} />
              <meshLambertMaterial color="#e8dcc8" />
            </mesh>
            <group position={[0, 0.05, 0.03]} scale={0.16}>
              <Character look={look} gender={m.gender} pose="idle" marker={false} seed={3} />
            </group>
            <mesh position={[0.17, 0.06, 0.08]}>
              <boxGeometry args={[0.04, 0.12, 0.04]} />
              <meshLambertMaterial color="#fff6e0" emissive="#ffcf6b" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
