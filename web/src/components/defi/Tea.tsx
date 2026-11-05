import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import { sceneDpr, weakDevice } from '../../lib/device'
import { t, tx } from '../../lib/i18n'

// Le défi du thé, as it's made at the grin (l'attaya): three little glasses,
// in 3D, the game's blocks. The finger is the hand holding the teapot: put it
// down and the tea pours, move it up and the teapot goes up with it. Poured
// from high, the tea foams (that's the art of it), but the higher, the harder
// the thin stream is to keep in the little glass, and too high it splashes
// all round. Fill up to the line, not over, and serve. Each glass a little
// harder (the stream wavers more), as they go: bitter, then sweet, then sweeter.

const GLASSES = [
  { line: t('Le premier, amer comme la mort'), sway: 0.75 },
  { line: t('Le deuxième, doux comme la vie'), sway: 0.9 },
  { line: t("Le troisième, sucré comme l'amour"), sway: 1.05 },
]
/** How high (0–1) the stream foams without splashing. */
const ZONE: [number, number] = [0.55, 0.8]
/** Of the glass a second, pouring into it. */
const FILL = 0.2
/** The line to fill up to, on the glass. */
const LINE = 0.85
/** The glass (m): its radius, its height; how far above it the teapot can go. */
const R = 0.07
const H = 0.2
const REACH = 0.8

type Glass = { fill: number; foam: number; spill: number }

/** A glass's score out of 100: filled to the line, the foam, nothing splashed. */
function glassScore(g: Glass) {
  const filled = g.fill > 1 ? 0 : 40 * Math.max(0, 1 - Math.abs(g.fill - LINE) / 0.25)
  const foam = 45 * Math.min(1, g.foam / 0.6)
  const clean = g.spill < 0.03 ? 15 : 0
  return Math.round(Math.max(0, Math.min(100, filled + foam + clean - Math.min(30, g.spill * 60))))
}
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

/** What the hand and the tea are doing, shared by the scene and the page. */
type State = Glass & {
  /** The spout's tip (m), where the hand wants it and where it is. */
  want: THREE.Vector3
  tip: THREE.Vector3
  h: number
  pouring: boolean
  /** Where the stream comes down, and whether that's in the glass. */
  land: number
  inGlass: boolean
  splash: number
  /** The finger on the screen (-1…1), when it's down. */
  ndc: { x: number; y: number } | null
  keys: { x: number; y: number }
}

export function TeaDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const [glass, setGlass] = useState(0)
  const st = useRef<State>({ fill: 0, foam: 0, spill: 0, want: new THREE.Vector3(0.02, H + 0.25, 0), tip: new THREE.Vector3(0.02, H + 0.25, 0), h: 0.3, pouring: false, land: 0, inGlass: true, splash: 0, ndc: null, keys: { x: 0, y: 0 } })
  const [hud, setHud] = useState({ h: 0.3, fill: 0, pouring: false, zone: 'low' as 'low' | 'foam' | 'high', miss: false })
  const [scores, setScores] = useState<number[]>([])
  const [served, setServed] = useState<{ score: number; foam: number; filled: boolean; over: boolean; low: boolean } | null>(null)
  const servedRef = useRef(false)
  const glassRef = useRef(glass)
  glassRef.current = glass

  const serve = () => {
    if (servedRef.current) return
    servedRef.current = true
    const s = st.current
    s.pouring = false
    const score = glassScore(s)
    haptic(s.fill > 1 ? 'error' : score >= 50 ? 'success' : 'medium')
    if (score >= 70) sfx.win()
    setServed({ score, foam: s.foam >= 0.55 ? 3 : s.foam >= 0.3 ? 2 : s.foam >= 0.1 ? 1 : 0, filled: s.fill <= 1 && Math.abs(s.fill - LINE) < 0.1, over: s.fill > 1, low: s.fill < LINE })
    const all = [...scores, score]
    setScores(all)
    setTimeout(() => {
      if (glass + 1 >= GLASSES.length) return onEnd(Math.round(all.reduce((a, b) => a + b, 0) / all.length))
      Object.assign(st.current, { fill: 0, foam: 0, spill: 0, pouring: false, splash: 0 })
      servedRef.current = false
      setServed(null)
      setGlass(glass + 1)
    }, 1600)
  }
  const serveRef = useRef(serve)
  serveRef.current = serve

  // The keys, on a computer: Space pours, the arrows move the teapot.
  useEffect(() => {
    const k = st.current.keys
    const set = (e: KeyboardEvent, on: boolean) => {
      if (e.code === 'Space') (e.preventDefault(), (st.current.pouring = on && !servedRef.current))
      else if (e.code === 'ArrowUp') (e.preventDefault(), (k.y = on ? 1 : k.y === 1 ? 0 : k.y))
      else if (e.code === 'ArrowDown') (e.preventDefault(), (k.y = on ? -1 : k.y === -1 ? 0 : k.y))
      else if (e.code === 'ArrowLeft') k.x = on ? -1 : k.x === -1 ? 0 : k.x
      else if (e.code === 'ArrowRight') k.x = on ? 1 : k.x === 1 ? 0 : k.x
      else if (e.code === 'Enter' && on && st.current.fill >= 0.4) serveRef.current()
    }
    const down = (e: KeyboardEvent) => !e.repeat && set(e, true)
    const up = (e: KeyboardEvent) => set(e, false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  }, [])

  // The finger on the scene: down, it pours; where it goes, the spout goes.
  const finger = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    st.current.ndc = { x: ((e.clientX - b.left) / b.width) * 2 - 1, y: -(((e.clientY - b.top) / b.height) * 2 - 1) }
  }
  const s = st.current
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3 text-white">
        <div className="leading-tight">
          <div className="font-display text-[13px] font-extrabold tracking-wider text-white/70">{tx('VERRE {0} / 3', { 0: glass + 1 })}</div>
          <div className="font-display text-[16px] font-extrabold">{GLASSES[glass].line}</div>
        </div>
        <div className="flex gap-1">
          {GLASSES.map((_, k) => (
            <span key={k} className={`grid h-8 w-8 place-items-center rounded-full font-display text-[13px] font-extrabold ${k < scores.length ? 'bg-[#ffc233] text-[#16161c]' : k === glass ? 'bg-white/25' : 'bg-white/10'}`}>
              {k < scores.length ? scores[k] : k + 1}
            </span>
          ))}
        </div>
      </div>

      <div
        className="relative mx-3 mt-3 min-h-0 flex-1 touch-none overflow-hidden rounded-[24px] select-none"
        style={{ background: 'linear-gradient(#1b1f4b, #3d2a3e 60%, #5a3420)' }}
        onPointerDown={(e) => {
          if (servedRef.current) return
          e.currentTarget.setPointerCapture(e.pointerId)
          finger(e)
          st.current.pouring = true
        }}
        onPointerMove={(e) => st.current.ndc && finger(e)}
        onPointerUp={() => ((st.current.pouring = false), (st.current.ndc = null))}
        onPointerCancel={() => ((st.current.pouring = false), (st.current.ndc = null))}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Canvas dpr={sceneDpr} gl={{ alpha: true, antialias: !weakDevice }} camera={{ position: [0.3, 0.56, 1.45], fov: 50 }} onCreated={({ camera }) => camera.lookAt(0.02, 0.5, 0)}>
          <hemisphereLight args={['#ffe6c4', '#3a2430', 1.1]} />
          <directionalLight position={[1.5, 3, 2]} intensity={1.2} />
          <pointLight position={[-0.6, 0.3, -0.3]} intensity={2.5} distance={2.5} color="#ff8a00" />
          <Tea st={st} glass={glass} sway={GLASSES[glass].sway} served={servedRef} onHud={setHud} onOver={() => serveRef.current()} scores={scores} />
        </Canvas>
        {/* How high: the gold for the foam, the red where it splashes. */}
        <div className="pointer-events-none absolute top-[12%] right-3 bottom-[34%] w-3 rounded-full" style={{ background: `linear-gradient(to top, rgba(255,255,255,0.25) 0 ${ZONE[0] * 100}%, #ffc233 ${ZONE[0] * 100}% ${ZONE[1] * 100}%, #e03131 ${ZONE[1] * 100}%)` }}>
          <span className="absolute -left-2 h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent border-l-white" style={{ bottom: `calc(${hud.h * 100}% - 6px)` }} />
        </div>
        {hud.pouring && !served && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 font-display text-[13px] font-extrabold" style={{ color: hud.miss ? '#ff8787' : hud.zone === 'foam' ? '#ffd43b' : hud.zone === 'high' ? '#ff8787' : '#fff' }}>
            {hud.miss ? t('À côté du verre !') : hud.zone === 'foam' ? t('ça mousse !') : hud.zone === 'high' ? t('Trop haut, ça éclabousse') : t('Monte la théière pour la mousse')}
          </div>
        )}
        {!hud.pouring && !served && hud.fill === 0 && (
          <div className="pointer-events-none absolute inset-x-6 top-14 rounded-2xl bg-black/40 px-3 py-2 text-center text-[13px] leading-snug font-extrabold text-white">{t('Pose le doigt pour verser, et lève-le : la théière monte avec. Garde le filet dans le verre.')}</div>
        )}
        {served && (
          <div className="animate-pop absolute inset-x-6 top-6 rounded-[20px] bg-white/95 p-3 text-center text-[var(--color-ink)]">
            <div className="font-display text-[22px] font-extrabold">{served.score} / 100</div>
            <div className="text-[13px] font-extrabold text-[var(--color-ink-soft)]">
              {t('Mousse')} <span className="text-[#e09a00]">{stars(served.foam)}</span> · {served.filled ? t('pile au trait') : served.over ? t('ça déborde !') : served.low ? t('pas assez rempli') : t('un peu trop')}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-2 p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
        <div className="h-3 overflow-hidden rounded-full bg-white/15">
          <div className="relative h-full rounded-full bg-[#c8641e]" style={{ width: `${Math.min(100, hud.fill * 100)}%` }} />
          <span className="relative -top-3 block h-3 w-[2px] bg-[#ffc233]" style={{ marginLeft: `${LINE * 100}%` }} />
        </div>
        <button className="btn !bg-[var(--color-emerald)] !px-6 !py-4 !text-base" disabled={!!served || s.fill < 0.4} onClick={serve}>
          {t('Servir')}
        </button>
      </div>
    </div>
  )
}

/* ---------- The scene ---------- */

const box = new THREE.BoxGeometry(1, 1, 1)
const cyl = new THREE.CylinderGeometry(1, 1, 1, 20)
const ENAMEL = new THREE.MeshLambertMaterial({ color: '#2f7fd0' })
const ENAMEL_DARK = new THREE.MeshLambertMaterial({ color: '#1b4f86' })
const BLACK = new THREE.MeshLambertMaterial({ color: '#1f2a44' })
const TEA = new THREE.MeshLambertMaterial({ color: '#8a3c12' })
const FOAM = new THREE.MeshLambertMaterial({ color: '#fbe9c6' })
const STREAM = new THREE.MeshLambertMaterial({ color: '#b65a1a' })
const GLASSM = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, depthWrite: false })
const TRAY = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.6, roughness: 0.35 })
const GOLD = new THREE.MeshBasicMaterial({ color: '#ffc233' })
const DROPS = 14
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const ray = new THREE.Raycaster()
const hit = new THREE.Vector3()
const ndcV = new THREE.Vector2()

function Tea({ st, glass, sway, served, onHud, onOver, scores }: { st: React.RefObject<State>; glass: number; sway: number; served: React.RefObject<boolean>; onHud: (h: { h: number; fill: number; pouring: boolean; zone: 'low' | 'foam' | 'high'; miss: boolean }) => void; onOver: () => void; scores: number[] }) {
  const { camera } = useThree()
  const pot = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const stream = useRef<THREE.Mesh>(null)
  const tea = useRef<THREE.Mesh>(null)
  const foam = useRef<THREE.Mesh>(null)
  const puddle = useRef<THREE.Mesh>(null)
  const drops = useRef<(THREE.Mesh | null)[]>([])
  const bubbles = useRef<(THREE.Mesh | null)[]>([])
  const dropV = useMemo(() => Array.from({ length: DROPS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })), [])
  const nextDrop = useRef(0)
  const sound = useRef(0)
  const shown = useRef({ h: -1, fill: -1, pouring: false, zone: '', miss: false })
  const pudd = useRef(0)
  useEffect(() => void (pudd.current = 0), [glass])
  useFrame(({ clock }, dt) => {
    const s = st.current
    if (!s) return
    const now = clock.elapsedTime
    // Where the hand wants the spout: under the finger (a little above it, so the finger doesn't hide it), or moved by the keys.
    if (s.ndc) {
      ray.setFromCamera(ndcV.set(s.ndc.x, s.ndc.y), camera)
      if (ray.ray.intersectPlane(plane, hit)) s.want.set(hit.x - 0.03, hit.y + 0.09, 0)
    } else if (s.keys.x || s.keys.y) s.want.set(s.want.x + s.keys.x * 0.4 * dt, s.want.y + s.keys.y * 0.6 * dt, 0)
    s.want.x = Math.max(-0.3, Math.min(0.32, s.want.x))
    s.want.y = Math.max(H + 0.05, Math.min(H + REACH + 0.05, s.want.y))
    // The hand follows quickly, not instantly: the weight of the teapot.
    s.tip.lerp(s.want, 1 - Math.exp(-18 * dt))
    s.h = Math.max(0, Math.min(1, (s.tip.y - H - 0.05) / REACH))
    const pouring = s.pouring && !served.current
    // The stream wavers, more the higher it falls (and glass after glass).
    const wave = (0.004 + 0.06 * s.h * s.h) * sway
    s.land = s.tip.x + Math.sin(now * 7.3) * wave + Math.sin(now * 12.1 + 1) * wave * 0.5
    s.inGlass = Math.abs(s.land) < R * 0.78
    const surface = Math.min(1, s.fill) * H * 0.96 + 0.01
    if (pouring) {
      if (s.inGlass) {
        s.fill += FILL * dt
        if (s.h >= ZONE[0] && s.h <= ZONE[1]) s.foam += 0.5 * dt
        else if (s.h < ZONE[0]) s.foam += 0.08 * (s.h / ZONE[0]) * dt
        else s.spill += 0.5 * dt
      } else {
        // On the tray, beside the glass: tea lost.
        s.spill += 0.35 * dt
        pudd.current = Math.min(1, pudd.current + dt * 0.8)
      }
      // The drops: splashing from high, or spilling on the tray.
      const splashy = !s.inGlass || s.h > ZONE[1]
      if (splashy || (s.h > ZONE[0] && Math.random() < 0.3)) {
        const d = dropV[nextDrop.current++ % DROPS]
        d.p.set(s.land, s.inGlass ? surface : 0.02, 0)
        d.v.set((Math.random() - 0.5) * (splashy ? 1.2 : 0.4), 0.6 + Math.random() * (splashy ? 1.0 : 0.4), (Math.random() - 0.5) * 0.6)
        d.life = 0.5
      }
      // The sound of it, higher as it fills.
      sound.current -= dt
      if (sound.current <= 0) {
        sfx.pour(Math.min(1, s.fill), s.h)
        sound.current = 0.11
      }
      if (s.fill >= 1.05) onOver()
    }
    // The teapot: at the hand, tipped when it pours.
    if (pot.current) pot.current.position.copy(s.tip)
    if (tilt.current) tilt.current.rotation.z += ((pouring ? -0.55 : -0.1) - tilt.current.rotation.z) * Math.min(1, dt * 14)
    // The stream, from the spout down to the tea (or the tray).
    if (stream.current) {
      stream.current.visible = pouring
      if (pouring) {
        const bottom = s.inGlass ? surface : 0.02
        const len = Math.max(0.01, s.tip.y - 0.01 - bottom)
        stream.current.position.set((s.tip.x + s.land) / 2, bottom + len / 2, 0)
        stream.current.scale.set(0.006 + 0.002 * Math.sin(now * 40), len, 0.006)
        stream.current.rotation.z = Math.atan2(s.tip.x - s.land, len) * -1
      }
    }
    // The glass's tea and its foam.
    const tl = Math.min(1, s.fill)
    const fh = Math.min(tl, Math.min(0.3, s.foam * 0.4))
    if (tea.current) {
      tea.current.visible = tl > 0.01
      tea.current.scale.set(R * 0.9, Math.max(0.001, (tl - fh) * H * 0.96), R * 0.9)
      tea.current.position.y = 0.006 + ((tl - fh) * H * 0.96) / 2
    }
    if (foam.current) {
      foam.current.visible = fh > 0.005
      foam.current.scale.set(R * 0.92, Math.max(0.001, fh * H * 0.96), R * 0.92)
      foam.current.position.y = 0.006 + (tl - fh) * H * 0.96 + (fh * H * 0.96) / 2
    }
    // Bubbles rising in the foam as it's made.
    bubbles.current.forEach((b, k) => {
      if (!b) return
      b.visible = pouring && s.inGlass && s.h > ZONE[0] * 0.7 && tl > 0.05
      if (b.visible) {
        const u = (now * 1.5 + k * 0.17) % 1
        b.position.set(Math.cos(k * 2.4) * R * 0.6, surface - 0.02 + u * 0.03, Math.sin(k * 2.4) * R * 0.6)
        b.scale.setScalar(0.006 * (1 - u) + 0.002)
      }
    })
    if (puddle.current) {
      puddle.current.visible = pudd.current > 0.02
      puddle.current.scale.set(0.05 + pudd.current * 0.12, 0.004, 0.04 + pudd.current * 0.08)
    }
    dropV.forEach((d, k) => {
      const m = drops.current[k]
      if (!m) return
      d.life -= dt
      m.visible = d.life > 0
      if (d.life > 0) {
        d.v.y -= 6 * dt
        d.p.addScaledVector(d.v, dt)
        m.position.copy(d.p)
      }
    })
    // The page's bits, when they change.
    const zone = s.h > ZONE[1] ? 'high' : s.h >= ZONE[0] ? 'foam' : 'low'
    const o = shown.current
    const h = Math.round(s.h * 50) / 50
    const fill = Math.round(s.fill * 50) / 50
    if (h !== o.h || fill !== o.fill || pouring !== o.pouring || zone !== o.zone || !s.inGlass !== o.miss) {
      shown.current = { h, fill, pouring, zone, miss: !s.inGlass }
      onHud({ h, fill, pouring, zone, miss: pouring && !s.inGlass })
    }
  })
  return (
    <group>
      {/* The low table and the tray, the stove behind, its coals glowing. */}
      <mesh geometry={box} position={[0, -0.04, 0]} scale={[2.4, 0.06, 1.2]}>
        <meshLambertMaterial color="#7a4a22" />
      </mesh>
      <mesh geometry={cyl} material={TRAY} position={[0.05, 0.0, 0]} scale={[0.42, 0.012, 0.3]} />
      <group position={[-0.5, 0, -0.35]}>
        <mesh geometry={box} position={[0, 0.08, 0]} scale={[0.26, 0.16, 0.26]}>
          <meshLambertMaterial color="#3b3f46" />
        </mesh>
        {[-0.07, 0, 0.07].map((x, k) => (
          <mesh key={k} geometry={box} position={[x, 0.18, (k - 1) * 0.04]} scale={[0.06, 0.04, 0.06]}>
            <meshBasicMaterial color={k === 1 ? '#ffb703' : '#e85d04'} />
          </mesh>
        ))}
      </group>
      {/* The glass on the tray: the glass itself, the line to fill to, the tea and its foam. */}
      <mesh geometry={cyl} material={GLASSM} position={[0, H / 2 + 0.006, 0]} scale={[R, H, R]} renderOrder={2} />
      <mesh position={[0, LINE * H * 0.96 + 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} material={GOLD}>
        <torusGeometry args={[R * 1.01, 0.002, 4, 24]} />
      </mesh>
      <mesh ref={tea} geometry={cyl} material={TEA} />
      <mesh ref={foam} geometry={cyl} material={FOAM} />
      {Array.from({ length: 6 }, (_, k) => (
        <mesh key={k} ref={(el) => void (bubbles.current[k] = el)} geometry={box} material={FOAM} />
      ))}
      <mesh ref={puddle} geometry={cyl} material={TEA} position={[0.12, 0.008, 0.02]} />
      {/* The glasses already served, lined up. */}
      {scores.map((_, k) => (
        <group key={k} position={[0.2 + k * 0.08, 0, 0.12]}>
          <mesh geometry={cyl} material={GLASSM} position={[0, 0.07, 0]} scale={[0.03, 0.14, 0.03]} />
          <mesh geometry={cyl} material={TEA} position={[0, 0.045, 0]} scale={[0.027, 0.08, 0.027]} />
          <mesh geometry={cyl} material={FOAM} position={[0, 0.1, 0]} scale={[0.027, 0.03, 0.027]} />
        </group>
      ))}
      {/* The stream of tea. */}
      <mesh ref={stream} geometry={cyl} material={STREAM} visible={false} />
      {Array.from({ length: DROPS }, (_, k) => (
        <mesh key={k} ref={(el) => void (drops.current[k] = el)} geometry={box} material={TEA} scale={0.012} visible={false} />
      ))}
      {/* The teapot, in blocks: blue enamel, the long spout to the right, the handle; its tip is where the hand holds it. */}
      <group ref={pot}>
        <group ref={tilt}>
          <group position={[-0.2, -0.06, 0]}>
            <mesh geometry={box} material={ENAMEL} position={[0, 0, 0]} scale={[0.2, 0.14, 0.16]} />
            <mesh geometry={box} material={ENAMEL} position={[0, 0.09, 0]} scale={[0.15, 0.05, 0.12]} />
            <mesh geometry={box} material={ENAMEL_DARK} position={[0, 0.125, 0]} scale={[0.1, 0.025, 0.09]} />
            <mesh geometry={box} material={BLACK} position={[0, 0.15, 0]} scale={[0.03, 0.025, 0.03]} />
            <mesh geometry={box} material={ENAMEL_DARK} position={[0, -0.075, 0]} scale={[0.17, 0.02, 0.13]} />
            {/* The spout, rising to its tip. */}
            <mesh geometry={box} material={ENAMEL} position={[0.12, -0.01, 0]} scale={[0.06, 0.035, 0.035]} rotation={[0, 0, 0.5]} />
            <mesh geometry={box} material={ENAMEL} position={[0.165, 0.025, 0]} scale={[0.05, 0.028, 0.028]} rotation={[0, 0, 0.7]} />
            <mesh geometry={box} material={ENAMEL_DARK} position={[0.195, 0.055, 0]} scale={[0.025, 0.022, 0.022]} />
            {/* The handle. */}
            <mesh geometry={box} material={BLACK} position={[-0.12, 0.02, 0]} scale={[0.025, 0.1, 0.025]} />
            <mesh geometry={box} material={BLACK} position={[-0.1, 0.075, 0]} scale={[0.05, 0.02, 0.02]} />
            <mesh geometry={box} material={BLACK} position={[-0.1, -0.035, 0]} scale={[0.05, 0.02, 0.02]} />
          </group>
        </group>
      </group>
    </group>
  )
}
