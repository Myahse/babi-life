import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Egg } from 'lucide-react'
import { Box } from '../../world3d/props'
import { Table3d } from './Table3d'
import { haptic } from '../../lib/native'
import { gesture } from '../../world3d/gesture'
import { t as tr, tx } from '../../lib/i18n'

// L'alloco, played (the update « gestes-maison »). First the choice: with an egg
// (100 Djai more) or not. Then the tantie's ladle drops the fried plantain from
// the hot oil: move the paper (drag, or the arrows) and catch every piece before
// it falls in the sand. With the egg: peel it, every bit of shell, before it
// gets cold. The score says how much was caught (and peeled) and how fast.

const PIECES = 16
type Drop = { key: number; x: number; y: number; v: number }

export function AllocoDefi({ onEnd }: { /** The score, and whether the egg was taken (100 Djai more, backend sims/defi.go). */ onEnd: (score: number, egg: boolean) => void }) {
  const [phase, setPhase] = useState<'ask' | 'catch' | 'peel'>('ask')
  const [egg, setEgg] = useState(false)
  const caught = useRef(0)
  if (phase === 'ask')
    return (
      <div className="absolute inset-0 flex items-end justify-center p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="card animate-pop w-full max-w-[340px] p-4 text-center">
          <div className="font-display text-[19px] font-extrabold">{tr('Avec un œuf ?')}</div>
          <p className="mt-1 text-[13.5px] font-bold text-[var(--color-ink-soft)]">{tr('La tantie a des œufs durs : 100 Djai de plus, à écailler toi-même.')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2.5" onClick={() => setPhase('catch')}>
              {tr('Non merci')}
            </button>
            <button className="btn !py-2.5" onClick={() => (setEgg(true), setPhase('catch'))}>
              <Egg size={16} /> {tr('Oui (+100)')}
            </button>
          </div>
        </div>
      </div>
    )
  if (phase === 'catch') return <Catch onDone={(n) => ((caught.current = n), egg ? setPhase('peel') : onEnd(n, false))} />
  return <Peel onDone={(p) => onEnd(Math.round(caught.current * 0.7 + p * 0.3), true)} />
}

/** A slice of alloco, in blocks: the ripe plantain cut on the slant, fried golden, caramel at the edges. */
function Slice({ spin = 0 }: { spin?: number }) {
  return (
    <group rotation={[0.9, spin, 0.3]}>
      <mesh>
        <cylinderGeometry args={[0.32, 0.32, 0.12, 8]} />
        <meshLambertMaterial color="#c8661a" flatShading />
      </mesh>
      <mesh position={[0, 0.062, 0]} scale={[1, 1, 0.7]}>
        <cylinderGeometry args={[0.25, 0.25, 0.01, 8]} />
        <meshLambertMaterial color="#ffc64a" flatShading />
      </mesh>
    </group>
  )
}

/** Where a thing of the stall stands (0..1 across, 0 at the top) in the scene, at z = 0. */
function useField() {
  const { viewport, camera } = useThree()
  const v = viewport.getCurrentViewport(camera, [0, 0, 0])
  return { w: v.width, h: v.height, X: (x: number) => (x - 0.5) * v.width, Y: (y: number) => (0.5 - y) * v.height }
}

/** The tantie's stall: the black pan of oil on its stove, slices frying, her ladle; the sand. */
function Stall() {
  const f = useField()
  const top = f.Y(0.1)
  return (
    <group>
      {/* The sand, all the way down */}
      <Box p={[0, f.Y(0.62), -2]} s={[f.w * 1.6, f.h * 0.8, 0.2]} c="#e6cf9c" />
      {[...Array(24)].map((_, i) => (
        <Box key={i} p={[f.X(((i * 37) % 100) / 100), f.Y(0.3 + ((i * 53) % 68) / 100), -1.85]} s={[0.07, 0.07, 0.02]} c="#b89a60" />
      ))}
      {/* The stall's wood, the stove, the pan and its oil */}
      <Box p={[0, f.Y(0.12), -2.1]} s={[f.w * 1.6, f.h * 0.26, 0.2]} c="#3a2412" />
      <Box p={[0, top - 0.5, -0.6]} s={[f.w * 0.7, 0.35, 0.9]} c="#2b2b30" />
      <mesh position={[0, top, -0.6]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[f.w * 0.33, f.w * 0.27, 0.4, 20]} />
        <meshLambertMaterial color="#1d1d20" flatShading />
      </mesh>
      <mesh position={[0, top + 0.22, -0.48]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[f.w * 0.31, f.w * 0.31, 0.02, 20]} />
        <meshLambertMaterial color="#e09a2a" emissive="#b8650f" emissiveIntensity={0.3} />
      </mesh>
      {[-0.22, -0.08, 0.06, 0.2].map((x, i) => (
        <group key={x} position={[x * f.w, top + 0.3, -0.4]} scale={0.8}>
          <Slice spin={i * 1.3} />
        </group>
      ))}
      {/* Her ladle */}
      <group position={[f.w * 0.3, top + 0.7, -0.2]} rotation={[0, 0, -0.5]}>
        <Box p={[0, 0, 0]} s={[1.6, 0.08, 0.08]} c="#9aa1a8" />
        <mesh position={[-0.85, -0.08, 0]}>
          <cylinderGeometry args={[0.25, 0.18, 0.12, 10]} />
          <meshLambertMaterial color="#868e96" flatShading />
        </mesh>
      </group>
    </group>
  )
}

/** The falling slices: each one where it's got to, turning as it falls. */
function Falling({ live }: { live: { current: Drop[] } }) {
  const f = useField()
  const [list, setList] = useState<Drop[]>([])
  const sig = useRef('')
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const now = live.current.map((d) => d.key).join(',')
    if (now !== sig.current) {
      sig.current = now
      setList(live.current)
    }
    g.current?.children.forEach((o, i) => {
      const d = live.current.find((q) => q.key === list[i]?.key)
      if (!d) return
      o.position.set(f.X(d.x), f.Y(d.y), 0)
      o.rotation.z = clock.elapsedTime * 3 + d.key
    })
  })
  return (
    <group ref={g}>
      {list.map((d) => (
        <group key={d.key}>
          <Slice spin={d.key} />
        </group>
      ))}
    </group>
  )
}

/** The paper cone, under the ladle: a sheet of old newspaper rolled up, the printed lines, a grease stain. */
function Paper({ at }: { at: { current: number } }) {
  const f = useField()
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.set(f.X(at.current), f.Y(0.85), 0.3)
  })
  const w = f.w * 0.12
  return (
    <group ref={g}>
      <mesh rotation={[Math.PI + 0.25, 0, 0]}>
        <coneGeometry args={[w, w * 2, 12, 1, true]} />
        <meshLambertMaterial color="#efe9dc" side={THREE.DoubleSide} flatShading />
      </mesh>
      {[0.4, 0.1, -0.2, -0.5].map((y) => (
        <Box key={y} p={[0, y * w, w * 0.62 * (1 - (0.5 - y) * 0.45)]} s={[w * 1.1 * (1 - (0.5 - y) * 0.5), 0.03, 0.01]} c="#9a9488" />
      ))}
      <Box p={[w * 0.2, -0.1 * w, w * 0.5]} s={[w * 0.4, w * 0.3, 0.01]} c="#d8b46a" />
    </group>
  )
}

/** The paper under the ladle: every piece caught. */
function Catch({ onDone }: { onDone: (score: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const paperAt = useRef(0.5)
  const [n, setN] = useState({ caught: 0, lost: 0, sent: 0 })
  const st = useRef({ paper: 0.5, key: 0, caught: 0, lost: 0, sent: 0, done: false })
  // Drag the paper, or the arrows.
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect()
    const x = Math.min(0.92, Math.max(0.08, (clientX - r.left) / r.width))
    st.current.paper = x
    paperAt.current = x
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d = e.key === 'ArrowLeft' ? -0.08 : e.key === 'ArrowRight' ? 0.08 : 0
      if (!d) return
      const x = Math.min(0.92, Math.max(0.08, st.current.paper + d))
      st.current.paper = x
      paperAt.current = x
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  // The ladle drops a piece now and then, quicker as it goes; they fall. (Kept in a ref, drawn from it:
  // nothing counted twice.)
  const finish = useRef(onDone)
  finish.current = onDone
  const live = useRef<Drop[]>([])
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let next = 600
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      const s = st.current
      next -= dt * 1000
      let out = live.current.map((d) => ({ ...d, y: d.y + d.v * dt }))
      if (next <= 0 && s.sent < PIECES) {
        next = 900 - s.sent * 30
        s.sent++
        out.push({ key: s.key++, x: 0.12 + Math.random() * 0.76, y: 0.08, v: 0.32 + s.sent * 0.012 })
      }
      // At the paper's height: in it, or in the sand.
      out = out.filter((d) => {
        if (d.y < 0.82) return true
        if (Math.abs(d.x - s.paper) < 0.12) {
          s.caught++
          haptic('light')
          gesture('busy', 600)
        } else s.lost++
        return false
      })
      live.current = out
      setN({ caught: s.caught, lost: s.lost, sent: s.sent })
      if (!s.done && s.sent >= PIECES && s.caught + s.lost >= PIECES) {
        s.done = true
        setTimeout(() => finish.current(Math.round((s.caught / PIECES) * 100)), 500)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(rgba(42,26,8,0) 0%, rgba(42,26,8,0) 34%, rgba(42,26,8,0.85) 50%)' }}>
      <div className="card px-4 py-2 text-center">
        <div className="font-display text-[17px] font-extrabold">{tr('Attrape ton alloco !')}</div>
        <div className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tx('Glisse le papier sous la louche. {caught}/{PIECES} attrapés', { caught: n.caught, PIECES })}</div>
      </div>
      <div ref={box} className="relative h-[min(46vh,380px)] w-[min(90vw,420px)] short:h-[62vh] short:w-[min(70vw,560px)] touch-none overflow-hidden rounded-3xl bg-[#e6cf9c]" onPointerDown={(e) => move(e.clientX)} onPointerMove={(e) => e.buttons && move(e.clientX)}>
        <Table3d className="!absolute inset-0" cam={[0, 0, 10]} look={[0, 0, 0]} fov={50}>
          <Stall />
          <Falling live={live} />
          <Paper at={paperAt} />
        </Table3d>
      </div>
      <div className="text-[13px] font-extrabold text-white/80">{tr('Tombés dans le sable :')} {n.lost}</div>
    </div>
  )
}

/** The egg: every bit of shell off. */
function Peel({ onDone }: { onDone: (score: number) => void }) {
  const [bits, setBits] = useState(() => [...Array(14)].map((_, i) => ({ i, a: (i / 14) * Math.PI * 2 + Math.random() * 0.3, r: 0.25 + Math.random() * 0.17 })))
  const t0 = useRef(performance.now())
  const peel = (i: number) => {
    haptic('light')
    gesture('busy', 600)
    const left = bits.filter((b) => b.i !== i)
    setBits(left)
    if (!left.length) {
      const secs = (performance.now() - t0.current) / 1000
      setTimeout(() => onDone(Math.max(30, Math.round(100 - Math.max(0, secs - 6) * 6))), 400)
    }
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]" style={{ background: 'linear-gradient(rgba(42,26,8,0) 0%, rgba(42,26,8,0) 34%, rgba(42,26,8,0.85) 50%)' }}>
      <div className="card px-4 py-2 text-center">
        <div className="font-display text-[17px] font-extrabold">{tr('Écaille l’œuf')}</div>
        <div className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tr('Touche chaque morceau de coquille. Reste')} {bits.length}</div>
      </div>
      <div className="relative aspect-[4/5] w-[min(70vw,44vh,300px)] short:w-[min(40vw,52vh)]">
        <Table3d className="!absolute inset-0" cam={[0, 0.6, 5]} look={[0, 0, 0]} fov={40}>
          <EggShell bits={bits} onPeel={peel} />
        </Table3d>
      </div>
    </div>
  )
}

/** The hard-boiled egg in 3D, the bits of shell still on it: a tap takes one off. */
function EggShell({ bits, onPeel }: { bits: { i: number; a: number; r: number }[]; onPeel: (i: number) => void }) {
  const R = 1
  const at = useMemo(
    () =>
      new Map(
        bits.map((b) => {
          const x = Math.cos(b.a) * b.r * 2.2
          const y = -Math.sin(b.a) * b.r * 2.6
          const n = new THREE.Vector3(x / 0.82, y / 1.05, Math.sqrt(Math.max(0.05, 1 - (x / 0.82) ** 2 - (y / 1.05) ** 2))).normalize()
          return [b.i, { p: new THREE.Vector3(n.x * 0.82 * R, n.y * 1.05 * R, n.z * 0.82 * R), q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n) }]
        }),
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return (
    <group rotation={[0.1, -0.2, 0]}>
      <mesh scale={[0.8, 1.03, 0.8]}>
        <sphereGeometry args={[R, 20, 16]} />
        <meshLambertMaterial color="#fbfaf6" />
      </mesh>
      {bits.map((b) => {
        const o = at.get(b.i)!
        return (
          <mesh key={b.i} position={o.p} quaternion={o.q} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onPeel(b.i))}>
            <boxGeometry args={[0.42, 0.36, 0.06]} />
            <meshLambertMaterial color={b.i % 2 ? '#efe3cf' : '#e6d6b8'} flatShading />
          </mesh>
        )
      })}
      {/* The plate under it */}
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[1.5, 1.3, 0.1, 24]} />
        <meshLambertMaterial color="#e9edf1" />
      </mesh>
    </group>
  )
}
