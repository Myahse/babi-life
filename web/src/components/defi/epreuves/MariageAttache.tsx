import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Hud, beep, fx, useHud } from './kit'
import { Stage3D, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { MySim } from '../jeux/me'
import { BlockPerson } from './people'
import { t } from '../../../lib/i18n'

// « Le mariage attaché », chapter 4 (game/epreuves.go): the party at the maquis, the pagne brought back
// from Man, tante Akoua in tears, and the DJ putting on the coupé-décalé. The dance steps come up the
// four lanes (left, down, up, right): tap the lane's pad as the step reaches the line. « Parfait », « Bien »,
// or missed; the combo keeps the crowd going. On the maquis's floor at night in the game's 3D blocks: the
// four lanes running toward you, the steps (block arrows in each lane's colour) sliding down them to the
// line, the pads lighting under the finger, and beyond, your own Sim dancing with the crowd jumping on the
// beat under the garlands. The same rule and score.

const TIME = 42
const BPM = 112
const LANES = 4
const RISE = 1.6 // seconds a step takes to come up
const COLORS = ['#e03131', '#1c7ed6', '#2f9e44', '#fab005']

type Step = { lane: number; at: number; hit: '' | 'parfait' | 'bien' | 'rate' }
type S = { steps: Step[]; now: number; beat: number; combo: number; best: number; points: number; over: boolean; pads: number[]; started: boolean }

// The steps: on the beat, sometimes on the half-beat, now and then two at once.
function chart(): Step[] {
  const beat = 60 / BPM
  const out: Step[] = []
  for (let b = 4; b * beat < TIME - 2; b++) {
    const at = b * beat
    const dense = at > TIME * 0.5
    if (Math.random() < (dense ? 0.85 : 0.65)) out.push({ lane: Math.floor(Math.random() * LANES), at, hit: '' })
    if (dense && Math.random() < 0.3) out.push({ lane: Math.floor(Math.random() * LANES), at: at + beat / 2, hit: '' })
  }
  return out
}

export default function MariageAttache({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef<S>({ steps: chart(), now: 0, beat: -1, combo: 0, best: 0, points: 0, over: false, pads: [0, 0, 0, 0], started: false })
  const [hud, setHud] = useHud({ left: TIME, combo: 0 })
  const [judge, setJudge] = useState({ text: '', at: 0, color: '#fff' })

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const left = TIME - now
    // The music: the kick on each beat, the bell on the off-beat.
    const b = Math.floor(now / (60 / BPM))
    if (b !== st.beat && !st.over) {
      st.beat = b
      beep(b % 2 ? 110 : 80, 0.1, 0.12, { type: 'sine', to: 40 })
      if (b % 4 === 2) beep(880, 0.05, 0.04, { type: 'square' })
    }
    // Missed: past the line.
    for (const sp of st.steps)
      if (!sp.hit && now - sp.at > 0.2) {
        sp.hit = 'rate'
        st.combo = 0
        setJudge({ text: t('Raté'), at: Date.now(), color: '#ff8787' })
      }
    if (!st.over && left <= 0) {
      st.over = true
      const max = st.steps.length * 2
      const score = Math.round(Math.min(100, (st.points / Math.max(1, max)) * 100 + Math.min(10, st.best / 3)))
      if (score >= 80) fx.win()
      setTimeout(() => onEnd(score), 900)
    }
    setHud({ left: Math.max(0, left), combo: st.combo })
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over || !st.started) return
    // The lane under the finger: the nearest lane's middle at the line, on the screen.
    let l = -1
    let bd = Infinity
    for (let k = 0; k < LANES; k++) {
      const p = screenOf(laneX(k), 0, LINE)
      const d = Math.abs(p.x - e.x)
      if (d < bd) ((bd = d), (l = k))
    }
    if (l < 0) return
    st.pads[l] = 1
    // The nearest step of the lane, still to hit.
    let best: Step | null = null
    for (const sp of st.steps) if (!sp.hit && sp.lane === l && (!best || Math.abs(sp.at - st.now) < Math.abs(best.at - st.now))) best = sp
    const off = best ? Math.abs(best.at - st.now) : 9
    const p = screenOf(laneX(l), 0.2, LINE)
    if (best && off < 0.07) {
      best.hit = 'parfait'
      st.points += 2
      st.combo++
      setJudge({ text: t('Parfait !'), at: Date.now(), color: '#ffe066' })
      fx.burst(p.x, p.y, [COLORS[l], '#fff'], 12, 180)
    } else if (best && off < 0.16) {
      best.hit = 'bien'
      st.points += 1
      st.combo++
      setJudge({ text: t('Bien'), at: Date.now(), color: '#69db7c' })
      fx.burst(p.x, p.y, [COLORS[l]], 6, 120)
    } else {
      st.combo = 0
      fx.shake(3)
    }
    st.best = Math.max(st.best, st.combo)
    if (st.combo > 0 && st.combo % 10 === 0) fx.float(t('Combo {n} !', { n: st.combo }), p.x, p.y - 80, '#ffe066')
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 4.2, LINE + 4.8]} look={[0, 0.3, -1.6]} fov={50} bg="#1b1035" light={0.7} touch={touch} onReady={() => (s.current.started = true)}>
        <Floor s={s} tick={tick} />
      </Stage3D>
      <Hud title={t('La danse de la fête')} left={hud.left} done={hud.combo >= 2 ? t('Combo {n}', { n: hud.combo }) : undefined} />
      {judge.text && (
        <div key={judge.at} className="animate-pop pointer-events-none absolute inset-x-0 top-[30%] text-center font-display text-3xl font-extrabold drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]" style={{ color: judge.color }}>
          {judge.text}
        </div>
      )}
    </div>
  )
}

/** The runway of the steps: four lanes on the floor, from far off (the steps appear) to the line near you. */
const LINE = 1.6
const FAR = -6
const laneX = (l: number) => (l - (LANES - 1) / 2) * 0.85
/** The arrow of each lane in little blocks (◀ ▼ ▲ ▶), lying on the floor. */
/** An arrow pointing away (▲), its blocks; turned for each lane. */
const ARROW: [number, number][] = [[0, -1], [-1, 0], [0, 0], [1, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1]]
const TURN = [Math.PI / 2, Math.PI, 0, -Math.PI / 2]
function Arrow({ l }: { l: number }) {
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[0.6, 0.12, 0.5]} c={COLORS[l]} />
      <group rotation={[0, TURN[l], 0]}>
        {ARROW.map(([x, z], i) => (
          <Box key={i} p={[x * 0.08, 0.13, z * 0.08]} s={[0.08, 0.03, 0.08]} c="#ffffff" />
        ))}
      </group>
    </group>
  )
}

const BULBS = ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc']
const CROWD = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#fab005', '#e03131', '#0ca678', '#f8f9fa']

/** The maquis's floor at night: the lanes and their line, the steps coming, the pads lighting, your own Sim
 *  dancing beyond, the crowd bobbing on the beat round it, the garlands. */
function Floor({ s, tick }: { s: React.RefObject<S>; tick: (dt: number) => void }) {
  const steps = useRef<THREE.Group>(null)
  const pads = useRef<(THREE.MeshLambertMaterial | null)[]>([])
  const crowd = useRef<THREE.Group>(null)
  const bulbs = useRef<THREE.Group>(null)
  const st = s.current
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const now = st.now
    const g = steps.current
    if (g)
      st.steps.forEach((sp, i) => {
        const m = g.children[i]
        if (!m) return
        const k = (sp.at - now) / RISE
        const shown = !(sp.hit === 'parfait' || sp.hit === 'bien') && k <= 1 && k >= -0.15
        m.visible = shown
        if (shown) m.position.z = LINE + k * (FAR - LINE)
      })
    pads.current.forEach((m, l) => {
      if (!m) return
      st.pads[l] = Math.max(0, st.pads[l] - Math.min(raw, 0.05) * 6)
      m.emissiveIntensity = 0.15 + st.pads[l] * 0.9
    })
    // On the beat: the crowd jumps, the garlands blink.
    const pulse = 1 - (((now * BPM) / 60) % 1)
    const c = crowd.current
    if (c) c.children.forEach((m, i) => (m.position.y = pulse * pulse * 0.12 * (i % 2 ? 1 : 0.7)))
    const b = bulbs.current
    if (b) b.children.forEach((m, i) => (((m as THREE.Mesh).material as THREE.MeshLambertMaterial).emissiveIntensity = 0.4 + 0.6 * ((Math.floor(now * 2) + i) % 2)))
  })
  return (
    <group>
      <Box p={[0, -0.1, -3]} s={[14, 0.2, 16]} c="#2b1d45" />
      {/* The lanes, their line, the pads */}
      {Array.from({ length: LANES }, (_, l) => (
        <group key={l}>
          <Box p={[laneX(l), 0.005, (LINE + FAR) / 2]} s={[0.72, 0.01, LINE - FAR + 0.6]} c="#3b2a5c" />
          <mesh position={[laneX(l), 0.03, LINE]}>
            <boxGeometry args={[0.74, 0.04, 0.5]} />
            <meshLambertMaterial ref={(el) => void (pads.current[l] = el)} color={COLORS[l]} emissive={COLORS[l]} emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}
      <Box p={[0, 0.02, LINE]} s={[LANES * 0.85 + 0.2, 0.02, 0.06]} c="#ffffff" />
      <group ref={steps}>
        {st.steps.map((sp, i) => (
          <group key={i} position={[laneX(sp.lane), 0, FAR]} visible={false}>
            <Arrow l={sp.lane} />
          </group>
        ))}
      </group>
      {/* Your own Sim dancing beyond the lanes, the crowd round it */}
      <MySim pose="dance" p={[0, 0, FAR - 1.2]} scale={0.9} />
      <group ref={crowd}>
        {CROWD.map((c, i) => {
          const a = (i / CROWD.length) * Math.PI - Math.PI
          return (
            <group key={i} position={[Math.cos(a) * 3.2, 0, FAR - 1.4 + Math.sin(a) * 1.4]} rotation={[0, -a - Math.PI / 2, 0]}>
              <BlockPerson shirt={c} pants="#343a40" skin={['#6b4430', '#8d5a3b', '#4a2e20', '#a06a45'][i % 4]} h={0.95 + (i % 3) * 0.08} w={0.95} />
            </group>
          )
        })}
      </group>
      <group ref={bulbs}>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i} position={[-4 + (i / 15) * 8, 3.2 - Math.sin((i / 15) * Math.PI) * 0.5, FAR - 0.5]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshLambertMaterial color={BULBS[i % 4]} emissive={BULBS[i % 4]} emissiveIntensity={1} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
