import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage } from '../Shell'
import type { EngineProps, PropId } from '../types'

// Hold and let go in the green (the garba's « pommer », made for every action): hold the button, the
// gauge beside the thing rises (and the thing fills, lifts, heats, is pressed as it's held); let go in
// the green band. Too long, it spills over. A few rounds, the band narrower each time.

type Fill = 'liquide' | 'force' | 'chaleur' | 'tissu'
type Zone = 'low' | 'band' | 'high'
/** What the 3D reads each frame: where the gauge is, the band, how the round went. */
type Live = { p: number; holding: boolean; lo: number; hi: number; speed: number; res: null | 'good' | 'bad' | 'over'; resT: number }

const N = 14
const GH = 3.2
const GX = 2.25
const OX = -1
const SIZE = 2.6

/** The gauge: a column of blocks filling, the band in green, a white line at the level. */
function Gauge({ live }: { live: { current: Live } }) {
  const mats = useRef<(THREE.MeshLambertMaterial | null)[]>([])
  const line = useRef<THREE.Mesh>(null)
  const lo = useRef<THREE.Group>(null)
  const hi = useRef<THREE.Group>(null)
  const col = new THREE.Color()
  useFrame(({ clock }) => {
    const l = live.current
    const flash = l.res && clock.elapsedTime % 0.24 < 0.12
    mats.current.forEach((m, i) => {
      if (!m) return
      const mid = (i + 0.5) / N
      const band = mid >= l.lo && mid <= l.hi
      const full = mid <= l.p
      col.set(full ? (l.res === 'good' && flash ? '#8cff9a' : l.res && l.res !== 'good' && flash ? '#ff7a8a' : mid > l.hi ? '#ff3d57' : band ? '#2fd158' : '#ffb020') : band ? '#1d6b33' : '#3a3f4a')
      m.color.copy(col)
      m.emissive.copy(col)
      m.emissiveIntensity = full ? 0.45 : 0.1
    })
    line.current?.position.set(0, 0.15 + Math.min(1, l.p) * GH, 0.3)
    lo.current?.position.set(0, 0.15 + l.lo * GH, 0)
    hi.current?.position.set(0, 0.15 + l.hi * GH, 0)
  })
  return (
    <group position={[GX, 0, 0]}>
      <Box p={[0, GH / 2 + 0.15, -0.3]} s={[1.05, GH + 0.5, 0.2]} c="#22252e" />
      <Box p={[0, 0.06, 0]} s={[1.2, 0.12, 0.8]} c="#22252e" />
      {[...Array(N)].map((_, i) => (
        <mesh key={i} position={[0, 0.15 + ((i + 0.5) / N) * GH, 0]}>
          <boxGeometry args={[0.72, (GH / N) * 0.84, 0.5]} />
          <meshLambertMaterial ref={(m) => void (mats.current[i] = m)} flatShading />
        </mesh>
      ))}
      {/* The band's edges, out to the sides */}
      {[lo, hi].map((r, i) => (
        <group key={i} ref={r}>
          <Box p={[-0.5, 0, 0.05]} s={[0.22, 0.06, 0.6]} c="#ffffff" glow={0.6} />
          <Box p={[0.5, 0, 0.05]} s={[0.22, 0.06, 0.6]} c="#ffffff" glow={0.6} />
        </group>
      ))}
      <mesh ref={line}>
        <boxGeometry args={[0.95, 0.05, 0.12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

/** The thing held, reacting to the gauge: filled, lifted, heated, pressed. */
function Held({ object, fill, live }: { object: PropId; fill: Fill; live: { current: Live } }) {
  const obj = useRef<THREE.Group>(null)
  const liquid = useRef<THREE.Mesh>(null)
  const spill = useRef<THREE.Group>(null)
  const press = useRef<THREE.Group>(null)
  const fire = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const stars = useRef<THREE.Group>(null)
  const box = useRef<THREE.Box3 | null>(null)
  const mats = useRef<THREE.MeshLambertMaterial[]>([])
  const shown = useRef(0)
  useFrame(({ clock }, dt) => {
    const l = live.current
    const t = clock.elapsedTime
    const o = obj.current
    if (!o) return
    // Its size, once (and its own materials, to heat them).
    if (!box.current) {
      o.updateMatrixWorld(true)
      box.current = new THREE.Box3().setFromObject(o)
      o.traverse((m) => {
        const mesh = m as THREE.Mesh
        if (mesh.isMesh && (mesh.material as THREE.MeshLambertMaterial).emissive) {
          mesh.material = (mesh.material as THREE.Material).clone()
          mats.current.push(mesh.material as THREE.MeshLambertMaterial)
        }
      })
    }
    const b = box.current
    const h = b.max.y - b.min.y
    // What's shown eases after the gauge; after a round it drains.
    const want = l.res && l.resT > 0.7 ? 0 : l.p
    shown.current += (want - shown.current) * Math.min(1, dt * (want < shown.current ? 3 : 20))
    const p = Math.min(1.1, shown.current)
    const over = l.res === 'over' && l.resT < 1
    const shake = Math.max(0, p - 0.75) * Math.sin(t * 45) * 0.2
    o.position.set(OX + shake * (fill === 'force' ? 1 : 0.3), 0, 0)
    o.rotation.set(0, 0, 0)
    o.scale.setScalar(SIZE)
    if (fill === 'force') {
      o.position.y = over ? Math.max(0, 1.6 - l.resT * 6) : p * 1.6
      if (over) o.rotation.z = Math.min(0.5, l.resT * 2)
    }
    if (fill === 'tissu') {
      const k = over ? 0.75 : p * 0.55
      o.scale.set(SIZE * (1 + k * 0.45), SIZE * (1 - k), SIZE * (1 + k * 0.45))
      press.current?.position.set(OX, b.max.y * (1 - k) + 0.12 + Math.max(0, 0.35 - p) * 2.5, 0)
    }
    if (fill === 'chaleur') {
      mats.current.forEach((m) => {
        m.emissive.set(over ? '#ff2a00' : '#ff7a00')
        m.emissiveIntensity = over ? 1 : p * 0.85
      })
      fire.current?.scale.setScalar(Math.max(0.01, (over ? 1.3 : p) * 0.9 * (1 + Math.sin(t * 20) * 0.08)))
      if (light.current) light.current.intensity = p * 6
    }
    if (fill === 'liquide' && liquid.current) {
      const lh = Math.max(0.01, h * Math.min(1.04, p))
      liquid.current.scale.set((b.max.x - b.min.x) * 0.9, lh, (b.max.z - b.min.z) * 0.9)
      liquid.current.position.y = b.min.y + lh / 2
    }
    // Spilt over: drops thrown out of the top, falling.
    if (spill.current) {
      spill.current.visible = l.res === 'over' && fill === 'liquide'
      spill.current.children.forEach((d, i) => {
        const k = l.resT
        const side = i % 2 ? 1 : -1
        d.position.set(OX + side * ((b.max.x - b.min.x) / 2 + k * (0.8 + (i % 3) * 0.4)), b.max.y + k * 1.5 - k * k * 6 + 0.1, ((i % 3) - 1) * 0.3)
      })
    }
    // Got it: stars up out of it.
    if (stars.current) {
      stars.current.visible = l.res === 'good' && l.resT < 0.9
      stars.current.children.forEach((s, i) => {
        const a = (i / 3) * Math.PI - Math.PI / 3
        s.position.set(OX + Math.sin(a) * l.resT * 2, (fill === 'force' ? 1.6 : 0) + b.max.y + l.resT * 1.6, 0.6)
        s.scale.setScalar(Math.max(0.01, 0.9 * (1 - l.resT * 0.8)))
        s.rotation.y = t * 6
      })
    }
  })
  return (
    <group>
      <group ref={obj} position={[OX, 0, 0]} scale={SIZE}>
        <Prop id={object} />
      </group>
      {fill === 'liquide' && (
        <mesh ref={liquid} position={[OX, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color="#3aa0f0" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}
      <group ref={spill} visible={false}>
        {[...Array(6)].map((_, i) => (
          <Box key={i} p={[0, 0, 0]} s={[0.2, 0.2, 0.2]} c="#3aa0f0" />
        ))}
      </group>
      {fill === 'tissu' && (
        <group ref={press}>
          <Box p={[0, 0.12, 0]} s={[2.4, 0.24, 1.8]} c="#8a5a32" />
          <Box p={[0, 0.6, 0]} s={[0.3, 0.8, 0.3]} c="#5c3a1e" />
        </group>
      )}
      {fill === 'chaleur' && (
        <>
          <group ref={fire} position={[OX, 0.02, 0.9]}>
            {[-0.6, 0, 0.6].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                <Prop id="flamme" />
              </group>
            ))}
          </group>
          <pointLight ref={light} position={[OX, 1, 1.5]} color="#ff8a30" intensity={0} distance={6} />
        </>
      )}
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

const OVER: Record<Fill, string> = { liquide: 'Ça déborde !', force: 'Trop lourd, ça tombe !', chaleur: 'Ça brûle !', tissu: 'Trop serré !' }
const LOW: Record<Fill, string> = { liquide: 'Pas assez rempli…', force: 'Pas assez haut…', chaleur: 'Pas assez chaud…', tissu: 'Pas assez serré…' }

export function Tenir({ jeu, onEnd }: EngineProps<'tenir'>) {
  const times = jeu.times ?? 4
  const [round, setRound] = useState(0)
  const [zone, setZone] = useState<Zone | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [good, setGood] = useState(0)
  const live = useRef<Live>({ p: 0, holding: false, lo: 0.55, hi: 0.85, speed: 0.35, res: null, resT: 0 })
  const st = useRef({ sum: 0, round: 0, done: false })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1100)
  }
  // Each round its band: narrower, somewhere else; the gauge a little quicker.
  const band = (r: number) => {
    const w = 0.3 - (r / Math.max(1, times - 1)) * 0.17
    const c = 0.45 + w / 2 + Math.random() * (0.43 - w)
    Object.assign(live.current, { p: 0, holding: false, lo: c - w / 2, hi: c + w / 2, speed: 0.34 + r * 0.07, res: null, resT: 0 })
    setZone(null)
  }
  useEffect(() => band(0), []) // eslint-disable-line react-hooks/exhaustive-deps
  const end = (res: 'good' | 'bad' | 'over', q: number) => {
    const l = live.current
    l.holding = false
    l.res = res
    l.resT = 0
    st.current.sum += q
    if (res === 'good') setGood((g) => g + 1)
    setZone(null)
    const r = st.current.round + 1
    setTimeout(() => {
      if (r >= times) {
        st.current.done = true
        gesture('cheer', 1500)
        say(st.current.sum >= times - 0.5 ? 'Tout parfait, champion !' : 'C’est fait !')
        setTimeout(() => onEnd(Math.max(10, Math.round((st.current.sum / times) * 100))), 900)
        return
      }
      st.current.round = r
      setRound(r)
      band(r)
    }, 1300)
  }
  const hold = () => {
    const l = live.current
    if (l.holding || l.res || st.current.done) return
    l.holding = true
    l.p = 0
    haptic('light')
    gesture('busy', 4000)
  }
  const letGo = () => {
    const l = live.current
    if (!l.holding) return
    if (l.p >= l.lo && l.p <= l.hi) {
      haptic('success')
      gesture('cheer', 900)
      say(['Parfait !', 'Pile dedans !', 'Bien joué !'][st.current.round % 3])
      end('good', 1)
    } else {
      const near = l.p >= l.lo - 0.07 && l.p <= l.hi + 0.07
      haptic(near ? 'medium' : 'error')
      gesture('idle', 600)
      say(near ? 'Presque !' : l.p < l.lo ? LOW[jeu.fill] : 'Trop !')
      end('bad', near ? 0.5 : 0)
    }
  }
  // Space works too.
  useEffect(() => {
    const down = (e: KeyboardEvent) => e.code === 'Space' && (e.preventDefault(), hold())
    const up = (e: KeyboardEvent) => e.code === 'Space' && letGo()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })
  const label = zone === null ? `${jeu.verb} (tiens)` : zone === 'band' ? 'Lâche !' : zone === 'high' ? 'Trop !' : `${jeu.verb}…`
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={`${Math.min(round + 1, times)}/${times} · ${good} dans le vert`}
      said={said}
      controls={
        <button
          className="btn flex-1 touch-none !py-4 text-[17px] select-none"
          onPointerDown={(e) => (e.preventDefault(), hold())}
          onPointerUp={letGo}
          onPointerLeave={letGo}
          onPointerCancel={letGo}
          onContextMenu={(e) => e.preventDefault()}
          style={zone ? { background: zone === 'band' ? '#00a862' : zone === 'high' ? '#ff3d57' : undefined } : undefined}
        >
          {label}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none" onPointerDown={(e) => (e.preventDefault(), hold())} onPointerUp={letGo} onPointerLeave={letGo} onPointerCancel={letGo} onContextMenu={(e) => e.preventDefault()}>
        <Stage decor={jeu.decor} cam={[0.3, 3.2, 6.6]} look={[0.4, 1.45, 0]} fov={42}>
          <Run live={live} onZone={setZone} onOver={() => (haptic('error'), say(OVER[jeu.fill]), end('over', 0))} />
          <Held object={jeu.object} fill={jeu.fill} live={live} />
          <Gauge live={live} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** The gauge rising while it's held (quicker as it goes), and the round's clock for its result. */
function Run({ live, onZone, onOver }: { live: { current: Live }; onZone: (z: Zone | null) => void; onOver: () => void }) {
  const zone = useRef<Zone | null>(null)
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, dt0)
    const l = live.current
    if (l.res) l.resT += dt
    let z: Zone | null = null
    if (l.holding) {
      l.p += l.speed * dt * (0.6 + l.p * 1.1)
      z = l.p < l.lo ? 'low' : l.p <= l.hi ? 'band' : 'high'
      if (l.p >= 1) {
        l.p = 1
        z = null
        onOver()
      }
    }
    if (z !== zone.current) {
      zone.current = z
      if (z === 'band') haptic('light')
      onZone(z)
    }
  })
  return null
}

/** A game to try it on the lab page (?g=demo:tenir). */
export const demo: Extract<import('../types').Jeu, { engine: 'tenir' }> = {
  engine: 'tenir', title: 'Sers le bissap', how: 'Tiens pour verser, lâche quand c’est dans le vert. Pas de débordement !', decor: 'comptoir', object: 'verre', verb: 'Verse', fill: 'liquide',
}
