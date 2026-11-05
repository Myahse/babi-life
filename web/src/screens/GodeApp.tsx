import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { api, ApiError, errorText } from '../lib/api'
import { haptic } from '../lib/native'
import { sfx } from '../lib/sfx'
import { useSession } from '../store/session'
import type { GodeRound, Sim } from '../lib/types'
import type { Act } from './phoneApps'
import { StakeField } from '../components/StakeField'
import { RulesFold } from '../components/RulesFold'
import { PvpButton } from '../components/pvp/PvpButton'
import { t as tr, locale } from '../lib/i18n'
import { reactToResult } from '../avatar/expressions'
import { tableMood } from '../components/table/Faces'
import { GODE_SHAKE, GodeTable } from '../components/table/Godet'
import { Die as Cube } from '../components/table/Die'
import { tableSfx } from '../lib/tableSfx'

const TableFaces = lazy(() => import('../components/table/Faces'))
/** The face of the one across the godé table. */
const GODE_FACE = 'gode-them'

/**
 * Le godé (backend game/gode.go, sims/gode.go), the maquis' dice: each throws
 * one die under the godet; the first to throw looks and calls « mon grand »
 * or « mon petit » for both, then the other throws: with « grand » the bigger
 * die wins, with « petit » the smaller. The same die: both throw again. The
 * first throw goes to each in turn. The godet shakes, lifts, the die is
 * there; the dice are drawn by the server. The game's money only, 18+.
 * The table and the godets in the game's 3D blocks (components/table/Godet.tsx); one's own godet tapped
 * is the throw; one's own Sim sits at the table beside the other (components/table/Faces.tsx).
 */

const nf = (n: number) => n.toLocaleString(locale())
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : errorText(e, tr('Erreur')))
const STAKES = [0, 100, 500, 2000]
const MAX = 2000
/** How long the godet shakes before it lifts, and the beat between two throws again. */
const SHAKE = GODE_SHAKE
const AGAIN = 1100

type Props = { sim: Sim; act: Act; onConfirmAdult: () => Promise<void> }

export function GodeApp({ sim, act, onConfirmAdult }: Props) {
  const adult = useSession((s) => !!s.user?.adult)
  const [round, setRound] = useState<GodeRound | null>(null)
  // How many throws of each are shown yet (the rest still under the godet).
  const [shown, setShown] = useState({ me: 0, npc: 0 })
  const [shaking, setShaking] = useState<'me' | 'npc' | null>(null)
  const [stake, setStake] = useState(100)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const timers = useRef<number[]>([])
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms))

  useEffect(() => {
    void api
      .gode(sim.id)
      .then((r) => {
        setRound(r.round)
        setShown({ me: r.round?.me.length ?? 0, npc: r.round?.npc.length ?? 0 })
      })
      .catch(() => undefined)
  }, [sim.id])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const play = async (action: 'start' | 'throw' | 'call', call = '') => {
    setBusy(true)
    setError('')
    try {
      const res = await api.godePlay(sim.id, action, action === 'start' ? stake : 0, call)
      const r = res.outcome.data as GodeRound
      const was = action === 'start' ? { me: 0, npc: 0 } : shown
      setRound(r)
      setShown(was)
      // The throws new since, one after the other: the godet shakes, then lifts.
      const steps: ('me' | 'npc')[] = []
      for (let i = was.me, j = was.npc; i < r.me.length || j < r.npc.length; ) {
        // The other's first die (they throw first, or answer the call), then each pair again.
        if (j < r.npc.length && (r.first === 'them' ? j <= i : j < i)) steps.push('npc'), j++
        else if (i < r.me.length) steps.push('me'), i++
        else steps.push('npc'), j++
      }
      let t = 0
      const seen = { ...was }
      steps.forEach((who, k) => {
        const d = (who === 'me' ? r.me : r.npc)[seen[who]++]
        const tie = who === 'npc' ? seen.npc === seen.me && r.me[seen.me - 1] === d : seen.me === seen.npc && r.npc[seen.npc - 1] === d
        // The die rattling in the godet, the godet slammed down on the table, then lifted.
        later(t, () => (setShaking(who), tableSfx.rattle(SHAKE - 120), who === 'npc' && tableMood(GODE_FACE, 'think', SHAKE + 300)))
        later(t + SHAKE - 110, () => (tableSfx.clack(true), haptic('light')))
        later(t + SHAKE, () => {
          setShaking(null)
          setShown((s) => ({ ...s, [who]: s[who] + 1 }))
          tableSfx.lift()
          // The die seen: a tie surprises both; one's own die, easy to call (high or low) or not.
          if (tie) (tableMood('me', 'surprised', 1400), tableMood(GODE_FACE, 'surprised', 1400))
          else if (who === 'me' && !r.done) tableMood('me', d >= 5 || d <= 2 ? 'good' : 'think', 1800)
        })
        t += SHAKE + (k % 2 === 1 ? AGAIN : 150)
      })
      later(t, () => {
        setBusy(false)
        if (r.done) {
          haptic(r.won ? 'success' : 'light')
          if (r.won) sfx.win(false)
          else sfx.lose()
          reactToResult('me', r.won ? 'won' : 'lost')
          tableMood(GODE_FACE, r.won ? 'lost' : 'won', 5000)
        }
        // The money and the word once the dice are out.
        void act(tr('Godé'), 'dice-5', 'casino', async () => res)
      })
    } catch (e) {
      setError(errText(e))
      setBusy(false)
    }
  }

  const shell = '-mx-3 -mt-1 min-h-full p-3 pb-6 text-white'
  const bg = { background: 'radial-gradient(circle at 50% 0%, #8a5a2b, #4a2a12 55%, #22110a)' }
  if (!adult)
    return (
      <div className={shell} style={bg}>
        <Brand />
        <div className="mt-4 rounded-2xl bg-black/25 p-4 text-sm font-bold">
          <p>{tr("Le godé avec mise, c'est à partir de 18 ans. On y joue avec l'argent du jeu seulement.")}</p>
          <button className="btn mt-3 w-full !py-2" onClick={() => void onConfirmAdult()}>
            {tr('J’ai 18 ans ou plus')}
          </button>
        </div>
      </div>
    )

  const playing = round && !round.done
  const lastMe = round && shown.me ? round.me[shown.me - 1] : 0
  const lastNpc = round && shown.npc ? round.npc[shown.npc - 1] : 0
  const settled = round?.done && !busy
  // One's own throw to make: the godet can be tapped (or the button).
  const canThrow = !!playing && !busy && !round.me.length
  const callWord = round?.call === 'grand' ? tr('mon grand') : round?.call === 'petit' ? tr('mon petit') : ''
  // The same die out on both sides, the round going on: « on relance ».
  const same = busy && shown.me > 0 && shown.me === shown.npc && lastMe === lastNpc
  const word = (() => {
    if (!round) return tr('Pose ta mise, on lance.')
    if (same) return tr('Pareil ! On relance tous les deux.')
    if (settled) return round.won ? tr('Gagné ! Avec {callWord}, ton {lastMe} bat son {lastNpc}.', { callWord, lastMe, lastNpc }) : tr('{them} gagne : avec {callWord}, son {lastNpc} bat ton {lastMe}.', { them: round.them, callWord, lastNpc, lastMe })
    if (busy) return shaking === 'npc' ? tr('{them} secoue le godet…', { them: round.them }) : shaking === 'me' ? tr('Tu secoues le godet…') : '…'
    if (round.first === 'them' && shown.npc && !round.me.length) return tr('{them} a vu son dé et dit : « {callWord} ! » À toi de lancer.', { them: round.them, callWord })
    if (round.first === 'me' && !round.me.length) return tr('Tu lances le premier : secoue le godet.')
    if (round.first === 'me' && !round.call) return tr('Tu as fait {lastMe}. Alors : mon grand ou mon petit ?', { lastMe })
    return '…'
  })()

  return (
    <div className={shell} style={bg}>
      <Brand />
      <PvpButton game="gode" className="mt-3" />
      <div className="mt-3 rounded-[26px] border-4 border-[#3a1f0c] bg-[radial-gradient(circle_at_50%_35%,#c08a52,#7a4a22)] p-2 shadow-[inset_0_0_26px_rgba(0,0,0,0.45)]">
        <Suspense fallback={<div className="h-[64px]" />}>
          <TableFaces people={[{ id: GODE_FACE, name: round?.them ?? tr('Le gars du maquis') }]} me={{ name: sim.firstName, look: sim.look, gender: sim.gender }} myTurn={canThrow} playing={shaking === 'npc' ? GODE_FACE : null} height={64} className="-mt-1 -mb-1" />
        </Suspense>
        <div className="relative">
          <GodeTable
            them={{ value: lastNpc || null, shaking: shaking === 'npc', past: round?.npc.slice(0, Math.max(0, shown.npc - 1)), idle: !playing && !busy && !shown.npc }}
            me={{ value: lastMe || null, shaking: shaking === 'me', past: round?.me.slice(0, Math.max(0, shown.me - 1)), idle: !playing && !busy && !shown.me }}
            onTap={canThrow ? () => void play('throw') : undefined}
            height={220}
          />
          <SeatName name={round?.them ?? tr('Le gars du maquis')} first={round?.first === 'them'} className="top-1" />
          <SeatName name={tr('Toi')} first={round?.first === 'me'} className="bottom-1" />
          {canThrow && <div className="pointer-events-none absolute right-2 bottom-2 animate-pulse rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-extrabold">{tr('Touche ton godet')}</div>}
        </div>
        <div key={word} className="animate-pop mt-1 rounded-2xl bg-black/30 px-3 py-2 text-center text-[14px] font-extrabold" style={{ color: settled ? (round!.won ? '#7cfc9a' : '#ffb3b3') : '#fff' }}>
          « {word} »
          {settled && round!.stake > 0 && <span className="block font-sans text-[12px] text-white/80">{round!.won ? tr('+{0} Djai', { 0: nf(round!.paid ?? 0) }) : tr('−{0} Djai', { 0: nf(round!.stake) })}</span>}
        </div>
      </div>
      {error && <p className="motion-shake mt-2 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      <div className="mt-3">
        {!playing || busy ? (
          !busy && (
            <>
              <StakeField usual={STAKES} value={stake} onChange={setStake} money={sim.money} max={MAX} />
              <button className="btn mt-2 w-full" disabled={stake < 0 || stake > MAX || stake > sim.money} onClick={() => void play('start')}>
                {round ? tr('Nouvelle manche') : tr('Jouer')}
                {stake > 0 ? tr(' · {0} Djai', { 0: nf(stake) }) : tr(' pour le plaisir')}
              </button>
            </>
          )
        ) : !round.me.length ? (
          <button className="btn w-full" disabled={busy} onClick={() => void play('throw')}>
            {tr('Secouer et lancer')}
          </button>
        ) : (
          round.first === 'me' &&
          !round.call && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" disabled={busy} onClick={() => void play('call', 'grand')}>
                {tr('Mon grand')}
              </button>
              <button className="btn" disabled={busy} onClick={() => void play('call', 'petit')}>
                {tr('Mon petit')}
              </button>
            </div>
          )
        )}
      </div>
      <RulesFold>
        {tr("Chacun lance un dé sous le godet. Celui qui lance le premier regarde son dé et dit « mon grand » ou « mon petit » pour les deux : avec « mon grand », le plus grand dé gagne ; avec « mon petit », le plus petit. Même dé : on relance tous les deux. Le gagnant ramasse les deux mises. Le premier lancer change de main à chaque manche : celui qui lance le premier a l'avantage, alors chacun l'a à son tour. Taux de retour : 100 % sur deux manches. Argent du jeu seulement, 18 ans et plus, 120 manches par jour.")}
      </RulesFold>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#ffcc33]">
        <Die n={5} size={28} />
      </span>
      <div>
        <div className="font-display text-[24px] leading-none font-extrabold text-[#ffcc33]">{tr('Godé')}</div>
        <div className="text-[12px] font-bold text-white/75">{tr('Mon grand, mon petit : le dé du maquis')}</div>
      </div>
    </div>
  )
}

/** A side's name over its corner of the table, and who throws first. */
function SeatName({ name, first, className }: { name: string; first: boolean; className: string }) {
  return (
    <div className={`pointer-events-none absolute left-2 max-w-[60%] ${className}`}>
      <span className="truncate rounded-full bg-black/40 px-2 py-0.5 font-display text-[14px] font-extrabold">{name}</span>
      {first && <span className="ml-1 rounded-full bg-[#ffcc33] px-1.5 py-0.5 text-[10px] font-extrabold text-[#3a1f0c]">{tr('lance le premier')}</span>}
    </div>
  )
}

/** A die, its face up: the game's cube (components/table/Die.tsx), lying a little askew. */
function Die({ n, size }: { n: number; size: number }) {
  return (
    <span className="inline-grid place-items-center" style={{ width: size, height: size }} aria-label={tr('dé : {n}', { n })}>
      <Cube value={n} roll={0} size={Math.round(size * 0.78)} />
    </span>
  )
}
