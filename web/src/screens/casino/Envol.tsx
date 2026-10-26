import { useEffect, useRef, useState } from 'react'
import { Plane } from 'lucide-react'
import { api, ApiError } from '../../lib/api'
import { haptic } from '../../lib/native'
import { serverNow } from '../../lib/worldClock'
import type { EnvolBet, EnvolState, Sim, World } from '../../lib/types'
import type { Act } from '../phoneApps'
import { StakeField, stakeOK } from '../../components/StakeField'
import { pct, useCasinoRates } from '../../lib/casino'
import { GameHistory } from '../../components/GameHistory'

/**
 * L'Envol (backend game/envol.go, sims/envol.go), in Babi Casino: a bet before
 * the plane takes off, the multiplier climbing while it flies, cashed in by
 * hand (or by itself at a target) before it flies off. The rounds are the
 * same for every player; where the plane goes is the server's, heard as it
 * happens (the read is held till then). The multiplier on screen runs from
 * the shared clock, the way the server counts it.
 */

const nf = (n: number) => n.toLocaleString('fr-FR')
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? 'Hors ligne' : e instanceof Error ? e.message : 'Erreur')
const times = (m: number) => `×${m.toFixed(2).replace('.', ',')}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** A plane's colour by how far it went (the history's chips). */
const tone = (m: number) => (m >= 10 ? '#ffcc33' : m >= 2 ? '#c08bff' : '#7fb2ff')
const AUTOS = [0, 1.5, 2, 3, 5, 10]

type Props = { world: World; sim: Sim; act: Act }

export function Envol({ world, sim, act }: Props) {
  const cfg = world.casino?.envol ?? {
    stakes: [100, 200, 500, 1000, 2000, 5000],
    period: 40,
    wait: 8,
    maxFlight: 30,
    max: 100,
  }
  const rate = Math.log(cfg.max) / cfg.maxFlight
  const climb = (ms: number) => (ms <= 0 ? 1 : Math.floor(Math.exp((rate * ms) / 1000) * 100) / 100)
  // What it gives back on average (lib/casino.ts): the team's rate, else its own.
  const back = useCasinoRates().envol?.rate ?? 0.95
  const [st, setSt] = useState<EnvolState | null>(null)
  const [stake, setStake] = useState(cfg.stakes[2] ?? cfg.stakes[0])
  const [auto, setAuto] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cashed, setCashed] = useState<{
    round: number
    m: number
    pay: number
  } | null>(null)
  const [, frame] = useState(0)
  const settled = useRef(new Set<number>())

  // The round, read again as soon as it answers (held by the server till the next thing happens).
  useEffect(() => {
    let stop = false
    void (async () => {
      while (!stop) {
        const sent = Date.now()
        try {
          const s = await api.envol(sim.id)
          if (!stop) setSt(s)
        } catch {
          await sleep(2000)
        }
        await sleep(Math.max(0, 150 - (Date.now() - sent)))
      }
    })()
    return () => {
      stop = true
    }
  }, [sim.id])
  // The multiplier runs on screen.
  useEffect(() => {
    let id = 0
    const tick = () => {
      frame((n) => n + 1)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  const now = serverNow()
  const r = st?.round
  // Where the round is: the server's, the take-off seen here as it comes.
  let phase = r?.phase ?? 'attente'
  if (r && phase === 'attente' && now >= r.takeoff) phase = 'vol'
  const nextStart = r ? r.next - cfg.wait * 1000 : 0
  const waitingNext = !!r && phase === 'parti' && now >= nextStart
  const m = !r ? 1 : phase === 'parti' ? (r.crash ?? 1) : phase === 'vol' ? climb(now - r.takeoff) : 1
  const mine = (n: number): EnvolBet | undefined => st?.mine.find((b) => b.round === n)
  const cur = r ? mine(r.n) : undefined
  const next = r ? mine(r.n + 1) : undefined
  // Cashed in: by hand here, by the server (its answer), or by itself at its target.
  const curCashed = cur && (cashed?.round === cur.round ? cashed.m : cur.cashed || (cur.auto && phase !== 'attente' && m >= cur.auto ? cur.auto : 0))

  // The plane gone with a bet of the Sim's on it: settled (auto cash-outs paid, the rest lost).
  useEffect(() => {
    if (!r || r.phase !== 'parti' || !cur || settled.current.has(r.n)) return
    settled.current.add(r.n)
    if (!curCashed) haptic('heavy')
    if (cur.status === 'open') void act("L'Envol", 'plane', 'casino', () => api.settleBets(sim.id))
  }, [r?.n, r?.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const bet = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.envolBet(sim.id, stake, auto)
      haptic('light')
      void act("L'Envol", 'plane', 'casino', async () => res)
      setSt(await api.envol(sim.id).catch(() => st))
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }
  const cash = async () => {
    if (!cur) return
    setBusy(true)
    setError('')
    try {
      const res = await api.envolCash(sim.id)
      const pay = res.outcome.money
      setCashed({ round: cur.round, m: pay / cur.stake, pay })
      haptic('success')
      void act("L'Envol", 'plane', 'casino', async () => res)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
        {(st?.history ?? []).map((h, i) => (
          <span key={i} className="shrink-0 rounded-full bg-black/35 px-2.5 py-1 text-[12px] font-extrabold" style={{ color: tone(h) }}>
            {times(h)}
          </span>
        ))}
      </div>
      <Sky
        phase={waitingNext ? 'attente' : phase}
        m={m}
        elapsed={r && phase !== 'attente' ? (phase === 'parti' ? (r.flown ?? r.takeoff) : now) - r.takeoff : 0}
        rate={rate}
        left={r ? Math.max(0, (waitingNext ? r.next : r.takeoff) - now) : 0}
        wait={cfg.wait}
        cashed={curCashed || 0}
      />
      {error && <p className="mt-2 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      <div className="mt-3 rounded-[22px] bg-black/25 p-3">
        {cur && !waitingNext ? (
          <Ticket bet={cur} phase={phase} m={m} cashed={curCashed || 0} busy={busy} onCash={() => void cash()} crash={r?.crash} />
        ) : next ? (
          <p className="py-2 text-center text-[14px] font-extrabold">
            Mise de {nf(next.stake)} sur le prochain envol
            {next.auto ? ` · encaissée seule à ${times(next.auto)}` : ''}.
          </p>
        ) : (
          <>
            <StakeField usual={cfg.stakes} value={stake} onChange={setStake} money={sim.money} disabled={busy} />
            <div className="mt-2 flex items-center gap-1.5">
              <span className="shrink-0 text-[12px] font-extrabold text-white/70">Encaisser seul</span>
              {AUTOS.map((a) => (
                <button key={a} className={`flex-1 rounded-full py-1.5 text-[12px] font-extrabold ${auto === a ? 'bg-white text-[#0b3d26]' : 'bg-white/12'}`} onClick={() => setAuto(a)}>
                  {a ? `×${String(a).replace('.', ',')}` : 'Non'}
                </button>
              ))}
            </div>
            <button
              className="btn mt-2.5 w-full !py-3"
              style={{
                background: 'linear-gradient(180deg,#7cfc9a,#1f9d55)',
                color: '#05301a',
              }}
              disabled={busy || !st || !stakeOK(stake, cfg.stakes) || sim.money < stake}
              onClick={() => void bet()}
            >
              {sim.money < stake ? "Pas assez d'argent" : phase === 'attente' && !waitingNext ? `Miser ${nf(stake)}` : `Miser ${nf(stake)} sur le prochain envol`}
            </button>
          </>
        )}
      </div>
      {!!st?.players.length && (
        <div className="mt-3 rounded-[22px] bg-black/20 p-3">
          <div className="mb-1.5 text-[12px] font-extrabold tracking-wide text-white/60 uppercase">
            Cet envol · {st.players.length} joueur
            {st.players.length > 1 ? 's' : ''}
          </div>
          {st.players.slice(0, 12).map((p, i) => {
            const c = p.mine ? curCashed || p.cashed : p.cashed
            return (
              <div key={i} className={`flex items-center justify-between py-1 text-[13px] font-bold ${p.mine ? 'text-[#ffcc33]' : ''}`}>
                <span>{p.mine ? 'Toi' : p.name}</span>
                <span>
                  {nf(p.stake)}
                  {c ? <span className="ml-2 text-[#7cfc9a]">{times(c)}</span> : phase === 'parti' ? <span className="ml-2 text-[#ff8a8a]">perdu</span> : null}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-3 text-center text-[11.5px] leading-snug font-bold text-white/55">
        Mise avant le décollage. Tant que l'avion vole, le multiplicateur monte : encaisse avant qu'il parte et tu gagnes ta mise fois le multiplicateur. Parti avant, ta mise est perdue. Où il part, personne ne le sait avant : le jeu rend
        {pct(back)} des mises en moyenne (son taux de retour), quel que soit le moment où tu encaisses.
      </p>
      <GameHistory simId={sim.id} jeu="envol" tick={st?.round?.n} />
    </div>
  )
}

function Ticket({ bet, phase, m, cashed, busy, onCash, crash }: { bet: EnvolBet; phase: string; m: number; cashed: number; busy: boolean; onCash: () => void; crash?: number }) {
  if (cashed)
    return (
      <div className="animate-pop py-1.5 text-center">
        <div className="font-display text-[22px] font-extrabold text-[#7cfc9a]">Encaissé à {times(cashed)}</div>
        <div className="text-[14px] font-extrabold">+{nf(Math.floor(bet.stake * cashed))} Djai</div>
      </div>
    )
  if (phase === 'attente')
    return (
      <p className="py-2 text-center text-[14px] font-extrabold">
        Mise de {nf(bet.stake)} placée
        {bet.auto ? ` · encaissée seule à ${times(bet.auto)}` : ''}. Attends le décollage…
      </p>
    )
  if (phase === 'parti')
    return (
      <div className="py-1.5 text-center">
        <div className="font-display text-[20px] font-extrabold text-[#ff8a8a]">Parti à {times(crash ?? m)}</div>
        <div className="text-[13px] font-bold text-white/70">Ta mise de {nf(bet.stake)} est perdue.</div>
      </div>
    )
  return (
    <button
      className="btn w-full !py-4 font-display !text-[20px]"
      style={{
        background: 'linear-gradient(180deg,#ffe27a,#ff9f1a)',
        color: '#5a1a00',
      }}
      disabled={busy}
      onClick={onCash}
    >
      Encaisser {nf(Math.floor(bet.stake * m))}
    </button>
  )
}

/** The sky: the curve the plane has drawn, the plane at its tip, the multiplier. */
function Sky({ phase, m, elapsed, rate, left, wait, cashed }: { phase: string; m: number; elapsed: number; rate: number; left: number; wait: number; cashed: number }) {
  const W = 320
  const H = 190
  const pad = 14
  const secs = Math.max(0, elapsed / 1000)
  const spanX = Math.max(8, secs * 1.15)
  const top = Math.max(2, m * 1.12)
  const px = (t: number) => pad + (t / spanX) * (W - 2 * pad)
  const py = (v: number) => H - pad - ((v - 1) / (top - 1)) * (H - 2 * pad)
  const pts: [number, number][] = []
  for (let i = 0; i <= 48; i++) {
    const t = (secs * i) / 48
    pts.push([px(t), py(Math.min(m, Math.exp(rate * t)))])
  }
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [tx, ty] = pts[pts.length - 1]
  const [bx, by] = pts[Math.max(0, pts.length - 4)]
  const angle = (Math.atan2(ty - by, tx - bx) * 180) / Math.PI
  const gone = phase === 'parti'
  return (
    <div className="relative h-[190px] overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_20%_100%,#3b1d6e,#140a2e_60%,#07041a)] shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="envol-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9f1a" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ff9f1a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - 2 * pad)} y2={pad + f * (H - 2 * pad)} stroke="#ffffff" strokeOpacity="0.06" />
        ))}
        {phase !== 'attente' && secs > 0 && (
          <>
            <path d={`${line} L${tx.toFixed(1)},${H - pad} L${pad},${H - pad} Z`} fill="url(#envol-fill)" opacity={gone ? 0.35 : 1} />
            <path d={line} fill="none" stroke={gone ? '#ff5a5a' : '#ffb020'} strokeWidth="3.5" strokeLinecap="round" />
          </>
        )}
      </svg>
      {phase === 'vol' && (
        <div
          className="absolute"
          style={{
            left: `${(tx / W) * 100}%`,
            top: `${(ty / H) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${angle + 45}deg)`,
          }}
        >
          <Plane size={30} strokeWidth={2.2} className="fill-[#ff3b5c] text-[#ffd0d8] drop-shadow-[0_2px_6px_rgba(255,59,92,0.7)]" />
        </div>
      )}
      {gone && (
        <div className="animate-envol-off absolute" style={{ left: `${(tx / W) * 100}%`, top: `${(ty / H) * 100}%` }}>
          <Plane size={30} strokeWidth={2.2} className="fill-[#ff3b5c] text-[#ffd0d8]" />
        </div>
      )}
      <div className="absolute inset-0 grid place-items-center text-center">
        {phase === 'attente' ? (
          <div>
            <div className="text-[12px] font-extrabold tracking-[0.2em] text-white/70 uppercase">Prochain envol</div>
            <div className="font-display text-[40px] leading-none font-extrabold">{Math.ceil(left / 1000)} s</div>
            <div className="mx-auto mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#ffcc33]"
                style={{
                  width: `${Math.min(100, (left / (wait * 1000)) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1.5 text-[11.5px] font-bold text-white/60">Les mises sont ouvertes</div>
          </div>
        ) : (
          <div>
            {gone && <div className="text-[13px] font-extrabold tracking-[0.18em] text-[#ff8a8a] uppercase">Parti !</div>}
            <div className={`font-display text-[46px] leading-none font-extrabold ${gone ? 'text-[#ff5a5a]' : ''}`} style={{ textShadow: '0 3px 12px rgba(0,0,0,0.5)' }}>
              {times(m)}
            </div>
            {!!cashed && !gone && <div className="mt-1 text-[12.5px] font-extrabold text-[#7cfc9a]">Encaissé à {times(cashed)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
