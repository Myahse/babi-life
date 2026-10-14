import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng } from './themes'
import { BACK_STREET_Z, CROSS_X, EXTENT_X, SIDEWALK } from './layout'

// Characters of the street that aren't going anywhere: couples hiding in the
// back alleys late at night, and the street's fou wandering about.

/** Late at night, couples kiss in the dark of the back alleys. */
export function Lovers({ seed, hour }: { seed: string; hour: number }) {
  const couples = useMemo(() => {
    const r = rng(`lovers${seed}`)
    return [...Array(3)].map(() => {
      let x = (r() * 2 - 1) * (EXTENT_X - 20)
      // Not on a lit crossroads.
      if (Math.abs(Math.abs(x) - CROSS_X) < 10) x += 14
      const a = r() < 0.5 ? 'femme' : 'homme'
      const b = r() < 0.85 ? (a === 'femme' ? 'homme' : 'femme') : a
      return {
        x,
        z: (r() < 0.5 ? -1 : 1) * (BACK_STREET_Z - 2.6),
        people: [a, b].map((gender) => ({ gender: gender as 'femme' | 'homme', look: randomLook(gender as 'femme' | 'homme', r) })),
        seed: r() * 100,
      }
    })
  }, [seed])
  if (!(hour >= 21 || hour < 4)) return null
  return (
    <NoShadows>
      {couples.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          {c.people.map((p, k) => (
            <group key={k} position={[k ? 0.27 : -0.27, 0, 0]} rotation={[0, k ? -Math.PI / 2 : Math.PI / 2, 0]}>
              <Human look={p.look} gender={p.gender} pose="hug" seed={c.seed + k} />
            </group>
          ))}
        </group>
      ))}
    </NoShadows>
  )
}

/**
 * Le fou of the quarter: barefoot, clothes worn out, walking from one side of
 * the street to the median and back, stopping to talk to nobody.
 */
export function Fou({ seed }: { seed: string }) {
  const who = useMemo(() => {
    const r = rng(`fou${seed}`)
    const look = { ...randomLook('homme', r), outfit: 'debardeur', outfitColor: '#b8a98a', bottomColor: '#5a4a3a', shoeColor: '#6b4a32', hair: 'locks', beard: 'full', accessory: 'none' }
    return { look, x: (r() * 2 - 1) * 60, z: SIDEWALK, tx: 0, tz: 0, wait: 2 + r() * 3, r }
  }, [seed])
  const ref = useRef<THREE.Group>(null)
  const [pose, setPose] = useState<Pose>('rant')
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    const g = ref.current
    if (!g) return
    if (who.wait > 0) {
      who.wait -= step
      if (who.wait <= 0) {
        // Somewhere else: along the sidewalk, or out to the median.
        who.tx = Math.max(-EXTENT_X + 10, Math.min(EXTENT_X - 10, who.x + (who.r() * 2 - 1) * 25))
        who.tz = [SIDEWALK, -SIDEWALK, 0, SIDEWALK - 0.6][Math.floor(who.r() * 4)]
        setPose('walk')
      }
      return
    }
    const dx = who.tx - who.x
    const dz = who.tz - who.z
    const d = Math.hypot(dx, dz)
    if (d < 0.1) {
      who.wait = 3 + who.r() * 5
      setPose(who.r() < 0.7 ? 'rant' : 'idle')
      return
    }
    const v = Math.min(d, 1.0 * step)
    who.x += (dx / d) * v
    who.z += (dz / d) * v
    g.position.set(who.x, 0, who.z)
    g.rotation.y = Math.atan2(dx, dz)
  })
  return (
    <NoShadows>
      <group ref={ref} position={[who.x, 0, who.z]}>
        <Human look={who.look} gender="homme" pose={pose} seed={3} />
      </group>
    </NoShadows>
  )
}

/** The bande, at its corner of the street, once the Sim has joined it. */
export function Bande({ seed }: { seed: string }) {
  const boys = useMemo(() => {
    const r = rng(`bande${seed}`)
    return (['rant', 'idle', 'wave'] as Pose[]).map((pose, i) => ({ pose, look: { ...randomLook('homme', r), outfit: r() < 0.5 ? 'debardeur' : 'basket', accessory: 'capback' }, a: (i / 3) * Math.PI * 2, seed: r() * 100 }))
  }, [seed])
  return (
    <NoShadows>
      <group position={[CROSS_X - 8, 0, -(SIDEWALK + 1.2)]}>
        {boys.map((b, i) => (
          <group key={i} position={[Math.cos(b.a) * 0.9, 0, Math.sin(b.a) * 0.6]} rotation={[0, -b.a - Math.PI / 2, 0]}>
            <Human look={b.look} gender="homme" pose={b.pose} seed={b.seed} />
          </group>
        ))}
      </group>
    </NoShadows>
  )
}
