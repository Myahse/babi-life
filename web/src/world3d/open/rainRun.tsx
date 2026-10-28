import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { FOOT, type Nav } from './nav'
import type { XZ } from './geo'

// When the rain comes down (the happening « pluie »), nobody strolls on: the
// street runs for cover. Each one runs to the nearest wall (under its eaves),
// out of a fenced pitch by its gate first, round the houses, never through
// them; and waits there, facing the street, until it stops. Then back to what
// they were doing, at a walk. The passers-by do it on their way
// (OpenWorld.tsx's Passerby); the street's scenes (the tea, the chat, the
// children's game, the pitches and the courts, the pupils, the pastor) give
// way to their people running (RainRunners).

/** Raining in the commune now (set by the open world: the happening « pluie »). */
export const useRain = create<{ on: boolean }>(() => ({ on: false }))
const RUN = 4.3
const BACK = 2.5

/** One person's run for cover: given where they'd be (`here`), where they are while it rains, and how. */
export class Shelterer {
  private phase: 'free' | 'run' | 'wait' | 'back' = 'free'
  private way: XZ[] = []
  private d = 0
  private at: XZ = [0, 0]
  private r = 0
  private t = 0
  constructor(private readonly jitter: number) {}

  step(nav: Nav, here: XZ, dt: number): { x: number; z: number; r: number; pose: Pose } | null {
    const raining = useRain.getState().on
    if (this.phase === 'free') {
      if (!raining) return null
      this.way = coverWay(nav, here, this.jitter) ?? []
      this.d = 0
      this.at = here
      if (this.way.length < 2) return null
      this.phase = 'run'
    }
    if (!raining && this.phase !== 'back') {
      this.phase = 'back'
      this.t = 0
    }
    if (this.phase === 'run') {
      this.d += RUN * Math.min(dt, 0.1)
      const p = along(this.way, this.d)
      this.at = p.at
      this.r = p.r
      if (p.end) {
        this.phase = 'wait'
        // Back to the wall, facing out.
        const [a, b] = [this.way[this.way.length - 2], this.way[this.way.length - 1]]
        this.r = Math.atan2(a[0] - b[0], a[1] - b[1])
      }
      return { x: this.at[0], z: this.at[1], r: this.r, pose: 'run' }
    }
    if (this.phase === 'wait') return { x: this.at[0], z: this.at[1], r: this.r, pose: 'idle' }
    // Back to where they'd be, at a walk.
    this.t += Math.min(dt, 0.1) / BACK
    if (this.t >= 1) {
      this.phase = 'free'
      return null
    }
    const k = this.t * this.t * (3 - 2 * this.t)
    const [x, z] = [this.at[0] + (here[0] - this.at[0]) * k, this.at[1] + (here[1] - this.at[1]) * k]
    return { x, z, r: Math.atan2(here[0] - this.at[0], here[1] - this.at[1]), pose: 'walk' }
  }
}

/** The way from `p` to the nearest cover: straight if nothing's in the way, else by the streets (and the last steps clear). */
export function coverWay(nav: Nav, p: XZ, jitter = 0, through: XZ[] = []): XZ[] | null {
  // Out by the gate first (a fenced pitch), then from there.
  const from = through.length ? through[through.length - 1] : p
  const lead: XZ[] = [p, ...through]
  for (const s of nav.shelters(from, 45, jitter).slice(0, 10)) {
    if (nav.clearLine(from, s)) return [...lead, s]
    const way = nav.path(from, s, FOOT)
    if (way && way.length > 1 && nav.clearLine(way[way.length - 2], s)) return [...lead, ...way.slice(1)]
  }
  return null
}

function along(way: XZ[], d: number): { at: XZ; r: number; end: boolean } {
  let left = d
  for (let i = 1; i < way.length; i++) {
    const [a, b] = [way[i - 1], way[i]]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (left <= l || i === way.length - 1) {
      const t = l ? Math.min(1, left / l) : 1
      return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], r: Math.atan2(b[0] - a[0], b[1] - a[1]), end: i === way.length - 1 && left >= l }
    }
    left -= l
  }
  return { at: way[way.length - 1], r: 0, end: true }
}

/** A group running for cover from where they were: each from its own place (world frame), out through `through` first (a pitch's gate). */
export type RainGroup = { id: string; from: XZ[]; through?: (p: XZ) => XZ[]; /** children */ small?: boolean }

/** The people of the street's scenes, running for cover while it rains (their scene isn't drawn meanwhile). */
export function RainRunners({ nav, groups }: { nav: Nav; groups: RainGroup[] }) {
  return (
    <NoShadows>
      {groups.flatMap((g) => g.from.map((p, i) => <Runner key={`${g.id}:${i}`} id={`${g.id}:${i}`} nav={nav} from={p} through={g.through?.(p) ?? []} small={g.small} />))}
    </NoShadows>
  )
}

function Runner({ id, nav, from, through, small }: { id: string; nav: Nav; from: XZ; through: XZ[]; small?: boolean }) {
  const who = useMemo(() => {
    const r = rng(`rain${id}`)
    const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
    return { gender, look: randomLook(gender, r), seed: r() * 100, jitter: (r() - 0.5) * 6 }
  }, [id])
  const passes = through.map((q) => q.join()).join(';')
  const way = useMemo(() => coverWay(nav, from, who.jitter, through), [nav, from[0], from[1], who.jitter, passes]) // eslint-disable-line react-hooks/exhaustive-deps
  const ref = useRef<THREE.Group>(null)
  const d = useRef(0)
  const [pose, setPose] = useState<Pose>('run')
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    if (!way || way.length < 2) {
      // Nowhere to go: hunched where they are.
      g.position.set(from[0], nav.heightAt(from[0], from[1]), from[1])
      if (pose !== 'idle') setPose('idle')
      return
    }
    d.current += RUN * Math.min(dt, 0.1)
    const p = along(way, d.current)
    g.position.set(p.at[0], nav.heightAt(p.at[0], p.at[1]), p.at[1])
    if (p.end) {
      const [a, b] = [way[way.length - 2], way[way.length - 1]]
      g.rotation.y = Math.atan2(a[0] - b[0], a[1] - b[1])
      if (pose !== 'idle') setPose('idle')
    } else g.rotation.y = p.r
  })
  return (
    <group ref={ref} scale={small ? 0.75 : 1}>
      <Human look={who.look} gender={who.gender} pose={pose} seed={who.seed} speed={1.6} />
    </group>
  )
}

/** Where a group of `n` stood round `at` (their scene turned by `rot`, spread `w` × `d`): their places, the same on every screen. */
export function spread(id: string, at: XZ, rot: number, n: number, w: number, d: number): XZ[] {
  const r = rng(`spread${id}`)
  const [c, s] = [Math.cos(rot), Math.sin(rot)]
  return [...Array(n)].map(() => {
    const [u, v] = [(r() - 0.5) * w, (r() - 0.5) * d]
    return [at[0] + u * c + v * s, at[1] - u * s + v * c] as XZ
  })
}

/** Out of a fenced pitch (its middle, its turn, its fence's half-width across): by the gate on one's own side, in the middle of the long side. */
export function byGate(c: XZ, rot: number, hw: number): (p: XZ) => XZ[] {
  const [nx, nz] = [Math.sin(rot), Math.cos(rot)]
  return (p) => {
    const side = (p[0] - c[0]) * nx + (p[1] - c[1]) * nz >= 0 ? 1 : -1
    return [
      [c[0] + nx * side * (hw - 0.8), c[1] + nz * side * (hw - 0.8)],
      [c[0] + nx * side * (hw + 2), c[1] + nz * side * (hw + 2)],
    ]
  }
}
