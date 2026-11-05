import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, clamp, fx, useHud } from './kit'
import { Stage3D, planeAt, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { MySim } from '../jeux/me'
import { t } from '../../../lib/i18n'

// « Le petit-fils du vieux Koné », chapter 2 (game/epreuves.go): at the barbier, to look « tout propre »
// for the grandson. In the salon in the game's 3D blocks: your own Sim in the chair (its real look), seen
// from the side, close; the barber's chalk line round its head for the dégradé, in little white blocks.
// Run the clippers (the block tondeuse under the finger) along the line, from the neck to the temple, not
// too far off it: where they pass, the hair is cut short; off the line, a hole (and the vieux will see it).
// Three passes: the neck, the side, the temple. The same rule and score as before (the distance to the line
// is still read on the screen, in px).

const TIME = 30
const PASSES = 3
const TOL = 16 // px off the line before it's a mistake
/** The head's middle and size in the scene (the Sim standing, the camera close on its right side). */
const HEAD: [number, number, number] = [0, 1.5, 0.05]
const R = 0.27
/** The side of the head facing the camera: the plane the line and the clippers are on. */
const SIDE_X = 0.24
const MARKS = 700

/** A pass's line, u from 0 (the back of the neck) to 1 (the temple): a point in the scene, round the back
 *  of the head on its side (z: back to front, y: up), each pass a little higher. */
function line(pass: number, u: number, out: THREE.Vector3) {
  const phi = ((240 - 170 * u) * Math.PI) / 180
  return out.set(SIDE_X, HEAD[1] - R * 0.2 + pass * R * 0.22 + Math.sin(phi) * R * (0.8 - pass * 0.15), HEAD[2] + Math.cos(phi) * R * 0.82)
}

export default function KonePetitFils({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ pass: 0, prog: 0, err: 0, samples: 0, down: false, over: false, now: 0, scores: [] as number[], started: false, cuts: 0 })
  const [hud, setHud] = useHud({ left: TIME, pass: 0 })
  const [pass, setPass] = useState(0)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  // The clippers' place on the head's side, the marks of the cut (instanced little blocks).
  const tool = useRef(new THREE.Vector3(SIDE_X + 0.05, HEAD[1] - 0.6, 0.3))
  const marks = useRef<THREE.InstancedMesh>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), -SIDE_X), [])

  /** Where a pass's line point is on the screen. */
  const onScreen = (p: number, u: number) => {
    line(p, u, v)
    return screenOf(v.x, v.y, v.z)
  }

  const finishPass = () => {
    const st = s.current
    const acc = st.samples ? clamp(1 - st.err / st.samples, 0, 1) : 0
    const sc = Math.round(acc * 100)
    st.scores.push(sc)
    const { x, y } = onScreen(st.pass, 1)
    if (sc >= 80) fx.good(x, y, t('Propre !'))
    else fx.bad(x, y, `${sc} %`)
    beep(sc >= 80 ? 880 : 300, 0.2, 0.12)
    st.pass++
    st.prog = 0
    st.err = 0
    st.samples = 0
    setPass(st.pass)
    if (st.pass >= PASSES) {
      st.over = true
      const avg = st.scores.reduce((a, b) => a + b, 0) / st.scores.length
      if (avg >= 80) fx.win()
      setFlash({ text: avg >= 80 ? t('Tout propre !') : t('Il y a un trou…'), at: Date.now() })
      setTimeout(() => onEnd(Math.round(avg)), 1100)
    } else setFlash({ text: [t('La nuque'), t('Le côté'), t('La tempe')][st.pass], at: Date.now() })
  }

  // The clock (from the salon on the screen).
  useEffect(() => {
    const id = setInterval(() => {
      const st = s.current
      if (!st.started) return
      st.now += 0.1
      const left = TIME - st.now
      if (!st.over && left <= 0) {
        st.over = true
        const done = st.scores.reduce((a, b) => a + b, 0)
        setTimeout(() => onEnd(Math.round(done / PASSES)), 900)
      }
      setHud({ left: Math.max(0, left), pass: st.pass })
    }, 100)
    return () => clearInterval(id)
  }, [onEnd, setHud])

  const mark = (bad: boolean) => {
    const st = s.current
    const m = marks.current
    if (!m || st.cuts >= MARKS) return
    const o = new THREE.Object3D()
    o.position.set(SIDE_X + 0.02, tool.current.y, tool.current.z)
    o.rotation.x = Math.random() * 0.6
    o.updateMatrix()
    m.setMatrixAt(st.cuts, o.matrix)
    const first = !m.instanceColor
    m.setColorAt(st.cuts, new THREE.Color(bad ? '#8d5a3b' : '#8a837c'))
    // (The material learns of the instances' colours once they exist.)
    if (first) (m.material as THREE.Material).needsUpdate = true
    st.cuts++
    m.count = st.cuts
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (planeAt(e.x, e.y, side, v)) tool.current.copy(v)
    if (st.over) return
    if (e.kind === 'down') st.down = true
    if (e.kind === 'up') {
      st.down = false
      return
    }
    if (!st.down) return
    // Where on the line the clippers are: the nearest point a little ahead of what's done (on the screen).
    let best = st.prog
    let bd = Infinity
    for (let u = Math.max(0, st.prog - 0.05); u <= Math.min(1, st.prog + 0.12); u += 0.005) {
      const p = onScreen(st.pass, u)
      const d = Math.hypot(p.x - e.x, p.y - e.y)
      if (d < bd) ((bd = d), (best = u))
    }
    if (bd > TOL * 3) return
    st.samples++
    const bad = bd > TOL
    if (bad) {
      st.err++
      if (Math.random() < 0.3) fx.shake(3)
    }
    mark(bad)
    if (Math.random() < 0.25) beep(140 + Math.random() * 30, 0.04, 0.03, { type: 'sawtooth' })
    st.prog = Math.max(st.prog, best)
    if (st.prog >= 0.98) {
      st.down = false
      finishPass()
    }
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[2.2, 1.6, 0]} look={[0, 1.5, 0]} fov={30} fit={[0.85, 1.0]} bg="#f1e4d0" touch={touch} onReady={() => (s.current.started = true)}>
        <Salon />
        {/* Sitting (still: no fidgets), lifted so its head stays where the line is drawn */}
        <MySim pose="sit" r={0} p={[0, 0.41, 0]} />
        <Chalk pass={pass} s={s} />
        <instancedMesh ref={marks} args={[undefined, undefined, MARKS]} count={0} frustumCulled={false}>
          <boxGeometry args={[0.012, 0.03, 0.03]} />
          <meshLambertMaterial />
        </instancedMesh>
        <Clippers tool={tool} s={s} />
      </Stage3D>
      <Hud title={t('Le dégradé')} left={hud.left} done={`${Math.min(hud.pass + 1, PASSES)}/${PASSES}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-[#5c3a21]">{t('Pars du rond vert et suis le trait blanc sans lever le doigt.')}</p>
    </div>
  )
}

/** The salon behind: the wall, the mirror's frame, the posters, the barber's cape on the shoulders. */
function Salon() {
  return (
    <group>
      <Box p={[-1.2, 1.4, 0]} s={[0.1, 3, 4]} c="#e9dcc4" />
      <Box p={[-1.14, 1.55, -0.9]} s={[0.04, 0.5, 0.4]} c="#c92a2a" />
      <Box p={[-1.14, 1.55, 0.9]} s={[0.04, 0.5, 0.4]} c="#1c7ed6" />
      <Box p={[-1.14, 1.45, 0]} s={[0.03, 0.9, 1.0]} c="#adb5bd" />
      {/* The cape round the neck */}
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.2, 0.45, 0.32, 8]} />
        <meshLambertMaterial color="#1864ab" flatShading />
      </mesh>
    </group>
  )
}

/** The chalk line of the pass in little white blocks (the part done gone), the green start, the yellow progress. */
function Chalk({ pass, s }: { pass: number; s: React.RefObject<{ prog: number; over: boolean }> }) {
  const dots = useMemo(() => {
    const out: [number, number, number][] = []
    const v = new THREE.Vector3()
    for (let i = 0; i <= 30; i++) out.push(line(pass, i / 30, v).toArray() as [number, number, number])
    return out
  }, [pass])
  const group = useRef<THREE.Group>(null)
  const head = useRef<THREE.Mesh>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const st = s.current
    const g = group.current
    if (g) {
      g.visible = !st.over && pass < PASSES
      g.children.forEach((m, i) => (m.visible = i / 30 >= st.prog - 0.01))
    }
    if (head.current) {
      line(pass, st.prog, v)
      head.current.position.set(v.x + 0.01, v.y, v.z)
      head.current.visible = !st.over && pass < PASSES
    }
  })
  if (pass >= PASSES) return null
  return (
    <group>
      <group ref={group}>
        {dots.map((p, i) => (
          <mesh key={i} position={[p[0] + 0.008, p[1], p[2]]} visible={i % 2 === 0}>
            <boxGeometry args={[0.01, 0.016, 0.016]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
      <mesh position={[dots[0][0] + 0.01, dots[0][1], dots[0][2]]}>
        <boxGeometry args={[0.012, 0.04, 0.04]} />
        <meshBasicMaterial color="#69db7c" />
      </mesh>
      <mesh ref={head}>
        <boxGeometry args={[0.014, 0.028, 0.028]} />
        <meshBasicMaterial color="#ffd43b" />
      </mesh>
    </group>
  )
}

/** The tondeuse under the finger: its black body, its steel blade, buzzing while it cuts. */
function Clippers({ tool, s }: { tool: React.RefObject<THREE.Vector3>; s: React.RefObject<{ down: boolean }> }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const m = g.current
    if (!m) return
    const p = tool.current
    const buzz = s.current.down ? (Math.random() - 0.5) * 0.004 : 0
    // Its blade on the head, its body down toward the camera, held as a hand holds it.
    m.position.set(p.x + 0.05, p.y + buzz, p.z + buzz)
  })
  return (
    <group ref={g} rotation={[0.5, 0, 0]}>
      <Box p={[0.02, -0.07, 0]} s={[0.04, 0.14, 0.05]} c="#212529" />
      <Box p={[0, 0.005, 0]} s={[0.02, 0.015, 0.06]} c="#adb5bd" />
    </group>
  )
}
