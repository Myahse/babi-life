import { lazy, Suspense, useMemo, useState } from 'react'
import { ChevronLeft, Trophy } from 'lucide-react'
import type { Look } from '../../../lib/types'
import { MatchSetup, rulesOf, Shirt, type Setup } from './Hub'
import { CLUBS, kitsFor, NATIONS, teamOf, type Team } from './teams'
import { scoreOf } from './sim'

// Babi Foot's cup: eight sides, knock-out. The player's side and seven drawn
// among its own kind (clubs or nations); the quarter-finals, the semis, the
// final, each a little harder, a draw settled on penalties or the golden goal
// as chosen. The other ties are played out by the console (by the sides'
// stars), the bracket filled in round by round. Kept on the phone between
// rounds: a cup left halfway is there to take up again.

const StreetMatch = lazy(() => import('../../../streetball/StreetMatch'))

export type Tie = { a: string; b: string; ga: number; gb: number; pens?: [number, number]; win: string }
export type CupState = { setup: Setup; teams: string[]; ties: Tie[][]; round: number; out: boolean }

const KEY = 'babi.foot.cup'
export const ROUNDS = ['Quarts de finale', 'Demi-finales', 'Finale']
const NEXT = ['le quart de finale', 'la demi-finale', 'la finale']
const OUT = ['Éliminé·e en quart de finale', 'Éliminé·e en demi-finale', 'Battu·e en finale']
/** Each round a little harder than the last. */
const HARDER = [1, 1.05, 1.1]

export function loadCup(): CupState | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as CupState | null
    if (c && c.teams?.length === 8 && Array.isArray(c.ties) && c.teams.every((id) => teamOf(id).id === id)) return c
  } catch {
    /* none kept */
  }
  return null
}
function saveCup(c: CupState | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: not kept */
  }
}

/** The draw: the player's side first, seven others of its kind in a random order. */
export function drawCup(setup: Setup, rnd = Math.random): CupState {
  const mine = teamOf(setup.mine)
  const pool = (mine.kind === 'club' ? CLUBS : NATIONS).filter((t) => t.id !== mine.id).map((t) => t.id)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return { setup, teams: [mine.id, ...pool.slice(0, 7)], ties: [], round: 0, out: false }
}

/** A round's pairs: the draw's order in the quarters, then the winners two by two. */
export function pairsOf(c: CupState, round: number): [string, string][] {
  const ids = round === 0 ? c.teams : (c.ties[round - 1]?.map((t) => t.win) ?? [])
  const out: [string, string][] = []
  for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]])
  return out
}

/** A shoot-out played out: five each, then one each; three in four go in. */
function pensOf(rnd: () => number): [number, number] {
  let [a, b] = [0, 0]
  for (let k = 0; k < 5; k++) {
    if (rnd() < 0.75) a++
    if (rnd() < 0.75) b++
  }
  while (a === b) {
    if (rnd() < 0.75) a++
    if (rnd() < 0.75) b++
  }
  return [a, b]
}

/** A tie the player isn't in: played out by the console, the stronger side more likely through. */
export function simTie(a: Team, b: Team, size: 5 | 11, rnd = Math.random): Tie {
  const [ga, gb] = scoreOf(a, b, size, rnd)
  if (ga !== gb) return { a: a.id, b: b.id, ga, gb, win: ga > gb ? a.id : b.id }
  const pens = pensOf(rnd)
  return { a: a.id, b: b.id, ga, gb, pens, win: pens[0] > pens[1] ? a.id : b.id }
}

/** The player's match done: the round's other ties played out; through, the next round; out, the rest of the cup to its winner. */
export function afterMatch(c: CupState, mine: Omit<Tie, 'win' | 'a' | 'b'>, won: boolean, rnd = Math.random): CupState {
  const me = c.setup.mine
  const next: CupState = { ...c, ties: c.ties.map((r) => [...r]) }
  let round = c.round
  let out = c.out
  for (; round < ROUNDS.length; round++) {
    const ties = pairsOf(next, round).map(([a, b]): Tie => {
      if (round === c.round && (a === me || b === me)) {
        const flip = b === me
        const [ga, gb] = flip ? [mine.gb, mine.ga] : [mine.ga, mine.gb]
        const pens = mine.pens && (flip ? ([mine.pens[1], mine.pens[0]] as [number, number]) : mine.pens)
        return { a, b, ga, gb, pens, win: won ? me : flip ? a : b }
      }
      return simTie(teamOf(a), teamOf(b), c.setup.size, rnd)
    })
    next.ties[round] = ties
    if (round === c.round && !won) out = true
    // Still in: the next round is the player's to play.
    if (!out) break
  }
  return { ...next, round: out ? ROUNDS.length : c.round + 1, out }
}

/** The cup as a défi score: all of it for the cup; out, a third for each round won and a little for how close. */
export function cupScore(c: CupState) {
  const me = c.setup.mine
  if (!c.out) return 100
  const lost = c.ties.findIndex((r) => r.some((t) => (t.a === me || t.b === me) && t.win !== me))
  const t = c.ties[lost]?.find((x) => x.a === me || x.b === me)
  const [mine, theirs] = t ? (t.a === me ? [t.ga, t.gb] : [t.gb, t.ga]) : [0, 0]
  return Math.min(99, Math.round(lost * 33 + Math.max(0, 10 - 3 * (theirs - mine))))
}

type Me = { look: Look; gender: 'femme' | 'homme' }

/** The cup: set up, the bracket between rounds, the player's matches; the score once it's over. */
export function Cup({ me, onEnd, onBack }: { me: Me; onEnd: (score: number) => void; onBack: () => void }) {
  const [cup, setCup] = useState<CupState | null>(loadCup)
  const [playing, setPlaying] = useState(false)
  const [round, setRound] = useState(0)
  const set = (c: CupState | null) => {
    saveCup(c)
    setCup(c)
  }
  const done = !!cup && (cup.out || cup.round >= ROUNDS.length)
  const pair = cup && !done ? pairsOf(cup, cup.round).find((p) => p.includes(cup.setup.mine)) : undefined
  const theirs = pair ? (pair[0] === cup!.setup.mine ? pair[1] : pair[0]) : null
  // Kept from render to render: a new one would start the match over.
  const rules = useMemo(() => (cup && theirs ? rulesOf({ ...cup.setup, theirs }, cup.setup.draw ?? 'pens', HARDER[cup.round] ?? 1) : null), [cup, theirs])
  if (!cup) return <MatchSetup title="La Coupe" cup onBack={onBack} onPlay={(s) => set(drawCup({ ...s, draw: s.draw ?? 'pens' }))} />
  const mine = teamOf(cup.setup.mine)
  if (playing && theirs && rules) {
    const them = teamOf(theirs)
    return (
      <Suspense fallback={<div className="grid h-full place-items-center bg-[#0b2e1a] px-6 text-center font-display text-xl font-extrabold text-white">{`${ROUNDS[cup.round]} : ${mine.name} contre ${them.name}…`}</div>}>
        <StreetMatch
          key={round}
          sport="foot"
          name="Toi"
          look={me.look}
          gender={me.gender}
          rules={rules}
          teams={[mine.name, them.name]}
          kits={kitsFor(mine, them)}
          // Left mid-match: back to the bracket, the match to play again; played out, the round goes on.
          onExit={(r) => {
            setPlaying(false)
            if (r) set(afterMatch(cup, { ga: r.score[0], gb: r.score[1], pens: r.pens }, r.result === 'win'))
          }}
        />
      </Suspense>
    )
  }
  const champion = done ? cup.ties[ROUNDS.length - 1]?.[0]?.win : null
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#1f7a3f,#0b2e1a_70%)] px-4 pt-12 pb-6 text-white">
      <div className="flex items-center gap-2">
        <button className="grid h-9 w-9 place-items-center rounded-full bg-black/30" onClick={onBack} aria-label="Retour">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <div className="font-display text-[26px] leading-tight font-extrabold">La Coupe</div>
          <div className="text-[12px] font-bold text-white/65">
            {cup.setup.size} contre {cup.setup.size} · {cup.setup.draw === 'golden' ? 'but en or' : 'tirs au but'} en cas de nul
          </div>
        </div>
      </div>
      <Bracket cup={cup} />
      {done ? (
        <div className="card animate-pop mt-4 p-4 text-center text-[var(--color-ink)]">
          <Trophy size={30} className="mx-auto text-[#f59f00]" />
          <div className="mt-1 font-display text-[22px] leading-tight font-extrabold">
            {cup.out ? (OUT[cup.ties.findIndex((r) => r.some((t) => (t.a === mine.id || t.b === mine.id) && t.win !== mine.id))] ?? 'Éliminé·e') : `${mine.name} gagne la Coupe !`}
          </div>
          {cup.out && champion && <p className="mt-1 text-[14px] font-bold">La Coupe est pour {teamOf(champion).name}.</p>}
          <button
            className="btn mt-3 w-full"
            onClick={() => {
              const s = cupScore(cup)
              set(null)
              onEnd(s)
            }}
          >
            Voir le résultat
          </button>
        </div>
      ) : (
        theirs && (
          <div className="mt-4 rounded-[20px] bg-white/10 p-3 ring-1 ring-white/12">
            <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{ROUNDS[cup.round]}</div>
            <div className="mt-1.5 flex items-center justify-center gap-3">
              <TeamTag t={mine} />
              <span className="font-display text-[16px] font-extrabold text-white/60">contre</span>
              <TeamTag t={teamOf(theirs)} />
            </div>
            <button
              className="btn mt-3 w-full !bg-[#ffd43b] !py-3 !text-[#16161c] shadow-[0_4px_0_#e09a00]"
              onClick={() => {
                setRound((r) => r + 1)
                setPlaying(true)
              }}
            >
              Jouer {NEXT[cup.round]}
            </button>
            <button className="mt-2 w-full text-center text-[12.5px] font-extrabold text-white/60" onClick={() => set(null)}>
              Abandonner la coupe
            </button>
          </div>
        )
      )}
    </div>
  )
}

function TeamTag({ t }: { t: Team }) {
  return (
    <span className="flex min-w-0 flex-col items-center">
      <Shirt color={t.home} size={38} />
      <span className="max-w-[8.5rem] truncate font-display text-[15px] leading-tight font-extrabold">{t.name}</span>
    </span>
  )
}

/** The bracket: the quarters, the semis, the final, filled in as they're played. */
function Bracket({ cup }: { cup: CupState }) {
  const me = cup.setup.mine
  return (
    <div className="mt-4 grid grid-cols-3 gap-1.5">
      {ROUNDS.map((name, r) => {
        const pairs = pairsOf(cup, r)
        const n = 4 >> r
        return (
          <div key={r} className="flex flex-col">
            <div className="mb-1 text-center text-[10px] font-extrabold tracking-wide text-white/55 uppercase">{name}</div>
            <div className="flex flex-1 flex-col justify-around gap-1.5">
              {Array.from({ length: n }, (_, k) => {
                const tie = cup.ties[r]?.[k]
                const ids = tie ? [tie.a, tie.b] : (pairs[k] ?? [null, null])
                return (
                  <div key={k} className="rounded-xl bg-black/25 px-1.5 py-1">
                    {ids.map((id, side) => {
                      const t = id ? teamOf(id) : null
                      const g = tie ? (side === 0 ? tie.ga : tie.gb) : null
                      const p = tie?.pens ? tie.pens[side] : null
                      const lost = tie && tie.win !== id
                      return (
                        <div key={side} className={`flex items-center gap-1 py-0.5 text-[11.5px] font-extrabold ${lost ? 'opacity-45' : ''} ${id === me ? 'text-[#ffd43b]' : ''}`}>
                          {t ? <Shirt color={t.home} size={14} /> : <span className="h-3.5 w-3.5 rounded-sm bg-white/15" />}
                          <span className="truncate">{t?.short ?? '…'}</span>
                          <span className="ml-auto tabular-nums">
                            {g ?? ''}
                            {p !== null && <span className="text-[9.5px] text-white/60"> ({p})</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
