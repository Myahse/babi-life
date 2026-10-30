import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'
import { t, tx } from '../../lib/i18n'

// The nouchis of the couloirs: in some of the narrow passages between the
// cours (a couloir between two houses, or a real alley of the map with walls
// close on both sides; never out on a street), two or three young guys hang
// about a few steps in, leaning on the wall, on the phone, chatting. Most of them come out in the evening and at night; in a few
// couloirs they're there all day. When the Sim walks by close, one comes up:
// « Grand frère, on dit quoi ? ». The player has a few seconds to tap « Je
// suis vigilant » (or to run off); otherwise they take what's in the pockets
// (the API, POST /sims/{id}/robbed, decides how much) and run off down the
// couloir. The same couloirs for everyone; the robbery is the Sim's own.

export type NouchiSpot = { id: string; at: XZ; rot: number; w: number; len: number; seed: number; /** where the couloir opens on the street: they watch it from inside */ mouth?: XZ }

const NEAR = 200 // metres: couloirs drawn around the Sim
const MAX = 3
const CLOSE = 6 // metres: close enough for them to come up
const ESCAPE = 11 // metres: far enough to have got away
const WAIT = 3.5 // seconds to stay vigilant

/** Out at this hour? In the evening and the night everywhere they hang about; in the daytime, only in some couloirs. */
const outNow = (s: NouchiSpot, h: number) => h >= 17 || h < 3 || (s.seed < 0.35 && h >= 10)

/** Between two walls here: a building a step off each side, and room to stand in the middle. */
function walled(nav: Nav, c: XZ, u: XZ, half: number) {
  const [px, pz] = [-u[1] * (half + 0.7), u[0] * (half + 0.7)]
  return nav.walkable(c[0], c[1]) && !nav.walkable(c[0] + px, c[1] + pz) && !nav.walkable(c[0] - px, c[1] - pz)
}

export function StreetNouchis({ nav, seed, onRobbed }: { nav: Nav; seed: string; onRobbed?: (spot: string) => Promise<string | null> }) {
  const all = useMemo(() => {
    const out: NouchiSpot[] = []
    // The couloirs between the game's houses: those that did end up between two walls, all along their front part.
    for (const c of nav.couloirs) {
      const { mouth: m, dir: u } = c
      if (hash(Math.round(m[0]), Math.round(m[1]), 911) > 0.4) continue
      if (![1.5, 3.5, 5.5].every((k) => walled(nav, [m[0] + u[0] * k, m[1] + u[1] * k], u, c.w / 2))) continue
      const at: XZ = [m[0] + u[0] * 2.8, m[1] + u[1] * 2.8]
      out.push({ id: `nouchi:${seed}:${Math.round(m[0])}:${Math.round(m[1])}`, at, rot: Math.atan2(-u[1], u[0]), w: c.w, len: c.len, seed: hash(m[0], m[1], 13), mouth: m })
    }
    // The map's own alleys: a footpath with real buildings close on both sides (a street with houses set back is no couloir).
    for (const e of nav.edges) {
      if (e.width > 2.5 || e.len < 15 || e.len > 140 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if (hash(Math.round(m[0]), Math.round(m[1]), 911) > 0.25) continue
      const u: XZ = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      if (![0.3, 0.5, 0.7].every((k) => walled(nav, [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], u, e.width / 2))) continue
      out.push({ id: `nouchi:${seed}:${Math.round(m[0])}:${Math.round(m[1])}`, at: m, rot: Math.atan2(-u[1], u[0]), w: e.width, len: e.len, seed: hash(m[0], m[1], 13) })
    }
    // In development, for tests in the browser.
    if (import.meta.env.DEV) Object.assign(globalThis, { __nouchis: out, __couloirs: nav.couloirs.length })
    return out
  }, [nav, seed])
  const [shown, setShown] = useState<NouchiSpot[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const h = (worldTime() / 3600) % 24
    const [sx, sz] = whereabouts.sim
    const near = all
      .filter((s) => outNow(s, h))
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.s)
    if (near.map((s) => s.id).join() !== shown.map((s) => s.id).join()) setShown(near)
  })
  return (
    <>
      {shown.map((s) => (
        <NouchiCorner key={s.id} spot={s} onRobbed={onRobbed} />
      ))}
    </>
  )
}

/** What they wear: survêt, débardeur, maillot, a cap or a bandana. */
const OUTFITS = ['debardeur', 'survet', 'jersey', 'basket', 'jogging', 'sweat']
const HATS = ['cap', 'capback', 'bandana', 'chain', 'headphones', 'none']

const COME = [t('Grand frère, on dit quoi ?'), t('Eh mon vieux, viens on cause…'), t('Petit, tu as 100 Djai sur toi ?'), t('Viens un peu, on va parler…')]
const BACK_OFF = [t("Hum, ça c'est quelqu'un d'éveillé… Laisse."), t("Tchrr, on peut pas l'avoir, celui-là."), t('On a rien dit hein, on cause seulement !')]
const RAN = [t('Tchrr… cours seulement !'), t('Hé, on voulait causer seulement !')]

type Phase = 'wait' | 'come' | 'gone' | 'took'

/** One couloir: the group, the one who comes up, the vigilance button. */
export function NouchiCorner({ spot, onRobbed, close = CLOSE }: { spot: NouchiSpot; onRobbed?: (spot: string) => Promise<string | null>; /** How near the Sim must come (the wish list's tour reaches across the street). */ close?: number }) {
  // Who: two or three, always the same at this couloir.
  const crew = useMemo(() => {
    const r = rng(spot.id)
    const n = spot.seed < 0.5 ? 3 : 2
    return Array.from({ length: n }, (_, i): { look: Look; pose: Pose; off: [number, number] } => ({
      look: { ...randomLook('homme', r), outfit: OUTFITS[Math.floor(r() * OUTFITS.length)], outfitColor: '', accessory: HATS[Math.floor(r() * HATS.length)], wear: r() < 0.5 ? 'use' : 'neuf' },
      pose: (['phone', 'talk', 'idle'] as Pose[])[i % 3],
      // Along the couloir, against one wall.
      off: [(i - (n - 1) / 2) * 1.3, (spot.w / 2 - 0.45) * (i % 2 ? 1 : 0.6)],
    }))
  }, [spot])
  // Where each one is, in the street's coordinates.
  const cos = Math.cos(spot.rot)
  const sin = Math.sin(spot.rot)
  const home = useMemo(() => crew.map((c): XZ => [spot.at[0] + c.off[0] * cos + c.off[1] * sin, spot.at[1] - c.off[0] * sin + c.off[1] * cos]), [crew, spot, cos, sin])
  const [phase, setPhase] = useState<Phase>('wait')
  const [line, setLine] = useState<string | null>(null)
  const [left, setLeft] = useState(WAIT)
  const st = useRef({ phase: 'wait' as Phase, t: 0, cool: 0, tapped: false })
  const lead = useRef<THREE.Group>(null)
  const pos = useRef(new THREE.Vector2(...home[0]))
  const [leadPose, setLeadPose] = useState<Pose>(crew[0].pose)

  const go = (p: Phase, text: string | null) => {
    st.current.phase = p
    st.current.t = 0
    setPhase(p)
    setLine(text)
    if (p === 'come') setLeft(WAIT)
  }

  useFrame((_, dt) => {
    const s = st.current
    s.t += dt
    s.cool = Math.max(0, s.cool - dt)
    const [sx, sz] = whereabouts.sim
    // In a couloir they watch its opening: who passes by in the street, close to it.
    const watch = spot.mouth ?? home[0]
    const d = Math.hypot(watch[0] - sx, watch[1] - sz)
    const p = pos.current
    let target: XZ = home[0]
    let pose: Pose = crew[0].pose
    if (s.phase === 'wait') {
      if (d < close + (spot.mouth ? 2 : 0) && s.cool <= 0 && whereabouts.simPose !== 'run') {
        s.tapped = false
        go('come', COME[Math.floor(spot.seed * 97) % COME.length])
      }
    } else if (s.phase === 'come') {
      // Up to the Sim, stopping an arm's length away.
      const k = Math.max(0, 1 - 1.1 / Math.max(0.01, Math.hypot(sx - p.x, sz - p.y)))
      target = [p.x + (sx - p.x) * k, p.y + (sz - p.y) * k]
      pose = k > 0.05 ? 'walk' : 'talk'
      const remain = Math.max(0, WAIT - s.t)
      if (Math.ceil(remain) !== Math.ceil(left)) setLeft(remain)
      // Nobody to play (the wish list's tour): the guide keeps her eyes open.
      if (!onRobbed && s.t > 3) s.tapped = true
      if (s.tapped) {
        s.cool = 90
        go('gone', BACK_OFF[Math.floor(spot.seed * 31) % BACK_OFF.length])
      } else if (whereabouts.simPose === 'run' || d > Math.max(ESCAPE, close + 5)) {
        s.cool = 60
        go('gone', RAN[Math.floor(spot.seed * 17) % RAN.length])
      } else if (remain <= 0) {
        s.cool = 600
        go('took', null)
        void onRobbed?.(spot.id).then((text) => text && setLine(text))
      }
    } else if (s.phase === 'gone') {
      pose = Math.hypot(home[0][0] - p.x, home[0][1] - p.y) > 0.3 ? 'walk' : crew[0].pose
      if (s.t > 5) go('wait', null)
    } else {
      // Off down the couloir at a run (to its far end, the back of the cours), back a while later.
      const run = spot.mouth ? spot.len - 4 : spot.len / 2
      const end: XZ = [spot.at[0] + run * cos, spot.at[1] - run * sin]
      target = s.t < 6 ? end : home[0]
      pose = s.t < 6 ? 'run' : 'walk'
      if (s.t > 14) go('wait', null)
    }
    // Move towards the target.
    const speed = pose === 'run' ? 5.5 : 1.8
    const [dx, dz] = [target[0] - p.x, target[1] - p.y]
    const dist = Math.hypot(dx, dz)
    if (dist > 0.05) {
      const step = Math.min(dist, speed * dt)
      p.x += (dx / dist) * step
      p.y += (dz / dist) * step
    }
    const g = lead.current
    if (g) {
      g.position.set(p.x, 0, p.y)
      // Facing where he walks, or the Sim when close.
      if (dist > 0.3) g.rotation.y = Math.atan2(dx, dz)
      else if (s.phase === 'come') g.rotation.y = Math.atan2(sx - p.x, sz - p.y)
      else g.rotation.y = spot.rot + (spot.mouth ? -Math.PI / 2 : Math.PI / 2)
    }
    if (pose !== leadPose) setLeadPose(pose)
  })

  return (
    <NoShadows>
      {/* A bare bulb on the wall over them */}
      {spot.mouth && (
        <mesh position={[home[0][0] + (spot.w / 2 - 0.08) * sin, 2.6, home[0][1] + (spot.w / 2 - 0.08) * cos]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshBasicMaterial color="#ffe3a0" />
        </mesh>
      )}
      {crew.slice(1).map((c, i) => (
        <group key={i} position={[home[i + 1][0], 0, home[i + 1][1]]} rotation={[0, spot.rot + (i % 2 ? -Math.PI / 2 : Math.PI / 2), 0]}>
          <Human look={c.look} gender="homme" pose={phase === 'took' ? 'run' : c.pose} seed={spot.seed * 100 + i} />
        </group>
      ))}
      <group ref={lead}>
        <Human look={crew[0].look} gender="homme" pose={leadPose} seed={spot.seed * 100 + 9} />
        {(line || phase === 'come') && (
          <Html position={[0, 2.3, 0]} center zIndexRange={[30, 0]}>
            <div className="flex flex-col items-center gap-1.5">
              {line && <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">{line}</div>}
              {phase === 'come' && onRobbed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    st.current.tapped = true
                  }}
                  className="animate-pulse rounded-full bg-[var(--color-orange)] px-4 py-2 text-[14px] font-extrabold whitespace-nowrap text-white shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)] active:scale-95"
                >
                  {tx('👀 Je suis vigilant·e ({0})', { 0: Math.ceil(left) })}
                </button>
              )}
            </div>
          </Html>
        )}
      </group>
    </NoShadows>
  )
}
