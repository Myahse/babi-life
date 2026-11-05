import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../lib/native'
import { music } from '../../../audio/music'
import { setExpression, type Expression } from '../../../avatar/expressions'
import { t as tr } from '../../../lib/i18n'

// What every game of an action gives back (the engines call it): a word floating up where it
// happened (« Parfait ! », « Trop tôt »), the streak (×5, its note climbing a step each time), a
// burst of the game's own blocks that fall and bounce, the square shaking and the game stopping a
// blink on a big hit or a miss, the phone's buzz, a short sound made in the browser, the Sim's face.
// The end: the score counting up, the stars, then off (a tap skips it). One game at a time, so the
// state is the module's.

export type V3 = [number, number, number]
type Float = { id: number; text: string; x: number; y: number; c: string; big: boolean }
export type Finale = { score: number; line: string; stars: number }

const S = {
  v: 0,
  floats: [] as Float[],
  key: 0,
  combo: 0,
  best: 0,
  shake: 0,
  /** Until when the game stands still (the hit-stop), in performance.now() ms. */
  stopUntil: 0,
  finale: null as Finale | null,
  ended: false,
  skip: null as null | (() => void),
  project: null as null | ((p: V3) => [number, number]),
  bursts: [] as { p: V3; colors: string[]; n: number; power: number; floor: number; size: number }[],
  confetti: 0,
  shakeEl: null as HTMLElement | null,
}
const subs = new Set<() => void>()
const tell = () => {
  S.v++
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))
const useJuiceState = () => useSyncExternalStore(subscribe, () => S.v)

/* ---------- Sound (made in the browser; silent when the game's sound is off) ---------- */

let ac: AudioContext | null = null
let out: GainNode | null = null
export function audio(): AudioContext | null {
  if (music.muted || typeof window === 'undefined') return null
  try {
    if (!ac) {
      ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      out = ac.createGain()
      out.gain.value = 0.55
      out.connect(ac.destination)
    }
    if (ac.state === 'suspended') void ac.resume()
    return ac
  } catch {
    return null
  }
}
export function tone(at: number, f: number, len: number, gain: number, type: OscillatorType = 'triangle', slide?: number) {
  const c = ac
  if (!c || !out) return
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f, at)
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + len)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + len + 0.03)
}
let noiseBuf: AudioBuffer | null = null
export function noise(at: number, len: number, freq: number, q: number, gain: number, sweep?: number, type: BiquadFilterType = 'bandpass') {
  const c = ac
  if (!c || !out) return
  noiseBuf ??= (() => {
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return b
  })()
  const s = c.createBufferSource()
  s.buffer = noiseBuf
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, at)
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, at + len)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  s.connect(f).connect(g).connect(out)
  s.start(at, Math.random() * 0.5)
  s.stop(at + len + 0.03)
}
// The streak's notes: a major pentatonic, climbing a step at each one.
const PENTA = [0, 2, 4, 7, 9]
const stepHz = (k: number) => 523.25 * 2 ** ((PENTA[k % 5] + 12 * Math.floor(k / 5)) / 12)

export const snd = {
  /** Something taken, caught, done: a bright note, higher with the streak. */
  good(streak = 0) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    const f = stepHz(Math.min(14, streak))
    tone(t, f, 0.16, 0.12, 'triangle')
    tone(t + 0.045, f * 1.5, 0.14, 0.06, 'sine')
  },
  /** Spot on: the note and a sparkle over it. */
  perfect(streak = 0) {
    snd.good(streak)
    const c = ac
    if (!c) return
    const t = c.currentTime
    for (let k = 0; k < 3; k++) tone(t + 0.07 + k * 0.04, 2093 * (1 + k * 0.25), 0.1, 0.035, 'sine')
  },
  /** Wrong: a dull low buzz going down. */
  bad() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(t, 190, 0.22, 0.13, 'square', 110)
    noise(t, 0.08, 500, 1, 0.12)
  },
  /** A finger on a thing: a soft click. */
  tap() {
    const c = audio()
    if (!c) return
    noise(c.currentTime, 0.035, 2600, 3, 0.18)
  },
  /** Something thrown, swept: air. */
  whoosh(power = 0.6) {
    const c = audio()
    if (!c) return
    noise(c.currentTime, 0.18 + power * 0.12, 600, 1.2, 0.12 + power * 0.1, 2800)
  },
  /** Something landing: a thud, its pitch by its weight. */
  thud(soft = 0.5) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(t, 140 - soft * 40, 0.12, 0.16 * (1 - soft * 0.5), 'sine', 60)
    noise(t, 0.05, 900, 1, 0.1 * (1 - soft * 0.4))
  },
  /** Water. */
  splash() {
    const c = audio()
    if (!c) return
    noise(c.currentTime, 0.35, 1200, 0.7, 0.22, 400)
  },
  /** Scrubbing: a short rough rub. */
  scrub() {
    const c = audio()
    if (!c) return
    noise(c.currentTime, 0.07, 1800 + Math.random() * 1500, 0.9, 0.12)
  },
  /** The camera's shutter. */
  shutter() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    noise(t, 0.03, 4000, 2, 0.3)
    noise(t + 0.06, 0.04, 2500, 2, 0.22)
  },
  /** The game starts. */
  go() {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    tone(t, 659, 0.12, 0.09, 'triangle')
    tone(t + 0.1, 988, 0.22, 0.1, 'triangle')
  },
  /** The end: a little fanfare, longer with the stars. */
  fanfare(stars: number) {
    const c = audio()
    if (!c) return
    const t = c.currentTime
    if (!stars) return void tone(t, 330, 0.4, 0.1, 'triangle', 220)
    const notes = [523, 659, 784, 1047, 1319].slice(0, 2 + stars)
    notes.forEach((f, i) => tone(t + i * 0.085, f, i === notes.length - 1 ? 0.5 : 0.18, 0.12, 'triangle'))
  },
  /** A count tick (the score climbing). */
  tick(k: number) {
    const c = audio()
    if (!c) return
    tone(c.currentTime, 880 + k * 30, 0.04, 0.04, 'sine')
  },
}

/* ---------- The feedback ---------- */

const where = (at?: V3 | [number, number]): [number, number] => {
  if (!at) return [0.5, 0.42]
  if (at.length === 2) return at
  return S.project ? S.project(at) : [0.5, 0.42]
}
const STREAK: [number, string][] = [
  [20, tr('Inarrêtable !')],
  [15, tr('En feu !')],
  [10, tr('Trop fort !')],
  [5, tr('Chaud !')],
]
const face = (e: Expression, ms = 900) => setExpression('me', e, ms)

export const juice = {
  /** A new game: everything back to nothing. */
  reset() {
    S.floats = []
    S.combo = 0
    S.best = 0
    S.shake = 0
    S.stopUntil = 0
    S.finale = null
    S.ended = false
    S.skip = null
    S.bursts = []
  },
  get combo() {
    return S.combo
  },
  get best() {
    return S.best
  },
  /** A word floating up from a spot (a point of the scene, or [x, y] across the square from 0 to 1). */
  say(text: string, at?: V3 | [number, number], c = '#ffffff', big = false) {
    const [x, y] = where(at)
    S.floats = [...S.floats.slice(-5), { id: S.key++, text, x, y, c, big }]
    tell()
  },
  /** The game's blocks thrown out from a spot, falling, bouncing on the floor (y = floor), then gone. */
  burst(at: V3, colors: string[] = ['#ffd43b', '#69db7c', '#ffffff'], n = 10, power = 3, floor = 0, size = 0.14) {
    S.bursts.push({ p: at, colors, n, power, floor, size })
  },
  /** The game stands still a blink (a big hit, a fall). */
  stop(ms = 60) {
    S.stopUntil = Math.max(S.stopUntil, performance.now() + ms)
  },
  /** The time step of a game's loop, nothing while it stands still. */
  dt(dt: number) {
    return performance.now() < S.stopUntil ? 0 : dt
  },
  /** The square shakes. */
  shake(px = 8) {
    S.shake = Math.max(S.shake, px)
    shakeLoop()
  },
  /** Done right: the streak goes on (its note a step higher), the word, the blocks, the buzz. */
  good({ at, text, perfect, colors, n, quiet }: { at?: V3; text?: string; perfect?: boolean; colors?: string[]; n?: number; quiet?: boolean } = {}) {
    S.combo++
    S.best = Math.max(S.best, S.combo)
    if (perfect) snd.perfect(S.combo - 1)
    else snd.good(S.combo - 1)
    haptic(perfect ? 'medium' : 'light')
    if (at) juice.burst(at, colors ?? (perfect ? ['#ffd43b', '#fff3bf', '#ffffff'] : ['#69db7c', '#ffd43b', '#ffffff']), n ?? (perfect ? 14 : 8), perfect ? 3.6 : 2.6)
    if (perfect) juice.stop(45)
    const milestone = S.combo >= 5 && S.combo % 5 === 0 ? STREAK.find(([k]) => S.combo >= k)?.[1] : undefined
    if (milestone) {
      juice.say(milestone, [0.5, 0.3], '#ffd43b', true)
      face('cheer', 1200)
    } else if (!quiet) {
      if (text) juice.say(text, at, perfect ? '#ffe066' : '#c3fae8', perfect)
      if (perfect || S.combo % 3 === 0) face('grin', 800)
    }
    tell()
  },
  /** Done wrong: the streak's gone, the word in red, the square shakes, a blink of stillness. */
  bad({ at, text, soft }: { at?: V3; text?: string; soft?: boolean } = {}) {
    const lost = S.combo >= 5
    S.combo = 0
    snd.bad()
    haptic(soft ? 'light' : 'error')
    if (text) juice.say(text, at, '#ff8787', !soft)
    if (lost) juice.say(tr('Série perdue'), [0.5, 0.3], '#ffa8a8')
    if (at) juice.burst(at, ['#ff6b6b', '#c92a2a', '#495057'], 6, 2)
    if (!soft) {
      juice.shake(9)
      juice.stop(80)
    }
    face(soft ? 'meh' : 'hurt', 900)
    tell()
  },
  /** The timing of a tap, said: early, late, spot on. */
  timing(kind: 'early' | 'late' | 'perfect' | 'good', at?: V3) {
    const w = { early: [tr('Trop tôt !'), '#74c0fc'], late: [tr('Trop tard !'), '#ffa94d'], perfect: [tr('Parfait !'), '#ffe066'], good: [tr('Bien !'), '#c3fae8'] }[kind]
    juice.say(w[0], at, w[1], kind === 'perfect')
  },
  /**
   * The end: the score counting up over the game, the stars, the line, a fanfare, the blocks; then
   * the score's sent (a tap sends it at once). Called twice, the second's ignored.
   */
  finish(score: number, line: string, onEnd: (score: number) => void, ms = 1500) {
    if (S.ended) return
    S.ended = true
    const s = Math.max(0, Math.min(100, Math.round(score)))
    const stars = s >= 85 ? 3 : s >= 50 ? 2 : s >= 15 ? 1 : 0
    S.finale = { score: s, line, stars }
    S.confetti = stars ? 24 + stars * 10 : 0
    snd.fanfare(stars)
    haptic(stars >= 2 ? 'success' : 'medium')
    face(stars >= 3 ? 'cheer' : stars === 2 ? 'proud' : stars === 1 ? 'meh' : 'disappointed', 2500)
    let sent = false
    const send = () => {
      if (sent) return
      sent = true
      S.skip = null
      onEnd(s)
    }
    S.skip = send
    setTimeout(send, ms)
    tell()
  },
}

function shakeLoop() {
  if (S.shakeEl?.dataset.shaking) return
  const el = S.shakeEl
  if (!el) return
  el.dataset.shaking = '1'
  let last = performance.now()
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    S.shake = Math.max(0, S.shake - dt * 45)
    if (S.shake < 0.4) {
      el.style.transform = ''
      delete el.dataset.shaking
      return
    }
    el.style.transform = `translate(${(Math.random() - 0.5) * S.shake}px, ${(Math.random() - 0.5) * S.shake}px)`
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/* ---------- Over the square: the words, the streak, the goal, the end ---------- */

/** A word floating up, then gone (the browser animates it: nothing per frame here). */
function FloatWord({ f }: { f: Float }) {
  return (
    <div
      ref={(el) => {
        if (!el || el.dataset.on) return
        el.dataset.on = '1'
        el.animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
            { transform: 'translate(-50%, -90%) scale(1.15)', opacity: 1, offset: 0.18 },
            { transform: 'translate(-50%, -110%) scale(1)', opacity: 1, offset: 0.6 },
            { transform: 'translate(-50%, -190%) scale(0.95)', opacity: 0 },
          ],
          { duration: f.big ? 1000 : 800, easing: 'ease-out', fill: 'forwards' },
        ).onfinish = () => {
          S.floats = S.floats.filter((x) => x.id !== f.id)
        }
      }}
      className={`pointer-events-none absolute font-display font-extrabold whitespace-nowrap ${f.big ? 'text-[26px]' : 'text-[19px]'}`}
      style={{ left: `${Math.max(12, Math.min(88, f.x * 100))}%`, top: `${Math.max(8, Math.min(92, f.y * 100))}%`, color: f.c, WebkitTextStroke: '5px rgba(15,18,48,0.75)', paintOrder: 'stroke fill', opacity: 0 }}
    >
      {f.text}
    </div>
  )
}

/** The score climbing to what it is, the stars popping in one by one. */
function FinaleCard({ f }: { f: Finale }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    let ticks = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 650)
      const v = Math.round(f.score * (1 - (1 - k) * (1 - k)))
      setN(v)
      if (Math.floor(v / 10) > ticks) snd.tick((ticks = Math.floor(v / 10)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [f.score])
  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-[rgba(15,18,48,0.42)]" onPointerDown={(e) => (e.stopPropagation(), S.skip?.())}>
      <div className="animate-pop rounded-3xl bg-white/95 px-7 py-4 text-center shadow-[0_6px_0_rgba(0,0,0,0.25)]">
        <div className="font-display text-[58px] leading-none font-extrabold text-[var(--color-ink)]">{n}</div>
        <div className="mt-1 flex justify-center gap-1">
          {[0, 1, 2].map((k) => (
            <span key={k} className="animate-pop font-display text-[30px] leading-none" style={{ color: k < f.stars ? '#ffc233' : '#dfe2ec', animationDelay: `${250 + k * 140}ms`, animationFillMode: 'both' }}>
              ★
            </span>
          ))}
        </div>
        <div className="mt-1 max-w-[240px] text-[14px] leading-snug font-extrabold text-[var(--color-ink)]">{f.line}</div>
      </div>
    </div>
  )
}

/** Laid over the game's square (JeuShell): the floating words, the streak, the goal at the start, the end. */
export function JuiceHud({ goal }: { goal?: string }) {
  useJuiceState()
  const [showGoal, setShowGoal] = useState(!!goal)
  useEffect(() => {
    if (!goal) return
    snd.go()
    const id = setTimeout(() => setShowGoal(false), 1700)
    return () => clearTimeout(id)
  }, [goal])
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-3xl">
        {S.floats.map((f) => (
          <FloatWord key={f.id} f={f} />
        ))}
        {S.combo >= 2 && !S.finale && (
          <div key={S.combo} className="animate-pop absolute top-2 right-2 rounded-full bg-[#ffc233] px-2.5 py-0.5 font-display text-[17px] font-extrabold text-[#16161c] shadow-[0_3px_0_#e09a00]">
            ×{S.combo}
          </div>
        )}
        {showGoal && goal && !S.finale && (
          <div className="absolute inset-x-0 top-[38%] flex justify-center">
            <div className="animate-pop rounded-2xl bg-[rgba(15,18,48,0.78)] px-4 py-2 text-center font-display text-[19px] leading-tight font-extrabold text-white">{goal}</div>
          </div>
        )}
      </div>
      {S.finale && <FinaleCard f={S.finale} />}
    </>
  )
}

/** The square that shakes (JeuShell's). */
export const shakeRef = (el: HTMLElement | null) => {
  S.shakeEl = el
}

/* ---------- In the 3D: the blocks thrown out ---------- */

const MAX = 72
const box = new THREE.BoxGeometry(1, 1, 1)
const dummy = new THREE.Object3D()
const col = new THREE.Color()
const fwd = new THREE.Vector3()
const v3 = new THREE.Vector3()

/** The bursts' blocks, all in one draw (an instanced mesh): thrown, falling, bouncing, shrinking away. Also where a point of the scene is on the square. */
export function Bursts() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const { camera } = useThree()
  const P = useRef({ pos: new Float32Array(MAX * 3), vel: new Float32Array(MAX * 3), life: new Float32Array(MAX), max: new Float32Array(MAX), size: new Float32Array(MAX), floor: new Float32Array(MAX), spin: new Float32Array(MAX), next: 0 }).current
  useEffect(() => {
    S.project = (p) => {
      v3.set(p[0], p[1], p[2]).project(camera)
      return [(v3.x + 1) / 2, (1 - v3.y) / 2]
    }
    const m = mesh.current
    if (m) {
      for (let i = 0; i < MAX; i++) {
        dummy.position.set(0, -99, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
        m.setColorAt(i, col.set('#ffffff'))
      }
      m.instanceMatrix.needsUpdate = true
    }
    return () => {
      S.project = null
    }
  }, [camera])
  const spawn = (x: number, y: number, z: number, vx: number, vy: number, vz: number, c: string, size: number, floor: number, life: number) => {
    const i = P.next
    P.next = (P.next + 1) % MAX
    P.pos.set([x, y, z], i * 3)
    P.vel.set([vx, vy, vz], i * 3)
    P.life[i] = 0
    P.max[i] = life
    P.size[i] = size
    P.floor[i] = floor
    P.spin[i] = (Math.random() - 0.5) * 14
    mesh.current?.setColorAt(i, col.set(c))
  }
  useFrame((_, dt0) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(0.05, dt0)
    let fresh = false
    while (S.bursts.length) {
      const b = S.bursts.shift()!
      for (let k = 0; k < b.n; k++) {
        const a = Math.random() * Math.PI * 2
        const up = 0.5 + Math.random() * 0.8
        const v = b.power * (0.45 + Math.random() * 0.55)
        spawn(b.p[0], b.p[1], b.p[2], Math.cos(a) * v * 0.8, up * v * 1.3, Math.sin(a) * v * 0.6, b.colors[k % b.colors.length], b.size * (0.7 + Math.random() * 0.6), b.floor, 0.8 + Math.random() * 0.5)
      }
      fresh = true
    }
    // The end's confetti: thrown up in front of the camera.
    if (S.confetti > 0) {
      camera.getWorldDirection(fwd)
      const cx = camera.position.x + fwd.x * 5
      const cy = camera.position.y + fwd.y * 5
      const cz = camera.position.z + fwd.z * 5
      const n = Math.min(S.confetti, 6)
      S.confetti -= n
      for (let k = 0; k < n; k++) spawn(cx + (Math.random() - 0.5) * 4, cy - 1.5, cz + (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 3, 5 + Math.random() * 3, (Math.random() - 0.5) * 1.5, ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc', '#da77f2', '#ff922b'][k % 6], 0.12 + Math.random() * 0.08, -50, 1.6)
      fresh = true
    }
    let any = fresh
    for (let i = 0; i < MAX; i++) {
      if (P.life[i] >= P.max[i]) continue
      any = true
      P.life[i] += dt
      const j = i * 3
      P.vel[j + 1] -= 14 * dt
      P.pos[j] += P.vel[j] * dt
      P.pos[j + 1] += P.vel[j + 1] * dt
      P.pos[j + 2] += P.vel[j + 2] * dt
      const fl = P.floor[i] + P.size[i] / 2
      if (P.pos[j + 1] < fl) {
        // On the floor: a bounce, less each time, sliding to a stop.
        P.pos[j + 1] = fl
        P.vel[j + 1] = Math.abs(P.vel[j + 1]) > 0.8 ? -P.vel[j + 1] * 0.42 : 0
        P.vel[j] *= 0.6
        P.vel[j + 2] *= 0.6
        P.spin[i] *= 0.5
      }
      const k = P.life[i] / P.max[i]
      dummy.position.set(P.pos[j], P.pos[j + 1], P.pos[j + 2])
      dummy.rotation.set(P.life[i] * P.spin[i], P.life[i] * P.spin[i] * 0.7, 0)
      dummy.scale.setScalar(P.size[i] * (k > 0.7 ? Math.max(0.001, (1 - k) / 0.3) : 1))
      if (P.life[i] >= P.max[i]) dummy.scale.setScalar(0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    if (any) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })
  return (
    <instancedMesh ref={mesh} args={[box, undefined, MAX]} frustumCulled={false}>
      <meshLambertMaterial flatShading />
    </instancedMesh>
  )
}
