import { useEffect, useState } from 'react'
import { BadgeCheck, Clock3, Lock, ShieldCheck, ShoppingBag, XCircle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { ShopPack, ShopPurchase, ShopView, Sim } from '../lib/types'
import { amount } from '../game/rules'
import { Chip, Coin } from '../components/ui'

// La boutique (backend shop/): Djai bought with real money, paid on
// GeniusPay's page (Wave, Orange Money, MTN, Moov, a card), for accounts of 18
// or over. The game is played for free from start to end: a pack only brings
// Djai sooner. Back from the payment (/jeu?achat=…), the purchase is asked
// again until GeniusPay has said its word; the Djai land on the Sim's Waye.

const STATUS: Record<string, { label: string; tone: 'good' | 'bad' | 'gold' | 'neutral' }> = {
  completed: { label: 'Payé', tone: 'good' },
  pending: { label: 'En attente', tone: 'gold' },
  processing: { label: 'En cours', tone: 'gold' },
  failed: { label: 'Échoué', tone: 'bad' },
  error: { label: 'Échoué', tone: 'bad' },
  mismatch: { label: 'À vérifier', tone: 'bad' },
  expired: { label: 'Expiré', tone: 'neutral' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
  refunded: { label: 'Remboursé', tone: 'neutral' },
}
const waitingOn = (p: ShopPurchase) => !p.credited && (p.status === 'pending' || p.status === 'processing')
const failure = (e: unknown) => (e instanceof ApiError ? e.message : 'Pas de réseau')

export function BoutiqueApp({ sim, back, onConfirmAdult }: { sim: Sim; /** Back from GeniusPay's page: the purchase, and whether it came back by the error way. */ back?: { id: string; failed: boolean } | null; onConfirmAdult: () => Promise<void> }) {
  const [view, setView] = useState<ShopView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [returned, setReturned] = useState<ShopPurchase | null>(null)
  const load = () =>
    api
      .shop(sim.id)
      .then((v) => (setView(v), setError(null)))
      .catch((e) => setError(failure(e)))
  useEffect(() => void load(), [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Back from the payment: asked every few seconds until GeniusPay has said (two minutes at most; after that, it's checked by itself).
  useEffect(() => {
    if (!back) return
    let stop = false
    let tries = 0
    const ask = () =>
      api
        .purchase(sim.id, back.id)
        .then((p) => {
          if (stop) return
          setReturned(p)
          if (waitingOn(p) && tries++ < 40) setTimeout(ask, 3000)
          else void load()
        })
        .catch((e) => !stop && setError(failure(e)))
    void ask()
    return () => void (stop = true)
  }, [back?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async (pack: ShopPack) => {
    setBuying(pack.id)
    setError(null)
    try {
      const { url } = await api.buy(sim.id, pack.id)
      // GeniusPay's page: the player chooses how to pay there, and is sent back to the game.
      location.assign(url)
    } catch (e) {
      setError(failure(e))
      setBuying(null)
    }
  }

  if (!view) return error ? <p className="text-sm font-bold text-[var(--color-rose)]">{error}</p> : <p className="text-sm font-bold text-[var(--color-ink-soft)]">Chargement de la boutique…</p>

  return (
    <div className="space-y-3">
      {/* Ink on the gold, as the Encyclo's yellow banner: white wouldn't read on the light corner. */}
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#ffd36e] to-[#ff9a2e] p-3 text-[var(--color-ink)]">
        <ShoppingBag size={28} strokeWidth={2.4} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-[19px] font-extrabold">Boutique</div>
          <div className="text-[12px] font-bold text-[var(--color-ink)]/75">Des Djai tout de suite</div>
        </div>
        <div className="text-right text-[12px] font-extrabold">
          <div className="text-[var(--color-ink)]/65">Ton solde</div>
          {amount(sim.money)} Djai
        </div>
      </div>

      {returned && <Returned purchase={returned} failed={!!back?.failed} />}
      {error && <p className="text-sm font-bold text-[var(--color-rose)]">{error}</p>}

      {!view.adult ? (
        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
          <Lock size={34} className="text-[var(--color-ink-soft)]" />
          <p className="font-display text-xl font-extrabold">Réservé aux 18 ans et plus</p>
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">Les achats se font avec de l'argent réel : il faut avoir 18 ans ou plus. Sinon, tout le jeu reste ouvert gratuitement.</p>
          <button className="btn mt-2 w-full !py-2" disabled={confirming} onClick={() => (setConfirming(true), void onConfirmAdult().then(load, (e) => setError(failure(e))).finally(() => setConfirming(false)))}>
            J’ai 18 ans ou plus
          </button>
        </div>
      ) : !view.open ? (
        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
          <Clock3 size={34} className="text-[var(--color-ink-soft)]" />
          <p className="font-display text-xl font-extrabold">La boutique ouvre bientôt</p>
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">Les packs de Djai arrivent. En attendant, tout le jeu se joue gratuitement.</p>
        </div>
      ) : (
        <div>
          <div className="label mb-1.5">Les packs</div>
          {view.sandbox && <Chip tone="gold" className="mb-2">Mode test : rien n'est vraiment payé</Chip>}
          <ul className="motion-stagger space-y-2">
            {view.packs.map((p) => (
              <li key={p.id} className="card flex items-center gap-3 p-3">
                <Coin size={34} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[17px] leading-tight font-extrabold">{amount(p.djai)} Djai</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] font-extrabold text-[var(--color-ink-soft)]">
                    {p.label}
                    {p.bonus && <Chip tone="good">{p.bonus}</Chip>}
                  </div>
                </div>
                <button className="btn shrink-0 !py-2 !text-sm" disabled={!!buying} onClick={() => void buy(p)}>
                  {buying === p.id ? 'Vers GeniusPay…' : `${amount(p.price)} F CFA`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex gap-1.5 text-[12px] font-bold text-[var(--color-ink-soft)]">
        <ShieldCheck size={16} className="shrink-0" />
        Le jeu se joue gratuitement du début à la fin : un pack donne seulement des Djai plus vite. Paiement sur la page sécurisée de GeniusPay (Wave, Orange Money, MTN, Moov ou carte). Les Djai restent dans le jeu : ils ne se revendent pas et ne se changent pas en argent.
      </p>

      {view.purchases.length > 0 && (
        <div>
          <div className="label mb-1.5">Tes achats</div>
          <ul className="space-y-2">
            {view.purchases.map((p) => {
              const s = STATUS[p.status] ?? STATUS.pending
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-[var(--color-canvas)] p-2.5 text-sm font-bold">
                  <span className="min-w-0 flex-1">
                    <span className="tnum block font-extrabold">{amount(p.djai)} Djai</span>
                    <span className="text-[12px] text-[var(--color-ink-soft)]">
                      {amount(p.price)} F CFA · {new Date(p.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <Chip tone={s.tone}>{s.label}</Chip>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Back from GeniusPay's page: paid (the Djai added), still waiting for its word, or not paid. */
function Returned({ purchase: p, failed }: { purchase: ShopPurchase; failed: boolean }) {
  if (p.credited)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#e3f9ee] p-3">
        <BadgeCheck size={28} className="shrink-0 text-[var(--color-emerald-deep)]" />
        <div className="text-sm font-bold">
          <div className="font-display text-[17px] leading-tight font-extrabold">+{amount(p.djai)} Djai</div>
          Merci ! C'est sur ton Waye.
        </div>
      </div>
    )
  if (waitingOn(p) && !failed)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#fff4d6] p-3">
        <Clock3 size={28} className="shrink-0 text-[#a86800]" />
        <div className="text-sm font-bold">
          <div className="font-display text-[17px] leading-tight font-extrabold">Paiement en cours</div>
          Dès que GeniusPay le confirme, tes {amount(p.djai)} Djai arrivent sur ton Waye. Tu peux continuer à jouer.
        </div>
      </div>
    )
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#ffe8ec] p-3">
      <XCircle size={28} className="shrink-0 text-[#d81b3f]" />
      <div className="text-sm font-bold">
        <div className="font-display text-[17px] leading-tight font-extrabold">Paiement non abouti</div>
        Le paiement n'est pas passé : tu peux réessayer quand tu veux. Si de l'argent a quand même été pris, tes Djai arrivent dès que GeniusPay le confirme.
      </div>
    </div>
  )
}
