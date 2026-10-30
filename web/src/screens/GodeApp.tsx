import { useEffect, useRef, useState } from 'react'
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

/**
 * Le godé (backend game/gode.go, sims/gode.go), the maquis' dice: each throws
 * one die under the godet; the first to throw looks and calls « mon grand »
 * or « mon petit » for both, then the other throws: with « grand » the bigger
 * die wins, with « petit » the smaller. The same die: both throw again. The
 * first throw goes to each in turn. The godet shakes, lifts, the die is
 * there; the dice are drawn by the server. The game's money only, 18+.
 */

const nf = (n: number) => n.toLocaleString(locale())
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : errorText(e, tr('Erreur')))
const STAKES = [0, 100, 500, 2000]
const MAX = 2000
/** How long the godet shakes before it lifts, and the beat between two throws again. */
const SHAKE = 900
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
      steps.forEach((who, k) => {
        later(t, () => (setShaking(who), sfx.chip()))
        later(t + SHAKE, () => {
          setShaking(null)
          setShown((s) => ({ ...s, [who]: s[who] + 1 }))
          sfx.card()
          haptic('light')
        })
        t += SHAKE + (k % 2 === 1 ? AGAIN : 150)
      })
      later(t, () => {
        setBusy(false)
        if (r.done) {
          haptic(r.won ? 'success' : 'light')
          if (r.won) sfx.win(false)
          else sfx.lose()
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
      <div className="mt-3 rounded-[26px] border-4 border-[#3a1f0c] bg-[radial-gradient(circle_at_50%_35%,#c08a52,#7a4a22)] p-3 shadow-[inset_0_0_26px_rgba(0,0,0,0.45)]">
        <Seat name={round?.them ?? tr('Le gars du maquis')} dice={round?.npc.slice(0, shown.npc) ?? []} shaking={shaking === 'npc'} hidden={!!playing && !shown.npc} first={round?.first === 'them'} />
        <div key={word} className="animate-pop my-3 rounded-2xl bg-black/30 px-3 py-2 text-center text-[14px] font-extrabold" style={{ color: settled ? (round!.won ? '#7cfc9a' : '#ffb3b3') : '#fff' }}>
          « {word} »
          {settled && round!.stake > 0 && <span className="block font-sans text-[12px] text-white/80">{round!.won ? tr('+{0} Djai', { 0: nf(round!.paid ?? 0) }) : tr('−{0} Djai', { 0: nf(round!.stake) })}</span>}
        </div>
        <Seat name={tr('Toi')} dice={round?.me.slice(0, shown.me) ?? []} shaking={shaking === 'me'} hidden={!!playing && !shown.me} first={round?.first === 'me'} />
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

/** A side of the table: the player's name, the godet over the die (shaking, or lifted), the dice thrown before (the ties) small beside. */
function Seat({ name, dice, shaking, hidden, first }: { name: string; dice: number[]; shaking: boolean; hidden: boolean; first: boolean }) {
  const last = dice[dice.length - 1]
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0">
        <div className="truncate font-display text-[16px] font-extrabold">{name}</div>
        {first && <div className="text-[11px] font-extrabold text-[#ffcc33]">{tr('lance le premier')}</div>}
        {dice.length > 1 && (
          <div className="mt-1 flex gap-1 opacity-60">
            {dice.slice(0, -1).map((d, i) => (
              <Die key={i} n={d} size={18} />
            ))}
          </div>
        )}
      </div>
      <div className="relative grid h-[92px] flex-1 place-items-center">
        {last && !shaking ? (
          <div key={`${dice.length}-${last}`} className="gode-land">
            <Die n={last} size={58} />
          </div>
        ) : (
          <div className={shaking ? 'gode-shake' : hidden ? 'motion-breathe' : 'opacity-40'}>
            <Godet />
          </div>
        )}
      </div>
    </div>
  )
}

const PIPS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
  6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
}

/** A die, its face up. */
function Die({ n, size }: { n: number; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label={tr('dé : {n}', { n })}>
      <rect x="2" y="4" width="36" height="34" rx="8" fill="#c9bfae" />
      <rect x="2" y="2" width="36" height="34" rx="8" fill="#fffaf0" stroke="#d8cdb8" strokeWidth="1.2" />
      {(PIPS[n] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x * 9 + 2} cy={y * 9} r="3.6" fill={n === 1 ? '#c8102e' : '#1b1d21'} />
      ))}
    </svg>
  )
}

/** The godet: the leather cup the die is shaken in, upside down on the table. */
function Godet() {
  return (
    <svg width="70" height="78" viewBox="0 0 70 78" aria-hidden>
      <ellipse cx="35" cy="72" rx="30" ry="5" fill="rgba(0,0,0,0.3)" />
      <path d="M12 70 L18 12 Q35 4 52 12 L58 70 Q35 78 12 70 Z" fill="#5a2e12" />
      <path d="M18 12 Q35 4 52 12 Q35 18 18 12 Z" fill="#7a4220" />
      <path d="M14 56 Q35 63 56 56" stroke="#ffcc33" strokeWidth="2.4" fill="none" opacity="0.8" />
      <path d="M16 30 Q35 36 54 30" stroke="#ffcc33" strokeWidth="2.4" fill="none" opacity="0.8" />
      <path d="M24 16 L21 66" stroke="#fff" strokeWidth="3" opacity="0.12" strokeLinecap="round" />
    </svg>
  )
}
