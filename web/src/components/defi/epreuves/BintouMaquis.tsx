import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, fx, knock } from './kit'
import { Stage3D, ease, groundAt, screenOf, type Finger } from './stage'
import { Box, Sign } from '../../../world3d/props'
import { Human, NoShadows, type Pose } from '../../../avatar/Human'
import { lookAt, randomLook } from '../../../avatar/options'
import { setExpression } from '../../../avatar/expressions'
import { Prop } from '../jeux/props'
import { MySim } from '../jeux/me'
import type { PropId } from '../jeux/types'
import { t } from '../../../lib/i18n'

// « Le maquis de Tantie Bintou », chapter 4 (game/epreuves.go): the opening day, every table full, and
// you giving Tantie a hand. In the maquis in 3D: the guests sit at the four tables, each with its order
// held up over its head (the dish itself, garba, alloco, poulet braisé, attiéké poisson, a cold drink) and
// its patience under it, shrinking; their faces go from a smile to a frown. The dishes wait on Tantie's
// counter, near you: take one with the finger and drop it on the table (or tap the dish, then the table).
// The right dish, and they eat; the wrong one, or a table left too long, and they grumble and go. As many
// served as you can (the score: served × 6 − missed × 4, out of 100).

const TIME = 50
const TABLES = 4
const DISHES: { id: string; prop: PropId; label: () => string }[] = [
  { id: 'garba', prop: 'garba', label: () => t('Garba') },
  { id: 'alloco', prop: 'alloco', label: () => t('Alloco') },
  { id: 'poulet', prop: 'poulet', label: () => t('Poulet') },
  { id: 'attieke', prop: 'attieke', label: () => t('Attiéké') },
  { id: 'boisson', prop: 'soda', label: () => t('Boisson') },
]
type Order = { dish: string; since: number; wait: number } | null
/** What a table shows: its guest (a new one for each order), what they're doing, the dish served. */
type Seat = { guest: number; eating: string | null; left: number }

/** The tables' places on the floor (two rows), the counter's top, the dishes on it. */
const SPOTS: [number, number][] = [
  [-1.35, -4.1],
  [1.35, -4.1],
  [-1.35, -1.2],
  [1.35, -1.2],
]
const COUNTER_Z = 2.1
const COUNTER_TOP = 0.95
const DISH_X = (i: number) => (i - 2) * 0.82
const TABLE_TOP = 0.76

export default function BintouMaquis({ onEnd }: { onEnd: (score: number) => void }) {
  const [now, setNow] = useState(0)
  const [orders, setOrders] = useState<Order[]>(Array(TABLES).fill(null))
  const [seats, setSeats] = useState<Seat[]>(() => Array.from({ length: TABLES }, (_, i) => ({ guest: i * 7 + 1, eating: null, left: 0 })))
  const [hand, setHand] = useState<string | null>(null)
  const [served, setServed] = useState(0)
  const [lost, setLost] = useState(0)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [me, setMe] = useState<Pose>('idle')
  // The clock starts once the maquis is on the screen (its first draw can take a while on a phone).
  const st = useRef({ t0: Infinity, next: 0.5, over: false })
  const cur = useRef<Order[]>(Array(TABLES).fill(null))
  // The dish in the finger: which, where it is in the scene (it follows), where the finger went down.
  const drag = useRef<{ dish: string; pos: THREE.Vector3; to: THREE.Vector3; moved: boolean; x: number; y: number } | null>(null)
  const [held, setHeld] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      if (st.current.t0 === Infinity) return
      const n = (performance.now() - st.current.t0) / 1000
      setNow(n)
      // (Worked on a copy kept in a ref: no side effects inside a state updater.)
      let v = cur.current
      // A table left too long: they leave grumbling.
      const gone = v.map((x, i) => (x && n - x.since > x.wait ? i : -1)).filter((i) => i >= 0)
      if (gone.length) {
        v = v.map((x, i) => (gone.includes(i) ? null : x))
        setLost((l) => l + gone.length)
        setSeats((s) => s.map((x, i) => (gone.includes(i) ? { ...x, left: performance.now() } : x)))
        for (const i of gone) setExpression(`bintou-${i}`, 'angry', 1200)
        beep(160, 0.25, 0.1, { type: 'square' })
        fx.shake(5)
      }
      if (!st.current.over && n >= st.current.next) {
        const free = v.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0)
        if (free.length) {
          const i = free[Math.floor(Math.random() * free.length)]
          v = v.map((x, k) => (k === i ? { dish: DISHES[Math.floor(Math.random() * DISHES.length)].id, since: n, wait: Math.max(6, 11 - n * 0.08) } : x))
          // A new guest sits down.
          setSeats((s) => s.map((x, k) => (k === i ? { guest: x.guest + 13, eating: null, left: 0 } : x)))
          beep(520, 0.06, 0.05)
        }
        st.current.next = n + Math.max(1.2, 2.6 - n * 0.03)
      }
      if (v !== cur.current) ((cur.current = v), setOrders(v))
    }, 100)
    return () => clearInterval(id)
  }, [])

  const left = TIME - now
  useEffect(() => {
    if (st.current.over || left > 0) return
    st.current.over = true
    const score = Math.round(Math.max(0, Math.min(100, served * 6 - lost * 4)))
    if (score >= 80) (fx.win(), setMe('dance'))
    setTimeout(() => onEnd(score), 900)
  }, [left, served, lost, onEnd])

  const pose = (p: Pose, ms = 900) => {
    setMe(p)
    window.setTimeout(() => setMe((q) => (q === p ? 'idle' : q)), ms)
  }
  /** A dish brought to table i: served, or not what they asked for. */
  const serve = (i: number, dish: string) => {
    const o = cur.current[i]
    const [x, z] = SPOTS[i]
    const at = screenOf(x, TABLE_TOP + 0.4, z)
    if (!o || st.current.over) return false
    if (o.dish === dish) {
      setServed((s) => s + 1)
      cur.current = cur.current.map((v, k) => (k === i ? null : v))
      setOrders(cur.current)
      setSeats((s) => s.map((v, k) => (k === i ? { ...v, eating: dish } : v)))
      setExpression(`bintou-${i}`, 'grin', 1600)
      knock(0.25, x / 3, 700)
      beep(700, 0.08, 0.12)
      beep(940, 0.14, 0.12)
      fx.good(at.x, at.y, now - o.since < 3 ? t('Rapide !') : '+1')
      pose('thumbsup')
    } else {
      setLost((l) => l + 1)
      setExpression(`bintou-${i}`, 'annoyed', 1800)
      fx.bad(at.x, at.y, t('C’est pas ça !'))
      setFlash({ text: t('« J’avais demandé autre chose ! »'), at: Date.now() })
      pose('facepalm')
    }
    return true
  }

  const p = useMemo(() => new THREE.Vector3(), [])
  /** The table the finger is over (on the floor's level, near a table's middle), or -1. */
  const tableAt = (x: number, y: number) => {
    if (!groundAt(x, y, TABLE_TOP, p)) return -1
    let best = -1
    let d = 1.15
    SPOTS.forEach(([sx, sz], i) => {
      const k = Math.hypot(p.x - sx, p.z - sz)
      if (k < d) ((d = k), (best = i))
    })
    return best
  }
  const touch = (f: Finger) => {
    if (st.current.over) return void (drag.current && f.kind === 'up' && ((drag.current = null), setHeld(null)))
    if (f.kind === 'down') {
      // A dish on the counter: taken in the finger.
      if (groundAt(f.x, f.y, COUNTER_TOP, p) && Math.abs(p.z - COUNTER_Z) < 0.75) {
        let best = -1
        let d = 0.5
        DISHES.forEach((_, i) => {
          const k = Math.abs(p.x - DISH_X(i))
          if (k < d) ((d = k), (best = i))
        })
        if (best >= 0) {
          const dish = DISHES[best].id
          drag.current = { dish, pos: new THREE.Vector3(DISH_X(best), COUNTER_TOP, COUNTER_Z), to: new THREE.Vector3(DISH_X(best), COUNTER_TOP + 0.5, COUNTER_Z), moved: false, x: f.x, y: f.y }
          setHeld(dish)
          beep(500, 0.05, 0.06)
          return
        }
      }
      // A table, with a dish picked by a tap before: served.
      const i = tableAt(f.x, f.y)
      if (i >= 0 && hand) {
        serve(i, hand)
        setHand(null)
      }
      return
    }
    const d = drag.current
    if (!d) return
    if (f.kind === 'move') {
      if (Math.hypot(f.x - d.x, f.y - d.y) > 8) d.moved = true
      if (groundAt(f.x, f.y, TABLE_TOP + 0.55, p)) d.to.copy(p)
      return
    }
    // Let go: on a table, served; not moved, it's picked (then tap the table); elsewhere, back on the counter.
    drag.current = null
    setHeld(null)
    if (!d.moved) return void setHand((h) => (h === d.dish ? null : d.dish))
    const i = tableAt(f.x, f.y)
    if (i >= 0 && serve(i, d.dish)) return void setHand(null)
    knock(0.12, 0, 1200)
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 10, 5.6]} look={[0, 0.5, -1.35]} fov={40} fit={[5.4, 8.8]} bg="#5a1a14" touch={touch} onReady={() => (st.current.t0 = performance.now())}>
        <Room />
        {SPOTS.map(([x, z], i) => (
          <TableSpot key={i} i={i} x={x} z={z} order={orders[i]} seat={seats[i]} t0={st.current.t0} />
        ))}
        <Counter hand={hand} held={held} drag={drag} />
        <MySim pose={me} p={[-2.05, 0, 0.75]} r={0.5} />
      </Stage3D>
      <Hud title={t('Le service de l’ouverture')} left={left} done={t('{n} servis', { n: served })} />
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] text-center text-[12px] font-extrabold text-white/85">{hand ? t('Touche la table à servir') : t('Glisse le plat jusqu’à la table')}</div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}

/** The maquis: its floor, its back wall with the sign, the lamps. */
function Room() {
  return (
    <group>
      <Box p={[0, -0.1, -1.5]} s={[9, 0.2, 13]} c="#b8a48c" />
      {[-3, -1, 1, 3].map((x) => (
        <Box key={x} p={[x, 0.005, -1.5]} s={[0.03, 0.01, 13]} c="#a08d76" />
      ))}
      <Box p={[0, 1.6, -6.2]} s={[9, 3.4, 0.3]} c="#e8d4a8" />
      <Box p={[0, 0.25, -6.02]} s={[9, 0.5, 0.06]} c="#c92a2a" />
      <Sign p={[0, 1.4, -6]} w={4.6} text={t('MAQUIS CHEZ TANTIE BINTOU')} bg="#c92a2a" fg="#ffd43b" />
    </group>
  )
}

/** A table: the plastic table and chair, the guest of the moment, their order over their head and their patience. */
function TableSpot({ i, x, z, order, seat, t0 }: { i: number; x: number; z: number; order: Order; seat: Seat; t0: number }) {
  const look = useMemo(() => {
    let s = seat.guest * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280)
    const gender = rnd() < 0.5 ? 'femme' : 'homme'
    return { look: lookAt(randomLook(gender, rnd)), gender } as const
  }, [seat.guest])
  const guest = useRef<THREE.Group>(null)
  const bubble = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Mesh>(null)
  const barMat = useRef<THREE.MeshLambertMaterial>(null)
  const mood = useRef('')
  const here = !!order || !!seat.eating
  useFrame((_, dt) => {
    const g = guest.current
    if (g) {
      // Sat down with a little pop; gone (they get up and leave) a moment after they've had enough.
      const gone = seat.left > 0 && !order
      const target = gone ? 0 : here ? 1 : 0
      const s = ease(g.scale.x, target, gone ? 6 : 10, dt)
      g.scale.setScalar(s)
      g.visible = s > 0.02
    }
    const b = bubble.current
    if (b) {
      const s = ease(b.scale.x, order ? 0.8 : 0, 12, dt)
      b.scale.setScalar(s)
      b.visible = s > 0.02
      b.position.y = 2.0 + Math.sin(performance.now() / 300 + i) * 0.05
    }
    if (order && bar.current && barMat.current) {
      const n = (performance.now() - t0) / 1000
      const p = Math.max(0, 1 - (n - order.since) / order.wait)
      bar.current.scale.x = Math.max(0.001, p)
      bar.current.position.x = -0.42 * (1 - p)
      barMat.current.color.set(p > 0.5 ? '#2f9e44' : p > 0.25 ? '#fab005' : '#e03131')
      // The face waits, then frowns.
      const m = p > 0.55 ? 'smile' : p > 0.25 ? 'thinking' : 'annoyed'
      if (m !== mood.current) ((mood.current = m), setExpression(`bintou-${i}`, m, 60000))
    } else mood.current = ''
  })
  const dish = DISHES.find((d) => d.id === order?.dish)
  return (
    <group position={[x, 0, z]}>
      {/* The plastic table, its chair behind */}
      <Box p={[0, TABLE_TOP - 0.03, 0]} s={[1.3, 0.06, 0.95]} c="#f1f3f5" />
      {[-0.55, 0.55].map((dx) => [-0.38, 0.38].map((dz) => <Box key={`${dx}${dz}`} p={[dx, 0.36, dz]} s={[0.07, 0.72, 0.07]} c="#dee2e6" />))}
      <Box p={[0, 0.44, -0.75]} s={[0.55, 0.06, 0.5]} c="#c92a2a" />
      <Box p={[0, 0.8, -1.0]} s={[0.55, 0.7, 0.06]} c="#c92a2a" />
      <group ref={guest} position={[0, 0, -0.78]} scale={0}>
        <NoShadows>
          <Human look={look.look} gender={look.gender} pose={seat.eating ? 'eat' : 'sit'} seed={seat.guest} fitted faceId={`bintou-${i}`} />
        </NoShadows>
      </group>
      {/* What they eat, once served */}
      {seat.eating && (
        <group position={[0, TABLE_TOP, 0.05]} scale={0.42}>
          <Prop id={DISHES.find((d) => d.id === seat.eating)!.prop} />
        </group>
      )}
      {/* The order held up: the dish on a white card, the patience under it */}
      <group ref={bubble} position={[x < 0 ? -0.62 : 0.62, 2.0, -0.85]} scale={0}>
        <group rotation={[-0.75, 0, 0]}>
          <Box p={[0, 0, 0]} s={[1.0, 0.82, 0.08]} c="#ffffff" />
          <Box p={[0, -0.5, 0.02]} s={[0.18, 0.18, 0.06]} c="#ffffff" r={0.785} />
          {dish && (
            <group key={dish.id} position={[0, -0.18, 0.12]} rotation={[0.9, 0, 0]} scale={0.46}>
              <Prop id={dish.prop} />
            </group>
          )}
          <Box p={[0, 0.3, 0.05]} s={[0.86, 0.1, 0.03]} c="#dee2e6" />
          <mesh ref={bar} position={[0, 0.3, 0.07]}>
            <boxGeometry args={[0.84, 0.09, 0.03]} />
            <meshLambertMaterial ref={barMat} color="#2f9e44" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Tantie's counter, near you, its five dishes on plates; the one in the finger follows it, lifted. */
function Counter({ hand, held, drag }: { hand: string | null; held: string | null; drag: React.RefObject<{ dish: string; pos: THREE.Vector3; to: THREE.Vector3 } | null> }) {
  const flying = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const f = flying.current
    if (!f) return
    const d = drag.current
    if (d) {
      d.pos.x = ease(d.pos.x, d.to.x, 22, dt)
      d.pos.y = ease(d.pos.y, d.to.y, 22, dt)
      d.pos.z = ease(d.pos.z, d.to.z, 22, dt)
      f.position.copy(d.pos)
      f.rotation.z = (d.to.x - d.pos.x) * -0.6
      f.visible = true
      return
    }
    f.visible = false
  })
  return (
    <group>
      <Box p={[0, COUNTER_TOP / 2, COUNTER_Z]} s={[4.6, COUNTER_TOP, 0.9]} c="#c92a2a" />
      <Box p={[0, COUNTER_TOP + 0.03, COUNTER_Z]} s={[4.8, 0.06, 1.0]} c="#8a5a32" />
      {DISHES.map((d, i) => (
        <group key={d.id} position={[DISH_X(i), COUNTER_TOP + 0.06, COUNTER_Z]}>
          {/* Its plate, lit when it's the one picked */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.34, 0.3, 0.05, 10]} />
            <meshLambertMaterial color={hand === d.id ? '#ffd43b' : '#f8f9fa'} emissive={hand === d.id ? '#ffd43b' : '#000000'} emissiveIntensity={hand === d.id ? 0.5 : 0} />
          </mesh>
          <group scale={0.4} position={[0, 0.05, 0]} visible={held !== d.id}>
            <Prop id={d.prop} />
          </group>
        </group>
      ))}
      <group ref={flying} visible={false} scale={0.5}>
        {held && <Prop id={DISHES.find((d) => d.id === held)!.prop} />}
      </group>
    </group>
  )
}
