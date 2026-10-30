import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Prop } from '../props'
import { JeuShell, Stage } from '../Shell'
import type { EngineProps, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Clean it off (the alloco's egg, made for every action): the thing in the middle, big, covered with
// bits (dirt, foam, shell…) where it's seen; tap each one off. No clock: quicker is better, and a tap
// on what's already clean counts against.

type Bit = { key: number; p: THREE.Vector3; q: THREE.Quaternion; n: THREE.Vector3; spin: number }

const CAM: [number, number, number] = [0, 3.1, 5.4]
const LOOK: [number, number, number] = [0, 1.2, 0]
const SIZE = 2.5

/** One bit stuck on the thing: a tap pops it off, flying away along the surface's normal. */
function Stuck({ b, bit, off, onTap }: { b: Bit; bit: PropId; off: boolean; onTap: () => void }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    if (!off) {
      // A little life while it waits.
      t.current += dt
      o.scale.setScalar(0.62 + Math.sin(t.current * 3 + b.key) * 0.03)
      return
    }
    if (!o.visible) return
    t.current = Math.max(t.current, 100) + dt
    const k = t.current - 100
    o.position.set(b.p.x + b.n.x * k * 3, b.p.y + b.n.y * k * 3 + k * 2.5 - k * k * 6, b.p.z + b.n.z * k * 3)
    o.rotateZ(b.spin * dt)
    o.scale.setScalar(Math.max(0.01, 0.62 * (1 + k * 2) * (1 - k / 0.45)))
    if (k > 0.45) o.visible = false
  })
  return (
    <group ref={g} position={b.p} quaternion={b.q} scale={0.62} onPointerDown={off ? undefined : (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onTap())}>
      <Prop id={bit} />
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
function Thing({ object, bit, count, off, wobble, onBit, onClean, onLaid }: { object: PropId; bit: PropId; count: number; off: Set<number>; wobble: { current: number }; onBit: (k: number) => void; onClean: () => void; onLaid: (n: number) => void }) {
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
      out.push({ key: out.length, p, n, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), spin: (Math.random() - 0.5) * 20 })
    }
    // Nothing found to stick to (an empty thing): on the front of its box.
    for (let i = 0; out.length < Math.min(count, 3); i++) {
      const n = new THREE.Vector3(0, 0, 1)
      out.push({ key: out.length, p: new THREE.Vector3(THREE.MathUtils.lerp(box.min.x, box.max.x, 0.25 + (i % 3) * 0.25), THREE.MathUtils.lerp(box.min.y, box.max.y, 0.5), box.max.z + 0.02), n, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), spin: 8 })
    }
    setBits(out)
    onLaid(out.length)
  })
  if (bits.length && off.size >= bits.length) shown.current = true
  return (
    <group>
      <group ref={obj} scale={SIZE} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onClean())}>
        <Prop id={object} />
      </group>
      {bits.map((b) => (
        <Stuck key={b.key} b={b} bit={bit} off={off.has(b.key)} onTap={() => onBit(b.key)} />
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
  const st = useRef({ t0: 0, wrong: 0, done: false, total: count })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1000)
  }
  const tapBit = (k: number) => {
    const s = st.current
    if (s.done || off.has(k)) return
    if (!s.t0) s.t0 = performance.now()
    const now = new Set(off).add(k)
    setOff(now)
    haptic('light')
    gesture('busy', 700)
    wobble.current = 0.6
    const left = s.total - now.size
    if (left <= 0) {
      s.done = true
      haptic('success')
      gesture('cheer', 1500)
      say(tr('Tout propre, ça brille !'))
      // The clock only says how quick: about a second a bit is good.
      const secs = (performance.now() - s.t0) / 1000
      setTimeout(() => onEnd(Math.max(10, Math.min(100, Math.round(100 - Math.max(0, secs - s.total * 0.8 - 1) * 3 - s.wrong * 6)))), 1200)
    } else if (left === 3) say(tr('Encore un peu…'))
    else if (now.size % 4 === 0) say(tr('Ça part bien !'))
  }
  const tapClean = () => {
    if (st.current.done) return
    st.current.wrong++
    haptic('error')
    wobble.current = 1
    say(tr('Là, c’est déjà propre !'))
  }
  const left = total - off.size
  return (
    <JeuShell title={jeu.title} how={jeu.how} status={left > 0 ? `${jeu.verb} : encore ${left}` : 'Fini !'} said={said}>
      <Stage decor={jeu.decor} cam={CAM} look={LOOK} fov={40}>
        <Thing object={jeu.object} bit={jeu.bit} count={count} off={off} wobble={wobble} onBit={tapBit} onClean={tapClean} onLaid={(n) => ((st.current.total = n), setTotal(n))} />
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:nettoyer). */
export const demo: Extract<import('../types').Jeu, { engine: 'nettoyer' }> = {
  engine: 'nettoyer', title: tr('Lave la marmite'), how: tr('Touche chaque tache pour la frotter, vite. Pas à côté !'), decor: 'carrelage', object: 'marmite', bit: 'tache', verb: tr('Frotte'),
}
