import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { TalkHuman } from '../Talkable'
import type { Nav } from './nav'
import { lightFor, lightsOf, type Light } from './trafficFlow'
import { useRain } from './rainRun'

// The sellers at the traffic lights, as at every big crossroads of Abidjan: on the kerb while the
// traffic goes, and the moment the light turns red, down between the stopped cars with their goods,
// the bassine of water sachets on the head, the boxes of tissues, the chargers and earphones hanging
// from the arm, the tray of peanuts; back on the kerb at the green. From the shared clock (the lights'
// own cycle): the same comings and goings on every screen. Only round the lights near the Sim.

const NEAR = 130
const MAX_LIGHTS = 2

type Goods = 'eau' | 'mouchoirs' | 'chargeurs' | 'arachides'
const GOODS: Goods[] = ['eau', 'mouchoirs', 'chargeurs', 'arachides']
const CRY: Record<Goods, () => string> = {
  eau: () => tr('Eau glacée, 50 F !'),
  mouchoirs: () => tr('Mouchoirs, mouchoirs !'),
  chargeurs: () => tr('Chargeur, écouteurs, j’ai tout !'),
  arachides: () => tr('Arachides grillées !'),
}

export function LightSellers({ nav, seed }: { nav: Nav; seed: string }) {
  // Every crossroads with lights of the streets loaded (lightsOf, one big cell over all of it).
  const lights = useMemo(() => lightsOf(nav, [{ x0: -1e6, z0: -1e6 }], 2e6), [nav])
  const [shown, setShown] = useState<Light[]>([])
  const tick = useRef(10)
  const rain = useRain((r) => r.on)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = lights
      .map((l) => ({ l, d: Math.hypot(l.x - sx, l.z - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LIGHTS)
      .map((x) => x.l)
    if (near.map(key).join() !== shown.map(key).join()) setShown(near)
    if (import.meta.env.DEV) Object.assign(globalThis, { __lightSellers: near })
  })
  if (rain) return null
  return (
    <NoShadows>
      {shown.map((l) => (
        <group key={key(l)} position={[l.x, l.y, l.z]} rotation={[0, l.axis, 0]}>
          {[0, 1, 2].map((i) => (
            <Seller key={i} l={l} i={i} seed={`${seed}|${key(l)}|${i}`} />
          ))}
        </group>
      ))}
    </NoShadows>
  )
}

const key = (l: Light) => `${Math.round(l.x)}:${Math.round(l.z)}`

const M = (color: string) => new THREE.MeshLambertMaterial({ color })
const BASIN = M('#2f6fd6')
const SACHET = new THREE.MeshLambertMaterial({ color: '#dff3ff', transparent: true, opacity: 0.85 })
const BOXES = [M('#f2f2f2'), M('#ff8fb1'), M('#8fd3ff')]
const CABLE = M('#1b1b20')
const TRAY = M('#c9a35b')
const NUTS = M('#a8682f')
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12)

/** What a seller carries, held up on the head or the arm. */
function Wares({ goods }: { goods: Goods }) {
  if (goods === 'eau')
    return (
      <group position={[0, 1.98, 0]}>
        <mesh geometry={CYL} material={BASIN} scale={[0.62, 0.16, 0.62]} />
        {[...Array(6)].map((_, i) => (
          <mesh key={i} geometry={BOX} material={SACHET} position={[Math.sin(i) * 0.16, 0.1, Math.cos(i) * 0.16]} scale={[0.14, 0.06, 0.1]} />
        ))}
      </group>
    )
  if (goods === 'mouchoirs')
    return (
      <group position={[0.32, 1.1, 0.25]}>
        {BOXES.map((m, i) => (
          <mesh key={i} geometry={BOX} material={m} position={[0, i * 0.13, 0]} scale={[0.22, 0.12, 0.14]} />
        ))}
      </group>
    )
  if (goods === 'chargeurs')
    return (
      <group position={[0.34, 1.15, 0.2]}>
        {[...Array(5)].map((_, i) => (
          <mesh key={i} geometry={BOX} material={CABLE} position={[0, -i * 0.09, i * 0.03]} scale={[0.03, 0.4, 0.03]} />
        ))}
      </group>
    )
  return (
    <group position={[0, 1.96, 0]}>
      <mesh geometry={BOX} material={TRAY} scale={[0.6, 0.05, 0.42]} />
      {[...Array(6)].map((_, i) => (
        <mesh key={i} geometry={CYL} material={NUTS} position={[((i % 3) - 1) * 0.17, 0.06, (Math.floor(i / 3) - 0.5) * 0.17]} scale={[0.1, 0.07, 0.1]} />
      ))}
    </group>
  )
}

/**
 * One seller: a spot on the kerb of the main road, either side of the crossroads, and a spot down in
 * the road where the cars wait at the red, by the middle line. Walks between the two with the light.
 */
function Seller({ l, i, seed }: { l: Light; i: number; seed: string }) {
  const who = useMemo(() => {
    const r = rng(seed)
    const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
    return { gender, look: randomLook(gender, r), seed: r() * 100, goods: GOODS[Math.floor(r() * GOODS.length)], side: r() < 0.5 ? -1 : 1 }
  }, [seed])
  // The crossroads' frame (rotated to the main road): the main road runs along z, its kerbs at x = ±width/2.
  const end = i % 2 ? -1 : 1
  const along = end * (l.width / 2 + 6 + i * 3.5)
  const kerb: [number, number] = [who.side * (l.width / 2 + 1.4), along]
  const lane: [number, number] = [who.side * 0.6, along + end * 1.5]
  const g = useRef<THREE.Group>(null)
  const [pose, setPose] = useState<Pose>('idle')
  const [crying, setCrying] = useState(false)
  const start = useRef(true)
  const spot = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    if (start.current) {
      start.current = false
      o.position.set(kerb[0], 0, kerb[1])
    }
    // Red (or amber) for the main road: the cars wait, down into the road; back on the kerb a few
    // seconds before the green (not in the way when the cars go).
    const t = worldTime() + i * 0.7
    const forced = import.meta.env.DEV ? (globalThis as { __sellersOut?: boolean }).__sellersOut : undefined
    const out = forced ?? (lightFor(l, 0, t) !== 'green' && lightFor(l, 0, t + 4) !== 'green')
    const [tx, tz] = out ? lane : kerb
    const [dx, dz] = [tx - o.position.x, tz - o.position.z]
    const d = Math.hypot(dx, dz)
    let next: Pose = out ? 'wave' : 'idle'
    if (d > 0.1) {
      const step = Math.min(d, 1.6 * Math.min(dt, 0.1))
      o.position.x += (dx / d) * step
      o.position.z += (dz / d) * step
      o.rotation.y = Math.atan2(dx, dz)
      next = 'walk'
    } else o.rotation.y = out ? (end > 0 ? Math.PI : 0) : -who.side * (Math.PI / 2)
    if (next !== pose) setPose(next)
    // Crying out the goods to the Sim close by.
    const w = o.localToWorld(spot.set(0, 0, 0))
    const near = Math.hypot(w.x - whereabouts.sim[0], w.z - whereabouts.sim[1]) < 9
    if (near !== crying) setCrying(near)
    if (import.meta.env.DEV) ((globalThis as { __sellers?: Record<string, number[]> }).__sellers ??= {})[seed] = [Math.round(w.x), Math.round(w.z), out ? 1 : 0]
  })
  return (
    <group ref={g}>
      <TalkHuman id={`feu:${seed}`} look={who.look} gender={who.gender} pose={pose} seed={who.seed} />
      <Wares goods={who.goods} />
      {crying && (
        <Html position={[0, 2.5, 0]} center zIndexRange={[20, 0]}>
          <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">{CRY[who.goods]()}</div>
        </Html>
      )}
    </group>
  )
}
