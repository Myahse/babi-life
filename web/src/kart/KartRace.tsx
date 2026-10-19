import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ArrowLeft, ArrowRight, Flag, RotateCcw, X } from 'lucide-react'
import type { Look } from '../lib/types'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { music } from '../audio/music'
import { createRace, fmtTime, ITEMS, NO_INPUT, playerOf, standings, step, type Input, type Race } from './physics'
import { Circuit, Hazards, KartView } from './scene'
import { buildTrack, LAPS, type Track } from './track'

// Babi Karting: a race of three laps against five drivers of the quarter,
// the player at the wheel. Phone: auto-throttle (and the drift button held
// just before the green for a rocket start), ◀ ▶ to steer, a button to
// drift (held through the bend for a mini-turbo), one for the item, one to
// brake. Keyboard: ↑/W throttle, ↓/S brake, ←→/AD steer, Space drift,
// E or Shift item.

export type KartResult = { place: number; time: number | null }

const ORDINAL = (n: number) => (n === 1 ? '1er' : `${n}e`)

export default function KartRace({ name, look, gender, onExit }: { name: string; look: Look; gender: 'femme' | 'homme'; onExit: (r: KartResult | null) => void }) {
  const track = useMemo(() => buildTrack(), [])
  const [round, setRound] = useState(0)
  const race = useMemo(() => createRace(track, { name, color: '#ff8200' }), [track, name, round]) // eslint-disable-line react-hooks/exhaustive-deps
  // The rivals' looks: the same faces race after race.
  const looks = useMemo(() => {
    const r = rng('babi-karting')
    return race.karts.map((k) => (k.human ? { look, gender } : (() => {
      const g: 'femme' | 'homme' = ['Fatou', 'Mariam'].includes(k.name) ? 'femme' : 'homme'
      return { look: randomLook(g, r), gender: g }
    })()))
  }, [race, look, gender])
  // In development, the race is reachable from the console (the labs drive it).
  if (import.meta.env.DEV) (globalThis as { kartRace?: Race }).kartRace = race
  const input = useRef<Input>({ ...NO_INPUT })
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, [])
  const [hud, setHud] = useState(() => hudOf(race))
  useKeyboard(input, touch)

  const done = hud.done
  return (
    <div className="fixed inset-0 z-50 touch-none bg-[#87c5ef] select-none">
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 62, near: 0.3, far: 1200, position: [0, 6, -10] }}>
        <color attach="background" args={['#9fd3f2']} />
        <fog attach="fog" args={['#9fd3f2', 180, 620]} />
        <hemisphereLight args={['#ffffff', '#6b8f4a', 1.1]} />
        <directionalLight position={[60, 90, 40]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} />
        <Suspense fallback={null}>
          <Circuit track={track} race={race} />
          {race.karts.map((k, i) => (
            <KartView key={`${round}-${k.id}`} kart={k} look={looks[i].look} gender={looks[i].gender} />
          ))}
          <Hazards race={race} />
        </Suspense>
        <Loop race={race} input={input} touch={touch} onHud={setHud} />
        <Chase race={race} />
      </Canvas>

      {/* The HUD: the place, the lap, the time, the item, the map */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="rounded-2xl bg-[#0f1230]/70 px-3 py-2 text-white">
          <div className="font-display text-4xl leading-none font-extrabold">
            {ORDINAL(hud.place)}
            <span className="text-lg opacity-70">/{race.karts.length}</span>
          </div>
          <div className="mt-1 text-xs font-extrabold opacity-90">
            Tour {Math.min(LAPS, hud.lap + 1)}/{LAPS} · {fmtTime(Math.max(0, hud.time))}
          </div>
        </div>
        <div className="grid h-16 w-16 place-items-center rounded-2xl border-4 border-white/80 bg-[#0f1230]/60 text-4xl">{hud.rolling ? <span className="animate-pulse">{ITEMS[(['piment', 'banane', 'coco'] as const)[Math.floor(Date.now() / 90) % 3]].emoji}</span> : hud.item ? ITEMS[hud.item].emoji : ''}</div>
        <div className="flex flex-col items-end gap-2">
          <button className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-[#0f1230]/70 text-white" onClick={() => onExit(null)} aria-label="Quitter la course">
            <X size={22} />
          </button>
          <MiniMap track={track} race={race} tick={hud.time} />
        </div>
      </div>
      <div className="pointer-events-none absolute top-[max(5.6rem,calc(env(safe-area-inset-top)+5rem))] left-1/2 -translate-x-1/2 rounded-xl bg-[#0f1230]/60 px-2 py-0.5 font-display text-base font-extrabold text-white tabular-nums">{Math.round(Math.abs(hud.speed) * 3.6)} km/h</div>

      {hud.countdown !== null && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div key={hud.countdown} className="animate-up font-display text-[120px] leading-none font-extrabold text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]">
            {hud.countdown}
          </div>
        </div>
      )}
      {hud.flash && !done && (
        <div className="pointer-events-none absolute inset-x-0 top-[28%] text-center">
          <span className="rounded-2xl bg-[#ffd43b] px-4 py-2 font-display text-2xl font-extrabold text-[#141416] shadow-lg">{hud.flash}</span>
        </div>
      )}

      {!done && <Pad input={input} touch={touch} />}

      {done && (
        <div className="absolute inset-0 grid place-items-center bg-[#0f1230]/60 p-4">
          <div className="sheet animate-up w-full max-w-sm rounded-[28px] p-5">
            <div className="flex items-center gap-2">
              <Flag size={22} className="text-[var(--color-orange)]" />
              <div className="font-display text-2xl font-extrabold">{hud.place === 1 ? 'Victoire !' : hud.place <= 3 ? 'Sur le podium !' : 'Course terminée'}</div>
            </div>
            <ol className="mt-3 space-y-1">
              {standings(race).map((k, i) => (
                <li key={k.id} className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-sm font-extrabold ${k.human ? 'bg-[#fff1e0] text-[#a34700]' : 'bg-[var(--color-canvas)]'}`}>
                  <span>
                    {ORDINAL(i + 1)} · {k.name}
                  </span>
                  <span className="tabular-nums">{k.finished !== null ? fmtTime(k.finished) : '…'}</span>
                </li>
              ))}
            </ol>
            {hud.best !== null && <p className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">Ton meilleur temps sur ce circuit : {fmtTime(hud.best)}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn btn-soft" onClick={() => onExit({ place: hud.place, time: playerOf(race).finished })}>
                Sortir
              </button>
              <button className="btn" onClick={() => setRound((r) => r + 1)}>
                <RotateCcw size={18} /> Rejouer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type Hud = { place: number; lap: number; time: number; speed: number; item: keyof typeof ITEMS | null; rolling: boolean; flash: string | null; countdown: string | null; done: boolean; best: number | null }

const BEST = 'babi.kart.best'
const readBest = () => {
  try {
    const v = Number(localStorage.getItem(BEST))
    return v > 0 ? v : null
  } catch {
    return null
  }
}

function hudOf(race: Race): Hud {
  const me = playerOf(race)
  const t = race.time
  return {
    place: standings(race).indexOf(me) + 1,
    lap: Math.max(0, me.lap),
    time: me.finished ?? t,
    speed: me.speed,
    item: me.item,
    rolling: me.rolling > 0,
    flash: race.flash?.text ?? null,
    countdown: t < 0 ? (Math.ceil(-t) <= 3 ? String(Math.ceil(-t)) : null) : t < 1 ? 'Partez !' : null,
    done: me.finished !== null,
    best: readBest(),
  }
}

/** The race steps every frame; the HUD is refreshed ten times a second. */
function Loop({ race, input, touch, onHud }: { race: Race; input: React.MutableRefObject<Input>; touch: boolean; onHud: (h: Hud) => void }) {
  const acc = useRef(0)
  const engine = useEngine()
  const saved = useRef(false)
  useFrame((_, dt) => {
    // On a phone the kart accelerates by itself (unless braking).
    const inp = touch ? { ...input.current, throttle: race.time < 0 || input.current.brake ? 0 : 1 } : input.current
    step(race, dt, inp)
    // The item button is a press, not a hold.
    input.current.use = false
    const me = playerOf(race)
    engine(me.speed, me.boost > 0)
    if (me.finished !== null && !saved.current) {
      saved.current = true
      const best = readBest()
      try {
        if (best === null || me.finished < best) localStorage.setItem(BEST, String(me.finished))
      } catch {
        // Private mode: no best time kept.
      }
    }
    acc.current += dt
    if (acc.current > 0.1) {
      acc.current = 0
      onHud(hudOf(race))
    }
  })
  return null
}

/** The camera behind the player's kart, a little above; wider when boosting. */
function Chase({ race }: { race: Race }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const at = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const first = useRef(true)
  useFrame((_, dt) => {
    const me = playerOf(race)
    // Behind the way the kart looks (not its drift angle or its spin).
    const h = me.heading
    const [fx, fz] = [Math.sin(h), Math.cos(h)]
    const want = new THREE.Vector3(me.x - fx * 6.2, 2.7, me.z - fz * 6.2)
    const target = new THREE.Vector3(me.x + fx * 4, 0.9, me.z + fz * 4)
    const k = first.current ? 1 : 1 - Math.exp(-dt * 7)
    first.current = false
    at.current.lerp(want, k)
    look.current.lerp(target, k)
    camera.position.copy(at.current)
    camera.lookAt(look.current)
    const fov = me.boost > 0 ? 72 : 62
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 4)
    camera.updateProjectionMatrix()
  })
  return null
}

/** The map in the corner: the circuit's line, a dot per kart (the player's bigger). */
function MiniMap({ track, race, tick }: { track: Track; race: Race; tick: number }) {
  const path = useMemo(() => {
    let d = ''
    for (let i = 0; i < track.n; i += 4) d += `${i ? 'L' : 'M'}${track.x[i].toFixed(0)} ${track.z[i].toFixed(0)}`
    return d + 'Z'
  }, [track])
  void tick
  return (
    <svg viewBox="-135 -140 270 225" className="h-24 w-28 rounded-xl bg-[#0f1230]/50 p-1">
      <path d={path} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinejoin="round" opacity={0.85} />
      {race.karts.map((k) => (
        <circle key={k.id} cx={k.x} cy={k.z} r={k.human ? 10 : 7} fill={k.color} stroke="#0f1230" strokeWidth={3} />
      ))}
    </svg>
  )
}

/** The keyboard: arrows or WASD, Space to drift, E or Shift for the item. */
function useKeyboard(input: React.MutableRefObject<Input>, touch: boolean) {
  useEffect(() => {
    const keys = new Set<string>()
    const apply = () => {
      const i = input.current
      if (!touch) i.throttle = keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0
      i.brake = keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0
      i.steer = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0)
      i.drift = keys.has('Space')
    }
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
      if ((e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) input.current.use = true
      keys.add(e.code)
      apply()
    }
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code)
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [input, touch])
}

/** The phone's buttons: steer on the left, brake, drift and the item on the right. */
function Pad({ input, touch }: { input: React.MutableRefObject<Input>; touch: boolean }) {
  const hold = (set: (on: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      set(true)
    },
    onPointerUp: () => set(false),
    onPointerCancel: () => set(false),
    onPointerLeave: () => set(false),
  })
  const steer = (dir: number) => hold((on) => (input.current.steer = on ? dir : input.current.steer === dir ? 0 : input.current.steer))
  const btn = 'pointer-events-auto grid place-items-center rounded-full bg-white/85 font-display font-extrabold text-[#141416] shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-[3px] active:shadow-[0_3px_0_rgba(0,0,0,0.25)]'
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex gap-3">
        <button className={`${btn} h-20 w-20`} {...steer(-1)} aria-label="À gauche">
          <ArrowLeft size={34} strokeWidth={3} />
        </button>
        <button className={`${btn} h-20 w-20`} {...steer(1)} aria-label="À droite">
          <ArrowRight size={34} strokeWidth={3} />
        </button>
      </div>
      <div className="grid grid-cols-2 items-end gap-3">
        <button className={`${btn} h-14 w-14 text-xs`} {...hold((on) => (input.current.brake = on ? 1 : 0))}>
          Frein
        </button>
        <button className={`${btn} h-16 w-16 !bg-[#ffd43b] text-sm`} onPointerDown={() => (input.current.use = true)}>
          Objet
        </button>
        {!touch && <span className="col-span-2 text-right text-[11px] font-bold text-white drop-shadow">↑ accélérer · Espace déraper · E objet</span>}
        <button className={`${btn} col-span-2 h-16 w-full !rounded-3xl !bg-[#ff8200] text-base text-white`} {...hold((on) => (input.current.drift = on))}>
          Déraper
        </button>
      </div>
    </div>
  )
}

/** The engine's hum, its pitch following the speed (silent when the game's sound is off). */
function useEngine() {
  const nodes = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null)
  useEffect(() => {
    if (music.muted) return
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 700
      const gain = ctx.createGain()
      gain.gain.value = 0.035
      osc.connect(filter).connect(gain).connect(ctx.destination)
      osc.start()
      nodes.current = { ctx, osc, gain }
    } catch {
      nodes.current = null
    }
    return () => {
      void nodes.current?.ctx.close()
      nodes.current = null
    }
  }, [])
  return (speed: number, boost: boolean) => {
    const n = nodes.current
    if (!n) return
    if (n.ctx.state === 'suspended') void n.ctx.resume()
    n.osc.frequency.setTargetAtTime(55 + Math.abs(speed) * 5.5 + (boost ? 40 : 0), n.ctx.currentTime, 0.05)
  }
}
