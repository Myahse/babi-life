import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { keyOpen, useFeatures } from '../../lib/features'
import { rng } from '../themes'
import { TalkHuman } from '../Talkable'
import { nameFor, talkTo } from '../talk'
import type { Spot, XZ } from './bigPlace'

// At a table or at the bar, a while after the Sim has sat down, someone comes
// up the way it came: « Je peux m'asseoir à ta table ? ». Yes: they sit across
// (at the bar, beside) and the chat opens; no: they go on their way. Once per
// sitting, not every time. Behind the update « table » (lib/features).

type Phase = 'wait' | 'come' | 'ask' | 'sit' | 'gone' | 'leave'

const SPEED = 1.4
// The lab (city.html?…&table): someone comes at once, every time.
const QUICK = typeof location !== 'undefined' && location.pathname.endsWith('city.html') && location.search.includes('table')

/** Where they come from and stop: the last steps of the Sim's own way in (free of the furniture by then). */
function pathOf(way: XZ[], spot: Spot): XZ[] | null {
  const back: XZ[] = [way[way.length - 1]]
  for (let i = way.length - 2, d = 0; i >= 0 && d < 6; i--) {
    d += Math.hypot(way[i][0] - way[i + 1][0], way[i][1] - way[i + 1][1])
    back.unshift(way[i])
  }
  if (back.length >= 2) return back
  const from = spot.from
  if (!from) return null
  const [dx, dz] = [from[0] - spot.at[0], from[1] - spot.at[1]]
  const l = Math.hypot(dx, dz) || 1
  return [[from[0] + (dx / l) * 3, from[1] + (dz / l) * 3], from]
}

export function TableAsker({ spot, way, settled, seed }: { spot: Spot | null; way: XZ[]; settled: boolean; /** Whose sitting (the Sim's id). */ seed: string }) {
  const feats = useFeatures()
  const at = spot && (spot.pose === 'eat' || spot.pose === 'drink') && !spot.loop ? spot : null
  const plan = useMemo(() => {
    if (!at) return null
    const path = pathOf(way, at)
    if (!path) return null
    const r = rng(`table|${seed}|${at.at.join(',')}|${Date.now()}`)
    if (r() > 0.7 && !QUICK) return null
    const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
    const n = Math.floor(r() * 1000)
    // Across the table, facing the Sim; at the bar, beside it, facing the counter too.
    const [fx, fz] = [Math.sin(at.rot), Math.cos(at.rot)]
    const seat: XZ = at.pose === 'eat' ? [at.at[0] + fx * 1.5, at.at[1] + fz * 1.5] : [at.at[0] + fz * 0.9, at.at[1] - fx * 0.9]
    const seatRot = at.pose === 'eat' ? at.rot + Math.PI : at.rot
    return { path, gender, n, look: randomLook(gender, r), name: nameFor(gender, n), delay: QUICK ? 2 : 14 + r() * 26, seat, seatRot }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, seed])
  const open = keyOpen(feats, 'table')
  const [phase, setPhase] = useState<Phase>('wait')
  const [said, setSaid] = useState<string | null>(null)
  const g = useRef<THREE.Group>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const clock = useRef({ t: 0, d: 0, plan: null as typeof plan })
  useFrame((_, dtIn) => {
    const dt = Math.min(dtIn, 0.05)
    const c = clock.current
    if (c.plan !== plan) {
      // A new sitting (or none): start over.
      c.plan = plan
      c.t = 0
      c.d = 0
      if (phase !== 'wait') setPhase('wait')
      setSaid(null)
    }
    const o = g.current
    if (!o || !plan) return
    if (phase === 'wait') {
      if (settled && open) c.t += dt
      if (c.t > plan.delay) setPhase('come')
      return
    }
    const len = plan.path.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - plan.path[i - 1][0], p[1] - plan.path[i - 1][1]) : 0), 0)
    if (phase === 'come' || phase === 'leave') {
      c.d = Math.max(0, Math.min(len, c.d + (phase === 'come' ? 1 : -1) * SPEED * dt))
      const [x, z, ry] = along(plan.path, c.d)
      o.position.set(x, 0, z)
      o.rotation.set(0, phase === 'come' ? ry : ry + Math.PI, 0)
      if (phase === 'come' && c.d >= len) setPhase('ask')
      if (phase === 'leave' && c.d <= 0) setPhase('gone')
    } else if (phase === 'ask') {
      // Turned to the Sim.
      const [x, z] = plan.path[plan.path.length - 1]
      o.position.set(x, 0, z)
      o.rotation.set(0, Math.atan2(at!.at[0] - x, at!.at[1] - z), 0)
    } else if (phase === 'sit') {
      // Onto the seat.
      const k = Math.min(1, dt * 2.5)
      o.position.x += (plan.seat[0] - o.position.x) * k
      o.position.z += (plan.seat[1] - o.position.z) * k
      o.position.y += ((at!.y ?? 0) - o.position.y) * k
      const dr = Math.atan2(Math.sin(plan.seatRot - o.rotation.y), Math.cos(plan.seatRot - o.rotation.y))
      o.rotation.set(0, o.rotation.y + dr * k, 0)
    }
  })
  // drei's <Html> loses whichever one mounts with the canvas (SpotActions): it comes a frame later, and stays.
  if (!ready) return null
  if (!plan)
    return (
      <group ref={g}>
        {null}
        <Html position={[0, -1000, 0]} center zIndexRange={[35, 0]}>
          {null}
        </Html>
      </group>
    )
  const npc = {
    id: `table-${plan.n}-${seed}`,
    name: plan.name,
    gender: plan.gender,
    seed: plan.n,
    look: plan.look,
    doing: at!.pose === 'eat' ? 'à ta table' : 'au bar, à côté de toi',
  }
  const pose: Pose = phase === 'sit' ? at!.pose : phase === 'ask' ? 'talk' : 'walk'
  const answer = (yes: boolean) => {
    if (yes) {
      setSaid(at!.pose === 'eat' ? 'Merci, c’est gentil !' : 'Ah, on va bien causer !')
      setPhase('sit')
      setTimeout(() => {
        setSaid(null)
        talkTo(npc)
      }, 1600)
    } else {
      setSaid('Pas de souci, bonne continuation !')
      setTimeout(() => {
        setSaid(null)
        setPhase('leave')
      }, 1400)
    }
  }
  return (
    <group ref={g}>
      {phase !== 'wait' && phase !== 'gone' && <TalkHuman id={npc.id} look={plan.look} gender={plan.gender} pose={pose} speed={SPEED} seed={plan.n / 1000} />}
      <Html position={phase === 'ask' || said ? [0, 2.3, 0] : [0, -1000, 0]} center zIndexRange={[35, 0]}>
        {phase === 'ask' && !said ? (
          <div className="flex flex-col items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
            <div className="rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">
              <span className="text-[var(--color-orange)]">{plan.name}</span> · {at!.pose === 'eat' ? 'Je peux m’asseoir à ta table ?' : 'Je peux me poser à côté de toi ?'}
            </div>
            <div className="flex gap-1.5">
              <button className="rounded-full bg-[var(--color-orange)] px-3 py-1 text-[12px] font-extrabold text-white shadow" onClick={() => answer(true)}>
                Oui, assieds-toi
              </button>
              <button className="rounded-full bg-black/65 px-3 py-1 text-[12px] font-extrabold text-white shadow" onClick={() => answer(false)}>
                Non merci
              </button>
            </div>
          </div>
        ) : said ? (
          <div className="rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">
            <span className="text-[var(--color-orange)]">{plan.name}</span> · {said}
          </div>
        ) : null}
      </Html>
    </group>
  )
}

/** A point `d` metres along the path, and the way it faces there. */
function along(path: XZ[], d: number): [number, number, number] {
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (d <= l || i === path.length - 1) {
      const k = l ? Math.min(1, d / l) : 0
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])]
    }
    d -= l
  }
  return [path[0][0], path[0][1], 0]
}
