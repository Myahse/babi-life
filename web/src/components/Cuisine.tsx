import { useState } from 'react'
import { ChefHat, Minus, Plus, Users } from 'lucide-react'
import type { Sim, World } from '../lib/types'
import { amount } from '../game/rules'
import { ingredientPrice } from '../game/cuisine'
import { iconFor } from './icons'
import { t } from '../lib/i18n'

// La cuisine ivoirienne at home (backend game/cuisine.go, sims/cuisine.go): the ingredients bought at
// the market for the fridge (« fill », at a market only), and in the open fridge what's there to cook
// with, the recipes, what each one lacks, and the plate shared with the house.

const NEEDS: Record<string, string> = { hunger: t('Faim'), energy: t('Énergie'), fun: t('Moral'), social: t('Social'), hygiene: t('Hygiène') }
const does = (e: Partial<Record<string, number>>) =>
  Object.entries(e)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${NEEDS[k] ?? k} +${v}`)
    .join(' · ')

/** At the market: the ingredients, to buy for the fridge (at this market's price). */
export function MarketIngredients({ world, sim, left, busy, onBuy }: { world: World; sim: Sim; left: number; busy: boolean; onBuy: (id: string, n: number) => void }) {
  const [count, setCount] = useState<Record<string, number>>({})
  const list = world.cuisine?.ingredients ?? []
  const where = sim.activity?.placeId
  const cheap = !!where && !!world.cuisine?.bigMarkets.includes(where)
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">
        <ChefHat size={14} strokeWidth={2.6} /> {t('Pour cuisiner à la maison')}
      </div>
      {cheap && <p className="mt-1 text-xs font-bold text-[var(--color-emerald)]">{t('Grand marché : les ingrédients sont moins chers ici.')}</p>}
      <ul className="mt-1.5 grid grid-cols-1 gap-1.5">
        {list.map((g) => {
          const Icon = iconFor(g.icon)
          const price = ingredientPrice(world, g.price, where)
          const n = Math.max(1, Math.min(count[g.id] ?? 1, left))
          return (
            <li key={g.id} className="flex items-center gap-2.5 rounded-2xl bg-[#fff4e8] p-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#e8590c]">
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-tight font-extrabold">{g.label}</span>
                <span className="block text-[11px] font-bold text-[var(--color-ink-soft)]">{t('{0} Djai', { 0: amount(price) })}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button className="grid h-8 w-8 place-items-center rounded-full bg-white disabled:opacity-40" disabled={n <= 1} onClick={() => setCount((c) => ({ ...c, [g.id]: n - 1 }))} aria-label={t('Un de moins')}>
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="tnum w-5 text-center text-sm font-extrabold">{n}</span>
                <button className="grid h-8 w-8 place-items-center rounded-full bg-white disabled:opacity-40" disabled={n >= left} onClick={() => setCount((c) => ({ ...c, [g.id]: n + 1 }))} aria-label={t('Un de plus')}>
                  <Plus size={14} strokeWidth={3} />
                </button>
                <button className="btn ml-1 !px-3 !py-1.5 !text-xs" disabled={busy || !left || sim.money < price * n} onClick={() => onBuy(g.id, n)}>
                  {sim.money < price * n ? t('Trop cher') : amount(price * n)}
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** In the open fridge: the ingredients there, the recipes (what each lacks), cooked and shared. */
export function HomeKitchen({ world, sim, stock, onCook }: { world: World; sim: Sim; stock: Record<string, number>; onCook: (recipe: string, share: boolean) => void }) {
  const [share, setShare] = useState(true)
  const c = world.cuisine
  if (!c) return null
  const label = (id: string) => c.ingredients.find((g) => g.id === id)?.label ?? id
  const have = c.ingredients.filter((g) => (stock[g.id] ?? 0) > 0)
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">
        <ChefHat size={14} strokeWidth={2.6} /> {t('Cuisiner')}
      </div>
      <p className="mt-1 text-xs font-bold text-[var(--color-ink-soft)]">{have.length ? have.map((g) => `${stock[g.id]} × ${g.label}`).join(' · ') : t('Pas d’ingrédients : achète-les au marché (« Faire le marché »).')}</p>
      <button className={`mt-2 flex w-full items-center gap-2 rounded-2xl p-2 text-left text-[13px] font-extrabold ${share ? 'bg-[#e6fcf5] text-[#087f5b]' : 'bg-[var(--color-canvas)]'}`} onClick={() => setShare((v) => !v)} aria-pressed={share}>
        <Users size={18} strokeWidth={2.6} />
        <span className="flex-1">{share ? t('Partager le plat avec la maison : oui (Social +20)') : t('Partager le plat avec la maison : non')}</span>
      </button>
      <ul className="mt-1.5 grid grid-cols-1 gap-1.5">
        {c.recipes.map((r) => {
          const Icon = iconFor(r.icon)
          const missing = Object.entries(r.needs).filter(([id, n]) => (stock[id] ?? 0) < n)
          return (
            <li key={r.id} className="flex items-center gap-2.5 rounded-2xl bg-[var(--color-canvas)] p-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#e8590c]">
                <Icon size={20} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-tight font-extrabold">{r.name}</span>
                <span className="block text-[11px] leading-snug font-bold text-[var(--color-ink-soft)]">{missing.length ? t('Il manque : {list}', { list: missing.map(([id, n]) => (n - (stock[id] ?? 0) > 1 ? `${n - (stock[id] ?? 0)} × ${label(id)}` : label(id))).join(', ') }) : does(r.effect)}</span>
              </span>
              <button className="btn shrink-0 !px-3 !py-1.5 !text-xs" disabled={!!missing.length || !!sim.activity} onClick={() => onCook(r.id, share)}>
                {t('Cuisiner')}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
