import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, rnd, useHud, fx } from './kit'
import { Stage3D, groundAt, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { Prop } from '../jeux/props'
import { BlockPerson } from './people'
import { t } from '../../../lib/i18n'

// « La voix de Bouaké », chapter 3 (game/epreuves.go): the concert in the rue d'ambiance, the crowd at
// night under the garlands, and somewhere in it the singer the whole of Bouaké talks about, humming. In
// the street in the game's 3D blocks: the stage and its speakers at the end, the garlands blinking, the
// crowd swaying, arms going up (people.tsx). The finger is the ear (a ring of light on the ground under
// it): the closer to her, the louder her song (and from her side: left or right), and the ear's gauge
// fills. Let go on the one who sings. Three times (she slips off elsewhere in the crowd); a wrong one costs
// a few seconds.

const TIME = 50
const ROUNDS = 3
const PENALTY = 4
const PEOPLE = 34
// Her song, the notes of a pentatonic tune (Hz), one every BEAT.
const TUNE = [392, 440, 523, 587, 523, 440, 392, 330, 392, 440, 392, 330, 294, 330, 392, 0]
const BEAT = 0.26
/** The crowd's street: half its width, its depth. */
const HW = 2.6
const Z0 = -1.6
const Z1 = 3.4

const CLOTH = ['#e8590c', '#1c7ed6', '#2f9e44', '#f08c00', '#ae3ec9', '#e03131', '#fab005', '#0ca678', '#fff']
const SKINS = ['#6b4430', '#8d5a3b', '#4a2e20', '#a06a45']
type Body = { x: number; z: number; c: string; head: string; sway: number; h: number }

export default function VoixBouake({ onEnd }: { onEnd: (score: number) => void }) {
  const crowd = useMemo<Body[]>(
    () =>
      Array.from({ length: PEOPLE }, (_, i) => ({ x: rnd(-HW, HW), z: rnd(Z0, Z1), c: CLOTH[i % CLOTH.length], head: Math.random() < 0.4 ? CLOTH[(i * 3) % CLOTH.length] : '', sway: rnd(0, 6), h: rnd(0.85, 1.1) })),
    [],
  )
  const s = useRef({ who: Math.floor(Math.random() * PEOPLE), found: 0, lost: 0, ear: new THREE.Vector3(0, 0, Z0), next: 0, note: 0, over: false, seen: -1, now: 0, started: false, near: 0 })
  const [hud, setHud] = useHud({ left: TIME, found: 0, near: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const v = useMemo(() => new THREE.Vector3(), [])

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const left = TIME - now - st.lost
    if (!st.over && (left <= 0 || st.found >= ROUNDS)) {
      st.over = true
      setTimeout(() => onEnd(Math.round((st.found / ROUNDS) * 80 + (st.found >= ROUNDS ? Math.max(0, left / TIME) * 20 : 0))), 1000)
    }
    // How near the ear is to her (on the ground), her song as loud, from her side.
    const her = crowd[st.who]
    const d = Math.hypot(st.ear.x - her.x, st.ear.z - her.z)
    const near = Math.max(0, 1 - d / 3.6)
    st.near = near
    if (!st.over && now >= st.next) {
      const f = TUNE[st.note % TUNE.length]
      if (f) beep(f, BEAT * 0.9, 0.01 + 0.22 * near * near, { type: 'triangle', pan: (her.x - st.ear.x) / HW })
      if (st.note % 2 === 0) beep(90, 0.08, 0.05, { type: 'square' })
      st.note++
      st.next = now + BEAT
    }
    setHud({ left: Math.max(0, left), found: st.found, near })
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (groundAt(e.x, e.y, 0.7, v)) st.ear.set(v.x, 0, v.z)
    if (e.kind !== 'up' || st.over) return
    // The one under the finger on the screen (the front ones first).
    let pick = -1
    let bd = Infinity
    crowd.forEach((b, i) => {
      const a = screenOf(b.x, b.h * 0.7, b.z)
      const top = screenOf(b.x, b.h * 1.45, b.z)
      const r = Math.abs(top.y - a.y) * 1.1
      const dd = Math.hypot(e.x - a.x, e.y - (a.y + top.y) / 2)
      if (dd < r && dd - b.z * 3 < bd) ((bd = dd - b.z * 3), (pick = i))
    })
    if (pick < 0) return
    if (pick === st.who) {
      st.found++
      st.seen = pick
      beep(523, 0.15, 0.15)
      beep(659, 0.15, 0.15)
      beep(784, 0.3, 0.15)
      setFlash({ text: t('C’est elle !'), at: Date.now() })
      fx.good(e.x, e.y, '♪ ♪')
      if (st.found >= ROUNDS) fx.win()
      setTimeout(() => {
        st.seen = -1
        if (st.found < ROUNDS) {
          let n = st.who
          while (n === st.who) n = Math.floor(Math.random() * PEOPLE)
          st.who = n
        }
      }, 1100)
    } else {
      st.lost += PENALTY
      beep(160, 0.2, 0.12, { type: 'square' })
      fx.bad(e.x, e.y, `−${PENALTY} s`)
    }
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 5.5, 7.6]} look={[0, 0.6, 0.6]} fov={40} fit={[HW * 2 + 0.6, Z1 - Z0 + 1.2]} bg="#141033" light={0.75} touch={touch} onReady={() => (s.current.started = true)}>
        <Street />
        <Crowd crowd={crowd} s={s} tick={tick} />
      </Stage3D>
      <Hud title={t('La voix de Bouaké')} left={hud.left} done={`${hud.found}/${ROUNDS}`}>
        <div className="h-3 w-16 overflow-hidden rounded-full bg-black/45">
          <div className="h-full bg-[#ffd43b]" style={{ width: `${Math.round(hud.near * 100)}%` }} />
        </div>
      </Hud>
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Monte le son. Promène le doigt : plus tu es près, plus elle chante fort. Lâche sur elle.')}</p>
    </div>
  )
}

const BULBS = ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc']
/** The street at night: the tarmac, the stage at the end with its speakers, the garlands blinking. */
function Street() {
  const bulbs = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = bulbs.current
    if (!g) return
    const now = performance.now() / 1000
    g.children.forEach((m, i) => (((m as THREE.Mesh).material as THREE.MeshLambertMaterial).emissiveIntensity = 0.5 + 0.5 * Math.sin(now * 3 + i)))
  })
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[12, 0.2, 14]} c="#2b2b33" />
      {/* The stage, its speakers, its lights */}
      <Box p={[0, 0.3, Z0 - 1.4]} s={[4.4, 0.6, 1.4]} c="#3b2a4a" />
      <Box p={[0, 1.8, Z0 - 2.1]} s={[4.6, 2.4, 0.2]} c="#20183a" />
      {[-2.6, 2.6].map((x) => (
        <Box key={x} p={[x, 0.8, Z0 - 1.2]} s={[0.6, 1.6, 0.6]} c="#16161c" />
      ))}
      {[-1.4, 0, 1.4].map((x, i) => (
        <Box key={x} p={[x, 3.0, Z0 - 1.9]} s={[0.3, 0.2, 0.3]} c={BULBS[i]} glow={1} />
      ))}
      {/* The houses on both sides, dark */}
      <Box p={[-4.3, 1.2, 0.5]} s={[2, 2.4, 8]} c="#20183a" />
      <Box p={[4.3, 1.4, 0.5]} s={[2, 2.8, 8]} c="#241c40" />
      {/* The garlands across the street */}
      <group ref={bulbs}>
        {Array.from({ length: 28 }, (_, i) => {
          const row = i % 2
          const k = Math.floor(i / 2) / 13
          return (
            <mesh key={i} position={[-HW - 0.4 + k * (HW * 2 + 0.8), 2.5 - Math.sin(k * Math.PI) * 0.4, row ? 0 : 2]}>
              <boxGeometry args={[0.12, 0.12, 0.12]} />
              <meshLambertMaterial color={BULBS[i % 4]} emissive={BULBS[i % 4]} emissiveIntensity={1} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

/** The crowd swaying to the music, arms going up now and then; the ear's ring on the ground; her note once found. */
function Crowd({ crowd, s, tick }: { crowd: Body[]; s: React.RefObject<{ ear: THREE.Vector3; seen: number; near: number }>; tick: (dt: number) => void }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const ring = useRef<THREE.Mesh>(null)
  const note = useRef<THREE.Group>(null)
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    const now = performance.now() / 1000
    crowd.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.y = Math.abs(Math.sin(now * 4 + b.sway)) * 0.05
      g.rotation.z = Math.sin(now * 2 + b.sway) * 0.06
      // Arms: up in the air a moment, then down; the one found raises both.
      const up = i === st.seen || Math.sin(now * 3 + b.sway) > 0.55
      const arms = g.children[1] as THREE.Group
      const a = up ? Math.PI * 0.85 : 0.1
      arms.children[0].rotation.z += (-a - arms.children[0].rotation.z) * 0.2
      arms.children[1].rotation.z += (a - arms.children[1].rotation.z) * 0.2
    })
    const r = ring.current
    if (r) {
      r.position.set(st.ear.x, 0.02, st.ear.z)
      const k = 1 + st.near * 0.6
      r.scale.set(k, k, k)
      ;(r.material as THREE.MeshBasicMaterial).opacity = 0.35 + st.near * 0.6
    }
    const n = note.current
    if (n) {
      n.visible = st.seen >= 0
      if (st.seen >= 0) {
        const b = crowd[st.seen]
        n.position.set(b.x + 0.25, b.h * 1.5 + 0.3 + Math.sin(now * 5) * 0.08, b.z)
      }
    }
  })
  return (
    <group>
      {crowd.map((b, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} position={[b.x, 0, b.z]} rotation={[0, i % 2 ? 0.4 : -0.4, 0]}>
          <BlockPerson shirt={b.c} pants="#343a40" skin={SKINS[i % 4]} cap={b.head || undefined} h={b.h} w={0.95} />
        </group>
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.48, 16]} />
        <meshBasicMaterial color="#ffd43b" transparent opacity={0.5} />
      </mesh>
      <group ref={note} scale={0.4} visible={false}>
        <Prop id="note-musique" />
      </group>
    </group>
  )
}
