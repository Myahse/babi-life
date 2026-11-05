import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PvpButton } from '../components/pvp/PvpButton'
import { ChevronDown, RotateCcw, Star } from 'lucide-react'
import type { Sim } from '../lib/types'
import { HOME, isSafe, legal, move, newLudo, roll, square, target, think, type Ludo } from '../game/ludo'
import { Die } from '../components/table/Die'
import { tableMood } from '../components/table/Faces'
import { tableSfx } from '../lib/tableSfx'
import { sfx } from '../lib/sfx'
import { haptic } from '../lib/native'
import { reactToResult } from '../avatar/expressions'
import { t } from '../lib/i18n'

const TableFaces = lazy(() => import('../components/table/Faces'))

// Ludo 225 on the phone: the board of the courtyards, the player in red
// against the computer (one face to face, or three round the board). For
// nothing: no stake. The rules: game/ludo.ts. The die is thrown and rolls
// (components/table/Die.tsx); a pawn hops square by square to where it goes,
// one taken slides back to its house; the others are seen across the board
// (components/table/Faces.tsx), and play at a person's pace.

const HUES = ['#e03131', '#2f9e44', '#f2b705', '#1c7ed6']
const DARK = ['#8f1d1d', '#1d6b2d', '#a87d00', '#11508f']
const BOTS = ['', t('Koffi'), t('Mariam'), t('Junior')]
const GENDERS: ('homme' | 'femme')[] = ['homme', 'homme', 'femme', 'homme']

/** The 52 squares round the board on its 15 × 15 grid [row, col], from red's start, clockwise. */
const PATH: [number, number][] = (() => {
  const p: [number, number][] = []
  const seg = (r: number, c: number, dr: number, dc: number, n: number) => {
    for (let i = 0; i < n; i++) p.push([r + dr * i, c + dc * i])
  }
  seg(6, 1, 0, 1, 5)
  seg(5, 6, -1, 0, 6)
  p.push([0, 7])
  seg(0, 8, 1, 0, 6)
  seg(6, 9, 0, 1, 6)
  p.push([7, 14])
  seg(8, 14, 0, -1, 6)
  seg(9, 8, 1, 0, 6)
  p.push([14, 7])
  seg(14, 6, -1, 0, 6)
  seg(8, 5, 0, -1, 6)
  p.push([7, 0], [6, 0])
  return p
})()
/** Each colour's home column, from the round to the centre. */
const COLUMN: [number, number][][] = [
  [1, 2, 3, 4, 5].map((c) => [7, c]),
  [1, 2, 3, 4, 5].map((r) => [r, 7]),
  [13, 12, 11, 10, 9].map((c) => [7, c]),
  [13, 12, 11, 10, 9].map((r) => [r, 7]),
]
/** The corners' houses: top-left red, top-right green, bottom-right yellow, bottom-left blue. */
const HOUSE: [number, number][] = [
  [0, 0],
  [0, 9],
  [9, 9],
  [9, 0],
]

/** Where a pawn is drawn [row, col] (fractions: in its house, round the centre). */
function cell(c: number, k: number, p: number): [number, number] {
  if (p < 0) return [HOUSE[c][0] + 1.5 + (k >> 1) * 2, HOUSE[c][1] + 1.5 + (k & 1) * 2]
  if (p === HOME) {
    // In the centre, on its colour's side of it.
    const [sr, sc] = [[0, -0.6], [-0.6, 0], [0, 0.6], [0.6, 0]][c]
    return [7 + sr + (k >> 1 ? 0.2 : -0.2), 7 + sc + (k & 1 ? 0.2 : -0.2)]
  }
  if (p > 50) return COLUMN[c][p - 51]
  return PATH[square(c, p)!]
}

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
const between = (a: number, b: number) => a + Math.random() * (b - a)

export function LudoApp({ sim }: { sim: Sim }) {
  const [seats, setSeats] = useState<2 | 4>(4)
  const [game, setGame] = useState<Ludo>(() => newLudo(4))
  const [die, setDie] = useState<number | null>(null)
  // Each throw of the die (it rolls when this changes), and the die still rolling.
  const [throws, setThrows] = useState(0)
  const [face, setFace] = useState(6)
  const [rolling, setRolling] = useState(false)
  // The pawns still hopping (the board says when they're down).
  const [moving, setMoving] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [rules, setRules] = useState(false)
  const round = useRef(0)
  useEffect(() => () => void round.current++, [])
  const color = game.players[game.turn]
  const mine = color === 0
  const name = (c: number) => (c === 0 ? sim.firstName : BOTS[c])
  const faceOf = (c: number) => `ludo-${c}`

  /** The die thrown: it rolls, lands; then what follows (the number). */
  const throwDie = (then: (d: number) => void) => {
    const r = round.current
    const d = roll()
    setRolling(true)
    setFace(d)
    setThrows((n) => n + 1)
    window.setTimeout(() => {
      if (r !== round.current) return
      setRolling(false)
      setDie(d)
      if (d === 6) tableMood(color === 0 ? 'me' : faceOf(color), 'good', 1500)
      then(d)
    }, 950)
  }
  /** A pawn moved (or none): the board hops it there; what it did, told and seen on the faces. */
  const after = (g: Ludo, d: number, k: number | null) => {
    const c = g.players[g.turn]
    const r = move(g, k, d)
    if (r.taken.length) {
      setSaid(`${r.taken.length > 1 ? t('Deux pions renvoyés') : t('{0} retourne à la maison', { 0: name(r.taken[0].c) })} !`)
      tableMood(c === 0 ? 'me' : faceOf(c), 'great')
      for (const x of r.taken) tableMood(x.c === 0 ? 'me' : faceOf(x.c), 'bad', 2600)
    } else if (r.arrived) {
      setSaid(t('{0} rentre un pion au centre !', { 0: name(c) }))
      tableMood(c === 0 ? 'me' : faceOf(c), 'good')
    } else if (r.again && d === 6) setSaid(t('Six : on rejoue !'))
    else setSaid(null)
    if (k !== null) setMoving(true)
    setGame(r.game)
    setDie(null)
    if (r.game.over) {
      const first = r.game.winners[0]
      for (const b of r.game.players) if (b !== 0) tableMood(faceOf(b), b === first ? 'won' : 'lost', 8000)
      if (first === 0) sfx.win(true)
      else sfx.lose()
      reactToResult('me', first === 0 ? 'bigwin' : 'lost')
    }
  }
  // The computer's turns: a moment, the throw, a look over its pawns, the move.
  useEffect(() => {
    if (game.over || mine || die !== null || rolling || moving) return
    const r = round.current
    tableMood(faceOf(color), 'think', 2600)
    const t1 = setTimeout(
      () =>
        throwDie((d) => {
          const k = think(game, d)
          setTimeout(() => r === round.current && after(game, d, k), k === null ? 800 : between(350, 700))
        }),
      between(350, 650),
    )
    return () => clearTimeout(t1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, mine, die, rolling, moving])
  // One's turn comes: a soft call.
  useEffect(() => {
    if (mine && !game.over && !moving) tableSfx.turn()
  }, [mine, moving]) // eslint-disable-line react-hooks/exhaustive-deps
  const myRoll = () => {
    if (!mine || die !== null || rolling || moving || game.over) return
    haptic('light')
    throwDie((d) => {
      const can = legal(game, d)
      if (!can.length) {
        setSaid(d === 6 ? t('Six, mais aucun pion ne peut bouger.') : t('{d} : aucun pion ne peut bouger.', { d }))
        tableMood('me', 'bad', 1400)
        setTimeout(() => after(game, d, null), 1100)
      } else if (can.length === 1) setTimeout(() => after(game, d, can[0]), 350)
    })
  }
  const pick = (k: number) => {
    if (!mine || die === null || rolling || moving || !legal(game, die).includes(k)) return
    after(game, die, k)
  }
  const restart = (n: 2 | 4 = seats) => {
    round.current++
    setSeats(n)
    setGame(newLudo(n))
    setDie(null)
    setRolling(false)
    setMoving(false)
    setSaid(null)
  }
  const can = mine && die !== null && !rolling && !moving ? legal(game, die) : []
  const first = game.winners[0]
  const bots = game.players.filter((c) => c !== 0)

  return (
    <div className="-mx-3 -mt-2">
      <div className="px-4 pt-2 pb-4 text-white" style={{ background: 'linear-gradient(160deg,#e03131,#7a1020)' }}>
        <div className="font-display text-2xl font-extrabold tracking-wide">{t('LUDO 225')}</div>
        <div className="text-sm font-bold opacity-85">{t("Le jeu des cours, contre l'ordinateur")}</div>
      </div>
      <div className="px-3 pt-3 pb-4">
        <PvpButton game="ludo" className="mb-3" />
        <div className="mb-3 flex gap-1.5">
          {([2, 4] as const).map((n) => (
            <button key={n} onClick={() => restart(n)} className={`flex-1 rounded-full px-2 py-1.5 text-xs font-extrabold ${n === seats ? 'bg-[#c92a2a] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}>
              {n === 2 ? t('À deux') : t('À quatre')}
            </button>
          ))}
        </div>

        {/* The others round the board, their colour under each */}
        <Suspense fallback={<div className="h-[78px]" />}>
          <TableFaces people={bots.map((c) => ({ id: faceOf(c), name: BOTS[c], gender: GENDERS[c] }))} me={{ name: sim.firstName, look: sim.look, gender: sim.gender }} myTurn={mine && !game.over} playing={!mine && !game.over ? faceOf(color) : null} height={78} />
        </Suspense>
        <div className="mb-1.5 flex justify-around">
          {bots.map((c) => (
            <span key={c} className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white transition-transform ${c === color && !game.over ? 'scale-110 ring-2 ring-[#ffd166]' : 'opacity-80'}`} style={{ background: HUES[c] }}>
              {BOTS[c]}
            </span>
          ))}
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white transition-transform ${mine && !game.over ? 'scale-110 ring-2 ring-[#ffd166]' : 'opacity-80'}`} style={{ background: HUES[0] }}>
            {sim.firstName}
          </span>
        </div>

        <LudoBoard game={game} can={can} die={die} mine={0} onPick={pick} onSettled={() => setMoving(false)} />

        <div className="mt-3 flex items-center gap-3">
          <button onClick={myRoll} disabled={!mine || die !== null || rolling || moving || game.over} className={`grid h-[68px] w-[68px] shrink-0 place-items-center rounded-2xl transition-[transform,box-shadow] active:scale-95 ${mine && die === null && !rolling && !moving && !game.over ? 'bg-[#fff3d6] shadow-[0_0_0_3px_#ffd166,0_8px_16px_-8px_rgba(0,0,0,0.5)]' : 'bg-[var(--color-canvas)]'}`} aria-label={t('Lancer le dé')}>
            <Die value={face} roll={throws} size={40} pip={DARK[color]} />
          </button>
          <p key={said ?? `${color}-${die}`} className="animate-pop min-w-0 flex-1 text-sm leading-snug font-extrabold">
            {game.over ? (first === 0 ? t('Tu as gagné !') : t('{0} gagne la partie.', { 0: name(first) })) : (said ?? (mine ? (die === null ? (rolling ? '…' : t('À toi : lance le dé.')) : can.length > 1 ? t('Choisis le pion à avancer.') : '…') : t('{0} joue…', { 0: name(color) })))}
          </p>
        </div>
        {(game.over || game.pawns[0].some((p) => p >= 0)) && (
          <button className="btn mt-3 w-full !bg-[#c92a2a] !py-2.5" onClick={() => restart()}>
            <RotateCcw size={16} /> {game.over ? t('Rejouer') : t('Recommencer')}
          </button>
        )}

        <button className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[var(--color-canvas)] px-3 py-2.5 text-left" onClick={() => setRules(!rules)}>
          <span className="font-display text-[15px] font-extrabold">{t('Les règles')}</span>
          <ChevronDown size={18} className={rules ? 'rotate-180' : ''} />
        </button>
        {rules && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">
            <li>{t('Tu as les rouges. Il faut un 6 pour sortir un pion de sa maison.')}</li>
            <li>{t("Chaque pion fait le tour du plateau puis monte sa colonne jusqu'au centre, avec le nombre exact.")}</li>
            <li>{t("Tomber sur un pion d'une autre couleur le renvoie chez lui, sauf sur les cases de départ et les étoiles.")}</li>
            <li>{t('Un 6, un pion pris ou un pion rentré : tu rejoues. Trois 6 de suite et la main passe.')}</li>
            <li>{t('Le premier à rentrer ses quatre pions gagne.')}</li>
          </ul>
        )}
      </div>
    </div>
  )
}

/** A pawn, as a carved piece seen from above: its base, its head lit on top. */
function Pawn({ c, big }: { c: number; big?: boolean }) {
  return (
    <span className="relative block h-full w-full rounded-[34%] transition-transform duration-200" style={{ background: HUES[c], boxShadow: `inset 0 -3px 0 ${DARK[c]}, 0 2px 0 ${DARK[c]}, 0 4px 5px rgba(0,0,0,0.45)`, transform: big ? 'translateY(-14%) scale(1.08)' : undefined }}>
      <span className="absolute inset-[24%] rounded-full" style={{ background: `radial-gradient(circle at 40% 35%, #ffffffaa, ${HUES[c]} 60%)`, boxShadow: `0 1.5px 0 ${DARK[c]}` }} />
    </span>
  )
}

/**
 * The board: the houses, the round, the columns and the pawns (those of colour `mine` that can move lifted,
 * where each would land marked, to pick). A pawn that moves hops square by square; one taken slides back
 * to its house; `onSettled` once all are down. Also played against a player (components/pvp).
 * A pawn that can move is tapped, or dragged with the finger to where it lands: let go near that square, it
 * snaps on it and stays there (even while the move goes to the server); elsewhere, it springs back home.
 */
export function LudoBoard({ game, can, die, mine, onPick, onSettled }: { game: Ludo; can: number[]; die?: number | null; mine: number; onPick: (k: number) => void; onSettled?: () => void }) {
  // The pawns as shown: a step behind the game while they hop.
  const [shown, setShown] = useState<number[][]>(game.pawns)
  const [slow, setSlow] = useState<string | null>(null)
  const prev = useRef(game.pawns)
  const refs = useRef(new Map<string, HTMLSpanElement>())
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])
  const board = useRef<HTMLDivElement>(null)
  // The pawn under the finger (its key, where the finger went down, how far it went), and the one let go
  // on its square, waiting there for the move to come back from the game.
  const drag = useRef<{ key: string; k: number; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null)
  const dropped = useRef<{ key: string; timer: number } | null>(null)
  const [near, setNear] = useState(false)
  useLayoutEffect(() => {
    const before = prev.current
    prev.current = game.pawns
    if (before === game.pawns) return
    const moved: { c: number; k: number; from: number; to: number }[] = []
    const knocked: { c: number; k: number }[] = []
    for (let c = 0; c < 4; c++)
      for (let k = 0; k < 4; k++) {
        const a = before[c]?.[k] ?? -1
        const b = game.pawns[c][k]
        if (a === b) continue
        if (b === -1) knocked.push({ c, k })
        else if (b > a) moved.push({ c, k, from: a, to: b })
      }
    if (!moved.length && !knocked.length) {
      setShown(game.pawns)
      return
    }
    void (async () => {
      const now = before.map((r) => r.slice())
      for (const m of moved) {
        const el = refs.current.get(`${m.c}${m.k}`)
        if (dropped.current?.key === `${m.c}${m.k}`) {
          // Dragged there already: it's put down where it is, a little bump, no hops.
          now[m.c][m.k] = m.to
          setShown(now.map((r) => r.slice()))
          clearTimeout(dropped.current.timer)
          if (el) el.style.transform = ''
          el?.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(0.94)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' })
          await wait(220)
          dropped.current = null
          if (!alive.current) return
          if (m.to === HOME) tableSfx.turn()
          continue
        }
        const steps = m.from < 0 ? [0] : Array.from({ length: m.to - m.from }, (_, i) => m.from + 1 + i)
        for (let i = 0; i < steps.length; i++) {
          now[m.c][m.k] = steps[i]
          setShown(now.map((r) => r.slice()))
          el?.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-55%) scale(1.18)', offset: 0.45 }, { transform: 'translateY(0) scale(1)' }], { duration: 170, easing: 'ease-out' })
          tableSfx.hop(1 + i * 0.05)
          await wait(i === steps.length - 1 ? 200 : 165)
          if (!alive.current) return
        }
        if (m.to === HOME) tableSfx.turn()
      }
      if (knocked.length) {
        await wait(120)
        tableSfx.knocked()
        haptic('medium')
        for (const x of knocked) {
          now[x.c][x.k] = -1
          setSlow(`${x.c}${x.k}`)
        }
        setShown(now.map((r) => r.slice()))
        await wait(560)
        setSlow(null)
      }
      if (!alive.current) return
      setShown(game.pawns)
      onSettled?.()
    })()
  }, [game.pawns]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pawns sharing a square: side by side, a little smaller.
  const share = new Map<string, number>()
  const place = game.players.flatMap((c) => shown[c].map((p, k) => ({ c, k, p, at: cell(c, k, p) })))
  for (const x of place) if (x.p >= 0 && x.p !== HOME) share.set(x.at.join(), (share.get(x.at.join()) ?? 0) + 1)
  const seen = new Map<string, number>()
  // Where the pawns that can move would land.
  const lands = die ? can.map((k) => ({ k, to: target(shown[mine][k], die) })).filter((x) => x.to !== null) : []

  /** A pawn's centre and its landing square's, in px on the board. */
  const centres = (k: number) => {
    const w = board.current?.clientWidth ?? 300
    const to = die ? target(shown[mine][k], die) : null
    const [r0, c0] = cell(mine, k, shown[mine][k])
    const [r1, c1] = to === null ? [r0, c0] : cell(mine, k, to)
    return { cellPx: w / 15, lx: ((c1 - c0) / 15) * w, ly: ((r1 - r0) / 15) * w }
  }
  const down = (k: number, e: React.PointerEvent) => {
    if (!can.includes(k) || dropped.current) return
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { key: `${mine}${k}`, k, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false }
  }
  const moveTo = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.dx = e.clientX - d.x
    d.dy = e.clientY - d.y
    if (!d.moved && Math.hypot(d.dx, d.dy) > 7) ((d.moved = true), tableSfx.lift(), haptic('light'))
    if (!d.moved) return
    const el = refs.current.get(d.key)
    // Lifted under the finger (a little above it, to be seen), bigger.
    if (el) el.style.transform = `translate(${d.dx}px, ${d.dy - 10}px) scale(1.25)`
    const c = centres(d.k)
    const close = Math.hypot(d.dx - c.lx, d.dy - c.ly) < c.cellPx * 1.4
    if (close !== near) (setNear(close), close && haptic('light'))
  }
  const up = (k: number) => {
    const d = drag.current
    drag.current = null
    setNear(false)
    if (!d) return
    if (!d.moved) return onPick(k)
    const el = refs.current.get(d.key)
    const c = centres(k)
    if (Math.hypot(d.dx - c.lx, d.dy - c.ly) < c.cellPx * 1.4) {
      // Snapped onto its square, it waits there for the move (never stuck: back home if it doesn't come).
      el?.animate([{ transform: `translate(${d.dx}px, ${d.dy - 10}px) scale(1.25)` }, { transform: `translate(${c.lx}px, ${c.ly}px) scale(1)` }], { duration: 110, easing: 'ease-out' })
      if (el) el.style.transform = `translate(${c.lx}px, ${c.ly}px)`
      tableSfx.clack()
      haptic('medium')
      const timer = window.setTimeout(() => {
        if (dropped.current?.key !== d.key) return
        dropped.current = null
        el?.animate([{ transform: `translate(${c.lx}px, ${c.ly}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' })
        if (el) el.style.transform = ''
      }, 5000)
      dropped.current = { key: d.key, timer }
      onPick(k)
    } else {
      // Let go anywhere else: it springs back.
      el?.animate([{ transform: `translate(${d.dx}px, ${d.dy - 10}px) scale(1.25)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.3,1.5,.5,1)' })
      if (el) el.style.transform = ''
      tableSfx.slide()
    }
  }
  return (
    <div ref={board} className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] select-none">
      {/* The houses */}
      {HOUSE.map(([r, c], i) => (
        <div key={i} className="absolute rounded-xl" style={{ top: `${(r / 15) * 100}%`, left: `${(c / 15) * 100}%`, width: '40%', height: '40%', background: HUES[i], opacity: game.players.includes(i) ? 1 : 0.35 }}>
          <div className="absolute inset-[16%] rounded-lg bg-white/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]" />
        </div>
      ))}
      {/* The round and the home columns */}
      {PATH.map(([r, c], i) => {
        const start = i % 13 === 0
        return (
          <div key={`p${i}`} className="absolute grid place-items-center border border-black/10" style={{ top: `${(r / 15) * 100}%`, left: `${(c / 15) * 100}%`, width: `${100 / 15}%`, height: `${100 / 15}%`, background: start ? HUES[i / 13] : '#fff' }}>
            {isSafe(i) && !start && <Star size={11} className="text-black/30" />}
          </div>
        )
      })}
      {COLUMN.map((col, ci) =>
        col.map(([r, c], j) => <div key={`c${ci}${j}`} className="absolute border border-black/10" style={{ top: `${(r / 15) * 100}%`, left: `${(c / 15) * 100}%`, width: `${100 / 15}%`, height: `${100 / 15}%`, background: HUES[ci], opacity: 0.8 }} />),
      )}
      {/* The centre */}
      <div className="absolute" style={{ top: '40%', left: '40%', width: '20%', height: '20%', background: `conic-gradient(from 225deg, ${HUES[0]} 0 25%, ${HUES[1]} 0 50%, ${HUES[2]} 0 75%, ${HUES[3]} 0 100%)` }} />
      {/* Where a pawn picked would land */}
      {lands.map(({ k, to }) => {
        const [r, c] = cell(mine, k, to!)
        return <span key={`l${k}`} className={`pointer-events-none absolute z-[5] rounded-full border-[3px] border-dashed transition-transform ${near ? 'scale-125' : 'animate-pulse'}`} style={{ top: `${((r + 0.12) / 15) * 100}%`, left: `${((c + 0.12) / 15) * 100}%`, width: `${76 / 15}%`, height: `${76 / 15}%`, borderColor: HUES[mine], background: near ? `${HUES[mine]}55` : undefined }} />
      })}
      {/* The pawns */}
      {place.map(({ c, k, p, at: [r, col] }) => {
        const here = c === mine && can.includes(k)
        const key = `${c}${k}`
        const n = p >= 0 && p !== HOME ? (share.get([r, col].join()) ?? 1) : 1
        const j = seen.get([r, col].join()) ?? 0
        seen.set([r, col].join(), j + 1)
        const size = n > 1 ? 52 : 70
        const off = n > 1 ? (j - (n - 1) / 2) * 0.32 : 0
        return (
          <button
            key={key}
            onPointerDown={(e) => down(k, e)}
            onPointerMove={moveTo}
            onPointerUp={() => up(k)}
            onPointerCancel={() => up(k)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(k)}
            disabled={!here && dropped.current?.key !== key}
            className={`absolute ${here ? 'z-20' : 'z-10'}`}
            style={{ top: `${((r + 0.5 - size / 200 + off * 0.3) / 15) * 100}%`, left: `${((col + 0.5 - size / 200 + off) / 15) * 100}%`, width: `${size / 15}%`, height: `${size / 15}%`, zIndex: dropped.current?.key === key ? 30 : undefined, transition: dropped.current?.key === key ? 'none' : `top ${slow === key ? 520 : 150}ms ${slow === key ? 'cubic-bezier(.3,.8,.3,1)' : 'ease-out'}, left ${slow === key ? 520 : 150}ms ${slow === key ? 'cubic-bezier(.3,.8,.3,1)' : 'ease-out'}` }}
            aria-label={t('Pion {0}', { 0: k + 1 })}
          >
            <span ref={(el) => void (el ? refs.current.set(key, el) : refs.current.delete(key))} className="block h-full w-full will-change-transform">
              <Pawn c={c} big={here} />
            </span>
            {here && <span className="absolute -inset-[18%] -z-10 animate-ping rounded-full opacity-40" style={{ background: HUES[c] }} />}
          </button>
        )
      })}
    </div>
  )
}
