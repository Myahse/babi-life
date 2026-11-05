import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, rnd, useHud, fx } from './kit'
import { Stage3D, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { t } from '../../../lib/i18n'

// « Le retour de Tonton Gilbert », chapter 2 (game/epreuves.go): the arrivals hall, the belt going round
// with everyone's luggage. Tata Odette's list of Tonton's: the big red suitcase with the yellow ribbon,
// the wax bag, the carton tied up with « GILBERT » on it. Tap them as they go by; not the others (their
// owners shout). And at the end, little pink suitcases with GILBERT on them… whose are those? The hall in
// the game's 3D blocks: the belt's black slats going round, the chute, the luggage in blocks riding it
// (the red one and its yellow ribbon, the wax bag, the tied carton…); tapped, it's lifted off. The same
// rule and score.

const TIME = 45
type Kind = 'rouge' | 'wax' | 'carton' | 'rose' | 'noire' | 'bleue' | 'grise' | 'sac'
const HIS: Kind[] = ['rouge', 'wax', 'carton']
type Bag = { kind: Kind; u: number; gone: number; good: boolean; id: number; taken: boolean }

export default function AvionGilbert({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ bags: [] as Bag[], next: 0, got: 0, wrong: 0, missed: 0, over: false, now: 0, pinks: 0, his: 0, ids: 0, started: false })
  const [bags, setBags] = useState<Bag[]>([])
  const [hud, setHud] = useHud({ left: TIME, got: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const left = TIME - now
    if (!st.over && left <= 0) {
      st.over = true
      setTimeout(() => onEnd(Math.round(Math.max(0, Math.min(100, (st.got / Math.max(1, st.his)) * 90 - st.wrong * 6 + (st.pinks ? 10 : 0))))), 900)
    }
    // A new piece of luggage out of the chute; his now and then, and near the end, the pink ones.
    if (!st.over && now >= st.next) {
      const r = Math.random()
      const kind: Kind = now > TIME * 0.65 && r < 0.18 ? 'rose' : r < 0.36 ? HIS[Math.floor(Math.random() * 3)] : (['noire', 'bleue', 'grise', 'sac'] as Kind[])[Math.floor(Math.random() * 4)]
      st.bags.push({ kind, u: 0, gone: 0, good: HIS.includes(kind) || kind === 'rose', id: ++st.ids, taken: false })
      if (HIS.includes(kind) || kind === 'rose') st.his++
      st.next = now + rnd(0.7, 1.2)
      setBags(st.bags.slice())
    }
    const speed = 0.07 + now * 0.0012
    let changed = false
    for (const b of st.bags) {
      if (b.gone) continue
      b.u += speed * dt
      // Round once and back into the chute: missed if it was his.
      if (b.u >= 1) {
        b.gone = now
        if (b.good) st.missed++
      }
    }
    const kept = st.bags.filter((b) => !b.gone || now - b.gone < 0.5)
    if (kept.length !== st.bags.length) ((st.bags = kept), (changed = true))
    if (changed) setBags(kept.slice())
    setHud({ left: Math.max(0, left), got: st.got })
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    let pick: Bag | null = null
    let bd = Infinity
    for (const b of st.bags) {
      if (b.gone) continue
      const [x, z] = belt(b.u)
      const p = screenOf(x, 0.75, z)
      const q = screenOf(x + 0.45, 0.75, z)
      const d = Math.hypot(e.x - p.x, e.y - p.y)
      if (d < Math.max(30, Math.abs(q.x - p.x) * 1.2) && d < bd) ((bd = d), (pick = b))
    }
    if (!pick) return
    const b = pick as Bag
    b.gone = st.now
    b.taken = true
    if (b.good) {
      st.got++
      if (b.kind === 'rose' && !st.pinks++) setFlash({ text: t('Des petites valises roses… « GILBERT » ?!'), at: Date.now() })
      beep(740, 0.1, 0.12)
      fx.good(e.x, e.y, b.kind === 'rose' ? '?!' : '+1')
    } else {
      st.wrong++
      beep(180, 0.25, 0.12, { type: 'square' })
      setFlash({ text: t('Eh ! C’est ma valise !'), at: Date.now() })
      fx.bad(e.x, e.y, '✗')
    }
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 8, 4.2]} look={[0, 0, 0.2]} fov={40} fit={[RX * 2 + 1.4, RZ * 2 + 1.6]} bg="#dee2e6" touch={touch} onReady={() => (s.current.started = true)}>
        <Hall />
        <Belt s={s} bags={bags} tick={tick} />
      </Stage3D>
      <Hud title={t('Les bagages de Tonton')} left={hud.left} done={t('{n} pris', { n: hud.got })} />
      <div className="pointer-events-none absolute inset-x-3 top-14 z-10 flex flex-wrap gap-1 text-[11px] font-extrabold">
        <span className="rounded-full bg-white/90 px-2 py-1 text-[#c92a2a]">{t('Valise rouge, ruban jaune')}</span>
        <span className="rounded-full bg-white/90 px-2 py-1 text-[#e8590c]">{t('Sac en wax')}</span>
        <span className="rounded-full bg-white/90 px-2 py-1 text-[#8a5a2b]">{t('Carton « GILBERT »')}</span>
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-[#343a40]">{t('Touche les bagages de Tonton quand ils passent. Pas ceux des autres !')}</p>
    </div>
  )
}

/** The belt's loop in the hall (u from 0 to 1): a long oval, the chute at the top. */
const TALL = typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.2
const RX = 2.0
const RZ = TALL ? 3.6 : 2.4
function belt(u: number): [number, number] {
  const a = -Math.PI / 2 + u * Math.PI * 2
  return [Math.cos(a) * RX, Math.sin(a) * RZ]
}

/** The arrivals hall: the floor, the belt's steel edge and its black rubber, the chute the luggage comes out of. */
function Hall() {
  const slats = useMemo(() => Array.from({ length: 56 }, (_, i) => belt(i / 56)), [])
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[12, 0.2, 14]} c="#ced4da" />
      <Box p={[0, 0.25, 0]} s={[RX * 2 - 1.0, 0.5, RZ * 2 - 1.0]} c="#adb5bd" />
      {slats.map(([x, z], i) => (
        <Box key={i} p={[x, 0.42, z]} s={[0.6, 0.06, 0.6]} c={i % 2 ? '#2b2b2b' : '#343a40'} />
      ))}
      <Box p={[0, 1.0, -RZ - 0.6]} s={[1.6, 2.0, 0.8]} c="#495057" />
      <Box p={[0, 0.7, -RZ - 0.15]} s={[1.0, 0.7, 0.2]} c="#212529" />
    </group>
  )
}

/** A piece of luggage in blocks, by its kind. */
function Luggage({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'rouge':
      return (
        <group>
          <Box p={[0, 0.18, 0]} s={[0.7, 0.36, 0.48]} c="#e03131" />
          <Box p={[0, 0.18, 0]} s={[0.1, 0.38, 0.5]} c="#ffd43b" />
          <Box p={[0, 0.4, 0]} s={[0.24, 0.06, 0.06]} c="#212529" />
        </group>
      )
    case 'wax':
      return (
        <group>
          <Box p={[0, 0.16, 0]} s={[0.58, 0.32, 0.4]} c="#e8590c" />
          {[-0.15, 0.08, 0.2].map((x, i) => (
            <Box key={x} p={[x, 0.33, (i - 1) * 0.1]} s={[0.12, 0.02, 0.12]} c={['#2f9e44', '#ffd43b', '#1c7ed6'][i]} />
          ))}
          <Box p={[0, 0.4, 0]} s={[0.4, 0.04, 0.04]} c="#8a5a2b" />
        </group>
      )
    case 'carton':
      return (
        <group>
          <Box p={[0, 0.2, 0]} s={[0.56, 0.4, 0.44]} c="#c08a4a" />
          <Box p={[0, 0.2, 0]} s={[0.04, 0.42, 0.46]} c="#e9ecef" />
          <Box p={[0, 0.2, 0]} s={[0.58, 0.04, 0.46]} c="#e9ecef" />
          <Box p={[0, 0.41, 0.12]} s={[0.4, 0.01, 0.1]} c="#212529" />
        </group>
      )
    case 'rose':
      return <Box p={[0, 0.14, 0]} s={[0.44, 0.28, 0.32]} c="#f783ac" />
    case 'noire':
      return <Box p={[0, 0.18, 0]} s={[0.7, 0.36, 0.48]} c="#212529" />
    case 'bleue':
      return <Box p={[0, 0.17, 0]} s={[0.66, 0.34, 0.46]} c="#1c7ed6" />
    case 'grise':
      return <Box p={[0, 0.17, 0]} s={[0.62, 0.34, 0.44]} c="#868e96" />
    default:
      return (
        <group>
          <Box p={[0, 0.15, 0]} s={[0.55, 0.3, 0.36]} c="#5c940d" />
          <Box p={[0, 0.34, 0]} s={[0.3, 0.06, 0.04]} c="#2b2b2b" />
        </group>
      )
  }
}

/** The luggage going round on the belt (turned with it); taken, lifted off; back in the chute, gone. */
function Belt({ s, bags, tick }: { s: React.RefObject<{ bags: Bag[]; now: number }>; bags: Bag[]; tick: (dt: number) => void }) {
  const refs = useRef(new Map<number, THREE.Group>())
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    for (const b of st.bags) {
      const g = refs.current.get(b.id)
      if (!g) continue
      const [x, z] = belt(Math.min(1, b.u))
      const [nx, nz] = belt(Math.min(1, b.u) + 0.01)
      const since = b.gone ? st.now - b.gone : 0
      g.position.set(x, 0.45 + (b.taken ? since * 4 : 0), z)
      g.rotation.y = Math.atan2(nx - x, nz - z)
      g.scale.setScalar(b.gone ? Math.max(0.01, 1 - since * 2) : Math.min(1, b.u * 25))
    }
  })
  return (
    <group>
      {bags.map((b) => (
        <group key={b.id} ref={(el) => void (el ? refs.current.set(b.id, el) : refs.current.delete(b.id))} scale={0.01}>
          <Luggage kind={b.kind} />
        </group>
      ))}
    </group>
  )
}
