import { useEffect, useMemo, useState } from 'react'
import { Check, Shirt, Sparkles } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { forGender, wearPiece } from '../lib/clothes'
import type { ActionResult, ClothingPiece, Sim, World } from '../lib/types'
import { fullLook } from '../avatar/options'
import { Portrait } from '../avatar/portrait'
import { amount } from '../game/rules'
import { Chip } from './ui'
import { ClothesShop } from './ClothesShop'

// The phone's Boutique, its clothes (backend game/clothes.go), in Djai: the
// exclusive collection « Babi Life Édition » (only here), the lots (several
// pieces at once, a quarter off), and the whole catalogue of the boutiques,
// bought from the phone. Tried on in the mirror (ClothesShop), kept in the
// wardrobe.

/** Mirrors game.PackPrice: three quarters of the pieces' prices, to the 500 Djai. */
const packPrice = (pieces: ClothingPiece[]) => Math.floor((Math.floor((pieces.reduce((s, p) => s + p.price, 0) * 3) / 4) + 250) / 500) * 500

export function BoutiqueClothes({ world, sim, onResult }: { world: World; sim: Sim; onResult: (r: ActionResult) => void }) {
  const [owned, setOwned] = useState<string[]>([])
  const [shop, setShop] = useState<'exclu' | 'all' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const load = () => api.clothes(sim.id).then((r) => setOwned(r.owned), () => undefined)
  useEffect(() => void load(), [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => forGender(world.clothes ?? [], sim.gender), [world.clothes, sim.gender])
  const exclu = mine.filter((p) => p.shop === 'exclu')
  const look = fullLook(sim.look)
  const packs = (world.clothingPacks ?? []).map((pk) => {
    const all = pk.pieces.map((id) => mine.find((p) => p.id === id)).filter((p): p is ClothingPiece => !!p)
    const left = all.filter((p) => !owned.includes(p.id))
    return { pk, all, left, price: packPrice(left), full: all.reduce((s, p) => s + p.price, 0) }
  })

  const buyPack = async (id: string) => {
    setBusy(id)
    setSaid(null)
    try {
      const r = await api.buyClothingPack(sim.id, id)
      onResult(r)
      if (r.outcome?.text) setSaid({ tone: 'ok', text: r.outcome.text })
      void load()
    } catch (e) {
      setSaid({ tone: 'error', text: e instanceof ApiError ? e.message : 'Pas de réseau' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* The exclusive collection: the stars' pieces, only here. */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label flex items-center gap-1">
            <Sparkles size={13} /> Babi Life Édition
          </span>
          <button className="text-[12px] font-extrabold text-[var(--color-orange)]" onClick={() => setShop('exclu')}>
            Essayer
          </button>
        </div>
        <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1">
          {exclu.map((p) => (
            <button key={p.id} onClick={() => setShop('exclu')} className="relative w-[112px] shrink-0 overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_50%_10%,#fff3c4,#f2b705_55%,#a86800)] text-left shadow-[0_8px_18px_-10px_rgba(0,0,0,0.5)]">
              <span className="block aspect-[3/4] w-full">
                <Portrait look={wearPiece(look, p)} gender={sim.gender} framing={p.kind === 'accessoire' ? 'bust' : 'full'} />
              </span>
              <span className="block bg-white/90 px-2 py-1.5">
                <span className="line-clamp-2 block text-[11px] leading-tight font-extrabold">{p.label}</span>
                <span className="mt-0.5 block text-[11px] font-extrabold text-[#a86800]">{owned.includes(p.id) ? 'À toi' : `${amount(p.price)} Djai`}</span>
              </span>
              {owned.includes(p.id) && (
                <span className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-emerald)] text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* The lots: several pieces, a quarter off, only those one doesn't have. */}
      <div>
        <div className="label mb-1.5">Les lots · −25 %</div>
        <ul className="space-y-2">
          {packs.map(({ pk, all, left, price, full }) => (
            <li key={pk.id} className="card p-3">
              <div className="font-display text-[16px] leading-tight font-extrabold">{pk.label}</div>
              <div className="text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{pk.about}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex min-w-0 flex-1 gap-1 overflow-hidden">
                  {all.slice(0, 5).map((p) => (
                    <span key={p.id} className={`block h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-[#fff4e0] to-[#ffd29a] ${owned.includes(p.id) ? 'opacity-40' : ''}`}>
                      <Portrait look={wearPiece(look, p)} gender={sim.gender} framing={p.kind === 'accessoire' ? 'bust' : 'full'} />
                    </span>
                  ))}
                </span>
                <span className="shrink-0 text-right">
                  <button className="btn !px-3 !py-2 !text-sm" disabled={!left.length || !!busy || sim.money < price} onClick={() => void buyPack(pk.id)}>
                    {left.length ? (busy === pk.id ? '…' : `${amount(price)} Djai`) : <Check size={16} />}
                  </button>
                  <span className="mt-0.5 block text-[10.5px] font-extrabold text-[var(--color-ink-soft)]">
                    {left.length ? `${left.length} pièce${left.length > 1 ? 's' : ''}` : 'Tout est à toi'}
                    {left.length === all.length && left.length > 0 && <s className="ml-1 opacity-60">{amount(full)}</s>}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button className="flex w-full items-center gap-3 rounded-2xl bg-[var(--color-canvas)] p-3 text-left" onClick={() => setShop('all')}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-orange)] text-white">
          <Shirt size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-extrabold">Tout le catalogue</span>
          <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">
            {mine.length} pièces, essayées dans le miroir, livrées dans ta garde-robe
          </span>
        </span>
        <Chip>{owned.length} à toi</Chip>
      </button>

      {said && <p className={`rounded-xl px-3 py-2 text-sm font-bold ${said.tone === 'error' ? 'bg-[#ffeef1] text-[#d81b3f]' : 'bg-[#e9f9ef] text-[#1b7a43]'}`}>{said.text}</p>}

      {shop && <ClothesShop world={world} sim={sim} shop={shop} onResult={(r) => (onResult(r), void load())} onClose={() => (setShop(null), void load())} onLeave={() => setShop(null)} />}
    </div>
  )
}
