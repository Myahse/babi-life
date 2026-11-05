import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Flash, Hud, beep, fx, knock } from './kit'
import { Stage3D, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { t } from '../../../lib/i18n'

// « Partir ou rester », chapter 4 (game/epreuves.go): Ange-Michel's first days at the port of San-Pédro,
// up in the crane's cabin with his colleagues watching. The container swings from side to side on the
// crane; tap to let it down on the stack. What sticks out over the one under falls into the water; the
// stack gets narrower if you're off. Ten containers on the ship, as square as you can. The port in the
// game's 3D blocks: the sea, the ship's hull, the crane's yellow arm and its cable, the ribbed containers;
// the cut-off ends tumble into the water with a splash; the camera rises with the stack. The same rule and
// score (the sizes in the scene's units, the same proportions as before).

const GOAL = 10
const COLORS = ['#e03131', '#1c7ed6', '#2f9e44', '#f08c00', '#7048e8', '#0ca678', '#c2255c']
/** The width the containers swing across (the old screen's width), a container's height, the hull's top. */
const W = 5
const PX = W / 390
const BH = 0.55
const HULL = 0.6
const DEPTH = 1.1
type Cont = { x: number; w: number }
type Piece = { x: number; w: number; y: number; v: number; c: string; spin: number }
type S = { stack: Cont[]; swing: number; dir: number; falling: null | { x: number; w: number; y: number; v: number }; cut: Piece[]; perfect: number; over: boolean; cam: number; started: boolean; v: number }

const HANG = () => HULL + 7.2 * BH // where the container hangs, above the stack's top (moved with the camera)

export default function PartirRester({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef<S>({ stack: [{ x: W / 2 - W * 0.22, w: W * 0.44 }], swing: 0, dir: 1, falling: null, cut: [], perfect: 0, over: false, cam: 0, started: false, v: 0 })
  const [hud, setHud] = useState({ n: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  // The scene redrawn when the stack changes (a container added or cut).
  const [, setV] = useState(0)

  const end = () => {
    const st = s.current
    if (st.over) return
    st.over = true
    const n = st.stack.length - 1
    setTimeout(() => onEnd(Math.round(Math.min(100, (n / GOAL) * 80 + st.perfect * 2))), 1100)
  }
  const at = (x: number, y: number) => screenOf(x - W / 2, y, 0)

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    const top = st.stack[st.stack.length - 1]
    const level = st.stack.length
    // The container on the crane swings, quicker as the stack grows: a pendulum, slow at each end.
    const speed = (120 + level * 22) * PX
    if (!st.falling && !st.over) {
      const span = (W - top.w - 12 * PX) / 2
      st.dir += (speed / Math.max(40 * PX, span)) * dt
      st.swing = 6 * PX + span + Math.sin(st.dir) * span
    }
    const land = HULL + (level - 1) * BH
    st.cam += (Math.max(0, (level - 5) * BH) - st.cam) * Math.min(1, dt * 4)
    if (st.falling) {
      const f = st.falling
      f.v += 1600 * PX * dt
      f.y -= f.v * dt
      if (f.y <= land) {
        st.falling = null
        // The weight of it: a low knock on the steel.
        knock(0.5, 0, 260)
        const l = Math.max(f.x, top.x)
        const r = Math.min(f.x + f.w, top.x + top.w)
        const over = r - l
        const p = at(f.x + f.w / 2, land)
        if (over <= 4 * PX) {
          // Missed altogether: into the water.
          st.cut.push({ x: f.x, w: f.w, y: land, v: 0, c: COLORS[level % COLORS.length], spin: 0 })
          beep(120, 0.5, 0.15, { type: 'sawtooth', to: 50 })
          fx.bad(p.x, p.y, t('Plouf !'))
          end()
        } else {
          const nearly = Math.abs(f.x - top.x) < 6 * PX
          const box = nearly ? { x: top.x, w: top.w } : { x: l, w: over }
          if (!nearly) {
            st.cut.push({ x: f.x < top.x ? f.x : r, w: f.w - over, y: land, v: 0, c: COLORS[level % COLORS.length], spin: f.x < top.x ? 1 : -1 })
            fx.shake(4)
            beep(260, 0.15, 0.12, { type: 'square' })
          } else {
            st.perfect++
            fx.good(p.x, p.y, t('Pile !'))
            beep(880, 0.12, 0.12)
          }
          st.stack.push(box)
          setHud({ n: st.stack.length - 1 })
          if (st.stack.length - 1 >= GOAL) {
            setFlash({ text: t('Le navire est chargé !'), at: Date.now() })
            fx.win()
            end()
          }
        }
        setV((n) => n + 1)
      }
    }
    for (const c of st.cut) {
      c.v += 1400 * PX * dt
      c.y -= c.v * dt
    }
    if (st.cut.some((c) => c.y < -3)) ((st.cut = st.cut.filter((c) => c.y >= -3)), setV((n) => n + 1))
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over || st.falling || !st.started) return
    const top = st.stack[st.stack.length - 1]
    st.falling = { x: st.swing, w: top.w, y: HANG() + st.cam, v: 0 }
    beep(400, 0.06, 0.06)
    setV((n) => n + 1)
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 3.4, 9]} look={[0, 2.6, 0]} fov={40} bg="#74c0fc" touch={touch} onReady={() => (s.current.started = true)}>
        <Port s={s} tick={tick} />
      </Stage3D>
      <Hud title={t('La grue du port')} done={`${hud.n}/${GOAL}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white drop-shadow">{t('Touche pour lâcher le conteneur pile sur la pile.')}</p>
    </div>
  )
}

/** A container in blocks: its colour, the ribs along its sides, a lighter door end. */
function Container({ w, c }: { w: number; c: string }) {
  const ribs = Math.max(1, Math.floor(w / 0.18))
  return (
    <group>
      <Box p={[0, BH / 2, 0]} s={[w, BH - 0.02, DEPTH]} c={c} />
      {Array.from({ length: ribs }, (_, i) => (
        <Box key={i} p={[-w / 2 + (i + 0.5) * (w / ribs), BH / 2, DEPTH / 2 + 0.01]} s={[0.04, BH - 0.1, 0.02]} c="#495057" />
      ))}
    </group>
  )
}

/** The port: the sea, the hull, the stack, the crane's arm and cable, the cut pieces falling; the camera rising. */
function Port({ s, tick }: { s: React.RefObject<S>; tick: (dt: number) => void }) {
  const camera = useThree((x) => x.camera) as THREE.PerspectiveCamera
  const size = useThree((x) => x.size)
  const hook = useRef<THREE.Group>(null)
  const cable = useRef<THREE.Mesh>(null)
  const pieces = useRef<THREE.Group>(null)
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    // Far enough that the swing's width fits across, the camera up with the stack.
    const h = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (size.width / Math.max(1, size.height)))
    const d = Math.max(8, (W + 0.6) / 2 / Math.tan(h))
    camera.position.set(0, 3.4 + st.cam, d)
    camera.lookAt(0, 2.6 + st.cam, 0)
    const top = st.stack[st.stack.length - 1]
    const g = hook.current
    if (g) {
      g.visible = !st.over
      const x = st.falling ? st.falling.x : st.swing
      const y = st.falling ? st.falling.y : HANG() + st.cam
      g.position.set(x + (st.falling ? st.falling.w : top.w) / 2 - W / 2, y, 0)
    }
    const c = cable.current
    if (c && g) {
      const topY = HANG() + st.cam + 2.2
      const len = Math.max(0.05, topY - (g.position.y + BH))
      c.scale.y = len
      c.position.set(st.falling ? st.swing + top.w / 2 - W / 2 : g.position.x, g.position.y + BH + len / 2, 0)
    }
    const p = pieces.current
    if (p)
      p.children.forEach((m, i) => {
        const k = st.cut[i]
        if (!k) return
        m.position.y = k.y
        m.rotation.z = k.spin * Math.min(1.2, (HULL + 10 - k.y) * 0.05)
      })
  })
  const st = s.current
  const top = st.stack[st.stack.length - 1]
  return (
    <group>
      {/* The sea, the quay far off, the ship's hull */}
      <Box p={[0, -0.6, 0]} s={[40, 1, 30]} c="#1c7ed6" />
      <Box p={[0, 0.5, -10]} s={[40, 1.2, 2]} c="#adb5bd" />
      <Box p={[0, HULL / 2 - 0.2, 0]} s={[W * 0.62, HULL + 0.4, DEPTH + 0.6]} c="#212529" />
      <Box p={[0, HULL - 0.05, 0]} s={[W * 0.64, 0.1, DEPTH + 0.62]} c="#c92a2a" />
      {/* The stack (the first is the hull's deck) */}
      {st.stack.map((b, i) =>
        i === 0 ? null : (
          <group key={i} position={[b.x + b.w / 2 - W / 2, HULL + (i - 1) * BH, 0]}>
            <Container w={b.w} c={COLORS[i % COLORS.length]} />
          </group>
        ),
      )}
      {/* The crane's arm over it all, the cable, the container hanging */}
      <CraneArm s={s} />
      <mesh ref={cable}>
        <boxGeometry args={[0.03, 1, 0.03]} />
        <meshLambertMaterial color="#343a40" />
      </mesh>
      <group ref={hook}>
        <group position={[0, 0, 0]}>
          <Container w={st.falling ? st.falling.w : top.w} c={COLORS[st.stack.length % COLORS.length]} />
        </group>
      </group>
      <group ref={pieces}>
        {st.cut.map((k, i) => (
          <group key={i} position={[k.x + k.w / 2 - W / 2, k.y, 0]}>
            <Container w={k.w} c={k.c} />
          </group>
        ))}
      </group>
    </group>
  )
}

/** The crane's yellow arm, high over the ship, rising with the camera. */
function CraneArm({ s }: { s: React.RefObject<S> }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.y = HANG() + s.current.cam + 2.2
  })
  return (
    <group ref={g}>
      <Box p={[0, 0.15, 0]} s={[W + 3, 0.3, 0.5]} c="#fab005" />
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i} p={[-W / 2 - 1.3 + i * ((W + 2.6) / 11), 0.15, 0.26]} s={[0.05, 0.3, 0.02]} c="#e67700" />
      ))}
    </group>
  )
}
