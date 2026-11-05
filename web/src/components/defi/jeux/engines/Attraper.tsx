import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { gesture } from '../../../../world3d/gesture'
import { Prop } from '../props'
import { JeuShell, Stage, scoreOf } from '../Shell'
import { juice, snd } from '../juice'
import type { Decor, EngineProps, Item, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Catch what falls (the alloco's paper, made for every action): the `from` thing goes along the top and
// lets the good ones drop, one by one, quicker as it goes; slide the `into` thing under them. The bad
// ones are to let fall: caught, they count against.

type Drop = { key: number; item: Item; bad: boolean; x: number; y: number; v: number; spin: number; state: 'fall' | 'in' | 'ground'; t: number; /** On the ground: rolling, bouncing. */ vx: number; rot: number }

// The camera nearly straight on, a little above: the ground a strip at the bottom, the game's air above it.
const CAM: [number, number, number] = [0, 4, 8.8]
const FOV = 45
const TOP = 5.2
const REACH = 1.05
/** The wall behind, by decor: the game reads on it. */
const WALL: Partial<Record<Decor, string>> = { ciel: '#8fd3ff', eau: '#8fd3ff', sable: '#9fdcff', herbe: '#a8e0ff', piste: '#a8e0ff', terre: '#a8e0ff', scene: '#3a2b4a', bitume: '#cfd6dd' }
const halfOf = (w: number) => w / 2 - 0.7

/** The game in the 3D square: the dropper, the drops, the container; all moved here, each frame. */
function Field({ from, into, seq, at, onCatch, onLand, onDone }: { from: PropId; into: PropId; seq: { item: Item; bad: boolean }[]; at: { current: number }; onCatch: (d: Drop, centred: boolean) => void; onLand: (d: Drop) => void; onDone: () => void }) {
  const { viewport, camera } = useThree()
  const halfW = halfOf(viewport.getCurrentViewport(camera, [0, 0, 0]).width)
  const [drops, setDrops] = useState<Drop[]>([])
  // What's been caught, piled in the container (the last few).
  const [pile, setPile] = useState<{ key: number; prop: PropId }[]>([])
  const st = useRef({ sent: 0, key: 0, wait: 1.1, aim: 0, fx: 0, cx: 0, vx: 0, bump: 0, shake: 0, done: false, mouth: 0 })
  const fromG = useRef<THREE.Group>(null)
  const intoG = useRef<THREE.Group>(null)
  const nodes = useRef(new Map<number, THREE.Group>())
  const live = useRef<Drop[]>([])
  const gone = (d: Drop) => (d.state === 'in' && d.t > 0.35) || (d.state === 'ground' && d.t > 1.3)
  useFrame(({ clock }, dt0) => {
    const dt = juice.dt(Math.min(0.05, dt0))
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
      live.current = [...live.current, { key: s.key++, item, bad, x: s.fx, y: TOP - 0.3, v: 1 + go * 2.4, spin: (Math.random() - 0.5) * 6, state: 'fall', t: 0, vx: 0, rot: 0 }]
      snd.whoosh(0.2)
      setDrops(live.current)
      s.wait = 1.2 - go * 0.6
      s.aim = (Math.random() * 2 - 1) * halfW
    }
    // The container eases after the finger (or the arrows).
    at.current = Math.max(-halfW, Math.min(halfW, at.current))
    const cx0 = s.cx
    s.cx += (at.current - s.cx) * Math.min(1, dt * 18)
    // Its speed, for the lean (a container swung across leans into it, and springs back).
    if (dt) s.vx += ((s.cx - cx0) / dt - s.vx) * Math.min(1, dt * 12)
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
          const centred = Math.abs(d.x - s.cx) < 0.38
          d.state = 'in'
          d.t = 0
          d.x -= s.cx
          if (d.bad) s.shake = 1
          else {
            s.bump = 1
            setPile((p) => [...p.slice(-4), { key: d.key, prop: d.item.prop }])
          }
          onCatch(d, centred)
        } else if (d.y <= 0.35) {
          // On the ground: it bounces up (less each time), rolls away from where it fell, and lies there.
          d.y = 0.35
          d.state = 'ground'
          d.t = 0
          d.vx = (d.x > s.cx ? 1 : -1) * (0.8 + Math.random() * 0.8)
          d.v = -d.v * 0.45
          onLand(d)
        }
      } else if (d.state === 'ground') {
        d.v += 14 * dt
        d.y -= d.v * dt
        if (d.y < 0.35) {
          d.y = 0.35
          d.v = d.v > 1.2 ? -d.v * 0.4 : 0
          d.vx *= 0.7
        }
        d.x += d.vx * dt
        d.vx *= 1 - dt * 1.5
        d.rot += d.vx * dt * -2
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
      intoG.current.rotation.z = Math.max(-0.35, Math.min(0.35, -s.vx * 0.035))
      intoG.current.scale.set(1.9 + s.bump * 0.35, 1.9 - s.bump * 0.3, 1.9 + s.bump * 0.35)
    }
    for (const d of live.current) {
      const o = nodes.current.get(d.key)
      if (!o) continue
      // Its shadow on the ground, sharper as it comes down: where it'll fall.
      const sh = o.children[1] as THREE.Object3D | undefined
      if (sh) {
        sh.visible = d.state === 'fall'
        sh.position.y = -d.y + 0.02
        sh.scale.setScalar(Math.max(0.3, 1.2 - d.y * 0.15))
      }
      if (d.state === 'fall') {
        o.position.set(d.x, d.y, 0)
        o.children[0]?.rotation.set(0, d.t * 2, d.t * d.spin)
      } else if (d.state === 'in') {
        // Into the container, shrinking.
        o.position.set(s.cx + d.x * (1 - d.t * 2.8), MOUTH - d.t * 1.5, 0)
        o.scale.setScalar(Math.max(0.01, 1.05 * (1 - d.t * 2.8)))
      } else {
        // On the ground: where its bounces and its roll have got it, then it goes.
        o.position.set(d.x, d.y, 0.3)
        o.children[0]?.rotation.set(0, 0, d.rot + (d.spin > 0 ? 1.4 : -1.4))
        o.scale.setScalar(Math.max(0.01, 1.05 * Math.min(1, (1.3 - d.t) * 3)))
      }
    }
  })
  const s0 = st.current
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
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.45, 14]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
          </mesh>
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
        {/* What's been caught, heaped in it */}
        {pile.map((p, i) => (
          <group key={p.key} position={[((i % 3) - 1) * 0.16, (s0.mouth || 0.9) / 1.9 - 0.12 + Math.floor(i / 3) * 0.1, ((i % 2) - 0.5) * 0.1]} rotation={[0, i * 1.3, (i % 2 ? 1 : -1) * 0.3]} scale={0.32}>
            <Prop id={p.prop} />
          </group>
        ))}
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
  const caught = (d: Drop, centred: boolean) => {
    const s = st.current
    const at: [number, number, number] = [d.x, 1.4, 0.3]
    if (d.bad) {
      s.bad++
      s.streak = 0
      juice.bad({ at, text: tr('Pas {0} !', { 0: d.item.name.toLowerCase() }) })
      say(tr('Pas {0} !', { 0: d.item.name.toLowerCase() }))
    } else {
      s.caught++
      s.streak++
      gesture('busy', 600)
      juice.good({ at, perfect: centred, text: centred ? tr('Pile au centre !') : tr('Attrapé !') })
    }
    setN({ caught: s.caught, lost: s.lost, bad: s.bad })
  }
  const landed = (d: Drop) => {
    const s = st.current
    snd.thud(0.6)
    if (d.bad) return juice.say(tr('Bien évité'), [d.x, 0.8, 0.3], '#c3fae8')
    s.lost++
    s.streak = 0
    juice.bad({ at: [d.x, 0.5, 0.3], text: tr('Raté !'), soft: true })
    say(tr('Raté, c’est par terre…'))
    setN({ caught: s.caught, lost: s.lost, bad: s.bad })
  }
  const done = () => {
    const s = st.current
    gesture('cheer', 1500)
    juice.finish(scoreOf(s.caught, count, s.bad), s.caught === count && !s.bad ? tr('Tout attrapé, bravo !') : tr('{caught} sur {count}, pas mal', { caught: s.caught, count }), onEnd)
  }
  return (
    <JeuShell title={jeu.title} how={jeu.how} goal={jeu.bad?.length ? tr('Attrape les bons, laisse tomber les autres !') : tr('Attrape tout ce qui tombe !')} status={`${n.caught}/${count} attrapés${n.lost ? ` · ${n.lost} par terre` : ''}${n.bad ? ` · ${n.bad} de trop` : ''}`} said={said}>
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
  engine: 'attraper', title: tr('Attrape ton alloco !'), how: tr('Glisse l’assiette sous la poêle. Les gouttes de feu, laisse-les tomber !'), decor: 'sable',
  from: 'poele', good: [{ name: tr('L’alloco'), prop: 'alloco' }, { name: tr('Le poisson'), prop: 'poisson' }], bad: [{ name: tr('Le feu'), prop: 'flamme' }], into: 'assiette',
}
