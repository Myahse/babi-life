import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { gesture } from '../../../../world3d/gesture'
import { Prop } from '../props'
import { JeuShell, Stage } from '../Shell'
import { Hand, useHand, type HandCtl } from '../hand'
import { juice, snd } from '../juice'
import type { EngineProps, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Clean it off (the alloco's egg, made for every action): the thing in the middle, big, covered with
// bits (dirt, foam, shell…) where it's seen. Rub them off: drag the finger over them (the hand follows
// with its sponge, its razor, its scissors, scrubbing), or tap them one by one. The stubborn ones
// (darker, bigger) need going over again. Off, a bit flies, falls and bounces on the floor. No clock:
// quicker is better, and a tap on what's already clean counts against.

type Bit = { key: number; p: THREE.Vector3; q: THREE.Quaternion; n: THREE.Vector3; spin: number; hp: number; max: number }

const CAM: [number, number, number] = [0, 3.1, 5.4]
const LOOK: [number, number, number] = [0, 1.2, 0]
const SIZE = 2.5
/** A bit rubbed again only so often (a finger going back and forth over it). */
const RUB_GAP = 110

/** What the hand holds to clean, by what's done (the razor to shave, the scissors to trim…). */
function toolOf(verb: string, bit: PropId): PropId | undefined {
  const v = verb.toLowerCase()
  if (v.includes('ras')) return 'rasoir'
  if (v.includes('taill') || v.includes('coup')) return 'ciseaux'
  if (bit === 'poussiere') return 'balai'
  if (bit === 'feuille' || bit === 'coquille' || bit === 'cheveu') return undefined
  return 'eponge'
}
/** The colour of what flies off, by the bit. */
const CRUMBS: Partial<Record<PropId, string[]>> = { mousse: ['#ffffff', '#e7f5ff'], tache: ['#8a5a32', '#5c3a1e'], poussiere: ['#adb5bd', '#868e96'], cheveu: ['#212529', '#343a40'], feuille: ['#2f9e44', '#69db7c'], coquille: ['#fff4e6', '#e9d8c4'], bulle: ['#a5d8ff', '#ffffff'] }

/** One bit stuck on the thing: rubbed, it shrinks (the stubborn ones take two); off, it flies, falls, bounces on the floor. */
function Stuck({ b, bit, off, onRub }: { b: Bit; bit: PropId; off: boolean; onRub: (e: ThreeEvent<PointerEvent>, tap: boolean) => void }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  const fly = useRef<{ p: THREE.Vector3; v: THREE.Vector3; t: number } | null>(null)
  useFrame((_, dt0) => {
    const dt = juice.dt(Math.min(0.05, dt0))
    const o = g.current
    if (!o) return
    t.current += dt
    if (!off) {
      // A little life while it waits; smaller as it's rubbed.
      const left = 0.4 + 0.6 * (b.hp / b.max)
      o.scale.setScalar((b.max > 1 ? 0.78 : 0.62) * left * (1 + Math.sin(t.current * 3 + b.key) * 0.04))
      return
    }
    if (!o.visible) return
    if (!fly.current) fly.current = { p: b.p.clone(), v: b.n.clone().multiplyScalar(2.6).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 2.2, 0.6)), t: 0 }
    const f = fly.current
    f.t += dt
    f.v.y -= 13 * dt
    f.p.addScaledVector(f.v, dt)
    if (f.p.y < 0.05) {
      f.p.y = 0.05
      f.v.y = Math.abs(f.v.y) > 1 ? -f.v.y * 0.4 : 0
      f.v.x *= 0.6
      f.v.z *= 0.6
    }
    o.position.copy(f.p)
    o.rotateZ(b.spin * dt * (f.v.y ? 1 : 0.1))
    o.scale.setScalar(Math.max(0.01, 0.5 * Math.min(1, (1.3 - f.t) * 2)))
    if (f.t > 1.3) o.visible = false
  })
  return (
    <group ref={g} position={b.p} quaternion={b.q} scale={0.62} onPointerDown={off ? undefined : (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onRub(e, true))} onPointerMove={off ? undefined : (e: ThreeEvent<PointerEvent>) => onRub(e, false)}>
      <Prop id={bit} />
      {/* The stubborn ones: a darker ring round them */}
      {b.max > 1 && !off && (
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[1.0, 0.04, 1.0]} />
          <meshLambertMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      )}
      {/* A wide hold round it: a finger finds it */}
      {!off && (
        <mesh position={[0, 0.3, 0]} visible={false}>
          <boxGeometry args={[1.5, 1.2, 1.5]} />
        </mesh>
      )}
    </group>
  )
}

/** The thing, big, and its bits laid where the camera sees its surface (found by casting rays at it). */
function Thing({ object, bit, count, off, wobble, hand, onRub, onDown, onLaid }: { object: PropId; bit: PropId; count: number; off: Set<number>; wobble: { current: number }; hand: HandCtl; onRub: (b: Bit, tap: boolean) => void; onDown: () => void; onLaid: (n: number, rubs: number) => void }) {
  const obj = useRef<THREE.Group>(null)
  const [bits, setBits] = useState<Bit[]>([])
  const laid = useRef(false)
  const shown = useRef(false)
  const t = useRef(0)
  useFrame(({ camera, scene }, dt) => {
    t.current += dt
    if (obj.current) {
      // Squashed a little by each bit off, shaken by a wrong tap; a turn when it's all clean.
      const w = wobble.current
      wobble.current = Math.max(0, w - dt * 3)
      obj.current.scale.set(SIZE * (1 + Math.sin(t.current * 30) * w * 0.04), SIZE * (1 - Math.sin(t.current * 30) * w * 0.04), SIZE)
      if (shown.current) obj.current.rotation.y += dt * 4
    }
    if (laid.current || !obj.current) return
    // Wait a frame for the thing to be in place, then lay the bits on what's seen of it.
    if (t.current < 0.05) return
    laid.current = true
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(obj.current)
    const ray = new THREE.Raycaster()
    const out: Bit[] = []
    let gap = 0.7
    for (let i = 0; i < 600 && out.length < count; i++) {
      if (i % 150 === 149) gap *= 0.7
      const to = new THREE.Vector3(THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random()), THREE.MathUtils.lerp(box.min.y + 0.05, box.max.y, Math.random()), THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random()))
      ray.set(camera.position, to.sub(camera.position).normalize())
      const hit = ray.intersectObject(obj.current, true)[0]
      if (!hit?.face) continue
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      if (n.dot(ray.ray.direction) > -0.25) continue
      if (out.some((b) => b.p.distanceTo(hit.point) < gap)) continue
      const p = hit.point.clone().addScaledVector(n, 0.02)
      // About a third are stubborn: two goes to get them off.
      const max = out.length % 3 === 1 ? 2 : 1
      out.push({ key: out.length, p, n, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), spin: (Math.random() - 0.5) * 20, hp: max, max })
    }
    // Nothing found to stick to (an empty thing): on the front of its box.
    for (let i = 0; out.length < Math.min(count, 3); i++) {
      const n = new THREE.Vector3(0, 0, 1)
      out.push({ key: out.length, p: new THREE.Vector3(THREE.MathUtils.lerp(box.min.x, box.max.x, 0.25 + (i % 3) * 0.25), THREE.MathUtils.lerp(box.min.y, box.max.y, 0.5), box.max.z + 0.02), n, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), spin: 8, hp: 1, max: 1 })
    }
    setBits(out)
    onLaid(out.length, out.reduce((k, b) => k + b.max, 0))
  })
  if (bits.length && off.size >= bits.length) shown.current = true
  // The hand after the finger, over the surface, a little out of it.
  const follow = (e: ThreeEvent<PointerEvent>) => {
    const n = e.face?.normal ? e.face.normal.clone().transformDirection(e.object.matrixWorld) : new THREE.Vector3(0, 0, 1)
    hand.follow = (hand.follow ?? new THREE.Vector3()).copy(e.point).addScaledVector(n, 0.35)
  }
  return (
    <group>
      <group
        ref={obj}
        scale={SIZE}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          follow(e)
          hand.moves.length = 0
          onDown()
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => follow(e)}
      >
        <Prop id={object} />
      </group>
      {bits.map((b) => (
        <Stuck
          key={b.key}
          b={b}
          bit={bit}
          off={off.has(b.key)}
          onRub={(e, tap) => {
            if (!tap && !e.buttons && e.pointerType !== 'touch') return
            follow(e)
            if (tap) hand.moves.length = 0
            onRub(b, tap)
          }}
        />
      ))}
    </group>
  )
}

export function Nettoyer({ jeu, onEnd }: EngineProps<'nettoyer'>) {
  const count = jeu.count ?? 12
  const [off, setOff] = useState<Set<number>>(() => new Set())
  const [total, setTotal] = useState(count)
  const [said, setSaid] = useState<string | null>(null)
  const wobble = useRef(0)
  const hand = useHand([1.7, 1.6, 2.3])
  const tool = toolOf(jeu.verb, jeu.bit)
  const st = useRef({ t0: 0, wrong: 0, done: false, total: count, rubs: count, press: { on: false, rubbed: 0, clean: false }, last: new Map<number, number>(), off: new Set<number>() })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1000)
  }
  const rub = (b: Bit, tap: boolean) => {
    const s = st.current
    if (s.done || s.off.has(b.key)) return
    // Dragged over: only while the finger's down, and a bit only so often.
    if (!tap && !s.press.on) return
    const now = performance.now()
    if (now - (s.last.get(b.key) ?? 0) < RUB_GAP) return
    s.last.set(b.key, now)
    if (!s.t0) s.t0 = now
    s.press.rubbed++
    hand.rub = 1
    snd.scrub()
    b.hp--
    wobble.current = 0.35
    if (b.hp > 0) {
      juice.burst(b.p.toArray() as [number, number, number], CRUMBS[jeu.bit] ?? ['#ffffff'], 3, 1.6)
      return
    }
    s.off = new Set(s.off).add(b.key)
    setOff(s.off)
    gesture('busy', 700)
    wobble.current = 0.6
    const left = s.total - s.off.size
    juice.good({ at: b.p.toArray() as [number, number, number], colors: CRUMBS[jeu.bit], n: 7, quiet: left > 0 && s.off.size % 4 !== 0, text: left === 3 ? tr('Encore 3 !') : tr('Ça part !') })
    if (left <= 0) {
      s.done = true
      hand.follow = null
      hand.back(0.4)
      gesture('cheer', 1500)
      // The clock only says how quick: about a second a bit (a stubborn one, two goes) is good.
      const secs = (performance.now() - s.t0) / 1000
      const score = Math.max(10, Math.min(100, Math.round(100 - Math.max(0, secs - s.rubs * 0.6 - 1) * 3 - s.wrong * 6)))
      juice.finish(score, s.wrong ? tr('Tout propre !') : tr('Tout propre, ça brille !'), onEnd, 1700)
    } else if (left === 3) say(tr('Encore un peu…'))
  }
  // A press on what's clean: wrong only if the finger comes up without having rubbed anything off.
  const down = () => {
    const p = st.current.press
    p.on = true
    p.rubbed = 0
    p.clean = true
  }
  useEffect(() => {
    const up = () => {
      const s = st.current
      const p = s.press
      if (p.on && p.clean && !p.rubbed && !s.done) {
        s.wrong++
        wobble.current = 1
        juice.bad({ text: tr('Là, c’est déjà propre !'), soft: true })
        say(tr('Là, c’est déjà propre !'))
      }
      p.on = false
      p.clean = false
      if (!s.done) hand.follow && hand.back(0.35, () => (hand.follow = null))
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const left = total - off.size
  return (
    <JeuShell title={jeu.title} how={jeu.how} goal={tr('Frotte du doigt pour tout enlever !')} status={left > 0 ? `${jeu.verb} : encore ${left}` : 'Fini !'} said={said}>
      <div className="absolute inset-0 touch-none" onPointerDown={() => (st.current.press.on = true)}>
        <Stage decor={jeu.decor} cam={CAM} look={LOOK} fov={40}>
          <Thing object={jeu.object} bit={jeu.bit} count={count} off={off} wobble={wobble} hand={hand} onRub={rub} onDown={down} onLaid={(n, rubs) => (Object.assign(st.current, { total: n, rubs }), setTotal(n))} />
          <Hand ctl={hand} tool={tool} scale={0.75} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:nettoyer). */
export const demo: Extract<import('../types').Jeu, { engine: 'nettoyer' }> = {
  engine: 'nettoyer', title: tr('Lave la marmite'), how: tr('Touche chaque tache pour la frotter, vite. Pas à côté !'), decor: 'carrelage', object: 'marmite', bit: 'tache', verb: tr('Frotte'),
}
