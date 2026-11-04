import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, errorText, type TableState } from '../../lib/api'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import type { ActionResult, RouletteBet, RouletteSpin, Sim, World } from '../../lib/types'
import type { Act } from '../phoneApps'
import { StakeField, stakeOK } from '../../components/StakeField'
import { pct, useCasinoRates } from '../../lib/casino'
import { GameHistory } from '../../components/GameHistory'
import { RulesFold } from '../../components/RulesFold'
import { t as tr, tx, locale } from '../../lib/i18n'
import { reactToResult } from '../../avatar/expressions'

/**
 * La roulette of Babi Casino (backend game/casino.go): the European wheel with
 * its one zero, the ball thrown against it, running round the rim, slowing,
 * bouncing into its pocket. On the cloth, the plein and the outside bets, and
 * the numbers together: the cheval (two side by side), the transversale (a
 * row of three), the carré (four at a corner), the sixain (two rows), and the
 * voisins du zéro in a tap. The last bets doubled or put back, the last
 * numbers out kept on this phone. The spin is drawn by the server.
 */

const nf = (n: number) => n.toLocaleString(locale())
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? tr('Hors ligne') : errorText(e, tr('Erreur')))
const short = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n))

/** The wheel's numbers, round from the zero (the European wheel). */
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const pocket = (n: number) => (n === 0 ? '#0a8f4a' : RED.has(n) ? '#c8102e' : '#1b1d21')
const STEP = 360 / 37
const SPIN_MS = 4300

type Props = {
  world: World
  sim: Sim
  act: Act
  hold: (money: number | null) => void
  /** La table de l'Ivoire (backend sims/table.go): the wheel shared by every player, a round every 45 s; else one's own wheel. */
  table?: boolean
}

/** The share of a bet's net winnings the house keeps at a rate, for a bet paying `times` to 1 (backend game.RouletteCommission). */
const commission = (rate: number, times: number) => Math.max(0, Math.min(1, 1 - ((rate / (36 / 37)) * (times + 1) - 1) / times))
type Mode = 'plein' | 'cheval' | 'transversale' | 'carre' | 'sixain'
const MODES: { id: Mode; label: string; pays: number }[] = [
  { id: 'plein', label: tr('Plein'), pays: 35 },
  { id: 'cheval', label: tr('Cheval'), pays: 17 },
  { id: 'transversale', label: tr('Transv.'), pays: 11 },
  { id: 'carre', label: tr('Carré'), pays: 8 },
  { id: 'sixain', label: tr('Sixain'), pays: 5 },
]
const NAMES: Record<string, string> = { cheval: tr('Cheval'), transversale: tr('Transversale'), carre: tr('Carré'), sixain: tr('Sixain') }

/** Whether a bet takes a number (the classic table: the zero loses every outside bet). */
function covers(b: RouletteBet, n: number): boolean {
  if (b.numbers) return b.numbers.includes(n)
  if (b.kind === 'plein') return (b.number ?? 0) === n
  if (n === 0) return false
  switch (b.kind) {
    case 'rouge': return RED.has(n)
    case 'noir': return !RED.has(n)
    case 'pair': return n % 2 === 0
    case 'impair': return n % 2 === 1
    case 'manque': return n <= 18
    case 'passe': return n >= 19
    case 'douzaine': return Math.ceil(n / 12) === b.number
    case 'colonne': return ((n - 1) % 3) + 1 === b.number
  }
  return false
}
/** A bet as the server sends it back (a plein on the zero has no number): keyed as the cloth's. */
const norm = <T extends { kind: string; number?: number }>(b: T): T => (b.kind === 'plein' && b.number === undefined ? { ...b, number: 0 } : b)
const keyOf = (b: { kind: string; number?: number; numbers?: number[] }) => `${b.kind}:${b.number ?? ''}:${b.numbers ? [...b.numbers].sort((x, y) => x - y).join('-') : ''}`
/** Two numbers side by side on the cloth (a cheval): in a row of three, one above the other, or the zero with 1, 2, 3. */
const beside = (a: number, b: number) => {
  const [x, y] = a < b ? [a, b] : [b, a]
  return (x === 0 && y >= 1 && y <= 3) || (x > 0 && ((y === x + 1 && x % 3 !== 0) || y === x + 3))
}
/** The numbers a tap takes in each mode (the transversale, the carré, the sixain around the number tapped). */
function groupAt(mode: Mode, n: number): number[] {
  if (mode === 'transversale') {
    if (n === 0) return [0, 1, 2]
    const r = n - ((n - 1) % 3)
    return [r, r + 1, r + 2]
  }
  if (mode === 'carre') {
    if (n === 0) return [0, 1, 2, 3]
    let b = n % 3 === 0 ? n - 1 : n
    if (b > 32) b -= 3
    return [b, b + 1, b + 3, b + 4]
  }
  if (mode === 'sixain') {
    let r = n === 0 ? 1 : n - ((n - 1) % 3)
    if (r > 31) r = 31
    return [r, r + 1, r + 2, r + 3, r + 4, r + 5]
  }
  return [n]
}
/** The voisins du zéro: the 17 numbers round the zero, nine chips (the 0-2-3 and the 25-29 corner take two). */
const VOISINS: { kind: string; numbers: number[]; units: number }[] = [
  { kind: 'transversale', numbers: [0, 2, 3], units: 2 },
  { kind: 'cheval', numbers: [4, 7], units: 1 },
  { kind: 'cheval', numbers: [12, 15], units: 1 },
  { kind: 'cheval', numbers: [18, 21], units: 1 },
  { kind: 'cheval', numbers: [19, 22], units: 1 },
  { kind: 'cheval', numbers: [32, 35], units: 1 },
  { kind: 'carre', numbers: [25, 26, 28, 29], units: 2 },
]

/** The last numbers out, kept on this phone. */
const HISTORY = 'babi.roulette.history'
function readHistory(): number[] {
  try {
    return (JSON.parse(localStorage.getItem(HISTORY) ?? '[]') as number[]).slice(0, 15)
  } catch {
    return []
  }
}

/** The wheel, turned by `turn` degrees, and the ball (the number it stops on comes to the top). */
function Wheel({ turn, spinning, size = 230 }: { turn: number; spinning: boolean; size?: number }) {
  const r = size / 2
  const ball = useRef<HTMLSpanElement>(null)
  const wedges = useMemo(
    () =>
      WHEEL.map((n, i) => {
        const a0 = ((i - 0.5) * STEP - 90) * (Math.PI / 180)
        const a1 = ((i + 0.5) * STEP - 90) * (Math.PI / 180)
        const R = r - 6
        const d = `M ${r} ${r} L ${r + R * Math.cos(a0)} ${r + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${r + R * Math.cos(a1)} ${r + R * Math.sin(a1)} Z`
        return { n, i, d }
      }),
    [r],
  )
  // The ball: thrown the other way round the rim, slowing, falling in and bouncing to the top pocket as the wheel stops.
  useEffect(() => {
    const el = ball.current
    if (!el) return
    const rim = r - 9
    const pocketR = r - 21
    const place = (deg: number, rad: number) => {
      const a = ((deg - 90) * Math.PI) / 180
      el.style.transform = `translate(${r + rad * Math.cos(a) - 7}px, ${r + rad * Math.sin(a) - 7}px)`
    }
    if (!spinning) return place(0, pocketR)
    let id = 0
    const t0 = performance.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / (SPIN_MS - 100))
      const deg = 360 * 6 * (1 - Math.pow(1 - t, 3))
      let rad = rim
      if (t > 0.68) {
        const u = (t - 0.68) / 0.32
        rad = pocketR + (rim - pocketR) * Math.abs(Math.cos(u * Math.PI * 2.5)) * (1 - u) * (1 - u)
      }
      place(deg, rad)
      if (t < 1) id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [spinning, r])
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: `rotate(${turn}deg)`, transition: `transform ${(SPIN_MS - 100) / 1000}s cubic-bezier(0.15, 0.7, 0.1, 1)` }}>
        <circle cx={r} cy={r} r={r} fill="#7a4a1e" />
        <circle cx={r} cy={r} r={r - 3} fill="#d9a520" />
        {wedges.map((w) => (
          <path key={w.n} d={w.d} fill={pocket(w.n)} stroke="#d9a520" strokeWidth="0.8" />
        ))}
        {wedges.map((w) => (
          <text key={`t${w.n}`} x={r} y={18} textAnchor="middle" fontSize={size / 24} fontWeight="800" fill="#fff" transform={`rotate(${w.i * STEP} ${r} ${r})`}>
            {w.n}
          </text>
        ))}
        <circle cx={r} cy={r} r={r * 0.55} fill="#6b3f17" />
        <circle cx={r} cy={r} r={r * 0.42} fill="#8a5a24" stroke="#d9a520" strokeWidth="2" />
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x={r - 2} y={r - r * 0.36} width={4} height={r * 0.72} rx={2} fill="#d9a520" transform={`rotate(${k * 45} ${r} ${r})`} />
        ))}
        <circle cx={r} cy={r} r={r * 0.09} fill="#ffcc33" />
      </svg>
      <span ref={ball} className="absolute top-0 left-0 h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]" style={{ transform: `translate(${r - 7}px, ${14}px)` }} />
      <span className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[12px] border-x-transparent border-t-[#ffcc33]" />
    </div>
  )
}

/** A stake as chips stacked on the cloth: one to three discs, the amount on top. */
function Stack({ stake, chip }: { stake: number; chip: number }) {
  const n = Math.min(3, Math.max(1, Math.round(stake / Math.max(chip, 1))))
  return (
    <span className="pointer-events-none absolute -top-2 -right-1.5">
      {[...Array(n)].map((_, i) => (
        <span key={i} className="absolute rounded-full border-2 border-dashed border-white bg-[#ffcc33]" style={{ width: 20, height: 20, top: -i * 3, right: 0 }} />
      ))}
      <span className="relative grid h-5 min-w-5 place-items-center px-0.5 text-[9px] font-extrabold text-[#5a1a00]" style={{ top: -(n - 1) * 3 }}>
        {short(stake)}
      </span>
    </span>
  )
}

export function Roulette({ world, sim, act, hold, table = false }: Props) {
  const chips = world.casino?.chips ?? [100, 500, 1000, 2000]
  const maxTotal = world.casino?.maxTotal ?? 5000
  const maxBets = world.casino?.maxBets ?? 20
  const [chip, setChip] = useState(chips[0])
  const [mode, setMode] = useState<Mode>('plein')
  const [pending, setPending] = useState<number | null>(null)
  const [bets, setBets] = useState<Record<string, RouletteBet>>({})
  const [last, setLast] = useState<Record<string, RouletteBet>>({})
  const [history, setHistory] = useState<number[]>(readHistory)
  const [turn, setTurn] = useState(0)
  const [spinningSolo, setSpinning] = useState(false)
  // The ball is thrown when the server's answer is in, with the wheel.
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<RouletteSpin | null>(null)
  const rr = useCasinoRates().roulette
  const [error, setError] = useState('')
  // The shared table: its state from the server (every 1.5 s), the clock on the server's time (every 250 ms).
  const [ts, setTs] = useState<TableState | null>(null)
  const skew = useRef(0)
  const [clock, setClock] = useState(() => Date.now())
  const [placing, setPlacing] = useState(false)
  const animated = useRef(-1)
  const settled = useRef(-1)
  const pull = () =>
    api.casinoTable(sim.id).then(
      (x) => {
        skew.current = x.now - Date.now()
        setTs(x)
      },
      () => undefined,
    )
  useEffect(() => {
    if (!table) return
    void pull()
    const a = setInterval(() => void pull(), 1500)
    const b = setInterval(() => setClock(Date.now() + skew.current), 250)
    return () => (clearInterval(a), clearInterval(b))
  }, [table, sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const phase = !ts ? 'mises' : clock < ts.spinAt ? 'mises' : clock < ts.resultAt ? 'tour' : 'resultat'
  const placed = !!ts?.mine.length
  const spinning = table ? !ts || phase !== 'mises' || placed || placing : spinningSolo
  // A new round at the table: the cloth cleared (what was on it kept for « Remettre »), the last result put away.
  const roundSeen = useRef(-1)
  useEffect(() => {
    if (!table || !ts || roundSeen.current === ts.round) return
    if (roundSeen.current >= 0) {
      if (Object.keys(bets).length) setLast(bets)
      setBets({})
      setResult(null)
    }
    roundSeen.current = ts.round
    // Back at the table with chips already down this round: shown on the cloth.
    if (ts.mine.length && !Object.keys(bets).length) setBets(Object.fromEntries(ts.mine.map(norm).map((b) => [keyOf(b), b])))
  }, [ts?.round]) // eslint-disable-line react-hooks/exhaustive-deps
  // The ball thrown so as to stop when the round's does (SPIN_MS before), the wheel turning to its number; then
  // the round settled (the player's winnings paid, act) and the result shown.
  useEffect(() => {
    if (!table || !ts || ts.number < 0 || animated.current === ts.round || clock < ts.resultAt - SPIN_MS) return
    animated.current = ts.round
    const n = ts.number
    const left = Math.max(0, ts.resultAt - clock)
    if (left > 500) {
      sfx.spin(left / 1000)
      setRolling(true)
    }
    const i = WHEEL.indexOf(n)
    setTurn((t) => t - (((t % 360) + 360) % 360) - 360 * 5 - i * STEP)
    const mine = ts.mine.map(norm)
    const round = ts.round
    setTimeout(() => {
      setRolling(false)
      if (!mine.length || settled.current === round) return
      settled.current = round
      void act(tr("Table de l'Ivoire"), 'dice-5', 'casino', async () => {
        const res = await api.settleBets(sim.id)
        const st = await api.casinoTable(sim.id).catch(() => null)
        const back = st?.result?.round === round ? st.result.back : 0
        setResult({ number: n, colour: n === 0 ? 'vert' : RED.has(n) ? 'rouge' : 'noir', wins: list.map((b) => (covers(b, n) ? 1 : 0)), back })
        haptic(back > 0 ? 'success' : 'light')
        if (back > 0) sfx.win(back >= mine.reduce((t, b) => t + b.stake, 0) * 10)
        else sfx.lose()
        reactToResult('me', back >= mine.reduce((t, b) => t + b.stake, 0) * 10 ? 'bigwin' : back > 0 ? 'won' : 'lost')
        return res
      })
    }, left)
  }, [clock, ts?.number]) // eslint-disable-line react-hooks/exhaustive-deps
  // What the others put on a place of the cloth this round (theirs: everyone's but mine).
  const others = (b: { kind: string; number?: number; numbers?: number[] }) => {
    if (!table || !ts) return 0
    const k = keyOf(b)
    const all = ts.cloth.find((x) => keyOf(norm(x)) === k)?.stake ?? 0
    const me = ts.mine.find((x) => keyOf(norm(x)) === k)?.stake ?? 0
    return all - me
  }
  // The chips put down for this round at the table, paid now (backend sims/table.go).
  const place = async () => {
    if (!total || spinning) return
    if (sim.money < total) return setError(tr("Pas assez d'argent pour ces mises."))
    setPlacing(true)
    setError('')
    try {
      const res = await api.casinoTableBet(sim.id, list)
      sfx.chip()
      haptic('light')
      void act(tr("Table de l'Ivoire"), 'dice-5', 'casino', async () => res)
      await pull()
    } catch (e) {
      setError(errText(e))
    } finally {
      setPlacing(false)
    }
  }
  const list = Object.values(bets)
  const total = list.reduce((t, b) => t + b.stake, 0)
  const combos = list.filter((b) => b.numbers)
  const inCombo = new Set(combos.flatMap((b) => b.numbers!))

  // Put a stake down (one of the cloth's places, or numbers together); false if the cloth won't take it.
  const add = (next: Record<string, RouletteBet>, b: RouletteBet): boolean => {
    const k = keyOf(b)
    const sum = Object.values(next).reduce((t, x) => t + x.stake, 0)
    if (sum + b.stake > maxTotal) return (setError(tr('{0} Djai au plus sur le tapis.', { 0: nf(maxTotal) })), false)
    if (!next[k] && Object.keys(next).length >= maxBets) return (setError(tr('{maxBets} mises au plus.', { maxBets })), false)
    next[k] = { ...b, stake: (next[k]?.stake ?? 0) + b.stake }
    return true
  }
  const put = (b: Omit<RouletteBet, 'stake'>) => {
    if (spinning) return
    setResult(null)
    setError('')
    if (!stakeOK(chip, chips, maxTotal)) return setError(tr('Un jeton de {0} à {1} Djai.', { 0: nf(chips[0]), 1: nf(maxTotal) }))
    const next = { ...bets }
    if (!add(next, { ...b, stake: chip })) return
    haptic('light')
    sfx.chip()
    setBets(next)
  }
  // A number tapped: a plein, or the group the mode takes round it (the cheval: two taps side by side).
  const tapNumber = (n: number) => {
    if (mode === 'plein') return put({ kind: 'plein', number: n })
    if (mode === 'cheval') {
      if (pending === null || pending === n || !beside(pending, n)) return setPending(n)
      setPending(null)
      return put({ kind: 'cheval', numbers: [pending, n].sort((a, b) => a - b) })
    }
    put({ kind: mode, numbers: groupAt(mode, n) })
  }
  const voisins = () => {
    if (spinning) return
    setError('')
    const next = { ...bets }
    for (const v of VOISINS) if (!add(next, { kind: v.kind, numbers: v.numbers, stake: chip * v.units })) return
    sfx.chip()
    setBets(next)
  }
  const double = () => {
    if (spinning || !total) return
    if (total * 2 > maxTotal) return setError(tr('{0} Djai au plus sur le tapis.', { 0: nf(maxTotal) }))
    setBets(Object.fromEntries(list.map((b) => [keyOf(b), { ...b, stake: b.stake * 2 }])))
    sfx.chip()
  }

  const spin = async () => {
    if (!total || spinning) return
    if (sim.money < total) return setError(tr("Pas assez d'argent pour ces mises."))
    setSpinning(true)
    setResult(null)
    setError('')
    setPending(null)
    hold(sim.money)
    let res: ActionResult
    try {
      res = await api.roulette(sim.id, list)
    } catch (e) {
      setSpinning(false)
      hold(null)
      return setError(errText(e))
    }
    const data = res.outcome.data as RouletteSpin
    sfx.spin(SPIN_MS / 1000)
    setRolling(true)
    // Round the wheel five times and more, to the pocket at the top.
    const i = WHEEL.indexOf(data.number)
    setTurn((t) => {
      const base = t - (((t % 360) + 360) % 360)
      return base - 360 * 5 - i * STEP
    })
    await new Promise((r) => setTimeout(r, SPIN_MS))
    setResult(data)
    setSpinning(false)
    setRolling(false)
    setLast(bets)
    const h = [data.number, ...history].slice(0, 15)
    setHistory(h)
    try {
      localStorage.setItem(HISTORY, JSON.stringify(h))
    } catch {
      /* private mode: no history kept */
    }
    hold(null)
    haptic(data.back > 0 ? 'success' : 'light')
    if (data.back > 0) sfx.win(data.back >= total * 10)
    else sfx.lose()
    reactToResult('me', data.back >= total * 10 ? 'bigwin' : data.back > 0 ? 'won' : 'lost')
    void act(tr('Roulette'), 'dice-5', 'casino', async () => res)
  }

  const wonAt = (b: RouletteBet) => {
    if (!result) return false
    const i = list.findIndex((x) => keyOf(x) === keyOf(b))
    return i >= 0 && result.wins[i] > 0
  }
  const cell = (s: { kind: string; number?: number; label: string; bg?: string; span?: number }, extra = '') => {
    const isNumber = s.kind === 'plein'
    const b = bets[keyOf(s)]
    const hit = result && isNumber && s.number === result.number
    const grouped = isNumber && inCombo.has(s.number!)
    return (
      <button
        key={keyOf(s)}
        aria-label={isNumber ? tr('Le {number}', { number: s.number }) : s.label}
        className={`relative grid h-8 place-items-center rounded-[5px] text-[11px] font-extrabold text-white ${hit ? 'ring-2 ring-[#ffcc33]' : ''} ${b && wonAt(b) ? 'ring-2 ring-[#7cfc9a]' : ''} ${grouped && !hit ? 'outline-2 outline-offset-[-3px] outline-dashed outline-[#ffcc33]/80' : ''} ${pending === s.number && isNumber ? 'ring-2 ring-white' : ''} ${extra}`}
        style={{ background: s.bg ?? 'rgba(255,255,255,0.1)', gridColumn: s.span ? `span ${s.span}` : undefined }}
        onClick={() => (isNumber ? tapNumber(s.number!) : put({ kind: s.kind, number: s.number }))}
      >
        {s.label}
        {b && <Stack stake={b.stake} chip={chip} />}
        {/* The other players' chips there (the shared table) */}
        {table && others(s) > 0 && <span className="absolute -bottom-1 -left-1 rounded-full bg-[#9fd3ff] px-1 text-[8px] leading-[12px] font-extrabold text-[#06210f] shadow">{short(others(s))}</span>}
      </button>
    )
  }
  const rows = [3, 2, 1].map((r) => [...Array(12)].map((_, c) => c * 3 + r))
  const shown = table && ts ? (phase === 'resultat' ? [ts.number, ...ts.last] : ts.last) : history
  const reds = shown.filter((n) => RED.has(n)).length
  const zeros = shown.filter((n) => n === 0).length
  return (
    <div>
      {table && (
        // Who's at the table, and where the round is: the bets taken, « rien ne va plus », the number.
        <div className="mb-2 rounded-2xl bg-black/25 px-3 py-2 text-center">
          <div className="font-display text-[17px] font-extrabold">
            {!ts ? tr('Connexion à la table…') : phase === 'mises' ? tx('Faites vos jeux · {0} s', { 0: Math.max(0, Math.ceil((ts.spinAt - clock) / 1000)) }) : phase === 'tour' ? tr('Rien ne va plus !') : tx('Prochain tour dans {0} s', { 0: Math.max(0, Math.ceil((ts.nextAt - clock) / 1000)) })}
          </div>
          <div className="text-[11.5px] font-bold text-white/65">{ts?.players.length ? tx('À la table : {0}', { 0: ts.players.join(', ') }) : tr('Personne à la table pour l’instant : pose tes jetons, les autres te verront.')}</div>
        </div>
      )}
      {shown.length > 0 && (
        <div className="mb-2">
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {shown.map((n, i) => (
              <span key={i} className={`grid h-7 min-w-7 shrink-0 place-items-center rounded-full px-1 text-[12px] font-extrabold ${i === 0 ? 'ring-2 ring-[#ffcc33]' : ''}`} style={{ background: pocket(n) }}>
                {n}
              </span>
            ))}
          </div>
          <div className="mt-1 text-center text-[11px] font-bold text-white/55">
            {tx('Sur les {length} derniers : {reds} rouge{0}, {1} noir{2}, {zeros} zéro{3}. Chaque tour est neuf : le passé ne prédit rien.', { length: shown.length, reds, 0: reds > 1 ? 's' : '', 1: shown.length - reds - zeros, 2: shown.length - reds - zeros > 1 ? 's' : '', zeros, 3: zeros > 1 ? 's' : '' })}
          </div>
        </div>
      )}
      <Wheel turn={turn} spinning={rolling} />
      <div className="mt-2 grid h-12 place-items-center">
        {result ? (
          <div className="animate-pop flex items-center gap-2 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full font-display text-[18px] font-extrabold" style={{ background: pocket(result.number) }}>
              {result.number}
            </span>
            <span className="font-extrabold">{result.back > 0 ? <span className="text-[#ffcc33]">{tx('Tu récupères {0} Djai !', { 0: nf(result.back) })}</span> : tr('Rien pour toi ce tour-ci.')}</span>
          </div>
        ) : (
          <span className="text-[13px] font-bold text-white/70">
            {table && placed && phase === 'mises' ? tx('Tes {0} Djai sont sur le tapis. Rien ne va plus bientôt.', { 0: nf(ts!.mine.reduce((t, b) => t + b.stake, 0)) }) : table && phase !== 'mises' ? (phase === 'tour' ? tr('Rien ne va plus… la bille tourne.') : tr('Les mises reviennent au prochain tour.')) : spinning ? tr('Rien ne va plus… la bille tourne.') : mode === 'cheval' ? (pending !== null ? tr('Le {pending} : touche un numéro à côté.', { pending }) : tr('Touche deux numéros côte à côte.')) : table ? tr('Pose tes jetons, puis mise pour ce tour.') : tr('Pose tes jetons sur le tapis, puis lance.')}
          </span>
        )}
      </div>
      {/* How a number tap bets: alone, or with its neighbours. */}
      <div className="mb-1.5 flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`flex-1 rounded-full py-1.5 text-[11px] leading-tight font-extrabold ${mode === m.id ? 'bg-white text-[#0b3d26]' : 'bg-white/12'}`}
            onClick={() => (setMode(m.id), setPending(null))}
            disabled={spinning}
          >
            {m.label}
            <span className="block text-[9.5px] opacity-70">{tr('×')}{m.pays}</span>
          </button>
        ))}
      </div>
      {/* The cloth: the zero, the numbers in three rows, the columns; the dozens, the even chances */}
      <div className="rounded-[14px] border-2 border-[#d9a520]/60 bg-[#0d5c35] p-1.5">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: '26px repeat(12, minmax(0, 1fr)) 26px' }}>
          <div className="row-span-3 grid">{cell({ kind: 'plein', number: 0, label: '0', bg: pocket(0) }, '!h-full')}</div>
          {rows.map((row, ri) => (
            <div key={ri} className="contents">
              {row.map((n) => cell({ kind: 'plein', number: n, label: String(n), bg: pocket(n) }))}
              {cell({ kind: 'colonne', number: 3 - ri, label: '2:1' })}
            </div>
          ))}
        </div>
        <div className="mt-[3px] grid grid-cols-3 gap-[3px]">
          {cell({ kind: 'douzaine', number: 1, label: tr('1 à 12') })}
          {cell({ kind: 'douzaine', number: 2, label: tr('13 à 24') })}
          {cell({ kind: 'douzaine', number: 3, label: tr('25 à 36') })}
        </div>
        <div className="mt-[3px] grid grid-cols-6 gap-[3px]">
          {cell({ kind: 'manque', label: '1-18' })}
          {cell({ kind: 'pair', label: tr('Pair') })}
          {cell({ kind: 'rouge', label: '◆', bg: '#c8102e' })}
          {cell({ kind: 'noir', label: '◆', bg: '#1b1d21' })}
          {cell({ kind: 'impair', label: tr('Impair') })}
          {cell({ kind: 'passe', label: '19-36' })}
        </div>
      </div>
      {combos.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {combos.map((b) => (
            <button
              key={keyOf(b)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${wonAt(b) ? 'bg-[#7cfc9a] text-[#05301a]' : 'bg-black/30'}`}
              disabled={spinning}
              onClick={() => setBets(Object.fromEntries(list.filter((x) => keyOf(x) !== keyOf(b)).map((x) => [keyOf(x), x])))}
            >
              {NAMES[b.kind]} {b.numbers!.join('-')} · {short(b.stake)} ✕
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c}
            className={`grid h-11 flex-1 place-items-center rounded-full border-[3px] border-dashed text-[13px] font-extrabold ${chip === c ? 'border-white bg-[#ffcc33] text-[#5a1a00]' : 'border-white/50 bg-white/10'}`}
            onClick={() => setChip(c)}
          >
            {nf(c)}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <StakeField usual={chips} value={chip} onChange={setChip} max={maxTotal} label={tr('Ou tape ton jeton')} chips={false} disabled={spinning} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-white/80">
          {tx('Sur le tapis : {0} / {1} Djai', { 0: nf(total), 1: nf(maxTotal) })}
        </span>
        <button className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-extrabold disabled:opacity-40" disabled={spinning || chip * 9 > maxTotal - total} onClick={voisins}>
          {tx('Voisins du zéro · {0}', { 0: short(chip * 9) })}
        </button>
      </div>
      {error && <p className="mt-1 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      <div className="mt-2 flex gap-2">
        {total ? (
          <>
            <button className="rounded-full bg-white/15 px-3.5 py-2.5 text-[13px] font-extrabold disabled:opacity-50" disabled={spinning} onClick={() => (setBets({}), setResult(null), setPending(null))}>
              {tr('Effacer')}
            </button>
            <button className="rounded-full bg-white/15 px-3.5 py-2.5 text-[13px] font-extrabold disabled:opacity-50" disabled={spinning || total * 2 > maxTotal} onClick={double}>
              {tr('×2')}
            </button>
          </>
        ) : (
          <button className="rounded-full bg-white/15 px-3.5 py-2.5 text-[13px] font-extrabold disabled:opacity-40" disabled={spinning || !Object.keys(last).length} onClick={() => setBets(last)}>
            {tr('Remettre')}
          </button>
        )}
        <button className="btn flex-1 !py-2.5" style={{ background: 'linear-gradient(180deg,#ffe27a,#ff9f1a)', color: '#5a1a00' }} disabled={spinning || !total || sim.money < total} onClick={() => void (table ? place() : spin())}>
          {table ? (placed ? tr('Misé pour ce tour') : phase !== 'mises' ? tr('Attends le prochain tour') : tx('Miser pour ce tour · {0}', { 0: nf(total) })) : spinning ? tr('Rien ne va plus…') : result && Object.keys(last).length ? tr('Relancer · {0}', { 0: nf(total) }) : tr('Lancer la bille · {0}', { 0: nf(total) })}
        </button>
      </div>
      <RulesFold>
        {tr('Plein ×35 · cheval ×17 · transversale ×11 · carré ×8 · sixain ×5 · douzaine et colonne ×2 · rouge, noir, pair, impair, 1-18, 19-36 ×1. Le zéro gagne pour la banque.')}
        {/* At a rate the team set (lib/casino.ts), the house's commission on the net winnings, by bet (the server's game.RouletteCommission). */}
        {rr?.set && rr.rate < 36 / 37 ? tr(' Taux de retour {0} : la maison garde une commission sur le gain net, de {1} sur un plein à {2} sur les chances simples.', { 0: pct(rr.rate), 1: pct(commission(rr.rate, 35)), 2: pct(commission(rr.rate, 1)) }) : tr(' Taux de retour {0}.', { 0: pct(36 / 37) })}
      </RulesFold>
      <GameHistory simId={sim.id} jeu={table ? 'table' : 'roulette'} tick={result} />
    </div>
  )
}
