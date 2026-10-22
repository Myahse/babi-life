import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { LucideIcon } from 'lucide-react'
import type { Pose } from '../../avatar/Human'
import type { HomeSpot } from '../Walker'
import { whereabouts } from '../whereabouts'
import type { XZ } from './geo'

// Joining what the street does. The scenes drawn round the Sim (the grin's tea, a ring of people
// talking, the children's football, the party at night, the draughts under the lamp, the
// preacher, the pitch and the court, the marchands) each ask, once the Sim is close, with a bubble
// over them: a tap starts a street activity (backend sims/street.go, by the vendor id's prefix),
// and the Sim takes its place in the scene (a seat, a place in the ring, the pitch to run on) for
// as long as it lasts.

/** How to join in: the street activity asked for, and what the Sim is doing now (an interaction id). */
export const JoinIn = createContext<{ go?: (vendor: string) => Promise<string | null>; doing?: string }>({})

/** A point of a scene's own frame (x, z), in the world: the scene stands at `at`, turned `rot` about y. */
export const inScene = (s: { at: XZ; rot: number }, x: number, z: number): XZ => [s.at[0] + x * Math.cos(s.rot) + z * Math.sin(s.rot), s.at[1] - x * Math.sin(s.rot) + z * Math.cos(s.rot)]

/**
 * The Sim's place in a scene (Walker's furniture spot): at (x, z) of its frame, turned r there (0
 * faces its +z), in a pose, up or down by y (the grin's low benches); walked to from a step behind.
 */
export function placeIn(s: { at: XZ; rot: number }, x: number, z: number, r: number, pose: Pose, y = 0): HomeSpot {
  return { at: inScene(s, x, z), y, rot: s.rot + r, pose, lying: false, from: inScene(s, x - Math.sin(r) * 1.1, z - Math.cos(r) * 1.1) }
}

/** A scene's offer: what's asked (vendor: kind:scene), the activity it starts, where its bubble floats, and the Sim's place in it. */
export type Joining = {
  vendor: string
  activity: string
  at: XZ
  y?: number
  /** Metres from `at`: close enough to be asked in. */
  reach?: number
  ask: string
  icon: LucideIcon
  /** Said when tapped from too far. */
  far?: string
  /** Where the Sim goes for it: a place in the scene, or a ground to run up and down (Walker LOOPS). */
  spot?: HomeSpot
  pitch?: { dir: XZ; half: number }
}

/** Is the Sim in this scene now (for the scene's extra seat)? */
export function useJoined(vendor: string) {
  const { doing } = useContext(JoinIn)
  return !!doing && whereabouts.joined?.id === vendor && whereabouts.joined.activity === doing
}

/** A bubble over the scene, once the Sim is close: a tap joins in, the answer shows a moment. Hidden while in it. */
export function JoinBubble({ j }: { j: Joining }) {
  const { go, doing } = useContext(JoinIn)
  const reach = j.reach ?? 14
  const [near, setNear] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(clear.current), [])
  const say = (text: string, ms = 6000) => {
    setSaid(text)
    clearTimeout(clear.current)
    clear.current = setTimeout(() => setSaid(null), ms)
  }
  const away = () => Math.hypot(j.at[0] - whereabouts.sim[0], j.at[1] - whereabouts.sim[1])
  useFrame(() => {
    const d = away() < reach
    if (d !== near) setNear(d)
  })
  const tap = async () => {
    if (!go) return
    if (away() > reach) return say(j.far ?? 'Approche !', 3000)
    // Its place for the Sim, before asking (the answer starts the activity, and the Sim goes there).
    whereabouts.joined = j.spot ? { id: j.vendor, activity: j.activity, spot: j.spot } : null
    if (j.pitch) whereabouts.pitch = { at: j.at, ...j.pitch }
    say('…', 20000)
    const text = await go(j.vendor)
    if (text) say(text)
    else setSaid(null)
  }
  const inIt = doing === j.activity && (whereabouts.joined?.id === j.vendor || !!j.pitch)
  if ((!near || inIt) && !said) return null
  const Icon = j.icon
  return (
    <Html position={[j.at[0], j.y ?? 2.6, j.at[1]]} center zIndexRange={[25, 0]}>
      <button onClick={() => void tap()} className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-black/5 bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)] transition active:scale-95">
        {!said && <Icon size={15} strokeWidth={2.6} className="text-[#ff7a00]" />}
        {said ?? j.ask}
      </button>
    </Html>
  )
}
