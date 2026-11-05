import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, rnd, useHud, fx } from './kit'
import { Stage3D, planeAt, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { t } from '../../../lib/i18n'

// « La fausse toile de Korhogo », chapter 1 (game/epreuves.go): at the market, the toile sold as a real
// one from Korhogo, next to a real one: the same animals painted in the same places, the fish, the calao,
// the turtle, the crocodile, the masked dancer… The copyist went too fast. Find his five mistakes (a
// tap on either toile): a figure missing, one the wrong way round, the wrong ink, a spot too many, the
// border broken. A wrong tap costs a few seconds. The two toiles hang on the gallery's wall in the game's
// 3D blocks: the cotton, the border of little teeth, the figures in raised dark blocks (the copy's mistakes
// in them); the mistakes found framed in green on both. (Self-contained: nothing of the town of Korhogo.)
// The same rule and score.

const TIME = 60
const PENALTY = 3
const COLS = 3
const ROWS = 3
const FIGS = ['poisson', 'calao', 'tortue', 'masque', 'crocodile', 'lezard', 'soleil', 'serpent', 'poisson'] as const
type Fig = (typeof FIGS)[number]
type Panel = { fig: Fig; flip: boolean }
type Diff = { kind: 'gone' | 'flip' | 'ink' | 'spots' | 'border'; cell: number; x: number; y: number; found: boolean }

const INK = '#2a1a10'
const FAKE = '#7a3a12'

function makeDiffs(): Diff[] {
  const cells = [...Array(COLS * ROWS).keys()].sort(() => Math.random() - 0.5)
  // Turned the wrong way, the mask and the sun look the same: the second mistake (« flip ») not on them.
  const k = cells.findIndex((c) => FIGS[c] !== 'masque' && FIGS[c] !== 'soleil')
  ;[cells[1], cells[k]] = [cells[k], cells[1]]
  const kinds: Diff['kind'][] = ['gone', 'flip', 'ink', 'spots']
  const out: Diff[] = kinds.map((kind, i) => {
    const c = cells[i]
    const cx = ((c % COLS) + 0.5) / COLS
    const cy = (Math.floor(c / COLS) + 0.5) / ROWS
    return kind === 'spots' ? { kind, cell: c, x: cx + rnd(-0.08, 0.08), y: cy + 0.11, found: false } : { kind, cell: c, x: cx, y: cy, found: false }
  })
  // The border broken somewhere along the bottom or a side.
  const side = Math.random() < 0.5
  out.push({ kind: 'border', cell: -1, x: side ? 0.03 : rnd(0.2, 0.8), y: side ? rnd(0.2, 0.8) : 0.97, found: false })
  return out
}

/** The two toiles' sizes on the gallery wall, and where each hangs (one above the other on a phone held
 *  up, side by side on a wide screen). */
const TALL = typeof window !== 'undefined' && window.innerHeight > window.innerWidth
const TW = 3.6
const TH = TW * 0.78
const AT: [number, number][] = TALL
  ? [
      [0, TH / 2 + 0.2],
      [0, -TH / 2 - 0.2],
    ]
  : [
      [-TW / 2 - 0.2, 0],
      [TW / 2 + 0.2, 0],
    ]

/** The figures as the Senoufo painters do them, in blocks: flat and dark, on a 7 × 5 grid (# a block). */
const SHAPES: Record<Fig, string[]> = {
  poisson: ['.......', '.####.#', '#######', '.####.#', '.......'],
  calao: ['...##..', '..####.', '#######', '..###..', '..#.#..'],
  tortue: ['..###..', '.#####.', '#######', '.#####.', '.#...#.'],
  masque: ['.#...#.', '.#####.', '.#.#.#.', '..###..', '...#...'],
  crocodile: ['.......', '##.....', '#######', '.######', '.#.#.#.'],
  lezard: ['#.....#', '.#####.', '..###..', '.#####.', '#.....#'],
  soleil: ['#..#..#', '.#####.', '###.###', '.#####.', '#..#..#'],
  serpent: ['.....##', '....#..', '.###...', '#......', '.......'],
}

export default function ToileKorhogo({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ panels: FIGS.map((fig) => ({ fig, flip: Math.random() < 0.5 })) as Panel[], diffs: makeDiffs(), lost: 0, over: false, now: 0, started: false })
  const [hud, setHud] = useHud({ left: TIME, found: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [found, setFound] = useState(0)

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const left = TIME - st.now - st.lost
    const n = st.diffs.filter((d) => d.found).length
    if (!st.over && (left <= 0 || n === st.diffs.length)) {
      st.over = true
      setTimeout(() => onEnd(Math.round(n * 16 + (n === st.diffs.length ? Math.max(0, left / TIME) * 20 : 0))), 900)
    }
    setHud({ left: Math.max(0, left), found: n })
  }

  const wall = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over || !planeAt(e.x, e.y, wall, v)) return
    const at = AT.find(([x, y]) => Math.abs(v.x - x) <= TW / 2 && Math.abs(v.y - y) <= TH / 2)
    if (!at) return
    const u = (v.x - (at[0] - TW / 2)) / TW
    const w = (at[1] + TH / 2 - v.y) / TH
    const hit = st.diffs.find((d) => !d.found && Math.hypot((d.x - u) * TW, (d.y - w) * TH) < TW * 0.1)
    if (hit) {
      hit.found = true
      setFound((n) => n + 1)
      beep(740, 0.12, 0.12)
      beep(990, 0.18, 0.1)
      setFlash({ text: t('Trouvé !'), at: Date.now() })
      fx.good(e.x, e.y, t('Trouvé !'))
      if (st.diffs.every((d) => d.found)) fx.win()
    } else if (!st.diffs.some((d) => d.found && Math.hypot((d.x - u) * TW, (d.y - w) * TH) < TW * 0.1)) {
      st.lost += PENALTY
      beep(180, 0.2, 0.12, { type: 'square' })
      fx.bad(e.x, e.y, `−${PENALTY} s`)
    }
  }

  const st = s.current
  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 0, 8]} look={[0, 0, 0]} fov={40} fit={TALL ? [TW + 0.3, TH * 2 + 0.8] : [TW * 2 + 0.8, TH + 0.6]} bg="#6b4423" touch={touch} onReady={() => (s.current.started = true)}>
        <Clock tick={tick} />
        <Box p={[0, 0, -0.15]} s={[14, 14, 0.2]} c="#e9dcc4" />
        {AT.map(([x, y], i) => (
          <group key={i} position={[x, y, 0]}>
            <Toile panels={st.panels} diffs={i === 1 ? st.diffs : []} />
            <Found diffs={st.diffs} n={found} />
          </group>
        ))}
      </Stage3D>
      <Hud title={t('La fausse toile')} left={hud.left} done={`${hud.found}/5`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Touche les 5 erreurs du copieur. Une erreur de ta part coûte {n} secondes.', { n: PENALTY })}</p>
    </div>
  )
}

function Clock({ tick }: { tick: (dt: number) => void }) {
  useFrame((_, raw) => tick(Math.min(raw, 0.05)))
  return null
}

/** A point of the toile (u, v from its top left, 0..1) in its own group's units. */
const P = (u: number, v: number, z = 0.03): [number, number, number] => [(u - 0.5) * TW, (0.5 - v) * TH, z]

/** A toile in blocks: the coarse cotton, the border of little teeth all round (one gap if the copy broke
 *  it), the nine figures (one gone, one turned, one in the wrong ink in the copy), the spots too many. */
function Toile({ panels, diffs }: { panels: Panel[]; diffs: Diff[] }) {
  const has = (k: Diff['kind'], cell?: number) => diffs.find((d) => d.kind === k && (cell === undefined || d.cell === cell))
  const br = has('border')
  const teeth = useMemo(() => {
    const out: [number, number][] = []
    for (let i = 0; i < 24; i++) out.push([(i + 0.5) / 24, 0.025], [(i + 0.5) / 24, 0.975])
    for (let i = 1; i < 18; i++) out.push([0.02, (i + 0.5) / 19], [0.98, (i + 0.5) / 19])
    return out
  }, [])
  const sp = has('spots')
  return (
    <group>
      <Box p={[0, 0, 0]} s={[TW, TH, 0.04]} c="#efe2c4" />
      {teeth.map(([u, v], i) => (br && Math.hypot(u - br.x, v - br.y) < 0.06 ? null : <Box key={i} p={P(u, v)} s={[0.07, 0.07, 0.02]} c={INK} r={0} />))}
      {panels.map((p, i) => {
        if (has('gone', i)) return null
        const flip = p.flip !== !!has('flip', i)
        const ink = has('ink', i) ? FAKE : INK
        const cu = 0.05 + ((i % COLS) + 0.5) * (0.9 / COLS)
        const cv = 0.06 + (Math.floor(i / COLS) + 0.5) * (0.88 / ROWS)
        return (
          <group key={i} position={P(cu, cv)} scale={[flip ? -1 : 1, 1, 1]}>
            {SHAPES[p.fig].flatMap((row, r) =>
              [...row].map((ch, c) => (ch === '#' ? <Box key={`${r}${c}`} p={[(c - 3) * 0.13, (2 - r) * 0.13, 0]} s={[0.12, 0.12, 0.02]} c={ink} /> : null)),
            )}
          </group>
        )
      })}
      {sp &&
        [
          [0, 0],
          [0.02, 0.01],
          [-0.015, 0.02],
        ].map(([du, dv], i) => <Box key={i} p={P(sp.x + du, sp.y + dv)} s={[0.05, 0.05, 0.02]} c={INK} />)}
    </group>
  )
}

/** The mistakes found, framed in green on both toiles. */
function Found({ diffs, n }: { diffs: Diff[]; n: number }) {
  void n
  return (
    <group>
      {diffs
        .filter((d) => d.found)
        .map((d, i) => {
          const [x, y] = P(d.x, d.y)
          const r = TW * 0.09
          return (
            <group key={i} position={[x, y, 0.06]}>
              {[-1, 1].map((k) => (
                <group key={k}>
                  <Box p={[k * r, 0, 0]} s={[0.05, r * 2, 0.02]} c="#2f9e44" />
                  <Box p={[0, k * r, 0]} s={[r * 2, 0.05, 0.02]} c="#2f9e44" />
                </group>
              ))}
            </group>
          )
        })}
    </group>
  )
}
