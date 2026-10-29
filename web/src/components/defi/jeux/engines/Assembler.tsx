import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage, scoreOf } from '../Shell'
import type { EngineProps, Item, Jeu, PropId } from '../types'

// Put it together (the garba plate, the dress, the table set): the base in the middle, the parts laid
// round it. An order asked, the parts in a given order: tap them in that order, each flies onto the
// base and stacks there. A wrong one shakes and costs. A few orders, each slid away when it's done.

const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v)
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const PART_SCALE = 1.15
const STACK_SCALE = 0.8
const BASE_SCALE = 1.7
const SLOTS: [number, number][] = [[-2.25, 0.35], [2.25, 0.35], [-1.4, 2.0], [1.4, 2.0], [-2.1, -1.35], [2.1, -1.35], [0, 2.45], [0, -1.6]]

type Laid = { item: Item; x: number; z: number; r: number }
type Piece = { key: number; prop: PropId; from: [number, number]; y: number; r: number; dx: number; dz: number }

/** How tall an object stands (once drawn), at scale 1. */
const tall = new Map<PropId, number>()
const measure = (id: PropId, g: THREE.Object3D, scale: number) => {
  if (tall.has(id)) return
  const b = new THREE.Box3().setFromObject(g)
  if (!b.isEmpty()) tall.set(id, (b.max.y - b.min.y) / scale)
}

/** A part lying there, turning a little: a tap takes one (it's never used up); a wrong one shakes. */
function Part({ l, shake, onPick }: { l: Laid; shake: number; onPick: () => void }) {
  const g = useRef<THREE.Group>(null)
  const m = useRef<THREE.Group>(null)
  const t = useRef(9)
  const s0 = useRef(shake)
  useFrame((st, dt) => {
    if (s0.current !== shake) {
      s0.current = shake
      t.current = 0
    }
    t.current += dt
    if (!g.current) return
    if (m.current) measure(l.item.prop, m.current, PART_SCALE)
    const k = t.current
    g.current.position.x = l.x + (k < 0.45 ? Math.sin(k * 45) * (0.45 - k) * 0.5 : 0)
    g.current.rotation.y = l.r + Math.sin(st.clock.elapsedTime * 0.8 + l.x) * 0.15
  })
  return (
    <group ref={g} position={[l.x, 0, l.z]} scale={PART_SCALE} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onPick())}>
      <group ref={m}>
        <Prop id={l.item.prop} />
      </group>
      {/* A wide hold round it: a finger finds it */}
      <mesh position={[0, 0.3, 0]} visible={false}>
        <boxGeometry args={[1.3, 0.6, 1.3]} />
      </mesh>
    </group>
  )
}

/** A part on its way: an arc from where it lay to the top of the stack, a little bounce as it lands. */
function Flying({ p }: { p: Piece }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    if (!g.current) return
    const k = Math.min(1, t.current / 0.5)
    const e = 1 - (1 - k) * (1 - k)
    g.current.position.set(THREE.MathUtils.lerp(p.from[0], p.dx, e), THREE.MathUtils.lerp(0, p.y, e) + Math.sin(k * Math.PI) * 1.6, THREE.MathUtils.lerp(p.from[1], p.dz, e))
    const land = Math.max(0, t.current - 0.5)
    const squash = land > 0 && land < 0.2 ? Math.sin((land / 0.2) * Math.PI) * 0.18 : 0
    const s = THREE.MathUtils.lerp(PART_SCALE, STACK_SCALE, e)
    g.current.scale.set(s * (1 + squash), s * (1 - squash), s * (1 + squash))
    g.current.rotation.y = p.r * e + (1 - e) * k * 6
  })
  return (
    <group ref={g} position={[p.from[0], 0, p.from[1]]} scale={PART_SCALE}>
      <Prop id={p.prop} />
    </group>
  )
}

/** The base, with what's stacked on it: slid out to the right when the order is done, a new one in from the left. */
function Base({ id, slide, children, onTop }: { id: PropId; slide: { out: number; in: number }; children: React.ReactNode; onTop: (y: number) => void }) {
  const g = useRef<THREE.Group>(null)
  const b = useRef<THREE.Group>(null)
  const told = useRef(false)
  useFrame(() => {
    if (b.current && !told.current) {
      const box = new THREE.Box3().setFromObject(b.current)
      if (!box.isEmpty()) {
        told.current = true
        onTop(box.max.y)
      }
    }
    if (!g.current) return
    const now = performance.now()
    const out = Math.min(1, Math.max(0, (now - slide.out) / 400))
    const into = Math.min(1, Math.max(0, (now - slide.in) / 400))
    g.current.position.x = slide.in > slide.out ? -7 * (1 - into) * (1 - into) : 7 * out * out
  })
  return (
    <group ref={g}>
      <group ref={b} scale={BASE_SCALE}>
        <Prop id={id} />
      </group>
      {children}
    </group>
  )
}

export function Assembler({ jeu, onEnd }: EngineProps<'assembler'>) {
  const orders = jeu.orders ?? 3
  const steps = jeu.steps ?? 3
  const [o, setO] = useState(0)
  const [want, setWant] = useState<Item[]>([])
  const [at, setAt] = useState(0)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [shakes, setShakes] = useState<Record<number, number>>({})
  const [slide, setSlide] = useState({ out: 0, in: 1 })
  const [said, setSaid] = useState<string | null>(null)
  const st = useRef({ key: 0, wrong: 0, busy: true, baseTop: 0.3, top: 0.3, over: false })
  // The parts round the base: the sides, the front, then the back corners (the back's middle is the order's row).
  const laid = useMemo<Laid[]>(() => jeu.parts.slice(0, SLOTS.length).map((item, i) => ({ item, x: SLOTS[i][0], z: SLOTS[i][1], r: ((i * 1.7) % 1.2) - 0.6 })), [jeu.parts])
  const order = () => {
    const ps = laid.map((l) => l.item)
    const seq = ps.length >= steps ? shuffle(ps).slice(0, steps) : [...Array(steps)].map(() => ps[Math.floor(Math.random() * ps.length)])
    setWant(seq)
    setAt(0)
    setPieces([])
    st.current.top = st.current.baseTop
    st.current.busy = false
  }
  useEffect(order, []) // eslint-disable-line react-hooks/exhaustive-deps
  const say = (s: string, ms = 1000) => {
    setSaid(s)
    setTimeout(() => setSaid((x) => (x === s ? null : x)), ms)
  }
  const pick = (i: number) => {
    const s = st.current
    if (s.busy || s.over) return
    const l = laid[i]
    if (l.item.name !== want[at].name) {
      s.wrong++
      haptic('error')
      setShakes((m) => ({ ...m, [i]: (m[i] ?? 0) + 1 }))
      say(`Pas encore ! ${at ? 'Maintenant' : 'D’abord'} ${lc(want[at].name)}.`, 1300)
      return
    }
    haptic('medium')
    gesture('busy', 700)
    const h = (tall.get(l.item.prop) ?? 0.6) * STACK_SCALE
    // Each part sits on the one before, a little sunk in it (the fish on the attiéké).
    setPieces((p) => [...p, { key: s.key++, prop: l.item.prop, from: [l.x, l.z], y: s.top - (p.length ? h * 0.45 : 0.02), r: (Math.random() - 0.5) * 1.2, dx: (Math.random() - 0.5) * 0.2, dz: (Math.random() - 0.5) * 0.2 }])
    s.top += h * (pieces.length ? 0.55 : 0.98)
    if (at + 1 < want.length) {
      setAt(at + 1)
      return
    }
    // The order's done: off it goes, the next one in.
    setAt(at + 1)
    s.busy = true
    setTimeout(() => {
      haptic('success')
      gesture('cheer', 1200)
      say(o + 1 >= orders ? 'Tout est prêt !' : 'Commande prête !', 1200)
    }, 520)
    if (o + 1 >= orders) {
      s.over = true
      setTimeout(() => onEnd(scoreOf(orders * steps, orders * steps, s.wrong)), 1500)
      return
    }
    setTimeout(() => setSlide({ out: performance.now(), in: 0 }), 1000)
    setTimeout(() => {
      setSlide({ out: 0, in: performance.now() })
      setO(o + 1)
      order()
    }, 1450)
  }
  const sentence = want.map((w, i) => (
    <span key={i} className={i < at ? 'text-[#2f9e44] line-through decoration-2' : i === at ? 'text-[var(--color-ink)] underline decoration-[var(--color-orange)] decoration-2 underline-offset-2' : 'text-[var(--color-ink-soft)]'}>
      {lc(w.name)}
    </span>
  ))
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={
        <span className="block">
          <span className="text-[11px] tracking-wider uppercase">
            Commande {o + 1}/{orders}
          </span>
          <span className="mt-0.5 block font-display text-[16px] leading-snug text-[var(--color-ink-soft)] [text-wrap:balance]">
            {sentence.map((s, i) => (
              <span key={i}>
                {i === 0 ? 'D’abord ' : ', puis '}
                {s}
              </span>
            ))}
          </span>
        </span>
      }
      said={said}
    >
      <Stage decor={jeu.decor} cam={[0, 6.6, 4.4]} look={[0, 0, 0.1]} fov={40}>
        <Base id={jeu.base} slide={slide} onTop={(y) => (st.current.baseTop = st.current.top = y)}>
          {pieces.map((p) => (
            <Flying key={p.key} p={p} />
          ))}
        </Base>
        {laid.map((l, i) => (
          <Part key={i} l={l} shake={shakes[i] ?? 0} onPick={() => pick(i)} />
        ))}
        {/* The order, at the back: a little block for each part asked, its part on it (yellow the next one, green the ones done) */}
        {want.map((w, i) => (
          <group key={`${o}-${i}`} position={[(i - (want.length - 1) / 2) * 0.85, 0, -2.5]}>
            <Box p={[0, 0.06, 0]} s={[0.7, 0.12, 0.7]} c={i < at ? '#2f9e44' : i === at ? '#ffd43b' : '#f1f3f5'} />
            <group position={[0, 0.12, 0]} scale={0.42}>
              <Prop id={w.prop} />
            </group>
          </group>
        ))}
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:assembler). */
export const demo: Extract<Jeu, { engine: 'assembler' }> = {
  engine: 'assembler', title: 'Le plat de Tantie Awa', how: 'Les clients commandent : pose les ingrédients sur l’assiette dans l’ordre.', decor: 'table', base: 'assiette',
  parts: [
    { name: 'L’attiéké', prop: 'attieke' }, { name: 'Le poisson', prop: 'poisson' }, { name: 'Le piment', prop: 'piment' }, { name: 'La tomate', prop: 'tomate' }, { name: 'L’oignon', prop: 'oignon' }, { name: 'L’alloco', prop: 'alloco' },
  ],
}
