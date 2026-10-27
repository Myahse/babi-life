import { useEffect, useState } from 'react'
import { BadgeCheck, Clock3, Lock, ShieldCheck, ShoppingBag, XCircle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { ActionResult, ShopPurchase, ShopView, Sim } from '../lib/types'
import { amount } from '../game/rules'
import { Chip } from '../components/ui'
import { BoutiqueClothes } from '../components/BoutiqueClothes'
import { useWorld } from '../store/world'
import { activityOpen, useFeatures } from '../lib/features'

// La boutique (backend shop/): what's paid with real money, on GeniusPay's
// page (Wave, Orange Money, MTN, Moov, a card), for accounts of 18 or over:
// packs of Djai, the Babi Pass (a month: a quarter more on the Djai earned,
// the gold star by the name), « Plein d'énergie », the Pack Prestige (the
// crown). The game is played for free from start to end. Back from the
// payment (/jeu?achat=…), the purchase is asked again until GeniusPay has
// said its word; what was bought lands on the Sim.

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
/** The Babi Pass still on. */
export const passOn = (sim: Pick<Sim, 'passUntil'>) => !!sim.passUntil && Date.parse(sim.passUntil) > Date.now()
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
/** What a purchase brought, in a few words (a pack: its Djai). */
const bought = (p: ShopPurchase) => (p.kind === 'djai' ? `${amount(p.djai)} Djai` : p.kind === 'pass' ? 'Babi Pass · 30 jours' : p.kind === 'energie' ? "Plein d'énergie" : p.kind === 'prestige' ? 'Pack Prestige' : p.item)

/** The Pass: a gold ticket, its star. */
function PassArt() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
      <defs>
        <linearGradient id="pass-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.5" stopColor="#f2b705" />
          <stop offset="1" stopColor="#b07a00" />
        </linearGradient>
      </defs>
      <rect x="4" y="11" width="40" height="26" rx="5" fill="url(#pass-g)" />
      <circle cx="4" cy="24" r="4" fill="#fff" />
      <circle cx="44" cy="24" r="4" fill="#fff" />
      <path d="M24 15l2.6 5.4 5.9.8-4.3 4.1 1 5.9L24 28.4l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#fff" stroke="#b07a00" strokeWidth="0.8" />
    </svg>
  )
}
/** Plein d'énergie: a can, its lightning. */
function EnergyArt() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
      <defs>
        <linearGradient id="can-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#00a862" />
          <stop offset="0.45" stopColor="#5fe0a0" />
          <stop offset="1" stopColor="#007a47" />
        </linearGradient>
      </defs>
      <rect x="13" y="6" width="22" height="36" rx="5" fill="url(#can-g)" />
      <rect x="15" y="4" width="18" height="4" rx="2" fill="#c9d1d9" />
      <path d="M26 12l-8 13h6l-2 11 8-14h-6z" fill="#ffe066" stroke="#7a5a00" strokeWidth="0.8" />
    </svg>
  )
}
/** The Pack Prestige: the crown. */
function CrownArt() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
      <defs>
        <linearGradient id="crown-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="1" stopColor="#c48a00" />
        </linearGradient>
      </defs>
      <path d="M7 34l-2-18 10 8 9-13 9 13 10-8-2 18z" fill="url(#crown-g)" stroke="#8a5a00" strokeWidth="1" />
      <rect x="7" y="34" width="34" height="6" rx="2" fill="#c48a00" />
      {[14, 24, 34].map((x, i) => (
        <circle key={x} cx={x} cy="37" r="1.8" fill={['#e03131', '#1c7ed6', '#2f9e44'][i]} />
      ))}
    </svg>
  )
}
/** A pack of Djai: a pile of coins, higher with the pack (1 to 5). */
function CoinsArt({ n }: { n: number }) {
  const coins = Math.max(1, Math.min(5, n))
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
      {[...Array(coins)].map((_, i) => {
        const y = 38 - i * 5.5
        const x = 24 + (i % 2 ? 2 : -2) * (coins > 3 ? 1 : 0)
        return (
          <g key={i}>
            <ellipse cx={x} cy={y + 2.4} rx="14" ry="5" fill="#a86800" />
            <ellipse cx={x} cy={y} rx="14" ry="5" fill="#f7c948" stroke="#c48a00" strokeWidth="0.8" />
            <ellipse cx={x} cy={y} rx="8" ry="2.6" fill="none" stroke="#c48a00" strokeWidth="0.8" />
          </g>
        )
      })}
      {coins >= 4 && <path d="M37 9l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" fill="#fff3b0" />}
    </svg>
  )
}
const ART: Record<string, () => React.ReactNode> = { pass: PassArt, energie: EnergyArt, prestige: CrownArt }

export function BoutiqueApp({ sim, back, onConfirmAdult, onResult }: { sim: Sim; /** Back from GeniusPay's page: the purchase, and whether it came back by the error way. */ back?: { id: string; failed: boolean } | null; onConfirmAdult: () => Promise<void>; /** A piece or a lot of clothes bought in Djai: the Sim after it. */ onResult: (r: ActionResult) => void }) {
  const world = useWorld((s) => s.world)
  const feats = useFeatures()
  // The clothes (in Djai) come with the boutiques' update (lib/features.ts).
  const clothes = !!world?.clothes?.length && activityOpen(feats, 'boutique-mode')
  const [tab, setTab] = useState<'djai' | 'habits'>('djai')
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

  const buy = async (what: { pack?: string; item?: string }) => {
    setBuying(what.pack ?? what.item ?? null)
    setError(null)
    try {
      const { url } = await api.buy(sim.id, what)
      // GeniusPay's page: the player chooses how to pay there, and is sent back to the game.
      location.assign(url)
    } catch (e) {
      setError(failure(e))
      setBuying(null)
    }
  }
  const price = (id: string, n: number) => (buying === id ? 'Vers GeniusPay…' : `${amount(n)} F CFA`)

  if (!view) return error ? <p className="text-sm font-bold text-[var(--color-rose)]">{error}</p> : <p className="text-sm font-bold text-[var(--color-ink-soft)]">Chargement de la boutique…</p>
  const pass = view.passUntil && Date.parse(view.passUntil) > Date.now() ? view.passUntil : null

  return (
    <div className="space-y-3">
      {/* Ink on the gold, as the Encyclo's yellow banner: white wouldn't read on the light corner. */}
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#ffd36e] to-[#ff9a2e] p-3 text-[var(--color-ink)]">
        <ShoppingBag size={28} strokeWidth={2.4} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-[19px] font-extrabold">Boutique</div>
          <div className="text-[12px] font-bold text-[var(--color-ink)]/75">{clothes ? 'Des Djai, le Pass, des vêtements' : 'Des Djai, le Pass, la couronne'}</div>
        </div>
        <div className="text-right text-[12px] font-extrabold">
          <div className="text-[var(--color-ink)]/65">Ton solde</div>
          {amount(sim.money)} Djai
        </div>
      </div>

      {clothes && (
        <div className="segmented" role="tablist">
          {(
            [
              ['djai', 'Djai & Pass'],
              ['habits', 'Vêtements'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {returned && <Returned purchase={returned} failed={!!back?.failed} />}
      {error && <p className="text-sm font-bold text-[var(--color-rose)]">{error}</p>}

      {tab === 'habits' && clothes && world ? (
        <BoutiqueClothes world={world} sim={sim} onResult={onResult} />
      ) : !view.adult ? (
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
        <>
          {view.sandbox && <Chip tone="gold">Mode test : rien n'est vraiment payé</Chip>}
          <div>
            <div className="label mb-1.5">Le Pass et les coups de pouce</div>
            <ul className="motion-stagger space-y-2">
              {view.items.map((it) => {
                const Art = ART[it.id] ?? PassArt
                const have = it.id === 'prestige' && view.prestige
                return (
                  <li key={it.id} className="card p-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#fff8e6] to-[#ffe4a8] shadow-[inset_0_0_0_1px_rgba(168,104,0,0.12)]">
                        <Art />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[17px] leading-tight font-extrabold">{it.label}</div>
                        {(it.id === 'pass' && pass) || have ? (
                          <div className="mt-1">
                            <Chip tone="good">{have ? 'À toi' : `Actif jusqu'au ${day(pass!)}`}</Chip>
                          </div>
                        ) : null}
                      </div>
                      <button className="btn shrink-0 !py-2 !text-sm" disabled={!!buying || have} onClick={() => void buy({ item: it.id })}>
                        {have ? 'Acheté' : it.id === 'pass' && pass ? `Prolonger · ${amount(it.price)} F` : price(it.id, it.price)}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[12px] font-bold text-[var(--color-ink-soft)]">{it.text}</p>
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <div className="label mb-1.5">Les packs de Djai</div>
            <ul className="motion-stagger space-y-2">
              {view.packs.map((p, i) => (
                <li key={p.id} className="card flex items-center gap-3 p-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#fff8e6] to-[#ffe4a8] shadow-[inset_0_0_0_1px_rgba(168,104,0,0.12)]">
                    <CoinsArt n={i + 1} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[17px] leading-tight font-extrabold">{amount(p.djai)} Djai</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] font-extrabold text-[var(--color-ink-soft)]">
                      {p.label}
                      {p.bonus && <Chip tone="good">{p.bonus}</Chip>}
                    </div>
                  </div>
                  <button className="btn shrink-0 !py-2 !text-sm" disabled={!!buying} onClick={() => void buy({ pack: p.id })}>
                    {price(p.id, p.price)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <p className="flex gap-1.5 text-[12px] font-bold text-[var(--color-ink-soft)]">
        <ShieldCheck size={16} className="shrink-0" />
        Le jeu se joue gratuitement du début à la fin : la boutique donne seulement des Djai plus vite, un coup de pouce ou une marque. Paiement sur la page sécurisée de GeniusPay (Wave, Orange Money, MTN, Moov ou carte). Les Djai restent dans le jeu : ils ne se revendent pas et ne se changent pas en argent.
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
                    <span className="tnum block font-extrabold">{bought(p)}</span>
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

/** Back from GeniusPay's page: paid (what was bought given), still waiting for its word, or not paid. */
function Returned({ purchase: p, failed }: { purchase: ShopPurchase; failed: boolean }) {
  if (p.credited)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#e3f9ee] p-3">
        <BadgeCheck size={28} className="shrink-0 text-[var(--color-emerald-deep)]" />
        <div className="text-sm font-bold">
          <div className="font-display text-[17px] leading-tight font-extrabold">{p.kind === 'djai' ? `+${amount(p.djai)} Djai` : bought(p)}</div>
          {p.kind === 'djai' ? "Merci ! C'est sur ton Waye." : p.kind === 'pass' ? 'Merci ! Un quart de Djai en plus sur ce que tu gagnes et sur tes plafonds du jour, et ton étoile dorée.' : p.kind === 'energie' ? 'Toutes tes jauges sont à fond !' : 'Merci ! La couronne est à toi : Profil, Mon look.'}
        </div>
      </div>
    )
  if (waitingOn(p) && !failed)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#fff4d6] p-3">
        <Clock3 size={28} className="shrink-0 text-[#a86800]" />
        <div className="text-sm font-bold">
          <div className="font-display text-[17px] leading-tight font-extrabold">Paiement en cours</div>
          Dès que GeniusPay le confirme, {p.kind === 'djai' ? `tes ${amount(p.djai)} Djai arrivent sur ton Waye` : `ton ${bought(p)} est à toi`}. Tu peux continuer à jouer.
        </div>
      </div>
    )
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#ffe8ec] p-3">
      <XCircle size={28} className="shrink-0 text-[#d81b3f]" />
      <div className="text-sm font-bold">
        <div className="font-display text-[17px] leading-tight font-extrabold">Paiement non abouti</div>
        Le paiement n'est pas passé : tu peux réessayer quand tu veux. Si de l'argent a quand même été pris, ton achat arrive dès que GeniusPay le confirme.
      </div>
    </div>
  )
}
