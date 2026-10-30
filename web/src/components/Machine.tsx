import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Cherry, LogOut, X } from 'lucide-react'
import { amount } from '../game/rules'
import { haptic } from '../lib/native'
import type { ActionResult, Sim, SlotSpin, World } from '../lib/types'
import { Coin } from './ui'
import { StakeField, stakeOK } from './StakeField'
import { pct, useCasinoRates } from '../lib/casino'
import { GameHistory } from './GameHistory'
import { t as tr, tx, locale } from '../lib/i18n'

// La machine à sous (backend game/slots.go, sims/machine.go): at the maquis
// or at the Hôtel Ivoire's casino, the Sim sits at a machine; here, the
// player picks a stake and pulls the lever, the server draws the reels, they
// roll and stop one after the other, and what they show pays (or not). The
// game's money only, adults only.

/** Whether an interaction is playing a slot machine (backend game.SlotStakes says the same). */
export const isSlots = (id?: string) => id === 'machine-maquis' || id === 'machine-casino'

/** A picture of the reels, drawn (the same on every phone, no emoji font needed). */
export function SlotIcon({ id, size = 56 }: { id: string; size?: number }) {
  const g = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-label={id}>
      {id === 'mangue' && (
        <>
          <defs>
            <linearGradient id={`m${g}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffd84a" />
              <stop offset="0.55" stopColor="#ff8a1f" />
              <stop offset="1" stopColor="#e2452c" />
            </linearGradient>
          </defs>
          <path d="M18 52c-9-10-6-31 11-38 13-5 25 5 23 20-2 15-20 28-34 18z" fill={`url(#m${g})`} />
          <path d="M24 22c3-3 7-4 10-4" stroke="#fff6" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M37 15l3-7" stroke="#6b4a1e" strokeWidth="3" strokeLinecap="round" />
          <path d="M40 11c5-7 13-8 17-6-3 6-9 9-17 6z" fill="#2e9e44" />
        </>
      )}
      {id === 'banane' && (
        <>
          <path d="M9 20c5 24 29 35 48 24 2-1 1-5-2-4-17 4-31-5-37-21-1-3-10-3-9 1z" fill="#ffd93b" stroke="#c99a12" strokeWidth="2" />
          <path d="M16 24c6 13 18 19 32 18" stroke="#fff3" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M9 20l-3-6 7 2z" fill="#6b4a1e" />
          <path d="M56 44l5 2-3 3z" fill="#6b4a1e" />
        </>
      )}
      {id === 'coco' && (
        <>
          <circle cx="32" cy="34" r="22" fill="#7a4a24" stroke="#4e2c12" strokeWidth="3" />
          <path d="M16 30c4-2 6-6 7-10M44 50c3-2 7-3 10-3M20 46c2 2 5 3 8 3" stroke="#a7703f" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="26" cy="26" r="3.2" fill="#2e1a0b" />
          <circle cx="38" cy="26" r="3.2" fill="#2e1a0b" />
          <circle cx="32" cy="35" r="3.2" fill="#2e1a0b" />
        </>
      )}
      {id === 'cacao' && (
        <>
          <defs>
            <linearGradient id={`c${g}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f6b23e" />
              <stop offset="0.6" stopColor="#c8651d" />
              <stop offset="1" stopColor="#8a3f12" />
            </linearGradient>
          </defs>
          <g transform="rotate(-32 32 34)">
            <rect x="29" y="4" width="6" height="7" rx="2" fill="#5b7d2a" />
            <ellipse cx="32" cy="34" rx="15" ry="25" fill={`url(#c${g})`} />
            {[-8, -3, 3, 8].map((x) => (
              <path key={x} d={`M${32 + x} 11c${x * 0.5} 8 ${x * 0.5} 38 0 46`} stroke="#0003" strokeWidth="1.6" fill="none" />
            ))}
          </g>
        </>
      )}
      {id === 'elephant' && (
        <>
          <ellipse cx="15" cy="28" rx="13" ry="17" fill="#8a93a2" />
          <ellipse cx="49" cy="28" rx="13" ry="17" fill="#8a93a2" />
          <ellipse cx="16" cy="29" rx="8" ry="11" fill="#c79aa3" opacity="0.6" />
          <ellipse cx="48" cy="29" rx="8" ry="11" fill="#c79aa3" opacity="0.6" />
          <ellipse cx="32" cy="27" rx="13" ry="14" fill="#a5aebb" />
          <path d="M27 34v13c0 7 7 10 12 6l-2-3c-3 2-5 0-5-3V34z" fill="#a5aebb" />
          <path d="M25 37c-4 4-5 9-2 12M39 37c4 4 5 9 2 12" stroke="#fffaf0" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="27" cy="24" r="2.2" fill="#1b1d21" />
          <circle cx="37" cy="24" r="2.2" fill="#1b1d21" />
        </>
      )}
      {id === 'sept' && (
        <text x="32" y="53" textAnchor="middle" fontSize="54" fontWeight="900" fontFamily="'Baloo 2', system-ui, sans-serif" fill="#e3132c" stroke="#ffcc33" strokeWidth="3.5" paintOrder="stroke">
          7
        </text>
      )}
    </svg>
  )
}

/** The button in the activity bar, while at a machine: back to it. */
export function MachineButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn animate-pop mt-2 w-full !py-2.5" style={{ background: 'linear-gradient(180deg,#ffd54f,#ff9f1a)', color: '#5a1a00' }} onClick={onClick}>
      <Cherry size={18} /> {tr('Jouer à la machine')}
    </button>
  )
}

const ORDER = ['mangue', 'banane', 'coco', 'cacao', 'elephant', 'sept']
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One reel: rolling while the server draws, then landing on its picture. */
function Reel({ id, rolling, start }: { id: string; rolling: boolean; start: number }) {
  // The strip shown rolling: every picture, twice, from a different one on each reel.
  const strip = [...ORDER.slice(start), ...ORDER.slice(0, start)]
  return (
    <div className="relative h-[96px] flex-1 overflow-hidden bg-gradient-to-b from-[#e9e2d0] via-white to-[#e9e2d0]">
      {rolling ? (
        <div className="reel-roll absolute inset-x-0 top-0 flex flex-col items-center">
          {[...strip, ...strip].map((s, i) => (
            <div key={i} className="grid h-[96px] place-items-center">
              <SlotIcon id={s} size={60} />
            </div>
          ))}
        </div>
      ) : (
        <div key={id} className="reel-land grid h-full place-items-center">
          <SlotIcon id={id} size={66} />
        </div>
      )}
    </div>
  )
}

export function MachineSheet({
  world,
  sim,
  adultAccount,
  onConfirmAdult,
  spin,
  onResult,
  onLeave,
  onClose,
}: {
  world: World
  sim: Sim
  adultAccount: boolean
  onConfirmAdult: () => Promise<void>
  /** The spin asked of the server (null: refused, already said). */
  spin: (stake: number) => Promise<ActionResult | null>
  /** The result applied to the game, once the reels have stopped. */
  onResult: (res: ActionResult) => void
  /** Get up from the machine: the activity ends, the session is told. */
  onLeave: () => void
  onClose: () => void
}) {
  const a = sim.activity
  const casino = a?.interaction.id === 'machine-casino'
  const stakes = world.slots?.stakes[a?.interaction.id ?? ''] ?? [100]
  const session = a?.machine
  const [stake, setStake] = useState(() => (session && stakeOK(session.stake, stakes) ? session.stake : stakes[0]))
  const [reels, setReels] = useState<string[]>(session?.last?.reels ?? ['sept', 'cacao', 'elephant'])
  const [stopped, setStopped] = useState(3)
  const [pull, setPull] = useState(0)
  const [result, setResult] = useState<{ spin: SlotSpin; win: number } | null>(null)
  const [table, setTable] = useState(false)
  // The casino's rate (lib/casino.ts): the prizes as the machine pays them now (scaled when the team set one).
  const rate = useCasinoRates().machines
  const k = rate?.set ? rate.rate / rate.natural : 1
  const times = (n: number) => (Math.floor(n * k * 100) / 100).toLocaleString(locale())
  const busy = stopped < 3
  // What's shown of the money and the session stays as it was while the reels roll: a sync of the
  // game arriving meanwhile doesn't tell the result before they stop.
  const [shown, setShown] = useState({ money: sim.money, session })
  useEffect(() => {
    if (!busy) setShown({ money: sim.money, session })
  }, [busy, sim.money, session])
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const spinsLeft = (world.slots?.perDay ?? 200) - (sim.today?.machine?.times ?? 0)

  const go = async () => {
    if (busy || sim.money < stake) return
    setResult(null)
    setStopped(0)
    setPull((p) => p + 1)
    haptic('light')
    const t0 = performance.now()
    const res = await spin(stake)
    const last = res?.sim.activity?.machine?.last
    if (!res || !last) {
      setStopped(3)
      return
    }
    // The reels roll a moment at least, then stop one after the other.
    await wait(Math.max(0, 700 - (performance.now() - t0)))
    for (let i = 0; i < 3; i++) {
      if (!alive.current) return
      setReels((r) => r.map((x, j) => (j === i ? last.reels[i] : x)))
      setStopped(i + 1)
      haptic('light')
      await wait(i < 2 ? 320 : 120)
    }
    if (!alive.current) return
    setResult({ spin: last, win: stake * last.times })
    if (last.times >= 30) haptic('success')
    onResult(res)
  }

  const jackpot = !!result && result.spin.times >= 200
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/60 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={busy ? undefined : onClose}>
      <div className="animate-up max-h-[92%] w-full overflow-y-auto rounded-t-[28px] bg-gradient-to-b from-[#8a0f22] via-[#5c0816] to-[#2a030a] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-[0_-8px_40px_rgba(0,0,0,0.4)] lg:w-[440px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold tracking-[0.18em] text-[#ffcc33]/80 uppercase">{casino ? tr('Casino · Hôtel Ivoire') : a?.placeName}</div>
            <div className="font-display text-[26px] leading-none font-extrabold text-[#ffcc33] drop-shadow-[0_2px_0_rgba(0,0,0,0.4)]">{tr('Machine à sous')}</div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[13px] font-extrabold">
            <Coin size={15} /> {amount(shown.money)}
          </span>
          <button className="icon-btn bg-white/15 text-white" onClick={onClose} disabled={busy} aria-label={tr('Fermer')}>
            <X size={20} strokeWidth={2.6} />
          </button>
        </div>

        {!adultAccount ? (
          <div className="mt-4 rounded-2xl bg-black/25 p-4 text-sm font-bold">
            <p>{tr("Les machines à sous sont réservées aux joueurs de 18 ans et plus. On y joue avec l'argent du jeu seulement.")}</p>
            <button className="btn mt-3 w-full !py-2" onClick={() => void onConfirmAdult()}>
              {tr('J’ai 18 ans ou plus')}
            </button>
          </div>
        ) : (
          <>
            {/* The cabinet: the lights round it, the reels behind their glass, the line, the lever */}
            <div className="relative mt-3 pr-9">
              <div className="rounded-[22px] bg-gradient-to-b from-[#ffd54f] to-[#c98a12] p-[6px] shadow-[inset_0_2px_0_rgba(255,255,255,0.5)]">
                <div className="flex justify-between px-2 pb-1.5">
                  {[...Array(9)].map((_, i) => (
                    <span key={i} className={`bulb h-2.5 w-2.5 rounded-full ${busy || jackpot ? 'bulb-fast' : ''}`} style={{ background: i % 2 ? '#fff6c2' : '#ff3d57', animationDelay: `${(i % 2) * 0.45}s`, boxShadow: '0 0 6px currentColor' }} />
                  ))}
                </div>
                <div className="relative flex gap-[5px] overflow-hidden rounded-[16px] bg-[#2a030a] p-[5px]">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-1 overflow-hidden rounded-[11px]">
                      <Reel id={reels[i]} rolling={stopped <= i} start={i * 2} />
                    </div>
                  ))}
                  {/* The line that pays, across the middle */}
                  <span className="pointer-events-none absolute inset-x-1 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#e3132c]/70" />
                </div>
              </div>
              {/* The lever */}
              <button className="absolute top-2 right-0 flex w-8 flex-col items-center" onClick={() => void go()} disabled={busy} aria-label={tr('Tirer le levier')}>
                <span key={pull} className={`flex origin-bottom flex-col items-center ${pull ? 'lever-pull' : ''}`}>
                  <span className="h-7 w-7 rounded-full bg-gradient-to-b from-[#ff5a6e] to-[#b3001a] shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]" />
                  <span className="h-14 w-2 rounded-full bg-gradient-to-r from-[#d7dbe2] to-[#8a919c]" />
                </span>
                <span className="h-5 w-6 rounded-md bg-[#3a3f48]" />
              </button>
            </div>

            {/* What the reels said */}
            <div className="mt-3 grid h-[58px] place-items-center rounded-2xl bg-black/25 px-3 text-center">
              {busy ? (
                <span className="text-[15px] font-extrabold text-white/70">{tr('Les rouleaux tournent…')}</span>
              ) : result ? (
                result.win > 0 ? (
                  <span key={result.spin.reels.join()} className={`animate-pop leading-tight ${jackpot ? 'text-[#ffcc33]' : ''}`}>
                    <span className="block text-[13px] font-extrabold text-white/85">{result.spin.line}</span>
                    <span className="font-display text-[24px] font-extrabold text-[#ffcc33]">{tx('+{0} Djai', { 0: amount(result.win) })}</span>
                  </span>
                ) : (
                  <span className="text-[15px] font-extrabold text-white/80">{tr('Pas de chance cette fois.')}</span>
                )
              ) : (
                <span className="text-[15px] font-extrabold text-white/80">{tr('Choisis ta mise et tire le levier.')}</span>
              )}
            </div>

            {/* The stake, and spin */}
            <div className="mt-3">
              <StakeField usual={stakes} value={stake} onChange={setStake} money={sim.money} disabled={busy} />
            </div>
            <button
              className="mt-3 w-full rounded-[18px] bg-gradient-to-b from-[#ffe27a] to-[#ff9f1a] py-3.5 font-display text-[22px] font-extrabold tracking-wide text-[#5a1a00] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18),0_6px_18px_rgba(255,160,26,0.35)] transition active:scale-[0.98] disabled:opacity-50"
              onClick={() => void go()}
              disabled={busy || !stakeOK(stake, stakes) || sim.money < stake || spinsLeft <= 0}
            >
              {sim.money < stake ? tr("Pas assez d'argent") : spinsLeft <= 0 ? tr('Reviens demain') : tr('LANCER · {0}', { 0: amount(stake) })}
            </button>

            {/* The session so far */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                [tr('Tours'), shown.session?.spins ?? 0],
                [tr('Misé'), shown.session?.staked ?? 0],
                [tr('Gagné'), shown.session?.won ?? 0],
              ].map(([label, n]) => (
                <div key={label} className="rounded-2xl bg-black/25 py-2">
                  <div className="text-[10px] font-extrabold tracking-wider text-white/60 uppercase">{label}</div>
                  <div className="font-display text-[17px] font-extrabold">{amount(n as number)}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[11.5px] font-bold text-white/60">
              {tx("Encore {0} tours aujourd'hui · l'argent du jeu seulement", { 0: Math.max(0, spinsLeft) })}
            </p>

            {/* What pays */}
            <button className="mt-2 flex w-full items-center justify-center gap-1 text-[13px] font-extrabold text-[#ffcc33]" onClick={() => setTable((t) => !t)}>
              {tr('Les gains')} <ChevronDown size={16} className={`transition ${table ? 'rotate-180' : ''}`} />
            </button>
            {table && (
              <div className="animate-pop mt-2 rounded-2xl bg-black/25 p-3">
                {[...(world.slots?.symbols ?? [])].reverse().map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-1">
                    <span className="flex">
                      {[0, 1, 2].map((i) => (
                        <SlotIcon key={i} id={s.id} size={24} />
                      ))}
                    </span>
                    <span className="flex-1 text-[13px] font-bold text-white/80">{s.label}</span>
                    <span className="text-[13px] font-extrabold text-[#ffcc33]">{tr('×')}{times(s.three)}</span>
                    <span className="w-14 text-right text-[12px] font-bold text-white/60">{tr('deux ×')}{times(s.two)}</span>
                  </div>
                ))}
                <p className="mt-1 text-[12px] font-bold text-white/70">{tx("Deux pareils : sur les deux premiers rouleaux. Un 7 seul, n'importe où : {0}.", { 0: k === 1 ? tr('ta mise revient') : tr('×{0} de ta mise', { 0: times(1) }) })}</p>
                <p className="mt-1 text-[12px] font-bold text-white/55">{tx("Comme partout, la machine garde un peu plus qu'elle ne rend : taux de retour {0}, soit environ {1} Djai rendus pour 100 misés, sur la durée.", { 0: pct(rate?.rate ?? 0.891), 1: Math.round((rate?.rate ?? 0.891) * 100) })}</p>
              </div>
            )}

            <GameHistory simId={sim.id} jeu="machines" tick={shown.session?.spins} />
            <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-white/12 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50" onClick={onLeave} disabled={busy}>
              <LogOut size={16} /> {tr('Quitter la machine')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
