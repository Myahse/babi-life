import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { JeuShell, Stage, scoreOf } from '../defi/jeux/Shell'
import { MySim } from '../defi/jeux/me'
import { juice, snd } from '../defi/jeux/juice'
import { haptic } from '../../lib/native'
import { t as tr } from '../../lib/i18n'
import { Hens } from '../../world3d/pets'
import { Herd } from '../../world3d/ferme/betes'
import { plant } from '../../world3d/ferme/parts'

// Les jeux de la ferme (the update « agriculture », FermeApp.tsx): three short games, each a minute, in the
// défis' frame (defi/jeux/Shell). Their score only shapes the act a little (backend game.ScoreFactor: 0.9 to 1.1
// of a harvest, of a pen's condition, the eggs found): never money beyond the farm's day's cap.
// - Le semis en ligne: the planter's cord stretched along the row, the hand goes along it: drop the seed when
//   it's over each poquet marked on the ridge, three grains in each, never beside;
// - Le ramassage des œufs: the coop's nests in the straw, the eggs laid one by one: pick each before the hen
//   comes back to sit on it, never take one from under a hen;
// - Mener le troupeau: the herd walks the path to the pasture, the straying ones head for the fields: tap them
//   to bring them back to the path before they reach the crops.

type V3 = [number, number, number]
type End = { onEnd: (score: number) => void }

function Loop({ on }: { on: (dt: number) => void }) {
  const f = useRef(on)
  f.current = on
  useFrame((_, dt) => f.current(juice.dt(Math.min(0.1, dt))))
  return null
}

function Box({ p, s, c, r }: { p: V3; s: V3; c: string; r?: number }) {
  return (
    <mesh position={p} rotation={[0, r ?? 0, 0]}>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

/* ---------- Le semis en ligne ---------- */

const POQUETS = 10
const SPAN = 6.4

export function SemisJeu({ onEnd, crop = 'mais' }: End & { crop?: string }) {
  const st = useRef({
    x: -SPAN / 2 - 0.4,
    speed: 1.15,
    done: [] as number[],
    quality: 0,
    misses: 0,
    over: false,
  })
  const hand = useRef<THREE.Group>(null)
  const [hud, setHud] = useState({ n: 0, row: 1 })
  const [row, setRow] = useState(0)
  const spots = useMemo(() => Array.from({ length: POQUETS }, (_, i) => -SPAN / 2 + (SPAN / (POQUETS - 1)) * i), [])
  const sprout = useMemo(() => plant(crop, 1, () => 0.5), [crop])
  const finish = () => {
    const s = st.current
    if (s.over) return
    s.over = true
    const score = Math.max(5, Math.round((s.quality / (POQUETS * 2)) * 100 - s.misses * 4))
    juice.finish(score, tr('{0} poquets semés sur {1}', { 0: s.done.length, 1: POQUETS * 2 }), onEnd)
  }
  const tick = (dt: number) => {
    const s = st.current
    if (s.over) return
    s.x += s.speed * dt
    if (hand.current) hand.current.position.x = s.x
    if (s.x > SPAN / 2 + 0.6) {
      if (row === 0) {
        setRow(1)
        s.x = -SPAN / 2 - 0.4
        s.speed = 1.5
        setHud((h) => ({ ...h, row: 2 }))
        juice.say(tr('Deuxième ligne, plus vite !'), [0.5, 0.3], '#ffd43b', true)
      } else finish()
    }
  }
  const drop = () => {
    const s = st.current
    if (s.over) return
    const near = spots.map((x, i) => ({ i: i + row * POQUETS, d: Math.abs(x - s.x) })).sort((a, b) => a.d - b.d)[0]
    if (near.d > 0.32 || s.done.includes(near.i)) {
      s.misses++
      juice.bad({ text: tr('À côté !'), soft: true })
      return
    }
    s.done.push(near.i)
    const q = near.d < 0.1 ? 2 : 1
    s.quality += q
    if (q === 2) juice.timing('perfect')
    else juice.timing('good')
    juice.good({ quiet: true })
    haptic('light')
    setHud((h) => ({ ...h, n: s.done.length }))
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => (e.code === 'Space' || e.key === 'Enter') && (e.preventDefault(), drop())
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  const z = row === 0 ? -0.6 : 0.9
  if (import.meta.env.DEV) Object.assign(globalThis, { __semis: { st: st.current, hand } })
  return (
    <JeuShell
      title={tr('Le semis en ligne')}
      how={tr('La main suit le cordeau : sème quand elle passe au-dessus de chaque poquet, jamais à côté.')}
      goal={tr('Deux lignes bien droites !')}
      status={tr('Ligne {0}/2 · {1} poquets', { 0: hud.row, 1: hud.n })}
      controls={
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" onPointerDown={(e) => (e.preventDefault(), drop())}>
          {tr('Semer')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#bfe3ff,#e7f5ff)]" onPointerDown={drop}>
        <Stage decor="terre" cam={[0, 4.2, 6]} look={[0, 0, 0.2]} fov={44}>
          {[-0.6, 0.9].map((rz, k) => (
            <group key={k}>
              <Box p={[0, 0.08, rz]} s={[SPAN + 1, 0.16, 0.6]} c="#8a5634" />
              {/* The cord stretched along the row, its two pegs. */}
              <Box p={[0, 0.3, rz - 0.35]} s={[SPAN + 1, 0.02, 0.02]} c="#f8f9fa" />
              <Box p={[-SPAN / 2 - 0.5, 0.2, rz - 0.35]} s={[0.06, 0.4, 0.06]} c="#a47148" />
              <Box p={[SPAN / 2 + 0.5, 0.2, rz - 0.35]} s={[0.06, 0.4, 0.06]} c="#a47148" />
              {spots.map((x, i) => {
                const done = st.current.done.includes(i + k * POQUETS)
                return (
                  <group key={i} position={[x, 0.17, rz]}>
                    <Box p={[0, 0, 0]} s={[0.22, 0.02, 0.22]} c={done ? '#5a3218' : '#3a2010'} />
                    {done && sprout.map((p, j) => <Box key={j} p={[p[0], p[1] * 0.8, p[2]]} s={[p[3], p[4] * 0.8, p[5]]} c={p[6]} />)}
                  </group>
                )
              })}
            </group>
          ))}
          {/* The hand with its calabash of seeds, and the spot it would drop on (bright on the ridge). */}
          <group ref={hand} position={[-SPAN / 2, 0, z]}>
            <Box p={[0, 1.05, 0]} s={[0.42, 0.36, 0.42]} c="#f2c84b" />
            <Box p={[0, 1.28, 0]} s={[0.2, 0.12, 0.2]} c="#c9a25a" />
            <Box p={[0, 0.8, 0]} s={[0.24, 0.16, 0.3]} c="#8d5524" />
            <Box p={[0, 1.3, -0.5]} s={[0.16, 0.16, 0.9]} c="#e8590c" />
            <Box p={[0, 0.5, 0]} s={[0.04, 0.4, 0.04]} c="#fff3bf" />
            <Box p={[0, 0.19, 0]} s={[0.3, 0.02, 0.3]} c="#ffd43b" />
          </group>
          <MySim pose="pick" p={[3.6, 0, -2.4]} r={-0.5} />
          <Loop on={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/* ---------- Le ramassage des œufs ---------- */

const NESTS: V3[] = [
  [-2.4, 0, -1.2],
  [-0.8, 0, -1.4],
  [0.8, 0, -1.4],
  [2.4, 0, -1.2],
  [-1.6, 0, 0.6],
  [0, 0, 0.8],
  [1.6, 0, 0.6],
]
const EGG_TIME = 30
type Nest = { state: 'empty' | 'egg' | 'hen'; t: number; next: number }

export function OeufsJeu({ onEnd, pintade }: End & { pintade?: boolean }) {
  const nests = useRef<Nest[]>(NESTS.map((_, i) => ({ state: 'empty', t: 0, next: 1 + i * 0.7 })))
  const st = useRef({ left: EGG_TIME, laid: 0, got: 0, bad: 0, over: false })
  const [, redraw] = useState(0)
  const [hud, setHud] = useState({ got: 0, left: EGG_TIME })
  const finish = () => {
    const s = st.current
    if (s.over) return
    s.over = true
    juice.finish(scoreOf(s.got, Math.max(1, s.laid), s.bad), tr('{0} œufs ramassés', { 0: s.got }), onEnd)
  }
  const tick = (dt: number) => {
    const s = st.current
    if (s.over) return
    s.left -= dt
    let changed = false
    for (const n of nests.current) {
      n.t += dt
      if (n.state === 'empty' && n.t >= n.next) ((n.state = 'egg'), (n.t = 0), (n.next = 1.6 + ((s.laid * 0.37) % 1.2)), s.laid++, (changed = true))
      else if (n.state === 'egg' && n.t >= n.next) ((n.state = 'hen'), (n.t = 0), (n.next = 1.6), (changed = true))
      else if (n.state === 'hen' && n.t >= n.next) ((n.state = 'empty'), (n.t = 0), (n.next = 0.8 + ((s.laid * 0.53) % 1.6)), (changed = true))
    }
    if (changed) redraw((k) => k + 1)
    if (Math.ceil(s.left) !== hud.left) setHud({ got: s.got, left: Math.max(0, Math.ceil(s.left)) })
    if (s.left <= 0) finish()
  }
  const tap = (i: number) => {
    const s = st.current
    const n = nests.current[i]
    if (s.over) return
    if (n.state === 'egg') {
      n.state = 'empty'
      n.t = 0
      n.next = 0.9
      s.got++
      juice.good({
        at: [NESTS[i][0], 0.4, NESTS[i][2]],
        colors: ['#fff9db', '#ffe066'],
      })
      snd.good(s.got)
      setHud({ got: s.got, left: Math.ceil(s.left) })
    } else if (n.state === 'hen') {
      s.bad++
      juice.bad({ text: tr('La poule couve !'), soft: true })
    }
    redraw((k) => k + 1)
  }
  return (
    <JeuShell
      title={pintade ? tr('Les œufs des pintades') : tr('Le ramassage des œufs')}
      how={tr('Touche chaque œuf qui apparaît dans la paille avant que la poule revienne s’asseoir dessus. Jamais sous une poule !')}
      goal={tr('Remplis le panier !')}
      status={tr('{0} œufs · {1} s', { 0: hud.got, 1: hud.left })}
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#f4e2b8,#d9b98a)]">
        <Stage decor="terre" cam={[0, 5, 5.2]} look={[0, 0, -0.2]} fov={44}>
          <Box p={[0, 1.2, -2.4]} s={[7, 2.4, 0.2]} c="#a47148" />
          <Box p={[0, 2.5, -1.6]} s={[7.4, 0.1, 2]} c="#adb5bd" />
          {NESTS.map((p, i) => {
            const n = nests.current[i]
            return (
              <group key={i} position={p} onPointerDown={(e) => (e.stopPropagation(), tap(i))}>
                <Box p={[0, 0.1, 0]} s={[0.9, 0.2, 0.9]} c="#e9c46a" />
                <Box p={[0, 0.2, 0]} s={[0.6, 0.06, 0.6]} c="#d4a24a" />
                {n.state === 'egg' && <Box p={[0, 0.38, 0]} s={[0.26, 0.34, 0.26]} c={pintade ? '#e9d8a6' : '#fff9f0'} />}
                {n.state === 'hen' && <Hens p={[0, 0.2, 0]} r={i} />}
                {/* A wide invisible block to tap easily. */}
                <mesh position={[0, 0.4, 0]} visible={false}>
                  <boxGeometry args={[1, 0.8, 1]} />
                </mesh>
              </group>
            )
          })}
          <MySim pose="pick" p={[3.3, 0, 1.9]} r={Math.PI + 0.5} />
          <Loop on={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/* ---------- Mener le troupeau ---------- */

const HERD_TIME = 35
type Head = { x: number; z: number; vx: number; stray: number; lost: boolean }

export function TroupeauJeu({ onEnd, kind = 'chevres' }: End & { kind?: string }) {
  const heads = useRef<Head[]>(
    Array.from({ length: 6 }, (_, i) => ({
      x: (i % 3) * 0.7 - 0.7,
      z: 2.4 - Math.floor(i / 3) * 0.8,
      vx: 0,
      stray: 2 + i * 1.3,
      lost: false,
    })),
  )
  const refs = useRef<(THREE.Group | null)[]>([])
  const st = useRef({
    left: HERD_TIME,
    inBand: 0,
    total: 0,
    saves: 0,
    lost: 0,
    over: false,
    walk: 0,
  })
  const [hud, setHud] = useState({ left: HERD_TIME, saves: 0 })
  const finish = () => {
    const s = st.current
    if (s.over) return
    s.over = true
    const score = Math.round((s.inBand / Math.max(1, s.total)) * 100 - s.lost * 6)
    juice.finish(Math.max(5, score), tr('{0} bêtes ramenées sur le chemin', { 0: s.saves }), onEnd)
  }
  const tick = (dt: number) => {
    const s = st.current
    if (s.over) return
    s.left -= dt
    s.walk += dt
    heads.current.forEach((h, i) => {
      h.stray -= dt
      if (h.stray <= 0 && h.vx === 0) h.vx = (i % 2 ? 1 : -1) * (0.7 + ((i * 0.37 + s.walk) % 0.5))
      h.x += h.vx * dt
      // The herd walks on toward the pasture (−z), looping round for the game.
      h.z -= 0.35 * dt
      if (h.z < -3.4) h.z += 6.2
      if (Math.abs(h.x) > 3.2 && !h.lost) {
        h.lost = true
        s.lost++
        juice.bad({ text: tr('Dans le champ du voisin !'), soft: true })
        h.x = Math.sign(h.x) * 0.6
        h.vx = 0
        h.stray = 2 + i
        h.lost = false
      }
      s.total += dt
      if (Math.abs(h.x) < 1.2) s.inBand += dt
      const g = refs.current[i]
      if (g) {
        g.position.set(h.x, 0, h.z)
        g.rotation.y = h.vx ? (h.vx > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI
      }
    })
    if (Math.ceil(s.left) !== hud.left) setHud({ left: Math.max(0, Math.ceil(s.left)), saves: s.saves })
    if (s.left <= 0) finish()
  }
  const tap = (i: number) => {
    const h = heads.current[i]
    if (h.vx === 0) return
    h.vx = 0
    h.x *= 0.3
    h.stray = 2.5 + ((i * 0.9) % 2)
    st.current.saves++
    juice.good({ at: [h.x, 0.6, h.z], colors: ['#c3fae8', '#69db7c'] })
    haptic('light')
    setHud((x) => ({ ...x, saves: st.current.saves }))
  }
  return (
    <JeuShell
      title={tr('Mener le troupeau au pâturage')}
      how={tr('Le troupeau suit le chemin. Touche vite la bête qui s’écarte vers les champs pour la ramener avec les autres.')}
      goal={tr('Personne dans les champs !')}
      status={tr('{0} ramenées · {1} s', { 0: hud.saves, 1: hud.left })}
      tall
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#bfe3ff,#e7f5ff)]">
        <Stage decor="herbe" cam={[0, 6, 6.5]} look={[0, 0, -0.5]} fov={46}>
          {/* The path, the fields on each side (the neighbours' maize), the pasture ahead. */}
          <Box p={[0, 0.02, 0]} s={[2.4, 0.04, 8]} c="#c9a25a" />
          {[-1, 1].map((k) => (
            <group key={k}>
              <Box p={[k * 3.6, 0.04, 0]} s={[1.6, 0.08, 8]} c="#7a4a2a" />
              {Array.from({ length: 6 }, (_, j) => (
                <Box key={j} p={[k * 3.6, 0.5, -3.4 + j * 1.3]} s={[0.12, 0.9, 0.12]} c="#4c8a3a" />
              ))}
            </group>
          ))}
          <Box p={[0, 0.03, -4.6]} s={[8, 0.06, 1.6]} c="#82c91e" />
          {heads.current.map((_, i) => (
            <group key={i} ref={(r) => void (refs.current[i] = r)} onPointerDown={(e) => (e.stopPropagation(), tap(i))}>
              <Herd kind={kind} n={1} seed={i} w={0.5} d={0.5} />
              <mesh position={[0, 0.5, 0]} visible={false}>
                <boxGeometry args={[1.2, 1, 1.2]} />
              </mesh>
            </group>
          ))}
          <MySim pose="point" p={[0, 0, 3.2]} r={Math.PI} />
          <Loop on={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}
