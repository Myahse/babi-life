import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Crown, Flag, Grid3x3, RotateCcw, X } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { haptic } from '../lib/native'
import type { DameGame, DameInvite, DamesMove } from '../lib/types'
import { fcfa } from '../game/rules'
import { IconTile } from './ui'
import { StakeSheet } from './Stake'
import { PVP_IN } from '../lib/live'
import { MoveClock } from './pvp/MoveClock'
import { t as tr } from '../lib/i18n'
import { tableSfx } from '../lib/tableSfx'
import { sfx } from '../lib/sfx'
import { reactToResult } from '../avatar/expressions'
import { tableMood, type TableMe } from './table/Faces'

const TableFaces = lazy(() => import('./table/Faces'))
/** The face across the board: the other side's, by its name. */
const themId = (g: DameGame) => `dames-${(g.you === 1 ? g.black : g.white).name}`

// Les dames at the grin (backend sims/dames.go plays the rules): the board,
// the player's own side at the bottom; a tap on a piece that can move shows
// where it can go, a tap there plays it. Every move is seen: the piece slides
// from square to square, hops over what it takes (taken, it goes), and a man
// reaching the far row is crowned. Against a man of the grin his reply comes
// back with the move: the move plays first, his reply a moment after. Against
// a friend, the board is asked again every few seconds while they think, and
// their move plays out once it comes. The stake picker, and the banner for a
// challenge to answer.

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

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

/** A move being played out: the board before it, the piece, its way and what it takes. */
type Moving = { board: number[]; move: DamesMove; p: number; done: () => void }

/** The piece on its way, over the board: square to square, a hop over each piece it takes. */
function Mover({ m, flip }: { m: Moving; flip: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const at = (i: number, scale = 1) => {
      const [r, c] = rc(i)
      const [vr, vc] = flip ? [9 - r, 9 - c] : [r, c]
      return `translate(${vc * 100}%, ${vr * 100}%) scale(${scale})`
    }
    const path = m.move.path
    const takes = !!m.move.taken?.length
    const frames: Keyframe[] = [{ transform: at(path[0]), offset: 0 }]
    for (let k = 1; k < path.length; k++) {
      // Up over the piece taken, halfway (the square between), and down past it.
      if (takes) {
        const [r0, c0] = rc(path[k - 1])
        const [r1, c1] = rc(path[k])
        const [mr, mc] = flip ? [9 - (r0 + r1) / 2, 9 - (c0 + c1) / 2] : [(r0 + r1) / 2, (c0 + c1) / 2]
        frames.push({ transform: `translate(${mc * 100}%, ${mr * 100}%) scale(1.35)`, offset: (k - 0.5) / (path.length - 1) })
      }
      frames.push({ transform: at(path[k]), offset: k / (path.length - 1) })
    }
    const a = ref.current!.animate(frames, { duration: (path.length - 1) * (takes ? 380 : 300), easing: 'ease-in-out', fill: 'forwards' })
    a.onfinish = m.done
    return () => a.cancel()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className="absolute top-0 left-0 z-10 grid h-[10%] w-[10%] place-items-center">
      <Piece p={m.p} glow={false} picked />
    </span>
  )
}

/** How much to put down: typed, or for nothing (no more than one has, nor than the other side allows). */
export function DamesStake({ against, max, money, onPick, onClose }: { against: string; max: number; money: number; onPick: (stake: number) => void; onClose: () => void }) {
  return <StakeSheet label={tr('Une partie de dames')} against={against} icon={Grid3x3} colors={['#c58b4e', '#7a4a22']} note={tr('Le gagnant prend les deux mises ; partie nulle, chacun reprend la sienne.')} max={max} money={money} onPick={onPick} onClose={onClose} />
}

/** A challenge to answer, or one's game going on: under the top bar, like an invitation. */
export function DamesBanner({ dame, onAccept, onDecline, onOpen }: { dame: DameInvite; onAccept: () => void; onDecline: () => void; onOpen: () => void }) {
  const asked = dame.status === 'invited' && !dame.mine
  return (
    <div className="card animate-pop pointer-events-auto w-full p-3">
      <div className="flex items-center gap-3">
        <IconTile icon={Grid3x3} colors={['#c58b4e', '#7a4a22']} size={42} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="label">{asked ? tr('{fromName} te défie aux dames', { fromName: dame.fromName }) : dame.status === 'invited' ? tr('Ton défi aux dames') : tr('Partie de dames en cours')}</div>
          <div className="font-display text-[15px] font-extrabold">{dame.stake > 0 ? tr('Mise : {0} chacun', { 0: fcfa(dame.stake) }) : tr('Pour le plaisir')}</div>
        </div>
        {!asked && (
          <button className="btn !bg-[#7a4a22] !py-2 !text-sm" onClick={onOpen}>
            {dame.status === 'invited' ? tr('Voir') : tr('Reprendre')}
          </button>
        )}
      </div>
      {asked && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button className="btn btn-soft !py-2 !text-sm" onClick={onDecline}>
            {tr('Pas maintenant')}
          </button>
          <button className="btn !bg-[#7a4a22] !py-2 !text-sm" onClick={onAccept}>
            <Grid3x3 size={16} /> {tr('On joue')}
          </button>
        </div>
      )}
    </div>
  )
}

/** The game: the board, whose turn it is, the result; to resign, to play again. */
export function DamesSheet({ simId, me: mySim, onClose, onAgain, onMoney }: { simId: string; /** The player's own Sim, at the table. */ me?: TableMe; onClose: () => void; /** Against a man of the grin: the same again (his name, the stake). */ onAgain?: (npc: string, stake: number) => void; /** The money moved (a game won or lost): the Sim to be fetched again. */ onMoney?: () => void }) {
  const [game, setGame] = useState<DameGame | null>(null)
  const [shown, setShown] = useState<number[] | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [moving, setMoving] = useState<Moving | null>(null)
  // A man just crowned: his crown comes on.
  const [crowned, setCrowned] = useState<number | null>(null)
  // The man of the grin looking at the board before his reply.
  const [thinking, setThinking] = useState(false)
  const done = useRef(false)
  /** A move played out on the board as it was; the board after it. */
  const playOut = async (board: number[], move: DamesMove) => {
    // The sounds of the move: lifted, a knock at each piece jumped, put down.
    const taken = move.taken?.length ?? 0
    tableSfx.lift()
    const knocks = (move.taken ?? []).map((_, k) => window.setTimeout(() => (tableSfx.take(), haptic('light')), (k + 0.55) * 380))
    await new Promise<void>((done) => setMoving({ board, move, p: board[move.path[0]], done }))
    knocks.forEach(clearTimeout)
    const after = played(board, move)
    haptic(taken ? 'medium' : 'light')
    const to = move.path[move.path.length - 1]
    tableSfx.clack(Math.abs(board[move.path[0]]) === 2)
    setShown(after)
    setMoving(null)
    // The faces across the board: the one who takes is glad, the one taken from is not.
    const by = Math.sign(board[move.path[0]])
    const g = gameRef.current
    if (g && taken) tableMood(themId(g), by === g.you ? (taken >= 2 ? 'surprised' : 'bad') : taken >= 2 ? 'great' : 'good')
    if (g && taken) tableMood('me', by === g.you ? (taken >= 2 ? 'great' : 'good') : taken >= 2 ? 'surprised' : 'bad')
    if (Math.abs(after[to]) === 2 && Math.abs(board[move.path[0]]) === 1) {
      setCrowned(to)
      sfx.coins(3)
      if (g) tableMood(themId(g), by === g.you ? 'bad' : 'great')
      if (g) tableMood('me', by === g.you ? 'great' : 'bad')
      await wait(650)
      setCrowned(null)
    }
    return after
  }
  const gameRef = useRef(game)
  gameRef.current = game
  const load = useCallback(async () => {
    const r = await api.dames(simId).catch(() => null)
    if (r) setGame(r.game)
  }, [simId])
  useEffect(() => {
    void load()
  }, [load])
  // A friend's turn, or a challenge not yet answered: asked again every few seconds; their move,
  // once it comes, played out from the board as it was.
  const waiting = !!game && ((game.status === 'playing' && game.turn !== game.you && !game.black.npc) || (game.status === 'invited' && game.you === 1))
  useEffect(() => {
    if (!waiting || busy) return
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      const r = await api.dames(simId).catch(() => null)
      const g = r?.game
      if (!g || !game) return
      if (g.last && g.board.join() !== game.board.join() && game.status === 'playing') {
        setBusy(true)
        await playOut(game.board, g.last)
        setShown(null)
        setBusy(false)
      }
      setGame(g)
    }
    const t = setInterval(tick, 2500)
    // Against a player on the spot: its move comes at once (the server says so, lib/live.ts).
    window.addEventListener(PVP_IN, tick)
    return () => (clearInterval(t), window.removeEventListener(PVP_IN, tick))
  }, [waiting, busy, game, simId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Over: the money has moved.
  useEffect(() => {
    if (game?.status === 'done' && !done.current) {
      done.current = true
      onMoney?.()
      // The end, on the faces and in the ears.
      const won = game.winner === game.you
      const draw = game.winner === 0
      tableMood(themId(game), draw ? 'calm' : won ? 'lost' : 'won', 8000)
      if (!draw) (won ? sfx.win(game.stake > 0) : sfx.lose(), reactToResult('me', won ? 'won' : 'lost'))
    }
  }, [game?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  // Their turn: they think (the face), and one's own turn comes with a soft call.
  const theirTurn = game?.status === 'playing' && game.turn !== game.you
  useEffect(() => {
    if (!game || game.status !== 'playing') return
    if (theirTurn) tableMood(themId(game), 'think', 30000)
    else tableMood(themId(game), 'calm', 1200)
  }, [theirTurn, game?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // While a move plays out: the board before it, the piece gone from where it set off.
  const board = moving ? moving.board.map((p, i) => (i === moving.move.path[0] ? 0 : p)) : (shown ?? game?.board ?? [])
  const flip = game?.you === -1
  const mine = game?.status === 'playing' && game.turn === game.you && !shown && !moving && !busy
  // One's turn comes back: a soft call.
  useEffect(() => {
    if (mine) tableSfx.turn()
  }, [mine])
  const legal = useMemo(() => (mine ? (game?.legal ?? []) : []), [mine, game])
  const movable = useMemo(() => new Set(legal.map((m) => m.path[0])), [legal])
  const targets = useMemo(() => new Map(legal.filter((m) => m.path[0] === pick).map((m) => [m.path[m.path.length - 1], m])), [legal, pick])
  const last = useMemo(() => new Set(game?.last && !shown ? [game.last.path[0], game.last.path[game.last.path.length - 1]] : []), [game, shown])

  const tap = (i: number) => {
    if (!game || busy) return
    // (The click that ends a drag: the drop has played it.)
    if (dragged.current) return void (dragged.current = false)
    if (movable.has(i)) {
      if (i !== pick) tableSfx.lift()
      return setPick(i === pick ? null : i)
    }
    const m = targets.get(i)
    if (!m) return setPick(null)
    void play(m)
  }
  // A piece dragged with the finger (or the mouse): it follows, lifted; dropped on a square it can go to,
  // it's played; anywhere else it goes back. A tap on the piece then on the square does the same.
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const squareAt = (cx: number, cy: number) => {
    const b = gridRef.current?.getBoundingClientRect()
    if (!b) return null
    let c = Math.floor(((cx - b.left) / b.width) * 10)
    let r = Math.floor(((cy - b.top) / b.height) * 10)
    if (c < 0 || c > 9 || r < 0 || r > 9) return null
    if (flip) [r, c] = [9 - r, 9 - c]
    return (r + c) % 2 === 1 ? r * 5 + Math.floor(c / 2) : null
  }
  const dragTo = (i: number | null) => (drag && i !== null ? legal.find((m) => m.path[0] === drag.from && m.path[m.path.length - 1] === i) : undefined)
  const onDown = (e: React.PointerEvent) => {
    const i = squareAt(e.clientX, e.clientY)
    if (i === null || !movable.has(i) || busy) return
    const b = gridRef.current!.getBoundingClientRect()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setDrag({ from: i, x: e.clientX - b.left, y: e.clientY - b.top, sx: e.clientX, sy: e.clientY, moved: false })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const b = gridRef.current!.getBoundingClientRect()
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 7
    if (moved && !drag.moved) (setPick(drag.from), tableSfx.lift())
    setDrag({ ...drag, x: e.clientX - b.left, y: e.clientY - b.top, moved })
  }
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (!d.moved) return
    dragged.current = true
    // (No click comes after a drag ended off a square: not held for the next tap.)
    setTimeout(() => (dragged.current = false), 0)
    const m = dragTo(squareAt(e.clientX, e.clientY))
    if (m) void play(m)
    else tableSfx.clack()
  }
  const play = async (m: DamesMove) => {
    if (!game || busy) return
    setBusy(true)
    setPick(null)
    setError(null)
    // The move played out while the server answers; the reply (a man of the grin's) after it.
    const answer = api.damesAct(simId, game.id, 'move', m.path).catch((e: unknown) => (setError(errorText(e, tr('Erreur'))), null))
    const after = await playOut(game.board, m)
    const r = await answer
    if (r?.game.last && r.game.board.join() !== after.join()) {
      // The man of the grin looks at the board a moment, longer when there's something to think about.
      tableMood(themId(game), 'think', 3000)
      setThinking(true)
      await wait(700 + Math.random() * 500 + (r.game.last.taken?.length ? 250 : 0))
      setThinking(false)
      await playOut(after, r.game.last)
    }
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
        <div className="card p-4 font-display font-extrabold">{tr('Le damier arrive…')}</div>
      </div>
    )
  }
  /** A piece taken by the move playing out: when it goes (ms), as the piece jumps it. */
  const takenAt = (i: number) => {
    const k = moving?.move.taken?.indexOf(i) ?? -1
    return k >= 0 ? (k + 0.55) * 380 : undefined
  }
  const me = game.you === 1 ? game.white : game.black
  const them = game.you === 1 ? game.black : game.white
  const count = (side: number) => board.filter((p) => Math.sign(p) === side).length
  const status =
    game.status === 'done' || game.status === 'declined' || game.status === 'expired'
      ? (game.text ?? tr('Partie finie.'))
      : game.status === 'invited'
        ? game.you === 1
          ? tr('En attente de la réponse de {name}…', { name: them.name })
          : tr('{name} te défie.', { name: them.name })
        : mine
          ? legal.some((m) => m.taken?.length)
            ? tr('À toi : la prise est obligatoire !')
            : tr('À toi de jouer.')
          : tr('{name} réfléchit…', { name: them.name })
  const won = game.status === 'done' && game.winner === game.you
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/35 lg:items-center lg:justify-center">
      <div className="sheet animate-up w-full rounded-t-[28px] p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[460px] lg:rounded-[28px]">
        <div className="flex items-center gap-2 px-1">
          <Who name={them.name} white={game.you === -1} left={count(-game.you)} playing={game.status === 'playing' && (theirTurn || thinking)} />
          <div className="flex-1 text-center">
            <div className="label">{game.stake > 0 ? tr('Mise {0}', { 0: fcfa(game.stake) }) : tr('Pour le plaisir')}</div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={18} />
          </button>
        </div>
        {/* The one across the board, living the game */}
        <Suspense fallback={<div className="h-[70px]" />}>
          <TableFaces people={[{ id: themId(game), name: them.name }]} me={mySim} myTurn={!theirTurn && game.status === 'playing'} playing={theirTurn && game.status === 'playing' ? themId(game) : null} height={70} className="-mb-1" />
        </Suspense>
        {/* The board: dark squares wood, the player's side at the bottom */}
        <div className="mx-auto aspect-square w-full max-w-[420px] rounded-xl bg-[#5a3418] p-1.5 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.7)]">
          <div ref={gridRef} className="relative grid h-full w-full touch-none grid-cols-10 grid-rows-10 overflow-hidden rounded-md select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
            {Array.from({ length: 100 }, (_, k) => {
              const [vr, vc] = [Math.floor(k / 10), k % 10]
              const [r, c] = flip ? [9 - vr, 9 - vc] : [vr, vc]
              const dark = (r + c) % 2 === 1
              if (!dark) return <div key={k} className="bg-[#efd9ae]" />
              const i = r * 5 + Math.floor(c / 2)
              const p = board[i] ?? 0
              const target = targets.has(i)
              return (
                <button key={k} className={`relative grid place-items-center ${last.has(i) ? 'bg-[#9c6a2c]' : 'bg-[#7a4a22]'} ${drag?.moved && target && dragTo(i) ? 'brightness-125' : ''}`} onClick={() => tap(i)} aria-label={`case ${i + 1}`}>
                  {p !== 0 && !(drag?.moved && drag.from === i) && <Piece p={p} glow={movable.has(i)} picked={pick === i} taken={takenAt(i)} crowned={crowned === i} />}
                  {target && <span className="absolute h-[34%] w-[34%] rounded-full bg-[#ffd166] ring-2 ring-white/70" />}
                </button>
              )
            })}
            {moving && <Mover key={moving.move.path.join('-')} m={moving} flip={flip} />}
            {/* The piece in the hand, under the finger, a little above it so it's seen */}
            {drag?.moved && (
              <span className="pointer-events-none absolute z-20 grid h-[10%] w-[10%] place-items-center" style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -75%) scale(1.25)', filter: 'drop-shadow(0 8px 6px rgba(0,0,0,0.45))' }}>
                <Piece p={board[drag.from]} glow={false} picked />
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <Who name={me.name} white={game.you === 1} left={count(game.you)} you playing={mine} />
          <div className={`flex-1 text-right text-sm font-extrabold ${won ? 'text-[#0f9d58]' : 'text-[var(--color-ink)]'}`}>{error ?? status}</div>
          {game.live && game.status === 'playing' && <MoveClock deadline={game.deadline} />}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {game.status === 'playing' &&
            (confirm ? (
              <>
                <button className="btn btn-soft !py-2 !text-sm" onClick={() => setConfirm(false)}>
                  {tr('Non, je joue')}
                </button>
                <button className="btn !bg-[#d81b3f] !py-2 !text-sm" onClick={() => void resign()}>
                  <Flag size={15} /> {tr("Oui, j'abandonne")}
                </button>
              </>
            ) : (
              <button className="btn btn-soft col-span-2 !py-2 !text-sm" onClick={() => setConfirm(true)}>
                <Flag size={15} /> {tr('Abandonner')}
              </button>
            ))}
          {game.status === 'invited' && game.you === 1 && (
            <button className="btn btn-soft col-span-2 !py-2 !text-sm" onClick={onClose}>
              {tr('Attendre sa réponse au grin')}
            </button>
          )}
          {(game.status === 'done' || game.status === 'declined' || game.status === 'expired') && (
            <>
              <button className="btn btn-soft !py-2 !text-sm" onClick={onClose}>
                {tr('Se lever')}
              </button>
              <button className="btn !bg-[#7a4a22] !py-2 !text-sm" disabled={!game.black.npc || !onAgain} onClick={() => onAgain?.(game.black.name, game.stake)}>
                <RotateCcw size={15} /> {tr('Une autre')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** A piece: white or black, a crown on a dame; glowing if it can move, lifted if picked; going when taken (after `taken` ms); its crown coming on when just crowned. */
function Piece({ p, glow, picked, taken, crowned }: { p: number; glow: boolean; picked: boolean; taken?: number; crowned?: boolean }) {
  const white = p > 0
  return (
    <span
      className={`grid h-[78%] w-[78%] place-items-center rounded-full transition-transform ${picked ? '-translate-y-0.5 scale-110' : ''}`}
      style={{
        background: white ? 'radial-gradient(circle at 35% 30%, #fffdf6, #e8dcc2 60%, #c9b48c)' : 'radial-gradient(circle at 35% 30%, #4a3a32, #241a15 60%, #0e0a08)',
        boxShadow: `${glow || picked ? '0 0 0 2px #ffd166,' : ''}${crowned ? '0 0 0 4px #ffc233, 0 0 14px 4px rgba(255,194,51,0.8),' : ''} inset 0 0 0 3px rgba(0,0,0,0.08), inset 0 -2px 0 rgba(0,0,0,0.25), 0 3px 0 ${white ? '#9c8a62' : '#050302'}, 0 5px 5px rgba(0,0,0,0.45)`,
        animation: taken !== undefined ? `piece-out 260ms ease-in ${taken}ms forwards` : undefined,
      }}
    >
      {Math.abs(p) === 2 && (
        <span className="grid place-items-center" style={crowned ? { animation: 'crown-in 520ms cubic-bezier(.2,1.4,.4,1) both' } : undefined}>
          <Crown size={14} strokeWidth={2.6} color={white ? '#b07a1a' : '#ffd166'} />
        </span>
      )}
    </span>
  )
}

/** A player's name, their colour, the pieces they have left. */
function Who({ name, white, left, you, playing }: { name: string; white: boolean; left: number; you?: boolean; /** Their turn: their colour lit. */ playing?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className={`h-4 w-4 shrink-0 rounded-full transition-shadow ${playing ? 'animate-pulse ring-[3px] ring-[#ffc233]' : 'ring-1 ring-black/30'}`} style={{ background: white ? '#f4ecd8' : '#241a15' }} />
      <span className="truncate font-display text-[14px] font-extrabold">{you ? `${name} (toi)` : name}</span>
      <span className="text-xs font-extrabold text-[var(--color-ink-soft)]">· {left}</span>
    </div>
  )
}
