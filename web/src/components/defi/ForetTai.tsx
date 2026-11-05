import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { sceneDpr } from '../../lib/device'
import { Blocks } from '../../world3d/open/ruePrincesse'
import { CHIMP, DUIKER, Flock, Herd, MONKEY, PYGMY_HIPPO, chimpBrain, grazer, makeHerd, type Animal, type Brain, type Species } from '../../world3d/open/wildlife'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { JuiceHud, juice, shakeRef, snd } from './jeux/juice'
import { rng } from '../../world3d/themes'
import { t as tr } from '../../lib/i18n'

// A day in the Parc national de Taï (the update « sanpedro-vivant », backend game/villes2.go TaiTrip): by the
// ecotourism of Djouroutou, on foot behind the tracker along the forest path, under the giant trees with
// their buttress roots and their lianas. The chimpanzees of Taï crack the panda nuts with stones on a root:
// the knocking is heard before they're seen. Further on, the diana monkeys in the canopy, a duiker on the
// path, and by the stream the pygmy hippo, the forest's shyest. Drag to turn the head, « Photo ! » when it's
// in the frame. Quietly: a sharp turn rustles the leaves and every head comes round (the photo's worth
// less); when the tracker raises his hand (« Chut ! »), keep still. The score: each species well taken
// once, the chimp cracking its nut worth the most.

const TIME = 60
const SPEED = 1.7
const EYE = 1.65
const SHOTS = 10
/** What makes a full score: the best photos' worth added up (the chimp cracking counts 1.6). */
const FULL = 3.8

/** The path through the forest: it winds, crosses the stream at the end. */
const PATH: [number, number][] = [[0, 40], [6, 20], [-4, 0], [5, -22], [-6, -44], [2, -66], [10, -86], [0, -108]]
/** The stream across the path's far end (z). */
const STREAM_Z = -98
/** The clearings round the animals (the chimps' roots, the duiker's, the hippo's bank): no bush between them and the path. */
const CLEAR: [number, number][] = [[-6, 0], [-1, 1], [-5, -58], [6, STREAM_Z + 1.5]]

type Group = { key: string; name: string; species: Species; animals: Animal[]; centre: { x: number; z: number }; worth: number }
type Live = { d: number; yaw: number; pitch: number; t: number; flash: number; noise: number; hush: number; scare: number }

/** Along the path (metres): the point and the heading. */
function along(d: number) {
  let k = Math.max(0, d)
  for (let i = 1; i < PATH.length; i++) {
    const [a, b] = [PATH[i - 1], PATH[i]]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (k <= l || i === PATH.length - 1) {
      const u = Math.min(1, k / l)
      return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, h: Math.atan2(b[1] - a[1], b[0] - a[0]) }
    }
    k -= l
  }
  return { x: PATH[0][0], z: PATH[0][1], h: -Math.PI / 2 }
}
const PATH_LEN = PATH.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - PATH[i - 1][0], p[1] - PATH[i - 1][1]) : 0), 0)

/** The walker's head on the path, turned where the player looks; the tracker a few steps ahead. */
function Rig({ live, tracker }: { live: { current: Live }; tracker: { current: THREE.Group | null } }) {
  const { camera } = useThree()
  useFrame((_, dt0) => {
    const dt = Math.min(0.25, dt0)
    const l = live.current
    l.t += dt
    // The tracker stops when he hushes: one waits with him.
    if (l.hush <= 0) l.d = Math.min(PATH_LEN - 6, l.d + SPEED * dt)
    const p = along(l.d)
    const bob = Math.sin(l.t * 6) * (l.hush > 0 ? 0 : 0.035)
    camera.position.set(p.x, EYE + bob, p.z)
    const h = p.h + l.yaw
    camera.lookAt(p.x + Math.cos(h) * 10, EYE + l.pitch * 10, p.z + Math.sin(h) * 10)
    const q = along(l.d + 4.5)
    if (tracker.current) {
      tracker.current.position.set(q.x, 0, q.z)
      tracker.current.rotation.y = -q.h + Math.PI / 2
    }
    l.flash = Math.max(0, l.flash - dt * 3)
    l.noise = Math.max(0, l.noise - dt * 0.35)
    l.scare = Math.max(0, l.scare - dt)
    if (l.hush > 0) l.hush -= dt
  })
  return null
}

const segDist = (x: number, z: number) =>
  PATH.reduce((m, b, i) => {
    if (!i) return m
    const a = PATH[i - 1]
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
    const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
    return Math.min(m, Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k))
  }, Infinity)

/** The rainforest: the giant trees and their buttresses, the lianas, the palms of the understorey, the leaf litter, the stream. */
function Forest() {
  const f = useMemo(() => {
    const r = rng('tai-foret')
    type B = { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }
    const trunks: B[] = []
    const crowns: B[] = []
    const under: B[] = []
    for (let i = 0; i < 70; i++) {
      const x = (r() - 0.5) * 120
      const z = 50 - r() * 175
      const off = segDist(x, z)
      if (off < 4 || CLEAR.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 6)) continue
      const giant = r() < 0.35
      const h = giant ? 26 + r() * 16 : 10 + r() * 10
      const w = giant ? 1.4 + r() * 0.8 : 0.5 + r() * 0.4
      trunks.push({ p: [x, h / 2, z], s: [w, h, w], c: giant ? '#9c8f7a' : '#6e5b48' })
      if (giant)
        // The buttress roots: thin walls fanning out at the foot.
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + r()
          trunks.push({ p: [x + Math.cos(a) * w * 0.9, 1.4, z + Math.sin(a) * w * 0.9], s: [w * 1.6, 2.8, 0.25], ry: -a, c: '#8d806b' })
        }
      const R = giant ? 9 + r() * 6 : 4 + r() * 3
      crowns.push({ p: [x, h + 1, z], s: [R * 1.6, giant ? 3.2 : 2.4, R * 1.6], ry: r() * 3, c: ['#2f5d2a', '#3a6b2e', '#27502a', '#44763a'][Math.floor(r() * 4)] })
      if (giant) crowns.push({ p: [x + (r() - 0.5) * 6, h - 2, z + (r() - 0.5) * 6], s: [R, 2, R], ry: r() * 3, c: '#2c5627' })
      // A liana hanging from it.
      if (r() < 0.5) trunks.push({ p: [x + 2, h * 0.55, z + 1], s: [0.12, h * 0.9, 0.12], c: '#4f5a2c' })
    }
    // The understorey: young palms, ferns, shrubs, close to the path.
    for (let i = 0; i < 360; i++) {
      const x = (r() - 0.5) * 90
      const z = 48 - r() * 165
      const off = segDist(x, z)
      // The clearings where the animals are, and the view to them from the path, kept open.
      if (off < 1.8 || Math.abs(z - STREAM_Z) < 3 || CLEAR.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 9)) continue
      const tall = r() < 0.3
      under.push({ p: [x, tall ? 1.4 : 0.4, z], s: tall ? [2.2, 0.25, 0.7] : [0.8 + r() * 0.8, 0.5 + r() * 0.5, 0.8 + r() * 0.8], ry: r() * 3, c: ['#3f7a35', '#2f6a30', '#55893f', '#33602d', '#6a8f3e'][Math.floor(r() * 5)] })
      if (tall) under.push({ p: [x, 0.7, z], s: [0.12, 1.4, 0.12], c: '#5a5030' })
    }
    // The path: packed brown earth, leaves on it.
    const path = PATH.slice(1).map((b, i) => {
      const a = PATH[i]
      return { p: [(a[0] + b[0]) / 2, 0.02, (a[1] + b[1]) / 2] as [number, number, number], s: [Math.hypot(b[0] - a[0], b[1] - a[1]) + 2, 0.03, 1.8] as [number, number, number], ry: -Math.atan2(b[1] - a[1], b[0] - a[0]), c: '#6b4a2e' }
    })
    const stream = [...Array(14)].map((_, i) => ({ p: [-60 + i * 9, 0.03, STREAM_Z + Math.sin(i) * 1.5] as [number, number, number], s: [9.6, 0.04, 5] as [number, number, number], c: '#4d6f5e' }))
    // The nut-cracking roots, the stones, the broken shells round them.
    const anvils: [number, number][] = [[-7, -2], [-9.5, 2.5]]
    const stones = anvils.flatMap(([x, z]) => [
      { p: [x, 0.18, z] as [number, number, number], s: [1.2, 0.36, 0.7] as [number, number, number], ry: 0.4, c: '#7a5a3a' },
      { p: [x + 0.4, 0.42, z + 0.2] as [number, number, number], s: [0.25, 0.14, 0.2] as [number, number, number], c: '#8c8478' },
      { p: [x - 0.5, 0.05, z + 0.5] as [number, number, number], s: [0.5, 0.05, 0.4] as [number, number, number], c: '#a88a5a' },
    ])
    // The big branch the diana monkeys sit along, under its crown.
    stones.push({ p: [9, 8.75, -30], s: [12, 0.5, 6], ry: 0.2, c: '#6e5b48' }, { p: [4, 4.4, -31], s: [0.9, 8.8, 0.9], c: '#7a6852' })
    crowns.push({ p: [8, 13, -30], s: [16, 3, 12], ry: 0.3, c: '#2f5d2a' })
    return { trunks, crowns, under, path, stream, anvils, stones }
  }, [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]}>
        <planeGeometry args={[260, 260]} />
        <meshLambertMaterial color="#3d4a2a" />
      </mesh>
      <Blocks at={f.path} material={mat} color />
      <Blocks at={f.stream} material={mat} color />
      <Blocks at={f.stones} material={mat} color />
      <Blocks at={f.trunks} material={mat} color />
      <Blocks at={f.crowns} material={mat} color />
      <Blocks at={f.under} material={mat} color />
    </group>
  )
}

const V = new THREE.Vector3()
const TAI_ANVILS: [number, number][] = [[-7, -2], [-9.5, 2.5]]

export function ForetTaiDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const live = useRef<Live>({ d: 0, yaw: 0, pitch: 0.02, t: 0, flash: 0, noise: 0, hush: 0, scare: 0 })
  const tracker = useRef<THREE.Group>(null)
  const groups = useMemo<Group[]>(() => {
    const at = (name: string, n: number, x: number, z: number, spread: number, sp: Species, key: string, label: string, worth: number, y = 0) => ({ key, name: label, species: sp, animals: makeHerd(`tai-${name}`, n, [x, z], spread, [0.9, 1.1], y), centre: { x, z }, worth })
    return [
      at('chimps', 6, -8, 0, 3, CHIMP, 'chimp', tr('les chimpanzés'), 1.2),
      at('dianes', 5, 9, -30, 3, MONKEY, 'monkey', tr('les singes dianes'), 0.8, 9),
      at('cephalophe', 2, -5, -58, 3, DUIKER, 'duiker', tr('le céphalophe'), 0.8),
      at('hippo', 1, 6, STREAM_Z + 1.5, 1, PYGMY_HIPPO, 'hippo', tr('l’hippopotame pygmée'), 1.2),
    ]
  }, [])
  const brains = useMemo<Brain[]>(
    () =>
      groups.map((g) => {
        const base = grazer(g.centre, g.species === CHIMP ? 4 : 5)
        if (g.species === CHIMP) return chimpBrain(TAI_ANVILS, base, () => live.current.scare > 0)
        return ((a, dt, t, sp) => {
          if (live.current.scare > 0 && a.mode !== 'look' && a.mode !== 'run') ((a.mode = 'look'), (a.t = 2.5))
          base(a, dt, t, sp)
        }) as Brain
      }),
    [groups],
  )
  const guide = useMemo(() => ({ ...randomLook('homme', rng('tai-pisteur')), outfit: 'uniforme', outfitColor: '#4f5e36' }), [])
  const [shots, setShots] = useState(SHOTS)
  const [left, setLeft] = useState(TIME)
  const [call, setCall] = useState<string>(tr('Le pisteur : « On marche doucement, on écoute la forêt. »'))
  const [got, setGot] = useState<string[]>([])
  const [noise, setNoise] = useState(0)
  const [hush, setHush] = useState(false)
  const st = useRef({ shots: SHOTS, clock: TIME, done: false, got: new Map<string, number>(), target: '', nextHush: 9 + Math.random() * 6, cracked: false })
  const camRef = useRef<THREE.Camera | null>(null)
  const finish = () => {
    if (st.current.done) return
    st.current.done = true
    const total = [...st.current.got.values()].reduce((s, q) => s + q, 0)
    const score = Math.round(Math.min(100, (total / FULL) * 100))
    const n = st.current.got.size
    juice.finish(score, n ? (st.current.cracked ? tr('{0} espèces, et le casse-noix !', { 0: n }) : tr('{0} espèces dans la boîte', { 0: n })) : tr('La forêt s’est cachée…'), onEnd)
  }
  // Every half-second: the clock, the tracker's calls as the path comes by each group, his hush now and then.
  useEffect(() => {
    const k = setInterval(() => {
      const s = st.current
      if (s.done) return
      s.clock -= 0.5
      setLeft(Math.max(0, Math.ceil(s.clock)))
      setNoise(live.current.noise)
      setHush(live.current.hush > 0)
      if (s.clock <= 0 || live.current.d >= PATH_LEN - 6.5) return finish()
      const elapsed = TIME - s.clock
      if (elapsed > s.nextHush && live.current.hush <= 0) {
        live.current.hush = 3
        s.nextHush = elapsed + 12 + Math.random() * 8
        setCall(tr('Le pisteur lève la main : « Chut… ne bouge plus. »'))
        snd.tick(0.2)
        return
      }
      const p = along(live.current.d)
      let best: Group | null = null
      let bd = Infinity
      for (const g of groups) {
        const d = Math.hypot(g.centre.x - p.x, g.centre.z - p.z)
        if (d < bd) (bd = d), (best = g)
      }
      if (best && bd < 26 && s.target !== best.key) {
        s.target = best.key
        const side = Math.sin(Math.atan2(best.centre.z - p.z, best.centre.x - p.x) - p.h) > 0 ? tr('à droite') : tr('à gauche')
        setCall(best.species === CHIMP ? tr('Tu entends ? Toc… toc… Les chimpanzés cassent des noix, {0} !', { 0: side }) : best.species === MONKEY ? tr('Là-haut, {0} : les singes dianes !', { 0: side }) : tr('Là, {0}, {1} !', { 0: best.name, 1: side }))
        snd.tick(0.5)
      }
    }, 500)
    return () => clearInterval(k)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const photo = () => {
    const s = st.current
    if (s.done || s.shots <= 0) return
    s.shots--
    setShots(s.shots)
    live.current.flash = 1
    snd.shutter()
    haptic('medium')
    const cam = camRef.current
    let best: { g: Group; q: number; crack: boolean } | null = null
    if (cam)
      for (const g of groups)
        for (const a of g.animals) {
          V.set(a.x, a.y + 0.8 * a.scale, a.z)
          const dist = V.distanceTo(cam.position)
          V.project(cam)
          if (V.z > 1 || dist > 40) continue
          const off = Math.hypot(V.x, V.y)
          if (off > 0.34) continue
          // Looking up at the noise, it's a lesser photo.
          const calm = a.mode === 'look' ? 0.7 : 1
          const crack = a.mode === 'crack'
          const q = ((1 - off / 0.34) * 0.6 + Math.max(0, 1 - dist / 40) * 0.4) * calm * g.worth * (crack ? 1.35 : 1)
          if (!best || q > best.q) best = { g, q, crack }
        }
    if (best) {
      const before = s.got.get(best.g.key) ?? 0
      s.got.set(best.g.key, Math.max(before, best.q))
      if (best.crack) s.cracked = true
      setGot([...s.got.keys()])
      if (best.crack) juice.good({ text: tr('Le casse-noix, en plein dedans !'), perfect: true })
      else if (best.q > 0.75) juice.good({ text: tr('Superbe : {0} !', { 0: best.g.name }), perfect: true })
      else juice.good({ text: tr('Photo : {0}', { 0: best.g.name }) })
    } else juice.bad({ text: tr('Des feuilles…'), soft: true })
    if (s.shots <= 0) setTimeout(finish, 700)
  }
  const rustle = (amount: number) => {
    const l = live.current
    l.noise = Math.min(1.4, l.noise + amount * (l.hush > 0 ? 3 : 1))
    if (l.noise > 1 && l.scare <= 0) {
      l.scare = 2.5
      l.noise = 0.6
      juice.bad({ text: tr('Crac ! Une branche…'), soft: true })
      haptic('error')
      setCall(tr('Le pisteur se retourne, le doigt sur la bouche.'))
    }
  }
  const drag = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const l = live.current
      if (e.code === 'Space' || e.key === 'Enter') return e.preventDefault(), photo()
      if (e.key === 'ArrowLeft') (e.preventDefault(), (l.yaw -= 0.07), rustle(0.04))
      if (e.key === 'ArrowRight') (e.preventDefault(), (l.yaw += 0.07), rustle(0.04))
      if (e.key === 'ArrowUp') (e.preventDefault(), (l.pitch = Math.min(0.9, l.pitch + 0.04)))
      if (e.key === 'ArrowDown') (e.preventDefault(), (l.pitch = Math.max(-0.4, l.pitch - 0.04)))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const [flash, setFlash] = useState(0)
  useEffect(() => {
    let raf = 0
    let last = 0
    const loop = () => {
      const f = live.current.flash
      if (f !== last) setFlash((last = f))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (import.meta.env.DEV)
    Object.assign(globalThis, {
      __tai: {
        live: live.current,
        photo,
        groups,
        aim: () => {
          const p = along(live.current.d)
          const a = groups.flatMap((g) => g.animals).reduce((b, x) => (Math.hypot(x.x - p.x, x.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? x : b))
          live.current.yaw = Math.atan2(a.z - p.z, a.x - p.x) - p.h
          live.current.pitch = Math.atan2(a.y + 0.6 - EYE, Math.hypot(a.x - p.x, a.z - p.z))
        },
      },
    })
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
      <div
        ref={shakeRef}
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY }
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const l = live.current
          const dx = e.clientX - d.x
          l.yaw += dx * 0.006
          l.pitch = Math.max(-0.4, Math.min(0.9, l.pitch - (e.clientY - d.y) * 0.004))
          // A sharp turn rustles the leaves.
          if (Math.abs(dx) > 18) rustle(Math.abs(dx) / 260)
          drag.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <Canvas dpr={sceneDpr} camera={{ position: [0, EYE, 40], fov: 60, near: 0.2, far: 260 }} onCreated={({ camera }) => (camRef.current = camera)} style={{ background: '#6f8f6a' }}>
          <fog attach="fog" args={['#7d9873', 22, 120]} />
          <hemisphereLight args={['#f2fae0', '#4a4a2c', 1.6]} />
          <directionalLight position={[20, 60, 10]} intensity={0.9} color="#fff4d0" />
          <Rig live={live} tracker={tracker} />
          <Forest />
          {groups.map((g, i) => (
            <Herd key={g.key} species={g.species} animals={g.animals} brain={brains[i]} far={90} />
          ))}
          <Flock centre={[0, -40]} radius={18} height={22} color="#2a2624" seed="tai-calaos" n={6} />
          <group ref={tracker}>
            <NoShadows>
              <LowHuman look={guide} gender="homme" pose={hush ? 'wave' : 'walk'} seed={3} />
            </NoShadows>
          </group>
        </Canvas>
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[34vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white/80 shadow-[0_0_0_2000px_rgba(0,0,0,0.14)]" />
        <div className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: flash * 0.8 }} />
        <JuiceHud goal={tr('Sans bruit… et photographie !')} />
      </div>
      <div className="card relative w-full max-w-[440px] px-4 py-2 text-center">
        <div className="font-display text-[16px] leading-tight font-extrabold">{call}</div>
        <div className="mt-1 flex items-center gap-2 text-[12.5px] font-extrabold text-[var(--color-orange)]">
          <span className="shrink-0">{tr('{0} photos · {1} s · {2} espèces', { 0: shots, 1: left, 2: got.length })}</span>
          <span className="ml-auto shrink-0 text-[var(--color-ink-soft)]">{tr('Bruit')}</span>
          <span className="h-2 w-16 overflow-hidden rounded-full bg-black/10">
            <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, noise * 100)}%`, background: noise > 0.7 ? '#e03131' : '#2f9e44' }} />
          </span>
        </div>
      </div>
      <div className="relative flex w-full max-w-[440px] gap-2">
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" disabled={shots <= 0} onPointerDown={(e) => (e.preventDefault(), photo())}>
          {tr('Photo !')}
        </button>
      </div>
    </div>
  )
}
