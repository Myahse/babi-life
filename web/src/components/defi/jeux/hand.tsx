import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useJeuMe } from './me'
import { Prop } from './props'
import type { PropId } from './types'

// The player's own hand in the games (the skin of its Sim, the sleeve of its outfit): it reaches for
// what's touched in an arc, its fingers closing on it, brings it back or lays it where it goes; it
// holds the tool and rubs where the finger drags. Driven by a little controller the engine keeps
// (useHand), moved here each frame, so a tap is answered on the very next frame.

export type V3 = [number, number, number]
type Move = { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; lift: number; then?: () => void }
export type HandCtl = {
  /** Where it waits, out of the way. */
  home: THREE.Vector3
  p: THREE.Vector3
  moves: Move[]
  /** 0 open … 1 closed. */
  grip: number
  gripTo: number
  /** What it holds now (a part taken, the thing picked). */
  carry: PropId | null
  carryV: number
  /** Rubbing at the finger (cleaning): the point it follows. */
  follow: THREE.Vector3 | null
  rub: number
  /** Go to a point now (an arc over from where it is, whatever it was doing), then `then`. */
  reach: (to: V3, opts?: { dur?: number; lift?: number; then?: () => void }) => HandCtl
  /** Go to a point once the moves before are done. */
  after: (to: V3, opts?: { dur?: number; lift?: number; then?: () => void }) => HandCtl
  /** Back home, once the moves before are done. */
  back: (dur?: number, then?: () => void) => HandCtl
  /** Close (or open) the fingers. */
  close: (on?: boolean) => HandCtl
  /** Take a thing in it (null: let it go). */
  hold: (id: PropId | null) => HandCtl
}

/** A hand for a game: where it waits. */
export function useHand(home: V3): HandCtl {
  return useMemo(() => {
    const h: HandCtl = {
      home: new THREE.Vector3(...home),
      p: new THREE.Vector3(...home),
      moves: [],
      grip: 0,
      gripTo: 0,
      carry: null,
      carryV: 0,
      follow: null,
      rub: 0,
      reach(to, opts) {
        // Whatever was left to do is dropped (its own end still happens: the thing put down).
        for (const m of h.moves.splice(0)) m.then?.()
        return h.after(to, opts)
      },
      after(to, { dur = 0.17, lift = 0.7, then } = {}) {
        const from = h.moves.length ? h.moves[h.moves.length - 1].to.clone() : h.p.clone()
        h.moves.push({ from, to: new THREE.Vector3(...to), t: 0, dur, lift, then })
        return h
      },
      back(dur = 0.28, then) {
        return h.after(h.home.toArray() as V3, { dur, lift: 0.4, then })
      },
      close(on = true) {
        h.gripTo = on ? 1 : 0
        return h
      },
      hold(id) {
        h.carry = id
        h.carryV++
        return h
      },
    }
    return h
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)
const v = new THREE.Vector3()
const toCam = new THREE.Vector3()
const down = new THREE.Vector3()
const arm = new THREE.Vector3()
const side = new THREE.Vector3()
const back = new THREE.Vector3()
const basis = new THREE.Matrix4()

/** The hand itself: palm down, fingers away from the camera, the forearm back out of the square. `tool` is held under the palm. */
export function Hand({ ctl, tool, scale = 1, toolScale = 0.6 }: { ctl: HandCtl; tool?: PropId; scale?: number; toolScale?: number }) {
  const me = useJeuMe()
  const skin = me?.look.skin ?? '#6e4024'
  const sleeve = (me?.look as { outfitColor?: string } | undefined)?.outfitColor ?? '#ff7a00'
  const g = useRef<THREE.Group>(null)
  const fingers = useRef<(THREE.Group | null)[]>([])
  const thumb = useRef<THREE.Group>(null)
  const carried = useRef<THREE.Group>(null)
  const shownV = useRef(-1)
  const t = useRef(0)
  useFrame(({ camera }, dt0) => {
    const dt = Math.min(0.05, dt0)
    t.current += dt
    const h = ctl
    const o = g.current
    if (!o) return
    // Along its moves, one after the other: an arc over, quick in, eased out.
    const m = h.moves[0]
    if (m) {
      m.t += dt
      const k = Math.min(1, m.t / m.dur)
      const e = ease(k)
      h.p.lerpVectors(m.from, m.to, e)
      h.p.y += Math.sin(k * Math.PI) * m.lift * Math.min(1, m.from.distanceTo(m.to) / 2)
      if (k >= 1) {
        h.moves.shift()
        m.then?.()
      }
    } else if (h.follow) {
      // Rubbing: after the finger, quickly, with the to-and-fro of a hand that scrubs.
      v.copy(h.follow)
      h.p.lerp(v, Math.min(1, dt * 22))
      h.rub = Math.max(0, h.rub - dt * 2)
      h.p.x += Math.sin(t.current * 34) * 0.06 * h.rub
      h.p.z += Math.cos(t.current * 34) * 0.04 * h.rub
    }
    o.position.copy(h.p)
    // Turned to come from the bottom of the picture, whatever the camera: the forearm (+z) toward the
    // camera and down the screen, the back of the hand to the camera, the palm to what it touches.
    toCam.copy(camera.position).sub(h.p).normalize()
    down.set(0, -1, 0).applyQuaternion(camera.quaternion)
    arm.copy(toCam).multiplyScalar(0.55).add(down).normalize()
    side.crossVectors(toCam, arm).normalize()
    back.crossVectors(arm, side).normalize()
    basis.makeBasis(side, back, arm)
    o.quaternion.setFromRotationMatrix(basis)
    // Leaning into where it goes, the wrist dipping as it arrives; the to-and-fro of a hand that scrubs.
    const k = m ? Math.min(1, m.t / m.dur) : 1
    o.rotateX(m ? Math.sin(k * Math.PI) * 0.3 : 0)
    o.rotateZ((m ? (m.from.x - m.to.x) * 0.06 : 0) + (h.follow ? Math.sin(t.current * 34) * 0.12 * h.rub : 0))
    h.grip += (h.gripTo - h.grip) * Math.min(1, dt * 24)
    fingers.current.forEach((f, i) => f && (f.rotation.x = -h.grip * (1.25 + i * 0.05)))
    if (thumb.current) thumb.current.rotation.y = h.grip * 0.9
    if (carried.current && shownV.current !== h.carryV) {
      shownV.current = h.carryV
      carried.current.visible = !!h.carry
    }
  })
  const finger = (x: number, len: number, i: number) => (
    <group key={i} ref={(r) => void (fingers.current[i] = r)} position={[x, -0.02, -0.28]}>
      <mesh position={[0, 0, -len / 2]}>
        <boxGeometry args={[0.11, 0.11, len]} />
        <meshLambertMaterial color={skin} flatShading />
      </mesh>
    </group>
  )
  return (
    <group ref={g} position={ctl.p.toArray()} scale={scale}>
      {/* The forearm, back out of the picture, in the sleeve */}
      <mesh position={[0, 0.04, 0.68]}>
        <boxGeometry args={[0.34, 0.26, 1.0]} />
        <meshLambertMaterial color={skin} flatShading />
      </mesh>
      <mesh position={[0, 0.04, 1.45]}>
        <boxGeometry args={[0.44, 0.38, 0.6]} />
        <meshLambertMaterial color={sleeve} flatShading />
      </mesh>
      {/* The palm */}
      <mesh position={[0, 0.02, -0.06]}>
        <boxGeometry args={[0.5, 0.16, 0.46]} />
        <meshLambertMaterial color={skin} flatShading />
      </mesh>
      {finger(-0.18, 0.3, 0)}
      {finger(-0.06, 0.36, 1)}
      {finger(0.06, 0.34, 2)}
      {finger(0.18, 0.26, 3)}
      <group ref={thumb} position={[-0.26, -0.02, -0.02]} rotation={[0, 0, 0]}>
        <mesh position={[-0.08, 0, -0.12]} rotation={[0, 0.6, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.28]} />
          <meshLambertMaterial color={skin} flatShading />
        </mesh>
      </group>
      {/* What it holds: the tool, always; the thing taken, while carried */}
      {tool && (
        <group position={[0, -0.32, -0.15]} scale={toolScale}>
          <Prop id={tool} />
        </group>
      )}
      <group ref={carried} position={[0, -0.42, -0.25]} visible={false}>
        <CarriedProp ctl={ctl} />
      </group>
    </group>
  )
}

/** The thing in the hand (re-drawn only when it changes). */
function CarriedProp({ ctl }: { ctl: HandCtl }) {
  const [id, setId] = useState<PropId | null>(null)
  useFrame(() => {
    if (ctl.carry !== id) setId(ctl.carry)
  })
  return id ? (
    <group scale={0.75}>
      <Prop id={id} />
    </group>
  ) : null
}
