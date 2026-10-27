import { useEffect, useMemo, useState } from 'react'
import { Check, ShoppingBag, X } from 'lucide-react'
import { api } from '../lib/api'
import { forGender, wearPiece, wearing } from '../lib/clothes'
import type { ActionResult, ClothingPiece, Sim, World } from '../lib/types'
import { fullLook } from '../avatar/options'
import { Portrait } from '../avatar/portrait'
import { Stage } from '../avatar/Stage'
import { Chip } from './ui'
import { amount } from '../game/rules'

// In the boutique (« Faire les boutiques » at the centre, the wax sellers of
// the market): the pieces of the shop on their rails, by brand. A tap tries
// one on (the Sim turns in the mirror); buy it, and it goes to the wardrobe,
// or put on one already bought.

const SHOP_NAME = { mall: 'Les boutiques du centre', marche: 'Les vendeuses de wax', exclu: 'Babi Life Édition', all: 'Tout le catalogue' }

export function ClothesShop({ world, sim, shop, onResult, onClose, onLeave }: { world: World; sim: Sim; /** A shop of the game, or from the phone's Boutique: the exclusive collection, or every piece (« all »). */ shop: ClothingPiece['shop'] | 'all'; onResult: (r: ActionResult) => void; onClose: () => void; onLeave: () => void }) {
  // From the phone (the exclusive collection, the whole catalogue), bought without walking to the shop.
  const app = shop === 'exclu' || shop === 'all'
  const pieces = useMemo(() => forGender(world.clothes ?? [], sim.gender).filter((p) => shop === 'all' || p.shop === shop), [world.clothes, sim.gender, shop])
  const brands = useMemo(() => [...new Set(pieces.map((p) => p.brand))], [pieces])
  const [brand, setBrand] = useState<string | null>(null)
  const [owned, setOwned] = useState<string[]>([])
  const [tried, setTried] = useState<ClothingPiece | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  useEffect(() => {
    api.clothes(sim.id).then((r) => setOwned(r.owned)).catch(() => {})
  }, [sim.id])
  const look = fullLook(sim.look)
  const shown = tried ? wearPiece(look, tried) : look
  const list = brand ? pieces.filter((p) => p.brand === brand) : pieces
  const has = tried ? owned.includes(tried.id) : false
  const on = tried ? wearing(sim.look, tried) : false

  async function run(f: () => Promise<ActionResult>, after?: () => void) {
    setBusy(true)
    setSaid(null)
    try {
      const r = await f()
      onResult(r)
      after?.()
      if (r.outcome?.text) setSaid({ tone: 'ok', text: r.outcome.text })
    } catch (e) {
      setSaid({ tone: 'error', text: e instanceof Error ? e.message : 'Erreur' })
    } finally {
      setBusy(false)
    }
  }
  const buy = (p: ClothingPiece) => run(() => api.buyPiece(sim.id, p.id, app), () => setOwned((o) => [...o, p.id]))
  const putOn = (p: ClothingPiece) => run(() => api.changeLook(sim.id, wearPiece(look, p)))

  return (
    <div className="animate-up fixed inset-0 z-50 flex flex-col bg-[var(--color-night)] lg:flex-row">
      <section className="relative flex min-h-[40%] flex-1 flex-col overflow-hidden bg-[radial-gradient(110%_90%_at_50%_15%,#fff4e0_0%,#ffd29a_45%,#ff9e6b_80%,#d9677a_100%)]">
        <Stage look={shown} gender={sim.gender} focus={tried?.kind === 'accessoire' ? 'face' : 'outfit'} className="!absolute inset-0" />
        <header className="pointer-events-none relative z-10 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="rounded-2xl bg-white/25 px-3 py-2 text-white backdrop-blur">
            <div className="text-[11px] font-extrabold tracking-wider uppercase opacity-90">{SHOP_NAME[shop]}</div>
            <div className="font-display text-xl leading-tight font-extrabold">{tried ? tried.label : 'Choisis, essaie, achète'}</div>
            {tried && <div className="text-xs font-bold opacity-90">{tried.brand}</div>}
          </div>
          <button className="icon-btn pointer-events-auto bg-white shadow-lg" onClick={onClose} aria-label="Fermer">
            <X size={24} strokeWidth={2.6} />
          </button>
        </header>
        <div className="pointer-events-none relative z-10 mt-auto p-3 text-center text-xs font-bold text-white opacity-90">Dans le miroir : fais glisser pour tourner</div>
      </section>

      <section className="sheet relative z-10 -mt-6 flex max-h-[62%] flex-col rounded-t-[28px] lg:mt-0 lg:max-h-none lg:w-[540px] lg:rounded-none">
        <nav className="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-2">
          {[null, ...brands].map((b) => (
            <button key={b ?? 'tout'} onClick={() => setBrand(b)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${brand === b ? 'bg-[var(--color-orange)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}>
              {b ?? 'Tout'}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-3">
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {list.map((p) => {
              const mine = owned.includes(p.id)
              return (
                <button key={p.id} className="tile relative flex flex-col items-center overflow-hidden pb-1.5" aria-pressed={tried?.id === p.id} onClick={() => (setTried(p), setSaid(null))}>
                  <span className={`block w-full ${p.kind === 'accessoire' ? 'aspect-square' : 'aspect-[3/4]'}`}>
                    <Portrait look={wearPiece(look, p)} gender={sim.gender} framing={p.kind === 'accessoire' ? 'bust' : 'full'} />
                  </span>
                  <span className="px-1 text-center text-[11px] leading-tight font-extrabold">{p.label}</span>
                  <span className={`mt-0.5 text-[10.5px] font-extrabold ${mine ? 'text-[var(--color-emerald)]' : 'text-[var(--color-orange)]'}`}>{mine ? 'À toi' : `${amount(p.price)} Djai`}</span>
                  {mine && (
                    <span className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-emerald)] text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        {said && <p className={`mx-3 mb-2 rounded-xl px-3 py-2 text-sm font-bold ${said.tone === 'error' ? 'motion-shake bg-[#ffeef1] text-[#d81b3f]' : 'bg-[#e9f9ef] text-[#1b7a43]'}`}>{said.text}</p>}
        <footer className="flex items-center gap-2 border-t border-[var(--color-line)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button className="btn btn-soft shrink-0 px-4" onClick={app ? onClose : onLeave}>
            {app ? 'Fermer' : 'Sortir'}
          </button>
          {!tried ? (
            <span className="flex-1 text-center text-sm font-bold text-[var(--color-ink-soft)]">Touche une pièce pour l'essayer</span>
          ) : has ? (
            <button className="btn btn-emerald flex-1" disabled={busy || on} onClick={() => putOn(tried)}>
              {on ? 'Tu la portes' : 'La mettre'}
            </button>
          ) : (
            <button className="btn flex-1" disabled={busy || sim.money < tried.price} onClick={() => buy(tried)}>
              <ShoppingBag size={18} /> Acheter · {amount(tried.price)} Djai
            </button>
          )}
        </footer>
        <div className="absolute -top-9 right-3">
          <Chip tone="gold">{amount(sim.money)} Djai</Chip>
        </div>
      </section>
    </div>
  )
}
