import { useEffect, useRef, useState } from 'react'
import { PvpButton } from '../components/pvp/PvpButton'
import { ChevronDown, Dice5, RotateCcw, Star } from 'lucide-react'
import type { Sim } from '../lib/types'
import { HOME, isSafe, legal, move, newLudo, roll, square, think, type Ludo } from '../game/ludo'
import { t } from '../lib/i18n'

// Ludo 225 on the phone: the board of the courtyards, the player in red
// against the computer (one face to face, or three round the board). For
// nothing: no stake. The rules: game/ludo.ts.

const HUES = ['#e03131', '#2f9e44', '#f2b705', '#1c7ed6']
const BOTS = ['', t('Koffi'), t('Mariam'), t('Junior')]

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

export function LudoApp({ sim }: { sim: Sim }) {
  const [seats, setSeats] = useState<2 | 4>(4)
  const [game, setGame] = useState<Ludo>(() => newLudo(4))
  const [die, setDie] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [rules, setRules] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const color = game.players[game.turn]
  const mine = color === 0
  const name = (c: number) => (c === 0 ? sim.firstName : BOTS[c])

  const after = (g: Ludo, d: number, k: number | null) => {
    const r = move(g, k, d)
    if (r.taken.length) setSaid(`${r.taken.length > 1 ? t('Deux pions renvoyés') : t('{0} retourne à la maison', { 0: name(r.taken[0].c) })} !`)
    else if (r.arrived) setSaid(t('{0} rentre un pion au centre !', { 0: name(color) }))
    else if (r.again && d === 6) setSaid(t('Six : on rejoue !'))
    else setSaid(null)
    setGame(r.game)
    setDie(null)
  }
  const throwDie = (then: (d: number) => void) => {
    setRolling(true)
    let n = 0
    const spin = () => {
      setDie(roll())
      if (++n < 7) timer.current = setTimeout(spin, 70)
      else {
        const d = roll()
        setDie(d)
        setRolling(false)
        then(d)
      }
    }
    spin()
  }
  // The computer's turns: roll, think, move.
  useEffect(() => {
    if (game.over || mine || die !== null || rolling) return
    timer.current = setTimeout(
      () =>
        throwDie((d) => {
          timer.current = setTimeout(() => after(game, d, think(game, d)), 600)
        }),
      700,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, mine, die, rolling])
  const myRoll = () => {
    if (!mine || die !== null || rolling || game.over) return
    throwDie((d) => {
      const can = legal(game, d)
      if (!can.length) {
        setSaid(d === 6 ? t('Six, mais aucun pion ne peut bouger.') : t('{d} : aucun pion ne peut bouger.', { d }))
        timer.current = setTimeout(() => after(game, d, null), 1100)
      } else if (can.length === 1) timer.current = setTimeout(() => after(game, d, can[0]), 450)
    })
  }
  const pick = (k: number) => {
    if (!mine || die === null || rolling || !legal(game, die).includes(k)) return
    after(game, die, k)
  }
  const restart = (n: 2 | 4 = seats) => {
    clearTimeout(timer.current)
    setSeats(n)
    setGame(newLudo(n))
    setDie(null)
    setRolling(false)
    setSaid(null)
  }
  const can = mine && die !== null && !rolling ? legal(game, die) : []
  const first = game.winners[0]

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

        <LudoBoard game={game} can={can} mine={0} onPick={pick} />

        <div className="mt-3 flex items-center gap-3">
          <button onClick={myRoll} disabled={!mine || die !== null || rolling || game.over} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl font-black shadow-[0_6px_14px_-6px_rgba(0,0,0,0.5)] disabled:opacity-70" style={{ color: HUES[color] }} aria-label={t('Lancer le dé')}>
            {die ?? <Dice5 size={28} />}
          </button>
          <p className="min-w-0 flex-1 text-sm leading-snug font-extrabold">
            {game.over ? (first === 0 ? t('Tu as gagné !') : t('{0} gagne la partie.', { 0: name(first) })) : said ?? (mine ? (die === null ? t('À toi : lance le dé.') : can.length > 1 ? t('Choisis le pion à avancer.') : '…') : t('{0} joue…', { 0: name(color) }))}
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

/** The board: the houses, the round, the columns and the pawns (those of colour `mine` that can move, bouncing, to pick). Also played against a player (components/pvp). */
export function LudoBoard({ game, can, mine, onPick }: { game: Ludo; can: number[]; mine: number; onPick: (k: number) => void }) {
  const pick = onPick
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]">
      {/* The houses */}
      {HOUSE.map(([r, c], i) => (
        <div key={i} className="absolute rounded-xl" style={{ top: `${(r / 15) * 100}%`, left: `${(c / 15) * 100}%`, width: '40%', height: '40%', background: HUES[i], opacity: game.players.includes(i) ? 1 : 0.35 }}>
          <div className="absolute inset-[16%] rounded-lg bg-white/90" />
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
      {/* The pawns */}
      {game.players.map((c) =>
        game.pawns[c].map((p, k) => {
          const [r, col] = cell(c, k, p)
          const here = c === mine && can.includes(k)
          return (
            <button
              key={`${c}${k}`}
              onClick={() => pick(k)}
              disabled={!here}
              className={`absolute grid place-items-center rounded-full border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-300 ${here ? 'z-20 animate-bounce' : 'z-10'}`}
              style={{ top: `${((r + 0.15) / 15) * 100}%`, left: `${((col + 0.15) / 15) * 100}%`, width: `${70 / 15}%`, height: `${70 / 15}%`, background: HUES[c] }}
              aria-label={t('Pion {0}', { 0: k + 1 })}
            />
          )
        }),
      )}
    </div>
  )
}
