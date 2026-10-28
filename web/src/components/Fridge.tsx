import { useEffect, useState } from 'react'
import { Minus, Plus, Refrigerator, X } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, Grocery, Sim, World } from '../lib/types'
import { amount } from '../game/rules'
import { iconFor } from './icons'
import { Sheet } from './Sheet'
import { Coin } from './ui'

// The fridge of one's house (backend sims/fridge.go): filled while doing the
// shopping at the market or the supermarket (« fill »: what's sold for it, and
// how much room is left), and opened at home (« open »: what's in it, a tap
// to eat or drink one, done as an activity at the table or at its door).

const NEEDS: Record<string, string> = { hunger: 'Faim', energy: 'Énergie', fun: 'Moral', social: 'Social', hygiene: 'Hygiène' }

/** What eating it does, in short: « Faim +45 · Moral +4 ». */
const does = (g: Grocery) =>
  Object.entries(g.effect)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${NEEDS[k] ?? k} +${v}`)
    .join(' · ')

export function FridgeSheet({ world, sim, how, onResult, onClose, onStarted }: { world: World; sim: Sim; how: 'fill' | 'open'; onResult: (r: ActionResult) => void; onClose: () => void; /** Something taken out to eat: the activity has started (the Sim goes to do it in the house). */ onStarted?: () => void }) {
  const groceries = world.groceries ?? []
  const [stock, setStock] = useState<Record<string, number> | null>(null)
  const [room, setRoom] = useState(0)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [count, setCount] = useState<Record<string, number>>({})
  const load = () =>
    api
      .fridge(sim.id)
      .then((r) => (setStock(r.stock), setRoom(r.room)))
      .catch(() => setSaid({ tone: 'error', text: 'Le frigo ne charge pas. Réessaie.' }))
  useEffect(() => void load(), [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const inside = stock ? Object.values(stock).reduce((a, b) => a + b, 0) : 0
  const left = Math.max(0, room - inside)

  async function run(f: () => Promise<ActionResult>, close = false) {
    setBusy(true)
    setSaid(null)
    try {
      const r = await f()
      onResult(r)
      if (close) return (onStarted?.(), onClose())
      if (r.outcome?.text) setSaid({ tone: 'ok', text: r.outcome.text })
      await load()
    } catch (e) {
      setSaid({ tone: 'error', text: errorText(e, 'Erreur') })
    } finally {
      setBusy(false)
    }
  }
  const list = how === 'fill' ? groceries : groceries.filter((g) => (stock?.[g.id] ?? 0) > 0)

  return (
    <Sheet onClose={onClose} z="z-50" className="max-h-[82dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:w-[460px]">
      {(close) => (
        <>
          <div className="mb-2 flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(#e9f6ff,#bfe3f7)] text-[#1c6fd6]">
              <Refrigerator size={26} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[22px] leading-tight font-extrabold">{how === 'fill' ? 'Remplir le frigo' : 'Ton frigo'}</div>
              <div className="text-xs font-bold text-[var(--color-ink-soft)]">{stock === null ? '…' : room ? `${inside} sur ${room} places · ${how === 'fill' ? `encore ${left}` : 'sers-toi'}` : 'Pas de frigo chez toi'}</div>
            </div>
            <button className="icon-btn bg-[var(--color-canvas)]" onClick={close} aria-label="Fermer">
              <X size={20} strokeWidth={2.6} />
            </button>
          </div>
          {how === 'fill' && (
            <div className="mb-2 flex items-center gap-1.5 text-sm font-extrabold">
              <Coin size={22} /> {amount(sim.money)} Djai
            </div>
          )}
          {stock !== null && !room && <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold">Pose un frigo dans ta maison (« Construire ma maison », Meubles, Cuisine) pour garder des choses au frais.</p>}
          {stock !== null && room > 0 && !list.length && <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold">Le frigo est vide. Remplis-le en faisant le marché ou les courses au supermarché.</p>}
          {room > 0 && (
            <ul className="grid gap-1.5">
              {list.map((g) => {
                const Icon = iconFor(g.icon)
                const n = Math.max(1, Math.min(count[g.id] ?? 1, left))
                const has = stock?.[g.id] ?? 0
                return (
                  <li key={g.id} className="flex items-center gap-2.5 rounded-2xl bg-[var(--color-canvas)] p-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#1c6fd6]">
                      <Icon size={20} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] leading-tight font-extrabold">{g.label}</span>
                      <span className="block truncate text-[11px] font-bold text-[var(--color-ink-soft)]">
                        {how === 'fill' ? `${amount(g.price)} Djai · ` : ''}
                        {does(g)}
                        {has ? ` · ${has} au frigo` : ''}
                      </span>
                    </span>
                    {how === 'fill' ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button className="grid h-8 w-8 place-items-center rounded-full bg-white disabled:opacity-40" disabled={n <= 1} onClick={() => setCount((c) => ({ ...c, [g.id]: n - 1 }))} aria-label="Un de moins">
                          <Minus size={14} strokeWidth={3} />
                        </button>
                        <span className="tnum w-5 text-center text-sm font-extrabold">{n}</span>
                        <button className="grid h-8 w-8 place-items-center rounded-full bg-white disabled:opacity-40" disabled={n >= left} onClick={() => setCount((c) => ({ ...c, [g.id]: n + 1 }))} aria-label="Un de plus">
                          <Plus size={14} strokeWidth={3} />
                        </button>
                        <button className="btn ml-1 !px-3 !py-1.5 !text-xs" disabled={busy || !left || sim.money < g.price * n} onClick={() => void run(() => api.fillFridge(sim.id, g.id, n))}>
                          {sim.money < g.price * n ? 'Trop cher' : `${amount(g.price * n)}`}
                        </button>
                      </span>
                    ) : (
                      <button className="btn shrink-0 !px-3 !py-1.5 !text-xs" disabled={busy || !!sim.activity} onClick={() => void run(() => api.eatFromFridge(sim.id, g.id), true)}>
                        {g.drink ? 'Boire' : 'Manger'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {how === 'open' && sim.activity && <p className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">Finis d'abord ce que tu fais.</p>}
          {said && (
            <p className={`mt-2 text-sm font-bold ${said.tone === 'error' ? 'text-[#d81b3f]' : 'text-[var(--color-emerald)]'}`} role="status">
              {said.text}
            </p>
          )}
        </>
      )}
    </Sheet>
  )
}
