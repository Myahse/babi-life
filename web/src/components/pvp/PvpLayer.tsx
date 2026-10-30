import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Hourglass, Trophy, X } from 'lucide-react'
import { api, errorText, type PvpGameId, type PvpNow } from '../../lib/api'
import { PVP_IN } from '../../lib/live'
import type { Sim } from '../../lib/types'
import { IconTile, Row } from '../ui'
import { PVP_GAMES, PVP_OPEN, PVP_ORDER } from './games'
import { PvpSheet } from './PvpSheet'
import { t as tr, tx, locale } from '../../lib/i18n'

// « Jouer contre un joueur » (update « jeux-en-ligne », backend sims/pvp.go),
// over the whole game: the sheet that finds the opponent (a friend, a player
// online in the city, the queue), the challenge that comes (Accepter /
// Refuser, like the street fight's, components/Duel.tsx), the one sent, the
// wait in the queue (nobody: the computer, said so), then the game itself,
// each on its own phone (components/pvp/play/*), and how it ended.

const Play = lazy(() => import('./play'))

/** In the queue this long with nobody: the computer instead. */
export const QUEUE_WAIT = 40_000

export function PvpLayer({ sim, token, on, stage, onBoard, onAI }: { sim: Sim; token: string | null; on: boolean; /** The Sim's stage of life (the stakes: 18 and over). */ stage?: string; /** Dames or 8 américain on: their board opens (the server's game, sims/dames.go, huit.go). */ onBoard: (game: 'dames' | 'huit') => void; /** Nobody came in the queue: the game against the computer. */ onAI: (game: PvpGameId) => void }) {
  const [now, setNow] = useState<PvpNow | null>(null)
  const [sheet, setSheet] = useState<{ game?: PvpGameId; to?: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // The matches whose end was seen (closed), and the boards already opened.
  const closed = useRef(new Set<string>())
  const boarded = useRef(new Set<string>())
  const last = useRef<PvpNow | null>(null)
  const refresh = useCallback(() => {
    api
      .pvp(sim.id)
      .then((r) => {
        const was = last.current?.match
        // Our challenge gone without a game: the other said no, or let it be.
        if (was && was.state === 'pending' && was.from === sim.id && (!r.match || r.match.id !== was.id)) setNote(tr("{0} n'a pas répondu au défi.", { 0: was.names[1] }))
        if (was && r.match?.id === was.id && r.match.state === 'off' && was.state !== 'off') setNote(r.match.from === sim.id ? tr("{0} ne veut pas jouer pour l'instant.", { 0: was.names[1] }) : tr('La partie n’a pas pu commencer.'))
        last.current = r
        setNow(r)
      })
      .catch(() => undefined)
  }, [sim.id])
  useEffect(() => {
    if (!on) return
    refresh()
    const again = () => refresh()
    const open = (e: Event) => setSheet((e as CustomEvent<{ game?: PvpGameId; to?: string }>).detail)
    window.addEventListener(PVP_IN, again)
    window.addEventListener(PVP_OPEN, open)
    return () => (window.removeEventListener(PVP_IN, again), window.removeEventListener(PVP_OPEN, open))
  }, [on, refresh])
  // Without the live line (a lost connection), every few seconds while something's going on.
  const busy = !!now?.waiting || now?.match?.state === 'pending' || now?.match?.state === 'on'
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), busy ? 3000 : 20000)
    return () => clearInterval(t)
  }, [on, busy, refresh])
  useEffect(() => {
    if (!note) return
    const k = setTimeout(() => setNote(null), 4500)
    return () => clearTimeout(k)
  }, [note])
  // In the queue too long: out of it, the computer instead.
  const waiting = now?.waiting
  useEffect(() => {
    if (!waiting) return
    const left = QUEUE_WAIT - (now.now - waiting.since)
    const k = setTimeout(() => {
      void api.pvpUnqueue(sim.id).finally(refresh)
      setNote(tr('Personne pour l’instant : tu joues contre l’ordinateur. Réessaie « Trouver un adversaire » tout à l’heure !'))
      onAI(waiting.game)
    }, Math.max(0, left))
    return () => clearTimeout(k)
  }, [waiting?.game, waiting?.since]) // eslint-disable-line react-hooks/exhaustive-deps
  // Dames, 8 américain: their board, once.
  const m = now?.match
  useEffect(() => {
    if (m?.state === 'on' && m.ref && (m.game === 'dames' || m.game === 'huit') && !boarded.current.has(m.id)) {
      boarded.current.add(m.id)
      setSheet(null)
      onBoard(m.game)
    }
  }, [m?.id, m?.state, m?.ref]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return null
  const mine = m?.from === sim.id
  const other = m ? m.names[m.players[0] === sim.id ? 1 : 0] : ''
  const look = m ? PVP_GAMES[m.game] : null
  const playing = !!m && !!token && (m.state === 'on' || (m.state === 'done' && !closed.current.has(m.id))) && m.game !== 'dames' && m.game !== 'huit'
  const fail = (e: unknown) => setNote(errorText(e, tr('Pas possible')))
  return (
    <>
      {note && <div className="card animate-pop pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[96] mx-auto max-w-[420px] p-3 text-center text-sm font-extrabold">{note}</div>}
      {sheet && !sheet.game && <Pick onPick={(game) => setSheet({ ...sheet, game })} onClose={() => setSheet(null)} />}
      {sheet?.game && (
        <PvpSheet
          sim={sim}
          game={sheet.game}
          to={sheet.to}
          adult={stage === 'adulte'}
          onClose={() => setSheet(null)}
          onChallenge={(to, stake) =>
            api
              .pvpChallenge(sim.id, sheet.game!, to, stake)
              .then(() => (setSheet(null), refresh()))
              .catch(fail)
          }
          onQueue={() =>
            api
              .pvpQueue(sim.id, sheet.game!)
              .then((r) => (setSheet(null), (last.current = r), setNow(r)))
              .catch(fail)
          }
        />
      )}
      {m?.state === 'pending' && !mine && look && (
        <div className="card animate-pop fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[95] mx-auto max-w-[420px] p-3" data-pvp="incoming">
          <div className="flex items-center gap-3">
            <IconTile icon={look.icon} colors={look.colors} size={42} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="label">{other} {tr('te défie')}</div>
              <div className="font-display text-[15px] font-extrabold">{look.title}{tr(', toi contre moi !')}</div>
              {m.stake > 0 && <div className="text-[12px] font-extrabold text-[#a06a00]">{tx('Mise : {0} Djai chacun', { 0: m.stake.toLocaleString(locale()) })}</div>}
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button className="btn btn-soft !py-2 !text-sm" onClick={() => void api.pvpAnswer(sim.id, m.id, false).catch(fail).finally(refresh)}>
              {tr('Refuser')}
            </button>
            <button className="btn !py-2 !text-sm" style={{ background: look.colors[1] }} onClick={() => void api.pvpAnswer(sim.id, m.id, true).then((r) => (last.current = r, setNow(r))).catch((e) => (fail(e), refresh()))}>
              {tr('Accepter')}
            </button>
          </div>
        </div>
      )}
      {m?.state === 'pending' && mine && look && (
        <div className="card pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[95] mx-auto flex max-w-[420px] items-center gap-3 p-3" data-pvp="sent">
          <IconTile icon={look.icon} colors={look.colors} size={36} />
          <div className="text-sm font-extrabold">
            {tx('Défi envoyé à {other} : {title}…', { other, title: look.title })} <span className="text-[var(--color-ink-soft)]">{tr('en attente de sa réponse')}</span>
          </div>
        </div>
      )}
      {waiting && !m?.state?.match(/pending|on/) && (
        <Searching game={waiting.game} since={waiting.since} at={now.now} onCancel={() => void api.pvpUnqueue(sim.id).finally(refresh)} />
      )}
      {playing && m && token && (
        <Suspense fallback={<div className="fixed inset-0 z-[90] grid place-items-center bg-[#0f1230] font-display text-xl font-extrabold text-white">{look?.title}…</div>}>
          <Play
            key={m.id}
            sim={sim}
            token={token}
            now={now!}
            onNow={(r) => ((last.current = r), setNow(r))}
            onClose={() => {
              closed.current.add(m.id)
              setNow((n) => (n ? { ...n } : n))
              refresh()
            }}
          />
        </Suspense>
      )}
    </>
  )
}

/** A player picked first (the players' list): which game. */
function Pick({ onPick, onClose }: { onPick: (g: PvpGameId) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[94] flex flex-col justify-end bg-[#0f1230]/55" onClick={onClose}>
      <div className="sheet animate-up mx-auto max-h-[80%] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-display text-[19px] font-extrabold">{tr('À quoi on joue ?')}</div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={20} />
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {PVP_ORDER.map((g) => {
            const d = PVP_GAMES[g]
            return <Row key={g} icon={d.icon} colors={d.colors} title={d.title} sub={d.mode === 'direct' ? tr('En direct') : tr('Coup par coup')} onClick={() => onPick(g)} />
          })}
        </ul>
      </div>
    </div>
  )
}

/** In the queue: the time waited, the way out. */
function Searching({ game, since, at, onCancel }: { game: PvpGameId; since: number; at: number; onCancel: () => void }) {
  const look = PVP_GAMES[game]
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    const k = setInterval(() => setT(Date.now()), 500)
    return () => clearInterval(k)
  }, [])
  // The server's clock at the answer, this phone's since: near enough for a count.
  const [mark] = useState(() => Date.now() - (at - since))
  const s = Math.max(0, Math.floor((t - mark) / 1000))
  return (
    <div className="card animate-pop fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[95] mx-auto flex max-w-[420px] items-center gap-3 p-3" data-pvp="searching">
      <IconTile icon={look.icon} colors={look.colors} size={36} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="label flex items-center gap-1">
          <Hourglass size={12} /> {tr('Trouver un adversaire')}
        </div>
        <div className="text-sm font-extrabold">
          {tx('{title} : on cherche un joueur… {s} s', { title: look.title, s })}
        </div>
        <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{tx('Personne au bout de {0} s : tu joues contre l’ordinateur.', { 0: QUEUE_WAIT / 1000 })}</div>
      </div>
      <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={onCancel} aria-label={tr('Arrêter de chercher')}>
        <X size={16} />
      </button>
    </div>
  )
}

/** The end of a game against a player: won, lost, a draw; what the server says (the stake, the forfeit). */
export function PvpOver({ won, draw, text, onClose }: { won: boolean; draw?: boolean; text?: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[#0f1230]/70 p-5" data-pvp="over">
      <div className="card animate-pop w-full max-w-[340px] p-5 text-center">
        <Trophy size={34} className={`mx-auto ${won ? 'text-[#ffc233]' : 'text-[var(--color-ink-soft)]'}`} />
        <div className="mt-1 font-display text-[28px] leading-tight font-extrabold">{draw ? tr('Match nul') : won ? tr('Victoire !') : tr('Défaite')}</div>
        {text && <p className="mt-2 text-[14px] leading-snug font-bold text-[var(--color-ink-soft)]">{text}</p>}
        <button className="btn mt-4 w-full" onClick={onClose}>
          {tr('Retour au jeu')}
        </button>
      </div>
    </div>
  )
}
