import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { NoShadows } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { clearObstacles, setObstacles } from '../obstacles'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { worldTime } from '../../lib/worldClock'
import { t as tr } from '../../lib/i18n'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'

// The street of New York and Montréal (the updates « pays-usa », « pays-canada »; Abidjan's sellers between
// the cars, its stalls and its SOTRA stay home: OpenWorld): a fire hydrant at the corners (red in New York,
// red with a yellow cap in Montréal), newspaper boxes, and on the busy sides the food carts with their
// umbrella, a seller behind (hot dogs and pretzels in New York, coffee and « queues de castor » in Montréal).

type Cart = { id: string; at: XZ; rot: number }
const NEAR = 110
const MAX = 3

const hydrantGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.75, 8)
const capGeo = new THREE.CylinderGeometry(0.08, 0.18, 0.18, 8)
const boxGeo = new THREE.BoxGeometry(0.5, 1.05, 0.45)

/** Where the hydrants and boxes stand: a corner of most crossings, back on the pavement. */
function cornersOf(nav: Nav): { hydrants: XZ[]; boxes: XZ[] } {
  const hydrants: XZ[] = []
  const boxes: XZ[] = []
  for (const e of nav.edges) {
    if (e.width > 14 || e.len < 24 || nav.ys[e.a] || nav.ys[e.b]) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
    const off = e.width / 2 + 1.1
    const h = hash(Math.round(a[0]), Math.round(a[1]), 31)
    if (h < 0.55) {
      const at: XZ = [a[0] + ux * 6 - uz * off, a[1] + uz * 6 + ux * off]
      if (nav.walkable(at[0], at[1])) hydrants.push(at)
    }
    if (h > 0.8) {
      const at: XZ = [a[0] + ux * 9 + uz * off, a[1] + uz * 9 - ux * off]
      if (nav.walkable(at[0], at[1])) boxes.push(at)
    }
  }
  return { hydrants, boxes }
}

function cartsOf(nav: Nav): Cart[] {
  const out: Cart[] = []
  for (const e of nav.edges) {
    if (e.width > 14 || e.len < 40 || nav.ys[e.a] || nav.ys[e.b]) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    if (hash(Math.round(m[0]), Math.round(m[1]), 53) > 0.09) continue
    const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
    const off = e.width / 2 + 1.6
    const at: XZ = [m[0] - uz * off, m[1] + ux * off]
    if (!nav.walkable(at[0], at[1])) continue
    out.push({ id: `${Math.round(m[0])}:${Math.round(m[1])}`, at, rot: Math.atan2(ux, uz) })
  }
  return out
}

function Instances({ nav, at, geo, color, y, cap }: { nav: Nav; at: XZ[]; geo: THREE.BufferGeometry; color: string; y: number; cap?: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const capRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    at.forEach(([x, z], i) => {
      // (On the ground where it rises: Montréal has its hill.)
      const g = nav.heightAt(x, z)
      m.makeTranslation(x, g + y, z)
      ref.current?.setMatrixAt(i, m)
      m.makeTranslation(x, g + y * 2 + 0.09, z)
      capRef.current?.setMatrixAt(i, m)
    })
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true
    if (capRef.current) capRef.current.instanceMatrix.needsUpdate = true
  }, [nav, at, y])
  if (!at.length) return null
  return (
    <>
      <instancedMesh key={`b${at.length}`} ref={ref} args={[geo, undefined, at.length]} castShadow frustumCulled={false}>
        <meshLambertMaterial color={color} />
      </instancedMesh>
      {cap && (
        <instancedMesh key={`c${at.length}`} ref={capRef} args={[capGeo, undefined, at.length]} frustumCulled={false}>
          <meshLambertMaterial color={cap} />
        </instancedMesh>
      )}
    </>
  )
}

function FoodCart({ cart, montreal, y }: { cart: Cart; montreal: boolean; y: number }) {
  const who = useMemo(() => {
    const r = rng(`chariot:${cart.id}`)
    const gender: 'femme' | 'homme' = r() < 0.35 ? 'femme' : 'homme'
    return { gender, look: randomLook(gender, r), seed: r() * 100 }
  }, [cart.id])
  const [cry, setCry] = useState(false)
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1) return
    tick.current = 0
    // Now and then, calling the passers-by (the same on every screen: the shared clock).
    const k = (worldTime() + hash(cart.at[0], cart.at[1], 9) * 30) % 30
    setCry(k < 4)
  })
  const [body, trim, stripe] = montreal ? ['#8a1c1c', '#f1f1f1', '#e8b04a'] : ['#c9ced6', '#2b5fa8', '#f2c230']
  return (
    <group position={[cart.at[0], y, cart.at[1]]} rotation={[0, cart.rot, 0]}>
      <NoShadows>
        {/* The cart: its steel box on two wheels, the grill on top, the umbrella in stripes */}
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[1.7, 0.85, 0.85]} />
          <meshLambertMaterial color={body} />
        </mesh>
        <mesh position={[0, 0.62, 0.43]}>
          <boxGeometry args={[1.5, 0.22, 0.02]} />
          <meshLambertMaterial color={trim} />
        </mesh>
        <mesh position={[0, 1.08, 0]}>
          <boxGeometry args={[1.5, 0.08, 0.7]} />
          <meshLambertMaterial color="#3a3a3a" />
        </mesh>
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.95, 10]} />
            <meshLambertMaterial color="#222" />
          </mesh>
        ))}
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.3, 6]} />
          <meshLambertMaterial color="#888" />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <mesh key={i} position={[0, 2.3, 0]} rotation={[0, (i * Math.PI) / 4, 0]}>
            <coneGeometry args={[1.3, 0.45, 2, 1, true, 0, Math.PI / 4]} />
            <meshLambertMaterial color={i % 2 ? stripe : trim} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </NoShadows>
      <group position={[0, 0, -0.95]} rotation={[0, 0, 0]}>
        <TalkHuman id={`chariot:${cart.id}`} look={who.look} gender={who.gender} pose="idle" seed={who.seed} />
      </group>
      {cry && (
        <Html position={[0, 2.9, -0.9]} center distanceFactor={14} zIndexRange={[20, 0]}>
          <div className="pointer-events-none rounded-full bg-white px-3 py-1 text-sm font-extrabold whitespace-nowrap text-black shadow">{montreal ? tr('Café chaud, queues de castor !') : tr('Hot dogs, bretzels, deux dollars !')}</div>
        </Html>
      )}
    </group>
  )
}

export function WestStreet({ nav, montreal }: { nav: Nav; montreal: boolean }) {
  const { hydrants, boxes } = useMemo(() => cornersOf(nav), [nav])
  const all = useMemo(() => cartsOf(nav), [nav])
  useEffect(() => {
    setObstacles(
      'west-carts',
      all.map((c) => ({ x: c.at[0], z: c.at[1], r: 1.2 })),
    )
    return () => clearObstacles('west-carts')
  }, [all])
  const [shown, setShown] = useState<Cart[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((c) => ({ c, d: Math.hypot(c.at[0] - sx, c.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.c)
    if (near.map((c) => c.id).join() !== shown.map((c) => c.id).join()) setShown(near)
    // In development, for tests in the browser: what stands in the street.
    if (import.meta.env.DEV) Object.assign(globalThis, { __west: { hydrants: hydrants.length, boxes: boxes.length, carts: all.length, near: near.map((c) => c.at), sim: [sx, sz] } })
  })
  return (
    <>
      <Instances nav={nav} at={hydrants} geo={hydrantGeo} color="#c8261e" y={0.375} cap={montreal ? '#f2c230' : '#c8261e'} />
      <Instances nav={nav} at={boxes} geo={boxGeo} color={montreal ? '#1c3f94' : '#2a7a3a'} y={0.525} />
      {shown.map((c) => (
        <FoodCart key={c.id} cart={c} montreal={montreal} y={nav.heightAt(c.at[0], c.at[1])} />
      ))}
    </>
  )
}
