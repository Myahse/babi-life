import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Flag, Grid3x3, RotateCcw, X } from 'lucide-react'
import { api } from '../lib/api'
import type { DameGame, DameInvite, DamesMove } from '../lib/types'
import { fcfa } from '../game/rules'
import { IconTile } from './ui'

// Les dames at the grin (backend sims/dames.go plays the rules): the board,
// the player's own side at the bottom; a tap on a piece that can move shows
// where it can go, a tap there plays it. Against a man of the grin his reply
// comes back with the move: the move shows first, his reply a moment after.
// Against a friend, the board is asked again every few seconds while they
// think. The stake picker, and the banner for a challenge to answer.

/** A square's row (0 at the top, black's side) and column, as on the server (game/dames.go). */
const rc = (i: number): [number, number] => {
  const r = Math.floor(i / 5)
  return [r, 2 * (i % 5) + 1 - (r % 2)]
}

/** The board after a move, worked out here to show it before the server's answer (the man of the grin's reply in it). */
function played(board: number[], m: DamesMove): number[] {
  const b = [...board]
  let p = b[m.path[0]]
  b[m.path[0]] = 0
  for (const t of m.taken ?? []) b[t] = 0
  const to = m.path[m.path.length - 1]
  const [r] = rc(to)
  if (p === 1 && r === 0) p = 2
  if (p === -1 && r === 9) p = -2
  b[to] = p
  return b
}

const STAKES = [0, 500, 1000, 2000, 5000]

/** How much to put down: for nothing, or a stake (no more than one has, nor than the other side allows). */
export function DamesStake({ against, max, money, onPick, onClose }: { against: string; max: number; money: number; onPick: (stake: number) => void; onClose: () => void }) {
  const list = (max > 5000 ? [...STAKES, 10000, 20000] : STAKES).filter((s) => s <= max)
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/25 lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <IconTile icon={Grid3x3} colors={['#c58b4e', '#7a4a22']} size={44} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="label">Une partie de dames</div>
            <div className="font-display text-[17px] font-extrabold">avec {against}</div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-[var(--color-ink-soft)]">On joue pour combien ? Le gagnant prend les deux mises ; partie nulle, chacun reprend la sienne.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {list.map((s) => (
            <button key={s} className="btn btn-soft !py-2.5 !text-sm" disabled={s > money} onClick={() => onPick(s)}>
              {s === 0 ? 'Pour le plaisir' : fcfa(s)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A challenge to answer, or one's game going on: under the top bar, like an invitation. */
export function DamesBanner({ dame, onAccept, onDecline, onOpen }: { dame: DameInvite; onAccept: () => void; onDecline: () => void; onOpen: () => void }) {
  const asked = dame.status === 'invited' && !dame.mine
  return (
    <div className="card animate-pop pointer-events-auto w-full p-3">
      <div className="flex items-center gap-3">
        <IconTile icon={Grid3x3} colors={['#c58b4e', '#7a4a22']} size={42} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="label">{asked ? `${dame.fromName} te défie aux dames` : dame.status === 'invited' ? 'Ton défi aux dames' : 'Partie de dames en cours'}</div>
          <div className="font-display text-[15px] font-extrabold">{dame.stake > 0 ? `Mise : ${fcfa(dame.stake)} chacun` : 'Pour le plaisir'}</div>
        </div>
        {!asked && (
          <button className="btn !bg-[#7a4a22] !py-2 !text-sm" onClick={onOpen}>
            {dame.status === 'invited' ? 'Voir' : 'Reprendre'}
          </button>
        )}
      </div>
      {asked && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button className="btn btn-soft !py-2 !text-sm" onClick={onDecline}>
            Pas maintenant
          </button>
          <button className="btn !bg-[#7a4a22] !py-2 !text-sm" onClick={onAccept}>
            <Grid3x3 size={16} /> On joue
          </button>
        </div>
      )}
    </div>
  )
}

/** The game: the board, whose turn it is, the result; to resign, to play again. */
export function DamesSheet({ simId, onClose, onAgain, onMoney }: { simId: string; onClose: () => void; /** Against a man of the grin: the same again (his name, the stake). */ onAgain?: (npc: string, stake: number) => void; /** The money moved (a game won or lost): the Sim to be fetched again. */ onMoney?: () => void }) {
  const [game, setGame] = useState<DameGame | null>(null)
  const [shown, setShown] = useState<number[] | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const done = useRef(false)
  const load = useCallback(async () => {
    const r = await api.dames(simId).catch(() => null)
    if (r) setGame(r.game)
  }, [simId])
  useEffect(() => {
    void load()
  }, [load])
  // A friend's turn, or a challenge not yet answered: asked again every few seconds.
  const waiting = !!game && ((game.status === 'playing' && game.turn !== game.you && !game.black.npc) || (game.status === 'invited' && game.you === 1))
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 2500)
    return () => clearInterval(t)
  }, [waiting, load])
  // Over: the money has moved.
  useEffect(() => {
    if (game?.status === 'done' && !done.current) {
      done.current = true
      onMoney?.()
    }
  }, [game?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const board = shown ?? game?.board ?? []
  const flip = game?.you === -1
  const mine = game?.status === 'playing' && game.turn === game.you && !shown
  const legal = useMemo(() => (mine ? (game?.legal ?? []) : []), [mine, game])
  const movable = useMemo(() => new Set(legal.map((m) => m.path[0])), [legal])
  const targets = useMemo(() => new Map(legal.filter((m) => m.path[0] === pick).map((m) => [m.path[m.path.length - 1], m])), [legal, pick])
  const last = useMemo(() => new Set(game?.last && !shown ? [game.last.path[0], game.last.path[game.last.path.length - 1]] : []), [game, shown])

  const tap = async (i: number) => {
    if (!game || busy) return
    if (movable.has(i)) return setPick(i === pick ? null : i)
    const m = targets.get(i)
    if (!m) return setPick(null)
    setBusy(true)
    setPick(null)
    setError(null)
    // The move at once; the reply (a man of the grin's) a moment after.
    setShown(played(game.board, m))
    const r = await api.damesAct(simId, game.id, 'move', m.path).catch((e: unknown) => (setError(e instanceof Error ? e.message : 'Erreur'), null))
    if (r && game.black.npc && r.game.status !== 'done') await new Promise((ok) => setTimeout(ok, 650))
    setShown(null)
    if (r) setGame(r.game)
    setBusy(false)
  }
  const resign = async () => {
    if (!game) return
    setConfirm(false)
    const r = await api.damesAct(simId, game.id, 'resign').catch(() => null)
    if (r) setGame(r.game)
  }

  if (!game) {
    return (
      <div className="absolute inset-0 z-40 grid place-items-center bg-[#0f1230]/40" onClick={onClose}>
        <div className="card p-4 font-display font-extrabold">Le damier arrive…</div>
      </div>
    )
  }
  const me = game.you === 1 ? game.white : game.black
  const them = game.you === 1 ? game.black : game.white
  const count = (side: number) => board.filter((p) => Math.sign(p) === side).length
  const status =
    game.status === 'done' || game.status === 'declined' || game.status === 'expired'
      ? (game.text ?? 'Partie finie.')
      : game.status === 'invited'
        ? game.you === 1
          ? `En attente de la réponse de ${them.name}…`
          : `${them.name} te défie.`
        : mine
          ? legal.some((m) => m.taken?.length)
            ? 'À toi : la prise est obligatoire !'
            : 'À toi de jouer.'
          : `${them.name} réfléchit…`
  const won = game.status === 'done' && game.winner === game.you
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/35 lg:items-center lg:justify-center">
      <div className="sheet animate-up w-full rounded-t-[28px] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:w-[460px] lg:rounded-[28px]">
        <div className="flex items-center gap-2 px-1">
          <Who name={them.name} white={game.you === -1} left={count(-game.you)} />
          <div className="flex-1 text-center">
            <div className="label">{game.stake > 0 ? `Mise ${fcfa(game.stake)}` : 'Pour le plaisir'}</div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {/* The board: dark squares wood, the player's side at the bottom */}
        <div className="mx-auto mt-2 aspect-square w-full max-w-[420px] rounded-xl bg-[#5a3418] p-1.5 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.7)]">
          <div className="grid h-full w-full grid-cols-10 grid-rows-10 overflow-hidden rounded-md">
            {Array.from({ length: 100 }, (_, k) => {
              const [vr, vc] = [Math.floor(k / 10), k % 10]
              const [r, c] = flip ? [9 - vr, 9 - vc] : [vr, vc]
              const dark = (r + c) % 2 === 1
              if (!dark) return <div key={k} className="bg-[#efd9ae]" />
              const i = r * 5 + Math.floor(c / 2)
              const p = board[i] ?? 0
              const target = targets.has(i)
              return (
                <button key={k} className={`relative grid place-items-center ${last.has(i) ? 'bg-[#9c6a2c]' : 'bg-[#7a4a22]'}`} onClick={() => void tap(i)} aria-label={`case ${i + 1}`}>
                  {p !== 0 && <Piece p={p} glow={movable.has(i)} picked={pick === i} />}
                  {target && <span className="absolute h-[34%] w-[34%] rounded-full bg-[#ffd166] ring-2 ring-white/70" />}
                </button>
              )
            })}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <Who name={me.name} white={game.you === 1} left={count(game.you)} you />
          <div className={`flex-1 text-right text-sm font-extrabold ${won ? 'text-[#0f9d58]' : 'text-[var(--color-ink)]'}`}>{error ?? status}</div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {game.status === 'playing' &&
            (confirm ? (
              <>
                <button className="btn btn-soft !py-2 !text-sm" onClick={() => setConfirm(false)}>
                  Non, je joue
                </button>
                <button className="btn !bg-[#d81b3f] !py-2 !text-sm" onClick={() => void resign()}>
                  <Flag size={15} /> Oui, j'abandonne
                </button>
              </>
            ) : (
              <button className="btn btn-soft col-span-2 !py-2 !text-sm" onClick={() => setConfirm(true)}>
                <Flag size={15} /> Abandonner
              </button>
            ))}
          {game.status === 'invited' && game.you === 1 && (
            <button className="btn btn-soft col-span-2 !py-2 !text-sm" onClick={onClose}>
              Attendre sa réponse au grin
            </button>
          )}
          {(game.status === 'done' || game.status === 'declined' || game.status === 'expired') && (
            <>
              <button className="btn btn-soft !py-2 !text-sm" onClick={onClose}>
                Se lever
              </button>
              <button className="btn !bg-[#7a4a22] !py-2 !text-sm" disabled={!game.black.npc || !onAgain} onClick={() => onAgain?.(game.black.name, game.stake)}>
                <RotateCcw size={15} /> Une autre
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** A piece: white or black, a crown on a dame; glowing if it can move, lifted if picked. */
function Piece({ p, glow, picked }: { p: number; glow: boolean; picked: boolean }) {
  const white = p > 0
  return (
    <span
      className={`grid h-[78%] w-[78%] place-items-center rounded-full transition-transform ${picked ? '-translate-y-0.5 scale-110' : ''}`}
      style={{
        background: white ? 'radial-gradient(circle at 35% 30%, #fffdf6, #e8dcc2 60%, #c9b48c)' : 'radial-gradient(circle at 35% 30%, #4a3a32, #241a15 60%, #0e0a08)',
        boxShadow: `${glow || picked ? '0 0 0 2px #ffd166,' : ''} inset 0 -2px 0 rgba(0,0,0,0.25), 0 2px 3px rgba(0,0,0,0.45)`,
      }}
    >
      {Math.abs(p) === 2 && <Crown size={14} strokeWidth={2.6} color={white ? '#b07a1a' : '#ffd166'} />}
    </span>
  )
}

/** A player's name, their colour, the pieces they have left. */
function Who({ name, white, left, you }: { name: string; white: boolean; left: number; you?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/30" style={{ background: white ? '#f4ecd8' : '#241a15' }} />
      <span className="truncate font-display text-[14px] font-extrabold">{you ? `${name} (toi)` : name}</span>
      <span className="text-xs font-extrabold text-[var(--color-ink-soft)]">· {left}</span>
    </div>
  )
}
