// « Soutenir Babi Life » (/don): a donation, the sum one likes, by card (Stripe) or Mobile Money (GeniusPay),
// open to all, signed in or not (backend shop/dons.go). Nothing is bought: only thanks. The donors who agree
// are listed with their message, the total given shown. Back from the payment's page (?merci=<id>), the
// donation asked again till the payment service says it's paid.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, HeartHandshake, Smartphone } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { DonsView } from '../lib/types'
import { amount } from '../game/rules'
import { t as tr, tx } from '../lib/i18n'

const PRESETS = [1000, 2000, 5000, 10000, 25000]

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="street worn min-h-full">
      <header className="bg-[var(--rust)] text-[var(--cream)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] pb-3">
          <Link to="/" className="paint text-[26px]">
            {tr('Babi')} <span className="text-[var(--ochre)]">{tr('Life')}</span>
          </Link>
          <Link to="/" className="text-[13px] font-extrabold underline underline-offset-4">
            {tr('Jouer')}
          </Link>
        </div>
      </header>
      <div className="ci-stripe" aria-hidden />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-14">{children}</main>
    </div>
  )
}

/** Back from the payment's page: the donation asked again (every few seconds, a minute at most) till it's paid. */
function Thanks({ id }: { id: string }) {
  const [state, setState] = useState<{ status: string; amount: number; name: string } | null>(null)
  useEffect(() => {
    let gone = false
    let tries = 0
    const ask = () =>
      api.donation(id).then(
        (d) => {
          if (gone) return
          setState(d)
          if (d.status === 'pending' && ++tries < 20) setTimeout(ask, 3000)
        },
        () => !gone && setState({ status: 'unknown', amount: 0, name: '' }),
      )
    void ask()
    return () => {
      gone = true
    }
  }, [id])
  const paid = state?.status === 'paid'
  return (
    <section className={`mb-6 p-5 ${paid ? 'bg-[var(--mint)]' : 'bg-[var(--cream)]'}`}>
      <h2 className="paint m-0 text-[clamp(32px,8vw,52px)] text-[var(--ci-green)]">{paid ? tr('Merci !') : tr('Un instant…')}</h2>
      <p className="mt-2 text-[17px] font-extrabold">
        {!state
          ? tr('On vérifie ton don auprès du paiement.')
          : paid
            ? tx('Ton don de {0} F CFA est bien arrivé. Il nous aide à faire grandir Babi Life : merci du fond du cœur{1} !', { 0: amount(state.amount), 1: state.name ? `, ${state.name}` : '' })
            : state.status === 'pending'
              ? tr('Le paiement n’est pas encore confirmé. Ça peut prendre une minute, surtout par Mobile Money.')
              : tr('Ce don n’a pas abouti. Tu n’as pas été débité : tu peux réessayer plus bas.')}
      </p>
    </section>
  )
}

export function Don() {
  useEffect(() => void (document.title = tr('Soutenir Babi Life · Faire un don')), [])
  const q = new URLSearchParams(location.search)
  const thanks = q.get('merci')
  const cancelled = q.has('annule')
  const [view, setView] = useState<DonsView | null>(null)
  const [sum, setSum] = useState(2000)
  const [custom, setCustom] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [shown, setShown] = useState(true)
  const [busy, setBusy] = useState<'carte' | 'mobile' | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => void api.dons().then(setView, () => setView(null)), [])
  const value = custom ? Math.round(Number(custom.replace(/\s/g, ''))) || 0 : sum
  const min = view?.min ?? 500
  const max = view?.max ?? 1_000_000
  const ok = value >= min && value <= max
  const give = async (method: 'carte' | 'mobile') => {
    setBusy(method)
    setError(null)
    try {
      const { url } = await api.donate({ amount: value, method, name, email, message, public: shown })
      location.assign(url)
    } catch (e) {
      setError(errorText(e, tr('Erreur')))
      setBusy(null)
    }
  }
  const open = !!view && (view.card || view.mobile)

  return (
    <Shell>
      {thanks && <Thanks id={thanks} />}
      {cancelled && !thanks && <p className="mb-4 bg-[var(--cream)] p-3 text-[15px] font-extrabold">{tr('Paiement annulé : rien n’a été débité.')}</p>}
      <h1 className="paint m-0 text-[clamp(44px,11vw,80px)] text-[var(--rust)] [text-shadow:3px_3px_0_var(--ochre)]">{tr('Soutiens Babi Life')}</h1>
      <p className="mt-3 max-w-xl text-[18px] font-extrabold">
        {tr('Babi Life se joue gratuitement, fait ici, pour nous. Si tu veux nous aider à payer les serveurs et à ajouter des quartiers, des métiers et des histoires, fais un don du montant que tu veux.')}
      </p>
      {view && view.count > 0 && (
        <p className="chalk-hand mt-2 text-[28px] text-[var(--ci-green)]">{view.count === 1 ? tx('Un premier don, {1} F CFA déjà : merci !', { 1: amount(view.total) }) : tx('{0} dons, {1} F CFA déjà : merci !', { 0: view.count, 1: amount(view.total) })}</p>
      )}

      <section className="mt-6 border-2 border-[var(--brown)] bg-[var(--cream)] p-5">
        <h2 className="paint m-0 mb-3 text-[34px]">{tr('Ton don')}</h2>
        {!view ? (
          <p className="font-bold">{tr('Chargement…')}</p>
        ) : !open ? (
          <p className="text-[16px] font-extrabold">{tr('Les dons ouvrent très bientôt. Merci de vouloir nous aider !')}</p>
        ) : (
          <>
            {view.test && <p className="mb-3 bg-[var(--ochre)] px-3 py-1.5 text-sm font-extrabold">{tr('Mode test : rien n’est vraiment payé.')}</p>}
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p} className={`border-2 border-[var(--brown)] px-4 py-2 text-[17px] font-extrabold ${!custom && sum === p ? 'bg-[var(--rust)] text-[var(--cream)]' : 'bg-white'}`} onClick={() => (setSum(p), setCustom(''))}>
                  {amount(p)} F
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-extrabold">
              {tx('Ou un autre montant ({0} à {1} F CFA)', { 0: amount(min), 1: amount(max) })}
              <input className="input mt-1 w-full text-base" inputMode="numeric" placeholder={tr('Montant en F CFA')} value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d\s]/g, ''))} />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block text-sm font-extrabold">
                {tr('Ton nom (facultatif)')}
                <input className="input mt-1 w-full text-base" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block text-sm font-extrabold">
                {tr('Ton e-mail (facultatif, pour te dire merci)')}
                <input className="input mt-1 w-full text-base" type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            </div>
            <label className="mt-2 block text-sm font-extrabold">
              {tr('Un petit mot pour l’équipe (facultatif)')}
              <textarea className="input mt-1 w-full text-base" rows={2} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
              {tr('Afficher mon nom et mon mot parmi les donateurs')}
            </label>
            {error && <p className="mt-3 bg-[#f6d9cf] px-3 py-2 text-sm font-bold text-[var(--rust)]">{error}</p>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {view.card && (
                <button className="sign-btn w-full justify-center" disabled={!ok || !!busy} onClick={() => void give('carte')}>
                  <CreditCard size={20} /> {busy === 'carte' ? tr('Un instant…') : tx('Donner {0} F par carte', { 0: amount(value) })}
                </button>
              )}
              {view.mobile && (
                <button className="sign-btn turq w-full justify-center" disabled={!ok || !!busy} onClick={() => void give('mobile')}>
                  <Smartphone size={20} /> {busy === 'mobile' ? tr('Un instant…') : tx('Donner {0} F par Mobile Money', { 0: amount(value) })}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs font-bold opacity-75">{tr('Paiement sécurisé : par carte avec Stripe (Visa, Mastercard), par Mobile Money avec GeniusPay (Wave, Orange Money, MTN, Moov). Un don ne donne rien dans le jeu : c’est un soutien.')}</p>
          </>
        )}
      </section>

      {view && view.donors.length > 0 && (
        <section className="mt-8">
          <h2 className="paint m-0 mb-3 flex items-center gap-2 text-[34px]">
            <HeartHandshake size={30} className="text-[var(--rust)]" /> {tr('Ils soutiennent Babi Life')}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {view.donors.map((d, i) => (
              <li key={i} className="bg-[var(--cream)] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-extrabold">{d.name}</span>
                  <span className="text-sm font-extrabold text-[var(--ci-green)]">{amount(d.amount)} F</span>
                </div>
                {d.message && <p className="mt-1 text-[14px] font-bold opacity-80">« {d.message} »</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  )
}
