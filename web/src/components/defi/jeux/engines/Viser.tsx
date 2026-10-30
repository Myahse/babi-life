import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage } from '../Shell'
import type { EngineProps, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Aim and throw (the ball at the basket, the dart, the boule…): the target at the back, the thing to
// throw in front. An arrow swings left and right: tap to lock it; a gauge goes up and down: tap to
// throw. It flies in an arc and goes in, or not. A few shots.

type Phase = 'aim' | 'power' | 'fly' | 'after'
/** What the 3D reads and writes each frame. */
type Live = { phase: Phase; t: number; a: number; pw: number; tx: number; c: THREE.Vector3 | null; ideal: [number, number]; shot: number; hit: number; flyT: number; end: number; d: number; out: THREE.Vector3 }

const P0 = new THREE.Vector3(0, 0.45, 2.6)
const TZ = -2.4
const R = 0.85
const NG = 10
const GH = 2

const dirOf = (a: number) => new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))
const distOf = (pw: number) => 1.2 + pw * 7
/** Where the thrown thing is, s of the way (0..1) along its arc. */
function arc(a: number, d: number, s: number, out = new THREE.Vector3()) {
  out.copy(P0).addScaledVector(dirOf(a), d * s)
  out.y = P0.y * (1 - s) + (0.9 + d * 0.24) * 4 * s * (1 - s)
  return out
}
/** How near the arc comes to the target's middle, and where along it. */
function nearest(a: number, d: number, c: THREE.Vector3) {
  let best = Infinity
  let at = 1
  const v = new THREE.Vector3()
  for (let i = 0; i <= 80; i++) {
    const k = arc(a, d, i / 80, v).distanceTo(c)
    if (k < best) [best, at] = [k, i / 80]
    if (k < R * 0.4) break
  }
  return { best, at }
}

/** The swinging arrow, in blocks along the ground, from the thing thrown. */
function Arrow({ live }: { live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const l = live.current
    if (!g.current) return
    g.current.visible = l.phase === 'aim' || l.phase === 'power'
    g.current.rotation.y = -l.a
  })
  return (
    <group ref={g} position={[P0.x, 0.06, P0.z]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[0, 0, -0.75 - i * 0.42]} s={[0.16, 0.08, 0.28]} c="#ffd43b" glow={0.5} />
      ))}
      {[0.56, 0.4, 0.24, 0.1].map((w, i) => (
        <Box key={w} p={[0, 0, -2.9 - i * 0.14]} s={[w, 0.08, 0.14]} c="#ffd43b" glow={0.5} />
      ))}
    </group>
  )
}

/** The power gauge: blocks lit up to the level, the good zone in green. */
function Power({ live }: { live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  const mats = useRef<(THREE.MeshLambertMaterial | null)[]>([])
  const col = new THREE.Color()
  useFrame(() => {
    const l = live.current
    if (!g.current) return
    g.current.visible = l.phase !== 'aim'
    mats.current.forEach((m, i) => {
      if (!m) return
      const lo = i / NG
      const hi = (i + 1) / NG
      const good = hi > l.ideal[0] && lo < l.ideal[1]
      const lit = lo < l.pw
      col.set(lit ? (good ? '#2fd158' : i > NG * 0.7 ? '#ff3d57' : '#ffb020') : good ? '#1d6b33' : '#3a3f4a')
      m.color.copy(col)
      m.emissive.copy(col)
      m.emissiveIntensity = lit ? 0.5 : 0.1
    })
  })
  return (
    <group ref={g} position={[1.55, 0, 2.1]} rotation={[0, -0.35, 0]}>
      <Box p={[0, GH / 2 + 0.1, -0.2]} s={[0.62, GH + 0.35, 0.12]} c="#22252e" />
      {[...Array(NG)].map((_, i) => (
        <mesh key={i} position={[0, 0.12 + ((i + 0.5) / NG) * GH, 0]}>
          <boxGeometry args={[0.42 + i * 0.012, (GH / NG) * 0.8, 0.3]} />
          <meshLambertMaterial ref={(m) => void (mats.current[i] = m)} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** The target and the thing thrown: the swing, the gauge, the flight, the hit. */
function Range({ target, projectile, live, onLand }: { target: PropId; projectile: PropId; live: { current: Live }; onLand: () => void }) {
  const tg = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const pj = useRef<THREE.Group>(null)
  const stars = useRef<THREE.Group>(null)
  const v = new THREE.Vector3()
  useFrame(({ clock }, dt0) => {
    const dt = Math.min(0.05, dt0)
    const l = live.current
    const t = clock.elapsedTime
    l.t += dt
    if (!tg.current || !pj.current || !inner.current) return
    tg.current.position.set(l.tx, 0, TZ)
    // The target's middle, measured once.
    if (!l.c) {
      tg.current.updateMatrixWorld(true)
      const b = new THREE.Box3().setFromObject(inner.current)
      l.c = b.getCenter(new THREE.Vector3()).sub(tg.current.position)
      l.c.y = Math.max(0.5, l.c.y)
    }
    const speed = 1 + l.shot * 0.22
    if (l.phase === 'aim') l.a = Math.sin(l.t * 1.9 * speed) * 0.55
    if (l.phase === 'power') l.pw = 1 - Math.abs(((l.t * 0.9 * speed) % 2) - 1)
    // The flight: along the arc, spinning; stopped by the target if it gets there.
    if (l.phase === 'fly' || l.phase === 'after') {
      l.flyT += dt
      const dur = 0.45 + l.d * 0.065
      const s = Math.min(l.end, l.flyT / dur)
      if (l.phase === 'fly') {
        arc(l.a, l.d, s, v)
        pj.current.position.copy(v)
        pj.current.rotation.set(-l.flyT * 9, 0, 0)
        if (s >= l.end) {
          l.phase = 'after'
          l.flyT = 0
          l.out.copy(v)
          onLand()
        }
      } else {
        // After: off the target and down, or a bounce on the ground; it rests.
        const k = l.flyT
        const hit = l.hit > 0
        const back = hit ? -1.2 : 1.6
        const dir = dirOf(l.a)
        pj.current.position.set(l.out.x + dir.x * k * back, Math.max(0, l.out.y + (hit ? 0 : 2.2) * k - 9 * k * k) + Math.abs(Math.sin(k * 10)) * 0.25 * Math.max(0, 1 - k * 1.5), l.out.z + dir.z * k * back)
        pj.current.rotation.x -= dt * 6 * Math.max(0, 1 - k)
      }
    } else {
      pj.current.position.copy(P0)
      pj.current.rotation.set(0, Math.sin(t * 2) * 0.2, 0)
    }
    // Hit: the target shakes, stars go up.
    const shake = l.phase === 'after' && l.hit > 0 ? Math.max(0, 1 - l.flyT * 1.4) : 0
    inner.current.rotation.z = Math.sin(l.flyT * 30) * 0.12 * shake
    inner.current.scale.setScalar(2.1 * (1 + shake * 0.08))
    if (stars.current) {
      stars.current.visible = shake > 0
      stars.current.children.forEach((o, i) => {
        const k = l.flyT
        o.position.set(l.tx + (i - 1) * k * 1.6, (l.c?.y ?? 1) + 0.6 + k * 2, TZ + 0.4)
        o.scale.setScalar(0.55 * shake)
        o.rotation.y = t * 6
      })
    }
  })
  return (
    <group>
      <group ref={tg} position={[0, 0, TZ]}>
        <group ref={inner} scale={2.1}>
          <Prop id={target} />
        </group>
      </group>
      <group ref={pj} position={P0.toArray()}>
        <group scale={0.7} position={[0, -0.3, 0]}>
          <Prop id={projectile} />
        </group>
      </group>
      <group ref={stars} visible={false}>
        {[0, 1, 2].map((i) => (
          <group key={i}>
            <Prop id="etoile" />
          </group>
        ))}
      </group>
    </group>
  )
}

export function Viser({ jeu, onEnd }: EngineProps<'viser'>) {
  const shots = jeu.shots ?? 5
  const [phase, setPhase] = useState<Phase>('aim')
  const [shot, setShot] = useState(0)
  const [hits, setHits] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const live = useRef<Live>({ phase: 'aim', t: 0, a: 0, pw: 0, tx: 0, c: null, ideal: [0.5, 0.6], shot: 0, hit: 0, flyT: 0, end: 1, d: 0, out: new THREE.Vector3() })
  const st = useRef({ sum: 0, done: false, hint: '' })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1300)
  }
  const go = (p: Phase) => {
    live.current.phase = p
    live.current.t = 0
    setPhase(p)
  }
  // Each shot the target a little elsewhere.
  const place = (n: number) => {
    live.current.tx = n === 0 ? 0 : (Math.random() * 2 - 1) * 1.6
    live.current.shot = n
    go('aim')
  }
  useEffect(() => place(0), []) // eslint-disable-line react-hooks/exhaustive-deps
  const tap = () => {
    const l = live.current
    if (st.current.done) return
    if (l.phase === 'aim') {
      haptic('light')
      // The good zone of the gauge, for this aim: where the arc comes nearest the target.
      const c = (l.c ?? new THREE.Vector3(0, 0.8, 0)).clone().add(new THREE.Vector3(l.tx, 0, TZ))
      let best = Infinity
      let pw = 0.5
      for (let p = 0; p <= 1; p += 0.01) {
        const k = nearest(l.a, distOf(p), c).best
        if (k < best) [best, pw] = [k, p]
      }
      l.ideal = best < R ? [pw - 0.07, pw + 0.07] : [-1, -1]
      go('power')
      return
    }
    if (l.phase !== 'power') return
    haptic('medium')
    gesture('throw', 1200)
    const c = (l.c ?? new THREE.Vector3(0, 0.8, 0)).clone().add(new THREE.Vector3(l.tx, 0, TZ))
    l.d = distOf(l.pw)
    const n = nearest(l.a, l.d, c)
    l.hit = n.best < R * 0.45 ? 1 : n.best < R ? 0.7 : 0
    l.end = l.hit ? n.at : 1
    l.flyT = 0
    // What to say if it misses: the side, or the length.
    const want = Math.atan2(c.x - P0.x, P0.z - c.z)
    const along = c.clone().sub(P0).setY(0).length()
    st.current.hint = Math.abs(l.a - want) > 0.09 ? (l.a < want ? tr('Trop à gauche !') : tr('Trop à droite !')) : l.d < along ? tr('Trop court !') : tr('Trop long !')
    go('fly')
  }
  const landed = () => {
    const l = live.current
    st.current.sum += l.hit
    if (l.hit) {
      haptic('success')
      gesture('cheer', 1200)
      setHits((h) => h + 1)
      say(l.hit === 1 ? tr('Dans le mille !') : tr('Touché !'))
    } else {
      haptic('error')
      say(st.current.hint)
    }
    setPhase('after')
    const n = l.shot + 1
    setTimeout(() => {
      if (n >= shots) {
        st.current.done = true
        say(st.current.sum >= shots * 0.8 ? tr('Quel tireur !') : tr('C’est fini !'))
        setTimeout(() => onEnd(Math.max(10, Math.round((st.current.sum / shots) * 100))), 900)
        return
      }
      setShot(n)
      place(n)
    }, 1400)
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => (e.code === 'Space' || e.key === 'Enter') && (e.preventDefault(), tap())
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const label = phase === 'aim' ? tr('Vise : touche !') : phase === 'power' ? tr('Lance !') : '…'
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={`Tir ${Math.min(shot + 1, shots)}/${shots} · ${hits} dedans`}
      said={said}
      controls={
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" disabled={phase === 'fly' || phase === 'after'} onPointerDown={(e) => (e.preventDefault(), tap())} style={phase === 'power' ? { background: '#00a862' } : undefined}>
          {label}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none" onPointerDown={tap}>
        <Stage decor={jeu.decor} cam={[0, 2.7, 6.4]} look={[0, 1.2, -1.2]} fov={48}>
          <Range target={jeu.target} projectile={jeu.projectile} live={live} onLand={landed} />
          <Arrow live={live} />
          <Power live={live} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:viser). */
export const demo: Extract<import('../types').Jeu, { engine: 'viser' }> = {
  engine: 'viser', title: tr('Tir au panier'), how: tr('Touche pour viser, touche encore pour la force. Mets-la dedans !'), decor: 'bitume', projectile: 'ballon-basket', target: 'panier-basket',
}
