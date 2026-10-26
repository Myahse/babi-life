import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ChevronLeft, CircleDot, Plane, Spade, Ticket, TrendingUp } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { haptic } from '../lib/native'
import { useSession } from '../store/session'
import type { ActionResult, ScratchResult, ScratchTicket, Sim, World } from '../lib/types'
import type { Act } from './phoneApps'
import { Blackjack } from './casino/Blackjack'
import { Envol } from './casino/Envol'
import { Roulette } from './casino/Roulette'
import { Trade } from './casino/Trade'

/**
 * Babi Casino (backend game/casino.go, sims/casino.go): the roulette with its
 * one zero, le 21 against the bank, the tickets à gratter, L'Envol and Babi
 * Trade (casino/Roulette.tsx, casino/Blackjack.tsx, casino/Envol.tsx,
 * casino/Trade.tsx; the tickets here). Every round is
 * drawn on the server and paid at once; the app shows it (the wheel turning,
 * the cards dealt, the silver scratched) and then tells the game. The game's
 * money only, adults only, a number of rounds a day.
 */

const nf = (n: number) => n.toLocaleString('fr-FR')
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? 'Hors ligne' : e instanceof Error ? e.message : 'Erreur')
type Props = { world: World; sim: Sim; act: Act; /** While a round is shown (the wheel turning, a ticket under its silver): the money as it was, so a sync doesn't tell the result first. */ hold: (money: number | null) => void }

export function CasinoApp({ world, sim, act, onConfirmAdult }: Omit<Props, 'hold'> & { onConfirmAdult: () => Promise<void> }) {
  const adult = useSession((s) => !!s.user?.adult)
  const [table, setTable] = useState<'roulette' | '21' | 'grattage' | 'envol' | 'trade' | null>(null)
  const [held, hold] = useState<number | null>(null)
  const roundsLeft = (world.casino?.perDay ?? 300) - (sim.today?.casino?.times ?? 0)
  const shell = '-mx-3 -mt-1 min-h-full p-3 pb-6 text-white'
  const bg = { background: 'radial-gradient(circle at 50% 0%, #1f7a4d, #0b3d26 55%, #06210f)' }
  if (!adult)
    return (
      <div className={shell} style={bg}>
        <Brand />
        <div className="mt-4 rounded-2xl bg-black/25 p-4 text-sm font-bold">
          <p>Babi Casino est réservé aux joueurs de 18 ans et plus. On y joue avec l'argent du jeu seulement.</p>
          <button className="btn mt-3 w-full !py-2" onClick={() => void onConfirmAdult()}>
            J’ai 18 ans ou plus
          </button>
        </div>
      </div>
    )
  const back = (title: string) => (
    <div className="mb-3 flex items-center gap-2">
      <button className="icon-btn bg-white/15 text-white" onClick={() => setTable(null)} aria-label="Retour au casino">
        <ChevronLeft size={22} />
      </button>
      <div className="min-w-0 flex-1 font-display text-[22px] font-extrabold">{title}</div>
      <span className="rounded-full bg-black/30 px-2.5 py-1 text-[13px] font-extrabold">{nf(held ?? sim.money)} Djai</span>
    </div>
  )
  if (table === 'roulette')
    return (
      <div className={shell} style={bg}>
        {back('La roulette')}
        <Roulette world={world} sim={sim} act={act} hold={hold} />
      </div>
    )
  if (table === '21')
    return (
      <div className={shell} style={bg}>
        {back('Le 21')}
        <Blackjack world={world} sim={sim} act={act} hold={hold} />
      </div>
    )
  if (table === 'grattage')
    return (
      <div className={shell} style={bg}>
        {back('Tickets à gratter')}
        <Scratch world={world} sim={sim} act={act} hold={hold} />
      </div>
    )
  if (table === 'envol')
    return (
      <div className={shell} style={bg}>
        {back("L'Envol")}
        <Envol world={world} sim={sim} act={act} />
      </div>
    )
  if (table === 'trade')
    return (
      <div className={shell} style={{ background: 'radial-gradient(circle at 50% 0%, #1d3b7a, #0b1530 55%, #050a1a)' }}>
        {back('Babi Trade')}
        <Trade world={world} sim={sim} act={act} />
      </div>
    )
  const tiles = [
    { id: 'roulette' as const, title: 'La roulette', text: 'Le rouge, le noir, ton numéro plein payé 35 fois. Un seul zéro.', icon: CircleDot, colours: ['#e5383b', '#7a0f1f'] },
    { id: '21' as const, title: 'Le 21', text: 'Contre la banque : approche 21 sans le dépasser. Blackjack payé 3 pour 2.', icon: Spade, colours: ['#2b2f45', '#0f1222'] },
    { id: 'grattage' as const, title: 'Tickets à gratter', text: 'Pinda, Akwaba, Super Banco : trois fois la même somme, tu la gagnes.', icon: Ticket, colours: ['#ffcc33', '#d98a00'] },
    { id: 'envol' as const, title: "L'Envol", text: "L'avion décolle, le multiplicateur monte : encaisse avant qu'il parte !", icon: Plane, colours: ['#ff5a7a', '#8a1238'] },
    { id: 'trade' as const, title: 'Babi Trade', text: 'Cacao, café, or : hausse ou baisse dans 30 s ? Un jeu de hasard, pas du trading.', icon: TrendingUp, colours: ['#3d8bff', '#16307a'] },
  ]
  return (
    <div className={shell} style={bg}>
      <Brand />
      <div className="mt-3 grid gap-2.5">
        {tiles.map((t) => (
          <button key={t.id} className="flex items-center gap-3 rounded-[22px] bg-white/10 p-3 text-left shadow-[0_3px_0_rgba(0,0,0,0.25)] transition active:scale-[0.98]" onClick={() => setTable(t.id)}>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px]" style={{ background: `linear-gradient(160deg, ${t.colours[0]}, ${t.colours[1]})` }}>
              <t.icon size={28} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[19px] font-extrabold">{t.title}</span>
              <span className="block text-[12.5px] leading-snug font-bold text-white/75">{t.text}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-[11.5px] leading-snug font-bold text-white/60">
        Argent du jeu seulement · 18 ans et plus · encore {Math.max(0, roundsLeft)} tours aujourd'hui.
        <br />
        La roulette rend 36 pour 37 misés, le 21 un peu moins que ce qu'on mise, les tickets environ deux tiers de leur prix, L'Envol 95 %, Babi Trade 92,5 %.
      </p>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#ffcc33] text-[#0b3d26]">
        <Spade size={24} strokeWidth={2.6} />
      </span>
      <div>
        <div className="font-display text-[24px] leading-none font-extrabold text-[#ffcc33]">Babi Casino</div>
        <div className="text-[12px] font-bold text-white/75">Roulette, 21, tickets, Envol et Trade</div>
      </div>
    </div>
  )
}

/* ---------- Les tickets à gratter ---------- */

const TICKET_LOOK: Record<string, [string, string]> = {
  pinda: ['#7cd957', '#2f8f2f'],
  akwaba: ['#ff8a3d', '#d93f0b'],
  banco: ['#c08bff', '#6a1ee0'],
}

function Scratch({ world, sim, act, hold }: Props) {
  const tickets = world.casino?.tickets ?? []
  const [bought, setBought] = useState<{ res: ActionResult; data: ScratchResult; t: ScratchTicket } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buy = async (t: ScratchTicket) => {
    setBusy(true)
    setError('')
    try {
      hold(sim.money - t.price)
      const res = await api.scratch(sim.id, t.id)
      setBought({ res, data: res.outcome.data as ScratchResult, t })
      setRevealed(false)
    } catch (e) {
      hold(null)
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }
  // Left with its silver on (back to the casino): the money as it is.
  useEffect(() => () => hold(null), []) // eslint-disable-line react-hooks/exhaustive-deps
  const reveal = () => {
    if (!bought || revealed) return
    setRevealed(true)
    hold(null)
    haptic(bought.data.prize > 0 ? 'success' : 'light')
    const text = bought.data.prize > 0 ? `Ticket ${bought.t.name} : tu gagnes ${nf(bought.data.prize)} Djai !` : `Ticket ${bought.t.name} : perdu.`
    void act(`Ticket ${bought.t.name}`, 'dice-5', 'casino', async () => ({ ...bought.res, outcome: { ...bought.res.outcome, text } }))
  }
  if (bought)
    return (
      <div>
        <ScratchCard key={bought.res.sim.money + bought.data.cells.join()} t={bought.t} data={bought.data} revealed={revealed} onReveal={reveal} />
        {revealed ? (
          <>
            <div className={`animate-pop mt-3 rounded-2xl p-3 text-center font-display text-[20px] font-extrabold ${bought.data.prize > 0 ? 'bg-[#ffcc33] text-[#5a1a00]' : 'bg-black/30'}`}>
              {bought.data.prize > 0 ? `Gagné : ${nf(bought.data.prize)} Djai !` : 'Pas de chance cette fois.'}
            </div>
            <div className="mt-2 flex gap-2">
              <button className="rounded-full bg-white/15 px-4 py-2.5 text-[14px] font-extrabold" onClick={() => setBought(null)}>
                Autre ticket
              </button>
              <button className="btn flex-1 !py-2.5" disabled={busy || sim.money < bought.t.price} onClick={() => void buy(bought.t)}>
                Rejouer · {nf(bought.t.price)}
              </button>
            </div>
          </>
        ) : (
          <button className="mt-3 w-full rounded-full bg-white/15 py-2.5 text-[14px] font-extrabold" onClick={reveal}>
            Tout gratter
          </button>
        )}
        {error && <p className="mt-2 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      </div>
    )
  return (
    <div className="grid gap-2.5">
      {tickets.map((t) => {
        const [a, b] = TICKET_LOOK[t.id] ?? ['#ffcc33', '#d98a00']
        const top = t.prizes[t.prizes.length - 1].amount
        const odds = t.prizes.reduce((k, p) => k + 1 / p.odds, 0)
        return (
          <button key={t.id} className="relative overflow-hidden rounded-[22px] p-3 text-left shadow-[0_3px_0_rgba(0,0,0,0.25)] transition active:scale-[0.98] disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} disabled={busy || sim.money < t.price} onClick={() => void buy(t)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-[24px] leading-none font-extrabold">{t.name}</div>
                <div className="mt-1 text-[12.5px] leading-snug font-bold text-white/90">{t.about}</div>
              </div>
              <span className="rounded-full bg-black/25 px-2.5 py-1 text-[14px] font-extrabold whitespace-nowrap">{nf(t.price)} Djai</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-extrabold">
              <span className="rounded-full bg-white px-2 py-0.5 text-[#5a1a00]">Gros lot {nf(top)}</span>
              <span className="rounded-full bg-black/25 px-2 py-0.5">1 ticket sur {Math.round(1 / odds)} gagne</span>
            </div>
          </button>
        )
      })}
      {error && <p className="text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
    </div>
  )
}

/** A ticket: its nine amounts under a silver coat, scratched with a finger (or a mouse). */
function ScratchCard({ t, data, revealed, onReveal }: { t: ScratchTicket; data: ScratchResult; revealed: boolean; onReveal: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const down = useRef(false)
  const strokes = useRef(0)
  const [a, b] = TICKET_LOOK[t.id] ?? ['#ffcc33', '#d98a00']
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    c.width = Math.round(r.width * 2)
    c.height = Math.round(r.height * 2)
    const grad = g.createLinearGradient(0, 0, c.width, c.height)
    grad.addColorStop(0, '#d7dbe2')
    grad.addColorStop(0.5, '#a9afba')
    grad.addColorStop(1, '#cfd3da')
    g.fillStyle = grad
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.font = `800 ${c.width / 14}px system-ui, sans-serif`
    g.textAlign = 'center'
    for (let y = 1; y <= 3; y++) g.fillText('GRATTE ICI', c.width / 2, (c.height * y) / 3.6)
  }, [])
  const scratch = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!down.current || revealed) return
    const c = canvas.current!
    const g = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * c.width
    const y = ((e.clientY - r.top) / r.height) * c.height
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.arc(x, y, c.width / 14, 0, Math.PI * 2)
    g.fill()
    // Now and then, how much is scratched: past half, the rest falls off.
    if (++strokes.current % 12 === 0) {
      const px = g.getImageData(0, 0, c.width, c.height).data
      let clear = 0
      let n = 0
      for (let i = 3; i < px.length; i += 4 * 16) {
        n++
        if (px[i] === 0) clear++
      }
      if (clear / n > 0.5) onReveal()
    }
  }
  const counts = data.cells.reduce<Record<number, number>>((m, v) => ((m[v] = (m[v] ?? 0) + 1), m), {})
  return (
    <div className="rounded-[22px] p-3 shadow-[0_4px_0_rgba(0,0,0,0.3)]" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-[22px] font-extrabold">{t.name}</span>
        <span className="text-[12px] font-extrabold text-white/85">3 fois la même somme = gagné</span>
      </div>
      <div className="relative">
        <div className="grid grid-cols-3 gap-2 rounded-[16px] bg-[#fffaf0] p-2">
          {data.cells.map((v, i) => (
            <div key={i} className={`grid h-[72px] place-items-center rounded-[12px] text-center font-display text-[17px] leading-tight font-extrabold ${revealed && counts[v] >= 3 ? 'bg-[#ffcc33] text-[#5a1a00]' : 'bg-white text-[#1b1d21]'}`}>
              {nf(v)}
              <span className="block text-[10px] font-bold text-[#8a8fa3]">Djai</span>
            </div>
          ))}
        </div>
        <canvas
          ref={canvas}
          className={`absolute inset-0 h-full w-full touch-none rounded-[16px] transition-opacity duration-500 ${revealed ? 'pointer-events-none opacity-0' : ''}`}
          onPointerDown={(e) => ((down.current = true), e.currentTarget.setPointerCapture(e.pointerId), scratch(e))}
          onPointerMove={scratch}
          onPointerUp={() => (down.current = false)}
          onPointerCancel={() => (down.current = false)}
        />
      </div>
    </div>
  )
}
