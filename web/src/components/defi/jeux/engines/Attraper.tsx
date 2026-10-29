import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Prop } from '../props'
import { JeuShell, Stage, scoreOf } from '../Shell'
import type { Decor, EngineProps, Item, PropId } from '../types'

// Catch what falls (the alloco's paper, made for every action): the `from` thing goes along the top and
// lets the good ones drop, one by one, quicker as it goes; slide the `into` thing under them. The bad
// ones are to let fall: caught, they count against.

type Drop = { key: number; item: Item; bad: boolean; x: number; y: number; v: number; spin: number; state: 'fall' | 'in' | 'ground'; t: number }

// The camera nearly straight on, a little above: the ground a strip at the bottom, the game's air above it.
const CAM: [number, number, number] = [0, 4, 8.8]
const FOV = 45
const TOP = 5.2
const REACH = 1.05
/** The wall behind, by decor: the game reads on it. */
const WALL: Partial<Record<Decor, string>> = { ciel: '#8fd3ff', eau: '#8fd3ff', sable: '#9fdcff', herbe: '#a8e0ff', piste: '#a8e0ff', terre: '#a8e0ff', scene: '#3a2b4a', bitume: '#cfd6dd' }
const halfOf = (w: number) => w / 2 - 0.7

/** The game in the 3D square: the dropper, the drops, the container; all moved here, each frame. */
function Field({ from, into, seq, at, onCatch, onLand, onDone }: { from: PropId; into: PropId; seq: { item: Item; bad: boolean }[]; at: { current: number }; onCatch: (d: Drop) => void; onLand: (d: Drop) => void; onDone: () => void }) {
  const { viewport, camera } = useThree()
  const halfW = halfOf(viewport.getCurrentViewport(camera, [0, 0, 0]).width)
  const [drops, setDrops] = useState<Drop[]>([])
  const st = useRef({ sent: 0, key: 0, wait: 1.1, aim: 0, fx: 0, cx: 0, bump: 0, shake: 0, done: false, mouth: 0 })
  const fromG = useRef<THREE.Group>(null)
  const intoG = useRef<THREE.Group>(null)
  const nodes = useRef(new Map<number, THREE.Group>())
  const live = useRef<Drop[]>([])
  const gone = (d: Drop) => (d.state === 'in' && d.t > 0.35) || (d.state === 'ground' && d.t > 0.9)
  useFrame(({ clock }, dt0) => {
    const dt = Math.min(0.05, dt0)
    const s = st.current
    const go = s.sent / Math.max(1, seq.length)
    // The container's mouth: near its top, measured once.
    if (!s.mouth && intoG.current) {
      intoG.current.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(intoG.current)
      s.mouth = Math.max(0.5, Math.min(2, b.max.y * 0.85))
    }
    const MOUTH = s.mouth || 0.9
    // The dropper heads for where it'll drop the next, then lets it go.
    s.fx += (s.aim - s.fx) * Math.min(1, dt * (3 + go * 4))
    s.wait -= dt
    if (s.wait <= 0 && s.sent < seq.length && Math.abs(s.aim - s.fx) < 0.3) {
      const { item, bad } = seq[s.sent++]
      live.current = [...live.current, { key: s.key++, item, bad, x: s.fx, y: TOP - 0.3, v: 1 + go * 2.4, spin: (Math.random() - 0.5) * 6, state: 'fall', t: 0 }]
      setDrops(live.current)
      s.wait = 1.2 - go * 0.6
      s.aim = (Math.random() * 2 - 1) * halfW
    }
    // The container eases after the finger (or the arrows).
    at.current = Math.max(-halfW, Math.min(halfW, at.current))
    s.cx += (at.current - s.cx) * Math.min(1, dt * 18)
    s.bump = Math.max(0, s.bump - dt * 4)
    s.shake = Math.max(0, s.shake - dt * 2.5)
    let changed = false
    for (const d of live.current) {
      d.t += dt
      if (d.state === 'fall') {
        const y0 = d.y
        d.v += 5 * dt
        d.y -= d.v * dt
        // Through the container's mouth: caught; else down to the ground.
        if (y0 >= MOUTH && d.y < MOUTH && Math.abs(d.x - s.cx) < REACH) {
          d.state = 'in'
          d.t = 0
          d.x -= s.cx
          if (d.bad) s.shake = 1
          else s.bump = 1
          onCatch(d)
        } else if (d.y <= 0.05) {
          d.y = 0.05
          d.state = 'ground'
          d.t = 0
          onLand(d)
        }
      }
      if (gone(d)) changed = true
    }
    if (changed) {
      live.current = live.current.filter((d) => !gone(d))
      setDrops(live.current)
    }
    if (!s.done && s.sent >= seq.length && !live.current.length) {
      s.done = true
      onDone()
    }
    // Everything where it's got to.
    if (fromG.current) {
      fromG.current.position.set(s.fx, TOP, 0)
      fromG.current.rotation.z = Math.sin(clock.elapsedTime * 7) * 0.06 - (s.aim - s.fx) * 0.1
    }
    if (intoG.current) {
      intoG.current.position.set(s.cx + Math.sin(clock.elapsedTime * 50) * s.shake * 0.15, 0, 0)
      intoG.current.scale.set(1.9 + s.bump * 0.35, 1.9 - s.bump * 0.3, 1.9 + s.bump * 0.35)
    }
    for (const d of live.current) {
      const o = nodes.current.get(d.key)
      if (!o) continue
      if (d.state === 'fall') {
        o.position.set(d.x, d.y, 0)
        o.children[0]?.rotation.set(0, d.t * 2, d.t * d.spin)
      } else if (d.state === 'in') {
        // Into the container, shrinking.
        o.position.set(s.cx + d.x * (1 - d.t * 2.8), MOUTH - d.t * 1.5, 0)
        o.scale.setScalar(Math.max(0.01, 1.05 * (1 - d.t * 2.8)))
      } else {
        // On the ground: a bounce, then it goes.
        o.position.set(d.x, 0.35 + Math.abs(Math.sin(d.t * 9)) * 0.5 * Math.max(0, 1 - d.t * 2.5), 0.3)
        o.children[0]?.rotation.set(0, 0, d.spin > 0 ? 1.4 : -1.4)
        o.scale.setScalar(Math.max(0.01, 1.05 * Math.min(1, (0.9 - d.t) * 3)))
      }
    }
  })
  return (
    <group>
      <group ref={fromG} position={[0, TOP, 0]}>
        <group scale={1.6} position={[0, -0.3, 0]} rotation={[0.45, 0, 0]}>
          <Prop id={from} />
        </group>
      </group>
      {drops.map((d) => (
        <group key={d.key} ref={(o) => void (o ? nodes.current.set(d.key, o) : nodes.current.delete(d.key))} position={[d.x, d.y, 0]} scale={1.05}>
          <group>
            <group position={[0, -0.4, 0]}>
              <Prop id={d.item.prop} />
            </group>
          </group>
          {/* The bad ones: a red cross behind, to tell them apart as they fall */}
          {d.bad && (
            <group position={[0, 0, -0.45]}>
              <mesh rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[1.2, 0.16, 0.05]} />
                <meshBasicMaterial color="#ff3d57" />
              </mesh>
              <mesh rotation={[0, 0, -Math.PI / 4]}>
                <boxGeometry args={[1.2, 0.16, 0.05]} />
                <meshBasicMaterial color="#ff3d57" />
              </mesh>
            </group>
          )}
        </group>
      ))}
      <group ref={intoG} scale={1.9}>
        <Prop id={into} />
      </group>
    </group>
  )
}

export function Attraper({ jeu, onEnd }: EngineProps<'attraper'>) {
  const count = jeu.count ?? 14
  // What falls, in order: the good ones, and now and then a bad one (never the first two).
  const seq = useMemo(() => {
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
    const out = [...Array(count)].map(() => ({ item: pick(jeu.good), bad: false }))
    const bads = jeu.bad?.length ? Math.round(count * 0.35) : 0
    for (let i = 0; i < bads; i++) out.splice(2 + Math.floor(Math.random() * (out.length - 1)), 0, { item: pick(jeu.bad!), bad: true })
    return out
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const box = useRef<HTMLDivElement>(null)
  const at = useRef(0)
  const [n, setN] = useState({ caught: 0, lost: 0, bad: 0 })
  const [said, setSaid] = useState<string | null>(null)
  const st = useRef({ caught: 0, lost: 0, bad: 0, streak: 0, w: 7.4 })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1000)
  }
  // Drag across the square (the container under the finger), or the arrows held.
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect()
    at.current = ((clientX - r.left) / r.width - 0.5) * st.current.w
  }
  useEffect(() => {
    let dir = 0
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      at.current += dir * 7 * Math.min(0.05, (t - last) / 1000)
      last = t
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') dir = -1
      else if (e.key === 'ArrowRight') dir = 1
    }
    const up = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' && dir < 0) || (e.key === 'ArrowRight' && dir > 0)) dir = 0
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  const caught = (d: Drop) => {
    const s = st.current
    if (d.bad) {
      s.bad++
      s.streak = 0
      haptic('error')
      say(`Pas ${d.item.name.toLowerCase()} !`)
    } else {
      s.caught++
      s.streak++
      haptic('light')
      gesture('busy', 600)
      if (s.streak % 4 === 0) say(s.streak >= 8 ? 'Tu es chaud !' : 'Bien attrapé !')
    }
    setN({ caught: s.caught, lost: s.lost, bad: s.bad })
  }
  const landed = (d: Drop) => {
    const s = st.current
    if (d.bad) return say('Bien laissé tomber')
    s.lost++
    s.streak = 0
    haptic('medium')
    say('Raté, c’est par terre…')
    setN({ caught: s.caught, lost: s.lost, bad: s.bad })
  }
  const done = () => {
    const s = st.current
    gesture('cheer', 1500)
    say(s.caught === count && !s.bad ? 'Tout attrapé, bravo !' : `${s.caught} sur ${count}, pas mal`)
    setTimeout(() => onEnd(scoreOf(s.caught, count, s.bad)), 1000)
  }
  return (
    <JeuShell title={jeu.title} how={jeu.how} status={`${n.caught}/${count} attrapés${n.lost ? ` · ${n.lost} par terre` : ''}${n.bad ? ` · ${n.bad} de trop` : ''}`} said={said}>
      <div ref={box} className="absolute inset-0 touch-none overflow-hidden rounded-3xl" style={{ background: WALL[jeu.decor] ?? '#f3e3c3' }} onPointerDown={(e) => move(e.clientX)} onPointerMove={(e) => (e.buttons || e.pointerType === 'touch') && move(e.clientX)}>
        <Stage decor={jeu.decor} cam={CAM} look={[0, 2.5, 0]} fov={FOV}>
          <Width st={st} />
          <Field from={jeu.from} into={jeu.into} seq={seq} at={at} onCatch={caught} onLand={landed} onDone={done} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** Tells the engine how wide the field is at the drops (the drag across the square, into the scene). */
function Width({ st }: { st: { current: { w: number } } }) {
  const { viewport, camera } = useThree()
  st.current.w = viewport.getCurrentViewport(camera, [0, 0, 0]).width
  return null
}

/** A game to try it on the lab page (?g=demo:attraper). */
export const demo: Extract<import('../types').Jeu, { engine: 'attraper' }> = {
  engine: 'attraper', title: 'Attrape ton alloco !', how: 'Glisse l’assiette sous la poêle. Les gouttes de feu, laisse-les tomber !', decor: 'sable',
  from: 'poele', good: [{ name: 'L’alloco', prop: 'alloco' }, { name: 'Le poisson', prop: 'poisson' }], bad: [{ name: 'Le feu', prop: 'flamme' }], into: 'assiette',
}
