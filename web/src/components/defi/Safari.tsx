import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { sceneDpr } from '../../lib/device'
import { Blocks } from '../../world3d/open/ruePrincesse'
import { SafariTruck } from '../../world3d/open/nziReserve'
import { BUFFALO, ELEPHANT, Flock, HIPPO, Herd, KOB_SPECIES, MONKEY, grazer, hippoBrain, makeHerd, type Animal, type Brain, type Species } from '../../world3d/open/wildlife'
import { JuiceHud, juice, shakeRef, snd } from './jeux/juice'
import { rng } from '../../world3d/themes'
import { t as tr } from '../../lib/i18n'

// The safari in the Réserve de la N'Zi (the update « bouake-vivant », backend game/villes.go): by 4x4 (the
// game drive) or on foot behind the tracker. The truck rolls along the laterite track through the tall
// grass and the rôniers; the guide calls what he sees (« Les éléphants, à gauche ! »). Drag to turn and
// look, « Photo ! » when it's in the frame: well framed and close, it's a good one. On foot it goes
// slower, the animals nearer, and a sharp turn of the head makes them look up. The score: the species
// photographed well, each once, out of those the guide called.

type Mode = '4x4' | 'pied'
const TIME = { '4x4': 55, pied: 50 }
const SPEED = { '4x4': 7, pied: 3.2 }
const EYE = { '4x4': 3.9, pied: 1.7 }
/** Where along the loop it starts (on foot, nearer the buffalo and the river), and how many species make a full score. */
const START = { '4x4': 0, pied: 110 }
const FULL = { '4x4': 4.2, pied: 3 }
const SHOTS = 9

/** The track: a loop through the savanna, by the river at the back. */
const ROUTE: [number, number][] = [[0, 60], [30, 30], [60, -10], [40, -60], [-10, -80], [-60, -60], [-80, -10], [-50, 40]]
/** The river's line across the back. */
const RIVER_Z = (x: number) => -112 + Math.sin(x / 40) * 8

type Group = { key: string; name: string; side?: string; species: Species; animals: Animal[]; centre: { x: number; z: number } }

/** Where along the loop (metres), the point and the heading. */
function along(d: number) {
  const segs = ROUTE.map((p, i) => [p, ROUTE[(i + 1) % ROUTE.length]] as const)
  const total = segs.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0)
  let k = ((d % total) + total) % total
  for (const [a, b] of segs) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (k <= l) {
      const u = k / l
      return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, h: Math.atan2(b[1] - a[1], b[0] - a[0]) }
    }
    k -= l
  }
  return { x: ROUTE[0][0], z: ROUTE[0][1], h: 0 }
}

type Live = { d: number; yaw: number; pitch: number; t: number; flash: number; scare: number }

/** The camera on the truck (or the walker's head), turned where the player looks; the truck under it. */
function Rig({ live, mode, truck }: { live: { current: Live }; mode: Mode; truck: { current: THREE.Group | null } }) {
  const { camera } = useThree()
  useFrame((_, dt0) => {
    // (Real time, even on a slow phone: the drive keeps its pace with the clock.)
    const dt = Math.min(0.25, dt0)
    const l = live.current
    l.t += dt
    l.d += SPEED[mode] * dt
    const p = along(l.d)
    const sway = mode === 'pied' ? Math.sin(l.t * 5) * 0.04 : Math.sin(l.t * 7) * 0.03
    camera.position.set(p.x, EYE[mode] + sway, p.z)
    const h = p.h + l.yaw
    camera.lookAt(p.x + Math.cos(h) * 10, EYE[mode] + l.pitch * 10, p.z + Math.sin(h) * 10)
    if (truck.current) {
      truck.current.position.set(p.x - Math.cos(p.h) * 0.6, 0, p.z - Math.sin(p.h) * 0.6)
      truck.current.rotation.y = -p.h
    }
    l.flash = Math.max(0, l.flash - dt * 3)
    l.scare = Math.max(0, l.scare - dt)
  })
  return null
}

/** The savanna round the loop: the dry grass, the river and its banks, the trees, the termite mounds, the track. */
function Savanna() {
  const flora = useMemo(() => {
    const r = rng('safari-savane')
    const trunks: { p: [number, number, number]; s: [number, number, number]; c: string }[] = []
    const crowns: { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }[] = []
    const tufts: { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }[] = []
    const nearTrack = (x: number, z: number) => ROUTE.some((a, i) => {
      const b = ROUTE[(i + 1) % ROUTE.length]
      const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
      const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
      return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k) < 6
    })
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * 300
      const z = (r() - 0.5) * 260
      if (nearTrack(x, z) || z < RIVER_Z(x) + 10) continue
      const palm = r() < 0.4
      const h = palm ? 9 + r() * 5 : 4 + r() * 4
      trunks.push({ p: [x, h / 2, z], s: [0.5, h, 0.5], c: palm ? '#8a7a64' : '#6e5640' })
      if (palm) for (let k = 0; k < 5; k++) crowns.push({ p: [x, h, z], s: [4.2, 0.25, 1.1], ry: (k / 5) * Math.PI, c: '#5d8a3a' })
      else crowns.push({ p: [x, h + 0.6, z], s: [6 + r() * 4, 1.6, 6 + r() * 4], ry: r() * 3, c: ['#6f8d3a', '#5d7f33', '#7c9a45'][Math.floor(r() * 3)] })
    }
    for (let i = 0; i < 420; i++) {
      const x = (r() - 0.5) * 300
      const z = (r() - 0.5) * 260
      if (nearTrack(x, z) || z < RIVER_Z(x) + 6) continue
      tufts.push({ p: [x, 0.5, z], s: [0.6 + r() * 0.8, 0.6 + r() * 1.1, 0.6 + r() * 0.8], ry: r() * 3, c: ['#c9b26a', '#b39b52', '#d6c27c', '#9f9a4f'][Math.floor(r() * 4)] })
    }
    const track = ROUTE.map((a, i) => {
      const b = ROUTE[(i + 1) % ROUTE.length]
      return { p: [(a[0] + b[0]) / 2, 0.03, (a[1] + b[1]) / 2] as [number, number, number], s: [Math.hypot(b[0] - a[0], b[1] - a[1]) + 4, 0.04, 4] as [number, number, number], ry: -Math.atan2(b[1] - a[1], b[0] - a[0]), c: '#b5653a' }
    })
    const river = [...Array(30)].map((_, i) => {
      const x = -180 + i * 12.4
      return { p: [x, 0.04, RIVER_Z(x)] as [number, number, number], s: [13, 0.04, 22] as [number, number, number], c: '#4c7f74' }
    })
    return { trunks, crowns, tufts, track, river }
  }, [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]}>
        <planeGeometry args={[600, 520]} />
        <meshLambertMaterial color="#b7a35c" />
      </mesh>
      <Blocks at={flora.track} material={mat} color />
      <Blocks at={flora.river} material={mat} color />
      <Blocks at={flora.trunks} material={mat} color />
      <Blocks at={flora.crowns} material={mat} color />
      <Blocks at={flora.tufts} material={mat} color />
    </group>
  )
}

const V = new THREE.Vector3()

export function SafariDefi({ mode = '4x4', onEnd }: { mode?: Mode; onEnd: (score: number) => void }) {
  const live = useRef<Live>({ d: START[mode], yaw: Math.PI / 2, pitch: -0.05, t: 0, flash: 0, scare: 0 })
  const truck = useRef<THREE.Group>(null)
  // The herds, each by its stretch of the track (the guide calls them as the truck comes by).
  const groups = useMemo<Group[]>(() => {
    const at = (name: string, n: number, x: number, z: number, spread: number, sp: Species, key: string, label: string) => {
      const centre = { x, z }
      return { key, name: label, species: sp, animals: makeHerd(`safari-${name}`, n, [x, z], spread), centre }
    }
    return [
      at('kobs', 10, 45, 40, 7, KOB_SPECIES, 'kob', tr('les kobs')),
      at('buffles', 8, 85, -20, 7, BUFFALO, 'buffalo', tr('les buffles')),
      at('elephants', 5, 18, -106, 9, ELEPHANT, 'elephant', tr('les éléphants')),
      at('hippos', 3, -40, -110, 6, HIPPO, 'hippo', tr('les hippopotames')),
      at('singes', 8, -95, -30, 5, MONKEY, 'monkey', tr('les singes verts')),
      at('kobs2', 7, -75, 50, 6, KOB_SPECIES, 'kob2', tr('les kobs')),
    ]
  }, [])
  const brains = useMemo(
    () =>
      groups.map((g) => {
        const base = g.species === HIPPO ? hippoBrain((x, z) => [Math.max(-70, Math.min(-10, x)), Math.max(RIVER_Z(x) - 8, Math.min(RIVER_Z(x) + 6, z))]) : grazer(g.centre, 9)
        // A sharp turn of the head on foot: every head comes up, looking (and the photo waits).
        return ((a, dt, t, sp) => {
          if (live.current.scare > 0 && a.mode !== 'look' && g.species !== HIPPO) ((a.mode = 'look'), (a.t = 2.5))
          base(a, dt, t, sp)
        }) as Brain
      }),
    [groups],
  )
  // On foot, the herds are nearer the track.
  useState(() => {
    if (mode !== 'pied') return
    groups.forEach((g) => {
      if (g.species === HIPPO) return
      const p = ROUTE.reduce((best, q) => (Math.hypot(q[0] - g.centre.x, q[1] - g.centre.z) < Math.hypot(best[0] - g.centre.x, best[1] - g.centre.z) ? q : best), ROUTE[0])
      g.centre.x = (g.centre.x + p[0]) / 2
      g.centre.z = (g.centre.z + p[1]) / 2
      g.animals.forEach((a) => ((a.x = g.centre.x + a.ox), (a.z = g.centre.z + a.oz)))
    })
  })
  const [shots, setShots] = useState(SHOTS)
  const [left, setLeft] = useState(TIME[mode])
  const [call, setCall] = useState<string>(tr('Ouvre l’œil, on part !'))
  const [got, setGot] = useState<string[]>([])
  const st = useRef({ shots: SHOTS, clock: TIME[mode], done: false, got: new Map<string, number>(), called: new Set<string>(), target: '' as string })
  const camRef = useRef<THREE.Camera | null>(null)
  const finish = () => {
    if (st.current.done) return
    st.current.done = true
    const species = new Map<string, number>()
    for (const [k, q] of st.current.got) {
      const base = k.replace(/2$/, '')
      species.set(base, Math.max(species.get(base) ?? 0, q))
    }
    const total = [...species.values()].reduce((s, q) => s + q, 0)
    const score = Math.round(Math.min(100, (total / FULL[mode]) * 100))
    juice.finish(score, species.size ? tr('{0} espèces dans la boîte', { 0: species.size }) : tr('Rien dans l’appareil…'), onEnd)
  }
  // Every half-second: the herd nearest ahead, called by the guide; the clock.
  useEffect(() => {
    const k = setInterval(() => {
      if (st.current.done) return
      st.current.clock -= 0.5
      setLeft(Math.max(0, Math.ceil(st.current.clock)))
      if (st.current.clock <= 0) return finish()
      const p = along(live.current.d)
      let best: Group | null = null
      let bd = Infinity
      for (const g of groups) {
        const d = Math.hypot(g.centre.x - p.x, g.centre.z - p.z)
        if (d < bd) (bd = d), (best = g)
      }
      if (best && bd < 70 && st.current.target !== best.key) {
        st.current.target = best.key
        st.current.called.add(best.key)
        // Which side: left or right of the way it's going.
        const side = Math.sin(Math.atan2(best.centre.z - p.z, best.centre.x - p.x) - p.h) > 0 ? tr('à droite') : tr('à gauche')
        setCall(tr('Là, {0}, {1} !', { 0: best.name, 1: side }))
        snd.tick(0.5)
      }
    }, 500)
    return () => clearInterval(k)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const photo = () => {
    if (st.current.done || st.current.shots <= 0) return
    st.current.shots--
    setShots(st.current.shots)
    live.current.flash = 1
    snd.shutter()
    haptic('medium')
    const cam = camRef.current
    // In the frame: the animal nearest the middle of the screen, in front, near enough.
    let best: { g: Group; q: number } | null = null
    if (cam)
      for (const g of groups)
        for (const a of g.animals) {
          V.set(a.x, a.y + 1.2 * a.scale, a.z)
          const dist = V.distanceTo(cam.position)
          V.project(cam)
          if (V.z > 1 || dist > 75) continue
          const off = Math.hypot(V.x, V.y)
          if (off > 0.32) continue
          const q = (1 - off / 0.32) * 0.6 + Math.max(0, 1 - dist / 75) * 0.4
          if (!best || q > best.q) best = { g, q }
        }
    if (best) {
      const before = st.current.got.get(best.g.key) ?? 0
      st.current.got.set(best.g.key, Math.max(before, best.q))
      setGot([...new Set([...st.current.got.keys()].map((k) => k.replace(/2$/, '')))])
      if (best.q > 0.7) juice.good({ text: tr('Superbe : {0} !', { 0: best.g.name }), perfect: true })
      else juice.good({ text: tr('Photo : {0}', { 0: best.g.name }) })
    } else juice.bad({ text: tr('Rien dans le cadre…'), soft: true })
    if (st.current.shots <= 0) setTimeout(finish, 700)
  }
  // Dragging turns the head; a sharp turn on foot makes the animals look up.
  const drag = useRef<{ x: number; y: number; t: number } | null>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const l = live.current
      if (e.code === 'Space' || e.key === 'Enter') return e.preventDefault(), photo()
      if (e.key === 'ArrowLeft') (e.preventDefault(), (l.yaw -= 0.08))
      if (e.key === 'ArrowRight') (e.preventDefault(), (l.yaw += 0.08))
      if (e.key === 'ArrowUp') (e.preventDefault(), (l.pitch = Math.min(0.4, l.pitch + 0.03)))
      if (e.key === 'ArrowDown') (e.preventDefault(), (l.pitch = Math.max(-0.3, l.pitch - 0.03)))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const [flash, setFlash] = useState(0)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      setFlash(live.current.flash)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  if (import.meta.env.DEV)
    Object.assign(globalThis, {
      __safari: {
        live: live.current,
        photo,
        groups,
        // (For tests: the head turned to the nearest herd's first animal.)
        aim: () => {
          const p = along(live.current.d)
          const a = groups.flatMap((g) => g.animals).reduce((b, x) => (Math.hypot(x.x - p.x, x.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? x : b))
          live.current.yaw = Math.atan2(a.z - p.z, a.x - p.x) - p.h
          live.current.pitch = -0.04
        },
      },
    })
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
      <div
        ref={shakeRef}
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, t: performance.now() }
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const l = live.current
          const dx = e.clientX - d.x
          l.yaw += dx * 0.006
          l.pitch = Math.max(-0.3, Math.min(0.4, l.pitch - (e.clientY - d.y) * 0.003))
          if (mode === 'pied' && Math.abs(dx) > 40) l.scare = 1.5
          drag.current = { x: e.clientX, y: e.clientY, t: performance.now() }
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <Canvas dpr={sceneDpr} camera={{ position: [0, 3, 60], fov: 55, near: 0.3, far: 700 }} onCreated={({ camera }) => (camRef.current = camera)} style={{ background: '#f2d39a' }}>
          <fog attach="fog" args={['#f2d39a', 140, 420]} />
          <hemisphereLight args={['#fff4dc', '#c9b27a', 1.5]} />
          <directionalLight position={[60, 90, 40]} intensity={1.3} />
          <Rig live={live} mode={mode} truck={truck} />
          <Savanna />
          {groups.map((g, i) => (
            <Herd key={g.key} species={g.species} animals={g.animals} brain={brains[i]} far={260} />
          ))}
          <Flock centre={[-20, -100]} radius={35} height={15} seed="safari-aigrettes" />
          {mode === '4x4' && (
            <group ref={truck}>
              <SafariTruck p={[0, 0, 0]} roof={false} />
            </group>
          )}
        </Canvas>
        {/* The camera's frame in the middle: where the photo is taken */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[34vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white/80 shadow-[0_0_0_2000px_rgba(0,0,0,0.12)]" />
        <div className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: flash * 0.8 }} />
        <JuiceHud goal={mode === '4x4' ? tr('Photographie ce que le guide te montre !') : tr('Doucement… et photographie !')} />
      </div>
      <div className="card relative w-full max-w-[440px] px-4 py-2 text-center">
        <div className="font-display text-[17px] leading-tight font-extrabold">{call}</div>
        <div className="text-[12.5px] font-extrabold text-[var(--color-orange)]">{tr('{0} photos · {1} s · {2} espèces', { 0: shots, 1: left, 2: got.length })}</div>
      </div>
      <div className="relative flex w-full max-w-[440px] gap-2">
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" disabled={shots <= 0} onPointerDown={(e) => (e.preventDefault(), photo())}>
          {tr('Photo !')}
        </button>
      </div>
    </div>
  )
}
