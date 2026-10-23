import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { Vehicle } from '../vehicles'
import { whereabouts } from '../whereabouts'
import { rng } from '../themes'
import { deliveryState, type Delivery } from '../../screens/GolvoApp'
import type { Nav } from './nav'
import type { XZ } from './geo'

// The Golvo courier (screens/GolvoApp.tsx), seen in the street: over the last
// stretch of the delivery he rides up the streets to the Sim (to its house's
// door, for an order delivered home; only seen there) on his moto, the
// yellow box on the back; there he gets off with the bag and waits (a tap on
// him collects the order); once it's handed over he gets back on and rides
// off the way he came, and is gone.

/** The last seconds of the ride, shown: before that he's somewhere in town. */
const APPROACH = 18
/** Riding off after the handover. */
const LEAVE = 8

type Run = { key: number; way: XZ[]; len: number; cum: number[]; stop: XZ }

/** Where along the way, `d` metres from its start: the point and the direction. */
function along(r: Run, d: number): { at: XZ; dir: number } {
  const t = Math.max(0, Math.min(r.len, d))
  let i = 1
  while (i < r.cum.length - 1 && r.cum[i] < t) i++
  const [a, b] = [r.way[i - 1], r.way[i]]
  const seg = r.cum[i] - r.cum[i - 1] || 1
  const k = (t - r.cum[i - 1]) / seg
  return { at: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dir: Math.atan2(b[0] - a[0], b[1] - a[1]) }
}

export function Courier({ delivery, nav, onCollect }: { delivery: Delivery | null; nav: Nav; onCollect?: () => void }) {
  const moto = useRef<THREE.Group>(null)
  const [phase, setPhase] = useState<'away' | 'ride' | 'here' | 'leave'>('away')
  const run = useRef<Run | null>(null)
  const leftAt = useRef(0)
  // The order just handed over: he leaves (the delivery is gone from the phone).
  const had = useRef<Delivery | null>(null)
  useEffect(() => {
    if (delivery) had.current = delivery
    else if (had.current && run.current && (phase === 'here' || phase === 'ride')) {
      leftAt.current = performance.now()
      setPhase('leave')
    }
  }, [delivery]) // eslint-disable-line react-hooks/exhaustive-deps
  const name = (delivery ?? had.current)?.courier ?? 'Ibrahim'
  const look = useMemo(() => ({ ...randomLook('homme', rng(`golvo${name}`)), outfit: 'casual', outfitColor: '#f4c430', accessory: 'none' }), [name])

  /** The way in: from some streets away to the road by the Sim, then to its side. */
  const plan = (key: number, home?: boolean): Run | null => {
    const door = home ? whereabouts.places.find((p) => p.id === 'home')?.door : null
    if (home && !door) return null
    const target: XZ = door ? [door[0], door[1]] : [whereabouts.sim[0], whereabouts.sim[1]]
    const near = nav.nearest(target, 120)
    if (!near) return null
    const e = nav.edges[near.edge]
    const r = rng(`golvo${key}`)
    const out = nav.wander(e.a, 6, r, 5)
    const way = [...out].reverse()
    way.push(near.at)
    // Stop by the Sim, a step to its side, off the middle of the road.
    const [dx, dz] = [target[0] - near.at[0], target[1] - near.at[1]]
    const l = Math.hypot(dx, dz)
    const stop: XZ = l > 3 ? [target[0] - (dx / l) * 2, target[1] - (dz / l) * 2] : [target[0] + 1.6, target[1] + 0.6]
    way.push(stop)
    const cum = [0]
    for (let i = 1; i < way.length; i++) cum.push(cum[i - 1] + Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1]))
    return { key, way, len: cum[cum.length - 1], cum, stop }
  }

  useFrame(() => {
    const g = moto.current
    if (delivery) {
      const st = deliveryState(delivery, Date.now())
      const coming = st.stage === 'here' || (st.stage === 'road' && st.left < APPROACH)
      if (!coming) {
        if (phase !== 'away') setPhase('away')
        return
      }
      if (!run.current || run.current.key !== delivery.start) run.current = plan(delivery.start, delivery.home)
      const r = run.current
      if (!r) return
      // The phase first: he's drawn from the next frame on.
      const want = st.stage === 'here' ? 'here' : 'ride'
      if (phase !== want) setPhase(want)
      if (!g) return
      if (st.stage === 'here') {
        const { dir } = along(r, r.len)
        g.position.set(r.stop[0], 0, r.stop[1])
        g.rotation.y = dir
        return
      }
      // Easing in at the end: he slows down as he arrives.
      const k = 1 - st.left / APPROACH
      const e = 1 - (1 - k) * (1 - k)
      const { at, dir } = along(r, r.len * e)
      g.position.set(at[0], nav.heightAt(at[0], at[1]), at[1])
      g.rotation.y = dir
    } else if (phase === 'leave' && run.current && g) {
      // Off again, the way he came.
      const k = (performance.now() - leftAt.current) / 1000 / LEAVE
      if (k >= 1) {
        run.current = null
        had.current = null
        setPhase('away')
        return
      }
      const r = run.current
      const { at, dir } = along(r, r.len * (1 - k * k))
      g.position.set(at[0], nav.heightAt(at[0], at[1]), at[1])
      g.rotation.y = dir + Math.PI
    }
  })

  if (phase === 'away') return null
  const off = phase === 'here'
  return (
    <group ref={moto}>
      {/* The moto (its front is +x: turned to face the way), the yellow box on the back */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <Vehicle p={[0, 0, 0]} kind="moto" color="#2b2b30" />
        <mesh position={[-0.75, 1.05, 0]}>
          <boxGeometry args={[0.5, 0.45, 0.5]} />
          <meshLambertMaterial color="#f4c430" />
        </mesh>
        <mesh position={[-0.75, 1.05, 0.255]}>
          <planeGeometry args={[0.3, 0.2]} />
          <meshLambertMaterial color="#00a862" />
        </mesh>
      </group>
      <NoShadows>
        {off ? (
          // Off the moto, the bag in his hands, by the Sim.
          <group position={[0.9, 0, 0.4]} rotation={[0, -Math.PI / 2, 0]} onClick={(e) => (e.stopPropagation(), onCollect?.())}>
            <Human look={look} gender="homme" pose="busy" seed={4} />
            <mesh position={[0, 1.0, 0.32]}>
              <boxGeometry args={[0.38, 0.3, 0.26]} />
              <meshLambertMaterial color="#f4c430" />
            </mesh>
            <Html position={[0, 2.3, 0]} center zIndexRange={[25, 0]}>
              <button className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]" onClick={() => onCollect?.()}>
                « Golvo ! Ta commande est là ! » 🛵
              </button>
            </Html>
          </group>
        ) : (
          <group position={[0, 0.42, 0.05]}>
            <Human look={look} gender="homme" pose="sit" seed={4} />
          </group>
        )}
      </NoShadows>
    </group>
  )
}
