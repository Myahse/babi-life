import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage, scoreOf } from '../Shell'
import { audio, juice, noise, tone } from '../juice'
import type { EngineProps, PropId } from '../types'
import { t as tr } from '../../../../lib/i18n'

// In rhythm (the maquis's coupé-décalé, made for every action): three lanes run down the stage toward
// the player, each headed by its object (the djembé, the micro…); the notes slide down them on the beat,
// tap the lane (or its button) as a note crosses the line. On time: parfait, a little off: bien.

const LANE_X = [-1.7, 0, 1.7]
const LANE_C = ['#ff922b', '#f06595', '#22b8cf']
const HIT_Z = 2.2
const FAR_Z = -5
/** Seconds a note takes from the back to the line. */
const LEAD = 1.9
const SPEED = (HIT_Z - FAR_Z) / LEAD
const PERFECT = 0.085
const GOOD = 0.17
const NEAR = 0.38

type Note = { key: number; lane: number; t: number; done?: 'perfect' | 'good' | 'miss'; at?: number }
type Flash = { c: string; at: number }
type St = { t: number; t0: number; last: number; /** Seconds a beat; the beats sounded up to. */ beat: number; heard: number; end: number; notes: Note[]; flash: Flash[]; bounce: number[]; perfect: number; good: number; miss: number; stray: number; combo: number; best: number; over: boolean }

/** The chart: on the beats (a half-beat now and then once it's going), never the same lane three times. */
function chart(n: number, tempo: number): Note[] {
  const beat = 60 / tempo
  const out: Note[] = []
  let t = 2.2
  let last = -1
  let same = 0
  for (let i = 0; i < n; i++) {
    let lane = Math.floor(Math.random() * 3)
    if (lane === last && same >= 1) lane = (lane + 1 + Math.floor(Math.random() * 2)) % 3
    same = lane === last ? same + 1 : 0
    last = lane
    out.push({ key: i, lane, t })
    t += i > n / 3 && Math.random() < 0.25 ? beat / 2 : Math.random() < 0.15 ? beat * 2 : beat
  }
  return out
}

/** A note sliding down its lane: a coloured tile, the note on it; hit, it jumps and goes; missed, it greys and sinks. */
function NoteMesh({ n, st }: { n: Note; st: { current: St } }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const now = st.current.t
    if (n.done && n.done !== 'miss' && n.at !== undefined) {
      const k = (now - n.at) / 0.3
      o.position.set(LANE_X[n.lane], k * 1.1, HIT_Z)
      o.scale.setScalar(k < 1 ? 1 + k * 0.35 : 0.001)
      return
    }
    // Let by: it stops where it was missed and sinks into the floor.
    const missed = n.done === 'miss' ? now - (n.at ?? now) : -1
    const z = HIT_Z - (n.t - (missed >= 0 ? n.at! : now)) * SPEED
    o.position.set(LANE_X[n.lane], missed >= 0 ? -missed * 0.8 : 0, z)
    o.visible = z > FAR_Z - 0.5 && missed < 0.45
    o.scale.setScalar(z < FAR_Z + 1 ? Math.max(0.01, (z - FAR_Z + 0.5) / 1.5) : 1)
  })
  return (
    <group ref={g} visible={false}>
      <Box p={[0, 0.08, 0]} s={[1.2, 0.16, 0.5]} c={n.done === 'miss' ? '#6c757d' : LANE_C[n.lane]} glow={n.done === 'miss' ? undefined : 0.35} />
      <group position={[0, 0.16, 0]} scale={0.55}>
        <Prop id="note-musique" />
      </group>
    </group>
  )
}

/** The notes in play: re-listed only when the window of what's near changes (each moves on its own). */
function Notes({ st }: { st: { current: St } }) {
  const [list, setList] = useState<Note[]>([])
  const sig = useRef('')
  useFrame(() => {
    const now = st.current.t
    const near = st.current.notes.filter((n) => n.t - now < LEAD + 0.3 && now - n.t < 1.2)
    const k = near.map((n) => n.key + (n.done ?? '')).join(',')
    if (k !== sig.current) {
      sig.current = k
      setList(near)
    }
  })
  return (
    <>
      {list.map((n) => (
        <NoteMesh key={n.key} n={n} st={st} />
      ))}
    </>
  )
}

/** A lane: its strip down the stage, its pad on the line (lit on a hit), its object at the front bouncing; a tap on it plays it. */
function Lane({ i, prop, st, onTap }: { i: number; prop: PropId; st: { current: St }; onTap: () => void }) {
  const pad = useRef<THREE.Mesh>(null)
  const obj = useRef<THREE.Group>(null)
  const col = useMemo(() => new THREE.Color(), [])
  const tint = useMemo(() => new THREE.Color(), [])
  const len = HIT_Z - FAR_Z + 1.4
  const mid = (HIT_Z + FAR_Z) / 2 - 0.4
  useFrame((_, dt) => {
    const s = st.current
    s.bounce[i] = Math.max(0, s.bounce[i] - dt * 4)
    const b = s.bounce[i]
    if (obj.current) {
      obj.current.scale.setScalar(1.45 * (1 + b * 0.25))
      obj.current.position.y = b * 0.35
    }
    const f = s.flash[i]
    const m = pad.current?.material as THREE.MeshLambertMaterial | undefined
    if (m) {
      const k = Math.max(0, 1 - (s.t - f.at) / 0.35)
      col.set(LANE_C[i]).lerp(tint.set(f.c), k)
      m.color.copy(col)
      m.emissive.copy(col)
      // The pads breathe on the beat: the music's pulse, seen.
      const ph = (((s.t - 2.2) / s.beat) % 1 + 1) % 1
      m.emissiveIntensity = 0.25 + k * 0.9 + (s.t > 0 && ph < 0.25 ? (0.25 - ph) * 1.4 : 0)
    }
  })
  return (
    <group onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onTap())}>
      {/* The strip and its edges */}
      <Box p={[LANE_X[i], 0.01, mid]} s={[1.3, 0.02, len]} c="#2a1d15" />
      <Box p={[LANE_X[i] - 0.68, 0.025, mid]} s={[0.05, 0.03, len]} c={LANE_C[i]} glow={0.4} />
      <Box p={[LANE_X[i] + 0.68, 0.025, mid]} s={[0.05, 0.03, len]} c={LANE_C[i]} glow={0.4} />
      {/* The pad on the line */}
      <mesh ref={pad} position={[LANE_X[i], 0.04, HIT_Z]}>
        <boxGeometry args={[1.3, 0.06, 0.6]} />
        <meshLambertMaterial color={LANE_C[i]} emissive={LANE_C[i]} emissiveIntensity={0.25} />
      </mesh>
      {/* The lane's object, at the front */}
      <group position={[LANE_X[i], 0, HIT_Z + 1.05]}>
        <group ref={obj}>
          <Prop id={prop} />
        </group>
      </group>
      {/* A wide hold down the whole lane: a finger finds it */}
      <mesh position={[LANE_X[i], 0.5, mid + 1]} visible={false}>
        <boxGeometry args={[1.7, 1, len + 2.5]} />
      </mesh>
    </group>
  )
}

/** The song's time (s), on the real clock (a hidden tab, a long stall: the song waits). */
function clock(s: St) {
  const now = performance.now()
  if (now - s.last > 1500) s.t0 += now - s.last - 16
  s.last = now
  return (now - s.t0) / 1000
}

/** The song's own beat, made in the browser and laid just ahead of the clock: the kick on every beat,
 *  the hi-hat between, a bass walking round the chord, from two beats before the first note to the last. */
function beats(s: St) {
  const c = audio()
  if (!c) return
  const ahead = s.t + 0.2
  // On the chart's grid: the first note at 2.2 s, a beat after another.
  while (2.2 + s.heard * s.beat <= Math.min(ahead, s.end)) {
    const bt = 2.2 + s.heard * s.beat
    const at = c.currentTime + Math.max(0, bt - s.t)
    const k = Math.round(s.heard) + 64
    tone(at, 110, 0.16, 0.22, 'sine', 45)
    noise(at + s.beat / 2, 0.04, 7000, 1.5, 0.05, undefined, 'highpass')
    if (k % 2 === 1) noise(at, 0.09, 1800, 0.8, 0.07)
    tone(at, [55, 55, 65.4, 73.4][Math.floor(k / 2) % 4] * 2, s.beat * 0.8, 0.07, 'triangle')
    s.heard++
  }
}

/** The lane's own sound, played on the tap: a low drum, a clap, a bell. */
function laneSound(lane: number, ok: boolean) {
  const c = audio()
  if (!c) return
  const at = c.currentTime
  if (lane === 0) {
    tone(at, ok ? 160 : 120, 0.18, 0.2, 'sine', 70)
    noise(at, 0.05, 700, 1, 0.12)
  } else if (lane === 1) noise(at, 0.12, 2200, 0.9, ok ? 0.22 : 0.1)
  else {
    tone(at, ok ? 880 : 700, 0.25, 0.09, 'triangle')
    tone(at, ok ? 1320 : 1050, 0.18, 0.04, 'sine')
  }
}

/** The clock of the song, and the notes let by. */
function Loop({ st, onMiss }: { st: { current: St }; onMiss: (n: Note) => void }) {
  useFrame(() => {
    const s = st.current
    if (s.over) return
    s.t = clock(s)
    beats(s)
    for (const n of s.notes)
      if (!n.done && s.t - n.t > GOOD) {
        n.done = 'miss'
        n.at = s.t
        s.miss++
        s.combo = 0
        s.flash[n.lane] = { c: '#e03131', at: s.t }
        onMiss(n)
      }
  })
  return null
}

export function Rythme({ jeu, onEnd }: EngineProps<'rythme'>) {
  const n = jeu.notes ?? 24
  const tempo = jeu.tempo ?? 100
  const notes0 = useRef<Note[]>(null)
  notes0.current ??= chart(n, tempo)
  // The song starts two beats before the first note: the count-in, heard.
  const st = useRef<St>({ t: 0, t0: performance.now(), last: performance.now(), beat: 60 / tempo, heard: -2, end: notes0.current[notes0.current.length - 1].t + 60 / tempo, notes: notes0.current, flash: [0, 1, 2].map(() => ({ c: '#ffffff', at: -9 })), bounce: [0, 0, 0], perfect: 0, good: 0, miss: 0, stray: 0, combo: 0, best: 0, over: false })
  const [, redraw] = useState(0)
  const finish = useRef(onEnd)
  finish.current = onEnd
  // All the notes played or let by: the song's over.
  const check = () => {
    const s = st.current
    redraw((k) => k + 1)
    if (s.over || s.notes.some((q) => !q.done)) return
    s.over = true
    const pts = s.perfect + s.good * 0.6 + Math.min(4, s.best / 6)
    gesture('cheer', 1500)
    setTimeout(() => juice.finish(scoreOf(pts, n, Math.floor(s.stray / 3)), s.miss === 0 ? tr('Sans faute, le maquis est chaud !') : s.miss < n / 4 ? tr('Ça, c’est le vrai coupé-décalé !') : tr('Fin du morceau !'), finish.current), 350)
  }
  const tap = (lane: number) => {
    const s = st.current
    if (s.over) return
    s.t = clock(s)
    s.bounce[lane] = 1
    // The nearest note of the lane not played yet.
    let best: Note | null = null
    for (const q of s.notes) if (!q.done && q.lane === lane && (!best || Math.abs(q.t - s.t) < Math.abs(best.t - s.t))) best = q
    const d = best ? s.t - best.t : 99
    if (best && Math.abs(d) <= GOOD) {
      const perfect = Math.abs(d) <= PERFECT
      best.done = perfect ? 'perfect' : 'good'
      best.at = s.t
      if (perfect) s.perfect++
      else s.good++
      s.combo++
      s.best = Math.max(s.best, s.combo)
      s.flash[lane] = { c: perfect ? '#fff3bf' : '#69db7c', at: s.t }
      laneSound(lane, true)
      gesture('dance', 1500)
      // Early or late by a hair still counts; said, so the next is nearer.
      juice.good({ at: [LANE_X[lane], 0.6, HIT_Z], perfect, text: perfect ? tr('Parfait !') : d < 0 ? tr('Un peu tôt') : tr('Un peu tard') })
    } else if (best && Math.abs(d) <= NEAR) {
      best.done = 'miss'
      best.at = s.t
      s.miss++
      s.combo = 0
      s.flash[lane] = { c: '#e03131', at: s.t }
      laneSound(lane, false)
      juice.bad({ at: [LANE_X[lane], 0.6, HIT_Z], text: d < 0 ? tr('Trop tôt !') : tr('Trop tard !'), soft: true })
    } else {
      s.stray++
      s.combo = 0
      s.flash[lane] = { c: '#868e96', at: s.t }
      laneSound(lane, false)
    }
    check()
  }
  const onMiss = (q: Note) => {
    juice.bad({ at: [LANE_X[q.lane], 0.4, HIT_Z], text: tr('Raté !'), soft: true })
    check()
  }
  useEffect(() => {
    const keys: Record<string, number> = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2, a: 0, q: 0, s: 1, z: 1, d: 2 }
    const key = (e: KeyboardEvent) => {
      if (e.repeat || !(e.key in keys)) return
      e.preventDefault()
      tap(keys[e.key])
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const s = st.current
  const played = s.notes.filter((q) => q.done).length
  return (
    <JeuShell
      tall
      goal={tr('Tape quand la note touche la ligne !')}
      title={jeu.title}
      how={jeu.how}
      status={`${s.combo >= 2 ? `Combo ×${s.combo} · ` : ''}${s.perfect} parfaits · ${played}/${n}`}
      controls={[0, 1, 2].map((i) => (
        <button key={i} aria-label={tr('Piste {0}', { 0: i + 1 })} className="h-16 flex-1 touch-none rounded-2xl border-b-4 text-[26px] font-extrabold text-white select-none active:translate-y-0.5 active:border-b-0" style={{ background: LANE_C[i], borderColor: 'rgba(0,0,0,0.3)' }} onPointerDown={(e) => (e.preventDefault(), tap(i))}>
          ●
        </button>
      ))}
    >
      <Stage decor={jeu.decor} cam={[0, 6.4, 8.6]} look={[0, 0, 0]} fov={42}>
        <Loop st={st} onMiss={onMiss} />
        {jeu.lanes.map((p, i) => (
          <Lane key={i} i={i} prop={p} st={st} onTap={() => tap(i)} />
        ))}
        {/* The line to play on */}
        <Box p={[0, 0.03, HIT_Z + 0.33]} s={[5.4, 0.04, 0.06]} c="#ffffff" glow={0.6} />
        <Notes st={st} />
      </Stage>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:rythme). */
export const demo: Extract<import('../types').Jeu, { engine: 'rythme' }> = {
  engine: 'rythme', title: tr('Le coupé-décalé'), how: tr('Les notes descendent : tape la bonne piste quand elles passent la ligne.'), decor: 'scene', lanes: ['djembe', 'micro', 'balafon'], notes: 24, tempo: 100,
}
