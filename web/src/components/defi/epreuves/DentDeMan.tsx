import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Flash, Hud, beep, knock, useHud, fx } from './kit'
import { Stage3D, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { MySim } from '../jeux/me'
import { t } from '../../../lib/i18n'

// « Le défi de la Dent de Man », chapter 3 (game/epreuves.go): Boris's bet, the last stretch of the climb,
// the rock face to the summit. The face in the game's 3D blocks, and your own Sim (its real look) hanging
// on it, the camera climbing with it. Tap the next hold (one or two rows up, the reachable ones lit): the
// grey ones hold, the brown cracked ones crumble (a slip down). The breath goes down as you climb; the
// ledges give it back. When the wind blows (the streaks across the rock), keep the finger on the screen
// until it drops, or it tears you off. The same rule and score as before.

const TIME = 70
const TOP = 32 // rows to the summit
const COLS = 5
const LEDGE = 8 // a ledge every LEDGE rows
const REACH = COLS // columns to the side (all of them: a row always has a good hold in reach)
/** The face's sizes in the scene: the rows' gap, the columns' gap. */
const GAP = 0.85
const CW = 0.85
const colX = (c: number) => (c - (COLS - 1) / 2) * CW

type Hold = { col: number; bad: boolean }

function face(): Hold[][] {
  const rows: Hold[][] = [[{ col: 2, bad: false }]]
  for (let r = 1; r <= TOP; r++) {
    if (r % LEDGE === 0 || r === TOP) {
      rows.push([...Array(COLS).keys()].map((col) => ({ col, bad: false })))
      continue
    }
    const cols = [...Array(COLS).keys()].sort(() => Math.random() - 0.5).slice(0, 2 + (Math.random() < 0.45 ? 1 : 0))
    rows.push(cols.map((col, i) => ({ col, bad: i > 0 && Math.random() < 0.4 })))
  }
  return rows
}

type S = { rows: Hold[][]; row: number; col: number; shown: number; breath: number; wind: { from: number; until: number }; pressed: boolean; over: boolean; fall: number; now: number; started: boolean; v: number }

export default function DentDeMan({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef<S>({ rows: face(), row: 0, col: 2, shown: 0, breath: 100, wind: { from: 9, until: 0 }, pressed: false, over: false, fall: 0, now: 0, started: false, v: 0 })
  const [hud, setHud] = useHud({ left: TIME, row: 0, breath: 100, wind: false })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  // The holds changed (one crumbled): drawn again.
  const [, setV] = useState(0)

  const slip = (rows: number, why: string) => {
    const st = s.current
    let r = st.row
    for (let i = 0; i < rows && r > 0 && r % LEDGE !== 0; i++) r--
    while (r > 0 && !st.rows[r].some((h) => !h.bad)) r--
    st.row = r
    const good = st.rows[r].filter((h) => !h.bad)
    st.col = good.reduce((a, h) => (Math.abs(h.col - st.col) < Math.abs(a - st.col) ? h.col : a), good[0].col)
    st.fall = 1
    knock(0.5, 0, 400)
    beep(300, 0.4, 0.1, { type: 'sawtooth', to: 120 })
    setFlash({ text: why, at: Date.now() })
    const p = screenOf(colX(st.col), r * GAP, 0.2)
    fx.bad(p.x, p.y, '')
  }

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const left = TIME - now
    if (!st.over && (left <= 0 || st.row >= TOP)) {
      st.over = true
      if (st.row >= TOP) {
        beep(523, 0.2, 0.15)
        beep(659, 0.2, 0.15)
        beep(1047, 0.4, 0.15)
        setFlash({ text: t('Au sommet !'), at: Date.now() })
        fx.win()
      }
      setTimeout(() => onEnd(Math.round((st.row / TOP) * 80 + (st.row >= TOP ? Math.max(0, left / TIME) * 20 : 0))), 1100)
    }
    if (!st.over) {
      st.breath = st.row % LEDGE === 0 ? Math.min(100, st.breath + dt * 30) : st.breath - dt * 2.2
      if (st.breath <= 0) {
        st.breath = 40
        slip(LEDGE, t('À bout de souffle…'))
      }
      if (now >= st.wind.from && st.wind.until < st.wind.from) {
        st.wind.until = now + 1.8
        beep(200, 1.6, 0.05, { type: 'sawtooth', to: 140 })
      }
      const blowing = now >= st.wind.from && now < st.wind.until
      if (blowing && !st.pressed && now > st.wind.from + 0.6) {
        st.wind = { from: now + 7 + Math.random() * 5, until: 0 }
        slip(3, t('Le vent t’a décroché !'))
      } else if (st.wind.until && now >= st.wind.until) st.wind = { from: now + 7 + Math.random() * 5, until: 0 }
      setHud({ left: Math.max(0, left), row: st.row, breath: st.breath, wind: blowing })
    }
    st.shown += (st.row - st.shown) * Math.min(1, dt * 6)
    st.fall = Math.max(0, st.fall - dt * 2)
  }

  const touch = (e: Finger) => {
    const st = s.current
    st.pressed = e.kind !== 'up'
    if (e.kind !== 'down' || st.over) return
    // The reachable holds (one or two rows up), the one under the finger on the screen.
    const a = screenOf(0, 0, 0)
    const b = screenOf(CW, GAP, 0)
    const cwPx = Math.abs(b.x - a.x)
    const gapPx = Math.abs(b.y - a.y)
    for (let r = st.row + 1; r <= Math.min(TOP, st.row + 2); r++) {
      const holds = r % LEDGE === 0 || r === TOP ? [...Array(COLS).keys()].map((col) => ({ col, bad: false })) : st.rows[r]
      for (const hd of holds) {
        const p = screenOf(colX(hd.col), r * GAP, 0.1)
        if (Math.abs(e.x - p.x) < cwPx * 0.5 && Math.abs(e.y - p.y) < gapPx * 0.5 && Math.abs(hd.col - st.col) <= REACH) {
          if (hd.bad) {
            st.rows[r] = st.rows[r].filter((x) => x !== hd)
            setV((n) => n + 1)
            st.breath -= 12
            slip(2, t('Ça s’effrite !'))
            return
          }
          st.row = r
          st.col = hd.col
          fx.burst(p.x, p.y, ['#ced4da', '#adb5bd', '#868e96'], 6, 90)
          st.breath -= 2
          knock(0.25, (hd.col / (COLS - 1)) * 2 - 1, 1200)
          if (r % LEDGE === 0 && r < TOP) setFlash({ text: t('Une corniche : souffle !'), at: Date.now() })
          return
        }
      }
    }
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 2, 6]} look={[0, 1.2, 0]} fov={45} bg="#9fd3ff" touch={touch} onReady={() => (s.current.started = true)}>
        <Rig s={s} tick={tick} />
        <Wall s={s} />
      </Stage3D>
      <Hud title={t('La Dent de Man')} left={hud.left} done={`${Math.round((hud.row / TOP) * 100)} %`}>
        <div className="h-3 w-16 overflow-hidden rounded-full bg-black/45" aria-label={t('Souffle')}>
          <div className={`h-full ${hud.breath < 30 ? 'bg-[#e03131]' : 'bg-[#69db7c]'}`} style={{ width: `${Math.max(0, Math.round(hud.breath))}%` }} />
        </div>
      </Hud>
      {hud.wind && <div className="animate-pop pointer-events-none absolute inset-x-0 top-[22%] z-10 text-center font-display text-3xl font-extrabold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">{t('Le vent ! Garde le doigt sur la roche')}</div>}
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-[#1f3b57]">{t('Touche la prise suivante. Les brunes fissurées s’effritent !')}</p>
    </div>
  )
}

/** The camera climbing with the Sim (the face kept across the screen's width), and the game's clock. */
function Rig({ s, tick }: { s: React.RefObject<S>; tick: (dt: number) => void }) {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera
  const size = useThree((st) => st.size)
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    // Far enough that the five columns fit across; the climber a third up the screen.
    const h = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (size.width / Math.max(1, size.height)))
    const d = Math.max(4.5, (CW * COLS + 0.4) / 2 / Math.tan(h))
    const y = st.shown * GAP
    camera.position.set(0, y + 1.6, d)
    camera.lookAt(0, y + 1.9, 0)
  })
  return null
}

/** The rock face: its blocks of stone, the holds (grey, or brown and cracked), the ledges, the flag at the top; the Sim hanging on. */
function Wall({ s }: { s: React.RefObject<S> }) {
  const st = s.current
  const sim = useRef<THREE.Group>(null)
  const lit = useRef<THREE.Group>(null)
  const wind = useRef<THREE.Group>(null)
  const tints = useMemo(() => Array.from({ length: TOP + 6 }, (_, i) => ['#7d8a78', '#6f7d6a', '#76826f', '#68756a'][(i * 7) % 4]), [])
  useFrame(() => {
    const g = sim.current
    const now = performance.now() / 1000
    if (g) {
      const x = colX(st.col) + Math.sin(now * 40) * 0.08 * st.fall
      g.position.x += (x - g.position.x) * 0.3
      g.position.y = st.shown * GAP - 0.85
    }
    // The reachable holds lit (white frames behind), one or two rows up.
    const l = lit.current
    if (l) {
      l.visible = !st.over
      l.children.forEach((m) => {
        const r = m.userData.r as number
        m.visible = r > st.row && r <= st.row + 2 && st.rows[r].some((h) => h.col === m.userData.c)
        ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.3 * Math.sin(now * 6)
      })
    }
    const w = wind.current
    if (w) {
      const blowing = st.now >= st.wind.from && st.now < st.wind.until
      w.visible = blowing
      w.children.forEach((m, i) => m.position.set((((now * 9 + i * 1.7) % 8) - 4) * 1.0, st.shown * GAP + (i / 8) * 5 - 1, 0.6 + (i % 3) * 0.3))
    }
  })
  return (
    <group>
      {/* The stone, row by row, and the mountain's green foot */}
      {tints.map((c, i) => (
        <Box key={i} p={[((i * 13) % 5) * 0.04 - 0.08, (i - 1) * GAP, -0.25 - ((i * 3) % 4) * 0.03]} s={[CW * COLS + 1.4, GAP + 0.02, 0.5]} c={c} />
      ))}
      <Box p={[0, -2.5, 0.5]} s={[12, 2, 3]} c="#4f7a3a" />
      {st.rows.map((row, r) =>
        r % LEDGE === 0 || r === TOP ? (
          <group key={r}>
            <Box p={[0, r * GAP - 0.1, 0.25]} s={[CW * COLS + 0.6, 0.14, 0.5]} c={r === TOP ? '#c9b48a' : '#8d8a7c'} />
            {r === TOP && (
              <group position={[0, r * GAP, 0.25]}>
                <Box p={[0, 0.5, 0]} s={[0.05, 1, 0.05]} c="#5c3a21" />
                <Box p={[0.2, 0.85, 0]} s={[0.36, 0.22, 0.03]} c="#e03131" />
              </group>
            )}
          </group>
        ) : (
          row.map((hd) => (
            <group key={`${r}-${hd.col}`} position={[colX(hd.col), r * GAP, 0.05]}>
              <Box p={[0, 0, 0]} s={[0.3, 0.16, 0.2]} c={hd.bad ? '#9c6b3e' : '#a9aeb5'} />
              {hd.bad && <Box p={[0.02, 0.02, 0.105]} s={[0.18, 0.025, 0.01]} c="#4a2f1a" r={0.4} />}
            </group>
          ))
        ),
      )}
      <group ref={lit}>
        {st.rows.flatMap((row, r) =>
          r % LEDGE === 0 || r === TOP
            ? []
            : row.map((hd) => (
                <mesh key={`l${r}-${hd.col}`} position={[colX(hd.col), r * GAP, 0.02]} userData={{ r, c: hd.col }}>
                  <boxGeometry args={[0.42, 0.28, 0.12]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
                </mesh>
              )),
        )}
      </group>
      <group ref={sim} position={[colX(2), -0.85, 0.35]}>
        <MySim pose="hang" r={Math.PI} scale={0.5} />
      </group>
      <group ref={wind} visible={false}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.9, 0.025, 0.025]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
