import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dice5, Hourglass, X } from 'lucide-react'
import { api, errorText, type PvpMatch, type PvpNow, type PvpOther } from '../../lib/api'
import { serverNow } from '../../lib/worldClock'
import type { Sim } from '../../lib/types'
import type { CourtMatch } from '../../streetball/online'
import type { Rules } from '../../streetball/game'
import { legal as awaleLegal, move as awaleMove, newAwale, winner as awaleWinner, type Awale } from '../../game/awale'
import { legal as ludoLegal, move as ludoMove, newLudo, type Ludo } from '../../game/ludo'
import { LudoBoard } from '../../screens/LudoApp'
import { DuelMatch } from '../defi/Combat'
import { FightNet } from '../defi/combat/net'
import { MoustiquesDefi } from '../defi/Moustiques'
import { TeaDefi } from '../defi/Tea'
import { CoursesDefi } from '../defi/Courses'
import { CoursePvp } from './course'
import { PvpLine } from './line'
import { PvpOver } from './PvpLayer'
import { PVP_GAMES } from './games'
import { t as tr, tx } from '../../lib/i18n'

// A game against a real player, on this phone (update « jeux-en-ligne »,
// components/pvp/PvpLayer.tsx): the console's foot (streetball's match on
// the hub's "pvp" room), the fight (the street duel's line), the race
// (course.tsx), the arcade, the tea and the shopping list (each plays its own
// at the same time, the other's score seen as it comes), the awalé and the
// Ludo move by move (both phones play the same rules from the same moves,
// the dice thrown by the server), le godé (the server plays it). Then who won,
// as the server has it.

const StreetMatch = lazy(() => import('../../streetball/StreetMatch'))

type Props = { sim: Sim; token: string; now: PvpNow; onNow: (n: PvpNow) => void; onClose: () => void }

export default function Play({ sim, token, now, onNow, onClose }: Props) {
  const m = now.match!
  const other = now.others?.[0]
  const seat = m.players.indexOf(sim.id)
  // Said once: how this phone saw it end (the server decides when both have).
  const said = useRef(false)
  const [sent, setSent] = useState(false)
  const report = useCallback(
    (winner: string, quit = false) => {
      if (said.current) return
      said.current = true
      setSent(true)
      void api
        .pvpEnd(sim.id, m.id, winner, quit)
        .then(onNow)
        .catch(() => undefined)
    },
    [sim.id, m.id, onNow],
  )
  if (m.state === 'done' || !other)
    return (
      <div className="fixed inset-0 z-[90] bg-[#0f1230]">
        <PvpOver won={m.winner === sim.id} draw={m.draw || !m.winner} text={m.result} onClose={onClose} />
      </div>
    )
  // Played out here, the other's word not in yet (it has 30 s).
  if (sent && m.game !== 'awale' && m.game !== 'ludo')
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0f1230] p-6 text-center text-white" data-pvp="waiting-result">
        <div>
          <Hourglass size={34} className="mx-auto opacity-80" />
          <div className="mt-2 font-display text-xl font-extrabold">{tr('Le résultat arrive…')}</div>
          <p className="mt-1 text-sm font-bold text-white/70">{tx('On attend le téléphone de {name}.', { name: other.name })}</p>
        </div>
      </div>
    )
  const quit = () => report('', true)
  const p = { sim, token, m, other, seat, report, quit, onNow }
  switch (m.game) {
    case 'foot':
      return <FootPvp {...p} />
    case 'combat':
      return <CombatPvp {...p} />
    case 'course':
      return <CoursePvp {...p} />
    case 'awale':
      return <AwalePvp {...p} />
    case 'ludo':
      return <LudoPvp {...p} />
    case 'gode':
      return <GodePvp {...p} />
    default:
      return <ScorePvp {...p} />
  }
}

export type RunProps = { sim: Sim; token: string; m: PvpMatch; other: PvpOther; seat: number; report: (winner: string, quit?: boolean) => void; quit: () => void; onNow: (n: PvpNow) => void }

/** Before the whistle (real time): the count, both phones opening the line. */
function useWhistle(start: number) {
  const [left, setLeft] = useState(() => Math.ceil((start - serverNow()) / 1000))
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(Math.ceil((start - serverNow()) / 1000)), 200)
    return () => clearTimeout(t)
  }, [left, start])
  return left
}

function Count({ left, m, other }: { left: number; m: PvpMatch; other: PvpOther }) {
  const look = PVP_GAMES[m.game]
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0f1230] p-6 text-center text-white" data-pvp="count">
      <div>
        <div className="text-sm font-extrabold tracking-wider text-white/70 uppercase">{look.title}</div>
        <div className="mt-1 font-display text-2xl font-extrabold">{tr('Contre')} {other.name}</div>
        <div key={left} className="animate-pop mt-4 font-display text-[80px] leading-none font-extrabold">
          {Math.max(1, left)}
        </div>
      </div>
    </div>
  )
}

/** Le foot à la console, five a side, each player its side's winger (streetball/online.ts, the first runs the match). */
function FootPvp({ sim, token, m, other, report }: RunProps) {
  const match = useMemo<CourtMatch>(
    () => ({
      id: m.id,
      place: 'console',
      sport: 'foot',
      start: m.start,
      end: m.start + 200_000,
      cap: 2,
      entries: m.players.map((s, i) => ({ sim: s, name: m.names[i], gender: s === sim.id ? sim.gender : other.gender, look: s === sim.id ? sim.look : other.look, slot: i === 0 ? 2 : 7 })),
    }),
    [m.id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const online = useMemo(() => ({ token, simId: sim.id, match, pvp: true }), [token, sim.id, match])
  const rules = useMemo<Rules>(() => ({ size: 5, referee: true, switching: false, length: 150 }), [])
  return (
    <div className="fixed inset-0 z-[90] bg-[#0b1a10]">
      <Suspense fallback={<div className="grid h-full place-items-center font-display text-xl font-extrabold text-white">{tr('Babi Foot…')}</div>}>
        <StreetMatch
          sport="foot"
          name={sim.firstName}
          look={sim.look}
          gender={sim.gender}
          rules={rules}
          teams={[m.names[0], m.names[1]]}
          online={online}
          onExit={(r) => {
            if (!r) return report('', true)
            const [a, b] = r.score
            report(a > b ? m.players[0] : b > a ? m.players[1] : '')
          }}
        />
      </Suspense>
    </div>
  )
}

/** The fight: the street duel's line, on the "pvp" room (the first player runs it). */
function CombatPvp({ sim, token, m, other, seat, report, quit }: RunProps) {
  const [net, setNet] = useState<FightNet | null>(null)
  useEffect(() => {
    const n = new FightNet(token, sim.id, m.id, seat === 0, 'pvp')
    setNet(n)
    return () => n.close()
  }, [token, sim.id, m.id, seat])
  const versus = useMemo(() => net && { name: other.name, look: other.look, gender: other.gender, net, onOver: (won: boolean, gone?: boolean) => report(won || gone ? sim.id : other.id) }, [net, other, sim.id, report])
  const me = useMemo(() => ({ look: sim.look, gender: sim.gender }), [sim.look, sim.gender])
  return (
    <div className="fixed inset-0 z-[90] bg-[#0f0b22]">
      {versus && <DuelMatch me={me} baby={m.baby} versus={versus} />}
      <Quit onQuit={quit} />
    </div>
  )
}

function Quit({ onQuit, top = 'top-12' }: { onQuit: () => void; top?: string }) {
  return (
    <button className={`absolute ${top} right-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white`} onClick={onQuit} aria-label={tr('Quitter la partie')}>
      <X size={17} strokeWidth={2.6} />
    </button>
  )
}

/** The arcade, the tea, the shopping list: each plays its own at the same time; the other's score as it comes; the best wins. */
function ScorePvp({ sim, token, m, other, report, quit }: RunProps) {
  const left = useWhistle(m.start)
  const [mine, setMine] = useState<number | null>(null)
  const [theirs, setTheirs] = useState<{ done: boolean; score: number; there: boolean } | null>(null)
  const line = useRef<PvpLine | null>(null)
  useEffect(() => {
    const l = new PvpLine(token, sim.id, m.id)
    line.current = l
    return () => l.close()
  }, [token, sim.id, m.id])
  const mineRef = useRef(mine)
  mineRef.current = mine
  useEffect(() => {
    const t = setInterval(() => {
      const l = line.current
      if (!l) return
      l.send([mineRef.current === null ? 0 : 1, mineRef.current ?? 0])
      const h = l.heard
      setTheirs(h ? { done: h.k[0] > 0, score: h.k[1] ?? 0, there: !l.gone } : l.gone ? { done: false, score: 0, there: false } : null)
    }, 250)
    return () => clearInterval(t)
  }, [])
  // Both done (or the other gone): who won.
  useEffect(() => {
    if (mine === null || !theirs) return
    if (theirs.done) report(mine > theirs.score ? sim.id : theirs.score > mine ? other.id : '')
    else if (!theirs.there) report(sim.id)
  }, [mine, theirs, report, sim.id, other.id])
  if (left > 0) return <Count left={left} m={m} other={other} />
  const look = PVP_GAMES[m.game]
  const bg = m.game === 'arcade' ? '#070a1c' : m.game === 'the' ? 'linear-gradient(#141735, #2a1c2c)' : 'linear-gradient(#1b1f4b, #0f1230)'
  return (
    <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: bg }}>
      {/* The other's score, live. */}
      <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-30 flex justify-center" data-pvp="their-score">
        <span className="rounded-full bg-black/60 px-3 py-1 text-[12px] font-extrabold text-white">
          {other.name} : {theirs?.done ? `${theirs.score}/100` : theirs && !theirs.there ? 'parti·e' : tr('en train de jouer…')}
        </span>
      </div>
      {mine === null ? (
        m.game === 'arcade' ? <MoustiquesDefi onEnd={setMine} /> : m.game === 'the' ? <TeaDefi onEnd={setMine} /> : <CoursesDefi big={false} onEnd={setMine} />
      ) : (
        <div className="grid flex-1 place-items-center p-6 text-center text-white">
          <div>
            <div className="text-sm font-extrabold text-white/70 uppercase">{look.title}</div>
            <div className="mt-1 font-display text-[44px] leading-none font-extrabold">{mine}/100</div>
            <p className="mt-2 text-sm font-bold text-white/75">{theirs?.done ? '' : tr('On attend le score de {name}…', { name: other.name })}</p>
          </div>
        </div>
      )}
      <Quit onQuit={quit} />
    </div>
  )
}

/** The clock of a move-by-move game: what's left to the one who plays. */
function useDeadline(deadline?: number) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    const tick = () => setLeft(deadline ? Math.max(0, Math.ceil((deadline - serverNow()) / 1000)) : 0)
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [deadline])
  return left
}

function TurnBar({ mine, name, left, text }: { mine: boolean; name: string; left: number; text?: string | null }) {
  return (
    <div className={`mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold ${mine ? 'bg-[#fff3c4] text-[#7a5200]' : 'bg-white/10 text-white'}`} data-pvp="turn">
      <span className="min-w-0 flex-1">{text ?? (mine ? tr('À toi de jouer') : tr('{name} joue…', { name }))}</span>
      {left > 0 && (
        <span className={`tabular-nums ${left <= 10 ? 'text-[#e03131]' : ''}`}>
          <Hourglass size={13} className="mr-0.5 inline" />
          {tx('{left} s', { left })}
        </span>
      )}
    </div>
  )
}

/** A move sent: the match back from the server (or, refused, as it stands there). */
function useMove({ sim, m, onNow }: RunProps) {
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const send = (mv: Record<string, unknown>, next: number, roll = false) => {
    setBusy(true)
    setErr(null)
    void api
      .pvpMove(sim.id, m.id, m.game === 'gode' ? m.gode!.round * 4 + ['roll1', 'call', 'roll2'].indexOf(m.gode!.phase) : (m.moves?.length ?? 0), mv, next, roll)
      .then(onNow)
      .catch((e) => (setErr(errorText(e, tr('Coup refusé'))), void api.pvp(sim.id).then(onNow, () => undefined)))
      .finally(() => setBusy(false))
  }
  return { send, err, busy }
}

/** L'awalé, from the moves (game/awale.ts): the first player has the holes 0–5, the other 6–11 (shown at the bottom on its own phone). */
function AwalePvp(p: RunProps) {
  const { m, seat, other, sim, report } = p
  const game = useMemo<Awale>(() => (m.moves ?? []).reduce((g, x) => awaleMove(g, Number(x.m.i)), newAwale(0)), [m.moves])
  const { send, err, busy } = useMove(p)
  const left = useDeadline(m.deadline)
  const mine = game.turn === seat && !game.over
  const can = mine && !busy ? awaleLegal(game) : []
  useEffect(() => {
    if (!game.over) return
    const w = awaleWinner(game)
    report(w < 0 ? '' : m.players[w])
  }, [game.over]) // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (i: number) => can.includes(i) && send({ i }, awaleMove(game, i).turn)
  const row = (ids: number[]) => (
    <div className="grid grid-cols-6 gap-1.5">
      {ids.map((i) => (
        <button key={i} onClick={() => tap(i)} disabled={!can.includes(i)} data-hole={i} className={`relative grid aspect-square place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#3a2312,#5c3a1e_70%,#7a522c)] font-display text-lg font-extrabold text-[#f3e6c8] shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] ${can.includes(i) ? 'ring-2 ring-white/60' : ''} ${m.moves?.length && Number(m.moves[m.moves.length - 1].m.i) === i ? 'ring-2 ring-[#ffd166]' : ''}`}>
          {game.holes[i]}
        </button>
      ))}
    </div>
  )
  // Its own row at the bottom, from its left: seat 0 holds 0–5, seat 1 6–11 (each sows counter-clockwise).
  const bottom = seat === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11]
  const top = seat === 0 ? [11, 10, 9, 8, 7, 6] : [5, 4, 3, 2, 1, 0]
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(160deg,#9c6b3a,#2a170a)] p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white" data-pvp="awale">
      <div className="mx-auto max-w-[420px]">
        <div className="font-display text-2xl font-extrabold">{tr('AWALÉ 225')}</div>
        <div className="text-sm font-bold opacity-80">{tx('Contre {name}, en direct', { name: other.name })}</div>
        <div className="mt-3 rounded-[22px] p-3 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]" style={{ background: 'linear-gradient(180deg,#b9824a,#8a5a2b)' }}>
          <div className="mb-1 flex justify-between text-[12px] font-extrabold">
            <span>{other.name}</span>
            <span className="rounded-full bg-black/30 px-2" data-store="them">{game.store[1 - seat]} {tr('graines')}</span>
          </div>
          {row(top)}
          <div className="my-2 h-[3px] rounded-full bg-black/20" />
          {row(bottom)}
          <div className="mt-1 flex justify-between text-[12px] font-extrabold">
            <span>{sim.firstName} {tr('(toi)')}</span>
            <span className="rounded-full bg-black/30 px-2" data-store="me">{game.store[seat]} {tr('graines')}</span>
          </div>
        </div>
        <TurnBar mine={mine} name={other.name} left={left} text={err ?? (game.over ? tr('Partie finie') : mine ? tr('À toi : touche un trou de ta rangée.') : null)} />
      </div>
      <Quit onQuit={p.quit} top="top-[max(1rem,env(safe-area-inset-top))]" />
    </div>
  )
}

/** Le Ludo, rouge contre jaune, from the moves (game/ludo.ts): the dice thrown by the server. */
function LudoPvp(p: RunProps) {
  const { m, seat, other, report } = p
  // The game as the moves make it, and a die thrown not yet played.
  const { game, die, last } = useMemo(() => {
    let g: Ludo = newLudo(2)
    let d: number | null = null
    // The last die thrown (shown, faded, once played: the other sees what came).
    let last: number | null = null
    for (const x of m.moves ?? []) {
      if (x.m.a === 'roll') last = d = x.die ?? null
      else if (x.m.a === 'move' && d !== null) {
        g = ludoMove(g, x.m.k === null || x.m.k === undefined ? null : Number(x.m.k), d).game
        d = null
      }
    }
    return { game: g, die: d, last }
  }, [m.moves])
  const { send, err, busy } = useMove(p)
  const left = useDeadline(m.deadline)
  const mine = game.turn === seat && !game.over
  const can = mine && die !== null && !busy ? ludoLegal(game, die) : []
  const play = (k: number | null) => send({ a: 'move', k }, ludoMove(game, k, die!).game.turn)
  // Nothing can move, or only one pawn: played by itself after a moment.
  const n = m.moves?.length ?? 0
  useEffect(() => {
    if (!mine || die === null || busy) return
    const options = ludoLegal(game, die)
    if (options.length > 1) return
    const t = setTimeout(() => play(options[0] ?? null), options.length ? 500 : 1100)
    return () => clearTimeout(t)
  }, [n, mine, die]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!game.over) return
    const w = m.players[game.players.indexOf(game.winners[0])]
    report(w ?? '')
  }, [game.over]) // eslint-disable-line react-hooks/exhaustive-deps
  const color = game.players[seat]
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(160deg,#e03131,#3a0710)] p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white" data-pvp="ludo">
      <div className="mx-auto max-w-[420px]">
        <div className="font-display text-2xl font-extrabold">{tr('LUDO 225')}</div>
        <div className="text-sm font-bold opacity-80">
          {tx('Tu as les {0}, contre {name}', { 0: color === 0 ? 'rouges' : 'jaunes', name: other.name })}
        </div>
        <div className="mt-3">
          <LudoBoard game={game} can={can} mine={color} onPick={(k) => can.includes(k) && play(k)} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => mine && die === null && !busy && send({ a: 'roll' }, seat, true)} disabled={!mine || die !== null || busy} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl font-black text-[#16161c] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.5)] disabled:opacity-70" aria-label={tr('Lancer le dé')} data-pvp="roll">
            {die ?? (last ? <span className="opacity-40">{last}</span> : <Dice5 size={28} />)}
          </button>
          <div className="min-w-0 flex-1">
            <TurnBar mine={mine} name={other.name} left={left} text={err ?? (game.over ? tr('Partie finie') : mine ? (die === null ? tr('À toi : lance le dé.') : can.length > 1 ? tr('Choisis le pion à avancer.') : '…') : null)} />
          </div>
        </div>
      </div>
      <Quit onQuit={p.quit} top="top-[max(1rem,env(safe-area-inset-top))]" />
    </div>
  )
}

const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

/** Le godé, played by the server (sims/pvp.go): throw, call « mon grand » or « mon petit », the other throws. */
function GodePvp(p: RunProps) {
  const { m, seat, other } = p
  const g = m.gode!
  const { send, err, busy } = useMove(p)
  const left = useDeadline(m.deadline)
  const first = g.first === seat
  const mine = (first && (g.phase === 'roll1' || g.phase === 'call')) || (!first && g.phase === 'roll2')
  const die = (s: number) => (s >= 0 && g.dice[s] ? FACES[g.dice[s]] : '·')
  const last = g.lastTaken >= 0
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#5c3a1e,#160c05)] p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white" data-pvp="gode">
      <div className="mx-auto max-w-[420px] text-center">
        <div className="font-display text-2xl font-extrabold">{tr('GODÉ')}</div>
        <div className="text-sm font-bold opacity-80">
          {tx('Contre {name} · le premier à 3 manches{0}', { name: other.name, 0: m.stake > 0 ? tr(' · {0} Djai sur la table', { 0: (m.stake * 2).toLocaleString('fr-FR') }) : '' })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[seat, 1 - seat].map((s) => (
            <div key={s} className="rounded-2xl bg-white/10 p-3">
              <div className="text-[12px] font-extrabold opacity-80">{s === seat ? tr('Toi') : other.name}</div>
              <div className="font-display text-3xl font-extrabold">{g.points[s]}</div>
              <div className="mt-1 text-[56px] leading-none">{die(s)}</div>
            </div>
          ))}
        </div>
        {g.call && <div className="mt-3 font-display text-xl font-extrabold">{tx('« Mon {call} ! »', { call: g.call })}</div>}
        {last && (
          <p className="mt-2 text-[13px] font-bold text-white/75" data-pvp="last">
            {tx('Manche {round} : {0} contre {1}, « {lastCall} » : {2} {3}', { round: g.round, 0: FACES[g.lastDice[seat]], 1: FACES[g.lastDice[1 - seat]], lastCall: g.lastCall, 2: g.lastTaken === seat ? tr('pour toi !') : tr('pour {name}.', { name: other.name }), 3: g.rethrows > 0 ? tr(' (relancé {rethrows} fois)', { rethrows: g.rethrows }) : '' })}
          </p>
        )}
        <div className="mt-4 grid gap-2">
          {mine && g.phase !== 'call' && (
            <button className="btn !py-3" disabled={busy} onClick={() => send({ a: 'roll' }, 0)}>
              {tr('Lancer le dé')}
            </button>
          )}
          {mine && g.phase === 'call' && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn !py-3" disabled={busy} onClick={() => send({ a: 'call', c: 'grand' }, 0)}>
                {tr('Mon grand')}
              </button>
              <button className="btn btn-soft !py-3" disabled={busy} onClick={() => send({ a: 'call', c: 'petit' }, 0)}>
                {tr('Mon petit')}
              </button>
            </div>
          )}
        </div>
        <TurnBar mine={mine} name={other.name} left={left} text={err ?? (mine ? (g.phase === 'call' ? tr('Ton dé est tombé : annonce !') : first ? tr('À toi de lancer en premier.') : tr('À toi de lancer.')) : first ? null : g.phase === 'call' ? tr('{name} regarde son dé…', { name: other.name }) : null)} />
      </div>
      <Quit onQuit={p.quit} top="top-[max(1rem,env(safe-area-inset-top))]" />
    </div>
  )
}
