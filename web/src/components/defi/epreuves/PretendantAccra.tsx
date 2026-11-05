import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, fx } from './kit'
import { Stage3D, groundAt, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { t } from '../../../lib/i18n'

// « Le prétendant d'Accra », chapter 2 (game/epreuves.go): at the market, what a real kente is worth, and
// how to tell it: the hand-woven strips repeat their blocks in a strict order, the copy gets it wrong.
// Each strip has a block missing: pick the one the weaver would have put there. Eight strips, the
// patterns longer and finer as they go. On the stall in the game's 3D blocks: the strip laid on its cloth,
// each block woven in little raised blocks (bars, zigzags, checks), the hole a white frame; the four choices
// near you: drag the right one into the hole (or tap it). The same rule and score.

const TIME = 60
const ROUNDS = 8
const COLORS = ['#f2b705', '#1b7f3b', '#c1121f', '#111111', '#1d4e89']
type Block = { c: number; m: number } // colour, motif (0 bars, 1 zigzag, 2 checks)

function strip(round: number) {
  const period = 2 + Math.min(3, Math.floor(round / 2))
  const twoWay = round >= 4
  const base: Block[] = Array.from({ length: period }, () => ({ c: Math.floor(Math.random() * COLORS.length), m: twoWay ? Math.floor(Math.random() * 3) : 0 }))
  // Not all the same.
  if (base.every((b) => b.c === base[0].c && b.m === base[0].m)) base[0] = { c: (base[0].c + 1) % COLORS.length, m: base[0].m }
  const len = period * 2 + 2
  const blocks = Array.from({ length: len }, (_, i) => base[i % period])
  const hole = period + Math.floor(Math.random() * (len - period))
  const right = blocks[hole]
  const opts: Block[] = [right]
  while (opts.length < 4) {
    const o = { c: Math.floor(Math.random() * COLORS.length), m: twoWay ? Math.floor(Math.random() * 3) : 0 }
    if (!opts.some((x) => x.c === o.c && x.m === o.m)) opts.push(o)
  }
  return { blocks, hole, right, opts: opts.sort(() => Math.random() - 0.5) }
}

export default function PretendantAccra({ onEnd }: { onEnd: (score: number) => void }) {
  const [round, setRound] = useState(0)
  const s = useMemo(() => strip(round), [round])
  const [good, setGood] = useState(0)
  const [left, setLeft] = useState(TIME)
  const [picked, setPicked] = useState<number | null>(null)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (over) return
    const id = setInterval(() => setLeft((l) => l - 0.25), 250)
    return () => clearInterval(id)
  }, [over])
  useEffect(() => {
    if (over || left > 0) return
    setOver(true)
    onEnd(Math.round((good / ROUNDS) * 85))
  }, [left, over, good, onEnd])

  const pick = (i: number, spot: { x: number; y: number }) => {
    if (picked !== null || over) return
    const o = s.opts[i]
    const ok = o.c === s.right.c && o.m === s.right.m
    setPicked(i)
    const g = good + (ok ? 1 : 0)
    if (ok) (setGood(g), beep(700, 0.1, 0.12), fx.good(spot.x, spot.y, t('Tissé main !')))
    else (beep(170, 0.25, 0.12, { type: 'square' }), fx.bad(spot.x, spot.y, t('Copie !')))
    setTimeout(() => {
      setPicked(null)
      if (round + 1 >= ROUNDS) {
        setOver(true)
        const score = Math.round((g / ROUNDS) * 85 + (g === ROUNDS ? Math.max(0, left / TIME) * 15 : 0))
        if (score >= 80) fx.win()
        setFlash({ text: g >= 6 ? t('Tu connais le kente !') : t('Il faudra demander aux tisserands…'), at: Date.now() })
        setTimeout(() => onEnd(score), 900)
      } else setRound(round + 1)
    }, 800)
  }

  // Dragging an option to the hole (or tapping it): where it is in the scene, which one.
  const drag = useRef<{ i: number; moved: boolean; x: number; y: number } | null>(null)
  const held = useRef(new THREE.Vector3())
  const [dragging, setDragging] = useState<number | null>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  const touch = (f: Finger) => {
    if (picked !== null || over) return
    if (f.kind === 'down') {
      if (!groundAt(f.x, f.y, 0.1, v)) return
      const i = s.opts.findIndex((_, k) => Math.abs(v.x - OPT_X(k)) < 0.42 && Math.abs(v.z - OPT_Z) < 0.5)
      if (i < 0) return
      drag.current = { i, moved: false, x: f.x, y: f.y }
      held.current.set(OPT_X(i), 0.35, OPT_Z)
      setDragging(i)
      beep(500, 0.04, 0.05)
      return
    }
    const d = drag.current
    if (!d) return
    if (f.kind === 'move') {
      if (Math.hypot(f.x - d.x, f.y - d.y) > 8) d.moved = true
      if (groundAt(f.x, f.y, 0.35, v)) held.current.copy(v)
      return
    }
    drag.current = null
    setDragging(null)
    // Dropped on the hole, or just tapped: picked; let go elsewhere, back in its place.
    const [hx, hz] = tileAt(s.hole, s.blocks.length)
    if (!d.moved || Math.hypot(held.current.x - hx, held.current.z - hz) < 0.6) pick(d.i, f)
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 7, 2.6]} look={[0, 0, 0.3]} fov={40} fit={[4.4, 5.4]} bg="#f2b705" touch={touch}>
        <Stall />
        <Strip key={round} blocks={s.blocks} hole={s.hole} />
        {s.opts.map((o, i) => {
          const ok = o.c === s.right.c && o.m === s.right.m
          return <Option key={`${round}-${i}`} b={o} x={OPT_X(i)} held={dragging === i ? held.current : null} mark={picked !== null ? (ok ? '#2f9e44' : picked === i ? '#e03131' : null) : null} />
        })}
      </Stage3D>
      <Hud title={t('Le vrai kente')} left={left} done={`${Math.min(round + 1, ROUNDS)}/${ROUNDS}`} />
      <div className="pointer-events-none absolute inset-x-0 top-16 text-center text-sm font-extrabold text-[#5c3a06]">{t('Quel bloc manque à la bande tissée ?')}</div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}

/** The strip's tiles: in rows of six on the table (a long strip folds onto a second row). */
const TILE = 0.62
const PER_ROW = 6
function tileAt(i: number, len: number): [number, number] {
  const rows = Math.ceil(len / PER_ROW)
  const row = Math.floor(i / PER_ROW)
  const inRow = Math.min(PER_ROW, len - row * PER_ROW)
  return [((i % PER_ROW) - (inRow - 1) / 2) * TILE, -1.3 + (row - (rows - 1) / 2) * TILE * 1.35]
}
/** The four options, laid out near you. */
const OPT_X = (k: number) => (k - 1.5) * 0.95
const OPT_Z = 1.9

/** The market stall: its wooden table, the cloth under the strip. */
function Stall() {
  return (
    <group>
      <Box p={[0, -0.6, 0]} s={[10, 0.2, 10]} c="#c9a27a" />
      <Box p={[0, -0.1, 0.3]} s={[4.6, 0.2, 5.2]} c="#8a5a32" />
      <Box p={[0, 0.005, -1.3]} s={[4.2, 0.01, 1.9]} c="#3d2b1f" />
    </group>
  )
}

/** A woven block of kente in little raised blocks: bars, a zigzag or checks, in its colour on the yellow (or black). */
function Kente3D({ b, size = TILE * 0.9 }: { b: Block; size?: number }) {
  const c = COLORS[b.c]
  const alt = b.c === 0 ? '#111111' : '#f2b705'
  const cells = useMemo(() => {
    const out: { x: number; z: number; on: boolean }[] = []
    const n = 5
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const on = b.m === 0 ? i % 2 === 0 : b.m === 1 ? (i + j) % 4 < 2 : (i + j) % 2 === 0
        out.push({ x: (j - (n - 1) / 2) / n, z: (i - (n - 1) / 2) / n, on })
      }
    return out
  }, [b.m])
  return (
    <group>
      <Box p={[0, 0.03, 0]} s={[size, 0.06, size]} c={alt} />
      {cells.map((k, i) => k.on && <Box key={i} p={[k.x * size, 0.075, k.z * size]} s={[size / 5, 0.03, size / 5]} c={c} />)}
    </group>
  )
}

/** The strip on the cloth, the hole a white frame, bobbing. */
function Strip({ blocks, hole }: { blocks: Block[]; hole: number }) {
  const frame = useRef<THREE.Group>(null)
  useFrame(() => {
    if (frame.current) frame.current.position.y = 0.02 + Math.abs(Math.sin(performance.now() / 300)) * 0.03
  })
  return (
    <group>
      {blocks.map((b, i) => {
        const [x, z] = tileAt(i, blocks.length)
        if (i === hole)
          return (
            <group key={i} ref={frame} position={[x, 0.02, z]}>
              {[-1, 1].map((k) => (
                <group key={k}>
                  <Box p={[k * TILE * 0.45, 0, 0]} s={[0.04, 0.03, TILE * 0.9]} c="#ffffff" />
                  <Box p={[0, 0, k * TILE * 0.45]} s={[TILE * 0.9, 0.03, 0.04]} c="#ffffff" />
                </group>
              ))}
            </group>
          )
        return (
          <group key={i} position={[x, 0, z]}>
            <Kente3D b={b} />
          </group>
        )
      })}
    </group>
  )
}

/** An option near you: lifted under the finger while dragged; after the pick, its plate green or red. */
function Option({ b, x, held, mark }: { b: Block; x: number; held: THREE.Vector3 | null; mark: string | null }) {
  const g = useRef<THREE.Group>(null)
  const home = useMemo(() => new THREE.Vector3(x, 0, OPT_Z), [x])
  useFrame((_, dt) => {
    const m = g.current
    if (!m) return
    if (held) m.position.copy(held)
    else m.position.lerp(home, 1 - Math.exp(-dt * 20))
  })
  return (
    <group>
      <Box p={[x, 0.01, OPT_Z]} s={[0.8, 0.02, 0.8]} c={mark ?? '#fff8e6'} />
      <group ref={g} position={[x, 0, OPT_Z]}>
        <Kente3D b={b} size={0.66} />
      </group>
    </group>
  )
}
