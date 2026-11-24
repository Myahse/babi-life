import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Vehicle, type VehicleKind } from '../world3d/vehicles'
import { Box, Palm } from '../world3d/props'
import { Character } from '../world3d/Character'
import { randomLook } from '../avatar/options'
import { sceneDpr } from '../lib/device'
import { t } from '../lib/i18n'

// « Woro-woro » in 3D (WaitGame.tsx picks it where the phone does WebGL): the game's own vehicles and
// people, a boulevard of Abidjan between its pavements (the shops and their signs, the palms, the lamp
// posts going by), the camera behind the green woro-woro. Three lanes: tap left or right (or swipe, or
// the arrows). The traffic going the same way, slower (the gbakas, the cars, the orange taxis, the
// motos); the coins on the tarmac (+10), the clients waving on the pavement (+50, picked up from the
// lane along it), a close shave (« Ouf ! » +5), the potholes that slow you. Three hits and it's over.
// The world doesn't move: everything comes towards the taxi, recycled once behind it.

const LANES = [-2.7, 0, 2.7]
const LIVES = 3
const BEST_KEY = 'babi.waitBest'
const AHEAD = 120 // m: where things appear
const BEHIND = 14 // m: past it, recycled
const ROAD_W = 9.6
const WALK = 4

type Slot = { kind: VehicleKind; z: number; lane: number; speed: number; color?: string; seed: number; passed: boolean; hit: boolean }
type Coin = { z: number; lane: number; got: boolean }
type Client = { z: number; side: -1 | 1; got: boolean; seed: number }
type Hole = { z: number; lane: number; hit: boolean }
type Pop = { id: number; text: string; color: string; at: number; x: number }

const half = (k: VehicleKind) => (k === 'gbaka' || k === 'sotra' ? 2.9 : k === 'moto' ? 1.1 : 2.25)
const width = (k: VehicleKind) => (k === 'moto' ? 0.5 : 0.95)

function best() {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

let ac: AudioContext | null = null
function tone(freq: number, len = 0.1, vol = 0.12, type: OscillatorType = 'sine', to?: number) {
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ac.state === 'suspended') void ac.resume()
    const at = ac.currentTime
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + len)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + len)
    o.connect(g).connect(ac.destination)
    o.start(at)
    o.stop(at + len + 0.05)
  } catch {
    /* no sound */
  }
}
const buzz = (ms: number | number[]) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* not allowed */
  }
}

/** The game's state, shared by the scene (moves it) and the screen over it (reads it). */
function newGame() {
  const rnd = Math.random
  const kinds: VehicleKind[] = ['car', 'gbaka', 'taxi', 'car', 'moto', 'woro', 'car']
  return {
    started: false,
    over: false,
    speed: 15,
    dist: 0,
    score: 0,
    lives: LIVES,
    clients: 0,
    hurt: 0,
    shake: 0,
    lane: 1,
    x: 0,
    roll: 0,
    slots: kinds.map((kind, i): Slot => ({ kind, z: -AHEAD - i * 22, lane: Math.floor(rnd() * 3), speed: 5 + rnd() * 4, seed: i * 7 + 3, passed: false, hit: false, color: kind === 'car' ? ['#c92a2a', '#1c7ed6', '#f8f9fa', '#212529', '#adb5bd'][i % 5] : undefined })),
    coins: Array.from({ length: 9 }, (_, i): Coin => ({ z: -40 - i * 14, lane: Math.floor(i / 3) % 3, got: false })),
    clients_: [-1, 1, -1].map((side, i): Client => ({ z: -60 - i * 55, side: side as -1 | 1, got: false, seed: i * 11 + 5 })),
    holes: [0, 1].map((i): Hole => ({ z: -90 - i * 70, lane: (i * 2) % 3, hit: false })),
    pops: [] as Pop[],
    popId: 0,
    reported: false,
  }
}
type Game = ReturnType<typeof newGame>

export default function WaitGame3D({ className = '' }: { className?: string }) {
  const game = useRef<Game>(newGame())
  const [view, setView] = useState({ score: 0, best: best(), over: false, started: false, lives: LIVES, clients: 0, pops: [] as Pop[] })

  const reset = () => {
    game.current = { ...newGame(), started: true }
    setView((v) => ({ ...v, score: 0, over: false, started: true, lives: LIVES, clients: 0, pops: [] }))
    tone(520, 0.08)
    tone(780, 0.12)
  }
  const move = (d: number) => {
    const g = game.current
    if (g.over || !g.started) return reset()
    const was = g.lane
    g.lane = Math.max(0, Math.min(2, g.lane + d))
    if (g.lane !== was) tone(300, 0.04, 0.05, 'triangle')
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1)
      else if (e.key === 'ArrowRight') move(1)
      else if ((e.key === ' ' || e.key === 'Enter') && (game.current.over || !game.current.started)) reset()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const down = useRef<number | null>(null)
  const newBest = view.over && view.score > 0 && view.score >= view.best
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-[#9fd3ff] shadow-[0_6px_0_rgba(0,0,0,0.18)] select-none ${className}`}>
      <Canvas
        dpr={sceneDpr}
        shadows={false}
        camera={{ position: [0, 4.2, 9.5], fov: 55, near: 0.5, far: 260 }}
        onCreated={({ camera }) => camera.lookAt(0, 1, -12)}
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => (down.current = e.clientX)}
        onPointerUp={(e) => {
          const from = down.current
          down.current = null
          const g = game.current
          if (g.over || !g.started) return reset()
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const dx = from === null ? 0 : e.clientX - from
          if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1)
          else move(e.clientX - r.left < r.width / 2 ? -1 : 1)
        }}
      >
        <Scene game={game} onTick={setView} />
      </Canvas>
      {/* The words popping up (+10, Client !), over the taxi */}
      <div className="pointer-events-none absolute inset-0">
        {view.pops.map((p) => (
          <div key={p.id} className="wait-pop absolute bottom-[38%] font-display text-lg font-black drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]" style={{ left: `${50 + p.x * 10}%`, color: p.color }}>
            {p.text}
          </div>
        ))}
      </div>
      <style>{'@keyframes waitpop{0%{transform:translate(-50%,0) scale(.6);opacity:0}15%{transform:translate(-50%,-8px) scale(1.15);opacity:1}100%{transform:translate(-50%,-60px) scale(1);opacity:0}}.wait-pop{animation:waitpop .9s ease-out forwards}'}</style>
      {view.started && !view.over && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex items-center justify-between px-3 text-[12px] font-black text-white">
          <span className="rounded-full bg-black/45 px-2.5 py-1 tabular-nums">{view.score}</span>
          <span className="rounded-full bg-black/45 px-2.5 py-1">{'❤️'.repeat(Math.max(0, view.lives)) + '🖤'.repeat(LIVES - Math.max(0, view.lives))}</span>
          <span className="rounded-full bg-black/45 px-2.5 py-1">🙋 {view.clients}</span>
        </div>
      )}
      {!view.started && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/10 via-black/45 to-black/65 p-5 text-center text-white">
          <div className="font-display text-3xl font-black tracking-tight drop-shadow">{t('Woro-woro')}</div>
          <div className="mt-0.5 text-[12px] font-extrabold text-[#ffd43b]">{t('La course d’Abidjan en attendant')}</div>
          <ul className="mt-3 space-y-1 text-left text-[13px] font-bold text-white/90">
            <li>👆 {t('Touche à gauche ou à droite pour changer de voie')}</li>
            <li>🙋 {t('Prends les clients au bord : +50')}</li>
            <li>🪙 {t('Ramasse les pièces, frôle les voitures')}</li>
            <li>🚌 {t('Évite les gbakas et les nids-de-poule')}</li>
          </ul>
          <div className="mt-4 animate-pulse rounded-full bg-[var(--color-orange)] px-5 py-2 text-sm font-black shadow-[0_3px_0_rgba(0,0,0,0.3)]">{t('Touche pour démarrer')}</div>
          {view.best > 0 && <div className="mt-2 text-[12px] font-extrabold text-white/80">{t('Ton record : {n}', { n: view.best })}</div>}
        </div>
      )}
      {view.over && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/55 p-5 text-center text-white">
          <div className="text-4xl">{newBest ? '🏆' : '💥'}</div>
          <div className="mt-1 font-display text-2xl font-black">{newBest ? t('Nouveau record !') : t('Le woro-woro est cassé !')}</div>
          <div className="mt-2 flex gap-2 text-[13px] font-extrabold">
            <span className="rounded-full bg-white/15 px-3 py-1">{t('Score {n}', { n: view.score })}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">🙋 {view.clients}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">{t('Record {n}', { n: view.best })}</span>
          </div>
          <div className="mt-4 rounded-full bg-[var(--color-orange)] px-5 py-2 text-sm font-black shadow-[0_3px_0_rgba(0,0,0,0.3)]">{t('Touche pour rejouer')}</div>
        </div>
      )}
    </div>
  )
}

type Tick = (f: (v: { score: number; best: number; over: boolean; started: boolean; lives: number; clients: number; pops: Pop[] }) => { score: number; best: number; over: boolean; started: boolean; lives: number; clients: number; pops: Pop[] }) => void

function Scene({ game, onTick }: { game: React.MutableRefObject<Game>; onTick: Tick }) {
  const me = useRef<THREE.Group>(null)
  const slotRefs = useRef<(THREE.Group | null)[]>([])
  const coinRefs = useRef<(THREE.Mesh | null)[]>([])
  const clientRefs = useRef<(THREE.Group | null)[]>([])
  const holeRefs = useRef<(THREE.Mesh | null)[]>([])
  const decor = useRef<THREE.Group>(null)
  const dashes = useRef<THREE.Group>(null)
  const shown = useRef(0)
  // The kinds and looks of the pools, fixed (a slot keeps its vehicle; it's moved, not swapped).
  const g0 = game.current
  const slotKinds = useMemo(() => g0.slots.map((s) => ({ kind: s.kind, color: s.color, seed: s.seed })), []) // eslint-disable-line react-hooks/exhaustive-deps
  const clientLooks = useMemo(() => [0, 1, 2].map((i) => ({ look: randomLook(i % 2 ? 'femme' : 'homme'), gender: (i % 2 ? 'femme' : 'homme') as 'femme' | 'homme' })), [])
  // The street's sides: blocks of shops, their colours and signs, recycled down the boulevard.
  const blocks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        side: i % 2 ? 1 : -1,
        z: -Math.floor(i / 2) * 18,
        h: 4 + ((i * 37) % 5) * 1.6,
        w: 7 + ((i * 13) % 4),
        c: ['#f4e2b8', '#ffd8a8', '#d0ebff', '#e9ecef', '#ffe3e3', '#d3f9d8', '#fff3bf'][i % 7],
        sign: ['#e03131', '#2f9e44', '#1c7ed6', '#f08c00', '#7048e8'][i % 5],
      })),
    [],
  )

  useFrame(({ camera }, raw) => {
    const dt = Math.min(0.05, raw)
    const g = game.current
    const now = performance.now()
    const run = g.started && !g.over
    const v = run ? g.speed : 0
    if (run) {
      g.speed = Math.min(42, g.speed + dt * 0.35)
      g.dist += v * dt
      g.score += v * dt * 0.1
      g.hurt = Math.max(0, g.hurt - dt)
    }
    g.shake = Math.max(0, g.shake - dt * 3)
    // The taxi slides to its lane, leaning into the turn.
    const want = LANES[g.lane]
    const before = g.x
    g.x += (want - g.x) * Math.min(1, dt * 9)
    g.roll += (((g.x - before) / Math.max(dt, 1e-3)) * -0.04 - g.roll) * Math.min(1, dt * 10)
    if (me.current) {
      me.current.position.x = g.x
      me.current.rotation.z = g.roll
      me.current.rotation.y = Math.PI / 2 + (want - g.x) * -0.06
      me.current.visible = !(g.hurt > 0 && Math.floor(now / 90) % 2)
    }
    camera.position.x += (g.x * 0.55 - camera.position.x) * Math.min(1, dt * 5) + (Math.random() - 0.5) * g.shake * 0.25
    camera.position.y = 4.2 + (Math.random() - 0.5) * g.shake * 0.15
    camera.lookAt(g.x * 0.4, 1, -12)
    // The street going by: the decor and the lane dashes move towards us, wrapped.
    const span = 7 * 18
    if (decor.current) for (const c of decor.current.children) ((c.position.z += v * dt), c.position.z > BEHIND + 9 && (c.position.z -= span))
    if (dashes.current) for (const c of dashes.current.children) ((c.position.z += v * dt), c.position.z > BEHIND && (c.position.z -= 16 * 8))

    const pop = (text: string, color: string) => {
      g.pops = [...g.pops.filter((p) => now - p.at < 900), { id: ++g.popId, text, color, at: now, x: g.x / 2.7 }]
    }
    // The traffic: slower than us, so it comes nearer; past, sent far ahead in a lane.
    g.slots.forEach((s, i) => {
      s.z += (v - (run ? s.speed : 0)) * dt
      if (s.z > BEHIND) {
        s.z = -AHEAD - Math.random() * 40
        s.lane = Math.floor(Math.random() * 3)
        s.speed = 4 + Math.random() * 5 + g.dist / 900
        s.passed = s.hit = false
        // Never all three lanes shut at the same distance.
        const near = g.slots.filter((o) => o !== s && Math.abs(o.z - s.z) < 10).map((o) => o.lane)
        if (new Set([...near, s.lane]).size >= 3) s.z -= 25
      }
      const ref = slotRefs.current[i]
      if (ref) ref.position.set(LANES[s.lane], 0, s.z)
      if (!run) return
      const hz = half(s.kind) + 2.1
      const hx = width(s.kind) + 0.9
      if (!s.hit && Math.abs(s.z) < hz && Math.abs(LANES[s.lane] - g.x) < hx) {
        s.hit = true
        if (g.hurt <= 0) {
          g.lives--
          g.hurt = 1.5
          g.shake = 1
          g.speed = Math.max(14, g.speed * 0.75)
          tone(90, 0.35, 0.18, 'sawtooth', 40)
          buzz([60, 40, 60])
          if (g.lives <= 0) g.over = true
        }
      } else if (!s.passed && !s.hit && s.z > hz && Math.abs(s.lane - g.lane) === 1 && Math.abs(LANES[s.lane] - g.x) < 3.6) {
        s.passed = true
        g.score += 5
        pop(t('Ouf ! +5'), '#74c0fc')
        tone(440, 0.06, 0.05, 'triangle')
      }
    })
    // The coins: in short lines, spinning; picked up driving over them.
    g.coins.forEach((c, i) => {
      c.z += v * dt
      if (c.z > BEHIND) {
        const lead = Math.min(...g.coins.map((o) => o.z))
        c.z = Math.min(-AHEAD, lead - (i % 3 === 0 ? 30 : 5))
        c.lane = i % 3 === 0 ? Math.floor(Math.random() * 3) : g.coins[(i + 8) % 9].lane
        c.got = false
      }
      const ref = coinRefs.current[i]
      if (ref) {
        ref.position.set(LANES[c.lane], 0.9, c.z)
        ref.rotation.y = now / 300 + i
        ref.visible = !c.got
      }
      if (run && !c.got && Math.abs(c.z) < 1.8 && Math.abs(LANES[c.lane] - g.x) < 1.3) {
        c.got = true
        g.score += 10
        pop('+10', '#ffd43b')
        tone(1320, 0.07, 0.08)
        tone(1760, 0.09, 0.06)
      }
    })
    // The clients waving on the pavement: picked up from the lane along their side.
    g.clients_.forEach((c, i) => {
      c.z += v * dt
      if (c.z > BEHIND) ((c.z = -AHEAD - Math.random() * 60), (c.side = Math.random() < 0.5 ? -1 : 1), (c.got = false))
      const ref = clientRefs.current[i]
      if (ref) {
        ref.position.set(c.side * (ROAD_W / 2 + 0.9), 0.15, c.z)
        ref.visible = !c.got
      }
      const edge = c.side < 0 ? 0 : 2
      if (run && !c.got && Math.abs(c.z) < 2.4 && g.lane === edge && Math.abs(g.x - LANES[edge]) < 1) {
        c.got = true
        g.clients++
        g.score += 50
        pop(t('Client ! +50'), '#69db7c')
        tone(660, 0.1, 0.1)
        tone(990, 0.16, 0.1)
      }
    })
    // The potholes: a jolt, the speed down.
    g.holes.forEach((h, i) => {
      h.z += v * dt
      if (h.z > BEHIND) ((h.z = -AHEAD - 30 - Math.random() * 80), (h.lane = Math.floor(Math.random() * 3)), (h.hit = false))
      const ref = holeRefs.current[i]
      if (ref) ref.position.set(LANES[h.lane], 0.03, h.z)
      if (run && !h.hit && Math.abs(h.z) < 1.6 && Math.abs(LANES[h.lane] - g.x) < 1.2) {
        h.hit = true
        g.speed = Math.max(13, g.speed * 0.82)
        g.shake = 0.5
        pop(t('Nid-de-poule !'), '#ffa8a8')
        tone(120, 0.15, 0.12, 'square')
        buzz(30)
      }
    })
    // The screen over the scene: a few times a second, or at once when it's over.
    if (g.started && (g.over || now - shown.current > 120)) {
      shown.current = now
      const score = Math.floor(g.score)
      if (g.over) {
        if (!g.reported) {
          g.reported = true
          const b = Math.max(best(), score)
          try {
            localStorage.setItem(BEST_KEY, String(b))
          } catch {
            /* private mode */
          }
          onTick((st) => ({ ...st, score, best: b, over: true, lives: 0, clients: g.clients, pops: [] }))
        }
      } else onTick((s) => ({ ...s, score, lives: g.lives, clients: g.clients, pops: g.pops.filter((p) => now - p.at < 900) }))
    }
  })

  return (
    <>
      <color attach="background" args={['#9fd3ff']} />
      <fog attach="fog" args={['#cfe8ff', 60, 150]} />
      <hemisphereLight args={['#fff7e6', '#6b5a40', 1.1]} />
      <directionalLight position={[8, 14, 6]} intensity={1.4} />
      {/* The boulevard, its pavements, kerbs and the lane dashes */}
      <Box p={[0, -0.05, -60]} s={[ROAD_W, 0.1, 200]} c="#3d4248" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box p={[s * (ROAD_W / 2 + WALK / 2), 0.08, -60]} s={[WALK, 0.16, 200]} c="#c9b48a" />
          <Box p={[s * (ROAD_W / 2 + 0.06), 0.1, -60]} s={[0.14, 0.2, 200]} c="#e9ecef" />
        </group>
      ))}
      <group ref={dashes}>
        {Array.from({ length: 8 }, (_, k) =>
          [-1.35, 1.35].map((x) => (
            <mesh key={`${k}${x}`} position={[x, 0.02, -k * 16]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.18, 4]} />
              <meshBasicMaterial color="#f1f3f5" />
            </mesh>
          )),
        )}
      </group>
      {/* The shops, the palms and the lamp posts along the pavements, going by */}
      <group ref={decor}>
        {blocks.map((b, i) => {
          const x = b.side * (ROAD_W / 2 + WALK + b.w / 2)
          return (
            <group key={i} position={[0, 0, b.z]}>
              <Box p={[x, b.h / 2, 0]} s={[b.w, b.h, 16]} c={b.c} />
              {/* The shop's sign and its open front */}
              <Box p={[x - b.side * (b.w / 2 + 0.05), 3.1, 0]} s={[0.1, 0.9, 10]} c={b.sign} />
              <Box p={[x - b.side * (b.w / 2 + 0.03), 1.2, 0]} s={[0.06, 2.2, 8]} c="#343a40" />
              {/* The windows upstairs */}
              {b.h > 6 && [-4, 0, 4].map((wz) => <Box key={wz} p={[x - b.side * (b.w / 2 + 0.04), 5, wz]} s={[0.05, 1.1, 1.6]} c="#a5d8ff" />)}
              <Palm p={[b.side * (ROAD_W / 2 + 1.6), 0.16, -4]} h={6 + (i % 3)} />
              {/* A lamp post leaning over the road */}
              <Box p={[b.side * (ROAD_W / 2 + 0.6), 3.2, 5]} s={[0.15, 6.4, 0.15]} c="#868e96" />
              <Box p={[b.side * (ROAD_W / 2 - 0.3), 6.3, 5]} s={[1.8, 0.12, 0.15]} c="#868e96" />
              <Box p={[b.side * (ROAD_W / 2 - 1.1), 6.2, 5]} s={[0.5, 0.12, 0.3]} c="#fff3bf" />
            </group>
          )
        })}
      </group>
      {/* Our woro-woro */}
      <group ref={me} position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Vehicle p={[0, 0, 0]} kind="woro" color="#2b8a3e" trim="#ffd43b" seed={1} crew={false} />
      </group>
      {/* The traffic going our way */}
      {slotKinds.map((s, i) => (
        <group key={i} ref={(r) => void (slotRefs.current[i] = r)} position={[0, 0, -AHEAD]}>
          <Vehicle p={[0, 0, 0]} r={Math.PI / 2} kind={s.kind} color={s.color} seed={s.seed} />
        </group>
      ))}
      {/* The coins */}
      {g0.coins.map((_, i) => (
        <mesh key={i} ref={(r) => void (coinRefs.current[i] = r)} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.1, 16]} />
          <meshStandardMaterial color="#ffd43b" metalness={0.6} roughness={0.3} emissive="#a35c00" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {/* The potholes */}
      {g0.holes.map((_, i) => (
        <mesh key={i} ref={(r) => void (holeRefs.current[i] = r)} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.9, 12]} />
          <meshBasicMaterial color="#1f2226" />
        </mesh>
      ))}
      {/* The clients waving the woro-woro down */}
      {clientLooks.map((c, i) => (
        <group key={i} ref={(r) => void (clientRefs.current[i] = r)} rotation={[0, i % 2 ? -1.2 : 1.2, 0]}>
          <Character look={c.look} gender={c.gender} pose="wave" marker={false} seed={i + 2} />
        </group>
      ))}
    </>
  )
}
